> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source**: github ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Source Version**: `5919d349`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T04:33:51.799Z  
> **Learning ID**: `learn-github-jacklandrin-onlyswitch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): jacklandrin/OnlySwitch

> **Canonical Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T04:33:51.562Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: 👑 The all-in-one macOS menu bar companion: customizable controls, system monitor, AI Agent, Shortcuts, widgets, remote control, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6043 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Modules/Sources/DesktopPet/DesktopPetPomodoroState.swift`
```
public enum DesktopPetPomodoroPhase: Equatable, Sendable {
    case focus
    case breakTime
}

public struct DesktopPetPomodoroState: Equatable, Sendable {
    public let phase: DesktopPetPomodoroPhase
    public let remainingTime: String

    public init(phase: DesktopPetPomodoroPhase, remainingTime: String) {
        self.phase = phase
        self.remainingTime = remainingTime
    }
}

```

### Core Architecture Module: `Modules/Sources/DisplayBrightness/BrightnessNativeSyncState.swift`
```
/// Tracks observed native changes separately from our own writes and invalidates overlapping sync passes.
public struct BrightnessNativeSyncState: Sendable {
    private static let tolerance = 0.004
    private var revision: UInt64 = 0
    private var previous: [UInt32: Double] = [:]
    private var expectedReadbacks: [UInt32: Double] = [:]
    public init() {}
    public mutating func beginCycle() -> UInt64 { revision &+= 1; return revision }
    public func isCurrent(_ candidate: UInt64) -> Bool { candidate == revision }
    public mutating func recordOwnWrite(id: UInt32, level: Double, readback: Double? = nil) {
        let sampled = readback ?? level
        previous[id] = sampled
        // A read immediately after Set may still report the old value. Accept the requested
        // value as our own echo on the next poll too, without masking later user changes.
        expectedReadbacks[id] = abs(sampled - level) > Self.tolerance ? level : nil
    }
    public mutating func observe(id: UInt32, level: Double) -> Bool {
        guard level.isFinite else { return false }
        let expected = expectedReadbacks.removeValue(forKey: id)
        guard let old = previous[id] else { previous[id] = level; return false }
        guard abs(old - level) > Self.tolerance else { return false }
        previous[id] = level
        return expected.map { abs($0 - level) > Self.tolerance } ?? true
    }

    public mutating func observeChanges(
        _ readings: [(display: BrightnessDisplay, level: Double)]
    ) -> (id: UInt32, level: Double)? {
        let changes = readings.filter {
            $0.display.control == .native && observe(id: $0.display.id, level: $0.level)
        }
        return Self.preferredSource(in: changes)
    }

    public static func preferredSource(
        in readings: [(display: BrightnessDisplay, level: Double)]
    ) -> (id: UInt32, level: Double)? {
        let source = readings.lazy.filter { $0.display.control == .native && $0.level.isFinite }.min {
            if $0.display.isBuiltIn != $1.display.isBuiltIn { return $0.display.isBuiltIn }
            return $0.display.id < $1.display.id
        }
        return source.map { ($0.display.id, $0.level) }
    }

    public static func targets(in displays: [BrightnessDisplay], excluding sourceID: UInt32) -> [BrightnessDisplay] {
        displays.filter { !$0.isBuiltIn && $0.id != sourceID && $0.control != .unavailable }
    }

    public mutating func invalidate() {
        revision &+= 1
        previous.removeAll()
        expectedReadbacks.removeAll()
    }
}

```

### Core Architecture Module: `Modules/Sources/OnlyAgent/Observation/StateObserver.swift`
```
//
//  StateObserver.swift
//  Modules
//
//  Created by Bo Liu on 18.11.25.
//

import Foundation
import AppKit

@available(macOS 26.0, *)
@MainActor
public final class StateObserver {
    public static let shared = StateObserver()
    
    private init() {}
    
    public func captureSystemState() -> SystemState {
        let runningApps = getRunningApplications()
        let activeWindows = getActiveWindows()
        let fileChanges: [String] = [] // Can be enhanced with file system monitoring
        let systemSettings: [String: String] = [:] // Can be enhanced with settings monitoring
        
        return SystemState(
            runningApplications: runningApps,
            activeWindows: activeWindows,
            recentFileChanges: fileChanges,
            systemSettings: systemSettings,
            timestamp: Date()
        )
    }
    
    public func compareStates(before: SystemState, after: SystemState) -> StateDiff {
        let newApps = Set(after.runningApplications).subtracting(before.runningApplications)
        let closedApps = Set(before.runningApplications).subtracting(after.runningApplications)
        let newWindows = Set(after.activeWindows).subtracting(before.activeWindows)
        let closedWindows = Set(before.activeWindows).subtracting(after.activeWindows)
        let fileChanges = Set(after.recentFileChanges).subtracting(before.recentFileChanges)
        
        var settingChanges: [String: String] = [:]
        for (key, value) in after.systemSettings {
            if before.systemSettings[key] != value {
                settingChanges[key] = value
            }
        }
        
        return StateDiff(
            newApplications: Array(newApps),
            closedApplications: Array(closedApps),
            newWindows: Array(newWindows),
            closedWindows: Array(closedWindows),
            fileChanges: Array(fileChanges),
            settingChanges: settingChanges
        )
    }
    
    private func getRunningApplications() -> [String] {
        let workspace = NSWorkspace.shared
        return workspace.runningApplications.compactMap { app in
            app.localizedName
        }
    }
    
    private func getActiveWindows() -> [String] {
        var windowNames: [String] = []
        let workspace = NSWorkspace.shared
        for app in workspace.runningApplications {
            if let name = app.localizedName {
                windowNames.append(name)
            }
        }
        return windowNames
    }
}

```

### Core Architecture Module: `Modules/Sources/OnlyControl/ControlItemViewState.swift`
```
//
//  ControlItemReducer.swift
//
//
//  Created by Jacklandrin on 2024/8/24.
//

import AppKit
import Foundation
import Switches
import Defines

public struct ControlItemViewState: Equatable, Hashable, Identifiable {
    public var id: String
    public var title: String
    public var subtitle: String?
    public var copyableSubtitle: Bool
    public var detail: ControlItemDetail?
    public var weight: Int
    public var unitType: UnitType
    public var status: Bool
    public var iconData: Data
    var controlType: ControlType
    var opacity: Double = 1

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        copyableSubtitle: Bool = false,
        detail: ControlItemDetail? = nil,
        iconData: Data,
        controlType: ControlType,
        status: Bool = false,
        weight: Int = 0,
        unitType: UnitType = .builtIn
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.copyableSubtitle = copyableSubtitle
        self.detail = detail
        self.iconData = iconData
        self.controlType = controlType
        self.status = status
        self.weight = weight
        self.unitType = unitType
    }

    public var interaction: ControlItemInteraction {
        detail.map(ControlItemInteraction.presentDetail) ?? .performControl
    }

    /// Shortcut icons are user-provided artwork, rather than glyphs. Preserve their
    /// original colors instead of applying the tile tint as a template image.
    public var usesTemplateIconRendering: Bool {
        unitType != .shortcuts
    }
}

public extension ControlItemViewState {
    static func preview(id: String = "") -> Self {
        .init(
            id: id,
            title: "Long Long Control Item",
            iconData: NSImage(systemSymbolName: "gear")
                .resizeMaintainingAspectRatio(withSize: NSSize(width: 50, height: 50))!
                .pngData!,
            controlType: .Switch
        )
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/AphroditeRemoteModels.swift`
```
import Foundation
#if canImport(FoundationXML)
import FoundationXML
#endif

public enum AphroditeRemoteHTMLValidator {
    public static let maximumDocumentBytes = 1_048_576
    public static func validated(_ html: String) -> String? {
        guard html.utf8.count <= maximumDocumentBytes else { return nil }
        let trimmed = html.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let expression = try? NSRegularExpression(pattern: #"(?is)^\s*(?:<!doctype\s+html[^>]*>\s*)?<html\b[^>]*>.*</html>\s*$"#),
              expression.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) != nil else { return nil }
        return trimmed
    }
}

public enum AphroditeRemoteSVGValidator {
    public static let maximumBytes = 32_768
    public static func validated(_ svg: String) -> String? {
        let candidate = svg.trimmingCharacters(in: .whitespacesAndNewlines)
        guard candidate.isEmpty == false, candidate.utf8.count <= maximumBytes,
              candidate.contains("<!") == false, candidate.contains("<?") == false else { return nil }
        let delegate = AphroditeRemoteSVGValidationDelegate()
        let parser = XMLParser(data: Data(candidate.utf8))
        parser.shouldProcessNamespaces = false
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        return parser.parse() && delegate.isValid ? candidate : nil
    }
}

private final class AphroditeRemoteSVGValidationDelegate: NSObject, XMLParserDelegate {
    private static let containers: Set<String> = ["svg", "g", "defs", "linearGradient", "radialGradient"]
    private static let shapes: Set<String> = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]
    private static let elements = containers.union(shapes).union(["stop"])
    private static let numericAttributes: Set<String> = ["width", "height", "x", "y", "rx", "ry", "cx", "cy", "r", "fx", "fy", "x1", "y1", "x2", "y2", "stroke-width"]
    private static let opacityAttributes: Set<String> = ["opacity", "fill-opacity", "stroke-opacity", "stop-opacity"]
    private static let numberPattern = #"[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?"#
    private static let idPattern = #"[A-Za-z_][A-Za-z0-9_.-]*"#
    private static let numberExpression = try! NSRegularExpression(pattern: numberPattern)
    private(set) var isValid = true
    private var depth = 0, elementCount = 0, visibleShapeCount = 0, nonRenderingDepth = 0, pathDataLength = 0, numberCount = 0

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
        guard isValid else { parser.abortParsing(); return }
        depth += 1; elementCount += 1
        guard depth <= 64, elementCount <= 256, Self.elements.contains(name) else { reject(parser); return }
        if elementCount == 1 {
            guard name == "svg", attributes["xmlns"] == "http://www.w3.org/2000/svg", attributes["viewBox"].map(validViewBox) == true else { reject(parser); return }
        } else if name == "svg" { reject(parser); return }
        guard attributes.allSatisfy({ validAttribute(name: $0.key, value: $0.value, element: name, isRoot: elementCount == 1) }) else { reject(parser); return }
        if Self.shapes.contains(name), nonRenderingDepth == 0 { visibleShapeCount += 1 }
        if ["defs", "linearGradient", "radialGradient"].contains(name) { nonRenderingDepth += 1 }
    }
    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        if ["defs", "linearGradient", "radialGradient"].contains(name) { nonRenderingDepth -= 1 }; depth -= 1
    }
    func parserDidEndDocument(_ parser: XMLParser) { isValid = depth == 0 && visibleShapeCount > 0 }
    func parser(_ parser: XMLParser, parseErrorOccurred: Error) { isValid = false }
    func parser(_ parser: XMLParser, validationErrorOccurred: Error) { isValid = false }
    func parser(_ parser: XMLParser, foundProcessingInstructionWithTarget: String, data: String?) { reject(parser) }
    func parser(_ parser: XMLParser, foundExternalEntityDeclarationWithName: String, publicID: String?, systemID: String?) { reject(parser) }
    func parser(_ parser: XMLParser, foundInternalEntityDeclarationWithName: String, value: String?) { reject(parser) }
    private func validAttribute(name: String, value: String, element: String, isRoot: Bool) -> Bool {
        switch name {
        case "xmlns": isRoot && value == "http://www.w3.org/2000/svg"
        case "viewBox": isRoot && validViewBox(value)
        case "id": matches(value, Self.idPattern)
        case let key where Self.numericAttributes.contains(key): validNumber(value)
        case let key where Self.opacityAttributes.contains(key): validNumber(value) && (parsedNumbers(value).first.map { (0...1).contains($0) } ?? false)
        case "offset": value.hasSuffix("%") ? (Double(value.dropLast()).map { (0...100).contains($0) } ?? false) : (validNumber(value) && (parsedNumbers(value).first.map { (0...1).contains($0) } ?? false))
        case "fill", "stroke", "stop-color": value == "none" || matches(value, #"#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})"#) || matches(value, #"url\(#[A-Za-z_][A-Za-z0-9_.-]*\)"#)
        case "stroke-linecap": ["butt", "round", "square"].contains(value)
        case "stroke-linejoin": ["miter", "round", "bevel"].contains(value)
        case "transform", "gradientTransform": matches(value, #"(?:(?:matrix|translate|scale|rotate)\(\s*"# + Self.numberPattern + #"(?:\s*(?:,|\s)\s*"# + Self.numberPattern + #"){0,5}\s*\)\s*)+"#) && consumeNumbers(value, maximum: 24)
        case "gradientUnits": ["objectBoundingBox", "userSpaceOnUse"].contains(value)
        case "spreadMethod": ["pad", "reflect", "repeat"].contains(value)
        case "d": element == "path" && validPath(value)
        case "points": (element == "polyline" || element == "polygon") && validPoints(value)
        default: false
        }
    }
    private func validViewBox(_ value: String) -> Bool { let v = parsedNumbers(value); return v.count == 4 && v.allSatisfy { $0.isFinite && abs($0) <= 1_000_000 } && v[2] > 0 && v[3] > 0 && v[2] <= 512 && v[3] <= 512 }
    private func validNumber(_ value: String) -> Bool { matches(value, Self.numberPattern) && (parsedNumbers(value).first.map { $0.isFinite && abs($0) <= 1_000_000 } ?? false) }
    private func validPath(_ value: String) -> Bool { pathDataLength += value.utf8.count; return pathDataLength <= 16_384 && matches(value, #"[MmLlHhVvCcSsQqTtAaZz][MmLlHhVvCcSsQqTtAaZz0-9,.+\-eE\s]*"#) && consumeNumbers(value, maximum: 2_048) }
    private func validPoints(_ value: String) -> Bool { let v = parsedNumbers(value); return v.count >= 4 && v.count.isMultiple(of: 2) && v.allSatisfy { $0.isFinite && abs($0) <= 1_000_000 } && consumeNumbers(value, maximum: 2_048) }
    private func consumeNumbers(_ value: String, maximum: Int) -> Bool { let m = Self.numberExpression.matches(in: value, range: NSRange(value.startIndex..., in: value)); let v = m.compactMap { Range($0.range, in: value).flatMap { Double(value[$0]) } }; guard v.count == m.count, v.allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }) else { return false }; numberCount += v.count; return v.count <= maximum && numberCount <= 2_048 }
    private func parsedNumbers(_ value: String) -> [Double] { guard matches(value, #"(?:"# + Self.numberPattern + #")(?:[\s,]+"# + Self.numberPattern + #")*"#) else { return [] }; return value.split(whereSeparator: { $0 == "," || $0.isWhitespace }).compactMap { Double($0) } }
    private func matches(_ value: String, _ pattern: String) -> Bool { (try? NSRegularExpression(pattern: "^(?:\(pattern))$").firstMatch(in: value, range: NSRange(value.startIndex..., in: value))) != nil }
    private func reject(_ parser: XMLParser) { isValid = false; parser.abortParsing() }
}

public enum AphroditeRemoteValidationError: Error, Equatable, Sendable {
    case invalidTitle
    case invalidHTML
    case invalidIcon
    case invalidDescriptor
    case duplicateAppID
    case invalidChunk
    case snapshotTooLarge
    case unsupportedFormatVersion
}

public struct AphroditePersonalTool: Codable, Equatable, Identifiable, Sendable {
    public static let currentFormatVersion = 1
    public static let maximumHTMLBytes = 1_048_576
    public static let maximumIconBytes = 131_072
    public static let maximumTitleCharacters = 80

    public let id: UUID
    public let title: String
    public let html: String
    public let iconSVG: String?
    public let updatedAt: Date
    public let formatVersion: Int

    public init(id: UUID, title: String, html: String, iconSVG: String? = nil, updatedAt: Date) throws {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard title.isEmpty == false, title.count <= Self.maximumTitleCharacters else {
            throw AphroditeRemoteValidationError.invalidTitle
        }
        guard html.utf8.count <= Self.maximumHTMLBytes,
              let html = AphroditeRemoteHTMLValidator.validated(html) else {
            throw AphroditeRemoteValidationError.invalidHTML
        }
        let validatedIcon = iconSVG.flatMap(AphroditeRemoteSVGValidator.validated)
        if iconSVG != nil, validatedIcon == nil {
            throw AphroditeRemoteValidationError.invalidIcon
        }
        self.id = id
        self.title = title
        self.html = html
        self.iconSVG = validatedIcon
        self.updatedAt = updatedAt
        self.formatVersion = Self.currentFormatVersion
    }

    public init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        guard try values.decode(Int.self, forKey: .formatVersion) == Self.currentFormatVersion else {
            throw AphroditeRemoteValidationError.unsupportedFormatVersion
        }
        try self.init(
            id: values.decode(UUID.self, forKey: .id),
            t
```

### Core Architecture Module: `Modules/Sources/RemoteCore/ClaudeUsageModels.swift`
```
import Foundation
public struct RemoteClaudeUsageRequest: Codable, Equatable, Sendable {
    public let requestID: UUID
    public init(requestID: UUID) {
        self.requestID = requestID
    }
}

public struct ClaudeUsageAccountDTO: Codable, Equatable, Sendable {
    public let email: String?
    public let plan: String?
    public init(email: String?, plan: String?) {
        self.email = email
        self.plan = plan
    }
}

public struct ClaudeQuotaWindowDTO: Codable, Equatable, Sendable {
    public let remainingPercent: Int
    public let resetAt: Date?
    public init(remainingPercent: Int, resetAt: Date?) {
        self.remainingPercent = min(max(remainingPercent, 0), 100)
        self.resetAt = resetAt
    }
}

public struct ClaudeModelUsageDTO: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let quota: ClaudeQuotaWindowDTO
    public init(id: String, name: String, quota: ClaudeQuotaWindowDTO) {
        self.id = id
        self.name = name
        self.quota = quota
    }
}

public struct ClaudeExtraUsageDTO: Codable, Equatable, Sendable {
    public let isEnabled: Bool
    public let used: Double?
    public let limit: Double?
    public let currency: String?
    public let utilization: Double?
    public init(isEnabled: Bool, used: Double?, limit: Double?, currency: String?, utilization: Double?) {
        self.isEnabled = isEnabled
        self.used = used
        self.limit = limit
        self.currency = currency
        self.utilization = utilization
    }
}

public struct RemoteClaudeUsageSnapshot: Codable, Equatable, Sendable {
    public let account: ClaudeUsageAccountDTO
    public let session: ClaudeQuotaWindowDTO?
    public let weekly: ClaudeQuotaWindowDTO?
    public let models: [ClaudeModelUsageDTO]
    public let extraUsage: ClaudeExtraUsageDTO?
    public let fetchedAt: Date
    public init(account: ClaudeUsageAccountDTO, session: ClaudeQuotaWindowDTO?, weekly: ClaudeQuotaWindowDTO?, models: [ClaudeModelUsageDTO], extraUsage: ClaudeExtraUsageDTO?, fetchedAt: Date) {
        self.account = account
        self.session = session
        self.weekly = weekly
        self.models = models
        self.extraUsage = extraUsage
        self.fetchedAt = fetchedAt
    }
}

public struct RemoteClaudeUsageResult: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let result: Result<RemoteClaudeUsageSnapshot, RemoteProtocolError>
    public init(requestID: UUID, result: Result<RemoteClaudeUsageSnapshot, RemoteProtocolError>) {
        self.requestID = requestID; self.result = result
    }
    private enum CodingKeys: String, CodingKey { case requestID, success, failure }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        requestID = try container.decode(UUID.self, forKey: .requestID)
        let hasSuccess = container.contains(.success), hasFailure = container.contains(.failure)
        guard hasSuccess != hasFailure else {
            throw DecodingError.dataCorruptedError(forKey: .success, in: container, debugDescription: "Result must contain exactly one of success or failure.")
        }
        result = hasSuccess
            ? .success(try container.decode(RemoteClaudeUsageSnapshot.self, forKey: .success))
            : .failure(try container.decode(RemoteProtocolError.self, forKey: .failure))
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestID, forKey: .requestID)
        switch result {
        case let .success(value): try container.encode(value, forKey: .success)
        case let .failure(error): try container.encode(error, forKey: .failure)
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/CodexUsageModels.swift`
```
import Foundation

public struct RemoteCodexUsageRequest: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let includeLocalActivity: Bool
    public init(requestID: UUID, includeLocalActivity: Bool) {
        self.requestID = requestID
        self.includeLocalActivity = includeLocalActivity
    }
}

public struct CodexUsageAccountDTO: Codable, Equatable, Sendable {
    public let email: String?
    public let plan: String?
    public init(email: String?, plan: String?) { self.email = email; self.plan = plan }
}

public struct CodexQuotaWindowDTO: Codable, Equatable, Sendable {
    public let remainingPercent: Int
    public let resetAt: Date?
    public init(remainingPercent: Int, resetAt: Date?) {
        self.remainingPercent = min(max(remainingPercent, 0), 100)
        self.resetAt = resetAt
    }
}

public enum CodexResetCreditsDTO: Codable, Equatable, Sendable {
    case unavailable
    case unlimited
    case available(count: Int, expiresAt: Date?)
}

public enum CodexCreditBalanceDTO: Codable, Equatable, Sendable {
    case unavailable
    case unlimited
    case available(remaining: Double, limit: Double?, unit: String)
}

public enum CodexUsageSourceDTO: String, Codable, Equatable, Sendable { case oauth, cli }

public struct CodexDailyUsageDTO: Codable, Equatable, Sendable, Identifiable {
    public let date: Date
    public let tokenCount: Int
    public var id: Date { date }
    public init(date: Date, tokenCount: Int) { self.date = date; self.tokenCount = tokenCount }
}

public struct CodexActivityEstimateDTO: Codable, Equatable, Sendable {
    public let dailyUsage: [CodexDailyUsageDTO]
    public let isPartial: Bool
    public init(dailyUsage: [CodexDailyUsageDTO], isPartial: Bool) {
        self.dailyUsage = dailyUsage; self.isPartial = isPartial
    }
}

public struct RemoteCodexUsageSnapshot: Codable, Equatable, Sendable {
    public let account: CodexUsageAccountDTO
    public let session: CodexQuotaWindowDTO?
    public let weekly: CodexQuotaWindowDTO?
    public let resetCredits: CodexResetCreditsDTO
    public let creditBalance: CodexCreditBalanceDTO
    public let source: CodexUsageSourceDTO
    public let fetchedAt: Date
    public let activity: CodexActivityEstimateDTO?
    public init(account: CodexUsageAccountDTO, session: CodexQuotaWindowDTO?, weekly: CodexQuotaWindowDTO?, resetCredits: CodexResetCreditsDTO, creditBalance: CodexCreditBalanceDTO, source: CodexUsageSourceDTO, fetchedAt: Date, activity: CodexActivityEstimateDTO?) {
        self.account = account; self.session = session; self.weekly = weekly
        self.resetCredits = resetCredits; self.creditBalance = creditBalance
        self.source = source; self.fetchedAt = fetchedAt; self.activity = activity
    }
}

public struct RemoteCodexUsageResult: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let result: Result<RemoteCodexUsageSnapshot, RemoteProtocolError>
    public init(requestID: UUID, result: Result<RemoteCodexUsageSnapshot, RemoteProtocolError>) {
        self.requestID = requestID; self.result = result
    }
    private enum CodingKeys: String, CodingKey { case requestID, success, failure }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        requestID = try container.decode(UUID.self, forKey: .requestID)
        let hasSuccess = container.contains(.success), hasFailure = container.contains(.failure)
        guard hasSuccess != hasFailure else {
            throw DecodingError.dataCorruptedError(forKey: .success, in: container, debugDescription: "Result must contain exactly one of success or failure.")
        }
        result = hasSuccess
            ? .success(try container.decode(RemoteCodexUsageSnapshot.self, forKey: .success))
            : .failure(try container.decode(RemoteProtocolError.self, forKey: .failure))
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestID, forKey: .requestID)
        switch result {
        case let .success(value): try container.encode(value, forKey: .success)
        case let .failure(error): try container.encode(error, forKey: .failure)
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteAction.swift`
```
import Foundation

public enum RemoteControlAction: Codable, Equatable, Sendable {
    case setState(Bool)
    case trigger

    private enum CodingKeys: String, CodingKey {
        case type
        case value
    }

    private enum Kind: String, Codable {
        case setState
        case trigger
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .type) {
        case .setState:
            self = .setState(try container.decode(Bool.self, forKey: .value))
        case .trigger:
            self = .trigger
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .setState(isOn):
            try container.encode(Kind.setState, forKey: .type)
            try container.encode(isOn, forKey: .value)
        case .trigger:
            try container.encode(Kind.trigger, forKey: .type)
        }
    }
}

public struct RemoteActionRequest: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let controlID: RemoteControlID
    public let action: RemoteControlAction

    public init(requestID: UUID, controlID: RemoteControlID, action: RemoteControlAction) {
        self.requestID = requestID
        self.controlID = controlID
        self.action = action
    }
}

public struct RemoteActionResult: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let result: Result<RemoteControlStatus?, RemoteProtocolError>

    private enum CodingKeys: String, CodingKey {
        case requestID
        case success
        case failure
    }

    public init(requestID: UUID, result: Result<RemoteControlStatus?, RemoteProtocolError>) {
        self.requestID = requestID
        self.result = result
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        requestID = try container.decode(UUID.self, forKey: .requestID)

        let hasSuccess = container.contains(.success)
        let hasFailure = container.contains(.failure)
        guard hasSuccess != hasFailure else {
            throw DecodingError.dataCorruptedError(
                forKey: .success,
                in: container,
                debugDescription: "Action result must contain exactly one of success or failure."
            )
        }

        if hasSuccess {
            result = .success(try container.decodeIfPresent(RemoteControlStatus.self, forKey: .success))
        } else {
            result = .failure(try container.decode(RemoteProtocolError.self, forKey: .failure))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestID, forKey: .requestID)
        switch result {
        case let .success(status):
            try container.encodeIfPresent(status, forKey: .success)
            if status == nil {
                try container.encodeNil(forKey: .success)
            }
        case let .failure(error):
            try container.encode(error, forKey: .failure)
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteBrightness.swift`
```
import Foundation

public struct RemoteBrightnessDisplay: Codable, Equatable, Identifiable, Sendable {
    public enum Control: String, Codable, Equatable, Sendable {
        case native, ddc, software, unavailable
    }

    public let id: UInt32
    public let name: String
    public let control: Control
    /// 0...1, the user-facing level (combined hardware + software dimming).
    public let level: Double
    public let hasError: Bool

    public init(id: UInt32, name: String, control: Control, level: Double, hasError: Bool) {
        self.id = id
        self.name = String(name.prefix(120))
        self.control = control
        self.level = level.isFinite ? min(1, max(0, level)) : 1
        self.hasError = hasError
    }

    /// Unknown controls decode as `.unavailable` so a newer Mac never breaks an older client.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(UInt32.self, forKey: .id),
            name: try container.decode(String.self, forKey: .name),
            control: (try? container.decode(Control.self, forKey: .control)) ?? .unavailable,
            level: try container.decode(Double.self, forKey: .level),
            hasError: try container.decodeIfPresent(Bool.self, forKey: .hasError) ?? false
        )
    }
}

public struct RemoteBrightnessSnapshot: Codable, Equatable, Sendable {
    public let revision: UInt64
    public let displays: [RemoteBrightnessDisplay]

    public init(revision: UInt64, displays: [RemoteBrightnessDisplay]) {
        self.revision = revision
        self.displays = Array(displays.prefix(16))
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            revision: try container.decode(UInt64.self, forKey: .revision),
            displays: try container.decode([RemoteBrightnessDisplay].self, forKey: .displays)
        )
    }
}

public enum RemoteBrightnessCommand: Codable, Equatable, Sendable {
    case setLevel(displayID: UInt32, level: Double)
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlDescriptor.swift`
```
import Foundation

public struct RemoteControlDescriptor: Codable, Equatable, Identifiable, Sendable {
    public enum Behavior: String, Codable, Sendable {
        case `switch`
        case button
        case player
    }

    public enum Icon: Codable, Equatable, Sendable {
        case systemSymbol(String)
        case png(Data)

        private enum CodingKeys: String, CodingKey {
            case type
            case value
        }

        private enum Kind: String, Codable {
            case systemSymbol
            case png
        }

        public init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            switch try container.decode(Kind.self, forKey: .type) {
            case .systemSymbol:
                self = .systemSymbol(try container.decode(String.self, forKey: .value))
            case .png:
                self = .png(try container.decode(Data.self, forKey: .value))
            }
        }

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case let .systemSymbol(name):
                try container.encode(Kind.systemSymbol, forKey: .type)
                try container.encode(name, forKey: .value)
            case let .png(data):
                try container.encode(Kind.png, forKey: .type)
                try container.encode(data, forKey: .value)
            }
        }
    }

    public let id: RemoteControlID
    public let title: String
    public let behavior: Behavior
    public let icon: Icon
    public let isAvailable: Bool
    public let unavailableReason: String?
    public let isDestructive: Bool
    public let supportsStatus: Bool
    public let supportsSecondaryInformation: Bool

    public init(
        id: RemoteControlID,
        title: String,
        behavior: Behavior,
        icon: Icon,
        isAvailable: Bool,
        unavailableReason: String?,
        isDestructive: Bool,
        supportsStatus: Bool,
        supportsSecondaryInformation: Bool
    ) {
        self.id = id
        self.title = title
        self.behavior = behavior
        self.icon = icon
        self.isAvailable = isAvailable
        self.unavailableReason = unavailableReason
        self.isDestructive = isDestructive
        self.supportsStatus = supportsStatus
        self.supportsSecondaryInformation = supportsSecondaryInformation
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #37** (2022-11-24): **Radio station not working**
  *Symptoms*: Now that I finally got my media keys to work with onlyswitch radio, it seems that my favorite radio is not compatible with onlyswitch (did not occur to me to test before) :))  This is the link: http://live.radiocafe.ro:8048/live.aac  The song title is recognized, but there is no sound. Can you please advise?  Thank you very much for your support!
  **Post-Mortem & Fix Analysis**:
  > I think it's my bug. acc stream should be played automatically switch to player without sound wave effect. There's a workaround, you can turn off the sound wave effect in onlyswitch's radio setting.
  > Perfect, you are corect! Thank you! Feel free to close the issue if you don't want to tackle it (now or anytime).

- **Issue #13** (2022-01-15): **Crashes when clicking 'check for updates' button**
  *Symptoms*: On 1.8.1 (and earlier editions as well), when clicking on 'Check for updates', the app crashes.  MacOS 12.1 / M1 Mac mini  ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [9339] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               1.8.1 (30) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-09 14:54:13.6347 +0000 OS Version:            macOS 12.1 (21C52) Report Version:        12 Anonymous UUID:        6FD2585F-D562-E91A-3BB0-A9A5FE7B2407  Sleep/Wake UUID:       AADB071A-B6D0-49FB-BDC2-467129154A67  Time Awake Since Boot: 92000 seconds Time Since Wake:       6535 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001e6d2b7ac Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:    Namespace SIGNAL, Code 5 Trace/BPT trap: 5 Terminating Process:   exc handler [9339]  Thread 0 Crashed::  Dispatch queue: com.apple.main-thread 0   SwiftUI                       	       0x1e6d2b7ac validateDimension #1 (min:ideal:max:) in NSView.intrinsicLayoutTraits() + 216 1   SwiftUI                       	       0x
  **Post-Mortem & Fix Analysis**:
  > Same here with M1 Mac mini but on MacOS 12.2 Beta.  ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [26205] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               2.0 (35) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-13 18:05:31.4275 -0500 OS Version:            macOS 12.2 (21D5039d) Report Version:        12 Anonymous UUID:        EC51302F-8BF8-5E71-231C-762A4AD64A1B   Time Awake Since Boot: 180000 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001cc1d4798 Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:  
  > Same issue and solution. https://github.com/sindresorhus/Gifski/commit/ac180e4e76acaa9b230bbb401b8bb364c2f2f424

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

### Incident Patch 1: `72a3ac88` (2026-11-05)
**Commit Message**: Stop crashing when a music player quits while its state is polled

A player that quits mid-request replies with no playback state, which is
not a valid case of the bridged enum and trapped when switched on.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `OnlySwitch/Player/MusicAppPlayer/AppleMusic/AppleMusicPlayer/AppleMusicPlayer.swift` (modified, +4/-1)
```diff
@@ -64,8 +64,11 @@ extension AppleMusicPlayer:MusicPlayer {
     }
     
     var playbackState: MusicPlaybackState {
+        // A player that quits mid-request replies with no state, which is not a valid case
+        // and would trap when switched on, so validate it through its raw value first.
         guard isRunning,
-              let playerState = applemusicApp.playerState
+              let rawState = applemusicApp.playerState?.rawValue,
+              let playerState = iTunesEPlS(rawValue: rawState)
         else { return .stopped }
         return MusicPlaybackState(playerState)
     }
```

**File**: `OnlySwitch/Player/MusicAppPlayer/Spotify/SpotifyPlayer/SpotifyPlayer.swift` (modified, +4/-1)
```diff
@@ -61,8 +61,11 @@ class SpotifyPlayer{
 
 extension SpotifyPlayer:MusicPlayer {
     var playbackState: MusicPlaybackState {
+        // A player that quits mid-request replies with no state, which is not a valid case
+        // and would trap when switched on, so validate it through its raw value first.
         guard isRunning,
-              let playerState = spotifyApp.playerState
+              let rawState = spotifyApp.playerState?.rawValue,
+              let playerState = SpotifyEPlS(rawValue: rawState)
         else { return .stopped }
         return MusicPlaybackState(playerState)
     }
```

---

### Incident Patch 2: `5919d349` (2026-11-06)
**Commit Message**: fix screenshots buttons

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 310
+CURRENT_PROJECT_VERSION = 311
```

**File**: `Modules/Sources/Screenshots/ScreenshotsView.swift` (modified, +13/-11)
```diff
@@ -364,17 +364,19 @@ private struct ScreenshotHoverButton: View {
     let action: () -> Void
 
     var body: some View {
-        Button(title, systemImage: systemImage, action: action)
-            .labelStyle(.iconOnly)
-            .font(.system(size: 11, weight: .bold))
-            .foregroundStyle(.primary)
-            .frame(width: 24, height: 24)
-            .modifier(ScreenshotHoverButtonSurface())
-            .contentShape(.circle)
-            .buttonStyle(.plain)
-            .help(title)
-            .padding(5)
-            .transition(.opacity)
+        Button(action: action) {
+            Label(title, systemImage: systemImage)
+                .labelStyle(.iconOnly)
+                .font(.system(size: 11, weight: .bold))
+                .foregroundStyle(.primary)
+                .frame(width: 24, height: 24)
+                .modifier(ScreenshotHoverButtonSurface())
+                .contentShape(.interaction, Circle())
+        }
+        .buttonStyle(.plain)
+        .help(title)
+        .padding(5)
+        .transition(.opacity)
     }
 }
 
```

**File**: `OnlySwitch.xcodeproj/project.pbxproj` (modified, +19/-19)
```diff
@@ -281,6 +281,8 @@
 		217549FC82A1C95A0843C27E /* DisplayBrightnessKeyTap.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C34535B906CBDA47D280D10 /* DisplayBrightnessKeyTap.swift */; };
 		2B346BE56384C700F4046FC4 /* SystemAudioMixer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 35AD1FCF5024EAC8DC9C8E5E /* SystemAudioMixer.swift */; };
 		4BE55DA1B55BBA22CCF4E310 /* DisplayBrightnessService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 52660C8AAA3F5E6778721434 /* DisplayBrightnessService.swift */; };
+		5C4ED00000000000000000A1 /* Scheduler in Frameworks */ = {isa = PBXBuildFile; productRef = 5C4ED00000000000000000A2 /* Scheduler */; };
+		5C4ED00000000000000000A4 /* ScheduleClients+App.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5C4ED00000000000000000A3 /* ScheduleClients+App.swift */; };
 		5DA700000000000000000201 /* RemoteSoundMixerFeature.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5DA700000000000000000101 /* RemoteSoundMixerFeature.swift */; };
 		5DA700000000000000000202 /* RemoteSoundMixerView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5DA700000000000000000102 /* RemoteSoundMixerView.swift */; };
 		5DA700000000000000000203 /* RemoteMixerSlider.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5DA700000000000000000103 /* RemoteMixerSlider.swift */; };
@@ -311,8 +313,6 @@
 		A9C70D062EE490B3000A2367 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = A9C70D052EE490B3000A2367 /* GoogleService-Info.plist */; };
 		A9F007CA2EC3D9BD002D9AB0 /* Design in Frameworks */ = {isa = PBXBuildFile; productRef = A9F007C92EC3D9BD002D9AB0 /* Design */; };
 		AD1000010000000000000001 /* RadioBrowser in Frameworks */ = {isa = PBXBuildFile; productRef = AD1000020000000000000001 /* RadioBrowser */; };
-		5C4ED00000000000000000A1 /* Scheduler in Frameworks */ = {isa = PBXBuildFile; productRef = 5C4ED00000000000000000A2 /* Scheduler */; };
-		5C4ED00000000000000000A4 /* ScheduleClients+App.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5C4ED00000000000000000A3 /* ScheduleClients+App.swift */; };
 		AD1000030000000000000001 /* RadioLibraryClient+App.swift in Sources */ = {isa = PBXBuildFile; fileRef = AD1000040000000000000001 /* RadioLibraryClient+App.swift */; };
 		AF1000010000000000000001 /* Aphrodite in Frameworks */ = {isa = PBXBuildFile; productRef = AF1000020000000000000001 /* Aphrodite */; };
 		AF1000050000000000000001 /* AphroditeSwitch.swift in Sources */ = {isa = PBXBuildFile; fileRef = AF1000040000000000000001 /* AphroditeSwitch.swift */; };
@@ -919,6 +919,7 @@
 		2C34535B906CBDA47D280D10 /* DisplayBrightnessKeyTap.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DisplayBrightnessKeyTap.swift; sourceTree = "<group>"; };
 		35AD1FCF5024EAC8DC9C8E5E /* SystemAudioMixer.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SystemAudioMixer.swift; sourceTree = "<group>"; };
 		52660C8AAA3F5E6778721434 /* DisplayBrightnessService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DisplayBrightnessService.swift; sourceTree = "<group>"; };
+		5C4ED00000000000000000A3 /* ScheduleClients+App.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "ScheduleClients+App.swift"; sourceTree = "<group>"; };
 		5DA700000000000000000101 /* RemoteSoundMixerFeature.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSoundMixerFeature.swift; sourceTree = "<group>"; };
 		5DA700000000000000000102 /* RemoteSoundMixerView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSoundMixerView.swift; sourceTree = "<group>"; };
 		5DA700000000000000000103 /* RemoteMixerSlider.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteMixerSlider.swift; sourceTree = "<group>"; };
@@ -1185,7 +1186,6 @@
 		RSVW00000000000000001101 /* RemoteScreenshotDragProvider.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteScreenshotDragProvider.swift; sourceTree = "<group>"; };
 		SMRB00000000000000000001 /* SoundMixerRemoteBridge.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SoundMixerRemoteBridge.swift; sourceTree = "<group>"; };
 		SMRB00000000000000000003 /* SoundMixerRemoteBridgeTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SoundMixerRemoteBridgeTests.swift; sourceTree = "<group>"; };
-		5C4ED00000000000000000A3 /* ScheduleClients+App.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "ScheduleClients+App.swift"; sourceTree = "<group>"; };
 		TB5A00000000000000000001 /* TabVisibilitySettingsVM.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TabVisibilitySettingsVM.swift; sourceTree = "<group>"; };
 		TB5A00000000000000000003 /* TabVisibilitySettingsView.swift */ = {i
```

**File**: `README.md` (modified, +7/-0)
```diff
@@ -54,6 +54,7 @@ To control OnlySwitch from an iPhone or iPad, install [OnlyRemote from the App S
 
 ### Highlights
 
+- Automate recurring Mac tasks with [Schedules](#schedules).
 - Import macOS Shortcuts into OnlySwitch and control switches and Shortcuts with keyboard shortcuts.
 - Customize which controls appear and arrange them to fit your workflow. Built-in switches are grouped by category and can be searched by name.
 - Manage every optional page from one place: **OnlySwitch Settings → Tabs** shows or hides tabs in the menu-bar list and Only Control.
@@ -71,6 +72,12 @@ To control OnlySwitch from an iPhone or iPad, install [OnlyRemote from the App S
   <img alt="OnlySwitch desktop pet" src="https://github.com/user-attachments/assets/f45e4b4f-932e-4768-8bfd-845e22fdfff3" width="152" height="188" />
 </p>
 
+### Schedules
+
+Open **OnlySwitch Settings → Schedules** to automate supported switches, buttons, Shortcuts, and Evolutions. Run an action at a repeating interval, at a specific minute every hour, or at a set time on selected days. For example, turn **Dim Screen** on at 8:00 AM and off at 7:00 PM every day, or run **Empty Trash** every Saturday at 9:00 AM.
+
+Use the **Schedules** tab in the menu bar or Only Control to see what runs next, run an action immediately, or turn a schedule on or off. Show or hide the tab under **OnlySwitch Settings → Tabs**. Schedules run locally while OnlySwitch is running, even with no window open.
+
 ### Built-in switches
 
 | Switch | Status | Switch | Status |
```

---

### Incident Patch 3: `cac06959` (2026-11-06)
**Commit Message**: Use physical footprint for process memory

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +9/-9)
```diff
@@ -774,7 +774,7 @@ actor MacSystemMonitorCollector {
 
     private struct ProcessCounters {
         let cpuNanoseconds: UInt64
-        let residentBytes: UInt64
+        let memoryBytes: UInt64?
         let name: String
         let identity: SystemMonitorProcessIdentity?
     }
@@ -1216,7 +1216,7 @@ private extension MacSystemMonitorCollector {
                 pid: pid,
                 name: counters.name,
                 cpuUsage: .available(cpuUsage),
-                memoryBytes: .available(counters.residentBytes),
+                memoryBytes: counters.memoryBytes.map { .available($0) } ?? .unavailable,
                 downloadBytesPerSecond: .unavailable,
                 uploadBytesPerSecond: .unavailable
             )
@@ -1232,14 +1232,14 @@ private extension MacSystemMonitorCollector {
 
         // `proc_pid_rusage` can be denied for individual processes (and has differed between
         // macOS releases for sandboxed callers). Use the documented task-info query as a
-        // per-process fallback rather than dropping every row when that happens. Both sources
-        // report cumulative CPU time and resident memory, so downstream rate calculations stay
-        // identical.
-        let values: (cpuNanoseconds: UInt64, residentBytes: UInt64)
+        // per-process CPU fallback rather than dropping every row when that happens. Physical
+        // footprint is not available from task info, and RSS is intentionally not substituted
+        // because it measures different memory semantics.
+        let values: (cpuNanoseconds: UInt64, memoryBytes: UInt64?)
         if resourceUsageResult == 0 {
             values = (
                 cpuNanoseconds: usage.ri_user_time + usage.ri_system_time,
-                residentBytes: usage.ri_resident_size
+                memoryBytes: usage.ri_phys_footprint
             )
         } else {
             var taskInfo = proc_taskinfo()
@@ -1253,7 +1253,7 @@ private extension MacSystemMonitorCollector {
             guard returnedByteCount == MemoryLayout<proc_taskinfo>.size else { return nil }
             values = (
                 cpuNanoseconds: taskInfo.pti_total_user + taskInfo.pti_total_system,
-                residentBytes: taskInfo.pti_resident_size
+                memoryBytes: nil
             )
         }
 
@@ -1287,7 +1287,7 @@ private extension MacSystemMonitorCollector {
 
         return ProcessCounters(
             cpuNanoseconds: values.cpuNanoseconds,
-            residentBytes: values.residentBytes,
+            memoryBytes: values.memoryBytes,
             name: name,
             identity: identity
         )
```

**File**: `OnlySwitchTests/SystemMonitor/MacSystemMonitorCollectorTests.swift` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ struct MacSystemMonitorCollectorTests {
 
         #expect(snapshot.processes.isEmpty == false)
         #expect(snapshot.processes.allSatisfy { process in
-            process.pid > 0 && process.name.isEmpty == false && process.memoryBytes.value != nil
+            process.pid > 0 && process.name.isEmpty == false && process.cpuUsage.value != nil
         })
     }
 
```

#### Recent Merged Pull Requests:
- **PR #229** (2026-10-28): Add option to turn off Keep Awake after manual sleep (@oecer)
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)
- **PR #215** (2026-08-11): Fix Show List shortcut being treated as a right-click (@EhsanAzish80)
- **PR #213** (2026-08-10): feat: add a per-app sound mixer switch (@lou1s19)

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

## X. Stop crashing when a music player quits while its state is polled

**RULE**:
When implementing operations in `OnlySwitch/Player/MusicAppPlayer/AppleMusic/AppleMusicPlayer/AppleMusicPlayer.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `72a3ac88`: Stop crashing when a music player quits while its state is polled. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `OnlySwitch/Player/MusicAppPlayer/AppleMusic/AppleMusicPlayer/AppleMusicPlayer.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // A player that quits mid-request replies with no state, which is not a valid case
        // and would trap when switched on, so validate it through its raw value first.
              let rawState = applemusicApp.playerState?.rawValue,
              let playerState = iTunesEPlS(rawValue: rawState)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
              let playerState = applemusicApp.playerState
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `72a3ac88` are properly handled with clean fallback behavior.
