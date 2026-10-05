# Forensic Learning Record (Deep Inspection): twostraws/ControlRoom

> **Canonical Artifact**: `07_PROJECT_LEARNING/twostraws-controlroom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/twostraws/ControlRoom](https://github.com/twostraws/ControlRoom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:36:34.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `twostraws/ControlRoom`
- **Description**: A macOS app to control the Xcode Simulator.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6104 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #61** (2020-02-20): **App crashes when selecting the default simulator**
  *Symptoms*: Steps to reproduce: - Make sure "Show default simulator" option is turned on in the preference - Launch the app - Select the very first simulator item from the sidebar, i.e. the one reads "Default" - App crashes  It seems that the `selectedSimulators` property in `SimulatorsController` is unable to locate the selected simulator(s) when a simulator has "booted" as its udid. 
  **Post-Mortem & Fix Analysis**:
  > @dyang thank you for reporting this!
  > @davedelong Thanks for the quick fix!

- **Issue #46** (2020-04-03): **Location simulation doesn't work on Default simulator**
  *Symptoms*: The `Default` simulator has some issues with Location simulation (the tab with the map).  The hack we're using to toggle current user's simulated position is based on simulator's `udid` property, which is `booted` for the Default one.    We can work around this by checking if selected simulator's id is `booted` and then broadcast the location notification to all booted devices.  I'll try to put together a PR  note: related to #43 .

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

### Incident Patch 1: `c8c7d4cf` (2026-04-05)
**Commit Message**: Merge pull request #206 from Jack-sh1/fix/swift6-concurrency-and-retroactive-conformance

Fix Swift 6 concurrency warnings and retroactive conformance (#199)

**File**: `ControlRoom/Controllers/LocalSearchController.swift` (modified, +6/-5)
```diff
@@ -115,16 +115,17 @@ class LocalSearchController: NSObject, ObservableObject {
 /// Adds `MKLocalSearchCompleterDelegate` conformance so the controller can use the delegate's callback methods
 extension LocalSearchController: MKLocalSearchCompleterDelegate {
     /// Called if `MKLocalSearchCompleter` return valid results from a query string
-    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
-        guard let callback else { return }
+    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
         let results = completer.results.map {
-            LocalSearchResult( result: $0 )
+            LocalSearchResult(result: $0)
+        }
+        Task { @MainActor [weak self] in
+            self?.callback?(results)
         }
-        callback(results)
     }
 
     /// Called if `MKLocalSearchCompleter` encounters an error
-    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
+    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
         print(error)
     }
 }
```

**File**: `ControlRoom/Extensions/CLLocationCoordinate2D-Identifiable.swift` (modified, +8/-0)
```diff
@@ -9,8 +9,16 @@
 import CoreLocation
 import Foundation
 
+#if swift(>=5.10)
+extension CLLocationCoordinate2D: @retroactive Identifiable {
+    public var id: String {
+        "\(latitude)-\(longitude)"
+    }
+}
+#else
 extension CLLocationCoordinate2D: Identifiable {
     public var id: String {
         "\(latitude)-\(longitude)"
     }
 }
+#endif
\ No newline at end of file
```

---

### Incident Patch 2: `f0464560` (2026-04-03)
**Commit Message**: Fix Swift 6 concurrency warnings and retroactive conformance (#199)

- Mark MKLocalSearchCompleterDelegate methods as nonisolated in
  LocalSearchController to satisfy nonisolated protocol requirement,
  dispatching back to @MainActor where needed
- Add @retroactive attribute to CLLocationCoordinate2D's Identifiable
  conformance with backward compatibility for Swift < 5.10

**File**: `ControlRoom/Controllers/LocalSearchController.swift` (modified, +6/-5)
```diff
@@ -115,16 +115,17 @@ class LocalSearchController: NSObject, ObservableObject {
 /// Adds `MKLocalSearchCompleterDelegate` conformance so the controller can use the delegate's callback methods
 extension LocalSearchController: MKLocalSearchCompleterDelegate {
     /// Called if `MKLocalSearchCompleter` return valid results from a query string
-    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
-        guard let callback else { return }
+    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
         let results = completer.results.map {
-            LocalSearchResult( result: $0 )
+            LocalSearchResult(result: $0)
+        }
+        Task { @MainActor [weak self] in
+            self?.callback?(results)
         }
-        callback(results)
     }
 
     /// Called if `MKLocalSearchCompleter` encounters an error
-    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
+    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
         print(error)
     }
 }
```

**File**: `ControlRoom/Extensions/CLLocationCoordinate2D-Identifiable.swift` (modified, +8/-0)
```diff
@@ -9,8 +9,16 @@
 import CoreLocation
 import Foundation
 
+#if swift(>=5.10)
+extension CLLocationCoordinate2D: @retroactive Identifiable {
+    public var id: String {
+        "\(latitude)-\(longitude)"
+    }
+}
+#else
 extension CLLocationCoordinate2D: Identifiable {
     public var id: String {
         "\(latitude)-\(longitude)"
     }
 }
+#endif
\ No newline at end of file
```

---

### Incident Patch 3: `afc95ae7` (2025-10-15)
**Commit Message**: Merge pull request #204 from PerlBeforeSwine/fix/swiftlint_issues

Fixed linter errors, warnings, and rule definition

**File**: `.swiftlint.yml` (modified, +0/-2)
```diff
@@ -5,8 +5,6 @@ identifier_name:
 line_length:
   warning: 220
   error: 250
-identifier_name:
-  allowed_symbols: "_"
 
 disabled_rules:
   - non_optional_string_data_conversion
```

**File**: `ControlRoom/Controllers/SimCtl+Types.swift` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ extension SimCtl {
     enum DeviceFamily: CaseIterable {
         case iPhone
         case iPad
-        // swiftlint:disable:next identifier_name
         case tv
         case watch
         case visionPro
```

**File**: `ControlRoom/Helpers/TypeIdentifier.swift` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ struct TypeIdentifier: Hashable {
     static let watch = TypeIdentifier("com.apple.watch")
     static let vision = TypeIdentifier("com.apple.vision-pro")
 
-    // swiftlint:disable:next identifier_name
     static let tv = TypeIdentifier("com.apple.apple-tv")
 
     /// Default type identifiers to be used for unknown simulators
```

**File**: `ControlRoom/Simulator UI/ControlScreens/LocationVIew/LocationView.swift` (modified, +5/-5)
```diff
@@ -14,8 +14,8 @@ import CoreLocation
 struct LocationView: View {
     @ObservedObject var controller: SimulatorsController
     let simulator: Simulator
-    static let DEFAULT_LAT = 37.323056
-    static let DEFAULT_LNG = -122.031944
+    static let defaultLat = 37.323056
+    static let defaultLong = -122.031944
 
     /// Saved locations controller.
     @StateObject private var locationsController = LocationsController()
@@ -40,10 +40,10 @@ struct LocationView: View {
     /// Keeps track of which search item is being currently hovered over
     @State private var lastHoverId: UUID?
 
-    @State private var latitudeText = "\(DEFAULT_LAT)"
-    @State private var longitudeText = "\(DEFAULT_LNG)"
+    @State private var latitudeText = "\(defaultLat)"
+    @State private var longitudeText = "\(defaultLong)"
     /// The location that is being simulated
-    @State private var currentLocation = Location(id: UUID(), name: "", latitude: DEFAULT_LAT, longitude: DEFAULT_LNG)
+    @State private var currentLocation = Location(id: UUID(), name: "", latitude: defaultLat, longitude: defaultLong)
     @State private var pinnedLocation: CLLocationCoordinate2D?
 
     /// A randomly generated location offset from the currentLocation.
```

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ struct SystemView: View {
 
 		let launchSpec = LSLaunchURLSpec(appURL: unmanagedTerminalUrl, itemURLs: unmanagedFolderUrl, passThruParams: nil, launchFlags: [], asyncRefCon: nil)
 
-		withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) -> Void in
+		_ = withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) in
 			LSOpenFromURLSpec(pointer, nil)
 		}
 	}
```

---

### Incident Patch 4: `204cbee4` (2025-09-18)
**Commit Message**: Fixed linter errors, warnings, and rule definition

**File**: `.swiftlint.yml` (modified, +1/-2)
```diff
@@ -2,11 +2,10 @@ type_name:
   allowed_symbols: "_"
 identifier_name:
   min_length: 2
+  allowed_symbols: "_"
 line_length:
   warning: 220
   error: 250
-identifier_name:
-  allowed_symbols: "_"
 
 disabled_rules:
   - non_optional_string_data_conversion
```

**File**: `ControlRoom/Controllers/SimCtl+Types.swift` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ extension SimCtl {
     enum DeviceFamily: CaseIterable {
         case iPhone
         case iPad
-        // swiftlint:disable:next identifier_name
         case tv
         case watch
         case visionPro
```

**File**: `ControlRoom/Helpers/TypeIdentifier.swift` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ struct TypeIdentifier: Hashable {
     static let watch = TypeIdentifier("com.apple.watch")
     static let vision = TypeIdentifier("com.apple.vision-pro")
 
-    // swiftlint:disable:next identifier_name
     static let tv = TypeIdentifier("com.apple.apple-tv")
 
     /// Default type identifiers to be used for unknown simulators
```

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ struct SystemView: View {
 
 		let launchSpec = LSLaunchURLSpec(appURL: unmanagedTerminalUrl, itemURLs: unmanagedFolderUrl, passThruParams: nil, launchFlags: [], asyncRefCon: nil)
 
-		withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) -> Void in
+		_ = withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) in
 			LSOpenFromURLSpec(pointer, nil)
 		}
 	}
```

---

### Incident Patch 5: `5bc6005f` (2024-12-24)
**Commit Message**: Merge pull request #192 from marcelmendesfilho/fix/simulator-boot

fix: #157 Simulator isn't visible on booting it from Control Room

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +7/-1)
```diff
@@ -42,7 +42,13 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func boot(_ simulator: Simulator) {
-        execute(.boot(simulator: simulator))
+        /// No need to check if Simulator app is already running since no second SImulator app will be spawned
+        SnapshotCtl.startSimulatorApp {
+            /// Wait for a little while Simulator app starts running, then proceed to boot simulator
+            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
+                execute(.boot(simulator: simulator))
+            }
+        }
     }
 
     static func shutdown(_ simulator: String, completion: ((Result<Data, CommandLineError>) -> Void)? = nil) {
```

**File**: `ControlRoom/Controllers/SnapshotCtl+Commands.swift` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ extension SnapshotCtl {
             Command("/bin/mkdir", arguments:["-p", "\(devicesPath)/\(snapshotsFolder)/\(deviceId)/\(snapshotName)"])
         }
         
+        /// Open app
+        static func open(app: String) -> Command {
+            Command("/usr/bin/open", arguments: ["-a", app])
+        }
     }
     
 }
```

**File**: `ControlRoom/Controllers/SnapshotCtl.swift` (modified, +7/-1)
```diff
@@ -93,10 +93,16 @@ enum SnapshotCtl: CommandLineCommandExecuter {
         }
     }
     
+    static func startSimulatorApp(completion: @escaping (() -> Void)) {
+        execute(.open(app: "Simulator.app")) { _ in
+            return completion()
+        }
+    }
+
     private static func getSnapshotAttributes(_ snapshotPath: String) -> URLFileAttribute {
         let snapshotURL: URL = URL(fileURLWithPath: snapshotPath)
         let snapshotAttributes = URLFileAttribute(url: snapshotURL)
         return snapshotAttributes
     }
-        
+    
 }
```

---

### Incident Patch 6: `3077f4a1` (2024-12-23)
**Commit Message**: fix: #157 Simulator isn't visible on booting it from Control Room

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +7/-1)
```diff
@@ -42,7 +42,13 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func boot(_ simulator: Simulator) {
-        execute(.boot(simulator: simulator))
+        /// No need to check if Simulator app is already running since no second SImulator app will be spawned
+        SnapshotCtl.startSimulatorApp {
+            /// Wait for a little while Simulator app starts running, then proceed to boot simulator
+            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
+                execute(.boot(simulator: simulator))
+            }
+        }
     }
 
     static func shutdown(_ simulator: String, completion: ((Result<Data, CommandLineError>) -> Void)? = nil) {
```

**File**: `ControlRoom/Controllers/SnapshotCtl+Commands.swift` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ extension SnapshotCtl {
             Command("/bin/mkdir", arguments:["-p", "\(devicesPath)/\(snapshotsFolder)/\(deviceId)/\(snapshotName)"])
         }
         
+        /// Open app
+        static func open(app: String) -> Command {
+            Command("/usr/bin/open", arguments: ["-a", app])
+        }
     }
     
 }
```

**File**: `ControlRoom/Controllers/SnapshotCtl.swift` (modified, +7/-1)
```diff
@@ -93,10 +93,16 @@ enum SnapshotCtl: CommandLineCommandExecuter {
         }
     }
     
+    static func startSimulatorApp(completion: @escaping (() -> Void)) {
+        execute(.open(app: "Simulator.app")) { _ in
+            return completion()
+        }
+    }
+
     private static func getSnapshotAttributes(_ snapshotPath: String) -> URLFileAttribute {
         let snapshotURL: URL = URL(fileURLWithPath: snapshotPath)
         let snapshotAttributes = URLFileAttribute(url: snapshotURL)
         return snapshotAttributes
     }
-        
+    
 }
```

---

### Incident Patch 7: `6cb13bb2` (2024-12-14)
**Commit Message**: fix: last minute parameter removal

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -232,7 +232,7 @@ struct SystemView_Previews: PreviewProvider {
     static var previews: some View {
 		let preferences = Preferences()
 
-		SystemView(simulator: .example, controller: SimulatorsController(preferences: preferences))
+		SystemView(simulator: .example)
 			.environmentObject(preferences)
     }
 }
```

**File**: `ControlRoom/Simulator UI/ControlView.swift` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ struct ControlView: View {
 
     var body: some View {
         TabView {
-            SystemView(simulator: simulator, controller: controller)
+            SystemView(simulator: simulator)
                 .disabled(simulator.state != .booted)
             SnapshotsView(simulator: simulator, controller: controller)
             Group {
```

---

### Incident Patch 8: `98dcd41f` (2024-06-20)
**Commit Message**: Workaround: Only set status bar time

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +6/-1)
```diff
@@ -105,7 +105,12 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func overrideStatusBarTime(_ simulator: String, time: Date) {
-        let timeString = ISO8601DateFormatter().string(from: time)
+        // Use only time for now since ISO8601 parsing is broken since Xcode 15.3
+        // https://stackoverflow.com/a/59071895
+        // let timeString = ISO8601DateFormatter().string(from: time)
+        let timeOnlyFormatter = DateFormatter()
+        timeOnlyFormatter.dateFormat = "hh:mm"
+        let timeString = timeOnlyFormatter.string(from: time)
         execute(.statusBar(deviceId: simulator, operation: .override([.time(timeString)])))
     }
     static func setAppearance(_ simulator: String, appearance: UI.Appearance) {
```

---

### Incident Patch 9: `2bd731ed` (2023-12-20)
**Commit Message**: Fix screenshot device chrome issue with Xcode 15

**File**: `ControlRoom/Controllers/ChromeRendering/ChromeRenderer.swift` (modified, +5/-1)
```diff
@@ -98,7 +98,11 @@ class ChromeRenderer {
         let mainIdentifier = device.chromeIdentifier.components(separatedBy: ".").last ?? "phone"
 
         // Now use that last part to find the PDFs and placement JSON.
-        let chromePath = "\(basePath)/Chrome/\(mainIdentifier).simdevicechrome/Contents/Resources"
+        var chromePath = "\(basePath)/Chrome/\(mainIdentifier).devicechrome/Contents/Resources"
+        if !FileManager.default.fileExists(atPath: chromePath) {
+            // Before Xcode 15, the path used `simdevicechrome`, not `devicechrome`, so fall back to that
+            chromePath = "\(basePath)/Chrome/\(mainIdentifier).simdevicechrome/Contents/Resources"
+        }
         baseURL = URL(filePath: chromePath)
 
         let chromeURL = URL(filePath: "\(chromePath)/chrome.json")
```

---

### Incident Patch 10: `9a37f749` (2023-11-28)
**Commit Message**: feat: turn methods private and fix text moving depending on number text from slider

feat: change indentation to spacebar

**File**: `ControlRoom/Simulator UI/ControlScreens/StatusBarView.swift` (modified, +39/-13)
```diff
@@ -110,8 +110,16 @@ struct StatusBarView: View {
                     .pickerStyle(.radioGroup)
 
                     VStack(spacing: 0) {
-                        Text("Current battery percentage: \(Int(round(batteryLevel)))%")
-                        Slider(value: $batteryLevel, in: 0...100, onEditingChanged: levelChanged, minimumValueLabel: Text("0%"), maximumValueLabel: Text("100%")) {
+						Text("Current battery percentage: \(Int(round(batteryLevel)))%")
+							.font(.callout.monospacedDigit())
+
+						Slider(
+							value: $batteryLevel,
+							in: 0...100,
+							onEditingChanged: levelChanged,
+							minimumValueLabel: Text("0%"),
+							maximumValueLabel: Text("100%")
+						) {
                             Text("Level:")
                         }
                     }
@@ -125,12 +133,14 @@ struct StatusBarView: View {
         }
     }
 
+    // MARK: Private methods
+
     /// Changes the system clock to a new value.
-    func setTime() {
+    private func setTime() {
         SimCtl.overrideStatusBarTime(simulator.udid, time: time)
     }
 
-    func setAppleTime() {
+	private func setAppleTime() {
         let calendar = Calendar.current
         var components = calendar.dateComponents([.year, .month, .day], from: Date.now)
         components.hour = 9
@@ -145,36 +155,52 @@ struct StatusBarView: View {
 
     /// Sends status bar updates all at once; simctl gets unhappy if we send them individually, but
     /// also for whatever reason prefers cellular data sent separately from WiFi.
-    func updateWiFiData() {
-        SimCtl.overrideStatusBarWiFi(simulator.udid, network: dataNetwork,
-                                        wifiMode: wiFiMode, wifiBars: wiFiBar)
+	private func updateWiFiData() {
+		SimCtl.overrideStatusBarWiFi(
+			simulator.udid,
+			network: dataNetwork,
+			wifiMode: wiFiMode,
+			wifiBars: wiFiBar
+		)
     }
 
-    func updateCellularData() {
-        SimCtl.overrideStatusBarCellular(simulator.udid, cellMode: cellularMode,
-                                        cellBars: cellularBar, carrier: carrierName)
+    private func updateCellularData() {
+		SimCtl.overrideStatusBarCellular(
+			simulator.udid,
+			cellMode: cellularMode,
+			cellBars: cellularBar,
+			carrier: carrierName
+		)
     }
 
     /// Sends battery updates all at once; simctl gets unhappy if we send them individually.
-    func updateBattery() {
-        SimCtl.overrideStatusBarBattery(simulator.udid, level: Int(batteryLevel), state: batteryState)
+    private func updateBattery() {
+		SimCtl.overrideStatusBarBattery(
+			simulator.udid,
+			level: Int(batteryLevel),
+			state: batteryState
+		)
     }
 
     /// Triggered when the user adjusts the battery level.
-    func levelChanged(_ isEditing: Bool) {
+    private func levelChanged(_ isEditing: Bool) {
         if isEditing == false {
             updateBattery()
         }
     }
 }
 
+// MARK: Preview
+
 struct StatusBarViewView_Previews: PreviewProvider {
     static var previews: some View {
         StatusBarView(simulator: .example)
             .environmentObject(Preferences())
     }
 }
 
+// MARK: Extensions
+
 extension SimCtl.StatusBar.DataNetwork {
     var displayName: String {
         switch self {
```

#### Recent Merged Pull Requests:
- **PR #206** (2026-04-05): Fix Swift 6 concurrency warnings and retroactive conformance (#199) (@elio-Wang)
- **PR #204** (2025-10-15): Fixed linter errors, warnings, and rule definition (@PerlBeforeSwine)
- **PR #200** (2025-05-02): suppress data <-> string lint rules (@sbeitzel)
- **PR #198** (2025-05-01): Remove redundant initializers (@sbeitzel)
- **PR #197** (2025-05-01): Add .editorconfig to help with formatting, clear whitespace warnings (@sbeitzel)
- **PR #195** (closed): Show preview and testing devices (@SeanRobinson159)
- **PR #194** (2025-04-21): Support For Arabic Localization (@Addallah)
- **PR #193** (2025-01-24): Add feature to clear the Status Bar overrides (@MultiColourPixel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
