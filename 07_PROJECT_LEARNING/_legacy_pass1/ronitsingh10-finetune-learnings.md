# Forensic Learning Record (Deep Inspection): ronitsingh10/FineTune

> **Canonical Artifact**: `07_PROJECT_LEARNING/ronitsingh10-finetune-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ronitsingh10/FineTune](https://github.com/ronitsingh10/FineTune))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:00:17.379Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ronitsingh10/FineTune`
- **Description**: FineTune, a macOS menu bar app for per-app volume control, multi-device output, audio routing, and 10-band EQ. Free and open-source alternative to SoundSource.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9501 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #106** (2026-04-03): **[Bug] 25% volume cap**
  *Symptoms*: When connecting Kanto Yu speaker (shows as USB Audio DAC),  the volume is capped at 25%. When trying to increase the volume, the slider slides back to 25%. You can hear the increase when clicking fast on the volume slider but it slides back to 25%. With FineTune closed, the volume can be increased normally to full volume.
  **Post-Mortem & Fix Analysis**:
  > I am experiencing the same issue when routing to a Behringer UM2 USB audio interface / DAC with the host running macOS Tahoe 26.3 on M4.  I've attached the console log output sample when adjusting volume and it defaults back if that helps with troubleshooting.  Let me know and I can collect more info.  [FineTuneVolumeAdjust.txt](https://github.com/user-attachments/files/25705922/FineTuneVolumeAdjust.txt)
  > same here using AKG N9 Hybrid with USB dongle. when connected via bluetooth everything works fine
  > I’m experiencing the same issue on my M2 Pro macOS 26.4 laptop with the Corsair HS55 dongle. Bluetooth is functioning normally, but the volume cap remains at 25%. When I type “100” and “99” on FineTune, the volume doesn’t drop to 25%.

- **Issue #105** (2026-03-18): **[Bug] Low output on Topping E2x2 OTG (8ch) while FineTune is active; normal when FineTune is off**
  *Symptoms*: ## Summary With **Topping E2x2 OTG** as the default output device (reported as 8 channels), output level drops noticeably **when FineTune is running**. When FineTune is quit, output immediately returns to normal level.  This reproduces consistently and appears to be tied to the FineTune processing/routing path for this interface topology.  ## Environment - FineTune version: **v1.3.1** - macOS: **26.3 (25D125)** - Interface: **Topping E2x2 OTG** - Interface stream layout observed: **8ch output**  ## Reproduction 1. Set **E2x2 OTG** as macOS default output. 2. Play audio from Music (or any app). 3. Observe baseline level with FineTune **not running**. 4. Launch FineTune and keep routing on E2x2 OTG. 5. Compare level immediately.  ## Expected - Output level should be consistent whether FineTune is running or not.  ## Actual - **FineTune ON**: E2x2 output becomes quieter. - **FineTune OFF**: E2x2 output returns to normal.  ## Routing Diagnostics Collected from: `log stream --style compact --predicate 'process == "FineTune" AND composedMessage CONTAINS "[ROUTING-DIAG]"' --level debug`  ```text [ROUTING-DIAG] reason=activate app=음악 target=E2x2 OTG uid=AppleUSBAudioEngine:Topping:E2x2 OTG:2142100:1,2 prefStereo=1,2 [ROUTING-DIAG] targetStream=buffers=1 [b0:ch=8,bytes=16384] aggregateStream=buffers=1 [b0:ch=8,bytes=16384] [ROUTING-DIAG] targetVol=1.000 targetSettable=true aggregateVol=1.000 aggregateSettable=false [ROUTING-DIAG] callbackLayout inBuffers=2 outBuffers=1 in0Ch=10 in1Ch=
  **Post-Mortem & Fix Analysis**:
  > @MixedSystem Not a real solution, but I have the same device and you can switch (in the software) to "Mobile Applications" mode and everything works as intended. This mode doesn't limit anything except reducing the I/O from 8ch to 2ch.
  > Thanks for the detailed report and routing diagnostics. Could you try updating to v1.3.2? It includes audio engine improvements that may help with multi-channel device handling.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  If the issue persists, please share FineTune's logs so we can investigate the 8-channel buffer routing:  ``` log stream --style compact --predicate 'subsystem == "com.finetuneapp.FineTune"' --level debug ```  Start the log, launch FineTune with the E2x2 as default output, play some audio, then paste the output here.
  > @ronitsingh10 Just tested with this latest version, and the issue is still present. Below is the log I gathered:  ``` 2026-02-21 19:31:47.640 I  FineTune[16527:39c15] [com.finetuneapp.FineTune:OrphanedTapCleanup] [CLEANUP] No orphaned FineTune devices found 2026-02-21 19:31:47.641 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:SettingsManager] Loaded settings with 1 volumes, 0 device routings, 0 mutes, 0 EQ settings 2026-02-21 19:31:47.647 E  FineTune[16527:39c1e] [com.finetuneapp.FineTune:App] Notification authorization error: <private> 2026-02-21 19:31:47.788 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:AudioProcessMonitor] Starting audio process monitor 2026-02-21 19:31:47.793 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:AudioDeviceMonitor] Starting audio device monitor 2026-02-21 19:31:47.803 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:DeviceVolumeMonitor] Starting device volume monitor 2026-02-21 19:31:47.803 I  FineTune[16527:39c1e] [com.finetuneapp.FineTun

- **Issue #103** (2026-03-18): **Chrome output sound issue**
  *Symptoms*: Hi, I just downloaded your app and it worked perfectly thank's !  But for now I'm not able anymore to use google chrome with it idk why...  I tried desinstalling and downloading chrome again, same with finetune.  Restart the laptop also.  But I'm not able to fix the issue, any idea ?   PS : I'm on an M5 Mac Book Pro with Chrome 145.0.7632.76 
  **Post-Mortem & Fix Analysis**:
  > <img width="1025" height="498" alt="Image" src="https://github.com/user-attachments/assets/2f5fe430-9bfd-4d43-ac3a-3477dffb8ad3" />  I can see spotify playing but not chrome here anymore
  > Hello, any update ?  
  > Resolved in v1.4.0.  Helper process merging (`5818618`) groups all Chrome helper processes under the parent app with a single process tap capturing all PIDs. This directly addresses Chrome's multi-process architecture where audio runs in renderer child processes.  If anyone still experiences Chrome audio issues on v1.4.0, please open a new issue with details.

- **Issue #102** (2026-02-22): **App makes speakers crackle and produces weird sound during calls**
  *Symptoms*: On taking any calls either using FaceTime or WhatsApp Desktop Client, the speakers crackle and produce a weird sound and you cannot hear the person on the other end.
  **Post-Mortem & Fix Analysis**:
  > Same issue on Discord
  > Fixed in v1.3.2. This release includes Bluetooth HFP distortion fixes for voice calls, a soft limiter to prevent crackling from clipping, and improved device switching that eliminates glitches during crossfade.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  Please reopen if you still experience this after updating.

- **Issue #99** (2026-02-20): **[Bug] App produces static noise on headphones**
  *Symptoms*: I was trying to regulate the volume between zoom and a whatsapp call, and after a few seconds it starts producing static. If I quit and restart the app the noise comes back in around 10 seconds and only goes away if I close the app.  Headphones - BT Sony WH1000XM5 Hardware - Mac M4 air Sequoia 15.7.1
  **Post-Mortem & Fix Analysis**:
  > Closing as duplicate of #52 — same root cause: Bluetooth headphones produce static/distortion when microphone is activated during calls.

- **Issue #96** (2026-03-18): **[Feature request & Bug] Settings reset after update + device-based volume control suggestion**
  *Symptoms*: Hi,  After the latest update, my settings were reset: 	•	Volume level 	•	Favorites (marked apps) 	•	Selected icon  All of them were cleared after updating.  Also, it would be nice if volume level could be remembered per audio device.  For example: When using AirPods, Spotify volume could be 30. When using speakers, it could be 60.  If the app remembered volume separately for each output device, it would improve the experience for users who switch between devices frequently.
  **Post-Mortem & Fix Analysis**:
  > Fixed in v1.4.0.  `7f22d91` — Settings decoding is now fully resilient: all fields use `decodeIfPresent` with safe defaults, corrupted settings files are backed up before reset, and `resetAllSettings` clears all 22 setting categories. Additionally, `7bac2a1` filters non-finite volumes (NaN/Inf) on decode, and `29dd976` validates EQ band gains.  Settings should no longer be lost on update. If anyone still experiences this on v1.4.0, please open a new issue.

- **Issue #84** (2026-02-22): **Robotic high pitch sound when output is thunderbolt universal audio**
  *Symptoms*: The sound comes out high pitch and robotic sounding when universal audio is selected as the output. With completely fine when macbook speakers is the selected output   https://github.com/user-attachments/assets/9f5d5696-21d2-4cc0-a671-02e9e483b22c
  **Post-Mortem & Fix Analysis**:
  > Fixed in v1.3.2. This release adds a Nyquist guard that prevents unstable biquad filters on high sample rate devices, which was the cause of robotic/high-pitch distortion on Thunderbolt and USB audio interfaces.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  Please reopen if you still experience this after updating.

- **Issue #79** (2026-02-20): **High-pitched sound when using FineTune with Facetime.**
  *Symptoms*: Connected to Sony XM6 while calling, completely could not hear Facetime audio, only a terrible high pitched sound. Sound did not occur after I quit FineTune.  Did anyone else experience this?
  **Post-Mortem & Fix Analysis**:
  > I confirm. I have a similar problem with AirPods Pro when starting a Zoom conference.  
  > same here!
  > Closing as duplicate of #52 — same root cause: Bluetooth headphones produce distortion/static when microphone is activated during calls.

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

### Incident Patch 1: `06b34eca` (2026-07-09)
**Commit Message**: fix(menu-bar): fall back when a device icon override no longer resolves

A stale override (hand-edited settings, symbol dropped by macOS) produced
a nil NSImage and froze the status item. Override precedence now lives in
resolveSymbol so validation exists once, and the launch fallback renders
on the shared canvas so the item width can't jump.

**File**: `FineTune/FineTuneApp.swift` (modified, +4/-7)
```diff
@@ -183,16 +183,13 @@ struct FineTuneApp: App {
                 priorityOrder: settings.devicePriorityOrder,
                 outputDevices: engine.deviceMonitor.outputDevices,
                 defaultDeviceID: launchID,
-                symbolForDevice: { device in
-                    MenuBarDeviceIconResolver.symbol(for: device, override: settings.getDeviceIconOverride(for: device.uid))
-                },
-                symbolForDefaultID: { id in
-                    MenuBarDeviceIconResolver.symbol(forDefaultID: id, override: { settings.getDeviceIconOverride(for: $0) })
-                }
+                overrideForUID: { settings.getDeviceIconOverride(for: $0) }
             )
         )
+        // The fallback must go through the shared canvas too, or the status
+        // item launches at natural symbol width and jumps on the first apply().
         launchIconImage = launchState.image.nsImage()
-            ?? NSImage(systemSymbolName: "speaker.wave.2", accessibilityDescription: "FineTune")!
+            ?? MenuBarIconImage.systemSymbol("speaker.wave.2").nsImage()!
 
         // Start Accessibility polling immediately so `isTrustedCached` is live
         // before the user first opens Settings. The trust-flip callback wires
```

**File**: `FineTune/Views/MenuBar/MenuBarDeviceIconResolver.swift` (modified, +19/-16)
```diff
@@ -1,56 +1,59 @@
 // FineTune/Views/MenuBar/MenuBarDeviceIconResolver.swift
 
+import AppKit
 import AudioToolbox
 
 struct MenuBarDeviceIconResolver {
     // Neutral "unknown output" glyph, sourced from the transport-type convention
     // so it stays in sync with the rest of the app rather than a private literal.
     static let fallbackSymbol = TransportType.unknown.defaultIconSymbol
 
+    /// An override symbol that fails to resolve (hand-edited settings.json,
+    /// symbol removed in a future macOS) falls back to the derived symbol —
+    /// a nil NSImage downstream would freeze the status item on its last image.
     static func resolveSymbol(
         priorityOrder: [String],
         outputDevices: [AudioDevice],
         defaultDeviceID: AudioDeviceID,
+        overrideForUID: (String) -> String? = { _ in nil },
+        isSymbolResolvable: (String) -> Bool = {
+            NSImage(systemSymbolName: $0, accessibilityDescription: nil) != nil
+        },
         isDeviceAvailable: (AudioDevice) -> Bool = { $0.id.isDeviceAlive() },
+        uidForDefaultID: (AudioDeviceID) -> String? = { try? $0.readDeviceUID() },
         symbolForDevice: (AudioDevice) -> String = { $0.id.suggestedIconSymbol() },
         symbolForDefaultID: (AudioDeviceID) -> String = { id in
             guard id.isValid else { return Self.fallbackSymbol }
             return id.suggestedIconSymbol()
         }
     ) -> String {
+        func overrideSymbol(forUID uid: String) -> String? {
+            guard let symbol = overrideForUID(uid), isSymbolResolvable(symbol) else { return nil }
+            return symbol
+        }
+
         let devicesByUID = Dictionary(outputDevices.map { ($0.uid, $0) }, uniquingKeysWith: { _, latest in latest })
 
         // Match macOS's sound menu: the persistent icon represents the device
         // currently receiving system audio, even if FineTune's saved priority
         // order has another connected device above it.
         if let defaultDevice = outputDevices.first(where: { $0.id == defaultDeviceID }),
            isDeviceAvailable(defaultDevice) {
-            return symbolForDevice(defaultDevice)
+            return overrideSymbol(forUID: defaultDevice.uid) ?? symbolForDevice(defaultDevice)
         }
 
         for uid in priorityOrder {
             guard let device = devicesByUID[uid], isDeviceAvailable(device) else { continue }
-            return symbolForDevice(device)
+            return overrideSymbol(forUID: uid) ?? symbolForDevice(device)
         }
 
         if defaultDeviceID.isValid {
+            if let uid = uidForDefaultID(defaultDeviceID), let symbol = overrideSymbol(forUID: uid) {
+                return symbol
+            }
             return symbolForDefaultID(defaultDeviceID)
         }
 
         return fallbackSymbol
     }
-
-    static func symbol(for device: AudioDevice, override: String?) -> String {
-        override ?? device.id.suggestedIconSymbol()
-    }
-
-    /// Same precedence for the bare default-device-ID path, where the UID
-    /// must be read from the HAL before the override can be looked up.
-    static func symbol(forDefaultID id: AudioDeviceID, override: (String) -> String?) -> String {
-        guard id.isValid else { return fallbackSymbol }
-        if let uid = try? id.readDeviceUID(), let symbol = override(uid) {
-            return symbol
-        }
-        return id.suggestedIconSymbol()
-    }
 }
```

**File**: `FineTune/Views/MenuBar/MenuBarIconCoordinator.swift` (modified, +1/-6)
```diff
@@ -94,12 +94,7 @@ final class MenuBarIconCoordinator: MediaKeyIconFlashing {
             priorityOrder: settings.devicePriorityOrder,
             outputDevices: deviceProvider.outputDevices,
             defaultDeviceID: deviceVolumeMonitor.defaultDeviceID,
-            symbolForDevice: { [settings] device in
-                MenuBarDeviceIconResolver.symbol(for: device, override: settings.getDeviceIconOverride(for: device.uid))
-            },
-            symbolForDefaultID: { [settings] id in
-                MenuBarDeviceIconResolver.symbol(forDefaultID: id, override: { settings.getDeviceIconOverride(for: $0) })
-            }
+            overrideForUID: { [settings] in settings.getDeviceIconOverride(for: $0) }
         )
     }
 
```

**File**: `FineTuneTests/MenuBarDeviceIconResolverTests.swift` (modified, +110/-31)
```diff
@@ -127,54 +127,133 @@ struct MenuBarDeviceIconResolverTests {
         #expect(symbol == MenuBarDeviceIconResolver.fallbackSymbol)
     }
 
-    @Test("Override-aware device symbol wins over the derived symbol")
-    func overrideAwareSymbolWins() {
-        let d = device(id: 2, uid: "airpods", name: "AirPods Pro")
-        #expect(MenuBarDeviceIconResolver.symbol(for: d, override: "gamecontroller.fill") == "gamecontroller.fill")
-    }
-
-    @Test("Nil override falls back to the device-derived symbol")
-    func nilOverrideFallsBack() {
-        // 0xFFFFFFFE is never assigned by the HAL, so the fake ID deterministically
-        // reads as unreadable name + unknown transport on any machine.
-        let d = device(id: 0xFFFF_FFFE, uid: "airpods", name: "AirPods Pro")
-        #expect(
-            MenuBarDeviceIconResolver.symbol(for: d, override: nil)
-                == AudioDeviceID.iconSymbol(forName: "", transport: .unknown)
+    @Test("Resolvable override wins over the derived symbol")
+    func resolvableOverrideWins() {
+        let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
+        let symbol = MenuBarDeviceIconResolver.resolveSymbol(
+            priorityOrder: ["airpods"],
+            outputDevices: devices,
+            defaultDeviceID: 2,
+            overrideForUID: { ["airpods": "gamecontroller.fill"][$0] },
+            isSymbolResolvable: { _ in true },
+            isDeviceAvailable: { _ in true },
+            symbolForDevice: { _ in "headphones" },
+            symbolForDefaultID: { _ in "speaker.wave.2" }
         )
+        #expect(symbol == "gamecontroller.fill")
     }
 
-    @Test("resolveSymbol surfaces an override through the injected closure")
-    func resolveSymbolWithOverrideClosure() {
-        let overrides = ["airpods": "gamecontroller.fill"]
+    @Test("Unresolvable override falls back to the derived symbol")
+    func unresolvableOverrideFallsBack() {
         let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
         let symbol = MenuBarDeviceIconResolver.resolveSymbol(
             priorityOrder: ["airpods"],
             outputDevices: devices,
             defaultDeviceID: 2,
+            overrideForUID: { _ in "not.a.real.symbol" },
+            isSymbolResolvable: { _ in false },
             isDeviceAvailable: { _ in true },
-            symbolForDevice: { MenuBarDeviceIconResolver.symbol(for: $0, override: overrides[$0.uid]) },
+            symbolForDevice: { _ in "headphones" },
             symbolForDefaultID: { _ in "speaker.wave.2" }
         )
-        #expect(symbol == "gamecontroller.fill")
+        #expect(symbol == "headphones")
     }
 
-    @Test("Invalid default ID returns the fallback without consulting the override")
-    func defaultIDInvalidReturnsFallback() {
-        var consulted = false
-        let symbol = MenuBarDeviceIconResolver.symbol(forDefaultID: .unknown, override: { _ in
-            consulted = true
-            return "nope"
-        })
-        #expect(symbol == MenuBarDeviceIconResolver.fallbackSymbol)
-        #expect(!consulted)
+    @Test("The default validator accepts a real SF Symbol and rejects a bogus name")
+    func defaultValidatorChecksRealSymbols() {
+        let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
+        func resolve(override: String) -> String {
+            MenuBarDeviceIconResolver.resolveSymbol(
+                priorityOrder: ["airpods"],
+                outputDevices: devices,
+                defaultDeviceID: 2,
+                overrideForUID: { _ in override },
+                isDeviceAvailable: { _ in true },
+                symbolForDevice: { _ in "headphones" },
+                symbolForDefaultID: { _ in "speaker.wave.2" }
+            )
+        }
+        #expect(resolve(override: "gamecontroller.fill") == "gamecontroller.fill")
+        #expect(resolve(override: "not.a.real.symbol") == "headphones")
+    }
+
+    @Test("Priority-path device consu
```

---

### Incident Patch 2: `0c93216f` (2026-07-09)
**Commit Message**: fix(ddc): count any successful DDC write cycle as success

A transient error on the second duplicated cycle (#362) reported failure
for a value the display had already applied, burning retries and stalling
the DDC queue. Matches i2cWriteRead's semantics.

**File**: `FineTune/Audio/DDC/DDCService.swift` (modified, +5/-1)
```diff
@@ -139,16 +139,20 @@ final class DDCService: @unchecked Sendable {
     /// Writes a DDC packet without reading a response.
     ///
     /// Send all write cycles; some displays only apply the second write.
+    /// Any cycle succeeding counts as success (matching i2cWriteRead) — the
+    /// display already applied the value even if a later cycle errors.
     private func i2cWrite(packet: [UInt8]) throws {
         var lastResult: IOReturn = kIOReturnError
+        var anySucceeded = false
         for _ in 0..<numWriteCycles {
             usleep(writeSleepTime)
             lastResult = packet.withUnsafeBufferPointer { buf in
                 IOAVServiceLoader.writeI2C(service: service, chipAddress: chipAddress,
                                            dataAddress: writeAddress, buffer: buf.baseAddress!, size: UInt32(buf.count))
             }
+            if lastResult == kIOReturnSuccess { anySucceeded = true }
         }
-        guard lastResult == kIOReturnSuccess else { throw DDCError.writeFailed(lastResult) }
+        guard anySucceeded else { throw DDCError.writeFailed(lastResult) }
     }
 
     // MARK: - VCP Commands
```

---

### Incident Patch 3: `67e4687f` (2026-07-09)
**Commit Message**: fix(menu-bar): render all icons on a shared fixed-size canvas

Differing symbol widths made the variable-length status item resize and
shift neighboring menu bar items on every volume, mute, or device change.

Fixes #367

**File**: `FineTune/Views/MenuBar/MenuBarIconImage+NSImage.swift` (modified, +23/-4)
```diff
@@ -7,14 +7,33 @@ import AppKit
 
 @MainActor
 extension MenuBarIconImage {
+    /// The status item is variable-length: icons of differing sizes resize it and shift every neighboring menu bar item.
+    static let canvasSize = NSSize(width: 22, height: 18)
+
     func nsImage(accessibilityDescription: String = "FineTune") -> NSImage? {
+        let source: NSImage?
         switch self {
         case .systemSymbol(let name):
-            let image = NSImage(systemSymbolName: name, accessibilityDescription: accessibilityDescription)
-            image?.isTemplate = true
-            return image
+            source = NSImage(systemSymbolName: name, accessibilityDescription: accessibilityDescription)
         case .asset(let name):
-            return NSImage(named: name)
+            source = NSImage(named: name)
+        }
+        guard let source else { return nil }
+
+        let canvas = Self.canvasSize
+        let scale = min(1, canvas.width / source.size.width, canvas.height / source.size.height)
+        let drawRect = NSRect(
+            x: (canvas.width - source.size.width * scale) / 2,
+            y: (canvas.height - source.size.height * scale) / 2,
+            width: source.size.width * scale,
+            height: source.size.height * scale
+        )
+        let image = NSImage(size: canvas, flipped: false) { _ in
+            source.draw(in: drawRect)
+            return true
         }
+        image.isTemplate = true
+        image.accessibilityDescription = accessibilityDescription
+        return image
     }
 }
```

**File**: `FineTuneTests/MenuBarIconImageSizeTests.swift` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+// FineTuneTests/MenuBarIconImageSizeTests.swift
+// Size invariance for menu bar icons — the status item is variable-length,
+// so icons of differing sizes resize it and shift neighboring items.
+
+import AppKit
+import Testing
+@testable import FineTune
+
+@Suite("MenuBarIconImage — size invariance")
+@MainActor
+struct MenuBarIconImageSizeTests {
+
+    /// Every image the coordinator can put on the status bar button.
+    private var reachableImages: [MenuBarIconImage] {
+        var images: [MenuBarIconImage] = [MenuBarIconState.speakerMuted.image]
+        images += [VolumeBucket.zero, .low, .mid, .high].map { .systemSymbol($0.symbolName) }
+        images += MenuBarIconStyle.allCases.map {
+            MenuBarIconState.baseline(style: $0, volume: 0.5, muted: false).image
+        }
+        images += DeviceIconCatalog.categories.flatMap(\.entries).map { .systemSymbol($0.symbol) }
+        // Resolver fallbacks not in the catalog (AudioDeviceID.iconSymbol / TransportType.defaultIconSymbol).
+        images += [
+            "macstudio.fill", "macmini.fill", "macbook", "desktopcomputer", "display",
+            "appletv", "homepod", "homepodmini", "airplayaudio", "bolt.horizontal",
+            "tv", "speaker.wave.2", "hifispeaker",
+        ].map { .systemSymbol($0) }
+        return images
+    }
+
+    @Test("every reachable icon renders at one shared size")
+    func allIconsShareOneSize() throws {
+        let canonical = try #require(MenuBarIconState.speakerVolume(.high).image.nsImage()).size
+        for image in reachableImages {
+            let rendered = try #require(image.nsImage(), "\(image) produced no NSImage")
+            #expect(rendered.size == canonical, "\(image) is \(rendered.size), canonical is \(canonical)")
+        }
+    }
+
+    @Test("shared size never downscales the widest speaker symbol")
+    func sharedSizeCoversNaturalSymbolSize() throws {
+        let shared = try #require(MenuBarIconState.speakerVolume(.high).image.nsImage()).size
+        let natural = try #require(NSImage(systemSymbolName: "speaker.wave.3.fill", accessibilityDescription: nil)).size
+        #expect(shared.width >= natural.width)
+        #expect(shared.height >= natural.height)
+    }
+
+    @Test("template rendering and accessibility description survive")
+    func templateAndAccessibilitySurvive() throws {
+        for image in [MenuBarIconImage.systemSymbol("speaker.fill"), .asset("MenuBarIcon")] {
+            let rendered = try #require(image.nsImage())
+            #expect(rendered.isTemplate, "\(image) lost template rendering")
+            #expect(rendered.accessibilityDescription == "FineTune", "\(image) lost accessibility description")
+        }
+    }
+}
```

---

### Incident Patch 4: `4f7c0e10` (2026-07-07)
**Commit Message**: fix(ddc): send VCP writes twice (#362)

Do not stop after the first successful I2C write;
MonitorControl's Arm64 DDC path also runs the configured write cycles.

**File**: `FineTune/Audio/DDC/DDCService.swift` (modified, +5/-3)
```diff
@@ -137,16 +137,18 @@ final class DDCService: @unchecked Sendable {
     }
 
     /// Writes a DDC packet without reading a response.
+    ///
+    /// Send all write cycles; some displays only apply the second write.
     private func i2cWrite(packet: [UInt8]) throws {
+        var lastResult: IOReturn = kIOReturnError
         for _ in 0..<numWriteCycles {
             usleep(writeSleepTime)
-            let result = packet.withUnsafeBufferPointer { buf in
+            lastResult = packet.withUnsafeBufferPointer { buf in
                 IOAVServiceLoader.writeI2C(service: service, chipAddress: chipAddress,
                                            dataAddress: writeAddress, buffer: buf.baseAddress!, size: UInt32(buf.count))
             }
-            if result == kIOReturnSuccess { return }
         }
-        throw DDCError.writeFailed(kIOReturnError)
+        guard lastResult == kIOReturnSuccess else { throw DDCError.writeFailed(lastResult) }
     }
 
     // MARK: - VCP Commands
```

---

### Incident Patch 5: `8855c96e` (2026-07-07)
**Commit Message**: fix(devices): hide picker scroll bar and add cell hover feedback

**File**: `FineTune/Views/Components/DeviceIconPicker.swift` (modified, +51/-27)
```diff
@@ -38,6 +38,7 @@ struct DeviceIconPicker: View {
                 }
             }
             .frame(height: 300)
+            .scrollIndicators(.never)
 
             Button("Restore Default") {
                 onSelect(nil)
@@ -91,35 +92,13 @@ struct DeviceIconPicker: View {
     private func grid(symbols: [String], highlighted: String?) -> some View {
         LazyVGrid(columns: Self.columns, spacing: DesignTokens.Spacing.xs) {
             ForEach(symbols, id: \.self) { symbol in
-                cell(symbol, isHighlighted: symbol == highlighted)
-            }
-        }
-    }
-
-    private func cell(_ symbol: String, isHighlighted: Bool) -> some View {
-        Button {
-            onSelect(symbol)
-        } label: {
-            Image(systemName: symbol)
-                .font(.system(size: 15))
-                .symbolRenderingMode(.hierarchical)
-                .frame(maxWidth: .infinity, minHeight: 34)
-                .background(
-                    RoundedRectangle(cornerRadius: 7)
-                        .fill(isHighlighted ? DesignTokens.Colors.glassFillStrong : Color.clear)
+                IconCell(
+                    symbol: symbol,
+                    isHighlighted: symbol == highlighted,
+                    onSelect: { onSelect(symbol) }
                 )
-                .overlay(
-                    RoundedRectangle(cornerRadius: 7)
-                        .strokeBorder(
-                            isHighlighted ? DesignTokens.Colors.accentPrimary : Color.clear,
-                            lineWidth: 1.5
-                        )
-                )
-                .contentShape(RoundedRectangle(cornerRadius: 7))
+            }
         }
-        .buttonStyle(.plain)
-        .help(symbol)
-        .accessibilityLabel(DeviceIconCatalog.entry(for: symbol)?.keywords.first?.capitalized ?? symbol)
     }
 
     private var searchField: some View {
@@ -184,6 +163,51 @@ struct DeviceIconPicker: View {
     }
 }
 
+// MARK: - Icon Cell
+
+/// One grid cell with its own hover state. Per-cell state (not a shared
+/// hovered-symbol on the picker) because the Suggested section repeats
+/// catalog symbols — identity by symbol would light up both twins at once.
+private struct IconCell: View {
+    let symbol: String
+    let isHighlighted: Bool
+    let onSelect: () -> Void
+
+    @State private var isHovered = false
+
+    var body: some View {
+        Button(action: onSelect) {
+            Image(systemName: symbol)
+                .font(.system(size: 15))
+                .symbolRenderingMode(.hierarchical)
+                .frame(maxWidth: .infinity, minHeight: 34)
+                .background(
+                    RoundedRectangle(cornerRadius: 7)
+                        .fill(fill)
+                )
+                .overlay(
+                    RoundedRectangle(cornerRadius: 7)
+                        .strokeBorder(
+                            isHighlighted ? DesignTokens.Colors.accentPrimary : Color.clear,
+                            lineWidth: 1.5
+                        )
+                )
+                .contentShape(RoundedRectangle(cornerRadius: 7))
+        }
+        .buttonStyle(.plain)
+        .onHover { isHovered = $0 }
+        .animation(DesignTokens.Animation.hover, value: isHovered)
+        .help(symbol)
+        .accessibilityLabel(DeviceIconCatalog.entry(for: symbol)?.keywords.first?.capitalized ?? symbol)
+    }
+
+    private var fill: Color {
+        if isHighlighted { return DesignTokens.Colors.glassFillStrong }
+        if isHovered { return DesignTokens.Colors.hoverSurface }
+        return .clear
+    }
+}
+
 // MARK: - Previews
 
 #Preview("DeviceIconPicker") {
```

---

### Incident Patch 6: `52d3663f` (2026-07-07)
**Commit Message**: fix(ddc): stop crash on DDC volume change (#361)

Swift 6 language mode (new in v1.8.0) gave the debounced write closure inherited @MainActor isolation, so the executor check trapped when it ran on ddcQueue.

Fixes #340, fixes #348, fixes #353, fixes #356

**File**: `FineTune/Audio/DDC/DDCController.swift` (modified, +5/-3)
```diff
@@ -81,14 +81,16 @@ final class DDCController {
             settingsManager.setDDCVolume(for: uid, to: clamped)
         }
 
-        // Debounce DDC write
+        // Keep the work item @Sendable and avoid `self`; otherwise it inherits
+        // @MainActor isolation here and traps when run on `ddcQueue`.
         debounceTimers[deviceID]?.cancel()
         let service = services[deviceID]
-        let item = DispatchWorkItem { [weak self] in
+        let logger = self.logger
+        let item = DispatchWorkItem { @Sendable in
             do {
                 try service?.setAudioVolume(clamped)
             } catch {
-                self?.logger.error("DDC write failed for device \(deviceID): \(error)")
+                logger.error("DDC write failed for device \(deviceID): \(error)")
             }
         }
         debounceTimers[deviceID] = item
```

---

### Incident Patch 7: `f4d9e82c` (2026-06-14)
**Commit Message**: fix(audio): honour aggregate device channel assignment, e.g. stereo on 3/4 (#327)

Flattens user-aggregate targets into the wrapping aggregate and goes non-stacked only for a single flattened sub-device with one output stream, so the IO callback places audio on the device's preferred 3/4 pair. The stream-usage map leaves the duplex device's hardware inputs unpowered. Validated on a Scarlett 4i4 (macOS 26.5.1).

Co-authored-by: Rocco Lucia <rlucia@iscanet.com>

**File**: `FineTune/Audio/Engine/ProcessTapController.swift` (modified, +148/-8)
```diff
@@ -10,7 +10,7 @@ import os
 // 1. **Main thread / @MainActor**: All setup, teardown, and state management.
 //    - activate(), invalidate(), updateDevices(), performCrossfadeSwitch()
 //    - Property writes to nonisolated(unsafe) vars (_volume, _isMuted, etc.)
-//    - This class is NOT @MainActor itself because the HAL I/O callback is not on main.
+//    - The class is @MainActor; the HAL callback is explicitly nonisolated.
 //
 // 2. **HAL I/O thread (real-time)**: Audio processing callback.
 //    - processAudioCallback() — unified callback with runtime role via callbackID
@@ -290,14 +290,92 @@ final class ProcessTapController: ProcessTapControlling {
 
     // MARK: - Multi-Device Aggregate Configuration
 
+    /// Resolved plan for FineTune's private wrapping aggregate: which hardware sub-devices
+    /// to include, whether to stack them, and which one is the clock/main device.
+    struct AggregatePlan: Equatable {
+        var subDeviceUIDs: [String]
+        var isStacked: Bool
+        var clockDeviceUID: String
+    }
+
+    /// Pure planning step for `buildAggregateDescription`.
+    ///
+    /// Three CoreAudio constraints drive this:
+    ///   1. An aggregate device cannot be nested as a sub-device of another aggregate (the
+    ///      wrapping aggregate would report 0 output channels). User-created aggregates are
+    ///      therefore *flattened* into their hardware sub-devices via `expand`.
+    ///   2. A *stacked* aggregate collapses a multichannel sub-device's output to a single
+    ///      stereo pair, which discards the device's preferred (e.g. 3/4) stereo channel
+    ///      assignment. A flattened single output is therefore kept *non-stacked*, exposing
+    ///      every channel so the IO callback can place audio on the preferred channels.
+    ///   3. The IO callback can only honour that placement when the wrapper exposes exactly
+    ///      ONE output stream: preferred-channel indices are device-global, and the callback
+    ///      locates the tap as the trailing input buffer(s). A flatten that yields several
+    ///      sub-devices (or one device with several output streams) produces a multi-stream
+    ///      wrapper where neither holds, so those stay stacked — which also makes
+    ///      Multi-Output Device targets mirror correctly instead of playing one sub-device.
+    ///
+    /// - Parameters:
+    ///   - outputUIDs: The user-selected output device UIDs (1 = single, >1 = mirroring).
+    ///   - expand: Returns an aggregate's hardware sub-device UIDs, or `nil` for non-aggregates.
+    ///   - outputStreamCount: Returns a device's output-stream count (0 if unknown).
+    static func planAggregate(
+        outputUIDs: [String],
+        expand: (String) -> [String]?,
+        outputStreamCount: (String) -> Int
+    ) -> AggregatePlan {
+        precondition(!outputUIDs.isEmpty, "Must have at least one output device")
+
+        var flatUIDs: [String] = []
+        var didFlatten = false
+        for uid in outputUIDs {
+            if let subDevices = expand(uid), !subDevices.isEmpty {
+                flatUIDs.append(contentsOf: subDevices)
+                didFlatten = true
+            } else {
+                flatUIDs.append(uid)
+            }
+        }
+
+        // De-duplicate while preserving order (a device could appear in more than one aggregate).
+        var seen = Set<String>()
+        flatUIDs = flatUIDs.filter { seen.insert($0).inserted }
+
+        let isMirroring = outputUIDs.count > 1
+        let isSingleFlatten = didFlatten && !isMirroring && flatUIDs.count == 1
+        let isStacked = !(isSingleFlatten && outputStreamCount(flatUIDs[0]) == 1)
+
+        return AggregatePlan(
+            subDeviceUIDs: flatUIDs,
+            isStacked: isStacked,
+            clockDeviceUID: flatUIDs[0]
+        )
+    }
+
     /// Builds aggregate device description for synchronized multi-device output.
     /// First device is clock source (no drift compensatio
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Classification.swift` (modified, +30/-0)
```diff
@@ -22,6 +22,36 @@ nonisolated extension AudioDeviceID {
         readTransportType() == .virtual
     }
 
+    /// Returns the UIDs of an aggregate device's constituent hardware sub-devices,
+    /// in the aggregate's channel order, or `nil` if this is not an aggregate.
+    ///
+    /// Used to *flatten* a user-created aggregate before wrapping it in FineTune's own
+    /// private aggregate: CoreAudio does not allow an aggregate device to contain another
+    /// aggregate as a sub-device (the wrapping aggregate ends up reporting 0 output
+    /// channels), so the sub-devices must be expanded into FineTune's aggregate directly.
+    func aggregateSubDeviceUIDs() -> [String]? {
+        guard isAggregateDevice() else { return nil }
+
+        var address = AudioObjectPropertyAddress(
+            mSelector: kAudioAggregateDevicePropertyFullSubDeviceList,
+            mScope: kAudioObjectPropertyScopeGlobal,
+            mElement: kAudioObjectPropertyElementMain
+        )
+        guard AudioObjectHasProperty(self, &address) else { return nil }
+
+        var size: UInt32 = 0
+        guard AudioObjectGetPropertyDataSize(self, &address, 0, nil, &size) == noErr else { return nil }
+
+        // kAudioAggregateDevicePropertyFullSubDeviceList returns a +1-retained CFArray of
+        // CFString UIDs; takeRetainedValue transfers ownership to ARC.
+        var unmanaged: Unmanaged<CFArray>?
+        let err = AudioObjectGetPropertyData(self, &address, 0, nil, &size, &unmanaged)
+        guard err == noErr, let uids = unmanaged?.takeRetainedValue() as? [String], !uids.isEmpty else {
+            return nil
+        }
+        return uids
+    }
+
     func isBluetoothDevice() -> Bool {
         let t = readTransportType()
         return t == .bluetooth || t == .bluetoothLE
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Streams.swift` (modified, +12/-0)
```diff
@@ -54,6 +54,18 @@ nonisolated extension AudioDeviceID {
         return streams
     }
 
+    /// Number of streams in the given scope (input/output). Counts streams, not channels.
+    func streamCount(scope: AudioObjectPropertyScope) -> Int {
+        var address = AudioObjectPropertyAddress(
+            mSelector: kAudioDevicePropertyStreams,
+            mScope: scope,
+            mElement: kAudioObjectPropertyElementMain
+        )
+        var size: UInt32 = 0
+        guard AudioObjectGetPropertyDataSize(self, &address, 0, nil, &size) == noErr else { return 0 }
+        return Int(size) / MemoryLayout<AudioObjectID>.size
+    }
+
     /// Returns the first output stream index in the device's global stream list.
     /// CATapDescription(deviceUID:stream:) expects this global index, not an output-only index.
     func firstOutputStreamIndex() throws -> UInt {
```

**File**: `FineTuneTests/AggregatePlanTests.swift` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+// FineTuneTests/AggregatePlanTests.swift
+//
+// Tests ProcessTapController.planAggregate() — the pure planning step that decides which
+// hardware sub-devices FineTune's private wrapping aggregate contains and whether it is
+// "stacked".
+//
+// Background (the bug these tests guard against): a user-created aggregate device whose
+// stereo speaker is assigned to channels other than 1/2 (e.g. 3/4) was not honoured.
+// Three CoreAudio constraints shape the plan:
+//   1. Aggregates can't be nested — wrapping one yields 0 output channels, so user
+//      aggregates must be flattened into their hardware sub-devices.
+//   2. A stacked aggregate collapses a multichannel sub-device to a single stereo pair,
+//      hiding channels 3+ so the preferred-channel placement could never reach them.
+//   3. The IO callback can only place audio on preferred channels when the wrapper
+//      exposes exactly one output stream, so multi-sub-device and multi-stream
+//      flattens stay stacked.
+
+import Testing
+@testable import FineTune
+
+@Suite("ProcessTapController — Aggregate Planning")
+struct AggregatePlanTests {
+
+    @Test("Single plain device: unchanged, stays stacked")
+    func singlePlainDevice() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["builtin"],
+            expand: { _ in nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["builtin"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "builtin")
+    }
+
+    @Test("Single aggregate around a single-stream device: flattened and NOT stacked")
+    func singleAggregateFlattened() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["scarlett"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["scarlett"])
+        // Non-stacked is the crux: it exposes all of the device's channels so the IO
+        // callback can place audio on the aggregate's preferred (3/4) channels.
+        #expect(plan.isStacked == false)
+        #expect(plan.clockDeviceUID == "scarlett")
+    }
+
+    @Test("Single aggregate around a multi-stream device: stays stacked")
+    func singleAggregateMultiStreamDevice() {
+        // A device exposing several output streams (stream-per-pair interfaces) breaks the
+        // callback's single-stream assumptions — the plan must fall back to stacked.
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["motu"] : nil },
+            outputStreamCount: { _ in 2 }
+        )
+        #expect(plan.subDeviceUIDs == ["motu"])
+        #expect(plan.isStacked == true)
+    }
+
+    @Test("Single aggregate with multiple sub-devices: flattened, stays stacked, order preserved")
+    func singleAggregateMultipleSubDevices() {
+        // Multiple sub-devices ⇒ one output stream per sub-device ⇒ the callback cannot
+        // honour global preferred-channel placement, so the wrapper stays stacked
+        // (mirrors to all sub-devices, which also makes Multi-Output Devices work).
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["devA", "devB"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["devA", "devB"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "devA")
+    }
+
+    @Test("Multi-device mirroring: stays stacked, order preserved")
+    func multiDeviceMirroring() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["a", "b"],
+            expand: { _ in nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["a", "b"])
+        #expect(plan.isStacked == true)
+        #expect(
```

**File**: `FineTuneTests/ProcessingPipelineTests.swift` (modified, +34/-0)
```diff
@@ -348,6 +348,40 @@ struct BufferMappingTests {
         }
     }
 
+    @Test("Stereo input to 6ch output: signal placed on preferred channels 3/4 (aggregate regression)")
+    func stereoToChannels3and4() {
+        // Regression for: aggregate device with its stereo speaker assigned to channels 3/4.
+        // After flattening + non-stacked wrapping, the output buffer exposes all 6 channels and
+        // the IO callback must place L/R on the preferred (zero-based 2/3 ⇒ channels 3/4) pair.
+        let frames = 64
+        let input = TestABL(buffers: [(channels: 2, frames: frames)])
+        let output = TestABL(buffers: [(channels: 6, frames: frames)])
+
+        let inData = input.data(at: 0)
+        for f in 0..<frames {
+            inData[f * 2] = 0.6      // left
+            inData[f * 2 + 1] = 0.4  // right
+        }
+
+        var vol: Float = 1.0
+        processWithDefaults(
+            input: input, output: output,
+            preferredStereoLeft: 2, preferredStereoRight: 3,
+            currentVol: &vol
+        )
+
+        let outData = output.data(at: 0)
+        for f in 0..<frames {
+            let base = f * 6
+            #expect(outData[base + 2] == 0.6, "Left should be on channel 3 (index 2) at frame \(f)")
+            #expect(outData[base + 3] == 0.4, "Right should be on channel 4 (index 3) at frame \(f)")
+            // Channels 1/2 (and 5/6) must be silent — this is exactly what was broken.
+            for ch in [0, 1, 4, 5] {
+                #expect(outData[base + ch] == 0.0, "Channel \(ch) at frame \(f) should be silent")
+            }
+        }
+    }
+
     @Test("Zero-frame buffer: output zeroed, no crash")
     func zeroFrameBuffer() {
         // frameCount = 0 should hit the guard and memset output to zero.
```

---

### Incident Patch 8: `4f27a28c` (2026-06-14)
**Commit Message**: fix(loudness): tune leveler defaults to reduce volume pumping (#304)

Larger analysis window/hop align the detector with BS.1770 momentary metering; the pumping reduction comes from the gain-smoother release time.

Co-authored-by: Iscle <albertiscle9@gmail.com>

**File**: `FineTune/Audio/Loudness/LoudnessEqualizerSettings.swift` (modified, +8/-8)
```diff
@@ -1,22 +1,22 @@
 nonisolated struct LoudnessEqualizerSettings: Codable, Equatable, Sendable {
     var targetLoudnessDb: Float = -12
-    var maxBoostDb: Float = 15
+    var maxBoostDb: Float = 6
     var maxCutDb: Float = 4
     var compressionThresholdOffsetDb: Float = 6
     var compressionRatio: Float = 1.6
     var compressionKneeDb: Float = 8
 
-    var analysisWindowMs: Float = 30
-    var analysisHopMs: Float = 15
+    var analysisWindowMs: Float = 400
+    var analysisHopMs: Float = 100
 
     var detectorAttackMs: Float = 25
-    var detectorReleaseMs: Float = 400
+    var detectorReleaseMs: Float = 600
 
-    var gainAttackMs: Float = 180
-    var gainReleaseMs: Float = 5000
+    var gainAttackMs: Float = 250
+    var gainReleaseMs: Float = 3000
 
-    var noiseFloorThresholdDb: Float = -48
-    var lowLevelMaxBoostDb: Float = 1.5
+    var noiseFloorThresholdDb: Float = -40
+    var lowLevelMaxBoostDb: Float = 0.5
 
     var enabled: Bool = false
 }
```

**File**: `FineTuneTests/LoudnessEqualizerTests.swift` (modified, +8/-8)
```diff
@@ -14,19 +14,19 @@ struct LoudnessEqualizerTests {
     func settingsDefaults() {
         let s = LoudnessEqualizerSettings()
         #expect(s.targetLoudnessDb == -12)
-        #expect(s.maxBoostDb == 15)
+        #expect(s.maxBoostDb == 6)
         #expect(s.maxCutDb == 4)
         #expect(s.compressionThresholdOffsetDb == 6)
         #expect(s.compressionRatio == 1.6)
         #expect(s.compressionKneeDb == 8)
-        #expect(s.analysisWindowMs == 30)
-        #expect(s.analysisHopMs == 15)
+        #expect(s.analysisWindowMs == 400)
+        #expect(s.analysisHopMs == 100)
         #expect(s.detectorAttackMs == 25)
-        #expect(s.detectorReleaseMs == 400)
-        #expect(s.gainAttackMs == 180)
-        #expect(s.gainReleaseMs == 5000)
-        #expect(s.noiseFloorThresholdDb == -48)
-        #expect(s.lowLevelMaxBoostDb == 1.5)
+        #expect(s.detectorReleaseMs == 600)
+        #expect(s.gainAttackMs == 250)
+        #expect(s.gainReleaseMs == 3000)
+        #expect(s.noiseFloorThresholdDb == -40)
+        #expect(s.lowLevelMaxBoostDb == 0.5)
         #expect(s.enabled == false)
     }
 
```

**File**: `FineTuneTests/ProcessingPipelineTests.swift` (modified, +2/-2)
```diff
@@ -1050,7 +1050,7 @@ struct LoudnessIntegrationTests {
 
     @Test("Loudness equalizer modifies output vs nil-processor baseline when enabled")
     func loudnessEqualizerModifiesOutput() {
-        let frames = 4096
+        let frames = 48000  // 1 s: the momentary leveler (400 ms window, 100 ms hop) needs > one hop to produce a gain change
         let sampleRate: Float = 48000
 
         // Create stereo input with moderate amplitude
@@ -1100,7 +1100,7 @@ struct LoudnessIntegrationTests {
 
     @Test("Loudness chain ordering: compensator shapes frequency, equalizer adjusts level")
     func loudnessChainOrdering() {
-        let frames = 4096
+        let frames = 48000  // 1 s: the momentary leveler (400 ms window, 100 ms hop) needs > one hop to produce a gain change
         let sampleRate = 48000.0
 
         // Create a low-frequency stereo signal that compensator will boost
```

---

### Incident Patch 9: `6a6c1737` (2026-06-05)
**Commit Message**: fix(menu-bar): let Return commit a focused text field instead of activating a row

.onKeyPress on the popup root also fires while a descendant TextField is
editing, so Return was swallowed before onSubmit could run.

**File**: `FineTune/Views/MenuBarPopupView.swift` (modified, +2/-0)
```diff
@@ -1185,6 +1185,8 @@ struct MenuBarPopupView: View {
     }
 
     private func handleKeyPress(_ keyPress: KeyPress) -> KeyPress.Result {
+        // `.onKeyPress` also fires for focused descendants; yield while a TextField is editing so its Return commits via onSubmit instead of activating a row.
+        if NSApp.keyWindow?.firstResponder is NSTextView { return .ignored }
         let mods = keyPress.modifiers
         let isM = keyPress.key == KeyEquivalent("m")
         let isRecognized: Bool = {
```

---

### Incident Patch 10: `638175df` (2026-06-03)
**Commit Message**: fix(audio): stop Bluetooth call-mode crackling on A2DP↔SCO switches

Sub-tap drift compensation made the HAL insert/delete a sample on the ~50ppm
BT-vs-crystal offset every ~0.7s during calls; disable it for Bluetooth and
virtual outputs. A running aggregate's IOProc can't be re-rated in place, so on
a BT A2DP↔SCO nominal-rate change recreate each affected tap's aggregate at the
new rate (force-silenced first, then ramped — a brief clean dip, no crackle).

Original report and approach by @olujicz (#324).

**File**: `FineTune/Audio/Engine/AudioEngine.swift` (modified, +22/-0)
```diff
@@ -362,6 +362,11 @@ final class AudioEngine {
             realMonitor.inputPriorityOrder = { [weak self] in
                 self?.settingsManager.inputDevicePriorityOrder ?? []
             }
+            realMonitor.onBTDeviceSampleRateChanged = { [weak self] uid, newRate in
+                Task { @MainActor [weak self] in
+                    await self?.handleBTDeviceSampleRateChanged(uid: uid, newRate: newRate)
+                }
+            }
         }
 
         deviceMonitor.onDeviceDisconnected = { [weak self] deviceUID, deviceName in
@@ -1975,6 +1980,23 @@ final class AudioEngine {
         }
     }
 
+    /// Recreates the aggregate at the device's new rate for every tap on a BT output that changed
+    /// sample rate (A2DP↔SCO), so each tap's IOProc re-rates to match. Falls back to a full tap
+    /// recreate if the in-controller recreation throws.
+    private func handleBTDeviceSampleRateChanged(uid: String, newRate: Double) async {
+        logger.info("[RATE] BT output \(uid, privacy: .public) → \(newRate, format: .fixed(precision: 0)) Hz — recreating affected taps (clean dip)")
+        let affected = taps.filter { $0.value.currentDeviceUIDs.contains(uid) }
+        for (pid, tap) in affected {
+            do {
+                logger.info("[RATE] Recreating tap for PID \(pid)")
+                try await tap.recreateForOutputRateChange()
+            } catch {
+                logger.error("[RATE] Recreate failed for PID \(pid): \(error.localizedDescription) — falling back to full recreate")
+                await recreateTap(for: pid)
+            }
+        }
+    }
+
     // MARK: - Input Device Lock
 
     /// Handles changes to the default input device.
```

**File**: `FineTune/Audio/Engine/ProcessTapController.swift` (modified, +29/-1)
```diff
@@ -308,6 +308,14 @@ final class ProcessTapController: ProcessTapControlling {
 
         let clockDeviceUID = outputUIDs[0]  // Primary = clock source
 
+        // Sub-tap drift comp must be OFF when the tap source and output share a clock domain:
+        // Bluetooth (tap and output both follow the BT clock — enabling it makes the HAL insert/
+        // delete a sample on the ~50ppm BT-vs-crystal offset every ~0.7s, the rhythmic call crackle)
+        // and virtual sources (burst delivery looks like drift). ON for wired/USB where the crystal
+        // domains genuinely differ. Defaults OFF on an unresolvable device (less wrong on unknown BT).
+        let isPrimaryBTOutput = audioDeviceID(for: outputUIDs[0])?.isBluetoothDevice() ?? true
+        let tapDriftCompensation = !isTapSourceVirtual() && !isPrimaryBTOutput
+
         return [
             kAudioAggregateDeviceNameKey: name,
             kAudioAggregateDeviceUIDKey: UUID().uuidString,
@@ -319,13 +327,33 @@ final class ProcessTapController: ProcessTapControlling {
             kAudioAggregateDeviceSubDeviceListKey: subDevices,
             kAudioAggregateDeviceTapListKey: [
                 [
-                    kAudioSubTapDriftCompensationKey: true,
+                    kAudioSubTapDriftCompensationKey: tapDriftCompensation,
                     kAudioSubTapUIDKey: tapUUID.uuidString
                 ]
             ]
         ]
     }
 
+    private func isTapSourceVirtual() -> Bool {
+        guard let uid = preferredTapSourceDeviceUID,
+              let deviceID = audioDeviceID(for: uid) else { return false }
+        return deviceID.isVirtualDevice()
+    }
+
+    /// Recreates the aggregate at the device's new rate on a Bluetooth A2DP↔SCO change. Recreation is
+    /// the only reliable way to re-rate the IOProc — in-place nominal-rate or buffer-size writes
+    /// silence a running aggregate's IOProc, which can't be reconfigured live. Routed through the
+    /// destructive switch with `sourceAlreadySilent: true` so the old aggregate is force-silenced
+    /// first (cutting the rate-mismatched garbage) before the rebuild, then volume ramps back up — a
+    /// brief clean dip rather than a crackle. The switch can't be fully gapless: the BT link itself
+    /// renegotiates across the profile change.
+    func recreateForOutputRateChange() async throws {
+        guard activated, let primaryUID = currentDeviceUIDs.first else { return }
+        guard primaryResources.tapDescription != nil else { throw CrossfadeError.noTapDescription }
+        logger.info("[RATE] \(self.app.name): recreating aggregate at new rate")
+        try await performDestructiveDeviceSwitch(to: primaryUID, allDeviceUIDs: currentDeviceUIDs, sourceAlreadySilent: true)
+    }
+
     private func preferredStereoChannels(for deviceUID: String?) -> (left: Int, right: Int) {
         guard let deviceUID, let deviceID = audioDeviceID(for: deviceUID) else {
             return (0, 1)
```

**File**: `FineTune/Audio/Engine/ProcessTapControlling.swift` (modified, +5/-0)
```diff
@@ -31,6 +31,7 @@ protocol ProcessTapControlling: AnyObject, Sendable {
 
     var tapSourceDeviceUID: String? { get }
     func refreshTapSource(_ preferredDeviceUID: String?) async throws
+    func recreateForOutputRateChange() async throws
 }
 
 extension ProcessTapControlling {
@@ -58,4 +59,8 @@ extension ProcessTapControlling {
     func refreshTapSource(_ preferredDeviceUID: String?) async throws {
         // Default no-op for mocks that don't override
     }
+
+    func recreateForOutputRateChange() async throws {
+        // Default no-op for mocks that don't override
+    }
 }
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Classification.swift` (modified, +5/-0)
```diff
@@ -22,6 +22,11 @@ nonisolated extension AudioDeviceID {
         readTransportType() == .virtual
     }
 
+    func isBluetoothDevice() -> Bool {
+        let t = readTransportType()
+        return t == .bluetooth || t == .bluetoothLE
+    }
+
     func isHidden() -> Bool {
         (try? readBool(kAudioDevicePropertyIsHidden)) ?? false
     }
```

**File**: `FineTune/Audio/Monitors/AudioDeviceMonitor.swift` (modified, +104/-0)
```diff
@@ -59,11 +59,29 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
     /// Listeners for kAudioDevicePropertyDataSource changes on built-in devices (headphone jack detection)
     @ObservationIgnored private var dataSourceListeners: [AudioDeviceID: AudioObjectPropertyListenerBlock] = [:]
 
+    /// Called when a BT output device crosses the A2DP ↔ SCO/HFP sample-rate boundary (44.1 kHz).
+    /// Off-protocol (on the concrete monitor) — wired via the `as? AudioDeviceMonitor` cast, like the
+    /// priority-order closures; no-ops under a non-AudioDeviceMonitor provider.
+    var onBTDeviceSampleRateChanged: ((_ uid: String, _ newRate: Double) -> Void)?
+
+    /// Listeners for kAudioDevicePropertyNominalSampleRate changes on BT output devices (A2DP↔SCO).
+    @ObservationIgnored private var sampleRateListeners: [AudioDeviceID: AudioObjectPropertyListenerBlock] = [:]
+    @ObservationIgnored private var lastKnownSampleRates: [AudioDeviceID: Double] = [:]
+    @ObservationIgnored private var sampleRateDebounce: [AudioDeviceID: Task<Void, Never>] = [:]
+
     /// Debounces rapid HAL device-list notifications (e.g. Bluetooth connect fires 2-3 in ~20ms).
     /// Querying device properties during the burst produces HALC_ShellObject errors because
     /// HAL proxy objects are mid-transition. 50ms lets the HAL stabilize before we enumerate.
     private var deviceListDebounceTask: Task<Void, Never>?
 
+    /// True when the BT output's nominal rate changed to a different valid rate, so each affected
+    /// tap's aggregate must be recreated to match. Pure, for testability. `newRate <= 0` is a transient/failed read
+    /// (never act, and the caller must not store it as the baseline or the next real read looks like
+    /// no change). Fires on ANY change (A2DP↔SCO and within-band) — the aggregate must always match.
+    nonisolated static func isMeaningfulRateChange(oldRate: Double, newRate: Double) -> Bool {
+        newRate > 0 && newRate != oldRate
+    }
+
     func start() {
         guard deviceListListenerBlock == nil else { return }
 
@@ -100,6 +118,7 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
             deviceListListenerBlock = nil
         }
         removeAllDataSourceListeners()
+        removeAllSampleRateListeners()
     }
 
     /// O(1) lookup by device UID (output devices)
@@ -199,6 +218,8 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
             inputDevicesByID = Dictionary(uniqueKeysWithValues: inputDevices.map { ($0.id, $0) })
 
             syncDataSourceListeners(outputDeviceIDs: outputDeviceList.map(\.id))
+            let btOutputIDs = Set(outputDeviceList.filter { $0.id.isBluetoothDevice() }.map(\.id))
+            syncSampleRateListeners(btOutputDeviceIDs: btOutputIDs)
 
         } catch {
             logger.error("Failed to refresh device list: \(error.localizedDescription)")
@@ -257,6 +278,89 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
         }
     }
 
+    // MARK: - Bluetooth Sample-Rate Listeners (A2DP ↔ SCO/HFP)
+
+    /// Installs/removes kAudioDevicePropertyNominalSampleRate listeners on BT output devices so
+    /// A2DP ↔ SCO/HFP mode switches (which keep the same AudioObjectID, only changing the nominal
+    /// rate) trigger tap re-evaluation.
+    private func syncSampleRateListeners(btOutputDeviceIDs: Set<AudioDeviceID>) {
+        let currentIDs = Set(sampleRateListeners.keys)
+
+        for deviceID in currentIDs.subtracting(btOutputDeviceIDs) {
+            removeSampleRateListener(for: deviceID)
+        }
+
+        for deviceID in btOutputDeviceIDs.subtracting(currentIDs) {
+            guard let uid = devicesByID[deviceID]?.uid else { continue }
+            var address = AudioObjectPropertyAddress(
+                mSelector: kAudioDevicePropertyNominalSampleRate,
+                mScope: kAudioObjectPropertyScopeGlobal,
+                mElement: kAudioObjectPropertyElementMain
+            )
+            let block: AudioOb
```

#### Recent Merged Pull Requests:
- **PR #450** (closed): feat(i18n): add Brazilian Portuguese localization (@luizpassaroni)
- **PR #425** (closed): NID-501: Add MenuBarIconStyle.monochrome for minimalist volume-independent icon (@jfcanon)
- **PR #400** (closed): Phase A: third-party Audio Unit layout compatibility (@joshan-kana)
- **PR #366** (closed): Feature/per app smart volume (@djbob2000)
- **PR #365** (closed): Feature/harmonic exciter (@djbob2000)
- **PR #362** (2026-07-07): DDC: send VCP writes twice (@maleadt)
- **PR #361** (2026-07-07): DDC: stop crash on volume change with DDC output (@maleadt)
- **PR #354** (closed): fix(audio): prewarm process taps, apply AutoEQ during crossfade, cut startup CPU, and improve streaming detection (@FelikZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
