# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: sweetpad-dev/sweetpad Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sweetpad-dev/sweetpad",
  "source_url": "https://github.com/sweetpad-dev/sweetpad",
  "source_version": "11b271ee",
  "license": "MIT",
  "timestamp": "2026-11-24T00:31:44.849Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sweetpad-dev-sweetpad",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad) (Revision: `11b271ee`).  
> **License**: MIT | **Timestamp**: `2026-11-24T00:31:44.849Z`  
> **Learning ID**: `learn-github-sweetpad-dev-sweetpad`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sweetpad-dev/sweetpad:

# Forensic Learning Record (Deep Inspection): sweetpad-dev/sweetpad

> **Canonical Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T00:31:43.498Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1936 stars

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
- **Issue #366** (2026-11-22): **Fix Linux watchOS linking, setup races, and CLI failure output**
  *Symptoms*: ## Changes  - Fix watchOS Simulator links for dynamic SwiftPM frameworks by letting Swift Build select the linker flag for each compiler driver. Add a watchOS test project and check its framework and XCTest Mach-O binaries in the opt-in private-SDK Linux package job. - Create owner-only cache directories under umask 0002, including when the build-settings catalog writes first. Verify bundled hot-reload client bytes before reuse. - Write one-shot JSON errors to stdout so redirection captures both outcomes. Failed test runs return exit 3 and include the same error and available test report in JSON and the final NDJSON event. NDJSON retains its compact stderr diagnostic. - Serialize Swift installation and archive access across setup processes. Verify the compiler in staging before publishing the installation.  ## Verification  The macOS CLI and shared-library suites passed 1,802 tests with one ignored. Clippy and formatting passed. In the arm64 Linux VM, the packaged CLI built an iOS device app and linked the watchOS Simulator dynamic framework and XCTest bundle using an imported Apple SDK. Two concurrent setup processes shared one download, and a waiting process recovered when the downloader was interrupted. 

- **Issue #365** (2026-11-21): **Address 104 Dependabot alerts across SweetPad dependencies**
  *Symptoms*: ## Changes  The updated lockfiles resolve outside the affected ranges for 104 of the 106 Dependabot alerts open when this change was prepared.  - Upgrade the CLI’s ZIP dependency from 2.6.1 to 9.8.1 and adapt archive member lookup to the fallible filename API. - Update the extension and docs npm dependencies, including scoped overrides for packages whose parents still request affected releases. - Update both React Native CI fixtures. Patch the pinned template’s manifest constraints so a fresh checkout can install the updated lockfiles in frozen mode.  ## Remaining alerts  Both React Native fixtures still resolve Active Support 7.x. The first patched release is 8.0.5.2, and CocoaPods Core 1.17.0 still requires Active Support below 8. [Alert 209](https://github.com/sweetpad-dev/sweetpad/security/dependabot/209) · [Alert 210](https://github.com/sweetpad-dev/sweetpad/security/dependabot/210)  ## Verification  - Built and type-checked the extension. All 675 unit tests and 19 VS Code end-to-end tests passed. - Ran the Rust ZIP, notarization, and upload tests, along with formatting and CLI Clippy checks. - Type-checked and built the docs, including a separate production build with two rendering workers. - Ran frozen dependency preparation and CocoaPods deployment installs for both React Native fixtures on macOS.  A separate npm audit reported existing advisories for glob and diff in the workspace tooling. Both packages resolve to the same versions as on the base commit. 

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

### Incident Patch 1: `b2ff0f84` (2026-11-21)
**Commit Message**: Restart the test simulator after a hot-reload install timeout

**File**: `sweetpad-lib/ci/hot-reload-e2e.sh` (modified, +20/-6)
```diff
@@ -61,22 +61,36 @@ esac
 cleanup() {
   perl -e 'alarm shift; exec @ARGV' 30 xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
   perl -e 'alarm shift; exec @ARGV' 30 xcrun simctl delete "$UDID" >/dev/null 2>&1 || true
+  if [ -n "${selfcheck_log:-}" ]; then rm -f "$selfcheck_log"; fi
 }
+selfcheck_log=
 trap cleanup EXIT
+selfcheck_log=$(mktemp)
 DEST="platform=iOS Simulator,id=$UDID"
 echo "  $DEST"
-xcrun simctl boot "$UDID"
-perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
-  || fail "simulator $UDID failed to boot (10-minute timeout)"
+boot_simulator() {
+  perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
+    || fail "simulator $UDID failed to boot (10-minute timeout)"
+}
+boot_simulator
 
 # `app run --hot --hot-selfcheck` exits 0 only on a confirmed `.injected` whose
 # new code demonstrably ran (nonce observed in the unified log).
 run_selfcheck() {
   local mode="$1"
   section "hot reload self-check — iOS Simulator, $mode recompiler"
-  "$BIN" app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST" \
-    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC" \
-    || fail "simulator/$mode: injection self-check failed"
+  local args=(app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST"
+    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC")
+  if ! "$BIN" "${args[@]}" 2>&1 | tee "$selfcheck_log"; then
+    # CoreSimulator can report a completed boot while app installation is wedged.
+    grep -Fq "'xcrun simctl install' didn't finish within" "$selfcheck_log" \
+      || fail "simulator/$mode: injection self-check failed"
+    echo "  Install timed out. Restarting test simulator $UDID and retrying $mode once."
+    perl -e 'alarm shift; exec @ARGV' 60 xcrun simctl shutdown "$UDID" \
+      || fail "simulator $UDID failed to shut down for install recovery"
+    boot_simulator
+    "$BIN" "${args[@]}" || fail "simulator/$mode: injection self-check failed after restart"
+  fi
   echo "  ✓ simulator/$mode injected"
 }
 
```

---

### Incident Patch 2: `11b271ee` (2026-11-23)
**Commit Message**: Move the Apple SDK license warning to the top of the Linux build post

**File**: `sweetpad-docs/blog/2026-11-21-build-xcode-projects-on-linux.md` (modified, +6/-8)
```diff
@@ -10,6 +10,12 @@ SweetPad is a command-line tool for building, running, and testing Xcode project
 
 <!-- truncate -->
 
+:::warning Apple SDK license
+The build needs the iPhone SDK from Xcode, and Apple licenses that SDK with conditions on where it runs.
+
+Using an Apple SDK on hardware that Apple didn’t make may violate your agreement with Apple. Apple’s standard terms limit execution to Apple-branded hardware running macOS. Before you import the SDK, check that your terms permit the machine you build on. See the [Xcode and Apple SDKs Agreement](https://www.apple.com/legal/sla/docs/xcode.pdf).
+:::
+
 On Linux, SweetPad reads the Xcode project, describes it to Swift Build, and lets Swift Build run the build. The Linux Swift compiler, Clang, and LLD produce the iPhone code against the SDK imported from Xcode. SweetPad stands in for the Xcode tools that compile resources and sign the app.
 
 <ThemedImage
@@ -155,11 +161,3 @@ Two builds that share a DerivedData folder run one after the other. The second p
 ## Next steps
 
 To see the greeting on a phone, [build with development signing](/docs/cli/linux/signing-and-testing#configure-development-signing), then [install the signed app](/docs/cli/linux/ubuntu-usb#build-install-and-launch). For iOS tests, Linux can build the test bundles and write the manifest Xcode needs to [run them on a Mac](/docs/cli/linux/signing-and-testing#run-the-tests-on-a-mac).
-
-## Apple’s license terms
-
-The build needs the iPhone SDK from Xcode, and Apple licenses that SDK with conditions on where it runs.
-
-:::warning Apple SDK license
-Using an Apple SDK on hardware that Apple didn’t make may violate your agreement with Apple. Apple’s standard terms limit execution to Apple-branded hardware running macOS. Before you import the SDK, check that your terms permit the machine you build on. See the [Xcode and Apple SDKs Agreement](https://www.apple.com/legal/sla/docs/xcode.pdf).
-:::
```

---

### Incident Patch 3: `ac276a38` (2026-11-22)
**Commit Message**: Fix Linux watchOS test links, cache permissions, concurrent setup, and CLI error output (#366)

**File**: `.github/workflows/linux-arm64-package.yaml` (modified, +31/-0)
```diff
@@ -24,6 +24,11 @@ on:
       - ".github/workflows/cli-release.yaml"
       - ".github/workflows/cli-distribute.yaml"
   workflow_dispatch:
+    inputs:
+      private_sdk:
+        description: Build the iOS and watchOS fixtures on the provisioned SDK runner
+        type: boolean
+        default: false
   workflow_call:
 permissions:
   contents: read
@@ -293,3 +298,29 @@ jobs:
           name: linux-helpers-${{ matrix.arch }}-${{ strategy.job-index }}
           path: ${{ runner.temp }}/helpers/run/*
           if-no-files-found: warn
+
+  private-sdk:
+    name: iOS device and watchOS simulator package builds
+    if: >-
+      (github.event_name == 'workflow_dispatch' && inputs.private_sdk) ||
+      (github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.SWEETPAD_PRIVATE_SDK_CI == 'true')
+    needs: package
+    runs-on: [self-hosted, Linux, ARM64, sweetpad-linux]
+    timeout-minutes: 20
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+      - uses: actions/download-artifact@v8
+        with:
+          name: cli-tarball-linux-arm64
+          path: dist
+      - name: Build and inspect the linked Mach-O products
+        run: |
+          version=$(jq -r .swift sweetpad-lib/ci/linux-toolchain.json)
+          archives=(dist/*.tar.gz)
+          test "${#archives[@]}" -eq 1
+          python3 sweetpad-cli/ci/check-linux-sdk-install.py \
+            --archive "${archives[0]}" --out "$RUNNER_TEMP/sdk-check-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" \
+            --swift "$HOME/swift/swift-$version-RELEASE" \
+            --sdk "$HOME/.swiftpm/swift-sdks/darwin.artifactbundle"
```

**File**: `skills/sweetpad/SKILL.md` (modified, +4/-4)
```diff
@@ -22,12 +22,12 @@ projects. This skill covers the everyday flows and how to discover the rest.
 ## Read results correctly
 
 - Success is `{"schema":N,"ok":true,"data":{…}}` on stdout. Errors are
-  `{"schema":1,"ok":false,"error":{"code":…,"message":…}}` on stderr, where
+  `{"schema":1,"ok":false,"error":{"code":…,"message":…}}` on stdout, where
   `code` is one of: `generic`, `usage_error`, `build_failure`,
   `target_resolution`, `tool_missing`, `user_cancel`.
-- `ok: true` means "the command ran", not "the outcome was good". A failing test
-  run still reports `ok: true` with `data.passed: false` — read the payload's own
-  status field, not just `ok`.
+- A failing test run exits 3 with `ok: false`. Read the available test summary
+  from `data` in the same envelope. A completed diagnostic report such as
+  `doctor` can have `ok: true` and exit nonzero when it finds problems.
 - Exit codes: `0` ok · `1` generic · `2` bad flags, or a flag a prompt needs
   off a terminal (`--yes`, `--product`) · `3` build/test failure ·
   `4` target resolution (unknown scheme/destination) · `5` missing tool ·
```

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +14/-19)
```diff
@@ -307,13 +307,13 @@ builds it with real `xcodebuild`.
 
 - Success: `{"schema": 1, "ok": true, "data": …}` on **stdout**,
   pretty-printed. Errors: `{"schema": 1, "ok": false, "error": {code,
-  message}}` on **stderr**, compact single-line by design (robust to scrape
-  even when child-process stderr interleaves). A build failure adds the
+  message}}` on **stdout**, compact on one line. A build failure adds the
   parsed `diagnostics`; a failure that points at a next command adds it as
   `tip`, which human output prints as its closing `tip:` line even when the
   streamed log already showed the error.
-- **`ok` means "the command executed"**, not "the outcome was good": a red
-  test suite is `ok: true` with `data.passed: false` (exit 3), `doctor` with
+- A red test suite returns `ok: false` and `error.code: "build_failure"` (exit 3).
+  Its report stays in the same envelope under `data`, including `data.passed: false`.
+  A completed diagnostic report can identify problems: `doctor` with
   problems is `ok: true` with per-check statuses (exit 1), `device info` on a
   device that is not ready is `ok: true` with `data.ready: false` (exit 1),
   `format --check` reports findings in `data` (exit 3). Every such payload
@@ -330,8 +330,7 @@ builds it with real `xcodebuild`.
   `log stream` NDJSON events (one JSON object per line, no envelope; on macOS,
   captured stdout/stderr lines are `{"source":"stdout",…}`), except under
   `--exits`, whose finite report takes the envelope like any other;
-  `completions` ignores it. Clap usage errors (exit 2) print clap's human
-  text on stderr regardless of `--json`.
+  `completions` ignores it. Clap usage errors produce a `usage_error` envelope when JSON mode is recognized.
 
 ### The NDJSON stream (`-o ndjson`)
 
@@ -390,8 +389,7 @@ simulator) exits 1 instead of 0, since the app may still be running. A
 session already exiting non-zero keeps its code and prints the stop's error
 too (`quit_result`).
 
-Exit 2 has two sources. clap reports what it can't parse, in its own text
-even under `--json`. The command reports what it parses but refuses: a flag
+Exit 2 has two sources. clap reports what it can't parse. The command reports what it parses but refuses: a flag
 on a verb it means nothing to (`test build --failed`, `build diagnostics
 --clean`), two flags that can't go together (`--on` with `--destination`,
 `--gh-annotations` with `-o json`, `app debug --batch` with `-o json`,
@@ -953,8 +951,8 @@ Notes / heuristics:
   for its members, and a local package's for its products. Scheme files for
   other targets don't stand in the way, so `scheme list`, `settings show` and
   the build's product lookup agree on the set `xcodebuild -list` prints.
-- `test run` exits non-zero on failures; the `--json` summary lands on stdout
-  and the failure error on stderr, so both are independently consumable.
+- A failed test suite exits 3. The JSON envelope and final NDJSON result both include
+  `ok: false`, `error.code: "build_failure"`, and the available summary in `data` on stdout.
 - simulator inline logs use a best-effort `processImagePath CONTAINS` log
   predicate; may need refinement per app.
 - New deps (under the `cli` feature only): `clap_complete`, `dialoguer`, `libc`
@@ -4754,15 +4752,12 @@ are copied as they are. An import writes a receipt, `sweetpad-sdk.json`,
 whose `importerVersion` changes whenever the layout does, and setup reuses a
 bundle only while the receipt matches.
 
-**The engine's additions sit above the user's settings.** Some overrides
-add to a setting rather than set it: `-fuse-ld=lld` in `OTHER_LDFLAGS` for
-tvOS, watchOS and visionOS, and the Swift library and header search paths.
-Swift Build stacks a request's levels as command-line settings, then the
-`-xcconfig` file, then the environment config, so an addition among the
-command-line settings is lost to a user's `OTHER_LDFLAGS=-ObjC` or to an
-xcconfig that sets the flags without `$(inherited)`. The additions go in the
-environment-config table instead, where `$(inherited)` takes in everything
-below: `-ObjC -fuse-ld=lld`.
+**Linker selection and search paths.** For tvOS, watchOS and visionOS, the
+engine sets `ALTERNATE_LINKER=lld` for the target SDK. Swift Build then passes
+`-use-ld=lld` to Swift and `-fuse-ld=lld` to Clang. Projects can supply their
+own `OTHER_LDFLAGS`. The engine appends the Swift library and header search
+paths in the environment-config table. At that level, `$(inherited)` includes
+the project's settings, command-line overrides and the user's `-xcconfig` file.
 
 **A stand-in is the sweetpad binary under the tool's name.** The engine
 links the binary into the stand-ins' folder under each name, puts the folder
```

**File**: `sweetpad-cli/ci/check-linux-gaps.py` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ def invoke(name, arguments, success=True, environment=None):
         (out / (name + ".stderr")).write_text(result.stderr)
         if (result.returncode == 0) != success:
             raise AssertionError(f"{name}: exit {result.returncode}; see {out / (name + '.stderr')}")
-        return json.loads(result.stdout if success else result.stderr)
+        return json.loads(result.stdout)
 
     build = ["build", *common, "--destination", "generic/platform=iOS Simulator,arch=arm64", "--", "ARCHS=arm64", "CODE_SIGNING_ALLOWED=NO"]
     built=invoke("script-build", build)["data"]
```

**File**: `sweetpad-cli/ci/check-linux-package.py` (modified, +6/-6)
```diff
@@ -79,26 +79,26 @@ def invoke(name, args, success=True):
     missing_session = out / "missing-apple-session.json"
     auth_login = invoke("auth-no-session", [binary, "auth", "login", "--apple-id", "synthetic@example.com",
                                             "--session-file", missing_session, "--json"], success=False)
-    assert "needs a terminal" in json.loads(auth_login.stderr)["error"]["message"]
+    assert "needs a terminal" in json.loads(auth_login.stdout)["error"]["message"]
     for name, arguments in [("download-no-session", ["sdk", "download"]), ("setup-xcode-no-session", ["setup"])]:
         response = invoke(name, [binary, *arguments, "--xcode", "27.3 beta", "--session-file", missing_session, "--json"], success=False)
-        assert "no Apple session file" in json.loads(response.stderr)["error"]["message"]
+        assert "no Apple session file" in json.loads(response.stdout)["error"]["message"]
     logged_out = invoke("auth-logout-empty", [binary, "auth", "logout", "--session-file", missing_session, "--json"])
     assert json.loads(logged_out.stdout)["data"]["loggedOut"] is True
     assert not missing_session.exists()
     invalid_sdk=out / "invalid-sdk.tar.gz"
     invalid_sdk.write_bytes(b"not an SDK archive")
     invalid_sdk.with_name(invalid_sdk.name + ".sha256").write_text(f"{hashlib.sha256(invalid_sdk.read_bytes()).hexdigest()}  {invalid_sdk.name}\n")
     raw_setup=invoke("raw-setup-source-discovery", [extracted / "sweetpad", "setup", "--sdk", invalid_sdk, "--json"], success=False)
-    raw_error=json.loads(raw_setup.stderr)["error"]
+    raw_error=json.loads(raw_setup.stdout)["error"]
     assert "Expected a Sweetpad SDK export" in raw_error["message"]
     installed_setup=invoke("standalone-setup-source-discovery", [binary, "setup", "--sdk", invalid_sdk, "--json"], success=False)
-    assert "Expected a Sweetpad SDK export" in json.loads(installed_setup.stderr)["error"]["message"]
+    assert "Expected a Sweetpad SDK export" in json.loads(installed_setup.stdout)["error"]["message"]
     doctor = json.loads(invoke("linux-doctor-missing-tools", [binary, "doctor", "--target", "ios", "--json"], success=False).stdout)
     assert doctor["ok"] and doctor["data"]["summary"]["problems"] > 0
     checks = {c["name"]: c for c in doctor["data"]["checks"]}
     missing = invoke("missing-host-packages", [binary, "setup", "--no-sdk", "--json"], success=False)
-    message = json.loads(missing.stderr)["error"]["message"]
+    message = json.loads(missing.stdout)["error"]["message"]
     assert checks["Host packages"]["status"] == "problem", checks["Host packages"]
     assert checks["Host packages"]["detail"] == message and "apt-get install" in message, message
     assert checks["Swift Build"]["status"] == "ok", checks["Swift Build"]
@@ -113,7 +113,7 @@ def invoke(name, args, success=True):
     assert value["ok"] and "LinuxApp" in json.dumps(value["data"])
     result = invoke("missing-toolchain", [binary, "build", "--project", project, "--scheme", "LinuxApp",
                     "--destination", "generic/platform=iOS Simulator", "--json"], success=False)
-    error = json.loads(result.stderr)
+    error = json.loads(result.stdout)
     assert error["ok"] is False and any(s in error["error"]["message"].lower() for s in ["sdk", "swift", "swbuild"])
     assert shutil.which("swift", path=env["PATH"]) is None
     report = {"passed": True, "archiveSha256": expected[0], "binarySha256": manifest["files"]["sweetpad"],
```

**File**: `sweetpad-cli/ci/check-linux-sdk-install.py` (modified, +29/-5)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env python3
-"""Build the packaged example with a fresh home and explicit read-only tools.
+"""Build the iOS sample and watchOS test fixture with the packaged CLI and a fresh home.
 
 Bubblewrap exposes no developer home, source checkout, signing files, or app
 build cache. The private SDK and the public compiler are prerequisites; Swift
@@ -22,6 +22,8 @@ def check(args):
     unpacked, work = out / "unpacked", out / "work"
     unpacked.mkdir()
     work.mkdir()
+    fixture = Path(__file__).resolve().parent.parent / "fixtures/watch-link"
+    shutil.copytree(fixture, work / "WatchLink", ignore=shutil.ignore_patterns(".build", "xcuserdata"))
     with tarfile.open(args.archive) as source:
         source.extractall(unpacked, filter="data")
     manifest = json.loads((unpacked / "manifest.json").read_text())
@@ -42,6 +44,7 @@ def check(args):
                 "--setenv", "SWEETPAD_DARWIN_SDK", "/opt/darwin-sdk",
                 "--setenv", "LANG", "C.UTF-8", "--setenv", "NO_COLOR", "1"]
     script = '''set -eu
+umask 0002
 mkdir -p "$HOME"
 mkdir -p "$HOME/.local/bin"
 # A link on PATH to the unpacked archive, which keeps libexec/sweetpad beside
@@ -60,18 +63,38 @@ def check(args):
 sweetpad build --project /work/Example/LinuxApp.xcodeproj --scheme LinuxApp \
   --destination 'generic/platform=iOS' --json --non-interactive -- \
   -derivedDataPath /work/DerivedData CODE_SIGNING_ALLOWED=NO > /work/build.json
+sweetpad test build --project /work/WatchLink/WatchLink.xcodeproj --scheme WatchProbe \
+  --destination 'generic/platform=watchOS Simulator,arch=arm64' --json --non-interactive -- \
+  -derivedDataPath /work/WatchDerivedData CODE_SIGNING_ALLOWED=NO OTHER_LDFLAGS=-lz > /work/watch-build.json
 '''
     result = subprocess.run([*command, "/bin/bash", "-c", script], capture_output=True, text=True, timeout=600)
     (out / "sandbox.stdout").write_text(result.stdout)
     (out / "sandbox.stderr").write_text(result.stderr)
-    result.check_returncode()
+    if result.returncode:
+        for name in ("build.json", "watch-build.json"):
+            envelope = work / name
+            if envelope.exists():
+                print(envelope.read_text())
+        print(result.stderr)
+        result.check_returncode()
     build = json.loads((work / "build.json").read_text())
     assert build["ok"] and build["data"]["built"]
     product = work / Path(build["data"]["productPath"]).relative_to("/work")
     executable = product / "LinuxApp"
     assert executable.is_file()
     description = subprocess.check_output(["file", str(executable)], text=True).strip()
     assert "Mach-O" in description and "arm64" in description
+    watch = json.loads((work / "watch-build.json").read_text())
+    assert watch["ok"] and watch["data"]["built"], watch
+    products = work / "WatchDerivedData/Build/Products/Debug-watchsimulator"
+    watch_binaries = {}
+    for name, kind in [
+        ("PackageFrameworks/ValueKit.framework/ValueKit", "shared library"),
+        ("WatchTests.xctest/WatchTests", "bundle"),
+    ]:
+        info = subprocess.check_output(["file", "-b", str(products / name)], text=True).strip()
+        assert all(word in info for word in ("Mach-O", "arm64", kind)), (name, info)
+        watch_binaries[name] = info
     doctor = {c["name"]: c for c in json.loads((work / "doctor.json").read_text())["data"]["checks"]}
     for name in ("Swift Build", "Swift Build service", "Swift Build patches", "Macro plugin"):
         assert doctor[name]["status"] == "ok", doctor[name]
@@ -80,13 +103,14 @@ def check(args):
               "developerHomeVisible": False, "networkAvailable": False, "appBuildCacheReused": False,
               "toolchainsReadOnly": True, "sdkReadOnly": True, "signingMaterialAvailable": False,
               "installedBinarySha256": manifest["files"]["sweetpad"], "packagedSwiftHelpers": True,
-              "product": str(product), "executableDescription": description,
+              "watchSimulatorBinaries": watch_binaries, "product": str(product), "executableDescription": description,
               "scope": "Fresh app build from the installed release artifact; compiler and SDK installation are explicit prerequisites."}
     (out / "summary.json").write_text(json.dumps(report, indent=2) + "\n")
     print(json.dumps(report, indent=2))
     if not args.keep_build_cache:
-        for relative in ["Build/Intermediates.noindex", "ModuleCache.noindex", "SDKStatCaches.noindex", "Index.noindex"]:
-            shutil.rmtree(work / "DerivedData" / relative, ignore_errors=True)
+        for build_dir in ["DerivedData", "WatchDerivedData"]:
+            for relative in ["Build/Intermediates.noindex", "ModuleCache.noindex", "SDKStatCaches.noindex", "Index.noindex"]:
+                shutil.rmtree(work / build_dir / relative, ignore_errors=True)
 
 
 if __name__ == "__main__":
```

**File**: `sweetpad-cli/ci/linux-release-README.md` (modified, +7/-0)
```diff
@@ -81,6 +81,7 @@ Installing system packages takes sudo or a root shell. Run `sudo -v` first if yo
 sweetpad finds Swift and the SDK on its own. Source `~/.config/sweetpad/linux-env.sh` only to run `swift` by hand.
 An unchanged archive reuses the installed SDK. A different archive requires `--replace-sdk`.
 The SDK stays private. The prebuilt CLI requires no Rust installation or Sweetpad source checkout.
+
 App signing requires your development identity and profiles, configured separately.
 
 CLI 0.1.22 also accepts private Xcode `.xip` downloads directly:
@@ -109,6 +110,12 @@ Other Linux architectures, including 32-bit x86, are not release targets.
 Public host-toolchain checks cover Ubuntu, Debian, and Arch. Private SDK app builds cover these distributions separately.
 Additional distributions remain unverified.
 
+The Linux packages workflow can also build the iOS device sample and the watchOS Simulator
+test fixture on the provisioned ARM64 runner. Select `private_sdk` when starting a manual run,
+or set the repository variable `SWEETPAD_PRIVATE_SDK_CI=true` to enable it on package builds
+pushed to `main`. The check uses the package from the same run and verifies the arm64 Mach-O
+types of the watch package framework and XCTest bundle.
+
 Run `sweetpad help linux-devices` for pairing and bounded logs.
 See the [Linux guide](https://sweetpad.hyzyla.dev/docs/cli/linux) for build setup and current limitations.
 
```

**File**: `sweetpad-cli/fixtures/watch-link/Probe/WatchProbe.swift` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+import ValueKit
+public func probe() -> Int { value }
```

#### Recent Merged Pull Requests:
- **PR #366** (2026-11-22): Fix Linux watchOS linking, setup races, and CLI failure output (@hyzyla)
- **PR #365** (2026-11-21): Address 104 Dependabot alerts across SweetPad dependencies (@hyzyla)
- **PR #364** (2026-11-21): Set up Linux builds with sweetpad's own SDK import and LLVM linker (@hyzyla)
- **PR #362** (2026-11-15): Close most of the open Linux backlog (@hyzyla)
- **PR #361** (2026-11-15): Fix six Linux backlog items (@hyzyla)
- **PR #360** (2026-11-15): Export, upload and notarize Apple builds from Linux and macOS (@hyzyla)

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

## X. Restart the test simulator after a hot-reload install timeout

**RULE**:
When implementing operations in `sweetpad-lib/ci/hot-reload-e2e.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2ff0f84`: Restart the test simulator after a hot-reload install timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sweetpad-lib/ci/hot-reload-e2e.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  if [ -n "${selfcheck_log:-}" ]; then rm -f "$selfcheck_log"; fi
selfcheck_log=
selfcheck_log=$(mktemp)
boot_simulator() {
  perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
    || fail "simulator $UDID failed to boot (10-minute timeout)"
}
boot_simulator
  local args=(app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST"
    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC")
  if ! "$BIN" "${args[@]}" 2>&1 | tee "$selfcheck_log"; then
    # CoreSimulator can report a completed boot while app installation is wedged.
    grep -Fq "'xcrun simctl install' didn't finish within" "$selfcheck_log" \
      || fail "simulator/$mode: injection self-check failed"
    echo "  Install timed out. Restarting test simulator $UDID and retrying $mode once."
    perl -e 'alarm shift; exec @ARGV' 60 xcrun simctl shutdown "$UDID" \
      || fail "simulator $UDID failed to shut down for install recovery"
    boot_simulator
    "$BIN" "${args[@]}" || fail "simulator/$mode: injection self-check failed after restart"
  fi
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
xcrun simctl boot "$UDID"
perl -e 'alarm shift; exec @ARGV' 600 xcrun simctl bootstatus "$UDID" -b \
  || fail "simulator $UDID failed to boot (10-minute timeout)"
  "$BIN" app run --project "$APP" --scheme SweetpadCIApp --destination "$DEST" \
    --hot --hot-recompiler "$mode" --hot-selfcheck "$SRC" \
    || fail "simulator/$mode: injection self-check failed"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2ff0f84` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
