# Verification Protocol: Verification Protocol: Empirical Defect Shield for sweetpad-dev-sweetpad-learnings

<!-- PROVENANCE_START
{
  "source_repository": "sweetpad-dev-sweetpad-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T10:50:50.313Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sweetpad-dev-sweetpad-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sweetpad-dev-sweetpad-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T10:50:50.313Z`  
> **Learning ID**: `LEARN-EVO-sweetpad-dev-sweetpad-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `sweetpad-dev-sweetpad-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source**: github ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Source Version**: `685c517e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T10:50:36.368Z  
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
> **Harvest Timestamp**: 2026-11-26T10:50:36.364Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1938 stars

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
- **Issue #367** (2026-11-25): **Fix App Clip signing on Linux and verify it end to end**
  *Symptoms*: Linux could produce a correctly signed IPA whose host was missing the entitlement that identifies its App Clip. It also accepted a device Clip that omitted its parent application identifier. Xcode rejected the same Clip.  The Linux signer now takes the host association from the selected provisioning profile during build and export. Archive and re-export also check that the Clip names exactly its containing app.  The delivery fixture includes a host, an embedded Clip, and a standalone UI test that exercises the prebuilt Linux and Xcode products. [Instructions for reproducing the checks](https://github.com/sweetpad-dev/sweetpad/blob/1c2e74210453b1c55d457bf3019361cd5fa3280e/sweetpad-lib/ci/fixture-delivery/README.md#app-clips)  ## Verification  - Built on Linux arm64 and with Xcode. Both hosts launched on an iPhone 17 Pro simulator. Each installed Clip displayed the fresh HTTPS URL supplied by XCTest, and its installed binaries matched the originals. - Compared both Release device archives and the Linux development IPA. The host and Clip entitlements matched Xcode. Apple's tools verified the signatures, and the checker matched the signing certificates to the profiles and the archive dSYMs to the executables. - Re-exported an older ad hoc archive and verified that it gained the host association. Both engines rejected a new archive missing the Clip's parent entitlement, and Linux rejected re-exporting an older archive with the same defect. - Workspace library tests passed (1,616 p

- **Issue #366** (2026-11-22): **Fix Linux watchOS linking, setup races, and CLI failure output**
  *Symptoms*: ## Changes  - Fix watchOS Simulator links for dynamic SwiftPM frameworks by letting Swift Build select the linker flag for each compiler driver. Add a watchOS test project and check its framework and XCTest Mach-O binaries in the opt-in private-SDK Linux package job. - Create owner-only cache directories under umask 0002, including when the build-settings catalog writes first. Verify bundled hot-reload client bytes before reuse. - Write one-shot JSON errors to stdout so redirection captures both outcomes. Failed test runs return exit 3 and include the same error and available test report in JSON and the final NDJSON event. NDJSON retains its compact stderr diagnostic. - Serialize Swift installation and archive access across setup processes. Verify the compiler in staging before publishing the installation.  ## Verification  The macOS CLI and shared-library suites passed 1,802 tests with one ignored. Clippy and formatting passed. In the arm64 Linux VM, the packaged CLI built an iOS device app and linked the watchOS Simulator dynamic framework and XCTest bundle using an imported Apple SDK. Two concurrent setup processes shared one download, and a waiting process recovered when the downloader was interrupted. 

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

### Incident Patch 1: `685c517e` (2026-11-25)
**Commit Message**: Fix App Clip signing on Linux and verify it end to end (#367)

**File**: `sweetpad-cli/PLAN_LINUX.md` (modified, +8/-1)
```diff
@@ -1110,7 +1110,14 @@ Clippy with `-D warnings`, formatting and diff checks also pass.
 - [x] App extensions and widgets: an `embeddedBinaryValidationUtility`
       stand-in makes Xcode's checks (bundle ID prefix, matching versions);
       a widget built here registers in the simulator
-- [ ] App Clips
+- [x] App Clips. The [delivery fixture](../sweetpad-lib/ci/fixture-delivery/README.md#app-clips)
+      builds a host with an embedded Clip on Linux and with Xcode. Both hosts
+      launch on an iPhone simulator, and each installed Clip displays a fresh
+      HTTPS invocation URL in XCTest. The Release device archives and Linux
+      development IPA match on host/Clip entitlements and bundle metadata.
+      Apple's tools verify both signatures, their provisioning profiles, and
+      both archive dSYMs. Both engines reject a signed Clip missing its parent
+      entitlement.
 - [x] Test targets: `test build` adds the selected test plan's targets, or
       the scheme's testables, as `build-for-testing` does, and leaves the
       testing frameworks out of the host app like Xcode 27. The bundle passes
```

**File**: `sweetpad-cli/src/cli/codesign/provisioning.rs` (modified, +36/-7)
```diff
@@ -153,13 +153,7 @@ pub(super) fn answer(
     }
     merge(&mut entitlements, project);
     if let Some(profile) = &profile {
-        for key in ["aps-environment", "com.apple.developer.aps-environment"] {
-            if plist::get(&entitlements, key).is_some()
-                && let Some(value) = plist::get(&profile.entitlements, key)
-            {
-                plist::set(&mut entitlements, key, value.clone());
-            }
-        }
+        profile.apply_capabilities(&mut entitlements, mac);
     }
     if !mac || profile.is_some() {
         plist::set(
@@ -485,6 +479,21 @@ pub(super) fn check_entitlements(
     Ok(())
 }
 
+/// A signed App Clip identifies exactly one full app, including its App ID prefix.
+pub(crate) fn check_clip_parent(entitlements: &Plist, host_id: &str) -> Result<(), String> {
+    let key = "com.apple.developer.parent-application-identifiers";
+    if let Some(Plist::Array(parents)) = plist::get(entitlements, key)
+        && let [Plist::String(parent)] = parents.as_slice()
+        && parent == host_id
+    {
+        return Ok(());
+    }
+    Err(format!(
+        "The {key} entitlement of an App Clip must match the application-identifier entitlement \
+         ('{host_id}') of its containing parent app."
+    ))
+}
+
 /// Whether a profile has to grant entitlement `key`.
 fn provisioned(key: &str) -> bool {
     (key.starts_with("com.apple.developer.") && key != "com.apple.developer.team-identifier")
@@ -636,6 +645,26 @@ impl Profile {
 }
 
 impl Profile {
+    /// Xcode takes the requested push environment from the profile. It also
+    /// signs an iOS host with its registered App Clip association, even when
+    /// the project has no entitlements file or this build embeds no Clip.
+    pub(super) fn apply_capabilities(&self, entitlements: &mut Plist, mac: bool) {
+        for key in ["aps-environment", "com.apple.developer.aps-environment"] {
+            if plist::get(entitlements, key).is_some()
+                && let Some(value) = plist::get(&self.entitlements, key)
+            {
+                plist::set(entitlements, key, value.clone());
+            }
+        }
+        let clips = "com.apple.developer.associated-appclip-app-identifiers";
+        if !mac
+            && plist::get(entitlements, clips).is_none()
+            && let Some(value) = plist::get(&self.entitlements, clips)
+        {
+            plist::set(entitlements, clips, value.clone());
+        }
+    }
+
     /// The application identifier it allows, with its team: exact, or a
     /// prefix ending in `*`. A macOS profile names it with Apple's prefix.
     pub fn application_identifier(&self) -> Option<&str> {
```

**File**: `sweetpad-cli/src/cli/codesign/resign.rs` (modified, +9/-14)
```diff
@@ -127,12 +127,9 @@ pub(super) fn plan_with(
     let app = &request.app;
     let info = read_info(app)?;
     let mac = app.join("Contents").is_dir();
+    let default_platform = if mac { "macosx" } else { "iphoneos" };
     let platform =
-        provisioning::platform(plist::string(&info, "DTPlatformName").unwrap_or(if mac {
-            "macosx"
-        } else {
-            "iphoneos"
-        }));
+        provisioning::platform(plist::string(&info, "DTPlatformName").unwrap_or(default_platform));
     let archived = archived(app)?;
     let team = match (
         &request.team,
@@ -162,7 +159,7 @@ pub(super) fn plan_with(
         if is_provisioned(&path) {
             let id = bundle_id(&path)?;
             let bundle = bundle.insert(id);
-            let archived = archived_entitlements(&path)?;
+            let archived = signed_entitlements(&path)?;
             // A Developer ID app embeds a profile only for what Apple grants
             // through one, or when ExportOptions names one.
             let provisioned = request.method != Method::DeveloperId
@@ -184,6 +181,9 @@ pub(super) fn plan_with(
             } else {
                 unprovisioned(archived, &team)
             };
+            if path.parent() == Some(app.join("AppClips").as_path()) {
+                provisioning::check_clip_parent(&signed, &format!("{team}.{}", bundle_id(app)?))?;
+            }
             let icloud = "com.apple.developer.icloud-container-environment";
             if let Some(environment) = &request.icloud_environment
                 && plist::get(&signed, icloud).is_some()
@@ -387,7 +387,8 @@ fn archived(bundle: &Path) -> Result<Option<blobs::Existing>, String> {
     Ok(layout.signature(&slice.data).and_then(blobs::read_existing))
 }
 
-fn archived_entitlements(bundle: &Path) -> Result<Plist, String> {
+/// The entitlements in the code signature of a bundle's main executable.
+pub(crate) fn signed_entitlements(bundle: &Path) -> Result<Plist, String> {
     match archived(bundle)?.and_then(|e| e.entitlements) {
         Some(xml) => plist::parse(&xml),
         None => Ok(Plist::Dict(Vec::new())),
@@ -523,13 +524,7 @@ pub(super) fn transform(
         let allow = granted("get-task-allow").unwrap_or(Plist::Bool(false));
         plist::set(&mut entitlements, "get-task-allow", allow);
     }
-    for key in ["aps-environment", "com.apple.developer.aps-environment"] {
-        if plist::get(&entitlements, key).is_some()
-            && let Some(value) = granted(key)
-        {
-            plist::set(&mut entitlements, key, value);
-        }
-    }
+    profile.apply_capabilities(&mut entitlements, mac);
     if let Some(value) = granted("beta-reports-active") {
         plist::set(&mut entitlements, "beta-reports-active", value);
     }
```

**File**: `sweetpad-cli/src/cli/codesign/tests.rs` (modified, +47/-0)
```diff
@@ -1336,6 +1336,53 @@ fn an_export_refuses_a_profile_of_another_kind_or_a_missing_one() {
     assert!(teams.contains("names no team"), "{teams}");
 }
 
+#[test]
+fn a_signed_app_clip_must_name_exactly_its_host() {
+    let host = "TESTTEAM01.dev.sweetpad.app";
+    let parent = Plist::String(host.into());
+    let other = Plist::String("TESTTEAM01.dev.sweetpad.other".into());
+    let check = |parents| {
+        let rights = Plist::Dict(vec![(
+            "com.apple.developer.parent-application-identifiers".into(),
+            Plist::Array(parents),
+        )]);
+        provisioning::check_clip_parent(&rights, host)
+    };
+    assert!(check(vec![parent.clone()]).is_ok());
+    assert!(check(vec![other.clone()]).is_err());
+    assert!(check(vec![parent, other]).is_err());
+    assert!(provisioning::check_clip_parent(&Plist::Dict(vec![]), host).is_err());
+}
+
+#[test]
+fn export_restores_the_profiles_app_clip_association_to_an_ad_hoc_archive() {
+    let mut profile =
+        provisioning::find_named(kind_profiles(), "Sweetpad Kinds app-store").unwrap();
+    let key = "com.apple.developer.associated-appclip-app-identifiers";
+    let clip = Plist::Array(vec![Plist::String(
+        "TESTTEAM01.dev.sweetpad.kinds.app.Clip".into(),
+    )]);
+    plist::set(&mut profile.entitlements, key, clip.clone());
+    let export = |archived| {
+        resign::transform(
+            archived,
+            &profile,
+            "TESTTEAM01",
+            "dev.sweetpad.kinds.app",
+            false,
+            resign::Method::AppStoreConnect,
+        )
+    };
+    let signed = export(Plist::Dict(vec![])).unwrap();
+    assert_eq!(plist::get(&signed, key), Some(&clip));
+
+    let other = Plist::Array(vec![Plist::String(
+        "TESTTEAM01.dev.sweetpad.other.Clip".into(),
+    )]);
+    let mismatch = export(Plist::Dict(vec![(key.into(), other)])).unwrap_err();
+    assert!(mismatch.contains(key), "{mismatch}");
+}
+
 #[test]
 #[allow(clippy::too_many_lines)] // one table of entitlements per method
 fn export_entitlements_move_to_the_profile_and_team() {
```

**File**: `sweetpad-cli/src/cli/darwin_tools/embedded_binary.rs` (modified, +18/-7)
```diff
@@ -2,17 +2,17 @@
 //! Info.plist> [-signing-cert <name>]`, which Swift Build runs on each app
 //! extension, App Clip or watch app it embeds in an app.
 //!
-//! It makes the checks of Xcode's that hold without signing: an error when
-//! the embedded bundle's identifier doesn't start with the app's, and a
-//! warning when its `CFBundleVersion`, or else its
-//! `CFBundleShortVersionString`, differs from the app's or is missing. The messages are
-//! Xcode's, on stderr, where Swift Build reads them.
+//! Checks the embedded bundle's identifier and versions against its host.
+//! A device App Clip must also name its host in its signed entitlements.
 
 use std::path::{Path, PathBuf};
 use std::process::ExitCode;
 
 use sweetpad_lib::derived_data::plist_strings;
 
+use crate::cli::codesign::{provisioning::check_clip_parent, resign::signed_entitlements};
+use crate::cli::property_list as plist;
+
 pub(super) fn main(args: &[String]) -> ExitCode {
     match validate(args) {
         Ok(warnings) => {
@@ -36,7 +36,6 @@ fn validate(args: &[String]) -> Result<Vec<String>, String> {
     while let Some(arg) = it.next() {
         match arg.as_str() {
             "-info-plist-path" => host_plist = Some(PathBuf::from(super::value(arg, &mut it)?)),
-            // Nothing is signed during the build here.
             "-signing-cert" => {
                 super::value(arg, &mut it)?;
             }
@@ -54,7 +53,19 @@ fn validate(args: &[String]) -> Result<Vec<String>, String> {
         ));
     }
     let own = plist_strings(&info_plist(&embedded));
-    Ok(check(&own, &host)?.into_iter().collect())
+    let warning = check(&own, &host)?;
+    if embedded
+        .parent()
+        .is_some_and(|dir| dir.ends_with("AppClips"))
+        && own
+            .iter()
+            .any(|(k, v)| k == "DTPlatformName" && v == "iphoneos")
+        && let Some(app) = host_plist.parent()
+        && let Some(host_id) = plist::string(&signed_entitlements(app)?, "application-identifier")
+    {
+        check_clip_parent(&signed_entitlements(&embedded)?, host_id)?;
+    }
+    Ok(warning.into_iter().collect())
 }
 
 /// A bundle's Info.plist: at its root on iOS, in `Contents` on macOS.
```

**File**: `sweetpad-docs/docs/cli/linux/reference.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ sidebar_label: Support and configuration
 
 | Operation | On Linux |
 | --- | --- |
-| Build iOS apps, extensions, and widgets | Supported. |
+| Build iOS apps, extensions, widgets, and App Clips | Supported. App Clips embed in their host and can be exported in a development-signed IPA. |
 | Build macOS apps | Supported. Running them needs a Mac. |
 | Build tvOS, watchOS, and visionOS simulator targets | Builds and links. Running them and device signing are untested. |
 | Build Mac Catalyst targets | Untested. |
```

**File**: `sweetpad-lib/ci/check-app-clip.py` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+#!/usr/bin/env python3
+"""Compare the delivery fixture's prebuilt App Clip products on a Mac with Xcode."""
+import argparse
+import hashlib
+import json
+import os
+from pathlib import Path
+import plistlib
+import subprocess
+import tempfile
+
+
+FIXTURE = Path(__file__).resolve().parent / "fixture-delivery"
+PARENT = "com.apple.developer.parent-application-identifiers"
+CLIPS = "com.apple.developer.associated-appclip-app-identifiers"
+ON_DEMAND = "com.apple.developer.on-demand-install-capable"
+
+
+def run(*command, timeout=240):
+    result = subprocess.run(command, capture_output=True, timeout=timeout)
+    if result.returncode:
+        raise RuntimeError(f"{command[0]} failed: {(result.stderr + result.stdout).decode(errors='replace')}")
+    return result.stdout
+
+
+def equal(what, actual, expected):
+    if actual != expected:
+        raise ValueError(f"{what}: expected {expected!r}, got {actual!r}")
+
+
+def inspect(app, simulator):
+    clip = app / "AppClips/DeliveryClip.app"
+    equal("embedded Clips", list(clip.parent.glob("*.app")), [clip])
+    metadata, rights = {}, {}
+    for role, bundle in [("host", app), ("clip", clip)]:
+        run("codesign", "--verify", "--deep", "--strict", bundle)
+        info = plistlib.loads((bundle / "Info.plist").read_bytes())
+        metadata[role] = {key: info[key] for key in (
+            "CFBundleIdentifier", "CFBundleExecutable", "CFBundleVersion",
+            "CFBundleShortVersionString", "MinimumOSVersion", "UIDeviceFamily", "DTPlatformName")}
+        equal(f"{role} platform", info["DTPlatformName"], "iphonesimulator" if simulator else "iphoneos")
+        if role == "clip":
+            metadata[role]["NSAppClip"] = info["NSAppClip"]
+        if simulator:
+            # Simulator entitlements live in the Mach-O, outside the ad hoc signature.
+            with tempfile.TemporaryDirectory() as temp:
+                output = Path(temp) / "simulated.plist"
+                run("xcrun", "segedit", bundle / info["CFBundleExecutable"],
+                    "-extract", "__TEXT", "__entitlements", output)
+                rights[role] = plistlib.loads(output.read_bytes().rstrip(b"\0"))
+        else:
+            rights[role] = plistlib.loads(run("codesign", "-d", "--entitlements", "-", "--xml", bundle))
+            profile = plistlib.loads(run("security", "cms", "-D", "-i", bundle / "embedded.mobileprovision"))
+            with tempfile.TemporaryDirectory() as temp:
+                run("codesign", "-d", f"--extract-certificates={temp}/signer", bundle)
+                signer = (Path(temp) / "signer0").read_bytes()
+                if signer not in profile["DeveloperCertificates"]:
+                    raise ValueError(f"{role} signing certificate is missing from its profile")
+            association = (CLIPS,) if role == "host" else (PARENT, ON_DEMAND)
+            for key in ("application-identifier", "get-task-allow", *association):
+                equal(f"{role} signed/profile {key}", rights[role][key], profile["Entitlements"][key])
+            equal(f"{role} development signature", rights[role]["get-task-allow"], True)
+
+    equal("Clip bundle ID", metadata["clip"]["CFBundleIdentifier"], metadata["host"]["CFBundleIdentifier"] + ".Clip")
+    equal("Clip parent", rights["clip"][PARENT], [rights["host"]["application-identifier"]])
+    equal("on-demand capability", rights["clip"][ON_DEMAND], True)
+    if not simulator:
+        equal("host association", rights["host"][CLIPS], [rights["clip"]["application-identifier"]])
+    return {"info": metadata, "entitlements": rights}
+
+
+def binary_hashes(app):
+    info = plistlib.loads((app / "Info.plist").read_bytes())
+    executable = app / info["CFBundleExecutable"]
+    binaries = [executable]
+    # When Xcode emits a debug launcher, the Swift code lives in this dylib.
+    debug_dylib = app / (executable.name + ".debug.dylib")
+    if debug_dylib.is_file():
+        binaries.append(debug_dylib)
+    return {binary.name: hashlib.sha256(binary.read_bytes()).hexdigest() for binary in binaries}
+
+
+def install_on_simulator(udid, bundle):
+    # CoreSimulator's install service cannot read some Linux VM mounts.
+    with tempfile.TemporaryDirectory() as temp:
+        local = Path(temp) / bundle.name
+        run("ditto", bundle, local)
+        run("xcrun", "simctl", "install", udid, local)
+
+
+def simulator_check(args):
+    reference = inspect(args.xcode, True)
+    equal("Linux simulator product", inspect(args.linux, True), reference)
+    host_id = reference["info"]["host"]["CFBundleIdentifier"]
+    equal("UI test fixture identifier", host_id, "dev.example.delivery")
+    clip_id = reference["info"]["clip"]["CFBundleIdentifier"]
+    simctl = ("xcrun", "simctl")
+    report = {}
+    for label, app in [("xcode", args.xcode), ("linux", args.linux)]:
+        install_on_simulator(args.simulator, app)
+        try:
+            run(*simctl, "launch", args.simulator, host_i
```

**File**: `sweetpad-lib/ci/fixture-delivery/Delivery.xcodeproj/project.pbxproj` (modified, +317/-0)
```diff
@@ -11,6 +11,7 @@
 		1767D6861271A76B6A685D67 /* DeliveryApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = FE2857443B0F2678AE8E2E6B /* DeliveryApp.swift */; };
 		18C3B4B68C4C7D49A656C636 /* DeliveryWidget.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = D6DB43B64FE333E4423ACF10 /* DeliveryWidget.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
 		28C8A9B24024AA01EC1CDF56 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 787770103BFE1EEC0AA281B9 /* Assets.xcassets */; };
+		2D7E245A315DDE12EEA0B7A6 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 787770103BFE1EEC0AA281B9 /* Assets.xcassets */; };
 		2F0659BA97AEEEBAB7F5C789 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 787770103BFE1EEC0AA281B9 /* Assets.xcassets */; };
 		2F920C745BA412A0F4BB88A6 /* DeliveryWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1C1745C2A8762C8B9CEB4608 /* DeliveryWidget.swift */; };
 		4094B33B25AE89A0F9757B40 /* DeliveryKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 2BB7D8BE893070FB3A27298D /* DeliveryKit.framework */; };
@@ -20,13 +21,18 @@
 		4E148B05AA156DC2E01D5BC8 /* DeliveryKit.framework in Embed Frameworks */ = {isa = PBXBuildFile; fileRef = 2BB7D8BE893070FB3A27298D /* DeliveryKit.framework */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
 		4EBB519487E625CF30EF27AE /* DeliveryKit.swift in Sources */ = {isa = PBXBuildFile; fileRef = DC3F738A7B82970DE911D9B1 /* DeliveryKit.swift */; };
 		51055E2CE488DC2FE207355C /* DeliveryApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = FE2857443B0F2678AE8E2E6B /* DeliveryApp.swift */; };
+		5CD49DD94BDFF656F7C7DF31 /* DeliveryClip.app in Embed App Clips */ = {isa = PBXBuildFile; fileRef = B145D1CDAFEBF029DFF75E31 /* DeliveryClip.app */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
+		5D76E5D70A6BB0C40D615233 /* DeliveryClipInvocationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AC607C42011920F61BB35F5A /* DeliveryClipInvocationTests.swift */; };
 		61D1F00500B2972D9A98135E /* Stickers.xcstickers in Resources */ = {isa = PBXBuildFile; fileRef = 9D33BFE8597B90CB36E4C97C /* Stickers.xcstickers */; };
 		7F95D6040E32E6B70F1374E6 /* DeliveryWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1C1745C2A8762C8B9CEB4608 /* DeliveryWidget.swift */; };
 		8A1EF9D22F9303B250D0D749 /* DeliveryKit.framework in Embed Frameworks */ = {isa = PBXBuildFile; fileRef = B66A42A93FB081CD43CD1B60 /* DeliveryKit.framework */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
 		8D39D4D04B38808627D960BC /* DeliveryWatch.app in Embed Watch Content */ = {isa = PBXBuildFile; fileRef = 5979151531102AEB88B7E8F6 /* DeliveryWatch.app */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
+		A4162E428FDBCEA3F0023984 /* DeliveryClipApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0CF5AF1040C832FE730AE8C7 /* DeliveryClipApp.swift */; };
 		B76280CEC8B62D45615F35A0 /* DeliveryWatchExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = AF48D7A1CAEC2F21D8A38498 /* DeliveryWatchExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
+		BFD831851B8A12D17915EF27 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 787770103BFE1EEC0AA281B9 /* Assets.xcassets */; };
 		C7EF64F40FDDEE294F27BD85 /* DeliveryKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = B66A42A93FB081CD43CD1B60 /* DeliveryKit.framework */; };
 		E561AFCF774A6AB4057C2100 /* DeliveryStickers.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = D1287DA92E32BB492EB4CB25 /* DeliveryStickers.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
+		FAD9FE1625C7E81AB3D33C84 /* DeliveryClipApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0CF5AF1040C832FE730AE8C7 /* DeliveryClipApp.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -37,6 +43,13 @@
 			remoteGlobalIDString = EAC9D63AA5CE8D3638F64DBC;
 			remoteInfo = "DeliveryKit-macOS";
 		};
+		08F1056EC823BCF23D0346EB /* PBXContainerItemProxy */ = {
+			isa = PBXContainerItemProxy;
+			containerPortal = 21C744D40939B74039A1F09A /* Project object */;
+			proxyType = 1;
+			remoteGlobalIDString = 803F0E1FDD05666ADCEA3BB6;
+			remoteInfo = DeliveryClip;
+		};
 		18953895144B34320B1DA4EA /* PBXContainerItemProxy */ = {
 			isa = PBXContainerItemProxy;
 			containerPortal = 21C744D40939B74039A1F09A /* Project object */;
@@ -82,6 +95,17 @@
 /* End PBXContainerItemProxy section */
 
 /* Begin PBXCopyFilesBuildPhase section */
+		0CA75BE903753F11072AD79F /* Embed App Clips */ = {
+			isa = PBXCopyFilesBuildPhase;
+			buildActionMask = 2147483647;
+			dstPath = "$(CONTENTS_FOLDER_PATH)/AppClips";
+			dstSubfolderSpec = 16;
+			files = (
+				5CD49DD94BDFF656F7C7DF31 /* DeliveryClip.app in Embed App Clips */,
+			);
+			name = "Embed App Clip
```

#### Recent Merged Pull Requests:
- **PR #367** (2026-11-25): Fix App Clip signing on Linux and verify it end to end (@hyzyla)
- **PR #366** (2026-11-22): Fix Linux watchOS linking, setup races, and CLI failure output (@hyzyla)
- **PR #365** (2026-11-21): Address 104 Dependabot alerts across SweetPad dependencies (@hyzyla)
- **PR #364** (2026-11-21): Set up Linux builds with sweetpad's own SDK import and LLVM linker (@hyzyla)
- **PR #362** (2026-11-15): Close most of the open Linux backlog (@hyzyla)
- **PR #361** (2026-11-15): Fix six Linux backlog items (@hyzyla)

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

## X. App Clip signing on Linux and verify it end to end

**RULE**:
When implementing operations in `sweetpad-cli/PLAN_LINUX.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `685c517e`: App Clip signing on Linux and verify it end to end. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sweetpad-cli/PLAN_LINUX.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- [x] App Clips. The [delivery fixture](../sweetpad-lib/ci/fixture-delivery/README.md#app-clips)
      builds a host with an embedded Clip on Linux and with Xcode. Both hosts
      launch on an iPhone simulator, and each installed Clip displays a fresh
      HTTPS invocation URL in XCTest. The Release device archives and Linux
      development IPA match on host/Clip entitlements and bundle metadata.
      Apple's tools verify both signatures, their provisioning profiles, and
      both archive dSYMs. Both engines reject a signed Clip missing its parent
      entitlement.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- [ ] App Clips
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `685c517e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
