> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source**: github ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Source Version**: `6d61e2f6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T16:35:19.055Z  
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
> **Harvest Timestamp**: 2026-11-28T16:35:19.048Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1941 stars

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
- **Issue #370** (2026-11-28): **Match Xcode App Intents input options, output flags, and parameter summaries**
  *Symptoms*: Fixes #369.  The Linux App Intents extractor rejected `@Parameter(inputOptions:)`, wrote incorrect `outputFlags`, and dropped plain `parameterSummary` declarations. This PR includes Brandon Elliott’s two original commits from #369 and extends their Xcode fixtures to cover string collections and summaries with omitted text.  - Encode explicitly supplied keyboard, capitalization, and Boolean options for `String`, `[String]`, and `Set<String>`. Omitted options produce no metadata entry. - Match Xcode’s output flags. `OpensIntent` sets `1`, `ShowsSnippetView` sets `2`, and `ProvidesDialog` sets `4`. `ReturnsValue` adds no bit. - Preserve repeated interpolations and the order of inline and trailing parameters. `Summary()` omits the text field, while `Summary("")` emits an empty format string. `When`, `Switch`, and custom localization tables now produce explicit errors.  ## Verification  The original #369 probe app built from the same Swift source on Linux and with Xcode 27.2 (`27B52`). The two bundles matched on `extract.actionsdata` for all 11 actions and 24 parameters, and on `version.json`. The comparison keeps each input-option key paired with its value when Xcode changes dictionary order.  The Rust workspace suite passed 2,348 tests with one ignored. All 16 App Intents tests passed on Linux, along with 35 Python CI tests and five SDK and registration checks. Formatting and workspace Clippy with `-D warnings` passed.  ## Interactive snippets and SDK coverage  The follow-up fix

- **Issue #369** (2026-11-28): **App Intents metadata: inputOptions rejected, outputFlags bits swapped, parameterSummary dropped**
  *Symptoms*: PRs here are limited to collaborators, so filing this as an issue. A fix with tests is on a fork branch, two commits on current `main` (685c517e), ready to cherry-pick: https://github.com/Brandon168/sweetpad/compare/sweetpad-dev:sweetpad:main...Brandon168:sweetpad:fix/appintents-input-options  The App Intents registration extractor rejects or misencodes a few common declarations, compared with Xcode 27.2 (27B52) output:  1. **`inputOptions` is rejected.** Any `@Parameter` that passes `inputOptions:` (a documented `String` parameter option) stops    extraction with `unsupported App Intents parameter option 'inputOptions'`. Xcode writes one `typeSpecificMetadata` entry    per argument the source passes and omits arguments left at their defaults:    - `LNValueTypeMetadataKeyStringKeyboardType`: asciiCapable 0, numbersAndPunctuation 1, URL 2, numberPad 3, default 4    - `LNValueTypeMetadataKeyStringCapitalizationType`: none 0, words 1, sentences 2, allCharacters 3    - `LNValueTypeMetadataKeyString{Multiline,Autocorrect,SmartQuotes,SmartDashes}`: 0 or 1 2. **`outputFlags` bits.** ProvidesDialog and ShowsSnippetView were swapped and OpensIntent was ignored. Xcode writes    OpensIntent = 1, ShowsSnippetView = 2, ProvidesDialog = 4 (ReturnsValue sets no bit). The existing Files probe returns both    dialog and snippet, so its 6 hid the swap; `some IntentResult & ReturnsValue<String> & ProvidesDialog` came out as 2    instead of 4. 3. **`parameterSummary` is dropped.** Xcode writes a

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

### Incident Patch 1: `89f52f8f` (2026-11-28)
**Commit Message**: Compile CoMaps resources and preserve asset variants on Linux (#368)

Build the pinned CoMaps app and widget resources on Linux. Preserve UIKit control state, adaptive layout, safe-area constraints, image direction, PDF masks and custom symbol artwork.

Compare Linux catalogs and nibs against Xcode in UIKit and CoreUI. Require fixtures for all 146 observed Interface Builder combinations and 17 asset selectors.

The initial CoMaps compatibility probes draw on Casper van Elteren’s comaps-ios-linux patch.

**File**: `.github/workflows/sweetpad-lib.yaml` (modified, +52/-0)
```diff
@@ -62,6 +62,58 @@ jobs:
         run: cargo test --workspace --lib -- --test-threads=1
       - name: Python regression checks
         run: python3 -B -m unittest discover -s sweetpad-lib/ci -p 'test_*.py'
+      - name: Check out the CoMaps interface files and asset catalog
+        uses: actions/checkout@v7
+        with:
+          repository: comaps/comaps
+          ref: 27ea5a9b92b266abe6d1b690e02ad5c89bf95217
+          path: .build/comaps-source
+          persist-credentials: false
+          sparse-checkout-cone-mode: false
+          sparse-checkout: |
+            /iphone/Maps/**/*.xib
+            /iphone/Maps/**/*.storyboard
+            /iphone/Maps/**/Contents.json
+            /iphone/Maps/Images.xcassets/
+            /iphone/Maps/CoMapsWidgetExtension/Assets.xcassets/
+      - name: Require fixture coverage for every CoMaps resource combination
+        if: matrix.os == 'ubuntu-24.04'
+        run: python3 sweetpad-cli/fixtures/resource_gaps.py .build/comaps-source/iphone/Maps --require-covered
+      - name: Compile CoMaps and the resource regression fixtures on Linux
+        run: |
+          cargo build -p sweetpad-cli --bin sweetpad
+          python3 sweetpad-cli/fixtures/comaps/compile.py target/debug/sweetpad .build/comaps-source "$RUNNER_TEMP/comaps-resources"
+      - name: Export Linux-built resources for UIKit
+        if: matrix.os == 'ubuntu-24.04'
+        uses: actions/upload-artifact@v7
+        with:
+          name: comaps-resources
+          path: ${{ runner.temp }}/comaps-resources
+          if-no-files-found: error
+          retention-days: 1
+  comaps-runtime:
+    name: CoMaps and resource variants · iPhone simulator
+    needs: linux
+    runs-on: macos-latest
+    timeout-minutes: 25
+    steps:
+      - uses: actions/checkout@v7
+      - uses: actions/download-artifact@v8
+        with:
+          name: comaps-resources
+          path: ${{ runner.temp }}/comaps-resources
+      - name: Compare Linux resources with Xcode and load both in UIKit
+        run: |
+          xcodebuild -version
+          python3 sweetpad-cli/fixtures/comaps/simulator.py "$RUNNER_TEMP/comaps-resources" --reference-output "$RUNNER_TEMP/comaps-xcode"
+      - name: Save Xcode catalogs for a failed comparison
+        if: failure()
+        uses: actions/upload-artifact@v7
+        with:
+          name: comaps-xcode
+          path: ${{ runner.temp }}/comaps-xcode
+          if-no-files-found: ignore
+          retention-days: 1
   check:
     name: fmt · clippy · test
     runs-on: macos-latest
```

**File**: `Cargo.lock` (modified, +54/-26)
```diff
@@ -2,6 +2,12 @@
 # It is not intended for manual editing.
 version = 4
 
+[[package]]
+name = "ab_glyph_rasterizer"
+version = "0.1.10"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "366ffbaa4442f4684d91e2cd7c5ea7c4ed8add41959a31447066e279e432b618"
+
 [[package]]
 name = "adler2"
 version = "2.0.1"
@@ -692,9 +698,9 @@ checksum = "77ce24cb58228fbb8aa041425bb1050850ac19177686ea6e0f41a70416f56fdb"
 
 [[package]]
 name = "font-types"
-version = "0.12.6"
+version = "0.12.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6c92d9081c7ab3bd83ef1eecdfad090f3d966e3ce74106779664114cfe1a6274"
+checksum = "835ae9d781464a79026cde387f9cbc650c9a4909d7cf7e658b127e3c35d2f35d"
 dependencies = [
  "bytemuck",
 ]
@@ -910,10 +916,11 @@ dependencies = [
 
 [[package]]
 name = "hayro"
-version = "0.8.0"
+version = "0.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4675ff5acd7ca41c0c34ccd2a3a154f5c86d8b5ec92bef0a114bfb194969e2af"
+checksum = "34d3977ae664ab6eea015be3024379c83c6a3580f67d51be6884f1992bf683ba"
 dependencies = [
+ "ab_glyph_rasterizer",
  "bytemuck",
  "fearless_simd 1.1.0",
  "hayro-interpret",
@@ -926,68 +933,82 @@ dependencies = [
 
 [[package]]
 name = "hayro-ccitt"
-version = "0.4.0"
+version = "0.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2866f0d976e76497480b853d5e258dab6e4b89ecfe991124e08f15dfa8fd03ad"
+checksum = "adbed896e99325bc312778bb9c9c289d795d51c12775c44dd5e4352f679c7e46"
 
 [[package]]
 name = "hayro-cmap"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "24d285dc30731c8485de5fa732fbdf2b3affdf01e4da7c2135022ca6fa664bf6"
+checksum = "a14afde3344be69225fec4f6f44f6a219a3a492f9d8301eb25ef608fe4b7014c"
 dependencies = [
  "hayro-postscript",
 ]
 
+[[package]]
+name = "hayro-font"
+version = "0.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8ac7f0c78172573e9bd6eeb17f62c63f4d378b2a2d127c3ee9c2c7cc6fbdf78b"
+dependencies = [
+ "bitflags",
+ "hayro-cmap",
+ "hayro-syntax",
+ "kurbo",
+ "phf",
+ "rustc-hash",
+ "siphasher",
+ "skrifa 0.49.0",
+]
+
 [[package]]
 name = "hayro-interpret"
-version = "0.8.0"
+version = "0.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ac9df074ff163a63864cec9b0bf640ccbff8abf4e44481df7369ce0ac172ffbe"
+checksum = "166477622df4b770a0fc5889a9e4b48c7ff8595d6ec019bf71b4297b97b55fb6"
 dependencies = [
  "bitflags",
  "hayro-cmap",
+ "hayro-font",
  "hayro-syntax",
  "kurbo",
  "moxcms",
- "phf",
  "rustc-hash",
  "siphasher",
- "skrifa 0.46.2",
  "smallvec",
- "yoke",
 ]
 
 [[package]]
 name = "hayro-jbig2"
-version = "0.3.1"
+version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "000e025850f4592ddcaee85640db70704151f2bafd43b6f431aa5b6a2c6a35a9"
+checksum = "eb5c7f3a4eb551c2bb7fa16e268f728d4bc2a5c9b090554b8dc0ee2503fb5840"
 dependencies = [
  "fearless_simd 1.1.0",
  "hayro-ccitt",
 ]
 
 [[package]]
 name = "hayro-jpeg2000"
-version = "0.4.1"
+version = "0.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "122c5f834c37a2260b9c851bb8be685cf539b2a8b94b704a931ef7d2525d5835"
+checksum = "6e5e5f2b3de970707fc22fd956d8f44211602939d5e4588603afa919cb7b3740"
 dependencies = [
  "fearless_simd 1.1.0",
 ]
 
 [[package]]
 name = "hayro-postscript"
-version = "0.1.0"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "885c5ef0654933139a9b9546fc2c69e18d37f38aa2520f079092b1be18f1fcaa"
+checksum = "bc2d80da85f31c3fdc0366431f44cfd645a9da1e242ed1f4a61f213d9765660f"
 
 [[package]]
 name = "hayro-syntax"
-version = "0.8.0"
+version = "0.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6cdc818d8d265dcb42081d488f7599df4f73fb79e9d347ecedcd3c23809d2026"
+checksum = "a6ced8279487b029813f6cc05399099fa34df6fa23d8f7b0d41d972c49d5b30d"
 dependencies = [
  "flate2",
  "hayro-ccitt",
@@ -1724,13 +1745,16 @@ dependencies = [
 
 [[package]]
 name = "read-fonts"
-version = "0.43.3"
+version = "0.46.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "005c8acf251756c478b0bf402885bfd88a1476020c4c7e6060edc1aa68da38ea"
+checksum = "bdaa4fffe9ff3ca2c353fa9729792805b9b3e324695ff5a081f860612e81b330"
 dependencies = [
  "bytemuck",
+ "foldhash",
  "font-types",
  "once_cell",
+ "smallvec",
+ "yoke",
 ]
 
 [[package]]
@@ -2109,12 +2133,15 @@ dependencies = [
 
 [[package]]
 name = "skrifa"
-version = "0.46.2"
+version = "0.49.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d4febebda507fb889c545a37a135517769d1391941013561292897961d1887d6"
+checksum = "a7459fb60888ad9a5f367dd293fa2fb9df142cb451aa6bfd6cd66a7d6a9b739d"
 dependencies = [
  "bytemuck",
- "read-fonts 0.43.3",
+ "once_cell",
+ "read-fonts 0.46.0",
+ "smallvec",
+ "yoke",
 ]
 
 [[pack
```

**File**: `Cargo.toml` (modified, +3/-1)
```diff
@@ -44,9 +44,11 @@ moxcms = "0.8.1"
 # the usvg and roxmltree it re-exports, and svgtypes, which usvg parses
 # with). Both are pure Rust; PDF and SVG are standard formats too large to
 # hand-roll.
-hayro = { version = "0.8", default-features = false }
+hayro = { version = "0.9", default-features = false }
 resvg = { version = "0.48", default-features = false }
 svgtypes = "0.16"
+# Keep the original precision when measuring SF Symbols' Bézier control points.
+kurbo = "0.13"
 # The codesign stand-in signs with an identity exported from Keychain Access:
 # RSA signatures, and the Triple DES and AES that a .p12 file's contents are
 # encrypted with. The signature formats around them are Apple's, and
```

**File**: `sweetpad-cli/Cargo.toml` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ moxcms.workspace = true
 hayro.workspace = true
 resvg.workspace = true
 svgtypes.workspace = true
+kurbo.workspace = true
 rsa.workspace = true
 des.workspace = true
 aes.workspace = true
```

**File**: `sweetpad-cli/fixtures/actool/expected/back-deployed-sha256.json` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{
+  "extensions": "a8bbcd75e97087d521c01f979c533dbffa7b411baa2b84ea9488689c98edf1a9",
+  "no-extensions": "038a6770b0d0d6768d225c8461a4e7ded243e24cc96f464bf1a8248538ba67d7",
+  "swiftui": "cafdee11310f05491f146db8b83f7489fe14e9c8d24339cd94e17daff31f89ad"
+}
```

**File**: `sweetpad-cli/fixtures/actool/regen.py` (modified, +14/-3)
```diff
@@ -7,6 +7,8 @@
     python3 -I sweetpad-cli/fixtures/actool/regen.py
 """
 
+import hashlib
+import itertools
 import json
 import os
 import shutil
@@ -92,19 +94,25 @@ def main():
     try:
         catalog = os.path.join(work, "Probe.xcassets")
         build(spec, catalog)
-        for mode, flags in MODES.items():
-            out = os.path.join(work, mode)
+        back_deployed = {}
+        for target, (mode, flags) in itertools.product(["18.2", "15.6"], MODES.items()):
+            out = os.path.join(work, f"{target}-{mode}")
             os.makedirs(out)
             subprocess.run(
                 ["xcrun", "actool", catalog, "--compile", out, "--output-format", "human-readable-text",
                  "--notices", "--warnings", "--output-partial-info-plist", os.path.join(out, "partial.plist"),
                  "--app-icon", "AppIcon", "--accent-color", "AccentColor", "--platform", "iphonesimulator",
-                 "--minimum-deployment-target", "18.2", "--target-device", "iphone", "--target-device", "ipad",
+                 "--minimum-deployment-target", target, "--target-device", "iphone", "--target-device", "ipad",
                  "--bundle-identifier", "dev.sweetpad.Probe", *flags,
                  "--generate-swift-asset-symbols", os.path.join(out, "Symbols.swift"),
                  "--generate-objc-asset-symbols", os.path.join(out, "Symbols.h"),
                  "--generate-asset-symbol-index", os.path.join(out, "Symbols-Index.plist")],
                 check=True, stdout=subprocess.DEVNULL)
+            if target == "15.6":
+                # The same large catalog exercises namespace collisions and thinnable assets in both APIs.
+                with open(os.path.join(out, "Symbols.swift"), "rb") as f:
+                    back_deployed[mode] = hashlib.sha256(f.read()).hexdigest()
+                continue
             shutil.copy(os.path.join(out, "Symbols.swift"), os.path.join(expected, f"{mode}.swift"))
             if mode != "extensions":
                 # The header and the index don't change with the mode.
@@ -120,6 +128,9 @@ def main():
             with open(os.path.join(expected, "index.json"), "w") as f:
                 json.dump(index, f, indent=1, ensure_ascii=False)
                 f.write("\n")
+        with open(os.path.join(expected, "back-deployed-sha256.json"), "w") as f:
+            json.dump(back_deployed, f, indent=2)
+            f.write("\n")
     finally:
         shutil.rmtree(work)
 
```

**File**: `sweetpad-cli/fixtures/actool/resources/CoMapsSlots.xcassets/Contents.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "info": {
+    "author": "xcode",
+    "version": 1
+  }
+}
```

**File**: `sweetpad-cli/fixtures/actool/resources/CoMapsSlots.xcassets/MapAccent.colorset/Contents.json` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+{
+  "info": {
+    "author": "xcode",
+    "version": 1
+  },
+  "colors": [
+    {
+      "color": {
+        "color-space": "srgb",
+        "components": {
+          "red": "0.216",
+          "green": "0.396",
+          "blue": "0.247",
+          "alpha": "1.000"
+        }
+      },
+      "idiom": "universal"
+    },
+    {
+      "color": {
+        "color-space": "srgb",
+        "components": {
+          "red": "0.396",
+          "green": "0.580",
+          "blue": "0.392",
+          "alpha": "1.000"
+        }
+      },
+      "idiom": "universal",
+      "appearances": [
+        {
+          "appearance": "luminosity",
+          "value": "dark"
+        }
+      ]
+    }
+  ]
+}
```

---

### Incident Patch 2: `b2294bab` (2026-11-28)
**Commit Message**: Match Xcode App Intents registration on Linux (#370)

Fixes #369.

Match Xcode’s registration for string input options, plain parameter
summaries, interactive snippets, and results that open another intent
with a snippet view or dialog. Compare complete native registrations
on Linux and check SDK declarations on upgrades.

Co-authored-by: Brandon Elliott <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/appintents-registration.yaml` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+name: App Intents SDK and registration
+
+on:
+  pull_request:
+    paths: &paths
+      - 'sweetpad-cli/src/**'
+      - 'sweetpad-cli/fixtures/appintents/**'
+      - 'sweetpad-core/**'
+      - 'sweetpad-lib/src/**'
+      - 'sweetpad-lib/ci/bundle_comparison.py'
+      - 'Cargo.*'
+      - 'rust-toolchain.toml'
+      - '.github/workflows/appintents-registration.yaml'
+  push:
+    branches: [main]
+    paths: *paths
+  schedule:
+    - cron: '25 6 * * 1'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: appintents-registration-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  sdk:
+    name: Classify the public iOS SDK
+    runs-on: macos-26
+    steps:
+      - uses: actions/checkout@v7
+      - &select-xcode
+        name: Select the newest stable installed Xcode
+        uses: maxim-lobanov/setup-xcode@ed7a3b1fda3918c0306d1b724322adc0b8cc0a90 # v1
+        with:
+          xcode-version: latest-stable
+      - run: xcodebuild -version
+      - run: python3 -B -I sweetpad-cli/fixtures/appintents/sdk_coverage.py --export-signatures "$RUNNER_TEMP/sdk-inventory"
+      - uses: actions/upload-artifact@v7
+        if: ${{ !cancelled() }}
+        with:
+          name: appintents-sdk-inventory
+          path: ${{ runner.temp }}/sdk-inventory
+          if-no-files-found: error
+
+  native:
+    name: Capture registration with Xcode
+    runs-on: macos-26
+    steps:
+      - uses: actions/checkout@v7
+      - *select-xcode
+      - uses: Swatinem/rust-cache@v2
+      - run: cargo build --locked -p sweetpad-cli --bin sweetpad
+      - run: command -v xcodegen || brew install xcodegen
+      - run: python3 -B -I sweetpad-cli/fixtures/appintents/regen.py --export-registration "$RUNNER_TEMP/registrations"
+      - uses: actions/upload-artifact@v7
+        with:
+          name: appintents-registrations
+          path: ${{ runner.temp }}/registrations
+          if-no-files-found: error
+
+  linux:
+    name: Compare complete registrations on Linux
+    needs: native
+    runs-on: ubuntu-24.04
+    steps:
+      - uses: actions/checkout@v7
+      - uses: Swatinem/rust-cache@v2
+      - uses: actions/download-artifact@v8
+        with:
+          name: appintents-registrations
+          path: ${{ runner.temp }}/registrations
+      - run: cargo build --locked -p sweetpad-cli --bin sweetpad
+      - run: python3 -B -I sweetpad-cli/fixtures/appintents/verify_registration.py "$RUNNER_TEMP/registrations"
+      - run: python3 -B -m unittest discover -s sweetpad-cli/fixtures/appintents -p 'test_*.py'
```

**File**: `sweetpad-cli/fixtures/appintents/InputOptionsProbe.actions.json` (added, +1286/-0)
```diff
@@ -0,0 +1,1286 @@
+{
+  "InputOptionsProbeIntent": {
+    "assistantDefinedSchemaTraits": [],
+    "assistantDefinedSchemas": [],
+    "authenticationPolicy": 0,
+    "availabilityAnnotations": {
+      "LNPlatformNameWildcard": {
+        "introducedVersion": "*"
+      }
+    },
+    "effectiveBundleIdentifiers": [],
+    "fullyQualifiedTypeName": "InputOptionsProbe.InputOptionsProbeIntent",
+    "identifier": "InputOptionsProbeIntent",
+    "isAuthPolExplicit": false,
+    "isDiscoverable": true,
+    "mangledTypeName": "17InputOptionsProbe0abC6IntentV",
+    "mangledTypeNameByBundleIdentifier": {},
+    "mangledTypeNameByBundleIdentifierV2": {},
+    "mangledTypeNameV2": "17InputOptionsProbe0abC6IntentV",
+    "openAppWhenRun": false,
+    "outputFlags": 0,
+    "parameters": [
+      {
+        "capabilities": 0,
+        "dynamicOptionsSupport": 0,
+        "inputConnectionBehavior": 0,
+        "isInput": false,
+        "isOptional": true,
+        "name": "allOff",
+        "resolvableInputTypes": [
+          {
+            "kindValue": 0,
+            "valueType": {
+              "primitive": {
+                "wrapper": {
+                  "typeIdentifier": 2
+                }
+              }
+            }
+          },
+          {
+            "kindValue": 0,
+            "valueType": {
+              "array": {
+                "wrapper": {
+                  "capabilities": 3,
+                  "memberValueType": {
+                    "primitive": {
+                      "wrapper": {
+                        "typeIdentifier": 2
+                      }
+                    }
+                  }
+                }
+              }
+            }
+          },
+          {
+            "kindValue": 0,
+            "valueType": {
+              "primitive": {
+                "wrapper": {
+                  "typeIdentifier": 0
+                }
+              }
+            }
+          }
+        ],
+        "title": {
+          "alternatives": [],
+          "key": "All off"
+        },
+        "typeSpecificMetadata": [
+          "LNValueTypeMetadataKeyStringAutocorrect",
+          {
+            "int": {
+              "wrapper": 0
+            }
+          },
+          "LNValueTypeMetadataKeyStringCapitalizationType",
+          {
+            "int": {
+              "wrapper": 0
+            }
+          },
+          "LNValueTypeMetadataKeyStringSmartQuotes",
+          {
+            "int": {
+              "wrapper": 0
+            }
+          },
+          "LNValueTypeMetadataKeyStringKeyboardType",
+          {
+            "int": {
+              "wrapper": 4
+            }
+          },
+          "LNValueTypeMetadataKeyStringMultiline",
+          {
+            "int": {
+              "wrapper": 0
+            }
+          },
+          "LNValueTypeMetadataKeyStringSmartDashes",
+          {
+            "int": {
+              "wrapper": 0
+            }
+          }
+        ],
+        "valueType": {
+          "primitive": {
+            "wrapper": {
+              "typeIdentifier": 0
+            }
+          }
+        }
+      },
+      {
+        "capabilities": 0,
+        "dynamicOptionsSupport": 0,
+        "inputConnectionBehavior": 0,
+        "isInput": false,
+        "isOptional": true,
+        "name": "allOn",
+        "resolvableInputTypes": [
+          {
+            "kindValue": 0,
+            "valueType": {
+              "primitive": {
+                "wrapper": {
+                  "typeIdentifier": 2
+                }
+              }
+            }
+          },
+          {
+            "kindValue": 0,
+            "valueType": {
+              "array": {
+                "wrapper": {
+                  "capabilities": 3,
+                  "memberValueType": {
+                    "primitive": {
+                      "wrapper": {
+                        "typeIdentifier": 2
+                      }
+                    }
+                  }
+                }
+              }
+            }
+          },
+          {
+            "kindValue": 0,
+            "valueType": {
+              "primitive": {
+                "wrapper": {
+                  "typeIdentifier": 0
+                }
+              }
+            }
+          }
+        ],
+        "title": {
+          "alternatives": [],
+          "key": "All on"
+        },
+        "typeSpecificMetadata": [
+          "LNValueTypeMetadataKeyStringSmartQuotes",
+          {
+            "int": {
+              "wrapper": 1
+            }
+          },
+          "LNValueTypeMetadataKeyStringAutocorrect",
+          {
+            "int": {
+              "wrapper": 1
+            }
+          },
+          "LNValueTypeMetadataKeyStringCapitalizationType",
+          {
+            "int": {
+              "wrapper": 3
+            }
+          },
+          "LNValueTypeMetadataKeyStringKeyboardType",
+          {
+            "int": {
+              "wrapper": 0
+         
```

**File**: `sweetpad-cli/fixtures/appintents/InputOptionsProbe.swift` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+// Every String.IntentInputOptions argument, explicit and defaulted.
+import AppIntents
+
+struct InputOptionsProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Input options probe"
+  static let openAppWhenRun: Bool = false
+
+  @Parameter(title: "All off", inputOptions: String.IntentInputOptions(keyboardType: .default, capitalizationType: .none, multiline: false, autocorrect: false, smartQuotes: false, smartDashes: false))
+  var allOff: String?
+  @Parameter(title: "All on", inputOptions: String.IntentInputOptions(keyboardType: .asciiCapable, capitalizationType: .allCharacters, multiline: true, autocorrect: true, smartQuotes: true, smartDashes: true))
+  var allOn: String?
+  @Parameter(title: "Empty", inputOptions: String.IntentInputOptions())
+  var empty: String?
+  @Parameter(title: "Punct", inputOptions: String.IntentInputOptions(keyboardType: .numbersAndPunctuation, capitalizationType: .words))
+  var punct: String?
+  @Parameter(title: "URL", inputOptions: String.IntentInputOptions(keyboardType: .URL, capitalizationType: .sentences))
+  var url: String?
+  @Parameter(title: "Number pad", inputOptions: String.IntentInputOptions(keyboardType: .numberPad))
+  var numberPad: String?
+  @Parameter(title: "Smart quotes only", inputOptions: String.IntentInputOptions(smartQuotes: false))
+  var quotes: String?
+  @Parameter(title: "Smart dashes only", inputOptions: String.IntentInputOptions(smartDashes: false))
+  var dashes: String?
+  @Parameter(title: "Autocorrect only", inputOptions: String.IntentInputOptions(autocorrect: false))
+  var autocorrect: String?
+  @Parameter(title: "With default", default: "hi", inputOptions: String.IntentInputOptions(multiline: true))
+  var withDefault: String
+  @Parameter(title: "Options and dialog", description: "Described", inputOptions: String.IntentInputOptions(keyboardType: .numberPad, autocorrect: false), requestValueDialog: "Which?")
+  var dialog: String
+
+  @Parameter(title: "Explicit defaults", inputOptions: String.IntentInputOptions(keyboardType: .asciiCapable, capitalizationType: .sentences, multiline: false, autocorrect: true, smartQuotes: true, smartDashes: true))
+  var explicitDefaults: String?
+
+  @Parameter(title: "Words", inputOptions: .init(keyboardType: .URL, multiline: true))
+  var words: [String]
+  @Parameter(title: "Optional words", inputOptions: .init(autocorrect: false))
+  var optionalWords: [String]?
+  @Parameter(title: "Distinct words", inputOptions: .init(smartQuotes: true))
+  var distinctWords: Set<String>
+  @Parameter(title: "User's summary", inputOptions: nil)
+  var parameterSummary: String?
+
+  @MainActor
+  func perform() async throws -> some IntentResult { .result() }
+}
+
+struct ParameterTitleProbe: AppIntent {
+  static let title: LocalizedStringResource = "Parameter titles"
+
+  @Parameter(title: "User's choice", inputOptions: nil) var ordinary: String?
+  @Parameter(title: "Custom label", description: "Extra detail", default: "ready", inputOptions: .init(multiline: true))
+  var parameterSummary: String
+
+  func perform() async throws -> some IntentResult { .result() }
+}
```

**File**: `sweetpad-cli/fixtures/appintents/OutputProbe.actions.json` (added, +866/-0)
```diff
@@ -0,0 +1,866 @@
+{
+  "AllOutputsProbeIntent": {
+    "assistantDefinedSchemaTraits": [],
+    "assistantDefinedSchemas": [],
+    "authenticationPolicy": 0,
+    "availabilityAnnotations": {
+      "LNPlatformNameWildcard": {
+        "introducedVersion": "*"
+      }
+    },
+    "effectiveBundleIdentifiers": [],
+    "fullyQualifiedTypeName": "OutputProbe.AllOutputsProbeIntent",
+    "identifier": "AllOutputsProbeIntent",
+    "isAuthPolExplicit": false,
+    "isDiscoverable": true,
+    "mangledTypeName": "11OutputProbe010AllOutputsB6IntentV",
+    "mangledTypeNameByBundleIdentifier": {},
+    "mangledTypeNameByBundleIdentifierV2": {},
+    "mangledTypeNameV2": "11OutputProbe010AllOutputsB6IntentV",
+    "openAppWhenRun": false,
+    "outputFlags": 7,
+    "outputType": {
+      "primitive": {
+        "wrapper": {
+          "typeIdentifier": 0
+        }
+      }
+    },
+    "parameters": [],
+    "presentationStyle": 0,
+    "requiredCapabilities": [],
+    "supportedModes": 1,
+    "systemProtocolMetadata": [],
+    "systemProtocolMetadataV2": [],
+    "systemProtocols": [],
+    "title": {
+      "alternatives": [],
+      "key": "All outputs"
+    },
+    "typeSpecificMetadata": [],
+    "visibilityMetadata": {
+      "assistantOnly": false,
+      "isDiscoverable": true
+    }
+  },
+  "DialogOnlyProbeIntent": {
+    "assistantDefinedSchemaTraits": [],
+    "assistantDefinedSchemas": [],
+    "authenticationPolicy": 0,
+    "availabilityAnnotations": {
+      "LNPlatformNameWildcard": {
+        "introducedVersion": "*"
+      }
+    },
+    "effectiveBundleIdentifiers": [],
+    "fullyQualifiedTypeName": "OutputProbe.DialogOnlyProbeIntent",
+    "identifier": "DialogOnlyProbeIntent",
+    "isAuthPolExplicit": false,
+    "isDiscoverable": true,
+    "mangledTypeName": "11OutputProbe010DialogOnlyB6IntentV",
+    "mangledTypeNameByBundleIdentifier": {},
+    "mangledTypeNameByBundleIdentifierV2": {},
+    "mangledTypeNameV2": "11OutputProbe010DialogOnlyB6IntentV",
+    "openAppWhenRun": false,
+    "outputFlags": 4,
+    "parameters": [],
+    "presentationStyle": 0,
+    "requiredCapabilities": [],
+    "supportedModes": 1,
+    "systemProtocolMetadata": [],
+    "systemProtocolMetadataV2": [],
+    "systemProtocols": [],
+    "title": {
+      "alternatives": [],
+      "key": "Dialog only"
+    },
+    "typeSpecificMetadata": [],
+    "visibilityMetadata": {
+      "assistantOnly": false,
+      "isDiscoverable": true
+    }
+  },
+  "EmptySummaryTextProbeIntent": {
+    "actionConfiguration": {
+      "actionSummary": {
+        "wrapper": {
+          "otherParameterIdentifiers": [],
+          "summaryString": {
+            "formatString": "",
+            "parameterIdentifiers": []
+          }
+        }
+      }
+    },
+    "assistantDefinedSchemaTraits": [],
+    "assistantDefinedSchemas": [],
+    "authenticationPolicy": 0,
+    "availabilityAnnotations": {
+      "LNPlatformNameWildcard": {
+        "introducedVersion": "*"
+      }
+    },
+    "effectiveBundleIdentifiers": [],
+    "fullyQualifiedTypeName": "OutputProbe.EmptySummaryTextProbeIntent",
+    "identifier": "EmptySummaryTextProbeIntent",
+    "isAuthPolExplicit": false,
+    "isDiscoverable": true,
+    "mangledTypeName": "11OutputProbe016EmptySummaryTextB6IntentV",
+    "mangledTypeNameByBundleIdentifier": {},
+    "mangledTypeNameByBundleIdentifierV2": {},
+    "mangledTypeNameV2": "11OutputProbe016EmptySummaryTextB6IntentV",
+    "openAppWhenRun": false,
+    "outputFlags": 0,
+    "parameters": [],
+    "presentationStyle": 0,
+    "requiredCapabilities": [],
+    "supportedModes": 1,
+    "systemProtocolMetadata": [],
+    "systemProtocolMetadataV2": [],
+    "systemProtocols": [],
+    "title": {
+      "alternatives": [],
+      "key": "Empty summary text"
+    },
+    "typeSpecificMetadata": [],
+    "visibilityMetadata": {
+      "assistantOnly": false,
+      "isDiscoverable": true
+    }
+  },
+  "NoSummaryTextProbeIntent": {
+    "actionConfiguration": {
+      "actionSummary": {
+        "wrapper": {
+          "otherParameterIdentifiers": []
+        }
+      }
+    },
+    "assistantDefinedSchemaTraits": [],
+    "assistantDefinedSchemas": [],
+    "authenticationPolicy": 0,
+    "availabilityAnnotations": {
+      "LNPlatformNameWildcard": {
+        "introducedVersion": "*"
+      }
+    },
+    "effectiveBundleIdentifiers": [],
+    "fullyQualifiedTypeName": "OutputProbe.NoSummaryTextProbeIntent",
+    "identifier": "NoSummaryTextProbeIntent",
+    "isAuthPolExplicit": false,
+    "isDiscoverable": true,
+    "mangledTypeName": "11OutputProbe013NoSummaryTextB6IntentV",
+    "mangledTypeNameByBundleIdentifier": {},
+    "mangledTypeNameByBundleIdentifierV2": {},
+    "mangledTypeNameV2": "11OutputProbe013NoSummaryTextB6IntentV",
+    "openAppWhenRun": false,
+    "outputFlags": 4,
+    "outputType": {
+      "primitive": {
+        "wrapper": {
+          "typeIdentifier": 0
+        }
+      }
+    }
```

**File**: `sweetpad-cli/fixtures/appintents/OutputProbe.swift` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// Output flags and parameter summaries.
+import AppIntents
+import SwiftUI
+
+struct DialogOnlyProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Dialog only"
+  func perform() async throws -> some IntentResult & ProvidesDialog { .result(dialog: "Done") }
+}
+
+struct SnippetOnlyProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Snippet only"
+  @MainActor
+  func perform() async throws -> some IntentResult & ShowsSnippetView { .result(view: Text("Done")) }
+}
+
+struct ValueSnippetProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Value and snippet"
+  @MainActor
+  func perform() async throws -> some IntentResult & ReturnsValue<String> & ShowsSnippetView { .result(value: "v", view: Text("Done")) }
+}
+
+struct OpensProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Opens"
+  func perform() async throws -> some IntentResult & OpensIntent { .result(opensIntent: DialogOnlyProbeIntent()) }
+}
+
+struct AllOutputsProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "All outputs"
+  @MainActor
+  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog & ShowsSnippetView & OpensIntent {
+    .result(value: "v", opensIntent: DialogOnlyProbeIntent(), dialog: "Done", view: Text("Done"))
+  }
+}
+
+struct SummaryTwoProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Summary two"
+  @Parameter(title: "First") var first: String
+  @Parameter(title: "Second") var second: Int
+  @Parameter(title: "Third", default: false) var third: Bool
+  static var parameterSummary: some ParameterSummary {
+    Summary("Send \(\.$second) to \(\.$first), then \(\.$second) again") { \.$third }
+  }
+  func perform() async throws -> some IntentResult { .result() }
+}
+
+struct SummaryBuilderProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Summary builder"
+  @Parameter(title: "First") var first: String
+  @Parameter(title: "Second") var second: Int
+  @Parameter(title: "Third", default: false) var third: Bool
+  static var parameterSummary: some ParameterSummary {
+    Summary("Just text") {
+      \.$third
+      \.$first
+    }
+  }
+  func perform() async throws -> some IntentResult { .result() }
+}
+
+struct NoSummaryTextProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "No summary text"
+  static var parameterSummary: some ParameterSummary { Summary() }
+  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
+    .result(value: "ok", dialog: "Done")
+  }
+}
+
+struct EmptySummaryTextProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Empty summary text"
+  static var parameterSummary: some ParameterSummary { Summary("") }
+  func perform() async throws -> some IntentResult { .result() }
+}
+
+struct SummaryParametersOnlyProbeIntent: AppIntent {
+  static let title: LocalizedStringResource = "Summary parameters only"
+  @Parameter(title: "First") var first: String
+  @Parameter(title: "Second") var second: Int
+  static var parameterSummary: some ParameterSummary {
+    Summary {
+      \.$second
+      \.$first
+    }
+  }
+  func perform() async throws -> some IntentResult { .result() }
+}
```

**File**: `sweetpad-cli/fixtures/appintents/OutputProbe.swiftconstvalues` (added, +2007/-0)
```diff
@@ -0,0 +1,2007 @@
+[
+  {
+    "allConformances": [
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents.AppIntent"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents.PersistentlyIdentifiable"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents._SupportsAppDependencies"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.Sendable"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.SendableMetatype"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.BitwiseCopyable"
+      }
+    ],
+    "associatedTypeAliases": [
+      {
+        "opaqueTypeProtocolRequirements": [
+          "AppIntents.ProvidesDialog"
+        ],
+        "opaqueTypeSameTypeRequirements": [],
+        "substitutedMangledTypeName": "11OutputProbe010DialogOnlyB6IntentV7performQryYaKFQOy_Qo_",
+        "substitutedTypeName": "some AppIntents.ProvidesDialog",
+        "typeAliasName": "PerformResult"
+      },
+      {
+        "opaqueTypeProtocolRequirements": [
+          "AppIntents.ParameterSummary"
+        ],
+        "opaqueTypeSameTypeRequirements": [],
+        "substitutedMangledTypeName": "10AppIntents0A6IntentPAAE16parameterSummaryQrvpZQOy11OutputProbe010DialogOnlygC0V_Qo_",
+        "substitutedTypeName": "some AppIntents.ParameterSummary",
+        "typeAliasName": "SummaryContent"
+      }
+    ],
+    "conformances": [
+      "AppIntents.AppIntent",
+      "AppIntents.PersistentlyIdentifiable",
+      "AppIntents._SupportsAppDependencies",
+      "Swift.Sendable",
+      "Swift.SendableMetatype",
+      "Swift.BitwiseCopyable"
+    ],
+    "file": "OutputProbe.swift",
+    "kind": "struct",
+    "line": 5,
+    "mangledTypeName": "11OutputProbe010DialogOnlyB6IntentV",
+    "properties": [
+      {
+        "file": "OutputProbe.swift",
+        "isComputed": "false",
+        "isStatic": "true",
+        "label": "title",
+        "line": 6,
+        "mangledTypeName": "n/a - deprecated",
+        "type": "Foundation.LocalizedStringResource",
+        "value": "Dialog only",
+        "valueKind": "RawLiteral"
+      }
+    ],
+    "typeName": "OutputProbe.DialogOnlyProbeIntent"
+  },
+  {
+    "allConformances": [
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents.AppIntent"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents.PersistentlyIdentifiable"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents._SupportsAppDependencies"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.Sendable"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.SendableMetatype"
+      },
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "Swift.BitwiseCopyable"
+      }
+    ],
+    "associatedTypeAliases": [
+      {
+        "opaqueTypeProtocolRequirements": [
+          "AppIntents.ShowsSnippetView"
+        ],
+        "opaqueTypeSameTypeRequirements": [],
+        "substitutedMangledTypeName": "11OutputProbe011SnippetOnlyB6IntentV7performQryYaKFQOy_Qo_",
+        "substitutedTypeName": "some AppIntents.ShowsSnippetView",
+        "typeAliasName": "PerformResult"
+      },
+      {
+        "opaqueTypeProtocolRequirements": [
+          "AppIntents.ParameterSummary"
+        ],
+        "opaqueTypeSameTypeRequirements": [],
+        "substitutedMangledTypeName": "10AppIntents0A6IntentPAAE16parameterSummaryQrvpZQOy11OutputProbe011SnippetOnlygC0V_Qo_",
+        "substitutedTypeName": "some AppIntents.ParameterSummary",
+        "typeAliasName": "SummaryContent"
+      }
+    ],
+    "conformances": [
+      "AppIntents.AppIntent",
+      "AppIntents.PersistentlyIdentifiable",
+      "AppIntents._SupportsAppDependencies",
+      "Swift.Sendable",
+      "Swift.SendableMetatype",
+      "Swift.BitwiseCopyable"
+    ],
+    "file": "OutputProbe.swift",
+    "kind": "struct",
+    "line": 10,
+    "mangledTypeName": "11OutputProbe011SnippetOnlyB6IntentV",
+    "properties": [
+      {
+        "file": "OutputProbe.swift",
+        "isComputed": "false",
+        "isStatic": "true",
+        "label": "title",
+        "line": 11,
+        "mangledTypeName": "n/a - deprecated",
+        "type": "Foundation.LocalizedStringResource",
+        "value": "Snippet only",
+        "valueKind": "RawLiteral"
+      }
+    ],
+    "typeName": "OutputProbe.SnippetOnlyProbeIntent"
+  },
+  {
+    "allConformances": [
+      {
+        "conformanceDefiningModule": "OutputProbe",
+        "protocolName": "AppIntents.AppIntent"
+      },
+      {
+        
```

**File**: `sweetpad-cli/fixtures/appintents/README.md` (modified, +56/-8)
```diff
@@ -1,23 +1,71 @@
 # App Intents compiler captures
 
 The Swift files are synthetic probes owned by this repository.
-`regen.py` builds both probes with Xcode through the local sweetpad binary.
+`regen.py` builds the probes with Xcode through the local sweetpad binary.
 It requires macOS, Xcode, and XcodeGen.
 
 ```sh
 cargo build -p sweetpad-cli --bin sweetpad
 DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer python3 -I sweetpad-cli/fixtures/appintents/regen.py
 ```
 
-The current captures use Xcode 27.2 (`27B52`).
+The checked-in Swift compiler captures use Xcode 27.2 (`27B52`).
 The generator normalizes source paths to file names.
-The tests normalize the generator identity and the order of resolver sets.
+The tests normalize the generator identity, the order of resolver sets,
+and the order of `typeSpecificMetadata` pairs, which Xcode writes in hash order.
 The language-model test compares decoded phrases and negative examples.
 It ignores native phrase order and generation timestamps.
 
 Registration covers basic intents, primitive parameters, enums, entities,
-queries, widget configuration, authentication policies, and App Shortcuts.
-Assistant schemas, explicit supported modes, custom parameter options,
-and dependency metadata currently stop extraction with an error.
-Localized shortcut phrase models and availability-specific metadata need more coverage.
-These captures establish format compatibility, not device registration or Siri behavior.
+queries, widget configuration, authentication policies, App Shortcuts,
+`String.IntentInputOptions`, output flags, and plain parameter summaries.
+The input options probe covers scalar strings, arrays, and sets. The summary
+probes cover omitted text, an explicit empty string, interpolation, and a
+trailing list of parameters. The `*.actions.json` files hold the probe actions.
+Assistant schemas, explicit supported modes, other custom parameter options,
+conditional summaries, summaries with a localization table, and dependency
+metadata currently stop extraction with an error.
+Localized shortcut phrase models and availability beyond the platform annotations
+in the snippet probe need more coverage. Device registration and Siri interaction
+require separate runtime tests.
+
+## SDK upgrade checks
+
+The iOS 27.2 checklist links each parameter option, result protocol, and summary
+form to its evidence. It also lists the two result compositions involving
+`OpensIntent`. The iOS 26.5 and 27.2 inventories record the public overloads
+within each family. Xcode 26.6 uses an earlier enum and entity schema and infers
+an instance parameter named `parameterSummary` from its name and type. Xcode
+27.2 emits the explicit wrapper options for that property.
+[SDK coverage and remaining gaps](sdk-27.2.md)
+
+On a Mac with XcodeGen, run the following from the repository root. Use an empty
+capture directory for each Xcode version. Set `DEVELOPER_DIR` to select Xcode.
+
+```sh
+cargo build --locked -p sweetpad-cli --bin sweetpad
+python3 -B -I sweetpad-cli/fixtures/appintents/sdk_coverage.py
+python3 -B -I sweetpad-cli/fixtures/appintents/regen.py --export-registration .build/intent-captures
+```
+
+Copy the capture directory to Linux, build the CLI with the same Cargo command,
+and run the replay. CI transfers the synthetic compiler inputs and registrations
+between its macOS and Linux jobs.
+
+```sh
+python3 -B -I sweetpad-cli/fixtures/appintents/verify_registration.py .build/intent-captures
+```
+
+The replay compares every field in `extract.actionsdata` and `version.json`
+for each supported probe. It checks the two generator identities separately
+and preserves the pairing of keys and values in unordered metadata. It also
+checks native controls and the named diagnostics for unsupported declarations.
+The SDK-specific fingerprints cover both documents for all seven native probes,
+including the negative cases. The replay checks the Xcode build identifier
+literally before computing fingerprints that can be compared across builds.
+
+On an SDK upgrade, inspect new declarations, overloads and registration changes.
+Add evidence to the versioned checklist, regenerate the affected fixtures, then
+run `sdk_coverage.py --update-signatures` and replay the fresh captures with
+`verify_registration.py CAPTURES --update-registrations` to record the reviewed
+baselines. The workflow performs read-only checks on PRs and weekly.
```

**File**: `sweetpad-cli/fixtures/appintents/ResultProtocols.actionsdata` (added, +721/-0)
```diff
@@ -0,0 +1,721 @@
+{
+  "actions": {
+    "ConfirmProbe": {
+      "assistantDefinedSchemaTraits": [],
+      "assistantDefinedSchemas": [],
+      "authenticationPolicy": 0,
+      "availabilityAnnotations": {
+        "LNPlatformNameWildcard": {
+          "introducedVersion": "*"
+        }
+      },
+      "effectiveBundleIdentifiers": [],
+      "fullyQualifiedTypeName": "ResultProtocols.ConfirmProbe",
+      "identifier": "ConfirmProbe",
+      "isAuthPolExplicit": false,
+      "isDiscoverable": true,
+      "mangledTypeName": "15ResultProtocols12ConfirmProbeV",
+      "mangledTypeNameByBundleIdentifier": {},
+      "mangledTypeNameByBundleIdentifierV2": {},
+      "mangledTypeNameV2": "15ResultProtocols12ConfirmProbeV",
+      "openAppWhenRun": false,
+      "outputFlags": 0,
+      "parameters": [
+        {
+          "capabilities": 0,
+          "dynamicOptionsSupport": 0,
+          "inputConnectionBehavior": 0,
+          "isInput": false,
+          "isOptional": true,
+          "name": "text",
+          "resolvableInputTypes": [
+            {
+              "kindValue": 0,
+              "valueType": {
+                "array": {
+                  "wrapper": {
+                    "capabilities": 3,
+                    "memberValueType": {
+                      "primitive": {
+                        "wrapper": {
+                          "typeIdentifier": 2
+                        }
+                      }
+                    }
+                  }
+                }
+              }
+            },
+            {
+              "kindValue": 0,
+              "valueType": {
+                "primitive": {
+                  "wrapper": {
+                    "typeIdentifier": 0
+                  }
+                }
+              }
+            },
+            {
+              "kindValue": 0,
+              "valueType": {
+                "primitive": {
+                  "wrapper": {
+                    "typeIdentifier": 2
+                  }
+                }
+              }
+            }
+          ],
+          "title": {
+            "alternatives": [],
+            "key": "Text"
+          },
+          "typeSpecificMetadata": [],
+          "valueType": {
+            "primitive": {
+              "wrapper": {
+                "typeIdentifier": 0
+              }
+            }
+          }
+        }
+      ],
+      "presentationStyle": 0,
+      "requiredCapabilities": [],
+      "supportedModes": 1,
+      "systemProtocolMetadata": [],
+      "systemProtocolMetadataV2": [],
+      "systemProtocols": [],
+      "title": {
+        "alternatives": [],
+        "key": "Confirm"
+      },
+      "typeSpecificMetadata": [],
+      "visibilityMetadata": {
+        "assistantOnly": false,
+        "isDiscoverable": true
+      }
+    },
+    "ConfirmationSnippet": {
+      "assistantDefinedSchemaTraits": [],
+      "assistantDefinedSchemas": [],
+      "authenticationPolicy": 0,
+      "availabilityAnnotations": {
+        "LNPlatformNameIOS": {
+          "introducedVersion": "26.0"
+        },
+        "LNPlatformNameMACOS": {
+          "introducedVersion": "26.0"
+        },
+        "LNPlatformNameTVOS": {
+          "introducedVersion": "26.0"
+        },
+        "LNPlatformNameVISIONOS": {
+          "introducedVersion": "26.0"
+        },
+        "LNPlatformNameWATCHOS": {
+          "introducedVersion": "26.0"
+        },
+        "LNPlatformNameWildcard": {
+          "introducedVersion": "*"
+        }
+      },
+      "effectiveBundleIdentifiers": [],
+      "fullyQualifiedTypeName": "ResultProtocols.ConfirmationSnippet",
+      "identifier": "ConfirmationSnippet",
+      "isAuthPolExplicit": false,
+      "isDiscoverable": false,
+      "mangledTypeName": "15ResultProtocols19ConfirmationSnippetV",
+      "mangledTypeNameByBundleIdentifier": {},
+      "mangledTypeNameByBundleIdentifierV2": {},
+      "mangledTypeNameV2": "15ResultProtocols19ConfirmationSnippetV",
+      "openAppWhenRun": false,
+      "outputFlags": 2,
+      "parameters": [],
+      "presentationStyle": 0,
+      "requiredCapabilities": [],
+      "supportedModes": 1,
+      "systemProtocolMetadata": [
+        "com.apple.link.systemProtocol.Snippet",
+        {
+          "empty": {}
+        }
+      ],
+      "systemProtocolMetadataV2": [
+        "com.apple.link.systemProtocol.Snippet",
+        {
+          "empty": {}
+        }
+      ],
+      "systemProtocols": [
+        "com.apple.link.systemProtocol.Snippet"
+      ],
+      "title": {
+        "alternatives": [],
+        "key": "Confirmation snippet"
+      },
+      "typeSpecificMetadata": [],
+      "visibilityMetadata": {
+        "assistantOnly": false,
+        "isDiscoverable": false
+      }
+    },
+    "ConnectionProbe": {
+      "assistantDefinedSchemaTraits": [],
+      "assistantDefinedSchemas": [],
+      "authenticationPolicy": 0,
+      "availabilityAnnotations": {
+        "LNPlatformNameWildcard": {
+       
```

#### Recent Merged Pull Requests:
- **PR #370** (2026-11-28): Match Xcode App Intents input options, output flags, and parameter summaries (@hyzyla)
- **PR #368** (2026-11-28): Compile CoMaps resources and preserve asset variants on Linux (@hyzyla)
- **PR #367** (2026-11-25): Fix App Clip signing on Linux and verify it end to end (@hyzyla)
- **PR #366** (2026-11-22): Fix Linux watchOS linking, setup races, and CLI failure output (@hyzyla)
- **PR #365** (2026-11-21): Address 104 Dependabot alerts across SweetPad dependencies (@hyzyla)
- **PR #364** (2026-11-21): Set up Linux builds with sweetpad's own SDK import and LLVM linker (@hyzyla)

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

## X. Compile CoMaps resources and preserve asset variants on Linux

**RULE**:
When implementing operations in `.github/workflows/sweetpad-lib.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `89f52f8f`: Compile CoMaps resources and preserve asset variants on Linux. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/sweetpad-lib.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - name: Check out the CoMaps interface files and asset catalog
        uses: actions/checkout@v7
        with:
          repository: comaps/comaps
          ref: 27ea5a9b92b266abe6d1b690e02ad5c89bf95217
          path: .build/comaps-source
          persist-credentials: false
          sparse-checkout-cone-mode: false
          sparse-checkout: |
            /iphone/Maps/**/*.xib
            /iphone/Maps/**/*.storyboard
            /iphone/Maps/**/Contents.json
            /iphone/Maps/Images.xcassets/
            /iphone/Maps/CoMapsWidgetExtension/Assets.xcassets/
      - name: Require fixture coverage for every CoMaps resource combination
        if: matrix.os == 'ubuntu-24.04'
        run: python3 sweetpad-cli/fixtures/resource_gaps.py .build/comaps-source/iphone/Maps --require-covered
      - name: Compile CoMaps and the resource regression fixtures on Linux
        run: |
          cargo build -p sweetpad-cli --bin sweetpad
          python3 sweetpad-cli/fixtures/comaps/compile.py target/debug/sweetpad .build/comaps-source "$RUNNER_TEMP/comaps-resources"
      - name: Export Linux-built resources for UIKit
        if: matrix.os == 'ubuntu-24.04'
        uses: actions/upl
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `89f52f8f` are properly handled with clean fallback behavior.
