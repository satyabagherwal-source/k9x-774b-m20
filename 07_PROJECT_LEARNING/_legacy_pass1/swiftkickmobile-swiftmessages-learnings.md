# Forensic Learning Record (Deep Inspection): SwiftKickMobile/SwiftMessages

> **Canonical Artifact**: `07_PROJECT_LEARNING/swiftkickmobile-swiftmessages-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SwiftKickMobile/SwiftMessages](https://github.com/SwiftKickMobile/SwiftMessages))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:16:07.128Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SwiftKickMobile/SwiftMessages`
- **Description**: A very flexible message bar for UIKit and SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7548 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SwiftMessages/SwiftMessages.h`
```
//
//  SwiftMessages.h
//  SwiftMessages
//
//  Created by Timothy Moose on 8/9/16.
//  Copyright © 2016 SwiftKick Mobile LLC. All rights reserved.
//

#import <UIKit/UIKit.h>

//! Project version number for SwiftMessages.
FOUNDATION_EXPORT double SwiftMessagesVersionNumber;

//! Project version string for SwiftMessages.
FOUNDATION_EXPORT const unsigned char SwiftMessagesVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <SwiftMessages/PublicHeader.h>



```

### Core Architecture Module: `iMessageDemo/Pods/Target Support Files/Pods-iMessageDemo/Pods-iMessageDemo-umbrella.h`
```
#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif


FOUNDATION_EXPORT double Pods_iMessageDemoVersionNumber;
FOUNDATION_EXPORT const unsigned char Pods_iMessageDemoVersionString[];


```

### Core Architecture Module: `iMessageDemo/Pods/Target Support Files/Pods-iMessageExtensionDemo/Pods-iMessageExtensionDemo-umbrella.h`
```
#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif


FOUNDATION_EXPORT double Pods_iMessageExtensionDemoVersionNumber;
FOUNDATION_EXPORT const unsigned char Pods_iMessageExtensionDemoVersionString[];


```

### Core Architecture Module: `iMessageDemo/Pods/Target Support Files/SwiftMessages/SwiftMessages-umbrella.h`
```
#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif


FOUNDATION_EXPORT double SwiftMessagesVersionNumber;
FOUNDATION_EXPORT const unsigned char SwiftMessagesVersionString[];


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #567** (2025-08-11): **Crash on iPadOS 18.0+ using presentationstyle = .bottom**
  *Symptoms*: Due to the changes made to UITabbar in ipadOS 18.0+, SwiftMessages is crashing when trying to set the constraints for the bottom view. I believe this is an issue specifically with the function `bottomLayoutConstraint(view:, containerView:, viewController:)` in Presenter.swift. The specific crash is because we are trying to attach an anchor to the top of the tabBar which no longer exists on ipadOS 18+. I think it should check if there is a tabBar top constraint before trying to attach the view. ![image](https://github.com/user-attachments/assets/5acbc512-b451-480c-b57f-a85dbe91e846) 
  **Post-Mortem & Fix Analysis**:
  > See the same issue at my end. In the interim what could potentially solve the issue is setting the context to `window`.   When the context is`Automatic` or `ViewController` and the `presentationStyle` is set to `.bottom`,I feel it tries to locate a `TabBar` to attach to and since one does exist, it tries to use the bottom constraint, which would traditionally work but probably doesn't exist in iPadOS 18 as it floats at the top which causes the crash.  So this temporarily seems to solve it for me:  ``` var config = SwiftMessages.Config() config.presentationContext = .window(windowLevel: .normal) ```
  > 10.0.2  Sorry for not formally releasing this sooner.

- **Issue #467** (2021-06-29): **Lower or equal level window's views disappear upon hide **
  *Symptoms*: Hello!  First of all, my team and I are really overwhelmed by your library and would like to give a sincere word of appreciation. However, we have come across a bizarre situation as mentioned in the title of the issue.  To give a more concise and sufficient context, I will provide an example below.  Assuming we have two different instances of the SwiftMessages class  let a = SwiftMessages() let b = SwiftMessages()  the reproduced cases are as follows  1. (a) shows a view with a presentationContext of .window(.normal) and (b) also shows a view with a presentationContext of .window(.normal). When (a) is hidden via a.hide(), both (a) AND (b) disappear. (Possible Error?)  2. (a) shows a view with a presentationContext of .window(.statusBar) and (b) shows a view with a presentationContext of .window(.normal). When (a) is hidden via a.hide(), both (a) AND (b) disappear. (Also a possible error?)  3. (a) shows a view with a presentationContext of .window(.normal) and (b) shows a view with a presentationContext of .window(.statusBar). When (a) is hidden via a.hide(), only (a) disappears. (This case seems to be the expected behavior however the cases 1 and 2 do not seems to behave this way.)  Also, when (b) disappears upon (a)'s hide, (b)'s didHide is not called. Furthermore, when trying to show a new view via using (b)'s show() function, the view seems to be enqueued and not shown visually.  This phenomenon is only occuring in iOS 14 and above.  Could I be missi
  **Post-Mortem & Fix Analysis**:
  > Sorry to hear you're having trouble. I attempted to reproduce your issue, but didn't have any luck. Maybe you could take a look at the sample project I attached and help me figure out how to reproduce?  The code looks like this and does scenario (1) when you tap the "Test" button. The project is on 9.0.2.  ````swift class ViewController: UIViewController {      let a = SwiftMessages()     let b = SwiftMessages()      @IBAction func testTapped() {         let aMessage = MessageView.viewFromNib(layout: .cardView)         let bMessage = MessageView.viewFromNib(layout: .cardView)         aMessage.configureContent(title: "A Message", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit")         bMessage.configureContent(title: "B Message", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit")         var aConfig = a.defaultConfig         var bConfig = b.defaultConfig         aConfig.presentationContext = .window(windowLevel: .normal)         bConfig.p
  > Hi Tim! (If it's alright to call you that..? ) Thank you for such a fast response. I forgot to mention that I am using SwiftMessages 9.0.1! If it's fine with you I would like to suggest steps to reproduce the bug. Could you remove the asyncAfter function and hide the shown message via any userInteractions? Such as swiping to dismiss or tapping outside the view area? The error (1) mentioned in my former comment can be seen when done so! Thank you! Look forward to hearing from you
  > >Hi Tim! (If it's alright to call you that..? )  Yep.  > I forgot to mention that I am using SwiftMessages 9.0.1!  The specific problem you're describing was fixed in 9.0.2 

- **Issue #466** (2021-06-29): **Alert not shown after Biometry check (only from v. 9.0.1)**
  *Symptoms*: From version 9.0.1 my app can't display alert after Biometry check. This issue doesn't occur with older versions. If I try to show the alert after 1 sec (or more) using `DispatchQueue.main.asynAfter` the alert appears correctly.  Here the code that doesn't work:  ``` let context = LAContext() var error: NSError? if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {     context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) {         success, authenticationError in             if success {                 // Show an alert                 ...                 SwiftMessages.show(config: config, view: view)             }             else { ... }       } }  else {  ... } ```
  **Post-Mortem & Fix Analysis**:
  > Is that callback on the main queue?
  > Also, have you tried 9.0.2?
  > @wtmoose I've tried both 9.0.1 and 9.0.2. The callback doesn't need to be on a different thread, anyway if I include it on another thread the alert is not shown.

- **Issue #465** (2021-06-29): **SwiftMessages.hide() removing all messages in queue from versions 8.0.4 to 9.0.0 for iPad, But not for iPhone**
  *Symptoms*: Hi,  I am using SwiftMessages in our Project. I am showing two type of Toast messages, one is with a text and other one is with a text and having a button to dismiss the toast. Previously I were using 7.0.1 and recently I upgraded to 9.0.0  From there onwards, If I click on the Dismiss button (which will call SwiftMessages.hide()), I am not getting any messages that are in the queue, for iPad, But on iPhone, everything is working fine. The same code has been used for iPhone and iPad.  Even though if I remove the toast messages with a swipe towards the bottom of the screen, I am not getting next toast messages which are added to the queue.  If I did not remove the toast messages (waiting for 4 seconds for every toast message) with dismiss button or with swipe to bottom (default SwiftMessages feature) then I am getting all the messages that are added to the queue.  ````swift public func Toast (text: String?, delay: TimeInterval? = 0.0, duration: TimeInterval? = 4.0, height: CGFloat = 0, shouldAddButton: Bool = false, buttonTitle: String? = nil) {          DispatchQueue.main.async {             let messageView = MessageView.viewFromNib(layout: .cardView)             messageView.configureTheme(.success)             messageView.button?.isHidden = !shouldAddButton             messageView.iconImageView?.isHidden = true             messageView.titleLabel?.isHidden = true             messageView.configureContent(body: text?.trimmingCharacters(in: .whitespacesAndNewl
  **Post-Mortem & Fix Analysis**:
  > It sounds a lot like #458, which was fixed in 9.0.1. The problem was that if you interact with the toast view, the key window changes and iOS doesn't automatically restore the key window when you dismiss the toast. 9.0.1 added logic to restore the key window to the previous value.  In the past, folks have reported problems and it turned out that they just needed to clean their workspace. Can you try cleaning and verify if it still doesn't work for you?
  > @wtmoose  Thanks for the immediate response,  As I informed, I am not seeing any Toast message View in versions 9.0.1 and 9.0.2  I am using Carthage to use SwiftMessages and my cart file is having the below line.  github "SwiftKickMobile/SwiftMessages" == 9.0.2  I use to delete derived data every day and I use to clean build folder every day (cmd+shft+option+k).   I have deleted the build folder in my carthage folder of my project, so that it will build freshly. But I did not tested yet because of some personal work.   I will delete my existing carthage folder and do a carthage update tomorrow morning and will update you after testing. If I need to do any other changes to clean my workspace, please let me know. I will update you tomorrow morning which is after 10 hours from now. 
  > @wtmoose   I have deleted my Carthage folder and derived data, Still, I am not getting any Toast messages in 9.0.2  Could you please check each and every line above and let me know what else I missed for the new version  I have added the below code as well which is not there in the above code  ````swift messageConfig.presentationContext = .window(windowLevel: .statusBar) // (tried with automatic and other window levels) messageConfig.preferredStatusBarStyle = .lightContent messageConfig.interactiveHide = false ````  Even I tried all the theme modes like warning, error, success and info for messageView.configureTheme.  Still I am not seeing any Toast messages in 9.0.2 version  Could you please help me, how can I fix my issue

- **Issue #429** (2020-12-16): **Missing copy/paste menu in UITextField/UIWebView**
  *Symptoms*: ### Description - When using custom `SwiftMessages.Config` with `dimMode != .none`. The method `makeKeyAndVisible` is being called inside `WindowViewController`. - The clipboard (copy/paste) options when select text in TextField/Webview can not be displayed.  I'm not quite sure the reason why clipboard could not display, maybe another UIWindow make Key and Visible, then dismissed. So the OS confused and doesn't know which Window the clipboard should show.  ### Screenshot ![clipboard](https://user-images.githubusercontent.com/7752679/97255202-b3e57680-1842-11eb-967d-1c1d355aae37.gif) ### References https://stackoverflow.com/questions/6414540/missing-copy-paste-menu-in-uitextfield-uiwebview/7576544 ### Solution & PR  https://github.com/SwiftKickMobile/SwiftMessages/pull/430 ### Demo - Branch having issue: https://github.com/canhth/SwiftMessages/tree/demo/multiple-windows - Fixed version: https://github.com/canhth/SwiftMessages/tree/demo/multiple-windows-fixed
  **Post-Mortem & Fix Analysis**:
  > Where is the text field?
  > Hi @wtmoose ,  I've updated the Description. Including demo, video, and solution. How to reproduce it (Please check out my demo fork): ``` - Add rootViewController programmatically (don't forget to call `window.makeKeyAndVisible`). - Use another third party that also active another UIWindow. (_I'm using DoraemonKit for example _) - Show SwiftMessage view with `dimMode != .none`. - Now, there is no more clipboard options (copy/paste) for your selected text. ``` Please consider the PR that I made. That's just for enabling users can force disable `becomeKeyWindow` in SwiftMessages.Config.  Thanks
  > Thanks for clarifying. The change in the PR is fine, but it seems like more of a workaround than a solution. The case where the message’s window should become the key window, for example if the message has a text field, would still have the issue wouldn’t it?

- **Issue #188** (2018-05-23): **Physics animation visual glitch**
  *Symptoms*: The physics animation has a visual glitch in iOS 11 when transitioning out of interactive pan to dismiss animation.

- **Issue #185** (2018-05-18): **Incorrect margin adjustments in landscape**
  *Symptoms*: Hello guys,   I was testing the cool library. and I don't know if its a bug. when using **layout** as **statusLine** with no tab bar controller, in landscape mode the message is under the home bar of iPhone X  as shown in the image below   ![simulator screen shot - iphone x - 2018-05-15 at 22 01 54](https://user-images.githubusercontent.com/17508663/40070848-dd64af30-588c-11e8-9142-39660c07a59f.png)   Here is the code I used   ``` Swift         let view = MessageView.viewFromNib(layout: .statusLine)         view.configureTheme(backgroundColor: UIColor.blue, foregroundColor: .white)          view.configureContent(body: "Hello Lohen Yumnam")                           var config = SwiftMessages.Config()         config.presentationStyle = .bottom // Slide up from the bottom.         config.shouldAutorotate = true         config.interactiveHide = true         config.duration = .forever         config.presentationContext = .window(windowLevel: UIWindowLevelStatusBar)                  // Show the message.         SwiftMessages.show(config: config, view: view)  ```   
  **Post-Mortem & Fix Analysis**:
  > Thanks for bringing this to my attention. It definitely shouldn't do that. I'll take a look.
  > @lohenyumnam Forgot to mention that the fix for this is on the head of master. Will release soon (looking at a couple of other things).
  > This fix is available in 4.1.3

- **Issue #131** (2017-11-15): **Presentation of message fails if application is in background state**
  *Symptoms*: I present message from the bottom, so `TopBottomAnimation` animator and the method `func showAnimation(completion: @escaping AnimationCompletion)` are used. And as expected the completion closure is called with `completed` value of `false`, because `UIView.animate` does the same thing. So, does anyone have any thoughts about how we can improve that and do not break anything else? )
  **Post-Mortem & Fix Analysis**:
  > Fixed in 4.1.0 release. I added a check for application not active.

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

### Incident Patch 1: `213fedca` (2025-08-11)
**Commit Message**: Fix the bottom constraint issue on iPadOS 18+ when the tab bar has no superview or frame is empty (#578)

**File**: `SwiftMessages/Presenter.swift` (modified, +1/-1)
```diff
@@ -339,7 +339,7 @@ class Presenter: NSObject {
         }
 
         func bottomLayoutConstraint(view: UIView, containerView: UIView, viewController: UIViewController?) -> NSLayoutConstraint {
-            if case .bottom = config.presentationStyle.topBottomStyle, let tab = viewController as? UITabBarController, tab.sm_isVisible(view: tab.tabBar) {
+            if case .bottom = config.presentationStyle.topBottomStyle, let tab = viewController as? UITabBarController, tab.sm_isVisible(view: tab.tabBar), tab.tabBar.superview != nil, !tab.tabBar.frame.isEmpty {
                 return NSLayoutConstraint(item: view, attribute: .bottom, relatedBy: .equal, toItem: tab.tabBar, attribute: .top, multiplier: 1.00, constant: 0.0)
             }
             return NSLayoutConstraint(item: view, attribute: .bottom, relatedBy: .equal, toItem: containerView, attribute: .bottom, multiplier: 1.00, constant: 0.0)
```

---

### Incident Patch 2: `b3bccca8` (2024-08-02)
**Commit Message**: Fix broken SwiftUI touch handling in iOS 18

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +19/-4)
```diff
@@ -44,10 +44,25 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
     }
 
     public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
-        let view = super.hitTest(point, with: event)
-        // The rendered SwiftUI view isn't a direct child of this hosting view. SwiftUI
-        // inserts another intermediate view that should also ignore touches.
-        if view == self || view?.superview == self { return nil }
+        guard let view = super.hitTest(point, with: event) else { return nil }
+        // Touches should pass through unless they land on a view that is rendering a SwiftUI element.
+        if view == self { return nil }
+        // In iOS 18 beta, the hit testing behavior changed in a weird way: when a SwiftUI element is tapped,
+        // the first hit test returns the view that renders the SwiftUI element. However, a second identical hit
+        // test is performed(!) and on the second test, the `UIHostingController`'s view is returned. We want touches
+        // to pass through that view. In iOS 17, we would just return `nil` in that case. However, in iOS 18, the
+        // second hit test is actuall essential to touches being delivered to the SwiftUI elements. The new approach
+        // is to iterate overall all of the subviews, which are all presumably rendering SwiftUI elements, and
+        // only return `nil` if the point is not inside any of these subviews.
+        if view.superview == self {
+            for subview in view.subviews {
+                let subviewPoint = self.convert(point, to: subview)
+                if subview.point(inside: subviewPoint, with: event) {
+                    return view
+                }
+            }
+            return nil
+        }
         return view
     }
 
```

---

### Incident Patch 3: `fa5f863e` (2024-01-23)
**Commit Message**: Fixes #207 (#484)

**File**: `Demo/Demo.xcodeproj/project.pbxproj` (modified, +4/-5)
```diff
@@ -200,7 +200,6 @@
 				TargetAttributes = {
 					86AEDCE11D5D1DB70030232E = {
 						CreatedOnToolsVersion = 7.3.1;
-						DevelopmentTeam = 38R82CD868;
 						LastSwiftMigration = 1020;
 					};
 				};
@@ -427,11 +426,11 @@
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_IDENTITY = "iPhone Developer";
-				DEVELOPMENT_TEAM = 38R82CD868;
+				DEVELOPMENT_TEAM = "";
 				INFOPLIST_FILE = Demo/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 14.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.Demo;
+				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.SwiftMessages.Demo;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
@@ -444,11 +443,11 @@
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_IDENTITY = "iPhone Developer";
-				DEVELOPMENT_TEAM = 38R82CD868;
+				DEVELOPMENT_TEAM = "";
 				INFOPLIST_FILE = Demo/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 14.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.Demo;
+				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.SwiftMessages.Demo;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
```

**File**: `Demo/Demo.xcodeproj/xcshareddata/xcschemes/Demo.xcscheme` (modified, +0/-7)
```diff
@@ -50,13 +50,6 @@
             ReferencedContainer = "container:Demo.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
-      <AdditionalOptions>
-         <AdditionalOption
-            key = "MallocStackLogging"
-            value = ""
-            isEnabled = "YES">
-         </AdditionalOption>
-      </AdditionalOptions>
    </LaunchAction>
    <ProfileAction
       buildConfiguration = "Release"
```

**File**: `Demo/Demo/Base.lproj/LaunchScreen.storyboard` (modified, +5/-8)
```diff
@@ -1,12 +1,9 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="14109" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
-    <device id="retina4_7" orientation="portrait">
-        <adaptation id="fullscreen"/>
-    </device>
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22505" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
+    <device id="retina4_7" orientation="portrait" appearance="light"/>
     <dependencies>
         <deployment identifier="iOS"/>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="14088"/>
-        <capability name="Constraints to layout margins" minToolsVersion="6.0"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22504"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
     </dependencies>
     <scenes>
@@ -22,14 +19,14 @@
                         <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                         <subviews>
-                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="© 2018 SWIFTKICK MOBILE LLC" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="sBz-Dk-SSO">
+                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="© 2024 SWIFTKICK MOBILE LLC" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="sBz-Dk-SSO">
                                 <rect key="frame" x="46" y="643" width="283" height="16"/>
                                 <fontDescription key="fontDescription" type="system" pointSize="13"/>
                                 <color key="textColor" red="0.47391887630000001" green="0.47391887630000001" blue="0.47391887630000001" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                                 <nil key="highlightedColor"/>
                             </label>
                             <imageView userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="splashBanner" translatesAutoresizingMaskIntoConstraints="NO" id="236-Ta-JzA">
-                                <rect key="frame" x="16" y="196" width="342" height="274"/>
+                                <rect key="frame" x="16" y="196.5" width="343" height="274"/>
                             </imageView>
                         </subviews>
                         <color key="backgroundColor" red="1" green="1" blue="1" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
```

**File**: `Demo/Demo/Base.lproj/Main.storyboard` (modified, +169/-128)
```diff
@@ -1,8 +1,10 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="15504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="JQZ-C5-7mw">
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22505" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="JQZ-C5-7mw">
     <device id="retina4_7" orientation="portrait" appearance="light"/>
     <dependencies>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="15508"/>
+        <deployment identifier="iOS"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22504"/>
+        <capability name="System colors in document resources" minToolsVersion="11.0"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
     </dependencies>
     <scenes>
@@ -30,10 +32,10 @@
                     <tableView key="view" clipsSubviews="YES" contentMode="scaleToFill" alwaysBounceVertical="YES" dataMode="prototypes" style="plain" separatorStyle="default" rowHeight="44" sectionHeaderHeight="28" sectionFooterHeight="28" id="j4a-wU-637">
                         <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
-                        <color key="backgroundColor" systemColor="systemBackgroundColor" cocoaTouchSystemColor="whiteColor"/>
+                        <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                         <prototypes>
                             <tableViewCell clipsSubviews="YES" contentMode="scaleToFill" selectionStyle="default" indentationWidth="10" reuseIdentifier="TitleBody" rowHeight="80" id="2n5-7h-3B5" userLabel="TitleBody Cell" customClass="TitleBodyCell" customModule="Demo" customModuleProvider="target">
-                                <rect key="frame" x="0.0" y="28" width="375" height="80"/>
+                                <rect key="frame" x="0.0" y="50" width="375" height="80"/>
                                 <autoresizingMask key="autoresizingMask"/>
                                 <tableViewCellContentView key="contentView" opaque="NO" clipsSubviews="YES" multipleTouchEnabled="YES" contentMode="center" tableViewCell="2n5-7h-3B5" id="Q5r-8D-38q">
                                     <rect key="frame" x="0.0" y="0.0" width="375" height="80"/>
@@ -47,7 +49,7 @@
                                         <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="Body" textAlignment="natural" lineBreakMode="tailTruncation" numberOfLines="0" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="Gpd-DA-5jT">
                                             <rect key="frame" x="26" y="45" width="323" height="14"/>
                                             <fontDescription key="fontDescription" type="system" pointSize="16"/>
-                                            <color key="textColor" systemColor="secondaryLabelColor" red="0.23529411759999999" green="0.23529411759999999" blue="0.26274509800000001" alpha="0.59999999999999998" colorSpace="custom" customColorSpace="sRGB"/>
+                                            <color key="textColor" systemColor="secondaryLabelColor"/>
                                             <nil key="highlightedColor"/>
                                         </label>
                                     </subviews>
@@ -67,21 +69,21 @@
                                 </connections>
                             </tableViewCell>
                   
```

**File**: `Demo/Demo/ExploreViewController.swift` (modified, +10/-5)
```diff
@@ -41,16 +41,16 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
         
         switch theme.selectedSegmentIndex {
         case 0:
-            view.configureTheme(.info, iconStyle: iconStyle)
+            view.configureTheme(.info, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "info"
         case 1:
-            view.configureTheme(.success, iconStyle: iconStyle)
+            view.configureTheme(.success, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "success"
         case 2:
-            view.configureTheme(.warning, iconStyle: iconStyle)
+            view.configureTheme(.warning, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "warning"
         case 3:
-            view.configureTheme(.error, iconStyle: iconStyle)
+            view.configureTheme(.error, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "error"
         default:
             let iconText = ["🐸", "🐷", "🐬", "🐠", "🐍", "🐹", "🐼"].randomElement()
@@ -140,7 +140,11 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
                 break
             }
         }
-        
+
+        if view.defaultHaptic == nil && hapticFeedback.isOn {
+            config.haptic = .success
+        }
+
         // Show
         SwiftMessages.show(config: config, view: view)
     }
@@ -154,6 +158,7 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
     @IBOutlet weak var duration: UISegmentedControl!
     @IBOutlet weak var dimMode: UISegmentedControl!
     @IBOutlet weak var interactiveHide: UISwitch!
+    @IBOutlet weak var hapticFeedback: UISwitch!
     @IBOutlet weak var layout: UISegmentedControl!
     @IBOutlet weak var theme: UISegmentedControl!
     @IBOutlet weak var iconStyle: UISegmentedControl!
```

---

### Incident Patch 4: `e2b1254a` (2024-01-23)
**Commit Message**: Fix SwiftUI handling of the message binding

**File**: `SwiftMessages/SwiftMessageModifier.swift` (modified, +7/-2)
```diff
@@ -75,16 +75,21 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
     func body(content: Content) -> some View {
         content
             .onChange(of: message) { message in
-                if let message {
-                    let show: @MainActor (SwiftMessages.Config, UIView) -> Void = swiftMessages?.show(config:view:) ?? SwiftMessages.show(config:view:)
+                let show: @MainActor (SwiftMessages.Config, UIView) -> Void = swiftMessages?.show(config:view:) ?? SwiftMessages.show(config:view:)
+                let hideAll: @MainActor () -> Void = swiftMessages?.hideAll ?? SwiftMessages.hideAll
+                switch message {
+                case let message?:
                     let view = MessageHostingView(id: message.id, content: messageContent(message))
                     var config = config ?? swiftMessages?.defaultConfig ?? SwiftMessages.defaultConfig
                     config.eventListeners.append { event in
                         if case .didHide = event, event.id == self.message?.id {
                             self.message = nil
                         }
                     }
+                    hideAll()
                     show(config, view)
+                case .none:
+                    hideAll()
                 }
             }
     }
```

---

### Incident Patch 5: `eb9591af` (2024-01-22)
**Commit Message**: Fix SwiftUI hang

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +6/-11)
```diff
@@ -128,20 +128,15 @@ open class KeyboardTrackingView: UIView {
     }
 
     private func animateKeyboardChange(change: Change, height: CGFloat, userInfo: [AnyHashable: Any]) {
-        self.heightConstraint.constant = height
-        if let durationNumber = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber,
-            let curveNumber = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber {
-            CATransaction.begin()
-            CATransaction.setCompletionBlock {
-                self.didChange(change: change, userInfo: userInfo)
-                self.delegate?.keyboardTrackingViewDidChange(change: change, userInfo: userInfo)
-            }
-            let curve = UIView.AnimationCurve(rawValue: curveNumber.intValue) ?? .easeInOut
-            let animation = UIViewPropertyAnimator(duration: durationNumber.doubleValue, curve: curve) {
+        if let durationNumber = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber {
+            UIView.animate(withDuration: durationNumber.doubleValue, delay: 0, options: .curveEaseInOut, animations: {
+                self.heightConstraint.constant = height
                 self.updateConstraintsIfNeeded()
                 self.superview?.layoutIfNeeded()
+            }) { completed in
+                self.didChange(change: change, userInfo: userInfo)
+                self.delegate?.keyboardTrackingViewDidChange(change: change, userInfo: userInfo)
             }
-            animation.startAnimation()
         }
     }
 
```

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +14/-1)
```diff
@@ -10,7 +10,7 @@ import UIKit
 
 /// A rudimentary hosting view for SwiftUI messages.
 @available(iOS 14.0, *)
-public class MessageHostingView<Content>: BaseView, Identifiable where Content: View {
+public class MessageHostingView<Content>: UIView, Identifiable where Content: View {
 
     // MARK: - API
 
@@ -50,4 +50,17 @@ public class MessageHostingView<Content>: BaseView, Identifiable where Content:
         if view == self || view?.superview == self { return nil }
         return view
     }
+
+    // MARK: - Configuration
+
+    private func installContentView(_ contentView: UIView) {
+        contentView.translatesAutoresizingMaskIntoConstraints = false
+        addSubview(contentView)
+        NSLayoutConstraint.activate([
+            contentView.topAnchor.constraint(equalTo: topAnchor),
+            contentView.bottomAnchor.constraint(equalTo: bottomAnchor),
+            contentView.leftAnchor.constraint(equalTo: leftAnchor),
+            contentView.rightAnchor.constraint(equalTo: rightAnchor),
+        ])
+    }
 }
```

---

### Incident Patch 6: `f3555f04` (2023-12-03)
**Commit Message**: Fix typo

**File**: `SwiftMessages/SwiftMessages.swift` (modified, +2/-2)
```diff
@@ -651,7 +651,7 @@ open class SwiftMessages {
         }
     }
 
-    fileprivate weak var autohideToken: AnyObject?
+    fileprivate weak var autohideToken: Presenter?
 
     fileprivate func queueAutoHide() {
         guard let current = _current else { return }
@@ -660,7 +660,7 @@ open class SwiftMessages {
             Task { [weak self] in
                 try? await Task.sleep(seconds: pauseDuration)
                 // Make sure we've still got a green light to auto-hide.
-                guard let self, self.autohideToken !== current else { return }
+                guard let self, self.autohideToken == current else { return }
                 self.internalHide(presenter: current)
             }
         }
```

---

### Incident Patch 7: `95f65d57` (2023-12-03)
**Commit Message**: #534 Fix warnings?

**File**: `SwiftMessages/BaseView.swift` (modified, +5/-5)
```diff
@@ -280,6 +280,11 @@ open class BaseView: UIView, BackgroundViewable, MarginAdjustable {
 
     private var layoutConstraints: [NSLayoutConstraint] = []
     private var regularWidthLayoutConstraints: [NSLayoutConstraint] = []
+
+    open override func layoutSubviews() {
+        super.layoutSubviews()
+        updateShadowPath()
+    }
 }
 
 /*
@@ -334,11 +339,6 @@ extension BaseView {
             // Update the layer's `shadowPath` without animation
             layer.shadowPath = shadowPath        }
     }
-
-    open override func layoutSubviews() {
-        super.layoutSubviews()
-        updateShadowPath()
-    }
 }
 
 /*
```

**File**: `SwiftMessages/MarginAdjustable+Extensions.swift` (modified, +2/-19)
```diff
@@ -13,25 +13,8 @@ extension MarginAdjustable where Self: UIView {
         var layoutMargins: UIEdgeInsets = layoutMarginAdditions
         var safeAreaInsets: UIEdgeInsets = {
             guard respectSafeArea else { return .zero }
-            if #available(iOS 11, *) {
-                insetsLayoutMarginsFromSafeArea = false
-                return self.safeAreaInsets
-            } else {
-                #if SWIFTMESSAGES_APP_EXTENSIONS
-                let application: UIApplication? = nil
-                #else
-                let application: UIApplication? = UIApplication.shared
-                #endif
-                if !context.safeZoneConflicts.isDisjoint(with: [.statusBar]),
-                   let app = application,
-                   app.statusBarOrientation == .portrait || app.statusBarOrientation == .portraitUpsideDown {
-                    let frameInWindow = convert(bounds, to: window)
-                    let top = max(0, 20 - frameInWindow.minY)
-                    return UIEdgeInsets(top: top, left: 0, bottom: 0, right: 0)
-                } else {
-                    return .zero
-                }
-            }
+            insetsLayoutMarginsFromSafeArea = false
+            return self.safeAreaInsets
         }()
         if !context.safeZoneConflicts.isDisjoint(with: .overStatusBar) {
             safeAreaInsets.top = 0
```

**File**: `SwiftMessages/PhysicsAnimation.swift` (modified, +1/-3)
```diff
@@ -93,9 +93,7 @@ public class PhysicsAnimation: NSObject, Animator {
         guard let adjustable = messageView as? MarginAdjustable & UIView,
             let context = context else { return }
         adjustable.preservesSuperviewLayoutMargins = false
-        if #available(iOS 11, *) {
-            adjustable.insetsLayoutMarginsFromSafeArea = false
-        }
+        adjustable.insetsLayoutMarginsFromSafeArea = false
         adjustable.layoutMargins = adjustable.defaultMarginAdjustment(context: context)
     }
 
```

**File**: `SwiftMessages/Presenter.swift` (modified, +26/-39)
```diff
@@ -236,7 +236,7 @@ class Presenter: NSObject {
     }
 
     private func safeZoneConflicts() -> SafeZoneConflicts {
-        guard let window = maskingView.window else { return [] }
+        guard let _ = maskingView.window else { return [] }
         let windowLevel: UIWindow.Level = {
             if let vc = presentationContext.viewControllerValue() as? WindowViewController {
                 return vc.config.windowLevel ?? .normal
@@ -253,47 +253,34 @@ class Presenter: NSObject {
             if let vc = presentationContext.viewControllerValue() as? UITabBarController { return vc.sm_isVisible(view: vc.tabBar) }
             return false
         }()
-        if #available(iOS 11, *) {
-            if windowLevel > .normal {
-                // TODO seeing `maskingView.safeAreaInsets.top` value of 20 on
-                // iPhone 8 with status bar window level. This seems like an iOS bug since
-                // the message view's window is above the status bar. Applying a special rule
-                // to allow the animator to revove this amount from the layout margins if needed.
-                // This may need to be reworked if any future device has a legitimate 20pt top safe area,
-                // such as with a potentially smaller notch.
-                if maskingView.safeAreaInsets.top == 20 {
-                    return [.overStatusBar]
-                } else {
-                    var conflicts: SafeZoneConflicts = []
-                    if maskingView.safeAreaInsets.top > 0 {
-                        conflicts.formUnion(.sensorNotch)
-                    }
-                    if maskingView.safeAreaInsets.bottom > 0 {
-                        conflicts.formUnion(.homeIndicator)
-                    }
-                    return conflicts
+        if windowLevel > .normal {
+            // TODO seeing `maskingView.safeAreaInsets.top` value of 20 on
+            // iPhone 8 with status bar window level. This seems like an iOS bug since
+            // the message view's window is above the status bar. Applying a special rule
+            // to allow the animator to revove this amount from the layout margins if needed.
+            // This may need to be reworked if any future device has a legitimate 20pt top safe area,
+            // such as with a potentially smaller notch.
+            if maskingView.safeAreaInsets.top == 20 {
+                return [.overStatusBar]
+            } else {
+                var conflicts: SafeZoneConflicts = []
+                if maskingView.safeAreaInsets.top > 0 {
+                    conflicts.formUnion(.sensorNotch)
                 }
+                if maskingView.safeAreaInsets.bottom > 0 {
+                    conflicts.formUnion(.homeIndicator)
+                }
+                return conflicts
             }
-            var conflicts: SafeZoneConflicts = []
-            if !underNavigationBar {
-                conflicts.formUnion(.sensorNotch)
-            }
-            if !underTabBar {
-                conflicts.formUnion(.homeIndicator)
-            }
-            return conflicts
-        } else {
-            #if SWIFTMESSAGES_APP_EXTENSIONS
-            return []
-            #else
-            if UIApplication.shared.isStatusBarHidden { return [] }
-            if (windowLevel > UIWindow.Level.normal) || underNavigationBar { return [] }
-            let statusBarFrame = UIApplication.shared.statusBarFrame
-            let statusBarWindowFrame = window.convert(statusBarFrame, from: nil)
-            let statusBarViewFrame = maskingView.convert(statusBarWindowFrame, from: nil)
-            return statusBarViewFrame.intersects(maskingView.bounds) ? SafeZoneConflicts.statusBar : []
-            #endif
         }
+        var conflicts: SafeZoneConflicts = []
+        if !underNavigationBar {
+            conflicts.formUnion(.sensorNotch)
+        }
+        if !underTabBar {
+            conflicts.formUnion(.homeIndicator)
+        }
+        return c
```

**File**: `SwiftMessages/TopBottomAnimation.swift` (modified, +1/-3)
```diff
@@ -130,9 +130,7 @@ public class TopBottomAnimation: NSObject, Animator {
         guard let adjustable = messageView as? MarginAdjustable & UIView,
             let context = context else { return }
         adjustable.preservesSuperviewLayoutMargins = false
-        if #available(iOS 11, *) {
-            adjustable.insetsLayoutMarginsFromSafeArea = false
-        }
+        adjustable.insetsLayoutMarginsFromSafeArea = false
         var layoutMargins = adjustable.defaultMarginAdjustment(context: context)
         switch style {
         case .top:
```

---

### Incident Patch 8: `62e12e13` (2023-11-01)
**Commit Message**: Couple of fixes

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -1,6 +1,13 @@
 # Change Log
 All notable changes to this project will be documented in this file.
 
+## 9.0.9
+
+### Fixes
+
+* Fix hit testing on SwiftUI views to allow touches around the view's margins to pass through to the underlying view.
+* Update `KeyboardTrackingView` to continue tracking the keyboard even when not installed in the view hierarchy.
+
 ## 9.0.8
 
 ### Changes
```

**File**: `README.md` (modified, +5/-5)
```diff
@@ -206,14 +206,14 @@ struct DemoMessageView: View {
         }
         .multilineTextAlignment(.leading)
         .padding(30)
+        // This makes the message width greedy
         .frame(maxWidth: .infinity)
         .background(.gray)
-        // This makes a tab-style view where the bottom corners are rounded and the view's background
-        // extends to the top edge.
+        // This makes a tab-style view where the bottom corners are rounded and
+        // the view's background extends to the top edge.
         .mask(
-            UnevenRoundedRectangle(
-                cornerRadii: .init(bottomLeading: 15, bottomTrailing: 15)
-            )
+	        UnevenRoundedRectangle(bottomLeadingRadius: 15, bottomTrailingRadius: 15)
+            // This causes the background to extend into the safe area to the screen edge.
             .edgesIgnoringSafeArea(.top)
         )
     }
```

**File**: `SwiftMessages.podspec` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 Pod::Spec.new do |spec|
     spec.name             = 'SwiftMessages'
-    spec.version          = '9.0.8'
+    spec.version          = '9.0.9'
     spec.license          = { :type => 'MIT' }
     spec.homepage         = 'https://github.com/SwiftKickMobile/SwiftMessages'
     spec.authors          = { 'Timothy Moose' => 'tim@swiftkickmobile.com' }
```

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +14/-3)
```diff
@@ -72,6 +72,7 @@ open class KeyboardTrackingView: UIView {
 
     private var isAutomaticallyPaused = false
     private var heightConstraint: NSLayoutConstraint!
+    private var lastObservedKeyboardRect: CGRect?
 
     private func postInit() {
         translatesAutoresizingMaskIntoConstraints = false
@@ -109,15 +110,19 @@ open class KeyboardTrackingView: UIView {
         isAutomaticallyPaused = false
     }
 
+    open override func layoutSubviews() {
+        super.layoutSubviews()
+        heightConstraint.constant = calculateHeightConstant()
+    }
+
     private func show(change: Change, _ notification: Notification) {
         guard !(isPaused || isAutomaticallyPaused),
             let userInfo = (notification as NSNotification).userInfo,
             let value = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { return }
         willChange(change: change, userInfo: userInfo)
         delegate?.keyboardTrackingViewWillChange(change: change, userInfo: userInfo)
-        let keyboardRect = value.cgRectValue
-        let thisRect = convert(bounds, to: nil)
-        let newHeight = max(0, thisRect.maxY - keyboardRect.minY) + topMargin
+        lastObservedKeyboardRect = value.cgRectValue
+        let newHeight = calculateHeightConstant()
         guard heightConstraint.constant != newHeight else { return }
         animateKeyboardChange(change: change, height: newHeight, userInfo: userInfo)
     }
@@ -140,4 +145,10 @@ open class KeyboardTrackingView: UIView {
             CATransaction.commit()
         }
     }
+
+    private func calculateHeightConstant() -> CGFloat {
+        guard let keyboardRect = lastObservedKeyboardRect else { return 0 }
+        let thisRect = convert(bounds, to: nil)
+        return max(0, thisRect.maxY - keyboardRect.minY) + topMargin
+    }
 }
```

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +8/-0)
```diff
@@ -39,4 +39,12 @@ public class MessageHostingView<Content>: BaseView, Identifiable where Content:
     required init?(coder _: NSCoder) {
         fatalError("init(coder:) has not been implemented")
     }
+
+    public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
+        let view = super.hitTest(point, with: event)
+        // The rendered SwiftUI view isn't a direct child of this hosting view. SwiftUI
+        // inserts another intermediate view that should also ignore touches.
+        if view == self || view?.superview == self { return nil }
+        return view
+    }
 }
```

---

### Incident Patch 9: `188705b8` (2023-10-06)
**Commit Message**: Fix email address

**File**: `SwiftMessages.podspec` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Pod::Spec.new do |spec|
     spec.version          = '9.0.7'
     spec.license          = { :type => 'MIT' }
     spec.homepage         = 'https://github.com/SwiftKickMobile/SwiftMessages'
-    spec.authors          = { 'Timothy Moose' => 'tim@swiftkick.it' }
+    spec.authors          = { 'Timothy Moose' => 'tim@swiftkickmobile.com' }
     spec.summary          = 'A very flexible message bar for iOS written in Swift.'
     spec.source           = {:git => 'https://github.com/SwiftKickMobile/SwiftMessages.git', :tag => spec.version}
     spec.platform         = :ios, '12.0'
```

---

### Incident Patch 10: `349fec76` (2021-06-29)
**Commit Message**: Fix warning

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 import UIKit
 
-public protocol KeyboardTrackingViewDelegate: class {
+public protocol KeyboardTrackingViewDelegate: AnyObject {
     func keyboardTrackingViewWillChange(change: KeyboardTrackingView.Change, userInfo: [AnyHashable : Any])
     func keyboardTrackingViewDidChange(change: KeyboardTrackingView.Change, userInfo: [AnyHashable : Any])
 }
```

#### Recent Merged Pull Requests:
- **PR #582** (2025-09-02): Refactor `MessageHostingView` Hit Testing to Improve SwiftUI Touch Handling (@mofeejegi)
- **PR #578** (2025-08-11): Fix crash on iPadOS 18+ when presenting bottom SwiftMessage above UITabBarController (@mofeejegi)
- **PR #577** (2025-06-10): Hide Background Elements from Modal SwiftMessage in VoiceOver mode (@mofeejegi)
- **PR #574** (2025-06-09): Introduce SwiftMessagesHideAction and Environment Key for SwiftUI (@mofeejegi)
- **PR #571** (2025-01-26): PhysicsPanHandler.swift make configure public (@teameh)
- **PR #560** (2024-08-12): SwiftUI layout improvement (@wtmoose)
- **PR #559** (closed): feat: add SwiftUI static APIs (@MojtabaHs)
- **PR #558** (closed): Enhance developer experience (@MojtabaHs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
