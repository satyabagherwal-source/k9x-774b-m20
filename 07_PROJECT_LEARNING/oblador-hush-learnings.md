# Forensic Learning Record (Deep Inspection): oblador/hush

> **Canonical Artifact**: `07_PROJECT_LEARNING/oblador-hush-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oblador/hush](https://github.com/oblador/hush))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:28:35.924Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oblador/hush`
- **Description**: 🤫 Noiseless Browsing – Content Blocker for Safari
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3707 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Shared/Models/AppState.swift`
```
import Foundation

enum ContentBlockerEnabledState {
    case undetermined
    case disabled
    case enabled
}

class AppState: ObservableObject {
    @Published var contentBlockerEnabledState: ContentBlockerEnabledState
    init(initialContentBlockerEnabledState:ContentBlockerEnabledState) {
        self.contentBlockerEnabledState = initialContentBlockerEnabledState
    }
}

```

### Core Architecture Module: `Shared/ContentBlockerRequestHandler.swift`
```
import Foundation

class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let attachment = NSItemProvider(contentsOf: Bundle.main.url(forResource: "blockerList", withExtension: "json"))!

        let item = NSExtensionItem()
        item.attachments = [attachment]

        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}

```

### Core Architecture Module: `Shared/Extensions/Colors.swift`
```
import SwiftUI

extension Color {
    public static var appBackgroundColor: Color {
        return Color.init("AppBackgroundColor")
    }

    public static var invertedBackgroundColor: Color {
        return Color.init("InvertedBackgroundColor")
    }
}

```

### Core Architecture Module: `Shared/HushApp.swift`
```
import SwiftUI
import SafariServices

@main
struct HushApp: App {
    #if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif

    let contentBlockerIdentifier = "\(Bundle.main.bundleIdentifier ?? "se.oblador.Hush").ContentBlocker"
    let appState = AppState(initialContentBlockerEnabledState: .undetermined)

    init() {
        SFContentBlockerManager.reloadContentBlocker(withIdentifier: contentBlockerIdentifier,
            completionHandler: { (error) in
                if let error = error {
                    print("Failed to reload content blocker")
                    print(error)
                }
        })
    }

    func refreshEnabledState() {
        SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: contentBlockerIdentifier, completionHandler: { (state, error) in
            if let error = error {
                print("Failed to get content blocker state")
                print(error)
                DispatchQueue.main.async {
                    appState.contentBlockerEnabledState = .undetermined
                }
            }
            if let state = state {
                DispatchQueue.main.async {
                    appState.contentBlockerEnabledState = state.isEnabled ? .enabled : .disabled
                }
            }
        })
    }

    var body: some Scene {
        #if os(macOS)
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear(perform: refreshEnabledState)
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.willBecomeActiveNotification)) { _ in
                    refreshEnabledState()
                }
                .frame(
                    minWidth: 320,
                    idealWidth: 350,
                    maxWidth: 500,
                    minHeight: 440,
                    idealHeight: 460,
                    maxHeight: 600
                )
                .background(Color.appBackgroundColor.ignoresSafeArea())
        }
        .commands {
            // Disable "New Window" command
            CommandGroup(replacing: CommandGroupPlacement.newItem) {}
        }
        .windowStyle(HiddenTitleBarWindowStyle())
        #else
        WindowGroup {
            ZStack {
                Color.appBackgroundColor.ignoresSafeArea()
                ContentView()
                    .environmentObject(appState)
                    .onAppear(perform: refreshEnabledState)
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                        refreshEnabledState()
                    }
            }
        }
        #endif
    }
}

```

### Core Architecture Module: `Shared/Views/ContentView.swift`
```
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack ( alignment: .leading, spacing: 40) {
            Spacer()
            VStack {
                Image(self.appState.contentBlockerEnabledState == .disabled ? "Disabled" : "Enabled")
                    .resizable()
                    .renderingMode(.template)
                    .foregroundColor(.invertedBackgroundColor)
                    .frame(width: 200, height: 155)
            }
            .frame(
                maxWidth: .infinity,
                alignment: .center
            )
            VStack { () -> AnyView? in
                switch(self.appState.contentBlockerEnabledState) {
                case .disabled: return AnyView(InstructionsView())
                case .enabled: return AnyView(EnabledView())
                case .undetermined: return nil
                }
            }
            .padding()
            Spacer()
        }
        .frame(maxWidth: 400)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(AppState(initialContentBlockerEnabledState: .enabled))
        ContentView()
            .environmentObject(AppState(initialContentBlockerEnabledState: .disabled))
    }
}

```

### Core Architecture Module: `Shared/Views/EnabledView.swift`
```
import SwiftUI

func makeStoreURL(appID: String, action: String) -> URL {
    #if os(macOS)
    let scheme = "macappstore:"
    #elseif targetEnvironment(simulator)
    let scheme = "https:"
    #else
    let scheme = "itms-apps:"
    #endif

    return URL(string: "\(scheme)//apps.apple.com/app/id\(appID)?action=\(action)")!
}

struct EnabledView: View {
    let reviewURL = makeStoreURL(appID:"1544743900", action: "write-review")
    let reportWebsiteURL = URL(string: "https://docs.google.com/forms/d/e/1FAIpQLSeox139lwja1Yl94dIZLSg8Ga8Wt4PAWSmRwtIe7NPb7WtHMA/viewform")!
    let starProjectURL = URL(string: "https://github.com/oblador/hush")!
    
    #if os(macOS)
    let verticalSpacing: CGFloat = 25
    #else
    let verticalSpacing: CGFloat = 40
    #endif
    
    var body: some View {
        VStack (alignment: .leading, spacing: verticalSpacing) {
            
            VStack (alignment: .leading, spacing: 5) {
                Text("Hush is enabled")
                    .font(.title)
                    .accessibilityIdentifier("extension enabled")
                 Text("You're now browsing without the nuisance.")
            }

            VStack (alignment: .leading, spacing: 10) {
                Text("Problem? ")
                    .bold() +
                Text("No problem! ")

                Link(destination: reportWebsiteURL, label: {
                    Text("Report website")
                        .underline()
                        .bold()
                        .foregroundColor(.primary)
                })
            }

            VStack (alignment: .leading, spacing: 10) {
                Text("Love it? ")
                    .bold() +
                    Text("Spread it! ")

                HStack (spacing: 0) {
                    Link(destination: reviewURL, label: {
                        Text("Review on App Store")
                            .underline()
                            .bold()
                            .foregroundColor(.primary)
                    })
                    Text(" or ")
                    Link(destination: starProjectURL, label: {
                        Text("star on GitHub")
                            .underline()
                            .bold()
                            .foregroundColor(.primary)
                    })
                }
            }
        }
    }
}

struct EnabledView_Previews: PreviewProvider {
    static var previews: some View {
        EnabledView()
    }
}

```

### Core Architecture Module: `Shared/Views/InstructionsView.swift`
```
import SwiftUI

struct Instruction: View {
    var imageName: String
    var label: Text
    
    var body: some View {
        HStack (alignment: .center, spacing: 10){
            Image(imageName)
                .resizable()
                .renderingMode(.template)
                .frame(width: 34, height: 34)
            label
        }
    }
}

struct InstructionsView: View {
    #if os(macOS)
    let verticalSpacing: CGFloat = 10
    #else
    let verticalSpacing: CGFloat = 20
    #endif

    var body: some View {
        VStack (alignment: .leading, spacing: 30) {
            VStack (alignment: .leading, spacing: 10) {
                Text("Hush is not enabled")
                    .font(.title)
                    .accessibilityIdentifier("extension disabled")
                Text("Follow these steps to enable:")
            }

            #if os(macOS)
            VStack (alignment: .leading, spacing: 10) {
                Instruction(
                    imageName: "Safari",
                    label:
                        Text("Open ") +
                        Text("Safari").bold()
                )
                Instruction(
                    imageName: "Settings",
                    label:
                        Text("Select ") +
                        Text("Extensions").bold() +
                        Text(" in ") +
                        Text("Preferences").bold()
                )
                Instruction(
                    imageName: "Checkbox",
                    label:
                        Text("Enable ") +
                        Text("Hush").bold()
                )
            }
            #else
            VStack (alignment: .leading, spacing: 15) {
                Instruction(
                    imageName: "Settings",
                    label:
                        Text("Open ") +
                        Text("Settings").bold() +
                        Text(" app")
                )
                Instruction(
                    imageName: "Safari",
                    label:
                        Text("Tap ") +
                        Text(
                            (ProcessInfo().operatingSystemVersion.majorVersion >= 18
                              ? "Apps → " : "") + "Safari → " + (ProcessInfo().operatingSystemVersion.majorVersion >= 15
                            ? "Extensions"
                            : "Content Blockers")).bold(
                              ))
                Instruction(
                    imageName: "Toggle",
                    label:
                        Text("Enable ") +
                        Text("Hush").bold()
                )
            }
            
            HStack(spacing: 0) {
                Text("Let's go! ")
                Link(destination: URL(string: UIApplication.openSettingsURLString)!, label: {
                    Text("Open Settings")
                        .underline()
                        .bold()
                        .foregroundColor(.primary)
                })
                Text(".")
            }
            #endif
        }
    }
}


struct InstructionsView_Previews: PreviewProvider {
    static var previews: some View {
        InstructionsView()
    }
}

```

### Core Architecture Module: `macOS/AppDelegate.swift`
```
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.windows.forEach { (window) in
            window.collectionBehavior = .fullScreenNone;
            window.tabbingMode = .disallowed;
        }
    }
}

```

### Core Architecture Module: `scripts/fetch-external.js`
```
import { hasUnsupportedSelectors } from "./src/validation.js";

const resolveRelative = (path) => new URL(path, import.meta.url).pathname;

const DESTINATION_DIR = resolveRelative("../data/vendor");
const SOURCES = {
  "fanboy-cookiemonster":
    "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
};

await Promise.all(
  Object.entries(SOURCES).map(async ([name, url]) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetching ${url} failed with status ${response.status}`);
    }
    const data = (await response.text())
      .split("\n")
      .filter((line) => !hasUnsupportedSelectors(line))
      .join("\n");
    const destination = `${DESTINATION_DIR}/${name}.txt`;
    await Deno.writeTextFile(destination, data);
    console.info(`Saved ${url} to ${destination}`);
  }),
);

```

### Core Architecture Module: `scripts/src/convert.js`
```
import punycode from "https://deno.land/x/punycode/punycode.js";
import { hasUnsupportedSelectors } from "./validation.js";

const COMMENT_PREFIX = "!";
const ELEMENT_HIDE_SEPARATOR = "##";
const ELEMENT_HIDE_EXCEPTION_SEPARATOR = "#@#";
const BLOCK_PREFIX = "||";
const EXCEPTION_PREFIX = "@@";
const OPTION_SEPARATOR = "$";
const RESOURCE_TYPES = [
  "document",
  "image",
  "style-sheet",
  "script",
  "font",
  "raw",
  "svg-document",
  "media",
  "popup",
];

// Unsupported
const ANCHOR = "|";
const EXTENDED_SELECTOR_SEPARATOR = "#?#";
const SNIPPET_SEPARATOR = "#$#";

const isRule = (line) =>
  Boolean(line) && !line.startsWith(COMMENT_PREFIX) &&
  !line.startsWith("[Adblock");
const isBlock = (line) => line.startsWith(BLOCK_PREFIX);
const isExactAddressBlock = (line) => line.startsWith(ANCHOR) && !isBlock(line);
const isException = (line) => line.startsWith(EXCEPTION_PREFIX);
const isElementHide = (line) => line.includes(ELEMENT_HIDE_SEPARATOR);
const isElementHideException = (line) =>
  line.includes(ELEMENT_HIDE_EXCEPTION_SEPARATOR);
const isExtendedSelector = (line) => line.includes(EXTENDED_SELECTOR_SEPARATOR);
const isSnippet = (line) => line.includes(SNIPPET_SEPARATOR);

const isDomainExemption = (domain) => domain[0] === "~";

const parseOptions = (options) =>
  (options || "")
    .split(",")
    .filter(Boolean)
    .map((option) => {
      if (option.includes("=")) {
        return option.split("=");
      }
      if (option.startsWith("~")) {
        return [option.substr(1), false];
      }
      return [option, true];
    });

const mapResourceType = (type) => {
  switch (type) {
    case "stylesheet":
      return "style-sheet";
    case "subdocument":
      return "document";
    // Not perfect match, but probably good enough
    case "xmlhttprequest":
    case "other":
      return "raw";
    default:
      return type;
  }
};

const isResourceTypeOption = ([option, value]) =>
  typeof value === "boolean" && option !== "third-party" &&
  !option.startsWith("generic");

const mapOptionsToTrigger = (options) =>
  parseOptions(options)
    .reduce((acc, optionTuple, index, array) => {
      const [option, value] = optionTuple;
      if (isResourceTypeOption(optionTuple)) {
        const firstResourceType = array.find(isResourceTypeOption);
        if (value !== firstResourceType[1]) {
          throw new Error(
            `Resource type options might not mix includes and excludes, got "${options}"`,
          );
        }
      }

      switch (option) {
        case "domain": {
          const isExemptedDomains = isDomainExemption(value);
          const domains = value
            .split(/\|/g)
            .filter(Boolean)
            .map((domain) => {
              const isExemption = isDomainExemption(domain);
              if (
                !isExemptedDomains && isExemption ||
                isExemptedDomains && !isExemption
              ) {
                throw new Error(
                  `Domain option might not mix includes and excludes, got "${value}"`,
                );
              }
              return `*${punycode.toASCII(domain.substr(isExemption ? 1 : 0))}`;
            });
          if (!domains.length) {
            break;
          }
          acc[isExemptedDomains ? "unless-domain" : "if-domain"] = domains;
          break;
        }
        case "third-party": {
          acc["load-type"] = [value ? "third-party" : "first-party"];
          break;
        }
        case "font":
        case "media":
        case "other":
        case "subdocument":
        case "xmlhttprequest":
        case "document":
        case "image":
        case "popup":
        case "script":
        case "stylesheet": {
          const resourceType = mapResourceType(option);
          if (value === false) {
            acc["resource-type"] = (acc["resource-type"] || RESOURCE_TYPES)
              .filter((t) => t !== resourceType);
          } else {
            acc["resource-type"] = (acc["resource-type"] || []).concat(
              resourceType,
            );
          }
          break;
        }
        case "generichide":
        case "genericblock": {
          // This will cause the exemption to be applied to all previous rules,
          // while not perfect, it's safer than ignoring it
          break;
        }
        default: {
          throw new Error(`Unsupported option "${option}"`);
        }
      }
      return acc;
    }, {});

const mapFilterToRegExp = (filter) =>
  punycode.toASCII(filter)
    .replace(/[-\/\\$+?.()|[\]{}]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\^$/, "([?/].*)?$")
    .replace(/\^/, "[?/]");

const mapBlockLineToFilter = (line) => {
  const [filter, options] = line.split(
    OPTION_SEPARATOR,
  );
  return {
    "url-filter": mapFilterToRegExp(filter),
    ...mapOptionsToTrigger(options),
  };
};

export const transformLine = (line) => {
  if (isExactAddressBlock(line)) {
    throw new Error(`Exact address block parsing not supported, got "${line}"`);
  }
  if (isExtendedSelector(line)) {
    throw new Error(`Extended selector parsing not supported, got "${line}"`);
  }
  if (isSnippet(line)) {
    throw new Error(`Snippet block parsing not supported, got "${line}"`);
  }

  if (isElementHide(line) || isElementHideException(line)) {
    const separator = isElementHideException(line)
      ? ELEMENT_HIDE_EXCEPTION_SEPARATOR
      : ELEMENT_HIDE_SEPARATOR;
    const [domains, selector] = line.split(separator);
    if (hasUnsupportedSelectors(selector)) {
      throw new Error(`Custom CSS extensions not supported, got "${line}"`);
    }
    return {
      trigger: {
        "url-filter": ".*",
        ...(domains
          ? {
            "if-domain": domains.split(",").map((domain) =>
              `*${punycode.toASCII(domain)}`
            ),
          }
          : {}),
      },
      action: isElementHideException(line)
        ? {
          type: "ignore-previous-rules",
        }
        : {
          type: "css-display-none",
          selector: selector,
        },
    };
  }

  // This is a block filter since we excluded all other possible types

  // TODO: I don't understand the difference between || rules and
  // those without. I think || will also match domain name and the others
  // only path name, however currently we match the whole URL for both.
  return {
    trigger: mapBlockLineToFilter(
      line
        .replace(/^@@/, "")
        .replace(/^[|]{2}/, ""),
    ),
    action: {
      type: isException(line) ? "ignore-previous-rules" : "block",
    },
  };
};

const trim = (s) => s.trim();

export function convert(data) {
  return data
    .split("\n")
    .map(trim)
    .filter(isRule)
    .map(transformLine);
}

```

### Core Architecture Module: `scripts/src/validation.js`
```
export const hasUnsupportedSelectors = (selector) =>
  selector.includes(":has-text") ||
  selector.includes(":xpath") ||
  selector.includes(":-abp");

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #322** (2026-07-26): **Fix UI tests**
  *Symptoms*: 

- **Issue #321** (2026-07-26): **Updated rules 2026-07-26**
  *Symptoms*: Fixes https://github.com/oblador/hush/issues/320 et al

- **Issue #320** (2026-07-26): **Hush breaks The Verge's YouTube embeds**
  *Symptoms*: Safari 26.5 on MacOS Sequoia 15.7.7:  With Hush enabled, the YouTube embed on this Verge post doesn't appear. Disable Hush and it appears:  https://www.theverge.com/podcast/950082/markdown-history-gruber-vergecast  
  **Post-Mortem & Fix Analysis**:
  > Fix out in 1.0.19 👍 

- **Issue #317** (2026-02-27): **Updated rules 2026-02-27**
  *Symptoms*: 

- **Issue #305** (2026-07-27): **https://melee.gg/**
  *Symptoms*: Cookie consent isn't shown leaving the page inoperable iOS Safari 18.5.  After disabling Hush (Settings - Safari - Extendions) and reloading the page the consent is shown and I can navigate normally on the site.

- **Issue #302** (2025-01-07): **ngtsang13@gmail.com**
  *Symptoms*: Hj
  **Post-Mortem & Fix Analysis**:
  > ]()]()**[]()**

- **Issue #301** (2024-12-12): **Updated rules 2023-12-12**
  *Symptoms*: 

- **Issue #300** (2024-12-12): **Create Hush**
  *Symptoms*: 

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

### Incident Patch 1: `2e96f4f7` (2026-07-26)
**Commit Message**: Fix UI tests (#322)

**File**: `HushUITests/HushUITests.swift` (modified, +41/-9)
```diff
@@ -14,24 +14,56 @@ class HushUITests: XCTestCase {
     override func tearDownWithError() throws {
         app.terminate()
     }
-    
+
+    // Settings uses a virtualized collection view, so off-screen rows are not in
+    // the accessibility tree until scrolled into view.
+    private func scrollToAndTap(_ label: String) {
+        let element = settingsApp.staticTexts[label]
+        var attempts = 0
+        while !element.isHittable && attempts < 15 {
+            settingsApp.swipeUp()
+            attempts += 1
+        }
+        XCTAssertTrue(element.isHittable, "Could not find \"\(label)\" in Settings")
+        element.tap()
+    }
+
     private func toggleContentBlockerEnabled(isOn: Bool) throws {
         settingsApp.launch()
-        settingsApp.tables.cells.staticTexts["Safari"].tap()
-        settingsApp.tables.cells.staticTexts["Extensions"].firstMatch.tap()
-        if settingsApp.switches["Hush"].value as? String != (isOn ? "1" : "0") {
-            settingsApp.switches["Hush"].tap()
+        // Settings → Apps → Safari → Extensions → Hush → Allow Extension
+        scrollToAndTap("Apps")
+        scrollToAndTap("Safari")
+        scrollToAndTap("Extensions")
+        settingsApp.buttons["se.oblador.Hush.ContentBlocker"].firstMatch.tap()
+        let toggle = settingsApp.switches["Allow Extension"].firstMatch
+        XCTAssertTrue(toggle.waitForExistence(timeout: 5), "Allow Extension switch not found")
+        if toggle.value as? String != (isOn ? "1" : "0") {
+            // The switch's accessibility frame spans the whole row, so its centre is
+            // over the label. Tap near the trailing edge where the control actually is.
+            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
         }
         settingsApp.terminate()
     }
 
+    // The app only re-queries the content blocker state on foreground, and enabling
+    // the blocker can take a moment to settle, so re-foreground until it is shown.
+    private func assertAppShows(_ identifier: String, timeout: TimeInterval = 30) {
+        let deadline = Date().addingTimeInterval(timeout)
+        repeat {
+            app.activate()
+            if app.staticTexts[identifier].waitForExistence(timeout: 3) {
+                return
+            }
+            XCUIDevice.shared.press(.home)
+        } while Date() < deadline
+        XCTFail("App did not show \"\(identifier)\" within \(timeout)s")
+    }
+
     func testSettingsIntegration() throws {
         app.launch()
         try toggleContentBlockerEnabled(isOn: false)
-        app.activate()
-        XCTAssertTrue(app.staticTexts["extension disabled"].exists)
+        assertAppShows("extension disabled")
         try toggleContentBlockerEnabled(isOn: true)
-        app.activate()
-        XCTAssertTrue(app.staticTexts["extension enabled"].exists)
+        assertAppShows("extension enabled")
     }
 }
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ test_unit:
 	deno test
 
 test_ui:
-	xcodebuild test -project Hush.xcodeproj -scheme 'Hush iOS' -destination 'platform=iOS Simulator,name=iPhone 8'
+	xcodebuild test -project Hush.xcodeproj -scheme 'Hush iOS' -destination 'platform=iOS Simulator,name=iPhone 17'
 
 fetch_external:
 	deno run --allow-write=./data --allow-net scripts/fetch-external.js
```

---

### Incident Patch 2: `6cf4330b` (2022-01-02)
**Commit Message**: Fix UI Tests (#154)

**File**: `Hush.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -468,7 +468,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "export PATH=\"$PATH:$HOME/.deno/bin\"\nmake xcode\n";
+			shellScript = "export PATH=\"$PATH:$HOME/.deno/bin:/opt/homebrew/bin\"\n\nmake xcode\n";
 		};
 		A4E2FFD4258A401900F0E52A /* Build block list */ = {
 			isa = PBXShellScriptBuildPhase;
@@ -487,7 +487,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "export PATH=\"$PATH:$HOME/.deno/bin\"\nmake xcode\n";
+			shellScript = "export PATH=\"$PATH:$HOME/.deno/bin:/opt/homebrew/bin\"\n\nmake xcode\n";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

**File**: `HushUITests/HushUITests.swift` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ class HushUITests: XCTestCase {
     private func toggleContentBlockerEnabled(isOn: Bool) throws {
         settingsApp.launch()
         settingsApp.tables.cells.staticTexts["Safari"].tap()
-        settingsApp.tables.cells.staticTexts["Content Blockers"].firstMatch.tap()
+        settingsApp.tables.cells.staticTexts["Extensions"].firstMatch.tap()
         if settingsApp.switches["Hush"].value as? String != (isOn ? "1" : "0") {
             settingsApp.switches["Hush"].tap()
         }
```

---

### Incident Patch 3: `4a9f5cb4` (2021-01-31)
**Commit Message**: Revert "Automatic updating of block rules (#51)"

This reverts commit a9a8edf8fc2b3a2d461f1b68716a11d1aef6ebf2.

**File**: `.github/workflows/release.yml` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-name: Release
-
-on:
-  push:
-    branches:
-      - master
-  schedule:
-    - cron: "0 0 * * *" # once per day
-
-jobs:
-  unit:
-    name: Build block list
-    runs-on: ubuntu-latest
-
-    steps:
-      - uses: actions/checkout@v2
-      - uses: denolib/setup-deno@v2
-        with:
-          deno-version: v1.x
-      - name: Update and release block list
-        run: |
-          make fetch_external
-          MINIFY=1 make blocklist --silent > block-list-v1.json
-          git config user.name github-actions
-          git config user.email github-actions@github.com
-          git checkout --orphan build-latest
-          git reset
-          git add data block-list-v1.json
-          git commit -m "Generate block list"
-          git push -f origin build-latest
```

**File**: `Hush.xcodeproj/project.pbxproj` (modified, +1/-41)
```diff
@@ -8,7 +8,6 @@
 
 /* Begin PBXBuildFile section */
 		A43F418525975CFD0043E80E /* HushUITests.swift in Sources */ = {isa = PBXBuildFile; fileRef = A43F418425975CFD0043E80E /* HushUITests.swift */; };
-		A4432E9F25C6D77E00BE0059 /* BlockListManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4F2DAF7258D074500A7DAA5 /* BlockListManager.swift */; };
 		A4D9A0FF258A02B4009D7004 /* HushApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A0EC258A02B2009D7004 /* HushApp.swift */; };
 		A4D9A100258A02B4009D7004 /* HushApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A0EC258A02B2009D7004 /* HushApp.swift */; };
 		A4D9A103258A02B4009D7004 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A4D9A0EE258A02B4009D7004 /* Assets.xcassets */; };
@@ -29,14 +28,7 @@
 		A4E2FFC3258A30B700F0E52A /* EnabledView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E2FFC2258A30B700F0E52A /* EnabledView.swift */; };
 		A4E2FFC4258A30B700F0E52A /* EnabledView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E2FFC2258A30B700F0E52A /* EnabledView.swift */; };
 		A4E2FFCB258A339700F0E52A /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E2FFC9258A339700F0E52A /* AppDelegate.swift */; };
-		A4E52C8125C7019500DD1255 /* UserDefaults.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52C8025C7019500DD1255 /* UserDefaults.swift */; };
-		A4E52C8225C7019500DD1255 /* UserDefaults.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52C8025C7019500DD1255 /* UserDefaults.swift */; };
-		A4E52CA925C713F000DD1255 /* Config.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52CA825C713EF00DD1255 /* Config.swift */; };
-		A4E52CAA25C713F000DD1255 /* Config.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52CA825C713EF00DD1255 /* Config.swift */; };
-		A4E52CAB25C713F000DD1255 /* Config.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52CA825C713EF00DD1255 /* Config.swift */; };
-		A4E52CAC25C713F000DD1255 /* Config.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4E52CA825C713EF00DD1255 /* Config.swift */; };
 		A4F2DABB258CF46D00A7DAA5 /* InstructionsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A158258A06F4009D7004 /* InstructionsView.swift */; };
-		A4F2DAF8258D074500A7DAA5 /* BlockListManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4F2DAF7258D074500A7DAA5 /* BlockListManager.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -92,7 +84,6 @@
 		A43F418225975CFD0043E80E /* HushUITests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = HushUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
 		A43F418425975CFD0043E80E /* HushUITests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HushUITests.swift; sourceTree = "<group>"; };
 		A43F418625975CFD0043E80E /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
-		A4432EA525C6D90A00BE0059 /* BackgroundTasks.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = BackgroundTasks.framework; path = System/Library/Frameworks/BackgroundTasks.framework; sourceTree = SDKROOT; };
 		A4D9A0EC258A02B2009D7004 /* HushApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HushApp.swift; sourceTree = "<group>"; };
 		A4D9A0EE258A02B4009D7004 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
 		A4D9A0F3258A02B4009D7004 /* Hush.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Hush.app; sourceTree = BUILT_PRODUCTS_DIR; };
@@ -114,11 +105,6 @@
 		A4E2004E258A5C9500F0E52A /* Launch Screen.storyboard */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; path = "Launch Screen.storyboard"; sourceTree = "<group>"; };
 		A4E2FFC2258A30B700F0E52A /* EnabledView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EnabledView.swift; sourceTree = "<group>"; };
 		A4E2FFC9258A339700F0E52A /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
-		A4E52C8025C7019500DD1255 /* UserDefaults.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UserDefaults.swift; sourceTree = "<group>"; };
-		A4E52C8825C7095C00DD1255 /* iOS.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = iOS.entitlements; sourceTree = "<group>"; };
-		A4E52C8925C7099300DD1255 /* ContentBlocker.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ContentBlocker.entitlements; sourceTree = "<group>"; };
-		A4E52CA825C713EF00DD1255 /* Config.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcec
```

**File**: `Hush.xcodeproj/xcshareddata/xcschemes/Hush iOS.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "1240"
+   LastUpgradeVersion = "1230"
    version = "1.3">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `Hush.xcodeproj/xcshareddata/xcschemes/Hush macOS.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "1240"
+   LastUpgradeVersion = "1230"
    version = "1.3">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `Shared/Assets.xcassets/Checkbox Off.imageset/Contents.json` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-{
-  "images" : [
-    {
-      "filename" : "Checkbox Off.png",
-      "idiom" : "universal",
-      "scale" : "1x"
-    },
-    {
-      "filename" : "Checkbox Off@2x.png",
-      "idiom" : "universal",
-      "scale" : "2x"
-    },
-    {
-      "filename" : "Checkbox Off@3x.png",
-      "idiom" : "universal",
-      "scale" : "3x"
-    }
-  ],
-  "info" : {
-    "author" : "xcode",
-    "version" : 1
-  }
-}
```

**File**: `Shared/Assets.xcassets/Checkbox On.imageset/Contents.json` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-{
-  "images" : [
-    {
-      "filename" : "Checkbox On.png",
-      "idiom" : "universal",
-      "scale" : "1x"
-    },
-    {
-      "filename" : "Checkbox On@2x.png",
-      "idiom" : "universal",
-      "scale" : "2x"
-    },
-    {
-      "filename" : "Checkbox On@3x.png",
-      "idiom" : "universal",
-      "scale" : "3x"
-    }
-  ],
-  "info" : {
-    "author" : "xcode",
-    "version" : 1
-  }
-}
```

**File**: `Shared/Config.swift` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-import Foundation
-
-class Config {
-    static let appGroupName = "se.oblador.Hush"
-    static let bundleIndentifier = Bundle.main.bundleIdentifier ?? appGroupName
-    #if os(macOS)
-    public static let appGroupIdentifier = "\(Bundle.main.object(forInfoDictionaryKey: "TeamIdentifierPrefix") ?? "H28Z7NT4JR.")group.\(appGroupName)"
-    #else
-    public  static let appGroupIdentifier = "group.\(appGroupName)"
-    #endif
-    public static let contentBlockerIdentifier = "\(bundleIndentifier).ContentBlocker"
-    public static let fetchRulesTaskIdentifier = "\(bundleIndentifier).fetchRules"
-    public static let blockListDownloadURL = "https://raw.githubusercontent.com/oblador/hush/build-latest/block-list-v1.json"
-}
```

**File**: `Shared/ContentBlockerRequestHandler.swift` (modified, +1/-7)
```diff
@@ -2,13 +2,7 @@ import Foundation
 
 class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
     func beginRequest(with context: NSExtensionContext) {
-        var blockListURL = Bundle.main.url(forResource: "blockerList", withExtension: "json")
-        let appGroupDirectory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier)
-        let downloadedBlockListURL = appGroupDirectory?.appendingPathComponent("blockerList.json")
-        if (FileManager.default.fileExists(atPath: downloadedBlockListURL!.path)) {
-            blockListURL = downloadedBlockListURL
-        }
-        let attachment = NSItemProvider(contentsOf: blockListURL)!
+        let attachment = NSItemProvider(contentsOf: Bundle.main.url(forResource: "blockerList", withExtension: "json"))!
 
         let item = NSExtensionItem()
         item.attachments = [attachment]
```

---

### Incident Patch 4: `133810b4` (2021-01-24)
**Commit Message**: Fix iOS requirement typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Hush is private, free and fast – [read more on the website](https://oblador.gi
 
 [![](https://linkmaker.itunes.apple.com/assets/shared/badges/en-us/appstore-lrg.svg)](https://apps.apple.com/app/id1544743900)
 
-Requires iOS 10.14 or later.
+Requires iOS 14 or later.
 
 ### macOS
 
```

---

### Incident Patch 5: `7a1a55b1` (2021-01-24)
**Commit Message**: Fix macOS instructions copy: rename to Preferences (#11)

**File**: `Shared/Views/InstructionsView.swift` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ struct InstructionsView: View {
                         Text("Select ") +
                         Text("Extensions").bold() +
                         Text(" in ") +
-                        Text("Settings").bold()
+                        Text("Preferences").bold()
                 )
                 Instruction(
                     imageName: "Checkbox",
```

---

### Incident Patch 6: `46f04efa` (2021-01-23)
**Commit Message**: Tweak copy and fix typos (#4)

**File**: `README.md` (modified, +28/-3)
```diff
@@ -1,5 +1,5 @@
 <div align="center">
-  <a href="https://oblador.github.io/hush"><img src="https://user-images.githubusercontent.com/378279/102943111-6dfe0500-44b7-11eb-9e9a-1c77d53a04ab.png" width="256" height="256"></a>
+  <a href="https://oblador.github.io/hush/"><img src="https://user-images.githubusercontent.com/378279/102943111-6dfe0500-44b7-11eb-9e9a-1c77d53a04ab.png" width="256" height="256"></a>
   <h1>Hush</h1>
   <p>
     <b>Block nags to accept cookies and privacy invasive tracking in Safari</b>
@@ -9,6 +9,8 @@
   <br>
 </div>
 
+Hush is private, free and fast – [read more on the website](https://oblador.github.io/hush/).
+
 ## Download
 
 ### iOS
@@ -19,14 +21,37 @@ Requires iOS 10.14 or later.
 
 ### macOS
 
-Pending approval for Mac App Store. [Direct download](https://github.com/oblador/hush/releases/latest/download/Hush.dmg).
+[![](https://linkmaker.itunes.apple.com/assets/shared/badges/en-us/macappstore-lrg.svg)](https://apps.apple.com/app/id1544743900)
 
-Requires macOS 11 or later.
+Requires macOS 11 or later. [Direct download](https://github.com/oblador/hush/releases/latest/download/Hush.dmg).
 
 ## Screenshots
 
 <img width="432" src="https://user-images.githubusercontent.com/378279/102943263-da790400-44b7-11eb-9c4e-ee6870da3c24.png">
 
+## Features
+
+### Private
+Unlike some blockers, Hush has absolutely no access to your browser habits or passwords. Nor does it track behavior or collect crash reports - nothing leaves your device.
+
+### Free
+Everything is free of charge. Forever. No in-app purchases, no nonsense. However, any help towards covering the yearly Apple Developer fee is greatly appreciated.
+
+### Fast
+The app is primarily a host of rules that integrates with Safari in a native, lightweight way, making the blocking efficient and fast.
+
+### Simple
+It's as easy as downloading the app and enabling it in Safari settings ⭢ Content Blockers. No configuration or maintenance needed.
+
+### Open Source
+The source code is published under the permissive MIT license.
+
+### Modern
+Hush is written in Apple's latest programming paradigm Swift UI and has native support for M1 processors.
+
+### Tiny
+The app download clocks in at less than half a megabyte.
+
 ## Building from source
 
 To build the app in Xcode, you need to have [deno](https://deno.land) installed first:
```

**File**: `Shared/Views/InstructionsView.swift` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ struct InstructionsView: View {
             }
             
             HStack(spacing: 0) {
-                Text("Lets go! ")
+                Text("Let's go! ")
                 Link(destination: URL(string: UIApplication.openSettingsURLString)!, label: {
                     Text("Open Settings")
                         .underline()
```

**File**: `docs/index.html` (modified, +16/-1)
```diff
@@ -58,7 +58,21 @@
 }
 
 .summary h2 {
-  margin: 3rem 0 1rem 0;
+  margin: 3rem 0 0.5rem 0;
+}
+
+.summary h3 {
+  font-size: 1rem;
+  margin: 0 0 1rem 0;
+  font-weight: 500;
+}
+
+.summary h3 a {
+  text-decoration: none
+}
+
+.summary h3 a:hover {
+  text-decoration: underline;
 }
 
 .summary p {
@@ -423,6 +437,7 @@
       <h1><svg width="300" height="228" xmlns="http://www.w3.org/2000/svg" alt="Hush"><g fill="#000" fill-rule="evenodd"><circle cx="69.276" cy="26.923" r="26.923"/><circle cx="226.199" cy="26.923" r="26.923"/><path d="M.003 227.804l23.89-23.89-16.71-16.709 16.703-16.702L7.17 153.79l16.712-16.713L0 113.193l299.872.007-23.88 23.88 16.715 16.714-16.712 16.713 16.7 16.699-16.702 16.702 23.883 23.883-299.873.013zm53.844-33.121h11.764v-19.775h17.882v19.775h11.764v-51.28H83.493v19.775H65.611v-19.776H53.847v51.281zm47.968.068h41.174v-51.01h-11.697v39.313h-17.747l-.033-39.314h-11.697v51.01zm48.104-19.708h29.443v7.978l-29.443-.034v11.696h41.14V163.38h-29.444v-7.944h29.443l-.068-11.696H149.92v31.303zm47.934 19.64h11.764v-19.775h17.882v19.775h11.764v-51.28h-11.764v19.775h-17.882v-19.776h-11.764v51.281z" fill-rule="nonzero"/></g></svg></h1>
 
       <h2>Noiseless Browsing</h2>
+      <h3>by <a href="https://oblador.se/">Joel Arvidsson</a></h3>
       <p>Block nags to accept cookies and privacy  invasive tracking in Safari on Mac, iPhone and iPad.</p>
 
       <div class="social">
```

**File**: `macOS/ContentBlocker/Info.plist` (modified, +1/-1)
```diff
@@ -32,6 +32,6 @@
 		<string>$(PRODUCT_MODULE_NAME).ContentBlockerRequestHandler</string>
 	</dict>
 	<key>NSHumanReadableDescription</key>
-	<string>Get rid of annoying cookie notices and tracking consent notices while keeping your privacy.</string>
+	<string>Block annoying cookie and tracking consent notices while keeping your privacy.</string>
 </dict>
 </plist>
```

---

### Incident Patch 7: `0b0126f9` (2021-01-21)
**Commit Message**: Fix typo on website (#3)

**File**: `docs/index.html` (modified, +1/-1)
```diff
@@ -509,7 +509,7 @@ <h3>Sign up for our newsletter</h3>
     <div class="usp">
       <svg width="193" height="150" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="nonzero"><path d="M147.995 79.92c-16.872.05-31.309 12.127-34.338 28.725a57.364 57.364 0 00-33.75 0c-3.278-17.949-19.804-30.36-37.955-28.507C23.8 81.993 10.126 97.49 10.545 115.731c.42 18.24 14.792 33.093 33.01 34.111 18.216 1.018 34.154-12.14 36.604-30.22a46.977 46.977 0 0133.35 0c2.554 18.508 19.222 31.73 37.826 30.004 18.604-1.725 32.556-17.787 31.662-36.45-.894-18.662-16.318-33.316-35.002-33.256zM45.463 139.283c-13.37.023-24.275-10.703-24.474-24.07-.2-13.368 10.38-24.414 23.744-24.79 13.364-.376 24.549 10.058 25.101 23.416a5.152 5.152 0 00-.147 3.995c-1.516 12.233-11.898 21.426-24.224 21.449zm102.532 0c-12.326-.023-22.708-9.216-24.224-21.449a5.152 5.152 0 00-.147-3.995c.563-13.34 11.739-23.753 25.085-23.374 13.347.38 23.913 11.41 23.718 24.761-.196 13.35-11.08 24.068-24.432 24.057zM187.507 51.133h-15.35l-9.694-34.717C159.876 7.164 151.213.203 142.297.203H51.16c-8.916 0-17.58 6.96-20.166 16.213l-9.694 34.717H5.951a5.257 5.257 0 100 10.514h181.556a5.257 5.257 0 000-10.514zm-155.271 0l8.895-31.9c1.283-4.626 5.888-8.516 10.03-8.516h91.136c4.205 0 8.747 3.89 10.03 8.517l8.895 31.9H32.236z"/></g></svg>
       <h2>Private</h2>
-      <p>Unlike some blockers, Hush has absolutely no access to your browser habits or passwords. Nor does it track behavoir or collect crash reports - <strong>nothing leaves your device</strong>.</p>
+      <p>Unlike some blockers, Hush has absolutely no access to your browser habits or passwords. Nor does it track behavior or collect crash reports - <strong>nothing leaves your device</strong>.</p>
     </div>
     <div class="usp">
       <svg width="146" height="146" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="nonzero"><path d="M78.619 68.804h-1.227v-22.85h1.227c5.06 0 9.507 3.374 10.887 8.435.614 2.3 3.068 3.68 5.368 3.067 2.3-.613 3.68-3.067 3.067-5.367-2.3-8.741-10.275-14.722-19.322-14.722h-1.227V25.099c0-2.454-1.994-4.294-4.294-4.294-2.454 0-4.294 1.993-4.294 4.294v12.268h-1.227a19.955 19.955 0 00-14.108 5.827c-3.834 3.834-5.828 8.741-5.828 14.109 0 11.04 9.048 20.089 20.09 20.089h1.226v22.696h-1.226c-5.061 0-9.508-3.374-10.888-8.128-.46-1.993-2.147-3.527-4.294-3.527-2.454 0-4.294 1.994-4.294 4.294 0 .46 0 .767.153 1.227 2.454 8.74 10.275 14.722 19.323 14.722h1.226v12.268c0 2.453 1.994 4.294 4.294 4.294 2.454 0 4.294-1.994 4.294-4.294v-12.268h1.227c11.041 0 20.089-9.048 20.089-20.09a19.955 19.955 0 00-5.827-14.108c-3.988-3.68-9.048-5.674-14.415-5.674zm-11.042 0A11.322 11.322 0 0156.23 57.456c0-3.067 1.227-5.98 3.22-7.974 2.147-2.147 5.061-3.374 7.975-3.374h1.227v22.696h-1.074zm11.042 31.437h-1.227v-22.85h1.227c3.067 0 5.827 1.228 7.974 3.374 2.147 2.147 3.22 4.908 3.22 7.975.154 6.287-4.907 11.501-11.194 11.501z"/><path d="M73.098.256C32.92.256.256 32.92.256 73.098S32.92 145.94 73.098 145.94s72.842-32.664 72.842-72.842S113.276.256 73.098.256zM8.997 73.098c0-16.102 5.98-30.824 15.948-42.172l10.888 10.888c.92.92 1.994 1.227 3.067 1.227 1.074 0 2.147-.46 3.067-1.227a4.35 4.35 0 000-6.134L31.08 24.792C42.427 14.977 57.15 8.843 73.251 8.843c35.425 0 64.101 28.83 64.101 64.101 0 16.102-5.98 30.824-15.948 42.172l-10.888-10.888a4.35 4.35 0 00-6.134 0 4.35 4.35 0 000 6.134l10.888 10.888C103.922 131.065 89.2 137.2 73.098 137.2c-35.425 0-64.101-28.677-64.101-64.101z"/></g></svg>
```

---

### Incident Patch 8: `b3b4be5e` (2020-12-23)
**Commit Message**: Fix Safari rendering issues

**File**: `docs/index.html` (modified, +8/-0)
```diff
@@ -136,6 +136,10 @@
   border-radius: 40px;
   overflow: hidden;
   padding-top: 5.5rem;
+  -webkit-backface-visibility: hidden;
+  -moz-backface-visibility: hidden;
+  -webkit-transform: translate3d(0, 0, 0);
+  -moz-transform: translate3d(0, 0, 0);
 }
 
 .iphone-notch {
@@ -234,6 +238,10 @@
   border-color: #fff;
 }
 
+.nag input {
+  width: 8rem;
+}
+
 .nag-tracking {
   align-items: flex-end;
 }
```

---

### Incident Patch 9: `ea814b1c` (2020-12-16)
**Commit Message**: Strip rules with custom css extensions

**File**: `data/block-the-eu-cookie-shit-list.txt` (modified, +0/-10)
```diff
@@ -734,7 +734,6 @@
 @@||tweakers.net^$document
 accuweather.com###eu-cookie-notify-wrap
 actu-environnement.com###informations-cookies
-akka.io##.optanon-alert-box-wrapper:has-text(This site uses cookies)
 allrecipes.com###privacyNotification
 ancestry.co.uk###Banner_50001
 ancestry.co.uk###Banner_cookie_1
@@ -802,8 +801,6 @@ claireperry.org.uk###message
 clarkewillmott.com###cookiestext
 cloud.digitalocean.com##.cc-window[aria-label="cookieconsent"]
 cloudflare.com##.eu-cookie-banner
-cnbc.com###_evh-ric:has-text(cookies)
-cnn.com##.optanon-alert-box-wrapper:has-text(We use cookies)
 co-operativebank.co.uk###noticePanel
 codehousegroup.com/js/libs/cookie-check.js$script
 cofunds.co.uk##.idrPageRow[style^="min-height:0;height:auto;padding:0;position:relative;z-index:1;zoom:1;border:none;"]
@@ -830,7 +827,6 @@ digitaltrends.com##body.cookie-dialog-up:style(overflow:auto !important)
 diy.com###noScriptCookies
 dolce-gusto.co.uk###nimgrowler
 dostavanadom.com###cookies
-downdetector.com###overlay.container:has-text(use cookies to provide)
 dr.dk##.dr-cookie-info-box
 dr.dk##.dr-infobox
 dr.dk##DIV[class="cookie-info-box"]
@@ -925,7 +921,6 @@ ipnordic.dk##.ultimize_cookie_notification_container
 istockphoto.com###euCookieBar
 itele.fr###cnil_alert_inner
 itworld.com##body:style(overflow:auto !important)
-itworld.com##body>div:has-text(We care about your privacy)
 jman.tv###ActionBar
 jobindex.dk##.jix_acceptcookies_box
 jobs.ac.uk##.eucookies
@@ -970,7 +965,6 @@ mclaren.com###block-cookie-info
 mclarenstore.com##.widget-notifyBar
 media.netflix.com#@##cookieAlert
 mediapart.fr###cnil-sentence
-meetup.com##div.stripe:has-text(We use cookies)
 mercialys.fr##.info-top
 merlin.pl##.cookies_policy
 miniclip.com###eu-cookie
@@ -1008,7 +1002,6 @@ nrc.nl##.cookiemonster
 nwolb.com###ctl00_privacyCookies_LIPCNB_PrivacyandCookiesNoticePanel
 nyhederne.tv2.dk###tv2cookiebar
 nyheter24.se###acceptCookiesDiv
-nytimes.com##div.shown:has-text(Review our cookie policy)
 o2.co.uk#@#.cookies
 olvg.nl###cc
 onlive.co.uk##.top_message
@@ -1072,7 +1065,6 @@ savi-france.fr###notifybar
 seetickets.com##.cookieslaw
 seloger.com##.container_cookies
 serverfault.com###js-gdpr-consent-banner
-showcasecinemas.co.uk##div.section-prompt:has-text(About Cookies)
 shropshirestar.com##.inner
 siepisze.pl##div[class^="pea_cook_wrapper"]
 singaporeair.com##.popup--cookie.popup-1
@@ -1111,7 +1103,6 @@ tandfonline.com##.b-header
 tddirectinvesting.co.uk###cookieWindowContainer
 techradar.com###cmp-container-id
 techradar.com##.cc-banner
-techrepublic.com###_evidon_banner:has-text(use cookies for personalized)
 techrepublic.com###cookieCont
 telmore.dk###CookieDiv
 tesco.com###cp
@@ -1215,7 +1206,6 @@ www.sentres.com##.cookies-eu
 www.tf1.fr##.banner_cookies
 www.theguardian.com##.site-message--cookies.site-message--banner.js-site-message.site-message
 www.vobadirekt.de##.lightbox--cookie-consent
-www.vobadirekt.de##:xpath(//*[contains(@class, "darken-layer") and /*//*[contains(@class, "lightbox--cookie-consent")]])
 www.wykop.pl##DIV[class="annotation type-alert type-permanent lspace m-reset-position closableContainer"]
 zenska.si#@##cookie-bar
 zonaforo.meristation.com##.inner
```

**File**: `scripts/src/convert.js` (modified, +3/-0)
```diff
@@ -76,6 +76,9 @@ const transformLine = (line) => {
       ? ELEMENT_HIDE_EXCEPTION_SEPARATOR
       : ELEMENT_HIDE_SEPARATOR;
     const [domains, selector] = line.split(separator);
+    if (selector.includes(':has-text') || selector.includes(':xpath')) {
+    	throw new Error(`Custom CSS extensions not supported, got "${line}"`)
+    }
     return {
       trigger: {
         "url-filter": ".*",
```

---

### Incident Patch 10: `5cac0970` (2020-12-16)
**Commit Message**: Compile block list as part for the app build

**File**: `Hush.xcodeproj/project.pbxproj` (modified, +44/-7)
```diff
@@ -3,7 +3,7 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 50;
+	objectVersion = 54;
 	objects = {
 
 /* Begin PBXBuildFile section */
@@ -12,11 +12,9 @@
 		A4D9A103258A02B4009D7004 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A4D9A0EE258A02B4009D7004 /* Assets.xcassets */; };
 		A4D9A104258A02B4009D7004 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A4D9A0EE258A02B4009D7004 /* Assets.xcassets */; };
 		A4D9A116258A0340009D7004 /* Cocoa.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = A4D9A115258A0340009D7004 /* Cocoa.framework */; };
-		A4D9A119258A0340009D7004 /* blockerList.json in Resources */ = {isa = PBXBuildFile; fileRef = A4D9A118258A0340009D7004 /* blockerList.json */; };
 		A4D9A11B258A0340009D7004 /* ContentBlockerRequestHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A11A258A0340009D7004 /* ContentBlockerRequestHandler.swift */; };
 		A4D9A120258A0340009D7004 /* ContentBlocker (macOS).appex in Embed App Extensions */ = {isa = PBXBuildFile; fileRef = A4D9A113258A0340009D7004 /* ContentBlocker (macOS).appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
 		A4D9A135258A0376009D7004 /* ContentBlocker (iOS).appex in Embed App Extensions */ = {isa = PBXBuildFile; fileRef = A4D9A12C258A0376009D7004 /* ContentBlocker (iOS).appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
-		A4D9A14A258A0623009D7004 /* blockerList.json in Resources */ = {isa = PBXBuildFile; fileRef = A4D9A118258A0340009D7004 /* blockerList.json */; };
 		A4D9A15B258A06F4009D7004 /* Colors.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A154258A06F4009D7004 /* Colors.swift */; };
 		A4D9A15C258A06F4009D7004 /* Colors.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A154258A06F4009D7004 /* Colors.swift */; };
 		A4D9A15D258A06F4009D7004 /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4D9A156258A06F4009D7004 /* AppState.swift */; };
@@ -87,7 +85,6 @@
 		A4D9A0FE258A02B4009D7004 /* macOS.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = macOS.entitlements; sourceTree = "<group>"; };
 		A4D9A113258A0340009D7004 /* ContentBlocker (macOS).appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = "ContentBlocker (macOS).appex"; sourceTree = BUILT_PRODUCTS_DIR; };
 		A4D9A115258A0340009D7004 /* Cocoa.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = Cocoa.framework; path = System/Library/Frameworks/Cocoa.framework; sourceTree = SDKROOT; };
-		A4D9A118258A0340009D7004 /* blockerList.json */ = {isa = PBXFileReference; lastKnownFileType = text.json; path = blockerList.json; sourceTree = "<group>"; };
 		A4D9A11A258A0340009D7004 /* ContentBlockerRequestHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentBlockerRequestHandler.swift; sourceTree = "<group>"; };
 		A4D9A11C258A0340009D7004 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
 		A4D9A11D258A0340009D7004 /* ContentBlocker.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ContentBlocker.entitlements; sourceTree = "<group>"; };
@@ -151,7 +148,6 @@
 		A4D9A0EB258A02B2009D7004 /* Shared */ = {
 			isa = PBXGroup;
 			children = (
-				A4D9A118258A0340009D7004 /* blockerList.json */,
 				A4D9A0EC258A02B2009D7004 /* HushApp.swift */,
 				A4D9A11A258A0340009D7004 /* ContentBlockerRequestHandler.swift */,
 				A4D9A153258A06F4009D7004 /* Extensions */,
@@ -311,6 +307,7 @@
 				A4D9A10F258A0340009D7004 /* Sources */,
 				A4D9A110258A0340009D7004 /* Frameworks */,
 				A4D9A111258A0340009D7004 /* Resources */,
+				A4E2001D258A424100F0E52A /* Build block list */,
 			);
 			buildRules = (
 			);
@@ -328,6 +325,7 @@
 				A4D9A128258A0376009D7004 /* Sources */,
 				A4D9A129258A0376009D7004 /* Frameworks */,
 				A4D9A12A258A0376009D7004 /* Resources */,
+				A4E2FFD4258A401900F0E52A /* Build block list */,
 			);
 			buildRules = (
 			);
@@ -403,20 +401,59 @@
 			isa = PBXResourcesBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
-				A4D9A119258A0340009D7004 /* blockerList.json in Resources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
 		A4D9A12A258A0376009D7004 /* Resources */ = {
 			isa = PBXResourcesBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
-				A4D9A14A258A0623009D7004 /* blockerList.json in Resources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
 /* End PBXResourcesBuildPhase section */
 
+/* Begin PBXShellScriptBuildPhase section */
+		A4E2001D258A424100F0E52A /* Build block list */ = {
+			isa = PBXShellScriptBuildPhase;
+			alwaysOutOfDate = 1;
+			buildActionMask = 2147483647;
+			files = (
+			);
+			inputFileListPaths = (
+			);
+			inputPaths = (
+			);
+			name = "Build block list";
+			
```

**File**: `Makefile` (modified, +13/-7)
```diff
@@ -1,11 +1,7 @@
-build:
-	make fetch_blocklist
-	make build_blocklist
-
 format:
 	deno fmt scripts
 
-fetch_blocklist:
+fetch_external:
 	curl \
 		--output data/block-the-eu-cookie-shit-list.txt \
 		--silent \
@@ -14,5 +10,15 @@ fetch_blocklist:
 		--fail \
 		--url https://raw.githubusercontent.com/r4vi/block-the-eu-cookie-shit-list/master/filterlist.txt
 
-build_blocklist:
-	deno run --allow-read=./data scripts/build-blocklist.js > Shared/blockerList.json
+blocklist:
+	~/.deno/bin/deno run --allow-read=./data --allow-env=MINIFY scripts/build-blocklist.js
+
+xcode:
+ifeq ("$(CONFIGURATION_BUILD_DIR)","")
+	$(error CONFIGURATION_BUILD_DIR env is not set, make this command is run from Xcode)
+endif
+ifeq ("$(UNLOCALIZED_RESOURCES_FOLDER_PATH)","")
+	$(error UNLOCALIZED_RESOURCES_FOLDER_PATH env is not set, make this command is run from Xcode)
+endif
+	mkdir -p "$(CONFIGURATION_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)"
+	MINIFY=1 make blocklist --silent > "$(CONFIGURATION_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/blockerList.json"
```

**File**: `scripts/build-blocklist.js` (modified, +4/-1)
```diff
@@ -3,6 +3,9 @@ import { flattenSelectors } from "./src/optimize.js";
 
 const LISTS = ["../data/block-the-eu-cookie-shit-list.txt", "../data/hush.txt"];
 
+const stringify = (data) =>
+  Deno.env.get("MINIFY") ? JSON.stringify(data) : JSON.stringify(data, null, 2);
+
 const resolveRelative = (path) => new URL(path, import.meta.url).pathname;
 
 const readTextFile = (path) =>
@@ -18,4 +21,4 @@ const converted = LISTS
 
 const optimized = flattenSelectors(converted);
 
-console.log(JSON.stringify(optimized, null, 2));
+console.log(stringify(optimized));
```

#### Recent Merged Pull Requests:
- **PR #322** (2026-07-26): Fix UI tests (@oblador)
- **PR #321** (2026-07-26): Updated rules 2026-07-26 (@oblador)
- **PR #317** (2026-02-27): Updated rules 2026-02-27 (@oblador)
- **PR #301** (2024-12-12): Updated rules 2023-12-12 (@oblador)
- **PR #300** (closed): Create Hush (@Eliw24)
- **PR #295** (2024-09-24): Update instructions on iOS 18 (@oblador)
- **PR #294** (2024-09-24): Updated rules 2023-09-22 (@oblador)
- **PR #281** (closed): Create deno.yml (@mogensjensen79)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
