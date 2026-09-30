# Forensic Learning Record (Deep Inspection): komi-store/komi-store

> **Canonical Artifact**: `07_PROJECT_LEARNING/komi-store-komi-store-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/komi-store/komi-store](https://github.com/komi-store/komi-store))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:09.573Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `komi-store/komi-store`
- **Description**: 🩵 A free, open-source app store for developers' releases on GitHub, Codeberg & Forgejo — browse, discover, and install apps with one click. Formerly GitHub Store.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 18905 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packaging/flatpak/generate-all-sources.py`
```
#!/usr/bin/env python3
"""
Generate comprehensive flatpak-sources.json by scanning Gradle cache.

FAST approach:
1. Scan ~/.gradle/caches/modules-2/files-2.1/ for all cached artifacts
2. Compute SHA512 from local files (no network needed)
3. Determine Maven repo URL based on group name heuristics
4. For POMs not in local cache, download from repos (tries multiple)
5. Skip files with non-standard names (AAR/klib with internal cache names)
6. Output flatpak-sources.json

Files that Gradle stores under internal names (e.g., "animation.aar" instead of
"animation-android-1.10.0.aar") are SKIPPED for non-JAR types. For JARs with
non-standard cache names, the standard-named version is downloaded from Maven —
KMP desktop platform JARs (landscapist-*-desktop, components-*-desktop, etc.)
are stored with short/internal names by Gradle but required by the Flatpak build.
"""

import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import ssl
from pathlib import Path
from collections import defaultdict

GRADLE_CACHE = Path(os.path.expanduser("~")) / ".gradle" / "caches" / "modules-2" / "files-2.1"
OUTPUT_DIR = Path(__file__).parent
SSL_CTX = ssl.create_default_context()

# All repos
ALL_REPOS = [
    "https://repo1.maven.org/maven2",
    "https://dl.google.com/dl/android/maven2",
    "https://jitpack.io",
    "https://plugins.gradle.org/m2",
]

# Generation-only; disable-android-for-flatpak.sh strips this plugin, so the
# Flatpak build never resolves it. Pinning it only adds a flaky source.
EXCLUDED_GROUPS = {"io.github.jwharm.flatpak-gradle-generator"}


def get_repos_for_group(group):
    g = group.lower()
    if g == "com.android" or any(g.startswith(p) for p in ["androidx.", "com.android.",
            "com.google.android.", "com.google.firebase", "com.google.gms", "com.google.testing."]):
        return ["https://dl.google.com/dl/android/maven2", "https://repo1.maven.org/maven2"]
    # jitpack only hosts com.github.topjohnwu (see settings.gradle.kts); every other
    # com.github.* coordinate (clikt, landscapist, …) publishes to Maven Central.
    if g == "com.github.topjohnwu" or g.startswith("com.github.topjohnwu."):
        return ["https://jitpack.io", "https://repo1.maven.org/maven2"]
    if g.startswith("org.gradle.") or g.startswith("gradle.plugin.") or g.startswith("org.jlleitschuh."):
        return ["https://plugins.gradle.org/m2", "https://repo1.maven.org/maven2"]
    # org.jetbrains.compose resolves from Maven Central here; compose/dev is excluded
    # because Space serves byte-different POMs for the same coordinate -> sha512 mismatch.
    return ["https://repo1.maven.org/maven2", "https://dl.google.com/dl/android/maven2",
            "https://plugins.gradle.org/m2"]


def sha512_file(filepath):
    h = hashlib.sha512()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def download_and_hash(url):
    """Download file, return SHA512 or None."""
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "flatpak-gen/1.0")
        with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
            if resp.status == 200:
                data = resp.read()
                if len(data) < 500 and b'<html' in data[:100].lower():
                    return None
                return hashlib.sha512(data).hexdigest()
    except:
        pass
    return None


def is_standard_filename(artifact, version, filename):
    """Check if filename follows Maven naming convention (artifact-version.ext)."""
    base = f"{artifact}-{version}"
    # Standard: artifact-version.ext or artifact-version-classifier.ext
    if filename.startswith(base):
        return True
    return False


def scan_gradle_cache():
    artifacts = defaultdict(dict)
    if not GRADLE_CACHE.exists():
        print(f"ERROR: Gradle cache not found at {GRADLE_CACHE}", file=sys.stderr)
        sys.exit(1)
    for group_dir in GRADLE_CACHE.iterdir():
        if not group_dir.is_dir(): continue
        for artifact_dir in group_dir.iterdir():
            if not artifact_dir.is_dir(): continue
            for version_dir in artifact_dir.iterdir():
                if not version_dir.is_dir(): continue
                for hash_dir in version_dir.iterdir():
                    if not hash_dir.is_dir(): continue
                    for f in hash_dir.iterdir():
                        if f.is_file():
                            artifacts[(group_dir.name, artifact_dir.name, version_dir.name)][f.name] = str(f)
    return artifacts


def main():
    print("=" * 60)
    print("Flatpak Sources Generator (fast, skip non-standard names)")
    print("=" * 60)

    print("\nScanning Gradle cache...")
    artifacts = scan_gradle_cache()
    print(f"Found {len(artifacts)} unique artifacts")

    all_entries = []
    seen = set()
    stats = {"local": 0, "downloaded": 0, "skipped": 0, "failed_pom": 0}
    total = len(artifacts)

    for idx, ((group, artifact, version), files) in enumerate(sorted(artifacts.items())):
        if (idx + 1) % 200 == 0:
            print(f"  [{idx+1}/{total}] {stats}")

        if group in EXCLUDED_GROUPS:
            continue

        group_path = group.replace(".", "/")
        base_name = f"{artifact}-{version}"
        repos = get_repos_for_group(group)

        needed = set()
        has_jar_or_aar = False

        for fname in files:
            if fname.endswith("-sources.jar") or fname.endswith("-javadoc.jar"):
                continue
            if not fname.endswith((".jar", ".pom", ".module", ".klib", ".aar")):
                continue
            # Non-standard Gradle cache name — for JARs, add the standard-named
            # version so it gets downloaded from Maven (KMP desktop platform JARs
            # like landscapist-*-desktop are stored with internal short names but
            # the offline build needs them under their Maven coordinates).
            if not is_standard_filename(artifact, version, fname):
                if fname.endswith(".jar"):
                    standard_jar = f"{base_name}.jar"
                    needed.add(standard_jar)
                    has_jar_or_aar = True
                stats["skipped"] += 1
                continue
            needed.add(fname)
            if fname.endswith((".jar", ".aar")):
                has_jar_or_aar = True

        # Ensure POM if we have JAR/AAR
        pom_name = f"{base_name}.pom"
        if has_jar_or_aar and pom_name not in needed:
            needed.add(pom_name)

        for fname in sorted(needed):
            key = f"{group_path}/{artifact}/{version}/{fname}"
            if key in seen: continue
            seen.add(key)

            local_path = files.get(fname)
            if local_path and os.path.exists(local_path):
                sha = sha512_file(local_path)
                url = f"{repos[0]}/{group_path}/{artifact}/{version}/{fname}"
                all_entries.append({
                    "type": "file", "url": url, "sha512": sha,
                    "dest": f"offline-repository/{group_path}/{artifact}/{version}",
                    "dest-filename": fname
                })
                stats["local"] += 1
            else:
                # Download (missing POMs mostly)
                found = False
                for repo in repos:
                    url = f"{repo}/{group_path}/{artifact}/{version}/{fname}"
                    sha = download_and_hash(url)
                    if sha:
                        all_entries.append({
                            "type": "file", "url": url, "sha512": sha,
                            "dest": f"offline-repository/{group_path}/{artifact}/{version}",
                            "dest-filename": fname
                        })
                        stats["downloaded"] += 1
                        found = True
                        break
                if not found:
      
```

### Core Architecture Module: `packaging/flatpak/verify-sources.py`
```
#!/usr/bin/env python3
"""
Verify flatpak-sources.json: every pinned URL must serve bytes whose sha512
matches the recorded value. Catches URL/hash mismatches (e.g. a Maven Central
artifact pinned with a compose/dev URL) at generation time instead of 40 minutes
into a flatpak-builder run.

Usage: verify-sources.py [flatpak-sources.json]
Exit 0 = all good; exit 1 = at least one mismatch or download failure.
"""

import hashlib
import json
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SSL_CTX = ssl.create_default_context()


def check(entry):
    url = entry.get("url")
    want = entry.get("sha512")
    if not url or not want:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "flatpak-verify/1.0"})
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            data = resp.read()
    except Exception as e:
        return (url, f"download failed: {e}")
    got = hashlib.sha512(data).hexdigest()
    if got != want:
        return (url, f"sha512 mismatch (pinned {want[:16]}…, server {got[:16]}…)")
    return None


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "flatpak-sources.json"
    with open(path) as f:
        entries = json.load(f)

    files = [e for e in entries if e.get("type") == "file" and e.get("url") and e.get("sha512")]
    total = len(files)
    print(f"Verifying {total} pinned sources from {path}...")

    problems = []
    with ThreadPoolExecutor(max_workers=16) as ex:
        for i, result in enumerate(ex.map(check, files), 1):
            if i % 200 == 0:
                print(f"  [{i}/{total}] {len(problems)} problem(s) so far")
            if result:
                problems.append(result)

    if problems:
        print(f"\n{len(problems)} PROBLEM(S):", file=sys.stderr)
        for url, msg in problems:
            print(f"  {msg}\n    {url}", file=sys.stderr)
        sys.exit(1)

    print(f"OK — all {total} sources verified.")


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #961** (2026-09-10): **KomiStore cannot connect when Android Always-on VPN and "Block connections without VPN" are enabled.**
  *Symptoms*: Steps to reproduce     Enable Rethink local VPN.     Enable:         Always-on VPN         Block connections without VPN     Open KomiStore.   Expected KomiStore works through the active VPN connection.  Actual KomiStore cannot connect. Disabling Rethink VPN immediately fixes the issue.  Notes     KomiStore is allowed in Rethink.     No firewall/DNS blocks are shown.     DNS works.     IPv6 disabled.     Other apps work with the same VPN setup.  Device Moto G15 Android 15 Komi Store version 1.9.2     

- **Issue #950** (2026-09-04): **Shizuku's alternative has a problem**
  *Symptoms*: Unable to install apps while the 3rd-party app Stellar WADB is activated (Shizuku alternative)  1. Activate the Stellar app 2. Download and install apps 3. Pops up default installer options  1.9.2 (21) • Android 13  <img width="720" height="1284" alt="Image" src="https://github.com/user-attachments/assets/d8f5a6d8-c132-4645-ad1b-95dcc3a1eaf4" />
  **Post-Mortem & Fix Analysis**:
  > Kindly use the recommended installers specified. 

- **Issue #945** (2026-08-28): **"Couldn\'t load the feed  Permission denied: getsockopt"**
  *Symptoms*: ## Komi Store cannot load the feed when on "Explore" page  Komi Store is unable to load the feed when opened in its default page, "Explore"  ## How to reproduce  1. Install 1.9.2 on Windows 11 2. Try to get feed  ## Setup  Windows 11.  ## Screenshot of the issue  <img width="2520" height="918" alt="Image" src="https://github.com/user-attachments/assets/dc300f46-ab00-424b-ab05-5d55ec7bdbb9" />
  **Post-Mortem & Fix Analysis**:
  > Hi! I’d like to work on this issue. I’m going to try reproducing the `Permission denied: getsockopt` error on Windows 11 and investigate the feed/networking code to find the root cause.  If no one else is currently working on it, I’d be happy to take this issue. 
  > I think the issue is basically a repo availability issue. At the time when this issue happened, feed was probably unavailable for some reason.  Repository feed is loaded in `loadPage` function in `FeedViewModel.kt`. Error is triggered by `feedRepos.isEmpty()` check.   As of 08.28.2026, it is working as usual.

- **Issue #927** (2026-08-29): **What are these overlays and how can I remove them?**
  *Symptoms*: I've tried uninstalling and other stuff but it just keeps popping  I cannot do anything   <img width="1264" height="2780" alt="Image" src="https://github.com/user-attachments/assets/e6eadedc-be35-4eeb-bf49-ae0897440814" />
  **Post-Mortem & Fix Analysis**:
  > Just came here to report this, but you beat me to it.😅 same exact issue and they blоck the button with no way to close them. Driving me insane 

- **Issue #910** (2026-08-10): **[BUG] Sorting search results renders no results**
  *Symptoms*: > Already in the app? **Profile → Send feedback** auto-fills app version, platform, and installer. Fastest path.  ↑ this "provide feedback" option is missing.  ## What's wrong When selecting any other sort method (than the default "Best Match" the app fails to load any results.  ## How to reproduce  1. Search something popular, ie 'Shizuku' 2. Filter for Android 4. Try to sort results by anything other than "Best Match"  ## Your setup  1.9.2 · Android 16 / OneUI 8 / Galaxy S24 Ultra  <img width="720" height="928" alt="Image" src="https://github.com/user-attachments/assets/bc7a2708-66f1-41a9-af0f-303b11b72c6b" /> <img width="720" height="909" alt="Image" src="https://github.com/user-attachments/assets/69a36f63-97dc-4c10-933d-315074c822c6" /> 
  **Post-Mortem & Fix Analysis**:
  > <img width="1080" height="2193" alt="Image" src="https://github.com/user-attachments/assets/2607d270-5d63-4d2b-987d-c9a9dfa13e87" />

- **Issue #895** (2026-07-28): **Update Download Badges for "Komi Store"**
  *Symptoms*: The [download badge](https://github.com/kurikomi-labs/komi-store/blob/main/media-resources/ghs_download_badge.png) should be updated to reflect the new name.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion 

- **Issue #856** (2026-09-14): **download gets restarted in background **
  *Symptoms*: app is unrestricted for background usage but long term downloads like 100mb+ file when put in background aometimes get stuck let's say at 80% when u open app it restarts downloading from scratch.  i will try to video record it.  on latest version

- **Issue #846** (2026-09-14): **scoop 中的app's name is wrong**
  *Symptoms*: # 兄弟，你开发的软件叫什么名字你不知道吗， 你的manifest 叫komi-store, 你的文档中写的是 github-store, 还有你的scoop bucket 为啥叫scoop-bucket ， 这不知道的还以为是scoop 官方仓库   ``` xiaoR@machrevo16 [pwsh] ~ ᕕᕗ scoop-search github-store WARN  No matches found.  xiaoR@machrevo16 [pwsh] ~ ᕕᕗ scoop-search komi-store 'scoop-bucket' bucket:     komi-store (1.9.2)  'third' bucket:     komi-store (1.9.2)  
  **Post-Mortem & Fix Analysis**:
  > Thanks

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

### Incident Patch 1: `6a4174db` (2026-08-31)
**Commit Message**: fix(ui): align asset card spacing and animate picker height changes (#938)

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/components/ReleaseAssetsPicker.kt` (modified, +6/-2)
```diff
@@ -1,5 +1,7 @@
 package zed.rainxch.details.presentation.components
 
+import androidx.compose.animation.animateContentSize
+import androidx.compose.animation.core.tween
 import zed.rainxch.core.presentation.utils.formatFileSize
 import androidx.compose.foundation.background
 import androidx.compose.foundation.border
@@ -265,8 +267,10 @@ private fun ReleaseAssetsItemsPicker(
                 assetsList.map { it.id }.toSet()
             }
             LazyColumn(
-                modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp),
-                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
+                modifier = Modifier.fillMaxWidth()
+                    .animateContentSize(animationSpec = tween(durationMillis = 250))
+                    .heightIn(max = 420.dp),
+                contentPadding = PaddingValues(vertical = 8.dp),
                 verticalArrangement = Arrangement.spacedBy(12.dp),
             ) {
 
```

---

### Incident Patch 2: `e8f73e06` (2026-06-26)
**Commit Message**: Fix Homebrew tap workflow for komi-store rename (#827)

* Fix Homebrew tap workflow for komi-store rename

* Update in-repo Homebrew seed copy for komi-store rename

**File**: `.github/workflows/homebrew-tap-publish.yml` (modified, +6/-6)
```diff
@@ -43,8 +43,8 @@ jobs:
         run: |
           set -euo pipefail
           BASE="https://github.com/${REPO}/releases/download/${TAG}"
-          curl -fSL -o arm64.dmg "${BASE}/GitHub-Store-${VERSION}-arm64.dmg"
-          curl -fSL -o x64.dmg   "${BASE}/GitHub-Store-${VERSION}-x64.dmg"
+          curl -fSL -o arm64.dmg "${BASE}/Komi-Store-${VERSION}-arm64.dmg"
+          curl -fSL -o x64.dmg   "${BASE}/Komi-Store-${VERSION}-x64.dmg"
           ls -la *.dmg
 
       - name: Compute SHA256
@@ -61,7 +61,7 @@ jobs:
       - name: Checkout tap repo
         uses: actions/checkout@v4
         with:
-          repository: OpenHub-Store/homebrew-tap
+          repository: kurikomi-labs/homebrew-komi-store
           token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
           path: homebrew-tap
 
@@ -74,7 +74,7 @@ jobs:
         run: |
           python3 - <<'EOF'
           import os, re, sys
-          path = "Casks/github-store.rb"
+          path = "Casks/komi-store.rb"
           version = os.environ["NEW_VERSION"]
           sha_arm = os.environ["NEW_SHA_ARM"]
           sha_intel = os.environ["NEW_SHA_INTEL"]
@@ -110,10 +110,10 @@ jobs:
           set -euo pipefail
           git config user.name "github-actions[bot]"
           git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
-          git add Casks/github-store.rb
+          git add Casks/komi-store.rb
           if git diff --cached --quiet; then
             echo "Cask already up to date"
             exit 0
           fi
-          git commit -m "Bump github-store to ${VERSION}"
+          git commit -m "Bump komi-store to ${VERSION}"
           git push
```

**File**: `dist/homebrew/Casks/komi-store.rb` (renamed, +12/-12)
```diff
@@ -1,12 +1,12 @@
-cask "github-store" do
+cask "komi-store" do
   arch arm: "arm64", intel: "x64"
 
-  version "1.8.2"
-  sha256 arm:   "ad0c532873c0400736b7ea706a33604f7ef93b2479a4a6f32673a789b18ccd8e",
-         intel: "faf002283c301db2a97f7a32193778f678d42ed71551a623711cd170d6fde16a"
+  version "1.9.2"
+  sha256 arm:   "df371a7c4c821125810dacaab04a7fb0bcd40162bc996b798caf21c586fd0f0f",
+         intel: "2d95aa11a273528978cb2dad427e592d0705bb8e67c099a91a3216677abc4315"
 
-  url "https://github.com/kurikomi-labs/komi-store/releases/download/v#{version}/GitHub-Store-#{version}-#{arch}.dmg"
-  name "GitHub Store"
+  url "https://github.com/kurikomi-labs/komi-store/releases/download/v#{version}/Komi-Store-#{version}-#{arch}.dmg"
+  name "Komi Store"
   desc "Cross-platform app store for GitHub releases"
   homepage "https://github.com/kurikomi-labs/komi-store"
 
@@ -18,26 +18,26 @@
   auto_updates false
   depends_on macos: :big_sur
 
-  app "GitHub-Store.app"
+  app "Komi-Store.app"
 
   uninstall quit: "zed.rainxch.githubstore"
 
   zap trash: [
-    "~/Library/Application Support/GitHub-Store",
-    "~/Library/Caches/GitHub-Store",
-    "~/Library/Logs/GitHub-Store",
+    "~/Library/Application Support/Komi-Store",
+    "~/Library/Caches/Komi-Store",
+    "~/Library/Logs/Komi-Store",
     "~/Library/Preferences/zed.rainxch.githubstore.plist",
     "~/Library/Saved Application State/zed.rainxch.githubstore.savedState",
   ]
 
   caveats <<~EOS
-    GitHub Store is not yet signed with an Apple Developer ID.
+    Komi Store is not yet signed with an Apple Developer ID.
     macOS Gatekeeper will block it from launching with a "damaged" or
     "cannot be opened" error.
 
     To allow the app to launch, run:
 
-      xattr -dr com.apple.quarantine "#{appdir}/GitHub-Store.app"
+      xattr -dr com.apple.quarantine "#{appdir}/Komi-Store.app"
 
     This step is required after each install or upgrade until the app is
     signed and notarized.
```

**File**: `dist/homebrew/README.md` (modified, +6/-6)
```diff
@@ -1,16 +1,16 @@
 # Homebrew Cask (reference copy)
 
 The Cask in this directory is a **reference/seed copy**. The live, user-facing
-Cask lives in [`OpenHub-Store/homebrew-tap`](https://github.com/OpenHub-Store/homebrew-tap)
+Cask lives in [`kurikomi-labs/homebrew-komi-store`](https://github.com/kurikomi-labs/homebrew-komi-store)
 and is auto-updated on each release by
 [`.github/workflows/homebrew-tap-publish.yml`](../../.github/workflows/homebrew-tap-publish.yml).
 
 Users install with:
 
 ```bash
-brew tap OpenHub-Store/tap
-brew install --cask github-store
-xattr -dr com.apple.quarantine /Applications/GitHub-Store.app
+brew tap kurikomi-labs/komi-store
+brew install --cask komi-store
+xattr -dr com.apple.quarantine /Applications/Komi-Store.app
 ```
 
 The final `xattr` is required until the app is signed and notarized.
@@ -19,9 +19,9 @@ The final `xattr` is required until the app is signed and notarized.
 
 No manual step needed. On each `release: types: [released]` event, the workflow:
 
-1. Downloads `GitHub-Store-<version>-arm64.dmg` + `GitHub-Store-<version>-x64.dmg`.
+1. Downloads `Komi-Store-<version>-arm64.dmg` + `Komi-Store-<version>-x64.dmg`.
 2. Computes SHA256 of both.
-3. Patches `version` + `sha256` in the tap repo's `Casks/github-store.rb`.
+3. Patches `version` + `sha256` in the tap repo's `Casks/komi-store.rb`.
 4. Commits + pushes to the tap repo.
 
 Requires the `HOMEBREW_TAP_TOKEN` repo secret — a fine-grained PAT with
```

---

### Incident Patch 3: `2377c2ce` (2026-06-26)
**Commit Message**: fix: lowercase linux desktop launcher exec to match binary (#804) (#817)



---

### Incident Patch 4: `b4809d06` (2026-06-26)
**Commit Message**: fix: lowercase linux desktop launcher exec (#804) (#816)

**File**: `.github/workflows/build-desktop-platforms.yml` (modified, +17/-15)
```diff
@@ -379,7 +379,7 @@ jobs:
           [Desktop Entry]
           Type=Application
           Name=Komi Store
-          Exec=Komi-Store
+          Exec=komi-store
           Icon=github-store
           Categories=Development;
           Comment=Cross-platform app store for GitHub releases
@@ -539,7 +539,7 @@ jobs:
           set -euo pipefail
 
           VERSION=$(grep 'projectVersionName' gradle/libs.versions.toml | head -1 | sed 's/.*= *"\(.*\)"/\1/')
-          PKG_NAME="github-store"
+          PKG_NAME="komi-store"
           PKG_DIR="pkg-root"
 
           # Find the app directory produced by packageAppImage
@@ -564,37 +564,37 @@ jobs:
           fi
 
           # Build the package tree
-          mkdir -p "$PKG_DIR/opt/github-store"
-          cp -a "$APP_ROOT"/. "$PKG_DIR/opt/github-store/"
+          mkdir -p "$PKG_DIR/opt/komi-store"
+          cp -a "$APP_ROOT"/. "$PKG_DIR/opt/komi-store/"
 
           # Install the JVM-direct launcher that bypasses the jpackage native
           # launcher (crashes in glibc setenv() on glibc >= 2.42, see GH#563).
-          cp packaging/linux/github-store-launcher.sh "$PKG_DIR/opt/github-store/bin/github-store-launcher.sh"
-          chmod +x "$PKG_DIR/opt/github-store/bin/github-store-launcher.sh"
+          cp packaging/linux/github-store-launcher.sh "$PKG_DIR/opt/komi-store/bin/github-store-launcher.sh"
+          chmod +x "$PKG_DIR/opt/komi-store/bin/github-store-launcher.sh"
 
           # Launcher symlink
           mkdir -p "$PKG_DIR/usr/bin"
-          ln -s "/opt/github-store/bin/github-store-launcher.sh" "$PKG_DIR/usr/bin/github-store"
+          ln -s "/opt/komi-store/bin/github-store-launcher.sh" "$PKG_DIR/usr/bin/komi-store"
 
           # Desktop entry
           mkdir -p "$PKG_DIR/usr/share/applications"
-          cat > "$PKG_DIR/usr/share/applications/github-store.desktop" << 'EOF'
+          cat > "$PKG_DIR/usr/share/applications/komi-store.desktop" << 'EOF'
           [Desktop Entry]
           Type=Application
           Name=Komi Store
-          Exec=/opt/github-store/bin/github-store-launcher.sh
-          Icon=github-store
+          Exec=komi-store
+          Icon=komi-store
           Categories=Development;
           Comment=Cross-platform app store for GitHub releases
-          StartupWMClass=github-store
+          StartupWMClass=komi-store
           EOF
-          sed -i 's/^          //' "$PKG_DIR/usr/share/applications/github-store.desktop"
+          sed -i 's/^          //' "$PKG_DIR/usr/share/applications/komi-store.desktop"
 
           # Icon
-          if [ -f "$PKG_DIR/opt/github-store/lib/Komi-Store.png" ]; then
+          if [ -f "$PKG_DIR/opt/komi-store/lib/Komi-Store.png" ]; then
             mkdir -p "$PKG_DIR/usr/share/icons/hicolor/256x256/apps"
-            cp "$PKG_DIR/opt/github-store/lib/Komi-Store.png" \
-               "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/github-store.png"
+            cp "$PKG_DIR/opt/komi-store/lib/Komi-Store.png" \
+               "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/komi-store.png"
           fi
 
           # .PKGINFO (pacman metadata — must be a flat file at archive root)
@@ -609,6 +609,8 @@ jobs:
           arch = x86_64
           license = GPL-3.0
           size = ${INSTALLED_SIZE}
+          replaces = github-store
+          conflicts = github-store
           depend = java-runtime>=21
           depend = hicolor-icon-theme
           EOF
```

**File**: `core/presentation/src/commonMain/composeResources/files/whatsnew/21.json` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@
       "type": "FIXED",
       "bullets": [
         "App downloads now auto-pick the build that matches your device's CPU (like aarch64) instead of defaulting to a larger universal APK.",
-        "Fixed GitHub sign-in on Windows — the desktop app now reliably opens and finishes login after you authorize in your browser."
+        "Fixed GitHub sign-in on Windows — the desktop app now reliably opens and finishes login after you authorize in your browser.",
+        "Fixed the app not launching from the menu on some Linux setups (like Arch/KDE) caused by a mismatched desktop-shortcut name."
       ]
     }
   ]
```

---

### Incident Patch 5: `5e4c858d` (2026-06-26)
**Commit Message**: Fix Windows desktop GitHub login (#815)

* fix: accept trailing-slash auth deep-link uri

* fix: harden windows uri-scheme registration

* chore: note windows login fix in what's-new

* fix: tighten windows registration validation and import check

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/deeplink/DeepLinkParser.kt` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ object DeepLinkParser {
                 DeepLinkDestination.Apps
             }
 
-            uri.startsWith("githubstore://auth?") -> {
+            uri.startsWith("githubstore://auth?") || uri.startsWith("githubstore://auth/?") -> {
                 parseAuthCallback(uri)
             }
 
```

**File**: `composeApp/src/jvmMain/kotlin/zed/rainxch/githubstore/DesktopApp.kt` (modified, +6/-6)
```diff
@@ -76,6 +76,12 @@ fun main(args: Array<String>) {
 
     selectLinuxRenderBackendIfRequested()
 
+    val deepLinkArg = args.firstOrNull()
+
+    if (deepLinkArg != null && DesktopDeepLink.tryForwardToRunningInstance(deepLinkArg)) {
+        exitProcess(0)
+    }
+
     Security.setProperty("networkaddress.cache.ttl", "30")
     Security.setProperty("networkaddress.cache.negative.ttl", "5")
 
@@ -98,12 +104,6 @@ fun main(args: Array<String>) {
 
     bootstrapProxy()
 
-    val deepLinkArg = args.firstOrNull()
-
-    if (deepLinkArg != null && DesktopDeepLink.tryForwardToRunningInstance(deepLinkArg)) {
-        exitProcess(0)
-    }
-
     DesktopDeepLink.registerUriSchemeIfNeeded()
 
     application {
```

**File**: `composeApp/src/jvmMain/kotlin/zed/rainxch/githubstore/DesktopDeepLink.kt` (modified, +72/-46)
```diff
@@ -22,51 +22,67 @@ object DesktopDeepLink {
     }
 
     private fun registerWindows() {
-        val exePath = resolveExePath() ?: return
+        val exePath =
+            resolveExePath() ?: run {
+                println("DeepLink: skipped Windows scheme registration (exe path unresolved)")
+                return
+            }
 
-        val commandKey = "HKCU\\SOFTWARE\\Classes\\$SCHEME\\shell\\open\\command"
-        val existing = runCommand("reg", "query", commandKey, "/ve")
-        if (existing != null && existing.contains(exePath, ignoreCase = true)) return
-
-        runCommand(
-            "reg",
-            "add",
-            "HKCU\\SOFTWARE\\Classes\\$SCHEME",
-            "/ve",
-            "/d",
-            "URL:Komi Store Protocol",
-            "/f",
-        )
-        runCommand(
-            "reg",
-            "add",
-            "HKCU\\SOFTWARE\\Classes\\$SCHEME",
-            "/v",
-            "URL Protocol",
-            "/d",
-            "",
-            "/f",
-        )
-        runCommand(
-            "reg",
-            "add",
-            "HKCU\\SOFTWARE\\Classes\\$SCHEME\\DefaultIcon",
-            "/ve",
-            "/d",
-            "\"$exePath\",1",
-            "/f",
-        )
-        runCommand(
-            "reg",
-            "add",
-            commandKey,
-            "/ve",
-            "/d",
-            "\"$exePath\" \"%1\"",
-            "/f",
-        )
+        val iconValue = "\"$exePath\",1"
+        val commandValue = "\"$exePath\" \"%1\""
+
+        if (windowsRegistrationIsValid(commandValue)) return
+
+        val regContent =
+            buildString {
+                append("Windows Registry Editor Version 5.00\r\n\r\n")
+                append("[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\$SCHEME]\r\n")
+                append("@=\"URL:Komi Store Protocol\"\r\n")
+                append("\"URL Protocol\"=\"\"\r\n\r\n")
+                append("[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\$SCHEME\\DefaultIcon]\r\n")
+                append("@=\"${regEscape(iconValue)}\"\r\n\r\n")
+                append("[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\$SCHEME\\shell\\open\\command]\r\n")
+                append("@=\"${regEscape(commandValue)}\"\r\n")
+            }
+
+        val regFile =
+            try {
+                File.createTempFile("komi-scheme", ".reg")
+            } catch (e: Exception) {
+                println("DeepLink: Windows scheme registration failed (temp file): ${e.message}")
+                return
+            }
+
+        try {
+            regFile.writeBytes(("\uFEFF$regContent").toByteArray(Charsets.UTF_16LE))
+            val result = runCommandResult("reg", "import", regFile.absolutePath)
+            if (result == null || result.exitCode != 0) {
+                println("DeepLink: Windows scheme registration failed (reg import): ${result?.output?.trim().orEmpty()}")
+            }
+        } catch (e: Exception) {
+            println("DeepLink: Windows scheme registration failed: ${e.message}")
+        } finally {
+            runCatching { regFile.delete() }
+        }
+    }
+
+    private fun windowsRegistrationIsValid(expectedCommandValue: String): Boolean {
+        val protocol = runCommand("reg", "query", "HKCU\\SOFTWARE\\Classes\\$SCHEME", "/v", "URL Protocol")
+        if (protocol == null || !protocol.contains("URL Protocol")) return false
+        val command =
+            runCommand("reg", "query", "HKCU\\SOFTWARE\\Classes\\$SCHEME\\shell\\open\\command", "/ve")
+                ?: return false
+        val actualCommandValue =
+            command
+                .lineSequence()
+                .firstOrNull { it.contains("REG_SZ") }
+                ?.substringAfter("REG_SZ")
+                ?.trim()
+        return actualCommandValue.equals(expectedCommandValue, ignoreCase = true)
     }
 
+    private fun regEscape(value: String): String = value.replace("\\", "\\\\").replace("\"", "\\\"")
+
     private fun registerLinux(
```

**File**: `core/presentation/src/commonMain/composeResources/files/whatsnew/21.json` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@
     {
       "type": "FIXED",
       "bullets": [
-        "App downloads now auto-pick the build that matches your device's CPU (like aarch64) instead of defaulting to a larger universal APK."
+        "App downloads now auto-pick the build that matches your device's CPU (like aarch64) instead of defaulting to a larger universal APK.",
+        "Fixed GitHub sign-in on Windows — the desktop app now reliably opens and finishes login after you authorize in your browser."
       ]
     }
   ]
```

**File**: `core/presentation/src/commonMain/composeResources/files/whatsnew/ar/21.json` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@
     {
       "type": "FIXED",
       "bullets": [
-        "تنزيلات التطبيقات تختار الآن تلقائيًا النسخة المناسبة لمعالج جهازك (مثل aarch64) بدلًا من اللجوء إلى حزمة APK عامة أكبر حجمًا."
+        "تنزيلات التطبيقات تختار الآن تلقائيًا النسخة المناسبة لمعالج جهازك (مثل aarch64) بدلًا من اللجوء إلى حزمة APK عامة أكبر حجمًا.",
+        "تم إصلاح تسجيل الدخول عبر GitHub على Windows — أصبح تطبيق سطح المكتب الآن يفتح ويُكمل تسجيل الدخول بشكل موثوق بعد المصادقة في المتصفح."
       ]
     }
   ]
```

---

### Incident Patch 6: `46272869` (2026-06-26)
**Commit Message**: Fix #808: smarter release-asset auto-selection (#814)

* fix: pick exact-ABI asset over universal build (#808)

* refactor: route installers through AssetSelector

* chore: note smarter APK selection in what's-new

* fix: harden non-Android apk filtering in picker

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/AndroidInstaller.kt` (modified, +13/-63)
```diff
@@ -10,6 +10,8 @@ import androidx.core.content.FileProvider
 import androidx.core.net.toUri
 import co.touchlab.kermit.Logger
 import zed.rainxch.core.domain.utils.AssetArchitectureMatcher
+import zed.rainxch.core.domain.utils.AssetSelector
+import zed.rainxch.core.domain.utils.isAndroidApk
 import zed.rainxch.core.domain.model.account.github.GithubAsset
 import zed.rainxch.core.domain.model.system.SystemArchitecture
 import zed.rainxch.core.domain.system.InstallOutcome
@@ -35,10 +37,9 @@ class AndroidInstaller(
     }
 
     override fun isAssetInstallable(assetName: String): Boolean {
-        val name = assetName.lowercase()
-        if (!name.endsWith(".apk")) return false
+        if (!isAndroidApk(assetName)) return false
         val systemArch = detectSystemArchitecture()
-        return isArchitectureCompatible(name, systemArch)
+        return isArchitectureCompatible(assetName.lowercase(), systemArch)
     }
 
     private fun isArchitectureCompatible(
@@ -49,69 +50,18 @@ class AndroidInstaller(
     override fun choosePrimaryAsset(assets: List<GithubAsset>): GithubAsset? {
         if (assets.isEmpty()) return null
         val systemArch = detectSystemArchitecture()
+        val androidApks = assets.filter { asset -> isAndroidApk(asset.name) }
+        if (androidApks.isEmpty()) return null
         val compatibleAssets =
-            assets.filter { asset ->
+            androidApks.filter { asset ->
                 isArchitectureCompatible(asset.name.lowercase(), systemArch)
             }
-        val assetsToConsider = compatibleAssets.ifEmpty { assets }
-        return assetsToConsider.maxByOrNull { asset ->
-            val name = asset.name.lowercase()
-            val archBoost =
-                when (systemArch) {
-                    SystemArchitecture.X86_64 -> {
-                        if (AssetArchitectureMatcher.isExactMatch(
-                                name,
-                                SystemArchitecture.X86_64,
-                            )
-                        ) {
-                            10000
-                        } else {
-                            0
-                        }
-                    }
-
-                    SystemArchitecture.AARCH64 -> {
-                        if (AssetArchitectureMatcher.isExactMatch(
-                                name,
-                                SystemArchitecture.AARCH64,
-                            )
-                        ) {
-                            10000
-                        } else {
-                            0
-                        }
-                    }
-
-                    SystemArchitecture.X86 -> {
-                        if (AssetArchitectureMatcher.isExactMatch(
-                                name,
-                                SystemArchitecture.X86,
-                            )
-                        ) {
-                            10000
-                        } else {
-                            0
-                        }
-                    }
-
-                    SystemArchitecture.ARM -> {
-                        if (AssetArchitectureMatcher.isExactMatch(
-                                name,
-                                SystemArchitecture.ARM,
-                            )
-                        ) {
-                            10000
-                        } else {
-                            0
-                        }
-                    }
-
-                    SystemArchitecture.UNKNOWN -> {
-                        0
-                    }
-                }
-            archBoost + asset.size
-        }
+        val assetsToConsider = compatibleAssets.ifEmpty { androidApks }
+        return AssetSelector.choose(
+            assets = assetsToConsider,
+            deviceArch = systemArch,
+            extensionPriority = listOf(".apk"),
+        )
     }
 
     override suspend fun isSupported(extOrMime: String): Boolean {
```

**File**: `core/data/src/jvmMain/kotlin/zed/rainxch/core/data/services/DesktopInstaller.kt` (modified, +6/-27)
```diff
@@ -6,6 +6,7 @@ import kotlinx.coroutines.withContext
 import zed.rainxch.core.data.model.LinuxPackageType
 import zed.rainxch.core.data.model.LinuxTerminal
 import zed.rainxch.core.domain.utils.AssetArchitectureMatcher
+import zed.rainxch.core.domain.utils.AssetSelector
 import zed.rainxch.core.domain.model.account.github.GithubAsset
 import zed.rainxch.core.domain.model.system.Platform
 import zed.rainxch.core.domain.model.system.SystemArchitecture
@@ -144,28 +145,11 @@ class DesktopInstaller(
 
         val assetsToConsider = compatibleAssets.ifEmpty { assets }
 
-        return assetsToConsider.maxByOrNull { asset ->
-            val name = asset.name.lowercase()
-
-            val extensionIdx = priority.indexOfFirst { name.endsWith(it) }
-            val extensionScore =
-                if (extensionIdx == -1) {
-                    -100000
-                } else {
-                    (priority.size - extensionIdx) * 10000
-                }
-
-            val archScore =
-                if (isExactArchitectureMatch(name, systemArchitecture)) {
-                    1000
-                } else {
-                    0
-                }
-
-            val sizeScore = (asset.size / 1000000).coerceAtMost(100)
-
-            extensionScore + archScore + sizeScore
-        }
+        return AssetSelector.choose(
+            assets = assetsToConsider,
+            deviceArch = systemArchitecture,
+            extensionPriority = priority,
+        )
     }
 
     private fun determineSystemArchitecture(): SystemArchitecture {
@@ -399,11 +383,6 @@ class DesktopInstaller(
         return AssetArchitectureMatcher.isCompatible(name, systemArch)
     }
 
-    private fun isExactArchitectureMatch(
-        assetName: String,
-        systemArch: SystemArchitecture,
-    ): Boolean = AssetArchitectureMatcher.isExactMatch(assetName, systemArch)
-
     override suspend fun isSupported(extOrMime: String): Boolean {
         val ext = extOrMime.lowercase().removePrefix(".")
         return when (platform) {
```

**File**: `core/domain/build.gradle.kts` (modified, +5/-0)
```diff
@@ -10,5 +10,10 @@ kotlin {
                 implementation(libs.kotlinx.coroutines.core)
             }
         }
+        commonTest {
+            dependencies {
+                implementation(kotlin("test"))
+            }
+        }
     }
 }
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/AssetArchitectureMatcher.kt` (modified, +53/-35)
```diff
@@ -3,56 +3,74 @@ package zed.rainxch.core.domain.utils
 import zed.rainxch.core.domain.model.system.SystemArchitecture
 
 object AssetArchitectureMatcher {
-    private val universalRegex =
-        Regex(
-            pattern = """(^|[^a-z0-9])(universal|noarch|all-arch|fat)([^a-z0-9]|$)""",
-        )
-    private val x86_64Regex =
-        Regex(
-            pattern = """(^|[^a-z0-9])(x86[_-]64|amd64|x64)([^a-z0-9]|$)""",
-        )
+
+    sealed interface Match {
+        data class Known(val arch: SystemArchitecture) : Match
+        data object Universal : Match
+        data object Foreign : Match
+    }
+
+    private val universalRegex = boundary("universal", "noarch", "all-arch", "fat")
+    private val x86_64Regex = boundary("x86[_-]64", "amd64", "win64", "x64")
     private val arm64Regex =
-        Regex(
-            pattern = """(^|[^a-z0-9])(aarch64|arm64|arm64-v8a|armv8a|armv8l|armv8|arm-v8|v8a)([^a-z0-9]|$)""",
-        )
-    private val x86Regex =
-        Regex(
-            pattern = """(^|[^a-z0-9])(i386|i686|x86)([^a-z0-9]|$)""",
-        )
+        boundary("aarch64", "arm64", "arm64-v8a", "armv8a", "armv8l", "armv8", "arm-v8", "v8a")
+    private val x86Regex = boundary("i386", "i586", "i686", "ia32", "win32", "x86", "386")
     private val armRegex =
-        Regex(
-            pattern = """(^|[^a-z0-9])(armeabi-v7a|armeabi|armv7a|armv7|arm-v7|v7a|arm)([^a-z0-9]|$)""",
+        boundary(
+            "armeabi-v7a", "armeabi", "armv7l", "armv7a", "armv7",
+            "armv6l", "armv6", "armhf", "armel", "arm-v7", "arm32", "v7a", "arm",
+        )
+    private val foreignRegex =
+        boundary(
+            "riscv64", "riscv", "ppc64le", "ppc64", "powerpc", "ppc",
+            "s390x", "loong64", "loongarch", "mips64", "mips", "sparc64", "sparc",
         )
 
-    fun detectArchitecture(assetName: String): SystemArchitecture? {
+    fun matchArchitecture(assetName: String): Match {
         val name = assetName.lowercase().replace('_', '-')
-        if (universalRegex.containsMatchIn(name)) return null
-        if (x86_64Regex.containsMatchIn(name)) return SystemArchitecture.X86_64
-        if (arm64Regex.containsMatchIn(name)) return SystemArchitecture.AARCH64
-        if (x86Regex.containsMatchIn(name)) return SystemArchitecture.X86
-        if (armRegex.containsMatchIn(name)) return SystemArchitecture.ARM
-        return null
+        return when {
+            universalRegex.containsMatchIn(name) -> Match.Universal
+            x86_64Regex.containsMatchIn(name) -> Match.Known(SystemArchitecture.X86_64)
+            arm64Regex.containsMatchIn(name) -> Match.Known(SystemArchitecture.AARCH64)
+            x86Regex.containsMatchIn(name) -> Match.Known(SystemArchitecture.X86)
+            armRegex.containsMatchIn(name) -> Match.Known(SystemArchitecture.ARM)
+            foreignRegex.containsMatchIn(name) -> Match.Foreign
+            else -> Match.Universal
+        }
     }
 
+    fun detectArchitecture(assetName: String): SystemArchitecture? =
+        (matchArchitecture(assetName) as? Match.Known)?.arch
+
     fun isCompatible(
         assetName: String,
         systemArch: SystemArchitecture,
-    ): Boolean {
-        val assetArch = detectArchitecture(assetName) ?: return true
-        return when (systemArch) {
-            SystemArchitecture.X86_64 -> assetArch == SystemArchitecture.X86_64 || assetArch == SystemArchitecture.X86
-            SystemArchitecture.AARCH64 -> assetArch == SystemArchitecture.AARCH64 || assetArch == SystemArchitecture.ARM
+    ): Boolean =
+        when (val match = matchArchitecture(assetName)) {
+            Match.Universal -> true
+            Match.Foreign -> false
+            is Match.Known -> isKnownCompatible(match.arch, systemArch)
+        }
+
+    private fun isKnownCompatible(
+        assetArch: SystemArchitecture,
+        systemArch: SystemArchitecture,
+    ): Boolean =
+        when (systemArch) {
+            SystemArchitecture.X86_64 ->
+    
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/AssetPlatform.kt` (modified, +17/-1)
```diff
@@ -2,10 +2,26 @@ package zed.rainxch.core.domain.utils
 
 import zed.rainxch.core.domain.model.repository.DiscoveryPlatform
 
+private val alpineApkSignature =
+    Regex(
+        "(^|[^a-z0-9])(" +
+            "linux|amd64|386|" +
+            "armhf|armel|armv7l|armv6l|arm32|" +
+            "riscv64|riscv|s390x|ppc64le|ppc64|powerpc|mips64|mips|loong64|loongarch|sparc64|sparc" +
+            ")([^a-z0-9]|$)",
+    )
+
+fun isAndroidApk(assetName: String): Boolean {
+    val lower = assetName.lowercase()
+    if (!lower.endsWith(".apk")) return false
+    return !alpineApkSignature.containsMatchIn(lower)
+}
+
 fun assetPlatformOf(assetName: String): DiscoveryPlatform? {
     val lower = assetName.lowercase()
     return when {
-        lower.endsWith(".apk") -> DiscoveryPlatform.Android
+        lower.endsWith(".apk") ->
+            if (isAndroidApk(assetName)) DiscoveryPlatform.Android else DiscoveryPlatform.Linux
         lower.endsWith(".ipa") -> DiscoveryPlatform.Ios
         lower.endsWith(".exe") || lower.endsWith(".msi") -> DiscoveryPlatform.Windows
         lower.endsWith(".dmg") || lower.endsWith(".pkg") -> DiscoveryPlatform.Macos
```

---

### Incident Patch 7: `491935c5` (2026-06-19)
**Commit Message**: Fix relative markdown links and intercept README language links (#785) (#788)

**File**: `composeApp/build.gradle.kts` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ android {
 }
 
 kotlin {
+    compilerOptions {
+        freeCompilerArgs.add("-Xexpect-actual-classes")
+    }
+
     sourceSets {
         androidMain.dependencies {
             implementation(libs.androidx.compose.ui.tooling.preview)
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/di/ViewModelsModule.kt` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ val viewModelsModule =
                 translationRepository = get(),
             )
         }
+        viewModel { params ->
+            zed.rainxch.details.presentation.markdownviewer.MarkdownViewerViewModel(
+                url = params[0],
+                detailsRepository = get(),
+                translationRepository = get(),
+            )
+        }
         viewModelOf(::DeveloperProfileViewModel)
         viewModel { params ->
             IssuesViewModel(
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AdaptiveDetailPaneContent.kt` (modified, +6/-0)
```diff
@@ -102,6 +102,9 @@ fun AdaptiveDetailPaneContent(
                         sourceHost = current.sourceHost,
                         translateTo = current.translateTo,
                         onNavigateBack = { route = DetailPaneRoute.Main },
+                        onNavigateToMarkdownViewer = { url ->
+                            navController.navigate(GithubStoreGraph.MarkdownViewerScreen(url))
+                        },
                         viewModel =
                             koinViewModel(key = aboutKey) {
                                 parametersOf(
@@ -196,6 +199,9 @@ private fun MainDetailPane(
         onNavigateToPulls = { owner, repo ->
             navController.navigate(GithubStoreGraph.RepoPullsScreen(owner = owner, repo = repo))
         },
+        onNavigateToMarkdownViewer = { url ->
+            navController.navigate(GithubStoreGraph.MarkdownViewerScreen(url))
+        },
         viewModel = viewModel,
     )
 }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AppNavigation.kt` (modified, +17/-0)
```diff
@@ -472,6 +472,9 @@ fun AppNavigation(
                                             ),
                                         )
                                     },
+                                    onNavigateToMarkdownViewer = { url ->
+                                        navController.navigate(GithubStoreGraph.MarkdownViewerScreen(url))
+                                    },
                                     viewModel =
                                         koinViewModel {
                                             parametersOf(
@@ -528,6 +531,9 @@ fun AppNavigation(
                                 sourceHost = args.sourceHost,
                                 translateTo = args.translateTo,
                                 onNavigateBack = { navController.navigateUp() },
+                                onNavigateToMarkdownViewer = { url ->
+                                    navController.navigate(GithubStoreGraph.MarkdownViewerScreen(url))
+                                },
                             )
                         }
 
@@ -634,6 +640,17 @@ fun AppNavigation(
                             )
                         }
 
+                        composable<GithubStoreGraph.MarkdownViewerScreen> { backStackEntry ->
+                            val args = backStackEntry.toRoute<GithubStoreGraph.MarkdownViewerScreen>()
+                            zed.rainxch.details.presentation.markdownviewer.MarkdownViewerRoot(
+                                url = args.url,
+                                onNavigateBack = { navController.navigateUp() },
+                                onNavigateToMarkdownViewer = { url ->
+                                    navController.navigate(GithubStoreGraph.MarkdownViewerScreen(url))
+                                },
+                            )
+                        }
+
                         composable<GithubStoreGraph.DeveloperProfileScreen> { backStackEntry ->
                             val args =
                                 backStackEntry.toRoute<GithubStoreGraph.DeveloperProfileScreen>()
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/GithubStoreGraph.kt` (modified, +5/-0)
```diff
@@ -156,4 +156,9 @@ sealed interface GithubStoreGraph {
         val owner: String,
         val repo: String,
     ) : GithubStoreGraph
+
+    @Serializable
+    data class MarkdownViewerScreen(
+        val url: String,
+    ) : GithubStoreGraph
 }
```

---

### Incident Patch 8: `55b51634` (2026-06-14)
**Commit Message**:  fix: broken badges and update repo URLs in docs (#749)

**File**: `.github/workflows/build-desktop-platforms.yml` (modified, +1/-1)
```diff
@@ -603,7 +603,7 @@ jobs:
           pkgname = ${PKG_NAME}
           pkgver = ${VERSION}-1
           pkgdesc = Cross-platform app store for GitHub releases
-          url = https://github.com/OpenHub-Store/GitHub-Store
+          url = https://github.com/kurikomi-labs/komi-store
           builddate = $(date +%s)
           packager = GitHub Actions
           arch = x86_64
```

**File**: `CONTRIBUTING.md` (modified, +7/-7)
```diff
@@ -37,7 +37,7 @@ Plenty of ways to help, even without writing code:
 - **Report bugs.** Reproducible reports with logs are gold.
 - **Suggest features.** Open an issue describing the user-facing problem first; the implementation can be discussed there.
 - **Triage issues.** Reproduce open bugs, ask for missing info, label them.
-- **Write code.** Pick up a [`good first issue`](https://github.com/OpenHub-Store/GitHub-Store/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or any [`help wanted`](https://github.com/OpenHub-Store/GitHub-Store/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issue.
+- **Write code.** Pick up a [`good first issue`](https://github.com/kurikomi-labs/komi-store/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or any [`help wanted`](https://github.com/kurikomi-labs/komi-store/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issue.
 - **Translate strings.** See [Translations](#translations).
 - **Test pre-releases.** Watch the repo for new tags and try them out.
 
@@ -48,7 +48,7 @@ Plenty of ways to help, even without writing code:
 Two ways:
 
 - **Inside the app: `Profile → Send feedback`.** Auto-fills app version, platform, and installer. Pick the channel (email or GitHub issue) and you're done.
-- **On GitHub: [open a bug report](https://github.com/OpenHub-Store/GitHub-Store/issues/new?template=bug_report.md).** Tell us what went wrong, how to reproduce, your setup. Logs and screenshots help but aren't required.
+- **On GitHub: [open a bug report](https://github.com/kurikomi-labs/komi-store/issues/new?template=bug_report.md).** Tell us what went wrong, how to reproduce, your setup. Logs and screenshots help but aren't required.
 
 If you have logs handy, grab them from:
 
@@ -59,7 +59,7 @@ If you have logs handy, grab them from:
 
 ## Suggesting features
 
-[Open a feature request](https://github.com/OpenHub-Store/GitHub-Store/issues/new?template=feature_request.md). Lead with the **pain**, not the solution: what are you trying to do, where does the app fall short?
+[Open a feature request](https://github.com/kurikomi-labs/komi-store/issues/new?template=feature_request.md). Lead with the **pain**, not the solution: what are you trying to do, where does the app fall short?
 
 For bigger ideas (new screens, new platform, architectural shifts), open the issue first and wait for a quick discussion before writing code.
 
@@ -77,8 +77,8 @@ For bigger ideas (new screens, new platform, architectural shifts), open the iss
 ### One-time setup
 
 ```bash
-git clone https://github.com/OpenHub-Store/GitHub-Store.git
-cd GitHub-Store
+git clone https://github.com/kurikomi-labs/komi-store.git
+cd komi-store
 ```
 
 Create `local.properties` in the repo root:
@@ -306,7 +306,7 @@ You don't normally need to touch this as a contributor; just be aware that landi
 
 ## Security disclosures
 
-**Do not open public issues for security vulnerabilities.** Use [GitHub's private vulnerability reporting](https://github.com/OpenHub-Store/GitHub-Store/security/advisories/new) or email **hello@github-store.org** with the details.
+**Do not open public issues for security vulnerabilities.** Use [GitHub's private vulnerability reporting](https://github.com/kurikomi-labs/komi-store/security/advisories/new) or email **hello@github-store.org** with the details.
 
 We treat token leaks, install-flow exploits, and signing-bypass paths as critical. Other issues we'll triage on a best-effort basis.
 
@@ -316,7 +316,7 @@ We treat token leaks, install-flow exploits, and signing-bypass paths as critica
 
 - **Real-time chat:** join the [Discord server](https://discord.github-store.org) — fastest way to get a hand from maintainers and other contributors.
 - **Email:** **hello@github-store.org** for anything that doesn't fit a public channel — sponsorship, partnerships, sensitive coordination.
-- **General questions / discussion:** open a [GitHub Discussion](https://github.com/OpenHub-Store/GitHub-Store
```

**File**: `README.md` (modified, +22/-22)
```diff
@@ -17,27 +17,27 @@
   <img src="https://ziadoua.github.io/m3-Markdown-Badges/badges/Linux/linux2.svg" />
   <br/>
   <br/>
- <a href="https://github.com/OpenHub-Store/GitHub-Store/releases/latest">
-  <img src="https://api.github-store.org/v1/badge/OpenHub-Store/GitHub-Store/downloads/5/2?label=Downloads%20:" alt="Downloads"/>
+ <a href="https://github.com/kurikomi-labs/komi-store/releases/latest">
+  <img src="https://api.github-store.org/v1/badge/kurikomi-labs/komi-store/downloads/5/2?label=Downloads%20:" alt="Downloads"/>
 </a>
-<a href="https://github.com/OpenHub-Store/GitHub-Store/stargazers">
+<a href="https://github.com/kurikomi-labs/komi-store/stargazers">
   <img src="https://m3-markdown-badges.vercel.app/stars/3/2/OpenHub-Store/GitHub-Store" alt="Stars"/>
 </a>
-<a href="https://github.com/OpenHub-Store/GitHub-Store/issues">
+<a href="https://github.com/kurikomi-labs/komi-store/issues">
   <img src="https://m3-markdown-badges.vercel.app/issues/1/2/OpenHub-Store/GitHub-Store" alt="Issues"/>
 </a>
-<a href="https://github.com/OpenHub-Store/GitHub-Store/releases/latest">
-  <img src="https://api.github-store.org/v1/badge/OpenHub-Store/GitHub-Store/release/9/1?label=Latest%20version%20:" alt="Latest release"/>
+<a href="https://github.com/kurikomi-labs/komi-store/releases/latest">
+  <img src="https://api.github-store.org/v1/badge/kurikomi-labs/komi-store/release/9/1?label=Latest%20version%20:" alt="Latest release"/>
 </a>
 </p>
 
 <table align="center">
   <tr>
     <td>
-      <a href="https://trendshift.io/repositories/22313" target="_blank"><img src="https://trendshift.io/api/badge/repositories/22313" alt="OpenHub-Store%2FGitHub-Store | Trendshift" width="250" height="55" /></a>
+      <a href="https://trendshift.io/repositories/22313" target="_blank"><img src="https://trendshift.io/api/badge/repositories/22313" alt="kurikomi-labs%2Fkomi-store | Trendshift" width="250" height="55" /></a>
     </td>
     <td>
-      <a href="https://hellogithub.com/en/repository/OpenHub-Store/GitHub-Store" target="_blank"><img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=a95f4a4830bc4a69b56f96ac7efaacf8&claim_uid=sOz1lfiG4ARQYIK&theme=dark" alt="Featured｜HelloGitHub" width="250" height="54" /></a>
+      <a href="https://hellogithub.com/en/repository/kurikomi-labs/komi-store" target="_blank"><img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=a95f4a4830bc4a69b56f96ac7efaacf8&claim_uid=sOz1lfiG4ARQYIK&theme=dark" alt="Featured｜HelloGitHub" width="250" height="54" /></a>
     </td>
   </tr>
 </table>
@@ -80,17 +80,17 @@ Built with Kotlin Multiplatform and Compose Multiplatform for Android and Deskto
 </div>
 
 <p align="center">
-  <a href="https://github.com/OpenHub-Store/GitHub-Store/releases">
-    <img src="https://i.ibb.co/q0mdc4Z/get-it-on-github.png" height="80" />
+  <a href="https://github.com/kurikomi-labs/komi-store/releases">
+    <img src="https://i.ibb.co/q0mdc4Z/get-it-on-github.png" height="80" alt="Get it on GitHub" />
   </a>
   <a href="https://f-droid.org/en/packages/zed.rainxch.githubstore/">
-    <img src="https://f-droid.org/badge/get-it-on.png" height="80" />
+    <img src="https://f-droid.org/badge/get-it-on.png" height="80" alt="Get it on F-Droid" />
   </a>
   <br/>
-  <a href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/OpenHub-Store/GitHub-Store/">
+  <a href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/kurikomi-labs/komi-store/">
     <img src="https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png" height="55" alt="Get it on Obtainium" />
   </a>
-  <a href="https://github-store.org/app?repo=OpenHub-Store/GitHub-Store">
+  <a href="https://github-store.org/app?repo=kurikomi-labs/komi-store">
     <img src="media-resources/ghs_download_badge.png" alt="Get it on Komi Store" height="58" />
   </a>
 </p>
@@ -302,7 +302,7 @@ automatically—no manual submi
```

**File**: `dist/homebrew/Casks/github-store.rb` (modified, +2/-2)
```diff
@@ -5,10 +5,10 @@
   sha256 arm:   "ad0c532873c0400736b7ea706a33604f7ef93b2479a4a6f32673a789b18ccd8e",
          intel: "faf002283c301db2a97f7a32193778f678d42ed71551a623711cd170d6fde16a"
 
-  url "https://github.com/OpenHub-Store/GitHub-Store/releases/download/v#{version}/GitHub-Store-#{version}-#{arch}.dmg"
+  url "https://github.com/kurikomi-labs/komi-store/releases/download/v#{version}/GitHub-Store-#{version}-#{arch}.dmg"
   name "GitHub Store"
   desc "Cross-platform app store for GitHub releases"
-  homepage "https://github.com/OpenHub-Store/GitHub-Store"
+  homepage "https://github.com/kurikomi-labs/komi-store"
 
   livecheck do
     url :url
```

**File**: `fastlane/metadata/android/en-US/full_description.txt` (modified, +1/-1)
```diff
@@ -21,4 +21,4 @@ FEATURES
 
 Also available on Desktop (Windows, macOS, Linux) with tablet two-pane layout, fluid content width, persistent window state, and a native dark title bar on Windows 11 and macOS.
 
-Built with Kotlin Multiplatform and Compose Multiplatform. Source on GitHub at OpenHub-Store/GitHub-Store.
+Built with Kotlin Multiplatform and Compose Multiplatform. Source on GitHub at kurikomi-labs/komi-store.
```

---

### Incident Patch 9: `9fea77df` (2026-06-12)
**Commit Message**: Fix proxy settings not saving (startup deadlock) (#759)

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/network/HttpClientFactory.android.kt` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ actual fun createPlatformHttpClient(proxyConfig: ProxyConfig): HttpClient {
                     proxy =
                         Proxy(
                             Proxy.Type.HTTP,
-                            InetSocketAddress(proxyConfig.host, proxyConfig.port),
+                            InetSocketAddress.createUnresolved(proxyConfig.host, proxyConfig.port),
                         )
                     if (proxyConfig.username != null) {
                         config {
@@ -51,7 +51,7 @@ actual fun createPlatformHttpClient(proxyConfig: ProxyConfig): HttpClient {
                     proxy =
                         Proxy(
                             Proxy.Type.SOCKS,
-                            InetSocketAddress(proxyConfig.host, proxyConfig.port),
+                            InetSocketAddress.createUnresolved(proxyConfig.host, proxyConfig.port),
                         )
 
                     if (proxyConfig.username != null) {
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/ProxyRepositoryImpl.kt` (modified, +42/-31)
```diff
@@ -18,6 +18,7 @@ import kotlinx.coroutines.flow.flow
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
+import kotlinx.coroutines.withContext
 import zed.rainxch.core.data.network.ProxyManager
 import zed.rainxch.core.domain.logging.GitHubStoreLogger
 import zed.rainxch.core.domain.model.settings.ProxyConfig
@@ -137,34 +138,38 @@ class ProxyRepositoryImpl(
 
     override suspend fun setProxyConfig(scope: ProxyScope, config: ProxyConfig) {
         migrationDeferred.await()
-        val keys = keysFor(scope)
-        when (config) {
-            is ProxyConfig.None -> {
-                ksafe.safePut(keys.type, "none")
-                ksafe.safeDelete(keys.host); ksafe.safeDelete(keys.port)
-                ksafe.safeDelete(keys.username); ksafe.safeDelete(keys.password)
-            }
-            is ProxyConfig.System -> {
-                ksafe.safePut(keys.type, "system")
-                ksafe.safeDelete(keys.host); ksafe.safeDelete(keys.port)
-                ksafe.safeDelete(keys.username); ksafe.safeDelete(keys.password)
-            }
-            is ProxyConfig.Http -> {
-                ksafe.safePut(keys.type, "http")
-                ksafe.safePut(keys.host, config.host)
-                ksafe.safePut(keys.port, config.port)
-                writeOrClear(keys.username, config.username)
-                writeOrClear(keys.password, config.password)
-            }
-            is ProxyConfig.Socks -> {
-                ksafe.safePut(keys.type, "socks")
-                ksafe.safePut(keys.host, config.host)
-                ksafe.safePut(keys.port, config.port)
-                writeOrClear(keys.username, config.username)
-                writeOrClear(keys.password, config.password)
+        // KSafe encrypt + disk writes are blocking; keep them off the caller's thread
+        // (the save handler runs on the main dispatcher) so saving doesn't freeze the UI.
+        withContext(Dispatchers.IO) {
+            val keys = keysFor(scope)
+            when (config) {
+                is ProxyConfig.None -> {
+                    ksafe.safePut(keys.type, "none")
+                    ksafe.safeDelete(keys.host); ksafe.safeDelete(keys.port)
+                    ksafe.safeDelete(keys.username); ksafe.safeDelete(keys.password)
+                }
+                is ProxyConfig.System -> {
+                    ksafe.safePut(keys.type, "system")
+                    ksafe.safeDelete(keys.host); ksafe.safeDelete(keys.port)
+                    ksafe.safeDelete(keys.username); ksafe.safeDelete(keys.password)
+                }
+                is ProxyConfig.Http -> {
+                    ksafe.safePut(keys.type, "http")
+                    ksafe.safePut(keys.host, config.host)
+                    ksafe.safePut(keys.port, config.port)
+                    writeOrClear(keys.username, config.username)
+                    writeOrClear(keys.password, config.password)
+                }
+                is ProxyConfig.Socks -> {
+                    ksafe.safePut(keys.type, "socks")
+                    ksafe.safePut(keys.host, config.host)
+                    ksafe.safePut(keys.port, config.port)
+                    writeOrClear(keys.username, config.username)
+                    writeOrClear(keys.password, config.password)
+                }
             }
+            ProxyManager.setConfig(scope, config)
         }
-        ProxyManager.setConfig(scope, config)
     }
 
     private suspend fun writeOrClear(key: String, value: String?) {
@@ -188,6 +193,10 @@ class ProxyRepositoryImpl(
 
     override suspend fun setMasterProxyConfig(config: ProxyConfig) {
         migrationDeferred.await()
+        writeMasterConfig(config)
+    }
+
+    private suspend fun writeMasterConfig(config: ProxyConfig) = withContext(Dispatchers.IO) {
         when (config) {
             is ProxyConfig.None -> {
                 ksafe.safePut(MasterKeys.TYPE, "none")
@@ -223,7 +232,11
```

**File**: `core/data/src/jvmMain/kotlin/zed/rainxch/core/data/network/HttpClientFactory.jvm.kt` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ actual fun createPlatformHttpClient(proxyConfig: ProxyConfig): HttpClient =
                     }
 
                     is ProxyConfig.Http -> {
-                        proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress(proxyConfig.host, proxyConfig.port)))
+                        proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress.createUnresolved(proxyConfig.host, proxyConfig.port)))
                         val username = proxyConfig.username
                         val password = proxyConfig.password
                         if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
@@ -47,7 +47,7 @@ actual fun createPlatformHttpClient(proxyConfig: ProxyConfig): HttpClient =
                     }
 
                     is ProxyConfig.Socks -> {
-                        proxy(Proxy(Proxy.Type.SOCKS, InetSocketAddress(proxyConfig.host, proxyConfig.port)))
+                        proxy(Proxy(Proxy.Type.SOCKS, InetSocketAddress.createUnresolved(proxyConfig.host, proxyConfig.port)))
                         val username = proxyConfig.username
                         val password = proxyConfig.password
                         val proxyHost = proxyConfig.host
```

**File**: `feature/tweaks/presentation/src/commonMain/kotlin/zed/rainxch/tweaks/presentation/components/TweaksSubScreenScaffold.kt` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxHeight
+import androidx.compose.foundation.layout.imePadding
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.height
 import androidx.compose.foundation.layout.padding
@@ -73,7 +74,9 @@ fun TweaksSubScreenScaffold(
         snackbarHost = {
             SnackbarHost(
                 hostState = snackbarState,
-                modifier = Modifier.padding(bottom = bottomNavHeight + 16.dp),
+                modifier = Modifier
+                    .imePadding()
+                    .padding(bottom = bottomNavHeight + 16.dp),
             )
         },
         containerColor = MaterialTheme.colorScheme.background,
```

**File**: `feature/tweaks/presentation/src/commonMain/kotlin/zed/rainxch/tweaks/presentation/connection/TweaksConnectionRoot.kt` (modified, +32/-6)
```diff
@@ -103,14 +103,24 @@ fun TweaksConnectionRoot(
     val snackbarState = remember { SnackbarHostState() }
     val coroutineScope = rememberCoroutineScope()
     var pasteSheetOpen by rememberSaveable { mutableStateOf(false) }
+    var masterSaving by remember { mutableStateOf(false) }
+    var savingScope by remember { mutableStateOf<ProxyScope?>(null) }
 
     ObserveAsEvents(viewModel.events) { event ->
         when (event) {
-            TweaksEvent.OnProxySaved -> coroutineScope.launch {
-                snackbarState.showSnackbar(getString(Res.string.proxy_saved))
+            TweaksEvent.OnProxySaved -> {
+                masterSaving = false
+                savingScope = null
+                coroutineScope.launch {
+                    snackbarState.showSnackbar(getString(Res.string.proxy_saved))
+                }
             }
-            is TweaksEvent.OnProxySaveError -> coroutineScope.launch {
-                snackbarState.showSnackbar(event.message)
+            is TweaksEvent.OnProxySaveError -> {
+                masterSaving = false
+                savingScope = null
+                coroutineScope.launch {
+                    snackbarState.showSnackbar(event.message)
+                }
             }
             is TweaksEvent.OnProxyTestSuccess -> coroutineScope.launch {
                 snackbarState.showSnackbar(
@@ -149,7 +159,11 @@ fun TweaksConnectionRoot(
         item(key = "main_card") {
             MainConnectionCard(
                 form = state.masterProxyForm,
-                onAction = { viewModel.onAction(it) },
+                isSaving = masterSaving,
+                onAction = {
+                    if (it is TweaksAction.OnMasterProxySave) masterSaving = true
+                    viewModel.onAction(it)
+                },
                 onPasteUrl = { pasteSheetOpen = true },
             )
             Spacer(Modifier.height(16.dp))
@@ -158,7 +172,11 @@ fun TweaksConnectionRoot(
         item(key = "overrides_card") {
             OverridesCard(
                 state = state,
-                onAction = { viewModel.onAction(it) },
+                savingScope = savingScope,
+                onAction = {
+                    if (it is TweaksAction.OnProxySave) savingScope = it.scope
+                    viewModel.onAction(it)
+                },
             )
         }
     }
@@ -211,6 +229,7 @@ private fun IntroCard() {
 @Composable
 private fun MainConnectionCard(
     form: ProxyScopeFormState,
+    isSaving: Boolean,
     onAction: (TweaksAction) -> Unit,
     onPasteUrl: () -> Unit,
 ) {
@@ -279,6 +298,8 @@ private fun MainConnectionCard(
                             label = stringResource(Res.string.proxy_save),
                             variant = GhsButtonVariant.Primary,
                             leadingIcon = Icons.Default.Save,
+                            enabled = !isSaving && !form.isTestInProgress,
+                            loading = isSaving,
                             modifier = Modifier.weight(1f),
                         )
                     }
@@ -410,6 +431,7 @@ private fun ModePillSegment(
 @Composable
 private fun OverridesCard(
     state: TweaksState,
+    savingScope: ProxyScope?,
     onAction: (TweaksAction) -> Unit,
 ) {
     Surface(
@@ -440,6 +462,7 @@ private fun OverridesCard(
                     scope = scope,
                     useMain = state.useMain(scope),
                     scopeForm = state.formFor(scope),
+                    isSaving = savingScope == scope,
                     onToggle = { useMain ->
                         onAction(TweaksAction.OnScopeUseMainToggled(scope, useMain))
                     },
@@ -455,6 +478,7 @@ private fun ScopeOverrideRow(
     scope: ProxyScope,
     useMain: Boolean,
     scopeForm: ProxyScopeFormState,
+    isSaving: Boolean,
     onToggle: (Boolean) -> Unit,
     onAction: (TweaksAction) -> Unit,
 ) {
@@ -549,6 +573,8 @@ private fun ScopeOverrideRow(
                         
```

---

### Incident Patch 10: `21f1ee0a` (2026-06-12)
**Commit Message**: Fix tracked apps vanishing from the library (#754)

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/use_cases/SyncInstalledAppsUseCase.kt` (modified, +19/-0)
```diff
@@ -65,6 +65,25 @@ class SyncInstalledAppsUseCase(
                     }
                 }
 
+                // Guard against a visibility-restricted package scan wiping the library (GH#748).
+                // getAllInstalledPackageNames() is filtered by Android package visibility; on some
+                // OEM ROMs it returns little more than this app itself, which would flag every
+                // tracked app as uninstalled. Real uninstalls are handled in real time by
+                // PackageEventReceiver, so if the scan recognises fewer than half of the tracked
+                // apps it is untrustworthy, not a genuine mass-uninstall — skip the catch-up deletes.
+                val nonPendingCount = appsInDb.count { !it.isPendingInstall }
+                val recognizedCount = appsInDb.count {
+                    !it.isPendingInstall && installedPackageNames.contains(it.packageName)
+                }
+                if (nonPendingCount >= 2 && recognizedCount * 2 < nonPendingCount) {
+                    logger.error(
+                        "Installed-apps sync: package scan recognised only $recognizedCount of " +
+                            "$nonPendingCount tracked apps (visibility restricted?). Skipping " +
+                            "${toDelete.size} deletions to avoid wiping the library (GH#748).",
+                    )
+                    toDelete.clear()
+                }
+
                 executeInTransaction {
                     toDelete.forEach { packageName ->
                         try {
```

#### Recent Merged Pull Requests:
- **PR #967** (closed): fix: stop the profile card flashing the signed-out state on entry (@illumiat)
- **PR #956** (2026-09-04): Update GitHub org paths to komi-store (@rainxchzed)
- **PR #938** (2026-08-31): fix(ui): align asset card spacing and animate picker height changes (@YumeYuka)
- **PR #906** (closed): fix: detect updates for nightly and opaque-marker version tags (@illumiat)
- **PR #905** (2026-07-29): Refactor README to simplify content and remove badges (@rainxchzed)
- **PR #868** (2026-07-13): Polish docs and comments in komi-store (@bglglzd)
- **PR #844** (2026-06-28): Add Traditional Chinese (zh-TW) localization (@rainxchzed)
- **PR #843** (2026-06-28): Persist desktop settings under the application data directory (@rainxchzed)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
