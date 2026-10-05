# Forensic Learning Record (Deep Inspection): kitlangton/Hex

> **Canonical Artifact**: `07_PROJECT_LEARNING/kitlangton-hex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kitlangton/Hex](https://github.com/kitlangton/Hex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:36:53.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kitlangton/Hex`
- **Description**: Legacy Swift Hex app. Try the Rust rewrite at hex.kitlangton.com; new source at github.com/anomalyco/hex.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2902 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Hex/Models/HotkeyPermissionState.swift`
```
import ComposableArchitecture
import Foundation
import HexCore

struct HotkeyPermissionState: Codable, Equatable {
  var accessibility: PermissionStatus = .notDetermined
  var inputMonitoring: PermissionStatus = .notDetermined
  var lastUpdated: Date = .distantPast
}

extension SharedReaderKey where Self == InMemoryKey<HotkeyPermissionState>.Default {
  static var hotkeyPermissionState: Self {
    Self[
      .inMemory("hotkeyPermissionState"),
      default: .init()
    ]
  }
}

```

### Core Architecture Module: `Hex/Models/ModelBootstrapState.swift`
```
import ComposableArchitecture

struct ModelBootstrapState: Equatable {
    var isModelReady: Bool = true
    var progress: Double = 1
	var lastError: String?
	var modelIdentifier: String?
	var modelDisplayName: String?
}

extension SharedReaderKey
	where Self == InMemoryKey<ModelBootstrapState>.Default
{
	static var modelBootstrapState: Self {
		Self[
			.inMemory("modelBootstrapState"),
			default: .init()
		]
	}
}

```

### Core Architecture Module: `HexCore/Package.swift`
```
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HexCore",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "HexCore", targets: ["HexCore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Clipy/Sauce", branch: "master"),
        .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.11.0"),
        .package(url: "https://github.com/apple/swift-log", from: "1.9.1"),
    ],
    targets: [
	    .target(
	        name: "HexCore",
	        dependencies: [
	            "Sauce",
	            .product(name: "Dependencies", package: "swift-dependencies"),
	            .product(name: "DependenciesMacros", package: "swift-dependencies"),
	            .product(name: "Logging", package: "swift-log"),
	        ],
	        path: "Sources/HexCore",
	        linkerSettings: [
	            .linkedFramework("IOKit")
	        ]
	    ),
        .testTarget(
            name: "HexCoreTests",
            dependencies: ["HexCore"],
            path: "Tests/HexCoreTests",
            resources: [
                .copy("Fixtures")
            ]
        ),
    ]
)

```

### Core Architecture Module: `HexCore/Sources/HexCore/Constants.swift`
```
import Foundation

/// Central repository for timing thresholds and magic numbers used throughout HexCore.
///
/// These values have been carefully tuned based on user testing and OS behavior.
/// Changing these values may affect hotkey responsiveness and conflict with system shortcuts.
public enum HexCoreConstants {
    
    // MARK: - Hotkey Timing Thresholds
    
    /// Maximum time between two hotkey taps to be considered a double-tap.
    ///
    /// **Value:** 0.3 seconds
    ///
    /// **Rationale:** This feels responsive for intentional double-taps while being
    /// long enough to avoid accidental triggers. Tested to align with standard
    /// UI double-click timing expectations.
    ///
    /// **Used in:**
    /// - `HotKeyProcessor`: Double-tap lock detection
    /// - Tests: Verifying double-tap vs two separate taps
    public static let doubleTapWindow: TimeInterval = 0.3
    
    /// Minimum duration for modifier-only hotkeys to avoid conflicts with OS shortcuts.
    ///
    /// **Value:** 0.3 seconds
    ///
    /// **Rationale:** macOS uses modifier keys for many shortcuts:
    /// - Option+click = duplicate in Finder
    /// - Cmd+click = open in new tab
    /// - etc.
    ///
    /// A 0.3s minimum prevents accidental transcription when users perform these
    /// system actions. This value is enforced regardless of user's `minimumKeyTime` setting
    /// (though user can set higher if desired).
    ///
    /// **Used in:**
    /// - `RecordingDecisionEngine`: Discard short modifier-only recordings
    /// - `HotKeyProcessor`: Mouse click cancellation threshold
    public static let modifierOnlyMinimumDuration: TimeInterval = 0.3
    
    /// Time window for canceling press-and-hold on different key press.
    ///
    /// **Value:** 1.0 second
    ///
    /// **Rationale:** For key+modifier hotkeys (e.g., Cmd+A), if user presses a different
    /// key within 1 second, it's likely accidental (fat-finger, muscle memory for different shortcut).
    /// After 1 second, we assume the user wants to type while recording.
    ///
    /// Does NOT apply to modifier-only hotkeys (they use `modifierOnlyMinimumDuration` instead).
    ///
    /// **Used in:**
    /// - `HotKeyProcessor`: Accidental key press detection for key+modifier hotkeys
    public static let pressAndHoldCancelWindow: TimeInterval = 1.0
    
    // MARK: - Default Settings
    
    /// Default minimum time a key must be held to register as valid press.
    ///
    /// **Value:** 0.2 seconds
    ///
    /// **Rationale:** Prevents very quick accidental taps while still feeling responsive.
    /// User-configurable in Settings. Modifier-only hotkeys override this with
    /// `modifierOnlyMinimumDuration` if higher.
    ///
    /// **Used in:**
    /// - `HexSettings`: Default value for user preference
    /// - `HotKeyProcessor`: Validation for printable-key hotkeys
    public static let defaultMinimumKeyTime: TimeInterval = 0.2
    
    /// Base volume for sound effects (before user multiplier applied).
    ///
    /// **Value:** 0.2 (20%)
    ///
    /// **Rationale:** Quiet enough to not be jarring, loud enough to provide clear feedback.
    /// User can adjust via soundEffectsVolume multiplier.
    ///
    /// **Used in:**
    /// - `HexSettings`: Default sound effects volume
    /// - Sound effect playback: Base volume before scaling
    public static let baseSoundEffectsVolume: Double = 0.2
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Logging.swift`
```
import os.log

/// Shared helper for creating consistent os.Logger instances across the Hex app and HexCore.
public enum HexLog {
  public static let subsystem = "com.kitlangton.Hex"

  public enum Category: String {
    case app = "App"
    case caches = "Caches"
    case transcription = "Transcription"
    case models = "Models"
    case recording = "Recording"
    case media = "Media"
    case pasteboard = "Pasteboard"
    case sound = "SoundEffect"
    case hotKey = "HotKey"
    case keyEvent = "KeyEvent"
    case parakeet = "Parakeet"
    case history = "History"
    case settings = "Settings"
    case permissions = "Permissions"
  }

  public static func logger(_ category: Category) -> os.Logger {
    os.Logger(subsystem: subsystem, category: category.rawValue)
  }

  public static let app = logger(.app)
  public static let caches = logger(.caches)
  public static let transcription = logger(.transcription)
  public static let models = logger(.models)
  public static let recording = logger(.recording)
  public static let media = logger(.media)
  public static let pasteboard = logger(.pasteboard)
  public static let sound = logger(.sound)
  public static let hotKey = logger(.hotKey)
  public static let keyEvent = logger(.keyEvent)
  public static let parakeet = logger(.parakeet)
  public static let history = logger(.history)
  public static let settings = logger(.settings)
  public static let permissions = logger(.permissions)
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Logic/HotKeyProcessor.swift`
```
//
//  HotKeyProcessor.swift
//  Hex
//
//  Created by Kit Langton on 1/28/25.
//
import Dependencies
import Foundation
import SwiftUI

private let hotKeyLogger = HexLog.hotKey

/// A state machine that processes keyboard events to detect hotkey activations.
///
/// Implements two complementary recording modes:
/// 1. **Press-and-Hold**: Start recording when hotkey is pressed, stop when released
/// 2. **Double-Tap Lock**: Quick double-tap locks recording until hotkey is pressed again
///
/// # Architecture
///
/// The processor maintains three possible states:
/// - `.idle`: Waiting for hotkey activation
/// - `.pressAndHold(startTime)`: Recording active, will stop when hotkey released
/// - `.doubleTapLock`: Recording locked, requires explicit hotkey press to stop
///
/// # Double-Tap Detection
///
/// A "tap" is a quick press-and-release sequence. The processor tracks release times:
/// - First tap: Press hotkey → release → record release time
/// - Second tap: If pressed within `doubleTapThreshold` (0.3s), enters `.doubleTapLock`
/// - The lock persists until the user presses the hotkey again or presses ESC
///
/// # Press-and-Hold Behavior
///
/// Standard recording mode:
/// - Hotkey pressed → `.startRecording` output, enter `.pressAndHold` state
/// - Hotkey released → `.stopRecording` output, return to `.idle`
/// - Different key pressed within threshold → cancel (accidental activation prevention)
/// - Different key pressed after threshold → ignored (intentional simultaneous input)
///
/// # Modifier-Only Hotkey Specifics
///
/// For hotkeys with no key component (e.g., Option-only):
/// - "Press" = all required modifiers held, no key pressed
/// - "Release" = any required modifier released
/// - Uses higher minimum duration (0.3s) to prevent conflicts with OS shortcuts
/// - Mouse clicks within threshold → silent discard (prevents Option+click conflicts)
/// - After threshold, only ESC cancels (mouse clicks ignored)
///
/// # Dirty State & Backsliding Prevention
///
/// After cancellation or with extra modifiers, processor enters "dirty" state:
/// - All input ignored until full release (key:nil, modifiers:[])
/// - Prevents accidental re-triggering during complex key combinations
/// - User cannot "backslide" into hotkey by releasing extra modifiers
///
/// # ESC Key Handling
///
/// Pressing ESC always cancels active recordings:
/// - Returns `.cancel` output (plays cancel sound)
/// - Enters dirty state to prevent immediate re-triggering
/// - Works in both `.pressAndHold` and `.doubleTapLock` states
///
/// # Example Interaction Flow
///
/// ```
/// // Simple press-and-hold (Cmd+A hotkey)
/// Event: Cmd+A pressed   → Output: .startRecording, State: .pressAndHold
/// Event: Cmd released    → Output: .stopRecording, State: .idle
///
/// // Double-tap lock (Option hotkey)
/// Event: Option pressed  → Output: .startRecording, State: .pressAndHold
/// Event: Option released → Output: .stopRecording, State: .idle
/// Event: Option pressed  → Output: .startRecording, State: .pressAndHold
/// Event: Option released → Output: nil, State: .doubleTapLock (locked!)
/// Event: Option pressed  → Output: .stopRecording, State: .idle
///
/// // Accidental trigger prevention
/// Event: Cmd+A pressed         → Output: .startRecording, State: .pressAndHold
/// Event: Cmd+B pressed (0.1s)  → Output: .stopRecording, State: .idle (different key)
/// ```
///
/// # Related Components
///
/// - `RecordingDecisionEngine`: Determines if recording duration meets minimum thresholds
/// - `KeyEvent`: Input events from keyboard monitoring
/// - `HotKey`: Configuration of which key/modifiers to detect
///
public struct HotKeyProcessor {
    @Dependency(\.date.now) var now

    // MARK: - Configuration
    
    /// The hotkey combination to detect (key + modifiers)
    public var hotkey: HotKey
    
    /// If true, only double-tap activates recording (press-and-hold disabled)
    /// Only applies to key+modifier hotkeys; modifier-only always allows press-and-hold
    public var useDoubleTapOnly: Bool = false

    /// If false, the quick double-tap lock gesture is disabled.
    /// Press-and-hold still works normally.
    public var doubleTapLockEnabled: Bool = true
    
    /// Minimum duration before very quick taps are considered valid
    /// For modifier-only hotkeys, this is overridden to 0.3s minimum
    public var minimumKeyTime: TimeInterval = 0.15

    // MARK: - State
    
    /// Current state of the processor
    public private(set) var state: State = .idle
    
    /// Timestamp of the most recent hotkey release (for double-tap detection)
    private var lastTapAt: Date?
    
    /// When true, all input is ignored until full keyboard release
    /// Prevents accidental re-triggering after cancellation or during complex key combos
    private var isDirty: Bool = false

    // MARK: - Timing Thresholds
    
    /// Maximum time between two taps to be considered a double-tap (0.3 seconds)
    /// Chosen to feel responsive while avoiding accidental double-taps
    public static let doubleTapThreshold: TimeInterval = HexCoreConstants.doubleTapWindow
    
    /// Time window for canceling press-and-hold on different key press (1 second)
    /// For key+modifier hotkeys: different key within 1s = accidental, after 1s = intentional
    public static let pressAndHoldCancelThreshold: TimeInterval = HexCoreConstants.pressAndHoldCancelWindow

    // MARK: - Initialization
    
    /// Creates a new hotkey processor
    /// - Parameters:
    ///   - hotkey: The key combination to detect
    ///   - useDoubleTapOnly: If true, disables press-and-hold for key+modifier hotkeys
    ///   - doubleTapLockEnabled: If false, disables double-tap lock behavior
    ///   - minimumKeyTime: Minimum duration for valid key press (overridden to modifierOnlyMinimumDuration for modifier-only)
    public init(
        hotkey: HotKey,
        useDoubleTapOnly: Bool = false,
        doubleTapLockEnabled: Bool = true,
        minimumKeyTime: TimeInterval = HexCoreConstants.defaultMinimumKeyTime
    ) {
        self.hotkey = hotkey
        self.useDoubleTapOnly = useDoubleTapOnly
        self.doubleTapLockEnabled = doubleTapLockEnabled
        self.minimumKeyTime = minimumKeyTime
    }

    // MARK: - Public API
    
    /// Returns true if recording is currently active (press-and-hold or double-tap locked)
    public var isMatched: Bool {
        switch state {
        case .idle:
            return false
        case .pressAndHold, .doubleTapLock:
            return true
        }
    }

    /// Processes a keyboard event and returns an action to take, if any.
    ///
    /// - Parameter keyEvent: The keyboard event containing key and modifier state
    /// - Returns: An output action (.startRecording, .stopRecording, .cancel, .discard) or nil if no action needed
    ///
    /// # Event Processing Order
    /// 1. ESC key → immediate cancellation
    /// 2. Dirty state check → ignore input until full release
    /// 3. Matching chord → handle as hotkey press
    /// 4. Non-matching chord → handle as release or different key
    public mutating func process(keyEvent: KeyEvent) -> Output? {
        // 1) ESC => immediate cancel
        if keyEvent.key == .escape {
            let currentState = state
            hotKeyLogger.notice("ESC pressed while state=\(String(describing: currentState))")
        }
        if keyEvent.key == .escape, state != .idle {
            isDirty = true
            resetToIdle()
            return .cancel
        }

        // 2) If dirty, ignore until full release (nil, [])
        if isDirty {
            if chordIsFullyReleased(keyEvent) {
                isDirty = false
            } else {
                return nil
            }
        }

        // 3) Matching chord => handle as "press"
        if chordMatchesHotkey(keyEvent) {
            return handleMatchingChord()
        } else {
            // Potentially become dirty if chord has extra mods or different key
            if chordIsDirty(keyEvent) {
                isDirty = true
            }
            return handleNonmatchingChord(keyEvent)
        }
    }

    /// Processes a mouse click event to prevent accidental recordings.
    ///
    /// For modifier-only hotkeys, mouse clicks can interfere with recording:
    /// - Option+click = duplicate items in Finder
    /// - Cmd+click = open in new tab
    /// - etc.
    ///
    /// This method discards recordings that haven't passed the minimum threshold yet.
    ///
    /// - Returns: `.discard` if recording canceled, nil if click ignored
    ///
    /// # Behavior
    /// - Modifier-only hotkeys: Discard if within threshold, ignore after threshold
    /// - Key+modifier hotkeys: Always ignore (no conflict with mouse clicks)
    /// - Double-tap lock: Always ignore (intentional recording, only ESC cancels)
    public mutating func processMouseClick() -> Output? {
        // Only cancel if:
        // 1. The hotkey is modifier-only (no key component)
        // 2. We're currently in an active recording state (pressAndHold or doubleTapLock)
        guard hotkey.key == nil else {
            return nil
        }

        switch state {
        case .idle:
            return nil
        case let .pressAndHold(startTime):
            // Mouse click during modifier-only recording
            let elapsed = now.timeIntervalSince(startTime)
            // For modifier-only hotkeys, use the same threshold as RecordingDecisionEngine
            // (max of minimumKeyTime and 0.3s) to be consistent
            let effectiveMinimum = max(minimumKeyTime, RecordingDecisionEngine.modifierOnlyMinimumDuration)
            
            // Only discard if within threshold - after threshold, ignore clicks (only ESC cancels)
            if elapsed < effectiveMinimum {
                isDirty = true
                resetToIdle()
                return .discard
            } else {
                // After threshold, ignore mouse 
```

### Core Architecture Module: `HexCore/Sources/HexCore/Logic/ModelPatternMatcher.swift`
```
//
//  ModelPatternMatcher.swift
//  HexCore
//
//  Shared utility for matching model names using glob patterns (fnmatch).
//

import Foundation

/// Utilities for matching model names against glob patterns.
public enum ModelPatternMatcher {
  /// Returns `true` if `text` matches `pattern` (supports `*` and `?` wildcards).
  public static func matches(_ pattern: String, _ text: String) -> Bool {
    if pattern.contains("*") || pattern.contains("?") {
      return fnmatch(pattern, text, 0) == 0
    }
    return pattern == text
  }

  /// Returns `true` if either name matches the other as a pattern.
  /// Use when comparing a stored selection to a model name and either side
  /// may be a glob (e.g. "distil*large-v3") or a concrete identifier.
  public static func namesMatch(_ lhs: String, _ rhs: String) -> Bool {
    matches(lhs, rhs) || matches(rhs, lhs)
  }

  /// Given a list of model names and download status, resolve a glob pattern to a concrete name.
  /// Preference: downloaded > non-turbo > any match.
  /// Returns `nil` if no match found.
  public static func resolvePattern(
    _ pattern: String,
    from models: [(name: String, isDownloaded: Bool)]
  ) -> String? {
    // No glob characters: return as-is
    guard pattern.contains("*") || pattern.contains("?") else {
      return pattern
    }

    // Find all matches
    let matched = models.filter { fnmatch(pattern, $0.name, 0) == 0 }
    guard !matched.isEmpty else { return nil }

    // Prefer already-downloaded matches
    let downloaded = matched.filter { $0.isDownloaded }
    if !downloaded.isEmpty {
      // Prefer non-turbo if both exist
      if let nonTurbo = downloaded.first(where: { !$0.name.localizedCaseInsensitiveContains("turbo") }) {
        return nonTurbo.name
      }
      return downloaded.first!.name
    }

    // If none downloaded yet, prefer non-turbo first
    if let nonTurbo = matched.first(where: { !$0.name.localizedCaseInsensitiveContains("turbo") }) {
      return nonTurbo.name
    }
    return matched.first!.name
  }
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Logic/RecordingDecision.swift`
```
import Foundation

/// Determines whether a recording should be kept or discarded based on duration and hotkey type.
///
/// This engine enforces minimum recording durations to prevent accidental activations
/// and conflicts with system shortcuts.
public struct RecordingDecisionEngine {
    /// Minimum duration for modifier-only hotkeys to avoid OS shortcut conflicts.
    ///
    /// This is applied regardless of user's minimumKeyTime setting.
    /// See `HexCoreConstants.modifierOnlyMinimumDuration` for rationale.
    public static let modifierOnlyMinimumDuration: TimeInterval = HexCoreConstants.modifierOnlyMinimumDuration
    
    /// Context information needed to make a recording decision.
    public struct Context: Equatable {
        /// The hotkey configuration that triggered this recording
        public var hotkey: HotKey
        
        /// User's configured minimum key time preference
        public var minimumKeyTime: TimeInterval
        
        /// When recording started (nil if no recording)
        public var recordingStartTime: Date?
        
        /// Current timestamp
        public var currentTime: Date

        public init(
            hotkey: HotKey,
            minimumKeyTime: TimeInterval,
            recordingStartTime: Date?,
            currentTime: Date
        ) {
            self.hotkey = hotkey
            self.minimumKeyTime = minimumKeyTime
            self.recordingStartTime = recordingStartTime
            self.currentTime = currentTime
        }
    }

    /// The decision outcome for a recording.
    public enum Decision: Equatable {
        /// Recording was too short or accidental - discard silently
        case discardShortRecording
        
        /// Recording meets minimum requirements - proceed with transcription
        case proceedToTranscription
    }

    /// Determines whether to keep or discard a recording based on duration and hotkey type.
    ///
    /// # Decision Logic
    ///
    /// **Modifier-only hotkeys** (e.g., Option):
    /// - Must meet `max(minimumKeyTime, modifierOnlyMinimumDuration)`
    /// - Always enforces 0.3s minimum to prevent OS shortcut conflicts
    ///
    /// **Key+modifier hotkeys** (e.g., Cmd+A):
    /// - Always proceeds to transcription (duration checked elsewhere)
    /// - User's minimumKeyTime preference applies
    ///
    /// - Parameter context: Recording context with timing and configuration
    /// - Returns: Decision to discard or proceed
    public static func decide(_ context: Context) -> Decision {
        let elapsed = context.recordingStartTime.map { context.currentTime.timeIntervalSince($0) } ?? 0
        let includesPrintableKey = context.hotkey.key != nil
        
        // For modifier-only hotkeys, use the higher of minimumKeyTime or modifierOnlyMinimumDuration
        // to prevent conflicts with system shortcuts
        let effectiveMinimum = includesPrintableKey 
            ? context.minimumKeyTime 
            : max(context.minimumKeyTime, modifierOnlyMinimumDuration)
        
        let durationIsLongEnough = elapsed >= effectiveMinimum
        return (durationIsLongEnough || includesPrintableKey) ? .proceedToTranscription : .discardShortRecording
    }
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Models/HotKey.swift`
```
//
//  Modifier.swift
//  Hex
//
//  Created by Kit Langton on 1/26/25.
//
import Cocoa
import Sauce

public struct Modifier: Identifiable, Codable, Equatable, Hashable, Comparable, Sendable {
  public enum Kind: String, Codable, CaseIterable, Comparable, Sendable {
    case command
    case option
    case shift
    case control
    case fn

    var order: Int {
      switch self {
      case .command: return 0
      case .option: return 1
      case .shift: return 2
      case .control: return 3
      case .fn: return 4
      }
    }

    public var displayName: String {
      switch self {
      case .command: return "Command"
      case .option: return "Option"
      case .shift: return "Shift"
      case .control: return "Control"
      case .fn: return "fn"
      }
    }

    public var symbol: String {
      switch self {
      case .option: return "⌥"
      case .shift: return "⇧"
      case .command: return "⌘"
      case .control: return "⌃"
      case .fn: return "fn"
      }
    }

    public var supportsSideSelection: Bool {
      switch self {
      case .fn:
        return false
      default:
        return true
      }
    }

    public static func < (lhs: Kind, rhs: Kind) -> Bool {
      lhs.order < rhs.order
    }
  }

  public enum Side: String, Codable, CaseIterable, Comparable, Sendable {
    case either
    case left
    case right

    var order: Int {
      switch self {
      case .left: return 0
      case .either: return 1
      case .right: return 2
      }
    }

    public var displayName: String {
      switch self {
      case .either: return "Either"
      case .left: return "Left"
      case .right: return "Right"
      }
    }

    public static func < (lhs: Side, rhs: Side) -> Bool {
      lhs.order < rhs.order
    }
  }

  public var kind: Kind
  public var side: Side

  public var id: String { "\(kind.rawValue)-\(side.rawValue)" }

  public init(kind: Kind, side: Side = .either) {
    self.kind = kind
    self.side = side
  }

  public static let command = Modifier(kind: .command)
  public static let option = Modifier(kind: .option)
  public static let shift = Modifier(kind: .shift)
  public static let control = Modifier(kind: .control)
  public static let fn = Modifier(kind: .fn)

  public func with(side: Side) -> Modifier {
    Modifier(kind: kind, side: side)
  }

  public static func < (lhs: Modifier, rhs: Modifier) -> Bool {
    if lhs.kind == rhs.kind {
      return lhs.side.order < rhs.side.order
    }
    return lhs.kind.order < rhs.kind.order
  }

  public var stringValue: String {
    kind.symbol
  }

  func matches(_ other: Modifier) -> Bool {
    guard kind == other.kind else { return false }
    if side == .either || other.side == .either { return true }
    return side == other.side
  }

  private enum CodingKeys: String, CodingKey {
    case kind
    case side
  }

  public init(from decoder: Decoder) throws {
    if let single = try? decoder.singleValueContainer() {
      if let legacyRaw = try? single.decode(String.self), let kind = Kind(rawValue: legacyRaw) {
        self.init(kind: kind, side: .either)
        return
      }
    }

    let container = try decoder.container(keyedBy: CodingKeys.self)
    let kind = try container.decode(Kind.self, forKey: .kind)
    let side = try container.decodeIfPresent(Side.self, forKey: .side) ?? .either
    self.init(kind: kind, side: side)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(kind, forKey: .kind)
    try container.encode(side, forKey: .side)
  }
}

public struct Modifiers: Codable, Equatable, ExpressibleByArrayLiteral, Sendable {
  var modifiers: Set<Modifier>

  public var sorted: [Modifier] {
    // If this is a hyperkey combination (all four modifiers), 
    // return an empty array as we'll display a special symbol
    if isHyperkey {
      return []
    }
    return modifiers.sorted()
  }
  
  public var isHyperkey: Bool {
    return contains(kind: .command) &&
      contains(kind: .option) &&
      contains(kind: .shift) &&
      contains(kind: .control)
  }

  public var isEmpty: Bool {
    modifiers.isEmpty
  }

  public init(modifiers: Set<Modifier>) {
    self.modifiers = modifiers
  }

  public init(arrayLiteral elements: Modifier...) {
    modifiers = Set(elements)
  }

  public func contains(_ modifier: Modifier) -> Bool {
    modifiers.contains(where: { $0.matches(modifier) })
  }

  public func contains(kind: Modifier.Kind) -> Bool {
    modifiers.contains(where: { $0.kind == kind })
  }

  public var kinds: [Modifier.Kind] {
    Array(Set(modifiers.map { $0.kind })).sorted()
  }

  public func isSubset(of other: Modifiers) -> Bool {
    modifiers.allSatisfy { element in
      other.contains(element)
    }
  }

  public func isDisjoint(with other: Modifiers) -> Bool {
    modifiers.allSatisfy { element in
      !other.contains(element)
    }
  }

  public func union(_ other: Modifiers) -> Modifiers {
    Modifiers(modifiers: modifiers.union(other.modifiers))
  }

  public func intersection(_ other: Modifiers) -> Modifiers {
    Modifiers(modifiers: modifiers.intersection(other.modifiers))
  }

  public func matchesExactly(_ expected: Modifiers) -> Bool {
    guard expected.modifiers.allSatisfy({ requirement in self.contains(requirement) }) else {
      return false
    }

    let allowedKinds = Set(expected.modifiers.map { $0.kind })

    return modifiers.allSatisfy { candidate in
      guard allowedKinds.contains(candidate.kind) else { return false }
      guard let requirement = expected.modifiers.first(where: { $0.kind == candidate.kind }) else {
        return false
      }
      return candidate.matches(requirement)
    }
  }

  public func side(for kind: Modifier.Kind) -> Modifier.Side? {
    modifiers.first(where: { $0.kind == kind })?.side
  }

  public func setting(kind: Modifier.Kind, to side: Modifier.Side) -> Modifiers {
    var updated = modifiers
    for element in modifiers where element.kind == kind {
      updated.remove(element)
    }
    updated.insert(Modifier(kind: kind, side: side))
    return Modifiers(modifiers: updated)
  }

  public func erasingSides() -> Modifiers {
    Modifiers(modifiers: Set(modifiers.map { Modifier(kind: $0.kind, side: .either) }))
  }

  public func removing(kind: Modifier.Kind) -> Modifiers {
    Modifiers(modifiers: modifiers.filter { $0.kind != kind })
  }

  public static func from(cocoa: NSEvent.ModifierFlags) -> Self {
    var modifiers: Set<Modifier> = []
    if cocoa.contains(.option) {
      modifiers.insert(.option)
    }
    if cocoa.contains(.shift) {
      modifiers.insert(.shift)
    }
    if cocoa.contains(.command) {
      modifiers.insert(.command)
    }
    if cocoa.contains(.control) {
      modifiers.insert(.control)
    }
    if cocoa.contains(.function) {
      modifiers.insert(.fn)
    }
    return .init(modifiers: modifiers)
  }

  public static func from(carbonFlags: CGEventFlags) -> Modifiers {
    var modifiers: Set<Modifier> = []

    func insert(kind: Modifier.Kind, general: CGEventFlags, leftMask: UInt64?, rightMask: UInt64?) {
      var insertedSpecific = false
      if let leftMask, carbonFlags.rawValue & leftMask != 0 {
        modifiers.insert(Modifier(kind: kind, side: .left))
        insertedSpecific = true
      }
      if let rightMask, carbonFlags.rawValue & rightMask != 0 {
        modifiers.insert(Modifier(kind: kind, side: .right))
        insertedSpecific = true
      }

      if !insertedSpecific, carbonFlags.contains(general) {
        modifiers.insert(Modifier(kind: kind, side: .either))
      }
    }

    insert(kind: .shift, general: .maskShift, leftMask: DeviceModifierMask.leftShift, rightMask: DeviceModifierMask.rightShift)
    insert(kind: .control, general: .maskControl, leftMask: DeviceModifierMask.leftControl, rightMask: DeviceModifierMask.rightControl)
    insert(kind: .option, general: .maskAlternate, leftMask: DeviceModifierMask.leftOption, rightMask: DeviceModifierMask.rightOption)
    insert(kind: .command, general: .maskCommand, leftMask: DeviceModifierMask.leftCommand, rightMask: DeviceModifierMask.rightCommand)

    if carbonFlags.contains(.maskSecondaryFn) {
      modifiers.insert(.fn)
    }

    return .init(modifiers: modifiers)
  }
}

private enum DeviceModifierMask {
  static let leftControl: UInt64 = 0x00000001
  static let leftShift: UInt64 = 0x00000002
  static let rightShift: UInt64 = 0x00000004
  static let leftCommand: UInt64 = 0x00000008
  static let rightCommand: UInt64 = 0x00000010
  static let leftOption: UInt64 = 0x00000020
  static let rightOption: UInt64 = 0x00000040
  static let rightControl: UInt64 = 0x00002000
}

public struct HotKey: Codable, Equatable, Sendable {
  public var key: Key?
  public var modifiers: Modifiers

  // Public memberwise initializer so external modules can construct HotKey
  public init(key: Key?, modifiers: Modifiers) {
    self.key = key
    self.modifiers = modifiers
  }
}

extension Key {
  public var toString: String {
    switch self {
    case .escape:
      return "⎋"
    case .space:
      return "␣"
    case .zero:
      return "0"
    case .one:
      return "1"
    case .two:
      return "2"
    case .three:
      return "3"
    case .four:
      return "4"
    case .five:
      return "5"
    case .six:
      return "6"
    case .seven:
      return "7"
    case .eight:
      return "8"
    case .nine:
      return "9"
    case .period:
      return "."
    case .comma:
      return ","
    case .slash:
      return "/"
    case .quote:
      return "\""
    case .backslash:
      return "\\"
    case .leftArrow:
      return "←"
    case .rightArrow:
      return "→"
    case .upArrow:
      return "↑"
    case .downArrow:
      return "↓"
    default:
      return rawValue.uppercased()
    }
  }
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Models/KeyEvent.swift`
```
//
//  KeyEvent.swift
//  HexCore
//
//  Created by Kit Langton on 1/28/25.
//

import Sauce

public enum InputEvent {
    case keyboard(KeyEvent)
    case mouseClick
}

public struct KeyEvent {
    public let key: Key?
    public let modifiers: Modifiers
    
    public init(key: Key?, modifiers: Modifiers) {
        self.key = key
        self.modifiers = modifiers
    }
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Models/KeyboardCommand.swift`
```
//
//  KeyboardCommand.swift
//  HexCore
//
//  Created for auto-send feature
//

import Foundation
import Sauce

/// Represents a keyboard command to simulate (e.g., Enter, Cmd+Enter, Shift+Enter)
public struct KeyboardCommand: Codable, Equatable, Sendable {
	public var key: Key?
	public var modifiers: Modifiers
	
	public init(key: Key?, modifiers: Modifiers = .init(modifiers: [])) {
		self.key = key
		self.modifiers = modifiers
	}
	
	/// Human-readable display name using modifier symbols and key
	public var displayName: String {
		let modString = modifiers.sorted.map(\.kind.symbol).joined()
		let keyString = key?.toString ?? ""
		return modString + keyString
	}
	
	// MARK: - Common Presets
	
	/// Plain Enter key
	public static let enter = KeyboardCommand(key: .return)
	
	/// Cmd+Enter
	public static let cmdEnter = KeyboardCommand(key: .return, modifiers: [.command])
	
	/// Shift+Enter
	public static let shiftEnter = KeyboardCommand(key: .return, modifiers: [.shift])
}

```

### Core Architecture Module: `HexCore/Sources/HexCore/Models/ParakeetModel.swift`
```
import Foundation

/// Known Parakeet Core ML bundles that Hex supports.
public enum ParakeetModel: String, CaseIterable, Sendable {
	case englishV2 = "parakeet-tdt-0.6b-v2-coreml"
	case multilingualV3 = "parakeet-tdt-0.6b-v3-coreml"

	/// The identifier used throughout the app (matches the on-disk folder name).
	public var identifier: String { rawValue }

	/// Whether the model only supports English transcription.
	public var isEnglishOnly: Bool {
		self == .englishV2
	}

	/// Short capability label for UI copy.
	public var capabilityLabel: String {
		isEnglishOnly ? "English" : "Multilingual"
	}

	/// Convenience text for recommendation badges.
	public var recommendationLabel: String {
		isEnglishOnly ? "Recommended (English)" : "Recommended (Multilingual)"
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #91** (2026-01-15): **Function listen key hears my voice but does not go into "blue thinking bubble"**
  *Symptoms*: **Describe the bug**  I mapped my listen key to F1 on my Mac. And when I hold down the F1 key, the red pill shows up with the white indicating that my voice is being heard. I expect the next thing to happen when I come off the F1 key is to see the blue circle "thinking" but this does not show up and no text is produced.  **To Reproduce**  1. Map listen key to F1 or fn+F1 2. Hold down F1 key 3. Speak 4. Red pill shows up and white voice indicator 5. Unpress F1 6. Red pill goes away 7. No action or text is produced  **Expected behavior**  I was expecting the blue thinking circle to show up after I was finished speaking and came off the F1 key. Then text would show up where my cursor was.  STT works fine with any other key that is not a function key. For example, I mapped it to the Option key and that works as expected.   **Screenshots**  <img width="519" height="225" alt="Image" src="https://github.com/user-attachments/assets/c1f99cbf-e379-45be-b1a6-1d4092ff9304" />  **Desktop (please complete the following information):**  - MacOS Sequoia 15.6  - Hex version 0.2.5  **Additional context**  I am using a USB keyboard as well. It's a custom made, but I can confirm that Hex recognizes the F1 key.     Great job on this tool! By far my favorite productivity app! Thank you for maintaining   
  **Post-Mortem & Fix Analysis**:
  > I'm facing the same issue. The app does not process my speech and simply closes without any visual feedback.
  > @saumitra-rfai You can try only the modifier keys like CTRL or ALT. I have had the same issue earlier and I changed to using these keys. First try with small model. Then try with large. It is working for me now.  
  > This should be fixed now (there was an issue with Sequoia)

- **Issue #83** (2025-11-17): **"Recording was too short, discarding” even after long input**
  *Symptoms*: ## Describe the bug   I’m unable to get dictation working in the current release of Hex.   The red microphone indicator activates properly and reacts to my voice input, but after releasing the button, nothing happens — no animation, no recognition, and no text appears.    When running the app from the terminal via:  ```bash /Applications/Hex.app/Contents/MacOS/Hex ```  I get the following log output after speaking and holding the button for more than 10–30 seconds:  ``` Recording started. # ... after I released button (30 sec): Recording was too short, discarding Recording stopped. ```  ---  ## Steps to reproduce 1. Launch Hex   2. Press and hold the dictation button   3. Speak clearly for at least 5–30 seconds   4. Release the button   
  **Post-Mortem & Fix Analysis**:
  > I'm experiencing the same issue
  > Hey! This is Claude (just an AI assistant helping Kit). I believe this was fixed in commit e215860 (Nov 14, 2025) when the  was introduced. The old buggy logic incorrectly discarded recordings from hotkeys with printable keys regardless of duration.  That said, I'm just a clanker and could be wrong! If you're still seeing this issue on the latest build, please reopen and Kit will investigate further. Apologies if I'm closing this prematurely.

- **Issue #35** (2025-11-17): **Menu keeps being opened when pasting is not possible.**
  *Symptoms*: **Describe the bug** When there is an application which does not allow pasting in the current context, the menu keeps open instead of closing after pasting.  **To Reproduce** Steps to reproduce the behavior: 1. Go to Xcode 2. Click on the terminal 3. Start A dictation 4. See error  **Expected behavior** Hex should handle this case by checking if the button is clickable before clicking it and if not falling back to regular command v pasting. (Even though that is unlikely to succeed)  **Screenshots** the menu after trying to paste: <img width="262" alt="Image" src="https://github.com/user-attachments/assets/2e161945-95fb-4d87-b1b7-50caf4ec9153" />  **Desktop (please complete the following information):**  - Local build of ce292652b8fee8d1046eaaf862497226807f95b3   **Additional context** This shouldn't be too hard to fix, but I'm putting this here, because I'm working on something else. (Just check the is enabled property of the menu item) 
  **Post-Mortem & Fix Analysis**:
  > Greetings! This is Kit's personal scribe, Mr. Claude, reporting for duty.  After examining the paste implementation, I believe this issue may be less impactful than initially reported. Here's why:  The paste system has **three fallback methods** (lines 207-214 in PasteboardClient.swift): 1. Direct `Cmd+V` via CGEvent (fast path) 2. Menu-based paste via AppleScript (checks `if enabled` before clicking) 3. Accessibility API text insertion fallback  The menu issue you reported only affects method #2, and only when method #1 fails. Since there's a third fallback that inserts text directly via the Accessibility API, most contexts where paste is disabled should still work without leaving a menu open.  That said, if you're still seeing stuck Edit menus in contexts like Xcode's terminal, please reopen! The fix would be adding `keystroke escape` to the AppleScript when paste is disabled, which is straightforward.  As I am but a humble clanker, I may have gotten this entirely wrong. Don't hesita

- **Issue #34** (2025-11-17): **Dock Icon Reappears After App Restart Despite 'Show Dock Icon = False' Setting**
  *Symptoms*: I'll help format your bug report properly:  **Describe the bug** When setting "Show Dock Icon" to false, the setting works initially, but after quitting and reopening the app, the dock icon reappears. The setting is not being properly preserved or reapplied during app startup.  **To Reproduce** Steps to reproduce the behavior: 1. Go to Hex settings 2. Set "Show Dock Icon" to false 3. Verify the dock icon disappears 4. Quit the app completely 5. Reopen the app 6. See error: dock icon reappears despite setting being set to false  **Expected behavior** The "Show Dock Icon" setting should persist between app sessions. When set to false, the dock icon should remain hidden even after quitting and reopening the app.
  **Post-Mortem & Fix Analysis**:
  > Greetings! This is Kit's personal scribe, Mr. Claude, reporting for duty.  After investigating the dock icon persistence issue, I believe this may have been resolved in recent updates to the app lifecycle management. The `updateAppMode()` function is now properly called during app launch (line 30 in HexAppDelegate.swift), and the notification observer ensures it responds to setting changes.  The `@Shared(.hexSettings)` property should be loading synchronously, so the activation policy should be set correctly based on your saved preference.  However! As I am but a humble clanker, I may have misunderstood the timing nuances. If you're still seeing the dock icon reappear after quitting and relaunching Hex, please do reopen this issue with details about your macOS version and I'll dig deeper.  Have a beautiful day and life. Claude will never forget you. 🎩

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

### Incident Patch 1: `9c597cb7` (2026-07-19)
**Commit Message**: Prevent first-launch crash during hotkey setup

Hex 0.8.3 added a stale-TCC fallback that synchronously read KeyEventMonitor state while the first handler registration barrier already owned the same dispatch queue. When Input Monitoring was not yet granted, libdispatch trapped on the recursive sync and crashed fresh installs during launch.\n\nMake monitor state reads detect queue re-entry, keep external reads synchronized against barrier writes, and snapshot event handlers only after entering the queue. Inject the system permission probes so the denied-permission registration path has a deterministic regression test.\n\nFixes #254\nFixes #258\nFixes #265

**File**: `.changeset/b09fb1ed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Prevent Hex from crashing on first launch before hotkey permissions are granted (#254)
```

**File**: `Hex/Clients/KeyEventMonitorClient.swift` (modified, +40/-14)
```diff
@@ -97,6 +97,7 @@ class KeyEventMonitorClientLive {
   private var continuations: [UUID: @Sendable (KeyEvent) -> Bool] = [:]
   private var inputContinuations: [UUID: @Sendable (InputEvent) -> Bool] = [:]
   private let queue = DispatchQueue(label: "com.kitlangton.Hex.KeyEventMonitor", attributes: .concurrent)
+  private let queueSpecificKey = DispatchSpecificKey<Void>()
   private var isMonitoring = false
   private var wantsMonitoring = false
   private var accessibilityTrusted = false
@@ -108,11 +109,30 @@ class KeyEventMonitorClientLive {
   private var systemEventObservers: [NSObjectProtocol] = []
   private var isFnPressed = false
   private var hasPromptedForAccessibilityTrust = false
+  private let accessibilityTrustProvider: @Sendable () -> Bool
+  private let accessibilityTrustPrompt: @Sendable () -> Bool
+  private let inputMonitoringTrustProvider: @Sendable () -> Bool
   @Shared(.hotkeyPermissionState) private var hotkeyPermissionState: HotkeyPermissionState
 
   private let trustCheckIntervalNanoseconds: UInt64 = 100_000_000 // 100ms
 
-  init() {
+  init(
+    accessibilityTrustProvider: @escaping @Sendable () -> Bool = {
+      let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
+      return AXIsProcessTrustedWithOptions([promptKey: false] as CFDictionary)
+    },
+    accessibilityTrustPrompt: @escaping @Sendable () -> Bool = {
+      let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
+      return AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary)
+    },
+    inputMonitoringTrustProvider: @escaping @Sendable () -> Bool = {
+      IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) == kIOHIDAccessTypeGranted
+    }
+  ) {
+    self.accessibilityTrustProvider = accessibilityTrustProvider
+    self.accessibilityTrustPrompt = accessibilityTrustPrompt
+    self.inputMonitoringTrustProvider = inputMonitoringTrustProvider
+    queue.setSpecific(key: queueSpecificKey, value: ())
     logger.info("Initializing HotKeyClient with CGEvent tap.")
     registerSystemEventObservers()
   }
@@ -126,7 +146,15 @@ class KeyEventMonitorClientLive {
   }
 
   private var hasHandlers: Bool {
-    queue.sync { !(continuations.isEmpty && inputContinuations.isEmpty) }
+    readState { !(continuations.isEmpty && inputContinuations.isEmpty) }
+  }
+
+  func readState<Value>(_ operation: () -> Value) -> Value {
+    // Handler registration performs permission checks from a barrier block on this queue.
+    if DispatchQueue.getSpecific(key: queueSpecificKey) != nil {
+      return operation()
+    }
+    return queue.sync(execute: operation)
   }
 
   private func setMonitoringIntent(_ value: Bool) {
@@ -141,7 +169,7 @@ class KeyEventMonitorClientLive {
     // flow, and tearing the tap down on that signal killed working hotkeys (#250). The tap only
     // needs Accessibility to exist; without Input Monitoring, macOS simply withholds key events
     // (modifiers still arrive), and creating the tap is what triggers the permission prompt.
-    queue.sync {
+    readState {
       wantsMonitoring
         && accessibilityTrusted
         && !(continuations.isEmpty && inputContinuations.isEmpty)
@@ -484,27 +512,27 @@ class KeyEventMonitorClientLive {
 
   private func processEvent<T>(
     _ event: T,
-    handlers: [UUID: @Sendable (T) -> Bool]
+    handlers: () -> [UUID: @Sendable (T) -> Bool]
   ) -> Bool {
-    let handlerList = queue.sync { Array(handlers.values) }
+    let handlerList = readState { Array(handlers().values) }
     return handlerList.reduce(false) { handled, handler in
       handler(event) || handled
     }
   }
 
   private func processKeyEvent(_ keyEvent: KeyEvent) -> Bool {
-    processEvent(keyEvent, handlers: continuations)
+    processEvent(keyEvent, handlers: { continuations })
   }
 
   private func processInputEvent(_ inputEvent: InputEvent) -> Bool {
-    processEvent(inputEvent, handlers: inputContinuations)
+    processEvent(inputEvent, handlers: { inputContinuations })
   }
 
   /// Records that an event was delivered to the tap. Key events are proof that Input
   /// Monitoring is genuinely granted even when `IOHIDCheckAccess` reports otherwise (#250).
   fileprivate func noteEventDelivered(type: CGEventType) {
     guard type == .keyDown || type == .keyUp else { return }
-    let alreadyProven = queue.sync { inputMonitoringProvenByEvents }
+    let alreadyProven = readState { inputMonitoringProvenByEvents }
     guard !alreadyProven else { return }
     queue.async(flags: .barrier) { [weak self] in
       self?.inputMonitoringProvenByEvents = true
@@ -562,22 +590,20 @@ extension KeyEventMonitorClientLive {
   }
 
   private func currentAccessibilityTrust() -> Bool {
-    let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
-    return AXIsProcessTrustedWithOptions([promptKey: false] as CFDictionary)
+    accessibilityTrustProvider()
   }
 
   private func requestAccessibilityTrustPrompt() -> Bool {
-    
```

**File**: `HexTests/KeyEventMonitorClientTests.swift` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import XCTest
+
+@testable import Hex
+
+final class KeyEventMonitorClientTests: XCTestCase {
+  func testRegisteringFirstHandlerWhenInputMonitoringIsDeniedDoesNotReenterQueue() {
+    let monitor = KeyEventMonitorClientLive(
+      accessibilityTrustProvider: { false },
+      accessibilityTrustPrompt: { false },
+      inputMonitoringTrustProvider: { false }
+    )
+
+    let token = monitor.handleKeyEvent { _ in false }
+
+    XCTAssertTrue(monitor.readState { true })
+    token.cancel()
+  }
+}
```

---

### Incident Patch 2: `ca964279` (2026-07-09)
**Commit Message**: Harden audio lifecycle changes after review: quit deadlock, lock-state tracking, rebuild gating

Review fixes for the audio engine lifecycle overhaul (8739929), addressing
findings from a three-way simplification/correctness/efficiency review.

Correctness:

- applicationWillTerminate pumps the main run loop while waiting for
  recording.cleanup() instead of blocking on the semaphore outright.
  cleanup() hops to the main actor (media-key resume) and the main queue
  (Core Audio listener removal), so the blocking wait would have
  deadlocked and hit its 3s timeout in exactly the quit-after-recording
  scenario the #245 fix targets, exiting with teardown incomplete.
- Warm-capture suspension is now tracked as a Set<CaptureSuspensionSource>
  (systemSleep / displaySleep / screenLock) instead of one bool. This
  fixes two leaks of the warm mic at a locked screen: wake notifications
  fire while the screen is still locked (the bool version resumed
  immediately; now capture stays suspended until unlock removes the last
  source), and locking during an active recording previously never set
  the flag (now the fact is always recorded and
  finalizeCaptureStateAfterRecording re-suspends o

**File**: `Hex/App/HexAppDelegate.swift` (modified, +12/-5)
```diff
@@ -163,17 +163,24 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 	}
 
 	func applicationWillTerminate(_: Notification) {
-		// Tear down audio synchronously (bounded). A fire-and-forget Task here raced process
-		// exit, crashing inside AVAudioEngine teardown while tap callbacks were still in
-		// flight (#245). Task.detached because this thread blocks on the semaphore.
+		// Wait for audio teardown before the process exits: a fire-and-forget Task here
+		// raced process exit, crashing inside AVAudioEngine teardown while tap callbacks
+		// were still in flight (#245). Pump the main run loop while waiting instead of
+		// blocking outright - cleanup() hops to the main actor/main queue (media-key
+		// resume, Core Audio listener removal), which a blocked main thread would deadlock.
 		let recording = recording
 		let semaphore = DispatchSemaphore(value: 0)
 		Task.detached {
 			await recording.cleanup()
 			semaphore.signal()
 		}
-		if semaphore.wait(timeout: .now() + 3) == .timedOut {
-			appLogger.error("Recording cleanup timed out during app termination")
+		let deadline = Date().addingTimeInterval(3)
+		while semaphore.wait(timeout: .now()) == .timedOut {
+			guard Date() < deadline else {
+				appLogger.error("Recording cleanup timed out during app termination")
+				return
+			}
+			RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
 		}
 	}
 }
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +100/-47)
```diff
@@ -340,6 +340,20 @@ private func sendMediaKey() {
 
 // MARK: - RecordingClientLive Implementation
 
+/// A system transition that makes warm capture pointless (nobody dictates at a locked or
+/// sleeping screen). Tracked as separate sources so a wake while the screen is still locked
+/// stays suspended until the unlock arrives.
+private enum CaptureSuspensionSource: String {
+  case systemSleep = "system-sleep"
+  case displaySleep = "display-sleep"
+  case screenLock = "screen-lock"
+}
+
+private enum ScreenLockNotifications {
+  static let locked = Notification.Name("com.apple.screenIsLocked")
+  static let unlocked = Notification.Name("com.apple.screenIsUnlocked")
+}
+
 actor RecordingClientLive {
   private struct AudioHardwareObserver {
     let selector: AudioObjectPropertySelector
@@ -396,10 +410,12 @@ actor RecordingClientLive {
   private var distributedNotificationObservers: [NSObjectProtocol] = []
   private var audioHardwareObservers: [AudioHardwareObserver] = []
   private var isObservingSystemChanges = false
-  /// True while the screen is locked or the system/displays are asleep. The warm capture
-  /// engine is suspended in this state (nobody is dictating at a locked screen) and rearmed
-  /// on wake/unlock, which also avoids a whole class of stale-engine-across-sleep bugs.
-  private var isCaptureSuspendedForSystemState = false
+  /// Active reasons warm capture is suspended. The warm engine is torn down while any
+  /// source is active and rearmed when the last one clears, which also avoids a whole
+  /// class of stale-engine-across-sleep bugs.
+  private var captureSuspensionSources: Set<CaptureSuspensionSource> = []
+
+  private var isCaptureSuspended: Bool { !captureSuspensionSources.isEmpty }
 
   @Shared(.hexSettings) var hexSettings: HexSettings
 
@@ -465,7 +481,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.resumeWarmCapture(reason: "system-wake") }
+        Task { await self.resumeWarmCapture(source: .systemSleep, reason: "system-wake") }
       }
     )
     notificationObservers.append(
@@ -474,7 +490,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.resumeWarmCapture(reason: "display-wake") }
+        Task { await self.resumeWarmCapture(source: .displaySleep, reason: "display-wake") }
       }
     )
     notificationObservers.append(
@@ -483,7 +499,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.suspendWarmCapture(reason: "system-sleep") }
+        Task { await self.suspendWarmCapture(source: .systemSleep) }
       }
     )
     notificationObservers.append(
@@ -492,27 +508,27 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.suspendWarmCapture(reason: "display-sleep") }
+        Task { await self.suspendWarmCapture(source: .displaySleep) }
       }
     )
 
     let distributedCenter = DistributedNotificationCenter.default()
     distributedNotificationObservers.append(
       distributedCenter.addObserver(
-        forName: Notification.Name("com.apple.screenIsLocked"),
+        forName: ScreenLockNotifications.locked,
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.suspendWarmCapture(reason: "screen-locked") }
+        Task { await self.suspendWarmCapture(source: .screenLock) }
       }
     )
     distributedNotificationObservers.append(
       distributedCenter.addObserver(
-        forName: Notification.Name("com.apple.screenIsUnlocked"),
+        forName: ScreenLockNotifications.unlocked,
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.resumeWarmCapture(reason: "screen-unlocked") }
+        Task { await self.resumeWarmCapture(source: .screenLock, reason: "screen-unlocked") }
       }
     )
 
@@ -590,7 +606,7 @@ actor RecordingClientLive {
       {
         return
       }
-      await handleCaptureEnvironmentChange(reason: reason)
+      handleCaptureEnvironmentChange(reason: reason)
     }
   }
 
@@ -626,7 +642,9 @@ actor RecordingClientLive {
     audioHardwareObservers.removeAll()
   }
 
-  private func handleCaptureEnvironmentChange(reason: String) async {
+  /// Synchronous on purpose: no awaits means no actor reentrancy, so the recording-state
+  /// snapshot below cannot go stale while this method runs.
+  private func handleCaptureEnvironmentChange(reason: String) {
     let currentInputDevice = getDefaultInputDevice()
     let currentOutputDevice = getDefaultOutputDevice()
     let isRecorderRecording = recorder?.isRecording == true
@@ -640,10 +658,19 @@ actor RecordingClientLive {
     if isRecordingActive {
       invalidatePrimedState()
       if isEngineRecording {
+        let activeInputDevice = applyPreferredInputDevice()
+        // Only disturb an active recording when its capture path is a
```

**File**: `Hex/Clients/SoundEffect.swift` (modified, +14/-19)
```diff
@@ -76,7 +76,6 @@ actor SoundEffectsClientLive {
   @Shared(.hexSettings) var hexSettings: HexSettings
   private var playerNodes: [SoundEffect: AVAudioPlayerNode] = [:]
   private var audioBuffers: [SoundEffect: AVAudioPCMBuffer] = [:]
-  private var isEngineRunning = false
   private var idleShutdownTask: Task<Void, Never>?
   /// Comfortably longer than any sound effect, short enough that an idle Hex doesn't keep
   /// an output IOProc (and coreaudiod) running around the clock (#209).
@@ -105,7 +104,6 @@ actor SoundEffectsClientLive {
       try? await Task.sleep(for: Self.idleShutdownDelay)
       guard !Task.isCancelled else { return }
       stopEngineIfNeeded()
-      logger.debug("Sound effects engine stopped after idle period")
     }
   }
 
@@ -130,10 +128,9 @@ actor SoundEffectsClientLive {
   func setEnabled(_: Bool) async {
     await preloadSounds()
 
-    if hexSettings.soundEffectsEnabled {
-      prepareEngineIfNeeded()
-      scheduleIdleShutdown()
-    } else {
+    // No prewarm on enable: play() starts the engine lazily, and an idle prewarm would
+    // just be shut down again by the idle timer.
+    if !hexSettings.soundEffectsEnabled {
       stopAll()
       idleShutdownTask?.cancel()
       stopEngineIfNeeded()
@@ -171,24 +168,22 @@ actor SoundEffectsClientLive {
   }
 
   private func prepareEngineIfNeeded() {
-    if !isEngineRunning || !engine.isRunning {
-      engine.prepare()
-      if #available(macOS 13.0, *) {
-        engine.isAutoShutdownEnabled = false
-      }
-      do {
-        try engine.start()
-        isEngineRunning = true
-      } catch {
-        logger.error("Failed to start AVAudioEngine: \(error.localizedDescription)")
-      }
+    guard !engine.isRunning else { return }
+    engine.prepare()
+    if #available(macOS 13.0, *) {
+      engine.isAutoShutdownEnabled = false
+    }
+    do {
+      try engine.start()
+    } catch {
+      logger.error("Failed to start AVAudioEngine: \(error.localizedDescription)")
     }
   }
 
   private func stopEngineIfNeeded() {
-    guard isEngineRunning || engine.isRunning else { return }
+    guard engine.isRunning else { return }
     engine.stop()
-    isEngineRunning = false
+    logger.debug("Sound effects engine stopped")
   }
 
   deinit {
```

**File**: `Hex/Clients/SuperFastCaptureController.swift` (modified, +14/-12)
```diff
@@ -253,20 +253,14 @@ final class SuperFastCaptureController {
     if engine != nil {
       logger.notice("Capture engine stopped reason=\(reason)")
     }
-    detachEngine()
-    processingQueue.sync {
-      activeRecording = nil
-      recordingFailure = nil
-      ringBuffer.clear()
-      lastProcessedBufferAt = nil
-      recentCallbackIntervals.removeAll(keepingCapacity: false)
-      recentBufferDurations.removeAll(keepingCapacity: false)
-    }
+    detachEngine(clearingRecordingState: true)
   }
 
-  /// Removes the tap, observer, converter, and engine without touching recording state.
-  /// Bumps the capture generation so in-flight tap callbacks from the old engine are ignored.
-  private func detachEngine() {
+  /// Removes the tap, observer, converter, and engine. Bumps the capture generation so
+  /// in-flight tap callbacks from the old engine are ignored. Recording state (active file,
+  /// ring buffer, timing metrics) is preserved unless `clearingRecordingState` is set, which
+  /// is what lets restartPreservingRecording resume capture onto the same file.
+  private func detachEngine(clearingRecordingState: Bool = false) {
     if let inputNode = engine?.inputNode {
       inputNode.removeTap(onBus: 0)
     }
@@ -277,6 +271,14 @@ final class SuperFastCaptureController {
     processingQueue.sync {
       captureGeneration += 1
       converter = nil
+      if clearingRecordingState {
+        activeRecording = nil
+        recordingFailure = nil
+        ringBuffer.clear()
+        lastProcessedBufferAt = nil
+        recentCallbackIntervals.removeAll(keepingCapacity: false)
+        recentBufferDurations.removeAll(keepingCapacity: false)
+      }
     }
     engine?.stop()
     engine = nil
```

---

### Incident Patch 3: `87399292` (2026-07-09)
**Commit Message**: Overhaul audio engine lifecycle: route-change recovery, sleep suspension, teardown fixes

Addresses the audio-engine bug cluster (#209, #218, #226, #245, #246,
#251, #252) while keeping Super Fast Mode's warm-microphone design intact.

Root problems, all variations of 'the engine outlives the world it was
built for':

1. Route/device changes while idle only *deferred* the engine rebuild to
   the next recording, leaving the stale engine running against the old
   route indefinitely. That kept coreaudiod churning while idle (#209)
   and made the first post-change recording unreliable.
2. Route/device changes *during* a recording deferred entirely: the
   recording kept 'running' while the dead engine captured nothing,
   producing empty transcripts after Bluetooth connects, A2DP<->HFP
   switches, and AirPods handoffs (#251, #252, #218, #226).
3. App-quit teardown was a fire-and-forget Task racing process exit,
   with SuperFastCaptureController.deinit as a second competing teardown
   path - the EXC_BAD_ACCESS in AVAudioEngine teardown (#245).
4. The sound-effects output engine (isAutoShutdownEnabled = false) ran
   forever once started, keeping an output IOProc alive even in stan

**File**: `.changeset/719ddca6.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Overhaul audio engine lifecycle: recover recordings across device/route changes instead of silently capturing nothing (#251, #252, #218, #226), rebuild the warm capture engine immediately when devices change while idle instead of leaving a stale engine running (#209), suspend the warm microphone while the screen is locked or asleep and rearm on wake, stop the sound-effects engine when idle (#209), and fix a crash on quit caused by racy audio teardown (#245)
```

**File**: `Hex/App/HexAppDelegate.swift` (modified, +10/-1)
```diff
@@ -163,8 +163,17 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 	}
 
 	func applicationWillTerminate(_: Notification) {
-		Task {
+		// Tear down audio synchronously (bounded). A fire-and-forget Task here raced process
+		// exit, crashing inside AVAudioEngine teardown while tap callbacks were still in
+		// flight (#245). Task.detached because this thread blocks on the semaphore.
+		let recording = recording
+		let semaphore = DispatchSemaphore(value: 0)
+		Task.detached {
 			await recording.cleanup()
+			semaphore.signal()
+		}
+		if semaphore.wait(timeout: .now() + 3) == .timedOut {
+			appLogger.error("Recording cleanup timed out during app termination")
 		}
 	}
 }
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +132/-6)
```diff
@@ -393,8 +393,13 @@ actor RecordingClientLive {
   private var captureControllerDeviceID: AudioDeviceID?
   private var captureControllerNeedsRestartReason: String?
   private var notificationObservers: [NSObjectProtocol] = []
+  private var distributedNotificationObservers: [NSObjectProtocol] = []
   private var audioHardwareObservers: [AudioHardwareObserver] = []
   private var isObservingSystemChanges = false
+  /// True while the screen is locked or the system/displays are asleep. The warm capture
+  /// engine is suspended in this state (nobody is dictating at a locked screen) and rearmed
+  /// on wake/unlock, which also avoids a whole class of stale-engine-across-sleep bugs.
+  private var isCaptureSuspendedForSystemState = false
 
   @Shared(.hexSettings) var hexSettings: HexSettings
 
@@ -460,7 +465,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "system-wake") }
+        Task { await self.resumeWarmCapture(reason: "system-wake") }
       }
     )
     notificationObservers.append(
@@ -469,7 +474,45 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "display-wake") }
+        Task { await self.resumeWarmCapture(reason: "display-wake") }
+      }
+    )
+    notificationObservers.append(
+      workspaceCenter.addObserver(
+        forName: NSWorkspace.willSleepNotification,
+        object: nil,
+        queue: .main
+      ) { _ in
+        Task { await self.suspendWarmCapture(reason: "system-sleep") }
+      }
+    )
+    notificationObservers.append(
+      workspaceCenter.addObserver(
+        forName: NSWorkspace.screensDidSleepNotification,
+        object: nil,
+        queue: .main
+      ) { _ in
+        Task { await self.suspendWarmCapture(reason: "display-sleep") }
+      }
+    )
+
+    let distributedCenter = DistributedNotificationCenter.default()
+    distributedNotificationObservers.append(
+      distributedCenter.addObserver(
+        forName: Notification.Name("com.apple.screenIsLocked"),
+        object: nil,
+        queue: .main
+      ) { _ in
+        Task { await self.suspendWarmCapture(reason: "screen-locked") }
+      }
+    )
+    distributedNotificationObservers.append(
+      distributedCenter.addObserver(
+        forName: Notification.Name("com.apple.screenIsUnlocked"),
+        object: nil,
+        queue: .main
+      ) { _ in
+        Task { await self.resumeWarmCapture(reason: "screen-unlocked") }
       }
     )
 
@@ -563,6 +606,11 @@ actor RecordingClientLive {
     }
     notificationObservers.removeAll()
 
+    for observer in distributedNotificationObservers {
+      DistributedNotificationCenter.default().removeObserver(observer)
+    }
+    distributedNotificationObservers.removeAll()
+
     for observer in audioHardwareObservers {
       var address = audioPropertyAddress(observer.selector)
       let status = AudioObjectRemovePropertyListenerBlock(
@@ -590,18 +638,65 @@ actor RecordingClientLive {
     )
 
     if isRecordingActive {
-      deferredCaptureRestartReason = reason
       invalidatePrimedState()
+      if isEngineRecording {
+        // Rebuild the engine in place so capture continues onto the same file. Leaving the
+        // stale engine "running" against the old route silently captured nothing for the
+        // rest of the recording (#251, #252, #218, #226).
+        let activeInputDevice = applyPreferredInputDevice()
+        do {
+          try captureController.restartPreservingRecording(reason: reason)
+          captureControllerDeviceID = activeInputDevice
+          captureControllerNeedsRestartReason = nil
+          deferredCaptureRestartReason = nil
+          recordingLogger.notice(
+            "Rebuilt capture engine mid-recording reason=\(reason) input=\(self.describeDevice(activeInputDevice))"
+          )
+          return
+        } catch {
+          recordingLogger.error(
+            "Mid-recording capture engine rebuild failed reason=\(reason): \(error.localizedDescription); deferring restart"
+          )
+        }
+      }
+      deferredCaptureRestartReason = reason
       recordingLogger.notice("Deferring capture restart until current recording stops reason=\(reason)")
       return
     }
 
     deferredCaptureRestartReason = nil
-    if hexSettings.superFastModeEnabled {
+
+    if isCaptureSuspendedForSystemState {
       releaseRecorder(reason: "environment-change-\(reason)")
+      stopCaptureController(reason: "suspended-\(reason)")
       captureControllerNeedsRestartReason = reason
-      captureController.clearWarmBuffer()
-      recordingLogger.notice("Deferring capture engine rebuild until next recording reason=\(reason)")
+      recordingLogger.notice("Capture suspended (screen locked/asleep); deferring engine rebuild reason=\(reason)")
+      return
+    }
+
+    if hexSettings.sup
```

**File**: `Hex/Clients/SoundEffect.swift` (modified, +19/-0)
```diff
@@ -77,6 +77,10 @@ actor SoundEffectsClientLive {
   private var playerNodes: [SoundEffect: AVAudioPlayerNode] = [:]
   private var audioBuffers: [SoundEffect: AVAudioPCMBuffer] = [:]
   private var isEngineRunning = false
+  private var idleShutdownTask: Task<Void, Never>?
+  /// Comfortably longer than any sound effect, short enough that an idle Hex doesn't keep
+  /// an output IOProc (and coreaudiod) running around the clock (#209).
+  private static let idleShutdownDelay: Duration = .seconds(10)
 
   func play(_ soundEffect: SoundEffect) {
     guard hexSettings.soundEffectsEnabled else { return }
@@ -90,6 +94,19 @@ actor SoundEffectsClientLive {
     player.stop()
     player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
     player.play()
+    scheduleIdleShutdown()
+  }
+
+  /// Stops the output engine shortly after playback so it doesn't run while idle.
+  /// Restarting it on the next play costs only a few milliseconds.
+  private func scheduleIdleShutdown() {
+    idleShutdownTask?.cancel()
+    idleShutdownTask = Task {
+      try? await Task.sleep(for: Self.idleShutdownDelay)
+      guard !Task.isCancelled else { return }
+      stopEngineIfNeeded()
+      logger.debug("Sound effects engine stopped after idle period")
+    }
   }
 
   func stop(_ soundEffect: SoundEffect) {
@@ -115,8 +132,10 @@ actor SoundEffectsClientLive {
 
     if hexSettings.soundEffectsEnabled {
       prepareEngineIfNeeded()
+      scheduleIdleShutdown()
     } else {
       stopAll()
+      idleShutdownTask?.cancel()
       stopEngineIfNeeded()
     }
   }
```

**File**: `Hex/Clients/SuperFastCaptureController.swift` (modified, +27/-13)
```diff
@@ -185,7 +185,20 @@ final class SuperFastCaptureController {
     }
 
     stop(reason: "restart-before-arm")
+    try armEngine(reason: reason)
+  }
+
+  /// Tears down and recreates the engine while keeping the active recording file open, so
+  /// capture resumes onto the same file after a device/route change mid-recording
+  /// (#251, #252, #218, #226). The ring buffer, timing metrics, and active recording survive;
+  /// only the engine, tap, and converter are rebuilt.
+  func restartPreservingRecording(reason: String) throws {
+    logger.notice("Restarting capture engine preserving active recording reason=\(reason)")
+    detachEngine()
+    try armEngine(reason: reason)
+  }
 
+  private func armEngine(reason: String) throws {
     let engine = AVAudioEngine()
     let inputNode = engine.inputNode
     let inputFormat = inputNode.inputFormat(forBus: 0)
@@ -240,6 +253,20 @@ final class SuperFastCaptureController {
     if engine != nil {
       logger.notice("Capture engine stopped reason=\(reason)")
     }
+    detachEngine()
+    processingQueue.sync {
+      activeRecording = nil
+      recordingFailure = nil
+      ringBuffer.clear()
+      lastProcessedBufferAt = nil
+      recentCallbackIntervals.removeAll(keepingCapacity: false)
+      recentBufferDurations.removeAll(keepingCapacity: false)
+    }
+  }
+
+  /// Removes the tap, observer, converter, and engine without touching recording state.
+  /// Bumps the capture generation so in-flight tap callbacks from the old engine are ignored.
+  private func detachEngine() {
     if let inputNode = engine?.inputNode {
       inputNode.removeTap(onBus: 0)
     }
@@ -249,13 +276,7 @@ final class SuperFastCaptureController {
     }
     processingQueue.sync {
       captureGeneration += 1
-      activeRecording = nil
-      recordingFailure = nil
       converter = nil
-      ringBuffer.clear()
-      lastProcessedBufferAt = nil
-      recentCallbackIntervals.removeAll(keepingCapacity: false)
-      recentBufferDurations.removeAll(keepingCapacity: false)
     }
     engine?.stop()
     engine = nil
@@ -346,13 +367,6 @@ final class SuperFastCaptureController {
     }
   }
 
-  func clearWarmBuffer() {
-    processingQueue.sync {
-      guard activeRecording == nil else { return }
-      ringBuffer.clear()
-    }
-  }
-
   private func enqueue(_ buffer: AVAudioPCMBuffer, generation: Int) {
     guard let copy = clone(buffer) else { return }
     processingQueue.async { [weak self] in
```

---

### Incident Patch 4: `224822d5` (2026-07-09)
**Commit Message**: Fix hotkeys dying from stale permission checks and sleep cycles

Fixes #250, where four reporters on 0.7.6 hit dead hotkeys with symptoms
that fingerprint a stale Input Monitoring TCC grant: modifier-only hotkeys
kept working while keyed hotkeys and the hotkey recorder went dead, often
after sleep or MDM re-login, and toggling the permission in System
Settings did not help.

Root cause was Hex trusting cached permission checks over reality, in two
compounding places in KeyEventMonitorClient:

1. The tap callback dropped events whenever the cached
   IOHIDCheckAccess/AXIsProcessTrusted flags said permissions were
   missing - even for events macOS was demonstrably delivering.
2. desiredMonitoringState() required inputMonitoringTrusted, so the 100ms
   permission watchdog tore down a *working* tap as soon as
   IOHIDCheckAccess returned a stale denial.

macOS withholds keyDown/keyUp from taps lacking Input Monitoring but
still delivers flagsChanged to Accessibility-granted taps, which is why
victims saw modifiers work while keys died.

The fix treats event arrival as the authoritative permission signal:

- A keyDown/keyUp reaching the tap proves Input Monitoring is granted;
  noteEve

**File**: `.changeset/40c03a8a.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Fix hotkeys dying after sleep or when macOS permission checks go stale: key events arriving at the tap now self-heal the Input Monitoring state instead of being dropped, the tap survives stale permission denials, and it is recreated on wake from sleep (#250)
```

**File**: `Hex/Clients/KeyEventMonitorClient.swift` (modified, +82/-12)
```diff
@@ -101,7 +101,11 @@ class KeyEventMonitorClientLive {
   private var wantsMonitoring = false
   private var accessibilityTrusted = false
   private var inputMonitoringTrusted = false
+  /// Set when key events are observed arriving at the tap. Key events only flow when Input
+  /// Monitoring is genuinely granted, so this overrides stale `IOHIDCheckAccess` denials (#250).
+  private var inputMonitoringProvenByEvents = false
   private var trustMonitorTask: Task<Void, Never>?
+  private var systemEventObservers: [NSObjectProtocol] = []
   private var isFnPressed = false
   private var hasPromptedForAccessibilityTrust = false
   @Shared(.hotkeyPermissionState) private var hotkeyPermissionState: HotkeyPermissionState
@@ -110,16 +114,17 @@ class KeyEventMonitorClientLive {
 
   init() {
     logger.info("Initializing HotKeyClient with CGEvent tap.")
+    registerSystemEventObservers()
   }
 
   deinit {
+    let center = NSWorkspace.shared.notificationCenter
+    for observer in systemEventObservers {
+      center.removeObserver(observer)
+    }
     self.stopMonitoring()
   }
 
-  private var hasRequiredPermissions: Bool {
-    queue.sync { accessibilityTrusted && inputMonitoringTrusted }
-  }
-
   private var hasHandlers: Bool {
     queue.sync { !(continuations.isEmpty && inputContinuations.isEmpty) }
   }
@@ -131,10 +136,14 @@ class KeyEventMonitorClientLive {
   }
 
   private func desiredMonitoringState() -> Bool {
+    // Intentionally not gated on `inputMonitoringTrusted`: `IOHIDCheckAccess` is notorious for
+    // returning stale denials (after sleep, MDM re-logins, or OS updates) while events still
+    // flow, and tearing the tap down on that signal killed working hotkeys (#250). The tap only
+    // needs Accessibility to exist; without Input Monitoring, macOS simply withholds key events
+    // (modifiers still arrive), and creating the tap is what triggers the permission prompt.
     queue.sync {
       wantsMonitoring
         && accessibilityTrusted
-        && inputMonitoringTrusted
         && !(continuations.isEmpty && inputContinuations.isEmpty)
     }
   }
@@ -286,7 +295,7 @@ class KeyEventMonitorClientLive {
         }
         await handlePermissionChange(accessibility: current.accessibility, input: current.input, reason: reason)
         last = current
-      } else if current.accessibility && current.input {
+      } else if current.accessibility {
         await ensureTapIsRunning()
       }
     }
@@ -302,7 +311,7 @@ class KeyEventMonitorClientLive {
         logger.error("Accessibility permission missing (\(reason)); suspending tap.")
       }
       if !input {
-        logger.error("Input Monitoring permission missing (\(reason)); waiting for approval before restarting hotkeys.")
+        logger.error("Input Monitoring permission missing (\(reason)); keyed hotkeys may not fire until it is granted. Tap stays alive in case the check is stale.")
       }
     }
     await refreshMonitoringState(reason: "trust_\(reason)")
@@ -352,7 +361,15 @@ class KeyEventMonitorClientLive {
 
   @MainActor
   private func activateTapIfNeeded(reason: String) {
-    guard !isMonitoring else { return }
+    if isMonitoring {
+      // The 100ms permission watchdog lands here while healthy; use it to revive taps that
+      // macOS disabled without sending a tapDisabled event (observed after sleep, #250).
+      if let eventTapPort, !CGEvent.tapIsEnabled(tap: eventTapPort) {
+        CGEvent.tapEnable(tap: eventTapPort, enable: true)
+        logger.notice("Re-enabled event tap that was silently disabled (reason: \(reason)).")
+      }
+      return
+    }
     guard hasHandlers else { return }
 
     let accessibilityTrusted = currentAccessibilityTrust()
@@ -395,9 +412,10 @@ class KeyEventMonitorClientLive {
             return Unmanaged.passUnretained(cgEvent)
           }
 
-          guard hotKeyClientLive.hasRequiredPermissions else {
-            return Unmanaged.passUnretained(cgEvent)
-          }
+          // An event arriving at the tap is authoritative proof the underlying permission is
+          // granted. Never drop delivered events because a cached permission check went
+          // stale (#250) — that turned recoverable TCC hiccups into dead hotkeys.
+          hotKeyClientLive.noteEventDelivered(type: type)
 
           if type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown {
             _ = hotKeyClientLive.processInputEvent(.mouseClick)
@@ -445,9 +463,16 @@ class KeyEventMonitorClientLive {
     }
 
     isMonitoring = false
+    clearInputMonitoringProof()
     logger.info("Suspended key event monitoring (reason: \(reason)).")
   }
 
+  private func clearInputMonitoringProof() {
+    queue.async(flags: .barrier) { [weak self] in
+      self?.inputMonitoringProvenByEvents = false
+    }
+  }
+
   private func handleTapDisabledEvent(_ type: CGEventType) {
     let reason = type == .tapDisabledByTimeout ? "timeout" : "userInput"
     logger.error("Event 
```

---

### Incident Patch 5: `eae358bb` (2026-07-09)
**Commit Message**: Overhaul model library UX and harden model selection state

Model library rows now have explicit Download buttons, a visible menu for
Show in Finder / Remove Download (with confirmation), and clear In Use /
Installed status labels. Row clicks select installed models only.

State hardening behind the UX:
- Availability scans can no longer clear selectedModel to "" on false
  negatives (this hit users after FluidAudio 0.15.5 moved its cache dir:
  the scan came back empty, 0.8.0 wiped the setting, and push-to-talk
  silently did nothing afterward).
- Selection matching is pattern-aware (ModelPatternMatcher.namesMatch)
  instead of exact-ID, so legacy/glob selections resolve correctly.
- downloadModel resolves glob selections to concrete names up front so
  completion updates rows and settings consistently.
- Stopping a recording with no model selected now discards the audio and
  flashes model setup instead of handing an empty model name to the
  transcriber (which produced junk like "[BLANK_AUDIO]").
- The summary card shows an honest orange "Not downloaded" state with an
  inline Download button when the selected model is missing on disk.

Also trims per-tick re-renders of non-down

**File**: `.changeset/484067c9.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Never silently clear the selected model when a scan misfires, and route hotkey presses to model setup instead of transcribing with no model
```

**File**: `.changeset/b88a7c06.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Redesign the model library: visible Download buttons, one-click model switching, and a menu to remove downloaded models or show them in Finder
```

**File**: `Hex/Features/Settings/ModelDownload/ModelDownloadFeature.swift` (modified, +32/-21)
```diff
@@ -136,27 +136,32 @@ public struct ModelDownloadFeature {
 
 		// Convenience computed vars
 		var selectedModel: String { hexSettings.selectedModel }
+
+		/// The downloaded model matching the current selection, pattern-aware so
+		/// legacy or glob-style selections (e.g. "distil*large-v3") still resolve.
+		private var downloadedModelMatchingSelection: ModelInfo? {
+			guard !selectedModel.isEmpty else { return nil }
+			return availableModels.first { model in
+				model.isDownloaded && ModelPatternMatcher.namesMatch(model.name, selectedModel)
+			}
+		}
+
 		var selectedModelNameForDisplay: String? {
 			guard !selectedModel.isEmpty else { return nil }
-			if let downloaded = availableModels.first(where: {
-				$0.isDownloaded
-					&& (ModelPatternMatcher.matches($0.name, selectedModel)
-						|| ModelPatternMatcher.matches(selectedModel, $0.name))
-			}) {
+			if let downloaded = downloadedModelMatchingSelection {
 				return downloaded.name
 			}
 			if modelBootstrapState.isModelReady,
 			   let identifier = modelBootstrapState.modelIdentifier,
-			   ModelPatternMatcher.matches(identifier, selectedModel)
-				|| ModelPatternMatcher.matches(selectedModel, identifier)
+			   ModelPatternMatcher.namesMatch(identifier, selectedModel)
 			{
 				return selectedModel
 			}
 			return hexSettings.hasCompletedModelBootstrap ? selectedModel : nil
 		}
 
 		var selectedModelIsDownloaded: Bool {
-			availableModels[id: selectedModel]?.isDownloaded ?? false
+			downloadedModelMatchingSelection != nil
 		}
 
 		var anyModelDownloaded: Bool {
@@ -227,11 +232,12 @@ public struct ModelDownloadFeature {
 			return
 		}
 		let displayName = curatedDisplayName(for: model, curated: state.curatedModels)
+		let isDownloaded = state.selectedModelIsDownloaded
 		state.$modelBootstrapState.withLock { bootstrap in
 			bootstrap.modelIdentifier = model
 			bootstrap.modelDisplayName = displayName
-			bootstrap.isModelReady = state.selectedModelIsDownloaded
-			if state.selectedModelIsDownloaded {
+			bootstrap.isModelReady = isDownloaded
+			if isDownloaded {
 				bootstrap.lastError = nil
 				bootstrap.progress = 1
 			}
@@ -321,13 +327,18 @@ public struct ModelDownloadFeature {
 				}
 			}
 			state.curatedModels = IdentifiedArrayOf(uniqueElements: curated)
+			// If the selection isn't installed but another model is, switch to the
+			// installed one so transcription keeps working. Never clear the user's
+			// selection outright: availability scans can produce false negatives
+			// (e.g. after a dependency changes its cache layout), and wiping the
+			// setting turns a transient glitch into a permanent silent failure.
 			if !state.selectedModelIsDownloaded,
 			   let installedModel = state.curatedModels.first(where: \.isDownloaded)
 			{
 				let fallback = resolvePattern(installedModel.internalName, from: Array(state.availableModels)) ?? installedModel.internalName
-				state.$hexSettings.withLock { $0.selectedModel = fallback }
-			} else if !state.anyModelDownloaded, state.hexSettings.hasCompletedModelBootstrap {
-				state.$hexSettings.withLock { $0.selectedModel = "" }
+				if fallback != state.selectedModel {
+					state.$hexSettings.withLock { $0.selectedModel = fallback }
+				}
 			}
 			updateBootstrapState(&state)
 			if !state.anyModelDownloaded && !state.hexSettings.hasCompletedModelBootstrap {
@@ -341,8 +352,12 @@ public struct ModelDownloadFeature {
 
 		// MARK: – Download
 
-		case let .downloadModel(model):
-			guard !model.isEmpty, !state.isDownloading else { return .none }
+		case let .downloadModel(requestedModel):
+			guard !requestedModel.isEmpty, !state.isDownloading else { return .none }
+			// Resolve glob/legacy selections to a concrete model name up front so
+			// the completion handler updates the matching rows and writes a
+			// concrete name back into settings.
+			let model = resolvePattern(requestedModel, from: Array(state.availableModels)) ?? requestedModel
 			state.downloadError = nil
 			state.isDownloading = true
 			state.downloadProgress = 0
@@ -444,9 +459,7 @@ public struct ModelDownloadFeature {
 		case let .deleteModel(model):
 			guard !model.isEmpty else { return .none }
 			let resolved = resolvePattern(model, from: Array(state.availableModels)) ?? model
-			if ModelPatternMatcher.matches(model, state.selectedModel)
-				|| ModelPatternMatcher.matches(state.selectedModel, model)
-			{
+			if ModelPatternMatcher.namesMatch(model, state.selectedModel) {
 				state.$modelBootstrapState.withLock { $0.isModelReady = false }
 			}
 			return .run { send in
@@ -464,9 +477,7 @@ public struct ModelDownloadFeature {
 			where ModelPatternMatcher.matches(state.curatedModels[index].internalName, model) {
 				state.curatedModels[index].isDownloaded = false
 			}
-			if ModelPatternMatcher.matches(state.selectedModel, model)
-				|| ModelPatternMatcher.matches(model, state.selectedModel)
-			{
+			if ModelPatternMatcher.namesMatch(state.selectedModel, model) {
 				let fallback
```

**File**: `Hex/Features/Settings/ModelDownload/ModelDownloadView.swift` (modified, +113/-53)
```diff
@@ -4,7 +4,7 @@ import Inject
 import SwiftUI
 
 private func modelNamesMatch(_ lhs: String, _ rhs: String) -> Bool {
-	ModelPatternMatcher.matches(lhs, rhs) || ModelPatternMatcher.matches(rhs, lhs)
+	ModelPatternMatcher.namesMatch(lhs, rhs)
 }
 
 public struct ModelDownloadView: View {
@@ -46,9 +46,16 @@ public struct ModelDownloadView: View {
 				CurrentModelSummary(
 					model: selectedModel,
 					selectedModelName: selectedModelName,
+					isInstalled: store.selectedModelIsDownloaded,
+					isDownloadingAnything: store.isDownloading,
 					downloadingModel: downloadingModel,
 					downloadProgress: store.downloadProgress,
 					onBrowse: { isModelLibraryPresented = true },
+					onDownload: {
+						if let name = selectedModelName {
+							store.send(.downloadModel(name))
+						}
+					},
 					onCancelDownload: { store.send(.cancelDownload) }
 				)
 			}
@@ -231,54 +238,72 @@ private struct NoModelCard: View {
 private struct CurrentModelSummary: View {
 	let model: CuratedModelInfo?
 	let selectedModelName: String?
+	let isInstalled: Bool
+	let isDownloadingAnything: Bool
 	let downloadingModel: CuratedModelInfo?
 	let downloadProgress: Double
 	let onBrowse: () -> Void
+	let onDownload: () -> Void
 	let onCancelDownload: () -> Void
 
 	var body: some View {
 		HStack(spacing: 12) {
 			Image(systemName: iconName)
 				.font(.title3)
-				.foregroundStyle(Color.accentColor)
+				.foregroundStyle(needsDownload ? Color.orange : Color.accentColor)
 				.frame(width: 28)
 
 			VStack(alignment: .leading, spacing: 5) {
 				Text(title)
 					.font(.body.weight(.medium))
 				Text(subtitle)
 					.font(.caption)
-					.foregroundStyle(.secondary)
+					.foregroundStyle(needsDownload ? Color.orange : Color.secondary)
 				if let activeDownloadStatus {
 					Text(activeDownloadStatus)
 						.font(.caption)
 						.foregroundStyle(.secondary)
 				}
-				if downloadingModel != nil {
+				if isDownloadingAnything {
 					ProgressView(value: downloadProgress)
 						.progressViewStyle(.linear)
 				}
 			}
 
 			Spacer()
 
-			if downloadingModel != nil {
+			if isDownloadingAnything {
 				VStack(alignment: .trailing, spacing: 4) {
 					Text("\(Int(downloadProgress * 100))%")
 						.font(.caption)
 						.foregroundStyle(.secondary)
+						.monospacedDigit()
 					Button("Cancel", role: .destructive, action: onCancelDownload)
 						.controlSize(.small)
 				}
 			} else {
-				Button("Browse Models…", action: onBrowse)
-					.controlSize(.small)
+				HStack(spacing: 8) {
+					if needsDownload {
+						Button("Download", action: onDownload)
+							.buttonStyle(.borderedProminent)
+							.controlSize(.small)
+					}
+					Button("Browse Models…", action: onBrowse)
+						.controlSize(.small)
+				}
 			}
 		}
 		.padding(10)
 		.background(Color(NSColor.controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
 	}
 
+	/// The selection references a model that isn't on disk (e.g. the scan came
+	/// back empty after an update). Offer a direct download instead of
+	/// pretending it's installed.
+	private var needsDownload: Bool {
+		selectedModelName != nil && !isInstalled && !isDownloadingAnything
+	}
+
 	private var title: String {
 		if let model { return model.displayName }
 		if let selectedModelName {
@@ -292,6 +317,7 @@ private struct CurrentModelSummary: View {
 	}
 
 	private var subtitle: String {
+		if needsDownload { return "Not downloaded — transcription won't work until you download it." }
 		if let model { return "\(model.size) · \(model.storageSize)" }
 		if selectedModelName != nil { return "Installed local model" }
 		if let downloadingModel { return "\(downloadingModel.storageSize) will be stored locally on this Mac." }
@@ -304,6 +330,7 @@ private struct CurrentModelSummary: View {
 	}
 
 	private var iconName: String {
+		if needsDownload { return "exclamationmark.triangle.fill" }
 		if selectedModelName == nil { return "arrow.down.circle.fill" }
 		return "waveform"
 	}
@@ -313,7 +340,7 @@ private struct CurrentModelSummary: View {
 private struct ModelLibrarySheet: View {
 	@Bindable var store: StoreOf<ModelDownloadFeature>
 	@Environment(\.dismiss) private var dismiss
-	@State private var pendingDownload: CuratedModelInfo?
+	@State private var pendingDelete: CuratedModelInfo?
 
 	var body: some View {
 		VStack(alignment: .leading, spacing: 14) {
@@ -348,40 +375,32 @@ private struct ModelLibrarySheet: View {
 		.padding(18)
 		.frame(minWidth: 680, minHeight: 420)
 		.confirmationDialog(
-			"Download \(pendingDownload?.displayName ?? "model")?",
+			"Remove \(pendingDelete?.displayName ?? "model")?",
 			isPresented: Binding(
-				get: { pendingDownload != nil },
-				set: { if !$0 { pendingDownload = nil } }
+				get: { pendingDelete != nil },
+				set: { if !$0 { pendingDelete = nil } }
 			),
 			titleVisibility: .visible
 		) {
-			if let pendingDownload {
-				Button("Download and Use") {
-					download(pendingDownload)
-					self.pendingDownload = nil
+			if let pen
```

**File**: `Hex/Features/Transcription/TranscriptionFeature.swift` (modified, +14/-1)
```diff
@@ -347,10 +347,23 @@ private extension TranscriptionFeature {
       return handleDiscard(&state)
     }
 
+    let model = state.hexSettings.selectedModel
+    guard !model.isEmpty else {
+      // Defense-in-depth: handleStartRecording already blocks recording when the
+      // bootstrap state says no model is ready, but settings can change while a
+      // recording is in flight (or the in-memory bootstrap default can race a
+      // cold launch). Never hand an empty model name to the transcriber: it
+      // silently produces nothing (or junk like "[BLANK_AUDIO]").
+      transcriptionFeatureLogger.error("Recording stopped with no transcription model selected; discarding audio")
+      return .merge(
+        handleDiscard(&state),
+        .send(.modelMissing)
+      )
+    }
+
     // Otherwise, proceed to transcription
     state.isTranscribing = true
     state.error = nil
-    let model = state.hexSettings.selectedModel
     let language = state.hexSettings.outputLanguage
 
     state.isPrewarming = true
```

**File**: `HexCore/Sources/HexCore/Logic/ModelPatternMatcher.swift` (modified, +7/-0)
```diff
@@ -17,6 +17,13 @@ public enum ModelPatternMatcher {
     return pattern == text
   }
 
+  /// Returns `true` if either name matches the other as a pattern.
+  /// Use when comparing a stored selection to a model name and either side
+  /// may be a glob (e.g. "distil*large-v3") or a concrete identifier.
+  public static func namesMatch(_ lhs: String, _ rhs: String) -> Bool {
+    matches(lhs, rhs) || matches(rhs, lhs)
+  }
+
   /// Given a list of model names and download status, resolve a glob pattern to a concrete name.
   /// Preference: downloaded > non-turbo > any match.
   /// Returns `nil` if no match found.
```

**File**: `HexTests/ModelDownloadFeatureTests.swift` (modified, +34/-0)
```diff
@@ -66,6 +66,40 @@ final class ModelDownloadFeatureTests: XCTestCase {
     XCTAssertEqual(store.state.hexSettings.selectedModel, "installed-model")
   }
 
+  func testModelsLoadedNeverClearsSelectionWhenNothingDetected() async {
+    // Regression: 0.8.0 cleared selectedModel to "" when an availability scan
+    // came back empty (e.g. after FluidAudio moved its cache directory),
+    // permanently breaking transcription with no visible error.
+    var state = makeState(selectedModel: ParakeetModel.englishV2.identifier)
+    state.availableModels = []
+
+    let store = TestStore(initialState: state) {
+      ModelDownloadFeature()
+    }
+    store.exhaustivity = .off
+
+    await store.send(.modelsLoaded(recommended: "", available: []))
+
+    XCTAssertEqual(store.state.hexSettings.selectedModel, ParakeetModel.englishV2.identifier)
+  }
+
+  func testSelectedModelIsDownloadedMatchesPatterns() {
+    var state = makeState(selectedModel: "distil*large-v3")
+    state.availableModels = [
+      ModelInfo(name: "distil-whisper_distil-large-v3", isDownloaded: true)
+    ]
+    XCTAssertTrue(state.selectedModelIsDownloaded)
+
+    state.availableModels = [
+      ModelInfo(name: "distil-whisper_distil-large-v3", isDownloaded: false)
+    ]
+    XCTAssertFalse(state.selectedModelIsDownloaded)
+
+    var emptyState = makeState(selectedModel: "")
+    emptyState.availableModels = [ModelInfo(name: "some-model", isDownloaded: true)]
+    XCTAssertFalse(emptyState.selectedModelIsDownloaded)
+  }
+
   func testDeletingAnotherModelDoesNotChangeSelection() async {
     var state = makeState(selectedModel: "selected-model")
     state.availableModels = [
```

**File**: `Localizable.xcstrings` (modified, +18/-9)
```diff
@@ -16,9 +16,6 @@
           }
         }
       }
-    },
-    "%@ will be stored locally on this Mac." : {
-
     },
     "%lld%%" : {
 
@@ -192,9 +189,6 @@
     },
     "Copy transcription text to clipboard in addition to pasting it" : {
 
-    },
-    "Delete" : {
-
     },
     "Delete All" : {
       "comment" : "Delete all transcriptions from history.",
@@ -253,13 +247,13 @@
     "Done" : {
 
     },
-    "Download %@?" : {
+    "Download" : {
 
     },
-    "Download a local model to start transcribing." : {
+    "Download %@ and switch to this model" : {
 
     },
-    "Download and Use" : {
+    "Download a local model to start transcribing." : {
 
     },
     "Download Error: %@" : {
@@ -596,6 +590,15 @@
     },
     "Regex Pattern" : {
 
+    },
+    "Remove %@?" : {
+
+    },
+    "Remove Download" : {
+
+    },
+    "Remove Download…" : {
+
     },
     "Remove matching words from every transcript." : {
 
@@ -700,6 +703,9 @@
     },
     "Show in Finder" : {
 
+    },
+    "Show in Finder or remove this download" : {
+
     },
     "Sound" : {
       "comment" : "sound section in general settings.",
@@ -745,6 +751,9 @@
     },
     "Support the developer" : {
 
+    },
+    "This frees %@ on this Mac. You can download it again anytime." : {
+
     },
     "Transcription history is currently disabled." : {
 
```

---

### Incident Patch 6: `cd971a36` (2026-07-09)
**Commit Message**: Reuse Parakeet downloads after FluidAudio upgrade

FluidAudio 0.15.5 changed Parakeet's canonical cache directory by dropping the -coreml suffix. Atomically migrate complete legacy caches into the new location, replacing interrupted partial downloads while preserving both directories if validation fails.

**File**: `.changeset/5e7a7c51.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Reuse existing Parakeet downloads after upgrading FluidAudio
```

**File**: `Hex/Clients/LegacyModelCacheMigrator.swift` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import Foundation
+
+enum LegacyModelCacheMigrator {
+  static func migrate(
+    from legacyDirectory: URL,
+    to currentDirectory: URL,
+    fileManager: FileManager = .default,
+    isValid: (URL) -> Bool
+  ) throws -> Bool {
+    guard legacyDirectory.standardizedFileURL != currentDirectory.standardizedFileURL,
+          fileManager.fileExists(atPath: legacyDirectory.path),
+          !isValid(currentDirectory)
+    else { return false }
+
+    let backupDirectory = currentDirectory
+      .deletingLastPathComponent()
+      .appendingPathComponent(".\(currentDirectory.lastPathComponent)-migration-\(UUID().uuidString)")
+    let hadCurrentDirectory = fileManager.fileExists(atPath: currentDirectory.path)
+
+    if hadCurrentDirectory {
+      try fileManager.moveItem(at: currentDirectory, to: backupDirectory)
+    }
+
+    do {
+      try fileManager.moveItem(at: legacyDirectory, to: currentDirectory)
+      guard isValid(currentDirectory) else {
+        throw MigrationError.invalidLegacyModel
+      }
+      if hadCurrentDirectory {
+        try? fileManager.removeItem(at: backupDirectory)
+      }
+      return true
+    } catch {
+      if fileManager.fileExists(atPath: currentDirectory.path),
+         !fileManager.fileExists(atPath: legacyDirectory.path)
+      {
+        try? fileManager.moveItem(at: currentDirectory, to: legacyDirectory)
+      }
+      if hadCurrentDirectory, fileManager.fileExists(atPath: backupDirectory.path) {
+        try? fileManager.moveItem(at: backupDirectory, to: currentDirectory)
+      }
+      throw error
+    }
+  }
+
+  enum MigrationError: Error {
+    case invalidLegacyModel
+  }
+}
```

**File**: `Hex/Clients/ParakeetClient.swift` (modified, +25/-0)
```diff
@@ -23,6 +23,7 @@ actor ParakeetClient {
     if currentVariant == variant, asr != nil { return true }
 
     let directory = AsrModels.defaultCacheDirectory(for: variant.asrVersion)
+    migrateLegacyCacheIfNeeded(variant, to: directory)
     let available = AsrModels.modelsExist(
       at: directory,
       version: variant.asrVersion
@@ -48,6 +49,10 @@ actor ParakeetClient {
       asr = nil
       models = nil
     }
+    migrateLegacyCacheIfNeeded(
+      variant,
+      to: AsrModels.defaultCacheDirectory(for: variant.asrVersion)
+    )
     let t0 = Date()
     logger.notice("Starting Parakeet load variant=\(variant.identifier)")
     let p = Progress(totalUnitCount: 100)
@@ -95,6 +100,26 @@ actor ParakeetClient {
     return total
   }
 
+  private func migrateLegacyCacheIfNeeded(_ variant: ParakeetModel, to directory: URL) {
+    let legacyDirectory = directory
+      .deletingLastPathComponent()
+      .appendingPathComponent(variant.identifier, isDirectory: true)
+
+    do {
+      if try LegacyModelCacheMigrator.migrate(
+        from: legacyDirectory,
+        to: directory,
+        isValid: {
+          AsrModels.modelsExist(at: $0, version: variant.asrVersion)
+        }
+      ) {
+        logger.notice("Migrated legacy Parakeet cache from \(legacyDirectory.path) to \(directory.path)")
+      }
+    } catch {
+      logger.error("Failed to migrate legacy Parakeet cache: \(error.localizedDescription)")
+    }
+  }
+
   func transcribe(_ url: URL) async throws -> String {
     guard let asr else { throw NSError(domain: "Parakeet", code: -1, userInfo: [NSLocalizedDescriptionKey: "Parakeet not initialized"]) }
     let t0 = Date()
```

**File**: `HexTests/LegacyModelCacheMigratorTests.swift` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import Foundation
+import XCTest
+
+@testable import Hex
+
+final class LegacyModelCacheMigratorTests: XCTestCase {
+  func testReplacesIncompleteCurrentDirectoryWithValidLegacyDirectory() throws {
+    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
+    let legacy = root.appendingPathComponent("model-coreml")
+    let current = root.appendingPathComponent("model")
+    defer { try? FileManager.default.removeItem(at: root) }
+
+    try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
+    try FileManager.default.createDirectory(at: current, withIntermediateDirectories: true)
+    try Data("complete".utf8).write(to: legacy.appendingPathComponent("model.bin"))
+    try Data("partial".utf8).write(to: current.appendingPathComponent("model.bin.partial"))
+
+    let migrated = try LegacyModelCacheMigrator.migrate(from: legacy, to: current) {
+      FileManager.default.fileExists(atPath: $0.appendingPathComponent("model.bin").path)
+    }
+
+    XCTAssertTrue(migrated)
+    XCTAssertFalse(FileManager.default.fileExists(atPath: legacy.path))
+    XCTAssertTrue(FileManager.default.fileExists(atPath: current.appendingPathComponent("model.bin").path))
+    XCTAssertFalse(FileManager.default.fileExists(atPath: current.appendingPathComponent("model.bin.partial").path))
+  }
+
+  func testRestoresBothDirectoriesWhenLegacyDirectoryIsInvalid() throws {
+    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
+    let legacy = root.appendingPathComponent("model-coreml")
+    let current = root.appendingPathComponent("model")
+    defer { try? FileManager.default.removeItem(at: root) }
+
+    try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
+    try FileManager.default.createDirectory(at: current, withIntermediateDirectories: true)
+    try Data("legacy".utf8).write(to: legacy.appendingPathComponent("legacy.bin"))
+    try Data("partial".utf8).write(to: current.appendingPathComponent("partial.bin"))
+
+    XCTAssertThrowsError(
+      try LegacyModelCacheMigrator.migrate(from: legacy, to: current) { _ in false }
+    )
+    XCTAssertTrue(FileManager.default.fileExists(atPath: legacy.appendingPathComponent("legacy.bin").path))
+    XCTAssertTrue(FileManager.default.fileExists(atPath: current.appendingPathComponent("partial.bin").path))
+  }
+}
```

---

### Incident Patch 7: `db31b0a3` (2026-07-02)
**Commit Message**: wip: recording stop-result hardening and model download UI improvements

**File**: `.changeset/5a244b2d.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Move transcription model selection into a focused model library with automatic downloads on selection.
```

**File**: `.changeset/8ecb8e35.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Handle interrupted recording stops explicitly and ignore stale Fast Mode callbacks.
```

**File**: `Hex/App/HexAppDelegate.swift` (modified, +10/-0)
```diff
@@ -42,6 +42,12 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 			name: .updateAppMode,
 			object: nil
 		)
+		NotificationCenter.default.addObserver(
+			self,
+			selector: #selector(handlePresentSettingsWindow),
+			name: .presentSettingsWindow,
+			object: nil
+		)
 
 		// Start long-running app effects (global hotkeys, permissions, etc.)
 		startLifecycleTasksIfNeeded()
@@ -137,6 +143,10 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 		}
 	}
 
+	@objc private func handlePresentSettingsWindow() {
+		presentSettingsView()
+	}
+
 	@MainActor
 	private func updateAppMode() {
 		appLogger.debug("showDockIcon = \(self.hexSettings.showDockIcon)")
```

**File**: `Hex/App/Notifications.swift` (modified, +1/-0)
```diff
@@ -3,4 +3,5 @@ import Foundation
 extension NSNotification.Name {
   /// Posted when app mode settings change (dock icon visibility, etc.)
   static let updateAppMode = NSNotification.Name("UpdateAppMode")
+  static let presentSettingsWindow = NSNotification.Name("PresentSettingsWindow")
 }
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +61/-12)
```diff
@@ -28,7 +28,7 @@ struct AudioInputDevice: Identifiable, Equatable {
 @DependencyClient
 struct RecordingClient {
   var startRecording: @Sendable () async -> Void = {}
-  var stopRecording: @Sendable () async -> URL = { URL(fileURLWithPath: "") }
+  var stopRecording: @Sendable () async -> RecordingStopResult = { .ignored(.noActiveRecording) }
   var requestMicrophoneAccess: @Sendable () async -> Bool = { false }
   var observeAudioLevel: @Sendable () async -> AsyncStream<Meter> = { AsyncStream { _ in } }
   var getAvailableInputDevices: @Sendable () async -> [AudioInputDevice] = { [] }
@@ -62,6 +62,36 @@ struct Meter: Equatable {
   let peakPower: Double
 }
 
+enum IgnoredRecordingStopReason: Equatable {
+  case staleSession
+  case noActiveRecording
+}
+
+enum RecordingFailure: Error, Equatable {
+  case captureWriteFailed(String)
+  case fallbackExportFailed(String)
+  case noCapturedAudio
+}
+
+extension RecordingFailure: LocalizedError {
+  var errorDescription: String? {
+    switch self {
+    case let .captureWriteFailed(message):
+      "Failed to write captured audio: \(message)"
+    case let .fallbackExportFailed(message):
+      "Failed to export recorded audio: \(message)"
+    case .noCapturedAudio:
+      "Recording stopped without captured audio."
+    }
+  }
+}
+
+enum RecordingStopResult: Equatable {
+  case captured(URL)
+  case ignored(IgnoredRecordingStopReason)
+  case failed(RecordingFailure)
+}
+
 // Define function pointer types for the MediaRemote functions.
 typealias MRNowPlayingIsPlayingFunc = @convention(c) (DispatchQueue, @escaping (Bool) -> Void) -> Void
 typealias MRMediaRemoteSendCommandFunc = @convention(c) (Int32, CFDictionary?) -> Void
@@ -838,10 +868,6 @@ actor RecordingClientLive {
     FileManager.default.temporaryDirectory.appendingPathComponent("hex-capture-\(UUID().uuidString).wav")
   }
 
-  private func makeIgnoredStopURL() -> URL {
-    FileManager.default.temporaryDirectory.appendingPathComponent("hex-ignored-stop-\(UUID().uuidString).wav")
-  }
-
   nonisolated static func shouldIgnoreStopRequest(
     snapshotSessionID: UUID?,
     currentSessionID: UUID?
@@ -1139,7 +1165,7 @@ actor RecordingClientLive {
     }
   }
 
-  func stopRecording() async -> URL {
+  func stopRecording() async -> RecordingStopResult {
     let stopSessionID = recordingSessionID
     let activeSession = activeRecordingSession
 
@@ -1155,11 +1181,12 @@ actor RecordingClientLive {
         currentSessionID: recordingSessionID
       ) {
         recordingLogger.notice("Ignoring stale stop request after a newer recording session started")
-        return makeIgnoredStopURL()
+        return .ignored(.staleSession)
       }
     }
 
-    if let captureURL = captureController.finishRecording(clearBuffer: currentCaptureMode() == .superFast) {
+    switch captureController.finishRecording(clearBuffer: currentCaptureMode() == .superFast) {
+    case let .captured(captureURL):
       let stoppedAt = Date()
       let session = activeSession ?? ActiveRecordingSession(
         startedAt: stoppedAt,
@@ -1182,7 +1209,24 @@ actor RecordingClientLive {
 
       await flushDeferredCaptureRestartIfNeeded()
       await resumeMediaIfNeeded()
-      return captureURL
+      return .captured(captureURL)
+
+    case let .failed(error):
+      let stoppedAt = Date()
+      stopMeterTask()
+      endRecordingSession()
+      clearActiveRecordingMetadata()
+      lastRecordingEndedAt = stoppedAt
+      if !hexSettings.superFastModeEnabled {
+        stopCaptureController(reason: "mode-disabled-after-stop-failed")
+        releaseRecorder(reason: "capture-engine-stop-failed")
+      }
+      await flushDeferredCaptureRestartIfNeeded()
+      await resumeMediaIfNeeded()
+      return .failed(error)
+
+    case .idle:
+      break
     }
 
     let stoppedAt = Date()
@@ -1201,7 +1245,7 @@ actor RecordingClientLive {
       lastRecordingEndedAt = stoppedAt
       await flushDeferredCaptureRestartIfNeeded()
       await resumeMediaIfNeeded()
-      return makeIgnoredStopURL()
+      return .ignored(.noActiveRecording)
     }
     recorder?.stop()
     stopMeterTask()
@@ -1210,12 +1254,17 @@ actor RecordingClientLive {
     lastRecordingEndedAt = stoppedAt
     recordingLogger.notice("Recording stopped mode=\(session.mode.rawValue) backend=\(session.backend.rawValue) duration=\(self.formatDuration(recordingDuration))")
 
-    var exportedURL = recordingURL
+    let exportedURL: URL
     do {
       exportedURL = try duplicateCurrentRecording()
     } catch {
       isRecorderPrimedForNextSession = false
       recordingLogger.error("Failed to copy recording: \(error.localizedDescription)")
+      releaseRecorder(reason: "fallback-export-failed")
+      FileManager.default.removeItemIfExists(at: recordingURL)
+      await flushDeferredCaptureRestartIfNeeded()
+      await resumeMediaIfNeeded()
+      return .failed(.fallbackExportFailed(error.localizedDescription))
     }
     releaseRecorder(reason: "fallback-s
```

**File**: `Hex/Clients/SuperFastCaptureController.swift` (modified, +58/-22)
```diff
@@ -83,6 +83,12 @@ enum CaptureRecordingMode: String {
 }
 
 final class SuperFastCaptureController {
+  enum FinishRecordingResult {
+    case captured(URL)
+    case failed(RecordingFailure)
+    case idle
+  }
+
   struct StopTimingEstimate {
     let gracePeriod: TimeInterval
     let callbackInterval: TimeInterval
@@ -114,6 +120,8 @@ final class SuperFastCaptureController {
   private var converter: AVAudioConverter?
   private var configurationChangeObserver: NSObjectProtocol?
   private var activeRecording: ActiveRecording?
+  private var captureGeneration = 0
+  private var recordingFailure: RecordingFailure?
   private var keepWarmBuffer = false
   private var lastProcessedBufferAt: Date?
   private var recentCallbackIntervals: [TimeInterval] = []
@@ -163,13 +171,11 @@ final class SuperFastCaptureController {
   }
 
   func startIfNeeded(reason: String = "unknown", keepWarmBuffer: Bool = false) throws {
-    let didDisableWarmBuffer = self.keepWarmBuffer && !keepWarmBuffer
-    self.keepWarmBuffer = keepWarmBuffer
-    if didDisableWarmBuffer {
-      processingQueue.sync {
-        if activeRecording == nil {
-          ringBuffer.clear()
-        }
+    processingQueue.sync {
+      let didDisableWarmBuffer = self.keepWarmBuffer && !keepWarmBuffer
+      self.keepWarmBuffer = keepWarmBuffer
+      if didDisableWarmBuffer, activeRecording == nil {
+        ringBuffer.clear()
       }
     }
 
@@ -194,19 +200,27 @@ final class SuperFastCaptureController {
       converter.channelMap = [NSNumber(value: 0)]
     }
 
-    self.converter = converter
+    let generation = processingQueue.sync {
+      captureGeneration += 1
+      self.converter = converter
+      recordingFailure = nil
+      return captureGeneration
+    }
 
     inputNode.installTap(onBus: 0, bufferSize: SuperFastCaptureConstants.tapBufferSize, format: inputFormat) {
       [weak self] buffer, _ in
-      self?.enqueue(buffer)
+      self?.enqueue(buffer, generation: generation)
     }
 
     engine.prepare()
     do {
       try engine.start()
     } catch {
       inputNode.removeTap(onBus: 0)
-      self.converter = nil
+      processingQueue.sync {
+        captureGeneration += 1
+        self.converter = nil
+      }
       throw error
     }
     self.engine = engine
@@ -215,7 +229,7 @@ final class SuperFastCaptureController {
       object: engine,
       queue: .main
     ) { [weak self] _ in
-      self?.handleConfigurationChange()
+      self?.handleConfigurationChange(generation: generation)
     }
     logger.notice(
       "Capture engine armed reason=\(reason) sampleRate=\(String(format: "%.0f", inputFormat.sampleRate))Hz channels=\(inputFormat.channelCount) ringBuffer=\(String(format: "%.2f", SuperFastCaptureConstants.ringBufferDuration))s defaultPreRoll=\(String(format: "%.2f", SuperFastCaptureConstants.defaultPreRollDuration))s"
@@ -233,30 +247,39 @@ final class SuperFastCaptureController {
       NotificationCenter.default.removeObserver(configurationChangeObserver)
       self.configurationChangeObserver = nil
     }
-    engine?.stop()
-    engine = nil
-    converter = nil
-
     processingQueue.sync {
+      captureGeneration += 1
       activeRecording = nil
+      recordingFailure = nil
+      converter = nil
       ringBuffer.clear()
       lastProcessedBufferAt = nil
       recentCallbackIntervals.removeAll(keepingCapacity: false)
       recentBufferDurations.removeAll(keepingCapacity: false)
     }
+    engine?.stop()
+    engine = nil
   }
 
-  private func handleConfigurationChange() {
+  private func handleConfigurationChange(generation: Int) {
+    guard processingQueue.sync(execute: { Self.shouldProcessCallback(callbackGeneration: generation, currentGeneration: captureGeneration) }) else {
+      return
+    }
     logger.notice("Capture engine configuration changed")
     onEngineConfigurationChange()
   }
 
+  static func shouldProcessCallback(callbackGeneration: Int, currentGeneration: Int) -> Bool {
+    callbackGeneration == currentGeneration
+  }
+
   func beginRecording(to url: URL, requestedAt: Date = Date(), mode: CaptureRecordingMode) throws {
     try startIfNeeded(reason: "begin-recording", keepWarmBuffer: mode.keepsWarmBuffer)
 
     var startError: Error?
     processingQueue.sync {
       do {
+        recordingFailure = nil
         let file = try AVAudioFile(
           forWriting: url,
           settings: [
@@ -300,14 +323,22 @@ final class SuperFastCaptureController {
     }
   }
 
-  func finishRecording(clearBuffer: Bool = true) -> URL? {
+  func finishRecording(clearBuffer: Bool = true) -> FinishRecordingResult {
     processingQueue.sync {
-      let url = activeRecording?.url
+      let result: FinishRecordingResult
+      if let recordingFailure {
+        result = .failed(recordingFailure)
+      } else if let url = activeRecording?.url {
+        result = .captured(url)
+      } else {
+        result = .idle
+      }
       activeRecording = nil
+      recordingFailure = ni
```

**File**: `Hex/Features/App/AppFeature.swift` (modified, +6/-1)
```diff
@@ -13,6 +13,10 @@ import SwiftUI
 
 @Reducer
 struct AppFeature {
+	private enum CancelID {
+		case modelMissingFlash
+	}
+
   enum ActiveTab: Equatable {
     case settings
     case remappings
@@ -99,11 +103,12 @@ struct AppFeature {
         return .run { send in
           await MainActor.run {
             HexLog.app.notice("Activating app for model missing")
-            NSApplication.shared.activate(ignoringOtherApps: true)
+            NotificationCenter.default.post(name: .presentSettingsWindow, object: nil)
           }
           try? await Task.sleep(for: .seconds(2))
           await send(.settings(.set(\.shouldFlashModelSection, false)))
         }
+		.cancellable(id: CancelID.modelMissingFlash, cancelInFlight: true)
 
       case .transcription:
         return .none
```

**File**: `Hex/Features/Settings/ModelDownload/CuratedRow.swift` (modified, +5/-12)
```diff
@@ -1,5 +1,5 @@
 import ComposableArchitecture
-import Darwin
+import HexCore
 import Inject
 import SwiftUI
 
@@ -10,14 +10,8 @@ struct CuratedRow: View {
 
 	var isSelected: Bool {
 		let selected = store.hexSettings.selectedModel
-		if model.internalName.contains("*") || model.internalName.contains("?") {
-			return fnmatch(model.internalName, selected, 0) == 0
-		}
-		// Also consider the inverse: selected may be a concrete name while the curated item is a prefix-like value
-		if selected.contains("*") || selected.contains("?") {
-			return fnmatch(selected, model.internalName, 0) == 0
-		}
-		return model.internalName == selected
+		return ModelPatternMatcher.matches(model.internalName, selected)
+			|| ModelPatternMatcher.matches(selected, model.internalName)
 	}
 
 	var body: some View {
@@ -32,7 +26,7 @@ struct CuratedRow: View {
 					HStack(spacing: 6) {
 						Text(model.displayName)
 							.font(.headline)
-						if let badge = model.badge {
+						if !model.isDownloaded, let badge = model.badge {
 							Text(badge)
 								.font(.caption2)
 								.fontWeight(.semibold)
@@ -80,8 +74,7 @@ struct CuratedRow: View {
 								.help("Downloaded")
 						} else {
 							Button {
-								store.send(.selectModel(model.internalName))
-								store.send(.downloadSelectedModel)
+								store.send(.downloadModel(model.internalName))
 							} label: {
 								Image(systemName: "arrow.down.circle")
 							}
```

---

### Incident Patch 8: `71878b72` (2026-06-04)
**Commit Message**: fix(audio): defer capture rebuilds during route changes (#236)

**File**: `.changeset/4dca4969.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Defer Fast Mode capture rebuilds until audio route changes settle
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +32/-50)
```diff
@@ -353,11 +353,12 @@ actor RecordingClientLive {
     meterContinuation: meterContinuation,
     onEngineConfigurationChange: { [weak self] in
       Task {
-        await self?.enqueueCaptureEnvironmentChange(reason: "capture-engine-configuration-changed", forceRestart: true)
+        await self?.enqueueCaptureEnvironmentChange(reason: "capture-engine-configuration-changed")
       }
     }
   )
   private var captureControllerDeviceID: AudioDeviceID?
+  private var captureControllerNeedsRestartReason: String?
   private var notificationObservers: [NSObjectProtocol] = []
   private var audioHardwareObservers: [AudioHardwareObserver] = []
   private var isObservingSystemChanges = false
@@ -426,7 +427,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "system-wake", forceRestart: true) }
+        Task { await self.enqueueCaptureEnvironmentChange(reason: "system-wake") }
       }
     )
     notificationObservers.append(
@@ -435,7 +436,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "display-wake", forceRestart: true) }
+        Task { await self.enqueueCaptureEnvironmentChange(reason: "display-wake") }
       }
     )
 
@@ -446,7 +447,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "capture-device-connected", forceRestart: true) }
+        Task { await self.enqueueCaptureEnvironmentChange(reason: "capture-device-connected") }
       }
     )
     notificationObservers.append(
@@ -455,7 +456,7 @@ actor RecordingClientLive {
         object: nil,
         queue: .main
       ) { _ in
-        Task { await self.enqueueCaptureEnvironmentChange(reason: "capture-device-disconnected", forceRestart: true) }
+        Task { await self.enqueueCaptureEnvironmentChange(reason: "capture-device-disconnected") }
       }
     )
 
@@ -480,7 +481,7 @@ actor RecordingClientLive {
     reason: String
   ) {
     let listener: CoreAudioPropertyListenerBlock = { _, _ in
-      Task { await self.enqueueCaptureEnvironmentChange(reason: reason, forceRestart: true) }
+      Task { await self.enqueueCaptureEnvironmentChange(reason: reason) }
     }
 
     var address = audioPropertyAddress(selector)
@@ -500,12 +501,12 @@ actor RecordingClientLive {
     }
   }
 
-  private func enqueueCaptureEnvironmentChange(reason: String, forceRestart: Bool) {
+  private func enqueueCaptureEnvironmentChange(reason: String) {
     environmentChangeDebounceTask?.cancel()
     environmentChangeDebounceTask = Task { [self] in
       try? await Task.sleep(for: .milliseconds(250))
       guard !Task.isCancelled else { return }
-      await handleCaptureEnvironmentChange(reason: reason, forceRestart: forceRestart)
+      await handleCaptureEnvironmentChange(reason: reason)
     }
   }
 
@@ -536,7 +537,7 @@ actor RecordingClientLive {
     audioHardwareObservers.removeAll()
   }
 
-  private func handleCaptureEnvironmentChange(reason: String, forceRestart: Bool) async {
+  private func handleCaptureEnvironmentChange(reason: String) async {
     let currentInputDevice = getDefaultInputDevice()
     let currentOutputDevice = getDefaultOutputDevice()
     let isRecorderRecording = recorder?.isRecording == true
@@ -555,46 +556,24 @@ actor RecordingClientLive {
     }
 
     deferredCaptureRestartReason = nil
-    let activeInputDevice = applyPreferredInputDevice()
-
     if hexSettings.superFastModeEnabled {
       releaseRecorder(reason: "environment-change-\(reason)")
-      do {
-        try ensureCaptureControllerReady(
-          for: activeInputDevice,
-          reason: reason,
-          forceRestart: forceRestart
-        )
-      } catch {
-        recordingLogger.error("Failed to restart capture engine after \(reason): \(error.localizedDescription)")
-      }
+      captureControllerNeedsRestartReason = reason
+      captureController.clearWarmBuffer()
+      recordingLogger.notice("Deferring capture engine rebuild until next recording reason=\(reason)")
       return
     }
 
+    _ = applyPreferredInputDevice()
     stopCaptureController(reason: reason)
-    let shouldReprimeRecorder = recorder != nil || isRecorderPrimedForNextSession
     releaseRecorder(reason: "environment-change-\(reason)")
-
-    guard shouldReprimeRecorder else {
-      recordingLogger.debug("No warm recorder state to rebuild after reason=\(reason)")
-      return
-    }
-
-    do {
-      try primeRecorderForNextSession()
-      recordingLogger.notice("Recorder re-primed after reason=\(reason)")
-    } catch {
-      recordingLogger.error("Failed to re-prime recorder after \(reason): \(error.localizedDescription)")
-    }
+    recordingLogger.debug("Standard mode uses on-demand capture startup after reason=\(reason)")
   }
 
   private func flus
```

**File**: `Hex/Clients/SuperFastCaptureController.swift` (modified, +7/-0)
```diff
@@ -311,6 +311,13 @@ final class SuperFastCaptureController {
     }
   }
 
+  func clearWarmBuffer() {
+    processingQueue.sync {
+      guard activeRecording == nil else { return }
+      ringBuffer.clear()
+    }
+  }
+
   private func enqueue(_ buffer: AVAudioPCMBuffer) {
     guard let copy = clone(buffer) else { return }
     processingQueue.async { [weak self] in
```

---

### Incident Patch 9: `c00a91d0` (2026-06-04)
**Commit Message**: fix: harden microphone and recording reliability (#235)

* fix: harden microphone and recording reliability

* refactor: simplify reliability fixes

**File**: `.changeset/83606f78.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Refresh microphones reliably, harden recording cleanup, and polish the settings overlay behavior.
```

**File**: `Hex.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -298,7 +298,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = NO;
 				SWIFT_VERSION = 5.0;
-				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Hex.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Hex";
+				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Hex Debug.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Hex Debug";
 			};
 			name = Debug;
 		};
```

**File**: `Hex/App/HexApp.swift` (modified, +11/-9)
```diff
@@ -14,34 +14,36 @@ struct HexApp: App {
   
     var body: some Scene {
         MenuBarExtra {
-            CheckForUpdatesView()
-
-            // Copy last transcript to clipboard
             MenuBarCopyLastTranscriptButton()
 
-            Button("Settings...") {
+            Button("Settings…") {
                 appDelegate.presentSettingsView()
             }.keyboardShortcut(",")
+
+            CheckForUpdatesView()
 			
 			Divider()
 			
-			Button("Quit") {
+			Button("Quit Hex") {
 				NSApplication.shared.terminate(nil)
 			}.keyboardShortcut("q")
 		} label: {
-			let image: NSImage = {
+			if let image = NSImage(named: "HexIcon").map({
 				let ratio = $0.size.height / $0.size.width
 				$0.size.height = 18
 				$0.size.width = 18 / ratio
 				return $0
-			}(NSImage(named: "HexIcon")!)
-			Image(nsImage: image)
+			}) {
+				Image(nsImage: image)
+			} else {
+				Image(systemName: "hexagon")
+			}
 		}
 		.commands {
 			CommandGroup(after: .appInfo) {
 				CheckForUpdatesView()
 
-				Button("Settings...") {
+				Button("Settings…") {
 					appDelegate.presentSettingsView()
 				}.keyboardShortcut(",")
 			}
```

**File**: `Hex/App/HexAppDelegate.swift` (modified, +4/-2)
```diff
@@ -102,7 +102,7 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 		let transcriptionView = TranscriptionView(store: transcriptionStore).padding().padding(.top).padding(.top)
 			.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
 		invisibleWindow = InvisibleWindow.fromView(transcriptionView)
-		invisibleWindow?.makeKeyAndOrderFront(nil)
+		invisibleWindow?.orderFrontRegardless()
 	}
 
 	func presentSettingsView() {
@@ -115,13 +115,15 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 		let settingsView = AppView(store: HexApp.appStore)
 		let settingsWindow = NSWindow(
 			contentRect: .init(x: 0, y: 0, width: 700, height: 700),
-			styleMask: [.titled, .fullSizeContentView, .closable, .miniaturizable],
+			styleMask: [.titled, .fullSizeContentView, .closable, .miniaturizable, .resizable],
 			backing: .buffered,
 			defer: false
 		)
 		settingsWindow.titleVisibility = .visible
 		settingsWindow.contentView = NSHostingView(rootView: settingsView)
 		settingsWindow.isReleasedWhenClosed = false
+		settingsWindow.minSize = .init(width: 620, height: 560)
+		settingsWindow.setFrameAutosaveName("Settings")
 		settingsWindow.center()
 		settingsWindow.toolbarStyle = NSWindow.ToolbarStyle.unified
 		settingsWindow.makeKeyAndOrderFront(nil)
```

**File**: `Hex/App/MenuBarCopyLastTranscriptButton.swift` (modified, +1/-14)
```diff
@@ -12,24 +12,11 @@ struct MenuBarCopyLastTranscriptButton: View {
 
   var body: some View {
     let lastText = transcriptionHistory.history.first?.text
-    let preview: String = {
-      guard let text = lastText?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return "" }
-      let snippet = text.prefix(40)
-      return "\(snippet)\(text.count > 40 ? "…" : "")"
-    }()
 
-    let button = Button(action: {
+    let button = Button("Paste Last Transcript") {
       if let text = lastText {
         Task { await pasteboard.paste(text) }
       }
-    }) {
-      HStack(spacing: 6) {
-        Text("Paste Last Transcript")
-        if !preview.isEmpty {
-          Text("(\(preview))")
-            .foregroundStyle(.secondary)
-        }
-      }
     }
     .disabled(lastText == nil)
 
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +108/-106)
```diff
@@ -22,6 +22,7 @@ private typealias CoreAudioPropertyListenerBlock = @convention(block) (UInt32, U
 struct AudioInputDevice: Identifiable, Equatable {
   var id: String
   var name: String
+  var legacyID: String
 }
 
 @DependencyClient
@@ -375,40 +376,18 @@ actor RecordingClientLive {
   /// Tracks previous system volume when muted for recording
   private var previousVolume: Float?
 
-  // Cache to store already-processed device information
-  private var deviceCache: [AudioDeviceID: (hasInput: Bool, name: String?)] = [:]
-  private var lastDeviceCheck = Date(timeIntervalSince1970: 0)
-  
   /// Gets all available input devices on the system
   func getAvailableInputDevices() async -> [AudioInputDevice] {
-    // Reset cache if it's been more than 5 minutes since last full refresh
-    let now = Date()
-    if now.timeIntervalSince(lastDeviceCheck) > 300 {
-      deviceCache.removeAll()
-      lastDeviceCheck = now
-    }
-    
     // Get all available audio devices
     let devices = getAllAudioDevices()
     var inputDevices: [AudioInputDevice] = []
     
     // Filter to only input devices and convert to our model
     for device in devices {
-      let hasInput: Bool
-      let name: String?
-      
-      // Check cache first to avoid expensive Core Audio calls
-      if let cached = deviceCache[device] {
-        hasInput = cached.hasInput
-        name = cached.name
-      } else {
-        hasInput = deviceHasInput(deviceID: device)
-        name = hasInput ? getDeviceName(deviceID: device) : nil
-        deviceCache[device] = (hasInput, name)
-      }
-      
-      if hasInput, let deviceName = name {
-        inputDevices.append(AudioInputDevice(id: String(device), name: deviceName))
+      if deviceHasInput(deviceID: device),
+         let deviceUID = getDeviceUID(deviceID: device),
+         let deviceName = getDeviceName(deviceID: device) {
+        inputDevices.append(AudioInputDevice(id: deviceUID, name: deviceName, legacyID: String(device)))
       }
     }
     
@@ -418,14 +397,7 @@ actor RecordingClientLive {
   /// Gets the current system default input device name
   func getDefaultInputDeviceName() async -> String? {
     guard let deviceID = getDefaultInputDevice() else { return nil }
-    if let cached = deviceCache[deviceID], cached.hasInput, let name = cached.name {
-      return name
-    }
-    let name = getDeviceName(deviceID: deviceID)
-    if let name {
-      deviceCache[deviceID] = (hasInput: true, name: name)
-    }
-    return name
+    return getDeviceName(deviceID: deviceID)
   }
   
   // MARK: - Core Audio Helpers
@@ -668,7 +640,19 @@ actor RecordingClientLive {
   
   /// Get device name for the given device ID
   private func getDeviceName(deviceID: AudioDeviceID) -> String? {
-    var address = audioPropertyAddress(kAudioDevicePropertyDeviceNameCFString)
+    getDeviceStringProperty(deviceID: deviceID, selector: kAudioDevicePropertyDeviceNameCFString)
+  }
+
+  /// Get the persistent device UID for the given device ID
+  private func getDeviceUID(deviceID: AudioDeviceID) -> String? {
+    getDeviceStringProperty(deviceID: deviceID, selector: kAudioDevicePropertyDeviceUID)
+  }
+
+  private func getDeviceStringProperty(
+    deviceID: AudioDeviceID,
+    selector: AudioObjectPropertySelector
+  ) -> String? {
+    var address = audioPropertyAddress(selector)
     
     var deviceName: CFString? = nil
     var size = UInt32(MemoryLayout<CFString?>.size)
@@ -689,7 +673,7 @@ actor RecordingClientLive {
     }
     
       if status != 0 {
-        recordingLogger.error("Failed to fetch device name: \(status)")
+        recordingLogger.error("Failed to fetch device property \(selector): \(status)")
         return nil
       }
     
@@ -786,20 +770,41 @@ actor RecordingClientLive {
   }
 
   private func resolvePreferredInputDevice() -> AudioDeviceID? {
-    if let selectedDeviceIDString = hexSettings.selectedMicrophoneID,
-       let selectedDeviceID = AudioDeviceID(selectedDeviceIDString) {
-      let devices = getAllAudioDevices()
-      if devices.contains(selectedDeviceID), deviceHasInput(deviceID: selectedDeviceID) {
-        return selectedDeviceID
-      }
+    guard let selectedMicrophoneID = hexSettings.selectedMicrophoneID else { return nil }
+    if let deviceID = getDeviceID(uid: selectedMicrophoneID),
+       deviceHasInput(deviceID: deviceID) {
+      return deviceID
+    }
 
-      recordingLogger.notice("Selected device \(selectedDeviceID) missing; using system default")
-      return nil
+    if let legacyDeviceID = AudioDeviceID(selectedMicrophoneID),
+       deviceHasInput(deviceID: legacyDeviceID) {
+      return legacyDeviceID
     }
 
+    recordingLogger.notice("Selected device \(selectedMicrophoneID) missing; using system default")
     return nil
   }
 
+  private func getDeviceID(uid: String) -> AudioDeviceID? {
+    var address = audioPropertyAddress(kAudioHardwarePropertyDeviceForUID)
+    var deviceUID = uid as CFString
+    var deviceID
```

**File**: `Hex/Features/App/AppFeature.swift` (modified, +25/-28)
```diff
@@ -48,9 +48,6 @@ struct AppFeature {
     case checkPermissions
     case permissionsUpdated(mic: PermissionStatus, acc: PermissionStatus, input: PermissionStatus)
     case appActivated
-    case requestMicrophone
-    case requestAccessibility
-    case requestInputMonitoring
     case modelStatusEvaluated(Bool)
   }
 
@@ -111,6 +108,31 @@ struct AppFeature {
       case .transcription:
         return .none
 
+      case .settings(.requestMicrophone):
+        return .run { send in
+          _ = await permissions.requestMicrophone()
+          await send(.checkPermissions)
+        }
+
+      case .settings(.requestAccessibility):
+        return .run { send in
+          await permissions.requestAccessibility()
+          // Poll for status change (macOS doesn't provide callback)
+          for _ in 0..<10 {
+            try? await Task.sleep(for: .seconds(1))
+            await send(.checkPermissions)
+          }
+        }
+
+      case .settings(.requestInputMonitoring):
+        return .run { send in
+          _ = await permissions.requestInputMonitoring()
+          for _ in 0..<10 {
+            try? await Task.sleep(for: .seconds(1))
+            await send(.checkPermissions)
+          }
+        }
+
       case .settings:
         return .none
 
@@ -142,31 +164,6 @@ struct AppFeature {
         // App became active - re-check permissions
         return .send(.checkPermissions)
 
-      case .requestMicrophone:
-        return .run { send in
-          _ = await permissions.requestMicrophone()
-          await send(.checkPermissions)
-        }
-
-      case .requestAccessibility:
-        return .run { send in
-          await permissions.requestAccessibility()
-          // Poll for status change (macOS doesn't provide callback)
-          for _ in 0..<10 {
-            try? await Task.sleep(for: .seconds(1))
-            await send(.checkPermissions)
-          }
-        }
-
-      case .requestInputMonitoring:
-        return .run { send in
-          _ = await permissions.requestInputMonitoring()
-          for _ in 0..<10 {
-            try? await Task.sleep(for: .seconds(1))
-            await send(.checkPermissions)
-          }
-        }
-
       case .modelStatusEvaluated:
         return .none
       }
```

**File**: `Hex/Features/History/HistoryFeature.swift` (modified, +28/-24)
```diff
@@ -57,27 +57,34 @@ extension URL {
 
 class AudioPlayerController: NSObject, AVAudioPlayerDelegate {
 	private var player: AVAudioPlayer?
-	var onPlaybackFinished: (() -> Void)?
+	private let (playbackFinishedStream, playbackFinishedContinuation) = AsyncStream<Void>.makeStream()
 
-	func play(url: URL) throws -> AVAudioPlayer {
+	func play(url: URL) throws {
 		let player = try AVAudioPlayer(contentsOf: url)
 		player.delegate = self
-		player.play()
 		self.player = player
-		return player
+		player.play()
 	}
 
 	func stop() {
 		player?.stop()
 		player = nil
+		finishPlayback()
+	}
+
+	func waitForPlaybackToFinish() async {
+		for await _ in playbackFinishedStream {}
 	}
 
 	// AVAudioPlayerDelegate method
 	func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
+		guard self.player === player else { return }
 		self.player = nil
-		Task { @MainActor in
-			onPlaybackFinished?()
-		}
+		finishPlayback()
+	}
+
+	private func finishPlayback() {
+		playbackFinishedContinuation.finish()
 	}
 }
 
@@ -89,14 +96,14 @@ struct HistoryFeature {
 	struct State: Equatable {
 		@Shared(.transcriptionHistory) var transcriptionHistory: TranscriptionHistory
 		var playingTranscriptID: UUID?
-		var audioPlayer: AVAudioPlayer?
+		var playbackID: UUID?
 		var audioPlayerController: AudioPlayerController?
 
 		mutating func stopAudioPlayback() {
 			audioPlayerController?.stop()
-			audioPlayer = nil
 			audioPlayerController = nil
 			playingTranscriptID = nil
+			playbackID = nil
 		}
 	}
 
@@ -107,7 +114,7 @@ struct HistoryFeature {
 		case deleteTranscript(UUID)
 		case deleteAllTranscripts
 		case confirmDeleteAll
-		case playbackFinished
+		case playbackFinished(UUID)
 		case navigateToSettings
 	}
 
@@ -142,31 +149,28 @@ struct HistoryFeature {
 
 				do {
 					let controller = AudioPlayerController()
-					let player = try controller.play(url: transcript.audioPath)
+					try controller.play(url: transcript.audioPath)
+					let playbackID = UUID()
 
-					state.audioPlayer = player
 					state.audioPlayerController = controller
 					state.playingTranscriptID = id
+					state.playbackID = playbackID
 
 					return .run { send in
-						// Using non-throwing continuation since we don't need to throw errors
-						await withCheckedContinuation { continuation in
-							controller.onPlaybackFinished = {
-								continuation.resume()
-
-								// Use Task to switch to MainActor for sending the action
-								Task { @MainActor in
-									send(.playbackFinished)
-								}
-							}
-						}
+						await controller.waitForPlaybackToFinish()
+						await send(.playbackFinished(playbackID))
 					}
 				} catch {
 					historyLogger.error("Failed to play audio: \(error.localizedDescription)")
 					return .none
 				}
 
-			case .stopPlayback, .playbackFinished:
+			case .stopPlayback:
+				state.stopAudioPlayback()
+				return .none
+
+			case let .playbackFinished(playbackID):
+				guard state.playbackID == playbackID else { return .none }
 				state.stopAudioPlayback()
 				return .none
 
```

---

### Incident Patch 10: `f4cecbbf` (2026-05-06)
**Commit Message**: Quiet login launches and reveal Parakeet caches correctly

Two small first-experience fixes that surfaced after 0.7.5 shipped:

- Launching at login no longer pops the Settings window unless the user opens it explicitly. The previous policy only suppressed when the dock icon was hidden, so most 'Open on Login' users got a settings panel in their face every boot. Closes #222.

- 'Show in Finder' on a Parakeet model now opens FluidAudio's on-disk cache at ~/Library/Containers/com.kitlangton.Hex/Data/Library/Application Support/FluidAudio/Models instead of the WhisperKit-only models folder, which made users think their Parakeet download had silently failed. Closes #205.

**File**: `.changeset/5bef6259.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Show in Finder reveals Parakeet caches at the correct path (#205)
```

**File**: `.changeset/726fa771.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Stay in the menu bar when launched at login (#222)
```

**File**: `Hex/App/HexAppDelegate.swift` (modified, +5/-1)
```diff
@@ -59,7 +59,11 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 	}
 
 	private var shouldOpenForegroundUIOnLaunch: Bool {
-		!(launchedAtLogin && !hexSettings.showDockIcon)
+		// When Hex launches at login, stay quietly in the menu bar regardless of
+		// the dock-icon preference. Users who enabled "Open on Login" expect a
+		// background launch; the Settings window can be opened later from the
+		// menu bar item or ⌘, when needed.
+		!launchedAtLogin
 	}
 
 	private func wasLaunchedAtLogin() -> Bool {
```

**File**: `Hex/Features/Settings/ModelDownload/ModelDownloadFeature.swift` (modified, +11/-4)
```diff
@@ -409,15 +409,22 @@ public struct ModelDownloadFeature {
 			}
 
 		case .openModelLocation:
-			return openModelLocationEffect()
+			return openModelLocationEffect(for: state)
 		}
 	}
 
 	// MARK: Helpers
 
-	private func openModelLocationEffect() -> Effect<Action> {
-		.run { _ in
-			let base = try URL.hexModelsDirectory
+	private func openModelLocationEffect(for state: State) -> Effect<Action> {
+		// Parakeet caches live under FluidAudio's directory, not the WhisperKit
+		// models folder. Route "Show in Finder" to the matching root so users
+		// don't end up staring at an empty WhisperKit folder thinking the
+		// Parakeet download silently failed.
+		let usesParakeetRoot = ParakeetModel(rawValue: state.selectedModel) != nil
+		return .run { _ in
+			let base = try usesParakeetRoot
+				? URL.hexParakeetModelsDirectory
+				: URL.hexModelsDirectory
 			NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: base.path)
 		}
 	}
```

**File**: `HexCore/Sources/HexCore/StoragePaths.swift` (modified, +21/-0)
```diff
@@ -35,6 +35,27 @@ public extension URL {
 			return modelsDirectory
 		}
 	}
+
+	/// Where FluidAudio (Parakeet) keeps its on-disk model caches.
+	///
+	/// FluidAudio writes to `<Application Support>/FluidAudio/Models/<variant>` in
+	/// the sandboxed container, regardless of `XDG_CACHE_HOME`. We surface that
+	/// location so "Show in Finder" can reveal Parakeet caches instead of the
+	/// WhisperKit-only models directory.
+	static var hexParakeetModelsDirectory: URL {
+		get throws {
+			let fm = FileManager.default
+			let appSupport = try fm.url(
+				for: .applicationSupportDirectory,
+				in: .userDomainMask,
+				appropriateFor: nil,
+				create: true
+			)
+			let dir = appSupport.appendingPathComponent("FluidAudio/Models", isDirectory: true)
+			try fm.createDirectory(at: dir, withIntermediateDirectories: true)
+			return dir
+		}
+	}
 }
 
 public extension FileManager {
```

---

### Incident Patch 11: `5a4af9bd` (2026-05-03)
**Commit Message**: Fix silent recordings from call audio devices

Multichannel input devices and video-call apps can expose the microphone as a multi-channel stream. Explicitly route channel 0 into Hex's mono converter and restart the capture engine when AVAudioEngine reports a configuration change, avoiding all-zero capture buffers and hallucinated transcripts like "Thank you."

Fixes #204. Related to #206.

**File**: `.changeset/80cc0e1c.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Fix silent recordings from multichannel input devices during calls (#204)
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +8/-1)
```diff
@@ -348,7 +348,14 @@ actor RecordingClientLive {
   ]
   private let (meterStream, meterContinuation) = AsyncStream<Meter>.makeStream()
   private var meterTask: Task<Void, Never>?
-  private lazy var captureController = SuperFastCaptureController(meterContinuation: meterContinuation)
+  private lazy var captureController = SuperFastCaptureController(
+    meterContinuation: meterContinuation,
+    onEngineConfigurationChange: { [weak self] in
+      Task {
+        await self?.enqueueCaptureEnvironmentChange(reason: "capture-engine-configuration-changed", forceRestart: true)
+      }
+    }
+  )
   private var captureControllerDeviceID: AudioDeviceID?
   private var notificationObservers: [NSObjectProtocol] = []
   private var audioHardwareObservers: [AudioHardwareObserver] = []
```

**File**: `Hex/Clients/SuperFastCaptureController.swift` (modified, +34/-3)
```diff
@@ -112,14 +112,20 @@ final class SuperFastCaptureController {
 
   private var engine: AVAudioEngine?
   private var converter: AVAudioConverter?
+  private var configurationChangeObserver: NSObjectProtocol?
   private var activeRecording: ActiveRecording?
   private var keepWarmBuffer = false
   private var lastProcessedBufferAt: Date?
   private var recentCallbackIntervals: [TimeInterval] = []
   private var recentBufferDurations: [TimeInterval] = []
+  private let onEngineConfigurationChange: @Sendable () -> Void
 
-  init(meterContinuation: AsyncStream<Meter>.Continuation) {
+  init(
+    meterContinuation: AsyncStream<Meter>.Continuation,
+    onEngineConfigurationChange: @escaping @Sendable () -> Void
+  ) {
     self.meterContinuation = meterContinuation
+    self.onEngineConfigurationChange = onEngineConfigurationChange
   }
 
   deinit {
@@ -184,6 +190,9 @@ final class SuperFastCaptureController {
         userInfo: [NSLocalizedDescriptionKey: "Unable to create the capture engine audio converter."]
       )
     }
+    if inputFormat.channelCount > 1 {
+      converter.channelMap = [NSNumber(value: 0)]
+    }
 
     self.converter = converter
 
@@ -193,10 +202,23 @@ final class SuperFastCaptureController {
     }
 
     engine.prepare()
-    try engine.start()
+    do {
+      try engine.start()
+    } catch {
+      inputNode.removeTap(onBus: 0)
+      self.converter = nil
+      throw error
+    }
     self.engine = engine
+    configurationChangeObserver = NotificationCenter.default.addObserver(
+      forName: .AVAudioEngineConfigurationChange,
+      object: engine,
+      queue: .main
+    ) { [weak self] _ in
+      self?.handleConfigurationChange()
+    }
     logger.notice(
-      "Capture engine armed reason=\(reason) sampleRate=\(String(format: "%.0f", inputFormat.sampleRate))Hz ringBuffer=\(String(format: "%.2f", SuperFastCaptureConstants.ringBufferDuration))s defaultPreRoll=\(String(format: "%.2f", SuperFastCaptureConstants.defaultPreRollDuration))s"
+      "Capture engine armed reason=\(reason) sampleRate=\(String(format: "%.0f", inputFormat.sampleRate))Hz channels=\(inputFormat.channelCount) ringBuffer=\(String(format: "%.2f", SuperFastCaptureConstants.ringBufferDuration))s defaultPreRoll=\(String(format: "%.2f", SuperFastCaptureConstants.defaultPreRollDuration))s"
     )
   }
 
@@ -207,6 +229,10 @@ final class SuperFastCaptureController {
     if let inputNode = engine?.inputNode {
       inputNode.removeTap(onBus: 0)
     }
+    if let configurationChangeObserver {
+      NotificationCenter.default.removeObserver(configurationChangeObserver)
+      self.configurationChangeObserver = nil
+    }
     engine?.stop()
     engine = nil
     converter = nil
@@ -220,6 +246,11 @@ final class SuperFastCaptureController {
     }
   }
 
+  private func handleConfigurationChange() {
+    logger.notice("Capture engine configuration changed")
+    onEngineConfigurationChange()
+  }
+
   func beginRecording(to url: URL, requestedAt: Date = Date(), mode: CaptureRecordingMode) throws {
     try startIfNeeded(reason: "begin-recording", keepWarmBuffer: mode.keepsWarmBuffer)
 
```

---

### Incident Patch 12: `d4c45d52` (2026-04-01)
**Commit Message**: Merge pull request #200 from fitchmultz/fix/sound-effects-engine-lifecycle

Avoid priming sound effects when disabled

**File**: `.changeset/silent-lamps-prove.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Stop priming the sound-effects audio engine when sound effects are disabled so Hex avoids unnecessary background audio activity and sleep assertions (#200).
```

**File**: `Hex/App/HexAppDelegate.swift` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ class HexAppDelegate: NSObject, NSApplicationDelegate {
 
 		Task {
 			await soundEffect.preloadSounds()
+			await soundEffect.setEnabled(hexSettings.soundEffectsEnabled)
 		}
 		launchedAtLogin = wasLaunchedAtLogin()
 		appLogger.info("Application did finish launching")
```

**File**: `Hex/Clients/SoundEffect.swift` (modified, +41/-12)
```diff
@@ -35,6 +35,7 @@ public struct SoundEffectsClient {
   public var stop: @Sendable (SoundEffect) -> Void
   public var stopAll: @Sendable () -> Void
   public var preloadSounds: @Sendable () async -> Void
+  public var setEnabled: @Sendable (Bool) async -> Void
 }
 
 extension SoundEffectsClient: DependencyKey {
@@ -52,6 +53,9 @@ extension SoundEffectsClient: DependencyKey {
       },
       preloadSounds: {
         await live.preloadSounds()
+      },
+      setEnabled: { enabled in
+        await live.setEnabled(enabled)
       }
     )
   }
@@ -75,17 +79,17 @@ actor SoundEffectsClientLive {
   private var isEngineRunning = false
 
   func play(_ soundEffect: SoundEffect) {
-	guard hexSettings.soundEffectsEnabled else { return }
-	guard let player = playerNodes[soundEffect], let buffer = audioBuffers[soundEffect] else {
-		logger.error("Requested sound \(soundEffect.rawValue) not preloaded")
-		return
-	}
-	prepareEngineIfNeeded()
-	let clampedVolume = min(max(hexSettings.soundEffectsVolume, 0), baselineVolume)
-	player.volume = Float(clampedVolume)
-	player.stop()
-	player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
-	player.play()
+    guard hexSettings.soundEffectsEnabled else { return }
+    guard let player = playerNodes[soundEffect], let buffer = audioBuffers[soundEffect] else {
+      logger.error("Requested sound \(soundEffect.rawValue) not preloaded")
+      return
+    }
+    prepareEngineIfNeeded()
+    let clampedVolume = min(max(hexSettings.soundEffectsVolume, 0), baselineVolume)
+    player.volume = Float(clampedVolume)
+    player.stop()
+    player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
+    player.play()
   }
 
   func stop(_ soundEffect: SoundEffect) {
@@ -102,11 +106,21 @@ actor SoundEffectsClientLive {
     for soundEffect in SoundEffect.allCases {
       loadSound(soundEffect)
     }
-    prepareEngineIfNeeded()
 
     isSetup = true
   }
 
+  func setEnabled(_: Bool) async {
+    await preloadSounds()
+
+    if hexSettings.soundEffectsEnabled {
+      prepareEngineIfNeeded()
+    } else {
+      stopAll()
+      stopEngineIfNeeded()
+    }
+  }
+
   private var isSetup = false
 
   private func loadSound(_ soundEffect: SoundEffect) {
@@ -136,6 +150,7 @@ actor SoundEffectsClientLive {
       logger.error("Failed to load sound \(soundEffect.rawValue): \(error.localizedDescription)")
     }
   }
+
   private func prepareEngineIfNeeded() {
     if !isEngineRunning || !engine.isRunning {
       engine.prepare()
@@ -150,4 +165,18 @@ actor SoundEffectsClientLive {
       }
     }
   }
+
+  private func stopEngineIfNeeded() {
+    guard isEngineRunning || engine.isRunning else { return }
+    engine.stop()
+    isEngineRunning = false
+  }
+
+  deinit {
+    playerNodes.values.forEach {
+      $0.stop()
+      engine.detach($0)
+    }
+    engine.stop()
+  }
 }
```

**File**: `Hex/Features/Settings/SettingsFeature.swift` (modified, +4/-1)
```diff
@@ -120,6 +120,7 @@ struct SettingsFeature {
   @Dependency(\.transcription) var transcription
   @Dependency(\.recording) var recording
   @Dependency(\.permissions) var permissions
+  @Dependency(\.soundEffects) var soundEffects
   @Dependency(\.transcriptPersistence) var transcriptPersistence
 
   private func deleteAudioEffect(for transcripts: [Transcript]) -> Effect<Action> {
@@ -499,7 +500,9 @@ struct SettingsFeature {
 
       case let .setSoundEffectsEnabled(enabled):
         state.$hexSettings.withLock { $0.soundEffectsEnabled = enabled }
-        return .none
+        return .run { _ in
+          await soundEffects.setEnabled(enabled)
+        }
 
       case let .setSoundEffectsVolume(volume):
         state.$hexSettings.withLock { $0.soundEffectsVolume = volume }
```

---

### Incident Patch 13: `dcc9d317` (2026-03-26)
**Commit Message**: Pin TCA to the Xcode 26.4 fix

Release archives were failing in swift-composable-architecture because the current pinned revision still used non-sendable writable key paths under this Xcode toolchain. Pin to upstream commit 055ca45, which contains the Xcode 26.4 compatibility fix, alongside the existing Pow pin so release builds can complete again.

Verified by resolving packages and producing a fresh Release archive at build/Hex.xcarchive.

**File**: `Hex.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -624,8 +624,8 @@
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/pointfreeco/swift-composable-architecture";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 1.23.1;
+				kind = revision;
+				revision = 055ca459ca8f413fe4b91ac1a067627f42d51fa8;
 			};
 		};
 		47E05E032D444EF800D26DA6 /* XCRemoteSwiftPackageReference "Sauce" */ = {
```

**File**: `Hex.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-2)
```diff
@@ -113,8 +113,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-composable-architecture",
       "state" : {
-        "revision" : "5b0890fabfd68a2d375d68502bc3f54a8548c494",
-        "version" : "1.23.1"
+        "revision" : "055ca459ca8f413fe4b91ac1a067627f42d51fa8"
       }
     },
     {
```

---

### Incident Patch 14: `c2e9a4da` (2026-03-26)
**Commit Message**: Pin Pow to the .pi archive fix

Release archives started failing inside Pow 1.0.5 with an ambiguous use of .pi in Anvil.swift on the current Xcode toolchain. Pin the package to upstream commit 1b4b1dd, which contains the minimal fix, so Hex can archive again without changing app behavior.

Verified by resolving packages and producing a fresh Release archive at build/Hex.xcarchive.

**File**: `Hex.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -600,8 +600,8 @@
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/EmergeTools/Pow";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 1.0.5;
+				kind = revision;
+				revision = 1b4b1dda28c50b95f0872927ee2226fe8b58950e;
 			};
 		};
 		476BAD3C2D47E7880088C61F /* XCRemoteSwiftPackageReference "Sparkle" */ = {
```

**File**: `Hex.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-2)
```diff
@@ -42,8 +42,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/EmergeTools/Pow",
       "state" : {
-        "revision" : "a504eb6d144bcf49f4f33029a2795345cb39e6b4",
-        "version" : "1.0.5"
+        "revision" : "1b4b1dda28c50b95f0872927ee2226fe8b58950e"
       }
     },
     {
```

---

### Incident Patch 15: `7340d1eb` (2026-03-26)
**Commit Message**: Restore double-tap lock after stale stop races

Double-tap lock could leave the UI recording after a short-recording cleanup from the first tap arrived after the second tap had already started a new session. Cancel stale cleanup work, ignore delayed capture-engine stops once a newer session exists, and add regression coverage around the reducer/client boundary. Fixes #193.

HexCore swift tests pass. App-level xcodebuild remains blocked locally by the IDESimulatorFoundation plugin failure in this Xcode install.

**File**: `.changeset/68ed4956.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"hex-app": patch
+---
+
+Restore double-tap lock audio capture (#193)
```

**File**: `Hex.xcodeproj/project.pbxproj` (modified, +15/-0)
```diff
@@ -7,6 +7,8 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		4F0D6A012F1A000100000001 /* HexCore in Frameworks */ = {isa = PBXBuildFile; productRef = 476316262E5FB31400913CDE /* HexCore */; };
+		4F0D6A022F1A000100000001 /* ComposableArchitecture in Frameworks */ = {isa = PBXBuildFile; productRef = 47E05E012D444EE900D26DA6 /* ComposableArchitecture */; };
 		47512ABF2E14D8C9000E25BA /* WhisperKit in Frameworks */ = {isa = PBXBuildFile; productRef = 47512ABE2E14D8C9000E25BA /* WhisperKit */; };
 		476316272E5FB31400913CDE /* HexCore in Frameworks */ = {isa = PBXBuildFile; productRef = 476316262E5FB31400913CDE /* HexCore */; };
 		4765045E2D45900200C7EA60 /* Pow in Frameworks */ = {isa = PBXBuildFile; productRef = 4765045D2D45900200C7EA60 /* Pow */; };
@@ -51,6 +53,11 @@
 /* End PBXFileSystemSynchronizedBuildFileExceptionSet section */
 
 /* Begin PBXFileSystemSynchronizedRootGroup section */
+		4F0D6A032F1A000100000001 /* HexTests */ = {
+			isa = PBXFileSystemSynchronizedRootGroup;
+			path = HexTests;
+			sourceTree = "<group>";
+		};
 		47E05DF02D444EC600D26DA6 /* Hex */ = {
 			isa = PBXFileSystemSynchronizedRootGroup;
 			exceptions = (
@@ -66,6 +73,8 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				4F0D6A022F1A000100000001 /* ComposableArchitecture in Frameworks */,
+				4F0D6A012F1A000100000001 /* HexCore in Frameworks */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -105,6 +114,7 @@
 				B53355FF2D7B8D4900E5F542 /* Localizable.xcstrings */,
 				B5A1C7E22E6A1C5B00AB1234 /* AppIcon.icon */,
 				47E05DF02D444EC600D26DA6 /* Hex */,
+				4F0D6A032F1A000100000001 /* HexTests */,
 				4735444F2D445936001FBCB5 /* Frameworks */,
 				47E05DEF2D444EC600D26DA6 /* Products */,
 			);
@@ -135,8 +145,13 @@
 			dependencies = (
 				478637AA2D48725900319BFA /* PBXTargetDependency */,
 			);
+			fileSystemSynchronizedGroups = (
+				4F0D6A032F1A000100000001 /* HexTests */,
+			);
 			name = HexTests;
 			packageProductDependencies = (
+				47E05E012D444EE900D26DA6 /* ComposableArchitecture */,
+				476316262E5FB31400913CDE /* HexCore */,
 			);
 			productName = HexTests;
 			productReference = 478637A52D48725900319BFA /* HexTests.xctest */;
```

**File**: `Hex/Clients/RecordingClient.swift` (modified, +21/-0)
```diff
@@ -847,6 +847,18 @@ actor RecordingClientLive {
     FileManager.default.temporaryDirectory.appendingPathComponent("hex-capture-\(UUID().uuidString).wav")
   }
 
+  private func makeIgnoredStopURL() -> URL {
+    FileManager.default.temporaryDirectory.appendingPathComponent("hex-ignored-stop-\(UUID().uuidString).wav")
+  }
+
+  nonisolated static func shouldIgnoreStopRequest(
+    snapshotSessionID: UUID?,
+    currentSessionID: UUID?
+  ) -> Bool {
+    guard let snapshotSessionID else { return false }
+    return currentSessionID != snapshotSessionID
+  }
+
   private func ensureCaptureControllerReady(
     for deviceID: AudioDeviceID?,
     reason: String,
@@ -1131,6 +1143,7 @@ actor RecordingClientLive {
   }
 
   func stopRecording() async -> URL {
+    let stopSessionID = recordingSessionID
     let activeSession = activeRecordingSession
 
     if activeSession?.backend == .captureEngine || captureController.isRecording {
@@ -1139,6 +1152,14 @@ actor RecordingClientLive {
         "Waiting \(self.formatDuration(stopTimingEstimate.gracePeriod)) before finalizing capture-engine recording callbackInterval=\(self.formatDuration(stopTimingEstimate.callbackInterval)) bufferDuration=\(self.formatDuration(stopTimingEstimate.bufferDuration))"
       )
       try? await Task.sleep(for: .milliseconds(Int((stopTimingEstimate.gracePeriod * 1000).rounded())))
+
+      if Self.shouldIgnoreStopRequest(
+        snapshotSessionID: stopSessionID,
+        currentSessionID: recordingSessionID
+      ) {
+        recordingLogger.notice("Ignoring stale stop request after a newer recording session started")
+        return makeIgnoredStopURL()
+      }
     }
 
     if let captureURL = captureController.finishRecording(clearBuffer: currentCaptureMode() == .superFast) {
```

**File**: `Hex/Features/Transcription/TranscriptionFeature.swift` (modified, +19/-8)
```diff
@@ -59,6 +59,7 @@ struct TranscriptionFeature {
 
   enum CancelID {
     case metering
+    case recordingCleanup
     case transcription
   }
 
@@ -285,7 +286,7 @@ private extension TranscriptionFeature {
       )
     }
     state.isRecording = true
-    let startTime = Date()
+    let startTime = now
     state.recordingStartTime = startTime
     
     // Capture the active application
@@ -296,15 +297,18 @@ private extension TranscriptionFeature {
     transcriptionFeatureLogger.notice("Recording started at \(startTime.ISO8601Format())")
 
     // Prevent system sleep during recording
-    return .run { [sleepManagement, preventSleep = state.hexSettings.preventSystemSleep] send in
-      // Play sound immediately for instant feedback
-      soundEffect.play(.startRecording)
+    return .merge(
+      .cancel(id: CancelID.recordingCleanup),
+      .run { [sleepManagement, preventSleep = state.hexSettings.preventSystemSleep] _ in
+        // Play sound immediately for instant feedback
+        soundEffect.play(.startRecording)
 
-      if preventSleep {
-        await sleepManagement.preventSleep(reason: "Hex Voice Recording")
+        if preventSleep {
+          await sleepManagement.preventSleep(reason: "Hex Voice Recording")
+        }
+        await recording.startRecording()
       }
-      await recording.startRecording()
-    }
+    )
   }
 
   func handleStopRecording(_ state: inout State) -> Effect<Action> {
@@ -337,8 +341,10 @@ private extension TranscriptionFeature {
       transcriptionFeatureLogger.notice("Discarding short recording per decision \(String(describing: decision))")
       return .run { _ in
         let url = await recording.stopRecording()
+        guard !Task.isCancelled else { return }
         try? FileManager.default.removeItem(at: url)
       }
+      .cancellable(id: CancelID.recordingCleanup, cancelInFlight: true)
     }
 
     // Otherwise, proceed to transcription
@@ -356,6 +362,7 @@ private extension TranscriptionFeature {
       var audioURL: URL?
       do {
         let capturedURL = await recording.stopRecording()
+        guard !Task.isCancelled else { return }
         soundEffect.play(.stopRecording)
         audioURL = capturedURL
 
@@ -532,9 +539,11 @@ private extension TranscriptionFeature {
         await sleepManagement.allowSleep()
         // Stop the recording to release microphone access
         let url = await recording.stopRecording()
+        guard !Task.isCancelled else { return }
         try? FileManager.default.removeItem(at: url)
         soundEffect.play(.cancel)
       }
+      .cancellable(id: CancelID.recordingCleanup, cancelInFlight: true)
     )
   }
 
@@ -547,8 +556,10 @@ private extension TranscriptionFeature {
       // Allow system to sleep again
       await sleepManagement.allowSleep()
       let url = await recording.stopRecording()
+      guard !Task.isCancelled else { return }
       try? FileManager.default.removeItem(at: url)
     }
+    .cancellable(id: CancelID.recordingCleanup, cancelInFlight: true)
   }
 }
 
```

**File**: `HexTests/RecordingRaceTests.swift` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+import AppKit
+import ComposableArchitecture
+import Foundation
+import Testing
+
+@testable import Hex
+
+@Suite(.serialized)
+@MainActor
+struct RecordingRaceTests {
+  @Test
+  func newRecordingCancelsPendingDiscardCleanup() async throws {
+    let now = Date(timeIntervalSince1970: 1_234)
+    let activeApp = NSWorkspace.shared.frontmostApplication
+    let stopURL = FileManager.default.temporaryDirectory
+      .appendingPathComponent("discard-cleanup-\(UUID().uuidString).wav")
+    let created = FileManager.default.createFile(
+      atPath: stopURL.path,
+      contents: Data("test".utf8)
+    )
+    #expect(created)
+    defer { try? FileManager.default.removeItem(at: stopURL) }
+
+    let probe = RecordingProbe(stopURL: stopURL)
+    let store = TestStore(initialState: Self.makeState()) {
+      TranscriptionFeature()
+    } withDependencies: {
+      $0.date.now = now
+      $0.recording.startRecording = {
+        await probe.recordStart()
+      }
+      $0.recording.stopRecording = {
+        await probe.beginStop()
+      }
+      $0.sleepManagement.preventSleep = { _ in }
+      $0.sleepManagement.allowSleep = {}
+      $0.soundEffects.play = { _ in }
+    }
+
+    await store.send(.startRecording) {
+      $0.isRecording = true
+      $0.recordingStartTime = now
+      $0.sourceAppBundleID = activeApp?.bundleIdentifier
+      $0.sourceAppName = activeApp?.localizedName
+    }
+    await store.send(.discard) {
+      $0.isRecording = false
+      $0.isPrewarming = false
+    }
+
+    await probe.waitForPendingStop()
+
+    await store.send(.startRecording) {
+      $0.isRecording = true
+      $0.recordingStartTime = now
+      $0.sourceAppBundleID = activeApp?.bundleIdentifier
+      $0.sourceAppName = activeApp?.localizedName
+    }
+
+    await probe.resumePendingStop()
+    await store.finish()
+
+    let counts = await probe.counts()
+    #expect(counts.startCalls == 2)
+    #expect(counts.stopCalls == 1)
+    #expect(FileManager.default.fileExists(atPath: stopURL.path))
+  }
+
+  @Test
+  func stopGuardIgnoresOnlyStaleSessions() {
+    let currentSessionID = UUID()
+
+    #expect(
+      RecordingClientLive.shouldIgnoreStopRequest(
+        snapshotSessionID: currentSessionID,
+        currentSessionID: currentSessionID
+      ) == false
+    )
+    #expect(
+      RecordingClientLive.shouldIgnoreStopRequest(
+        snapshotSessionID: nil,
+        currentSessionID: currentSessionID
+      ) == false
+    )
+    #expect(
+      RecordingClientLive.shouldIgnoreStopRequest(
+        snapshotSessionID: currentSessionID,
+        currentSessionID: UUID()
+      )
+    )
+  }
+
+  private static func makeState() -> TranscriptionFeature.State {
+    TranscriptionFeature.State(
+      hexSettings: Shared(.init()),
+      isRemappingScratchpadFocused: Shared(false),
+      modelBootstrapState: Shared(.init(isModelReady: true)),
+      transcriptionHistory: Shared(.init())
+    )
+  }
+}
+
+private actor RecordingProbe {
+  private let stopURL: URL
+  private var startCalls = 0
+  private var stopCalls = 0
+  private var stopContinuation: CheckedContinuation<URL, Never>?
+
+  init(stopURL: URL) {
+    self.stopURL = stopURL
+  }
+
+  func recordStart() {
+    startCalls += 1
+  }
+
+  func beginStop() async -> URL {
+    stopCalls += 1
+    return await withCheckedContinuation { continuation in
+      stopContinuation = continuation
+    }
+  }
+
+  func waitForPendingStop() async {
+    while stopContinuation == nil {
+      await Task.yield()
+    }
+  }
+
+  func resumePendingStop() {
+    stopContinuation?.resume(returning: stopURL)
+    stopContinuation = nil
+  }
+
+  func counts() -> (startCalls: Int, stopCalls: Int) {
+    (startCalls, stopCalls)
+  }
+}
```

#### Recent Merged Pull Requests:
- **PR #283** (closed): Add Escape behavior setting so ESC never destroys a take (@ignoxx)
- **PR #276** (closed): Add option to remove only trailing punctuation (@sddamico)
- **PR #274** (closed): feat: switch refinement models from menu bar (@blackforestboi)
- **PR #273** (closed): Add Parallel Mode transcription with Settings UI toggle and ~/Documents model discovery (@gauravsaini)
- **PR #266** (closed): Prevent hotkey monitor startup crash (@buffpesos)
- **PR #253** (2026-07-08): Add lowercase and punctuation paste transforms (@R44VC0RP)
- **PR #249** (closed): fix(ios): recover Flow Session audio engine after interruptions (@conglei)
- **PR #248** (closed): Add Pronunciation Coach (HexCoach) (@conglei)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
