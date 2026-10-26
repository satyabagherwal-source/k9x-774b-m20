> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source**: github ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Source Version**: `908119ae`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T05:07:44.486Z  
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
> **Harvest Timestamp**: 2026-10-26T05:06:41.445Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3419 stars

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

  /// `.unconditional` so displays left of or above the main one work:
  /// `--rect -1440,0,800,600` would otherwise parse `-1440…` as an option.
  @Option(parsing: .unconditional, help: "Rectangle as x,y,width,height in points.")
  var rect: CLIRect

  func run() async throws {
    try await CaptureCommand.run(
      .captureArea,
      params: CaptureAreaParams(rect: rect, options: output.captureOptions()),
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

  @Option(help: "main, all, or a display ID from `snapzy list displays`.")
  var display: DisplaySelector = .main

  func run() async throws {
    try await CaptureCommand.run(
      .captureScreen,
      params: CaptureScreenParams(display: display, options: output.captureOptions()),
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
import Foundation
import SnapzyCLIProtocol

struct WindowCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "window",
    abstract: "Capture one window, even when other windows cover it.",
    discussion: "Pick the window with exactly one of --id, --app or --active."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions

  @Option(help: "Window ID from `snapzy list windows`.")
  var id: UInt32?

  @Option(help: "App name or bundle ID. Captures its frontmost window unless --title or --index narrows it.")
  var app: String?

  @Option(help: "Regular expression matched against window titles (with --app).")
  var title: String?

  @Option(help: "0-based index among the matching windows, front to back (with --app).")
  var index: Int?

  @Flag(help: "The focused window of the frontmost app.")
  var active = false

  @Flag(name: .customLong("no-shadow"), help: "Capture without the window shadow.")
  var noShadow = false

  mutating func validate() throws {
    _ = try selector()
  }

  func selector() throws -> WindowSelector {
    switch (id, app, active) {
    case let (id?, nil, false):
      try requireNoAppFilters()
      return .id(id)
    case let (nil, app?, false):
      if let title {
        do {
          _ = try NSRegularExpression(pattern: title)
        } catch {
          throw ValidationError("--title is not a valid regular expression: \(error.localizedDescription)")
        }
      }
      if let index, index < 0 {
        throw ValidationError("--index must be 0 or greater.")
      }
      return .app(AppWindowQuery(app: app, titlePattern: title, index: index))
    case (nil, nil, true):
      try requireNoAppFilters()
      return .active
    default:
      throw ValidationError("Pass exactly one of --id, --app or --active.")
    }
  }

  private func requireNoAppFilters() throws {
    if title != nil || index != nil {
      throw ValidationError("--title and --index only apply with --app.")
    }
  }

  func run() async throws {
    try await CaptureCommand.run(
      .captureWindow,
      params: CaptureWindowParams(
        window: selector(),
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

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/StatusCommand.swift`
```
//
//  StatusCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct StatusCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "status",
    abstract: "Show whether Snapzy can capture for this app."
  )

  @OptionGroup var global: GlobalOptions

  func run() async throws {
    try await CommandRunner.run(global) { client, renderer in
      let status = try client.call(.systemStatus, as: CLIStatus.self)
      try StandardStreams.write(renderer.render(status))
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/VersionCommand.swift`
```
//
//  VersionCommand.swift
//  SnapzyCLICore
//
//  Prints the CLI version even when Snapzy is unreachable, then exits with
//  the connection error's code.
//

import ArgumentParser
import SnapzyCLIClient
import SnapzyCLIProtocol

struct VersionInfo: Codable, Equatable, HumanReadable {
  let cliVersion: String
  let protocolVersion: ProtocolVersion
  let appVersion: String?
  let appBuild: String?

  var humanDescription: String {
    guard let appVersion else { return "snapzy \(cliVersion)" }
    return "snapzy \(cliVersion) (Snapzy \(appVersion)\(appBuild.map { " build \($0)" } ?? ""))"
  }
}

struct VersionCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "version",
    abstract: "Show the CLI and Snapzy versions."
  )

  @OptionGroup var global: GlobalOptions

  func run() async throws {
    let renderer = global.renderer
    var hello: HelloResponse?
    var connectionError: CLIError?

    // Never start Snapzy just to print a version.
    var sessionOptions = global.sessionOptions
    sessionOptions.allowsLaunch = false

    do {
      let client = try await CLISession.open(sessionOptions)
      hello = client.hello
      client.close()
    } catch let error as CLIError {
      connectionError = error
    }

    let info = VersionInfo(
      cliVersion: CLIVersion.current,
      protocolVersion: .current,
      appVersion: hello?.appVersion,
      appBuild: hello?.appBuild
    )
    try StandardStreams.write(renderer.render(info))

    if let connectionError {
      try await CommandRunner.reportingErrors(renderer) { throw connectionError }
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/GlobalOptions.swift`
```
//
//  GlobalOptions.swift
//  SnapzyCLICore
//
//  Options every command accepts, plus the shared run loop: open a session,
//  run the command body, and turn any failure into a rendered error and a
//  documented exit code.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct GlobalOptions: ParsableArguments {
  @Flag(help: "Print JSON even when stdout is a terminal.")
  var json = false

  @Option(help: "Seconds to wait for each Snapzy request.")
  var timeout: Double = 30

  @Option(name: .customLong("launch-timeout"), help: "Seconds to wait for Snapzy to start.")
  var launchTimeout: Double = 15

  @Flag(name: .customLong("no-launch"), help: "Fail instead of starting Snapzy when it is not running.")
  var noLaunch = false

  mutating func validate() throws {
    guard timeout > 0 else { throw ValidationError("--timeout must be greater than 0.") }
    guard launchTimeout > 0 else { throw ValidationError("--launch-timeout must be greater than 0.") }
  }

  var sessionOptions: CLISession.Options {
    CLISession.Options(
      requestTimeout: timeout,
      launchTimeout: launchTimeout,
      allowsLaunch: !noLaunch,
      cliVersion: CLIVersion.current
    )
  }

  var renderer: OutputRenderer {
    OutputRenderer(mode: OutputRenderer.mode(jsonFlag: json, stdoutIsTerminal: StandardStreams.stdoutIsTerminal))
  }
}

enum CommandRunner {
  /// Opens a session, runs `body`, and converts failures into exit codes.
  static func run(
    _ options: GlobalOptions,
    _ body: (CLIClient, OutputRenderer) throws -> Void
  ) async throws {
    let renderer = options.renderer
    try await reportingErrors(renderer) {
      let client = try await CLISession.open(options.sessionOptions)
      defer { client.close() }
      try body(client, renderer)
    }
  }

  static func reportingErrors(_ renderer: OutputRenderer, _ body: () async throws -> Void) async throws {
    do {
      try await body()
    } catch let error as CLIError {
      StandardStreams.writeError(renderer.render(error: error))
      throw ExitCode(error.code.exitCode)
    } catch let exitCode as ExitCode {
      throw exitCode
    } catch {
      let wrapped = CLIError(.internal, String(describing: error))
      StandardStreams.writeError(renderer.render(error: wrapped))
      throw ExitCode(wrapped.code.exitCode)
    }
  }
}

enum StandardStreams {
  static var stdoutIsTerminal: Bool {
    isatty(STDOUT_FILENO) == 1
  }

  /// `write(contentsOf:)` throws on a closed pipe instead of raising an
  /// Objective-C exception; SIGPIPE is ignored in `SnapzyCommand.execute`.
  static func write(_ string: String) {
    try? FileHandle.standardOutput.write(contentsOf: Data(string.utf8))
  }

  static func writeError(_ string: String) {
    try? FileHandle.standardError.write(contentsOf: Data(string.utf8))
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Output/ArgumentConformances.swift`
```
//
//  ArgumentConformances.swift
//  SnapzyCLICore
//
//  Lets wire types be parsed directly from command-line values. `CLIRect` and
//  `DisplaySelector` already provide `init?(argument:)` in SnapzyCLIProtocol.
//

import ArgumentParser
import SnapzyCLIProtocol

extension CLIRect: ExpressibleByArgument {}

extension DisplaySelector: ExpressibleByArgument {}

extension CLIImageFormat: ExpressibleByArgument {
  /// Accepts `png`, `jpg`, `jpeg` and `webp`.
  public init?(argument: String) {
    self.init(fileExtension: argument)
  }

  public static var allValueStrings: [String] {
    ["png", "jpg", "webp"]
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #652** (2026-10-20): **[Bug]: Recording stop button cannot be clicked**
  *Symptoms*: ### Description  Recording stop button cannot be clicked System: MacOS 15.8.1 App version: 2.0.0  https://github.com/user-attachments/assets/d3ebd67e-21d0-4f11-a14b-13e429173b3f  ### Steps to Reproduce  1、Start screen recording 2、 Click the stop button  ### Expected Behavior  Can stop normally  ### Actual Behavior  Stop button click unresponsive, unable to stop screen recording normally  ### Screenshots / Recordings  _No response_  ### Snapzy Version  2.0.0  ### macOS Version  macOS 15 (Sequoia)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @rigoud, thanks for the report and the video. This is fixed in #655 (thanks @lvqviet).  **What was wrong:** on macOS 13–15, the Stop button in the floating recording bar didn't respond to clicks. The button redrew itself the moment you pressed it, and that cancelled the click before it registered. Pause, Restart and Delete weren't affected.  **Where to get it:** the fix ships in **[v2.1.0-beta.9](https://github.com/duongductrong/Snapzy/releases/tag/v2.1.0-beta.9)**. That build is being published now and should be available shortly.  You're on 2.0.0 (Stable), so you'll need to switch to the beta channel to get it: 1. Open **Snapzy → Settings → About**. 2. Set **Update Channel** to **Beta**. 3. Check for updates and install **v2.1.0-beta.9**.  If you'd rather stay on Stable, the fix will also be in the next stable release.  If Stop still doesn't respond after updating, please reopen this issue and include your macOS version. Thanks!

- **Issue #651** (2026-10-19): **[Bug]: Incorrect capture coordinates / clipping issue on screenshot**
  *Symptoms*: ### Description  When taking a screenshot, the capture area/overlay is misaligned, resulting in a clipped/partially cut-off image.  MacOS: 27.0  ### Steps to Reproduce  1. Cmd Shift 3 2. Select capture area 3. See the bug  ### Expected Behavior  Exactly what i select  ### Actual Behavior  Incorrect image capture  ### Screenshots / Recordings  https://drive.google.com/drive/folders/1AWi2zADoKmRVxD8qg_QqLXgU2J3_OYo_?usp=sharing  ### Snapzy Version  2.0.0  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="2560" height="1440" alt="Image" src="https://github.com/user-attachments/assets/50fa480c-b593-42ae-b5e5-3f5a622d61cf" /> Having this outcome of clipped screenshots also when taking a full screen shot (had to blur the top of the image).
  > Thanks for the report and the screenshots @thachtranvn @larswinter!  This looks like the same root cause as #623: when Snapzy puts temporarily hidden windows back into a ScreenCaptureKit image (e.g. with "Hide desktop icons" / "Hide desktop widgets" enabled), the restored patch was drawn at its vertical mirror. That leaves a rectangular block of wrong or missing content in the middle of the capture. It affected full-screen and area captures, which matches what you're both seeing.  It was fixed in #642 and shipped in [v2.1.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.1.0-beta.3). The latest beta, [v2.1.0-beta.6](https://github.com/duongductrong/Snapzy/releases/tag/v2.1.0-beta.6), includes it as well. v2.0.0 (stable) does not have the fix yet.  Please update to v2.1.0-beta.6 (or the next stable release). As a workaround on 2.0.0, you can turn off "Hide desktop icons" and "Hide desktop widgets" in Preferences.  Closing this for now. If the clipping still happens on v2

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

### Incident Patch 1: `6f6888fe` (2026-10-20)
**Commit Message**: fix: Cut paused recording spans by sample timestamps

Pause/resume measured the paused span with Date() on the main thread and
applied it to samples whenever they reached the writer queue. Frames
captured during the pause but delivered after resume were mapped behind
the last written frame, and a non-increasing video PTS fails the
AVAssetWriter, losing the whole recording.

Pause and resume points are now taken from the host time clock that
stamps the samples, each sample is classified by its own PTS, and video
frames that would not advance the track are dropped.

**File**: `Snapzy/Features/Recording/RecordingPauseTimeline.swift` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+//
+//  RecordingPauseTimeline.swift
+//  Snapzy
+//
+//  Maps capture-clock sample timestamps onto the written timeline, cutting out paused spans.
+//
+
+import CoreMedia
+
+/// Pause and resume points are measured on the host time clock, the same clock ScreenCaptureKit
+/// and AVCaptureSession stamp samples with, so each sample is classified by its own timestamp
+/// rather than by when it happens to reach the writer queue.
+nonisolated struct RecordingPauseTimeline: Sendable {
+  /// Total paused time removed from samples captured after the latest resume.
+  private(set) var accumulatedOffset: CMTime = .zero
+  private var pausedAt: CMTime?
+  private var resumedAt: CMTime?
+  private(set) var lastVideoTime: CMTime?
+
+  var isPaused: Bool { pausedAt != nil }
+
+  mutating func pause(at hostTime: CMTime) {
+    guard pausedAt == nil, hostTime.isNumeric else { return }
+    pausedAt = hostTime
+  }
+
+  mutating func resume(at hostTime: CMTime) {
+    guard let pausedAt, hostTime.isNumeric else { return }
+    let pausedDuration = CMTimeSubtract(hostTime, pausedAt)
+    if pausedDuration > .zero {
+      accumulatedOffset = CMTimeAdd(accumulatedOffset, pausedDuration)
+    }
+    self.pausedAt = nil
+    resumedAt = CMTimeMaximum(hostTime, pausedAt)
+  }
+
+  /// Output timestamp for a sample, or nil when it was captured while paused.
+  /// Samples captured before the latest resume but delivered after it are dropped too.
+  func outputTime(for sourceTime: CMTime) -> CMTime? {
+    guard sourceTime.isNumeric else { return nil }
+    if let pausedAt, sourceTime >= pausedAt { return nil }
+    if let resumedAt, sourceTime < resumedAt { return nil }
+    return accumulatedOffset > .zero ? CMTimeSubtract(sourceTime, accumulatedOffset) : sourceTime
+  }
+
+  /// Like `outputTime(for:)`, but also rejects frames that would not advance the video track:
+  /// AVAssetWriter fails the whole file on a non-increasing video presentation time.
+  mutating func acceptVideoFrame(at sourceTime: CMTime) -> CMTime? {
+    guard let output = outputTime(for: sourceTime) else { return nil }
+    if let lastVideoTime, output <= lastVideoTime { return nil }
+    lastVideoTime = output
+    return output
+  }
+}
```

**File**: `Snapzy/Features/Recording/RecordingSession.swift` (modified, +32/-23)
```diff
@@ -34,7 +34,7 @@ nonisolated final class RecordingSession: @unchecked Sendable {
   private var _sessionStarted = false
   private var _isCapturing = false
   private var _firstTimestamp: CMTime?  // Track first video timestamp for timeline alignment
-  private var _pauseOffsetAccumulator: CMTime = .zero
+  private var _pauseTimeline = RecordingPauseTimeline()
   private var _onFirstVideoFrame: (() -> Void)?
   private var _videoFramesReceived = 0
   private var _videoFramesAppended = 0
@@ -123,11 +123,20 @@ nonisolated final class RecordingSession: @unchecked Sendable {
     }
   }
 
-  /// Set the total accumulated pause duration for PTS adjustment.
-  /// Called by ScreenRecordingManager on each resume.
-  func setAccumulatedPauseOffset(_ offset: CMTime) {
+  /// Stop writing samples captured at or after `hostTime` (host time clock, like sample PTS).
+  func pause(atHostTime hostTime: CMTime) {
     lock.withLock {
-      _pauseOffsetAccumulator = offset
+      _pauseTimeline.pause(at: hostTime)
+    }
+  }
+
+  /// Resume writing samples captured at or after `hostTime`, shifted back by the paused span.
+  /// Returns the total paused duration so far.
+  @discardableResult
+  func resume(atHostTime hostTime: CMTime) -> CMTime {
+    lock.withLock {
+      _pauseTimeline.resume(at: hostTime)
+      return _pauseTimeline.accumulatedOffset
     }
   }
 
@@ -189,13 +198,15 @@ nonisolated final class RecordingSession: @unchecked Sendable {
     let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
     guard timestamp.isValid else { return }
 
-    // Consolidate locks and read dimensions/offset in one acquisition
+    // Consolidate locks and read dimensions/output time in one acquisition
     var shouldLogDimensionMismatch = false
-    let (writer, videoInput, adaptor, shouldStartSession, onFirstVideoFrame, offset, expectedWidth, expectedHeight, pixelWidth, pixelHeight): (
+    let (writer, videoInput, adaptor, shouldStartSession, onFirstVideoFrame, adjustedTimestamp, expectedWidth, expectedHeight, pixelWidth, pixelHeight): (
       AVAssetWriter?, AVAssetWriterInput?, AVAssetWriterInputPixelBufferAdaptor?, Bool, (() -> Void)?, CMTime, Int?, Int?, Int, Int
     ) = lock.withLock {
-      guard _isCapturing, let writer = _assetWriter, writer.status == .writing else {
-        return (nil, nil, nil, false, nil, .zero, nil, nil, 0, 0)
+      guard _isCapturing, let writer = _assetWriter, writer.status == .writing,
+            // Drops frames captured while paused and any frame that would not advance the track.
+            let adjustedTimestamp = _pauseTimeline.acceptVideoFrame(at: timestamp) else {
+        return (nil, nil, nil, false, nil, .invalid, nil, nil, 0, 0)
       }
 
       let w = CVPixelBufferGetWidth(pixelBuffer)
@@ -208,8 +219,6 @@ nonisolated final class RecordingSession: @unchecked Sendable {
         shouldLogDimensionMismatch = true
       }
 
-      let offset = _pauseOffsetAccumulator
-
       // `_firstTimestamp` is published only after `startSession` runs below:
       // audio queues treat it as "session started" and append right away.
       var needsSessionStart = false
@@ -220,7 +229,7 @@ nonisolated final class RecordingSession: @unchecked Sendable {
 
       _videoFramesReceived += 1
 
-      return (writer, _videoInput, _pixelBufferAdaptor, needsSessionStart, _onFirstVideoFrame, offset, _expectedVideoWidth, _expectedVideoHeight, w, h)
+      return (writer, _videoInput, _pixelBufferAdaptor, needsSessionStart, _onFirstVideoFrame, adjustedTimestamp, _expectedVideoWidth, _expectedVideoHeight, w, h)
     }
 
     if shouldLogDimensionMismatch, let expectedWidth = expectedWidth, let expectedHeight = expectedHeight {
@@ -234,8 +243,6 @@ nonisolated final class RecordingSession: @unchecked Sendable {
           let videoInput = videoInput,
           let adaptor = adaptor else { return }
 
-    let adjustedTimestamp = offset.isNumeric && offset > .zero ? CMTimeSubtract(timestamp, offset) : timestamp
-
     // Lazy start session at first video timestamp.
     // This avoids rewriting every audio sample (large per-buffer allocations).
     if shouldStartSession {
@@ -279,19 +286,20 @@ nonisolated final class RecordingSession: @unchecked Sendable {
     guard timestamp.isValid else { return }
     logAudioSampleFormatIfNeeded(sampleBuffer, role: .systemAudio)
 
-    let (writer, audioInput, firstTs, offset): (AVAssetWriter?, AVAssetWriterInput?, CMTime?, CMTime) = lock.withLock {
+    let (writer, audioInput, firstTs, adjustedTimestamp, offset): (AVAssetWriter?, AVAssetWriterInput?, CMTime?, CMTime?, CMTime) = lock.withLock {
       guard _isCapturing, let writer = _assetWriter, writer.status == .writing else {
-        return (nil, nil, nil, .zero)
+        return (nil, nil, nil, nil, .zero)
       }
-      return (writer, _audioInput, _firstTimestamp, _pauseOffsetAccumulator)
+      return (writer, _audioInput, _firstTimestamp, _pauseTimeline.outputTime(for: timestamp), 
```

**File**: `Snapzy/Services/Capture/ScreenRecordingManager.swift` (modified, +6/-7)
```diff
@@ -1162,7 +1162,9 @@ final class ScreenRecordingManager: NSObject, ObservableObject {
       DiagnosticLogger.shared.log(.debug, .recording, "pauseRecording ignored", context: ["state": "\(state)"])
       return
     }
-    session.isCapturing = false
+    // Samples are cut by their own capture timestamps, so frames already in flight when the user
+    // clicks pause still land, and frames captured during the pause are dropped even if late.
+    session.pause(atHostTime: CMClockGetTime(CMClockGetHostTimeClock()))
     mouseTracker?.pause()
     audioLevelMeter.freeze()
     pauseStartTime = Date()
@@ -1176,19 +1178,16 @@ final class ScreenRecordingManager: NSObject, ObservableObject {
       DiagnosticLogger.shared.log(.debug, .recording, "resumeRecording ignored", context: ["state": "\(state)"])
       return
     }
+    // Wall-clock duration only drives the elapsed-time label; the writer uses host-clock time.
     pausedDuration += Date().timeIntervalSince(pauseStart)
     pauseStartTime = nil
 
-    // Set accumulated pause offset in CoreMedia time before resuming capture
-    let offset = CMTime(seconds: pausedDuration, preferredTimescale: 1_000_000)
-    session.setAccumulatedPauseOffset(offset)
-
-    session.isCapturing = true
+    let offset = session.resume(atHostTime: CMClockGetTime(CMClockGetHostTimeClock()))
     mouseTracker?.resume()
     audioLevelMeter.unfreeze()
     state = .recording
     DiagnosticLogger.shared.log(.info, .recording, "Recording resumed", context: [
-      "pauseOffsetSeconds": String(format: "%.3f", pausedDuration)
+      "pauseOffsetSeconds": String(format: "%.3f", offset.seconds)
     ])
   }
 
```

**File**: `SnapzyTests/Features/Recording/RecordingPauseTimelineTests.swift` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+//
+//  RecordingPauseTimelineTests.swift
+//  SnapzyTests
+//
+//  Unit tests for mapping capture timestamps across pause/resume.
+//
+
+import CoreMedia
+import XCTest
+@testable import Snapzy
+
+final class RecordingPauseTimelineTests: XCTestCase {
+
+  private func t(_ seconds: Double) -> CMTime {
+    CMTime(seconds: seconds, preferredTimescale: 600)
+  }
+
+  func testOutputTime_withoutPause_isUnchanged() {
+    let timeline = RecordingPauseTimeline()
+    XCTAssertEqual(timeline.outputTime(for: t(3)), t(3))
+  }
+
+  func testOutputTime_dropsSamplesCapturedWhilePaused() {
+    var timeline = RecordingPauseTimeline()
+    timeline.pause(at: t(10))
+
+    XCTAssertEqual(timeline.outputTime(for: t(9.9)), t(9.9), "in-flight pre-pause sample still lands")
+    XCTAssertNil(timeline.outputTime(for: t(10)))
+    XCTAssertNil(timeline.outputTime(for: t(12)))
+  }
+
+  func testOutputTime_afterResume_shiftsByPausedDuration() {
+    var timeline = RecordingPauseTimeline()
+    timeline.pause(at: t(10))
+    timeline.resume(at: t(14))
+
+    XCTAssertEqual(timeline.accumulatedOffset, t(4))
+    XCTAssertEqual(timeline.outputTime(for: t(14.5)), t(10.5))
+  }
+
+  func testOutputTime_afterResume_dropsLateSamplesFromPausedSpan() {
+    var timeline = RecordingPauseTimeline()
+    timeline.pause(at: t(10))
+    timeline.resume(at: t(14))
+
+    // Captured during the pause but delivered after resume: mapping it would go backwards.
+    XCTAssertNil(timeline.outputTime(for: t(12)))
+  }
+
+  func testOutputTime_accumulatesAcrossMultiplePauses() {
+    var timeline = RecordingPauseTimeline()
+    timeline.pause(at: t(10))
+    timeline.resume(at: t(12))
+    timeline.pause(at: t(20))
+    timeline.resume(at: t(23))
+
+    XCTAssertEqual(timeline.outputTime(for: t(24)), t(19))
+  }
+
+  func testResume_withoutPause_isIgnored() {
+    var timeline = RecordingPauseTimeline()
+    timeline.resume(at: t(5))
+    XCTAssertEqual(timeline.accumulatedOffset, .zero)
+    XCTAssertEqual(timeline.outputTime(for: t(1)), t(1))
+  }
+
+  func testResume_beforePausePoint_doesNotAddNegativeOffset() {
+    var timeline = RecordingPauseTimeline()
+    timeline.pause(at: t(10))
+    timeline.resume(at: t(9))
+    XCTAssertEqual(timeline.accumulatedOffset, .zero)
+    XCTAssertFalse(timeline.isPaused)
+    XCTAssertNil(timeline.outputTime(for: t(9.5)), "samples before the pause point stay cut")
+    XCTAssertEqual(timeline.outputTime(for: t(10)), t(10))
+  }
+
+  func testAcceptVideoFrame_rejectsNonIncreasingTimestamps() {
+    var timeline = RecordingPauseTimeline()
+    XCTAssertEqual(timeline.acceptVideoFrame(at: t(1)), t(1))
+    XCTAssertNil(timeline.acceptVideoFrame(at: t(1)))
+    XCTAssertNil(timeline.acceptVideoFrame(at: t(0.5)))
+    XCTAssertEqual(timeline.acceptVideoFrame(at: t(1.1)), t(1.1))
+  }
+
+  func testAcceptVideoFrame_acrossPause_staysStrictlyIncreasing() {
+    var timeline = RecordingPauseTimeline()
+    XCTAssertEqual(timeline.acceptVideoFrame(at: t(9.9)), t(9.9))
+    timeline.pause(at: t(10))
+    XCTAssertNil(timeline.acceptVideoFrame(at: t(11)))
+    timeline.resume(at: t(15))
+    XCTAssertNil(timeline.acceptVideoFrame(at: t(14.9)))
+
+    let resumed = timeline.acceptVideoFrame(at: t(15))
+    XCTAssertEqual(resumed, t(10))
+    XCTAssertEqual(timeline.lastVideoTime, t(10))
+  }
+
+  func testOutputTime_rejectsInvalidTimestamp() {
+    var timeline = RecordingPauseTimeline()
+    XCTAssertNil(timeline.outputTime(for: .invalid))
+    XCTAssertNil(timeline.acceptVideoFrame(at: .invalid))
+  }
+}
```

**File**: `SnapzyTests/Features/Recording/RecordingSessionTests.swift` (modified, +9/-5)
```diff
@@ -64,14 +64,18 @@ final class RecordingSessionTests: XCTestCase {
     session.configureExpectedVideoDimensions(width: 1920, height: 1080)
   }
 
-  func testSetAccumulatedPauseOffset_doesNotCrash() {
-    let offset = CMTime(seconds: 5.0, preferredTimescale: 1_000_000)
-    session.setAccumulatedPauseOffset(offset)
+  func testResume_returnsAccumulatedPausedDuration() {
+    session.pause(atHostTime: CMTime(seconds: 10, preferredTimescale: 600))
+    let offset = session.resume(atHostTime: CMTime(seconds: 15, preferredTimescale: 600))
+    XCTAssertEqual(offset.seconds, 5, accuracy: 0.001)
   }
 
   func testReset_clearsPauseOffset() {
-    let offset = CMTime(seconds: 5.0, preferredTimescale: 1_000_000)
-    session.setAccumulatedPauseOffset(offset)
+    session.pause(atHostTime: CMTime(seconds: 10, preferredTimescale: 600))
+    session.resume(atHostTime: CMTime(seconds: 15, preferredTimescale: 600))
     session.reset()
+    session.pause(atHostTime: CMTime(seconds: 20, preferredTimescale: 600))
+    let offset = session.resume(atHostTime: CMTime(seconds: 21, preferredTimescale: 600))
+    XCTAssertEqual(offset.seconds, 1, accuracy: 0.001)
   }
 }
```

**File**: `docs/RECORDING.md` (modified, +2/-2)
```diff
@@ -71,8 +71,8 @@ The toolbar's Fullscreen toggle keeps the display already selected: `restartSele
 
 ## Pause / Resume
 
-- `pauseRecording()` keeps the stream alive but flips `RecordingSession.isCapturing = false` so all incoming samples are dropped; `resumeRecording()` accumulates the wall-clock pause into `pausedDuration`, calls `session.setAccumulatedPauseOffset(CMTime)` **before** setting `isCapturing = true` (fix 70f7f36).
-- `RecordingSession` subtracts the accumulated offset from every video PTS and re-times audio/mic buffers through `CMSampleBufferCreateCopyWithNewTiming`, so the output timeline has no pause gap.
+- `pauseRecording()` / `resumeRecording()` keep the stream alive and call `session.pause(atHostTime:)` / `session.resume(atHostTime:)` with `CMClockGetHostTimeClock()` time — the clock ScreenCaptureKit and the mic `AVCaptureSession` stamp samples with.
+- `RecordingPauseTimeline` (inside `RecordingSession`) classifies every sample by its own PTS: samples captured in a paused span are dropped even if they reach the writer queue after resume, and later samples are shifted back by the accumulated paused time (audio/mic re-timed through `CMSampleBufferCreateCopyWithNewTiming`), so the output has no pause gap. Video frames whose output PTS would not advance past the last written frame are dropped, since a non-increasing PTS fails the `AVAssetWriter`.
 - The menu bar / status bar timer is wall clock minus `pausedDuration` (`updateElapsedTime`).
 - `RecordingMouseTracker.pause()/resume()` keeps sample times consistent with the same exclusion.
 - Global shortcut `GlobalShortcutKind.pauseResumeRecording` ships unbound (seeded into `clearedShortcuts`; recommended `⌘⇧Space`); bound in Preferences → Shortcuts → Recording it dispatches `ScreenRecordingManager.togglePause()` only when `RecordingState.isPauseResumeEligible` (`.recording` / `.paused`), silent no-op otherwise. The menu bar also gains Pause/Resume during recording.
```

---

### Incident Patch 2: `ef5e914d` (2026-10-20)
**Commit Message**: fix: Read history records from the database in the retention sweep

The launch sweep ran from a Task right after CaptureHistoryStore was
created, while its GRDB observation publishes records asynchronously on
the main queue. When the sweep won, records was still empty and every
history thumbnail, annotation session and video editor session counted
as an orphan and was deleted.

The sweep now reads records with fetchRecords() before and after
retention deletes and skips orphan cleanup when that read fails.

**File**: `Snapzy/Services/History/CaptureHistoryRetentionService.swift` (modified, +44/-65)
```diff
@@ -52,7 +52,9 @@ final class CaptureHistoryRetentionService {
       DiagnosticLogger.shared.log(.debug, .history, "Capture history retention sweep skipped; history disabled")
       return
     }
-    guard CaptureHistoryStore.shared.isDatabaseAvailable else {
+    // Read records from the database rather than `CaptureHistoryStore.records`: at launch the
+    // observation may not have published yet, and an empty list would wipe every sidecar.
+    guard let recordsBeforeSweep = CaptureHistoryStore.shared.fetchRecords() else {
       DiagnosticLogger.shared.log(
         .warning,
         .history,
@@ -73,7 +75,8 @@ final class CaptureHistoryRetentionService {
     )
 
     // Collect temp file paths before deleting records so we can clean them up afterward
-    let tempPathsToDelete = collectTempFilePathsForRecordsToDelete(
+    let tempPathsToDelete = Self.tempFilePathsForRecordsToDelete(
+      in: recordsBeforeSweep,
       retentionDays: retentionDays,
       maxCount: maxCount
     )
@@ -97,10 +100,19 @@ final class CaptureHistoryRetentionService {
     // Delete associated temp files that are no longer referenced by any history record
     deleteUnreferencedTempFiles(paths: tempPathsToDelete)
 
+    guard let remainingRecords = CaptureHistoryStore.shared.fetchRecords() else {
+      DiagnosticLogger.shared.log(
+        .warning,
+        .history,
+        "Capture history orphan cleanup skipped; records unavailable after retention"
+      )
+      return
+    }
+
     // Clean up orphaned thumbnails
-    await cleanupOrphanedThumbnails()
-    cleanupOrphanedAnnotationSessions()
-    cleanupOrphanedVideoEditorSessions()
+    await cleanupOrphanedThumbnails(keeping: remainingRecords)
+    cleanupOrphanedAnnotationSessions(keeping: remainingRecords)
+    cleanupOrphanedVideoEditorSessions(keeping: remainingRecords)
 
     logger.info("Retention sweep completed")
     DiagnosticLogger.shared.log(
@@ -112,39 +124,34 @@ final class CaptureHistoryRetentionService {
   }
 
   /// Collect temp file paths for records that will be deleted by retention.
-  /// Returns paths that are in the temp directory and will be removed.
-  private func collectTempFilePathsForRecordsToDelete(
+  /// `allRecords` must be ordered newest first. Returns paths that are in the temp directory.
+  static func tempFilePathsForRecordsToDelete(
+    in allRecords: [CaptureHistoryRecord],
     retentionDays: Int,
-    maxCount: Int
+    maxCount: Int,
+    now: Date = Date(),
+    isTempFile: ((URL) -> Bool)? = nil
   ) -> [String] {
-    let store = CaptureHistoryStore.shared
-    guard store.isDatabaseAvailable else { return [] }
-
-    let tempManager = TempCaptureManager.shared
-
+    let isTempFile = isTempFile ?? { TempCaptureManager.shared.isTempFile($0) }
     var pathsToDelete: [String] = []
 
-    do {
-      let allRecords = store.records
-
-      // Find records older than retentionDays
-      if retentionDays > 0 {
-        let cutoff = Date().addingTimeInterval(-TimeInterval(retentionDays * 24 * 60 * 60))
-        for record in allRecords where record.capturedAt < cutoff {
-          if tempManager.isTempFile(record.fileURL) {
-            pathsToDelete.append(record.filePath)
-          }
+    // Find records older than retentionDays
+    if retentionDays > 0 {
+      let cutoff = now.addingTimeInterval(-TimeInterval(retentionDays * 24 * 60 * 60))
+      for record in allRecords where record.capturedAt < cutoff {
+        if isTempFile(record.fileURL) {
+          pathsToDelete.append(record.filePath)
         }
       }
+    }
 
-      // Find records that would be trimmed by maxCount
-      if maxCount > 0, allRecords.count > maxCount {
-        let excess = allRecords.count - maxCount
-        let oldestRecords = allRecords.suffix(excess)
-        for record in oldestRecords {
-          if tempManager.isTempFile(record.fileURL), !pathsToDelete.contains(record.filePath) {
-            pathsToDelete.append(record.filePath)
-          }
+    // Find records that would be trimmed by maxCount
+    if maxCount > 0, allRecords.count > maxCount {
+      let excess = allRecords.count - maxCount
+      let oldestRecords = allRecords.suffix(excess)
+      for record in oldestRecords {
+        if isTempFile(record.fileURL), !pathsToDelete.contains(record.filePath) {
+          pathsToDelete.append(record.filePath)
         }
       }
     }
@@ -207,18 +214,8 @@ final class CaptureHistoryRetentionService {
   // MARK: - Private
 
   /// Remove thumbnails that no longer have a corresponding history record
-  private func cleanupOrphanedThumbnails() async {
+  private func cleanupOrphanedThumbnails(keeping records: [CaptureHistoryRecord]) async {
     let generator = HistoryThumbnailGenerator.shared
-    let store = CaptureHistoryStore.shared
-    guard store.isDatabaseAvailable else {
-      DiagnosticLogger.shared.log(
-        .warning,
-        .history,
-        "Capture history orphan thumbnail cleanup skipped; database
```

**File**: `Snapzy/Services/History/CaptureHistoryStore.swift` (modified, +13/-4)
```diff
@@ -621,17 +621,26 @@ final class CaptureHistoryStore: ObservableObject {
   }
 
   func refreshRecords() {
-    guard let dbPool = requireDatabase(for: "refresh capture history records") else { return }
+    guard let fetchedRecords = fetchRecords() else { return }
+    records = fetchedRecords
+  }
+
+  /// Reads all records straight from the database, newest first, without waiting for the
+  /// observation to publish them. Returns nil when the read fails, so callers doing cleanup
+  /// can tell "no records" apart from "records not available".
+  func fetchRecords() -> [CaptureHistoryRecord]? {
+    guard let dbPool = requireDatabase(for: "fetch capture history records") else { return nil }
 
     do {
-      records = try dbPool.read { db in
+      return try dbPool.read { db in
         try CaptureHistoryRecord
           .order(Column("capturedAt").desc)
           .fetchAll(db)
       }
     } catch {
-      logger.error("Failed to refresh capture history records: \(error.localizedDescription)")
-      DiagnosticLogger.shared.logError(.history, error, "Capture history refresh failed")
+      logger.error("Failed to fetch capture history records: \(error.localizedDescription)")
+      DiagnosticLogger.shared.logError(.history, error, "Capture history fetch failed")
+      return nil
     }
   }
 
```

**File**: `SnapzyTests/Services/History/CaptureHistoryRetentionServiceTests.swift` (modified, +62/-0)
```diff
@@ -190,6 +190,68 @@ final class CaptureHistoryRetentionServiceTests: XCTestCase {
     XCTAssertFalse(FileManager.default.fileExists(atPath: videoSessionDirectory(for: inactiveURL).path))
   }
 
+  func testSweep_keepsSidecarsWhenStoreHasNotPublishedRecordsYet() async throws {
+    let sourceURL = try writeSourceFile(named: "launch.png")
+    let videoURL = try writeSourceFile(named: "launch.mov")
+    let masterURL = try writeSourceFile(named: "launch-master.mov")
+    CaptureHistoryStore.shared.add(makeRecord(filePath: sourceURL.path))
+    CaptureHistoryStore.shared.add(makeRecord(filePath: videoURL.path))
+    XCTAssertTrue(annotationSessionStore.persist(makeSessionData(), for: sourceURL))
+    XCTAssertTrue(
+      videoEditorSessionStore.persist(VideoEditorSessionData(sourceSnapshotURL: masterURL), for: videoURL)
+    )
+    // No refreshRecords(): like app launch, the observation has not delivered the rows yet.
+    try XCTSkipUnless(
+      CaptureHistoryStore.shared.records.isEmpty,
+      "Observation already published the new rows; the launch race cannot be reproduced"
+    )
+
+    await service.sweep()
+
+    XCTAssertNotNil(annotationSessionStore.load(for: sourceURL))
+    XCTAssertNotNil(videoEditorSessionStore.load(for: videoURL))
+  }
+
+  func testFetchRecords_readsDatabaseBeforeObservationPublishes() {
+    let record = makeRecord()
+    CaptureHistoryStore.shared.add(record)
+
+    XCTAssertEqual(CaptureHistoryStore.shared.fetchRecords()?.map(\.id), [record.id])
+  }
+
+  // MARK: - temp file collection
+
+  func testTempFilePaths_collectsExpiredAndOverflowTempRecords() {
+    let now = Date()
+    let newest = makeRecord(filePath: "/tmp/newest.png", capturedAt: now)
+    let overflow = makeRecord(filePath: "/tmp/overflow.png", capturedAt: now.addingTimeInterval(-60))
+    let expired = makeRecord(filePath: "/tmp/expired.png", capturedAt: now.addingTimeInterval(-86400 * 10))
+    let expiredSaved = makeRecord(filePath: "/saved/expired.png", capturedAt: now.addingTimeInterval(-86400 * 11))
+
+    let paths = CaptureHistoryRetentionService.tempFilePathsForRecordsToDelete(
+      in: [newest, overflow, expired, expiredSaved],
+      retentionDays: 7,
+      maxCount: 1,
+      now: now,
+      isTempFile: { $0.path.hasPrefix("/tmp/") }
+    )
+
+    XCTAssertEqual(paths, [expired.filePath, overflow.filePath])
+  }
+
+  func testTempFilePaths_emptyWhenLimitsDisabled() {
+    let record = makeRecord(filePath: "/tmp/old.png", capturedAt: Date().addingTimeInterval(-86400 * 100))
+
+    let paths = CaptureHistoryRetentionService.tempFilePathsForRecordsToDelete(
+      in: [record],
+      retentionDays: 0,
+      maxCount: 0,
+      isTempFile: { _ in true }
+    )
+
+    XCTAssertTrue(paths.isEmpty)
+  }
+
   // MARK: - thumbnail ownership
 
   func testThumbnailOwnership_matchesLegacyAndCacheKeyedNames() {
```

**File**: `docs/HISTORY.md` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ flowchart TD
 - `CaptureHistoryRetentionService` — sweep at launch + every 24h timer.
 - Prefs: `history.retentionDays` (default 30, 0 = forever), `history.maxCount` (default 500, 0 = unlimited).
 - Sweep deletes: records older than retention, count-overflow records, unreferenced temp files, orphan thumbnails, orphan annotation sidecars (source gone / no active record / signature mismatch).
+- The sweep reads records straight from the database (`CaptureHistoryStore.fetchRecords()`), not the observed `records`, which is still empty at launch until the GRDB observation publishes; if the read fails the sweep skips orphan cleanup instead of treating history as empty.
 - `clearAllHistory()` deletes records + thumbnails + sidecars but keeps capture files on disk.
 - `history.floating.autoClearDays` is persisted/exported but never consumed — dead setting.
 
```

---

### Incident Patch 3: `dff80d1f` (2026-10-20)
**Commit Message**: fix: Free editor caches when Quick Access evicts its oldest card

Trimming the stack with removeLast() skipped the cleanup removeItem does,
leaking the full-resolution annotate session data for every evicted card.

**File**: `Snapzy/Features/QuickAccess/QuickAccessManager.swift` (modified, +26/-33)
```diff
@@ -292,17 +292,7 @@ final class QuickAccessManager: ObservableObject {
 
     // Animate insertion explicitly — no implicit .animation on the stack
     withAnimation(QuickAccessAnimations.cardInsert) {
-      if items.count >= maxVisibleItems, let oldestId = items.last?.id {
-        cancelDismissTimer(for: oldestId)
-        pinWindowManager.close(id: oldestId)
-        items.removeLast()
-        DiagnosticLogger.shared.log(
-          .debug,
-          .ui,
-          "Quick access trimmed oldest item",
-          context: ["maxVisibleItems": "\(maxVisibleItems)"]
-        )
-      }
+      trimOldestItemIfNeeded(logMessage: "Quick access trimmed oldest item")
       items.insert(item, at: 0)
     }
     DiagnosticLogger.shared.log(
@@ -368,17 +358,7 @@ final class QuickAccessManager: ObservableObject {
 
     // Animate insertion explicitly — no implicit .animation on the stack
     withAnimation(QuickAccessAnimations.cardInsert) {
-      if items.count >= maxVisibleItems, let oldestId = items.last?.id {
-        cancelDismissTimer(for: oldestId)
-        pinWindowManager.close(id: oldestId)
-        items.removeLast()
-        DiagnosticLogger.shared.log(
-          .debug,
-          .ui,
-          "Quick access trimmed oldest item",
-          context: ["maxVisibleItems": "\(maxVisibleItems)"]
-        )
-      }
+      trimOldestItemIfNeeded(logMessage: "Quick access trimmed oldest item")
       items.insert(item, at: 0)
     }
 
@@ -495,6 +475,29 @@ final class QuickAccessManager: ObservableObject {
     return item
   }
 
+  /// Drops the oldest card to make room for a new one. Frees its in-memory
+  /// editor caches like `removeItem(id:)`, but keeps the file: a new capture
+  /// must never delete an older unsaved one (launch-time cleanup reclaims it).
+  private func trimOldestItemIfNeeded(logMessage: String) {
+    guard items.count >= maxVisibleItems, let oldest = items.last else { return }
+    cancelDismissTimer(for: oldest.id)
+    pinWindowManager.close(id: oldest.id)
+    activityHoldItemIds.remove(oldest.id)
+    // An open editor still owns its session; it saves back on close.
+    if !editingItemIds.contains(oldest.id) {
+      AnnotateManager.shared.clearSessionData(for: oldest.id)
+      VideoEditorManager.shared.clearSessionData(for: oldest.id)
+      VideoEditorManager.shared.clearSessionData(for: oldest.url)
+    }
+    items.removeLast()
+    DiagnosticLogger.shared.log(
+      .debug,
+      .ui,
+      logMessage,
+      context: ["maxVisibleItems": "\(maxVisibleItems)"]
+    )
+  }
+
   /// Remove an item (screenshot or video) from the stack
   func removeItem(id: UUID) {
     guard let item = items.first(where: { $0.id == id }) else {
@@ -1444,17 +1447,7 @@ final class QuickAccessManager: ObservableObject {
     retryURL: URL
   ) {
     withAnimation(QuickAccessAnimations.cardInsert) {
-      if items.count >= maxVisibleItems, let oldestId = items.last?.id {
-        cancelDismissTimer(for: oldestId)
-        pinWindowManager.close(id: oldestId)
-        items.removeLast()
-        DiagnosticLogger.shared.log(
-          .debug,
-          .ui,
-          "Quick access trimmed oldest item for history restore",
-          context: ["maxVisibleItems": "\(maxVisibleItems)"]
-        )
-      }
+      trimOldestItemIfNeeded(logMessage: "Quick access trimmed oldest item for history restore")
       items.insert(item, at: 0)
     }
 
```

#### Recent Merged Pull Requests:
- **PR #686** (2026-10-25): chore: release v2.1.0 (@github-actions[bot])
- **PR #685** (2026-10-25): feat: Add the snapzy command line tool for agents and scripts (@duongductrong)
- **PR #683** (2026-10-24): chore: release v2.1.0-beta.15 (@github-actions[bot])
- **PR #682** (2026-10-24): feat: Show capture chrome in screen recordings (@duongductrong)
- **PR #681** (2026-10-23): chore: release v2.1.0-beta.14 (@github-actions[bot])
- **PR #680** (2026-10-23): fix: Retry DMG stapling on transient CloudKit failures (@duongductrong)

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

## X. Cut paused recording spans by sample timestamps

**RULE**:
When implementing operations in `Snapzy/Features/Recording/RecordingPauseTimeline.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6f6888fe`: Cut paused recording spans by sample timestamps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Snapzy/Features/Recording/RecordingPauseTimeline.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
//
//  RecordingPauseTimeline.swift
//  Snapzy
//
//  Maps capture-clock sample timestamps onto the written timeline, cutting out paused spans.
//

import CoreMedia

/// Pause and resume points are measured on the host time clock, the same clock ScreenCaptureKit
/// and AVCaptureSession stamp samples with, so each sample is classified by its own timestamp
/// rather than by when it happens to reach the writer queue.
nonisolated struct RecordingPauseTimeline: Sendable {
  /// Total paused time removed from samples captured after the latest resume.
  private(set) var accumulatedOffset: CMTime = .zero
  private var pausedAt: CMTime?
  private var resumedAt: CMTime?
  private(set) var lastVideoTime: CMTime?

  var isPaused: Bool { pausedAt != nil }

  mutating func pause(at hostTime: CMTime) {
    guard pausedAt == nil, hostTime.isNumeric else { return }
    pausedAt = hostTime
  }

  mutating func resume(at hostTime: CMTime) {
    guard let pausedAt, hostTime.isNumeric else { return }
    let pausedDuration = CMTimeSubtract(hostTime, pausedAt)
    if pausedDuration > .zero {
      accumulatedOffset = CMTimeAdd(accumulatedOffset, pausedDuration)
    }
    self.pausedAt = nil
    resume
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6f6888fe` are properly handled with clean fallback behavior.
