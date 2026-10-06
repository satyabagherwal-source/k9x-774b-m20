# Forensic Learning Record (Deep Inspection): osaurus-ai/osaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/osaurus-ai-osaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/osaurus-ai/osaurus](https://github.com/osaurus-ai/osaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:33.156Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `osaurus-ai/osaurus`
- **Description**: Own your AI. The native macOS harness for AI agents -- any model, persistent memory, autonomous execution, cryptographic identity. Built in Swift. Fully offline. Open source.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8021 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Bench.swift`
```
//
//  Bench.swift
//  osaurus
//
//  `osaurus bench` — standardized inference benchmark against the local
//  server, so performance changes can be stated as before/after numbers on
//  the same machine instead of impressions. Measures, per prompt size:
//
//    - uncached TTFT (unique-prefix prompt: no prefix-cache hit possible)
//    - cached TTFT   (identical prompt re-sent: paged prefix-cache hit path)
//    - prefill tok/s (prompt_tokens / uncached TTFT — includes template and
//                     tokenization overhead by design; that is what a user
//                     actually waits for)
//    - decode tok/s  (completion tokens per second between the first and
//                     last streamed delta, i.e. excluding prefill)
//
//  Token counts come from the server (`stream_options.include_usage`), not
//  client-side estimates. Sampling is greedy (temperature 0) so runs are
//  comparable. Results are emitted as JSON tagged with the server's
//  /health `hardware` block; medians over `--runs` repetitions are
//  reported alongside the raw samples.
//

import Foundation

public struct BenchCommand: Command {
    public static let name = "bench"

    private static let defaultPromptTokens = [1_024, 8_192]
    private static let defaultMaxTokens = 128
    private static let defaultRuns = 3

    private static let defaultTuneCandidates = [512, 1_024, 2_048, 4_096]

    struct Options {
        var model: String?
        var promptTokens: [Int] = BenchCommand.defaultPromptTokens
        var maxTokens: Int = BenchCommand.defaultMaxTokens
        var runs: Int = BenchCommand.defaultRuns
        var jsonPath: String?
        var port: Int
        var tunePrefill: Bool = false
        var tuneCandidates: [Int] = BenchCommand.defaultTuneCandidates
    }

    public static func execute(args: [String]) async {
        guard var options = parseOptions(args) else {
            printUsage()
            exit(EXIT_FAILURE)
        }

        let base = URL(string: "http://127.0.0.1:\(options.port)")!

        guard let health = await fetchJSON(base.appendingPathComponent("health")) else {
            fputs("Server is not running on port \(options.port). Start it with `osaurus serve`.\n", stderr)
            exit(EXIT_FAILURE)
        }

        if options.model == nil {
            options.model = await defaultModel(base: base)
        }
        guard let model = options.model else {
            fputs("No model specified and none installed. Use --model <id>.\n", stderr)
            exit(EXIT_FAILURE)
        }

        if options.tunePrefill {
            await tunePrefill(options: options, model: model, base: base, health: health)
            // tunePrefill exits the process itself.
        }

        fputs("Benchmarking \(model) (\(options.runs) runs × prompt sizes \(options.promptTokens))…\n", stderr)

        var scenarios: [[String: Any]] = []
        for target in options.promptTokens {
            var uncached: [Sample] = []
            var cached: [Sample] = []
            for run in 0..<options.runs {
                // A unique prefix guarantees the first request cannot reuse a
                // cached prefix from an earlier run; re-sending the identical
                // prompt immediately afterwards measures the cache-hit path.
                let prompt = makePrompt(targetTokens: target, nonce: "run\(run)-\(UUID().uuidString)")
                do {
                    let first = try await measureOnce(
                        base: base, model: model, prompt: prompt, maxTokens: options.maxTokens)
                    let second = try await measureOnce(
                        base: base, model: model, prompt: prompt, maxTokens: options.maxTokens)
                    uncached.append(first)
                    cached.append(second)
                    fputs(
                        String(
                            format:
                                "  prompt≈%d run %d: uncached TTFT %.0f ms → cached %.0f ms, decode %.1f tok/s\n",
                            target, run + 1, first.ttftMs, second.ttftMs, first.decodeTps),
                        stderr)
                } catch {
                    fputs("  prompt≈\(target) run \(run + 1) failed: \(error.localizedDescription)\n", stderr)
                }
            }
            guard !uncached.isEmpty else { continue }
            scenarios.append([
                "target_prompt_tokens": target,
                "actual_prompt_tokens": uncached.map { $0.promptTokens },
                "uncached": summarize(uncached),
                "cached": summarize(cached),
            ])
        }

        guard !scenarios.isEmpty else {
            fputs("All benchmark runs failed.\n", stderr)
            exit(EXIT_FAILURE)
        }

        let report: [String: Any] = [
            "schema": "osaurus-bench/1",
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "model": model,
            "max_tokens": options.maxTokens,
            "runs": options.runs,
            "hardware": (health["hardware"] as? [String: Any]) ?? NSNull(),
            "scenarios": scenarios,
            "methodology": [
                "sampling": "temperature 0 (greedy)",
                "token_counts": "server usage via stream_options.include_usage",
                "ttft": "request start → first non-empty content delta",
                "decode_tps": "(completion_tokens - 1) / (last delta - first delta)",
                "prefill_tps": "prompt_tokens / uncached TTFT (includes template + tokenize)",
            ],
        ]

        let data: Data
        do {
            data = try JSONSerialization.data(
                withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        } catch {
            fputs("Failed to encode report: \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
        if let path = options.jsonPath {
            let url = URL(fileURLWithPath: path)
            try? FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            do {
                try data.write(to: url)
                fputs("Wrote \(path)\n", stderr)
            } catch {
                fputs("Failed to write \(path): \(error.localizedDescription)\n", stderr)
                exit(EXIT_FAILURE)
            }
        } else {
            print(String(bytes: data, encoding: .utf8) ?? "{}")
        }
        exit(EXIT_SUCCESS)
    }

    // MARK: - Prefill tuning (`--tune-prefill`)

    /// Measures the model's uncached TTFT at each candidate prefill step size
    /// and persists the winner to `~/.osaurus/config/prefill-tuning.json`,
    /// which the server re-reads per request (mtime-checked) — no restart
    /// needed, which is also what makes this sweep possible over HTTP.
    ///
    /// The optimal step is model-architecture-dependent: measured on one
    /// M5 Max, a small dense model was fastest at 512 while a 35B MoE was
    /// 22–24% faster at 2048. Hence a measured per-model value instead of a
    /// global setting.
    static func tunePrefill(
        options: Options, model: String, base: URL, health: [String: Any]
    ) async -> Never {
        // Chunking matters most on long prompts; tune at the largest
        // requested size.
        let target = options.promptTokens.max() ?? 8_192
        let file = tuningFileURL()
        let previous = readTuningRecords(at: file)[model]
        let backup = URL(fileURLWithPath: file.path + ".tune-backup")

        // The sweep mutates the LIVE tuning file before each measurement, so
        // an interruption would otherwise leave a probe candidate installed
        // permanently. Before the first mutation: (1) write a sidecar backup
        // of the pre-sweep file so even SIGKILL is hand-recoverable, and
        // (2) install SIGINT/SIGTERM handlers that restore the pre-sweep
        // record (or remove the key when none existed) and exit non-zero.
        do {
            try FileManager.default.createDirectory(
                at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            let originalData = (try? Data(contentsOf: file)) ?? Data("{}".utf8)
            try originalData.write(to: backup, options: .atomic)
        } catch {
            fputs("Cannot write backup \(backup.path): \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
        tuneSweepRestore = (file: file, model: model, previous: previous, backup: backup)
        signal(SIGINT) { _ in
            BenchCommand.tuneSweepAbortRestore()
            _Exit(EXIT_FAILURE)
        }
        signal(SIGTERM) { _ in
            BenchCommand.tuneSweepAbortRestore()
            _Exit(EXIT_FAILURE)
        }

        fputs("Tuning prefill step for \(model) at ~\(target) prompt tokens (candidates \(options.tuneCandidates), \(options.runs) run(s) each; backup: \(backup.path))…\n", stderr)

        // Warm the model (and its engine) so the first candidate doesn't
        // absorb the cold model load.
        _ = try? await measureOnce(
            base: base, model: model,
            prompt: makePrompt(targetTokens: 256, nonce: "tune-warm-\(UUID().uuidString)"),
            maxTokens: 8)

        var results: [(step: Int, medianTTFTMs: Double)] = []
        for step in options.tuneCandidates {
            do {
                try writeTuningRecord(
                    at: file, model: model,
                    record: ["prefillStepSize": step, "note": "candidate under test"])
            } catch {
                // Leave no half-tuned candidate behind on this exit either.
                tuneSweepAbortRestore()
                fputs("Cannot write \(file.path): \(error.localizedDescription)\n", stderr)
                exit(EXIT_FAILURE)
            }
            var ttfts: [Double] = []
            for run in 0..<options.runs {
                do {
            
```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Bundle/BundleCommand.swift`
```
//
//  BundleCommand.swift
//  osaurus
//
//  Main command router for MCPB (MCP Bundle) subcommands.
//

import Foundation

public struct BundleCommand: Command {
    public static let name = "bundle"

    public static func execute(args: [String]) async {
        guard let sub = args.first else {
            fputs(
                "Missing bundle subcommand. Use one of: load\n",
                stderr
            )
            exit(EXIT_FAILURE)
        }
        let rest = Array(args.dropFirst())
        switch sub {
        case "load":
            await BundleLoad.execute(args: rest)
        default:
            fputs("Unknown bundle subcommand: \(sub)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Bundle/BundleLoad.swift`
```
//
//  BundleLoad.swift
//  osaurus
//
//  Load and start an MCP Bundle (.mcpb file).
//

import Foundation
import MCP

enum BundleLoadError: Error, CustomStringConvertible {
    case missingPath
    case fileNotFound(String)
    case invalidExtension
    case extractionFailed(String)
    case missingManifest
    case invalidManifest(String)
    case serverLaunchFailed(String)
    case toolDiscoveryFailed(String)

    var description: String {
        switch self {
        case .missingPath:
            return "Error: Bundle path required\n  Usage: osaurus bundle load <path.mcpb>"
        case let .fileNotFound(path):
            return "Error: File not found: \(path)"
        case .invalidExtension:
            return "Error: File must have .mcpb extension"
        case let .extractionFailed(reason):
            return "Error: Failed to extract bundle: \(reason)"
        case .missingManifest:
            return "Error: manifest.json not found in bundle"
        case let .invalidManifest(reason):
            return "Error: Invalid manifest format: \(reason)"
        case let .serverLaunchFailed(reason):
            return "Error: Failed to start MCP server: \(reason)"
        case let .toolDiscoveryFailed(reason):
            return "Error: Failed to discover tools: \(reason)"
        }
    }
}

struct BundleLoad {
    static func execute(args: [String]) async {
        do {
            try await run(args: args)
        } catch {
            fputs("\(error)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }

    private static func run(args: [String]) async throws {
        // Parse arguments
        var bundlePath: String?
        var displayName: String?
        var i = 0
        while i < args.count {
            let arg = args[i]
            if arg == "--name" {
                if i + 1 < args.count {
                    displayName = args[i + 1]
                    i += 2
                } else {
                    throw BundleLoadError.missingPath
                }
            } else if !arg.hasPrefix("--") {
                bundlePath = arg
                i += 1
            } else {
                i += 1
            }
        }

        guard let path = bundlePath else {
            throw BundleLoadError.missingPath
        }

        // Validate file
        guard FileManager.default.fileExists(atPath: path) else {
            throw BundleLoadError.fileNotFound(path)
        }

        guard path.lowercased().hasSuffix(".mcpb") else {
            throw BundleLoadError.invalidExtension
        }

        // Extract bundle
        let bundleInfo = try MCPBundleManager.extract(path)
        defer { bundleInfo.cleanup() }

        // Parse manifest
        let manifest = try bundleInfo.parseManifest()

        // Display bundle info
        print("Bundle: \(displayName ?? manifest.displayName ?? manifest.name)")
        print("Version: \(manifest.version)")
        if let description = manifest.description {
            print("Description: \(description)")
        }
        print("")

        // Launch server
        let serverInfo = try await bundleInfo.launchServer(workingDirectory: bundleInfo.extractedPath)
        defer {
            serverInfo.shutdown()
        }

        // Discover tools via MCP SDK
        do {
            let tools = try await serverInfo.discoverTools()

            if tools.isEmpty {
                print("No tools discovered.")
            } else {
                print("Discovered \(tools.count) tool(s):")
                for tool in tools {
                    print("  - \(tool.name): \(tool.description ?? "")")
                }
            }
        } catch {
            print("Warning: Could not discover tools: \(error)")
        }

        print("")
        print("Server running. Press Ctrl+C to stop.")
        print("")

        // Keep alive until interrupt
        signal(SIGINT) { _ in
            exit(EXIT_SUCCESS)
        }

        while true {
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Bundle/MCPBundleManager.swift`
```
//
//  MCPBundleManager.swift
//  osaurus
//
//  Manages extraction and lifecycle of MCPB (MCP Bundle) files.
//

import Foundation
import MCP

class MCPBundleManager {
    struct BundleInfo {
        let extractedPath: String
        let manifestPath: String
        let bundleUUID: String

        func parseManifest() throws -> MCPBundleManifest {
            let data = try Data(contentsOf: URL(fileURLWithPath: manifestPath))
            let decoder = JSONDecoder()
            do {
                return try decoder.decode(MCPBundleManifest.self, from: data)
            } catch {
                throw BundleLoadError.invalidManifest(error.localizedDescription)
            }
        }

        func cleanup() {
            try? FileManager.default.removeItem(atPath: extractedPath)
        }

        func launchServer(workingDirectory: String) async throws -> ServerInfo {
            let manifest = try parseManifest()

            // Launch MCP server process with stdio transport
            let process = Process()
            process.currentDirectoryPath = workingDirectory

            // Get entry point from manifest (supports both formats)
            let (cmdName, args, _) = manifest.getEntryPoint()

            // Resolve executable path
            let cmdPath: String
            if cmdName.hasPrefix("/") {
                cmdPath = cmdName
            } else {
                // Try to find in PATH
                if let resolved = Shell.which(cmdName) {
                    cmdPath = resolved
                } else {
                    cmdPath = cmdName
                }
            }

            process.executableURL = URL(fileURLWithPath: cmdPath)
            process.arguments = args

            // Set up environment
            var env = ProcessInfo.processInfo.environment
            for (key, value) in manifest.resolveEnvironment() {
                env[key] = value
            }
            process.environment = env

            // Create pipes for stdio
            let inputPipe = Pipe()
            let outputPipe = Pipe()
            process.standardInput = inputPipe
            process.standardOutput = outputPipe
            process.standardError = FileHandle.standardError

            do {
                try process.run()
            } catch {
                throw BundleLoadError.serverLaunchFailed(error.localizedDescription)
            }

            // Create server info
            let serverInfo = ServerInfo(
                process: process,
                manifest: manifest
            )

            return serverInfo
        }
    }

    struct ServerInfo {
        let process: Process
        let manifest: MCPBundleManifest

        func discoverTools() async throws -> [ToolInfo] {
            // In MVP, we don't implement tool discovery
            // Just communicate manifest information
            return []
        }

        func shutdown() {
            process.terminate()
        }
    }

    struct ToolInfo {
        let name: String
        let description: String?
    }

    // MARK: - Extraction

    static func extract(_ bundlePath: String) throws -> BundleInfo {
        let uuid = UUID().uuidString
        let extractPath = "/tmp/osaurus-bundles/\(uuid)"

        try FileManager.default.createDirectory(atPath: extractPath, withIntermediateDirectories: true)

        // Use unzip CLI
        try unzipWithCLI(bundlePath, to: extractPath)

        let manifestPath = "\(extractPath)/manifest.json"
        guard FileManager.default.fileExists(atPath: manifestPath) else {
            try? FileManager.default.removeItem(atPath: extractPath)
            throw BundleLoadError.missingManifest
        }

        return BundleInfo(extractedPath: extractPath, manifestPath: manifestPath, bundleUUID: uuid)
    }

    private static func unzipWithCLI(_ zipPath: String, to destination: String) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-q", zipPath, "-d", destination]

        do {
            try process.run()
            process.waitUntilExit()

            guard process.terminationStatus == 0 else {
                throw BundleLoadError.extractionFailed("unzip exited with status \(process.terminationStatus)")
            }
        } catch {
            throw BundleLoadError.extractionFailed(error.localizedDescription)
        }
    }
}

// MARK: - Shell Helper

enum Shell {
    static func which(_ command: String) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = [command]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()

        try? process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Bundle/MCPBundleManifest.swift`
```
//
//  MCPBundleManifest.swift
//  osaurus
//
//  Model for MCPB (MCP Bundle) manifest.json files.
//  Supports both standard MCPB format and desktop-client integration format.
//

import Foundation

struct MCPBundleManifest: Codable {
    // Standard MCPB format
    let mcpVersion: String?

    // Desktop-client integration format
    let manifestVersion: String?

    let name: String
    let version: String
    let displayName: String?
    let description: String?
    let entry: EntryPoint?

    // Desktop-client integration format
    let server: ServerConfig?
    let icon: String?

    enum CodingKeys: String, CodingKey {
        case mcpVersion
        case manifestVersion = "manifest_version"
        case name
        case version
        case displayName
        case description
        case entry
        case server
        case icon
    }

    struct EntryPoint: Codable {
        let command: String
        let args: [String]
        let env: [String: String]?

        enum CodingKeys: String, CodingKey {
            case command
            case args
            case env
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            command = try container.decode(String.self, forKey: .command)
            args = try container.decodeIfPresent([String].self, forKey: .args) ?? []
            env = try container.decodeIfPresent([String: String].self, forKey: .env)
        }
    }

    struct ServerConfig: Codable {
        let type: String?
        let entryPoint: String?
        let mcpConfig: MCPConfig?

        enum CodingKeys: String, CodingKey {
            case type
            case entryPoint = "entry_point"
            case mcpConfig = "mcp_config"
        }

        struct MCPConfig: Codable {
            let command: String
            let args: [String]
            let env: [String: String]?

            enum CodingKeys: String, CodingKey {
                case command
                case args
                case env
            }

            // Default a missing `args` to `[]`, matching `EntryPoint` above so the
            // two interchangeable formats behave the same. Without this a valid
            // desktop manifest whose command takes no arguments fails to decode.
            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                command = try container.decode(String.self, forKey: .command)
                args = try container.decodeIfPresent([String].self, forKey: .args) ?? []
                env = try container.decodeIfPresent([String: String].self, forKey: .env)
            }
        }
    }

    /// Get the entry point, supporting both formats
    func getEntryPoint() -> (command: String, args: [String], env: [String: String]?) {
        // Try standard MCPB format first
        if let entry = entry {
            return (entry.command, entry.args, entry.env)
        }

        // Try desktop-client integration format
        if let server = server, let config = server.mcpConfig {
            return (config.command, config.args, config.env)
        }

        // Default fallback
        return ("", [], nil)
    }

    /// Resolve environment variables, substituting ${env:VAR_NAME} with actual values
    func resolveEnvironment() -> [String: String] {
        let (_, _, env) = getEntryPoint()
        var resolved: [String: String] = [:]
        for (key, value) in (env ?? [:]) {
            if value.hasPrefix("${env:"), value.hasSuffix("}") {
                let envVar = String(value.dropFirst(6).dropLast(1))
                resolved[key] = ProcessInfo.processInfo.environment[envVar] ?? ""
            } else {
                resolved[key] = value
            }
        }
        return resolved
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Command.swift`
```
//
//  Command.swift
//  osaurus
//
//  Protocol defining the interface for CLI commands. All commands must implement this protocol.
//

import Foundation

public protocol Command {
    static var name: String { get }
    static func execute(args: [String]) async
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Config.swift`
```
//
//  Config.swift
//  osaurus
//
//  `osaurus config` — CLI companion for the declarative configuration
//  surface (`osaurus_config` / the loopback-only `/admin/config/*`
//  endpoints). Export the current Osaurus state as YAML, dry-run a
//  document against it, or apply one.
//
//  Security notes:
//   - The endpoints are loopback-only on the server side; this command
//     always targets 127.0.0.1.
//   - High-risk applies (prune deletions, screen/browser grants, channel
//     write enables, new MCP endpoints, ...) are rejected by the server
//     with the risk list until re-sent with confirmation — the CLI
//     surfaces that as an explicit `--yes` flag, mirroring the in-app
//     approval card.
//   - Secrets never travel through documents; provider creation opens
//     the credential sheet in the app.
//

import Foundation

public struct ConfigCommand: Command {
    public static let name = "config"

    public static func execute(args: [String]) async {
        guard let sub = args.first else {
            printUsage()
            exit(EXIT_FAILURE)
        }
        let rest = Array(args.dropFirst())
        switch sub {
        case "export":
            await runExport(rest)
        case "schema":
            await runSchema(rest)
        case "plan":
            await runPlanOrApply(rest, apply: false)
        case "apply":
            await runPlanOrApply(rest, apply: true)
        case "help", "-h", "--help":
            printUsage()
            exit(EXIT_SUCCESS)
        default:
            fputs("Unknown config subcommand: \(sub)\n\n", stderr)
            printUsage()
            exit(EXIT_FAILURE)
        }
    }

    // MARK: - export

    private static func runExport(_ args: [String]) async {
        var outputPath: String?
        var format = "yaml"
        var index = 0
        while index < args.count {
            switch args[index] {
            case "-o", "--output":
                index += 1
                guard index < args.count else {
                    fputs("--output requires a file path\n", stderr)
                    exit(EXIT_FAILURE)
                }
                outputPath = args[index]
            case "--format":
                index += 1
                guard index < args.count, ["yaml", "json"].contains(args[index].lowercased())
                else {
                    fputs("--format requires yaml or json\n", stderr)
                    exit(EXIT_FAILURE)
                }
                format = args[index].lowercased()
            default:
                fputs("Unknown option: \(args[index])\n", stderr)
                exit(EXIT_FAILURE)
            }
            index += 1
        }

        let port = await ServerControl.ensureServerReadyOrExit()
        let response = await request(
            port: port, path: "/admin/config/export?format=\(format)", body: nil)
        guard let document = response[format] as? String else {
            failFromResponse(response)
        }
        if let outputPath {
            do {
                try Data(document.utf8).write(
                    to: URL(fileURLWithPath: outputPath), options: .atomic)
                print("Exported configuration to \(outputPath)")
            } catch {
                fputs("Could not write \(outputPath): \(error.localizedDescription)\n", stderr)
                exit(EXIT_FAILURE)
            }
        } else {
            print(document)
        }
        exit(EXIT_SUCCESS)
    }

    // MARK: - schema

    private static func runSchema(_ args: [String]) async {
        var format = "yaml"
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--format":
                index += 1
                guard index < args.count, ["yaml", "json"].contains(args[index].lowercased())
                else {
                    fputs("--format requires yaml or json\n", stderr)
                    exit(EXIT_FAILURE)
                }
                format = args[index].lowercased()
            default:
                fputs("Unknown option: \(args[index])\n", stderr)
                exit(EXIT_FAILURE)
            }
            index += 1
        }

        let port = await ServerControl.ensureServerReadyOrExit()
        let response = await request(
            port: port, path: "/admin/config/schema?format=\(format)", body: nil)
        if format == "json" {
            guard let schema = response["json_schema"] as? [String: Any],
                let data = try? JSONSerialization.data(
                    withJSONObject: schema, options: [.prettyPrinted, .sortedKeys])
            else {
                failFromResponse(response)
            }
            print(String(decoding: data, as: UTF8.self))
        } else {
            guard let schema = response["schema"] as? String else {
                failFromResponse(response)
            }
            print(schema)
        }
        exit(EXIT_SUCCESS)
    }

    // MARK: - plan / apply

    private static func runPlanOrApply(_ args: [String], apply: Bool) async {
        var filePath: String?
        var prune = false
        var confirm = false
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--prune":
                prune = true
            case "--yes", "-y":
                confirm = true
            default:
                if args[index].hasPrefix("-") {
                    fputs("Unknown option: \(args[index])\n", stderr)
                    exit(EXIT_FAILURE)
                }
                guard filePath == nil else {
                    fputs("Only one document file may be given\n", stderr)
                    exit(EXIT_FAILURE)
                }
                filePath = args[index]
            }
            index += 1
        }
        guard let filePath else {
            fputs("Usage: osaurus config \(apply ? "apply" : "plan") <file.yaml> [--prune]\n", stderr)
            exit(EXIT_FAILURE)
        }
        // Server-side documents are capped at 512 KB (`OsaurusConfigTool
        // .maxDocumentBytes`); enforce the same limit here BEFORE loading the
        // file so a mistaken path (e.g. a model file) can't balloon the CLI.
        let maxDocumentBytes = 512 * 1024
        let fileURL = URL(fileURLWithPath: filePath)
        if let size = (try? FileManager.default.attributesOfItem(atPath: fileURL.path))?[.size]
            as? Int, size > maxDocumentBytes
        {
            fputs(
                "\(filePath) is \(size / 1024) KB — configuration documents are capped at "
                    + "\(maxDocumentBytes / 1024) KB.\n", stderr)
            exit(EXIT_FAILURE)
        }
        let yaml: String
        do {
            yaml = try String(contentsOf: fileURL, encoding: .utf8)
        } catch {
            fputs("Could not read \(filePath): \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }

        let port = await ServerControl.ensureServerReadyOrExit()
        var body: [String: Any] = ["yaml": yaml, "prune": prune]
        if apply && confirm { body["confirm_high_risk"] = true }
        let path = apply ? "/admin/config/apply" : "/admin/config/plan"
        let response = await request(port: port, path: path, body: body)

        if let error = response["error"] as? [String: Any] {
            if let message = error["message"] as? String { fputs("\(message)\n", stderr) }
            if let issues = error["issues"] as? [String] {
                for issue in issues { fputs("  • \(issue)\n", stderr) }
            }
            exit(EXIT_FAILURE)
        }

        if !apply {
            if let summary = response["summary"] as? String { print(summary) }
            if response["high_risk"] as? Bool == true {
                print("\n! This plan contains high-risk changes — apply will require --yes.")
            }
            exit(EXIT_SUCCESS)
        }

        if response["status"] as? String == "high_risk_confirmation_required" {
            fputs("This document contains high-risk changes:\n", stderr)
            for risk in (response["risks"] as? [String]) ?? [] {
                fputs("  ! \(risk)\n", stderr)
            }
            if let summary = response["summary"] as? String {
                fputs("\nPlan:\n\(summary)\n", stderr)
            }
            fputs("\nRe-run with --yes to apply.\n", stderr)
            exit(EXIT_FAILURE)
        }

        if response["status"] as? String == "no_changes" {
            print(response["summary"] as? String ?? "No changes.")
            exit(EXIT_SUCCESS)
        }

        // Exit codes are script contracts: 0 = fully converged, 1 = at least
        // one change failed or was cancelled, 3 = applied but at least one
        // change needs a step finished in the app (secrets never travel
        // through this surface, so that state is expected — but a script
        // must be able to tell it apart from full convergence).
        var failures = 0
        var pendingUserActions = 0
        for row in (response["results"] as? [[String: Any]]) ?? [] {
            let section = row["section"] as? String ?? "?"
            let target = row["target"] as? String ?? "?"
            let status = row["status"] as? String ?? "?"
            var line = "\(statusSymbol(status)) \(section)/\(target): \(status)"
            if let message = row["message"] as? String { line += " — \(message)" }
            print(line)
            if status == "failed" || status == "cancelled" { failures += 1 }
            if status == "needs_user_action" { pendingUserActions += 1 }
        }
        if let note = response["note"] as? String { print("note: \(note)") }
        if failures > 0 { exit(EXIT_FAILURE) }
        if pendingUserActions > 0 { exit(3) }
        exit(EXIT_SUCCESS)
    }

    private static func statusSymbol(_ status: String) -> String {
        switch status {
        case "done": return "✓"
        case "started":
```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Coord/CoordCommand.swift`
```
import Foundation

public struct CoordCommand: Command {
    public static let name = "coord"

    public static func execute(args: [String]) async {
        do {
            try run(args: args)
        } catch {
            fputs("coord: \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }

    static func run(args: [String]) throws {
        let parsed = try parseRoot(args)
        guard let subcommand = parsed.args.first else {
            printUsage()
            return
        }
        let rest = Array(parsed.args.dropFirst())
        switch subcommand {
        case "help", "-h", "--help":
            printUsage()
        case "init":
            try runInit(paths: parsed.paths)
        case "status":
            try runStatus(paths: parsed.paths, args: rest)
        case "feature-flags":
            try runFeatureFlags(paths: parsed.paths, args: rest)
        case "lock":
            try runLock(paths: parsed.paths, args: rest)
        case "preflight", "gate-main", "heartbeat", "lane", "nudge", "promote", "agent-abort", "conflict-proof",
            "reviewer-summary", "tick-report", "pause", "resume", "stop", "clear-stop":
            fputs("coord \(subcommand) is not available in the coordinator foundation slice.\n\n", stderr)
            printUsage()
            exit(EXIT_FAILURE)
        default:
            fputs("Unknown coord subcommand: \(subcommand)\n\n", stderr)
            printUsage()
            exit(EXIT_FAILURE)
        }
    }

    static func parseRoot(_ args: [String]) throws -> (paths: CoordinatorPaths, args: [String]) {
        var remaining: [String] = []
        var cliRoot: String?
        var index = 0
        while index < args.count {
            if args[index] == "--root" {
                let valueIndex = index + 1
                guard valueIndex < args.count else { throw CoordCommandError.missingRootValue }
                cliRoot = args[valueIndex]
                index += 2
            } else {
                remaining.append(args[index])
                index += 1
            }
        }
        return (try CoordinatorPaths.resolve(cliRoot: cliRoot), remaining)
    }

    private static func runInit(paths: CoordinatorPaths) throws {
        let result = try CoordinatorBootstrap(paths: paths).initialize()
        print("Initialized coordinator root: \(result.root.path)")
        if !result.createdDirectories.isEmpty {
            print("Created directories: \(result.createdDirectories.count)")
        }
        if !result.seededFiles.isEmpty {
            print("Seeded files: \(result.seededFiles.count)")
        }
    }

    private static func runStatus(paths: CoordinatorPaths, args: [String]) throws {
        let snapshot = try CoordinatorStatusService(paths: paths).snapshot()
        if args.contains("--json") {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            print(String(data: try encoder.encode(snapshot), encoding: .utf8) ?? "{}")
            return
        }
        print("Coordinator root: \(snapshot.root)")
        print("Initialized: \(snapshot.initialized ? "yes" : "no")")
        print("Active locks: \(snapshot.activeLocks.count)")
        print("Expired locks: \(snapshot.expiredLocks.count)")
        print("Paused: \(snapshot.paused ? "yes" : "no")")
        print("Stopped: \(snapshot.stopped ? "yes" : "no")")
    }

    private static func runFeatureFlags(paths: CoordinatorPaths, args: [String]) throws {
        let store = CoordinatorFeatureFlagsStore(paths: paths)
        let action = args.first ?? "list"
        switch action {
        case "list":
            let flags = try store.load().flags.sorted { $0.key < $1.key }
            for (name, enabled) in flags {
                print("\(name)=\(enabled)")
            }
        case "get":
            guard args.count == 2 else { throw CoordCommandError.invalidFeatureFlagsUsage }
            let flags = try store.load().flags
            print("\(args[1])=\(flags[args[1]] ?? false)")
        case "set":
            guard args.count == 3, let enabled = Bool(coordFlagValue: args[2]) else {
                throw CoordCommandError.invalidFeatureFlagsUsage
            }
            _ = try store.set(args[1], enabled: enabled)
            print("\(args[1])=\(enabled)")
        default:
            throw CoordCommandError.invalidFeatureFlagsUsage
        }
    }

    private static func runLock(paths: CoordinatorPaths, args: [String]) throws {
        guard let action = args.first else { throw CoordCommandError.invalidLockUsage }
        let service = CoordinatorLockService(paths: paths)
        let rest = Array(args.dropFirst())
        switch action {
        case "list":
            for lock in try service.list() {
                print("\(lock.resource) owner=\(lock.owner)")
            }
        case "acquire":
            guard let resource = rest.first else { throw CoordCommandError.invalidLockUsage }
            let options = parseLockOptions(Array(rest.dropFirst()))
            guard let owner = options.owner else { throw CoordCommandError.invalidLockUsage }
            switch try service.acquire(resource: resource, owner: owner, ttl: options.ttl) {
            case .acquired:
                print("acquired \(resource)")
            case .held(let current):
                print("held \(resource) owner=\(current.owner)")
                exit(EXIT_FAILURE)
            }
        case "release":
            guard let resource = rest.first else { throw CoordCommandError.invalidLockUsage }
            let options = parseLockOptions(Array(rest.dropFirst()))
            guard let owner = options.owner else { throw CoordCommandError.invalidLockUsage }
            switch try service.release(resource: resource, owner: owner, force: options.force) {
            case .released:
                print("released \(resource)")
            case .notFound:
                print("not-found \(resource)")
                exit(EXIT_FAILURE)
            case .ownerMismatch(let current):
                print("owner-mismatch \(resource) owner=\(current.owner)")
                exit(EXIT_FAILURE)
            }
        case "reap":
            let reaped = try service.reapExpired()
            print("reaped \(reaped.count)")
        default:
            throw CoordCommandError.invalidLockUsage
        }
    }

    private static func parseLockOptions(_ args: [String]) -> (owner: String?, ttl: TimeInterval?, force: Bool) {
        var owner: String?
        var ttl: TimeInterval?
        var force = false
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--owner":
                if index + 1 < args.count {
                    owner = args[index + 1]
                    index += 2
                } else {
                    index += 1
                }
            case "--ttl":
                if index + 1 < args.count {
                    ttl = TimeInterval(args[index + 1])
                    index += 2
                } else {
                    index += 1
                }
            case "--force":
                force = true
                index += 1
            default:
                index += 1
            }
        }
        return (owner, ttl, force)
    }

    private static func printUsage() {
        let usage = """
            osaurus coord <subcommand> [--root PATH]

            Foundation subcommands:
              init                         Create coordinator directories and seed state
              status [--json]              Show coordinator root, initialization, locks, and flags
              feature-flags list|get|set   Read or update JSON-backed feature flags
              lock list|acquire|release|reap
                                           Manage file-scoped coordinator locks

            Later orchestration subcommands are registered but unsupported in this slice.

            """
        print(usage)
    }
}

enum CoordCommandError: LocalizedError, Equatable {
    case missingRootValue
    case invalidFeatureFlagsUsage
    case invalidLockUsage

    var errorDescription: String? {
        switch self {
        case .missingRootValue:
            return "--root requires a path."
        case .invalidFeatureFlagsUsage:
            return "Usage: osaurus coord feature-flags [list|get <name>|set <name> <true|false>]"
        case .invalidLockUsage:
            return
                "Usage: osaurus coord lock [list|acquire <resource> --owner <owner> [--ttl seconds]|release <resource> --owner <owner> [--force]|reap]"
        }
    }
}

private extension Bool {
    init?(coordFlagValue value: String) {
        switch value.lowercased() {
        case "1", "true", "yes", "on", "enabled":
            self = true
        case "0", "false", "no", "off", "disabled":
            self = false
        default:
            return nil
        }
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/Doctor.swift`
```
//
//  Doctor.swift
//  OsaurusCLI
//
//  Read-only installation and server-start diagnostics.
//

import Foundation

public struct DoctorCommand: Command {
    public static let name = "doctor"

    struct Options: Equatable {
        let port: Int?
        let json: Bool
        let redact: Bool
        let verifySignatures: Bool
    }

    enum ArgumentError: Error, Equatable {
        case invalid(String)
    }

    public static func execute(args: [String]) async {
        let options: Options
        do {
            options = try parseOptions(args)
        } catch let error as ArgumentError {
            let detail: String
            switch error {
            case .invalid(let message):
                detail = message
            }
            fputs("osaurus doctor: \(detail)\n", stderr)
            fputs(
                "Usage: osaurus doctor [--port 1...65535] [--json] [--redact] [--verify-signatures]\n",
                stderr
            )
            exit(EXIT_FAILURE)
        } catch {
            fputs("osaurus doctor: invalid arguments\n", stderr)
            exit(EXIT_FAILURE)
        }

        let report = await InstallationDiagnostics.collect(
            requestedPort: options.port,
            includeSignatureChecks: options.verifySignatures
        )
        let output = options.redact ? report.redacted() : report
        if options.json {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            do {
                let data = try encoder.encode(output)
                guard let text = String(data: data, encoding: .utf8) else {
                    throw EncodingError.invalidValue(
                        data,
                        .init(codingPath: [], debugDescription: "JSON output was not UTF-8")
                    )
                }
                print(text)
            } catch {
                fputs("osaurus doctor: could not encode diagnostic JSON\n", stderr)
                exit(EXIT_FAILURE)
            }
        } else {
            print(render(output))
        }
        let usable = report.diagnosis == .healthy || report.diagnosis == .serverNotRunning
        exit(usable ? EXIT_SUCCESS : EXIT_FAILURE)
    }

    static func parseOptions(_ args: [String]) throws -> Options {
        var port: Int?
        var json = false
        var redact = false
        var verifySignatures = false
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--port" where index + 1 < args.count:
                guard let value = Int(args[index + 1]), (1 ... 65_535).contains(value) else {
                    throw ArgumentError.invalid("--port must be an integer from 1 through 65535")
                }
                port = value
                index += 2
            case "--port":
                throw ArgumentError.invalid("--port requires a value")
            case "--json":
                json = true
                index += 1
            case "--redact":
                redact = true
                index += 1
            case "--verify-signatures":
                verifySignatures = true
                index += 1
            default:
                throw ArgumentError.invalid("unknown argument `\(args[index])`")
            }
        }
        return Options(
            port: port,
            json: json,
            redact: redact,
            verifySignatures: verifySignatures
        )
    }

    public static func render(_ report: InstallationDiagnosticReport) -> String {
        var lines = [
            "Osaurus installation doctor",
            "Diagnosis: \(report.diagnosis.rawValue)",
            "CLI: \(report.cliPath) (\(versionLabel(report.cliVersion, build: report.cliBuild)))",
            "Server: http://127.0.0.1:\(report.requestedPort) — \(report.serverHealthy ? "healthy" : "unavailable")",
        ]
        if let owner = report.portOwner { lines.append("Port owner: \(owner)") }
        if report.apps.isEmpty {
            lines.append("Apps: none discovered")
        } else {
            lines.append("Apps:")
            for app in report.apps {
                let markers = [app.isCompanion ? "companion" : nil, app.isRunning ? "running" : nil]
                    .compactMap { $0 }.joined(separator: ", ")
                lines.append(
                    "- \(app.path) (\(versionLabel(app.version, build: app.build)))"
                        + (markers.isEmpty ? "" : " [\(markers)]")
                        + " signature=\(app.signature.rawValue) notarization=\(app.notarization.rawValue)"
                )
            }
        }
        lines.append(
            "Models: \(report.modelCountComplete ? "" : "at least ")\(report.modelCount) at \(report.modelRoot)"
                + " [\(report.modelRootSource)]"
                + (report.modelRootReadable ? "" : " (not readable)")
        )
        lines.append("Next step: \(report.recommendation)")
        return lines.joined(separator: "\n")
    }

    private static func versionLabel(_ version: String?, build: String?) -> String {
        let version = version ?? "development/unproven"
        guard let build, !build.isEmpty else { return version }
        return "\(version), build \(build)"
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/List.swift`
```
//
//  List.swift
//  osaurus
//
//  Command to list all available model IDs from the running server.
//

import Foundation

public struct ListCommand: Command {
    public static let name = "list"

    private struct ModelsListResponse: Decodable {
        struct Model: Decodable { let id: String }
        let data: [Model]
    }

    public static func execute(args: [String]) async {
        // Ensure server is up (best-effort)
        let port = await ServerControl.ensureServerReadyOrExit()

        guard let url = URL(string: "http://127.0.0.1:\(port)/models") else {
            fputs("Invalid URL for models\n", stderr)
            exit(EXIT_FAILURE)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 5.0

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                fputs(
                    "Failed to fetch models (status \((response as? HTTPURLResponse)?.statusCode ?? -1))\n",
                    stderr
                )
                exit(EXIT_FAILURE)
            }
            let decoder = JSONDecoder()
            let list = try decoder.decode(ModelsListResponse.self, from: data)
            if list.data.isEmpty {
                print("(no models found)")
                exit(EXIT_SUCCESS)
            }
            for m in list.data { print(m.id) }
            exit(EXIT_SUCCESS)
        } catch {
            fputs("Error fetching models: \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }
}

```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/MCPCommand.swift`
```
//
//  MCPCommand.swift
//  osaurus
//
//  Implements MCP (Model Context Protocol) stdio server that proxies tool calls to the local HTTP server.
//

import Foundation
import MCP

public struct MCPCommand: Command {
    public static let name = "mcp"

    public static func execute(args: [String]) async {
        if args.contains("--help") || args.contains("-h") {
            printUsage()
            exit(EXIT_SUCCESS)
        }

        fputs("[MCP] Starting MCP command...\n", stderr)
        let toolFilter = MCPToolFilter.parse(args: args)
        if let toolFilter {
            fputs("[MCP] Tool allow-list: \(toolFilter.summary)\n", stderr)
        }
        let credential = resolvedAccessKey(args: args)
        let networkExposed = Configuration.resolveExposeToNetwork()
        if let credential {
            fputs("[MCP] Using access key from \(credential.source)\n", stderr)
        } else if networkExposed {
            fputs(
                "[MCP] No access key configured; Server > Network exposure is enabled — provide --access-key or OSAURUS_MCP_ACCESS_KEY\n",
                stderr
            )
        } else {
            fputs("[MCP] No access key configured; relying on local loopback trust\n", stderr)
        }

        // Ensure app server is up; auto-launch only if not already running
        let port = await ServerControl.ensureServerReadyOrExit(pollSeconds: 5.0)
        fputs("[MCP] Server ready on port \(port)\n", stderr)
        let baseURL = "http://127.0.0.1:\(port)"

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "cli"
        fputs("[MCP] Creating server with version: \(version)\n", stderr)

        // Build MCP server
        let server = MCP.Server(
            name: "Osaurus MCP Proxy",
            version: version,
            capabilities: .init(tools: .init(listChanged: false))
        )

        // Register ListTools -> GET /mcp/tools
        await server.withMethodHandler(MCP.ListTools.self) { _ in
            fputs("[MCP] Handling ListTools\n", stderr)
            guard let url = URL(string: "\(baseURL)/mcp/tools") else {
                throw MCPError.internalError("Invalid tools URL")
            }
            fputs("[MCP] Fetching tools from \(url)\n", stderr)
            let request = makeProxyRequest(url: url, method: "GET", timeout: 5.0, credential: credential)
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw MCPError.internalError("Failed to list tools: non-HTTP response")
                }
                guard http.statusCode == 200 else {
                    let body = String(bytes: data, encoding: .utf8) ?? ""
                    throw MCPError.internalError(
                        "Failed to list tools: HTTP \(http.statusCode)\(body.isEmpty ? "" : ": \(body)")"
                    )
                }
                fputs("[MCP] Tools fetched successfully\n", stderr)
                let tools: [MCP.Tool]
                if let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                    let arr = obj["tools"] as? [[String: Any]]
                {
                    tools = arr.map { item in
                        let name = (item["name"] as? String) ?? ""
                        let description = (item["description"] as? String) ?? ""
                        let schemaAny = item["inputSchema"]
                        let schema = toMCPValue(from: schemaAny)
                        return MCP.Tool(name: name, description: description, inputSchema: schema)
                    }
                } else {
                    throw MCPError.internalError("Failed to list tools: unexpected response shape")
                }
                guard let toolFilter else { return .init(tools: tools) }
                let admitted = tools.filter { toolFilter.admits($0.name) }
                fputs("[MCP] Tools: \(admitted.count) of \(tools.count) after allow-list\n", stderr)
                return .init(tools: admitted)
            } catch let error as MCPError {
                throw error
            } catch {
                fputs("[MCP] Error fetching tools: \(error)\n", stderr)
                throw MCPError.internalError("Failed to list tools: \(error.localizedDescription)")
            }
        }

        // Register CallTool -> POST /mcp/call
        await server.withMethodHandler(MCP.CallTool.self) { params in
            fputs("[MCP] Handling CallTool: \(params.name)\n", stderr)
            // Enforce the allow-list here too. `ListTools` only controls what a
            // well-behaved client is *shown*; nothing stops it calling a name it
            // learned elsewhere, and the excluded set includes dispatch tools.
            if let toolFilter, !toolFilter.admits(params.name) {
                fputs("[MCP] Refused \(params.name): not in allow-list\n", stderr)
                throw MCPError.invalidParams("Tool '\(params.name)' is not available on this server")
            }
            struct CallBody: Encodable {
                let name: String
                let arguments: MCP.Value?
            }
            struct CallResponse: Decodable {
                struct Item: Decodable {
                    let type: String
                    let text: String?
                }
                let content: [Item]
                let isError: Bool
            }
            guard let url = URL(string: "\(baseURL)/mcp/call") else {
                return .init(content: [.text(text: "Invalid URL", annotations: nil, _meta: nil)], isError: true)
            }
            var request = makeProxyRequest(url: url, method: "POST", timeout: 30.0, credential: credential)
            request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")

            do {
                // Wrap dictionary arguments into a single MCP.Value object if present
                let argValue: MCP.Value? = params.arguments.map { .object($0) }
                let body = CallBody(name: params.name, arguments: argValue)
                request.httpBody = try JSONEncoder().encode(body)

                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    let message = String(bytes: data, encoding: .utf8) ?? ""
                    return .init(
                        content: [
                            .text(
                                text:
                                    "HTTP \(String(describing: (response as? HTTPURLResponse)?.statusCode)): \(message)",
                                annotations: nil,
                                _meta: nil
                            )
                        ],
                        isError: true
                    )
                }
                let decoded = try JSONDecoder().decode(CallResponse.self, from: data)
                // Aggregate text items into a single text content to match our server's MCP usage
                let text = decoded.content.compactMap { $0.type == "text" ? $0.text : nil }.joined()
                if text.isEmpty {
                    return .init(content: [], isError: decoded.isError)
                } else {
                    return .init(content: [.text(text: text, annotations: nil, _meta: nil)], isError: decoded.isError)
                }
            } catch {
                fputs("[MCP] Error calling tool: \(error)\n", stderr)
                return .init(
                    content: [.text(text: error.localizedDescription, annotations: nil, _meta: nil)],
                    isError: true
                )
            }
        }

        // Start stdio transport
        do {
            fputs("[MCP] Starting Stdio transport...\n", stderr)
            let transport = MCP.StdioTransport()
            try await server.start(transport: transport)
            fputs("[MCP] Server started. If 'start' is non-blocking, we are now in the loop.\n", stderr)

            // Keep the process alive
            while true {
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
        } catch {
            fputs("MCP server error: \(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }

    struct AccessKeyCredential: Equatable {
        let token: String
        let source: String
    }

    static func resolvedAccessKey(
        args: [String],
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> AccessKeyCredential? {
        for index in args.indices {
            let arg = args[index]
            if let value = accessKeyValue(fromInlineArgument: arg) {
                return AccessKeyCredential(token: value, source: accessKeySource(fromInlineArgument: arg))
            }
            guard accessKeyOptionNames.contains(arg), args.indices.contains(index + 1) else {
                continue
            }
            if let token = normalizedAccessKey(args[index + 1]) {
                return AccessKeyCredential(token: token, source: arg)
            }
        }

        for name in accessKeyEnvironmentNames {
            if let token = normalizedAccessKey(environment[name]) {
                return AccessKeyCredential(token: token, source: name)
            }
        }

        for name in authorizationEnvironmentNames {
            if let token = normalizedAuthorizationHeader(environment[name]) {
                return AccessKeyCredential(token: token, source: name)
            }
        }

        return nil
    }

    static func makeProxyRequest(
        url: URL,
        method: String,
        timeout: TimeInterval,
        credential: AccessKeyCredential?,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> UR
```

### Core Architecture Module: `Packages/OsaurusCLI/Sources/OsaurusCLICore/Commands/MCPToolFilter.swift`
```
//
//  MCPToolFilter.swift
//  OsaurusCLICore
//
//  Optional allow-list for `osaurus mcp`.
//
//  Osaurus proxies its whole tool surface — 170+ tools once plugins, folder
//  tools, and MCP providers are loaded. That is roughly 31k tokens of tool
//  definitions in *every* turn for a client that only wants the handful of
//  `osaurus_*` configuration tools, and it hands the client dispatch tools that
//  can start further agent runs.
//
//  Filtering belongs here rather than in each client: the client then never
//  sees the excluded tools at all, so there is nothing to mis-trust and no
//  per-client duplication of the rule.
//

import Foundation

/// Parsed `--tools` allow-list. `nil` (absent flag) means "proxy everything",
/// preserving the previous behavior for existing users.
public struct MCPToolFilter: Equatable, Sendable {
    /// Exact tool names to admit.
    private let exact: Set<String>
    /// Prefixes from `name*` patterns, stored without the trailing `*`.
    private let prefixes: [String]

    /// Build from the raw flag value: comma-separated names, each optionally
    /// ending in `*` to match by prefix (`osaurus_*`). Blank entries are
    /// dropped so a trailing comma is harmless.
    ///
    /// An explicitly empty value admits nothing. That fail-closed distinction
    /// matters: treating `--tools ""` like an absent flag would turn a typo
    /// into access to the entire tool surface.
    public init(patterns raw: String) {
        var exact: Set<String> = []
        var prefixes: [String] = []
        for piece in raw.split(separator: ",") {
            let token = piece.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !token.isEmpty else { continue }
            if token.hasSuffix("*") {
                let prefix = String(token.dropLast())
                // A bare `*` means everything; keep it as an empty prefix so
                // `hasPrefix("")` admits all names.
                prefixes.append(prefix)
            } else {
                exact.insert(token)
            }
        }
        self.exact = exact
        self.prefixes = prefixes
    }

    /// Whether `name` is admitted by this filter.
    public func admits(_ name: String) -> Bool {
        if exact.contains(name) { return true }
        return prefixes.contains { name.hasPrefix($0) }
    }

    /// Human-readable summary for the startup log, so a user who mistypes a
    /// pattern can see what was actually parsed.
    public var summary: String {
        let parts = exact.sorted() + prefixes.map { "\($0)*" }.sorted()
        return parts.isEmpty ? "(none)" : parts.joined(separator: ", ")
    }

    /// Extract the filter from an argument vector.
    ///
    /// Accepts both `--tools a,b` and `--tools=a,b`. Returns nil when the flag
    /// is absent or carries no usable patterns.
    public static func parse(args: [String]) -> MCPToolFilter? {
        for (index, arg) in args.enumerated() {
            if arg == "--tools", index + 1 < args.count {
                return MCPToolFilter(patterns: args[index + 1])
            }
            if arg == "--tools" {
                return MCPToolFilter(patterns: "")
            }
            if arg.hasPrefix("--tools=") {
                return MCPToolFilter(patterns: String(arg.dropFirst("--tools=".count)))
            }
        }
        return nil
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3011** (2026-10-06): **Pin PromptSection token estimation main thread hang fix**
  *Symptoms*: ## Summary  The root cause analysis for issue APPLE-MACOS-1XM (App Hanging: PromptSection.estimatedTokens.getter) identified that the `estimatedTokens` and `isEmpty` computed properties of `PromptSection` were being re-evaluated on the main thread during SwiftUI body re-renders. This involved repeatedly trimming and scanning potentially large strings, leading to app hangs.  This PR addresses the issue by: 1. Converting `PromptSection.estimatedTokens` and `PromptSection.isEmpty` from computed properties to stored `public let` properties. 2. Introducing an explicit initializer for `PromptSection` that performs the string trimming and token estimation once at initialization time, storing the results. 3. Modifying `ContextBudgetManager.from(manifest:)` to use `compactMap` to read each section's `estimatedTokens` only once, further reducing redundant work.  These changes ensure that the token count and emptiness status of an immutable `PromptSection` are computed only once, eliminating repeated main-thread string operations during frequent SwiftUI view updates and resolving the observed app hangs.  ## Changes  - [ ] Behavior change - [ ] UI change (screenshots below) - [x] Refactor / chore - [ ] Tests - [ ] Docs  ## Test Plan  No specific test plan provided in the description. The changes are internal performance optimizations.  ## Screenshots  No UI changes.  ## Checklist  - [ ] I have read `CONTRIBUTING.md` - [ ] I added/updated tests where reasonable - [ ] I updated docs/README

- **Issue #3008** (2026-10-05): **queue channel messages that arrive while a turn is running instead of dropping them**
  *Symptoms*: ## Summary  Resolves #2987  - Messages that arrived while a channel conversation already had a turn running were dropped as `conversation_already_running` after the store had logged them as accepted, so they never reached the agent and nothing told the sender - The drop only reached the in-app activity center, never the audit table or logs, which is why nothing showed up in `~/Library/Logs/Osaurus` - `AgentChannelInboundRelay` now keeps a FIFO queue per conversation instead of a busy set - A message that arrives mid-turn is queued, gets an audit row (`dispatch_started`, `awaiting_agent`, `queued: true`) and a log line - When the turn ends (completed, failed or timed out) the sender's consecutive queued messages are joined in order into one follow-up turn, so "Test 1, 2, 3, 4" gets a reply to Test 1 and then one reply covering 2 to 4 - The follow-up turn goes through the safety gate again and replies under the last message's event id - Group chats never merge messages from different senders, each sender's batch runs in turn - The queue is capped at 20 per conversation, past that the message is dropped with a logged `conversation_queue_full` reason and recovery guidance in the activity UI - A safety gate rejection still drains the rest of the queue instead of stalling it - Covers every provider that uses the shared relay (Telegram, Discord, Slack, WhatsApp, iMessage, webhooks) - Added `AgentChannelInboundQueueTests` for merge order, empty content and the new guida

- **Issue #3007** (2026-10-05): **start a fresh chat for every scheduled run**
  *Symptoms*: ## Summary  Resolves #2993  - Scheduled runs passed the schedule id as `externalSessionKey`, so every run reattached to the same chat and the context kept growing run after run - The guide already promises that each scheduled run starts a fresh chat, so the code now matches the docs - Added `reattachSession` to `DispatchRequest` (default `true`, so every other source behaves as before) - `lookupReattachableSession` skips reattach when `reattachSession` is `false` - `ScheduleManager` passes `reattachSession: false` but keeps the schedule id as the key, so the sidebar and history schedule filters still group the runs under their schedule - Watchers are unchanged since their guide says triggers accumulate into one chat - Added `optedOutRequestNeverReattaches` to `GroupedDispatchOwnershipTests` - The new flag is also the hook for a later per-schedule "continue last session" toggle  ## Changes  - [x] Behavior change - [ ] UI change (screenshots below) - [ ] Refactor / chore - [ ] Tests - [ ] Docs  ## Checklist  - [ ] I have read `CONTRIBUTING.md` - [ ] I added/updated tests where reasonable - [ ] I updated docs/README as needed - [ ] I verified build on macOS with Xcode 16.4+ 

- **Issue #3006** (2026-10-05): **Show adaptive native MTP controls before model loading**
  *Symptoms*: Selecting an installed MTP-capable model now exposes **Off (AR)** and **On (Adaptive)** before loading weights. The picker inspects the selected bundle directory directly instead of resolving its name again. Detection uses actual tensor metadata and keeps head availability separate from runtime safety/tuning eligibility; a config-only MTP claim does not create a control for a missing head.  Chat and settings remove manual depth buttons. Existing positive native selections migrate to adaptive without a saved depth cap; explicit Off remains Off. Settings load/save and configure-tool application use the same normalization. External DFlash selection and block width remain independent, and sampling is unchanged. Adaptive requests still use ordinary decoding when the bundle fails existing admission checks; this does not bypass safety or assert a speedup.  Validation: Debug test/full-app builds passed, 104 focused tests passed with zero skips, eight actual installed-bundle header checks passed, and built-app unloaded selection/toggling/save/relaunch checks passed. [Proof and limits](https://github.com/osaurus-ai/osaurus/pull/3006#issuecomment-5988553633). Coverage includes legacy migration, cold save/reload, explicit Off, external drafter precedence, runtime admission, metadata-only affine/JANGH detection, missing/malformed heads, and actual installed bundle inspection. No workflow or release changes. 
  **Post-Mortem & Fix Analysis**:
  > Validated current head `be192da60f48607211aa0f974f9607bec323df2a` (tree `66dea5124257eb1591202f0dafff3d245a12ac72`) with engine pin `2b05d39a6f43c1bc8789112fc92baa426d84c833`.  SOURCE EVIDENCE: `NativeMTPSelectionDefault.swift` normalizes native choices to Off/Auto and clears legacy depth caps; store/load/configure paths share it. `FloatingInputCard.swift` inspects the selected directory before loading, and exposes only Off (AR)/On (Adaptive). `MTPSection.swift` applies the selection in one binding update. No sampler, engine admission, kernel, workflow, or release-policy change.  LIVE EVIDENCE: - Current-source Debug test build and full app build passed; source/dependency hashes remained stable. **104 tests passed (101 Swift Testing + 3 XCTest), zero skips.** Includes persistence/cold-save migration, explicit Off, external drafter precedence/width, admission, reload scope, sampling preservation, settings search, and preload detection. - The actual engine inspector checked eight install
  > CI caught missing catalog entries for the two new labels before its core build. Follow-up `2adba26e` adds only those entries, including the supported German, Korean, Russian, Simplified Chinese, and Traditional Chinese translations. `bash scripts/i18n/check.sh` now passes locally, including all 4,616 referenced Swift keys and zero suspect literals. No workflow/gate was changed.  The previously tested application code and engine pin are unchanged; the only difference from the 104-test/full-app/live-GUI proof above is `Localizable.xcstrings`. Awaiting the new head's complete CI before merge. Engine consumer #3005 has merged separately after all nine checks passed. 
  > CI follow-up at `396d2a9b636cf32ee167703f43579fa3d1b23b20`:  The full CI run at 2adba26e found an admin endpoint inconsistency: PUT computed effects and echoed legacy manual-depth settings, while persistence migrated those settings to Adaptive. The endpoint now applies the same normalization before validation, effect decisions, and the response. Repeated legacy-depth requests therefore do not spuriously invalidate an already-Adaptive runtime; actual Off/Adaptive transitions still report the appropriate refresh.  Reproduction and validation: - Unchanged endpoint reproduced 15 assertion failures in expanded transition coverage. The original CI failure is retained. - Corrected test setup compares each transition with the actual disk-reloaded settings, including existing unrelated settings migrations. - 120 selected tests passed (117 Swift Testing + 3 XCTest), zero skips: the real NIO HTTP endpoint, persistence, controller effects, MTP admission/sampling, selected-model discovery, and Sett

- **Issue #3005** (2026-10-05): **Pin MTP head-history and lazy-verifier PLE state fixes**
  *Symptoms*: Pin vMLX to `2b05d39a6f43c1bc8789112fc92baa426d84c833`, incorporating two merged MTP cache fixes:  - Preserve confirmed head history during compatible adaptive depth reductions. The actual D3→D2 regression previously discarded 23 confirmed pairs; it now retains them. Hybrid block eligibility and AR-safety/fallback behavior retain their existing restrictions. - Advance Qwen Flash-Next PLE history and convolution state during explicit lazy verification. Fully accepted blocks previously left those committed states stale; rejection still restores and replays the accepted prefix. Other verifier modes are unchanged.  Updates all six manifest/resolution/contract references together.  Validation: - Both engine merge trees exactly match their tested PR heads. - [Head-history qualification](https://github.com/osaurus-ai/vmlx-swift/pull/557#issuecomment-5988059198): 20 clean-source native methods, zero skips, including the actual 23-pair D3→D2 regression. - [Lazy-PLE qualification](https://github.com/osaurus-ai/vmlx-swift/pull/558#issuecomment-5988232884): the unchanged public baseline reproduced three stale-cache and two next-logit failures; all eight lazy-verifier candidate rows passed, plus 20 adjacent methods with zero skips. - All six references agree; three resolution files parse correctly; `git diff --check` passes. - Successful Osaurus CI on the updated PR head is required before merge.  These are scoped correctness fixes. No throughput or general model-family correctness claim 
  **Post-Mortem & Fix Analysis**:
  > Pin proof for `f155f20b674a70cf0c9d0199be1270c0e7aa5b66`:  SOURCE EVIDENCE: All six manifest/resolution/contract references point to merged engine `7208b6e3f1a1b5d22904298e2447910cc8194be1`. Its tree `a5eda90ccb7e4e9bca6b29052d882c3245201828` exactly matches tested engine head `17f9d22b553c747324cb1a4a362f099ba98322bf`. Three JSON resolution files parse correctly; `git diff --check` passes. The diff is six one-line revision replacements.  LIVE EVIDENCE: [Engine qualification](https://github.com/osaurus-ai/vmlx-swift/pull/557#issuecomment-5988059198) records 20 clean-source native test methods with zero skips, including the actual D3→D2 iterator regression retaining all 23 confirmed head pairs. This is engine evidence; the Osaurus pin itself is awaiting [CI](https://github.com/osaurus-ai/osaurus/actions/runs/37263449373).  No model throughput or broad model-family correctness claim is attached to this pin. Merge remains gated on successful Osaurus CI. 
  > Updated pin proof for `3c7193e90114e6dcb7942bba56692e65d29d82fd` (supersedes the earlier pin-only head):  SOURCE EVIDENCE: All six references now select merged engine `2b05d39a6f43c1bc8789112fc92baa426d84c833`, including both #557 and #558. Merge tree `d1b9a86bf983af227fca85a410fc3192bad31011` exactly matches tested head `590d8b2d9c258ab7da5e9442dd0a2b67dda3c3ba`. Three JSON resolution files parse correctly; `git diff --check` passes. The combined PR diff remains six revision replacements.  LIVE EVIDENCE: [#557 regression evidence](https://github.com/osaurus-ai/vmlx-swift/pull/557#issuecomment-5988059198) confirms 23 confirmed head pairs survive D3→D2, with 20 methods and zero skips. [#558 baseline/candidate evidence](https://github.com/osaurus-ai/vmlx-swift/pull/558#issuecomment-5988232884) records exactly three baseline lazy full-accept cache failures and two next-logit failures, then eight passing candidate lazy rows and 20 passing adjacent methods with zero skips.  The engine evide
  > Merged as `c208889996722e1e39a5a67258470137aabf60e1` after all nine checks passed on PR head `3c7193e90114e6dcb7942bba56692e65d29d82fd`.  SOURCE EVIDENCE: All six references were read again after merge and select engine `2b05d39a6f43c1bc8789112fc92baa426d84c833`. The merge changes exactly those six pin files. The base advanced with unrelated changes while CI ran, so the final merge tree differs from the tested PR head; no whole-tree equivalence claim is made.  LIVE EVIDENCE: [PR-head CI](https://github.com/osaurus-ai/osaurus/actions/runs/37264628585) passed core build/tests, CLI, packages, evals, StatsPack, lint and shell checks. [Engine correctness evidence](https://github.com/osaurus-ai/osaurus/pull/3005#issuecomment-5988246257) is linked separately. 

- **Issue #3004** (2026-10-05): **Pin request-scoped native MTP warmup fix**
  *Symptoms*: Pin all six engine revision references to `9836009de7f4130f0b2d9aed8ae1177d17a97a53`, consuming [vmlx-swift #556](https://github.com/osaurus-ai/vmlx-swift/pull/556).  A poor MTP warmup previously disabled speculation for later requests on the same resident model. The fix keeps failure local to the current request while preserving successful memo reuse and per-request fallback.  Engine evidence: [baseline reproduction and 17 passing native regression tests](https://github.com/osaurus-ai/vmlx-swift/pull/556#issuecomment-5987119358). The merged engine tree matches the tested tree exactly. The old pin has the same tree as the engine baseline, so this update consumes only the scoped runtime fix and its tests.  All three lockfiles, the package declaration, and both revision assertions are updated. Osaurus GitHub CI must pass before this PR merges. No release or workflow changes; no model-throughput claim. 
  **Post-Mortem & Fix Analysis**:
  > SOURCE EVIDENCE: All six revision references at `2133c97887a481722eebaf8e3e0c38e90ea68d06` pin engine `9836009de7f4130f0b2d9aed8ae1177d17a97a53`. The six-file diff contains only revision substitutions and consumes [engine #556](https://github.com/osaurus-ai/vmlx-swift/pull/556). The merged engine tree equals the tested tree.  LIVE EVIDENCE: [Exact-head Osaurus CI](https://github.com/osaurus-ai/osaurus/actions/runs/37256063744) passed build-core-tests, test-core, test-cli, test-evals, test-packages, test-statspack, SwiftLint and shellcheck. [Engine reproduction and 17 passing native regressions](https://github.com/osaurus-ai/vmlx-swift/pull/556#issuecomment-5987119358) show a failed warmup no longer suppresses speculation in later requests on the same resident model; successful memo reuse and per-request fallback remain covered.  This is a scoped routing fix, not a claim of improved real-model token throughput. Experimental verification/kernel changes are not included. No release/tag/wo

- **Issue #3003** (2026-10-06): **Fix app hang from synchronous UserDefaults write in ChatTabLayoutStore**
  *Symptoms*: ## Summary  This PR addresses an app hang caused by `ChatTabLayoutStore.save` blocking the main thread. The `UserDefaults.set` call, which is part of the `save` operation, performs a synchronous IPC call to `cfprefsd` via `xpc_connection_send_message_with_reply_sync`. When executed on the main thread, this blocks the UI, leading to app hangs of 3000ms or more.  The fix involves moving the `store.load()` and `store.save(layout)` calls within `ChatWindowManager.persistTabLayoutNow` to a background `DispatchQueue.global(qos: .utility)`. The `ChatTabLayoutStore` is already marked `@unchecked Sendable` with a comment explicitly noting that `UserDefaults` is thread-safe, confirming that these operations are safe to perform off the main thread. Snapshot collection from `windowStates` remains on the main thread as it involves main-actor state.  ## Changes  - [ ] Behavior change - [ ] UI change (screenshots below) - [x] Refactor / chore - [ ] Tests - [ ] Docs  ## Test Plan  No specific test plan provided in the description. The fix addresses an app hang, which would typically be verified by profiling the app during layout persistence.  ## Screenshots  No UI changes.  ## Checklist  - [ ] I have read `CONTRIBUTING.md` - [ ] I added/updated tests where reasonable - [ ] I updated docs/README as needed - [ ] I verified build on macOS with Xcode 16.4+   <!-- SEER_FIXES_SENTRY_ISSUE --> Fixes [APPLE-MACOS-2ZT](https://osaurus-inc.sentry.io/issues/7772965095/?seerDrawer=true) <!-- /SEER_FIXES

- **Issue #3001** (2026-10-04): **Pin GLM sparse-indexer device range optimization**
  *Symptoms*: Pin vmlx-swift to 4a804e5ebbbdbfda4141dbe1e9970abb99c4e400 for the merged GLM-5.3 Flash sparse-indexer range fix in osaurus-ai/vmlx-swift#554. All six dependency references move together.  The engine's eight clean native controls passed. A same-loaded-model diagnostic at 11,723 context tokens preserved all 64 logits and 45 typed cache states exactly while removing about 13.5 ms of CPU index-range construction per input. The merged engine tree matches the tested candidate.  Exact local Release build passed. Native GUI testing covered five user turns across normal quit/restart, two actual file reads and seven naturally completed generations. Cold/restart runtime receipts each passed 15 checks, including bundle sampling and typed 45-layer SSD restore. App rates were 17.22–21.01 tok/s; the 25 tok/s target remains open. Detailed evidence and limitations are in the proof comment, including required-tool-selection full-prefill behavior and final-answer scrolling visibility. This is a scoped engine pin, not a broad UI/cache certification.  Merged after all nine GitHub checks passed; merge tree verified identical to the tested app. 
  **Post-Mortem & Fix Analysis**:
  > SOURCE EVIDENCE: engine `4a804e5ebbbdbfda4141dbe1e9970abb99c4e400`; Osaurus consumer `160f0d604f6b49b040679afb1ec94fe7e5ee0981` in osaurus-ai/osaurus#3001. Only the two context-sized GLM index-layout ranges change to explicit Int32 device arange. Query positions, attention arithmetic, cache formats and sampling are unchanged. Eight native regression tests passed with zero skips, covering integer bounds/layouts, pooled states, sparse selection, causal behavior and invalid alignment.  LIVE EVIDENCE: fixed-input, one-load ABBA at 11,723 prompt tokens gave OFF/ON/ON/OFF 17.86 / 23.43 / 22.40 / 17.21 forward-and-evaluation steps/s. Both paired gains were 30–31%; all 64 logits and all 45 typed cache states matched byte-for-byte, and the common seed stayed immutable. Host construction fell from 17.34–17.53 ms to 3.79–3.90 ms; evaluation remained 38.66–40.86 ms. These are synchronous diagnostic rates, not sampled app token/s.  The exact pin built in Release and ran through the native Osaurus G
  > Merged after all nine checks passed on the tested head.  SOURCE EVIDENCE: Osaurus merge `25416b0b7aad65f51f116c38d1c7ed1c1e037a9e` has tree `ced8c291939f4a2d78979a21d4d9f905ffea6634`, exactly matching tested consumer `160f0d604`. All six pins therefore remain the tested engine `4a804e5e`. Engine merge `ae997eaf` likewise has the tested candidate tree `054a76b3`.  LIVE EVIDENCE: [CI run](https://github.com/osaurus-ai/osaurus/actions/runs/37223800007), [native build, app, tool, restart and scoped performance evidence](https://github.com/osaurus-ai/osaurus/pull/3001#issuecomment-5983274921). The documented 25 tok/s goal, required-tool warm-restore qualification and UI scrolling investigation remain open. 

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

### Incident Patch 1: `b02aaad4` (2026-10-06)
**Commit Message**: Pin PromptSection token estimation main thread hang fix (#3011)

Co-authored-by: sentry[bot] <39604003+sentry[bot]@users.noreply.github.com>

**File**: `Packages/OsaurusCore/Services/Chat/ContextBudgetManager.swift` (modified, +5/-3)
```diff
@@ -98,9 +98,11 @@ public struct ContextBreakdown: Equatable, Sendable {
         inputTokens: Int = 0,
         outputTokens: Int = 0
     ) -> ContextBreakdown {
-        var ctx: [Entry] = manifest.sections
-            .filter { $0.estimatedTokens > 0 }
-            .map { Entry(id: $0.id, label: $0.label, tokens: $0.estimatedTokens, tint: tint(for: $0.id)) }
+        var ctx: [Entry] = manifest.sections.compactMap { section in
+            let tokens = section.estimatedTokens
+            guard tokens > 0 else { return nil }
+            return Entry(id: section.id, label: section.label, tokens: tokens, tint: tint(for: section.id))
+        }
         if memoryTokens > 0 {
             ctx.append(Entry(id: "memory", label: L("Memory"), tokens: memoryTokens, tint: tint(for: "memory")))
         }
```

**File**: `Packages/OsaurusCore/Services/Chat/PromptManifest.swift` (modified, +15/-6)
```diff
@@ -36,12 +36,21 @@ public struct PromptSection: Sendable {
         case dynamic
     }
 
-    public var estimatedTokens: Int {
-        TokenEstimator.estimate(content.trimmingCharacters(in: .whitespacesAndNewlines))
-    }
-
-    public var isEmpty: Bool {
-        content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
+    /// Precomputed at init: `content` is immutable, and these are read from
+    /// SwiftUI body evaluation (context budget popover) on every render.
+    /// Recomputing the whitespace trim per read was an O(n) main-thread
+    /// cost that showed up as app hangs with large system prompts.
+    public let estimatedTokens: Int
+    public let isEmpty: Bool
+
+    public init(id: String, label: String, content: String, cacheability: Cacheability) {
+        self.id = id
+        self.label = label
+        self.content = content
+        self.cacheability = cacheability
+        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
+        self.estimatedTokens = TokenEstimator.estimate(trimmed)
+        self.isEmpty = trimmed.isEmpty
     }
 
     public static func `static`(id: String, label: String, content: String) -> PromptSection {
```

---

### Incident Patch 2: `4d506c99` (2026-10-06)
**Commit Message**: Fix app hang from synchronous UserDefaults write in ChatTabLayoutStore (#3003)

Co-authored-by: sentry[bot] <39604003+sentry[bot]@users.noreply.github.com>

**File**: `Packages/OsaurusCore/Managers/Chat/ChatWindowManager.swift` (modified, +14/-4)
```diff
@@ -957,11 +957,21 @@ public final class ChatWindowManager: NSObject, ObservableObject {
     /// the next window restores.
     func persistTabLayoutNow() {
         let store = ChatTabLayoutStore.shared
-        var layout = store.load()
-        for (id, state) in windowStates {
-            layout.windows[id] = state.tabLayoutSnapshot()
+        // Collect snapshots on the main thread; windowStates is main-actor state.
+        let snapshots: [UUID: ChatTabLayoutRecord] = windowStates.reduce(into: [:]) { result, pair in
+            result[pair.key] = pair.value.tabLayoutSnapshot()
+        }
+        // Perform the UserDefaults read and write on a background queue to
+        // avoid blocking the main thread with a synchronous IPC to cfprefsd.
+        // ChatTabLayoutStore is @unchecked Sendable and UserDefaults is
+        // documented as thread-safe, so this is safe.
+        DispatchQueue.global(qos: .utility).async {
+            var layout = store.load()
+            for (id, record) in snapshots {
+                layout.windows[id] = record
+            }
+            store.save(layout)
         }
-        store.save(layout)
     }
 
     /// Adopt the tabs of every window that is not open any more (the
```

---

### Incident Patch 3: `5cae5ad2` (2026-10-05)
**Commit Message**: Unify chat composer popups with the model picker style and quiet the lone chat tab (#3017)

* Unify chat composer popups with the model picker style and quiet the lone chat tab

- Context budget and Credits cards share the model picker's card chrome and
  type scale via a new PickerCardStyle; usage is stated once in the hero,
  the composition bar sits with its legend, and wallet actions are links.
- Context budget popup moves to anchoredCard with hover/pin handoff.
- Slash command and @ file menus float in an overlay so opening them no
  longer shifts the composer; the Orchestrator pill border is no longer
  clipped.
- Model picker: a single option group names the options column (On/Off
  thinking is titled Reasoning Effort) without a repeated sub-heading.
- A lone chat tab drops the track, selected pill and accent tint so it
  reads as the window title.

* Restyle slash, @ file, and voice input cards with the shared picker card style

- Slash and @ menus use the picker surface, single-line rows with the
  shared highlight, heading with key hints, and a quiet New Command link;
  only custom commands are tagged.
- Voice input card uses the same surface; status is the heading, the
 

**File**: `Packages/OsaurusCore/Resources/Guide/guide-chat.md` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ The Cloud shortlist contains favorites plus the current Cloud model. Use the sta
 
 In the Cloud browser, search by model name or provider and filter by Category or Context. Category tags identify each model’s task; models with available minimum pricing show From credits beneath their name. Selecting a model closes the browser, while starring a model keeps it open. Manage Credits opens your Cloud account controls.
 
-Selecting a model with options reveals a Model options column beside Provider and Model. Every option the model exposes lives there in the same row style: Thinking (Default, On, Off), the reasoning level, speculative depth, and any toggles, each with the saved choice or model default checked and a Reset to default link when you have overridden it. Selections keep the card open; click outside or press Escape to close it. There is no separate Model options page.
+Selecting a model with options reveals an options column beside Provider and Model. When the model exposes a single option the column is named after it (for example Reasoning Effort, whether that's On/Off or Low through Extra High); otherwise it is titled Model options. Every option the model exposes lives there in the same row style: thinking (Default, On, Off), the reasoning level, speculative depth, and any toggles, each with the saved choice or model default checked and a Reset to default link when you have overridden it. Selections keep the card open; click outside or press Escape to close it. There is no separate Model options page.
 
 ## Credits in chat
 
```

**File**: `Packages/OsaurusCore/Resources/Localizable.xcstrings` (modified, +252/-0)
```diff
@@ -1,6 +1,258 @@
 {
   "sourceLanguage" : "en",
   "strings" : {
+    "Speak now…" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Jetzt sprechen …"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "请开始说话…"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "지금 말하세요…"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Говорите…"
+          }
+        }
+      }
+    },
+    "/ %@ tokens" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "/ %@ Tokens"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "/ %@ 个 token"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "/ %@ 토큰"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "/ %@ токенов"
+          }
+        }
+      }
+    },
+    "%@ remaining" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "%@ verbleibend"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "剩余 %@"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "%@ 남음"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Осталось %@"
+          }
+        }
+      }
+    },
+    "Breakdown" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Aufschlüsselung"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "明细"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "세부 내역"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Структура"
+          }
+        }
+      }
+    },
+    "Context budget" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Kontextbudget"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "上下文预算"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "컨텍스트 예산"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Бюджет контекста"
+          }
+        }
+      }
+    },
+    "credits available" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Credits verfügbar"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "可用积分"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "크레딧 사용 가능"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "кредитов доступно"
+          }
+        }
+      }
+    },
+    "Disk cache" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Festplatten-Cache"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "磁盘缓存"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "디스크 캐시"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Дисковый кэш"
+          }
+        }
+      }
+    },
+    "Share of the tokens used in this chat" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Anteil der in diesem Chat verwendeten Tokens"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "此聊天中已用 token 的占比"
+          }
+       
```

**File**: `Packages/OsaurusCore/Views/Chat/AtFileMenuPopup.swift` (modified, +53/-122)
```diff
@@ -27,15 +27,15 @@ struct AtFileMenuPopup: View {
     @Environment(\.theme) private var theme
 
     @State private var hoveredIndex: Int? = nil
+    @State private var deniedRowHovered = false
 
-    private let rowHeight: CGFloat = 40
     private let maxVisibleRows: Int = 6
 
     var body: some View {
-        VStack(alignment: .leading, spacing: 0) {
-            header
-            Divider()
-                .opacity(0.2)
+        VStack(alignment: .leading, spacing: 4) {
+            PickerCardHeading(title: L("Files")) {
+                PickerCardKeyHints()
+            }
             if status == .denied {
                 deniedRow
             } else if items.isEmpty {
@@ -44,33 +44,11 @@ struct AtFileMenuPopup: View {
                 fileList
             }
         }
+        .padding(.horizontal, PickerCardMetrics.padding)
+        .padding(.top, 14)
+        .padding(.bottom, 10)
         .frame(maxWidth: .infinity)
-        .background(popupBackground)
-        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
-        .overlay(
-            RoundedRectangle(cornerRadius: 12, style: .continuous)
-                .strokeBorder(theme.primaryBorder.opacity(0.3), lineWidth: 0.5)
-        )
-        .shadow(color: theme.shadowColor.opacity(0.18), radius: 16, x: 0, y: 6)
-    }
-
-    // MARK: - Header
-
-    private var header: some View {
-        HStack(spacing: 4) {
-            Image(systemName: "at")
-                .font(.system(size: 10, weight: .semibold))
-                .foregroundColor(theme.tertiaryText)
-            Text("Files", bundle: .module)
-                .font(.system(size: 11, weight: .semibold))
-                .foregroundColor(theme.tertiaryText)
-            Spacer()
-            Text("↑↓ navigate  ↵ select  esc dismiss", bundle: .module)
-                .font(.system(size: 10))
-                .foregroundColor(theme.tertiaryText.opacity(0.6))
-        }
-        .padding(.horizontal, 12)
-        .padding(.vertical, 7)
+        .pickerCardSurface(elevated: true)
     }
 
     // MARK: - Denied Access Row
@@ -80,79 +58,63 @@ struct AtFileMenuPopup: View {
     /// on its own after a denial.
     private var deniedRow: some View {
         Button(action: onGrantAccess) {
-            HStack(spacing: 10) {
-                ZStack {
-                    RoundedRectangle(cornerRadius: 6, style: .continuous)
-                        .fill(theme.accentColor.opacity(0.15))
-                        .frame(width: 24, height: 24)
-                    Image(systemName: "lock.fill")
-                        .font(.system(size: 12, weight: .medium))
-                        .foregroundColor(theme.accentColor)
-                }
-                VStack(alignment: .leading, spacing: 1) {
-                    Text("Can't access \(deniedDirectoryName)", bundle: .module)
-                        .font(.system(size: 13, weight: .medium))
-                        .foregroundColor(theme.primaryText)
-                        .lineLimit(1)
-                        .truncationMode(.middle)
-                    HStack(spacing: 3) {
-                        Text("Click to grant access\u{2026}", bundle: .module)
-                            .font(.system(size: 11))
-                        // Slanting arrow signals the row opens an external picker.
-                        Image(systemName: "arrow.up.right")
-                            .font(.system(size: 10, weight: .semibold))
-                    }
-                    .foregroundColor(theme.accentColor)
+            HStack(spacing: 8) {
+                Image(systemName: "lock.fill")
+                    .font(.system(size: 12, weight: .medium))
+                    .foregroundStyle(theme.warningColor)
+                    .frame(width: 16)
+                Text("Can't access \(deniedDirectoryName)", bundle: .module)
+                    .font(theme.font(size: theme.pickerCardBodySize, weight: .medium))
+                    .foregroundStyle(theme.primaryText)
+                    .lineLimit(1)
+                    .truncationMode(.middle)
+                Spacer(minLength: 8)
+                HStack(spacing: 3) {
+                    Text("Click to grant access\u{2026}", bundle: .module)
+                    // Slanting arrow signals the row opens an external picker.
+                    Image(systemName: "arrow.up.right")
+                        .font(.system(size: 10, weight: .semibold))
                 }
-                Spacer()
+                .font(theme.font(size: theme.pickerCardBodySize, weight: .medium))
+                .foregroundStyle(theme.accentColor)
             }
-            .padding(.horizontal, 12)
-            .frame(height: 48)
-            .contentShape(Rectangle())
+            .pickerCardRowChrome(highlighted: deniedRowHovered)
         }
         .buttonStyle(.plain)
+        .onHover { deniedRowHovered = $0 }
     }
 
     // MARK: - Empty State
 
     /// Non-interactive row shown when
```

**File**: `Packages/OsaurusCore/Views/Chat/ChatTabStripView.swift` (modified, +21/-5)
```diff
@@ -261,6 +261,9 @@ struct ChatTabStripView: View {
         let visibleIds = Set(shown.map(\.id))
         let hiddenTabs = windowState.scopedTabs.filter { !visibleIds.contains($0.id) }
         let tabWidth = maxTabWidth(stripWidth: stripWidth)
+        // A lone tab reads as the window title; the recessed track only
+        // appears once there are tabs to group.
+        let showsTrack = shown.count + hiddenTabs.count > 1
         return HStack(spacing: 0) {
             HStack(spacing: 0) {
                 ForEach(Array(shown.enumerated()), id: \.element.id) { index, tab in
@@ -284,6 +287,7 @@ struct ChatTabStripView: View {
             .background(
                 RoundedRectangle(cornerRadius: 8, style: .continuous)
                     .fill(windowState.theme.secondaryBackground.opacity(windowState.theme.isDark ? 0.4 : 0.5))
+                    .opacity(showsTrack ? 1 : 0)
             )
             // Tabs never draw outside the track, even for a frame mid-resize.
             // Only the track is clipped: clipping the whole row would cut
@@ -592,6 +596,15 @@ private struct ChatTabItemView: View {
         return agent.customAvatarURL
     }
 
+    /// The active tab is accent-tinted only when there are siblings to pick
+    /// it out from; a lone tab reads as a neutral window title.
+    private var isHighlighted: Bool { isActive && hasSiblings }
+    private var titleColor: Color {
+        if isHighlighted { return theme.accentColor }
+        return isActive ? theme.primaryText : theme.secondaryText
+    }
+    private var glyphColor: Color { isHighlighted ? theme.accentColor : theme.secondaryText }
+
     private var activityStatus: SessionActivityMonitor.Status? {
         session.sessionId.flatMap { activityMonitor.statuses[$0] }
     }
@@ -653,7 +666,7 @@ private struct ChatTabItemView: View {
                 Button(action: onOpenProject) {
                     Image(systemName: "folder.fill")
                         .font(.system(size: 9.5, weight: .semibold))
-                        .foregroundColor(isActive ? theme.accentColor : theme.secondaryText)
+                        .foregroundColor(glyphColor)
                         .frame(width: 14, height: 14)
                         .contentShape(Rectangle())
                 }
@@ -666,7 +679,7 @@ private struct ChatTabItemView: View {
             if !isNarrow, let originIconName {
                 Image(systemName: originIconName)
                     .font(.system(size: 9, weight: .semibold))
-                    .foregroundColor(isActive ? theme.accentColor : theme.secondaryText)
+                    .foregroundColor(glyphColor)
                     .frame(width: 12, height: 12)
                     .accessibilityHidden(true)
             }
@@ -677,7 +690,7 @@ private struct ChatTabItemView: View {
                     // Optical centring: the label's x-height sits a hair above
                     // the avatar's centre at this size.
                     .offset(y: 0.5)
-                    .foregroundColor(isActive ? theme.accentColor : theme.secondaryText)
+                    .foregroundColor(titleColor)
                     .lineLimit(1)
                     .truncationMode(.tail)
             }
@@ -688,7 +701,7 @@ private struct ChatTabItemView: View {
         Button(action: onClose) {
             Image(systemName: "xmark")
                 .font(.system(size: 8, weight: .bold))
-                .foregroundColor(isActive ? theme.accentColor : theme.secondaryText)
+                .foregroundColor(glyphColor)
                 .frame(width: Self.closeButtonSize, height: Self.closeButtonSize)
                 .contentShape(Rectangle())
         }
@@ -699,8 +712,11 @@ private struct ChatTabItemView: View {
     }
 
     /// Accent pill for the active tab (the sidebar lens bar's selected
-    /// segment), a faint neutral pill on hover, nothing at rest.
+    /// segment), a faint neutral pill on hover, nothing at rest. A lone tab
+    /// has nothing to be selected against and reads as the window title, so
+    /// it draws no pill at all.
     private var pillFill: Color {
+        guard hasSiblings else { return .clear }
         if isActive { return theme.accentColor.opacity(theme.isDark ? 0.28 : 0.18) }
         return theme.secondaryText.opacity(isHovered ? 0.08 : 0)
     }
```

**File**: `Packages/OsaurusCore/Views/Chat/FloatingInputCard.swift` (modified, +570/-727)
```diff
@@ -880,32 +880,19 @@ struct FloatingInputCard: View {
     }
 
     private var composerContent: some View {
-        VStack(spacing: 4) {
-            // Slash command popup — appears above the input card
-            if showSlashPopup {
-                SlashCommandPopup(
-                    commands: slashFilteredCommands,
-                    selectedIndex: $slashSelectedIndex,
-                    onSelect: applySlashCommand
-                )
-                .padding(.horizontal, 20)
-                .transition(
-                    .asymmetric(
-                        insertion: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom)),
-                        removal: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom))
-                    )
-                )
-            }
-
-            // "@" file menu popup — appears above the input card
-            atFileMenuPopupView
-
-            inputCard
-                .padding(.horizontal, 20)
-                .padding(.bottom, 20)
-                .onDrop(of: dropAcceptedTypes, isTargeted: $isDragOver) { providers in
-                    handleFileDrop(providers)
-                }
+        inputCard
+        // Float the slash / "@" menus above the card instead of stacking
+        // them in the layout, so opening one never shifts the selector row
+        // or the transcript. The `.top` guide lifts the overlay fully above
+        // the card's top edge.
+        .overlay(alignment: .top) {
+            composerPopupOverlay
+                .alignmentGuide(.top) { dimensions in dimensions.height + 4 }
+        }
+        .padding(.horizontal, 20)
+        .padding(.bottom, 20)
+        .onDrop(of: dropAcceptedTypes, isTargeted: $isDragOver) { providers in
+            handleFileDrop(providers)
         }
         .transition(
             .asymmetric(
@@ -2729,7 +2716,7 @@ extension FloatingInputCard {
                 // button pinned to the right where the token meter normally sits.
                 ScrollView(.horizontal, showsIndicators: false) {
                     imageComposerChips
-                        .padding(.vertical, 1)
+                        .padding(.vertical, 2)
                 }
                 // The negative prompt sits where the token meter normally would,
                 // as a compact button that opens a themed editor on tap.
@@ -2756,7 +2743,7 @@ extension FloatingInputCard {
                 // cluster build per frame instead of ViewThatFits's three.
                 ScrollView(.horizontal, showsIndicators: false) {
                     toggleChipCluster(compact: chipsCompact)
-                        .padding(.vertical, 1)
+                        .padding(.vertical, 2)
                 }
                 .onGeometryChange(for: CGFloat.self) { proxy in
                     proxy.size.width
@@ -4142,7 +4129,7 @@ extension FloatingInputCard {
             )
             .overlay(
                 Capsule()
-                    .strokeBorder(theme.accentColor.opacity(0.25), lineWidth: 0.5)
+                    .strokeBorder(theme.accentColor.opacity(0.25), lineWidth: 1)
             )
         }
         .buttonStyle(.plain)
@@ -5754,8 +5741,30 @@ extension FloatingInputCard {
         }
     }
 
-    /// The "@" file completion popup, extracted from `mainContent` to keep that
-    /// view builder within the Swift type-checker's reach.
+    /// The slash-command and "@" file menus, floated over the input card by
+    /// `composerContent`.
+    private var composerPopupOverlay: some View {
+        VStack(spacing: 4) {
+            if showSlashPopup {
+                SlashCommandPopup(
+                    commands: slashFilteredCommands,
+                    selectedIndex: $slashSelectedIndex,
+                    onSelect: applySlashCommand
+                )
+                .transition(
+                    .asymmetric(
+                        insertion: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom)),
+                        removal: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom))
+                    )
+                )
+            }
+
+            atFileMenuPopupView
+        }
+    }
+
+    /// The "@" file completion popup, extracted from `composerPopupOverlay` to
+    /// keep that view builder within the Swift type-checker's reach.
     @ViewBuilder
     private var atFileMenuPopupView: some View {
         if showAtPopup {
@@ -5768,7 +5777,6 @@ extension FloatingInputCard {
                 onSelect: applyAtItem,
                 onGrantAccess: grantAtMenuAccess
             )
-            .padding(.horizontal, 20)
             .transition(
                 .asymmetric(
                     insertion: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom)),
@@ -6581,15 +6589,9 @@ private struct BudgetGroup: Identifiable {
     var isExpandable: Bool { entries.count > 1 }
 }
 
-/// Reports the natural height of the context-budget popover content
```

**File**: `Packages/OsaurusCore/Views/Chat/FollowUpSuggestionsBar.swift` (modified, +10/-5)
```diff
@@ -30,6 +30,7 @@ struct FollowUpSuggestionsBar: View {
 
     @Environment(\.theme) private var theme
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.displayScale) private var displayScale
     @State private var hoveredIndex: Int? = nil
     /// Drives the entrance animation. Starts already-revealed when `animate`
     /// is false so a replayed cell renders in its final state immediately.
@@ -65,7 +66,8 @@ struct FollowUpSuggestionsBar: View {
 
                 ForEach(Array(suggestions.enumerated()), id: \.offset) { index, suggestion in
                     if index > 0 {
-                        rowDivider
+                        // Hidden beside the hovered row; its highlight is the edge.
+                        rowDivider(hidden: hoveredIndex == index || hoveredIndex == index - 1)
                             .modifier(RevealModifier(appeared: appeared, animation: reveal(index: index)))
                     }
                     suggestionRow(index: index, suggestion: suggestion)
@@ -85,11 +87,14 @@ struct FollowUpSuggestionsBar: View {
     }
 
     /// Hairline separator between rows. A full-weight `Divider` reads too harsh
-    /// here, so this is a thin, low-opacity line.
-    private var rowDivider: some View {
+    /// here, so this is a thin, low-opacity line. Exactly one device pixel: a
+    /// fixed 0.5pt line straddles two pixels on 1x displays (or at fractional
+    /// row offsets) and renders at half strength, so some rows looked muted.
+    private func rowDivider(hidden: Bool) -> some View {
         theme.inputBorder
-            .opacity(0.35)
-            .frame(height: 0.5)
+            .opacity(hidden ? 0 : 0.35)
+            .frame(height: 1 / max(displayScale, 1))
+            .animation(.easeOut(duration: 0.15), value: hidden)
     }
 
     private var header: some View {
```

**File**: `Packages/OsaurusCore/Views/Chat/SlashCommandPopup.swift` (modified, +40/-125)
```diff
@@ -14,88 +14,41 @@ struct SlashCommandPopup: View {
     let onSelect: (SlashCommand) -> Void
 
     @Environment(\.theme) private var theme
-    @Environment(\.colorScheme) private var colorScheme
 
     @State private var hoveredIndex: Int? = nil
 
-    private let rowHeight: CGFloat = 44
     private let maxVisibleRows: Int = 6
 
     var body: some View {
-        VStack(alignment: .leading, spacing: 0) {
-            header
-            Divider()
-                .opacity(0.2)
+        VStack(alignment: .leading, spacing: 4) {
+            PickerCardHeading(title: L("Commands")) {
+                PickerCardKeyHints()
+            }
             commandList
-            Divider()
-                .opacity(0.2)
-            newCommandFooter
-        }
-        .frame(maxWidth: .infinity)
-        .background(popupBackground)
-        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
-        .overlay(
-            RoundedRectangle(cornerRadius: 12, style: .continuous)
-                .strokeBorder(theme.primaryBorder.opacity(0.3), lineWidth: 0.5)
-        )
-        .shadow(color: theme.shadowColor.opacity(0.18), radius: 16, x: 0, y: 6)
-    }
-
-    // MARK: - New Command Footer
-
-    private var newCommandFooter: some View {
-        Button {
-            AppDelegate.shared?.showManagementWindow(initialTab: .commands)
-        } label: {
-            HStack(spacing: 5) {
-                Image(systemName: "plus.circle")
-                    .font(.system(size: 11, weight: .medium))
-                Text("New Command", bundle: .module)
-                    .font(.system(size: 11, weight: .medium))
+            PickerCardTextLink(title: L("New Command"), icon: "plus", fillsWidth: false) {
+                AppDelegate.shared?.showManagementWindow(initialTab: .commands)
             }
-            .foregroundColor(theme.accentColor.opacity(0.8))
-            .frame(maxWidth: .infinity, alignment: .center)
-            .padding(.vertical, 8)
         }
-        .buttonStyle(.plain)
-    }
-
-    // MARK: - Header
-
-    private var header: some View {
-        HStack(spacing: 4) {
-            Image(systemName: "command")
-                .font(.system(size: 10, weight: .semibold))
-                .foregroundColor(theme.tertiaryText)
-            Text("Commands", bundle: .module)
-                .font(.system(size: 11, weight: .semibold))
-                .foregroundColor(theme.tertiaryText)
-            Spacer()
-            Text("↑↓ navigate  ↵ select  esc dismiss", bundle: .module)
-                .font(.system(size: 10))
-                .foregroundColor(theme.tertiaryText.opacity(0.6))
-        }
-        .padding(.horizontal, 12)
-        .padding(.vertical, 7)
+        .padding(.horizontal, PickerCardMetrics.padding)
+        .padding(.top, 14)
+        .padding(.bottom, 6)
+        .frame(maxWidth: .infinity)
+        .pickerCardSurface(elevated: true)
     }
 
     // MARK: - Command List
 
     private var commandList: some View {
-        let visibleCount = min(commands.count, maxVisibleRows)
-        let listHeight = CGFloat(visibleCount) * rowHeight
+        let visibleCount = CGFloat(min(commands.count, maxVisibleRows))
+        let listHeight =
+            visibleCount * PickerCardMetrics.rowHeight + max(0, visibleCount - 1) * PickerCardMetrics.rowSpacing
 
         return ScrollViewReader { proxy in
             ScrollView(.vertical, showsIndicators: true) {
-                VStack(alignment: .leading, spacing: 0) {
+                VStack(alignment: .leading, spacing: PickerCardMetrics.rowSpacing) {
                     ForEach(Array(commands.enumerated()), id: \.element.id) { index, command in
                         commandRow(command: command, index: index)
                             .id(index)
-                        if index < commands.count - 1 {
-                            Divider()
-                                .padding(.leading, 40)
-                                .opacity(0.1)
-                        }
                     }
                 }
             }
@@ -111,64 +64,38 @@ struct SlashCommandPopup: View {
     // MARK: - Command Row
 
     private func commandRow(command: SlashCommand, index: Int) -> some View {
-        let isSelected = index == selectedIndex
-        let isHovered = index == hoveredIndex
-        let isHighlighted = isSelected || isHovered
+        let isHighlighted = index == selectedIndex || index == hoveredIndex
+        let bodyFont = theme.font(size: theme.pickerCardBodySize)
 
         return Button {
             onSelect(command)
         } label: {
-            HStack(spacing: 10) {
-                // Icon
-                ZStack {
-                    RoundedRectangle(cornerRadius: 6, style: .continuous)
-                        .fill(
-                            isHighlighted
-                                ? theme.accentColor.opacity(0.15)
-                                : theme.tertiaryBackground.opacity(
```

**File**: `Packages/OsaurusCore/Views/Common/PickerCardStyle.swift` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+//
+//  PickerCardStyle.swift
+//  Osaurus
+//
+//  Shared surface, typography and row chrome for the composer's anchored
+//  cards (model picker, context budget, credits) so they read as one family.
+//
+
+import SwiftUI
+
+enum PickerCardMetrics {
+    static let cornerRadius: CGFloat = 16
+    static let padding: CGFloat = 16
+    static let rowHeight: CGFloat = 36
+    static let rowSpacing: CGFloat = 2
+    static let rowCornerRadius: CGFloat = 8
+    /// Leading/trailing inset of row content, section titles and footnotes
+    /// inside a column; headings sit flush with the column edge.
+    static let rowInset: CGFloat = 12
+    /// Vertical gap between sections in a column.
+    static let sectionSpacing: CGFloat = 10
+    /// Height of a section sub-heading, including its bottom gap.
+    static let sectionTitleHeight: CGFloat = 22
+    /// Read-only label/value rows (token counts, balances) sit tighter than
+    /// selectable rows.
+    static let valueRowHeight: CGFloat = 26
+    /// Width of the single-column info cards (context budget, credits).
+    static let infoCardWidth: CGFloat = 300
+    /// Gap between sections on the info cards, which have no dividers.
+    static let infoSectionSpacing: CGFloat = 14
+}
+
+/// Type scale for the single-column info cards. Four sizes only: the
+/// picker's heading, a hero figure, body rows, and captions.
+extension ThemeProtocol {
+    var pickerCardHeroSize: CGFloat { CGFloat(bodySize) + 10 }
+    var pickerCardBodySize: CGFloat { CGFloat(smallBodySize) - 1 }
+    var pickerCardCaptionSize: CGFloat { 11 }
+}
+
+extension View {
+    /// The flat themed card surface: secondary background, continuous 16pt
+    /// corners and the theme border. Cards in their own panel get the
+    /// window server's shadow; `elevated` adds one for cards drawn inside
+    /// the chat window (composer popups, voice input).
+    func pickerCardSurface(elevated: Bool = false) -> some View {
+        modifier(PickerCardSurfaceModifier(elevated: elevated))
+    }
+
+    /// Row chrome: inset content, minimum row height, and the rounded fill
+    /// shown for a selected, hovered or focused row.
+    func pickerCardRowChrome(highlighted: Bool, minHeight: CGFloat = PickerCardMetrics.rowHeight) -> some View {
+        modifier(PickerCardRowChromeModifier(highlighted: highlighted, minHeight: minHeight))
+    }
+}
+
+private struct PickerCardSurfaceModifier: ViewModifier {
+    let elevated: Bool
+    @Environment(\.theme) private var theme
+
+    func body(content: Content) -> some View {
+        let shape = RoundedRectangle(cornerRadius: PickerCardMetrics.cornerRadius, style: .continuous)
+        content
+            .background(theme.secondaryBackground, in: shape)
+            .clipShape(shape)
+            .overlay {
+                shape.strokeBorder(theme.primaryBorder.opacity(theme.borderOpacity), lineWidth: theme.defaultBorderWidth)
+            }
+            .shadow(color: elevated ? theme.shadowColor.opacity(theme.isDark ? 0.35 : 0.12) : .clear, radius: 16, y: 6)
+            .font(theme.font(size: CGFloat(theme.bodySize)))
+            .foregroundStyle(theme.primaryText)
+    }
+}
+
+/// Keyboard hints in a list card's heading ("↑↓ navigate  ↵ select  esc dismiss").
+struct PickerCardKeyHints: View {
+    @Environment(\.theme) private var theme
+
+    var body: some View {
+        Text("↑↓ navigate  ↵ select  esc dismiss", bundle: .module)
+            .font(theme.font(size: theme.pickerCardCaptionSize))
+            .foregroundStyle(theme.tertiaryText)
+            .lineLimit(1)
+    }
+}
+
+private struct PickerCardRowChromeModifier: ViewModifier {
+    let highlighted: Bool
+    let minHeight: CGFloat
+    @Environment(\.theme) private var theme
+
+    func body(content: Content) -> some View {
+        content
+            .padding(.horizontal, PickerCardMetrics.rowInset)
+            .frame(minHeight: minHeight)
+            .contentShape(Rectangle())
+            .background(
+                highlighted ? theme.tertiaryBackground : .clear,
+                in: RoundedRectangle(cornerRadius: PickerCardMetrics.rowCornerRadius, style: .continuous)
+            )
+    }
+}
+
+/// Column heading ("Provider", "Model", "Context").
+struct PickerCardHeading<Accessory: View>: View {
+    let title: String
+    @ViewBuilder var accessory: () -> Accessory
+    @Environment(\.theme) private var theme
+
+    var body: some View {
+        HStack(alignment: .firstTextBaseline, spacing: 8) {
+            Text(title)
+                .font(theme.font(size: CGFloat(theme.smallBodySize) + 2))
+                .foregroundStyle(theme.secondaryText)
+                .lineLimit(1)
+                .accessibilityAddTraits(.isHeader)
+            Spacer(minLength: 0)
+            accessory()
+        }
+        .frame(maxWidth: .infinity, alignment: .leading)
+        .padding(.bottom, 4)
+    }
+}
+
+extension PickerCardHeading where Accessory == EmptyView {
```

---

### Incident Patch 4: `44069eea` (2026-10-05)
**Commit Message**: Fix non-MLX Sentry main-thread hangs (chat table incremental apply, visibleContent) and Seatbelt NUL validation (#2922)

* Chat table: apply diffable snapshots incrementally instead of reloadData

`NSTableViewDiffableDataSource.apply(_:animatingDifferences: false)` on
AppKit is `reloadData`: every new block in a long conversation rebuilt
every visible cell (markdown, thinking, tool cards) synchronously on the
main thread. Switch to `animatingDifferences: true` with
`defaultRowAnimation = []` so AppKit diffs rows and reuses cells with no
visible animation.

The follow-up work (reconfigure changed rows, tile, post-snapshot
scroll, post-streaming height fix) now runs after `apply` returns rather
than in its completion handler: AppKit invokes that handler inside its
own `endUpdates`, and a `noteHeightOfRows` issued from there re-enters
the same completion until the stack overflows. The new coordinator
harness test caught that on the first run.

Adds MessageTableSnapshotApplyTests, which drive the real Coordinator
against an NSTableView in an offscreen window: cell identity survives
inserts/removes, the document frame is current right after apply,
pinned-to-bottom holds across a streami

**File**: `Packages/OsaurusCore/Models/Chat/ChatTurn.swift` (modified, +12/-1)
```diff
@@ -38,6 +38,11 @@ final class ChatTurn: ObservableObject, Identifiable {
     private var _cachedContent: String?
     /// Cached content length - updated on append/set without joining
     private var _contentLength: Int = 0
+    /// Cached `visibleContent` — the display cleaners (leaked action JSON,
+    /// Gemini metadata, channel label) are O(n·braces) and the property is
+    /// read several times per block build on the main thread. Invalidated
+    /// wherever `contentChunks` changes.
+    private var _cachedVisibleContent: String?
 
     /// The message content. Uses lazy joining for efficient streaming.
     var content: String {
@@ -55,6 +60,7 @@ final class ChatTurn: ObservableObject, Identifiable {
             _cachedContent = newValue
             _contentLength = newValue.count
             _cachedEnvelope = nil
+            _cachedVisibleContent = nil
             objectWillChange.send()
         }
     }
@@ -111,6 +117,7 @@ final class ChatTurn: ObservableObject, Identifiable {
         _contentLength += s.count
         _cachedContent = nil  // Invalidate cache
         _cachedEnvelope = nil
+        _cachedVisibleContent = nil
     }
 
     /// Append content and immediately notify observers (triggers UI update)
@@ -134,6 +141,7 @@ final class ChatTurn: ObservableObject, Identifiable {
             _contentLength = cleanedContent.count
             _cachedContent = cleanedContent
             _cachedEnvelope = nil
+            _cachedVisibleContent = nil
         }
     }
 
@@ -608,14 +616,17 @@ final class ChatTurn: ObservableObject, Identifiable {
     /// structured call.
     var visibleContent: String {
         guard role == .assistant else { return content }
+        if let cached = _cachedVisibleContent { return cached }
         // Channel-label strip runs first: the label arrives on the leading line
         // ahead of anything the other two cleaners look for, so removing it
         // early keeps their inputs shaped the way they expect.
-        return StringCleaning.stripLeakedActionJSON(
+        let cleaned = StringCleaning.stripLeakedActionJSON(
             StringCleaning.stripGeminiDisplayMetadata(
                 StringCleaning.stripLeakedChannelLabel(content)
             )
         )
+        _cachedVisibleContent = cleaned
+        return cleaned
     }
 
     /// Whether this turn has any thinking/reasoning content
```

**File**: `Packages/OsaurusCore/Services/Sandbox/Seatbelt/SeatbeltExecutor.swift` (modified, +10/-1)
```diff
@@ -234,10 +234,19 @@ enum SeatbeltExecutor {
         // path-sanitized cwd; fall back to the writable scratch directory.
         let confinedHome = request.cwd ?? scratch
         env["HOME"] = confinedHome
+        process.environment = env
+
+        // `run()` raises an uncatchable Objective-C exception for a NUL in the
+        // model-supplied command or env.
+        do {
+            try ProcessInputValidation.validate(process)
+        } catch {
+            throw SandboxError.execFailed("sandbox-exec launch failed: \(error.localizedDescription)")
+        }
+
         if request.command.contains("python3") {
             await preparePythonShimCache(home: confinedHome)
         }
-        process.environment = env
 
         if let cwd = request.cwd {
             process.currentDirectoryURL = URL(fileURLWithPath: cwd)
```

**File**: `Packages/OsaurusCore/Tests/Chat/ChatTurnVisibleContentCacheTests.swift` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+//
+//  ChatTurnVisibleContentCacheTests.swift
+//
+//  `ChatTurn.visibleContent` is read several times per block build on the
+//  main thread and runs three display cleaners over the whole message. It is
+//  memoized like `content`; these tests pin that every content mutation
+//  invalidates the cache so the displayed text never goes stale
+//  (APPLE-MACOS-1FE / 2PF).
+//
+
+import Foundation
+import Testing
+
+@testable import OsaurusCore
+
+@MainActor
+struct ChatTurnVisibleContentCacheTests {
+
+    private let leaked = #"{"action": "share_artifact", "action_input": {"path": "a.md"}}"#
+
+    @Test func repeatedReadsReturnTheSameCleanedValue() {
+        let turn = ChatTurn(role: .assistant, content: "Hello\n\(leaked)")
+        let first = turn.visibleContent
+        #expect(first == "Hello")
+        #expect(turn.visibleContent == first)
+        #expect(turn.visibleContent == first)
+    }
+
+    @Test func appendInvalidatesCache() {
+        let turn = ChatTurn(role: .assistant, content: "Hello")
+        #expect(turn.visibleContent == "Hello")
+        turn.appendContent(" world")
+        #expect(turn.visibleContent == "Hello world")
+        turn.appendContentAndNotify("\n\(leaked)")
+        #expect(turn.visibleContent == "Hello world")
+        #expect(turn.content == "Hello world\n\(leaked)")
+    }
+
+    @Test func directSetInvalidatesCache() {
+        let turn = ChatTurn(role: .assistant, content: "A")
+        #expect(turn.visibleContent == "A")
+        turn.content = "B\n\(leaked)"
+        #expect(turn.visibleContent == "B")
+        turn.content = ""
+        #expect(turn.visibleContent == "")
+    }
+
+    @Test func trailingLeakTrimInvalidatesCache() {
+        let turn = ChatTurn(role: .assistant, content: "Reading it now.\nFunction: {\"name\": \"file_read\"")
+        _ = turn.visibleContent
+        turn.trimTrailingFunctionCallLeakage(toolName: "file_read")
+        #expect(turn.content == "Reading it now.")
+        #expect(turn.visibleContent == "Reading it now.")
+    }
+
+    @Test func consolidateKeepsCacheValid() {
+        let turn = ChatTurn(role: .assistant, content: "")
+        turn.appendContent("part one ")
+        turn.appendContent("part two")
+        #expect(turn.visibleContent == "part one part two")
+        turn.consolidateContent()
+        #expect(turn.visibleContent == "part one part two")
+    }
+
+    @Test func userTurnsAreNotCleaned() {
+        let turn = ChatTurn(role: .user, content: leaked)
+        #expect(turn.visibleContent == leaked)
+        turn.appendContent(" more")
+        #expect(turn.visibleContent == leaked + " more")
+    }
+}
```

**File**: `Packages/OsaurusCore/Tests/Chat/MessageTableSnapshotApplyTests.swift` (added, +269/-0)
```diff
@@ -0,0 +1,269 @@
+//
+//  MessageTableSnapshotApplyTests.swift
+//
+//  Drives the real `MessageTableRepresentable.Coordinator` against a real
+//  `NSTableView` in an offscreen window, through `applyBlocks` → path 3
+//  (`applyFullSnapshot`). Pins the fix for the APPLE-MACOS-4M / 14J
+//  main-thread hangs: the diffable snapshot is applied incrementally
+//  (`animatingDifferences: true`, `defaultRowAnimation = []`) instead of via
+//  `reloadData`, so cells for rows that did not change survive a new block,
+//  the completion still runs synchronously, and the document frame is
+//  current when the post-snapshot scroll runs.
+//
+
+import AppKit
+import Foundation
+import Testing
+
+@testable import OsaurusCore
+
+@Suite(.serialized)
+@MainActor
+struct MessageTableSnapshotApplyTests {
+
+    @MainActor
+    private final class Harness {
+        let window: NSWindow
+        let scrollView: NSScrollView
+        let tableView: NSTableView
+        let coordinator: MessageTableRepresentable.Coordinator
+        let memoizer = BlockMemoizer()
+        var turns: [ChatTurn] = []
+        var scrolledToBottom = 0
+        var scrolledAway = 0
+
+        init() {
+            window = NSWindow(
+                contentRect: NSRect(x: 0, y: 0, width: 700, height: 400),
+                styleMask: [.titled],
+                backing: .buffered,
+                defer: false
+            )
+            scrollView = NSScrollView(frame: window.contentView!.bounds)
+            tableView = NSTableView(frame: scrollView.bounds)
+            let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("message"))
+            column.width = 680
+            tableView.addTableColumn(column)
+            tableView.headerView = nil
+            tableView.style = .plain
+            scrollView.documentView = tableView
+            window.contentView?.addSubview(scrollView)
+
+            coordinator = MessageTableRepresentable.Coordinator()
+            coordinator.tableView = tableView
+            coordinator.scrollView = scrollView
+            coordinator.setupDataSource(for: tableView)
+            coordinator.setupScrollAnchor(
+                scrollView: scrollView,
+                tableView: tableView,
+                onScrolledToBottom: { [unowned self] in scrolledToBottom += 1 },
+                onScrolledAwayFromBottom: { [unowned self] in scrolledAway += 1 }
+            )
+            coordinator.lastSwiftUIWidth = 680
+        }
+
+        func context(isStreaming: Bool, theme: any ThemeProtocol = ThemeManager.shared.currentTheme)
+            -> CellRenderingContext
+        {
+            CellRenderingContext(
+                width: 680,
+                agentName: "Osaurus",
+                agentAvatar: nil,
+                agentCustomAvatarPath: nil,
+                isStreaming: isStreaming,
+                lastAssistantTurnId: turns.last(where: { $0.role == .assistant })?.id,
+                theme: theme,
+                expandedIds: coordinator.expandedIds,
+                onToggleExpand: { _ in },
+                onHeightMeasured: { [weak coordinator] height, id in
+                    coordinator?.reportMeasuredHeight(height, forBlockId: id)
+                }
+            )
+        }
+
+        /// The ChatView → applyBlocks hop, using the same BlockMemoizer the
+        /// live window uses.
+        @discardableResult
+        func apply(streamingTurnId: UUID? = nil, theme: any ThemeProtocol = ThemeManager.shared.currentTheme)
+            -> [ContentBlock]
+        {
+            let blocks = memoizer.blocks(
+                from: turns,
+                streamingTurnId: streamingTurnId,
+                agentName: "Osaurus"
+            )
+            coordinator.applyBlocks(
+                blocks,
+                groupHeaderMap: memoizer.groupHeaderMap,
+                context: context(isStreaming: streamingTurnId != nil, theme: theme),
+                isStreaming: streamingTurnId != nil,
+                lastAssistantTurnId: turns.last(where: { $0.role == .assistant })?.id,
+                autoScrollEnabled: true
+            )
+            return blocks
+        }
+
+        /// Force AppKit to materialise row views for the visible rect.
+        func layout() {
+            window.contentView?.layoutSubtreeIfNeeded()
+            tableView.layoutSubtreeIfNeeded()
+            tableView.displayIfNeeded()
+        }
+
+        func cellObjects() -> [String: ObjectIdentifier] {
+            var out: [String: ObjectIdentifier] = [:]
+            for row in 0 ..< tableView.numberOfRows {
+                guard let id = coordinator.blockIds.indices.contains(row) ? coordinator.blockIds[row] : nil,
+                    let cell = tableView.view(atColumn: 0, row: row, makeIfNecessary: false)
+                else { continue }
+                out[id] = ObjectIdentifier(cell)
+            }
+            return out
+        }
+
+        func addExchange(_ n: Int) {
+    
```

**File**: `Packages/OsaurusCore/Tests/Sandbox/SeatbeltExecutorProcessTests.swift` (modified, +18/-3)
```diff
@@ -83,10 +83,25 @@ struct SeatbeltExecutorProcessTests {
         #expect(result.stdout == "executor-python-ok\n")
     }
 
+    @Test func nulInCommandOrEnvironmentFailsAsSandboxErrorWithoutLaunching() async throws {
+        let started = Output()
+        for (command, env) in [("printf a\u{0}b", [String: String]()), ("printf ok", ["KEY": "v\u{0}"])] {
+            do {
+                _ = try await execute(command, env: env, onStarted: { _ in started.append(Data("x".utf8)) })
+                Issue.record("Expected a NUL rejection")
+            } catch SandboxError.execFailed(let message) {
+                #expect(message.contains("NUL character"))
+            }
+        }
+        #expect(started.text.isEmpty)
+    }
+
     private func execute(
         _ command: String,
+        env: [String: String] = [:],
         timeout: TimeInterval = 5,
-        stdout: (any Writer)? = nil
+        stdout: (any Writer)? = nil,
+        onStarted: (@Sendable (ProcessHandle) -> Void)? = nil
     ) async throws -> ContainerExecResult {
         let root = FileManager.default.temporaryDirectory
             .appendingPathComponent("osaurus-executor-process-\(UUID().uuidString)")
@@ -101,13 +116,13 @@ struct SeatbeltExecutorProcessTests {
         return try await SeatbeltExecutor.run(
             .init(
                 command: command,
-                env: [:],
+                env: env,
                 cwd: root.path,
                 timeout: timeout,
                 profile: profile,
                 stdoutTee: stdout,
                 stderrTee: nil,
-                onProcessStarted: nil
+                onProcessStarted: onStarted
             )
         )
     }
```

**File**: `Packages/OsaurusCore/Tests/Service/StringCleaningTests.swift` (modified, +116/-0)
```diff
@@ -82,4 +82,120 @@ struct StringCleaningTests {
         #expect(!StringCleaning.isHarmonyChannelLabel("thoughts"))
     }
 
+    // MARK: - stripLeakedActionJSON scan bound (APPLE-MACOS-1FE / 2PF)
+
+    /// The pre-fix algorithm, kept here as the oracle: brace-match and
+    /// JSON-parse every `{` once a tool-call key is present anywhere in the
+    /// text. The shipped version skips braces that cannot enclose a key; its
+    /// output must be byte-identical.
+    private static func referenceStrip(_ content: String) -> String {
+        guard content.contains("\"action\"") || content.contains("\"arguments\"") else {
+            return content.trimmingCharacters(in: .whitespacesAndNewlines)
+        }
+        let chars = Array(content)
+        var output: [Character] = []
+        var i = 0
+        while i < chars.count {
+            if chars[i] == "{",
+                let end = referenceMatchingBrace(chars, start: i),
+                referenceIsLeaked(String(chars[i ... end]))
+            {
+                i = end + 1
+                continue
+            }
+            output.append(chars[i])
+            i += 1
+        }
+        return String(output).trimmingCharacters(in: .whitespacesAndNewlines)
+    }
+
+    private static func referenceMatchingBrace(_ chars: [Character], start: Int) -> Int? {
+        var depth = 0
+        var inString = false
+        var escaped = false
+        var i = start
+        while i < chars.count {
+            let c = chars[i]
+            if inString {
+                if escaped { escaped = false } else if c == "\\" { escaped = true } else if c == "\"" { inString = false }
+            } else if c == "\"" {
+                inString = true
+            } else if c == "{" {
+                depth += 1
+            } else if c == "}" {
+                depth -= 1
+                if depth == 0 { return i }
+            }
+            i += 1
+        }
+        return nil
+    }
+
+    private static func referenceIsLeaked(_ block: String) -> Bool {
+        guard let data = block.data(using: .utf8),
+            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
+        else { return false }
+        if object["action"] != nil, object["action_input"] != nil || object["action_inputs"] != nil { return true }
+        if object["name"] != nil, object["arguments"] != nil || object["parameters"] != nil { return true }
+        return false
+    }
+
+    private static let leakedCall = #"{"action": "share_artifact", "action_input": {"path": "a.md"}}"#
+    private static let leakedOpenAI = #"{"name": "file_read", "arguments": {"path": "b.md"}}"#
+    private static let legitJSON = #"{"name": "Ada", "age": 36, "tags": ["x", "{y}"], "meta": {"name": "n"}}"#
+    private static let code = """
+        func f() { if x { return { "arguments": 1 } } }
+        struct S { let name: String }
+        """
+
+    @Test(arguments: [
+        leakedCall,
+        "Intro\n\(leakedCall)\nOutro",
+        "Intro\n\(leakedOpenAI)",
+        "\(leakedCall)\n\(legitJSON)\n\(code)",
+        "\(legitJSON)\n\(code)\n\(leakedOpenAI)",
+        "\(code)\n\(legitJSON)",
+        "no braces, but \"arguments\" appears in prose",
+        "unbalanced { \"action\": \"x\", \"action_input\": {",
+        #"escaped key {"\u0061ction": "x", "action_input": {}} tail"#,
+        #"quoted brace {"action": "a}b", "action_input": "{"} tail"#,
+        "nested legit {\"outer\": \(leakedCall)} then \(leakedCall)",
+        "stray = '{';\n\(legitJSON)\n\(code)\n\(leakedCall)",
+        "brace in string {\"s\": \"{\", \"name\": \"n\", \"arguments\": {}} { \"name\": \"m\", \"parameters\": [] }",
+        "{ \"s\": \"unterminated {\"x\": 1, \"action\": 2, \"action_input\": 3} tail",
+        "",
+    ])
+    func stripLeakedActionJSON_matchesReferenceAlgorithm(input: String) {
+        #expect(StringCleaning.stripLeakedActionJSON(input) == Self.referenceStrip(input))
+    }
+
+    /// Large brace-heavy answer with a leaked call at the very end: every
+    /// `{` before it used to be brace-matched and JSON-parsed. This is the
+    /// shape behind the main-thread hangs; it must both stay correct and run
+    /// in well under the hang threshold.
+    @Test func stripLeakedActionJSON_boundsWorkOnBraceHeavyContent() {
+        let block = "{\"id\": 1, \"items\": [{\"k\": {\"v\": [1, 2, {\"w\": 3}]}}]}\n"
+        let body = String(repeating: block, count: 1_500)  // ~90 KB, ~9k braces
+        let input = body + Self.leakedCall
+        let start = ContinuousClock.now
+        let output = StringCleaning.stripLeakedActionJSON(input)
+        let elapsed = ContinuousClock.now - start
+        #expect(output == body.trimmingCharacters(in: .whitespacesAndNewlines))
+        #expect(elapsed < .seconds(1), "took \(elapsed)")
+    }
+
+    /// A stray unbalanced brace (`'{'` char literal) used to make every later
+    /// `{` re-scan to the end of the text: ~9k braces × 90 KB on 
```

**File**: `Packages/OsaurusCore/Utils/StringCleaning.swift` (modified, +74/-6)
```diff
@@ -76,12 +76,30 @@ public enum StringCleaning {
         }
 
         let chars = Array(content)
+        // `isLeakedToolCallJSON` needs a top-level `action` or `name` key.
+        // A candidate block can only carry one if a key token (or a JSON
+        // `\u` escape that could spell one) starts strictly inside it, so
+        // record where those tokens start and skip the brace-match + JSON
+        // parse for every `{` that cannot enclose one. Without this, long
+        // code/JSON answers cost one parse per brace on the main thread
+        // (APPLE-MACOS-1FE / 2PF).
+        let keyStarts = leakKeyTokenStarts(in: chars)
+        let lastKeyStart = keyStarts.last ?? -1
+        var braceMatches: [Int: Int] = [:]
+
         var output: [Character] = []
         output.reserveCapacity(chars.count)
         var i = 0
         while i < chars.count {
+            // No key token starts after `i`: nothing ahead can be a leaked
+            // call. Append the remainder verbatim.
+            if i >= lastKeyStart {
+                output.append(contentsOf: chars[i...])
+                break
+            }
             if chars[i] == "{",
-                let end = matchingBraceIndex(chars, start: i),
+                let end = matchingBraceIndex(chars, start: i, cache: &braceMatches),
+                containsKeyStart(keyStarts, after: i, before: end),
                 isLeakedToolCallJSON(String(chars[i ... end]))
             {
                 i = end + 1
@@ -93,11 +111,60 @@ public enum StringCleaning {
         return String(output).trimmingCharacters(in: .whitespacesAndNewlines)
     }
 
+    /// Tokens whose presence is necessary for a `{...}` block to satisfy
+    /// `isLeakedToolCallJSON`: the two key literals, plus `\u` because a JSON
+    /// unicode escape inside a key could spell either of them.
+    private static let leakKeyTokens: [[Character]] = [
+        Array("\"action\""), Array("\"name\""), Array("\\u"),
+    ]
+
+    /// Sorted start indices (in `chars`) of every `leakKeyTokens` occurrence.
+    private static func leakKeyTokenStarts(in chars: [Character]) -> [Int] {
+        var starts: [Int] = []
+        var i = 0
+        while i < chars.count {
+            let c = chars[i]
+            if c == "\"" || c == "\\" {
+                for token in leakKeyTokens where token[0] == c {
+                    let end = i + token.count
+                    if end <= chars.count, chars[i ..< end].elementsEqual(token) {
+                        starts.append(i)
+                        break
+                    }
+                }
+            }
+            i += 1
+        }
+        return starts
+    }
+
+    /// Whether any key token starts in the open interval `(open, close)`.
+    /// `starts` is sorted; binary search for the first entry > `open`.
+    private static func containsKeyStart(_ starts: [Int], after open: Int, before close: Int) -> Bool {
+        var lo = 0
+        var hi = starts.count
+        while lo < hi {
+            let mid = (lo + hi) / 2
+            if starts[mid] <= open { lo = mid + 1 } else { hi = mid }
+        }
+        return lo < starts.count && starts[lo] < close
+    }
+
     /// Index of the `}` that closes the `{` at `start`, respecting string
     /// literals so braces inside JSON string values don't miscount. Returns
     /// nil if the block never closes.
-    private static func matchingBraceIndex(_ chars: [Character], start: Int) -> Int? {
-        var depth = 0
+    ///
+    /// `cache` maps `{` index → closing index (`-1` = never closes). One scan
+    /// resolves not just `start` but every `{` it passes outside a string
+    /// literal: a scan starting at such a `{` sees the same characters with
+    /// the same string state and a depth offset by a constant, so it closes
+    /// exactly where this scan's stack pops it. Braces met inside a string
+    /// are not cached — their own scan would start with inverted string
+    /// state. This keeps unbalanced code (a stray `'{'` char literal) linear
+    /// instead of re-scanning to the end from every brace.
+    private static func matchingBraceIndex(_ chars: [Character], start: Int, cache: inout [Int: Int]) -> Int? {
+        if let hit = cache[start] { return hit >= 0 ? hit : nil }
+        var open: [Int] = []
         var inString = false
         var escaped = false
         var i = start
@@ -114,13 +181,14 @@ public enum StringCleaning {
             } else if c == "\"" {
                 inString = true
             } else if c == "{" {
-                depth += 1
+                open.append(i)
             } else if c == "}" {
-                depth -= 1
-                if depth == 0 { return i }
+                if let opened = open.popLast() { cache[opened] = i }
+                if open.isEmpty { return i }
             }
             i += 1
         }
+        for opened in open { cache[opened] = -1 }
         return nil
     }
 
```

**File**: `Packages/OsaurusCore/Views/Chat/MessageTableRepresentable.swift` (modified, +62/-40)
```diff
@@ -657,6 +657,12 @@ extension MessageTableRepresentable {
                 self?.dequeueAndConfigure(tableView: tableView, row: row, blockId: itemId)
                     ?? NSView()
             }
+            // Snapshots are applied with `animatingDifferences: true` so AppKit
+            // diffs rows (insert/remove/move, cell reuse). On AppKit `false`
+            // means `reloadData`, which rebuilds every visible cell and hung the
+            // main thread on long conversations. An empty animation set keeps
+            // the incremental path without any visible row animation.
+            dataSource?.defaultRowAnimation = []
             tableView.delegate = self
         }
 
@@ -1185,50 +1191,66 @@ extension MessageTableRepresentable {
             snapshot.appendSections([.main])
             snapshot.appendItems(uniqueIds, toSection: .main)
 
-            dataSource?.apply(snapshot, animatingDifferences: false) { [weak self] in
-                guard let self else { return }
-
-                if !stableChangedIds.isEmpty {
-                    var reconfiguredRows = IndexSet()
-                    for id in stableChangedIds {
-                        if let row = self.blockIds.firstIndex(of: id),
-                            let block = self.blockLookup[id],
-                            let cell = self.tableView?.view(
-                                atColumn: 0,
-                                row: row,
-                                makeIfNecessary: false
-                            ) as? NativeMessageCellView
-                        {
-                            self.heightCache.removeValue(forKey: id)
-                            self.configureCell(cell, with: block)
-                            reconfiguredRows.insert(row)
-                        }
-                    }
-                    if !reconfiguredRows.isEmpty {
-                        self.noteRowHeightsChanged(reconfiguredRows)
+            // `animatingDifferences: true` + `defaultRowAnimation = []` (see
+            // setupDataSource): incremental insert/remove/move with cell reuse
+            // and no visible animation. AppKit applies the diff synchronously,
+            // so the follow-up work runs straight after the call returns.
+            //
+            // Deliberately NOT in the apply completion handler: AppKit invokes
+            // that handler from inside its own `endUpdates`, and any
+            // `noteHeightOfRows` issued from there (the reconfigure and the
+            // post-streaming height fix both do) opens a nested
+            // begin/endUpdates that re-runs the same completion — unbounded
+            // recursion and a stack overflow. Running here, outside AppKit's
+            // update transaction, the row updates are already committed and
+            // `noteHeightOfRows` is an ordinary call.
+            dataSource?.apply(snapshot, animatingDifferences: true)
+
+            if !stableChangedIds.isEmpty {
+                var reconfiguredRows = IndexSet()
+                for id in stableChangedIds {
+                    if let row = blockIds.firstIndex(of: id),
+                        let block = blockLookup[id],
+                        let cell = tableView?.view(
+                            atColumn: 0,
+                            row: row,
+                            makeIfNecessary: false
+                        ) as? NativeMessageCellView
+                    {
+                        heightCache.removeValue(forKey: id)
+                        configureCell(cell, with: block)
+                        reconfiguredRows.insert(row)
                     }
                 }
+                if !reconfiguredRows.isEmpty {
+                    noteRowHeightsChanged(reconfiguredRows)
+                }
+            }
 
-                self.handlePostSnapshotScroll(
-                    lastAssistantTurnId: lastAssistantTurnId,
-                    autoScrollEnabled: autoScrollEnabled,
-                    wasPinnedToBottom: wasPinnedToBottom,
-                    isStreaming: isStreaming
-                )
+            // Unlike `reloadData`, the incremental apply defers the
+            // document-frame recalculation; the scroll handlers below read
+            // `documentView.frame.height`, so tile now.
+            tableView?.tile()
 
-                // When streaming ends, the last throttled height measurement
-                // may not reflect the final content. Reconfigure the cell and
-                // schedule a deferred re-measurement after the hosting view's
-                // layout has settled, then re-pin scroll position.
-                if streamingJustEnded, let streamId = previousStreamingBlockId,
-                    let row = self.blockIds.firstIndex(of: streamId)
-                {
-                    self.schedulePostStreamingHeightFix(
-                        streamId: streamId,
-                        row: row,
-                        was
```

---

### Incident Patch 5: `c2088899` (2026-10-05)
**Commit Message**: Pin MTP head-history and lazy-verifier PLE state fixes (#3005)

* Pin confirmed MTP head-history preservation fix

* Pin lazy-verifier PLE state fix alongside head history fix

---------

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+        "revision" : "2b05d39a6f43c1bc8789112fc92baa426d84c833"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+        "revision": "2b05d39a6f43c1bc8789112fc92baa426d84c833"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+            revision: "2b05d39a6f43c1bc8789112fc92baa426d84c833"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+        let expectedRevision = "2b05d39a6f43c1bc8789112fc92baa426d84c833"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+        let expectedRuntimeHardenedRevision = "2b05d39a6f43c1bc8789112fc92baa426d84c833"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
+        "revision": "2b05d39a6f43c1bc8789112fc92baa426d84c833"
       }
     },
     {
```

---

### Incident Patch 6: `3b6ea83b` (2026-10-05)
**Commit Message**: Pin request-scoped native MTP warmup fix (#3004)

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+        "revision" : "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+        "revision": "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+            revision: "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+        let expectedRevision = "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+        let expectedRuntimeHardenedRevision = "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "b53859a930cfecfb792e4ecf90f1a158e08c9383"
+        "revision": "9836009de7f4130f0b2d9aed8ae1177d17a97a53"
       }
     },
     {
```

---

### Incident Patch 7: `2fe5cc3f` (2026-10-04)
**Commit Message**: Pin qualified GLM required-tool cache restoration (#3002)

Consume qualified GLM required-tool cache checkpoints

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+        "revision" : "b53859a930cfecfb792e4ecf90f1a158e08c9383"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+        "revision": "b53859a930cfecfb792e4ecf90f1a158e08c9383"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+            revision: "b53859a930cfecfb792e4ecf90f1a158e08c9383"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+        let expectedRevision = "b53859a930cfecfb792e4ecf90f1a158e08c9383"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+        let expectedRuntimeHardenedRevision = "b53859a930cfecfb792e4ecf90f1a158e08c9383"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "4a804e5ebbbdbfda4141dbe1e9970abb99c4e400"
+        "revision": "b53859a930cfecfb792e4ecf90f1a158e08c9383"
       }
     },
     {
```

---

### Incident Patch 8: `4a33301b` (2026-10-04)
**Commit Message**: Reuse canonical stable-prefix cache checkpoints (#3000)

Pin the tested runtime checkpoint reuse fix after native tool continuation, capped restart, and exact-head CI validation.

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "c12652749d0240bad8714676ec1560aac94e9e4e"
+        "revision" : "2bed91afab9d0788af8fdb3fd133de54d411bc91"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "c12652749d0240bad8714676ec1560aac94e9e4e"
+        "revision": "2bed91afab9d0788af8fdb3fd133de54d411bc91"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "c12652749d0240bad8714676ec1560aac94e9e4e"
+            revision: "2bed91afab9d0788af8fdb3fd133de54d411bc91"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "c12652749d0240bad8714676ec1560aac94e9e4e"
+        let expectedRevision = "2bed91afab9d0788af8fdb3fd133de54d411bc91"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "c12652749d0240bad8714676ec1560aac94e9e4e"
+        let expectedRuntimeHardenedRevision = "2bed91afab9d0788af8fdb3fd133de54d411bc91"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "c12652749d0240bad8714676ec1560aac94e9e4e"
+        "revision": "2bed91afab9d0788af8fdb3fd133de54d411bc91"
       }
     },
     {
```

---

### Incident Patch 9: `b248e21b` (2026-10-04)
**Commit Message**: Render agent avatars at exact pixel size so they stay crisp (#2998)

**File**: `Packages/OsaurusCore/Services/MemoryPressureResponder.swift` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ public final class MemoryPressureResponder: @unchecked Sendable {
         LaTeXRenderer.shared.clearCache()
         SymbolImageCache.clear()
         NativeHeaderView.clearMonogramCache()
+        AvatarBitmapRenderer.shared.removeAll()
         Task {
             await ThemePreviewImageCache.shared.removeAll()
             await ModelRuntime.shared.trimFreedBufferCacheUnderMemoryPressure()
```

**File**: `Packages/OsaurusCore/Tests/Agent/AvatarBitmapRendererTests.swift` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+//
+//  AvatarBitmapRendererTests.swift
+//  OsaurusCoreTests
+//
+//  Avatars are drawn 1:1 from a bitmap pre-rendered at the display's pixel
+//  size; anything else lets Core Animation minify the 1000px+ source art at
+//  draw time and the outlines go soft. These pin the output geometry, the
+//  filter quality, the cache, and custom-avatar invalidation.
+//
+//  `swift build` copies `Assets.xcassets` uncompiled, so the bundled mascots
+//  only resolve under xcodebuild; mascot-backed cases are gated on that.
+//
+
+import AppKit
+import Foundation
+import Testing
+
+@testable import OsaurusCore
+
+private let mascotAssetsAvailable =
+    AvatarBitmapRenderer.shared.image(mascot: .green, pointSize: 1, scale: 1) != nil
+
+@Suite("Avatar bitmap renderer")
+struct AvatarBitmapRendererTests {
+
+    private func pixelDimensions(_ image: NSImage) -> (Int, Int)? {
+        guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
+        return (cg.width, cg.height)
+    }
+
+    private func bitmap(width: Int, height: Int, draw: (NSRect) -> Void) throws -> NSBitmapImageRep {
+        let rep = try #require(
+            NSBitmapImageRep(
+                bitmapDataPlanes: nil,
+                pixelsWide: width,
+                pixelsHigh: height,
+                bitsPerSample: 8,
+                samplesPerPixel: 4,
+                hasAlpha: true,
+                isPlanar: false,
+                colorSpaceName: .deviceRGB,
+                bytesPerRow: 0,
+                bitsPerPixel: 0
+            )
+        )
+        NSGraphicsContext.saveGraphicsState()
+        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
+        draw(NSRect(x: 0, y: 0, width: width, height: height))
+        NSGraphicsContext.restoreGraphicsState()
+        return rep
+    }
+
+    private func solid(width: Int, height: Int, color: NSColor) throws -> NSBitmapImageRep {
+        try bitmap(width: width, height: height) { rect in
+            color.setFill()
+            rect.fill()
+        }
+    }
+
+    /// Mirrors a compiled mascot imageset: one image with 1x and 2x reps.
+    private func mascotLikeImage() throws -> NSImage {
+        let image = NSImage(size: NSSize(width: 1080, height: 1080))
+        image.addRepresentation(try solid(width: 1080, height: 1080, color: .green))
+        image.addRepresentation(try solid(width: 2160, height: 2160, color: .green))
+        return image
+    }
+
+    private func writePNG(_ rep: NSBitmapImageRep, to url: URL) throws {
+        let data = try #require(rep.representation(using: .png, properties: [:]))
+        try data.write(to: url)
+    }
+
+    private func temporaryURL() -> URL {
+        FileManager.default.temporaryDirectory
+            .appendingPathComponent("avatar-renderer-\(UUID().uuidString).png")
+    }
+
+    @Test(arguments: [16.0, 26.0, 108.0], [1.0, 2.0])
+    func rendersAtExactPixelSize(points: Double, scale: Double) throws {
+        let pixels = AvatarBitmapRenderer.pixelSize(pointSize: points, scale: scale)
+        let image = try #require(AvatarBitmapRenderer.render(try mascotLikeImage(), pixels: pixels, scale: scale))
+        let (width, height) = try #require(pixelDimensions(image))
+        #expect(width == Int((points * scale).rounded()))
+        #expect(height == width)
+        #expect(image.size == NSSize(width: CGFloat(width) / scale, height: CGFloat(width) / scale))
+    }
+
+    @Test func fractionalPointSizeRoundsToWholePixels() {
+        #expect(AvatarBitmapRenderer.pixelSize(pointSize: 21.84, scale: 2) == 44)
+        #expect(AvatarBitmapRenderer.pixelSize(pointSize: 0.1, scale: 1) == 1)
+    }
+
+    /// 1px black/white stripes minified 40x must average to mid-gray
+    /// everywhere. Point or bilinear sampling (what the GPU does when a huge
+    /// bitmap is drawn into a small frame) lands on arbitrary stripes instead.
+    @Test func largeDownscaleAveragesInsteadOfAliasing() throws {
+        let stripes = try bitmap(width: 2080, height: 2080) { rect in
+            NSColor.white.setFill()
+            rect.fill()
+            NSColor.black.setFill()
+            for x in stride(from: 0, to: Int(rect.width), by: 2) {
+                NSRect(x: x, y: 0, width: 1, height: Int(rect.height)).fill()
+            }
+        }
+        let source = NSImage(size: stripes.size)
+        source.addRepresentation(stripes)
+
+        let image = try #require(AvatarBitmapRenderer.render(source, pixels: 52, scale: 2))
+        let output = try #require(image.representations.first.flatMap { rep -> NSBitmapImageRep? in
+            rep.cgImage(forProposedRect: nil, context: nil, hints: nil).map(NSBitmapImageRep.init(cgImage:))
+        })
+        for x in 2 ..< 50 {
+            for y in 2 ..< 50 {
+                let white = try #require(output.colorAt(x: x, y: y)?.usingColorSpace(.deviceGray)?.whiteComponent)
+                #expect(abs(white - 0.5) < 0.12, "pixe
```

**File**: `Packages/OsaurusCore/Views/Agent/AgentAvatarView.swift` (modified, +188/-19)
```diff
@@ -7,6 +7,7 @@
 //
 
 import AppKit
+import Accelerate
 import SwiftUI
 
 /// Catalog of mascot avatars shipped with the app. The `id` is what gets
@@ -82,6 +83,8 @@ struct AgentAvatarView: View {
     /// list/sidebar avatars where the inset reads as more iconic.
     var bleedsToEdge: Bool = false
 
+    @Environment(\.displayScale) private var displayScale
+
     var body: some View {
         ZStack {
             Circle()
@@ -93,22 +96,22 @@ struct AgentAvatarView: View {
                     )
                 )
 
-            if let url = customImageURL, let nsImage = AvatarImageCache.shared.image(for: url) {
+            if let url = customImageURL,
+                let nsImage = AvatarBitmapRenderer.shared.image(
+                    customURL: url,
+                    pointSize: diameter,
+                    scale: displayScale
+                )
+            {
+                Image(nsImage: nsImage)
+            } else if let mascot = mascotId.flatMap(AgentMascot.init(rawValue:)),
+                let nsImage = AvatarBitmapRenderer.shared.image(
+                    mascot: mascot,
+                    pointSize: mascotPointSize,
+                    scale: displayScale
+                )
+            {
                 Image(nsImage: nsImage)
-                    .resizable()
-                    .interpolation(.high)
-                    .antialiased(true)
-                    .scaledToFill()
-            } else if let mascot = mascotId.flatMap(AgentMascot.init(rawValue:)) {
-                let mascotImage = Image(mascot.assetName, bundle: .module)
-                    .resizable()
-                    .interpolation(.high)
-                    .antialiased(true)
-                if bleedsToEdge {
-                    mascotImage.scaledToFill()
-                } else {
-                    mascotImage.scaledToFit().padding(diameter * 0.08)
-                }
             } else {
                 Text(name.isEmpty ? "?" : name.prefix(1).uppercased())
                     .font(.system(size: monogramFontSize, weight: .bold, design: .rounded))
@@ -121,6 +124,18 @@ struct AgentAvatarView: View {
         .frame(width: diameter, height: diameter)
         .clipShape(Circle())
     }
+
+    /// Mascot edge length in points: full bleed, or inset 8% per side. The
+    /// inset is snapped so the leftover margin is a whole number of pixels on
+    /// each side; a half-pixel offset would make the GPU resample the bitmap.
+    private var mascotPointSize: CGFloat {
+        guard !bleedsToEdge else { return diameter }
+        let scale = max(displayScale, 1)
+        let outerPixels = (diameter * scale).rounded()
+        var innerPixels = (outerPixels * 0.84).rounded()
+        if Int(outerPixels - innerPixels) % 2 != 0 { innerPixels -= 1 }
+        return max(innerPixels, 1) / scale
+    }
 }
 
 // MARK: - Avatar Image Cache
@@ -131,7 +146,7 @@ struct AgentAvatarView: View {
 final class AvatarImageCache: @unchecked Sendable {
     static let shared = AvatarImageCache()
 
-    private struct Entry {
+    struct Entry {
         let mtime: Date
         let image: NSImage
     }
@@ -140,27 +155,181 @@ final class AvatarImageCache: @unchecked Sendable {
     private var entries: [String: Entry] = [:]
 
     func image(for url: URL) -> NSImage? {
+        entry(for: url)?.image
+    }
+
+    func entry(for url: URL) -> Entry? {
         let path = url.path
         let mtime =
             (try? FileManager.default.attributesOfItem(atPath: path)[.modificationDate] as? Date) ?? .distantPast
 
         lock.lock()
         if let hit = entries[path], hit.mtime == mtime {
             lock.unlock()
-            return hit.image
+            return hit
         }
         lock.unlock()
 
         guard let image = NSImage(contentsOf: url) else { return nil }
+        let entry = Entry(mtime: mtime, image: image)
         lock.lock()
-        entries[path] = Entry(mtime: mtime, image: image)
+        entries[path] = entry
         lock.unlock()
-        return image
+        return entry
     }
 
     func invalidate(url: URL) {
         lock.lock()
         entries.removeValue(forKey: url.path)
         lock.unlock()
+        AvatarBitmapRenderer.shared.invalidate(url: url)
+    }
+}
+
+// MARK: - Avatar Bitmap Renderer
+
+/// Pre-renders avatar artwork at the exact pixel size it is displayed at.
+/// The bundled mascots are 1000px+ bitmaps shown in 16–108pt circles; letting
+/// Core Animation minify them at draw time (linear sampling, no mipmaps)
+/// leaves the outlines soft and jagged. Resampling once with a high-quality
+/// filter and drawing the result 1:1 keeps them crisp.
+///
+/// Output is always square: the source is center-cropped (aspect fill) and
+/// resampled to `round(pointSize * scale)` pixels. The returned image's point
+/// size is `pixels / scale`, so callers must draw it unscaled.
+final class AvatarBitmapRenderer: @unchecked Sendable {
+    static let shared = AvatarBitmapRende
```

**File**: `Packages/OsaurusCore/Views/Chat/NativeMessageCellView.swift` (modified, +71/-17)
```diff
@@ -283,27 +283,20 @@ final class NativeHeaderView: NSView {
         // monogram) so the chat header is visually consistent regardless of
         // which avatar mode the user picked, unless the theme opts out via
         // `showInlineAvatar`. User messages hide the avatar.
-        let resolved: NSImage? = {
-            guard role == .assistant, theme.showInlineAvatar else { return nil }
-            if let path = customAvatarPath, !path.isEmpty {
-                let url = URL(fileURLWithPath: path)
-                if let img = AvatarImageCache.shared.image(for: url) { return img }
-            }
-            if let avatar, !avatar.isEmpty,
-                let mascot = Bundle.module.image(forResource: "osaurus-avatar-\(avatar)")
-            {
-                return mascot
-            }
-            return Self.monogramImage(
+        avatarSource =
+            role == .assistant && theme.showInlineAvatar
+            ? AvatarSource(
                 name: name,
+                avatar: avatar,
+                customAvatarPath: customAvatarPath,
                 tint: NSColor(theme.accentColor),
-                background: NSColor(theme.secondaryText).withAlphaComponent(0.12),
-                size: themeSize
+                background: NSColor(theme.secondaryText).withAlphaComponent(0.12)
             )
-        }()
+            : nil
+        let resolved = resolveAvatarImage()
         avatarImageView.image = resolved
-        // Custom + mascot images are scaled to fit; monograms are pre-rendered
-        // at the avatar size so any scaling mode is fine.
+        // Every avatar kind is pre-rendered at the view's exact size, so this
+        // only matters as a safety net and never scales in practice.
         avatarImageView.imageScaling = .scaleProportionallyUpOrDown
         let showAvatar = resolved != nil
         avatarImageView.isHidden = !showAvatar
@@ -324,6 +317,67 @@ final class NativeHeaderView: NSView {
         setHovered(isHovered, animated: false)
     }
 
+    private struct AvatarSource {
+        let name: String
+        let avatar: String?
+        let customAvatarPath: String?
+        let tint: NSColor
+        let background: NSColor
+    }
+
+    /// Inputs of the current avatar, kept so the bitmap can be re-rendered
+    /// when the view moves to a display with a different backing scale.
+    private var avatarSource: AvatarSource?
+    private var avatarRenderScale: CGFloat = 0
+
+    private var backingScale: CGFloat {
+        window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 2
+    }
+
+    /// Custom > mascot > monogram, rendered at `currentAvatarSize` for the
+    /// current backing scale. Nil when the row shows no avatar.
+    private func resolveAvatarImage() -> NSImage? {
+        guard let source = avatarSource else { return nil }
+        let scale = backingScale
+        avatarRenderScale = scale
+        let renderer = AvatarBitmapRenderer.shared
+        if let path = source.customAvatarPath, !path.isEmpty,
+            let img = renderer.image(
+                customURL: URL(fileURLWithPath: path),
+                pointSize: currentAvatarSize,
+                scale: scale
+            )
+        {
+            return img
+        }
+        if let mascot = source.avatar.flatMap(AgentMascot.init(rawValue:)),
+            let img = renderer.image(mascot: mascot, pointSize: currentAvatarSize, scale: scale)
+        {
+            return img
+        }
+        return Self.monogramImage(
+            name: source.name,
+            tint: source.tint,
+            background: source.background,
+            size: currentAvatarSize
+        )
+    }
+
+    override func viewDidChangeBackingProperties() {
+        super.viewDidChangeBackingProperties()
+        refreshAvatarForBackingScale()
+    }
+
+    override func viewDidMoveToWindow() {
+        super.viewDidMoveToWindow()
+        refreshAvatarForBackingScale()
+    }
+
+    private func refreshAvatarForBackingScale() {
+        guard avatarSource != nil, window != nil, backingScale != avatarRenderScale else { return }
+        avatarImageView.image = resolveAvatarImage()
+    }
+
     /// Renders a monogram avatar (initial-on-tinted-circle) into a cached
     /// NSImage so the inline header has something to show when no mascot or
     /// custom image is configured. Cached by (initial, tint, size) — themes
```

**File**: `Packages/OsaurusCore/Views/Common/SharedHeaderComponents.swift` (modified, +5/-6)
```diff
@@ -312,6 +312,7 @@ struct AgentPill: View {
     @State private var isPopoverPresented = false
     @StateObject private var keyboard = AgentPickerKeyboardController()
     @Environment(\.theme) private var theme
+    @Environment(\.displayScale) private var displayScale
 
     // MARK: - Keyboard Navigation Items
 
@@ -399,10 +400,8 @@ struct AgentPill: View {
             // built-in default agent gets its branded image (e.g. the
             // green dinosaur). Falls back to the generic person glyph
             // when the agent has no `avatar` id or the asset is missing.
-            if let mascot = builtInMascotImage(for: agent) {
+            if let mascot = builtInMascotImage(for: agent, size: size) {
                 Image(nsImage: mascot)
-                    .resizable()
-                    .aspectRatio(contentMode: .fill)
                     .frame(width: size, height: size)
                     .clipShape(Circle())
             } else {
@@ -428,9 +427,9 @@ struct AgentPill: View {
         }
     }
 
-    private func builtInMascotImage(for agent: Agent) -> NSImage? {
-        guard let avatar = agent.avatar, !avatar.isEmpty else { return nil }
-        return Bundle.module.image(forResource: "osaurus-avatar-\(avatar)")
+    private func builtInMascotImage(for agent: Agent, size: CGFloat) -> NSImage? {
+        guard let mascot = agent.avatar.flatMap(AgentMascot.init(rawValue:)) else { return nil }
+        return AvatarBitmapRenderer.shared.image(mascot: mascot, pointSize: size, scale: displayScale)
     }
 
     /// A remote agent's mascot (or name monogram) with a small transport badge
```

**File**: `Packages/OsaurusCore/Views/Theme/ThemeEditorView.swift` (modified, +3/-3)
```diff
@@ -1513,6 +1513,8 @@ private struct ThemeColorPickerButton: View {
 struct ThemeChatPreview: View {
     let theme: CustomTheme
 
+    @Environment(\.displayScale) private var displayScale
+
     /// Decoded copy of the theme's background image, refreshed off the
     /// main actor whenever the base64 string changes.
     @State private var backgroundImage: NSImage?
@@ -1613,10 +1615,8 @@ struct ThemeChatPreview: View {
 
     @ViewBuilder
     private func previewAvatar(size: CGFloat, name: String, tint: Color) -> some View {
-        if let mascot = Bundle.module.image(forResource: "osaurus-avatar-green") {
+        if let mascot = AvatarBitmapRenderer.shared.image(mascot: .green, pointSize: size, scale: displayScale) {
             Image(nsImage: mascot)
-                .resizable()
-                .aspectRatio(contentMode: .fill)
                 .frame(width: size, height: size)
                 .clipShape(Circle())
                 .overlay(Circle().stroke(c(theme.colors.secondaryText).opacity(0.35), lineWidth: 1))
```

---

### Incident Patch 10: `8cc221e7` (2026-10-04)
**Commit Message**: Pin native MTP history and sampled verification fixes (#2994)

* Pin confirmed native MTP head-history correction

* Pin sampled native MTP committed-token crash fix

---------

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "2f180d9a7eb8621263967beb3a21212ce04660eb"
+        "revision" : "6715cfb3a2c312ef1844c821803c07190fe58474"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "2f180d9a7eb8621263967beb3a21212ce04660eb"
+        "revision": "6715cfb3a2c312ef1844c821803c07190fe58474"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "2f180d9a7eb8621263967beb3a21212ce04660eb"
+            revision: "6715cfb3a2c312ef1844c821803c07190fe58474"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "2f180d9a7eb8621263967beb3a21212ce04660eb"
+        let expectedRevision = "6715cfb3a2c312ef1844c821803c07190fe58474"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "2f180d9a7eb8621263967beb3a21212ce04660eb"
+        let expectedRuntimeHardenedRevision = "6715cfb3a2c312ef1844c821803c07190fe58474"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "2f180d9a7eb8621263967beb3a21212ce04660eb"
+        "revision": "6715cfb3a2c312ef1844c821803c07190fe58474"
       }
     },
     {
```

---

### Incident Patch 11: `98b1fec1` (2026-10-04)
**Commit Message**: Pin Qwen4Exp JANGH runtime and media cache fixes (#2991)

* Pin Qwen4Exp JANGH runtime for Allosaurus

* Consume Qwen4Exp JANGH media cache fixes

---------

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "9f4e551e77725730d60b09de13cce5dba9efcc29"
+        "revision" : "2f180d9a7eb8621263967beb3a21212ce04660eb"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "9f4e551e77725730d60b09de13cce5dba9efcc29"
+        "revision": "2f180d9a7eb8621263967beb3a21212ce04660eb"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ let package = Package(
         // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "9f4e551e77725730d60b09de13cce5dba9efcc29"
+            revision: "2f180d9a7eb8621263967beb3a21212ce04660eb"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "9f4e551e77725730d60b09de13cce5dba9efcc29"
+        let expectedRevision = "2f180d9a7eb8621263967beb3a21212ce04660eb"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "9f4e551e77725730d60b09de13cce5dba9efcc29"
+        let expectedRuntimeHardenedRevision = "2f180d9a7eb8621263967beb3a21212ce04660eb"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "9f4e551e77725730d60b09de13cce5dba9efcc29"
+        "revision": "2f180d9a7eb8621263967beb3a21212ce04660eb"
       }
     },
     {
```

---

### Incident Patch 12: `cce2803d` (2026-10-02)
**Commit Message**: Fix: NativeAssistantActionsView NSButton init causes main thread hang (#2977)

Co-authored-by: sentry[bot] <39604003+sentry[bot]@users.noreply.github.com>

**File**: `Packages/OsaurusCore/Views/Chat/NativeMessageCellView.swift` (modified, +2/-1)
```diff
@@ -670,7 +670,7 @@ final class NativeAssistantActionsView: NSView {
     /// "3 files changed · View changes" — the end-of-turn entry point into
     /// the File Changes panel. Hidden until the journal reports this turn
     /// recorded something; refreshed when history changes (e.g. a revert).
-    private let fileChangesButton = NSButton(title: "", target: nil, action: nil)
+    private let fileChangesButton = NSButton(frame: .zero)
     private var fileChangesSummary: FileChangeTurnSummary?
     private var fileChangesLookupTurnId: UUID?
     nonisolated(unsafe) private var fileChangesObservation: NSObjectProtocol?
@@ -792,6 +792,7 @@ final class NativeAssistantActionsView: NSView {
             overflowButton.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),
         ])
 
+        fileChangesButton.title = ""
         fileChangesButton.translatesAutoresizingMaskIntoConstraints = false
         fileChangesButton.isBordered = false
         fileChangesButton.bezelStyle = .inline
```

---

### Incident Patch 13: `1118c8ea` (2026-10-02)
**Commit Message**: Fit resident delegation context to available memory (#2973)

fix: fit resident delegation context to available memory

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `Packages/OsaurusCore/Services/ModelRuntime.swift` (modified, +32/-0)
```diff
@@ -4022,6 +4022,38 @@ public actor ModelRuntime {
         )
     }
 
+    /// Price a memory-fitted history window from the SAME recovered sample.
+    /// The caller must install the returned ceiling on the child contract
+    /// before using these facts for admission. Unknown/cold/pressured models
+    /// retain the existing refusal policy.
+    func affordableSubagentContext(
+        for modelName: String,
+        requested: Int,
+        minimum: Int,
+        memory: SubagentBatchMemoryFacts
+    ) -> (positions: Int, facts: SubagentBatchMemoryFacts)? {
+        guard let found = ModelManager.findInstalledModel(named: modelName),
+            let directory = Self.findLocalDirectory(forModelId: found.id),
+            let footprint = memory.targetLoadFootprintBytes,
+            footprint > 0, footprint <= UInt64(Int64.max),
+            found.name.caseInsensitiveCompare(memory.canonicalModelKey) == .orderedSame
+        else { return nil }
+        func price(_ positions: Int) -> UInt64? {
+            Self.nonnegativeUInt64(Self.estimatedKVHeadroomBytes(
+                forWeights: Int64(footprint),
+                modelDirectory: directory,
+                modelName: found.name,
+                kvRetentionCap: nil,
+                requestPositionLimit: positions
+            ))
+        }
+        guard let positions = SubagentBatchAdmissionPlanner.affordablePositionCeiling(
+            requested: requested, minimum: minimum, memory: memory,
+            headroomForPositions: price
+        ), let bytes = price(positions) else { return nil }
+        return (positions, memory.pricingChildHeadroom(bytes))
+    }
+
     private func sampleSubagentBatchMemoryFacts(
         for modelName: String,
         residencyPlan: ResidencyPlan,
```

**File**: `Packages/OsaurusCore/Subagent/Kinds/TextSubagentKind.swift` (modified, +32/-1)
```diff
@@ -28,7 +28,7 @@
 import Foundation
 
 final class TextSubagentKind:
-    SubagentKind, SubagentPostAdmissionResidencyPlanning, @unchecked Sendable
+    SubagentKind, SubagentPostAdmissionResidencyPlanning, SubagentContextAdmission, @unchecked Sendable
 {
     let capability = SubagentCapabilityRegistry.spawn
 
@@ -156,6 +156,24 @@ final class TextSubagentKind:
     /// prices it. Internal (not private) so regression tests can inject a
     /// contract and assert the estimator prices exactly its ceiling.
     var delegatedContract: DelegatedRunContract?
+    /// Keep enough room for the actual composed seed and one full tool round.
+    /// Further rounds may compact history, as they do at the model window.
+    var minimumAdmissionContextPositions: Int?
+    private(set) var admissionContextWasMemoryFitted = false
+
+    func tightenAdmissionContextPositions(to limit: Int) -> Bool {
+        guard let contract = delegatedContract,
+            let minimum = minimumAdmissionContextPositions,
+            limit >= minimum, limit < contract.contextPositions
+        else { return false }
+        delegatedContract = DelegatedRunContract(
+            responseTokens: contract.responseTokens,
+            assistantTurns: contract.assistantTurns,
+            contextPositions: limit
+        )
+        admissionContextWasMemoryFitted = true
+        return true
+    }
     private var systemPrompt: String = ""
     private var budgets = SubagentBudgets()
 
@@ -523,6 +541,8 @@ final class TextSubagentKind:
         self.temperature = nil
         self.residencyPlan = .none
         self.delegatedContract = nil
+        self.minimumAdmissionContextPositions = nil
+        self.admissionContextWasMemoryFitted = false
         return ResolvedModel(
             name: (pinnedModel?.isEmpty == false ? pinnedModel : nil) ?? Self.workspaceHostModelLabel,
             id: nil,
@@ -679,6 +699,17 @@ final class TextSubagentKind:
                 toolEnabled: !composed.tools.isEmpty,
                 resolvedContextWindow: window
             )
+            self.admissionContextWasMemoryFitted = false
+            var firstRoundBudgets = budgets
+            firstRoundBudgets.maxDelegateTurns = 1
+            self.minimumAdmissionContextPositions = DelegatedRunContract.derive(
+                seedCharacters: dispatchedPrompt.count,
+                systemPromptCharacters: composed.prompt.count,
+                toolSchemaTokens: composed.toolTokens,
+                budgets: firstRoundBudgets,
+                toolEnabled: !composed.tools.isEmpty,
+                resolvedContextWindow: window
+            )?.contextPositions
         }
         return ResolvedModel(
             name: resolved.model,
```

**File**: `Packages/OsaurusCore/Subagent/SubagentBatchAdmissionPlanner.swift` (modified, +61/-0)
```diff
@@ -205,6 +205,24 @@ struct SubagentBatchMemoryFacts: Sendable, Equatable {
         requestBoundedChildHeadroomBytes ?? perActiveChildHeadroomBytes
     }
 
+    /// Reprice a stricter execution contract without taking another host
+    /// sample or changing allocator, pressure, residency or load-budget facts.
+    func pricingChildHeadroom(_ bytes: UInt64) -> Self {
+        Self(
+            canonicalModelKey: canonicalModelKey,
+            targetAlreadyResident: targetAlreadyResident,
+            targetLoadFootprintBytes: targetLoadFootprintBytes,
+            perActiveChildHeadroomBytes: perActiveChildHeadroomBytes,
+            requestBoundedChildHeadroomBytes: bytes,
+            reclaimableBytes: reclaimableBytes,
+            releasableParentBytes: releasableParentBytes,
+            resolvedLoadBudgetBytes: resolvedLoadBudgetBytes,
+            osHeadroomBytes: osHeadroomBytes,
+            memoryPressure: memoryPressure,
+            allocatorCacheAllowanceBytes: allocatorCacheAllowanceBytes
+        )
+    }
+
     /// A bounded request reusing a resident model allocates child state, not
     /// another OS/app working set. The host sample already excludes resident
     /// anonymous, wired and compressed pages; the child estimate includes KV,
@@ -290,6 +308,16 @@ struct SubagentBatchAdmissionPlan: Sendable, Equatable {
     /// The policy used for THIS decision, not a later settings snapshot.
     /// With safety off, ramSlots is diagnostic only and cannot veto a child.
     var ramSafetyEnabled = true
+    var memoryFittedContextPositions: Int? = nil
+
+    mutating func serializeMemoryFittedContext(jobCount: Int, positions: Int) {
+        memoryFittedContextPositions = positions
+        localCapacity = min(localCapacity, 1)
+        localParallelism = min(localParallelism, 1)
+        localSubwaveSizes = SubagentBatchAdmissionPlanner.subwaveSizes(
+            jobCount: jobCount, slots: localParallelism
+        )
+    }
 
     var memoryDiagnostics: [String: Any] {
         var result: [String: Any] = [
@@ -298,6 +326,9 @@ struct SubagentBatchAdmissionPlan: Sendable, Equatable {
             "ram_slots": ramSlots ?? NSNull(),
             "limited_by": limitingFactors.map(\.rawValue).sorted(),
         ]
+        if let positions = memoryFittedContextPositions {
+            result["memory_fitted_context_positions"] = positions
+        }
         guard let m = memoryFacts else { return result }
         result["canonical_model"] = m.canonicalModelKey
         result["target_already_resident"] = m.targetAlreadyResident
@@ -317,6 +348,36 @@ struct SubagentBatchAdmissionPlan: Sendable, Equatable {
 }
 
 enum SubagentBatchAdmissionPlanner {
+    /// The lifetime output/tool budget need not all remain in KV at once:
+    /// delegated history already compacts at its enforced context window.
+    /// Find the largest stricter window that fits ONE resident child. Never
+    /// shrink a window to manufacture extra fan-out; normal slot accounting
+    /// still serializes siblings and the post-lease check samples again.
+    static func affordablePositionCeiling(
+        requested: Int,
+        minimum: Int,
+        memory: SubagentBatchMemoryFacts,
+        headroomForPositions: (Int) -> UInt64?
+    ) -> Int? {
+        guard minimum > 0, requested > minimum,
+            memory.usesIncrementalResidentAdmission,
+            resolveMemoryCapacity(memory)?.slots == 0
+        else { return nil }
+
+        func fits(_ positions: Int) -> Bool {
+            guard let bytes = headroomForPositions(positions), bytes > 0 else { return false }
+            return (resolveMemoryCapacity(memory.pricingChildHeadroom(bytes))?.slots ?? 0) > 0
+        }
+        guard fits(minimum) else { return nil }
+        var lower = minimum
+        var upper = requested - 1
+        while lower < upper {
+            let midpoint = lower + (upper - lower + 1) / 2
+            if fits(midpoint) { lower = midpoint } else { upper = midpoint - 1 }
+        }
+        return lower
+    }
+
     /// Resolve live facts at the single-child floor before a caller chooses
     /// its wave width. Both direct spawns and batches use this boundary.
     static func memoryFactsAfterReclaimingIfNeeded(
```

**File**: `Packages/OsaurusCore/Subagent/SubagentKind.swift` (modified, +9/-0)
```diff
@@ -115,6 +115,15 @@ protocol SubagentPostAdmissionResidencyPlanning: SubagentKind {
     ) async throws -> ResidencyPlan
 }
 
+/// A child whose history window can be tightened before dispatch. The same
+/// ceiling must be used by RAM pricing, history compaction and the rendered
+/// token check; changing an estimate without changing execution is unsafe.
+protocol SubagentContextAdmission: SubagentKind {
+    var minimumAdmissionContextPositions: Int? { get }
+    var admissionContextWasMemoryFitted: Bool { get }
+    func tightenAdmissionContextPositions(to limit: Int) -> Bool
+}
+
 extension SubagentKind {
     func admissionRequestEstimate() -> SubagentChildRequestEstimate? { nil }
 
```

**File**: `Packages/OsaurusCore/Subagent/SubagentSession.swift` (modified, +29/-1)
```diff
@@ -1334,11 +1334,31 @@ public enum SubagentSession {
         }
         if requested == 1, !rejectUnsafeSingleRun { return .init(capacity: 1) }
 
-        let memoryFacts = await ModelRuntime.shared.subagentBatchMemoryFacts(
+        var memoryFacts = await ModelRuntime.shared.subagentBatchMemoryFacts(
             for: prepared.resolved.name,
             residencyPlan: residencyPlan,
             requestEstimate: prepared.kind.admissionRequestEstimate()
         )
+        // A large lifetime tool budget is a ceiling on work, not a promise
+        // that all 24 maximum-size rounds remain in KV simultaneously. When
+        // even one resident child would be refused, tighten its actual history
+        // window to available memory. Keep the output/turn limits intact, and
+        // preserve all cold-load, pressure, allocator and model-budget gates.
+        if residencyPlan.ramSafetyEnabled,
+            let adaptive = prepared.kind as? any SubagentContextAdmission,
+            let minimum = adaptive.minimumAdmissionContextPositions,
+            let requested = prepared.kind.admissionRequestEstimate()?.boundedPositionBudget(),
+            let memory = memoryFacts,
+            let fitted = await ModelRuntime.shared.affordableSubagentContext(
+                for: prepared.resolved.name, requested: requested,
+                minimum: minimum, memory: memory
+            ), adaptive.tightenAdmissionContextPositions(to: fitted.positions)
+        {
+            memoryFacts = fitted.facts
+            subagentLog.info(
+                "[admission-context] model=\(prepared.resolved.name, privacy: .public) requested_positions=\(requested) enforced_positions=\(fitted.positions) minimum_positions=\(minimum) per_child_bytes=\(fitted.facts.effectiveChildHeadroomBytes ?? 0)"
+            )
+        }
         var plan = SpawnFanOutPolicy.makeLocalAdmissionPlan(
             localJobCount: requested,
             remoteJobCount: 0,
@@ -1352,6 +1372,14 @@ public enum SubagentSession {
         )
         plan.engineOccupancy = engineSnapshot
         plan.engineQueuedAtAdmission = engineWindow.queued
+        // A fitted window rescues one child, never increases fan-out. Keep
+        // this run serialized even if a stepped/fixed estimator or a later
+        // host sample would otherwise report more than one slot.
+        if (prepared.kind as? any SubagentContextAdmission)?.admissionContextWasMemoryFitted == true,
+            let positions = prepared.kind.admissionRequestEstimate()?.boundedPositionBudget()
+        {
+            plan.serializeMemoryFittedContext(jobCount: requested, positions: positions)
+        }
         if case .admitted = plan.verdict {
             return .init(capacity: max(1, plan.localCapacity), plan: plan)
         }
```

**File**: `Packages/OsaurusCore/Tests/Subagent/ResidentDelegationContextAdmissionTests.swift` (added, +304/-0)
```diff
@@ -0,0 +1,304 @@
+import Foundation
+import Testing
+
+@testable import OsaurusCore
+
+@Suite("Resident delegated context admission")
+struct ResidentDelegationContextAdmissionTests {
+    private let requested = 299_770
+    private let minimum = 17_146
+    private let fitted = 287_568
+    private let footprint: UInt64 = 3_662_928_280
+    private let allocator: UInt64 = 1_073_741_824
+
+    /// Exact refusal receipt. The model is already resident, kernel pressure
+    /// is normal, and no parent model is offered as reclaimable memory.
+    private func facts(
+        resident: Bool = true,
+        pressure: SubagentMemoryPressure = .normal,
+        available: UInt64? = 14_395_670_528,
+        budget: UInt64? = 36_077_725_286,
+        allocator: UInt64? = 1_073_741_824,
+        bounded: UInt64? = 13_884_180_480,
+        load: UInt64? = 3_662_928_280
+    ) -> SubagentBatchMemoryFacts {
+        .init(
+            canonicalModelKey: "resident-raptor-regression",
+            targetAlreadyResident: resident,
+            targetLoadFootprintBytes: load,
+            perActiveChildHeadroomBytes: 48_389_160_960,
+            requestBoundedChildHeadroomBytes: bounded,
+            reclaimableBytes: available,
+            releasableParentBytes: 0,
+            resolvedLoadBudgetBytes: budget,
+            osHeadroomBytes: 3_221_225_472,
+            memoryPressure: pressure,
+            allocatorCacheAllowanceBytes: allocator
+        )
+    }
+
+    /// 9 full + 27 sliding layers, 512 sliding rows, K/V 4 x 256 BF16,
+    /// including the estimator's 25% architecture slack.
+    private func price(_ positions: Int) -> UInt64? {
+        guard positions > 0 else { return nil }
+        let (variable, overflow) = UInt64(positions).multipliedReportingOverflow(by: 46_080)
+        let (bytes, addOverflow) = variable.addingReportingOverflow(70_778_880)
+        return overflow || addOverflow ? nil : bytes
+    }
+
+    private func ceiling(_ memory: SubagentBatchMemoryFacts, requested: Int? = nil,
+                         minimum: Int? = nil) -> Int? {
+        SubagentBatchAdmissionPlanner.affordablePositionCeiling(
+            requested: requested ?? self.requested, minimum: minimum ?? self.minimum,
+            memory: memory, headroomForPositions: price
+        )
+    }
+
+    private func plan(_ memory: SubagentBatchMemoryFacts, jobs: Int = 1,
+                      limit: Int = 1) -> SubagentBatchAdmissionPlan {
+        SubagentBatchAdmissionPlanner.plan(.init(
+            localJobCount: jobs, remoteJobCount: 0, agentParallelLimit: limit,
+            engineParallelLimit: limit, continuousBatchingEnabled: true,
+            ramSafetyEnabled: true, failClosedWhenEstimateUnknown: true, memory: memory
+        ))
+    }
+
+    private func kind() -> TextSubagentKind {
+        let kind = TextSubagentKind(agentID: UUID(), input: "source-only admission regression")
+        kind.delegatedContract = DelegatedRunContract(
+            responseTokens: 8_192, assistantTurns: 24, contextPositions: requested)
+        kind.minimumAdmissionContextPositions = minimum
+        return kind
+    }
+
+    private func withRaptorGeometry(_ body: (URL) throws -> Void) throws {
+        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
+        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
+        defer { try? FileManager.default.removeItem(at: directory) }
+        // Synthetic config metadata reproduces the reported topology. No
+        // installed model lookup, weights, tokenizer, load, or GPU is required.
+        let config: [String: Any] = [
+            "model_type": "resident_delegation_test",
+            "num_hidden_layers": 36,
+            "num_attention_heads": 16,
+            "num_key_value_heads": 4,
+            "head_dim": 256,
+            "sliding_window": 512,
+            "max_position_embeddings": 1_048_576,
+            "kv_cache_dtype": "bfloat16",
+            "layer_types": (0..<36).map { ($0 + 1) % 4 == 0 ? "full_attention" : "sliding_attention" },
+        ]
+        try JSONSerialization.data(withJSONObject: config).write(to: directory.appendingPathComponent("config.json"))
+        try body(directory)
+    }
+
+    @Test("exact refusal receipt fits one child only after enforcing the largest affordable window")
+    func liveReceiptLargestAffordableWindow() throws {
+        let original = facts()
+        #expect(price(requested) == 13_884_180_480)
+        #expect(original.perActiveChildHeadroomBytes == 48_389_160_960)
+        #expect(plan(original).ramSlots == 0)
+        #expect(plan(original).localCapacity == 0)
+        let positions = try #require(ceiling(original))
+        #expect(positions == fitted)
+        let bytes = try #require(price(positions))
+        #expect(bytes == 13_321_912_320)
+        #expect(original.reclaimableBytes! - allocator == 13_321_928_704)
+        let 
```

---

### Incident Patch 14: `2f953db2` (2026-10-01)
**Commit Message**: Consume GLM native history and text cache boundary fix (#2969)

Pin GLM native history and text cache boundary handling

Co-authored-by: Eric <[REDACTED_EMAIL]>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "6072a145727e03db1c053ccf96b722951eac9a11"
+        "revision" : "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "6072a145727e03db1c053ccf96b722951eac9a11"
+        "revision": "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +3/-1)
```diff
@@ -323,9 +323,11 @@ let package = Package(
         // Gather row scheduling includes affine expert prefill and partial-K
         // bounds correction. This pin also consumes the Unicode/BPE ordering,
         // quantization_config, and SDK-gated JACCL fixes merged after #518.
+        // GLM native history retains reasoning, tool metadata and argument order;
+        // text-only cache checkpoints use exact active-template prefix proofs.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "6072a145727e03db1c053ccf96b722951eac9a11"
+            revision: "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "6072a145727e03db1c053ccf96b722951eac9a11"
+        let expectedRevision = "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "6072a145727e03db1c053ccf96b722951eac9a11"
+        let expectedRuntimeHardenedRevision = "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

**File**: `osaurus.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "6072a145727e03db1c053ccf96b722951eac9a11"
+        "revision": "f45bc51d11608cbd67cbd70d7a475dec81bdf61a"
       }
     },
     {
```

---

### Incident Patch 15: `b6c96793` (2026-10-01)
**Commit Message**: fix code block copy button and chat width shift after copying (#2960)

* fix code block copy button ignoring repeat taps

* show pointing hand cursor on code block copy button hover

* show toast when a code block is copied

* render chat cells at the tiled column width so legacy scrollers do not shift the layout

* use the fitted column width instead of contentSize for chat cell width

**File**: `Packages/OsaurusCore/Resources/Localizable.xcstrings` (modified, +35/-0)
```diff
@@ -57206,6 +57206,41 @@
         }
       }
     },
+    "Code copied to clipboard" : {
+      "comment" : "Toast shown when a chat code block is copied to the clipboard.",
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Code in die Zwischenablage kopiert"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "코드가 클립보드에 복사됨"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Код скопирован в буфер обмена"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "代码已复制到剪贴板"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "程式碼已複製到剪貼簿"
+          }
+        }
+      }
+    },
     "Code Execution" : {
       "comment" : "Section title for a feature that lets an agent run code and commands in an isolated sandbox.",
       "isCommentAutoGenerated" : true,
```

**File**: `Packages/OsaurusCore/Views/Chat/MessageTableRepresentable.swift` (modified, +47/-12)
```diff
@@ -66,10 +66,21 @@ final class CenteredMessageScrollView: NSScrollView {
         let contentWidth = contentSize.width
         if contentWidth != lastFittedContentWidth {
             lastFittedContentWidth = contentWidth
-            (documentView as? NSTableView)?.sizeLastColumnToFit()
+            let tableView = documentView as? NSTableView
+            tableView?.sizeLastColumnToFit()
+            // Report the fitted column width, not `contentSize`: the latter
+            // ignores the centering insets and would overshoot the column.
+            if let columnWidth = tableView?.tableColumns.first?.width {
+                onContentWidthChanged?(columnWidth)
+            }
         }
     }
 
+    /// Fired from `tile()` with the column width after it is refitted. This
+    /// is the width cells actually get, which is narrower than SwiftUI's
+    /// width whenever a legacy (always-visible) scroller takes up room.
+    var onContentWidthChanged: ((CGFloat) -> Void)?
+
     /// Fired before a wheel / trackpad scroll is applied, so programmatic
     /// position holds (restore, bottom re-pin) can stand down for the user.
     var onUserScroll: (() -> Void)?
@@ -167,6 +178,9 @@ struct MessageTableRepresentable: NSViewRepresentable {
         )
         coordinator.setupHoverTracking(on: tableView)
         scrollView.onUserScroll = { [weak coordinator] in coordinator?.userDidScroll() }
+        scrollView.onContentWidthChanged = { [weak coordinator] width in
+            coordinator?.tiledContentWidthDidChange(width)
+        }
 
         // sync session store into coordinator's expand cache for the initial load
         coordinator.expandedIds = expandedBlocksStore.expandedIds
@@ -211,7 +225,7 @@ struct MessageTableRepresentable: NSViewRepresentable {
         }
 
         let rctx = renderingContext(for: coordinator)
-        coordinator.lastSwiftUIWidth = rctx.width
+        coordinator.lastSwiftUIWidth = max(100, width)
         coordinator.applyBlocks(
             blocks,
             groupHeaderMap: groupHeaderMap,
@@ -270,7 +284,7 @@ struct MessageTableRepresentable: NSViewRepresentable {
 
     private func renderingContext(for coordinator: Coordinator) -> CellRenderingContext {
         CellRenderingContext(
-            width: max(100, width),
+            width: coordinator.resolvedContentWidth(swiftUIWidth: max(100, width)),
             agentName: agentName,
             agentAvatar: agentAvatar,
             agentCustomAvatarPath: agentCustomAvatarPath,
@@ -429,6 +443,16 @@ extension MessageTableRepresentable {
         /// Width last provided by SwiftUI (effectiveContentWidth, already clamped to maxContentWidth).
         /// Used by the frame-change debounce to avoid reading the clip view before tile() has run.
         var lastSwiftUIWidth: CGFloat = 100
+        /// Content width from the scroll view's last `tile()`, 0 until the
+        /// first real layout. Cells must render at this width, not SwiftUI's:
+        /// a legacy scroller makes the column narrower than SwiftUI's width,
+        /// and any later SwiftUI update would otherwise re-render every cell
+        /// wider than its column.
+        private var tiledContentWidth: CGFloat = 0
+
+        func resolvedContentWidth(swiftUIWidth: CGFloat) -> CGFloat {
+            tiledContentWidth > 100 ? tiledContentWidth : swiftUIWidth
+        }
         /// Clip-view width the table column was last fitted to; gates
         /// `sizeLastColumnToFit` in `updateNSView` to real width changes.
         var lastFitColumnClipWidth: CGFloat = -1
@@ -704,20 +728,31 @@ extension MessageTableRepresentable {
                 return
             }
 
-            // only reconfigure after the frame stops changing
-            // to avoid expensive per-frame work
+            scheduleWidthReconfigure()
+        }
+
+        /// `tile()` laid the column out at a new width (window resize, or a
+        /// legacy scroller appearing/disappearing). Reconfigure the cells
+        /// only if they were rendered for a different width, so overlay
+        /// scrollers (where the two always agree) keep the no-rewrap mount.
+        func tiledContentWidthDidChange(_ width: CGFloat) {
+            guard width > 100 else { return }
+            tiledContentWidth = width
+            guard abs(ctx.width - width) > 1.0 else { return }
+            scheduleWidthReconfigure()
+        }
+
+        /// Reconfigure every cell for the current content width once the
+        /// width stops changing, to avoid expensive per-frame work.
+        private func scheduleWidthReconfigure() {
             frameDebounceWork?.cancel()
             let work = DispatchWorkItem { [weak self] in
                 guard let self, let tableView else { return }
-                // use SwiftUI's pre-computed effectiveContentWidth (already clamped to
-                // maxContentWidth). Reading contentView.bounds.width here is unreliable
-                // because tile() may
```

**File**: `Packages/OsaurusCore/Views/Chat/NativeBlockViews.swift` (modified, +35/-3)
```diff
@@ -595,7 +595,7 @@ final class NativeCodeBlockView: NSView {
 
     private let headerView = NSView()
     private let langLabel = NSTextField(labelWithString: L("code"))
-    private let copyButton = NSButton()
+    private let copyButton = PointingHandButton()
     private var codeView: CodeNSTextView?
     private var codeHeightConstraint: NSLayoutConstraint?
 
@@ -1063,17 +1063,49 @@ final class NativeCodeBlockView: NSView {
     @objc private func copyCode() {
         NSPasteboard.general.clearContents()
         NSPasteboard.general.setString(lastCode, forType: .string)
+        ToastManager.shared.success(L("Code copied to clipboard"))
         copyButton.image = SymbolImageCache.image("checkmark", accessibilityDescription: nil)
         copyButton.contentTintColor = .systemGreen
         copyResetTask?.cancel()
-        copyResetTask = Task { @MainActor in
-            try? await Task.sleep(nanoseconds: 2_000_000_000)
+        copyResetTask = Task { @MainActor [weak self] in
+            // A repeat tap cancels this task. `try?` alone would swallow the
+            // CancellationError and run the reset at once, wiping the new
+            // checkmark, so bail on cancellation instead.
+            guard (try? await Task.sleep(nanoseconds: 2_000_000_000)) != nil,
+                let self
+            else { return }
             self.copyButton.image = SymbolImageCache.image("doc.on.doc", accessibilityDescription: nil)
             self.copyButton.contentTintColor = nil
         }
     }
 }
 
+// MARK: - PointingHandButton
+
+/// Borderless button that shows the pointing-hand cursor on hover. Uses a
+/// `.cursorUpdate` tracking area rather than cursor rects, which don't
+/// survive layer-backed table-cell recycling in the message list.
+private final class PointingHandButton: NSButton {
+    private var cursorTrackingArea: NSTrackingArea?
+
+    override func updateTrackingAreas() {
+        super.updateTrackingAreas()
+        if let cursorTrackingArea { removeTrackingArea(cursorTrackingArea) }
+        let area = NSTrackingArea(
+            rect: bounds,
+            options: [.cursorUpdate, .activeInKeyWindow, .inVisibleRect],
+            owner: self,
+            userInfo: nil
+        )
+        addTrackingArea(area)
+        cursorTrackingArea = area
+    }
+
+    override func cursorUpdate(with event: NSEvent) {
+        NSCursor.pointingHand.set()
+    }
+}
+
 // MARK: - CellTextView
 
 /// NSTextView subclass used as a grid cell. Keeps attributed-string formatting
```

#### Recent Merged Pull Requests:
- **PR #3018** (2026-10-06): only show a pairing code while the server is running (@RaajeevChandran)
- **PR #3017** (2026-10-05): Unify chat composer popups with the model picker style and quiet the lone chat tab (@tpae)
- **PR #3011** (2026-10-06): Pin PromptSection token estimation main thread hang fix (@sentry[bot])
- **PR #3010** (2026-10-05): steer channel messages into the running turn instead of waiting for the next one (@RaajeevChandran)
- **PR #3008** (2026-10-05): queue channel messages that arrive while a turn is running instead of dropping them (@RaajeevChandran)
- **PR #3007** (2026-10-05): start a fresh chat for every scheduled run (@RaajeevChandran)
- **PR #3006** (2026-10-05): Show adaptive native MTP controls before model loading (@jjang-ai)
- **PR #3005** (2026-10-05): Pin MTP head-history and lazy-verifier PLE state fixes (@jjang-ai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
