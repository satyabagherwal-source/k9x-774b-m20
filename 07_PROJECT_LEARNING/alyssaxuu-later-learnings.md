# Forensic Learning Record (Deep Inspection): alyssaxuu/later

> **Canonical Artifact**: `07_PROJECT_LEARNING/alyssaxuu-later-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alyssaxuu/later](https://github.com/alyssaxuu/later))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:33:47.262Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alyssaxuu/later`
- **Description**: Save all your Mac apps for later with one click 🖱️
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1790 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `xcode/EventMonitor.swift`
```
//
//  EventMonitor.swift
//  Test
//
//  Created by Alyssa X on 1/24/22.
//

import Cocoa

open class EventMonitor {
    
    fileprivate var monitor: AnyObject?
    fileprivate let mask: NSEvent.EventTypeMask
    fileprivate let handler: (NSEvent?) -> ()
    
    public init(mask: NSEvent.EventTypeMask, handler: @escaping (NSEvent?) -> ()) {
        self.mask = mask
        self.handler = handler
    }
    
    deinit {
        stop()
    }
    
    open func start() {
        monitor = NSEvent.addGlobalMonitorForEvents(matching: mask, handler: handler) as AnyObject?
    }
    
    open func stop() {
        if monitor != nil {
            NSEvent.removeMonitor(monitor!)
            monitor = nil
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #25** (2026-02-26): **Ms/UI fixes**
  *Symptoms*: 

- **Issue #24** (2026-02-26): **Add custom app ignore list for session save/restore**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > add new feature to enable ignoring custom apps.

- **Issue #17** (2023-04-26): **Can anyone give me Later app dmg :( @alyssaxuu please release**
  *Symptoms*: https://getlater.app/  
  **Post-Mortem & Fix Analysis**:
  > https://github.com/alyssaxuu/later/blob/master/Later.dmg

- **Issue #4** (2024-03-20): **M1 Compatability?**
  *Symptoms*: Is there M1 compatability?  <img width="698" alt="image" src="https://user-images.githubusercontent.com/1911919/188295020-c6aeadda-9104-48a8-aba2-7438af54c7a7.png">   <img width="1800" alt="Screen Shot 2022-09-03 at 10 53 41 PM" src="https://user-images.githubusercontent.com/1911919/188295011-4f2bb724-5e94-44d2-b23b-86115f043c08.png"> 
  **Post-Mortem & Fix Analysis**:
  > Hi @hanskokx , Yes it is compatible, you just have to give your computer access to run it. I also use an M1. <img width="698" alt="image" src="https://user-images.githubusercontent.com/65264054/188308370-d6f46fbb-0c91-4259-a687-af86a30d5b4c.png">  Follow this guide I made below on how to make it run 👇   https://user-images.githubusercontent.com/65264054/188308256-42c8db73-2262-4b7a-9932-4130348b19d3.mp4  
  > This is addressed in the readme:  > Installing Later > You can install Later on macOS 11.6 or later. >  > [Click here](https://github.com/alyssaxuu/later/raw/master/Later.dmg) to download the latest version. You can also download the [Later.dmg](https://github.com/alyssaxuu/later/blob/master/Later.dmg) file from this repo. > Drag the Later app into the Applications folder. > Right click while holding the Control key on the Later app, and select "Open" from the context menu. > **You will be prompted with an alert saying that the app can't be opened because Apple cannot check it for malicious software (it's not signed). You can open it anyway by clicking "Open".** > Later will open as an item on your menu bar.

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

### Incident Patch 1: `26e79369` (2023-04-17)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +2/-4)
```diff
@@ -16,6 +16,8 @@ Later is a Mac menu bar app that clears and restores your workspace with ease. S
 
 Made by [Alyssa X](https://twitter.com/alyssaxuu)
 
+Note: I am not maintaining this project any longer, I have open sourced it so anyone can make changes and improvements, or build their own version of it.
+
 ## Table of contents
 
 - [Features](#features)
@@ -42,7 +44,3 @@ You can open Later in Xcode if you'd like to make any changes, or develop it fur
 2. Open Xcode, and choose the option to "Open a project or file"
 3. Select the Xcode folder you downloaded
 4. You might be prompted with a warning, select "Trust and open" to proceed.
-
-#
-
-Feel free to reach out to me through email at hi@alyssax.com or [on Twitter](https://twitter.com/alyssaxuu) if you have any questions or feedback! Hope you find this useful 💜
```

---

### Incident Patch 2: `3c2f7be0` (2022-07-01)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ Later is a Mac menu bar app that clears and restores your workspace with ease. S
 
 <a href="https://www.producthunt.com/posts/later-aa762753-cafe-475e-9acb-d534de9e6adf?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-later&#0045;aa762753&#0045;cafe&#0045;475e&#0045;9acb&#0045;d534de9e6adf" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=332569&theme=light" alt="Later - Save&#0032;all&#0032;your&#0032;Mac&#0032;apps&#0032;for&#0032;later&#0032;with&#0032;one&#0032;click | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
 
+> You can support this project (and many others) through [GitHub Sponsors](https://github.com/sponsors/alyssaxuu)! ❤️
+
 Made by [Alyssa X](https://twitter.com/alyssaxuu)
 
 ## Table of contents
```

---

### Incident Patch 3: `699627b4` (2022-07-01)
**Commit Message**: Create FUNDING.yml

**File**: `.github/FUNDING.yml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+# These are supported funding model platforms
+
+github: alyssaxuu
+patreon: # Replace with a single Patreon username
+open_collective: # Replace with a single Open Collective username
+ko_fi: # Replace with a single Ko-fi username
+tidelift: # Replace with a single Tidelift platform-name/package-name e.g., npm/babel
+community_bridge: # Replace with a single Community Bridge project-name e.g., cloud-foundry
+liberapay: # Replace with a single Liberapay username
+issuehunt: # Replace with a single IssueHunt username
+otechie: # Replace with a single Otechie username
+lfx_crowdfunding: # Replace with a single LFX Crowdfunding project-name e.g., cloud-foundry
+custom: # Replace with up to 4 custom sponsorship URLs e.g., ['link1', 'link2']
```

---

### Incident Patch 4: `7ee5cd2f` (2022-07-01)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +2/-9)
```diff
@@ -17,15 +17,8 @@ Made by [Alyssa X](https://twitter.com/alyssaxuu)
 ## Table of contents
 
 - [Features](#features)
-- [Controlling the interface](#controlling-the-interface)
-	- [Opening Omni](#opening-omni)
-	- [Closing Omni](#closing-omni)
-	- [Switching between dark and light mode](#switching-between-dark-and-light-mode)
-- [List of commands](#list-of-commands)
-- [Self-hosting Omni](#self-hosting-omni)
-	- [Installing on Chrome](#installing-on-chrome)
-	- [Installing on Firefox](#installing-on-firefox) 
-- [Libraries used](#libraries-used)
+- [Installing Later](#installing-later)
+- [Source code](#source-code)
 
 ## Features
 
```

---

### Incident Patch 5: `9505cbc6` (2022-07-01)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +53/-2)
```diff
@@ -1,2 +1,53 @@
-# later
- Save all your Mac apps for later with one click 🖱️
+# Later
+
+
+
+https://user-images.githubusercontent.com/7581348/176900722-6ceb1fb7-b235-4a6a-991c-6273edc31b30.mp4
+
+
+Save all your Mac apps for later with one click 🖱️
+
+Later is a Mac menu bar app that clears and restores your workspace with ease. Switch off from work, tidy up your desktop before screen sharing, schedule apps for later, and more.
+
+
+<a href="https://www.producthunt.com/posts/later-aa762753-cafe-475e-9acb-d534de9e6adf?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-later&#0045;aa762753&#0045;cafe&#0045;475e&#0045;9acb&#0045;d534de9e6adf" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=332569&theme=light" alt="Later - Save&#0032;all&#0032;your&#0032;Mac&#0032;apps&#0032;for&#0032;later&#0032;with&#0032;one&#0032;click | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
+
+Made by [Alyssa X](https://twitter.com/alyssaxuu)
+
+## Table of contents
+
+- [Features](#features)
+- [Controlling the interface](#controlling-the-interface)
+	- [Opening Omni](#opening-omni)
+	- [Closing Omni](#closing-omni)
+	- [Switching between dark and light mode](#switching-between-dark-and-light-mode)
+- [List of commands](#list-of-commands)
+- [Self-hosting Omni](#self-hosting-omni)
+	- [Installing on Chrome](#installing-on-chrome)
+	- [Installing on Firefox](#installing-on-firefox) 
+- [Libraries used](#libraries-used)
+
+## Features
+
+👻 Hide or close all your apps<br> ⚡️ Restore your session with just one click<br> 👀 View metadata and a preview of your saved sessions<br> ⏱ Schedule apps to reopen after some time to get back in the flow<br> 🔋 Save battery by closing your apps instead of leaving them open<br> ⌨️ Keyboard shortcuts to save and restore your session<br> ⚙️ Advanced settings to ignore apps, terminate instead of hiding, etc.
+
+## Installing Later
+You can install Later on macOS 11.6 or later.
+1. [Click here](https://github.com/alyssaxuu/later/raw/master/Later.dmg) to download the latest version. You can also download the [Later.dmg](https://github.com/alyssaxuu/later/blob/master/Later.dmg) file from this repo.
+2.  Drag the Later app into the Applications folder.
+3.  Right click while holding the Control key on the Later app, and select "Open" from the context menu.
+4. You will be prompted with an alert saying that the app can't be opened because Apple cannot check it for malicious software (it's not signed). You can open it anyway by clicking "Open".
+5. Later will open as an item on your menu bar.
+
+You can read the [FAQ](https://necessary-duke-5f6.notion.site/FAQ-c1a7231ecf34441e9d3d6944199e4705) if you have any questions.
+
+## Source code
+You can open Later in Xcode if you'd like to make any changes, or develop it further.
+1. Download the [Xcode folder](https://github.com/alyssaxuu/later/tree/master/xcode) in the repo.
+2. Open Xcode, and choose the option to "Open a project or file"
+3. Select the Xcode folder you downloaded
+4. You might be prompted with a warning, select "Trust and open" to proceed.
+
+#
+
+Feel free to reach out to me through email at hi@alyssax.com or [on Twitter](https://twitter.com/alyssaxuu) if you have any questions or feedback! Hope you find this useful 💜
```

---

### Incident Patch 6: `3043fb94` (2022-07-01)
**Commit Message**: Update xcode

**File**: `xcode/Later.xcodeproj/project.pbxproj` (modified, +9/-9)
```diff
@@ -34,15 +34,15 @@
 		EC37624B279C641E003144C7 /* Test.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Test.entitlements; sourceTree = "<group>"; };
 		EC376251279C66F4003144C7 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist; path = Info.plist; sourceTree = "<group>"; };
 		EC376257279EF896003144C7 /* EventMonitor.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EventMonitor.swift; sourceTree = "<group>"; };
-		EC37625C279F0753003144C7 /* Inter-Thin.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Thin.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Thin.ttf"; sourceTree = "<group>"; };
-		EC37625D279F0753003144C7 /* Inter-SemiBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-SemiBold.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-SemiBold.ttf"; sourceTree = "<group>"; };
-		EC37625E279F0753003144C7 /* Inter-Medium.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Medium.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Medium.ttf"; sourceTree = "<group>"; };
-		EC37625F279F0753003144C7 /* Inter-ExtraBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-ExtraBold.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-ExtraBold.ttf"; sourceTree = "<group>"; };
-		EC376260279F0753003144C7 /* Inter-Black.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Black.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Black.ttf"; sourceTree = "<group>"; };
-		EC376261279F0753003144C7 /* Inter-Regular.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Regular.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Regular.ttf"; sourceTree = "<group>"; };
-		EC376262279F0753003144C7 /* Inter-ExtraLight.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-ExtraLight.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-ExtraLight.ttf"; sourceTree = "<group>"; };
-		EC376263279F0753003144C7 /* Inter-Light.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Light.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Light.ttf"; sourceTree = "<group>"; };
-		EC376264279F0753003144C7 /* Inter-Bold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Bold.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Bold.ttf"; sourceTree = "<group>"; };
+		EC37625C279F0753003144C7 /* Inter-Thin.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Thin.ttf"; sourceTree = "<group>"; };
+		EC37625D279F0753003144C7 /* Inter-SemiBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-SemiBold.ttf"; sourceTree = "<group>"; };
+		EC37625E279F0753003144C7 /* Inter-Medium.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Medium.ttf"; sourceTree = "<group>"; };
+		EC37625F279F0753003144C7 /* Inter-ExtraBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-ExtraBold.ttf"; sourceTree = "<group>"; };
+		EC376260279F0753003144C7 /* Inter-Black.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Black.ttf"; sourceTree = "<group>"; };
+		EC376261279F0753003144C7 /* Inter-Regular.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Regular.ttf"; sourceTree = "<group>"; };
+		EC376262279F0753003144C7 /* Inter-ExtraLight.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-ExtraLight.ttf"; sourceTree = "<group>"; };
+		EC376263279F0753003144C7 /* Inter-Light.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Light.ttf"; sourceTree = "<group>"; };
+		EC376264279F0753003144C7 /* Inter-Bold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "Inter-Bold.ttf"; sourceTree = "<group>"; };
 		ECC4FED1286F0ABA0099663A /* en */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = en; path = en.lproj/Main.storyboard; sourceTree = "<group>"; };
 		ECF31AE627BC4DF200994D3C /* ViewController2.xib */ = {isa = PBXFileReference; lastKnownFileType = file.xib; path = ViewController2.xib; sourceTree = "<group>"; };
 /* End PBXFileReference section */
```

---

### Incident Patch 7: `28ae0e8c` (2022-07-01)
**Commit Message**: Xcode

**File**: `xcode/EventMonitor.swift` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+//
+//  EventMonitor.swift
+//  Test
+//
+//  Created by Alyssa X on 1/24/22.
+//
+
+import Cocoa
+
+open class EventMonitor {
+    
+    fileprivate var monitor: AnyObject?
+    fileprivate let mask: NSEvent.EventTypeMask
+    fileprivate let handler: (NSEvent?) -> ()
+    
+    public init(mask: NSEvent.EventTypeMask, handler: @escaping (NSEvent?) -> ()) {
+        self.mask = mask
+        self.handler = handler
+    }
+    
+    deinit {
+        stop()
+    }
+    
+    open func start() {
+        monitor = NSEvent.addGlobalMonitorForEvents(matching: mask, handler: handler) as AnyObject?
+    }
+    
+    open func stop() {
+        if monitor != nil {
+            NSEvent.removeMonitor(monitor!)
+            monitor = nil
+        }
+    }
+}
```

**File**: `xcode/Later.xcodeproj/project.pbxproj` (added, +488/-0)
```diff
@@ -0,0 +1,488 @@
+// !$*UTF8*$!
+{
+	archiveVersion = 1;
+	classes = {
+	};
+	objectVersion = 53;
+	objects = {
+
+/* Begin PBXBuildFile section */
+		EC376243279C641D003144C7 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = EC376242279C641D003144C7 /* AppDelegate.swift */; };
+		EC376245279C641D003144C7 /* ViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = EC376244279C641D003144C7 /* ViewController.swift */; };
+		EC376247279C641E003144C7 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = EC376246279C641E003144C7 /* Assets.xcassets */; };
+		EC37624A279C641E003144C7 /* Main.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = EC376248279C641E003144C7 /* Main.storyboard */; };
+		EC376258279EF896003144C7 /* EventMonitor.swift in Sources */ = {isa = PBXBuildFile; fileRef = EC376257279EF896003144C7 /* EventMonitor.swift */; };
+		EC376265279F0753003144C7 /* Inter-Thin.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC37625C279F0753003144C7 /* Inter-Thin.ttf */; };
+		EC376266279F0753003144C7 /* Inter-SemiBold.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC37625D279F0753003144C7 /* Inter-SemiBold.ttf */; };
+		EC376267279F0753003144C7 /* Inter-Medium.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC37625E279F0753003144C7 /* Inter-Medium.ttf */; };
+		EC376268279F0753003144C7 /* Inter-ExtraBold.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC37625F279F0753003144C7 /* Inter-ExtraBold.ttf */; };
+		EC376269279F0753003144C7 /* Inter-Black.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC376260279F0753003144C7 /* Inter-Black.ttf */; };
+		EC37626A279F0753003144C7 /* Inter-Regular.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC376261279F0753003144C7 /* Inter-Regular.ttf */; };
+		EC37626B279F0753003144C7 /* Inter-ExtraLight.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC376262279F0753003144C7 /* Inter-ExtraLight.ttf */; };
+		EC37626C279F0753003144C7 /* Inter-Light.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC376263279F0753003144C7 /* Inter-Light.ttf */; };
+		EC37626D279F0753003144C7 /* Inter-Bold.ttf in Resources */ = {isa = PBXBuildFile; fileRef = EC376264279F0753003144C7 /* Inter-Bold.ttf */; };
+		ECF31AE827BC4DF200994D3C /* ViewController2.xib in Resources */ = {isa = PBXBuildFile; fileRef = ECF31AE627BC4DF200994D3C /* ViewController2.xib */; };
+		ECF6532627A5A2E2001EFA5D /* LaunchAtLogin in Frameworks */ = {isa = PBXBuildFile; productRef = ECF6532527A5A2E2001EFA5D /* LaunchAtLogin */; };
+		ECF6532A27A6F9EA001EFA5D /* HotKey in Frameworks */ = {isa = PBXBuildFile; productRef = ECF6532927A6F9EA001EFA5D /* HotKey */; };
+/* End PBXBuildFile section */
+
+/* Begin PBXFileReference section */
+		EC37623F279C641D003144C7 /* Later.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Later.app; sourceTree = BUILT_PRODUCTS_DIR; };
+		EC376242279C641D003144C7 /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
+		EC376244279C641D003144C7 /* ViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ViewController.swift; sourceTree = "<group>"; };
+		EC376246279C641E003144C7 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; name = Assets.xcassets; path = Test/Assets.xcassets; sourceTree = SOURCE_ROOT; };
+		EC37624B279C641E003144C7 /* Test.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Test.entitlements; sourceTree = "<group>"; };
+		EC376251279C66F4003144C7 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist; path = Info.plist; sourceTree = "<group>"; };
+		EC376257279EF896003144C7 /* EventMonitor.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EventMonitor.swift; sourceTree = "<group>"; };
+		EC37625C279F0753003144C7 /* Inter-Thin.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Thin.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Thin.ttf"; sourceTree = "<group>"; };
+		EC37625D279F0753003144C7 /* Inter-SemiBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-SemiBold.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-SemiBold.ttf"; sourceTree = "<group>"; };
+		EC37625E279F0753003144C7 /* Inter-Medium.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-Medium.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-Medium.ttf"; sourceTree = "<group>"; };
+		EC37625F279F0753003144C7 /* Inter-ExtraBold.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "Inter-ExtraBold.ttf"; path = "../../../../../../Downloads/Inter (5)/static/Inter-ExtraBold.ttf"; sourceTree = "<group>"; };
+		EC376260279F0753003144C7 /* Inter-Black.ttf */ = {isa = PBXFileReference; lastKnownF
```

**File**: `xcode/Later.xcodeproj/project.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Workspace
+   version = "1.0">
+   <FileRef
+      location = "self:/Users/alyssax/Documents/Projects/Mac test/Test copy/Later.xcodeproj">
+   </FileRef>
+</Workspace>
```

**File**: `xcode/Later.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>IDEDidComputeMac32BitWarning</key>
+	<true/>
+</dict>
+</plist>
```

**File**: `xcode/Later.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>PreviewsEnabled</key>
+	<false/>
+</dict>
+</plist>
```

**File**: `xcode/Later.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+{
+  "pins" : [
+    {
+      "identity" : "hotkey",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/soffes/HotKey",
+      "state" : {
+        "branch" : "master",
+        "revision" : "c13662730cb5bc28de4a799854bbb018a90649bf"
+      }
+    },
+    {
+      "identity" : "launchatlogin",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/sindresorhus/LaunchAtLogin",
+      "state" : {
+        "branch" : "main",
+        "revision" : "e8171b3e38a2816f579f58f3dac1522aa39efe41"
+      }
+    }
+  ],
+  "version" : 2
+}
```

**File**: `xcode/Later.xcodeproj/project.xcworkspace/xcuserdata/alyssax.xcuserdatad/WorkspaceSettings.xcsettings` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>BuildLocationStyle</key>
+	<string>UseAppPreferences</string>
+	<key>CustomBuildLocationType</key>
+	<string>RelativeToDerivedData</string>
+	<key>DerivedDataLocationStyle</key>
+	<string>Default</string>
+	<key>IssueFilterStyle</key>
+	<string>ShowActiveSchemeOnly</string>
+	<key>LiveSourceIssuesEnabled</key>
+	<true/>
+	<key>ShowSharedSchemesAutomaticallyEnabled</key>
+	<true/>
+</dict>
+</plist>
```

**File**: `xcode/Later.xcodeproj/xcuserdata/alyssax.xcuserdatad/xcschemes/xcschememanagement.plist` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>SchemeUserState</key>
+	<dict>
+		<key>Later.xcscheme_^#shared#^_</key>
+		<dict>
+			<key>orderHint</key>
+			<integer>0</integer>
+		</dict>
+		<key>Test.xcscheme_^#shared#^_</key>
+		<dict>
+			<key>orderHint</key>
+			<integer>0</integer>
+		</dict>
+	</dict>
+</dict>
+</plist>
```

---

### Incident Patch 8: `9f808427` (2022-07-01)
**Commit Message**: Initial



#### Recent Merged Pull Requests:
- **PR #25** (closed): Ms/UI fixes (@hmms)
- **PR #24** (closed): Add custom app ignore list for session save/restore (@hmms)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
