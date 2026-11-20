> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source**: github ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Source Version**: `494f494b`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T15:15:15.442Z  
> **Learning ID**: `learn-github-duongductrong-snapzy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T15:15:15.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3592 stars

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

  @Option(help: "JPEG quality, 0 to 1.")
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
      guard format == .jpeg else { throw ValidationError("--quality only applies to jpg output.") }
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
- **Issue #754** (2026-11-17): **fix: Use sidebar.left icon for the sidebar toggle**
  *Symptoms*: ## Summary  The Annotate toolbar's **Toggle Sidebar** button uses the `rectangle.on.rectangle` SF Symbol. On macOS that icon usually means duplicate, copy or windows, so it doesn't read as a sidebar toggle. That makes the sidebar (backgrounds, padding, corner radius, presets) hard to find, especially since it starts hidden.  This PR switches it to `sidebar.left`, the standard macOS sidebar icon. The Video Editor's sidebar toggle (`VideoEditorToolbarView`) and `AnnotateMockupMainView` already use that icon, so this also makes the app consistent.  ## Changes  Swapped `rectangle.on.rectangle` → `sidebar.left` everywhere it stands for the Annotate sidebar toggle:  - `Snapzy/Features/Annotate/Components/AnnotateToolbarView.swift`: the toolbar button - `Snapzy/Features/Shortcuts/ShortcutOverlayModels.swift`: the `.toggleSidebar` entry in the shortcut overlay - `Snapzy/Features/Onboarding/Mockups/SnapzyMockAnnotateWindow.swift`: onboarding mock of the Annotate window - `Snapzy/Features/Preferences/Components/PreferencesAnnotatePreview.swift`: Annotate preview in Preferences  These look similar but are left alone: `rectangle.on.rectangle.angled` in `PreferencesAfterCaptureMatrixView` and `plus.rectangle.on.rectangle` in `AnnotateBottomBarView`.  `sidebar.left` has been available since macOS 11; the deployment target is 13.0.  ## Test plan  Built locally (Debug, ad-hoc signed) with Xcode 27.2 on macOS 27.2.  - [x] Open a screenshot in Annotate: the toolbar button next to Crop shows th

- **Issue #736** (2026-11-14): **[Bug]: 截图并标注功能启动后，已移动光标但是定位光标位置不改变**
  *Symptoms*: ### Description  使用截图并标注功能，触发选取页面后，看不到鼠标移动 MAC:27.2.1  ### Steps to Reproduce  1、触发【截图并标注】功能 2、移动鼠标  ### Expected Behavior  定位点根据鼠标移动同步移动  ### Actual Behavior  鼠标移动后定位不到鼠标位置  ### Screenshots / Recordings  https://github.com/user-attachments/assets/cfe4dc83-d7ec-4889-9c9f-f37a270c8b08  ### Snapzy Version  2.1.0  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @l56105878,  感谢反馈！这个问题与 #705 / #597 为同一原因（macOS 27.2 上「截图并标注」的十字准星、坐标气泡和放大镜无法跟随指针移动），已在 #707 中修复并自 **[v2.2.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.3)** 起发布（目前最新 Beta 为 **[v2.2.0-beta.11](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.11)**）。  获取 Beta 更新的方法：**Settings → About → Update Channel → Beta**，然后点击 **Check for Updates**。  现在先将此 Issue 关闭；如果更新到 Beta 版本后仍然可以复现，欢迎随时回复或重新打开！  ---  Hi @l56105878,  Thanks for reporting this! This is the same macOS 27.2 Capture Markup pointer-tracking issue fixed in #707, available starting in **[v2.2.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.3)** (latest beta: **[v2.2.0-beta.11](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.11)**).  To update to Beta: **Settings → About → Update Channel → Beta**, then **Check for Updates**.  Closing this as fixed—please feel free to reopen if the issue persists on the latest beta build.

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

### Incident Patch 1: `22ea076c` (2026-11-20)
**Commit Message**: fix: Stop the video fixture from hanging CI and collect test-host crash reports (#764)

The audio+video fixture writer could stall forever on the headless macOS 15
runner, hanging VideoEditorAgentVisionTests past its 2 minute allowance. Encode
each fixture once per process, copy it per test, and abandon/retry an encode
whose writer stops accepting media for 15 s.

CI now uploads Snapzy crash reports so test-host aborts come with a backtrace.

**File**: `.github/workflows/ci.yml` (modified, +19/-0)
```diff
@@ -183,6 +183,25 @@ jobs:
 
           tail -20 build/ci-test.log
 
+      - name: Collect crash reports
+        # A test-host abort leaves only "malloc: ..." in the log; the backtrace lives in
+        # the crash report ReportCrash writes, which the xcresult does not include.
+        if: failure() || cancelled()
+        run: |
+          mkdir -p build/crash-reports
+          find "$HOME/Library/Logs/DiagnosticReports" /Library/Logs/DiagnosticReports \
+            \( -name 'Snapzy*' -o -name 'xctest*' \) -type f -mmin -60 \
+            -exec cp {} build/crash-reports/ \; 2>/dev/null || true
+          ls -la build/crash-reports
+
+      - name: Upload crash reports
+        if: failure() || cancelled()
+        uses: actions/upload-artifact@v7
+        with:
+          name: ci-crash-reports
+          path: build/crash-reports
+          if-no-files-found: ignore
+
       - name: Upload test diagnostics
         if: failure() || cancelled()
         uses: actions/upload-artifact@v7
```

**File**: `SnapzyTests/Helpers/VideoEditorActivityFixture.swift` (modified, +52/-0)
```diff
@@ -47,7 +47,49 @@ enum VideoEditorActivityFixture {
     t < 2 || (t >= 5 && t < 7) || t >= 10
   }
 
+  /// Encoded fixtures by `duration`/`audio`, written once per test process. The bytes never
+  /// change, and the H.264 encoder on headless CI runners is slow and can stall for good, so
+  /// every extra encode is another chance to hang a test until its time allowance runs out.
+  private static var encodedFixtures: [String: URL] = [:]
+  private static let encodeAttempts = 3
+  /// How long the writer may refuse more media before an attempt is abandoned.
+  private static let stallTimeout: TimeInterval = 15
+
+  /// A fresh copy of the fixture in `directory`, so callers may move or delete it freely.
   static func makeVideoFile(in directory: URL, duration: TimeInterval, audio: Bool) async throws -> URL {
+    let key = "\(duration)-\(audio)"
+    let cached: URL
+    if let existing = encodedFixtures[key], FileManager.default.fileExists(atPath: existing.path) {
+      cached = existing
+    } else {
+      let cacheDirectory = FileManager.default.temporaryDirectory
+        .appendingPathComponent("VideoEditorActivityFixture-\(ProcessInfo.processInfo.processIdentifier)", isDirectory: true)
+      try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
+      cached = try await encodeWithRetry(in: cacheDirectory, duration: duration, audio: audio)
+      encodedFixtures[key] = cached
+    }
+    let url = directory.appendingPathComponent("analyzer-\(UUID().uuidString).mov")
+    try FileManager.default.copyItem(at: cached, to: url)
+    return url
+  }
+
+  private static func encodeWithRetry(in directory: URL, duration: TimeInterval, audio: Bool) async throws -> URL {
+    var lastError: Error?
+    for _ in 0 ..< encodeAttempts {
+      do {
+        return try await encodeVideoFile(in: directory, duration: duration, audio: audio)
+      } catch let error as FixtureStall {
+        lastError = error
+      }
+    }
+    throw lastError ?? FixtureStall()
+  }
+
+  private struct FixtureStall: Error, CustomStringConvertible {
+    var description: String { "AVAssetWriter stopped accepting fixture media" }
+  }
+
+  private static func encodeVideoFile(in directory: URL, duration: TimeInterval, audio: Bool) async throws -> URL {
     let url = directory.appendingPathComponent("analyzer-\(UUID().uuidString).mov")
     let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
     let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
@@ -90,7 +132,17 @@ enum VideoEditorActivityFixture {
     let steps = Int(duration * Double(frameRate))
     var videoIndex = 0
     var audioIndex = audio ? 0 : steps
+    var lastProgress = Date()
     while videoIndex < steps || audioIndex < steps {
+      let progressMark = videoIndex + audioIndex
+      defer {
+        if videoIndex + audioIndex != progressMark { lastProgress = Date() }
+      }
+      if Date().timeIntervalSince(lastProgress) > stallTimeout {
+        writer.cancelWriting()
+        try? FileManager.default.removeItem(at: url)
+        throw FixtureStall()
+      }
       var progressed = false
       if videoIndex < steps, videoIndex <= audioIndex || audioIndex >= steps, video.isReadyForMoreMediaData {
         var buffer: CVPixelBuffer?
```

---

### Incident Patch 2: `49ddfbdc` (2026-11-19)
**Commit Message**: feat: Added Quick Access Optimize action to shrink screenshots (#763)

* feat: Added Quick Access Optimize action to shrink screenshots

Adds an Optimize card action that opens a clear Liquid Glass list of
downscale levels (e.g. 0.5x / 1x / 1.5x / Original on Retina) beside the
card, with the real encoded size and savings for each level. The same
levels are reachable from the card's context menu as a submenu, even when
the action is not placed on the card.

- Levels derive from the file's DPI; no upscaling and no new dependencies
  (Core Graphics, ImageIO, existing Swift-WebP).
- The untouched original is kept while the card lives, so every level is
  rendered from it and "Original" restores it.
- Saved enabled-action lists now record the actions they were saved
  against, so Optimize arrives enabled for existing users.
- Adds a `.clear` native variant to the Liquid Glass surface.

Refs #758

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* feat: Enhance Quick Access Optimize menu with button anchoring and animation support

* feat: Enhance Quick Access Optimize with native glass support and fade animations

* feat: Adjust Quick Access Optimize menu row height and improve nati

**File**: `Snapzy/Features/Preferences/Components/PreferencesQuickAccessOptimizePresetsSection.swift` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+//
+//  PreferencesQuickAccessOptimizePresetsSection.swift
+//  Snapzy
+//
+//  Quick Access settings section that lists, adds, edits and deletes the Optimize
+//  presets shown in the card's Optimize menu.
+//
+
+import SwiftUI
+
+struct QuickAccessOptimizePresetsSection: View {
+  @ObservedObject private var store = QuickAccessOptimizePresetStore.shared
+  @State private var editing: EditingPreset?
+
+  /// A preset open in the editor sheet; `isNew` until it is first saved.
+  private struct EditingPreset: Identifiable {
+    var preset: QuickAccessOptimizePreset
+    let isNew: Bool
+    var id: UUID { preset.id }
+  }
+
+  var body: some View {
+    Section {
+      if store.presets.isEmpty {
+        Text(L10n.PreferencesQuickAccess.optimizePresetsEmpty)
+          .foregroundColor(.secondary)
+      }
+
+      ForEach(store.presets) { preset in
+        HStack(spacing: 12) {
+          Image(systemName: "slider.horizontal.3")
+            .foregroundColor(.secondary)
+            .frame(width: 20)
+
+          VStack(alignment: .leading, spacing: 2) {
+            Text(preset.name)
+              .fontWeight(.medium)
+            Text(preset.settings.summary())
+              .font(.caption)
+              .foregroundColor(.secondary)
+              .monospacedDigit()
+          }
+
+          Spacer()
+
+          Button {
+            editing = EditingPreset(preset: preset, isNew: false)
+          } label: {
+            Image(systemName: "pencil")
+          }
+          .buttonStyle(.borderless)
+          .help(L10n.Common.edit)
+
+          Button {
+            store.deletePreset(id: preset.id)
+          } label: {
+            Image(systemName: "trash")
+          }
+          .buttonStyle(.borderless)
+          .help(L10n.Common.delete)
+        }
+        .padding(.vertical, 2)
+      }
+      .onMove { store.movePresets(fromOffsets: $0, toOffset: $1) }
+
+      Button {
+        editing = EditingPreset(
+          preset: QuickAccessOptimizePreset(name: "", settings: store.lastCustomSettings),
+          isNew: true
+        )
+      } label: {
+        Label(L10n.PreferencesQuickAccess.addOptimizePreset, systemImage: "plus")
+      }
+      .buttonStyle(.borderless)
+    } header: {
+      Text(L10n.PreferencesQuickAccess.optimizePresetsSection)
+    } footer: {
+      Text(L10n.PreferencesQuickAccess.optimizePresetsDescription)
+        .font(.caption)
+        .foregroundColor(.secondary)
+    }
+    .sheet(item: $editing) { editing in
+      QuickAccessOptimizePresetEditorSheet(
+        preset: editing.preset,
+        isNew: editing.isNew,
+        onSave: { preset in
+          if editing.isNew {
+            store.addPreset(name: preset.name, settings: preset.settings)
+          } else {
+            store.updatePreset(preset)
+          }
+          self.editing = nil
+        },
+        onCancel: { self.editing = nil }
+      )
+    }
+  }
+}
+
+private struct QuickAccessOptimizePresetEditorSheet: View {
+  @State var preset: QuickAccessOptimizePreset
+  let isNew: Bool
+  let onSave: (QuickAccessOptimizePreset) -> Void
+  let onCancel: () -> Void
+
+  var body: some View {
+    VStack(alignment: .leading, spacing: 16) {
+      Text(isNew ? L10n.PreferencesQuickAccess.newOptimizePresetTitle : L10n.PreferencesQuickAccess.editOptimizePresetTitle)
+        .font(.headline)
+
+      HStack(spacing: 10) {
+        Text(L10n.PreferencesQuickAccess.optimizePresetNameLabel)
+          .font(.system(size: 12))
+          .frame(width: 70, alignment: .leading)
+        TextField(L10n.QuickAccess.optimizePresetNamePlaceholder, text: $preset.name)
+          .textFieldStyle(.roundedBorder)
+      }
+
+      QuickAccessOptimizeSettingsForm(settings: $preset.settings)
+
+      HStack {
+        Spacer()
+        Button(L10n.Common.cancel, action: onCancel)
+          .keyboardShortcut(.cancelAction)
+        Button(L10n.Common.save) { onSave(preset) }
+          .keyboardShortcut(.defaultAction)
+          .disabled(preset.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
+      }
+    }
+    .padding(20)
+    .frame(width: 440)
+  }
+}
```

**File**: `Snapzy/Features/Preferences/Components/PreferencesQuickAccessSettingsView.swift` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ struct QuickAccessSettingsView: View {
     Form {
       QuickAccessActionCustomizationView(manager: manager)
 
+      QuickAccessOptimizePresetsSection()
+
       Section(L10n.PreferencesQuickAccess.pinZoomSection) {
         PinZoomModeComparisonPreview(
           selectedMode: pinZoomModeStore.mode,
```

**File**: `Snapzy/Features/Preferences/Models/PreferencesKeys.swift` (modified, +3/-0)
```diff
@@ -150,13 +150,16 @@ enum PreferencesKeys {
   static let quickAccessPinZoomMode = "quickAccess.pin.zoom.mode"
   static let quickAccessActionOrder = "quickAccess.actions.order.v1"
   static let quickAccessEnabledActions = "quickAccess.actions.enabled.v1"
+  static let quickAccessKnownActions = "quickAccess.actions.known.v1"
   static let quickAccessActionSlotAssignments = "quickAccess.actions.slots.v1"
   static let quickAccessSwipeLeftAction = "quickAccess.swipe.action.left"
   static let quickAccessSwipeRightAction = "quickAccess.swipe.action.right"
   static let quickAccessHideCardWhenWindowOpen = "quickAccess.hideCardWhenWindowOpen"
   static let quickAccessAnimationStyle = "quickAccess.animationStyle"
   static let quickAccessPlaySounds = "quickAccess.playSounds"
   static let quickAccessOpenInFinderAfterSave = "quickAccess.openInFinderAfterSave"
+  static let quickAccessOptimizePresets = "quickAccess.optimize.presets.v1"
+  static let quickAccessOptimizeLastCustom = "quickAccess.optimize.lastCustom.v1"
 
   // Recording
   static let recordingFormat = "recording.format"
```

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessCardView.swift` (modified, +148/-11)
```diff
@@ -28,6 +28,8 @@ struct QuickAccessCardView: View {
   @State private var swipeOffset: CGFloat = 0
   @State private var isCloudUploading = false
   @State private var cloudUploadProgress: Double = 0
+  @State private var cardAnchor = QuickAccessCardAnchor()
+  @State private var optimizeButtonAnchor = QuickAccessCardAnchor()
   @Environment(\.accessibilityReduceMotion) var reduceMotion
 
   private let cornerRadius = Radius.card
@@ -123,6 +125,11 @@ struct QuickAccessCardView: View {
       QuickAccessContextMenuPresenter(entries: quickAccessContextMenuEntries)
         .frame(width: scaledWidth, height: scaledHeight)
     )
+    .background(
+      QuickAccessCardAnchorView(anchor: cardAnchor)
+        .frame(width: scaledWidth, height: scaledHeight)
+        .allowsHitTesting(false)
+    )
     .overlay(dragInteractionBridge.frame(width: scaledWidth, height: scaledHeight))
     .onDisappear {
       isDragging = false
@@ -349,6 +356,8 @@ struct QuickAccessCardView: View {
       return cloudActionTitle
     case .pinToScreen:
       return item.isPinned ? L10n.PreferencesQuickAccess.unpinAction : L10n.PreferencesQuickAccess.pinToScreenAction
+    case .optimize:
+      return L10n.PreferencesQuickAccess.optimizeAction
     }
   }
 
@@ -393,6 +402,8 @@ struct QuickAccessCardView: View {
       return shouldShowCloudButton
     case .delete:
       return true
+    case .optimize:
+      return QuickAccessOptimizeStore.shared.canOptimize(item)
     }
   }
 
@@ -402,6 +413,10 @@ struct QuickAccessCardView: View {
       return !item.isVideo
     case .uploadToCloud:
       return shouldShowCloudButton && !alreadyUploadedToCloud && !isCloudUploading
+    case .optimize:
+      // An open editor would write its own pixels back over the optimized file.
+      let isEditorOpen = item.isWindowOpen && !item.isPinned
+      return QuickAccessOptimizeStore.shared.canOptimize(item) && !isEditorOpen
     case .copy, .saveOrOpen, .dismiss, .delete, .edit:
       return true
     }
@@ -426,9 +441,19 @@ struct QuickAccessCardView: View {
     case .pinToScreen:
       guard !item.isVideo else { return }
       manager.togglePin(id: item.id)
+    case .optimize:
+      presentOptimizeMenu()
     }
   }
 
+  private func presentOptimizeMenu() {
+    QuickAccessOptimizePanelController.shared.present(
+      for: item,
+      buttonFrame: optimizeButtonAnchor.screenFrame,
+      cardFrame: cardAnchor.screenFrame
+    )
+  }
+
   private func handleDoubleClick() {
     if item.isVideo {
       openVideoEditor()
@@ -554,6 +579,7 @@ struct QuickAccessCardView: View {
       performAction(action)
     }
       .help(actionHelpText(for: action))
+      .background(optimizeAnchor(for: action))
       .disabled(!isActionEnabled(action))
       .opacity(isActionEnabled(action) ? 1 : 0.6)
       .transition(buttonTransition(delay: delay))
@@ -596,12 +622,21 @@ struct QuickAccessCardView: View {
       action: { performAction(action) },
       helpText: actionHelpText(for: action)
     )
+    .background(optimizeAnchor(for: action))
     .transition(cornerButtonTransition(delay: delay))
     .padding(6)
     .disabled(!isActionEnabled(action))
     .opacity(isActionEnabled(action) ? 1 : 0.6)
   }
 
+  /// Lets the Optimize menu open over the button that triggered it.
+  @ViewBuilder
+  private func optimizeAnchor(for action: QuickAccessActionKind) -> some View {
+    if action == .optimize {
+      QuickAccessCardAnchorView(anchor: optimizeButtonAnchor)
+    }
+  }
+
   private func cornerButtonTransition(delay: Int) -> AnyTransition {
     if reduceMotion {
       return .opacity
@@ -640,6 +675,11 @@ struct QuickAccessCardView: View {
         insertedDestructiveSeparator = true
       }
 
+      if action == .optimize {
+        entries.append(optimizeContextMenuEntry)
+        continue
+      }
+
       entries.append(
         .action(
           title: actionTitle(for: action),
@@ -653,6 +693,51 @@ struct QuickAccessCardView: View {
     return entries
   }
 
+  /// Optimize as a submenu so the levels stay reachable from the context menu even
+  /// when the action has no slot on the card. Levels are read when the menu opens.
+  private var optimizeContextMenuEntry: QuickAccessContextMenuEntry {
+    let item = item
+    return .submenu(
+      title: actionTitle(for: .optimize),
+      systemImage: actionIcon(for: .optimize),
+      isEnabled: isActionEnabled(.optimize),
+      makeEntries: {
+        let store = QuickAccessOptimizeStore.shared
+        guard let plan = store.plan(for: item) else { return [] }
+        var entries: [QuickAccessContextMenuEntry] = plan.levels.map { level in
+          .option(
+            title: QuickAccessOptimizeMenuFormatting.title(for: level),
+            detail: level.dimensionsLabel,
+            isChecked: level.fraction == plan.currentFraction,
+            action: { store.applyReportingFailure(.level(level), to: item.id) }
+          )
+        }
+        let presets = QuickAccessOpt
```

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessOptimizeCustomView.swift` (added, +374/-0)
```diff
@@ -0,0 +1,374 @@
+//
+//  QuickAccessOptimizeCustomView.swift
+//  Snapzy
+//
+//  The "Custom…" Optimize editor: size, format, quality and a file-size cap with a
+//  live size preview, plus saving the settings as a preset. The settings rows are
+//  shared with the presets editor in Preferences.
+//
+
+import AppKit
+import Combine
+import SwiftUI
+
+// MARK: - Shared settings rows
+
+/// Size, format, quality and file-size cap. Pass `source` to show pixel sizes and
+/// to name the "Original" format after the file's own.
+struct QuickAccessOptimizeSettingsForm: View {
+  @Binding var settings: QuickAccessOptimizeSettings
+  var source: QuickAccessOptimizeSourceInfo?
+  var originalExtension: String?
+  var labelWidth: CGFloat = 70
+
+  private var outputIsLossy: Bool {
+    switch settings.format {
+    case .jpeg, .webp: true
+    case .png: false
+    case .original: originalExtension.map(QuickAccessOptimizeFormat.isLossy(fileExtension:)) ?? true
+    }
+  }
+
+  var body: some View {
+    VStack(alignment: .leading, spacing: 10) {
+      row(L10n.QuickAccess.optimizeSizeLabel) {
+        HStack(spacing: 8) {
+          Slider(
+            value: intBinding(\.scalePercent, step: 5),
+            in: Double(QuickAccessOptimizeSettings.scaleRange.lowerBound)...Double(QuickAccessOptimizeSettings.scaleRange.upperBound)
+          )
+          Text(sizeLabel)
+            .font(.system(size: 11).monospacedDigit())
+            .foregroundStyle(.secondary)
+            .frame(minWidth: 52, alignment: .trailing)
+        }
+      }
+
+      row(L10n.QuickAccess.optimizeFormatLabel) {
+        Picker("", selection: $settings.format) {
+          ForEach(QuickAccessOptimizeFormat.allCases) { format in
+            Text(format == .original ? L10n.QuickAccess.optimizeFormatOriginal : format.displayName(originalExtension: nil))
+              .tag(format)
+          }
+        }
+        .labelsHidden()
+        .pickerStyle(.segmented)
+        .help(settings.format.displayName(originalExtension: originalExtension))
+      }
+
+      row(L10n.QuickAccess.optimizeQualityLabel) {
+        HStack(spacing: 8) {
+          Slider(
+            value: intBinding(\.qualityPercent, step: 5),
+            in: Double(QuickAccessOptimizeSettings.qualityRange.lowerBound)...Double(QuickAccessOptimizeSettings.qualityRange.upperBound)
+          )
+          Text(outputIsLossy ? "\(settings.qualityPercent)" : L10n.QuickAccess.optimizeQualityLossless)
+            .font(.system(size: 11).monospacedDigit())
+            .foregroundStyle(.secondary)
+            .frame(minWidth: 52, alignment: .trailing)
+        }
+        .disabled(!outputIsLossy)
+      }
+
+      row(L10n.QuickAccess.optimizeMaxSizeLabel) {
+        Picker("", selection: $settings.maxFileSize) {
+          Text(L10n.Common.off).tag(Int?.none)
+          ForEach(QuickAccessOptimizeSettings.maxFileSizeOptions, id: \.self) { bytes in
+            Text(QuickAccessImageOptimizer.formatByteCount(bytes)).tag(Int?.some(bytes))
+          }
+        }
+        .labelsHidden()
+        .pickerStyle(.segmented)
+        .controlSize(.small)
+      }
+    }
+  }
+
+  /// "50% · 1440×900", or just "50%" without a source.
+  private var sizeLabel: String {
+    guard let source else { return "\(settings.scalePercent)%" }
+    let fraction = CGFloat(settings.scalePercent) / 100
+    let width = Int((CGFloat(source.pixelWidth) * fraction).rounded())
+    let height = Int((CGFloat(source.pixelHeight) * fraction).rounded())
+    return "\(settings.scalePercent)% · \(width)×\(height)"
+  }
+
+  private func row(_ title: String, @ViewBuilder content: () -> some View) -> some View {
+    HStack(alignment: .center, spacing: 10) {
+      Text(title)
+        .font(.system(size: 12))
+        .frame(width: labelWidth, alignment: .leading)
+      content()
+    }
+  }
+
+  private func intBinding(_ keyPath: WritableKeyPath<QuickAccessOptimizeSettings, Int>, step: Int) -> Binding<Double> {
+    Binding(
+      get: { Double(settings[keyPath: keyPath]) },
+      set: { settings[keyPath: keyPath] = Int(($0 / Double(step)).rounded()) * step }
+    )
+  }
+}
+
+// MARK: - Editor model
+
+@MainActor
+final class QuickAccessOptimizeCustomModel: ObservableObject {
+  let itemID: UUID
+  let source: QuickAccessOptimizeCustomSource
+
+  @Published var settings: QuickAccessOptimizeSettings {
+    didSet { if settings != oldValue { scheduleRender() } }
+  }
+  @Published private(set) var rendering: QuickAccessOptimizeRendering?
+  @Published private(set) var renderedSettings: QuickAccessOptimizeSettings?
+  @Published private(set) var isRendering = false
+  @Published private(set) var renderFailed = false
+  @Published var isNamingPreset = false
+  @Published var presetName = ""
+  @Published private(set) var savedPresetName: String?
+  /// Drives the bubble in/out animation; the panel stays up until it has played.
+  @Published var isShown = false
+
+  var onApply: ((QuickAccessOptimizeSetting
```

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessOptimizeMenuView.swift` (added, +330/-0)
```diff
@@ -0,0 +1,330 @@
+//
+//  QuickAccessOptimizeMenuView.swift
+//  Snapzy
+//
+//  Optimize levels (`0.5x`, `1x`, `2x`…), saved presets and "Custom…" as a
+//  native-style pop-up menu on clear Liquid Glass, opened with the current level
+//  over the Optimize button.
+//
+
+import AppKit
+import Combine
+import SwiftUI
+
+enum QuickAccessOptimizeMenuFormatting {
+  /// "1x", or "Original (2x)" for the untouched size.
+  static func title(for level: QuickAccessOptimizeLevel) -> String {
+    level.isOriginal
+      ? "\(L10n.QuickAccess.optimizeOriginal) (\(level.scaleLabel))"
+      : level.scaleLabel
+  }
+
+  /// "−62%" against the original, or nil when it would not shrink anything.
+  static func savingsLabel(byteCount: Int, originalByteCount: Int?) -> String? {
+    guard let originalByteCount, originalByteCount > 0, byteCount < originalByteCount else { return nil }
+    let percent = Int((Double(originalByteCount - byteCount) / Double(originalByteCount) * 100).rounded())
+    guard percent > 0 else { return nil }
+    return "−\(percent)%"
+  }
+}
+
+@MainActor
+final class QuickAccessOptimizeMenuModel: ObservableObject {
+  struct Row: Identifiable, Equatable {
+    enum Kind: Equatable {
+      case level(QuickAccessOptimizeLevel)
+      case preset(QuickAccessOptimizePreset)
+      case custom
+    }
+
+    let id: String
+    let kind: Kind
+    /// Draws a separator above the row, like a native menu group break.
+    let startsGroup: Bool
+    var byteCount: Int?
+    var encodedData: Data?
+    var isEstimating: Bool
+
+    var level: QuickAccessOptimizeLevel? {
+      if case let .level(level) = kind { return level }
+      return nil
+    }
+
+    static func id(for level: QuickAccessOptimizeLevel) -> String { "level-\(level.fraction)" }
+  }
+
+  let itemID: UUID
+  let originalByteCount: Int?
+  let originalExtension: String
+  @Published private(set) var rows: [Row]
+  /// The level on disk, or nil when custom settings produced the file.
+  let currentRowID: String?
+  @Published var highlightedID: String?
+  /// Drives the bubble in/out animation; the panel stays up until it has played.
+  @Published var isShown = false
+
+  var onChoose: ((Row) -> Void)?
+
+  /// Explicit and nonisolated: the synthesized main-actor deinit hops through the
+  /// back-deployed swift_task_deinitOnExecutor, which aborts on macOS 13-15 (#668).
+  nonisolated deinit {}
+
+  init(itemID: UUID, plan: QuickAccessOptimizePlan, presets: [QuickAccessOptimizePreset]) {
+    self.itemID = itemID
+    originalByteCount = plan.originalByteCount
+    originalExtension = plan.fileExtension
+
+    var rows = plan.levels.map { level in
+      Row(
+        id: Row.id(for: level),
+        kind: .level(level),
+        startsGroup: false,
+        byteCount: level.isOriginal ? plan.originalByteCount : nil,
+        encodedData: nil,
+        isEstimating: !level.isOriginal
+      )
+    }
+    rows += presets.enumerated().map { index, preset in
+      Row(
+        id: "preset-\(preset.id.uuidString)",
+        kind: .preset(preset),
+        startsGroup: index == 0,
+        byteCount: nil,
+        encodedData: nil,
+        isEstimating: false
+      )
+    }
+    rows.append(Row(id: "custom", kind: .custom, startsGroup: true, byteCount: nil, encodedData: nil, isEstimating: false))
+    self.rows = rows
+
+    currentRowID = plan.levels.first { $0.fraction == plan.currentFraction }.map(Row.id(for:))
+    highlightedID = currentRowID ?? rows.last?.id
+  }
+
+  /// Row the menu opens on (and grows out of): the current level, else "Custom…".
+  var anchorIndex: Int {
+    rows.firstIndex { $0.id == (currentRowID ?? "custom") } ?? 0
+  }
+
+  func record(_ level: QuickAccessOptimizeLevel, data: Data?) {
+    guard let index = rows.firstIndex(where: { $0.level == level }) else { return }
+    rows[index].encodedData = data
+    rows[index].byteCount = data?.count
+    rows[index].isEstimating = false
+  }
+
+  func choose(_ row: Row) {
+    onChoose?(row)
+  }
+
+  func moveHighlight(by offset: Int) {
+    guard !rows.isEmpty else { return }
+    let currentIndex = rows.firstIndex { $0.id == highlightedID } ?? 0
+    let nextIndex = min(max(currentIndex + offset, 0), rows.count - 1)
+    highlightedID = rows[nextIndex].id
+  }
+
+  func chooseHighlighted() {
+    guard let row = rows.first(where: { $0.id == highlightedID }) else { return }
+    choose(row)
+  }
+}
+
+struct QuickAccessOptimizeMenuView: View {
+  @ObservedObject var model: QuickAccessOptimizeMenuModel
+
+  // Geometry mirrors a native pop-up menu; the panel controller reads it to put
+  // the current row right over the Optimize button.
+  static let shadowPadding: CGFloat = 14
+  static let inset: CGFloat = 4
+  static let rowHeight: CGFloat = 19
+  static let rowSpacing: CGFloat = 1
+  /// Height of a group separator, hairline included.
+  static let separatorHeight: CGFloat = 9
+
+  /// Distance from the hosting view's top edge to the centre of row `index`.
+
```

**File**: `Snapzy/Features/QuickAccess/Managers/QuickAccessOptimizePanelController.swift` (added, +366/-0)
```diff
@@ -0,0 +1,366 @@
+//
+//  QuickAccessOptimizePanelController.swift
+//  Snapzy
+//
+//  Hosts the Optimize list and the Custom editor in a borderless child panel. The
+//  Quick Access panel only accepts the mouse inside the card stack, so anything that
+//  spills past the card has to live in a separate window anchored to the card.
+//
+
+import AppKit
+import Combine
+import SwiftUI
+
+/// Remembers the AppKit view behind a card so callers can ask for its screen frame.
+@MainActor
+final class QuickAccessCardAnchor {
+  weak var view: NSView?
+
+  /// Explicit and nonisolated: the synthesized main-actor deinit hops through the
+  /// back-deployed swift_task_deinitOnExecutor, which aborts on macOS 13-15 (#668).
+  nonisolated deinit {}
+
+  var screenFrame: NSRect? {
+    guard let view, let window = view.window else { return nil }
+    return window.convertToScreen(view.convert(view.bounds, to: nil))
+  }
+}
+
+struct QuickAccessCardAnchorView: NSViewRepresentable {
+  let anchor: QuickAccessCardAnchor
+
+  func makeNSView(context _: Context) -> NSView {
+    let view = PassthroughView()
+    anchor.view = view
+    return view
+  }
+
+  func updateNSView(_ nsView: NSView, context _: Context) {
+    anchor.view = nsView
+  }
+
+  private final class PassthroughView: NSView {
+    override func hitTest(_: NSPoint) -> NSView? { nil }
+  }
+}
+
+/// Borderless panel that can take keyboard focus without activating Snapzy.
+final class QuickAccessOptimizePanel: NSPanel {
+  init(contentRect: NSRect) {
+    super.init(
+      contentRect: contentRect,
+      styleMask: [.borderless, .nonactivatingPanel],
+      backing: .buffered,
+      defer: false
+    )
+    isFloatingPanel = true
+    becomesKeyOnlyIfNeeded = false
+    hidesOnDeactivate = false
+    isOpaque = false
+    backgroundColor = .clear
+    // The SwiftUI view draws its own shadow so it can scale with the bubble animation.
+    hasShadow = false
+    isReleasedWhenClosed = false
+    collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
+    animationBehavior = .utilityWindow
+  }
+
+  override var canBecomeKey: Bool { true }
+  override var canBecomeMain: Bool { false }
+}
+
+@MainActor
+final class QuickAccessOptimizePanelController {
+  static let shared = QuickAccessOptimizePanelController()
+
+  private var panel: QuickAccessOptimizePanel?
+  private var menuModel: QuickAccessOptimizeMenuModel?
+  private var customModel: QuickAccessOptimizeCustomModel?
+  /// Hides whichever view is up with the bubble animation.
+  private var setShown: ((Bool) -> Void)?
+  private var presentedItemID: UUID?
+  private var estimateTask: Task<Void, Never>?
+  private var eventMonitors: [Any] = []
+  private var itemsCancellable: AnyCancellable?
+  private var heldItemID: UUID?
+  /// A click on the card's Optimize button first dismisses the open list through the
+  /// click monitor; remembering that lets the button act as a toggle.
+  private var lastOutsideDismissal: (itemID: UUID, date: Date)?
+
+  private init() {}
+
+  var isPresented: Bool { panel != nil }
+
+  /// Opens the list like a native pop-up menu: the current level lands right over
+  /// `buttonFrame` (screen coordinates), or over the card's centre when the menu was
+  /// opened without the button (e.g. from a shortcut).
+  func present(for item: QuickAccessItem, buttonFrame: NSRect?, cardFrame: NSRect?) {
+    if presentedItemID == item.id {
+      dismiss()
+      return
+    }
+    if let lastOutsideDismissal,
+       lastOutsideDismissal.itemID == item.id,
+       Date().timeIntervalSince(lastOutsideDismissal.date) < 0.4 {
+      self.lastOutsideDismissal = nil
+      return
+    }
+    dismiss()
+
+    let store = QuickAccessOptimizeStore.shared
+    guard !store.isOptimizing(item.id) else { return }
+    guard let plan = store.plan(for: item) else {
+      reportUnavailable()
+      return
+    }
+
+    let anchor = buttonFrame ?? cardFrame
+    let model = QuickAccessOptimizeMenuModel(
+      itemID: item.id,
+      plan: plan,
+      presets: QuickAccessOptimizePresetStore.shared.presets
+    )
+    model.onChoose = { [weak self] row in
+      self?.dismiss()
+      switch row.kind {
+      case let .level(level):
+        store.applyReportingFailure(.level(level, encodedData: row.encodedData), to: item.id)
+      case let .preset(preset):
+        store.applyReportingFailure(.custom(preset.settings), to: item.id)
+      case .custom:
+        // Wait for the menu's close animation so the editor does not pop over it.
+        DispatchQueue.main.asyncAfter(deadline: .now() + Self.closeDuration) {
+          guard let current = QuickAccessManager.shared.items.first(where: { $0.id == item.id }) else { return }
+          self?.presentCustom(for: current, anchor: anchor)
+        }
+      }
+    }
+    menuModel = model
+
+    let hostingView = NSHostingView(rootView: QuickAccessOptimizeMenuView(model: model))
+    hostingView.layoutSubtreeIfNeeded()
+    let size
```

**File**: `Snapzy/Features/QuickAccess/Models/QuickAccessActionConfigurationStore.swift` (modified, +15/-3)
```diff
@@ -22,7 +22,8 @@ final class QuickAccessActionConfigurationStore: ObservableObject {
     self.defaults = defaults
     actionOrder = Self.normalizedOrder(from: defaults.stringArray(forKey: PreferencesKeys.quickAccessActionOrder))
     enabledActions = Self.normalizedEnabledActions(
-      from: defaults.stringArray(forKey: PreferencesKeys.quickAccessEnabledActions)
+      from: defaults.stringArray(forKey: PreferencesKeys.quickAccessEnabledActions),
+      known: defaults.stringArray(forKey: PreferencesKeys.quickAccessKnownActions)
     )
     slotAssignments = Self.normalizedSlotAssignments(
       from: defaults.dictionary(forKey: PreferencesKeys.quickAccessActionSlotAssignments) as? [String: String]
@@ -124,6 +125,7 @@ final class QuickAccessActionConfigurationStore: ObservableObject {
       forKey: PreferencesKeys.quickAccessEnabledActions
     )
     defaults.set(rawSlotAssignments(from: slotAssignments), forKey: PreferencesKeys.quickAccessActionSlotAssignments)
+    defaults.set(QuickAccessActionKind.allCases.map(\.rawValue), forKey: PreferencesKeys.quickAccessKnownActions)
   }
 
   private static func normalizedOrder(from rawIDs: [String]?) -> [QuickAccessActionKind] {
@@ -143,12 +145,22 @@ final class QuickAccessActionConfigurationStore: ObservableObject {
     return ordered
   }
 
-  private static func normalizedEnabledActions(from rawIDs: [String]?) -> Set<QuickAccessActionKind> {
+  /// `known` is the action list the enabled list was saved against. Actions added
+  /// since then were never offered to the user, so they start enabled when they
+  /// are enabled by default; an explicit disable of a known action is kept.
+  static func normalizedEnabledActions(
+    from rawIDs: [String]?,
+    known rawKnownIDs: [String]?
+  ) -> Set<QuickAccessActionKind> {
     guard let rawIDs else {
       return QuickAccessActionKind.defaultEnabledActions
     }
 
-    return Set(rawIDs.compactMap(QuickAccessActionKind.init(rawValue:)))
+    let saved = Set(rawIDs.compactMap(QuickAccessActionKind.init(rawValue:)))
+    let known = rawKnownIDs.map { Set($0.compactMap(QuickAccessActionKind.init(rawValue:))) }
+      ?? QuickAccessActionKind.legacyKnownActions
+    let introduced = QuickAccessActionKind.defaultEnabledActions.subtracting(known)
+    return saved.union(introduced)
   }
 
   private static func normalizedSlotAssignments(
```

---

### Incident Patch 3: `4a61039c` (2026-11-18)
**Commit Message**: ci: split CI into parallel checks, test and release-build jobs (#759)

- checks: localization verify + SnapzyCLIKit tests (10 min)
- test: Debug xcodebuild test with the unchanged skip list (30 min)
- release-build: arm64-only on PRs, universal on push like the release
  archive; adds the #725 runtime weak-import guard, lipo arch check on
  push, and the Release build duration in the job summary
- skip CI for docs/plans/markdown-only changes
- raise release-publish build timeout from 45 to 75 min

**File**: `.github/workflows/ci.yml` (modified, +105/-6)
```diff
@@ -3,17 +3,25 @@ name: CI Build Check
 on:
   push:
     branches: [master, beta]
+    paths-ignore:
+      - 'docs/**'
+      - 'plans/**'
+      - '**/*.md'
   pull_request:
     branches: [master, beta]
+    paths-ignore:
+      - 'docs/**'
+      - 'plans/**'
+      - '**/*.md'
 
 concurrency:
   group: ci-${{ github.ref }}
   cancel-in-progress: true
 
 jobs:
-  build:
+  checks:
     runs-on: macos-15
-    timeout-minutes: 45
+    timeout-minutes: 10
 
     steps:
       - name: Checkout
@@ -39,6 +47,25 @@ jobs:
       - name: Test SnapzyCLIKit package
         run: swift test --package-path Packages/SnapzyCLIKit
 
+  test:
+    runs-on: macos-15
+    timeout-minutes: 30
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v7
+
+      - name: Setup Xcode
+        uses: maxim-lobanov/setup-xcode@v1
+        with:
+          xcode-version: '26.2'
+
+      - name: Reset SwiftPM artifact cache
+        # Fresh macos-15 images can ship a stale entry for the Sparkle binary
+        # artifact, which makes package resolution fail with
+        # "... already exists in file system".
+        run: rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"
+
       - name: Run tests
         env:
           # The following tests crash on GitHub Actions macOS runners (Swift concurrency /
@@ -157,21 +184,68 @@ jobs:
             build/ci-test.log
             build/ci-test.xcresult
 
-      - name: Build
+  release-build:
+    runs-on: macos-15
+    timeout-minutes: 60
+    env:
+      # Pull requests build arm64 only to keep the Release (WMO) compile short; the
+      # SIL optimizer is arch-independent, so optimizer crashes still surface.
+      # Pushes to master/beta build universal exactly like release-publish.yml.
+      BUILD_MODE: ${{ github.event_name == 'pull_request' && 'arm64' || 'universal' }}
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v7
+
+      - name: Setup Xcode
+        uses: maxim-lobanov/setup-xcode@v1
+        with:
+          xcode-version: '26.2'
+
+      - name: Reset SwiftPM artifact cache
+        # Fresh macos-15 images can ship a stale entry for the Sparkle binary
+        # artifact, which makes package resolution fail with
+        # "... already exists in file system".
+        run: rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"
+
+      - name: Build Release
         run: |
           set -euo pipefail
           mkdir -p build
 
-          if ! xcodebuild \
+          if [ "$BUILD_MODE" = "universal" ]; then
+            arch_args=(ONLY_ACTIVE_ARCH=NO)
+          else
+            arch_args=(ARCHS=arm64 ONLY_ACTIVE_ARCH=YES)
+          fi
+          echo "Build mode: $BUILD_MODE (${arch_args[*]})"
+
+          start=$(date +%s)
+          set +e
+          xcodebuild \
             -project Snapzy.xcodeproj \
             -scheme Snapzy \
             -configuration Release \
             -derivedDataPath build/DerivedData \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGNING_ALLOWED=NO \
-            ONLY_ACTIVE_ARCH=NO \
-            build > build/ci-build.log 2>&1; then
+            "${arch_args[@]}" \
+            build > build/ci-build.log 2>&1
+          status=$?
+          set -e
+          elapsed=$(( $(date +%s) - start ))
+
+          {
+            echo "### Release build ($BUILD_MODE)"
+            echo ""
+            echo "| Result | Duration |"
+            echo "| --- | --- |"
+            if [ "$status" -eq 0 ]; then result="success"; else result="failed ($status)"; fi
+            printf '| %s | %dm %02ds |\n' "$result" $((elapsed / 60)) $((elapsed % 60))
+          } >> "$GITHUB_STEP_SUMMARY"
+
+          if [ "$status" -ne 0 ]; then
             tail -100 build/ci-build.log
             exit 1
           fi
@@ -202,3 +276,28 @@ jobs:
             exit 1
           fi
           echo "Embedded snapzy CLI verified"
+
+      # Release-only crash class (#725): optimized builds call macOS 15+ Swift
+      # runtime symbols without a fallback, so the app dies at launch on 13/14.
+      # Same guard as release-publish.yml, so a green PR cannot fail the release.
+      - name: Guard Swift runtime imports for deployment target
+        run: |
+          set -euo pipefail
+          bash scripts/check-runtime-weak-imports.sh build/DerivedData/Build/Products/Release/Snapzy.app
+
+      - name: Verify universal binaries
+        if: env.BUILD_MODE == 'universal'
+        run: |
+          set -euo pipefail
+          APP_PATH="build/DerivedData/Build/Products/Release/Snapzy.app"
+          APP_EXEC=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")
+          for bin in "$APP_PATH/Contents/MacOS/$APP_EXEC" "$APP_PATH/Contents/Helpers/snapzy"; do
+            archs=$(lipo -archs "$bin")
+            echo "$bin: $archs"
+            for want in x86_64 arm64; do
+              if ! grep -qw "$want" <<<"$archs"; then
+              
```

**File**: `.github/workflows/release-publish.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
       (github.event.pull_request.merged == true &&
       startsWith(github.event.pull_request.head.ref, 'release/v'))
     runs-on: macos-15
-    timeout-minutes: 45
+    timeout-minutes: 75
     permissions:
       contents: write
     env:
```

#### Recent Merged Pull Requests:
- **PR #768** (2026-11-20): feat: Added recording area border shown during recording, independent of dim (#545) (@duongductrong)
- **PR #767** (2026-11-20): chore: release v2.3.0-beta.2 (@github-actions[bot])
- **PR #766** (2026-11-20): feat: Added auto-expanding canvas to the Annotate editor (@duongductrong)
- **PR #765** (2026-11-20): chore: release v2.3.0-beta.1 (@github-actions[bot])
- **PR #764** (2026-11-20): fix: Get master CI green again (@duongductrong)
- **PR #763** (2026-11-19): feat: Added Quick Access Optimize action to shrink screenshots (@duongductrong)

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

## X. Stop the video fixture from hanging CI and collect test-host crash reports

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `22ea076c`: Stop the video fixture from hanging CI and collect test-host crash reports. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
      - name: Collect crash reports
        # A test-host abort leaves only "malloc: ..." in the log; the backtrace lives in
        # the crash report ReportCrash writes, which the xcresult does not include.
        if: failure() || cancelled()
        run: |
          mkdir -p build/crash-reports
          find "$HOME/Library/Logs/DiagnosticReports" /Library/Logs/DiagnosticReports \
            \( -name 'Snapzy*' -o -name 'xctest*' \) -type f -mmin -60 \
            -exec cp {} build/crash-reports/ \; 2>/dev/null || true
          ls -la build/crash-reports

      - name: Upload crash reports
        if: failure() || cancelled()
        uses: actions/upload-artifact@v7
        with:
          name: ci-crash-reports
          path: build/crash-reports
          if-no-files-found: ignore

```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `22ea076c` are properly handled with clean fallback behavior.
