# Forensic Learning Record (Deep Inspection): EhPanda-Team/EhPanda

> **Canonical Artifact**: `07_PROJECT_LEARNING/ehpanda-team-ehpanda-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EhPanda-Team/EhPanda](https://github.com/EhPanda-Team/EhPanda))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:01:08.086Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EhPanda-Team/EhPanda`
- **Description**: An unofficial E-Hentai App for iOS built with SwiftUI & TCA.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3988 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `EhPanda/App/Tools/Utilities/AppUtil.swift`
```
//
//  AppUtil.swift
//  EhPanda
//

import Foundation

struct AppUtil {
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "null"
    }
    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "null"
    }

    private static let internalIsTesting = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    public static var isTesting: Bool {
        #if DEBUG
        internalIsTesting
        #else
        false
        #endif
    }

    static var galleryHost: GalleryHost {
        let rawValue: String? = UserDefaultsUtil.value(forKey: .galleryHost)
        return GalleryHost(rawValue: rawValue ?? "") ?? .ehentai
    }

    static func dispatchMainSync(execute work: () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.sync(execute: work)
        }
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/CookieUtil.swift`
```
//
//  CookieUtil.swift
//  EhPanda
//

import Foundation

// MARK: Cookie
struct CookieUtil {
    static var didLogin: Bool {
        CookieUtil.verify(for: Defaults.URL.ehentai, isEx: false)
        || CookieUtil.verify(for: Defaults.URL.exhentai, isEx: true)
    }

    static func verify(for url: URL, isEx: Bool) -> Bool {
        guard let cookies = HTTPCookieStorage.shared.cookies(for: url), !cookies.isEmpty else { return false }

        var igneous, memberID, passHash: String?
        cookies.forEach { cookie in
            guard let expiresDate = cookie.expiresDate, expiresDate > .now, !cookie.value.isEmpty else { return }
            if cookie.name == Defaults.Cookie.igneous && cookie.value != Defaults.Cookie.mystery {
                igneous = cookie.value
            }
            if cookie.name == Defaults.Cookie.ipbMemberId {
                memberID = cookie.value
            }
            if cookie.name == Defaults.Cookie.ipbPassHash {
                passHash = cookie.value
            }
        }

        return (!isEx || igneous != nil) && memberID != nil && passHash != nil
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/DeviceUtil.swift`
```
//
//  DeviceUtil.swift
//  EhPanda
//

import SwiftUI
import Foundation

struct DeviceUtil {
    static var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }
    static var isPhone: Bool {
        UIDevice.current.userInterfaceIdiom == .phone
    }

    static var isPadWidth: Bool {
        windowW >= 744
    }

    static var isSEWidth: Bool {
        windowW <= 320
    }

    static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .filter({ $0.activationState == .foregroundActive })
            .compactMap({ $0 as? UIWindowScene }).last?
            .windows.filter({ $0.isKeyWindow }).last
    }
    static var anyWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene }).last?
            .windows.last
    }

    static var isLandscape: Bool {
        [.landscapeLeft, .landscapeRight]
            .contains(keyWindow?.windowScene?.effectiveGeometry.interfaceOrientation)
    }

    static var isPortrait: Bool {
        [.portrait, .portraitUpsideDown]
            .contains(keyWindow?.windowScene?.effectiveGeometry.interfaceOrientation)
    }

    static var windowW: CGFloat {
        min(absWindowW, absWindowH)
    }

    static var windowH: CGFloat {
        max(absWindowW, absWindowH)
    }

    static var screenW: CGFloat {
        min(absScreenW, absScreenH)
    }

    static var screenH: CGFloat {
        max(absScreenW, absScreenH)
    }

    static var absWindowW: CGFloat {
        keyWindow?.frame.size.width ?? absScreenW
    }

    static var absWindowH: CGFloat {
        keyWindow?.frame.size.height ?? absScreenH
    }

    static var absScreenW: CGFloat {
        UIScreen.main.bounds.size.width
    }

    static var absScreenH: CGFloat {
        UIScreen.main.bounds.size.height
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/FileUtil.swift`
```
//
//  FileUtil.swift
//  EhPanda
//

import Foundation

struct FileUtil {
    static var documentDirectory: URL? {
        url(for: .documentDirectory)
    }
    static var cachesDirectory: URL? {
        url(for: .cachesDirectory)
    }
    static var logsDirectoryURL: URL? {
        documentDirectory?.appendingPathComponent(Defaults.FilePath.logs)
    }
    static var temporaryDirectory: URL {
        .init(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
    }

    static func url(for searchPathDirectory: FileManager.SearchPathDirectory) -> URL? {
        try? FileManager.default.url(for: searchPathDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/HapticsUtil.swift`
```
//
//  HapticsUtil.swift
//  EhPanda
//

import SwiftUI
import AudioToolbox

struct HapticsUtil {
    static func generateFeedback(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard !isLegacyTapticEngine else {
            generateLegacyFeedback()
            return
        }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func generateNotificationFeedback(style: UINotificationFeedbackGenerator.FeedbackType) {
        guard !isLegacyTapticEngine else {
            generateLegacyFeedback()
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(style)
    }

    private static func generateLegacyFeedback() {
        AudioServicesPlaySystemSound(1519)
        AudioServicesPlaySystemSound(1520)
        AudioServicesPlaySystemSound(1521)
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
    }

    private static let isLegacyTapticEngine: Bool = {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
        return ["iPhone8,1", "iPhone8,2"].contains(identifier)
    }()
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/MarkdownUtil.swift`
```
//
//  MarkdownUtil.swift
//  EhPanda
//

import CasePaths
import CommonMark
import Foundation

struct MarkdownUtil {
    static func parseTexts(markdown: String) -> [String] {
        (try? Document(markdown: markdown))?.blocks
            .compactMap({ $0[case: \.paragraph] })
            .flatMap(\.text)
            .compactMap({ $0[case: \.text] })
        ?? []
    }
    static func parseLinks(markdown: String) -> [URL] {
        (try? Document(markdown: markdown))?.blocks
            .compactMap({ $0[case: \.paragraph] })
            .flatMap(\.text)
            .compactMap({ $0[case: \.link] })
            .compactMap(\.url)
        ?? []
    }
    static func parseImages(markdown: String) -> [URL] {
        (try? Document(markdown: markdown))?.blocks
            .compactMap({ $0[case: \.paragraph] })
            .flatMap(\.text)
            .compactMap({ $0[case: \.image] })
            .compactMap { image in
                if image.url?.absoluteString.isValidURL == true {
                    return image.url
                } else if let title = image.title, title.isValidURL {
                    return .init(string: title)
                }
                return nil
            }
        ?? []
    }
}

// MARK: CasePathable
extension Block: @retroactive CasePathable, @retroactive CasePathIterable {
    public struct AllCasePaths: CasePathReflectable, Sendable {
        public subscript(root: Block) -> PartialCaseKeyPath<Block> {
            switch root {
            case .blockQuote: \.blockQuote
            case .bulletList: \.bulletList
            case .orderedList: \.orderedList
            case .code: \.code
            case .html: \.html
            case .paragraph: \.paragraph
            case .heading: \.heading
            case .thematicBreak: \.thematicBreak
            }
        }

        // swiftlint:disable line_length
        public var blockQuote: AnyCasePath<Block, BlockQuote> {
            AnyCasePath(embed: { .blockQuote($0) }, extract: { if case .blockQuote(let value) = $0 { return value } else { return nil }})
        }
        public var bulletList: AnyCasePath<Block, BulletList> {
            AnyCasePath(embed: { .bulletList($0) }, extract: { if case .bulletList(let value) = $0 { return value } else { return nil }})
        }
        public var orderedList: AnyCasePath<Block, OrderedList> {
            AnyCasePath(embed: { .orderedList($0) }, extract: { if case .orderedList(let value) = $0 { return value } else { return nil }})
        }
        public var code: AnyCasePath<Block, CodeBlock> {
            AnyCasePath(embed: { .code($0) }, extract: { if case .code(let value) = $0 { return value } else { return nil }})
        }
        public var html: AnyCasePath<Block, HTMLBlock> {
            AnyCasePath(embed: { .html($0) }, extract: { if case .html(let value) = $0 { return value } else { return nil }})
        }
        public var paragraph: AnyCasePath<Block, Paragraph> {
            AnyCasePath(embed: { .paragraph($0) }, extract: { if case .paragraph(let value) = $0 { return value } else { return nil }})
        }
        public var heading: AnyCasePath<Block, Heading> {
            AnyCasePath(embed: { .heading($0) }, extract: { if case .heading(let value) = $0 { return value } else { return nil }})
        }
        public var thematicBreak: AnyCasePath<Block, Void> {
            AnyCasePath(embed: { .thematicBreak }, extract: { if case .thematicBreak = $0 { return () } else { return nil }})
        }
        // swiftlint:enable line_length
    }

    public static var allCasePaths: AllCasePaths {
        AllCasePaths()
    }
}

extension Block.AllCasePaths: Sequence {
    public func makeIterator() -> some IteratorProtocol<PartialCaseKeyPath<Block>> {
        [
            \.blockQuote,
             \.bulletList,
             \.orderedList,
             \.code,
             \.html,
             \.paragraph,
             \.heading,
             \.thematicBreak
        ]
        .makeIterator()
    }
}

extension Inline: @retroactive CasePathable, @retroactive CasePathIterable {
    public struct AllCasePaths: CasePathReflectable, Sendable {
        public subscript(root: Inline) -> PartialCaseKeyPath<Inline> {
            switch root {
            case .text: \.text
            case .softBreak: \.softBreak
            case .lineBreak: \.lineBreak
            case .code: \.code
            case .html: \.html
            case .emphasis: \.emphasis
            case .strong: \.strong
            case .link: \.link
            case .image: \.image
            }
        }

        // swiftlint:disable line_length
        public var text: AnyCasePath<Inline, String> {
            AnyCasePath(embed: { .text($0) }, extract: { if case .text(let value) = $0 { return value } else { return nil }})
        }
        public var softBreak: AnyCasePath<Inline, Void> {
            AnyCasePath(embed: { .softBreak }, extract: { if case .softBreak = $0 { return () } else { return nil }})
        }
        public var lineBreak: AnyCasePath<Inline, Void> {
            AnyCasePath(embed: { .lineBreak }, extract: { if case .lineBreak = $0 { return () } else { return nil }})
        }
        public var code: AnyCasePath<Inline, InlineCode> {
            AnyCasePath(embed: { .code($0) }, extract: { if case .code(let value) = $0 { return value } else { return nil }})
        }
        public var html: AnyCasePath<Inline, InlineHTML> {
            AnyCasePath(embed: { .html($0) }, extract: { if case .html(let value) = $0 { return value } else { return nil }})
        }
        public var emphasis: AnyCasePath<Inline, Emphasis> {
            AnyCasePath(embed: { .emphasis($0) }, extract: { if case .emphasis(let value) = $0 { return value } else { return nil }})
        }
        public var strong: AnyCasePath<Inline, Strong> {
            AnyCasePath(embed: { .strong($0) }, extract: { if case .strong(let value) = $0 { return value } else { return nil }})
        }
        public var link: AnyCasePath<Inline, Link> {
            AnyCasePath(embed: { .link($0) }, extract: { if case .link(let value) = $0 { return value } else { return nil }})
        }
        public var image: AnyCasePath<Inline, Image> {
            AnyCasePath(embed: { .image($0) }, extract: { if case .image(let value) = $0 { return value } else { return nil }})
        }
        // swiftlint:enable line_length
    }

    public static var allCasePaths: AllCasePaths {
        AllCasePaths()
    }
}

extension Inline.AllCasePaths: Sequence {
    public func makeIterator() -> some IteratorProtocol<PartialCaseKeyPath<Inline>> {
        [
            \.text,
             \.softBreak,
             \.lineBreak,
             \.code,
             \.html,
             \.emphasis,
             \.strong,
             \.link,
             \.image
        ]
        .makeIterator()
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/URLUtil.swift`
```
//
//  URLUtil.swift
//  EhPanda
//

import Foundation

struct URLUtil {
    // Fetch
    static func searchList(keyword: String, filter: Filter) -> URL {
        Defaults.URL.host.appending(queryItems: [.fSearch: keyword]).applyingFilter(filter)
    }

    static func moreSearchList(keyword: String, filter: Filter, lastID: String) -> URL {
        Defaults.URL.host.appending(queryItems: [.fSearch: keyword, .next: lastID]).applyingFilter(filter)
    }

    static func frontpageList(filter: Filter) -> URL {
        Defaults.URL.host.applyingFilter(filter)
    }

    static func moreFrontpageList(filter: Filter, lastID: String) -> URL {
        Defaults.URL.host.appending(queryItems: [.next: lastID]).applyingFilter(filter)
    }

    static func popularList(filter: Filter) -> URL {
        Defaults.URL.popular.applyingFilter(filter)
    }

    static func watchedList(filter: Filter, keyword: String = "") -> URL {
        var url = Defaults.URL.watched
        if !keyword.isEmpty {
            url.append(queryItems: [.fSearch: keyword])
        }
        return url.applyingFilter(filter)
    }

    static func moreWatchedList(filter: Filter, lastID: String, keyword: String = "") -> URL {
        var url = Defaults.URL.watched.appending(queryItems: [.next: lastID])
        if !keyword.isEmpty {
            url.append(queryItems: [.fSearch: keyword])
        }
        return url.applyingFilter(filter)
    }

    static func favoritesList(
        favIndex: Int,
        keyword: String = "",
        sortOrder: FavoritesSortOrder? = nil
    ) -> URL {
        var url = Defaults.URL.favorites
        if favIndex != -1 {
            url.append(queryItems: [.favcat: String(favIndex)])
        } else {
            url.append(queryItems: [.favcat: .all])
        }
        if !keyword.isEmpty {
            url.append(queryItems: [.fSearch: keyword])
            url.append(queryItems: [.sn: .filterOn, .st: .filterOn, .sf: .filterOn])
        }
        if let sortOrder = sortOrder {
            url.append(queryItems: [
                .inlineSet: sortOrder == .favoritedTime
                ? .sortOrderByFavoritedTime : .sortOrderByUpdateTime
            ])
        }
        return url
    }

    static func moreFavoritesList(
        favIndex: Int,
        lastID: String,
        lastTimestamp: String,
        keyword: String = ""
    ) -> URL {
        var url = Defaults.URL.favorites.appending(queryItems: [.next: [lastID, lastTimestamp].joined(separator: "-")])
        if favIndex != -1 {
            url.append(queryItems: [.favcat: String(favIndex)])
        } else {
            url.append(queryItems: [.favcat: .all])
        }
        if !keyword.isEmpty {
            url.append(queryItems: [.fSearch: keyword])
            url.append(queryItems: [.sn: .filterOn, .st: .filterOn, .sf: .filterOn])
        }
        return url
    }

    static func toplistsList(catIndex: Int, pageNum: Int? = nil) -> URL {
        var url = Defaults.URL.toplist.appending(queryItems: [.topcat: String(catIndex)])
        if let pageNum = pageNum {
            url.append(queryItems: [.letterP: String(pageNum)])
        }
        return url
    }

    static func moreToplistsList(catIndex: Int, pageNum: Int) -> URL {
        Defaults.URL.toplist.appending(queryItems: [.topcat: String(catIndex), .letterP: String(pageNum)])
    }

    static func galleryDetail(url: URL) -> URL {
        url.appending(queryItems: [.showComments: .one])
    }

    static func galleryTorrents(gid: String, token: String) -> URL {
        Defaults.URL.galleryTorrents.appending(queryItems: [.gid: gid, .token: token])
    }

    // Account Associated Operations
    static func addFavorite(gid: String, token: String) -> URL {
        Defaults.URL.galleryPopups
            .appending(queryItems: [.gid: gid, .token: token])
            .appending(queryItems: [.act: .addFavAct])
    }

    static func userInfo(uid: String) -> URL {
        Defaults.URL.forum.appending(queryItems: [.showUser: uid])
    }

    // Misc
    static func detailPage(url: URL, pageNum: Int) -> URL {
        url.appending(queryItems: [.letterP: String(pageNum)])
    }

    static func combinedPreviewURL(plainURL: URL, width: String, height: String, offset: String) -> URL {
        plainURL.appending(queryItems: [.ehpandaWidth: width, .ehpandaHeight: height, .ehpandaOffset: offset])
    }

    // GitHub
    static func githubAPI(repoName: String) -> URL {
        Defaults.URL.githubAPI.appendingPathComponent("\(repoName)/releases/latest")
    }

    static func githubDownload(repoName: String, fileName: String) -> URL {
        Defaults.URL.github.appendingPathComponent("\(repoName)/releases/latest/download/\(fileName)")
    }
}

// MARK: Combining (Filter)
private extension URL {
    func applyingFilter(_ filter: Filter) -> URL {
        var queryItems1 = [Defaults.URL.Component.Key: String]()
        var queryItems2 = [Defaults.URL.Component.Key: Defaults.URL.Component.Value]()

        var categoryValue = 0
        categoryValue += filter.doujinshi ? Category.doujinshi.filterValue : 0
        categoryValue += filter.manga ? Category.manga.filterValue : 0
        categoryValue += filter.artistCG ? Category.artistCG.filterValue : 0
        categoryValue += filter.gameCG ? Category.gameCG.filterValue : 0
        categoryValue += filter.western ? Category.western.filterValue : 0
        categoryValue += filter.nonH ? Category.nonH.filterValue : 0
        categoryValue += filter.imageSet ? Category.imageSet.filterValue : 0
        categoryValue += filter.cosplay ? Category.cosplay.filterValue : 0
        categoryValue += filter.asianPorn ? Category.asianPorn.filterValue : 0
        categoryValue += filter.misc ? Category.misc.filterValue : 0

        if ![0, 1023].contains(categoryValue) {
            queryItems1[.fCats] = String(categoryValue)
        }

        if !filter.advanced { return appending(queryItems: queryItems1).appending(queryItems: queryItems2) }
        queryItems2[.advSearch] = .one

        if filter.galleryName { queryItems2[.fSname] = .filterOn }
        if filter.galleryTags { queryItems2[.fStags] = .filterOn }
        if filter.galleryDesc { queryItems2[.fSdesc] = .filterOn }
        if filter.torrentFilenames { queryItems2[.fStorr] = .filterOn }
        if filter.onlyWithTorrents { queryItems2[.fSto] = .filterOn }
        if filter.lowPowerTags { queryItems2[.fSdt1] = .filterOn }
        if filter.downvotedTags { queryItems2[.fSdt2] = .filterOn }
        if filter.expungedGalleries { queryItems2[.fSh] = .filterOn }

        if filter.minRatingActivated, [2, 3, 4, 5].contains(filter.minRating) {
            queryItems2[.fSr] = .filterOn
            queryItems1[.fSrdd] = String(filter.minRating)
        }

        if filter.pageRangeActivated {
            queryItems2[.fSp] = .filterOn

            switch (Int(filter.pageLowerBound), Int(filter.pageUpperBound)) {
            case let (.some(minPages), .some(maxPages)):
                if minPages > 0 && maxPages > 0 && minPages <= maxPages {
                    queryItems1[.fSpf] = String(minPages)
                    queryItems1[.fSpt] = String(maxPages)
                }

            case let (.some(minPages), _):
                if minPages > 0 {
                    queryItems1[.fSpf] = String(minPages)
                }

            case let (_, .some(maxPages)):
                if maxPages > 0 {
                    queryItems1[.fSpt] = String(maxPages)
                }

            case (.none, .none):
                break
            }
        }

        if filter.disableLanguage { queryItems2[.fSfl] = .filterOn }
        if filter.disableUploader { queryItems2[.fSfu] = .filterOn }
        if filter.disableTags { queryItems2[.fSft] = .filterOn }

        return appending(queryItems: queryItems1).appending(queryItems: queryItems2)
    }
}

```

### Core Architecture Module: `EhPanda/App/Tools/Utilities/UserDefaultsUtil.swift`
```
//
//  UserDefaultsUtil.swift
//  EhPanda
//

import Foundation

struct UserDefaultsUtil {
    static func value<T: Codable>(forKey key: AppUserDefaults) -> T? {
        UserDefaults.standard.value(forKey: key.rawValue) as? T
    }
}

enum AppUserDefaults: String {
    case galleryHost
    case clipboardChangeCount
}

```

### Core Architecture Module: `EhPanda/Database/MODefinition/AppEnvMO+CoreDataClass.swift`
```
//
//  AppEnvMO+CoreDataClass.swift
//  EhPanda
//

import CoreData

public class AppEnvMO: NSManagedObject {}

extension AppEnvMO: ManagedObjectProtocol {
    func toEntity() -> AppEnv {
        AppEnv(
            user: user?.toObject() ?? User(),
            setting: setting?.toObject() ?? Setting(),
            searchFilter: searchFilter?.toObject() ?? Filter(),
            globalFilter: globalFilter?.toObject() ?? Filter(),
            watchedFilter: watchedFilter?.toObject() ?? Filter(),
            tagTranslator: tagTranslator?.toObject() ?? TagTranslator(),
            historyKeywords: historyKeywords?.toObject() ?? [String](),
            quickSearchWords: quickSearchWords?.toObject() ?? [QuickSearchWord]()
        )
    }
}

extension AppEnv: ManagedObjectConvertible {
    @discardableResult func toManagedObject(in context: NSManagedObjectContext) -> AppEnvMO {
        let appEnvMO = AppEnvMO(context: context)

        appEnvMO.user = user.toData()
        appEnvMO.setting = setting.toData()
        appEnvMO.searchFilter = searchFilter.toData()
        appEnvMO.globalFilter = globalFilter.toData()
        appEnvMO.watchedFilter = watchedFilter.toData()
        appEnvMO.tagTranslator = tagTranslator.toData()
        appEnvMO.historyKeywords = historyKeywords.toData()
        appEnvMO.quickSearchWords = quickSearchWords.toData()

        return appEnvMO
    }
}

```

### Core Architecture Module: `EhPanda/Database/MODefinition/AppEnvMO+CoreDataProperties.swift`
```
//
//  AppEnvMO+CoreDataProperties.swift
//  EhPanda
//

import CoreData

extension AppEnvMO {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<AppEnvMO> {
        NSFetchRequest<AppEnvMO>(entityName: "AppEnvMO")
    }

    @NSManaged public var user: Data?
    @NSManaged public var setting: Data?
    @NSManaged public var searchFilter: Data?
    @NSManaged public var globalFilter: Data?
    @NSManaged public var watchedFilter: Data?
    @NSManaged public var tagTranslator: Data?
    @NSManaged public var historyKeywords: Data?
    @NSManaged public var quickSearchWords: Data?
}

```

### Core Architecture Module: `EhPanda/Database/MODefinition/GalleryDetailMO+CoreDataClass.swift`
```
//
//  GalleryDetailMO+CoreDataClass.swift
//  EhPanda
//

import CoreData

public class GalleryDetailMO: NSManagedObject {}

extension GalleryDetailMO: ManagedObjectProtocol {
    func toEntity() -> GalleryDetail {
        GalleryDetail(
            gid: gid, title: title, jpnTitle: jpnTitle, isFavorited: isFavorited,
            visibility: visibility?.toObject() ?? GalleryVisibility.yes,
            rating: rating, userRating: userRating, ratingCount: Int(ratingCount),
            category: Category(rawValue: category).forceUnwrapped,
            language: Language(rawValue: language).forceUnwrapped,
            uploader: uploader, postedDate: postedDate,
            coverURL: coverURL, archiveURL: archiveURL, parentURL: parentURL,
            favoritedCount: Int(favoritedCount), pageCount: Int(pageCount),
            sizeCount: sizeCount, sizeType: sizeType,
            torrentCount: Int(torrentCount)
        )
    }
}
extension GalleryDetail: ManagedObjectConvertible {
    @discardableResult func toManagedObject(in context: NSManagedObjectContext) -> GalleryDetailMO {
        let galleryDetailMO = GalleryDetailMO(context: context)

        galleryDetailMO.gid = gid
        galleryDetailMO.archiveURL = archiveURL
        galleryDetailMO.category = category.rawValue
        galleryDetailMO.coverURL = coverURL
        galleryDetailMO.isFavorited = isFavorited
        galleryDetailMO.visibility = visibility.toData()
        galleryDetailMO.jpnTitle = jpnTitle
        galleryDetailMO.language = language.rawValue
        galleryDetailMO.favoritedCount = Int64(favoritedCount)
        galleryDetailMO.pageCount = Int64(pageCount)
        galleryDetailMO.parentURL = parentURL
        galleryDetailMO.postedDate = postedDate
        galleryDetailMO.rating = rating
        galleryDetailMO.userRating = userRating
        galleryDetailMO.ratingCount = Int64(ratingCount)
        galleryDetailMO.sizeCount = sizeCount
        galleryDetailMO.sizeType = sizeType
        galleryDetailMO.title = title
        galleryDetailMO.torrentCount = Int64(torrentCount)
        galleryDetailMO.uploader = uploader

        return galleryDetailMO
    }
}

```

### Core Architecture Module: `EhPanda/Database/MODefinition/GalleryDetailMO+CoreDataProperties.swift`
```
//
//  GalleryDetailMO+CoreDataProperties.swift
//  EhPanda
//

import CoreData

extension GalleryDetailMO: GalleryIdentifiable {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<GalleryDetailMO> {
        NSFetchRequest<GalleryDetailMO>(entityName: "GalleryDetailMO")
    }

    @NSManaged public var archiveURL: URL?
    @NSManaged public var category: String
    @NSManaged public var coverURL: URL?
    @NSManaged public var gid: String
    @NSManaged public var isFavorited: Bool
    @NSManaged public var jpnTitle: String?
    @NSManaged public var language: String
    @NSManaged public var favoritedCount: Int64
    @NSManaged public var pageCount: Int64
    @NSManaged public var parentURL: URL?
    @NSManaged public var postedDate: Date
    @NSManaged public var rating: Float
    @NSManaged public var userRating: Float
    @NSManaged public var ratingCount: Int64
    @NSManaged public var sizeCount: Float
    @NSManaged public var sizeType: String
    @NSManaged public var title: String
    @NSManaged public var torrentCount: Int64
    @NSManaged public var uploader: String
    @NSManaged public var visibility: Data?
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #458** (2026-07-20): **[BUG] Cannot install 2.8.0 from AltStore source: The file does not exist**
  *Symptoms*: ### Description  <img width="1206" height="508" alt="Image" src="https://github.com/user-attachments/assets/776a9ea3-dfee-449d-bd13-b5fec61de90f" />  ### Checklist  - [ ] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  Installs with no errors  ### Actual behavior  NSCocoaErrorDomain 4: EhPanda could not be downloaded. The file doesn’t exist.  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  iOS 26.5  ### Destination device  iPhone 17 Pro
  **Post-Mortem & Fix Analysis**:
  > Restored the v2.8.0 release, it should be resolved by now.
  > @chihchy Not quite - it now says hash mismatch. You'll want to update the hash in the source.
  > https://github.com/EhPanda-Team/EhPanda/pull/459

- **Issue #452** (2026-07-03): **[BUG] 打开任意本子，点击标签，跳转搜索出来的本子页面一片空白**
  *Symptoms*: ### Description  打开任意本子，点击标签，跳转搜索出来的本子页面一片空白，如图所示  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/a81f48b3-4598-45b6-97f0-e1b337629e55" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/8d4f69b6-cd51-4003-abd2-f8ce6ae77f88" />  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  3.0.0  ### Destination operating system  ios27.0  ### Destination device  iPhone17
  **Post-Mortem & Fix Analysis**:
  > Resolved in the latest 3.0.0 pre-release build.

- **Issue #445** (2026-06-23): **[BUG] app设置在ipad mini6上会出现两个设置框**
  *Symptoms*: ### Description  在进入app并点击设置后，在屏幕上会出现两个不同大小的、不同图层的设置框  <img width="744" height="1133" alt="Image" src="https://github.com/user-attachments/assets/1ae3db87-d484-4985-b38a-bd1bfdd233e5" />  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  仅出现一个设置窗口  ### Actual behavior  出现两个设置框  ### Reproduction steps  1.进入EhPanda app 2.点击设置  ### EhPanda version information  3.0.0 (158)  ### Destination operating system  iPadOS 26.5 (23F77)  ### Destination device  iPad mini 6
  **Post-Mortem & Fix Analysis**:
  > Resolved in the latest 3.0.0 pre-release build.

- **Issue #439** (2026-05-26): **[BUG]部分作品动图无法正常播放**
  *Symptoms*: ### Description  动图无法正常播放，显示为普通图片  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  iPadOS 26.3.1  ### Destination device  iPad Pro, 11-inch (3rd generation)
  **Post-Mortem & Fix Analysis**:
  > In particular, I've also encountered this problem, not only on my phone (15 Pro Max) but also on my iPad (22 Pro 11-inch), and I'm waiting for a solution.
  > I suspect this might be related to .webp format compatibility.

- **Issue #436** (2026-05-26): **[错误]ios18.5**
  *Symptoms*: ### Description  Signature installation flashback v2.8.0  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  ios18  ### Destination device  14pm

- **Issue #429** (2025-10-23): **[BUG] Pre-release v2.8.0 Crashes on Launch**
  *Symptoms*: ### Description  App immediately crashes when opening the app  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  No crash  ### Actual behavior  Crashes  ### Reproduction steps  Immediately crashes  ### EhPanda version information  v2.8.0 (20208b0), installed with TrollStore  ### Destination operating system  iPadOS 17.0  ### Destination device  iPad Pro 6th gen
  **Post-Mortem & Fix Analysis**:
  > Thank you for bringing this up. Unfortunately iPadOS 17.0 is no longer supported in the upcoming version 2.8.0.
  > Understandable 

- **Issue #426** (2025-10-23): **[BUG] Vertical Reading Mode Not Functioning (观看漫画时垂直滑动不起作用）**
  *Symptoms*: ### Description  ipad air(M1),ipadOS 26,  v2.7.10  Description  There seems to be an issue with the vertical reading mode in the comic viewer. While both the right-to-left (RTL) and left-to-right (LTR) reading modes work as expected, I am unable to scroll vertically when the "Vertical Mode" is selected.  Interestingly, vertical scrolling does work correctly in other parts of the app, such as on the search results page. This suggests the bug is isolated to the comic reader component.  Steps to Reproduce  Open any comic to enter the reader view.  Navigate to the reader settings and select "Vertical" as the reading mode.  Attempt to scroll up or down to navigate through the pages.  Expected Behavior  The comic pages should scroll vertically, allowing the user to read by swiping up and down.  Actual Behavior  The reader does not respond to vertical swipe/scroll gestures. The view remains static, making it impossible to read the comic in vertical mode.   ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior    The comic pages should scroll vertically, allowing the user to read by swiping up and down.  ### Actual behavior  The reader does not respond to vertical swipe/scroll gestures. The view remains static, making it impossible to
  **Post-Mortem & Fix Analysis**:
  > Thanks for your feedback with such a detailed description of your issue. It's resolved in v2.8.0.

- **Issue #422** (2025-10-23): **Bugfixes & Liquid Glass adaptation**
  *Symptoms*: 1. feat: Adapt to the new Liquid Glass design. 3. fix: Gesture issue in the reading page. 4. fix: Crash issue in eh setting page. 5. fix: A minor issue in search page.
  **Post-Mortem & Fix Analysis**:
  > Updating the pull request description to fulfill deploy workflow requirements...
  > ### Liquid glass preview  | Favorites  | Reading | | ------------- | ------------- | | ![](https://github.com/user-attachments/assets/23a9a9cd-2e77-4717-b7a8-0d47b96c5455)   | ![](https://github.com/user-attachments/assets/dc6cc46a-b644-484d-a749-586e041ed891)  |
  > Reviewing...

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

### Incident Patch 1: `37b97996` (2026-07-20)
**Commit Message**: Fix typos

**File**: `AltStore.json` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
           "buildVersion": "158",
           "marketingVersion": "2.8.1",
           "date": "2026-07-20T12:11:49Z",
-          "localizedDescription": "1. feat: Adapt to the new Liquid Glass design.\\n3. fix: Gesture issue in the reading page.\\n4. fix: Crash issue in eh setting page.\\n5. fix: A minor issue in search page.",
+          "localizedDescription": "1. feat: Adapt to the new Liquid Glass design.\\n2. fix: Gesture issue in the reading page.\\n3. fix: Crash issue in eh setting page.\\n4. fix: A minor issue in search page.",
           "downloadURL": "https://github.com/EhPanda-Team/EhPanda/releases/download/v2.8.1/EhPanda.ipa",
           "size": 7352364,
           "sha256": "2f389e36270414a8d9f3537e330f5c2bbff80887109c56ff9b4ba68ed377d62b",
```

---

### Incident Patch 2: `ef7395de` (2025-10-22)
**Commit Message**: Too many issues... reverting changes

**File**: `EhPanda.xcodeproj/project.pbxproj` (modified, +16/-20)
```diff
@@ -7,11 +7,6 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		145E7E3E2E36DE6D00822CB0 /* ReadingViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3D2E36DE6D00822CB0 /* ReadingViewModel.swift */; };
-		145E7E3F2E36DE6D00822CB0 /* GestureCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E382E36DE6D00822CB0 /* GestureCoordinator.swift */; };
-		145E7E412E36DE6D00822CB0 /* PageCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3A2E36DE6D00822CB0 /* PageCoordinator.swift */; };
-		145E7E422E36DE6D00822CB0 /* ReadingViewExtensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3C2E36DE6D00822CB0 /* ReadingViewExtensions.swift */; };
-		145E7E432E36DE6D00822CB0 /* ImageStackView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E392E36DE6D00822CB0 /* ImageStackView.swift */; };
 		AB0929B6277F043D00F107CA /* AccountSettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929B5277F043D00F107CA /* AccountSettingReducer.swift */; };
 		AB0929BE2780032400F107CA /* EhSettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929BD2780032400F107CA /* EhSettingReducer.swift */; };
 		AB0929C027805A8200F107CA /* LoginReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929BF27805A8200F107CA /* LoginReducer.swift */; };
@@ -281,6 +276,10 @@
 		EA0C925E2C3EB49500D211F6 /* README.jpn.md in Resources */ = {isa = PBXBuildFile; fileRef = EA0C92582C3EB49500D211F6 /* README.jpn.md */; };
 		EA2E2E7F2A1F7E500038A261 /* SettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA2E2E7E2A1F7E500038A261 /* SettingReducer.swift */; };
 		EA2E2E822A1FA1060038A261 /* SearchReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA2E2E812A1FA1050038A261 /* SearchReducer.swift */; };
+		EA5AA4A72EA9149E00BC2B5C /* PageHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A62EA9149E00BC2B5C /* PageHandler.swift */; };
+		EA5AA4A82EA9149E00BC2B5C /* LiveTextHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A52EA9149E00BC2B5C /* LiveTextHandler.swift */; };
+		EA5AA4A92EA9149E00BC2B5C /* GestureHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A42EA9149E00BC2B5C /* GestureHandler.swift */; };
+		EA5AA4AA2EA9149E00BC2B5C /* AutoPlayHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A32EA9149E00BC2B5C /* AutoPlayHandler.swift */; };
 		EA698C032CCDD2FB0058BC19 /* EquatableVoid.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA698C022CCDD2FB0058BC19 /* EquatableVoid.swift */; };
 		EA698C092CCDE7090058BC19 /* IdentifiableBox.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA698C082CCDE7050058BC19 /* IdentifiableBox.swift */; };
 		EAE63E2129E2A6330048C601 /* SwiftyBeaver in Frameworks */ = {isa = PBXBuildFile; productRef = EAE63E2029E2A6330048C601 /* SwiftyBeaver */; };
@@ -318,11 +317,6 @@
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
-		145E7E382E36DE6D00822CB0 /* GestureCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GestureCoordinator.swift; sourceTree = "<group>"; };
-		145E7E392E36DE6D00822CB0 /* ImageStackView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageStackView.swift; sourceTree = "<group>"; };
-		145E7E3A2E36DE6D00822CB0 /* PageCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PageCoordinator.swift; sourceTree = "<group>"; };
-		145E7E3C2E36DE6D00822CB0 /* ReadingViewExtensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReadingViewExtensions.swift; sourceTree = "<group>"; };
-		145E7E3D2E36DE6D00822CB0 /* ReadingViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReadingViewModel.swift; sourceTree = "<group>"; };
 		AB0929B5277F043D00F107CA /* AccountSettingReducer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AccountSettingReducer.swift; sourceTree = "<group>"; };
 		AB0929BD2780032400F107CA /* EhSettingReducer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EhSettingReducer.swift; sourceTree = "<group>"; };
 		AB0929BF27805A8200F107CA /* LoginReducer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LoginReducer.swift; sourceTree = "<group>"; };
@@ -608,6 +602,10 @@
 		EA0C92582C3EB49500D211F6 /* README.jpn.md */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = net.daringfireball.markdown; name = README.jpn.md; path = READMEs/README.jpn.md; sourceTree = "<group>"; };
 		EA2E2E7E2A1F7E500038A261 /* SettingReducer.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = SettingReducer.swift; sourceTree = "<group>"; };
 		EA2E2E812A1FA1050038A261 /* SearchReducer.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType 
```

**File**: `EhPanda/View/Reading/ReadingReducer.swift` (modified, +433/-818)
```diff
@@ -7,39 +7,34 @@ import SwiftUI
 import TTProgressHUD
 import ComposableArchitecture
 
-// MARK: - Reading Reducer
 @Reducer
 struct ReadingReducer {
-
-    // MARK: - Route
     @CasePathable
     enum Route: Equatable {
         case hud
         case share(IdentifiableBox<ShareItem>)
         case readingSetting(EquatableVoid = .init())
     }
 
-    // MARK: - Share Item
     enum ShareItem: Equatable {
-        case data(Data)
-        case image(UIImage)
-
         var associatedValue: Any {
             switch self {
-            case .data(let data): return data
-            case .image(let image): return image
+            case .data(let data):
+                return data
+            case .image(let image):
+                return image
             }
         }
+        case data(Data)
+        case image(UIImage)
     }
 
-    // MARK: - Image Action
     enum ImageAction {
         case copy(Bool)
         case save(Bool)
         case share(Bool)
     }
 
-    // MARK: - Cancel IDs
     private enum CancelID: CaseIterable {
         case fetchImage
         case fetchDatabaseInfos
@@ -51,107 +46,136 @@ struct ReadingReducer {
         case fetchMPVImageURL
     }
 
-    // MARK: - State
     @ObservableState
     struct State: Equatable {
-        // MARK: - Navigation & UI
         var route: Route?
-        var showsPanel = false
-        var showsSliderPreview = false
-        var hudConfig: TTProgressHUDConfig = .loading
-        var forceRefreshID: UUID = .init()
-
-        // MARK: - Gallery Data
         var gallery: Gallery = .empty
         var galleryDetail: GalleryDetail?
+
         var readingProgress: Int = .zero
+        var forceRefreshID: UUID = .init()
+        var hudConfig: TTProgressHUDConfig = .loading
 
-        // MARK: - Loading States
         var webImageLoadSuccessIndices = Set<Int>()
         var imageURLLoadingStates = [Int: LoadingState]()
         var previewLoadingStates = [Int: LoadingState]()
         var databaseLoadingState: LoadingState = .loading
-
-        // MARK: - Preview Configuration
         var previewConfig: PreviewConfig = .normal(rows: 4)
 
-        // MARK: - URL Storage
         var previewURLs = [Int: URL]()
+
         var thumbnailURLs = [Int: URL]()
         var imageURLs = [Int: URL]()
         var originalImageURLs = [Int: URL]()
 
-        // MARK: - MPV Support
         var mpvKey: String?
         var mpvImageKeys = [Int: String]()
         var mpvSkipServerIdentifiers = [Int: String]()
+
+        var showsPanel = false
+        var showsSliderPreview = false
+
+        // Update
+        func update<T>(stored: inout [Int: T], new: [Int: T], replaceExisting: Bool = true) {
+            guard !new.isEmpty else { return }
+            stored = stored.merging(new, uniquingKeysWith: { stored, new in replaceExisting ? new : stored })
+        }
+        mutating func updatePreviewURLs(_ previewURLs: [Int: URL]) {
+            update(stored: &self.previewURLs, new: previewURLs)
+        }
+        mutating func updateThumbnailURLs(_ thumbnailURLs: [Int: URL]) {
+            update(stored: &self.thumbnailURLs, new: thumbnailURLs)
+        }
+        mutating func updateImageURLs(_ imageURLs: [Int: URL], _ originalImageURLs: [Int: URL]) {
+            update(stored: &self.imageURLs, new: imageURLs)
+            update(stored: &self.originalImageURLs, new: originalImageURLs)
+        }
+
+        // Image
+        func containerDataSource(setting: Setting, isLandscape: Bool = DeviceUtil.isLandscape) -> [Int] {
+            let defaultData = Array(1...gallery.pageCount)
+            guard isLandscape && setting.enablesDualPageMode
+                    && setting.readingDirection != .vertical
+            else { return defaultData }
+
+            let data = setting.exceptCover
+                ? [1] + Array(stride(from: 2, through: gallery.pageCount, by: 2))
+                : Array(stride(from: 1, through: gallery.pageCount, by: 2))
+
+            return data
+        }
+        func imageContainerConfigs(
+            index: Int, setting: Setting, isLandscape: Bool = DeviceUtil.isLandscape
+        ) -> ImageStackConfig {
+            let direction = setting.readingDirection
+            let isReversed = direction == .rightToLeft
+            let isFirstSingle = setting.exceptCover
+            let isFirstPageAndSingle = index == 1 && isFirstSingle
+            let isDualPage = isLandscape && setting.enablesDualPageMode && direction != .vertical
+            let firstIndex = isDualPage && isReversed && !isFirstPageAndSingle ? index + 1 : index
+            let secondIndex = firstIndex + (isReversed ? -1 : 1)
+            let isValidFirstRange = firstIndex >= 1 && firstIndex <= gallery.pageCount
+            let isValidSecondRange = isFirstSingle
+                ? secondIndex >= 2 && secondIndex <= gallery.pageCount
+                : secondIndex >= 1 && secondIndex <= gallery.pageCount
+            return .init(
+                firstIndex:
```

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +524/-366)
```diff
@@ -8,466 +8,624 @@ import Kingfisher
 import SwiftUIPager
 import ComposableArchitecture
 
-// MARK: - Main Reading View
 struct ReadingView: View {
     @Environment(\.colorScheme) private var colorScheme
-    @Bindable var store: StoreOf<ReadingReducer>
 
-    // MARK: - Configuration
+    @Bindable var store: StoreOf<ReadingReducer>
     private let gid: String
     @Binding private var setting: Setting
     private let blurRadius: Double
 
-    // MARK: - View Models
-    @StateObject private var viewModel: ReadingViewModel
-    @StateObject private var gestureCoordinator: GestureCoordinator
-    @StateObject private var pageCoordinator: PageCoordinator
+    @StateObject private var liveTextHandler = LiveTextHandler()
+    @StateObject private var autoPlayHandler = AutoPlayHandler()
+    @StateObject private var gestureHandler = GestureHandler()
+    @StateObject private var pageHandler = PageHandler()
     @StateObject private var page: Page = .first()
 
-    // MARK: - Initialization
     init(
         store: StoreOf<ReadingReducer>,
-        gid: String,
-        setting: Binding<Setting>,
-        blurRadius: Double
+        gid: String, setting: Binding<Setting>, blurRadius: Double
     ) {
         self.store = store
         self.gid = gid
         _setting = setting
         self.blurRadius = blurRadius
+    }
 
-        // Initialize view models with dependencies
-        _viewModel = StateObject(wrappedValue: ReadingViewModel())
-        _gestureCoordinator = StateObject(wrappedValue: GestureCoordinator())
-        _pageCoordinator = StateObject(wrappedValue: PageCoordinator())
+    private var backgroundColor: Color {
+        colorScheme == .light ? Color(.systemGray4) : Color(.systemGray6)
     }
 
-    // MARK: - Body
     var body: some View {
+        changeTriggers(content: { content })
+            .sheet(item: $store.route.sending(\.setNavigation).readingSetting) { _ in
+                NavigationView {
+                    ReadingSettingView(
+                        readingDirection: $setting.readingDirection,
+                        prefetchLimit: $setting.prefetchLimit,
+                        enablesLandscape: $setting.enablesLandscape,
+                        contentDividerHeight: $setting.contentDividerHeight,
+                        maximumScaleFactor: $setting.maximumScaleFactor,
+                        doubleTapScaleFactor: $setting.doubleTapScaleFactor
+                    )
+                    .toolbar {
+                        if !DeviceUtil.isPad && DeviceUtil.isLandscape {
+                            CustomToolbarItem(placement: .cancellationAction) {
+                                Button {
+                                    store.send(.setNavigation(nil))
+                                } label: {
+                                    Image(systemSymbol: .chevronDown)
+                                }
+                            }
+                        }
+                    }
+                }
+                .accentColor(setting.accentColor)
+                .tint(setting.accentColor)
+                .autoBlur(radius: blurRadius)
+                .navigationViewStyle(.stack)
+            }
+            .sheet(item: $store.route.sending(\.setNavigation).share) { shareItemBox in
+                ActivityView(activityItems: [shareItemBox.wrappedValue.associatedValue])
+                    .accentColor(setting.accentColor)
+                    .autoBlur(radius: blurRadius)
+            }
+            .progressHUD(
+                config: store.hudConfig,
+                unwrapping: $store.route,
+                case: \.hud
+            )
+
+            .animation(.linear(duration: 0.1), value: gestureHandler.offset)
+            .animation(.default, value: liveTextHandler.enablesLiveText)
+            .animation(.default, value: liveTextHandler.liveTextGroups)
+            .animation(.default, value: gestureHandler.scale)
+            .animation(.default, value: store.showsPanel)
+            .statusBar(hidden: !store.showsPanel)
+            .onDisappear {
+                liveTextHandler.cancelRequests()
+                setAutoPlayPolocy(.off)
+            }
+            .onAppear { store.send(.onAppear(gid, setting.enablesLandscape)) }
+    }
+
+    var content: some View {
         ZStack {
             backgroundColor.ignoresSafeArea()
 
-            ReadingContentView(
-                store: store,
-                setting: $setting,
-                viewModel: viewModel,
-                gestureCoordinator: gestureCoordinator,
-                pageCoordinator: pageCoordinator,
-                page: page
+            ZStack {
+                if setting.readingDirection == .vertical {
+                    AdvancedList(
+                        page: page,
+                        data: store.state.containerDataSource(setting: setting),
+                        id: \.self,
+                        spacing: setting.contentDividerHeight,
+ 
```

**File**: `EhPanda/View/Reading/Support/AdvancedList.swift` (modified, +23/-159)
```diff
@@ -6,29 +6,20 @@
 import SwiftUI
 import SwiftUIPager
 
-/// Improved vertical list for reading view with iOS 26 scrolling fix
 struct AdvancedList<Element, ID, PageView, G>: View
 where PageView: View, Element: Equatable, ID: Hashable, G: Gesture {
+    @State var performingChanges = false
 
-    // MARK: - State
-    @State private var performingChanges = false
-    @State private var scrollTarget: Element?
-
-    // MARK: - Properties
     private let pagerModel: Page
     private let data: [Element]
     private let id: KeyPath<Element, ID>
     private let spacing: CGFloat
     private let gesture: G
     private let content: (Element) -> PageView
 
-    // MARK: - Initialization
     init<Data: RandomAccessCollection>(
-        page: Page,
-        data: Data,
-        id: KeyPath<Element, ID>,
-        spacing: CGFloat,
-        gesture: G,
+        page: Page, data: Data,
+        id: KeyPath<Element, ID>, spacing: CGFloat, gesture: G,
         @ViewBuilder content: @escaping (Element) -> PageView
     ) where Data.Index == Int, Data.Element == Element {
         self.pagerModel = page
@@ -39,170 +30,43 @@ where PageView: View, Element: Equatable, ID: Hashable, G: Gesture {
         self.content = content
     }
 
-    // MARK: - Body
     var body: some View {
         ScrollViewReader { proxy in
-            ScrollView(.vertical, showsIndicators: false) {
+            ScrollView(showsIndicators: false) {
                 LazyVStack(spacing: spacing) {
-                    ForEach(data, id: id) { element in
-                        contentWithGestures(for: element)
-                            .id(element[keyPath: id])
+                    ForEach(data, id: id) { index in
+                        let longPress = longPressGesture(index: index)
+                        let gestures = longPress.simultaneously(with: gesture)
+                        content(index).gesture(gestures)
                     }
                 }
-                .onAppear {
-                    initialScrollToPage(proxy: proxy)
-                }
+                .onAppear { tryScrollTo(id: pagerModel.index + 1, proxy: proxy) }
             }
-            // iOS 26 compatible scroll handling
-            .coordinateSpace(name: "ScrollView")
             .onChange(of: pagerModel.index) { _, newValue in
-                handlePageChange(newValue: newValue, proxy: proxy)
-            }
-            .onChange(of: scrollTarget) { _, newValue in
-                if let target = newValue {
-                    scrollToTarget(target, proxy: proxy)
-                }
+                tryScrollTo(id: newValue + 1, proxy: proxy)
             }
         }
     }
 
-    // MARK: - Content with Gestures
-    @ViewBuilder
-    private func contentWithGestures(for element: Element) -> some View {
-        let longPress = createLongPressGesture(for: element)
-        let combinedGestures = longPress.simultaneously(with: gesture)
-
-        content(element)
-            .gesture(combinedGestures)
-    }
-
-    // MARK: - Gesture Creation
-    private func createLongPressGesture(for element: Element) -> some Gesture {
-        LongPressGesture(minimumDuration: 0, maximumDistance: .infinity)
+    private func longPressGesture(index: Element) -> some Gesture {
+        // Setting `minimumDuration` to zero will block ScrollView interaction
+        LongPressGesture(minimumDuration: 0.5, maximumDistance: .infinity)
             .onEnded { _ in
-                handleLongPress(for: element)
-            }
-    }
-
-    // MARK: - Event Handlers
-    private func handleLongPress(for element: Element) {
-        guard let index = element as? Int else { return }
-
-        Logger.info("Long press detected", context: ["element": index])
-
-        performingChanges = true
-        pagerModel.update(.new(index: index - 1))
-
-        // Reset performing changes after a delay
-        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
-            performingChanges = false
-        }
-    }
-
-    private func initialScrollToPage(proxy: ScrollViewProxy) {
-        guard !data.isEmpty else { return }
-
-        let targetElement = getElementForPageIndex(pagerModel.index)
-        scrollToElementSafely(targetElement, proxy: proxy, animated: false)
-    }
-
-    private func handlePageChange(newValue: Int, proxy: ScrollViewProxy) {
-        guard !performingChanges else { return }
-
-        Logger.info("Page changed in AdvancedList", context: [
-            "newPageIndex": newValue,
-            "dataCount": data.count
-        ])
-
-        let targetElement = getElementForPageIndex(newValue)
-        scrollToElementSafely(targetElement, proxy: proxy, animated: true)
-    }
-
-    private func scrollToTarget(_ target: Element, proxy: ScrollViewProxy) {
-        scrollToElementSafely(target, proxy: proxy, animated: true)
-        scrollTarget = nil
-    }
-
-    // MARK: - Helper Methods
-    private func getElementForPageIndex(_ pageIndex: Int) -> E
```

**File**: `EhPanda/View/Reading/Support/AutoPlayHandler.swift` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+//
+//  AutoPlayHandler.swift
+//  EhPanda
+//
+
+import SwiftUI
+
+final class AutoPlayHandler: ObservableObject {
+    @Published var policy: AutoPlayPolicy = .off
+    private var timer: Timer?
+
+    deinit {
+        invalidate()
+    }
+
+    func invalidate() {
+        Logger.info("invalidate")
+        timer?.invalidate()
+    }
+
+    func setPolicy(_ policy: AutoPlayPolicy, updatePageAction: @escaping () -> Void) {
+        Logger.info("setPolicy", context: ["policy": policy])
+        self.policy = policy
+        timer?.invalidate()
+        let timeInterval = TimeInterval(policy.rawValue)
+        if timeInterval > 0 {
+            timer = .scheduledTimer(
+                withTimeInterval: timeInterval, repeats: true,
+                block: { _ in updatePageAction() }
+            )
+        }
+    }
+}
```

**File**: `EhPanda/View/Reading/Support/ControlPanel.swift` (modified, +24/-39)
```diff
@@ -25,15 +25,9 @@ struct ControlPanel<G: Gesture>: View {
     private let fetchPreviewURLsAction: (Int) -> Void
 
     init(
-        showsPanel: Binding<Bool>,
-        showsSliderPreview: Binding<Bool>,
-        sliderValue: Binding<Float>,
-        setting: Binding<Setting>,
-        enablesLiveText: Binding<Bool>,
-        autoPlayPolicy: Binding<AutoPlayPolicy>,
-        range: ClosedRange<Float>,
-        previewURLs: [Int: URL],
-        dismissGesture: G,
+        showsPanel: Binding<Bool>, showsSliderPreview: Binding<Bool>, sliderValue: Binding<Float>,
+        setting: Binding<Setting>, enablesLiveText: Binding<Bool>, autoPlayPolicy: Binding<AutoPlayPolicy>,
+        range: ClosedRange<Float>, previewURLs: [Int: URL], dismissGesture: G,
         dismissAction: @escaping () -> Void,
         navigateSettingAction: @escaping () -> Void,
         reloadAllImagesAction: @escaping () -> Void,
@@ -73,18 +67,13 @@ struct ControlPanel<G: Gesture>: View {
                 retryAllFailedImagesAction: retryAllFailedImagesAction
             )
             .offset(y: showsPanel ? 0 : -50)
-
             Spacer()
-
             if range.upperBound > range.lowerBound {
                 LowerPanel(
                     showsSliderPreview: $showsSliderPreview,
-                    sliderValue: $sliderValue,
-                    previewURLs: previewURLs,
-                    range: range,
+                    sliderValue: $sliderValue, previewURLs: previewURLs, range: range,
                     isReversed: setting.readingDirection == .rightToLeft,
-                    dismissGesture: dismissGesture,
-                    dismissAction: dismissAction,
+                    dismissGesture: dismissGesture, dismissAction: dismissAction,
                     fetchPreviewURLsAction: fetchPreviewURLsAction
                 )
                 .animation(.default, value: showsSliderPreview)
@@ -129,29 +118,27 @@ private struct UpperPanel: View {
 
     var body: some View {
         HStack {
-            // Liquid Glass Dismiss Button
-            Button(action: dismissAction) {
-                Image(systemSymbol: .xmark)
+            HStack(spacing: 16) {
+                Button(action: dismissAction) {
+                    Image(systemSymbol: .xmark)
+                        .font(.title2)
+                        .frame(width: 44, height: 44)
+                }
+                .glassEffect(.regular.interactive())
+
+                Text(title)
                     .font(.title2)
-                    .foregroundColor(.primary)
-                    .frame(width: 44, height: 44)
+                    .fontWeight(.bold)
+                    .monospacedDigit()
+                    .lineLimit(1)
+                    .padding(.horizontal, 16)
+                    .padding(.vertical, 8)
+                    .glassEffect(.regular.interactive())
             }
-            .glassEffect(.regular.interactive())
-
-            Spacer()
-
-            // Page Number Display in Liquid Glass Bubble
-            Text(title)
-                .bold()
-                .lineLimit(1)
-                .padding(.horizontal, 16)
-                .padding(.vertical, 8)
-                .glassEffect()
 
             Spacer()
 
-            // Toolbar Grouped in Liquid Glass Container
-            HStack(spacing: 16) {
+            HStack(spacing: 20) {
                 Button {
                     enablesLiveText.toggle()
                 } label: {
@@ -221,10 +208,11 @@ private struct UpperPanel: View {
                 .buttonStyle(.borderless)
                 .font(.title2)
             }
-            .padding(.vertical, 8)
-            .padding(.horizontal, 16)
+            .padding(.vertical, 12)
+            .padding(.horizontal, 20)
             .glassEffect(.regular.interactive())
         }
+        .foregroundStyle(.primary)
         .padding(.horizontal, 20)
     }
 }
@@ -258,7 +246,6 @@ private struct LowerPanel<G: Gesture>: View {
 
     var body: some View {
         VStack(spacing: 30) {
-            // Dismiss Button
             Button(action: dismissAction) {
                 Image(systemSymbol: .xmark)
                     .foregroundColor(.primary)
@@ -269,7 +256,6 @@ private struct LowerPanel<G: Gesture>: View {
             .gesture(dismissGesture)
             .opacity(showsSliderPreview ? 0 : 1)
 
-            // Slider in Liquid Glass Bubble
             VStack(spacing: 0) {
                 SliderPreivew(
                     showsSliderPreview: $showsSliderPreview,
@@ -291,7 +277,6 @@ private struct LowerPanel<G: Gesture>: View {
                         in: range,
                         onEditingChanged: { if !$0 { showsSliderPreview = false } }
                     )
-                    // wtaf is happening here?
                     .frame(width: DeviceUtil.windowW * 0.6)
                     .rotationEffect(.init(degrees: isReversed ? 180 : 0))
                     .simultaneousGesture(
```

**File**: `EhPanda/View/Reading/Support/GestureCoordinator.swift` (removed, +0/-372)
```diff
@@ -1,372 +0,0 @@
-//
-//  GestureCoordinator.swift
-//  EhPanda
-//
-
-import SwiftUI
-import SwiftUIPager
-
-// MARK: - Gesture Coordinator
-final class GestureCoordinator: ObservableObject {
-    // MARK: - Published Properties
-    @Published var scaleAnchor: UnitPoint = .center
-    @Published var scale: Double = 1.0
-    @Published var offset: CGSize = .zero
-    @Published var dragStartOffset: CGSize = .zero
-
-    // MARK: - Private Properties
-    private var baseScale: Double = 1.0
-    private var baseOffset: CGSize = .zero
-    private var currentPanOffset: CGSize = .zero
-    private var setting: Setting = .init()
-
-    // MARK: - Configuration
-    private var gestureConfig: GestureConfiguration = .init()
-
-    // MARK: - Setup
-    func setup(setting: Setting) {
-        self.setting = setting
-        gestureConfig = GestureConfiguration(setting: setting)
-    }
-
-    func cleanup() {
-        resetToDefaults()
-    }
-
-    private func resetToDefaults() {
-        scale = 1.0
-        offset = .zero
-        scaleAnchor = .center
-        baseScale = 1.0
-        baseOffset = .zero
-    }
-
-    // MARK: - Gesture Handlers
-
-    /// Handles single tap gestures for page navigation or panel toggling
-    func handleSingleTap(
-        readingDirection: ReadingDirection,
-        onPageNavigation: @escaping (Int) -> Void,
-        onTogglePanel: @escaping () -> Void
-    ) {
-        Logger.info("Handle single tap", context: ["readingDirection": readingDirection])
-
-        // For vertical reading, always toggle panel
-        guard readingDirection != .vertical,
-              let touchPoint = TouchHandler.shared.currentPoint
-        else {
-            onTogglePanel()
-            return
-        }
-
-        let tapRegion = determineTapRegion(point: touchPoint)
-        handleTapRegion(
-            tapRegion,
-            readingDirection: readingDirection,
-            onPageNavigation: onPageNavigation,
-            onTogglePanel: onTogglePanel
-        )
-    }
-
-    /// Handles double tap gestures for zoom
-    func handleDoubleTap() {
-        Logger.info("Handle double tap", context: [
-            "currentScale": scale,
-            "doubleTapScale": setting.doubleTapScaleFactor
-        ])
-
-        let targetScale = scale == 1.0 ? setting.doubleTapScaleFactor : 1.0
-
-        if let touchPoint = TouchHandler.shared.currentPoint {
-            updateScaleAnchor(for: touchPoint)
-        }
-
-        withAnimation(.easeInOut(duration: 0.25)) {
-            scale = targetScale
-            if targetScale == 1.0 {
-                offset = .zero
-                scaleAnchor = .center
-            }
-        }
-
-        baseScale = scale
-        baseOffset = offset
-    }
-
-    /// Handles magnification (pinch) gestures
-    func handleMagnificationChanged(value: Double) {
-        Logger.info("Handle magnification changed", context: ["value": value])
-
-        if value == 1.0 {
-            baseScale = scale
-        }
-
-        if let touchPoint = TouchHandler.shared.currentPoint {
-            updateScaleAnchor(for: touchPoint)
-        }
-
-        let newScale = min(max(value * baseScale, 1.0), setting.maximumScaleFactor)
-        scale = newScale
-        constrainOffset()
-    }
-
-    func handleMagnificationEnded(value: Double) {
-        Logger.info("Handle magnification ended", context: ["value": value])
-
-        let finalScale = min(max(value * baseScale, 1.0), setting.maximumScaleFactor)
-
-        // Snap to 1.0 if very close
-        if abs(finalScale - 1.0) < 0.05 {
-            withAnimation(.easeOut(duration: 0.2)) {
-                scale = 1.0
-                offset = .zero
-                scaleAnchor = .center
-            }
-        } else {
-            scale = finalScale
-            // Apply constraints after scale change to ensure proper bounds
-            constrainOffset()
-        }
-
-        baseScale = scale
-        baseOffset = offset
-    }
-
-    /// Handles drag gestures for panning when zoomed
-    func handleDragChanged(value: DragGesture.Value) {
-        guard scale > 1.0 else { return }
-
-        Logger.info("Handle drag changed", context: [
-            "translation": value.translation,
-            "scale": scale,
-            "currentPanOffset": currentPanOffset
-        ])
-
-        // Add high sensitivity multiplier for more responsive movement
-        let sensitivity: CGFloat = 2.0
-        let adjustedTranslation = CGSize(
-            width: value.translation.width * sensitivity,
-            height: value.translation.height * sensitivity
-        )
-
-        // Update current pan offset
-        currentPanOffset = adjustedTranslation
-
-        // Calculate total offset (base + current pan)
-        let totalOffset = CGSize(
-            width: baseOffset.width + currentPanOffset.width,
-            height: baseOffset.height + currentPanOffset.height
-        )
-
-        // Apply boundary constraints to prevent d
```

**File**: `EhPanda/View/Reading/Support/GestureHandler.swift` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+//
+//  GestureHandler.swift
+//  EhPanda
+//
+
+import SwiftUI
+
+final class GestureHandler: ObservableObject {
+    @Published var scaleAnchor: UnitPoint = .center
+    @Published var scale: Double = 1
+    @Published var offset: CGSize = .zero
+    @Published private var baseScale: Double = 1
+    @Published private var newOffset: CGSize = .zero
+
+    private func edgeWidth(x: Double) -> Double {
+        let marginW = DeviceUtil.absWindowW * (scale - 1) / 2
+        let leadingMargin = scaleAnchor.x / 0.5 * marginW
+        let trailingMargin = (1 - scaleAnchor.x) / 0.5 * marginW
+        return min(max(x, -trailingMargin), leadingMargin)
+    }
+    private func edgeHeight(y: Double) -> Double {
+        let marginH = DeviceUtil.absWindowH * (scale - 1) / 2
+        let topMargin = scaleAnchor.y / 0.5 * marginH
+        let bottomMargin = (1 - scaleAnchor.y) / 0.5 * marginH
+        return min(max(y, -bottomMargin), topMargin)
+    }
+    private func correctOffset() {
+        offset.width = edgeWidth(x: offset.width)
+        offset.height = edgeHeight(y: offset.height)
+    }
+    private func correctScaleAnchor(point: CGPoint) {
+        let x = min(1, max(0, point.x / DeviceUtil.absWindowW))
+        let y = min(1, max(0, point.y / DeviceUtil.absWindowH))
+        scaleAnchor = .init(x: x, y: y)
+    }
+    private func setOffset(_ offset: CGSize) {
+        self.offset = offset
+        correctOffset()
+    }
+    private func setScale(scale: Double, maximum: Double) {
+        guard scale >= 1 && scale <= maximum else { return }
+        self.scale = scale
+        correctOffset()
+    }
+
+    func onSingleTapGestureEnded(
+        readingDirection: ReadingDirection,
+        setPageIndexOffsetAction: @escaping (Int) -> Void,
+        toggleShowsPanelAction: @escaping () -> Void
+    ) {
+        Logger.info("onSingleTapGestureEnded", context: ["readingDirection": readingDirection])
+        guard readingDirection != .vertical,
+              let pointX = TouchHandler.shared.currentPoint?.x
+        else {
+            toggleShowsPanelAction()
+            return
+        }
+        let rightToLeft = readingDirection == .rightToLeft
+        if pointX < DeviceUtil.absWindowW * 0.2 {
+            setPageIndexOffsetAction(rightToLeft ? 1 : -1)
+        } else if pointX > DeviceUtil.absWindowW * (1 - 0.2) {
+            setPageIndexOffsetAction(rightToLeft ? -1 : 1)
+        } else {
+            toggleShowsPanelAction()
+        }
+    }
+
+    func onDoubleTapGestureEnded(scaleMaximum: Double, doubleTapScale: Double) {
+        Logger.info("onDoubleTapGestureEnded", context: [
+            "scaleMaximum": scaleMaximum, "doubleTapScale": doubleTapScale
+        ])
+        let newScale = scale == 1 ? doubleTapScale : 1
+        if let point = TouchHandler.shared.currentPoint {
+            correctScaleAnchor(point: point)
+        }
+        setOffset(.zero)
+        setScale(scale: newScale, maximum: scaleMaximum)
+    }
+
+    func onMagnificationGestureChanged(value: Double, scaleMaximum: Double) {
+        Logger.info("onMagnificationGestureChanged", context: [
+            "value": value, "scaleMaximum": scaleMaximum
+        ])
+        if value == 1 {
+            baseScale = scale
+        }
+        if let point = TouchHandler.shared.currentPoint {
+            correctScaleAnchor(point: point)
+        }
+        setScale(scale: value * baseScale, maximum: scaleMaximum)
+    }
+
+    func onMagnificationGestureEnded(value: Double, scaleMaximum: Double) {
+        Logger.info("onMagnificationGestureEnded", context: [
+            "value": value, "scaleMaximum": scaleMaximum
+        ])
+        onMagnificationGestureChanged(value: value, scaleMaximum: scaleMaximum)
+        if value * baseScale - 1 < 0.01 {
+            setScale(scale: 1, maximum: scaleMaximum)
+        }
+        baseScale = scale
+    }
+
+    func onDragGestureChanged(value: DragGesture.Value) {
+        Logger.info("onDragGestureChanged", context: ["value": value])
+        guard scale > 1 else { return }
+        let newX = value.translation.width + newOffset.width
+        let newY = value.translation.height + newOffset.height
+        let newOffsetW = edgeWidth(x: newX)
+        let newOffsetH = edgeHeight(y: newY)
+        setOffset(.init(width: newOffsetW, height: newOffsetH))
+    }
+
+    func onDragGestureEnded(value: DragGesture.Value) {
+        Logger.info("onDragGestureEnded", context: ["value": value])
+        onDragGestureChanged(value: value)
+        if scale > 1 {
+            newOffset.width = offset.width
+            newOffset.height = offset.height
+        }
+    }
+
+    func onControlPanelDismissGestureEnded(value: DragGesture.Value, dismissAction: @escaping () -> Void) {
+        Logger.info("onControlPanelDismissGestureEnded", context: ["value": value])
+        if value.predictedEndTranslation.height > 30 {
+            dismissAction()
+        }
+    }
+}
```

---

### Incident Patch 3: `989717a1` (2025-10-19)
**Commit Message**: Resolve EhSetting page crash issue

**File**: `EhPanda/View/Setting/EhSetting/EhSettingView.swift` (modified, +11/-8)
```diff
@@ -874,14 +874,17 @@ private struct ValuePicker: View {
         Slider(
             value: $value,
             in: range,
-            step: 1,
-            minimumValueLabel: Text(String(Int(range.lowerBound)) + unit)
-                .fontWeight(.medium)
-                .font(.callout),
-            maximumValueLabel: Text(String(Int(range.upperBound)) + unit)
-                .fontWeight(.medium)
-                .font(.callout),
-            label: EmptyView.init
+            label: EmptyView.init,
+            minimumValueLabel: {
+                Text(String(Int(range.lowerBound)) + unit)
+                    .fontWeight(.medium)
+                    .font(.callout)
+            },
+            maximumValueLabel: {
+                Text(String(Int(range.upperBound)) + unit)
+                    .fontWeight(.medium)
+                    .font(.callout)
+            }
         )
     }
 }
```

---

### Incident Patch 4: `348bc073` (2025-10-19)
**Commit Message**: Resolve quick search empty cell issue

**File**: `EhPanda/View/Search/SearchRootView.swift` (modified, +23/-8)
```diff
@@ -214,10 +214,9 @@ private struct QuickSearchWordsSection: View {
     }
 
     private var keywords: [WrappedKeyword] {
-        quickSearchWords.map { word in
-            .init(keyword: word.content, displayText: word.name)
-        }
-        .removeDuplicates()
+        quickSearchWords
+            .map({ .init(keyword: $0.content, displayText: $0.name) })
+            .removeDuplicates()
     }
 
     var body: some View {
@@ -245,7 +244,7 @@ private struct HistoryKeywordsSection: View {
     var body: some View {
         SubSection(title: L10n.Localizable.SearchView.Section.Title.recentlySearched, showAll: false) {
             DoubleVerticalKeywordsStack(
-                keywords: keywords.map({ WrappedKeyword(keyword: $0) }),
+                keywords: keywords.map(WrappedKeyword.init),
                 searchAction: searchAction,
                 removeAction: removeAction
             )
@@ -345,16 +344,23 @@ private struct KeywordCell: View {
         self.removeAction = removeAction
     }
 
+    var title: String {
+        wrappedKeyword.displayText.isEmpty ? wrappedKeyword.keyword : wrappedKeyword.displayText
+    }
+
     var body: some View {
         HStack(spacing: 20) {
             Button {
                 searchAction(wrappedKeyword.keyword)
             } label: {
                 Image(systemSymbol: .magnifyingglass)
-                Text(wrappedKeyword.displayText ?? wrappedKeyword.keyword).lineLimit(1)
-                Spacer()
+
+                Text(title)
+                    .frame(maxWidth: .infinity, alignment: .leading)
+                    .lineLimit(1)
             }
             .tint(.primary)
+
             if removeAction != nil {
                 Button {
                     removeAction?(wrappedKeyword.keyword)
@@ -400,7 +406,16 @@ private struct HistoryGalleriesSection: View {
 // MARK: Definition
 private struct WrappedKeyword: Hashable {
     let keyword: String
-    var displayText: String?
+    let displayText: String
+
+    init(keyword: String, displayText: String) {
+        self.keyword = keyword
+        self.displayText = displayText
+    }
+
+    init(keyword: String) {
+        self.init(keyword: keyword, displayText: .init())
+    }
 }
 
 struct SearchRootView_Previews: PreviewProvider {
```

---

### Incident Patch 5: `a84196c8` (2025-07-29)
**Commit Message**: fixed reading view slider bottom padding under liquid glass effect and added interactive button. ready to release.

**File**: `EhPanda/View/Reading/Support/ControlPanel.swift` (modified, +5/-5)
```diff
@@ -128,7 +128,7 @@ private struct UpperPanel: View {
                         .foregroundColor(.primary)
                         .frame(width: 44, height: 44)
                 }
-                .glassEffect()
+                .glassEffect(.regular.interactive())
                 .padding(.leading, 20)
             } else {
                 Button(action: dismissAction) {
@@ -239,7 +239,7 @@ private struct UpperPanel: View {
                 }
                 .padding(.horizontal, 16)
                 .padding(.vertical, 8)
-                .glassEffect()
+                .glassEffect(.regular.interactive())
                 .padding(.trailing, 20)
             } else {
                 HStack(spacing: 20) {
@@ -352,7 +352,7 @@ private struct LowerPanel<G: Gesture>: View {
                         .font(.title2)
                         .frame(width: 44, height: 44)
                 }
-                .glassEffect(in: RoundedRectangle(cornerRadius: 22))
+                .glassEffect(.regular.interactive())
                 .gesture(dismissGesture)
                 .opacity(showsSliderPreview ? 0 : 1)
             } else {
@@ -390,10 +390,10 @@ private struct LowerPanel<G: Gesture>: View {
                             Text(isReversed ? "\(Int(range.lowerBound))" : "\(Int(range.upperBound))")
                                 .fontWeight(.medium).font(.caption).padding()
                         }
-                        .padding(.horizontal).padding(.bottom)
+                        .padding(.horizontal) //.padding(.bottom)
+                        .glassEffect()
                     }
                 }
-                .glassEffect()
             } else {
                 VStack(spacing: 0) {
                     SliderPreivew(
```

---

### Incident Patch 6: `a04ec80f` (2025-07-28)
**Commit Message**: Update liquid glass to control panel in reading view.

**File**: `EhPanda/View/Reading/Support/ControlPanel.swift` (modified, +196/-31)
```diff
@@ -119,15 +119,129 @@ private struct UpperPanel: View {
     }
 
     var body: some View {
-        ZStack {
-            HStack {
+        HStack {
+            // Liquid Glass Dismiss Button
+            if #available(iOS 26.0, *) {
                 Button(action: dismissAction) {
                     Image(systemSymbol: .xmark)
+                        .font(.title2)
+                        .foregroundColor(.primary)
+                        .frame(width: 44, height: 44)
                 }
-                .font(.title2).padding(.leading, 20)
-                Spacer()
-                Slider(value: .constant(0)).opacity(0)
-                Spacer()
+                .glassEffect()
+                .padding(.leading, 20)
+            } else {
+                Button(action: dismissAction) {
+                    Image(systemSymbol: .xmark)
+                        .font(.title2)
+                        .foregroundColor(.primary)
+                        .frame(width: 44, height: 44)
+                        .background(Material.ultraThinMaterial)
+                        .clipShape(Circle())
+                }
+                .padding(.leading, 20)
+            }
+            
+            Spacer()
+            
+            // Page Number Display in Liquid Glass Bubble
+            if #available(iOS 26.0, *) {
+                Text(title)
+                    .bold()
+                    .lineLimit(1)
+                    .padding(.horizontal, 16)
+                    .padding(.vertical, 8)
+                    .glassEffect()
+            } else {
+                Text(title)
+                    .bold()
+                    .lineLimit(1)
+                    .padding(.horizontal, 16)
+                    .padding(.vertical, 8)
+                    .background(Material.thinMaterial)
+                    .clipShape(RoundedRectangle(cornerRadius: 16))
+            }
+            
+            Spacer()
+            
+            // Toolbar Grouped in Liquid Glass Container
+            if #available(iOS 26.0, *) {
+                HStack(spacing: 16) {
+                    Button {
+                        enablesLiveText.toggle()
+                    }
+                    label: {
+                        Image(systemSymbol: .viewfinderCircle)
+                            .symbolVariant(enablesLiveText ? .fill : .none)
+                            .font(.title2)
+                    }
+                    
+                    if DeviceUtil.isLandscape && setting.readingDirection != .vertical {
+                        Menu {
+                            Button {
+                                setting.enablesDualPageMode.toggle()
+                            } label: {
+                                Text(L10n.Localizable.ReadingView.ToolbarItem.Title.dualPageMode)
+                                if setting.enablesDualPageMode {
+                                    Image(systemSymbol: .checkmark)
+                                }
+                            }
+                            Button {
+                                setting.exceptCover.toggle()
+                            } label: {
+                                Text(L10n.Localizable.ReadingView.ToolbarItem.Title.exceptTheCover)
+                                if setting.exceptCover {
+                                    Image(systemSymbol: .checkmark)
+                                }
+                            }
+                            .disabled(!setting.enablesDualPageMode)
+                        } label: {
+                            Image(systemSymbol: .rectangleSplit2x1)
+                                .symbolVariant(setting.enablesDualPageMode ? .fill : .none)
+                                .font(.title2)
+                        }
+                    }
+                    
+                    Menu {
+                        Text(L10n.Localizable.ReadingView.ToolbarItem.Title.autoPlay).foregroundColor(.secondary)
+                        ForEach(AutoPlayPolicy.allCases) { policy in
+                            Button {
+                                autoPlayPolicy = policy
+                            } label: {
+                                Text(policy.value)
+                                if autoPlayPolicy == policy {
+                                    Image(systemSymbol: .checkmark)
+                                }
+                            }
+                        }
+                    } label: {
+                        Image(systemSymbol: .timer)
+                            .font(.title2)
+                    }
+                    .menuStyle(BorderlessButtonMenuStyle())
+                    
+                    ToolbarFeaturesMenu {
+                        Button(action: retryAllFailedImagesAction) {
+                            Image(systemSymbol: .exclamationmarkArrowTriangle2Circlepath)
+                            Text(L10n.Localizable.ReadingView.ToolbarItem.Button.retryAll
```

---

### Incident Patch 7: `a9604f7f` (2025-07-28)
**Commit Message**: revert bundle identifier

**File**: `EhPanda.xcodeproj/project.pbxproj` (modified, +20/-20)
```diff
@@ -2092,10 +2092,10 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++17";
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ShareExtension/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = ShareExtension;
@@ -2106,9 +2106,9 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda.shareExtension;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda.shareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = ShareExtension_Dev;
 				SKIP_INSTALL = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_VERSION = 5.0;
@@ -2120,10 +2120,10 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++17";
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ShareExtension/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = ShareExtension;
@@ -2134,9 +2134,9 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda.shareExtension;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda.shareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = ShareExtension_Dev;
 				SKIP_INSTALL = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_VERSION = 5.0;
@@ -2271,11 +2271,11 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_ENTITLEMENTS = EhPanda/EhPanda.entitlements;
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
 				DEVELOPMENT_ASSET_PATHS = "";
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = EhPanda/App/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
@@ -2284,9 +2284,9 @@
 					"@executable_path/Frameworks",
 				);
 				OTHER_LDFLAGS = "";
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = App_Dev;
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
@@ -2300,11 +2300,11 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_ENTITLEMENTS = EhPanda/EhPanda.entitlements;
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
 				DEVELOPMENT_ASSET_PATHS = "";
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = EhPanda/App/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
@@ -2313,9 +2313,9 @@
 					"@executable_path/Frameworks",
 				);
 				OTHER_LDFLAGS = "";
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = App_Dev;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
```

---

### Incident Patch 8: `666d2dfd` (2025-07-28)
**Commit Message**: Fix CODEOWNERS

**File**: `.github/CODEOWNERS` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
 # the repo. Unless a later match takes precedence,
 # @global-owner1 and @global-owner2 will be requested for
 # review when someone opens a pull request.
-* @ehpanda-maintainers
+# *       @global-owner1 @global-owner2
 
 # Order is important; the last matching pattern takes the most
 # precedence. When someone opens a pull request that only
@@ -22,7 +22,7 @@
 # be identified in the format @org/team-name. Teams must have
 # explicit write access to the repository. In this example,
 # the octocats team in the octo-org organization owns all .txt files.
-# *.txt @octo-org/octocats
+* @EhPanda-Team/ehpanda-maintainers
 
 # In this example, @doctocat owns any files in the build/logs
 # directory at the root of the repository and any of its
```

---

### Incident Patch 9: `a559192f` (2025-07-28)
**Commit Message**: Revert README.md to original state

**File**: `README.md` (modified, +14/-4)
```diff
@@ -1,9 +1,9 @@
 <h1 align="center">EhPanda</h1>
 
-<h4 align="center">An unofficial fork of the E-Hentai App for iOS.</h4>
+<h4 align="center">An unofficial E-Hentai App for iOS.</h4>
 
 <p align="center">
-<!--<img src="" width="400"></img>-->
+<img src="https://user-images.githubusercontent.com/31207151/105609404-0acbff00-5de4-11eb-9e88-f3c6e0ba9d44.png" width="400"></img>
 </p>
 
 <p align="center">
@@ -22,8 +22,10 @@ App Strings: [{lang}.lproj](/EhPanda/App)
 
 GitHub Readme: [README.{lang}.md](/READMEs)
 
+https://ehpanda.app: [main.js](https://github.com/EhPanda-Team/ehpanda-website/blob/main/src/main.js)
+
 ## Installation
-1. Get the ipa file from [Releases](https://github.com/aalberrty/EhPanda/releases).
+1. Get the ipa file from [Releases](https://github.com/EhPanda-Team/EhPanda/releases).
 2. Use some software like [AltStore](https://altstore.io) to install the ipa file on your device.
 
 ## System Requirements
@@ -35,4 +37,12 @@ The content in this application is derived from E-Hentai, which is user-generate
 **Users of this application should access the E-Hentai content at their own risk.**
 
 ## Questions & Feedback
-Please use [Github Issues](https://github.com/aalberrty/EhPanda/issues) for feedback.
+[![Twitter](https://img.shields.io/badge/Twitter-2CA5E0?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/ehpandaapp)
+[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/BSBE9FCBTq)
+[![Telegram](https://img.shields.io/badge/Telegram-858585?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ehpanda)
+
+## Screenshots
+https://ehpanda.app
+
+## App Icon
+Copyright © 2024 荒木辰造. All rights reserved.
```

---

### Incident Patch 10: `e9b6f42b` (2025-07-28)
**Commit Message**: fix zooming boundaries

**File**: `EhPanda/View/Reading/Support/GestureCoordinator.swift` (modified, +21/-42)
```diff
@@ -121,6 +121,7 @@ final class GestureCoordinator: ObservableObject {
             }
         } else {
             scale = finalScale
+            // Apply constraints after scale change to ensure proper bounds
             constrainOffset()
         }
         
@@ -154,14 +155,14 @@ final class GestureCoordinator: ObservableObject {
             height: baseOffset.height + currentPanOffset.height
         )
         
-        // Temporarily remove constraints for testing
-        offset = totalOffset
+        // Apply boundary constraints to prevent dragging beyond image edges
+        offset = constrainOffset(totalOffset)
         
         Logger.info("Offset updated", context: [
             "adjustedTranslation": adjustedTranslation,
             "currentPanOffset": currentPanOffset,
             "totalOffset": totalOffset,
-            "offset": offset
+            "constrainedOffset": offset
         ])
     }
     
@@ -175,8 +176,12 @@ final class GestureCoordinator: ObservableObject {
         guard scale > 1.0 else { return }
         Logger.info("Handle drag ended")
         
-        // Update base offset with final position
-        baseOffset = offset
+        // Ensure the final position is properly constrained
+        let finalOffset = constrainOffset(offset)
+        offset = finalOffset
+        
+        // Update base offset with final constrained position
+        baseOffset = finalOffset
         currentPanOffset = .zero
     }
     
@@ -233,17 +238,18 @@ final class GestureCoordinator: ObservableObject {
     private func constrainOffset(_ newOffset: CGSize? = nil) -> CGSize {
         let targetOffset = newOffset ?? offset
         
-        let constrainedWidth = constrainOffsetDimension(
-            value: targetOffset.width,
-            anchor: scaleAnchor.x,
-            screenSize: DeviceUtil.absWindowW
-        )
+        // Calculate the maximum allowed offset based on scale and screen size
+        let screenWidth = DeviceUtil.absWindowW
+        let screenHeight = DeviceUtil.absWindowH
         
-        let constrainedHeight = constrainOffsetDimension(
-            value: targetOffset.height,
-            anchor: scaleAnchor.y,
-            screenSize: DeviceUtil.absWindowH
-        )
+        // When scaled, the image is larger than the screen, so we need to constrain
+        // the offset to keep the image content visible
+        let maxOffsetX = screenWidth * (scale - 1) / 2
+        let maxOffsetY = screenHeight * (scale - 1) / 2
+        
+        // Apply constraints to keep the image within bounds
+        let constrainedWidth = min(max(targetOffset.width, -maxOffsetX), maxOffsetX)
+        let constrainedHeight = min(max(targetOffset.height, -maxOffsetY), maxOffsetY)
         
         let constrained = CGSize(width: constrainedWidth, height: constrainedHeight)
         
@@ -253,33 +259,6 @@ final class GestureCoordinator: ObservableObject {
         
         return constrained
     }
-    
-    private func constrainOffsetDimension(
-        value: Double,
-        anchor: Double,
-        screenSize: Double
-    ) -> Double {
-        let margin = screenSize * (scale - 1) / 2
-        let leadingMargin = (anchor / 0.5) * margin
-        let trailingMargin = ((1 - anchor) / 0.5) * margin
-        
-        return min(max(value, -trailingMargin), leadingMargin)
-    }
-    
-    private func constrainOffsetSimple(_ newOffset: CGSize) -> CGSize {
-        let screenWidth = DeviceUtil.absWindowW
-        let screenHeight = DeviceUtil.absWindowH
-        
-        // Calculate maximum allowed offset based on zoom level with more flexibility
-        let maxOffsetX = screenWidth * (scale - 1) * 0.8  // Allow 80% of theoretical max
-        let maxOffsetY = screenHeight * (scale - 1) * 0.8
-        
-        // Apply bounds with more flexibility for natural panning
-        let constrainedWidth = min(max(newOffset.width, -maxOffsetX), maxOffsetX)
-        let constrainedHeight = min(max(newOffset.height, -maxOffsetY), maxOffsetY)
-        
-        return CGSize(width: constrainedWidth, height: constrainedHeight)
-    }
 }
 
 // MARK: - Supporting Types
```

---

### Incident Patch 11: `49320bfc` (2024-12-21)
**Commit Message**: Fix reading page scroll functionality

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +5/-1)
```diff
@@ -120,7 +120,11 @@ struct ReadingView: View {
             }
             .scaleEffect(gestureHandler.scale, anchor: gestureHandler.scaleAnchor)
             .offset(gestureHandler.offset)
-            .highPriorityGesture(dragGesture.simultaneously(with: tapGesture))
+            .highPriorityGesture(
+                dragGesture.simultaneously(with: tapGesture),
+                isEnabled: gestureHandler.scale > 1
+            )
+            .gesture(tapGesture, isEnabled: gestureHandler.scale == 1)
             .gesture(magnificationGesture)
             .ignoresSafeArea()
             .id(store.databaseLoadingState)
```

---

### Incident Patch 12: `cf4f6edf` (2024-12-15)
**Commit Message**: Fix reading page gestures

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +2/-3)
```diff
@@ -105,7 +105,7 @@ struct ReadingView: View {
                         gesture: SimultaneousGesture(magnificationGesture, tapGesture),
                         content: imageStack
                     )
-                    .disabled(gestureHandler.scale != 1)
+                    .scrollDisabled(gestureHandler.scale != 1)
                 } else {
                     Pager(
                         page: page,
@@ -120,8 +120,7 @@ struct ReadingView: View {
             }
             .scaleEffect(gestureHandler.scale, anchor: gestureHandler.scaleAnchor)
             .offset(gestureHandler.offset)
-            .gesture(tapGesture)
-            .gesture(dragGesture)
+            .highPriorityGesture(dragGesture.simultaneously(with: tapGesture))
             .gesture(magnificationGesture)
             .ignoresSafeArea()
             .id(store.databaseLoadingState)
```

---

### Incident Patch 13: `0ecfd25b` (2024-12-12)
**Commit Message**: small fix

**File**: `EhPanda/App/zh-Hant-TW.lproj/Localizable.strings` (modified, +2/-2)
```diff
@@ -759,7 +759,7 @@
 "enum.browsing_country.name.haiti" = "海地";
 "enum.browsing_country.name.heard_island_and_mc_donald_islands" = "赫德島和麥克唐納群島";
 "enum.browsing_country.name.vatican_city_state" = "梵蒂岡";
-"enum.browsing_country.name.honduras" = "巨集都拉斯";
+"enum.browsing_country.name.honduras" = "宏都拉斯";
 "enum.browsing_country.name.hong_kong" = "香港";
 "enum.browsing_country.name.hungary" = "匈牙利";
 "enum.browsing_country.name.iceland" = "冰島";
@@ -849,7 +849,7 @@
 "enum.browsing_country.name.saint_kitts_and_nevis" = "聖克里斯多福及尼維斯";
 "enum.browsing_country.name.saint_lucia" = "聖露西亞";
 "enum.browsing_country.name.saint_martin" = "聖馬丁";
-"enum.browsing_country.name.saint_pierre_and_miquelon" = "聖皮埃爾和密複製";
+"enum.browsing_country.name.saint_pierre_and_miquelon" = "聖皮耶與密克隆";
 "enum.browsing_country.name.saint_vincent_and_the_grenadines" = "聖文森及格瑞那丁";
 "enum.browsing_country.name.samoa" = "薩摩亞";
 "enum.browsing_country.name.san_marino" = "聖馬利諾";
```

---

### Incident Patch 14: `ed554b5c` (2024-11-11)
**Commit Message**: Fix previews parsing

**File**: `EhPanda/App/Tools/Parser.swift` (modified, +20/-34)
```diff
@@ -538,7 +538,8 @@ struct Parser {
                 torrentCount: arcAndTor.1
             )
             tmpGalleryState = GalleryState(
-                gid: gid, tags: tags,
+                gid: gid,
+                tags: tags,
                 previewURLs: previewURLs,
                 previewConfig: try? parsePreviewConfig(doc: doc),
                 comments: parseComments(doc: doc)
@@ -570,7 +571,7 @@ struct Parser {
 
     // MARK: Preview
     static func parsePreviewURLs(doc: HTMLDocument) throws -> [Int: URL] {
-        func parseGT100PreviewURLs(node: XMLElement) -> [Int: URL] {
+        func parseCombinedPreviewURLs(node: XMLElement) -> [Int: URL] {
             var previewURLs = [Int: URL]()
 
             for link in node.xpath("//a") {
@@ -594,14 +595,16 @@ struct Parser {
                     let offset = String(style[rangeE.upperBound..<rangeF.lowerBound])
 
                     previewURLs[index] = URLUtil.combinedPreviewURL(
-                        plainURL: url, width: width,
-                        height: height, offset: offset
+                        plainURL: url,
+                        width: width,
+                        height: height,
+                        offset: offset
                     )
                 }
             }
             return previewURLs
         }
-        func parseGT200PreviewURLs(node: XMLElement) -> [Int: URL] {
+        func parseStandalonePreviewURLs(node: XMLElement) -> [Int: URL] {
             var previewURLs = [Int: URL]()
 
             for link in node.xpath("//a") {
@@ -622,15 +625,11 @@ struct Parser {
             return previewURLs
         }
 
-        guard let gdtNode = doc.at_xpath("//div [@id='gdt']"),
-              let previewMode = try? parsePreviewMode(doc: doc)
+        guard let gdtNode = doc.at_xpath("//div [@id='gdt']")
         else { throw AppError.parseFailed }
 
-        return switch previewMode {
-        case "gt100": parseGT100PreviewURLs(node: gdtNode)
-        case "gt200": parseGT200PreviewURLs(node: gdtNode)
-        default: .init()
-        }
+        let combinedURLs = parseCombinedPreviewURLs(node: gdtNode)
+        return combinedURLs.isEmpty ? parseStandalonePreviewURLs(node: gdtNode) : combinedURLs
     }
 
     // MARK: Comment
@@ -721,31 +720,18 @@ struct Parser {
     static func parseThumbnailURLs(doc: HTMLDocument) throws -> [Int: URL] {
         var thumbnailURLs = [Int: URL]()
 
-        guard let gdtNode = doc.at_xpath("//div [@id='gdt']"),
-              let previewMode = try? parsePreviewMode(doc: doc)
+        guard let gdtNode = doc.at_xpath("//div [@id='gdt']")
         else { throw AppError.parseFailed }
 
-        if ["gt100", "gt200"].contains(previewMode) {
-            for aLink in gdtNode.xpath("a") {
-                guard let href = aLink["href"],
-                      let thumbnailURL = URL(string: href),
-                      let divNode = aLink.at_xpath(".//div[@title and @style]"),
-                      let title = divNode["title"],
-                      let index = parseGTX00IndexFromTitle(from: title)
-                else { continue }
-
-                thumbnailURLs[index] = thumbnailURL
-            }
-        } else {
-            for link in gdtNode.xpath("//div [@class='\(previewMode)']") {
-                guard let aLink = link.at_xpath("//a"),
-                      let thumbnailURLString = aLink["href"],
-                      let thumbnailURL = URL(string: thumbnailURLString),
-                      let index = Int(aLink.at_xpath("//img")?["alt"] ?? "")
-                else { continue }
+        for aLink in gdtNode.xpath("a") {
+            guard let href = aLink["href"],
+                  let thumbnailURL = URL(string: href),
+                  let divNode = aLink.at_xpath(".//div[@title and @style]"),
+                  let title = divNode["title"],
+                  let index = parseGTX00IndexFromTitle(from: title)
+            else { continue }
 
-                thumbnailURLs[index] = thumbnailURL
-            }
+            thumbnailURLs[index] = thumbnailURL
         }
 
         return thumbnailURLs
```

#### Recent Merged Pull Requests:
- **PR #460** (2026-07-20): Bugfixes & Liquid Glass adaptation (@chihchy)
- **PR #459** (closed): Update 2.8.0 sha256 checksum for AltStore (@i0ntempest)
- **PR #457** (2026-07-09): Drop Core Data, persist light app data via `@Shared` (@chihchy)
- **PR #456** (2026-07-05): Migrate localization to Xcode String Catalogs (@chihchy)
- **PR #455** (2026-07-03): Modernize TCA navigation: StackState, @Presents modals, and native alerts (@chihchy)
- **PR #454** (2026-07-01): Remove SwiftyBeaver and rebuild logging on OSLog (@chihchy)
- **PR #453** (2026-06-29): Modularize the app into a local Swift package (@chihchy)
- **PR #451** (2026-06-27): Add Seek to date gallery navigation (@chihchy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
