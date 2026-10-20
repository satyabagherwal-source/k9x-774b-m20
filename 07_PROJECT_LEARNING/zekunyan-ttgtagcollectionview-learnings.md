> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zekunyan-ttgtagcollectionview-learnings.md`  
> **Source**: github ([https://github.com/zekunyan/TTGTagCollectionView](https://github.com/zekunyan/TTGTagCollectionView))  
> **Source Version**: `cad737af`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T02:15:37.837Z  
> **Learning ID**: `learn-github-zekunyan-ttgtagcollectionview`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zekunyan/TTGTagCollectionView

> **Canonical Artifact**: `07_PROJECT_LEARNING/zekunyan-ttgtagcollectionview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zekunyan/TTGTagCollectionView](https://github.com/zekunyan/TTGTagCollectionView))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T02:15:37.505Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zekunyan/TTGTagCollectionView`
- **Description**: Useful for showing text or custom view tags in a vertical or horizontal scrollable view and support Autolayout at the same time. It is highly customizable that most features of the text tag can be configured. 标签流显示控件，同时支持文字或自定义View
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1895 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Resources/render_readme_images.mjs`
```
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "/Users/tutuge/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const root = new URL("./", import.meta.url);
const chromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const pages = [
  {
    html: "promo_poster.html",
    output: "promo_poster.png",
    viewport: { width: 1920, height: 1080 },
  },
  {
    html: "quick_start_01_create.html",
    output: "quick_start_01_create.png",
    viewport: { width: 1440, height: 900 },
  },
  {
    html: "quick_start_02_style.html",
    output: "quick_start_02_style.png",
    viewport: { width: 1440, height: 900 },
  },
  {
    html: "quick_start_03_selection.html",
    output: "quick_start_03_selection.png",
    viewport: { width: 1440, height: 900 },
  },
  {
    html: "quick_start_04_layout.html",
    output: "quick_start_04_layout.png",
    viewport: { width: 1440, height: 900 },
  },
  {
    html: "concepts_poster.html",
    output: "concepts_poster.png",
    viewport: { width: 1920, height: 1080 },
  },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExecutable,
});
try {
  for (const item of pages) {
    const page = await browser.newPage({
      viewport: item.viewport,
      deviceScaleFactor: 2,
    });

    const htmlPath = new URL(item.html, root);
    await page.goto(pathToFileURL(htmlPath.pathname).toString(), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const bodyBox = await page.locator("body").boundingBox();
    if (!bodyBox || bodyBox.width === 0 || bodyBox.height === 0) {
      throw new Error(`${item.html} rendered an empty body`);
    }

    const screenshot = await page.screenshot({
      fullPage: false,
      type: "png",
      animations: "disabled",
    });

    const outputPath = new URL(item.output, root);
    await writeFile(outputPath, screenshot);
    await page.close();
    console.log(`${item.output}: ${screenshot.length} bytes`);
  }
} finally {
  await browser.close();
}

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoAnchorLayoutViewController.h`
```
//
//  TTGDemoAnchorLayoutViewController.h
//  Demo: Pure anchor-based Auto Layout.
//  The tag view is pinned with NSLayoutConstraint anchors — height is
//  derived from intrinsicContentSize.

#import <UIKit/UIKit.h>

@interface TTGDemoAnchorLayoutViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoAttributedStringTagsViewController.h`
```
//
//  TTGDemoAttributedStringTagsViewController.h
//  Demo: TTGTextTagAttributedStringContent + NSAttributedString.

#import <UIKit/UIKit.h>

@interface TTGDemoAttributedStringTagsViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoAttributedTagExamples.h`
```
//
//  TTGDemoAttributedTagExamples.h
//  Builds TTGTextTag instances with attributed content for TTGDemoAttributedStringTagsViewController.

#import <Foundation/Foundation.h>

@class TTGTextTag;

NS_ASSUME_NONNULL_BEGIN

@interface TTGDemoAttributedTagExamples : NSObject

/// Demonstration tags: mixed fonts, strikethrough, attachments, etc.
+ (NSArray<TTGTextTag *> *)allDemonstrationTags;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoAutoLayoutFormViewController.h`
```
//
//  TTGDemoAutoLayoutFormViewController.h
//  Demo: Tags embedded in a scrollable Auto Layout form.
//  Demonstrates intrinsicContentSize-driven height inside UIScrollView,
//  analogous to SwiftUI's automatic layout.

#import <UIKit/UIKit.h>

@interface TTGDemoAutoLayoutFormViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoBasicTextTagsViewController.h`
```
//
//  TTGDemoBasicTextTagsViewController.h
//  Demo: TTGTextTagCollectionView basics (two columns, styles, selection, delegate).

#import <UIKit/UIKit.h>

@interface TTGDemoBasicTextTagsViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoCustomSubviewTagsViewController.h`
```
//
//  TTGDemoCustomSubviewTagsViewController.h
//  Demo: TTGTagCollectionView with custom UIView cells as tags.

#import <UIKit/UIKit.h>

@interface TTGDemoCustomSubviewTagsViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoHorizontalScrollTagsViewController.h`
```
//
//  TTGDemoHorizontalScrollTagsViewController.h
//  Demo: Horizontal scrolling and numberOfLines row limits.

#import <UIKit/UIKit.h>

@interface TTGDemoHorizontalScrollTagsViewController : UIViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoListViewController.h`
```
//
//  TTGDemoListViewController.h
//  Demo list built without storyboard dependencies.
//

#import <UIKit/UIKit.h>

@interface TTGDemoListViewController : UITableViewController
@end

```

### Core Architecture Module: `Example/TTGTagOCExample/Demos/TTGDemoPerTagStyleViewController.h`
```
//
//  TTGDemoPerTagStyleViewController.h
//  Demo: Per-tag style, selectedStyle, and attachment.

#import <UIKit/UIKit.h>

@interface TTGDemoPerTagStyleViewController : UIViewController
@end

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #159** (2026-06-07): **Feature/swift rewrite**
  *Symptoms*: 

- **Issue #158** (2026-06-21): **performance analysis**
  *Symptoms*: Good day!  i am facing this performance issue. <img width="484" height="238" alt="Image" src="https://github.com/user-attachments/assets/2e3466a4-f486-4fa2-91d8-776bfe86ce11" /> i diagnosed it and it is because of  `[self updateMaskWithPath:path];`  in  `TTGTextTagCollectionView` file.  i tried different ways to handle it, but i cant, is someone else also facing issue ? or anyone can guide how i can get rid of this issue ?
  **Post-Mortem & Fix Analysis**:
  > Closing this as obsolete after the 3.0.0 Swift rewrite. The old Objective-C masking path has been replaced by the new Swift component/layer implementation, and layout/layer updates were reworked in the major upgrade.

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

### Incident Patch 1: `51f937d4` (2026-05-30)
**Commit Message**: Fix layout reentrancy, thread safety, layer management, and clean up project

- Remove duplicate layoutTagViews() call in layoutSubviews()
- Use setNeedsLayout/layoutIfNeeded in contentSize getter to avoid reentrancy
- Cache tag views internally to avoid repeated dataSource requests during
  hit-testing, gesture handling, and layout
- Add NSLock to protect lazy init of selectedContent/selectedStyle
- Add assertionFailure to TextTagContent base class copy(with:)
- Reuse CAShapeLayer instances for mask and border instead of recreating
- Remove shouldRasterize from shadow rendering to avoid redundant rasterization
- Add shallow-copy safety comment to AttributedStringContent
- Fix horizontal layout negative lineWidths when lines are empty
- Add TTGTagOCExample_Tests blueprint to Example scheme
- Translate Chinese test comments to English
- Switch Podfile git URLs from SSH to HTTPS
- Delete outdated .travis.yml (referenced Xcode 12.4)
- Remove legacy TTGTagCollectionView/ xcodeproj directory

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `.travis.yml` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-osx_image: xcode12.4
-language: objective-c
-script:
-- set -o pipefail
-- xcodebuild -version
-- xcodebuild -showsdks
-- xcodebuild clean build -project TTGTagCollectionView/TTGTagCollectionView.xcodeproj -alltargets ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO PROVISIONING_PROFILE_SPECIFIER="" PROVISIONING_PROFILE="" CODE_SIGNING_ALLOWED=NO | xcpretty
```

**File**: `Example/Podfile` (modified, +2/-2)
```diff
@@ -6,8 +6,8 @@ platform :ios, '16.0'
 
 target 'TTGTagOCExample' do
   pod 'TTGTagCollectionView', :path => '../'
-  pod 'Masonry', :git => 'git@github.com:SnapKit/Masonry.git', :tag => 'v1.1.0'
-  pod 'SVPullToRefresh', :git => 'git@github.com:samvermette/SVPullToRefresh.git', :tag => '0.4.1'
+  pod 'Masonry', :git => 'https://github.com/SnapKit/Masonry.git', :tag => 'v1.1.0'
+  pod 'SVPullToRefresh', :git => 'https://github.com/samvermette/SVPullToRefresh.git', :tag => '0.4.1'
 
   target 'TTGTagOCExample_Tests' do
     inherit! :search_paths
```

**File**: `Example/TTGTagOCExample.xcodeproj/xcshareddata/xcschemes/TTGTagCollectionView_Example.xcscheme` (modified, +20/-14)
```diff
@@ -15,8 +15,8 @@
             <BuildableReference
                BuildableIdentifier = "primary"
                BlueprintIdentifier = "6003F589195388D20070C39A"
-               BuildableName = "TTGTagCollectionView_Example.app"
-               BlueprintName = "TTGTagCollectionView_Example"
+               BuildableName = "TTGTagOCExample.app"
+               BlueprintName = "TTGTagOCExample"
                ReferencedContainer = "container:TTGTagOCExample.xcodeproj">
             </BuildableReference>
          </BuildActionEntry>
@@ -27,19 +27,27 @@
       selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
       selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
       shouldUseLaunchSchemeArgsEnv = "YES">
-      <Testables>
-      </Testables>
       <MacroExpansion>
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "6003F589195388D20070C39A"
-            BuildableName = "TTGTagCollectionView_Example.app"
-            BlueprintName = "TTGTagCollectionView_Example"
+            BuildableName = "TTGTagOCExample.app"
+            BlueprintName = "TTGTagOCExample"
             ReferencedContainer = "container:TTGTagOCExample.xcodeproj">
          </BuildableReference>
       </MacroExpansion>
-      <AdditionalOptions>
-      </AdditionalOptions>
+      <Testables>
+         <TestableReference
+            skipped = "NO">
+            <BuildableReference
+               BuildableIdentifier = "primary"
+               BlueprintIdentifier = "6003F5AD195388D20070C39A"
+               BuildableName = "TTGTagOCExample_Tests.xctest"
+               BlueprintName = "TTGTagOCExample_Tests"
+               ReferencedContainer = "container:TTGTagOCExample.xcodeproj">
+            </BuildableReference>
+         </TestableReference>
+      </Testables>
    </TestAction>
    <LaunchAction
       buildConfiguration = "Debug"
@@ -56,13 +64,11 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "6003F589195388D20070C39A"
-            BuildableName = "TTGTagCollectionView_Example.app"
-            BlueprintName = "TTGTagCollectionView_Example"
+            BuildableName = "TTGTagOCExample.app"
+            BlueprintName = "TTGTagOCExample"
             ReferencedContainer = "container:TTGTagOCExample.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
-      <AdditionalOptions>
-      </AdditionalOptions>
    </LaunchAction>
    <ProfileAction
       buildConfiguration = "Release"
@@ -75,8 +81,8 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "6003F589195388D20070C39A"
-            BuildableName = "TTGTagCollectionView_Example.app"
-            BlueprintName = "TTGTagCollectionView_Example"
+            BuildableName = "TTGTagOCExample.app"
+            BlueprintName = "TTGTagOCExample"
             ReferencedContainer = "container:TTGTagOCExample.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
```

**File**: `Sources/TTGTags/Layout/TagCollectionLayout.swift` (modified, +3/-1)
```diff
@@ -151,7 +151,9 @@ struct TagCollectionLayout {
 
         var maxLineWidth: CGFloat = 0
         for i in 0..<numberOfLines {
-            lineWidths[i] -= input.horizontalSpacing
+            if !lineTagIndices[i].isEmpty {
+                lineWidths[i] -= input.horizontalSpacing
+            }
             maxLineWidth = max(maxLineWidth, lineWidths[i])
         }
 
```

**File**: `Sources/TTGTags/Model/TextTag.swift` (modified, +25/-4)
```diff
@@ -42,27 +42,42 @@ public final class TextTag: NSObject, NSCopying {
     @objc public var content: TextTagContent
     @objc public var style: TextTagStyle
 
+    /// Lock protecting lazy initialization of selectedContent and selectedStyle.
+    private let propertyLock = NSLock()
+
     /// Selected state content (falls back to a copy of normal content if not set).
     @objc public var selectedContent: TextTagContent {
         get {
+            propertyLock.lock()
+            defer { propertyLock.unlock() }
             if let existing = _selectedContent { return existing }
             let fallback = (content.copy() as? TextTagContent) ?? TextTagContent()
             _selectedContent = fallback
             return fallback
         }
-        set { _selectedContent = newValue }
+        set {
+            propertyLock.lock()
+            defer { propertyLock.unlock() }
+            _selectedContent = newValue
+        }
     }
     private var _selectedContent: TextTagContent?
 
     /// Selected state style (falls back to a copy of normal style if not set).
     @objc public var selectedStyle: TextTagStyle {
         get {
+            propertyLock.lock()
+            defer { propertyLock.unlock() }
             if let existing = _selectedStyle { return existing }
             let fallback = (style.copy() as? TextTagStyle) ?? TextTagStyle()
             _selectedStyle = fallback
             return fallback
         }
-        set { _selectedStyle = newValue }
+        set {
+            propertyLock.lock()
+            defer { propertyLock.unlock() }
+            _selectedStyle = newValue
+        }
     }
     private var _selectedStyle: TextTagStyle?
 
@@ -214,8 +229,14 @@ public final class TextTag: NSObject, NSCopying {
         copy.content = (content.copy(with: zone) as? TextTagContent) ?? content
         copy.style = (style.copy(with: zone) as? TextTagStyle) ?? style
         copy.selected = selected
-        copy._selectedContent = _selectedContent?.copy(with: zone) as? TextTagContent
-        copy._selectedStyle = _selectedStyle?.copy(with: zone) as? TextTagStyle
+
+        propertyLock.lock()
+        let sc = _selectedContent
+        let ss = _selectedStyle
+        propertyLock.unlock()
+
+        copy._selectedContent = sc?.copy(with: zone) as? TextTagContent
+        copy._selectedStyle = ss?.copy(with: zone) as? TextTagStyle
         copy._isAccessibilityElement = _isAccessibilityElement
         copy.accessibilityIdentifier = accessibilityIdentifier
         copy._accessibilityLabel = _accessibilityLabel
```

**File**: `Sources/TTGTags/Model/TextTagAttributedStringContent.swift` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ public final class TextTagAttributedStringContent: TextTagContent {
 
     public override func copy(with zone: NSZone? = nil) -> Any {
         let copy = TextTagAttributedStringContent()
+        // NSAttributedString is immutable, so assignment creates a safe shared reference.
+        // If NSMutableAttributedString support is ever added, this must use mutableCopy().
         copy.attributedText = attributedText
         return copy
     }
```

**File**: `Sources/TTGTags/Model/TextTagContent.swift` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ open class TextTagContent: NSObject, NSCopying {
     }
 
     open func copy(with zone: NSZone? = nil) -> Any {
+        assertionFailure("Do not use TextTagContent directly, use a subclass instead.")
         return TextTagContent()
     }
 }
```

**File**: `Sources/TTGTags/View/Internal/TextTagComponentView.swift` (modified, +18/-14)
```diff
@@ -22,6 +22,7 @@ final class TextTagComponentView: UIView {
     }()
 
     private var borderLayer: CAShapeLayer?
+    private var maskLayer: CAShapeLayer?
 
     override init(frame: CGRect) {
         super.init(frame: frame)
@@ -155,27 +156,32 @@ final class TextTagComponentView: UIView {
     }
 
     private func updateMask(with path: UIBezierPath) {
-        let maskLayer = CAShapeLayer()
-        maskLayer.frame = bounds
-        maskLayer.path = path.cgPath
-        label.layer.mask = maskLayer
+        let layer = maskLayer ?? CAShapeLayer()
+        layer.frame = bounds
+        layer.path = path.cgPath
+        self.label.layer.mask = layer
+        maskLayer = layer
     }
 
     private func updateBorder(with path: UIBezierPath) {
         guard let style = config?.getRightfulStyle() else { return }
 
-        borderLayer?.removeFromSuperlayer()
-        let layerToUse = borderLayer ?? CAShapeLayer()
+        let layerToUse: CAShapeLayer
+        if let existing = borderLayer {
+            layerToUse = existing
+        } else {
+            layerToUse = CAShapeLayer()
+            layerToUse.fillColor = UIColor.clear.cgColor
+            layerToUse.lineCap = .round
+            layerToUse.lineJoin = .round
+            layer.addSublayer(layerToUse)
+            borderLayer = layerToUse
+        }
+
         layerToUse.frame = bounds
         layerToUse.path = path.cgPath
-        layerToUse.fillColor = UIColor.clear.cgColor
-        layerToUse.opacity = 1
         layerToUse.lineWidth = style.borderWidth
         layerToUse.strokeColor = style.borderColor.cgColor
-        layerToUse.lineCap = .round
-        layerToUse.lineJoin = .round
-        layer.addSublayer(layerToUse)
-        borderLayer = layerToUse
     }
 
     private func updateShadow(with path: UIBezierPath) {
@@ -186,8 +192,6 @@ final class TextTagComponentView: UIView {
         layer.shadowRadius = style.shadowRadius
         layer.shadowOpacity = Float(style.shadowOpacity)
         layer.shadowPath = path.cgPath
-        layer.shouldRasterize = true
-        layer.rasterizationScale = UIScreen.main.scale
     }
 
     // MARK: - Equality
```

---

### Incident Patch 2: `9257eb8d` (2026-06-14)
**Commit Message**: feat(README): Update quick start and poster

**File**: `ExampleSwift/TTGTagSwiftExample.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -12,6 +12,7 @@
 		0D0010020000000000000002 /* CustomSubviewTagsViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0D0010020000000000000001 /* CustomSubviewTagsViewController.swift */; };
 		0D0010030000000000000002 /* PullRefreshTagsViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0D0010030000000000000001 /* PullRefreshTagsViewController.swift */; };
 		0D0010040000000000000002 /* AutoLayoutFormViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0D0010040000000000000001 /* AutoLayoutFormViewController.swift */; };
+		0D0010050000000000000002 /* ScreenshotShowcaseViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0D0010050000000000000001 /* ScreenshotShowcaseViewController.swift */; };
 		175C62466C2F946ED109838C /* DemoListViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 41E7883B72E341A85F4E25BF /* DemoListViewController.swift */; };
 		4794A3FC75B17E3CBC3960A1 /* AttributedStringTagsViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = B513254137B845268F77BDF6 /* AttributedStringTagsViewController.swift */; };
 		5965DE0269160486D40F489A /* PerTagStyleViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 06A7327EA753E24A519A8122 /* PerTagStyleViewController.swift */; };
@@ -39,6 +40,7 @@
 		0D0010020000000000000001 /* CustomSubviewTagsViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomSubviewTagsViewController.swift; sourceTree = "<group>"; };
 		0D0010030000000000000001 /* PullRefreshTagsViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PullRefreshTagsViewController.swift; sourceTree = "<group>"; };
 		0D0010040000000000000001 /* AutoLayoutFormViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AutoLayoutFormViewController.swift; sourceTree = "<group>"; };
+		0D0010050000000000000001 /* ScreenshotShowcaseViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScreenshotShowcaseViewController.swift; sourceTree = "<group>"; };
 		188F07F96DA028751D15BA5B /* TagsTableViewCell.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TagsTableViewCell.swift; sourceTree = "<group>"; };
 		18FE1A9005B5D818D3FB6510 /* Pods-TTGTagSwiftExample.debug.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-TTGTagSwiftExample.debug.xcconfig"; path = "Target Support Files/Pods-TTGTagSwiftExample/Pods-TTGTagSwiftExample.debug.xcconfig"; sourceTree = "<group>"; };
 		41E7883B72E341A85F4E25BF /* DemoListViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DemoListViewController.swift; sourceTree = "<group>"; };
@@ -89,6 +91,7 @@
 			children = (
 				4EC936D899DA8ACAB40D0573 /* TagSampleData.swift */,
 				0D0010010000000000000001 /* DemoUI.swift */,
+				0D0010050000000000000001 /* ScreenshotShowcaseViewController.swift */,
 				41E7883B72E341A85F4E25BF /* DemoListViewController.swift */,
 				D099B5DDFB6061B8C83D5569 /* BasicTextTagsViewController.swift */,
 				0D0010020000000000000001 /* CustomSubviewTagsViewController.swift */,
@@ -266,6 +269,7 @@
 				BF6A36C9263BFF81000CB844 /* ViewController.swift in Sources */,
 				7C17C626C2B6BA4D69BE82A1 /* TagSampleData.swift in Sources */,
 				0D0010010000000000000002 /* DemoUI.swift in Sources */,
+				0D0010050000000000000002 /* ScreenshotShowcaseViewController.swift in Sources */,
 				175C62466C2F946ED109838C /* DemoListViewController.swift in Sources */,
 				E88646145B4D4E3624AE4124 /* BasicTextTagsViewController.swift in Sources */,
 				0D0010020000000000000002 /* CustomSubviewTagsViewController.swift in Sources */,
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/ScreenshotShowcaseViewController.swift` (added, +690/-0)
```diff
@@ -0,0 +1,690 @@
+//
+//  ScreenshotShowcaseViewController.swift
+//  TTGTagSwiftExample
+//
+
+import UIKit
+import TTGTags
+
+final class ScreenshotShowcaseViewController: UIViewController {
+
+    enum Scenario: String {
+        case posterOverview
+        case posterAttributed
+        case posterLayouts
+        case quickStartCreate
+        case quickStartStyle
+        case quickStartSelection
+        case quickStartLayout
+    }
+
+    private let scenario: Scenario
+    private let scrollView = UIScrollView()
+    private let stackView = UIStackView()
+
+    init(scenario: Scenario) {
+        self.scenario = scenario
+        super.init(nibName: nil, bundle: nil)
+    }
+
+    required init?(coder: NSCoder) {
+        fatalError("init(coder:) has not been implemented")
+    }
+
+    override func viewDidLoad() {
+        super.viewDidLoad()
+        view.backgroundColor = UIColor(red: 0.965, green: 0.976, blue: 0.988, alpha: 1)
+        setupStack()
+        buildScenario()
+    }
+
+    private func setupStack() {
+        scrollView.translatesAutoresizingMaskIntoConstraints = false
+        scrollView.alwaysBounceVertical = true
+        scrollView.showsVerticalScrollIndicator = false
+        view.addSubview(scrollView)
+
+        stackView.translatesAutoresizingMaskIntoConstraints = false
+        stackView.axis = .vertical
+        stackView.spacing = 18
+        scrollView.addSubview(stackView)
+
+        NSLayoutConstraint.activate([
+            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
+            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
+            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
+            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
+
+            stackView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 22),
+            stackView.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 18),
+            stackView.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -18),
+            stackView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28),
+        ])
+    }
+
+    private func buildScenario() {
+        switch scenario {
+        case .posterOverview:
+            addHeader("TTGTagCollectionView", subtitle: "Text tags, custom views, alignment, selection, rich style, and Auto Layout in one small UIKit component.")
+            addMetricRow()
+            addShowcasePanel(title: "Gradient text tags", subtitle: "Per-tag style: gradients, borders, shadows, padding, selected states.", tagView: gradientTags())
+            addShowcasePanel(title: "Fill alignment", subtitle: "Rows can fill space or width while preserving tag order.", tagView: fillAlignmentTags())
+            addShowcasePanel(title: "Horizontal line limits", subtitle: "One, two, or three-line horizontal collections for filters and chips.", tagView: horizontalTags())
+            addCustomViewPanel()
+        case .posterAttributed:
+            addHeader("Attributed strings", subtitle: "TextTagAttributedStringContent renders mixed fonts, color, decorations, symbols, paragraph styles, and selectable attributed text.")
+            addShowcasePanel(title: "Mixed font + color", subtitle: "Use NSAttributedString for bold, italic, monospace, color, kerning, and shadows.", tagView: attributedPrimaryTags())
+            addShowcasePanel(title: "Decorations + symbols", subtitle: "Underline, strikethrough, stroke, superscript, subscript, and SF Symbol attachments render inside tags.", tagView: attributedDecorationTags())
+            addShowcasePanel(title: "Selectable attributed content", subtitle: "Selected tags can swap both style and attributed content.", tagView: attributedSelectionTags())
+            addCodeCard("""
+            let content = TextTagAttributedStringContent(
+                attributedText: attributedString
+            )
+
+            let tag = TextTag(content: content, style: style)
+            tag.selectedContent = selectedContent
+            tagView.reload()
+            """)
+        case .posterLayouts:
+            addHeader("Layout engine", subtitle: "The same component powers wrapping tag clouds, fill-width rows, horizontal filter bars, custom UIView tags, and self-sizing cells.")
+            addShowcasePanel(title: "Fill-width rows", subtitle: "Six alignment modes cover left, center, right, expanding space, and expanding width.", tagView: fillAlignmentTags())
+            addShowcasePanel(title: "Horizontal filters", subtitle: "Set scrollDirection and numberOfLines for compact filter bars with overflow content.", tagView: horizontalTags())
+            addShowcasePanel(title: "Dense cell preview", subtitle: "Precompute content size for table/list rows and reload once per reuse pass.", tagView: denseCellTags())
+            addCust
```

**File**: `ExampleSwift/TTGTagSwiftExample/SceneDelegate.swift` (modified, +15/-1)
```diff
@@ -15,7 +15,12 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
     func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
         guard let windowScene = (scene as? UIWindowScene) else { return }
         let window = UIWindow(windowScene: windowScene)
-        let rootViewController = DemoListViewController(style: .plain)
+        let rootViewController: UIViewController
+        if let scenario = ScreenshotShowcaseViewController.Scenario.fromLaunchArguments() {
+            rootViewController = ScreenshotShowcaseViewController(scenario: scenario)
+        } else {
+            rootViewController = DemoListViewController(style: .plain)
+        }
         let navigationController = UINavigationController(rootViewController: rootViewController)
         window.rootViewController = navigationController
         window.makeKeyAndVisible()
@@ -53,3 +58,12 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
 
 }
 
+private extension ScreenshotShowcaseViewController.Scenario {
+    static func fromLaunchArguments() -> ScreenshotShowcaseViewController.Scenario? {
+        let arguments = CommandLine.arguments
+        guard let keyIndex = arguments.firstIndex(of: "--ttg-screenshot") else { return nil }
+        let valueIndex = arguments.index(after: keyIndex)
+        guard valueIndex < arguments.endIndex else { return nil }
+        return ScreenshotShowcaseViewController.Scenario(rawValue: arguments[valueIndex])
+    }
+}
```

**File**: `README.md` (modified, +77/-62)
```diff
@@ -4,33 +4,20 @@
 [![License](https://img.shields.io/cocoapods/l/TTGTagCollectionView.svg?style=flat)](http://cocoapods.org/pods/TTGTagCollectionView)
 [![Platform](https://img.shields.io/cocoapods/p/TTGTagCollectionView.svg?style=flat)](http://cocoapods.org/pods/TTGTagCollectionView)
 
-**[中文文档 →](README_CN.md)**
+**[中文文档 ->](README_CN.md)**
 
-A flexible tag collection view for iOS — show text tags or fully custom views in a vertically or horizontally scrollable container, with rich layout alignment options and AutoLayout support.
+TTGTagCollectionView is a Swift-first iOS tag layout component. Use it for filter chips, topic labels, search facets, dense table cells, custom tag views, and any UI that needs predictable wrapping or horizontal tag rows.
 
 ![TTGTagCollectionView Promo](Resources/promo_poster.png)
 
-The promo poster is generated from [Resources/promo_poster.html](Resources/promo_poster.html), so the visual can be maintained together with the README.
+## Highlights
 
-## Architecture at a Glance
-
-![TTGTagCollectionView Architecture](Resources/architecture_poster.png)
-
-The poster above is generated from [Resources/architecture_poster.html](Resources/architecture_poster.html). It summarizes the Swift-first architecture, Objective-C compatibility layer, pure layout engine, rendering flow, and the cache-aware path used for dense tag lists.
-
-## Features
-
-- **Two view types**: `TextTagCollectionView` for styled text tags, `TagCollectionView` for any custom `UIView`
-- **6 alignment modes**: left, center, right, fill by space, fill by width, fill by width except last line
-- **Vertical & horizontal** scroll directions with configurable line limits
-- **Per-tag customization**: background color, gradient, corner radius (per-corner), border, shadow, padding, size constraints
-- **Rich text support** via `NSAttributedString`
-- **Selection management**: tap-to-select, selection limit, selected state style
-- **AutoLayout friendly**: `intrinsicContentSize` auto-updates; `preferredMaxLayoutWidth` support
-- **Cache-aware layout path**: text measurement cache, pure layout result cache, and precomputed content size API for dense table/list cells
-- **Accessibility**: auto-detect mode or manual `accessibilityLabel / hint / traits`
-- **Swift-first API** with full Objective-C backward compatibility
-- **CocoaPods** and **Swift Package Manager** support
+- **Text tags or custom views**: `TextTagCollectionView` for styled text, `TagCollectionView` for arbitrary `UIView` content.
+- **Flexible layout**: vertical wrapping, horizontal scrolling, line limits, spacing, insets, and 6 alignment modes.
+- **Per-tag appearance**: gradient backgrounds, borders, shadows, corner radius, padding, size constraints, and selected states.
+- **AutoLayout friendly**: intrinsic size updates and `preferredMaxLayoutWidth` for stack views, forms, and self-sizing cells.
+- **Cache-aware performance**: text measurement cache, pure layout cache, and precomputed content-size APIs for dense lists.
+- **Swift and Objective-C**: modern Swift sources with Objective-C-compatible names and selectors.
 
 ## Requirements
 
@@ -40,15 +27,15 @@ The poster above is generated from [Resources/architecture_poster.html](Resource
 
 ## Installation
 
-### Swift Package Manager (Recommended)
+### Swift Package Manager
 
-In Xcode: **File → Add Package Dependencies**, enter:
+In Xcode, choose **File -> Add Package Dependencies** and enter:
 
-```
+```text
 https://github.com/zekunyan/TTGTagCollectionView.git
 ```
 
-Or add to `Package.swift`:
+Or add it to `Package.swift`:
 
 ```swift
 dependencies: [
@@ -64,57 +51,86 @@ pod 'TTGTagCollectionView'
 
 ## Quick Start
 
-> **3 steps to show tags on screen.** For the full API reference, scroll down to [Usage](#usage).
+The screenshots below are generated from the Swift example app running in an iOS Simulator.
 
-### Step 1 — Import and create
+### 1. Create the view
+
+![Create TextTagCollectionView](Resources/quick_start_01_create.png)
 
 ```swift
 import TTGTags
 
-let tagView = TextTagCollectionView(frame: CGRect(x: 16, y: 100, width: 320, height: 200))
+let tagView = TextTagCollectionView()
+tagView.translatesAutoresizingMaskIntoConstraints = false
 view.addSubview(tagView)
+
+NSLayoutConstraint.activate([
+    tagView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
+    tagView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
+    tagView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24)
+])
 ```
 
-### Step 2 — Build tags
+### 2. Build content plus style
 
-Each tag is a `TextTag` composed of **content** (what it says) + **style** (how it looks):
+![Build TextTag content and style](Resources/quick_start_02_style.png)
+
+Each `TextTag` is built from content and style. The same model also carries selection state, accessibility metadata, and optional attachment data.
 
 ```swift
 let content = TextTagStringContent(text: "Sw
```

**File**: `Resources/concepts_poster.html` (added, +507/-0)
```diff
@@ -0,0 +1,507 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>TTGTagCollectionView Concepts</title>
+  <style>
+    :root {
+      --ink: #111827;
+      --muted: #607086;
+      --line: rgba(17, 24, 39, 0.12);
+      --blue: #0a84ff;
+      --teal: #16a394;
+      --teal-dark: #0f8f82;
+      --green: #22a06b;
+      --orange: #f97316;
+      --purple: #6256f6;
+      --rose: #f43f5e;
+      --surface: rgba(255, 255, 255, 0.9);
+      --surface-soft: rgba(246, 249, 253, 0.94);
+      --dark: #101828;
+      --shadow: 0 30px 90px rgba(22, 34, 51, 0.16);
+    }
+
+    * { box-sizing: border-box; }
+
+    html,
+    body {
+      width: 100%;
+      min-height: 100%;
+      margin: 0;
+      background: #dfe7f1;
+      color: var(--ink);
+      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
+    }
+
+    body {
+      display: grid;
+      place-items: center;
+    }
+
+    .poster {
+      width: 1920px;
+      height: 1080px;
+      position: relative;
+      overflow: hidden;
+      background:
+        radial-gradient(circle at 18% 18%, rgba(10, 132, 255, 0.12), transparent 34%),
+        radial-gradient(circle at 88% 84%, rgba(22, 163, 148, 0.16), transparent 36%),
+        linear-gradient(135deg, #f8fbff 0%, #edf3fa 100%);
+    }
+
+    .poster::before {
+      content: "";
+      position: absolute;
+      inset: 0;
+      background-image:
+        radial-gradient(circle, rgba(96, 112, 134, 0.22) 1.4px, transparent 1.6px),
+        linear-gradient(rgba(17, 24, 39, 0.035) 1px, transparent 1px),
+        linear-gradient(90deg, rgba(17, 24, 39, 0.035) 1px, transparent 1px);
+      background-size: 24px 24px, 56px 56px, 56px 56px;
+      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.62), transparent 96%);
+      pointer-events: none;
+    }
+
+    .layout {
+      position: relative;
+      z-index: 1;
+      height: 100%;
+      display: grid;
+      grid-template-columns: 560px 1fr;
+      gap: 54px;
+      padding: 70px 86px;
+    }
+
+    .left {
+      min-width: 0;
+      display: flex;
+      flex-direction: column;
+      justify-content: space-between;
+    }
+
+    .eyebrow {
+      width: fit-content;
+      padding: 12px 18px;
+      border: 1px solid rgba(10, 132, 255, 0.2);
+      border-radius: 999px;
+      background: rgba(255, 255, 255, 0.78);
+      color: #0b63ce;
+      font-size: 22px;
+      font-weight: 760;
+      box-shadow: 0 16px 40px rgba(10, 132, 255, 0.08);
+    }
+
+    h1 {
+      margin: 34px 0 0;
+      max-width: 520px;
+      font-size: 76px;
+      line-height: 0.98;
+      letter-spacing: 0;
+      font-weight: 880;
+    }
+
+    .lead {
+      max-width: 520px;
+      margin: 26px 0 0;
+      color: var(--muted);
+      font-size: 28px;
+      line-height: 1.32;
+      font-weight: 560;
+    }
+
+    .phone {
+      width: 250px;
+      height: 544px;
+      padding: 18px;
+      border-radius: 54px;
+      background: var(--dark);
+      box-shadow: var(--shadow);
+      transform: rotate(-2.5deg);
+      align-self: center;
+      margin-top: 18px;
+    }
+
+    .phone img {
+      width: 100%;
+      height: 100%;
+      display: block;
+      object-fit: cover;
+      object-position: top center;
+      border-radius: 38px;
+      background: #fff;
+    }
+
+    .note {
+      margin-top: 22px;
+      display: grid;
+      grid-template-columns: 12px 1fr;
+      gap: 12px;
+      align-items: start;
+      color: var(--muted);
+      font-size: 19px;
+      line-height: 1.32;
+      font-weight: 620;
+    }
+
+    .note::before {
+      content: "";
+      width: 12px;
+      height: 12px;
+      margin-top: 7px;
+      border-radius: 50%;
+      background: var(--teal);
+    }
+
+    .diagram {
+      position: relative;
+      min-width: 0;
+      height: 100%;
+      display: grid;
+      grid-template-columns: 1fr 372px;
+      gap: 34px;
+      align-items: stretch;
+    }
+
+    .flow {
+      position: relative;
+      min-width: 0;
+      padding-top: 24px;
+    }
+
+    .block {
+      position: relative;
+      border: 1px solid var(--line);
+      border-radius: 22px;
+      background: var(--surface);
+      box-shadow: 0 20px 60px rgba(22, 34, 51, 0.1);
+    }
+
+    .collection {
+      padding: 26px;
+    }
+
+    .block-title {
+      display: flex;
+      align-items: center;
+      justify-content: space-between;
+      gap: 16px;
+      margin-bottom: 22px;
+    }
+
+    .class-name {
+      font-size: 30px;
+      line-height: 1;
+      font-weight: 860;
+      letter-spacing: 0;
+    }
+
+    .class-role {
+      color: var(--muted);
+      font-size: 17px;
+      font-weight: 680;
+      white-space: nowrap;
+    }
+
+    .tags {
+      display: grid;
+      grid-template-columns: repeat(3, minmax(0, 1fr));
+      gap: 18px;
+    }
+
+    .tag-card {
+      min-height: 188px;
+      pa
```

**File**: `Resources/promo_poster.html` (modified, +173/-583)
```diff
@@ -7,50 +7,43 @@
   <style>
     :root {
       --ink: #111827;
-      --muted: #687385;
-      --subtle: #eef2f7;
-      --panel: #ffffff;
-      --panel-soft: #f7f9fc;
+      --muted: #5f6b7a;
+      --line: rgba(17, 24, 39, 0.12);
       --blue: #0a84ff;
-      --blue-deep: #1463d8;
-      --violet: #635bff;
-      --teal: #0aa6a6;
-      --green: #28a745;
-      --amber: #f2a900;
-      --rose: #eb4d70;
-      --line: rgba(17, 24, 39, 0.1);
-      --shadow: 0 32px 90px rgba(30, 42, 64, 0.14);
+      --green: #22a06b;
+      --orange: #f97316;
+      --panel: #ffffff;
+      --soft: #f4f7fb;
+      --dark: #101828;
+      --shadow: 0 34px 90px rgba(22, 34, 51, 0.18);
     }
 
-    * {
-      box-sizing: border-box;
-    }
+    * { box-sizing: border-box; }
 
     html,
     body {
       width: 100%;
       min-height: 100%;
       margin: 0;
-      background: #dfe6ef;
+      background: #dfe7f1;
       font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
       color: var(--ink);
     }
 
     body {
       display: grid;
       place-items: center;
-      padding: 0;
     }
 
     .poster {
-      position: relative;
       width: 1920px;
       height: 1080px;
+      position: relative;
       overflow: hidden;
       background:
-        linear-gradient(135deg, rgba(10, 132, 255, 0.08), transparent 34%),
-        linear-gradient(315deg, rgba(10, 166, 166, 0.12), transparent 36%),
-        #f6f8fb;
+        radial-gradient(circle at 18% 12%, rgba(10, 132, 255, 0.14), transparent 34%),
+        radial-gradient(circle at 88% 82%, rgba(34, 160, 107, 0.14), transparent 36%),
+        linear-gradient(135deg, #f8fbff 0%, #edf3fa 100%);
     }
 
     .poster::before {
@@ -60,22 +53,22 @@
       background-image:
         linear-gradient(rgba(17, 24, 39, 0.055) 1px, transparent 1px),
         linear-gradient(90deg, rgba(17, 24, 39, 0.055) 1px, transparent 1px);
-      background-size: 56px 56px;
-      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.6), transparent 82%);
+      background-size: 54px 54px;
+      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent 86%);
       pointer-events: none;
     }
 
-    .content {
+    .layout {
       position: relative;
       z-index: 1;
       height: 100%;
-      padding: 76px 96px 78px;
       display: grid;
-      grid-template-columns: 620px 1fr;
-      gap: 72px;
+      grid-template-columns: 650px 1fr;
+      gap: 54px;
+      padding: 78px 98px;
     }
 
-    .hero {
+    .copy {
       display: flex;
       flex-direction: column;
       justify-content: space-between;
@@ -87,681 +80,278 @@
       padding: 14px 20px;
       border: 1px solid rgba(10, 132, 255, 0.18);
       border-radius: 999px;
-      background: rgba(255, 255, 255, 0.74);
-      color: var(--blue-deep);
+      background: rgba(255, 255, 255, 0.76);
+      color: #0b63ce;
       font-size: 24px;
       font-weight: 760;
-      letter-spacing: 0;
-      box-shadow: 0 14px 40px rgba(10, 132, 255, 0.08);
+      box-shadow: 0 16px 40px rgba(10, 132, 255, 0.1);
     }
 
     h1 {
-      margin: 46px 0 0;
-      font-size: 84px;
+      margin: 38px 0 0;
+      font-size: 76px;
       line-height: 0.98;
       letter-spacing: 0;
-      font-weight: 860;
-      max-width: 620px;
-    }
-
-    h1 span {
-      display: block;
+      font-weight: 880;
+      max-width: 680px;
     }
 
     .lead {
-      margin: 34px 0 0;
+      margin: 28px 0 0;
       color: var(--muted);
       font-size: 32px;
-      line-height: 1.32;
-      font-weight: 520;
-      max-width: 590px;
+      line-height: 1.33;
+      font-weight: 540;
+      max-width: 650px;
     }
 
-    .feature-grid {
-      margin-top: 52px;
+    .features {
+      margin-top: 38px;
       display: grid;
       grid-template-columns: repeat(2, minmax(0, 1fr));
       gap: 18px;
     }
 
     .feature {
-      min-height: 126px;
-      padding: 24px;
+      min-height: 118px;
+      padding: 22px;
       border: 1px solid var(--line);
-      border-radius: 22px;
-      background: rgba(255, 255, 255, 0.72);
-      box-shadow: 0 20px 44px rgba(40, 54, 80, 0.08);
+      border-radius: 18px;
+      background: rgba(255, 255, 255, 0.78);
+      box-shadow: 0 18px 46px rgba(40, 54, 80, 0.08);
     }
 
     .feature strong {
       display: block;
-      font-size: 28px;
+      font-size: 25px;
       line-height: 1.1;
-      letter-spacing: 0;
+      font-weight: 820;
     }
 
     .feature span {
       display: block;
       margin-top: 10px;
       color: var(--muted);
-      font-size: 20px;
-      line-height: 1.28;
+      font-size: 18px;
+      line-height: 1.25;
       font-weight: 560;
     }
 
     .footer {
       display: flex;
       align-items: center;
-      gap: 18px;
+      gap: 16px;
       color: var(--muted);
       font-size: 22px;
       font-weight: 650;
     }
 
-    .footer b {
-      color: var(--ink);
-    }
-
-    .dot {
-      width: 8px;
-      height: 8px
```

**File**: `Resources/quick_start_01_create.html` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Quick Start 01 - Create</title>
+  <link rel="stylesheet" href="quick_start_review.css">
+</head>
+<body>
+  <main class="page">
+    <section class="copy">
+      <p class="eyebrow">Quick Start 01</p>
+      <h1>Create the tag view</h1>
+      <p class="lead">Start with a single <code>TextTagCollectionView</code>. Add it to your view hierarchy like any other UIKit view.</p>
+      <pre><code>import TTGTags
+
+let tagView = TextTagCollectionView()
+tagView.translatesAutoresizingMaskIntoConstraints = false
+view.addSubview(tagView)
+
+NSLayoutConstraint.activate([
+    tagView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
+    tagView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
+    tagView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24)
+])</code></pre>
+    </section>
+    <section class="phone">
+      <img src="screenshots/quick-start-create.png" alt="Create TextTagCollectionView simulator screenshot">
+    </section>
+  </main>
+</body>
+</html>
```

**File**: `Resources/quick_start_02_style.html` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Quick Start 02 - Style</title>
+  <link rel="stylesheet" href="quick_start_review.css">
+</head>
+<body>
+  <main class="page">
+    <section class="copy">
+      <p class="eyebrow">Quick Start 02</p>
+      <h1>Build content plus style</h1>
+      <p class="lead">A <code>TextTag</code> combines content and style. Each tag can own an independent appearance.</p>
+      <pre><code>let content = TextTagStringContent(text: "Swift")
+content.textFont = .boldSystemFont(ofSize: 14)
+content.textColor = .white
+
+let style = TextTagStyle()
+style.enableGradientBackground = true
+style.gradientBackgroundStartColor = .systemBlue
+style.gradientBackgroundEndColor = .systemPurple
+style.cornerRadius = 12
+style.extraSpace = CGSize(width: 14, height: 8)
+
+let tag = TextTag(content: content, style: style)</code></pre>
+    </section>
+    <section class="phone">
+      <img src="screenshots/quick-start-style.png" alt="TextTagStyle simulator screenshot">
+    </section>
+  </main>
+</body>
+</html>
```

---

### Incident Patch 3: `cca66ff5` (2026-06-06)
**Commit Message**: Add Auto Layout, UIStackView, SwiftUI support and 4 layout demos

Core library improvements:
- Enhance intrinsicContentSize to compute height at a known width
  (mirroring UILabel.preferredMaxLayoutWidth behavior)
- Add systemLayoutSizeFitting override for two-pass Auto Layout
- preferredMaxLayoutWidth now invalidates intrinsicContentSize
- Add TagCloudView (UIViewRepresentable) for SwiftUI integration

New demo view controllers (Swift example):
- AnchorLayoutDemoViewController: pure anchor constraint layout
- StackViewDemoViewController: embedded in UIStackView with
  distribution, alignment, and isHidden auto-collapse
- SelfSizingDemoViewController: intrinsicContentSize auto-adjusts
  height as tags are added/removed
- SwiftUIDemoViewController: SwiftUI integration via TagCloudView

All 18 unit tests pass. Swift example builds successfully.

**File**: `ExampleSwift/TTGTagSwiftExample.xcodeproj/project.pbxproj` (modified, +16/-0)
```diff
@@ -15,6 +15,10 @@
 		70D23D5E02A972A87D7B986F /* TagsTableViewCell.swift in Sources */ = {isa = PBXBuildFile; fileRef = 188F07F96DA028751D15BA5B /* TagsTableViewCell.swift */; };
 		7C17C626C2B6BA4D69BE82A1 /* TagSampleData.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4EC936D899DA8ACAB40D0573 /* TagSampleData.swift */; };
 		99663A1F494E06EC80CEEBEE /* ProgrammaticTagsViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = DCA62D159FC7C68941F02179 /* ProgrammaticTagsViewController.swift */; };
+		A1B2C3D4E5F60012 /* AnchorLayoutDemoViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D4E5F60011 /* AnchorLayoutDemoViewController.swift */; };
+		A1B2C3D4E5F60022 /* StackViewDemoViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D4E5F60021 /* StackViewDemoViewController.swift */; };
+		A1B2C3D4E5F60032 /* SelfSizingDemoViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D4E5F60031 /* SelfSizingDemoViewController.swift */; };
+		A1B2C3D4E5F60042 /* SwiftUIDemoViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D4E5F60041 /* SwiftUIDemoViewController.swift */; };
 		B8B00C9B11EE54EFBC8E5412 /* HorizontalScrollTagsViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A6CD87FCE8B2B2C11597F038 /* HorizontalScrollTagsViewController.swift */; };
 		BF6A36C5263BFF81000CB844 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = BF6A36C4263BFF81000CB844 /* AppDelegate.swift */; };
 		BF6A36C7263BFF81000CB844 /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = BF6A36C6263BFF81000CB844 /* SceneDelegate.swift */; };
@@ -34,6 +38,10 @@
 		4EC936D899DA8ACAB40D0573 /* TagSampleData.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TagSampleData.swift; sourceTree = "<group>"; };
 		60C4B828C760CA54D1F6E646 /* TagAttachmentViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TagAttachmentViewController.swift; sourceTree = "<group>"; };
 		6F9ABBC9733CA17B850DB303 /* Pods_TTGTagSwiftExample.framework */ = {isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = Pods_TTGTagSwiftExample.framework; sourceTree = BUILT_PRODUCTS_DIR; };
+		A1B2C3D4E5F60011 /* AnchorLayoutDemoViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnchorLayoutDemoViewController.swift; sourceTree = "<group>"; };
+		A1B2C3D4E5F60021 /* StackViewDemoViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = StackViewDemoViewController.swift; sourceTree = "<group>"; };
+		A1B2C3D4E5F60031 /* SelfSizingDemoViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SelfSizingDemoViewController.swift; sourceTree = "<group>"; };
+		A1B2C3D4E5F60041 /* SwiftUIDemoViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwiftUIDemoViewController.swift; sourceTree = "<group>"; };
 		A6CD87FCE8B2B2C11597F038 /* HorizontalScrollTagsViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HorizontalScrollTagsViewController.swift; sourceTree = "<group>"; };
 		B513254137B845268F77BDF6 /* AttributedStringTagsViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AttributedStringTagsViewController.swift; sourceTree = "<group>"; };
 		B971BE1FE61B2A2965FBFD9E /* TagsInTableViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TagsInTableViewController.swift; sourceTree = "<group>"; };
@@ -83,6 +91,10 @@
 				60C4B828C760CA54D1F6E646 /* TagAttachmentViewController.swift */,
 				188F07F96DA028751D15BA5B /* TagsTableViewCell.swift */,
 				B971BE1FE61B2A2965FBFD9E /* TagsInTableViewController.swift */,
+				A1B2C3D4E5F60011 /* AnchorLayoutDemoViewController.swift */,
+				A1B2C3D4E5F60021 /* StackViewDemoViewController.swift */,
+				A1B2C3D4E5F60031 /* SelfSizingDemoViewController.swift */,
+				A1B2C3D4E5F60041 /* SwiftUIDemoViewController.swift */,
 			);
 			path = Demos;
 			sourceTree = "<group>";
@@ -254,6 +266,10 @@
 				002461456F242B71B30AD0C2 /* TagAttachmentViewController.swift in Sources */,
 				70D23D5E02A972A87D7B986F /* TagsTableViewCell.swift in Sources */,
 				5A38A1349C3DD9A9DA8F6C1B /* TagsInTableViewController.swift in Sources */,
+				A1B2C3D4E5F60012 /* AnchorLayoutDemoViewController.swift in Sources */,
+				A1B2C3D4E5F60022 /* StackViewDemoViewController.swift in Sources */,
+				A1B2C3D4E5F60032 /* SelfSizingDemoViewController.swift in Sources */,
+				A1B2C3D4E5F60042 /* SwiftUIDemoViewController.swift in Sources */,
 				BF6A36C5263BFF81000CB844 /* AppDelegate.swift in Sources */,
 				BF6A36C7263BFF81000CB844 /* SceneDelegate.swift in Sources */,
 			);
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/AnchorLayoutDemoViewController.swift` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+//
+//  AnchorLayoutDemoViewController.swift
+//  TTGTagSwiftExample
+//
+//  Demo 1: Pure anchor-based Auto Layout.
+//  The tag view is pinned with NSLayoutConstraint anchors — no frame math,
+//  no manual height. The height is derived from intrinsicContentSize.
+
+import UIKit
+import TTGTags
+
+class AnchorLayoutDemoViewController: UIViewController {
+
+    private let tagView = TextTagCollectionView()
+
+    override func viewDidLoad() {
+        super.viewDidLoad()
+        view.backgroundColor = .systemBackground
+        setupTagView()
+        populateTags()
+    }
+
+    private func setupTagView() {
+        tagView.translatesAutoresizingMaskIntoConstraints = false
+        tagView.backgroundColor = .systemGray6
+        tagView.horizontalSpacing = 8
+        tagView.verticalSpacing = 8
+        tagView.contentInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
+        view.addSubview(tagView)
+
+        // Pin to safe area with anchors — height is auto-calculated via intrinsicContentSize
+        NSLayoutConstraint.activate([
+            tagView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
+            tagView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
+            tagView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
+        ])
+    }
+
+    private func populateTags() {
+        let words = TagSampleData.shortSampleWords
+        let colors: [UIColor] = [.systemBlue, .systemGreen, .systemOrange, .systemPurple, .systemPink]
+
+        for (index, word) in words.enumerated() {
+            let content = TextTagStringContent(text: word)
+            content.textFont = .systemFont(ofSize: 14, weight: .medium)
+            content.textColor = .white
+
+            let style = TextTagStyle()
+            style.backgroundColor = colors[index % colors.count]
+            style.cornerRadius = 14
+            style.extraSpace = CGSize(width: 12, height: 6)
+
+            let tag = TextTag(content: content, style: style)
+            tagView.add(tag: tag)
+        }
+
+        tagView.reload()
+    }
+}
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/DemoListViewController.swift` (modified, +4/-0)
```diff
@@ -20,6 +20,10 @@ class DemoListViewController: UITableViewController {
         DemoItem(title: "Programmatic (Auto Layout)", viewControllerType: ProgrammaticTagsViewController.self),
         DemoItem(title: "Bind data to tag", viewControllerType: TagAttachmentViewController.self),
         DemoItem(title: "Tags in UITableViewCell", viewControllerType: TagsInTableViewController.self),
+        DemoItem(title: "🔗 Anchor constraint layout", viewControllerType: AnchorLayoutDemoViewController.self),
+        DemoItem(title: "📦 UIStackView integration", viewControllerType: StackViewDemoViewController.self),
+        DemoItem(title: "📐 Self-sizing (intrinsicContentSize)", viewControllerType: SelfSizingDemoViewController.self),
+        DemoItem(title: "⚡ SwiftUI (TagCloudView)", viewControllerType: SwiftUIDemoViewController.self),
     ]
 
     override func viewDidLoad() {
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/SelfSizingDemoViewController.swift` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+//
+//  SelfSizingDemoViewController.swift
+//  TTGTagSwiftExample
+//
+//  Demo 3: Self-sizing via intrinsicContentSize.
+//  Demonstrates that the view's height automatically adjusts as content
+//  changes — no manual height calculation required.
+
+import UIKit
+import TTGTags
+
+class SelfSizingDemoViewController: UIViewController {
+
+    private let tagView = TextTagCollectionView()
+    private var allWords: [String] = []
+    private var currentCount: Int = 3
+
+    override func viewDidLoad() {
+        super.viewDidLoad()
+        view.backgroundColor = .systemBackground
+        allWords = TagSampleData.shortSampleWords
+        setupUI()
+        updateTags()
+    }
+
+    // MARK: - Setup
+
+    private func setupUI() {
+        // Title label
+        let titleLabel = UILabel()
+        titleLabel.text = "intrinsicContentSize Demo"
+        titleLabel.font = .systemFont(ofSize: 18, weight: .bold)
+        titleLabel.textAlignment = .center
+
+        // Description label
+        let descLabel = UILabel()
+        descLabel.text = "The gray view's height adjusts automatically as tags are added or removed. No manual height calculation."
+        descLabel.font = .systemFont(ofSize: 14)
+        descLabel.textColor = .secondaryLabel
+        descLabel.numberOfLines = 0
+        descLabel.textAlignment = .center
+
+        // Tag view
+        tagView.backgroundColor = .systemGray6
+        tagView.layer.cornerRadius = 8
+        tagView.horizontalSpacing = 6
+        tagView.verticalSpacing = 6
+        tagView.contentInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
+
+        // Control buttons
+        let addBtn = UIButton(type: .system)
+        addBtn.setTitle("Add Tag (+)", for: .normal)
+        addBtn.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
+        addBtn.addTarget(self, action: #selector(addTag), for: .touchUpInside)
+
+        let removeBtn = UIButton(type: .system)
+        removeBtn.setTitle("Remove Tag (−)", for: .normal)
+        removeBtn.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
+        removeBtn.addTarget(self, action: #selector(removeTag), for: .touchUpInside)
+
+        let buttonStack = UIStackView(arrangedSubviews: [addBtn, removeBtn])
+        buttonStack.axis = .horizontal
+        buttonStack.distribution = .fillEqually
+        buttonStack.spacing = 16
+
+        // Arrange everything in a vertical stack
+        let mainStack = UIStackView(arrangedSubviews: [titleLabel, descLabel, tagView, buttonStack])
+        mainStack.axis = .vertical
+        mainStack.spacing = 16
+        mainStack.setCustomSpacing(8, after: titleLabel)
+        mainStack.setCustomSpacing(24, after: descLabel)
+        mainStack.setCustomSpacing(24, after: tagView)
+        mainStack.translatesAutoresizingMaskIntoConstraints = false
+
+        view.addSubview(mainStack)
+        NSLayoutConstraint.activate([
+            mainStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
+            mainStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
+            mainStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
+        ])
+    }
+
+    // MARK: - Actions
+
+    @objc private func addTag() {
+        guard currentCount < allWords.count else { return }
+        currentCount += 1
+        updateTags()
+    }
+
+    @objc private func removeTag() {
+        guard currentCount > 1 else { return }
+        currentCount -= 1
+        updateTags()
+    }
+
+    private func updateTags() {
+        tagView.removeAllTags()
+
+        let words = Array(allWords.prefix(currentCount))
+        for word in words {
+            let content = TextTagStringContent(text: word)
+            content.textFont = .systemFont(ofSize: 14, weight: .medium)
+            content.textColor = .white
+
+            let style = TextTagStyle()
+            style.backgroundColor = .systemIndigo
+            style.cornerRadius = 14
+            style.extraSpace = CGSize(width: 12, height: 6)
+
+            tagView.add(tag: TextTag(content: content, style: style))
+        }
+
+        // reload() triggers invalidateIntrinsicContentSize internally,
+        // so the StackView/Auto Layout picks up the new height automatically.
+        tagView.reload()
+    }
+}
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/StackViewDemoViewController.swift` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+//
+//  StackViewDemoViewController.swift
+//  TTGTagSwiftExample
+//
+//  Demo 2: TextTagCollectionView embedded in UIStackView.
+//  Shows that the component works seamlessly with StackView's
+//  distribution, alignment, and spacing — including isHidden collapse.
+
+import UIKit
+import TTGTags
+
+class StackViewDemoViewController: UIViewController {
+
+    private let stackView = UIStackView()
+    private let topicTagView = TextTagCollectionView()
+    private let skillTagView = TextTagCollectionView()
+    private let hobbyTagView = TextTagCollectionView()
+
+    override func viewDidLoad() {
+        super.viewDidLoad()
+        view.backgroundColor = .systemBackground
+        setupStackView()
+        setupTagViews()
+        populateTags()
+    }
+
+    // MARK: - Setup
+
+    private func setupStackView() {
+        stackView.axis = .vertical
+        stackView.spacing = 16
+        stackView.alignment = .fill
+        stackView.translatesAutoresizingMaskIntoConstraints = false
+        view.addSubview(stackView)
+
+        NSLayoutConstraint.activate([
+            stackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
+            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
+            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
+        ])
+    }
+
+    private func setupTagViews() {
+        configure(tagView: topicTagView, title: "Topics")
+        configure(tagView: skillTagView, title: "Skills")
+        configure(tagView: hobbyTagView, title: "Hobbies")
+    }
+
+    private func configure(tagView: TextTagCollectionView, title: String) {
+        tagView.backgroundColor = .systemGray6
+        tagView.horizontalSpacing = 6
+        tagView.verticalSpacing = 6
+        tagView.contentInset = UIEdgeInsets(top: 6, left: 6, bottom: 6, right: 6)
+
+        let label = UILabel()
+        label.text = title
+        label.font = .systemFont(ofSize: 16, weight: .semibold)
+
+        let groupStack = UIStackView(arrangedSubviews: [label, tagView])
+        groupStack.axis = .vertical
+        groupStack.spacing = 6
+        groupStack.setCustomSpacing(6, after: label)
+        stackView.addArrangedSubview(groupStack)
+    }
+
+    // MARK: - Data
+
+    private func populateTags() {
+        addTags(["iOS", "Swift", "UIKit", "SwiftUI", "CoreData"], to: topicTagView, color: .systemBlue)
+        addTags(["Auto Layout", "StackView", "GCD", "ARC", "Metal", "Combine"], to: skillTagView, color: .systemGreen)
+        addTags(["Photography", "Hiking", "Reading", "Cooking", "Travel"], to: hobbyTagView, color: .systemOrange)
+
+        topicTagView.reload()
+        skillTagView.reload()
+        hobbyTagView.reload()
+
+        // Add toggle button to demonstrate isHidden auto-collapse in StackView
+        let toggleButton = UIButton(type: .system)
+        toggleButton.setTitle("Toggle Hobbies visibility", for: .normal)
+        toggleButton.addTarget(self, action: #selector(toggleHobbies), for: .touchUpInside)
+        stackView.addArrangedSubview(toggleButton)
+    }
+
+    private func addTags(_ texts: [String], to tagView: TextTagCollectionView, color: UIColor) {
+        for text in texts {
+            let content = TextTagStringContent(text: text)
+            content.textFont = .systemFont(ofSize: 13, weight: .medium)
+            content.textColor = .white
+
+            let style = TextTagStyle()
+            style.backgroundColor = color
+            style.cornerRadius = 12
+            style.extraSpace = CGSize(width: 10, height: 4)
+
+            tagView.add(tag: TextTag(content: content, style: style))
+        }
+    }
+
+    @objc private func toggleHobbies() {
+        hobbyTagView.superview?.isHidden.toggle()
+    }
+}
```

**File**: `ExampleSwift/TTGTagSwiftExample/Demos/SwiftUIDemoViewController.swift` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+//
+//  SwiftUIDemoViewController.swift
+//  TTGTagSwiftExample
+//
+//  Demo 4: SwiftUI integration via TagCloudView (UIViewRepresentable).
+//  Hosts a SwiftUI view inside UIKit using UIHostingController.
+
+import UIKit
+import SwiftUI
+import TTGTags
+
+class SwiftUIDemoViewController: UIViewController {
+
+    override func viewDidLoad() {
+        super.viewDidLoad()
+        view.backgroundColor = .systemBackground
+
+        let swiftUIView = SwiftUIDemoView()
+        let hostingController = UIHostingController(rootView: swiftUIView)
+
+        addChild(hostingController)
+        view.addSubview(hostingController.view)
+        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
+        NSLayoutConstraint.activate([
+            hostingController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
+            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
+            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
+            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
+        ])
+        hostingController.didMove(toParent: self)
+    }
+}
+
+// MARK: - SwiftUI View
+
+import SwiftUI
+
+struct SwiftUIDemoView: View {
+    @State private var extraTags: [String] = []
+
+    private let baseTags = ["Swift", "Kotlin", "Dart", "Rust", "Go", "Python", "TypeScript"]
+
+    var allTags: [String] { baseTags + extraTags }
+
+    var body: some View {
+        ScrollView {
+            VStack(alignment: .leading, spacing: 24) {
+
+                // Section 1: Basic tag cloud
+                VStack(alignment: .leading, spacing: 8) {
+                    Text("Programming Languages")
+                        .font(.headline)
+
+                    TagCloudView(tags: allTags) { tag in
+                        if let content = tag.content as? TextTagStringContent {
+                            content.textFont = .systemFont(ofSize: 14, weight: .medium)
+                            content.textColor = .white
+                        }
+                        tag.style.backgroundColor = .systemBlue
+                        tag.style.cornerRadius = 14
+                        tag.style.extraSpace = CGSize(width: 12, height: 6)
+                    }
+                    .background(Color(.systemGray6))
+                    .cornerRadius(8)
+                }
+                .padding(.horizontal)
+
+                // Section 2: Different alignment
+                VStack(alignment: .leading, spacing: 8) {
+                    Text("Center Aligned")
+                        .font(.headline)
+
+                    TagCloudView(
+                        tags: ["One", "Two", "Three"],
+                        alignment: .center
+                    ) { tag in
+                        if let content = tag.content as? TextTagStringContent {
+                            content.textFont = .systemFont(ofSize: 14, weight: .medium)
+                            content.textColor = .white
+                        }
+                        tag.style.backgroundColor = .systemGreen
+                        tag.style.cornerRadius = 14
+                        tag.style.extraSpace = CGSize(width: 12, height: 6)
+                    }
+                    .background(Color(.systemGray6))
+                    .cornerRadius(8)
+                }
+                .padding(.horizontal)
+
+                // Section 3: Add tag dynamically
+                VStack(alignment: .leading, spacing: 8) {
+                    Text("Dynamic (\(allTags.count) tags)")
+                        .font(.headline)
+
+                    Button("Add Random Tag") {
+                        let randomTag = "Tag \(Int.random(in: 100...999))"
+                        extraTags.append(randomTag)
+                    }
+                    .buttonStyle(.borderedProminent)
+                }
+                .padding(.horizontal)
+
+                // Section 4: Horizontal scroll
+                VStack(alignment: .leading, spacing: 8) {
+                    Text("Horizontal Scroll")
+                        .font(.headline)
+
+                    TagCloudView(
+                        tags: allTags,
+                        scrollDirection: .horizontal,
+                        numberOfLines: 1
+                    ) { tag in
+                        if let content = tag.content as? TextTagStringContent {
+                            content.textFont = .systemFont(ofSize: 13, weight: .medium)
+                            content.textColor = .white
+                        }
+                        tag.style.backgroundColor = .systemOrange
+                        tag.style.cornerRadius = 12
+                        tag.style.extraSpace = CGSize(width: 10, height: 4)
+                    }
+                    .frame(height: 44)
+                    .background(Color(.systemGray6))
+                
```

**File**: `Sources/TTGTags/View/TagCollectionView.swift` (modified, +87/-3)
```diff
@@ -125,8 +125,13 @@ public final class TagCollectionView: UIView {
     }
 
     /// Maximum width used when manually calculating height.
+    /// Also used by `intrinsicContentSize` to compute height at a known width
+    /// (mirroring `UILabel.preferredMaxLayoutWidth`).
     @objc public var preferredMaxLayoutWidth: CGFloat = 0 {
-        didSet { setNeedsLayoutTagViews() }
+        didSet {
+            setNeedsLayoutTagViews()
+            invalidateIntrinsicContentSize()
+        }
     }
 
     @objc public var showsHorizontalScrollIndicator: Bool {
@@ -184,7 +189,8 @@ public final class TagCollectionView: UIView {
     public override func layoutSubviews() {
         super.layoutSubviews()
 
-        if !scrollView.frame.equalTo(bounds) {
+        let boundsChanged = !scrollView.frame.equalTo(bounds)
+        if boundsChanged {
             scrollView.frame = bounds
             setNeedsLayoutTagViews()
         }
@@ -194,10 +200,53 @@ public final class TagCollectionView: UIView {
         if !containerView.frame.size.equalTo(scrollView.contentSize) {
             containerView.frame = CGRect(origin: .zero, size: scrollView.contentSize)
         }
+
+        // When bounds width changes, intrinsic height may change too
+        if boundsChanged {
+            invalidateIntrinsicContentSize()
+        }
     }
 
+    /// Intrinsic content size for Auto Layout.
+    ///
+    /// When `preferredMaxLayoutWidth` is set, the height is computed at that width
+    /// (mirroring `UILabel.preferredMaxLayoutWidth` behaviour). Otherwise the
+    /// current `bounds.width` is used, which is correct once Auto Layout has
+    /// assigned a concrete width.
     public override var intrinsicContentSize: CGSize {
-        return scrollView.contentSize
+        let measurementWidth: CGFloat
+        if preferredMaxLayoutWidth > 0 {
+            measurementWidth = preferredMaxLayoutWidth
+        } else if bounds.width > 0 {
+            measurementWidth = bounds.width
+        } else {
+            return .zero
+        }
+        return measureSize(forWidth: measurementWidth)
+    }
+
+    /// Two-pass Auto Layout measurement.
+    ///
+    /// Called by the system when it needs to know the view's size for a given
+    /// `targetSize` (typically a known width, height = `.greatestFiniteMagnitude`).
+    /// We temporarily set our bounds to the target width, run a full layout, and
+    /// return the resulting content size.
+    public override func systemLayoutSizeFitting(
+        _ targetSize: CGSize,
+        withHorizontalFittingPriority horizontalFittingPriority: UILayoutPriority,
+        verticalFittingPriority: UILayoutPriority
+    ) -> CGSize {
+        let measurementWidth = targetSize.width > 0 ? targetSize.width : bounds.width
+        guard measurementWidth > 0 else { return .zero }
+
+        let originalBounds = bounds
+        bounds = CGRect(x: 0, y: 0, width: measurementWidth, height: 0)
+        scrollView.frame = bounds
+        setNeedsLayoutTagViews()
+        layoutTagViews()
+        let result = scrollView.contentSize
+        bounds = originalBounds
+        return result
     }
 
     public override func sizeThatFits(_ size: CGSize) -> CGSize {
@@ -330,4 +379,39 @@ public final class TagCollectionView: UIView {
     private var isDelegateAndDataSourceValid: Bool {
         return delegate != nil && dataSource != nil
     }
+
+    // MARK: - Measurement
+
+    /// Compute content size at a given width without modifying the view's current bounds permanently.
+    private func measureSize(forWidth width: CGFloat) -> CGSize {
+        guard isDelegateAndDataSourceValid,
+              let dataSource = dataSource, let delegate = delegate,
+              width > 0 else {
+            return scrollView.contentSize
+        }
+
+        let count = dataSource.numberOfTags(in: self)
+        var tagSizes: [CGSize] = []
+        tagSizes.reserveCapacity(count)
+        for i in 0..<count {
+            tagSizes.append(delegate.tagCollectionView(self, sizeForTagAt: i))
+        }
+
+        let containerWidth = (manualCalculateHeight && preferredMaxLayoutWidth > 0)
+            ? preferredMaxLayoutWidth
+            : width
+
+        let input = TagCollectionLayout.Input(
+            tagSizes: tagSizes,
+            scrollDirection: scrollDirection,
+            alignment: alignment,
+            numberOfLines: numberOfLines,
+            horizontalSpacing: horizontalSpacing,
+            verticalSpacing: verticalSpacing,
+            contentInset: contentInset,
+            containerWidth: containerWidth
+        )
+
+        return TagCollectionLayout.calculate(input).contentSize
+    }
 }
```

**File**: `Sources/TTGTags/View/TextTagCollectionView+SwiftUI.swift` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+//
+//  TextTagCollectionView+SwiftUI.swift
+//  TTGTags
+//
+//  SwiftUI integration via UIViewRepresentable.
+
+#if canImport(SwiftUI)
+import SwiftUI
+import UIKit
+
+/// SwiftUI wrapper for `TextTagCollectionView`.
+///
+/// Usage:
+/// ```swift
+/// TagCloudView(tags: ["Swift", "Kotlin", "Dart"]) { tag in
+///     // configure style, etc.
+/// }
+/// ```
+@available(iOS 16.0, *)
+public struct TagCloudView: UIViewRepresentable {
+
+    public typealias TagConfigurator = (TextTag) -> Void
+
+    private let texts: [String]
+    private let scrollDirection: TagCollectionScrollDirection
+    private let alignment: TagCollectionAlignment
+    private let numberOfLines: Int
+    private let horizontalSpacing: CGFloat
+    private let verticalSpacing: CGFloat
+    private let contentInset: UIEdgeInsets
+    private let configurator: TagConfigurator?
+
+    /// Creates a `TagCloudView` that displays the given strings as tags.
+    ///
+    /// - Parameters:
+    ///   - tags: The text strings to display.
+    ///   - scrollDirection: Scroll direction. Defaults to `.vertical`.
+    ///   - alignment: Tag alignment. Defaults to `.left`.
+    ///   - numberOfLines: Maximum number of lines (0 = unlimited). Defaults to `0`.
+    ///   - horizontalSpacing: Horizontal spacing between tags. Defaults to `8`.
+    ///   - verticalSpacing: Vertical spacing between lines. Defaults to `8`.
+    ///   - contentInset: Content padding. Defaults to 8pt on each side.
+    ///   - configurator: Optional closure to customize each `TextTag` (style, selection, etc.).
+    public init(
+        tags: [String],
+        scrollDirection: TagCollectionScrollDirection = .vertical,
+        alignment: TagCollectionAlignment = .left,
+        numberOfLines: Int = 0,
+        horizontalSpacing: CGFloat = 8,
+        verticalSpacing: CGFloat = 8,
+        contentInset: UIEdgeInsets = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8),
+        configurator: TagConfigurator? = nil
+    ) {
+        self.texts = tags
+        self.scrollDirection = scrollDirection
+        self.alignment = alignment
+        self.numberOfLines = numberOfLines
+        self.horizontalSpacing = horizontalSpacing
+        self.verticalSpacing = verticalSpacing
+        self.contentInset = contentInset
+        self.configurator = configurator
+    }
+
+    public func makeUIView(context: Context) -> TextTagCollectionView {
+        let view = TextTagCollectionView()
+        view.scrollDirection = scrollDirection
+        view.alignment = alignment
+        view.numberOfLines = numberOfLines
+        view.horizontalSpacing = horizontalSpacing
+        view.verticalSpacing = verticalSpacing
+        view.contentInset = contentInset
+        return view
+    }
+
+    public func updateUIView(_ uiView: TextTagCollectionView, context: Context) {
+        uiView.removeAllTags()
+
+        let tags: [TextTag] = texts.map { text in
+            let content = TextTagStringContent(text: text)
+            let style = TextTagStyle()
+            let tag = TextTag(content: content, style: style)
+            configurator?(tag)
+            return tag
+        }
+
+        uiView.add(tags: tags)
+        uiView.reload()
+    }
+}
+#endif
```

#### Recent Merged Pull Requests:
- **PR #159** (2026-06-07): Feature/swift rewrite (@zekunyan)
- **PR #151** (closed): Improve padding calculations (@igz)
- **PR #121** (closed): Develop (@Amaranese)
- **PR #101** (2021-02-25): Fix SPM name conflicts during header resolution (@o-nnerb)
- **PR #100** (2021-02-24): Added support to SPM (@o-nnerb)
- **PR #85** (closed): Add right to left layout direction support  (arabic) (@enefry)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
