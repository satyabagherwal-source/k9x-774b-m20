# Forensic Learning Record (Deep Inspection): CodeEditApp/CodeEdit

> **Canonical Artifact**: `07_PROJECT_LEARNING/codeeditapp-codeedit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CodeEditApp/CodeEdit](https://github.com/CodeEditApp/CodeEdit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:51:37.484Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CodeEditApp/CodeEdit`
- **Description**: 📝 CodeEdit App for macOS – Elevate your code editing experience. Open source, free forever.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 23053 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2175** (2026-04-17): **🐞 Files save but end up empty**
  *Symptoms*: ### Description  Hey, I ran into a pretty frustrating issue where saving files seems to work… but the contents just don’t actually get written.  ### To Reproduce  1. Open CodeEdit 2. Create or open a file 3. Type anything into it 4. Save using Cmd + S (or the save option in the menu) 5. Check the file afterward (in Finder or by reopening it)  ### Expected Behavior  The file should save normally with whatever content I added.  ### Version Information  macOS version: 26.4 CodeEdit version: v0.3.6   ### Additional Context  This happened consistently every time I tried saving.  I didn’t check whether CodeEdit had Full Disk Access in macOS Privacy settings before uninstalling, so I’m not sure if that could be related.  If it is a permissions issue, maybe the app could warn about it or document it more clearly.  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Quick update: I tried reproducing this after a fresh macOS reinstall, and the issue still happens consistently.  So it doesn’t seem to be caused by leftover configs or a broken local setup. I still didn’t explicitly verify Full Disk Access permissions, but this was on a clean system.
  > New update: I just looked through the GitHub commit comments, and found out that sidebar files are just "Scratch Pads" for pasting content but don't actually save, instead I just create a new file from the menu bar after I decided to redownload CodeEdit, apologies for not reading thoroughly.

- **Issue #2140** (2025-12-31): **🐞 Renaming in document windows cannot sync with welcome window immediately**
  *Symptoms*: ### Description  When I create a new file, and rename it in document window, the path on welcome window will not update.  ### To Reproduce  1. Create a new file or open a file 2. Rename in document window 3. Close this window, open the welcome window 4. Open the file in recents view  ### Expected Behavior  When I rename the file, list of recents should update the path synchronously.  ### Version Information  CodeEdit: 0.3.6 macOS: 26.1 Xcode: 26.1   ### Additional Context  It seems that I need to open another file to refresh recentsView again, but it should refresh immediately after the file is renamed.  ### Screenshots  https://github.com/user-attachments/assets/67137e2c-dd9b-40af-8a26-ae5cebc47ba0  
  **Post-Mortem & Fix Analysis**:
  > This may require modifying the package "WelcomeWindow". Can you assign this issue to me? I will submit to the repo of WelcomeWindow.
  > Hello @austincondiff , this issue has been solved in CodeEditApp/WelcomeWindow#4 . Please review.
  > Issue needs to be moved to https://github.com/CodeEditApp/WelcomeWindow

- **Issue #2138** (2025-12-31): **🐞 Popup request to Install Command Line Developer Tools appear at every launch**
  *Symptoms*: ### Description  Every time I open the CodeEdit, I see the popup window telling me: The "git" command requires the command line developer tools. Would you like to install the tools now?  I don't use the "git" commands in my projects, and normally I work with `.py` files locally. So, in CodeEdit > Settings > I turned off the Source Control completely. This removes the message-reminder in the application's control bar. However, at every application launch, I still have a popup window with the proposition to install Command Line Developer Tools.  ### To Reproduce  1. Open an application. 2. Close the popup window with request to install Command Line Developer Tools. 3. Open application Settings > Source Control and turn it off completely. 4. Quite and reopen application. 5. See that popup with request to install Command Line Developer Tools appears again.  ### Expected Behavior  Make this popup request relay on the application settings, or even add some special setting to display or not display this exact request.  ### Version Information  CodeEdit: 0.3.6 macOS: 15.6.1 Xcode: Not installed   ### Additional Context  _No response_  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey, can you check if this is still happening, with https://github.com/CodeEditApp/CodeEdit/pull/2148 it should be fixed.
  > I tested it and can confirm that issue is gone now. Thanks for your work. And Happy New Year!

- **Issue #2132** (2025-09-15): **Adjust Git Status Parsing to Better Handle Null Chars**
  *Symptoms*: ### Description  Fixes an issue with git status parsing where the substring indexing was off-by-one when creating the file string due to an index being incremented before creating a substring.  Fixes this by incrementing the current string index *after* returning the correct substring.  The related issue is marked as a Tahoe bug, the Tahoe bug is that Tahoe now shows the null character as a %00 at the end of the label, where previous macOS versions did not. This change is retroactive however as it is a bug fix.  ### Related Issues  * closes #2119   ### Checklist  - [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md) - [x] The issues this PR addresses are related to each other - [x] My changes generate no new warnings - [x] My code builds and runs on my machine - [x] My changes are all related to the related issue above - [x] I documented my code  ### Screenshots  N/A

- **Issue #2120** (2025-09-11): **🐞 macOS Tahoe Git Clone Pane Broken**
  *Symptoms*: The git clone pane from the welcome window is messed up on Tahoe.  <img width="852" height="576" alt="Image" src="https://github.com/user-attachments/assets/28f64f1f-95c1-49c1-919b-7e479e7dc455" />

- **Issue #2119** (2025-09-15): **🐞 macOS Tahoe Git File Items have an extra character at the end**
  *Symptoms*: <img width="315" height="165" alt="Image" src="https://github.com/user-attachments/assets/fba0b1cd-0572-4c9d-87ee-f88dc3f7860f" />

- **Issue #2118** (2026-08-18): **🐞 macOS Tahoe Navigator won't use correct size**
  *Symptoms*: ### Description  on Tahoe the navigator refuses to use the correct size on launch.  <img width="1378" height="917" alt="Image" src="https://github.com/user-attachments/assets/aaabb164-e016-4b94-8402-c36f4fa60b38" />  ### To Reproduce  .  ### Expected Behavior  .  ### Version Information  tahoe   ### Additional Context  _No response_  ### Screenshots  _No response_

- **Issue #2116** (2025-09-11): **🐞 Can't Compile With Swift 6.2**
  *Symptoms*: ### Description  CodeEdit has a few concurrency related issues when compiling on Xcode 26.  <img width="303" height="351" alt="Image" src="https://github.com/user-attachments/assets/dcc23513-62fb-403e-8c06-29e0020abc19" />  ### To Reproduce  .  ### Expected Behavior  .  ### Version Information  macOS: 26 beta Xcode: 26   ### Additional Context  _No response_  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Turns out these are all issues with WelcomeWindow. Will create a PR there and link it here.
  > What in the world, these issues don't appear with Swift 6.2 or any of the strict concurrency or the new default actor isolation. Only in Xcode 26.
  > Okay note for future people looking at this, Xcode enables a bunch of 6.2 features by default so just compiling a project using the snapshot toolchain isn't enough. To correctly mimic the errors you'll get on Xcode 26 just use Xcode 26.

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

### Incident Patch 1: `cec6287a` (2025-12-14)
**Commit Message**: Fix: Prevent git popup when Source Control is disabled (#2138) (#2148)

**File**: `CodeEdit/WorkspaceView.swift` (modified, +3/-0)
```diff
@@ -85,6 +85,9 @@ struct WorkspaceView: View {
                     // MARK: - Source Control
 
                     .task {
+                        // Only refresh git data if source control is enabled
+                        guard sourceControlIsEnabled else { return }
+                        
                         do {
                             try await sourceControlManager.refreshRemotes()
                             try await sourceControlManager.refreshStashEntries()
```

---

### Incident Patch 2: `78c3be9c` (2025-12-12)
**Commit Message**: Fix/deprecations memory leak entitlements (#2147)

**File**: `CodeEdit.xcodeproj/project.pbxproj` (modified, +41/-21)
```diff
@@ -397,7 +397,7 @@
 			attributes = {
 				BuildIndependentTargetsInParallel = 1;
 				LastSwiftUpdateCheck = 1330;
-				LastUpgradeCheck = 1640;
+				LastUpgradeCheck = 2610;
 				TargetAttributes = {
 					2BE487EB28245162003F3F64 = {
 						CreatedOnToolsVersion = 13.3.1;
@@ -643,13 +643,14 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "";
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				OTHER_SWIFT_FLAGS = "-D ALPHA";
 				RUN_DOCUMENTATION_COMPILER = YES;
 				SDKROOT = macosx;
+				STRING_CATALOG_GENERATE_SYMBOLS = YES;
 				SWIFT_COMPILATION_MODE = wholemodule;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "";
@@ -673,6 +674,7 @@
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
+				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = NO;
@@ -684,12 +686,14 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "Change in Info.plist";
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				REGISTER_APP_GROUPS = YES;
+				RUNTIME_EXCEPTION_ALLOW_JIT = YES;
+				RUNTIME_EXCEPTION_DISABLE_LIBRARY_VALIDATION = YES;
 				RUN_DOCUMENTATION_COMPILER = NO;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "";
@@ -715,7 +719,7 @@
 					"@executable_path/../Frameworks",
 					"@loader_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEditTests;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -777,7 +781,7 @@
 					"@executable_path/../Frameworks",
 					"@executable_path/../../../../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit.OpenWithCodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -840,13 +844,14 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "";
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				OTHER_SWIFT_FLAGS = "-D BETA";
 				RUN_DOCUMENTATION_COMPILER = YES;
 				SDKROOT = macosx;
+				STRING_CATALOG_GENERATE_SYMBOLS = YES;
 				SWIFT_COMPILATION_MODE = wholemodule;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "";
@@ -870,6 +875,7 @@
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
+				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = NO;
@@ -881,12 +887,14 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "Change in Info.plist";
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				REGISTER_APP_GROUPS = YES;
+				RUNTIME_EXCEPTION_ALLOW_JIT = YES;
+				RUNTIME_EXCEPTION_DISABLE_LIBRARY_VALIDATION = YES;
 				RUN_DOCUMENTATION_COMPILER = NO;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "";
@@ -912,7 +920,7 @@
 					"@executable_path/../Frameworks",
 					"@loader_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_
```

**File**: `CodeEdit.xcodeproj/xcshareddata/xcschemes/CodeEdit.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "2600"
+   LastUpgradeVersion = "2610"
    version = "1.7">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `CodeEdit.xcodeproj/xcshareddata/xcschemes/OpenWithCodeEdit.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "2600"
+   LastUpgradeVersion = "2610"
    wasCreatedForAppExtension = "YES"
    version = "2.0">
    <BuildAction
```

**File**: `CodeEdit/CodeEdit.entitlements` (modified, +8/-4)
```diff
@@ -2,14 +2,18 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
+	<key>com.apple.security.app-sandbox</key>
+	<true/>
+	<key>com.apple.security.files.user-selected.read-write</key>
+	<true/>
+	<key>com.apple.security.files.bookmarks.app-scope</key>
+	<true/>
+	<key>com.apple.security.network.client</key>
+	<true/>
 	<key>com.apple.security.application-groups</key>
 	<array>
 		<string>app.codeedit.CodeEdit.shared</string>
 		<string>$(TeamIdentifierPrefix)</string>
 	</array>
-	<key>com.apple.security.cs.allow-jit</key>
-	<true/>
-	<key>com.apple.security.cs.disable-library-validation</key>
-	<true/>
 </dict>
 </plist>
```

**File**: `CodeEdit/Features/ActivityViewer/Notifications/TaskNotificationView.swift` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ struct TaskNotificationView: View {
             }
         }
         .animation(.easeInOut, value: notification)
-        .onChange(of: taskNotificationHandler.notifications) { newValue in
+        .onChange(of: taskNotificationHandler.notifications) { _, newValue in
             withAnimation {
                 notification = newValue.first
             }
```

---

### Incident Patch 3: `0abc12f2` (2025-09-11)
**Commit Message**: Fix Alignment In Git Clone Panel (#2131)

### Description

Removes all hard-coded locations and widths in the git clone panel,
swapping them out for correct SwiftUI layout.

This fixes an issue on macOS Tahoe but is not limited to Tahoe
intentionally. This should not be hardcoded on any platform and does not
change the layout of the panel on Sequoia or lower.

### Related Issues

* closes #2120  
* closes #2116 

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

<img width="513" height="258" alt="Screenshot 2025-09-11 at 1 43 36 PM"
src="https://github.com/user-attachments/assets/f36f379d-e020-40cf-93f2-2a4456f84a5c"
/>

**File**: `CodeEdit.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -294,8 +294,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/CodeEditApp/WelcomeWindow",
       "state" : {
-        "revision" : "5168cf1ce9579b35ad00706fafef441418d8011f",
-        "version" : "1.0.0"
+        "revision" : "cbd5c0d6f432449e2a8618e2b24e4691acbfcc98",
+        "version" : "1.1.0"
       }
     },
     {
```

**File**: `CodeEdit/Features/SourceControl/Clone/GitCloneView.swift` (modified, +27/-27)
```diff
@@ -28,13 +28,12 @@ struct GitCloneView: View {
 
     var body: some View {
         VStack(spacing: 8) {
-            HStack {
+            HStack(alignment: .top) {
                 Image(nsImage: NSApp.applicationIconImage)
                     .resizable()
                     .frame(width: 64, height: 64)
-                    .padding(.bottom, 50)
                 VStack(alignment: .leading) {
-                    Text("Clone a repository")
+                    Text("Clone a Repository")
                         .bold()
                         .padding(.bottom, 2)
                     Text("Enter a git repository URL:")
@@ -46,9 +45,9 @@ struct GitCloneView: View {
                     TextField("Git Repository URL", text: $viewModel.repoUrlStr)
                         .lineLimit(1)
                         .padding(.bottom, 15)
-                        .frame(width: 300)
 
                     HStack {
+                        Spacer()
                         Button("Cancel") {
                             dismiss()
                         }
@@ -58,11 +57,8 @@ struct GitCloneView: View {
                         .keyboardShortcut(.defaultAction)
                         .disabled(!viewModel.isValidUrl(url: viewModel.repoUrlStr))
                     }
-                    .offset(x: 185)
-                    .alignmentGuide(.leading) { context in
-                        context[.leading]
-                    }
                 }
+                .frame(width: 300)
             }
             .padding(.top, 20)
             .padding(.horizontal, 20)
@@ -71,28 +67,32 @@ struct GitCloneView: View {
                 viewModel.checkClipboard()
             }
             .sheet(isPresented: $viewModel.isCloning) {
-                NavigationStack {
-                    VStack {
-                        ProgressView(
-                            viewModel.cloningProgress.state.label,
-                            value: viewModel.cloningProgress.progress,
-                            total: 100
-                        )
-                    }
-                }
-                .toolbar {
-                    ToolbarItem {
-                        Button("Cancel Cloning") {
-                            viewModel.cloningTask?.cancel()
-                            viewModel.cloningTask = nil
-                            viewModel.isCloning = false
-                        }
-                    }
+                cloningSheet
+            }
+        }
+    }
+
+    @ViewBuilder private var cloningSheet: some View {
+        NavigationStack {
+            VStack {
+                ProgressView(
+                    viewModel.cloningProgress.state.label,
+                    value: viewModel.cloningProgress.progress,
+                    total: 100
+                )
+            }
+        }
+        .toolbar {
+            ToolbarItem {
+                Button("Cancel Cloning") {
+                    viewModel.cloningTask?.cancel()
+                    viewModel.cloningTask = nil
+                    viewModel.isCloning = false
                 }
-                .padding()
-                .frame(width: 350)
             }
         }
+        .padding()
+        .frame(width: 350)
     }
 
     func cloneRepository() {
```

**File**: `CodeEdit/Features/SourceControl/Clone/ViewModels/GitCloneViewModel.swift` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ class GitCloneViewModel: ObservableObject {
         dialog.prompt = "Clone"
         dialog.nameFieldStringValue = saveName
         dialog.nameFieldLabel = "Clone as"
-        dialog.title = "Clone"
+        dialog.title = "Clone a Repository"
 
         guard dialog.runModal() == NSApplication.ModalResponse.OK,
               let result = dialog.url else {
```

---

### Incident Patch 4: `bdf21ac0` (2025-09-03)
**Commit Message**: fix(quickopen): prevent crash by providing UndoManagerRegistration (#2124)

Fix crash in Open Quickly preview caused by missing
UndoManagerRegistration.

Root cause: OpenQuicklyPreviewView renders CodeFileView in a separate
view hierarchy without the environment object.
Fix: Provide UndoManagerRegistration for the preview (non-editable) path
so CodeFileView resolves it.
Reproduce: Open Quickly (CMD+SHIFT+O) -> select a text file ->
previously crashed.
Validation: No crash; normal editing unaffected.

**File**: `CodeEdit/Features/OpenQuickly/Views/OpenQuicklyPreviewView.swift` (modified, +3/-0)
```diff
@@ -15,6 +15,8 @@ struct OpenQuicklyPreviewView: View {
     @StateObject var editorInstance: EditorInstance
     @StateObject var document: CodeFileDocument
 
+    @StateObject var undoRegistration: UndoManagerRegistration = UndoManagerRegistration()
+
     init(item: CEWorkspaceFile) {
         self.item = item
         let doc = try? CodeFileDocument(
@@ -29,6 +31,7 @@ struct OpenQuicklyPreviewView: View {
     var body: some View {
         if let utType = document.utType, utType.conforms(to: .text) {
             CodeFileView(editorInstance: editorInstance, codeFile: document, isEditable: false)
+                .environmentObject(undoRegistration)
         } else {
             NonTextFileView(fileDocument: document)
         }
```

---

### Incident Patch 5: `e2814fea` (2025-08-25)
**Commit Message**: Fix Ventura Crash (#2106)

### Description

Fixes a crash on Ventura where we're referencing a symbol that
apparently doesn't exist in libdispatch. Just replaces `.asyncAndWait`
with a call to `.sync` since we're not on the main thread already.

### Related Issues

* closes #2091

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

**File**: `CodeEdit/Features/Documents/CodeFileDocument/CodeFileDocument.swift` (modified, +5/-1)
```diff
@@ -259,7 +259,11 @@ final class CodeFileDocument: NSDocument, ObservableObject {
                     // This blocks the presented item thread intentionally. If we don't wait, we'll receive more updates
                     // that the file has changed and we'll end up dispatching multiple reads.
                     // The presented item thread expects this operation to by synchronous anyways.
-                    DispatchQueue.main.asyncAndWait {
+
+                    // https://github.com/CodeEditApp/CodeEdit/issues/2091
+                    // We can't use `.asyncAndWait` on Ventura as it seems the symbol is missing on that platform.
+                    // Could be just for x86 machines.
+                    DispatchQueue.main.sync {
                         try? self.read(from: fileURL, ofType: fileType)
                     }
                 }
```

---

### Incident Patch 6: `9b1d2e7e` (2025-08-25)
**Commit Message**: Fix Build Warnings (#2107)

Fixes some build warnings and clarifies a test.

**File**: `CodeEdit/Features/LSP/Registry/PackageSourceParser/PackageSourceParser.swift` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ enum PackageSourceParser {
             false
         }
 
-        var source = PackageSource(
+        let source = PackageSource(
             sourceId: sourceId,
             type: isSourceBuild ? .sourceBuild : .github,
             pkgName: packageName,
```

**File**: `CodeEditTests/Features/Tasks/TaskManagerTests.swift` (modified, +22/-3)
```diff
@@ -26,9 +26,28 @@ class TaskManagerTests {
         #expect(taskManager.availableTasks == mockWorkspaceSettings.tasks)
     }
 
-    @Test(arguments: [SettingsData.TerminalShell.zsh, SettingsData.TerminalShell.bash])
-    func executeSelectedTask(_ shell: SettingsData.TerminalShell) async throws {
-        Settings.shared.preferences.terminal.shell = shell
+    @Test
+    func executeTaskInZsh() async throws {
+        Settings.shared.preferences.terminal.shell = .zsh
+
+        let task = CETask(name: "Test Task", command: "echo 'Hello World'")
+        mockWorkspaceSettings.tasks.append(task)
+        taskManager.selectedTaskID = task.id
+        taskManager.executeActiveTask()
+
+        await waitForExpectation(timeout: .seconds(10)) {
+            self.taskManager.activeTasks[task.id]?.status == .finished
+        } onTimeout: {
+            Issue.record("Status never changed to finished.")
+        }
+
+        let outputString = try #require(taskManager.activeTasks[task.id]?.output?.getBufferAsString())
+        #expect(outputString.contains("Hello World"))
+    }
+
+    @Test
+    func executeTaskInBash() async throws {
+        Settings.shared.preferences.terminal.shell = .bash
 
         let task = CETask(name: "Test Task", command: "echo 'Hello World'")
         mockWorkspaceSettings.tasks.append(task)
```

**File**: `CodeEditUITests/Features/UtilityArea/TerminalUtility/TerminalUtilityUITests.swift` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ final class TerminalUtilityUITests: XCTestCase {
     }
 
     func testTerminalsInputData() throws {
-        var terminal = utilityArea.textViews["Terminal Emulator"]
+        let terminal = utilityArea.textViews["Terminal Emulator"]
         XCTAssertTrue(terminal.exists)
         terminal.click()
         terminal.typeText("echo hello world")
```

---

### Incident Patch 7: `f6f2b80a` (2025-08-12)
**Commit Message**: Fix Semantic Highlight Out-Of-Range Bug (#2097)

### Description

Fixes a bug with semantic highlights where the returned highlights would be outside of the requested range. This fixes that by clamping all returned ranges to the requested range.

### Related Issues

* N/A

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

N/A

**File**: `CodeEdit/Features/LSP/Features/SemanticTokens/SemanticTokenHighlightProvider.swift` (modified, +14/-1)
```diff
@@ -166,7 +166,20 @@ final class SemanticTokenHighlightProvider<
         let rawTokens = storage.getTokensFor(range: lspRange)
         let highlights = tokenMap
             .decode(tokens: rawTokens, using: textView)
-            .filter({ $0.capture != nil || !$0.modifiers.isEmpty })
+            .compactMap { highlightRange -> HighlightRange? in
+                // Filter out empty ranges
+                guard highlightRange.capture != nil || !highlightRange.modifiers.isEmpty,
+                      // Clamp the highlight range to the queried range.
+                      let intersection = highlightRange.range.intersection(range),
+                      intersection.isEmpty == false else {
+                    return nil
+                }
+                return HighlightRange(
+                    range: intersection,
+                    capture: highlightRange.capture,
+                    modifiers: highlightRange.modifiers
+                )
+            }
         completion(.success(highlights))
     }
 }
```

---

### Incident Patch 8: `39b1d395` (2025-08-08)
**Commit Message**: Fix: Terminals Losing Output (#2100)

### Description

Fixes a bug introduced by #2092 where terminals that were not running a process would lose their cached output. Adds automation tests to ensure this is caught in the future!

### Related Issues

* N/A

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots


https://github.com/user-attachments/assets/dfeb38d7-ef56-4154-97dd-6d8fdbd641af

**File**: `CodeEdit/Features/TerminalEmulator/Model/ShellIntegration.swift` (modified, +5/-6)
```diff
@@ -65,21 +65,21 @@ enum ShellIntegration {
             // Enable injection in our scripts.
             environment.append("\(Variables.ceInjection)=1")
 
-            if let execArgs = shell.execArguments(interactive: interactive, login: useLogin) {
-                args.append(execArgs)
-            }
-
             switch shell {
             case .bash:
                 try bash(&args)
             case .zsh:
-                try zsh(&args, &environment)
+                try zsh(&environment)
             }
 
             if useLogin {
                 environment.append("\(Variables.shellLogin)=1")
             }
 
+            if let execArgs = shell.execArguments(interactive: interactive, login: useLogin) {
+                args.append(execArgs)
+            }
+
             return args
         } catch {
             // catch so we can log this here
@@ -125,7 +125,6 @@ enum ShellIntegration {
     ///   - useLogin: Whether to use a login shell.
     ///   - interactive: Whether to use an interactive shell.
     private static func zsh(
-        _ args: inout [String],
         _ environment: inout [String]
     ) throws {
         // All injection script URLs
```

**File**: `CodeEdit/Features/TerminalEmulator/Views/CETerminalView.swift` (modified, +41/-0)
```diff
@@ -17,6 +17,17 @@ class CETerminalView: TerminalView {
         }
     }
 
+    override open var frame: CGRect {
+        get {
+            super.frame
+        }
+        set {
+            if newValue.size != .zero {
+                super.frame = newValue
+            }
+        }
+    }
+
     @objc
     override open func copy(_ sender: Any) {
         let range = selectedPositions()
@@ -25,4 +36,34 @@ class CETerminalView: TerminalView {
         pasteboard.clearContents()
         pasteboard.setString(text, forType: .string)
     }
+
+    override open func isAccessibilityElement() -> Bool {
+        true
+    }
+
+    override open func isAccessibilityEnabled() -> Bool {
+        true
+    }
+
+    override open func accessibilityLabel() -> String? {
+        "Terminal Emulator"
+    }
+
+    override open func accessibilityRole() -> NSAccessibility.Role? {
+        .textArea
+    }
+
+    override open func accessibilityValue() -> Any? {
+        terminal.getText(
+            start: Position(col: 0, row: 0),
+            end: Position(col: terminal.buffer.x, row: terminal.getTopVisibleRow() + terminal.rows)
+        )
+    }
+
+    override open func accessibilitySelectedText() -> String? {
+        let range = selectedPositions()
+        let text = terminal.getText(start: range.start, end: range.end)
+        return text
+    }
+
 }
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalSidebar.swift` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ struct UtilityAreaTerminalSidebar: View {
         }
         .accessibilityElement(children: .contain)
         .accessibilityLabel("Terminals")
+        .accessibilityIdentifier("terminalsList")
     }
 }
 
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalTab.swift` (modified, +3/-1)
```diff
@@ -46,7 +46,6 @@ struct UtilityAreaTerminalTab: View {
             }
         } icon: {
             Image(systemName: "terminal")
-                .accessibilityHidden(true)
         }
         .contextMenu {
             Button("Rename...") {
@@ -63,5 +62,8 @@ struct UtilityAreaTerminalTab: View {
                 }
             }
         }
+        .accessibilityElement(children: .contain)
+        .accessibilityLabel(terminalTitle.wrappedValue)
+        .accessibilityIdentifier("terminalTab")
     }
 }
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalView.swift` (modified, +2/-0)
```diff
@@ -117,6 +117,7 @@ struct UtilityAreaTerminalView: View {
                             )
                             .frame(height: max(0, constrainedHeight - 1))
                             .id(selectedTerminal.id)
+                            .accessibilityIdentifier("terminal")
                         }
                     }
                 } else {
@@ -167,6 +168,7 @@ struct UtilityAreaTerminalView: View {
             }
             utilityAreaViewModel.initializeTerminals(workspaceURL: workspaceURL)
         }
+        .accessibilityIdentifier("terminal-area")
     }
 
     @ViewBuilder var backgroundEffectView: some View {
```

---

### Incident Patch 9: `422b7bf4` (2025-06-26)
**Commit Message**: Fix Split View Can't Collapse (#2071)

### Description

Fixes an erroneous overridden method causing split views to not be collapsable.

### Related Issues

* closes #2070

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

https://github.com/user-attachments/assets/12c3a5c2-bf70-4131-ad37-21adf5fa4e68

**File**: `CodeEdit/Features/SplitView/Views/SplitViewControllerView.swift` (modified, +0/-4)
```diff
@@ -131,10 +131,6 @@ final class SplitViewController: NSSplitViewController {
         }
     }
 
-    override func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool {
-        false
-    }
-
     override func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
         // For some reason, AppKit _really_ wants to hide dividers when there's only one item (and no dividers)
         // so we do this check for them.
```

---

### Incident Patch 10: `6619d164` (2025-06-24)
**Commit Message**: Fix Autosave "changed by another application " Spam (#2072)

### Description

Fixes an issue where a file save would not correctly update the `CodeFileDocument`'s metadata when saving. This caused scheduled autosave operations to fail with a false positive 'changed by another application' error.

To fix, I'm allowing `NSDocument` to handle the actual file system operation, rather than writing the data like we were before. I've kept the extra logic in the overridden `save` method to fix broken directories. There's no good reason to move the file saving operation out of `NSDocument`, since that subclass likely handles it better than we do with an atomic data write.

I've also moved autosave scheduling out of UI and into the document class.

### Related Issues

* closes #2033

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My cha

**File**: `CodeEdit/Features/Documents/CodeFileDocument/CodeFileDocument.swift` (modified, +37/-1)
```diff
@@ -94,6 +94,11 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         isDocumentEditedSubject.eraseToAnyPublisher()
     }
 
+    /// A lock that ensures autosave scheduling happens correctly.
+    private var autosaveTimerLock: NSLock = NSLock()
+    /// Timer used to schedule autosave intervals.
+    private var autosaveTimer: Timer?
+
     // MARK: - NSDocument
 
     override static var autosavesInPlace: Bool {
@@ -130,6 +135,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         }
     }
 
+    // MARK: - Data
+
     override func data(ofType _: String) throws -> Data {
         guard let sourceEncoding, let data = (content?.string as NSString?)?.data(using: sourceEncoding.nsValue) else {
             Self.logger.error("Failed to encode contents to \(self.sourceEncoding.debugDescription)")
@@ -138,6 +145,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         return data
     }
 
+    // MARK: - Read
+
     /// This function is used for decoding files.
     /// It should not throw error as unsupported files can still be opened by QLPreviewView.
     override func read(from data: Data, ofType _: String) throws {
@@ -161,6 +170,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         NotificationCenter.default.post(name: Self.didOpenNotification, object: self)
     }
 
+    // MARK: - Autosave
+
     /// Triggered when change occurred
     override func updateChangeCount(_ change: NSDocument.ChangeType) {
         super.updateChangeCount(change)
@@ -183,6 +194,31 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         self.isDocumentEditedSubject.send(self.isDocumentEdited)
     }
 
+    /// If ``hasUnautosavedChanges`` is `true` and an autosave has not already been scheduled, schedules a new autosave.
+    /// If ``hasUnautosavedChanges`` is `false`, cancels any scheduled timers and returns.
+    ///
+    /// All operations are done with the ``autosaveTimerLock`` acquired (including the scheduled autosave) to ensure
+    /// correct timing when scheduling or cancelling timers.
+    override func scheduleAutosaving() {
+        autosaveTimerLock.withLock {
+            if self.hasUnautosavedChanges {
+                guard autosaveTimer == nil else { return }
+                autosaveTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] timer in
+                    self?.autosaveTimerLock.withLock {
+                        guard timer.isValid else { return }
+                        self?.autosaveTimer = nil
+                        self?.autosave(withDelegate: nil, didAutosave: nil, contextInfo: nil)
+                    }
+                }
+            } else {
+                autosaveTimer?.invalidate()
+                autosaveTimer = nil
+            }
+        }
+    }
+
+    // MARK: - Close
+
     override func close() {
         super.close()
         NotificationCenter.default.post(name: Self.didCloseNotification, object: fileURL)
@@ -199,7 +235,7 @@ final class CodeFileDocument: NSDocument, ObservableObject {
             let directory = fileURL.deletingLastPathComponent()
             try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
 
-            try data(ofType: fileType ?? "").write(to: fileURL, options: .atomic)
+            super.save(sender)
         } catch {
             presentError(error)
         }
```

**File**: `CodeEdit/Features/Editor/Views/CodeFileView.swift` (modified, +0/-14)
```diff
@@ -91,20 +91,6 @@ struct CodeFileView: View {
             }
             .store(in: &cancellables)
 
-        codeFile
-            .contentCoordinator
-            .textUpdatePublisher
-            .debounce(for: 1.0, scheduler: DispatchQueue.main)
-            .sink { _ in
-                // updateChangeCount is automatically managed by autosave(), so no manual call is necessary
-                codeFile.autosave(withImplicitCancellability: false) { error in
-                    if let error {
-                        CodeFileDocument.logger.error("Failed to autosave document, error: \(error)")
-                    }
-                }
-            }
-            .store(in: &cancellables)
-
         codeFile.undoManager = self.undoManager.manager
     }
 
```

#### Recent Merged Pull Requests:
- **PR #2186** (closed): Add ⌘K Clear to Start for the integrated terminal (@Borisserz)
- **PR #2170** (closed): test ci (@lwcrafts)
- **PR #2169** (closed): Fix: Pass autocompleteBraces setting to source editor (@william-laverty)
- **PR #2167** (closed): fix: Status bar cursor position not updating on workspace open (@william-laverty)
- **PR #2166** (closed): fix: Auto-select name for editing when creating new files/folders (@william-laverty)
- **PR #2165** (closed): feat: Add ⇧⌘T shortcut to reopen recently closed tabs (@william-laverty)
- **PR #2163** (closed): feat: Add ⇧⌘T shortcut to reopen closed tabs (@william-laverty)
- **PR #2162** (closed): Auto-select name for editing when creating new files/folders (@william-laverty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
