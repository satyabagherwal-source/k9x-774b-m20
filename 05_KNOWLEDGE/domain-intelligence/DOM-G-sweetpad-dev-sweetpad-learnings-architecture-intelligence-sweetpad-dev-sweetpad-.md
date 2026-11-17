# Domain G — Architecture Intelligence: Architecture Intelligence: sweetpad-dev-sweetpad-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sweetpad-dev-sweetpad-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:34:24.125Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sweetpad-dev-sweetpad-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sweetpad-dev-sweetpad-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:34:24.125Z`  
> **Learning ID**: `LEARN-EVO-sweetpad-dev-sweetpad-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), B (Product Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sweetpad-dev-sweetpad-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source**: github ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Source Version**: `4b5b7817`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T03:34:14.461Z  
> **Learning ID**: `learn-github-sweetpad-dev-sweetpad`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sweetpad-dev/sweetpad

> **Canonical Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T03:34:14.455Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1931 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Bad.xcdatamodel/generated/A+CoreDataClass.swift`
```
//
//  A+CoreDataClass.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData

public typealias ACoreDataClassSet = NSSet

@objc(A)
public class A: NSManagedObject {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Bad.xcdatamodel/generated/A+CoreDataProperties.swift`
```
//
//  A+CoreDataProperties.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData


public typealias ACoreDataPropertiesSet = NSSet

extension A {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<A> {
        return NSFetchRequest<A>(entityName: "A")
    }

    @NSManaged nonisolated public var b: NSManagedObject?
    @NSManaged nonisolated public var c: A?

}

extension A : Identifiable {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Bad.xcdatamodel/generated/Bad+CoreDataModel.swift`
```
//
//  Bad+CoreDataModel.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData

public typealias BadFoundationFrameworkSet = NSSet
public typealias BadCoreDataFrameworkManagedObject = NSManagedObject



```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/A+CoreDataClass.swift`
```
//
//  A+CoreDataClass.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData

public typealias ACoreDataClassSet = NSSet

@objc(A)
public class A: NSManagedObject {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/A+CoreDataProperties.swift`
```
//
//  A+CoreDataProperties.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData


public typealias ACoreDataPropertiesSet = NSSet

extension A {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<A> {
        return NSFetchRequest<A>(entityName: "A")
    }

    @NSManaged nonisolated public var i16: Int16
    @NSManaged nonisolated public var i32: NSNumber?
    @NSManaged nonisolated public var dbl: NSNumber?
    @NSManaged nonisolated public var flt: Float
    @NSManaged nonisolated public var flag: NSNumber?
    @NSManaged nonisolated public var dec: NSDecimalNumber?
    @NSManaged nonisolated public var when: TimeInterval
    @NSManaged nonisolated public var link: URL?
    @NSManaged nonisolated public var list: [String]?
    @NSManaged nonisolated public var obj: NSObject?
    @NSManaged nonisolated public var oid: NSObject?
    @NSManaged nonisolated public var default: String?
    @NSManaged nonisolated public var tmp: String?
    @NSManaged nonisolated public var b: BObject?
    @NSManaged nonisolated public var cs: NSOrderedSet?

}

// MARK: Generated accessors for cs
extension A {

    @objc(insertObject:inCsAtIndex:)
    @NSManaged nonisolated public func insertIntoCs(_ value: C, at idx: Int)

    @objc(removeObjectFromCsAtIndex:)
    @NSManaged nonisolated public func removeFromCs(at idx: Int)

    @objc(insertCs:atIndexes:)
    @NSManaged nonisolated public func insertIntoCs(_ values: [C], at indexes: NSIndexSet)

    @objc(removeCsAtIndexes:)
    @NSManaged nonisolated public func removeFromCs(at indexes: NSIndexSet)

    @objc(replaceObjectInCsAtIndex:withObject:)
    @NSManaged nonisolated public func replaceCs(at idx: Int, with value: C)

    @objc(replaceCsAtIndexes:withCs:)
    @NSManaged nonisolated public func replaceCs(at indexes: NSIndexSet, with values: [C])

    @objc(addCsObject:)
    @NSManaged nonisolated public func addToCs(_ value: C)

    @objc(removeCsObject:)
    @NSManaged nonisolated public func removeFromCs(_ value: C)

    @objc(addCs:)
    @NSManaged nonisolated public func addToCs(_ values: NSOrderedSet)

    @objc(removeCs:)
    @NSManaged nonisolated public func removeFromCs(_ values: NSOrderedSet)

}

extension A : Identifiable {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/BObject+CoreDataProperties.swift`
```
//
//  BObject+CoreDataProperties.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData


public typealias BObjectCoreDataPropertiesSet = NSSet

extension BObject {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<BObject> {
        return NSFetchRequest<BObject>(entityName: "B")
    }

    @NSManaged nonisolated public var title: String?
    @NSManaged nonisolated public var as: NSSet?

}

// MARK: Generated accessors for as
extension BObject {

    @objc(addAsObject:)
    @NSManaged nonisolated public func addToAs(_ value: A)

    @objc(removeAsObject:)
    @NSManaged nonisolated public func removeFromAs(_ value: A)

    @objc(addAs:)
    @NSManaged nonisolated public func addToAs(_ values: NSSet)

    @objc(removeAs:)
    @NSManaged nonisolated public func removeFromAs(_ values: NSSet)

}

extension BObject : Identifiable {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/D+CoreDataClass.swift`
```
//
//  D+CoreDataClass.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData

public typealias DCoreDataClassSet = NSSet

@objc(D)
public class D: BObject {

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/D+CoreDataProperties.swift`
```
//
//  D+CoreDataProperties.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData


public typealias DCoreDataPropertiesSet = NSSet

extension D {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<D> {
        return NSFetchRequest<D>(entityName: "D")
    }

    @NSManaged nonisolated public var extra: String?

}

```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Gen.xcdatamodel/generated/Gen+CoreDataModel.swift`
```
//
//  Gen+CoreDataModel.swift
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

public import Foundation
public import CoreData

public typealias GenFoundationFrameworkSet = NSSet
public typealias GenCoreDataFrameworkManagedObject = NSManagedObject



```

### Core Architecture Module: `sweetpad-cli/fixtures/momc/expected/Kinds.xcdatamodel/generated/Kinds+CoreDataModel.h`
```
//
//  Kinds+CoreDataModel.h
//  
//
//  Created by $(AUTHOR) on $(DATE).
//
//  This file was automatically generated and should not be edited.
//

#import <Foundation/Foundation.h>
#import <CoreData/CoreData.h>

#import "P+CoreDataClass.h"
#import "Q+CoreDataClass.h"
#import "R+CoreDataProperties.h"





```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #363** (2026-11-16): **0.1.26: `.xip` SDK import reads `Xcode.app/Contents/Info.plist`, which the archive extractor never selects**
  *Symptoms*: ### Summary In 0.1.26, the Linux SDK import from an Xcode `.xip` (`sweetpad setup --sdk Xcode.xip`, or `linux-sdk.py import`) fails right after the archive is verified:  ``` Verified complete archive: ... {"error": "[Errno 2] No such file or directory: '.../.swiftpm/swift-sdks/.sweetpad-sdk-XXXXXXXX/Xcode.app/Contents/Info.plist'"} ```  Because `IMPORTER_VERSION` is now 2, existing installs are told to rerun with `--replace-sdk`, and that rerun then fails this way. So an install that imports from a `.xip` can't move to 0.1.26.  ### Cause `unpack_xcode_archive` in `sweetpad-lib/ci/linux-sdk.py` (around line 273) now reads the bundle's `Info.plist` for `BuildMachineOSBuild`:  ```python info = plistlib.loads((xcode / "Contents/Info.plist").read_bytes()) ```  But `selected()` in `sweetpad-lib/ci/linux-xcode-archive.py` (around line 408) only selects `Contents/version.plist` at the top of the bundle, so that file is never extracted:  ```python if relative == "Contents/version.plist":     return "Xcode.app/" + relative ```  The `sweetpad-export` path (`unpack_verified`) isn't affected; only `sourceFormat: xip` is.  ### Suggested fix ```diff -    if relative == "Contents/version.plist": +    if relative in ("Contents/version.plist", "Contents/Info.plist"): ```  With this change the import completes, and `setup --sdk` then reuses the SDK (receipt `importerVersion: 2`). It may also be worth reading `BuildMachineOSBuild` only when the file exists (as `linux-setup.sh` already does) and 

- **Issue #362** (2026-11-15): **Close most of the open Linux backlog**
  *Symptoms*: Works through the open PLAN_LINUX.md items in the agreed order, with one commit per item. I checked each item on the Mac and in the Linux VM, and its PLAN entry records what the check showed. Still open: P01, E24 and the hayro/resvg decision. D01 still needs the phone.

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

### Incident Patch 1: `bcedc3c5` (2026-11-15)
**Commit Message**: Note that legacy macOS tools block Linux builds by name

**File**: `sweetpad-cli/PLAN_LINUX.md` (modified, +11/-4)
```diff
@@ -511,13 +511,20 @@ Swift Build names these in its xcspecs. The Swift toolchain has `llvm-ar`,
 - [ ] `TextureAtlas`: SpriteKit `.atlas` to `.atlasc` *(optional)*
 - [ ] SceneKit tools (`scntool`, `copySceneKitAssets`,
       `compileSceneKitShaders`): copy first *(optional)*
-- [ ] `metal`: the compiler is closed; fail clearly, maybe try the Windows
-      build under Wine *(optional)*
+- [x] `metal`: the compiler is closed; fail clearly, maybe try the Windows
+      build under Wine *(optional)*. A build that needs it is blocked and
+      names the task and the tool (E22, checked with a `.metal` file); Wine
+      isn't tried.
 - [ ] `realitytool`, `referenceobjectc`, Skybox, App Playground catalogs:
       fail clearly *(optional)*
-- [ ] macOS-only legacy tools (`osacompile`, `Rez`, `ResMerger`, `mig`,
+- [x] macOS-only legacy tools (`osacompile`, `Rez`, `ResMerger`, `mig`,
       `iig`, `dtrace`, `exutil`, `lsregister`): skip or fail clearly
-      *(optional)*
+      *(optional)*. A macOS target with a `.defs` file, a `.r` file or an
+      AppleScript is blocked in the VM, naming the task and `mig`, `Rez` or
+      `/usr/bin/osacompile` (E22's list, which also names `ResMerger`, `iig`
+      and `dtrace`). A failed `lsregister` start is a note (the Swift Build
+      patch). `exutil` isn't on the list, so it gets the generic "couldn't
+      find" blocker.
 
 ## ibtool
 
```

---

### Incident Patch 2: `c2d8ebab` (2026-11-15)
**Commit Message**: Show command lines with -v and name a missing macOS tool as the build's blocker

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +24/-0)
```diff
@@ -3004,6 +3004,11 @@ through the same watcher and builds its error with the same function
 (`xcodebuild::build_failure`), so a blocked build under `run` or `run --hot`
 ends on the same hint as under `build`.
 
+**The error object names the blocker.** The headline is for a person; a
+caller gets the same hint as `error.blocker`, beside `code: build_failure`, so
+it can tell a blocked build from a broken one without matching the message.
+Both engines set it through `tool_failure`.
+
 ### A path guessed at positionally
 
 `sweetpad app screenshot shot.png` — a command whose whole job is writing one
@@ -4622,6 +4627,25 @@ the target's dependency on the plugin product, as Xcode's PIF does, so the
 tool still builds. The engine warns for each such plugin in the build's
 target graph that its commands are skipped.
 
+**A tool Linux doesn't have blocks the build.** Swift Build reports
+`unable to spawn process 'metal' (No such file or directory)` against the
+task that needed it, then that it couldn't read the serialized diagnostics
+the tool never wrote. The message parser drops that second warning and makes
+the first the build's blocker, naming the task and the tool, and what the
+tool is when it's one Apple has no Linux version of (Metal, `osacompile`,
+`Rez`, `mig`, `iig`, `dtrace`, `realitytool`, `coremlc`, the SceneKit and
+SpriteKit compilers). A tool that exists but won't start isn't a blocker.
+
+**`-v` shows what xcodebuild's log shows.** The parsed view drops each
+task's command line and the output of tasks that succeed; under `-v` both
+come through as `Event::Other`, the command line under its task and the
+output when the task completes. A task's output is left out when the task
+reported a diagnostic, which already says the same, and so is lld's notice
+about the platform. A task that runs inside Swift Build shows only a `cd`
+line and is left out. Swift Build has no `-verbose` or `-quiet` of its own,
+so those after `--` set the progress to `-v`'s or `-q`'s level instead of
+being refused.
+
 **Scheme actions run as xcodebuild runs them.** Only shell scripts run;
 xcodebuild skips a Send Email action without a word, and the engine skips it
 with a note. A script that selects a target in a local package gets that
```

**File**: `sweetpad-cli/PLAN_LINUX.md` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ they do not establish physical-device execution for these changes.
 - [x] E19: Verify macOS cross-architecture builds and Info.plist preprocessing on Linux (`swbuild.rs::DarwinSdk::overrides`). Archives build every `ARCHS_STANDARD` architecture: the delivery fixture's universal Mac app launches as arm64 and as x86_64, and is notarized. Info.plist preprocessing failed on a host whose `cc` is GCC, which refuses the `-target` Swift Build passes. A `cc` stand-in now sends a run for an Apple target to Clang and any other to the host's `cc`. With a prefix header, `-D` definitions and an `#if` block, the Info.plist built on Linux equals Xcode 27.2's.
 - [x] E20: Preserve required linker settings when projects supply OTHER_LDFLAGS on additional platforms (`swbuild.rs::Invocation`). A tvOS build with `OTHER_LDFLAGS=-ObjC`, or with an `-xcconfig` file setting `OTHER_LDFLAGS = -lz`, lost `-fuse-ld=lld` and failed to link: the engine's `$(inherited) -fuse-ld=lld` sat among the command-line settings, which a user's value replaces and Swift Build places below the xcconfig. Settings the engine adds to now go in the request's environment-config level, the top one. In the VM, the tvOS probe links with `-ObjC -fuse-ld=lld`, `-lz -fuse-ld=lld`, and `-lc++ -fuse-ld=lld` from an xcconfig `[sdk=appletvsimulator*]` setting; watchOS, visionOS and iOS builds still succeed.
 - [ ] E21: Warn for missing workspace members, explain path case mismatches, and map ASSET_TAGS (`sweetpad-lib/src/workspace_pif.rs`, `swbuild.rs`).
-- [ ] E22: Define verbose passthrough and structured blocker reporting for Swift Build (`swbuild.rs`).
+- [x] E22: Define verbose passthrough and structured blocker reporting for Swift Build (`swbuild.rs`). `-v` prints each task's command line and the output of tasks that report no diagnostic; `-- -verbose` and `-- -quiet` set the same levels as `-v` and `-q` instead of being refused. A task whose tool isn't on the machine (`unable to spawn process 'metal'`) makes the build blocked, not broken, naming the task and the tool, and the JSON error carries the hint as `error.blocker` on both engines. Checked in the VM with a `.metal` file.
 - [ ] E23: A process a script phase leaves running in the background holds Swift Build's service socket (it inherits fd 18 and the service's pipes), so `swbuild` never exits until that process does; a Gradle daemon would hold a build for hours. Found while checking E17; Xcode's spawns don't leak those descriptors. Close inherited descriptors in Swift Build's Linux task spawns (`swift-build-linux.patch`).
 - [ ] E24: Run build-tool plugins on Xcode project targets. Xcode evaluates them in the IDE through `XcodeProjectPlugin` and gives Swift Build a script phase per command, with outputs in `BuildToolPluginIntermediates/<Target>.output/<Target>/<Plugin>/`; the Linux toolchain has no `XcodeProjectPlugin`. One route is a generated package whose target stands in for the project target, evaluated by `swift package dump-pif` through the plugin's `BuildToolPlugin` entry, with its custom tasks moved onto the project target; most plugins (SwiftLint, SwiftGen, R.swift) implement both entries. Inputs that differ between the two contexts (the package directory, `XcodeTarget.inputFiles`) need checking per plugin.
 - [ ] E25: Build every standard arch for a generic destination. Xcode builds a Debug app for `generic/platform=iOS Simulator` with `ONLY_ACTIVE_ARCH=NO`, giving `arm64 x86_64`, and exports that to scripts; the Swift Build engine keeps the project's `ONLY_ACTIVE_ARCH=YES` and builds arm64 only. Pass `ONLY_ACTIVE_ARCH=NO` for generic destinations as xcodebuild does, after checking a capture for each platform.
```

**File**: `sweetpad-cli/src/cli/buildlog.rs` (modified, +14/-0)
```diff
@@ -383,6 +383,20 @@ impl BuildProgress {
         }
     }
 
+    /// Raise the detail to `-v`'s or lower it to `-q`'s, for a build tool's
+    /// own switches (xcodebuild's `-verbose` and `-quiet`, passed through to
+    /// Swift Build). Quiet wins, as `--quiet` does over `--verbose`, and
+    /// stops the spinner.
+    #[must_use]
+    pub fn with_levels(mut self, verbose: bool, quiet: bool) -> Self {
+        self.quiet |= quiet;
+        self.verbose = (self.verbose || verbose) && !self.quiet;
+        if self.quiet {
+            self.spinner = None;
+        }
+        self
+    }
+
     /// Render one raw `xcodebuild` line for display, or `None` to suppress it.
     /// The first line that renders stops and erases the spinner; the closing
     /// success banner is stamped with the elapsed build time. With
```

**File**: `sweetpad-cli/src/cli/mod.rs` (modified, +25/-6)
```diff
@@ -2078,8 +2078,14 @@ pub struct CliError {
     /// The command to run next, when the failure points at one its message
     /// does not name. Human output closes on it as a `tip:` line, even when
     /// the failure is [`shown`](CliError::shown); the error object carries it
-    /// as `tip`.
-    tip: Option<String>,
+    /// as `tip`. Boxed, like `blocker`, to keep every `Result<_, CliError>`
+    /// small.
+    tip: Option<Box<str>>,
+    /// How past a blocked build, which no edit to the code fixes: the flag to
+    /// pass or the place to build. The headline says it too; the error object
+    /// carries it as `blocker`, so a caller tells a blocked build from a
+    /// broken one without reading the message.
+    blocker: Option<Box<str>>,
 }
 
 impl std::fmt::Display for CliError {
@@ -2102,6 +2108,7 @@ impl CliError {
             diagnostics: Vec::new(),
             shown: false,
             tip: None,
+            blocker: None,
         }
     }
 
@@ -2148,6 +2155,7 @@ impl CliError {
             diagnostics: self.diagnostics,
             shown: self.shown,
             tip: self.tip,
+            blocker: self.blocker,
         }
     }
 
@@ -2180,7 +2188,15 @@ impl CliError {
     /// without one. It survives [`context`](CliError::context).
     #[must_use]
     pub fn tip(mut self, tip: Option<String>) -> Self {
-        self.tip = tip;
+        self.tip = tip.map(String::into_boxed_str);
+        self
+    }
+
+    /// Mark this failure as a blocked build, with the way past it (see the
+    /// field). It survives [`context`](CliError::context).
+    #[must_use]
+    pub fn blocker(mut self, blocker: Option<String>) -> Self {
+        self.blocker = blocker.map(String::into_boxed_str);
         self
     }
 
@@ -2192,8 +2208,8 @@ impl CliError {
     }
 
     /// The machine-readable error object: the taxonomy code, the flattened
-    /// message, and — when the failure carried them — the parsed diagnostics
-    /// and the tip. The single shape every `--json`/`-o ndjson` error surface
+    /// message, and — when the failure carried them — the parsed diagnostics,
+    /// the tip and the blocker. The single shape every `--json`/`-o ndjson` error surface
     /// renders.
     #[must_use]
     pub fn json(&self) -> serde_json::Value {
@@ -2206,7 +2222,10 @@ impl CliError {
                 map.insert("diagnostics".into(), self.diagnostics.clone().into());
             }
             if let Some(tip) = &self.tip {
-                map.insert("tip".into(), tip.clone().into());
+                map.insert("tip".into(), tip.as_ref().into());
+            }
+            if let Some(blocker) = &self.blocker {
+                map.insert("blocker".into(), blocker.as_ref().into());
             }
         }
         value
```

**File**: `sweetpad-cli/src/cli/swbuild.rs` (modified, +262/-47)
```diff
@@ -132,8 +132,9 @@ pub fn run(plan: &BuildPlan<'_>, out: &Output) -> Result<Option<buildlog::BuildS
     let mut parser = MessageParser::default();
     let mut diagnostics = Vec::new();
     let mut transcript = String::new();
-    let mut progress =
-        (!out.is_json() && !out.is_ndjson()).then(|| BuildProgress::start(out, "Building"));
+    let (verbose, quiet) = output_levels(plan.passthrough);
+    let mut progress = (!out.is_json() && !out.is_ndjson())
+        .then(|| BuildProgress::start(out, "Building").with_levels(verbose, quiet));
     let mut take = |parsed: &Parsed| {
         if matches!(parsed.event, Event::Diagnostic { .. })
             && let Some(json) = buildlog::event_json(&parsed.event)
@@ -193,20 +194,12 @@ pub fn run(plan: &BuildPlan<'_>, out: &Output) -> Result<Option<buildlog::BuildS
         || "swbuild exited with a non-zero status".to_string(),
         |signal| format!("swbuild was killed by {}", signal_name(signal)),
     );
-    let read_log = recorded.map(|p| format!("read full build log: {}", p.display()));
-    let tip = if killer == Some(libc::SIGKILL) && cfg!(target_os = "linux") {
-        Some(format!(
-            "the kernel's out-of-memory killer sends SIGKILL, and 'journalctl -k' says if it did{}",
-            read_log.map_or_else(String::new, |tip| format!("; {tip}"))
-        ))
-    } else {
-        read_log
-    };
+    let tip = failure_tip(killer, recorded.as_deref());
     Err(xcodebuild::tool_failure(
         &ended,
         &invocation.args,
         diagnostics,
-        None,
+        parser.blocker(),
         progress.is_some(),
         !Output::streams_share_a_file(),
         &detail,
@@ -215,6 +208,20 @@ pub fn run(plan: &BuildPlan<'_>, out: &Output) -> Result<Option<buildlog::BuildS
     .tip(tip))
 }
 
+/// Where a failed build points next: the log it left in `recorded`, after
+/// the out-of-memory killer when SIGKILL ended it on Linux.
+fn failure_tip(killer: Option<i32>, recorded: Option<&Path>) -> Option<String> {
+    let read_log = recorded.map(|p| format!("read full build log: {}", p.display()));
+    if killer == Some(libc::SIGKILL) && cfg!(target_os = "linux") {
+        Some(format!(
+            "the kernel's out-of-memory killer sends SIGKILL, and 'journalctl -k' says if it did{}",
+            read_log.map_or_else(String::new, |tip| format!("; {tip}"))
+        ))
+    } else {
+        read_log
+    }
+}
+
 /// The signal that killed `swbuild`, if one did. `bwrap`, which runs it
 /// where `/bin/sh` isn't Bash, exits with 128 plus that signal's number.
 fn killed_by(status: std::process::ExitStatus, wrapped: bool) -> Option<i32> {
@@ -1203,11 +1210,13 @@ fn refuse_xcodebuild_flags(passthrough: &[String]) -> Result<(), CliError> {
             "-derivedDataPath" | "-xcconfig" => {
                 args.next();
             }
+            // Output levels, which the build's progress takes (see `output_levels`).
+            "-verbose" | "-quiet" => {}
             flag if flag.starts_with('-') => {
                 return Err(CliError::new(format!(
                     "'{flag}' is an xcodebuild flag from passthrough arguments or sweetpad.toml's [xcodebuild].args; this build runs on Swift Build, which \
-                     takes only build settings ('KEY=VALUE'), '-derivedDataPath', '-xcconfig' and '-testPlan' \
-                     after '--'"
+                     takes only build settings ('KEY=VALUE'), '-derivedDataPath', '-xcconfig', '-testPlan', \
+                     '-verbose' and '-quiet' after '--'"
                 ))
                 .kind(ErrorKind::Usage));
             }
@@ -1217,6 +1226,14 @@ fn refuse_xcodebuild_flags(passthrough: &[String]) -> Result<(), CliError> {
     Ok(())
 }
 
+/// xcodebuild's `-verbose` and `-quiet` among the passthrough arguments, as
+/// the levels of `-v` and `-q` they stand for here: the build's progress
+/// shows what `-v` shows, or only what `-q` leaves.
+fn output_levels(passthrough: &[String]) -> (bool, bool) {
+    let has = |flag: &str| passthrough.iter().any(|a| a == flag);
+    (has("-verbose"), has("-quiet"))
+}
+
 fn test_plan_name(passthrough: &[String]) -> Option<&str> {
     passthrough
         .windows(2)
@@ -1855,6 +1872,12 @@ fn build_machine_settings(plist: &[(String, String)]) -> Vec<(&'static str, Stri
 /// carries the task's output, which would otherwise go unseen, and so do the
 /// warnings a successful link leaves in its output. Text lines are swbuild's
 /// own errors, written before or after the build.
+///
+/// What xcodebuild's raw log shows and the parsed view drops comes through as
+/// [`Event::Other`], which only `-v` renders: each task's command line, and
+/// the output of a task that reported nothing of its own. A task whose tool
+/// can't be started blocks the build rather than breaking it
+/// ([`blocker`](Self::blocker)).
 #[derive(Debug, Default)]
 pub struct MessageParser {
     /// What each started task is, by task ID.
@@ -1864,6 
```

**File**: `sweetpad-cli/src/cli/xcodebuild.rs` (modified, +3/-2)
```diff
@@ -459,7 +459,7 @@ pub(crate) fn tool_failure(
     let streamed_error = blocker.is_none() && streamed_an_error(streamed, &diagnostics);
     let shown = streamed_error && !stderr_apart;
     let repeated = (streamed_error && stderr_apart).then(|| repeated_errors(&diagnostics));
-    let headline = blocker.map_or_else(
+    let headline = blocker.as_ref().map_or_else(
         || format!("{ended}{}", repeated.as_deref().unwrap_or(detail)),
         |hint| format!("the build is blocked, not broken: {hint}"),
     );
@@ -469,7 +469,8 @@ pub(crate) fn tool_failure(
     let err = CliError::new(headline)
         .kind(ErrorKind::BuildFailure)
         .diagnostics(diagnostics)
-        .tip(tip);
+        .tip(tip)
+        .blocker(blocker);
     if shown { err.shown() } else { err }
 }
 
```

**File**: `sweetpad-cli/tests/cli_build_result.rs` (modified, +15/-0)
```diff
@@ -924,6 +924,21 @@ fn a_blocked_build_names_the_flag_in_the_run_session_too() {
     }
 }
 
+/// The error object says a build is blocked, and how past it, apart from the
+/// message, so a caller doesn't read the headline to tell.
+#[test]
+fn a_blocked_builds_error_object_carries_the_way_past() {
+    let out = build_with_stub("blocked-json", BLOCKED, 65, &["--json"]);
+    assert_eq!(out.status.code(), Some(3), "{out:?}");
+    let stderr = String::from_utf8(out.stderr).unwrap();
+    let envelope: serde_json::Value = serde_json::from_str(stderr.trim()).unwrap();
+    let blocker = envelope["error"]["blocker"].as_str().unwrap_or_default();
+    assert!(
+        blocker.contains("retry with '-- -skipPackagePluginValidation'"),
+        "{stderr}"
+    );
+}
+
 /// A 24x80 pty: the master end, and the slave end a child takes as its
 /// terminal.
 fn pty() -> (std::fs::File, OwnedFd) {
```

**File**: `sweetpad-docs/docs/cli/linux/reference.md` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ Xcode runs those plugins itself through `XcodeProjectPlugin`, which the Linux Sw
 The build warns for each such plugin and goes on without the files it would generate.
 
 Metal shaders, Core ML model classes, SceneKit assets, and RealityKit assets require native tools.
+When a build needs a tool that Linux doesn't have, such as `metal`, it stops and names the tool and the file that needs it.
 Scripts that import Darwin or call other macOS-only tools need adaptation or a Mac preparation stage.
 Advanced Core Data mapping expressions remain outside the supported mapping-model forms.
 
```

---

### Incident Patch 3: `5885b5b6` (2026-11-16)
**Commit Message**: Fix SDK import from Xcode archives failing on a missing Info.plist

The archive extractor kept only version.plist from the top of Xcode.app, so
every .xip and .aea import, including 'setup --xcode', failed reading
BuildMachineOSBuild from 0.1.24 on. Fixes #363.

**File**: `sweetpad-lib/ci/linux-sdk.py` (modified, +2/-1)
```diff
@@ -270,7 +270,8 @@ def unpack_xcode_archive(archive, work, args):
     # Check the baseline inputs before invoking any SDK builder.
     export_roots(xcode)
     # No Mac takes part, so Xcode's own build machine stands in for one.
-    info = plistlib.loads((xcode / "Contents/Info.plist").read_bytes())
+    info_path = xcode / "Contents/Info.plist"
+    info = plistlib.loads(info_path.read_bytes()) if info_path.is_file() else {}
     return {"xcodeVersion": version["CFBundleShortVersionString"], "xcodeBuild": version["ProductBuildVersion"],
             "buildMachineOSBuild": info.get("BuildMachineOSBuild")}
 
```

**File**: `sweetpad-lib/ci/linux-xcode-archive.py` (modified, +1/-1)
```diff
@@ -405,7 +405,7 @@ def selected(name):
     if not parts or not parts[0].endswith(".app") or "prebuilt-modules" in parts:
         return None
     relative = "/".join(parts[1:])
-    if relative == "Contents/version.plist":
+    if relative in ("Contents/version.plist", "Contents/Info.plist"):
         return "Xcode.app/" + relative
     base = "Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/"
     if relative.startswith(base):
```

**File**: `sweetpad-lib/ci/test_linux_sdk.py` (modified, +20/-0)
```diff
@@ -17,6 +17,10 @@
 SPEC = importlib.util.spec_from_file_location("linux_sdk", Path(__file__).with_name("linux-sdk.py"))
 sdk = importlib.util.module_from_spec(SPEC)
 SPEC.loader.exec_module(sdk)
+GENERATOR_SPEC = importlib.util.spec_from_file_location(
+    "generate_xcode_archive_fixtures", Path(__file__).with_name("generate_xcode_archive_fixtures.py"))
+generator = importlib.util.module_from_spec(GENERATOR_SPEC)
+GENERATOR_SPEC.loader.exec_module(generator)
 
 
 class SDKTests(unittest.TestCase):
@@ -131,6 +135,22 @@ def test_export_omits_signing_files_and_host_executables(self):
             path = xcode / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_text("test")
         self.assertEqual(set(sdk.export_entries(xcode)), {"Xcode.app/Contents/version.plist"})
 
+    def test_xcode_archive_import_reads_the_build_machine_from_xcode(self):
+        info = plistlib.dumps({"CFBundleIdentifier": "com.apple.dt.Xcode", "BuildMachineOSBuild": "25C56"})
+        platforms = [(f"Xcode.app/Contents/Developer/Platforms/{name}.platform/Developer/SDKs/{name}.sdk/SDKSettings.json",
+                      b"{}", 0o100644, 10 + index, 1) for index, name in enumerate(sdk.BASE_PLATFORMS)]
+        version = ("Xcode.app/Contents/version.plist", generator.VERSION, 0o100644, 2, 1)
+        for name, items, build in [
+            ("with-info", [("Xcode.app/Contents/Info.plist", info, 0o100644, 1, 1), version] + platforms, "25C56"),
+            ("without-info", [version] + platforms, None),
+        ]:
+            with self.subTest(name):
+                archive = self.root / f"{name}.xip"
+                archive.write_bytes(generator.xip(generator.cpio(items)))
+                with patch("sys.stderr", io.StringIO()):
+                    manifest = sdk.unpack_xcode_archive(archive, self.root / name, SimpleNamespace())
+                self.assertEqual(manifest, {"xcodeVersion": "27.2", "xcodeBuild": "fixture", "buildMachineOSBuild": build})
+
     def test_import_supplies_linux_compiler_resource_headers(self):
         resource = self.root / "linux-swift"
         include = resource / "clang/include"; include.mkdir(parents=True)
```

#### Recent Merged Pull Requests:
- **PR #362** (2026-11-15): Close most of the open Linux backlog (@hyzyla)
- **PR #361** (2026-11-15): Fix six Linux backlog items (@hyzyla)
- **PR #360** (2026-11-15): Export, upload and notarize Apple builds from Linux and macOS (@hyzyla)
- **PR #359** (2026-11-14): Stop reporting a dismissed test picker as an error (@hyzyla)
- **PR #358** (2026-11-13): Add terminal Apple authentication and Xcode downloads for Linux (@hyzyla)
- **PR #357** (2026-11-12): Fix shared data, resources and caching in Xcode SDK imports (@hyzyla)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Note that legacy macOS tools block Linux builds by name

**RULE**:
When implementing operations in `sweetpad-cli/PLAN_LINUX.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bcedc3c5`: Note that legacy macOS tools block Linux builds by name. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sweetpad-cli/PLAN_LINUX.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- [x] `metal`: the compiler is closed; fail clearly, maybe try the Windows
      build under Wine *(optional)*. A build that needs it is blocked and
      names the task and the tool (E22, checked with a `.metal` file); Wine
      isn't tried.
- [x] macOS-only legacy tools (`osacompile`, `Rez`, `ResMerger`, `mig`,
      *(optional)*. A macOS target with a `.defs` file, a `.r` file or an
      AppleScript is blocked in the VM, naming the task and `mig`, `Rez` or
      `/usr/bin/osacompile` (E22's list, which also names `ResMerger`, `iig`
      and `dtrace`). A failed `lsregister` start is a note (the Swift Build
      patch). `exutil` isn't on the list, so it gets the generic "couldn't
      find" blocker.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- [ ] `metal`: the compiler is closed; fail clearly, maybe try the Windows
      build under Wine *(optional)*
- [ ] macOS-only legacy tools (`osacompile`, `Rez`, `ResMerger`, `mig`,
      *(optional)*
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bcedc3c5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
