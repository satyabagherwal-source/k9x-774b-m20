# Forensic Learning Record (Deep Inspection): XcodesOrg/XcodesApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/xcodesorg-xcodesapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/XcodesOrg/XcodesApp](https://github.com/XcodesOrg/XcodesApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:03:02.916Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `XcodesOrg/XcodesApp`
- **Description**: The easiest way to install and switch between multiple versions of Xcode - with a mouse click. 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8583 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `com.xcodesorg.xcodesapp.Helper/AuditTokenHack.h`
```
// From https://github.com/securing/SimpleXPCApp/

#import <Foundation/Foundation.h>

@interface NSXPCConnection(PrivateAuditToken)

@property (nonatomic, readonly) audit_token_t auditToken;

@end


@interface AuditTokenHack : NSObject

+(NSData *)getAuditTokenDataFromNSXPCConnection:(NSXPCConnection *)connection;

@end

```

### Core Architecture Module: `com.xcodesorg.xcodesapp.Helper/com.xcodesorg.xcodesapp.Helper-Bridging-Header.h`
```
#import "AuditTokenHack.h"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #852** (2026-09-14): **Homebrew Install Fails**
  *Symptoms*: **Describe the bug** Installing the application via homebrew results in an error. It appears to be a 404 when homebrew is looking for the package update. The url it is looking for is `https://github.com/XcodesOrg/XcodesApp/releases/download/v4.1.0b40/Xcodes.zip`.  Error log:  ``` ==> Upgrading 1 outdated package: xcodes-app 4.0.5b40 -> 4.1.0b40 ==> Fetching downloads for: xcodes-app ✘ Cask xcodes-app (4.1.0b40) Error: Download failed on Cask 'xcodes-app' with message: Download failed: https://github.com/XcodesOrg/XcodesApp/releases/download/v4.1.0b40/Xcodes.zip curl: (56) The requested URL returned error: 404 Error: xcodes-app: Download failed for xcodes-app ```  **To Reproduce** Install / upgrade to the latest version via homebrew.  **Expected behavior** The app is installed/updated successfully.  **Screenshots** N/A  **Version**  - OS: MacOS 27.0  - Xcodes: Not latest 
  **Post-Mortem & Fix Analysis**:
  > sorry I had to change version numbers as I forgot to bump the build number. Homebrew should clean itself up and create a new update automatically in a few hours.   Work around is to download and override your app. or manually check for updates inside of the app. 
  > All good - I did upgrade using another method, I just wanted to make sure you were aware. Thanks!
  > will be updated when https://github.com/Homebrew/homebrew-cask/pull/287152 gets merged in. 

- **Issue #850** (2026-09-14): **404 error when logging in**
  *Symptoms*: **Describe the bug** I can't sign in with my Apple ID. The UI shows a 404 error.  The bug is reproducible on multiple Macs.  It appears that the app is sending this request: curl -H "Host: appstoreconnect.apple.com" -H "accept: */*" -H "user-agent: Xcodes/40 CFNetwork/3860.700.1 Darwin/25.6.0" -H "priority: u=3" -H "accept-language: en-AU,en;q=0.9" "https://appstoreconnect.apple.com/olympus/v1/app/config?hostname=itunesconnect.apple.com"  And the response is: ``` :status: 404 server: daiquiri/5 content-type: text/html;charset=iso-8859-1 content-length: 423 x-apple-jingle-correlation-key: PXHDW3KFKQMATY7U7J2TFEIUFI x-apple-request-uuid: 7dce3b6d-4554-1809-e3f4-fa753291142a b3: 7dce3b6d45541809e3f4fa753291142a-f4f1efe94def0e45 x-b3-traceid: 7dce3b6d45541809e3f4fa753291142a x-b3-spanid: f4f1efe94def0e45 apple-seq: 0.0 apple-tk: false apple-originating-system: UnknownOriginatingSystem x-responding-instance: olympus-rest:20413:mr00p00it-vmolympusrest023:9004:26L37 cache-control: must-revalidate,no-cache,no-store strict-transport-security: max-age=31536000; includeSubDomains; preload x-daiquiri-instance: daiquiri:15751002:mr36p00it-hyhk09154801:7987:26RELEASE153:daiquiri-amp-dsce-asc-int-002-mr x-daiquiri-debug-worker-pid: 32418 x-frame-options: SAMEORIGIN x-xss-protection: 1; mode=block x-content-type-options: nosniff x-content-security-policy: script-src 'self' *.apple.com x-daiquiri-instance: daiquiri:18493001:mr85p00it-hyhk03154801:7987:26RELEASE153:daiquiri-amp-all-shared-ext-
  **Post-Mortem & Fix Analysis**:
  > Root cause and a fix: Apple stopped serving `olympus/v1/app/config`, which `XcodesLoginKit` uses to fetch the `X-Apple-Widget-Key`. `Client.fetchServiceKey` has no fallback, so the 404 surfaces before any credentials are sent — it is unrelated to account or password state.  The rest of olympus is fine (`/olympus/v1/session` still returns `401 Unauthenticated`), and `federate`, `signin/init` and `signin/complete` all still return JSON. Only `app/config` is gone, and changing `hostname` does not help.  The same key is still embedded as `widgetKey` in the Developer portal sign-in page. Reading it from there restores sign-in: I built the `xcodes` CLI with that change, signed in with 2FA, and installed Xcode 27.0 RC end to end.  PR against XcodesLoginKit: XcodesOrg/XcodesLoginKit#5  Note this affects the GUI app too, since 4.0.5 depends on the same code path. 
  > Having the same issue. Looking forward to fix release!
  > Should release a fix version quickly. Completely unavailable now

- **Issue #826** (2026-06-30): **Uninstalling a non-existent Xcode crashes the app (EXC_BREAKPOINT)**
  *Symptoms*: **Describe the bug** Uninstalling a non-existent Xcode crashes the app  **To Reproduce** Rename or remove an Xcode app in Finder and then uninstall it in Xcodes  **Expected behavior** A warning and/or a installation status reset  **Screenshots** N/A  **Version**  - OS: macOS 27  - Xcodes: 4.0.3  ``` ------------------------------------- Translated Report (Full Report Below) ------------------------------------- Process:             Xcodes [59066] Path:                /Applications/Xcodes.app/Contents/MacOS/Xcodes Identifier:          com.xcodesorg.xcodesapp Version:             4.0.3 (38) Code Type:           ARM-64 (Native) Role:                Foreground Parent Process:      launchd [1] Coalition:           com.xcodesorg.xcodesapp [9516] User ID:             501  Date/Time:           2026-06-27 22:41:21.4915 +0800 Launch Time:         2026-06-27 22:40:20.8889 +0800 Hardware Model:      Mac16,1 OS Version:          macOS 27.0 (26A5368g) Release Type:        User  Crash Reporter Key:  B1F6FA27-9FBA-8B53-D12E-894644291A66 Incident Identifier: F4C08090-AE18-45C2-AA78-B6783804E40A  Time Awake Since Boot: 160000 seconds  System Integrity Protection: disabled  Triggered by Thread: 0, Dispatch Queue: com.apple.main-thread  Exception Type:    EXC_BREAKPOINT (SIGTRAP) Exception Codes:   0x0000000000000001, 0x00000001040a5708  Termination Reason:  Namespace SIGNAL, Code 5, Trace/BPT trap: 5 Terminating Process: exc handler [59066]   Thread 0 Crashed::  Dispatch queue: com.apple.main-t

- **Issue #822** (2026-06-30): **notifications during downloading**
  *Symptoms*: **Describe the bug** During downloading, I am getting repeated notifications that xcodex is downloading an xcode version.   **To Reproduce** download an xcode verison  **Expected behavior** one notification that indicates the app is downloading an app.   **Screenshots** See the screenrecording below. it shows part of the many  notifications I received.   https://github.com/user-attachments/assets/d0e3323e-e495-4f89-ae23-a46c26d2ad16     **Version**  - OS: 26.5.1  - Xcodes: Version 4.0.3 (38) 
  **Post-Mortem & Fix Analysis**:
  > https://github.com/XcodesOrg/XcodesApp/pull/821
  > When are we getting a new release to stop this from happening? It is SO annoying. Especially during the summer when there are a lot of betas.
  > Please release this! :D 

- **Issue #817** (2026-06-15): **Update error when updating within Xcodes 3.0.2**
  *Symptoms*: **Describe the bug** After checking for updates, downloading the update, extracting progresses to 100%, stalls, then update error is presented.   This may be fixed in the latest version, but I had to download it manually.  **To Reproduce** Steps to reproduce the behavior: * Click 'Check for updates' * 'Install now' > Update error after download/extracting  **Expected behavior** The download succeeds, installs, and Xcodes relaunches  **Screenshots** <img width="321" height="310" alt="Image" src="https://github.com/user-attachments/assets/e21adf44-1d78-42d4-b4a9-8f10629513aa" />  **Version**  - OS: Tahoe 26.5  - Xcodes: 3.0.2 
  **Post-Mortem & Fix Analysis**:
  > Hey @cwalo if you install it manually again from https://github.com/XcodesOrg/XcodesApp/releases does it work again? 
  > Yep, seems to work with the latest version 👍 

- **Issue #815** (2026-06-13): **Crash upon launch on Mac OS 27 developer beta 1**
  *Symptoms*: **Describe the bug** Xcodes 4.0.2 crashes when it is launched on Mac OS 27 developer beta 1.  **To Reproduce** 1. Launch Xcodes 4.0.2 from any places (Application folder, Spotlight etc.) 2. Crash immediately with Problem Report screen from Mac OS  **Expected behavior** 1. App launches successfully  **Screenshots** <img width="1112" height="912" alt="Image" src="https://github.com/user-attachments/assets/b43bd54f-d4a0-4739-8def-c96b06eb4c3c" />  **Stack trace** [trace.txt](https://github.com/user-attachments/files/28725224/trace.txt)  **Version**  - OS: 27 DB1  - Xcodes: 4.0.2 
  **Post-Mortem & Fix Analysis**:
  > Not even a few hours in!  @xavier114fch  I probably won't even look at it till at least next beta unfortunately. I've been burnt before trying to fix too early where they fix by the next beta. 
  > until then, [xcodes-cli](https://github.com/XcodesOrg/xcodes) is working just fine
  > @bennettp123 that's only if you have it already installed, right? Because I can't install it using brew. ``` Error: You are using macOS 27. We do not provide support for this pre-release version. ```

- **Issue #814** (2026-06-13): **Constant notifications while downloading Xcode**
  *Symptoms*: **Describe the bug** While downloading an Xcode version, I get a new notification every half second like this: ``` 26.26.6 Release candidate (2/7) Downloading ```  As you can see, the version number is incorrect as well.  (Maybe the notification was accidentally tied to the download progress bar change signal?)  **To Reproduce** 1. Select "Apple" as datasource 2. Click "install" on 26.6 Release candidate in list view  **Expected behavior** One notification when download starts  **Screenshots**  <img width="349" height="902" alt="Image" src="https://github.com/user-attachments/assets/322e0acb-6b76-4acd-a514-b90df284f19b" />  **Version**  - OS: macOS 26.5.1  - Xcodes: 4.0.2 
  **Post-Mortem & Fix Analysis**:
  > Same here

- **Issue #812** (2026-06-08): **Crash on launch Xcodes 4.0.1**
  *Symptoms*: Crashlog: [Xcodes-2026-06-08-085907.txt](https://github.com/user-attachments/files/28696939/Xcodes-2026-06-08-085907.txt)  **Describe the bug** App crashes on launch  **To Reproduce** Update or download latest version from github and run the app  **Expected behavior** app launches without crashing  **Screenshots** n/a  **Version**  - OS: 26.5.1  - Xcodes: 4.0.1 
  **Post-Mortem & Fix Analysis**:
  > Same problem
  > Same. My log is here: [https://gist.github.com/rocxteady/0b8d7fdae2803aee851cc877736f80ba](url)
  > I couldn't duplicate on my machines - but ran the crash logs through codex and it came up with something. If somebody could run the branch locally to confirm, that would be amazing.     

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

### Incident Patch 1: `b6d68e7e` (2026-09-12)
**Commit Message**: chore: update xcodesKit and LoginKit to latest. minor fixes

**File**: `Xcodes.xcodeproj/project.pbxproj` (modified, +3/-3)
```diff
@@ -7,6 +7,7 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		14d2f5a1273f6c350cad4406 /* NewVersionNotificationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */; };
 		15F5B8902CCF09B900705E2F /* CryptoKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 15F5B88F2CCF09B900705E2F /* CryptoKit.framework */; };
 		3328073F2CA5E2C80036F691 /* SignInSecurityKeyPinView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3328073E2CA5E2C80036F691 /* SignInSecurityKeyPinView.swift */; };
 		332807412CA5EA820036F691 /* SignInSecurityKeyTouchView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 332807402CA5EA820036F691 /* SignInSecurityKeyTouchView.swift */; };
@@ -31,7 +32,6 @@
 		BDBAB7452B9FF55800694B0B /* TrailingIconLabelStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = BDBAB7442B9FF55800694B0B /* TrailingIconLabelStyle.swift */; };
 		CA11E7BA2598476C00D2EE1C /* XcodeCommands.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA11E7B92598476C00D2EE1C /* XcodeCommands.swift */; };
 		CA2518EC25A7FF2B00F08414 /* AppStateUpdateTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA2518EB25A7FF2B00F08414 /* AppStateUpdateTests.swift */; };
-		14d2f5a1273f6c350cad4406 /* NewVersionNotificationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */; };
 		CA378F992466567600A58CE0 /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA378F982466567600A58CE0 /* AppState.swift */; };
 		CA39711924495F0E00AFFB77 /* AppStoreButtonStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA39711824495F0E00AFFB77 /* AppStoreButtonStyle.swift */; };
 		CA42DD7325AEB04300BC0B0C /* Logger.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA42DD7225AEB04300BC0B0C /* Logger.swift */; };
@@ -194,6 +194,7 @@
 		536CFDD3263C9A8000026CE0 /* XcodesSheet.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = XcodesSheet.swift; sourceTree = "<group>"; };
 		53CBAB2B263DCC9100410495 /* XcodesAlert.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = XcodesAlert.swift; sourceTree = "<group>"; };
 		63EAA4EA259944450046AB8F /* ProgressButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ProgressButton.swift; sourceTree = "<group>"; };
+		884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NewVersionNotificationTests.swift; sourceTree = "<group>"; };
 		9DD4FFCA2B13EC1800C974F1 /* Localizable.xcstrings */ = {isa = PBXFileReference; lastKnownFileType = text.json.xcstrings; path = Localizable.xcstrings; sourceTree = "<group>"; };
 		B0403CEF2AD92D7B00137C09 /* ReleaseNotesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReleaseNotesView.swift; sourceTree = "<group>"; };
 		B0403CF12AD934B600137C09 /* CompatibilityView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CompatibilityView.swift; sourceTree = "<group>"; };
@@ -209,7 +210,6 @@
 		BDBAB7442B9FF55800694B0B /* TrailingIconLabelStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TrailingIconLabelStyle.swift; sourceTree = "<group>"; };
 		CA11E7B92598476C00D2EE1C /* XcodeCommands.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = XcodeCommands.swift; sourceTree = "<group>"; };
 		CA2518EB25A7FF2B00F08414 /* AppStateUpdateTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppStateUpdateTests.swift; sourceTree = "<group>"; };
-		884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NewVersionNotificationTests.swift; sourceTree = "<group>"; };
 		CA378F982466567600A58CE0 /* AppState.swift */ = {i
```

**File**: `Xcodes.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +5/-5)
```diff
@@ -51,8 +51,8 @@
         "repositoryURL": "https://github.com/kinoroy/LibFido2Swift",
         "state": {
           "branch": null,
-          "revision": "b87a93300c5b35307c9f26ae490963196bd927f1",
-          "version": "0.1.5"
+          "revision": "ac8596a852e2b008c5902a521cf4d9c7f0f05fba",
+          "version": "0.1.6"
         }
       },
       {
@@ -123,16 +123,16 @@
         "repositoryURL": "https://github.com/XcodesOrg/XcodesKit",
         "state": {
           "branch": null,
-          "revision": "a9e5d7d701f20f1385071851319cdaecccc9f1e8",
-          "version": "1.0.4"
+          "revision": "4d3c6093980978b74c3fa42fc1b90cd1c34ac911",
+          "version": "1.1.0"
         }
       },
       {
         "package": "XcodesLoginKit",
         "repositoryURL": "https://github.com/XcodesOrg/XcodesLoginKit",
         "state": {
           "branch": "main",
-          "revision": "9bece1ada36006b18b84caec62d14dc91b47ae2b",
+          "revision": "929f9aac3140caf7b64cbb5385f4f645c5f9913d",
           "version": null
         }
       },
```

**File**: `Xcodes/Backend/AppState.swift` (modified, +23/-2)
```diff
@@ -249,6 +249,9 @@ class AppState: ObservableObject {
         }
         setupAutoInstallTimer()
         setupDefaults()
+        startAuthenticationTask {
+            try await self.restoreAuthenticationStateIfNeeded()
+        }
     }
 
     func setupDefaults() {
@@ -286,13 +289,19 @@ class AppState: ObservableObject {
         ).validateADCSession(path: path)
     }
 
-    func validateSessionAsync() async throws {
+    @discardableResult
+    func validateSessionAsync() async throws -> AuthenticationState {
         try await Current.network.validateSessionAsync()
     }
 
     func signInIfNeededAsync() async throws {
         do {
-            try await validateSessionAsync()
+            let authenticationState = try await validateSessionAsync()
+            try Task.checkCancellation()
+            self.authenticationState = authenticationState
+            handleAuthenticationFlowSuccess()
+        } catch is CancellationError {
+            throw CancellationError()
         } catch {
             guard
                 let username = savedUsername,
@@ -305,6 +314,11 @@ class AppState: ObservableObject {
         }
     }
 
+    func restoreAuthenticationStateIfNeeded() async throws {
+        guard hasSavedUsername else { return }
+        try await signInIfNeededAsync()
+    }
+
     func signIn(username: String, password: String?) {
         authError = nil
         startAuthenticationTask {
@@ -681,6 +695,10 @@ class AppState: ObservableObject {
     func uninstall(xcode: Xcode) {
         guard let installedXcodePath = xcode.installedPath else { return }
 
+        if let index = allXcodes.firstIndex(where: { $0.id == xcode.id }) {
+            allXcodes[index].installState = .uninstalling(installedXcodePath)
+        }
+
         uninstallTask?.cancel()
         let taskID = UUID()
         uninstallTaskID = taskID
@@ -699,6 +717,9 @@ class AppState: ObservableObject {
                 await updateInstalledXcodesAsync()
             } catch is CancellationError {
             } catch {
+                if let index = allXcodes.firstIndex(where: { $0.id == xcode.id }) {
+                    allXcodes[index].installState = .installed(installedXcodePath)
+                }
                 self.error = error
                 self.presentedAlert = .generic(title: localizeString("Alert.Uninstall.Error.Title"), message: error.legibleLocalizedDescription)
             }
```

**File**: `Xcodes/Backend/Environment.swift` (modified, +4/-4)
```diff
@@ -168,15 +168,15 @@ public struct Network: Sendable {
         downloadTaskAsync(url, saveLocation, resumeData)
     }
     
-    public var validateSessionAsync: @Sendable () async throws -> Void
+    public var validateSessionAsync: @Sendable () async throws -> AuthenticationState
 
     public var signout: @Sendable () -> Void
 
     public init(
         session: URLSession? = nil,
         loadData: (@Sendable (URLRequest) async throws -> (Data, URLResponse))? = nil,
         downloadTaskAsync: (@Sendable (URL, URL, Data?) -> (Progress, Task<(saveLocation: URL, response: URLResponse), Error>))? = nil,
-        validateSessionAsync: (@Sendable () async throws -> Void)? = nil,
+        validateSessionAsync: (@Sendable () async throws -> AuthenticationState)? = nil,
         signout: (@Sendable () -> Void)? = nil
     ) {
         let loginClient: XcodesLoginKit.Client
@@ -193,7 +193,7 @@ public struct Network: Sendable {
             loginClient.urlSession.downloadTaskAsync(with: url, to: saveLocation, resumingWith: resumeData)
         }
         self.validateSessionAsync = validateSessionAsync ?? {
-            _ = try await loginClient.validateSession()
+            try await loginClient.validateSession()
         }
         self.signout = signout ?? {
             loginClient.signout()
@@ -208,7 +208,7 @@ public struct Network: Sendable {
             loginClient.urlSession.downloadTaskAsync(with: url, to: saveLocation, resumingWith: resumeData)
         }
         self.validateSessionAsync = {
-            _ = try await loginClient.validateSession()
+            try await loginClient.validateSession()
         }
         self.signout = {
             loginClient.signout()
```

**File**: `Xcodes/Frontend/InfoPane/InfoPaneControls.swift` (modified, +9/-0)
```diff
@@ -30,6 +30,15 @@ struct InfoPaneControls: View {
                 }
             case .installed(_):
                 InstalledStateButtons(xcode: xcode)
+            case .uninstalling:
+                HStack {
+                    Spacer()
+                    ProgressView()
+                        .scaleEffect(0.5)
+                    Text("Uninstalling")
+                        .font(.caption)
+                        .foregroundStyle(.secondary)
+                }
             }
         }
     }
```

---

### Incident Patch 2: `8f71a798` (2026-09-12)
**Commit Message**: Merge pull request #849 from XcodesOrg/fix/platform-architecture-picker

fix: platform architecture picker visibility

**File**: `Xcodes/Frontend/InfoPane/PlatformsView.swift` (modified, +22/-10)
```diff
@@ -18,27 +18,30 @@ struct PlatformsView: View {
     var body: some View {
         
         let builds = xcode.sdks?.allBuilds
-        let runtimes = (builds?.flatMap { sdkBuild in
+        let availableRuntimes = (builds?.flatMap { sdkBuild in
             appState.downloadableRuntimes.filter {
-                $0.sdkBuildUpdate?.contains(sdkBuild) ?? false &&
-                ($0.architectures?.isEmpty ?? true ||
-                 ($0.architectures?.isUniversal ?? false && selectedVariant == .universal) ||
-                 ($0.architectures?.isAppleSilicon ?? false && selectedVariant == .appleSilicon)
-                )
+                $0.sdkBuildUpdate?.contains(sdkBuild) ?? false
             }
         } ?? []).removingReleaseCandidateDisplayDuplicates(installedRuntimes: appState.installedRuntimes)
-        
-        let architectures = Set(runtimes.flatMap { $0.architectures ?? [] })
+
+        let availableVariants = ArchitectureVariant.allCases.filter { variant in
+            availableRuntimes.contains { $0.supports(variant) }
+        }
+        let displayedVariant = availableVariants.count == 1 ? availableVariants.first : selectedVariant
+        let runtimes = availableRuntimes.filter { runtime in
+            guard !(runtime.architectures?.isEmpty ?? true), let displayedVariant else { return true }
+            return runtime.supports(displayedVariant)
+        }
         
         VStack {
             HStack {
                 Text("Platforms")
                     .font(.title3)
                     .frame(maxWidth: .infinity, alignment: .leading)
-                if !architectures.isEmpty {
+                if availableVariants.count > 1 {
                     Spacer()
                     Picker("Architecture", selection: $selectedVariant) {
-                        ForEach(ArchitectureVariant.allCases, id: \.self) { arch in
+                        ForEach(availableVariants, id: \.self) { arch in
                             Label(variantLabel(for: arch), systemImage: arch.iconName)
                                 .tag(arch)
                         }
@@ -138,6 +141,15 @@ private struct RuntimeDisplayKey: Hashable {
 }
 
 private extension DownloadableRuntime {
+    func supports(_ variant: ArchitectureVariant) -> Bool {
+        switch variant {
+        case .universal:
+            return architectures?.isUniversal ?? false
+        case .appleSilicon:
+            return architectures?.isAppleSilicon ?? false
+        }
+    }
+
     var isReleaseCandidate: Bool {
         name.localizedCaseInsensitiveContains("Release Candidate") ||
         identifier.localizedCaseInsensitiveContains("_rc")
```

---

### Incident Patch 3: `5de4c0f1` (2026-09-08)
**Commit Message**: Merge pull request #840 from YuriNachos/fix/install-notification-title

fix: duplicated major version in install notification title

**File**: `Xcodes/Backend/AppState+Install.swift` (modified, +5/-1)
```diff
@@ -10,6 +10,10 @@ import XcodesLoginKit
 /// Downloads and installs Xcodes
 extension AppState {
 
+    static func installNotificationTitle(for version: Version) -> String {
+        version.appleDescription
+    }
+
     // check to see if we should auto install for the user
     public func autoInstallIfNeeded() {
         guard let storageValue = Current.defaults.get(forKey: "autoInstallation") as? Int, let autoInstallType = AutoInstallationType(rawValue: storageValue) else { return }
@@ -471,7 +475,7 @@ extension AppState {
 
         let xcode = allXcodes[index]
         if postNotification {
-            Current.notificationManager.scheduleNotification(title: xcode.version.major.description + "." + xcode.version.appleDescription, body: step.description, category: .normal)
+            Current.notificationManager.scheduleNotification(title: AppState.installNotificationTitle(for: xcode.version), body: step.description, category: .normal)
         }
     }
 
```

**File**: `XcodesTests/AppStateTests.swift` (modified, +16/-0)
```diff
@@ -863,6 +863,22 @@ class AppStateTests: XCTestCase {
         }
     }
 
+    func test_InstallNotificationTitle_DoesNotDuplicateMajorVersion() {
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 27, minor: 0, patch: 0, prereleaseIdentifiers: ["beta", "4"])),
+            "27.0 Beta 4"
+        )
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 26, minor: 5, patch: 0)),
+            "26.5"
+        )
+        // Stable release with patch
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 10, minor: 2, patch: 1)),
+            "10.2.1"
+        )
+    }
+
     private func recordAllXcodeInstallStates(during operation: () async throws -> Void) async throws -> [[XcodeInstallState]] {
         var states: [[XcodeInstallState]] = []
         var cancellable: AnyCancellable?
```

---

### Incident Patch 4: `a973b232` (2026-09-08)
**Commit Message**: Fix platform architecture picker visibility

**File**: `Xcodes/Frontend/InfoPane/PlatformsView.swift` (modified, +22/-10)
```diff
@@ -18,27 +18,30 @@ struct PlatformsView: View {
     var body: some View {
         
         let builds = xcode.sdks?.allBuilds
-        let runtimes = (builds?.flatMap { sdkBuild in
+        let availableRuntimes = (builds?.flatMap { sdkBuild in
             appState.downloadableRuntimes.filter {
-                $0.sdkBuildUpdate?.contains(sdkBuild) ?? false &&
-                ($0.architectures?.isEmpty ?? true ||
-                 ($0.architectures?.isUniversal ?? false && selectedVariant == .universal) ||
-                 ($0.architectures?.isAppleSilicon ?? false && selectedVariant == .appleSilicon)
-                )
+                $0.sdkBuildUpdate?.contains(sdkBuild) ?? false
             }
         } ?? []).removingReleaseCandidateDisplayDuplicates(installedRuntimes: appState.installedRuntimes)
-        
-        let architectures = Set(runtimes.flatMap { $0.architectures ?? [] })
+
+        let availableVariants = ArchitectureVariant.allCases.filter { variant in
+            availableRuntimes.contains { $0.supports(variant) }
+        }
+        let displayedVariant = availableVariants.count == 1 ? availableVariants.first : selectedVariant
+        let runtimes = availableRuntimes.filter { runtime in
+            guard !(runtime.architectures?.isEmpty ?? true), let displayedVariant else { return true }
+            return runtime.supports(displayedVariant)
+        }
         
         VStack {
             HStack {
                 Text("Platforms")
                     .font(.title3)
                     .frame(maxWidth: .infinity, alignment: .leading)
-                if !architectures.isEmpty {
+                if availableVariants.count > 1 {
                     Spacer()
                     Picker("Architecture", selection: $selectedVariant) {
-                        ForEach(ArchitectureVariant.allCases, id: \.self) { arch in
+                        ForEach(availableVariants, id: \.self) { arch in
                             Label(variantLabel(for: arch), systemImage: arch.iconName)
                                 .tag(arch)
                         }
@@ -138,6 +141,15 @@ private struct RuntimeDisplayKey: Hashable {
 }
 
 private extension DownloadableRuntime {
+    func supports(_ variant: ArchitectureVariant) -> Bool {
+        switch variant {
+        case .universal:
+            return architectures?.isUniversal ?? false
+        case .appleSilicon:
+            return architectures?.isAppleSilicon ?? false
+        }
+    }
+
     var isReleaseCandidate: Bool {
         name.localizedCaseInsensitiveContains("Release Candidate") ||
         identifier.localizedCaseInsensitiveContains("_rc")
```

---

### Incident Patch 5: `52320866` (2026-08-08)
**Commit Message**: fix: notify on new Xcode version identity, not array-count growth

The "New Xcode version available" notification was triggered by an
array-count increase rather than by the appearance of a genuinely new
version identity (AvailableXcode.xcodeID). This caused two user-visible
bugs:

- False negative: when a new version is added and an old one removed in
  the same refresh (count unchanged, or even shrunk), no notification
  fired, so a genuinely new version landed silently.
- False positive: when the array grew without a new identity (a duplicate
  row, or a data-source switch returning an already-known xcodeID), a
  spurious "new version" banner appeared.

Extract the decision into a pure static helper
AppState.newlyAvailableXcodes(oldXcodes:newXcodes:) that computes the
xcodeID set difference, and notify iff it is non-empty. The empty-old
guard is preserved so the initial cache load (empty -> populated) does
not notify; the scheduleNotification arguments are unchanged.

Adds XcodesTests/NewVersionNotificationTests.swift with a red-before-green
regression suite (the false-negative and false-positive cases fail against
a buggy count-based mirror and pass against the identity-based b

**File**: `Xcodes.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -31,6 +31,7 @@
 		BDBAB7452B9FF55800694B0B /* TrailingIconLabelStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = BDBAB7442B9FF55800694B0B /* TrailingIconLabelStyle.swift */; };
 		CA11E7BA2598476C00D2EE1C /* XcodeCommands.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA11E7B92598476C00D2EE1C /* XcodeCommands.swift */; };
 		CA2518EC25A7FF2B00F08414 /* AppStateUpdateTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA2518EB25A7FF2B00F08414 /* AppStateUpdateTests.swift */; };
+		14d2f5a1273f6c350cad4406 /* NewVersionNotificationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */; };
 		CA378F992466567600A58CE0 /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA378F982466567600A58CE0 /* AppState.swift */; };
 		CA39711924495F0E00AFFB77 /* AppStoreButtonStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA39711824495F0E00AFFB77 /* AppStoreButtonStyle.swift */; };
 		CA42DD7325AEB04300BC0B0C /* Logger.swift in Sources */ = {isa = PBXBuildFile; fileRef = CA42DD7225AEB04300BC0B0C /* Logger.swift */; };
@@ -208,6 +209,7 @@
 		BDBAB7442B9FF55800694B0B /* TrailingIconLabelStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TrailingIconLabelStyle.swift; sourceTree = "<group>"; };
 		CA11E7B92598476C00D2EE1C /* XcodeCommands.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = XcodeCommands.swift; sourceTree = "<group>"; };
 		CA2518EB25A7FF2B00F08414 /* AppStateUpdateTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppStateUpdateTests.swift; sourceTree = "<group>"; };
+		884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NewVersionNotificationTests.swift; sourceTree = "<group>"; };
 		CA378F982466567600A58CE0 /* AppState.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppState.swift; sourceTree = "<group>"; };
 		CA39711824495F0E00AFFB77 /* AppStoreButtonStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppStoreButtonStyle.swift; sourceTree = "<group>"; };
 		CA42DD7225AEB04300BC0B0C /* Logger.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Logger.swift; sourceTree = "<group>"; };
@@ -594,6 +596,7 @@
 				CAC281E6259FA45A00B8AB0B /* Environment+Mock.swift */,
 				CAD2E7B72449575100113D76 /* AppStateTests.swift */,
 				CA2518EB25A7FF2B00F08414 /* AppStateUpdateTests.swift */,
+				884f01aed2f43048ab4d3323 /* NewVersionNotificationTests.swift */,
 				CAD2E7B92449575100113D76 /* Info.plist */,
 			);
 			path = XcodesTests;
@@ -970,6 +973,7 @@
 				CAC281E7259FA45A00B8AB0B /* Environment+Mock.swift in Sources */,
 				CAC281E2259FA44600B8AB0B /* Bundle+XcodesTests.swift in Sources */,
 				CA2518EC25A7FF2B00F08414 /* AppStateUpdateTests.swift in Sources */,
+				14d2f5a1273f6c350cad4406 /* NewVersionNotificationTests.swift in Sources */,
 				CAB3AB0E25BCA6C200BF1B04 /* AppStateTests.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
```

**File**: `Xcodes/Backend/AppState.swift` (modified, +12/-1)
```diff
@@ -43,7 +43,7 @@ class AppState: ObservableObject {
     @Published var authenticationState: AuthenticationState = .unauthenticated
     @Published var availableXcodes: [AvailableXcode] = [] {
         willSet {
-            if newValue.count > availableXcodes.count && availableXcodes.count != 0 {
+            if !Self.newlyAvailableXcodes(oldXcodes: availableXcodes, newXcodes: newValue).isEmpty {
                 Current.notificationManager.scheduleNotification(title: localizeString("Notification.NewXcodeVersion.Title"), body: localizeString("Notification.NewXcodeVersion.Body"), category: .normal)
             }
             updateAllXcodes(
@@ -56,6 +56,17 @@ class AppState: ObservableObject {
             autoInstallIfNeeded()
         }
     }
+
+    /// Returns the `AvailableXcode`s in `newXcodes` whose `xcodeID` was not present in `oldXcodes`.
+    ///
+    /// Empty when `oldXcodes` is empty, so the initial load (empty -> populated) is NOT treated
+    /// as "a new version since you last looked".
+    static func newlyAvailableXcodes(oldXcodes: [AvailableXcode], newXcodes: [AvailableXcode]) -> [AvailableXcode] {
+        guard !oldXcodes.isEmpty else { return [] }
+        let oldIDs = Set(oldXcodes.map(\.xcodeID))
+        return newXcodes.filter { !oldIDs.contains($0.xcodeID) }
+    }
+
     @Published var allXcodes: [Xcode] = []
     @Published var selectedXcodePath: String? {
         willSet {
```

**File**: `XcodesTests/NewVersionNotificationTests.swift` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+import Version
+import XcodesKit
+@testable import Xcodes
+import XCTest
+
+/// Regression tests for the "New Xcode version available" notification trigger.
+///
+/// The decision to notify is extracted into the pure helper
+/// `AppState.newlyAvailableXcodes(oldXcodes:newXcodes:)` and asserted directly here.
+/// No notification spying and no `Current = .mock` are required: the helper is the single
+/// source of truth that the `availableXcodes.willSet` predicate consults.
+@MainActor
+final class NewVersionNotificationTests: XCTestCase {
+    // MARK: - Fixtures
+
+    /// Builds an `AvailableXcode` for `version` with a distinct download URL, mirroring the
+    /// construction style in `AppStateUpdateTests.swift` (`Version("0.0.0")!`, three components).
+    /// `architectures` defaults to `nil`.
+    private func makeAvailableXcode(
+        version: String,
+        architectures: [Architecture]? = nil,
+        urlSuffix: String = ""
+    ) -> AvailableXcode {
+        AvailableXcode(
+            version: Version(version)!,
+            url: URL(string: "https://example.com/Xcode-\(version)-\(urlSuffix).xip")!,
+            filename: "Xcode-\(version)-\(urlSuffix).xip",
+            releaseDate: nil,
+            architectures: architectures
+        )
+    }
+
+    /// The set of stable identities (`xcodeID`) for the given available Xcodes — an
+    /// order-independent comparison keyed on version + architecture, not array position.
+    private func identities(_ xcodes: [AvailableXcode]) -> Set<XcodeID> {
+        Set(xcodes.map(\.xcodeID))
+    }
+
+    // MARK: - Initial-load suppression
+
+    func testInitialLoadDoesNotNotify() {
+        // First population (empty -> populated) is the initial cache load, NOT "a new version
+        // since you last looked", so the result must be empty even though the array grew.
+        let old: [AvailableXcode] = []
+        let new = [makeAvailableXcode(version: "15.0.0")]
+
+        let result = AppState.newlyAvailableXcodes(oldXcodes: old, newXcodes: new)
+
+        XCTAssertTrue(result.isEmpty, "Initial population must not be treated as a new version")
+    }
+
+    // MARK: - True positive — one genuinely new version
+
+    func testGenuinelyNewVersionIsReported() {
+        let existingA = makeAvailableXcode(version: "15.0.0")
+        let existingB = makeAvailableXcode(version: "15.1.0")
+        let added = makeAvailableXcode(version: "16.0.0")
+        let old = [existingA, existingB]
+        let new = [existingA, existingB, added]
+
+        let result = AppState.newlyAvailableXcodes(oldXcodes: old, newXcodes: new)
+
+        XCTAssertEqual(identities(result), [added.xcodeID])
+    }
+
+    // MARK: - FALSE NEGATIVE (the bug) — new version added AND old version removed, count unchanged
+
+    func testNewVersionAddedAndOldRemovedIsReported() {
+        // The OLD count-based predicate saw "no growth" (2 -> 2) here and MISSED version C.
+        // A data source can drop an obsolete beta row the same refresh it adds the new one.
+        let existing = makeAvailableXcode(version: "15.1.0")
+        let removed = makeAvailableXcode(version: "15.0.0")
+        let added = makeAvailableXcode(version: "16.0.0")
+        let old = [removed, existing]
+        let new = [existing, added]
+
+        let result = AppState.newlyAvailableXcodes(oldXcodes: old, newXcodes: new)
+
+        XCTAssertEqual(identities(result), [added.xcodeID], "A genuinely new version must be reported even when the count is unchanged")
+    }
+
+    // MARK: - FALSE NEGATIVE variant — a new version appears while the list shrinks
+
+    func testNewVersionReportedEvenWhenListShrinks() {
+        // A genuinely new version can appear even when the overall count DECREASES: a data source
+        // prunes older rows the same refresh it surfaces the newest (3 -> 2 here). The OLD
+        // count-based predicate saw "no growth" and MISSED D; the identity-based helper reports it.
+   
```

---

### Incident Patch 6: `c890879f` (2026-08-07)
**Commit Message**: fix: duplicated major version in install notification title

appleDescription already includes the major version, so prepending
major.description + "." rendered titles like "27.27.0 Beta 4".
Use appleDescription directly via a testable static helper.

Co-Authored-By: Claude <noreply@anthropic.com>

**File**: `Xcodes/Backend/AppState+Install.swift` (modified, +5/-1)
```diff
@@ -10,6 +10,10 @@ import XcodesLoginKit
 /// Downloads and installs Xcodes
 extension AppState {
 
+    static func installNotificationTitle(for version: Version) -> String {
+        version.appleDescription
+    }
+
     // check to see if we should auto install for the user
     public func autoInstallIfNeeded() {
         guard let storageValue = Current.defaults.get(forKey: "autoInstallation") as? Int, let autoInstallType = AutoInstallationType(rawValue: storageValue) else { return }
@@ -471,7 +475,7 @@ extension AppState {
 
         let xcode = allXcodes[index]
         if postNotification {
-            Current.notificationManager.scheduleNotification(title: xcode.version.major.description + "." + xcode.version.appleDescription, body: step.description, category: .normal)
+            Current.notificationManager.scheduleNotification(title: AppState.installNotificationTitle(for: xcode.version), body: step.description, category: .normal)
         }
     }
 
```

**File**: `XcodesTests/AppStateTests.swift` (modified, +16/-0)
```diff
@@ -863,6 +863,22 @@ class AppStateTests: XCTestCase {
         }
     }
 
+    func test_InstallNotificationTitle_DoesNotDuplicateMajorVersion() {
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 27, minor: 0, patch: 0, prereleaseIdentifiers: ["beta", "4"])),
+            "27.0 Beta 4"
+        )
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 26, minor: 5, patch: 0)),
+            "26.5"
+        )
+        // Stable release with patch
+        XCTAssertEqual(
+            AppState.installNotificationTitle(for: Version(major: 10, minor: 2, patch: 1)),
+            "10.2.1"
+        )
+    }
+
     private func recordAllXcodeInstallStates(during operation: () async throws -> Void) async throws -> [[XcodeInstallState]] {
         var states: [[XcodeInstallState]] = []
         var cancellable: AnyCancellable?
```

---

### Incident Patch 7: `7fd5b660` (2026-07-08)
**Commit Message**: Fix formatting in release-drafter.yml

**File**: `.github/release-drafter.yml` (modified, +2/-2)
```diff
@@ -20,5 +20,5 @@ template: |
   ## Changes
 
   $CHANGES
-
-<!-- sparkle:edSignature= -->
+  
+  <!-- sparkle:edSignature= -->
```

---

### Incident Patch 8: `0610a5d8` (2026-07-08)
**Commit Message**: Fix label syntax in release-drafter configuration

**File**: `.github/release-drafter.yml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ categories:
     labels:
       - 'localization'
   - title: '🧰 Maintenance'
-    label:
+    labels:
       - 'chore'
       - 'documentation'
       - 'dependencies'
```

---

### Incident Patch 9: `4b85c642` (2026-07-08)
**Commit Message**: Updates xcodesKit to fix 27 beta 3 runtime issue

**File**: `Xcodes.xcodeproj/project.pbxproj` (modified, +11/-11)
```diff
@@ -112,11 +112,11 @@
 		E87DD6EB25D053FA00D86808 /* Progress+.swift in Sources */ = {isa = PBXBuildFile; fileRef = E87DD6EA25D053FA00D86808 /* Progress+.swift */; };
 		E89342FA25EDCC17007CF557 /* NotificationManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = E89342F925EDCC17007CF557 /* NotificationManager.swift */; };
 		E8977EA325C11E1500835F80 /* PreferencesView.swift in Sources */ = {isa = PBXBuildFile; fileRef = E8977EA225C11E1500835F80 /* PreferencesView.swift */; };
+		E89929802FFDFA9A0019DB31 /* XcodesKit in Frameworks */ = {isa = PBXBuildFile; productRef = E899297F2FFDFA9A0019DB31 /* XcodesKit */; };
 		E89CBD382D5FAB950037ED95 /* XcodesLoginKit in Frameworks */ = {isa = PBXBuildFile; productRef = E89CBD372D5FAB950037ED95 /* XcodesLoginKit */; };
 		E89CBD3A2D5FB8920037ED95 /* XcodesLoginKitSecurityKey in Frameworks */ = {isa = PBXBuildFile; productRef = E89CBD392D5FB8920037ED95 /* XcodesLoginKitSecurityKey */; };
 		E89CBD402D6434E10037ED95 /* SignInFederatedView.swift in Sources */ = {isa = PBXBuildFile; fileRef = E89CBD3F2D6434E10037ED95 /* SignInFederatedView.swift */; };
 		E8B20CBF2A2EDEC20057D816 /* SDKs+Xcode.swift in Sources */ = {isa = PBXBuildFile; fileRef = E8B20CBE2A2EDEC20057D816 /* SDKs+Xcode.swift */; };
-		E8C0EB1A291EF43E0081528A /* XcodesKit in Frameworks */ = {isa = PBXBuildFile; productRef = E8C0EB19291EF43E0081528A /* XcodesKit */; };
 		E8C0EB1C291EF9A10081528A /* AppState+Runtimes.swift in Sources */ = {isa = PBXBuildFile; fileRef = E8C0EB1B291EF9A10081528A /* AppState+Runtimes.swift */; };
 		E8CBDB8927ADE32300B22292 /* unxip in Copy aria2c */ = {isa = PBXBuildFile; fileRef = E8CBDB8627ADD92000B22292 /* unxip */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		E8CBDB8B27AE02FF00B22292 /* ExperiementsPreferencePane.swift in Sources */ = {isa = PBXBuildFile; fileRef = E8CBDB8A27AE02FF00B22292 /* ExperiementsPreferencePane.swift */; };
@@ -332,13 +332,13 @@
 				15F5B8902CCF09B900705E2F /* CryptoKit.framework in Frameworks */,
 				CABFA9E42592F08E00380FEE /* Version in Frameworks */,
 				CABFA9FD2592F13300380FEE /* LegibleError in Frameworks */,
+				E89929802FFDFA9A0019DB31 /* XcodesKit in Frameworks */,
 				E689540325BE8C64000EBCEA /* DockProgress in Frameworks */,
 				CABFA9F82592F0F900380FEE /* KeychainAccess in Frameworks */,
 				E83FDC442CBB649100679C6B /* Sparkle in Frameworks */,
 				E862D43B2CC8B26F00BAA376 /* SRP in Frameworks */,
 				E89CBD3A2D5FB8920037ED95 /* XcodesLoginKitSecurityKey in Frameworks */,
 				E89CBD382D5FAB950037ED95 /* XcodesLoginKit in Frameworks */,
-				E8C0EB1A291EF43E0081528A /* XcodesKit in Frameworks */,
 				E8FD5727291EE4AC001E004C /* AsyncNetworkService in Frameworks */,
 				CABFA9EE2592F0CC00380FEE /* SwiftSoup in Frameworks */,
 				E84E4F572B335094003F3959 /* OrderedCollections in Frameworks */,
@@ -682,13 +682,13 @@
 				CABFA9FC2592F13300380FEE /* LegibleError */,
 				E689540225BE8C64000EBCEA /* DockProgress */,
 				E8FD5726291EE4AC001E004C /* AsyncNetworkService */,
-				E8C0EB19291EF43E0081528A /* XcodesKit */,
 				E8F44A1D296B4CD7002D6592 /* Path */,
 				E84E4F562B335094003F3959 /* OrderedCollections */,
 				E83FDC432CBB649100679C6B /* Sparkle */,
 				E862D43A2CC8B26F00BAA376 /* SRP */,
 				E89CBD372D5FAB950037ED95 /* XcodesLoginKit */,
 				E89CBD392D5FB8920037ED95 /* XcodesLoginKitSecurityKey */,
+				E899297F2FFDFA9A0019DB31 /* XcodesKit */,
 			);
 			productName = XcodesMac;
 			productReference = CAD2E79E2449574E00113D76 /* Xcodes.app */;
@@ -772,10 +772,10 @@
 				E689540125BE8C64000EBCEA /* XCRemoteSwiftPackageReference "DockProgress" */,
 				E8FD5725291EE4AC001E004C /* XCRemoteSwiftPackageReference "AsyncHTTPNetworkService" */,
 				E8F44A1C296B4CD7002D6592 /* XCRemoteSwiftPackageReference "Path" */,
-				E856BB74291EDD3D00DC438B /* XCRemoteSwiftPackageReference "XcodesKit" */,
 				E89CBD3B2D5FC0B10037ED95 /* XCRemoteSwiftPackageReference "XcodesLoginKit" */,
 				E84E4F552B335094003F3959 /* XCRemoteSwiftPac
```

**File**: `Xcodes.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +3/-3)
```diff
@@ -93,7 +93,7 @@
       },
       {
         "package": "swift-srp",
-        "repositoryURL": "https://github.com/xcodesOrg/swift-srp",
+        "repositoryURL": "https://github.com/XcodesOrg/swift-srp",
         "state": {
           "branch": "main",
           "revision": "543aa0122a0257b992f6c7d62d18a26e3dffb8fe",
@@ -123,8 +123,8 @@
         "repositoryURL": "https://github.com/XcodesOrg/XcodesKit",
         "state": {
           "branch": null,
-          "revision": "5bff14052f7664f75a4837547804e07c3c2dfe47",
-          "version": "1.0.3"
+          "revision": "a9e5d7d701f20f1385071851319cdaecccc9f1e8",
+          "version": "1.0.4"
         }
       },
       {
```

---

### Incident Patch 10: `b065cb4a` (2026-06-30)
**Commit Message**: Merge pull request #827 from XcodesOrg/matt/deleteCrash

fix: crash on delete when version does not exist

**File**: `Xcodes/Backend/AppState.swift` (modified, +5/-2)
```diff
@@ -685,6 +685,7 @@ class AppState: ObservableObject {
                 try await uninstallXcodeAsync(path: installedXcodePath)
                 try Task.checkCancellation()
                 await updateSelectedXcodePathAsync()
+                await updateInstalledXcodesAsync()
             } catch is CancellationError {
             } catch {
                 self.error = error
@@ -881,11 +882,13 @@ class AppState: ObservableObject {
     // MARK: - Private
 
     private func uninstallXcodeAsync(path: Path) async throws {
-        let xcode = InstalledXcode(
+        guard let xcode = InstalledXcode(
             path: path,
             contentsAtPath: { path in Current.files.contents(atPath: path) },
             loadArchitectures: Current.shell.archs
-        )!
+        ) else {
+            throw FileError.fileNotFound(path.string)
+        }
         _ = try XcodeUninstallService(
             removeItem: { url in try Current.files.removeItem(at: url) },
             trashItem: { url in try Current.files.trashItem(at: url) }
```

**File**: `XcodesTests/AppStateTests.swift` (modified, +46/-0)
```diff
@@ -252,6 +252,52 @@ class AppStateTests: XCTestCase {
         XCTAssertEqual(subject.selectedXcodePath, secondPath.string)
     }
 
+    func test_Uninstall_MissingXcodePresentsFileNotFoundError() async throws {
+        let missingPath = try XCTUnwrap(Path("/Applications/Xcode-Missing.app"))
+        let xcode = Xcode(version: Version("15.0.0")!, installState: .installed(missingPath), selected: false, icon: nil)
+        let didTryToTrashItem = TestLockedBox(false)
+        Current.files.contentsAtPath = { _ in nil }
+        Current.files.trashItem = { _ in
+            didTryToTrashItem.withValue { $0 = true }
+            return URL(fileURLWithPath: "\(NSHomeDirectory())/.Trash")
+        }
+
+        subject.uninstall(xcode: xcode)
+        let uninstallTask = try XCTUnwrap(subject.uninstallTask)
+        await uninstallTask.value
+
+        guard case let .generic(title, message) = subject.presentedAlert else {
+            return XCTFail("Expected generic uninstall error alert")
+        }
+        XCTAssertEqual(title, localizeString("Alert.Uninstall.Error.Title"))
+        XCTAssertEqual(
+            message,
+            String(format: localizeString("Alert.Uninstall.Error.Message.FileNotFound"), missingPath.string)
+        )
+        XCTAssertFalse(didTryToTrashItem.read { $0 })
+    }
+
+    func test_Uninstall_RefreshesInstalledXcodeList() async throws {
+        let installedPath = try XCTUnwrap(Path("/Applications/Xcode-0.0.0.app"))
+        let version = try XCTUnwrap(Version("0.0.0"))
+        subject.availableXcodes = [
+            AvailableXcode(version: version, url: URL(string: "https://apple.com/xcode.xip")!, filename: "mock.xip", releaseDate: nil)
+        ]
+        subject.allXcodes = [
+            Xcode(version: version, installState: .installed(installedPath), selected: true, icon: nil)
+        ]
+        Current.files.installedXcodes = { _ in [] }
+        Current.shell.xcodeSelectPrintPath = {
+            ProcessOutput(status: 0, out: "", err: "")
+        }
+
+        subject.uninstall(xcode: subject.allXcodes[0])
+        let uninstallTask = try XCTUnwrap(subject.uninstallTask)
+        await uninstallTask.value
+
+        XCTAssertEqual(subject.allXcodes[0].installState, .notInstalled)
+    }
+
     func test_Signout_RemovesCookiesFromDownloadSession() throws {
         let session = URLSession(configuration: .ephemeral)
         Current.network.session = session
```

#### Recent Merged Pull Requests:
- **PR #859** (closed): Swedish strings (@dhindrik)
- **PR #851** (2026-09-12): chore: update xcodesKit and LoginKit to latest. minor fixes (@MattKiazyk)
- **PR #849** (2026-09-12): fix: platform architecture picker visibility (@MattKiazyk)
- **PR #847** (2026-09-14): Feature/privileged helper file ops (@abiligiri)
- **PR #842** (2026-09-08): fix: notify on new Xcode version identity, not array-count growth (@YuriNachos)
- **PR #840** (2026-09-08): fix: duplicated major version in install notification title (@YuriNachos)
- **PR #839** (2026-09-14): Support password manager autofill during Apple ID sign-in (@zeromhz)
- **PR #838** (closed): Prevent Info Pane overlap in narrow windows (@raisulchowdhury)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
