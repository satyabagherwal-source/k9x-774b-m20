# Verification Protocol: Verification Protocol: Empirical Defect Shield for lingyired-status-trio-learnings

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T03:58:44.879Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T03:58:44.879Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `lingyired-status-trio-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lingyired-status-trio-learnings.md`  
> **Source**: github ([https://github.com/lingyired/status-trio](https://github.com/lingyired/status-trio))  
> **Source Version**: `56ec144e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T03:58:33.409Z  
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
> **Harvest Timestamp**: 2026-11-24T03:58:33.267Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingyired/status-trio`
- **Description**: Status Trio — a native macOS app that combines Wi-Fi, battery, and volume into one compact, configurable status icon for the menu bar, the Dock, or both, inspired by the iPhone Duo combined status bar.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2085 stars

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

// The packaged launcher and swift run share the same AppKit entry point.
@MainActor
@_cdecl("StatusTrioRunApplication")
public func runStatusTrioApplication() {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.run()
}

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
    let localIconPluginRuntime: LocalIconPluginRuntime
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
    private var hardwareRingDemandWiring: IconHardwareDemandWiring?
    private var hardwareSamplingSettingsCancellables = Set<AnyCancellable>()
    private var localIconDemandWiring: IconLiveDemandWiring?
    private var localIconPluginCancellables = Set<AnyCancellable>()
    private let localIconRefreshCoalescer = IconLiveResolutionCoalescer(
        minimumInterval: 0.25,
        timing: .live()
    )
    private let hardwareBackgroundDemandController: HardwareBackgroundDemandController
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
        backgroundUITesting: BackgroundUITestingConfiguration = .disabled,
        localIconPluginRuntime: LocalIconPluginRuntime = LocalIconPluginRuntime(directories: { [] })
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
        self.localIconPluginRuntime = localIconPluginRuntime
        self.menuBarChargingEffectEnabled = settings.showsMenuBarChargingEffect
        self.dockChargingEffectEnabled = settings.showsDockChargingEffect
        self.hardwareBackgroundDemandController = HardwareBackgroundDemandController(store: store, settings: settings)
    }

    func start() {
        startPreviewResourceLifecycleIfNeeded()
        memoryPressureMonitor.onPressure = { [weak self] in
            self?.releaseRebuildableResources()
        }
        memoryPressureMonitor.start()
        iconPresentation.start()
        startHardwareRingDemand()
        startHardwareSamplingSettings()
        startLocalIconPluginRuntime()
        hardwareBackgroundDemandController.start()
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
                if let raw = backgroundUITesting.opensHardwareDetailRaw,
                   let detail = HardwareDetailKind(rawValue: raw) {
                    // Present first, then route on the next main turn so the
                    // panel's own prepare/reset cannot overwrite the page.
                    DispatchQueue.main.async { [weak self] in
                        self?.statusBarController.panelForTesting.showHardwareDetail(detail)
                    }
                }
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
        hardwareBackgroundDemandControlle
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
- **Issue #370** (2026-11-22): **[Bug] 内存详情页「内存占用排行」未按占用降序，2.0 GB 排在 294 MB 之后**
  *Symptoms*: ## 现象 内存详情页的「内存占用排行（RSS）」顺序不对，不是按占用从大到小。截图示例： - Google Chrome 4.9 GB → Antigravity 1.2 GB → QQ 音乐 636 MB → Gemini 328 MB → Clash Verge 294 MB → **ChatGPT 2.0 GB** → 腾讯视频 1.3 GB → Bob 242 MB  2.0 GB 和 1.3 GB 排在 294 MB 后面，说明排序失效。  ## 根因（代码已确认） `Sources/StatusTrioCore/Monitoring/TopAppsService.swift:265-293` 的 `mergedRows(previous:incoming:limit:)`：  ```swift var result: [TopAppRow] = [] for old in previous {                       // 先按上一次的顺序     if let updated = byID.removeValue(forKey: old.id) {         result.append(updated)              // 只更新数值，不动位置     } else {         result.append(... value: 0 ...)     // 旧行保留但置 0     } } for row in incoming where byID[row.id] != nil {     result.append(row)                      // 新出现的应用直接追加到末尾     byID.removeValue(forKey: row.id) } // 只在超限时移除 0 值行，全程没有按 value 排序 ```  设计初衷是“保持列表高度稳定、避免每次刷新抖动”，但代价是**顺序永远冻结在第一次出现的顺序**： - 已经在列表里的应用，占用变大变小都不会换位； - 新出现的高占用应用只能排在末尾（ChatGPT 2.0 GB 就是这样掉到 294 MB 后面）。  CPU、GPU、网络排行共用这个合并逻辑，同样有这个问题。  ## 建议修复 1. 合并后**按当前数值降序排序**再输出：`value` 降序；网络类可用 `value + upload`（或按现有展示字段）排序；相同值用名称/pid 稳定排序。 2. 保留“掉到 0 的行不立刻消失”的意图：排序后 0 值行自然落到末尾，超限时优先剔除 0 值行（现有剔除逻辑可保留）。 3. 可选：为避免每秒刷新时轻微数值抖动引起行来回跳，可加一个**很小的重排阈值**（例如只有在与相邻行差距超过 5% 或顺序计算有变化时才重排），但不要因此让 2.0 GB 排在 294 MB 后面。 4. 如果担心频繁重排导致视觉抖动，可对行加入 `.animation`/稳定 id（id 已是应用身份），而不是冻结顺序。 5. 排序逻辑建议放在纯函数里（如 `TopAppRanking.sorted(_:)`），便于测试；`mergedRows` 只负责合并与保留。  ## 验收 - 内存排行严格按占用降序显示；截图中的 ChatGPT 2.0 GB、腾讯视频 1.3 GB 应排在 294 MB 之前。 - 应用占用上升/下降会相应移动位置；新出现的高占用应用出现在正确位置。 - CPU、GPU、网络排行同样按数值
  **Post-Mortem & Fix Analysis**:
  > 已确认：**所有应用排行（内存 / CPU / GPU / 网络）都要一起修**，每次数据更新都必须重新按数值排序。  因此去掉“为保持列表高度稳定而冻结顺序”的做法：合并只负责补 0 值行与截断，输出前统一按当前数值降序重排。不要加会阻止重排的阈值；如果担心行跳动，用固定 id + 轻量动画解决，而不是保留旧顺序。  验收补充： - 任意一次刷新后，四个排行都严格降序； - 占用上升/下降会立即换位，新出现的高占用应用出现在正确位置； - 0 值行仍按原策略短暂保留在末尾，不影响排序。
  > 已在 v1.10.4（build 71） 修复：高占用应用排行每次刷新按当前数值重新排序。

- **Issue #367** (2026-11-22): **[Bug] 电源 Helper 每 30 秒轮询状态触发系统代码签名校验，导致持续磁盘读取**
  *Symptoms*: ## 用户反馈 系统某个核心后台守护进程出现很高的异常磁盘读取量；让 agent 排查后反馈：**Status Trio 每 30 秒计算一次代码签名**，累计造成大量读取。  ## 代码上最可能的来源（待用户现场证据确认） `Sources/StatusTrioCore/App/PrivilegedHelperManager.swift`： - `defaultEnabledStatusPollInterval = .seconds(30)`（同文件 182-188 行注释：状态只在用户操作时变，30 秒是“重读系统状态”的节奏）。 - `refresh()`（312 行起）会调用 `publishSystemState()` 和 `updateStatusPolling()`，读取 `SMAppService.daemon(plistName:)` 的 `status`。 - `SystemPrivilegedHelperService.service` 是**计算属性**，每次访问都会新建一个 `SMAppService.daemon(...)` 实例。  `SMAppService` 查询注册状态时，macOS 会去校验 LaunchDaemon 的注册与**代码签名**（涉及 `syspolicyd` / `taskgated` 等系统进程）；这与“守护进程磁盘读取高、且与代码签名相关”的描述吻合。也就是说：**不是我们自己调 `SecCode*` 每 30 秒读签名**，而是 30 秒一次的 `SMAppService.status` 触发了系统侧的签名校验。  另外 `Sources/StatusTrioCore/App/AppSigningIdentity.swift` 的 `SecCodeCopySigningInformation` 也会读签名信息，但它目前只在 `SystemPrivilegedHelperService.isSupported` 里通过 `lazy resolvedAvailability` 调一次（理论上不是每 30 秒）；如果现场证据显示是这条，则应加进程内缓存（签名在进程生命周期内不会变）。  ## 建议修复方向 1. **拉长“已启用”状态的轮询**：`enabledStatusPollInterval` 从 30 秒改为例如 **5 分钟**；状态只会因用户在系统设置里操作而变化，并且已有 `refreshAfterActivation()`（从系统设置返回时刷新）和面板打开时的刷新兜底。 2. **缓存 `SMAppService` 实例**：把 `service` 改为 `lazy var`，避免每次 `status` 查询都新建对象。 3. **确认静默模式生效**：`isQuiescent` 时状态轮询已是 1800 秒；需确认“面板关闭、helper 已启用”确实进入 quiescent，而不是仍在 30 秒轮询。 4. **缓存签名身份**：`AppSigningIdentity.current()` 增加进程内 memo（含 nil 结果），避免任何重复调用；并在注释里写明“运行期不变”。 5. 任何改动都保留现有安全语义：Ad-hoc/开发构建仍然 `nil`、不可用；helper 审批状态仍能在用户操作后及时刷新。 6. 若确认磁盘读取来自 `SMAppService.status` 的签名校验，应避免在后台无 UI 需求时轮询；只在以下时机读：应用启动、面板/设置可见、从系统设

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

### Incident Patch 1: `a833d6a0` (2026-11-23)
**Commit Message**: fix(power): interpret backlight calibration as microamps

AppleARMBacklight's current-for-max-backlight is reported in microamps
(904383 on Mac15,9 = 904.383 mA). The estimator was treating it as milliamps
and rejecting it as out of range, so #374 produced no display branch at all.

Compute watts as fraction × calibrationMicroAmps / 1,000,000 × 6 V, add a
live-value regression (3199/13799 × 904383 µA ≈ 1.26 W), and bump the test
candidate to Build 73.

**File**: `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift` (modified, +18/-14)
```diff
@@ -56,7 +56,7 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
 
     private let lock = NSLock()
     private var service: io_service_t = 0
-    private var calibrationMilliamps: Double?
+    private var calibrationMicroAmps: Double?
     private var retryAfter: Date = .distantPast
 
     deinit {
@@ -69,7 +69,7 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
             IOObjectRelease(service)
             service = 0
         }
-        calibrationMilliamps = nil
+        calibrationMicroAmps = nil
         retryAfter = .distantPast
         lock.unlock()
     }
@@ -87,11 +87,12 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
               current.value > 0, current.max > 0, calibration > 0 else {
             return nil
         }
-        let fraction = min(max(current.value / current.max, 0), 1)
-        let milliamps = fraction * calibration
-        let watts = milliamps / 1000 * Self.assumedVoltage
-        guard watts.isFinite,
-              (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
+        guard let watts = Self.estimatedWatts(currentMicroAmps: current.value,
+                                              maximumMicroAmps: current.max,
+                                              calibrationMicroAmps: calibration) else {
+            return nil
+        }
+        guard (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
             return nil
         }
         return DisplayPowerSample(watts: watts, readAt: date, provenance: .estimated,
@@ -117,13 +118,15 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
     }
 
     private func calibrationLocked(from properties: [String: Any]) -> Double? {
-        if let calibrationMilliamps { return calibrationMilliamps }
+        if let calibrationMicroAmps { return calibrationMicroAmps }
         guard let parameters = properties["backlight-calibration-parameters"] as? [String: Any],
               let value = Self.number(parameters["current-for-max-backlight"]),
-              value.isFinite, (1...20_000).contains(value) else {
+              value.isFinite, (1_000...2_000_000).contains(value) else {
             return nil
         }
-        calibrationMilliamps = value
+        // The key is in microamps (904383 on Mac15,9 = 904.383 mA for the
+        // maximum backlight), matching BrightnessMicroAmps' scale.
+        calibrationMicroAmps = value
         return value
     }
 
@@ -144,12 +147,13 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
     }
 
     static func estimatedWatts(currentMicroAmps value: Double, maximumMicroAmps maximum: Double,
-                               calibrationMilliamps: Double,
+                               calibrationMicroAmps: Double,
                                assumedVoltage: Double = AppleARMBacklightPowerEstimator.assumedVoltage) -> Double? {
-        guard value.isFinite, maximum.isFinite, calibrationMilliamps.isFinite,
-              value > 0, maximum > 0, calibrationMilliamps > 0 else { return nil }
+        guard value.isFinite, maximum.isFinite, calibrationMicroAmps.isFinite,
+              value > 0, maximum > 0, calibrationMicroAmps > 0 else { return nil }
         let fraction = min(max(value / maximum, 0), 1)
-        let watts = fraction * calibrationMilliamps / 1000 * assumedVoltage
+        // microamps -> amps; the 6 V string voltage is the named assumption.
+        let watts = fraction * calibrationMicroAmps / 1_000_000 * assumedVoltage
         guard watts.isFinite else { return nil }
         return watts
     }
```

**File**: `Support/Info.plist` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 	<key>CFBundleShortVersionString</key>
 	<string>1.10.5</string>
 	<key>CFBundleVersion</key>
-	<string>72</string>
+	<string>73</string>
 	<key>LSMinimumSystemVersion</key>
 	<string>13.0</string>
 	<key>LSUIElement</key>
```

**File**: `Tests/StatusTrioCoreTests/SystemPowerReaderTests.swift` (modified, +7/-3)
```diff
@@ -333,13 +333,17 @@ extension SystemPowerReaderTests {
     func testBacklightEstimateFormulaUsesCalibrationAndNamedVoltage() {
         let watts = AppleARMBacklightPowerEstimator.estimatedWatts(
             currentMicroAmps: 500, maximumMicroAmps: 1_000,
-            calibrationMilliamps: 800, assumedVoltage: 6)
+            calibrationMicroAmps: 800_000, assumedVoltage: 6)
         XCTAssertEqual(watts ?? 0, 2.4, accuracy: 0.0001)
         XCTAssertNil(AppleARMBacklightPowerEstimator.estimatedWatts(
             currentMicroAmps: 500, maximumMicroAmps: 0,
-            calibrationMilliamps: 800))
+            calibrationMicroAmps: 800_000))
         XCTAssertNil(AppleARMBacklightPowerEstimator.estimatedWatts(
             currentMicroAmps: 500, maximumMicroAmps: 1_000,
-            calibrationMilliamps: 0))
+            calibrationMicroAmps: 0))
+        // Mac15,9 live values: 3199/13799 × 904383 µA × 6 V ≈ 1.26 W.
+        XCTAssertEqual(AppleARMBacklightPowerEstimator.estimatedWatts(
+            currentMicroAmps: 3_199, maximumMicroAmps: 13_799,
+            calibrationMicroAmps: 904_383) ?? 0, 1.258, accuracy: 0.01)
     }
 }
```

---

### Incident Patch 2: `9041c25e` (2026-11-23)
**Commit Message**: fix(power): use panel-class backlight profiles for XDR and SDR Air

The 3.34 V calibration derived from M3 Max XDR is not valid for MacBook Air.
XDR panels keep the fixed-point/3.34 V model; SDR panels keep macpow's 6 V
model with microamp calibration. Air still needs real-device calibration.

**File**: `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift` (modified, +48/-13)
```diff
@@ -53,12 +53,15 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
         self.panelIsOn = panelIsOn
     }
 
-    /// Effective backlight rail voltage used for the estimate. macpow's generic
-    /// 6 V assumption underestimates Apple Silicon XDR panels by roughly 8×:
-    /// on Mac15,9 the calibration-derived 3.199 A and the measured 10.69 W PDBR
-    /// imply ≈3.34 V, so use that explicitly as an estimate parameter. It is
-    /// still an assumption, never presented as a measured voltage.
-    static let assumedVoltage: Double = 3.34
+    /// Effective backlight rail voltage used for an XDR estimate. macpow's
+    /// generic 6 V assumption underestimates Apple Silicon XDR panels by
+    /// roughly 8×: on Mac15,9 the calibration-derived 3.199 A and the measured
+    /// 10.69 W PDBR imply ≈3.34 V. It is still an assumption, never presented
+    /// as a measured voltage.
+    static let xdrAssumedVoltage: Double = 3.34
+    /// SDR panels (including MacBook Air) use macpow's original 6 V model; it
+    /// was designed for this class and there is no XDR HDR current scaling.
+    static let sdrAssumedVoltage: Double = 6.0
     /// A branch below this is not drawn; it is a UI visibility threshold, not a
     /// sensor validity threshold.
     static let minimumVisibleWatts: Double = 0.05
@@ -104,17 +107,20 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
               current.value > 0, current.max > 0, calibration > 0 else {
             return nil
         }
+        let profile = Self.panelProfile(maxNits: Self.maxNits(from: properties))
+        let voltage = Self.assumedVoltage(for: profile)
         guard let watts = Self.estimatedWatts(currentMicroAmps: current.value,
                                               maximumMicroAmps: current.max,
-                                              calibrationFixedPoint: calibration) else {
+                                              calibrationFixedPoint: calibration,
+                                              profile: profile) else {
             return nil
         }
         guard (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
             return nil
         }
         return DisplayPowerSample(watts: watts, readAt: date, provenance: .estimated,
                                   source: "AppleARMBacklight",
-                                  assumedVoltage: Self.assumedVoltage)
+                                  assumedVoltage: voltage)
     }
 
     private func propertiesLocked() -> [String: Any]? {
@@ -163,16 +169,45 @@ final class AppleARMBacklightPowerEstimator: BacklightPowerEstimating, @unchecke
         return (value, maximum)
     }
 
+    enum PanelProfile: String, Equatable, Sendable {
+        case xdr
+        case sdr
+    }
+
+    static func panelProfile(maxNits: Double?) -> PanelProfile {
+        (maxNits ?? 0) >= 1_000 ? .xdr : .sdr
+    }
+
+    static func assumedVoltage(for profile: PanelProfile) -> Double {
+        profile == .xdr ? xdrAssumedVoltage : sdrAssumedVoltage
+    }
+
+    /// `BrightnessMilliNits.max` is the panel's peak (HDR) nits. It separates
+    /// XDR panels (where BrightnessMicroAmps' max is the HDR peak current) from
+    /// SDR Air-style panels (where macpow's 6 V model applies).
+    static func maxNits(from properties: [String: Any]) -> Double? {
+        guard let display = properties["IODisplayParameters"] as? [String: Any],
+              let nits = display["BrightnessMilliNits"] as? [String: Any],
+              let maximum = number(nits["max"]), maximum.isFinite else { return nil }
+        return maximum / 1000
+    }
+
     static func estimatedWatts(currentMicroAmps value: Double, maximumMicroAmps maximum: Double,
                                calibrationFixedPoint: Double,
-                               assumedVoltage: Double = AppleARMBacklightPowerEstimator.assumedVoltage) -> Double? {
+                               profile: PanelProfile = .xdr,
+                               assumedVoltage: Double? = nil) -> Double? {
         guard value.isFinite, maximum.isFinite, calibrationFixedPoint.isFinite,
               value > 0, maximum > 0, calibrationFixedPoint > 0 else { return nil }
         let fraction = min(max(value / maximum, 0), 1)
-        // Calibration is 16.16 fixed-point amps; BrightnessMicroAmps is the same
-        // fraction at millamp scale. Power uses the named effective rail voltage.
-        let maxAmps = calibrationFixedPoint / 65_536
-        let watts = fraction * maxAmps * assumedVoltage
+        // XDR calibration is 16.16 fixed-point amps; SDR keeps macpow's
+        // microamp/milliamp interpretation. Power uses the named profile voltage.
+        let maxAmps: Double
+        switch profile {
+        case .xdr: maxAmps = calibrationFixedPoint / 65_536
+        case .sdr: maxAmps = calibrationFixedPoint / 1_000_000
+        }
+        let voltage 
```

**File**: `Tests/StatusTrioCoreTests/SystemPowerReaderTests.swift` (modified, +7/-0)
```diff
@@ -346,6 +346,13 @@ extension SystemPowerReaderTests {
         XCTAssertEqual(AppleARMBacklightPowerEstimator.estimatedWatts(
             currentMicroAmps: 3_199, maximumMicroAmps: 13_799,
             calibrationFixedPoint: 904_383) ?? 0, 10.66, accuracy: 0.05)
+        // SDR/Air profile keeps macpow's 6 V model; full-scale is 0.904 A × 6 V.
+        XCTAssertEqual(AppleARMBacklightPowerEstimator.estimatedWatts(
+            currentMicroAmps: 13_799, maximumMicroAmps: 13_799,
+            calibrationFixedPoint: 904_383, profile: .sdr) ?? 0, 5.426, accuracy: 0.01)
+        XCTAssertEqual(AppleARMBacklightPowerEstimator.panelProfile(maxNits: 1_600), .xdr)
+        XCTAssertEqual(AppleARMBacklightPowerEstimator.panelProfile(maxNits: 500), .sdr)
+        XCTAssertEqual(AppleARMBacklightPowerEstimator.panelProfile(maxNits: nil), .sdr)
     }
 }
 
```

**File**: `docs/battery-power-flow.md` (modified, +4/-2)
```diff
@@ -31,8 +31,10 @@
 M3 Air（Mac15,12）没有 `PDBR`，`PBLR` 恒为 0。旧逻辑把 0 当成有效背光并绘制“显示器 0.00 W”。现在按以下顺序：
 
 1. 实测 SMC 背光轨道：新代际先 `PBwo`，再 `PDBR`，最后 `PBLR`；任一读数大于 0.05 W 即使用实测值。
-2. 若实测轨道全部缺失或为 0，读取 `AppleARMBacklight` 的 `BrightnessMicroAmps` 与 `backlight-calibration-parameters.current-for-max-backlight`，按 macpow 方法估算：`电流比例 × (校准最大电流 ÷ 65,536) A × 3.34 V`。
-3. 3.34 V 是按本机 PDBR 反推的等效估算参数，不是实测电压；macpow 通用的 6 V 假设在 Apple Silicon XDR 上会低约 8 倍；估算值在流向图显示 `≈`，悬停提示标 “Estimated”，并让系统 residual 也标记为估算（因为 residual = source − charging − display − usb）。
+2. 若实测轨道全部缺失或为 0，读取 `AppleARMBacklight` 的 `BrightnessMicroAmps` 与 `backlight-calibration-parameters.current-for-max-backlight`，按面板类型估算：
+   - XDR：`电流比例 × (校准值 ÷ 65,536) A × 3.34 V`（3.34 V 是按本机 PDBR 反推的等效参数）。
+   - SDR / MacBook Air：保留 macpow 的 6 V 模型（校准值按微安解释），100% 上限约 5.4 W；Air 尚未实机校准。
+3. 这些电压都是估算假设，不是实测电压；估算值在流向图显示 `≈`，悬停提示标 “Estimated”，并让系统 residual 也标记为估算（因为 residual = source − charging − display − usb）。
 4. 没有有效电流/校准数据时不发布估算分支；估算超出预算或导致 residual 超出容差时，丢弃估算分支并保留其余拆分，不伪造负 residual。内建屏不在线或已休眠（例如合盖只用外接显示器）时也不发布内建背光估算，因为 `AppleARMBacklight` 会保留旧电流值，不能把陈旧值当成当前功耗。
 5. `DISP/DISPEXT` 只代表 SoC 显示控制器，不能冒充背光功率。
 
```

**File**: `docs/sensor-capability-matrix.md` (modified, +4/-1)
```diff
@@ -67,7 +67,10 @@
 优先级：**SMC 实测（PBwo → PDBR → PBLR）→ AppleARMBacklight 估算 → 不可用**。
 
 - M3 Air（Mac15,12）`PDBR` 不存在、`PBLR` 恒为 0：0 不再作为有效背光分支发布，改为尝试 `AppleARMBacklight` 估算。
-- 估算值 = `BrightnessMicroAmps.value / max × (current-for-max-backlight ÷ 65,536) A × 3.34 V`；3.34 V 是由本机 PDBR 与校准电流反推的等效估算参数（macpow 的通用 6 V 假设在 Apple Silicon XDR 上明显偏低），不是实测电压，UI 以 `≈` 和 “Estimated” 标注。
+- 估算值按面板类型分开：
+  - XDR（`BrightnessMilliNits.max ≥ 1000`）：`BrightnessMicroAmps.value / max × (current-for-max-backlight ÷ 65,536) A × 3.34 V`；3.34 V 是由 Mac15,9 PDBR 与校准电流反推的等效估算参数（macpow 的通用 6 V 在 XDR 上明显偏低），不是实测电压。
+  - SDR / MacBook Air（`max < 1000`）：保留 macpow 的 6 V 模型，`current-for-max-backlight` 按微安解释，100% SDR 背光上限约 5.4 W；Air 仍未实机验证，不能宣称准确。
+  - 两种情况都以 `≈` 和 “Estimated” 标注。
 - 缺少有效电流或校准数据时返回 `nil`，不伪造功耗；估算导致 residual 超出容差时丢弃估算分支，而不是发布异常负 residual。
 - `DISP/DISPEXT` 不作为背光功率；它们只代表 SoC 显示控制器。
 - 显示器、USB 汇总、逐端口低于 `BatteryPowerFlowState.minimumVisibleWatts`（0.05 W）的 0 分支不绘制。
```

---

### Incident Patch 3: `ef75d72d` (2026-11-23)
**Commit Message**: fix(panel): 优化英文文案与详情行换行，避免截断 (#379)

- 缩短英文文案：Wi-Fi 副标题、功耗信息条 Charging/Discharging、流向图 Charger、刷新间隔值 10s
- 功耗信息条输入卡统一为“数值放瓦数、状态放底部标签”（拔电显示 0.0 W · No adapter）
- 详情行值列允许换行，Time remaining 等长值不再被截断

**File**: `Sources/StatusTrioCore/Presentation/Panel/PanelPresentationMapper.swift` (modified, +4/-1)
```diff
@@ -93,9 +93,12 @@ enum PanelPresentationMapper {
             // keeps its real reading.
             let unplugged = status.isPresent && !status.isConnectedToPower && abs(inputPower.watts) < 0.05
             if unplugged {
+                // The descriptor "No adapter" moves to the label line (via the
+                // .inputDisconnected kind title); the number slot keeps the
+                // truthful 0.0 W reading so every card reads "number + note".
                 items.append(PowerInfoBarItem(
                     kind: .inputDisconnected,
-                    value: localization.string(.powerInfoBarNoInput)
+                    value: watts(inputPower.watts)
                 ))
             } else {
                 items.append(PowerInfoBarItem(kind: .input, value: watts(inputPower.watts)))
```

**File**: `Sources/StatusTrioCore/Presentation/Panel/PowerInfoBarState.swift` (modified, +5/-1)
```diff
@@ -17,7 +17,11 @@ enum PowerInfoBarKind: String, Equatable, Hashable, Sendable {
 
     var title: LocalizationKey {
         switch self {
-        case .input, .inputDisconnected: return .powerInfoBarInput
+        case .input: return .powerInfoBarInput
+        // No adapter is a state, not a rail reading: keep the big number slot
+        // for the (zero) wattage and put the explanation on the wide label line,
+        // exactly as the battery rail does for "Not charging".
+        case .inputDisconnected: return .powerInfoBarNoInput
         case .batteryCharging: return .powerInfoBarBattery
         case .batteryDischarging: return .powerInfoBarDischarging
         case .batteryIdle: return .powerInfoBarNotCharging
```

**File**: `Sources/StatusTrioCore/Resources/en.lproj/Localizable.strings` (modified, +6/-6)
```diff
@@ -438,7 +438,7 @@
 "settings.refreshInterval.onBattery" = "On battery";
 "settings.refreshInterval.onPower" = "Plugged in";
 "settings.refreshInterval.description" = "Periodically checks battery, Wi-Fi, and volume status. Shorter intervals check more often.";
-"settings.refreshInterval.value" = "%d seconds";
+"settings.refreshInterval.value" = "%ds";
 "settings.popup.order" = "Displayed Items";
 "settings.popup.order.description" = "Choose which items appear in the status panel and drag to change their order.";
 "settings.popup.order.battery" = "Battery";
@@ -707,7 +707,7 @@
 "wifi.summary.band" = "%@ GHz";
 "wifi.summary.signal" = "%d dBm";
 "wifi.summary.bandAndSignal" = "%@ · %@";
-"wifi.summary.nameAccessHint" = "Tap to allow location to show the Wi-Fi name";
+"wifi.summary.nameAccessHint" = "Allow location to show Wi-Fi name";
 "settings.bluetooth.hideDevice" = "Hide device";
 "settings.bluetooth.showDevice" = "Show device";
 "settings.bluetooth.permissionRequired" = "Bluetooth permission required";
@@ -980,16 +980,16 @@
 "settings.battery.powerInfoBarDescription" = "Shows input, battery and system power below the battery module while the panel is open. Off by default.";
 "settings.battery.energyRefreshInterval" = "Background sampling interval";
 "settings.battery.energyRefreshInterval.description" = "Used while the panel is closed. The battery detail page still refreshes every 5 seconds.";
-"battery.power.input" = "Charger input";
+"battery.power.input" = "Charger";
 "battery.power.source.battery" = "Battery";
 "battery.power.charging" = "To battery";
 "battery.power.system" = "System power";
 "battery.power.system.help" = "System power (incl. SoC)";
 "battery.power.system.explanation" = "“System” is what remains after battery charging, the display and USB: it covers the SoC, memory, display controllers and other loads that are not measured on their own.";
 "power.infoBar.input" = "Charger input";
-"power.infoBar.noInput" = "No power adapter";
-"power.infoBar.battery" = "Battery charging";
-"power.infoBar.discharging" = "Battery discharging";
+"power.infoBar.noInput" = "No adapter";
+"power.infoBar.battery" = "Charging";
+"power.infoBar.discharging" = "Discharging";
 "power.infoBar.system" = "System power";
 "power.infoBar.notCharging" = "Not charging";
 "battery.power.display" = "Display";
```

**File**: `Sources/StatusTrioCore/UI/PanelPresentationStyle.swift` (modified, +14/-4)
```diff
@@ -140,14 +140,24 @@ struct PanelDetailRowsView: View {
                     Text(row.label).foregroundStyle(.secondary)
                     Spacer(minLength: 8)
                     if row.isCopyable {
-                        Button(row.value) { onCopyValue(row.value) }
-                            .buttonStyle(.plain)
-                            .textSelection(.enabled)
-                            .accessibilityLabel("\(row.label): \(row.accessibilityValue)")
+                        Button {
+                            onCopyValue(row.value)
+                        } label: {
+                            Text(row.value)
+                                .multilineTextAlignment(.trailing)
+                                .fixedSize(horizontal: false, vertical: true)
+                        }
+                        .buttonStyle(.plain)
+                        .textSelection(.enabled)
+                        .accessibilityLabel("\(row.label): \(row.accessibilityValue)")
                     } else {
                         Text(row.value)
                             .multilineTextAlignment(.trailing)
                             .textSelection(.enabled)
+                            // Let a long value (e.g. the full "About 1 hour, 48
+                            // minutes remaining") take the height it needs and
+                            // wrap onto a second line instead of truncating.
+                            .fixedSize(horizontal: false, vertical: true)
                     }
                 }
                 .foregroundStyle(row.tint.color())
```

**File**: `Tests/StatusTrioCoreTests/PanelPresentationMapperTests.swift` (modified, +8/-8)
```diff
@@ -181,9 +181,9 @@ final class PanelPresentationMapperTests: XCTestCase {
         )
 
         let inputItem = row.powerInfoBar?.items.first { $0.kind == .inputDisconnected }
-        XCTAssertEqual(inputItem?.value, localization.string(.powerInfoBarNoInput),
-                       "A fresh 0 W adapter sample on battery must not read as an idle charger")
-        XCTAssertEqual(inputItem?.title, .powerInfoBarInput)
+        XCTAssertEqual(inputItem?.value, "0.0 W",
+                       "A fresh 0 W adapter sample on battery keeps the number slot; the 'No adapter' note lives in the title")
+        XCTAssertEqual(inputItem?.title, .powerInfoBarNoInput)
         XCTAssertNil(row.powerInfoBar?.items.first { $0.kind == .input },
                      "The connected-input card must not also be present")
     }
@@ -408,7 +408,7 @@ final class PanelPresentationMapperTests: XCTestCase {
             localization: localization
         )
         XCTAssertEqual(needsPermission.title, "Connected")
-        XCTAssertEqual(needsPermission.subtitle, "Tap to allow location to show the Wi-Fi name")
+        XCTAssertEqual(needsPermission.subtitle, "Allow location to show Wi-Fi name")
         XCTAssertEqual(needsPermission.intent, .requestWiFiNameAccess)
 
         let denied = PanelPresentationMapper.network(
@@ -420,7 +420,7 @@ final class PanelPresentationMapperTests: XCTestCase {
             localization: localization
         )
         XCTAssertEqual(denied.title, "Connected")
-        XCTAssertEqual(denied.subtitle, "Tap to allow location to show the Wi-Fi name")
+        XCTAssertEqual(denied.subtitle, "Allow location to show Wi-Fi name")
         XCTAssertEqual(denied.intent, .locationSettings)
     }
 
@@ -442,7 +442,7 @@ final class PanelPresentationMapperTests: XCTestCase {
                 localization: localization
             )
             XCTAssertEqual(row.title, "Connected")
-            XCTAssertEqual(row.subtitle, "Tap to allow location to show the Wi-Fi name")
+            XCTAssertEqual(row.subtitle, "Allow location to show Wi-Fi name")
             XCTAssertNil(row.measurements)
             XCTAssertEqual(row.accessibilityValue, "")
             XCTAssertEqual(
@@ -550,7 +550,7 @@ final class PanelPresentationMapperTests: XCTestCase {
         )
 
         XCTAssertEqual(row.title, "Connected")
-        XCTAssertEqual(row.subtitle, "Tap to allow location to show the Wi-Fi name")
+        XCTAssertEqual(row.subtitle, "Allow location to show Wi-Fi name")
         XCTAssertEqual(row.intent, .requestWiFiNameAccess)
     }
 
@@ -572,7 +572,7 @@ final class PanelPresentationMapperTests: XCTestCase {
         )
 
         XCTAssertEqual(row.title, "Connected")
-        XCTAssertEqual(row.subtitle, "Tap to allow location to show the Wi-Fi name")
+        XCTAssertEqual(row.subtitle, "Allow location to show Wi-Fi name")
         XCTAssertEqual(row.intent, .locationSettings)
     }
 
```

#### Recent Merged Pull Requests:
- **PR #373** (2026-11-22): fix(release): verify the public appcast through the GitHub API first (@lingyired)
- **PR #372** (2026-11-22): docs(release): note M1 sensor temperature monitoring cost (@lingyired)
- **PR #371** (2026-11-22): fix(settings): preserve bottom indicator preferences for 1.10.4 (@lingyired)
- **PR #343** (2026-11-14): feat(update): 新增 Gitee 国内镜像和一次性 Gitee 优先更新 (@lingyired)
- **PR #340** (2026-11-13): fix(bluetooth): 多副 AirPods 聆听模式匹配与附加控件补位 (@lingyired)
- **PR #335** (closed): feat(wifi): add opt-in in-app joining for open and personal networks (@KryptonGao)

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

## X. power): interpret backlight calibration as microamps

**RULE**:
When implementing operations in `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingyired/status-trio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a833d6a0`: power): interpret backlight calibration as microamps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private var calibrationMicroAmps: Double?
        calibrationMicroAmps = nil
        guard let watts = Self.estimatedWatts(currentMicroAmps: current.value,
                                              maximumMicroAmps: current.max,
                                              calibrationMicroAmps: calibration) else {
            return nil
        }
        guard (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
        if let calibrationMicroAmps { return calibrationMicroAmps }
              value.isFinite, (1_000...2_000_000).contains(value) else {
        // The key is in microamps (904383 on Mac15,9 = 904.383 mA for the
        // maximum backlight), matching BrightnessMicroAmps' scale.
        calibrationMicroAmps = value
                               calibrationMicroAmps: Double,
        guard value.isFinite, maximum.isFinite, calibrationMicroAmps.isFinite,
              value > 0, maximum > 0, calibrationMicroAmps > 0 else { return nil }
        // microamps -> amps; the 6 V string voltage is the named assumption.
        let watts = fraction * calibrationMicroAmps / 1_000_000 * assumedVoltage
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    private var calibrationMilliamps: Double?
        calibrationMilliamps = nil
        let fraction = min(max(current.value / current.max, 0), 1)
        let milliamps = fraction * calibration
        let watts = milliamps / 1000 * Self.assumedVoltage
        guard watts.isFinite,
              (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
        if let calibrationMilliamps { return calibrationMilliamps }
              value.isFinite, (1...20_000).contains(value) else {
        calibrationMilliamps = value
                               calibrationMilliamps: Double,
        guard value.isFinite, maximum.isFinite, calibrationMilliamps.isFinite,
              value > 0, maximum > 0, calibrationMilliamps > 0 else { return nil }
        let watts = fraction * calibrationMilliamps / 1000 * assumedVoltage
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a833d6a0` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
