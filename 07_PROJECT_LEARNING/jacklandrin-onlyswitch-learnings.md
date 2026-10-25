> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source**: github ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Source Version**: `abbde3ce`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T17:59:17.129Z  
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
> **Harvest Timestamp**: 2026-10-25T17:59:17.122Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: 👑 The all-in-one macOS menu bar companion: customizable controls, system monitor, AI Agent, Shortcuts, widgets, remote control, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6014 stars

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

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlID.swift`
```
public struct RemoteControlID: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case builtIn
        case shortcut
        case evolution
    }

    public let kind: Kind
    public let value: String

    public init(kind: Kind, value: String) {
        self.kind = kind
        self.value = value
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlStatus.swift`
```
import Foundation

public struct RemoteControlStatus: Codable, Equatable, Identifiable, Sendable {
    public let id: RemoteControlID
    public let isAvailable: Bool
    public let unavailableReason: String?
    public let isOn: Bool?
    public let secondaryInformation: String?
    public let isProcessing: Bool
    public let revision: UInt64
    public let updatedAt: Date

    public init(
        id: RemoteControlID,
        isAvailable: Bool,
        unavailableReason: String?,
        isOn: Bool?,
        secondaryInformation: String?,
        isProcessing: Bool,
        revision: UInt64,
        updatedAt: Date
    ) {
        self.id = id
        self.isAvailable = isAvailable
        self.unavailableReason = unavailableReason
        self.isOn = isOn
        self.secondaryInformation = secondaryInformation
        self.isProcessing = isProcessing
        self.revision = revision
        self.updatedAt = updatedAt
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

### Incident Patch 1: `abbde3ce` (2026-10-23)
**Commit Message**: Fix radio audio packet callback race

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parser+Packets.swift` (modified, +3/-5)
```diff
@@ -10,8 +10,6 @@ import Foundation
 import AVFoundation
 import os.log
 
-let parserQueue = DispatchQueue(label: "com.fastlearner.streamer.parser",attributes: .concurrent)
-
 func ParserPacketCallback(_ context: UnsafeMutableRawPointer, _ byteCount: UInt32, _ packetCount: UInt32, _ data: UnsafeRawPointer, _ packetDescriptions: UnsafeMutablePointer<AudioStreamPacketDescription>) {
     let decriptions:UnsafeMutablePointer<AudioStreamPacketDescription>? = packetDescriptions
     ParserPacketCallback(context, byteCount, packetCount, data, decriptions)
@@ -29,15 +27,15 @@ func ParserPacketCallback(_ context: UnsafeMutableRawPointer, _ byteCount: UInt3
     }
     
     
-    parserQueue.sync {
+    parser.withPackets { packets in
         /// Iterate through the packets and store the data appropriately
         if isCompressed {
             for i in 0 ..< Int(packetCount) {
                 let packetDescription = packetDescriptions![i]
                 let packetStart = Int(packetDescription.mStartOffset)
                 let packetSize = Int(packetDescription.mDataByteSize)
                 let packetData = Data(bytes: data.advanced(by: packetStart), count: packetSize)
-                parser.packets.append((packetData, packetDescription))
+                packets.append((packetData, packetDescription))
             }
         } else {
             let format = dataFormat.streamDescription.pointee
@@ -46,7 +44,7 @@ func ParserPacketCallback(_ context: UnsafeMutableRawPointer, _ byteCount: UInt3
                 let packetStart = i * bytesPerPacket
                 let packetSize = bytesPerPacket
                 let packetData = Data(bytes: data.advanced(by: packetStart), count: packetSize)
-                parser.packets.append((packetData, nil))
+                packets.append((packetData, nil))
             }
         }
         
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parser+PropertyListener.swift` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@ func ParserPropertyChangeCallback(_ context: UnsafeMutableRawPointer,
         os_log("Data format: %@", log: Parser.loggerPropertyListenerCallback, type: .debug, String(describing: parser.dataFormat))
         
     case kAudioFileStreamProperty_AudioDataPacketCount:
-        GetPropertyValue(&parser.packetCount, streamID, propertyID)
+        var packetCount: UInt64 = 0
+        GetPropertyValue(&packetCount, streamID, propertyID)
+        parser.packetCount = packetCount
         os_log("Packet count: %i", log: Parser.loggerPropertyListenerCallback, type: .debug, parser.packetCount)
 
     default:
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parser.swift` (modified, +43/-8)
```diff
@@ -18,23 +18,51 @@ public class Parser: Parsing {
     
     // MARK: - Parsing props
     
-    public internal(set) var dataFormat: AVAudioFormat?
-    public var packets = [(Data, AudioStreamPacketDescription?)]()
+    // Protect packet storage and parser metadata on the download and playback threads.
+    private let stateLock = NSLock()
+    private let parseLock = NSLock()
+    private var storedDataFormat: AVAudioFormat?
+    private var storedPackets = [(Data, AudioStreamPacketDescription?)]()
+    private var storedFrameCount: UInt64 = 0
+    private var storedPacketCount: UInt64 = 0
+
+    private func withState<Result>(_ body: () -> Result) -> Result {
+        stateLock.lock()
+        defer { stateLock.unlock() }
+        return body()
+    }
+
+    public internal(set) var dataFormat: AVAudioFormat? {
+        get { withState { storedDataFormat } }
+        set { withState { storedDataFormat = newValue } }
+    }
+    public var packets: [(Data, AudioStreamPacketDescription?)] {
+        get { withState { storedPackets } }
+        set { withState { storedPackets = newValue } }
+    }
+    public func withPackets<Result>(_ body: (inout [(Data, AudioStreamPacketDescription?)]) -> Result) -> Result {
+        withState { body(&storedPackets) }
+    }
     public var totalPacketCount: AVAudioPacketCount? {
-        guard let _ = dataFormat else {
-            return nil
+        withState {
+            guard storedDataFormat != nil else { return nil }
+            return max(AVAudioPacketCount(storedPacketCount), AVAudioPacketCount(storedPackets.count))
         }
-        
-        return max(AVAudioPacketCount(packetCount), AVAudioPacketCount(packets.count))
     }
     
     // MARK: - Properties
     
     /// A `UInt64` corresponding to the total frame count parsed by the Audio File Stream Services
-    public internal(set) var frameCount: UInt64 = 0
+    public internal(set) var frameCount: UInt64 {
+        get { withState { storedFrameCount } }
+        set { withState { storedFrameCount = newValue } }
+    }
     
     /// A `UInt64` corresponding to the total packet count parsed by the Audio File Stream Services
-    public internal(set) var packetCount: UInt64 = 0
+    public internal(set) var packetCount: UInt64 {
+        get { withState { storedPacketCount } }
+        set { withState { storedPacketCount = newValue } }
+    }
     
     /// The `AudioFileStreamID` used by the Audio File Stream Services for converting the binary data into audio packets
     fileprivate var streamID: AudioFileStreamID?
@@ -50,10 +78,17 @@ public class Parser: Parsing {
             throw ParserError.streamCouldNotOpen
         }
     }
+
+    deinit {
+        if let streamID { AudioFileStreamClose(streamID) }
+    }
     
     // MARK: - Methods
     
     public func parse(data: Data) throws {
+        guard !data.isEmpty else { return }
+        parseLock.lock()
+        defer { parseLock.unlock() }
 //        os_log("%@ - %d", log: Parser.logger, type: .debug, #function, #line)
         
         let streamID = self.streamID!
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parsing.swift` (modified, +9/-0)
```diff
@@ -25,6 +25,11 @@ public protocol Parsing: AnyObject {
     
     /// An array of duples, each index presenting a parsed audio packet. For compressed formats each packet of data should contain a `AudioStreamPacketDescription`, which describes the start offset and length of the audio data)
     var packets: [(Data, AudioStreamPacketDescription?)] { get set }
+
+    /// Access or mutate the packet buffer as one operation. Concurrent parsers must
+    /// synchronize this operation with packet production and buffer clearing.
+    /// The body must not access the parser's packet properties recursively.
+    func withPackets<Result>(_ body: (inout [(Data, AudioStreamPacketDescription?)]) -> Result) -> Result
     
     /// The total number of frames (expressed in the data format)
     var totalFrameCount: AVAudioFrameCount? { get }
@@ -61,6 +66,10 @@ public protocol Parsing: AnyObject {
 
 // Usually these methods are gonna be calculated using the same way everytime so here are the default implementations that should work 99% of the time relative to the properties defined. 
 extension Parsing {
+
+    public func withPackets<Result>(_ body: (inout [(Data, AudioStreamPacketDescription?)]) -> Result) -> Result {
+        body(&packets)
+    }
     
     public var duration: TimeInterval? {
         guard let sampleRate = dataFormat?.sampleRate else {
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Read/Reader+Converter.swift` (modified, +44/-76)
```diff
@@ -11,95 +11,63 @@ import AVFoundation
 import AudioToolbox
 import os.log
 
-// MARK: - Errors
-
-
-// MARK: -
-nonisolated(unsafe) var packetDescs:[UnsafeMutablePointer<AudioStreamPacketDescription>?] = []
-nonisolated(unsafe) var packetDatas:[UnsafeMutableRawPointer?] = []
-
+/// Input storage belongs to the reader and remains valid until the converter's next
+/// input callback, including across AudioConverterFillComplexBuffer calls.
 func ReaderConverterCallback(_ converter: AudioConverterRef,
                              _ packetCount: UnsafeMutablePointer<UInt32>,
                              _ ioData: UnsafeMutablePointer<AudioBufferList>,
                              _ outPacketDescriptions: UnsafeMutablePointer<UnsafeMutablePointer<AudioStreamPacketDescription>?>?,
                              _ context: UnsafeMutableRawPointer?) -> OSStatus {
     let reader = Unmanaged<Reader>.fromOpaque(context!).takeUnretainedValue()
-    
-    //
-    // Make sure we have a valid source format so we know the data format of the parser's audio packets
-    //
+    reader.releaseConverterInput()
+    packetCount.pointee = 0
+    outPacketDescriptions?.pointee = nil
+    ioData.pointee.mBuffers.mData = nil
+    ioData.pointee.mBuffers.mDataByteSize = 0
+
     guard let sourceFormat = reader.parser.dataFormat else {
         return ReaderMissingSourceFormatError
     }
-    
-    //
-    // Check if we've reached the end of the packets. We have two scenarios:
-    //     1. We've reached the end of the packet data and the file has been completely parsed
-    //     2. We've reached the end of the data we currently have downloaded, but not the file
-    //
-    let packetIndex = Int(reader.currentPacket)
-    let packets = reader.parser.packets
-    let isEndOfData = packetIndex >= packets.count - 1
-    if isEndOfData {
-        if reader.parser.isParsingComplete {
-            packetCount.pointee = 0
-            return ReaderReachedEndOfDataError
-        } else {
-            return ReaderNotEnoughDataError
+
+    let isParsingComplete = reader.parser.isParsingComplete
+    let packet = reader.parser.withPackets { packets -> (Data, AudioStreamPacketDescription?)? in
+        let packetIndex = Int(reader.currentPacket)
+        guard packetIndex < packets.count else { return nil }
+        let packet = packets[packetIndex]
+        reader.currentPacket += 1
+        if packetIndex >= 256 {
+            packets.removeFirst(256)
+            reader.currentPacket -= 256
         }
+        return packet
     }
-    
-    //
-    // Copy data over (note we've only processing a single packet of data at a time)
-    //
-    let packet = packets[packetIndex]
-    var data = packet.0
-    let dataCount = data.count
-    ioData.pointee.mNumberBuffers = 1
-    ioData.pointee.mBuffers.mData = UnsafeMutableRawPointer.allocate(byteCount: dataCount, alignment: 0)
-    data.withUnsafeMutableBytes { rawMutableBufferPointer in
-        let bufferPointer = rawMutableBufferPointer.bindMemory(to: UInt8.self)
-        if let address = bufferPointer.baseAddress {
-            memcpy((ioData.pointee.mBuffers.mData?.assumingMemoryBound(to: UInt8.self))!, address, dataCount)
-        }
-        
+    guard let packet else {
+        return isParsingComplete ? ReaderReachedEndOfDataError : ReaderNotEnoughDataError
     }
-    ioData.pointee.mBuffers.mDataByteSize = UInt32(dataCount)
-    packetDatas.append(ioData.pointee.mBuffers.mData)
-    
-    //
-    // Handle packet descriptions for compressed formats (MP3, AAC, etc)
-    //
-    let sourceFormatDescription = sourceFormat.streamDescription.pointee
-    if sourceFormatDescription.mFormatID != kAudioFormatLinearPCM {
-        if outPacketDescriptions?.pointee == nil {
-            outPacketDescriptions?.pointee = UnsafeMutablePointer<AudioStreamPacketDescription>.allocate(capacity: 1)
-        }
-        outPacketDescriptions?.pointee?.pointee.mDataByteSize = UInt32(dataCount)
-        outPacketDescriptions?.pointee?.pointee.mStartOffset = 0
-        outPacketDescriptions?.pointee?.pointee.mVariableFramesInPacket = 0
-        packetDescs.append(outPacketDescriptions?.pointee)
-    }
-    packetCount.pointee = 1
-    reader.currentPacket = reader.currentPacket + 1
-    
-    parserQueue.sync {
-        if packetIndex >= 256 {
-            reader.parser.packets.removeSubrange(0...255)
-            reader.currentPacket = 1
+
+    let data = packet.0
+    let inputData = UnsafeMutableRawPointer.allocate(byteCount: max(data.count, 1), alignment: MemoryLayout<UInt8>.alignment)
+    data.withUnsafeBytes { bytes in
+        if let address = bytes.baseAddress {
+            inputData.copyMemory(from: address, byteCount: data.count)
         }
     }
-    
-//    print("packets count:\(reader.parser.packets.count)")
-//    print("current packet:\(reader.currentPacket)")
-    return noErr;
-}
+    reader.converterInputData = inputData
+    ioData.pointee.mNumberBuffers = 1
+    ioData.poin
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Read/Reader.swift` (modified, +15/-6)
```diff
@@ -30,15 +30,27 @@ public class Reader: Reading {
     /// A `DispatchQueue` used to ensure any operations we do changing the current packet index is thread-safe
     private let queue = DispatchQueue(label: "com.fastlearner.streamer")
     
+    // Accessed only on the reader queue (or by its synchronous converter callback).
+    var converterInputData: UnsafeMutableRawPointer?
+    var converterInputDescription: UnsafeMutablePointer<AudioStreamPacketDescription>?
+
+    func releaseConverterInput() {
+        converterInputData?.deallocate()
+        converterInputData = nil
+        converterInputDescription?.deinitialize(count: 1)
+        converterInputDescription?.deallocate()
+        converterInputDescription = nil
+    }
+
     // MARK: - Lifecycle
     
     deinit {
-        guard AudioConverterDispose(converter!) == noErr else {
+        if let converter, AudioConverterDispose(converter) != noErr {
             os_log("Failed to dispose of audio converter", log: Reader.logger, type: .error)
-            return
         }
+        releaseConverterInput()
     }
-    
+
     public required init(parser: Parsing, readFormat: AVAudioFormat) throws {
         self.parser = parser
         
@@ -73,9 +85,6 @@ public class Reader: Reading {
         try queue.sync {
             let context = unsafeBitCast(self, to: UnsafeMutableRawPointer.self)
             let status = AudioConverterFillComplexBuffer(converter!, ReaderConverterCallback, context, &packets, buffer.mutableAudioBufferList, nil)
-            if #unavailable(macOS 13) {
-                cleanupConverterGarbage()
-            }
             
             guard status == noErr else {
 //                AudioConverterReset(self.converter!);
```

**File**: `OnlySwitch/Player/CommonPlayer/AudioStreamer/Stream/Streamer.swift` (modified, +2/-2)
```diff
@@ -214,7 +214,7 @@ class Streamer: Streaming, @unchecked Sendable {
         downloader.stop()
         playerNode.stop()
         engine.stop()
-        reader?.parser.packets.removeAll()
+        reader?.parser.withPackets { $0.removeAll() }
         // Update the state
         state = .stopped
     }
@@ -293,7 +293,7 @@ class Streamer: Streaming, @unchecked Sendable {
             return
         }
 
-        guard (parser?.packets.count)! > 512 else {
+        guard reader.parser.withPackets({ $0.count }) > 512 else {
             return
         }
         
```

**File**: `OnlySwitchTests/AudioStreamingTests.swift` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import AVFoundation
+import Foundation
+import Testing
+@testable import OnlySwitch
+
+struct AudioStreamingTests {
+    private func makeParser() throws -> Parser {
+        let parser = try Parser()
+        parser.dataFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44_100, channels: 1, interleaved: true)!
+        return parser
+    }
+
+    private func append(_ value: Float, to parser: Parser) {
+        var value = value
+        withUnsafePointer(to: &value) {
+            ParserPacketCallback(Unmanaged.passUnretained(parser).toOpaque(), 4, 1, $0, nil)
+        }
+    }
+
+    @Test("The converter consumes the only packet and reports zero packets on exhaustion")
+    func consumesLastPacket() throws {
+        let parser = try makeParser()
+        append(0.25, to: parser)
+        let reader = try Reader(parser: parser, readFormat: #require(parser.dataFormat))
+        let buffer = try reader.read(1)
+        #expect(buffer.floatChannelData?[0][0] == 0.25)
+        #expect(reader.currentPacket == 1)
+
+        var count: UInt32 = 99
+        var list = AudioBufferList()
+        let status = ReaderConverterCallback(try #require(reader.converter), &count, &list, nil, Unmanaged.passUnretained(reader).toOpaque())
+        #expect(status == ReaderReachedEndOfDataError)
+        #expect(count == 0)
+    }
+
+    @Test("An empty incomplete stream returns no input without indexing the array")
+    func emptyIncompleteStream() throws {
+        let parser = try makeParser()
+        parser.packetCount = 10
+        let reader = try Reader(parser: parser, readFormat: #require(parser.dataFormat))
+        var count: UInt32 = 99
+        var list = AudioBufferList()
+        let status = ReaderConverterCallback(try #require(reader.converter), &count, &list, nil, Unmanaged.passUnretained(reader).toOpaque())
+        #expect(status == ReaderNotEnoughDataError)
+        #expect(count == 0)
+        #expect(reader.currentPacket == 0)
+    }
+
+    @Test("Trimming at 256 packets preserves the next packet and final sample")
+    func trimsConsumedPackets() throws {
+        let parser = try makeParser()
+        for value in 0..<600 { append(Float(value), to: parser) }
+        let reader = try Reader(parser: parser, readFormat: #require(parser.dataFormat))
+        for value in 0..<600 {
+            let buffer = try reader.read(1)
+            #expect(buffer.floatChannelData?[0][0] == Float(value))
+        }
+        #expect(parser.withPackets { $0.count } == 88)
+        #expect(reader.currentPacket == 88)
+    }
+
+    @Test("Input storage stays valid across reads and belongs to each reader")
+    func converterInputOwnership() throws {
+        let firstParser = try makeParser()
+        let secondParser = try makeParser()
+        for value in 0..<100 {
+            append(Float(value), to: firstParser)
+            append(Float(value + 100), to: secondParser)
+        }
+        let first = try Reader(parser: firstParser, readFormat: #require(firstParser.dataFormat))
+        let second = try Reader(parser: secondParser, readFormat: #require(secondParser.dataFormat))
+        for value in 0..<100 {
+            _ = try first.read(1)
+            let firstInput = try #require(first.converterInputData)
+            #expect(firstInput.load(as: Float.self) == Float(value))
+            _ = try second.read(1)
+            #expect(firstInput.load(as: Float.self) == Float(value))
+            #expect(first.converterInputData != second.converterInputData)
+        }
+    }
+
+    @Test("Concurrent packet callbacks and consumption preserve every packet")
+    func concurrentProductionAndConsumption() throws {
+        let shared = try SharedParser(parser: makeParser())
+        DispatchQueue.concurrentPerform(iterations: 2_000) { index in
+            var value = Float(index)
+            withUnsafePointer(to: &value) {
+                ParserPacketCallback(Unmanaged.passUnretained(shared.parser).toOpaque(), 4, 1, $0, nil)
+            }
+            let packet = shared.parser.withPackets { packets -> Data? in
+                packets.isEmpty ? nil : packets.removeFirst().0
+            }
+            if let packet { shared.record(packet) }
+        }
+        let remaining = shared.parser.withPackets { $0.map(\.0) }
+        let values = (shared.consumed + remaining).map { $0.withUnsafeBytes { $0.loadUnaligned(as: Float.self) } }
+        #expect(values.count == 2_000)
+        #expect(Set(values) == Set((0..<2_000).map(Float.init)))
+    }
+
+    @Test("Compressed packet descriptions have reader-owned storage and preserve frame counts")
+    func compressedInputOwnership() throws {
+        let parser = try makeParser()
+        let output = try #require(parser.dataFormat)
+        let first = try Reader(parser: parser, readFormat: output)
+        let second = try Reader(parser: parser, readFormat: output)
+        // Exercise the input callback directly, without requesting a
```

---

### Incident Patch 2: `d628de57` (2026-10-21)
**Commit Message**: bump build version

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 290
+CURRENT_PROJECT_VERSION = 291
```

#### Recent Merged Pull Requests:
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)
- **PR #215** (2026-08-11): Fix Show List shortcut being treated as a right-click (@EhsanAzish80)
- **PR #213** (2026-08-10): feat: add a per-app sound mixer switch (@lou1s19)
- **PR #211** (2026-07-13): Add Desktop Pet feature information to README (@jacklandrin)

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

## X. radio audio packet callback race

**RULE**:
When implementing operations in `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parser+Packets.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `abbde3ce`: radio audio packet callback race. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `OnlySwitch/Player/CommonPlayer/AudioStreamer/Parse/Parser+Packets.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    parser.withPackets { packets in
                packets.append((packetData, packetDescription))
                packets.append((packetData, nil))
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
let parserQueue = DispatchQueue(label: "com.fastlearner.streamer.parser",attributes: .concurrent)

    parserQueue.sync {
                parser.packets.append((packetData, packetDescription))
                parser.packets.append((packetData, nil))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `abbde3ce` are properly handled with clean fallback behavior.
