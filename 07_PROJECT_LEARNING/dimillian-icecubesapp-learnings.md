# Forensic Learning Record (Deep Inspection): Dimillian/IceCubesApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/dimillian-icecubesapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dimillian/IceCubesApp](https://github.com/Dimillian/IceCubesApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:23:21.318Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dimillian/IceCubesApp`
- **Description**: A SwiftUI Mastodon client
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7074 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `IceCubesActionExtension/Action.js`
```
//
//  Action.js
//  IceCubesActionExtension
//
//  Created by Thomas Durand on 26/01/2023.
//

var Action = function() {};

Action.prototype = {
    run: function(arguments) {
        arguments.completionFunction({ "url" : document.URL })
    },
    finalize: function(arguments) {
        var openingUrl = arguments["deeplink"]
        if (openingUrl) {
            document.location.href = openingUrl
        }
    }
};
    
var ExtensionPreprocessingJS = new Action

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2469** (2026-08-22): **Bug: Mac app doesn't display quoted post**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS: macOS Tahoe 26.4.1  - IceCubesApp version: 2.1.3 (3244)  ## Description  A post that quotes another post doesn't display the quoted post on Mac, but does on iPhone.  This is what I see on Mac:  <img width="1480" height="1326" alt="Image" src="https://github.com/user-attachments/assets/29bec98f-7a26-41e8-b634-79b8d0aa7b21" />    This is what is I see on iPhone:  <img width="603" height="1311" alt="Image" src="https://github.com/user-attachments/assets/716e19f0-8152-4858-8a30-b484d2b4414e" />    There is a content setting called Show Quotes that is enabled:  <img width="1592" height="1548" alt="Image" src="https://github.com/user-attachments/assets/406cd996-fed4-41d8-8660-25f93d60d736" />   <!-- A clear and concise description of what the bug is. -->  ## Related Issues    - [X] I have searched the open issues and did not see an existing issue.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > Hi @Dimillian , I've tracked down the root cause of this on macOS Catalyst! It turns out the .fixedSize modifier on StatusEmbeddedView causes the container to collapse vertically on the desktop layout engine due to how the internal Spacer() interacts with the layout pass.  I have a clean fix ready using a #if !targetEnvironment(macCatalyst) conditional compilation guard so that iOS behavior remains entirely unchanged while fixing the macOS rendering. Opening a Pull Request right now with the full details!

- **Issue #2468** (2026-05-23): **Bug: Unable to sign in with two accounts on the same instance.**
  *Symptoms*: ## Environment:   - OS:   macOS 26.2 / iPadOS 26.4.2  - IceCubesApp version:   IceCubes App 2.1.3 (on both platforms)  ## Description  I've created an account within IceCubes connected to a self-hosted Mastodon instance. When I click "Add Account" and attempt to connect a second account from the same instance, after tapping "Sign In," I'm taken straight to the "Authorization required" screen from my first account, with no way tell Ice Cubes that it's a new account I'm adding.
  **Post-Mortem & Fix Analysis**:
  > Disregard! I realized there was a right-arrow icon to the right of the "Sign in as:" section that I needed to click in order to get back to the login screen.

- **Issue #2466** (2026-08-22): **Bug:**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS:  iOS 26.4  - IceCubesApp version: 2.1.3  ## Description  <!-- A clear and concise description of what the bug is. --> _As a user, When I want to report a toot, The icon of the action on the menu is not red like the text and should be._  _As a user, When I want to delete a toot, The icon of the action on the menu is not red like the text and should be._  ## Screenshots  For example, deleting a toot: <img height="300" alt="Delete action without red icon" src="https://github.com/user-attachments/assets/36b6605e-6ce1-4ad3-a2d6-ab8f4f73dba4" />  For example, reporting a toot: <img height="300" alt="Report action without red icon" src="https://github.com/user-attachments/assets/6407b494-16e4-4740-b496-6fc6bc24b994" />  ## Suggestions  Destructive actions should have both text and icons in the red tint color.  ## Related Issues   - [x] Search that this bugs don't already exist before creating it.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > > [!NOTE] > Pull request: https://github.com/Dimillian/IceCubesApp/pull/2467

- **Issue #2463** (2026-08-22): **Bug: When I pinned several tools, the header wording is not in plural form**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS: iOS 26.0  - IceCubesApp version: 2.1.4  ## Description  <!-- A clear and concise description of what the bug is. --> When I have several toots pinned, the header is always in singular form. Thus I may understand I have only pinned toot, which is not true.  For example, the screenshot below was made on an account with 2 pinned toots. <img height="500" alt="Image" src="https://github.com/user-attachments/assets/5d0118e2-e6d3-40ab-9a02-47fa3a061e73" />  ## Related Issues   - [x] Search that this bugs don't already exist before creating it.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > > [!NOTE] > Pull request will come very soon
  > > [!IMPORTANT] > @Dimillian You can find the associated pull request: https://github.com/Dimillian/IceCubesApp/pull/2464

- **Issue #2461** (2026-08-22): **Bug: screen rotation while drafting crashes app**
  *Symptoms*: ## Environment:   - OS:   iOS 26.4.2  - IceCubesApp version: 2.1.3    ## Description  If screen orientation rotates while drafting a post the app will crash.
  **Post-Mortem & Fix Analysis**:
  > Confirmed with last _develop_ version on Xcode 26.4 and codebase at commit 0fc41d2ced2e3e735bd9c42d5ae6dea16e63d618  Is seems the rotation in that case creates an insane infinite loop due to a cycle in the attribute graph, see logs below:  ```text === AttributeGraph: cycle detected through attribute 4091024 === ```
  > This started happening to me when Apple released iOS26.  (A lot of my apps started having weird issues related to transitions between portrait and landscape mode.  Ice Cubes is notable in that it crashes entirely rather than just displaying weirdly until returned to the original orientation.)  Current iOS version:  26.4.1 Current Ice Cubes version:  2.1.3
  > I would like to take a crack at this one. Will dig into the rotation crash and open a PR.

- **Issue #2430** (2026-08-22): **Bug: Message "toast.posting.success.title" when sending a toot.**
  *Symptoms*: ## Environment:  - OS:   26.2  - IceCubesApp version:   2.1.2  - Language:  German  ## Description  When sending a toot a message on top of the screen with "toast.posting.success.title" appears for a short moment. Maybe there is a missing text in the german translations?  ## Related Issues  
  **Post-Mortem & Fix Analysis**:
  > Spotted the same issue (iOS 26.2, french, version 2.1.2)  ![image](https://github.com/user-attachments/assets/1e8b4a4c-ca12-4368-afc2-4db5a7e7aa23)
  > And also same issue with the wording displayed during upload of toot (_toast.posting.title_ I might remember).
  > > [!NOTE] > @predecker For german language the error is not here anymore with version 2.1.4, did not spotted it. > 2.1.4 is maybe still in development, not release done yet  <img height="300" alt="Toot status toast in germand" src="https://github.com/user-attachments/assets/ec148b90-3326-4324-a33f-249cf0b48bb2" />  > [!CAUTION] > However the issue can be still here for other languages, like french language  <img height="300" alt="Missing toot status toast french translation" src="https://github.com/user-attachments/assets/38b33695-5a7d-4aae-8a8d-056cdabafc66" />  > [!TIP] > The issue is here just because some translations are missing and there is no fallback to english for example.

- **Issue #2425** (2026-01-10): **Bug:**
  *Symptoms*: ## Environment:  iPhone Air   - OS: 26.3  - IceCubesApp version: 2.1.2  ## Description  Hard crash when sharing a toot via the ... > Share > Share post as image  ## Related Issues

- **Issue #2408** (2026-01-06): **Bug: faulty News layout**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS:  iPadOS 26.3b1 but present on 26.2 as well  - IceCubesApp version:  2.1.0 but present in the previous version as well  <img width="1408" height="970" alt="Image" src="https://github.com/user-attachments/assets/16b2860a-89a7-4901-b0ae-d65b9c2e10bf" />  ## Description  "News" tab has bad layout, truncating the content and leaving most space unused.   
  **Post-Mortem & Fix Analysis**:
  > @Stooovie how do you get there? I can't repro on 26.2
  > Fixed by deleting and reinstalling, sorry for not trying that first. Case closed, thanks!

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

### Incident Patch 1: `9efcb16e` (2026-09-20)
**Commit Message**: fix: show adaptive sidebar on unfolded iPhone Duo

**File**: `IceCubesApp/App/Main/AppView.swift` (modified, +10/-3)
```diff
@@ -38,8 +38,15 @@ struct AppView: View {
 
   var body: some View {
     HStack(spacing: 0) {
-      tabBarView
-        .tabViewStyle(.sidebarAdaptable)
+      Group {
+        if #available(iOS 27.0, visionOS 27.0, *) {
+          tabBarView
+            .defaultTabBarPlacement(horizontalSizeClass == .regular ? .sidebar : .automatic)
+        } else {
+          tabBarView
+        }
+      }
+      .tabViewStyle(.sidebarAdaptable)
       if horizontalSizeClass == .regular
         && (UIDevice.current.userInterfaceIdiom == .pad
           || UIDevice.current.userInterfaceIdiom == .mac),
@@ -56,7 +63,7 @@ struct AppView: View {
     guard appAccountsManager.currentClient.isAuth else {
       return [SidebarSections.loggedOutTabs]
     }
-    if UIDevice.current.userInterfaceIdiom == .phone || horizontalSizeClass == .compact {
+    if horizontalSizeClass == .compact {
       return [SidebarSections.iosTabs]
     } else if UIDevice.current.userInterfaceIdiom == .vision {
       return [SidebarSections.visionOSTabs]
```

---

### Incident Patch 2: `b2db3033` (2026-08-25)
**Commit Message**: fix: gate WishKit on Mac Catalyst

**File**: `IceCubesApp.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@
 		9F7788E62BE6543D004E6BEF /* NetworkClient in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7788E52BE6543D004E6BEF /* NetworkClient */; };
 		9F7788F02BE78E77004E6BEF /* Timeline in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7788EF2BE78E77004E6BEF /* Timeline */; };
 		9F7D93942980063100EE6B7A /* AppAccount in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7D93932980063100EE6B7A /* AppAccount */; };
-		9F9191592C6DDF20001C89E7 /* WishKit in Frameworks */ = {isa = PBXBuildFile; productRef = 9F9191582C6DDF20001C89E7 /* WishKit */; };
+		9F9191592C6DDF20001C89E7 /* WishKit in Frameworks */ = {isa = PBXBuildFile; platformFilters = (ios, ); productRef = 9F9191582C6DDF20001C89E7 /* WishKit */; };
 		9FAD858E29743F7400496AB1 /* (null) in Resources */ = {isa = PBXBuildFile; };
 		9FAD859229743F7400496AB1 /* IceCubesShareExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = 9FAD858829743F7400496AB1 /* IceCubesShareExtension.appex */; platformFilters = (ios, maccatalyst, ); settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
 		9FAD859A297440CB00496AB1 /* KeychainSwift in Frameworks */ = {isa = PBXBuildFile; productRef = 9FAD8599297440CB00496AB1 /* KeychainSwift */; };
@@ -1337,7 +1337,7 @@
 			repositoryURL = "https://github.com/RevenueCat/purchases-ios-spm";
 			requirement = {
 				kind = upToNextMajorVersion;
-				minimumVersion = 5.85.0;
+				minimumVersion = 5.86.0;
 			};
 		};
 		9F9191572C6DDF20001C89E7 /* XCRemoteSwiftPackageReference "wishkit-ios" */ = {
```

**File**: `IceCubesApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +5/-5)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "95e07ea2caeef497bba7391e6b1a42cf03603536ac065c31a8810d81f5b980a4",
+  "originHash" : "a385044d9d2ed200355221b2fa134ff82734976d25fc828f4bf68e8eb32555c0",
   "pins" : [
     {
       "identity" : "bodega",
@@ -60,17 +60,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/kean/Nuke",
       "state" : {
-        "revision" : "63a8fcbd6621340a2410bc3e9575ac97058615f4",
-        "version" : "13.0.6"
+        "revision" : "30f7a7e72e0607d304fbf69c799474bd5fb6d1ce",
+        "version" : "13.2.0"
       }
     },
     {
       "identity" : "purchases-ios-spm",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/RevenueCat/purchases-ios-spm",
       "state" : {
-        "revision" : "1af9d1bf28df81af57a1958237c98bb562b8cc6b",
-        "version" : "5.85.0"
+        "revision" : "57043e7e0173c48d64e171944ac76a34d2467fa1",
+        "version" : "5.86.0"
       }
     },
     {
```

**File**: `IceCubesApp/App/Main/IceCubesApp.swift` (modified, +7/-2)
```diff
@@ -10,7 +10,10 @@ import RevenueCat
 import StatusKit
 import SwiftUI
 import Timeline
-import WishKit
+
+#if !targetEnvironment(macCatalyst)
+  import WishKit
+#endif
 
 @main
 struct IceCubesApp: App {
@@ -93,7 +96,9 @@ class AppDelegate: UIResponder, UIApplicationDelegate {
     PushNotificationsService.shared.setAccounts(accounts: AppAccountsManager.shared.pushAccounts)
     Telemetry.setup()
     Telemetry.signal("app.launched")
-    WishKit.configure(with: "AF21AE07-3BA9-4FE2-BFB1-59A3B3941730")
+    #if !targetEnvironment(macCatalyst)
+      WishKit.configure(with: "AF21AE07-3BA9-4FE2-BFB1-59A3B3941730")
+    #endif
     return true
   }
 
```

**File**: `IceCubesApp/App/Tabs/Settings/SettingsTab.swift` (modified, +7/-5)
```diff
@@ -333,11 +333,13 @@ struct SettingsTabs: View {
         Label("settings.app.about", systemImage: "info.circle")
       }
 
-      NavigationLink {
-        WishlistView()
-      } label: {
-        Label("Feature Requests", systemImage: "list.bullet.rectangle.portrait")
-      }
+      #if !targetEnvironment(macCatalyst)
+        NavigationLink {
+          WishlistView()
+        } label: {
+          Label("Feature Requests", systemImage: "list.bullet.rectangle.portrait")
+        }
+      #endif
 
     } header: {
       Text("settings.section.app")
```

**File**: `IceCubesApp/App/Tabs/Settings/WishlistView.swift` (modified, +8/-5)
```diff
@@ -1,8 +1,11 @@
 import SwiftUI
-import WishKit
 
-struct WishlistView: View {
-  var body: some View {
-    WishKit.FeedbackListView()
+#if !targetEnvironment(macCatalyst)
+  import WishKit
+
+  struct WishlistView: View {
+    var body: some View {
+      WishKit.FeedbackListView()
+    }
   }
-}
+#endif
```

---

### Incident Patch 3: `5a017d84` (2026-08-22)
**Commit Message**: fix: refine profile collection pills

**File**: `Packages/Account/Sources/Account/Detail/Components/AccountCollectionsView.swift` (modified, +6/-2)
```diff
@@ -17,12 +17,16 @@ struct AccountCollectionsView: View {
               routerPath.navigate(to: .collectionDetail(collection: collection))
             } label: {
               VStack(alignment: .leading, spacing: 0) {
-                Label(collection.name, systemImage: "person.2.crop.square.stack")
+                Text(collection.name)
                   .font(.scaledCallout)
+                  .lineLimit(1)
+                  .truncationMode(.tail)
                 Text("account.detail.collections-n-accounts \(collection.itemCount)")
                   .font(.caption2)
               }
-            }.buttonStyle(.bordered)
+            }
+            .buttonStyle(.bordered)
+            .frame(maxWidth: 180)
           }
         }
         .padding(.leading, .layoutPadding)
```

---

### Incident Patch 4: `91d58dd4` (2026-08-22)
**Commit Message**: fix: prevent composer rotation crash (#2473)

Dismiss the composer text view before interface rotation to avoid the iOS 26/27 AttributeGraph cycle while preserving one-time autofocus.

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/UITextView/Representable.swift` (modified, +4/-4)
```diff
@@ -1,19 +1,19 @@
 import SwiftUI
 
 extension TextView {
-  struct Representable: UIViewRepresentable {
+  struct Representable: UIViewControllerRepresentable {
     @Binding var text: NSMutableAttributedString
     @Binding var calculatedHeight: CGFloat
     @Environment(\.sizeCategory) var sizeCategory
 
     let keyboard: UIKeyboardType
     var getTextView: ((UITextView) -> Void)?
 
-    func makeUIView(context: Context) -> UIKitTextView {
-      context.coordinator.textView
+    func makeUIViewController(context: Context) -> TextViewController {
+      TextViewController(textView: context.coordinator.textView)
     }
 
-    func updateUIView(_: UIKitTextView, context: Context) {
+    func updateUIViewController(_: TextViewController, context: Context) {
       context.coordinator.update(representable: self)
       if !context.coordinator.didBecomeFirstResponder {
         context.coordinator.textView.becomeFirstResponder()
```

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/UITextView/TextView.swift` (modified, +32/-1)
```diff
@@ -60,11 +60,42 @@ public struct TextView: View {
   }
 }
 
+/// Hosts the text view so it can dismiss the keyboard before interface rotation.
+final class TextViewController: UIViewController {
+  private let textView: UIKitTextView
+
+  init(textView: UIKitTextView) {
+    self.textView = textView
+    super.init(nibName: nil, bundle: nil)
+  }
+
+  @available(*, unavailable)
+  required init?(coder _: NSCoder) {
+    fatalError("init(coder:) has not been implemented")
+  }
+
+  override func loadView() {
+    view = textView
+  }
+
+  override func viewWillTransition(
+    to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator
+  ) {
+    if textView.isFirstResponder {
+      textView.resignFirstResponder()
+    }
+    super.viewWillTransition(to: size, with: coordinator)
+  }
+}
+
 final class UIKitTextView: UITextView {
   override var keyCommands: [UIKeyCommand]? {
     (super.keyCommands ?? []) + [
       UIKeyCommand(
-        input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(escape(_:)))
+        input: UIKeyCommand.inputEscape,
+        modifierFlags: [],
+        action: #selector(escape(_:))
+      ),
     ]
   }
 
```

---

### Incident Patch 5: `8f0b7496` (2026-08-22)
**Commit Message**: [#2463] Fix plural form of pinned toots header (#2464)

Signed-off-by: Pierre-Yves Lapersonne <dev@pylapersonne.info>

**File**: `IceCubesApp/Resources/Localization/Localizable.xcstrings` (modified, +280/-58)
```diff
@@ -17822,121 +17822,343 @@
         }
       }
     },
-    "account.post.pinned" : {
+    "account.post.pinned %lld" : {
       "extractionState" : "manual",
       "localizations" : {
         "be" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Замацаваны допіс"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Замацаваны допіс"
+                }
+              },
+              "few" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld замацаваныя допісы"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld замацаваных допісаў"
+                }
+              }
+            }
           }
         },
         "ca" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Publicació fixada"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Publicació fixada"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld publicacions fixades"
+                }
+              }
+            }
           }
         },
         "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Angehefteter Beitrag"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Angehefteter Beitrag"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld angeheftete Beiträge"
+                }
+              }
+            }
           }
         },
         "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Pinned post"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Pinned post"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pinned posts"
+                }
+              }
+            }
           }
         },
         "en-GB" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Pinned post"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Pinned post"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pinned posts"
+                }
+              }
+            }
           }
         },
         "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Publicación fijada"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Publicación fijada"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld publicaciones fijadas"
+                }
+              }
+            }
           }
         },
         "eu" : {
- 
```

**File**: `Packages/Account/Sources/Account/Detail/Tabs/StatusesTab.swift` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ private struct StatusesTabView: View {
 
   @ViewBuilder
   private var pinnedPostsView: some View {
-    Label("account.post.pinned", systemImage: "pin.fill")
+    Label("account.post.pinned \(fetcher.pinned.count)", systemImage: "pin.fill")
       .accessibilityAddTraits(.isHeader)
       .font(.scaledFootnote)
       .foregroundStyle(.secondary)
```

---

### Incident Patch 6: `dadaa35d` (2026-08-22)
**Commit Message**: [#2466] Fix missing color of icons for destructive actions (report and delete toot) (#2467)

Signed-off-by: Pierre-Yves Lapersonne <dev@pylapersonne.info>

**File**: `Packages/Conversations/Sources/Conversations/Detail/ConversationMessageView.swift` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ struct ConversationMessageView: View {
         Button(role: .destructive) {
           routerPath.presentedSheet = .report(status: message.reblogAsAsStatus ?? message)
         } label: {
-          Label("status.action.report", systemImage: "exclamationmark.bubble")
+          Label("status.action.report", systemImage: "exclamationmark.bubble").tint(.red)
         }
       }
     }
```

**File**: `Packages/StatusKit/Sources/StatusKit/Row/Subviews/StatusRowContextMenu.swift` (modified, +5/-2)
```diff
@@ -214,7 +214,10 @@ struct StatusRowContextMenu: View {
         Button(
           role: .destructive,
           action: { viewModel.showDeleteAlert = true },
-          label: { Label("status.action.delete", systemImage: "trash") })
+          label: {
+            Label("status.action.delete", systemImage: "trash")
+              .tint(.red)
+          })
       }
     } else {
       if !viewModel.isRemote {
@@ -266,7 +269,7 @@ struct StatusRowContextMenu: View {
           viewModel.routerPath.presentedSheet = .report(
             status: viewModel.status.reblogAsAsStatus ?? viewModel.status)
         } label: {
-          Label("status.action.report", systemImage: "exclamationmark.bubble")
+          Label("status.action.report", systemImage: "exclamationmark.bubble").tint(.red)
         }
       }
     }
```

---

### Incident Patch 7: `25d4a4c7` (2026-08-22)
**Commit Message**: Fix quoted posts not displaying on macOS (#2469) (#2472)

**File**: `Packages/StatusKit/Sources/StatusKit/Row/Subviews/StatusRowContentView.swift` (modified, +4/-0)
```diff
@@ -45,15 +45,19 @@ struct StatusRowContentView: View {
             client: viewModel.client,
             routerPath: viewModel.routerPath
           )
+          #if !targetEnvironment(macCatalyst)
           .fixedSize(horizontal: false, vertical: true)
+          #endif
           .transition(.opacity)
         } else {
           StatusEmbeddedView(
             status: Status.placeholder(),
             client: viewModel.client,
             routerPath: viewModel.routerPath
           )
+          #if !targetEnvironment(macCatalyst)
           .fixedSize(horizontal: false, vertical: true)
+          #endif
           .redacted(reason: .placeholder)
           .transition(.opacity)
         }
```

---

### Incident Patch 8: `c9a6ad2d` (2026-08-22)
**Commit Message**: fix: remove custom font capability

**File**: `IceCubesApp/App/IceCubesApp-release.entitlements` (modified, +0/-5)
```diff
@@ -12,11 +12,6 @@
 	<array>
 		<string>CloudKit</string>
 	</array>
-	<key>com.apple.developer.user-fonts</key>
-	<array>
-		<string>font-enumeration</string>
-		<string>app-usage</string>
-	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
 	<key>com.apple.security.app-sandbox</key>
```

**File**: `IceCubesApp/App/IceCubesApp.entitlements` (modified, +0/-5)
```diff
@@ -12,11 +12,6 @@
 	<array>
 		<string>CloudKit</string>
 	</array>
-	<key>com.apple.developer.user-fonts</key>
-	<array>
-		<string>app-usage</string>
-		<string>font-enumeration</string>
-	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
 	<key>com.apple.security.app-sandbox</key>
```

**File**: `IceCubesApp/App/Tabs/Settings/DisplaySettingsView.swift` (modified, +1/-7)
```diff
@@ -27,8 +27,6 @@ struct DisplaySettingsView: View {
 
   @State private var localValues = DisplaySettingsLocalValues()
 
-  @State private var isFontSelectorPresented = false
-
   private let previewStatusViewModel = StatusRowViewModel(
     status: Status.placeholder(forSettings: true, language: "la"),
     client: MastodonClient(server: ""),
@@ -152,7 +150,7 @@ struct DisplaySettingsView: View {
             } else if theme.chosenFont?.fontName == ".AppleSystemUIFontRounded-Regular" {
               return FontState.SFRounded
             }
-            return theme.chosenFontData != nil ? FontState.custom : FontState.system
+            return FontState.system
           },
           set: { newValue in
             switch newValue {
@@ -164,17 +162,13 @@ struct DisplaySettingsView: View {
               theme.chosenFont = UIFont(name: "Atkinson Hyperlegible", size: 1)
             case .SFRounded:
               theme.chosenFont = UIFont.systemFont(ofSize: 1).rounded()
-            case .custom:
-              isFontSelectorPresented = true
             }
           })
       ) {
         ForEach(FontState.allCases, id: \.rawValue) { fontState in
           Text(fontState.title).tag(fontState)
         }
       }
-      .navigationDestination(isPresented: $isFontSelectorPresented, destination: { FontPicker() })
-
       VStack {
         Slider(value: $localValues.fontSizeScale, in: 0.5...1.5, step: 0.1)
         Text("settings.display.font.scaling-\(String(format: "%.1f", localValues.fontSizeScale))")
```

**File**: `IceCubesApp/Resources/Localization/Localizable.xcstrings` (modified, +1/-120)
```diff
@@ -49239,125 +49239,6 @@
         }
       }
     },
-    "settings.display.font.custom" : {
-      "extractionState" : "manual",
-      "localizations" : {
-        "be" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Уласны"
-          }
-        },
-        "ca" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalitzada"
-          }
-        },
-        "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Eigene"
-          }
-        },
-        "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Custom"
-          }
-        },
-        "en-GB" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Custom"
-          }
-        },
-        "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizada"
-          }
-        },
-        "eu" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Norberak ezarritakoa"
-          }
-        },
-        "fr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personnalisée"
-          }
-        },
-        "it" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizzato"
-          }
-        },
-        "ja" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "カスタム"
-          }
-        },
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "직접 설정"
-          }
-        },
-        "nb" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Tilpasset"
-          }
-        },
-        "nl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Aangepast"
-          }
-        },
-        "pl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Własna"
-          }
-        },
-        "pt-BR" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizada"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Özel"
-          }
-        },
-        "uk" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Власний"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "自定义"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "自定"
-          }
-        }
-      }
-    },
     "settings.display.font.line-spacing-%@" : {
       "localizations" : {
         "be" : {
@@ -86092,4 +85973,4 @@
     }
   },
   "version" : "1.0"
-}
\ No newline at end of file
+}
```

**File**: `Packages/DesignSystem/Sources/DesignSystem/FontPicker.swift` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-import Env
-import SwiftUI
-
-public struct FontPicker: UIViewControllerRepresentable {
-  @Environment(\.dismiss) var dismiss
-
-  public class Coordinator: NSObject, UIFontPickerViewControllerDelegate {
-    private let dismiss: DismissAction
-
-    public init(dismiss: DismissAction) {
-      self.dismiss = dismiss
-    }
-
-    public func fontPickerViewControllerDidCancel(_: UIFontPickerViewController) {
-      dismiss()
-    }
-
-    public func fontPickerViewControllerDidPickFont(_ viewController: UIFontPickerViewController) {
-      Theme.shared.chosenFont = UIFont(descriptor: viewController.selectedFontDescriptor!, size: 0)
-      dismiss()
-    }
-  }
-
-  public init() {}
-
-  public func makeCoordinator() -> Coordinator {
-    Coordinator(dismiss: dismiss)
-  }
-
-  public func makeUIViewController(context: Context) -> UIFontPickerViewController {
-    let controller = UIFontPickerViewController()
-    controller.delegate = context.coordinator
-    return controller
-  }
-
-  public func updateUIViewController(_: UIFontPickerViewController, context _: Context) {}
-}
```

---

### Incident Patch 9: `f1921f49` (2026-08-22)
**Commit Message**: fix: enable font enumeration capability

**File**: `IceCubesApp.xcodeproj/project.pbxproj` (modified, +4/-2)
```diff
@@ -1070,12 +1070,13 @@
 				CURRENT_PROJECT_VERSION = 3066;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"IceCubesApp/Resources\"";
-				DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";
+				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = IceCubesApp/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = "Ice Cubes";
+				INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
 				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.social-networking";
 				INFOPLIST_KEY_NSCameraUsageDescription = "Upload photos & videos to attach to your Mastodon posts.";
 				INFOPLIST_KEY_NSHumanReadableCopyright = "© 2024 Thomas Ricouard";
@@ -1141,12 +1142,13 @@
 				CURRENT_PROJECT_VERSION = 3066;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"IceCubesApp/Resources\"";
-				DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";
+				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = IceCubesApp/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = "Ice Cubes";
+				INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
 				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.social-networking";
 				INFOPLIST_KEY_NSCameraUsageDescription = "Upload photos & videos to attach to your Mastodon posts.";
 				INFOPLIST_KEY_NSHumanReadableCopyright = "© 2024 Thomas Ricouard";
```

**File**: `IceCubesApp/App/IceCubesApp-release.entitlements` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 	</array>
 	<key>com.apple.developer.user-fonts</key>
 	<array>
+		<string>font-enumeration</string>
 		<string>app-usage</string>
 	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
```

**File**: `IceCubesApp/App/IceCubesApp.entitlements` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 	<key>com.apple.developer.user-fonts</key>
 	<array>
 		<string>app-usage</string>
+		<string>font-enumeration</string>
 	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
```

**File**: `IceCubesApp/Info.plist` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@
 			</array>
 		</dict>
 	</array>
-	<key>ITSAppUsesNonExemptEncryption</key>
-	<false/>
 	<key>NSUserActivityTypes</key>
 	<array>
 		<string>INSendMessageIntent</string>
```

---

### Incident Patch 10: `086e919e` (2026-08-22)
**Commit Message**: fix: close media panel before ALT sheet

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/MainView.swift` (modified, +38/-4)
```diff
@@ -21,6 +21,7 @@ extension StatusEditor {
     @State private var mainStore: EditorStore
     @State private var followUpStores: [EditorStore] = []
     @State private var editingMediaContainer: MediaContainer?
+    @State private var pendingEditingMediaContainer: MediaContainer?
     @State private var scrollID: UUID?
     @State private var isMediaPanelPresented: Bool = false
     @State private var lastEditorFocusState: EditorFocusState?
@@ -47,7 +48,7 @@ extension StatusEditor {
       NavigationStack {
         mainContent(focusedStore: focusedStore)
       }
-      .sheet(item: $editingMediaContainer) { container in
+      .sheet(item: $editingMediaContainer, onDismiss: restoreEditorFocus) { container in
         StatusEditor.MediaEditView(store: focusedStore, container: container)
       }
       .presentationDetents([.large, .height(230)], selection: $presentationDetent)
@@ -143,7 +144,7 @@ extension StatusEditor {
         if newValue {
           lastEditorFocusState = editorFocusState
           editorFocusState = nil
-        } else if editorFocusState == nil {
+        } else if pendingEditingMediaContainer == nil, editorFocusState == nil {
           editorFocusState = lastEditorFocusState ?? .main
         }
       }
@@ -169,7 +170,7 @@ extension StatusEditor {
         EditorView(
           store: mainStore,
           followUpStores: $followUpStores,
-          editingMediaContainer: $editingMediaContainer,
+          editingMediaContainer: mediaEditingRequest,
           presentationDetent: $presentationDetent,
           editorFocusState: $editorFocusState,
           assignedFocusState: .main,
@@ -183,7 +184,7 @@ extension StatusEditor {
           EditorView(
             store: store,
             followUpStores: $followUpStores,
-            editingMediaContainer: $editingMediaContainer,
+            editingMediaContainer: mediaEditingRequest,
             presentationDetent: $presentationDetent,
             editorFocusState: $editorFocusState,
             assignedFocusState: .followUp(index: store.id),
@@ -212,6 +213,7 @@ extension StatusEditor {
 
               if isMediaPanelPresented {
                 MediaPickerPanelView(store: focusedStore)
+                  .onDisappear(perform: presentPendingMediaEditor)
               }
             }
           }
@@ -226,10 +228,42 @@ extension StatusEditor {
 
             if isMediaPanelPresented {
               MediaPickerPanelView(store: focusedStore)
+                .onDisappear(perform: presentPendingMediaEditor)
             }
           }
         }
       }
     }
+
+    private var mediaEditingRequest: Binding<MediaContainer?> {
+      Binding {
+        editingMediaContainer
+      } set: { container in
+        guard let container else {
+          pendingEditingMediaContainer = nil
+          editingMediaContainer = nil
+          return
+        }
+
+        if isMediaPanelPresented {
+          pendingEditingMediaContainer = container
+          isMediaPanelPresented = false
+        } else {
+          editingMediaContainer = container
+        }
+      }
+    }
+
+    private func presentPendingMediaEditor() {
+      guard let container = pendingEditingMediaContainer else { return }
+      pendingEditingMediaContainer = nil
+      editingMediaContainer = container
+    }
+
+    private func restoreEditorFocus() {
+      if editorFocusState == nil {
+        editorFocusState = lastEditorFocusState ?? .main
+      }
+    }
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #2498** (closed): Bump github.com/revenuecat/purchases-ios-spm from 5.86.0 to 5.88.0 (@dependabot[bot])
- **PR #2497** (closed):  Fix fatal Swift 6.3.1 compiler crash in MediaUIZoomableContainer (@jadetheda)
- **PR #2491** (closed): Bump github.com/revenuecat/purchases-ios-spm from 5.86.0 to 5.87.1 (@dependabot[bot])
- **PR #2485** (closed): Bump github.com/telemetrydeck/swiftsdk from 2.11.0 to 2.14.2 (@dependabot[bot])
- **PR #2484** (closed): Bump github.com/swiftlang/swift-markdown from 0.7.3 to 0.8.0 (@dependabot[bot])
- **PR #2483** (closed): Bump github.com/wishkit/wishkit-ios from 4.7.0 to 5.1.2 (@dependabot[bot])
- **PR #2482** (closed): Bump github.com/dean151/buttonkit from 0.6.1 to 0.8.1 (@dependabot[bot])
- **PR #2481** (closed): Bump github.com/kean/nuke from 13.0.6 to 13.2.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
