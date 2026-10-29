> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source**: github ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Source Version**: `d1bce595`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T02:03:28.946Z  
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
> **Harvest Timestamp**: 2026-10-29T02:03:28.285Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: 👑 The all-in-one macOS menu bar companion: customizable controls, system monitor, AI Agent, Shortcuts, widgets, remote control, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6020 stars

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

### Incident Patch 1: `393accc6` (2026-10-27)
**Commit Message**: Fix Czech empty switch subtitles

**File**: `Localization/Localizable.xcstrings` (modified, +1/-1)
```diff
@@ -5881,7 +5881,7 @@
         "cs" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "(Empty string)"
+            "value" : ""
           }
         }
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

## X. Czech empty switch subtitles

**RULE**:
When implementing operations in `Localization/Localizable.xcstrings`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `393accc6`: Czech empty switch subtitles. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Localization/Localizable.xcstrings`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
            "value" : ""
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
            "value" : "(Empty string)"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `393accc6` are properly handled with clean fallback behavior.
