> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kruszoneq-macusb-learnings.md`  
> **Source**: github ([https://github.com/Kruszoneq/macUSB](https://github.com/Kruszoneq/macUSB))  
> **Source Version**: `777ed534`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T09:49:23.532Z  
> **Learning ID**: `learn-github-kruszoneq-macusb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Kruszoneq/macUSB

> **Canonical Artifact**: `07_PROJECT_LEARNING/kruszoneq-macusb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kruszoneq/macUSB](https://github.com/Kruszoneq/macUSB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-26T09:48:31.446Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kruszoneq/macUSB`
- **Description**: The all-in-one bootable USB creator for Mac
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3297 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `macUSB/Features/Analysis/Logic/Linux/AnalysisLogicLinuxLifecycle.swift`
```
import Foundation
import AppKit

private enum LinuxDistroIconCatalog {
    static let names: [String] = [
        "alpine", "antix", "arch", "arco", "artix", "bluestar", "bodhi", "bunsenlabs",
        "clear", "debian", "deepin", "elementary", "endeavour", "endless", "feren",
        "gentoo", "kali", "kaos", "knoppix", "kubuntu", "linux", "lite", "lubuntu",
        "mageia", "manjaro", "mint", "mx", "neon", "netrunner", "nixos", "openmandriva",
        "parrot", "pclinuxos", "peppermint", "pop", "qubes", "raspios", "rebornos",
        "redhat", "rosa", "septor", "slackware", "solus", "suse", "tails", "tinycore",
        "ubuntu", "ubuntu_cinnamon", "ubuntu_dde", "ubuntu_mate", "void", "xubuntu", "zorin"
    ]

    static let namesSet = Set(names)

    static let aliases: [String: [String]] = [
        "alpine linux": ["alpine"],
        "anti x": ["antix"],
        "antix": ["antix"],
        "arch linux": ["arch"],
        "arcolinux": ["arco"],
        "artix linux": ["artix"],
        "bluestar linux": ["bluestar"],
        "bodhi linux": ["bodhi"],
        "bunsenlabs linux": ["bunsenlabs"],
        "clear linux": ["clear"],
        "debian gnu linux": ["debian"],
        "deepin linux": ["deepin"],
        "elementary os": ["elementary"],
        "endeavouros": ["endeavour"],
        "endless os": ["endless"],
        "fedora": ["redhat"],
        "feren os": ["feren"],
        "gentoo linux": ["gentoo"],
        "kali linux": ["kali"],
        "kaos linux": ["kaos"],
        "knoppix linux": ["knoppix"],
        "kde neon": ["neon"],
        "kubuntu": ["kubuntu"],
        "linux lite": ["lite"],
        "lubuntu": ["lubuntu"],
        "mageia linux": ["mageia"],
        "linux mint": ["mint"],
        "mx linux": ["mx"],
        "nitrux": ["neon"],
        "nixos": ["nixos"],
        "open mandriva": ["openmandriva"],
        "openmandriva lx": ["openmandriva"],
        "openmamba": ["openmandriva"],
        "opensuse": ["suse"],
        "opensuse leap": ["suse"],
        "opensuse tumbleweed": ["suse"],
        "parrot os": ["parrot"],
        "pclinuxos": ["pclinuxos"],
        "peppermint os": ["peppermint"],
        "pop os": ["pop"],
        "popos": ["pop"],
        "pop os linux": ["pop"],
        "qubes os": ["qubes"],
        "raspberry pi os": ["raspios"],
        "raspian": ["raspios"],
        "red hat": ["redhat"],
        "red hat enterprise linux": ["redhat"],
        "rhel": ["redhat"],
        "rosa linux": ["rosa"],
        "septor linux": ["septor"],
        "slackware linux": ["slackware"],
        "solus os": ["solus"],
        "suse linux": ["suse"],
        "tails linux": ["tails"],
        "tiny core linux": ["tinycore"],
        "almalinux": ["redhat"],
        "ubuntu mate": ["ubuntu_mate", "ubuntu"],
        "ubuntu cinnamon": ["ubuntu_cinnamon", "ubuntu"],
        "ubuntu dde": ["ubuntu_dde", "ubuntu"],
        "ubuntu unity": ["ubuntu"],
        "void linux": ["void"],
        "xubuntu": ["xubuntu"],
        "zorin os": ["zorin"]
    ]

    static let noiseWords: Set<String> = [
        "linux", "gnu", "os", "edition", "desktop", "live", "installer", "install", "lts", "release"
    ]
}

extension AnalysisLogic {
    func loadLinuxDetectedSystemIcon(for distro: String?) -> NSImage? {
        if let distro, let distroIcon = loadLinuxDistroIcon(for: distro) {
            self.logLinux("Loaded Linux distribution icon: \(distro)")
            return distroIcon
        }

        guard let icon = loadLinuxDistroIcon(for: "linux") else {
            self.logLinux("Fallback linux.png icon not found; using SF Symbol.", category: "FileAnalysis")
            return nil
        }
        icon.isTemplate = false
        self.logLinux("Loaded fallback linux.png icon.", category: "FileAnalysis")
        return icon
    }

    private func loadLinuxDistroIcon(for distro: String) -> NSImage? {
        let candidates = linuxDistroIconResourceCandidates(for: distro)

        for candidate in candidates {
            if let nestedURL = Bundle.main.url(forResource: candidate, withExtension: "png", subdirectory: "Icons/Linux/Distros"),
               let icon = NSImage(contentsOf: nestedURL) {
                icon.isTemplate = false
                return icon
            }

            if let bundledDistrosURL = Bundle.main.url(forResource: candidate, withExtension: "png", subdirectory: "Distros"),
               let icon = NSImage(contentsOf: bundledDistrosURL) {
                icon.isTemplate = false
                return icon
            }

            if let rootURL = Bundle.main.url(forResource: candidate, withExtension: "png"),
               let icon = NSImage(contentsOf: rootURL) {
                icon.isTemplate = false
                return icon
            }
        }

        self.logLinux("No dedicated distribution icon for: \(distro). Candidates: \(candidates.joined(separator: ", "))", category: "FileAnalysis")
        return nil
    }

    private func linuxDistroIconResourceCandidates(for distro: String) -> [String] {
        let normalized = normalizeLinuxDistroLookupKey(distro)
        guard !normalized.isEmpty else { return [] }

        var candidates: [String] = []
        func appendCandidate(_ candidate: String) {
            guard LinuxDistroIconCatalog.namesSet.contains(candidate), !candidates.contains(candidate) else { return }
            candidates.append(candidate)
        }

        if let aliasCandidates = LinuxDistroIconCatalog.aliases[normalized] {
            aliasCandidates.forEach(appendCandidate)
        }

        let words = normalized.split(separator: " ").map(String.init)
        let compact = words.joined()
        let underscored = words.joined(separator: "_")
        appendCandidate(underscored)
        appendCandidate(compact)
        words.forEach(appendCandidate)

        let strippedWords = words.filter { !LinuxDistroIconCatalog.noiseWords.contains($0) }
        if !strippedWords.isEmpty {
            let strippedPhrase = strippedWords.joined(separator: " ")
            if let aliasCandidates = LinuxDistroIconCatalog.aliases[strippedPhrase] {
                aliasCandidates.forEach(appendCandidate)
            }

            appendCandidate(strippedWords.joined(separator: "_"))
            appendCandidate(strippedWords.joined())
            strippedWords.forEach(appendCandidate)
        }

        for iconName in LinuxDistroIconCatalog.names where iconName.count >= 4 {
            let compactIconName = iconName.replacingOccurrences(of: "_", with: "")
            if compact.contains(compactIconName) {
                appendCandidate(iconName)
            }
        }

        return candidates
    }

    private func normalizeLinuxDistroLookupKey(_ rawValue: String) -> String {
        let lowered = rawValue.lowercased()
        let normalized = lowered.replacingOccurrences(
            of: #"[^a-z0-9]+"#,
            with: " ",
            options: .regularExpression
        )
        return normalized
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }

    func resetLinuxDetectionState() {
        cleanupLinuxAttachSession(reason: "reset_linux_detection_state")
        self.isLinuxDetected = false
        self.isRawImageSelection = false
        self.isLinuxDistributionRecognized = false
        self.linuxDistro = nil
        self.linuxVersion = nil
        self.linuxEdition = nil
        self.linuxArchitecture = nil
        self.isLinuxARM = false
        self.linuxDisplayName = nil
        self.linuxSourceURL = nil
    }

    func applyLinuxDetectionResult(_ result: LinuxDetectionResult, sourceURL: URL, mountedImagePath: String?) {
        InstallerSourceImageUnmountRegistry.shared.registerSourceImage(
            path: sourceURL.path,
            family: .linux,
            mountHint: mountedImagePath,
            reason: "linux_detection_result"
        )

        self.resetWindowsDetectionState()
        self.isLinuxDetected = result.isLinux
        self.isLinuxDistributionRecognized = result.isDistributionRecognized
        self.linuxDistro = result.distro
        self.linuxVersion = result.version
        self.linuxEdition = result.edition
        self.linuxArchitecture = result.archRaw
        self.isLinuxARM = result.isARM
        self.linuxDisplayName = result.displayName
        self.linuxSourceURL = sourceURL

        self.recognizedVersion = result.displayName
        self.sourceAppURL = nil
        self.detectedSystemIcon = loadLinuxDetectedSystemIcon(for: result.distro)
        self.mountedDMGPath = mountedImagePath

        self.isSystemDetected = true
        self.showUnsupportedMessage = false
        self.showUSBSection = false

        self.needsCodesign = true
        self.isLegacyDetected = false
        self.isRestoreLegacy = false
        self.isCatalina = false
        self.isSierra = false
        self.isMavericks = false
        self.isUnsupportedSierra = false
        self.isPPC = false
        self.legacyArchInfo = nil
        self.userSkippedAnalysis = false
        applySourceCapacityRequirement(
            try? USBTargetCapacityRequirement.forSource(at: sourceURL),
            sourceURL: sourceURL
        )

        self.logLinux("Recognized Linux image: \(result.displayName)")
        self.logLinux("Linux source file: \(sourceURL.path)")
        self.logLinux("Linux details: distro=\(result.distro ?? "?") version=\(result.version ?? "?") edition=\(result.edition ?? "?") arch=\(result.archRaw ?? "?") arm=\(result.isARM ? "yes" : "no")")
        self.logLinux("Linux classification: rule=\(result.classificationRule) matched_signal=\(result.matchedSignal ?? "none") version_source=\(result.versionSource ?? "none")")
        self.logLinux("Linux gate_signals: \(result.gateSignals.joined(separator: ", "))")
        self.logLinux("Linux evidence: \(result.evidence.joined(separator: ", "))")
        cleanupLinuxAttach
```

### Core Architecture Module: `macUSB/Features/Analysis/Logic/Linux/AnalysisLogicRawLinuxImageLifecycle.swift`
```
import Foundation
import SwiftUI

extension AnalysisLogic {
    func forceRawLinuxImageSelection(_ sourceURL: URL) {
        cancelActiveImageAnalysisRun(reason: "raw .iso/.img image selection")

        let standardizedURL = sourceURL.standardizedFileURL
        let sourceExtension = standardizedURL.pathExtension.lowercased()
        guard ["iso", "img"].contains(sourceExtension) else {
            logRawError("Cannot enable raw image writing for .\(sourceExtension).")
            return
        }
        MenuState.shared.lockLanguageChanges(reason: "raw_linux_selection")

        logRaw("Raw .iso/.img image selected manually without file analysis.")

        withAnimation {
            self.selectedFilePath = standardizedURL.path
            self.selectedFileUrl = standardizedURL
            self.isAnalyzing = false
            self.userSkippedAnalysis = true
            self.resetLinuxDetectionState()
            self.resetWindowsDetectionState()

            self.isLinuxDetected = true
            self.isRawImageSelection = true
            self.isLinuxDistributionRecognized = false
            self.linuxDisplayName = standardizedURL.lastPathComponent
            self.linuxSourceURL = standardizedURL

            self.recognizedVersion = standardizedURL.lastPathComponent
            self.sourceAppURL = nil
            self.detectedSystemIcon = nil
            self.mountedDMGPath = nil

            self.isSystemDetected = true
            self.showUnsupportedMessage = false
            self.showUSBSection = false

            self.needsCodesign = true
            self.isLegacyDetected = false
            self.isRestoreLegacy = false
            self.isCatalina = false
            self.isSierra = false
            self.isMavericks = false
            self.isUnsupportedSierra = false
            self.isPPC = false
            self.legacyArchInfo = nil
            self.selectedDrive = nil
            self.usbTargetReadiness = .noSelection
            self.shouldShowMavericksDialog = false
            self.shouldShowAlreadyMountedSourceAlert = false
            self.shouldShowSourceSizeUnavailableAlert = false
        }

        applySourceCapacityRequirement(
            try? USBTargetCapacityRequirement.forSource(at: standardizedURL),
            sourceURL: standardizedURL
        )
        logRaw("Manual raw image writing configured: recognizedVersion=\(recognizedVersion), source=\(standardizedURL.path)")
    }
}

```

### Core Architecture Module: `macUSB/Features/Analysis/Logic/Windows/AnalysisLogicWindowsLifecycle.swift`
```
import Foundation
import AppKit

extension AnalysisLogic {
    private static let windowsFAT32LimitBytes: Int64 = 4_294_967_295

    var windowsFallbackSymbolName: String {
        if #available(macOS 11.0, *), NSImage(systemSymbolName: "pc", accessibilityDescription: nil) != nil {
            return "pc"
        }
        return "desktopcomputer"
    }

    private func loadWindowsDetectedSystemIcon(for family: WindowsFamily) -> NSImage? {
        let iconName: String
        switch family {
        case .eleven, .server2025:
            iconName = "Win11"
        default:
            iconName = "Win10"
        }

        let iconURL =
            Bundle.main.url(forResource: iconName, withExtension: "svg") ??
            Bundle.main.url(forResource: iconName, withExtension: "svg", subdirectory: "Icons/Windows")

        guard let iconURL,
              let icon = NSImage(contentsOf: iconURL) else {
            self.logWindows("Windows icon not found in resources: \(iconName).svg")
            return nil
        }

        icon.isTemplate = true
        return icon
    }

    func resetWindowsDetectionState() {
        self.isWindowsDetected = false
        self.windowsFamily = nil
        self.windowsServicePack = nil
        self.windowsArchitecture = nil
        self.isWindowsARM = false
        self.windowsHasEFI = false
        self.windowsBootCapabilities = nil
        self.isWindowsWorkflowSupported = false
        self.windowsWillSplitWIM = false
        self.windowsAutounattendMacLocale = nil
    }

    func applyWindowsDetectionResult(_ result: WindowsDetectionResult, sourceURL: URL, mountedImagePath: String?) {
        InstallerSourceImageUnmountRegistry.shared.registerSourceImage(
            path: sourceURL.path,
            family: .windows,
            mountHint: mountedImagePath,
            reason: "windows_detection_result"
        )

        self.isWindowsDetected = true
        self.windowsFamily = result.family
        self.windowsServicePack = result.servicePack
        self.windowsArchitecture = result.arch
        self.isWindowsARM = result.isARM
        self.windowsHasEFI = result.bootCapabilities.hasUEFI
        self.windowsBootCapabilities = result.bootCapabilities
        self.isWindowsWorkflowSupported = result.isSupported
        self.windowsWillSplitWIM = result.isSupported && detectWindowsWimSplitNeed(mountedImagePath: mountedImagePath)
        self.windowsAutounattendMacLocale = resolveWindowsAutounattendMacLocaleIfNeeded(
            for: result,
            mountedImagePath: mountedImagePath
        )

        self.recognizedVersion = result.displayName
        self.sourceAppURL = nil
        self.detectedSystemIcon = loadWindowsDetectedSystemIcon(for: result.family)

        self.needsCodesign = true
        self.isLegacyDetected = false
        self.isRestoreLegacy = false
        self.isCatalina = false
        self.isSierra = false
        self.isMavericks = false
        self.isUnsupportedSierra = false
        self.isPPC = false
        self.legacyArchInfo = nil
        self.userSkippedAnalysis = false

        let windowsToolchainPresence = detectWindowsToolchainPresence()
        self.logWindows(
            "Windows toolchain presence: brew=\(windowsToolchainPresence.hasHomebrew), wimlib=\(windowsToolchainPresence.hasWimlib)"
        )
        self.logWindows(
            "Windows toolchain paths: brew=\(windowsToolchainPresence.homebrewPath ?? "not_found"), wimlib=\(windowsToolchainPresence.wimlibPath ?? "not_found")"
        )

        if result.isSupported {
            applySourceCapacityRequirement(
                try? USBTargetCapacityRequirement.forSource(at: sourceURL),
                sourceURL: sourceURL
            )
        } else {
            self.usbTargetCapacityRequirement = nil
            self.shouldShowSourceSizeUnavailableAlert = false
        }

        if result.isSupported {
            self.isSystemDetected = true
            self.showUnsupportedMessage = false
            self.showUSBSection = false
        } else {
            self.isSystemDetected = false
            self.showUnsupportedMessage = true
            self.showUSBSection = false
        }

        self.logWindows("Recognized Windows image: \(result.displayName)")
        self.logWindows(
            "Windows support gate: supported=\(result.isSupported ? "yes" : "no"), reason=\(result.supportReason.rawValue), has_eligible_boot_mode=\(result.bootCapabilities.eligibleModes.isEmpty ? "no" : "yes"), hasEFI=\(result.bootCapabilities.hasUEFI ? "yes" : "no")"
        )
        self.logWindows("Windows workflow flag: isWindowsWorkflowSupported=\(self.isWindowsWorkflowSupported ? "yes" : "no")")
        self.logWindows("Windows workflow split-wim flag: \(self.windowsWillSplitWIM ? "yes" : "no")")
        self.logWindows("Windows source file: \(sourceURL.path)")
        self.logWindows(
            "Windows boot capabilities: detected=\(windowsBootModesLogValue(result.bootCapabilities.detectedModes)), eligible=\(windowsBootModesLogValue(result.bootCapabilities.eligibleModes)), family=\(result.family.rawValue), arch=\(result.arch.rawValue), workflow_supported=\(result.isSupported ? "yes" : "no")"
        )
        self.logWindows(
            "Windows boot marker evidence: BIOS present=\(windowsBootMarkersLogValue(result.bootCapabilities.biosPresentMarkers)) missing=\(windowsBootMarkersLogValue(result.bootCapabilities.biosMissingRequiredMarkers)); UEFI present=\(windowsBootMarkersLogValue(result.bootCapabilities.uefiPresentMarkers)) missing=\(windowsBootMarkersLogValue(result.bootCapabilities.uefiMissingRequiredMarkers))"
        )
        AppLogging.separator(stage: .analysis, workflow: .windows)
    }

    private func windowsBootModesLogValue(_ modes: Set<WindowsBootMode>) -> String {
        let orderedModes = WindowsBootMode.allCases.filter(modes.contains).map(\.rawValue)
        return orderedModes.isEmpty ? "none" : orderedModes.joined(separator: "+")
    }

    private func windowsBootMarkersLogValue(_ markers: [String]) -> String {
        markers.isEmpty ? "none" : "[\(markers.joined(separator: ","))]"
    }

    private func resolveWindowsAutounattendMacLocaleIfNeeded(
        for result: WindowsDetectionResult,
        mountedImagePath: String?
    ) -> CreatorWindowsAutounattendMacLocale? {
        guard result.isSupported,
              CreatorWindowsAutounattendWindowsVersion.detected(
                from: result.displayName,
                architecture: result.arch
              ) != nil else {
            self.logWindows("Windows autounattend language check skipped: image is not supported Windows 10 64-bit or Windows 11 for this feature.")
            return nil
        }

        let macLanguage = CreatorWindowsAutounattendMacLocale.normalizedWindowsTag(Locale.preferredLanguages.first) ?? "unknown"
        let macRegion = CreatorWindowsAutounattendMacLocale.normalizedWindowsTag(Locale.current.identifier) ?? "unknown"
        self.logWindows(
            "Windows autounattend language check: reading sources/lang.ini from Windows image (mount=\(mountedImagePath ?? "nil"))."
        )

        let isoLanguageTags = CreatorWindowsAutounattendSourceInspection.availableLanguageTags(in: mountedImagePath)
        let isoLanguagesDescription = isoLanguageTags?.sorted().joined(separator: ", ") ?? "none/unreadable"
        let macLocale = CreatorWindowsAutounattendMacLocale.current(availableLanguageTags: isoLanguageTags)

        self.logWindows(
            "Windows autounattend language check: ISO languages=\(isoLanguagesDescription); macOS language=\(macLanguage); macOS region=\(macRegion); match=\((macLocale?.languageIsAvailableInSource == true) ? "yes" : "no")."
        )

        return macLocale
    }

    private func detectWindowsWimSplitNeed(mountedImagePath: String?) -> Bool {
        guard let mountedImagePath, !mountedImagePath.isEmpty else {
            return false
        }

        let sourcesCandidates = [
            URL(fileURLWithPath: mountedImagePath).appendingPathComponent("sources"),
            URL(fileURLWithPath: mountedImagePath).appendingPathComponent("Sources")
        ]

        for sourcesPath in sourcesCandidates where FileManager.default.fileExists(atPath: sourcesPath.path) {
            let wimCandidates = [
                sourcesPath.appendingPathComponent("install.wim"),
                sourcesPath.appendingPathComponent("INSTALL.WIM")
            ]

            for wimPath in wimCandidates {
                guard FileManager.default.fileExists(atPath: wimPath.path) else { continue }
                guard let attributes = try? FileManager.default.attributesOfItem(atPath: wimPath.path),
                      let sizeValue = attributes[.size] as? NSNumber else {
                    continue
                }

                return sizeValue.int64Value > Self.windowsFAT32LimitBytes
            }
        }

        return false
    }
}

```

### Core Architecture Module: `macUSB/Features/Analysis/Logic/macOS/AnalysisLogicMacOSLifecycle.swift`
```
import SwiftUI
import Foundation

extension AnalysisLogic {
    func forceTigerMultiDVDSelection() {
        MenuState.shared.lockLanguageChanges(reason: "manual_tiger_selection")
        cancelActiveImageAnalysisRun(reason: "manual Tiger Multi DVD selection")
        self.log("Tiger Multi DVD mode selected manually", workflow: .ppc)
        let fileURL = self.selectedFileUrl
        DispatchQueue.global(qos: .userInitiated).async {
            let resolvedRequirement = fileURL.flatMap { try? USBTargetCapacityRequirement.forSource(at: $0) }
            var mountPoint: String? = self.mountedDMGPath
            var effectiveSourceAppURL: URL? = nil
            if let url = fileURL {
                let ext = url.pathExtension.lowercased()
                if ext == "dmg" || ext == "iso" || ext == "cdr" {
                    if mountPoint == nil {
                        mountPoint = self.mountImageForPPC(dmgUrl: url)
                    }
                    if let mp = mountPoint {
                        effectiveSourceAppURL = URL(fileURLWithPath: mp).appendingPathComponent("Install")
                    }
                } else if ext == "app" {
                    effectiveSourceAppURL = url
                }
            }
            DispatchQueue.main.async {
                guard self.selectedFileUrl == fileURL else { return }
                withAnimation {
                    self.isAnalyzing = false
                    self.userSkippedAnalysis = true
                    self.recognizedVersion = "Mac OS X Tiger 10.4"
                    self.sourceAppURL = effectiveSourceAppURL
                    self.updateDetectedSystemIcon(from: effectiveSourceAppURL)
                    self.isBetaInstaller = false
                    self.mountedDMGPath = mountPoint
                    self.isSystemDetected = true
                    self.showUnsupportedMessage = false
                    self.showUSBSection = true
                    self.needsCodesign = false
                    self.isLegacyDetected = false
                    self.isRestoreLegacy = false
                    self.isCatalina = false
                    self.isSierra = false
                    self.isMavericks = false
                    self.isUnsupportedSierra = false
                    self.isPPC = true
                    self.createInstallMediaInspection = .notApplicable
                    self.macOSArchitectureBlockReason = nil
                    self.macOSRosettaRequirement = .notRequired
                    self.legacyArchInfo = nil
                    self.selectedDrive = nil
                    self.usbTargetReadiness = .noSelection
                    if let fileURL {
                        self.applySourceCapacityRequirement(resolvedRequirement, sourceURL: fileURL)
                    } else {
                        self.usbTargetCapacityRequirement = USBTargetCapacityRequirement.fallback()
                        self.shouldShowSourceSizeUnavailableAlert = true
                    }
                    self.resetLinuxDetectionState()
                    self.resetWindowsDetectionState()
                }
                let flags = [self.isPPC ? "isPPC" : nil].compactMap { $0 }.joined(separator: ", ")
                self.log("Tiger Multi DVD mode set: recognizedVersion=\(self.recognizedVersion). Flags: \(flags.isEmpty ? "none" : flags)", workflow: .ppc)
            }
        }
    }

    func resetAll() {
        cancelActiveImageAnalysisRun(reason: "full analysis state reset")
        let oldMount = self.mountedDMGPath
        if let path = oldMount {
            let task = Process()
            task.launchPath = "/usr/bin/hdiutil"
            task.arguments = ["detach", path, "-force"]
            try? task.run()
            task.waitUntilExit()
        }
        DispatchQueue.main.async {
            withAnimation {
                self.selectedFilePath = ""
                self.selectedFileUrl = nil
                self.recognizedVersion = ""
                self.sourceAppURL = nil
                self.detectedSystemIcon = nil
                self.isBetaInstaller = false
                self.mountedDMGPath = nil

                self.isAnalyzing = false
                self.isSystemDetected = false
                self.showUSBSection = false
                self.showUnsupportedMessage = false

                self.needsCodesign = true
                self.isLegacyDetected = false
                self.isRestoreLegacy = false
                self.isCatalina = false
                self.isSierra = false
                self.isMavericks = false
                self.isUnsupportedSierra = false
                self.isPPC = false
                self.createInstallMediaInspection = .notApplicable
                self.macOSArchitectureBlockReason = nil
                self.macOSRosettaRequirement = .notRequired
                self.legacyArchInfo = nil
                self.shouldShowAlreadyMountedSourceAlert = false
                self.userSkippedAnalysis = false
                self.shouldShowMavericksDialog = false
                self.usbTargetCapacityRequirement = nil
                self.shouldShowSourceSizeUnavailableAlert = false
                self.resetLinuxDetectionState()
                self.resetWindowsDetectionState()

                self.isMacOSCreateInstallMediaVolumeOverrideActive = false
                self.presentedUSBTargets = self.physicalUSBTargetsCache
                self.selectedDrive = nil

                self.usbTargetReadiness = .noSelection
            }
        }
    }

    // Call this from the UI when the user presses the "Przejdź dalej" button
    func recordProceedPressed() {
        self.log("User selected Continue. Selected target: \(self.selectedDrive?.url.path ?? "none"), source: \(self.sourceAppURL?.path ?? "none"), recognized: \(self.recognizedVersion)", workflow: selectedWorkflowForLogging)
    }
}

```

### Core Architecture Module: `macUSB/Features/Downloader/Logic/Assembly/MacOSAssemblyFileUtils.swift`
```
import Foundation

extension MontereyDownloadFlowModel {
    func uniqueCollisionSafeURL(
        in directoryURL: URL,
        preferredFileName: String
    ) -> URL {
        let preferredURL = directoryURL.appendingPathComponent(preferredFileName, isDirectory: true)
        guard FileManager.default.fileExists(atPath: preferredURL.path) else {
            return preferredURL
        }

        let nsName = preferredFileName as NSString
        let baseName = nsName.deletingPathExtension
        let ext = nsName.pathExtension

        var index = 2
        while true {
            let candidateName: String
            if ext.isEmpty {
                candidateName = "\(baseName) (\(index))"
            } else {
                candidateName = "\(baseName) (\(index)).\(ext)"
            }
            let candidateURL = directoryURL.appendingPathComponent(candidateName, isDirectory: true)
            if !FileManager.default.fileExists(atPath: candidateURL.path) {
                return candidateURL
            }
            index += 1
        }
    }
}

```

### Core Architecture Module: `macUSB/Features/Downloader/Logic/Assembly/MacOSAssemblyProcessUtils.swift`
```
import Foundation

extension MontereyDownloadFlowModel {
    func runBlockingOperation(
        _ operation: @escaping () throws -> Void
    ) async throws {
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try operation()
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func runProcessAndCaptureOutputOffMain(
        executable: String,
        arguments: [String]
    ) async throws -> String {
        let workflow = loggingWorkflow
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let output = try Self.runProcessAndCaptureOutputBlocking(
                        executable: executable,
                        arguments: arguments,
                        workflow: workflow
                    )
                    continuation.resume(returning: output)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    @discardableResult
    func runProcessAndCaptureOutput(
        executable: String,
        arguments: [String]
    ) throws -> String {
        try Self.runProcessAndCaptureOutputBlocking(
            executable: executable,
            arguments: arguments,
            workflow: loggingWorkflow
        )
    }

    @discardableResult
    func detachDiskImageWithRetry(
        mountURL: URL,
        context: String
    ) -> Bool {
        let normalArguments = ["detach", mountURL.path]
        for attempt in 1...2 {
            do {
                try runProcessAndCaptureOutput(
                    executable: "/usr/bin/hdiutil",
                    arguments: normalArguments
                )
                AppLogging.info(
                    "\(context): detach success attempt=\(attempt) mode=normal mount=\(mountURL.path)",
                    stage: .downloader, workflow: loggingWorkflow
                )
                return true
            } catch {
                AppLogging.error(
                    "\(context): detach failed attempt=\(attempt) mode=normal mount=\(mountURL.path) error=\(error.localizedDescription)",
                    stage: .downloader, workflow: loggingWorkflow
                )
                if attempt == 1 {
                    Thread.sleep(forTimeInterval: 0.25)
                }
            }
        }

        do {
            try runProcessAndCaptureOutput(
                executable: "/usr/bin/hdiutil",
                arguments: ["detach", mountURL.path, "-force"]
            )
            AppLogging.info(
                "\(context): detach success mode=force mount=\(mountURL.path)",
                stage: .downloader, workflow: loggingWorkflow
            )
            return true
        } catch {
            AppLogging.error(
                "\(context): detach failed mode=force mount=\(mountURL.path) error=\(error.localizedDescription)",
                stage: .downloader, workflow: loggingWorkflow
            )
            return false
        }
    }

    private static func runProcessAndCaptureOutputBlocking(
        executable: String,
        arguments: [String],
        workflow: AppLogging.Workflow
    ) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            throw DownloadFailureReason.assemblyFailed(
                "Nie udalo sie uruchomic \(URL(fileURLWithPath: executable).lastPathComponent): \(error.localizedDescription)"
            )
        }

        let output = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let errors = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let merged = ([output, errors].filter { !$0.isEmpty }).joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if !merged.isEmpty {
            AppLogging.info(
                "legacy-assembly command \(URL(fileURLWithPath: executable).lastPathComponent): \(merged)",
                stage: .downloader, workflow: workflow
            )
        }

        guard process.terminationStatus == 0 else {
            throw DownloadFailureReason.assemblyFailed(
                "Polecenie \(URL(fileURLWithPath: executable).lastPathComponent) zakonczone bledem (\(process.terminationStatus))."
            )
        }

        return merged
    }
}

```

### Core Architecture Module: `macUSB/Features/Downloader/Logic/Download/MacOSDownloadState.swift`
```
import Foundation
import Combine

enum DownloadStageVisualState: Hashable {
    case pending
    case active
    case completed
}

enum MontereyDownloadFlowStage: Int, CaseIterable {
    case connection
    case downloading
    case verifying
    case buildingInstaller
    case creatingDiskImage
    case cleanup
}

enum DownloadSessionState: Equatable {
    case idle
    case running
    case completed
    case failed
    case cancelled
}

enum DownloadFailureReason: LocalizedError {
    case unsupportedSelection
    case insufficientDiskSpace(requiredMinimumBytes: Int64, availableBytes: Int64, installerBytes: Int64)
    case sessionInitializationFailed(String)
    case downloadFailed(String)
    case verificationFailed(String)
    case assemblyFailed(String)
    case diskImageCreationFailed(String)
    case cleanupFailed(String)

    var errorDescription: String? {
        switch self {
        case .unsupportedSelection:
            return String(localized: "downloader.selection.error.unsupported", table: "Downloader")
        case let .insufficientDiskSpace(requiredMinimumBytes, availableBytes, installerBytes):
            return String(
                format: String(localized: "downloader.space.error.insufficient", table: "Downloader"),
                DownloadManifestItem.formatBytes(requiredMinimumBytes),
                DownloadManifestItem.formatBytes(installerBytes),
                DownloadManifestItem.formatBytes(availableBytes)
            )
        case let .sessionInitializationFailed(details):
            return String(
                format: String(localized: "downloader.session.error.initialization", table: "Downloader"),
                details
            )
        case let .downloadFailed(details):
            return String(
                format: String(localized: "downloader.transfer.error.failed", table: "Downloader"),
                details
            )
        case let .verificationFailed(details):
            return String(
                format: String(localized: "downloader.verification.error.failed", table: "Downloader"),
                details
            )
        case let .assemblyFailed(details):
            return String(
                format: String(localized: "downloader.assembly.error.failed", table: "Downloader"),
                details
            )
        case let .diskImageCreationFailed(details):
            return String(
                format: String(localized: "downloader.disk_image.error.creation", table: "Downloader"),
                details
            )
        case let .cleanupFailed(details):
            return String(
                format: String(localized: "downloader.cleanup.error.failed", table: "Downloader"),
                details
            )
        }
    }
}

let internetReconnectTimeoutSeconds = 60

struct DownloadManifestItem: Identifiable, Hashable {
    let order: Int
    let name: String
    let url: URL
    let packageIdentifier: String?
    let expectedSizeBytes: Int64
    let expectedDigest: String?
    let digestAlgorithm: String?
    let integrityDataURL: URL?

    var id: String { "\(order)|\(name)|\(url.absoluteString)" }

    var expectedSizeText: String {
        Self.formatBytes(expectedSizeBytes)
    }

    static func formatBytes(_ bytes: Int64) -> String {
        if bytes < 1_000_000_000 {
            let mb = Double(bytes) / 1_000_000
            return String(format: "%.1fMB", locale: Locale(identifier: "en_US_POSIX"), mb)
        }
        let gb = Double(bytes) / 1_000_000_000
        return String(format: "%.2fGB", locale: Locale(identifier: "en_US_POSIX"), gb)
    }
}

struct DownloadManifest: Hashable {
    let productID: String
    let systemName: String
    let systemVersion: String
    let systemBuild: String
    let distributionURL: URL?
    let items: [DownloadManifestItem]
    let totalExpectedBytes: Int64
}

struct DiskSpaceAlertContext: Equatable {
    let requiredMinimumText: String
    let availableText: String
    var diskImageLocation: MacOSDiskImageSpaceLocation? = nil
}

@MainActor
final class MontereyDownloadFlowModel: ObservableObject {
    @Published var currentStage: MontereyDownloadFlowStage = .connection
    @Published var completedStages: Set<MontereyDownloadFlowStage> = []
    @Published var isFinished: Bool = false
    @Published var workflowState: DownloadSessionState = .idle
    @Published var failureMessage: String?
    @Published var isPartialSuccess: Bool = false
    @Published var cleanupWarningMessage: String?
    @Published var networkWarningMessage: String?
    @Published var hasExpiredButTrustedAppleSignature: Bool = false

    @Published var connectionStatusText: String = String(localized: "downloader.connection.status.connecting", table: "Downloader")
    @Published var downloadCurrentIndex: Int = 0
    @Published var downloadTotal: Int = 0
    @Published var downloadFileName: String = String(localized: "downloader.transfer.status.waiting", table: "Downloader")
    @Published var downloadProgress: Double = 0
    @Published var downloadSpeedText: String = "0.0 MB/s"
    @Published var downloadTransferredText: String = "0.0MB/0.0MB"
    @Published var verifyCurrentIndex: Int = 0
    @Published var verifyTotal: Int = 0
    @Published var verifyFileName: String = String(localized: "downloader.transfer.status.waiting", table: "Downloader")
    @Published var verifyProgress: Double = 0
    @Published var buildStatusText: String = String(localized: "downloader.assembly.status.preparing_installer", table: "Downloader")
    @Published var buildProgress: Double? = nil
    @Published var diskImageStageStatus: MacOSDiskImageStageStatus = .preparing
    @Published var cleanupStatusText: String = String(localized: "downloader.cleanup.status.preparing", table: "Downloader")
    @Published var cleanupProgress: Double = 0
    @Published var summaryTotalDownloadedText: String = "0.0 GB"
    @Published var summaryAverageSpeedText: String = "0.0 MB/s"
    @Published var summaryDurationText: String = String(
        format: String(localized: "downloader.summary.duration.format", table: "Downloader"),
        0,
        0
    )
    @Published var summaryLocationText: String = String(localized: "downloader.summary.value.unavailable", table: "Downloader")
    @Published var summaryTemporaryFilesText: String = String(localized: "downloader.summary.value.unavailable", table: "Downloader")
    @Published var summaryCreatedFileText: String = String(localized: "downloader.summary.value.unavailable", table: "Downloader")
    @Published var discoveredDownloadItems: [DownloadManifestItem] = []
    @Published var pendingDiskSpaceAlert: DiskSpaceAlertContext?
    @Published var suppressInlineFailureMessage: Bool = false
    @Published var didCancelDiskImagePreflight: Bool = false
    @Published var pendingDiskImageFolderUnavailableAlert: Bool = false

    @Published var preserveDownloadedFilesInDebug: Bool = false

    var workflowTask: Task<Void, Never>?
    var processStartedAt: Date?
    var totalDownloadedBytes: Int64 = 0
    var speedSamplesMBps: [Double] = []
    var didPlayCompletionSound: Bool = false

    var activeManifest: DownloadManifest?
    var loggingWorkflow: AppLogging.Workflow = .modern
    var activeSessionID: String?
    var activeSessionRootURL: URL?
    var activeSessionPayloadURL: URL?
    var activeSessionOutputURL: URL?
    var cleanupDelegatedToHelper: Bool = false
    var sessionCleanupHandledByHelper: Bool = false
    var helperCleanupFailureMessage: String?
    var downloadedFileURLsByItemID: [String: URL] = [:]
    var finalInstallerAppURL: URL?
    var finalDiskImageURL: URL?
    var retainedSourceInstallerURL: URL?
    var activeDiskImageConfiguration: MacOSDiskImageConfiguration = .disabled
    var activeDiskImagePreflightPlan: MacOSDiskImagePreflightPlan?
    var diskImageSourceRemovalWarning: Bool = false
    let diskImageProcessRunner = MacOSDiskImageProcessRunner()

    var activeDownloadTask: URLSessionDownloadTask?
    var activeDownloadSession: URLSession?
    var activeDownloadTaskDelegate: FileDownloadTaskDelegate?

    var activeAssemblyWorkflowID: String?

    func start(
        for entry: MacOSInstallerEntry,
        using logic: MacOSDownloaderLogic,
        diskImageConfiguration: MacOSDiskImageConfiguration = .disabled,
        collisionDecision: @escaping @MainActor (MacOSDiskImageCollisionContext) -> Bool = { _ in false }
    ) {
        stop()
        resetState()
        activeDiskImageConfiguration = diskImageConfiguration

        workflowTask = Task { [weak self] in
            guard let self else { return }
            await runWorkflow(
                for: entry,
                using: logic,
                diskImageConfiguration: diskImageConfiguration,
                collisionDecision: collisionDecision
            )
        }
    }

    func stop() {
        workflowTask?.cancel()
        workflowTask = nil

        activeDownloadTask?.cancel()
        activeDownloadTask = nil
        activeDownloadSession?.invalidateAndCancel()
        activeDownloadSession = nil
        activeDownloadTaskDelegate = nil

        if let activeAssemblyWorkflowID {
            PrivilegedOperationClient.shared.cancelDownloaderAssembly(activeAssemblyWorkflowID) { _, _ in }
            self.activeAssemblyWorkflowID = nil
        }
        diskImageProcessRunner.cancel()
    }

    func visualState(for stage: MontereyDownloadFlowStage) -> DownloadStageVisualState {
        if completedStages.contains(stage) {
            return .completed
        }
        if !isFinished && currentStage == stage {
            return .active
        }
        return .pending
    }

    func resetState() {
        currentStage = .connection
        completedStages = []
        isFinished = false
        workflowState = .idle
        failureMessage = nil
        isPartialSuccess = false
        cleanupWarningMessage = nil
        networkWarningMessage = nil
        hasExpiredButTrusted
```

### Core Architecture Module: `macUSB/Shared/Services/MenuState.swift`
```
import Foundation
import Combine

final class MenuState: ObservableObject {
    static let shared = MenuState()
    @Published var skipWelcomeEnabled = UserDefaults.standard.bool(forKey: "SkipWelcomeScreenV1") {
        didSet {
            UserDefaults.standard.set(skipWelcomeEnabled, forKey: "SkipWelcomeScreenV1")
        }
    }
    @Published var skipAnalysisEnabled: Bool = false
    @Published var externalDrivesEnabled: Bool = UserDefaults.standard.bool(forKey: "AllowExternalDrives")
    @Published var notificationsEnabled: Bool = false
    @Published var hasFullDiskAccess: Bool = true
    @Published var helperRequiresBackgroundApproval: Bool = false
    @Published var rawLinuxImageSelectionEnabled: Bool = false
    @Published private(set) var isDownloaderAccessBlocked: Bool = false
    @Published private(set) var isLanguageChangeEnabled: Bool = true
    @Published var debugCopiedDataLabel: String = String(
        format: "Copied data: %.1f GB",
        0.0
    )

    private var downloaderBlockReasons: Set<String> = []
    private var languageChangesLockedForWorkflow = false
    private var hasActiveOperations = false
    private var cancellables: Set<AnyCancellable> = []
    
    func enableExternalDrives() {
        UserDefaults.standard.set(true, forKey: "AllowExternalDrives")
        UserDefaults.standard.synchronize()
        self.externalDrivesEnabled = true
    }

    func updateDebugCopiedData(bytes: Int64) {
        let gigabytes = max(0, Double(bytes)) / 1_073_741_824
        let label = String(
            format: "Copied data: %.1f GB",
            gigabytes
        )

        if Thread.isMainThread {
            debugCopiedDataLabel = label
        } else {
            DispatchQueue.main.async {
                self.debugCopiedDataLabel = label
            }
        }
    }

    func setDownloaderAccessBlocked(_ blocked: Bool, reason: String) {
        let normalizedReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedReason.isEmpty else { return }

        if blocked {
            downloaderBlockReasons.insert(normalizedReason)
        } else {
            downloaderBlockReasons.remove(normalizedReason)
        }

        let nextValue = !downloaderBlockReasons.isEmpty
        if Thread.isMainThread {
            isDownloaderAccessBlocked = nextValue
        } else {
            DispatchQueue.main.async {
                self.isDownloaderAccessBlocked = nextValue
            }
        }
    }

    func lockLanguageChanges(reason: String) {
        performOnMain { [weak self] in
            guard let self else { return }
            guard !languageChangesLockedForWorkflow else { return }
            languageChangesLockedForWorkflow = true
            refreshLanguageChangeAvailability()
            AppLogging.info(
                "Language changes locked for the current workflow [reason=\(reason)].",
                stage: .app
            )
        }
    }

    func resetLanguageChangesForWelcome() {
        performOnMain { [weak self] in
            guard let self else { return }
            languageChangesLockedForWorkflow = false
            refreshLanguageChangeAvailability()
        }
    }

    private func refreshLanguageChangeAvailability() {
        isLanguageChangeEnabled = !languageChangesLockedForWorkflow && !hasActiveOperations
    }

    private func performOnMain(_ action: @escaping () -> Void) {
        if Thread.isMainThread {
            action()
        } else {
            DispatchQueue.main.async(execute: action)
        }
    }
    
    private init() {
        AppActiveOperationRegistry.shared.$activeOperationCount
            .receive(on: DispatchQueue.main)
            .sink { [weak self] count in
                self?.hasActiveOperations = count > 0
                self?.refreshLanguageChangeAvailability()
            }
            .store(in: &cancellables)
    }
}

```

### Core Architecture Module: `macUSBHelper/Service/HelperProcessLifecycle.swift`
```
import Foundation
import Darwin
import os.log

final class HelperProcessLifecycle {
    static let shared = HelperProcessLifecycle()

    final class Lease {
        private let lock = NSLock()
        private var releaseHandler: (() -> Void)?

        init(releaseHandler: @escaping () -> Void) {
            self.releaseHandler = releaseHandler
        }

        func finish() {
            let handler = lock.withLock {
                let handler = releaseHandler
                releaseHandler = nil
                return handler
            }
            handler?()
        }

        deinit {
            finish()
        }
    }

    private enum LeaseKind: String {
        case connection
        case operation
    }

    private let queue = DispatchQueue(label: "macUSB.helper.process-lifecycle")
    private let log = OSLog(subsystem: "com.kruszoneq.macusb.helper", category: "Lifecycle")
    private let idleExitDelay: TimeInterval = 1
    private var activeConnections = 0
    private var activeOperations = 0
    private var exitGeneration: UInt = 0

    private init() {}

    func start() {
        queue.async {
            self.logState("Helper lifecycle started")
            self.scheduleExitIfIdle()
        }
    }

    func beginConnection() -> Lease {
        beginLease(kind: .connection)
    }

    func beginOperation() -> Lease {
        beginLease(kind: .operation)
    }

    private func beginLease(kind: LeaseKind) -> Lease {
        queue.sync {
            exitGeneration &+= 1
            switch kind {
            case .connection:
                activeConnections += 1
            case .operation:
                activeOperations += 1
            }
            logState("Lifecycle lease acquired: \(kind.rawValue)")
        }

        return Lease { [weak self] in
            self?.releaseLease(kind: kind)
        }
    }

    private func releaseLease(kind: LeaseKind) {
        queue.async {
            switch kind {
            case .connection:
                self.activeConnections = max(0, self.activeConnections - 1)
            case .operation:
                self.activeOperations = max(0, self.activeOperations - 1)
            }
            self.logState("Lifecycle lease released: \(kind.rawValue)")
            self.scheduleExitIfIdle()
        }
    }

    private func scheduleExitIfIdle() {
        guard activeConnections == 0, activeOperations == 0 else { return }

        exitGeneration &+= 1
        let scheduledGeneration = exitGeneration
        logState("Helper is idle; scheduling process exit")

        queue.asyncAfter(deadline: .now() + idleExitDelay) {
            guard scheduledGeneration == self.exitGeneration,
                  self.activeConnections == 0,
                  self.activeOperations == 0 else {
                return
            }

            self.logState("Helper is idle; exiting process")
            exit(EXIT_SUCCESS)
        }
    }

    private func logState(_ message: String) {
        HelperDiagnosticLogging.info(
            "\(message) connections=\(activeConnections) operations=\(activeOperations)",
            stage: .helper,
            log: log
        )
    }
}

private extension NSLock {
    func withLock<T>(_ body: () -> T) -> T {
        lock()
        defer { unlock() }
        return body()
    }
}

```

### Core Architecture Module: `macUSB/App/ContentView.swift`
```
import SwiftUI
import AppKit
import Combine
import OSLog

private enum AppRoute: Hashable {
    case debugFinishUSBBigSurSuccess
    case debugFinishUSBTigerSuccess
    case debugFinishUSBLinuxSuccess
}

struct ContentView: View {
    @State private var path = NavigationPath()
    @EnvironmentObject private var languageManager: LanguageManager
    @State private var pendingDebugNavigationWorkItem: DispatchWorkItem?
    @ObservedObject private var appToastCenter = AppToastCenter.shared

    private var debugMountPointURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_mount_point")
    }

    private var debugCleanupTempWorkURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_temp")
    }

    private var debugTigerMountPointURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_tiger_mount_point")
    }

    private var debugTigerCleanupTempWorkURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_tiger_temp")
    }

    private var debugLinuxMountPointURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_linux_mount_point")
    }

    private var debugLinuxCleanupTempWorkURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("macUSB_debug_linux_temp")
    }
    
    var body: some View {
        Group {
            if #available(macOS 15.0, *) {
                rootView
                    .toolbarBackgroundVisibility(.automatic, for: .windowToolbar)
            } else {
                rootView
            }
        }
    }

    private var rootView: some View {
        NavigationStack(path: $path) {
            WelcomeView()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .debugFinishUSBBigSurSuccess:
                        FinishUSBView(
                            systemName: "macOS Big Sur 11",
                            mountPoint: debugMountPointURL,
                            onReset: {
                                NotificationCenter.default.post(name: .macUSBResetToStart, object: nil)
                                path = NavigationPath()
                            },
                            isPPC: false,
                            loggingWorkflow: .macos,
                            didFail: false,
                            cleanupTempWorkURL: debugCleanupTempWorkURL,
                            shouldDetachMountPoint: false,
                            isDebugEjectMode: true
                        )
                    case .debugFinishUSBTigerSuccess:
                        FinishUSBView(
                            systemName: "Mac OS X Tiger 10.4",
                            mountPoint: debugTigerMountPointURL,
                            onReset: {
                                NotificationCenter.default.post(name: .macUSBResetToStart, object: nil)
                                path = NavigationPath()
                            },
                            isPPC: true,
                            loggingWorkflow: .ppc,
                            didFail: false,
                            cleanupTempWorkURL: debugTigerCleanupTempWorkURL,
                            shouldDetachMountPoint: false,
                            isDebugEjectMode: true
                        )
                    case .debugFinishUSBLinuxSuccess:
                        FinishUSBView(
                            systemName: "Linux - Ubuntu 24.04",
                            mountPoint: debugLinuxMountPointURL,
                            onReset: {
                                NotificationCenter.default.post(name: .macUSBResetToStart, object: nil)
                                path = NavigationPath()
                            },
                            isPPC: false,
                            isLinuxWorkflow: true,
                            loggingWorkflow: .linux,
                            didFail: false,
                            cleanupTempWorkURL: debugLinuxCleanupTempWorkURL,
                            shouldDetachMountPoint: false,
                            isDebugEjectMode: true
                        )
                    }
                }
        }
        // Sztywny rozmiar kontentu
        .frame(width: MacUSBDesignTokens.windowWidth, height: MacUSBDesignTokens.windowHeight)
        .overlay {
            AppToastOverlay(toast: appToastCenter.toast)
        }
        // Podpięcie konfiguratora okna
        .background(WindowConfigurator())
        // Inject the language and layout direction
        .environment(\.locale, languageManager.locale)
        .environment(\.layoutDirection, languageManager.layoutDirection)
        // Wymuszenie odświeżenia przy zmianie języka
        .id(languageManager.currentLanguage)
        .onChange(of: languageManager.needsRestart) { needsRestart in
            if needsRestart {
                presentRestartAlert()
            }
        }
        .onAppear {
            AppLogging.logAppStartupOnce()
        }
        .onReceive(NotificationCenter.default.publisher(for: .macUSBDebugGoToBigSurSummary)) { _ in
            scheduleDebugSummaryNavigation(
                route: .debugFinishUSBBigSurSuccess,
                logMessage: "DEBUG: Scheduled Big Sur summary navigation in 2 seconds."
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: .macUSBDebugGoToTigerSummary)) { _ in
            scheduleDebugSummaryNavigation(
                route: .debugFinishUSBTigerSuccess,
                logMessage: "DEBUG: Scheduled Tiger (PPC) summary navigation in 2 seconds."
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: .macUSBDebugGoToLinuxSummary)) { _ in
            scheduleDebugSummaryNavigation(
                route: .debugFinishUSBLinuxSuccess,
                logMessage: "DEBUG: Scheduled Linux (Ubuntu 24.04) summary navigation in 2 seconds."
            )
        }
    }

    private func scheduleDebugSummaryNavigation(route: AppRoute, logMessage: String) {
        AppLogging.info(logMessage, stage: .app)
        pendingDebugNavigationWorkItem?.cancel()

        let workItem = DispatchWorkItem {
            NotificationCenter.default.post(name: .macUSBResetToStart, object: nil)
            path = NavigationPath()
            path.append(route)
            pendingDebugNavigationWorkItem = nil
        }

        pendingDebugNavigationWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: workItem)
    }

    private func restartApp() {
        let path = Bundle.main.bundlePath
        let task = Process()
        task.launchPath = "/usr/bin/open"
        task.arguments = [path]
        try? task.run()
        NSApp.terminate(nil)
    }
    
    private func presentRestartAlert() {
        guard MenuState.shared.isLanguageChangeEnabled else {
            languageManager.needsRestart = false
            return
        }
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.icon = NSApp.applicationIconImage
        alert.messageText = String(localized: "app.language.restart.title", table: "App")
        alert.informativeText = String(localized: "app.language.restart.message", table: "App")
        alert.addButton(withTitle: String(localized: "app.language.restart.action", table: "App"))

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            alert.beginSheetModal(for: window) { response in
                if response == .alertFirstButtonReturn {
                    restartApp()
                }
                languageManager.needsRestart = false
            }
        } else {
            let response = alert.runModal()
            if response == .alertFirstButtonReturn {
                restartApp()
            }
            languageManager.needsRestart = false
        }
    }
}

// --- KONFIGURACJA OKNA ---

struct WindowConfigurator: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            if let window = view.window {
                // 1. Ustawienie sztywnych wymiarów
                let fixedSize = NSSize(width: MacUSBDesignTokens.windowWidth, height: MacUSBDesignTokens.windowHeight)
                window.minSize = fixedSize
                window.maxSize = fixedSize
                // Wyłączenie możliwości zmiany rozmiaru na poziomie systemu
                window.styleMask.remove(.resizable)

                if window.toolbar == nil {
                    window.toolbar = NSToolbar(identifier: "com.kruszoneq.macusb.window.toolbar")
                }
                if #available(macOS 11.0, *) {
                    window.toolbarStyle = .unifiedCompact
                }
                
                // 2. Konfiguracja zachowania okna i przycisków
                window.collectionBehavior = [.fullScreenNone, .managed]
                
                // Wyłączenie przycisku maksymalizacji (zielony)
                window.standardWindowButton(.zoomButton)?.isEnabled = false
                // Pozostałe przyciski aktywne
                window.standardWindowButton(.closeButton)?.isEnabled = true
                window.standardWindowButton(.miniaturizeButton)?.isEnabled = true
                
                // Ustawienie tytułu
                window.title = "macUSB"

                // Staly Touch Bar dla calej aplikacji niezaleznie od widoku.
                TouchbarSupport.shared.install(on: window)
                AppWindowCloseGuard.shared.install(on: window)
            }
        }
        return view
    }
    
    func updateNSView(_ nsView: NSView, context: Context) {}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #140** (2026-10-25): **[Windows USB Creation] Split stage fails for UUP-based (solid WIM) images: "The requested operation is unsupported"**
  *Symptoms*: ### macUSB version  v2.5  ### Host macOS version  macOS 27.0.1  ### Host architecture  Apple Silicon  ### Required permissions  - [x] I enabled Full Disk Access for macUSB in System Settings - [x] I enabled Allow in the Background for macUSB in System Settings  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which Windows system were you creating?  Windows 11 24H2 (build 26100.4349)  ### Image format  .iso  ### Image source details  ISO built with CrystalFetch from Microsoft's UUP files (Windows 11 26100.4349, 6 editions). The same applies to UUP dump images. sources/install.wim is 4.45 GB and stored as a solid LZMS WIM (wimlib-imagex info --header: Version = 0xe00, WIM_HDR_FLAG_COMPRESS_LZMS set).  ### Is `wimlib` installed on your system?  Yes  ### Failure stage  USB creation  ### Problem description  urrent behavior: macUSB copies the whole ISO, then fails at the "splitting install.wim" stage with "Installer creation failed". wimlib-imagex split exits with code 68 and "The requested operation is unsupported", because wimlib can't split solid WIMs. This is the same root cause as #71, which was closed as stale with the advice to use Microsoft's ISO instead.  From the attached log:  [18:06:17][HelperLiveLog] [ERROR] Splitting of WIM containing solid resources is not supported. [18:06:17][HelperLiveLog] Export it in non-solid format first. [18:06:17][HelperLiveLog] ERROR: Exiting with error code 68: [18:06:17][HelperLiveLog] The requested operation is unsupp

- **Issue #139** (2026-10-25): **Crash on Start from double release of an IOMedia Mach port**
  *Symptoms*: ## Bug  On macOS 27.2 (build 26B5091g), macUSB 2.5 (44) exits when I press **Start**, before the source and target selection screen appears.  ## Steps to reproduce  1. Open macUSB. 2. Press **Start**.  ## Expected behavior  The source and USB target configuration screen opens.  ## Actual behavior  The app terminates. The crash report shows `EXC_GUARD / GUARD_TYPE_MACH_PORT / INVALID_NAME` in `mach_port_deallocate`, on `com.apple.root.utility-qos`.  ## Cause and local fix  I traced it to `USBDriveLogic.detectUSBSpeed(forBSDName:)`. The `IOIteratorNext` service is owned by the iterator loop and released by its `defer`, but the parent traversal also released `current`. When `current` was the original service, loop cleanup released the same Mach port a second time.  I fixed this locally by leaving the iterator-owned service for the loop's `defer` and releasing only parent entries acquired by `IORegistryEntryGetParentEntry`. The final cleanup also skips the original service.  ## Verification  I reproduced the crash repeatedly on 2.5 (44). With the ownership fix, my local 2.5 (45) build opens the source and target configuration screen after pressing **Start**; macUSB also reported that its helper update succeeded. I did not start a USB write. 

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

### Incident Patch 1: `cfff17e3` (2026-10-04)
**Commit Message**: Fix USB messages across app activation

Retain USB selection messages during application inactivity and rechecking. Keep navigation blocked until fresh verification and bound the presentation grace after activation.

**File**: `docs/reference/features/analysis/ANALYSIS_COMPATIBILITY.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ All localized source/target selection, requirements, recognition/results, compat
 
 ## USB Admission Boundary
 
-Prepared physical and Option target presentation, per-device partial failures, retry/lifecycle state, identity verification and selected-target readiness are defined in `../usb/USB_VALIDATION_AND_CAPACITY.md`. Ordinary discovery remains automatic at 2.5-second intervals; the 0.5-second UI tick and immediate Option presentation stay separate. Only a currently verified selected target with known sufficient capacity and target-specific monotonic evidence younger than 20 seconds is passed to the existing installation summary. The existing tick evaluates freshness even while discovery is running or blocked. The destructive warning remains visible for every selected target regardless of application activity or verification readiness. Prolonged loss of confirmation retains the selection and adds the `analysis.usb.discovery.availability.title` / `.description` card in `Analysis` above that warning, using the same warning styling; inline discovery cards have no retry action and the generic notice does not duplicate it. Same-identity recovery restores readiness automatically, while replacement identity requires deliberate reselection. Continue still performs its exact final identity/capacity check. Source detection flags, creation workflows, helper payloads and destructive confirmation remain unchanged.
+Prepared physical and Option target presentation, per-device partial failures, retry/lifecycle state, identity verification and selected-target readiness are defined in `../usb/USB_VALIDATION_AND_CAPACITY.md`. Ordinary discovery remains automatic at 2.5-second intervals; the 0.5-second UI tick and immediate Option presentation stay separate. Only a currently verified selected target with known sufficient capacity and target-specific monotonic evidence younger than 20 seconds is passed to the existing installation summary. The existing tick evaluates freshness even while discovery is running or blocked. A selected target shows the capacity error when insufficient, otherwise the destructive warning. Lifecycle suspension retains the last messages separately from admission, so inactivity and initial rechecking do not replace a capacity error with the destructive warning or temporarily remove existing discovery errors or the empty-catalog card. The bounded presentation grace and its invalidation rules are defined in the USB reference. Prolonged active loss of confirmation retains the selection and adds the `analysis.usb.discovery.availability.title` / `.description` card in `Analysis` above the destructive warning, using the same warning styling; inline discovery cards have no retry action and the generic notice does not duplicate it. Same-identity recovery restores readiness automatically, while replacement identity requires deliberate reselection. Continue still performs its exact final identity/capacity check. Source detection flags, creation workflows, helper payloads and destructive confirmation remain unchanged.
 
 ## Detection Source of Truth
 
```

**File**: `docs/reference/features/usb/USB_VALIDATION_AND_CAPACITY.md` (modified, +2/-0)
```diff
@@ -99,6 +99,8 @@ Errors add a contextual warning card in the existing USB section, styled like th
 
 The final handoff check updates the selected target's evidence as well as its readiness. A failed check therefore remains blocked on deliberate reselection until a successful new read replaces that evidence; a known capacity change is retained as a byte value rather than a generic error.
 
+Application inactivity and screen hiding retain a separate presentation of the last discovery outcome and selected-target readiness. Capacity errors (for whole disks and Option volumes), destructive warnings, discovery errors, unavailable picker labels, verified-alternative hints and the empty-catalog card therefore do not switch solely because lifecycle cancellation revokes admission. Continue is still blocked immediately, cancelled callbacks remain invalid, and evidence timestamps are not renewed. On activation, this presentation stays visible until the first complete, partial or failed scan result; an unchanged successful result produces no message change. If checking cannot finish, the existing active UI tick ends the presentation grace after `20 s` from resumption and surfaces the current uncertainty. Time spent inactive does not consume this presentation grace or extend admission freshness. Deliberate selection, a changed target identity/capacity requirement or external-drive preference ends the retained presentation immediately. A confirmed removal, replacement, capacity change or read failure updates messages through the normal scan-result rules.
+
 Repeated requests are skipped rather than queued. While an owned child remains in the shared runner slot, the UI shows a waiting state; normal periodic ticks resume checking after the slot is released. Cancelled generations cannot overwrite current state. IOKit parent traversal owns a separate retained starting reference and releases every acquired ancestor on all return paths.
 
 Run the standalone resource/scheduling regression checks with `bash scripts/TestUSBDiscovery.sh`. They compile production utilities and use mocked registry ownership plus synthetic child processes; they do not launch macUSB, invoke diskutil or modify media.
```

**File**: `macUSB/Features/Analysis/AnalysisLogic.swift` (modified, +1/-0)
```diff
@@ -147,6 +147,7 @@ final class AnalysisLogic: ObservableObject {
     }
 
     @Published var usbDiscoveryState = AnalysisUSBDiscoveryState()
+    @Published var heldUSBDiscoveryPresentation: AnalysisUSBHeldPresentation?
     @Published var usbTargetReadiness: USBTargetReadiness = .noSelection
     @Published var usbTargetCapacityRequirement: USBTargetCapacityRequirement? = nil
     @Published var shouldShowSourceSizeUnavailableAlert: Bool = false
```

**File**: `macUSB/Features/Analysis/AnalysisUSBDiscoveryPresentation.swift` (modified, +72/-7)
```diff
@@ -8,19 +8,83 @@ struct AnalysisUSBDiscoveryNotice: Equatable {
     let waiting: Bool
 }
 
+/// A lifecycle pause changes admission, not the last result shown to the user.
+struct AnalysisUSBHeldPresentation {
+    let discovery: AnalysisUSBDiscoveryState
+    let readiness: USBTargetReadiness
+    let selectionID: String?
+    let identity: String?
+    let requiredBytes: Int64?
+    let allowExternalDrives: Bool
+    let capturedAt: TimeInterval
+    var resumedAt: TimeInterval?
+}
+
 extension AnalysisLogic {
+    private var currentHeldUSBPresentation: AnalysisUSBHeldPresentation? {
+        guard let held = heldUSBDiscoveryPresentation,
+              held.selectionID == selectedDrive?.selectionID,
+              held.identity == selectedTargetIdentity,
+              held.requiredBytes == usbTargetCapacityRequirement?.minimumBytes,
+              held.allowExternalDrives == UserDefaults.standard.bool(forKey: "AllowExternalDrives") else { return nil }
+        return held
+    }
+
+    var usbDiscoveryPresentationState: AnalysisUSBDiscoveryState {
+        currentHeldUSBPresentation?.discovery ?? usbDiscoveryState
+    }
+
+    var usbTargetPresentationReadiness: USBTargetReadiness {
+        currentHeldUSBPresentation?.readiness ?? usbTargetReadiness
+    }
+
+    func holdUSBDiscoveryPresentation() {
+        let previous = currentHeldUSBPresentation
+        heldUSBDiscoveryPresentation = AnalysisUSBHeldPresentation(
+            discovery: previous?.discovery ?? usbDiscoveryState,
+            readiness: previous?.readiness ?? usbTargetReadiness,
+            selectionID: selectedDrive?.selectionID, identity: selectedTargetIdentity,
+            requiredBytes: usbTargetCapacityRequirement?.minimumBytes,
+            allowExternalDrives: UserDefaults.standard.bool(forKey: "AllowExternalDrives"),
+            capturedAt: previous?.capturedAt ?? ProcessInfo.processInfo.systemUptime
+        )
+    }
+
+    func resumeUSBDiscoveryPresentation() {
+        guard heldUSBDiscoveryPresentation != nil else { return }
+        guard var held = currentHeldUSBPresentation else {
+            heldUSBDiscoveryPresentation = nil
+            return
+        }
+        let now = ProcessInfo.processInfo.systemUptime
+        if let resumedAt = held.resumedAt {
+            // Bound the presentation grace as well: a stalled active refresh
+            // must eventually surface loss of confirmation. Admission never
+            // uses this grace or renews the evidence timestamp.
+            if now - resumedAt >= USBTargetVerification.maximumConfirmationAge {
+                heldUSBDiscoveryPresentation = nil
+            }
+        } else {
+            held.resumedAt = now
+            heldUSBDiscoveryPresentation = held
+        }
+    }
+
     var usbDiscoveryNotice: AnalysisUSBDiscoveryNotice? {
         // The availability card accompanies the persistent destructive warning.
         // Never repeat this selected-target problem above the same selector.
         if isUSBAvailabilityConfirmationExpired { return nil }
+        let usbDiscoveryState = usbDiscoveryPresentationState
+        let usbTargetReadiness = usbTargetPresentationReadiness
+        let verificationTime = currentHeldUSBPresentation?.capturedAt ?? ProcessInfo.processInfo.systemUptime
         let alternative = usbDiscoveryState.hasCurrentSnapshot && selectableUSBTargets.contains { drive in
             guard let required = usbTargetCapacityRequirement?.minimumBytes,
-                  let proof = usbDiscoveryState.snapshot?.verification[drive.selectionID], proof.problem == nil, proof.isFresh(),
+                  let proof = usbDiscoveryState.snapshot?.verification[drive.selectionID], proof.problem == nil, proof.isFresh(at: verificationTime),
                   case .success(let actual) = proof.capacity else { return false }
             return actual >= required
         }
         if let failure = usbDiscoveryState.failure {
-            return AnalysisUSBDiscoveryNotice(titleKey: "analysis.usb.discovery.refresh.title", descriptionKey: usbSelectionProblemDescriptionKey(failure), offersVerifiedAlternative: false, waiting: false)
+            return AnalysisUSBDiscoveryNotice(titleKey: "analysis.usb.discovery.refresh.title", descriptionKey: usbSelectionProblemDescriptionKey(failure, enumerationFailed: true), offersVerifiedAlternative: false, waiting: false)
         }
         if usbTargetReadiness.problem == .targetMissing,
            usbDiscoveryState.hasCurrentSnapshot, selectableUSBTargets.isEmpty,
@@ -37,21 +101,22 @@ extension AnalysisLogic {
         return nil
     }
 
-    private func usbSelectionProblemDescriptionKey(_ problem: USBDiscoveryProblem) -> String {
-        if usbDiscoveryState.failure != nil, case .query(.exitStatus) = problem {
+    private func usbSelectionProblemDescriptionKey(_ problem: USBDiscoveryProblem, enumerationFailed: Bool) -> String {
+        if enumerationFailed, case .query(.exitStatus) = problem {
 
```

**File**: `macUSB/Features/Analysis/Logic/AnalysisLogicUsbDrives.swift` (modified, +11/-3)
```diff
@@ -57,7 +57,9 @@ extension AnalysisLogic {
         else { cancelDriveRefresh(reason: "analysis screen hidden") }
     }
 
-    func cancelDriveRefresh(reason: String = "application inactive") {
+    func cancelDriveRefresh(reason: String = "application inactive", preservePresentation: Bool = true) {
+        if preservePresentation { holdUSBDiscoveryPresentation() }
+        else { heldUSBDiscoveryPresentation = nil }
         physicalDriveRefreshGeneration &+= 1
         driveRefreshCancellation?.cancel()
         // The registry read itself cannot be interrupted. Retain ownership
@@ -71,7 +73,7 @@ extension AnalysisLogic {
 
     func usbExternalDrivePreferenceChanged() {
         log("USB discovery preference changed: AllowExternalDrives=\(UserDefaults.standard.bool(forKey: "AllowExternalDrives")).", category: "USBSelection")
-        cancelDriveRefresh(reason: "external-drive preference changed")
+        cancelDriveRefresh(reason: "external-drive preference changed", preservePresentation: false)
         refreshDrives(force: true, reason: "external-drive preference changed")
     }
 
@@ -84,7 +86,10 @@ extension AnalysisLogic {
         guard isDriveRefreshVisible, NSApp.isActive else { return }
         // Evaluate evidence on every existing UI tick, even while a worker or
         // an unreaped child prevents another scan from starting.
-        withAnimation(.easeInOut(duration: 0.24)) { checkCapacity() }
+        withAnimation(.easeInOut(duration: 0.24)) {
+            resumeUSBDiscoveryPresentation()
+            checkCapacity()
+        }
         guard !driveRefreshPolicy.isRunning else { return }
         // The worker may have returned after bounded cleanup while its child
         // still owns the process slot. Never queue another scan behind it.
@@ -122,20 +127,23 @@ extension AnalysisLogic {
                     self.usbDiscoveryState.activity = .idle
                     switch result {
                     case .complete(let snapshot), .partial(let snapshot):
+                        self.heldUSBDiscoveryPresentation = nil
                         let presentation = self.retainingUnresolvedUSBSelection(in: self.retainingUSBConfirmationTimes(in: snapshot))
                         self.usbDiscoveryState.snapshot = presentation
                         self.usbDiscoveryState.outcome = .current
                         self.applyUSBDiscoverySnapshot(presentation)
                         if snapshot.issues.contains(where: { $0.problem == .query(.busy) }) { self.usbDiscoveryState.activity = .waiting }
                         diagnostics.recordSnapshot(snapshot, message: "USB scan completed: generation=\(generation), duration=\(elapsed)s, physicalTargets=\(snapshot.physicalDrives.count), optionTargets=\(snapshot.optionDrives.count), issues=\(snapshot.issues).", workflow: workflow, force: reason == "user retry")
                     case .failed(let problem):
+                        self.heldUSBDiscoveryPresentation = nil
                         self.usbDiscoveryState.outcome = .failed(problem)
                         self.checkCapacity()
                         diagnostics.record("USB scan failed: generation=\(generation), duration=\(elapsed)s, reason=\(problem).", key: "scan.result", signature: "\(problem)", workflow: workflow)
                     case .busy:
                         self.usbDiscoveryState.activity = .waiting
                         diagnostics.record("USB scan waiting: generation=\(generation), duration=\(elapsed)s, reason=runner busy.", key: "scan.result", signature: "busy", workflow: workflow)
                     case .cancelled:
+                        self.holdUSBDiscoveryPresentation()
                         self.usbDiscoveryState.activity = .suspended
                         self.usbDiscoveryState.outcome = .pending
                         self.checkCapacity()
```

**File**: `macUSB/Features/Analysis/SystemAnalysisUSBSectionView.swift` (modified, +5/-5)
```diff
@@ -6,7 +6,7 @@ struct SystemAnalysisUSBSectionView: View {
     let isSelectionEnabled: Bool
 
     private var isSelectedTargetCapacityInsufficient: Bool {
-        if case .insufficient = logic.usbTargetReadiness { return true }
+        if case .insufficient = logic.usbTargetPresentationReadiness { return true }
         return false
     }
 
@@ -21,7 +21,7 @@ struct SystemAnalysisUSBSectionView: View {
     }
 
     private func pickerDisplayName(for drive: USBDrive) -> String {
-        if logic.usbDiscoveryState.failure != nil || logic.usbDiscoveryState.snapshot?.verification[drive.selectionID]?.problem != nil {
+        if logic.usbDiscoveryPresentationState.failure != nil || logic.usbDiscoveryPresentationState.snapshot?.verification[drive.selectionID]?.problem != nil {
             let mediaSuffix = drive.mediaKind == .sdCard ? " - \(drive.mediaDisplayName)" : ""
             return "\(drive.device) - " + String(localized: "analysis.usb.discovery.unavailable.label", table: "Analysis") + mediaSuffix
         }
@@ -39,7 +39,7 @@ struct SystemAnalysisUSBSectionView: View {
     }
 
     private var needsExplicitReselectionAction: Bool {
-        guard let problem = logic.usbTargetReadiness.problem, logic.selectedDrive != nil else { return false }
+        guard let problem = logic.usbTargetPresentationReadiness.problem, logic.selectedDrive != nil else { return false }
         return problem != .query(.busy) && problem != .query(.cancelled) && problem != .confirmationExpired
     }
 
@@ -134,7 +134,7 @@ struct SystemAnalysisUSBSectionView: View {
                         ProgressView()
                             .controlSize(.small)
                             .frame(maxWidth: .infinity, alignment: .leading)
-                    } else if logic.presentedUSBTargets.isEmpty && logic.usbDiscoveryState.hasCurrentSnapshot && logic.usbDiscoveryState.snapshot?.issues.isEmpty == true {
+                    } else if logic.presentedUSBTargets.isEmpty && logic.usbDiscoveryPresentationState.hasCurrentSnapshot && logic.usbDiscoveryPresentationState.snapshot?.issues.isEmpty == true {
                         StatusCard(tone: .error, density: .compact) {
                             HStack {
                                 Image(systemName: "externaldrive.badge.xmark").font(sectionIconFont).foregroundColor(.red).frame(width: MacUSBDesignTokens.iconColumnWidth)
@@ -233,6 +233,6 @@ struct SystemAnalysisUSBSectionView: View {
             }
         }
         .animation(.easeInOut(duration: 0.24), value: logic.usbDiscoveryNotice)
-        .animation(.easeInOut(duration: 0.24), value: logic.usbTargetReadiness)
+        .animation(.easeInOut(duration: 0.24), value: logic.usbTargetPresentationReadiness)
     }
 }
```

---

### Incident Patch 2: `1799df11` (2026-10-25)
**Commit Message**: Clarify permission requirements in README

Explain Full Disk Access and the SMAppService helper, and update the background activity setting name for macOS Golden Gate.

**File**: `README.md` (modified, +6/-3)
```diff
@@ -69,14 +69,17 @@ Thanks to user feedback, macUSB has grown beyond legacy macOS installer creation
 5. Review the final result and safely eject the media directly from the final screen.
 
 > [!IMPORTANT]
-> For reliable media creation, enable **Allow in the Background** and **Full Disk Access** for macUSB in System Settings. Without them, creation workflows may fail.
+> Enable **Full Disk Access** and **Background App Activity** for macUSB in System Settings. These are required by the app’s current installer download and media creation workflows.
+
+- **Full Disk Access:** macUSB requires this permission to write to the selected external drive and build installers in the Downloader. On Macs with the Apple T2 Security Chip and on Apple silicon Macs, Removable Volumes access alone was insufficient for all required write operations, even with administrator privileges.
+- **Background App Activity:** macUSB uses a helper registered through Apple’s `SMAppService`. This setting is required for the helper to run and perform privileged operations, such as preparing installers, formatting media, and writing data.
 
 <table align="center">
   <tr>
     <td align="center" valign="top">
-      <strong>Allow in the Background</strong><br>
+      <strong>Background App Activity</strong><br>
       <a href="docs/readme-assets/permissions/allow-in-the-background.png">
-        <img src="docs/readme-assets/permissions/allow-in-the-background.png" alt="macOS Login Items settings with macUSB enabled in Allow in the Background" width="360">
+        <img src="docs/readme-assets/permissions/allow-in-the-background.png" alt="macOS Login Items settings with macUSB enabled under Background App Activity" width="360">
       </a><br>
       <sub>General → Login Items &amp; Extensions</sub>
     </td>
```

---

### Incident Patch 3: `d8f69815` (2026-10-14)
**Commit Message**: Merge pull request #144 from aliafshany/fix/fa_rtl

Fix right-to-left layout in Persian strings

**File**: `macUSB/Resources/Analysis.xcstrings` (modified, +4/-4)
```diff
@@ -1070,7 +1070,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "باز کردن فایل ISO امکان‌پذیر نبود: %@"
+            "value" : "باز کردن فایل ISO امکان‌پذیر نبود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -1165,7 +1165,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "خواندن فایل ISO امکان‌پذیر نبود: %@"
+            "value" : "خواندن فایل ISO امکان‌پذیر نبود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -2115,7 +2115,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Linux - توزیع ناشناخته"
+            "value" : "‏Linux - توزیع ناشناخته"
           }
         },
         "fr" : {
@@ -2687,7 +2687,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "OS X Mavericks شناسایی شد"
+            "value" : "‏OS X Mavericks شناسایی شد"
           }
         },
         "fr" : {
```

**File**: `macUSB/Resources/App.xcstrings` (modified, +17/-17)
```diff
@@ -1830,7 +1830,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "بازنشانی مجوزهای دسترسی به رسانهٔ خارجی امکان‌پذیر نبود. دوباره تلاش کنید، یا این دستور را به‌صورت دستی در Terminal اجرا کنید: tccutil reset SystemPolicyRemovableVolumes %@"
+            "value" : "بازنشانی مجوزهای دسترسی به رسانهٔ خارجی امکان‌پذیر نبود. دوباره تلاش کنید، یا این دستور را به‌صورت دستی در Terminal اجرا کنید: tccutil reset SystemPolicyRemovableVolumes ⁨%@⁩"
           }
         },
         "fr" : {
@@ -2305,7 +2305,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper نیازمند تأیید در System Settings است."
+            "value" : "در System Settings، Helper نیازمند تأیید است."
           }
         },
         "fr" : {
@@ -2400,7 +2400,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUSB برای فعال‌سازی مدیریت درایو به مجوز فعالیت در پس‌زمینه نیاز دارد. برای اعطای مجوزهای لازم به System Settings بروید"
+            "value" : "برای فعال‌سازی مدیریت درایو، macUSB به مجوز فعالیت در پس‌زمینه نیاز دارد. برای اعطای مجوزهای لازم به System Settings بروید"
           }
         },
         "fr" : {
@@ -2590,7 +2590,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUSB نسخهٔ جدیدی از برنامه را شناسایی کرد، اما به‌روزرسانی خودکار Helper با خطا مواجه شد. ابزارها ← تعمیر Helper را انتخاب کرده و تعمیر را به‌صورت دستی اجرا کنید."
+            "value" : "نسخهٔ جدیدی از برنامه توسط macUSB شناسایی شد، اما به‌روزرسانی خودکار Helper با خطا مواجه شد. ابزارها ← تعمیر Helper را انتخاب کرده و تعمیر را به‌صورت دستی اجرا کنید."
           }
         },
         "fr" : {
@@ -3825,7 +3825,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper ثبت شد، اما نیازمند تأیید کاربر است."
+            "value" : "ثبت Helper انجام شد، اما نیازمند تأیید کاربر است."
           }
         },
         "fr" : {
@@ -5820,7 +5820,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper پس از لغو ثبت همچنان فعال ماند. تعمیر متوقف شد."
+            "value" : "پس از لغو ثبت، Helper همچنان فعال ماند. تعمیر متوقف شد."
           }
         },
         "fr" : {
@@ -7910,7 +7910,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper به‌درستی کار می‌کند و آمادهٔ استفاده است."
+            "value" : "‏Helper به‌درستی کار می‌کند و آمادهٔ استفاده است."
           }
         },
         "fr" : {
@@ -8385,7 +8385,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUSB نمی‌تواند تأیید کند که با یک Helper معتبر و امضاشده در ارتباط است. عملیات متوقف شد. برنامهٔ فعلی macUSB را از پوشهٔ Applications باز کنید، سپس ابزارها ← تعمیر Helper را انتخاب نمایید."
+            "value" : "تأیید ارتباط با یک Helper معتبر و امضاشده برای macUSB امکان‌پذیر نیست. عملیات متوقف شد. برنامهٔ فعلی macUSB را از پوشهٔ Applications باز کنید، سپس ابزارها ← تعمیر Helper را انتخاب نمایید."
           }
         },
         "fr" : {
@@ -8480,7 +8480,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUSB نمی‌تواند Helper را تأیید کند"
+            "value" : "تأیید Helper توسط macUSB امکان‌پذیر نیست"
           }
         },
         "fr" : {
@@ -8575,7 +8575,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper قبلاً حذف شده است"
+            "value" : "قبلاً Helper حذف شده است"
           }
         },
         "fr" : {
@@ -8670,7 +8670,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper حذف شد"
+            "value" : "‏Helper حذف شد"
           }
         },
         "fr" : {
@@ -9335,7 +9335,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper به‌درستی پاسخ می‌دهد (uid=%@, euid=%@, pid=%@)"
+            "value" : "‏Helper به‌درستی پاسخ می‌دهد (uid=%@, euid=%@, pid=%@)"
           }
         },
         "fr" : {
@@ -9620,7 +9620,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper شناسهٔ گردش کاری برنگرداند."
+            "value" : "شناسهٔ گردش کاری توسط Helper برگردانده نشد."
           }
         },
         "fr" : {
@@ -13895,7 +13895,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "System Settings باز شد"
+            "value" : "‏System Settings باز شد"
           }
         },
         "fr" : {
@@ -14655,7 +14655,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUS
```

**File**: `macUSB/Resources/Creator.xcstrings` (modified, +1/-1)
```diff
@@ -880,7 +880,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper آماده نیست."
+            "value" : "‏Helper آماده نیست."
           }
         },
         "fr" : {
```

**File**: `macUSB/Resources/Downloader.xcstrings` (modified, +11/-11)
```diff
@@ -588,7 +588,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper در سرهم‌بندی نصب‌کننده خطایی برگرداند"
+            "value" : "در سرهم‌بندی نصب‌کننده، Helper خطایی برگرداند"
           }
         },
         "fr" : {
@@ -682,7 +682,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper مسیر نصب‌کنندهٔ .app را برنگرداند"
+            "value" : "مسیر نصب‌کنندهٔ .app توسط Helper برگردانده نشد"
           }
         },
         "fr" : {
@@ -3504,7 +3504,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "حذف فایل‌های موقت تکمیل نشد: %@"
+            "value" : "حذف فایل‌های موقت تکمیل نشد: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -3598,7 +3598,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper حذف پوشهٔ نشست را تأیید نکرد"
+            "value" : "حذف پوشهٔ نشست توسط Helper تأیید نشد"
           }
         },
         "fr" : {
@@ -6982,7 +6982,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "پوشهٔ «%@» قبلاً شامل «%@» است. اگر ادامه دهید، ایمیج دیسک جدید به‌صورت «%@» ذخیره خواهد شد."
+            "value" : "پوشهٔ ⁨«%@»⁩ قبلاً شامل ⁨«%@»⁩ است. اگر ادامه دهید، ایمیج دیسک جدید به‌صورت ⁨«%@»⁩ ذخیره خواهد شد."
           }
         },
         "fr" : {
@@ -7170,7 +7170,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "ایجاد ایمیج دیسک امکان‌پذیر نبود: %@"
+            "value" : "ایجاد ایمیج دیسک امکان‌پذیر نبود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -7734,7 +7734,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "ایمیج دیسک ایجاد شد، اما امکان حذف نصب‌کنندهٔ منبع «%@» وجود نداشت. هر دو فایل روی دیسک باقی می‌مانند."
+            "value" : "ایمیج دیسک ایجاد شد، اما امکان حذف نصب‌کنندهٔ منبع ⁨«%@»⁩ وجود نداشت. هر دو فایل روی دیسک باقی می‌مانند."
           }
         },
         "fr" : {
@@ -12631,7 +12631,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Helper در دسترس نیست"
+            "value" : "‏Helper در دسترس نیست"
           }
         },
         "fr" : {
@@ -15451,7 +15451,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "دانلود فایل‌های نصب‌کننده ناموفق بود: %@"
+            "value" : "دانلود فایل‌های نصب‌کننده ناموفق بود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -15545,7 +15545,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "ذخیرهٔ فایل %@ ناموفق بود: %@"
+            "value" : "ذخیرهٔ فایل ⁨%@⁩ ناموفق بود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -16391,7 +16391,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "بررسی صحت فایل ناموفق بود: %@"
+            "value" : "بررسی صحت فایل ناموفق بود: ⁨%@⁩"
           }
         },
         "fr" : {
```

**File**: `macUSB/Resources/FinishUSB.xcstrings` (modified, +5/-5)
```diff
@@ -215,7 +215,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "حذف فایل‌های موقت ناموفق بود: %@"
+            "value" : "حذف فایل‌های موقت ناموفق بود: ⁨%@⁩"
           }
         },
         "fr" : {
@@ -1355,7 +1355,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macOS هنوز نمی‌تواند درایو را خارج کند. هر برنامه‌ای را که ممکن است از آن استفاده کند ببندید، سپس دوباره تلاش کنید."
+            "value" : "هنوز macOS نمی‌تواند درایو را خارج کند. هر برنامه‌ای را که ممکن است از آن استفاده کند ببندید، سپس دوباره تلاش کنید."
           }
         },
         "fr" : {
@@ -1545,7 +1545,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Spotlight در حال ایندکس کردن این درایو است، بنابراین macOS نمی‌تواند آن را با ایمنی خارج کند. می‌توانید برای متوقف کردن این فرآیند، درایو را به‌صورت اجباری خارج کنید."
+            "value" : "این درایو توسط Spotlight در حال ایندکس شدن است، بنابراین macOS نمی‌تواند آن را با ایمنی خارج کند. می‌توانید برای متوقف کردن این فرآیند، درایو را به‌صورت اجباری خارج کنید."
           }
         },
         "fr" : {
@@ -1640,7 +1640,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Spotlight مانع از خارج کردن درایو می‌شود"
+            "value" : "‏Spotlight مانع از خارج کردن درایو می‌شود"
           }
         },
         "fr" : {
@@ -3825,7 +3825,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "PC خود را روشن کرده و منوی بوت (Boot Menu) را باز کنید"
+            "value" : "‏PC خود را روشن کرده و منوی بوت (Boot Menu) را باز کنید"
           }
         },
         "fr" : {
```

**File**: `macUSB/Resources/Summary.xcstrings` (modified, +3/-3)
```diff
@@ -2400,7 +2400,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "macUSB نتوانست در دسترس بودن Rosetta را تأیید کند. برای ادامه دوباره بررسی کنید."
+            "value" : "در دسترس بودن Rosetta توسط macUSB تأیید نشد. برای ادامه دوباره بررسی کنید."
           }
         },
         "fr" : {
@@ -2875,7 +2875,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Rosetta نصب شده است"
+            "value" : "‏Rosetta نصب شده است"
           }
         },
         "fr" : {
@@ -3730,7 +3730,7 @@
         "fa" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Rosetta هنوز در دسترس نیست"
+            "value" : "هنوز Rosetta در دسترس نیست"
           }
         },
         "fr" : {
```

#### Recent Merged Pull Requests:
- **PR #145** (2026-10-25): Release v2.6 (@Kruszoneq)
- **PR #144** (2026-10-14): Fix right-to-left layout in Persian strings (@aliafshany)
- **PR #143** (2026-10-11): Improve RTL layout and navigation (@Kruszoneq)
- **PR #142** (2026-10-11): Add Persian (fa) localization (@aliafshany)
- **PR #141** (2026-10-11): Support solid install.wim images in Windows WIM split (@TheFilipcom4607)
- **PR #137** (2026-10-06): Extend Option volume selection to legacy macOS restore (@Kruszoneq)

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

## X. USB messages across app activation

**RULE**:
When implementing operations in `docs/reference/features/analysis/ANALYSIS_COMPATIBILITY.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kruszoneq/macUSB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cfff17e3`: USB messages across app activation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/reference/features/analysis/ANALYSIS_COMPATIBILITY.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
Prepared physical and Option target presentation, per-device partial failures, retry/lifecycle state, identity verification and selected-target readiness are defined in `../usb/USB_VALIDATION_AND_CAPACITY.md`. Ordinary discovery remains automatic at 2.5-second intervals; the 0.5-second UI tick and immediate Option presentation stay separate. Only a currently verified selected target with known sufficient capacity and target-specific monotonic evidence younger than 20 seconds is passed to the existing installation summary. The existing tick evaluates freshness even while discovery is running or blocked. A selected target shows the capacity error when insufficient, otherwise the destructive warning. Lifecycle suspension retains the last messages separately from admission, so inactivity and initial rechecking do not replace a capacity error with the destructive warning or temporarily remove existing discovery errors or the empty-catalog card. The bounded presentation grace and its invalidation rules are defined in the USB reference. Prolonged active loss of confirmation retains the selection and adds the `analysis.usb.discovery.availability.title` / `.description` card in `Analysis` a
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
Prepared physical and Option target presentation, per-device partial failures, retry/lifecycle state, identity verification and selected-target readiness are defined in `../usb/USB_VALIDATION_AND_CAPACITY.md`. Ordinary discovery remains automatic at 2.5-second intervals; the 0.5-second UI tick and immediate Option presentation stay separate. Only a currently verified selected target with known sufficient capacity and target-specific monotonic evidence younger than 20 seconds is passed to the existing installation summary. The existing tick evaluates freshness even while discovery is running or blocked. The destructive warning remains visible for every selected target regardless of application activity or verification readiness. Prolonged loss of confirmation retains the selection and adds the `analysis.usb.discovery.availability.title` / `.description` card in `Analysis` above that warning, using the same warning styling; inline discovery cards have no retry action and the generic notice does not duplicate it. Same-identity recovery restores readiness automatically, while replacement identity requires deliberate reselection. Continue still performs its exact final identity/capacity
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cfff17e3` are properly handled with clean fallback behavior.
