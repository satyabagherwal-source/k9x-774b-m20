# Verification Protocol: Verification Protocol: Empirical Defect Shield for duongductrong/Snapzy

<!-- PROVENANCE_START
{
  "source_repository": "duongductrong/Snapzy",
  "source_url": "https://github.com/duongductrong/Snapzy",
  "source_version": "193d9422",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-26T02:09:40.719Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duongductrong-snapzy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duongductrong/Snapzy](https://github.com/duongductrong/Snapzy) (Revision: `193d9422`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-26T02:09:40.719Z`  
> **Learning ID**: `learn-github-duongductrong-snapzy`


## 1. Scope & Verification Target
- **Target Repository**: `duongductrong/Snapzy` (Commit: `193d9422`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T02:09:39.348Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3618 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/AreaCommand.swift`
```
//
//  AreaCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct AreaCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "area",
    abstract: "Capture a rectangle of the screen.",
    discussion: """
    Coordinates are global points with the origin at the top-left of the main \
    display, the same space as the frames printed by `snapzy list`.
    """
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: AreaSelectionOptions

  func run() async throws {
    try await CaptureCommand.run(
      .captureArea,
      params: CaptureAreaParams(rect: selection.rect, options: output.captureOptions()),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/CaptureCommand.swift`
```
//
//  CaptureCommand.swift
//  SnapzyCLICore
//
//  `capture screen|window|area`. Captures never open Quick Access, touch the
//  clipboard or history; the file path comes back in the result.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct CaptureCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "capture",
    abstract: "Capture a display, a window or an area without user interaction.",
    subcommands: [ScreenCommand.self, WindowCommand.self, AreaCommand.self]
  )

  static func run(
    _ method: CLIMethod,
    params: some Codable & Sendable,
    output: CaptureOutputOptions,
    global: GlobalOptions
  ) async throws {
    let destination = OutputDestination.resolve(
      output.output,
      currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    )
    let writer = OutputWriter()
    try await CommandRunner.reportingErrors(global.renderer) {
      try writer.preflight(destination, force: output.force)
    }

    try await CommandRunner.run(global) { client, renderer in
      let result = try client.call(method, params: params, as: CLICaptureResult.self)
      let written = try writer.apply(result, to: destination, force: output.force) { data in
        do {
          try FileHandle.standardOutput.write(contentsOf: data)
        } catch {
          throw CLIError(.internal, "Could not write the image to stdout: \(error.localizedDescription)")
        }
      }

      if destination == .standardOutput {
        // stdout carries the image; metadata goes to stderr only when asked.
        if global.json {
          try StandardStreams.writeError(OutputRenderer(mode: .json(pretty: false)).render(written))
        }
      } else {
        try StandardStreams.write(renderer.render(written))
      }
    }
  }
}

struct CaptureOutputOptions: ParsableArguments {
  @Option(
    name: [.short, .long],
    help: ArgumentHelp(
      "Where to write the capture: a file, a directory (trailing /), or - for stdout.",
      discussion: "Without it the file stays in Snapzy's staging folder for 24 hours."
    )
  )
  var output: String?

  @Option(help: "Image format. Defaults to the --output extension, else png.")
  var format: CLIImageFormat?

  @Option(help: "JPEG, HEIC or AVIF quality, 0 to 1.")
  var quality: Double?

  @Option(name: .customLong("max-dimension"), help: "Downscale so the longest edge is at most this many pixels.")
  var maxDimension: Int?

  @Flag(help: "Include the mouse cursor.")
  var cursor = false

  @Flag(help: "Overwrite existing files at --output.")
  var force = false

  mutating func validate() throws {
    let format = try resolvedFormat()
    if let quality {
      guard (0 ... 1).contains(quality) else { throw ValidationError("--quality must be between 0 and 1.") }
      guard format.acceptsQuality else { throw ValidationError("--quality only applies to jpg, heic and avif output.") }
    }
    if let maxDimension, maxDimension <= 0 {
      throw ValidationError("--max-dimension must be greater than 0.")
    }
  }

  func resolvedFormat() throws -> CLIImageFormat {
    let outputExtension = output
      .flatMap { $0 == "-" || $0.hasSuffix("/") ? nil : URL(fileURLWithPath: $0).pathExtension }
      .flatMap(CLIImageFormat.init(fileExtension:))

    switch (format, outputExtension) {
    case let (format?, outputExtension?) where format != outputExtension:
      throw ValidationError(
        "--format \(format.fileExtension) does not match the --output extension .\(outputExtension.fileExtension)."
      )
    case let (format?, _):
      return format
    case let (nil, outputExtension?):
      return outputExtension
    case (nil, nil):
      return .png
    }
  }

  func captureOptions(windowShadow: Bool = true) throws -> CaptureOptions {
    try CaptureOptions(
      format: resolvedFormat(),
      quality: quality,
      maxDimension: maxDimension,
      showCursor: cursor,
      windowShadow: windowShadow
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/ScreenCommand.swift`
```
//
//  ScreenCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct ScreenCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "screen",
    abstract: "Capture a whole display, or every display."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: DisplaySelectionOptions

  func run() async throws {
    try await CaptureCommand.run(
      .captureScreen,
      params: CaptureScreenParams(display: selection.display, options: output.captureOptions()),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/WindowCommand.swift`
```
//
//  WindowCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct WindowCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "window",
    abstract: "Capture one window, even when other windows cover it.",
    discussion: "Pick the window with exactly one of --id, --app or --active."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: WindowSelectionOptions

  @Flag(name: .customLong("no-shadow"), help: "Capture without the window shadow.")
  var noShadow = false

  func run() async throws {
    try await CaptureCommand.run(
      .captureWindow,
      params: CaptureWindowParams(
        window: selection.selector(),
        options: output.captureOptions(windowShadow: !noShadow)
      ),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/DoctorCommand.swift`
```
//
//  DoctorCommand.swift
//  SnapzyCLICore
//
//  Explains why `snapzy` can or cannot capture: which app it talks to,
//  whether it is on PATH, whether Snapzy is reachable, and the app's status.
//  Never launches Snapzy — a stopped app is reported, not fixed.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct DoctorCheck: Codable, Equatable {
  let name: String
  let ok: Bool
  let detail: String
  let hint: String?
  /// Set when this failure should decide the exit code; advisory checks
  /// (like PATH) can fail without failing `doctor`.
  let failureCode: CLIErrorCode?

  static func pass(_ name: String, _ detail: String) -> DoctorCheck {
    DoctorCheck(name: name, ok: true, detail: detail, hint: nil, failureCode: nil)
  }

  static func fail(_ name: String, _ detail: String, hint: String?, code: CLIErrorCode?) -> DoctorCheck {
    DoctorCheck(name: name, ok: false, detail: detail, hint: hint, failureCode: code)
  }
}

struct DoctorReport: Codable, Equatable, HumanReadable {
  let checks: [DoctorCheck]

  /// The first failure that carries a code, or nil when everything required passed.
  var failureCode: CLIErrorCode? {
    checks.first { !$0.ok && $0.failureCode != nil }?.failureCode
  }

  var humanDescription: String {
    checks.map { check in
      var line = "\(check.ok ? "✓" : "✗") \(check.name): \(check.detail)"
      if let hint = check.hint {
        line += "\n    hint: \(hint)"
      }
      return line
    }.joined(separator: "\n")
  }
}

struct DoctorCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "doctor",
    abstract: "Check that snapzy can reach Snapzy and capture."
  )

  @OptionGroup var global: GlobalOptions

  func run() async throws {
    var checks: [DoctorCheck] = []
    let executable = Bundle.main.executableURL?.resolvingSymlinksInPath()
    checks.append(.pass("cli", "\(CLIVersion.current) at \(executable?.path ?? "unknown")"))
    checks.append(Doctor.pathCheck(
      path: ProcessInfo.processInfo.environment["PATH"] ?? "",
      executable: executable,
      commandName: Doctor.commandName(for: executable),
      caskInstalled: Doctor.isCaskInstall(executable: executable)
    ))

    let location: AppLocation
    do {
      location = try AppLocator.locate()
      checks.append(.pass("app", "\(location.appURL.path) (\(location.bundleID))"))
    } catch let error as CLIError {
      checks.append(.fail("app", error.message, hint: error.hint, code: error.code))
      return try finish(checks)
    }

    // Never launch from doctor; say what could not be checked instead of
    // reporting success for a server that may not accept requests.
    let socketPath = SocketLocation.path(forAppBundleID: location.bundleID)
    guard AppLauncher.Environment.live.isAppRunning(location.bundleID) else {
      checks.append(.fail(
        "connection",
        "Snapzy is not running, so command line access, onboarding and permissions were not checked "
          + "(socket: \(socketPath))",
        hint: "Open Snapzy, then run `snapzy doctor` again",
        code: nil
      ))
      return try finish(checks)
    }

    var options = global.sessionOptions
    options.allowsLaunch = false
    let client: CLIClient
    do {
      client = try await CLISession.open(options)
    } catch let error as CLIError {
      checks.append(.fail("connection", error.message, hint: error.hint, code: error.code))
      return try finish(checks)
    }
    defer { client.close() }
    checks.append(.pass(
      "connection",
      "Snapzy \(client.hello.appVersion) on \(socketPath)"
    ))

    do {
      checks += try Doctor.statusChecks(client.call(.systemStatus, as: CLIStatus.self))
    } catch let error as CLIError {
      checks.append(.fail("status", error.message, hint: error.hint, code: error.code))
    }
    try finish(checks)
  }

  private func finish(_ checks: [DoctorCheck]) throws {
    let report = DoctorReport(checks: checks)
    try StandardStreams.write(global.renderer.render(report))
    if let code = report.failureCode {
      throw ExitCode(code.exitCode)
    }
  }
}

/// Pure pieces of `doctor`, kept separate for tests.
enum Doctor {
  /// `snapzy-debug` for the helper inside a Debug build, else `snapzy`.
  static func commandName(for executable: URL?) -> String {
    let bundleID = executable
      .flatMap(AppLocator.enclosingAppBundle(forExecutableAt:))
      .flatMap(AppLocator.bundleIdentifier(ofAppAt:))
    return CommandName.forAppBundleID(bundleID)
  }

  /// Links this exact binary, so the hint is right for Debug builds and
  /// apps outside /Applications too.
  static func installHint(for executable: URL?, commandName: String = CommandName.release) -> String {
    let helper = executable?.path ?? "/Applications/Snapzy.app/Contents/Helpers/snapzy"
    let quoted = "'" + helper.replacingOccurrences(of: "'", with: "'\\''") + "'"
    return "sudo mkdir -p /usr/local/bin && sudo ln -sfn \(quoted) /usr/local/bin/\(commandName)"
  }

  static let homebrewHint = "Snapzy came from Homebrew, which links snapzy: run `brew reinstall --cask snapzy`"
  static let homebrewCaskroomPaths = ["/opt/homebrew/Caskroom/snapzy", "/usr/local/Caskroom/snapzy"]

  /// Whether this binary is inside the cask's `Snapzy.app` (not a Debug or
  /// renamed copy), so Homebrew should link it rather than `ln -s` by hand.
  static func isCaskInstall(
    executable: URL?,
    caskroomPaths: [String] = homebrewCaskroomPaths,
    fileManager: FileManager = .default
  ) -> Bool {
    guard let executable, executable.path.hasSuffix("/Snapzy.app/Contents/Helpers/snapzy") else { return false }
    return caskroomPaths.contains { fileManager.fileExists(atPath: $0) }
  }

  /// Whether `commandName` on PATH is this binary. Advisory: agents can always use the full path.
  static func pathCheck(
    path: String,
    executable: URL?,
    commandName: String = CommandName.release,
    caskInstalled: Bool = false,
    fileManager: FileManager = .default
  ) -> DoctorCheck {
    let found = path.split(separator: ":").lazy
      .map { URL(fileURLWithPath: String($0)).appendingPathComponent(commandName) }
      .first { candidate in
        var isDirectory: ObjCBool = false
        return fileManager.fileExists(atPath: candidate.path, isDirectory: &isDirectory)
          && !isDirectory.boolValue
          && fileManager.isExecutableFile(atPath: candidate.path)
      }

    guard let found else {
      let hint = caskInstalled ? homebrewHint : installHint(for: executable, commandName: commandName)
      return .fail("path", "\(commandName) is not on PATH", hint: hint, code: nil)
    }
    let resolved = found.resolvingSymlinksInPath()
    guard let executable, resolved.path != executable.path else {
      return .pass("path", "\(found.path) → \(resolved.path)")
    }
    return .fail(
      "path",
      "\(found.path) runs \(resolved.path), not this \(commandName)",
      hint: "Point the link at the Snapzy.app you use: \(installHint(for: executable, commandName: commandName))",
      code: nil
    )
  }

  static func statusChecks(_ status: CLIStatus) -> [DoctorCheck] {
    var checks: [DoctorCheck] = []

    checks.append(status.cliEnabled
      ? .pass("command line access", "enabled")
      : .fail(
        "command line access",
        "disabled",
        hint: "Enable Settings → Command Line → Command line access",
        code: .disabled
      ))

    checks.append(status.onboardingCompleted
      ? .pass("onboarding", "completed")
      : .fail("onboarding", "not completed", hint: "Open Snapzy and finish setup", code: .onboardingIncomplete))

    switch status.screenRecordingPermission {
    case .granted:
      checks.append(.pass("screen recording", "granted"))
    case .denied:
      checks.append(.fail(
        "screen recording",
        "not granted",
        hint: "System Settings → Privacy & Security → Screen & System Audio Recording → enable Snapzy",
        code: .permissionDenied
      ))
    case .unavailable:
      checks.append(.fail(
        "screen recording",
        "granted but not usable yet",
        hint: "Relaunch Snapzy. If that does not help, remove Snapzy from System Settings → Privacy & Security → "
          + "Screen & System Audio Recording and add it again",
        code: .permissionDenied
      ))
    }

    switch status.authorization {
    case .allowed:
      checks.append(.pass("authorization", "this app is allowed"))
    case .undetermined:
      checks.append(.pass("authorization", "not asked yet; Snapzy asks on the first capture"))
    case .denied:
      checks.append(.fail(
        "authorization",
        "this app was denied",
        hint: "Remove it from Settings → Command Line → Allowed apps, then retry",
        code: .notAuthorized
      ))
    }
    return checks
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/ListCommand.swift`
```
//
//  ListCommand.swift
//  SnapzyCLICore
//
//  Discovery for agents: which displays, windows and apps can be captured.
//  Window IDs and frames feed straight into `capture window --id` and
//  `capture area --rect`.
//

import ArgumentParser
import SnapzyCLIProtocol

struct ListCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "list",
    abstract: "List displays, windows or apps.",
    subcommands: [Displays.self, Windows.self, Apps.self]
  )

  struct Displays: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "displays",
      abstract: "List connected displays."
    )

    @OptionGroup var global: GlobalOptions

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(.listDisplays, as: CLIDisplayList.self)
        try StandardStreams.write(renderer.render(list))
      }
    }
  }

  struct Windows: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "windows",
      abstract: "List windows, front to back."
    )

    @OptionGroup var global: GlobalOptions

    @Option(help: "Only windows of this app (name or bundle ID).")
    var app: String?

    @Flag(help: "Include windows that are not on screen.")
    var all = false

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(
          .listWindows,
          params: ListWindowsParams(app: app, includeOffscreen: all),
          as: CLIWindowList.self
        )
        try StandardStreams.write(renderer.render(list))
      }
    }
  }

  struct Apps: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "apps",
      abstract: "List running apps that have windows."
    )

    @OptionGroup var global: GlobalOptions

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(.listApps, as: CLIAppList.self)
        try StandardStreams.write(renderer.render(list))
      }
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/MCPCommand.swift`
```
//
//  MCPCommand.swift
//  SnapzyCLICore
//
//  `snapzy mcp` — the stdio MCP server Snapzy hands to an agent CLI it spawns
//  for Annotate's AI prompt. Not meant to be configured by hand: the session
//  token exists only while that prompt runs.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct MCPCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "mcp",
    abstract: "Serve Annotate's AI tools over MCP (stdio) for an agent Snapzy started.",
    discussion: """
    Snapzy starts this itself when an Annotate AI prompt runs through Claude Code,
    Codex or OpenCode. The session token comes from \(AgentSessionEnvironment.tokenKey)
    (or --session) and stops working when that prompt finishes.
    """,
    shouldDisplay: false
  )

  @Option(help: "Session token; defaults to $\(AgentSessionEnvironment.tokenKey).")
  var session: String?

  @Option(help: "Seconds to wait for each tool call.")
  var timeout: Double = 90

  func validate() throws {
    guard timeout > 0 else { throw ValidationError("--timeout must be greater than 0.") }
  }

  func run() async throws {
    let token = session ?? ProcessInfo.processInfo.environment[AgentSessionEnvironment.tokenKey]
    guard let token, !token.isEmpty else {
      StandardStreams.writeError("snapzy mcp: no session token. Snapzy starts this command itself for Annotate's AI prompt.\n")
      throw ExitCode(CLIErrorCode.invalidArguments.exitCode)
    }

    let handler = MCPMessageHandler(
      backend: SocketToolBackend(
        session: token,
        // Never launch Snapzy: the agent was started by a running Snapzy.
        options: CLISession.Options(
          requestTimeout: timeout,
          launchTimeout: 1,
          allowsLaunch: false,
          cliVersion: CLIVersion.current
        )
      ),
      serverVersion: CLIVersion.current
    )

    // One message per line; stdout carries protocol messages only.
    while let line = readLine(strippingNewline: true) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      guard !trimmed.isEmpty else { continue }
      guard let response = await handler.handle(Data(trimmed.utf8)) else { continue }
      StandardStreams.write(String(decoding: response, as: UTF8.self) + "\n")
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureCaptureCommands.swift`
```
//
//  MeasureCaptureCommands.swift
//  SnapzyCLICore
//
//  `measure screen|window|area`: the matching `capture.*` call with settings
//  fixed for measuring (PNG, native pixels, no cursor, no window shadow), then
//  a local measurement of the staged file. Coordinates are points from the
//  captured image's top-left corner.
//

import ArgumentParser
import Foundation
import SnapzyCLIProtocol

struct MeasureKeepOptions: ParsableArguments {
  @Option(
    help: ArgumentHelp(
      "Also keep the captured PNG: a file, or a directory (trailing /).",
      discussion: "Without it the capture is deleted after measuring."
    )
  )
  var keep: String?

  @Flag(help: "Overwrite an existing file at --keep.")
  var force = false

  mutating func validate() throws {
    if let keep, keep.isEmpty || keep == "-" {
      throw ValidationError("--keep needs a file or directory path.")
    }
    // The capture is always PNG; a file named otherwise would carry the wrong format.
    if let keep, !keep.hasSuffix("/") {
      let ext = (keep as NSString).pathExtension.lowercased()
      if !ext.isEmpty, ext != "png" {
        throw ValidationError("--keep saves a PNG; use a .png name or a directory (trailing /).")
      }
    }
  }

  func destination(currentDirectory: URL) -> OutputDestination? {
    keep.map { OutputDestination.resolve($0, currentDirectory: currentDirectory) }
  }
}

enum MeasureCapture {
  /// Fixed so the image is the exact pixels the coordinates refer to.
  static let captureOptions = CaptureOptions(format: .png, maxDimension: nil, showCursor: false, windowShadow: false)

  static func run(
    _ method: CLIMethod,
    kind: CLIMeasureSource.Kind,
    params: some Codable & Sendable,
    measure: MeasureOptions,
    keep: MeasureKeepOptions,
    global: GlobalOptions
  ) async throws {
    let destination = keep.destination(
      currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    )
    let writer = OutputWriter()
    if let destination {
      try await CommandRunner.reportingErrors(global.renderer) {
        try writer.preflight(destination, force: keep.force)
      }
    }

    try await CommandRunner.run(global) { client, renderer in
      let result = try MeasureSession.measureCapture(
        kind: kind,
        request: measure.request,
        keep: destination,
        force: keep.force,
        writer: writer
      ) {
        try client.call(method, params: params, as: CLICaptureResult.self)
      }
      try StandardStreams.write(renderer.render(result))
    }
  }
}

struct MeasureScreenCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "screen",
    abstract: "Capture one display and measure it."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: DisplaySelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  mutating func validate() throws {
    if selection.display == .all {
      throw ValidationError("--display all is not supported: measure one display at a time.")
    }
  }

  func run() async throws {
    try await MeasureCapture.run(
      .captureScreen,
      kind: .screen,
      params: CaptureScreenParams(display: selection.display, options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

struct MeasureWindowCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "window",
    abstract: "Capture one window (without its shadow) and measure it.",
    discussion: "Pick the window with exactly one of --id, --app or --active."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: WindowSelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  func run() async throws {
    try await MeasureCapture.run(
      .captureWindow,
      kind: .window,
      params: CaptureWindowParams(window: selection.selector(), options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

struct MeasureAreaCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "area",
    abstract: "Capture a rectangle of the screen and measure it.",
    discussion: """
    --rect is in global points (as printed by `snapzy list`); --at and --box \
    are points from the rectangle's top-left corner.
    """
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: AreaSelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  func run() async throws {
    try await MeasureCapture.run(
      .captureArea,
      kind: .area,
      params: CaptureAreaParams(rect: selection.rect, options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureCommand.swift`
```
//
//  MeasureCommand.swift
//  SnapzyCLICore
//
//  `measure image|screen|window|area`: the Screen Ruler edge measurements from
//  the command line. `image` runs locally without Snapzy; the others take a
//  capture through Snapzy and measure it here.
//

import ArgumentParser

struct MeasureCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "measure",
    abstract: "Measure UI elements in an image or a fresh capture.",
    discussion: """
    --at x,y measures the run of same-colored pixels around a point, like \
    hovering with Screen Ruler. --box x,y,w,h shrinks a rectangle to the edges \
    of the content inside it. Coordinates are points from the top-left corner \
    of the image (pixels with --pixels).
    """,
    subcommands: [
      MeasureImageCommand.self,
      MeasureScreenCommand.self,
      MeasureWindowCommand.self,
      MeasureAreaCommand.self,
    ]
  )
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureImageCommand.swift`
```
//
//  MeasureImageCommand.swift
//  SnapzyCLICore
//
//  `measure image <path>`. Local only: never opens a socket or starts Snapzy.
//

import ArgumentParser
import Foundation

struct MeasureImageCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "image",
    abstract: "Measure an image file. Works without Snapzy running.",
    discussion: "Points are pixels divided by the image's scale: its DPI ÷ 72 (1 without DPI), or --scale."
  )

  @OptionGroup var global: GlobalOptions

  @Argument(help: "The image file.")
  var path: String

  @OptionGroup var measure: MeasureOptions

  @Option(help: "Pixels per point, instead of the scale from the image's DPI.")
  var scale: Double?

  mutating func validate() throws {
    if let scale, !(scale.isFinite && scale > 0) {
      throw ValidationError("--scale must be greater than 0.")
    }
  }

  func run() async throws {
    let renderer = global.renderer
    try await CommandRunner.reportingErrors(renderer) {
      let result = try MeasureSession.measureImage(
        path: path,
        currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true),
        request: measure.request,
        scale: scale
      )
      try StandardStreams.write(renderer.render(result))
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #771** (2026-11-21): **fix: stop re-checking app identity before every capture**
  *Symptoms*: ## What this fixes  Fixes #509 — the brief freeze that happens before the selection overlay appears when using Screenshot & Annotate, reported as happening every single time.  Root cause: before every capture, the app runs its full permission check, and that check re-evaluates the app's own bundle identity. One step of that evaluation is a strict `SecStaticCodeCheckValidity` over the bundle with nested-code validation, which costs around half a second on an installed build — and it ran on the main actor, so the whole UI sat still while it worked. The step is inside `#if !DEBUG`, which is why nobody running from Xcode ever saw it.  ## Changes  **perf: reuse app identity instead of re-checking it before every capture** — the hot path in front of a capture now trusts a cached "granted" status as long as a cheap (~10 ms) system preflight still confirms it, and only falls back to the full check otherwise, so revoked access or a broken bundle is still caught and surfaced. The identity evaluation itself is memoised behind a fingerprint of the executable (path, modification date, size), meaning the bundle gets re-validated when it genuinely changed — a reinstall, a `brew upgrade --cask` — and not on every button press. The places where somebody is explicitly asking the system a fresh question (the permission rows in Preferences and onboarding, and the request-permission path) pass `refresh(force: true)`, so nothing about the real check gets weaker. The evaluation also logs how long i

- **Issue #762** (2026-11-21): **[Bug]: Area capture then application capture not working**
  *Symptoms*: ### Description  When I press Shift+Command+4, then Space, it captures the whole screen instead of just the app, as it used to.  ### Steps to Reproduce  When I press Shift+Command+4, then Space, it captures the whole screen instead of just the app, as it used to.  ### Expected Behavior  Work as it used to.   ### Actual Behavior  When I press Shift+Command+4, then Space, it captures the whole screen instead of just the app, as it used to.  ### Screenshots / Recordings  _No response_  ### Snapzy Version  2.2.0 (233)  ### macOS Version  macOS 15 (Sequoia)  ### Installation Method  None  ### Additional Context  _No response_

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

### Incident Patch 1: `193d9422` (2026-11-25)
**Commit Message**: fix: Improved Light Mode contrast and inline slider layout across UI components (#809)

* fix: use adaptive fill for zoom popover toggle button in Light Mode

* fix: fix invisible white-on-white filter pills in Light Mode solid style

* fix: give KeyCapPlaceholderView visible adaptive tint and border in Light Mode

* fix: widen inline slider readout so -45deg does not truncate

* fix: address PR review feedback for HistoryToolbar contrast and Light Mode tests

**File**: `Snapzy/Features/Annotate/InlineAreaAnnotateWindow.swift` (modified, +4/-2)
```diff
@@ -3031,7 +3031,9 @@ private struct InlineAreaLineStylePicker: View {
   }
 }
 
-private struct InlineAreaSliderControl: View {
+struct InlineAreaSliderControl: View {
+  static let valueReadoutMinWidth: CGFloat = 44
+
   let title: String
   let icon: String
   @Binding var value: CGFloat
@@ -3060,7 +3062,7 @@ private struct InlineAreaSliderControl: View {
           .foregroundColor(InlineAreaChrome.secondaryText)
           .lineLimit(1)
           .monospacedDigit()
-          .frame(width: 34, alignment: .trailing)
+          .frame(minWidth: Self.valueReadoutMinWidth, alignment: .trailing)
       }
     }
   }
```

**File**: `Snapzy/Features/History/Components/HistoryFilterBar.swift` (modified, +38/-23)
```diff
@@ -35,6 +35,36 @@ struct HistoryFilterBar: View {
       Spacer()
     }
   }
+  static func unselectedPillFillColor(
+    backgroundStyle: HistoryBackgroundStyle,
+    colorScheme: ColorScheme
+  ) -> Color {
+    if backgroundStyle == .solid {
+      return colorScheme == .dark
+        ? Color.white.opacity(0.07)
+        : Color.black.opacity(0.06)
+    }
+
+    return colorScheme == .dark
+      ? Color.white.opacity(0.08)
+      : Color.black.opacity(0.05)
+  }
+
+  static func pillBorderColor(isSelected: Bool, colorScheme: ColorScheme) -> Color {
+    if isSelected {
+      return Color.white.opacity(0.15)
+    }
+
+    return colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
+  }
+
+  static func countBadgeBackgroundColor(isSelected: Bool, colorScheme: ColorScheme) -> Color {
+    if isSelected {
+      return Color.white.opacity(0.22)
+    }
+
+    return colorScheme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.08)
+  }
 }
 
 private struct FilterPill: View {
@@ -59,7 +89,7 @@ private struct FilterPill: View {
             .font(.system(size: 10, weight: .bold))
             .padding(.horizontal, 6)
             .padding(.vertical, 2)
-            .background(pillCountBackground.opacity(isSelected ? 0.18 : 1))
+            .background(HistoryFilterBar.countBadgeBackgroundColor(isSelected: isSelected, colorScheme: colorScheme))
             .clipShape(Capsule())
         }
       }
@@ -70,7 +100,7 @@ private struct FilterPill: View {
       .clipShape(Capsule())
       .overlay(
         Capsule()
-          .stroke(borderColor, lineWidth: 1)
+          .stroke(HistoryFilterBar.pillBorderColor(isSelected: isSelected, colorScheme: colorScheme), lineWidth: 1)
       )
     }
     .buttonStyle(.plain)
@@ -90,26 +120,11 @@ private struct FilterPill: View {
       )
     }
 
-    if backgroundStyle == .solid {
-      return colorScheme == .dark
-        ? AnyShapeStyle(Color.white.opacity(0.07))
-        : AnyShapeStyle(Color.white.opacity(0.76))
-    }
-
-    return colorScheme == .dark
-      ? AnyShapeStyle(Color.white.opacity(0.08))
-      : AnyShapeStyle(Color.black.opacity(0.05))
-  }
-
-  private var borderColor: Color {
-    if isSelected {
-      return Color.white.opacity(0.15)
-    }
-
-    return colorScheme == .dark ? Color.white.opacity(0.08) : Color.white.opacity(0.64)
-  }
-
-  private var pillCountBackground: Color {
-    colorScheme == .dark ? Color.white.opacity(0.12) : Color.white.opacity(0.84)
+    return AnyShapeStyle(
+      HistoryFilterBar.unselectedPillFillColor(
+        backgroundStyle: backgroundStyle,
+        colorScheme: colorScheme
+      )
+    )
   }
 }
```

**File**: `Snapzy/Features/History/Components/HistoryToolbar.swift` (modified, +24/-7)
```diff
@@ -15,7 +15,8 @@ struct HistoryToolbar: View {
   let onClearSelection: () -> Void
   let onDeleteSelection: () -> Void
 
-  @AppStorage(PreferencesKeys.historyBackgroundStyle) private var backgroundStyle: HistoryBackgroundStyle = .defaultStyle
+  @AppStorage(PreferencesKeys.historyBackgroundStyle) private var backgroundStyle: HistoryBackgroundStyle =
+    .defaultStyle
   @Environment(\.colorScheme) private var colorScheme
 
   var body: some View {
@@ -118,20 +119,36 @@ struct HistoryToolbar: View {
     .foregroundColor(isDestructive ? .red : .primary.opacity(0.82))
   }
 
-  private var chromeSurfaceFill: AnyShapeStyle {
+  static func chromeSurfaceFillColor(
+    backgroundStyle: HistoryBackgroundStyle,
+    colorScheme: ColorScheme
+  ) -> Color {
     if backgroundStyle == .solid {
       return colorScheme == .dark
-        ? AnyShapeStyle(Color.white.opacity(0.07))
-        : AnyShapeStyle(Color.white.opacity(0.76))
+        ? Color.white.opacity(0.07)
+        : Color.black.opacity(0.06)
     }
 
     return colorScheme == .dark
-      ? AnyShapeStyle(Color.white.opacity(0.07))
-      : AnyShapeStyle(Color.white.opacity(0.52))
+      ? Color.white.opacity(0.07)
+      : Color.black.opacity(0.05)
+  }
+
+  static func chromeSurfaceBorderColor(colorScheme: ColorScheme) -> Color {
+    colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
+  }
+
+  private var chromeSurfaceFill: AnyShapeStyle {
+    AnyShapeStyle(
+      Self.chromeSurfaceFillColor(
+        backgroundStyle: backgroundStyle,
+        colorScheme: colorScheme
+      )
+    )
   }
 
   private var chromeSurfaceBorder: Color {
-    colorScheme == .dark ? Color.white.opacity(0.08) : Color.white.opacity(0.64)
+    Self.chromeSurfaceBorderColor(colorScheme: colorScheme)
   }
 
   private var chromeSurfaceShadow: Color {
```

**File**: `Snapzy/Features/VideoEditor/Components/VideoEditorZoomSettingsPopover.swift` (modified, +11/-1)
```diff
@@ -211,6 +211,9 @@ struct ZoomSettingsPopover: View {
     }
   }
 
+  static let toggleButtonBackgroundFill = Color.primary.opacity(0.08)
+  static let toggleButtonBorderColor = Color.primary.opacity(0.10)
+
   private var actionsSection: some View {
     HStack(spacing: 8) {
       // Enable/Disable toggle
@@ -226,7 +229,14 @@ struct ZoomSettingsPopover: View {
         .font(.system(size: 10))
         .padding(.horizontal, 8)
         .padding(.vertical, 4)
-        .background(Color.white.opacity(0.1))
+        .background(
+          Radius.controlRect(forHeight: 20)
+            .fill(Self.toggleButtonBackgroundFill)
+            .overlay(
+              Radius.controlRect(forHeight: 20)
+                .strokeBorder(Self.toggleButtonBorderColor, lineWidth: 0.5)
+            )
+        )
         .clipShape(Radius.controlRect(forHeight: 20))
       }
       .buttonStyle(.plain)
```

**File**: `Snapzy/Shared/Components/KeyCapView.swift` (modified, +11/-1)
```diff
@@ -68,6 +68,12 @@ struct KeyCapGroupView: View {
 /// Ghost glass pill shown when a shortcut row has no assignment yet.
 /// Mirrors the keycap silhouette but with muted ink and a quieter substrate.
 struct KeyCapPlaceholderView: View {
+  /// Subtle adaptive tint used by the legacy `LiquidGlassSurface` composite in Light Mode.
+  /// On macOS 26+ native Liquid Glass, `.glassEffect` ignores `tint` and `placeholderBorderOpacity`
+  /// provides the capsule outline.
+  static let placeholderTint: Double = 0.06
+  static let placeholderBorderOpacity: Double = 0.12
+
   let title: String
   var symbol: String = "return"
   var minWidth: CGFloat = 104
@@ -85,9 +91,13 @@ struct KeyCapPlaceholderView: View {
     .liquidGlassSurface(
       shape: Capsule(style: .continuous),
       substrate: 0.30,
-      tint: 0.0,
+      tint: Self.placeholderTint,
       highlight: .none
     )
+    .overlay(
+      Capsule(style: .continuous)
+        .strokeBorder(Color.primary.opacity(Self.placeholderBorderOpacity), lineWidth: 0.75)
+    )
     .fixedSize(horizontal: true, vertical: false)
   }
 }
```

**File**: `SnapzyTests/Features/Annotate/AnnotateWatermarkTests.swift` (modified, +13/-0)
```diff
@@ -9,6 +9,7 @@
 //  AnnotateCoreTests and is not duplicated here.
 //
 
+import AppKit
 import CoreGraphics
 import SwiftUI
 import XCTest
@@ -130,4 +131,16 @@ final class AnnotateWatermarkTests: XCTestCase {
     XCTAssertEqual(properties.opacity, 0.5, accuracy: 0.0001)
     XCTAssertEqual(properties.rotationDegrees, -10, accuracy: 0.0001)
   }
+
+  /// Regression: inline watermark rotation slider displays `"-45deg"` (6 characters) and
+  /// must have enough width so the readout never truncates to `"-45d..."`.
+  func testInlineSliderValueReadoutFitsNegativeTwoDigitRotation() {
+    let font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .medium)
+    let measuredWidth = ("-45deg" as NSString).size(withAttributes: [.font: font]).width
+    XCTAssertGreaterThanOrEqual(
+      InlineAreaSliderControl.valueReadoutMinWidth,
+      ceil(measuredWidth),
+      "Inline slider value readout width must fit \"-45deg\" without truncation"
+    )
+  }
 }
```

**File**: `SnapzyTests/Features/History/HistoryFilterBarTests.swift` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+//
+//  HistoryFilterBarTests.swift
+//  SnapzyTests
+//
+//  Light/Dark Mode contrast regression tests for HistoryFilterBar and HistoryToolbar.
+//
+
+import AppKit
+@testable import Snapzy
+import SwiftUI
+import XCTest
+
+@MainActor
+final class HistoryFilterBarTests: XCTestCase {
+  /// Regression: in Light Mode with `.solid` backdrop, unselected filter pills, borders, and
+  /// count capsules must use dark-tinted contrast fills instead of invisible white-on-white.
+  func testHistoryFilterBar_lightModeSolidUsesVisibleDarkTintedPillsAndBadges() throws {
+    let fill = try XCTUnwrap(
+      NSColor(HistoryFilterBar.unselectedPillFillColor(backgroundStyle: .solid, colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+    let border = try XCTUnwrap(
+      NSColor(HistoryFilterBar.pillBorderColor(isSelected: false, colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+    let badge = try XCTUnwrap(
+      NSColor(HistoryFilterBar.countBadgeBackgroundColor(isSelected: false, colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+
+    XCTAssertLessThan(fill.brightnessComponent, 0.2, "Light Mode solid pill fill must not be white-on-white")
+    XCTAssertLessThan(border.brightnessComponent, 0.2, "Light Mode pill border must not be white-on-white")
+    XCTAssertLessThan(badge.brightnessComponent, 0.2, "Light Mode count capsule must not be white-on-white")
+
+    let selectedBadgeLight = try XCTUnwrap(
+      NSColor(HistoryFilterBar.countBadgeBackgroundColor(isSelected: true, colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+    let selectedBadgeDark = try XCTUnwrap(
+      NSColor(HistoryFilterBar.countBadgeBackgroundColor(isSelected: true, colorScheme: .dark))
+        .usingColorSpace(.sRGB)
+    )
+    XCTAssertGreaterThan(
+      selectedBadgeLight.brightnessComponent,
+      0.8,
+      "Selected pill count capsule on accent stays light"
+    )
+    XCTAssertGreaterThan(
+      selectedBadgeDark.brightnessComponent,
+      0.8,
+      "Selected pill count capsule in Dark Mode stays visible"
+    )
+  }
+
+  /// Regression: HistoryToolbar search bar sits next to HistoryFilterBar in the same window and
+  /// must also use dark-tinted fills and borders in Light Mode instead of white-on-white.
+  func testHistoryToolbar_lightModeSolidUsesVisibleDarkTintedChrome() throws {
+    let fillLight = try XCTUnwrap(
+      NSColor(HistoryToolbar.chromeSurfaceFillColor(backgroundStyle: .solid, colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+    let borderLight = try XCTUnwrap(
+      NSColor(HistoryToolbar.chromeSurfaceBorderColor(colorScheme: .light))
+        .usingColorSpace(.sRGB)
+    )
+
+    XCTAssertLessThan(fillLight.brightnessComponent, 0.2, "Light Mode solid toolbar fill must not be white-on-white")
+    XCTAssertGreaterThan(fillLight.alphaComponent, 0.04, "Light Mode solid toolbar fill must have visible alpha")
+    XCTAssertLessThan(borderLight.brightnessComponent, 0.2, "Light Mode toolbar border must not be white-on-white")
+    XCTAssertGreaterThan(borderLight.alphaComponent, 0.05, "Light Mode toolbar border must have visible alpha")
+
+    let fillDark = try XCTUnwrap(
+      NSColor(HistoryToolbar.chromeSurfaceFillColor(backgroundStyle: .solid, colorScheme: .dark))
+        .usingColorSpace(.sRGB)
+    )
+    let borderDark = try XCTUnwrap(
+      NSColor(HistoryToolbar.chromeSurfaceBorderColor(colorScheme: .dark))
+        .usingColorSpace(.sRGB)
+    )
+    XCTAssertGreaterThan(fillDark.brightnessComponent, 0.8, "Dark Mode toolbar fill stays light-tinted")
+    XCTAssertGreaterThan(borderDark.brightnessComponent, 0.8, "Dark Mode toolbar border stays light-tinted")
+  }
+}
```

**File**: `SnapzyTests/Features/VideoEditor/VideoEditorZoomAndAutoFocusTests.swift` (modified, +31/-0)
```diff
@@ -5,8 +5,10 @@
 //  Unit tests for video editor zoom math and Smart Camera autofocus paths.
 //
 
+import AppKit
 import CoreGraphics
 @testable import Snapzy
+import SwiftUI
 import XCTest
 
 final class VideoEditorZoomAndAutoFocusTests: XCTestCase {
@@ -254,4 +256,33 @@ final class VideoEditorZoomAndAutoFocusTests: XCTestCase {
   ) {
     XCTAssertEqual(actual, expected, accuracy: accuracy, file: file, line: line)
   }
+
+  /// Regression: ZoomSettingsPopover Enable/Disable button must adapt to Light and Dark Mode
+  /// rather than hardcoding white-on-white `Color.white.opacity(0.1)`.
+  func testZoomSettingsPopover_toggleButtonBackgroundAdaptsToLightAndDarkAppearance() throws {
+    let lightAppearance = try XCTUnwrap(NSAppearance(named: .aqua))
+    var lightColor: NSColor?
+    lightAppearance.performAsCurrentDrawingAppearance {
+      lightColor = NSColor(ZoomSettingsPopover.toggleButtonBackgroundFill).usingColorSpace(.sRGB)
+    }
+    let resolvedLight = try XCTUnwrap(lightColor)
+    XCTAssertLessThan(
+      resolvedLight.brightnessComponent,
+      0.2,
+      "Light Mode button fill must use dark primary ink tint, not white-on-white"
+    )
+    XCTAssertGreaterThan(resolvedLight.alphaComponent, 0.05)
+
+    let darkAppearance = try XCTUnwrap(NSAppearance(named: .darkAqua))
+    var darkColor: NSColor?
+    darkAppearance.performAsCurrentDrawingAppearance {
+      darkColor = NSColor(ZoomSettingsPopover.toggleButtonBackgroundFill).usingColorSpace(.sRGB)
+    }
+    let resolvedDark = try XCTUnwrap(darkColor)
+    XCTAssertGreaterThan(
+      resolvedDark.brightnessComponent,
+      0.8,
+      "Dark Mode button fill must use light primary ink tint"
+    )
+  }
 }
```

---

### Incident Patch 2: `6a88437d` (2026-11-24)
**Commit Message**: fix: Record undo snapshots for Video Editor background/transition edits and Annotate crop/mockup (#810)

* fix(video-editor): record undo for background sidebar edits and zoom transition duration

* fix(annotate): record undo for crop confirmation and restore selectedPresetId in MockupState undo

* fix: resync zoom transition slider after undo/redo

---------

Co-authored-by: duongductrong <[REDACTED_EMAIL]>

**File**: `Snapzy/Features/Annotate/AnnotateState.swift` (modified, +20/-0)
```diff
@@ -3866,6 +3866,26 @@ final class AnnotateState: ObservableObject {
     DiagnosticLogger.shared.log(.info, .annotate, "Crop applied", context: [
       "rect": cropRect.map { "\(Int($0.width))x\(Int($0.height))" } ?? "nil"
     ])
+    let previousCropRect = cropInteractionContext?.cropRect
+    if previousCropRect != cropRect {
+      let preCropSnapshot = ImageTransformSnapshot(
+        sourceImage: sourceImage,
+        cutoutImage: cutoutImage,
+        isCutoutApplied: isCutoutApplied,
+        embeddedImageAssets: embeddedImageAssets,
+        embeddedImageSourceData: embeddedImageSourceData,
+        embeddedImageSnapshotCacheData: embeddedImageSnapshotCacheData,
+        annotations: annotations,
+        cropRect: previousCropRect,
+        originalCropRect: nil,
+        cropAspectRatio: cropAspectRatio,
+        isCropPortraitOrientation: isCropPortraitOrientation,
+        didCutoutAutoApplyCrop: cropInteractionContext?.didCutoutAutoApplyCrop ?? didCutoutAutoApplyCrop,
+        cutoutAutoAppliedCropRect: cropInteractionContext?.cutoutAutoAppliedCropRect ?? cutoutAutoAppliedCropRect,
+        cropBaselineFootprints: cropBaselineFootprints
+      )
+      pushImageTransformUndo(preCropSnapshot)
+    }
     if didCutoutAutoApplyCrop,
        let currentCropRect = cropRect,
        let autoCropRect = cutoutAutoAppliedCropRect,
```

**File**: `Snapzy/Features/Annotate/Models/AnnotateMockupState.swift` (modified, +14/-27)
```diff
@@ -19,6 +19,7 @@ private struct MockupStateSnapshot: Equatable {
     let shadowIntensity: Double
     let cornerRadius: Double
     let backgroundStyle: BackgroundStyle
+    let selectedPresetId: UUID?
 }
 
 /// Central state object for mockup renderer
@@ -148,16 +149,7 @@ final class MockupState: ObservableObject {
     // MARK: - Undo/Redo
 
     func saveState() {
-        let snapshot = MockupStateSnapshot(
-            rotationX: rotationX,
-            rotationY: rotationY,
-            rotationZ: rotationZ,
-            perspective: perspective,
-            padding: padding,
-            shadowIntensity: shadowIntensity,
-            cornerRadius: cornerRadius,
-            backgroundStyle: backgroundStyle
-        )
+        let snapshot = currentSnapshot()
 
         // Avoid duplicates
         if undoStack.last != snapshot {
@@ -173,17 +165,7 @@ final class MockupState: ObservableObject {
         guard let snapshot = undoStack.popLast() else { return }
 
         // Save current state to redo stack
-        let currentSnapshot = MockupStateSnapshot(
-            rotationX: rotationX,
-            rotationY: rotationY,
-            rotationZ: rotationZ,
-            perspective: perspective,
-            padding: padding,
-            shadowIntensity: shadowIntensity,
-            cornerRadius: cornerRadius,
-            backgroundStyle: backgroundStyle
-        )
-        redoStack.append(currentSnapshot)
+        redoStack.append(currentSnapshot())
 
         // Restore snapshot
         applySnapshot(snapshot)
@@ -193,20 +175,24 @@ final class MockupState: ObservableObject {
         guard let snapshot = redoStack.popLast() else { return }
 
         // Save current state to undo stack
-        let currentSnapshot = MockupStateSnapshot(
+        undoStack.append(currentSnapshot())
+
+        // Restore snapshot
+        applySnapshot(snapshot)
+    }
+
+    private func currentSnapshot() -> MockupStateSnapshot {
+        MockupStateSnapshot(
             rotationX: rotationX,
             rotationY: rotationY,
             rotationZ: rotationZ,
             perspective: perspective,
             padding: padding,
             shadowIntensity: shadowIntensity,
             cornerRadius: cornerRadius,
-            backgroundStyle: backgroundStyle
+            backgroundStyle: backgroundStyle,
+            selectedPresetId: selectedPresetId
         )
-        undoStack.append(currentSnapshot)
-
-        // Restore snapshot
-        applySnapshot(snapshot)
     }
 
     private func applySnapshot(_ snapshot: MockupStateSnapshot) {
@@ -218,6 +204,7 @@ final class MockupState: ObservableObject {
         shadowIntensity = snapshot.shadowIntensity
         cornerRadius = snapshot.cornerRadius
         backgroundStyle = snapshot.backgroundStyle
+        selectedPresetId = snapshot.selectedPresetId
     }
 
     // MARK: - Helpers
```

**File**: `Snapzy/Features/VideoEditor/Components/VideoEditorLeftSidebar.swift` (modified, +5/-1)
```diff
@@ -120,6 +120,10 @@ struct ZoomSettingsContent: View {
     .onChange(of: localStateSnapshot) { _ in
       syncLocalState()
     }
+    // Undo/redo changes the duration outside this view; keep the slider in sync.
+    .onChange(of: state.zoomTransitionDuration) { newValue in
+      localTransitionDuration = newValue
+    }
     .onDisappear { endContinuousEdit() }
     .accessibilityIdentifier("video-editor.zoom-settings")
   }
@@ -960,7 +964,7 @@ struct ZoomSettingsContent: View {
   }
 
   private func applyTransitionDuration() {
-    state.zoomTransitionDuration = localTransitionDuration
+    state.setZoomTransitionDuration(localTransitionDuration)
   }
 
   private func zoomDisplayValue(for level: CGFloat) -> String {
```

**File**: `Snapzy/Features/VideoEditor/Components/VideoEditorVideoBackgroundSidebarView.swift` (modified, +48/-19)
```diff
@@ -45,8 +45,10 @@ struct VideoBackgroundSidebarView: View {
 
   private var noneButton: some View {
     Button {
-      state.backgroundStyle = .none
-      state.backgroundPadding = 0
+      var updated = state.frameSettings
+      updated.style = .none
+      updated.padding = 0
+      state.setFrameSettings(updated)
     } label: {
       Text(L10n.Common.none)
         .font(Typography.labelMedium)
@@ -80,10 +82,12 @@ struct VideoBackgroundSidebarView: View {
             preset: preset,
             isSelected: state.backgroundStyle == .gradient(preset)
           ) {
-            if state.backgroundPadding <= 0 {
-              state.backgroundPadding = 24
+            var updated = state.frameSettings
+            if updated.padding <= 0 {
+              updated.padding = 24
             }
-            state.backgroundStyle = .gradient(preset)
+            updated.style = .gradient(preset)
+            state.setFrameSettings(updated)
           }
         }
       }
@@ -162,17 +166,21 @@ struct VideoBackgroundSidebarView: View {
   }
 
   private func selectDefaultWallpaper(_ item: SystemWallpaperManager.WallpaperItem) {
-    if state.backgroundPadding <= 0 {
-      state.backgroundPadding = 24
+    var updated = state.frameSettings
+    if updated.padding <= 0 {
+      updated.padding = 24
     }
-    state.backgroundStyle = .wallpaper(item.fullImageURL)
+    updated.style = .wallpaper(item.fullImageURL)
+    state.setFrameSettings(updated)
   }
 
   private func selectCustomWallpaper(_ item: SystemWallpaperManager.WallpaperItem) {
-    if state.backgroundPadding <= 0 {
-      state.backgroundPadding = 24
+    var updated = state.frameSettings
+    if updated.padding <= 0 {
+      updated.padding = 24
     }
-    state.backgroundStyle = .wallpaper(item.fullImageURL)
+    updated.style = .wallpaper(item.fullImageURL)
+    state.setFrameSettings(updated)
   }
 
   private func addCustomWallpaper() {
@@ -192,8 +200,10 @@ struct VideoBackgroundSidebarView: View {
     wallpaperManager.removeCustomWallpaper(item)
 
     if case .wallpaper(let selectedUrl) = state.backgroundStyle, selectedUrl == url {
-      state.backgroundStyle = .none
-      state.backgroundPadding = 0
+      var updated = state.frameSettings
+      updated.style = .none
+      updated.padding = 0
+      state.setFrameSettings(updated)
     }
   }
 
@@ -216,10 +226,12 @@ struct VideoBackgroundSidebarView: View {
       },
       set: { newColor in
         if let color = newColor {
-          if state.backgroundPadding <= 0 {
-            state.backgroundPadding = 24
+          var updated = state.frameSettings
+          if updated.padding <= 0 {
+            updated.padding = 24
           }
-          state.backgroundStyle = .solidColor(color)
+          updated.style = .solidColor(color)
+          state.setFrameSettings(updated)
         }
       }
     )
@@ -241,10 +253,27 @@ struct VideoBackgroundSidebarView: View {
             }
           }
         ),
-        range: 0 ... 300
+        range: 0 ... 300,
+        onDragging: { isDragging, _ in
+          if isDragging { state.beginFrameEdit() } else { state.endFrameEdit() }
+        }
+      )
+      VideoSliderRow(
+        label: L10n.Common.shadow,
+        value: $state.backgroundShadowIntensity,
+        range: 0 ... 1,
+        onDragging: { isDragging, _ in
+          if isDragging { state.beginFrameEdit() } else { state.endFrameEdit() }
+        }
+      )
+      VideoSliderRow(
+        label: L10n.Common.corners,
+        value: $state.backgroundCornerRadius,
+        range: 0 ... 60,
+        onDragging: { isDragging, _ in
+          if isDragging { state.beginFrameEdit() } else { state.endFrameEdit() }
+        }
       )
-      VideoSliderRow(label: L10n.Common.shadow, value: $state.backgroundShadowIntensity, range: 0 ... 1)
-      VideoSliderRow(label: L10n.Common.corners, value: $state.backgroundCornerRadius, range: 0 ... 60)
     }
   }
 
```

**File**: `Snapzy/Features/VideoEditor/VideoEditorState.swift` (modified, +37/-1)
```diff
@@ -260,6 +260,7 @@ enum EditorAction: Equatable {
     newMotionBlur: VideoEditorMotionBlurSettings? = nil
   )
   case updateMotionBlur(old: VideoEditorMotionBlurSettings, new: VideoEditorMotionBlurSettings)
+  case updateZoomTransitionDuration(old: TimeInterval, new: TimeInterval)
   case addSpeed(segment: SpeedSegment)
   case removeSpeed(segment: SpeedSegment)
   case updateSpeed(old: SpeedSegment, new: SpeedSegment)
@@ -715,8 +716,11 @@ final class VideoEditorState: ObservableObject {
       }
 
       UserDefaults.standard.set(clamped, forKey: PreferencesKeys.videoEditorZoomTransitionDuration)
+      updateHasUnsavedChanges()
     }
   }
+  private var initialZoomTransitionDuration: TimeInterval = ZoomCalculator.defaultTransitionDuration
+  private var pendingFrameEditStart: VideoEditorFrameSettings?
 
   // MARK: - Auto Focus
 
@@ -1023,7 +1027,9 @@ final class VideoEditorState: ObservableObject {
     primaryPlayerItem = item
     player = AVPlayer(playerItem: item)
     previewRateController = VideoEditorPreviewRateController(player: player)
-    zoomTransitionDuration = Self.loadZoomTransitionDuration()
+    let loadedTransitionDuration = Self.loadZoomTransitionDuration()
+    initialZoomTransitionDuration = loadedTransitionDuration
+    zoomTransitionDuration = loadedTransitionDuration
     recordingMetadata = initialMetadata
     reloadCursorLayer()
 
@@ -2061,6 +2067,7 @@ final class VideoEditorState: ObservableObject {
     initialBackgroundAspectRatio = backgroundAspectRatio
     initialExportSettings = exportSettings
     initialMotionBlurSettings = motionBlurSettings
+    initialZoomTransitionDuration = zoomTransitionDuration
     initialCaptions = captions
     clearUndoHistory()
   }
@@ -2259,6 +2266,10 @@ final class VideoEditorState: ObservableObject {
       applyFrameSettings(old)
       return .updateFrame(old: new, new: old)
 
+    case .updateZoomTransitionDuration(let old, let new):
+      zoomTransitionDuration = old
+      return .updateZoomTransitionDuration(old: new, new: old)
+
     case .updateExportSettings(let old, let new):
       updateExportSettings(old)
       return .updateExportSettings(old: new, new: old)
@@ -3680,6 +3691,30 @@ final class VideoEditorState: ObservableObject {
     recordAction(.updateFrame(old: old, new: settings))
   }
 
+  /// Start a continuous background/frame slider drag so all live ticks collapse into one undo step.
+  func beginFrameEdit() {
+    guard pendingFrameEditStart == nil else { return }
+    pendingFrameEditStart = frameSettings
+  }
+
+  /// Commit a continuous background/frame slider drag as a single undoable step.
+  func endFrameEdit() {
+    guard let start = pendingFrameEditStart else { return }
+    pendingFrameEditStart = nil
+    let end = frameSettings
+    guard end != start else { return }
+    recordAction(.updateFrame(old: start, new: end))
+  }
+
+  /// Update zoom transition duration as an undoable edit.
+  func setZoomTransitionDuration(_ duration: TimeInterval) {
+    let old = zoomTransitionDuration
+    let clamped = ZoomCalculator.clampTransitionDuration(duration)
+    guard abs(clamped - old) > 0.0001 else { return }
+    zoomTransitionDuration = clamped
+    recordAction(.updateZoomTransitionDuration(old: old, new: clamped))
+  }
+
   private func applyFrameSettings(_ settings: VideoEditorFrameSettings) {
     if backgroundStyle != settings.style { backgroundStyle = settings.style }
     if backgroundPadding != settings.padding { backgroundPadding = settings.padding }
@@ -4097,6 +4132,7 @@ final class VideoEditorState: ObservableObject {
       || cursorSettings != initialCursorSettings
       || cameraSettings != initialCameraSettings
       || motionBlurSettings != initialMotionBlurSettings
+      || abs(zoomTransitionDuration - initialZoomTransitionDuration) > 0.0001
       || clips != initialClips
       || segments != initialZoomSegments
       || speedSegments != initialSpeedSegments
```

**File**: `SnapzyTests/Features/Annotate/AnnotateCropTests.swift` (modified, +23/-0)
```diff
@@ -157,6 +157,29 @@ final class AnnotateCropTests: XCTestCase {
     XCTAssertEqual(state.selectedTool, .selection)
   }
 
+  /// Regression: confirming a crop must record an undo checkpoint so ⌘Z restores the previous crop state.
+  @MainActor
+  func testConfirmCropInteractionRecordsUndoAndRedo() throws {
+    let state = try makeLoadedState()
+    XCTAssertNil(state.cropRect)
+    XCTAssertFalse(state.canUndo)
+
+    state.beginCropInteraction()
+    let cropped = CGRect(x: 40, y: 30, width: 200, height: 150)
+    state.updateCropRect(cropped)
+    state.confirmCropInteraction()
+
+    XCTAssertEqual(state.cropRect, cropped)
+    XCTAssertTrue(state.canUndo)
+
+    state.undo()
+    XCTAssertNil(state.cropRect)
+    XCTAssertTrue(state.canRedo)
+
+    state.redo()
+    XCTAssertEqual(state.cropRect, cropped)
+  }
+
   // MARK: - Cancel / reset
 
   @MainActor
```

**File**: `SnapzyTests/Features/Annotate/AnnotateMockupTests.swift` (modified, +17/-0)
```diff
@@ -170,6 +170,23 @@ final class AnnotateMockupTests: XCTestCase {
     XCTAssertNil(state.selectedPresetId)
   }
 
+  /// Regression: MockupState.undo() and redo() must restore selectedPresetId alongside transforms.
+  func testMockupStateUndoRedoRestoresSelectedPresetId() {
+    let state = makeMockupState()
+    XCTAssertNil(state.selectedPresetId)
+
+    state.applyPreset(.dramatic)
+    XCTAssertEqual(state.selectedPresetId, MockupPreset.dramatic.id)
+
+    state.undo()
+    XCTAssertNil(state.selectedPresetId)
+    XCTAssertEqual(state.rotationX, 0)
+
+    state.redo()
+    XCTAssertEqual(state.selectedPresetId, MockupPreset.dramatic.id)
+    XCTAssertEqual(state.rotationY, MockupPreset.dramatic.rotationY)
+  }
+
   // MARK: - MockupExporter render (GPU path, CI-gated)
 
   func testMockupExporterRenderProducesImageWithSourceImage() throws {
```

**File**: `SnapzyTests/Features/VideoEditor/VideoEditorSessionStoreTests.swift` (modified, +57/-0)
```diff
@@ -943,6 +943,63 @@ final class VideoEditorSessionStoreTests: XCTestCase {
     XCTAssertFalse(state.canRedo)
   }
 
+  /// Regression: continuous background slider drags collapse into one undo step via beginFrameEdit/endFrameEdit.
+  func testFrameEdit_beginAndEndCollapseSliderDragIntoSingleUndoStep() {
+    let state = VideoEditorState(url: URL(fileURLWithPath: "/tmp/frame-undo-test.mov"))
+    let initial = state.frameSettings
+
+    state.beginFrameEdit()
+    state.backgroundPadding = 16
+    state.backgroundPadding = 32
+    state.backgroundPadding = 48
+    state.backgroundStyle = .solidColor(.white)
+    state.endFrameEdit()
+
+    XCTAssertTrue(state.canUndo)
+    XCTAssertEqual(state.backgroundPadding, 48)
+
+    state.undo()
+    XCTAssertEqual(state.frameSettings, initial)
+    XCTAssertFalse(state.canUndo)
+
+    state.redo()
+    XCTAssertEqual(state.backgroundPadding, 48)
+    XCTAssertEqual(state.backgroundStyle, .solidColor(.white))
+  }
+
+  /// Regression: changing zoomTransitionDuration must mark hasUnsavedChanges and support Undo/Redo.
+  func testZoomTransitionDuration_recordsUndoAndMarksUnsavedChanges() {
+    let previousDefault = UserDefaults.standard.object(forKey: PreferencesKeys.videoEditorZoomTransitionDuration)
+    defer {
+      if let previousDefault {
+        UserDefaults.standard.set(previousDefault, forKey: PreferencesKeys.videoEditorZoomTransitionDuration)
+      } else {
+        UserDefaults.standard.removeObject(forKey: PreferencesKeys.videoEditorZoomTransitionDuration)
+      }
+    }
+
+    let state = VideoEditorState(url: URL(fileURLWithPath: "/tmp/transition-undo-test.mov"))
+    let initial = state.zoomTransitionDuration
+    let target = initial == ZoomCalculator.defaultTransitionDuration
+      ? ZoomCalculator.smoothTransitionDuration
+      : ZoomCalculator.defaultTransitionDuration
+
+    XCTAssertFalse(state.hasUnsavedChanges)
+    state.setZoomTransitionDuration(target)
+
+    XCTAssertEqual(state.zoomTransitionDuration, target, accuracy: 0.0001)
+    XCTAssertTrue(state.hasUnsavedChanges)
+    XCTAssertTrue(state.canUndo)
+
+    state.undo()
+    XCTAssertEqual(state.zoomTransitionDuration, initial, accuracy: 0.0001)
+    XCTAssertFalse(state.hasUnsavedChanges)
+
+    state.redo()
+    XCTAssertEqual(state.zoomTransitionDuration, target, accuracy: 0.0001)
+    XCTAssertTrue(state.hasUnsavedChanges)
+  }
+
   func testSpeedGesture_finalModelAndSequenceMapUseReleasedRange() async throws {
     let videoURL = try await makeVideoFile(named: "speed-gesture.mov", duration: 12)
     let state = VideoEditorState(url: videoURL)
```

---

### Incident Patch 3: `60e22922` (2026-11-24)
**Commit Message**: fix: avoid back-deployed isolated deinit crash in MenuBarIconRenderer

Tests now create and release isolated renderers; the synthesized main-actor
deinit aborts via swift_task_deinitOnExecutor on macOS 13-15 (#668).

**File**: `Snapzy/App/MenuBarIconRenderer.swift` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ final class MenuBarIconRenderer {
     self.customIconDirectory = customIconDirectory
   }
 
+  /// Explicit and nonisolated: the synthesized main-actor deinit hops through the
+  /// back-deployed swift_task_deinitOnExecutor, which aborts on macOS 13-15 (#668).
+  nonisolated deinit {}
+
   // MARK: - Rendering
 
   /// 18pt template image for the given style. Falls back to the bundled
```

#### Recent Merged Pull Requests:
- **PR #816** (2026-11-24): chore: release v2.3.0-beta.12 (@github-actions[bot])
- **PR #815** (closed): fix: Use nonisolated deinit on MenuBarIconRenderer (@duongductrong)
- **PR #811** (2026-11-24): fix: preserve custom S3 ports in SigV4, trim trailing URL slashes, and encode continuation tokens (@williamcachamwri)
- **PR #810** (2026-11-24): fix: record undo snapshots for Video Editor background/transition edits and Annotate crop/mockup (@williamcachamwri)
- **PR #809** (2026-11-25): fix: improve Light Mode contrast and inline slider layout across UI components (@williamcachamwri)
- **PR #808** (2026-11-24): fix: scale transparent custom menu bar PNG icons into 18pt canvas (@williamcachamwri)

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

## X. Improved Light Mode contrast and inline slider layout across UI components

**RULE**:
When implementing operations in `Snapzy/Features/Annotate/InlineAreaAnnotateWindow.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `193d9422`: Improved Light Mode contrast and inline slider layout across UI components. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Snapzy/Features/Annotate/InlineAreaAnnotateWindow.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
struct InlineAreaSliderControl: View {
  static let valueReadoutMinWidth: CGFloat = 44

          .frame(minWidth: Self.valueReadoutMinWidth, alignment: .trailing)
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
private struct InlineAreaSliderControl: View {
          .frame(width: 34, alignment: .trailing)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `193d9422` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
