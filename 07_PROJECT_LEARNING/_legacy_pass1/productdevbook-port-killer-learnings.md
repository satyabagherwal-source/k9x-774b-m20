# Forensic Learning Record (Deep Inspection): productdevbook/port-killer

> **Canonical Artifact**: `07_PROJECT_LEARNING/productdevbook-port-killer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/productdevbook/port-killer](https://github.com/productdevbook/port-killer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T00:21:17.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `productdevbook/port-killer`
- **Description**: A powerful cross-platform port management tool for developers. Monitor ports, manage Kubernetes port forwards, integrate Cloudflare Tunnels, and kill processes with one click.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5090 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `platforms/linux/port-killer.py`
```
#!/usr/bin/env python3
import os
import sys

# Add the directory containing the 'src' package to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from src.main import main

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `platforms/linux/src/__init__.py`
```
# PortKiller Linux Package

```

### Core Architecture Module: `platforms/linux/src/config.py`
```
import os
import json

CONFIG_DIR = os.path.expanduser("~/.config/port-killer")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "use_tree_view": True,
    "hide_system_processes": True,
    "favorites": []
}

class AppConfig:
    def __init__(self):
        self.data = DEFAULT_CONFIG.copy()
        self.load()

    def load(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    self.data.update(json.load(f))
            except Exception as e:
                print(f"Error loading config: {e}")

    def save(self):
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.data, f, indent=4)
        except Exception as e:
            print(f"Error saving config: {e}")

    @property
    def use_tree_view(self):
        return self.data.get("use_tree_view", True)

    @use_tree_view.setter
    def use_tree_view(self, val):
        self.data["use_tree_view"] = bool(val)
        self.save()

    @property
    def hide_system_processes(self):
        return self.data.get("hide_system_processes", True)

    @hide_system_processes.setter
    def hide_system_processes(self, val):
        self.data["hide_system_processes"] = bool(val)
        self.save()

    @property
    def favorites(self):
        return self.data.get("favorites", [])

    def add_favorite(self, port):
        if port not in self.data["favorites"]:
            self.data["favorites"].append(port)
            self.save()

    def remove_favorite(self, port):
        if port in self.data["favorites"]:
            self.data["favorites"].remove(port)
            self.save()

    def is_favorite(self, port):
        return port in self.data["favorites"]

# Global config instance
config = AppConfig()

def get_icon_path():
    import sys
    src_dir = os.path.dirname(os.path.abspath(__file__)) # /path/to/src
    parent_dir = os.path.dirname(src_dir) # /path/to
    
    candidates = [
        os.path.join(parent_dir, "AppIcon.svg"),
        os.path.join(src_dir, "AppIcon.svg"),
        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "AppIcon.svg"),
    ]
    # Require a non-empty file: an empty AppIcon.svg (e.g. left by an older
    # installer) would otherwise be passed to AppIndicator instead of letting
    # the caller fall back to a system icon name.
    for p in candidates:
        if os.path.isfile(p) and os.path.getsize(p) > 0:
            return p
    return None


```

### Core Architecture Module: `platforms/linux/src/main.py`
```
import os
import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib

def main():
    # Set application details for desktop integration (so taskbar/dock maps correctly)
    GLib.set_prgname('port-killer')
    GLib.set_application_name('PortKiller')

    # Load custom stylesheet
    script_dir = os.path.dirname(os.path.abspath(__file__))
    css_path = os.path.join(script_dir, "ui", "styles.css")
    
    if os.path.exists(css_path):
        css_provider = Gtk.CssProvider()
        try:
            css_provider.load_from_path(css_path)
            screen = Gdk.Screen.get_default()
            Gtk.StyleContext.add_provider_for_screen(
                screen, 
                css_provider, 
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            )
        except Exception as e:
            print(f"Warning: Could not load CSS styles: {e}")

    # Set default window icon globally
    from .config import get_icon_path
    icon_path = get_icon_path()
    if icon_path:
        try:
            Gtk.Window.set_default_icon_from_file(icon_path)
        except Exception as e:
            print(f"Warning: Could not set default window icon: {e}")

    # Import and start the tray app
    from .ui.tray import PortKillerTrayApp
    app = PortKillerTrayApp()
    
    # Run Gtk main loop
    Gtk.main()

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `platforms/linux/src/scanner.py`
```
import os
import signal
import subprocess
import time

class PortScanner:
    @staticmethod
    def scan_ports():
        ports = []
        try:
            # Try ss first (more complete on Linux as it shows all ports, even of other users)
            result = subprocess.run(
                ["ss", "-tlnp"],
                capture_output=True,
                text=True,
                check=True
            )
            ports = PortScanner.parse_ss_output(result.stdout)
        except (subprocess.SubprocessError, FileNotFoundError):
            # Fall back to lsof
            try:
                result = subprocess.run(
                    ["lsof", "-iTCP", "-sTCP:LISTEN", "-P", "-n"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                ports = PortScanner.parse_lsof_output(result.stdout)
            except (subprocess.SubprocessError, FileNotFoundError):
                pass
        return ports

    @staticmethod
    def parse_lsof_output(output):
        ports = []
        seen = set()
        lines = output.strip().split('\n')
        if len(lines) <= 1:
            return ports
        
        commands = PortScanner.get_process_commands()

        for line in lines[1:]:
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 9:
                continue
            
            process_name = parts[0]
            try:
                pid = int(parts[1])
            except ValueError:
                continue
            
            # Find the name column with colon
            address_str = None
            for p in reversed(parts[8:]):
                if ':' in p and not p.startswith('0x') and not p.startswith('0t'):
                    address_str = p
                    break
            
            if not address_str:
                continue
            
            addr_port = PortScanner.parse_address(address_str)
            if not addr_port:
                continue
            address, port = addr_port
            
            command = commands.get(pid, process_name)
            if len(command) > 200:
                command = command[:200] + "..."
                
            if (port, pid) not in seen:
                seen.add((port, pid))
                ports.append({
                    'port': port,
                    'pid': pid,
                    'process_name': process_name,
                    'command': command,
                    'address': address
                })
                
        ports.sort(key=lambda x: x['port'])
        return ports

    @staticmethod
    def parse_ss_output(output):
        ports = []
        seen = set()
        lines = output.strip().split('\n')

        commands = PortScanner.get_process_commands()

        # Skip the header by position: matching on "State" breaks under
        # locales where ss translates its column titles.
        for line in lines[1:]:
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
                
            local_addr = parts[3]
            last_colon = local_addr.rfind(':')
            if last_colon == -1:
                continue
                
            address = local_addr[:last_colon]
            if not address:
                address = "*"
            try:
                port = int(local_addr[last_colon + 1:])
            except ValueError:
                continue
                
            pid = 0
            process_name = "Unknown"
            found_proc = False
            
            if len(parts) >= 6:
                proc_col = " ".join(parts[5:])
                users = PortScanner.parse_ss_users(proc_col)
                for name, p in users:
                    found_proc = True
                    command = commands.get(p, name)
                    if len(command) > 200:
                        command = command[:200] + "..."
                    if (port, p) not in seen:
                        seen.add((port, p))
                        ports.append({
                            'port': port,
                            'pid': p,
                            'process_name': name,
                            'command': command,
                            'address': address
                        })
            
            if not found_proc:
                if (port, pid) not in seen:
                    seen.add((port, pid))
                    ports.append({
                        'port': port,
                        'pid': pid,
                        'process_name': process_name,
                        'command': "Unknown",
                        'address': address
                    })
                
        ports.sort(key=lambda x: x['port'])
        return ports

    @staticmethod
    def parse_ss_users(users_str):
        results = []
        if "users:(" in users_str:
            content = users_str[users_str.find("users:(") + 7 : -1]
            for part in content.split("),("):
                clean = part.lstrip('(').rstrip(')')
                fields = clean.split(',')
                if len(fields) >= 2:
                    name = fields[0].strip('"')
                    pid_str = fields[1].strip()
                    if pid_str.startswith("pid="):
                        try:
                            pid = int(pid_str[4:])
                            results.append((name, pid))
                        except ValueError:
                            pass
        return results

    @staticmethod
    def parse_address(address_str):
        if address_str.startswith('['):
            bracket_end = address_str.find(']')
            if bracket_end == -1 or bracket_end + 1 >= len(address_str):
                return None
            after = address_str[bracket_end + 1:]
            if not after.startswith(':'):
                return None
            try:
                port = int(after[1:])
                return address_str[:bracket_end + 1], port
            except ValueError:
                return None
        else:
            last_colon = address_str.rfind(':')
            if last_colon == -1:
                return None
            try:
                port = int(address_str[last_colon + 1:])
                addr = address_str[:last_colon]
                if not addr:
                    addr = "*"
                return addr, port
            except ValueError:
                return None

    @staticmethod
    def get_process_commands():
        commands = {}
        try:
            result = subprocess.run(
                ["ps", "-axo", "pid,command"],
                capture_output=True,
                text=True,
                check=True
            )
            lines = result.stdout.strip().split('\n')
            for line in lines[1:]:
                trimmed = line.strip()
                if not trimmed:
                    continue
                parts = trimmed.split(None, 1)
                if len(parts) < 2:
                    continue
                try:
                    pid = int(parts[0])
                    commands[pid] = parts[1].strip()
                except ValueError:
                    continue
        except subprocess.SubprocessError:
            pass
        return commands

    @staticmethod
    def is_process_running(pid):
        if pid <= 0:
            return False
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            # Exists but owned by another user
            return True

    @staticmethod
    def kill_process(pid, force=False):
        """
        Terminate a process.

        force=False follows the project convention: SIGTERM, wait 500ms, then
        SIGKILL if it is still alive. force=True s
```

### Core Architecture Module: `platforms/linux/src/services/__init__.py`
```
# PortKiller Linux Services

```

### Core Architecture Module: `platforms/linux/src/services/clipboard.py`
```
import shutil
import subprocess

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk

def copy_to_clipboard(text):
    try:
        clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
        clipboard.set_text(text, -1)
        return True
    except Exception as e:
        print(f"Error copying to clipboard: {e}")
        return False


# Resolved once: warn at startup rather than failing silently on every action.
_NOTIFY_SEND = shutil.which("notify-send")
if not _NOTIFY_SEND:
    print(
        "Warning: notify-send not found; desktop notifications are disabled. "
        "Install libnotify-bin (Debian/Ubuntu) or libnotify (Fedora/Arch)."
    )


def notify(title, message):
    """
    Show a desktop notification. Runs without blocking the GTK main loop.
    """
    if not _NOTIFY_SEND:
        return False
    try:
        subprocess.Popen(
            [_NOTIFY_SEND, "-a", "PortKiller", title, message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except OSError as e:
        print(f"Error sending notification: {e}")
        return False

```

### Core Architecture Module: `platforms/linux/src/services/cloudflare.py`
```
import os
import re
import shutil
import subprocess
import threading
import time

class CloudflareTunnel:
    def __init__(self, port):
        self.port = port
        self.url = None
        self.status = "starting"  # starting, active, error, stopping
        self.error = None
        self.process = None
        self.thread = None

    def start(self):
        cloudflared_bin = shutil.which("cloudflared")
        if not cloudflared_bin:
            # Check common paths
            for path in ["/usr/local/bin/cloudflared", "/usr/bin/cloudflared", "/opt/bin/cloudflared"]:
                if os.path.exists(path):
                    cloudflared_bin = path
                    break
        
        if not cloudflared_bin:
            self.status = "error"
            self.error = "cloudflared binary not found in PATH or standard locations."
            return False

        try:
            # Start cloudflared quick tunnel
            self.process = subprocess.Popen(
                [cloudflared_bin, "tunnel", "--url", f"localhost:{self.port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            
            # Start background thread to read output
            self.thread = threading.Thread(target=self._read_output, daemon=True)
            self.thread.start()
            return True
        except Exception as e:
            self.status = "error"
            self.error = str(e)
            return False

    def _read_output(self):
        pattern = r"https://[a-zA-Z0-9-]+\.trycloudflare\.com"
        last_error_line = None

        while self.process and self.process.poll() is None:
            line = self.process.stdout.readline()
            if not line:
                break

            # Parse URL
            match = re.search(pattern, line)
            if match:
                self.url = match.group(0)
                self.status = "active"

            # Remember the most recent error-looking line, but do not change
            # status yet: cloudflared logs transient connection retries during
            # startup that contain "error"/"failed" and still go on to connect.
            line_lower = line.lower()
            if "error" in line_lower or "failed" in line_lower:
                last_error_line = line.strip()

        # Only the process actually exiting is treated as a failure.
        if self.process and self.process.poll() is not None:
            returncode = self.process.returncode
            if self.status not in ("stopping", "stopped"):
                self.status = "error"
                self.error = last_error_line or f"Process exited with code {returncode}"

    def stop(self):
        self.status = "stopping"
        if self.process:
            try:
                self.process.terminate()
                # Wait up to 1 second
                for _ in range(10):
                    if self.process.poll() is not None:
                        break
                    time.sleep(0.1)

                if self.process.poll() is None:
                    self.process.kill()

                # Reap the child so it does not linger as a zombie
                self.process.wait()
            except Exception:
                pass
        self.status = "stopped"

class CloudflareService:
    def __init__(self):
        self.active_tunnels = {}  # port -> CloudflareTunnel

    @property
    def is_installed(self):
        return shutil.which("cloudflared") is not None or any(
            os.path.exists(p) for p in ["/usr/local/bin/cloudflared", "/usr/bin/cloudflared"]
        )

    def start_tunnel(self, port):
        if port in self.active_tunnels:
            tunnel = self.active_tunnels[port]
            if tunnel.status != "error":
                return tunnel
        
        tunnel = CloudflareTunnel(port)
        self.active_tunnels[port] = tunnel
        tunnel.start()
        return tunnel

    def stop_tunnel(self, port):
        if port in self.active_tunnels:
            self.active_tunnels[port].stop()
            del self.active_tunnels[port]

    def stop_all(self):
        for port in list(self.active_tunnels.keys()):
            self.stop_tunnel(port)

    def get_tunnel(self, port):
        return self.active_tunnels.get(port)

    def scan_running_tunnels_from_ps(self):
        """
        Scan the operating system process list to see if any cloudflared tunnels
        were launched externally.
        """
        external_tunnels = []
        try:
            # Query running processes matching cloudflared
            result = subprocess.run(
                ["ps", "-axo", "pid,command"],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                return external_tunnels

            # Pattern to parse cloudflared tunnel command
            # e.g., cloudflared tunnel --url localhost:3000
            # Output format is "PID COMMAND", so split off the PID and keep
            # the rest of the line as the command.
            for line in result.stdout.splitlines()[1:]:
                trimmed = line.strip()
                if not trimmed:
                    continue

                parts = trimmed.split(None, 1)
                if len(parts) < 2:
                    continue

                pid_str, cmd = parts[0], parts[1]
                if "cloudflared" not in cmd or "tunnel" not in cmd or "--url" not in cmd:
                    continue

                # Find local port
                port_match = re.search(r"localhost:(\d+)", cmd)
                if not port_match:
                    continue

                try:
                    pid = int(pid_str)
                except ValueError:
                    continue

                port = int(port_match.group(1))
                # Check if we already manage this port. If not, add as external
                if port not in self.active_tunnels:
                    external_tunnels.append({
                        "port": port,
                        "pid": pid,
                        "status": "active",
                        "url": "External (check terminal)",
                        "command": cmd,
                    })
        except Exception as e:
            print(f"Error scanning cloudflared processes: {e}")
        
        return external_tunnels

# Global service instance
cloudflare_service = CloudflareService()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #94** (2026-03-09): **Process names with non-ASCII characters (e.g., Chinese) are displayed as raw hex bytes (UTF-8 escape sequences)**
  *Symptoms*: Description:  When a process has a Chinese name (or a path containing Chinese characters), PortKiller displays the process name as raw UTF-8 hex sequences (e.g., \xe4\xbc\x81\xe4\xb8\x9a\xe5\xbe\xae\xe4\xbf\xa1) instead of the actual characters.  Steps to Reproduce:  - Run an application with a Chinese name (e.g., WeCom / 企业微信).  - Open PortKiller and locate the process.  - Observe the process name in the list.  Expected Behavior:  The process name should be rendered correctly as "企业微信".  <img width="410" height="38" alt="Image" src="https://github.com/user-attachments/assets/d74cca90-58d6-4f93-b7fc-f312395813ca" />  <img width="1072" height="752" alt="Image" src="https://github.com/user-attachments/assets/9a6bc63f-7100-442d-837f-6dd2db10f581" />  Actual Behavior:  The name is shown as \xe4\xbc\x81\xe4\xb8\x9a\xe5\xbe\xae\xe4\xbf\xa1....  <img width="355" height="665" alt="Image" src="https://github.com/user-attachments/assets/cdd339f2-98da-4568-b561-8c116e504559" />  Environment:  OS: macOS Tahoe Beta 26.4 (25E5218f)
  **Post-Mortem & Fix Analysis**:
  > This issue might be similar to #86 :)
  > #86 I thought it was spam, but it wasn't. :D 
  > <img width="912" height="744" alt="Image" src="https://github.com/user-attachments/assets/e9a7fbad-1fd3-4910-bfe1-70d09b8160f5" />  Confirmed: #86 is actually the same process name ("企业微信") but rendered in different encoding lol

- **Issue #93** (2026-06-13): **Mac Dock icon - incorrect size**
  *Symptoms*: Hi,  Not really a big issue, but worth mentioning.  On macOS Sequoia 15.6.1, the size of the icon seems to be off in comparison with the other dock icons.  <img width="644" height="154" alt="Image" src="https://github.com/user-attachments/assets/89cdf49f-c75d-4141-9673-96dc3cb82c77" />  FYI: There is a reddit post the might be usefull: https://www.reddit.com/r/PWA/comments/rm2v38/macos_dock_icon_sizing/  I'm running PortKiller: <img width="792" height="598" alt="Image" src="https://github.com/user-attachments/assets/b89de60f-6422-4282-971a-ae5d245ad46b" />
  **Post-Mortem & Fix Analysis**:
  > Fixed in cacb9b9. The icon artwork filled the full 1024×1024 canvas with no transparent margin, so it rendered larger than other Dock icons. The SVG now wraps the artwork in a centered 824×824 content box (100px margin per side, matching the macOS app-icon grid), and the fallback `AppIcon.icns` was regenerated from it.  One caveat for verification: the primary icon path is the Xcode 26 `AppIcon.icon` (Icon Composer) package, which composes its own `plug.svg`/`cross.svg` layers and normally applies the standard margin itself; the regenerated `.icns` is the CI fallback. After the next release please confirm the Dock size looks right — if it still looks oversized, the `position.scale` of the layers inside `AppIcon.icon` would need a small reduction in Icon Composer.

- **Issue #87** (2026-03-09): **Killing a port leaves ESTABLISHED connections from other processes**
  *Symptoms*: ## Description  When killing a port (e.g., port 8080), PortKiller only terminates the process that has the port in `LISTEN` state, but leaves other processes with `ESTABLISHED` connections to that port still running.  ## Steps to Reproduce  1. Start a Node.js server on port 8080 2. Have other processes connect to it (e.g., Chrome DevTools, other Node processes) 3. Use PortKiller to kill port 8080 4. Run `lsof -i :8080`  ## Expected Behavior  The port should be completely free with no processes associated.  ## Actual Behavior  While the main listening process is killed and the port appears "free", running `lsof -i :8080` still shows other processes with ESTABLISHED connections:  ``` COMMAND     PID           USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME Google      942 gustavomarrero   40u  IPv6 0xc2c529762dc3b166      0t0  TCP localhost:56524->localhost:http-alt (ESTABLISHED) node      66490 gustavomarrero   25u  IPv6 0x6e8aaddeb86bbe7d      0t0  TCP localhost:56500->localhost:http-alt (ESTABLISHED) ```  These are client connections that were connected to the server. They remain in an orphaned state.  ## Suggested Solution  Add an option to also kill processes that have ESTABLISHED connections to the target port, not just the LISTEN process. This could be:  1. A setting/preference: "Also kill connected processes" 2. A confirmation dialog showing all affected processes before killing 3. A "Deep Kill" vs "Quick Kill" option  ## Environment  - macOS Sequoia - PortKiller

- **Issue #86** (2026-03-09): **The i18n app name didn't show currect**
  *Symptoms*: /Applications/M-dM-<M^AM-dM-8M^ZM-eM->M-.M-dM-?M-!.app/Contents/MacOS/M-dM-<M^AM-dM-8M^ZM-eM->M-.M-dM-?M-!

- **Issue #72** (2026-01-08): **brew broken new version**
  *Symptoms*: ``` brew install portkiller ✔︎ JSON API formula.jws.json                                                                                                                                         Downloaded   32.1MB/ 32.1MB ✔︎ JSON API cask.jws.json                                                                                                                                            Downloaded   15.3MB/ 15.3MB ==> Downloading https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg curl: (56) The requested URL returned error: 404  Error: Download failed on Cask 'portkiller' with message: Download failed: https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg ```
  **Post-Mortem & Fix Analysis**:
  > Would you try again? `brew install portkiller` 
  > I’m seeing the same issue on my setup. `brew install portkiller` also fails with the same download error:  ``` ❯ brew install portkiller ==> Fetching downloads for: productdevbook/tap/portkiller ✘ Cask portkiller (3.1.0) Error: Download failed on Cask 'portkiller' with message: Download failed: https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg ```
  > ``` brew cleanup brew cleanup --prune=all ```   They seem to be stuck in the cache. Could you do that and try again?

- **Issue #38** (2025-12-18): **`shift+command+p` is a bad keybind choice, conflicts with code editors**
  *Symptoms*: Hello,  I installed this after seeing on Twitter, and it's a useful tool for sure.  But after an update today, I noticed that the tool adds a keybind for <kbd>shift+command+p</kbd> to open, which is a terrible choice, honestly. Many apps like code editors and other use that to open a command picker. With Port-Killer opened, it makes it basically impossible to open that.
  **Post-Mortem & Fix Analysis**:
  > which used version ? 
  > You can change this in the settings.  <img width="1122" height="358" alt="Image" src="https://github.com/user-attachments/assets/3d4444a6-433c-4caa-8638-1d31ab71b26e" />
  > v2.5.6  Managed to clear the setting, and now I can properly use binding of other apps.  I still think this should not be the default. <kbd>shift+command+p</kbd> is simply too common. It conflicts with _so_ many apps...

- **Issue #36** (2025-12-17): **Opening settings crashes app**
  *Symptoms*: Crashreport <details><summary>Details</summary> <p>  ``` ------------------------------------- Translated Report (Full Report Below) ------------------------------------- Process:             PortKiller [63891] Path:                /Applications/PortKiller.app/Contents/MacOS/PortKiller Identifier:          com.portkiller.app Version:             2.5.0 (110) Code Type:           ARM-64 (Native) Role:                Foreground Parent Process:      launchd [1] Coalition:           com.portkiller.app [12148] User ID:             502  Date/Time:           2025-12-17 11:07:54.9430 -0500 Launch Time:         2025-12-17 11:07:48.5107 -0500 Hardware Model:      MacBookPro18,2 OS Version:          macOS 26.2 (25C56) Release Type:        User  Crash Reporter Key:  3BB12B61-5E0A-0F0F-EB6B-68CCE600280F Incident Identifier: 52F1482D-A4FA-4B47-950C-60C59E557F11  Sleep/Wake UUID:       F9E248E4-C162-411B-9453-6FC091666EF8  Time Awake Since Boot: 23000 seconds Time Since Wake:       3995 seconds  System Integrity Protection: enabled  Triggered by Thread: 0, Dispatch Queue: com.apple.main-thread  Exception Type:    EXC_BREAKPOINT (SIGTRAP) Exception Codes:   0x0000000000000001, 0x00000001ab2f19d4  Termination Reason:  Namespace SIGNAL, Code 5, Trace/BPT trap: 5 Terminating Process: exc handler [63891]   Thread 0 Crashed::  Dispatch queue: com.apple.main-thread 0   libswiftCore.dylib            	       0x1ab2f19d4 _assertionFailure(_:_:file:line:flags:) + 176 1   PortKiller                    	
  **Post-Mortem & Fix Analysis**:
  > Yes :( i see. My 8 attempts are almost entirely due to these shortcuts from the library; I just can't find them. There's no problem locally, but when published, the dmg gets corrupted.
  > Okay, I managed to run the error locally, let's see if I can fix it.
  > Same thing here for me. Here's the complete log:  <details><summary>Details</summary> <p>   ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               PortKiller [44428] Path:                  /Applications/PortKiller.app/Contents/MacOS/PortKiller Identifier:            com.portkiller.app Version:               2.5.2 (116) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2025-12-17 13:59:22.7678 -0300 OS Version:            macOS 15.6.1 (24G90) Report Version:        12 Anonymous UUID:        57F7EF66-55C1-9064-2146-D7BE23BCF42D  Sleep/Wake UUID:       B4308EE0-94E7-4128-A8FD-BA328C03C118  Time Awake Since Boot: 290000 seconds Time Since Wake:       115 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:   

- **Issue #33** (2025-12-17): **Right panel resizing acting weird**
  *Symptoms*: I don't know what causes this and if this happens to anyone else, but the right side panel resizing is acting weird with me. Can't really resize it eassily  https://github.com/user-attachments/assets/e34fed10-668b-41fe-9e23-0eddbee7e0ac
  **Post-Mortem & Fix Analysis**:
  > I just can't get used to this SwiftUI coding. :D 

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

### Incident Patch 1: `38a3df2d` (2026-06-21)
**Commit Message**: fix: use latest homebrew syntax for depends on (#109)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -377,7 +377,7 @@ jobs:
             desc "Menu bar app to find and kill processes running on open ports"
             homepage "https://github.com/productdevbook/port-killer"
 
-            depends_on macos: ">= :sequoia"
+            depends_on macos: :sequoia
 
             app "PortKiller.app"
 
```

---

### Incident Patch 2: `cacb9b9f` (2026-06-13)
**Commit Message**: fix: add standard transparent margin to app icon (#93, #19)

The icon artwork filled the entire 1024x1024 canvas with no padding, so it
rendered noticeably larger than neighbouring icons in the Dock. Wrap the
artwork in an 824x824 content box centered with a 100px margin on every side,
matching the macOS app-icon grid, and regenerate the fallback AppIcon.icns
from the corrected SVG (rsvg-convert + iconutil).

Closes #93
Closes #19

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `platforms/macos/Resources/AppIcon.svg` (modified, +25/-19)
```diff
@@ -11,29 +11,35 @@
     </linearGradient>
   </defs>
 
-  <!-- Background -->
-  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
+  <!-- All artwork lives inside an 824x824 content box centered in the 1024 canvas
+       (100px transparent margin on every side), matching the macOS app-icon grid.
+       Without this margin the icon renders larger than its neighbors in the Dock
+       (issues #93, #19). -->
+  <g transform="translate(100, 100) scale(0.8046875)">
+    <!-- Background -->
+    <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
 
-  <!-- Plug body - scaled 1.6x and centered -->
-  <g transform="translate(512, 420) scale(1.6)">
-    <!-- Plug base -->
-    <rect x="-140" y="20" width="280" height="200" rx="30" fill="url(#plug)"/>
+    <!-- Plug body - scaled 1.6x and centered -->
+    <g transform="translate(512, 420) scale(1.6)">
+      <!-- Plug base -->
+      <rect x="-140" y="20" width="280" height="200" rx="30" fill="url(#plug)"/>
 
-    <!-- Plug prongs -->
-    <rect x="-100" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
-    <rect x="50" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
+      <!-- Plug prongs -->
+      <rect x="-100" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
+      <rect x="50" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
 
-    <!-- Ground prong -->
-    <rect x="-25" y="-80" width="50" height="120" rx="12" fill="url(#plug)"/>
+      <!-- Ground prong -->
+      <rect x="-25" y="-80" width="50" height="120" rx="12" fill="url(#plug)"/>
 
-    <!-- Cord -->
-    <path d="M 0 220 Q 0 300 -50 350 Q -100 400 -100 450"
-          stroke="url(#plug)" stroke-width="50" stroke-linecap="round" fill="none"/>
-  </g>
+      <!-- Cord -->
+      <path d="M 0 220 Q 0 300 -50 350 Q -100 400 -100 450"
+            stroke="url(#plug)" stroke-width="50" stroke-linecap="round" fill="none"/>
+    </g>
 
-  <!-- Kill X overlay - scaled 1.6x -->
-  <g transform="translate(512, 480) scale(1.6)">
-    <line x1="-180" y1="-180" x2="180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
-    <line x1="180" y1="-180" x2="-180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+    <!-- Kill X overlay - scaled 1.6x -->
+    <g transform="translate(512, 480) scale(1.6)">
+      <line x1="-180" y1="-180" x2="180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+      <line x1="180" y1="-180" x2="-180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+    </g>
   </g>
 </svg>
```

---

### Incident Patch 3: `f6f79c45` (2026-06-13)
**Commit Message**: fix: plug memory growth sources in port-forward and auto-refresh (#75)

Two concrete accumulation/retain sources found by code audit:

- PortForwardProcessManager.killProcesses now drops the stored log and
  port-conflict handler closures itself. Previously cleanup depended on every
  caller either reconnecting (overwriting the handler) or explicitly removing
  it; a caller that did neither would leak a closure capturing connection
  state. Removes the now-redundant explicit removes in stopConnection and the
  unused remove* methods.

- AppState auto-refresh Task captured self strongly while being stored on
  AppState, forming a retain cycle that kept AppState (and everything it owns)
  alive past teardown. Capture [weak self].

Addresses #75; full confirmation needs a long-running profile.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `platforms/macos/Sources/AppState+AutoRefresh.swift` (modified, +3/-2)
```diff
@@ -11,12 +11,13 @@ extension AppState {
     /// Starts a background task that periodically refreshes the port list.
     func startAutoRefresh() {
         stopAutoRefresh()
-        refreshTask = Task { @MainActor in
+        refreshTask = Task { @MainActor [weak self] in
+            guard let self else { return }
             var unchangedCycles = 0
             _ = await self.refresh()
             while !Task.isCancelled {
                 let baseInterval = max(1, Defaults[.refreshInterval])
-                let delaySeconds = adaptiveRefreshDelay(baseInterval: baseInterval, unchangedCycles: unchangedCycles)
+                let delaySeconds = self.adaptiveRefreshDelay(baseInterval: baseInterval, unchangedCycles: unchangedCycles)
                 try? await Task.sleep(for: .seconds(delaySeconds))
                 guard !Task.isCancelled else { break }
 
```

**File**: `platforms/macos/Sources/Managers/PortForwardManager.swift` (modified, +1/-2)
```diff
@@ -199,9 +199,8 @@ final class PortForwardManager {
         state.clearLogs()
 
         Task {
+            // killProcesses also drops the stored log/port-conflict handlers.
             await processManager.killProcesses(for: id)
-            await processManager.removeLogHandler(for: id)
-            await processManager.removePortConflictHandler(for: id)
         }
     }
 
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager.swift` (modified, +5/-8)
```diff
@@ -18,18 +18,10 @@ actor PortForwardProcessManager {
         logHandlers[id] = handler
     }
 
-    func removeLogHandler(for id: UUID) {
-        logHandlers.removeValue(forKey: id)
-    }
-
     func setPortConflictHandler(for id: UUID, handler: @escaping PortConflictHandler) {
         portConflictHandlers[id] = handler
     }
 
-    func removePortConflictHandler(for id: UUID) {
-        portConflictHandlers.removeValue(forKey: id)
-    }
-
     // MARK: - Output Reading
 
     func startReadingOutput(pipe: Pipe, id: UUID, type: PortForwardProcessType) {
@@ -108,6 +100,11 @@ actor PortForwardProcessManager {
         }
         processes[id] = nil
         connectionErrors.removeValue(forKey: id)
+        // Drop stored handler closures so they can't outlive the connection. Callers that
+        // immediately reconnect re-register fresh handlers; this keeps the cleanup correct
+        // even for callers that don't.
+        logHandlers.removeValue(forKey: id)
+        portConflictHandlers.removeValue(forKey: id)
 
         let scriptPath = "/tmp/pf-wrapper-\(id.uuidString).sh"
         try? FileManager.default.removeItem(atPath: scriptPath)
```

---

### Incident Patch 4: `78a1c054` (2026-03-09)
**Commit Message**: fix: group tree view by process name instead of PID (#101)

Previously, two instances of the same process (e.g., two node servers)
were shown as separate groups because grouping was by PID. Now they
are grouped by process name, so all ports from the same process appear
under one collapsible group.

Fixes #85

Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `platforms/macos/Sources/Models/ProcessGroup.swift` (modified, +6/-3)
```diff
@@ -14,12 +14,15 @@ import Foundation
 /// their owning process. This provides a hierarchical view where users can
 /// expand/collapse processes to see all their associated ports.
 struct ProcessGroup: Identifiable, Sendable {
-    /// Process ID (PID) - used as stable identifier
-    let id: Int
+    /// Process name - used as stable identifier for grouping
+    let id: String
 
     /// Name of the process owning these ports
     let processName: String
 
-    /// All ports owned by this process
+    /// All PIDs in this group
+    let pids: [Int]
+
+    /// All ports owned by this process (across all PIDs)
     let ports: [PortInfo]
 }
```

**File**: `platforms/macos/Sources/Services/PortGroupingService.swift` (modified, +10/-8)
```diff
@@ -33,11 +33,12 @@ actor PortGroupingService {
     /// // groups[0] might contain: ProcessGroup(id: 1234, processName: "node", ports: [3000, 3001])
     /// ```
     func groupByProcess(_ ports: [PortInfo]) -> [ProcessGroup] {
-        let grouped = Dictionary(grouping: ports) { $0.pid }
-        return grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: ports) { $0.processName }
+        return grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { $0.processName.localizedCaseInsensitiveCompare($1.processName) == .orderedAscending }
@@ -54,11 +55,12 @@ actor PortGroupingService {
     ///   - watched: Set of watched port numbers
     /// - Returns: Array of ProcessGroup instances, sorted by priority then name
     func groupByProcessWithPriority(_ ports: [PortInfo], favorites: Set<Int>, watched: Set<Int>) -> [ProcessGroup] {
-        let grouped = Dictionary(grouping: ports) { $0.pid }
-        return grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: ports) { $0.processName }
+        return grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { a, b in
```

**File**: `platforms/macos/Sources/Views/Components/ProcessGroupRow.swift` (modified, +3/-2)
```diff
@@ -48,11 +48,12 @@ struct ProcessGroupListRow: View {
             }
             .frame(width: 150, alignment: .leading)
 
-            // PID (aligned with PID column of header)
-            Text("\(group.id)")
+            // PID(s) (aligned with PID column of header)
+            Text(group.pids.count == 1 ? "\(group.pids[0])" : "\(group.pids.count) PIDs")
                 .font(.system(.body, design: .monospaced))
                 .foregroundStyle(.secondary)
                 .frame(width: 70, alignment: .leading)
+                .help(group.pids.map(String.init).joined(separator: ", "))
 
             // Port Count Badge (aligned with Type column of header effectively)
             if !showConfirm {
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarPortList.swift` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ struct MenuBarPortList: View {
     let filteredPortForwardConnections: [PortForwardConnectionState]
     let groupedByProcess: [ProcessGroup]
     let useTreeView: Bool
-    @Binding var expandedProcesses: Set<Int>
+    @Binding var expandedProcesses: Set<String>
     @Binding var confirmingKillPort: String?
     @Bindable var state: AppState
 
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarProcessGroupRow.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ struct MenuBarProcessGroupRow: View {
                     if group.ports.contains(where: { state.isWatching($0.port) }) { Image(systemName: "eye.fill").font(.caption2).foregroundStyle(.blue) }
                 }
                 Spacer()
-                Text("PID \(String(group.id))").font(.caption2).foregroundStyle(.secondary)
+                Text(group.pids.count == 1 ? "PID \(group.pids[0])" : "\(group.pids.count) PIDs").font(.caption2).foregroundStyle(.secondary)
                 if !(isHovered || showConfirm) {
                     Text("\(group.ports.count)").font(.caption2).foregroundStyle(.secondary).padding(.horizontal, 5).background(.tertiary.opacity(0.5)).clipShape(Capsule())
                 } else if !showConfirm {
```

---

### Incident Patch 5: `3066aee8` (2026-03-09)
**Commit Message**: fix: decode all lsof hex escape sequences for non-ASCII process names (#95)

Previously only \x20 (space) and \x2f (slash) were decoded. Now all
\xHH sequences are collected and decoded as UTF-8, correctly rendering
multi-byte characters like Chinese (企业微信).

Fixes #94, fixes #86

Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +48/-6)
```diff
@@ -194,12 +194,10 @@ actor PortScanner: PortScannerProtocol {
             let components = line.split(separator: " ", omittingEmptySubsequences: true)
             guard components.count >= 9 else { continue }
 
-            // Extract process name and handle escaped characters
-            // lsof escapes special characters: "Code Helper" → "Code\x20Helper"
-            var processName = String(components[0])
-            processName = processName
-                .replacingOccurrences(of: "\\x20", with: " ")  // Space
-                .replacingOccurrences(of: "\\x2f", with: "/")  // Slash
+            // Extract process name and decode all hex escape sequences from lsof
+            // lsof escapes special/non-ASCII characters as \xHH sequences
+            // e.g., "Code\x20Helper", "\xe4\xbc\x81\xe4\xb8\x9a" (企业)
+            let processName = Self.decodeLsofEscapes(String(components[0]))
 
             guard let pid = Int(components[1]) else { continue }
 
@@ -293,6 +291,50 @@ actor PortScanner: PortScannerProtocol {
         )
     }
 
+    /**
+     * Decodes lsof hex escape sequences (\xHH) into proper characters.
+     *
+     * lsof escapes non-ASCII bytes and some special characters as \xHH sequences.
+     * This method collects all escaped bytes and decodes them as UTF-8, which
+     * correctly handles multi-byte characters like Chinese (e.g., \xe4\xbc\x81 → 企).
+     */
+    nonisolated static func decodeLsofEscapes(_ input: String) -> String {
+        var result = ""
+        var pendingBytes: [UInt8] = []
+        var i = input.startIndex
+
+        while i < input.endIndex {
+            // Check for \xHH pattern
+            if input[i] == "\\" {
+                let next = input.index(after: i)
+                if next < input.endIndex, input[next] == "x" {
+                    let hexStart = input.index(after: next)
+                    let hexEnd = input.index(hexStart, offsetBy: 2, limitedBy: input.endIndex)
+                    if let hexEnd, let byte = UInt8(input[hexStart..<hexEnd], radix: 16) {
+                        pendingBytes.append(byte)
+                        i = hexEnd
+                        continue
+                    }
+                }
+            }
+
+            // Flush any pending bytes as UTF-8 before appending a literal character
+            if !pendingBytes.isEmpty {
+                result += String(decoding: pendingBytes, as: UTF8.self)
+                pendingBytes.removeAll()
+            }
+            result.append(input[i])
+            i = input.index(after: i)
+        }
+
+        // Flush remaining bytes
+        if !pendingBytes.isEmpty {
+            result += String(decoding: pendingBytes, as: UTF8.self)
+        }
+
+        return result
+    }
+
     /**
      * Kills a process by sending a termination signal.
      *
```

---

### Incident Patch 6: `b1585448` (2026-02-05)
**Commit Message**: refactor: enhance memory management and error handling in PortForwardProcessManager and PortScanner

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+ConflictResolution.swift` (modified, +28/-28)
```diff
@@ -4,45 +4,45 @@ import Darwin
 extension PortForwardProcessManager {
     /// Kills any process using the specified port.
     func killProcessOnPort(_ port: Int) async {
-        let lsof = Process()
-        lsof.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
-        lsof.arguments = ["-ti", "tcp:\(port)"]
+        // Wrap Process/Pipe lifecycle in autoreleasepool to release Obj-C bridged objects.
+        // Read pipe data BEFORE waitUntilExit to avoid deadlock if output exceeds pipe buffer.
+        let output: String = autoreleasepool {
+            let lsof = Process()
+            lsof.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
+            lsof.arguments = ["-ti", "tcp:\(port)"]
 
-        let pipe = Pipe()
-        lsof.standardOutput = pipe
-        lsof.standardError = FileHandle.nullDevice
+            let pipe = Pipe()
+            lsof.standardOutput = pipe
+            lsof.standardError = FileHandle.nullDevice
 
-        do {
-            try lsof.run()
-            lsof.waitUntilExit()
-
-            // Use autoreleasepool to prevent memory accumulation
-            var output: String = ""
-            autoreleasepool {
+            do {
+                try lsof.run()
                 let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+                lsof.waitUntilExit()
+                return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+            } catch {
+                return ""
             }
+        }
 
-            if !output.isEmpty {
-                let pids = output.split(separator: "\n")
-                for pidStr in pids {
-                    if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
-                        kill(pid, SIGTERM)
-                    }
+        // Kill logic uses Darwin.kill (pure C) and await, so stays outside the pool
+        if !output.isEmpty {
+            let pids = output.split(separator: "\n")
+            for pidStr in pids {
+                if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
+                    kill(pid, SIGTERM)
                 }
+            }
 
-                try? await Task.sleep(for: .milliseconds(300))
+            try? await Task.sleep(for: .milliseconds(300))
 
-                for pidStr in pids {
-                    if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
-                        if kill(pid, 0) == 0 {
-                            kill(pid, SIGKILL)
-                        }
+            for pidStr in pids {
+                if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
+                    if kill(pid, 0) == 0 {
+                        kill(pid, SIGKILL)
                     }
                 }
             }
-        } catch {
-            // Ignore errors
         }
     }
 }
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager.swift` (modified, +4/-0)
```diff
@@ -105,6 +105,7 @@ actor PortForwardProcessManager {
             }
         }
         processes[id] = nil
+        connectionErrors.removeValue(forKey: id)
 
         let scriptPath = "/tmp/pf-wrapper-\(id.uuidString).sh"
         try? FileManager.default.removeItem(atPath: scriptPath)
@@ -138,5 +139,8 @@ actor PortForwardProcessManager {
             for (_, task) in tasks { task.cancel() }
         }
         outputTasks.removeAll()
+        connectionErrors.removeAll()
+        logHandlers.removeAll()
+        portConflictHandlers.removeAll()
     }
 }
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +78/-78)
```diff
@@ -32,36 +32,39 @@ actor PortScanner: PortScannerProtocol {
      * @returns Array of PortInfo objects representing all listening ports
      */
     func scanPorts() async -> [PortInfo] {
-        let process = Process()
-        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
-        process.arguments = ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "+c", "0"]
-
-        let pipe = Pipe()
-        process.standardOutput = pipe
-        process.standardError = FileHandle.nullDevice
-
-        do {
-            try process.run()
-            process.waitUntilExit()
-
-            // Use autoreleasepool to immediately release Obj-C bridged Data objects
-            // Without this, FileHandle.readDataToEndOfFile() causes memory accumulation
-            var output: String = ""
-            autoreleasepool {
+        // Wrap entire Process/Pipe lifecycle in autoreleasepool to release Obj-C bridged
+        // objects (Process, Pipe, FileHandle, URL, Data) immediately after each scan.
+        // Without this, these objects accumulate across the long-lived scanning Task,
+        // causing ~35KB per scan × 47,520 scans over 66 hours = ~1.7GB leak.
+        let output: String = autoreleasepool {
+            let process = Process()
+            process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
+            process.arguments = ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "+c", "0"]
+
+            let pipe = Pipe()
+            process.standardOutput = pipe
+            process.standardError = FileHandle.nullDevice
+
+            do {
+                try process.run()
+
+                // CRITICAL: Read data BEFORE waitUntilExit to avoid deadlock.
+                // If lsof output exceeds the pipe buffer (~64KB), lsof blocks waiting
+                // to write. If we waitUntilExit first, we deadlock.
                 let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                output = String(data: data, encoding: .utf8) ?? ""
-            }
+                process.waitUntilExit()
 
-            guard !output.isEmpty else {
-                return []
+                return String(data: data, encoding: .utf8) ?? ""
+            } catch {
+                print("[PortScanner] Failed to scan ports: \(error.localizedDescription)")
+                return ""
             }
-
-            let commands = await getProcessCommands()
-            return parseLsofOutput(output, commands: commands)
-        } catch {
-            print("[PortScanner] Failed to scan ports: \(error.localizedDescription)")
-            return []
         }
+
+        guard !output.isEmpty else { return [] }
+
+        let commands = await getProcessCommands()
+        return parseLsofOutput(output, commands: commands)
     }
 
     /**
@@ -74,57 +77,52 @@ actor PortScanner: PortScannerProtocol {
      * @returns Dictionary mapping PID to full command string
      */
     private func getProcessCommands() async -> [Int: String] {
-        let process = Process()
-        process.executableURL = URL(fileURLWithPath: "/bin/ps")
-        process.arguments = ["-axo", "pid,command"]
-
-        let pipe = Pipe()
-        process.standardOutput = pipe
-        process.standardError = FileHandle.nullDevice
-
-        do {
-            try process.run()
-
-            // CRITICAL: Read data BEFORE waitUntilExit to avoid deadlock
-            // Explanation: If the pipe buffer fills up (common with large process lists),
-            // ps will block waiting to write more data. If we call waitUntilExit first,
-            // we'll wait forever for ps to finish, but ps is waiting for us to read the pipe.
-            // Reading first prevents this deadlock.
-
-            // Use autoreleasepool to immediately release Obj-C bridged Data objects
-            var output: String = ""
-            autoreleasepool {
+        // Wrap Process/Pipe lifecycle in autoreleasepool; parsing stays outside
+        let output: String = autoreleasepool {
+  
```

---

### Incident Patch 7: `3e0f7fc4` (2026-01-30)
**Commit Message**: fix(windows): add loading spinner when killing process (#77)

**File**: `platforms/windows/PortKiller/MainWindow.xaml` (modified, +46/-5)
```diff
@@ -4,6 +4,7 @@
         xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
         xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
         xmlns:tb="http://www.hardcodet.net/taskbar"
+        xmlns:helpers="clr-namespace:PortKiller.Helpers"
         mc:Ignorable="d"
         Title="PortKiller" 
         Height="700" Width="1200"
@@ -19,6 +20,7 @@
     <Window.Resources>
         <!-- Boolean to Visibility Converter -->
         <BooleanToVisibilityConverter x:Key="BoolToVisibilityConverter"/>
+        <helpers:InverseBoolToVisibilityConverter x:Key="InverseBoolToVisibilityConverter"/>
 
         <!-- Modern Card Style -->
         <Style x:Key="Card" TargetType="Border">
@@ -403,16 +405,55 @@
                                                         </TextBlock>
                                                     </StackPanel>
 
-                                                    <!-- Actions (Minimal Kill Button) -->
+                                                    <!-- Actions (Kill Button and Spinner) -->
                                                     <StackPanel Grid.Column="2" Orientation="Horizontal" VerticalAlignment="Center">
-                                                        <Button Content="✕" 
-                                                                Click="KillButton_Click" 
+                                                        <!-- Loading Spinner (visible when killing) -->
+                                                        <Border Padding="10,6"
+                                                                Visibility="{Binding IsKilling, Converter={StaticResource BoolToVisibilityConverter}}">
+                                                            <Grid Width="16" Height="16" RenderTransformOrigin="0.5,0.5">
+                                                                <Grid.RenderTransform>
+                                                                    <RotateTransform/>
+                                                                </Grid.RenderTransform>
+                                                                <Ellipse Width="14" Height="14"
+                                                                         Stroke="#e74c3c"
+                                                                         StrokeThickness="2"
+                                                                         Opacity="0.3"/>
+                                                                <Path Data="M 7,0 A 7,7 0 0 1 14,7"
+                                                                      Stroke="#e74c3c"
+                                                                      StrokeThickness="2"
+                                                                      StrokeStartLineCap="Round"
+                                                                      StrokeEndLineCap="Round"
+                                                                      Margin="1"/>
+                                                                <Grid.Style>
+                                                                    <Style TargetType="Grid">
+                                                                        <Style.Triggers>
+                                                                            <DataTrigger Binding="{Binding IsKilling}" Value="True">
+                                                                                <DataTrigger.EnterActions>
+                                                                                    <BeginStoryboard>
+                                                                                        <Storyboard RepeatBehavior="Forever">
+                                                                                            <DoubleAnimation
+                                                                                                Storyboard.TargetProperty="(Grid.R
```

---

### Incident Patch 8: `f14d98b0` (2026-01-14)
**Commit Message**: refactor: optimize memory usage with caching in AppState, PortForwardManager, TunnelManager, and MenuBarView

**File**: `platforms/macos/Sources/AppState.swift` (modified, +43/-0)
```diff
@@ -77,8 +77,51 @@ final class AppState {
         return portForwardManager.connections.first { $0.id == id }
     }
 
+    // MARK: - Cached Filtered Ports (Memory Optimization)
+
+    /// Cache for filtered ports to avoid repeated allocations
+    @ObservationIgnored private var _cachedFilteredPorts: [PortInfo] = []
+    @ObservationIgnored private var _filterCacheKey: FilterCacheKey?
+
+    /// Cache key to detect when recalculation is needed
+    private struct FilterCacheKey: Equatable {
+        let portsCount: Int
+        let portsHash: Int
+        let sidebarItem: SidebarItem
+        let filterActive: Bool
+        let filterText: String
+        let hideSystem: Bool
+        let favoritesCount: Int
+        let watchedCount: Int
+    }
+
     /// Returns filtered ports based on sidebar selection and active filters.
+    /// Uses caching to avoid repeated array allocations on each access.
     var filteredPorts: [PortInfo] {
+        let currentKey = FilterCacheKey(
+            portsCount: ports.count,
+            portsHash: ports.isEmpty ? 0 : ports[0].hashValue ^ ports.count,
+            sidebarItem: selectedSidebarItem,
+            filterActive: filter.isActive,
+            filterText: filter.searchText,
+            hideSystem: Defaults[.hideSystemProcesses],
+            favoritesCount: favorites.count,
+            watchedCount: watchedPorts.count
+        )
+
+        // Return cached value if nothing changed
+        if currentKey == _filterCacheKey {
+            return _cachedFilteredPorts
+        }
+
+        // Recompute and cache
+        _cachedFilteredPorts = computeFilteredPorts()
+        _filterCacheKey = currentKey
+        return _cachedFilteredPorts
+    }
+
+    /// Computes filtered ports (called only when cache is invalidated)
+    private func computeFilteredPorts() -> [PortInfo] {
         if case .settings = selectedSidebarItem { return [] }
 
         var result: [PortInfo]
```

**File**: `platforms/macos/Sources/Managers/PortForwardManager.swift` (modified, +9/-4)
```diff
@@ -145,19 +145,21 @@ final class PortForwardManager {
         state.portForwardTask = Task { [weak self, weak state] in
             guard let self = self, let state = state else { return }
 
-            // Set log handler with proper weak capture
+            // Set log handler with proper weak capture (including inner Task)
             let logHandler: LogHandler = { [weak state] message, type, isError in
                 guard let state = state else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak state] in
+                    guard let state = state else { return }
                     state.appendLog(message, type: type, isError: isError)
                 }
             }
             await self.processManager.setLogHandler(for: id, handler: logHandler)
 
-            // Set port conflict handler with proper weak capture
+            // Set port conflict handler with proper weak capture (including inner Task)
             let conflictHandler: PortConflictHandler = { [weak self, weak state] port in
                 guard let self = self, let state = state else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak self, weak state] in
+                    guard let self = self, let state = state else { return }
                     state.appendLog("Port \(port) in use, auto-recovering...", type: .portForward, isError: false)
 
                     await self.processManager.killProcessOnPort(port)
@@ -188,6 +190,9 @@ final class PortForwardManager {
         state.portForwardTask = nil
         state.portForwardStatus = .disconnected
 
+        // Clear logs to free memory when connection is stopped
+        state.clearLogs()
+
         Task {
             await processManager.killProcesses(for: id)
             await processManager.removeLogHandler(for: id)
```

**File**: `platforms/macos/Sources/Managers/TunnelManager.swift` (modified, +6/-4)
```diff
@@ -101,10 +101,11 @@ final class TunnelManager {
         Task { [weak self, weak tunnelState] in
             guard let self = self, let tunnelState = tunnelState else { return }
 
-            // Set URL handler
+            // Set URL handler with proper weak capture in inner Task
             let urlHandler: @Sendable (String) -> Void = { [weak self, weak tunnelState] url in
                 guard let tunnelState = tunnelState else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak self, weak tunnelState] in
+                    guard let tunnelState = tunnelState else { return }
                     tunnelState.tunnelURL = url
                     tunnelState.status = .active
                     tunnelState.startTime = Date()
@@ -117,10 +118,11 @@ final class TunnelManager {
             }
             await self.cloudflaredService.setURLHandler(for: tunnelState.id, handler: urlHandler)
 
-            // Set error handler
+            // Set error handler with proper weak capture in inner Task
             let errorHandler: @Sendable (String) -> Void = { [weak tunnelState] error in
                 guard let tunnelState = tunnelState else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak tunnelState] in
+                    guard let tunnelState = tunnelState else { return }
                     tunnelState.lastError = error
                     if tunnelState.status != .active {
                         tunnelState.status = .error
```

**File**: `platforms/macos/Sources/Models/PortForwardConnection.swift` (modified, +6/-3)
```diff
@@ -130,12 +130,15 @@ final class PortForwardConnectionState: Identifiable, Hashable {
     /// Tracks if the connection was stopped intentionally by the user (vs unexpected disconnect)
     var isIntentionallyStopped: Bool = false
 
+    /// Maximum log entries to keep per connection (memory optimization)
+    private static let maxLogEntries = 100
+
     func appendLog(_ message: String, type: PortForwardProcessType, isError: Bool = false) {
         let entry = PortForwardLogEntry(timestamp: Date(), message: message, type: type, isError: isError)
         logs.append(entry)
-        // Keep only last 500 log entries
-        if logs.count > 500 {
-            logs.removeFirst(logs.count - 500)
+        // Keep only last N log entries to prevent memory accumulation
+        if logs.count > Self.maxLogEntries {
+            logs.removeFirst(logs.count - Self.maxLogEntries)
         }
     }
 
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarView.swift` (modified, +54/-33)
```diff
@@ -19,57 +19,83 @@ struct MenuBarView: View {
     @State private var expandedProcesses: Set<Int> = []
     @Default(.useTreeView) private var useTreeView
     @Default(.hideSystemProcesses) private var hideSystemProcesses
+
+    // MARK: - Cached Data (Memory Optimization)
+    @State private var cachedFilteredPorts: [PortInfo] = []
     @State private var cachedGroups: [ProcessGroup] = []
-    @State private var groupingTrigger = 0
+    @State private var lastCacheKey: CacheKey?
+
+    /// Cache key to detect when recalculation is needed
+    private struct CacheKey: Equatable {
+        let portsCount: Int
+        let firstPortHash: Int
+        let searchText: String
+        let hideSystem: Bool
+    }
 
     private var groupedByProcess: [ProcessGroup] { cachedGroups }
 
-    /// Updates cached process groups from filtered ports
-    private func updateGroupedByProcess() {
-        let grouped = Dictionary(grouping: filteredPorts) { $0.pid }
+    /// Updates all cached data only when inputs change
+    private func updateCachedData() {
+        let currentKey = CacheKey(
+            portsCount: state.ports.count,
+            firstPortHash: state.ports.first?.hashValue ?? 0,
+            searchText: searchText,
+            hideSystem: hideSystemProcesses
+        )
+
+        // Skip if nothing changed
+        guard currentKey != lastCacheKey else { return }
+        lastCacheKey = currentKey
+
+        // Compute filtered ports once
+        var filtered: [PortInfo]
+        if searchText.isEmpty {
+            filtered = state.ports
+        } else {
+            filtered = state.ports.filter {
+                String($0.port).contains(searchText) || $0.processName.localizedCaseInsensitiveContains(searchText)
+            }
+        }
+
+        if hideSystemProcesses {
+            filtered = filtered.filter { $0.processType != .system }
+        }
+
+        cachedFilteredPorts = filtered.sorted { a, b in
+            let aFav = state.isFavorite(a.port)
+            let bFav = state.isFavorite(b.port)
+            if aFav != bFav { return aFav }
+            return a.port < b.port
+        }
+
+        // Compute groups from cached filtered ports
+        let grouped = Dictionary(grouping: cachedFilteredPorts) { $0.pid }
         cachedGroups = grouped.map { pid, ports in
             ProcessGroup(
                 id: pid,
                 processName: ports.first?.processName ?? "Unknown",
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { a, b in
-            // Check if groups have favorite or watched ports
             let aHasFavorite = a.ports.contains(where: { state.isFavorite($0.port) })
             let aHasWatched = a.ports.contains(where: { state.isWatching($0.port) })
             let bHasFavorite = b.ports.contains(where: { state.isFavorite($0.port) })
             let bHasWatched = b.ports.contains(where: { state.isWatching($0.port) })
 
-            // Priority: Favorite > Watched > Neither
             let aPriority = aHasFavorite ? 2 : (aHasWatched ? 1 : 0)
             let bPriority = bHasFavorite ? 2 : (bHasWatched ? 1 : 0)
 
             if aPriority != bPriority {
                 return aPriority > bPriority
             } else {
-                // Same priority, sort alphabetically by process name
                 return a.processName.localizedCaseInsensitiveCompare(b.processName) == .orderedAscending
             }
         }
     }
 
-    /// Filters ports based on search text and sorts by favorites
-    private var filteredPorts: [PortInfo] {
-        var filtered = searchText.isEmpty ? state.ports : state.ports.filter {
-            String($0.port).contains(searchText) || $0.processName.localizedCaseInsensitiveContains(searchText)
-        }
-
-        if hideSystemProcesses {
-            filtered = filtered.filter { $0.processType != .system }
-        }
-
-        return filtered.sorted { a, b in
-            let aFav = state.isFavorite(a
```

---

### Incident Patch 9: `29374082` (2026-01-14)
**Commit Message**: refactor: use autoreleasepool to prevent memory accumulation in process handling across multiple managers and services

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+ConflictResolution.swift` (modified, +9/-4)
```diff
@@ -16,10 +16,15 @@ extension PortForwardProcessManager {
             try lsof.run()
             lsof.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
-               !output.isEmpty {
-                let pids = output.components(separatedBy: .newlines)
+            // Use autoreleasepool to prevent memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+            }
+
+            if !output.isEmpty {
+                let pids = output.split(separator: "\n")
                 for pidStr in pids {
                     if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
                         kill(pid, SIGTERM)
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+Kubernetes.swift` (modified, +18/-10)
```diff
@@ -74,17 +74,22 @@ extension PortForwardProcessManager {
                 let outputAccumulator = DataAccumulator()
                 let errorAccumulator = DataAccumulator()
 
+                // Use autoreleasepool in handlers - background queues don't auto-drain
                 outputPipe.fileHandleForReading.readabilityHandler = { handle in
-                    let data = handle.availableData
-                    if !data.isEmpty {
-                        outputAccumulator.append(data)
+                    autoreleasepool {
+                        let data = handle.availableData
+                        if !data.isEmpty {
+                            outputAccumulator.append(data)
+                        }
                     }
                 }
 
                 errorPipe.fileHandleForReading.readabilityHandler = { handle in
-                    let data = handle.availableData
-                    if !data.isEmpty {
-                        errorAccumulator.append(data)
+                    autoreleasepool {
+                        let data = handle.availableData
+                        if !data.isEmpty {
+                            errorAccumulator.append(data)
+                        }
                     }
                 }
 
@@ -95,10 +100,13 @@ extension PortForwardProcessManager {
                     outputPipe.fileHandleForReading.readabilityHandler = nil
                     errorPipe.fileHandleForReading.readabilityHandler = nil
 
-                    let remainingOutput = outputPipe.fileHandleForReading.readDataToEndOfFile()
-                    let remainingError = errorPipe.fileHandleForReading.readDataToEndOfFile()
-                    outputAccumulator.append(remainingOutput)
-                    errorAccumulator.append(remainingError)
+                    // Use autoreleasepool for final reads
+                    autoreleasepool {
+                        let remainingOutput = outputPipe.fileHandleForReading.readDataToEndOfFile()
+                        let remainingError = errorPipe.fileHandleForReading.readDataToEndOfFile()
+                        outputAccumulator.append(remainingOutput)
+                        errorAccumulator.append(remainingError)
+                    }
 
                     let output = String(data: outputAccumulator.value, encoding: .utf8) ?? ""
                     let errorOutput = String(data: errorAccumulator.value, encoding: .utf8) ?? ""
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +17/-4)
```diff
@@ -44,8 +44,15 @@ actor PortScanner: PortScannerProtocol {
             try process.run()
             process.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            guard let output = String(data: data, encoding: .utf8) else {
+            // Use autoreleasepool to immediately release Obj-C bridged Data objects
+            // Without this, FileHandle.readDataToEndOfFile() causes memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
+
+            guard !output.isEmpty else {
                 return []
             }
 
@@ -83,10 +90,16 @@ actor PortScanner: PortScannerProtocol {
             // ps will block waiting to write more data. If we call waitUntilExit first,
             // we'll wait forever for ps to finish, but ps is waiting for us to read the pipe.
             // Reading first prevents this deadlock.
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
+
+            // Use autoreleasepool to immediately release Obj-C bridged Data objects
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
             process.waitUntilExit()
 
-            guard let output = String(data: data, encoding: .utf8) else {
+            guard !output.isEmpty else {
                 return [:]
             }
 
```

**File**: `platforms/macos/Sources/Services/CloudflaredService.swift` (modified, +17/-9)
```diff
@@ -102,17 +102,25 @@ actor CloudflaredService {
             let handle = pipe.fileHandleForReading
 
             while !Task.isCancelled {
-                let data = handle.availableData
-                if data.isEmpty { break }
-
-                if let output = String(data: data, encoding: .utf8)?
-                    .trimmingCharacters(in: .whitespacesAndNewlines),
-                   !output.isEmpty {
-                    let lines = output.components(separatedBy: .newlines)
-                    for line in lines where !line.isEmpty {
-                        await self?.parseLine(line, for: id)
+                // Use autoreleasepool to prevent memory accumulation from FileHandle reads
+                var output: String = ""
+                autoreleasepool {
+                    let data = handle.availableData
+                    if data.isEmpty {
+                        output = ""
+                    } else {
+                        output = String(data: data, encoding: .utf8)?
+                            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                     }
                 }
+
+                if output.isEmpty { break }
+
+                // Use split for zero-copy iteration
+                let lines = output.split(separator: "\n", omittingEmptySubsequences: true)
+                for line in lines {
+                    await self?.parseLine(String(line), for: id)
+                }
             }
         }
         outputTasks[id] = task
```

**File**: `platforms/macos/Sources/Services/DependencyChecker.swift` (modified, +6/-2)
```diff
@@ -143,8 +143,12 @@ actor DependencyChecker {
             try process.run()
             process.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            let output = String(data: data, encoding: .utf8) ?? ""
+            // Use autoreleasepool to prevent memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
 
             return process.terminationStatus == 0 ? (true, "Installed") : (false, output)
         } catch {
```

---

### Incident Patch 10: `1bc09442` (2026-01-14)
**Commit Message**: refactor: optimize string handling in PortScanner for zero-copy memory access

**File**: `platforms/macos/Package.swift` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@ let package = Package(
                 .enableExperimentalFeature("NonisolatedNonsendingByDefault"),
                 .enableExperimentalFeature("InlineArrayTypeSugar"),
                 // Default MainActor isolation - reduces boilerplate, prevents actor hops
-                .enableUpcomingFeature("DefaultIsolationMainActor")
+                .enableUpcomingFeature("DefaultIsolationMainActor"),
+                // Enable Span types for zero-copy memory access (Swift 6.2+)
+                .enableExperimentalFeature("LifetimeDependence"),
+                .enableExperimentalFeature("Span")
             ]
         ),
         .testTarget(
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +10/-7)
```diff
@@ -91,10 +91,12 @@ actor PortScanner: PortScannerProtocol {
             }
 
             var commands: [Int: String] = [:]
-            let lines = output.components(separatedBy: .newlines)
+            // Use split for zero-copy Substring iteration
+            let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
 
             for line in lines.dropFirst() {
-                let trimmed = line.trimmingCharacters(in: .whitespaces)
+                // Trim whitespace using Substring operations
+                let trimmed = line.drop(while: { $0.isWhitespace })
                 guard !trimmed.isEmpty else { continue }
 
                 let parts = trimmed.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
@@ -135,7 +137,8 @@ actor PortScanner: PortScannerProtocol {
     nonisolated private func parseLsofOutput(_ output: String, commands: [Int: String]) -> [PortInfo] {
         var ports: [PortInfo] = []
         var seen: Set<String> = []
-        let lines = output.components(separatedBy: .newlines)
+        // Use split for zero-copy Substring iteration (no allocation per line)
+        let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
 
         // Skip header line and process each data line
         for line in lines.dropFirst() {
@@ -156,7 +159,7 @@ actor PortScanner: PortScannerProtocol {
 
             guard let pid = Int(components[1]) else { continue }
 
-            // User name
+            // User name - use Substring directly where possible
             let user = String(components[2])
 
             // File descriptor
@@ -166,9 +169,9 @@ actor PortScanner: PortScannerProtocol {
             // It's usually the second-to-last column, before "(LISTEN)"
             // Format: "127.0.0.1:3000", "*:8080", or "[::1]:3000"
             // We search backwards to find a component with ":" that isn't a device ID
-            var addressPart = ""
+            var addressPart: Substring = ""
             for i in stride(from: components.count - 1, through: 8, by: -1) {
-                let comp = String(components[i])
+                let comp = components[i]
                 // Skip device IDs (0x...) and sizes (0t...)
                 if comp.contains(":") && !comp.hasPrefix("0x") && !comp.hasPrefix("0t") {
                     addressPart = comp
@@ -181,7 +184,7 @@ actor PortScanner: PortScannerProtocol {
             // Get full command from ps output
             let command = commands[pid] ?? processName
 
-            guard let portInfo = parseAddress(addressPart, processName: processName, pid: pid, user: user, command: command, fd: fd) else {
+            guard let portInfo = parseAddress(String(addressPart), processName: processName, pid: pid, user: user, command: command, fd: fd) else {
                 continue
             }
 
```

#### Recent Merged Pull Requests:
- **PR #112** (closed): feat(linux): native tray app, Rust core and AppImage releases (@productdevbook)
- **PR #111** (2026-07-24): feat(linux): native tray application and Linux process scanner (@raine1120)
- **PR #110** (closed): feat(linux): cross-platform support and modular tray application (@raine1120)
- **PR #109** (2026-06-21): fix: Use latest homebrew syntax for macos "depends on" (@builtbyleo)
- **PR #108** (2026-06-13): feat: support named Cloudflare tunnels (@OhThatMatt)
- **PR #106** (2026-03-09): feat: add request log monitoring for Cloudflare tunnels (@productdevbook)
- **PR #105** (2026-03-09): feat: add auto-kill rules for idle ports (@productdevbook)
- **PR #104** (2026-03-09): feat: add onboarding wizard for first-time users (@productdevbook)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
