# Forensic Learning Record (Deep Inspection): Planetable/Planet

> **Canonical Artifact**: `07_PROJECT_LEARNING/planetable-planet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Planetable/Planet](https://github.com/Planetable/Planet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:52:32.299Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Planetable/Planet`
- **Description**: Build and host decentralized blogs and websites on your Mac
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1809 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Planet/Helper/ENSUtils.swift`
```
import Foundation
import os

struct ENSUtils {
    static func isIPNS(_ str: String) -> Bool {
        if !str.hasPrefix("k") {
            return false
        }
        if str.hasPrefix("k51") && str.count == 62 {
            return true
        }
        if str.hasPrefix("k2") && str.count == 56 {
            return true
        }
        return false
    }

    static func getCID(from contenthash: URL) async throws -> String? {
        if contenthash.scheme?.lowercased() == "ipns" {
            let ipns = String(contenthash.absoluteString.dropFirst("ipns://".count))
            return try await IPFSDaemon.shared.resolveIPNSorDNSLink(name: ipns)
        } else if contenthash.scheme?.lowercased() == "ipfs" {
            return String(contenthash.absoluteString.dropFirst("ipfs://".count))
        }
        // unsupported contenthash scheme
        return nil
    }
}

```

### Core Architecture Module: `Planet/Helper/FeedUtils.swift`
```
import AppKit
import Foundation
import FeedKit
import SwiftSoup

struct AvailableFeed: Codable {
    let url: String
    let mime: String
}

struct FeedDiscoveryResult {
    let feedData: Data?
    let feedURL: URL?
    let htmlDocument: Document?
    let htmlURL: URL?
}

struct FeedUtils {
    private struct HTMLAvatarCandidate: Sendable {
        let url: URL
        let source: String
        let sourceRank: Int
    }

    private struct DownloadedHTMLAvatarCandidate: Sendable {
        let candidate: HTMLAvatarCandidate
        let data: Data
    }

    private struct AvatarDownloadTimeoutError: Error {}

    private static let htmlAvatarDownloadTimeout: TimeInterval = 2.0
    private static let maxHTMLAvatarCandidates = 12

    static func isFeed(mime: String) -> Bool {
        mime.contains("application/xml")
            || mime.contains("text/xml")
            || mime.contains("application/atom+xml")
            || mime.contains("application/rss+xml")
            || mime.contains("application/json")
            || mime.contains("application/feed+json")
    }

    static func getHTMLDocument(url: URL) async throws -> Document? {
        guard let (data, _) = try? await URLSession.shared.data(from: url)
        else {
            return nil
        }
        guard let htmlString = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return try? SwiftSoup.parse(htmlString)
    }

    // TODO: Make an UI for this choice
    static func selectBestFeed(_ feeds: [AvailableFeed]) -> AvailableFeed? {
        if feeds.count == 1 {
            if let feed = feeds.first {
                return feed
            }
        }
        for feed in feeds {
            if feed.mime.contains("json") {
                return feed
            }
        }
        if let feed = feeds.first {
            return feed
        }
        return nil
    }

    static func findFeed(url: URL) async throws -> FeedDiscoveryResult {
        guard let (data, response) = try? await URLSession.shared.data(from: url) else {
            throw PlanetError.NetworkError
        }
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.ok,
              let mime = httpResponse.mimeType?.lowercased()
        else {
            return FeedDiscoveryResult(
                feedData: nil,
                feedURL: nil,
                htmlDocument: nil,
                htmlURL: nil
            )
        }
        if isFeed(mime: mime) {
            return FeedDiscoveryResult(
                feedData: data,
                feedURL: url,
                htmlDocument: nil,
                htmlURL: nil
            )
        }
        if mime.contains("text/html") {
            // parse HTML and find <link rel="alternate">
            guard let homepageHTML = String(data: data, encoding: .utf8),
                  let soup = try? SwiftSoup.parse(homepageHTML)
            else {
                return FeedDiscoveryResult(
                    feedData: nil,
                    feedURL: nil,
                    htmlDocument: nil,
                    htmlURL: nil
                )
            }
            let availableFeeds = try soup.select("link[rel=alternate]")
                .compactMap { elem in
                    let mime = try? elem.attr("type")
                    let href = try? elem.attr("href")
                    if let mime = mime, let href = href, isFeed(mime: mime) {
                        let availableFeedURLString = URL(string: href, relativeTo: url)?.absoluteString
                        if let urlString = availableFeedURLString {
                            return AvailableFeed(url: urlString, mime: mime)
                        }
                    }
                    return nil
                }
            debugPrint("FeedUtils: availableFeeds: \(availableFeeds)")
            if availableFeeds.count == 0 {
                return FeedDiscoveryResult(
                    feedData: nil,
                    feedURL: nil,
                    htmlDocument: soup,
                    htmlURL: url
                )
            }
            guard let bestFeed = selectBestFeed(availableFeeds) else {
                return FeedDiscoveryResult(
                    feedData: nil,
                    feedURL: nil,
                    htmlDocument: soup,
                    htmlURL: url
                )
            }
            debugPrint("FeedUtils: proceeds with the selection: \(bestFeed)")
            guard let feedURL = URL(string: bestFeed.url) else {
                return FeedDiscoveryResult(
                    feedData: nil,
                    feedURL: nil,
                    htmlDocument: soup,
                    htmlURL: url
                )
            }
            // fetch feed
            guard let (data, response) = try? await URLSession.shared.data(from: feedURL) else {
                throw PlanetError.NetworkError
            }
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.ok
            else {
                return FeedDiscoveryResult(
                    feedData: nil,
                    feedURL: nil,
                    htmlDocument: soup,
                    htmlURL: url
                )
            }
            return FeedDiscoveryResult(
                feedData: data,
                feedURL: feedURL,
                htmlDocument: soup,
                htmlURL: url
            )
        }
        // unknown HTTP response
        return FeedDiscoveryResult(
            feedData: nil,
            feedURL: nil,
            htmlDocument: nil,
            htmlURL: nil
        )
    }

    static func findAvatarFromHTMLImages(htmlDocument: Document, htmlURL: URL) async throws -> Data? {
        let candidates = try htmlAvatarCandidates(htmlDocument: htmlDocument, htmlURL: htmlURL)
        guard !candidates.isEmpty else {
            return nil
        }

        let downloads = await downloadHTMLAvatarCandidates(candidates)
        guard let bestDownload = downloads.max(by: { lhs, rhs in
            if lhs.data.count == rhs.data.count {
                return lhs.candidate.sourceRank < rhs.candidate.sourceRank
            }
            return lhs.data.count < rhs.data.count
        })
        else {
            return nil
        }

        debugPrint(
            "FeedAvatar: selected \(bestDownload.candidate.source) at \(bestDownload.candidate.url.absoluteString) (\(bestDownload.data.count) bytes)"
        )
        return bestDownload.data
    }

    private static func htmlAvatarCandidates(htmlDocument: Document, htmlURL: URL) throws -> [HTMLAvatarCandidate] {
        var candidates: [HTMLAvatarCandidate] = []

        for elem in try htmlDocument.select("meta[content]").array() {
            guard let content = try? elem.attr("content"),
                  let avatarURL = avatarURL(from: content, relativeTo: htmlURL)
            else {
                continue
            }

            let property = (try? elem.attr("property").lowercased()) ?? ""
            let name = (try? elem.attr("name").lowercased()) ?? ""
            let itemprop = (try? elem.attr("itemprop").lowercased()) ?? ""
            let itempropTokens = itemprop.split(separator: " ").map(String.init)

            if property == "og:image" {
                candidates.append(HTMLAvatarCandidate(url: avatarURL, source: "og:image", sourceRank: 4000))
            }
            else if property == "twitter:image" || name == "twitter:image" {
                candidates.append(HTMLAvatarCandidate(url: avatarURL, source: "twitter:image", sourceRank: 3500))
            }
            else if itempropTokens.contains("logo") {
                candidates.append(HTMLAvatarCandidate(url: avatarURL, source: "itemprop=logo", sourceRank: 3000))
            }
        }

        let iconElems = try htmlDocument.select("link[rel][href]").array().filter { elem in
            guard let rel = try? elem.attr("rel").lowercased() else {
                return false
            }
            return rel.contains("icon")
        }

        for elem in iconElems.sorted(by: { elemA, elemB in
            iconScore(for: elemA) > iconScore(for: elemB)
        }) {
            guard let avatarURLString = try? elem.attr("href"),
                  let avatarURL = avatarURL(from: avatarURLString, relativeTo: htmlURL)
            else {
                continue
            }

            let rel = (try? elem.attr("rel")) ?? "icon"
            let sourceRank = min(iconScore(for: elem), 1000)
            candidates.append(HTMLAvatarCandidate(url: avatarURL, source: "link rel=\(rel)", sourceRank: sourceRank))
        }

        var seen: Set<String> = []
        return candidates.filter { candidate in
            seen.insert(candidate.url.absoluteString).inserted
        }
    }

    private static func avatarURL(from string: String, relativeTo htmlURL: URL) -> URL? {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.lowercased().hasPrefix("data:")
        else {
            return nil
        }

        return URL(string: trimmed, relativeTo: htmlURL)?.absoluteURL
    }

    private static func iconScore(for element: Element) -> Int {
        guard let sizes = try? element.attr("sizes").lowercased() else {
            return 0
        }
        if sizes == "any" {
            return Int.max
        }
        let bestSize = sizes
            .split(separator: " ")
            .compactMap { size -> Int? in
                let components = size.split(separator: "x")
                guard let first = components.first else {
                    return nil
                }
                return Int(first)
            }
            .max()
        return bestSize ?? 0
    }

    private static func downloadHTMLAvatarCandidates(_ candidates: [HTMLAvatarCandidate]) async -> [DownloadedHTMLAv
```

### Core Architecture Module: `Planet/Helper/JSONUtils.swift`
```
import Foundation

struct SerializationError: Error {
}

extension Decoder {
    func getContext<T>(key: String) throws -> T {
        let infoKey = CodingUserInfoKey(rawValue: key)!
        if let context = userInfo[infoKey] as? T {
            return context
        }
        throw SerializationError()
    }
}

extension JSONDecoder {
    static let shared = JSONDecoder()

    func setContext<T>(_ context: T, key: String) {
        let infoKey = CodingUserInfoKey(rawValue: key)!
        userInfo[infoKey] = context
    }
}

extension JSONEncoder {
    static let shared: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [
            .sortedKeys,
            .prettyPrinted,
            .withoutEscapingSlashes
        ]
        return encoder
    }()
}

```

### Core Architecture Module: `Planet/Helper/MarkdownUtils.swift`
```
import Foundation
import HTMLEntities
import Stencil
import SwiftSoup
import libcmark_gfm

struct StencilExtension {
    static let escapeJSTable: [Character: String] = {
        var table: [Character: String] = [
            "\\": "\\u005C",
            "'": "\\u0027",
            "\"": "\\u0022",
            ">": "\\u003E",
            "<": "\\u003C",
            "&": "\\u0026",
            "=": "\\u003D",
            "-": "\\u002D",
            ";": "\\u003B",
            "\u{2028}": "\\u2028",
            "\u{2029}": "\\u2029",
        ]
        for i in 0..<32 {
            let char = Character(Unicode.Scalar(i)!)
            let escapedString = String(format: "\\u%04X", i)
            table[char] = escapedString
        }
        return table
    }()

    static let common: Extension = {
        let ext = Extension()
        ext.registerFilter("md2html") { value in
            if let value = value,
                let md = value as? String
            {
                if let html = CMarkRenderer.renderMarkdownHTML(markdown: md) {
                    return html
                }
            }
            return value
        }
        ext.registerFilter("absoluteImageURL") { (value: Any?, arguments: [Any?]) in
            if let input = value as? String,
                let doc = try? SwiftSoup.parseBodyFragment(input)
            {
                let images = try? doc.select("img")
                if let images = images {
                    for image in images {
                        if let src = try? image.attr("src") {
                            if src.hasPrefix("https://") || src.hasPrefix("http://") {
                                continue
                            }
                            else {
                                // Convert relative img src to absolute full URL
                                if let site = arguments.first as? String,
                                    let articleID: UUID = arguments[1] as? UUID
                                {
                                    let prefix = "\(site)/\(articleID.uuidString)/"
                                    debugPrint("prefix: \(prefix)")
                                    let absoluteURL = prefix + src
                                    let _ = try? image.attr("src", absoluteURL)
                                }
                            }
                        }
                    }
                }
                if let output = try? doc.body()?.html() {
                    return output
                }
            }
            return value
        }
        ext.registerFilter("formatDate") { value in
            if let value = value,
                let date = value as? Date
            {
                let format = DateFormatter()
                format.dateStyle = .medium
                format.timeStyle = .medium
                return format.string(from: date)
            }
            return value
        }
        ext.registerFilter("formatDateC") { value in
            if let value = value,
                let date = value as? Date
            {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZZZZZ"
                let formattedDate = formatter.string(from: date)
                return formattedDate
            }
            return value
        }
        ext.registerFilter("ymd") { value in
            if let value = value,
                let date = value as? Date
            {
                let format = DateFormatter()
                format.dateStyle = .medium
                format.timeStyle = .none
                return format.string(from: date)
            }
            return value
        }
        ext.registerFilter("mdyydot") { value in
            if let value = value,
                let date = value as? Date
            {
                let formatter = DateFormatter()
                formatter.dateFormat = "M.d.yy"
                let formattedDate = formatter.string(from: date)
                return formattedDate
            }
            return value
        }
        ext.registerFilter("hhmmss") { value in
            if let value = value,
                let seconds = value as? Int
            {
                let hours = seconds / 3600
                let minutes = (seconds % 3600) / 60
                let seconds = seconds % 60
                return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
            }
            return "00:00:00"
        }
        ext.registerFilter("rfc822") { value in
            if let value = value,
                let date = value as? Date
            {
                let RFC822DateFormatter = DateFormatter()
                RFC822DateFormatter.locale = Locale(identifier: "en_US_POSIX")
                RFC822DateFormatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
                return RFC822DateFormatter.string(from: date)
            }
            return value
        }
        ext.registerFilter("escapejs") { value in
            if let value = value,
                let str = value as? String
            {
                var escapedString = ""
                for char in str {
                    if let escapedChar = escapeJSTable[char] {
                        escapedString.append(escapedChar)
                    }
                    else {
                        escapedString.append(char)
                    }
                }
                return escapedString
            }
            return ""
        }
        ext.registerFilter("escape") { value in
            if let value = value,
                let str = value as? String
            {
                return str.htmlEscape()
            }
            return value
        }
        return ext
    }()
}

struct CMarkRenderer {
    static func replaceYouTubeLinks(_ text: String) -> String {
        let pattern = #"https?:\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?"#

        do {
            let regex = try NSRegularExpression(pattern: pattern, options: [])
            let newText = regex.stringByReplacingMatches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count), withTemplate: "<iframe width=\"100%\" style=\"aspect-ratio: 16/9\" src=\"https://www.youtube.com/embed/$1\" title=\"YouTube Video\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>")
            return newText
        } catch {
            debugPrint("Invalid regex pattern")
            return text
        }
    }

    // Reference: https://github.com/tw93/MiaoYan/blob/master/Mac/Business/Markdown.swift
    static func renderMarkdownHTML(markdown: String) -> String? {
        // Process 1: Replace all YouTube links with embed code
        let inputText: String = CMarkRenderer.replaceYouTubeLinks(markdown)

        cmark_gfm_core_extensions_ensure_registered()

        guard let parser = cmark_parser_new(CMARK_OPT_FOOTNOTES) else { return nil }
        defer { cmark_parser_free(parser) }

        for name in ["table", "autolink", "strikethrough", "tasklist"] {
            if let ext = cmark_find_syntax_extension(name) {
                cmark_parser_attach_syntax_extension(parser, ext)
            }
        }

        cmark_parser_feed(parser, inputText, inputText.utf8.count)

        guard let node = cmark_parser_finish(parser) else { return nil }
        defer { cmark_node_free(node) }

        // use GitHub flavored rules: render line break in <p> as <br>
        // Reference: https://github.com/theacodes/cmarkgfm/blob/master/README.rst#advanced-usage
        guard let htmlBuffer = cmark_render_html(node, CMARK_OPT_UNSAFE | CMARK_OPT_HARDBREAKS, nil) else { return nil }
        defer { free(htmlBuffer) }

        guard let html = String(validatingUTF8: htmlBuffer) else { return nil }
        return html
    }
}

```

### Core Architecture Module: `Planet/Helper/PodcastUtils.swift`
```
//
//  PodcastUtils.swift
//  Planet
//
//  Created by Xin Liu on 10/8/22.
//

import Foundation

struct PodcastUtils {
    static let categories: [String: [String]] = [
        "Arts": [
            "Books",
            "Design",
            "Fashion & Beauty",
            "Food",
            "Performing Arts",
            "Visual Arts"
        ],
        "Business": [
            "Careers",
            "Entrepreneurship",
            "Investing",
            "Management",
            "Marketing",
            "Non-Profit"
        ],
        "Comedy": [
            "Comedy Interviews",
            "Improv",
            "Stand-Up"
        ],
        "Education": [
            "Courses",
            "How To",
            "Language Learning",
            "Self-Improvement"
        ],
        "Fiction": [
            "Comedy Fiction",
            "Drama",
            "Science Fiction"
        ],
        "Government": [
        ],
        "History": [
        ],
        "Health & Fitness": [
            "Alternative Health",
            "Fitness",
            "Medicine",
            "Mental Health",
            "Nutrition",
            "Sexuality"
        ],
        "Kids & Family": [
            "Education for Kids",
            "Parenting",
            "Pets & Animals",
            "Stories for Kids"
        ],
        "Leisure": [
            "Animation & Manga",
            "Automotive",
            "Aviation",
            "Crafts",
            "Games",
            "Hobbies",
            "Home & Garden",
            "Video Games"
        ],
        "Music": [
            "Music Commentary",
            "Music History",
            "Music Interviews"
        ],
        "News": [
            "Business News",
            "Daily News",
            "Entertainment News",
            "News Commentary",
            "Politics",
            "Sports News",
            "Tech News"
        ],
        "Religion & Spirituality": [
            "Buddhism",
            "Christianity",
            "Hinduism",
            "Islam",
            "Judaism",
            "Religion",
            "Spirituality"
        ],
        "Science": [
            "Astronomy",
            "Chemistry",
            "Earth Sciences",
            "Life Sciences",
            "Mathematics",
            "Natural Sciences",
            "Nature",
            "Physics",
            "Social Sciences"
        ],
        "Society & Culture": [
            "Documentary",
            "Personal Journals",
            "Philosophy",
            "Places & Travel",
            "Relationships"
        ],
        "Sports": [
            "Baseball",
            "Basketball",
            "Cricket",
            "Fantasy Sports",
            "Football",
            "Golf",
            "Hockey",
            "Rugby",
            "Soccer",
            "Swimming",
            "Tennis",
            "Volleyball",
            "Wilderness",
            "Wrestling"
        ],
        "Technology": [
        ],
        "True Crime": [
        ],
        "TV & Film": [
            "After Shows",
            "Film History",
            "Film Interviews",
            "Film Reviews",
            "TV Reviews"
        ]
    ]
}

```

### Core Architecture Module: `Planet/Helper/URLUtils.swift`
```
//
//  URLUtils.swift
//  Planet
//
//  Created by Shu Lyu on 2022-05-07.
//

import Cocoa
import Foundation
import ImageIO

struct URLUtils {
    private static func userDirectory(_ directory: FileManager.SearchPathDirectory) -> URL {
        do {
            return try FileManager.default.url(
                for: directory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
        }
        catch {
            debugPrint("Failed to resolve user directory \(directory): \(error)")
            return FileManager.default.urls(for: directory, in: .userDomainMask).first
                ?? FileManager.default.temporaryDirectory
        }
    }

    static let applicationSupportPath = userDirectory(.applicationSupportDirectory)

    static let documentsPath = userDirectory(.documentDirectory)

    static let cachesPath = userDirectory(.cachesDirectory)

    static let legacyPlanetsPath = applicationSupportPath.appendingPathComponent(
        "planets",
        isDirectory: true
    )

    static let legacyTemplatesPath = applicationSupportPath.appendingPathComponent(
        "templates",
        isDirectory: true
    )

    static let legacyDraftPath = applicationSupportPath.appendingPathComponent(
        "drafts",
        isDirectory: true
    )

    static func repoPath() -> URL {
        if let libraryLocation = UserDefaults.standard.string(forKey: .settingsLibraryLocation),
            FileManager.default.fileExists(atPath: libraryLocation)
        {
            let libraryURL = URL(fileURLWithPath: libraryLocation)
            let planetURL = libraryURL.appendingPathComponent("Planet", isDirectory: true)
            if FileManager.default.fileExists(atPath: planetURL.path) {
                do {
                    let bookmarkKey = libraryURL.path.md5()
                    if let bookmarkData = UserDefaults.standard.data(forKey: bookmarkKey) {
                        var isStale = false
                        let url = try URL(
                            resolvingBookmarkData: bookmarkData,
                            options: .withSecurityScope,
                            relativeTo: nil,
                            bookmarkDataIsStale: &isStale
                        )
                        if isStale {
                            let updatedBookmarkData = try url.bookmarkData(
                                options: .withSecurityScope,
                                includingResourceValuesForKeys: nil,
                                relativeTo: nil
                            )
                            UserDefaults.standard.set(updatedBookmarkData, forKey: bookmarkKey)
                        }
                        if url.startAccessingSecurityScopedResource() {
                            return planetURL
                        }
                        else {
                            UserDefaults.standard.removeObject(forKey: .settingsLibraryLocation)
                            debugPrint(
                                "failed to start accessing security scoped resource, abort & restore to default."
                            )
                        }
                    }
                }
                catch {
                    UserDefaults.standard.removeObject(forKey: .settingsLibraryLocation)
                    debugPrint(
                        "failed to get planet library location: \(error), restore to default."
                    )
                }
            }
            else {
                UserDefaults.standard.removeObject(forKey: .settingsLibraryLocation)
            }
        }
        return Self.defaultRepoPath
    }

    static let defaultRepoPath: URL = {
        let url = Self.documentsPath.appendingPathComponent("Planet", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    static let temporaryPath: URL = {
        let url = Self.cachesPath.appendingPathComponent("tmp", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()
}

struct AIEndpointSecurityPolicy {
    private static let allowedInsecureIPv4Ranges: [(network: UInt32, mask: UInt32)] = [
        (network: 0x7F000000, mask: 0xFF000000),
        (network: 0x0A000000, mask: 0xFF000000),
        (network: 0x64000000, mask: 0xFF000000),
        (network: 0xC0A80000, mask: 0xFFFF0000),
    ]

    static let insecureHTTPErrorDescription = L10n(
        "HTTP AI endpoints are only allowed for localhost, 127.0.0.0/8, 10.0.0.0/8, 100.0.0.0/8, and 192.168.0.0/16. Use HTTPS for other hosts."
    )

    static func modelsURL(base: String) throws -> URL {
        try endpointURL(base: base, pathComponents: ["models"])
    }

    static func chatCompletionsURL(base: String) throws -> URL {
        try endpointURL(base: base, pathComponents: ["chat", "completions"])
    }

    private static func endpointURL(base: String, pathComponents: [String]) throws -> URL {
        let trimmedBase = base.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let baseURL = URL(string: trimmedBase) else {
            throw validationError(L10n("Invalid URL"))
        }
        guard let scheme = baseURL.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
            throw validationError(L10n("Invalid URL"))
        }
        guard let host = baseURL.host?.lowercased(), !host.isEmpty else {
            throw validationError(L10n("Invalid URL"))
        }
        if scheme == "http" && !isAllowedInsecureHost(host) {
            throw validationError(insecureHTTPErrorDescription)
        }
        return pathComponents.reduce(baseURL) { partialURL, pathComponent in
            partialURL.appendingPathComponent(pathComponent)
        }
    }

    private static func isAllowedInsecureHost(_ host: String) -> Bool {
        if host == "localhost" {
            return true
        }
        guard let address = ipv4Address(host) else {
            return false
        }
        return allowedInsecureIPv4Ranges.contains { range in
            (address & range.mask) == range.network
        }
    }

    private static func ipv4Address(_ host: String) -> UInt32? {
        let octets = host.split(separator: ".", omittingEmptySubsequences: false)
        guard octets.count == 4 else {
            return nil
        }

        var address: UInt32 = 0
        for octet in octets {
            guard let value = UInt8(String(octet)) else {
                return nil
            }
            address = (address << 8) | UInt32(truncatingIfNeeded: value)
        }
        return address
    }

    private static func validationError(_ description: String) -> NSError {
        NSError(
            domain: "PlanetAIEndpointSecurityPolicy",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: description]
        )
    }
}

extension URL {
    var isHTTP: Bool {
        if let scheme = scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        {
            return true
        }
        return false
    }

    var isImage: Bool {
        let ext = pathExtension.lowercased()
        return ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "svg", "tiff", "bmp"].contains(ext)
    }

    var pathQueryFragment: String {
        var s = path
        if let query = query {
            s += "?\(query)"
        }
        if let fragment = fragment {
            s += "#\(fragment)"
        }
        return s
    }

    var isPlanetLink: Bool {
        let components = URLComponents(url: self, resolvingAgainstBaseURL: false)
        if components?.scheme == "planet" && !isPlanetWindowGroupLink {
            return true
        }
        return false
    }

    var isPlanetWindowGroupLink: Bool {
        let windowGroups: [String] = [
            "planet://Template"
        ]
        return windowGroups.contains(self.absoluteString)
    }

    var asNSImage: NSImage {
        let ext = pathExtension.lowercased()
        if ["jpg", "jpeg", "png", "gif", "tiff", "bmp"].contains(ext),
            let image = NSImage(contentsOf: self)
        {
            return image
        }
        if let rep = NSWorkspace.shared.icon(forFile: self.path)
            .bestRepresentation(
                for: NSRect(x: 0, y: 0, width: 128, height: 128),
                context: nil,
                hints: nil
            )
        {
            let image = NSImage(size: rep.size)
            image.addRepresentation(rep)
            return image
        }
        return NSImage()
    }

    var isJPEG: Bool {
        return pathExtension.lowercased() == "jpg" || pathExtension.lowercased() == "jpeg"
    }

    func removeGPSInfo() {
        do {
            let data = try Data(contentsOf: self)
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return }
            let count = CGImageSourceGetCount(source)
            guard let type = CGImageSourceGetType(source) else { return }
            let mutableData = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(
                mutableData,
                type,
                count,
                nil
            ) else { return }
            for i in 0..<count {
                guard let image = CGImageSourceCreateImageAtIndex(source, i, nil) else { continue }
                let properties =
                    CGImageSourceCopyPropertiesAtIndex(source, i, nil) as? [CFString: Any] ?? [:]
                var newProperties = properties
                newProperties.removeValue(forKey: kCGImagePropertyGPSDictionary)
                // newProperties.removeValue(forKey: kCGImagePropertyExifDictionary)
                // newProperties.removeValue(forKey: kCGImagePropertyTIFFDictionary)
                CGImageDestinationAddImage(destination, imag
```

### Core Architecture Module: `Planet/Helper/ViewUtils.swift`
```
import SwiftUI

extension NSTextField {
    // remove focus glow (blue ring) from text field
    // Reference: https://developer.apple.com/forums/thread/124617
    open override var focusRingType: NSFocusRingType {
        get { .none }
        set {}
    }
}

extension NSImage {
    func getLargestCenterSquare() -> NSRect {
        let width = size.width
        let height = size.height
        let min = min(width, height)
        let x = (width - min) / 2
        let y = (height - min) / 2
        return NSRect(x: x, y: y, width: min, height: min)
    }

    /// Return a circularized NSImage
    func circleCropped() -> NSImage {
        let imageSize = self.size
        let radius = min(imageSize.width, imageSize.height) / 2
        let circlePath = NSBezierPath(
            ovalIn: CGRect(
                x: (imageSize.width - 2 * radius) / 2,
                y: (imageSize.height - 2 * radius) / 2,
                width: 2 * radius,
                height: 2 * radius
            )
        )

        let imageRect = CGRect(origin: .zero, size: imageSize)
        let newImage = NSImage(size: imageSize)

        newImage.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        circlePath.addClip()
        self.draw(at: CGPoint.zero, from: imageRect, operation: .sourceOver, fraction: 1.0)
        newImage.unlockFocus()

        return newImage
    }

    // Resize image reference: https://stackoverflow.com/a/42915296/12861158
    // Crop the largest center square of the image, and shrink if it is bigger than the given size
    // Example when resize with max length of 160:
    // 300x200 -> center square: (50, 0) to (250, 200) -> resize to 160x160
    // 100x120 -> center square: (0, 10) to (100, 110) -> no resize, 100x100
    // TODO: SwiftUI Image has `resizable` and `aspectRatio` modifier, check if these options can resize image for us
    func resizeSquare(maxLength: Int) -> NSImage? {
        let sourceRect = getLargestCenterSquare()
        let resizeLength = min(maxLength, Int(sourceRect.width))
        let resizeSize = NSSize(width: resizeLength, height: resizeLength)
        let targetRect = NSRect(x: 0, y: 0, width: resizeLength, height: resizeLength)

        if let bitmapRep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: resizeLength,
            pixelsHigh: resizeLength,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) {
            bitmapRep.size = resizeSize
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmapRep)
            draw(in: targetRect, from: sourceRect, operation: .copy, fraction: 1.0)
            NSGraphicsContext.restoreGraphicsState()
            let resizedImage = NSImage(size: resizeSize)
            resizedImage.addRepresentation(bitmapRep)
            return resizedImage
        }
        return nil
    }

    var PNGData: Data? {
        if let tiff = tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let png = bitmap.representation(using: .png, properties: [:])
        {
            return png
        }
        return nil
    }

    var JPEGData: Data? {
        if let tiff = tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let jpeg = bitmap.representation(using: .jpeg, properties: [:])
        {
            return jpeg
        }
        return nil
    }

    var temporaryURL: URL? {
        // create name for the image
        let imageName = UUID().uuidString + ".png"
        let imagePath = (NSTemporaryDirectory() as NSString).appendingPathComponent(imageName)

        // convert the UIImage to data
        guard let data = self.PNGData else { return nil }

        // write the image data to the temporary directory
        try? data.write(to: URL(fileURLWithPath: imagePath))

        // return the URL of the image
        return URL(fileURLWithPath: imagePath)
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 08) & 0xFF) / 255,
            blue: Double((hex >> 00) & 0xFF) / 255,
            opacity: alpha
        )
    }

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        self.init(
            .sRGB,
            red: Double((int & 0xFF0000) >> 16) / 255,
            green: Double((int & 0x00FF00) >> 8) / 255,
            blue: Double(int & 0x0000FF) / 255,
            opacity: 1
        )
    }

    func toHexValue() -> String {
        var components: (CGFloat, CGFloat, CGFloat, CGFloat) {
            let c = NSColor(self).usingColorSpace(.deviceRGB)!

            return (c.redComponent, c.greenComponent, c.blueComponent, c.alphaComponent)
        }
        return String(
            format: "#%02X%02X%02X",
            Int(components.0 * 0xFF),
            Int(components.1 * 0xFF),
            Int(components.2 * 0xFF)
        )
    }
}

/// macOS 12's SwiftUI List corrupts its scroll offset when
/// ScrollViewProxy.scrollTo runs while the list content is still settling
/// (initial layout, or a wholesale replacement such as switching to a freshly
/// followed planet). On macOS 13+, `perform` runs the scroll action
/// immediately; on macOS 12 it defers the action until the list content has
/// been stable for `settleDelay`. Only the latest deferred action is kept.
/// Call `noteContentChange` whenever the list content is replaced.
@MainActor
final class ListScrollSettleGate {
    private var lastContentChange = Date()
    private var deferredTask: Task<Void, Never>?
    private let settleDelay: TimeInterval
    private let maxWait: TimeInterval

    init(settleDelay: TimeInterval = 0.6, maxWait: TimeInterval = 5) {
        self.settleDelay = settleDelay
        self.maxWait = maxWait
    }

    func noteContentChange() {
        lastContentChange = Date()
    }

    func perform(_ action: @escaping () -> Void) {
        if #available(macOS 13.0, *) {
            action()
            return
        }
        deferredTask?.cancel()
        deferredTask = Task { @MainActor [weak self] in
            let startedAt = Date()
            while true {
                guard let self, !Task.isCancelled else { return }
                let remaining = self.settleDelay - Date().timeIntervalSince(self.lastContentChange)
                if remaining <= 0 {
                    break
                }
                // Content keeps churning; give up rather than risking a
                // corrupted offset from scrolling mid-layout.
                if Date().timeIntervalSince(startedAt) > self.maxWait {
                    return
                }
                try? await Task.sleep(nanoseconds: UInt64(max(remaining, 0.05) * 1_000_000_000))
            }
            guard !Task.isCancelled else { return }
            action()
        }
    }

    func cancel() {
        deferredTask?.cancel()
        deferredTask = nil
    }
}

enum ViewVisibility: CaseIterable {
    case visible  // view is fully visible
    case invisible  // view is hidden but takes up space
    case gone  // view is fully removed from the view hierarchy
}

extension View {
    @ViewBuilder func visibility(_ visibility: ViewVisibility) -> some View {
        if visibility != .gone {
            if visibility == .visible {
                self
            }
            else {
                hidden()
            }
        }
    }

    @ViewBuilder func onWidthChange(_ action: @escaping (CGFloat) -> Void) -> some View {
        self
            .background(
                GeometryReader { reader in
                    Color.clear
                        .onChange(of: reader.frame(in: .global).width) { newValue in
                            action(newValue)
                        }
                }
            )
    }
}

struct ViewUtils {
    static let presetGradients = [
        Gradient(colors: [Color(hex: 0x88D3FA), Color(hex: 0x4C9FED)]),  // Sky Blue
        Gradient(colors: [Color(hex: 0xFACE76), Color(hex: 0xF5AD67)]),  // Orange
        Gradient(colors: [Color(hex: 0xD8A9F0), Color(hex: 0xCA77E9)]),  // Pink
        Gradient(colors: [Color(hex: 0xF39066), Color(hex: 0xF0636E)]),  // Red
        Gradient(colors: [Color(hex: 0xACDB86), Color(hex: 0x74C771)]),  // Green
        Gradient(colors: [Color(hex: 0x8AB2FB), Color(hex: 0x6469FA)]),  // Violet
        Gradient(colors: [Color(hex: 0x7FE9D7), Color(hex: 0x5DC6B8)]),  // Cyan
    ]

    static let emojiList: [String] = [
        "🐶",
        "🐱",
        "🐭",
        "🐹",
        "🐰",
        "🦊",
        "🐻",
        "🐼",
        "🐨",
        "🐯",
        "🦁",
        "🐮",
        "🐷",
        "🐸",
        "🐵",
        "🙈",
        "🙉",
        "🙊",
        "🐒",
        "🐔",
        "🐧",
        "🐦",
        "🐤",
        "🐣",
        "🐥",
        "🦆",
        "🦅",
        "🦉",
        "🦇",
        "🐺",
        "🐗",
        "🐴",
        "🦄",
        "🐝",
        "🐛",
        "🦋",
        "🐌",
        "🐞",
        "🐜",
        "🕷",
        "🕸",
        "🦂",
        "🐢",
        "🐍",
        "🦎",
        "🦖",
        "🦕",
        "🐙",
        "🦑",
        "🦐",
        "🦞",
        "🦀",
        "🐡",
        "🐠",
        "🐟",
        "🐬",
        "🐳",
        "🐋",
        "🦈",
        "🦭",
        "🐊",
        "🐅",
        "🐆",
        "🦓",
        "🦍",
        "🦧",
        "🦣",
        "🐘",
        "🦛",
        "🦏",
        "🐪",
        "🐫",
        "🦒",
        "🦘",
    ]

    static func getPresetGradient(from uuid: UUID) -> G
```

### Core Architecture Module: `Planet/IPFS/IPFSState.swift`
```
import Foundation


class IPFSState: ObservableObject {
    static let shared = IPFSState()

    static let lastUserLaunchState: String = "PlanetIPFSLastUserLaunchStateKey"
    private let offlineRetryIntervalNanoseconds: UInt64 = 3_000_000_000

    /// A string to be displayed when IPFS daemon is unable to start.
    @Published var reasonIPFSNotRunning: String? = nil

    @Published var isShowingStatus = false
    @Published var isShowingStatusWindow = false

    @Published private(set) var isOperating = false
    @Published private(set) var online = false
    @Published private(set) var apiPort: UInt16 = 5981
    @Published private(set) var gatewayPort: UInt16 = 18181
    @Published private(set) var swarmPort: UInt16 = 4001
    @Published private(set) var isCalculatingRepoSize: Bool = false
    @Published private(set) var repoSize: Int64?
    @Published private(set) var serverInfo: ServerInfo?
    @Published private(set) var bandwidths: [Int: IPFSBandwidth] = [:]
    private var statusRetryTask: Task<Void, Never>?

    init() {
        debugPrint("IPFS State Manager Init")
        Task(priority: .userInitiated) {
            await IPFSDaemon.shared.setupIPFS()
            guard self.reasonIPFSNotRunning == nil else {
                return
            }
            do {
                try await Task.sleep(nanoseconds: 500_000_000)
                if self.shouldAutoLaunchDaemon() {
                    try await IPFSDaemon.shared.launch()
                }
            } catch {
                debugPrint("Failed to launch: \(error.localizedDescription), will try again shortly.")
            }
            await self.updateStatus()
        }
    }

    deinit {
        statusRetryTask?.cancel()
    }

    // MARK: -

    static let formatter = {
        let byteCountFormatter = ByteCountFormatter()
        byteCountFormatter.allowedUnits = .useAll
        byteCountFormatter.countStyle = .decimal
        return byteCountFormatter
    }()

    // MARK: -

    @MainActor
    func updateOperatingStatus(_ flag: Bool) {
        self.isOperating = flag
    }

    @MainActor
    func updateOnlineStatus(_ flag: Bool) {
        self.online = flag
        if flag {
            cancelStatusRetry()
        } else {
            if shouldAutoLaunchDaemon() {
                scheduleOfflineRetryIfNeeded()
            } else {
                cancelStatusRetry()
            }
        }
    }

    @MainActor
    func updateUserLaunchPreference(_ enabled: Bool) {
        UserDefaults.standard.setValue(enabled, forKey: Self.lastUserLaunchState)
        if enabled {
            if !online {
                scheduleOfflineRetryIfNeeded()
            }
        } else {
            cancelStatusRetry()
        }
    }

    @MainActor
    func updateAPIPort(_ port: UInt16) {
        self.apiPort = port
    }

    @MainActor
    func updateSwarmPort(_ port: UInt16) {
        self.swarmPort = port
    }

    @MainActor
    func updateGatewayPort(_ port: UInt16) {
        self.gatewayPort = port
    }

    @MainActor
    func updateServerInfo(_ info: ServerInfo) {
        self.serverInfo = info
        debugPrint("Updated ServerInfo: \(info)")
    }

    @MainActor
    func updateBandwidths(data: IPFSBandwidth) {
        let now = Int(Date().timeIntervalSince1970)
        bandwidths[now] = data
        if bandwidths.count > 120 {
            bandwidths = bandwidths.suffix(120).reduce(into: [:]) { $0[$1.key] = $1.value }
        }
    }

    func getGateway() -> String {
        return "http://127.0.0.1:\(gatewayPort)"
    }

    // MARK: -

    func updateStatus() async {
        let healthStatus = await IPFSDaemon.shared.healthStatus(
            apiPort: self.apiPort,
            gatewayPort: self.gatewayPort
        )
        let onlineStatus = healthStatus.isOnline
        await MainActor.run {
            self.updateOnlineStatus(onlineStatus)
        }
        if onlineStatus {
            await self.updateServerInfo()
        }
    }

    func updateAppSettings() {
        // refresh published folders
        Task.detached(priority: .utility) { @MainActor in
            PlanetPublishedServiceStore.shared.reloadPublishedFolders()
        }
        // process unpublished folders
        Task.detached(priority: .utility) {
            NotificationCenter.default.post(
                name: .dashboardProcessUnpublishedFolders,
                object: nil
            )
        }
        // update webview rule list.
        Task.detached(priority: .utility) {
            NotificationCenter.default.post(
                name: .updateRuleList,
                object: NSNumber(value: self.apiPort)
            )
        }
        // refresh key manager
        Task.detached(priority: .utility) { @MainActor in
            NotificationCenter.default.post(name: .keyManagerReloadUI, object: nil)
        }
    }

    func updateTrafficStatus() async {
        guard online else { return }
        guard let stats = try? await IPFSDaemon.shared.getStatsBW() else { return }
        await MainActor.run {
            updateBandwidths(data: stats)
        }
    }

    func calculateRepoSize() async throws {
        guard !isCalculatingRepoSize else { return }
        await MainActor.run {
            self.isCalculatingRepoSize = true
        }
        defer {
            Task { @MainActor in
                self.isCalculatingRepoSize = false
            }
        }
        let repoPath = IPFSCommand.IPFSRepositoryPath
        guard FileManager.default.fileExists(atPath: repoPath.path) else { throw PlanetError.DirectoryNotExistsError }
        let data = try await IPFSDaemon.shared.api(path: "repo/stat")
        let decoder = JSONDecoder()
        let repoState: IPFSRepoState = try decoder.decode(IPFSRepoState.self, from: data)
        let path = URL(fileURLWithPath: repoState.repoPath)
        guard path == repoPath else { throw PlanetError.IPFSAPIError }
        await MainActor.run {
            self.repoSize = repoState.repoSize
        }
    }

    // MARK: -

    @MainActor
    private func scheduleOfflineRetryIfNeeded() {
        guard shouldAutoLaunchDaemon(), reasonIPFSNotRunning == nil else {
            cancelStatusRetry()
            return
        }
        guard statusRetryTask == nil else { return }
        let retryInterval = offlineRetryIntervalNanoseconds
        statusRetryTask = Task(priority: .utility) { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                if !self.shouldAutoLaunchDaemon() {
                    await MainActor.run {
                        self.cancelStatusRetry()
                    }
                    break
                }
                do {
                    try await Task.sleep(nanoseconds: retryInterval)
                } catch {
                    break
                }
                guard !Task.isCancelled else { break }
                if !self.shouldAutoLaunchDaemon() {
                    await MainActor.run {
                        self.cancelStatusRetry()
                    }
                    break
                }
                await self.updateStatus()
            }
        }
    }

    @MainActor
    private func cancelStatusRetry() {
        statusRetryTask?.cancel()
        statusRetryTask = nil
    }

    private func shouldAutoLaunchDaemon() -> Bool {
        if UserDefaults.standard.value(forKey: Self.lastUserLaunchState) != nil, !UserDefaults.standard.bool(forKey: Self.lastUserLaunchState) {
            return false
        }
        return true
    }

    private func updateServerInfo() async {
        var hostName: String = ""
        if let host = Host.current().localizedName {
            hostName = host
        }
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        var ipfsPeerID = ""
        do {
            let data = try await IPFSDaemon.shared.api(path: "id")
            let decoder = JSONDecoder()
            let idInfo = try decoder.decode(IPFSID.self, from: data)
            ipfsPeerID = idInfo.id
        } catch {
            ipfsPeerID = ""
        }
        var ipfsVersion = ""
        do {
            let data = try await IPFSDaemon.shared.api(path: "version")
            let decoder = JSONDecoder()
            let versionInfo = try decoder.decode(IPFSVersion.self, from: data)
            ipfsVersion = versionInfo.version
        } catch {
            ipfsVersion = ""
        }
        var peers = 0
        do {
            let data = try await IPFSDaemon.shared.api(path: "swarm/peers")
            let decoder = JSONDecoder()
            let swarmPeers = try decoder.decode(IPFSPeers.self, from: data)
            peers = swarmPeers.peers?.count ?? 0
        } catch {
            peers = 0
        }
        let info = ServerInfo(hostName: hostName, version: version, ipfsPeerID: ipfsPeerID, ipfsVersion: ipfsVersion, ipfsPeerCount: peers)
        Task { @MainActor in
            self.updateServerInfo(info)
        }
    }
}

```

### Core Architecture Module: `Planet/API/PlanetAPIAuthMiddleware.swift`
```
import Foundation
import Vapor

struct PlanetAPIAuthMiddleware: AsyncMiddleware {
    let username: String
    let password: String
    let realm: String = "Planet API Server"

    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        guard let authorization = request.headers.basicAuthorization else {
            return Response(
                status: .unauthorized,
                headers: [
                    "WWW-Authenticate": "Basic realm=\"\(realm)\""
                ]
            )
        }

        if authorization.username == username && authorization.password == password {
            return try await next.respond(to: request)
        }
        else {
            return Response(
                status: .unauthorized,
                headers: [
                    "WWW-Authenticate": "Basic realm=\"\(realm)\""
                ]
            )
        }
    }
}

```

### Core Architecture Module: `Planet/API/PlanetAPIConsoleView.swift`
```
//
//  PlanetAPIConsoleView.swift
//  Planet
//

import SwiftUI
import AppKit


private struct AttributedConsoleView: NSViewRepresentable {
    @ObservedObject var viewModel: PlanetAPIConsoleViewModel
    
    init() {
        _viewModel = ObservedObject(wrappedValue: PlanetAPIConsoleViewModel.shared)
    }
    
    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = true
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalRuler = false
        scrollView.autoresizingMask = [.width, .height]
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let textView = NSTextView()
        textView.autoresizingMask = .width
        textView.backgroundColor = NSColor.textBackgroundColor
        textView.drawsBackground = true
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.minSize = NSSize(width: 480, height: 320)
        textView.textColor = NSColor.labelColor
        textView.allowsUndo = false
        textView.isEditable = false
        textView.isSelectable = true
        textView.textContainerInset = NSSize(width: 16, height: 10)
        textView.textContainer?.widthTracksTextView = true
        
        scrollView.documentView = textView
        return scrollView
    }
    
    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? NSTextView else { return }
        let attributedText = NSMutableAttributedString()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "HH:mm:ss.SSS"
        for log in viewModel.logs {
            let timestampString = dateFormatter.string(from: log.timestamp)
            let logText: String = {
                if log.originIP != "" {
                    return "\(timestampString) \(log.originIP) \(log.statusCode) \(log.requestURL)\n"
                }
                return "\(timestampString) \(log.statusCode) \(log.requestURL)\n"
            }()
            let attributedLog = NSMutableAttributedString(string: logText)
            
            // Set base color for both light and dark theme
            attributedLog.addAttribute(.foregroundColor, value: NSColor.textColor, range: NSRange(location: 0, length: attributedLog.length))
            
            // Set base font
            attributedLog.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: self.viewModel.baseFontSize, weight: .regular), range: NSRange(location: 0, length: attributedLog.length))
            
            // Match timestamp
            let timestampRange = NSRange(location: 0, length: timestampString.count)
            attributedLog.addAttribute(.foregroundColor, value: NSColor.placeholderTextColor, range: timestampRange)

            // Match IP address
            let ipAddressPattern = "\\b((?:\\d{1,3}\\.){3}\\d{1,3}|(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4})\\b"
            let ipRegex = try! NSRegularExpression(pattern: ipAddressPattern, options: [])
            let ipMatches = ipRegex.matches(in: logText, options: [], range: NSRange(location: timestampString.count + 1, length: logText.utf16.count - timestampString.count - 1))
            var ipRange: NSRange?
            if let ipMatch = ipMatches.first {
                ipRange = ipMatch.range
                attributedLog.addAttribute(.foregroundColor, value: NSColor.textColor, range: ipRange!)
            }
            
            // Match status code
            let regexPattern = "\\b(\\d{3})\\b"
            let regex = try! NSRegularExpression(pattern: regexPattern, options: [])
            let searchStart = (ipRange?.location ?? timestampString.count) + (ipRange?.length ?? 0) + 1
            let searchRange = NSRange(location: searchStart, length: logText.utf16.count - searchStart)
            let matches = regex.matches(in: logText, options: [], range: searchRange)
            for match in matches {
                if match.numberOfRanges > 0 {
                    let statusCodeRange = match.range(at: 1)
                    let statusCodeString = (logText as NSString).substring(with: statusCodeRange)
                    if let statusCode = Int(statusCodeString) {
                        var color: NSColor
                        switch statusCode {
                            case 200..<300:
                                color = .green
                            case 400..<500:
                                color = .orange
                            case 500..<600:
                                color = .red
                            default:
                                color = .textColor
                        }
                        attributedLog.addAttribute(.foregroundColor, value: color, range: statusCodeRange)
                        attributedLog.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: self.viewModel.baseFontSize, weight: .bold), range: statusCodeRange)
                    }
                }
            }
            
            // Match request method
            if let methodRange = logText.range(of: log.requestURL.split(separator: " ").first ?? "") {
                let nsRange = NSRange(methodRange, in: logText)
                attributedLog.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: self.viewModel.baseFontSize, weight: .semibold), range: nsRange)
            }
            
            attributedText.append(attributedLog)
            
            // Add error description if available
            if log.errorDescription != "" {
                let errorDescription = log.errorDescription + "\n"
                let attributedErrorDescription = NSMutableAttributedString(string: errorDescription)
                let errorRange = NSRange(location: 0, length: attributedErrorDescription.length)
                attributedErrorDescription.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: self.viewModel.baseFontSize, weight: .medium), range: errorRange)
                attributedErrorDescription.addAttribute(.foregroundColor, value: NSColor.secondaryLabelColor, range: errorRange)
                attributedText.append(attributedErrorDescription)
            }
        }
        textView.textStorage?.setAttributedString(attributedText)
        textView.scrollToEndOfDocument(nil)
    }
}

struct PlanetAPIConsoleView: View {
    var body: some View {
        AttributedConsoleView()
            .frame(minWidth: 480, idealWidth: 480, maxWidth: .infinity, minHeight: 320, idealHeight: 320, maxHeight: .infinity)
    }
}

```

### Core Architecture Module: `Planet/API/PlanetAPIConsoleViewModel.swift`
```
//
//  PlanetAPIConsoleViewModel.swift
//  Planet
//

import Foundation
import SwiftUI


class PlanetAPIConsoleViewModel: ObservableObject {
    static let shared = PlanetAPIConsoleViewModel()
    static let maxLength: Int = 2000
    static let baseFontKey: String = "APIConsoleBaseFontSizeKey"

    @Published var isShowingConsoleWindow = false
    @Published private(set) var baseFontSize: CGFloat {
        didSet {
            UserDefaults.standard.set(baseFontSize, forKey: Self.baseFontKey)
        }
    }

    @Published private(set) var logs: [
        (
            timestamp: Date,
            statusCode: UInt,
            originIP: String,
            requestURL: String,
            errorDescription: String
        )
    ] = []

    init() {
        var fontSize = CGFloat(UserDefaults.standard.float(forKey: Self.baseFontKey))
        if fontSize == 0 {
            fontSize = 12
        }
        baseFontSize = fontSize
    }

    @MainActor
    func addLog(statusCode: UInt, originIP: String, requestURL: String, errorDescription: String = "") {
        let now = Date()
        let logEntry = (timestamp: now, statusCode: statusCode, originIP: originIP, requestURL: requestURL, errorDescription: errorDescription)
        logs.append(logEntry)
        if logs.count > Self.maxLength {
            logs = Array(logs.suffix(Self.maxLength))
        }
    }
    
    @MainActor
    func decreaseFontSize() {
        if baseFontSize > 9 {
            baseFontSize -= 1
        }
    }
    
    @MainActor
    func increaseFontSize() {
        baseFontSize += 1
    }
    
    @MainActor
    func resetFontSize() {
        baseFontSize = 12
    }
    
    @MainActor
    func clearLogs() {
        logs.removeAll()
    }
}

```

### Core Architecture Module: `Planet/API/PlanetAPIControlView.swift`
```
//
//  PlanetAPIControlView.swift
//  Planet
//

import SwiftUI


struct PlanetAPIControlView: View {
    @ObservedObject private var control: PlanetAPIController
    
    @State private var apiUsesPasscode: Bool = UserDefaults.standard.bool(forKey: .settingsAPIUsesPasscode)
    @State private var apiUsername: String = UserDefaults.standard.string(forKey: .settingsAPIUsername) ?? "Planet"
    @State private var apiPort: String = UserDefaults.standard.string(forKey: .settingsAPIPort) ?? "8086"
    @State private var apiPasscode: String = ""
    @State private var isShowingPasscode: Bool = false
    @State private var isAlert: Bool = false
    @State private var alertTitle: String = ""
    @State private var alertMessage: String = ""

    init() {
        _control = ObservedObject(wrappedValue: PlanetAPIController.shared)
    }

    var body: some View {
        VStack {
            Form {
                Section {
                    TextField("API Server Port", text: $apiPort)
                        .disabled(control.serverIsRunning)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(.top, 6)
                Section {
                    HStack(spacing: 4) {
                        Toggle("Require Authentication", isOn: $apiUsesPasscode)
                            .disabled(control.serverIsRunning)
                            .onChange(of: apiUsesPasscode) { newValue in
                                UserDefaults.standard.set(newValue, forKey: .settingsAPIUsesPasscode)
                            }
                        Spacer()
                        HelpLinkButton(helpLink: URL(string: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization#basic_authentication")!)
                    }
                    .padding(.top, 10)
                    TextField("API Server Username", text: $apiUsername)
                        .disabled(control.serverIsRunning)
                        .textFieldStyle(.roundedBorder)
                    ZStack {
                        TextField("API Server Passcode", text: $apiPasscode)
                            .opacity(isShowingPasscode ? 1.0 : 0.0)
                        SecureField("API Server Passcode", text: $apiPasscode)
                            .opacity(!isShowingPasscode ? 1.0 : 0.0)
                        HStack {
                            Spacer()
                            Button {
                                isShowingPasscode.toggle()
                            } label: {
                                Image(systemName: !isShowingPasscode ? "eye.slash" : "eye")
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                                    .frame(width: 14, height: 14, alignment: .center)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 8)
                    }
                    .disabled(control.serverIsRunning)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: apiPasscode) { newValue in
                        Task { @MainActor in
                            if newValue == "" {
                                self.apiUsesPasscode = false
                            }
                            do {
                                try self.updatePasscode(newValue)
                            } catch {
                                debugPrint("failed to update password: \(error)")
                            }
                        }
                    }
                }
                Spacer()
            }
            .padding()
            .task {
                do {
                    let passcode = try KeychainHelper.shared.loadValue(forKey: .settingsAPIPasscode)
                    if passcode != "" {
                        apiPasscode = passcode
                    }
                } catch {
                    apiPasscode = ""
                    apiUsesPasscode = false
                    UserDefaults.standard.set(false, forKey: .settingsAPIUsesPasscode)
                    Task { @MainActor in
                        do {
                            try KeychainHelper.shared.delete(forKey: .settingsAPIPasscode)
                        } catch {
                            debugPrint("failed to delete api passcode from keychain: \(error)")
                        }
                    }
                }
            }

            Spacer(minLength: 12)

            HStack {
                if control.isOperating {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .controlSize(.small)
                        .frame(width: 12)
                } else {
                    Circle()
                        .frame(width: 12, height: 12)
                        .foregroundStyle(control.serverIsRunning ? Color.green : Color.gray)
                }
                let status: String = control.serverIsRunning ? L10n("Running") : L10n("Stopped")
                Text(.init(L10n("API Server Status: **%@**", status)))
                    .padding(.leading, -2)

                Spacer()

                controlView()
            }
            .frame(height: 54)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .background(Color.secondary.opacity(0.1))
        }
        .alert(isPresented: $isAlert) {
            Alert(title: Text(alertTitle), message: Text(alertMessage), dismissButton: .cancel(Text("OK")))
        }
    }
    
    @ViewBuilder
    private func controlView() -> some View {
        Button {
            PlanetAPIConsoleWindowManager.shared.activate()
        } label: {
            Image(systemName: "display")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 15)
        }
        .buttonStyle(.plain)
        .help("Open API Console")
        .padding(.trailing, 8)

        Button {
            if control.serverIsRunning {
                Task { @MainActor in
                    do {
                        try await self.control.stop()
                    } catch {
                        isAlert = true
                        alertTitle = L10n("Failed to Stop Server")
                        alertMessage = error.localizedDescription
                    }
                }
            } else {
                do {
                    try applyServerInformation()
                    Task { @MainActor in
                        do {
                            try await self.control.start()
                        } catch {
                            isAlert = true
                            alertTitle = L10n("Failed to Start Server")
                            alertMessage = error.localizedDescription
                        }
                    }
                } catch PlanetError.InvalidAPIPortError {
                    isAlert = true
                    alertTitle = L10n("Failed to Start Server")
                    alertMessage = L10n("Invalid API port, please double check and try again.")
                } catch PlanetError.InvalidAPIUsernameError {
                    isAlert = true
                    alertTitle = L10n("Failed to Start Server")
                    alertMessage = L10n("Invalid username, please double check and try again.")
                } catch PlanetError.InvalidAPIPasscodeError {
                    isAlert = true
                    alertTitle = L10n("Failed to Start Server")
                    alertMessage = L10n("Invalid passcode, please double check and try again.")
                } catch {
                    isAlert = true
                    alertTitle = L10n("Failed to Start Server")
                    alertMessage = L10n("Please double check server information and try again.")
                }
                if self.isShowingPasscode {
                    Task { @MainActor in
                        self.isShowingPasscode = false
                    }
                }
            }
        } label: {
            HStack(spacing: 0) {
                Spacer(minLength: 1)
                if control.serverIsRunning {
                    Text("Stop Server")
                } else {
                    Text("Start Server")
                }
                Spacer(minLength: 1)
            }
            .frame(maxWidth: 90)
        }
        .disabled(control.isOperating)
    }
    
    private func applyServerInformation() throws {
        if let port = Int(apiPort), port >= 1024, port <= 32767 {
            UserDefaults.standard.set(apiPort, forKey: .settingsAPIPort)
        } else {
            throw PlanetError.InvalidAPIPortError
        }
        guard apiUsesPasscode else { return }
        if apiUsername != "" {
            UserDefaults.standard.set(apiUsername, forKey: .settingsAPIUsername)
        } else {
            throw PlanetError.InvalidAPIUsernameError
        }
        if apiPasscode == "" {
            throw PlanetError.InvalidAPIPasscodeError
        } else {
            try KeychainHelper.shared.saveValue(apiPasscode, forKey: .settingsAPIPasscode)
        }
    }
    
    private func updatePasscode(_ passcode: String) throws {
        if passcode == "" {
            try KeychainHelper.shared.delete(forKey: .settingsAPIPasscode)
        } else {
            try KeychainHelper.shared.saveValue(passcode, forKey: .settingsAPIPasscode)
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #458** (2026-03-14): **Sepia 模板的文章链接没有用 Slug**
  *Symptoms*: blog 首页每篇文章的“发布时间”的链接没有用设置的slug  <img width="926" height="1286" alt="Image" src="https://github.com/user-attachments/assets/9fab4bee-b009-4f0f-bc48-366d464bac23" />  <img width="1060" height="1082" alt="Image" src="https://github.com/user-attachments/assets/649f35dd-d817-4c31-b40b-6df955b349a0" />
  **Post-Mortem & Fix Analysis**:
  > Thanks.  Fixed in template source code.  Will ship with the latest Planet major update soon.

- **Issue #398** (2025-02-17): **Tags not updated when aggregating**
  *Symptoms*: If the tags of the source article change, they will not be updated when aggregating.  https://github.com/Planetable/Planet/blob/dcf6ac56a65bc544b49a5eded47e8449442f1f52/Planet/Entities/MyPlanetModel%2BAggregate.swift#L308 
  **Post-Mortem & Fix Analysis**:
  > The latest Insider build `insider-20250127-1` has a fix for this issue.  <img width="734" alt="Image" src="https://github.com/user-attachments/assets/322613c2-028a-43ac-af97-795951e5e2ff" />

- **Issue #262** (2023-08-21): **Publishing latency**
  *Symptoms*: Added Filebase but the "pinning status" bar keeps "loading". I am unable to affect it, and no errors are thrown when I say publish or build.  I tried to manually pin the JSON and images to web3.storage as well (pinnable did not work for me), but no effect - it seems like the latency is hitting the publishing process pretty hard, or the pinning is failing.  <img width="551" alt="image" src="https://github.com/Planetable/Planet/assets/1430603/dd655e76-59a7-4c8f-904a-a89db8678a30">  Would it be possible to enable some kind of dev mode so I can check what's happening with the pinning process behind the scenes?  Edit for clarification: this is not a .limo issue, it persists even if I try to "open using public gateway"
  **Post-Mortem & Fix Analysis**:
  > Hi @Swader,  Thanks for the feedback. We'll add a log file on disk to show all the API request/response details. I'll let you know when this is done and released in our Insider Builds.  ### Filebase Support  It was free to use when we first added the integration for Filebase API in September 2022. Later in 2022, Filebase changed terms to require a [paid plan](https://filebase.com/pricing/) (starting at $20/mo) to use their API. This is the Filebase error message I got from the debugging log. I haven't paid for my API.  <img width="586" alt="Screenshot 2023-08-21 at 11 20 39 AM" src="https://github.com/Planetable/Planet/assets/11427/9b7bedd7-9762-4427-9ff4-7b2ad5a5a41b">  ### Pinnable  [Pinnable](https://pinnable.xyz) is a new pinning API we've introduced. It's specifically designed for websites running on ENS and IPNS.  First, you need to add your .eth domain to the Pinnable website. After that, copy and paste the API URL into the app. Once you've done this, the app will 
  > I tried using Pinnable, and even got 0.3 eth of dwb, but the app never recognized them (I never got them in the wallet actually). Then I thought I am supposed to "redeem" but that turned out to just give me back 0.21 eth and burn all 300 tokens (which it appears I had after all?). So I could not get Pinnable to allow me to add my site. I do have a paid account on Filebase and used that API, and in fact the first pin worked (see bruno.eth.limo) but the updated one did not, and this update has been pending now for a while. So thank you, debug logs will be appreciated to get to the bottom of it!
  > I was wrong, I had a free account on Filebase. Now that I put in a paid one, it started queueing up the pins, will see in the morning if all will be well but seems to be progressing!

- **Issue #200** (2023-04-26): **starType for FollowingArticleModel is not persistent**
  *Symptoms*: It reverts to the default type after the app restarts.
  **Post-Mortem & Fix Analysis**:
  > Fixed for FollowingArticleModel.

- **Issue #193** (2023-04-13): **Public API performance issues and improvements**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Implemented in pr: https://github.com/Planetable/Planet/pull/194

- **Issue #162** (2026-03-07): **Bring planet online automatically**
  *Symptoms*: IPFS node may go offline for some network issue, and then I have to relaunch Planet.  It would be great if it can be brought online automatically.  <img width="303" alt="Screen Shot 2023-01-24 at 09 22 43" src="https://user-images.githubusercontent.com/559179/215231544-47a8e941-f896-491f-bbe9-16dbec741495.png"> 
  **Post-Mortem & Fix Analysis**:
  > Addressed — when the IPFS daemon goes offline, the app now automatically retries and brings it back online via a scheduled status retry mechanism. Related commit: 67b22047.

- **Issue #160** (2023-01-19): **Planet crash after selecting a video**
  *Symptoms*: Planet quit after selecting a video. If I reopen Planet and try to edit the article, it crashed again. I can reproduce the issues with different Macs.  version: Version 0.12.0 (995)  Two reports:  ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               Planet [20802] Path:                  /Applications/Planet.app/Contents/MacOS/Planet Identifier:            xyz.planetable.Planet Version:               0.12.0 (995) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2023-01-18 16:43:06.7140 -0500 OS Version:            macOS 12.3.1 (21E258) Report Version:        12 Anonymous UUID:        E0750B6E-730B-55E2-BE05-B8D450DBA278  Sleep/Wake UUID:       C80DF9AF-E55F-4D39-A57C-B527D6725A79  Time Awake Since Boot: 600000 seconds Time Since Wake:       26345 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_CRASH (SIGABRT) Exception Codes:       0x0000000000000000, 0x0000000000000000 Exception Note:        EXC_CORPSE_NOTIFY  Application Specific Information: ViewBridge hint(s): ( "bridge key: most-recent-completion" ) failed to demangle superclass of VideoPlayerView from mangled name 'So12AVPlayerViewC': unknown error abort() called ```   ``` ------------------------------------- Translated 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. I have seen it once too, on a friend's installation. I suspect it's an issue in the draft handling. Could you please try this insider build? It has shipped a fix around the handling of drafts.  https://github.com/Planetable/Planet/releases/tag/insider-20230112-1
  > I managed to reproduce the issue. Thanks again!  Now building a new Insider Build.  It seems related to this issue:  https://swiftui-lab.com/videoplayer-bug/
  > @airyland Here is the new Insider Build for fixing the video issue:  https://github.com/Planetable/Planet/releases/tag/insider-20230118-1

- **Issue #150** (2023-09-21): **Unexpected download behavior after article is moved**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > This is fixed.

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

### Incident Patch 1: `11cfe5bc` (2026-09-20)
**Commit Message**: Fix Xcode 27 compatibility and sidebar icon sizing

Qualify SwiftSoup document types and preserve file-promise identifiers without creating undeclared UTTypes. Size the sidebar add symbol using a font and bump the marketing version to 0.22.4.

Validated with an Xcode 27 macOS build targeting macOS 12, code signing disabled, and an isolated drag-registration comparison.

**File**: `Planet/Entities/FollowingPlanetModel.swift` (modified, +1/-1)
```diff
@@ -469,7 +469,7 @@ class FollowingPlanetModel: Equatable, Hashable, Identifiable, ObservableObject,
 
     private static func avatarHTMLSource(
         from discovery: FeedDiscoveryResult
-    ) async throws -> (document: Document, url: URL)? {
+    ) async throws -> (document: SwiftSoup.Document, url: URL)? {
         if let htmlDocument = discovery.htmlDocument,
            let htmlURL = discovery.htmlURL
         {
```

**File**: `Planet/Entities/MyPlanetModel+Aggregate.swift` (modified, +1/-1)
```diff
@@ -1238,7 +1238,7 @@ extension MyPlanetModel {
         do {
             let (data, _) = try await URLSession.shared.data(from: url)
             let html = String(decoding: data, as: UTF8.self)
-            let doc: Document = try SwiftSoup.parse(html)
+            let doc: SwiftSoup.Document = try SwiftSoup.parse(html)
             let ogImage = try doc.select("meta[property=og:image]").first()
             debugPrint("Aggregation: og:image: \(String(describing: ogImage)) found in \(url)")
             if let ogImage = ogImage {
```

**File**: `Planet/Quick Share/PlanetQuickShareDropDelegate.swift` (modified, +6/-8)
```diff
@@ -28,18 +28,16 @@ class PlanetQuickShareDropDelegate: DropDelegate {
     private static let activePromiseLock = NSLock()
     private static var activePromises: [UUID: ActiveFilePromise] = [:]
 
-    static let supportedContentTypes: [UTType] = {
-        let filePromiseTypes = NSFilePromiseReceiver.readableDraggedTypes.map {
-            UTType($0) ?? UTType(importedAs: $0)
-        }
-        return filePromiseTypes + [.fileURL, .image, .movie, .pdf, .mp3]
-    }()
+    // File-promise pasteboard identifiers are not all declared UTTypes. Keep the
+    // complete list as strings so SwiftUI can register every promise format.
+    static let supportedTypeIdentifiers: [String] = NSFilePromiseReceiver.readableDraggedTypes
+        + [UTType.fileURL, .image, .movie, .pdf, .mp3].map(\.identifier)
 
     init() {}
 
     static func processDropInfo(_ info: DropInfo) async -> [URL] {
         log(
-            "processDropInfo started providers=\(info.itemProviders(for: supportedContentTypes).count) location=\(describeLocation(info.location))"
+            "processDropInfo started providers=\(info.itemProviders(for: supportedTypeIdentifiers).count) location=\(describeLocation(info.location))"
         )
 
         var urls: [URL] = []
@@ -83,7 +81,7 @@ class PlanetQuickShareDropDelegate: DropDelegate {
     }
 
     func validateDrop(info: DropInfo) -> Bool {
-        let providerCount = info.itemProviders(for: Self.supportedContentTypes).count
+        let providerCount = info.itemProviders(for: Self.supportedTypeIdentifiers).count
         let hasDirectImage = Self.dragPasteboardHasDirectImage()
         let hasPromise = Self.dragPasteboardHasFilePromise()
         let isValid = providerCount > 0 || hasDirectImage || hasPromise
```

**File**: `Planet/Quick Share/PlanetQuickShareView.swift` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ struct PlanetQuickShareView: View {
                     let dropDelegate = PlanetQuickShareDropDelegate()
                     attachmentSectionPlaceholder()
                         .focusable()
-                        .onDrop(of: PlanetQuickShareDropDelegate.supportedContentTypes, delegate: dropDelegate)
+                        .onDrop(of: PlanetQuickShareDropDelegate.supportedTypeIdentifiers, delegate: dropDelegate)
                         .onPasteCommand(of: [.fileURL, .image, .movie, .mp3], perform: PlanetQuickShareViewModel.shared.processPasteItems(_:))
                         .contextMenu {
                             PasteButton(supportedContentTypes: [.fileURL, .image, .movie, .mp3], payloadAction: PlanetQuickShareViewModel.shared.processPasteItems(_:))
```

**File**: `Planet/Views/Articles/ArticleListView.swift` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ class ArticleListDropDelegate: DropDelegate {
     }
 
     func validateDrop(info: DropInfo) -> Bool {
-        let providerCount = info.itemProviders(for: PlanetQuickShareDropDelegate.supportedContentTypes).count
+        let providerCount = info.itemProviders(for: PlanetQuickShareDropDelegate.supportedTypeIdentifiers).count
         let hasDirectImage = PlanetQuickShareDropDelegate.dragPasteboardHasDirectImage()
         let hasPromise = PlanetQuickShareDropDelegate.dragPasteboardHasFilePromise()
         let isValid = providerCount > 0 || hasDirectImage || hasPromise
@@ -679,7 +679,7 @@ struct ArticleListView: View {
                 }
             }
         }
-        .onDrop(of: PlanetQuickShareDropDelegate.supportedContentTypes, delegate: articleDropDelegate)
+        .onDrop(of: PlanetQuickShareDropDelegate.supportedTypeIdentifiers, delegate: articleDropDelegate)
         .onWidthChange { newWidth in
             @AppStorage("articleListWidth") var articleListWidth = 240.0
             articleListWidth = newWidth
```

**File**: `Planet/Views/Sidebar/PlanetSidebarView.swift` (modified, +1/-2)
```diff
@@ -155,8 +155,7 @@ struct PlanetSidebarView: View {
                         }
                     } label: {
                         Image(systemName: "plus")
-                            .resizable()
-                            .aspectRatio(contentMode: .fit)
+                            .font(.system(size: 14, weight: .medium))
                             .frame(width: 24, height: 24, alignment: .center)
                     }
                     .padding(EdgeInsets(top: 2, leading: 10, bottom: 2, trailing: 0))
```

**File**: `Planet/marketing_version.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-MARKETING_VERSION = 0.22.3;
+MARKETING_VERSION = 0.22.4;
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2839
+CURRENT_PROJECT_VERSION = 2840
```

---

### Incident Patch 2: `75906eca` (2026-06-11)
**Commit Message**: Fix AI chat bottom scroll pinning

**File**: `Planet/Views/Articles/ArticleAIChatView.swift` (modified, +328/-113)
```diff
@@ -284,9 +284,9 @@ struct ArticleAIChatView: View {
     @State private var isSending: Bool = false
     @State private var errorText: String? = nil
     @State private var isPinnedToBottom: Bool = true
-    @State private var isUserScrollIntentDown: Bool = true
-    @State private var scrollWheelMonitor: Any? = nil
-    @State private var chatScrollHostBox = ChatScrollHostBox()
+    @State private var isUserScrollingChat: Bool = false
+    @State private var isChatNearBottom: Bool = true
+    @State private var bottomScrollRequest: Int = 0
     @State private var chatFontSize: CGFloat = {
         let stored = UserDefaults.standard.double(forKey: .settingsAIChatFontSize)
         return stored >= 12 && stored <= 20 ? CGFloat(stored) : 14
@@ -388,65 +388,55 @@ struct ArticleAIChatView: View {
             }
 
             ScrollViewReader { proxy in
-                GeometryReader { viewport in
-                    ScrollView {
-                        VStack(spacing: 0) {
-                            chatMessageList
-                                .padding(.leading, 20)
-                                .padding(.trailing, 20)
-                                .padding(.bottom, 20)
-                                .padding(.top, 12)
-                            // Bottom sentinel: scroll target for pin-to-bottom, and
-                            // reports its position so we know when the user is back at the bottom.
-                            Color.clear
-                                .frame(height: 1)
-                                .id(Self.bottomScrollAnchorID)
-                                .background(
-                                    GeometryReader { geometry in
-                                        Color.clear.preference(
-                                            key: ChatBottomDistancePreferenceKey.self,
-                                            value: geometry.frame(in: .named(Self.chatScrollCoordinateSpace)).minY
-                                        )
-                                    }
-                                )
-                        }
-                    }
-                    .background(Color(NSColor.textBackgroundColor))
-                    .background(ChatScrollHostAccessor(box: chatScrollHostBox))
-                    .coordinateSpace(name: Self.chatScrollCoordinateSpace)
-                    .applyScrollPositionTracking(id: $scrolledMessageID)
-                    .onPreferenceChange(ChatBottomDistancePreferenceKey.self) { sentinelTop in
-                        updateBottomPinState(distanceFromBottom: sentinelTop - viewport.size.height)
+                ScrollView {
+                    VStack(spacing: 0) {
+                        chatMessageList
+                            .padding(.leading, 20)
+                            .padding(.trailing, 20)
+                            .padding(.bottom, 20)
+                            .padding(.top, 12)
+                        Color.clear
+                            .frame(height: 1)
+                            .id(Self.bottomScrollAnchorID)
                     }
-                    .onChange(of: messages) { _ in
-                        if let targetID = pendingScrollTarget {
-                            pendingScrollTarget = nil
-                            isPinnedToBottom = false
-                            if #available(macOS 14.0, *) {
-                                scrolledMessageID = targetID
-                            } else {
-                                proxy.scrollTo(targetID, anchor: .top)
-                            }
-                        } else if isPinnedToBottom {
-                            if messages.last?.role == "user" {
-                                withAnimation {
-                                    proxy.scrollTo(Self.bottomScrollAnchorID, anchor: .bottom)
-                                }
-                            } else {
-                                proxy.scrollTo(Self.bottomScrollAnchorID, anchor: .bottom)
+                }
+                .background(Color(NSColor.textBackgroundColor))
+                .background(
+                    ChatScrollPositionObserver(
+                        bottomScrollRequest: bottomScrollRequest,
+                        onUserScrollStateChange: { isUserScrolling in
+                            isUserScrollingChat = isUserScrolling
+                        },
+                        onPositionChange: { distanceFromBottom, isUserInitiated in
+                            if updateBottomPinState(distanceFromBottom: distanceFromBottom, isUserInitiated: isUserInitiated) {
+                                requestBottomScrollIfPinned(allowActiveUserScroll: true)
                             }
                         }
+                    )
+                )
+                .applyScrollPositionTracking(id: $scrolledMessageID)
+                .onChange(of: messages) { _ in
+                    if let targetID = 
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2835
+CURRENT_PROJECT_VERSION = 2836
```

---

### Incident Patch 3: `6e5a2a99` (2026-06-11)
**Commit Message**: Add persistent AI chat memory via Workspace/MEMORY.md

Create a Workspace folder at the Planet library root holding MEMORY.md,
inline its contents into the chat system prompt for article, planet-wide,
and on-device sessions, and add an update_memory tool on both AI paths so
the assistant can remember, update, or forget notes when asked.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `Planet.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -7,6 +7,7 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		06DF9C7A7A8104BC02F53F9A /* PlanetAIMemory.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3AE6A87025B0F773780CF878 /* PlanetAIMemory.swift */; };
 		0AA0B181DEC749A0DB6E8A6E /* PlanetAIChatWindowController.swift in Sources */ = {isa = PBXBuildFile; fileRef = E399FD48A62B607DCEF8C76D /* PlanetAIChatWindowController.swift */; };
 		0C84F068A74BE01EAE71C0CC /* SSHRsyncLogger.swift in Sources */ = {isa = PBXBuildFile; fileRef = 92E9E61088FF7A043F46E188 /* SSHRsyncLogger.swift */; };
 		0EE328A6839BE6C7A0FE7752 /* XCTest.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = A4A3C339B79F63C5B4475B12 /* XCTest.framework */; };
@@ -839,6 +840,7 @@
 		2CCA533E0D21FAAEEEB5CE71 /* CoreSpotlight.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = CoreSpotlight.framework; path = System/Library/Frameworks/CoreSpotlight.framework; sourceTree = SDKROOT; };
 		2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DragPasteboardMedia.swift; sourceTree = "<group>"; };
 		342A67E3EAD082AA10974830 /* NaturalLanguage.framework */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = wrapper.framework; name = NaturalLanguage.framework; path = System/Library/Frameworks/NaturalLanguage.framework; sourceTree = SDKROOT; };
+		3AE6A87025B0F773780CF878 /* PlanetAIMemory.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PlanetAIMemory.swift; sourceTree = "<group>"; };
 		3BF7A284CCD68E7CBE9F9D73 /* fi */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = fi; path = fi.lproj/InfoPlist.strings; sourceTree = "<group>"; };
 		412635EFFFDD8D11BBC4BC56 /* ThemeColorExtractor.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ThemeColorExtractor.swift; sourceTree = "<group>"; };
 		43D9216A1E2C83FFC61A358C /* de */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = de; path = de.lproj/InfoPlist.strings; sourceTree = "<group>"; };
@@ -1573,6 +1575,7 @@
 				4C06A60D631FAB5EEF3BAF8C /* PlanetAIChatSessionsView.swift */,
 				E399FD48A62B607DCEF8C76D /* PlanetAIChatWindowController.swift */,
 				72A8762054781F152975DEE9 /* ArticleSpeechPlayer.swift */,
+				3AE6A87025B0F773780CF878 /* PlanetAIMemory.swift */,
 			);
 			path = Articles;
 			sourceTree = "<group>";
@@ -2687,6 +2690,7 @@
 				8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */,
 				B1554926223D7E6D8B65E40D /* DragPasteboardMedia.swift in Sources */,
 				A2587363679B28FC942BC9C8 /* ModelUpdateFieldCoverageCheck.swift in Sources */,
+				06DF9C7A7A8104BC02F53F9A /* PlanetAIMemory.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `Planet/PlanetAppDelegate.swift` (modified, +5/-0)
```diff
@@ -220,6 +220,11 @@ class PlanetAppDelegate: NSObject, NSApplicationDelegate {
             WebAppUpdater.shared.updateWebApp()
         }
 
+        // Workspace folder with MEMORY.md for AI chat persistent memory
+        DispatchQueue.global(qos: .background).async {
+            PlanetAIMemory.ensureMemoryFile()
+        }
+
         NSApp.registerServicesMenuSendTypes([], returnTypes: WriterPasteboardImporter.readablePasteboardTypes)
     }
 
```

**File**: `Planet/Views/Articles/ArticleAIChatView.swift` (modified, +93/-0)
```diff
@@ -3235,6 +3235,8 @@ struct ArticleAIChatView: View {
             return L10n("Searching repo text")
         case "list_planet_articles":
             return L10n("Listing planet articles")
+        case "update_memory":
+            return L10n("Updating memory")
         default:
             return L10n("Running %@", toolName)
         }
@@ -3356,6 +3358,16 @@ struct ArticleAIChatView: View {
             if let titleFilter = stringValue(from: arguments["title_filter"]) {
                 parts.append(L10n("Title filter: %@.", truncateInline(titleFilter, maxLength: 96)))
             }
+        case "update_memory":
+            if let note = stringValue(from: arguments["note"]) {
+                let singleLine = note.replacingOccurrences(of: "\n", with: " ")
+                parts.append(L10n("Note: %@.", truncateInline(singleLine, maxLength: 96)))
+            }
+            if boolValue(from: arguments["replace"]) == true {
+                parts.append(L10n("Mode: replace."))
+            } else {
+                parts.append(L10n("Mode: append."))
+            }
         default:
             let keys = Array(arguments.keys).sorted()
             if !keys.isEmpty {
@@ -3444,6 +3456,12 @@ struct ArticleAIChatView: View {
                 return L10n("Listed %d of %d filtered article(s) from %d total.", results.count, total, totalArticles)
             }
             return L10n("Article listing completed (%d filtered from %d total).", total, totalArticles)
+        case "update_memory":
+            let length = intValue(from: payload["memory_length"]) ?? 0
+            if stringValue(from: payload["mode"]) == "replace" {
+                return L10n("Memory replaced; MEMORY.md is now %d character(s).", length)
+            }
+            return L10n("Memory note saved; MEMORY.md is now %d character(s).", length)
         default:
             return L10n("Tool response received.")
         }
@@ -4591,6 +4609,27 @@ struct ArticleAIChatView: View {
                     ],
                 ],
             ],
+            [
+                "type": "function",
+                "function": [
+                    "name": "update_memory",
+                    "description": "Persist long-term memory for the user in Workspace/MEMORY.md. Use when the user asks to remember, update, or forget a fact or preference. Appends the note as a dated bullet by default; set replace=true to rewrite the whole file when removing or reorganizing entries.",
+                    "parameters": [
+                        "type": "object",
+                        "properties": [
+                            "note": [
+                                "type": "string",
+                                "description": "Memory text in Markdown. For appends keep it one concise bullet-sized line. When replace=true, pass the complete new MEMORY.md content.",
+                            ],
+                            "replace": [
+                                "type": "boolean",
+                                "description": "Optional. Defaults to false (append). Set true to replace the entire MEMORY.md content with `note`.",
+                            ],
+                        ],
+                        "required": ["note"],
+                    ],
+                ],
+            ],
         ]
     }
 
@@ -4613,6 +4652,8 @@ struct ArticleAIChatView: View {
             return await runGrepTool(arguments: arguments)
         case "list_planet_articles":
             return await runListPlanetArticlesTool(arguments: arguments)
+        case "update_memory":
+            return runUpdateMemoryTool(arguments: arguments)
         default:
             debugLog("unknown tool requested: \(toolCall.name)")
             return toolResult([
@@ -4981,6 +5022,41 @@ struct ArticleAIChatView: View {
         }
     }
 
+    private func runUpdateMemoryTool(arguments: [String: Any]) -> String {
+        guard let note = stringValue(from: arguments["note"]),
+            !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
+        else {
+            return toolResult([
+                "ok": false,
+                "error": "Missing required `note`.",
+            ])
+        }
+
+        let replace = boolValue(from: arguments["replace"]) ?? false
+        debugLog("runUpdateMemoryTool replace=\(replace), noteLength=\(note.count)")
+
+        do {
+            let memoryLength: Int
+            if replace {
+                memoryLength = try PlanetAIMemory.replaceContent(note)
+            } else {
+                memoryLength = try PlanetAIMemory.appendNote(note)
+            }
+            return toolResult([
+                "ok": true,
+                "memory_file": PlanetAIMemory.memoryFileURL.path,
+                "mode": replace ? "replace" : "append",
+                "memory_length": memoryLength,
+            ])
+        } catch {
+            debugLogError("runUpdateMemoryTool failed", error: error)
+        
```

**File**: `Planet/Views/Articles/ArticleAIOnDeviceTools.swift` (modified, +41/-0)
```diff
@@ -449,6 +449,15 @@ struct SearchArticlesArguments: Sendable {
     var planetID: String?
 }
 
+@available(macOS 26.0, *)
+@Generable(description: "Arguments for updating persistent user memory")
+struct UpdateMemoryArguments: Sendable {
+    @Guide(description: "Memory text in Markdown. For appends keep it one concise bullet-sized line. When replace is true, pass the complete new MEMORY.md content.")
+    var note: String
+    @Guide(description: "Optional. Defaults to false (append). Set to true to replace the entire MEMORY.md content with note.")
+    var replace: Bool?
+}
+
 @available(macOS 26.0, *)
 @Generable(description: "Arguments for grep-style library search")
 struct GrepArguments: Sendable {
@@ -862,6 +871,37 @@ struct GrepTool: Tool {
     }
 }
 
+// MARK: - Update Memory Tool
+
+@available(macOS 26.0, *)
+struct UpdateMemoryTool: Tool {
+    var name: String { "update_memory" }
+    var description: String { "Persist long-term memory for the user in Workspace/MEMORY.md. Use when the user asks to remember, update, or forget a fact or preference. Appends the note as a dated bullet by default; set replace to true to rewrite the whole file." }
+
+    func call(arguments: UpdateMemoryArguments) async throws -> String {
+        let replace = arguments.replace ?? false
+        onDeviceToolLog("update_memory called replace=\(replace), noteLength=\(arguments.note.count)")
+        let note = arguments.note.trimmingCharacters(in: .whitespacesAndNewlines)
+        guard !note.isEmpty else {
+            return "Error: No memory note provided."
+        }
+        do {
+            let memoryLength: Int
+            if replace {
+                memoryLength = try PlanetAIMemory.replaceContent(arguments.note)
+            } else {
+                memoryLength = try PlanetAIMemory.appendNote(note)
+            }
+            let mode = replace ? "replace" : "append"
+            onDeviceToolLog("update_memory success mode=\(mode), memoryLength=\(memoryLength)")
+            return "Memory updated (\(mode)); MEMORY.md is now \(memoryLength) character(s)."
+        } catch {
+            onDeviceToolLog("update_memory failed: \(error.localizedDescription)")
+            return "Error: Failed to update memory: \(error.localizedDescription)"
+        }
+    }
+}
+
 // MARK: - Helper
 
 private final class OnDeviceUncheckedSendableBox<Value>: @unchecked Sendable {
@@ -885,6 +925,7 @@ enum OnDeviceToolFactory {
             WritePlanetTool(context: context),
             SearchArticlesTool(),
             GrepTool(),
+            UpdateMemoryTool(),
         ]
         return (tools, context)
     }
```

**File**: `Planet/Views/Articles/PlanetAIMemory.swift` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+//
+//  PlanetAIMemory.swift
+//  Planet
+//
+
+import Foundation
+
+/// Persistent memory for AI chat, stored as Workspace/MEMORY.md at the Planet library root.
+enum PlanetAIMemory {
+    static let workspaceFolderName = "Workspace"
+    static let memoryFileName = "MEMORY.md"
+
+    /// Cap how much of MEMORY.md gets inlined into the system prompt.
+    private static let maxPromptLength = 24_000
+
+    private static let seedContent = """
+    # Memory
+
+    Notes for the Planet AI assistant to remember across conversations.
+    Edit this file freely, or ask the assistant in a chat to remember something; \
+    it reads this file at the start of every chat.
+
+    """
+
+    static var workspaceURL: URL {
+        URLUtils.repoPath().appendingPathComponent(workspaceFolderName, isDirectory: true)
+    }
+
+    static var memoryFileURL: URL {
+        workspaceURL.appendingPathComponent(memoryFileName)
+    }
+
+    @discardableResult
+    static func ensureMemoryFile() -> URL {
+        let fileManager = FileManager.default
+        if !fileManager.fileExists(atPath: workspaceURL.path) {
+            try? fileManager.createDirectory(at: workspaceURL, withIntermediateDirectories: true)
+        }
+        if !fileManager.fileExists(atPath: memoryFileURL.path) {
+            try? seedContent.write(to: memoryFileURL, atomically: true, encoding: .utf8)
+        }
+        return memoryFileURL
+    }
+
+    /// Memory contents to inline into a chat system prompt, or nil when there is nothing to apply.
+    static func loadForPrompt() -> String? {
+        ensureMemoryFile()
+        guard let raw = try? String(contentsOf: memoryFileURL, encoding: .utf8) else {
+            return nil
+        }
+        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
+        guard !trimmed.isEmpty else {
+            return nil
+        }
+        if trimmed.count > maxPromptLength {
+            return String(trimmed.prefix(maxPromptLength))
+                + "\n\n[MEMORY.md truncated; read Workspace/MEMORY.md for the full contents.]"
+        }
+        return trimmed
+    }
+
+    /// Append a dated note to MEMORY.md. Returns the new total length in characters.
+    @discardableResult
+    static func appendNote(_ note: String) throws -> Int {
+        ensureMemoryFile()
+        var content = (try? String(contentsOf: memoryFileURL, encoding: .utf8)) ?? ""
+        if !content.isEmpty, !content.hasSuffix("\n") {
+            content += "\n"
+        }
+        let formatter = DateFormatter()
+        formatter.locale = Locale(identifier: "en_US_POSIX")
+        formatter.dateFormat = "yyyy-MM-dd"
+        let entry = note.trimmingCharacters(in: .whitespacesAndNewlines)
+        content += "- [\(formatter.string(from: Date()))] \(entry)\n"
+        try content.write(to: memoryFileURL, atomically: true, encoding: .utf8)
+        return content.count
+    }
+
+    /// Replace the entire MEMORY.md. Returns the new total length in characters.
+    @discardableResult
+    static func replaceContent(_ newContent: String) throws -> Int {
+        let fileManager = FileManager.default
+        if !fileManager.fileExists(atPath: workspaceURL.path) {
+            try fileManager.createDirectory(at: workspaceURL, withIntermediateDirectories: true)
+        }
+        let trimmed = newContent.trimmingCharacters(in: .whitespacesAndNewlines)
+        let content = trimmed.isEmpty ? seedContent : trimmed + "\n"
+        try content.write(to: memoryFileURL, atomically: true, encoding: .utf8)
+        return content.count
+    }
+}
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2831
+CURRENT_PROJECT_VERSION = 2832
```

---

### Incident Patch 4: `e03604fb` (2026-06-11)
**Commit Message**: Fix macOS 12 crash from dangling unowned planet references

Crash report (0.22.3 build 2824, SIGABRT in swift_abortRetainUnowned)
showed stale article rows retained by SwiftUI's List reading the unowned
planet reference after a store reload replaced planet instances; macOS 12
evaluates contextMenu builders eagerly during row-height computation, so
merely diffing the list crashed.

- Convert MyArticleModel.planet and FollowingArticleModel.planet from
  unowned IUO to weak Optional; every dereference is now an explicit
  guard, optional chain, or documented force unwrap
- Guard mutation entry points (save/delete/removeSlug/savePublic*) so
  stale instances can neither trap nor overwrite current files with
  stale data; SearchArticleSnapshot.init(article:) is failable
- Make the FSEvents external-data reload identity-preserving: new
  MyPlanetModel.update(from:) and MyArticleModel.update(from:) merge
  freshly loaded data into existing instances by id, keeping selection
  and scroll position intact (also fixes the list scroll jump)
- Load drafts/ops/template cache once per planet per reload via
  loadAuxiliaryData() and load(from:includeAuxiliaryData:)
- Resolve save-flow selection re

**File**: `Planet.xcodeproj/project.pbxproj` (modified, +6/-0)
```diff
@@ -559,10 +559,12 @@
 		8E1035B8735325B803F6938C /* PNDiskStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = E073A385BB7A7839A414A902 /* PNDiskStore.swift */; };
 		8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8A2FA88FEC08699B75D7818C /* FeatureFlags.swift */; };
 		8F33EB5B385321311DA2AF54 /* AppLogView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 196AB5BD526941A7FAB5D1AD /* AppLogView.swift */; };
+		930B0748E616F70F9F7FF489 /* ModelUpdateFieldCoverageCheck.swift in Sources */ = {isa = PBXBuildFile; fileRef = 14F7B76DB94C513A9D189B3C /* ModelUpdateFieldCoverageCheck.swift */; };
 		9D3C01152F6C7DAF50871B06 /* PNAPIClient.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16241C46F4F9D954C3BF6BBF /* PNAPIClient.swift */; };
 		9F1807DD072155243C041DFC /* ThemeColorExtractor.swift in Sources */ = {isa = PBXBuildFile; fileRef = 412635EFFFDD8D11BBC4BC56 /* ThemeColorExtractor.swift */; };
 		9F283A9A8EA2592CEC565037 /* SearchIndex.swift in Sources */ = {isa = PBXBuildFile; fileRef = 44BF4852CA45DC20EE145C58 /* SearchIndex.swift */; };
 		A14E34849B8C45E69780141C /* SearchDatabase.swift in Sources */ = {isa = PBXBuildFile; fileRef = CB6EC2B7EEF3EF83DA342363 /* SearchDatabase.swift */; };
+		A2587363679B28FC942BC9C8 /* ModelUpdateFieldCoverageCheck.swift in Sources */ = {isa = PBXBuildFile; fileRef = 14F7B76DB94C513A9D189B3C /* ModelUpdateFieldCoverageCheck.swift */; };
 		A310844E599715564A5B908D /* PNModels.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4454B175F94AFF29C4CC394F /* PNModels.swift */; };
 		A8E3461C94DD9CF45659CC72 /* PlanetAIChatSessionsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4C06A60D631FAB5EEF3BAF8C /* PlanetAIChatSessionsView.swift */; };
 		B1554926223D7E6D8B65E40D /* DragPasteboardMedia.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */; };
@@ -665,6 +667,7 @@
 		03E9DC5C055F824D215A8981 /* MarkdownEditorTextView.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = MarkdownEditorTextView.swift; sourceTree = "<group>"; };
 		0B14374A86131144DC199477 /* ArticleAIOnDeviceTools.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ArticleAIOnDeviceTools.swift; sourceTree = "<group>"; };
 		133C6811D1EA3279EA0ECB21 /* pt */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = pt; path = pt.lproj/InfoPlist.strings; sourceTree = "<group>"; };
+		14F7B76DB94C513A9D189B3C /* ModelUpdateFieldCoverageCheck.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ModelUpdateFieldCoverageCheck.swift; sourceTree = "<group>"; };
 		16241C46F4F9D954C3BF6BBF /* PNAPIClient.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PNAPIClient.swift; sourceTree = "<group>"; };
 		16C059C53BCDB7CBCB2507A0 /* de */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = de; path = de.lproj/Localizable.strings; sourceTree = "<group>"; };
 		196AB5BD526941A7FAB5D1AD /* AppLogView.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = AppLogView.swift; sourceTree = "<group>"; };
@@ -1848,6 +1851,7 @@
 				72114E45790363ADCC6F7673 /* DraftModel.swift */,
 				721143E2F2DEA3A694022B20 /* AttachmentModel.swift */,
 				6A43E7D02B873F4900316F81 /* SearchResult.swift */,
+				14F7B76DB94C513A9D189B3C /* ModelUpdateFieldCoverageCheck.swift */,
 			);
 			path = Entities;
 			sourceTree = "<group>";
@@ -2433,6 +2437,7 @@
 				6AADD6C72AF8809600898A6E /* MyArticleModel+SavePublic.swift in Sources */,
 				BF9F577F9FFA8A77F474CF1A /* PlanetStore+Spotlight.swift in Sources */,
 				6B50625D6A91C63998683BCA /* DragPasteboardMedia.swift in Sources */,
+				930B0748E616F70F9F7FF489 /* ModelUpdateFieldCoverageCheck.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -2681,6 +2686,7 @@
 				9F1807DD072155243C041DFC /* ThemeColorExtractor.swift in Sources */,
 				8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */,
 				B1554926223D7E6D8B65E40D /* DragPasteboardMedia.swift in Sources */,
+				A2587363679B28FC942BC9C8 /* ModelUpdateFieldCoverageCheck.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `Planet/Entities/DraftModel.swift` (modified, +9/-4)
```diff
@@ -38,14 +38,16 @@ class DraftModel: Identifiable, Equatable, Hashable, Codable, ObservableObject {
     // populated when initializing
     var target: DraftTarget!
 
+    // Invariant: drafts are only created for live articles, whose planet is set;
+    // these lazies are first evaluated at draft creation. The force unwraps are deliberate.
     lazy var planetUUIDString: String = {
         switch target! {
         case .myPlanet(let wrapper):
             let planet = wrapper.value
             return planet.id.uuidString
         case .article(let wrapper):
             let article = wrapper.value
-            return article.planet.id.uuidString
+            return article.planet!.id.uuidString
         }
     }()
 
@@ -54,15 +56,15 @@ class DraftModel: Identifiable, Equatable, Hashable, Codable, ObservableObject {
         case .myPlanet(let wrapper):
             return wrapper.value
         case .article(let wrapper):
-            return wrapper.value.planet
+            return wrapper.value.planet!
         }
     }()
 
     lazy var basePath: URL = {
         switch target! {
         case .article(let wrapper):
             let article = wrapper.value
-            return article.planet.articleDraftsPath.appendingPathComponent(
+            return article.planet!.articleDraftsPath.appendingPathComponent(
                 article.id.uuidString,
                 isDirectory: true
             )
@@ -457,7 +459,10 @@ class DraftModel: Identifiable, Equatable, Hashable, Codable, ObservableObject {
         case .article(let wrapper):
             isEditingExistingArticle = true
             article = wrapper.value
-            planet = article.planet
+            guard let articlePlanet = article.planet else {
+                throw PlanetError.InternalError
+            }
+            planet = articlePlanet
             if let articleSlug = article.slug, articleSlug.count > 0 {
                 article.link = "/\(articleSlug)/"
             }
```

**File**: `Planet/Entities/FollowingArticleModel.swift` (modified, +22/-5)
```diff
@@ -18,21 +18,30 @@ class FollowingArticleModel: ArticleModel, Codable {
     var summary: String? = nil
 
     // populated when initializing
-    unowned var planet: FollowingPlanetModel! = nil
+    // weak (not unowned): planet instances are replaced wholesale on store reload, and
+    // stale article models retained by SwiftUI List rows would otherwise trap on any
+    // read of a dangling unowned reference (swift_abortRetainUnowned, macOS 12).
+    weak var planet: FollowingPlanetModel? = nil
 
-    lazy var path = planet.articlesPath.appendingPathComponent("\(id.uuidString).json", isDirectory: false)
+    // Invariant: planet is assigned right after init/decode and outlives normal use of
+    // these paths; mutation entry points (save/delete) guard against a nil planet
+    // before first access. The force unwrap is deliberate.
+    lazy var path = planet!.articlesPath.appendingPathComponent("\(id.uuidString).json", isDirectory: false)
 
-    lazy var localPreviewPath = planet.articlesPath.appendingPathComponent("\(id.uuidString)-local.html", isDirectory: false)
+    lazy var localPreviewPath = planet!.articlesPath.appendingPathComponent("\(id.uuidString)-local.html", isDirectory: false)
 
     var supportsReaderView: Bool {
-        planet.planetType == .dns
+        planet?.planetType == .dns
     }
 
     var supportsReadAloud: Bool {
-        planet.planetType == .dns || planet.planetType == .dnslink
+        planet?.planetType == .dns || planet?.planetType == .dnslink
     }
 
     func renderLocalPreview(fontSize: CGFloat = 14) throws -> URL {
+        guard let planet = planet else {
+            throw PlanetError.InternalError
+        }
         guard let templateURL = Bundle.main.url(forResource: "WriterBasic", withExtension: "html") else {
             throw PlanetError.RenderMarkdownError
         }
@@ -115,6 +124,7 @@ class FollowingArticleModel: ArticleModel, Codable {
     }
 
     var webviewURL: URL? {
+        guard let planet = planet else { return nil }
         debugPrint("Generating webviewURL: planet.type: \(planet.planetType) planet.link: \(planet.link) article.link: \(link)")
         switch planet.planetType {
         case .planet, .dnslink, .ens, .dotbit:
@@ -176,6 +186,7 @@ class FollowingArticleModel: ArticleModel, Codable {
     }
     /// URL that can be viewed and shared in a regular browser.
     var browserURL: URL? {
+        guard let planet = planet else { return nil }
         debugPrint("Generating browserURL: planet.type: \(planet.planetType) planet.link: \(planet.link) article.link: \(link)")
         switch planet.planetType {
         case .planet:
@@ -421,11 +432,17 @@ class FollowingArticleModel: ArticleModel, Codable {
     }
 
     func save() throws {
+        // A nil planet means this instance went stale after a store reload;
+        // writing would clobber the current article file with stale data.
+        guard planet != nil else {
+            throw PlanetError.InternalError
+        }
         try JSONEncoder.shared.encode(self).write(to: path, options: .atomic)
         PlanetStore.upsertSearchSnapshotIfReady(for: self)
     }
 
     func delete() {
+        guard planet != nil else { return }
         PlanetStore.removeSearchSnapshotIfReady(articleID: self.id)
         try? FileManager.default.removeItem(at: path)
     }
```

**File**: `Planet/Entities/ModelUpdateFieldCoverageCheck.swift` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+#if DEBUG
+import Foundation
+
+/// Debug-build self-test guarding the hand-maintained field lists in
+/// `MyPlanetModel.update(from:)` and `MyArticleModel.update(from:)` against
+/// drifting from `CodingKeys` when persisted fields are added.
+///
+/// Strategy: decode a fully-populated fixture (A) and a minimal fixture (B)
+/// sharing the same identity, run `B.update(from: A)`, re-encode both, and
+/// compare. A field missing from `update(from:)` keeps its default in B and
+/// the encoded dictionaries differ. Before that, assert A's encoded output
+/// contains every `CodingKeys` case — so adding a key to the model without
+/// extending the fixture (and `update(from:)`) fails the check too.
+enum ModelUpdateFieldCoverageCheck {
+    static func run() {
+        do {
+            try checkMyPlanetModel()
+            try checkMyArticleModel()
+            debugPrint("ModelUpdateFieldCoverageCheck passed")
+        }
+        catch {
+            assertionFailure("ModelUpdateFieldCoverageCheck failed: \(error)")
+        }
+    }
+
+    private enum CheckError: Error, CustomStringConvertible {
+        case fixtureMissingKeys(model: String, keys: [String])
+        case updateMissedFields(model: String, keys: [String])
+
+        var description: String {
+            switch self {
+            case .fixtureMissingKeys(let model, let keys):
+                return
+                    "\(model): full fixture does not cover CodingKeys \(keys) — extend the fixture in ModelUpdateFieldCoverageCheck AND make sure update(from:) copies the new fields"
+            case .updateMissedFields(let model, let keys):
+                return
+                    "\(model): update(from:) does not copy fields \(keys) — keep it in sync with CodingKeys"
+            }
+        }
+    }
+
+    private static func checkMyPlanetModel() throws {
+        let id = "11111111-2222-3333-4444-555555555555"
+        let full: [String: Any] = [
+            "id": id,
+            "name": "Full Planet",
+            "about": "About text",
+            "domain": "example.eth",
+            "authorName": "Author",
+            "slug": "full-planet",
+            "nextArticleNumber": 42,
+            "ipns": "k51qzi5uqu5dgv8kzl1anc0m74n6t9ffdjnypdh846ct5wgpljc7rulynxa74a",
+            "created": 700000000.0,
+            "updated": 700000001.0,
+            "templateName": "Plain",
+            "lastPublished": 700000002.0,
+            "lastPublishedCID": "bafytestcid",
+            "archived": true,
+            "archivedAt": 700000003.0,
+            "plausibleEnabled": true,
+            "plausibleDomain": "stats.example.com",
+            "plausibleAPIKey": "plausible-key",
+            "plausibleAPIServer": "plausible.example.com",
+            "twitterUsername": "twitter",
+            "githubUsername": "github",
+            "telegramUsername": "telegram",
+            "mastodonUsername": "mastodon",
+            "discordLink": "https://discord.gg/test",
+            "dWebServicesEnabled": true,
+            "dWebServicesDomain": "dweb.example.com",
+            "dWebServicesAPIKey": "dweb-key",
+            "pinnableEnabled": true,
+            "pinnableAPIEndpoint": "https://pinnable.example.com",
+            "pinnablePinCID": "bafypinnable",
+            "filebaseEnabled": true,
+            "filebasePinName": "pin-name",
+            "filebaseAPIToken": "filebase-token",
+            "filebaseRequestID": "filebase-request",
+            "filebasePinCID": "bafyfilebase",
+            "customCodeHeadEnabled": true,
+            "customCodeHead": "<meta>",
+            "customCodeBodyStartEnabled": true,
+            "customCodeBodyStart": "<div>",
+            "customCodeBodyEndEnabled": true,
+            "customCodeBodyEnd": "</div>",
+            "podcastCategories": ["Technology": ["Tech News"]],
+            "podcastLanguage": "de",
+            "podcastExplicit": true,
+            "juiceboxEnabled": true,
+            "juiceboxProjectID": 7,
+            "juiceboxProjectIDGoerli": 8,
+            "acceptsDonation": true,
+            "acceptsDonationMessage": "Donate",
+            "acceptsDonationETHAddress": "0x0000000000000000000000000000000000000001",
+            "tags": ["tag": "Tag"],
+            "aggregation": ["https://example.com/feed.xml"],
+            "reuseOriginalID": true,
+            "saveRoundAvatar": true,
+            "doNotIndex": true,
+            "prewarmNewPost": false,
+            "publishAsIPNS": false,
+            "sshRsyncEnabled": true,
+            "sshRsyncDestination": "user@host:/var/www/site",
+            "sshRsyncKeyPath": "/Users/test/.ssh/id_ed25519",
+            "sshRsyncDeleteEnabled": true,
+            "cloudflarePagesEnabled": true,
+            "cloudflarePagesAccountID": "cf-account",
+            "cloudflarePagesAPIToken": "cf-token",
+            "cloudflarePagesProjectName": "cf-project",
+            "cloudflarePagesLastDeployedProjectName": "c
```

**File**: `Planet/Entities/MyArticleModel+Save.swift` (modified, +21/-9)
```diff
@@ -17,6 +17,11 @@ extension MyArticleModel {
 
     /// Persist any changes to the model.
     func save(markingModified: Bool = false) throws {
+        // A nil planet means this instance went stale after a store reload;
+        // writing would clobber the current article file with stale data.
+        guard let planet = planet else {
+            throw PlanetError.InternalError
+        }
         if markingModified {
             markModified()
         }
@@ -33,12 +38,13 @@ extension MyArticleModel {
 
     /// Delete the metadata and any in the public folder
     func delete() {
+        guard let planet = planet else { return }
         if let slug = self.slug, slug.count > 0 {
             self.removeSlug(slug)
         }
         PlanetStore.removeSearchSnapshotIfReady(articleID: self.id)
         let removeArticle = {
-            self.planet.articles.removeAll { $0.id == self.id }
+            planet.articles.removeAll { $0.id == self.id }
         }
         if Thread.isMainThread {
             removeArticle()
@@ -56,6 +62,7 @@ extension MyArticleModel {
         if slugToRemove.count == 0 || slug.count == 0 {
             return
         }
+        guard let planet = planet else { return }
         let slugPath = planet.publicBasePath.appendingPathComponent(
             slugToRemove,
             isDirectory: true
@@ -79,11 +86,14 @@ extension MyArticleModel {
     }
 
     private func savePublicInternal(saveOpsAfterwards: Bool) throws {
+        guard let planet = planet else {
+            throw PlanetError.InternalError
+        }
         var perfTrace = ArticlePerfTrace(
-            planetID: self.planet.id,
+            planetID: planet.id,
             articleID: self.id,
             articleTitle: self.title,
-            enabled: self.planet.isRebuilding
+            enabled: planet.isRebuilding
         )
 
         do {
@@ -148,7 +158,7 @@ extension MyArticleModel {
 
             if saveOpsAfterwards {
                 do {
-                    try self.planet.saveOps()
+                    try planet.saveOps()
                 }
                 catch {
                     debugPrint("failed to save ops to file: \(error)")
@@ -271,11 +281,12 @@ extension MyArticleModel {
     }
 
     func saveVideoThumbnail() {
+        guard let planet = planet else { return }
         guard let videoFilename = self.videoFilename else { return }
         let videoThumbnailFilename = "_videoThumbnail.png"
         let videoThumbnailPath = publicBasePath.appendingPathComponent(videoThumbnailFilename)
         let opKey = "\(self.id)-video-thumbnail-\(videoFilename)"
-        if let op = self.planet.opDate(for: opKey),
+        if let op = planet.opDate(for: opKey),
             FileManager.default.fileExists(atPath: videoThumbnailPath.path)
         {
             debugPrint("Video thumbnail operation for \(opKey) is already done at \(op)")
@@ -286,7 +297,7 @@ extension MyArticleModel {
         {
             try? data.write(to: videoThumbnailPath)
         }
-        self.planet.recordOp(opKey)
+        planet.recordOp(opKey)
     }
 
     func getVideoThumbnail() -> NSImage? {
@@ -424,6 +435,7 @@ extension MyArticleModel {
      If the article has a hero image, generate a grid version of it.
      */
     func saveHeroGrid() {
+        guard let planet = planet else { return }
         guard let heroImageFilename = self.getHeroImage() else { return }
         let heroImagePath = publicBasePath.appendingPathComponent(
             heroImageFilename,
@@ -434,7 +446,7 @@ extension MyArticleModel {
         let heroGridJPEGFilename = "_grid.jpg"
         let heroGridJPEGPath = publicBasePath.appendingPathComponent(heroGridJPEGFilename)
         let opKey = "\(self.id)-hero-grid-\(heroImageFilename)"
-        if let op = self.planet.opDate(for: opKey),
+        if let op = planet.opDate(for: opKey),
             FileManager.default.fileExists(atPath: heroImagePath.path),
             FileManager.default.fileExists(atPath: heroGridPNGPath.path)
         {
@@ -454,7 +466,7 @@ extension MyArticleModel {
             self.hasHeroGrid = true
         }
         debugPrint("Hero grid is saved for \(self.title)")
-        self.planet.recordOp(opKey)
+        planet.recordOp(opKey)
     }
 
     var heroGridImage: NSImage? {
@@ -572,7 +584,7 @@ extension MyArticleModel {
         paragraphStyle.alignment = .left
 
         let font: NSFont
-        if planet.templateName == "Croptop" {
+        if planet?.templateName == "Croptop" {
             // Use the pixelated Capsule font for the Croptop template
             font = NSFont(name: "Capsules-500", size: 32) ?? NSFont.systemFont(ofSize: 32)
             debugPrint("Using Capsules-500 font for Croptop: \(font)")
```

**File**: `Planet/Entities/MyArticleModel+SavePublic.swift` (modified, +15/-9)
```diff
@@ -32,7 +32,7 @@ extension MyArticleModel {
         if hasTextOnlyContent() {
             let coverImageText = self.getCoverImageText()
 
-            if self.planet.templateName == "Croptop" {
+            if self.planet?.templateName == "Croptop" {
                 saveCoverImage(
                     with: coverImageText,
                     filename: publicCoverImagePath.path,
@@ -61,11 +61,11 @@ extension MyArticleModel {
     func getCoverImageCIDIfNeeded() -> String? {
         var needsCoverImageCID = false
         if let attachments = self.attachments, attachments.count == 0,
-            self.planet.templateName == "Croptop"
+            self.planet?.templateName == "Croptop"
         {
             needsCoverImageCID = true
         }
-        if audioFilename != nil, self.planet.templateName == "Croptop" {
+        if audioFilename != nil, self.planet?.templateName == "Croptop" {
             needsCoverImageCID = true
         }
 
@@ -80,7 +80,7 @@ extension MyArticleModel {
     func processAttachmentCIDIfNeeded() {
         // This logic is needed because the Croptop grid view needs at least one picture
         if let attachments = self.attachments, attachments.count == 0 {
-            if self.planet.templateName == "Croptop" {
+            if self.planet?.templateName == "Croptop" {
                 // _cover.png CID is only needed by Croptop now
                 let newAttachments: [String] = ["_cover.png"]
                 DispatchQueue.main.async {
@@ -92,7 +92,7 @@ extension MyArticleModel {
         if let attachments = self.attachments {
             attachmentsToProcess = attachments
         }
-        if attachmentsToProcess.count == 0, self.planet.templateName == "Croptop" {
+        if attachmentsToProcess.count == 0, self.planet?.templateName == "Croptop" {
             attachmentsToProcess = ["_cover.png"]
         }
         var attachmentCIDs: [String: String] = self.cids ?? [:]
@@ -140,7 +140,7 @@ extension MyArticleModel {
 
     /// Process NFT metadata
     func processNFTMetadata(with coverImageCID: String?) throws {
-        guard let template = planet.template else {
+        guard let template = planet?.template else {
             throw PlanetError.MissingTemplateError
         }
         if let cids = self.cids, cids.count > 0, let firstKeyValuePair = cids.first,
@@ -227,7 +227,7 @@ extension MyArticleModel {
 
     /// Render article HTML
     func processArticleHTML() throws -> ArticleHTMLPerfBreakdown {
-        guard let template = planet.template else {
+        guard let template = planet?.template else {
             throw PlanetError.MissingTemplateError
         }
 
@@ -284,7 +284,7 @@ extension MyArticleModel {
 
     /// Process slug
     func processSlug() {
-        if let articleSlug = self.slug, articleSlug.count > 0 {
+        if let articleSlug = self.slug, articleSlug.count > 0, let planet = planet {
             let publicSlugBasePath = planet.publicBasePath.appendingPathComponent(
                 articleSlug,
                 isDirectory: true
@@ -301,6 +301,9 @@ extension MyArticleModel {
     /// Minimal save: only renders index.html so ArticleView can display the article immediately.
     /// Call `savePublicDeferred()` afterward to complete cover images, CIDs, hero grids, etc.
     func savePublicMinimal() throws {
+        guard planet != nil else {
+            throw PlanetError.InternalError
+        }
         removeDSStore()
         if !FileManager.default.fileExists(atPath: publicBasePath.path) {
             try FileManager.default.createDirectory(
@@ -315,6 +318,9 @@ extension MyArticleModel {
     /// Complete the remaining savePublic work that was skipped by `savePublicMinimal()`:
     /// cover images, CIDs, NFT metadata, hero grid, hero image size, slug copy, article.json, and ops.
     func savePublicDeferred() throws {
+        guard let planet = planet else {
+            throw PlanetError.InternalError
+        }
         try saveCoverImage()
         savePreviewImageFromPDF()
         let coverImageCID: String? = getCoverImageCIDIfNeeded()
@@ -326,7 +332,7 @@ extension MyArticleModel {
         try JSONEncoder.shared.encode(publicArticle).write(to: publicInfoPath, options: .atomic)
         processSlug()
         do {
-            try self.planet.saveOps()
+            try planet.saveOps()
         } catch {
             debugPrint("failed to save ops to file: \(error)")
         }
```

**File**: `Planet/Entities/MyArticleModel.swift` (modified, +67/-21)
```diff
@@ -37,14 +37,20 @@ class MyArticleModel: ArticleModel, Codable {
     @Published var modified: Date? = nil
 
     // populated when initializing
-    unowned var planet: MyPlanetModel! = nil
+    // weak (not unowned): planet instances are replaced wholesale on store reload, and
+    // stale article models retained by SwiftUI List rows would otherwise trap on any
+    // read of a dangling unowned reference (swift_abortRetainUnowned, macOS 12).
+    weak var planet: MyPlanetModel? = nil
     var draft: DraftModel? = nil
 
-    lazy var path = planet.articlesPath.appendingPathComponent(
+    // Invariant: planet is assigned right after init/decode and outlives normal use of
+    // these paths; mutation entry points (save/delete/savePublic*) guard against a nil
+    // planet before first access. The force unwrap is deliberate.
+    lazy var path = planet!.articlesPath.appendingPathComponent(
         "\(id.uuidString).json",
         isDirectory: false
     )
-    lazy var publicBasePath = planet.publicBasePath.appendingPathComponent(
+    lazy var publicBasePath = planet!.publicBasePath.appendingPathComponent(
         id.uuidString,
         isDirectory: true
     )
@@ -135,13 +141,15 @@ class MyArticleModel: ArticleModel, Codable {
         )
     }
     var localGatewayURL: URL? {
+        guard let planet = planet else { return nil }
         return URL(string: "\(IPFSState.shared.getGateway())/ipns/\(planet.ipns)/\(id.uuidString)/")
     }
     var localPreviewURL: URL? {
         // If API is enabled, use the API URL
         // Otherwise, use the local gateway URL
         let apiEnabled = UserDefaults.standard.bool(forKey: String.settingsAPIEnabled)
         if apiEnabled {
+            guard let planet = planet else { return nil }
             let apiPort =
                 UserDefaults
                 .standard.string(forKey: String.settingsAPIPort) ?? "8086"
@@ -156,6 +164,7 @@ class MyArticleModel: ArticleModel, Codable {
     }
     /// The URL that can be viewed and shared in a regular browser.
     var browserURL: URL? {
+        guard let planet = planet else { return nil }
         var urlPath = "/\(id.uuidString)/"
         if let slug = slug, slug.count > 0 {
             urlPath = "/\(slug)/"
@@ -196,7 +205,7 @@ class MyArticleModel: ArticleModel, Codable {
         }
     }
     var permalinkURL: URL? {
-        if let cid = planet.lastPublishedCID, cid.hasPrefix("bafy") {
+        if let cid = planet?.lastPublishedCID, cid.hasPrefix("bafy") {
             return URL(string: "https://\(cid).eth.sucks\(link)")
         }
         return nil
@@ -242,7 +251,7 @@ class MyArticleModel: ArticleModel, Codable {
         return false
     }
 
-    enum CodingKeys: String, CodingKey {
+    enum CodingKeys: String, CodingKey, CaseIterable {
         case id, articleType,
             link, slug, articleNumber, articleReference,
             heroImage, heroImageWidth, heroImageHeight, externalLink,
@@ -416,6 +425,42 @@ class MyArticleModel: ArticleModel, Codable {
         return article
     }
 
+    /// Refresh this article in place from a freshly loaded copy of the same article,
+    /// preserving object identity so SwiftUI selection and scroll position survive
+    /// external data reloads. Keep the copied fields in sync with `CodingKeys`.
+    func update(from fresh: MyArticleModel) {
+        guard fresh.id == id else { return }
+        articleType = fresh.articleType
+        link = fresh.link
+        slug = fresh.slug
+        articleNumber = fresh.articleNumber
+        heroImage = fresh.heroImage
+        heroImageWidth = fresh.heroImageWidth
+        heroImageHeight = fresh.heroImageHeight
+        hasHeroGrid = fresh.hasHeroGrid
+        externalLink = fresh.externalLink
+        title = fresh.title
+        content = fresh.content
+        contentRendered = fresh.contentRendered
+        summary = fresh.summary
+        created = fresh.created
+        modified = fresh.modified
+        starred = fresh.starred
+        starType = fresh.starType
+        videoFilename = fresh.videoFilename
+        audioFilename = fresh.audioFilename
+        attachments = fresh.attachments
+        cids = fresh.cids
+        tags = fresh.tags
+        isIncludedInNavigation = fresh.isIncludedInNavigation
+        navigationWeight = fresh.navigationWeight
+        originalSiteName = fresh.originalSiteName
+        originalSiteDomain = fresh.originalSiteDomain
+        originalPostID = fresh.originalPostID
+        originalPostDate = fresh.originalPostDate
+        pinned = fresh.pinned
+    }
+
     static func compose(
         link: String?,
         date: Date = Date(),
@@ -471,9 +516,10 @@ class MyArticleModel: ArticleModel, Codable {
     // MARK: Prewarm
 
     func prewarm() async {
+        guard let planet = planet else { return }
         guard planet.publishAsIPNS ?? true else { return }
         guard let postURL = browserURL else { return }
-        let planetName = self.planet.nam
```

**File**: `Planet/Entities/MyPlanetModel.swift` (modified, +123/-15)
```diff
@@ -981,7 +981,7 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
             && lhs.cloudflarePagesLastDeployedURL == rhs.cloudflarePagesLastDeployedURL
     }
 
-    enum CodingKeys: String, CodingKey {
+    enum CodingKeys: String, CodingKey, CaseIterable {
         case id, name, about, domain, authorName, slug, nextArticleNumber, ipns,
             created, updated,
             templateName, lastPublished, lastPublishedCID,
@@ -1260,7 +1260,10 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
         self.templateName = templateName
     }
 
-    static func load(from directoryPath: URL) throws -> MyPlanetModel {
+    /// Load a planet from its directory. Pass `includeAuxiliaryData: false` when the
+    /// instance is only used as a data source for `update(from:)`, which reloads the
+    /// auxiliary data against the existing instance anyway.
+    static func load(from directoryPath: URL, includeAuxiliaryData: Bool = true) throws -> MyPlanetModel {
         guard let planetID = UUID(uuidString: directoryPath.lastPathComponent) else {
             // directory name is not a UUID
             throw PlanetError.PersistenceError
@@ -1276,17 +1279,6 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
         planet.avatar = NSImage(contentsOf: planet.avatarPath)
         planet.podcastCoverArt = NSImage(contentsOf: planet.podcastCoverArtPath)
 
-        let draftDirectories = try FileManager.default.contentsOfDirectory(
-            at: planet.draftsPath,
-            includingPropertiesForKeys: nil
-        ).filter { $0.hasDirectoryPath }
-        debugPrint(
-            "Loading Planet \(planet.name) drafts from \(draftDirectories.count) directories"
-        )
-        planet.drafts = draftDirectories.compactMap {
-            try? DraftModel.load(from: $0, planet: planet)
-        }
-
         let articleDirectory = directoryPath.appendingPathComponent("Articles", isDirectory: true)
         let articleFiles = try FileManager.default.contentsOfDirectory(
             at: articleDirectory,
@@ -1302,11 +1294,127 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
             }
             try? planet.save()
         }
-        try? planet.loadOps()
-        try? planet.loadTemplateSettingsAndFiltersCache()
+        if includeAuxiliaryData {
+            try planet.loadAuxiliaryData()
+        }
         return planet
     }
 
+    /// Load drafts, publish ops, and the template settings cache from disk.
+    /// Split out of `load(from:)` so in-place reloads can run it against the
+    /// existing instance instead of the freshly loaded data source.
+    func loadAuxiliaryData() throws {
+        let draftDirectories = try FileManager.default.contentsOfDirectory(
+            at: draftsPath,
+            includingPropertiesForKeys: nil
+        ).filter { $0.hasDirectoryPath }
+        debugPrint(
+            "Loading Planet \(name) drafts from \(draftDirectories.count) directories"
+        )
+        drafts = draftDirectories.compactMap {
+            try? DraftModel.load(from: $0, planet: self)
+        }
+        try? loadOps()
+        try? loadTemplateSettingsAndFiltersCache()
+    }
+
+    /// Refresh this planet in place from a freshly loaded copy of the same planet,
+    /// preserving object identity so SwiftUI selection and scroll position survive
+    /// external data reloads. `fresh` is treated as a data source only and must not
+    /// be retained afterwards. Keep the copied fields in sync with `CodingKeys`.
+    /// Transient runtime state (isPublishing, isRebuilding, metrics, …) is kept.
+    func update(from fresh: MyPlanetModel) {
+        guard fresh.id == id else { return }
+        name = fresh.name
+        about = fresh.about
+        domain = fresh.domain
+        authorName = fresh.authorName
+        slug = fresh.slug
+        nextArticleNumber = fresh.nextArticleNumber
+        updated = fresh.updated
+        templateName = fresh.templateName
+        lastPublished = fresh.lastPublished
+        lastPublishedCID = fresh.lastPublishedCID
+        archived = fresh.archived
+        archivedAt = fresh.archivedAt
+        plausibleEnabled = fresh.plausibleEnabled
+        plausibleDomain = fresh.plausibleDomain
+        plausibleAPIKey = fresh.plausibleAPIKey
+        plausibleAPIServer = fresh.plausibleAPIServer
+        twitterUsername = fresh.twitterUsername
+        githubUsername = fresh.githubUsername
+        telegramUsername = fresh.telegramUsername
+        mastodonUsername = fresh.mastodonUsername
+        discordLink = fresh.discordLink
+        dWebServicesEnabled = fresh.dWebServicesEnabled
+        dWebServicesDomain = fresh.dWebServicesDomain
+        dWebServicesAPIKey = fresh.dWebServicesAPIKey
+        pinnableEnabled = fresh.pinnableEnabled
+        pinnableAPIEndpoint = fresh.pinnableAPIEndpoint
+        pinnablePinCID 
```

---

### Incident Patch 5: `6391560f` (2026-06-10)
**Commit Message**: Render inline LaTeX math in AI chat as Unicode text

Models like Gemma emit inline TeX such as $x \cdot y = k$ or
$\frac{a}{b} \times c$, which previously displayed raw. Replace the
exact-match latexSymbolMap with a normalizer that finds math spans in
$...$, $$...$$, \(...\) and \[...\] delimiters and converts fractions,
roots, super/subscripts, text wrappers, and symbol commands to plain
Unicode. Dollar spans only count as math when they contain a known TeX
command or are strictly math-shaped, so cashtags like $V2EX and prices
stay literal; code fences and inline code spans are skipped.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `Planet/Views/Articles/ArticleAIChatView.swift` (modified, +470/-31)
```diff
@@ -1803,46 +1803,485 @@ struct ArticleAIChatView: View {
         )
     }
 
-    private static let latexSymbolMap: [(pattern: String, replacement: String)] = [
-        (#"$\approx$"#, "≈"),
-        (#"$\rightarrow$"#, "→"),
-        (#"$\leftarrow$"#, "←"),
-        (#"$\leftrightarrow$"#, "↔"),
-        (#"$\Rightarrow$"#, "⇒"),
-        (#"$\Leftarrow$"#, "⇐"),
-        (#"$\uparrow$"#, "↑"),
-        (#"$\downarrow$"#, "↓"),
-        (#"$\times$"#, "×"),
-        (#"$\div$"#, "÷"),
-        (#"$\pm$"#, "±"),
-        (#"$\neq$"#, "≠"),
-        (#"$\leq$"#, "≤"),
-        (#"$\geq$"#, "≥"),
-        (#"$\infty$"#, "∞"),
-        (#"$\alpha$"#, "α"),
-        (#"$\beta$"#, "β"),
-        (#"$\gamma$"#, "γ"),
-        (#"$\delta$"#, "δ"),
-        (#"$\pi$"#, "π"),
-        (#"$\sum$"#, "∑"),
-        (#"$\prod$"#, "∏"),
-        (#"$\sqrt$"#, "√"),
-        (#"$\degree$"#, "°"),
-        (#"$\cdot$"#, "·"),
-        (#"$\ldots$"#, "…"),
-        (#"$\sim$"#, "∼"),
+    // MARK: - LaTeX math normalization
+    //
+    // Models like Gemma emit inline TeX math such as `$x \cdot y = k$` or
+    // `$\frac{V2EX \text{ 数量}}{SOL \text{ 数量}} \times 1$`. The chat renderer is
+    // plain-text based, so math spans are converted to Unicode text. The same
+    // models also use dollar-prefixed cashtags like `$V2EX`, so a `$...$` span is
+    // only treated as math when it contains a known TeX command.
+
+    private static let latexSymbolCommands: [String: String] = [
+        // Operators and relations
+        "times": "×", "div": "÷", "cdot": "·", "pm": "±", "mp": "∓",
+        "neq": "≠", "ne": "≠", "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥",
+        "approx": "≈", "equiv": "≡", "sim": "∼", "simeq": "≃", "cong": "≅",
+        "propto": "∝", "ll": "≪", "gg": "≫", "ast": "∗", "star": "⋆",
+        "bullet": "•", "circ": "∘", "oplus": "⊕", "otimes": "⊗",
+        // Arrows
+        "rightarrow": "→", "to": "→", "leftarrow": "←", "gets": "←",
+        "leftrightarrow": "↔", "Rightarrow": "⇒", "implies": "⇒",
+        "Leftarrow": "⇐", "Leftrightarrow": "⇔", "iff": "⇔",
+        "uparrow": "↑", "downarrow": "↓", "mapsto": "↦",
+        // Sets and logic
+        "in": "∈", "notin": "∉", "subset": "⊂", "supset": "⊃",
+        "subseteq": "⊆", "supseteq": "⊇", "cup": "∪", "cap": "∩",
+        "emptyset": "∅", "varnothing": "∅", "forall": "∀", "exists": "∃",
+        "neg": "¬", "land": "∧", "lor": "∨", "setminus": "∖",
+        // Calculus and misc
+        "infty": "∞", "partial": "∂", "nabla": "∇", "sum": "∑", "prod": "∏",
+        "int": "∫", "oint": "∮", "degree": "°", "ldots": "…", "cdots": "⋯",
+        "dots": "…", "vdots": "⋮", "prime": "′", "angle": "∠", "perp": "⊥",
+        "parallel": "∥", "therefore": "∴", "because": "∵",
+        // Greek
+        "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ",
+        "epsilon": "ε", "varepsilon": "ε", "zeta": "ζ", "eta": "η",
+        "theta": "θ", "vartheta": "ϑ", "iota": "ι", "kappa": "κ",
+        "lambda": "λ", "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π",
+        "rho": "ρ", "sigma": "σ", "varsigma": "ς", "tau": "τ",
+        "upsilon": "υ", "phi": "φ", "varphi": "φ", "chi": "χ",
+        "psi": "ψ", "omega": "ω",
+        "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Xi": "Ξ",
+        "Pi": "Π", "Sigma": "Σ", "Upsilon": "Υ", "Phi": "Φ", "Psi": "Ψ",
+        "Omega": "Ω",
+        // Function names render as themselves
+        "log": "log", "ln": "ln", "lg": "lg", "exp": "exp",
+        "sin": "sin", "cos": "cos", "tan": "tan", "cot": "cot",
+        "sec": "sec", "csc": "csc", "arcsin": "arcsin", "arccos": "arccos",
+        "arctan": "arctan", "sinh": "sinh", "cosh": "cosh", "tanh": "tanh",
+        "lim": "lim", "min": "min", "max": "max", "sup": "sup", "inf": "inf",
+        "det": "det", "dim": "dim", "mod": "mod", "bmod": "mod", "gcd": "gcd",
+    ]
+
+    // Commands whose brace-group argument is kept as plain text, dropping the wrapper
+    private static let latexTextCommands: Set<String> = [
+        "text", "textbf", "textit", "texttt", "textrm", "textsf",
+        "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathbb", "mathcal",
+        "boldsymbol", "operatorname", "mbox", "hbox",
+        "vec", "hat", "bar", "tilde", "overline", "underline",
+    ]
+
+    private static let latexIgnoredCommands: Set<String> = [
+        "left", "right", "displaystyle", "textstyle", "scriptstyle",
+        "limits", "nolimits",
+        "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr",
+        "biggl", "biggr", "Biggl", "Biggr",
+    ]
+
+    private static let latexSpacingCommands: Set<String> = [
+        "quad", "qquad", "enspace", "thinspace",
+    ]
+
+    private static let knownLatexCommands: Set<String> = {
+        var names = Set(latexSymbolCommands.keys)
+        names.formUnion(latexTextCommands)
+        names.formUnion(latexIgnoredCommands)
+        names.formUnion(latexSpacingCommands)
+        names.fo
```

---

### Incident Patch 6: `74e4dfdb` (2026-06-10)
**Commit Message**: Require Markdown notes from Codex

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2826
+CURRENT_PROJECT_VERSION = 2827
```

**File**: `tools/generate-sparkle-notes/app.py` (modified, +13/-3)
```diff
@@ -319,6 +319,16 @@ def markdown_to_html(md_text):
     return '\n'.join(html_lines)
 
 
+def normalize_markdown_notes(raw):
+    """Return bullet-only Markdown notes from model output; reject HTML."""
+    notes = '\n'.join(line.strip() for line in raw.split('\n') if line.strip().startswith('- '))
+    if not notes:
+        return ''
+    if re.search(r'</?[a-zA-Z][^>]*>', notes):
+        raise ValueError('codex returned HTML instead of Markdown')
+    return notes
+
+
 def search_notes(query):
     """Search tag names and note contents across all channels. Returns [(channel, tag, snippet)]."""
     results = []
@@ -358,12 +368,12 @@ def generate_notes_with_codex(commits, prev_tag, tag):
         "- Include only changes that affect people using the Planet macOS app UI or behavior.\n"
         "- Skip this release-notes utility, scripts, CI, build/release automation, tests, docs, generated metadata, version bumps, refactors, and internal infrastructure unless the commit clearly describes a user-visible app change.\n\n"
         "Output format:\n"
-        "- Return only Markdown bullets. No heading, sections, preamble, explanation, blank lines, or code fences.\n"
+        "- Return only plain Markdown bullets. No HTML, heading, sections, preamble, explanation, blank lines, or code fences.\n"
         "- Every output line must start with '- '.\n"
         "- Bullet format: - **Bold short label** — concise end-user description.\n"
         "- Group closely related commits; do not duplicate the same feature or fix under multiple labels.\n"
         "- Aim for 3-12 bullets. If there are no qualifying app-facing changes, output exactly '- No user-facing Planet app changes.'\n"
-        "- Do not include commit hashes, author names, issue/PR numbers, file paths, dependency names, or implementation details.\n"
+        "- Do not include HTML tags, commit hashes, author names, issue/PR numbers, file paths, dependency names, or implementation details.\n"
         "- Name user-visible features, UI elements, and behaviors specifically when commit subjects provide them.\n\n"
         "Example style:\n"
         "- **Continuity Camera** — Import photos/videos directly from iPhone into Writer\n"
@@ -404,7 +414,7 @@ def generate_notes_with_codex(commits, prev_tag, tag):
         with open(output_path, encoding='utf-8') as f:
             raw = f.read().strip()
         log.info('codex output for %s:\n%s', tag, raw)
-        notes = '\n'.join(line for line in raw.split('\n') if line.startswith('- '))
+        notes = normalize_markdown_notes(raw)
         if not notes:
             raise RuntimeError(f'codex returned no usable notes for {tag}')
         return notes
```

---

### Incident Patch 7: `2a276d01` (2026-05-27)
**Commit Message**: Fix checklist return autocomplete at line start

**File**: `Planet/Helper/MarkdownListAutocomplete.swift` (modified, +18/-2)
```diff
@@ -114,8 +114,24 @@ enum MarkdownListAutocomplete {
                         for: NSRange(location: searchPos, length: 0))
 
         let lineRange = NSRange(location: lineStart, length: contentsEnd - lineStart)
-        let currentLine = ns.substring(with: lineRange)
-        let trimmed = currentLine.trimmingCharacters(in: .whitespaces)
+        let currentLine = ns.substring(with: lineRange) as NSString
+        var firstVisibleOffset = 0
+        while firstVisibleOffset < currentLine.length {
+            let character = currentLine.character(at: firstVisibleOffset)
+            guard let scalar = UnicodeScalar(Int(character)),
+                  CharacterSet.whitespaces.contains(scalar)
+            else {
+                break
+            }
+            firstVisibleOffset += 1
+        }
+
+        // Before the first visible character, Return should insert a plain newline
+        // instead of continuing the current list item.
+        guard cursorPos > lineStart + firstVisibleOffset else { return .none }
+
+        let currentLineString = currentLine as String
+        let trimmed = currentLineString.trimmingCharacters(in: .whitespaces)
 
         // Check if current line is an empty list marker
         let isEmptyNumberedItem = trimmed.range(of: #"^\d+\.$"#, options: .regularExpression) != nil
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2814
+CURRENT_PROJECT_VERSION = 2815
```

---

### Incident Patch 8: `91179eb9` (2026-05-13)
**Commit Message**: Fix browser media drag and drop handling

Add a shared DragPasteboardMedia importer for file URLs, file promises, and direct pasteboard media data from browser drags.

Use the shared importer from Article List, Quick Post, Quick Share, and Writer so Chrome and x.com image drops follow the same code path.

Prevent text editors from inserting browser drag placeholder text such as Image when the drop actually contains importable media.

Make pasteboard media import more resilient by falling back from file URLs to raw item data, trying alternate media flavors after conversion failures, parsing file URL item representations more broadly, and avoiding duplicate imports when a file URL import already succeeded.

Register DragPasteboardMedia.swift in the Xcode project and verify the Planet macOS Debug build with CODE_SIGNING_ALLOWED=NO.

**File**: `Planet.xcodeproj/project.pbxproj` (modified, +6/-0)
```diff
@@ -506,6 +506,7 @@
 		6AFCF7E42B7353FE002299BA /* DequeModule in Frameworks */ = {isa = PBXBuildFile; productRef = 6AFCF7E32B7353FE002299BA /* DequeModule */; };
 		6AFCF7E62B7353FE002299BA /* OrderedCollections in Frameworks */ = {isa = PBXBuildFile; productRef = 6AFCF7E52B7353FE002299BA /* OrderedCollections */; };
 		6AFCF7E72B737371002299BA /* TemplateMonitor.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2AC889412B71D4200090D355 /* TemplateMonitor.swift */; };
+		6B50625D6A91C63998683BCA /* DragPasteboardMedia.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */; };
 		71C58E70CF3E3F8A86F9ADF4 /* RelatedArticlesView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5CE71A58A58525049CC222C6 /* RelatedArticlesView.swift */; };
 		7211413A9B3CC77620629D22 /* ViewUtils.swift in Sources */ = {isa = PBXBuildFile; fileRef = 721143C73AEAD5F0C049DF86 /* ViewUtils.swift */; };
 		7211421E15A5A630DF93A519 /* MyPlanetInfoView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 721144D264DD084A74B49BF8 /* MyPlanetInfoView.swift */; };
@@ -552,6 +553,7 @@
 		9F283A9A8EA2592CEC565037 /* SearchIndex.swift in Sources */ = {isa = PBXBuildFile; fileRef = 44BF4852CA45DC20EE145C58 /* SearchIndex.swift */; };
 		A14E34849B8C45E69780141C /* SearchDatabase.swift in Sources */ = {isa = PBXBuildFile; fileRef = CB6EC2B7EEF3EF83DA342363 /* SearchDatabase.swift */; };
 		A8E3461C94DD9CF45659CC72 /* PlanetAIChatSessionsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4C06A60D631FAB5EEF3BAF8C /* PlanetAIChatSessionsView.swift */; };
+		B1554926223D7E6D8B65E40D /* DragPasteboardMedia.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */; };
 		B2B22802B0B767E09FE903A2 /* ArticleSpeechPlayer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 72A8762054781F152975DEE9 /* ArticleSpeechPlayer.swift */; };
 		BB6FC66D28423AF80072C3A1 /* SwiftSoup in Frameworks */ = {isa = PBXBuildFile; productRef = BB6FC66C28423AF80072C3A1 /* SwiftSoup */; };
 		BB7FC8752898C70A00359802 /* libcmark_gfm in Frameworks */ = {isa = PBXBuildFile; productRef = BB7FC8742898C70A00359802 /* libcmark_gfm */; };
@@ -788,6 +790,7 @@
 		2AFB897529BA3ED8003D893E /* PlanetKeyManagerModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PlanetKeyManagerModel.swift; sourceTree = "<group>"; };
 		2AFFD51A28AD760400EDB020 /* HelpLinkButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HelpLinkButton.swift; sourceTree = "<group>"; };
 		2CCA533E0D21FAAEEEB5CE71 /* CoreSpotlight.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = CoreSpotlight.framework; path = System/Library/Frameworks/CoreSpotlight.framework; sourceTree = SDKROOT; };
+		2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DragPasteboardMedia.swift; sourceTree = "<group>"; };
 		342A67E3EAD082AA10974830 /* NaturalLanguage.framework */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = wrapper.framework; name = NaturalLanguage.framework; path = System/Library/Frameworks/NaturalLanguage.framework; sourceTree = SDKROOT; };
 		3BF7A284CCD68E7CBE9F9D73 /* fi */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = fi; path = fi.lproj/InfoPlist.strings; sourceTree = "<group>"; };
 		412635EFFFDD8D11BBC4BC56 /* ThemeColorExtractor.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ThemeColorExtractor.swift; sourceTree = "<group>"; };
@@ -1363,6 +1366,7 @@
 				C1A2B3D4E5F6A7B8C9D0E1F2 /* SleepPreventer.swift */,
 				03E9DC5C055F824D215A8981 /* MarkdownEditorTextView.swift */,
 				412635EFFFDD8D11BBC4BC56 /* ThemeColorExtractor.swift */,
+				2F4FA3B2D9A523EB833A02F3 /* DragPasteboardMedia.swift */,
 			);
 			path = Helper;
 			sourceTree = "<group>";
@@ -2270,6 +2274,7 @@
 				C1A2B3D4E5F6A7B8C9D0E1F3 /* SleepPreventer.swift in Sources */,
 				6AADD6C72AF8809600898A6E /* MyArticleModel+SavePublic.swift in Sources */,
 				BF9F577F9FFA8A77F474CF1A /* PlanetStore+Spotlight.swift in Sources */,
+				6B50625D6A91C63998683BCA /* DragPasteboardMedia.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -2517,6 +2522,7 @@
 				B2B22802B0B767E09FE903A2 /* ArticleSpeechPlayer.swift in Sources */,
 				9F1807DD072155243C041DFC /* ThemeColorExtractor.swift in Sources */,
 				8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */,
+				B1554926223D7E6D8B65E40D /* DragPasteboardMedia.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `Planet/Helper/DragPasteboardMedia.swift` (added, +499/-0)
```diff
@@ -0,0 +1,499 @@
+import AppKit
+import Foundation
+import UniformTypeIdentifiers
+
+struct DragPasteboardMediaFile {
+    let url: URL
+    let attachmentType: AttachmentType
+    let isTemporary: Bool
+    let pasteboardType: NSPasteboard.PasteboardType?
+
+    init(
+        url: URL,
+        attachmentType: AttachmentType,
+        isTemporary: Bool,
+        pasteboardType: NSPasteboard.PasteboardType? = nil
+    ) {
+        self.url = url
+        self.attachmentType = attachmentType
+        self.isTemporary = isTemporary
+        self.pasteboardType = pasteboardType
+    }
+}
+
+enum DragPasteboardMedia {
+    struct Flavor {
+        let type: NSPasteboard.PasteboardType
+        let fileExtension: String
+        let attachmentType: AttachmentType
+        let convertsImageDataToPNG: Bool
+
+        init(
+            type: NSPasteboard.PasteboardType,
+            fileExtension: String,
+            attachmentType: AttachmentType,
+            convertsImageDataToPNG: Bool = false
+        ) {
+            self.type = type
+            self.fileExtension = fileExtension
+            self.attachmentType = attachmentType
+            self.convertsImageDataToPNG = convertsImageDataToPNG
+        }
+    }
+
+    static let imageFlavors: [Flavor] = [
+        Flavor(type: NSPasteboard.PasteboardType(UTType.png.identifier), fileExtension: "png", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.jpeg.identifier), fileExtension: "jpg", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType("CorePasteboardFlavorType 0x4A504547"), fileExtension: "jpg", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.gif.identifier), fileExtension: "gif", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.tiff.identifier), fileExtension: "tiff", attachmentType: .image),
+        Flavor(type: .tiff, fileExtension: "tiff", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType("NeXT TIFF v4.0 pasteboard type"), fileExtension: "tiff", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType("public.heic"), fileExtension: "heic", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType("public.heif"), fileExtension: "heif", attachmentType: .image),
+        Flavor(type: NSPasteboard.PasteboardType("public.webp"), fileExtension: "webp", attachmentType: .image),
+        Flavor(
+            type: NSPasteboard.PasteboardType(UTType.image.identifier),
+            fileExtension: "png",
+            attachmentType: .image,
+            convertsImageDataToPNG: true
+        )
+    ]
+
+    static let videoFlavors: [Flavor] = [
+        Flavor(type: NSPasteboard.PasteboardType(UTType.mpeg4Movie.identifier), fileExtension: "mp4", attachmentType: .video),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.quickTimeMovie.identifier), fileExtension: "mov", attachmentType: .video),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.movie.identifier), fileExtension: "mov", attachmentType: .video)
+    ]
+
+    static let audioFlavors: [Flavor] = [
+        Flavor(type: NSPasteboard.PasteboardType(UTType.mp3.identifier), fileExtension: "mp3", attachmentType: .audio),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.mpeg4Audio.identifier), fileExtension: "m4a", attachmentType: .audio),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.wav.identifier), fileExtension: "wav", attachmentType: .audio),
+        Flavor(type: NSPasteboard.PasteboardType(UTType.audio.identifier), fileExtension: "m4a", attachmentType: .audio)
+    ]
+
+    static let documentFlavors: [Flavor] = [
+        Flavor(type: NSPasteboard.PasteboardType(UTType.pdf.identifier), fileExtension: "pdf", attachmentType: .file)
+    ]
+
+    static func readablePasteboardTypes(
+        allowing attachmentTypes: Set<AttachmentType>,
+        includeFileURL: Bool = true
+    ) -> [NSPasteboard.PasteboardType] {
+        let dataTypes = readableDataPasteboardTypes(allowing: attachmentTypes)
+        return includeFileURL ? [.fileURL] + dataTypes : dataTypes
+    }
+
+    static func readableDataPasteboardTypes(
+        allowing attachmentTypes: Set<AttachmentType>
+    ) -> [NSPasteboard.PasteboardType] {
+        flavors(allowing: attachmentTypes).map(\.type)
+    }
+
+    static func containsSupportedMedia(
+        in pasteboard: NSPasteboard,
+        allowing attachmentTypes: Set<AttachmentType>,
+        includeFileURLs: Bool = true
+    ) -> Bool {
+        if includeFileURLs,
+           let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
+           fileURLs.contains(where: { supportedAttachmentType(for: $0, allowing: attachmentTypes) != nil }) {
+            return true
+        }
+
+        let dataTypes = readableDataPasteboardTypes(allowing: attachmentTypes)
+        if let items = pasteboard.pasteboardItems {
+            if items.con
```

**File**: `Planet/Labs/Quick Post/QuickPostView.swift` (modified, +33/-0)
```diff
@@ -489,6 +489,7 @@ final class QuickPostTextEditorContainer: NSView {
         textView.isRichText = false
         textView.usesFontPanel = false
         textView.allowsUndo = true
+        textView.registerForDraggedTypes(QuickPostViewModel.supportedMediaPasteboardTypes)
         let paragraphStyle = NSMutableParagraphStyle()
         paragraphStyle.lineSpacing = 4
         textView.defaultParagraphStyle = paragraphStyle
@@ -569,6 +570,38 @@ final class QuickPostEditorTextView: MarkdownEditorTextView {
         super.paste(sender)
     }
 
+    override var acceptableDragTypes: [NSPasteboard.PasteboardType] {
+        QuickPostViewModel.supportedMediaPasteboardTypes + super.acceptableDragTypes
+    }
+
+    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
+        if viewModel.canImportMedia(from: sender.draggingPasteboard) {
+            return .copy
+        }
+        return super.draggingEntered(sender)
+    }
+
+    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
+        if viewModel.canImportMedia(from: sender.draggingPasteboard) {
+            return .copy
+        }
+        return super.draggingUpdated(sender)
+    }
+
+    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
+        if viewModel.canImportMedia(from: sender.draggingPasteboard) {
+            return true
+        }
+        return super.prepareForDragOperation(sender)
+    }
+
+    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
+        if viewModel.processMediaDropIfAvailable(from: sender.draggingPasteboard) {
+            return true
+        }
+        return super.performDragOperation(sender)
+    }
+
 }
 
 #Preview {
```

**File**: `Planet/Labs/Quick Post/QuickPostViewModel.swift` (modified, +52/-280)
```diff
@@ -9,46 +9,15 @@ import Foundation
 import SwiftUI
 import UniformTypeIdentifiers
 
-private struct QuickPostImportedMediaFile {
-    let url: URL
-    let attachmentType: AttachmentType
-    let isTemporary: Bool
-}
+private typealias QuickPostImportedMediaFile = DragPasteboardMediaFile
 
 class QuickPostViewModel: ObservableObject {
     static let shared = QuickPostViewModel()
 
-    private static let supportedImagePasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.png.identifier), "png"),
-        (NSPasteboard.PasteboardType(UTType.jpeg.identifier), "jpg"),
-        (NSPasteboard.PasteboardType(UTType.gif.identifier), "gif"),
-        (NSPasteboard.PasteboardType(UTType.tiff.identifier), "tiff"),
-        (NSPasteboard.PasteboardType("public.heic"), "heic"),
-        (NSPasteboard.PasteboardType("public.heif"), "heif"),
-        (NSPasteboard.PasteboardType("public.webp"), "webp")
-    ]
-    private static let supportedVideoPasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.mpeg4Movie.identifier), "mp4"),
-        (NSPasteboard.PasteboardType(UTType.quickTimeMovie.identifier), "mov"),
-        (NSPasteboard.PasteboardType(UTType.movie.identifier), "mov")
-    ]
-    private static let supportedAudioPasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.mp3.identifier), "mp3"),
-        (NSPasteboard.PasteboardType(UTType.mpeg4Audio.identifier), "m4a"),
-        (NSPasteboard.PasteboardType(UTType.wav.identifier), "wav"),
-        (NSPasteboard.PasteboardType(UTType.audio.identifier), "m4a")
-    ]
-    static let supportedPasteContentTypes: [UTType] = [
-        .fileURL,
-        .image,
-        .movie,
-        .audio,
-        .mpeg4Movie,
-        .quickTimeMovie,
-        .mp3,
-        .mpeg4Audio,
-        .wav
-    ]
+    private static let supportedAttachmentTypes: Set<AttachmentType> = [.image, .video, .audio]
+    static let supportedMediaPasteboardTypes = DragPasteboardMedia.readablePasteboardTypes(
+        allowing: supportedAttachmentTypes
+    )
 
     @Published var allowedContentTypes: [UTType] = []
     @Published var allowMultipleSelection = false
@@ -105,16 +74,46 @@ class QuickPostViewModel: ObservableObject {
     @discardableResult
     func processMediaPasteIfAvailable() -> Bool {
         let pasteboard = NSPasteboard.general
-        guard pasteboardContainsSupportedMedia(pasteboard) else {
+        return processMediaIfAvailable(from: pasteboard, action: "paste")
+    }
+
+    func canImportMedia(from pasteboard: NSPasteboard) -> Bool {
+        DragPasteboardMedia.containsSupportedMedia(
+            in: pasteboard,
+            allowing: Self.supportedAttachmentTypes
+        )
+    }
+
+    @MainActor
+    @discardableResult
+    func processMediaDropIfAvailable(from pasteboard: NSPasteboard) -> Bool {
+        processMediaIfAvailable(from: pasteboard, action: "drop")
+    }
+
+    @MainActor
+    @discardableResult
+    private func processMediaIfAvailable(from pasteboard: NSPasteboard, action: String) -> Bool {
+        log(
+            "QuickPost media \(action) started types=\(pasteboard.types?.map(\.rawValue).sorted().joined(separator: ",") ?? "nil")"
+        )
+        guard canImportMedia(from: pasteboard) else {
+            log("QuickPost media \(action) skipped: no supported media")
             return false
         }
         do {
-            let pastedFiles = try pastedMediaFiles(from: pasteboard)
-            guard !pastedFiles.isEmpty else { return false }
+            let pastedFiles = try DragPasteboardMedia.importedFiles(
+                from: pasteboard,
+                allowing: Self.supportedAttachmentTypes,
+                convertHEICFileURLsToJPEG: true
+            )
+            guard !pastedFiles.isEmpty else {
+                log("QuickPost media \(action) found no importable files after media scan", level: .warning)
+                return action == "drop"
+            }
             try importMediaFiles(pastedFiles)
-            debugPrint("Pasted files: \(fileURLs)")
+            log("QuickPost media \(action) imported files=\(pastedFiles.map { $0.url.lastPathComponent }.joined(separator: ","))")
         } catch {
-            debugPrint("failed to process pasted media in Quick Post: \(error)")
+            log("QuickPost media \(action) failed error=\(error.localizedDescription)", level: .error)
         }
         return true
     }
@@ -200,75 +199,10 @@ class QuickPostViewModel: ObservableObject {
     }
 
     private func supportedAttachmentType(for url: URL) -> AttachmentType? {
-        guard url.isFileURL else { return nil }
-        if let fileType = UTType(filenameExtension: url.pathExtension.lowercased()) {
-            if fileType.conforms(to: .image) {
-                return .image
-            }

```

**File**: `Planet/Quick Share/PlanetQuickShareDropDelegate.swift` (modified, +253/-7)
```diff
@@ -3,37 +3,67 @@
 //  Planet
 //
 
+import AppKit
 import Foundation
 import SwiftUI
 import UniformTypeIdentifiers
 
 
 class PlanetQuickShareDropDelegate: DropDelegate {
+    private final class ActiveFilePromise: @unchecked Sendable {
+        let id = UUID()
+        let receiver: NSFilePromiseReceiver
+        let destinationDirectory: URL
+        let queue: OperationQueue
+
+        init(receiver: NSFilePromiseReceiver, destinationDirectory: URL) {
+            self.receiver = receiver
+            self.destinationDirectory = destinationDirectory
+            self.queue = OperationQueue()
+            self.queue.name = "xyz.planetable.Planet.drag-drop.file-promise.\(id.uuidString)"
+            self.queue.qualityOfService = .userInitiated
+        }
+    }
+
+    private static let activePromiseLock = NSLock()
+    private static var activePromises: [UUID: ActiveFilePromise] = [:]
+
+    static let supportedContentTypes: [UTType] = {
+        let filePromiseTypes = NSFilePromiseReceiver.readableDraggedTypes.map {
+            UTType($0) ?? UTType(importedAs: $0)
+        }
+        return filePromiseTypes + [.fileURL, .image, .movie, .pdf, .mp3]
+    }()
+
     init() {}
 
     static func processDropInfo(_ info: DropInfo) async -> [URL] {
+        log(
+            "processDropInfo started providers=\(info.itemProviders(for: supportedContentTypes).count) location=\(describeLocation(info.location))"
+        )
+
         var urls: [URL] = []
         if #available(macOS 13.0, *) {
             for provider in info.itemProviders(for: [.image, .movie, .pdf, .mp3]) {
+                log("provider types=\(provider.registeredTypeIdentifiers.sorted().joined(separator: ","))")
                 if let url = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier) as? URL {
                     urls.append(url)
-                    debugPrint("Drop file (image) accepted: \(url)")
+                    log("Drop file (image) accepted: \(quote(url.path))")
                 }
                 if let url = try? await provider.loadItem(forTypeIdentifier: UTType.pdf.identifier) as? URL {
                     urls.append(url)
-                    debugPrint("Drop file (pdf) accepted: \(url)")
+                    log("Drop file (pdf) accepted: \(quote(url.path))")
                 }
                 if let url = try? await provider.loadItem(forTypeIdentifier: UTType.movie.identifier) as? URL {
                     urls.append(url)
-                    debugPrint("Drop file (video) accepted: \(url)")
+                    log("Drop file (video) accepted: \(quote(url.path))")
                 }
                 if let url = try? await provider.loadItem(forTypeIdentifier: UTType.mp3.identifier) as? URL {
                     urls.append(url)
-                    debugPrint("Drop file (mp3 audio) accepted: \(url)")
+                    log("Drop file (mp3 audio) accepted: \(quote(url.path))")
                 }
             }
         } else {
-            var urls: [URL] = []
             let supportedExtensions = ["png", "heic", "jpeg", "gif", "tiff", "jpg", "webp"]
             for provider in info.itemProviders(for: [.fileURL]) {
                 if let item = try? await provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier),
@@ -44,6 +74,7 @@ class PlanetQuickShareDropDelegate: DropDelegate {
                 }
             }
         }
+        log("processDropInfo finished urls=\(urls.count)")
         return urls
     }
 
@@ -52,11 +83,57 @@ class PlanetQuickShareDropDelegate: DropDelegate {
     }
 
     func validateDrop(info: DropInfo) -> Bool {
-        guard let _ = info.itemProviders(for: [.image]).first else { return false }
-        return true
+        let providerCount = info.itemProviders(for: Self.supportedContentTypes).count
+        let hasDirectImage = Self.dragPasteboardHasDirectImage()
+        let hasPromise = Self.dragPasteboardHasFilePromise()
+        let isValid = providerCount > 0 || hasDirectImage || hasPromise
+        Self.log(
+            "validateDrop valid=\(isValid) providers=\(providerCount) hasDirectImage=\(hasDirectImage) hasPromise=\(hasPromise) location=\(Self.describeLocation(info.location))"
+        )
+        return isValid
     }
 
     func performDrop(info: DropInfo) -> Bool {
+        if let imageURL = Self.imageFileFromDragPasteboard() {
+            Self.log("performDrop received directPasteboardImage")
+            Task { @MainActor in
+                do {
+                    try PlanetQuickShareViewModel.shared.prepareFiles([imageURL])
+                } catch {
+                    Self.log("performDrop failed to prepare directPasteboardImage error=\(error.localizedDescription)", level: .error)
+                    let alert = NSAlert()
+                    alert.messageText = L10n("Failed to Add Attachments")
+                    alert.informativeText = error.localizedDescription
+                    alert.alertStyle = .warning
+       
```

**File**: `Planet/Quick Share/PlanetQuickShareView.swift` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ struct PlanetQuickShareView: View {
                     let dropDelegate = PlanetQuickShareDropDelegate()
                     attachmentSectionPlaceholder()
                         .focusable()
-                        .onDrop(of: [.image, .movie], delegate: dropDelegate)
+                        .onDrop(of: PlanetQuickShareDropDelegate.supportedContentTypes, delegate: dropDelegate)
                         .onPasteCommand(of: [.fileURL, .image, .movie, .mp3], perform: PlanetQuickShareViewModel.shared.processPasteItems(_:))
                         .contextMenu {
                             PasteButton(supportedContentTypes: [.fileURL, .image, .movie, .mp3], payloadAction: PlanetQuickShareViewModel.shared.processPasteItems(_:))
```

**File**: `Planet/Views/Articles/ArticleListView.swift` (modified, +40/-3)
```diff
@@ -31,7 +31,14 @@ class ArticleListDropDelegate: DropDelegate {
     }
 
     func validateDrop(info: DropInfo) -> Bool {
-        return info.itemProviders(for: [.fileURL]).count > 0
+        let providerCount = info.itemProviders(for: PlanetQuickShareDropDelegate.supportedContentTypes).count
+        let hasDirectImage = PlanetQuickShareDropDelegate.dragPasteboardHasDirectImage()
+        let hasPromise = PlanetQuickShareDropDelegate.dragPasteboardHasFilePromise()
+        let isValid = providerCount > 0 || hasDirectImage || hasPromise
+        Self.log(
+            "ArticleList.validateDrop valid=\(isValid) providers=\(providerCount) hasDirectImage=\(hasDirectImage) hasPromise=\(hasPromise) location=\(Self.describeLocation(info.location))"
+        )
+        return isValid
     }
 
     private static func droppedFileURLs(from info: DropInfo) async -> [URL] {
@@ -300,9 +307,28 @@ class ArticleListDropDelegate: DropDelegate {
     }
 
     func performDrop(info: DropInfo) -> Bool {
+        Self.log("ArticleList.performDrop started location=\(Self.describeLocation(info.location))")
+        if let imageURL = PlanetQuickShareDropDelegate.imageFileFromDragPasteboard() {
+            Self.log("ArticleList.performDrop received directPasteboardImage")
+            PlanetQuickShareDropDelegate.prepareQuickShare(for: imageURL)
+            return true
+        }
+
+        if PlanetQuickShareDropDelegate.receivePromisedFileFromDragPasteboard({ fileURL in
+            guard let fileURL else {
+                Self.log("ArticleList.performDrop promisedFile produced no URL", level: .warning)
+                return
+            }
+            Self.log("ArticleList.performDrop received promisedFile")
+            PlanetQuickShareDropDelegate.prepareQuickShare(for: fileURL)
+        }) {
+            return true
+        }
+
         Task { @MainActor in
             do {
                 let fileURLs = await Self.droppedFileURLs(from: info)
+                Self.log("ArticleList.performDrop fileURLCount=\(fileURLs.count)")
                 if try await Self.handleTextDocumentDrop(fileURLs) {
                     if #available(macOS 14.0, *) {
                         NSApp.activate()
@@ -313,7 +339,10 @@ class ArticleListDropDelegate: DropDelegate {
                 }
 
                 let urls: [URL] = await PlanetQuickShareDropDelegate.processDropInfo(info)
-                guard urls.count > 0 else { return }
+                guard urls.count > 0 else {
+                    Self.log("ArticleList.performDrop no quick-share URLs extracted", level: .warning)
+                    return
+                }
                 try PlanetQuickShareViewModel.shared.prepareFiles(urls)
                 PlanetStore.shared.isQuickSharing = true
                 if #available(macOS 14.0, *) {
@@ -334,6 +363,14 @@ class ArticleListDropDelegate: DropDelegate {
         }
         return true
     }
+
+    private static func log(_ message: String, level: PlanetLogger.Level = .info) {
+        PlanetLogger.log("DragDrop: \(message)", level: level)
+    }
+
+    private static func describeLocation(_ location: CGPoint) -> String {
+        "(\(String(format: "%.1f", location.x)),\(String(format: "%.1f", location.y)))"
+    }
 }
 
 
@@ -633,7 +670,7 @@ struct ArticleListView: View {
                 }
             }
         }
-        .onDrop(of: [.fileURL], delegate: articleDropDelegate)
+        .onDrop(of: PlanetQuickShareDropDelegate.supportedContentTypes, delegate: articleDropDelegate)
         .onWidthChange { newWidth in
             @AppStorage("articleListWidth") var articleListWidth = 240.0
             articleListWidth = newWidth
```

**File**: `Planet/Writer/WriterTextView.swift` (modified, +43/-281)
```diff
@@ -3,59 +3,35 @@ import UniformTypeIdentifiers
 
 @MainActor
 enum WriterPasteboardImporter {
-    private struct ImportedAttachmentFile {
-        let url: URL
-        let attachmentType: AttachmentType
-        let isTemporary: Bool
-    }
-
-    private static let supportedImagePasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.png.identifier), "png"),
-        (NSPasteboard.PasteboardType(UTType.jpeg.identifier), "jpg"),
-        (NSPasteboard.PasteboardType(UTType.gif.identifier), "gif"),
-        (NSPasteboard.PasteboardType(UTType.tiff.identifier), "tiff"),
-        (NSPasteboard.PasteboardType("public.heic"), "heic"),
-        (NSPasteboard.PasteboardType("public.heif"), "heif"),
-        (NSPasteboard.PasteboardType("public.webp"), "webp")
-    ]
-
-    private static let supportedVideoPasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.mpeg4Movie.identifier), "mp4"),
-        (NSPasteboard.PasteboardType(UTType.quickTimeMovie.identifier), "mov"),
-        (NSPasteboard.PasteboardType(UTType.movie.identifier), "mov")
-    ]
-
-    private static let supportedAudioPasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.mp3.identifier), "mp3"),
-        (NSPasteboard.PasteboardType(UTType.mpeg4Audio.identifier), "m4a"),
-        (NSPasteboard.PasteboardType(UTType.wav.identifier), "wav"),
-        (NSPasteboard.PasteboardType(UTType.audio.identifier), "m4a")
-    ]
-
-    private static let supportedFilePasteboardTypes: [(type: NSPasteboard.PasteboardType, fileExtension: String)] = [
-        (NSPasteboard.PasteboardType(UTType.pdf.identifier), "pdf")
-    ]
+    private typealias ImportedAttachmentFile = DragPasteboardMediaFile
+    private static let supportedAttachmentTypes: Set<AttachmentType> = [.image, .video, .audio, .file]
 
     static var readablePasteboardTypes: [NSPasteboard.PasteboardType] {
-        [.fileURL, NSPasteboard.PasteboardType(UTType.image.identifier)]
-            + supportedImagePasteboardTypes.map(\.type)
-            + supportedVideoPasteboardTypes.map(\.type)
-            + supportedAudioPasteboardTypes.map(\.type)
-            + supportedFilePasteboardTypes.map(\.type)
+        DragPasteboardMedia.readablePasteboardTypes(allowing: supportedAttachmentTypes)
     }
 
     static func canImport(returnType: NSPasteboard.PasteboardType?) -> Bool {
         guard let returnType else { return true }
         return readablePasteboardTypes.contains(returnType)
     }
 
+    static func canImport(from pasteboard: NSPasteboard) -> Bool {
+        DragPasteboardMedia.containsSupportedMedia(
+            in: pasteboard,
+            allowing: supportedAttachmentTypes
+        )
+    }
+
     static func importAttachments(
         from pasteboard: NSPasteboard,
         into draft: DraftModel,
         insertMarkdown: (String) -> Void,
         synchronizeContent: (() -> Void)? = nil
     ) throws -> Bool {
-        let importedAttachments = try importedAttachmentFiles(from: pasteboard)
+        let importedAttachments = try DragPasteboardMedia.importedFiles(
+            from: pasteboard,
+            allowing: supportedAttachmentTypes
+        )
         guard !importedAttachments.isEmpty else {
             return false
         }
@@ -109,247 +85,6 @@ enum WriterPasteboardImporter {
         }
     }
 
-    private static func importedAttachmentFiles(from pasteboard: NSPasteboard) throws -> [ImportedAttachmentFile] {
-        var attachments: [ImportedAttachmentFile] = []
-
-        if let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL] {
-            for fileURL in fileURLs {
-                guard let attachmentType = supportedAttachmentType(for: fileURL) else {
-                    continue
-                }
-                attachments.append(
-                    try makeTemporaryAttachmentFile(from: fileURL, attachmentType: attachmentType)
-                )
-            }
-        }
-
-        if let items = pasteboard.pasteboardItems {
-            for item in items where !item.types.contains(.fileURL) {
-                if let importedAttachment = try makeTemporaryAttachmentFile(from: item) {
-                    attachments.append(importedAttachment)
-                }
-            }
-        } else if attachments.isEmpty,
-                  let fallbackAttachment = try makeTemporaryAttachmentFile(from: pasteboard) {
-            attachments.append(fallbackAttachment)
-        }
-
-        return attachments
-    }
-
-    private static func supportedAttachmentType(for url: URL) -> AttachmentType? {
-        guard url.isFileURL else { return nil }
-        if let fileType = UTType(filenameExtension: url.pathExtension.lowercased()) {
-            if fileType.conforms(to: .image) {
-                return .image
- 
```

---

### Incident Patch 9: `993b55d3` (2026-05-06)
**Commit Message**: Add build-time feature flag support

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -4,3 +4,5 @@
 - Sandbox-safe app logs should be written with `NSTemporaryDirectory()`; in Planet this resolves under `~/Library/Containers/xyz.planetable.Planet/Data/tmp/` (for example `planet-ai-debug.log`, `video.log`)
 - For broken SwiftPM/Xcode derived data under `/tmp/planet-derived` (for example missing `Sparkle.xcframework`), remove `/tmp/planet-derived`, run `xcodebuild -resolvePackageDependencies -onlyUsePackageVersionsFromResolvedFile -project Planet.xcodeproj -scheme "Planet" -derivedDataPath /tmp/planet-derived`, then rebuild
 - When modifying Xcode project files (.xcodeproj/project.pbxproj), use the `xcodeproj` Ruby gem instead of editing the pbxproj file directly.
+- When editing or creating files under `Technotes/`, do not manually hard-wrap prose; let the editor soft-wrap paragraphs and list items.
+- Build-time feature flags are controlled through xcconfig settings, typed runtime checks in `Planet/FeatureFlags.swift`, and documented in `Technotes/FeatureFlags.md`; use `Planet/local.xcconfig` for machine-local overrides.
```

**File**: `Planet.xcodeproj/project.pbxproj` (modified, +5/-1)
```diff
@@ -546,6 +546,7 @@
 		72114FE37ADE9340E448FF3E /* WriterViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 72114B2B1F05731320A89022 /* WriterViewModel.swift */; };
 		7682AC6BFB25793BEC575A8C /* ArticleAIOnDeviceTools.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0B14374A86131144DC199477 /* ArticleAIOnDeviceTools.swift */; };
 		8D61823796760999B867040E /* SearchEmbedding.swift in Sources */ = {isa = PBXBuildFile; fileRef = 776E9594BE16BBA78335B7E6 /* SearchEmbedding.swift */; };
+		8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8A2FA88FEC08699B75D7818C /* FeatureFlags.swift */; };
 		8F33EB5B385321311DA2AF54 /* AppLogView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 196AB5BD526941A7FAB5D1AD /* AppLogView.swift */; };
 		9F1807DD072155243C041DFC /* ThemeColorExtractor.swift in Sources */ = {isa = PBXBuildFile; fileRef = 412635EFFFDD8D11BBC4BC56 /* ThemeColorExtractor.swift */; };
 		9F283A9A8EA2592CEC565037 /* SearchIndex.swift in Sources */ = {isa = PBXBuildFile; fileRef = 44BF4852CA45DC20EE145C58 /* SearchIndex.swift */; };
@@ -930,6 +931,7 @@
 		81B73C69A555DE29723AEFCA /* et */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = et; path = et.lproj/Localizable.strings; sourceTree = "<group>"; };
 		839C3B2373346DCBD530F1BC /* da */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = da; path = da.lproj/InfoPlist.strings; sourceTree = "<group>"; };
 		848998DD8F0386FE0BA4A3D8 /* el */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = el; path = el.lproj/InfoPlist.strings; sourceTree = "<group>"; };
+		8A2FA88FEC08699B75D7818C /* FeatureFlags.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = FeatureFlags.swift; sourceTree = "<group>"; };
 		8E2751B5275DEC7A6D8B0AA0 /* it */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = it; path = it.lproj/Localizable.strings; sourceTree = "<group>"; };
 		92E9E61088FF7A043F46E188 /* SSHRsyncLogger.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SSHRsyncLogger.swift; sourceTree = "<group>"; };
 		9E6DEFB79570666667A1BE19 /* fr */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.strings; name = fr; path = fr.lproj/Localizable.strings; sourceTree = "<group>"; };
@@ -1324,6 +1326,7 @@
 				6A1FD5022A75A64500391972 /* Avatars.xcassets */,
 				2A4AE87C2A89F49B00A27B5B /* SharedAssets.xcassets */,
 				60789C8BE7AC8B1E293698E0 /* Log */,
+				8A2FA88FEC08699B75D7818C /* FeatureFlags.swift */,
 			);
 			path = Planet;
 			sourceTree = "<group>";
@@ -2513,6 +2516,7 @@
 				0AA0B181DEC749A0DB6E8A6E /* PlanetAIChatWindowController.swift in Sources */,
 				B2B22802B0B767E09FE903A2 /* ArticleSpeechPlayer.swift in Sources */,
 				9F1807DD072155243C041DFC /* ThemeColorExtractor.swift in Sources */,
+				8F03F9FAEFE88AA819E13F28 /* FeatureFlags.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -2743,7 +2747,7 @@
 				MTL_FAST_MATH = YES;
 				ONLY_ACTIVE_ARCH = YES;
 				SDKROOT = macosx;
-				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
+				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "$(inherited) DEBUG";
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 			};
 			name = Debug;
```

**File**: `Planet/FeatureFlags.swift` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+//
+//  FeatureFlags.swift
+//  Planet
+//
+
+enum FeatureFlags {
+    #if PLANET_ENABLE_APPLE_INTELLIGENCE
+    static let appleIntelligenceSupport = true
+    #else
+    static let appleIntelligenceSupport = false
+    #endif
+}
```

**File**: `Planet/Planet.xcconfig` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ PLANET_APP_ICON_NAME = AppIcon-Debug
 
 PLANET_LITE_ICON_NAME = AppIcon-Debug
 
+PLANET_ENABLE_APPLE_INTELLIGENCE = YES
+PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_YES = PLANET_ENABLE_APPLE_INTELLIGENCE
+PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_NO =
+SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) $(PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_$(PLANET_ENABLE_APPLE_INTELLIGENCE))
+
 #include "marketing_version.xcconfig"
 #include "versioning.xcconfig"
 #include? "local.xcconfig"
```

**File**: `Planet/Release.xcconfig` (modified, +5/-0)
```diff
@@ -27,6 +27,11 @@ ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOLS = NO
 ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOL_FRAMEWORKS = ""
 ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = NO
 
+PLANET_ENABLE_APPLE_INTELLIGENCE = YES
+PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_YES = PLANET_ENABLE_APPLE_INTELLIGENCE
+PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_NO =
+SWIFT_ACTIVE_COMPILATION_CONDITIONS = $(inherited) $(PLANET_APPLE_INTELLIGENCE_COMPILATION_CONDITION_$(PLANET_ENABLE_APPLE_INTELLIGENCE))
+
 #include "marketing_version.xcconfig"
 #include "versioning.xcconfig"
 #include? "local.xcconfig"
```

**File**: `Planet/Settings/PlanetSettingsAIView.swift` (modified, +8/-2)
```diff
@@ -7,7 +7,7 @@
 
 import SwiftUI
 
-#if canImport(FoundationModels)
+#if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
 import FoundationModels
 #endif
 
@@ -462,7 +462,13 @@ struct PlanetSettingsAIView: View {
     }
 
     private func checkOnDeviceAI() {
-        #if canImport(FoundationModels)
+        guard FeatureFlags.appleIntelligenceSupport else {
+            onDeviceAIState = .idle
+            onDeviceAILabel = L10n("On-device AI is disabled in this build")
+            return
+        }
+
+        #if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
         if #available(macOS 26.0, *) {
             let model = SystemLanguageModel.default
             switch model.availability {
```

**File**: `Planet/Views/Articles/ArticleAIChatView.swift` (modified, +16/-3)
```diff
@@ -10,7 +10,7 @@ import Combine
 import Foundation
 import SwiftUI
 
-#if canImport(FoundationModels)
+#if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
 import FoundationModels
 #endif
 
@@ -350,18 +350,30 @@ struct ArticleAIChatView: View {
 
     private func checkProviderAvailability() {
         isRemoteAvailable = UserDefaults.standard.bool(forKey: .settingsAIIsReady)
-        #if canImport(FoundationModels)
+        isOnDeviceAvailable = false
+        guard FeatureFlags.appleIntelligenceSupport else {
+            normalizeSelectedProvider()
+            return
+        }
+
+        #if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
         if #available(macOS 26.0, *) {
             let model = SystemLanguageModel.default
             if case .available = model.availability {
                 isOnDeviceAvailable = true
             }
         }
         #endif
+        normalizeSelectedProvider()
+    }
+
+    private func normalizeSelectedProvider() {
         if isOnDeviceAvailable && !isRemoteAvailable {
             selectedProvider = .onDevice
         } else if isRemoteAvailable && !isOnDeviceAvailable {
             selectedProvider = .remote
+        } else if !isRemoteAvailable && !isOnDeviceAvailable {
+            selectedProvider = .remote
         }
     }
 
@@ -681,6 +693,7 @@ struct ArticleAIChatView: View {
             savedScrollTarget = envelope.scrollTargetMessageID
             if let provider = envelope.provider, let restored = AIProvider(rawValue: provider) {
                 selectedProvider = restored
+                normalizeSelectedProvider()
             }
         } else if let legacy = try? JSONDecoder.shared.decode([ArticleAIChatPersistedMessage].self, from: data) {
             persisted = legacy
@@ -2200,7 +2213,7 @@ struct ArticleAIChatView: View {
     }
 
     private func sendOnDeviceMessage(prompt: String, streamingMessageID: UUID) {
-        #if canImport(FoundationModels)
+        #if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
         if #available(macOS 26.0, *) {
             Task {
                 do {
```

**File**: `Planet/Views/Articles/ArticleAIOnDeviceTools.swift` (modified, +1/-1)
```diff
@@ -390,7 +390,7 @@ enum ArticleAIRepoGrep {
     }
 }
 
-#if canImport(FoundationModels)
+#if PLANET_ENABLE_APPLE_INTELLIGENCE && canImport(FoundationModels)
 
 import FoundationModels
 
```

---

### Incident Patch 10: `e8544143` (2026-05-05)
**Commit Message**: Add liquid glass toolbar tint leak technote

Document macOS 26 issue where liquid glass dark adaptation on
one NavigationView column leaks to toolbar items in other columns.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2798
+CURRENT_PROJECT_VERSION = 2799
```

**File**: `Technotes/SwiftUIToolbarEnvironmentLeak.md` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+# SwiftUI Toolbar Environment Leak in NavigationView on macOS 26
+
+## Problem
+
+On macOS 26, when an article's detail column has a dark theme-color background, liquid glass automatically adapts the detail column's toolbar buttons to be visible against the dark background. However, this automatic dark adaptation leaks to toolbar items declared by other columns in the same `NavigationView` — for example, the article list column's filter button also turns white, even though its toolbar area is not dark.
+
+This appears to be a side effect of liquid glass's automatic color scheme handling in the shared `NSToolbar`. In a macOS SwiftUI `NavigationView` with multiple columns (sidebar, list, detail), each column can declare `.toolbar {}` items, but these all get merged into a single shared `NSToolbar` on the window. The liquid glass dark adaptation does not scope itself to the column that has the dark background.
+
+## Reproduction
+
+```swift
+// In a three-column NavigationView:
+
+// Column 2 (ArticleListView)
+.toolbar {
+    Menu { ... } label: {
+        Image(systemName: "line.3.horizontal.decrease.circle")
+        // ^ This icon unexpectedly turns white on macOS 26
+        //   when Column 3 has a dark theme-color background
+    }
+}
+
+// Column 3 (ArticleView) — has dark theme-color background
+// extending behind the toolbar via .edgesIgnoringSafeArea(.all)
+.background(Color(themeColor ?? NSColor.textBackgroundColor))
+```
+
+No explicit `.environment(\.colorScheme, .dark)` is needed to trigger this — liquid glass on macOS 26 does it automatically based on the dark background behind the toolbar area.
+
+## What Does Not Work
+
+- `.environment(\.colorScheme, systemColorScheme)` on the affected column's toolbar items as a countermeasure — does not override the leak
+
+## Status
+
+As of May 2026, no other reports of this specific issue were found online. Apple's WWDC25 guidance on liquid glass notes that extra backgrounds or darkening effects behind bar items can "interfere with the effect," which may be related. Consider filing via Feedback Assistant.
+
+## References
+
+- [Adopting Liquid Glass (Apple)](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)
+- [Build a SwiftUI app with the new design - WWDC25](https://developer.apple.com/videos/play/wwdc2025/323/)
+- [Glassifying toolbars in SwiftUI (Swift with Majid)](https://swiftwithmajid.com/2025/07/01/glassifying-toolbars-in-swiftui/)
+- [FIX Guide to iOS 26 Glass Effect and ToolbarColorScheme Issue](https://pratikpathak.com/fix-guide-to-ios-26-glass-effect-and-toolbarcolorscheme-issue-and-solution/)
+
+## Context
+
+This issue was encountered while implementing Safari-like `<meta name="theme-color">` support for Planet's article detail toolbar. When an article's theme-color is very dark (e.g., `#000`), liquid glass correctly adapts the detail column's toolbar buttons, but also incorrectly adapts the article list column's filter button.
```

---

### Incident Patch 11: `3422c7f9` (2026-05-04)
**Commit Message**: Fix empty unfollow confirmation dialog

**File**: `Planet/Views/Sidebar/FollowingPlanetSidebarItem.swift` (modified, +14/-8)
```diff
@@ -111,19 +111,20 @@ struct FollowingPlanetSidebarItem: View {
                 Button {
                     isShowingArchiveConfirmation = true
                 } label: {
-                    Text("Archive Planet")
+                    Text(verbatim: L10n("Archive Planet"))
                 }
 
                 Button {
                     isShowingUnfollowConfirmation = true
                 } label: {
-                    Text("Unfollow")
+                    Text(verbatim: L10n("Unfollow"))
                 }
             }
         }
         .confirmationDialog(
-            Text("Are you sure you want to archive this planet? Archived planets will not be auto updated. You can later unarchive it from settings."),
-            isPresented: $isShowingArchiveConfirmation
+            Text(verbatim: L10n("Archive")),
+            isPresented: $isShowingArchiveConfirmation,
+            titleVisibility: .visible
         ) {
             Button() {
                 planet.archive()
@@ -134,12 +135,15 @@ struct FollowingPlanetSidebarItem: View {
                 planetStore.followingPlanets.removeAll { $0.id == planet.id }
                 planetStore.followingArchivedPlanets.insert(planet, at: 0)
             } label: {
-                Text("Archive")
+                Text(verbatim: L10n("Archive"))
             }
+        } message: {
+            Text(verbatim: L10n("Are you sure you want to archive this planet? Archived planets will not be auto updated. You can later unarchive it from settings."))
         }
         .confirmationDialog(
-            Text("Are you sure you want to unfollow this planet?"),
-            isPresented: $isShowingUnfollowConfirmation
+            Text(verbatim: L10n("Unfollow")),
+            isPresented: $isShowingUnfollowConfirmation,
+            titleVisibility: .visible
         ) {
             Button(role: .destructive) {
                 planetStore.followingPlanets.removeAll { $0.id == planet.id }
@@ -156,8 +160,10 @@ struct FollowingPlanetSidebarItem: View {
                     planetStore.selectedView = nil
                 }
             } label: {
-                Text("Unfollow")
+                Text(verbatim: L10n("Unfollow"))
             }
+        } message: {
+            Text(verbatim: L10n("Are you sure you want to unfollow this planet?"))
         }
 
     }
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2791
+CURRENT_PROJECT_VERSION = 2792
```

---

### Incident Patch 12: `87045adb` (2026-05-04)
**Commit Message**: Improve AI chat retrieval and table rendering

**File**: `Planet/Views/Articles/ArticleAIChatView.swift` (modified, +164/-71)
```diff
@@ -375,10 +375,10 @@ struct ArticleAIChatView: View {
             ScrollViewReader { proxy in
                 ScrollView {
                     chatMessageList
-                        .padding(.leading, 12)
-                        .padding(.trailing, 12)
+                        .padding(.leading, 20)
+                        .padding(.trailing, 20)
                         .padding(.bottom, 20)
-                        .padding(.top, 16)
+                        .padding(.top, 12)
                 }
                 .background(Color(NSColor.textBackgroundColor))
                 .applyScrollPositionTracking(id: $scrolledMessageID)
@@ -820,20 +820,14 @@ struct ArticleAIChatView: View {
     }
 
     private var chatMessageList: some View {
-        VStack(alignment: .leading, spacing: 10) {
+        LazyVStack(alignment: .leading, spacing: 10) {
             Text(isPlanetWideMode ? L10n("Context: %@", contextTitle) : L10n("Context loaded from: %@", contextTitle))
                 .font(.caption)
                 .foregroundStyle(.secondary)
                 .frame(maxWidth: .infinity, alignment: .leading)
 
             ForEach(messages) { message in
                 HStack(alignment: .top) {
-                    Text(isAssistantStyleMessage(message) ? "AI" : "You")
-                        .font(.system(size: chatFontSize))
-                        .lineSpacing(5)
-                        .foregroundStyle(.secondary)
-                        .padding(.top, isAssistantStyleMessage(message) ? 0 : 8)
-                        .frame(width: 34, alignment: .trailing)
                     VStack(alignment: .leading, spacing: 6) {
                         if message.isReasoningResponse {
                             Button {
@@ -912,19 +906,12 @@ struct ArticleAIChatView: View {
             }
 
             if isSending {
-                HStack(alignment: .top) {
-                    Text("AI")
-                        .font(.system(size: chatFontSize))
+                TimelineView(.periodic(from: .now, by: 0.14)) { context in
+                    Text("\(sendingAnimationFrame(for: context.date)) \(sendingStatusText)")
+                        .font(.system(size: chatFontSize, design: .monospaced))
                         .lineSpacing(5)
                         .foregroundStyle(.secondary)
-                        .frame(width: 34, alignment: .trailing)
-                    TimelineView(.periodic(from: .now, by: 0.14)) { context in
-                        Text("\(sendingAnimationFrame(for: context.date)) \(sendingStatusText)")
-                            .font(.system(size: chatFontSize, design: .monospaced))
-                            .lineSpacing(5)
-                            .foregroundStyle(.secondary)
-                            .frame(maxWidth: .infinity, alignment: .leading)
-                    }
+                        .frame(maxWidth: .infinity, alignment: .leading)
                 }
             }
 
@@ -1254,12 +1241,14 @@ struct ArticleAIChatView: View {
         let evenRowBackground = makeArticleAITableCodeBackgroundColor()
         let oddRowBackground = Color(NSColor.textBackgroundColor)
         let cornerRadius: CGFloat = 5
+        let isTextSelectionEnabled = markdownTableCellCount(table) <= Self.markdownTableCellSelectionLimit
 
-        return VStack(spacing: 0) {
+        return LazyVStack(spacing: 0) {
             assistantMarkdownTableRow(
                 table.headers,
                 alignments: table.alignments,
-                isHeader: true
+                isHeader: true,
+                isTextSelectionEnabled: isTextSelectionEnabled
             )
             .background(headerBackground)
 
@@ -1269,11 +1258,12 @@ struct ArticleAIChatView: View {
                     .frame(height: 1)
             }
 
-            ForEach(Array(table.rows.enumerated()), id: \.offset) { index, row in
+            ForEach(table.rows.indices, id: \.self) { index in
                 assistantMarkdownTableRow(
-                    row,
+                    table.rows[index],
                     alignments: table.alignments,
-                    isHeader: false
+                    isHeader: false,
+                    isTextSelectionEnabled: isTextSelectionEnabled
                 )
                 .background(index.isMultiple(of: 2) ? evenRowBackground : oddRowBackground)
 
@@ -1296,16 +1286,18 @@ struct ArticleAIChatView: View {
     private func assistantMarkdownTableRow(
         _ cells: [String],
         alignments: [ArticleAIMarkdownTableAlignment],
-        isHeader: Bool
+        isHeader: Bool,
+        isTextSelectionEnabled: Bool
     ) -> some View {
         let borderColor = Color("BorderColor")
 
         return HStack(spacing: 0) {
-            ForEach(Array(cells.enumerated()), id: \.offset) { index, cell in
+            ForEach(cells.indices, id: \.self) { index in
                 assistantMarkdownTableCell(
-                    cell,
+                    
```

**File**: `Planet/Views/Articles/ArticleAIOnDeviceTools.swift` (modified, +24/-11)
```diff
@@ -7,15 +7,15 @@
 
 import Foundation
 
-struct ArticleAIRepoGrepRequest {
+struct ArticleAIRepoGrepRequest: Sendable {
     let pattern: String
     let path: String?
     let literal: Bool
     let caseSensitive: Bool
     let maxResults: Int
 }
 
-struct ArticleAIRepoGrepMatch {
+struct ArticleAIRepoGrepMatch: Sendable {
     let path: String
     let line: Int
     let column: Int
@@ -31,7 +31,7 @@ struct ArticleAIRepoGrepMatch {
     }
 }
 
-struct ArticleAIRepoGrepResult {
+struct ArticleAIRepoGrepResult: Sendable {
     let pattern: String
     let searchRoot: String
     let literal: Bool
@@ -79,6 +79,19 @@ enum ArticleAIRepoGrep {
     private static let maxFileSizeBytes = 2_000_000
     private static let maxPreviewLength = 400
 
+    static func searchAsync(request: ArticleAIRepoGrepRequest, repoRoot: URL) async throws -> ArticleAIRepoGrepResult {
+        try await withCheckedThrowingContinuation { continuation in
+            DispatchQueue.global(qos: .utility).async {
+                do {
+                    let result = try search(request: request, repoRoot: repoRoot)
+                    continuation.resume(returning: result)
+                } catch {
+                    continuation.resume(throwing: error)
+                }
+            }
+        }
+    }
+
     static func search(request: ArticleAIRepoGrepRequest, repoRoot: URL) throws -> ArticleAIRepoGrepResult {
         let pattern = request.pattern.trimmingCharacters(in: .whitespacesAndNewlines)
         guard !pattern.isEmpty else {
@@ -428,7 +441,7 @@ struct WritePlanetArguments: Sendable {
 @available(macOS 26.0, *)
 @Generable(description: "Arguments for searching articles")
 struct SearchArticlesArguments: Sendable {
-    @Guide(description: "Search query. Supports phrases in quotes and -negation.")
+    @Guide(description: "Search query. Supports phrases in quotes and -negation. Use for semantic/topic search where wording may differ; for exact dates, IDs, title fragments, URLs, quoted text, or other literal tokens, use grep first.")
     var query: String
     @Guide(description: "Maximum number of results to return. Defaults to 10, max 50.")
     var limit: Int?
@@ -437,13 +450,13 @@ struct SearchArticlesArguments: Sendable {
 }
 
 @available(macOS 26.0, *)
-@Generable(description: "Arguments for grep-style repo search")
+@Generable(description: "Arguments for grep-style library search")
 struct GrepArguments: Sendable {
-    @Guide(description: "Required search pattern. Literal matching is used by default.")
+    @Guide(description: "Required search pattern. For exact tokens from the user, pass the exact spelling and punctuation first, including date-like strings such as 2026-1-1. Leave literal as true unless regex is explicitly needed.")
     var pattern: String
-    @Guide(description: "Optional relative file or directory under the Planet repo root to search. Defaults to the repo root.")
+    @Guide(description: "Optional relative file or directory under the Planet library root to search. Defaults to the library root.")
     var path: String?
-    @Guide(description: "Optional. Treat pattern as literal text. Defaults to true.")
+    @Guide(description: "Optional. Treat pattern as literal text. Defaults to true; keep true for exact user-provided dates, IDs, titles, URLs, quoted text, identifiers, symbols, setting keys, and phrases.")
     var literal: Bool?
     @Guide(description: "Optional. Case-sensitive matching. Defaults to false.")
     var caseSensitive: Bool?
@@ -770,7 +783,7 @@ struct WritePlanetTool: Tool {
 @available(macOS 26.0, *)
 struct SearchArticlesTool: Tool {
     var name: String { "search_articles" }
-    var description: String { "Search across all articles by keyword or topic. Returns matching article titles and previews." }
+    var description: String { "Search across all articles by keyword or topic. Use for semantic/topic searches where wording may differ; for exact dates, IDs, title fragments, URLs, file paths, quoted text, or other literal tokens, use grep first." }
 
     func call(arguments: SearchArticlesArguments) async throws -> String {
         let limit = min(50, max(1, arguments.limit ?? 10))
@@ -808,7 +821,7 @@ struct SearchArticlesTool: Tool {
 @available(macOS 26.0, *)
 struct GrepTool: Tool {
     var name: String { "grep" }
-    var description: String { "Search text files in the Planet repo for an exact string or regex. Prefer this for exact repo/file-content lookups." }
+    var description: String { "Search text files in the Planet library for an exact string or regex. Best first tool for exact literal lookups such as dates, title fragments, quoted text, URLs, domains, file paths, UUIDs/IDs, tags, numbers, identifiers, symbols, proper nouns, and setting keys." }
 
     func call(arguments: GrepArguments) async throws -> String {
         let request = ArticleAIRepoGrepRequest(
@@ -822,7 +835,7 @@ struct GrepTool: Tool {
             "grep called pattern=\(arguments.pattern),
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2789
+CURRENT_PROJECT_VERSION = 2790
```

---

### Incident Patch 13: `3d7d779a` (2026-05-04)
**Commit Message**: Fix article list refresh synchronization

**File**: `Planet/Entities/PlanetStore.swift` (modified, +6/-1)
```diff
@@ -229,7 +229,12 @@ final class MyJSONDirectoryMonitor {
             return nil
         }
     }
-    @Published var selectedArticleList: [ArticleModel]? = nil
+    @Published private(set) var selectedArticleListVersion: UInt = 0
+    @Published var selectedArticleList: [ArticleModel]? = nil {
+        didSet {
+            selectedArticleListVersion &+= 1
+        }
+    }
     @Published var selectedArticle: ArticleModel? {
         didSet {
             if selectedArticle != oldValue {
```

**File**: `Planet/Views/Articles/ArticleListView.swift` (modified, +1/-1)
```diff
@@ -615,7 +615,7 @@ struct ArticleListView: View {
         .onAppear {
             viewModel.articles = filterArticles(planetStore.selectedArticleList ?? []) ?? []
         }
-        .onChange(of: planetStore.selectedArticleList) { _ in
+        .onChange(of: planetStore.selectedArticleListVersion) { _ in
             viewModel.articles = filterArticles(planetStore.selectedArticleList ?? []) ?? []
         }
         .onChange(of: viewModel.filter) { _ in
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2788
+CURRENT_PROJECT_VERSION = 2789
```

---

### Incident Patch 14: `9f578664` (2026-05-01)
**Commit Message**: Harden crash-prone code paths

**File**: `Planet/API/PlanetAPIController.swift` (modified, +5/-2)
```diff
@@ -475,12 +475,15 @@ class PlanetAPIController: NSObject, ObservableObject {
             }
             return ""
         }()
-        let planetTemplateName: String = {
+        let planetTemplateName: String = try {
             let template: String = p.template ?? ""
             if TemplateStore.shared.hasTemplate(named: template) {
                 return template
             }
-            return TemplateStore.shared.templates.first!.name
+            guard let defaultTemplate = TemplateStore.shared.templates.first else {
+                throw Abort(.internalServerError, reason: "No templates are available.")
+            }
+            return defaultTemplate.name
         }()
         let planet = try await MyPlanetModel.create(
             name: planetName,
```

**File**: `Planet/Downloads/PlanetDownloadsWebView.swift` (modified, +11/-22)
```diff
@@ -71,40 +71,29 @@ class PlanetDownloadsWebView: WKWebView {
                 return true
             }
         }
-        return DownloadsScriptMessageHandler.instance.href == nil && DownloadsScriptMessageHandler.instance.src == nil
+        return !DownloadsScriptMessageHandler.instance.hasSelectedURL
     }
     
     @objc private func openLinkAction(_ sender: NSMenuItem) {
-        guard let urlString = DownloadsScriptMessageHandler.instance.href else { return }
-        if urlString.hasPrefix("file:///") {
-            let targetURL = URL(fileURLWithPath: urlString)
-            ArticleWebViewModel.shared.processInternalFileLink(targetURL)
+        guard let url = DownloadsScriptMessageHandler.instance.hrefURL else { return }
+        if url.isFileURL {
+            ArticleWebViewModel.shared.processInternalFileLink(url)
         }
-        if let url = URL(string: urlString) {
-            ArticleWebViewModel.shared.processPossibleInternalLink(url)
-            if !ArticleWebViewModel.shared.checkInternalLink(url) {
-                NSWorkspace.shared.open(url)
-            }
+        ArticleWebViewModel.shared.processPossibleInternalLink(url)
+        if !ArticleWebViewModel.shared.checkInternalLink(url) {
+            NSWorkspace.shared.open(url)
         }
     }
 
     @objc private func downloadFileAction(_ sender: NSMenuItem) {
-        if let _ = DownloadsScriptMessageHandler.instance.href, let srcString = DownloadsScriptMessageHandler.instance.src {
-            self.load(URLRequest(url: URL(string: srcString)!))
-        } else if let urlString = DownloadsScriptMessageHandler.instance.href {
-            self.load(URLRequest(url: URL(string: urlString)!))
-        } else if let srcString = DownloadsScriptMessageHandler.instance.src {
-            self.load(URLRequest(url: URL(string: srcString)!))
+        if let url = DownloadsScriptMessageHandler.instance.selectedSourceURL {
+            self.load(URLRequest(url: url))
         }
     }
     
     @objc private func openImageAction(_ sender: NSMenuItem) {
-        if let _ = DownloadsScriptMessageHandler.instance.href, let srcString = DownloadsScriptMessageHandler.instance.src {
-            NSWorkspace.shared.open(URL(string: srcString)!)
-        } else if let urlString = DownloadsScriptMessageHandler.instance.href {
-            NSWorkspace.shared.open(URL(string: urlString)!)
-        } else if let srcString = DownloadsScriptMessageHandler.instance.src {
-            NSWorkspace.shared.open(URL(string: srcString)!)
+        if let url = DownloadsScriptMessageHandler.instance.selectedSourceURL {
+            NSWorkspace.shared.open(url)
         }
     }
     
```

**File**: `Planet/Entities/FollowingPlanetModel.swift` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ class FollowingPlanetModel: Equatable, Hashable, Identifiable, ObservableObject,
 
     static func followingPlanetsPath() -> URL {
         let url = URLUtils.repoPath().appendingPathComponent("Following", isDirectory: true)
-        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
         return url
     }
     var basePath: URL {
```

**File**: `Planet/Entities/MyPlanetModel.swift` (modified, +2/-2)
```diff
@@ -148,7 +148,7 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
 
     static func myPlanetsPath() -> URL {
         let url = URLUtils.repoPath().appendingPathComponent("My", isDirectory: true)
-        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
         return url
     }
     static func isReservedTag(_ tag: String) -> Bool {
@@ -271,7 +271,7 @@ class MyPlanetModel: Equatable, Hashable, Identifiable, ObservableObject, Codabl
 
     static func publicPlanetsPath() -> URL {
         let url = URLUtils.repoPath().appendingPathComponent("Public", isDirectory: true)
-        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
         return url
     }
     var publicBasePath: URL {
```

**File**: `Planet/Entities/PlanetStore.swift` (modified, +18/-7)
```diff
@@ -346,7 +346,10 @@ final class MyJSONDirectoryMonitor {
         do {
             try load()
         } catch {
-            fatalError("Error when accessing planet repo: \(error)")
+            logger.error("Error when accessing planet repo: \(error.localizedDescription, privacy: .public)")
+            alertTitle = L10n("Failed to Load Planet Library")
+            alertMessage = error.localizedDescription
+            isShowingAlert = true
         }
         rebuildSearchSnapshots()
 
@@ -1044,7 +1047,6 @@ final class MyJSONDirectoryMonitor {
             return a.id != article.id
         })
         let articleIDString: String = article.id.uuidString
-        let fromPlanetIDString: String = fromPlanet.id.uuidString
         let toPlanetIDString: String = toPlanet.id.uuidString
         let fromArticlePath = article.path
         let targetArticlePath = fromArticlePath.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent(toPlanetIDString).appendingPathComponent("Articles").appendingPathComponent("\(articleIDString).json")
@@ -1081,11 +1083,20 @@ final class MyJSONDirectoryMonitor {
         movedArticle.planet = toPlanet
         movedArticle.draft = nil
 
-        movedArticle.path = URL(string: article.path.absoluteString.replacingOccurrences(of: fromPlanetIDString, with: toPlanetIDString))!
-        movedArticle.publicBasePath = URL(string: article.publicBasePath.absoluteString.replacingOccurrences(of: fromPlanetIDString, with: toPlanetIDString))!
-        movedArticle.publicIndexPath = URL(string: article.publicIndexPath.absoluteString.replacingOccurrences(of: fromPlanetIDString, with: toPlanetIDString))!
-        movedArticle.publicInfoPath = URL(string: article.publicInfoPath.absoluteString.replacingOccurrences(of: fromPlanetIDString, with: toPlanetIDString))!
-        movedArticle.publicNFTMetadataPath = URL(string: article.publicNFTMetadataPath.absoluteString.replacingOccurrences(of: fromPlanetIDString, with: toPlanetIDString))!
+        movedArticle.path = targetArticlePath
+        movedArticle.publicBasePath = targetArticlePublicPath
+        movedArticle.publicIndexPath = targetArticlePublicPath.appendingPathComponent(
+            "index.html",
+            isDirectory: false
+        )
+        movedArticle.publicInfoPath = targetArticlePublicPath.appendingPathComponent(
+            "article.json",
+            isDirectory: false
+        )
+        movedArticle.publicNFTMetadataPath = targetArticlePublicPath.appendingPathComponent(
+            "nft.json",
+            isDirectory: false
+        )
 
         toPlanet.articles.append(movedArticle)
         toPlanet.articles = toPlanet.articles.sorted(by: { $0.created > $1.created })
```

**File**: `Planet/Helper/DotBitKit.swift` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ class DotBitKit: NSObject {
             } catch {
                 return nil
             }
-            if !(response as! HTTPURLResponse).ok {
+            guard let httpResponse = response as? HTTPURLResponse, httpResponse.ok else {
                 return nil
             }
             if let json = try? JSON(data: data) {
```

**File**: `Planet/Helper/URLUtils.swift` (modified, +21/-20)
```diff
@@ -10,26 +10,27 @@ import Foundation
 import ImageIO
 
 struct URLUtils {
-    static let applicationSupportPath = try! FileManager.default.url(
-        for: .applicationSupportDirectory,
-        in: .userDomainMask,
-        appropriateFor: nil,
-        create: true
-    )
+    private static func userDirectory(_ directory: FileManager.SearchPathDirectory) -> URL {
+        do {
+            return try FileManager.default.url(
+                for: directory,
+                in: .userDomainMask,
+                appropriateFor: nil,
+                create: true
+            )
+        }
+        catch {
+            debugPrint("Failed to resolve user directory \(directory): \(error)")
+            return FileManager.default.urls(for: directory, in: .userDomainMask).first
+                ?? FileManager.default.temporaryDirectory
+        }
+    }
 
-    static let documentsPath = try! FileManager.default.url(
-        for: .documentDirectory,
-        in: .userDomainMask,
-        appropriateFor: nil,
-        create: true
-    )
+    static let applicationSupportPath = userDirectory(.applicationSupportDirectory)
 
-    static let cachesPath = try! FileManager.default.url(
-        for: .cachesDirectory,
-        in: .userDomainMask,
-        appropriateFor: nil,
-        create: true
-    )
+    static let documentsPath = userDirectory(.documentDirectory)
+
+    static let cachesPath = userDirectory(.cachesDirectory)
 
     static let legacyPlanetsPath = applicationSupportPath.appendingPathComponent(
         "planets",
@@ -98,13 +99,13 @@ struct URLUtils {
 
     static let defaultRepoPath: URL = {
         let url = Self.documentsPath.appendingPathComponent("Planet", isDirectory: true)
-        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
         return url
     }()
 
     static let temporaryPath: URL = {
         let url = Self.cachesPath.appendingPathComponent("tmp", isDirectory: true)
-        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
         return url
     }()
 }
```

**File**: `Planet/Helper/ViewUtils.swift` (modified, +6/-2)
```diff
@@ -282,14 +282,18 @@ struct ViewUtils {
 
     static func getPresetGradient(from walletAddress: String) -> Gradient {
         let characters: [UInt8] = Array(walletAddress.utf8)
-        let lastCharUInt8 = characters.last!
+        guard let lastCharUInt8 = characters.last else {
+            return presetGradients[0]
+        }
         let index = Int(lastCharUInt8) % presetGradients.count
         return presetGradients[index]
     }
 
     static func getEmoji(from walletAddress: String) -> String {
         let characters: [UInt8] = Array(walletAddress.utf8)
-        let lastCharUInt8 = characters.last!
+        guard let lastCharUInt8 = characters.last else {
+            return emojiList[0]
+        }
         let index = Int(lastCharUInt8) % emojiList.count
         return emojiList[index]
     }
```

---

### Incident Patch 15: `4181d16a` (2026-04-30)
**Commit Message**: Fix star action localization

**File**: `Planet/Views/Following/FollowingArticleItemView.swift` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ struct FollowingArticleItemView: View {
                 } label: {
                     Text("Delete Article")
                 }
-                Menu("Star") {
+                Menu("Add Star") {
                     ArticleSetStarView(article: article)
                 }
                 if article.starred != nil {
```

**File**: `Planet/Views/My/MyArticleItemView.swift` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ struct MyArticleItemView: View {
                     }
                 }
 
-                Menu("Star") {
+                Menu("Add Star") {
                     ArticleSetStarView(article: article)
                 }
                 if article.starred != nil {
```

**File**: `Planet/en.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@
 "Mark as Unread" = "";
 "Delete Article" = "";
 "Remove Star" = "";
+"Add Star" = "Star";
 "Star" = "";
 "Sparkles" = "";
 "Heart" = "";
```

**File**: `Planet/ja.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@
 "Mark as Unread" = "未読にする";
 "Delete Article" = "記事を削除";
 "Remove Star" = "スターを外す";
+"Add Star" = "スターを付ける";
 "Star" = "スター";
 "Sparkles" = "きらめき";
 "Heart" = "ハート";
```

**File**: `Planet/versioning.xcconfig` (modified, +1/-1)
```diff
@@ -1 +1 @@
-CURRENT_PROJECT_VERSION = 2768
+CURRENT_PROJECT_VERSION = 2769
```

**File**: `Planet/zh-Hans.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -61,8 +61,9 @@
 "Mark as Read" = "标记为已读";
 "Mark as Unread" = "标记为未读";
 "Delete Article" = "删除文章";
-"Remove Star" = "删除标记";
-"Star" = "星";
+"Remove Star" = "移除星标";
+"Add Star" = "加星标";
+"Star" = "星标";
 "Sparkles" = "闪闪发光";
 "Heart" = "心";
 "Question" = "问题";
```

**File**: `Planet/zh-Hant.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@
 "Mark as Unread" = "標示為未讀";
 "Delete Article" = "刪除文章";
 "Remove Star" = "移除星號";
+"Add Star" = "加星號";
 "Star" = "星號";
 "Sparkles" = "閃光";
 "Heart" = "心";
```

#### Recent Merged Pull Requests:
- **PR #462** (2026-03-26): Add Apple native framework ideas for enhancing Planet (@livid)
- **PR #442** (closed): Add sleep helper to control user idle sleep event. (@kailuo)
- **PR #439** (2025-08-22): Fix memory leaks in CMarkRenderer. (@kailuo)
- **PR #437** (2025-08-22): Fix Podcast Feed Rendering (@kailuo)
- **PR #433** (2025-06-14): Fix writer drag-n-drop animation (@kailuo)
- **PR #429** (closed): Migrate console logging to Blackbird database. (@kailuo)
- **PR #427** (2025-05-21): Add Menubar icon (@hewigovens)
- **PR #425** (2025-05-13): Revert docktile sendable class. (@kailuo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
