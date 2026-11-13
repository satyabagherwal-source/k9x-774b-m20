# Verification Protocol: Verification Protocol: Empirical Defect Shield for xcodesorg-xcodesapp-learnings

<!-- PROVENANCE_START
{
  "source_repository": "xcodesorg-xcodesapp-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:46:45.518Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-xcodesorg-xcodesapp-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xcodesorg-xcodesapp-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:46:45.518Z`  
> **Learning ID**: `LEARN-REEXTRACT-xcodesorg-xcodesapp-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `xcodesorg-xcodesapp-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xcodesorg-xcodesapp-learnings.md`  
> **Source**: github ([https://github.com/XcodesOrg/XcodesApp](https://github.com/XcodesOrg/XcodesApp))  
> **Source Version**: `9836fd83`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T01:23:16.434Z  
> **Learning ID**: `learn-github-xcodesorg-xcodesapp`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): XcodesOrg/XcodesApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/xcodesorg-xcodesapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/XcodesOrg/XcodesApp](https://github.com/XcodesOrg/XcodesApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T01:23:16.428Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `XcodesOrg/XcodesApp`
- **Description**: The easiest way to install and switch between multiple versions of Xcode - with a mouse click. 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8647 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Xcodes/Backend/AppState+Install.swift`
```
import Foundation
@preconcurrency import Path
@preconcurrency import Version
import LegibleError
import os.log
import DockProgress
import XcodesKit
import XcodesLoginKit

/// Downloads and installs Xcodes
extension AppState {

    static func installNotificationTitle(for version: Version) -> String {
        version.appleDescription
    }

    // check to see if we should auto install for the user
    public func autoInstallIfNeeded() {
        guard let storageValue = Current.defaults.get(forKey: "autoInstallation") as? Int, let autoInstallType = AutoInstallationType(rawValue: storageValue) else { return }

        let decision = XcodeAutoInstallService().decision(
            autoInstallationType: autoInstallType,
            xcodes: allXcodes.map(\.listItem)
        )

        switch decision {
        case .disabled:
            return
        case .alreadyInstalled:
            Logger.appState.info("User has latest Xcode already installed")
        case let .installNewestBeta(id):
            Logger.appState.info("Auto installing newest Xcode Beta")
            checkMinVersionAndInstall(id: id)
        case let .installNewestVersion(id):
            Logger.appState.info("Auto installing newest Xcode")
            checkMinVersionAndInstall(id: id)
        case .noNewVersion:
            Logger.appState.info("No new Xcodes version found to auto install")
        }
    }

    func installAsync(_ installationType: InstallationType, downloader: Downloader, attemptNumber: Int) async throws -> InstalledXcode {
        if attemptNumber == 0, case let .version(availableXcode) = installationType {
            // Runtimes don't depend on the new Xcode being installed, so download them alongside it.
            autoDownloadPlatforms(for: availableXcode)
        }

        return try await xcodeInstallRetryService.install(
            attemptNumber: attemptNumber,
            shouldRetryAfterDamagedArchive: installationType.shouldRetryAfterDamagedArchive,
            attempt: { @MainActor _ in
                Logger.appState.info("Using \(downloader) downloader")
                setupDockProgress()

                try await validateSessionAsync()
                let (xcode, url) = try await getXcodeArchiveAsync(installationType, downloader: downloader)
                try Task.checkCancellation()
                let installedXcode = try await installArchivedXcodeAsync(xcode, at: url)
                // Refreshed before the row is patched: `updateAllXcodes` rebuilds every row from this cache
                // on the next selection or update, carrying over only rows that are still `.installing`.
                await updateInstalledXcodesAsync(recomposeAllXcodes: false)

                guard let index = allXcodes.firstIndex(where: { $0.version.isEquivalent(to: installedXcode.version) }) else {
                    return installedXcode
                }
                allXcodes[index].installState = .installed(installedXcode.path)
                return installedXcode
            },
            onAttemptFailed: { @MainActor _ in
                resetDockProgressTracking()
            },
            onRetryDamagedArchive: { error, _ in
                Logger.appState.error("\(error.legibleLocalizedDescription)")
                Logger.appState.info("Removing damaged XIP and re-attempting installation.")
            }
        )
    }

    private var xcodeInstallRetryService: XcodeInstallRetryService {
        XcodeInstallRetryService(
            damagedArchiveURL: { error in
                guard case InstallationError.damagedXIP(let url) = error else { return nil }
                return url
            },
            removeDamagedArchive: { url in
                try Current.files.removeItem(at: url)
            }
        )
    }

    private func getXcodeArchiveAsync(_ installationType: InstallationType, downloader: Downloader) async throws -> (AvailableXcode, URL) {
        let installedXcodes = await updateInstalledXcodesAsync(recomposeAllXcodes: false)

        switch installationType {
        case .version(let availableXcode):
            let resolution = try mapInstallResolutionError {
                try XcodeInstallResolutionService().resolve(
                    .availableXcode(availableXcode),
                    availableXcodes: [],
                    installedXcodes: installedXcodes,
                    willInstall: true
                )
            }

            return try await archive(for: resolution, downloader: downloader)
        }
    }

    private func archive(for resolution: XcodeInstallResolution, downloader: Downloader) async throws -> (AvailableXcode, URL) {
        switch resolution {
        case let .download(_, .some(availableXcode)):
            return try await downloadXcodeAsync(availableXcode: availableXcode, downloader: downloader)
        case .download:
            throw XcodesKitError("Expected Xcode install resolution to include a selected Xcode")
        case let .localArchive(xcode, url):
            return (xcode, url)
        }
    }

    private func mapInstallResolutionError<T>(_ body: () throws -> T) throws -> T {
        do {
            return try body()
        } catch let error as XcodeInstallResolutionError {
            switch error {
            case let .invalidVersion(version):
                throw InstallationError.invalidVersion(version)
            case .noReleaseVersionAvailable:
                throw InstallationError.noNonPrereleaseVersionAvailable
            case .noPrereleaseVersionAvailable:
                throw InstallationError.noPrereleaseVersionAvailable
            case let .versionAlreadyInstalled(installedXcode):
                throw InstallationError.versionAlreadyInstalled(installedXcode)
            }
        }
    }

    private func downloadXcodeAsync(availableXcode: AvailableXcode, downloader: Downloader) async throws -> (AvailableXcode, URL) {
        let expectedInstallationTaskID = installationTaskIDs[availableXcode.xcodeID]
        let url = try await downloadOrUseExistingArchiveAsync(for: availableXcode, downloader: downloader, progressChanged: { [unowned self] progress in
            Task { @MainActor in
                if let expectedInstallationTaskID, self.installationTaskIDs[availableXcode.xcodeID] != expectedInstallationTaskID {
                    return
                }

                let isAlreadyDownloading: Bool
                if let xcode = self.allXcodes.first(where: { $0.version.isEquivalent(to: availableXcode.version) }),
                   case .installing(.downloading) = xcode.installState
                {
                    isAlreadyDownloading = true
                } else {
                    isAlreadyDownloading = false
                }

                self.setInstallationStep(of: availableXcode.version, to: .downloading(progress: progress), postNotification: !isAlreadyDownloading)
                self.addDockProgressChildIfNeeded(progress, withPendingUnitCount: AppState.totalProgressUnits - AppState.unxipProgressWeight)
            }
        })

        return (availableXcode, url)
    }

    public func downloadOrUseExistingArchiveAsync(for availableXcode: AvailableXcode, downloader: Downloader, progressChanged: @escaping @Sendable (Progress) -> Void) async throws -> URL {
        let url = try await archiveService().archiveURL(
            for: XcodeArchive(availableXcode),
            downloader: downloader,
            progressChanged: progressChanged
        )
        Logger.appState.info("Using Xcode archive at \(url.path).")
        return url
    }

    private func archiveService() -> XcodeArchiveService {
        XcodeArchiveService(
            applicationSupportPath: Path.xcodesApplicationSupport,
            fileExists: { Current.files.fileExistsAtPath($0.string) },
            download: { archive, destination, downloader, progressChanged in
                try await self.archiveDownloadStrategyService.download(
                    archive: archive,
                    destination: destination,
                    downloader: downloader,
                    applicationSupportPath: Path.xcodesApplicationSupport,
                    progressChanged: progressChanged
                )
            }
        )
    }

    private var archiveDownloadStrategyService: ArchiveDownloadStrategyService {
        ArchiveDownloadStrategyService(
            archiveDownloadService: archiveDownloadService,
            aria2Path: { Path(url: Bundle.main.url(forAuxiliaryExecutable: "aria2c")!)! },
            cookiesForURL: { Current.network.session.configuration.httpCookieStorage?.cookies(for: $0) ?? [] }
        )
    }

    private var archiveDownloadService: ArchiveDownloadService {
        ArchiveDownloadService(
            aria2Download: { aria2Path, url, destination, cookies in
                Current.shell.downloadWithAria2Async(aria2Path, url, destination, cookies)
            },
            urlSessionDownload: { url, destination, resumeData in
                Current.network.downloadTaskAsync(with: url, to: destination, resumingWith: resumeData)
            },
            contentsAtPath: { path in
                Current.files.contents(atPath: path)
            },
            createFile: { path, data in
                Current.files.createFile(atPath: path, contents: data)
            },
            removeItem: { try Current.files.removeItem(at: $0) },
            shouldRetry: { error in
                error as? AuthenticationError != .notAuthorized
            },
            validateResponse: { response in
                try ArchiveDownloadService.validateDeveloperDownloadResponse(
                    response,
                    unauthorizedError: { AuthenticationError.notAuthorized }
                )
            }
        )
    }

    public func installArchivedXcodeAsync(_ availableXcode: AvailableXcode, at archiveURL: URL) async throws -> InstalledXcode {
        unxipProgress.comple
```

### Core Architecture Module: `Xcodes/Backend/AppState+Runtimes.swift`
```
import Foundation
import XcodesKit
import OSLog
import Path
import Version

extension AppState {
    func updateDownloadableRuntimes() {
        downloadableRuntimesTask?.cancel()
        let taskID = UUID()
        downloadableRuntimesTaskID = taskID
        downloadableRuntimesTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                if self.downloadableRuntimesTaskID == taskID {
                    self.downloadableRuntimesTask = nil
                    self.downloadableRuntimesTaskID = nil
                }
            }
            do {
                var store = self.runtimeListStore
                let runtimes = try await store.updateDownloadableRuntimes()
                try Task.checkCancellation()

                self.downloadableRuntimes = runtimes
            } catch is CancellationError {
            } catch {
                Logger.appState.error("Error downloading runtimes: \(error.localizedDescription)")
            }
        }
    }

    func updateInstalledRuntimes() {
        installedRuntimesTask?.cancel()
        let taskID = UUID()
        installedRuntimesTaskID = taskID
        installedRuntimesTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                if self.installedRuntimesTaskID == taskID {
                    self.installedRuntimesTask = nil
                    self.installedRuntimesTaskID = nil
                }
            }
            do {
                Logger.appState.info("Loading Installed runtimes")
                let runtimes = try await self.runtimeService.localInstalledRuntimes()
                try Task.checkCancellation()

                self.installedRuntimes = runtimes
            } catch is CancellationError {
            } catch {
                Logger.appState.error("Error loading installed runtimes: \(error.localizedDescription)")
            }
        }
    }

    func downloadRuntime(runtime: DownloadableRuntime) {
        do {
            let method = try RuntimeInstallPolicy().installMethod(
                for: runtime,
                selectedXcodeVersion: allXcodes.first(where: { $0.selected })?.version
            )

            switch method {
            case .archive:
                downloadRuntimeViaArchive(runtime: runtime)
            case let .xcodebuild(architecture):
                downloadRuntimeViaXcodeBuild(runtime: runtime, architecture: architecture)
            }
        } catch {
            presentRuntimeInstallPolicyError(error)
        }
    }

    private func presentRuntimeInstallPolicyError(_ error: Error) {
        Logger.appState.error("Trying to download a runtime we can't download: \(error.localizedDescription)")

        if let error = error as? RuntimeInstallPolicyError {
            switch error {
            case .noSelectedXcode:
                presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: "No selected Xcode. Please make an Xcode active")
            case .xcode16_1OrGreaterRequired:
                presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: localizeString("Alert.Install.Error.Need.Xcode16.1"))
            case .xcode26OrGreaterRequired:
                presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: localizeString("Alert.Install.Error.Need.Xcode26"))
            }
        } else {
            presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: error.legibleLocalizedDescription)
        }
    }

    func downloadRuntimeViaXcodeBuild(runtime: DownloadableRuntime, architecture: String? = nil) {
        runtimeTasks[runtime.identifier]?.cancel()
        let runtimeTaskID = UUID()
        runtimeTaskIDs[runtime.identifier] = runtimeTaskID
        runtimeTasks[runtime.identifier] = Task { @MainActor [weak self] in
            guard let self = self else { return }
            defer {
                if self.runtimeTaskIDs[runtime.identifier] == runtimeTaskID {
                    self.runtimeTasks[runtime.identifier] = nil
                    self.runtimeTaskIDs[runtime.identifier] = nil
                }
            }
            do {
                try await RuntimeXcodebuildInstallService(download: Current.shell.downloadRuntime).downloadAndInstall(
                    runtime: runtime,
                    architecture: architecture
                ) { progress in
                    Task { @MainActor [weak self] in
                        guard
                            let self,
                            self.runtimeTaskIDs[runtime.identifier] == runtimeTaskID
                        else { return }

                        if progress.isIndeterminate {
                            self.setInstallationStep(of: runtime, to: .installing, postNotification: false)
                        } else {
                            self.setInstallationStep(of: runtime, to: .downloading(progress: progress), postNotification: false)
                        }
                    }
                }
                try Task.checkCancellation()
                Logger.appState.debug("Done downloading runtime - \(runtime.name)")

                guard let index = self.downloadableRuntimes.firstIndex(where: { $0.identifier == runtime.identifier }) else { return }
                self.downloadableRuntimes[index].installState = .installed
                self.update()

            } catch is CancellationError {
            } catch {
                Logger.appState.error("Error downloading runtime: \(error.localizedDescription)")
                self.error = error
                if let error = error as? XcodesKitError {
                    self.presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: error.message)
                } else {
                    self.presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: error.legibleLocalizedDescription)
                }
            }
        }
    }

    func downloadRuntimeViaArchive(runtime: DownloadableRuntime) {
        runtimeTasks[runtime.identifier]?.cancel()
        let runtimeTaskID = UUID()
        runtimeTaskIDs[runtime.identifier] = runtimeTaskID
        runtimeTasks[runtime.identifier] = Task { @MainActor [weak self] in
            guard let self = self else { return }
            defer {
                if self.runtimeTaskIDs[runtime.identifier] == runtimeTaskID {
                    self.runtimeTasks[runtime.identifier] = nil
                    self.runtimeTaskIDs[runtime.identifier] = nil
                }
            }
            do {
                let downloadedURL = try await downloadRuntimeArchive(runtime: runtime, taskID: runtimeTaskID)
                try Task.checkCancellation()
                Logger.appState.debug("Installing runtime: \(runtime.name)")
                try await self.runtimeArchiveInstallService.install(
                    runtime: runtime,
                    archiveURL: downloadedURL,
                    stepChanged: { step in
                        await self.setInstallationStep(of: runtime, to: step)
                    }
                )

                guard let index = self.downloadableRuntimes.firstIndex(where: { $0.identifier == runtime.identifier }) else { return }
                self.downloadableRuntimes[index].installState = .installed
                updateInstalledRuntimes()
            } catch is CancellationError {
            } catch {
                Logger.appState.error("Error downloading runtime: \(error.localizedDescription)")
                self.error = error
                if let error = error as? XcodesKitError {
                    self.presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: error.message)
                } else {
                    self.presentedAlert = .generic(title: localizeString("Alert.Install.Error.Title"), message: error.legibleLocalizedDescription)
                }
            }
        }
    }

    func downloadRuntimeArchive(runtime: DownloadableRuntime, taskID: UUID? = nil) async throws -> URL {
        let downloader = Downloader(rawValue: Current.defaults.string(forKey: "downloader") ?? "aria2") ?? .aria2

        Logger.appState.info("Downloading \(runtime.visibleIdentifier) with \(downloader)")
        let archiveURL = try await runtimeArchiveService().archiveURL(
            for: runtime,
            destinationDirectory: .xcodesApplicationSupport,
            downloader: downloader
        ) { [weak self] progress in
            let expectedTaskID = taskID
            Task { @MainActor [weak self] in
                if let expectedTaskID, self?.runtimeTaskIDs[runtime.identifier] != expectedTaskID {
                    return
                }
                self?.setInstallationStep(of: runtime, to: .downloading(progress: progress), postNotification: false)
            }
        }
        Logger.appState.info("Using runtime archive at \(archiveURL.path).")
        return archiveURL
    }

    private func runtimeArchiveService() -> RuntimeArchiveService {
        RuntimeArchiveService(
            fileExists: { Current.files.fileExistsAtPath($0.string) },
            download: { runtime, url, destination, downloader, progressChanged in
                let archiveURL = try await self.runtimeArchiveDownloadStrategyService.download(
                    runtime: runtime,
                    url: url,
                    destination: destination,
                    downloader: downloader,
                    progressChanged: progressChanged
                )
                Logger.appState.debug("Done downloading runtime")
                return archiveURL
            }
        )
    }

    private var runtimeArchiveDownloadStrategyService: RuntimeArchiveDownloadStrategyService {
        RuntimeArchiveDown
```

### Core Architecture Module: `Xcodes/Backend/AppState+Update.swift`
```
import Foundation
import Path
import XcodesLoginKit
import XcodesKit

extension AppState {
    
    var isReadyForUpdate: Bool {
        XcodeUpdatePolicy(now: { Current.date() }).shouldUpdate(
            cachedXcodes: availableXcodes,
            lastUpdated: Current.defaults.date(forKey: "lastUpdated")
        )
    }
    
    func updateIfNeeded() {
        // Never cancel a full refresh just because the window became active again.
        if isUpdating, updateTaskIsFullRefresh { return }
        guard
            isReadyForUpdate || !hasRefreshedAvailableXcodesThisLaunch
        else {
            updateTask?.cancel()
            let taskID = UUID()
            updateTaskIsFullRefresh = false
            updateTaskID = taskID
            let task = Task { @MainActor in
                defer {
                    if updateTaskID == taskID {
                        updateTask = nil
                        updateTaskID = nil
                    }
                }
                await self.updateInstalledXcodesAsync()
                await self.updateSelectedXcodePathAsync()
            }
            updateTask = task
            return
        }
        update() as Void
    }

    /// Refreshes installed and available Xcodes and runtimes.
    /// - Parameter restartingInFlightUpdate: Cancel a running refresh and start over, e.g. when the
    ///   data source or sign-in state changed and the running refresh would return stale results.
    func update(restartingInFlightUpdate: Bool = false) {
        if isUpdating {
            // A quick installed-only rescan is always superseded; a full refresh only when asked.
            guard restartingInFlightUpdate || !updateTaskIsFullRefresh else { return }
            updateTask?.cancel()
            updateTask = nil
            updateTaskID = nil
        }
        hasRefreshedAvailableXcodesThisLaunch = true
        updateTaskIsFullRefresh = true
        updateDownloadableRuntimes()
        updateInstalledRuntimes()

        let taskID = UUID()
        updateTaskID = taskID
        let task = Task { @MainActor in
            defer {
                if updateTaskID == taskID {
                    updateTask = nil
                    updateTaskID = nil
                }
            }
            do {
                await self.updateInstalledXcodesAsync()
                await self.updateSelectedXcodePathAsync()
                try Task.checkCancellation()
                let xcodes = try await self.updateAvailableXcodes(from: self.dataSource)
                try Task.checkCancellation()
                self.availableXcodes = xcodes
                Current.defaults.setDate(Current.date(), forKey: "lastUpdated")
            } catch is CancellationError {
            } catch {
                // A restarted refresh can surface its cancellation as a URLError instead
                guard !Task.isCancelled else { return }

                if self.dataSource == .apple, Self.isUnauthorizedInstallError(error) || error as? AuthenticationError == .invalidSession {
                    // The Apple data source needs a developer session; ask the user to sign in rather than
                    // showing a raw 401.
                    self.presentedAlert = .unauthenticatedDataSource
                } else if error as? AuthenticationError != .invalidSession {
                    // Prevent setting the app state error if it is an invalid session, we will present the sign in view instead
                    self.error = error
                    self.presentedAlert = .generic(title: localizeString("Alert.Update.Error.Title"), message: error.legibleLocalizedDescription)
                }
            }
        }
        updateTask = task
    }

    /// Selection can change in Terminal while a full catalog refresh is still running.
    func refreshSelectedXcodePath() {
        guard selectedXcodeRefreshTask == nil else { return }
        selectedXcodeRefreshTask = Task { @MainActor in
            defer { selectedXcodeRefreshTask = nil }
            await updateSelectedXcodePathAsync()
        }
    }

    func updateSelectedXcodePathAsync() async {
        do {
            let output = try await Current.shell.xcodeSelectPrintPath()
            if selectedXcodePath != output.out {
                selectedXcodePath = output.out
            }
        } catch {
            // Ignore xcode-select failures
        }
    }

    private func updateAvailableXcodes(from dataSource: DataSource) async throws -> [AvailableXcode] {
        if dataSource == .apple {
            try await signInIfNeededAsync()
            // This checks whether the Apple ID is a valid Apple Developer account.
            try await validateSessionAsync()
        }

        let service = XcodeListService(urlSession: Current.network.session)
        var store = availableXcodeListStore(service: service)
        return try await store.updateAvailableXcodes(from: dataSource)
    }
}

extension AppState {
    // MARK: - Available Xcode Cache

    func loadCachedAvailableXcodes() throws {
        var store = availableXcodeListStore()
        try store.loadCachedAvailableXcodes()
        availableXcodes = store.availableXcodes
    }

    func cacheAvailableXcodes(_ xcodes: [AvailableXcode]) throws {
        try availableXcodeListStore().saveAvailableXcodes(xcodes)
    }

    private func availableXcodeListStore(service: XcodeListService = XcodeListService()) -> XcodeListStore {
        XcodeListStore(
            cache: availableXcodeCache,
            service: service,
            now: { Current.date() }
        )
    }

    private var availableXcodeCache: AvailableXcodeCache {
        AvailableXcodeCache(
            cacheFile: .cacheFile,
            contentsAtPath: { path in Current.files.contents(atPath: path) },
            writeData: { data, url in try Current.files.write(data, to: url) },
            createDirectory: { url, createIntermediates, attributes in
                try Current.files.createDirectory(
                    at: url,
                    withIntermediateDirectories: createIntermediates,
                    attributes: attributes
                )
            }
        )
    }
    
    // MARK: Runtime Cache
    
    func loadCacheDownloadableRuntimes() throws {
        var store = runtimeListStore
        try store.loadCachedDownloadableRuntimes()
        downloadableRuntimes = store.downloadableRuntimes
    }
    
    func cacheDownloadableRuntimes(_ runtimes: [DownloadableRuntime]) throws {
        try runtimeListStore.saveDownloadableRuntimes(runtimes)
    }

    var runtimeListStore: RuntimeListStore {
        RuntimeListStore(
            cache: downloadableRuntimeCache,
            service: runtimeService
        )
    }

    private var downloadableRuntimeCache: DownloadableRuntimeCache {
        DownloadableRuntimeCache(
            cacheFile: .runtimeCacheFile,
            contentsAtPath: { path in Current.files.contents(atPath: path) },
            writeData: { data, url in try Current.files.write(data, to: url) },
            createDirectory: { url, createIntermediates, attributes in
                try Current.files.createDirectory(
                    at: url,
                    withIntermediateDirectories: createIntermediates,
                    attributes: attributes
                )
            }
        )
    }
}

```

### Core Architecture Module: `Xcodes/Backend/AppState.swift`
```
import AppKit
import AsyncNetworkService
import XcodesLoginKit
import XcodesLoginKitSecurityKey
import Path
import LegibleError
import KeychainAccess
import Path
import Version
import os.log
import DockProgress
import XcodesKit

enum PreferenceKey: String {
    case installPath
    case localPath
    case unxipExperiment
    case createSymLinkOnSelect
    case onSelectActionType
    case showOpenInRosettaOption
    case autoInstallation
    case SUEnableAutomaticChecks
    case includePrereleaseVersions
    case downloader
    case dataSource
    case xcodeListCategory
    case allowedMajorVersions
    case hideSupportXcodes
    case xcodeListArchitectures
    case enableGroupedXcodeList
    case showTags
    case expandedMajorXcodeVersions
    case expandedMinorXcodeVersions
    case usePrivilegeHelperForFileOperations

    func isManaged() -> Bool { UserDefaults.standard.objectIsForced(forKey: self.rawValue) }
}

@MainActor
class AppState: ObservableObject {
    private var client: XcodesLoginKit.Client { Current.network.loginClient }
    internal var runtimeService: RuntimeService

    // MARK: - Published Properties

    @Published var authenticationState: AuthenticationState = .unauthenticated
    @Published var availableXcodes: [AvailableXcode] = [] {
        willSet {
            if isChangingDataSource {
                // The sources identify releases differently, so everything would look new.
                isChangingDataSource = false
            } else if !Self.newlyAvailableXcodes(oldXcodes: availableXcodes, newXcodes: newValue).isEmpty {
                Current.notificationManager.scheduleNotification(title: localizeString("Notification.NewXcodeVersion.Title"), body: localizeString("Notification.NewXcodeVersion.Body"), category: .normal)
            }
            updateAllXcodes(
                availableXcodes: newValue,
                installedXcodes: installedXcodes,
                selectedXcodePath: selectedXcodePath
            )
        }
        didSet {
            autoInstallIfNeeded()
        }
    }

    /// Returns the `AvailableXcode`s in `newXcodes` whose `xcodeID` was not present in `oldXcodes`.
    ///
    /// Empty when `oldXcodes` is empty, so the initial load (empty -> populated) is NOT treated
    /// as "a new version since you last looked".
    static func newlyAvailableXcodes(oldXcodes: [AvailableXcode], newXcodes: [AvailableXcode]) -> [AvailableXcode] {
        guard !oldXcodes.isEmpty else { return [] }
        let oldIDs = Set(oldXcodes.map(\.xcodeID))
        return newXcodes.filter { !oldIDs.contains($0.xcodeID) }
    }

    @Published var allXcodes: [Xcode] = []
    @Published var selectedXcodePath: String? {
        willSet {
            updateAllXcodes(
                availableXcodes: availableXcodes,
                installedXcodes: installedXcodes,
                selectedXcodePath: newValue
            )
        }
    }
    private var installedXcodes: [InstalledXcode] = []
    @Published var updateTask: Task<Void, Never>?
    var updateTaskID: UUID?
    var isUpdating: Bool { updateTask != nil }
    /// Whether `updateTask` fetches available Xcodes, as opposed to only rescanning installed ones.
    var updateTaskIsFullRefresh = false
    /// The available Xcode list is always refreshed once per launch, regardless of cache age.
    var hasRefreshedAvailableXcodesThisLaunch = false
    /// Set while refreshing after a data source change, so the new list isn't announced as new versions
    var isChangingDataSource = false
    @Published var showHelperSettings = false
    @Published var presentedSheet: XcodesSheet? = nil
    @Published var isProcessingAuthRequest = false
    private var authenticationRequestID: UUID?
    private var authenticationTask: Task<Void, Never>?
    private var authenticationTaskID: UUID?
    @Published var xcodeBeingConfirmedForUninstallation: Xcode?
    @Published var presentedAlert: XcodesAlert?
    @Published var presentedPreferenceAlert: XcodesPreferencesAlert?
    @Published var helperInstallState: HelperInstallState = .notInstalled
    /// Delay between attempts to reach a newly installed helper
    var helperInstallRetryDelay: Duration = .milliseconds(500)
    /// Whether the user is being prepared for the helper installation alert with an explanation.
    /// This closure will be performed after the user chooses whether or not to proceed.
    @Published var isPreparingUserForActionRequiringHelper: ((Bool) -> Void)?
    var helperActionPreparationID: UUID?

    // MARK: - Errors

    @Published var error: Error?
    @Published var authError: Error?

    // MARK: Advanced Preferences
    @Published var localPath = "" {
        didSet {
            Current.defaults.set(localPath, forKey: "localPath")
        }
    }

    var disableLocalPathChange: Bool { PreferenceKey.localPath.isManaged() }

    @Published var installPath = "" {
        didSet {
            Current.defaults.set(installPath, forKey: "installPath")
        }
    }

    var disableInstallPathChange: Bool { PreferenceKey.installPath.isManaged() }

    @Published var unxipExperiment = false {
        didSet {
            Current.defaults.set(unxipExperiment, forKey: "unxipExperiment")
        }
    }

    var disableUnxipExperiment: Bool { PreferenceKey.unxipExperiment.isManaged() }

    @Published var createSymLinkOnSelect = false {
        didSet {
            Current.defaults.set(createSymLinkOnSelect, forKey: "createSymLinkOnSelect")
        }
    }

    var createSymLinkOnSelectDisabled: Bool {
        return onSelectActionType == .rename || PreferenceKey.createSymLinkOnSelect.isManaged()
    }

    @Published var onSelectActionType = SelectedActionType.none {
        didSet {
            Current.defaults.set(onSelectActionType.rawValue, forKey: "onSelectActionType")

            if onSelectActionType == .rename {
                createSymLinkOnSelect = false
            }
        }
    }

    var onSelectActionTypeDisabled: Bool { PreferenceKey.onSelectActionType.isManaged() }

    @Published var usePrivilegedHelperForFileOperations = false {
        didSet {
            Current.defaults.set(usePrivilegedHelperForFileOperations, forKey: PreferenceKey.usePrivilegeHelperForFileOperations.rawValue)
        }
    }

    @Published var showOpenInRosettaOption = false {
        didSet {
            Current.defaults.set(showOpenInRosettaOption, forKey: "showOpenInRosettaOption")
        }
    }

    @Published var terminateAfterLastWindowClosed = false {
        didSet {
            Current.defaults.set(terminateAfterLastWindowClosed, forKey: "terminateAfterLastWindowClosed")
        }
    }

    @Published var enableGroupedXcodeList = true {
        didSet {
            Current.defaults.set(enableGroupedXcodeList, forKey: PreferenceKey.enableGroupedXcodeList.rawValue)
        }
    }

    @Published var showTags = true {
        didSet {
            Current.defaults.set(showTags, forKey: PreferenceKey.showTags.rawValue)
        }
    }

    // MARK: - Runtimes

    @Published var downloadableRuntimes: [DownloadableRuntime] = []
    @Published var installedRuntimes: [CoreSimulatorImage] = []

    // MARK: - Operation State

    var downloadableRuntimesTask: Task<Void, Never>?
    var downloadableRuntimesTaskID: UUID?
    var installedRuntimesTask: Task<Void, Never>?
    var installedRuntimesTaskID: UUID?
    internal var installationTasks: [XcodeID: Task<Void, Never>] = [:]
    internal var installationTaskIDs: [XcodeID: UUID] = [:]
    internal var runtimeTasks: [String: Task<Void, Never>] = [:]
    internal var runtimeTaskIDs: [String: UUID] = [:]
    internal var deleteRuntimeTask: Task<Void, Never>?
    internal var deleteRuntimeTaskID: UUID?
    internal var helperInstallTask: Task<Void, Never>?
    internal var helperInstallTaskID: UUID?
    internal var postInstallTask: Task<Void, Never>?
    internal var postInstallTaskID: UUID?
    internal var selectedXcodeRefreshTask: Task<Void, Never>?
    private var helperStatusTask: Task<Void, Never>?
    internal var selectTask: Task<Void, Never>?
    internal var selectTaskID: UUID?
    internal var uninstallTask: Task<Void, Never>?
    internal var uninstallTaskID: UUID?
    private var autoInstallTimer: Timer?

    // MARK: - Dock Progress Tracking

    public static let totalProgressUnits = Int64(10)
    public static let unxipProgressWeight = Int64(1)
    var overallProgress = Progress()
    var unxipProgress = AppState.makeUnxipProgress()
    var overallProgressChildIDs = Set<ObjectIdentifier>()

    static func makeUnxipProgress() -> Progress {
        let progress = Progress(totalUnitCount: totalProgressUnits)
        progress.kind = .file
        progress.fileOperationKind = .copying
        return progress
    }

    // MARK: -

    var dataSource: DataSource {
        Current.defaults.string(forKey: "dataSource").flatMap(DataSource.init(rawValue:)) ?? .default
    }

    var savedUsername: String? {
        Current.defaults.string(forKey: "username")
    }

    var hasSavedUsername: Bool {
        savedUsername != nil
    }

    var bottomStatusBarMessage: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM/yyyy"
        let finishDate = formatter.date(from: "11/06/2022")

        if Date().compare(finishDate!) == .orderedAscending {
            return String(format: localizeString("WWDC.Message"), "2022")
        }
        return ""
    }

    // MARK: - Init

    init(runtimeService: RuntimeService = RuntimeService()) {
        self.runtimeService = runtimeService
        guard !isTesting else { return }
        try? loadCachedAvailableXcodes()
        try? loadCacheDownloadableRuntimes()
        Task { @MainActor in
            await updateInstalledXcodesAsync()
        }
        helperStatusTask = Task { @MainActor in
            await checkIfHelperIsInstalled()
            helperStatusTask = nil
        }
        setupAutoInstallTimer()
        setupDefaults()
       
```

### Core Architecture Module: `Xcodes/Backend/HelperInstallState.swift`
```
import Foundation

public enum HelperInstallState: Equatable, Sendable {
    case unknown
    case notInstalled
    case installed
}

```

### Core Architecture Module: `Xcodes/Frontend/InfoPane/InstalledStateButtons.swift`
```
//
//  InstallingStateButtons.swift
//  Xcodes
//
//  Created by Duong Thai on 13/10/2023.
//  Copyright © 2023 Robots and Pencils. All rights reserved.
//

import SwiftUI
import Version
import XcodesKit
import Path

struct InstalledStateButtons: View {
    let xcode: Xcode

    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(xcode.installedPath?.string ?? "")
                Button(action: { appState.reveal(xcode.installedPath) }) {
                    Image(systemName: "arrow.right.circle.fill")
                }
                .buttonStyle(PlainButtonStyle())
                .help("RevealInFinder")
            }

            HStack {
                SelectButton(xcode: xcode)
                    .disabled(xcode.selected)
                    .help("Selected")

                OpenButton(xcode: xcode)
                    .help("Open")

                Spacer()
                UninstallButton(xcode: xcode)
            }
        }
    }
}

#Preview { @MainActor in
  InstalledStateButtons(xcode: xcode)
    .environmentObject(configure(AppState()) {
      $0.allXcodes = [xcode]
    })
    .padding()
    .frame(width: 300)
}

private let xcode = Xcode(
  version: Version(major: 12, minor: 3, patch: 0),
  installState: .installed(Path("/Applications/Xcode-12.3.0.app")!),
  selected: true,
  icon: NSWorkspace.shared.icon(forFile: "/Applications/Xcode-12.3.0.app"),
  requiredMacOSVersion: "10.15.4",
  releaseNotesURL: URL(string: "https://developer.apple.com/documentation/xcode-release-notes/xcode-12_3-release-notes/")!,
  releaseDate: Date(),
  sdks: SDKs(
    macOS: .init(number: "11.1"),
    iOS: .init(number: "14.3"),
    watchOS: .init(number: "7.3"),
    tvOS: .init(number: "14.3")
  ),
  compilers: Compilers(
    gcc: .init(number: "4"),
    llvm_gcc: .init(number: "213"),
    llvm: .init(number: "2.3"),
    clang: .init(number: "7.3"),
    swift: .init(number: "5.3.2")
  ),
  downloadFileSize: 242342424
)

```

### Core Architecture Module: `Xcodes/Frontend/InfoPane/NotInstalledStateButtons.swift`
```
//
//  NotInstalledStateButtonsView.swift
//  Xcodes
//
//  Created by Duong Thai on 13/10/2023.
//  Copyright © 2023 Robots and Pencils. All rights reserved.
//

import SwiftUI
import Version
import XcodesKit

struct NotInstalledStateButtons: View {
    let downloadFileSizeString: String?
    let id: XcodeID

    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading) {
            Button {
                appState.checkMinVersionAndInstall(id: id)
            } label: {
                if id.architectures?.isAppleSilicon ?? false {
                    Text("Install Apple Silicon").help("Install")
                } else {
                    Text("Install Universal").help("Install")
                }
            }
            
            if let size = downloadFileSizeString {
                Text("DownloadSize")
                    .font(.headline)
                Text(size)
                    .font(.subheadline)
            } else {
                EmptyView()
            }
        }
    }
}

#Preview { @MainActor in
  NotInstalledStateButtons(
    downloadFileSizeString: "1,19 GB",
    id: XcodeID(version: Version(major: 12, minor: 3, patch: 0), architectures: nil)
  )
  .padding()
}

```

### Core Architecture Module: `HelperXPCShared/FileOperations.swift`
```
import Foundation
import os.log

enum FileOperations {
    private static let subsystem = Bundle.main.bundleIdentifier!
    static let fileOperations = Logger(subsystem: subsystem, category: "fileOperations")

    static func moveApp(at source: String, to destination: String, completion: @escaping ((any Error)?) -> Void) {
        do {
            guard URL(fileURLWithPath: source).hasDirectoryPath else { throw XPCDelegateError(.invalidSourcePath)}

            guard URL(fileURLWithPath: destination).deletingLastPathComponent().hasDirectoryPath else { throw
                XPCDelegateError(.invalidDestinationPath)}

            try FileManager.default.moveItem(at: URL(fileURLWithPath: source), to: URL(fileURLWithPath: destination))
            completion(nil)
        } catch {
            completion(error)
        }
    }

    // does an Xcode.app file exist?
    static func createSymbolicLink(source: String, destination: String, completion: @escaping ((any Error)?) -> Void) {
        do {
            if FileManager.default.fileExists(atPath: destination) {
                let attributes: [FileAttributeKey : Any]? = try? FileManager.default.attributesOfItem(atPath: destination)

                if attributes?[.type] as? FileAttributeType == FileAttributeType.typeSymbolicLink {
                    try FileManager.default.removeItem(atPath: destination)
                    Self.fileOperations.info("Successfully deleted old symlink")
                } else {
                    throw XPCDelegateError(.destinationIsNotASymbolicLink)
                }
            }

            try FileManager.default.createSymbolicLink(atPath: destination, withDestinationPath: source)
            Self.fileOperations.info("Successfully created symbolic link with \(destination)")
            completion(nil)
        } catch {
            completion(error)
        }
    }

    static func rename(source: String, destination: String, completion: @escaping ((any Error)?) -> Void) {
        do {
            try FileManager.default.moveItem(at: URL(fileURLWithPath: source), to: URL(fileURLWithPath: destination))
            completion(nil)
        } catch {
            completion(error)
        }
    }

    static func remove(path: String, completion: @escaping ((any Error)?) -> Void) {
        do {
            try FileManager.default.removeItem(atPath: path)
            completion(nil)
        } catch {
            completion(error)
        }
    }
}

```

### Core Architecture Module: `HelperXPCShared/HelperXPCShared.swift`
```
import Foundation

let machServiceName = "com.xcodesorg.xcodesapp.Helper"
let clientBundleID = "com.xcodesorg.xcodesapp"
let subjectOrganizationalUnit = Bundle.main.infoDictionary!["CODE_SIGNING_SUBJECT_ORGANIZATIONAL_UNIT"] as! String

@objc(HelperXPCProtocol)
protocol HelperXPCProtocol: Sendable {
    func getVersion(completion: @escaping (String) -> Void)
    func xcodeSelect(absolutePath: String, completion: @escaping (Error?) -> Void)
    func devToolsSecurityEnable(completion: @escaping (Error?) -> Void)
    func addStaffToDevelopersGroup(completion: @escaping (Error?) -> Void)
    func acceptXcodeLicense(absoluteXcodePath: String, completion: @escaping (Error?) -> Void)
    func runFirstLaunch(absoluteXcodePath: String, completion: @escaping (Error?) -> Void)
    func moveApp(at source: String, to destination: String, completion: @escaping (Error?) -> Void)
    func createSymbolicLink(source: String, destination: String, completion: @escaping (Error?) -> Void)
    func rename(source: String, destination: String, completion: @escaping (Error?) -> Void)
    func remove(path: String, completion: @escaping (Error?) -> Void)
}

struct XPCDelegateError: CustomNSError {
    enum Code: Int {
        case invalidXcodePath
        case invalidSourcePath
        case invalidDestinationPath
        case destinationIsNotASymbolicLink
    }

    let code: Code

    init(_ code: Code) {
        self.code = code
    }

    // MARK: - CustomNSError

    static var errorDomain: String { "XPCDelegateError" }

    var errorCode: Int { code.rawValue }

    var errorUserInfo: [String : Any] {
        switch code {
        case .invalidXcodePath:
            return [
                NSLocalizedDescriptionKey: "Invalid Xcode path.",
                NSLocalizedFailureReasonErrorKey: "Xcode path must be absolute."
            ]
        case .invalidSourcePath:
            return [
                NSLocalizedDescriptionKey: "Invalid source path.",
                NSLocalizedFailureReasonErrorKey: "Source path must be absolute and must be a directory."
            ]
        case .invalidDestinationPath:
            return [
                NSLocalizedDescriptionKey: "Invalid destination path.",
                NSLocalizedFailureReasonErrorKey: "Destination path must be absolute and must be a directory."
            ]
        case .destinationIsNotASymbolicLink:
            return [
                NSLocalizedDescriptionKey: "Invalid destination path.",
                NSLocalizedFailureReasonErrorKey: "Destination path must be a symbolic link."
            ]
        }
    }
}

```

### Core Architecture Module: `Xcodes/AcknowledgementsGenerator/Package.swift`
```
// swift-tools-version:5.4

import PackageDescription

let package = Package(
    name: "AcknowledgementsGenerator",
    platforms: [.macOS(.v11)],
    products: [
        .executable(
            name: "AcknowledgementsGenerator",
            targets: ["AcknowledgementsGenerator"]
        ),
    ],
    dependencies: [
    ],
    targets: [
        .executableTarget(
            name: "AcknowledgementsGenerator",
            dependencies: []
        ),
    ]
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #876** (2026-10-02): **Unable to install Xcode**
  *Symptoms*: Unable to install xcode. Installing  any version of Xcode through Xcodes gives error unable to install   **Screenshots**  <img width="343" height="234" alt="Image" src="https://github.com/user-attachments/assets/544dfa30-32c6-4f50-8d77-f6f5eb3321ff" />  **Version**  - OS:  27.0.1  - Xcodes: 4.1.1 (41) 

- **Issue #852** (2026-09-14): **Homebrew Install Fails**
  *Symptoms*: **Describe the bug** Installing the application via homebrew results in an error. It appears to be a 404 when homebrew is looking for the package update. The url it is looking for is `https://github.com/XcodesOrg/XcodesApp/releases/download/v4.1.0b40/Xcodes.zip`.  Error log:  ``` ==> Upgrading 1 outdated package: xcodes-app 4.0.5b40 -> 4.1.0b40 ==> Fetching downloads for: xcodes-app ✘ Cask xcodes-app (4.1.0b40) Error: Download failed on Cask 'xcodes-app' with message: Download failed: https://github.com/XcodesOrg/XcodesApp/releases/download/v4.1.0b40/Xcodes.zip curl: (56) The requested URL returned error: 404 Error: xcodes-app: Download failed for xcodes-app ```  **To Reproduce** Install / upgrade to the latest version via homebrew.  **Expected behavior** The app is installed/updated successfully.  **Screenshots** N/A  **Version**  - OS: MacOS 27.0  - Xcodes: Not latest 

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

### Incident Patch 1: `27bf2654` (2026-11-02)
**Commit Message**: Fix installed and active state not refreshing after install, select, and uninstall

Problem

The Xcode list is rebuilt from a cached list of installed Xcodes whenever the active Xcode or the available list changes.

Three actions didn't keep that cache up to date:

* "Install" updated its own row but not the cache, so making the new Xcode active afterwards showed it as not installed, and nothing showed as active.
* "Make Active" didn't rescan either, so after the "rename to Xcode.app" option moved bundles, the list still pointed at the old paths.
* "Uninstall" rescanned only after the list was rebuilt, so the removed Xcode briefly showed as installed again.

Fixes #836.

Solution

All three now rescan the install directory first, so the list matches what's on disk.

Two new tests in `AppStateTests`: one makes a newly installed Xcode active and checks it shows as installed and active; the other checks that uninstall never shows the removed Xcode as installed again. Both fail without this change. `xcodebuild test -scheme Xcodes` (the CI command) passes on Xcode 27.2: 53 tests, 0 failures.

**File**: `Xcodes/Backend/AppState+Install.swift` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@ extension AppState {
                 let (xcode, url) = try await getXcodeArchiveAsync(installationType, downloader: downloader)
                 try Task.checkCancellation()
                 let installedXcode = try await installArchivedXcodeAsync(xcode, at: url)
+                // Refreshed before the row is patched: `updateAllXcodes` rebuilds every row from this cache
+                // on the next selection or update, carrying over only rows that are still `.installing`.
+                await updateInstalledXcodesAsync(recomposeAllXcodes: false)
 
                 guard let index = allXcodes.firstIndex(where: { $0.version.isEquivalent(to: installedXcode.version) }) else {
                     return installedXcode
```

**File**: `Xcodes/Backend/AppState.swift` (modified, +2/-1)
```diff
@@ -727,8 +727,8 @@ class AppState: ObservableObject {
                 try Task.checkCancellation()
                 try await uninstallXcodeAsync(path: installedXcodePath)
                 try Task.checkCancellation()
-                await updateSelectedXcodePathAsync()
                 await updateInstalledXcodesAsync()
+                await updateSelectedXcodePathAsync()
             } catch is CancellationError {
             } catch {
                 if let index = allXcodes.firstIndex(where: { $0.id == xcode.id }) {
@@ -798,6 +798,7 @@ class AppState: ObservableObject {
 
                 try await Current.helper.switchXcodePathAsync(installedXcodePath.string)
                 try Task.checkCancellation()
+                await updateInstalledXcodesAsync()
                 await updateSelectedXcodePathAsync()
                 if createSymLinkOnSelect && onSelectActionType != .rename {
                     await createSymbolicLink(to: installedXcodePath)
```

**File**: `XcodesTests/AppStateTests.swift` (modified, +54/-0)
```diff
@@ -365,6 +365,29 @@ class AppStateTests: XCTestCase {
         XCTAssertEqual(subject.selectedXcodePath, secondPath.string)
     }
 
+    func test_Select_MarksXcodeInstalledSinceLastScanAsSelected() async throws {
+        subject.helperInstallState = .installed
+        let installedPath = try XCTUnwrap(Path("/Applications/Xcode-27.2.0.app"))
+        let version = try XCTUnwrap(Version("27.2.0"))
+        let installedXcode = InstalledXcode(path: installedPath, version: version)
+        let developerPath = (installedPath/"Contents/Developer").string
+        subject.availableXcodes = [
+            AvailableXcode(version: version, url: URL(string: "https://apple.com/xcode.xip")!, filename: "mock.xip", releaseDate: nil)
+        ]
+        subject.allXcodes[0].installState = .installed(installedPath)
+        Current.files.installedXcodes = { _ in [installedXcode] }
+        Current.shell.xcodeSelectPrintPath = {
+            ProcessOutput(status: 0, out: developerPath, err: "")
+        }
+
+        subject.select(xcode: subject.allXcodes[0], shouldPrepareUserForHelperInstallation: false)
+        let selectTask = try XCTUnwrap(subject.selectTask)
+        await selectTask.value
+
+        XCTAssertEqual(subject.allXcodes[0].installState, .installed(installedPath))
+        XCTAssertTrue(subject.allXcodes[0].selected)
+    }
+
     func test_Uninstall_MissingXcodePresentsFileNotFoundError() async throws {
         let missingPath = try XCTUnwrap(Path("/Applications/Xcode-Missing.app"))
         let xcode = Xcode(version: Version("15.0.0")!, installState: .installed(missingPath), selected: false, icon: nil)
@@ -411,6 +434,37 @@ class AppStateTests: XCTestCase {
         XCTAssertEqual(subject.allXcodes[0].installState, .notInstalled)
     }
 
+    func test_Uninstall_DoesNotShowRemovedXcodeAsInstalledAgain() async throws {
+        let installedPath = try XCTUnwrap(Path("/Applications/Xcode-0.0.0.app"))
+        let version = try XCTUnwrap(Version("0.0.0"))
+        let installedXcode = InstalledXcode(path: installedPath, version: version)
+        subject.availableXcodes = [
+            AvailableXcode(version: version, url: URL(string: "https://apple.com/xcode.xip")!, filename: "mock.xip", releaseDate: nil)
+        ]
+        Current.files.installedXcodes = { _ in [installedXcode] }
+        await subject.updateInstalledXcodesAsync()
+        Current.files.installedXcodes = { _ in [] }
+        Current.shell.xcodeSelectPrintPath = {
+            ProcessOutput(status: 0, out: "", err: "")
+        }
+
+        let allXcodeInstallStates = try await recordAllXcodeInstallStates {
+            subject.uninstall(xcode: subject.allXcodes[0])
+            let uninstallTask = try XCTUnwrap(subject.uninstallTask)
+            await uninstallTask.value
+        }
+
+        XCTAssertEqual(
+            allXcodeInstallStates,
+            [
+                [XcodeInstallState.installed(installedPath)],
+                [.uninstalling(installedPath)],
+                [.notInstalled],
+                [.notInstalled]
+            ]
+        )
+    }
+
     func test_Signout_RemovesCookiesFromDownloadSession() throws {
         let session = URLSession(configuration: .ephemeral)
         Current.network.session = session
```

---

### Incident Patch 2: `2dd2a1a5` (2026-10-01)
**Commit Message**: Improve refresh, sign-in guidance and recovery from helper failures

**File**: `README.md` (modified, +7/-0)
```diff
@@ -97,6 +97,13 @@ Xcodes.app and CLI is updated, maintained with contributors like yourself. Even
 
 You'll need macOS 15.6 Ventura and Xcode 26 in order to build and run Xcodes.app.
 
+### Known build warnings
+
+The following dependency and helper limitations remain:
+
+- `ld: building for macOS-14.6, but linking with dylib '@rpath/libcbor.0.11.0.dylib' which was built for newer version 15.0`: the prebuilt `libcbor` in LibFido2Swift targets macOS 15 while the app targets 14.6. Resolving it means raising the app's deployment target or rebuilding that dependency for 14.6.
+- `SMJobBless` is deprecated in favor of `SMAppService`. The one legacy call is isolated in a marked shim in `HelperClient.swift` until the privileged helper moves to `SMAppService`, which uses a different install and approval model.
+
 `Unxip` and `aria2` must be compiled as a universal binary
 ```
 # compile for Intel
```

**File**: `Xcodes.xcodeproj/project.pbxproj` (modified, +1/-0)
```diff
@@ -850,6 +850,7 @@
 		};
 		D971F84C2E79102E005F84C9 /* Fix libfido2 structure */ = {
 			isa = PBXShellScriptBuildPhase;
+			alwaysOutOfDate = 1;
 			buildActionMask = 2147483647;
 			files = (
 			);
```

**File**: `Xcodes/Backend/AppState+Install.swift` (modified, +23/-12)
```diff
@@ -250,8 +250,7 @@ extension AppState {
         do {
             try await performPostInstallStepsAsync(for: installedXcode)
         } catch {
-            self.error = error
-            self.presentedAlert = .generic(title: localizeString("Alert.InstallArchive.Error.Title"), message: error.legibleLocalizedDescription)
+            presentPostInstallRecovery(for: installedXcode)
         }
         resetDockProgressTracking()
 
@@ -264,8 +263,14 @@ extension AppState {
             fileExists: { path in Current.files.fileExists(atPath: path) },
             moveItem: { source, destination in
                 if Current.helper.usePrivilegedHelperForFileOperations {
-                    try await self.installHelperIfNecessaryAsync()
-                    try await Current.helper.moveAppAsync(source.path, destination.path)
+                    do {
+                        try await self.installHelperIfNecessaryAsync()
+                        try await Current.helper.moveAppAsync(source.path, destination.path)
+                    } catch is CancellationError {
+                        throw CancellationError()
+                    } catch {
+                        throw HelperFileOperationError(underlyingError: error, command: HelperRecovery.moveCommand(source: source.path, destination: destination.path))
+                    }
                 } else {
                     try Current.files.moveItem(at: source, to: destination)
                 }
@@ -362,8 +367,7 @@ extension AppState {
             } catch is CancellationError {
             } catch {
                 guard postInstallTaskID == taskID else { return }
-                self.error = error
-                self.presentedAlert = .generic(title: localizeString("Alert.PostInstall.Title"), message: error.legibleLocalizedDescription)
+                presentPostInstallRecovery(for: xcode)
             }
         }
     }
@@ -381,7 +385,9 @@ extension AppState {
             try await xcodePostInstallWorkflowService.performPostInstallSteps(for: xcode)
         } catch {
             Logger.appState.error("Performing post-install steps failed: \(error.legibleLocalizedDescription)")
-            throw InstallationError.postInstallStepsNotPerformed(version: xcode.version, helperInstallState: helperInstallState)
+            // Keep the underlying reason (unless the user simply declined), so the alert can say why it failed.
+            let reason: String? = if case InstallationError.postInstallStepsNotPerformed = error { nil } else { error.legibleLocalizedDescription }
+            throw InstallationError.postInstallStepsNotPerformed(version: xcode.version, helperInstallState: helperInstallState, reason: reason)
         }
     }
 
@@ -419,7 +425,8 @@ extension AppState {
                         helperConsent.resume(
                             throwing: InstallationError.postInstallStepsNotPerformed(
                                 version: version,
-                                helperInstallState: self.helperInstallState
+                                helperInstallState: self.helperInstallState,
+                                reason: nil
                             )
                         )
                     }
@@ -519,7 +526,8 @@ public enum InstallationError: LocalizedError, Equatable {
     case versionAlreadyInstalled(InstalledXcode)
     case invalidVersion(String)
     case versionNotInstalled(Version)
-    case postInstallStepsNotPerformed(version: Version, helperInstallState: HelperInstallState)
+    /// `reason` describes the underlying failure, if there was one besides the user declining to install the helper
+    case postInstallStepsNotPerformed(version: Version, helperInstallState: HelperInstallState, reason: String?)
 
     public var errorDescription: String? {
         switch self {
@@ -553,13 +561,16 @@ public enum InstallationError: LocalizedError, Equatable {
             return String(format: localizeString("InstallationError.InvalidVersion"), version)
         case let .versionNotInstalled(version):
             return String(format: localizeString("InstallationError.VersionNotInstalled"), version.appleDescription)
-        case let .postInstallStepsNotPerformed(version, helperInstallState):
+        case let .postInstallStepsNotPerformed(version, helperInstallState, reason):
+            let message: String
             switch helperInstallState {
             case .installed:
-                return String(format: localizeString("InstallationError.PostInstallStepsNotPerformed.Installed"), version.appleDescription)
+                message = String(format: localizeString("InstallationError.PostInstallStepsNotPerformed.Installed"), version.appleDescription)
             case .notInstalled, .unknown:
-                return String(format: localizeString("InstallationError.PostInstallStepsNotPerformed.NotInstalled"), version.appleDescription)
+                message = String(format: localizeString("Installatio
```

**File**: `Xcodes/Backend/AppState+Update.swift` (modified, +39/-6)
```diff
@@ -13,11 +13,14 @@ extension AppState {
     }
     
     func updateIfNeeded() {
+        // Never cancel a full refresh just because the window became active again.
+        if isUpdating, updateTaskIsFullRefresh { return }
         guard
-            isReadyForUpdate
+            isReadyForUpdate || !hasRefreshedAvailableXcodesThisLaunch
         else {
             updateTask?.cancel()
             let taskID = UUID()
+            updateTaskIsFullRefresh = false
             updateTaskID = taskID
             let task = Task { @MainActor in
                 defer {
@@ -35,8 +38,19 @@ extension AppState {
         update() as Void
     }
 
-    func update() {
-        guard !isUpdating else { return }
+    /// Refreshes installed and available Xcodes and runtimes.
+    /// - Parameter restartingInFlightUpdate: Cancel a running refresh and start over, e.g. when the
+    ///   data source or sign-in state changed and the running refresh would return stale results.
+    func update(restartingInFlightUpdate: Bool = false) {
+        if isUpdating {
+            // A quick installed-only rescan is always superseded; a full refresh only when asked.
+            guard restartingInFlightUpdate || !updateTaskIsFullRefresh else { return }
+            updateTask?.cancel()
+            updateTask = nil
+            updateTaskID = nil
+        }
+        hasRefreshedAvailableXcodesThisLaunch = true
+        updateTaskIsFullRefresh = true
         updateDownloadableRuntimes()
         updateInstalledRuntimes()
 
@@ -52,14 +66,22 @@ extension AppState {
             do {
                 await self.updateInstalledXcodesAsync()
                 await self.updateSelectedXcodePathAsync()
+                try Task.checkCancellation()
                 let xcodes = try await self.updateAvailableXcodes(from: self.dataSource)
                 try Task.checkCancellation()
                 self.availableXcodes = xcodes
                 Current.defaults.setDate(Current.date(), forKey: "lastUpdated")
             } catch is CancellationError {
             } catch {
-                // Prevent setting the app state error if it is an invalid session, we will present the sign in view instead
-                if error as? AuthenticationError != .invalidSession {
+                // A restarted refresh can surface its cancellation as a URLError instead
+                guard !Task.isCancelled else { return }
+
+                if self.dataSource == .apple, Self.isUnauthorizedInstallError(error) || error as? AuthenticationError == .invalidSession {
+                    // The Apple data source needs a developer session; ask the user to sign in rather than
+                    // showing a raw 401.
+                    self.presentedAlert = .unauthenticatedDataSource
+                } else if error as? AuthenticationError != .invalidSession {
+                    // Prevent setting the app state error if it is an invalid session, we will present the sign in view instead
                     self.error = error
                     self.presentedAlert = .generic(title: localizeString("Alert.Update.Error.Title"), message: error.legibleLocalizedDescription)
                 }
@@ -68,10 +90,21 @@ extension AppState {
         updateTask = task
     }
 
+    /// Selection can change in Terminal while a full catalog refresh is still running.
+    func refreshSelectedXcodePath() {
+        guard selectedXcodeRefreshTask == nil else { return }
+        selectedXcodeRefreshTask = Task { @MainActor in
+            defer { selectedXcodeRefreshTask = nil }
+            await updateSelectedXcodePathAsync()
+        }
+    }
+
     func updateSelectedXcodePathAsync() async {
         do {
             let output = try await Current.shell.xcodeSelectPrintPath()
-            selectedXcodePath = output.out
+            if selectedXcodePath != output.out {
+                selectedXcodePath = output.out
+            }
         } catch {
             // Ignore xcode-select failures
         }
```

**File**: `Xcodes/Backend/AppState.swift` (modified, +100/-13)
```diff
@@ -46,7 +46,10 @@ class AppState: ObservableObject {
     @Published var authenticationState: AuthenticationState = .unauthenticated
     @Published var availableXcodes: [AvailableXcode] = [] {
         willSet {
-            if !Self.newlyAvailableXcodes(oldXcodes: availableXcodes, newXcodes: newValue).isEmpty {
+            if isChangingDataSource {
+                // The sources identify releases differently, so everything would look new.
+                isChangingDataSource = false
+            } else if !Self.newlyAvailableXcodes(oldXcodes: availableXcodes, newXcodes: newValue).isEmpty {
                 Current.notificationManager.scheduleNotification(title: localizeString("Notification.NewXcodeVersion.Title"), body: localizeString("Notification.NewXcodeVersion.Body"), category: .normal)
             }
             updateAllXcodes(
@@ -84,6 +87,13 @@ class AppState: ObservableObject {
     @Published var updateTask: Task<Void, Never>?
     var updateTaskID: UUID?
     var isUpdating: Bool { updateTask != nil }
+    /// Whether `updateTask` fetches available Xcodes, as opposed to only rescanning installed ones.
+    var updateTaskIsFullRefresh = false
+    /// The available Xcode list is always refreshed once per launch, regardless of cache age.
+    var hasRefreshedAvailableXcodesThisLaunch = false
+    /// Set while refreshing after a data source change, so the new list isn't announced as new versions
+    var isChangingDataSource = false
+    @Published var showHelperSettings = false
     @Published var presentedSheet: XcodesSheet? = nil
     @Published var isProcessingAuthRequest = false
     private var authenticationRequestID: UUID?
@@ -93,6 +103,8 @@ class AppState: ObservableObject {
     @Published var presentedAlert: XcodesAlert?
     @Published var presentedPreferenceAlert: XcodesPreferencesAlert?
     @Published var helperInstallState: HelperInstallState = .notInstalled
+    /// Delay between attempts to reach a newly installed helper
+    var helperInstallRetryDelay: Duration = .milliseconds(500)
     /// Whether the user is being prepared for the helper installation alert with an explanation.
     /// This closure will be performed after the user chooses whether or not to proceed.
     @Published var isPreparingUserForActionRequiringHelper: ((Bool) -> Void)?
@@ -201,6 +213,7 @@ class AppState: ObservableObject {
     internal var helperInstallTaskID: UUID?
     internal var postInstallTask: Task<Void, Never>?
     internal var postInstallTaskID: UUID?
+    internal var selectedXcodeRefreshTask: Task<Void, Never>?
     private var helperStatusTask: Task<Void, Never>?
     internal var selectTask: Task<Void, Never>?
     internal var selectTaskID: UUID?
@@ -492,21 +505,48 @@ class AppState: ObservableObject {
                     authenticationTaskID = nil
                 }
             }
+            let wasAuthenticated = isAuthenticated
             do {
                 try await operation()
+                if !wasAuthenticated, isAuthenticated {
+                    refreshAfterSignIn()
+                }
             } catch is CancellationError {
             } catch {
                 // performAuthenticationRequest owns auth error presentation.
             }
         }
     }
 
+    private var isAuthenticated: Bool {
+        if case .authenticated = authenticationState { return true }
+        return false
+    }
+
+    /// Signing in unlocks the Apple data source, so restart any refresh that ran without a session.
+    private func refreshAfterSignIn() {
+        guard !isTesting else { return }
+        update(restartingInFlightUpdate: dataSource == .apple)
+    }
+
     func signOut() {
         clearLoginCredentials()
         Current.network.signout()
         authenticationState = .unauthenticated
     }
 
+    func presentHelperRecovery(title: String, error: Error, command: String, message: String? = nil) {
+        self.error = nil
+        presentedAlert = nil
+        presentedSheet = .helperRecovery(HelperRecovery(title: title, message: message ?? error.legibleLocalizedDescription, command: command))
+    }
+
+    func presentPostInstallRecovery(for xcode: InstalledXcode) {
+        error = nil
+        presentedSheet = nil
+        presentedAlert = .postInstallFailed(xcode: xcode)
+    }
+
     // MARK: - Helper
 
     /// Install the privileged helper if it isn't already installed.
@@ -558,15 +598,37 @@ class AppState: ObservableObject {
             try Task.checkCancellation()
             try await Current.helper.install()
             try Task.checkCancellation()
-            await checkIfHelperIsInstalled()
+            // launchd starts a newly blessed helper asynchronously, so give it a moment to answer.
+            let connectionError = await checkIfHelperIsInstalled(attempts: 5)
+            try Task.checkCancellation()
+            guard helperInstallState == .installed else {
+                throw HelperClientError.unreachableAfterInstall(underlyin
```

**File**: `Xcodes/Backend/HelperClient.swift` (modified, +50/-2)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import LegibleError
 import os.log
 import ServiceManagement
 import XcodesKit
@@ -234,8 +235,21 @@ final class HelperClient {
         do {
             let authRef = try authorizationRef(&authRights, nil, [.interactionAllowed, .extendRights, .preAuthorize])
             var cfError: Unmanaged<CFError>?
-            SMJobBless(kSMDomainSystemLaunchd, machServiceName as CFString, authRef, &cfError)
-            if let error = cfError?.takeRetainedValue() { throw error }
+            (SMJobBlessInstaller() as PrivilegedHelperBlessing).bless(label: machServiceName, authorization: authRef, error: &cfError)
+            if let error = cfError?.takeRetainedValue() {
+                // kSMErrorDomainLaunchd is deprecated, but SMJobBless still reports its errors in that domain
+                if CFErrorGetDomain(error) as String == "CFErrorDomainLaunchd" {
+                    switch CFErrorGetCode(error) {
+                    case kSMErrorInvalidSignature:
+                        throw HelperClientError.invalidSignature(underlyingError: error)
+                    case kSMErrorAuthorizationFailure:
+                        throw HelperClientError.authorizationFailed(underlyingError: error)
+                    default:
+                        break
+                    }
+                }
+                throw error
+            }
 
             self.connection?.invalidate()
             self.connection = nil
@@ -268,16 +282,50 @@ final class HelperClient {
     }
 }
 
+/// Installs the privileged helper with SMJobBless, which macOS 13 deprecated in favor of SMAppService.
+/// SMAppService uses a different install and approval model (a bundled launch daemon plist, approved in
+/// System Settings), so the move is a separate change. Until then the one legacy call lives here, and is
+/// reached through a protocol so the known deprecation doesn't warn on every build.
+private protocol PrivilegedHelperBlessing {
+    @discardableResult
+    func bless(label: String, authorization: AuthorizationRef?, error: inout Unmanaged<CFError>?) -> Bool
+}
+
+private struct SMJobBlessInstaller: PrivilegedHelperBlessing {
+    @available(macOS, deprecated: 13.0, message: "Move the privileged helper to SMAppService")
+    @discardableResult
+    func bless(label: String, authorization: AuthorizationRef?, error: inout Unmanaged<CFError>?) -> Bool {
+        SMJobBless(kSMDomainSystemLaunchd, label as CFString, authorization, &error)
+    }
+}
+
 enum HelperClientError: LocalizedError {
     case failedToCreateRemoteObjectProxy
     case message(String)
+    /// SMJobBless rejected the helper because its signature doesn't satisfy the app's SMPrivilegedExecutables requirement
+    case invalidSignature(underlyingError: Error)
+    /// SMJobBless wasn't authorized, e.g. the administrator prompt was cancelled or couldn't be shown
+    case authorizationFailed(underlyingError: Error)
+    /// The helper was blessed but doesn't answer, e.g. it rejects this app's signature via SMAuthorizedClients
+    case unreachableAfterInstall(underlyingError: Error?)
 
     var errorDescription: String? {
         switch self {
         case .failedToCreateRemoteObjectProxy:
             return localizeString("HelperClient.error")
         case let .message(message):
             return message
+        case let .invalidSignature(underlyingError):
+            return Self.withDetails(localizeString("HelperClient.error.InvalidSignature"), underlyingError)
+        case let .authorizationFailed(underlyingError):
+            return Self.withDetails(localizeString("HelperClient.error.AuthorizationFailed"), underlyingError)
+        case let .unreachableAfterInstall(underlyingError):
+            return Self.withDetails(localizeString("HelperClient.error.UnreachableAfterInstall"), underlyingError)
         }
     }
+
+    private static func withDetails(_ message: String, _ underlyingError: Error?) -> String {
+        guard let underlyingError else { return message }
+        return "\(message)\n\n\(underlyingError.legibleLocalizedDescription)"
+    }
 }
```

**File**: `Xcodes/Backend/NotificationManager.swift` (modified, +12/-10)
```diff
@@ -60,13 +60,13 @@ public final class NotificationManager: NSObject, UNUserNotificationCenterDelega
         notificationStatusTask = Task { [weak self] in
             let settings = await UNUserNotificationCenter.current().notificationSettings()
             guard !Task.isCancelled else {
-                await self?.clearNotificationStatusTask(id: taskID)
+                self?.clearNotificationStatusTask(id: taskID)
                 return
             }
 
             let status = NotificationManager.systemPromptStatusFromSettings(settings)
-            await self?.setNotificationStatus(status, ifNotificationStatusTaskID: taskID)
-            await self?.clearNotificationStatusTask(id: taskID)
+            self?.setNotificationStatus(status, ifNotificationStatusTaskID: taskID)
+            self?.clearNotificationStatusTask(id: taskID)
         }
     }
     
@@ -94,14 +94,14 @@ public final class NotificationManager: NSObject, UNUserNotificationCenterDelega
             do {
                 let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                 guard !Task.isCancelled else {
-                    await self?.clearRequestAccessTask(id: taskID)
+                    self?.clearRequestAccessTask(id: taskID)
                     return
                 }
 
                 Logger.appState.log("User has \(granted ? "Granted" : "NOT GRANTED") notification permission")
             } catch {
                 guard !Task.isCancelled else {
-                    await self?.clearRequestAccessTask(id: taskID)
+                    self?.clearRequestAccessTask(id: taskID)
                     return
                 }
 
@@ -110,13 +110,13 @@ public final class NotificationManager: NSObject, UNUserNotificationCenterDelega
 
             let settings = await UNUserNotificationCenter.current().notificationSettings()
             guard !Task.isCancelled else {
-                await self?.clearRequestAccessTask(id: taskID)
+                self?.clearRequestAccessTask(id: taskID)
                 return
             }
 
             let status = NotificationManager.systemPromptStatusFromSettings(settings)
-            await self?.setNotificationStatus(status, ifRequestAccessTaskID: taskID)
-            await self?.clearRequestAccessTask(id: taskID)
+            self?.setNotificationStatus(status, ifRequestAccessTaskID: taskID)
+            self?.clearRequestAccessTask(id: taskID)
         }
     }
 
@@ -154,9 +154,11 @@ public final class NotificationManager: NSObject, UNUserNotificationCenterDelega
     }
     
     func scheduleNotification(title: String?, body: String, category: XcodesNotificationCategory) {
-          
         let content = UNMutableNotificationContent()
-        if let title = title {
+        // Unit tests run inside the app and simulate installing Xcode "0.0"; label those so they aren't mistaken for real installs.
+        if isTesting {
+            content.title = ["Test", title].compactMap { $0 }.joined(separator: ": ")
+        } else if let title = title {
             content.title = title
         }
         content.body = body
```

**File**: `Xcodes/Frontend/Common/XcodesAlert.swift` (modified, +98/-0)
```diff
@@ -6,6 +6,8 @@ enum XcodesAlert: Identifiable {
     case cancelInstall(xcode: Xcode)
     case cancelRuntimeInstall(runtime: DownloadableRuntime)
     case privilegedHelper
+    case postInstallFailed(xcode: InstalledXcode)
+    case unauthenticatedDataSource
     case generic(title: String, message: String)
     case checkMinSupportedVersion(xcode: AvailableXcode, macOS: String)
     case unauthenticated
@@ -16,6 +18,8 @@ enum XcodesAlert: Identifiable {
         switch self {
         case .cancelInstall: return 1
         case .privilegedHelper: return 2
+        case .postInstallFailed: return 10
+        case .unauthenticatedDataSource: return 7
         case .generic: return 3
         case .checkMinSupportedVersion: return 4
         case .cancelRuntimeInstall: return 5
@@ -65,3 +69,97 @@ extension Alert {
         )
     }
 }
+
+struct HelperFileOperationError: LocalizedError {
+    let underlyingError: Error
+    let command: String
+    var errorDescription: String? { underlyingError.localizedDescription }
+}
+
+/// The command is displayed and copied only; Xcodes never executes it.
+struct HelperRecovery {
+    let title: String
+    let message: String
+    let command: String
+
+    static func quote(_ path: String) -> String {
+        "'" + path.replacingOccurrences(of: "'", with: "'\"'\"'") + "'"
+    }
+
+    static func selectCommand(path: String) -> String {
+        "sudo /usr/bin/xcode-select --switch " + quote(path)
+    }
+
+    static func moveCommand(source: String, destination: String) -> String {
+        // Refuse to overwrite an existing app, including a dangling symlink.
+        let destination = quote(destination)
+        return "[ ! -e " + destination + " ] && [ ! -L " + destination + " ] && sudo /bin/mv " + quote(source) + " " + destination
+    }
+
+    static func symlinkCommand(source: String, destination: String) -> String {
+        let destination = quote(destination)
+        return "([ ! -e " + destination + " ] || [ -L " + destination + " ]) && sudo /bin/ln -sfn " + quote(source) + " " + destination
+    }
+}
+
+struct HelperRecoveryView: View {
+    @EnvironmentObject var appState: AppState
+    @SwiftUI.Environment(\.dismiss) private var dismiss
+    @State private var copied = false
+    let recovery: HelperRecovery
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 16) {
+            Text(verbatim: recovery.title).font(.headline)
+            Text(verbatim: recovery.message).textSelection(.enabled)
+            Text("HelperRecovery.Explanation")
+            ScrollView {
+                Text(verbatim: recovery.command)
+                    .font(.system(.body, design: .monospaced))
+                    .textSelection(.enabled)
+                    .frame(maxWidth: .infinity, alignment: .leading)
+                    .padding(12)
+            }
+            .frame(maxHeight: 180)
+            .background(Color.secondary.opacity(0.1))
+            .cornerRadius(6)
+            HStack {
+                if #available(macOS 14, *) {
+                    HelperSettingsButton {
+                        appState.showHelperSettings = true
+                        dismiss()
+                    }
+                } else {
+                    Button("HelperRecovery.OpenSettings") {
+                        appState.showHelperSettings = true
+                        dismiss()
+                        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
+                    }
+                }
+                Button(copied ? "HelperRecovery.Copied" : "HelperRecovery.CopyCommand") {
+                    NSPasteboard.general.clearContents()
+                    NSPasteboard.general.setString(recovery.command, forType: .string)
+                    copied = true
+                }
+                Spacer()
+                Button("Done") { dismiss() }
+                    .keyboardShortcut(.defaultAction)
+            }
+        }
+        .padding(24)
+        .frame(width: 620)
+    }
+}
+
+@available(macOS 14, *)
+private struct HelperSettingsButton: View {
+    @SwiftUI.Environment(\.openSettings) private var openSettings
+    let prepare: () -> Void
+
+    var body: some View {
+        Button("HelperRecovery.OpenSettings") {
+            prepare()
+            openSettings()
+        }
+    }
+}
```

---

### Incident Patch 3: `9836fd83` (2026-11-10)
**Commit Message**: Merge pull request #890 from XcodesOrg/fix/appcast-release-workflow

Fix AppCast publishing on Ubuntu 26.04

**File**: `.github/workflows/appcast.yml` (modified, +22/-24)
```diff
@@ -3,48 +3,46 @@ name: Build and publish a new appcast file
 on:
   workflow_dispatch:
   release:
+    types: [published]
 
 jobs:
   jekyll:
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
+    permissions:
+      contents: write
+      pages: write
     steps:
     - name: Checkout 🛎
-      uses: actions/checkout@v4
+      uses: actions/checkout@v7
       with:
-        # If you're using actions/checkout@v4 you must set persist-credentials to false in most cases for the deployment to work correctly.
         persist-credentials: false
 
-#    - name: Cache 📦
-#      uses: actions/cache@v4.1.1
-#      with:
-#        path: AppCast/vendor/bundle
-#        key: ${{ runner.os }}-gems-v1.0-${{ hashFiles('AppCast/Gemfile') }}
-#        restore-keys: |
-#          ${{ runner.os }}-gems-
-          
-    - name: Setup Ruby, JRuby and TruffleRuby
-      uses: ruby/setup-ruby@v1.197.0
+    - name: Set up Ruby
+      uses: ruby/setup-ruby@v1
       with:
-        ruby-version: '3.0'
-
-    - name: Bundler 💎
-      working-directory: AppCast
-      env:
-        BUNDLE_PATH: vendor/bundle
-      run: |
-        gem install bundler
-        bundle install
+        ruby-version: '3.4'
+        working-directory: AppCast
+        bundler-cache: true
 
     - name: Build 🛠
       working-directory: AppCast
       env:
-        BUNDLE_PATH: vendor/bundle
         JEKYLL_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       run: bundle exec jekyll build
-      
+
     - name: Publish 🚀
+      # Manual runs on branches other than the default branch only build the feeds.
+      if: github.event_name == 'release' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
+      id: publish
       uses: JamesIves/github-pages-deploy-action@releases/v4
       with:
         token: ${{ secrets.GITHUB_TOKEN }}
         branch: gh-pages
         folder: AppCast/_site
+
+    - name: Request GitHub Pages build
+      # Pushes made with GITHUB_TOKEN don't trigger a branch-based Pages build.
+      if: steps.publish.outcome == 'success'
+      env:
+        GH_TOKEN: ${{ github.token }}
+      run: gh api --method POST "repos/$GITHUB_REPOSITORY/pages/builds"
```

**File**: `AppCast/Gemfile.lock` (modified, +14/-0)
```diff
@@ -18,14 +18,22 @@ GEM
       ruby2_keywords
     faraday-net_http (1.0.1)
     ffi (1.17.2)
+    ffi (1.17.2-arm64-darwin)
     ffi (1.17.2-x86_64-darwin)
+    ffi (1.17.2-x86_64-linux-gnu)
     forwardable-extended (2.6.0)
     google-protobuf (4.31.1)
       bigdecimal
       rake (>= 13)
+    google-protobuf (4.31.1-arm64-darwin)
+      bigdecimal
+      rake (>= 13)
     google-protobuf (4.31.1-x86_64-darwin)
       bigdecimal
       rake (>= 13)
+    google-protobuf (4.31.1-x86_64-linux-gnu)
+      bigdecimal
+      rake (>= 13)
     http_parser.rb (0.8.0)
     i18n (1.14.7)
       concurrent-ruby (~> 1.0)
@@ -83,8 +91,12 @@ GEM
     sass-embedded (1.89.2)
       google-protobuf (~> 4.31)
       rake (>= 13)
+    sass-embedded (1.89.2-arm64-darwin)
+      google-protobuf (~> 4.31)
     sass-embedded (1.89.2-x86_64-darwin)
       google-protobuf (~> 4.31)
+    sass-embedded (1.89.2-x86_64-linux-gnu)
+      google-protobuf (~> 4.31)
     sawyer (0.8.2)
       addressable (>= 2.3.5)
       faraday (> 0.8, < 2.0)
@@ -100,8 +112,10 @@ GEM
     webrick (1.9.1)
 
 PLATFORMS
+  arm64-darwin
   ruby
   x86_64-darwin-20
+  x86_64-linux-gnu
 
 DEPENDENCIES
   jekyll (~> 4.4.1)
```

#### Recent Merged Pull Requests:
- **PR #890** (2026-11-10): Fix AppCast publishing on Ubuntu 26.04 (@MattKiazyk)
- **PR #889** (2026-11-10): Support AEA archives in Xcodes.app (@MattKiazyk)
- **PR #888** (2026-11-10): Add disk cleanup to Xcodes (@MattKiazyk)
- **PR #886** (2026-11-10): Fix installed and active state not refreshing after install, select, and uninstall. (@jrlanglois)
- **PR #885** (2026-11-10): Fix frozen download progress after a retry (@mahadshahib)
- **PR #884** (2026-11-10): Preserve Apple account credentials after transient authentication failures (@zunda-pixel)

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

## X. installed and active state not refreshing after install, select, and uninstall

**RULE**:
When implementing operations in `Xcodes/Backend/AppState+Install.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in XcodesOrg/XcodesApp. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `27bf2654`: installed and active state not refreshing after install, select, and uninstall. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Xcodes/Backend/AppState+Install.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                // Refreshed before the row is patched: `updateAllXcodes` rebuilds every row from this cache
                // on the next selection or update, carrying over only rows that are still `.installing`.
                await updateInstalledXcodesAsync(recomposeAllXcodes: false)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `27bf2654` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
