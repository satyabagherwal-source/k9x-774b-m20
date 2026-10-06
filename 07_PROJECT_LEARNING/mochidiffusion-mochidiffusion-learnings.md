# Forensic Learning Record (Deep Inspection): MochiDiffusion/MochiDiffusion

> **Canonical Artifact**: `07_PROJECT_LEARNING/mochidiffusion-mochidiffusion-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MochiDiffusion/MochiDiffusion](https://github.com/MochiDiffusion/MochiDiffusion))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:26:49.318Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MochiDiffusion/MochiDiffusion`
- **Description**: Run Stable Diffusion on Mac natively
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7963 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Mochi Diffusion/Model/EngineIdentity.swift`
```
//
//  EngineIdentity.swift
//  Mochi Diffusion
//

import Foundation

nonisolated struct EngineID: RawRepresentable, Hashable, Codable, Sendable {
    let rawValue: String
}

nonisolated extension EngineID: CustomStringConvertible {
    var description: String { rawValue }
}

nonisolated extension EngineID {
    static let coreMLStableDiffusion = EngineID(rawValue: "coreml-sd")
    static let iris = EngineID(rawValue: "iris")
    static let openAI = EngineID(rawValue: "openai")
}

/// Identifies a model within an engine.
///
/// For a local engine, `key` is the name of a direct child of the model directory.
/// For a hosted engine, `key` is the API's own model name.
nonisolated struct ModelID: Hashable, Codable, Sendable {
    let engine: EngineID
    let key: String
}

nonisolated extension ModelID: CustomStringConvertible {
    var description: String { "\(engine.rawValue):\(key)" }
}

// MARK: - Persistence

nonisolated extension ModelID {
    /// The persisted form: engine and key in one value, so a selection is written
    /// once rather than as two writes that can tear.
    ///
    /// Not `description`, so how an id reads in a log can change without changing
    /// what is on disk.
    var persistedValue: String { "\(engine.rawValue):\(key)" }

    /// Parses `persistedValue`.
    ///
    /// Splits on the first colon: engine ids never contain one, but a model key
    /// may, since a colon is legal in a POSIX filename.
    init?(persistedValue: String) {
        guard let separator = persistedValue.firstIndex(of: ":") else { return nil }
        let engine = String(persistedValue[persistedValue.startIndex..<separator])
        let key = String(persistedValue[persistedValue.index(after: separator)...])
        guard !engine.isEmpty, !key.isEmpty else { return nil }
        self.init(engine: EngineID(rawValue: engine), key: key)
    }
}

// MARK: - Local keys

nonisolated extension ModelID {
    /// The key for a model directory that discovery returned: its last path component.
    ///
    /// Discovery only enumerates direct children, so the last component is the
    /// whole relative path. It is not computed against the models root because
    /// `contentsOfDirectory(at:)` returns `/private/var`-prefixed children for a
    /// `/var` root, and a model directory that is a symlink resolves outside the
    /// root entirely.
    static func localKey(for url: URL) -> String {
        url.lastPathComponent
    }
}

```

### Core Architecture Module: `Mochi Diffusion/Model/EngineModel.swift`
```
//
//  EngineModel.swift
//  Mochi Diffusion
//

import Foundation

nonisolated enum MetadataField: String, CaseIterable, Sendable {
    case prompt
    case negativePrompt
    case model
    /// The engine, and its own key for the model, so an imported image names a
    /// model exactly rather than by display name alone.
    case engine
    case modelKey
    case size
    case quality
    case startingImage
    case controlNetImage
    case inputImages
    case strength
    case scheduler
    case mlComputeUnit
    case seed
    case steps
    case guidanceScale
}

/// A model a particular engine can generate with.
///
/// Local models have a directory, but hosted ones only a name,
/// so the concrete types carry their own `url` and generic callers do not ask.
nonisolated protocol EngineModel: Identifiable, Sendable {
    var id: ModelID { get }
    var name: String { get }
    var constraints: OptionConstraints { get }
    var metadataFields: Set<MetadataField> { get }
    /// without a local tokenizer there is no prompt token count
    var tokenizerModelDir: URL? { get }
}

```

### Core Architecture Module: `Mochi Diffusion/Support/CoreMLEngineRuntime.swift`
```
//
//  CoreMLEngineRuntime.swift
//  Mochi Diffusion
//
//  Created by Joshua Park on 2/12/23.
//

import CoreML
import StableDiffusion

/// Resolved values for one Core ML generation, in the shape the Apple pipeline
/// wants them.
nonisolated struct CoreMLGenerationConfig {
    let prompt: String
    let negativePrompt: String
    let startingImage: CGImage?
    let startingImageName: String
    let controlNetImageName: String
    let controlNetInputs: [CGImage]
    let model: SDModel
    let mlComputeUnit: MLComputeUnits
    let controlNets: [String]
    let strength: Float
    let stepCount: Int
    let guidanceScale: Float
    let disableSafety: Bool
    let scheduler: Scheduler
    let useDenoisedIntermediates: Bool
    let seed: UInt32
    let numberOfImages: Int
}

/// Every constructor input that determines whether the loaded Core ML pipeline
/// can serve another request.
nonisolated struct CoreMLPipelineCacheKey: Equatable {
    let model: SDModel
    let controlNet: [String]
    let effectiveControlNetLocation: String?
    let computeUnit: MLComputeUnits
    let reduceMemory: Bool
    let disableSafety: Bool?

    init(
        model: SDModel,
        controlNet: [String],
        effectiveControlNetLocation: String?,
        computeUnit: MLComputeUnits,
        reduceMemory: Bool,
        disableSafety: Bool
    ) {
        self.model = model
        self.controlNet = controlNet
        self.effectiveControlNetLocation = effectiveControlNetLocation
        self.computeUnit = computeUnit
        self.reduceMemory = reduceMemory
        self.disableSafety = model.type == .sd15 ? disableSafety : nil
    }
}

/// Runs Core ML Stable Diffusion requests and owns the loaded pipeline between
/// them.
///
/// The blocking `generateImages` call runs *inside* the actor and occupies its
/// executor for the length of a generation. Running it elsewhere would mean
/// sending the non-`Sendable` pipeline across an isolation boundary, which Swift's
/// region analysis cannot prove safe for a value read out of actor storage.
/// Nothing waits on the actor meanwhile: cancellation goes to the
/// `GenerationSession`, and the queue admits one request at a time.
actor CoreMLEngineRuntime: GenerationEngineRuntime {
    private var pipeline: (any StableDiffusionPipelineProtocol)?
    private var currentPipelineKey: CoreMLPipelineCacheKey?
    private let modelRepository: ModelRepository

    init(modelRepository: ModelRepository = ModelRepository()) {
        self.modelRepository = modelRepository
    }

    func run(
        request: GenerationRequest,
        session: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws {
        // The single downcast of this engine's payload. A mismatch is a wiring
        // bug: `AnyGenerationEngine.accepts(payload:)` rejects it at enqueue.
        guard let payload = request.payload as? CoreMLGenerationPayload else {
            throw EngineError.payloadDoesNotBelongToEngine(engine: .coreMLStableDiffusion)
        }

        // Whether a model is still on disk is knowledge about this engine's
        // models, so the queue does not have to inspect the payload to ask.
        guard await modelRepository.modelExists(at: payload.model.url) else {
            throw GenerationError.requestedModelNotFound
        }

        let config = makeConfig(from: request, payload: payload)

        try loadPipelineIfNeeded(
            model: payload.model,
            controlNet: config.controlNets,
            controlNetDirectory: payload.controlNetDirectory,
            computeUnit: payload.computeUnit,
            reduceMemory: payload.reduceMemory,
            disableSafety: payload.disableSafety,
            session: session
        )

        try await generate(config, request: request, session: session, onResult: onResult)
    }

    /// Loads the pipeline unless the one already loaded was built from the same
    /// inputs. Synchronous: it is called from inside the actor and the work is
    /// the load itself, not something to await.
    private func loadPipelineIfNeeded(
        model: SDModel,
        controlNet: [String],
        controlNetDirectory: URL,
        computeUnit: MLComputeUnits,
        reduceMemory: Bool,
        disableSafety: Bool,
        session: GenerationSession
    ) throws {
        // Relinking happens *before* the cache check, and its result is part of
        // the key, so changing the configured ControlNet folder repoints the link
        // and reloads the pipeline from the new folder.
        var effectiveControlNetLocation: String?
        if !controlNet.isEmpty {
            effectiveControlNetLocation = ControlNetLink.resolve(
                configured: controlNetDirectory,
                in: model.url
            )
        }

        let cacheKey = CoreMLPipelineCacheKey(
            model: model,
            controlNet: controlNet,
            effectiveControlNetLocation: effectiveControlNetLocation,
            computeUnit: computeUnit,
            reduceMemory: reduceMemory,
            disableSafety: disableSafety
        )
        guard cacheKey != currentPipelineKey else { return }

        session.emit(
            .state(
                .loading(
                    String(
                        localized: "Loading the model for the first time may take a few minutes",
                        comment: "Text displayed while a local Core ML model is being loaded"
                    )
                )
            )
        )
        let configuration = MLModelConfiguration()
        configuration.computeUnits = computeUnit

        switch model.type {
        case .sdxl:
            pipeline = try StableDiffusionXLPipeline(
                resourcesAt: model.url,
                configuration: configuration,
                reduceMemory: reduceMemory
            )
        case .sd3:
            pipeline = try StableDiffusion3Pipeline(
                resourcesAt: model.url,
                configuration: configuration,
                reduceMemory: reduceMemory
            )
        case .sd15:
            pipeline = try StableDiffusionPipeline(
                resourcesAt: model.url,
                controlNet: controlNet,
                configuration: configuration,
                disableSafety: disableSafety,
                reduceMemory: reduceMemory
            )
        }

        currentPipelineKey = cacheKey
    }

    private func generate(
        _ config: CoreMLGenerationConfig,
        request: GenerationRequest,
        session: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws {
        guard let pipeline else {
            throw GenerationError.pipelineNotAvailable
        }
        session.emit(
            .state(
                .loading(
                    String(
                        localized: "Preparing generation...",
                        comment: "Text displayed while Core ML prepares a generation"
                    )
                )
            )
        )

        var pipelineConfig = StableDiffusionPipeline.Configuration(prompt: config.prompt)
        pipelineConfig.negativePrompt = config.negativePrompt
        pipelineConfig.seed = config.seed
        pipelineConfig.startingImage = config.startingImage
        pipelineConfig.strength = config.strength
        pipelineConfig.stepCount = config.stepCount
        pipelineConfig.guidanceScale = config.guidanceScale
        pipelineConfig.disableSafety = config.disableSafety
        pipelineConfig.schedulerType = convertScheduler(config.scheduler)
        pipelineConfig.controlNetInputs = config.controlNetInputs
        pipelineConfig.useDenoisedIntermediates = config.useDenoisedIntermediates

        if config.model.type == .sdxl {
            pipelineConfig.encoderScaleFactor = 0.13025
            pipelineConfig.decoderScaleFactor = 0.13025
            pipelineConfig.schedulerTimestepSpacing = .karras
        }

        if config.model.type == .sd3 {
            pipelineConfig.schedulerTimestepShift = 3.0
        }

        let useDenoisedIntermediates = pipelineConfig.useDenoisedIntermediates
        for _ in 0..<config.numberOfImages {
            let images = try pipeline.generateImages(configuration: pipelineConfig) { progress in
                // Emitted synchronously into the session's stream, which keeps
                // updates in order and drops them once the session closes.
                session.emit(
                    .progress(
                        GenerationState.Progress(
                            step: progress.step,
                            stepCount: progress.stepCount
                        )
                    )
                )
                if useDenoisedIntermediates {
                    session.emit(.preview(progress.currentImages.last.flatMap { $0 }))
                }
                return !session.isCancelled
            }
            if session.isCancelled {
                break
            }
            for image in images {
                guard let image else { continue }
                let metadata = Self.metadata(
                    request: request,
                    config: config,
                    width: image.width,
                    height: image.height,
                    seed: pipelineConfig.seed,
                    generatedDate: Date.now
                )
                guard let data = await metadata.pngData(for: image) else {
                    throw GenerationError.imageEncodingFailed
                }
                try await onResult(GenerationResult(metadata: metadata, imageData: data))
            }
            pipelineConfig.seed = GenerationSeed.next(after: pipelineConfig.seed)
        }
    }

    /// What one Core ML image records. A starting image, its strength and a
    /// ControlNet are recorded only when they reached the pipelin
```

### Core Architecture Module: `Mochi Diffusion/Support/EngineRegistry.swift`
```
//
//  EngineRegistry.swift
//  Mochi Diffusion
//

import Foundation
import os

/// Holds the engines and runs discovery across them.
///
/// Discovery is per engine and failure-isolated: each engine's result is kept
/// separately, so a missing folder or an absent API key cannot empty the model list
/// for everything else.
actor EngineRegistry {
    /// The engines the app ships with, in registration order. That order decides
    /// only where an engine appears in a list — never which engine owns a model,
    /// and never whether a model is valid.
    static var shipped: [AnyGenerationEngine] {
        [
            AnyGenerationEngine(IrisEngine()),
            AnyGenerationEngine(CoreMLStableDiffusionEngine()),
        ]
    }

    /// The shipped engines plus hosted OpenAI generation, which the app does not
    /// currently register.
    ///
    /// Hosted generation is opt-in at the composition root, so the default
    /// registry cannot reach a credential store or hosted runtime.
    static func openAIBeta(
        secrets: any SecretStore,
        fileSystem: FileSystemStore = FileSystemStore()
    ) -> EngineRegistry {
        EngineRegistry(
            engines: shipped + [AnyGenerationEngine(OpenAIImageEngine(secrets: secrets))],
            fileSystem: fileSystem
        )
    }

    /// One engine's discovery result, kept whole so a caller can report a failure
    /// against the engine it belongs to.
    struct Discovery: Sendable {
        let engine: EngineID
        let models: [any EngineModel]
        let failure: (any Error)?
    }

    /// `nonisolated` because the engines are immutable `Sendable` values the sidebar
    /// reads on every request it builds. Discovery stays isolated: it does I/O.
    nonisolated private let engines: [AnyGenerationEngine]
    private let fileSystem: FileSystemStore
    private let logger = Logger()

    init(
        engines: [AnyGenerationEngine],
        fileSystem: FileSystemStore = FileSystemStore()
    ) {
        self.engines = engines
        self.fileSystem = fileSystem
    }

    /// The shipped engine list. Hosted generation must be opted into through
    /// `openAIBeta(secrets:fileSystem:)`.
    init(fileSystem: FileSystemStore = FileSystemStore()) {
        self.init(engines: EngineRegistry.shipped, fileSystem: fileSystem)
    }

    nonisolated var engineIDs: [EngineID] {
        engines.map(\.id)
    }

    /// Every engine, in registration order, including ones that are unconfigured or
    /// have no models.
    nonisolated var allEngines: [AnyGenerationEngine] {
        engines
    }

    nonisolated func engine(_ id: EngineID) -> AnyGenerationEngine? {
        engines.first { $0.id == id }
    }

    /// Everything one refresh produces, so a caller applies a single consistent
    /// snapshot rather than pairing one engine's availability with another pass's
    /// models.
    struct Refresh: Sendable {
        let discoveries: [Discovery]
        let availability: [EngineID: EngineAvailability]

        var models: [any EngineModel] { discoveries.allModels }
        var failures: [(engine: EngineID, error: any Error)] { discoveries.failures }
    }

    /// Asks every engine what it has and whether it can be used, concurrently.
    ///
    /// Concurrent because the work is per engine and independent: with a hosted
    /// engine registered, a serial pass would make a slow network round trip delay
    /// the local engines that were ready all along.
    ///
    /// Never throws. An engine that fails contributes its error and no models,
    /// which is what keeps one engine's problem from looking like a global one.
    func refresh(settings: EngineSettings) async -> Refresh {
        // Enumerated once for the whole pass; see `ModelDiscoveryContext`.
        let context = ModelDiscoveryContext(settings: settings, fileSystem: fileSystem)

        var discoveredByEngine: [EngineID: Discovery] = [:]
        var availability: [EngineID: EngineAvailability] = [:]

        await withTaskGroup(of: (EngineID, Discovery, EngineAvailability).self) { group in
            for engine in engines {
                group.addTask {
                    // Both halves of one engine's answer, also concurrently: a
                    // hosted engine will reach the network for each.
                    async let reported = engine.availability(settings)
                    let discovery: Discovery
                    do {
                        let models = try await engine.discoverModels(context)
                        discovery = Discovery(engine: engine.id, models: models, failure: nil)
                    } catch {
                        discovery = Discovery(engine: engine.id, models: [], failure: error)
                    }
                    return (engine.id, discovery, await reported)
                }
            }
            for await (id, discovery, reported) in group {
                discoveredByEngine[id] = discovery
                availability[id] = reported
            }
        }

        for engine in engines {
            guard let failure = discoveredByEngine[engine.id]?.failure else { continue }
            logger.error("\(engine.id.rawValue) discovery failed: \(failure)")
            // A discovery failure is an availability failure. `availability` only
            // asks whether the models folder exists, so a folder that exists and
            // cannot be read answers `.ready` — and the picker would then report
            // "No models found", sending the user after missing models when the
            // folder is the problem.
            //
            // Only `.ready` is overridden. An engine that already said why it cannot
            // be used — no API key, host unreachable — has given the better reason,
            // and its discovery failing is a consequence of it rather than a second
            // fact. Replacing that with a generic message would lose the only one
            // the user can act on.
            guard case .ready = availability[engine.id] else { continue }
            availability[engine.id] = .unreachable(
                String(
                    localized: "Models could not be read",
                    comment: "Engine unavailable because listing its models failed"
                )
            )
        }

        // Re-ordered to registration order, which the task group does not preserve.
        // `allModels` breaks name ties by engine id, and presentation order is
        // supposed to be fixed in code rather than depend on completion timing.
        return Refresh(
            discoveries: engines.compactMap { discoveredByEngine[$0.id] },
            availability: availability
        )
    }

    /// Discovery alone, in registration order, for callers that do not need
    /// availability. Production uses `refresh(settings:)`.
    func discoverAll(settings: EngineSettings) async -> [Discovery] {
        await refresh(settings: settings).discoveries
    }
}

/// `nonisolated` is load-bearing. Under `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`
/// an unannotated extension's closures are inferred main-actor-isolated, and
/// `sorted(by:)` calls its predicate synchronously on the current thread — so the
/// sort below traps in `dispatch_assert_queue` rather than failing to compile.
nonisolated extension [EngineRegistry.Discovery] {
    /// Every discovered model, sorted by name — case- and diacritic-insensitively —
    /// then by engine id. The second key matters because two engines can expose the
    /// same directory, and so the same name; without it their order would depend on
    /// dictionary iteration.
    var allModels: [any EngineModel] {
        flatMap(\.models)
            .sorted { lhs, rhs in
                switch lhs.name.compare(
                    rhs.name, options: [.caseInsensitive, .diacriticInsensitive])
                {
                case .orderedAscending: return true
                case .orderedDescending: return false
                case .orderedSame: return lhs.id.engine.rawValue < rhs.id.engine.rawValue
                }
            }
    }

    var failures: [(engine: EngineID, error: any Error)] {
        compactMap { discovery in
            discovery.failure.map { (discovery.engine, $0) }
        }
    }
}

```

### Core Architecture Module: `Mochi Diffusion/Support/EngineSettingsStore.swift`
```
//
//  EngineSettingsStore.swift
//  Mochi Diffusion
//

import Foundation
import Observation

/// Per-engine persisted values: which engine is selected, and which model each
/// engine was last using.
///
/// Separate from `ConfigStore` because the keys are dynamic. `@AppStorage` binds
/// one property to one literal key, which cannot express `Engine.<id>.…` for a
/// set of engines that grows, so the values are observed stored properties
/// written through to `UserDefaults`.
///
/// The model picker's live selection is `ConfigStore.selectedModel`. These values
/// back the explicit engine picker, which the app does not currently show.
@MainActor
@Observable final class EngineSettingsStore {
    nonisolated enum Key {
        static let selectedEngine = "SelectedEngine"

        static func selectedModel(_ engine: EngineID) -> String {
            "Engine.\(engine.rawValue).SelectedModel"
        }
    }

    private let store: UserDefaults

    private var selectedEngineID: EngineID?
    /// Model selections by engine, read once at init and written through on
    /// change.
    private var selectedModels: [EngineID: ModelID]

    /// - Parameters:
    ///   - store: the defaults to read and write. Tests pass an isolated suite;
    ///     the app uses `.standard`.
    ///   - engines: the engines whose selections are loaded. Only these are read,
    ///     so a key left behind by an engine that no longer exists is ignored
    ///     rather than resurrected.
    init(store: UserDefaults = .standard, engines: [EngineID]) {
        self.store = store
        selectedEngineID = store.string(forKey: Key.selectedEngine).map(EngineID.init(rawValue:))
        selectedModels = [:]
        for engine in engines {
            guard
                let persisted = store.string(forKey: Key.selectedModel(engine)),
                let id = ModelID(persistedValue: persisted)
            else { continue }
            // A key filed under a different engine is corrupt; trusting it would
            // let one engine's selection resolve to another engine's model.
            guard id.engine == engine else { continue }
            selectedModels[engine] = id
        }
    }

    var selectedEngine: EngineID? {
        get { selectedEngineID }
        set {
            guard newValue != selectedEngineID else { return }
            selectedEngineID = newValue
            if let newValue {
                store.set(newValue.rawValue, forKey: Key.selectedEngine)
            } else {
                store.removeObject(forKey: Key.selectedEngine)
            }
        }
    }

    func selectedModel(for engine: EngineID) -> ModelID? {
        selectedModels[engine]
    }

    /// Records `model` as `engine`'s selection.
    ///
    /// Ignores a model belonging to a different engine, which is a wiring bug
    /// rather than something to persist.
    func setSelectedModel(_ model: ModelID?, for engine: EngineID) {
        if let model, model.engine != engine { return }
        guard selectedModels[engine] != model else { return }
        if let model {
            selectedModels[engine] = model
            store.set(model.persistedValue, forKey: Key.selectedModel(engine))
        } else {
            selectedModels.removeValue(forKey: engine)
            store.removeObject(forKey: Key.selectedModel(engine))
        }
    }

    /// Applies the selection migration, if it has not run.
    ///
    /// Written through the properties above rather than straight to `UserDefaults`,
    /// so observers see the change.
    @discardableResult
    func migrateSelectedEngineIfNeeded(from previousSelection: ModelID?, discovered: [ModelID])
        -> EngineSelectionMigration.Outcome
    {
        let outcome = EngineSelectionMigration.selection(
            previousSelection: previousSelection,
            alreadyInItsSlot: previousSelection.map {
                selectedModel(for: $0.engine) == $0
            } ?? false,
            discovered: discovered
        )
        if case .migrated(let id) = outcome {
            setSelectedModel(id, for: id.engine)
            // The engine is adopted only if none is chosen, so the user is not
            // moved off the engine they are working in.
            if selectedEngine == nil {
                selectedEngine = id.engine
            }
        }
        return outcome
    }
}

/// One-time migration of a single `SelectedModel` into `SelectedEngine` plus one
/// key per engine, so switching engines and back does not lose the model in use.
///
/// Runs after `PreferenceMigration`, which turns the legacy `Model` URL into a
/// `SelectedModel`; only that first step needs to match against discovery.
///
/// `SelectedModel` remains the model picker's live selection. This migration
/// seeds the per-engine copy that the explicit engine picker reads.
///
/// Delete both once the migration window closes.
nonisolated enum EngineSelectionMigration {
    enum Outcome: Equatable, Sendable {
        /// The selection is already recorded against its own engine.
        case alreadyMigrated
        /// Nothing to migrate.
        case nothingToMigrate
        /// The selection names nothing discovery found, so there is no engine worth
        /// recording. Retried on the next pass, since the models folder may have
        /// been temporarily unavailable.
        case unresolvable
        case migrated(ModelID)
    }

    /// Decides what the engine-scoped selection should become.
    ///
    /// Migrates only a selection that resolves to a model discovery actually found.
    /// Otherwise `SelectedEngine` would name an engine with no models, and the
    /// controller keeps a chosen engine even when it is empty. Leaving it unset
    /// lets the controller pick the first model instead.
    ///
    /// - Parameter alreadyInItsSlot: whether the selection is already recorded
    ///   against its own engine, which is what "this has run" means. Whether some
    ///   engine is selected says nothing, because `restoreSelection` persists a
    ///   fallback engine.
    static func selection(
        previousSelection: ModelID?,
        alreadyInItsSlot: Bool,
        discovered: [ModelID]
    ) -> Outcome {
        guard let previousSelection else {
            return .nothingToMigrate
        }
        if alreadyInItsSlot {
            return .alreadyMigrated
        }
        guard discovered.contains(previousSelection) else {
            return .unresolvable
        }
        return .migrated(previousSelection)
    }
}

```

### Core Architecture Module: `Mochi Diffusion/Support/GenerationEngine.swift`
```
//
//  GenerationEngine.swift
//  Mochi Diffusion
//

import CoreGraphics
import CoreML
import Foundation

/// What a local engine needs to find its models.
///
/// One struct rather than per-engine settings, because the local engines share one
/// models directory. `controlNetDirectory` is meaningful only to Core ML Stable
/// Diffusion; other engines are handed it and ignore it.
nonisolated struct EngineSettings: Sendable {
    var modelDirectory: URL
    var controlNetDirectory: URL
}

/// One discovery pass, with the work that does not vary by engine done once.
///
/// Every local engine scans the same models folder, so the enumeration is shared
/// rather than repeated per engine on every folder-change event.
///
/// Recognition is not shared and cannot be: each engine decides what a directory
/// is by its own rules, so sniffing still costs one pass per engine over the same
/// children.
nonisolated struct ModelDiscoveryContext: Sendable {
    let settings: EngineSettings

    /// A `Result` rather than an array, so an unreadable models folder fails only
    /// the engines that looked at it. A hosted engine never calls
    /// `localModelDirectories()`, so a missing local folder cannot take its models
    /// down with it.
    private let localDirectories: Result<[URL], any Error>

    init(settings: EngineSettings, fileSystem: FileSystemStore = FileSystemStore()) {
        self.settings = settings
        localDirectories = Result { try fileSystem.subDirectories(in: settings.modelDirectory) }
    }

    /// The direct children of the models folder, filtered to directories.
    ///
    /// Throws whatever enumeration threw.
    func localModelDirectories() throws -> [URL] {
        try localDirectories.get()
    }
}

/// The seeds a generation uses.
///
/// The sidebar reserves seed 0 for "random", so no generated image is given
/// seed 0: an image recorded with it could not be reproduced through Copy Options.
nonisolated enum GenerationSeed {
    static func random() -> UInt32 {
        UInt32.random(in: 1...UInt32.max)
    }

    /// The seed for the image after one generated with `seed` in the same batch.
    /// Wraps from `UInt32.max` to 1.
    static func next(after seed: UInt32) -> UInt32 {
        seed == .max ? 1 : seed + 1
    }
}

/// Everything the sidebar holds, handed to an engine so it can decide what its own
/// generation needs.
///
/// `plan` is synchronous and `nonisolated`, so it runs in the caller's isolation —
/// the main actor — and produces a `Sendable` plan for the queue.
nonisolated struct GenerationDraft: Sendable {
    var prompt: String
    var negativePrompt: String
    /// The size typed into the sidebar. An engine may override it; a Core ML
    /// model with a fixed input size does.
    var configuredSize: CGSize
    /// The image to denoise from, for a model that does img2img. Distinct from
    /// `inputImages` rather than the first of them: it is scaled to the output size
    /// and carries `strength`.
    var startingImage: InputImage?
    /// Images the model attends to as references, in the order the user added them.
    /// An engine takes as many as its `InputImagesConstraint` allows.
    var inputImages: [InputImage]
    var controlNets: [ControlNetDraft]
    var strength: Float
    var stepCount: Int
    var guidanceScale: Float
    var scheduler: Scheduler
    var quality: ImageQuality
    var seed: UInt32
    var numberOfImages: Int
    var computeUnitPreference: ComputeUnitPreference
    var reduceMemory: Bool
    var safetyChecker: Bool
    var showGenerationPreview: Bool
    var imageDir: String
    /// Where the shared ControlNet bundles live. Only Core ML Stable Diffusion
    /// reads it.
    var controlNetDirectory: URL
}

nonisolated struct ControlNetDraft: Sendable {
    var name: String?
    var image: CGImage?
    var imageName: String?
}

/// What an engine resolved a draft into: the values that will be used and
/// recorded, plus its own payload.
///
/// Generic over the payload so the compiler enforces that an engine's `plan`
/// returns that engine's payload type. `erased()` widens it once, at the boundary
/// where the heterogeneous queue needs it.
nonisolated struct GenerationPlan<Payload: Sendable>: Sendable {
    var payload: Payload
    /// The size that will actually be produced.
    var size: CGSize
    /// A denoising origin, kept separate from references so its role does not
    /// depend on whether the user supplied a filename.
    var startingImageData: Data?
    /// The references this engine will actually send, already cropped, scaled and
    /// encoded, truncated to what the model accepts.
    var inputImageData: [Data]
    var controlNetImageData: [Data]
    var controlNetNames: [String]
    /// Positionally aligned with `controlNetImageData`; nil means the guide had
    /// no source filename.
    var controlNetImageNames: [String?]
    /// `nil` where the model does not use the option at all, so the queue hides a
    /// row rather than printing a number that had no effect. A hosted engine has no
    /// concept of `stepCount` or `scheduler`, which is why those are optional too.
    ///
    /// A runtime that does use one of these reads the resolved value from its own
    /// payload.
    var stepCount: Int?
    var scheduler: Scheduler?
    var strength: Float?
    var guidanceScale: Float?
    var quality: ImageQuality?
    var numberOfImages: Int
    var mlComputeUnit: MLComputeUnits?
    /// Core ML records a starting image; Iris records input images. Same sidebar
    /// state, different field, so the engine decides which one it fills.
    var startingImageName: String?
    /// Positionally aligned with `inputImageData`; nil means those pixels had no
    /// source filename.
    var inputImageNames: [String?]
}

nonisolated extension GenerationPlan {
    /// Widens the payload for the queue, keeping every resolved value.
    func erased() -> GenerationPlan<any Sendable> {
        GenerationPlan<any Sendable>(
            payload: payload,
            size: size,
            startingImageData: startingImageData,
            inputImageData: inputImageData,
            controlNetImageData: controlNetImageData,
            controlNetNames: controlNetNames,
            controlNetImageNames: controlNetImageNames,
            stepCount: stepCount,
            scheduler: scheduler,
            strength: strength,
            guidanceScale: guidanceScale,
            quality: quality,
            numberOfImages: numberOfImages,
            mlComputeUnit: mlComputeUnit,
            startingImageName: startingImageName,
            inputImageNames: inputImageNames
        )
    }
}

/// Whether an engine can be used, and if not, why — in words a picker can show.
nonisolated enum EngineAvailability: Sendable, Equatable {
    case ready
    /// Reachable, but the user has to do something first.
    case needsConfiguration(String)
    /// Should work, but is not answering — an unreachable host, a missing folder.
    case unreachable(String)
}

/// The stateful half of an engine: it runs one request at a time and owns whatever
/// that costs — a loaded multi-gigabyte pipeline, a C context, a network session.
///
/// Has no `cancel` method. Cancellation lives on the `GenerationSession` the caller
/// already holds, because a runtime blocking its executor inside a synchronous
/// generation call cannot accept an isolated call until that call returns.
///
/// Results are an awaited throwing callback rather than an event: the caller writes
/// each image to disk before the engine produces the next, and a failed write has
/// to stop the generation.
nonisolated protocol GenerationEngineRuntime: Sendable {
    /// Runs `request` to completion, or until `session` is cancelled.
    ///
    /// Reports phase, progress and preview through `session`; hands each finished
    /// image to `onResult`. Returning normally means the request is done —
    /// including when it stopped early because the session was cancelled.
    func run(
        request: GenerationRequest,
        session: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws

    /// How long this runtime may go without emitting an event or a result before
    /// the queue gives up on it. `nil` — the default — means never.
    ///
    /// A bound on the gap between signs of life, not on total duration: a large
    /// generation may legitimately run for minutes, so any wall-clock budget loose
    /// enough to allow one is too loose to catch a hang.
    ///
    /// Per request, because the bound depends on what the request asked for: a
    /// hosted runtime streaming partial images has a heartbeat and can be held to a
    /// tight idle bound, while one with no intermediate events at all would see the
    /// same number become a total budget.
    ///
    /// The queue enforces it, since it owns the request lifecycle and can guarantee
    /// an expiry releases the drain exactly as a completion does. Local runtimes
    /// leave this `nil`.
    func idleTimeout(for request: GenerationRequest) -> Duration?

    /// Whether stopping this runtime leaves work running somewhere we cannot reach.
    /// `false` — the default — for anything in this process.
    ///
    /// A hosted service may finish an image we stopped waiting for, and bill for it,
    /// so the UI says so rather than implying a cancel is free.
    var cancellationMayLeaveWorkBilled: Bool { get }
}

nonisolated extension GenerationEngineRuntime {
    func idleTimeout(for request: GenerationRequest) -> Duration? { nil }
    var cancellationMayLeaveWorkBilled: Bool { false }
}

/// The immutable half of an engine: what it is, what models it has, and how it
/// turns the UI's draft into a request payload.
///
/// Separate from `GenerationEngineRuntime`, which owns loaded pipelines and the
/// active generation, so the UI can read engine and model facts withou
```

### Core Architecture Module: `Mochi Diffusion/Support/GenerationState.swift`
```
//
//  GenerationState.swift
//  Mochi Diffusion
//

import Foundation
import Observation

@MainActor
@Observable
final class GenerationState {
    nonisolated enum ProgressKind: Sendable, Equatable {
        case step
        case preview
    }

    /// `nonisolated` because these are pure data that cross isolation on every
    /// generation. Nested in a `@MainActor` type under
    /// `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, their members would otherwise
    /// be main-actor-isolated despite the `Sendable` conformance, and code off the
    /// main actor could not read them.
    nonisolated struct Progress: Sendable, Equatable {
        let step: Int
        let stepCount: Int
        let kind: ProgressKind

        init(step: Int, stepCount: Int, kind: ProgressKind = .step) {
            self.step = step
            self.stepCount = stepCount
            self.kind = kind
        }

        var localizedLabel: String {
            let current = step + 1
            switch kind {
            case .step:
                return String(
                    localized: "Step \(current)/\(stepCount)",
                    comment: "Progress through a model's generation steps"
                )
            case .preview:
                return String(
                    localized: "Preview \(current)/\(stepCount)",
                    comment: "Progress through partial preview images from a hosted service"
                )
            }
        }
    }

    nonisolated enum Status: Sendable, Equatable {
        case ready(String?)
        case error(String)
        case loading(String?)
        case canceling(String?)
        case running(Progress?)

        /// What this status has to tell the user, if anything.
        ///
        /// Only the two terminal cases. `.loading` and `.canceling` carry stage
        /// text, which describes work in progress and is replaced by the next
        /// stage rather than being news to report.
        var outcomeMessage: String? {
            switch self {
            case .error(let message): message
            case .ready(let message): message
            case .loading, .canceling, .running: nil
            }
        }
    }

    static let shared = GenerationState()

    private(set) var state: Status = .ready(nil)

    /// Outcomes the user has not dismissed yet, oldest first.
    ///
    /// Held apart from `state` because `state` is only the *current* status, and
    /// the next request overwrites it. The queue keeps draining after a failure,
    /// so identical messages collapse into one alert.
    ///
    /// Every message counts, not only `.error`. A refused prompt or a rate limit
    /// is not a malfunction, but it still ends a request having produced no image.
    private(set) var unreportedOutcomes: [String] = []

    /// What the user has dismissed during the batch now draining.
    ///
    /// Acknowledging a message silences it for the rest of the batch, so later
    /// requests failing the same way do not reopen the alert.
    private var acknowledged: Set<String> = []

    /// The only way `state` changes, so an outcome cannot reach the UI without
    /// also being recorded for the alert to report.
    func report(_ status: Status) {
        state = status
        guard let message = status.outcomeMessage else { return }
        guard !acknowledged.contains(message) else { return }
        guard !unreportedOutcomes.contains(message) else { return }
        unreportedOutcomes.append(message)
    }

    func clearUnreportedOutcomes() {
        acknowledged.formUnion(unreportedOutcomes)
        unreportedOutcomes = []
    }

    /// A batch starting forgets what was dismissed during the last one.
    ///
    /// Called when the user asks for a generation, not when a drain begins or
    /// ends: the alert outlives the drain that raised it, and a request that fails
    /// before it is enqueued starts no drain.
    func noteBatchStarted() {
        acknowledged = []
    }
}

```

### Core Architecture Module: `Mochi Diffusion/Support/IrisEngineRuntime.swift`
```
//
//  IrisEngineRuntime.swift
//  Mochi Diffusion
//

import CoreGraphics
import Foundation

/// Runs Iris FLUX.2 requests.
///
/// The Iris C calls block inside the actor for the length of a generation, the
/// same trade `CoreMLEngineRuntime` documents.
///
/// Single-flight is enforced by `IrisSingleFlight`, *not* by this being an
/// actor. Actors are reentrant at every suspension point and `run` suspends four
/// times, so a second call would otherwise interleave and reset the C library's
/// process-global callback route and cancel flag under the first.
actor IrisEngineRuntime: GenerationEngineRuntime {
    private static let embeddingCache = FluxPromptEmbeddingCache(maxEntries: 16)

    func run(
        request: GenerationRequest,
        session: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws {
        // Held across the whole call, including its suspensions. Released on
        // every exit path — hence the explicit outcome rather than a `defer`,
        // which cannot await.
        await IrisSingleFlight.shared.acquire()

        // Checked here as well as inside the generation loop. Waiting for the lease
        // lasts as long as the generation ahead, so a request cancelled while
        // waiting must not go on to `iris_metal_init` and `iris_load_dir`.
        //
        // A cancelled waiter still takes its turn in the FIFO, but that turn is one
        // actor round-trip. The session's cancel flag is not the task's, so the
        // lease cannot remove it earlier.
        guard !session.isCancelled else {
            await IrisSingleFlight.shared.release()
            return
        }

        let outcome: Result<Void, any Error>
        do {
            try await runHoldingLease(request: request, session: session, onResult: onResult)
            outcome = .success(())
        } catch {
            outcome = .failure(error)
        }
        await IrisSingleFlight.shared.release()
        try outcome.get()
    }

    private func runHoldingLease(
        request: GenerationRequest,
        session: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws {
        // The single downcast of this engine's payload; a mismatch is a wiring
        // bug, not a pipeline the user could fix.
        guard let payload = request.payload as? IrisGenerationPayload else {
            throw EngineError.payloadDoesNotBelongToEngine(engine: .iris)
        }
        let modelDir = payload.modelDirectory

        session.emit(.state(.loading("Loading model...")))
        iris_clear_cancel()
        // The C loop stops when the library's own flag is set, and this runtime
        // cannot set it while it is inside the call that would notice. So the poke
        // is registered on the session and runs on whichever thread cancels.
        session.onCancel { iris_request_cancel() }
        // Match the CLI startup order so transformer load sees Metal availability.
        _ = iris_metal_init()
        IrisCallbackRouter.shared.begin(
            session: session,
            usePreview: request.useDenoisedIntermediates
        )
        defer {
            iris_clear_cancel()
            IrisCallbackRouter.shared.end(session: session)
            session.emit(.preview(nil))
        }
        guard let ctx = iris_load_dir(modelDir) else {
            throw IrisRuntimeError.loadFailed(fluxErrorMessage())
        }
        // Every reference the request carried, decoded below. Declared here so
        // the cleanup that follows owns each image as soon as it is appended.
        var referenceImages: [UnsafeMutablePointer<iris_image>] = []
        // Registered straight after the context exists, so a throw from
        // reference decoding or prompt encoding frees it too.
        defer {
            iris_set_step_image_callback(ctx, nil)
            iris_set_step_callback(nil)
            iris_set_phase_callback(nil)
            iris_free(ctx)
            for image in referenceImages {
                iris_image_free(image)
            }
        }

        iris_set_mmap(ctx, 1)
        iris_set_phase_callback(fluxPhaseCallback)
        iris_set_step_callback(fluxStepCallback)
        if request.useDenoisedIntermediates {
            iris_set_step_image_callback(ctx, fluxStepImageCallback)
        } else {
            iris_set_step_image_callback(ctx, nil)
        }
        let isDistilled = iris_is_distilled(ctx) != 0

        var embeddingLength: Int32 = 0
        var embeddings: [Float]?

        // Decoded up front so a failure is reported before any generation starts
        // rather than part-way through a batch. Already-decoded images are freed
        // by the `defer` above.
        for data in request.inputImageData {
            guard let decoded = Self.makeFluxImage(from: data) else {
                throw IrisRuntimeError.decodeStartingImageFailed
            }
            referenceImages.append(decoded)
        }
        // More than one reference means `iris_multiref`, which has no
        // `_with_embeddings` variant and encodes the prompt itself. A
        // multi-reference request therefore skips the embedding cache: embeddings
        // prepared here would be discarded.
        let usesMultiref = referenceImages.count > 1

        if isDistilled, !usesMultiref {
            if let cached = await Self.embeddingCache.lookup(
                modelDir: modelDir,
                prompt: request.prompt
            ) {
                embeddingLength = cached.seqLen
                embeddings = cached.values
            } else {
                guard let encoded = iris_encode_text(ctx, request.prompt, &embeddingLength) else {
                    throw IrisRuntimeError.generateFailed(fluxErrorMessage())
                }
                let textDim = Int(iris_text_dim(ctx))
                guard textDim > 0 else {
                    free(encoded)
                    throw IrisRuntimeError.generateFailed(
                        "Invalid text embedding dimension."
                    )
                }
                let elementCount = Int(embeddingLength) * textDim
                let rawEmbeddings = Array(UnsafeBufferPointer(start: encoded, count: elementCount))
                free(encoded)

                await Self.embeddingCache.store(
                    modelDir: modelDir,
                    prompt: request.prompt,
                    seqLen: embeddingLength,
                    values: rawEmbeddings
                )

                if let canonical = await Self.embeddingCache.lookup(
                    modelDir: modelDir,
                    prompt: request.prompt
                ) {
                    embeddingLength = canonical.seqLen
                    embeddings = canonical.values
                } else {
                    // Fallback preserves forward progress if cache write/read fails.
                    embeddings = rawEmbeddings
                }
            }
            // Keep peak memory lower before transformer work, even on cache hits.
            iris_release_text_encoder(ctx)
        }

        var seed = request.seed

        for _ in 0..<request.numberOfImages {
            if session.isCancelled {
                break
            }

            var params = iris_params.defaultParams
            params.width = Int32(request.size.width)
            params.height = Int32(request.size.height)
            // Resolved by IrisEngine.plan, so the queue, the generator and the
            // saved metadata cannot disagree about how many steps ran.
            params.num_steps = Int32(payload.stepCount)
            params.seed = Int64(seed)

            let image: UnsafeMutablePointer<iris_image>?
            if usesMultiref {
                image = Self.generateMultiref(
                    ctx: ctx,
                    prompt: request.prompt,
                    references: referenceImages,
                    params: &params
                )
            } else if let startingFluxImage = referenceImages.first {
                if isDistilled, let embeddings {
                    image = Self.generateImg2ImgWithEmbeddings(
                        ctx: ctx,
                        embeddings: embeddings,
                        embeddingLength: embeddingLength,
                        startingFluxImage: startingFluxImage,
                        params: &params
                    )
                } else {
                    image = iris_img2img(ctx, request.prompt, startingFluxImage, &params)
                }
            } else {
                if isDistilled, let embeddings {
                    image = Self.generateWithEmbeddings(
                        ctx: ctx,
                        embeddings: embeddings,
                        embeddingLength: embeddingLength,
                        params: &params
                    )
                } else {
                    image = iris_generate(ctx, request.prompt, &params)
                }
            }

            guard let image else {
                if session.isCancelled {
                    break
                }
                throw IrisRuntimeError.generateFailed(fluxErrorMessage())
            }
            defer { iris_image_free(image) }

            let metadata = Self.metadata(
                request: request,
                payload: payload,
                width: Int(image.pointee.width),
                height: Int(image.pointee.height),
                seed: seed,
                generatedDate: Date.now
            )

            guard let cgImage = Self.makeCGImage(from: UnsafePointer(image)),
                let imageData = await metadata.pngData(for: cgImage)
            else {
                throw IrisRuntimeError.encodeFailed
            }

            let result = GenerationResult(metadata: metadata, imageData: imageData)
            try await onRes
```

### Core Architecture Module: `Mochi Diffusion/Support/LocalEngines.swift`
```
//
//  LocalEngines.swift
//  Mochi Diffusion
//

import CoreML
import Foundation

/// Core ML Stable Diffusion: models converted with Apple's `ml-stable-diffusion`,
/// each a directory of `.mlmodelc` bundles.
nonisolated struct CoreMLStableDiffusionEngine: GenerationEngineDescriptor {
    typealias Model = SDModel
    typealias Payload = CoreMLGenerationPayload

    static let id = EngineID.coreMLStableDiffusion
    var displayName: String { "Core ML Stable Diffusion" }

    private let fileSystem: FileSystemStore

    init(fileSystem: FileSystemStore = FileSystemStore()) {
        self.fileSystem = fileSystem
    }

    func availability(_ settings: EngineSettings) async -> EngineAvailability {
        guard fileSystem.fileExists(settings.modelDirectory) else {
            return .unreachable(
                String(
                    localized: "Models folder not found",
                    comment: "Engine unavailable because its models folder is missing"
                )
            )
        }
        return .ready
    }

    func discoverModels(_ context: ModelDiscoveryContext) async throws -> [SDModel] {
        let controlNets = controlNets(in: context.settings.controlNetDirectory)
        return try context.localModelDirectories()
            .compactMap { url in
                SDModel(
                    url: url,
                    name: ModelID.localKey(for: url),
                    controlNet: hasControlNet(url) ? controlNets : []
                )
            }
    }

    func plan(draft: GenerationDraft, model: SDModel) throws
        -> GenerationPlan<CoreMLGenerationPayload>
    {
        // Every value the model will actually use, resolved here and nowhere
        // else. A fixed-size model overrides the sidebar's size; a persisted
        // guidance scale from another model is clamped rather than rejected.
        let constraints = model.constraints
        let size = constraints.size.resolved(draft.configuredSize)
        let stepCount = constraints.steps.resolved(draft.stepCount)
        let scheduler = constraints.scheduler.resolved(draft.scheduler)
        let strength = constraints.startingImage.strength
            .resolved(Double(draft.strength))
            .map(Float.init)
        let guidanceScale = constraints.guidanceScale
            .resolved(Double(draft.guidanceScale))
            .map(Float.init)
        let numberOfImages =
            constraints.numberOfImages.resolved(draft.numberOfImages) ?? draft.numberOfImages
        let quality = constraints.quality.resolved(draft.quality)
        let computeUnit = draft.computeUnitPreference.computeUnits(forModel: model)
        // Core ML denoises from one image and attends to no references, so only the
        // starting-image constraint is consulted.
        let inputs = constraints.startingImage.prepared(draft.startingImage, scaledTo: size)

        var controlNetNames: [String] = []
        var controlNetImageNames: [String?] = []
        var controlNetInputs: [Data] = []
        // A freeform model has no fixed size to scale guide images to, and
        // `SDModel` reports no matching nets for one, so its constraint is
        // `.unsupported` and the sidebar hides the control.
        if constraints.controlNet.isSupported {
            for controlNet in draft.controlNets {
                guard
                    let name = controlNet.name,
                    let image = controlNet.image,
                    let data = image.scaledAndCroppedTo(size: size)?.pngData()
                else { continue }
                controlNetNames.append(name)
                controlNetInputs.append(data)
                controlNetImageNames.append(controlNet.imageName?.normalizedFilename)
            }
        }

        return GenerationPlan<CoreMLGenerationPayload>(
            payload: CoreMLGenerationPayload(
                model: model,
                computeUnit: computeUnit,
                reduceMemory: draft.reduceMemory,
                disableSafety: !draft.safetyChecker,
                controlNetDirectory: draft.controlNetDirectory,
                strength: strength ?? draft.strength,
                guidanceScale: guidanceScale ?? draft.guidanceScale,
                stepCount: stepCount ?? draft.stepCount,
                scheduler: scheduler ?? draft.scheduler
            ),
            size: size,
            startingImageData: inputs.data.first,
            inputImageData: [],
            controlNetImageData: controlNetInputs,
            controlNetNames: controlNetNames,
            controlNetImageNames: controlNetImageNames,
            stepCount: stepCount,
            scheduler: scheduler,
            strength: strength,
            guidanceScale: guidanceScale,
            quality: quality,
            numberOfImages: numberOfImages,
            mlComputeUnit: computeUnit,
            // Core ML denoises from its one image, so it records a *starting*
            // image. Same sidebar list, different metadata vocabulary.
            startingImageName: inputs.names.first ?? nil,
            inputImageNames: []
        )
    }

    /// Matches on the model name's prefix before the first underscore and on
    /// orientation, which is how converted sets are named in practice —
    /// `foo_512x768` beside `foo_768x512`.
    ///
    /// A naming heuristic, kept inside the engine: how one engine's model files are
    /// named is not something the sidebar should know.
    func model(forSize size: CGSize, among candidates: [SDModel], current: SDModel) -> SDModel? {
        func orientation(width: Double, height: Double) -> Int {
            if width > height { return 1 }
            if width < height { return -1 }
            return 0
        }

        let wanted = orientation(width: size.width, height: size.height)
        let prefix = current.name.split(separator: "_").first
        return candidates.first { candidate in
            guard
                candidate.name.split(separator: "_").first == prefix,
                let candidateSize = candidate.inputSize
            else { return false }
            return orientation(width: candidateSize.width, height: candidateSize.height) == wanted
        }
    }

    func makeRuntime() -> any GenerationEngineRuntime {
        CoreMLEngineRuntime()
    }

    private func hasControlNet(_ url: URL) -> Bool {
        fileSystem.fileExists(url.appending(components: "ControlledUnet.mlmodelc", "metadata.json"))
    }

    private func controlNets(in directory: URL) -> [SDControlNet] {
        guard fileSystem.fileExists(directory),
            let contents = try? fileSystem.contentsOfDirectory(at: directory)
        else {
            return []
        }
        return contents.compactMap { SDControlNet(url: $0) }
    }
}

/// Iris: FLUX.2 and Z-Image models in diffusers layout, run through the bundled
/// Iris library.
nonisolated struct IrisEngine: GenerationEngineDescriptor {
    typealias Model = IrisFluxKleinModel
    typealias Payload = IrisGenerationPayload

    static let id = EngineID.iris
    var displayName: String { "Iris" }

    /// What `iris_multiref` accepts for Klein, per its declaration in `iris.h`:
    /// "up to 4 reference images for klein".
    ///
    /// A limit of the library rather than a policy of ours, so it lives beside the
    /// code that calls it.
    static let maxReferenceImages = 4

    private let fileSystem: FileSystemStore

    init(fileSystem: FileSystemStore = FileSystemStore()) {
        self.fileSystem = fileSystem
    }

    func availability(_ settings: EngineSettings) async -> EngineAvailability {
        guard fileSystem.fileExists(settings.modelDirectory) else {
            return .unreachable(
                String(
                    localized: "Models folder not found",
                    comment: "Engine unavailable because its models folder is missing"
                )
            )
        }
        return .ready
    }

    func discoverModels(_ context: ModelDiscoveryContext) async throws -> [IrisFluxKleinModel] {
        try context.localModelDirectories()
            .compactMap { IrisFluxKleinModel(url: $0, name: ModelID.localKey(for: $0)) }
    }

    func plan(draft: GenerationDraft, model: IrisFluxKleinModel) throws
        -> GenerationPlan<IrisGenerationPayload>
    {
        // Read from the model's constraints, which is the same declaration the
        // sidebar reads, so the field it shows and the value used here cannot
        // disagree.
        let constraints = model.constraints
        let size = constraints.size.resolved(draft.configuredSize)
        let stepCount = constraints.steps.resolved(draft.stepCount)
        let scheduler = constraints.scheduler.resolved(draft.scheduler)
        let numberOfImages =
            constraints.numberOfImages.resolved(draft.numberOfImages) ?? draft.numberOfImages
        // Attention cost grows with the square of the sequence length times the
        // head count, and references add tokens to that sequence, so full-size
        // references against a large output can ask for more memory than the
        // machine has. The estimator predicts a size per reference that fits, and
        // each is fitted to it here.
        let budget = Self.budgetReport(
            for: draft.inputImages,
            model: model,
            outputSize: size,
            constraint: constraints.inputImages
        )
        let inputs = constraints.inputImages.prepared(draft.inputImages) { image, index in
            guard let fitted = budget?.predictedReferenceSizes[safe: index] else { return nil }
            return IrisReferenceImageProcessor.resizedAndCroppedToTokenGrid(image, to: fitted)
        }

        return GenerationPlan<IrisGenerationPayload>(
            payload: IrisGenerationPayload(
                modelDirectory: model.url.path(percentEncoded: false),
                family: model.family,
                stepCount: stepCount ?? model.family.s
```

### Core Architecture Module: `Mochi Diffusion/Support/OpenAIEngineRuntime.swift`
```
//
//  OpenAIEngineRuntime.swift
//  Mochi Diffusion
//

import CoreGraphics
import Foundation

/// Runs a generation against the OpenAI image API.
///
/// Streams, and not only for previews: a non-streaming call gives no sign of life
/// until it returns, which would make `idleTimeout` a wall-clock budget rather than
/// an idle one. Partial images are the heartbeat that makes the bound meaningful.
nonisolated final class OpenAIEngineRuntime: GenerationEngineRuntime {
    private static let generationsEndpoint = URL(
        string: "https://api.openai.com/v1/images/generations"
    )!
    private static let editsEndpoint = URL(string: "https://api.openai.com/v1/images/edits")!
    /// The most the API accepts. Requested only when previews are on.
    private static let maxPartialImages = 3

    private let secrets: any SecretStore
    private let account: String
    private let session: any HTTPSession

    init(secrets: any SecretStore, account: String, session: any HTTPSession) {
        self.secrets = secrets
        self.account = account
        self.session = session
    }

    /// Bounds silence when there is a heartbeat to measure it against, and total
    /// duration when there is not.
    ///
    /// With partial images requested, every one is a sign of life, so a minute of
    /// silence means the stream has stopped even though a high-quality 3840x2160
    /// image can legitimately take minutes to finish.
    ///
    /// With `partial_images: 0` the only event is the final one, so nothing resets
    /// an idle clock and the same number would become a total budget, expiring a slow
    /// but healthy generation. That case gets an explicitly generous total budget.
    ///
    /// Partials are not requested purely as heartbeats: that would fetch images the
    /// user asked not to receive, and whether streamed partials affect billing is
    /// unconfirmed.
    static let streamingIdleTimeout = Duration.seconds(60)
    static let nonStreamingTotalTimeout = Duration.seconds(300)

    var cancellationMayLeaveWorkBilled: Bool { true }

    func idleTimeout(for request: GenerationRequest) -> Duration? {
        guard let payload = request.payload as? OpenAIGenerationPayload else { return nil }
        return payload.wantsPreviews
            ? Self.streamingIdleTimeout
            : Self.nonStreamingTotalTimeout
    }

    func run(
        request: GenerationRequest,
        session generationSession: GenerationSession,
        onResult: @escaping @Sendable (GenerationResult) async throws -> Void
    ) async throws {
        guard let payload = request.payload as? OpenAIGenerationPayload else {
            throw EngineError.payloadDoesNotBelongToEngine(engine: OpenAIImageEngine.id)
        }
        // Read at run time, never carried in the payload: a payload is queued and
        // logged, and a credential belongs in neither.
        guard let apiKey = secrets.secret(for: account), !apiKey.isEmpty else {
            throw GenerationError.authenticationFailed
        }

        generationSession.emit(
            .state(
                .loading(
                    String(
                        localized: "Generating with OpenAI...",
                        comment: "Text displayed while waiting for OpenAI image generation"
                    )
                )
            )
        )

        // Registered once, cancelling whichever image is in flight.
        //
        // Polling `isCancelled` is not enough here: a network call can stay
        // suspended on response headers or the next stream line indefinitely. So
        // the work runs in a task the handler can cancel, which terminates the
        // stream and cancels the underlying transfer.
        let inFlight = TaskHandle()
        generationSession.onCancel { inFlight.cancel() }

        // One request per image: cancelling after the second of five costs two
        // rather than five, results reach the gallery as they arrive, and
        // partial-image previews are per-request.
        for _ in 0..<request.numberOfImages {
            if generationSession.isCancelled { return }

            let image = try await generateOne(
                request: request,
                payload: payload,
                apiKey: apiKey,
                session: generationSession,
                inFlight: inFlight
            )
            guard let image else { return }
            if generationSession.isCancelled { return }

            let result = try await makeResult(
                image: image,
                request: request,
                payload: payload
            )
            try await onResult(result)
        }
    }

    // MARK: - One image

    /// Returns the finished image, or `nil` if the session stopped first.
    private func generateOne(
        request: GenerationRequest,
        payload: OpenAIGenerationPayload,
        apiKey: String,
        session generationSession: GenerationSession,
        inFlight: TaskHandle
    ) async throws -> CGImage? {
        let urlRequest = try makeURLRequest(request: request, payload: payload, apiKey: apiKey)

        // Both awaits below can suspend indefinitely, so both are inside the
        // cancellable task rather than only the loop.
        let work = Task { () throws -> CGImage? in
            try await self.stream(
                urlRequest: urlRequest,
                payload: payload,
                session: generationSession
            )
        }
        inFlight.adopt(work)
        do {
            return try await work.value
        } catch is CancellationError {
            // Stopped on purpose, by the user or the watchdog. The queue reads the
            // session's stop reason to tell which.
            return nil
        }
    }

    /// The suspending half, in its own function so the task above wraps all of it.
    private func stream(
        urlRequest: URLRequest,
        payload: OpenAIGenerationPayload,
        session generationSession: GenerationSession
    ) async throws -> CGImage? {
        let (response, lines) = try await session.lines(for: urlRequest)

        guard (200..<300).contains(response.statusCode) else {
            throw await Self.error(for: response, lines: lines)
        }

        let partialsRequested = payload.wantsPreviews ? Self.maxPartialImages : 0
        var finished: CGImage?

        for try await line in lines {
            if generationSession.isCancelled { return nil }
            guard let event = Self.event(from: line) else { continue }

            switch event.type {
            case "image_generation.partial_image", "image_edit.partial_image":
                guard payload.wantsPreviews, let image = event.image else { continue }
                // `partial_image_index` carries no total, but we chose the total,
                // so this progress is measured rather than invented.
                generationSession.emit(
                    .progress(
                        GenerationState.Progress(
                            step: event.partialIndex ?? 0,
                            stepCount: partialsRequested,
                            kind: .preview
                        )
                    )
                )
                generationSession.emit(.preview(image))
            case "image_generation.completed", "image_edit.completed":
                guard let image = event.image else { throw GenerationError.malformedResponse }
                finished = image
            case "error":
                throw GenerationError.serviceFailure(event.message ?? "Unknown error")
            default:
                continue
            }
        }

        // Cancelling terminates the stream, so the loop above ends without a
        // completed event. That is a stop, not a malformed response, and reporting
        // it as the latter would turn every cancellation into an error.
        if generationSession.isCancelled { return nil }
        guard let finished else {
            // The stream ended without a completed event. Not a refusal, which the
            // service states, and not a stop, which is handled above — so it is a
            // shape we do not understand.
            throw GenerationError.malformedResponse
        }
        return finished
    }

    private func makeURLRequest(
        request: GenerationRequest,
        payload: OpenAIGenerationPayload,
        apiKey: String
    ) throws -> URLRequest {
        var fields: [String: Any] = [
            "model": payload.apiModel,
            "prompt": request.prompt,
            "size": "\(Int(payload.size.width))x\(Int(payload.size.height))",
            // One image per call; the loop above handles the count.
            "n": 1,
            // Always PNG: lossless, and re-encoded anyway, since Mochi embeds its
            // own metadata and applies the user's chosen output type on the way to
            // disk.
            "output_format": "png",
            "moderation": "low",
            "stream": true,
            "partial_images": payload.wantsPreviews ? Self.maxPartialImages : 0,
        ]
        // `auto` is the service's own default, so sending it says nothing. Omitted
        // rather than sent, to keep the request to what was actually chosen.
        if payload.quality != .auto {
            fields["quality"] = payload.quality.rawValue
        }

        var urlRequest = URLRequest(
            url: request.inputImageData.isEmpty ? Self.generationsEndpoint : Self.editsEndpoint
        )
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("text/event-stream", forHTTPHeaderField: "Accept")

        if request.inputImageData.isEmpty {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONSerialization.data(withJSONObject: fields)
        } else {

```

### Core Architecture Module: `Mochi Diffusion/Support/OpenAIImageEngine.swift`
```
//
//  OpenAIImageEngine.swift
//  Mochi Diffusion
//

import Foundation

/// A model offered by the OpenAI image API.
///
/// `name` doubles as the API's model identifier, and is also the `ModelID.key`, so
/// an image's recorded `modelKey` names the model exactly.
nonisolated struct OpenAIImageModel: EngineModel {
    let id: ModelID
    let name: String
    let constraints: OptionConstraints
    let metadataFields: Set<MetadataField>

    /// No local tokenizer, so the sidebar shows no token count. `nil` is a real
    /// answer here rather than a missing one.
    var tokenizerModelDir: URL? { nil }

    /// What to send as `model`.
    var apiName: String { id.key }
}

/// Image generation through the OpenAI API.
///
/// The credential store is taken at construction with no default, so every
/// construction site has to choose one. It lives on the descriptor because that is
/// the only place that can hand it to both `availability` and the runtime, which
/// `makeRuntime()` builds without settings.
///
/// The key never enters the payload: a payload rides in a `GenerationRequest`, which
/// is queued, logged and inspected. The runtime reads the key when it runs.
nonisolated struct OpenAIImageEngine: GenerationEngineDescriptor {
    typealias Model = OpenAIImageModel
    typealias Payload = OpenAIGenerationPayload

    static let id = EngineID.openAI
    var displayName: String { "OpenAI" }

    private let secrets: any SecretStore
    private let session: any HTTPSession

    init(secrets: any SecretStore, session: any HTTPSession = URLSessionHTTPSession()) {
        self.secrets = secrets
        self.session = session
    }

    /// The account name the credential is filed under. The engine id rather than
    /// anything user-visible, so renaming the display name cannot orphan a key.
    static var secretAccount: String { id.rawValue }

    func availability(_ settings: EngineSettings) async -> EngineAvailability {
        // Existence, not the secret. This runs on every discovery pass.
        guard secrets.hasSecret(for: Self.secretAccount) else {
            return .needsConfiguration(
                String(
                    localized: "Add an API key in Settings",
                    comment: "Hosted engine unavailable because no API key is stored"
                )
            )
        }
        return .ready
    }

    /// A hand-maintained list. `/v1/models` returns everything the account can see
    /// and does not mark which models generate images, so it cannot drive a picker.
    ///
    /// Every entry has verified constraints: a wrong `SizeConstraint` produces
    /// requests the service rejects, or silently corrects sizes the user could
    /// have had. Add models by reading the current documentation, not by
    /// pattern-matching an existing entry.
    ///
    /// Ignores the models folder entirely, so an unreadable local directory
    /// cannot make this engine look broken.
    func discoverModels(_ context: ModelDiscoveryContext) async throws -> [OpenAIImageModel] {
        [Self.gptImage2, Self.gptImage25Flare, Self.gptImage25Sunburst]
    }

    func plan(draft: GenerationDraft, model: OpenAIImageModel) throws
        -> GenerationPlan<OpenAIGenerationPayload>
    {
        let constraints = model.constraints
        let size = constraints.size.resolved(draft.configuredSize)
        let quality = constraints.quality.resolved(draft.quality)
        let numberOfImages =
            constraints.numberOfImages.resolved(draft.numberOfImages) ?? draft.numberOfImages
        // Reference images keep their cropped native resolution. Iris's fitting
        // is an engine-specific attention-budget workaround; the hosted API has
        // no equivalent local budget for us to predict or enforce.
        let inputs = constraints.inputImages.prepared(draft.inputImages) { _, _ in nil }

        return GenerationPlan(
            payload: OpenAIGenerationPayload(
                apiModel: model.apiName,
                size: size,
                // Non-optional in the payload for the same reason Core ML's
                // strength is: the request carries an optional so the queue knows
                // whether to draw a row, and the runtime wants the value it will
                // actually send.
                quality: quality ?? .auto,
                wantsPreviews: draft.showGenerationPreview
            ),
            size: size,
            startingImageData: nil,
            inputImageData: inputs.data,
            controlNetImageData: [],
            controlNetNames: [],
            controlNetImageNames: [],
            // Nothing to invent: this service exposes no step count, sampler,
            // strength or guidance scale, and the plan says so rather than
            // coercing a value that metadata would then hide.
            stepCount: nil,
            scheduler: nil,
            strength: nil,
            guidanceScale: nil,
            quality: quality,
            numberOfImages: numberOfImages,
            mlComputeUnit: nil,
            startingImageName: nil,
            inputImageNames: inputs.names
        )
    }

    func makeRuntime() -> any GenerationEngineRuntime {
        OpenAIEngineRuntime(
            secrets: secrets,
            account: Self.secretAccount,
            session: session
        )
    }
}

// MARK: - The model list

nonisolated extension OpenAIImageEngine {
    /// An app safety limit, not a documented service limit. It bounds multi-file
    /// drops and is high enough to exercise substantial reference sets without
    /// claiming Mochi can safely ingest an arbitrary selection.
    static let maxInputImages = 16

    /// Limits read from the image generation guide on 2026-09-09. GPT Image 2
    /// and both GPT Image 2.5 variants share this geometry.
    ///
    /// The per-dimension floor is derived rather than quoted: the guide gives a
    /// total-pixel minimum and a 3:1 ratio cap but no per-edge minimum, and the
    /// smallest edge any legal size can have is the one where the long edge is
    /// exactly three times it — `3s² >= 655_360`, so `s >= 468`, which is 480 on
    /// the 16px grid.
    private static func imageModel(
        apiName: String,
        qualities: [ImageQuality]
    ) -> OpenAIImageModel {
        OpenAIImageModel(
            id: ModelID(engine: OpenAIImageEngine.id, key: apiName),
            name: apiName,
            constraints: OptionConstraints(
                supportsNegativePrompt: false,
                size: .freeform(
                    range: 480...3_840,
                    step: 16,
                    limits: SizeLimits(
                        maxAspectRatio: 3,
                        pixelBounds: 655_360...8_294_400
                    )
                ),
                steps: .unsupported,
                guidanceScale: .unsupported,
                scheduler: .unsupported,
                startingImage: .unsupported,
                inputImages: .supported(maxCount: maxInputImages),
                controlNet: .unsupported,
                quality: .oneOf(qualities),
                // Ours to choose, not the API's: one request is sent per image,
                // so this bounds our own loop. Tighter than the local engines'
                // 1...100, with no room above it, because every image here is
                // billed.
                numberOfImages: .range(1...10, step: 1),
                promptTokenLimit: nil
            ),
            // No `.seed`: the service exposes no seed, so recording one would put
            // a number in the metadata that had no effect on the image. A seed is
            // still generated for the output filename, which is all it is used
            // for here.
            //
            // No `.revisedPrompt` either: a revision is documented for the
            // Responses API image tool, not this endpoint, and a metadata key is a
            // permanent export contract.
            metadataFields: [
                .prompt, .model, .engine, .modelKey, .size, .quality, .inputImages,
            ]
        )
    }

    static let gptImage2 = imageModel(
        apiName: "gpt-image-2",
        qualities: [.auto, .low, .medium, .high]
    )

    static let gptImage25Flare = imageModel(
        apiName: "gpt-image-2.5-flare",
        qualities: [.auto, .low, .medium, .high, .xhigh, .max]
    )

    static let gptImage25Sunburst = imageModel(
        apiName: "gpt-image-2.5-sunburst",
        qualities: [.auto, .low, .medium, .high, .xhigh, .max]
    )
}

/// What this engine's generation needs beyond the values every engine reports.
///
/// Carries no credential. See ``OpenAIImageEngine``.
nonisolated struct OpenAIGenerationPayload: Sendable {
    let apiModel: String
    let size: CGSize
    let quality: ImageQuality
    /// Whether to ask for streamed partial images. Maps
    /// `showGenerationPreview` onto this API's `partial_images`.
    let wantsPreviews: Bool
}

```

### Core Architecture Module: `Mochi Diffusion/Support/QuickLookState.swift`
```
//
//  QuickLookState.swift
//  Mochi Diffusion
//

import Foundation
import Observation

@MainActor
@Observable
final class QuickLookState {
    var url: URL?
    private var currentImageID: SDImage.ID?

    func toggle(image: SDImage?) {
        guard let image else {
            close()
            return
        }

        if currentImageID == image.id, url != nil {
            close()
            return
        }

        updateURL(for: image)
    }

    func updateSelection(_ image: SDImage?) {
        guard self.url != nil, let image else {
            close()
            return
        }

        updateURL(for: image)
    }

    func close() {
        currentImageID = nil
        url = nil
    }

    /// Points Quick Look at the file itself whenever there is one.
    ///
    /// A gallery image on disk needs no decoding, no re-encoding and no temporary
    /// copy. Only an image with no path, in practice a generation result not yet
    /// saved, is encoded to a temporary file.
    private func updateURL(for image: SDImage) {
        currentImageID = image.id

        if !image.path.isEmpty {
            url = URL(fileURLWithPath: image.path, isDirectory: false)
            return
        }

        guard
            let url = try? image.image?
                .asTransferableImage().image
                .temporaryFileURL()
        else {
            close()
            return
        }
        self.url = url
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #491** (2026-02-28): **Crash when generating portrait-oriented images**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  16GB  ### What happened?  ### Environment - **Mochi Diffusion Version**: 5.2 - **Compute Unit**: CPU & GPU  ### Description Mochi Diffusion crashes consistently when generating images in portrait orientation (e.g., 768x1024), while landscape (e.g., 1280x768) and square (1024x1024) orientations work without issues. This occurs with all SDXL models tested.  ### Steps to Reproduce 1. Load any SDXL Core ML model 2. Set image dimensions to portrait orientation (e.g., 768x1024 or 896x1152) 3. Start image generation 4. App crashes during generation  ### Root Cause The crash is caused by integer division in `GalleryPreviewView.swift` at line 32: ```swift .aspectRatio(CGFloat(image.width / image.height), contentMode: .fit) ```  **Problem:** - `image.width` and `image.height` are Integers - Integer division: `768 / 1024 = 0` (not 0.75) - `CGFloat(0)` causes invalid aspect ratio → crash - Landscape works by accident: `1280 / 768 = 1` (though incorrect, but doesn't crash)    ### Crash Log  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks! This has been fixed in the latest release

- **Issue #460** (2026-03-01): **Homebrew update fails: SHA256 mismatch**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  Updating to 5.2 with Homebrew fails.  ### Crash Log  ```shell Error: SHA256 mismatch Expected: fbb7ec461bb2f4056e4ace50758307d7a622cdc04b70ef01148f1f521386681c   Actual: 81d35c1d5e0c9cf83173681ca830a882c857de3531e7c744d5c7588cd0e38a26     File: /Users/xxxxxxx/Library/Caches/Homebrew/downloads/57b4a9167c21e72132ed5f25c9cc11321eef4526a8b9cb591b768277169f60fb--MochiDiffusion_v5.2.dmg ``` 
  **Post-Mortem & Fix Analysis**:
  > I uploaded MochiDiffusion_v5.2.dmg and then had to take it down and reupload a new copy because it didn’t have the correct signing information for Sparkle. I assume that Homebrew captured a SHA of the first uploaded dmg, which doesn’t match the new one.   I’ll try to sort it out sometime this weekend, sorry for the inconvenience.
  > Thanks!

- **Issue #459** (2024-10-30): **changed code signature in release 5.2?**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  hello - I've noticed that the code signature has changed between version 5.1 and 5.2 - can anyone confirm this?  Thank you!      ### Crash Log  ```shell EXPECTED 'Joshua Park (TCQ6328PP6)'  FOUND 'Graham Bing (9VV558X8J3)' ``` 
  **Post-Mortem & Fix Analysis**:
  > Yes, hello, I’m Graham Bing. Joshua (@godly-devotion) wanted to step back from Mochi and so he passed on maintainership to me a few months ago.  If you have any questions or concerns, please let me know.
  > great - thanks for the clarification! 

- **Issue #437** (2024-08-11): **Bug in Recognizing Split Bin Files During Model Conversion Process**
  *Symptoms*: ### Processor  M1 Pro (or later)  ### Memory  16GB  ### What happened?  When I try to convert a diffuser model to an MLMODELC model, it shows an error: `OSError: Error no file named diffusion_pytorch_model.bin found in directory PVC_diffusers/unet.` I found that the bin file was split into two parts: `diffusion_pytorch_model-00001-of-00002.bin` and `diffusion_pytorch_model-00002-of-00002.bin`. <img width="459" alt="the file" src="https://github.com/MochiDiffusion/MochiDiffusion/assets/86539564/787d477f-bf0e-4445-b2e8-bd53e549c90c"> The conversion code should be modified to handle this situation.   ---  ### Solution **TL;DR** Just add the `--to_safetensors` flag when convert the SD model to the Diffusers pipeline and no need to change your current environment.  When we call the `ModelMixin.save_pretained` from `modeling_utils`, if the unet model is larger than the max_shard_size(default is 10GB), it will save the unet model in split bin files. But the `DiffusionPipeline.from_pretrained` can't load the split bin file and it's a bug of Diffusers.  This function can only load split files in safetensor format, so use the ` --to_safetensors` flag.
  **Post-Mortem & Fix Analysis**:
  > have the same error
  > check out https://github.com/MochiDiffusion/MochiDiffusion/pull/441
  > same issue

- **Issue #436** (2026-03-01): **Unable to open mach-O at path: default.metallib  Error:2**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  the app compiles successfully but once started it gives me "Unable to open mach-O at path: default.metallib  Error:2"  when  try to generate image it give the following errors    Found 1 model(s) Invalid group id in source layers: var_48_cast_fp16 Invalid group id in source layers: var_49_cast_fp16 Invalid group id in source layers: var_109_cast_fp16 Invalid group id in source layers: var_110_cast_fp16   hint : the model I downloaded from hugging face is : Found 1 model(s) animagine-xl-3.1_split-einsum_6bit_1024x1024     ### Crash Log  _No response_
  **Post-Mortem & Fix Analysis**:
  > the first problem  "Unable to open mach-O at path: default.metallib Error:2" solved by going to build setting  : info.plist values and enabling metal capture , it was disabled by default  however the remaining errors "Invalid group id in source layers: var_48_cast_fp16" still coming when I try to generate the images 
  > "Unable to open mach-O at path: default.metallib Error:2"  For those struggling to find the location of the Metal setting, go to Build Settings, and then click 'All'. From there scroll down until you find 'Info.plist Values'. The metal setting is titled 'Metal Capture Enabled'.  Set this to Yes.
  > Closing for now because I'm unable to repro the "Invalid group id in source layers" issue. If this still occurs, please reopen and we can coordinate to try to resolve  

- **Issue #433** (2024-06-26): **Generation speed massively decreased**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  32GB  ### What happened?  Hi there and thanks for MochiDiffusion.  I have a question regarding what may have impacted the generation speed on my M1 Pro. Yesterday I could generate pictures with the settings as below in approximately 12 seconds. I was blown away by the speed! However, today with the same settings (via `Copy Options to Sidebar`) it takes about 45 seconds. Do you have any idea, what may be the reason for this? ``` Date: 28. May 2024 at 23:04:16  Model: stable-diffusion-v2.1-base_split-einsum_compiled  Size: 2048 x 2048 (Upscaled using RealESRGAN)  Include in Image: cowboy fashion  Exclude from Image:   Seed: 1957878024  Steps: 12  Guidance Scale: 11.0  Scheduler: DPM-Solver++  ML Compute Unit: CPU & Neural Engine ```  ### Crash Log  _No response_
  **Post-Mortem & Fix Analysis**:
  > Your ML compute unit is set to `CPU & Neural Engine`, is it possible that you changed it from `Auto` or `CPU & GPU` in settings?   You could try turning off Reduce Memory Usage  and Show Image Preview in settings, both of those have an impact on generation speed, but I think the ML Compute Unit is the most likely culprit.

- **Issue #415** (2024-03-15): **Tokenizer out of sync with current selected model**
  *Symptoms*: ### Processor  M1 Ultra (or later)  ### Memory  64GB (or higher)  ### What happened?  The tokenizer used to calculate the tokens count of the prompt and negative prompt is created from the model last used in `ImageGenerator.loadPipeline()`  This made sense when `loadPipeline()` was called whenever user selected a new model, but with [queued generation jobs](https://github.com/godly-devotion/MochiDiffusion/pull/339/) `loadPipeline` isn't called until the instant before the generation job is run. As a consequence:  - no tokenizer will be created until an initial generation is run, and token counts in `PromptView` will fall back on the ~4 chars per token estimation algorithm - tokenizer won't match the current model when model changes (In practice most models seem to use the same or a similar tokenizer so this doesn't really matter)  ### Crash Log  _No response_

- **Issue #395** (2026-03-01): **Quick Look does not work**
  *Symptoms*: I think it has problem with switching between upscaled images  https://github.com/godly-devotion/MochiDiffusion/assets/2387356/60877611-f69a-4cec-b0a8-7a30eb6016a3 
  **Post-Mortem & Fix Analysis**:
  > In [v6.0](https://github.com/MochiDiffusion/MochiDiffusion/releases/tag/v6.0) there were some changes to how quicklook works. Also, upscaling was removed.  Closing this issue as stale and possibly (hopefully?) resolved, but if it is still observed please reopen.

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

### Incident Patch 1: `5e978c69` (2026-09-30)
**Commit Message**: build: add v6.2 to the Sparkle appcast

Publishes the 6.2 update: build 958, the notarized DMG from the GitHub
release, and its Sparkle signature, verified against the app's public key.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.sparkle/appcast.xml` (modified, +23/-0)
```diff
@@ -4,6 +4,29 @@
     <title>Mochi Diffusion</title>
     <language>en</language>
 
+    <item>
+      <title>v6.2</title>
+      <link>https://github.com/MochiDiffusion/MochiDiffusion</link>
+      <sparkle:shortVersionString>6.2</sparkle:shortVersionString>
+      <sparkle:version>958</sparkle:version>
+      <sparkle:minimumSystemVersion>15.6</sparkle:minimumSystemVersion>
+      <sparkle:fullReleaseNotesLink>https://github.com/MochiDiffusion/MochiDiffusion/releases</sparkle:fullReleaseNotesLink>
+      <pubDate>Wed, 30 Sep 2026 03:56:55 +0000</pubDate>
+      <enclosure
+        url="https://github.com/MochiDiffusion/MochiDiffusion/releases/download/v6.2/MochiDiffusion_6.2.dmg"
+        sparkle:edSignature="EK59AS0IUbZ3OmPz17bJplQU/OJnLdS/TTRKKQrade4jIp9nEtf7YUhk8RyEm6QvzXIm3NITyexJlcumAoJ5Cg=="
+        length="4500489"
+        type="application/octet-stream" />
+      <description><![CDATA[
+      <ul>
+      <li>Reads and writes image metadata with Musubi</li>
+      <li>Imports generation settings from other common image generators</li>
+      <li>Adds AUTOMATIC1111-compatible metadata to images, which sites like Civitai read on upload</li>
+      </ul>
+      ]]>
+      </description>
+    </item>
+
     <item>
       <title>v6.1.2</title>
       <link>https://github.com/MochiDiffusion/MochiDiffusion</link>
```

---

### Incident Patch 2: `f9c453d0` (2026-09-29)
**Commit Message**: build: bump app version to 6.2

Sets MARKETING_VERSION to 6.2 for the app target's Debug and Release
configurations.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -1135,7 +1135,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 15.6;
-				MARKETING_VERSION = 6.1.2;
+				MARKETING_VERSION = 6.2;
 				OTHER_LDFLAGS = "$(BUILD_DIR)/vendor/iris/$(CONFIGURATION)/libiris_mps.a";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor;
@@ -1171,7 +1171,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 15.6;
-				MARKETING_VERSION = 6.1.2;
+				MARKETING_VERSION = 6.2;
 				OTHER_LDFLAGS = "$(BUILD_DIR)/vendor/iris/$(CONFIGURATION)/libiris_mps.a";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor;
```

---

### Incident Patch 3: `152f159d` (2026-09-29)
**Commit Message**: fix: align slider value text with its editing field

The editing field now uses the plain text field style with its focus
effect disabled, so it has no bezel inset to compensate for. The label
shown while not editing drops the padding that matched the bezeled
field, and the two now line up without depending on the OS's bezel
metrics.

**File**: `Mochi Diffusion/Views/SidebarControls/MochiSlider.swift` (modified, +3/-9)
```diff
@@ -45,24 +45,18 @@ struct MochiSlider: View {
         CompactSlider(value: $value, in: bounds, step: step) {
             if isEditable {
                 TextField("", text: $text)
+                    .textFieldStyle(.plain)
+                    .focusEffectDisabled()
                     .focused($isFocused)
             } else {
                 Text(text)
-                    .padding(.leading, 4)
-                    .padding(.bottom, 1)
                     .gesture(
                         TapGesture(count: 1).onEnded {
                             self.isEditable = true
                             self.isFocused = true
                         }
                     )
-                    .onHover { inside in
-                        if inside {
-                            NSCursor.iBeam.push()
-                        } else {
-                            NSCursor.pop()
-                        }
-                    }
+                    .pointerStyle(.horizontalText)
             }
             Spacer()
         }
```

---

### Incident Patch 4: `25c45d72` (2026-09-28)
**Commit Message**: test: pin compatibility text and cover exports, Copy Options and overflow

CompatibilityTextTests pins the exact AUTOMATIC1111 text Mochi's generation
and export paths write for Core ML, Iris, a sparse hosted record, Unicode and
section-marker prompts, and converted released and foreign images. Musubi's
wire probe checks text of these shapes with the pinned AUTOMATIC1111 and
Civitai readers.

New tests also cover Save All with mixed PNG, JPEG and HEIC sources, Copy
Options from generated and foreign files, and metadata that exceeds the
description or native record limits.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +9/-2)
```diff
@@ -187,7 +187,13 @@ The multi-engine foundation is implemented. Current ownership and contracts foll
     `MetadataDetail`. Never present or restore an unrecorded value as a default.
   - A fresh generation's gallery record is built by the same mapping as reading its file.
   - Export always produces PNG: a PNG is copied byte for byte; JPEG and HEIC convert, carrying
-    a released Mochi caption as a native record and foreign AUTOMATIC1111 text unchanged.
+    a released Mochi caption as a native record and foreign AUTOMATIC1111 text unchanged. A
+    released caption's scheduler is written under the sampler label a fresh image uses.
+  - `CompatibilityTextTests` pins the AUTOMATIC1111 text written for each engine and
+    conversion. Musubi's wire probe checks text of those shapes with the pinned AUTOMATIC1111
+    and Civitai readers. A model is recorded by name only, so Civitai does not identify it as a
+    resource. Mochi 6.1.2 and earlier import only a caption naming its `Generator`, so they skip
+    images from newer versions.
   - Sampler names: DPM-Solver++ is written as `DPM++ 2M`, PNDM as `PLMS`, flow matching under
     Mochi's own name. `Scheduler(samplerLabel:)` maps them back for Copy Options.
 
@@ -224,7 +230,8 @@ The multi-engine foundation is implemented. Current ownership and contracts foll
   - Gallery: `GalleryLoadingTests`, `GalleryImageProviderTests`.
   - Hosted engine and credentials: `OpenAIImageEngineTests`, `OpenAIRuntimeTests`,
     `OpenAICredentialCheckTests`, `SecretStoreTests`.
-  - Metadata: `GenerationMetadataTests`, `MetadataRoundTripTests`, `ImageExportTests`.
+  - Metadata: `GenerationMetadataTests`, `MetadataRoundTripTests`, `ImageExportTests`,
+    `CompatibilityTextTests`.
   - Support: `ControlNetLinkTests`.
   - Fixtures are synthetic directories containing only the files the production sniffing
     code inspects, so no real model weights are required.
```

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -130,6 +130,7 @@
 		AA70000000000000000000012 /* GalleryLoadingTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000011 /* GalleryLoadingTests.swift */; };
 		AA70000000000000000000022 /* GalleryImageProviderTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000021 /* GalleryImageProviderTests.swift */; };
 		AA70000000000000000000032 /* ImageExportTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000031 /* ImageExportTests.swift */; };
+		AA70000000000000000000062 /* CompatibilityTextTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000061 /* CompatibilityTextTests.swift */; };
 		AA7500000000000000000001 /* FilterablePicker in Frameworks */ = {isa = PBXBuildFile; productRef = AA7500000000000000000002 /* FilterablePicker */; };
 		AA8800000000000000000001 /* Musubi in Frameworks */ = {isa = PBXBuildFile; productRef = AA8800000000000000000002 /* Musubi */; };
 		AA7600000000000000000002 /* CoreMLPipelineCacheKeyTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA7600000000000000000001 /* CoreMLPipelineCacheKeyTests.swift */; };
@@ -295,6 +296,7 @@
 		AA70000000000000000000011 /* GalleryLoadingTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GalleryLoadingTests.swift; sourceTree = "<group>"; };
 		AA70000000000000000000021 /* GalleryImageProviderTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GalleryImageProviderTests.swift; sourceTree = "<group>"; };
 		AA70000000000000000000031 /* ImageExportTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageExportTests.swift; sourceTree = "<group>"; };
+		AA70000000000000000000061 /* CompatibilityTextTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CompatibilityTextTests.swift; sourceTree = "<group>"; };
 		AA7600000000000000000001 /* CoreMLPipelineCacheKeyTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CoreMLPipelineCacheKeyTests.swift; sourceTree = "<group>"; };
 		AA80000000000000000000011 /* GalleryImageProviders.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GalleryImageProviders.swift; sourceTree = "<group>"; };
 		BF36895C2F2F3BDA006501CE /* Metal.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = Metal.framework; path = System/Library/Frameworks/Metal.framework; sourceTree = SDKROOT; };
@@ -542,6 +544,7 @@
 				AA70000000000000000000011 /* GalleryLoadingTests.swift */,
 				AA70000000000000000000021 /* GalleryImageProviderTests.swift */,
 				AA70000000000000000000031 /* ImageExportTests.swift */,
+				AA70000000000000000000061 /* CompatibilityTextTests.swift */,
 				AA50000000000000000001991 /* GenerationOwnershipTests.swift */,
 				AA50000000000000000002001 /* IdleTimeoutTests.swift */,
 				AA70000000000000000000051 /* CancellationBindingTests.swift */,
@@ -920,6 +923,7 @@
 				AA70000000000000000000012 /* GalleryLoadingTests.swift in Sources */,
 				AA70000000000000000000022 /* GalleryImageProviderTests.swift in Sources */,
 				AA70000000000000000000032 /* ImageExportTests.swift in Sources */,
+				AA70000000000000000000062 /* CompatibilityTextTests.swift in Sources */,
 				AA50000000000000000001992 /* GenerationOwnershipTests.swift in Sources */,
 				AA50000000000000000002002 /* IdleTimeoutTests.swift in Sources */,
 				AA70000000000000000000052 /* CancellationBindingTests.swift in Sources */,
```

**File**: `Mochi DiffusionTests/CompatibilityTextTests.swift` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+//
+//  CompatibilityTextTests.swift
+//  Mochi DiffusionTests
+//
+
+import AppKit
+import CoreGraphics
+import CoreML
+import Foundation
+import ImageIO
+import Musubi
+import Testing
+import UniformTypeIdentifiers
+
+@testable import Mochi_Diffusion
+
+/// Pins the exact AUTOMATIC1111 text Mochi's generation and export paths write
+/// for each engine and conversion. Musubi's wire probe checks that text of
+/// these shapes with the pinned AUTOMATIC1111 and Civitai readers.
+struct CompatibilityTextTests {
+    struct Case: Sendable, CustomTestStringConvertible {
+        let name: String
+        /// The complete AUTOMATIC1111 text, or `nil` when none is written.
+        let parameters: String?
+        let bytes: @Sendable @MainActor (TempDirectory) async throws -> Data
+
+        var testDescription: String { name }
+    }
+
+    static let software = "Software: Mochi Diffusion \(NSApplication.appVersion)"
+
+    static func generated(_ name: String, _ metadata: GenerationMetadata, parameters: String?)
+        -> Case
+    {
+        Case(name: name, parameters: parameters) { _ in
+            try #require(await metadata.pngData(for: makeCGImage(width: 24, height: 16)))
+        }
+    }
+
+    static func converted(
+        _ name: String, type: UTType, parameters: String?,
+        properties: @escaping @Sendable () -> [CFString: Any]
+    ) -> Case {
+        Case(name: name, parameters: parameters) { temp in
+            let source = temp.appending("\(name).\(type.preferredFilenameExtension!)")
+            let data = CFDataCreateMutable(nil, 0)!
+            let destination = try #require(
+                CGImageDestinationCreateWithData(data, type.identifier as CFString, 1, nil))
+            CGImageDestinationAddImage(destination, makeCGImage(), properties() as CFDictionary)
+            try #require(CGImageDestinationFinalize(destination))
+            try (data as Data).write(to: source, options: .atomic)
+            return try #require(ImageMetadataWriter.exportPNG(from: source))
+        }
+    }
+
+    static func released(_ caption: String, version: String) -> [CFString: Any] {
+        [
+            kCGImagePropertyIPTCDictionary: [
+                kCGImagePropertyIPTCCaptionAbstract: caption,
+                kCGImagePropertyIPTCOriginatingProgram: "Mochi Diffusion",
+                kCGImagePropertyIPTCProgramVersion: version,
+            ]
+        ]
+    }
+
+    static func metadata(
+        prompt: String = "a red cube on a table",
+        negativePrompt: String? = "blurry",
+        model: String,
+        engine: EngineID = .coreMLStableDiffusion,
+        architecture: String?,
+        quality: String? = nil,
+        startingImage: String? = nil,
+        strength: Double? = nil,
+        controlNet: String? = nil,
+        controlNetImage: String? = nil,
+        inputImages: [String]? = nil,
+        scheduler: Scheduler?,
+        mlComputeUnit: MLComputeUnits? = .cpuAndNeuralEngine,
+        seed: UInt32?,
+        steps: Int?,
+        guidanceScale: Double?
+    ) -> GenerationMetadata {
+        GenerationMetadata(
+            prompt: prompt, negativePrompt: negativePrompt, width: 24, height: 16, model: model,
+            engine: engine.rawValue, modelKey: model, architecture: architecture,
+            quality: quality, startingImage: startingImage, strength: strength,
+            controlNet: controlNet, controlNetImage: controlNetImage, inputImages: inputImages,
+            scheduler: scheduler, mlComputeUnit: mlComputeUnit, seed: seed, steps: steps,
+            guidanceScale: guidanceScale,
+            generatedDate: Date(timeIntervalSince1970: 1_790_000_000), metadataFields: [])
+    }
+
+    static let cases: [Case] = [
+        // SDXL's DPM-Solver++ spaces its steps with Karras sigmas.
+        generated(
+            "coreml-sdxl",
+            metadata(
+                model: "sdxl-base", architecture: SDModel.ModelType.sdxl.displayName,
+                scheduler: .dpmSolverMultistepScheduler, seed: UInt32.max, steps: 30,
+                guidanceScale: 7),
+            parameters: """
+                a red cube on a table
+                Negative prompt: blurry
+                Steps: 30, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 7.0, \
+                Seed: 4294967295, Size: 24x16, Model: sdxl-base, \(software)
+                """),
+        // The starting image's strength is recorded. ControlNet has no
+        // AUTOMATIC1111 field outside its extension, so only the native record
+        // names it.
+        generated(
+            "coreml-img2img-controlnet",
+            metadata(
+                model: "sd-1.5", architecture: SDModel.ModelType.sd15.displayName,
+                startingImage: "start.png", strength: 0.6, controlNet: "canny",
+                controlNetImage: "edges.png", scheduler: .pndmScheduler, seed: 42, steps: 20,
+                guidanceScale: 7.5),
+            parameters: ""
```

**File**: `Mochi DiffusionTests/GalleryLoadingTests.swift` (modified, +52/-0)
```diff
@@ -5,6 +5,7 @@
 
 import CoreGraphics
 import Foundation
+import ImageIO
 import Testing
 import UniformTypeIdentifiers
 
@@ -483,6 +484,57 @@ struct GalleryLoadingTests {
         #expect(exported.metadataFields == [.prompt])
         #expect(exported.prompt == "a cat")
     }
+
+    @Test("Save All copies a generated PNG exactly and converts released JPEG and HEIC to PNG")
+    func saveAllMixedFormats() async throws {
+        let generated = MetadataRoundTripTests.coreMLMetadata(prompt: "a generated cat")
+        try #require(await generated.pngData(for: makeCGImage()))
+            .write(to: imageDir.appending(path: "generated.png"))
+        for (name, type) in [("released.jpg", UTType.jpeg), ("released.heic", .heic)] {
+            let data = CFDataCreateMutable(nil, 0)!
+            let destination = try #require(
+                CGImageDestinationCreateWithData(data, type.identifier as CFString, 1, nil))
+            let caption = releasedCaption([
+                (.includeInImage, "a released \(type.preferredFilenameExtension!)"),
+                (.seed, "42"),
+                (.generator, "Mochi Diffusion 6.0"),
+            ])
+            let properties = [
+                kCGImagePropertyIPTCDictionary: [
+                    kCGImagePropertyIPTCCaptionAbstract: caption,
+                    kCGImagePropertyIPTCOriginatingProgram: "Mochi Diffusion",
+                    kCGImagePropertyIPTCProgramVersion: "6.0",
+                ]
+            ]
+            CGImageDestinationAddImage(destination, makeCGImage(), properties as CFDictionary)
+            try #require(CGImageDestinationFinalize(destination))
+            try (data as Data).write(to: imageDir.appending(path: name))
+        }
+        let gallery = ImageGallery()
+        let controller = try await makeSettledController(gallery: gallery)
+        let exportDir = try temp.subdirectory("export")
+        try #require(gallery.images.count == 3)
+
+        await controller.saveAll(to: exportDir)
+
+        for (index, sdi) in gallery.images.enumerated() {
+            let source = URL(fileURLWithPath: sdi.path)
+            let exported = exportDir.appending(
+                path: sdi.filenameWithoutExtension(count: index + 1) + ".png")
+            let data = try Data(contentsOf: exported)
+            let record = try #require(createImageRecordFromURL(exported))
+            #expect(record.prompt == sdi.prompt)
+            #expect(record.metadataFields == gallery.metadataFields(for: sdi.id))
+            if source.pathExtension == "png" {
+                #expect(data == (try Data(contentsOf: source)))
+                #expect(record.startingImage == "starting.png")
+                #expect(record.controlNetImage == "control.png")
+            } else {
+                #expect(data.starts(with: [0x89, 0x50, 0x4E, 0x47]))
+                #expect(record.seed == 42)
+            }
+        }
+    }
 }
 
 extension Collection {
```

**File**: `Mochi DiffusionTests/GenerationConfigRestorationTests.swift` (modified, +69/-0)
```diff
@@ -4,6 +4,7 @@
 //
 
 import CoreGraphics
+import CoreML
 import Foundation
 import Testing
 
@@ -524,6 +525,74 @@ struct GenerationConfigRestorationTests {
         #expect(configStore.strength == 0.35)
     }
 
+    /// The gallery image of the file at `url`, read the way the gallery reads it.
+    private func galleryImage(readFrom url: URL, in gallery: ImageGallery) throws -> SDImage {
+        let record = try #require(createImageRecordFromURL(url))
+        let sdi = try #require(createSDImage(from: record))
+        gallery.replaceAll([(image: sdi, metadataFields: record.metadataFields)])
+        return sdi
+    }
+
+    @Test("Copy Options restores the settings a generated file recorded")
+    func restoreFromGeneratedFile() async throws {
+        try makeSDModelFixture(at: modelDir.appending(path: "core"))
+        let metadata = GenerationMetadata(
+            prompt: "a cat\nwearing a hat", negativePrompt: "blurry", width: 512, height: 512,
+            model: "core", engine: EngineID.coreMLStableDiffusion.rawValue, modelKey: "core",
+            architecture: SDModel.ModelType.sd15.displayName, quality: nil, startingImage: nil,
+            strength: nil, controlNet: nil, controlNetImage: nil, inputImages: nil,
+            scheduler: .pndmScheduler, mlComputeUnit: .cpuAndGPU, seed: UInt32.max, steps: 23,
+            guidanceScale: 6.5, generatedDate: Date(), metadataFields: [])
+        let url = temp.appending("generated.png")
+        try #require(await metadata.pngData(for: makeCGImage())).write(to: url)
+        let gallery = ImageGallery()
+        let sdi = try galleryImage(readFrom: url, in: gallery)
+        let controller = makeController(gallery: gallery)
+        await controller.loadModels()
+        try selectModel("gpt-image-2", on: controller)
+
+        await controller.copyToPrompt(sdi)
+
+        #expect(controller.currentModelId == ModelID(engine: .coreMLStableDiffusion, key: "core"))
+        #expect(configStore.prompt == "a cat\nwearing a hat")
+        #expect(configStore.negativePrompt == "blurry")
+        #expect(configStore.steps == 23)
+        #expect(configStore.guidanceScale == 6.5)
+        #expect(configStore.scheduler == .pndmScheduler)
+        #expect(controller.seed == UInt32.max)
+        #expect(configStore.mlComputeUnitPreference == ComputeUnitPreference(exact: .cpuAndGPU))
+    }
+
+    @Test("Copy Options from another application's image restores only what Mochi can use")
+    func restoreFromForeignFile() async throws {
+        try makeSDModelFixture(at: modelDir.appending(path: "core"))
+        let url = temp.appending("foreign.png")
+        try PNGTestChunks.write(
+            textChunks: [
+                (
+                    "parameters",
+                    "a dog\nNegative prompt: cat\nSteps: 12, Sampler: Euler a, CFG scale: 5, Seed: 8589934592, Size: 8x8, Model: dreamshaper"
+                )
+            ], to: url)
+        let gallery = ImageGallery()
+        let sdi = try galleryImage(readFrom: url, in: gallery)
+        let controller = makeController(gallery: gallery)
+        await controller.loadModels()
+        try selectModel("core", on: controller)
+        configStore.scheduler = .dpmSolverMultistepScheduler
+        controller.seed = 7
+
+        await controller.copyToPrompt(sdi)
+
+        #expect(configStore.prompt == "a dog")
+        #expect(configStore.negativePrompt == "cat")
+        #expect(configStore.steps == 12)
+        #expect(configStore.guidanceScale == 5)
+        // Neither a sampler Mochi does not offer nor a seed above UInt32 is restored.
+        #expect(configStore.scheduler == .dpmSolverMultistepScheduler)
+        #expect(controller.seed == 7)
+    }
+
     @Test("Legacy gallery metadata falls back to an unambiguous display name")
     func legacyModelNameFallbackStillWorks() async throws {
         try makeSDModelFixture(at: modelDir.appending(path: "legacy-core"))
```

**File**: `Mochi DiffusionTests/MetadataRoundTripTests.swift` (modified, +20/-0)
```diff
@@ -193,6 +193,26 @@ struct MetadataRoundTripTests {
         #expect(record.prompt == prompt)
     }
 
+    @Test("A prompt too long to repeat in the description keeps both records")
+    func longPromptDropsOnlyTheDescription() async throws {
+        let prompt = String(repeating: "a cat wearing a hat, ", count: 2_000)
+        let data = try #require(
+            await Self.coreMLMetadata(prompt: prompt).pngData(for: makeCGImage()))
+        let url = temp.appending("long.png")
+        try data.write(to: url, options: .atomic)
+
+        #expect(xmpDescription(of: data) == nil)
+        #expect(data.range(of: Data("parameters\0".utf8)) != nil)
+        #expect(try #require(createImageRecordFromURL(url)).prompt == prompt)
+    }
+
+    @Test("An image whose native record exceeds its limit is not written")
+    func oversizedRecordIsNotWritten() async {
+        let prompt = String(repeating: "a cat wearing a hat, ", count: 4_000)
+
+        #expect(await Self.coreMLMetadata(prompt: prompt).pngData(for: makeCGImage()) == nil)
+    }
+
     // MARK: - Released and foreign images
 
     /// Writes an image the way released Mochi Diffusion did: an IPTC caption
```

---

### Incident Patch 5: `293d96b4` (2026-09-28)
**Commit Message**: build: pin Musubi with typed Mochi details

Musubi 3ea3127 adds MochiGenerationDetails(_:payloads:) and extends its wire
probe to the sampler and schedule labels Mochi writes. The reading library
itself is unchanged apart from the new initializer.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -1317,7 +1317,7 @@
 			repositoryURL = "https://github.com/MochiDiffusion/Musubi.git";
 			requirement = {
 				kind = revision;
-				revision = 027c6b997269a9e505d9382858fedf02d4308182;
+				revision = 3ea31276dd1fd48fb591d59d20951ff8860503b3;
 			};
 		};
 /* End XCRemoteSwiftPackageReference section */
```

**File**: `Mochi Diffusion.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/MochiDiffusion/Musubi.git",
       "state" : {
-        "revision" : "027c6b997269a9e505d9382858fedf02d4308182"
+        "revision" : "3ea31276dd1fd48fb591d59d20951ff8860503b3"
       }
     },
     {
```

---

### Incident Patch 6: `832c8969` (2026-09-28)
**Commit Message**: fix: write a converted image's sampler under the current label

Exporting a released JPEG or HEIC to PNG wrote the caption's scheduler name,
such as DPM-Solver++, as the AUTOMATIC1111 sampler, while a fresh image
writes DPM++ 2M. Civitai and other readers then saw a sampler name no tool
uses. The converted PNG now records the sampler under the label a fresh
generation writes.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion/Support/ImageMetadata.swift` (modified, +6/-1)
```diff
@@ -176,10 +176,15 @@ nonisolated enum ImageMetadataWriter {
         let reading = ImageMetadataReader.read(url)
         guard case .selected(let reference) = reading?.selection, let reading else { return nil }
         let interpretation = reading.interpretations[reference.interpretation]
-        let generation = interpretation.generations[reference.generation]
+        var generation = interpretation.generations[reference.generation]
 
         switch interpretation.format {
         case .mochiDiffusion, .mochiDiffusionLegacyCaption:
+            // A released caption names the sampler by Mochi's scheduler name.
+            // The PNG records it under the label a fresh generation writes.
+            if let sampler = generation.sampler, let scheduler = Scheduler(samplerLabel: sampler) {
+                generation.sampler = scheduler.samplerLabel
+            }
             return payloads(
                 for: MochiGenerationSnapshot(
                     producer: interpretation.producer
```

**File**: `Mochi DiffusionTests/ImageExportTests.swift` (modified, +23/-0)
```diff
@@ -103,6 +103,29 @@ struct ImageExportTests {
                 == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.0"))
     }
 
+    @Test(
+        "A released image's scheduler converts to the sampler label a fresh image writes",
+        arguments: [("DPM-Solver++", "DPM++ 2M"), ("PNDM", "PLMS")]
+    )
+    func releasedSchedulerLabel(released: String, label: String) async throws {
+        let caption = releasedCaption([
+            (.includeInImage, "a cat"),
+            (.steps, "17"),
+            (.seed, "42"),
+            (.scheduler, released),
+            (.generator, "Mochi Diffusion 6.0"),
+        ])
+        let source = try writeReleasedSource("image.jpg", type: .jpeg, caption: caption)
+
+        let destination = try await export(source, name: "converted.png")
+        let description = try #require(xmpDescription(of: Data(contentsOf: destination)))
+
+        #expect(description.contains("Sampler: \(label),"))
+        let converted = try #require(createImageRecordFromURL(destination))
+        #expect(converted.scheduler != nil)
+        #expect(converted.scheduler == Scheduler(samplerLabel: released))
+    }
+
     @Test("A 6.1 HEIC converts to PNG with its model identity and input images")
     func releasedLineCaptionConversion() async throws {
         let caption = releasedLineCaption([
```

---

### Incident Patch 7: `2bbbed99` (2026-09-28)
**Commit Message**: fix: keep Quick Look bound to a State mirror

quickLookPreview reads its binding off the main thread. A Binding(get:set:)
over the main-actor QuickLookState traps on that read under Swift 6
isolation checking, so previewing an image crashed the app. A State
mirror synced by onChange has no such check.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion/MochiDiffusionApp.swift` (modified, +12/-13)
```diff
@@ -18,23 +18,15 @@ struct MochiDiffusionApp: App {
     @State private var store: ImageGallery
     @State private var notificationController: NotificationController
     @State private var quickLook: QuickLookState
+    /// Mirrors `quickLook.url` for `quickLookPreview`, which reads its binding off the
+    /// main thread. A `Binding(get:set:)` over the main-actor `QuickLookState` would
+    /// trap on that read under Swift 6 isolation checking; a `@State` binding does not.
+    @State private var quickLookURL: URL?
 
     private let thumbnailProvider: GalleryThumbnailProvider
     private let fullImageProvider: GalleryFullImageProvider
     private let updaterController: SPUStandardUpdaterController
 
-    /// The preview reports dismissal by clearing the URL, which closes the shared
-    /// state. It never sets a URL of its own, so only that write is handled.
-    private var quickLookURL: Binding<URL?> {
-        let quickLook = quickLook
-        return Binding(
-            get: { quickLook.url },
-            set: { newValue in
-                if newValue == nil { quickLook.close() }
-            }
-        )
-    }
-
     init() {
         let configStore = ConfigStore()
         // One repository for every writer, so filename allocation covers all of
@@ -107,7 +99,14 @@ struct MochiDiffusionApp: App {
                         "com.apple.MetalPerformanceShadersGraph", isDirectory: true)
                     try? FileManager.default.removeItem(at: mpsURL)
                 }
-                .quickLookPreview(quickLookURL)
+                .onChange(of: quickLook.url) { _, newValue in
+                    if quickLookURL != newValue { quickLookURL = newValue }
+                }
+                // The preview reports dismissal by clearing the URL.
+                .onChange(of: quickLookURL) { _, newValue in
+                    if newValue == nil { quickLook.close() }
+                }
+                .quickLookPreview($quickLookURL)
         }
         .environment(configStore)
         .environment(generationController)
```

---

### Incident Patch 8: `e90fd686` (2026-09-28)
**Commit Message**: fix: read 6.1 images and show settings in Finder again

Mochi Diffusion 6.1 through 6.1.2 wrote a line-per-field caption that
Musubi did not read, so those images were left out of the gallery. Pin
Musubi to the revision that reads it, and take the engine, model key and
each input image from it so Copy Options restores them.

Released images showed their settings as Finder's Get Info Description,
and Spotlight matched their prompts, because ImageIO stored the caption as
XMP dc:description. Write the AUTOMATIC1111 text there as well, in the
native record's packet, for generated images and for released JPEG or
HEIC images exported as PNG.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -1317,7 +1317,7 @@
 			repositoryURL = "https://github.com/MochiDiffusion/Musubi.git";
 			requirement = {
 				kind = revision;
-				revision = 65771844a6a9c43840ee035b6972ad51cfbec44e;
+				revision = 027c6b997269a9e505d9382858fedf02d4308182;
 			};
 		};
 /* End XCRemoteSwiftPackageReference section */
```

**File**: `Mochi Diffusion.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "8fa63e5322fce25b70c9eac5893dcb3708b9607d18bf9209904e8724c6dd43ca",
+  "originHash" : "6544f28438d43cf2cc74da9510b07a3f5083fc9af35e1b16a94826635b5e969f",
   "pins" : [
     {
       "identity" : "filterablepicker",
@@ -24,7 +24,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/MochiDiffusion/Musubi.git",
       "state" : {
-        "revision" : "65771844a6a9c43840ee035b6972ad51cfbec44e"
+        "revision" : "027c6b997269a9e505d9382858fedf02d4308182"
       }
     },
     {
```

**File**: `Mochi Diffusion/Support/ImageMetadata.swift` (modified, +37/-26)
```diff
@@ -114,22 +114,30 @@ nonisolated extension GenerationMetadata {
     /// no image is saved without its record. AUTOMATIC1111 text that readers
     /// would misread is left out, and the native record alone is written.
     func pngData(for image: CGImage) async -> Data? {
-        let snapshot = snapshot()
         guard let pixels = ImageMetadataWriter.encodePNG(image),
-            let packet = try? MochiNativeCodec.encodeXMPPacket(snapshot)
+            let payloads = ImageMetadataWriter.payloads(for: snapshot())
         else { return nil }
-        let parameters = A1111ParametersEncoder.encode(
-            snapshot.generation, producer: snapshot.producer)
         return try? PNGMetadataWriter.write(
-            PNGMetadataPayloads(nativeXMPPacket: packet, parameters: parameters.text),
-            into: pixels,
-            replacingExistingRecords: false
-        )
+            payloads, into: pixels, replacingExistingRecords: false)
     }
 }
 
 /// Encodes pixels and carries generation metadata into exported PNG files.
 nonisolated enum ImageMetadataWriter {
+    /// The native record and the AUTOMATIC1111-compatible text of `snapshot`.
+    /// The text is also the record's description, which Finder shows in Get
+    /// Info and Spotlight searches. `nil` when the record cannot be written.
+    static func payloads(for snapshot: MochiGenerationSnapshot) -> PNGMetadataPayloads? {
+        let parameters = A1111ParametersEncoder.encode(
+            snapshot.generation, producer: snapshot.producer
+        ).text
+        guard
+            let packet = try? MochiNativeCodec.encodeXMPPacket(
+                snapshot, description: parameters)
+        else { return nil }
+        return PNGMetadataPayloads(nativeXMPPacket: packet, parameters: parameters)
+    }
+
     /// `image` as a PNG with no metadata.
     static func encodePNG(_ image: CGImage) -> Data? {
         guard let data = CFDataCreateMutable(nil, 0),
@@ -172,18 +180,14 @@ nonisolated enum ImageMetadataWriter {
 
         switch interpretation.format {
         case .mochiDiffusion, .mochiDiffusionLegacyCaption:
-            let snapshot = MochiGenerationSnapshot(
-                producer: interpretation.producer
-                    ?? MetadataProducer(name: ImageMetadataReader.producerName),
-                generation: generation,
-                details: ImageMetadataReader.mochiDetails(interpretation, reading: reading)
-                    ?? MochiGenerationDetails()
-            )
-            guard let packet = try? MochiNativeCodec.encodeXMPPacket(snapshot) else { return nil }
-            return PNGMetadataPayloads(
-                nativeXMPPacket: packet,
-                parameters: A1111ParametersEncoder.encode(generation, producer: snapshot.producer)
-                    .text)
+            return payloads(
+                for: MochiGenerationSnapshot(
+                    producer: interpretation.producer
+                        ?? MetadataProducer(name: ImageMetadataReader.producerName),
+                    generation: generation,
+                    details: ImageMetadataReader.mochiDetails(interpretation, reading: reading)
+                        ?? MochiGenerationDetails()
+                ))
         case .automatic1111:
             let text = interpretation.payloadIndices.first.flatMap { reading.payloads[$0].text }
             return text.map { PNGMetadataPayloads(parameters: $0) }
@@ -321,20 +325,27 @@ nonisolated enum ImageMetadataReader {
             }
             return (try? MochiNativeCodec.decodeXMPPacket(text))?.details
         case .mochiDiffusionLegacyCaption:
-            let generation = interpretation.generations.first
+            let parameters = interpretation.generations.first?.parameters ?? []
             func value(_ key: String) -> String? {
-                generation?.parameters.first { $0.key == key }?.value
+                parameters.first { $0.key == key }?.value
             }
+            // The 6.1 caption lists each input image as its own `Input Image`.
+            // Earlier captions join them with commas under `Input Images`.
+            let inputImages = parameters.filter { $0.key == "Input Image" }.map(\.value)
             return MochiGenerationDetails(
+                engine: value("Engine"),
+                modelKey: value("Model Key"),
                 quality: value("Quality"),
                 computeUnit: value("ML Compute Unit"),
                 startingImage: value("Starting Image"),
                 controlNetImage: value("ControlNet Image"),
-                // Released captions join input images with commas.
-                inputImages: value("Input Images").map {
-                    $0.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
+                inputImages: inputImages.isEmpty
+                    ? value("Input Images").map {
+                        $0.components(separatedBy: ",").map {
+                     
```

**File**: `Mochi DiffusionTests/ImageExportTests.swift` (modified, +26/-0)
```diff
@@ -94,6 +94,7 @@ struct ImageExportTests {
         #expect(converted.prompt == "a cat")
         #expect(converted.seed == 42)
         #expect(converted.metadataFields == [.prompt, .seed])
+        #expect(try xmpDescription(of: Data(contentsOf: destination))?.hasPrefix("a cat\n") == true)
         // A sampler Mochi does not offer stays a shown detail and is not invented
         // as a known scheduler.
         #expect(converted.details.contains(MetadataDetail(label: "Sampler", value: "Euler")))
@@ -102,6 +103,31 @@ struct ImageExportTests {
                 == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.0"))
     }
 
+    @Test("A 6.1 HEIC converts to PNG with its model identity and input images")
+    func releasedLineCaptionConversion() async throws {
+        let caption = releasedLineCaption([
+            (.includeInImage, "a cat"),
+            (.engine, EngineID.iris.rawValue),
+            (.modelKey, "flux-klein"),
+            (.inputImages, "first, one.png"),
+            (.inputImages, "second.png"),
+            (.generator, "Mochi Diffusion 6.1.2"),
+        ])
+        let source = try writeReleasedSource("image.heic", type: .heic, caption: caption)
+
+        let destination = try await export(source, name: "converted.png")
+        let converted = try #require(createImageRecordFromURL(destination))
+
+        #expect(type(of: destination) == .png)
+        #expect(converted.prompt == "a cat")
+        #expect(converted.engine == EngineID.iris.rawValue)
+        #expect(converted.modelKey == "flux-klein")
+        #expect(converted.inputImages == ["first, one.png", "second.png"])
+        #expect(
+            converted.details.first
+                == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.1.2"))
+    }
+
     @Test("Another application's AUTOMATIC1111 text is carried over as it was")
     func foreignTextIsCarried() async throws {
         let text = "a dog\nSteps: 12, Sampler: Euler, CFG scale: 5, Seed: 9, Size: 8x8"
```

**File**: `Mochi DiffusionTests/MetadataRoundTripTests.swift` (modified, +55/-0)
```diff
@@ -118,6 +118,19 @@ struct MetadataRoundTripTests {
         #expect(data.range(of: Data("Sampler: DPM++ 2M, Schedule type: Karras".utf8)) != nil)
     }
 
+    @Test("A generated PNG's description is its AUTOMATIC1111 text")
+    func generatedPNGDescription() async throws {
+        let data = try #require(await Self.coreMLMetadata().pngData(for: makeCGImage()))
+
+        let description = try #require(xmpDescription(of: data))
+
+        #expect(
+            description.hasPrefix("a cat wearing a hat\nNegative prompt: blurry, low quality\n"))
+        #expect(description.contains("Sampler: DPM++ 2M, Schedule type: Karras"))
+        // The same text as the uncompressed `parameters` iTXt chunk.
+        #expect(data.range(of: Data("parameters\0\0\0\0\0\(description)".utf8)) != nil)
+    }
+
     @Test("An image without a starting image records no strength")
     func noStartingImageNoStrength() async throws {
         let record = try await roundTrip(Self.coreMLMetadata(startingImage: nil, strength: nil))
@@ -236,6 +249,48 @@ struct MetadataRoundTripTests {
         )
     }
 
+    @Test(
+        "Images from Mochi Diffusion 6.1 through 6.1.2 stay readable in every format",
+        arguments: [UTType.png, .jpeg, .heic])
+    func releasedLineCaptionImagesAreReadable(type: UTType) throws {
+        let caption = releasedLineCaption([
+            (.includeInImage, "a cat\nwearing a \\hat"),
+            (.excludeFromImage, ""),
+            (.model, "sd-1.5"),
+            (.engine, EngineID.coreMLStableDiffusion.rawValue),
+            (.modelKey, "sd-1.5"),
+            (.steps, "17"),
+            (.guidanceScale, "7.5"),
+            (.seed, "42"),
+            (.size, "512x768"),
+            (.inputImages, "first, one.png"),
+            (.inputImages, "second.png"),
+            (.scheduler, "DPM-Solver++"),
+            (.mlComputeUnit, "CPU & GPU"),
+            (.generator, "Mochi Diffusion 6.1.2"),
+        ])
+        let url = try writeReleasedImage(caption: caption, type: type, name: "released-6.1")
+
+        let record = try #require(createImageRecordFromURL(url))
+
+        #expect(record.prompt == "a cat\nwearing a \\hat")
+        #expect(record.negativePrompt == "")
+        #expect(record.metadataFields.contains(.negativePrompt))
+        #expect(record.model == "sd-1.5")
+        #expect(record.engine == EngineID.coreMLStableDiffusion.rawValue)
+        #expect(record.modelKey == "sd-1.5")
+        #expect(record.steps == 17)
+        #expect(record.guidanceScale == 7.5)
+        #expect(record.seed == 42)
+        #expect(record.generationSize == CGSize(width: 512, height: 768))
+        #expect(record.scheduler == .dpmSolverMultistepScheduler)
+        #expect(record.mlComputeUnit == .cpuAndGPU)
+        #expect(record.inputImages == ["first, one.png", "second.png"])
+        #expect(
+            record.details.first
+                == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.1.2"))
+    }
+
     /// Writes a PNG whose only metadata is AUTOMATIC1111-compatible text.
     func writeParametersImage(_ text: String, name: String) throws -> URL {
         let url = temp.appending("\(name).png")
```

**File**: `Mochi DiffusionTests/TestSupport.swift` (modified, +31/-1)
```diff
@@ -234,12 +234,42 @@ nonisolated func makeCGImage(width: Int = 8, height: Int = 8) -> CGImage {
     return context.makeImage()!
 }
 
-/// A caption in the format released Mochi Diffusion 2.2 through 6.1 wrote:
+/// A caption in the format released Mochi Diffusion 2.2 through 6.0 wrote:
 /// `Key: value` pairs joined by `"; "`.
 nonisolated func releasedCaption(_ pairs: [(key: Metadata, value: String)]) -> String {
     pairs.map { "\($0.key.rawValue): \($0.value)" }.joined(separator: "; ")
 }
 
+/// A caption in the format released Mochi Diffusion 6.1 through 6.1.2 wrote:
+/// `Metadata Version: 2`, then one `Key: value` pair per line, with backslash,
+/// line feed and carriage return escaped in each value.
+nonisolated func releasedLineCaption(_ pairs: [(key: Metadata, value: String)]) -> String {
+    func escape(_ value: String) -> String {
+        var escaped = ""
+        for scalar in value.unicodeScalars {
+            switch scalar {
+            case "\\": escaped += "\\\\"
+            case "\n": escaped += "\\n"
+            case "\r": escaped += "\\r"
+            default: escaped.unicodeScalars.append(scalar)
+            }
+        }
+        return escaped
+    }
+    return (["Metadata Version: 2"] + pairs.map { "\($0.key.rawValue): \(escape($0.value))" })
+        .joined(separator: "\n")
+}
+
+/// The XMP `dc:description` of an encoded image, as ImageIO reads it. Spotlight
+/// imports it as the description Finder shows in Get Info.
+nonisolated func xmpDescription(of data: Data) -> String? {
+    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
+        let metadata = CGImageSourceCopyMetadataAtIndex(source, 0, nil)
+    else { return nil }
+    return CGImageMetadataCopyStringValueWithPath(metadata, nil, "dc:description" as CFString)
+        as String?
+}
+
 /// Writes a PNG carrying `caption` as its IPTC caption-abstract, the way
 /// released Mochi Diffusion stored its metadata, so tests can exercise import of
 /// released, malformed or foreign captions.
```

---

### Incident Patch 9: `86d0da6d` (2026-09-27)
**Commit Message**: build: add Musubi pinned to a published revision

Depend on github.com/MochiDiffusion/Musubi at 6577184, which provides the
metadata reader, the native and AUTOMATIC1111 encoders and the PNG writer.
Package.resolved records the pin.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +17/-0)
```diff
@@ -133,6 +133,7 @@
 		AA70000000000000000000032 /* ImageExportTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000031 /* ImageExportTests.swift */; };
 		AA70000000000000000000042 /* MetadataPresenceExportTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA70000000000000000000041 /* MetadataPresenceExportTests.swift */; };
 		AA7500000000000000000001 /* FilterablePicker in Frameworks */ = {isa = PBXBuildFile; productRef = AA7500000000000000000002 /* FilterablePicker */; };
+		AA8800000000000000000001 /* Musubi in Frameworks */ = {isa = PBXBuildFile; productRef = AA8800000000000000000002 /* Musubi */; };
 		AA7600000000000000000002 /* CoreMLPipelineCacheKeyTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA7600000000000000000001 /* CoreMLPipelineCacheKeyTests.swift */; };
 		AA80000000000000000000012 /* GalleryImageProviders.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA80000000000000000000011 /* GalleryImageProviders.swift */; };
 		AD83C9D690826D2A57A43EA8 /* GalleryController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 540CFF7CA65203E6AD7C64B1 /* GalleryController.swift */; };
@@ -328,6 +329,7 @@
 			buildActionMask = 2147483647;
 			files = (
 				AA7500000000000000000001 /* FilterablePicker in Frameworks */,
+				AA8800000000000000000001 /* Musubi in Frameworks */,
 				BF3689632F2F4337006501CE /* MetalPerformanceShaders.framework in Frameworks */,
 				BF3689622F2F4329006501CE /* MetalPerformanceShadersGraph.framework in Frameworks */,
 				03ADC8B9299581AF00B2843F /* StableDiffusion in Frameworks */,
@@ -610,6 +612,7 @@
 			name = "Mochi Diffusion";
 			packageProductDependencies = (
 				AA7500000000000000000002 /* FilterablePicker */,
+				AA8800000000000000000002 /* Musubi */,
 				0352E2A4294E2591003FBF25 /* Sparkle */,
 				0388DEAF297B00FC008B1C1C /* CompactSlider */,
 				03ADC8B8299581AF00B2843F /* StableDiffusion */,
@@ -706,6 +709,7 @@
 			mainGroup = 036BFC15294B9F7500D8AD04;
 			packageReferences = (
 				AA7500000000000000000003 /* XCRemoteSwiftPackageReference "FilterablePicker" */,
+				AA8800000000000000000003 /* XCRemoteSwiftPackageReference "Musubi" */,
 				0352E2A3294E2591003FBF25 /* XCRemoteSwiftPackageReference "Sparkle" */,
 				0388DEAE297B00FC008B1C1C /* XCLocalSwiftPackageReference "Vendor/CompactSlider" */,
 				03ADC8B7299581AF00B2843F /* XCRemoteSwiftPackageReference "ml-stable-diffusion" */,
@@ -1316,6 +1320,14 @@
 				minimumVersion = 1.0.1;
 			};
 		};
+		AA8800000000000000000003 /* XCRemoteSwiftPackageReference "Musubi" */ = {
+			isa = XCRemoteSwiftPackageReference;
+			repositoryURL = "https://github.com/MochiDiffusion/Musubi.git";
+			requirement = {
+				kind = revision;
+				revision = 65771844a6a9c43840ee035b6972ad51cfbec44e;
+			};
+		};
 /* End XCRemoteSwiftPackageReference section */
 
 /* Begin XCSwiftPackageProductDependency section */
@@ -1339,6 +1351,11 @@
 			package = AA7500000000000000000003 /* XCRemoteSwiftPackageReference "FilterablePicker" */;
 			productName = FilterablePicker;
 		};
+		AA8800000000000000000002 /* Musubi */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = AA8800000000000000000003 /* XCRemoteSwiftPackageReference "Musubi" */;
+			productName = Musubi;
+		};
 /* End XCSwiftPackageProductDependency section */
 	};
 	rootObject = 036BFC16294B9F7500D8AD04 /* Project object */;
```

**File**: `Mochi Diffusion.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +9/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "f74a915ce830d56bce4f1d50ddbda42d82a09c358adc2075974fd08595806b04",
+  "originHash" : "8fa63e5322fce25b70c9eac5893dcb3708b9607d18bf9209904e8724c6dd43ca",
   "pins" : [
     {
       "identity" : "filterablepicker",
@@ -19,6 +19,14 @@
         "revision" : "e12202c1f6405b83918b58a5d097cd61e3e1f702"
       }
     },
+    {
+      "identity" : "musubi",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/MochiDiffusion/Musubi.git",
+      "state" : {
+        "revision" : "65771844a6a9c43840ee035b6972ad51cfbec44e"
+      }
+    },
     {
       "identity" : "sparkle",
       "kind" : "remoteSourceControl",
```

---

### Incident Patch 10: `b1a4ed14` (2026-09-27)
**Commit Message**: fix: stop the Core ML batch seed from overflowing

The Core ML runtime advanced the batch seed with a trapping += 1, so any
batch starting at UInt32.max crashed after writing its last image. Core ML
and Iris now advance seeds through GenerationSeed, which wraps UInt32.max
to 1, and random seeds are drawn from 1...UInt32.max. Seed 0 is reserved
for "random" in the sidebar, so an image recorded with it could not be
reproduced through Copy Options.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -108,6 +108,7 @@
 		AA50000000000000000001982 /* QueueLivenessTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000001981 /* QueueLivenessTests.swift */; };
 		AA50000000000000000002082 /* GenerationResultPathTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002081 /* GenerationResultPathTests.swift */; };
 		AA50000000000000000002096 /* SchedulerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002095 /* SchedulerTests.swift */; };
+		AA50000000000000000002098 /* GenerationSeedTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002097 /* GenerationSeedTests.swift */; };
 		AA50000000000000000002094 /* IrisConversionTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002093 /* IrisConversionTests.swift */; };
 		AA50000000000000000002092 /* GalleryBrowsingTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002091 /* GalleryBrowsingTests.swift */; };
 		AA50000000000000000001992 /* GenerationOwnershipTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000001991 /* GenerationOwnershipTests.swift */; };
@@ -272,6 +273,7 @@
 		AA50000000000000000001981 /* QueueLivenessTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = QueueLivenessTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002081 /* GenerationResultPathTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationResultPathTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002095 /* SchedulerTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SchedulerTests.swift; sourceTree = "<group>"; };
+		AA50000000000000000002097 /* GenerationSeedTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationSeedTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002093 /* IrisConversionTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = IrisConversionTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002091 /* GalleryBrowsingTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GalleryBrowsingTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000001991 /* GenerationOwnershipTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationOwnershipTests.swift; sourceTree = "<group>"; };
@@ -534,6 +536,7 @@
 				AA50000000000000000001981 /* QueueLivenessTests.swift */,
 				AA50000000000000000002081 /* GenerationResultPathTests.swift */,
 				AA50000000000000000002095 /* SchedulerTests.swift */,
+				AA50000000000000000002097 /* GenerationSeedTests.swift */,
 				AA50000000000000000002093 /* IrisConversionTests.swift */,
 				AA50000000000000000002091 /* GalleryBrowsingTests.swift */,
 				AA70000000000000000000011 /* GalleryLoadingTests.swift */,
@@ -910,6 +913,7 @@
 				AA50000000000000000001982 /* QueueLivenessTests.swift in Sources */,
 				AA50000000000000000002082 /* GenerationResultPathTests.swift in Sources */,
 				AA50000000000000000002096 /* SchedulerTests.swift in Sources */,
+				AA50000000000000000002098 /* GenerationSeedTests.swift in Sources */,
 				AA50000000000000000002094 /* IrisConversionTests.swift in Sources */,
 				AA50000000000000000002092 /* GalleryBrowsingTests.swift in Sources */,
 				AA70000000000000000000012 /* GalleryLoadingTests.swift in Sources */,
```

**File**: `Mochi Diffusion/Support/CoreMLEngineRuntime.swift` (modified, +1/-1)
```diff
@@ -292,7 +292,7 @@ actor CoreMLEngineRuntime: GenerationEngineRuntime {
                 )
                 try await onResult(GenerationResult(metadata: metadata, imageData: data))
             }
-            pipelineConfig.seed += 1
+            pipelineConfig.seed = GenerationSeed.next(after: pipelineConfig.seed)
         }
     }
 
```

**File**: `Mochi Diffusion/Support/GenerationController.swift` (modified, +1/-1)
```diff
@@ -1187,7 +1187,7 @@ final class GenerationController {
             guidanceScale: Float(configStore.guidanceScale),
             scheduler: configStore.scheduler,
             quality: configStore.quality,
-            seed: seed == 0 ? UInt32.random(in: 0..<UInt32.max) : seed,
+            seed: seed == 0 ? GenerationSeed.random() : seed,
             numberOfImages: Int(numberOfImages),
             computeUnitPreference: configStore.mlComputeUnitPreference,
             reduceMemory: configStore.reduceMemory,
```

**File**: `Mochi Diffusion/Support/GenerationEngine.swift` (modified, +16/-0)
```diff
@@ -47,6 +47,22 @@ nonisolated struct ModelDiscoveryContext: Sendable {
     }
 }
 
+/// The seeds a generation uses.
+///
+/// The sidebar reserves seed 0 for "random", so no generated image is given
+/// seed 0: an image recorded with it could not be reproduced through Copy Options.
+nonisolated enum GenerationSeed {
+    static func random() -> UInt32 {
+        UInt32.random(in: 1...UInt32.max)
+    }
+
+    /// The seed for the image after one generated with `seed` in the same batch.
+    /// Wraps from `UInt32.max` to 1.
+    static func next(after seed: UInt32) -> UInt32 {
+        seed == .max ? 1 : seed + 1
+    }
+}
+
 /// Everything the sidebar holds, handed to an engine so it can decide what its own
 /// generation needs.
 ///
```

**File**: `Mochi Diffusion/Support/IrisEngineRuntime.swift` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ actor IrisEngineRuntime: GenerationEngineRuntime {
 
             let result = GenerationResult(metadata: metadata, imageData: imageData)
             try await onResult(result)
-            seed &+= 1
+            seed = GenerationSeed.next(after: seed)
         }
     }
 
```

**File**: `Mochi DiffusionTests/GenerationSeedTests.swift` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+//
+//  GenerationSeedTests.swift
+//  Mochi DiffusionTests
+//
+
+import Testing
+
+@testable import Mochi_Diffusion
+
+/// Pins that batch seeds advance without overflowing and that no generated image
+/// is given seed 0, which the sidebar reserves for "random".
+struct GenerationSeedTests {
+    @Test("A batch seed advances by one", arguments: [UInt32(1), 41, UInt32.max - 1])
+    func advancesByOne(seed: UInt32) {
+        #expect(GenerationSeed.next(after: seed) == seed + 1)
+    }
+
+    @Test("A batch seed wraps from UInt32.max to 1")
+    func wrapsPastMaximum() {
+        #expect(GenerationSeed.next(after: .max) == 1)
+    }
+
+    @Test("A batch starting at UInt32.max never uses seed 0")
+    func batchFromMaximumSkipsZero() {
+        var seeds: [UInt32] = [.max]
+        for _ in 0..<3 {
+            seeds.append(GenerationSeed.next(after: seeds.last!))
+        }
+        #expect(seeds == [.max, 1, 2, 3])
+    }
+
+    @Test("A random seed is never 0")
+    func randomSeedIsNeverZero() {
+        for _ in 0..<10_000 {
+            #expect(GenerationSeed.random() != 0)
+        }
+    }
+}
```

---

### Incident Patch 11: `9a0a3437` (2026-09-27)
**Commit Message**: docs: document the build, notarization and Sparkle signing steps

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `RELEASING.md` (modified, +70/-6)
```diff
@@ -18,19 +18,83 @@ what must be true before the release.
 You do not set the build number. `scripts/set_build_version.sh` runs during the build and sets
 `CFBundleVersion` to the commit count of `HEAD`.
 
+## Tools and one-time setup
+
+The release needs these tools:
+
+- Xcode, signed in with the Developer ID team.
+- `create-dmg` from npm (`npm install --global create-dmg`).
+- `sign_update` and `generate_keys` from the `bin` folder of a Sparkle release.
+
+Keep both signing secrets in the login keychain. Never put a secret in this repository, in
+release notes or in a shell command.
+
+1. Store the notarization credentials under the profile name that the notarize step uses:
+
+   ```sh
+   xcrun notarytool store-credentials "notarytool-password"
+   ```
+
+2. Import the Sparkle private key. The key signs every update, and installed copies accept
+   only updates that it signed. Put the key in a file, import it, then delete the file:
+
+   ```sh
+   generate_keys -f <private-key-file>
+   ```
+
+3. Make sure that the keychain holds the right key. This command prints the public key, which
+   must be equal to `SUPublicEDKey` in `MochiDiffusionInfo.plist`:
+
+   ```sh
+   generate_keys -p
+   ```
+
+Keep a backup of the Sparkle private key in a password manager. If you lose the key, you
+cannot ship updates to installed copies. To make a backup file, use `generate_keys -x <file>`.
+
 ## Release
 
 1. Bring `main` up to date with `develop`.
-2. Build, sign and notarize `MochiDiffusion_<version>.dmg` from `main`.
-3. Publish a GitHub release with the tag `v<version>`, and attach the DMG.
-4. Add an item for the new version at the top of `.sparkle/appcast.xml` on `main`. Copy the
+2. Build and notarize the app from `main`:
+   1. In Xcode, select Product > Archive.
+   2. In the Organizer, select Distribute App > Direct Distribution. Xcode signs the app and
+      sends it for notarization.
+   3. When notarization is complete, export `Mochi Diffusion.app`.
+3. Make the DMG in the folder that holds the exported app. `create-dmg` names it
+   `MochiDiffusion_<version>.dmg`.
+
+   ```sh
+   create-dmg "./Mochi Diffusion.app"
+   ```
+
+4. Notarize the DMG, then staple the ticket to it:
+
+   ```sh
+   xcrun notarytool submit "./MochiDiffusion_<version>.dmg" \
+       --keychain-profile "notarytool-password" --wait
+   xcrun stapler staple "./MochiDiffusion_<version>.dmg"
+   ```
+
+5. Tag the release commit `v<version>`. On GitHub, draft a new release for the tag, attach the
+   DMG and publish the release.
+6. Sign the DMG for Sparkle. `sign_update` reads the private key from the keychain, and prints
+   the `sparkle:edSignature` and `length` attributes:
+
+   ```sh
+   sign_update "./MochiDiffusion_<version>.dmg"
+   ```
+
+7. Add an item for the new version at the top of `.sparkle/appcast.xml` on `main`. Copy the
    format of the previous item. Sparkle reads the feed from `main`, so the update reaches
    users when this commit lands. The item needs these values:
-   - `sparkle:version`: the `CFBundleVersion` of the released app.
+   - `sparkle:version`: the `CFBundleVersion` of the exported app. Read it with
+     `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "Mochi Diffusion.app/Contents/Info.plist"`.
    - `sparkle:shortVersionString`: the new version.
    - The DMG URL from the GitHub release.
-   - `sparkle:edSignature` and `length`: the output of Sparkle's `sign_update` for the DMG.
-   - `pubDate` and a short description of the changes.
+   - `sparkle:edSignature` and `length` from step 6.
+   - `pubDate`: the time that GitHub published the release, in the same form as the other
+     items. `gh release view v<version> --json publishedAt` prints it.
+   - A short description of the changes.
 
 ## Code health snapshot
 
```

---

### Incident Patch 12: `3f1d4109` (2026-09-26)
**Commit Message**: fix: keep one gallery entry per image file

A folder sync that ran during an import read the gallery before the
import's copies finished, then added the copied files again after the
import had added them, so a long import could show each image twice.
ImageGallery.add now skips an image whose file name the gallery already
holds, which covers every order in which a sync, an import or a
generation result can reach the same file. Names are compared rather
than full paths because loading and writing can spell the folder's path
differently.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion/Model/ImageGallery.swift` (modified, +25/-9)
```diff
@@ -65,36 +65,52 @@ enum ImagesSortType: String {
         }
     }
 
+    /// Adds `sdi` unless the gallery already holds its file. See
+    /// `add(_:animate:)` for the rule. Returns nil when the image was skipped.
     @discardableResult
     func add(
         _ sdi: SDImage,
         metadataFields: Set<MetadataField> = Set(MetadataField.allCases),
         animate: Bool = true
-    ) -> SDImage.ID {
-        runWithOptionalAnimation(animate: animate) {
-            allImages.append(sdi)
-            metadataFieldsByImageID[sdi.id] = metadataFields
-            return sdi.id
-        }
+    ) -> SDImage.ID? {
+        add([(image: sdi, metadataFields: metadataFields)], animate: animate).first
     }
 
+    /// Adds the images whose files the gallery does not already hold, and returns
+    /// the IDs of those it added.
+    ///
+    /// The gallery mirrors one images folder, so it holds at most one entry per
+    /// file. A folder sync can find a file at the same time as an import or a
+    /// generation result adds it, and whichever arrives second is skipped. Files
+    /// are compared by name, because loading and writing can spell the folder's
+    /// path differently. An image with no path is always added.
     @discardableResult
     func add(
         _ imagesAndMetadata: [(image: SDImage, metadataFields: Set<MetadataField>)],
         animate: Bool = true
     )
         -> [SDImage.ID]
     {
-        runWithOptionalAnimation(animate: animate) {
-            let images = imagesAndMetadata.map(\.image)
+        var heldFileNames = Set(allImages.compactMap(Self.fileName(of:)))
+        let newItems = imagesAndMetadata.filter { item in
+            guard let fileName = Self.fileName(of: item.image) else { return true }
+            return heldFileNames.insert(fileName).inserted
+        }
+        guard !newItems.isEmpty else { return [] }
+        return runWithOptionalAnimation(animate: animate) {
+            let images = newItems.map(\.image)
             allImages.append(contentsOf: images)
-            for item in imagesAndMetadata {
+            for item in newItems {
                 metadataFieldsByImageID[item.image.id] = item.metadataFields
             }
             return images.map(\.id)
         }
     }
 
+    private static func fileName(of image: SDImage) -> String? {
+        image.path.isEmpty ? nil : URL(fileURLWithPath: image.path).lastPathComponent
+    }
+
     @discardableResult
     func add(_ sdis: [SDImage], animate: Bool = true) -> [SDImage.ID] {
         add(
```

**File**: `Mochi DiffusionTests/GalleryLoadingTests.swift` (modified, +63/-0)
```diff
@@ -378,6 +378,69 @@ struct GalleryLoadingTests {
         #expect(!controller.isLoading)
     }
 
+    /// The folder monitor syncs shortly after the first imported file lands, so a
+    /// long import overlaps a sync. The sync sees the copied files before the
+    /// import has added them to the gallery.
+    @Test("A folder sync during an import adds each imported image once")
+    func importAndSyncTogetherAddEachImageOnce() async throws {
+        let incoming = try temp.subdirectory("incoming")
+        let urls = try (0..<20).map { index in
+            try writeImportableImage(named: "\(index).png", prompt: "\(index)", in: incoming)
+            return incoming.appending(path: "\(index).png")
+        }
+        let gallery = ImageGallery()
+        let controller = try await makeSettledController(gallery: gallery)
+
+        async let imported = controller.importImages(from: urls)
+        async let synced: Void = controller.syncImages()
+        _ = await (imported, synced)
+
+        #expect(gallery.allImages.count == 20)
+        #expect(Set(gallery.allImages.map(\.prompt)).count == 20)
+    }
+
+    // MARK: - One entry per file
+
+    @Test("The gallery skips an image whose file it already holds")
+    func galleryHoldsOneEntryPerFile() {
+        let gallery = ImageGallery()
+        let original = SDImage(
+            image: nil, aspectRatio: 1, path: imageDir.appending(path: "one.png").path)
+        // The same file reached through the resolved spelling of the folder.
+        let again = SDImage(
+            image: nil,
+            aspectRatio: 1,
+            path: imageDir.resolvingSymlinksInPath().appending(path: "one.png").path
+        )
+
+        let other = SDImage(
+            image: nil, aspectRatio: 1, path: imageDir.appending(path: "two.png").path)
+        let fields: Set<MetadataField> = [.prompt]
+
+        let added = gallery.add(original)
+        let skipped = gallery.add(again)
+        let batch = gallery.add([
+            (image: again, metadataFields: fields),
+            (image: other, metadataFields: fields),
+        ])
+
+        #expect(added == original.id)
+        #expect(skipped == nil)
+        #expect(batch.count == 1)
+        #expect(gallery.allImages.count == 2)
+        #expect(gallery.allImages.first?.id == original.id)
+    }
+
+    @Test("Images with no file are always added")
+    func imagesWithoutPathsAreAlwaysAdded() {
+        let gallery = ImageGallery()
+
+        gallery.add(SDImage())
+        gallery.add(SDImage())
+
+        #expect(gallery.allImages.count == 2)
+    }
+
     // MARK: - Save All
 
     @Test("Save All writes every gallery image, numbered in gallery order")
```

---

### Incident Patch 13: `2a5836c3` (2026-09-26)
**Commit Message**: build: add a code health snapshot to the release procedure

scripts/code_health.sh runs coverage, Periphery, SwiftLint analyze,
Lizard and a Thread Sanitizer test run, and prints a summary to record
in the release epic. RELEASING.md collects the release steps and makes
the snapshot an informational step before the release build. AGENTS.md
points to it and lists the static analysis sub-epic of 6.2.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +4/-1)
```diff
@@ -5,6 +5,8 @@
 - Run tests: `xcodebuild test -project "Mochi Diffusion.xcodeproj" -scheme "Mochi Diffusion" -destination "platform=macOS" -configuration Debug`
 - Lint/format: `swift format lint -p -r ./`  
 - Always ensure the project builds cleanly after any change. Resolve any lint warnings before committing any changes.
+- Releases follow [RELEASING.md](RELEASING.md). Before the release build, record a code health
+  snapshot with `scripts/code_health.sh`. The snapshot is informational and never blocks a release.
 
 ## Commit & Pull Request Guidelines
 - Commit message format (from `CONTRIBUTING.md`):  
@@ -49,7 +51,8 @@ Draw Things wrote. The abandoned Iris LoRA experiments are not carry-over work.
 
 Beads owns task status, acceptance criteria and dependencies. `MochiDiffusion-bpb` is the
 finite 6.2 release epic: `MochiDiffusion-bpb.1` holds the backlog fixes,
-`MochiDiffusion-ruj` is PNG-only output and `MochiDiffusion-e4v` is Musubi.
+`MochiDiffusion-ruj` is PNG-only output, `MochiDiffusion-bpb.2` acts on the static analysis
+pass and `MochiDiffusion-e4v` is Musubi.
 `MochiDiffusion-2lu` is the beta line and is not part of 6.2. Use the existing
 database; do not create a replacement if access fails. Closed beads are historical and
 may describe abandoned work. They do not create obligations to restore it. Do not turn
```

**File**: `RELEASING.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# Releasing Mochi Diffusion
+
+This document lists the steps to release a new version of Mochi Diffusion. Beads holds the
+release epic for each version. The epic records the scope, and its acceptance criteria list
+what must be true before the release.
+
+## Before the release build
+
+1. Make sure that every child of the release epic is closed or explicitly dropped.
+2. Make sure that the build, the full test suite and `swift format lint -s -p -r ./` pass on
+   `develop`.
+3. Record a code health snapshot. See [Code health snapshot](#code-health-snapshot).
+4. Set `MARKETING_VERSION` in `Mochi Diffusion.xcodeproj` to the new version. The app target
+   has one value for Debug and one for Release. Change both values in one
+   `build: bump app version to <version>` commit.
+5. Add a section for the new version at the top of `CHANGELOG.md`.
+
+You do not set the build number. `scripts/set_build_version.sh` runs during the build and sets
+`CFBundleVersion` to the commit count of `HEAD`.
+
+## Release
+
+1. Bring `main` up to date with `develop`.
+2. Build, sign and notarize `MochiDiffusion_<version>.dmg` from `main`.
+3. Publish a GitHub release with the tag `v<version>`, and attach the DMG.
+4. Add an item for the new version at the top of `.sparkle/appcast.xml` on `main`. Copy the
+   format of the previous item. Sparkle reads the feed from `main`, so the update reaches
+   users when this commit lands. The item needs these values:
+   - `sparkle:version`: the `CFBundleVersion` of the released app.
+   - `sparkle:shortVersionString`: the new version.
+   - The DMG URL from the GitHub release.
+   - `sparkle:edSignature` and `length`: the output of Sparkle's `sign_update` for the DMG.
+   - `pubDate` and a short description of the changes.
+
+## Code health snapshot
+
+The snapshot records the state of the code at each release, so that you can compare
+releases. It does not block a release. A finding in the snapshot does not require a fix
+before the release. If a finding needs work, create a bead for it.
+
+The script needs Xcode, `periphery` and `swiftlint` from Homebrew, and `uv`. Do not install
+the Homebrew formula named `lizard`, because it is an unrelated compression tool. The script
+runs the Lizard complexity analyzer from PyPI through `uvx`.
+
+1. Run the script from the repository root:
+
+   ```sh
+   scripts/code_health.sh
+   ```
+
+   The script runs the tests two times, once with code coverage and once under Thread
+   Sanitizer. It writes its output to a folder in `$TMPDIR` and prints a summary at the end.
+
+2. Append the summary to the notes of the release epic:
+
+   ```sh
+   bd update <release-epic> --append-notes "$(cat <output-folder>/summary.txt)"
+   ```
+
+3. Compare the summary with the one from the previous release. If a number changed by a large
+   amount, read the detailed output in the output folder.
+
+The summary contains these values:
+
+- Test totals and the line coverage of the app target. The test bundle runs inside the app,
+  so view coverage comes mostly from the app launch.
+- Unused declarations from Periphery, and declarations that only the tests use. The count
+  includes the preserved OpenAI and engine-picker code.
+- Unused imports and force unwraps from SwiftLint.
+- The number of functions, their average cyclomatic complexity and the functions above 15.
+  Cyclomatic complexity is the number of independent paths through a function.
+- Data race reports from the Thread Sanitizer test run.
```

**File**: `scripts/code_health.sh` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+#!/bin/bash
+# Records a code health snapshot: test coverage, unused code, unused imports,
+# force unwraps, complexity and a Thread Sanitizer test run.
+#
+# The snapshot is informational. Findings never fail the script, and a tool that
+# is not installed is skipped with a note in the summary.
+#
+# Usage: scripts/code_health.sh [--skip-tsan] [output-directory]
+#
+# Tools: Xcode, periphery and swiftlint (Homebrew), and uv. The Homebrew formula
+# named lizard is an unrelated compression tool, so the complexity analyzer runs
+# from PyPI through uvx.
+set -uo pipefail
+
+cd "$(dirname "$0")/.." || exit 1
+
+skip_tsan=false
+out_dir=""
+for arg in "$@"; do
+  case "$arg" in
+    --skip-tsan) skip_tsan=true ;;
+    -h | --help)
+      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
+      exit 0
+      ;;
+    *) out_dir="$arg" ;;
+  esac
+done
+
+commit="$(git rev-parse --short=12 HEAD)"
+if [ -z "$out_dir" ]; then
+  out_dir="${TMPDIR:-/tmp}/mochi-code-health/$(date +%Y%m%d-%H%M%S)-${commit}"
+fi
+mkdir -p "$out_dir"
+out_dir="$(cd "$out_dir" && pwd)"
+
+project="Mochi Diffusion.xcodeproj"
+scheme="Mochi Diffusion"
+app_sources="Mochi Diffusion"
+summary="$out_dir/summary.txt"
+
+has() { command -v "$1" >/dev/null 2>&1; }
+log() { printf '==> %s\n' "$*"; }
+note() { printf '%s\n' "$*" >>"$summary"; }
+
+run_tests() {
+  local name="$1"
+  shift
+  xcodebuild test \
+    -project "$project" \
+    -scheme "$scheme" \
+    -destination "platform=macOS" \
+    -configuration Debug \
+    -derivedDataPath "$out_dir/$name/DerivedData" \
+    -resultBundlePath "$out_dir/$name/result.xcresult" \
+    CODE_SIGNING_ALLOWED=NO \
+    "$@" >"$out_dir/$name/xcodebuild.log" 2>&1
+}
+
+# Prints "result, N passed, N failed" from a result bundle.
+test_totals() {
+  xcrun xcresulttool get test-results summary --path "$1" 2>/dev/null | python3 -c '
+import json, sys
+try:
+    d = json.load(sys.stdin)
+    print("%s, %d passed, %d failed" % (d["result"], d["passedTests"], d["failedTests"]))
+except Exception:
+    print("no test results")
+'
+}
+
+{
+  echo "Code health snapshot"
+  echo "Commit: $commit ($(git log -1 --format=%cs))"
+  echo "Date: $(date '+%Y-%m-%d %H:%M')"
+  echo "Output: $out_dir"
+  echo
+} >"$summary"
+
+# Coverage. This build's index store and compiler log feed Periphery and
+# SwiftLint analyze, so this step runs first.
+log "Running tests with code coverage"
+mkdir -p "$out_dir/coverage"
+run_tests coverage -enableCodeCoverage YES
+coverage_bundle="$out_dir/coverage/result.xcresult"
+index_store="$out_dir/coverage/DerivedData/Index.noindex/DataStore"
+compiler_log="$out_dir/coverage/xcodebuild.log"
+note "Tests: $(test_totals "$coverage_bundle")"
+
+if [ -d "$coverage_bundle" ]; then
+  xcrun xccov view --report --json "$coverage_bundle" >"$out_dir/coverage/coverage.json" 2>/dev/null
+  python3 - "$out_dir/coverage/coverage.json" "$app_sources" >"$out_dir/coverage/files.txt" <<'EOF'
+import json, sys
+report, sources = json.load(open(sys.argv[1])), sys.argv[2]
+app = next(t for t in report["targets"] if t["name"] == sources + ".app")
+print(f"app {app['lineCoverage'] * 100:.1f}% ({app['coveredLines']}/{app['executableLines']})")
+rows = []
+for f in app["files"]:
+    path = f["path"].split(sources + "/", 1)[-1]
+    if path.startswith(("Support/", "Model/")):
+        rows.append((f["lineCoverage"], f["executableLines"], path))
+for coverage, lines, path in sorted(rows):
+    print(f"{coverage * 100:5.1f}% {lines:5d} {path}")
+EOF
+  note "Coverage, app target: $(head -1 "$out_dir/coverage/files.txt" | cut -d' ' -f2-)"
+  note "  The test bundle runs inside the app, so view coverage mostly reflects the app launch."
+  note "  Per-file coverage for Support and Model: coverage/files.txt"
+else
+  note "Coverage: no result bundle. See coverage/xcodebuild.log"
+fi
+
+# Unused code. The first scan counts test usage. The second ignores it, so its
+# extra results are declarations that only the tests use.
+if has periphery && [ -d "$index_store" ]; then
+  log "Running Periphery"
+  periphery_args=(
+    --project "$project"
+    --schemes "$scheme"
+    --index-store-path "$index_store"
+    --retain-swift-ui-previews
+    --retain-codable-properties
+    --retain-equatable-properties
+    --retain-hashable-properties
+    --report-exclude "Vendor/**"
+    --report-exclude "iris.c/**"
+    --report-exclude "Mochi DiffusionTests/**"
+    --relative-results
+    --quiet
+  )
+  periphery scan "${periphery_args[@]}" >"$out_dir/periphery.txt" 2>&1
+  periphery scan "${periphery_args[@]}" --index-exclude "Mochi DiffusionTests/**" \
+    >"$out_dir/periphery-without-tests.txt" 2>&1
+  unused=$(grep -c ': warning: ' "$out_dir/periphery.txt")
+  test_only=$(comm -13 <(sort "$out_dir/periphery.txt") \
+    <(sort "$out_dir/periphery-without-tests.txt") | grep -c ': warning: ')
+  note "Periphery: $unused unused declarations, $test_only more used only by tests"
+  note "  This count includes the p
```

---

### Incident Patch 14: `39719d0f` (2026-09-26)
**Commit Message**: fix: share one image repository across the app

ImageGallery, GenerationService, GenerationController and GalleryController each created their own ImageRepository, so filename allocation was only serialized per instance. Two writers could pick the same free name and the second atomic write would replace the first file. The app now creates one repository and injects it into every owner.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Mochi Diffusion/MochiDiffusionApp.swift` (modified, +7/-1)
```diff
@@ -38,20 +38,25 @@ struct MochiDiffusionApp: App {
 
     init() {
         let configStore = ConfigStore()
-        let imageGallery = ImageGallery()
+        // One repository for every writer, so filename allocation covers all of
+        // them. See `ImageRepository`.
+        let imageRepository = ImageRepository()
+        let imageGallery = ImageGallery(imageRepository: imageRepository)
         let thumbnailProvider = GalleryThumbnailProvider()
         let fullImageProvider = GalleryFullImageProvider()
         let engineRegistry = EngineRegistry()
         self.thumbnailProvider = thumbnailProvider
         self.fullImageProvider = fullImageProvider
         let generationService = GenerationService(
+            imageRepository: imageRepository,
             engineRegistry: engineRegistry,
             imageGallery: imageGallery
         )
         self._configStore = State(initialValue: configStore)
         self._generationController = State(
             initialValue: GenerationController(
                 configStore: configStore,
+                imageRepository: imageRepository,
                 imageGallery: imageGallery,
                 generationService: generationService,
                 engineRegistry: engineRegistry,
@@ -62,6 +67,7 @@ struct MochiDiffusionApp: App {
             initialValue: GalleryController(
                 configStore: configStore,
                 imageGallery: imageGallery,
+                imageRepository: imageRepository,
                 // The same instances the views read from, so invalidating on a
                 // delete or an import reaches what is actually on screen.
                 thumbnailProvider: thumbnailProvider,
```

**File**: `Mochi Diffusion/Support/ImageRepository.swift` (modified, +8/-0)
```diff
@@ -58,6 +58,14 @@ enum ImageRepositoryError: Error {
     case imageDirectoryUnavailable(String, reason: String)
 }
 
+/// Reads and writes the images folder.
+///
+/// Choosing a free filename and writing to it happen in one actor call, so two
+/// writes through the same repository never pick the same name. That guarantee
+/// covers only callers that share an instance: the app creates one and gives it
+/// to every owner that writes images, which matters because generations are not
+/// guaranteed to finish one at a time. It does not protect against other
+/// processes writing to the same folder.
 actor ImageRepository {
     private static let supportedImageExtensions: Set<String> = ["png", "jpg", "jpeg", "heic"]
 
```

---

### Incident Patch 15: `a2c311b0` (2026-09-26)
**Commit Message**: build: point the Iris submodule at the renamed iris.c fork

The gdbing fork of antirez/iris.c is renamed from flux2.c to iris.c, matching the upstream rename and the submodule's path. The pinned revision is unchanged.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.gitmodules` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 [submodule "iris.c"]
 	path = iris.c
-	url = https://github.com/gdbing/flux2.c.git
+	url = https://github.com/gdbing/iris.c.git
```

#### Recent Merged Pull Requests:
- **PR #522** (2026-09-26): New Crowdin updates (@itsjoshpark)
- **PR #520** (2026-09-26): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.2 (@dependabot[bot])
- **PR #519** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.1 (@dependabot[bot])
- **PR #518** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.0 (@dependabot[bot])
- **PR #517** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.17.1 (@dependabot[bot])
- **PR #516** (2026-09-26): build(deps): bump actions/checkout from 6.0.3 to 7.0.1 (@dependabot[bot])
- **PR #515** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.17.0 (@dependabot[bot])
- **PR #514** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.16.4 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
