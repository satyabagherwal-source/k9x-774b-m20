# Forensic Learning Record (Deep Inspection): darrylmorley/whatcable

> **Canonical Artifact**: `07_PROJECT_LEARNING/darrylmorley-whatcable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/darrylmorley/whatcable](https://github.com/darrylmorley/whatcable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:24:29.827Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `darrylmorley/whatcable`
- **Description**: macOS menu bar app that tells you, in plain English, what each USB-C cable plugged into your Mac can actually do
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8839 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/WhatCableCore/Cable/CableClassification.swift`
```
import Foundation

/// Decides whether a cable is active or passive from two independent sources
/// rather than one.
///
/// The e-marker's ID Header is a self-report, and issue #111 showed it can be
/// mis-programmed: a real active Thunderbolt 4 cable that declares itself
/// passive. The port controller publishes its own `ActiveCable` verdict, which
/// `AppleHPMInterface.activeCable` already reads. Reading both means a
/// mis-programmed e-marker no longer decides the answer alone.
///
/// A self-report of active is never demoted, whatever the port says. Across
/// the corpus no port contradicts an active self-report in that direction, so
/// a disagreement there would be the port being wrong, not the cable.
public enum CableClassification {
    /// Which of the two readings settled the verdict.
    public enum Source: Hashable, Sendable {
        /// The cable's own ID Header, taken at face value.
        case emarker
        /// The port controller's `ActiveCable` flag, overriding a passive
        /// self-report.
        case portController
        /// VDO[3] uses a field that only exists in the active-cable layout
        /// while the ID Header says passive. See
        /// `USBPDSOP.hasActiveLayoutContradiction`.
        case layoutContradiction
    }

    public struct Resolution: Hashable, Sendable {
        public let type: PDVDO.CableType
        public let source: Source

        public init(type: PDVDO.CableType, source: Source) {
            self.type = type
            self.source = source
        }
    }

    /// Resolve the cable type. Returns nil when the identity carries no
    /// VDO[3], because there is then nothing to classify.
    ///
    /// Promotion needs a genuine passive self-report, because "not active"
    /// also covers a VCONN-Powered Device and an Alternate Mode Adapter.
    ///
    /// The caller must pass the port this identity belongs to. The join is
    /// `USBPDSOP.canonicallyMatches(port:)`. A different port's `ActiveCable`
    /// flag would promote a passive cable here, and machines really do carry
    /// both values at once (`m3_macos26.5` has `USB-C@1` true beside
    /// `MagSafe 3@1` false). There is deliberately no check for it in here:
    /// re-doing the join would hide a caller's wiring bug rather than let it
    /// surface.
    public static func resolve(identity: USBPDSOP, port: AppleHPMInterface?) -> Resolution? {
        guard let cable = identity.cableVDO else { return nil }

        if cable.cableType == .active {
            return Resolution(type: .active, source: .emarker)
        }

        // A controller measurement beats a structural inference drawn from a
        // bit pattern, so the port is checked first when both would fire.
        //
        // Gated on the passive product type, not on `cableType != .active`:
        // `cableType` is decoded from `ufpProductType == .activeCable`, so
        // "not active" also covers a VCONN-Powered Device and an Alternate
        // Mode Adapter, neither of which is a cable claiming to be passive.
        // Two real corpus ports carry an Apple VPD on a controller reporting
        // ActiveCable true. Same gate `hasActiveLayoutContradiction` applies.
        if identity.idHeader?.ufpProductType == .passiveCable, port?.activeCable == true {
            return Resolution(type: .active, source: .portController)
        }
        if identity.hasActiveLayoutContradiction {
            return Resolution(type: .active, source: .layoutContradiction)
        }

        return Resolution(type: .passive, source: .emarker)
    }
}

```

### Core Architecture Module: `Sources/WhatCableCore/Cable/CableReport.swift`
```
import Foundation

/// Builds the data and pre-filled GitHub issue URL behind the "Report this
/// cable" feature. Pure data assembly. The app and the CLI both render this
/// payload; nothing in here touches the network.
public enum CableReport {
    /// The cable identity an issue is being filed for, plus optional system
    /// info. Renders to a stable markdown block so reports can later be
    /// parsed back into a curated rules file.
    public struct Payload {
        public let cable: CableFingerprint
        public let system: SystemInfo?
        public let appVersion: String
        /// CIO capability from the Thunderbolt controller, if a TB link
        /// was active on this port when the report was created.
        public let cioCapability: CIOCableCapability?

        public init(cable: CableFingerprint, system: SystemInfo?, appVersion: String, cioCapability: CIOCableCapability? = nil) {
            self.cable = cable
            self.system = system
            self.appVersion = appVersion
            self.cioCapability = cioCapability
        }
    }

    public struct CableFingerprint {
        public let vendorID: Int
        public let productID: Int
        public let vendorIDHex: String
        public let productIDHex: String
        public let vendorName: String
        public let speed: String?
        public let currentRating: String?
        public let maxVolts: Int?
        public let maxWatts: Int?
        public let type: String?
        /// Which reading settled `type`: "emarker", "portController" or
        /// "layoutContradiction". Nil exactly when `type` is nil. Same
        /// spellings as the `--json` key, so both are read the same way.
        public let typeSource: String?
        public let hasEmarker: Bool
        /// Raw 32-bit VDOs as the cable returned them. Included in reports
        /// so we can later distinguish "macOS dropped the field" from "the
        /// cable genuinely sent zero" when calibrating heuristics like the
        /// zero-PID flag.
        public let vdos: [UInt32]
        /// USB-IF-issued certification ID from the Cert Stat VDO, or
        /// `nil` when the e-marker carries no XID. Surfaced as neutral
        /// information; many reputable cables ship without certification.
        public let usbifCertID: UInt32?

        public init(identity: USBPDSOP, port: AppleHPMInterface? = nil) {
            self.vendorID = identity.vendorID
            self.productID = identity.productID
            self.vendorIDHex = String(format: "0x%04X", identity.vendorID)
            self.productIDHex = String(format: "0x%04X", identity.productID)
            // On a confident identity match (VID + PID) prefer the curated
            // brand/model, so a catalogued cable reads as e.g. "Anker 643"
            // rather than just its silicon vendor. Fall back to the bundled
            // vendor name (VendorDB.name delegates to CableDB.vendorName and
            // adds the 0x0000 / 0xFFFF sentinel text), then to unknown. See #239.
            //
            // A fingerprint can resolve more than one brand (#505: the same
            // e-marker sold under several sleeve brands). Join distinct
            // brands with " / " rather than picking the first: this field
            // feeds the machine-consumed report body, and sync-cable-reports.swift
            // only regexes the hex VID out of that cell (extractHex matches
            // the first "0x..." anywhere in the string), so a joined brand
            // string here doesn't break parsing.
            let cableVDORaw = identity.vdos.count > 3 ? identity.vdos[3] : 0
            let curated = CableDB.curatedCables(vid: identity.vendorID, pid: identity.productID, cableVDO: cableVDORaw)
            var seenBrands = Set<String>()
            let distinctBrands = curated.map(\.brand).filter { seenBrands.insert($0).inserted }
            if distinctBrands.isEmpty {
                self.vendorName = VendorDB.name(for: identity.vendorID) ?? "Unregistered / unknown"
            } else {
                self.vendorName = distinctBrands.joined(separator: " / ")
            }
            self.vdos = identity.vdos
            if let cs = identity.certStatVDO, cs.isPresent {
                self.usbifCertID = cs.xid
            } else {
                self.usbifCertID = nil
            }
            if let cv = identity.cableVDO {
                // Reports are machine-consumed by sync-cable-reports.swift,
                // so keep this value stable and independent of the UI locale.
                self.speed = cv.reportSpeedLabel
                self.currentRating = cv.current.reportLabel
                self.maxVolts = cv.maxVolts
                self.maxWatts = cv.maxWatts
                // The verdict is the classifier's: a cable the port controller
                // calls active is filed as active even when its own e-marker
                // says otherwise (issue #111 was filed as passive).
                let resolution = CableClassification.resolve(identity: identity, port: port)
                self.type = (resolution?.type ?? cv.cableType) == .active ? "active" : "passive"
                switch resolution?.source {
                case .emarker, nil: self.typeSource = "emarker"
                case .portController: self.typeSource = "portController"
                case .layoutContradiction: self.typeSource = "layoutContradiction"
                }
                self.hasEmarker = true
            } else {
                self.speed = nil
                self.currentRating = nil
                self.maxVolts = nil
                self.maxWatts = nil
                self.type = nil
                self.typeSource = nil
                self.hasEmarker = (identity.endpoint == .sopPrime || identity.endpoint == .sopDoublePrime)
            }
        }
    }

    public struct SystemInfo {
        public let macModel: String
        public let macOSVersion: String

        public init(macModel: String, macOSVersion: String) {
            self.macModel = macModel
            self.macOSVersion = macOSVersion
        }

        /// Builds a `SystemInfo` for a report. `macModel` is passed in rather
        /// than read here: this function decides how to shape a report, and
        /// has to stay callable in tests with any model string, so the live
        /// `sysctlbyname` read is somebody else's job. Callers fetch it via
        /// `DarwinSystemInfo.fetchMacModel()` in `WhatCableDarwinBackend` and
        /// pass it in. `macOSVersion` stays here because `ProcessInfo` is
        /// portable Foundation, not Darwin-only.
        public static func current(macModel: String) -> SystemInfo {
            SystemInfo(macModel: macModel, macOSVersion: fetchOSVersion())
        }

        private static func fetchOSVersion() -> String {
            let v = ProcessInfo.processInfo.operatingSystemVersion
            return "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
        }
    }

    /// Build a payload from a cable e-marker identity. Returns nil if the
    /// identity isn't a cable endpoint (SOP' / SOP'').
    public static func payload(
        for identity: USBPDSOP,
        includeSystemInfo: Bool = false,
        macModel: String = "unknown",
        appVersion: String = AppInfo.version,
        cioCapability: CIOCableCapability? = nil,
        port: AppleHPMInterface? = nil
    ) -> Payload? {
        let isCable = identity.endpoint == .sopPrime || identity.endpoint == .sopDoublePrime
        guard isCable else { return nil }
        return Payload(
            cable: CableFingerprint(identity: identity, port: port),
            system: includeSystemInfo ? SystemInfo.current(macModel: macModel) : nil,
            appVersion: appVersion,
            cioCapability: cioCapability
        )
    }

    /// Issue endpoint the report is filed against.
    public static let issueBaseURL = URL(string: "https://github.com/darrylmorley/whatcable/issues/new")!

    /// Plain-English label for a `typeSource` value. The report markdown is
    /// machine-read and not localised, exactly like the rows around it.
    static func typeSourceLabel(_ source: String) -> String {
        switch source {
        case "portController": return "port controller"
        case "layoutContradiction": return "e-marker layout contradiction"
        default: return source
        }
    }

    /// Map a VDO array index to its role per the USB-PD spec layout for a
    /// passive / active cable Discover Identity response. Anything past the
    /// known indices is "Other" so we still surface the raw value.
    public static func vdoRoleLabel(at index: Int) -> String {
        switch index {
        case 0: return "ID Header"
        case 1: return "Cert Stat"
        case 2: return "Product"
        case 3: return "Cable"
        case 4: return "Active Cable VDO2"
        default: return "Other"
        }
    }
}

extension CableReport.Payload {
    /// Markdown body that gets dropped into the cable-report issue template.
    /// Format is intentionally stable so future tooling can parse reports
    /// back into a curated rules file.
    public var markdown: String {
        var lines: [String] = []
        lines.append("### Cable e-marker fingerprint")
        lines.append("")
        lines.append("| Field | Value |")
        lines.append("|---|---|")
        if cable.hasEmarker && cable.vdos.isEmpty {
            // E-marker present but its identity was not read on this
            // connection (see the note below). Don't emit a 0x0000 vendor /
            // product, which reads as a real but blank fingerprint. A non-hex
            // value also makes sync-cable-reports skip it rather than file a
            // bogus zeroed row.
            lines.append("| Vendor ID | not read on this connection |")
            lines.append("| Product ID | not read on this connection |")
        } else {
            lines.append("| Vendor ID
```

### Core Architecture Module: `Sources/WhatCableCore/Cable/CableTrust.swift`
```
import Foundation

/// The trust verdict for a cable, as a single tier plus the evidence behind
/// it. Carries no user-facing copy (that arrives in the UI phase, the same
/// way `DataLinkDiagnostic` deferred its wording).
///
/// **Behaviour-first model** (see `planning/cable-trust-model.md`). Trust is
/// whether the cable *delivers what it claims*, not whether its e-marker bits
/// are internally tidy. Running the static-flag model against the real cable
/// corpus showed that spec-encoding flags fire on genuine hardware (Apple's
/// own cables among them), so those flags are **notes only** here; they never
/// set the tier.
///
/// **Phase 1 (this type) produces green or amber only.**
/// - Green: we have *watched the cable deliver its claim* (the live link
///   carried its claimed speed, or a PD contract carried its full rated
///   power). Earns green even with a zeroed vendor ID: performance outranks
///   pedigree. Registration alone is **not** enough, because green is a claim
///   of proof and registration isn't proof of delivery.
/// - Amber: unverified. Nothing demanding has been connected, or the maker
///   can't be corroborated. Not a fault, never "suspicious."
///
/// Red ("isn't performing as expected") is Phase 2: it needs attributed,
/// *corroborated* non-delivery (repeat failure or overcurrent), which depends
/// on session-quality monitoring. This type never emits red yet.
public struct CableTrust: Hashable {
    public enum Tier: String, Hashable, Sendable {
        /// Watched delivering its claim.
        case green
        /// Unverified: nothing to confirm, or maker can't be corroborated.
        case amber
        /// Demonstrably not delivering. Reserved for Phase 2 (behavioural,
        /// built on session monitoring); not produced by this type yet.
        case red
    }

    /// Which behavioural axes confirmed delivery. Non-empty only on green.
    public enum Dimension: String, Hashable, Sendable {
        /// The live data link carried the cable's full claimed speed.
        case data
        /// A PD contract carried at or above the cable's full rated power.
        case power
    }

    public let tier: Tier

    /// The axes that confirmed delivery (green only). Tells the UI whether to
    /// say "we've seen it carry 40 Gbps", "its full 100 W", or both.
    public let confirmedBy: Set<Dimension>

    /// Static e-marker flags that fired. **Informational notes only**; they
    /// do not affect the tier. Rendered as hedged "unusual" detail.
    public let flags: [TrustFlag]

    /// Whether the vendor ID is USB-IF registered. Informational (drives the
    /// amber "registered vendor, not yet seen to perform" note); not a tier
    /// driver, because registration is an assumption of genuineness, not
    /// proof of delivery.
    public let vendorRegistered: Bool

    /// The live link disagrees with the e-marker's claim. A pointer for the
    /// UI ("see the Negotiation breakdown"); it gates off confirmation (we
    /// won't claim delivery while readings conflict) but never itself sets a
    /// tier.
    public let contradiction: Bool

    /// True when green was earned by watching the cable perform.
    public var isConfirmed: Bool { tier == .green }

    // MARK: Primitive init (unit-tested directly)

    /// - Parameters:
    ///   - flags: the static e-marker trust flags (notes only).
    ///   - vendorRegistered: whether the vendor ID is in the USB-IF list.
    ///   - dataConfirmed: the live link carried the cable's full claimed speed.
    ///   - powerConfirmed: a PD contract carried the cable's full rated power.
    ///   - contradiction: the link and e-marker disagree (gates confirmation).
    ///   - sessionFailed: session monitoring corroborated non-delivery
    ///     (repeated/sustained data degradation or out-of-spec resistance
    ///     under load). This is the only path to red. It outranks
    ///     confirmation: a cable that performed earlier but then demonstrably
    ///     failed is red, not green.
    public init(
        flags: [TrustFlag],
        vendorRegistered: Bool,
        dataConfirmed: Bool,
        powerConfirmed: Bool,
        contradiction: Bool,
        sessionFailed: Bool = false
    ) {
        self.flags = flags
        self.vendorRegistered = vendorRegistered
        self.contradiction = contradiction

        // Corroborated non-delivery wins outright. Red is never "confirmed
        // delivering", so it carries no confirmed dimensions.
        if sessionFailed {
            self.tier = .red
            self.confirmedBy = []
            return
        }

        // A live disagreement between the e-marker and the link gates off
        // confirmation: we won't claim the cable delivered while two readings
        // contradict each other.
        var confirmed: Set<Dimension> = []
        if !contradiction {
            if dataConfirmed { confirmed.insert(.data) }
            if powerConfirmed { confirmed.insert(.power) }
        }

        if confirmed.isEmpty {
            self.tier = .amber
            self.confirmedBy = []
        } else {
            self.tier = .green
            self.confirmedBy = confirmed
        }
    }
}

extension CableTrust {
    // MARK: Convenience init (derives the behavioural signals)

    /// Build a verdict from the static report plus the live diagnostics.
    /// Derivation lives in one tested place.
    ///
    /// - Parameters:
    ///   - report: the static e-marker trust report (its flags become notes).
    ///   - vendorRegistered: `VendorDB.isRegistered(vendorID)`.
    ///   - dataLink: the port's data-link diagnostic, or nil when there's no
    ///     active link to judge.
    ///   - negotiatedWatts: the winning PD contract's wattage, or nil.
    ///   - ratedWatts: the cable e-marker's rated wattage, or nil.
    ///   - sessionVerdict: the running `SessionMonitor` verdict for this
    ///     connection, or nil when nothing is being watched. Only
    ///     `.notPerforming` drives red; `.caution` / `.performing` leave the
    ///     tier to the green/amber logic (a caution is not yet a conviction).
    public init(
        report: CableTrustReport,
        vendorRegistered: Bool,
        dataLink: DataLinkDiagnostic?,
        negotiatedWatts: Int?,
        ratedWatts: Int?,
        sessionVerdict: SessionMonitor.Verdict? = nil
    ) {
        // `.fine` can fire from the host/device floor with no cable speed
        // claim involved. Only treat it as confirmation when the cable
        // actually advertised a speed the link could meet, or we'd assert
        // "delivered its claim" for a claim the cable never made.
        let hasCableSpeedClaim = dataLink?.facts.cableGbps != nil
        let behaviour = CableTrust.behaviour(
            for: dataLink?.bottleneck,
            hasCableSpeedClaim: hasCableSpeedClaim
        )

        // Power is confirmed only when we've watched the cable carry its full
        // rated power. Carrying less is an honest lower bound (useful copy)
        // but not confirmation of the rating.
        let powerConfirmed: Bool
        if let negotiated = negotiatedWatts, let rated = ratedWatts, rated > 0 {
            powerConfirmed = negotiated >= rated
        } else {
            powerConfirmed = false
        }

        self.init(
            flags: report.flags,
            vendorRegistered: vendorRegistered,
            dataConfirmed: behaviour.dataConfirmed,
            powerConfirmed: powerConfirmed,
            contradiction: behaviour.contradiction,
            sessionFailed: sessionVerdict == .notPerforming
        )
    }

    /// Map a data-link bottleneck to the two behavioural booleans. Extracted
    /// so the rules are testable without building a full `DataLinkDiagnostic`.
    ///
    /// Data is confirmed only by two cases: the link ran right up to the
    /// cable's own rating (`.cableLimit`, which only fires when a cable claim
    /// exists), or it ran at the fastest the parties support (`.fine`) AND the
    /// cable advertised a speed. `.fine` alone isn't enough: it can come from
    /// the host/device floor with no cable claim, and confirming a claim the
    /// cable never made would be a false green. `.cableContradictsActive` is
    /// the e-marker and link disagreeing with no tie-breaker: a pointer, not
    /// confirmation. Every other case is someone else's limit (host, device)
    /// or an unattributable shortfall, none of which is the cable's fault, so
    /// none confirm and none contradict.
    ///
    /// - Parameter hasCableSpeedClaim: whether the cable advertised a usable
    ///   speed (from its e-marker or the controller). Gates the `.fine` case.
    public static func behaviour(
        for bottleneck: DataLinkDiagnostic.Bottleneck?,
        hasCableSpeedClaim: Bool
    ) -> (dataConfirmed: Bool, contradiction: Bool) {
        switch bottleneck {
        case .cableLimit:
            return (true, false)
        case .fine:
            return (hasCableSpeedClaim, false)
        case .cableContradictsActive:
            return (false, true)
        case .blockedBySecurity:
            // A security block is not a cable-trust signal: the cable's
            // capabilities are not in question, only the user's approval state.
            return (false, false)
        case .hostLimit, .deviceLimit, .degraded, .unknownCable, .none:
            return (false, false)
        }
    }
}

```

### Core Architecture Module: `Sources/WhatCableCore/Cable/CableTrustReport.swift`
```
import Foundation

/// Heuristic flags raised against a cable's e-marker data. We trust the
/// e-marker by design, so wording is hedged: "looks unusual," never "this
/// cable is fake." A blank vendor ID in particular reads as a calm note
/// when the rest of the e-marker is well-formed (see `zeroVendorID`); it
/// only escalates to a warning when other capability data is inconsistent.
public struct CableTrustReport: Hashable {
    public let flags: [TrustFlag]

    public var isEmpty: Bool { flags.isEmpty }

    public init(flags: [TrustFlag]) {
        self.flags = flags
    }

    /// Build a report from an SOP' / SOP'' e-marker identity. Returns an
    /// empty report when no flags fire so callers can decide whether to
    /// render anything.
    ///
    /// - Parameters:
    ///   - identity: the cable's e-marker (SOP' / SOP'') Discover Identity.
    ///   - partner: the same port's SOP/partner identity, when present. A
    ///     cable plugged in on its own can answer at the SOP address and
    ///     declare a registered vendor there even though its e-marker reads
    ///     a blank vendor ID. In that case the cable does carry a vendor
    ///     identity, so the blank-e-marker reading is a neutral note, not a
    ///     counterfeit signal. See issue #250.
    public init(identity: USBPDSOP, partner: USBPDSOP? = nil) {
        guard identity.endpoint == .sopPrime || identity.endpoint == .sopDoublePrime else {
            self.flags = []
            return
        }

        // The e-marker endpoint can be present with no identity VDOs read: a
        // connection at 3A or below, with no Thunderbolt, never wakes the
        // e-marker, so its vendor ID parses as 0 with no capability data. That
        // is "not read on this connection", not a blank or suspicious cable,
        // and there is nothing to judge. Emit no flags so we don't fire a
        // false zeroVendorID warning. A genuinely zeroed cable still carries
        // its VDOs (a populated ID header and Cable VDO), so it is unaffected.
        guard !identity.vdos.isEmpty else {
            self.flags = []
            return
        }

        // Belt and braces for issue #542. The flag catalogue below judges
        // cable e-marker data, and a VCONN-powered device's VDOs are not
        // that, so there is nothing here to judge. Strict `isCable`, not the
        // looser `identifiesAsCable` heuristic: the point is to exclude
        // responders that positively declare a non-cable product type.
        guard identity.idHeader?.isCable == true else {
            self.flags = []
            return
        }

        var collected: [TrustFlag] = []

        // Does the plug (SOP partner) declare itself a cable with a
        // USB-IF-registered vendor ID? Only then does the partner identity
        // belong to *this cable* (not a connected device), so only then can
        // it soften a blank e-marker VID. We require registration, not just
        // a non-zero value: a registered VID is real proof of a known maker.
        //
        // We additionally refuse to soften when the plug's DFP product type
        // decodes as a Power Brick (DFP raw 3, USB PD R3.2 Table 6.34). A
        // registered charger on the far end of a VID-less cable is a connected
        // device, not the cable itself, so its VID says nothing about the
        // cable's origin — crediting it would present the brick's maker (Anker,
        // Apple, Samsung, …) as the cable's. The raw-DFP-3 bit pattern also
        // matches non-compliant cables that put their UFP cable type in the
        // DFP field; those lose the partner note as a result but keep a calm
        // zeroVendorID note rather than a counterfeit warning. The DFP raw 4
        // (active-cable lookalike) case still softens, since `.reserved4` is
        // not a real product type.
        let partnerIsRegisteredCable = partner.map {
            $0.identifiesAsCable
                && $0.idHeader?.dfpProductType != .powerBrick
                && $0.vendorID != 0
                && VendorDB.isRegistered($0.vendorID)
        } ?? false

        // A blank vendor ID reads very differently depending on whether the
        // rest of the e-marker holds up. A cable that still presents a
        // well-formed Cable VDO (in-spec capability bits, no decode warnings)
        // but no vendor ID is overwhelmingly a genuine cable that simply
        // never had a USB-IF VID burned in: across the customer-probe corpus,
        // every zeroed-VID cable pairs the blank ID with a valid capability
        // word (e.g. issue #252's Native Union 240W cable). A blank ID with a
        // missing or malformed VDO is the shape that actually warrants
        // caution. This corroboration drives the flag's severity, note vs
        // warning, not whether it fires.
        let cableVDOCorroborates = identity.cableVDO.map { $0.decodeWarnings.isEmpty } ?? false

        // Vendor ID handling:
        //   0x0000: no value. Fires zeroVendorID UNLESS the plug identifies
        //           the same cable as a registered vendor, in which case it's
        //           a neutral note (the cable does have an identity, just at a
        //           different address).
        //   0xFFFF: spec-defined "vendor opted out of USB-IF registration."
        //           Legitimate per spec, so this is neutral metadata, not a
        //           trust flag. Surfaced via the vendor-name path (see
        //           VendorDB.name) so the UI describes it without a warning.
        //   anything else not in the bundled USB-IF list: if the VID still
        //           resolves to a recognised maker via the community usb.ids
        //           list, that is a neutral note (vidCommunityKnownNotUSBIF).
        //           If it resolves to nothing (or only the junk "Unknown"
        //           name), it fires the vidNotInUSBIFList warning (H3).
        if identity.vendorID == 0 {
            if partnerIsRegisteredCable, let partner {
                collected.append(.eMarkerVIDBlankRegisteredPartner(partner.vendorID))
            } else {
                collected.append(.zeroVendorID(corroborated: cableVDOCorroborates))
            }
        } else if identity.vendorID == 0xFFFF {
            // Intentionally no flag.
        } else if !VendorDB.isRegistered(identity.vendorID) {
            // The VID is not in our bundled USB-IF list. Two sub-cases: a
            // recognised maker from the community usb.ids list (a real brand
            // our subset simply lacks) reads as a calm note; a VID that
            // resolves to nothing, or to a placeholder name, keeps the
            // warning, since on a clone cable that is the shape worth a
            // closer look. The usb.ids list carries a few placeholders
            // ("Unknown", "Prototype product Vendor ID") that must not soften.
            let name = VendorDB.name(for: identity.vendorID)
            let recognisedBrand = name.map {
                $0 != "Unknown" && !$0.contains("Vendor ID")
            } ?? false
            if recognisedBrand {
                collected.append(.vidCommunityKnownNotUSBIF(identity.vendorID))
            } else {
                collected.append(.vidNotInUSBIFList(identity.vendorID))
            }
        }

        if let cv = identity.cableVDO {
            for warning in cv.decodeWarnings {
                switch warning {
                case .reservedSpeedEncoding(let bits):
                    collected.append(.reservedSpeedEncoding(bits))
                case .reservedCurrentEncoding(let bits):
                    collected.append(.reservedCurrentEncoding(bits))
                case .reservedCableLatencyEncoding(let bits):
                    collected.append(.reservedCableLatencyEncoding(bits))
                case .invalidVDOVersion(let bits):
                    collected.append(.invalidVDOVersion(bits))
                case .invalidCableTermination(let bits):
                    collected.append(.invalidCableTermination(bits))
                case .eprClaimedWithLowMaxVoltage:
                    collected.append(.eprClaimedWithLowMaxVoltage)
                }
            }
        }

        self.flags = collected
    }
}

public enum TrustFlag: Hashable {
    /// How strongly a flag should read. A `.warning` is a real "this looks
    /// unusual" signal; a `.note` is neutral, informational context that
    /// happens to live in the same list (so the UI can render it calmly
    /// rather than as an alarm).
    public enum Severity: Hashable {
        case note
        case warning
    }

    /// E-marker present but vendor ID is zero. Many genuine cables ship
    /// without a USB-IF vendor ID, so this is not a fault on its own. The
    /// associated `corroborated` flag is true when the cable still presents
    /// a well-formed Cable VDO (real capability bits, no decode warnings):
    /// in that case the blank ID is a calm `.note`. When the VDO is missing
    /// or malformed, `corroborated` is false and the flag reads as a
    /// `.warning`, since a blank ID alongside bad capability data is the
    /// shape worth a closer look.
    ///
    /// Note: the spec-defined sentinel `0xFFFF` (vendor opted out of
    /// USB-IF registration) is intentionally NOT a TrustFlag: it's
    /// allowed by the PD spec, so flagging it as a warning would be
    /// misleading. It's surfaced via VendorDB / the cable report instead.
    case zeroVendorID(corroborated: Bool)

    /// The e-marker's vendor ID is blank, but the plug (SOP partner)
    /// identifies this same cable as a USB-IF-registered vendor. The cable
    /// does carry a vendor identity, so this is a neutral note, not a
    /// counterfeit signal. Associated value is the plug's registered VID.
    case eMarkerVIDBlankRegisteredPartner(Int)

    /// Cable VDO speed field uses a reserved bit pattern (5, 6, or 7).
    /// Real e-marker chips shouldn't 
```

### Core Architecture Module: `Sources/WhatCableCore/Cable/SessionMonitor.swift`
```
import Foundation

/// Watches one connected cable over time and decides whether it is actually
/// *delivering* what it claims. This is the bedrock for the trust model's
/// red tier (see `research/cable-trust-model.md`): a single bad reading is
/// never enough to convict a cable, so the verdict is built from corroborated
/// evidence accumulated across a connection, not from one snapshot.
///
/// The model is deliberately a value type fed one observation at a time. The
/// platform watcher owns a `var monitor = SessionMonitor()` and calls
/// `monitor.record(_:)` each poll; the verdict is then read off `verdict`.
/// Keeping it pure (no `Date`, no IOKit, no I/O) is what lets the replay
/// tests drive a whole session as a plain array of observations and assert
/// exactly when it does, and does not, go red.
///
/// **Asymmetry (load-bearing).** Measurement can *confirm* delivery cheaply
/// but must only *convict* on corroborated evidence:
/// - one transient bad poll (a reseat, a current spike) never reaches red,
/// - a host or device limit is never the cable's fault and never reaches red,
/// - red needs either a degradation that *repeats* (dropped, recovered,
///   dropped again) or one that is *sustained* well past a debounce window,
///   or resistance that stays out of the spec budget under load.
public struct SessionMonitor: Equatable, Sendable {

    /// What a single poll says about whether the cable delivered its claim on
    /// the data link. Derived from `DataLinkDiagnostic.Bottleneck` via
    /// `DataDelivery.from(_:hasCableSpeedClaim:)` so the rules live in one
    /// tested place, the same way `CableTrust.behaviour(...)` does it.
    public enum DataDelivery: Equatable, Sendable {
        /// The link carried the cable's full claimed speed (or ran right up
        /// to the cable's own rating). Evidence the cable performs.
        case confirmed
        /// The link came up below what the cable claims, on a path where the
        /// host and device could both go faster. The cable (or its
        /// connection) is the honest suspect. One of these alone is a
        /// caution, not a conviction.
        case belowClaim
        /// Nothing demanding to judge: the cap is the host or the device, the
        /// cable made no claim, or the readings merely disagree. Neither
        /// confirms nor degrades.
        case notApplicable
    }

    /// One poll's worth of evidence. `fingerprint` identifies the connection
    /// (port + cable). When it changes, a different cable is plugged in and
    /// the session resets, so two cables' evidence can never be merged.
    public struct Observation: Equatable, Sendable {
        public let fingerprint: String
        public let dataDelivery: DataDelivery
        /// The resistance tier, but only when the estimate is `stable`; pass
        /// `nil` otherwise (a converging or unreliable estimate is no
        /// evidence). See `CableResistanceEstimate.tier(ratedFiveA:)`.
        public let resistanceTier: CableResistanceEstimate.Tier?
        /// The port controller's lifetime overcurrent trip count
        /// (`AppleHPMInterface.overcurrentCount`), or `nil` when unknown. The
        /// monitor watches the *in-session delta*: the count when the cable
        /// was plugged in is the baseline, and any rise while it stays plugged
        /// is a real overcurrent event on this connection.
        public let overcurrentCount: Int?
        /// The port controller's lifetime hard-reset count
        /// (`PortHealthCounters.hardResetCount`), or `nil` when unknown.
        /// Read as an in-session delta, exactly like `overcurrentCount`: the
        /// count at plug-in is the baseline and only a rise while the cable
        /// stays connected is evidence about this connection.
        public let hardResetCount: Int?
        /// The port controller's lifetime attach count
        /// (`PortHealthCounters.attachCount`), or `nil` when unknown. The
        /// companion to `hardResetCount`: a rise here means someone
        /// re-seated the connector, which explains a reset rather than
        /// indicting the cable.
        public let attachCount: Int?

        public init(
            fingerprint: String,
            dataDelivery: DataDelivery,
            resistanceTier: CableResistanceEstimate.Tier?,
            overcurrentCount: Int? = nil,
            hardResetCount: Int? = nil,
            attachCount: Int? = nil
        ) {
            self.fingerprint = fingerprint
            self.dataDelivery = dataDelivery
            self.resistanceTier = resistanceTier
            self.overcurrentCount = overcurrentCount
            self.hardResetCount = hardResetCount
            self.attachCount = attachCount
        }
    }

    /// The running assessment of the current connection.
    public enum Verdict: String, Equatable, Sendable {
        /// No corroborated problem. Either confirmed delivery or simply
        /// nothing demanding has stressed the cable yet.
        case performing
        /// One degradation or one out-of-spec reading has been seen, but not
        /// enough to convict. A soft heads-up, never the cable's fault yet.
        case caution
        /// Corroborated non-delivery: repeated or sustained data degradation,
        /// or resistance out of the spec budget under load. This is the
        /// behavioural red tier. Wording stays observational ("isn't
        /// performing as expected"), never "fake".
        case notPerforming
    }

    // MARK: Debounce thresholds
    //
    // These are conservative on purpose (erring toward never convicting a
    // good cable) and will be tuned once the engine has watched real
    // hardware. At a ~2s poll, a streak of 3 is roughly 6 seconds.

    /// A single degradation episode this long (consecutive `belowClaim`
    /// polls with no recovery) counts as sustained, not transient.
    static let sustainedDegradationPolls = 3
    /// This many separate degradation episodes (each ended by a recovery)
    /// counts as repeating, the classic marginal-cable flap.
    static let repeatedEpisodeCount = 2
    /// Consecutive stable out-of-spec resistance readings before resistance
    /// counts as a real fault rather than one transient under a current spike.
    static let sustainedHighResistancePolls = 2
    /// The in-session hard-reset delta has to reach this before the ratio
    /// rule can fire. One reset is ordinary renegotiation; two or more with
    /// no re-seat to explain them is the shape worth flagging.
    static let minimumHardResetDelta = 2

    // MARK: Accumulated state (reset on a fingerprint change)

    private var fingerprint: String?
    /// Distinct data-degradation episodes seen so far. An episode opens on
    /// the first `belowClaim` and closes only on a `confirmed` recovery, so a
    /// gap of `notApplicable` polls does not split one episode in two.
    private var dataEpisodeCount = 0
    private var inDataEpisode = false
    private var currentEpisodePolls = 0
    private var longestEpisodePolls = 0
    /// Consecutive stable out-of-spec resistance readings.
    private var highResistanceStreak = 0
    private var longestHighResistanceStreak = 0
    /// The overcurrent trip count when this connection's first count was
    /// seen. The delta against the latest count is the events on this cable.
    private var overcurrentBaseline: Int?
    private var overcurrentEvents = 0
    /// Baselines for the lifetime hard-reset and attach counters, taken
    /// together from the first observation that carries both. The rule
    /// compares two deltas, so they only mean something anchored at the same
    /// instant: an observation carrying one counter without the other sets
    /// no baseline at all.
    private var hardResetBaseline: Int?
    private var attachBaseline: Int?
    private var hardResetEvents = 0
    private var attachEvents = 0
    /// Total observations recorded this session (lets the UI show "watched
    /// for N polls" without the engine needing a clock).
    public private(set) var observationCount = 0

    public init() {}

    /// Fold one poll into the session. Returns the resulting verdict for
    /// convenience; it is also available on `verdict`.
    @discardableResult
    public mutating func record(_ observation: Observation) -> Verdict {
        // A different cable on the line is a different session. Reset before
        // recording so the new cable starts from a clean slate.
        if observation.fingerprint != fingerprint {
            reset(to: observation.fingerprint)
        }

        observationCount += 1
        recordDataDelivery(observation.dataDelivery)
        recordResistance(observation.resistanceTier)
        recordOvercurrent(observation.overcurrentCount)
        recordHardResets(count: observation.hardResetCount, attaches: observation.attachCount)
        return verdict
    }

    private mutating func reset(to fingerprint: String) {
        self.fingerprint = fingerprint
        dataEpisodeCount = 0
        inDataEpisode = false
        currentEpisodePolls = 0
        longestEpisodePolls = 0
        highResistanceStreak = 0
        longestHighResistanceStreak = 0
        overcurrentBaseline = nil
        overcurrentEvents = 0
        hardResetBaseline = nil
        attachBaseline = nil
        hardResetEvents = 0
        attachEvents = 0
        observationCount = 0
    }

    private mutating func recordDataDelivery(_ delivery: DataDelivery) {
        switch delivery {
        case .belowClaim:
            if !inDataEpisode {
                inDataEpisode = true
                dataEpisodeCount += 1
                currentEpisodePolls = 0
            }
            currentEpisodePolls += 1
            longestEpisodePolls = max(longestEpisodePolls, currentEpisodePolls)
        case .confirmed:
            // A clean recovery ends the current episode. The next degradation
            // will count as a separate
```

### Core Architecture Module: `Sources/WhatCableCore/Database/CableDB.swift`
```
import Foundation
import SQLite3

/// Read-only SQLite-backed lookup for vendors and known cables.
///
/// Loaded lazily on first use from the bundled `whatcable.db`. All rows
/// are read into in-memory dictionaries on init, then the database handle
/// is closed. For ~14k vendors and a handful of cables this is a few
/// hundred KB of resident memory, same as the old TSV loader.
///
/// Uses the system SQLite3 C API (a macOS system framework), so there's
/// no SPM dependency to add.
public enum CableDB {
    /// Vendor entry with provenance tracking.
    struct VendorEntry {
        let name: String
        /// "usbif", "usbids", or "manual".
        let source: String
    }

    private static let store: Store = Store.load()

    /// Look up a vendor name by VID. Returns names from any source
    /// (USB-IF, usb.ids, manual). Returns nil for unknown VIDs and
    /// for VID 0 (which is filtered at the presentation layer by
    /// `VendorDB`, not here).
    public static func vendorName(vid: Int) -> String? {
        store.vendors[vid]?.name
    }

    /// True only if the VID is in USB-IF's official published list.
    /// Used by `CableTrustReport` to decide whether to fire the
    /// `vidNotInUSBIFList` flag. A VID present via usb.ids or manual
    /// override returns false here, preserving the trust signal
    /// semantics.
    public static func isUSBIFRegistered(_ vid: Int) -> Bool {
        store.vendors[vid]?.source == "usbif"
    }

    /// Look up known cables by identity: the (VID, PID) pair, discriminated
    /// by Cable VDO when more than one row shares that pair.
    ///
    /// Identity is still the VID + PID (see #161): a zero VID or zero PID
    /// cannot be pinned to a brand, so both return an empty array. (A
    /// non-zero VID with a zero PID still resolves the silicon vendor via
    /// VendorDB, but never a curated retail brand.)
    ///
    /// One (VID, PID) pair can now curate more than one row, for two
    /// distinct reasons:
    /// - **Capability variants** (#239): one PID identifies the e-marker
    ///   chip rather than the cable model, so cables of different capability
    ///   (e.g. a 3 A and a 5 A tier) ship under the same VID + PID and are
    ///   told apart only by Cable VDO.
    /// - **Same OEM cable, different retail brands** (#505): the identical
    ///   fingerprint, VID + PID + Cable VDO all matching, sold under more
    ///   than one sleeve brand.
    ///
    /// `cableVDO` resolves the first case: pass the cable's actual Cable VDO
    /// raw value (0 if the cable has none). If any curated row's Cable VDO
    /// matches exactly, only those rows are returned (a variant match, which
    /// may still be more than one row for the #505 case). Otherwise, if any
    /// curated row was entered with no Cable VDO recorded (0), those rows are
    /// returned as an unversioned fallback. Otherwise the cable's VDO doesn't
    /// match any curated variant, and this returns nothing rather than
    /// guessing: an unknown variant must not inherit another variant's brand.
    ///
    /// This does NOT reopen #239: the Cable VDO is only ever used to
    /// discriminate between variants that already matched on VID + PID. It
    /// is still never an identity key on its own, and it never widens a
    /// match to a different VID or PID.
    public static func curatedCables(
        vid: Int,
        pid: Int,
        cableVDO: UInt32
    ) -> [CuratedCable] {
        guard vid != 0, pid != 0 else { return [] }
        let rows = store.cables[CableKey(vid: vid, pid: pid)] ?? []
        let exactMatch = rows.filter { $0.cableVDO == cableVDO }
        if !exactMatch.isEmpty { return exactMatch }
        return rows.filter { $0.cableVDO == 0 }
    }

    /// USB-IF certification listings for a cable's Cert Stat XID.
    ///
    /// The XID is the 32-bit certification ID the e-marker reports (VDO[1],
    /// `PDVDO.CertStat.xid`). A single XID can return several listings:
    /// rebrands and related models share one certificate.
    ///
    /// This is neutral provenance ("who certified it, is it listed"), never
    /// a fraud verdict. An XID of 0 (or simply absent from the registry) is
    /// normal and returns an empty array. See research/usb-if-registry.md.
    public static func certifications(forXID xid: UInt32) -> [CableCert] {
        guard xid != 0 else { return [] }
        return displayable(store.certs[Int(xid)] ?? [])
    }

    /// Single choke point that drops unusable listings before any surface
    /// (PortSummary text, JSON) sees them. A listing with an empty company is
    /// a build-data defect (a malformed / schema-changed registry row) that
    /// would otherwise render as a bogus "USB-IF certified. Manufacturer:"
    /// line with nothing after it. The build script already refuses to store
    /// such rows; this is the runtime backstop. Exposed for tests.
    static func displayable(_ certs: [CableCert]) -> [CableCert] {
        certs.filter { !$0.company.isEmpty }
    }

    /// Number of vendor entries loaded. Exposed for tests.
    public static var vendorCount: Int { store.vendors.count }

    /// Total number of cable entries loaded (counts every row, not
    /// unique fingerprints). Exposed for tests.
    public static var cableCount: Int {
        store.cables.values.reduce(0) { $0 + $1.count }
    }

    /// Number of distinct (VID, PID, Cable VDO) fingerprints.
    ///
    /// `store.cables` groups by (VID, PID) only (see `CableKey`), so its
    /// `.count` is the number of distinct VID+PID pairs, not fingerprints:
    /// a pair curating two capability variants (different Cable VDO, e.g.
    /// Chant Sincere's 3A/5A rows) is one VID+PID group but two
    /// fingerprints, while a pair curating two brands on the identical
    /// fingerprint (#505: Anker Prime + UGREEN, same Cable VDO) is one
    /// VID+PID group and one fingerprint despite having two rows. Summing
    /// the distinct Cable VDO values within each group counts fingerprints
    /// correctly in both cases.
    public static var fingerprintCount: Int {
        store.cables.values.reduce(0) { $0 + Set($1.map(\.cableVDO)).count }
    }

    /// Number of distinct (VID, PID) pairs with at least one curated row.
    /// This is what `fingerprintCount` used to (incorrectly) return before
    /// it was fixed to count Cable VDO variants separately. Exposed
    /// (non-public) only so a test can show `fingerprintCount > pairCount`
    /// on real data where a VID+PID pair curates more than one capability
    /// variant. See #239, #505.
    static var pairCount: Int { store.cables.count }

    /// Number of distinct XIDs with at least one certification listing.
    /// Exposed for tests.
    public static var certXIDCount: Int { store.certs.count }
}

/// A cable identified by user reports and curated into the database.
public struct CuratedCable {
    public let brand: String
    /// The raw Cable VDO this row was curated against (0 when the row was
    /// entered without one). Used by `CableDB.curatedCables` to discriminate
    /// between capability variants sharing one (VID, PID). See #239.
    public let cableVDO: UInt32
    public let speed: String
    public let power: String
    public let type: String
    public let issueURL: String
}

/// One USB-IF certification listing for a cable, compiled offline from the
/// public certified-products registry. Neutral provenance only.
public struct CableCert {
    /// The certifying company. Usually the ODM / silicon maker (e.g.
    /// "Lintes Technology", "ACON"), NOT the retail brand on the box.
    public let company: String
    /// The certified model / part number.
    public let model: String
    /// "Pass" or "Obsolete".
    public let status: String
    /// Certification date as an ISO string. May be empty when unknown.
    public let certDate: String
    /// USB-IF vendor ID for this listing, when known (nil for listings the
    /// per-XID endpoint didn't cover). A match against the cable's own
    /// e-marker VID is a mild CONFIRMING signal; a mismatch is NOT a fraud
    /// signal (ODM rebrands legitimately differ). Never present the inverse.
    public let vendorID: Int?

    public init(company: String, model: String, status: String, certDate: String, vendorID: Int?) {
        self.company = company
        self.model = model
        self.status = status
        self.certDate = certDate
        self.vendorID = vendorID
    }
}

// MARK: - Internal types

private struct CableKey: Hashable {
    let vid: Int
    let pid: Int
}

private struct Store {
    let vendors: [Int: CableDB.VendorEntry]
    let cables: [CableKey: [CuratedCable]]
    let certs: [Int: [CableCert]]

    static func load() -> Store {
        guard let url = Bundle.module.url(forResource: "whatcable", withExtension: "db")
                ?? findResourceURL(name: "whatcable", ext: "db") else {
            return Store(vendors: [:], cables: [:], certs: [:])
        }

        var db: OpaquePointer?
        defer { sqlite3_close(db) } // sqlite3_close(nil) is a documented no-op
        guard sqlite3_open_v2(
            url.path, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, nil
        ) == SQLITE_OK else {
            return Store(vendors: [:], cables: [:], certs: [:])
        }
        guard let db else {
            return Store(vendors: [:], cables: [:], certs: [:])
        }

        let vendors = loadVendors(db: db)
        let cables = loadCables(db: db)
        let certs = loadCerts(db: db)

        return Store(vendors: vendors, cables: cables, certs: certs)
    }

    private static func loadVendors(db: OpaquePointer) -> [Int: CableDB.VendorEntry] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(
            db, "SELECT vid, name, source FROM vendors", -1, &stmt, nil
        ) == SQLITE_OK else {
            return [:]
        }
        defer { sqlite3_finalize(stmt) }

        var map: [Int: CableDB.Vendo
```

### Core Architecture Module: `Sources/WhatCableCore/Database/EmarkerSilicon.swift`
```
import Foundation

/// Vendor IDs belonging to the companies that make e-marker chips, as opposed
/// to the companies that make cables.
///
/// A cable whose e-marker was never reprogrammed answers Discover Identity
/// with its chip maker's default vendor ID, so the port card ends up naming
/// the silicon supplier as if it were the cable brand. 72 of 764 SOP'
/// readings in the corpus (9.4%, across 65 machines) carry one of these five
/// IDs, and 56 of those 72 also report product ID 0, the factory-default
/// shape.
///
/// All five resolve in the bundled `vendors` table with source `usbif`, so
/// this is a hint about where a name came from, not a fallback for a name
/// that is missing. It is a presentation hint only: it must never become a
/// trust signal or change a verdict, because a factory-default vendor ID is
/// ordinary on genuine hardware.
public enum EmarkerSilicon {
    /// Short vendor name when `vid` is an e-marker silicon maker's own VID,
    /// nil otherwise. The names are short because they read inside a sentence.
    public static func shortName(for vid: Int) -> String? {
        switch vid {
        case 0x315C: return "CPS"       // Chengdu Convenientpower Semiconductor
        case 0x2109: return "VIA"       // VIA Labs
        case 0x2E87: return "Injoinic"
        case 0x2E99: return "Hynetek"
        case 0x04B4: return "Cypress"
        default: return nil
        }
    }
}

```

### Core Architecture Module: `Sources/WhatCableCore/Devices/BuiltInPortGrouping.swift`
```
import Foundation

/// Groups a desktop Mac's built-in plain-USB devices by the physical port
/// they are plugged into, so the "Built-in USB ports" section can say which
/// connector each device is on ("Built-in USB-A port 1") and render one tree
/// per port instead of one big mixed tree (issue #490).
///
/// The port identity comes from `USBDevice.controllerPortName`, the
/// `Port-USB-A@N` / `Port-USB-C@N` board node macOS 26+ publishes on the
/// device's ancestor chain (`UsbIOPort`). Corpus-verified: 21 desktop
/// machines publish distinct `Port-USB-A@N` per physical port, and devices
/// behind a user's external hub still resolve to the right port node (32
/// hub-nested chains, up to two hubs deep). On macOS 15 the node is absent
/// (0/16 machines), so every device lands in the unattributed fallback group
/// and the section renders exactly as before.
///
/// Pure logic, no IOKit. Shared by the menu bar app and the CLI text output
/// so the two group identically.
public enum BuiltInPortGrouping {
    public struct Group: Equatable {
        /// The raw port node name (e.g. "Port-USB-A@1"), or `nil` for the
        /// fallback group of devices with no recognisable port node.
        public let portNodeName: String?
        /// Connector type parsed from the node name ("USB-A", "USB-C").
        /// `nil` for the fallback group.
        public let connector: String?
        /// Port number parsed from the `@N` suffix. `nil` for the fallback.
        public let portNumber: Int?
        /// The devices on this port, in input order. Hubs are kept so the
        /// tree renderer can nest their children (same rule as
        /// `TunnelledDeviceGrouping`).
        public let devices: [USBDevice]

        public init(portNodeName: String?, connector: String?, portNumber: Int?, devices: [USBDevice]) {
            self.portNodeName = portNodeName
            self.connector = connector
            self.portNumber = portNumber
            self.devices = devices
        }
    }

    /// Parses "Port-USB-A@1" into ("USB-A", 1). `nil` when the name doesn't
    /// have the `Port-<connector>@<number>` shape.
    static func parse(portNodeName: String) -> (connector: String, portNumber: Int)? {
        guard portNodeName.hasPrefix("Port-") else { return nil }
        let trimmed = portNodeName.dropFirst("Port-".count)
        let parts = trimmed.split(separator: "@", maxSplits: 1)
        guard parts.count == 2, let number = Int(parts[1]), !parts[0].isEmpty else { return nil }
        return (String(parts[0]), number)
    }

    /// Splits the built-in section's devices into one group per physical
    /// port, sorted by connector then port number, with an unattributed
    /// fallback group last for devices whose port node is missing (macOS 15)
    /// or unparsable. Returns a single fallback group when nothing is
    /// attributable, so callers can render the pre-#490 combined list
    /// unchanged in that case.
    public static func groups(from devices: [USBDevice]) -> [Group] {
        // Parse each name once, keyed by node name, so the group build below
        // needs no second parse and no force-unwraps (review findings on the
        // first cut of this function: the `!`s were correct only by
        // call-order, and parse ran twice per group).
        var parsedByName: [String: (connector: String, portNumber: Int)] = [:]
        var devicesByName: [String: [USBDevice]] = [:]
        var namedOrder: [String] = []
        var unattributed: [USBDevice] = []
        for device in devices {
            if let name = device.controllerPortName, let parsed = parse(portNodeName: name) {
                if devicesByName[name] == nil {
                    namedOrder.append(name)
                    parsedByName[name] = parsed
                }
                devicesByName[name, default: []].append(device)
            } else {
                unattributed.append(device)
            }
        }
        var result: [Group] = namedOrder.compactMap { name in
            guard let parsed = parsedByName[name], let devices = devicesByName[name] else { return nil }
            return Group(
                portNodeName: name,
                connector: parsed.connector,
                portNumber: parsed.portNumber,
                devices: devices
            )
        }
        // Named groups only at this point; the nil-coalescing keeps the sort
        // total even if a nil-field group ever ends up here.
        result.sort {
            ($0.connector ?? "", $0.portNumber ?? 0) < ($1.connector ?? "", $1.portNumber ?? 0)
        }
        if !unattributed.isEmpty || result.isEmpty {
            result.append(Group(portNodeName: nil, connector: nil, portNumber: nil, devices: unattributed))
        }
        return result
    }

    /// True when every device in the section sits on a named USB-A port, in
    /// which case the section title itself can say "Built-in USB-A ports"
    /// (issue #490's headline ask). False as soon as any device is on a
    /// USB-C node or unattributed, where the generic title stays.
    public static func allOnUSBA(_ groups: [Group]) -> Bool {
        !groups.isEmpty && groups.allSatisfy { $0.connector == "USB-A" }
    }
}

```

### Core Architecture Module: `Sources/WhatCableCore/Devices/ChainDeviceAttribution.swift`
```
import Foundation

/// Works out which Thunderbolt chain device each USB device sits inside.
///
/// The problem it solves: on a daisy chain (Mac -> display -> dock) macOS
/// publishes the USB devices as one flat forest per host controller with no
/// record of which downstream Thunderbolt device each one is physically plugged
/// into. The Thunderbolt fabric knows the chain exactly, and the USB tree knows
/// the hub cascade exactly, but nothing joins the two. Without a join, a dock's
/// Ethernet adapter renders five hub levels deep under the display the dock is
/// chained behind, which is where "12 rows, and you cannot tell what is plugged
/// into what" comes from.
///
/// No published technique exists for this on macOS, and `system_profiler
/// SPUSBDataType` returns nothing at all on the reference machine, so there is
/// no ground truth to copy. What follows is inference, and every step of it is
/// built to fail closed: **when the evidence does not single out one chain
/// device, the device stays unattributed and renders exactly where it does
/// today.** A wrong parent is worse than a flat list.
///
/// Three signals, in order of strength:
///
/// 1. **The name match.** A Thunderbolt device usually exposes its own USB
///    identity endpoint, and its `USB Product Name` is the same string the
///    fabric reports as `Device Model Name`. `TBT5 Docking Station 10-in-1`
///    appears in both. Two strengths of match, and the difference matters:
///    - **exact** (normalised equality): this device IS the chain device, so it
///      is absorbed into the chain row rather than rendered twice.
///    - **affiliate** (one name's words are a contiguous run inside the
///      other's): this device is PART OF the chain device. `TS5 USB 3 Hub` and
///      `CalDigit TS5 Audio - Rear` against a chain device modelled `TS5`;
///      `Apple Thunderbolt Display` against `Thunderbolt Display`. It marks its
///      hub but is never absorbed, because deleting a dock's audio endpoint
///      from the tree would be a bug, not a de-duplication.
///    Either way, the hub the device hangs off is that chain device's own
///    upstream hub, so everything under that hub is inside it.
/// 2. **Inheritance (structural).** Walking down the USB forest, a device takes
///    its nearest marked ancestor's owner. This is what separates a chained
///    dock's subtree from the display's while it sits nested inside it.
/// 3. **Vendor continuity (weakest, and heavily gated).** A device whose vendor
///    appears in exactly one chain device's marked region probably belongs to
///    that chain device. Applied top-down as a region mark, not per device, for
///    two reasons: it keeps a hub and its children together, and it makes the
///    collapsed and expanded views agree about where a device sits. An earlier
///    draft resolved it per endpoint in the collapsed view only, which put the
///    reference machine's Ethernet adapter under the dock by default and
///    somewhere else entirely once the user clicked "Show hubs".
///
/// Pure logic, no IOKit. `ConnectedDeviceTree` is the only caller.
public struct ChainDeviceAttribution: Equatable {
    /// USB device id -> chain switch id: every device the three signals could
    /// place, hubs included. Both view modes read this, so they cannot disagree
    /// about which chain device something is inside.
    public let regionOwner: [UInt64: Int64]

    /// The marked nodes: USB device id -> the chain switch id whose region
    /// starts there. The expanded view renders one nested subtree per entry.
    public let regionRoots: [UInt64: Int64]

    /// Devices that ARE a chain device (their own USB identity endpoint).
    /// Rendering both them and the chain row would duplicate the device, which
    /// is a good part of why the tree reads as a tangle today.
    public let absorbed: Set<UInt64>

    /// True when every chain device was anchored. Gates vendor continuity: see
    /// the `resolve` implementation for why a partial anchor set makes vendor
    /// evidence meaningless rather than merely weak.
    public let allAnchored: Bool

    /// Stage B v2 (PCI Path prefix join): USB device ids the join resolved to
    /// `forcedPortLevel` (valid-but-no-match, a tie between switches, a stale
    /// `pciEntryID`, or a contradiction with exact-name/numeric evidence). A
    /// TERMINAL, explicit port-level boundary root (plan step 8/9): excluded
    /// from every chain-attribution mechanism (never a `regionOwner`, never a
    /// `regionRoots` target, never `absorbed`), and it blocks every kind of
    /// evidence from crossing it, in both directions: inheritance stops here,
    /// vendor continuity cannot traverse it or create marks below it,
    /// redundant-root removal cannot let a mark above it cover a root below
    /// it, and nobody else's claim may redirect onto it as a hub. Only a
    /// self-anchoring claim (exact/affiliate on its own subtree, or an
    /// independent structural match) can restart ownership below one.
    /// `ConnectedDeviceTree` reads this to render the boundary explicitly in
    /// both view modes, rather than relying on the unowned-forest-root pass
    /// (which only looks at forest roots and would silently drop a
    /// mid-tree boundary).
    public let portLevelBoundaries: Set<UInt64>

    public static let none = ChainDeviceAttribution(
        regionOwner: [:], regionRoots: [:], absorbed: [], allAnchored: false, portLevelBoundaries: []
    )

    /// Nothing was attributed and nothing absorbed, so the caller can render
    /// its existing layout unchanged.
    public var isEmpty: Bool { regionOwner.isEmpty && absorbed.isEmpty }

    // MARK: - Stage B v2: PCI Path prefix join

    /// Per-device outcome of the PCI-Path-prefix join for one PCIe-carried
    /// (`carrier == .pcieTunnel`) device against one port's downstream chain.
    /// Plan: `planning/pcie-tunnelled-usb-attribution.md`, "Stage B v2:
    /// PCI Path prefix join", resolution steps 1-7.
    enum PCIeStageBOutcome: Equatable {
        /// Some input needed for the join was missing or unusable (a
        /// downstream switch with no usable up-adapter candidate, the
        /// controller's own path/entry-ID list missing): the join does not
        /// run at all for this device, and the caller falls back to the
        /// Stage A single-switch shortcut. NOT the same as "ran and found
        /// nothing" (`.portLevel`): a missing input must never let a
        /// shallower switch win by default (completeness gate, step 2).
        case fallbackToStageA
        /// Exactly one switch's PCIe up-adapter is both entry-ID-verified
        /// (the switch's `pciEntryID` is a member of the controller's
        /// ancestor entry IDs) and the deepest matching path prefix.
        case matched(Int64)
        /// The join ran with complete, usable inputs but found no valid
        /// match (contradictory evidence: a path/entry-ID pair that once
        /// matched a switch since replaced, a tie between two DIFFERENT
        /// switches at the same depth), or found nothing at all. This is a
        /// STRUCTURAL finding, not an absence of evidence, so the caller
        /// must NOT fall back to the shortcut (step 4/12): it is stronger,
        /// terminal evidence that the device is not inside any switch on
        /// this port's chain.
        case portLevel
    }

    /// Resolves one PCIe-carried device against one port's downstream chain,
    /// implementing resolution steps 1-7 of the Stage B v2 plan. Pure: no
    /// IOKit, callable from unit tests and the corpus-replay sweep alike.
    ///
    /// - Parameters:
    ///   - device: the PCIe-carried USB device (`tunnelCarrier == .pcieTunnel`).
    ///     Callers are expected to have already checked this; the function
    ///     itself does not branch on `tunnelCarrier`.
    ///   - chainNodes: the port's downstream Thunderbolt switches, flattened
    ///     (`ThunderboltTopology.flatten(chain)`). The host root is never a
    ///     member of this list by construction (`ThunderboltTopology.tree`
    ///     returns the root's CHILDREN), so step 1's "host-root adapters are
    ///     never candidates" rule holds automatically; nothing here needs to
    ///     filter depth 0 explicitly.
    static func resolvePCIeTunnelCandidate(
        device: USBDevice,
        chainNodes: [IOThunderboltSwitchNode]
    ) -> PCIeStageBOutcome {
        // Review fix (HIGH, round 2026-08-13): a device with no `tunnelRootName`
        // at all (the walk never reached an `apciecN` root, the Stage A
        // failure invariant) must never be evaluated by Stage B, matched OR
        // forced to port level. Stage B's own port-scope gate (step 7,
        // `rootIsTrusted` in `resolve()`) only refuses a WRONG root; a nil
        // root skips that check entirely (nothing to compare) and would
        // otherwise reach the completeness/path/entry-ID gates below on
        // controller data that has no port to belong to. Checked first, so
        // a no-root device always falls back to the Stage A shortcut path
        // (itself gated on `tunnelRootName != nil` in `resolve()`, so a
        // nil-root device stays fully unattributed there too).
        guard device.tunnelRootName != nil else { return .fallbackToStageA }

        // Path hygiene (step 6): nonempty, starts "IOService:/". Anything
        // else (nil, empty, whitespace, a truncated capture) is "not usable"
        // and trips the completeness gate below, never treated as a ""
        // prefix that would match everything.
        // Review fix (MEDIUM, round 2026-08-13): the old version validated
        // the TRIMMED string but returned the untrimmed `raw` value, so a
        // value carrying leading/trailing whitespace (" IOService:/..." or a
        // trailing newline from a truncated capture) passed hygiene while
        // still comparing UNEQUAL to a
```

### Core Architecture Module: `Sources/WhatCableCore/Devices/ConnectedDeviceTree.swift`
```
import Foundation

/// Builds the "Connected devices" rows for one port.
///
/// When the port has a Thunderbolt device downstream (a dock or display),
/// every USB device on the port is physically behind it: the port's one
/// connector is occupied by that device's cable. The tree therefore roots
/// at the Thunderbolt device, labelled with the live link speed, so the
/// section reads as the physical story (one 40 Gbps pipe with the USB hubs
/// inside it) instead of two bare USB hub roots that make a TB5 dock look
/// like a 480 Mbps + 10 Gbps device.
///
/// Monitors reach the Mac through the same Thunderbolt link (a DisplayPort
/// tunnel), so each connected monitor gets a row directly under the root,
/// before the USB branch.
///
/// Pure logic, no IOKit. Shared by the menu bar app and the CLI text output
/// so both render identical rows. JSON output is deliberately unchanged: it
/// already carries the Thunderbolt fabric and the USB device tree as
/// separate structured sections, and reshaping it would break consumers for
/// no information gain.
public enum ConnectedDeviceTree {
    /// One rendered row: a complete display label plus its indent depth.
    /// The renderers add only their own bullet/arrow prefix and indentation.
    ///
    /// `device` carries the node a device row was built from, so a renderer
    /// that can show more than a label (the app's expandable row) has the
    /// model to hand. It is `nil` on rows that describe something other than a
    /// USB device: the Thunderbolt root, a display, a bus header. Text
    /// renderers ignore it and draw `label` exactly as before.
    public struct Row: Equatable {
        public let label: String
        public let depth: Int
        public let device: USBDeviceNode?

        public init(label: String, depth: Int, device: USBDeviceNode? = nil) {
            self.label = label
            self.depth = depth
            self.device = device
        }

        /// Equality covers everything the row carries, `device` included, as a
        /// full value comparison.
        ///
        /// It deliberately used to compare label and depth only, on the
        /// reasoning that those are what a row draws. That was a trap: a row
        /// with the wrong device attached, or none at all, compared equal to a
        /// correct one, so an assertion of the form
        /// `#expect(rows == [Row(label:depth:device:)])` silently passed on
        /// broken device routing. Nothing in the app compares rows, so this
        /// only ever cost test strength, but that is the whole point of the
        /// type.
        ///
        /// Comparing the node by value rather than by its IOKit entry ID
        /// matters because the expandable row renders fields the ID does not
        /// pin down: two snapshots sharing an entry ID can still differ in
        /// vendor, serial, USB version or hub depth, and those are exactly
        /// what the detail panel shows.
        public static func == (lhs: Row, rhs: Row) -> Bool {
            lhs.label == rhs.label
                && lhs.depth == rhs.depth
                && lhs.device == rhs.device
        }
    }

    /// Build the rows for one port's "Connected devices" section.
    ///
    /// - Parameters:
    ///   - devices: USB devices attributed to this port.
    ///   - port: the port, used to resolve its Thunderbolt host root. The
    ///     `ThunderboltTopology.socketID(for:)` gate keeps power-only ports
    ///     (MagSafe) from borrowing a neighbouring port's fabric.
    ///   - thunderboltSwitches: the live switch list from the TB watcher.
    ///   - displayPorts: connected monitors on this port, one entry each.
    /// - Returns: rows ready to render, or an empty array when there is
    ///   nothing to show (no devices and no Thunderbolt device downstream).
    /// Whether to render every device or only the ones a user has a decision
    /// to make about.
    public enum HubDisplay: Sendable {
        /// Every device, hubs included. The CLI's shape, and what the app shows
        /// once the user asks to see everything.
        case all
        /// Hubs collapsed. Only non-hub devices are listed, each annotated with
        /// how many hubs sit between it and the port. A hub with no non-hub
        /// descendants is still shown, because dropping it would make a device
        /// disappear with nothing to explain the gap.
        case endpointsOnly
    }

    /// - Parameters:
    ///   - devices: USB devices already attributed to this port by the
    ///     ordinary (non-tunnel) join, as before.
    ///   - tunnelledDevices: tunnelled USB devices STRUCTURALLY scoped to
    ///     this specific port (`TunnelledDeviceGrouping
    ///     .structurallyScopedTunnelledDevices(for:in:thunderboltSwitches:)`),
    ///     merged into the SAME forest as `devices` so a tunnelled device
    ///     nests under its chain device in this port's tree instead of
    ///     rendering in a separate flat section. Empty by default so every
    ///     existing caller is unaffected until it opts in. A device with no
    ///     structural root data at all never appears here (the scoping
    ///     helper can't place it); it keeps flowing through
    ///     `TunnelledDeviceGrouping.group`'s single-active-port fallback,
    ///     unchanged.
    ///   - cioCapability: this port's CIO row, so a Mac on the far end can be
    ///     told from a USB peripheral. Nil means no host-to-host check.
    public static func rows(
        devices: [USBDevice],
        tunnelledDevices: [USBDevice] = [],
        port: AppleHPMInterface,
        thunderboltSwitches: [IOThunderboltSwitch],
        displayPorts: [IOPortTransportStateDisplayPort],
        cioCapability: CIOCableCapability? = nil,
        hubs: HubDisplay = .all
    ) -> [Row] {
        let allDevices = mergeDevices(devices, tunnelledDevices)
        let rows = layoutRows(
            allDevices: allDevices,
            port: port,
            thunderboltSwitches: thunderboltSwitches,
            displayPorts: displayPorts,
            hubs: hubs
        )
        // A peer Mac enumerates as a USB 2.0 device, so its row would read as
        // a 480 Mbps peripheral. The suffix says why: the Thunderbolt link is
        // up but only USB crosses it. A post-pass keyed on the device id
        // covers every layout path without each one knowing about it.
        guard HostToHostLink.isHostToHost(
            port: port, devices: allDevices, cio: cioCapability, thunderboltSwitches: thunderboltSwitches),
            let peerID = HostToHostLink.peerMac(in: allDevices)?.id
        else { return rows }
        let suffix = String(localized: "USB link only", bundle: _coreLocalizedBundle)
        return rows.map { row in
            guard row.device?.device.id == peerID else { return row }
            return Row(label: "\(row.label) \u{00B7} \(suffix)", depth: row.depth, device: row.device)
        }
    }

    /// `devices` plus `tunnelledDevices`, deduplicated by id.
    ///
    /// Merged once, at the top: every layout path (the no-Thunderbolt
    /// fallback included, though `tunnelledDevices` should be empty there by
    /// construction) reads the merged list, never the bare `devices`
    /// parameter, so a tunnelled device can never be silently dropped by a
    /// path that forgot about it.
    /// Defence in depth (plan pcie-tunnelled-usb-attribution): the wiring
    /// rule is that callers pass native matches in `devices` and
    /// structurally scoped devices in `tunnelledDevices`, never the union
    /// in both; dedup by id here so a miswired caller renders a device
    /// once instead of twice.
    private static func mergeDevices(_ devices: [USBDevice], _ tunnelledDevices: [USBDevice]) -> [USBDevice] {
        guard !tunnelledDevices.isEmpty else { return devices }
        var seen = Set<UInt64>()
        return (devices + tunnelledDevices).filter { seen.insert($0.id).inserted }
    }

    private static func layoutRows(
        allDevices: [USBDevice],
        port: AppleHPMInterface,
        thunderboltSwitches: [IOThunderboltSwitch],
        displayPorts: [IOPortTransportStateDisplayPort],
        hubs: HubDisplay
    ) -> [Row] {
        guard let hostRoot = thunderboltHostRoot(port: port, switches: thunderboltSwitches)
        else {
            // No Thunderbolt device downstream: the plain USB tree, unchanged.
            // Directly-attached monitors (USB-C DisplayPort Alt Mode, no TB
            // tunnel) keep their existing display banner; without a root to
            // hang them under, a bare display row here would just repeat it.
            return deviceRowsGroupedByBus(allDevices, hubs: hubs)
        }

        let chain = ThunderboltTopology.tree(from: hostRoot, in: thunderboltSwitches)
        let chainNodes = ThunderboltTopology.flatten(chain)
        guard !chainNodes.isEmpty else { return deviceRowsGroupedByBus(allDevices, hubs: hubs) }

        let displays = displayRows(
            displayPorts: displayPorts,
            hostRoot: hostRoot,
            switches: thunderboltSwitches
        )
        let forest = USBDeviceNode.buildTree(from: allDevices)
        // The structural tunnel join's two safety inputs:
        // which switches this port's OWN fabric confirms carry a USB tunnel
        // (the shared, strict derivation: cross-cable, downstream terminal,
        // and the terminal's OWN adapter is a USB type, not just `kind`), and
        // this port's own apciecN root name, so a device whose tunnelRootName
        // names a different port fails closed rather than being trusted just
        // because it ended up in this call's `devices`.
        let usbTunnelSwitchUIDs = ThunderboltTopology.usbTunnelTerminalSwitchUIDs(from: hostRoot, in: thunderboltSwitches)
        let expectedTunnelRootName = hostRoot.acioRootName.flatMap(ThunderboltTopology.apciecRootName(fromAcioRootName:))
        let attributi
```

### Core Architecture Module: `Sources/WhatCableCore/Devices/TunnelledDeviceGrouping.swift`
```
import Foundation

/// Decides how to present USB devices that match no physical USB-C port and
/// would otherwise be silently dropped. Two cases:
///
/// 1. Devices reached over a Thunderbolt tunnel (issue #274), behind a TB dock
///    or display. The helper nests them under the host port when exactly one
///    Thunderbolt device is connected, else renders flat.
/// 2. Devices behind an internal Apple USB hub (issue #348), the front USB-C
///    and USB-A ports on Mac mini / Studio / Pro. These never nest under a
///    port: front ports have no port-controller silicon to attribute to.
///
/// Safety rule for the TB-tunnelled nesting: only attribute to a port when
/// **exactly one** Thunderbolt device is connected. With one connection there
/// is no ambiguity about what the tunnelled devices are behind, so the
/// attribution is certain without the per-port tunnel join (the
/// `apciec`/`acio` correlation that is not yet confirmed on multi-port
/// hardware). With two or more Thunderbolt devices the helper returns no
/// host port and the caller renders a flat "Other USB devices" section
/// instead of guessing.
///
/// Pure logic, no IOKit. Shared by the menu bar app, the CLI text output, and
/// the JSON output so all three group identically.
public enum TunnelledDeviceGrouping {
    public struct Result: Equatable {
        /// The Thunderbolt-tunnelled devices, in input order. Empty when there
        /// are none, in which case the caller shows no extra section.
        public let devices: [USBDevice]
        /// The `serviceName` of the one connected Thunderbolt port these devices
        /// nest under (e.g. "Port-USB-C@2"), or `nil` to render them flat. Only
        /// set when exactly one Thunderbolt device is connected.
        public let hostPortServiceName: String?
        /// Devices on a desktop Mac's plain-USB front ports (issue #348).
        /// Not attributed to a port (front ports have no port-controller silicon
        /// to attribute to), but may include a hub the user plugged into a front
        /// port, kept so its children nest under it in the rendered tree. This is
        /// the single place the desktop-only policy is applied: it is empty unless
        /// `group` was called
        /// with `isDesktopMac: true`, so every consumer of this array is
        /// laptop-safe without its own check. Also empty when there is no
        /// front-port activity.
        public let internalHubDevices: [USBDevice]

        public init(
            devices: [USBDevice],
            hostPortServiceName: String?,
            internalHubDevices: [USBDevice] = []
        ) {
            self.devices = devices
            self.hostPortServiceName = hostPortServiceName
            self.internalHubDevices = internalHubDevices
        }
    }

    /// Hubs are deliberately kept in both result sets, not filtered out. A hub is
    /// a branch point of the device tree, so dropping it collapses everything
    /// behind it to a flat list and hides which device hangs off which hub. That
    /// flat list is exactly what users kept reporting (issues #106, #280, #375:
    /// "USB2.1 Hub -> Magic Trackpad" should read as the hub with the trackpad
    /// nested under it). `USBDeviceNode.buildTree` needs the hub present to nest
    /// its children, so keeping hubs is what lets the renderers (app, CLI, JSON)
    /// show the real hierarchy. The Mac's own internal front-panel hub is never a
    /// member of either set (it is the boundary the walk stops at, never itself
    /// flagged `isThunderboltTunnelled` or `isBehindInternalHub`), so showing hubs
    /// surfaces the hubs the user attached, never the Mac's internal plumbing.
    ///
    /// - Parameter isDesktopMac: gates the `internalHubDevices` result. The
    ///   front-panel hub ports only exist on Mac mini / Studio / Pro, so on a
    ///   laptop the internal-hub set is forced empty here regardless of the
    ///   per-device structural flag. Defaults to `false` (fail closed): a caller
    ///   that does not opt in gets no front-port devices, never a laptop false
    ///   positive. The `isBehindInternalHub` flag itself stays pure structural
    ///   truth; this is the one place the desktop product policy is applied.
    /// The tunnelled devices belonging to THIS port by structure, not by the
    /// single-active-port heuristic `group(...)` below falls back to: those
    /// whose `tunnelRootName` matches the port's own `apciecN` root, derived
    /// from its Thunderbolt host root switch's `acioRootName` (the
    /// corpus-verified apciec<->acio index pairing,
    /// `research/usb-chain-attribution-identifiers.md`). This is the
    /// port-scoping join `ChainDeviceAttribution`'s structural tunnel pass
    /// needs as its `expectedTunnelRootName`, and it is also how a device
    /// with a valid `tunnelRootName` is fed into `ConnectedDeviceTree.rows`'s
    /// `tunnelledDevices` parameter so it nests in the SAME tree as the
    /// port's other devices, instead of the flat/single-port fallback below.
    ///
    /// Returns `[]` when the port has no Thunderbolt host root, the host
    /// root's `acioRootName` was never captured (older macOS, or the acio
    /// ancestor walk's bound was exceeded), or no device's `tunnelRootName`
    /// matches it. All three fail closed to "claims nothing", leaving the
    /// device to the single-active-port fallback in `group(...)`, which is
    /// the ONLY path for a device with no structural root data at all
    /// (`tunnelRootName == nil`): this function can never structurally claim
    /// such a device, by construction (`$0.tunnelRootName == apciecName`
    /// requires a non-nil match).
    public static func structurallyScopedTunnelledDevices(
        for port: AppleHPMInterface,
        in devices: [USBDevice],
        thunderboltSwitches: [IOThunderboltSwitch]
    ) -> [USBDevice] {
        guard let socketID = ThunderboltTopology.socketID(for: port),
              let hostRoot = ThunderboltTopology.hostRoot(forSocketID: socketID, in: thunderboltSwitches),
              let acioName = hostRoot.acioRootName,
              let apciecName = ThunderboltTopology.apciecRootName(fromAcioRootName: acioName)
        else { return [] }
        return devices.filter { $0.isThunderboltTunnelled && $0.tunnelRootName == apciecName }
    }

    /// The `usbTunnelSwitchUIDs` argument `ChainDeviceAttribution.resolve`
    /// wants for this port: the switch UIDs of the USB-carrying tunnels this
    /// port's fabric actually reports. Shared here (rather than duplicated at
    /// each call site) because both the CLI (`TextFormatter`) and the app
    /// (`ContentView`) need to compute the exact same set for the exact same
    /// port.
    public static func usbTunnelSwitchUIDs(
        for port: AppleHPMInterface,
        thunderboltSwitches: [IOThunderboltSwitch]
    ) -> Set<Int64> {
        guard let socketID = ThunderboltTopology.socketID(for: port),
              let hostRoot = ThunderboltTopology.hostRoot(forSocketID: socketID, in: thunderboltSwitches)
        else { return [] }
        return ThunderboltTopology.usbTunnelTerminalSwitchUIDs(from: hostRoot, in: thunderboltSwitches)
    }

    /// This port's own `apciecN` root name, when derivable: the
    /// `expectedTunnelRootName` argument `ChainDeviceAttribution.resolve`
    /// wants. `nil` under the same conditions
    /// `structurallyScopedTunnelledDevices` fails closed on.
    public static func expectedTunnelRootName(
        for port: AppleHPMInterface,
        thunderboltSwitches: [IOThunderboltSwitch]
    ) -> String? {
        guard let socketID = ThunderboltTopology.socketID(for: port),
              let hostRoot = ThunderboltTopology.hostRoot(forSocketID: socketID, in: thunderboltSwitches),
              let acioName = hostRoot.acioRootName
        else { return nil }
        return ThunderboltTopology.apciecRootName(fromAcioRootName: acioName)
    }

    /// Every USB device attributable to `port`: its direct native-bus matches
    /// (`matchingDevices`, the `UsbIOPort`/bus join) UNION the tunnelled
    /// devices structurally scoped to it by `apciecN` root name
    /// (`structurallyScopedTunnelledDevices`), deduplicated by device id with
    /// input order preserved.
    ///
    /// This is the ONE list/count/summary answer to "what devices are on this
    /// port", shared by the widget snapshot (Core), the formatters' per-port
    /// device arrays, and the Pro screens, so they cannot drift (plan
    /// `pcie-tunnelled-usb-attribution`, review round 2/3). It is NOT for
    /// `ConnectedDeviceTree.rows`, which keeps the split matched/scoped
    /// arrays; feeding it the union would render structural devices twice.
    public static func attributedDevices(
        for port: AppleHPMInterface,
        in devices: [USBDevice],
        thunderboltSwitches: [IOThunderboltSwitch]
    ) -> [USBDevice] {
        var seen = Set<UInt64>()
        var result: [USBDevice] = []
        for device in port.matchingDevices(from: devices)
            + structurallyScopedTunnelledDevices(for: port, in: devices, thunderboltSwitches: thunderboltSwitches)
        where seen.insert(device.id).inserted {
            result.append(device)
        }
        return result
    }

    public static func group(
        devices: [USBDevice],
        ports: [AppleHPMInterface],
        thunderboltSwitches: [IOThunderboltSwitch],
        isDesktopMac: Bool = false,
        // Device ids already placed by `structurallyScopedTunnelledDevices`
        // for SOME port (across every port, unioned by the caller). Excluded
        // here so a structurally-scoped device renders exactly once: nested
        // in its port's tree, never ALSO in this flat/single-port fallback.
        structurallyScoped: Set<UInt64> = []
    ) -> Result {
        // Hubs are kept (see the type doc): they are the branch points the tree
        // renderer needs to nest each d
```

### Core Architecture Module: `Sources/WhatCableCore/Diagnostic/DiagnosticContract.swift`
```
import Foundation

#if DEBUG
/// The diagnostic contract: a faithful decode of the JSON that a separate
/// diagnostic engine emits for this app to render.
///
/// WhatCable renders this. It never recomputes confidence, reclassifies a hop, or
/// re-derives provenance. If a view needs meaning that is not present here, the
/// fix is to refine the contract upstream, not to infer it in Swift.
///
/// Decoded with `.convertFromSnakeCase`, so `schema_version` becomes
/// `schemaVersion`, `capability_in` becomes `capabilityIn`, and so on.
public struct DiagnosticContract: Codable, Sendable, Equatable {
    /// The contract shape this app understands. A contract with any other version
    /// is refused, not partially interpreted (see `DiagnosticFixtures`).
    public static let supportedSchemaVersion = 1

    public let schemaVersion: Int
    public let pattern: String
    public let endpoint: String
    public let synthetic: Bool
    public let diagnosis: Diagnosis

    public struct Diagnosis: Codable, Sendable, Equatable {
        public let matched: Bool
        public let conclusion: String?
        public let confidence: Double?
        public let eliminated: [Eliminated]
        public let suspects: [Suspect]
        public let evidence: [Evidence]
        public let provenance: [Provenance]
        public let trace: Trace
        public let rejection: Rejection?
    }

    public struct Eliminated: Codable, Sendable, Equatable {
        public let name: String
        public let reason: String
    }

    /// A path hop the reasoning could not rule out. `status` is authoritative:
    /// `"unknown"` (capability not known) or `"localised_drop"` (a measured drop).
    /// A preserved hop is never here, it appears under `eliminated`.
    public struct Suspect: Codable, Sendable, Equatable {
        public let name: String
        public let visibility: String
        public let capabilityIn: Double?
        public let capabilityOut: Double?
        public let status: String
        public let localisedDrop: Bool
    }

    public struct Evidence: Codable, Sendable, Equatable {
        public let kind: String
        public let detail: String
    }

    public struct Provenance: Codable, Sendable, Equatable {
        public let layer: String        // "measured" | "demonstrated" | "inferred"
        public let detail: String
    }

    public struct Trace: Codable, Sendable, Equatable {
        public let preconditions: [Precondition]
        public let claims: [Claim]
    }

    public struct Precondition: Codable, Sendable, Equatable {
        public let name: String
        public let passed: Bool
        public let evidence: String
    }

    public struct Claim: Codable, Sendable, Equatable {
        public let claim: String
        public let support: [String]
        public let confidence: Double
    }

    public struct Rejection: Codable, Sendable, Equatable {
        public let precondition: String
        public let explanation: String
    }
}
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #611** (2026-09-14): **[Bug] new brew Warnings!**
  *Symptoms*: ### What's wrong  FYI: new brew v7.0 says this warnings:  Warning: Calling the `verified` parameter in the `url` stanza is deprecated! Use the default URL verification behaviour instead. Please report this issue to the darrylmorley/homebrew-whatcable tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/darrylmorley/homebrew-whatcable/Casks/whatcable.rb:5 . . .  ### Mac model  M4 MacBook  ### macOS version  15.7.9  ### WhatCable version  1.4  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell - ```  ### System Information cross-check (optional)  _No response_  ### How often does this happen?  Every time  ### Anything else  _No response_
  **Post-Mortem & Fix Analysis**:
  > I hope this gets fixed soon. Every time I run `brew update && brew upgrade` this error spams the terminal. (the message appears 3 times or so)  Sorry for the confusion; I reported this issue on the wrong repo. But since there are already multiple PRs open for this issue, it would be an easy fix.
  > Thanks for the report. This one lives in the Homebrew tap rather than the app, and it is now fixed there (darrylmorley/homebrew-whatcable#6). Run `brew update` and the warning should be gone. Closing here, and thanks to Zettt for pointing at the open PRs.

- **Issue #602** (2026-09-14): **[Bug] Calling the `verified` parameter in the `url` stanza is deprecated**
  *Symptoms*: ### What's wrong  Just sharing what I see on my Macbook  ``` > brew outdated Warning: Calling the `verified` parameter in the `url` stanza is deprecated! Use the default URL verification behaviour instead. Please report this issue to the darrylmorley/homebrew-whatcable tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/darrylmorley/homebrew-whatcable/Casks/whatcable.rb:5 ```  ### Mac model  MacBook Air M4  ### macOS version  26.6.2  ### WhatCable version  1.4.0  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell whatcable --json --raw {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 100   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "USB 3.2 Gen 1 (5 Gbps)",         "Connected device: USB Peripheral, VIA Labs, Inc. (0x2109) (PD 3.0)",         "No e-marker detected. This cable doesn't advertise its capabilities.",         "Charger advertises up to 100W",         "Currently negotiated: 20V @ 5.00A (100W)"       ],       "charging" : {         "bottleneck" : "fine",         "detail" : "Charger and cable are fine. The Mac will draw up to 100W when it needs to.",         "isWarning" : false,         "summary" : "Battery full, not charging"       },     
  **Post-Mortem & Fix Analysis**:
  > Thanks for the update! `-zsh 8:56 brew update               ==> Updating Homebrew... Updated 1 tap (darrylmorley/whatcable).`
  > Fixed. The `verified:` line is gone from the cask on the tap (darrylmorley/homebrew-whatcable#6), so `brew update` should be quiet again. Thanks for the report, and for the patience while it sat.

- **Issue #551** (2026-08-21): **[Bug] Inconsistency with notifications about connected or disconnected devices**
  *Symptoms*: ### What's wrong  When having the "Notify on cable changes" setting enabled, WhatCable notifies the user about newly connected or disconnected devices. During testing however, I have discovered that what WhatCable notifies the user of, varies with seamingly no reason.  ### Mac model  M1 Pro MacBook Pro 14-inch 2021  ### macOS version  Sequoia 15.7.1 (24G231)  ### WhatCable version  1.5.0-beta.3  ### Cable  OEM cable of the dock below  ### What's plugged into the other end?  DIGITUS USB Type-C™ Multiport Travel Dock, 8-Port DA-70866  ### `whatcable --json --raw` output  ```shell {   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : true,       "bulletGroups" : [         {           "header" : "What the cable's e-marker reports",           "lines" : [             "Cable speed: USB 3.2 Gen 2 (10 Gbps)",             "Cable rated for 5 A at up to 20V (~100W)",             "Passive (no signal-conditioning electronics)"           ],           "source" : "emarker"         },         {           "header" : "What your Mac measured",           "lines" : [             "USB 3.2 Gen 1 (5 Gbps)",             "Connected device: Alternate Mode Adapter, VIA Labs, Inc. (0x2109) (PD 3.0)"           ],           "source" : "measured"         },         {           "header" : "What WhatCable knows",           "lines" : [             "Made by CE LINK LIMITED (0x2095), per our bundled vendor list"           ],           "source" : "database"         }       ],       "bulle
  **Post-Mortem & Fix Analysis**:
  > Thanks for this. Root cause: macOS doesn't report a hub and the devices behind it leaving as one event, it dribbles them out, and WhatCable was notifying on whatever slice happened to arrive together. Which names you saw depended on timing, hence the inconsistency.  Fixed: changes now settle for a moment, then get grouped under the hub they belong to. Unplugging the DIGITUS dock posts one notification titled with the hub and naming what left with it. Same for plugging in, which costs about 1.5 seconds of notification delay, the price of waiting for the full picture.  The test data for this fix is built from your capture. In the next beta. 
  > The grouping fix shipped in v1.5.0-beta.4 and the split-fire inconsistency it targeted is gone. The remaining connect-side gap you found is tracked in #556, so closing this one.

- **Issue #505** (2026-08-05): **[Bug] Incorrect cable identification: Ugreen cable reported as Anker Prime Thunderbolt 5 cable**
  *Symptoms*: ### What's wrong  The vendor and model of my Ugreen Thunderbolt 5 USB-C Cable displayed as Anker Prime Thunderbolt 5 Cable  ### Mac model  MacBook Pro M3 Series (14-inch 2023)  ### macOS version  27.0  ### WhatCable version  1.3.0  ### Cable  UGREEN Thunderbolt 5 USB-C Cable, 80Gbps & 240W  ### What's plugged into the other end?  UGREEN 40Gbps M.2 NVMe SSD Enclosure with Cooling Fan  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 4690,     "description" : "pd charger",     "isWireless" : false,     "manufacturer" : "Apple Inc.",     "model" : "0x7002",     "name" : "96W USB-C Power Adapter",     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 94   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "Charger: Apple Inc. 96W USB-C Power Adapter",         "Charger advertises up to 94W",         "Currently negotiated: 20V @ 4.69A (94W)"       ],       "charging" : {         "bottleneck" : "fine",         "detail" : "Charger and cable are well-matched. The Mac draws what it needs moment to moment, up to this limit.",         "isWarning" : false,         "summary" : "Charging well · up to 94W"       },       "className" : "AppleHPMInterfaceType11",       "connectionActive" : true,       "headline" : "Charging · 94W charger",       "name" : "Port-MagSafe 3@1",       "pdCapable" : false,       "powerSources" : [         {           "maxPowerW" : 94,        
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, and you're right that the label is wrong. What's happening under the hood: your UGREEN cable and Anker's Prime TB5 cable are the same physical cable inside, made by ACON (Advanced-Connectek), who sell it to both brands. The chip in the cable reports ACON's identity, and it's byte-identical in both products, right down to the same USB-IF certificate (that CBAUB-H46-100A model in your output is ACON's own model number). So WhatCable matched it against the first brand we'd seen it in, which happened to be Anker.  There's no way to tell the two apart from the cable data itself, the sleeve brand isn't in there. But the confident "identified as Anker" wording is our bug. The next release will list both: something like "this e-marker is used in: Anker Prime TB5 cable, UGREEN TB5 cable (same maker, ACON)". Your report is what surfaced this, so thanks, I'll add your UGREEN cable to the database alongside the Anker entry. 

- **Issue #503** (2026-08-03): **[Bug] Whatcable is missing from Menu Bar**
  *Symptoms*: ### What's wrong  I ticked the box to have it appear only in the menu bar, and after updating to MacOS 26.6 it disappeared from the menu bar. A restart didn't help. If I run `whatcable --desktop` gets it back in the dock, but when I re-tick "Show in menu bar" it doesn't show in the menu bar. I think have to force quit, and re run `whatcable --desktop` to get the dock icon and window back.  ### Mac model  M4 Max MBP  ### macOS version  26.6  ### WhatCable version  1.3.0  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 28000,     "watts" : 140   },   "isDesktopMac" : false,   "otherUSBDevices" : {     "behindPort" : "Port-USB-C@3",     "devices" : [       {         "locationID" : "0x20100000",         "name" : "TS5 Plus USB 3 Hub - C",         "productID" : 8309,         "serialNumber" : "11112222333320CC",         "speed" : "Super Speed+ (10 Gbps)",         "usbVersion" : "3.2",         "vendorID" : 8584,         "vendorName" : "CalDigit, Inc."       },       {         "locationID" : "0x20200000",         "name" : "TS5 Plus USB 3 Hub - B",         "productID" : 8308,         "serialNumber" : "11112222333320CE",         "speed" : "Super Speed+ (10 Gbps)",         "usbVersion" : "3.2",         "vendorID" : 8584,         "vendorName" : "CalDig
  **Post-Mortem & Fix Analysis**:
  > Hi robotprom,  Two things cause this and they look identical from the outside. One is macOS remembering the icon as hidden: it stores that itself, and WhatCable's own toggle can't override it, which would explain why re-ticking "Show in menu bar" does nothing. The other is the notch: past a certain number of menu bar items macOS silently drops the ones that don't fit, and an OS update is a common trigger for that.  Two commands will tell me which. Switch back to menu bar mode first so there's something to log, then run:  ``` defaults read uk.whatcable.whatcable | grep -i NSStatusItem ```  ``` log show --predicate 'subsystem == "uk.whatcable.whatcable"' --last 1h | grep menuBar ```  If the first prints `NSStatusItem Visible Item-0 = 0`, or the log says `isVisible=false`, it's the remembered-hidden case and I can fix that in the app. If the log says `isVisible=true` and the menu bar still shows nothing, it's space, and removing a few other menu bar items should bring it back. 
  > `defaults read uk.whatcable.whatcable | grep -i NSStatusItem` results in:   `"NSStatusItem Preferred Position Item-0" = 316;`  `log show --predicate 'subsystem == "uk.whatcable.whatcable"' --last 1h | grep menuBar` results in  ``` 2026-08-03 09:02:16.284942-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: popover created 2026-08-03 09:02:16.290408-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: statusItem button configured, hasImage=true, frame=(0.0, 0.0, 30.0, 22.0) 2026-08-03 09:02:16.290409-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: statusItem created, isVisible=true ```  I currently have my MBP connected to an external monitor, so the notch shouldn't be the issue.
  > Hi robotprom,  That rules out both of my guesses. WhatCable creates the item, macOS reports it as visible, and it has a real 30x22 frame with the icon in it. Nothing wrong on the app's side, so something is stopping macOS drawing it.  Tahoe added a per-app switch for exactly this. System Settings > Menu Bar, scroll down to "Allow in the Menu Bar". Apple's own wording for it is "Turning off a menu bar item will prevent it from ever appearing in the menu bar", which matches what you're seeing. Check WhatCable is switched on in that list.  If it's already on, switch it off and back on anyway. That makes macOS re-register the item, which is worth a try on the off chance it's just stuck.  Still nothing after that, send me a screenshot of your full menu bar. 

- **Issue #491** (2026-07-31): **[Bug] Power monitor stuck on "waiting for power telemetry from macOS" on port connected to charger**
  *Symptoms*: ### What's wrong  Expected: WhatCable to either show actual data or an informational banner on why power telemetry is not available  Actual: WhatCable waits infinitely for power telemetry  <img width="732" height="574" alt="Image" src="https://github.com/user-attachments/assets/10c27658-0a55-4122-a0a0-f0a00fe64f24" />  ### Mac model  M1 Pro MacBook Pro 14-inch 2021  ### macOS version  Sequoia 15.7.1 (24G231)  ### WhatCable version  1.2.1  ### Cable  UGREEN branded cable  ### What's plugged into the other end?  UGREEN GaN Fast Charger - Model: CD226  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 100   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "No e-marker detected. The cable may have one, but macOS only reads it above 3A or with Thunderbolt.",         "System reports charger at 100W"       ],       "className" : "AppleTCControllerType10",       "connectionActive" : true,       "device" : {         "pdRevision" : "PD 3.0",         "productID" : 0,         "vendorID" : 0,         "vendorName" : "No vendor reported"       },       "headline" : "Charging · 100W charger",       "name" : "Port-USB-C@2",       "pdCapable" : true,       "powerSources" : [        ],       "rawProperties" : {         "AccessoryMode" : "0",         "ActiveCable" : "0",   
  **Post-Mortem & Fix Analysis**:
  > Hi @official-Cromatin  Confirmed bug, and it is specific to the M1 Pro and M1 Max. On that silicon macOS never reports what the charger and the port agreed, so the card has nothing to show and sits there waiting.  The chart at the bottom is right, by the way. That is your real charger draw.  The numbers do exist, just in the Mac's power controller rather than where the app was looking. So the card can show what your charger and Mac agreed on that port, 100W at 20V and 5A, which is what it already shows on other Macs. The live figure stays in the chart below. Fix in progress.  If you get a chance, run Contribute Diagnostic Data from Settings on the current release. It picks up something 1.2.1 didn't, and it would let me confirm the fix lands on the right port on your hardware. 
  > Hi @official-Cromatin  There is a beta build with a fix for this, if you would like to try it: https://github.com/darrylmorley/whatcable/releases/tag/v1.3.0-beta.4  The contract your charger negotiated was in the SMC all along, so the card now reads it from there when macOS does not publish it. Your 100 W at 20 V / 5 A should appear on the port instead of the spinner.  If it looks right, say so and it goes into the next release. If it looks wrong, that is more useful still. It is the reading I could not test myself, since no machine I have reproduces your setup. 
  > Thanks @darrylmorley for replying so fast. Sorry for not getting back to you earlier, I had a lot to do today.  With version `v1.3.0-beta.4` its now correctly reported. I have also contributed my diagnostics data with this same version, while having the same charger and cable attached.  <img width="632" height="594" alt="Image" src="https://github.com/user-attachments/assets/adfdc44b-6426-4c99-a3e4-80888e25434a" />   One more question, the overview only shows the negotiated USB-PD profile. Is this linked to the limitation with the M1 Pro and M1 Max you mentioned earlier or the missing data connection between my machine and the charger? It's nothing that bothers me, just something I noticed.  <img width="632" height="741" alt="Image" src="https://github.com/user-attachments/assets/7c419bf7-b817-44f7-9ca7-0ec7a0cc630b" />  If you need any more info on this or anything else in the future, just let me know.

- **Issue #471** (2026-07-23): **[Bug] WhatCable incorrectly identifies MagSafe port as USB-C port when "Hide empty ports" is enabled**
  *Symptoms*: ### What's wrong  Expected: When "hide empty ports" is enabled, WhatCable will report that 3 USB-C ports and 1 MagSafe port is detected. Actual: WhatCable identifies all 4 ports as USB-C, which I imagine to just be incorrect wording rather than a bug  Please see photos  ### Mac model  M3 Pro Macbook Pro (14 inch, Nov 2023)  ### macOS version  27.0 (Developer Beta 3)  ### WhatCable version  v1.2.1  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell Last login: Tue Jul 21 20:16:17 on console /Applications/WhatCable.app/Contents/Helpers/whatcable ; exit; REDACTED@Mac ~ % /Applications/WhatCable.app/Contents/Helpers/whatcable ; exit; === Port-MagSafe 3@1 (MagSafe 3) === Nothing connected Plug a cable into Port-MagSafe 3@1 to see what it can do.  === Port-USB-C@1 (USB-C) === Nothing connected Plug a cable into Port-USB-C@1 to see what it can do.  === Port-USB-C@2 (USB-C) === Nothing connected Plug a cable into Port-USB-C@2 to see what it can do.  === Port-USB-C@3 (USB-C) === Nothing connected Plug a cable into Port-USB-C@3 to see what it can do.  Saving session... ...copying shared history... ...saving history...truncating history files... ...completed. Deleting expired sessions...none found.  [Process completed] ```  ### System Information cross-check (optional)  <img width="278" height="101" alt="Image" src="https://github.com/user-attachments/assets/13dddc90-d322-448f-8c26-5fb9725dc52e" />  ### How ofte
  **Post-Mortem & Fix Analysis**:
  > Hi @cannotcollide!  Thanks for the report.  You're right, it's wording. The count is correct, the label isn't. Fixed for the next release.

- **Issue #462** (2026-07-22): **[Bug] Running WhatCable prevents Kensignton's KensigntonWorks driver from functioning**
  *Symptoms*: ### What's wrong  Expected: Running WhatCable v1.2.1 doesn't prevent my Kensington Expert Mouse/KensingtonWorks from working. What happens: As soon as I launch WhatCable and it does its port scan, my trackball stops working--meaning the trackball can no longer control the pointer at all. My Apple MagicTrackpad continues to work (also connected via USB). Unplugging and replugging the trackball doesn't resolve the issue while WhatCable is running. Once I quit WhatCable, the trackball continues not to work UNTIL I unplug and plug it back in. Then it functions normally again.  ### Mac model  M1Max MacBook Pro  ### macOS version  26.5.2  ### WhatCable version  1.2.1  ### Cable  USB-A to Kensington Expert Mouse (trackball)  ### What's plugged into the other end?  Kensington Expert Mouse (trackball)  ### `whatcable --json --raw` output  whatcable --json --raw output {   "adapter" : {     "currentMA" : 4900,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 98   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : true,       "bullets" : [         "Linked at up to 20 Gb\/s × 2",         "Connected via 2 hops: CalDigit, Inc. TS4 → CalDigit, Inc. Element 5 Hub",         "Connected device: USB Peripheral, CalDigit, Inc. (0x2188) (PD 3.0)",         "Cable has an e-marker chip (advertises its capabilities)",         "Cable speed: USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)
  **Post-Mortem & Fix Analysis**:
  > Hi @trusswalker,  I think I know what this is. WhatCable asks every USB device a standard "what are you capable of?" question when it scans. It's a read-only request and it doesn't open the device, but some devices react badly to being asked at all. A 2.4 GHz mouse receiver had the same reaction in #370.  There's a switch for it. Open Settings (the gear at the top of the panel) and turn on Skip deep USB probing. That stops WhatCable asking USB devices anything, so if this is the cause, your trackball should be fine with WhatCable running.
  > Thanks @darrylmorley !  That did indeed resolve the issue! I appreciate the response and the product! As you can tell, I have a lot of devices hanging on my USB ports.  Thanks again! -Steve

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

### Incident Patch 1: `0732b786` (2026-10-05)
**Commit Message**: Mirror from private (34411ad0)

**File**: `Sources/WhatCable/Services/TestKitRunner.swift` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@ final class TestKitRunner: ObservableObject {
     // Bound both the retained child output and the encoded network copy. The
     // higher request limit leaves room for JSON escaping while still imposing
     // a hard ceiling if an otherwise-valid output expands during serialization.
-    nonisolated static let maxProbeOutputBytes = 4 * 1024 * 1024
-    nonisolated static let maxRequestBodyBytes = 8 * 1024 * 1024
+    nonisolated static let maxProbeOutputBytes = 6 * 1024 * 1024
+    nonisolated static let maxRequestBodyBytes = 10 * 1024 * 1024
     private nonisolated static let probeReadChunkBytes = 64 * 1024
 
     enum State: Equatable {
```

**File**: `Tests/WhatCableAppTests/TestKitRunnerOutputLimitTests.swift` (modified, +36/-3)
```diff
@@ -4,7 +4,7 @@ import Testing
 
 // These tests launch real subprocesses and include an intentional watchdog
 // timeout. Serial execution keeps the timeout test from racing the two
-// concurrent 4 MiB output fixtures on slower CI hosts.
+// concurrent 6 MiB output fixtures on slower CI hosts.
 @Suite("Test Kit probe output limit", .serialized)
 struct TestKitRunnerOutputLimitTests {
     @Test("Output at the byte limit is preserved")
@@ -58,12 +58,12 @@ struct TestKitRunnerOutputLimitTests {
         // self-limiting (exits on its own after the sleep): if the
         // escalation regresses, the test must FAIL fast on the elapsed-time
         // assertion, not hang the suite on a child nothing can kill.
-        // 66 x 64 KiB = 4.125 MiB, just over the cap.
+        // 97 x 64 KiB = 6.0625 MiB, just over the cap.
         let fixture = try makeScript(contents: """
             #!/bin/sh
             trap '' TERM
             i=0
-            while [ $i -lt 66 ]; do
+            while [ $i -lt 97 ]; do
               /bin/dd if=/dev/zero bs=65536 count=1 2>/dev/null
               i=$((i+1))
             done
@@ -140,6 +140,39 @@ struct TestKitRunnerOutputLimitTests {
         #expect(body != nil)
     }
 
+    @Test("Every budgeted probe stops below the app's output cap")
+    @MainActor
+    func probeBudgetsSitUnderTheOutputCap() throws {
+        // A probe whose own byte budget reaches the app's cap has its whole
+        // output discarded (see outputOverLimitIsRejected), not trimmed. The
+        // budget can overshoot by one value, so keep at least 512 KiB clear.
+        let probes = URL(fileURLWithPath: #filePath)
+            .deletingLastPathComponent()   // WhatCableAppTests/
+            .deletingLastPathComponent()   // Tests/
+            .deletingLastPathComponent()   // repo root
+            .appendingPathComponent("probes/test-kit")
+        let budgeted = [
+            "04_raw_registry_dump.c",
+            "40_hub_port_statistics.c",
+            "43_usb_port_subtree.c",
+        ]
+        let pattern = try NSRegularExpression(
+            pattern: #"(?:kByteBudget =|#define MAX_BYTES) \(?(\d+)LL \* 1024 \* 1024"#
+        )
+        for name in budgeted {
+            let source = try String(contentsOf: probes.appendingPathComponent(name), encoding: .utf8)
+            let ns = source as NSString
+            let match = try #require(
+                pattern.firstMatch(in: source, range: NSRange(location: 0, length: ns.length)),
+                "no MiB byte budget found in \(name)"
+            )
+            let mib = try #require(Int(ns.substring(with: match.range(at: 1))))
+            let headroom = 512 * 1024
+            #expect(mib * 1024 * 1024 + headroom <= TestKitRunner.maxProbeOutputBytes,
+                    "\(name) budget \(mib) MiB is too close to the app cap")
+        }
+    }
+
     private func makeOutputFixture(byteCount: Int) throws -> URL {
         try makeScript(contents: "#!/bin/sh\n/usr/bin/yes x | /usr/bin/head -c \(byteCount)\n")
     }
```

**File**: `probes/test-kit/04_raw_registry_dump.c` (modified, +27/-2)
```diff
@@ -1,5 +1,6 @@
 // Dump EVERY property from a wide set of USB-C / Thunderbolt / port-controller
-// root services AND their full child subtrees. No field filtering: we want
+// root services AND their full child subtrees. One field filter only: HID
+// "Elements" tables print as an entry count (see dumpDict). Otherwise we want
 // everything the kernel exposes, documented or not, because a field that looks
 // useless today can turn out to matter for a later WhatCable feature (or a
 // sibling app). The recursion is what makes this a full capture: the matched
@@ -28,7 +29,7 @@
 
 // Byte budget: stay comfortably under the collector's multi-MB output cap so a
 // large tree is captured as far as it fits, never discarded wholesale.
-static const long long kByteBudget = 3LL * 1024 * 1024;
+static const long long kByteBudget = 5LL * 1024 * 1024;
 // Depth cap for registry-node recursion: a pure runaway backstop. Real subtrees
 // here are ~10 deep; the visited-set already prevents cycles, so this never
 // truncates real data.
@@ -122,6 +123,17 @@ static int alreadySeen(io_service_t service) {
 
 static void dumpValue(CFTypeRef value, int indent, int vdepth);
 
+/* True when an "Elements" array is a HID element table: its first entry is a
+   dictionary carrying "ElementCookie". Every Elements array in the corpus
+   (3769 in probe 04, 3133 in probe 40) has this shape; anything else prints
+   in full. */
+static int isHIDElementTable(CFTypeRef v) {
+    if (!v || CFGetTypeID(v) != CFArrayGetTypeID() || CFArrayGetCount(v) == 0) return 0;
+    CFTypeRef first = CFArrayGetValueAtIndex(v, 0);
+    return first && CFGetTypeID(first) == CFDictionaryGetTypeID()
+        && CFDictionaryContainsKey(first, CFSTR("ElementCookie"));
+}
+
 static void dumpDict(CFDictionaryRef dict, int indent, int vdepth) {
     if (vdepth > kMaxValueDepth) { emitf("<max value depth>\n"); return; }
     CFIndex count = CFDictionaryGetCount(dict);
@@ -154,6 +166,19 @@ static void dumpDict(CFDictionaryRef dict, int indent, int vdepth) {
         } else {
             emitf("<key>: ");
         }
+        /* HID element tables. Keyboard, mouse and sensor drivers publish an
+           "Elements" array with one dictionary per key, button or axis
+           (hundreds per device). On machines with several HID devices these
+           tables alone took 80-97% of the byte budget and pushed every later root
+           out of the dump (42 of 1493 probe-04 outputs, 32 of 388 probe-40
+           outputs, measured 2026-10-05). They say nothing about ports, cables
+           or links, so print the entry count and move on. */
+        if (CFGetTypeID(keys[i]) == CFStringGetTypeID()
+            && CFStringCompare(keys[i], CFSTR("Elements"), 0) == kCFCompareEqualTo
+            && isHIDElementTable(vals[i])) {
+            emitf("[%ld entries omitted: HID element table]\n", (long)CFArrayGetCount(vals[i]));
+            continue;
+        }
         dumpValue(vals[i], indent + 1, vdepth + 1);
     }
     free(keys);
```

**File**: `probes/test-kit/40_hub_port_statistics.c` (modified, +27/-2)
```diff
@@ -1,6 +1,7 @@
 // Dump every USB hub node (AppleUSB20Hub / AppleUSB30Hub) and per-downstream-port
 // node (AppleUSB20HubPort / AppleUSB30HubPort) in full, together with their whole
-// child subtrees. No field filtering: everything the kernel exposes is captured,
+// child subtrees. One field filter only: HID "Elements" tables print as an entry
+// count (see dumpDict). Otherwise we want everything the kernel exposes,
 // documented or not, because a field that looks useless today can matter for a
 // later WhatCable feature or a sibling app.
 //
@@ -52,7 +53,7 @@
 #include <string.h>
 #include <ctype.h>
 
-static const long long kByteBudget = 3LL * 1024 * 1024;
+static const long long kByteBudget = 5LL * 1024 * 1024;
 // Registry-node recursion cap (runaway backstop; real subtrees are ~10 deep).
 static const int kMaxDepth = 48;
 // CF property-value recursion cap (nested dicts/arrays within one node). Real
@@ -135,6 +136,17 @@ static int alreadySeen(io_service_t service) {
 
 static void dumpValue(CFTypeRef value, int indent, int vdepth);
 
+/* True when an "Elements" array is a HID element table: its first entry is a
+   dictionary carrying "ElementCookie". Every Elements array in the corpus
+   (3769 in probe 04, 3133 in probe 40) has this shape; anything else prints
+   in full. */
+static int isHIDElementTable(CFTypeRef v) {
+    if (!v || CFGetTypeID(v) != CFArrayGetTypeID() || CFArrayGetCount(v) == 0) return 0;
+    CFTypeRef first = CFArrayGetValueAtIndex(v, 0);
+    return first && CFGetTypeID(first) == CFDictionaryGetTypeID()
+        && CFDictionaryContainsKey(first, CFSTR("ElementCookie"));
+}
+
 static void dumpDict(CFDictionaryRef dict, int indent, int vdepth) {
     if (vdepth > kMaxValueDepth) { emitf("<max value depth>\n"); return; }
     CFIndex count = CFDictionaryGetCount(dict);
@@ -167,6 +179,19 @@ static void dumpDict(CFDictionaryRef dict, int indent, int vdepth) {
         } else {
             emitf("<key>: ");
         }
+        /* HID element tables. Keyboard, mouse and sensor drivers publish an
+           "Elements" array with one dictionary per key, button or axis
+           (hundreds per device). On machines with several HID devices these
+           tables alone took 80-97% of the byte budget and pushed every later root
+           out of the dump (42 of 1493 probe-04 outputs, 32 of 388 probe-40
+           outputs, measured 2026-10-05). They say nothing about ports, cables
+           or links, so print the entry count and move on. */
+        if (CFGetTypeID(keys[i]) == CFStringGetTypeID()
+            && CFStringCompare(keys[i], CFSTR("Elements"), 0) == kCFCompareEqualTo
+            && isHIDElementTable(vals[i])) {
+            emitf("[%ld entries omitted: HID element table]\n", (long)CFArrayGetCount(vals[i]));
+            continue;
+        }
         dumpValue(vals[i], indent + 1, vdepth + 1);
     }
     free(keys);
```

**File**: `probes/test-kit/43_usb_port_subtree.c` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@
 //
 // Overrides for exercising branches a given machine cannot reach:
 //   -DMAX_BYTES=N              byte budget (default 3 MiB, under the
-//                              runner's 4 MiB cap, over which output is
+//                              runner's 6 MiB cap, over which output is
 //                              discarded whole)
 //   -DPROBE43_PORT_PLANE=\"X\"   plane name to treat as the IOPort plane
 //   -DPROBE43_IOPORT_CLASS=\"X\" class to match as IOPort
```

---

### Incident Patch 2: `c424fc92` (2026-10-02)
**Commit Message**: Mirror from private (8626c130)

**File**: `Sources/WhatCable/Resources/de.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 "Privacy" = "Datenschutz";
 "Pro" = "Pro";
 "Proceed" = "Fortfahren";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Rohe IOKit-Registry-Eigenschaften, eine Liste der auf deinem Mac vorhandenen Treiberklassen sowie deine macOS-Version und der Chip-Typ. Dies sind Daten, die macOS auf deinem Mac ohnehin bereitstellt.";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Rohe IOKit-Registry-Eigenschaften, eine Liste der auf deinem Mac vorhandenen Treiberklassen sowie deine macOS-Version, der Chip-Typ und die Modellkennung deines Macs (zum Beispiel Mac14,3). Dies sind Daten, die macOS auf deinem Mac ohnehin bereitstellt.";
 "What happens" = "Was passiert";
 "What is collected" = "Was wird erfasst";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable führt %lld IOKit-Probes aus, die Hardware-Daten auslesen, die dein Mac ohnehin bereitstellt. Die Ergebnisse werden an einen sicheren Server gesendet, um die Kabel- und Anschlusserkennung zu verbessern.";
```

**File**: `Sources/WhatCable/Resources/en.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@
 "Privacy" = "Privacy";
 "Pro" = "Pro";
 "Proceed" = "Proceed";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac.";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac.";
 "What happens" = "What happens";
 "What is collected" = "What is collected";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection.";
```

**File**: `Sources/WhatCable/Resources/es.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 "Privacy" = "Privacidad";
 "Pro" = "Pro";
 "Proceed" = "Continuar";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Propiedades sin procesar del registro IOKit, una lista de las clases de controladores presentes en tu Mac, además de tu versión de macOS y el tipo de chip. Son datos que macOS ya expone en tu Mac.";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Propiedades sin procesar del registro IOKit, una lista de las clases de controladores presentes en tu Mac, además de tu versión de macOS, el tipo de chip y el identificador de modelo de tu Mac (por ejemplo, Mac14,3). Son datos que macOS ya expone en tu Mac.";
 "What happens" = "Qué sucede";
 "What is collected" = "Qué se recopila";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable ejecuta %lld sondeos IOKit que leen datos de hardware que tu Mac ya publica. Los resultados se envían a un servidor seguro para ayudar a mejorar la detección de cables y puertos.";
```

**File**: `Sources/WhatCable/Resources/fr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 "Privacy" = "Confidentialité";
 "Pro" = "Pro";
 "Proceed" = "Continuer";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Propriétés brutes du registre IOKit, une liste des classes de pilotes présentes sur votre Mac, ainsi que votre version de macOS et le type de puce. Ce sont des données que macOS expose déjà sur votre Mac.";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Propriétés brutes du registre IOKit, une liste des classes de pilotes présentes sur votre Mac, ainsi que votre version de macOS, le type de puce et l'identifiant de modèle de votre Mac (par exemple, Mac14,3). Ce sont des données que macOS expose déjà sur votre Mac.";
 "What happens" = "Ce qui se passe";
 "What is collected" = "Ce qui est collecté";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable exécute %lld sondes IOKit qui lisent les données matérielles que votre Mac publie déjà. Les résultats sont envoyés à un serveur sécurisé pour aider à améliorer la détection des câbles et des ports.";
```

**File**: `Sources/WhatCable/Resources/hi.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@
 "Privacy" = "गोपनीयता";
 "Pro" = "Pro";
 "Proceed" = "आगे बढ़ें";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "रॉ IOKit रजिस्ट्री प्रॉपर्टीज़, आपके Mac पर मौजूद ड्राइवर क्लासेज़ की सूची, साथ ही आपका macOS संस्करण और चिप प्रकार। यह वह डेटा है जो macOS पहले से आपके Mac पर उपलब्ध कराता है।";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "रॉ IOKit रजिस्ट्री प्रॉपर्टीज़, आपके Mac पर मौजूद ड्राइवर क्लासेज़ की सूची, साथ ही आपका macOS संस्करण, चिप प्रकार और आपके Mac का मॉडल आइडेंटिफ़ायर (उदाहरण के लिए, Mac14,3)। यह वह डेटा है जो macOS पहले से आपके Mac पर उपलब्ध कराता है।";
 "What happens" = "क्या होता है";
 "What is collected" = "क्या एकत्र किया जाता है";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable %lld IOKit प्रोब चलाता है जो आपका Mac पहले से उपलब्ध कराने वाला हार्डवेयर डेटा पढ़ते हैं। केबल और पोर्ट डिटेक्शन सुधारने में मदद के लिए परिणाम एक सुरक्षित सर्वर पर भेजे जाते हैं।";
```

**File**: `Sources/WhatCable/Resources/hy.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 "Privacy" = "Գաղտնիություն";
 "Pro" = "Pro";
 "Proceed" = "Շարունակել";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Հում IOKit ռեեստրի հատկություններ, ձեր Mac-ում առկա դրայվերների դասերի ցանկ, ինչպես նաև macOS-ի տարբերակն ու չիպի տեսակը: Սրանք տվյալներ են, որոնք macOS-ն արդեն հասանելի է դարձնում ձեր Mac-ում:";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Հում IOKit ռեեստրի հատկություններ, ձեր Mac-ում առկա դրայվերների դասերի ցանկ, ինչպես նաև macOS-ի տարբերակը, չիպի տեսակը և ձեր Mac-ի մոդելի նույնացուցիչը (օրինակ՝ Mac14,3): Սրանք տվյալներ են, որոնք macOS-ն արդեն հասանելի է դարձնում ձեր Mac-ում:";
 "What happens" = "Ինչ է տեղի ունենում";
 "What is collected" = "Ինչ է հավաքվում";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable-ը գործարկում է %lld IOKit զոնդ, որոնք կարդում են սարքային տվյալներ, որոնք ձեր Mac-ն արդեն հրապարակում է: Արդյունքներն ուղարկվում են ապահով սերվեր՝ մալուխների և պորտերի հայտնաբերումը բարելավելու համար:";
```

**File**: `Sources/WhatCable/Resources/it.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@
 "Privacy" = "Privacy";
 "Pro" = "Pro";
 "Proceed" = "Procedi";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "Proprietà registro Raw IOKit, un elenco di classi di driver presenti nel Mac, oltre alla versione di macOS e al tipo di chip. Questi sono i dati che macOS espone già nel Mac.";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "Proprietà registro Raw IOKit, un elenco di classi di driver presenti nel Mac, oltre alla versione di macOS, al tipo di chip e all'identificatore del modello del Mac (ad esempio, Mac14,3). Questi sono i dati che macOS espone già nel Mac.";
 "What happens" = "Cosa succede";
 "What is collected" = "Quali dati vengono raccolti";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCable esegue %lld verifiche IOKit che leggono i dati hardware già pubblicati dal Mac. I risultati vengono inviati a un server sicuro per contribuire a migliorare il rilevamento di cavi e porte.";
```

**File**: `Sources/WhatCable/Resources/ja.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 "Privacy" = "プライバシー";
 "Pro" = "Pro";
 "Proceed" = "続行";
-"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version and chip type. This is data macOS already exposes on your Mac." = "生のIOKitレジストリプロパティ、Mac上に存在するドライバクラスの一覧、macOSのバージョン、チップの種類。これらはmacOSがMac上ですでに公開しているデータです。";
+"Raw IOKit registry properties, a list of the driver classes present on your Mac, plus your macOS version, chip type and Mac model identifier (for example, Mac14,3). This is data macOS already exposes on your Mac." = "生のIOKitレジストリプロパティ、Mac上に存在するドライバクラスの一覧、macOSのバージョン、チップの種類、Macのモデル識別子（例：Mac14,3）。これらはmacOSがMac上ですでに公開しているデータです。";
 "What happens" = "何が行われるか";
 "What is collected" = "収集される情報";
 "WhatCable runs %lld IOKit probes that read hardware data your Mac already publishes. The results are sent to a secure server to help improve cable and port detection." = "WhatCableは%lld個のIOKitプローブを実行し、Macがすでに公開しているハードウェアデータを読み取ります。結果はケーブルとポートの検出を改善するため、安全なサーバーに送信されます。";
```

---

### Incident Patch 3: `2c23667e` (2026-10-02)
**Commit Message**: Mirror from private (ca99ad9d)

**File**: `Tests/WhatCableDarwinTests/EDIDOracleSweepTests.swift` (removed, +0/-474)
```diff
@@ -1,474 +0,0 @@
-import CryptoKit
-import Foundation
-import Testing
-@testable import WhatCableCore
-
-// MARK: - EDIDOracleSweepTests
-//
-// The acceptance gate for the EDID parser: every timing the reference decoder
-// (edid-decode from v4l-utils, pinned commit recorded in the TSV's first line)
-// prints for every unique EDID in the customer-probe corpus must appear in
-// `EDIDInfo.modes`, and every entry in `EDIDInfo.modes` must be a timing
-// edid-decode printed. The oracle rows live in
-// `research/corpus-baselines/edid-decode-timings.tsv`, written by
-// `scripts/edid-oracle.py` in the research repo; that script's docstring is the
-// TSV's schema and `kind` vocabulary.
-//
-// Extraction of the EDID bytes is the same as the neighbouring sweeps
-// (`DisplayDiagnosticProbeSweepTests`): the `Metadata.EDID = <N bytes ...> HEX`
-// line inside every `=== DisplayPort node [N] ===` block of every probe-33
-// file. Every block is read, active or not, so the set matches the oracle's.
-// Dedupe is by the sha256 of the bytes, which is the TSV's join key.
-//
-// The two sides differ by design in a handful of named ways. Each rule below
-// is a measured fact about edid-decode's output, cited to the function that
-// prints it, and the sweep counts every row it excludes so a rule that starts
-// swallowing more than it should is visible in the printout.
-//
-//   1. `HDMIVIC` rows are excluded. No HDMI VIC table is bundled (owner ruling
-//      9); edid-decode prints them from `edid_hdmi_mode_map` in
-//      `cta_hdmi_block` (parse-cta-block.cpp).
-//   2. Standard timings. edid-decode's `print_standard_timing`
-//      (parse-base-block.cpp) prints exactly one `GTF` line for a non-DMT
-//      standard timing on every EDID in this corpus, whatever the 0xFD
-//      descriptor's byte 10 says, because `supports_cvt` is never set on a
-//      fresh parse (its preparse runs before `edid_minor` is read). Our side has
-//      one entry (the formula the EDID licenses) or none (an undecoded
-//      `StandardTimingID`). So a `GTF`/`CVT` row under "Standard Timings" is
-//      satisfied by an entry with the same picture, refresh and pixel clock,
-//      or by `undecodedStandardTimings` naming that picture and refresh. An
-//      entry with the same picture and rounded refresh but a different clock
-//      is a formula difference, counted, and tolerated only when byte 10 is
-//      0x04 (CVT), which this corpus does not contain.
-//   3. VIC rows under the "YCbCr 4:2:0 Capability Map Data Block" and the HDMI
-//      VSDB's "3D VIC indices" sections are re-prints of the Video Data
-//      Block's own SVDs (`cta_y420cmdb` and `cta_hdmi_block` call
-//      `print_vic_index`, which prints `cta.preparsed_svds[0][idx]`), not new
-//      declarations. The oracle script measured that every one has an
-//      identical VDB row in the same EDID. They are excluded and counted.
-//   4. `TILED` rows are not timings. edid-decode prints the topology
-//      (`parse_displayid_tiled_display_topology`) and synthesises no composite
-//      mode. Each `.tiledComposite` entry on our side must instead correspond
-//      to a `TILED` row whose tile resolution times its tile count equals the
-//      composite's picture, and is counted.
-//   5. Interlaced refresh is compared as the field rate on both sides
-//      (`EDIDMode.refreshHz` doubles the frame rate; `print_timings` divides
-//      the frame by a half-line-corrected field total).
-//   6. Refresh is compared to 0.001 Hz and pixel clock to 1 kHz, the spec's
-//      acceptance criteria.
-//   7. A descriptor with a zero vertical total prints an `inf` refresh
-//      (`print_timings` divides the clock by `htotal * vtotal`); our
-//      `EDIDMode.refreshHz` returns 0 for a zero total. Such a row matches on
-//      picture and pixel clock alone, and is counted. Measured once in the
-//      corpus: a CTA-block DTD of 128x0.
-//
-// Everything else must match exactly, in both directions, and the sweep prints
-// every mismatch before failing.
-
-@Suite("EDID oracle sweep: every corpus EDID's declared mode list matches edid-decode")
-struct EDIDOracleSweepTests {
-
-    // MARK: - Paths
-
-    private static let repoRoot: URL = {
-        URL(fileURLWithPath: #filePath)
-            .deletingLastPathComponent()   // WhatCableDarwinTests
-            .deletingLastPathComponent()   // Tests
-            .deletingLastPathComponent()   // repo root
-    }()
-
-    private static let probeRoot = repoRoot.appendingPathComponent("research/customer-probes")
-    private static let oracleTSV = repoRoot.appendingPathComponent("research/corpus-baselines/edid-decode-timings.tsv")
-
-    // MARK: - Oracle rows
-
-    struct OracleRow {
-        let sha: String
-        let folder: String
-        let block: Int
-        let monitor: String
-        let kind: String
-        let width: Int
-        let height: Int
-        let interlaced: Bool
-        let refreshHz: Do
```

**File**: `scripts/edid-timings/README.md` (modified, +1/-4)
```diff
@@ -92,10 +92,7 @@ same two dictionaries this file's regenerate steps produce. An id missing
 from either table yields no mode, same as an unresolved HDMI VIC.
 
 `check-edid-timings.py`'s comparison above is against edid-decode's and the
-kernel's own tables, not real EDIDs. The cross-check against real EDIDs is
-`Tests/WhatCableDarwinTests/EDIDOracleSweepTests.swift`, which parses every
-corpus EDID with the tables in place and compares the declared mode list
-against edid-decode's output for the same file.
+kernel's own tables, not real EDIDs. The parser was checked against edid-decode on all 602 corpus EDIDs on 2026-10-02 with 0 mismatches, and the whatcable-edid-oracle skill re-runs that check on demand.
 
 ## Known convention difference: double-clocked SD formats
 
```

---

### Incident Patch 4: `3b7f671f` (2026-09-23)
**Commit Message**: Mirror from private (7896f2dc)

**File**: `data/known-cables.md` (modified, +25/-9)
```diff
@@ -43,9 +43,10 @@ hand-maintained markdown table; format may change once the consumer exists.
 | Monoprice Essentials USB-C 10 Gbps 0.5 m | `0x2095` | `0x004F` |  | CE LINK LIMITED | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#48](https://github.com/darrylmorley/whatcable/issues/48) |
 | Amazon Basics USB-C TB4 cable 1 m (240 W), USB-IF certified | `0x2095` | `0x03CF` | `0x110A2E43` | CE LINK LIMITED | `0x34F2` | USB4 Gen 3 (40 Gbps, Thunderbolt 4 class) | 5 A / 50 V (240 W) | passive | [#231](https://github.com/darrylmorley/whatcable/issues/231) |
 | delock TB3-branded cable | `0x20C2` | `0x0005` |  | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#44](https://github.com/darrylmorley/whatcable/issues/44) |
-| OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock | `0x20C2` | `0x0007` | `0x31082052` | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#143](https://github.com/darrylmorley/whatcable/issues/143) |
+| OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock; also shipped with the CalDigit TS3 Plus | `0x20C2` | `0x0007` | `0x31082052` | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#143](https://github.com/darrylmorley/whatcable/issues/143), [#557](https://github.com/darrylmorley/whatcable/issues/557) |
 | SanDisk Extreme SSD bundled cable | `0x2109` | `0x0000` | `0x00082022` | VIA Labs, Inc. | none | USB 3.2 Gen 2 (10 Gbps) | 3 A / 20 V (60 W) | passive | [#202](https://github.com/darrylmorley/whatcable/issues/202) |
 | Generic USB-C cable used with Dell P2422HE monitor (unbranded) | `0x228A` | `0x0000` | `0x00084041` | Hotron Precision Electronic Ind. Corp. | `0x294` | USB 3.2 Gen 1 (5 Gbps) | 5 A / 20 V (100 W) | passive | [#177](https://github.com/darrylmorley/whatcable/issues/177) |
+| Corsair XENEON 34WQHD240-C monitor bundled cable (Hotron ODM, cert HT-C22) | `0x228A` | `0x0000` | `0x00084041` | Hotron Precision Electronic Ind. Corp. | `0x298` | USB 3.2 Gen 1 (5 Gbps) | 5 A / 20 V (100 W) | passive | [#609](https://github.com/darrylmorley/whatcable/issues/609) |
 | Monitor bundled cable (Hotron ODM) | `0x228A` | `0x0000` | `0x00082042` | Hotron Precision Electronic Ind. Corp. | `0x293` | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#207](https://github.com/darrylmorley/whatcable/issues/207) |
 | OnePlus SuperVOOC 10A cable (Type-C to Type-C) | `0x22D9` | `0x1428` | `0x60082A40` | GuangDong OPPO Mobile Telecommunications Corp., Ltd. | none | USB 2.0 (480 Mbps) | 5 A / 30 V (150 W) | passive | [#148](https://github.com/darrylmorley/whatcable/issues/148) |
 | Anker Nano 240 W USB-C cable 1.8 m | `0x291A` | `0x82E2` | `0x000A4E40` | Anker Innovations Limited | none | USB 2.0 (480 Mbps) | 5 A / 50 V (240 W) | passive | [#233](https://github.com/darrylmorley/whatcable/issues/233) |
@@ -72,10 +73,10 @@ hand-maintained markdown table; format may change once the consumer exists.
 | Kramer C-U32/MFF-6, 6 ft AV cable | `0x7857` | `0x1004` | `0x00084842` | Unregistered | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#260](https://github.com/darrylmorley/whatcable/issues/260) |
 | CUKTECH No.6 140 W (e-marker present but VID/PID/speed all zeroed) | `0x0000` | `0x0000` |  | (zeroed) | none | (none advertised) | (not advertised) | passive | [#61](https://github.com/darrylmorley/whatcable/issues/61) |
 | vorodcip generic USB-C cable, Amazon Japan (VID/PID zeroed) | `0x0000` | `0x0000` | `0x000A6642` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 50 V (240 W) | passive | [#91](https://github.com/darrylmorley/whatcable/issues/91) |
-| Dockcase 100 W 10 Gbps 0.5 m (VID/PID zeroed) | `0x0000` | `0x0000` | `0x00082042` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#92](https://github.com/darrylmorley/whatcable/issues/92) |
+| Dockcase 100 W 10 Gbps 0.5 m (VID/PID zeroed) | `0x0000` | `0x0000` | `0x00082042` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#92](https://github.com/darrylmorley/whatcable/issues/92), [#577](https://github.com/darrylmorley/whatcable/issues/577) |
 | Aulumu M07 (VID/PID zeroed) | `0x0000` | `0x0000` | `0x000A4642` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 50 V (240 W) | passive | [#108](https://github.com/darrylmorley/whatcable/issues/108) |
 | Lindy Anthra Line USB 3.2 Gen 2x2 1 m (Part No. 36901), Amazon Italy | `0x0000` | `0x0000` | `0x00082052` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#116](https://github.com/darrylmorley/whatcable/issues/116) |
-| UGreen Revodok 9-in-1 USB-C hub cable, Amazon France | `0x0000` | `0x0000` | `0x00084841` | (zeroed) | none | USB 3.2 Gen 1 (5 Gbps) | 5 A / 20 V (100 W) | passive | [#126](https://github.com/darrylmorley/whatcable/issues/126) |
+| UGreen USB-C hub
```

**File**: `docs/cables.html` (modified, +100/-15)
```diff
@@ -467,7 +467,7 @@
   "name": "WhatCable cable fingerprint database",
   "description": "Crowd-sourced USB-C cable e-marker fingerprints reported via WhatCable. Entries record the reported manufacturer and product identifiers, encoded cable capabilities, declared speed and charging rating, with links to the original reports. These are identity reports, not physical performance tests.",
   "url": "https://www.whatcable.uk/cables",
-  "dateModified": "2026-09-10T18:06:20.000Z",
+  "dateModified": "2026-09-22T22:35:17.000Z",
   "keywords": [
     "USB-C", "USB4", "Thunderbolt", "Thunderbolt 5", "e-marker",
     "USB Power Delivery", "USB-C cable database", "cable VDO", "USB-IF VID"
@@ -490,12 +490,12 @@
 </script>
 
 <main class="cables-page" data-catalog>
-  <header class="catalog-heading"><div><span class="catalog-eyebrow">The community cable library</span><h1>Get to know your cable.</h1><p>Find a cable by name or by the identity code shown in WhatCable. Compare its reported data speed and charging rating, then open the details when you need them.</p><p class="catalog-meta">125 entries · Updated 10 September 2026</p></div><a class="catalog-help-link" href="/inside-a-cable"><strong>Same plug. Different insides. →</strong><span>Explore the 3D diagram to see what the wires and identity chip actually do.</span></a></header>
+  <header class="catalog-heading"><div><span class="catalog-eyebrow">The community cable library</span><h1>Get to know your cable.</h1><p>Find a cable by name or by the identity code shown in WhatCable. Compare its reported data speed and charging rating, then open the details when you need them.</p><p class="catalog-meta">142 entries · Updated 22 September 2026</p></div><a class="catalog-help-link" href="/inside-a-cable"><strong>Same plug. Different insides. →</strong><span>Explore the 3D diagram to see what the wires and identity chip actually do.</span></a></header>
   <section aria-label="Search and filter cables" class="catalog-controls" id="catalog-controls" hidden>
     <div class="catalog-search-row"><label for="catalog-search">Find a cable<input id="catalog-search" type="search" placeholder="Try Apple, CalDigit, 0x05AC or a report number" autocomplete="off"></label><button type="button" id="catalog-clear" disabled>Reset filters</button></div>
     <div class="catalog-filters"><label for="catalog-speed">Reported data speed<select id="catalog-speed"><option value="">All speeds</option><option value="480 Mbps">480 Mbps</option><option value="10 Gbps">10 Gbps</option><option value="5 Gbps">5 Gbps</option><option value="40 Gbps">40 Gbps</option><option value="80 Gbps">80 Gbps</option><option value="20 / 40 Gbps">20 / 40 Gbps</option></select></label><label for="catalog-power">Reported charging rating<select id="catalog-power"><option value="">All ratings</option><option value="~60 W">~60 W</option><option value="60 W">60 W</option><option value="100 W">100 W</option><option value="~100 W">~100 W</option><option value="144 W">144 W</option><option value="150 W">150 W</option><option value="240 W">240 W</option></select></label><label for="catalog-sort">Sort results<select id="catalog-sort"><option value="name">Cable name · A–Z</option><option value="speed">Highest reported speed</option><option value="power">Highest reported power</option></select></label></div>
   </section>
-  <div class="catalog-results-bar"><p id="catalog-count" role="status" aria-live="polite">125 entries</p><a href="#reading-reports">Reported ratings, not performance tests ↓</a></div>
+  <div class="catalog-results-bar"><p id="catalog-count" role="status" aria-live="polite">142 entries</p><a href="#reading-reports">Reported ratings, not performance tests ↓</a></div>
   <noscript><p>All entries are shown below. Use your browser’s Find command to search; each entry’s details still open without JavaScript.</p></noscript>
   <div class="catalog-column-head" aria-hidden="true"><span>Cable / report description</span><span>Reported speed</span><span>Reported power</span><span>Details</span></div>
   <section id="catalog-results" aria-label="Cable reports">
@@ -560,8 +560,8 @@
       <div class="catalog-details"><p>These values come from the cable’s identity chip—its digital label. They do not measure the speed or charging power your setup will achieve.</p><h3>The complete report</h3><dl class="catalog-fields"><div><dt>Data declaration</dt><dd>USB 2.0 (480 Mbps)</dd></div><div><dt>Power declaration</dt><dd>5 A / 20 V (100 W)</dd></div><div><dt>Construction reported</dt><dd>Passive</dd></div><div><dt>Manufacturer ID · VID</dt><dd><code>0x0000</code></dd></div><div><dt>Product ID · PID</dt><dd><code>0x0000</code></dd></div><div><dt>Registered vendor name</dt><dd>(zeroed)</dd></div><div><dt>Encoded capabilities · cable VDO</dt><dd><code>0x00084040</code></dd></div><div><dt>Certification identifier · XID</dt><dd><code>none</code></dd></div></dl><div class="catalog-source"><a href="https://github.com/darrylmorley/whatcable/issu
```

**File**: `docs/cables.json` (modified, +244/-6)
```diff
@@ -168,7 +168,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "UGreen Revodok 9-in-1 USB-C hub cable, Amazon France",
+    "brand" : "UGreen USB-C hub bundled cable: Revodok 9-in-1 (Amazon France) and CM818-45363 (JD.com)",
     "cableVDO" : "0x00084841",
     "issueNum" : "#126",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/126",
@@ -238,7 +238,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "UGREEN L705 USB4 \/ TB4-class cable, Amazon (VID\/PID zeroed)",
+    "brand" : "UGREEN L705 USB4 \/ TB4-class cable (part 65175), Amazon (VID\/PID zeroed)",
     "cableVDO" : "0x000A2643",
     "issueNum" : "#359",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/359",
@@ -308,7 +308,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "Maxonar TH33 TB4 cable, Amazon",
+    "brand" : "Maxonar TH33 TB4 cable, Amazon; also MOVE SPEED (移速), Pinduoduo",
     "cableVDO" : "0x000A4643",
     "issueNum" : "#219",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/219",
@@ -322,7 +322,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "Unbranded TB5-class 80 Gbps, zeroed e-marker",
+    "brand" : "Unbranded TB5-class 80 Gbps, zeroed e-marker (one reported as a Kickstarter cable)",
     "cableVDO" : "0x000A4644",
     "issueNum" : "#309",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/309",
@@ -335,6 +335,20 @@
     "vid" : "0x0000",
     "xid" : "none"
   },
+  {
+    "brand" : "Unbranded Amazon cable marked 20 Gbps (claims EPR, 20 V max VBUS)",
+    "cableVDO" : "0x000A6042",
+    "issueNum" : "#601",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/601",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 20 V (100 W)",
+    "registered" : false,
+    "speed" : "USB 3.2 Gen 2 (10 Gbps)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
   {
     "brand" : "vorodcip generic USB-C cable, Amazon Japan (VID\/PID zeroed)",
     "cableVDO" : "0x000A6642",
@@ -363,6 +377,34 @@
     "vid" : "0x0000",
     "xid" : "none"
   },
+  {
+    "brand" : "Eudobel TB4-branded USB4 cable 1 m, Amazon (VID\/PID zeroed)",
+    "cableVDO" : "0x000A6643",
+    "issueNum" : "#589",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/589",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 50 V (240 W)",
+    "registered" : false,
+    "speed" : "USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
+  {
+    "brand" : "LTT TrueSpec USB-C cable, marked 20 Gbps (e-marker has no 20 Gbps code, reads Gen 2)",
+    "cableVDO" : "0x110A6E42",
+    "issueNum" : "#470",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/470",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 50 V (240 W)",
+    "registered" : false,
+    "speed" : "USB 3.2 Gen 2 (10 Gbps)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
   {
     "brand" : "MediaStorm (YingShi JuFeng) TB5 cable, Taobao",
     "cableVDO" : "0x000A4644",
@@ -755,6 +797,20 @@
     "vid" : "0x05AC",
     "xid" : "0x2600"
   },
+  {
+    "brand" : "Apple Thunderbolt 4 Pro cable 1.8 m, reporter-identified (second PID alongside `0x7205`)",
+    "cableVDO" : "0x4368F8DB",
+    "issueNum" : "#534",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/534",
+    "pid" : "0x7209",
+    "power" : "5 A \/ 20 V (100 W)",
+    "registered" : true,
+    "speed" : "USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)",
+    "type" : "active",
+    "vendor" : "Apple",
+    "vid" : "0x05AC",
+    "xid" : "none"
+  },
   {
     "brand" : "Apple Thunderbolt 5 cable 1 m (model A3189)",
     "cableVDO" : "0x110A2644",
@@ -895,6 +951,20 @@
     "vid" : "0x201C",
     "xid" : "0xBBB"
   },
+  {
+    "brand" : "OM System camera bundled USB-C cable",
+    "cableVDO" : "0x00082052",
+    "issueNum" : "#615",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/615",
+    "pid" : "0xA454",
+    "power" : "5 A \/ 20 V (100 W)",
+    "registered" : true,
+    "speed" : "USB 3.2 Gen 2 (10 Gbps)",
+    "type" : "passive",
+    "vendor" : "Luxshare-ICT",
+    "vid" : "0x208E",
+    "xid" : "0x241205"
+  },
   {
     "brand" : "Eizo EV2740X monitor bundled cable (KVM connection)",
     "cableVDO" : "0x00084041",
@@ -909,6 +979,20 @@
     "vid" : "0x208E",
     "xid" : "none"
   },
+  {
+    "brand" : "Anker Bio-Braided A80E6 240 W cable (Luxshare e-marker variant of #519)",
+    "cableVDO" : "0x000A4640",
+    "issueNum" : "#535",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/535",
+    "pid" : "0xC187",
+    "power" : "5 A \/ 50 V (240 W)",
+    "registered" : true,
+    "speed" : "USB 2.0 (480 Mbps)",
+    "type" : "passive",
+    "vendor" : "Luxshare-ICT",
+    "vid" : "0x208E",
+    "xid" : "0x30"
+  },
   {
     "brand" :
```

**File**: `docs/index.html` (modified, +1/-1)
```diff
@@ -1214,7 +1214,7 @@ <h2>Claims are useful. Observed behaviour is better.</h2>
         <p>Contributed observations build a public record of how real cables identify themselves across real hardware.</p>
       </div>
       <div class="corpus-card">
-        <span class="corpus-number">125</span>
+        <span class="corpus-number">142</span>
         <span class="corpus-label">cable observations in the public database</span>
         <div class="corpus-facts">
           <span>Reported through WhatCable</span>
```

**File**: `src/_data/cablesmeta.json` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 {
-  "updated" : "2026-09-10T18:06:20Z"
+  "updated" : "2026-09-22T23:35:17+01:00"
 }
```

**File**: `src/_includes/cables-table.njk` (modified, +219/-15)
```diff
@@ -1,5 +1,5 @@
 {# Generated by scripts/render-known-cables.swift from data/known-cables.md.
-   Do not edit by hand. Last regenerated: 2026-09-10. #}
+   Do not edit by hand. Last regenerated: 2026-09-22. #}
 <table class="cables">
   <thead>
     <tr>
@@ -257,7 +257,7 @@
             <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/44">#44</a></td>
           </tr>
           <tr>
-            <td class="col-context">OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock</td>
+            <td class="col-context">OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock; also shipped with the CalDigit TS3 Plus</td>
             <td class="col-vid"><code>0x20C2</code></td>
             <td class="col-pid"><code>0x0007</code></td>
             <td class="col-cable-vdo"><code>0x31082052</code></td>
@@ -266,7 +266,7 @@
             <td class="col-speed">USB 3.2 Gen 2 (10 Gbps)</td>
             <td class="col-power">5 A / 20 V (100 W)</td>
             <td class="col-type">passive</td>
-            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/143">#143</a></td>
+            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/143">#143</a>, <a href="https://github.com/darrylmorley/whatcable/issues/557">#557</a></td>
           </tr>
           <tr>
             <td class="col-context">SanDisk Extreme SSD bundled cable</td>
@@ -292,6 +292,18 @@
             <td class="col-type">passive</td>
             <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/177">#177</a></td>
           </tr>
+          <tr>
+            <td class="col-context">Corsair XENEON 34WQHD240-C monitor bundled cable (Hotron ODM, cert HT-C22)</td>
+            <td class="col-vid"><code>0x228A</code></td>
+            <td class="col-pid"><code>0x0000</code></td>
+            <td class="col-cable-vdo"><code>0x00084041</code></td>
+            <td class="col-vendor">Hotron Precision Electronic Ind. Corp.</td>
+            <td class="col-xid"><code>0x298</code></td>
+            <td class="col-speed">USB 3.2 Gen 1 (5 Gbps)</td>
+            <td class="col-power">5 A / 20 V (100 W)</td>
+            <td class="col-type">passive</td>
+            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/609">#609</a></td>
+          </tr>
           <tr>
             <td class="col-context">Monitor bundled cable (Hotron ODM)</td>
             <td class="col-vid"><code>0x228A</code></td>
@@ -614,7 +626,7 @@
             <td class="col-speed">USB 3.2 Gen 2 (10 Gbps)</td>
             <td class="col-power">5 A / 20 V (100 W)</td>
             <td class="col-type">passive</td>
-            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/92">#92</a></td>
+            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/92">#92</a>, <a href="https://github.com/darrylmorley/whatcable/issues/577">#577</a></td>
           </tr>
           <tr>
             <td class="col-context">Aulumu M07 (VID/PID zeroed)</td>
@@ -641,7 +653,7 @@
             <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/116">#116</a></td>
           </tr>
           <tr>
-            <td class="col-context">UGreen Revodok 9-in-1 USB-C hub cable, Amazon France</td>
+            <td class="col-context">UGreen USB-C hub bundled cable: Revodok 9-in-1 (Amazon France) and CM818-45363 (JD.com)</td>
             <td class="col-vid"><code>0x0000</code></td>
             <td class="col-pid"><code>0x0000</code></td>
             <td class="col-cable-vdo"><code>0x00084841</code></td>
@@ -650,7 +662,7 @@
             <td class="col-speed">USB 3.2 Gen 1 (5 Gbps)</td>
             <td class="col-power">5 A / 20 V (100 W)</td>
             <td class="col-type">passive</td>
-            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/126">#126</a></td>
+            <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/126">#126</a>, <a href="https://github.com/darrylmorley/whatcable/issues/574">#574</a>, <a href="https://github.com/darrylmorley/whatcable/issues/616">#616</a></td>
           </tr>
           <tr>
             <td class="col-context">Vorodcip generic USB-C cable, Amazon Italy (VID/PID zeroed)</td>
@@ -809,7 +821,7 @@
             <td class="col-source"><a href="https://github.com/darrylmorley/whatcable/issues/214">#214</a></td>
           </tr>
           <tr>
-            <td class="col-context">Maxonar TH33 TB4 cable, Amazon</td>
+            <td class="col-context">Maxonar TH33 TB4 cable, Amazon; also MOVE SPEED (移速), Pinduoduo</td>
             <td class="col-vid"><code>0x0000</code></td>
             <td class="col-pid"><code>0x0000</code></td>
             <td class="col-cable-vdo"><code>0x000A4643</code></td>
@@ -818,7 +830,7 @@
             <td class="col-speed">USB4 Ge
```

---

### Incident Patch 5: `b5b28199` (2026-09-23)
**Commit Message**: Mirror from private (b4dfb15a)

**File**: `Tests/WhatCableCoreTests/CableCertLookupTests.swift` (modified, +33/-3)
```diff
@@ -41,9 +41,39 @@ struct CableCertLookupTests {
 
     @Test("The database loaded a substantial cert set")
     func certSetLoaded() {
-        // ~1,090 XIDs at build time. A large floor catches a DB that shipped
-        // without the cable_certs table (which fails soft to zero).
-        #expect(CableDB.certXIDCount >= 800)
+        // 1,124 distinct XIDs in the db committed on this branch; a fresh
+        // rebuild on 2026-09-23 produced 1,129. The floor was 800, which was useless: on
+        // 2026-09-22 the USB-IF bulk feed stopped listing StarTech and ON
+        // Semiconductor, a clean rebuild dropped 87 XIDs, and the 1,042 left
+        // is still comfortably over 800, so this test stayed green through
+        // the whole incident. 1,100 fails on that loss while leaving room for
+        // ordinary registry churn before it cries wolf. Same idea as
+        // corpusCoverageIsMeaningful below: put the floor above the broken
+        // state, not just above zero.
+        #expect(CableDB.certXIDCount >= 1100)
+    }
+
+    // Two of the 87 XIDs recovered by data/cert-xids.tsv, one per affected
+    // vendor. The count floor above catches a mass loss; these catch a
+    // narrower one, e.g. the seed file being dropped, renamed, or read as
+    // empty because a single byte in it stopped being valid UTF-8. Both are
+    // absent from the USB-IF bulk catalogue and resolve only because the
+    // build seeds them, so either one going empty means the seed path broke.
+    private static let starTechSeededXID: UInt32 = 0x0000_1C46
+    private static let onSemiSeededXID: UInt32 = 0x0000_17AE
+
+    @Test("A seeded StarTech XID the bulk catalogue no longer lists still resolves")
+    func seededStarTechXIDResolves() {
+        let certs = CableDB.certifications(forXID: Self.starTechSeededXID)
+        #expect(!certs.isEmpty)
+        #expect(certs.contains { $0.company == "StarTech.com Ltd." })
+    }
+
+    @Test("A seeded ON Semiconductor XID the bulk catalogue no longer lists still resolves")
+    func seededOnSemiXIDResolves() {
+        let certs = CableDB.certifications(forXID: Self.onSemiSeededXID)
+        #expect(!certs.isEmpty)
+        #expect(certs.contains { $0.company == "ON Semiconductor" })
     }
 
     @Test("A certified cable resolves, with its listings and vendor id")
```

**File**: `data/cert-xids.tsv` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+# Certification IDs to always resolve.
+#
+# The build works out which USB-IF certification IDs to look up from three
+# places: the USB-IF bulk catalogue, the cert IDs on our own cable rows, and
+# the probe corpus. None of those is complete. The bulk feed in particular
+# carries whole vendors one month and not the next, and the per-XID endpoint
+# still answers for IDs the feed has stopped listing.
+#
+# Without this file those listings vanish from whatcable.db on the next clean
+# rebuild, silently, because the build simply never asks about them. That
+# happened on 2026-09-22: 87 IDs, 92 listings, every one still live at USB-IF.
+#
+# Format, three tab-separated fields, all three required:
+#   1. certification ID (hex, 0x prefix optional)
+#   2. certification date, as "2019-01-25T00:00:00", or empty
+#   3. a note for humans; not used by the build
+#
+# The date is here because the per-XID endpoint does not return one. The date
+# only ever came from a bulk-catalogue row, and these IDs are exactly the ones
+# the bulk feed has stopped listing, so without it the recovered listings come
+# back dateless. The build uses it only when the bulk feed offers nothing for
+# that ID: a date the catalogue does supply always wins.
+#
+# An empty date field is valid and means USB-IF publishes no date for that ID.
+# Five of the entries below are like that. Leave them empty; never invent one.
+#
+# A line with any other number of fields is skipped with a warning.
+#
+# Same idea as data/manual-vendors.tsv: a tracked input for what the
+# automated sources miss, so a clean rebuild stays reproducible.
+0x17AE	2019-01-25T00:00:00	ON Semiconductor: FUSB380
+0x17BC	2019-08-26T00:00:00	ON Semiconductor: FUSB380C
+0x17BD	2022-09-01T00:00:00	ON Semiconductor: FUSB15201DV
+0x17C0	2023-06-01T00:00:00	ON Semiconductor: FUSB15101
+0x17D0	2024-02-08T00:00:00	ON Semiconductor: FUSB15200
+0x1C46	2017-11-28T00:00:00	StarTech.com Ltd.: USB31CC1M
+0x1C47	2017-11-28T00:00:00	StarTech.com Ltd.: USB31C5C1M
+0x1C48	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C2M
+0x1C49	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C50CM
+0x1C4A	2018-03-09T00:00:00	StarTech.com Ltd.: PN:USB2C5C1M
+0x1C4B	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C3M
+0x1C4C	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C2MW
+0x1C4D	2018-03-15T00:00:00	StarTech.com Ltd.: USB315C5C6
+0x1C4E	2018-06-13T00:00:00	StarTech.com Ltd.: USB2C5C4MW
+0x1C4F	2019-12-09T00:00:00	StarTech.com Ltd.: DCH1C3A
+0x1C50	2019-12-10T00:00:00	StarTech.com Ltd.: WCH1C602
+0x1C51	2022-06-27T00:00:00	StarTech.com Ltd.: CC1M-40G-USB-CABLE
+0x1C52	2024-02-08T00:00:00	StarTech.com Ltd.: 1M-40G-USB4-CABLE
+0x1C53		StarTech.com Ltd.: 50C-40G-USB4-CABLE, USB2EPR1M
+0x1C54	2023-10-17T00:00:00	StarTech.com Ltd.: USB2EPR2M
+0x1C55	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR3M
+0x1C56	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR4M
+0x1C57	2023-12-15T00:00:00	StarTech.com Ltd.: USB2EPR3F
+0x1C58	2023-12-15T00:00:00	StarTech.com Ltd.: USB2EPR6F
+0x2A89		ON Semiconductor: 35468851, FUSB15201
+0x33F1	2025-11-11T00:00:00	StarTech.com Ltd.: CC3M20GUSB4CX
+0x33F2	2025-12-16T00:00:00	StarTech.com Ltd.: CC3M20GUSB4CXW
+0x33F3	2025-12-15T00:00:00	StarTech.com Ltd.: CC10FT20GUSB4CX
+0x33F4	2026-01-20T00:00:00	StarTech.com Ltd.: CC10FT20GUSB4CXW
+0x33F5	2025-11-11T00:00:00	StarTech.com Ltd.: S2CEPR3FW-USB-CABLE
+0x33F6	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR10F
+0x33F7	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR13F
+0x33F8	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR3FW
+0x33F9	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR1MW
+0x33FA	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR6FW
+0x33FB	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR2MW
+0x33FC	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR10FW
+0x33FD	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR3MW
+0x33FE	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR13FW
+0x33FF	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR4MW
+0x3400		StarTech.com Ltd.: 1014GCN-WALL-CHARGER
+0x3403	2024-11-22T00:00:00	StarTech.com Ltd.: S2CEPR2M-USBSL-CABLE
+0x3404	2024-11-22T00:00:00	StarTech.com Ltd.: S2CEPR3M-USBSL-CABLE
+0x3405	2025-02-25T00:00:00	StarTech.com Ltd.: S2CEPR3F-USB-CABLE
+0x3406	2025-02-25T00:00:00	StarTech.com Ltd.: S2CEPR6F-USB-CABLE
+0x3407	2025-01-09T00:00:00	StarTech.com Ltd.: S2CEPR10F-USB-CABLE
+0x3408	2025-02-25T00:00:00	StarTech.com Ltd.: S2CEPR1M-USB-CABLE
+0x3409	2025-01-08T00:00:00	StarTech.com Ltd.: S2CEPR2M-USB-CABLE
+0x340A	2025-02-25T00:00:00	StarTech.com Ltd.: S2CEPR3M-USB-CABLE
+0x340B	2025-06-04T00:00:00	StarTech.com Ltd.: USB315C5C6
+0x340C	2026-01-15T00:00:00	StarTech.com Ltd.: USB315CCV2M
+0x340D	2025-07-17T00:00:00	StarTech.com Ltd.: USB31CCV1M
+0x340E	2025-10-08T00:00:00	StarTech.com Ltd.: USB31CCV50CM
+0x340F	2025-10-23T00:00:00	StarTech.com Ltd.: CC18IN80GUSB4CABLE
+0x3410	2025-11-21T00:00:00	StarTech.com Ltd.: CC18IN80GUSB4CABLEW
+0x3411	2025-10-22T00:00:00	StarTech.com Ltd.: CC50CM80GUSB4CABLE
+0x3412	2025-
```

**File**: `scripts/build-cable-db.swift` (modified, +557/-44)
```diff
@@ -17,10 +17,24 @@
 //   --refresh-certs   refetch every USB-IF per-XID record instead of reusing
 //                     the .cert-cache (picks up cables that changed, e.g.
 //                     Pass -> Obsolete, or gained listings).
-//   --test-parser     run the manual-vendors parser self-tests and exit.
+//   --test-parser     run the parser self-tests (manual vendors, contact-email
+//                     stripping, known cables, cert-xids.tsv, the seeded
+//                     cert-date fallback and per-XID response validation)
+//                     and exit.
 // Env:
 //   ALLOW_EMPTY_CERTS=1   permit a build with zero certifications (otherwise a
 //                         collapsed cert table fails the build; see below).
+//                         Also overrides a failed per-XID certification fetch
+//                         (exit 6): with this set, a failed fetch is a
+//                         warning, not a build failure.
+//   WC_FAIL_CERT_FETCH    test hook: comma-separated XIDs, decimal or hex
+//                         with a 0x prefix (e.g. 7238 or 0x1C46). Forces
+//                         fetchPerXIDListings to fail (return nil) for those
+//                         XIDs, before it checks the cache, no network
+//                         involved. Lets the exit(6) failed-build path be
+//                         exercised in a real build. Does nothing when unset
+//                         or empty. A token it cannot parse is reported on
+//                         stderr and ignored; empty tokens are ignored.
 //
 // Requires: macOS (uses system SQLite3 via libsqlite3).
 
@@ -32,6 +46,7 @@ import SQLite3
 let repoRoot = FileManager.default.currentDirectoryPath
 let vendorTSV = "\(repoRoot)/Sources/WhatCableCore/Resources/usbif-vendors.tsv"
 let manualVendorTSV = "\(repoRoot)/data/manual-vendors.tsv"
+let certXIDsTSV = "\(repoRoot)/data/cert-xids.tsv"
 let dbOutput = "\(repoRoot)/Sources/WhatCableCore/Resources/whatcable.db"
 let dbWebCopy = "\(repoRoot)/docs/whatcable.db"
 let cablesJSON = "\(repoRoot)/docs/cables.json"
@@ -55,6 +70,35 @@ let certCacheDir = "\(repoRoot)/.cert-cache"
 // reused indefinitely. A successful refetch overwrites its cache entry.
 let refreshCerts = CommandLine.arguments.contains("--refresh-certs")
 
+// Test hook (see WC_FAIL_CERT_FETCH in the header comment): forces
+// fetchPerXIDListings to fail for these XIDs, so the exit(6) failed-build
+// path can be watched firing in a real build without a network fetch and
+// without waiting for a cold per-XID crawl. Empty when unset, which does
+// nothing.
+// Tokens may be decimal or 0x-prefixed hex, because XIDs are written in hex
+// everywhere else and a silently dropped `0x1C46` would make the guard look
+// broken. A token that parses as neither gets a stderr warning.
+let forcedCertFetchFailures: Set<Int> = {
+    var out: Set<Int> = []
+    let raw = ProcessInfo.processInfo.environment["WC_FAIL_CERT_FETCH"] ?? ""
+    for piece in raw.split(separator: ",") {
+        let token = piece.trimmingCharacters(in: .whitespaces)
+        if token.isEmpty { continue }
+        let value: Int?
+        if token.hasPrefix("0x") || token.hasPrefix("0X") {
+            value = Int(token.dropFirst(2), radix: 16)
+        } else {
+            value = Int(token)
+        }
+        if let value {
+            out.insert(value)
+        } else {
+            fputs("warn: WC_FAIL_CERT_FETCH: cannot parse XID token '\(token)', ignoring it\n", stderr)
+        }
+    }
+    return out
+}()
+
 // MARK: - SQLite helpers
 
 var db: OpaquePointer?
@@ -418,6 +462,108 @@ func importManualVendors() -> (inserted: Int, skipped: Int) {
     return (inserted, skipped)
 }
 
+// MARK: - Manual certification-ID seed (data/cert-xids.tsv)
+
+struct ManualCertXID: Equatable {
+    let xid: Int
+    /// Certification date for this XID, in the same format the cable_certs
+    /// column holds ("2019-01-25T00:00:00"), or "" when USB-IF never
+    /// published one. Seeded here because the per-XID endpoint does not
+    /// return a date and these XIDs are no longer in the bulk catalogue.
+    let certDate: String
+    let note: String
+}
+
+/// Pure parser for cert-xids.tsv. Returns parsed entries plus any warnings
+/// the build script should print. Side-effect free so `--test-parser` can
+/// exercise it directly.
+///
+/// Validation rules, deliberately the same shape as the manual-vendors
+/// parser:
+/// - Comment lines (starting with `#`) and blank lines are ignored.
+/// - Each data line must have exactly 3 tab-separated fields:
+///   XID, certification date, note.
+/// - XID must be hex (with or without `0x`/`0X` prefix) and non-zero. Zero
+///   is the "no certification" sentinel, never a real ID.
+/// - The certification date may be empty: USB-IF genuinely publishes no date
+///   for some listings, and an invented one would be worse than none.
+/// - The note must be non-empty; it is for humans and the build ignores it.
+
```

---

### Incident Patch 6: `2348b90a` (2026-09-22)
**Commit Message**: Mirror from private (c4d0ae1c)

**File**: `Sources/WhatCableCore/Output/PortSummary.swift` (modified, +15/-3)
```diff
@@ -916,12 +916,24 @@ extension PortSummary {
                 : String(localized: "Carrying both data and DisplayPort video.", bundle: _coreLocalizedBundle)
         } else if hasDP {
             self.status = .displayCable
+            // A port can carry a working display while macOS withholds its data
+            // transports. Before this branch consulted `dataWithheld` the card
+            // said only "Display connected", so the one fact the user cannot see
+            // for themselves, that their accessory is waiting for approval, was
+            // never stated (#681, m4pro_macos26.6.2_m port 1). The branch above
+            // already handles the same pair; this mirrors it.
             if let w = chargerW {
-                self.headline = String(localized: "Display connected · \(w)W charger", bundle: _coreLocalizedBundle) + cableLimitSuffix
+                self.headline = (dataWithheld
+                    ? String(localized: "Display connected, data blocked · \(w)W charger", bundle: _coreLocalizedBundle)
+                    : String(localized: "Display connected · \(w)W charger", bundle: _coreLocalizedBundle)) + cableLimitSuffix
             } else {
-                self.headline = String(localized: "Display connected", bundle: _coreLocalizedBundle) + cableLimitSuffix
+                self.headline = (dataWithheld
+                    ? String(localized: "Display connected, data blocked", bundle: _coreLocalizedBundle)
+                    : String(localized: "Display connected", bundle: _coreLocalizedBundle)) + cableLimitSuffix
             }
-            self.subtitle = String(localized: "DisplayPort video over USB-C Alt Mode.", bundle: _coreLocalizedBundle)
+            self.subtitle = dataWithheld
+                ? String(localized: "Video is working. macOS is holding data back until you approve the accessory.", bundle: _coreLocalizedBundle)
+                : String(localized: "DisplayPort video over USB-C Alt Mode.", bundle: _coreLocalizedBundle)
         } else if hasCorroboratedUSB3 {
             self.status = .dataDevice
             if let w = chargerW {
```

**File**: `Sources/WhatCableCore/Resources/de.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Aktuelle Aushandlung: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Display verbunden";
 "Display connected · %lldW charger" = "Display verbunden · %lld-W-Ladegerät";
+"Display connected, data blocked" = "Display verbunden, Daten blockiert";
+"Display connected, data blocked · %lldW charger" = "Display verbunden, Daten blockiert · %lld-W-Ladegerät";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort-Video über USB-C-Alt-Mode.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "e-Marker meldet EPR-Unterstützung, aber nur max. 20 V VBUS";
 "E-marker reports no vendor identity" = "e-Marker meldet keine Herstelleridentität";
```

**File**: `Sources/WhatCableCore/Resources/en.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Currently negotiated: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Display connected";
 "Display connected · %lldW charger" = "Display connected · %lldW charger";
+"Display connected, data blocked" = "Display connected, data blocked";
+"Display connected, data blocked · %lldW charger" = "Display connected, data blocked · %lldW charger";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort video over USB-C Alt Mode.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "E-marker claims EPR support but reports only 20V max VBUS";
 "E-marker reports no vendor identity" = "E-marker reports no vendor identity";
```

**File**: `Sources/WhatCableCore/Resources/es.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Negociación actual: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Pantalla conectada";
 "Display connected · %lldW charger" = "Pantalla conectada · cargador de %lld W";
+"Display connected, data blocked" = "Pantalla conectada, datos bloqueados";
+"Display connected, data blocked · %lldW charger" = "Pantalla conectada, datos bloqueados · cargador de %lld W";
 "DisplayPort video over USB-C Alt Mode." = "Vídeo DisplayPort a través de modo alternativo USB-C.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "El e-marker anuncia soporte EPR pero reporta solo 20 V máx. VBUS";
 "E-marker reports no vendor identity" = "El e-marker no reporta identidad de fabricante";
```

**File**: `Sources/WhatCableCore/Resources/fr.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Négociation actuelle : %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Écran connecté";
 "Display connected · %lldW charger" = "Écran connecté · chargeur %lld W";
+"Display connected, data blocked" = "Écran connecté, données bloquées";
+"Display connected, data blocked · %lldW charger" = "Écran connecté, données bloquées · chargeur %lld W";
 "DisplayPort video over USB-C Alt Mode." = "Vidéo DisplayPort en mode alternatif USB-C.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "L'e-marker annonce le support EPR mais ne signale que 20 V max VBUS";
 "E-marker reports no vendor identity" = "L'e-marker ne signale aucune identité fabricant";
```

**File**: `Sources/WhatCableCore/Resources/hi.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "वर्तमान नेगोशिएशन: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "डिस्प्ले कनेक्टेड";
 "Display connected · %lldW charger" = "डिस्प्ले कनेक्टेड · %lld W चार्जर";
+"Display connected, data blocked" = "डिस्प्ले कनेक्टेड, डेटा अवरुद्ध";
+"Display connected, data blocked · %lldW charger" = "डिस्प्ले कनेक्टेड, डेटा अवरुद्ध · %lld W चार्जर";
 "DisplayPort video over USB-C Alt Mode." = "USB-C ऑल्ट मोड पर DisplayPort वीडियो।";
 "E-marker claims EPR support but reports only 20V max VBUS" = "e-marker EPR सपोर्ट बताता है लेकिन अधिकतम 20 V VBUS रिपोर्ट करता है";
 "E-marker reports no vendor identity" = "e-marker कोई वेंडर पहचान रिपोर्ट नहीं करता";
```

**File**: `Sources/WhatCableCore/Resources/hy.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Ներկայումս համաձայնեցված է՝ %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Էկրանը միացված է";
 "Display connected · %lldW charger" = "Էկրանը միացված է · %lldW լիցքավորիչ";
+"Display connected, data blocked" = "Էկրանը միացված է, տվյալները արգելափակված են";
+"Display connected, data blocked · %lldW charger" = "Էկրանը միացված է, տվյալները արգելափակված են · %lldW լիցքավորիչ";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort տեսանյութ USB-C alt ռեժիմով:";
 "E-marker claims EPR support but reports only 20V max VBUS" = "E-marker-ը հայտնում է EPR աջակցության մասին, բայց հաղորդում է միայն 20Վ առավելագույն VBUS";
 "E-marker reports no vendor identity" = "E-marker-ը չի հայտնում արտադրողի ինքնությունը";
```

**File**: `Sources/WhatCableCore/Resources/it.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Attualmente negoziati: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Schermo connesso";
 "Display connected · %lldW charger" = "Schermo connesso · caricatore %lldW";
+"Display connected, data blocked" = "Schermo connesso, dati bloccati";
+"Display connected, data blocked · %lldW charger" = "Schermo connesso, dati bloccati · caricatore %lldW";
 "DisplayPort video over USB-C Alt Mode." = "Video DisplayPort su modalità alternativa USB-C.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "L'e-marker dichiara il supporto EPR ma riporta solo VBUS max 20 V";
 "E-marker reports no vendor identity" = "L'e-marker non riporta l'identità del produttore";
```

---

### Incident Patch 7: `85871067` (2026-09-22)
**Commit Message**: Mirror from private (5fe6613f)

**File**: `README.md` (modified, +4/-0)
```diff
@@ -310,6 +310,10 @@ More device data means better hardware coverage, fewer edge-case bugs, and more
 
 Cable reports are also very welcome. If you have an e-marked cable, use the "Report this cable" button in the app (or `whatcable --report` from the CLI) to submit its fingerprint. These reports build the bundled cable database so WhatCable can show brand and model info for known cables. Every report you submit helps other users identify their cables at a glance.
 
+### Research references
+
+Some comments and docs cite files under `research/` (for example `research/displays/display-node-keys.md`). That folder is my private research library, built from raw diagnostic dumps off real machines, and it is not part of this repo. The references stay so each decision names its evidence, even where you cannot open it.
+
 ## Credits
 
 Built by [Darryl Morley](https://github.com/darrylmorley).
```

---

### Incident Patch 8: `ba1728ff` (2026-09-22)
**Commit Message**: Mirror from private (bcf336a7)

**File**: `Sources/WhatCableCore/Resources/lv.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -407,7 +407,7 @@
 "No problems seen while watching this cable." = "Vērojot šo kabeli, problēmas netika konstatētas.";
 "Saw a brief drop or a single high reading. Not conclusive; still watching." = "Konstatēts īslaicīgs kritums vai atsevišķs augsts rādījums. Secinājums nav viennozīmīgs; novērošana turpinās.";
 "Not performing as expected" = "Nedarbojas, kā paredzēts";
-"Isn't performing as expected" = "nedarbojas, kā paredzēts";
+"Isn't performing as expected" = "Nedarbojas, kā paredzēts";
 
 /* Power Monitor system power source indicator. */
 "Battery" = "Akumulators";
```

**File**: `scripts/check-localisation.py` (modified, +4/-10)
```diff
@@ -414,15 +414,10 @@
             "USB4 Gen 4 (80 Gbps)", "Variable, %@ to %@ @ %@", "WhatCable Pro",
         },
         "lv": {
-            "%lld displays connected", "%lld × %lld", "1-5 mW", "3 A", "5 A", "5-10 mW",
-            "50-200 µW", "< 50 µW", "> 10 mW", "Battery full, not drawing power",
-            "Built-in %1$@ port %2$lld",
-            "High-resolution displays often use compression (DSC) to fit their top mode through a link like this, so selecting the higher mode in Display settings may reach it normally.",
-            "CC Advertisement", "Isn't performing as expected", "Licence…", "MagSafe 3",
+            "%lld × %lld", "1-5 mW", "3 A", "5 A", "5-10 mW",
+            "50-200 µW", "< 50 µW", "> 10 mW",
+            "CC Advertisement", "Licence…", "MagSafe 3",
             "Raw VDOs", "Raw cable VDOs", "Re-driver", "Re-timer",
-            "No problems seen while watching this cable.", "Not performing as expected",
-            "Performing as expected",
-            "Saw a brief drop or a single high reading. Not conclusive; still watching.",
             "Thunderbolt", "Thunderbolt / USB4", "USB 2.0 (480 Mbps)",
             "USB 3.2 Gen 1 (5 Gbps)", "USB 3.2 Gen 2 (10 Gbps)", "USB4 Gen 3 (20 / 40 Gbps)",
             "USB4 Gen 4 (80 Gbps)", "Video", "WhatCable Pro", "video",
@@ -603,8 +598,7 @@
             "Gen 1", "Pro", "SuperSpeed", "USB",
         },
         "lv": {
-            "%lld displays connected", "Built-in %1$@ port %2$lld", "Display connected", "Pro",
-            "SuperSpeed", "USB",
+            "Pro", "SuperSpeed", "USB",
         },
         "nb": {
             "%lld displays connected", "Built-in %1$@ port %2$lld", "Display connected",
```

#### Recent Merged Pull Requests:
- **PR #620** (2026-09-22): Update Localizable.strings (@bovirus)
- **PR #617** (closed): Update Localizable.strings (@bovirus)
- **PR #614** (2026-09-22): Update Latvian (lv) translation (@shpokas)
- **PR #613** (closed): Update Localizable.strings (@bovirus)
- **PR #612** (2026-09-22): Traditional Chinese language update (@jimmyorz)
- **PR #608** (2026-09-11): Update Localizable.strings (@bovirus)
- **PR #606** (closed): Update Italian language (@bovirus)
- **PR #605** (2026-09-11): Traditional Chinese language update (@jimmyorz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
