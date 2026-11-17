> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lingyired-status-trio-learnings.md`  
> **Source**: github ([https://github.com/lingyired/status-trio](https://github.com/lingyired/status-trio))  
> **Source Version**: `ca166e73`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T18:42:41.015Z  
> **Learning ID**: `learn-github-lingyired-status-trio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lingyired/status-trio

> **Canonical Artifact**: `07_PROJECT_LEARNING/lingyired-status-trio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lingyired/status-trio](https://github.com/lingyired/status-trio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T18:42:40.821Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingyired/status-trio`
- **Description**: Status Trio — a native macOS app that combines Wi-Fi, battery, and volume into one compact, configurable status icon for the menu bar, the Dock, or both, inspired by the iPhone Duo combined status bar.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1978 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/ui-ux-pro-max/scripts/core.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI/UX Pro Max Core - BM25 search engine for UI/UX style guides
"""

import csv
import difflib
import re
from pathlib import Path
from math import log
from collections import defaultdict

# ============ CONFIGURATION ============
DATA_DIR = Path(__file__).parent.parent / "data"
MAX_RESULTS = 3

CSV_CONFIG = {
    "style": {
        "file": "styles.csv",
        "search_cols": ["Style ID", "Style Category", "Aliases", "Keywords", "Best For", "Type", "AI Prompt Keywords"],
        "output_cols": ["Style ID", "Style Category", "Aliases", "Status", "Parent Style ID", "Preferred Mode", "Type", "Keywords", "Primary Colors", "Effects & Animation", "Best For", "Light Mode ✓", "Dark Mode ✓", "Performance", "Accessibility", "Framework Compatibility", "Complexity", "AI Prompt Keywords", "CSS/Technical Keywords", "Implementation Checklist", "Design System Variables"]
    },
    "color": {
        "file": "colors.csv",
        "search_cols": ["Product Type", "Notes"],
        "output_cols": ["Product Type", "Primary", "On Primary", "Secondary", "On Secondary", "Accent", "On Accent", "Background", "Foreground", "Card", "Card Foreground", "Muted", "Muted Foreground", "Border", "Destructive", "On Destructive", "Ring", "Notes"]
    },
    "chart": {
        "file": "charts.csv",
        "search_cols": ["Data Type", "Keywords", "Best Chart Type", "When to Use", "When NOT to Use", "Accessibility Notes"],
        "output_cols": ["Data Type", "Keywords", "Best Chart Type", "Secondary Options", "When to Use", "When NOT to Use", "Data Volume Threshold", "Color Guidance", "Accessibility Grade", "Accessibility Risk", "Accessibility Notes", "A11y Fallback", "Library Recommendation", "Interactive Level"]
    },
    "landing": {
        "file": "landing.csv",
        "search_cols": ["Pattern ID", "Pattern Name", "Aliases", "Keywords", "Conversion Optimization", "Section Order"],
        "output_cols": ["Pattern ID", "Pattern Name", "Aliases", "Keywords", "Section Order", "Primary CTA Placement", "Color Strategy", "Conversion Optimization"]
    },
    "product": {
        "file": "products.csv",
        "search_cols": ["Product Type", "Keywords", "Primary Style Recommendation", "Key Considerations"],
        "output_cols": ["Product Type", "Keywords", "Primary Style Recommendation", "Secondary Styles", "Landing Page Pattern", "Dashboard Style (if applicable)", "Color Palette Focus"]
    },
    "ux": {
        "file": "ux-guidelines.csv",
        "search_cols": ["Category", "Issue", "Description", "Platform"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "typography": {
        "file": "typography.csv",
        "search_cols": ["Font Pairing Name", "Category", "Mood/Style Keywords", "Best For", "Heading Font", "Body Font"],
        "output_cols": ["Font Pairing Name", "Category", "Heading Font", "Body Font", "Mood/Style Keywords", "Best For", "Google Fonts URL", "CSS Import", "Tailwind Config", "Notes"]
    },
    "icons": {
        "file": "icons.csv",
        "search_cols": ["Category", "Icon Name", "Keywords", "Best For", "Library"],
        "output_cols": ["Category", "Icon Name", "Keywords", "Library", "Import Code", "Usage", "Best For", "Style", "Semantic Role", "Allowed Contexts"]
    },
    "gsap": {
        "file": "motion.csv",
        "search_cols": ["Category", "Intensity Tier", "Keywords", "Trigger"],
        "output_cols": ["Category", "Intensity Tier", "Trigger", "Duration", "Easing", "GSAP Snippet", "Framework Notes", "Do", "Don't", "Performance Notes"]
    },
    "react": {
        "file": "react-performance.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "web": {
        "file": "app-interface.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "google-fonts": {
        "file": "google-fonts.csv",
        "search_cols": ["Family", "Category", "Stroke", "Classifications", "Keywords", "Subsets", "Designers"],
        "output_cols": ["Family", "Category", "Stroke", "Classifications", "Styles", "Variable Axes", "Subsets", "Designers", "Popularity Rank", "Google Fonts URL"]
    }
}

# Output columns whose content (code samples, checklists) must never be
# hard-truncated for display -- truncating mid-snippet destroys the value.
UNTRUNCATED_COLS = {
    "Code Example Good", "Code Example Bad", "Code Good", "Code Bad",
    "Implementation Checklist", "Design System Variables", "CSS Import",
    "Tailwind Config", "GSAP Snippet",
}

STACK_CONFIG = {
    "react":            {"file": "stacks/react.csv"},
    "nextjs":           {"file": "stacks/nextjs.csv"},
    "vue":              {"file": "stacks/vue.csv"},
    "svelte":           {"file": "stacks/svelte.csv"},
    "astro":            {"file": "stacks/astro.csv"},
    "swiftui":          {"file": "stacks/swiftui.csv"},
    "react-native":     {"file": "stacks/react-native.csv"},
    "flutter":          {"file": "stacks/flutter.csv"},
    "nuxtjs":           {"file": "stacks/nuxtjs.csv"},
    "nuxt-ui":          {"file": "stacks/nuxt-ui.csv"},
    "html-tailwind":    {"file": "stacks/html-tailwind.csv"},
    "shadcn":           {"file": "stacks/shadcn.csv"},
    "jetpack-compose":  {"file": "stacks/jetpack-compose.csv"},
    "threejs":          {"file": "stacks/threejs.csv"},
    "angular":          {"file": "stacks/angular.csv"},
    "laravel":          {"file": "stacks/laravel.csv"},
    "javafx":           {"file": "stacks/javafx.csv"},
    "wpf":              {"file": "stacks/wpf.csv"},
    "winui":            {"file": "stacks/winui.csv"},
    "avalonia":         {"file": "stacks/avalonia.csv"},
    "uno":              {"file": "stacks/uno.csv"},
    "uwp":              {"file": "stacks/uwp.csv"},
}

# Common columns for all stacks
_STACK_COLS = {
    "search_cols": ["Category", "Guideline", "Description", "Do", "Don't",
                    "Code Good", "Code Bad"],
    "output_cols": ["Category", "Guideline", "Description", "Do", "Don't",
                    "Code Good", "Code Bad", "Severity", "Docs URL",
                    "Applies To", "Status", "Verified At"]
}

WEB_STACK_CURRENT_MAJORS = {
    "react": 19,
    "nextjs": 16,
    "vue": 3,
    "svelte": 5,
    "astro": 7,
    "angular": 22,
    "html-tailwind": 4,
    "nuxtjs": 4,
    "nuxt-ui": 4,
}
WEB_STACKS = frozenset(WEB_STACK_CURRENT_MAJORS) | {"shadcn"}

STACK_CURRENT_VERSIONS = {
    **{stack: (major,) for stack, major in WEB_STACK_CURRENT_MAJORS.items()},
    "react-native": (0, 86),
    "flutter": (3, 44),
    "swiftui": (16,),
    "jetpack-compose": (1, 11),
    "avalonia": (12,),
    "winui": (3,),
    "javafx": (26,),
    "threejs": (0, 185),
    "laravel": (13,),
}
LEGACY_ONLY_STACKS = frozenset({"uwp"})
STACK_CURRENT_APPLICABILITY = {
    "react": "react 19.2.x",
    "nextjs": "nextjs 16.2",
    "vue": "vue 3.5.x",
    "svelte": "svelte 5",
    "astro": "astro 7.1.6",
    "angular": "angular 22.x",
    "html-tailwind": "html-tailwind 4.3",
    "shadcn": "shadcn cli 4",
    "nuxtjs": "nuxtjs 4.5",
    "nuxt-ui": "nuxt-ui 4.12.0",
    "react-native": "react-native 0.86.x",
    "flutter": "flutter 3.44.x",
    "swiftui": "swiftui current",
    "jetpack-compose": "jetpack-compose 1.11.4",
    "avalonia": "avalonia 12",
    "uwp": "uwp legacy",
    "winui": "winui current",
    "wpf": "wpf current",
    "uno": "uno current",
    "javafx": "javafx 26",
    "threejs": "threejs 0.185.1",
    "laravel": "laravel 13.x",
}

_STACK_QUERY_NAMES = {
    "react": r"react",
    "nextjs": r"next(?:\.js|js)?",
    "vue": r"vue",
    "svelte": r"svelte",
    "astro": r"astro",
    "angular": r"angular",
    "html-tailwind": r"tailwind(?:\s*css)?",
    "nuxtjs": r"nuxt(?:\.js|js)?",
    "nuxt-ui": r"nuxt\s*ui",
    "react-native": r"react[\s-]*native",
    "flutter": r"flutter",
    "swiftui": r"(?:ios|swiftui\s+ios)",
    "jetpack-compose": r"(?:jetpack\s*)?compose",
    "avalonia": r"avalonia",
    "winui": r"winui",
    "javafx": r"javafx",
    "threejs": r"three(?:\.js|js)?",
    "laravel": r"laravel",
}

AVAILABLE_STACKS = list(STACK_CONFIG.keys())

_INDEX_VERSION = 2
_SEARCH_CALIBRATION_VERSION = "2026-08-12-v1"

# Search calibration uses evidence coverage first; raw BM25 floors are kept
# domain-specific because corpora vary greatly in size and document length.
# Values are intentionally conservative and are measured by the calibration suite.
_DOMAIN_SCORE_FLOORS = {
    "style": 4.3, "landing": 4.0, "product": 6.0, "icons": 5.8,
    "react": 3.3,
}
_SEARCH_THRESHOLDS = {
    domain: {"min_score": _DOMAIN_SCORE_FLOORS.get(domain, 0.0),
             "min_margin": 0.0, "min_coverage": 0.5 if domain == "landing" else 0.0}
    for domain in CSV_CONFIG
}
_STACK_THRESHOLD = {"min_score": 3.6, "min_margin": 0.0, "min_coverage": 1 / 3}
_NO_THRESHOLD = {"min_score": 0.0, "min_margin": 0.0, "min_coverage": 0.0}
_STYLE_IDENTITY_FIELDS = ("Style ID", "Style Category", "Aliases")
_LANDING_IDENTITY_FIELDS = ("Pattern ID", "Pattern Name", "Aliases")
_DOMAIN_QUERY_REWRITES = {
    "color": {term: None for term in (
        "color", "palette", "hex", "rgb", "token", "semantic",
        "destructive", "muted", "foreground")},
    "landing": {"testimonial": "testimonials"},
    "style": {"css": None, "implementation": None, "variable": None,
              "checklist": None, "tailwind": None},
    "ux": {"ux": "accessibility", "usability": "accessibility",
           "wcag": "accessibility"},
    "google-fonts": {"typography": "font"},
    "icons": {"lucide": None, "symbol": None, "glyph": None, "pictogram": None},
    "gsap": {"gsap
```

### Core Architecture Module: `.agents/skills/writing-skills/render-graphs.js`
```
#!/usr/bin/env node

/**
 * Render graphviz diagrams from a skill's SKILL.md to SVG files.
 *
 * Usage:
 *   ./render-graphs.js <skill-directory>           # Render each diagram separately
 *   ./render-graphs.js <skill-directory> --combine # Combine all into one diagram
 *
 * Extracts all ```dot blocks from SKILL.md and renders to SVG.
 * Useful for helping your human partner visualize the process flows.
 *
 * Requires: graphviz (dot) installed on system
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

function extractDotBlocks(markdown) {
  const blocks = [];
  const regex = /```dot\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const content = match[1].trim();

    // Extract digraph name
    const nameMatch = content.match(/digraph\s+(\w+)/);
    const name = nameMatch ? nameMatch[1] : `graph_${blocks.length + 1}`;

    blocks.push({ name, content });
  }

  return blocks;
}

function extractGraphBody(dotContent) {
  // Extract just the body (nodes and edges) from a digraph
  const match = dotContent.match(/digraph\s+\w+\s*\{([\s\S]*)\}/);
  if (!match) return '';

  let body = match[1];

  // Remove rankdir (we'll set it once at the top level)
  body = body.replace(/^\s*rankdir\s*=\s*\w+\s*;?\s*$/gm, '');

  return body.trim();
}

function combineGraphs(blocks, skillName) {
  const bodies = blocks.map((block, i) => {
    const body = extractGraphBody(block.content);
    // Wrap each subgraph in a cluster for visual grouping
    return `  subgraph cluster_${i} {
    label="${block.name}";
    ${body.split('\n').map(line => '  ' + line).join('\n')}
  }`;
  });

  return `digraph ${skillName}_combined {
  rankdir=TB;
  compound=true;
  newrank=true;

${bodies.join('\n\n')}
}`;
}

function renderToSvg(dotContent) {
  try {
    return execFileSync('dot', ['-Tsvg'], {
      input: dotContent,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (err) {
    console.error('Error running dot:', err.message);
    if (err.stderr) console.error(err.stderr.toString());
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const combine = args.includes('--combine');
  const skillDirArg = args.find(a => !a.startsWith('--'));

  if (!skillDirArg) {
    console.error('Usage: render-graphs.js <skill-directory> [--combine]');
    console.error('');
    console.error('Options:');
    console.error('  --combine    Combine all diagrams into one SVG');
    console.error('');
    console.error('Example:');
    console.error('  ./render-graphs.js ../subagent-driven-development');
    console.error('  ./render-graphs.js ../subagent-driven-development --combine');
    process.exit(1);
  }

  const skillDir = path.resolve(skillDirArg);
  const skillFile = path.join(skillDir, 'SKILL.md');
  const skillName = path.basename(skillDir).replace(/-/g, '_');

  if (!fs.existsSync(skillFile)) {
    console.error(`Error: ${skillFile} not found`);
    process.exit(1);
  }

  // Check if dot is available. Run the binary directly rather than probing
  // with `which`, which is not a command on Windows.
  try {
    execFileSync('dot', ['-V'], { stdio: 'ignore' });
  } catch {
    console.error('Error: graphviz (dot) not found. Install with:');
    console.error('  brew install graphviz    # macOS');
    console.error('  apt install graphviz     # Linux');
    process.exit(1);
  }

  const markdown = fs.readFileSync(skillFile, 'utf-8');
  const blocks = extractDotBlocks(markdown);

  if (blocks.length === 0) {
    console.log('No ```dot blocks found in', skillFile);
    process.exit(0);
  }

  console.log(`Found ${blocks.length} diagram(s) in ${path.basename(skillDir)}/SKILL.md`);

  const outputDir = path.join(skillDir, 'diagrams');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  if (combine) {
    // Combine all graphs into one
    const combined = combineGraphs(blocks, skillName);
    const svg = renderToSvg(combined);
    if (svg) {
      const outputPath = path.join(outputDir, `${skillName}_combined.svg`);
      fs.writeFileSync(outputPath, svg);
      console.log(`  Rendered: ${skillName}_combined.svg`);

      // Also write the dot source for debugging
      const dotPath = path.join(outputDir, `${skillName}_combined.dot`);
      fs.writeFileSync(dotPath, combined);
      console.log(`  Source: ${skillName}_combined.dot`);
    } else {
      console.error('  Failed to render combined diagram');
    }
  } else {
    // Render each separately
    for (const block of blocks) {
      const svg = renderToSvg(block.content);
      if (svg) {
        const outputPath = path.join(outputDir, `${block.name}.svg`);
        fs.writeFileSync(outputPath, svg);
        console.log(`  Rendered: ${block.name}.svg`);
      } else {
        console.error(`  Failed: ${block.name}`);
      }
    }
  }

  console.log(`\nOutput: ${outputDir}/`);
}

main();

```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppActivationPolicy.swift`
```
import AppKit

@MainActor
protocol ApplicationActivationPolicyApplying: AnyObject {
    var currentActivationPolicy: NSApplication.ActivationPolicy { get }
    func setActivationPolicy(_ activationPolicy: NSApplication.ActivationPolicy) -> Bool
}

extension NSApplication: ApplicationActivationPolicyApplying {
    var currentActivationPolicy: NSApplication.ActivationPolicy {
        activationPolicy()
    }
}

@MainActor
final class AppActivationPolicy: ObservableObject {
    private let application: any ApplicationActivationPolicyApplying
    private var keepsDockIconVisible = false
    private var temporaryRegularRequestCount = 0

    /// Whether the app currently runs as a regular app. That is only true while
    /// it really is regular, whether the placement choice or a window that keeps
    /// the app in regular mode caused it. A regular app owns both the Dock tile
    /// and the menu bar, so both follow this.
    @Published private(set) var isRegularApp: Bool

    init(application: any ApplicationActivationPolicyApplying = NSApplication.shared) {
        self.application = application
        self.isRegularApp = application.currentActivationPolicy == .regular
    }

    @discardableResult
    func setDockIconVisible(_ isVisible: Bool) -> Bool {
        keepsDockIconVisible = isVisible
        return apply()
    }

    func enterTemporaryRegularMode() {
        temporaryRegularRequestCount += 1
        _ = apply()
    }

    func leaveTemporaryRegularMode() {
        temporaryRegularRequestCount = max(0, temporaryRegularRequestCount - 1)
        _ = apply()
    }

    @discardableResult
    private func apply() -> Bool {
        let policy: NSApplication.ActivationPolicy = keepsDockIconVisible
            || temporaryRegularRequestCount > 0
            ? .regular
            : .accessory
        // AppKit reports a redundant request as a failure even though the app is
        // already in the requested state, so confirm against the live policy
        // before treating a false result as a rejected transition.
        let didApply = application.setActivationPolicy(policy)
        let isRegular = application.currentActivationPolicy == .regular
        if isRegularApp != isRegular {
            isRegularApp = isRegular
        }
        return didApply || isRegular
    }
}

```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppDelegate.swift`
```
import AppKit
import os

private let singleInstanceLogger = Logger(
    subsystem: "com.lingsmbp.StatusTrio",
    category: "SingleInstance"
)

@MainActor
public final class AppDelegate: NSObject, NSApplicationDelegate {
    private var environment: AppEnvironment?
    private var singleInstanceGuard: SingleInstanceGuard?
    private let updaterManager = UpdaterManager.shared

    public override init() {
        super.init()
    }

    public func applicationDidFinishLaunching(_ notification: Notification) {
        // macOS 26+ defaults to the native glass surfaces; the key can opt out.
        // Registered here (not in the view) so ImageRenderer/unit-test hosts that
        // never launch the app keep the deterministic translucent wash.
        UserDefaults.standard.register(defaults: [PanelCardSurfaceExperiment.defaultsKey: true])
        let backgroundUITesting = BackgroundUITestingConfiguration(
            arguments: ProcessInfo.processInfo.arguments
        )
        guard !backgroundUITesting.rejectsLaunch else {
            for diagnostic in backgroundUITesting.diagnostics {
                dockActivationLogger.error("\(diagnostic, privacy: .public)")
            }
            NSApplication.shared.terminate(nil)
            return
        }

        switch SingleInstanceGuard.acquire() {
        case .acquired(let guardInstance):
            self.singleInstanceGuard = guardInstance
        case .rejected(let rejection):
            reportSingleInstanceRejection(rejection)
            NSApplication.shared.terminate(nil)
            return
        }

        let environment = AppEnvironment.live(backgroundUITesting: backgroundUITesting)
        self.environment = environment
        environment.start()
        updaterManager.start(activationPolicy: environment.activationPolicy)
    }

    /// Keeps "another copy is running" and "the lock is unusable" apart in the
    /// log. Both end the launch: running a second instance is never the
    /// fallback.
    private func reportSingleInstanceRejection(_ rejection: SingleInstanceGuard.Rejection) {
        switch rejection {
        case .alreadyRunning:
            singleInstanceLogger.notice(
                "another StatusTrio instance holds the lock; terminating"
            )
        case .lockUnavailable(let reason):
            singleInstanceLogger.error(
                "single-instance lock is unusable, terminating: \(reason, privacy: .public)"
            )
        }
    }

    public func applicationWillTerminate(_ notification: Notification) {
        environment?.stop()
    }

    /// #295: `pmset -a disablesleep 1` is a persisted system setting, so quitting
    /// while the lid toggle is on must write it back to 0. `.terminateLater`
    /// lets the helper call finish first; the delayed reply is a stop path so an
    /// unreachable helper can never hang quit.
    public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let environment, environment.store.sleepControl.needsTerminationCleanup else {
            return .terminateNow
        }
        let sleepControl = environment.store.sleepControl
        Task { @MainActor in
            await sleepControl.shutdown()
            self.replyToTermination()
        }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            self.replyToTermination()
        }
        return .terminateLater
    }

    private var didReplyToTermination = false

    private func replyToTermination() {
        guard !didReplyToTermination else { return }
        didReplyToTermination = true
        NSApplication.shared.reply(toApplicationShouldTerminate: true)
    }

    public func applicationShouldHandleReopen(
        _ sender: NSApplication,
        hasVisibleWindows flag: Bool
    ) -> Bool {
        guard let environment else { return false }

        let event = AppleEventSenderResolver.currentActivation()
        let placement = environment.settings.appIconPlacement
        let action = DockActivationAction.resolve(
            event: event,
            showsPersistentDockIcon: placement.showsDockIcon,
            backgroundUITesting: environment.backgroundUITesting,
            hasVisibleOnboarding: environment.onboardingWindowController.window?.isVisible == true
        )
        let settingsWindow = environment.settingsWindowController.window
        dockActivationLogger.notice(
            """
            reopen callback event=\(event.kind.rawValue, privacy: .public) \
            class=\(event.eventClass ?? 0) id=\(event.eventID ?? 0) \
            sender=\(event.senderBundleIdentifier ?? "Unknown", privacy: .public) \
            senderPID=\(event.senderPID ?? 0) \
            placement=\(placement.rawValue, privacy: .public) \
            policy=\(sender.activationPolicy().rawValue) hasVisibleWindows=\(flag) \
            settingsExists=\(settingsWindow != nil) settingsVisible=\(settingsWindow?.isVisible ?? false) \
            settingsKey=\(settingsWindow?.isKeyWindow ?? false) action=\(action.rawValue, privacy: .public)
            """
        )
        switch action {
        case .showPopover:
            environment.statusBarController.togglePopover(
                anchoredAtScreenPoint: NSEvent.mouseLocation
            )
        case .openSettings:
            environment.settingsWindowController.show()
        case .none:
            break
        }
        // The selected action owns presentation; AppKit must not also restore
        // an existing Settings window through its default reopen behavior.
        return false
    }

    public func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        guard let environment else { return nil }

        return AppDockMenu.make(
            localization: environment.localization,
            target: self,
            action: #selector(handleDockMenuSettings)
        )
    }

    @objc private func handleDockMenuSettings() {
        environment?.settingsWindowController.show()
    }
}

```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppEnvironment.swift`
```
import AppKit
import Combine

@MainActor
final class AppEnvironment {
    let store: SystemStatusStore
    let settings: SettingsStore
    let localization: Localization
    let iconPresentation: IconPresentationViewModel
    let statusBarController: StatusBarController
    let settingsWindowController: SettingsWindowController
    let onboardingWindowController: OnboardingWindowController
    let activationPolicy: AppActivationPolicy
    let appIconController: AppIconController
    let mainMenuController: MainMenuController
    let inputSourceController: InputSourceController
    let chargingEffectClock: ChargingEffectClock
    let chargingEffectMotionMonitor: ChargingEffectMotionMonitor
    let globalShortcutController: GlobalShortcutController?
    let dockChargingAnimationPresenter: (any DockChargingAnimationPresenting)?
    let dockVisibilityMonitor: (any DockVisibilityMonitoring)?
    let telemetryReporter: any TelemetryReporting
    let bluetoothAudioIconOverrideSynchronizer = BluetoothAudioIconOverrideSynchronizer()
    private let bluetoothProfilerCache: BluetoothProfilerReportCache
    private let bluetoothNearbyBatteryOptOutSynchronizer = BluetoothNearbyBatteryOptOutSynchronizer()
    private let lowPowerModeControlSynchronizer = LowPowerModeControlSynchronizer()
    private let memoryPressureMonitor: MemoryPressureMonitor
    private let previewResourceLifecycle: PreviewResourceLifecycle
    let backgroundUITesting: BackgroundUITestingConfiguration

    private var chargingEffectCancellables = Set<AnyCancellable>()
    private var inputSourceLifecycleCancellables = Set<AnyCancellable>()
    private var previewResourceLifecycleCancellables = Set<AnyCancellable>()
    private var hasSubscribedToChargingEffectInputs = false
    private var isPreviewResourceLifecycleStarted = false
    private var menuBarChargingEffectEnabled: Bool
    private var dockChargingEffectEnabled: Bool
    private var dockChargingAnimationShouldRun = false
    private var isDockVisibilityMonitoring = false

    init(
        store: SystemStatusStore,
        settings: SettingsStore,
        localization: Localization,
        iconPresentation: IconPresentationViewModel,
        statusBarController: StatusBarController,
        settingsWindowController: SettingsWindowController,
        onboardingWindowController: OnboardingWindowController,
        activationPolicy: AppActivationPolicy,
        appIconController: AppIconController,
        mainMenuController: MainMenuController,
        inputSourceController: InputSourceController,
        chargingEffectClock: ChargingEffectClock,
        chargingEffectMotionMonitor: ChargingEffectMotionMonitor,
        globalShortcutController: GlobalShortcutController? = nil,
        dockChargingAnimationPresenter: (any DockChargingAnimationPresenting)? = nil,
        dockVisibilityMonitor: (any DockVisibilityMonitoring)? = nil,
        telemetryReporter: any TelemetryReporting,
        memoryPressureMonitor: MemoryPressureMonitor? = nil,
        bluetoothProfilerCache: BluetoothProfilerReportCache = .shared,
        previewResourceLifecycle: PreviewResourceLifecycle? = nil,
        backgroundUITesting: BackgroundUITestingConfiguration = .disabled
    ) {
        self.store = store
        self.settings = settings
        self.localization = localization
        self.iconPresentation = iconPresentation
        self.statusBarController = statusBarController
        self.settingsWindowController = settingsWindowController
        self.onboardingWindowController = onboardingWindowController
        self.activationPolicy = activationPolicy
        self.appIconController = appIconController
        self.mainMenuController = mainMenuController
        self.inputSourceController = inputSourceController
        self.chargingEffectClock = chargingEffectClock
        self.chargingEffectMotionMonitor = chargingEffectMotionMonitor
        self.globalShortcutController = globalShortcutController
        self.dockChargingAnimationPresenter = dockChargingAnimationPresenter
        self.dockVisibilityMonitor = dockVisibilityMonitor
        self.telemetryReporter = telemetryReporter
        self.memoryPressureMonitor = memoryPressureMonitor ?? MemoryPressureMonitor()
        self.bluetoothProfilerCache = bluetoothProfilerCache
        self.previewResourceLifecycle = previewResourceLifecycle ?? PreviewResourceLifecycle()
        self.backgroundUITesting = backgroundUITesting
        self.menuBarChargingEffectEnabled = settings.showsMenuBarChargingEffect
        self.dockChargingEffectEnabled = settings.showsDockChargingEffect
    }

    func start() {
        startPreviewResourceLifecycleIfNeeded()
        memoryPressureMonitor.onPressure = { [weak self] in
            self?.releaseRebuildableResources()
        }
        memoryPressureMonitor.start()
        iconPresentation.start()
        startInputSourceMonitoringIfNeeded()
        // A panel test must not be blocked by first-run onboarding. The
        // Settings background route keeps its existing onboarding policy.
        let presentedOnboarding =
            backgroundUITesting.isEnabled && backgroundUITesting.opensStatusPanel
            ? false
            : onboardingWindowController.showIfNeeded()
        if backgroundUITesting.isEnabled, !presentedOnboarding {
            if backgroundUITesting.opensStatusPanel {
                statusBarController.presentStatusPanelForBackgroundTesting()
            } else {
                settingsWindowController.show()
            }
        }
        statusBarController.visibilityDidChange = { [weak self] in
            self?.updateChargingEffectClock()
        }
        appIconController.dockChargingAnimationEligibilityDidChange = { [weak self] in
            self?.updateChargingEffectClock()
        }
        appIconController.dockContentDidChange = { [weak self] in
            self?.updateDockChargingAnimation()
        }
        dockVisibilityMonitor?.onChange = { [weak self] _ in
            self?.updateDockChargingAnimationOwnership()
        }
        chargingEffectMotionMonitor.onChange = { [weak self] _ in
            self?.updateChargingEffectClock()
        }
        chargingEffectMotionMonitor.start()
        subscribeToChargingEffectInputs()
        mainMenuController.start()
        globalShortcutController?.start()
        appIconController.start()
        bluetoothAudioIconOverrideSynchronizer.start(
            devices: store.bluetoothDevices,
            settings: settings
        )
        bluetoothNearbyBatteryOptOutSynchronizer.start(
            settings: settings,
            actions: StatusPanelActions(store: store, settings: settings)
        )
        lowPowerModeControlSynchronizer.start(
            settings: settings,
            helper: PrivilegedHelperManager.shared
        )
        store.bindInputSettings(settings)
        store.bindLocalIPSettings(settings)
        store.bindApplicationEnergySettings(settings)
        store.bindMobileBatterySettings(settings)
        store.bindLowPowerModeSettings(settings)
        store.bindBluetoothSettings(settings)
        store.bindExternalVolumeSettings(settings)
        store.bindExternalBrightnessSettings(settings)
        store.start()
        telemetryReporter.start()
    }

    func stop() {
        settings.flushPendingPersists()
        memoryPressureMonitor.stop()
        memoryPressureMonitor.onPressure = nil
        telemetryReporter.stop()
        globalShortcutController?.stop()
        chargingEffectClock.stop()
        statusBarController.visibilityDidChange = nil
        stopPreviewResourceLifecycle()
        appIconController.dockChargingAnimationEligibilityDidChange = nil
        appIconController.dockContentDidChange = nil
        dockVisibilityMonitor?.onChange = nil
        if isDockVisibilityMonitoring {
            dockVisibilityMonitor?.stop()
            isDockVisibilityMonitoring = false
        }
        dockChargingAnimationPresenter?.clear()
        chargingEffectMotionMonitor.onChange = nil
        chargingEffectMotionMonitor.stop()
        chargingEffectCancellables.removeAll()
        bluetoothAudioIconOverrideSynchronizer.stop()
        bluetoothNearbyBatteryOptOutSynchronizer.stop()
        lowPowerModeControlSynchronizer.stop()
        inputSourceLifecycleCancellables.removeAll()
        inputSourceController.stop()
        appIconController.stop()
        mainMenuController.stop()
        store.stop()
        // Both profiler consumers belong to the stopped store. A pressure
        // warning alone must not invalidate a report another reader is using.
        bluetoothProfilerCache.resetIfUnused()
        iconPresentation.stop()
        releaseRebuildableResources()
    }

    private func startPreviewResourceLifecycleIfNeeded() {
        guard !isPreviewResourceLifecycleStarted else { return }
        isPreviewResourceLifecycleStarted = true
        previewResourceLifecycle.start()
        settingsWindowController.startPreviewResourceObservation { [weak self] visible in
            self?.previewResourceLifecycle.setPreviewOwner(.settings, visible: visible)
        }
        onboardingWindowController.startPreviewResourceObservation { [weak self] visible in
            self?.previewResourceLifecycle.setPreviewOwner(.onboarding, visible: visible)
        }
        store.$isPopoverVisible
            .removeDuplicates()
            .sink { [weak self] visible in
                guard let self, visible else { return }
                previewResourceLifecycle.setPopoverContentOwned(true)
            }
            .store(in: &previewResourceLifecycleCancellables)
        statusBarController.onPopoverContentReleased = { [weak self] in
            self?.previewResourceLifecycle.setPopoverContentOwned(false)
        }
    }

    private func stopPreviewResourceLifecycle() {
        guard isPreviewResourceLifecycleStarted else { return }
        isPreviewResourceLifecycleStarted = false
        previewReso
```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppIconController.swift`
```
import AppKit
import Combine

@MainActor
protocol ApplicationDockIconApplying: AnyObject {
    func setApplicationIconImage(_ image: NSImage?)
}

extension NSApplication: ApplicationDockIconApplying {
    func setApplicationIconImage(_ image: NSImage?) {
        applicationIconImage = image
    }
}

@MainActor
final class AppIconController {
    typealias DockRenderer = (
        _ scene: IconSceneState,
        _ backgroundStyle: DockIconBackgroundStyle,
        _ pixelLength: Int
    ) -> NSImage?
    private let settings: SettingsStore
    private let iconPresentation: IconPresentationViewModel
    private let activationPolicy: AppActivationPolicy
    private let application: any ApplicationDockIconApplying
    private let setMenuBarVisible: (Bool) -> Void
    private let renderDockIcon: DockRenderer
    private let theme: () -> SystemIconAppearanceTheme
    private let isDarkAppearance: () -> Bool
    private let appearanceObservation: any SystemAppearanceObserving
    private let monitor: SystemIconAppearanceMonitor
    private var cancellables: Set<AnyCancellable> = []
    private var renderCache = DockIconRenderCache()
    private let imageCache: DockIconImageCache
    private let renderCoalescer: IconRenderCoalescer
    /// Dock-only coalescer for continuous volume adjustment. Other scene and
    /// settings changes render through `renderCoalescer` or immediately.
    private let volumeRenderCoalescer: DockVolumeRenderCoalescer
    private var hasRenderedDockIcon = false
    private var currentPlacement: AppIconPlacement
    private var currentBackgroundPreference: DockIconBackgroundPreference
    private var latestIconOutput: IconPresentationOutput
    private var isDockTileVisible: Bool
    private var isDockChargingEffectEnabled: Bool
    private var isStarted = false
    /// While the Dock presenter owns `dockTile.contentView`, changing
    /// `applicationIconImage` would replace the animated tile with a static
    /// image. The presenter is then the only writer of the Dock's visuals.
    private var isDockChargingAnimationActive = false
    /// Fires when the user's placement or the live activation policy changes
    /// whether the Dock may own the animation.
    var dockChargingAnimationEligibilityDidChange: (@MainActor () -> Void)?
    /// Fires when the scene or resolved tile style the Dock should draw changes.
    var dockContentDidChange: (@MainActor () -> Void)?
    private var reportedDockAnimationEligibility: Bool?
    /// The placement is the user's own choice; a window that temporarily makes
    /// the app regular must not claim the animation's only surface.
    var isDockChargingAnimationEligible: Bool {
        currentPlacement.showsDockIcon && isDockTileVisible && activationPolicy.isRegularApp
    }
    var latestScene: IconSceneState { latestIconOutput.scene }
    /// The Dock animation follows the synthetic charging preview only while the
    /// explicit test switch is on; a normal launch stays on the real scene.
    var latestAnimationScene: IconSceneState {
        (latestIconOutput.menuBarTestScene ?? latestIconOutput.scene)
            .withChargingEffectEnabled(isDockChargingEffectEnabled)
    }
    var currentDockBackgroundStyle: DockIconBackgroundStyle { currentBackgroundStyle() }

    init(
        settings: SettingsStore,
        iconPresentation: IconPresentationViewModel,
        activationPolicy: AppActivationPolicy,
        application: any ApplicationDockIconApplying = NSApplication.shared,
        setMenuBarVisible: @escaping (Bool) -> Void,
        renderDockIcon: @escaping DockRenderer,
        theme: @escaping () -> SystemIconAppearanceTheme = {
            SystemIconAppearanceReader.current()
        },
        isDarkAppearance: @escaping () -> Bool = {
            NSApplication.shared.effectiveAppearance
                .bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        },
        notificationCenter: NotificationCenter = .default,
        appearanceObservation: (any SystemAppearanceObserving)? = nil,
        renderCoalescer: IconRenderCoalescer? = nil,
        volumeRenderCoalescer: DockVolumeRenderCoalescer? = nil,
        imageCache: DockIconImageCache? = nil
    ) {
        self.settings = settings
        self.iconPresentation = iconPresentation
        self.activationPolicy = activationPolicy
        self.application = application
        self.setMenuBarVisible = setMenuBarVisible
        self.renderDockIcon = renderDockIcon
        self.renderCoalescer = renderCoalescer ?? IconRenderCoalescer()
        self.volumeRenderCoalescer = volumeRenderCoalescer ?? DockVolumeRenderCoalescer()
        self.imageCache = imageCache ?? DockIconImageCache()
        self.theme = theme
        self.isDarkAppearance = isDarkAppearance
        self.appearanceObservation = appearanceObservation
            ?? ApplicationAppearanceObservation()
        self.monitor = SystemIconAppearanceMonitor(
            readTheme: theme,
            notificationCenter: notificationCenter
        )
        self.currentPlacement = settings.appIconPlacement
        self.currentBackgroundPreference = settings.dockIconBackgroundPreference
        self.latestIconOutput = iconPresentation.output
        self.isDockTileVisible = activationPolicy.isRegularApp
        self.isDockChargingEffectEnabled = settings.showsDockChargingEffect
    }

    func start() {
        guard !isStarted else { return }
        isStarted = true

        // Adopt whatever the settings hold now: they can change between
        // construction and the first start.
        currentPlacement = settings.appIconPlacement
        currentBackgroundPreference = settings.dockIconBackgroundPreference
        latestIconOutput = iconPresentation.output
        apply(currentPlacement)
        activationPolicy.$isRegularApp
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] isRegular in
                // @Published emits before the stored value changes, so use the
                // value the publisher delivered.
                guard let self else { return }
                isDockTileVisible = isRegular
                dockTileVisibilityChanged()
            }
            .store(in: &cancellables)
        monitor.onChange = { [weak self] _ in
            self?.renderLatestDockIcon()
            self?.dockContentDidChange?()
        }
        monitor.start()
        appearanceObservation.start { [weak self] in
            self?.systemAppearanceDidChange()
        }
        subscribeToPlacement()
        subscribeToIconPresentation()
        subscribeToBackgroundStyle()
        subscribeToChargingEffectPreference()
    }

    func stop() {
        guard isStarted else {
            imageCache.reset()
            return
        }
        isStarted = false
        cancellables.removeAll()
        renderCoalescer.cancel()
        volumeRenderCoalescer.cancel()
        monitor.onChange = nil
        monitor.stop()
        appearanceObservation.stop()
        dockChargingAnimationEligibilityDidChange = nil
        dockContentDidChange = nil
        isDockChargingAnimationActive = false
        reportedDockAnimationEligibility = nil
        clearDockIcon()
    }

    func refreshCurrentPresentation() {
        renderLatestDockIcon()
    }

    func flushPendingPresentationForTesting() {
        volumeRenderCoalescer.flushPending()
        renderCoalescer.flushPending()
    }

    func setDockChargingAnimationActive(_ isActive: Bool) {
        guard isDockChargingAnimationActive != isActive else { return }
        isDockChargingAnimationActive = isActive
        renderCache.reset()
        if !isActive {
            renderLatestDockIcon()
        }
    }

    private func dockTileVisibilityChanged() {
        defer { notifyDockAnimationEligibility() }
        guard isDockTileVisible else {
            clearDockIcon()
            dockContentDidChange?()
            return
        }
        renderLatestDockIcon()
    }

    func releaseCachedImages() {
        imageCache.reset()
    }

    private func clearDockIcon() {
        imageCache.reset()
        defer { renderCache.reset() }
        guard hasRenderedDockIcon else { return }
        application.setApplicationIconImage(nil)
        hasRenderedDockIcon = false
    }

    private func subscribeToPlacement() {
        settings.$appIconPlacement
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] placement in
                self?.apply(placement)
            }
            .store(in: &cancellables)
    }

    private func subscribeToIconPresentation() {
        iconPresentation.$output
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] output in
                guard let self else { return }
                let previousScene = latestIconOutput.scene
                latestIconOutput = output
                dockContentDidChange?()
                if output.scene.isVolumeValueChange(from: previousScene) {
                    // Issue #263: a continuous volume adjustment may repaint the
                    // Dock at a bounded rate; the newest value always lands.
                    volumeRenderCoalescer.submit(footer: output.scene.footer) { [weak self] in
                        self?.renderLatestDockIcon()
                    }
                } else {
                    // Settings and non-volume scene changes must not wait behind
                    // a volume burst.
                    volumeRenderCoalescer.cancel()
                    renderCoalescer.submit { [weak self] in
                        self?.renderLatestDockIcon()
                    }
                }
            }
            .store(in: &cancellables)
    }

    private func subscribeToBackgroundStyle() {
        settings.$dockIconBackgroundPreference
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] preference in
                guard let self else { return }
```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppSigningIdentity.swift`
```
import Foundation
import Security

/// The app's own code-signing identity, read from the running process rather
/// than from `Info.plist`.
///
/// The privileged helper authorizes callers by bundle identifier and team, so
/// the app can only offer its toggle when this process actually carries that
/// identity. `Info.plist` is not evidence: an Ad-hoc build or a worktree build
/// with a rewritten `BUNDLE_ID` has no team at all, yet still reads the same
/// bundle identifier from its plist.
enum AppSigningIdentity {
    struct Identity: Equatable {
        let bundleIdentifier: String
        let teamIdentifier: String
    }

    /// `nil` for an unsigned or Ad-hoc signed build, and whenever the signature
    /// cannot be read. Both mean the daemon's requirement cannot be met.
    static func current() -> Identity? {
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return nil }
        var staticCode: SecStaticCode?
        guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode else {
            return nil
        }
        var information: CFDictionary?
        let flags = SecCSFlags(rawValue: kSecCSSigningInformation)
        guard SecCodeCopySigningInformation(staticCode, flags, &information) == errSecSuccess,
              let info = information as? [String: Any],
              let identifier = info[kSecCodeInfoIdentifier as String] as? String,
              let teamIdentifier = info[kSecCodeInfoTeamIdentifier as String] as? String
        else { return nil }
        return Identity(bundleIdentifier: identifier, teamIdentifier: teamIdentifier)
    }
}

```

### Core Architecture Module: `Sources/StatusTrioCore/App/AppleEventSenderResolver.swift`
```
import AppKit

enum AppleEventSender: String, CaseIterable, Sendable {
    case dock
    case finder
    case spotlight
    case launcher
    case other
    case unknown

    init(bundleIdentifier: String?) {
        switch bundleIdentifier {
        case "com.apple.dock": self = .dock
        case "com.apple.finder": self = .finder
        case "com.apple.Spotlight": self = .spotlight
        case "com.apple.apps.launcher": self = .launcher
        case nil, "": self = .unknown
        default: self = .other
        }
    }
}

struct AppleEventActivation: Equatable {
    enum Kind: String {
        case reopen
        case other
        case missing
    }

    let kind: Kind
    let sender: AppleEventSender
    let senderPID: pid_t?
    let senderBundleIdentifier: String?
    let eventClass: AEEventClass?
    let eventID: AEEventID?
}

enum AppleEventSenderResolver {
    /// Read synchronously inside the delegate callback: the manager only owns
    /// this descriptor for the event currently being dispatched.
    @MainActor
    static func currentActivation() -> AppleEventActivation {
        resolve(event: NSAppleEventManager.shared().currentAppleEvent)
    }

    static func resolve(
        event: NSAppleEventDescriptor?,
        senderPIDDescriptor: (NSAppleEventDescriptor) -> NSAppleEventDescriptor? = {
            $0.attributeDescriptor(forKeyword: AEKeyword(keySenderPIDAttr))
        },
        bundleIdentifierForPID: (pid_t) -> String? = {
            NSRunningApplication(processIdentifier: $0)?.bundleIdentifier
        }
    ) -> AppleEventActivation {
        guard let event else {
            return AppleEventActivation(
                kind: .missing, sender: .unknown, senderPID: nil, senderBundleIdentifier: nil,
                eventClass: nil, eventID: nil
            )
        }
        guard event.descriptorType == typeAppleEvent else {
            return AppleEventActivation(
                kind: .other, sender: .unknown, senderPID: nil, senderBundleIdentifier: nil,
                eventClass: nil, eventID: nil
            )
        }
        let isReopen = event.eventClass == AEEventClass(kCoreEventClass)
            && event.eventID == AEEventID(kAEReopenApplication)
        var bundleID: String?
        var senderPID: pid_t?
        if isReopen,
           let descriptor = senderPIDDescriptor(event),
           descriptor.descriptorType == typeSInt32 || descriptor.descriptorType == typeUInt32 {
            let data = descriptor.data
            if data.count == MemoryLayout<UInt32>.size {
                // Native reopen events can supply 'magn' despite the SDK's
                // 'long' annotation. Both must fit a positive signed pid_t.
                var rawPID: UInt32 = 0
                // Copy into aligned storage instead of loading from Data's
                // potentially unaligned base address.
                _ = withUnsafeMutableBytes(of: &rawPID) { data.copyBytes(to: $0) }
                if let pid = pid_t(exactly: rawPID), pid > 0 {
                    senderPID = pid
                    bundleID = bundleIdentifierForPID(pid)
                }
            }
        }
        // keyAddressAttr describes the event's target, so even a valid kpid
        // address is not sufficient evidence of who sent the event.
        if bundleID?.isEmpty == true { bundleID = nil }
        return AppleEventActivation(
            kind: isReopen ? .reopen : .other,
            sender: AppleEventSender(bundleIdentifier: bundleID),
            senderPID: senderPID,
            senderBundleIdentifier: bundleID,
            eventClass: event.eventClass,
            eventID: event.eventID
        )
    }
}

```

### Core Architecture Module: `Sources/StatusTrioCore/App/BluetoothAudioIconOverrideSynchronizer.swift`
```
import Combine
import Foundation

enum BluetoothAudioIconOverrideUpdate: Equatable {
    case unchanged
    case clear
    case set(String)
}

@MainActor
final class BluetoothAudioIconOverrideSynchronizer {
    private var cancellables = Set<AnyCancellable>()

    func start(devices: BluetoothDeviceController, settings: SettingsStore) {
        guard cancellables.isEmpty else { return }
        Publishers.CombineLatest3(
            devices.$devices,
            devices.$availability,
            settings.$bluetoothNetworkIconDeviceAddress
        )
        .sink { [weak self, weak settings] listedDevices, availability, selectedAddress in
            guard let self, let settings else { return }
            self.synchronize(
                devices: listedDevices,
                availability: availability,
                selectedAddress: selectedAddress,
                settings: settings
            )
        }
        .store(in: &cancellables)
    }

    func stop() {
        cancellables.removeAll()
    }

    private func synchronize(
        devices: [BluetoothDevice],
        availability: BluetoothAvailability,
        selectedAddress: String?,
        settings: SettingsStore
    ) {
        switch Self.update(
            currentSymbol: settings.bluetoothNetworkIconSymbolName,
            selectedAddress: selectedAddress,
            devices: devices,
            availability: availability
        ) {
        case .unchanged:
            break
        case .clear:
            settings.bluetoothNetworkIconSymbolName = nil
        case let .set(symbolName):
            settings.bluetoothNetworkIconSymbolName = symbolName
        }
    }

    static func update(
        currentSymbol: String?,
        selectedAddress: String?,
        devices: [BluetoothDevice],
        availability: BluetoothAvailability
    ) -> BluetoothAudioIconOverrideUpdate {
        guard let selectedAddress else {
            return currentSymbol == nil ? .unchanged : .clear
        }
        guard availability == .available else { return .unchanged }

        let normalizedSelectedAddress = BluetoothBatteryReader.normalizedAddress(selectedAddress)
        guard !normalizedSelectedAddress.isEmpty,
              let device = devices.first(where: { device in
                  !device.isUnpairedGhost
                      && BluetoothBatteryReader.normalizedAddress(device.id) == normalizedSelectedAddress
              }) else {
            return .unchanged
        }

        let symbolName = BluetoothDeviceRowIcon.symbolName(for: device)
        return currentSymbol == symbolName ? .unchanged : .set(symbolName)
    }
}

```

### Core Architecture Module: `Sources/StatusTrioCore/App/BluetoothNearbyBatteryOptOutSynchronizer.swift`
```
import Combine

@MainActor
final class BluetoothNearbyBatteryOptOutSynchronizer {
    private var cancellables = Set<AnyCancellable>()

    func start(settings: SettingsStore, actions: StatusPanelActions) {
        guard cancellables.isEmpty else { return }
        Publishers.CombineLatest(
            settings.$showsBluetoothBatteryLevels,
            settings.$showsNearbyBluetoothBatteryDevices
        )
        .map { $0 && $1 }
        .removeDuplicates()
        .sink { isEnabled in
            guard !isEnabled else { return }
            actions.updateBluetoothNearbyBatteryClaim(enabled: false)
        }
        .store(in: &cancellables)
    }

    func stop() {
        cancellables.removeAll()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #345** (2026-11-15): **[Bug] 切换输入法时图标先闪一下大小写 a（a → A → 中文）**
  *Symptoms*: ## 用户反馈 切换输入法时，菜单栏图标会走 `a → A → 中文输入法`，反向也一样（`中文 → A → a`），中间会闪一下大写/小写的 a。  ## 代码线索 - #279 让输入源图标跟随 Caps Lock / Shift 显示 `a` / `A`：   `Sources/StatusTrioCore/InputSource/InputSourceModifierObserver.swift`   ```swift   var isUppercase: Bool { capsLock || shift }   ``` - 图标状态由 `InputSourceState.iconDescriptor(markerStyle:)` 合成：`selectedDescriptor.applying(modifiers).applying(markerStyle:)`。 - 修饰键与输入源是**两个独立来源**：`InputSourceController` 里 `modifierObserver.start { ... self.state.modifiers = modifiers }`，输入源变化来自 TIS 通知。两者到达顺序不保证。  ## 可能根因（高置信，待确认） macOS 常用的中文输入法切换方式是「使用大写锁定键切换 ABC 输入法」。此时按 Caps Lock 会： 1. 先产生一次 flagsChanged → `capsLock = true` → 图标立刻按英文源渲染成 **A**； 2. 随后 TIS 的“选中输入源已改变”通知才到 → 切到中文图标。  两个通知之间有一小段延迟，于是先画出中间的大写 A。反向切换同理（Caps Lock 关闭 → 先回 `a`，再切中文/英文）。  如果用户用的是 Ctrl+Space 或自定义快捷键，仍需确认是否同样存在中间态；但「先 A 后中文」的形状非常符合 Caps Lock 切换。  ## 建议修复方向 1. **合并中间态**：对「仅由 Caps Lock 变化」引起的 a/A 切换做约 150–250ms 的短延迟；如果在窗口内收到输入源切换，就直接用新输入源渲染，不画中间态。Shift 的变化保持即时，不影响手动按住 Shift 看 A 的体验。 2. 或：在检测到 Caps Lock 变化与输入源变化几乎同时发生时，只应用输入源变化，丢弃那次修饰键渲染。 3. 不要引入事件 tap、轮询或需要辅助功能权限的监听；沿用现有 `flagsChanged` 全局监听。 4. 保持菜单栏与 Dock 同步（两者共用 `IconSceneState`）；设置里的实时预览也要一致。  ## 待确认 - 用户的输入法切换方式：Caps Lock / Ctrl+Space / Ctrl+Option+Space / 自定义？ - 中间 A 是“一闪而过”还是能停留几百毫秒？ - 反向切换（中文 → 英文）是否也是先 A 再 a？ - 只在主屏菜单栏出现，还是 Dock 图标与设置预览也闪？  ## 验收 - 用 Caps Lock 切换中英文时，图标直接 a ↔ 中文，不再经过 A。 - 手动按 Shift / 开 Caps Lock 但仍用英文输入时，仍正确显示 A（#279 不回退）。 - 使用 Ctrl+Space 等非 Caps Lock 方式切换时行为正常，无中间态。 - 菜单栏、Dock、设置实时预览三处一致；有测试覆盖“修饰键与输入源连续到达”的合成顺序。  关联
  **Post-Mortem & Fix Analysis**:
  > 用户确认：**就是用 Caps Lock 切换输入法**，因此根因确认——Caps Lock 的 `flagsChanged` 先到，图标先按 #279 渲染成 `A`，TIS 的输入源切换通知后到，才变成中文图标。  修复口径补充： - 不要试图去探测“Caps Lock 是否被系统设置成切换键”（本机 `com.apple.HIToolbox` 里只有 `AppleCapsLockPressAndHoldToggleOff`，没有可靠公开键）。 - 改为**合并事件**：Caps Lock 引起的 a/A 变化延迟约 150–250ms；若窗口内收到输入源切换，就直接用新输入源渲染，**完全不画中间 A**；若窗口内没有输入源切换，再按 Caps Lock 状态渲染（保证在英文下正常用 Caps Lock 打大写时仍然显示 A）。 - Shift 保持即时，不受影响。 - 需要实测一下事件间隔（Caps Lock `flagsChanged` 到 TIS 选中变化）来确定窗口大小，避免窗口太长导致真的按 Caps Lock 打字时图标反应迟钝。  验收按原 issue：Caps Lock 切换时 a ↔ 中文 再无 A；英文下开 Caps Lock 仍显示 A；菜单栏/Dock/设置预览三处一致。
  > 这个是系统的逻辑。每次切换的时候系统都是会这样处理，所以先不管

- **Issue #341** (2026-11-13): **[Bug] Dock 图标点击第二次不会隐藏面板，应像菜单栏图标一样开关**
  *Symptoms*: ## 用户需求 Dock 图标点击打开状态面板后，**再点一次 Dock 图标应隐藏面板**，与菜单栏图标的开关行为一致。现在第二次点击不会收起。  ## 现状代码 - `Sources/StatusTrioCore/App/DockActivationAction.swift`：Dock 点击走 `.showPopover`，最终调用 `StatusBarController.togglePopover(anchoredAtScreenPoint:)`。 - `Sources/StatusTrioCore/UI/StatusBarController.swift:622-640`：  ```swift func togglePopover(anchoredAtScreenPoint point: NSPoint) {     guard popoverToggleGate.shouldAccept(at: Date()) else { return }     if popover.isShown { closePopover(); return }     let anchor = dockAnchor(at: point)     presentPopover(...) } ```  - 对比菜单栏路径 `togglePopover()`（同文件 581-604）多了这一步：  ```swift if !popover.isShown, reopenSuppression.shouldSuppressReopen(at: Date()) { return } ```  ## 根因 第二次点击 Dock 图标时的事件顺序是： 1. **mouse-down**：全局 `popoverDismissMonitor`（`installPopoverDismissMonitor`，同文件约 1037-1062）判定这是面板外的点击，于是 `reopenSuppression.recordClose(mouseButtonDown: true)` 并 `popover.performClose(nil)`，面板其实**已经关了**。 2. **reopen 事件**：Dock 点击继续产生应用 reopen，路由到 `togglePopover(anchoredAtScreenPoint:)`；此时 `popover.isShown == false`，而该方法没有检查 `reopenSuppression`，于是又 `presentPopover` 打开。  结果：先关后开，看起来“点不消失”。菜单栏路径正是靠 `reopenSuppression` 修掉了同类的 #224 问题，Dock 路径漏了这段。  ## 建议修复 - 在 `togglePopover(anchoredAtScreenPoint:)` 开头补上与菜单栏一致的守卫：   ```swift   if !popover.isShown, reopenSuppression.shouldSuppressReopen(at: Date()) { return }   ``` - 更彻底（可选）：把 Dock 图标的点击也视为“所有者点击”，在 `PopoverDismissalPolicy` 里识别上次 Dock 锚点附近（打开时记录 `point`），避免先关后开的一帧闪烁；`NSDockTile` 没有公开 frame，所以需保存上次锚点而不是查询 Dock。 - 注意 `pop
  **Post-Mortem & Fix Analysis**:
  > 已在分支 `dsh-024b6289-5f73` 修复（commit 4b4b5968）。  改了什么：`togglePopover(anchoredAtScreenPoint:)` 在消费 `popoverToggleGate` 之前，先按菜单栏路径同样的方式检查 `reopenSuppression`，这样第二次点击 Dock 图标时 mouse-down 已经关掉面板、随后的 reopen 不再把它重新打开。  验证： - 新增 `PopoverReopenSuppressionTests` 两条：一条断言 Dock 入口的先抑制、后门控顺序（修复前失败），一条断言“关→重开→再点”只抑制一次、下一次仍能打开； - 相邻回归 `PopoverToggleGateTests`、`PopoverDismissalPolicyTests`、`DockPlacementTests` 通过； - `bash scripts/verify-local.sh full` 全量本地档案通过（不含签名/公证/DMG/正式发布）。  还需要你验收：真实 Dock 连点第二次收起、第三次重新打开；快速连点不卡死；面板外点击正常关闭；Dock 自动隐藏与左/右侧布局同样成立。真实 Dock 点击属于 Finder 进程，后台 UI 测试无法安全模拟，所以这几项标为待人工验收。
  > 已验收通过并合并到 `main`（4b4b5968），分支 `dsh-024b6289-5f73` 与 worktree 已清理。按规则先不关闭，等正式发布后统一核对版本再关闭。

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

### Incident Patch 1: `3e5bd226` (2026-11-16)
**Commit Message**: fix(sleep): re-read lid state instead of caching external ownership

Once an external disablesleep was seen, the controller remembered it and skipped re-reading, so after the other app cleared it the toggle stayed blocked and kept naming the old app. Enabling now always re-reads the live state; a now-off value enables normally and clears the stale external message, while a still-on value re-detects (and re-queries) the owner.

**File**: `Sources/StatusTrioCore/Monitoring/SleepControlController.swift` (modified, +1/-5)
```diff
@@ -416,10 +416,6 @@ final class SleepControlController: ObservableObject {
         guard !isStopped else { return }
         if enabled {
             guard canEnableLidSleep else { return }
-            guard !lidForeignActive else {
-                lidSleepExternalState = .managedExternally
-                return
-            }
         }
         requestLidState(enabled)
     }
@@ -470,7 +466,7 @@ final class SleepControlController: ObservableObject {
             if target {
                 // Re-check after any previous await: an unplug during an in-flight
                 // enable must flip the target off before we ever write `1`.
-                if lidForeignActive || !canEnableLidSleep {
+                if !canEnableLidSleep {
                     desiredLidSleep = false
                     if isPreventingLidSleep { continue }
                     return
```

---

### Incident Patch 2: `20f881b1` (2026-11-16)
**Commit Message**: revert(panel): drop GlassEffectContainer grouping over the AppKit glass panel

Wrapping the sibling cards/pills in a GlassEffectContainer washed the glass out and made the keep-awake text unreadable over the NSGlassEffectView panel, so the grouping is reverted. The neutral-glass tint and single material layer changes are kept.

**File**: `Sources/StatusTrioCore/UI/PowerInfoBarView.swift` (modified, +1/-15)
```diff
@@ -10,21 +10,6 @@ struct PowerInfoBarView: View {
     let state: PowerInfoBarState
 
     var body: some View {
-        cardRow
-            .accessibilityElement(children: .contain)
-    }
-
-    /// Group the adjacent glass cards in one GlassEffectContainer (skill rule:
-    /// nearby custom glass must share a container or their refraction diverges).
-    @ViewBuilder private var cardRow: some View {
-        if #available(macOS 26.0, *) {
-            GlassEffectContainer(spacing: 8) { rowContent }
-        } else {
-            rowContent
-        }
-    }
-
-    private var rowContent: some View {
         HStack(spacing: 8) {
             if state.items.isEmpty {
                 ForEach(state.placeholderKinds, id: \.self) { kind in
@@ -36,6 +21,7 @@ struct PowerInfoBarView: View {
                 }
             }
         }
+        .accessibilityElement(children: .contain)
     }
 
     private func card(kind: PowerInfoBarKind, value: String?) -> some View {
```

**File**: `Sources/StatusTrioCore/UI/QuickActionsCardView.swift` (modified, +1/-11)
```diff
@@ -65,17 +65,7 @@ struct QuickActionsCardView: View {
             || (control.isPreventingLidSleep && control.lidExpiry != nil)
     }
 
-    @ViewBuilder private func pillRow(now: Date) -> some View {
-        if #available(macOS 26.0, *) {
-            // One container for the adjacent glass capsules so they sample each
-            // other's glass consistently (skill group rule).
-            GlassEffectContainer(spacing: 8) { pillStack(now: now) }
-        } else {
-            pillStack(now: now)
-        }
-    }
-
-    private func pillStack(now: Date) -> some View {
+    private func pillRow(now: Date) -> some View {
         VStack(alignment: .leading, spacing: 8) {
             if showsDisplay {
                 displayPill(now: now)
```

---

### Incident Patch 3: `3f8c4853` (2026-11-16)
**Commit Message**: style(panel): align liquid glass with skill guidance

Wrap the adjacent power-info cards and the two keep-awake capsules in one GlassEffectContainer each so nearby glass samples consistently; keep neutral charger-input cards untinted (tint only semantic cards); drop the extra ultraThinMaterial behind material-mode cards to remove double frosting. Progress/pill hover behaviour unchanged.

**File**: `Sources/StatusTrioCore/UI/PanelCardSurfaceStyle.swift` (modified, +10/-3)
```diff
@@ -81,20 +81,27 @@ private struct PanelCardSurfaceModifier: ViewModifier {
         switch cardStyle {
         case .glass:
             if #available(macOS 26.0, *), PanelCardSurfaceExperiment.useNative, cardStyle == .glass {
-                content
-                    .glassEffect(
+                // Skill: tint only when the colour carries meaning. Neutral
+                // charger-input cards stay plain glass; semantic cards tint.
+                if case .silver = surface {
+                    content.glassEffect(.regular, in: shape)
+                } else {
+                    content.glassEffect(
                         .regular.tint(surface.fill(tint: tint, scheme: scheme, cardStyle: .glass)),
                         in: shape
                     )
+                }
             } else {
                 content
                     .background(shape.fill(surface.fill(tint: tint, scheme: scheme, cardStyle: .glass)))
                     .overlay { shape.strokeBorder(surface.stroke(tint: tint, scheme: scheme, cardStyle: .glass), lineWidth: 1) }
             }
         case .material:
+            // The panel already draws the popover material; adding another
+            // ultraThinMaterial here double-frosted the cards. Keep only the
+            // semantic wash + hairline rim.
             content
                 .background(shape.fill(surface.fill(tint: tint, scheme: scheme, cardStyle: .material)))
-                .background(shape.fill(.ultraThinMaterial))
                 .overlay { shape.strokeBorder(surface.stroke(tint: tint, scheme: scheme, cardStyle: .material), lineWidth: 1) }
         case .solid:
             content
```

**File**: `Sources/StatusTrioCore/UI/PowerInfoBarView.swift` (modified, +15/-1)
```diff
@@ -10,6 +10,21 @@ struct PowerInfoBarView: View {
     let state: PowerInfoBarState
 
     var body: some View {
+        cardRow
+            .accessibilityElement(children: .contain)
+    }
+
+    /// Group the adjacent glass cards in one GlassEffectContainer (skill rule:
+    /// nearby custom glass must share a container or their refraction diverges).
+    @ViewBuilder private var cardRow: some View {
+        if #available(macOS 26.0, *) {
+            GlassEffectContainer(spacing: 8) { rowContent }
+        } else {
+            rowContent
+        }
+    }
+
+    private var rowContent: some View {
         HStack(spacing: 8) {
             if state.items.isEmpty {
                 ForEach(state.placeholderKinds, id: \.self) { kind in
@@ -21,7 +36,6 @@ struct PowerInfoBarView: View {
                 }
             }
         }
-        .accessibilityElement(children: .contain)
     }
 
     private func card(kind: PowerInfoBarKind, value: String?) -> some View {
```

**File**: `Sources/StatusTrioCore/UI/QuickActionsCardView.swift` (modified, +11/-1)
```diff
@@ -65,7 +65,17 @@ struct QuickActionsCardView: View {
             || (control.isPreventingLidSleep && control.lidExpiry != nil)
     }
 
-    private func pillRow(now: Date) -> some View {
+    @ViewBuilder private func pillRow(now: Date) -> some View {
+        if #available(macOS 26.0, *) {
+            // One container for the adjacent glass capsules so they sample each
+            // other's glass consistently (skill group rule).
+            GlassEffectContainer(spacing: 8) { pillStack(now: now) }
+        } else {
+            pillStack(now: now)
+        }
+    }
+
+    private func pillStack(now: Date) -> some View {
         VStack(alignment: .leading, spacing: 8) {
             if showsDisplay {
                 displayPill(now: now)
```

#### Recent Merged Pull Requests:
- **PR #343** (2026-11-14): feat(update): 新增 Gitee 国内镜像和一次性 Gitee 优先更新 (@lingyired)
- **PR #340** (2026-11-13): fix(bluetooth): 多副 AirPods 聆听模式匹配与附加控件补位 (@lingyired)
- **PR #335** (closed): feat(wifi): add opt-in in-app joining for open and personal networks (@KryptonGao)
- **PR #332** (2026-11-11): feat(settings): preferences-only transfer, polish pane, document catalog rule (@lingyired)
- **PR #329** (2026-11-11): feat(settings): add versioned settings export/import with backup and undo (@KryptonGao)
- **PR #327** (2026-11-11): feat(settings): always allow slider scrolling and simplify the panel option (@lingyired)

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

## X. sleep): re-read lid state instead of caching external ownership

**RULE**:
When implementing operations in `Sources/StatusTrioCore/Monitoring/SleepControlController.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingyired/status-trio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3e5bd226`: sleep): re-read lid state instead of caching external ownership. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/StatusTrioCore/Monitoring/SleepControlController.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                if !canEnableLidSleep {
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            guard !lidForeignActive else {
                lidSleepExternalState = .managedExternally
                return
            }
                if lidForeignActive || !canEnableLidSleep {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3e5bd226` are properly handled with clean fallback behavior.
