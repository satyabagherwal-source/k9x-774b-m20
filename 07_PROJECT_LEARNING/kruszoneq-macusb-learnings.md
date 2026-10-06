# Forensic Learning Record (Deep Inspection): Kruszoneq/macUSB

> **Canonical Artifact**: `07_PROJECT_LEARNING/kruszoneq-macusb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kruszoneq/macUSB](https://github.com/Kruszoneq/macUSB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:16:31.769Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kruszoneq/macUSB`
- **Description**: The all-in-one bootable USB creator for Mac
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3161 stars

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
            self.log("Załadowano ikonę Linux distro: \(distro)")
            return distroIcon
        }

        guard let icon = loadLinuxDistroIcon(for: "linux") else {
            self.log("Nie znaleziono fallback ikony linux.png - zostanie użyty SF Symbol.", category: "FileAnalysis")
            return nil
        }
        icon.isTemplate = false
        self.log("Załadowano fallback ikonę linux.png.", category: "FileAnalysis")
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

        self.log("Brak dedykowanej ikony distro dla: \(distro). Kandydaci: \(candidates.joined(separator: ", "))", category: "FileAnalysis")
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
        let capacityResolution = resolveRequiredUSBCapacityForImageSource(sourceURL)
        self.requiredUSBCapacityGB = capacityResolution.requiredCapacityGB
        if let fileSizeBytes = capacityResolution.sourceFileSizeBytes,
           let fileSizeSource = capacityResolution.sourceFileSizeSource {
            self.log("Linux source size: \(fileSizeBytes) bytes (source=\(fileSizeSource))")
        } else if capacityResolution.usedFallback {
            self.log("Linux source size unavailable. Applying fallback USB threshold: \(capacityResolution.requiredCapacityGB) GB")
        }
        self.log("Linux required USB threshold: \(capacityResolution.requiredCapacityGB) GB")

        self.log("Rozpoznano obraz Linux: \(result.displayName)")
        self.log("Linux source file: \(sourceURL.path)")
        self.log("Linux details: distro=\(result.distro ?? "?")
```

### Core Architecture Module: `macUSB/Features/Analysis/Logic/Linux/AnalysisLogicRawLinuxImageLifecycle.swift`
```
import Foundation
import SwiftUI

extension AnalysisLogic {
    func forceRawLinuxImageSelection(_ sourceURL: URL) {
        cancelActiveImageAnalysisRun(reason: "Wybór surowego obrazu .iso/.img")

        let standardizedURL = sourceURL.standardizedFileURL
        let sourceExtension = standardizedURL.pathExtension.lowercased()
        guard ["iso", "img"].contains(sourceExtension) else {
            logError("Nie można wymusić surowego zapisu dla .\(sourceExtension).")
            return
        }
        MenuState.shared.lockLanguageChanges(reason: "raw_linux_selection")

        log("Ręcznie wybrano surowy obraz .iso/.img (bez analizy pliku).")

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
            self.capacityCheckFinished = false
            self.shouldShowMavericksDialog = false
            self.shouldShowAlreadyMountedSourceAlert = false
        }

        let capacityResolution = resolveRequiredUSBCapacityForImageSource(standardizedURL)
        requiredUSBCapacityGB = capacityResolution.requiredCapacityGB
        if let fileSizeBytes = capacityResolution.sourceFileSizeBytes,
           let fileSizeSource = capacityResolution.sourceFileSizeSource {
            log("Raw image source size: \(fileSizeBytes) bytes (source=\(fileSizeSource))")
        } else if capacityResolution.usedFallback {
            log("Raw image source size unavailable. Applying fallback USB threshold: \(capacityResolution.requiredCapacityGB) GB")
        }
        log("Raw image required USB threshold: \(capacityResolution.requiredCapacityGB) GB")
        log("Ustawiono ręczny zapis surowego obrazu: recognizedVersion=\(recognizedVersion), source=\(standardizedURL.path)")
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
            self.log("Nie znaleziono ikony Windows w zasobach: \(iconName).svg")
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
        self.log(
            "Windows toolchain presence: brew=\(windowsToolchainPresence.hasHomebrew), wimlib=\(windowsToolchainPresence.hasWimlib)"
        )
        self.log(
            "Windows toolchain paths: brew=\(windowsToolchainPresence.homebrewPath ?? "not_found"), wimlib=\(windowsToolchainPresence.wimlibPath ?? "not_found")"
        )

        if result.isSupported {
            let capacityResolution = resolveRequiredUSBCapacityForImageSource(sourceURL)
            self.requiredUSBCapacityGB = capacityResolution.requiredCapacityGB
            if let fileSizeBytes = capacityResolution.sourceFileSizeBytes,
               let fileSizeSource = capacityResolution.sourceFileSizeSource {
                self.log("Windows source size: \(fileSizeBytes) bytes (source=\(fileSizeSource))")
            } else if capacityResolution.usedFallback {
                self.log("Windows source size unavailable. Applying fallback USB threshold: \(capacityResolution.requiredCapacityGB) GB")
            }
            self.log("Windows required USB threshold: \(capacityResolution.requiredCapacityGB) GB")
        } else {
            self.requiredUSBCapacityGB = nil
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

        self.log("Rozpoznano obraz Windows: \(result.displayName)")
        self.log(
            "Windows support gate: supported=\(result.isSupported ? "TAK" : "NIE"), reason=\(result.supportReason.rawValue), has_eligible_boot_mode=\(result.bootCapabilities.eligibleModes.isEmpty ? "NIE" : "TAK"), hasEFI=\(result.bootCapabilities.hasUEFI ? "TAK" : "NIE")"
        )
        self.log("Windows workflow flag: isWindowsWorkflowSupported=\(self.isWindowsWorkflowSupported ? "TAK" : "NIE")")
        self.log("Windows workflow split-wim flag: \(self.windowsWillSplitWIM ? "TAK" : "NIE")")
        self.log("Windows source file: \(sourceURL.path)")
        self.log(
            "Windows boot capabilities: detected=\(windowsBootModesLogValue(result.bootCapabilities.detectedModes)), eligible=\(windowsBootModesLogValue(result.bootCapabilities.eligibleModes)), family=\(result.family.rawValue), arch=\(result.arch.rawValue), workflow_supported=\(result.isSupported ? "yes" : "no")"
        )
        self.log(
            "Windows boot marker evidence: BIOS present=\(windowsBootMarkersLogValue(result.bootCapabilities.biosPresentMarkers)) missing=\(windowsBootMarkersLogValue(result.bootCapabilities.biosMissingRequiredMarkers)); UEFI present=\(windowsBootMarkersLogValue(result.bootCapabilities.uefiPresentMarkers)) missing=\(windowsBootMarkersLogValue(result.bootCapabilities.uefiMissingRequiredMarkers))"
        )
        AppLogging.separator()
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
            self.log("Windows autounattend language check: pominięto, bo obraz nie jest wspieranym Windows 10 64-bit/11 dla tej funkcji.")
            return nil
        }

        let macLanguage = CreatorWindowsAutounattendMacLocale.normalizedWindowsTag(Locale.preferredLanguages.first) ?? "unknown"
        let macRegion = CreatorWindowsAutounattendMacLocale.normalizedWindowsTag(Locale.current.identifier) ?? "unknown"
        self.log(
            "Windows autounattend language check: odczytuję sources/lang.ini z obrazu Windows (mount=\(mountedImagePath ?? "nil"))."
        )

        let isoLanguageTags = CreatorWindowsAutounattendSourceInspection.availableLanguageTags(in: mountedImagePath)
        let isoLanguagesDescription = isoLanguageTags?.sorted().joined(separator: ", ") ?? "brak/nie odczytano"
        let macLocale = CreatorWindowsAutounattendMacLocale.current(availableLanguageTags: isoLanguageTags)

        self.log(
            "Windows autounattend language check: języki ISO=\(isoLanguagesDescription); język macOS=\(macLanguage); region macOS=\(macRegion); zgodność=\((macLocale?.languageIsAvailableInSource == true) ? "TAK" : "NIE")."
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
        cancelActiveImageAnalysisRun(reason: "Ręczne przełączenie na Tiger Multi DVD")
        self.log("Ręcznie wybrano tryb Tiger Multi DVD")
        let fileURL = self.selectedFileUrl
        DispatchQueue.global(qos: .userInitiated).async {
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
                    self.capacityCheckFinished = false
                    self.requiredUSBCapacityGB = 16
                    self.resetLinuxDetectionState()
                    self.resetWindowsDetectionState()
                }
                let flags = [self.isPPC ? "isPPC" : nil].compactMap { $0 }.joined(separator: ", ")
                self.log("Ustawiono Tiger Multi DVD: recognizedVersion=\(self.recognizedVersion). Flagi: \(flags.isEmpty ? "brak" : flags)")
            }
        }
    }

    func resetAll() {
        cancelActiveImageAnalysisRun(reason: "Pełny reset stanu analizy")
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
                self.requiredUSBCapacityGB = nil
                self.resetLinuxDetectionState()
                self.resetWindowsDetectionState()

                self.isMacOSCreateInstallMediaVolumeOverrideActive = false
                self.presentedUSBTargets = self.physicalUSBTargetsCache
                self.selectedDrive = nil
                self.hasUnreadableExternalUSBMedia = false
                self.unreadableExternalUSBMediaCount = 0
                self.lastUnreadableUSBDetectionDate = .distantPast
                self.isUnreadableUSBDetectionRunning = false

                self.isCapacitySufficient = false
                self.capacityCheckFinished = false
            }
        }
    }

    // Call this from the UI when the user presses the "Przejdź dalej" button
    func recordProceedPressed() {
        self.log("Użytkownik nacisnął przycisk 'Przejdź dalej'. Wybrany nośnik: \(self.selectedDrive?.url.path ?? "brak"), źródło: \(self.sourceAppURL?.path ?? "brak"), rozpoznano: \(self.recognizedVersion)")
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
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let output = try Self.runProcessAndCaptureOutputBlocking(
                        executable: executable,
                        arguments: arguments
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
            arguments: arguments
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
                    category: "Downloader"
                )
                return true
            } catch {
                AppLogging.error(
                    "\(context): detach failed attempt=\(attempt) mode=normal mount=\(mountURL.path) error=\(error.localizedDescription)",
                    category: "Downloader"
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
                category: "Downloader"
            )
            return true
        } catch {
            AppLogging.error(
                "\(context): detach failed mode=force mount=\(mountURL.path) error=\(error.localizedDescription)",
                category: "Downloader"
            )
            return false
        }
    }

    private static func runProcessAndCaptureOutputBlocking(
        executable: String,
        arguments: [String]
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
                category: "Downloader"
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
            return String(localized: "Wybrana pozycja nie jest wspierana w aktualnym pobieraniu")
        case let .insufficientDiskSpace(requiredMinimumBytes, availableBytes, installerBytes):
            return String(
                format: String(localized: "Brak wolnego miejsca: wymagane minimum %@ (250%% rozmiaru instalatora %@), dostępne %@."),
                DownloadManifestItem.formatBytes(requiredMinimumBytes),
                DownloadManifestItem.formatBytes(installerBytes),
                DownloadManifestItem.formatBytes(availableBytes)
            )
        case let .sessionInitializationFailed(details):
            return String(
                format: String(localized: "Nie udało się rozpocząć pobierania. Nie udało się przygotować sesji pobierania: %@"),
                details
            )
        case let .downloadFailed(details):
            return String(
                format: String(localized: "Nie udało się pobrać plików instalatora: %@"),
                details
            )
        case let .verificationFailed(details):
            return String(
                format: String(localized: "Weryfikacja plików nie powiodła się: %@"),
                details
            )
        case let .assemblyFailed(details):
            return String(
                format: String(localized: "Nie udało się przygotować instalatora: %@"),
                details
            )
        case let .diskImageCreationFailed(details):
            return String(
                format: String(localized: "downloader.disk_image.error.creation"),
                details
            )
        case let .cleanupFailed(details):
            return String(
                format: String(localized: "Usuwanie plików tymczasowych nie zostało ukończone: %@"),
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

    @Published var connectionStatusText: String = String(localized: "Łączenie z serwerami Apple...")
    @Published var downloadCurrentIndex: Int = 0
    @Published var downloadTotal: Int = 0
    @Published var downloadFileName: String = String(localized: "Oczekiwanie...")
    @Published var downloadProgress: Double = 0
    @Published var downloadSpeedText: String = "0.0 MB/s"
    @Published var downloadTransferredText: String = "0.0MB/0.0MB"
    @Published var verifyCurrentIndex: Int = 0
    @Published var verifyTotal: Int = 0
    @Published var verifyFileName: String = String(localized: "Oczekiwanie...")
    @Published var verifyProgress: Double = 0
    @Published var buildStatusText: String = String(localized: "Przygotowywanie instalatora...")
    @Published var buildProgress: Double? = nil
    @Published var diskImageStageStatus: MacOSDiskImageStageStatus = .preparing
    @Published var cleanupStatusText: String = String(localized: "Przygotowanie czyszczenia...")
    @Published var cleanupProgress: Double = 0
    @Published var summaryTotalDownloadedText: String = "0.0 GB"
    @Published var summaryAverageSpeedText: String = "0.0 MB/s"
    @Published var summaryDurationText: String = String(
        format: String(localized: "%02dm %02ds"),
        0,
        0
    )
    @Published var summaryLocationText: String = String(localized: "Brak danych")
    @Published var summaryTemporaryFilesText: String = String(localized: "Brak danych")
    @Published var summaryCreatedFileText: String = String(localized: "Brak danych")
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
        hasExpiredButTrustedAppleSignature = false

        connectionStatusText = String(localized: "Łączenie z serwerami Apple...")
        downloadCurrentIndex = 0
        downloadTotal = 0
        downloadFileName = String(localized: "Oczekiwanie...")
        downloadProgress = 0
        downloadSpeedText = "0.0 MB/s"
        downloadTransferredText = "0.0MB/0.0MB"
        verifyCurrentIndex = 0
        verifyTotal = 0
        verifyFileName =
```

### Core Architecture Module: `macUSB/Shared/Services/MenuState.swift`
```
import Foundation
import Combine

final class MenuState: ObservableObject {
    static let shared = MenuState()
    @Published var skipAnalysisEnabled: Bool = false
    @Published var externalDrivesEnabled: Bool = UserDefaults.standard.bool(forKey: "AllowExternalDrives")
    @Published var notificationsEnabled: Bool = false
    @Published var hasFullDiskAccess: Bool = true
    @Published var helperRequiresBackgroundApproval: Bool = false
    @Published var rawLinuxImageSelectionEnabled: Bool = false
    @Published private(set) var isDownloaderAccessBlocked: Bool = false
    @Published private(set) var isLanguageChangeEnabled: Bool = true
    @Published var debugCopiedDataLabel: String = String(
        format: String(localized: "Przekopiowane dane: %.1f GB"),
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
            format: String(localized: "Przekopiowane dane: %.1f GB"),
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
                "Zablokowano zmianę języka dla bieżącego przepływu [reason=\(reason)].",
                category: "AppLifecycle"
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
        os_log(
            "%{public}@ connections=%{public}d operations=%{public}d",
            log: log,
            type: .default,
            message,
            activeConnections,
            activeOperations
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
        // Wstrzyknięcie języka
        .environment(\.locale, languageManager.locale)
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
                logMessage: "DEBUG: Zaplanowano przejście do podsumowania Big Sur za 2 sekundy"
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: .macUSBDebugGoToTigerSummary)) { _ in
            scheduleDebugSummaryNavigation(
                route: .debugFinishUSBTigerSuccess,
                logMessage: "DEBUG: Zaplanowano przejście do podsumowania Tiger (isPPC) za 2 sekundy"
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: .macUSBDebugGoToLinuxSummary)) { _ in
            scheduleDebugSummaryNavigation(
                route: .debugFinishUSBLinuxSuccess,
                logMessage: "DEBUG: Zaplanowano przejście do podsumowania Linux (Ubuntu 24.04) za 2 sekundy"
            )
        }
    }

    private func scheduleDebugSummaryNavigation(route: AppRoute, logMessage: String) {
        AppLogging.info(logMessage, category: "Navigation")
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
        alert.messageText = String(localized: "Wymagany restart aplikacji")
        alert.informativeText = String(localized: "Aby zmienić język interfejsu we wszystkich elementach aplikacji (w tym menu i przyciskach), wymagany jest restart. Kliknij poniżej, aby uruchomić aplikację ponownie.")
        alert.addButton(withTitle: String(localized: "Uruchom aplikację ponownie"))

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

### Core Architecture Module: `macUSB/App/macUSBApp.swift`
```
import SwiftUI
import AppKit
import ServiceManagement

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        AppTerminationCoordinator.shared.applicationShouldTerminate()
    }
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSWindow.allowsAutomaticWindowTabbing = false
        
        // Ensure external drives support is disabled by default on launch
        UserDefaults.standard.set(false, forKey: "AllowExternalDrives")
        UserDefaults.standard.synchronize()
        // Update MenuState to reflect the default state in UI
        MenuState.shared.externalDrivesEnabled = false
        refreshPermissionStates(fullDiskAccessTrigger: nil)
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        AppTerminationCleanup.shared.performIfNeeded()
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        refreshPermissionStates(fullDiskAccessTrigger: .activation)
    }

    private func refreshPermissionStates(fullDiskAccessTrigger: FullDiskAccessCheckTrigger?) {
        NotificationPermissionManager.shared.refreshState()
        if let fullDiskAccessTrigger {
            FullDiskAccessPermissionManager.shared.refreshState(trigger: fullDiskAccessTrigger)
        }
        HelperServiceManager.shared.refreshBackgroundApprovalState()
    }
}

@main
struct macUSBApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var menuState = MenuState.shared
    @StateObject private var languageManager = LanguageManager()
    
    init() {
        // Ustaw globalny język jak najwcześniej (na podstawie wyboru użytkownika lub systemu)
        LanguageManager.applyPreferredLanguageAtLaunch()
        
        // Blokada przed podwójnym uruchomieniem
        if let bundleId = Bundle.main.bundleIdentifier {
            let runningApps = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId)
            if runningApps.count > 1 {
                for app in runningApps where app.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                    if #available(macOS 14.0, *) {
                        app.activate()
                    } else {
                        app.activate(options: [])
                    }
                }
                NSApplication.shared.terminate(nil)
            }
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(languageManager)
                .frame(width: MacUSBDesignTokens.windowWidth, height: MacUSBDesignTokens.windowHeight)
                .frame(
                    minWidth: MacUSBDesignTokens.windowWidth,
                    maxWidth: MacUSBDesignTokens.windowWidth,
                    minHeight: MacUSBDesignTokens.windowHeight,
                    maxHeight: MacUSBDesignTokens.windowHeight
                )
        }
        .windowResizability(.contentSize)
        .windowToolbarStyle(.unifiedCompact(showsTitle: true))
        .commands {
            CommandGroup(replacing: .newItem) { }
            
            CommandMenu(String(localized: "Opcje")) {
                Menu {
                    Button(String(localized: "Mac OS X Tiger 10.4 (Multi DVD)")) {
                        let alert = NSAlert()
                        alert.alertStyle = .informational
                        alert.icon = NSApp.applicationIconImage
                        alert.messageText = String(localized: "Tworzenie USB z Mac OS X Tiger (Multi DVD)")
                        alert.informativeText = String(localized: "Dla wybranego obrazu zostanie pominięta weryfikacja wersji. Aplikacja wymusi rozpoznanie pliku jako „Mac OS X Tiger 10.4”, aby umożliwić jego zamontowanie i zapis na USB. Czy chcesz kontynuować?")
                        alert.addButton(withTitle: String(localized: "Nie"))
                        alert.addButton(withTitle: String(localized: "Tak"))
                        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
                            alert.beginSheetModal(for: window) { response in
                                if response == .alertSecondButtonReturn {
                                    NotificationCenter.default.post(name: .macUSBStartTigerMultiDVD, object: nil)
                                }
                            }
                        } else {
                            let response = alert.runModal()
                            if response == .alertSecondButtonReturn {
                                NotificationCenter.default.post(name: .macUSBStartTigerMultiDVD, object: nil)
                            }
                        }
                    }
                    .keyboardShortcut("t", modifiers: [.option, .command])
                    .disabled(!menuState.skipAnalysisEnabled)
                } label: {
                    Label(String(localized: "Pomiń analizowanie pliku"), systemImage: "doc.text.magnifyingglass")
                }
                Divider()
                Button {
                    let alert = NSAlert()
                    alert.alertStyle = .informational
                    alert.icon = NSApp.applicationIconImage
                    alert.messageText = String(localized: "Włącz obsługę zewnętrznych dysków twardych")
                    alert.informativeText = String(localized: "Ta funkcja umożliwia tworzenie instalatora na zewnętrznych dyskach twardych i SSD. Zachowaj szczególną ostrożność przy wyborze dysku docelowego z listy, aby uniknąć przypadkowej utraty danych!")
                    alert.addButton(withTitle: String(localized: "OK"))

                    if let window = NSApp.keyWindow ?? NSApp.mainWindow {
                        alert.beginSheetModal(for: window) { _ in menuState.enableExternalDrives() }
                    } else {
                        _ = alert.runModal()
                        menuState.enableExternalDrives()
                    }
                } label: {
                    Label(String(localized: "Włącz obsługę zewnętrznych dysków twardych"), systemImage: "externaldrive.badge.plus")
                }
                Divider()
                Button {
                    resetExternalVolumeAccessPermissions()
                } label: {
                    Label(String(localized: "Resetuj uprawnienia dostępu do dysków zewnętrznych"), systemImage: "arrow.clockwise.circle")
                }
                Divider()
                Menu {
                    Button {
                        languageManager.currentLanguage = "auto"
                    } label: {
                        if languageManager.isAuto {
                            Label(String(localized: "Automatycznie"), systemImage: "checkmark")
                        } else {
                            Text(String(localized: "Automatycznie"))
                        }
                    }
                    Divider()
                    Button { languageManager.currentLanguage = "pl" } label: {
                        if languageManager.currentLanguage == "pl" {
                            Label("Polski", systemImage: "checkmark")
                        } else {
                            Text("Polski")
                        }
                    }
                    Button { languageManager.currentLanguage = "en" } label: {
                        if languageManager.currentLanguage == "en" {
                            Label("English", systemImage: "checkmark")
                        } else {
                            Text("English")
                        }
                    }
                    Button { languageManager.currentLanguage = "de" } label: {
                        if languageManager.currentLanguage == "de" {
                            Label("Deutsch", systemImage: "checkmark")
                        } else {
                            Text("Deutsch")
                        }
                    }
                    Button { languageManager.currentLanguage = "fr" } label: {
                        if languageManager.currentLanguage == "fr" {
                            Label("Français", systemImage: "checkmark")
                        } else {
                            Text("Français")
                        }
                    }
                    Button { languageManager.currentLanguage = "es" } label: {
                        if languageManager.currentLanguage == "es" {
                            Label("Español", systemImage: "checkmark")
                        } else {
                            Text("Español")
                        }
                    }
                    Button { languageManager.currentLanguage = "pt-BR" } label: {
                        if languageManager.currentLanguage == "pt-BR" {
                            Label("Português (BR)", systemImage: "checkmark")
                        } else {
                            Text("Português (BR)")
                        }
                    }
                    Button { languageManager.currentLanguage = "ru" } label: {
                        if languageManager.currentLanguage == "ru" {
                            Label("Русский", systemImage: "checkmark")
                        } else {
                            Text("Русский")
                        }
                    }
                    Button { languageManager.currentLanguage = "zh-Hans" } label: {
                        if languageManager.currentLanguage == "zh-Hans" {
                            Label("简体中文", systemImage: "checkmark")
                        } else {
                            Text("简体中文")
                        }
                    }
                    Button { 
```

### Core Architecture Module: `macUSB/Features/Analysis/AnalysisLogic.swift`
```
import SwiftUI
import AppKit
import Foundation
import Combine

final class AnalysisLogic: ObservableObject {
    // MARK: - Published State (moved from SystemAnalysisView)
    @Published var selectedFilePath: String = ""
    @Published var selectedFileUrl: URL?
    @Published var recognizedVersion: String = ""
    @Published var sourceAppURL: URL?
    @Published var detectedSystemIcon: NSImage?
    @Published var isBetaInstaller: Bool = false
    @Published var mountedDMGPath: String? = nil

    @Published var isAnalyzing: Bool = false {
        didSet {
            updateAnalysisOperationActivity(from: oldValue)
        }
    }
    @Published var isSystemDetected: Bool = false
    @Published var showUSBSection: Bool = false
    @Published var showUnsupportedMessage: Bool = false

    // Flagi logiki systemowej
    @Published var needsCodesign: Bool = true
    @Published var isLegacyDetected: Bool = false
    @Published var isRestoreLegacy: Bool = false
    // NOWOŚĆ: Flaga dla Cataliny
    @Published var isCatalina: Bool = false
    @Published var isSierra: Bool = false
    @Published var isMavericks: Bool = false
    @Published var isUnsupportedSierra: Bool = false
    @Published var shouldShowMavericksDialog: Bool = false
    @Published var shouldShowAlreadyMountedSourceAlert: Bool = false
    @Published var isPPC: Bool = false
    @Published var legacyArchInfo: String? = nil
    @Published var createInstallMediaInspection: MacOSCreateInstallMediaInspection = .notApplicable
    @Published var macOSArchitectureBlockReason: MacOSArchitectureBlockReason? = nil
    @Published var macOSRosettaRequirement: MacOSRosettaRequirement = .notRequired
    @Published var userSkippedAnalysis: Bool = false
    @Published var isLinuxDetected: Bool = false
    @Published var isRawImageSelection: Bool = false
    @Published var isLinuxDistributionRecognized: Bool = false
    @Published var linuxDistro: String? = nil
    @Published var linuxVersion: String? = nil
    @Published var linuxEdition: String? = nil
    @Published var linuxArchitecture: String? = nil
    @Published var isLinuxARM: Bool = false
    @Published var linuxDisplayName: String? = nil
    @Published var linuxSourceURL: URL? = nil
    @Published var isWindowsDetected: Bool = false
    @Published var windowsFamily: WindowsFamily? = nil
    @Published var windowsServicePack: String? = nil
    @Published var windowsArchitecture: WindowsArchitecture? = nil
    @Published var isWindowsARM: Bool = false
    @Published var windowsHasEFI: Bool = false
    @Published var windowsBootCapabilities: WindowsBootCapabilities? = nil
    @Published var isWindowsWorkflowSupported: Bool = false
    @Published var windowsWillSplitWIM: Bool = false
    @Published var windowsAutounattendMacLocale: CreatorWindowsAutounattendMacLocale? = nil

    @Published var presentedUSBTargets: [USBDrive] = []
    @Published var hasUnreadableExternalUSBMedia: Bool = false
    @Published var unreadableExternalUSBMediaCount: Int = 0
    @Published var selectedDriveSelectionID: String? {
        didSet {
            guard !isSynchronizingDriveSelection else { return }

            let normalizedSelectionID: String?
            if let selectedDriveSelectionID, selectedDriveSelectionID.isEmpty {
                normalizedSelectionID = nil
            } else {
                normalizedSelectionID = selectedDriveSelectionID
            }

            if normalizedSelectionID != selectedDriveSelectionID {
                synchronizeDriveSelection {
                    self.selectedDriveSelectionID = normalizedSelectionID
                }
                return
            }

            guard let selectionID = normalizedSelectionID else {
                if selectedDrive != nil {
                    selectedDrive = nil
                }
                return
            }

            if let matchingDrive = selectableUSBTargets.first(where: { $0.selectionID == selectionID }) {
                if selectedDrive?.selectionID != matchingDrive.selectionID {
                    selectedDrive = matchingDrive
                }
            } else if selectedDrive != nil {
                selectedDrive = nil
            }
        }
    }

    @Published var selectedDrive: USBDrive? {
        didSet {
            // Log only when the detected/selected drive actually changes
            if oldValue?.url != selectedDrive?.url {
                let id = selectedDrive?.device ?? "unknown"
                let speed = selectedDrive?.usbSpeed?.rawValue ?? "USB"
                let partitionScheme = selectedDrive?.partitionScheme?.rawValue ?? "unknown"
                let fileSystem = selectedDrive?.fileSystemFormat?.rawValue ?? "unknown"
                if isPPC {
                    self.log(
                        "Wybrano nośnik: \(id) (\(speed)) — Pojemność: \(self.selectedDrive?.size ?? "?"), Schemat: \(partitionScheme), Format: \(fileSystem), Tryb: PPC, APM",
                        category: "USBSelection"
                    )
                } else {
                    let needsFormattingText = (selectedDrive?.needsFormatting ?? true) ? "TAK" : "NIE"
                    self.log(
                        "Wybrano nośnik: \(id) (\(speed)) — Pojemność: \(self.selectedDrive?.size ?? "?"), Schemat: \(partitionScheme), Format: \(fileSystem), Wymaga formatowania w kolejnych etapach: \(needsFormattingText)",
                        category: "USBSelection"
                    )
                }
            }

            let newSelectionID = selectedDrive?.selectionID
            if selectedDriveSelectionID != newSelectionID {
                synchronizeDriveSelection {
                    self.selectedDriveSelectionID = newSelectionID
                }
            }
        }
    }

    /// Nośnik przekazywany do etapu instalacji. PPC i procesy restore
    /// zawsze otrzymują fizyczny whole disk. W trybie PPC flaga
    /// needsFormatting jest wymuszana na false, ponieważ formatowanie
    /// (APM + HFS+) jest już wbudowane w dalszy proces.
    var selectedDriveForInstallation: USBDrive? {
        guard let drive = selectedDrive else { return nil }
        let installationDrive: USBDrive
        if requiresWholeDiskMacOSTarget {
            if drive.isWholeDiskTarget {
                installationDrive = drive
            } else {
                let wholeDisk = USBDriveLogic.wholeDiskName(from: drive.device)
                guard let physicalDrive = physicalUSBTargetsCache.first(where: { $0.device == wholeDisk }) else {
                    return nil
                }
                installationDrive = physicalDrive
            }
        } else {
            installationDrive = drive
        }

        guard isPPC else { return installationDrive }
        return USBDrive(
            name: installationDrive.name,
            device: installationDrive.device,
            size: installationDrive.size,
            url: installationDrive.url,
            usbSpeed: installationDrive.usbSpeed,
            partitionScheme: installationDrive.partitionScheme,
            fileSystemFormat: installationDrive.fileSystemFormat,
            needsFormatting: false
        )
    }

    @Published var isCapacitySufficient: Bool = false
    @Published var capacityCheckFinished: Bool = false
    @Published var requiredUSBCapacityGB: Int? = nil
    var lastUnreadableUSBDetectionDate: Date = .distantPast
    let unreadableUSBDetectionInterval: TimeInterval = 2.5
    var isUnreadableUSBDetectionRunning: Bool = false
    var isPhysicalDriveRefreshRunning: Bool = false
    var physicalDriveRefreshGeneration: UInt = 0
    var wholeDiskCapacityCache: [String: Int64] = [:]
    var physicalUSBTargetsCache: [USBDrive] = []
    var macOSOptionUSBTargetsCache: [USBDrive] = []
    var isMacOSCreateInstallMediaVolumeOverrideActive: Bool = false
    @Published var hasPreparedUSBTargetSnapshot: Bool = false
    let imageAnalysisTimeoutSeconds: TimeInterval = 20
    var activeImageAnalysisRunID: UUID? = nil
    var imageAnalysisTimeoutWorkItem: DispatchWorkItem? = nil
    var linuxImageAttachSession: LinuxImageAttachSession? = nil
    var analysisOperationToken: AppActiveOperationToken?
    private var isSynchronizingDriveSelection: Bool = false

    var requiredUSBCapacityDisplayValue: String {
        requiredUSBCapacityGB.map(String.init) ?? "--"
    }

    // Computed: true only when app has recognized a supported system and can proceed normally
    var isRecognizedAndSupported: Bool {
        // Recognized and supported when analysis finished, a valid source exists or PPC flow is selected,
        // the system is detected (modern/legacy/catalina/sierra), and it's not marked unsupported.
        let recognized = (!isAnalyzing)
        let hasValidSourceOrPPC = (sourceAppURL != nil) || isPPC
        let detected = isSystemDetected || isPPC
        let unsupported = showUnsupportedMessage || isUnsupportedSierra
        return recognized && hasValidSourceOrPPC && detected && !unsupported
    }

    // MARK: - Logging
    func log(_ message: String, category: String = "FileAnalysis") {
        AppLogging.info(message, category: category)
    }

    func logError(_ message: String, category: String = "FileAnalysis") {
        AppLogging.error(message, category: category)
    }

    func stage(_ title: String) {
        AppLogging.stage(title)
    }

    func synchronizeDriveSelection(_ updates: () -> Void) {
        if isSynchronizingDriveSelection {
            updates()
            return
        }

        isSynchronizingDriveSelection = true
        updates()
        isSynchronizingDriveSelection = false
    }
}

extension AnalysisLogic {
    func beginImageAnalysisRun(sourceURL: URL) -> UUID {
        cancelActiveImageAnalysisRun(reason: "Uruchamianie nowej analizy obrazu")

        let runID = UUID()
        activeImageAnalysisRunID = runID

        let timeoutWorkItem = DispatchWorkItem { [weak self] in
            self?.handleImageAnaly
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #120** (2026-09-22): **[Downloader] Missing Mavericks**
  *Symptoms*: ### macUSB version  v2.5  ### Host macOS version  macOS Golden Gate 27.0  ### Host architecture  Apple Silicon  ### Required permissions  - [x] I enabled Full Disk Access for macUSB in System Settings - [x] I enabled Allow in the Background for macUSB in System Settings  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which system were you downloading?  Mac OS X Mavericks 10.9.5  ### Failure stage  Installer list  ### Is the issue reproducible?  Always  ### Steps to reproduce  I wanted to prepare a Mavericks installer and was hoping/assuming macUSB had learned to handle the fetch (from #4). But the macOS download list still skips straight from Yosemite to Mountain Lion.  ### Diagnostic logs  [macUSB_20260921_132054_logs.txt](https://github.com/user-attachments/files/32479502/macUSB_20260921_132054_logs.txt)  ### Screenshots or videos  _No response_
  **Post-Mortem & Fix Analysis**:
  > The macUSB downloader is limited to macOS installers that Apple makes **officially and publicly** available through its software catalogs or website. Since Mavericks is not available from any of these sources, I do not plan to add support for downloading it directly within the application.  A Mavericks image can instead be obtained through [Mavericks Forever](https://mavericksforever.com/#obtaining-mavericks) and then used with macUSB to create USB installation media.
  > Yes, that's what I used and it worked fine. Just felt like a UX rough edge. But if it doesn't feel right to include it, I understand.

- **Issue #117** (2026-09-20): **[App] The Helper runs even with the app quit**
  *Symptoms*: @Kruszoneq  ### macUSB version  2.4  ### Host macOS version  27 Release  ### Host architecture  Apple Silicon  ### Affected app area  Helper  ### Did the app crash?  No  ### Did this start after updating macUSB?  Yes  ### Is the issue reproducible?  Always  ### Steps to reproduce  The helper run constantly even with app quit  ### Diagnostic logs  _No response_  ### Screenshots or videos  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. I had already observed the same behavior and confirmed that the background helper remains active after macUSB is closed. The issue has been fixed and will be included in the upcoming macUSB v2.5 release.
  > > Thank you for reporting this. I had already observed the same behavior and confirmed that the background helper remains active after macUSB is closed. The issue has been fixed and will be included in the upcoming macUSB v2.5 release.  truly appreciate it! and thank you from the heart for this awesome utility!!!!!!!
  > macUSB v2.5 has just been released with a fix for this!

- **Issue #110** (2026-08-25): **[Downloader] Download completes but fails once verifying**
  *Symptoms*: ### macUSB version  2.4  ### Host macOS version  macOS Tahoe 26.6.2  ### Host architecture  Apple Silicon  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which system were you downloading?  Tahoe, Sequoia, Sonoma, Ventura  ### Failure stage  Verification  ### Is the issue reproducible?  Always  ### Steps to reproduce  1. Open downloader 2. Select version 3. Download completes 4. Verification begins and immediately gives error  ### Diagnostic logs  [Diag Log.txt](https://github.com/user-attachments/files/31355413/Diag.Log.txt)  ### Screenshots or videos  [1787522564923.jpg](https://github.com/user-attachments/assets/52822171-c0a7-409a-9749-0967605b85de) [1787522564858.jpg](https://github.com/user-attachments/assets/19f91ee2-6df3-4b7e-85b6-531cdd5a9ae8)
  **Post-Mortem & Fix Analysis**:
  > Is macUSB allowed to run in the background in System Settings? Please also attach the actual diagnostic logs, as they will make it much easier to identify the cause of the issue.
  > Solved. Background activity was the issue but for some reason it wouldn't show up in settings to toggle it on. After multiple times opening and closing the app, the option popped up and I was able to give it background permission. Thanks again for the help.

- **Issue #98** (2026-08-02): **[Windows USB Creation] rsync error**
  *Symptoms*: ### macUSB version  Version 2.3.1 (33)  ### Host macOS version  15.7.8 (24G824)  ### Host architecture  Intel  ### Required permissions  - [x] I enabled Full Disk Access for macUSB in System Settings - [x] I enabled Allow in the Background for macUSB in System Settings  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which Windows system were you creating?  Win10_22H2_EnglishInternational_x64v1  ### Image format  .iso  ### Image source details  https://www.microsoft.com/en-us/software-download/windows10ISO  ### Is `wimlib` installed on your system?  Yes  ### Failure stage  USB creation  ### Problem description  <img width="662" height="900" alt="Image" src="https://github.com/user-attachments/assets/1f93bf05-68c5-4fe1-9134-9b71ccf00dff" />  tried several different times, checked the checksum of the iso, and progressively disabled all customisations, always the same result  ### Target media type  Pendrive  ### Is the issue reproducible?  Always  ### Steps to reproduce  install macusb, grant macusb full write and background, install wimlib, close macusb, choose windows iso, try to format to a 32gb usb, fail and try again and again and again  here's the log: https://gist.github.com/balupton/76ef99a33a0577c813e5734d3f59f9ce  here's another screenshot: <img width="662" height="900" alt="Image" src="https://github.com/user-attachments/assets/96236afa-38e1-4568-93c7-e0504e725843" />  ### Expected result  it to work  ### Actual result  works fine with windiskwriter
  **Post-Mortem & Fix Analysis**:
  > The issue was caused by using `rsync 3.4.4` installed through Homebrew. It attempted to transfer file ownership and group metadata from the Windows ISO image to the USB drive, which resulted in an error and interrupted the USB creation process.  I changed the copying process to use the version of `rsync` included with macOS and options that do not transfer unnecessary metadata.  The fix will be available in the upcoming update.
  > This has been fixed macUSB v2.4. Thanks for the report!

- **Issue #87** (2026-08-02): **[App] Full Disk Access not being detected in MacOS 27 Beta**
  *Symptoms*: ### macUSB version  v2.3.1  ### Host macOS version  macOS 27 DB4  ### Host architecture  Apple Silicon  ### Affected app area  Permissions  ### Did the app crash?  No  ### Did this start after updating macUSB?  No  ### Is the issue reproducible?  Always  ### Steps to reproduce  1. Open macUSB 2. Permission dialog pops up even if the app has Full Disk permission.  3. Tries to move past the app, but it won't allow me to create the USB   ### Expected result  I should be allowed to go through the menus with no errors  ### Actual result  Permission dialog consistently pops up. Seems to be an issue with macOS 27. According to an issue in Mole, they changed the way FDA permissions are read. They fixed it somehow. Just thought I would let you know!  ### Required attachments  - [x] I attached diagnostic logs exported from `Help -> Export diagnostic logs...` - [x] I attached screenshots showing the issue
  **Post-Mortem & Fix Analysis**:
  > <img width="572" height="814" alt="Image" src="https://github.com/user-attachments/assets/eae22337-c54b-4155-84d5-f7a0f211ce16" />
  > [macUSB_20260721_103523_logs.txt](https://github.com/user-attachments/files/30231793/macUSB_20260721_103523_logs.txt)
  > Thanks for the info! For now, I'm putting this on hold until the official release of macOS 27. I don't want to install the beta on my Mac, and the other models I have aren't compatible with it (RIP Intel).

- **Issue #71** (2026-06-01): **[Windows USB Creation] Wimlib Split error**
  *Symptoms*: ### macUSB version  v2.2  ### Host macOS version  macOS Tahoe 26.5  ### Host architecture  Apple Silicon  ### Required permissions  - [x] I enabled Full Disk Access for macUSB in System Settings - [x] I enabled Allow in the Background for macUSB in System Settings  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which Windows system were you creating?  Windows 11 24H@  ### Image format  .iso  ### Image source details  Microsoft Download page  ### Is `wimlib` installed on your system?  Yes  ### Failure stage  USB creation  ### Problem description  application seems to fail to split .wim file  <img width="557" height="131" alt="Image" src="https://github.com/user-attachments/assets/a068946a-e9b9-4f5c-95ca-692d06a2b212" />  ### Target media type  Pendrive  ### Is the issue reproducible?  Always  ### Steps to reproduce  Select windows image, select drive, click write, process begins, performs initial copy, seems to complete wim split very quickly then goes to this error screen attached  ### Expected result  drive is created successfully  ### Actual result  application errors  [macUSB_20260521_095541_logs.txt](https://github.com/user-attachments/files/28093314/macUSB_20260521_095541_logs.txt)  ### Required attachments  - [x] I attached diagnostic logs exported from `Help -> Export diagnostic logs...` - [x] I attached screenshots showing the issue
  **Post-Mortem & Fix Analysis**:
  > It looks like the issue is caused by a Windows image in **UUP format**.  This image contains an `install.wim` file stored as **solid resources**, which `wimlib-imagex` cannot split into smaller `install.swm` files, which is why this error appears.  Please download and use the **universal** Windows 11 ISO from the [official Microsoft page](https://www.microsoft.com/software-download/windows11).  Please let me know if this solved the problem!
  > I am closing this issue due to a lack of response over the past two weeks. If the issue persists or you have additional information, please feel free to reopen this thread or create a new one.

- **Issue #49** (2026-04-17): **[USB Creation] The installer payload failed signature check**
  *Symptoms*: ### macUSB version  v2.1  ### Host macOS version  macOS Tahoe 26.4  ### Host architecture  Apple Silicon  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which system were you creating?  Mac OS Sierra 12.6.06  ### Installer source origin  Downloader  ### Installer format  .app  ### Installer source details  Downloaded with macUSB  ### Failure stage  Other  ### Target media type  Pendrive  ### Target media capacity  16 GB  ### Is the issue reproducible?  Always  ### Steps to reproduce  The USB creation is finished successfully.  ### Expected result  Create a  12.6.06 bootable USB.  ### Actual result  When I try to install it on a MacBook Air A1466 I get an error: ```The installer payload failed signature check``` I  have formatted the drive to HFS+/GUID. The error occurs at the end of the installation process.  I don't  know if it's relevant but I noticed that  the CFBundleShortVersionString in Info.plist in the USB drive is ```12.6.03```. The downloaded .app is ```12.6.06```.  <img width="400" height="243" alt="Image" src="https://github.com/user-attachments/assets/ce59972d-4a7c-40bd-9070-2dd6b270ba3f" />  [Info.plist.zip](https://github.com/user-attachments/files/26791342/Info.plist.zip)  [macUSB_20260416_182741_logs.txt](https://github.com/user-attachments/files/26791351/macUSB_20260416_182741_logs.txt)  ### Required attachments  - [x] I attached diagnostic logs exported from `Help -> Export diagnostic logs...` - [x] I attached screenshots showing the iss
  **Post-Mortem & Fix Analysis**:
  > The modification of `CFBundleShortVersionString` from `12.6.06` to `12.6.03` is intentional. During testing on Apple Silicon, version `12.6.06` caused `createinstallmedia` to enter a loop with massive RAM spikes, freezing the host and requiring a hard reset. Adjusting the value to `12.6.03` allows `createinstallmedia` to execute correctly.  I've verified the installer's functionality on a MacBook Pro 2015 (A1502) with no issues. I also own a MacBook Air A1466, so I will verify the Sierra installation on my hardware as soon as I return from vacation this weekend.
  > The issue has been identified and successfully resolved. The root cause was the way the downloader constructed the final macOS Sierra `.app` file. I have tested the fix on my own MacBook Air A1466, and with these adjustments, the Sierra installation completes perfectly without any errors.  I will release the update this weekend, so stay tuned!

- **Issue #47** (2026-04-23): **[USB Creation] Creating USB hangs at 99%**
  *Symptoms*: ### macUSB version  2.1 (16)  ### Host macOS version  Tahoe 26.4  ### Host architecture  Apple Silicon  ### Was helper repair executed? (Tools -> Repair helper)  Yes  ### Which system were you creating?  OS X Yosemite 10.2  ### Installer source origin  Downloader  ### Installer format  .dmg  ### Installer source details  Downloaded in macUSB  ### Failure stage  USB creation  ### Target media type  Pendrive  ### Target media capacity  32gb  ### Is the issue reproducible?  Always  ### Steps to reproduce  Any writing of files to the USB  ### Expected result  Completion  ### Actual result  Hangs at 99%  ### Required attachments  - [x] I attached diagnostic logs exported from `Help -> Export diagnostic logs...` - [x] I attached screenshots showing the issue
  **Post-Mortem & Fix Analysis**:
  > <img width="662" height="902" alt="Image" src="https://github.com/user-attachments/assets/dd30612c-7955-4fa7-aaeb-8871684c373d" /> [macUSB_20260414_184144_logs.txt](https://github.com/user-attachments/files/26703114/macUSB_20260414_184144_logs.txt)
  > Hey, it looks like the logs didn't upload correctly and are unavailable. Could you please provide them again?  When it hangs at 99%, does the process remain stuck even after waiting for 5 minutes? This might be a GUI-only issue due to how the progress is calculated. Since createinstallmedia doesn't natively provide progress data to the helper, the percentage is estimated by summing transferred data based on copy speed. The application might still be performing the task in the background despite the UI not updating.  Let me know!
  > Closing due to lack of response. If the issue persists, please open a new one.

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

### Incident Patch 1: `b0603758` (2026-09-19)
**Commit Message**: Clarify README compatibility and image writing guidance

Clarify Golden Gate host requirements, document raw image writing for ISO and IMG files, and simplify PowerPC guidance with the macusb.app guide link.

**File**: `README.md` (modified, +14/-14)
```diff
@@ -210,7 +210,7 @@ macOS versions recognized and supported for USB creation:
 | **Mac OS X Leopard** | 10.5 | ✅ |
 | **Mac OS X Tiger**[^4] | 10.4 | ✅ |
 
-[^1]: USB creation is supported on **Apple Silicon only.**
+[^1]: Creating a bootable USB installer for **macOS Golden Gate** is supported only on Macs with **Apple Silicon**. The Mac used to create the installer does not need to be running macOS Golden Gate.
 [^2]: Only **10.12.6** is supported.
 [^3]: Fully verified with the image from [Mavericks Forever](https://mavericksforever.com/). Other sources may fail.
 [^4]: **Single-DVD** images are auto-detected. For **Multi-DVD** images, only the first disc is recognized correctly. Other discs may appear as unrecognized or be identified incorrectly. To use them, force detection manually from **Options** → **Skip file analysis** → **Mac OS X Tiger 10.4 (Multi DVD)**.
@@ -252,28 +252,28 @@ macUSB also supports creating bootable USB media from Linux `.iso` images.
 
 When a Linux image is recognized, macUSB detects the distribution, version, and architecture automatically. ARM builds are labeled directly in the detected name, for example `Linux - Ubuntu 26.04 (ARM)`.
 
-If a selected file is a valid Linux image but is not recognized automatically, you can force Linux mode manually from **Options** → **Skip file analysis** → **Linux**.
+> Linux support has been tested with 19 distributions.[^5]
 
-Linux-based `.img` images can also be written from **Tools** → **Write Raw Linux Image (.img)…**. This raw-image path is separate from the officially boot-tested Linux `.iso` support matrix.
+[^5]: Validated distributions: *Ubuntu*, *Kali Linux*, *NixOS*, *Garuda Linux*, *openSUSE Leap*, *Gentoo*, *Rocky Linux*, *Linux Mint*, *Fedora Workstation*, *Manjaro*, *Zorin OS*, *CachyOS*, *AlmaLinux*, *Debian*, *Arch Linux*, *MX Linux*, *Pop!_OS*, *EndeavourOS*, and *elementary OS*. Testing used the latest versions available as of April 30, 2026. Boot behavior was verified on a MacBook Air 2017, a Dell OptiPlex 5040 with UEFI, and an Asus F52Q with Legacy BIOS.
 
-> Linux support has been tested with 19 distributions using the latest available releases as of April 30, 2026, with boot behavior verified on real hardware.[^5]
+---
 
-[^5]: Validated distributions: *Ubuntu*, *Kali Linux*, *NixOS*, *Garuda Linux*, *openSUSE Leap*, *Gentoo*, *Rocky Linux*, *Linux Mint*, *Fedora Workstation*, *Manjaro*, *Zorin OS*, *CachyOS*, *AlmaLinux*, *Debian*, *Arch Linux*, *MX Linux*, *Pop!_OS*, *EndeavourOS*, and *elementary OS*. Boot behavior was verified on a MacBook Air 2017, a Dell OptiPlex 5040 with UEFI, and an Asus F52Q with Legacy BIOS.
+## 💾 Raw Image Writing
 
----
+macUSB can write `.iso` and `.img` image files directly to external drives using **Tools → Write a Raw Image to a Drive…**.
 
-## 🧩 PowerPC Notes
+This method can also be used when a Linux image is not recognized during analysis.
 
-If you are reviving a PowerPC Mac, the project website includes a dedicated Open Firmware guide based on real boot testing of PowerPC USB workflows created with macUSB.
+> [!NOTE]
+> The resulting media is not guaranteed to be bootable. Bootability depends on the structure and compatibility of the source image.
 
-Validated scenarios include:
-- **Mac OS X Tiger** and **Mac OS X Leopard** boot scenarios,
-- **Single DVD** editions, and for Tiger also the **Multi-DVD** path,
-- Open Firmware boot commands verified in real hardware tests, including an **iMac G5**.
+---
+
+## 🧩 PowerPC Notes
 
-Use the [step-by-step guide](https://kruszoneq.github.io/macUSB/pages/guides/ppc_boot_instructions.html) for setup and boot instructions.
+For instructions on booting a USB installer created with macUSB on a PowerPC Mac, see the [Open Firmware USB boot guide](https://macusb.app/pages/guides/ppc_boot_instructions.html).
 
-> PowerPC USB boot behavior can vary by model. During validation testing, USB boot was confirmed on an **iMac G5**, while an **iBook G4 (2003)** detected the USB device but did not boot from it successfully.
+> USB boot compatibility depends on the Mac model and its Open Firmware version. Not every PowerPC Mac can boot from USB.
 
 ---
 
```

---

### Incident Patch 2: `f45a6509` (2026-09-19)
**Commit Message**: Merge pull request #118 from Kruszoneq/fix/helper_lifecycle

Manage helper lifetime with the app

**File**: `docs/reference/core/APP_RUNTIME_OVERVIEW.md` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ The Help menu provides diagnostic-log export through its menu item and the `Opti
 - App termination is coordinated through a process-wide active-operation registry.
 - Quit requests and main-window close requests are rejected while analysis, USB creation, the downloader window, Rosetta installation, helper repair, long helper work, cleanup, or USB ejection is active.
 - An allowed termination runs the idempotent application cleanup before exit; cleanup errors are logged and do not keep the app running.
+- The privileged helper is launch-on-demand, remains connected and ready while the app runs, and exits after the app disconnects and all privileged work reaches a terminal state.
+- Normal termination closes helper XPC explicitly; app crash and Force Quit are handled by helper-side XPC connection-loss detection.
 
 ## Active Operation and Termination Model
 
```

**File**: `docs/reference/core/FILE_STRUCTURE.md` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@
 - `macUSBHelper/main.swift`
 - `macUSBHelper/IPC/*`
 - `macUSBHelper/Service/*`
+- `macUSBHelper/Service/HelperProcessLifecycle.swift` — tracks XPC connections and privileged operations so the launch-on-demand helper exits safely after normal app termination, crash, or Force Quit.
 - `macUSBHelper/Workflow/*`
 - `macUSBHelper/Workflow/Linux/*` — Linux raw-copy stage builder, parser, and disk ops.
 - `macUSBHelper/Workflow/Windows/*` — Windows ISO-copy stage builder, exact formatted-target partition and mount-point resolution, boot-mode-aware source/target validation, progress parsing, and verification.
```

**File**: `docs/reference/core/RISK_AREAS.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ Keep this file current with operational hotspots that can cause regressions.
 - Old Yosemite–Catalina installers may still fail after Rosetta removes `EBADARCH`; Rosetta availability is a prerequisite, not a guarantee of complete legacy installer compatibility.
 - Termination during privileged or destructive work can leave media, mounts, or temporary data in an indeterminate state; every new long-running operation must acquire and release an active-operation token on all terminal paths.
 - A helper cancellation acknowledgement is not a terminal workflow result. App-side USB and helper tokens remain active until the helper sends the final result or the XPC connection is invalidated.
+- Helper process exit is gated by both client-connection and privileged-operation leases. App crash or Force Quit may request cancellation, but the daemon must not exit during a non-cancellable safety-critical stage.
 
 ## Mitigation Pattern
 
```

**File**: `docs/reference/features/helper/HELPER.md` (modified, +15/-1)
```diff
@@ -75,6 +75,9 @@ The helper system has two runtime layers:
 High-level model:
 - App-side validates readiness, manages registration/repair, and communicates via XPC.
 - Daemon executes privileged workflows and sends progress/result events back to app-side.
+- The daemon is launch-on-demand and stays alive while the app holds its XPC connection.
+- Normal termination explicitly closes that connection; crash and Force Quit are observed as connection loss by the daemon.
+- With no client connection, cancellable work is cancelled and the daemon exits after all active privileged operations reach a terminal state.
 
 Core invariant:
 - No terminal fallback privileged path.
@@ -134,8 +137,17 @@ Contract invariants:
 - Checks app location and helper service status.
 - Handles status states (`enabled`, `requiresApproval`, `notRegistered`, `notFound`).
 - Performs health validation via XPC after configuring app-side helper code-signing requirements.
+- The successful startup health validation creates the persistent app-lifetime XPC connection and starts the on-demand helper.
 - Uses controlled recovery when enabled service is unhealthy.
 
+### Process Lifecycle Flow
+- LaunchDaemon plists advertise the XPC Mach service without `RunAtLoad`; registration and user approval persist independently of the helper process.
+- `HelperProcessLifecycle` tracks accepted XPC connections and active privileged operations.
+- The helper schedules a short idle exit when both counts reach zero. A new connection or operation cancels the pending exit.
+- App termination explicitly invalidates its XPC connection after termination cleanup.
+- XPC invalidation or interruption also covers app crash and Force Quit. It requests cancellation for active USB and downloader work; non-cancellable stages and Rosetta installation finish before the process exits.
+- The helper process exiting does not unregister the service. A later Mach-service connection launches it again on demand.
+
 ### Passive Readiness Probe
 - Downloader uses an app-side passive readiness probe that reads `SMAppService` status and performs a bounded XPC health check only when the service is enabled.
 - The probe distinguishes user approval required from other helper unavailability.
@@ -247,7 +259,9 @@ Daemon helper runtime:
 - `macUSBHelper/Service/PrivilegedHelperServiceCapabilities.swift`
   - helper capability identifiers and advertised capability payload.
 - `macUSBHelper/Service/HelperListenerDelegate.swift`
-  - listener delegate and connection wiring.
+  - listener delegate, connection wiring, and client-disconnection handling.
+- `macUSBHelper/Service/HelperProcessLifecycle.swift`
+  - process-lifetime leases for XPC connections and privileged operations, including guarded idle exit.
 - `macUSBHelper/Workflow/HelperWorkflowExecutor.swift`
   - USB workflow execution orchestration and cancellation.
 - `macUSBHelper/Workflow/HelperWorkflowStages.swift`
```

**File**: `docs/reference/platform/PERMISSIONS_AND_BACKGROUND.md` (modified, +4/-0)
```diff
@@ -23,6 +23,10 @@ Startup and helper readiness flows must surface missing prerequisites.
 - The pre-settings check acts as a best-effort registration probe so macOS can add macUSB to the Full Disk Access list before the user enables it.
 - The Full Disk Access panel uses the current System Settings deep link for supported macOS versions, with the existing general System Settings fallback if the deep link cannot be opened.
 - Helper background approval is checked at startup and in ensure-ready/repair flows.
+- The registered LaunchDaemon runs on demand: startup readiness opens and retains an XPC connection for the lifetime of the app instead of relying on `RunAtLoad`.
+- Normal app termination explicitly invalidates the XPC connection. A crash or Force Quit is detected by the helper through XPC connection loss.
+- After the final client disconnects, the helper cancels cancellable work and exits once no privileged operation remains. Non-cancellable safety-critical work reaches its terminal state before exit.
+- The helper remains registered and approved while its process is stopped, so the next app launch can start it through the Mach service without repeating approval.
 - Downloader presentation and app reactivation passively refresh Full Disk Access, helper service approval, and XPC health without registering or repairing the helper.
 - Downloader discovery remains available with missing prerequisites, but a download session cannot start until Full Disk Access and helper readiness are confirmed.
 - Downloader prerequisite alerts use the current System Settings terminology `Aktywność aplikacji w tle` / `App Background Activity` and open the corresponding settings panel directly.
```

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +6/-2)
```diff
@@ -15,6 +15,7 @@
 		A10000012F00000100000031 /* IPC/HelperIPC.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000021 /* IPC/HelperIPC.swift */; };
 		A10000012F00000100000032 /* Service/PrivilegedHelperService.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000022 /* Service/PrivilegedHelperService.swift */; };
 		A10000012F00000100000033 /* Service/HelperListenerDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000023 /* Service/HelperListenerDelegate.swift */; };
+		H10000012F00000100000001 /* Service/HelperProcessLifecycle.swift in Sources */ = {isa = PBXBuildFile; fileRef = H10000012F00000100000002 /* Service/HelperProcessLifecycle.swift */; };
 		A10000012F00000100000034 /* Workflow/HelperWorkflowExecutor.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000024 /* Workflow/HelperWorkflowExecutor.swift */; };
 		A10000012F00000100000035 /* Workflow/HelperWorkflowStages.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000025 /* Workflow/HelperWorkflowStages.swift */; };
 		A10000012F00000100000036 /* Workflow/HelperWorkflowProgressParsing.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000026 /* Workflow/HelperWorkflowProgressParsing.swift */; };
@@ -135,6 +136,7 @@
 		A10000012F00000100000021 /* IPC/HelperIPC.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = IPC/HelperIPC.swift; sourceTree = "<group>"; };
 		A10000012F00000100000022 /* Service/PrivilegedHelperService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Service/PrivilegedHelperService.swift; sourceTree = "<group>"; };
 		A10000012F00000100000023 /* Service/HelperListenerDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Service/HelperListenerDelegate.swift; sourceTree = "<group>"; };
+		H10000012F00000100000002 /* Service/HelperProcessLifecycle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Service/HelperProcessLifecycle.swift; sourceTree = "<group>"; };
 		A10000012F00000100000024 /* Workflow/HelperWorkflowExecutor.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/HelperWorkflowExecutor.swift; sourceTree = "<group>"; };
 		A10000012F00000100000025 /* Workflow/HelperWorkflowStages.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/HelperWorkflowStages.swift; sourceTree = "<group>"; };
 		A10000012F00000100000026 /* Workflow/HelperWorkflowProgressParsing.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/HelperWorkflowProgressParsing.swift; sourceTree = "<group>"; };
@@ -589,6 +591,7 @@
 				A10000012F00000100000022 /* Service/PrivilegedHelperService.swift */,
 				F10000012F00000100000011 /* Service/PrivilegedHelperServiceCapabilities.swift */,
 				A10000012F00000100000023 /* Service/HelperListenerDelegate.swift */,
+				H10000012F00000100000002 /* Service/HelperProcessLifecycle.swift */,
 				G10000012F00000100000002 /* Rosetta/HelperRosettaInstaller.swift */,
 				A10000012F00000100000024 /* Workflow/HelperWorkflowExecutor.swift */,
 				A10000012F00000100000025 /* Workflow/HelperWorkflowStages.swift */,
@@ -846,6 +849,7 @@
 				A10000012F00000100000032 /* Service/PrivilegedHelperService.swift in Sources */,
 				F10000012F00000100000001 /* Service/PrivilegedHelperServiceCapabilities.swift in Sources */,
 				A10000012F00000100000033 /* Service/HelperListenerDelegate.swift in Sources */,
+				H10000012F00000100000001 /* Service/HelperProcessLifecycle.swift in Sources */,
 				G10000012F00000100000001 /* Rosetta/HelperRosettaInstaller.swift in Sources */,
 				A10000012F00000100000034 /* Workflow/HelperWorkflowExecutor.swift in Sources */,
 				A10000012F00000100000035 /* Workflow/HelperWorkflowStages.swift in Sources */,
@@ -1048,7 +1052,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 43;
+				CURRENT_PROJECT_VERSION = 44;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 27NC66L8P2;
 				ENABLE_APP_SANDBOX = NO;
@@ -1105,7 +1109,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Developer ID Application";
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 43;
+				CURRENT_PROJECT_VERSION = 44;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 27NC66L8P2;
 				ENABLE_APP_SANDBOX = NO;
```

**File**: `macUSB/Resources/LaunchDaemons/com.kruszoneq.macusb.helper.debug.plist` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@
 		<key>com.kruszoneq.macusb.helper.debug</key>
 		<true/>
 	</dict>
-	<key>RunAtLoad</key>
-	<true/>
 	<key>KeepAlive</key>
 	<false/>
 </dict>
```

**File**: `macUSB/Resources/LaunchDaemons/com.kruszoneq.macusb.helper.plist` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@
 		<key>com.kruszoneq.macusb.helper</key>
 		<true/>
 	</dict>
-	<key>RunAtLoad</key>
-	<true/>
 	<key>KeepAlive</key>
 	<false/>
 </dict>
```

---

### Incident Patch 3: `342bb95a` (2026-09-18)
**Commit Message**: Fix macUSBoot resource packaging

Copy only the pinned macUSBoot artifact files into the app bundle so repository documentation does not invalidate the BIOS helper capability.

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +31/-3)
```diff
@@ -43,7 +43,9 @@
 		B10000012F00000100000001 /* macUSB/Resources/Sounds/burn_complete.aif in Resources */ = {isa = PBXBuildFile; fileRef = B10000012F00000100000002 /* macUSB/Resources/Sounds/burn_complete.aif */; };
 		C10000012F00000100000001 /* ../macUSB/Shared/Localization/HelperWorkflowLocalizationKeys.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10000012F00000100000002 /* ../macUSB/Shared/Localization/HelperWorkflowLocalizationKeys.swift */; };
 		D10000012F00000100000001 /* macUSB/Resources/Icons/Linux/Distros in Resources */ = {isa = PBXBuildFile; fileRef = D10000012F00000100000002 /* macUSB/Resources/Icons/Linux/Distros */; };
-		E10000012F00000100000001 /* macUSB/Resources/Bootloaders/macUSBoot in Resources */ = {isa = PBXBuildFile; fileRef = E10000012F00000100000002 /* macUSB/Resources/Bootloaders/macUSBoot */; };
+		E10000012F00000100000003 /* manifest.json in Copy macUSBoot Artifacts */ = {isa = PBXBuildFile; fileRef = E10000012F00000100000006 /* manifest.json */; };
+		E10000012F00000100000004 /* macUSBoot-v1.0.bin in Copy macUSBoot Artifacts */ = {isa = PBXBuildFile; fileRef = E10000012F00000100000007 /* macUSBoot-v1.0.bin */; };
+		E10000012F00000100000005 /* macUSBoot-v1.0.bin.sha256 in Copy macUSBoot Artifacts */ = {isa = PBXBuildFile; fileRef = E10000012F00000100000008 /* macUSBoot-v1.0.bin.sha256 */; };
 		F10000012F00000100000001 /* Service/PrivilegedHelperServiceCapabilities.swift in Sources */ = {isa = PBXBuildFile; fileRef = F10000012F00000100000011 /* Service/PrivilegedHelperServiceCapabilities.swift */; };
 		F10000012F00000100000002 /* Workflow/Windows/HelperWorkflowWindowsBootValidation.swift in Sources */ = {isa = PBXBuildFile; fileRef = F10000012F00000100000012 /* Workflow/Windows/HelperWorkflowWindowsBootValidation.swift */; };
 		F10000012F00000100000003 /* Workflow/Windows/MacUSBoot/HelperWorkflowWindowsMacUSBootTypes.swift in Sources */ = {isa = PBXBuildFile; fileRef = F10000012F00000100000013 /* Workflow/Windows/MacUSBoot/HelperWorkflowWindowsMacUSBootTypes.swift */; };
@@ -103,6 +105,18 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
+		E10000012F0000010000000A /* Copy macUSBoot Artifacts */ = {
+			isa = PBXCopyFilesBuildPhase;
+			buildActionMask = 2147483647;
+			dstPath = macUSBoot;
+			dstSubfolderSpec = 7;
+			files = (
+				E10000012F00000100000003 /* manifest.json in Copy macUSBoot Artifacts */,
+				E10000012F00000100000004 /* macUSBoot-v1.0.bin in Copy macUSBoot Artifacts */,
+				E10000012F00000100000005 /* macUSBoot-v1.0.bin.sha256 in Copy macUSBoot Artifacts */,
+			);
+			runOnlyForDeploymentPostprocessing = 0;
+		};
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
@@ -149,7 +163,10 @@
 		B10000012F00000100000002 /* macUSB/Resources/Sounds/burn_complete.aif */ = {isa = PBXFileReference; lastKnownFileType = audio.aiff; path = macUSB/Resources/Sounds/burn_complete.aif; sourceTree = "<group>"; };
 		C10000012F00000100000002 /* ../macUSB/Shared/Localization/HelperWorkflowLocalizationKeys.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ../macUSB/Shared/Localization/HelperWorkflowLocalizationKeys.swift; sourceTree = "<group>"; };
 		D10000012F00000100000002 /* macUSB/Resources/Icons/Linux/Distros */ = {isa = PBXFileReference; lastKnownFileType = folder; path = macUSB/Resources/Icons/Linux/Distros; sourceTree = "<group>"; };
-		E10000012F00000100000002 /* macUSB/Resources/Bootloaders/macUSBoot */ = {isa = PBXFileReference; lastKnownFileType = folder; path = macUSB/Resources/Bootloaders/macUSBoot; sourceTree = "<group>"; };
+		E10000012F00000100000006 /* manifest.json */ = {isa = PBXFileReference; lastKnownFileType = text.json; path = manifest.json; sourceTree = "<group>"; };
+		E10000012F00000100000007 /* macUSBoot-v1.0.bin */ = {isa = PBXFileReference; lastKnownFileType = file; path = "macUSBoot-v1.0.bin"; sourceTree = "<group>"; };
+		E10000012F00000100000008 /* macUSBoot-v1.0.bin.sha256 */ = {isa = PBXFileReference; lastKnownFileType = text; path = "macUSBoot-v1.0.bin.sha256"; sourceTree = "<group>"; };
+		E10000012F00000100000009 /* README.md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = README.md; sourceTree = "<group>"; };
 		F10000012F00000100000011 /* Service/PrivilegedHelperServiceCapabilities.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Service/PrivilegedHelperServiceCapabilities.swift; sourceTree = "<group>"; };
 		F10000012F00000100000012 /* Workflow/Windows/HelperWorkflowWindowsBootValidation.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsBootValidation.swift; sourceTree = "<group>"; };
 		F10000012F00000100000013 /* Workflow/Windows/MacUSBoot/HelperWorkflowWindowsMacUSBootTypes.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/MacUSBoot/HelperWorkflowWindowsMacUSBootTypes.s
```

---

### Incident Patch 4: `f91457d3` (2026-09-18)
**Commit Message**: Require whole-disk targets for PPC and restore workflows

Normalize PPC and restore selections to physical disks, restrict Option volume reuse to createinstallmedia, and document the target preparation policy.

**File**: `docs/reference/features/usb/USB_VALIDATION_AND_CAPACITY.md` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ For standard `createinstallmedia` workflows, holding Option on the analysis scre
 - changing the presented list does not clear, replace, or hide the name of an already selected disk or volume,
 - a selected eligible volume still skips automatic preformat when the user proceeds, even after Option is released.
 
+The Option volume override applies only to standard `createinstallmedia` workflows. PPC, restore-legacy, and Mavericks restore workflows expose and pass only physical `diskX` targets. If analysis changes into one of these workflows while a volume from that disk was selected earlier, selection is normalized to its parent physical disk. PPC then uses its dedicated APM/HFS+ formatting, while restore workflows use GPT/HFS+ preparation.
+
 Linux, Windows, and manual raw-image workflows keep their existing physical whole-disk selection behavior.
 
 ## Unreadable USB Guidance
```

**File**: `macUSB/Features/Analysis/AnalysisLogic.swift` (modified, +27/-11)
```diff
@@ -129,20 +129,36 @@ final class AnalysisLogic: ObservableObject {
         }
     }
 
-    /// Nośnik przekazywany do etapu instalacji. W trybie PPC flaga
-    /// needsFormatting jest wymuszana na false, ponieważ
-    /// formatowanie (APM + HFS+) jest już wbudowane w dalszy proces.
+    /// Nośnik przekazywany do etapu instalacji. PPC i procesy restore
+    /// zawsze otrzymują fizyczny whole disk. W trybie PPC flaga
+    /// needsFormatting jest wymuszana na false, ponieważ formatowanie
+    /// (APM + HFS+) jest już wbudowane w dalszy proces.
     var selectedDriveForInstallation: USBDrive? {
         guard let drive = selectedDrive else { return nil }
-        guard isPPC else { return drive }
+        let installationDrive: USBDrive
+        if requiresWholeDiskMacOSTarget {
+            if drive.isWholeDiskTarget {
+                installationDrive = drive
+            } else {
+                let wholeDisk = USBDriveLogic.wholeDiskName(from: drive.device)
+                guard let physicalDrive = physicalUSBTargetsCache.first(where: { $0.device == wholeDisk }) else {
+                    return nil
+                }
+                installationDrive = physicalDrive
+            }
+        } else {
+            installationDrive = drive
+        }
+
+        guard isPPC else { return installationDrive }
         return USBDrive(
-            name: drive.name,
-            device: drive.device,
-            size: drive.size,
-            url: drive.url,
-            usbSpeed: drive.usbSpeed,
-            partitionScheme: drive.partitionScheme,
-            fileSystemFormat: drive.fileSystemFormat,
+            name: installationDrive.name,
+            device: installationDrive.device,
+            size: installationDrive.size,
+            url: installationDrive.url,
+            usbSpeed: installationDrive.usbSpeed,
+            partitionScheme: installationDrive.partitionScheme,
+            fileSystemFormat: installationDrive.fileSystemFormat,
             needsFormatting: false
         )
     }
```

**File**: `macUSB/Features/Analysis/Logic/AnalysisLogicUsbDrives.swift` (modified, +15/-4)
```diff
@@ -17,6 +17,10 @@ extension AnalysisLogic {
             && createInstallMediaInspection.architecture != .notApplicable
     }
 
+    var requiresWholeDiskMacOSTarget: Bool {
+        isPPC || isRestoreLegacy || isMavericks
+    }
+
     var usesPhysicalUSBTargetSelection: Bool {
         isLinuxDetected || isWindowsWorkflowSupported || isMacOSUSBTargetWorkflow
     }
@@ -101,13 +105,20 @@ extension AnalysisLogic {
                         && self.supportsMacOSCreateInstallMediaVolumeOverride
                     self.isMacOSCreateInstallMediaVolumeOverrideActive = effectiveVolumeOverride
                     let displayedDrives = effectiveVolumeOverride ? optionDrives : physicalDrives
-                    let selectableDrives = isMacOSPhysicalTargetWorkflow
-                        ? (physicalDrives + optionDrives)
-                        : physicalDrives
+                    let allowsVolumeSelection = isMacOSPhysicalTargetWorkflow
+                        && self.supportsMacOSCreateInstallMediaVolumeOverride
+                    let selectableDrives = allowsVolumeSelection ? optionDrives : physicalDrives
                     let activeSelectionID = self.selectedDriveSelectionID ?? self.selectedDrive?.selectionID
-                    let resolvedSelection = activeSelectionID.flatMap { selectionID in
+                    var resolvedSelection = activeSelectionID.flatMap { selectionID in
                         selectableDrives.first(where: { $0.selectionID == selectionID })
                     }
+                    if resolvedSelection == nil,
+                       isMacOSPhysicalTargetWorkflow,
+                       !allowsVolumeSelection,
+                       let previousSelection = self.selectedDrive {
+                        let selectedWholeDisk = USBDriveLogic.wholeDiskName(from: previousSelection.device)
+                        resolvedSelection = physicalDrives.first(where: { $0.device == selectedWholeDisk })
+                    }
 
                     withAnimation(.easeInOut(duration: 0.18)) {
                         self.synchronizeDriveSelection {
```

**File**: `macUSB/Features/Analysis/SystemAnalysisView.swift` (modified, +5/-2)
```diff
@@ -538,7 +538,7 @@ struct SystemAnalysisView: View {
 
     private var canProceedToInstall: Bool {
         canUseUSBSelection
-            && logic.selectedDrive != nil
+            && logic.selectedDriveForInstallation != nil
             && logic.capacityCheckFinished
             && logic.isCapacitySufficient
             && (!logic.isWindowsWorkflowSupported || logic.selectedFileUrl != nil)
@@ -645,7 +645,10 @@ struct SystemAnalysisView: View {
                 .onChange(of: logic.showUnsupportedMessage) { _ in updateMenuState() }
                 .onChange(of: logic.recognizedVersion) { _ in updateMenuState() }
                 .onChange(of: logic.isAnalyzing) { _ in updateMenuState() }
-                .onChange(of: logic.isSystemDetected) { _ in updateMenuState() }
+                .onChange(of: logic.isSystemDetected) { _ in
+                    updateMenuState()
+                    logic.refreshDrives()
+                }
                 .onChange(of: logic.selectedFilePath) { _ in updateMenuState() }
                 .onChange(of: logic.selectedFilePath) { _ in
                     checksumSheetPresentation = nil
```

---

### Incident Patch 5: `d767c908` (2026-09-12)
**Commit Message**: Use uniform icon for generic Linux detection

Replace the ICNS fallback with the existing PNG resource and update the Linux icon lookup path.

**File**: `docs/reference/features/analysis/ANALYSIS_COMPATIBILITY.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ For Linux fallback:
 - fallback entry is limited to `.iso` sources,
 - detection is considered successful when Linux is recognized, including unknown distro case,
 - recognized Linux result unlocks shared install flow (`UniversalInstallationView -> CreationProgressView -> FinishUSBView`),
-- detected Linux state may present dedicated Linux icon resource (`linux.icns`) in analysis UI.
+- detected Linux state presents the generic `Distros/linux.png` resource when a distro-specific icon is unavailable, with an SF Symbol as the final UI fallback.
 - manual raw-image selection from `Narzędzia -> Zapisz surowy obraz na nośniku...` is a separate exceptional entry point for `.iso` and `.img`; it is not part of standard source selection or fallback detection and enters the existing Linux workflow without content inspection or source mounting.
 - selecting `.iso` through the standard `Wybierz` action remains part of normal macOS/Windows/Linux analysis.
 
```

**File**: `docs/reference/features/analysis/LINUX_ANALYSIS_FLOW.md` (modified, +2/-2)
```diff
@@ -134,8 +134,8 @@ If source size cannot be resolved from file metadata, fallback capacity is `16 G
 Linux detected state uses icon fallback chain:
 
 - first: distro-specific icon from `macUSB/Resources/Icons/Linux/Distros/*.png` when distro is recognized and mapped,
-  runtime lookup supports both `Icons/Linux/Distros` and bundled `Distros` subdirectory variants,
-- second: generic Linux icon `macUSB/Resources/Icons/Linux/linux.icns` (lookup: `Icons/Linux` subdirectory, then bundle root),
+  runtime lookup supports `Icons/Linux/Distros`, bundled `Distros`, and bundle-root variants,
+- second: generic Linux icon `macUSB/Resources/Icons/Linux/Distros/linux.png`, resolved through the same lookup variants,
 - third: SF Symbol fallback in UI when no file icon could be loaded.
 
 ## Logging Contract
```

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +0/-1)
```diff
@@ -286,7 +286,6 @@
 				Features/Welcome/AppBranding.swift,
 				Features/Welcome/WelcomeView.swift,
 				macUSBIcon.icon,
-				Resources/Icons/Linux/linux.icns,
 				Resources/Icons/OS/os_10_7_lion.icns,
 				Resources/Icons/OS/os_10_8_mountain_lion.icns,
 				Resources/Icons/OS/os_10_9_maverics.icns,
```

**File**: `macUSB/Features/Analysis/Logic/Linux/AnalysisLogicLinuxLifecycle.swift` (modified, +3/-5)
```diff
@@ -92,14 +92,12 @@ extension AnalysisLogic {
             return distroIcon
         }
 
-        let nestedURL = Bundle.main.url(forResource: "linux", withExtension: "icns", subdirectory: "Icons/Linux")
-        let rootURL = Bundle.main.url(forResource: "linux", withExtension: "icns")
-        guard let url = nestedURL ?? rootURL, let icon = NSImage(contentsOf: url) else {
-            self.log("Nie znaleziono fallback ikony linux.icns - zostanie użyty SF Symbol.", category: "FileAnalysis")
+        guard let icon = loadLinuxDistroIcon(for: "linux") else {
+            self.log("Nie znaleziono fallback ikony linux.png - zostanie użyty SF Symbol.", category: "FileAnalysis")
             return nil
         }
         icon.isTemplate = false
-        self.log("Załadowano fallback ikonę linux.icns.", category: "FileAnalysis")
+        self.log("Załadowano fallback ikonę linux.png.", category: "FileAnalysis")
         return icon
     }
 
```

**File**: `macUSB/Resources/Icons/Linux/Distros/IconSource.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+# Linux Distribution Icon Sources
+
+## Author
+
+The uniform icon set was created and published by Reddit user `u/walrusz`.
+
+## Source
+
+- [I made a uniform icon set of Linux distribution logos](https://www.reddit.com/r/linux/comments/nt1tm9/i_made_a_uniform_icon_set_of_linux_distribution/)
+
+## Licensing note
+
+The source post does not specify a license covering the complete icon set. The icons are based on distribution logos that may remain subject to their respective copyright, trademark, and brand-usage terms.
```

**File**: `macUSB/Resources/Icons/Linux/Distros/SOURCE_AND_LICENSE.txt` (removed, +0/-2)
```diff
@@ -1,2 +0,0 @@
-Icon source:
-https://www.reddit.com/r/linux/comments/nt1tm9/i_made_a_uniform_icon_set_of_linux_distribution/
```

---

### Incident Patch 6: `cd6af4fb` (2026-09-12)
**Commit Message**: Remove Linux analysis override

Remove the Linux option from the skip-analysis menu together with its unused handling and localization entries, leaving the Tiger Multi-DVD override as the sole menu action.

**File**: `docs/reference/features/analysis/ANALYSIS_COMPATIBILITY.md` (modified, +1/-4)
```diff
@@ -63,7 +63,6 @@ For Linux fallback:
 - detection is considered successful when Linux is recognized, including unknown distro case,
 - recognized Linux result unlocks shared install flow (`UniversalInstallationView -> CreationProgressView -> FinishUSBView`),
 - detected Linux state may present dedicated Linux icon resource (`linux.icns`) in analysis UI.
-- manual Linux force from `Opcje -> Pomiń analizowanie pliku -> Linux` is treated as Linux-recognized state for install handoff only when selected source is `.iso`.
 - manual raw-image selection from `Narzędzia -> Zapisz surowy obraz na nośniku...` is a separate exceptional entry point for `.iso` and `.img`; it is not part of standard source selection or fallback detection and enters the existing Linux workflow without content inspection or source mounting.
 - selecting `.iso` through the standard `Wybierz` action remains part of normal macOS/Windows/Linux analysis.
 
@@ -84,7 +83,6 @@ Linux fallback routing includes:
 
 - recognized Linux distro,
 - Linux with unknown distro (`Linux - nierozpoznana dystrybucja`).
-- manually forced Linux (`Linux`).
 - manually selected raw image (selected filename with neutral presentation).
 
 Windows fallback routing includes:
@@ -162,7 +160,7 @@ This action is optional and user-triggered only; it must not run during automati
 
 Checksum calculation:
 
-- is available for successful `.dmg`, `.iso`, `.cdr`, and manual raw-image selection, including manually forced Linux `.iso` and raw `.iso`/`.img` selection,
+- is available for successful `.dmg`, `.iso`, `.cdr`, and manual raw-image selection, including raw `.iso`/`.img` selection,
 - stays hidden for `.app` sources, unsupported results, unrecognized results, and active analysis,
 - presents the checksum sheet only when the selected source URL is already bound, so the 420 px-wide sheet opens and starts calculation immediately while keeping a 240 px minimum height and allowing taller content,
 - reads the source file in one pass with POSIX file I/O and a fixed 4 MiB buffer,
@@ -197,7 +195,6 @@ Linux fallback should additionally log:
 - Linux attach-session snapshot plus per-entity cleanup result and residual summary,
 - archive-reader diagnostics relevant to bounded execution (`bsdtar` timeout/errors),
 - install handoff readiness (`linuxSourceURL` present, capacity computed).
-- manual-force diagnostics when Linux is forced from menu.
 - manual raw `.iso`/`.img` selection diagnostics when the Tools-menu path is used.
 
 Windows fallback should additionally log:
```

**File**: `docs/reference/features/analysis/LINUX_ANALYSIS_FLOW.md` (modified, +0/-17)
```diff
@@ -8,7 +8,6 @@ Linux detection is a fallback path in analysis, with install handoff enabled.
 
 - Primary path remains macOS installer detection.
 - Linux path runs when macOS installer metadata is not detected from `.iso` source.
-- Linux path can also be forced manually from `Opcje -> Pomiń analizowanie pliku -> Linux` after unsupported/unrecognized analysis, but only when selected source is `.iso`.
 - Manual raw-image path is available only from `Narzędzia -> Zapisz surowy obraz na nośniku...` and accepts `.iso` or `.img`; standard file selection, drag-and-drop, and Linux fallback detection retain their existing behavior.
 - Positive Linux detection unlocks USB selection and installer creation flow.
 
@@ -111,14 +110,6 @@ Linux recognition is shown as successful detection in analysis UI and enables in
 - installation workflow starts from shared summary/progress/finish UI,
 - Linux helper branch uses raw copy (`dd`) stages.
 
-Manual Linux force from menu sets Linux workflow state without distro recognition:
-
-- display name: `Linux`,
-- distro metadata: unresolved (no distro/version/edition),
-- icon: generic Linux fallback (`linux.icns`),
-- source handoff: selected file path is used as `linuxSourceURL`.
-- manual force is available only when selected source extension is `.iso`; for other extensions request is ignored and Linux state is not applied.
-
 Manual raw-image selection sets Linux workflow state without distro recognition:
 
 - display name: selected source filename,
@@ -168,14 +159,6 @@ When Linux fallback runs, logs must include:
 - archive-reader diagnostics for timeout/error cases,
 - ignored stale callback entry when an expired session returns after timeout.
 
-When manual Linux force runs, logs must include:
-
-- manual-force transition entry,
-- selected source path,
-- resolved source file size in bytes (when available),
-- selected USB threshold in GB only.
-- explicit fallback log when source size is unavailable.
-
 When manual raw-image selection runs, logs must include:
 
 - raw `.iso`/`.img` selection transition entry,
```

**File**: `macUSB/App/macUSBApp.swift` (modified, +0/-23)
```diff
@@ -107,29 +107,6 @@ struct macUSBApp: App {
                     }
                     .keyboardShortcut("t", modifiers: [.option, .command])
                     .disabled(!menuState.skipAnalysisEnabled)
-                    Divider()
-                    Button(String(localized: "Linux")) {
-                        let alert = NSAlert()
-                        alert.alertStyle = .informational
-                        alert.icon = NSApp.applicationIconImage
-                        alert.messageText = String(localized: "Tworzenie USB z Linux")
-                        alert.informativeText = String(localized: "Dla wybranego pliku zostanie pominięta analiza i rozpoznanie dystrybucji. Aplikacja wymusi rozpoznanie pliku jako „Linux”, aby umożliwić zapis USB w trybie Linux. Czy chcesz kontynuować?")
-                        alert.addButton(withTitle: String(localized: "Nie"))
-                        alert.addButton(withTitle: String(localized: "Tak"))
-                        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
-                            alert.beginSheetModal(for: window) { response in
-                                if response == .alertSecondButtonReturn {
-                                    NotificationCenter.default.post(name: .macUSBStartLinuxManualSelection, object: nil)
-                                }
-                            }
-                        } else {
-                            let response = alert.runModal()
-                            if response == .alertSecondButtonReturn {
-                                NotificationCenter.default.post(name: .macUSBStartLinuxManualSelection, object: nil)
-                            }
-                        }
-                    }
-                    .disabled(!menuState.skipLinuxManualSelectionEnabled)
                 } label: {
                     Label(String(localized: "Pomiń analizowanie pliku"), systemImage: "doc.text.magnifyingglass")
                 }
```

**File**: `macUSB/Features/Analysis/AnalysisNotifications.swift` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@ import Foundation
 extension Notification.Name {
     static let macUSBResetToStart = Notification.Name("macUSB.resetToStart")
     static let macUSBStartTigerMultiDVD = Notification.Name("macUSB.startTigerMultiDVD")
-    static let macUSBStartLinuxManualSelection = Notification.Name("macUSB.startLinuxManualSelection")
     static let macUSBDebugGoToBigSurSummary = Notification.Name("macUSB.debugGoToBigSurSummary")
     static let macUSBDebugGoToTigerSummary = Notification.Name("macUSB.debugGoToTigerSummary")
     static let macUSBDebugGoToLinuxSummary = Notification.Name("macUSB.debugGoToLinuxSummary")
```

**File**: `macUSB/Features/Analysis/Logic/Linux/AnalysisLogicLinuxLifecycle.swift` (modified, +0/-68)
```diff
@@ -1,6 +1,5 @@
 import Foundation
 import AppKit
-import SwiftUI
 
 private enum LinuxDistroIconCatalog {
     static let names: [String] = [
@@ -87,73 +86,6 @@ private enum LinuxDistroIconCatalog {
 }
 
 extension AnalysisLogic {
-    func forceLinuxManualSelection() {
-        cancelActiveImageAnalysisRun(reason: "Ręczne wymuszenie trybu Linux")
-        guard let sourceURL = self.selectedFileUrl else {
-            self.logError("Nie można wymusić rozpoznania Linux: brak wybranego pliku.")
-            return
-        }
-        let sourceExtension = sourceURL.pathExtension.lowercased()
-        guard sourceExtension == "iso" else {
-            self.logError("Nie można wymusić rozpoznania Linux dla .\(sourceExtension). Opcja „Pomiń analizowanie pliku -> Linux” jest dostępna tylko dla plików .iso.")
-            return
-        }
-        MenuState.shared.lockLanguageChanges(reason: "manual_linux_selection")
-
-        InstallerSourceImageUnmountRegistry.shared.registerSourceImage(
-            path: sourceURL.path,
-            family: .linux,
-            mountHint: mountedDMGPath,
-            reason: "linux_manual_selection"
-        )
-
-        self.log("Ręcznie wybrano tryb Linux (pominięcie analizy pliku).")
-
-        withAnimation {
-            self.isAnalyzing = false
-            self.userSkippedAnalysis = true
-            self.resetLinuxDetectionState()
-            self.resetWindowsDetectionState()
-
-            self.isLinuxDetected = true
-            self.isLinuxDistributionRecognized = false
-            self.linuxDisplayName = "Linux"
-            self.linuxSourceURL = sourceURL
-
-            self.recognizedVersion = "Linux"
-            self.sourceAppURL = nil
-            self.detectedSystemIcon = loadLinuxDetectedSystemIcon(for: nil)
-
-            self.isSystemDetected = true
-            self.showUnsupportedMessage = false
-            self.showUSBSection = false
-
-            self.needsCodesign = true
-            self.isLegacyDetected = false
-            self.isRestoreLegacy = false
-            self.isCatalina = false
-            self.isSierra = false
-            self.isMavericks = false
-            self.isUnsupportedSierra = false
-            self.isPPC = false
-            self.legacyArchInfo = nil
-            self.selectedDrive = nil
-            self.capacityCheckFinished = false
-        }
-
-        let capacityResolution = resolveRequiredUSBCapacityForImageSource(sourceURL)
-        self.requiredUSBCapacityGB = capacityResolution.requiredCapacityGB
-        if let fileSizeBytes = capacityResolution.sourceFileSizeBytes,
-           let fileSizeSource = capacityResolution.sourceFileSizeSource {
-            self.log("Linux manual source size: \(fileSizeBytes) bytes (source=\(fileSizeSource))")
-        } else if capacityResolution.usedFallback {
-            self.log("Linux manual source size unavailable. Applying fallback USB threshold: \(capacityResolution.requiredCapacityGB) GB")
-        }
-        self.log("Linux manual required USB threshold: \(capacityResolution.requiredCapacityGB) GB")
-
-        self.log("Ustawiono ręczne rozpoznanie Linux: recognizedVersion=\(self.recognizedVersion), source=\(sourceURL.path)")
-    }
-
     func loadLinuxDetectedSystemIcon(for distro: String?) -> NSImage? {
         if let distro, let distroIcon = loadLinuxDistroIcon(for: distro) {
             self.log("Załadowano ikonę Linux distro: \(distro)")
```

**File**: `macUSB/Features/Analysis/SystemAnalysisView.swift` (modified, +0/-12)
```diff
@@ -85,14 +85,6 @@ struct SystemAnalysisView: View {
             && logic.macOSArchitectureBlockReason == nil
             && (unrecognizedBlocking || recognizedUnsupported)
         MenuState.shared.skipAnalysisEnabled = skipAnalysisEnabled
-
-        let sourceExtension: String
-        if let selectedFileUrl = logic.selectedFileUrl {
-            sourceExtension = selectedFileUrl.pathExtension.lowercased()
-        } else {
-            sourceExtension = URL(fileURLWithPath: logic.selectedFilePath).pathExtension.lowercased()
-        }
-        MenuState.shared.skipLinuxManualSelectionEnabled = skipAnalysisEnabled && sourceExtension == "iso"
         MenuState.shared.rawLinuxImageSelectionEnabled = analysisFinished && !hasAnySelection
     }
     
@@ -206,7 +198,6 @@ struct SystemAnalysisView: View {
         windowsWillSplitWIMSnapshot = false
         macOSRosettaRequirementSnapshot = .notRequired
         MenuState.shared.skipAnalysisEnabled = false
-        MenuState.shared.skipLinuxManualSelectionEnabled = false
         updateMenuState()
     }
 
@@ -711,9 +702,6 @@ struct SystemAnalysisView: View {
                 .onReceive(NotificationCenter.default.publisher(for: .macUSBStartTigerMultiDVD)) { _ in
                     logic.forceTigerMultiDVDSelection()
                 }
-                .onReceive(NotificationCenter.default.publisher(for: .macUSBStartLinuxManualSelection)) { _ in
-                    logic.forceLinuxManualSelection()
-                }
                 .onReceive(NotificationCenter.default.publisher(for: .macUSBApplyPendingDownloaderInstaller)) { _ in
                     consumePendingDownloaderInstallerAndAnalyze()
                 }
```

**File**: `macUSB/Resources/Localizable.xcstrings` (modified, +0/-228)
```diff
@@ -8415,82 +8415,6 @@
         }
       }
     },
-    "Dla wybranego pliku zostanie pominięta analiza i rozpoznanie dystrybucji. Aplikacja wymusi rozpoznanie pliku jako „Linux”, aby umożliwić zapis USB w trybie Linux. Czy chcesz kontynuować?" : {
-      "localizations" : {
-        "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Die Analyse und Distributionserkennung wird für die ausgewählte Datei übersprungen. Die Anwendung erzwingt die Erkennung der Datei als „Linux“, um das Schreiben auf USB im Linux-Modus zu ermöglichen. Möchten Sie fortfahren?"
-          }
-        },
-        "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Analysis and distribution detection will be skipped for the selected file. The application will force recognition of the file as “Linux” to enable writing to USB in Linux mode. Do you want to continue?"
-          }
-        },
-        "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Se omitirá el análisis y el reconocimiento de la distribución para el archivo seleccionado. La aplicación forzará el reconocimiento del archivo como «Linux» para permitir la escritura en USB en modo Linux. ¿Desea continuar?"
-          }
-        },
-        "fr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "L’analyse et la détection de la distribution seront ignorées pour le fichier sélectionné. L’application forcera la reconnaissance du fichier comme « Linux » pour permettre l’écriture sur USB en mode Linux. Voulez-vous continuer ?"
-          }
-        },
-        "it" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Per il file selezionato verranno ignorate l'analisi e il riconoscimento della distribuzione. L'applicazione forzerà il riconoscimento del file come \"Linux\" per consentire la scrittura su USB in modalità Linux. Vuoi continuare?"
-          }
-        },
-        "ja" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "選択したファイルでは、解析とディストリビューションの検出がスキップされます。アプリケーションはファイルを「Linux」として強制的に認識し、LinuxモードでUSBに書き込めるようにします。続けますか？"
-          }
-        },
-        "pt-BR" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "A análise e o reconhecimento da distribuição serão ignorados para o arquivo selecionado. O aplicativo forçará o reconhecimento do arquivo como \"Linux\" para permitir a gravação em USB no modo Linux. Deseja continuar?"
-          }
-        },
-        "ru" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Для выбранного файла будут пропущены анализ и распознавание дистрибутива. Приложение принудительно распознает файл как «Linux», чтобы разрешить запись на USB в режиме Linux. Вы хотите продолжить?"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Seçilen dosya için analiz ve dağıtımın algılanması atlanacaktır. Uygulama, Linux modunda USB’ye yazmayı mümkün kılmak için dosyanın “Linux” olarak tanınmasını zorlayacaktır. Devam etmek istiyor musunuz?"
-          }
-        },
-        "uk" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Для вибраного файлу аналіз і розпізнавання дистрибутива буде пропущено. Програма примусово розпізнає файл як «Linux», щоб дозволити запис на USB у режимі Linux. Ви хочете продовжити?"
-          }
-        },
-        "vi" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Việc phân tích và nhận diện bản phân phối sẽ được bỏ qua đối với tệp đã chọn. Ứng dụng sẽ buộc nhận diện tệp là \"Linux\" để cho phép ghi USB ở chế độ Linux. Bạn có muốn tiếp tục không?"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "将跳过对所选文件的分析和发行版识别。应用程序将强制将该文件识别为“Linux”，以便在 Linux 模式下写入 USB。您想继续吗？"
-          }
-        }
-      }
-    },
     "Do Maca jest podłączony zewnętrzny nośnik USB, którego macOS nie może odczytać. Otwórz Narzędzie dyskowe i wymaż nośnik do formatu obsługiwanego przez macOS, a następnie wybierz go ponownie." : {
       "localizations" : {
         "de" : {
@@ -28345,82 +28269,6 @@
         }
       }
     },
-    "Linux" : {
-      "localizations" : {
-        "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Linux"
-          }
-        },
-        "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Linux"
-          }
-        },
-        "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Linux"
-          }
-        },
-        "fr" : {
-          "stringUnit" : {
-            "state" : "translate
```

**File**: `macUSB/Shared/Services/MenuState.swift` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import Combine
 final class MenuState: ObservableObject {
     static let shared = MenuState()
     @Published var skipAnalysisEnabled: Bool = false
-    @Published var skipLinuxManualSelectionEnabled: Bool = false
     @Published var externalDrivesEnabled: Bool = UserDefaults.standard.bool(forKey: "AllowExternalDrives")
     @Published var notificationsEnabled: Bool = false
     @Published var hasFullDiskAccess: Bool = true
```

---

### Incident Patch 7: `cec001c6` (2026-08-28)
**Commit Message**: Translate disk image output UI

Add and review translations for the disk image option, stage, alerts, status messages, and summary text across all supported non-Polish languages.

**File**: `macUSB/Resources/Localizable.xcstrings` (modified, +1957/-157)
```diff
@@ -9279,251 +9279,2051 @@
     },
     "downloader.disk_image.collision.cancel" : {
       "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Download abbrechen"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Cancel Download"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Cancelar descarga"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Annuler le téléchargement"
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Annulla download"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "ダウンロードをキャンセル"
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Anuluj pobieranie"
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Cancelar download"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Отменить загрузку"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "İndirmeyi İptal Et"
+          }
+        },
+        "uk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Скасувати завантаження"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Hủy tải về"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "取消下载"
+          }
+        }
+      }
+    },
+    "downloader.disk_image.collision.continue" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Mit neuem Namen fortfahren"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Continue with New Name"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Continuar con un nombre nuevo"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Continuer avec un nouveau nom"
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Continua con un nuovo nome"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "新しい名前で続ける"
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Kontynuuj z nową nazwą"
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Continuar com novo nome"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Продолжить с новым именем"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Yeni Adla Devam Et"
+          }
+        },
+        "uk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Продовжити з новою назвою"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Tiếp tục với tên mới"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "使用新名称继续"
+          }
+        }
+      }
+    },
+    "downloader.disk_image.collision.message" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Der Ordner „%@“ enthält bereits die Datei „%@“. Wenn du fortfährst, wird das neue Image als „%@“ gesichert."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "The folder “%@” already contains “%@”. If you continue, the new disk image will be saved as “%@”."
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "La carpeta «%@» ya contiene el archivo «%@». Si continúas, la nueva imagen se guardará como «%@»."
+          }
+        },
+      
```

---

### Incident Patch 8: `cf1a8480` (2026-08-26)
**Commit Message**: Update diagnostic log issue guidance

Place log export instructions next to upload fields and direct reporters to use the Option (⌥) + L shortcut.

**File**: `.github/ISSUE_TEMPLATE/bug_app_general.yml` (modified, +1/-6)
```diff
@@ -96,7 +96,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "If relevant to the issue, attach the exported .txt diagnostic log."
+      description: "If relevant to the issue, export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: false
       accept: ".txt"
@@ -109,8 +109,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

**File**: `.github/ISSUE_TEMPLATE/bug_downloader.yml` (modified, +1/-6)
```diff
@@ -104,7 +104,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "Attach the exported .txt diagnostic log."
+      description: "Export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: true
       accept: ".txt"
@@ -117,8 +117,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

**File**: `.github/ISSUE_TEMPLATE/bug_linux_usb_creation.yml` (modified, +1/-6)
```diff
@@ -140,7 +140,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "Attach the exported .txt diagnostic log."
+      description: "Export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: true
       accept: ".txt"
@@ -153,8 +153,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

**File**: `.github/ISSUE_TEMPLATE/bug_macos_usb_creation.yml` (modified, +1/-6)
```diff
@@ -145,7 +145,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "Attach the exported .txt diagnostic log."
+      description: "Export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: true
       accept: ".txt"
@@ -158,8 +158,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

**File**: `.github/ISSUE_TEMPLATE/bug_macusboot_bios_boot.yml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ body:
       value: |
         Please fill in all required fields.
         Attach a photo or video if it helps show the boot problem.
-        If the problem occurred while creating the USB storage device, attach diagnostic logs exported from `Help -> Export diagnostic logs...`.
+        If the problem occurred while creating the USB storage device, export diagnostic logs using `Option (⌥) + L`, then attach the exported file.
 
   - type: input
     id: app_version
@@ -117,7 +117,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "If the problem occurred while creating the USB storage device, attach the .txt diagnostic log exported from `Help -> Export diagnostic logs...`."
+      description: "If the problem occurred while creating the USB storage device, export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: false
       accept: ".txt"
```

**File**: `.github/ISSUE_TEMPLATE/bug_other.yml` (modified, +1/-6)
```diff
@@ -21,7 +21,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "Optionally attach the exported .txt diagnostic log."
+      description: "Optionally export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: false
       accept: ".txt"
@@ -34,8 +34,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

**File**: `.github/ISSUE_TEMPLATE/bug_windows_usb_creation.yml` (modified, +1/-6)
```diff
@@ -151,7 +151,7 @@ body:
     id: diagnostic_logs
     attributes:
       label: "Diagnostic logs"
-      description: "Attach the exported .txt diagnostic log."
+      description: "Export diagnostic logs using Option (⌥) + L, then attach the exported .txt file."
     validations:
       required: true
       accept: ".txt"
@@ -164,8 +164,3 @@ body:
     validations:
       required: false
       accept: ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm"
-
-  - type: markdown
-    attributes:
-      value: |
-        Diagnostic logs can be exported from `Help -> Export diagnostic logs...`.
```

---

### Incident Patch 9: `623703ca` (2026-08-25)
**Commit Message**: Merge pull request #111 from Kruszoneq/fix/downloader_permissions

Gate downloader downloads on required permissions

**File**: `docs/AGENTS.md` (modified, +3/-0)
```diff
@@ -99,6 +99,7 @@ These are the non-negotiable runtime contracts. If a task touches any of them, p
   - `macUSBPrimaryButtonStyle`
   - `macUSBSecondaryButtonStyle`
 - Spacing/radii use `MacUSBDesignTokens`.
+- Dynamic lists, their contextual banners/status cards, and conditional header actions must follow the global motion rules in `docs/reference/design/DESIGN_SYSTEM.md`, including symmetric appearance and disappearance.
 - `DEBUG` UI must not appear in Release builds.
 
 ### Localization invariants
@@ -137,6 +138,8 @@ These are the non-negotiable runtime contracts. If a task touches any of them, p
   - correct macOS and Apple terminology,
   - consistency with the meaning and context of the UI element.
 - Before completing the task, perform a final verification of all localization keys and translations.
+- Edit `Localizable.xcstrings` in the exact target serialization format produced by Xcode: two-space indentation, spaced `"key" : value` separators, expanded multiline objects, Xcode's case-insensitive natural catalog order for string keys, lexicographically ordered locale identifiers, and no compact inline localization entries. Opening or saving the catalog in Xcode must not produce a formatting-only diff.
+- Mark an actively used localization key as `"extractionState" : "manual"` when it is intentionally resolved through dynamic indirection that Xcode string extraction cannot discover; do not accept `stale` for such a key.
 - In the post-implementation report, list every localization key created or modified together with its translation in every supported language.
 - Do not place a period at the end of banner or alert titles.
 - Every `NSAlert` must include:
```

**File**: `docs/reference/core/FILE_STRUCTURE.md` (modified, +3/-0)
```diff
@@ -89,7 +89,9 @@
 ### Downloader layout
 
 - `macUSB/Features/Downloader/MacOSDownloaderCoordinator.swift`
+- `macUSB/Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift` — combines Full Disk Access and passive helper readiness into the downloader gate while rejecting stale checks.
 - `macUSB/Features/Downloader/UI/*`
+- `macUSB/Features/Downloader/UI/MacOSDownloaderPrerequisiteAlerts.swift` — prerequisite alert variants and direct System Settings actions.
 - `macUSB/Features/Downloader/Logic/Discovery/*`
 - `macUSB/Features/Downloader/Logic/Download/*`
 - `macUSB/Features/Downloader/Logic/Assembly/*`
@@ -105,6 +107,7 @@
 - `macUSB/Shared/Services/Helper/PrivilegedOperationClientActivity.swift` — lifecycle tokens for long USB and downloader helper tasks.
 - `macUSB/Shared/Services/Helper/HelperServiceManager.swift`
 - `macUSB/Shared/Services/Helper/HelperService/*`
+- `macUSB/Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift` — passive `SMAppService` status and XPC health snapshot without recovery side effects.
 - `macUSB/Shared/Services/InstallerSourceImageUnmountRegistry.swift` — centralny rejestr śledzenia zamontowanych źródeł ISO (Windows/Linux) i cleanup odmontowania przy zamknięciu aplikacji; ręczne źródła raw nie są rejestrowane.
 
 ### Helper (daemon)
```

**File**: `docs/reference/core/USER_FLOW.md` (modified, +2/-0)
```diff
@@ -51,6 +51,8 @@ Windows-specific runtime behavior:
 - `SystemAnalysisView` also exposes `Pobierz` between `Wybierz` and `Analizuj` for direct downloader access.
 - Downloader opening is blocked during USB creation operation stages (`UniversalInstallationView`, `CreationProgressView`, `FinishUSBView`), and `Tools -> Pobierz instalator macOS...` is disabled there.
 - Discovery starts on entering downloader window (never on app startup).
+- Downloader also passively checks Full Disk Access and helper XPC readiness on entry and app activation. Missing prerequisites do not block discovery or selection, but they surface an orange warning action and block `Download` before any session begins.
+- Selecting the prerequisite warning or attempting a blocked download presents an actionable app-icon alert. Returning from System Settings refreshes the state without rerunning discovery or clearing selection.
 - While discovery runs, header/options remain visible; list area shows scanning panel.
 - After discovery completes, grouped systems list is shown.
 - On downloader summary, when final `.app` exists, icon action can pass installer path to analysis and trigger automatic analysis; from Welcome, app navigates to analysis first.
```

**File**: `docs/reference/design/DESIGN_SYSTEM.md` (modified, +24/-1)
```diff
@@ -32,6 +32,29 @@ Use global in-app toasts only for transient, non-blocking state changes; they sh
 - Downloader and helper UI should remain visually coherent with the same design language.
 - DEBUG-only UI must never appear in Release builds.
 
+## Motion and Dynamic Content Contract
+
+Visibility changes initiated by the user must be animated consistently when they affect expandable or filtered lists, contextual banners/status cards, or conditional actions. Appearance and disappearance are equally important: never animate only one direction.
+
+### Expandable lists and contextual banners
+
+- Apply the visibility state change inside `withAnimation(.easeInOut(duration: 0.24))`.
+- Use the same animation transaction for the affected list rows and any banner or `StatusCard` whose visibility follows that list, selection, or filter state. They must not appear or disappear in separate, visually disconnected steps.
+- Keep row identity stable so SwiftUI animates insertion, removal, and layout movement instead of replacing the whole list.
+- For a vertically inserted or removed banner, expandable section, or list-adjacent status block, prefer a symmetric `.move(edge: .top).combined(with: .opacity)` transition. A filtered list can rely on the shared animated layout update when its rows already have stable identity.
+- Changing presentation options must update the current in-memory results. Do not rerun discovery, clear unrelated state, or introduce artificial delays solely to produce an animation.
+
+The downloader options for Public Beta visibility and showing all available versions are the reference implementation for animated filter changes.
+
+### Conditional buttons and header actions
+
+- A button that is conditionally inserted into or removed from a header or action group uses a symmetric `.scale(scale: 0.85).combined(with: .opacity)` transition.
+- Animate the containing layout with `.easeInOut(duration: 0.22)` and key it to the Boolean visibility condition, so neighboring controls move smoothly while the button appears or disappears.
+- Remove a hidden action from the view hierarchy instead of leaving an invisible interactive control. Use opacity only for a deliberate disabled-state treatment, not as a substitute for conditional visibility.
+- Preserve the existing shared button style, tint, disabled behavior, help text, and accessibility semantics throughout the transition.
+
+The downloader prerequisite warning action is the reference implementation for conditional button visibility.
+
 ## Copy and Tone
 
 - User-facing copy should remain concise, calm, and Apple-like.
@@ -45,4 +68,4 @@ Any intentional design deviation should be documented before implementation.
 
 ## Update Trigger
 
-Update when primitives, token policy, or core interaction language changes.
+Update when primitives, token policy, motion behavior, or core interaction language changes.
```

**File**: `docs/reference/features/downloader/DOWNLOADER.md` (modified, +7/-1)
```diff
@@ -238,11 +238,16 @@ Window:
 - the window-level active-operation token remains held across list, process, failure, cancellation, and summary UI until the window is fully closed.
 
 List screen:
+- on presentation, app activation, warning selection, and every download attempt, downloader passively refreshes Full Disk Access and helper readiness without registering, repairing, or reloading the helper,
+- discovery remains available when prerequisites are missing, while starting a download requires confirmed Full Disk Access, an enabled helper service, and a successful XPC health check,
+- a missing prerequisite shows an orange warning action immediately to the left of refresh; it remains disabled during discovery or a prerequisite check and opens an app-icon alert after discovery completes,
+- prerequisite alerts provide direct System Settings actions for Full Disk Access and App Background Activity; an unavailable helper without an approval requirement instead directs the user to `Tools -> Repair Helper`,
+- returning from System Settings refreshes prerequisite state without rerunning discovery or clearing the selected installer,
 - grouped families,
 - default mode hides Public Beta entries and shows the newest stable entry per family, plus every older stable entry detected in `/Applications`,
 - enabling Public Beta visibility immediately adds the newest beta entry per family with an animated list transition, or every beta entry when `Pokaż wszystkie wersje` is also enabled, without rerunning discovery,
 - overlapping Public Beta catalogs are deduplicated by system identity, version, and build,
-- `Pokaż wszystkie wersje` shows every available stable version and, when beta visibility is enabled, every available Public Beta version,
+- `Pokaż wszystkie wersje` shows every available stable version and, when beta visibility is enabled, every available Public Beta version; enabling or disabling it uses the same animated list transition as Public Beta visibility without rerunning discovery,
 - locally detected entries use a localized, accent-colored `POBRANY` badge in the selection list only,
 - beta entries use a neutral `BETA` badge by default; the badge becomes accent-colored only in a selected list row and stays neutral in the active download view,
 - on a physical Intel Mac, starting a download for Golden Gate or any newer system (major version `>= 27`) requires confirmation in an app-icon alert explaining that the installer can be downloaded and built, but cannot be used on that Mac to create bootable USB media,
@@ -283,6 +288,7 @@ Rules:
   - warning summary is shown instead of full hard-failure semantics.
 
 User-facing messaging:
+- missing Full Disk Access, App Background Activity approval, or helper XPC readiness blocks the download before compatibility/redownload confirmations and before any session or temporary directory is created,
 - permission/move failures are rewritten to clearer, action-oriented text,
 - insufficient disk space during preflight is shown as a system `NSAlert` with required minimum and available space values,
 - an unreadable local installer identity is reported in a non-blocking aggregate `NSAlert` after discovery,
```

**File**: `docs/reference/features/helper/HELPER.md` (modified, +7/-0)
```diff
@@ -136,6 +136,11 @@ Contract invariants:
 - Performs health validation via XPC after configuring app-side helper code-signing requirements.
 - Uses controlled recovery when enabled service is unhealthy.
 
+### Passive Readiness Probe
+- Downloader uses an app-side passive readiness probe that reads `SMAppService` status and performs a bounded XPC health check only when the service is enabled.
+- The probe distinguishes user approval required from other helper unavailability.
+- It never registers, repairs, reloads, or otherwise recovers the helper; normal ensure-ready and repair flows remain unchanged.
+
 ### Startup Auto-Repair Flow (version/build change)
 - Entry point: `bootstrapIfNeededAtStartup`.
 - After successful non-interactive ensure-ready, app compares current app fingerprint (`CFBundleShortVersionString` + `CFBundleVersion`) with last successful helper-repair fingerprint stored in `UserDefaults`.
@@ -216,6 +221,8 @@ App-side helper integration:
   - startup bootstrap and approval-related helper lifecycle hooks.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceEnsureReadyFlow.swift`
   - readiness and registration flow.
+- `macUSB/Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift`
+  - side-effect-free service-status and XPC-health snapshot used by downloader gating.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceRepairFlow.swift`
   - hard repair flow and retry/stabilization logic.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceStatusUI.swift`
```

**File**: `docs/reference/platform/LOCALIZATION_CONTRACT.md` (modified, +19/-1)
```diff
@@ -18,6 +18,24 @@
 
 Supported language handling must remain coherent between runtime behavior and localization catalog.
 
+## String Catalog Serialization Policy
+
+`macUSB/Resources/Localizable.xcstrings` must be edited in the target serialization format produced by Xcode. Translation work must not introduce a compact or partially sorted JSON style that Xcode will rewrite later.
+
+Required format:
+
+- use two spaces for every indentation level;
+- use Xcode's spaced separator form, for example `"de" : {` and `"state" : "translated"`;
+- keep every object member and every `stringUnit` field on its own line; never use compact inline localization objects such as `"de":{"stringUnit":...}`;
+- keep entries in the `strings` dictionary in Xcode's deterministic, case-insensitive natural catalog order instead of prepending or appending a block outside its sorted position; symbols are ordered before text, and semantic keys are collated with the surrounding source strings;
+- keep locale identifiers inside `localizations` in lexicographic order, for example `de`, `en`, `es`, `fr`, `it`, `ja`, `pl`, `pt-BR`, `ru`, `tr`, `uk`, `vi`, `zh-Hans` for the complete supported set;
+- preserve Xcode's schema property order and top-level order: `sourceLanguage`, `strings`, then `version`;
+- do not substitute code-point sorting or run a general-purpose JSON formatter whose output differs from Xcode serialization.
+
+If a live key is intentionally resolved through dynamic presentation indirection and therefore cannot be found by automatic string extraction, mark it with `"extractionState" : "manual"` in the same Xcode serialization style. Do not leave an actively used key marked as `stale` merely because extraction cannot see the dynamic reference.
+
+Before finishing translation work, verify that opening or saving the catalog in Xcode does not produce a formatting-only diff and separately review any extraction-state changes as semantic metadata changes.
+
 ## Update Trigger
 
-Update when localization source policy, key strategy, or language coverage behavior changes.
+Update when localization source policy, key strategy, catalog serialization, extraction-state handling, or language coverage behavior changes.
```

**File**: `docs/reference/platform/PERMISSIONS_AND_BACKGROUND.md` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ Startup and helper readiness flows must surface missing prerequisites.
 - The pre-settings check acts as a best-effort registration probe so macOS can add macUSB to the Full Disk Access list before the user enables it.
 - The Full Disk Access panel uses the current System Settings deep link for supported macOS versions, with the existing general System Settings fallback if the deep link cannot be opened.
 - Helper background approval is checked at startup and in ensure-ready/repair flows.
+- Downloader presentation and app reactivation passively refresh Full Disk Access, helper service approval, and XPC health without registering or repairing the helper.
+- Downloader discovery remains available with missing prerequisites, but a download session cannot start until Full Disk Access and helper readiness are confirmed.
+- Downloader prerequisite alerts use the current System Settings terminology `Aktywność aplikacji w tle` / `App Background Activity` and open the corresponding settings panel directly.
 - Missing prerequisites are visible and can block reliable helper operations.
 - External drive support defaults to disabled on launch/termination unless explicitly enabled.
 
```

---

### Incident Patch 10: `3a77852d` (2026-08-25)
**Commit Message**: Complete downloader prerequisite translations

Add and review the remaining supported-language translations for downloader prerequisite warnings and actions.

**File**: `macUSB/Resources/Localizable.xcstrings` (modified, +168/-14)
```diff
@@ -17,7 +17,18 @@
             "state" : "translated",
             "value" : "Aby pobrać i przygotować instalator macOS, włącz aktywność aplikacji macUSB w tle w Ustawieniach systemowych."
           }
-        }
+        },
+        "de":{"stringUnit":{"state":"translated","value":"Um ein macOS-Installationsprogramm zu laden und vorzubereiten, aktiviere in den Systemeinstellungen die App-Hintergrundaktivitäten für macUSB."}},
+        "es":{"stringUnit":{"state":"translated","value":"Para descargar y preparar un instalador de macOS, activa la actividad en segundo plano de las apps para macUSB en Ajustes del Sistema."}},
+        "fr":{"stringUnit":{"state":"translated","value":"Pour télécharger et préparer un programme d’installation de macOS, activez l’activité des apps en arrière-plan pour macUSB dans Réglages Système."}},
+        "it":{"stringUnit":{"state":"translated","value":"Per scaricare e preparare un programma di installazione di macOS, attiva l’attività delle app in background per macUSB in Impostazioni di Sistema."}},
+        "ja":{"stringUnit":{"state":"translated","value":"macOSインストーラをダウンロードして準備するには、「システム設定」でmacUSBの「アプリのバックグラウンドでのアクティビティ」をオンにしてください。"}},
+        "pt-BR":{"stringUnit":{"state":"translated","value":"Para baixar e preparar um instalador do macOS, ative a Atividade de apps em segundo plano para o macUSB nos Ajustes do Sistema."}},
+        "ru":{"stringUnit":{"state":"translated","value":"Чтобы загрузить и подготовить установщик macOS, включите фоновую активность для macUSB в Системных настройках."}},
+        "tr":{"stringUnit":{"state":"translated","value":"Bir macOS yükleyicisini indirmek ve hazırlamak için Sistem Ayarları’nda macUSB için Uygulamanın Arka Plan Aktivitesi’ni açın."}},
+        "uk":{"stringUnit":{"state":"translated","value":"Щоб завантажити й підготувати інсталятор macOS, увімкніть фонову активність для macUSB у Системних параметрах."}},
+        "vi":{"stringUnit":{"state":"translated","value":"Để tải về và chuẩn bị trình cài đặt macOS, hãy bật Hoạt động trong nền của ứng dụng cho macUSB trong Cài đặt hệ thống."}},
+        "zh-Hans":{"stringUnit":{"state":"translated","value":"若要下载并准备 macOS 安装器，请在“系统设置”中为 macUSB 打开“App 后台活动”。"}}
       }
     },
     "downloader.prerequisites.background_activity.open" : {
@@ -33,7 +44,18 @@
             "state" : "translated",
             "value" : "Otwórz ustawienia aktywności w tle"
           }
-        }
+        },
+        "de":{"stringUnit":{"state":"translated","value":"Einstellungen für App-Hintergrundaktivitäten öffnen"}},
+        "es":{"stringUnit":{"state":"translated","value":"Abrir los ajustes de actividad en segundo plano"}},
+        "fr":{"stringUnit":{"state":"translated","value":"Ouvrir les réglages d’activité en arrière-plan"}},
+        "it":{"stringUnit":{"state":"translated","value":"Apri le impostazioni per l’attività in background"}},
+        "ja":{"stringUnit":{"state":"translated","value":"バックグラウンドアクティビティ設定を開く"}},
+        "pt-BR":{"stringUnit":{"state":"translated","value":"Abrir Ajustes de Atividade em Segundo Plano"}},
+        "ru":{"stringUnit":{"state":"translated","value":"Открыть настройки фоновой активности"}},
+        "tr":{"stringUnit":{"state":"translated","value":"Arka Plan Aktivitesi Ayarlarını Aç"}},
+        "uk":{"stringUnit":{"state":"translated","value":"Відкрити параметри фонової активності"}},
+        "vi":{"stringUnit":{"state":"translated","value":"Mở cài đặt Hoạt động trong nền"}},
+        "zh-Hans":{"stringUnit":{"state":"translated","value":"打开后台活动设置"}}
       }
     },
     "downloader.prerequisites.background_activity.title" : {
@@ -49,7 +71,18 @@
             "state" : "translated",
             "value" : "Wymagana aktywność aplikacji w tle"
           }
-        }
+        },
+        "de":{"stringUnit":{"state":"translated","value":"App-Hintergrundaktivitäten erforderlich"}},
+        "es":{"stringUnit":{"state":"translated","value":"Se requiere actividad en segundo plano de las apps"}},
+        "fr":{"stringUnit":{"state":"translated","value":"Activité des apps en arrière-plan requise"}},
+        "it":{"stringUnit":{"state":"translated","value":"Attività delle app in background richiesta"}},
+        "ja":{"stringUnit":{"state":"translated","value":"アプリのバックグラウンドでのアクティビティが必要です"}},
+        "pt-BR":{"stringUnit":{"state":"translated","value":"Atividade de apps em segundo plano obrigatória"}},
+        "ru":{"stringUnit":{"state":"translated","value":"Требуется фоновая активность приложений"}},
+        "tr":{"stringUnit":{"state":"translated","value":"Uygulamanın Arka Plan Aktivitesi Gerekli"}},
+        "uk":{"stringUnit":{"state":"translated","value":"Потрібна фонова активність програм"}},
+        "vi":{"stringUnit":{"state":"translated","value":"Yêu cầu Hoạt động trong nền của ứng dụng"}},
+        "zh-Hans":{"stringUnit":{"state":"translated","value":"需要 App 后台活动"}}
       }
     },
     "downloader.prerequisites.combined.background_activity_action" : 
```

---

### Incident Patch 11: `f1018db1` (2026-08-25)
**Commit Message**: Gate downloader on required permissions

Block download sessions until required permissions and helper readiness are confirmed, and surface actionable alerts that refresh when the app becomes active.

**File**: `docs/reference/core/FILE_STRUCTURE.md` (modified, +3/-0)
```diff
@@ -89,7 +89,9 @@
 ### Downloader layout
 
 - `macUSB/Features/Downloader/MacOSDownloaderCoordinator.swift`
+- `macUSB/Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift` — combines Full Disk Access and passive helper readiness into the downloader gate while rejecting stale checks.
 - `macUSB/Features/Downloader/UI/*`
+- `macUSB/Features/Downloader/UI/MacOSDownloaderPrerequisiteAlerts.swift` — prerequisite alert variants and direct System Settings actions.
 - `macUSB/Features/Downloader/Logic/Discovery/*`
 - `macUSB/Features/Downloader/Logic/Download/*`
 - `macUSB/Features/Downloader/Logic/Assembly/*`
@@ -105,6 +107,7 @@
 - `macUSB/Shared/Services/Helper/PrivilegedOperationClientActivity.swift` — lifecycle tokens for long USB and downloader helper tasks.
 - `macUSB/Shared/Services/Helper/HelperServiceManager.swift`
 - `macUSB/Shared/Services/Helper/HelperService/*`
+- `macUSB/Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift` — passive `SMAppService` status and XPC health snapshot without recovery side effects.
 - `macUSB/Shared/Services/InstallerSourceImageUnmountRegistry.swift` — centralny rejestr śledzenia zamontowanych źródeł ISO (Windows/Linux) i cleanup odmontowania przy zamknięciu aplikacji; ręczne źródła raw nie są rejestrowane.
 
 ### Helper (daemon)
```

**File**: `docs/reference/core/USER_FLOW.md` (modified, +2/-0)
```diff
@@ -51,6 +51,8 @@ Windows-specific runtime behavior:
 - `SystemAnalysisView` also exposes `Pobierz` between `Wybierz` and `Analizuj` for direct downloader access.
 - Downloader opening is blocked during USB creation operation stages (`UniversalInstallationView`, `CreationProgressView`, `FinishUSBView`), and `Tools -> Pobierz instalator macOS...` is disabled there.
 - Discovery starts on entering downloader window (never on app startup).
+- Downloader also passively checks Full Disk Access and helper XPC readiness on entry and app activation. Missing prerequisites do not block discovery or selection, but they surface an orange warning action and block `Download` before any session begins.
+- Selecting the prerequisite warning or attempting a blocked download presents an actionable app-icon alert. Returning from System Settings refreshes the state without rerunning discovery or clearing selection.
 - While discovery runs, header/options remain visible; list area shows scanning panel.
 - After discovery completes, grouped systems list is shown.
 - On downloader summary, when final `.app` exists, icon action can pass installer path to analysis and trigger automatic analysis; from Welcome, app navigates to analysis first.
```

**File**: `docs/reference/features/downloader/DOWNLOADER.md` (modified, +6/-0)
```diff
@@ -238,6 +238,11 @@ Window:
 - the window-level active-operation token remains held across list, process, failure, cancellation, and summary UI until the window is fully closed.
 
 List screen:
+- on presentation, app activation, warning selection, and every download attempt, downloader passively refreshes Full Disk Access and helper readiness without registering, repairing, or reloading the helper,
+- discovery remains available when prerequisites are missing, while starting a download requires confirmed Full Disk Access, an enabled helper service, and a successful XPC health check,
+- a missing prerequisite shows an orange warning action immediately to the left of refresh; it remains disabled during discovery or a prerequisite check and opens an app-icon alert after discovery completes,
+- prerequisite alerts provide direct System Settings actions for Full Disk Access and App Background Activity; an unavailable helper without an approval requirement instead directs the user to `Tools -> Repair Helper`,
+- returning from System Settings refreshes prerequisite state without rerunning discovery or clearing the selected installer,
 - grouped families,
 - default mode hides Public Beta entries and shows the newest stable entry per family, plus every older stable entry detected in `/Applications`,
 - enabling Public Beta visibility immediately adds the newest beta entry per family with an animated list transition, or every beta entry when `Pokaż wszystkie wersje` is also enabled, without rerunning discovery,
@@ -283,6 +288,7 @@ Rules:
   - warning summary is shown instead of full hard-failure semantics.
 
 User-facing messaging:
+- missing Full Disk Access, App Background Activity approval, or helper XPC readiness blocks the download before compatibility/redownload confirmations and before any session or temporary directory is created,
 - permission/move failures are rewritten to clearer, action-oriented text,
 - insufficient disk space during preflight is shown as a system `NSAlert` with required minimum and available space values,
 - an unreadable local installer identity is reported in a non-blocking aggregate `NSAlert` after discovery,
```

**File**: `docs/reference/features/helper/HELPER.md` (modified, +7/-0)
```diff
@@ -136,6 +136,11 @@ Contract invariants:
 - Performs health validation via XPC after configuring app-side helper code-signing requirements.
 - Uses controlled recovery when enabled service is unhealthy.
 
+### Passive Readiness Probe
+- Downloader uses an app-side passive readiness probe that reads `SMAppService` status and performs a bounded XPC health check only when the service is enabled.
+- The probe distinguishes user approval required from other helper unavailability.
+- It never registers, repairs, reloads, or otherwise recovers the helper; normal ensure-ready and repair flows remain unchanged.
+
 ### Startup Auto-Repair Flow (version/build change)
 - Entry point: `bootstrapIfNeededAtStartup`.
 - After successful non-interactive ensure-ready, app compares current app fingerprint (`CFBundleShortVersionString` + `CFBundleVersion`) with last successful helper-repair fingerprint stored in `UserDefaults`.
@@ -216,6 +221,8 @@ App-side helper integration:
   - startup bootstrap and approval-related helper lifecycle hooks.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceEnsureReadyFlow.swift`
   - readiness and registration flow.
+- `macUSB/Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift`
+  - side-effect-free service-status and XPC-health snapshot used by downloader gating.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceRepairFlow.swift`
   - hard repair flow and retry/stabilization logic.
 - `macUSB/Shared/Services/Helper/HelperService/HelperServiceStatusUI.swift`
```

**File**: `docs/reference/platform/PERMISSIONS_AND_BACKGROUND.md` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ Startup and helper readiness flows must surface missing prerequisites.
 - The pre-settings check acts as a best-effort registration probe so macOS can add macUSB to the Full Disk Access list before the user enables it.
 - The Full Disk Access panel uses the current System Settings deep link for supported macOS versions, with the existing general System Settings fallback if the deep link cannot be opened.
 - Helper background approval is checked at startup and in ensure-ready/repair flows.
+- Downloader presentation and app reactivation passively refresh Full Disk Access, helper service approval, and XPC health without registering or repairing the helper.
+- Downloader discovery remains available with missing prerequisites, but a download session cannot start until Full Disk Access and helper readiness are confirmed.
+- Downloader prerequisite alerts use the current System Settings terminology `Aktywność aplikacji w tle` / `App Background Activity` and open the corresponding settings panel directly.
 - Missing prerequisites are visible and can block reliable helper operations.
 - External drive support defaults to disabled on launch/termination unless explicitly enabled.
 
```

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -243,6 +243,7 @@
 				Features/Downloader/Logic/MacOSVerificationLogic.swift,
 				Features/Downloader/MacOSDownloaderCoordinator.swift,
 				Features/Downloader/UI/MacOSDownloaderListView.swift,
+				Features/Downloader/UI/MacOSDownloaderPrerequisiteAlerts.swift,
 				Features/Downloader/UI/MacOSDownloaderProcessView.swift,
 				Features/Downloader/UI/MacOSDownloaderSummaryView.swift,
 				Features/Downloader/UI/MacOSDownloaderWindowShellView.swift,
@@ -377,6 +378,7 @@
 				Features/Downloader/Logic/MacOSVerificationLogic.swift,
 				Features/Downloader/MacOSDownloaderCoordinator.swift,
 				Features/Downloader/UI/MacOSDownloaderListView.swift,
+				Features/Downloader/UI/MacOSDownloaderPrerequisiteAlerts.swift,
 				Features/Downloader/UI/MacOSDownloaderProcessView.swift,
 				Features/Downloader/UI/MacOSDownloaderSummaryView.swift,
 				Features/Downloader/UI/MacOSDownloaderWindowShellView.swift,
```

**File**: `macUSB/Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift` (modified, +9/-0)
```diff
@@ -42,6 +42,15 @@ final class MacOSDownloaderPrerequisiteController: ObservableObject {
         trigger: MacOSDownloaderPrerequisiteCheckTrigger,
         completion: ((MacOSDownloaderPrerequisiteSnapshot) -> Void)? = nil
     ) {
+        guard !isChecking else {
+            AppLogging.info(
+                "Pominieto rownolegle sprawdzenie wymagan downloadera " +
+                "[trigger=\(trigger.rawValue)].",
+                category: "Downloader"
+            )
+            return
+        }
+
         let checkID = UUID()
         activeCheckID = checkID
         isChecking = true
```

**File**: `macUSB/Features/Downloader/UI/MacOSDownloaderListView.swift` (modified, +28/-2)
```diff
@@ -10,6 +10,26 @@ extension MacOSDownloaderWindowShellView {
 
                 Spacer()
 
+                if prerequisiteController.snapshot?.requiresWarning == true {
+                    Button {
+                        handlePrerequisiteWarningTap()
+                    } label: {
+                        Image(systemName: "exclamationmark.triangle.fill")
+                            .foregroundStyle(.orange)
+                            .padding(.horizontal, 10)
+                            .padding(.vertical, 6)
+                    }
+                    .macUSBSecondaryButtonStyle()
+                    .tint(.orange)
+                    .disabled(isDiscoveryInProgress || prerequisiteController.isChecking)
+                    .opacity(
+                        isDiscoveryInProgress || prerequisiteController.isChecking
+                            ? 0.65
+                            : 1.0
+                    )
+                    .help(String(localized: "downloader.prerequisites.warning_help"))
+                }
+
                 Button {
                     logic.startDiscovery()
                 } label: {
@@ -260,8 +280,14 @@ extension MacOSDownloaderWindowShellView {
                         .padding(.vertical, 7)
                     }
                     .macUSBPrimaryButtonStyle()
-                    .disabled(!supportsProductionDownload)
-                    .opacity(supportsProductionDownload ? 1 : 0.6)
+                    .disabled(
+                        !supportsProductionDownload || prerequisiteController.isChecking
+                    )
+                    .opacity(
+                        supportsProductionDownload && !prerequisiteController.isChecking
+                            ? 1
+                            : 0.6
+                    )
                 }
                 .transition(.opacity.combined(with: .move(edge: .top)))
             }
```

---

### Incident Patch 12: `17853019` (2026-08-25)
**Commit Message**: Add passive downloader prerequisite checks

Introduce a side-effect-free readiness snapshot for Full Disk Access, SMAppService approval, and helper XPC health.

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -239,6 +239,7 @@
 				Features/Downloader/Logic/Download/MacOSDownloadTransfer.swift,
 				Features/Downloader/Logic/DownloadChecksums.json,
 				Features/Downloader/Logic/MacOSCleanupLogic.swift,
+				Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift,
 				Features/Downloader/Logic/MacOSVerificationLogic.swift,
 				Features/Downloader/MacOSDownloaderCoordinator.swift,
 				Features/Downloader/UI/MacOSDownloaderListView.swift,
@@ -312,6 +313,7 @@
 				Shared/Services/Helper/HelperService/HelperServiceBootstrap.swift,
 				Shared/Services/Helper/HelperService/HelperServiceDiagnostics.swift,
 				Shared/Services/Helper/HelperService/HelperServiceEnsureReadyFlow.swift,
+				Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairFlow.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairPanelView.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairUI.swift,
@@ -371,6 +373,7 @@
 				Features/Downloader/Logic/Download/MacOSDownloadTransfer.swift,
 				Features/Downloader/Logic/DownloadChecksums.json,
 				Features/Downloader/Logic/MacOSCleanupLogic.swift,
+				Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift,
 				Features/Downloader/Logic/MacOSVerificationLogic.swift,
 				Features/Downloader/MacOSDownloaderCoordinator.swift,
 				Features/Downloader/UI/MacOSDownloaderListView.swift,
@@ -414,6 +417,7 @@
 				Shared/Services/Helper/HelperService/HelperServiceBootstrap.swift,
 				Shared/Services/Helper/HelperService/HelperServiceDiagnostics.swift,
 				Shared/Services/Helper/HelperService/HelperServiceEnsureReadyFlow.swift,
+				Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairFlow.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairPanelView.swift,
 				Shared/Services/Helper/HelperService/HelperServiceRepairUI.swift,
```

**File**: `macUSB/Features/Downloader/Logic/MacOSDownloaderPrerequisites.swift` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+import Foundation
+import Combine
+import ServiceManagement
+
+enum MacOSDownloaderPrerequisiteCheckTrigger: String {
+    case initialPresentation
+    case appActivation
+    case warningAction
+    case downloadAction
+}
+
+struct MacOSDownloaderPrerequisiteSnapshot {
+    let fullDiskAccessStatus: FullDiskAccessStatus
+    let helperReadiness: HelperPassiveReadinessState
+    let helperServiceStatus: SMAppService.Status
+    let helperHealthDetails: String?
+
+    var hasFullDiskAccess: Bool {
+        fullDiskAccessStatus.hasConfirmedAccess
+    }
+
+    var isHelperReady: Bool {
+        helperReadiness == .ready
+    }
+
+    var allowsDownload: Bool {
+        hasFullDiskAccess && isHelperReady
+    }
+
+    var requiresWarning: Bool {
+        !allowsDownload
+    }
+}
+
+final class MacOSDownloaderPrerequisiteController: ObservableObject {
+    @Published private(set) var snapshot: MacOSDownloaderPrerequisiteSnapshot?
+    @Published private(set) var isChecking = false
+
+    private var activeCheckID: UUID?
+
+    func refresh(
+        trigger: MacOSDownloaderPrerequisiteCheckTrigger,
+        completion: ((MacOSDownloaderPrerequisiteSnapshot) -> Void)? = nil
+    ) {
+        let checkID = UUID()
+        activeCheckID = checkID
+        isChecking = true
+
+        AppLogging.info(
+            "Rozpoczynam pasywne sprawdzenie wymagan downloadera [trigger=\(trigger.rawValue)].",
+            category: "Downloader"
+        )
+
+        var fullDiskAccessStatus: FullDiskAccessStatus?
+        var helperSnapshot: HelperPassiveReadinessSnapshot?
+
+        let finishIfComplete = { [weak self] in
+            guard let self,
+                  self.activeCheckID == checkID,
+                  let fullDiskAccessStatus,
+                  let helperSnapshot
+            else { return }
+
+            let result = MacOSDownloaderPrerequisiteSnapshot(
+                fullDiskAccessStatus: fullDiskAccessStatus,
+                helperReadiness: helperSnapshot.state,
+                helperServiceStatus: helperSnapshot.serviceStatus,
+                helperHealthDetails: helperSnapshot.healthDetails
+            )
+
+            self.snapshot = result
+            self.isChecking = false
+            self.activeCheckID = nil
+
+            let statusMessage =
+                "Zakonczono pasywne sprawdzenie wymagan downloadera " +
+                "[trigger=\(trigger.rawValue), fda=\(fullDiskAccessStatus.rawValue), " +
+                "helper=\(helperSnapshot.state.rawValue), " +
+                "service=\(self.serviceStatusDiagnosticName(helperSnapshot.serviceStatus)), " +
+                "allowsDownload=\(result.allowsDownload)]."
+            AppLogging.info(statusMessage, category: "Downloader")
+
+            if let details = helperSnapshot.healthDetails, !details.isEmpty {
+                AppLogging.error(
+                    "Pasywny health-check XPC downloadera nie powiodl sie: \(details)",
+                    category: "Downloader"
+                )
+            }
+
+            completion?(result)
+        }
+
+        FullDiskAccessPermissionManager.shared.refreshState(trigger: .downloader) { status in
+            guard self.activeCheckID == checkID else { return }
+            fullDiskAccessStatus = status
+            finishIfComplete()
+        }
+
+        HelperServiceManager.shared.evaluatePassiveReadiness { result in
+            guard self.activeCheckID == checkID else { return }
+            helperSnapshot = result
+            finishIfComplete()
+        }
+    }
+
+    func invalidate() {
+        activeCheckID = nil
+        isChecking = false
+    }
+
+    private func serviceStatusDiagnosticName(_ status: SMAppService.Status) -> String {
+        switch status {
+        case .enabled:
+            return "enabled"
+        case .requiresApproval:
+            return "requiresApproval"
+        case .notRegistered:
+            return "notRegistered"
+        case .notFound:
+            return "notFound"
+        @unknown default:
+            return "unknown"
+        }
+    }
+}
```

**File**: `macUSB/Shared/Services/FullDiskAccessTypes.swift` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ enum FullDiskAccessCheckTrigger: String {
     case startup
     case activation
     case installationSummary
+    case downloader
     case settingsPanel
 }
 
```

**File**: `macUSB/Shared/Services/Helper/HelperService/HelperServicePassiveReadiness.swift` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import Foundation
+import ServiceManagement
+
+enum HelperPassiveReadinessState: String {
+    case ready
+    case requiresBackgroundApproval
+    case unavailable
+}
+
+struct HelperPassiveReadinessSnapshot {
+    let state: HelperPassiveReadinessState
+    let serviceStatus: SMAppService.Status
+    let healthDetails: String?
+}
+
+extension HelperServiceManager {
+    func evaluatePassiveReadiness(
+        completion: @escaping (HelperPassiveReadinessSnapshot) -> Void
+    ) {
+        let serviceStatus = SMAppService.daemon(plistName: Self.daemonPlistName).status
+        let requiresBackgroundApproval = serviceStatus == .requiresApproval
+
+        DispatchQueue.main.async {
+            MenuState.shared.helperRequiresBackgroundApproval = requiresBackgroundApproval
+        }
+
+        switch serviceStatus {
+        case .requiresApproval:
+            DispatchQueue.main.async {
+                completion(
+                    HelperPassiveReadinessSnapshot(
+                        state: .requiresBackgroundApproval,
+                        serviceStatus: serviceStatus,
+                        healthDetails: nil
+                    )
+                )
+            }
+
+        case .enabled:
+            PrivilegedOperationClient.shared.queryHealth(
+                withTimeout: statusHealthTimeout,
+                presentsTrustFailureAlert: false
+            ) { healthy, details in
+                completion(
+                    HelperPassiveReadinessSnapshot(
+                        state: healthy ? .ready : .unavailable,
+                        serviceStatus: serviceStatus,
+                        healthDetails: healthy ? nil : details
+                    )
+                )
+            }
+
+        case .notRegistered, .notFound:
+            DispatchQueue.main.async {
+                completion(
+                    HelperPassiveReadinessSnapshot(
+                        state: .unavailable,
+                        serviceStatus: serviceStatus,
+                        healthDetails: nil
+                    )
+                )
+            }
+
+        @unknown default:
+            DispatchQueue.main.async {
+                completion(
+                    HelperPassiveReadinessSnapshot(
+                        state: .unavailable,
+                        serviceStatus: serviceStatus,
+                        healthDetails: nil
+                    )
+                )
+            }
+        }
+    }
+}
```

---

### Incident Patch 13: `499aa1cc` (2026-08-23)
**Commit Message**: Fix macOS beta catalog detection

Classify beta-only installers by their source catalog instead of prerelease wording.

**File**: `docs/reference/features/downloader/DOWNLOADER.md` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ Discovery pipeline (`MacOSCatalogService`, orchestrated by `MacOSDownloaderLogic
 2. Download the stable Apple catalog and Public Beta catalogs for macOS 27, 26, and 15 from `swscan.apple.com` on every discovery.
 3. Parse InstallAssistant candidates from products metadata.
 4. Parse `.dist` metadata from Apple distribution hosts.
-5. Keep non-prerelease entries from stable and prerelease entries from beta catalogs.
+5. Treat the source catalog as the release-channel authority: entries from the stable catalog are stable, while entries unique to Public Beta catalogs are Public Beta regardless of prerelease wording in distribution metadata; when the same product ID is present in both channels, the stable catalog takes precedence.
 6. Deduplicate by normalized identity within each release channel and across overlapping Public Beta catalogs.
 7. Enrich legacy official entries from Apple Support list.
 8. Probe installer sizes (catalog-prefill + network probe fallback).
```

**File**: `macUSB/Features/Downloader/Logic/Discovery/MacOSDiscoveryDistributionParser.swift` (modified, +0/-17)
```diff
@@ -15,14 +15,6 @@ extension MacOSCatalogService {
 
         if version.isEmpty { return nil }
         if build.isEmpty { build = "N/A" }
-        let prerelease = isPrerelease(name: name, version: version, build: build)
-        if candidate.releaseChannel == .stable, prerelease {
-            return nil
-        }
-        if candidate.releaseChannel != .stable, !prerelease {
-            return nil
-        }
-
         let family = normalizeFamilyName(from: name)
         return MacOSInstallerEntry(
             id: "\(candidate.releaseChannel.rawValue)|\(family)|\(name)|\(version)|\(build)",
@@ -76,13 +68,4 @@ extension MacOSCatalogService {
         }
         return family
     }
-
-    func isPrerelease(name: String, version: String, build: String) -> Bool {
-        let text = "\(name) \(version) \(build)".lowercased()
-        return text.contains("beta")
-            || text.contains("seed")
-            || text.contains("release candidate")
-            || text.contains(" rc")
-            || text.contains("preview")
-    }
 }
```

---

### Incident Patch 14: `48de0888` (2026-08-23)
**Commit Message**: Merge pull request #108 from Kruszoneq/fix/windows_volume

Fix Windows target volume resolution

**File**: `docs/reference/core/FILE_STRUCTURE.md` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@
 - `macUSBHelper/Service/*`
 - `macUSBHelper/Workflow/*`
 - `macUSBHelper/Workflow/Linux/*` — Linux raw-copy stage builder, parser, and disk ops.
-- `macUSBHelper/Workflow/Windows/*` — Windows ISO-copy stage builder, boot-mode-aware source/target validation, progress parsing, and verification.
+- `macUSBHelper/Workflow/Windows/*` — Windows ISO-copy stage builder, exact formatted-target partition and mount-point resolution, boot-mode-aware source/target validation, progress parsing, and verification.
 - `macUSBHelper/Workflow/Windows/MacUSBoot/*` — BIOS-only macUSBoot artifact validation, Disk Arbitration guard, raw-disk layout validation, transaction, disk operations, and orchestration.
 - `macUSBHelper/DownloaderAssembly/*`
 - `macUSBHelper/Rosetta/HelperRosettaInstaller.swift` — fixed-command, root-only Rosetta installer with bounded diagnostics.
```

**File**: `docs/reference/features/helper/HELPER.md` (modified, +3/-0)
```diff
@@ -168,6 +168,7 @@ Contract invariants:
 - Automatic local-account creation writes the generated local account `Name` separately from the user-facing `DisplayName`. The helper validates `Name` as non-empty ASCII letters/digits, max 20 characters, and not `NONE`; `DisplayName` is non-empty, max 256 characters, not `NONE`, and contains only letters, digits, and spaces.
 - Mac language/region transfer receives app-side validated Windows locale tags, writes `Microsoft-Windows-International-Core` in `oobeSystem`, and uses the language tag as `InputLocale` so Windows selects its default keyboard for that language.
 - Every Windows request must include `windowsBootMode`; the service rejects requests without it before creating an executor.
+- After Windows target formatting, helper resolves the FAT32 partition from the exact requested whole disk, mounts that partition by device identifier when needed, and validates its partition identifier, exact parent whole disk, mount point, and volume UUID before every target-writing or target-verification stage. Volume labels remain presentation metadata and are not target paths.
 - Windows media copy runs only the system-provided `/usr/bin/rsync` with explicit recursive/link/time preservation. The privileged helper does not execute user-managed Homebrew or MacPorts `rsync` binaries and does not request POSIX ownership metadata for the FAT32 target.
 - BIOS mode appends `windows_install_macusboot` after `windows_verify_media` and before cleanup. UEFI retains the existing stage graph.
 - The BIOS stage validates the pinned bundled artifact and the target MBR gap, installs StageTwo at LBA 1...5 before MBR boot code, synchronizes and reads back each write, then verifies the full protected range. It blocks Disk Arbitration auto-mounts, ignores cancellation while active, and performs exactly one final `mountDisk` attempt after releasing raw-device ownership.
@@ -262,6 +263,8 @@ Daemon helper runtime:
   - Windows `Autounattend.xml` configuration helpers, XML generation, and XML validation.
 - `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsBootValidation.swift`
   - boot-mode-aware, case-insensitive BIOS/UEFI source and target marker validation.
+- `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift`
+  - exact whole-disk, FAT32 partition, mount-point, and volume-UUID resolution for the formatted Windows target.
 - `macUSBHelper/Workflow/Windows/MacUSBoot/*`
   - macUSBoot artifact/parser, MBR-gap validation, exclusive raw-device I/O, Disk Arbitration guard, diskutil operations, write transaction, and stage orchestration.
 - `macUSBHelper/DownloaderAssembly/DownloaderAssemblyExecutor.swift`
```

**File**: `docs/reference/features/usb/USB_CREATION_WORKFLOWS.md` (modified, +1/-0)
```diff
@@ -128,6 +128,7 @@ Windows summary pre-start prerequisites:
 - Windows automatic configuration may set `OOBE/HideWirelessSetupInOOBE` to `true` when Wi-Fi/network setup skip is enabled.
 - Windows automatic local-account creation writes both `Name` and `DisplayName` for `Microsoft-Windows-Shell-Setup/UserAccounts/LocalAccounts/LocalAccount`; `DisplayName` preserves the user-entered display name, while `Name` is generated without spaces or special characters and limited to 20 ASCII letters/digits.
 - Windows target format must be `MS-DOS (FAT32)` + `MBR`.
+- After formatting, the helper resolves the Windows target from the exact selected whole-disk identifier through `AllDisksAndPartitions`, validates the FAT32 child partition, its exact `ParentWholeDisk`, mount point, and volume UUID, and uses that verified mount point for copy, WIM split, answer-file generation, and media verification. The user-facing volume label must never be used to address the target path.
 - Windows target volume labels are selected from the detected family:
   - desktop: `WINXP-MU`, `WINVS-MU`, `WIN7-MU`, `WIN8-MU`, `WIN81-MU`, `WIN10-MU`, or `WIN11-MU`,
   - server: `SRV03-MU`, `SRV08-MU`, `SRV12-MU`, `SRV16-MU`, `SRV19-MU`, `SRV22-MU`, or `SRV25-MU`,
```

**File**: `macUSB.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -32,6 +32,7 @@
 		A10000012F00000100000049 /* Workflow/Windows/HelperWorkflowWindowsStages.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F0000010000004A /* Workflow/Windows/HelperWorkflowWindowsStages.swift */; };
 		A10000012F0000010000004B /* Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F0000010000004C /* Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift */; };
 		A10000012F0000010000004D /* Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F0000010000004E /* Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift */; };
+		A10000012F0000010000005D /* Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F0000010000005E /* Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift */; };
 		A10000012F0000010000004F /* Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000050 /* Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift */; };
 		A10000012F00000100000051 /* Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000052 /* Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift */; };
 		A10000012F00000100000053 /* Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift in Sources */ = {isa = PBXBuildFile; fileRef = A10000012F00000100000054 /* Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift */; };
@@ -137,6 +138,7 @@
 		A10000012F0000010000004A /* Workflow/Windows/HelperWorkflowWindowsStages.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsStages.swift; sourceTree = "<group>"; };
 		A10000012F0000010000004C /* Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift; sourceTree = "<group>"; };
 		A10000012F0000010000004E /* Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift; sourceTree = "<group>"; };
+		A10000012F0000010000005E /* Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift; sourceTree = "<group>"; };
 		A10000012F00000100000050 /* Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift; sourceTree = "<group>"; };
 		A10000012F00000100000052 /* Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift; sourceTree = "<group>"; };
 		A10000012F00000100000054 /* Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift; sourceTree = "<group>"; };
@@ -555,6 +557,7 @@
 				A10000012F0000010000004A /* Workflow/Windows/HelperWorkflowWindowsStages.swift */,
 				A10000012F0000010000004C /* Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift */,
 				A10000012F0000010000004E /* Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift */,
+				A10000012F0000010000005E /* Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift */,
 				A10000012F00000100000050 /* Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift */,
 				A10000012F00000100000052 /* Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift */,
 				A10000012F00000100000054 /* Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift */,
@@ -811,6 +814,7 @@
 				A10000012F00000100000049 /* Workflow/Windows/HelperWorkflowWindowsStages.swift in Sources */,
 				A10000012F0000010000004B /* Workflow/Windows/HelperWorkflowWindowsSourceLogic.swift in Sources */,
 				A10000012F0000010000004D /* Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift in Sources */,
+				A10000012F0000010000005D /* Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift in Sources */,
 				A10000012F0000010000004F /* Workflow/Windows/HelperWorkflowWindowsCopyProgressParsing.swift in Sources */,
 				A10000012F00000100000051 /* Workflow/Windows/HelperWorkflowWindowsWimSplitProgressParsing.swift in Sources */,
 				A10000012F00000100000053 /* Workflow/Windows/HelperWorkflowWindowsValidationLogic.swift in Sources */,
```

**File**: `macUSBHelper/Workflow/HelperWorkflowExecutor.swift` (modified, +2/-0)
```diff
@@ -24,7 +24,9 @@ final class HelperWorkflowExecutor {
     var windowsShouldSplitWim = false
     var windowsHasInstallESD = false
     var windowsWimlibExecutablePath: String?
+    var windowsPreparedTargetPartitionBSDName: String?
     var windowsPreparedTargetVolumePath: String?
+    var windowsPreparedTargetVolumeUUID: String?
     var windowsCopyStageTotalBytes: Int64?
     var windowsRsyncProgressMode: String?
     var windowsLegacyRsyncCurrentFilePath: String?
```

**File**: `macUSBHelper/Workflow/Windows/Autounattend/HelperWorkflowWindowsAutounattendGenerator.swift` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ extension HelperWorkflowExecutor {
             return
         }
 
-        let targetVolumePath = windowsPreparedTargetVolumePath ?? "/Volumes/\(request.targetLabel)"
+        let targetVolumePath = try requireWindowsPreparedTargetVolumePath(stage: stage)
         let targetURL = URL(fileURLWithPath: targetVolumePath)
         guard fileManager.fileExists(atPath: targetURL.path) else {
             throw HelperExecutionError.failed(
```

**File**: `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsStages.swift` (modified, +2/-26)
```diff
@@ -194,7 +194,7 @@ extension HelperWorkflowExecutor {
             )
         }
 
-        let targetVolumePath = windowsPreparedTargetVolumePath ?? "/Volumes/\(request.targetLabel)"
+        let targetVolumePath = try requireWindowsPreparedTargetVolumePath(stage: stage)
         let relativeWimPath = windowsInstallWimRelativePath ?? "sources/install.wim"
         let sourcesSubdirectory = (relativeWimPath as NSString).deletingLastPathComponent
         let targetSplitPath = URL(fileURLWithPath: targetVolumePath)
@@ -233,31 +233,7 @@ extension HelperWorkflowExecutor {
     }
 
     private func ensureWindowsTargetMountPathForCopy(stage: WorkflowStage) throws -> String {
-        if let currentPath = windowsPreparedTargetVolumePath,
-           isWindowsMountedDirectoryUsable(currentPath) {
-            return currentPath
-        }
-
-        let wholeDisk = try extractWholeDiskName(from: request.targetBSDName)
-        guard let remountedPath = resolveMountedVolumePathForWholeDisk(wholeDisk),
-              isWindowsMountedDirectoryUsable(remountedPath) else {
-            throw HelperExecutionError.failed(
-                stage: stage.key,
-                exitCode: -1,
-                description: "Nie znaleziono zamontowanego woluminu docelowego USB przed kopiowaniem."
-            )
-        }
-
-        windowsPreparedTargetVolumePath = remountedPath
-        emitProgress(
-            stageKey: stage.key,
-            titleKey: stage.titleKey,
-            percent: latestPercent,
-            statusKey: stage.statusKey,
-            logLine: "Windows target path refreshed before copy: \(remountedPath)",
-            shouldAdvancePercent: false
-        )
-        return remountedPath
+        try requireWindowsPreparedTargetVolumePath(stage: stage)
     }
 
     private func isWindowsMountedDirectoryUsable(_ path: String) -> Bool {
```

**File**: `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+import Foundation
+
+struct WindowsTargetVolumeResolution {
+    let wholeDiskBSDName: String
+    let partitionBSDName: String
+    let mountPath: String
+    let volumeUUID: String
+}
+
+private struct WindowsTargetPartitionState {
+    let wholeDiskBSDName: String
+    let partitionBSDName: String
+    let mountPath: String?
+    let volumeUUID: String
+}
+
+extension HelperWorkflowExecutor {
+    func waitForWindowsTargetVolume(
+        stage: WorkflowStage,
+        wholeDisk: String
+    ) throws -> WindowsTargetVolumeResolution {
+        var mountAttempts = Set<String>()
+
+        for _ in 0..<70 {
+            let candidates = windowsTargetPartitionStates(on: wholeDisk)
+            if candidates.count > 1 {
+                let partitions = candidates.map(\.partitionBSDName).sorted().joined(separator: ",")
+                throw HelperExecutionError.failed(
+                    stage: stage.key,
+                    exitCode: -1,
+                    description: "Wykryto więcej niż jedną partycję FAT32 na docelowym urządzeniu \(wholeDisk): \(partitions)."
+                )
+            }
+
+            if let target = candidates.first {
+                if let mountPath = target.mountPath,
+                   isExistingWindowsTargetDirectory(atPath: mountPath) {
+                    return WindowsTargetVolumeResolution(
+                        wholeDiskBSDName: target.wholeDiskBSDName,
+                        partitionBSDName: target.partitionBSDName,
+                        mountPath: mountPath,
+                        volumeUUID: target.volumeUUID
+                    )
+                }
+
+                if mountAttempts.insert(target.partitionBSDName).inserted {
+                    let exitCode = try runSimpleCommand(
+                        executable: "/usr/sbin/diskutil",
+                        arguments: ["mount", "/dev/\(target.partitionBSDName)"],
+                        stageKey: stage.key,
+                        stageTitleKey: stage.titleKey,
+                        statusKey: stage.statusKey,
+                        failOnNonZeroExit: false
+                    )
+                    emitProgress(
+                        stageKey: stage.key,
+                        titleKey: stage.titleKey,
+                        percent: latestPercent,
+                        statusKey: stage.statusKey,
+                        logLine: "Windows target mount requested: disk=\(wholeDisk), partition=\(target.partitionBSDName), exitCode=\(exitCode)",
+                        shouldAdvancePercent: false
+                    )
+                }
+            }
+
+            try throwIfCancelled()
+            Thread.sleep(forTimeInterval: 0.1)
+        }
+
+        throw HelperExecutionError.failed(
+            stage: stage.key,
+            exitCode: -1,
+            description: "Nie znaleziono zamontowanej partycji FAT32 urządzenia docelowego \(wholeDisk) po formatowaniu."
+        )
+    }
+
+    func requireWindowsPreparedTargetVolumePath(stage: WorkflowStage) throws -> String {
+        let wholeDisk = try extractWholeDiskName(from: request.targetBSDName)
+
+        if let currentPath = windowsPreparedTargetVolumePath,
+           let target = validatedWindowsTargetVolume(
+               atMountPath: currentPath,
+               expectedWholeDisk: wholeDisk,
+               expectedPartition: windowsPreparedTargetPartitionBSDName,
+               expectedVolumeUUID: windowsPreparedTargetVolumeUUID
+           ) {
+            windowsPreparedTargetPartitionBSDName = target.partitionBSDName
+            windowsPreparedTargetVolumePath = target.mountPath
+            windowsPreparedTargetVolumeUUID = target.volumeUUID
+            return target.mountPath
+        }
+
+        let target = try waitForWindowsTargetVolume(stage: stage, wholeDisk: wholeDisk)
+        if let expectedPartition = windowsPreparedTargetPartitionBSDName,
+           target.partitionBSDName != expectedPartition {
+            throw HelperExecutionError.failed(
+                stage: stage.key,
+                exitCode: -1,
+                description: "Partycja docelowa Windows zmieniła identyfikator z \(expectedPartition) na \(target.partitionBSDName)."
+            )
+        }
+        if let expectedVolumeUUID = windowsPreparedTargetVolumeUUID,
+           target.volumeUUID != expectedVolumeUUID {
+            throw HelperExecutionError.failed(
+                stage: stage.key,
+                exitCode: -1,
+                description: "Wolumin docelowy Windows zmienił UUID podczas wykonywania procesu."
+            )
+        }
+
+        windowsPreparedTargetPartitionBSDName = target.partitionBSDName
+        windowsPreparedTargetVolumePath = target.mountPath
+        windowsPreparedTargetVolumeUUID = target.volumeUUID
+
+        emitProgress(
+            stageKey: stage.key,
+            titleKey: stage.titleKey,
+            percent: latestPercent,
+            statusKe
```

---

### Incident Patch 15: `bb85cc02` (2026-08-23)
**Commit Message**: Require Windows target volume UUID

Reject formatted target candidates without a volume UUID and require the recorded UUID in later Windows stages.

**File**: `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsTargetResolution.swift` (modified, +13/-7)
```diff
@@ -4,14 +4,14 @@ struct WindowsTargetVolumeResolution {
     let wholeDiskBSDName: String
     let partitionBSDName: String
     let mountPath: String
-    let volumeUUID: String?
+    let volumeUUID: String
 }
 
 private struct WindowsTargetPartitionState {
     let wholeDiskBSDName: String
     let partitionBSDName: String
     let mountPath: String?
-    let volumeUUID: String?
+    let volumeUUID: String
 }
 
 extension HelperWorkflowExecutor {
@@ -117,7 +117,7 @@ extension HelperWorkflowExecutor {
             titleKey: stage.titleKey,
             percent: latestPercent,
             statusKey: stage.statusKey,
-            logLine: "Windows target path refreshed: disk=\(wholeDisk), partition=\(target.partitionBSDName), mountPath=\(target.mountPath), volumeUUID=\(target.volumeUUID ?? "none")",
+            logLine: "Windows target path refreshed: disk=\(wholeDisk), partition=\(target.partitionBSDName), mountPath=\(target.mountPath), volumeUUID=\(target.volumeUUID)",
             shouldAdvancePercent: false
         )
         return target.mountPath
@@ -144,12 +144,15 @@ extension HelperWorkflowExecutor {
             }
 
             let mountPath = (info["MountPoint"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
-            let volumeUUID = (info["VolumeUUID"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
+            guard let volumeUUID = (info["VolumeUUID"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
+                  !volumeUUID.isEmpty else {
+                return nil
+            }
             return WindowsTargetPartitionState(
                 wholeDiskBSDName: parentWholeDisk,
                 partitionBSDName: resolvedPartition,
                 mountPath: mountPath?.isEmpty == false ? mountPath : nil,
-                volumeUUID: volumeUUID?.isEmpty == false ? volumeUUID : nil
+                volumeUUID: volumeUUID
             )
         }
     }
@@ -178,7 +181,10 @@ extension HelperWorkflowExecutor {
             return nil
         }
 
-        let volumeUUID = (info["VolumeUUID"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
+        guard let volumeUUID = (info["VolumeUUID"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
+              !volumeUUID.isEmpty else {
+            return nil
+        }
         if let expectedVolumeUUID,
            volumeUUID != expectedVolumeUUID {
             return nil
@@ -188,7 +194,7 @@ extension HelperWorkflowExecutor {
             wholeDiskBSDName: parentWholeDisk,
             partitionBSDName: partitionBSDName,
             mountPath: resolvedMountPath,
-            volumeUUID: volumeUUID?.isEmpty == false ? volumeUUID : nil
+            volumeUUID: volumeUUID
         )
     }
 
```

**File**: `macUSBHelper/Workflow/Windows/HelperWorkflowWindowsUnmountLogic.swift` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ extension HelperWorkflowExecutor {
             titleKey: stage.titleKey,
             percent: latestPercent,
             statusKey: stage.statusKey,
-            logLine: "Windows target prepared: disk=\(wholeDisk), partition=\(target.partitionBSDName), label=\(request.targetLabel), mountPath=\(target.mountPath), volumeUUID=\(target.volumeUUID ?? "none")",
+            logLine: "Windows target prepared: disk=\(wholeDisk), partition=\(target.partitionBSDName), label=\(request.targetLabel), mountPath=\(target.mountPath), volumeUUID=\(target.volumeUUID)",
             shouldAdvancePercent: false
         )
     }
```

#### Recent Merged Pull Requests:
- **PR #134** (2026-10-04): Stabilize USB selection messages (@Kruszoneq)
- **PR #133** (2026-10-04): Add SD card target support (@Kruszoneq)
- **PR #132** (2026-10-04): Add optional automatic welcome screen skipping (@Kruszoneq)
- **PR #131** (2026-10-04): Add Dutch (nl) localization (@safepoint)
- **PR #130** (2026-10-03): Improve USB discovery and target validation (@Kruszoneq)
- **PR #129** (2026-10-03): Bound USB discovery and balance IOKit references (@kossoy)
- **PR #126** (2026-10-02): Organize localization catalogs by feature (@Kruszoneq)
- **PR #125** (closed): Add Linux image downloads to the downloader (@NickBouwhuis)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
