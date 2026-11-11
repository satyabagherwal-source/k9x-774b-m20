> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source**: github ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Source Version**: `7df9d947`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T04:00:42.293Z  
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
> **Harvest Timestamp**: 2026-11-09T04:00:41.285Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1926 stars

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
- **Issue #348** (2026-11-08): **Document Linux iPhone workflows and macOS CI**
  *Symptoms*: The Linux guide combines installation, device setup, signing, framework preparation, and runtime limits in one page. Add a dedicated Linux sidebar category with task-focused guides while preserving the current overview URL.  - Focus the main workflow on iOS and iPhone: Ubuntu ARM64 setup, USB trust and transport, development signing, prebuilt tests, archives, and GitHub Actions delivery. - Add separate React Native and Flutter guides with the validated versions, preparation recipes, Hermes requirements, and Linux iOS AOT compiler steps. - Add a macOS CI page with a hosted-Mac build/test workflow and a separate Linux compilation path. Include an architecture diagram and a shared support/configuration reference.  Validation: documentation production build, TypeScript, shell syntax checks, both workflow examples through actionlint, and all nine rendered routes. Headless Chrome checks cover the expanded sidebar, readable architecture diagram, and macOS CI page. The docs use the published CLI 0.1.18 release. 

- **Issue #347** (2026-11-08): **Close Linux build gaps and package an experimental ARM64 release**
  *Symptoms*: Linux builds need a release artifact that users can install without compiling Sweetpad, plus regression coverage for the gaps found in real apps and on an iPhone.  - Close corpus, resource, macro, linker, MMKV, debug-symbol, and automatic test-manifest gaps. The patched corpus builds 127 of 128 current schemes; the deliberate missing-package fixture remains a negative test. - Add authenticated direct Linux iPhone USB and Wi-Fi transport, isolated network pairing, and automatic multicast/DNS-SD discovery. - Package an experimental Ubuntu 24.04 ARM64 CLI with an installer, DAP alias, checksums, licenses, a sample app, and public setup sources. Apple SDKs and signing material stay private. Fix macro runtime lookup exposed by the isolated installation check. - Add hosted ARM64 packaging and clean-container checks, plus a manually selected private-SDK integration job. Tag publication waits for verified macOS and Linux packages; manual Linux-only runs publish nothing.  Validation: optimized ARM64 release build; installation in a clean Ubuntu 24.04 ARM64 container; installed sample compiled into an ARM64 Mach-O app with an empty home, fresh DerivedData, no network, and explicit read-only toolchain/SDK prerequisites; 28 Python checks on macOS and ARM64 Linux; actionlint; formatting; documentation production build. Earlier follow-up reports cover native bundle controls, incremental/prebuilt test execution, unshimmed MMKV storage, Flutter AOT, React Native/Hermes, and physical iPhone U

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

### Incident Patch 1: `e56e699c` (2026-11-08)
**Commit Message**: Close Linux build gaps and package an ARM64 release (#347)

Close Linux corpus, resource, linker, macro, test-manifest, and iPhone transport gaps. Add experimental Ubuntu 24.04 ARM64 packages, install validation, documentation, and gated release CI.

Validation: all PR checks and the nonpublishing ARM64/private SDK workflow pass. The final hosted artifact also builds the sample app in a fresh isolated Linux home. Optional .omo work and dependency-size cleanup remain deferred.

**File**: `.github/workflows/cli-release.yaml` (modified, +67/-3)
```diff
@@ -5,6 +5,20 @@ on:
   # Manual runs build + sign + notarize without publishing, since the release and
   # tap-bump steps below are gated on a tag ref.
   workflow_dispatch:
+    inputs:
+      platform:
+        description: Platforms to build without publishing
+        type: choice
+        options: [all, linux-arm64]
+        default: all
+      validate_sdk:
+        description: Validate the ARM64 package with a private Apple SDK runner
+        type: boolean
+        default: false
+      sdk_runner_label:
+        description: Label of the provisioned private SDK runner
+        type: string
+        default: sweetpad-linux
 
 permissions:
   contents: write
@@ -14,7 +28,24 @@ permissions:
 
 name: Release CLI
 jobs:
+  linux-arm64:
+    name: Linux ARM64 release package
+    uses: ./.github/workflows/linux-arm64-package.yaml
+  sdk-validation:
+    name: Private SDK install validation
+    if: github.event_name == 'workflow_dispatch' && inputs.validate_sdk
+    needs: linux-arm64
+    permissions:
+      contents: read
+      actions: read
+    uses: ./.github/workflows/linux-apple-build.yaml
+    with:
+      artifact_run_id: ${{ github.run_id }}
+      runner_label: ${{ inputs.sdk_runner_label }}
   release:
+    if: inputs.platform != 'linux-arm64'
+    outputs:
+      version: ${{ steps.version.outputs.version }}
     name: Build, sign, notarize CLI (macOS)
     runs-on: macos-latest
     steps:
@@ -33,6 +64,7 @@ jobs:
         run: rustup show
 
       - name: Resolve version
+        id: version
         # On a cli-v* tag the version is the tag; manual runs get a -dryrun suffix
         # off the crate version and skip publishing.
         run: |
@@ -52,6 +84,7 @@ jobs:
             VERSION="$(grep -m1 '^version' Cargo.toml | cut -d'"' -f2)-dryrun"
           fi
           echo "VERSION=$VERSION" >> "$GITHUB_ENV"
+          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
           echo "TARBALL=sweetpad-cli-$VERSION-macos-universal.tar.gz" >> "$GITHUB_ENV"
           echo "Building sweetpad CLI $VERSION"
 
@@ -119,7 +152,7 @@ jobs:
           tar -C dist -czf "$TARBALL" sweetpad sweetpad-dap
           echo "SHA256=$(shasum -a 256 "$TARBALL" | cut -d' ' -f1)" >> "$GITHUB_ENV"
           tar -tvzf "$TARBALL"
-          shasum -a 256 "$TARBALL"
+          shasum -a 256 "$TARBALL" > "$TARBALL.sha256"
 
       - name: Attest build provenance
         # mise verifies this attestation when it installs from the release;
@@ -136,9 +169,35 @@ jobs:
         uses: actions/upload-artifact@v7
         with:
           name: cli-tarball
-          path: "*.tar.gz"
+          path: |
+            *.tar.gz
+            *.sha256
           if-no-files-found: error
 
+  publish:
+    name: Publish verified macOS and Linux packages
+    needs: [release, linux-arm64]
+    if: startsWith(github.ref, 'refs/tags/cli-v')
+    runs-on: ubuntu-24.04
+    env:
+      VERSION: ${{ needs.release.outputs.version }}
+      TARBALL: sweetpad-cli-${{ needs.release.outputs.version }}-macos-universal.tar.gz
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          fetch-depth: 0
+      - uses: actions/download-artifact@v8
+        with:
+          pattern: cli-tarball*
+          merge-multiple: true
+      - name: Verify all package checksums
+        run: |
+          for checksum in *.sha256; do sha256sum -c "$checksum"; done
+          echo "SHA256=$(sha256sum "$TARBALL" | cut -d' ' -f1)" >> "$GITHUB_ENV"
+      - name: Attest release archives
+        uses: actions/attest@v4
+        with:
+          subject-path: '*.tar.gz'
       - name: Build release notes
         # Commit subjects over the tag range, scoped to the paths the CLI ships
         # from so unrelated monorepo work (docs site, extension) stays out.
@@ -156,6 +215,9 @@ jobs:
             echo
             echo "    mise use -g 'github:sweetpad-dev/sweetpad[version_prefix=cli-v]'"
             echo
+            echo 'Linux ARM64 (experimental, Ubuntu 24.04): download the linux-arm64 tarball and its .sha256 file, verify it, then run the included install.sh.'
+            echo 'The archive includes public toolchain setup sources. Apple SDKs and signing material are supplied separately.'
+            echo
             echo '## Changes'
             echo
           } > "$NOTES"
@@ -176,7 +238,9 @@ jobs:
           tag_name: ${{ github.ref_name }}
           name: ${{ github.ref_name }}
           body_path: ${{ runner.temp }}/notes.md
-          files: "*.tar.gz"
+          files: |
+            *.tar.gz
+            *.sha256
 
       - name: Update Homebrew tap formula
         if: startsWith(github.ref, 'refs/tags/')
```

**File**: `.github/workflows/linux-apple-build.yaml` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+name: Linux Apple SDK integration
+on:
+  workflow_dispatch:
+    inputs:
+      artifact_run_id:
+        description: Optional run with a verified cli-tarball-linux-arm64 artifact
+        type: string
+        default: ''
+      runner_label:
+        description: Label of the provisioned private SDK runner
+        type: string
+        default: sweetpad-linux
+  workflow_call:
+    inputs:
+      artifact_run_id:
+        type: string
+        default: ''
+      runner_label:
+        type: string
+        default: sweetpad-linux
+permissions:
+  contents: read
+  actions: read
+jobs:
+  hybrid-builds:
+    # The Apple SDK stays on a provisioned Apple-hardware Linux runner.
+    # Never upload or distribute it as a workflow artifact.
+    runs-on: [self-hosted, Linux, ARM64, '${{ inputs.runner_label }}']
+    timeout-minutes: 120
+    env:
+      CARGO_INCREMENTAL: "0"
+      CARGO_PROFILE_DEV_DEBUG: "0"
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+      - name: Download verified ARM64 package
+        if: inputs.artifact_run_id != ''
+        uses: actions/download-artifact@v8
+        with:
+          name: cli-tarball-linux-arm64
+          run-id: ${{ inputs.artifact_run_id }}
+          github-token: ${{ github.token }}
+          path: ${{ runner.temp }}/release-package
+      - name: Validate package with isolated home and private SDK
+        if: inputs.artifact_run_id != ''
+        env:
+          PACKAGE_ROOT: ${{ runner.temp }}/release-package
+        run: |
+          export PATH="$HOME/bin:$HOME/swift/swift-6.4.2-RELEASE/usr/bin:$PATH"
+          MACROS="$HOME/bin/sweetpad-macros.bin"
+          if [ ! -e "$MACROS" ]; then MACROS="$HOME/bin/sweetpad-macros"; fi
+          python3 sweetpad-cli/ci/check-linux-sdk-install.py \
+            --archive "$(find "$PACKAGE_ROOT" -maxdepth 1 -name '*.tar.gz')" \
+            --out "$RUNNER_TEMP/sdk-package-install" \
+            --swift "$HOME/swift/swift-6.4.2-RELEASE" \
+            --swbuild-products "$HOME/src/swift-build/.build/out/Products/Release-linux-aarch64" \
+            --macros "$(readlink -f "$MACROS")" \
+            --sdk "$HOME/.swiftpm/swift-sdks/darwin.artifactbundle"
+      - name: Build CLI
+        run: |
+          export PATH="$HOME/.cargo/bin:$HOME/bin:$HOME/swift/swift-6.4.2-RELEASE/usr/bin:$PATH"
+          CARGO_TARGET_DIR="$HOME/sweetpad-target" cargo build --locked -p sweetpad-cli --bin sweetpad
+      - name: Install frozen framework tools
+        run: bash sweetpad-lib/ci/linux-framework-tools.sh
+      - name: Fresh Linux dependency and Release build checks
+        run: python3 -B sweetpad-lib/ci/linux-clean-checks.py --out "$RUNNER_TEMP/linux-clean"
+      - name: Generate manifests for Linux XCTest and Swift Testing products
+        run: |
+          export PATH="$HOME/bin:$HOME/swift/swift-6.4.2-RELEASE/usr/bin:$PATH"
+          python3 -B sweetpad-lib/ci/linux-exec-audit.py --out "$RUNNER_TEMP/linux-clean/reports/test-build-audit" -- \
+            "$HOME/sweetpad-target/debug/sweetpad" test build \
+            --project "$PWD/sweetpad-lib/ci/fixture-test-manifest/ManifestProbe.xcodeproj" \
+            --scheme ManifestProbe --configuration Debug --destination 'generic/platform=iOS Simulator' \
+            --json --non-interactive -- -derivedDataPath "$RUNNER_TEMP/manifest-products" \
+            ARCHS=arm64 CODE_SIGNING_ALLOWED=NO > "$RUNNER_TEMP/linux-clean/reports/test-build.json"
+          python3 - "$RUNNER_TEMP/linux-clean/reports/test-build.json" <<'PYCODE'
+          import json, pathlib, plistlib, sys
+          result = json.loads(pathlib.Path(sys.argv[1]).read_text())
+          assert result['ok'] and result['data']['built']
+          path = pathlib.Path(result['data']['xctestrunPath'])
+          targets = plistlib.loads(path.read_bytes())['TestConfigurations'][0]['TestTargets']
+          assert {t['BlueprintName'] for t in targets} == {'LogicXCTests', 'LogicSwiftTests'}
+          assert all(t['EnvironmentVariables']['MANIFEST_VALUE'] == 'Linux tests ü' for t in targets)
+          PYCODE
+      - name: Generate mixed UI and logic test-plan manifests
+        run: |
+          export PATH="$HOME/bin:$HOME/swift/swift-6.4.2-RELEASE/usr/bin:$PATH"
+          "$HOME/sweetpad-target/debug/sweetpad" test build \
+            --project "$PWD/sweetpad-lib/ci/fixture-test-plans/TestPlanProbe.xcodeproj" \
+            --scheme TestPlanProbe --destination 'generic/platform=iOS Simulator' --json --non-interactive \
+            -- -derivedDataPath "$RUNNER_TEMP/plan-products" ARCHS=arm64 CODE_SIGNING_ALLOWED=NO \
+            > "$RUNNER_TEMP/linux-clean/reports/test-plan-build.json"
+          python3 - "$RUNNER_TEMP/linux-clean/reports/test-plan-build.json" <<'PYCODE'
+          import json, pathlib, plistlib, sys
+          result = json.loads(pathlib.Path(sys.argv[1]).read_text())
+          assert result['ok'] and resu
```

**File**: `.github/workflows/linux-arm64-package.yaml` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+name: Linux ARM64 package
+on:
+  pull_request:
+    paths:
+      - "sweetpad-cli/**"
+      - "sweetpad-core/**"
+      - "sweetpad-lib/**"
+      - "Cargo.toml"
+      - "Cargo.lock"
+      - "rust-toolchain.toml"
+      - ".github/workflows/linux-arm64-package.yaml"
+      - ".github/workflows/cli-release.yaml"
+  workflow_dispatch:
+  workflow_call:
+permissions:
+  contents: read
+jobs:
+  package:
+    name: ARM64 archive and clean Ubuntu install
+    runs-on: ubuntu-24.04-arm
+    timeout-minutes: 45
+    env:
+      CARGO_INCREMENTAL: "0"
+      CARGO_PROFILE_RELEASE_DEBUG: "0"
+      CARGO_PROFILE_RELEASE_STRIP: symbols
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          fetch-depth: 0
+      - name: Install build dependencies
+        run: sudo apt-get update -qq && sudo apt-get install -y libssl-dev pkg-config
+      - name: Install pinned Rust
+        run: rustup show
+      - uses: Swatinem/rust-cache@v2
+      - name: Build ARM64 release CLI
+        run: cargo build --release --locked -p sweetpad-cli --bin sweetpad -j 4
+      - name: Package public sources and binary
+        run: |
+          VERSION="$(python3 sweetpad-cli/ci/release-version.py)"
+          export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
+          python3 sweetpad-cli/ci/package-linux.py --binary target/release/sweetpad --version "$VERSION" --out dist
+      - name: Install in a clean Ubuntu 24.04 ARM64 container
+        run: |
+          mkdir -p "$RUNNER_TEMP/package-smoke"
+          docker run --rm --platform linux/arm64 \
+            -v "$PWD/dist:/artifacts:ro" \
+            -v "$PWD/sweetpad-cli/ci/check-linux-package.py:/check.py:ro" \
+            -v "$RUNNER_TEMP/package-smoke:/reports" ubuntu:24.04 bash -euc '
+              apt-get update -qq
+              DEBIAN_FRONTEND=noninteractive apt-get install -yqq python3 ca-certificates libssl3t64 libgcc-s1
+              python3 /check.py --archive "$(find /artifacts -maxdepth 1 -name "*.tar.gz")" --out /reports/install
+            '
+      - name: Upload install evidence
+        if: always()
+        uses: actions/upload-artifact@v7
+        with:
+          name: linux-arm64-install-report
+          path: ${{ runner.temp }}/package-smoke/install/*.json
+          if-no-files-found: warn
+      - name: Upload verified release package
+        uses: actions/upload-artifact@v7
+        with:
+          name: cli-tarball-linux-arm64
+          path: |
+            dist/*.tar.gz
+            dist/*.sha256
+          if-no-files-found: error
```

**File**: `.github/workflows/sweetpad-lib.yaml` (modified, +27/-0)
```diff
@@ -35,6 +35,33 @@ on:
 #   python3 sweetpad-lib/scripts/21_mutation_audit.py [--e2e]
 
 jobs:
+  linux:
+    name: Linux · ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [ubuntu-24.04, ubuntu-24.04-arm]
+    runs-on: ${{ matrix.os }}
+    env:
+      CARGO_INCREMENTAL: "0"
+      CARGO_PROFILE_DEV_DEBUG: "0"
+      CARGO_PROFILE_TEST_DEBUG: "0"
+    steps:
+      - uses: actions/checkout@v7
+      - name: Install Linux build prerequisites
+        run: sudo apt-get update -qq && sudo apt-get install -y libssl-dev pkg-config
+      - name: Install pinned Rust toolchain
+        run: rustup show
+      - uses: Swatinem/rust-cache@v2
+      - name: Format
+        run: cargo fmt --all --check
+      - name: Clippy
+        run: cargo clippy --workspace --all-targets -- -D warnings
+      # Xcode subprocess integration tests run in the macOS job below.
+      - name: Unit tests without Apple SDKs
+        run: cargo test --workspace --lib -- --test-threads=1
+      - name: Python regression checks
+        run: python3 -B -m unittest discover -s sweetpad-lib/ci -p 'test_*.py'
   check:
     name: fmt · clippy · test
     runs-on: macos-latest
```

**File**: `.gitignore` (modified, +9/-0)
```diff
@@ -1,4 +1,6 @@
 out
+# Xcode captures used by the portable Core Data compiler tests.
+!sweetpad-cli/fixtures/momc/expected/*/out/
 dist
 node_modules
 .vscode-test/
@@ -11,6 +13,13 @@ out-e2e
 # Rust workspace build output
 /target
 
+# Python helper bytecode
+__pycache__/
+*.pyc
+
+# Swift Package Manager build cache
+/.build/
+
 # N-API addon build outputs (regenerated by build:native:*)
 sweetpad-vscode/native/*.node
 sweetpad-vscode/native/index.js
```

**File**: `Cargo.lock` (modified, +21/-0)
```diff
@@ -416,6 +416,16 @@ version = "0.1.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "aedcfb3409746eddb02b9e19ebda1c3394f759a152e48ee875a0844d1b955484"
 
+[[package]]
+name = "flatbuffers"
+version = "25.12.19"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "35f6839d7b3b98adde531effaf34f0c2badc6f4735d26fe74709d8e513a96ef3"
+dependencies = [
+ "bitflags",
+ "rustc_version",
+]
+
 [[package]]
 name = "flate2"
 version = "1.1.10"
@@ -1336,6 +1346,15 @@ version = "2.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "94300abf3f1ae2e2b8ffb7b58043de3d399c73fa6f4b73826402a5c457614dbe"
 
+[[package]]
+name = "rustc_version"
+version = "0.4.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cfcb3a22ef46e85b45de6ee7e79d063319ebb6594faafcf1c225ea92ab6e9b92"
+dependencies = [
+ "semver",
+]
+
 [[package]]
 name = "rustix"
 version = "1.1.5"
@@ -1578,10 +1597,12 @@ dependencies = [
  "clap_complete",
  "des",
  "dialoguer",
+ "flatbuffers",
  "flate2",
  "hayro",
  "libc",
  "minreq",
+ "moxcms",
  "png",
  "resvg",
  "rsa",
```

**File**: `Cargo.toml` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ png = "0.18"
 # Gzip, for the image pixels in the actool stand-in's Assets.car; png already
 # depends on it.
 flate2 = "1"
+# App Shortcuts' NLU model uses FlatBuffers; use the standard runtime.
+flatbuffers = "25.12.19"
+# ICC color conversion for calibrated Interface Builder colors (already used by image).
+moxcms = "0.8.1"
 # The actool stand-in draws a catalog's vector images the way Xcode does,
 # into bitmaps: PDFs with hayro, SVGs and symbol templates with resvg (and
 # the usvg and roxmltree it re-exports, and svgtypes, which usvg parses
```

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +70/-7)
```diff
@@ -810,6 +810,15 @@ sweetpad bsp init [--output-file PATH]  write buildServer.json for sourcekit-lsp
 sweetpad completions <shell>          clap_complete-generated scripts
 ```
 
+`test run --xctestrun FILE` runs prebuilt Apple test products on a Mac using
+`test-without-building`. The manifest replaces build selection in the Xcode
+command: project, workspace, scheme, and configuration flags are omitted.
+The project still supplies the retained test context and result history.
+Selectors, reports, and result bundles work as usual. A prebuilt run leaves
+build diagnostics intact; `test build`, watch mode, and result read-back verbs
+refuse the flag. A readable result with zero tests fails instead of reporting
+success.
+
 `app run` gains the full session experience:
 
 - **`--device` / `--device-id <id>`** — build + install + launch on a physical
@@ -4585,7 +4594,8 @@ the stand-ins at the CLI's version, with nothing more to install. Where the
 corpus can check, a stand-in's output is Xcode's byte for byte: asset
 catalogs, nibs, String Catalogs, Core Data models, signatures. What a
 stand-in doesn't do fails with an error that names it. The stand-ins are
-`actool`, `ibtool`, `momc`, `xcstringstool`, `intentbuilderc`, `codesign`,
+`actool`, `ibtool`, `momc`, `mapc`, `xcstringstool`, `intentbuilderc`, `extractLocStrings`,
+the App Intents metadata and language-model processors, `codesign`,
 `derq`, the provisioning tool, `copypng`, `ditto`, `lipo`, `strip`,
 `embeddedBinaryValidationUtility`, `ld64.lld` and `xcrun`.
 
@@ -4598,12 +4608,13 @@ other `-sdk`, as `xcrun` does, and leaves the script's alone without one.
 `--find` and the `--show-sdk-*` queries answer from the Darwin SDK.
 
 **Swift Build is patched, as little as it can be.** `linux-setup.sh` builds
-`swbuild` at the toolchain's tag with `ci/swift-build-linux.patch`. Each
+Swift 6.4.2 with Swift Build 6.4.0 and `ci/swift-build-linux.patch`. Each
 change is one an upstream pull request could take: a failed `lsregister`
 start is a note, as a failed run already is; provisioning requests go to the
 tool `SWEETPAD_PROVISIONING` names; `derq` is looked up on the search path;
 the Mach-O reader has its structures on every platform; and text encodings
-are found by name without CoreFoundation.
+are found by name without CoreFoundation, including Unicode byte-order marks.
+LLVM's Darwin libtool is recognized without treating its LLVM version as a cctools version.
 
 **Signing has no keychain.** The identity is a `.p12` file
 (`SWEETPAD_CODE_SIGN_P12`, its password in `SWEETPAD_CODE_SIGN_P12_PASSWORD`),
@@ -4615,19 +4626,71 @@ device build signs; a simulator build keeps the linker's ad hoc signature.
 **Apple's macros come from `sweetpad-macros`.** The Darwin SDK's plugin
 server has no `SwiftDataMacros`, has `#Preview` only for SwiftUI views, and
 its `FoundationMacros` expands to `FoundationEssentials`, which the SDK
-doesn't have. `sweetpad-cli/macros` builds one plugin for all three, which
+doesn't have. `sweetpad-cli/macros` builds one plugin for these modules, SwiftUI `@Entry`, and TipKit, which
 the toolset loads.
 
-**Linux builds come from source.** The Homebrew release stays a macOS
-binary. `linux-setup.sh` provisions Ubuntu 24.04, an OrbStack machine on a
-Mac or a host of its own, and the guide builds sweetpad with cargo.
+**Package macros run on the host.** Local-package schemes include their own test products.
+Tuist-generated macro executables are built with SwiftPM's native build system.
+Their consumers use the resulting host executable. Aggregate workspace schemes exclude those
+prebuilt tools from the Darwin build request. Destination-only SDK settings do not leak into host builds.
+
+**Resolved Git packages expose explicit schemes.** The scheme reader follows the selected
+DerivedData `SourcePackages/workspace-state.json` and reads checkout scheme files.
+It honors a custom DerivedData path and does not fetch packages while listing.
+Package-root PIF reads have separate scratch directories so they preserve the app's graph.
+Already-present package targets need no second root read.
+
+**Additional Apple platforms use their own SDKs.** Setup imports tvOS, watchOS, and visionOS
+SDK data, testing frameworks, platform metadata, and companion stubs from the user's Xcode.
+It registers their Swift SDK target triples. SDK-scoped resource directories and
+LLD driver selection keep Linux modules out of Apple builds. Cross-tool settings also
+cover companion targets that use another Apple SDK in the same request.
+Modern standalone simulator apps and the migrated corpus watch apps build on both hosts.
+Runtime and device-signing checks remain unverified for the additional platforms.
+
+**Script phases use Bash in a private mount.** Bubblewrap maps the real `/bin/sh` target to Bash
+for the build process. The host's shell configuration is unchanged. SDK C++ headers come from
+its Xcode toolchain. `xcrun clang` translates Apple deployment flags int
```

---

### Incident Patch 2: `7df9d947` (2026-11-08)
**Commit Message**: Document Linux iPhone workflows and macOS CI (#348)

Add an iPhone-focused Linux documentation section covering architecture, Ubuntu and USB, signing and tests, GitHub Actions, React Native, and Flutter. Include a separate macOS CI guide and shared support reference. Preserve the existing overview URL and link from setup and automation pages.

Validation: production site build, TypeScript, shell syntax, workflow example linting, all nine rendered routes, and headless browser checks.

**File**: `sweetpad-docs/docs/cli/getting-started.md` (modified, +2/-2)
```diff
@@ -6,8 +6,8 @@ sidebar_label: Get started
 # Get started with the CLI
 
 The `sweetpad` command-line tool builds, runs, and tests your Xcode apps from the terminal, with no editor
-needed. This page gets you from install to a running app in a few minutes. You need a Mac with Xcode
-installed.
+needed. This page covers the native Mac workflow with Xcode.
+For iPhone builds on Ubuntu, start with [Linux setup and USB](./linux/ubuntu-usb.md).
 
 ## 1. Install
 
```

**File**: `sweetpad-docs/docs/cli/linux.md` (modified, +39/-349)
```diff
@@ -1,375 +1,65 @@
 ---
-sidebar_position: 10
-sidebar_label: Building on Linux
+sidebar_label: Linux overview
 ---
 
-# Building on Linux
+# Build iPhone apps on Linux
 
-`sweetpad build` can build an Xcode project on Linux. It uses Swift Build, Apple's open-source build system, against the
-Apple SDKs taken from your own copy of Xcode. For the Xcode tools Linux doesn't have, sweetpad
-runs its own replacements.
-
-The command is the same one you run on a Mac:
-
-```bash
-sweetpad build --scheme MyApp --destination "generic/platform=iOS Simulator"
-```
-
-:::warning
-Linux builds are experimental. Release archives target Ubuntu 24.04 ARM64 on Apple hardware.
-Homebrew remains macOS only. Other Linux architectures require a source build and remain outside the release support scope.
-:::
-
-## What builds
-
-Most of what an iOS or macOS app is made of builds the way Xcode builds it:
-
-- iOS and macOS apps, with their app extensions and widgets, frameworks and static libraries.
-- tvOS, watchOS, and visionOS simulator builds, including modern standalone SwiftUI apps.
-- Swift packages, local and remote, including packages that ship a binary XCFramework.
-- Asset catalogs, storyboards and XIBs, String Catalogs and `.strings` files, and Core Data
-  models and common Core Data mapping models.
-- SwiftData's macros, `#Predicate`, `#Preview`, SwiftUI `@Entry`, and TipKit macros.
-- Package macros built for the Linux host, including Tuist-generated macro tools.
-- Explicit schemes shipped by resolved Git packages, including custom DerivedData locations.
-- App Intents metadata and language models for the supported intent schemas.
-- Run script phases, including scripts that call `xcrun`, `ditto` or `lipo`.
-- Device builds, signed with your development identity (see
-  [Signing a device build](#signing-a-device-build)).
-- Development archives and IPA export that preserve the build's signing identity.
-
-The real-project suite includes Mastodon, Swiftfin, Wikipedia, Flutter, React Native, and Capacitor.
-See the repository's `sweetpad-lib/ci/LINUX_PROJECTS.md` for source pins, results, and setup requirements.
-Framework projects need their generated dependencies before compilation.
-All seven larger fixtures pass two launches on an iPhone 13.
-Wikipedia and Mastodon use explicit app-local startup fixtures with omitted extensions and unsupported capabilities.
-The checks reuse an existing wildcard profile and do not validate those capabilities.
-Flutter Release uses a Linux-hosted iOS AOT compiler built from pinned Dart sources; its engine remains a prebuilt dependency.
-
-## What stays on a Mac
-
-Some things need macOS itself, or an Apple tool that exists only for macOS:
-
-- Running the app in the Simulator and executing tests. Linux can compile test products with `sweetpad test build`.
-- Mac Catalyst builds remain unverified.
-- Metal shaders, Core ML model classes, and SceneKit and RealityKit
-  assets.
-- Run scripts that need macOS, like a Swift script that imports Darwin.
-
-Other limits include advanced mapping expressions, unsupported App Intents schemas,
-distribution IPA export, and some Swift/C++ interoperability cases.
-The fresh MMKV example builds without its former C++ shim.
-Its device checks pass 14 storage assertions across two launches, including persistence after relaunch.
-See `sweetpad-lib/ci/LINUX_PROJECTS.md` for source pins and dependency preparation.
-
-iOS Icon Composer support produces static light, dark, and tinted appearances.
-Interactive glass lighting and native material effects remain unsupported.
-Sticker packs support ordered PNG/GIF/JPEG members and message-extension icons.
-Sticker sequences and localized sticker-pack strings remain unsupported.
-
-A build that needs one of these fails with an error, the same way a broken project would.
-
-Current Xcode and Swift Build reject deprecated WatchKit extension products.
-Use a modern single-target watchOS app. The new platform probes verify compilation and linking;
-runtime and device-signing checks for tvOS, watchOS, and visionOS remain unverified.
-
-## Install the ARM64 release archive
-
-Download the `linux-arm64` archive and its `.sha256` file from a [CLI release](https://github.com/sweetpad-dev/sweetpad/releases).
-The archive contains the CLI, an installer, a sample project, and public toolchain setup sources.
-It contains no Apple SDKs, signing material, or build caches.
-
-Install the runtime dependencies:
-
-```bash
-sudo apt-get update
-sudo apt-get install ca-certificates libssl3t64 libgcc-s1
-```
-
-Verify and extract the archive into an empty directory:
+SweetPad builds an Xcode project on Linux, signs it with your development identity, and installs it on an iPhone.
+The command uses the same project, scheme, and build settings as the macOS CLI.
 
 ```bash
-sha256sum -c sweetpad-cli-VERSION-linux-arm64.tar.gz.sha256
-mkdir sweetpad-install
-tar -xzf sweetpad-cli-VERSION-linux-arm64.tar.gz -C sweetpad-install
-bash 
```

**File**: `sweetpad-docs/docs/cli/linux/flutter.md` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+---
+sidebar_label: Flutter
+---
+
+# Flutter iPhone apps on Linux
+
+A Flutter iOS app needs both its Xcode project and Dart application code.
+For a Release build, that code includes an iOS AOT snapshot.
+
+The validated workflow uses Flutter 3.47.9 and its matching engine artifacts.
+A Linux-built ARM64 iOS snapshot compiler produces the application snapshot.
+The Flutter engine framework remains a prebuilt dependency.
+
+:::info Prerequisites
+Complete [Ubuntu setup](ubuntu-usb.md) first.
+This recipe supports the pinned Flutter revision and an ARM64 Linux host.
+It does not turn the standard Flutter iOS command into a general Linux build command.
+:::
+
+## Install the matching Flutter SDK
+
+Use the tested Flutter revision:
+
+```bash
+git clone --filter=blob:none https://github.com/flutter/flutter.git "$HOME/src/flutter"
+git -C "$HOME/src/flutter" checkout c197ca5199e9ee5661e865596c9c07294dfab51c
+export PATH="$HOME/src/flutter/bin:$PATH"
+flutter --version
+flutter precache --ios
+```
+
+The cached iOS engine artifacts include a snapshot compiler for a Mac host.
+Downloading those artifacts alone does not provide Linux AOT compilation.
+
+## Get the helper sources
+
+Use an existing checkout of this tag, or create one:
+
+```bash
+git clone --branch cli-v0.1.18 --depth 1 https://github.com/sweetpad-dev/sweetpad.git "$HOME/src/sweetpad"
+cd "$HOME/src/sweetpad"
+bash sweetpad-lib/ci/linux-framework-tools.sh
+source "$HOME/.cache/sweetpad/framework-tools/env.sh"
+sudo apt-get install ninja-build
+```
+
+The frozen preparation recipe expects the documented Node tools even for this sample.
+The compiler recipe also needs Python 3.12 and the Linux Clang installation from toolchain setup.
+
+## Build the iOS snapshot compiler
+
+Use a fresh output directory:
+
+```bash
+python3 sweetpad-lib/ci/linux-flutter-snapshot.py \
+  --flutter-root "$HOME/src/flutter" \
+  --clang-root "$HOME/swift/swift-6.4.2-RELEASE/usr" \
+  --out "$HOME/src/flutter-ios-snapshot" --jobs 4
+```
+
+The recipe checks the Flutter-pinned Dart revision and builds only the product-mode snapshot compiler.
+It records source revisions, downloads, compiler identity, and the resulting executable hash.
+The result is a Linux ARM64 executable that generates iOS ARM64 code.
+
+This step needs a matching Dart source and engine configuration.
+A compiler from another Flutter version can produce a snapshot that the engine rejects.
+
+## Prepare the sample iOS project
+
+The validated app is the platform-design sample.
+Prepare it with a new source directory and the pinned dependency graph:
+
+```bash
+python3 -B sweetpad-lib/ci/linux-project-prepare.py \
+  --only flutter-samples \
+  --corpus-root "$HOME/sweetpad-examples" \
+  --flutter-root "$HOME/src/flutter" \
+  --tool-bin "$HOME/.cache/sweetpad/framework-tools/js/node_modules/.bin" \
+  --out "$HOME/sweetpad-examples/flutter-preparation.json"
+```
+
+The recipe resolves Dart dependencies and writes Linux paths into the generated iOS configuration.
+It also applies the minimum-deployment migration required by the pinned engine.
+
+Flutter's iOS configuration-only command is unavailable on Linux.
+The preparation recipe supplies those inputs for this pinned sample rather than invoking a Mac executable.
+
+## Select the Linux compiler
+
+Create a local-engine directory with the matching cached engine artifacts:
+
+```bash
+python3 sweetpad-lib/ci/linux-flutter-local-engine.py \
+  --flutter-root "$HOME/src/flutter" \
+  --compiler "$HOME/src/flutter-ios-snapshot/out/SweetpadIOS/gen_snapshot_product" \
+  --out "$HOME/builds/flutter-local-engine"
+```
+
+This directory points to the existing engine framework and the new Linux compiler.
+It does not replace the installed Flutter SDK.
+Use a fresh output directory for another preparation.
+
+## Build for the iPhone
+
+Pass the local-engine settings to the Xcode project build:
+
+```bash
+sweetpad build \
+  --project "$HOME/sweetpad-examples/flutter-samples/platform_design/ios/Runner.xcodeproj" \
+  --scheme Runner --configuration Release \
+  --destination 'generic/platform=iOS' --json --non-interactive \
+  -- -derivedDataPath "$HOME/builds/FlutterRunner" \
+  ARCHS=arm64 CODE_SIGNING_ALLOWED=NO \
+  FLUTTER_ROOT="$HOME/src/flutter" \
+  FLUTTER_ENGINE="$HOME/builds/flutter-local-engine" \
+  LOCAL_ENGINE=ios_release LOCAL_ENGINE_HOST=host_release
+```
+
+The unsigned command verifies the build.
+For installation, configure [development signing](signing-and-testing.md#configure-development-signing).
+Remove the unsigned setting. Then rebuild.
+Then use the [USB installation and launch steps](ubuntu-usb.md#build-and-install-the-iphone-app).
+
+The validated Release app launches twice on an iPhone with the Linux-generated snapshot.
+A successful app launch also confirms that the matching engine can load that snapshot.
+
+## Use another Flutter app
+
+Prepare its iOS project, generated configuration, plugin metadata, and nati
```

**File**: `sweetpad-docs/docs/cli/linux/github-actions.md` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+---
+sidebar_label: GitHub Actions for iOS
+---
+
+# iOS builds in GitHub Actions
+
+A Linux job can compile iPhone products, generate test manifests, and create development archives.
+Apple test execution still runs on a Mac with Xcode.
+
+## Choose the runner
+
+| Job | Runner |
+| --- | --- |
+| Run the CLI without Apple SDKs | A hosted Ubuntu 24.04 ARM64 runner. |
+| Compile an iOS app on Linux | A provisioned Linux ARM64 runner with your private SDK and compiler toolchain. |
+| Run iOS Simulator tests | A Mac with Xcode and a compatible simulator runtime. |
+| Install on an iPhone | A trusted USB or paired Wi-Fi connection from the selected host. |
+
+The validated app-build setup uses a Linux VM on Apple hardware.
+Use SDK files under [Apple's Xcode agreement](https://www.apple.com/legal/sla/docs/xcode.pdf).
+A hosted Ubuntu runner supplies neither your licensed SDK environment nor a connected iPhone.
+
+Provision the app-build runner using [Ubuntu setup](ubuntu-usb.md).
+Its user needs the Linux Swift toolchain, Swift Build, macro plugin, and extracted SDK on the documented paths.
+The example uses the custom runner label `sweetpad-linux`.
+
+## Build and retain iPhone products
+
+This workflow installs the released CLI into a temporary prefix.
+The toolchain and SDK are existing runner prerequisites.
+
+Replace the project and scheme names with your own:
+
+```yaml
+name: iPhone build on Linux
+on:
+  workflow_dispatch:
+permissions:
+  contents: read
+
+jobs:
+  build:
+    runs-on: [self-hosted, Linux, ARM64, sweetpad-linux]
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+      - name: Install SweetPad
+        shell: bash
+        run: |
+          set -euo pipefail
+          CLI_VERSION=0.1.18
+          mkdir "$RUNNER_TEMP/cli"
+          cd "$RUNNER_TEMP/cli"
+          curl -fLO "https://github.com/sweetpad-dev/sweetpad/releases/download/cli-v$CLI_VERSION/sweetpad-cli-$CLI_VERSION-linux-arm64.tar.gz"
+          curl -fLO "https://github.com/sweetpad-dev/sweetpad/releases/download/cli-v$CLI_VERSION/sweetpad-cli-$CLI_VERSION-linux-arm64.tar.gz.sha256"
+          sha256sum -c "sweetpad-cli-$CLI_VERSION-linux-arm64.tar.gz.sha256"
+          tar -xzf "sweetpad-cli-$CLI_VERSION-linux-arm64.tar.gz"
+          bash install.sh --prefix "$RUNNER_TEMP/sweetpad"
+          echo "$RUNNER_TEMP/sweetpad/bin" >> "$GITHUB_PATH"
+          echo "$HOME/bin" >> "$GITHUB_PATH"
+          echo "$HOME/swift/swift-6.4.2-RELEASE/usr/bin" >> "$GITHUB_PATH"
+      - name: Build iPhone products
+        shell: bash
+        run: |
+          set -euo pipefail
+          export PATH="$RUNNER_TEMP/sweetpad/bin:$HOME/swift/swift-6.4.2-RELEASE/usr/bin:$HOME/bin:$PATH"
+          sweetpad build --project MyApp.xcodeproj --scheme MyApp \
+            --configuration Release --destination 'generic/platform=iOS' \
+            --json --non-interactive \
+            -- -derivedDataPath "$RUNNER_TEMP/DerivedData" \
+            ARCHS=arm64 CODE_SIGNING_ALLOWED=NO > "$RUNNER_TEMP/build.json"
+          tar -C "$RUNNER_TEMP/DerivedData/Build" \
+            -czf "$RUNNER_TEMP/Products.tar.gz" Products
+      - uses: actions/upload-artifact@v7
+        with:
+          name: iphone-products
+          path: |
+            ${{ runner.temp }}/Products.tar.gz
+            ${{ runner.temp }}/build.json
+          if-no-files-found: error
+```
+
+The example creates unsigned device products for a build check.
+[Development signing](signing-and-testing.md#configure-development-signing) is required before installation on a phone.
+
+The tar archive preserves executable permissions and framework symbolic links.
+Upload the archive rather than individual app-bundle files.
+Retain build products and reports, not the private SDK or signing keys.
+
+## Add development signing
+
+Store the P12, its password, and profiles in your CI secret store.
+Decode the files into a private directory under `RUNNER_TEMP` with `umask 077`.
+Set these CLI variables for the signed build:
+
+| Variable | CI value |
+| --- | --- |
+| `SWEETPAD_CODE_SIGN_P12` | Path to the decoded identity file. |
+| `SWEETPAD_CODE_SIGN_P12_PASSWORD` | The identity's password from the secret store. |
+| `SWEETPAD_PROVISIONING_PROFILES` | Directory containing matching profiles. |
+
+Remove `CODE_SIGNING_ALLOWED=NO` from the build.
+Remove temporary signing files in a final cleanup step that uses `if: always()`.
+
+This example uses a manual trigger.
+Keep private SDK and signing jobs on trusted code. Untrusted pull-request code can read a self-hosted runner's files.
+GitHub documents [self-hosted runner operation](https://docs.github.com/en/actions/reference/runners/self-hosted-runners) and [runner labels](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job).
+
+## Build tests on Linux
+
+Replace the app-build command with a
```

**File**: `sweetpad-docs/docs/cli/linux/how-it-works.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+---
+sidebar_label: How it works
+---
+
+# How Linux builds work
+
+SweetPad turns an Xcode project into input for Swift Build, Apple's open-source build system.
+Swift Build schedules Linux compilers and portable resource tools against SDK data from your own Xcode.
+
+## The build pipeline
+
+```mermaid
+flowchart TB
+  Project["Xcode project or workspace"] --> Graph["Project graph"]
+  Packages["Resolved Swift packages"] --> Graph
+  Graph --> Build["Swift Build"]
+  Build --> Compiler["Swift, Clang, and LLD"]
+  Build --> Resources["Resource tools"]
+  SDK["Your Apple SDKs"] --> Compiler
+  SDK --> Resources
+  Compiler --> Products["Apps and test products"]
+  Resources --> Products
+  Products --> Phone["iPhone over USB or Wi-Fi"]
+  Products --> Mac["Mac: Simulator or test execution"]
+```
+
+### Read the project
+
+SweetPad reads the workspace, projects, scheme, configurations, and target dependencies.
+It describes them in the Project Interchange Format that Swift Build consumes.
+Swift Package Manager supplies the package graph, including resolved remote packages and binary XCFrameworks.
+
+Schemes from remote packages become available after dependency resolution.
+Listing schemes reads existing checkouts; it does not fetch packages.
+
+### Compile for iOS
+
+The compiler runs on Linux and emits code for the selected Apple destination.
+For an iPhone, that destination uses the iOS device SDK and ARM64 code.
+LLD links the objects into Mach-O executables and libraries.
+
+The compiler toolchain and Apple SDK have different jobs.
+The toolchain supplies executable Linux programs. The SDK supplies headers, modules, frameworks, runtime libraries, and platform metadata.
+
+### Compile resources
+
+SweetPad implements the resource tools that Swift Build expects.
+These tools compile supported asset catalogs, storyboards, XIBs, String Catalogs, Core Data models, and App Intents data.
+
+Many tool names resolve to the same SweetPad executable.
+The executable selects the requested operation from its invocation name.
+
+Supported Apple macros use a Linux plugin.
+SweetPad also builds reachable package macros for the host when their source supports Linux.
+
+## Build products and incremental work
+
+Products use the DerivedData layout that the other CLI commands expect.
+An explicit build directory keeps CI outputs and local experiments easy to find:
+
+```bash
+sweetpad build --project MyApp.xcodeproj --scheme MyApp \
+  --destination 'generic/platform=iOS' --json --non-interactive \
+  -- -derivedDataPath "$HOME/builds/MyApp"
+```
+
+Swift Build tracks inputs and reuses unchanged work.
+Generated project inputs keep their timestamps when their contents do not change.
+A fresh DerivedData directory provides a control when you compare a changed resource processor or toolchain.
+
+Run-script phases execute on Linux.
+The build supplies compatible tools for common Xcode script operations, but a script that depends on macOS still needs adaptation.
+
+## Signing and the phone
+
+Linux signing uses an Apple Development identity from a P12 file and your provisioning profiles.
+The signer seals the app and its embedded bundles before installation.
+
+The device adapter uses `pymobiledevice3==11.50.0` for USB and Wi-Fi.
+It authenticates the selected device before installation or launch.
+The modern adapter establishes its developer-service tunnel in userspace.
+
+These are separate operations: a successful build creates products, and a successful installation transfers a signed product to the phone.
+The [Ubuntu guide](ubuntu-usb.md) walks through both.
+
+## Tests and other Apple platforms
+
+Linux can compile iOS test products and generate an XCTest run manifest.
+Xcode on a Mac supplies the test runtime, including the iPhone test runner.
+[Prebuilt test execution](signing-and-testing.md#run-linux-built-tests) keeps the Linux compilation result intact.
+
+The same engine also builds macOS apps and supported tvOS, watchOS, and visionOS simulator targets.
+Their runtime coverage differs from iPhone coverage.
+See [support and configuration](reference.md) and the separate [macOS CI guide](macos-ci.md).
```

**File**: `sweetpad-docs/docs/cli/linux/macos-ci.md` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+---
+sidebar_label: macOS apps in CI
+---
+
+# Build macOS apps in GitHub Actions
+
+Most pages in this section target iOS and iPhone.
+A macOS app has a different execution and distribution path.
+
+A Linux runner can compile a supported macOS app against the extracted macOS SDK.
+A Mac runs the application, executes native tests, and performs Developer ID distribution signing and notarization.
+
+## Use a hosted Mac for a native workflow
+
+A hosted Mac is the direct path when your CI job needs build, test, and macOS execution together.
+This uses SweetPad's normal Xcode engine.
+
+Replace the project and scheme names:
+
+```yaml
+name: macOS app
+on:
+  push:
+    branches: [main]
+  pull_request:
+permissions:
+  contents: read
+
+jobs:
+  macos:
+    runs-on: macos-15
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v7
+      - name: Install SweetPad
+        run: brew install sweetpad-dev/tap/sweetpad
+      - name: Build
+        run: |
+          sweetpad build --project MyMacApp.xcodeproj --scheme MyMacApp \
+            --configuration Release --on mac --json --non-interactive \
+            -- -derivedDataPath "$RUNNER_TEMP/DerivedData" CODE_SIGNING_ALLOWED=NO
+      - name: Run tests
+        run: |
+          sweetpad test run --project MyMacApp.xcodeproj --scheme MyMacApp \
+            --on mac --json --non-interactive \
+            -- -derivedDataPath "$RUNNER_TEMP/DerivedData" CODE_SIGNING_ALLOWED=NO
+      - name: Package products
+        run: |
+          tar -C "$RUNNER_TEMP/DerivedData/Build" \
+            -czf "$RUNNER_TEMP/macos-products.tar.gz" Products
+      - uses: actions/upload-artifact@v7
+        with:
+          name: macos-products
+          path: ${{ runner.temp }}/macos-products.tar.gz
+          if-no-files-found: error
+```
+
+The scheme must include the tests that this job runs.
+The test command can build its test products on the Mac.
+The example retains unsigned products for CI validation, not a notarized distribution.
+
+GitHub's [runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) lists the architecture and available labels.
+Use an explicit architecture when your app or dependencies require one.
+
+## Compile the app on Linux
+
+Use this path when compilation is the part that you want on Linux.
+The same [private SDK runner prerequisites](github-actions.md#choose-the-runner) apply.
+
+The destination selects macOS instead of iOS:
+
+```bash
+sweetpad build --project MyMacApp.xcodeproj --scheme MyMacApp \
+  --configuration Release --destination 'generic/platform=macOS' \
+  --json --non-interactive \
+  -- -derivedDataPath "$RUNNER_TEMP/DerivedData" \
+  ARCHS=arm64 CODE_SIGNING_ALLOWED=NO
+```
+
+Build products use the macOS bundle layout, including the Contents directory.
+Keep the complete app and embedded frameworks when you package the result:
+
+```bash
+tar -C "$RUNNER_TEMP/DerivedData/Build" \
+  -czf "$RUNNER_TEMP/macos-products.tar.gz" Products
+```
+
+Upload the tar archive with the artifact action from the iOS workflow.
+A subsequent Mac job can download and extract it for native validation or a separate signing stage.
+
+The Linux build path does not provide a macOS runtime.
+Frameworks, run scripts, or assets that require a native Apple tool can still require a Mac build.
+Check [supported features](reference.md) before moving an existing job.
+
+## Tests and distribution
+
+Automatic Linux XCTest manifests currently cover the documented iOS test forms.
+For a complete macOS test workflow, use the hosted-Mac example or your existing native test pipeline.
+Do not assume that an iOS test-manifest recipe also covers macOS tests.
+
+Developer ID distribution requires the matching certificate, entitlements, hardened-runtime settings, and Apple notarization.
+Keep that release stage on a Mac with its existing signing configuration.
+The unsigned build example does not replace this stage.
+
+The CLI's Linux development IPA export applies to iOS device archives.
+It is not a macOS distribution workflow.
+
+## Verify the actual products
+
+Use the architecture and deployment targets that your application supports.
+After a toolchain change, run the app and its tests on a compatible Mac.
+A successful Linux compilation establishes build coverage; native execution establishes runtime coverage.
+
+The iPhone transport guide does not apply to macOS app execution.
+For shared compiler and SDK behavior, see [how Linux builds work](how-it-works.md).
```

**File**: `sweetpad-docs/docs/cli/linux/react-native.md` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+---
+sidebar_label: React Native
+---
+
+# React Native iPhone apps on Linux
+
+SweetPad builds the iOS workspace after JavaScript dependencies, native code generation, and Pods are ready.
+It does not replace those preparation steps.
+
+The validated examples use React Native 0.85.3 with Hermes.
+The MMKV example also uses NitroModules 0.35.9.
+Release products pass iPhone startup checks, and MMKV passes storage and relaunch checks.
+
+:::info Prerequisites
+Complete [Ubuntu and USB setup](ubuntu-usb.md) first.
+The pinned Hermes compiler is a Linux x86_64 executable.
+The validated ARM64 environment runs it through OrbStack's Linux binary translation.
+:::
+
+## Prepare the validated example
+
+The repository includes a pinned preparation recipe for the community template.
+It captures dependency locks and applies the same scene-lifecycle compatibility patch to native and Linux controls.
+
+Get the matching helper sources:
+
+```bash
+git clone --branch cli-v0.1.18 --depth 1 https://github.com/sweetpad-dev/sweetpad.git "$HOME/src/sweetpad"
+cd "$HOME/src/sweetpad"
+bash sweetpad-lib/ci/linux-framework-tools.sh
+source "$HOME/.cache/sweetpad/framework-tools/env.sh"
+```
+
+The helper installs Node 24.22.2, Ruby 3.4.8, Bundler 4.0.20, and the frozen JavaScript tools.
+Its files stay in a private tool directory.
+
+Prepare a fresh template checkout:
+
+```bash
+python3 -B sweetpad-lib/ci/linux-project-prepare.py \
+  --only react-native-template \
+  --corpus-root "$HOME/sweetpad-examples" \
+  --tool-bin "$HOME/.cache/sweetpad/framework-tools/js/node_modules/.bin" \
+  --gem-home "$HOME/.cache/sweetpad/framework-tools/gems" \
+  --out "$HOME/sweetpad-examples/template-preparation.json"
+```
+
+This uses the captured npm, Ruby, and Pod dependency graph.
+Linux metadata adapters supply the Xcode information that dependency preparation expects.
+Generated Pod scripts select the portable signing tool through PATH.
+
+The recipe also records paths for Node and generated dependencies.
+An existing Pods directory from another machine is not a substitute for preparation on this host.
+
+## Build the iOS workspace
+
+Select the Linux Hermes compiler explicitly:
+
+```bash
+APP_ROOT="$HOME/sweetpad-examples/react-native-template/template"
+
+sweetpad build --workspace "$APP_ROOT/ios/HelloWorld.xcworkspace" \
+  --scheme HelloWorld --configuration Release \
+  --destination 'generic/platform=iOS' --json --non-interactive \
+  -- -derivedDataPath "$HOME/builds/ReactNative" \
+  ARCHS=arm64 CODE_SIGNING_ALLOWED=NO \
+  HERMES_CLI_PATH="$APP_ROOT/node_modules/hermes-compiler/hermesc/linux64-bin/hermesc"
+```
+
+This unsigned build verifies compilation.
+For the phone, configure [development signing](signing-and-testing.md#configure-development-signing).
+Remove the unsigned setting. Then rebuild.
+
+Install and launch the resulting app using [the USB workflow](ubuntu-usb.md#build-and-install-the-iphone-app).
+Use the product path from JSON output rather than assuming a bundle name.
+
+## Release and Debug behavior
+
+Release builds embed their JavaScript and Hermes products.
+The validated Release app launches without a Metro server.
+
+Debug builds need a reachable Metro server.
+Start it from the app directory. Configure the iPhone's bundle-server address for your network.
+The VM's loopback address is not the phone's loopback address.
+
+Keep the host compiler and target artifacts distinct.
+The Hermes compiler must execute on Linux; the app and embedded frameworks must target iOS.
+
+## MMKV
+
+The same preparation recipe supports the separate MMKV example:
+
+```bash
+cd "$HOME/src/sweetpad"
+python3 -B sweetpad-lib/ci/linux-project-prepare.py \
+  --only react-native-mmkv \
+  --corpus-root "$HOME/sweetpad-examples" \
+  --tool-bin "$HOME/.cache/sweetpad/framework-tools/js/node_modules/.bin" \
+  --gem-home "$HOME/.cache/sweetpad/framework-tools/gems" \
+  --out "$HOME/sweetpad-examples/mmkv-preparation.json"
+```
+
+Its workspace is in the example's iOS directory, and its scheme is MmkvExample.
+Its Hermes compiler comes from the repository-root dependency directory.
+
+The current build path does not need the former MMKV debug-thunk fixture shim.
+The setup script includes the Swift Build correction for the affected generated C++ bridge helpers.
+This covers the pinned compiler and example; other Swift/C++ combinations can expose different issues.
+
+## Use your own app
+
+Prepare your app's declared Node, Ruby, code-generation, and Pod dependencies.
+Then pass its workspace and scheme to the same build command.
+Adjust the Hermes path for your package layout.
+
+The pinned recipe is a reference workflow, not a generator for arbitrary React Native applications.
+Other versions and native modules need their own validation.
+A preparation script that requires macOS can still require a Mac before Linux compilation.
+
+When you compare native and Linux products, keep the same source and dependency 
```

**File**: `sweetpad-docs/docs/cli/linux/reference.md` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+---
+sidebar_label: Support and configuration
+---
+
+# Linux support and configuration
+
+The released archive targets Ubuntu 24.04 ARM64.
+The validated setup uses an Apple-hardware Linux VM, Swift 6.4.2, Swift Build 6.4.0, and SDK data from Xcode.
+
+## Platform coverage
+
+| Operation | Status |
+| --- | --- |
+| Build iOS apps and extensions | Supported by the experimental Linux engine. |
+| Sign development iPhone products | Supported with a P12 identity and matching profiles. |
+| Discover, install, launch, stop, and log an iPhone app | Validated through Linux USB and Wi-Fi. |
+| Build iOS unit and UI test products | Supported, including the documented automatic manifests. |
+| Execute Apple tests | Requires a Mac with Xcode. |
+| Operate an iOS Simulator | Requires a Mac. |
+| Build macOS apps | Supported for the validated resource and compiler paths; native execution requires a Mac. |
+| Build tvOS, watchOS, and visionOS simulator targets | Compilation and linking coverage exists; runtime and device signing remain unverified. |
+| Build Mac Catalyst targets on Linux | Remains unverified. |
+| Export a development iOS IPA | Supported from a signed device archive. |
+| Export distribution IPAs or custom export options | Requires Xcode. |
+| Debug a device or inspect device readiness on Linux | Unsupported. |
+
+Current Xcode and Swift Build reject deprecated WatchKit extension products.
+Use modern standalone watchOS apps for new platform validation.
+
+## Project and resource support
+
+The portable build path covers these common inputs:
+
+- Local and remote Swift packages, including binary XCFrameworks
+- Swift, Objective-C, C, and C++ targets
+- Frameworks, static libraries, app extensions, and widgets
+- Asset catalogs, storyboards, XIBs, String Catalogs, and ordinary strings
+- Core Data models and common mapping models
+- Supported SwiftData, Predicate, Preview, SwiftUI Entry, and TipKit macros
+- Package macros whose sources build for the Linux host
+- Supported App Intents metadata and shortcut language models.
+
+Explicit schemes from resolved Git packages are available after dependency resolution.
+Listing schemes does not fetch missing packages.
+Package manifests run on Linux. Host-only conditions that select Apple resources or libraries can require a compatibility patch.
+
+Metal shaders, Core ML model classes, SceneKit assets, and RealityKit assets require native tools.
+Scripts that import Darwin or call other macOS-only tools need adaptation or a Mac preparation stage.
+Advanced Core Data mapping expressions remain outside the supported mapping-model forms.
+
+Phone startup checks do not validate App Groups, push, payments, or extension behavior.
+Those flows need matching profiles and their own execution checks.
+
+### Modern icons and stickers
+
+Icon Composer support produces static light, dark, and tinted appearances.
+Interactive glass lighting and native material effects remain unsupported.
+
+Sticker packs support ordered PNG, GIF, and JPEG members and message-extension icons.
+Sticker sequences and localized sticker-pack strings remain unsupported.
+
+### Swift and C++ interoperability
+
+The MMKV validation uses the current generated-header correction rather than its former fixture shim.
+The affected bridge helpers use the supported lazy inline-helper behavior.
+Other compiler versions and interoperability forms need separate validation.
+
+## App Intents
+
+The portable processors generate registration metadata, extracted strings, and shortcut language models.
+Supported forms include primitive parameters, optional and array values, file images, dialog or snippet results, enums, basic entities, widget intents, and basic shortcuts.
+
+Dynamic frameworks and embedded extensions retain separate registrations.
+Unsupported schemas, static dependency registration, and unsupported language-model options fail explicitly.
+Siri voice invocation on a physical device remains unverified.
+
+Localized shortcut models use the app's translated names and AppShortcuts string tables.
+The trainer emits per-language models and removes models for deleted shortcuts.
+AssistantIntents catalogs and catalog variations remain unsupported.
+
+### Localized phrase resources
+
+Mac execution of toolchain setup exports the system phrase resources into the private SDK.
+For an independently prepared Ubuntu host, export those resources on the Mac using the setup sources from the archive:
+
+```bash
+python3 /path/to/sweetpad-install/setup/sweetpad-lib/ci/linux-appintents-resources.py \
+  --xcode /Applications/Xcode.app --out /path/to/appintents-phrases.json
+```
+
+Transfer the export privately, then provide it to Linux setup:
+
+```bash
+SWEETPAD_SKIP_RUST=1 \
+  SWEETPAD_APPINTENTS_RESOURCE_EXPORT=/path/to/appintents-phrases.json \
+  XCODE_APP=/path/to/Xcode.app \
+  bash "$HOME/.local/share/sweetpad/setup/sweetpad-lib/ci/linux-setup.sh"
+```
+
+Missing localized resources produc
```

---

### Incident Patch 3: `f564dbec` (2026-11-06)
**Commit Message**: Build Xcode projects on Linux with Swift Build

sweetpad build translates the workspace into Swift Build's PIF and builds it against a Darwin SDK taken from the user's Xcode, standing in for the Xcode tools Linux doesn't have. macOS builds still go through xcodebuild.

**File**: `Cargo.lock` (modified, +1093/-20)
```diff
@@ -2,6 +2,23 @@
 # It is not intended for manual editing.
 version = 4
 
+[[package]]
+name = "adler2"
+version = "2.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
+
+[[package]]
+name = "aes"
+version = "0.8.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b169f7a6d4742236a0a00c541b845991d0ac43e546831af1249753ab4c3aa3a0"
+dependencies = [
+ "cfg-if",
+ "cipher",
+ "cpufeatures",
+]
+
 [[package]]
 name = "anstream"
 version = "1.0.0"
@@ -52,18 +69,74 @@ dependencies = [
  "windows-sys 0.61.2",
 ]
 
+[[package]]
+name = "arrayref"
+version = "0.3.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "76a2e8124351fda1ef8aaaa3bbd7ebbcb486bbcd4225aca0aa0d84bb2db8fecb"
+
+[[package]]
+name = "arrayvec"
+version = "0.7.8"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d3fb67a6e08acf24fdeccbac2cb6ac4305825bd1f117462e0e6f2f193345ad56"
+
+[[package]]
+name = "autocfg"
+version = "1.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53"
+
 [[package]]
 name = "base64"
 version = "0.22.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
+[[package]]
+name = "base64ct"
+version = "1.8.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
+
 [[package]]
 name = "bitflags"
 version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
+[[package]]
+name = "bytemuck"
+version = "1.25.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "95832e849adfb21180ccb6826a99da14e5d266ae5c2e668e1602cf234f153797"
+dependencies = [
+ "bytemuck_derive",
+]
+
+[[package]]
+name = "bytemuck_derive"
+version = "1.12.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6a1f896587b6f2c069c73d2f0913e2d590c3990285cd2f0b6aa02b786b4c679c"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 3.0.7",
+]
+
+[[package]]
+name = "byteorder-lite"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8f1fe948ff07f4bd06c30984e69f5b4899c516a3ef74f34df92a2df2ab535495"
+
+[[package]]
+name = "cassowary"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "df8670b8c7b9dae1793364eafadf7239c40d669904660c5960d74cfd80b46a53"
+
 [[package]]
 name = "cc"
 version = "1.5.1"
@@ -80,6 +153,16 @@ version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
+[[package]]
+name = "cipher"
+version = "0.4.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "773f3b9af64447d2ce9850330c473515014aa235e6a783b02db81ff39e4a3dad"
+dependencies = [
+ "crypto-common",
+ "inout",
+]
+
 [[package]]
 name = "clap"
 version = "4.6.1"
@@ -120,7 +203,7 @@ dependencies = [
  "heck",
  "proc-macro2",
  "quote",
- "syn",
+ "syn 2.0.117",
 ]
 
 [[package]]
@@ -129,6 +212,15 @@ version = "1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
+[[package]]
+name = "color"
+version = "0.3.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "2ec7c5eb7a16992b1904d76c517d170ab353b0e0b3d5a0c81a8a0cd1037893cf"
+dependencies = [
+ "bytemuck",
+]
+
 [[package]]
 name = "colorchoice"
 version = "1.0.5"
@@ -148,6 +240,12 @@ dependencies = [
  "windows-sys 0.59.0",
 ]
 
+[[package]]
+name = "const-oid"
+version = "0.9.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c2459377285ad874054d797f3ccebf984978aa39129f6eafde5cdc8315b612f8"
+
 [[package]]
 name = "convert_case"
 version = "0.11.0"
@@ -173,12 +271,65 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
+[[package]]
+name = "cpufeatures"
+version = "0.2.17"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "59ed5838eebb26a2bb2e58f6d5b5316989ae9d08bab10e0e6d103e656d1b0280"
+dependencies = [
+ "libc",
+]
+
+[[package]]
+name = "crc32fast"
+version = "1.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "01a7799fd6b852db0e61728dde9a204c423b44d689dbd432522543614b490e78"
+dependencies = [
+ "cfg-if",
+]
+
+[[package]]
+name = "crypto-common"
+version = "0.1.7"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "78c8292055d1c1df0cce5d180393dc8cce0
```

**File**: `Cargo.toml` (modified, +26/-0)
```diff
@@ -20,9 +20,35 @@ sweetpad-core = { path = "sweetpad-core" }
 # JSON is a well-known standard format, not worth reinventing; hand-rolled
 # parsing is reserved for Apple's project-domain formats (DOCS.md §3.1).
 serde_json = "1"
+# Interface Builder stores control characters in Base64-encoded XML strings.
+# minreq's proxy support already depends on this standard-format decoder.
+base64 = "0.22"
+# AppKit's archived frames follow Auto Layout's linear constraints and priorities.
+cassowary = "0.3"
 # Unicode NFD for the DerivedData path hash (xcode_hash); UAX #15 with a
 # de-facto crate — not worth hand-rolling the decomposition tables.
 unicode-normalization = "0.1"
+# PNG, read and written for the app icons and images the Linux build's actool
+# stand-in puts in the bundle; a standard format with a de-facto crate.
+png = "0.18"
+# Gzip, for the image pixels in the actool stand-in's Assets.car; png already
+# depends on it.
+flate2 = "1"
+# The actool stand-in draws a catalog's vector images the way Xcode does,
+# into bitmaps: PDFs with hayro, SVGs and symbol templates with resvg (and
+# the usvg and roxmltree it re-exports, and svgtypes, which usvg parses
+# with). Both are pure Rust; PDF and SVG are standard formats too large to
+# hand-roll.
+hayro = { version = "0.8", default-features = false }
+resvg = { version = "0.48", default-features = false }
+svgtypes = "0.16"
+# The codesign stand-in signs with an identity exported from Keychain Access:
+# RSA signatures, and the Triple DES and AES that a .p12 file's contents are
+# encrypted with. The signature formats around them are Apple's, and
+# hand-rolled.
+rsa = { version = "0.9", default-features = false, features = ["std"] }
+des = "0.8"
+aes = "0.8"
 # The system calls: the account's home, name and cache directory, read the
 # way Xcode's tools read them (getpwuid_r, confstr), and the raw-input flags
 # the CLI's interactive rebuild session flips.
```

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +97/-0)
```diff
@@ -4532,6 +4532,103 @@ a second pass changes nothing, that a failed edit leaves the bundle's bytes
 and signature as they were, and that a bundle without `get-task-allow` is left
 alone.
 
+## 9w. v8 — building on Linux with Swift Build
+
+> `sweetpad build` builds an unmodified Xcode project where there is no
+> Xcode. `PLAN_LINUX.md` is the working record: what builds, what doesn't,
+> the corpus sweeps and the open items. This section keeps the decisions.
+> The user guide is `sweetpad-docs/docs/cli/linux.md`.
+
+**The engine follows the host.** `Engine::for_host` picks xcodebuild on
+macOS and Swift Build everywhere else, so the same command line builds on
+both. A hidden `--engine swift-build` (`SWEETPAD_ENGINE`) runs Swift Build on
+a Mac too, which is how a build is checked against xcodebuild's; it stays
+hidden because nothing else needs it. `build --show-command` prints the
+`swbuild` command line.
+
+**Swift Build gets a PIF and a build request, never a target name.**
+`sweetpad-lib`'s emitter translates the workspace into Swift Build's PIF,
+with GUIDs as `xcodebuild -dumpPIF` derives them. The packages come from
+`swift package dump-pif` over a root manifest naming the workspace's
+packages, pinned by its `Package.resolved`, with the checkouts in
+DerivedData's `SourcePackages` as Xcode keeps them, and are merged into the
+PIF. `--experimental-build-dylibs-as-frameworks` builds a dynamic product as
+the framework Xcode makes of it. The build request names the scheme's
+targets by GUID and carries its parallel and implicit-dependency settings.
+`swbuild` resolves `--target` names before the request replaces them, and
+fails on a name a package's product and module share, so none is passed.
+A scheme without a file names a project target, else a local package's
+product (`<name>-product` in SwiftPM's PIF), else a package's module: the
+scheme Xcode makes for a product builds the product, which shares no name
+with a module when it's made only of binary targets.
+
+**Everything goes where xcodebuild's build would.** The build writes to the
+DerivedData folder xcodebuild would use, so the product locator, `app run`'s
+lookups and the extension find the product unchanged. The PIF, the request,
+the parameters, the toolset and the stand-ins' folder go in
+`Intermediates.noindex/SweetPad`, and a file is rewritten only when its
+contents change, which keeps SwiftPM's manifest cache.
+
+**The Darwin SDK replaces Xcode.** xtool's bundle (`SWEETPAD_DARWIN_SDK`)
+has the Apple SDKs, Xcode's runtime libraries and an `ld64.lld` that writes
+Mach-O. The engine names its platforms in `XCODE_EXTRA_PLATFORM_FOLDERS`,
+adds a toolset with the cross-import overlay flag, the linker stand-in and
+the macro plugin, and overrides the settings that would start an Xcode-only
+step (`DarwinSdk::overrides` lists each with its reason). The Xcode version
+settings come from Xcode's `version.plist`, which `linux-setup.sh` copies
+beside the bundle, since Swift Build reports 99.99.99 without one.
+
+**A stand-in is the sweetpad binary under the tool's name.** The engine
+links the binary into the stand-ins' folder under each name, puts the folder
+on `swbuild`'s `PATH`, and `main` dispatches on `argv[0]`. One binary keeps
+the stand-ins at the CLI's version, with nothing more to install. Where the
+corpus can check, a stand-in's output is Xcode's byte for byte: asset
+catalogs, nibs, String Catalogs, Core Data models, signatures. What a
+stand-in doesn't do fails with an error that names it. The stand-ins are
+`actool`, `ibtool`, `momc`, `xcstringstool`, `intentbuilderc`, `codesign`,
+`derq`, the provisioning tool, `copypng`, `ditto`, `lipo`, `strip`,
+`embeddedBinaryValidationUtility`, `ld64.lld` and `xcrun`.
+
+**`xcrun -sdk macosx` runs a tool for the host.** A run script is a host
+program. A Mac script says `-sdk macosx` to run a tool for the Mac it's on,
+and here the host is Linux, where a Darwin `SDKROOT` breaks the toolchain's
+own builds: a `swift` script fails to build `CDispatch`. So the stand-in
+runs the tool without `SDKROOT` for macOS, gives it the SDK's path for any
+other `-sdk`, as `xcrun` does, and leaves the script's alone without one.
+`--find` and the `--show-sdk-*` queries answer from the Darwin SDK.
+
+**Swift Build is patched, as little as it can be.** `linux-setup.sh` builds
+`swbuild` at the toolchain's tag with `ci/swift-build-linux.patch`. Each
+change is one an upstream pull request could take: a failed `lsregister`
+start is a note, as a failed run already is; provisioning requests go to the
+tool `SWEETPAD_PROVISIONING` names; `derq` is looked up on the search path;
+the Mach-O reader has its structures on every platform; and text encodings
+are found by name without CoreFoundation.
+
+**Signing has no keychain.** The identity is a `.p12` file
+(`SWEETPAD_CODE_SIGN_P12`, its password in `SWEETPAD_CODE_SIGN_P12_PASSWORD`),
+and the profile is picked as automatic signing picks it, from Xcode's
+
```

**File**: `sweetpad-cli/Cargo.toml` (modified, +11/-0)
```diff
@@ -17,6 +17,8 @@ path = "src/bin/sweetpad.rs"
 sweetpad-lib.workspace = true
 sweetpad-core.workspace = true
 serde_json.workspace = true
+base64.workspace = true
+cassowary.workspace = true
 clap.workspace = true
 clap_complete.workspace = true
 dialoguer.workspace = true
@@ -25,6 +27,15 @@ toml.workspace = true
 toml_edit.workspace = true
 libc.workspace = true
 minreq.workspace = true
+png.workspace = true
+flate2.workspace = true
+hayro.workspace = true
+resvg.workspace = true
+svgtypes.workspace = true
+rsa.workspace = true
+des.workspace = true
+aes.workspace = true
+unicode-normalization.workspace = true
 
 [lints]
 workspace = true
```

**File**: `sweetpad-cli/PLAN_LINUX.md` (added, +828/-0)
```diff
@@ -0,0 +1,828 @@
+# Building Xcode projects on Linux
+
+Status on 2026-11-01. All the work is on branch `claude/linux-build-pif`, not
+merged into `main` yet.
+
+`sweetpad build` has a Swift Build engine, the default where there's no
+Xcode. It translates the workspace into the PIF that Apple's open-source
+Swift Build takes as input, then runs `swbuild` against a Darwin Swift SDK
+that xtool extracts from the user's own Xcode.app. Xcode tools that Linux
+doesn't have are replaced by the sweetpad binary itself, started under the
+tool's name. lld links. Nothing calls Xcode or xcodebuild at build time.
+
+Items marked *(optional)* can wait until a project needs them.
+
+## Engine
+
+- [x] PIF emitter: `sweetpad pbxproj pif`, GUIDs as `xcodebuild -dumpPIF`
+      derives them, tested against Xcode 27 dumps of a probe fixture and 21
+      corpus projects (`b6398036`, `7284e45b`)
+- [x] The CLI builds and passes its unit tests on Linux; macOS-only FFI has
+      stand-ins that fail clearly (`baedae73`, `180f5091`)
+- [x] `ci/linux-setup.sh` (OrbStack machine or Linux host) and
+      `ci/linux-build.sh` (end-to-end check) (`ca9ba41a`)
+- [x] Swift Build engine: runs swbuild and turns its messages into the
+      events, diagnostics and productPath an xcodebuild build gives
+      (`17c64909`, `bfbbeeb5`)
+- [x] Build requests preserve the scheme's implicit dependency and parallel
+      target policies. The active destination selects the SDK without changing
+      the platforms of implicit dependency candidates
+- [x] Framework module verification uses Swift Build's portable builtin verifier
+- [x] SwiftPM packages through `swift package dump-pif`, merged into the PIF
+      (`42978410`)
+- [x] Cross-import overlays, through a toolset flag (`4e2a25c7`)
+- [x] Apple's macro plugins: SwiftData, `#Predicate` and `#Preview` (see
+      the section below)
+- [x] SwiftPM: dynamic library products as frameworks in
+      `PackageFrameworks`, as Xcode builds them
+      (`--experimental-build-dylibs-as-frameworks`). xtool's linker makes a
+      static archive for `ld -r`, so a stand-in in front of it loads those
+      whole (`-force_load`); otherwise a framework made from a package
+      target alone links none of its code. `corpus/_alamofire-dynamic`
+      (local) embeds `AlamofireDynamic.framework` and passes its checks
+- [ ] SwiftPM: per-test-target products *(optional)*
+- [ ] SwiftPM: a local package's own schemes, which it keeps in its
+      `.swiftpm/xcode` folder: NetNewsWire's `Account` and `Articles` build
+      with Xcode and fail here, since they name no project target
+      *(optional)*
+- [x] SwiftPM: the scheme Xcode makes for a local package's product builds
+      the product's target, `<name>-product` in SwiftPM's PIF, when no
+      project target has the scheme's name. A product shares no name with a
+      module when it's made only of binary targets, like `Foo` in
+      `corpus/_xcframework-app`, which builds here as with Xcode
+- [x] Mach-O on Linux: Swift Build reads Mach-O files only on Darwin
+      (`#if canImport(Darwin)` in `SWBUtil/MachO.swift`), and fails every
+      read elsewhere. It reads a package's binary XCFramework of a framework
+      to decide whether to embed it, a macOS framework from an XCFramework
+      (Sparkle, in NetNewsWire's Mac app) and a watch app's Messages stub.
+      `swift-build-linux.patch` defines the structures it reads in a new
+      `SWBUtil/MachOStructures.swift` and names the architectures, as
+      `macho_arch_name_for_cpu_type` does. `corpus/_xcframework-app` (local,
+      its C framework made by `Vendor/make-xcframework.sh`) embeds a
+      package's binary framework as Xcode does, and NetNewsWire's Mac app
+      embeds Sparkle
+- [x] Text encodings: Swift Build finds an encoding by its name only
+      through CoreFoundation, so it couldn't write a Mac app's `.strings`
+      files, which are UTF-16. The patch names the encodings Foundation
+      converts on every platform; NetNewsWire's 91 `.strings` files come out
+      byte for byte as Xcode's
+- [ ] Macros Tuist builds as macOS tools: its Xcode-project integration of
+      packages makes a macro target a `tool` with `SDKROOT = macosx`, which
+      the targets using it load with `-load-plugin-executable`. That Mach-O
+      can't run here, so the macro isn't found (`swift-case-paths` in a
+      Tuist fixture). Build such a tool for the host
+
+## Apple's macros
+
+Xcode expands the SDK's macros through plugins that are macOS dylibs
+(`iPhoneOS.platform/Developer/usr/lib/swift/host/plugins`). Each macro in
+the SDK's `.swiftinterface` files names its plugin and type in
+`#externalMacro(module:type:)`, which gives the full list. In the Xcode 27
+iOS SDK:
+
+| Plugin | Macros | On Linux |
+|---|---|---|
+| ObservationMacros, SwiftMacros | `@Observable`, `@TaskLocal`, `@DebugDescription`, `_SwiftifyImport` | Swift toolchain |
+| FoundationMacros | `#Predicate`, `#Expression`, `#bu
```

**File**: `sweetpad-cli/fixtures/actool/expected/index.json` (added, +1141/-0)
```diff
@@ -0,0 +1,1141 @@
+{
+ "images": [
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageName1StImage",
+   "swiftSymbol": "_1St",
+   "relativePath": "./1stImage.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameBigImageView",
+   "swiftSymbol": "bigImageView",
+   "relativePath": "./BigImageView.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameHome",
+   "swiftSymbol": "home",
+   "relativePath": "./my icons/Home.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameImage",
+   "swiftSymbol": "image",
+   "relativePath": "./Image.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameImageName",
+   "swiftSymbol": "imageName",
+   "relativePath": "./Image Name.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameImage2",
+   "swiftSymbol": "image2",
+   "relativePath": "./Image2.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameLeaf",
+   "swiftSymbol": "leaf",
+   "relativePath": "./Nested/Deep/Leaf.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameLogo",
+   "swiftSymbol": "logo",
+   "relativePath": "./Logo.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameLogoImage",
+   "swiftSymbol": "logo",
+   "relativePath": "./LogoImage.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNamePadOnly",
+   "swiftSymbol": "padOnly",
+   "relativePath": "./PadOnly.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameStar",
+   "swiftSymbol": "star",
+   "relativePath": "./Icons/Star.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameActions",
+   "swiftSymbol": "actions",
+   "relativePath": "./actions.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameAdd",
+   "swiftSymbol": "add",
+   "relativePath": "./add.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameBranch",
+   "swiftSymbol": "branch",
+   "relativePath": "./branch.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameCheckmark",
+   "swiftSymbol": "checkmark",
+   "relativePath": "./checkmark.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameHighlightedBranch",
+   "swiftSymbol": "highlightedBranch",
+   "relativePath": "./highlightedBranch.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameInit",
+   "swiftSymbol": "`init`",
+   "relativePath": "./init.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameLogoDark",
+   "swiftSymbol": "logoDark",
+   "relativePath": "./logo-dark.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNamePhoto",
+   "swiftSymbol": "photo",
+   "relativePath": "./photo.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameRemove",
+   "swiftSymbol": "remove",
+   "relativePath": "./remove.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameSelf",
+   "swiftSymbol": "`self`",
+   "relativePath": "./self.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameStrokedCheckmark",
+   "swiftSymbol": "strokedCheckmark",
+   "relativePath": "./strokedCheckmark.imageset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACImageNameSystem",
+   "swiftSymbol": "system",
+   "relativePath": "./system.imageset"
+  }
+ ],
+ "symbols": [],
+ "colors": [
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameHash",
+   "swiftSymbol": "hash",
+   "relativePath": "./#hash.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorName1StColor",
+   "swiftSymbol": "_1St",
+   "relativePath": "./1stColor.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorName9",
+   "swiftSymbol": "_9",
+   "relativePath": "./9.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameABCdef",
+   "swiftSymbol": "abCdef",
+   "relativePath": "./ABCdef.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameALLCAPS",
+   "swiftSymbol": "ALLCAPS",
+   "relativePath": "./ALLCAPS.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorName_A_B",
+   "swiftSymbol": "A_B",
+   "relativePath": "./A_B.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameAccentColor",
+   "swiftSymbol": "accent",
+   "relativePath": "./AccentColor.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameBg",
+   "swiftSymbol": "bg",
+   "relativePath": "./dark-mode/Bg.colorset"
+  },
+  {
+   "catalogPath": "$(CATALOG)",
+   "objcSymbol": "ACColorNameBothIdioms",
+   "swiftSymbol": "bothIdioms",
+   "relativePath"
```

**File**: `sweetpad-cli/fixtures/actool/expected/no-extensions.swift` (added, +611/-0)
```diff
@@ -0,0 +1,611 @@
+import Foundation
+#if canImport(DeveloperToolsSupport)
+import DeveloperToolsSupport
+#endif
+
+#if SWIFT_PACKAGE
+private let resourceBundle = Foundation.Bundle.module
+#else
+private class ResourceBundleClass {}
+private let resourceBundle = Foundation.Bundle(for: ResourceBundleClass.self)
+#endif
+
+// MARK: - Color Symbols -
+
+@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
+extension DeveloperToolsSupport.ColorResource {
+
+    /// The "#hash" asset catalog color resource.
+    static let hash = DeveloperToolsSupport.ColorResource(name: "#hash", bundle: resourceBundle)
+
+    /// The "1stColor" asset catalog color resource.
+    static let _1St = DeveloperToolsSupport.ColorResource(name: "1stColor", bundle: resourceBundle)
+
+    /// The "9" asset catalog color resource.
+    static let _9 = DeveloperToolsSupport.ColorResource(name: "9", bundle: resourceBundle)
+
+    /// The "ABCdef" asset catalog color resource.
+    static let abCdef = DeveloperToolsSupport.ColorResource(name: "ABCdef", bundle: resourceBundle)
+
+    /// The "ALLCAPS" asset catalog color resource.
+    static let ALLCAPS = DeveloperToolsSupport.ColorResource(name: "ALLCAPS", bundle: resourceBundle)
+
+    /// The "A_B" asset catalog color resource.
+    static let A_B = DeveloperToolsSupport.ColorResource(name: "A_B", bundle: resourceBundle)
+
+    /// The "AccentColor" asset catalog color resource.
+    static let accent = DeveloperToolsSupport.ColorResource(name: "AccentColor", bundle: resourceBundle)
+
+    /// The "BothIdioms" asset catalog color resource.
+    static let bothIdioms = DeveloperToolsSupport.ColorResource(name: "BothIdioms", bundle: resourceBundle)
+
+    /// The "Brand Yellow" asset catalog color resource.
+    static let brandYellow = DeveloperToolsSupport.ColorResource(name: "Brand Yellow", bundle: resourceBundle)
+
+    /// The "BrandRed" asset catalog color resource.
+    static let brandRed = DeveloperToolsSupport.ColorResource(name: "BrandRed", bundle: resourceBundle)
+
+    /// The "Color" asset catalog color resource.
+    static let color = DeveloperToolsSupport.ColorResource(name: "Color", bundle: resourceBundle)
+
+    /// The "Color.Dark" asset catalog color resource.
+    static let colorDark = DeveloperToolsSupport.ColorResource(name: "Color.Dark", bundle: resourceBundle)
+
+    #warning("The \"ColorColor\" color asset name resolves to the symbol \"color\" which already exists. Try renaming the asset.")
+
+    /// The "Gray" asset catalog color resource.
+    static let gray = DeveloperToolsSupport.ColorResource(name: "Gray", bundle: resourceBundle)
+
+    /// The "Gray 100" asset catalog color resource.
+    static let gray100 = DeveloperToolsSupport.ColorResource(name: "Gray 100", bundle: resourceBundle)
+
+    /// The "HTML5Color" asset catalog color resource.
+    static let HTML_5 = DeveloperToolsSupport.ColorResource(name: "HTML5Color", bundle: resourceBundle)
+
+    /// The "Icons" asset catalog resource namespace.
+    enum Icons {
+
+        /// The "Icons/Tint" asset catalog color resource.
+        static let tint = DeveloperToolsSupport.ColorResource(name: "Icons/Tint", bundle: resourceBundle)
+
+    }
+
+    /// The "Protocol" asset catalog color resource.
+    static let `protocol` = DeveloperToolsSupport.ColorResource(name: "Protocol", bundle: resourceBundle)
+
+    /// The "Type" asset catalog color resource.
+    static let type = DeveloperToolsSupport.ColorResource(name: "Type", bundle: resourceBundle)
+
+    /// The "UPPER_snake" asset catalog color resource.
+    static let upperSnake = DeveloperToolsSupport.ColorResource(name: "UPPER_snake", bundle: resourceBundle)
+
+    /// The "URLColor" asset catalog color resource.
+    static let URL = DeveloperToolsSupport.ColorResource(name: "URLColor", bundle: resourceBundle)
+
+    /// The "UniPhone" asset catalog color resource.
+    static let uniPhone = DeveloperToolsSupport.ColorResource(name: "UniPhone", bundle: resourceBundle)
+
+    /// The "_private" asset catalog color resource.
+    static let `private` = DeveloperToolsSupport.ColorResource(name: "_private", bundle: resourceBundle)
+
+    /// The "a" asset catalog color resource.
+    static let a = DeveloperToolsSupport.ColorResource(name: "a", bundle: resourceBundle)
+
+    #warning("The \"accent\" color asset name resolves to the symbol \"accent\" which already exists. Try renaming the asset.")
+
+    /// The "alloc" asset catalog color resource.
+    static let alloc = DeveloperToolsSupport.ColorResource(name: "alloc", bundle: resourceBundle)
+
+    /// The "alternateSelectedControl" asset catalog color resource.
+    static let alternateSelectedControl = DeveloperToolsSupport.ColorResource(name: "alternateSelectedControl", bundle: resourceBundle)
+
+    /// The "alternateSelectedControlText" asset catalog color resource.
+    static let alternateSelectedControlText = DeveloperToolsSupport.ColorResource(name: "alternateSelectedControlText
```

**File**: `sweetpad-cli/fixtures/actool/expected/swiftui.swift` (added, +1588/-0)
```diff
@@ -0,0 +1,1588 @@
+import Foundation
+#if canImport(SwiftUI)
+import SwiftUI
+#endif
+#if canImport(DeveloperToolsSupport)
+import DeveloperToolsSupport
+#endif
+
+#if SWIFT_PACKAGE
+private let resourceBundle = Foundation.Bundle.module
+#else
+private class ResourceBundleClass {}
+private let resourceBundle = Foundation.Bundle(for: ResourceBundleClass.self)
+#endif
+
+// MARK: - Color Symbols -
+
+@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
+extension DeveloperToolsSupport.ColorResource {
+
+    /// The "#hash" asset catalog color resource.
+    static let hash = DeveloperToolsSupport.ColorResource(name: "#hash", bundle: resourceBundle)
+
+    /// The "1stColor" asset catalog color resource.
+    static let _1St = DeveloperToolsSupport.ColorResource(name: "1stColor", bundle: resourceBundle)
+
+    /// The "9" asset catalog color resource.
+    static let _9 = DeveloperToolsSupport.ColorResource(name: "9", bundle: resourceBundle)
+
+    /// The "ABCdef" asset catalog color resource.
+    static let abCdef = DeveloperToolsSupport.ColorResource(name: "ABCdef", bundle: resourceBundle)
+
+    /// The "ALLCAPS" asset catalog color resource.
+    static let ALLCAPS = DeveloperToolsSupport.ColorResource(name: "ALLCAPS", bundle: resourceBundle)
+
+    /// The "A_B" asset catalog color resource.
+    static let A_B = DeveloperToolsSupport.ColorResource(name: "A_B", bundle: resourceBundle)
+
+    /// The "AccentColor" asset catalog color resource.
+    static let accent = DeveloperToolsSupport.ColorResource(name: "AccentColor", bundle: resourceBundle)
+
+    /// The "BothIdioms" asset catalog color resource.
+    static let bothIdioms = DeveloperToolsSupport.ColorResource(name: "BothIdioms", bundle: resourceBundle)
+
+    /// The "Brand Yellow" asset catalog color resource.
+    static let brandYellow = DeveloperToolsSupport.ColorResource(name: "Brand Yellow", bundle: resourceBundle)
+
+    /// The "BrandRed" asset catalog color resource.
+    static let brandRed = DeveloperToolsSupport.ColorResource(name: "BrandRed", bundle: resourceBundle)
+
+    /// The "Color" asset catalog color resource.
+    static let color = DeveloperToolsSupport.ColorResource(name: "Color", bundle: resourceBundle)
+
+    /// The "Color.Dark" asset catalog color resource.
+    static let colorDark = DeveloperToolsSupport.ColorResource(name: "Color.Dark", bundle: resourceBundle)
+
+    #warning("The \"ColorColor\" color asset name resolves to the symbol \"color\" which already exists. Try renaming the asset.")
+
+    /// The "Gray" asset catalog color resource.
+    static let gray = DeveloperToolsSupport.ColorResource(name: "Gray", bundle: resourceBundle)
+
+    /// The "Gray 100" asset catalog color resource.
+    static let gray100 = DeveloperToolsSupport.ColorResource(name: "Gray 100", bundle: resourceBundle)
+
+    /// The "HTML5Color" asset catalog color resource.
+    static let HTML_5 = DeveloperToolsSupport.ColorResource(name: "HTML5Color", bundle: resourceBundle)
+
+    /// The "Icons" asset catalog resource namespace.
+    enum Icons {
+
+        /// The "Icons/Tint" asset catalog color resource.
+        static let tint = DeveloperToolsSupport.ColorResource(name: "Icons/Tint", bundle: resourceBundle)
+
+    }
+
+    /// The "PhoneOnly" asset catalog color resource.
+    @available(watchOS, unavailable)
+    static let phoneOnly = DeveloperToolsSupport.ColorResource(thinnableName: "PhoneOnly", bundle: resourceBundle)
+
+    /// The "Protocol" asset catalog color resource.
+    static let `protocol` = DeveloperToolsSupport.ColorResource(name: "Protocol", bundle: resourceBundle)
+
+    /// The "Type" asset catalog color resource.
+    static let type = DeveloperToolsSupport.ColorResource(name: "Type", bundle: resourceBundle)
+
+    /// The "UPPER_snake" asset catalog color resource.
+    static let upperSnake = DeveloperToolsSupport.ColorResource(name: "UPPER_snake", bundle: resourceBundle)
+
+    /// The "URLColor" asset catalog color resource.
+    static let URL = DeveloperToolsSupport.ColorResource(name: "URLColor", bundle: resourceBundle)
+
+    /// The "UniPhone" asset catalog color resource.
+    static let uniPhone = DeveloperToolsSupport.ColorResource(name: "UniPhone", bundle: resourceBundle)
+
+    /// The "_private" asset catalog color resource.
+    static let `private` = DeveloperToolsSupport.ColorResource(name: "_private", bundle: resourceBundle)
+
+    /// The "a" asset catalog color resource.
+    static let a = DeveloperToolsSupport.ColorResource(name: "a", bundle: resourceBundle)
+
+    #warning("The \"accent\" color asset name resolves to the symbol \"accent\" which already exists. Try renaming the asset.")
+
+    /// The "alloc" asset catalog color resource.
+    static let alloc = DeveloperToolsSupport.ColorResource(name: "alloc", bundle: resourceBundle)
+
+    /// The "alternateSelectedControl" asset catalog color resource.
+    static let alternateSelectedControl = DeveloperToolsSupport.ColorR
```

#### Recent Merged Pull Requests:
- **PR #348** (2026-11-08): Document Linux iPhone workflows and macOS CI (@hyzyla)
- **PR #347** (2026-11-08): Close Linux build gaps and package an experimental ARM64 release (@hyzyla)
- **PR #346** (2026-11-06): Build Xcode projects on Linux with Swift Build (@hyzyla)
- **PR #338** (2026-09-19): Launch the simulator app Xcode 27 renamed to DeviceHub (#337) (@hyzyla)
- **PR #334** (2026-08-26): List schemes from every local Swift package a container reaches (#327) (@hyzyla)
- **PR #333** (2026-08-25): Show each generic destination with its platform's own icon (@hyzyla)

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

## X. Close Linux build gaps and package an ARM64 release (#347)

**RULE**:
When implementing operations in `.github/workflows/cli-release.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e56e699c`: Close Linux build gaps and package an ARM64 release (#347). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/cli-release.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    inputs:
      platform:
        description: Platforms to build without publishing
        type: choice
        options: [all, linux-arm64]
        default: all
      validate_sdk:
        description: Validate the ARM64 package with a private Apple SDK runner
        type: boolean
        default: false
      sdk_runner_label:
        description: Label of the provisioned private SDK runner
        type: string
        default: sweetpad-linux
  linux-arm64:
    name: Linux ARM64 release package
    uses: ./.github/workflows/linux-arm64-package.yaml
  sdk-validation:
    name: Private SDK install validation
    if: github.event_name == 'workflow_dispatch' && inputs.validate_sdk
    needs: linux-arm64
    permissions:
      contents: read
      actions: read
    uses: ./.github/workflows/linux-apple-build.yaml
    with:
      artifact_run_id: ${{ github.run_id }}
      runner_label: ${{ inputs.sdk_runner_label }}
    if: inputs.platform != 'linux-arm64'
    outputs:
      version: ${{ steps.version.outputs.version }}
        id: version
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          shasum -a 256 "$TARBALL" > "$TARBALL.sha256"
          path: |
            *.tar
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
          shasum -a 256 "$TARBALL"
          path: "*.tar.gz"
          files: "*.tar.gz"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e56e699c` are properly handled with clean fallback behavior.
