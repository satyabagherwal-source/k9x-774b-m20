# Forensic Learning Record (Deep Inspection): ming1016/SwiftPamphletApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/ming1016-swiftpamphletapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ming1016/SwiftPamphletApp](https://github.com/ming1016/SwiftPamphletApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:43:51.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ming1016/SwiftPamphletApp`
- **Description**: 戴铭的小册子，一本活的知识手册。使用 SwiftUI + SwiftData + Swift Concurrency Aysnc/Await Actor + GitHub API 开发的 macOS 应用
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2560 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SwiftPamphletApp/Core/FundationFunction.swift`
```
//
//  BaseFunction.swift
//  PresentSwiftUI
//
//  Created by Ming Dai on 2021/11/9.
//

import Foundation
import SwiftUI
import Combine
import Network

// MARK: - Web
func hostFromString(_ urlString: String) -> String {
    let url = URL(string: urlString)
    return url?.host() ?? ""
}


func wrapperHtmlContent(content: String, codeStyle: String = "lioshi.min") -> String {
    let reStr = """
<html lang="zh-Hans" data-darkmode="auto">
\(SPC.rssStyle())
<body>
    <main class="container">
        <article class="article heti heti--classic">
        \(content)
        </article>
    </main>
</body>
\(SPC.rssFooterJS())
</html>
"""
    // <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.4.0/styles/\(codeStyle).css">
    // writeToDownload(fileName: "a.html", content: reStr)
    return reStr
}

// MARK: - 基础
// decoder
// extension 
#if os(macOS)
extension NSPasteboard {
    func copyText(_ text: String) {
        self.clearContents()
        self.declareTypes([.string], owner: nil)
        self.setString(text, forType: .string)
    }
}
#endif

// base64
extension String {
    func base64Encoded() -> String? {
        return self.data(using: .utf8)?.base64EncodedString()
    }

    func base64Decoded() -> String? {
        guard let data = Data(base64Encoded: self) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
// 用于 SwiftData，让布尔值可排序
extension Bool: @retroactive Comparable {
    public static func <(lhs: Self, rhs: Self) -> Bool {
        // the only true inequality is false < true
        !lhs && rhs
    }
}


extension View {
    func debug() -> Self {
        print(Mirror(reflecting: self).subjectType)
        return self
    }
}



```

### Core Architecture Module: `SwiftPamphletApp/Core/Lexer.swift`
```
//
//  Lexer.swift
//  SA
//
//  Created by ming on 2019/8/2.
//  Copyright © 2019 ming. All rights reserved.
//

import Foundation

public enum LexerType {
    case code
    case plain
}

public class Lexer {

    private let text: String
    private var currentIndex: Int
    private var currentCharacter: Character?
    private var type: LexerType

    public init(input: String, type: LexerType) {
        if input.count == 0 {
            // fatalError("Error! input can't be empty")
            text = "0"
        } else {
            text = input
        }
        currentIndex = 0
        currentCharacter = text[text.startIndex]
        self.type = type

    }

    public func allTkFastWithoutNewLineAndWhitespace(operaters:String) -> [Token] {
        let allToken = allTkFast(operaters: operaters)
        let flAllToken = allToken.filter {
            $0 != .newLine
        }
        let fwAllToken = flAllToken.filter {
            $0 != .space
        }
        return fwAllToken
    }

    public func allTkFast(operaters:String) -> [Token] {
        var nText = text.replacingOccurrences(of: " ", with: " starmingspace ")
        nText = nText.replacingOccurrences(of: "\n", with: " starmingnewline ")
        let scanner = Scanner(string: nText)
        var tks = [Token]()
        var set = CharacterSet()
        set.insert(charactersIn: operaters)
        set.formUnion(CharacterSet.whitespacesAndNewlines)

        while !scanner.isAtEnd {
            for operater in operaters {
                let opStr = operater.description
                if (scanner.scanString(opStr) != nil) {
                    tks.append(.id(opStr))
                }
            }

            if let result = scanner.scanUpToCharacters(from: set) {
                let resultString = result as String
                if resultString == "starmingnewline" {
                    tks.append(.newLine)
                } else if resultString == "starmingspace" {
                    tks.append(.space)
                } else {
                    tks.append(.id(result as String))
                }
            }
        }
        tks.append(.eof)
        return tks
    }

    // 返回所有 Token
    public func allTk() -> [Token] {
        var tk = nextTk()
        var all = [tk]
        while tk != .eof {
            tk = self.nextTk()
            all.append(tk)
        }
        return all
    }

    // 流程
    private func nextTk() -> Token {
        // 检查是否到达文件末
        if isEof() {
            return .eof
        }

        if CharacterSet.whitespaces.contains((currentCharacter?.unicodeScalars.first!)!) {
            skipWhiteSpace()
        }

        // 检查是否到达文件末
        if isEof() {
            return .eof
        }

        // 换行
        if CharacterSet.newlines.contains((currentCharacter?.unicodeScalars.first!)!) {
            advance()
            return .newLine
        }

        // 数字
        if CharacterSet.decimalDigits.contains((currentCharacter?.unicodeScalars.first!)!) {
            let n = number()
            print(n.des())
            return n
        }

        // 字符
        if CharacterSet.alphanumerics.contains((currentCharacter?.unicodeScalars.first!)!) {
            return id()
        }

        // 代码分析
        if type == .code {

            // 双引号内字符串
            if currentCharacter == "\"" {
                return doubleQuotationMarksString()
            }

            // 处理注释
            if currentCharacter == "/" {
                // 双引号注释
                if peek() == "/" {
                    advance()
                    advance()
                    return commentsFromDoubleSlash()
                } else if peek() == "*" {
                    advance()
                    advance()
                    return commentsFromSlashAsterisk()
                }
            }
        }

        // 其余当作符号处理
        guard let cStr = currentCharacter else {
            return .eof
        }
        advance()
        return .id(String(cStr))

        // 需要处理严格规则的时候会走下面条件
//        advance()
//        return .eof
    }

    // 对字符的处理
    private func id() -> Token {
        var idStr = ""
        while let character = currentCharacter, CharacterSet.alphanumerics.contains(character.unicodeScalars.first!) {
            idStr += String(character)
            advance()
        }
        return .id(idStr)
    }

    // 对数字的处理
    private func number() -> Token {
        var numStr = ""
        while let character = currentCharacter,CharacterSet.decimalDigits.contains(character.unicodeScalars.first!) {
                numStr += String(character)
                advance()
        }

        if let character = currentCharacter, character == ".", peek() != "." {
            numStr += "."
            advance()
            while let character = currentCharacter, CharacterSet.decimalDigits.contains(character.unicodeScalars.first!) {
                numStr += String(character)
                advance()
            }
            return .constant(.float(Float(numStr)!))
        }
        return .constant(.integer(Int(numStr)!))
    }

    // MARK: 辅助函数
    private func advance() {
        currentIndex += 1
        guard currentIndex < text.count else {
            currentCharacter = nil
            return
        }
        currentCharacter = text[text.index(text.startIndex, offsetBy: currentIndex)]
    }

    // 往前探一个字符
    private func peek() -> String? {
        return peekStep(step: 1)
    }
    private func peekStep(step:Int) -> String? {
        var reStr = ""
        for index in 1..<step+1 {
            let peekIndex = currentIndex + index
            guard peekIndex < text.count else {
                return nil
            }
            reStr.append(text[text.index(text.startIndex, offsetBy: peekIndex)])
        }
        return reStr
    }

    // 取 // 这种注释
    private func commentsFromDoubleSlash() -> Token {
        var cStr = ""
        while let character = currentCharacter, !CharacterSet.newlines.contains(character.unicodeScalars.first!) {
            advance()
            cStr += String(character)
        }
        return .comments(cStr)
    }

    // 取 /* */ 这样的注释
    private func commentsFromSlashAsterisk() -> Token {
        var cStr = ""
        while let character = currentCharacter {
            if character == "*" && peek() == "/" {
                advance()
                advance()
                break
            } else {
                advance()
                cStr += String(character)
            }

        }
        return .comments(cStr)
    }

    // 双引号内字符串
    private func doubleQuotationMarksString() -> Token {
        advance()
        var cStr = ""
        while let character = currentCharacter {
            if character == "\\" && peek() == "\"" {
                advance()
                advance()
                cStr += String("\"")
            } else if character == "\"" {
                advance()
                break
            } else {
                advance()
                cStr += String(character)
            }
        }
        return .string(cStr)
    }

    // 跳过空格
    private func skipWhiteSpace() {
        while let character = currentCharacter, CharacterSet.whitespacesAndNewlines.contains(character.unicodeScalars.first!) {
            advance()
        }
    }

    private func isEof() -> Bool {
        if currentIndex > self.text.count - 1 {
            return true
        }
        return false
    }

}

```

### Core Architecture Module: `SwiftPamphletApp/Core/Token.swift`
```
//
//  Token.swift
//  SA
//
//  Created by ming on 2019/8/5.
//  Copyright © 2019 ming. All rights reserved.
//

import Foundation

public enum Token {
    case eof
    case newLine
    case space
    case comments(String)      // 注释
    case constant(Constant)    // float、int
    case id(String)            // string
    case string(String)        // 代码中引号内字符串

    func des() -> String {
        switch self {
        case .space:
            return " "
        case let .comments(commentString):
            return commentString
        case let .constant(.float(float)):
            return "\(float)"
        case let .constant(.integer(int)):
            return "\(int)"
        case let .constant(.string(string)):
            return string
        case let .id(idString):
            return idString
        case let .string(sString):
            return sString
        default:
            return ""
        }
    }
}

extension Token: Equatable {
    public static func == (lhs: Token, rhs: Token) -> Bool {
        switch (lhs, rhs) {
        case (.eof, .eof):
            return true
        case (.newLine, .newLine):
            return true
        case (.space, .space):
            return true
        case let (.constant(left), .constant(right)):
            return left == right
        case let (.comments(left), .comments(right)):
            return left == right
        case let (.id(left), .id(right)):
            return left == right
        case let (.string(left), .string(right)):
            return left == right
        default:
            return false
        }
    }
}

public enum Constant {
    case string(String)
    case integer(Int)
    case float(Float)
    case boolean(Bool)
}

extension Constant: Equatable {
    public static func == (lhs: Constant, rhs: Constant) -> Bool {
        switch (lhs, rhs) {
        case let (.integer(left), .integer(right)):
            return left == right
        case let (.string(left), .string(right)):
            return left == right
        case let (.float(left), .float(right)):
            return left == right
        case let (.boolean(left), .boolean(right)):
            return left == right
        default:
            return false
        }
    }
}

```

### Core Architecture Module: `SwiftPamphletApp/App/AutoTask.swift`
```
//
//  AutoTask.swift
//  SwiftPamphletApp
//
//  Created by Ming Dai on 2022/2/10.
//

import Foundation
import SMFile

struct AutoTask {
    
    static func buildContentMarkdownFile() {
//        let a1 = ["guide-syntax","guide-features","guide-subject","lib-Combine","lib-Concurrency","lib-SwiftUI"]
//        let a1 = ["lib-SwiftUI"]
//        var mk = ""
//        for e in a1 {
//            let fc:[CustomIssuesModel] = SMFile.loadBundleJSONFile(e + ".json")
//            if e == "guide-syntax" {
//                mk += "## 语法速查\n\n"
//            }
//            if e == "guide-feature" {
//                mk += "## 特性\n\n"
//            }
//            if e == "guide-subject" {
//                mk += "## 专题\n\n"
//            }
//            if e == "lib-Combine" {
//                mk += "## Combine\n\n"
//            }
//            if e == "lib-Concurrency" {
//                mk += "## Concurrency\n\n"
//            }
//            if e == "lib-SwiftUI" {
//                mk += "## SwiftUI\n\n"
//            }
//            for e1 in fc {
//                mk += "### \(e1.name)\n\n"
//                for e2 in e1.issues {
//                    mk += "#### \(e2.title)\n\n"
//                    let str = SMFile.loadBundleString(String(e2.number) + ".md")
//                    mk += str + "\n\n"
//                }
//            }
//        }
//        
//        SMFile.writeToDownload(fileName: "read.md", content: mk)
    }
    
}








```

### Core Architecture Module: `SwiftPamphletApp/App/IntroView.swift`
```
//
//  IntroView.swift
//  SwiftPamphletApp
//
//  Created by Ming Dai on 2021/12/31.
//

import SwiftUI
import MarkdownUI
import SMFile
import SMUI

struct LightingView<Content: View>: View {
    @Environment(\.colorScheme) var colorSchemeMode
    let content: Content
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    var body: some View {
        ZStack {
            content
                .blendMode(colorSchemeMode == .dark ? .colorDodge : .colorBurn)
            content
                .blendMode(colorSchemeMode == .dark ? .softLight : .softLight)
            content
                .blur(radius: 1)
            content
                
        }
    }
}

struct IntroView: View {
    var body: some View {
        VStack(spacing: 15) {
            #if os(macOS)
            if let appIcon = NSImage(named: "AppIcon") {
                Image(nsImage: appIcon)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 120)
            }
            #elseif os(iOS)
            if let appIcon = UIImage(named: "AppIcon") {
                Image(uiImage: appIcon)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 120)
            }
            #endif
            Text("戴铭的小册子").bold()
            LightingView {
                Text("Swift Pamphlet App").gradientTitle(color: .mint)
            }

            HStack {
                Text("一本活的手册")
            }
            if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                Text("版本\(version)").font(.footnote)
            }
            Markdown(SMFile.loadBundleString("1.md"))
        }
        .frame(minWidth: SPC.detailMinWidth)
    }
}




```

### Core Architecture Module: `SwiftPamphletApp/App/SwiftPamphletAppApp.swift`
```
//
//  SwiftPamphletAppApp.swift
//  SwiftPamphletApp
//
//  Created by Ming Dai on 2021/11/17.
//

import SwiftUI
import Combine
import SwiftData
import InfoOrganizer
import SMFile
import SMGitHub
import os.signpost
import BackgroundTasks
import AppIntents

@main
struct SwiftPamphletAppApp: App {
    
    
    
    #if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #elseif os(iOS)
    @State private var metricsManager = MetricsManager()
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif
    
    init() {
        
        let gr = GitHubReq.shared
        if SPC.gitHubAccessToken.isEmpty == true {
            gr.githubat = SPC.githubAccessToken()
        } else {
            gr.githubat = SPC.gitHubAccessToken
        }
    }
    
    @Environment(\.scenePhase) private var phase
    
    var body: some Scene {
        WindowGroup {
            #if os(macOS)
            HomeView()
                .modelContainer(for: [IOInfo.self, DeveloperModel.self, BookmarkModel.self], isUndoEnabled: true)
            #elseif os(iOS)
            HomeiOSView()
//                .modelContainer(for: [IOInfo.self, DeveloperModel.self, BookmarkModel.self], isUndoEnabled: true)
            #endif
        }
        #if os(macOS)
        .windowToolbarStyle(UnifiedWindowToolbarStyle(showsTitle: true)) // 用来控制是否展示标题
        #endif
        #if os(macOS)
        Settings {
            SettingView()
        }
        #endif
        
    }
}



// MARK: - UnCat

#if os(macOS)
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var op: String?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        print("-- AppDelegate Section --")
        // 生成 Markdown 文件
//        AutoTask.buildContentMarkdownFile()

    }
    
    func applicationWillTerminate(_ notification: Notification) {
//        codeCoverageProfrawDump()
    }
    
}
#elseif os(iOS)
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        print("didFinishLaunchingWithOptions")
        return true
    }
    
}
#endif



```

### Core Architecture Module: `SwiftPamphletApp/App/SwiftPamphletAppConfig.swift`
```
//
//  SwiftPamphletAppConfig.swift
//  PresentSwiftUI
//
//  Created by Ming Dai on 2021/11/17.
//

import Foundation
import SMFile

struct SPC {
    static let gitHubAccessToken = "" // 在这里可以手动写上 Github 的 access token。在 https://github.com/settings/tokens 申请你的access token。
    static let githubUDTokenKey = "udtoken" // UserDefault 存储 token 的 key
    static func githubAccessToken() -> String {
        let ud = UserDefaults.standard
        return ud.string(forKey: SPC.githubUDTokenKey) ?? ""
    }
    
    static let detailMinWidth: CGFloat = 550
    static let githubHost = "https://github.com/"
    
    // MARK: AppStorage
    static let isShowGithub = "isShowGithub"
    static let selectedDataLinkString = "selectedDataLinkString"
    static let isFirstRun = "isFirstRun"
    static let customSearchTerm = "customSearchTerm"
    static let isShowInspector = "isShowInspector"
    static let isShowPamphletInspector = "isShowPamphletInspector"
    static let isShowWWDCInspector = "isShowWWDCInspector"
    static let inspectorType = "inspectorType"

    // MARK: GuideListView
    static let expandedGuideItems = "expandedGuideItems"

//    static func loadCustomIssues(jsonFileName: String) -> [CustomIssuesModel] {
//        let lc: [CustomIssuesModel] = SMFile.loadBundleJSONFile(jsonFileName + ".json")
//        return lc
//    }
    
    static func rssStyle() -> String {
        let data = SMFile.loadBundleData("css_cn.html")
        return String(data: data, encoding: .utf8) ?? ""
    }
    
    static func rssFooterJS() -> String {
        let data = SMFile.loadBundleData("footer_js.html")
        return String(data: data, encoding: .utf8) ?? ""
    }
}


```

### Core Architecture Module: `SwiftPamphletApp/GitHubAPIUI/DetailView/RepoView.swift`
```
//
//  RepoView.swift
//  PresentSwiftUI
//
//  Created by Ming Dai on 2021/11/11.
//

import SwiftUI
import SMGitHub

struct ReadmeView: View {
    @Environment(\.colorScheme) private var colorScheme
    var content: String
    var body: some View {
        ScrollView {
            MarkdownView(s: content.base64Decoded() ?? "failed")
                .padding(10)
        }
        .background(colorScheme == .light ? Color.white : Color.black)
    }
}

struct IssuesView: View {
    var issues: [IssueModel]
    var repo: RepoModel
    var body: some View {
        List {
            ForEach(issues) { issue in
                IssueLabelView(issue: issue)
            } // end ForEach
        } // end List
    } // end body
}

struct IssueEventsView: View {
    var issueEvents: [IssueEventModel]
    var repo: RepoModel
    var body: some View {
        List {
            ForEach(issueEvents) { issueEvent in
                IssueEventLabelView(issueEvent: issueEvent)
            } //  end ForEach
        } // end List
    } // end body
}

struct RepoCommitsView: View {
    var commits: [CommitModel]
    var repo: RepoModel
    var unReadCount = 0
    var body: some View {
        List {
            ForEach(Array(commits.enumerated()), id: \.0) { i, commit in
                RepoCommitLabelView(repo: repo, commit: commit, isUnRead: unReadCount > 0 && i < unReadCount)
            } // end ForEach
        } // end List
    } // end body
}

// MARK: - 碎视图
struct RepoCommitLabelView: View {
    var repo: RepoModel
    var commit: CommitModel
    var isUnRead = false
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            GitHubApiTimeView(timeStr: commit.commit.author.date)
            HStack {
                if isUnRead {
                    Image(systemName: "envelope.badge.fill")
                }
                if commit.author != nil {
                    NukeImage(width: 20, height: 20, url: commit.author?.avatarUrl ?? "")
                    ButtonGoGitHubWeb(url: commit.author?.login ?? "", text: commit.author?.login ?? "", ignoreHost: true, bold: true)

                } else {
                    Text(commit.commit.author.name ?? "")
                }
                ButtonGoGitHubWeb(url: "https://github.com/\(repo.fullName)/commit/\(commit.sha ?? "")", text: "commit")
            } // end HStack
            MarkdownView(s: commit.commit.message ?? "")
        } // end VStack
    }
}

struct IssueLabelView: View {
    var issue: IssueModel
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            GitHubApiTimeView(timeStr: issue.updatedAt)
            HStack {
                Text(issue.title)
                    .font(.title2)
                Text("\(issue.comments) 回复")
                    .foregroundColor(.secondary)
                    .font(.footnote)
            }
            HStack {
                NukeImage(width: 20, height: 20, url: issue.user.avatarUrl)
                ButtonGoGitHubWeb(url: issue.user.login, text: issue.user.login, ignoreHost: true)
            }
            MarkdownView(s: issue.body ?? "")
        } // end VStack
    }
}

struct IssueEventLabelView: View {
    var issueEvent: IssueEventModel
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            GitHubApiTimeView(timeStr: issueEvent.createdAt)
            HStack {
                NukeImage(width: 20, height: 20, url: issueEvent.actor.avatarUrl)
                ButtonGoGitHubWeb(url: issueEvent.actor.login, text: issueEvent.actor.login, ignoreHost: true)
                Text(issueEvent.event)
                    .foregroundColor(.secondary)
            }
            HStack {
                Text(issueEvent.issue.title)
                    .font(.title2)
                Text("\(issueEvent.issue.comments) 回复")
                    .foregroundColor(.secondary)
                    .font(.footnote)
            }
            HStack {
                NukeImage(width: 20, height: 20, url: issueEvent.issue.user.avatarUrl)
                ButtonGoGitHubWeb(url: issueEvent.issue.user.login, text: issueEvent.issue.user.login, ignoreHost: true)
            }
            MarkdownView(s: issueEvent.issue.body ?? "")
        } // end VStack
    }
}

```

### Core Architecture Module: `SwiftPamphletApp/GitHubAPIUI/DetailView/UserView.swift`
```
//
//  UserView.swift
//  PresentSwiftUI
//
//  Created by Ming Dai on 2021/11/10.
//

import SwiftUI
import SMGitHub

struct UserEventView: View {
    var events: [EventModel]
    var isShowActor = false
    var isShowUserEventLink = true
    var unReadCount = 0
    var body: some View {
        List {
            ForEach(Array(events.enumerated()), id: \.0) { i, event in

                AUserEventLabel(event: event, isShowActor: isShowActor, isUnRead: unReadCount > 0 && i < unReadCount)
                Divider()
            } // end ForEach
        }//  end List
        .id(UUID()) // 优化 commits 有多个时数据变化可能影响的性能。这样做每次更新都产生新的视图，因此无法做动画效果。相当于 UITableView 上的 reloadData()
    } // end body
} // end struct

// MARK: - 碎视图

struct ListCommits: View {
    var event: EventModel
    var body: some View {
        ForEach(event.payload.commits ?? [PayloadCommitModel](), id: \.self) { c in
            ButtonGoGitHubWeb(url: "https://github.com/\(event.repo.name)/commit/\(c.sha ?? "")", text: "提交")
            MarkdownView(s: c.message ?? "")
        }
    }
}

struct AUserEventLabel: View {
    var event: EventModel
    var isShowActor: Bool = false
    var isUnRead = false
    var body: some View {
        VStack(alignment: .leading) {
            GitHubApiTimeView(timeStr: event.createdAt)
            HStack {
                if isUnRead {
                    Image(systemName: "envelope.badge.fill")
                }
                Group {
                    Text(event.type)
                        .bold()
                    Text(event.payload.action ?? "")
                }
                .foregroundColor(.secondary)
                .font(.footnote)
            }
            ButtonGoGitHubWeb(url: "https://github.com/\(event.repo.name)", text: event.repo.name, bold: true)
            HStack {
                if event.payload.issue?.number != nil {
                    ButtonGoGitHubWeb(url: "https://github.com/\(event.repo.name)/issues/\(String(describing: event.payload.issue?.number ?? 0))", text: "议题")
                }

                if isShowActor == true {
                    NukeImage(width: 20, height: 20, url: event.actor.avatarUrl)
                    Text(event.actor.login).bold()

                } // end if

            }
            .padding(EdgeInsets(top: 0, leading: 0, bottom: 5, trailing: 0))

            if event.payload.issue?.number != nil {
                if event.payload.issue?.title != nil {
                    Text(event.payload.issue?.title ?? "")
                        .font(.system(.title2))
                }
                if event.payload.issue?.body != nil && event.type != "IssueCommentEvent" {
                    MarkdownView(s: event.payload.issue?.body ?? "")
                }
                if event.type == "IssueCommentEvent" && event.payload.comment?.body != nil {
                    MarkdownView(s: event.payload.comment?.body ?? "")
                }
            }

            if event.payload.commits != nil {
                ListCommits(event: event)
            }

            if event.payload.pullRequest != nil {
                if event.payload.pullRequest?.title != nil {
                    Text(event.payload.pullRequest?.title ?? "")
                        .font(.system(.title2))
                }
                if event.payload.pullRequest?.body != nil {
                    MarkdownView(s: event.payload.pullRequest?.body ?? "")
                }
            }

            if event.payload.description != nil {
                MarkdownView(s: event.payload.description ?? "")
            }
        } // end VStack
    }
}

```

### Core Architecture Module: `SwiftPamphletApp/GitHubAPIUI/Developer/DeveloperListView.swift`
```
//
//  DeveloperListView.swift
//  SwiftPamphletApp
//
//  Created by Ming on 2024/3/20.
//

import SwiftUI
import SwiftData
import SMDate
import SMGitHub

struct DeveloperListView: View {
    @Environment(\.modelContext) var modelContext
    @Binding var selectDev: DeveloperModel?
    @Query(DeveloperModel.all) var devs: [DeveloperModel]
    // 测试无数据用
//    @Query(filter: #Predicate<DeveloperModel> { dev in
//        dev.name.starts(with: "apple")
//    }) var devs: [DeveloperModel]
    
    var body: some View {
        List(selection: $selectDev) {
            ForEach(devs) { dev in
                HStack {
                    NukeImage(width: 40, height: 40, url: dev.avatar)
                    VStack {
                        HStack {
                            if dev.repoName.isEmpty {
                                Text(dev.name)
                                
                            } else {
                                VStack(alignment:.leading) {
                                    Text(dev.repoOwner)
                                        .font(.footnote)
                                        .foregroundColor(.secondary)
                                    Text(dev.repoName)
                                }
                            }
                            
                            Spacer()
                            Text(SMDate.howLongAgo(date: dev.updateDate))
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                        HStack {
                            Text(dev.des)
                                .font(.footnote)
                                .foregroundColor(.secondary)
                            Spacer()
                        }
                        Spacer()
                    }
                }
                .listRowSeparator(.hidden, edges: .all)
                .tag(dev)
                .swipeActions {
                    Button(role: .destructive) {
                        DeveloperModel.delete(dev)
                    } label: {
                        Label("删除", systemImage: "trash")
                    }
                }
                .contextMenu {
                    Button("删除") {
                        DeveloperModel.delete(dev)
                    }
                }
            }
        }
        .listStyle(.inset)
        .toolbar(content: {
            ToolbarItem(placement: .navigation) {
                Button("添加开发者", systemImage: "plus", action: addDev)
                    .keyboardShortcut(KeyEquivalent("a"), modifiers: .option)
            }
        })
        .overlay {
            if devs.isEmpty {
                ContentUnavailableView {
                    Label("无数据", systemImage: "person.fill.questionmark")
                } description: {
                    Text("点击下方按钮添加开发者或仓库")
                } actions: {
                    Button("新增") {
                        addDev()
                    }
                }
            }
        }
    }
    
    func addDev() {
        let dev = DeveloperModel(name: "", des: "", avatar: "", repoOwner: "", repoName: "", createDate: Date.now, updateDate: Date.now)
        modelContext.insert(dev)
        selectDev = dev
    }
    
}


```

### Core Architecture Module: `SwiftPamphletApp/GitHubAPIUI/Developer/EditDeveloper.swift`
```
//
//  EditDeveloper.swift
//  SwiftPamphletApp
//
//  Created by Ming on 2024/3/20.
//

import SwiftUI
import SwiftData
@preconcurrency import SMGitHub

struct EditDeveloper: View {
    @Bindable var dev: DeveloperModel
    @State private var tabSelct = 1
    @State private var tabSelctRepo = 1
    
    @State var repoVM: APIRepoVM
    @State var userVM: APIUserVM
    
    @State var needSetGithubAccessToken = false
    
    var body: some View {
        Form {
            HStack {
                TextField("用户名:", text: $dev.name, prompt: Text("输入 Github 用户名 dev 或仓库名 dev/repo"))
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onChange(of: dev.name) { oldValue, newValue in
                        updateReq()
                    }
                TextField("描述:", text: $dev.des)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
        }
        .padding(EdgeInsets(top: 10, leading: 10, bottom: 0, trailing: 10))
        .sheet(isPresented: $needSetGithubAccessToken) {
            VStack {
                GithubAccessTokenView() 
                Button {
                    updateReq()
                    needSetGithubAccessToken = false
                } label: {
                    Text("完成")
                }
            }
            .padding(20)

        }
        
        if dev.name.components(separatedBy: "/").count > 1 {
            repoEventView()
        } else {
            devEventView()
        }
    }
    
    func updateReq() {
        let dn =  dev.name.components(separatedBy: "/")
        if dn.count > 1 {
            repoVM = APIRepoVM(name: dev.name)
            Task {
                await repoVM.updateAllData()
            }
            
            dev.repoName = dn.last ?? ""
            dev.repoOwner = dn.first ?? ""
        } else {
            userVM = APIUserVM(name: dev.name)
            Task {
                await userVM.updateAllData()
            }
            
            dev.repoName = ""
            dev.repoOwner = ""
        }
    }
    
    @ViewBuilder
    func repoEventView() -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(repoVM.repo.name).font(.system(.largeTitle))
                    Text("(\(repoVM.repo.fullName))")
                }
                HStack {
                    Image(systemName: "star.fill").foregroundColor(.red)
                    Text("\(repoVM.repo.stargazersCount)")
                    Image(systemName: "tuningfork").foregroundColor(.cyan)
                    Text("\(repoVM.repo.forks)")
                    Text("议题 \(repoVM.repo.openIssues)")
                    Text("语言 \(repoVM.repo.language ?? "")")
                    ButtonGoGitHubWeb(url: repoVM.repo.htmlUrl ?? "https://github.com", text: "在 GitHub 上访问")

                }
                if repoVM.repo.description != nil {
                    Text("简介：\(repoVM.repo.description ?? "")")
                }
                
                HStack {
                    Text("作者：")
                    NukeImage(width:40, height: 40, url: repoVM.repo.owner.avatarUrl)
                    ButtonGoGitHubWeb(url: repoVM.repo.owner.login, text: repoVM.repo.owner.login, ignoreHost: true)
                }
            } // end VStack
            Spacer()
        }
        .onChange(of: repoVM.repo, { oldValue, newValue in
            if !newValue.owner.avatarUrl.isEmpty {
                dev.avatar = newValue.owner.avatarUrl
            }
        })
        .onChange(of: repoVM.commits, { oldValue, newValue in
            if ((newValue.first?.commit.author.date.isEmpty) != nil) {
                let iso8601String = newValue.first?.commit.author.date ?? ""
                let formatter = ISO8601DateFormatter()
                dev.updateDate = formatter.date(from: iso8601String) ?? Date.now
            }
        })
        .padding(EdgeInsets(top: 0, leading: 10, bottom: 0, trailing: 10))
        .onAppear {
            Task {
                await repoVM.updateAllData()
            }
        }
        // end HStack

        Form {
            Section {
                TabView(selection: $tabSelct) {
                    RepoCommitsView(commits: repoVM.commits, repo: repoVM.repo)
                        .tabItem {
                            Text("新提交")
                        }
                        .tag(1)

                    IssuesView(issues: repoVM.issues, repo: repoVM.repo)
                        .tabItem {
                            Text("议题列表")
                        }
                        .tag(2)

                    IssueEventsView(issueEvents: repoVM.issuesEvents, repo: repoVM.repo)
                        .tabItem {
                            Text("议题事件")
                        }
                        .tag(3)

                    ReadmeView(content: repoVM.readme.content.replacingOccurrences(of: "\n", with: ""))
                        .tabItem {
                            Text("README")
                        }
                        .tag(4)

                } // end TabView
            }
        }
        Spacer()
    }
    
    @ViewBuilder
    func devEventView() -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    NukeImage(width:60, height: 60, url: userVM.user.avatarUrl)
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(userVM.user.name ?? userVM.user.login).font(.system(.title))
                            if !userVM.user.login.isEmpty {
                                Text("(\(userVM.user.login))")
                            }
                            Text("订阅者 \(userVM.user.followers) 人，仓库 \(userVM.user.publicRepos) 个")
                        }
                        HStack {
                            ButtonGoGitHubWeb(url: userVM.user.htmlUrl, text: "在 GitHub 上访问")
                            if userVM.user.location != nil {
                                Text("居住：\(userVM.user.location ?? "")").font(.system(.subheadline))
                            }
                        }
                    } // end VStack
                } // end HStack

                if userVM.user.bio != nil {
                    Text("简介：\(userVM.user.bio ?? "")")
                }
                HStack {
                    if userVM.user.blog != nil {
                        if !userVM.user.blog!.isEmpty {
                            Text("博客：\(userVM.user.blog ?? "")")
                            ButtonGoGitHubWeb(url: userVM.user.blog ?? "", text: "访问")
                        }
                    }
                    if userVM.user.twitterUsername != nil {
                        Text("Twitter：")
                        ButtonGoGitHubWeb(url: "https://twitter.com/\(userVM.user.twitterUsername ?? "")", text: "@\(userVM.user.twitterUsername ?? "")")
                    }
                } // end HStack
            } // end VStack
            Spacer()
        }
        .padding(EdgeInsets(top: 0, leading: 10, bottom: 0, trailing: 10))
        .onAppear {
            Task {
                await userVM.updateAllData()
            }
        }
        .onChange(of: userVM.events, { oldValue, newValue in
            if ((newValue.first?.createdAt.isEmpty) != nil) {
                let iso8601String = newValue.first?.createdAt ?? ""
                let formatter = ISO8601DateFormatter()
                dev.updateDate = formatter.date(from: iso8601String) ?? Date.now
            }
        })
        .onChange(of: userVM.user, { oldValue, newValue in
            if !newValue.avatarUrl.isEmpty {
                dev.avatar = userVM.user.avatarUrl
            }
        })
        
        Form {
            Section {
                TabView(selection: $tabSelct) {
                    DeveloperEventView(events: userVM.events)
                        .tabItem {
                            Image(systemName: "keyboard")
                            Text("事件")
                        }
                        .tag(1)
                    
                    DeveloperEventView(events: userVM.receivedEvents)
                        .tabItem {
                            Image(systemName: "keyboard.badge.ellipsis")
                            Text("Ta 接收的事件")
                        }
                        .tag(2)
                }
            }
        }
        Spacer()
    }
}

struct DeveloperEventView: View {
    var events: [EventModel]
    var body: some View {
        List {
            ForEach(Array(events.enumerated()), id: \.0) { i, event in
                AUserEventLabel(
                    event: event,
                    isShowActor: false,
                    isUnRead: false
                )
            } // end ForEach
        }//  end List
        .id(UUID()) // 优化 commits 有多个时数据变化可能影响的性能。这样做每次更新都产生新的视图，因此无法做动画效果。相当于 UITableView 上的 reloadData()
    } // end body
} // end struct



```

### Core Architecture Module: `SwiftPamphletApp/Guide/Bookmark/Data/BookmarkModel.swift`
```
//
//  BookmarkModel.swift
//  SwiftPamphletApp
//
//  Created by Ming Dai on 2024/5/9.
//

import Foundation
import SwiftData

@Model
final class BookmarkModel {
    var name: String = ""
    var icon: String = ""
    var pamphletName: String = ""
    var tags: [BookmarkTagModel] = [BookmarkTagModel]()
    var type: Int = 0 // 0: 书签，1：标签
    var createDate: Date = Date.now
    var updateDate: Date = Date.now
    
    init(pamphletName: String = "", name: String = "", createDate: Date = Date.now, updateDate: Date = Date.now) {
        self.pamphletName = pamphletName
        self.name = name
        self.createDate = createDate
        self.updateDate = updateDate
    }
    
    static var all: FetchDescriptor<BookmarkModel> {
        let fd = FetchDescriptor(sortBy: [SortDescriptor(\BookmarkModel.updateDate, order: .reverse)])
        return fd
    }
    
    static func hasBM(_ name: String, plName: String, context: ModelContext) -> BookmarkModel? {
        
        let fd = FetchDescriptor<BookmarkModel>(predicate: #Predicate { bm in
            bm.name == name 
            && bm.pamphletName == plName
        }, sortBy: [SortDescriptor(\.updateDate, order: .reverse)])
        if let okBM = try? context.fetch(fd) {
            if okBM.count > 0 {
                return okBM.first
            } else {
                return nil
            }
        }
        return nil
    }
    
    static func addBM(_ name: String, icon: String, plName: String, type: Int, context: ModelContext) {
        if BookmarkModel.hasBM(name, plName: plName, context: context) == nil {
            let newBM = BookmarkModel(pamphletName: plName, name: name)
            newBM.icon = icon
            newBM.type = type
            context.insert(newBM)
        }
    }
    
    static func delBM(_ name: String, plName: String, context: ModelContext) {
        if let bm = BookmarkModel.hasBM(name, plName: plName, context: context) {
            context.delete(bm)
        }
    }
    
    static func delBM(_ bm: BookmarkModel) {
        if let context = bm.modelContext {
            context.delete(bm)
        }
    }
}

@Model
final class BookmarkTagModel {
    var name: String = ""
    var createDate: Date = Date.now
    var updateDate: Date = Date.now
    
    init(name: String = "", createDate: Date = Date.now, updateDate: Date = Date.now) {
        self.name = name
        self.createDate = createDate
        self.updateDate = updateDate
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #208** (2025-05-11): **新人问个初级问题。**
  *Symptoms*: 经过一系列改动，目前项目还剩这个问题："SwiftPamphletApp" requires a provisioning profile with the WeatherKit feature. 我想问下，我还没付费成为开发者，连运行项目的资格都没有是么？ 
  **Post-Mortem & Fix Analysis**:
  > 删掉weatherkit的配置试下

- **Issue #205** (2024-08-12): **Hello world**
  *Symptoms*: 

- **Issue #203** (2024-09-18): **多个操作异常卡顿。**
  *Symptoms*: 系统：macOS 15Beta 软件版本：App Store最新版。 卡顿操作： - Apple技术页下某篇具体文章，滚动查看内容。 - 整个窗口拖动边框放大缩小窗口。 - 除了刚打开APP时，其它时候的切换文章。 
  **Post-Mortem & Fix Analysis**:
  > App Store 版本已更新，做了些兼容适配，优化了文章读取过程。

- **Issue #201** (2024-06-01): **Update workflow action**
  *Symptoms*: 针对当前 action workflow 里使用 action 版本过低（主要是action所指定依赖的 node 版本过低）导致的 action 流程结果告警进行了 action 版本升级/更换，使其适配 GitHub action 当前默认的最新的 node20 环境

- **Issue #200** (2024-05-19): **build(build.yml): 指定 Github Action  Workflow 打包时使用最新稳定版的 xcode**
  *Symptoms*: 不指定的话，使用 Github Action 的自动云打包功能会始终失败，详见 #199 

- **Issue #199** (2024-05-16): **Github Action build fail**
  *Symptoms*: 作者好，我想通过 [编译方式](https://github.com/ming1016/SwiftPamphletApp/issues/115) 里的云编译 —— Github Action workflow 方式进行打包编译，但是每次不管是主动 run action 还是通过 pull 项目来触发，action 执行都是失败的。以下是失败的日志：  <img width="1394" alt="image" src="https://github.com/ming1016/SwiftPamphletApp/assets/8021137/dd8630ee-67b8-44e1-bcaf-90a20d4d8017">  想知道是不是某个包的版本需要升级了？
  **Post-Mortem & Fix Analysis**:
  > Xcode升级到最新版本
  > > Xcode升级到最新版本  @lbioser 成了！感谢感谢

- **Issue #198** (2023-06-13): **PR#195在最近的一次Fix中被移除了**
  *Symptoms*: 

- **Issue #197** (2024-05-26): **同步一个自己做的纯swift的Github + Rss订阅的App。（目前已经将所有的mac端的小册子内容同步到了iPhone上）**
  *Symptoms*: https://github.com/dyljqq/DJGithub
  **Post-Mortem & Fix Analysis**:
  > 目前已经将戴老师的小册子中的内容给移动到了自己的[DJGithub](https://github.com/dyljqq/DJGithub)中去。即可以不用依赖mac去查看相应的内容了。这样就可以通过手机管理一些碎片化的时间。  相对于mac版， iPhone版有如下优势： 1. 对于git repo的内容，因为天朝网络原因，如果直接通过小册子去打开github web repo的话，那么其实响应的不会很及时，那么通过接口调用，然后自己做展示内容的话，会更加合适一些。（因为之前自己已经做过了，所以其实对于issue的内容，还是repo的展示，都是可以直接调用） 2. 通过手机的话，可以更好的利用一些碎片时间吧。 3. 当然你也可以通过这个App去做很多事情，比如你可以提issue，修改issue，删除issue，create merge request，merge，and so on。  当然也会有一定的劣势： 资源同步不及时，比如说戴老师这边做了改版，修改了资源内容，我这边需要做发版，修改资源文件。其实比较好的方式，是通过服务器下发，但是目前暂时还不支持吧。 目前可以有以下的替代方案， 1. 你可以直接通过在DJGithub中搜索小册子中的repo库，去查看更新的内容。 2. 你当然也可以fork后，自己做维护。

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

### Incident Patch 1: `d941263f` (2025-05-11)
**Commit Message**: fix #208

**File**: `SwiftPamphletApp.xcodeproj/project.pbxproj` (modified, +19/-3)
```diff
@@ -156,6 +156,7 @@
 		08523E492DA2F4D500AA1B78 /* QEMU-实现基础框架(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08523E482DA2F4D500AA1B78 /* QEMU-实现基础框架(cs).md */; };
 		08523E4B2DA2F4E400AA1B78 /* QEMU-实现核心功能(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08523E4A2DA2F4E400AA1B78 /* QEMU-实现核心功能(cs).md */; };
 		08523E4D2DA2F4F300AA1B78 /* QEMU-扩展与完善(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08523E4C2DA2F4F300AA1B78 /* QEMU-扩展与完善(cs).md */; };
+		08555F5B2DCB964A002E731B /* 克拉克森的农场(kg).md in Resources */ = {isa = PBXBuildFile; fileRef = 08555F5A2DCB964A002E731B /* 克拉克森的农场(kg).md */; };
 		085E1A562CF60CBA009938E8 /* 人工智能-RAG(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 085E1A552CF60CBA009938E8 /* 人工智能-RAG(ap).md */; };
 		0868D00B2BDD37280023C871 /* SMGitHub in Frameworks */ = {isa = PBXBuildFile; productRef = 0868D00A2BDD37280023C871 /* SMGitHub */; };
 		086A5F072744E88E00FECE02 /* SwiftPamphletAppApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 086A5F062744E88E00FECE02 /* SwiftPamphletAppApp.swift */; };
@@ -547,6 +548,7 @@
 		08B2CD212DB63D33005CA3BA /* 网络-序列化(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B2CD202DB63D33005CA3BA /* 网络-序列化(cs).md */; };
 		08B2CD232DB63D42005CA3BA /* 网络-Streaming(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B2CD222DB63D42005CA3BA /* 网络-Streaming(cs).md */; };
 		08B2CD252DB63D52005CA3BA /* 网络-缓存(cs).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B2CD242DB63D52005CA3BA /* 网络-缓存(cs).md */; };
+		08B897972DD0D578007030C1 /* 宝可梦(kg).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B897962DD0D578007030C1 /* 宝可梦(kg).md */; };
 		08B9A1452D9376D400E8A959 /* 公元前1046年西周建立(kg).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B9A1442D9376D400E8A959 /* 公元前1046年西周建立(kg).md */; };
 		08B9A1472D9376E100E8A959 /* 公元前985年周昭王攻荆楚之战(kg).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B9A1462D9376E100E8A959 /* 公元前985年周昭王攻荆楚之战(kg).md */; };
 		08B9A1492D9376F100E8A959 /* 公元前976年周穆王西行(kg).md in Resources */ = {isa = PBXBuildFile; fileRef = 08B9A1482D9376F100E8A959 /* 公元前976年周穆王西行(kg).md */; };
@@ -1060,6 +1062,7 @@
 		08523E482DA2F4D500AA1B78 /* QEMU-实现基础框架(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "QEMU-实现基础框架(cs).md"; sourceTree = "<group>"; };
 		08523E4A2DA2F4E400AA1B78 /* QEMU-实现核心功能(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "QEMU-实现核心功能(cs).md"; sourceTree = "<group>"; };
 		08523E4C2DA2F4F300AA1B78 /* QEMU-扩展与完善(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "QEMU-扩展与完善(cs).md"; sourceTree = "<group>"; };
+		08555F5A2DCB964A002E731B /* 克拉克森的农场(kg).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "克拉克森的农场(kg).md"; sourceTree = "<group>"; };
 		085E1A552CF60CBA009938E8 /* 人工智能-RAG(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "人工智能-RAG(ap).md"; sourceTree = "<group>"; };
 		0869233F2BF2BF81006779A3 /* AVKit.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = AVKit.framework; path = System/Library/Frameworks/AVKit.framework; sourceTree = SDKROOT; };
 		086A5F032744E88E00FECE02 /* 戴铭的小册子.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "戴铭的小册子.app"; sourceTree = BUILT_PRODUCTS_DIR; };
@@ -1453,6 +1456,7 @@
 		08B2CD202DB63D33005CA3BA /* 网络-序列化(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "网络-序列化(cs).md"; sourceTree = "<group>"; };
 		08B2CD222DB63D42005CA3BA /* 网络-Streaming(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "网络-Streaming(cs).md"; sourceTree = "<group>"; };
 		08B2CD242DB63D52005CA3BA /* 网络-缓存(cs).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "网络-缓存(cs).md"; sourceTree = "<group>"; };
+		08B897962DD0D578007030C1 /* 宝可梦(kg).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "宝可梦(kg).md"; sourceTree = "<group>"; };
 		08B9A1442D9376D400E8A959 /* 公元前1046年西周建立(kg).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "公元前1046年西周建立(kg).md"; sourceTree = "<group>"; };
 		08B9A1462D9376E100E8A959 /* 公元前985年周昭王攻荆楚之战(kg).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "公元前985年周昭王攻荆楚之战(kg).md"; sourceTree = "<group>"; };
 		08B9A1482D9376F100E8A959 /* 公元前976年周穆王西行(kg).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "公元前976年周穆王西行(kg).md"; sourceTree = "<group>"; };
@@ -2346,6 +2350,7 @@
 			isa = PBXGroup;
 			children = (
 				0872429D2DBBECC4005BAD35 /* 孤独的美食家(kg).md */,
+				08555F5A2DCB964A002E731B /* 克拉克森的农场(kg).md */,
 			);
 			path = "影视作品";
 			sourceTree = "<group>";
@@ -2902,6 +2907,1
```

**File**: `SwiftPamphletApp/Guide/View/GuideOutline/KnowledgeGuide.swift` (modified, +6/-2)
```diff
@@ -30,10 +30,14 @@ struct KnowledgeGuide {
             ])
         ]),
         L(t: "影视作品", sub: [
-            L(t: "孤独的美食家", type: 1)
+            L(t: "孤独的美食家", type: 1),
+            L(t: "克拉克森的农场", type: 1)
+        ]),
+        L(t: "游戏", sub: [
+            L(t: "宝可梦", type: 1)
         ]),
         L(t: "历史", sub: [
-            L(t: "时间轴",sub: [
+            L(t: "中国时间轴",sub: [
                 L(t: "西周", sub: [
                     L(t: "公元前1046年西周建立", type: 1),
                     L(t: "公元前985年周昭王攻荆楚之战", type: 1),
```

**File**: `SwiftPamphletApp/SwiftPamphletApp.entitlements` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>com.apple.developer.weatherkit</key>
-	<true/>
 	<key>com.apple.security.app-sandbox</key>
 	<true/>
 	<key>com.apple.security.files.user-selected.read-only</key>
```

**File**: `SwiftPamphletApp/SwiftPamphletAppDebug.entitlements` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>com.apple.developer.weatherkit</key>
-	<true/>
 	<key>com.apple.security.app-sandbox</key>
 	<true/>
 	<key>com.apple.security.files.downloads.read-write</key>
```

---

### Incident Patch 2: `eebaa94d` (2025-04-15)
**Commit Message**: Update AppleGuide.swift

**File**: `SwiftPamphletApp/Guide/View/GuideOutline/AppleGuide.swift` (modified, +8/-8)
```diff
@@ -484,7 +484,7 @@ struct AppleGuide {
             L(t: "跨平台", sub: [
                 L(t: "跨平台-Swift", type: 1),
                 L(t: "跨平台-布局渲染", type: 1),
-                L(t: "跨平台-大厂自研"),
+                L(t: "跨平台-大厂自研", type: 1),
                 L(t: "跨平台-React Native", type: 1),
             ]),
             L(t: "编辑器", sub: [
@@ -493,13 +493,13 @@ struct AppleGuide {
                 L(t: "VSCode", type: 1),
             ]),
             L(t: "Bazel", sub: [
-                L(t: "Bazel-介绍", type: 1),
-                L(t: "Bazel-生成Xcode工程", type: 1),
-                L(t: "Bazel-依赖分析", type: 1),
-                L(t: "Bazel-query指令找依赖关系", type: 1),
-                L(t: "Bazel-远程执行配置", type: 1),
-                L(t: "Bazel-远程缓存配置", type: 1),
-                L(t: "Bazel-自定义的构建规则", type: 1),
+                L(t: "Bazel-介绍"),
+                L(t: "Bazel-生成Xcode工程"),
+                L(t: "Bazel-依赖分析"),
+                L(t: "Bazel-query指令找依赖关系"),
+                L(t: "Bazel-远程执行配置"),
+                L(t: "Bazel-远程缓存配置"),
+                L(t: "Bazel-自定义的构建规则"),
             ]),
             L(t: "自动化构建流程", type: 1),
             L(t: "单例", type: 1),
```

---

### Incident Patch 3: `4545d362` (2024-11-18)
**Commit Message**: fix 兼容问题

**File**: `SwiftPamphletApp/App/SwiftPamphletAppApp.swift` (modified, +4/-3)
```diff
@@ -17,7 +17,7 @@ import AppIntents
 
 @main
 struct SwiftPamphletAppApp: App {
-    @State private var metricsManager = MetricsManager()
+    
     // 启动时间打点
     private let launchStartTime = DispatchTime.now()
     private let signpostID = OSSignpostID(log: OSLog.default)
@@ -26,6 +26,7 @@ struct SwiftPamphletAppApp: App {
     #if os(macOS)
     @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
     #elseif os(iOS)
+    @State private var metricsManager = MetricsManager()
     @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
     #endif
     
@@ -70,8 +71,8 @@ struct SwiftPamphletAppApp: App {
                     }
                     
                     // 任务示例
-                    TaskCase.bad()
-//                    TaskCase.good()
+//                    TaskCase.bad()
+                    TaskCase.good()
                     
                     // 任务管理器示例
 //                    taskgroupDemo()
```

**File**: `SwiftPamphletApp/Guide/View/GuideListView.swift` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ struct GuideListView: View {
     @State var listModel = GuideListModel()
     @State private var limit: Int = 50
     @State private var trigger = false // 触发列表书签状态更新
+    
     var body: some View {
         if listModel.searchText.isEmpty == false {
             HStack {
```

**File**: `SwiftPamphletApp/Performance/MetricManager.swift` (modified, +2/-0)
```diff
@@ -5,6 +5,7 @@
 //  Created by Ming on 2024/11/11.
 //
 
+#if os(iOS)
 import MetricKit
 import Observation
 
@@ -48,3 +49,4 @@ extension MetricsManager {
         }.value
     }
 }
+#endif
```

---

### Incident Patch 4: `4846c684` (2024-09-24)
**Commit Message**: Update GuideListView.swift

**File**: `SwiftPamphletApp/Guide/View/GuideListView.swift` (modified, +37/-39)
```diff
@@ -27,49 +27,47 @@ struct GuideListView: View {
             }
             .padding(.top, 10)
         }
-        NavigationStack {
-            SPOutlineListView(d: listModel.filtered(), c: \.sub) { i in
-                NavigationLink(destination: GuideDetailView(t: i.t, icon: i.icon, plName: "ap", limit: $limit, trigger: $trigger)) {
-                    HStack(spacing:3) {
-                        if i.icon.isEmpty == false {
-                            Image(systemName: i.icon)
-                                .foregroundStyle(i.sub == nil ? Color.secondary : .indigo)
-                        } else if i.sub != nil {
-                            Image(systemName: "folder.fill")
-                                .foregroundStyle(.indigo)
-                        }
-                        Text(listModel.searchText.isEmpty == true ? GuideListModel.simpleTitle(i.t) : i.t)
-                        Spacer()
-                        if apBookmarks.contains(i.t) {
-                            Image(systemName: "bookmark")
-                                .foregroundStyle(.secondary)
-                                .font(.footnote)
-                        }
+        SPOutlineListView(d: listModel.filtered(), c: \.sub) { i in
+            NavigationLink(destination: GuideDetailView(t: i.t, icon: i.icon, plName: "ap", limit: $limit, trigger: $trigger)) {
+                HStack(spacing:3) {
+                    if i.icon.isEmpty == false {
+                        Image(systemName: i.icon)
+                            .foregroundStyle(i.sub == nil ? Color.secondary : .indigo)
+                    } else if i.sub != nil {
+                        Image(systemName: "folder.fill")
+                            .foregroundStyle(.indigo)
                     }
-                    .contentShape(Rectangle())
-                }
-            }
-            .searchable(text: $listModel.searchText, prompt: "搜索 Apple 技术手册")
-            .listStyle(.sidebar)
-            .onChange(of: trigger, { oldValue, newValue in
-                updateApBookmarks()
-            })
-            .onAppear(perform: {
-                updateApBookmarks()
-                //导出内容
-    //            listModel.buildMDContent()
-                
-            })
-            .overlay {
-                if listModel.filtered().isEmpty {
-                    ContentUnavailableView {
-                        Label("无结果", systemImage: "rectangle.and.text.magnifyingglass")
-                    } description: {
-                        Text("请再次输入")
+                    Text(listModel.searchText.isEmpty == true ? GuideListModel.simpleTitle(i.t) : i.t)
+                    Spacer()
+                    if apBookmarks.contains(i.t) {
+                        Image(systemName: "bookmark")
+                            .foregroundStyle(.secondary)
+                            .font(.footnote)
                     }
                 }
-            } // end overlay
+                .contentShape(Rectangle())
+            }
         }
+        .searchable(text: $listModel.searchText, prompt: "搜索 Apple 技术手册")
+        .listStyle(.sidebar)
+        .onChange(of: trigger, { oldValue, newValue in
+            updateApBookmarks()
+        })
+        .onAppear(perform: {
+            updateApBookmarks()
+            //导出内容
+//            listModel.buildMDContent()
+            
+        })
+        .overlay {
+            if listModel.filtered().isEmpty {
+                ContentUnavailableView {
+                    Label("无结果", systemImage: "rectangle.and.text.magnifyingglass")
+                } description: {
+                    Text("请再次输入")
+                }
+            }
+        } // end overlay
     }
     
     func updateApBookmarks() {
```

---

### Incident Patch 5: `b62a6ada` (2024-09-18)
**Commit Message**: Update build.yml

**File**: `.github/workflows/build.yml` (modified, +0/-18)
```diff
@@ -13,21 +13,3 @@ jobs:
       - uses: actions/checkout@v2
       - name: submodules-init
         uses: snickerbockers/submodules-init@v4
-      - name: Import PAT from Actions secrets
-        run: |
-         cd SwiftPamphletApp/App
-         sed -i '' s/'gitHubAccessToken = ""'/'gitHubAccessToken = "${{ secrets.PAT }}"'/ SwiftPamphletAppConfig.swift
-         cd ..
-      - name: Build
-        run: |
-          if grep -q 'gitHubAccessToken = ""' ./SwiftPamphletApp/App/SwiftPamphletAppConfig.swift ; then
-            echo "please setup your personal access token to Actions secrets and name it to PAT" && exit
-          fi
-          chmod +x ./compile.command
-          /bin/bash -c ./compile.command
-          zip -r9 戴铭的开发小册子.zip 戴铭的开发小册子.app
-      - name: Upload App.zip
-        uses: actions/upload-artifact@v2.2.4
-        with:
-          name: "戴铭的开发小册子.zip"
-          path: "戴铭的开发小册子.zip"
\ No newline at end of file
```

---

### Incident Patch 6: `c7d16ae2` (2024-09-17)
**Commit Message**: Update GuideDetailView.swift

**File**: `SwiftPamphletApp/Guide/View/GuideDetailView.swift` (modified, +6/-2)
```diff
@@ -19,6 +19,7 @@ struct GuideDetailView: View {
     var t: String
     var icon: String
     var plName: String
+    @State var tContent: String
     @Binding var limit: Int
     @Binding var trigger: Bool
     
@@ -32,6 +33,7 @@ struct GuideDetailView: View {
         self.t = t
         self.icon = icon
         self.plName = plName
+        self.tContent = ""
         self._trigger = trigger
         var fd = FetchDescriptor<IOInfo>(predicate: #Predicate { info in
             info.relateName == t && info.isArchived == false
@@ -81,9 +83,8 @@ struct GuideDetailView: View {
                     }
                 }
                 .padding(EdgeInsets(top: 10, leading: 10, bottom: 2, trailing: 10))
-                MarkdownView(s: SMFile.loadBundleString("\(t)" + "(\(plName)).md"))
                 // 内容
-//                WebUIView(html: wrapperHtmlContent(content: MarkdownParser().html(from: "\(SMFile.loadBundleString("\(t)" + "(\(plName)).md"))")), baseURLStr: "")
+                WebUIView(html: wrapperHtmlContent(content: MarkdownParser().html(from: tContent)), baseURLStr: "")
             } else {
                 if let info = selectInfo {
                     EditInfoView(info: info)
@@ -132,13 +133,16 @@ struct GuideDetailView: View {
         }
         .onAppear {
             isShowInspector = asIsShowPamphletInspector
+            tContent = SMFile.loadBundleString("\(t)" + "(\(plName)).md")
         }
         .onChange(of: t) { oldValue, newValue in
             selectInfo = nil
+            tContent = SMFile.loadBundleString("\(t)" + "(\(plName)).md")
         }
         .onChange(of: isShowInspector) { oldValue, newValue in
             asIsShowPamphletInspector = newValue
         }
+
     }
     
     func checkBookmarkState() {
```

---

### Incident Patch 7: `221ddad2` (2024-09-17)
**Commit Message**: fix new system bug

**File**: `SwiftPamphletApp/Guide/View/GuideDetailView.swift` (modified, +2/-1)
```diff
@@ -81,8 +81,9 @@ struct GuideDetailView: View {
                     }
                 }
                 .padding(EdgeInsets(top: 10, leading: 10, bottom: 2, trailing: 10))
+                MarkdownView(s: SMFile.loadBundleString("\(t)" + "(\(plName)).md"))
                 // 内容
-                WebUIView(html: wrapperHtmlContent(content: MarkdownParser().html(from: "\(SMFile.loadBundleString("\(t)" + "(\(plName)).md"))")), baseURLStr: "")
+//                WebUIView(html: wrapperHtmlContent(content: MarkdownParser().html(from: "\(SMFile.loadBundleString("\(t)" + "(\(plName)).md"))")), baseURLStr: "")
             } else {
                 if let info = selectInfo {
                     EditInfoView(info: info)
```

**File**: `SwiftPamphletApp/ViewComponet/ViewComponentMarkdown.swift` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ extension Theme {
     /// Bulleted list | ![](GitHubNestedBulletedList)
     /// Numbered list | ![](GitHubNumberedList)
     /// Table | ![](GitHubTable)
-    public static let gitHubCustom = Theme()
+    @MainActor public static let gitHubCustom = Theme()
         .text {
             ForegroundColor(.text)
             BackgroundColor(.background)
```

---

### Incident Patch 8: `1972f60e` (2024-09-14)
**Commit Message**: fix

**File**: `SwiftPamphletApp.xcodeproj/project.pbxproj` (modified, +52/-0)
```diff
@@ -414,6 +414,17 @@
 		08ED80162B9C54DE0069B7EC /* SMNetwork in Frameworks */ = {isa = PBXBuildFile; productRef = 08ED80152B9C54DE0069B7EC /* SMNetwork */; };
 		08ED801C2B9D1EEC0069B7EC /* SettingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 08ED801B2B9D1EEC0069B7EC /* SettingView.swift */; };
 		08EF35D22BECFDA80098E2D4 /* BookmarkModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 08EF35D12BECFDA80098E2D4 /* BookmarkModel.swift */; };
+		08F0F8AF2C95958E00DC659B /* 开源-精品项目(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8AE2C95958E00DC659B /* 开源-精品项目(ap).md */; };
+		08F0F8B12C95964400DC659B /* 开源-有趣的项目(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8B02C95964400DC659B /* 开源-有趣的项目(ap).md */; };
+		08F0F8B32C95969500DC659B /* 开源-天气(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8B22C95969500DC659B /* 开源-天气(ap).md */; };
+		08F0F8B52C9596B000DC659B /* 开源-学习(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8B42C9596B000DC659B /* 开源-学习(ap).md */; };
+		08F0F8B72C9596CC00DC659B /* 开源-生活(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8B62C9596CC00DC659B /* 开源-生活(ap).md */; };
+		08F0F8B92C95974E00DC659B /* 开源-理财(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8B82C95974E00DC659B /* 开源-理财(ap).md */; };
+		08F0F8BB2C95976E00DC659B /* 开源-阅读(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8BA2C95976E00DC659B /* 开源-阅读(ap).md */; };
+		08F0F8BD2C95978C00DC659B /* 开源-笔记(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8BC2C95978C00DC659B /* 开源-笔记(ap).md */; };
+		08F0F8BF2C95982C00DC659B /* 开源-动画(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8BE2C95982C00DC659B /* 开源-动画(ap).md */; };
+		08F0F8C12C959B0600DC659B /* 开源-时间(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8C02C959B0600DC659B /* 开源-时间(ap).md */; };
+		08F0F8C32C95B9F700DC659B /* 开源-macOS应用(ap).md in Resources */ = {isa = PBXBuildFile; fileRef = 08F0F8C22C95B9F700DC659B /* 开源-macOS应用(ap).md */; };
 		08F14B3C2BBDA3EA005B46CC /* Nuke in Frameworks */ = {isa = PBXBuildFile; productRef = 08F14B3B2BBDA3EA005B46CC /* Nuke */; };
 		08F14B3E2BBDA3EA005B46CC /* NukeExtensions in Frameworks */ = {isa = PBXBuildFile; productRef = 08F14B3D2BBDA3EA005B46CC /* NukeExtensions */; };
 		08F14B402BBDA3EA005B46CC /* NukeUI in Frameworks */ = {isa = PBXBuildFile; productRef = 08F14B3F2BBDA3EA005B46CC /* NukeUI */; };
@@ -838,6 +849,17 @@
 		08D8F00D2BF044FB00AA0020 /* WWDCDetailView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WWDCDetailView.swift; sourceTree = "<group>"; };
 		08ED801B2B9D1EEC0069B7EC /* SettingView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingView.swift; sourceTree = "<group>"; };
 		08EF35D12BECFDA80098E2D4 /* BookmarkModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BookmarkModel.swift; sourceTree = "<group>"; };
+		08F0F8AE2C95958E00DC659B /* 开源-精品项目(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-精品项目(ap).md"; sourceTree = "<group>"; };
+		08F0F8B02C95964400DC659B /* 开源-有趣的项目(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-有趣的项目(ap).md"; sourceTree = "<group>"; };
+		08F0F8B22C95969500DC659B /* 开源-天气(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-天气(ap).md"; sourceTree = "<group>"; };
+		08F0F8B42C9596B000DC659B /* 开源-学习(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-学习(ap).md"; sourceTree = "<group>"; };
+		08F0F8B62C9596CC00DC659B /* 开源-生活(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-生活(ap).md"; sourceTree = "<group>"; };
+		08F0F8B82C95974E00DC659B /* 开源-理财(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-理财(ap).md"; sourceTree = "<group>"; };
+		08F0F8BA2C95976E00DC659B /* 开源-阅读(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-阅读(ap).md"; sourceTree = "<group>"; };
+		08F0F8BC2C95978C00DC659B /* 开源-笔记(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-笔记(ap).md"; sourceTree = "<group>"; };
+		08F0F8BE2C95982C00DC659B /* 开源-动画(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-动画(ap).md"; sourceTree = "<group>"; };
+		08F0F8C02C959B0600DC659B /* 开源-时间(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-时间(ap).md"; sourceTree = "<group>"; };
+		08F0F8C22C95B9F700DC659B /* 开源-macOS应用(ap).md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = "开源-macOS应用(ap).md"; sourceTree = "<group>"; };
 		08F14B432BBE2865005B46CC /* ViewComponentImage.swift */ = {isa = PBXFileReference; lastKn
```

**File**: `SwiftPamphletApp/Guide/View/GuideListView.swift` (modified, +13/-0)
```diff
@@ -634,6 +634,19 @@ final class GuideListModel {
         L(t: "三方库使用", icon:"tray.2", sub: [
             L(t: "SQLite.swift的使用")
         ]),
+        L(t: "开源", icon:"globe.asia.australia", sub: [
+            L(t: "开源-精品项目"),
+            L(t: "开源-有趣的项目"),
+            L(t: "开源-天气"),
+            L(t: "开源-时间"),
+            L(t: "开源-学习"),
+            L(t: "开源-生活"),
+            L(t: "开源-理财"),
+            L(t: "开源-阅读"),
+            L(t: "开源-笔记"),
+            L(t: "开源-动画"),
+            L(t: "开源-macOS应用"),
+        ]),
         L(t: "知识管理", icon:"lightbulb.max", sub: [
             L(t: "知识管理-介绍"),
             L(t: "怎么用小册子APP做知识管理"),
```

**File**: `SwiftPamphletApp/InfoOrganizer/Info/EditInfoView.swift` (modified, +30/-23)
```diff
@@ -93,7 +93,8 @@ struct EditInfoView: View {
                 }
             }
             .onAppear(perform: {
-                _ = parseSearchTerms()
+                // 标签
+                searchTerms(arr: parseSearchTerms())
                 // AppStorage
                 if asInspectorType == 0 {
                     inspectorType = .category
@@ -107,7 +108,7 @@ struct EditInfoView: View {
                 }
             })
             .onChange(of: term) { oldValue, newValue in
-                _ = parseSearchTerms()
+                searchTerms(arr: parseSearchTerms())
             }
             .onChange(of: isShowInspector) { oldValue, newValue in
                 asIsShowInspector = newValue
@@ -119,6 +120,13 @@ struct EditInfoView: View {
                     asInspectorType = 1
                 }
             }
+            .onChange(of: info.relateName) { oldValue, newValue in
+                if info.relateName.isEmpty == true {
+                    isShowRelateTextField = false
+                } else {
+                    isShowRelateTextField = true
+                }
+            }
             Spacer()
         } // end VStack
     }
@@ -365,41 +373,37 @@ struct EditInfoView: View {
         }
     }
     
+    func fetchWebContent(urlString: String) async {
+        let re = await fetchTitleFromUrl(urlString:info.url)
+        await MainActor.run {
+            if re.title.isEmpty == false {
+                info.name = re.title
+                if re.imageUrl.isEmpty == false {
+                    IOInfo.updateCoverImage(info: info, img: IOImg(url: re.imageUrl))
+                }
+                info.imageUrls = re.imageUrls
+            }
+        }
+    }
+    
     // MARK: URL
     private var urlInputView: some View {
         HStack {
             TextField("地址:", text: $info.url, prompt: Text("输入或粘贴 url，例如 https://starming.com")).rounded()
                 .onSubmit {
                     info.name = "获取标题中......"
+                    
                     Task {
                         // MARK: 获取 Web 内容
-                        let re = await fetchTitleFromUrl(urlString:info.url)
-                        DispatchQueue.main.async {
-                            if re.title.isEmpty == false {
-                                info.name = re.title
-                                if re.imageUrl.isEmpty == false {
-                                    IOInfo.updateCoverImage(info: info, img: IOImg(url: re.imageUrl))
-                                }
-                                info.imageUrls = re.imageUrls
-                            }
-                        }
+                        await fetchWebContent(urlString: info.url)
                     }
                 }
             if info.url.isEmpty == false {
                 Button {
                     info.name = "获取标题中......"
                     Task {
                         // MARK: 获取 Web 内容
-                        let re = await fetchTitleFromUrl(urlString:info.url)
-                        DispatchQueue.main.async {
-                            if re.title.isEmpty == false {
-                                info.name = re.title
-                                if re.imageUrl.isEmpty == false {
-                                    IOInfo.updateCoverImage(info: info, img: IOImg(url: re.imageUrl))
-                                }
-                                info.imageUrls = re.imageUrls
-                            }
-                        }
+                        await fetchWebContent(urlString: info.url)
                     }
                 } label: {
                     Image(systemName: "link")
@@ -483,10 +487,13 @@ struct EditInfoView: View {
                 sterms.append(lineTs)
             } // end if
         } // end for
-        searchTerms = sterms
         return sterms
     }
     
+    @MainActor func searchTerms(arr: [[String]]) {
+        searchTerms = arr
+    }
+    
     // MARK: 数据管理
     func tabSwitch() {
         if info.url.isEmpty {
```

**File**: `SwiftPamphletApp/ViewComponet/ViewComponent.swift` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@ struct SPOutlineView<D, Content>: View where D: RandomAccessCollection, D.Elemen
     let d: D
     let c: KeyPath<D.Element, D?>
     let content: (D.Element) -> Content
-    @State var isExpanded = true // 控制初始是否展开的状态
     
     var body: some View {
         ForEach(d) { i in
```

#### Recent Merged Pull Requests:
- **PR #201** (closed): Update workflow action (@WanQuanXie)
- **PR #200** (2024-05-19): build(build.yml): 指定 Github Action  Workflow 打包时使用最新稳定版的 xcode (@WanQuanXie)
- **PR #195** (2022-08-02): Update PlayTextEditorView.swift (@xugj-gits)
- **PR #193** (2022-06-29): fix crash when click '技术周报' (@wtracyliu)
- **PR #134** (2022-01-25): fix part of swiftlint checked rules by swiftlint --fix (@feuvan)
- **PR #133** (2022-01-25): fix typo: GItHubAPI -> GitHubAPI (@feuvan)
- **PR #119** (2022-01-08): Update compile.command (@powenn)
- **PR #116** (2021-12-20): Update README.md (@powenn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
