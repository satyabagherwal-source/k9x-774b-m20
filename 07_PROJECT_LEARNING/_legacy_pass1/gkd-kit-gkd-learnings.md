# Forensic Learning Record (Deep Inspection): gkd-kit/gkd

> **Canonical Artifact**: `07_PROJECT_LEARNING/gkd-kit-gkd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gkd-kit/gkd](https://github.com/gkd-kit/gkd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:00.063Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gkd-kit/gkd`
- **Description**: 基于无障碍，高级选择器，订阅规则的自定义屏幕点击安卓应用 | An Android APP with custom screen tapping based on Accessibility, Advanced Selectors, and Subscription Rules
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 42388 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gkd-selector/scripts/gradle.ts`
```
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryDir = dirname(dirname(scriptDir));
const isWindows = process.platform === 'win32';
const gradleWrapper = join(
  repositoryDir,
  isWindows ? 'gradlew.bat' : 'gradlew',
);

export async function runGradle(tasks: readonly string[]): Promise<void> {
  if (tasks.length === 0) throw new Error('No Gradle tasks specified');

  await new Promise<void>((resolve, reject) => {
    const command = isWindows
      ? (process.env.ComSpec ?? 'cmd.exe')
      : gradleWrapper;
    const args = isWindows
      ? ['/d', '/s', '/c', `""${gradleWrapper}" ${tasks.join(' ')}"`]
      : tasks;
    const gradle = spawn(command, args, {
      cwd: repositoryDir,
      stdio: 'inherit',
      windowsVerbatimArguments: isWindows,
    });
    gradle.on('error', reject);
    gradle.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Gradle exited with code ${code}`));
    });
  });
}

```

### Core Architecture Module: `gkd-selector/scripts/validate-release-tag.ts`
```
import { readFileSync } from 'node:fs';

const [tag, ...extraArgs] = process.argv.slice(2);
if (tag === undefined || extraArgs.length > 0) {
  throw new Error('Usage: validate-release-tag.ts <tag>');
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (!stableVersionPattern.test(manifest.version)) {
  throw new Error(`Package version must use numeric x.y.z: ${manifest.version}`);
}

const expectedTag = `${manifest.name}@${manifest.version}`;
if (tag !== expectedTag) {
  throw new Error(`Expected release tag ${expectedTag}, got ${tag}`);
}

console.log(`Validated release tag ${tag}`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1034** (2025-11-13): **[BUG] com.android.systemui 系统界面识别异常**
  *Symptoms*: ### 日志文件   [log-1749443937546.zip](https://github.com/user-attachments/files/20649266/log-1749443937546.zip)  ### BUG描述(文字/截图/视频)   系统界面通知栏下拉。有时点击，有时不点击。规则如下。 ```json5 {   "key": 2,   "name": "功能类",   "rules": [     {       "matches": [         "@[visibleToUser=true][text=\"小窗打开\"] <<n [vid=\"expanded\"]"       ],       "quickFind": true,       "matchRoot": true,       "forcedTime": 60000,       "priorityTime": 5000,       "actionMaximum": 10,       "actionDelay": 20,       "snapshotUrls": [         "https://i.gkd.li/i/20638271"       ],       "exampleUrls": [         "https://e.gkd.li/516fae2b-3e06-4fed-b229-9e9ba438852c"       ],       "activityIds": [         "com.android.launcher3.uioverrides.QuickstepLauncher"       ]     }   ] } ```  https://github.com/user-attachments/assets/d4aa72d8-56de-454f-9ce7-dafbb54eb921  在桌面状态下下拉通知栏他不点击。只有当我打开某个应用并下拉通知栏。，它才会点击。  ### 期望行为(文字/截图/视频)   我不知道是不是什么bug或者缺陷。来这里反馈一下。  ### 实际行为(文字/截图/视频)   我试了好久才发现这个规律。
  **Post-Mortem & Fix Analysis**:
  > > 在桌面状态下下拉通知栏  根据日志得到的界面是 com.meizu.flyme.launcher/com.android.launcher3.uioverrides.QuickstepLauncher  所以你的规则不会触发  你在系统桌面添加同样的规则就可以触发了  ---  不过为什么你的设备从桌面下拉得到的通知界面是 `com.meizu.flyme.launcher` ，你可以把这个界面快照发出来看看  此外你也可以关闭 shizuku 授权后重新快照看看  另外 `com.android.systemui` 这个应用比较特殊，它并不适用 android 系统的 activity 概念 
  > > > 在桌面状态下下拉通知栏 >  > 根据日志得到的界面是 com.meizu.flyme.launcher/com.android.launcher3.uioverrides.QuickstepLauncher >  > 所以你的规则不会触发 >  > 你在系统桌面添加同样的规则就可以触发了 >  > 不过为什么你的设备从桌面下拉得到的通知界面是 `com.meizu.flyme.launcher` ，你可以把这个界面快照发出来看看 >  > 此外你也可以关闭 shizuku 授权后重新快照看看 >  > 另外 `com.android.systemui` 这个应用比较特殊，它并不适用 android 系统的 activity 概念  这是从桌面状态下下拉的通知栏。https://i.gkd.li/i/20649480 这是我打开某个应用之后下拉的通知栏。 https://i.gkd.li/i/20649525
  > 在 shizuku 里关闭 gkd 的授权后，重新快照这两种情况看看呢

- **Issue #1027** (2025-11-13): **[BUG] resetMatch=app 且 activityIds 有值时匹配异常**
  *Symptoms*: ### 日志文件   https://github.com/user-attachments/files/20566245/log-1748942787571.zip  ### BUG描述(文字/截图/视频)   #1025  ### 期望行为(文字/截图/视频)   正常匹配  ### 实际行为(文字/截图/视频)   无法匹配
  **Post-Mortem & Fix Analysis**:
  > https://github.com/gkd-kit/gkd/releases

- **Issue #776** (2024-11-18): **[BUG] 开启 HTTP 服务后程序闪退**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17786741  ### BUG描述(文字/截图/视频)   开启 HTTP 服务后程序闪退  ### 期望行为(文字/截图/视频)   正常开启 HTTP 服务  ### 实际行为(文字/截图/视频)   开启 HTTP 服务后程序闪退   https://github.com/user-attachments/assets/b9d4cc70-2dfb-4a4c-8092-cc671161bdc5  
  **Post-Mortem & Fix Analysis**:
  > `9781fd7` 后正常

- **Issue #765** (2024-11-11): **[BUG] anyMatches部分情况下不触发规则**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17629780  ### BUG描述(文字/截图/视频)   使用如下规则，第二个选择器可匹配上节点，但是不触发规则 ``` {   id: 'com.mihoyo.hyperion',   name: '米游社',   groups: [     {       key: 8,       name: '功能类-米游自动签到测试',       desc: '包含崩坏3、绝区零、原神、星穹铁道',       forcedTime: 10000,       activityIds: '.web2.MiHoYoWebActivity',       rules: [         {           key: 0,           name: '点击签到',           anyMatches: [             '[text$="每日签到"] >4 View[childCount=11] > @View[childCount=3][visibleToUser=true] > Image[index=0][text!=null]',             '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道           ],           exampleUrls: 'https://e.gkd.li/53d22dc7-b368-46c0-85d2-fe132b0832a9',           snapshotUrls: [             'https://i.gkd.li/i/17611613', // 星穹铁道签到前             'https://i.gkd.li/i/14967627', // 签到节点 clickable=false           ],           excludeSnapshotUrls: [             'https://i.gkd.li/i/17611617', // 星穹铁道签到后 无法排除匹配           ],         },       ],     },   ], } ``` 把 ``` anyMatches: [   '[text$="每日签到"] >4 View[childCount=11] > @View[childCount=3][visibleToUser=true] > Image[index=0][text!=null]',   '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道 ], ``` 替换成以下任意一个皆可触发规则 ``` matches: [    '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道 ], ``` ``` anyMatches: [    '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]',
  **Post-Mortem & Fix Analysis**:
  > https://github.com/gkd-kit/gkd/releases

- **Issue #759** (2024-11-11): **[BUG] 出现大量报错提示**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17574495  ### BUG描述(文字/截图/视频)   昨天出现过一次，用beta版的时候也出现过一次，这个提示过几秒就消失了，当时没截到图，下面这个图是别人的  ![9FABD8BF41588F7D8D403B98046C0A59](https://github.com/user-attachments/assets/37e4d5ed-2ffa-4c25-bd19-f25e116637d3)   ### 期望行为(文字/截图/视频)   不出现报错提示  ### 实际行为(文字/截图/视频)   出现报错提示
  **Post-Mortem & Fix Analysis**:
  > 看起来应该是这里的顺序写反导致多线程同时 `setGeneratedTime` 出现的报错  <https://github.com/gkd-kit/gkd/blob/3e884b57d6b56d8d09e732641a0446eb6045dd5b/app/src/main/kotlin/li/songe/gkd/service/NodeExt.kt#L24-L28>  试试下面这个版本呢？  [release.zip](https://github.com/user-attachments/files/17582140/release.zip) 
  > 好的，我用一段时间看看
  > https://github.com/gkd-kit/gkd/releases

- **Issue #698** (2024-08-10): **[Bug] 短时间内多次触发后，悬浮窗toast无法消失**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/guide/faq) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16569326  ### BUG描述(文字/截图/视频)    https://github.com/user-attachments/assets/4c435592-1dd6-4eea-b770-5069c8eef459  如视频  ### 期望行为(文字/截图/视频)   悬浮窗toast在短时间内多次触发后自动消失  ### 实际行为(文字/截图/视频)   如上方视频
  **Post-Mortem & Fix Analysis**:
  > [release.zip](https://github.com/user-attachments/files/16569618/release.zip)  你好，试试这个版本呢？
  > > [release.zip](https://github.com/user-attachments/files/16569618/release.zip) >  > 你好，试试这个版本呢？  这是actions里的版本吗？是的话上方就是使用该版本导致的。 如果是已经修改过代码进行修复的话，问题可能已经消失
  > > 这是actions里的版本吗？  本地修改打包的

- **Issue #695** (2024-08-08): **[BUG] 快照链接生成错误**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/guide/faq) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16540833  ### BUG描述(文字/截图/视频)   生成的快照链接是日志链接的格式，且不能再次点击快照复制链接  ![1723109245402](https://github.com/user-attachments/assets/90eb3ab9-2a0e-4954-b898-a757674f4ad0)   ### 期望行为(文字/截图/视频)   生成快照格式的链接，且再次点击快照后能复制链接  ### 实际行为(文字/截图/视频)   生成日志格式的链接，且再次点击快照后不能复制链接
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈  应该是合并上传逻辑的时候丢失了快照相关的逻辑
  > https://github.com/gkd-kit/gkd/releases

- **Issue #669** (2024-07-20): **[BUG] 排除匹配生效的情况下依然触发规则**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/faq/) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16313156  ### BUG描述(文字/截图/视频)   预期外的点击界面快照：https://i.gkd.li/i/16312880  规则： ```   {     key: 0,     name: '开屏广告',     order: OPEN_AD_ORDER,     matchTime: 10000,     actionMaximum: 2,     resetMatch: 'app',     actionCdKey: 0,     actionMaximumKey: 0,     rules: [       {         key: 0,         fastQuery: true,         excludeMatches:           '[text*="搜索" || vid~="(?is).*search.*" || desc*="搜索"][visibleToUser=true]', // 防止在应用的搜索页面误触         matches: '[text*="跳过"][text.length<10][visibleToUser=true]',       },       {         key: 1,         excludeMatches:           '[text*="搜索" || vid~="(?is).*search.*" || desc*="搜索"][visibleToUser=true]', // 防止在应用的搜索页面误触         matches:           '[childCount=0][visibleToUser=true][((text*="跳过" || text*="跳過" || text~="(?is).*skip.*") && text.length<10) || ((desc*="跳过" || 
  **Post-Mortem & Fix Analysis**:
  > https://f.gkd.li/16313372 补充一下上述规则的key: 1的触发日志，可排除错误使用fastQuery的问题
  > 匹配是从事件节点开始的，如果你要匹配的目标在事件节点之外，那就匹配不到  两种解决方法  1. 设置 [matchRoot](https://gkd.li/api/interfaces/RawCommonProps#matchroot) 为 `true` ，所有选择器都从根节点查询 2. 或者将排除的选择器 `[text='abc']`  改成 `[text='abc'] <<n [parent=null]`
  > > 匹配是从事件节点开始的，如果你要匹配的目标在事件节点之外，那就匹配不到 >  > 两种解决方法 >  > 1. 设置 [matchRoot](https://gkd.li/api/interfaces/RawCommonProps#matchroot) 为 `true` ，所有选择器都从根节点查询 > 2. 或者将排除的选择器 `[text='abc']`  改成 `[text='abc'] <<n [parent=null]`  好的，感谢解答 构想过另一种解决全局规则在搜索页误触的方法：全局规则支持排除activityid，同时activityid支持包含匹配，搜索页的activityid基本都有```search```字符，这样就可排除搜索页，不知能否实现？

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

### Incident Patch 1: `ab837b3e` (2026-09-26)
**Commit Message**: fix: reset app list scroll after displayed items change

**File**: `gkd-app/src/main/kotlin/li/gkd/app/feature/subscription/SubsAppListPage.kt` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ fun SubsAppListPage(route: SubsAppListRoute) {
     val pageScrollState = rememberListScrollState()
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(apps.map { it.id })
+    pageScrollState.ResetOnListChange(apps, key = { it.id })
     var expanded by remember { mutableStateOf(false) }
 
     Scaffold(
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/feature/subscription/SubsGlobalGroupExcludePage.kt` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ fun SubsGlobalGroupExcludePage(route: SubsGlobalGroupExcludeRoute) {
                 AppSortOption.ByUsedTime -> named.sortedBy { visits.value?.get(it) ?: Int.MAX_VALUE }
             }
         }
+        scroll.ResetOnListChange(visibleIds, key = { it })
         val selectableTargets = visibleIds.filterTo(mutableSetOf()) { controls.getValue(it).canEnable }
         val selected = selection.selectedKeys intersect selectableTargets
         LaunchedEffect(selectableTargets) { selection.retain(selectableTargets) }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/A11yScopeAppListPage.kt` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ fun A11yScopeAppListPage() {
     val pageScrollState = rememberListScrollState(canScroll = { !editable })
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(appInfos)
+    pageScrollState.ResetOnListChange(appInfos, key = { it.id })
     BackHandler(editable, vm.scope.launchUiAction {
         context.imeController.requestHide()
         if (vm.textChanged) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/BlockA11yAppListPage.kt` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ fun BlockA11yAppListPage() {
     val pageScrollState = rememberListScrollState(canScroll = { !editable })
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(appInfos)
+    pageScrollState.ResetOnListChange(appInfos, key = { it.id })
     BackHandler(editable, vm.scope.launchUiAction {
         context.imeController.requestHide()
         if (vm.textChanged) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/component/Hooks.kt` (modified, +46/-1)
```diff
@@ -12,13 +12,14 @@ import androidx.compose.material3.TopAppBarState
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.ReadOnlyComposable
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.Stable
+import androidx.compose.runtime.snapshotFlow
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.rememberUpdatedState
 import androidx.compose.runtime.saveable.rememberSaveable
-import androidx.compose.runtime.snapshotFlow
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.focus.FocusRequester
 import androidx.compose.ui.focus.focusRequester
@@ -79,6 +80,31 @@ private fun TopAppBarScrollBehavior.resetScroll() {
     state.contentOffset = 0f
 }
 
+private class ListChangeMarker<T>(
+    var list: List<T>,
+    var leadingItemKey: Any?,
+)
+@Composable
+fun <T> GkResetOnItemKeysChange(
+    list: List<T>,
+    key: (T) -> Any,
+    leadingItemKey: Any? = null,
+    onChange: () -> Unit,
+) {
+    // Immutable list snapshots let us skip the key comparison on unrelated recompositions.
+    val previous = remember { ListChangeMarker(list, leadingItemKey) }
+    SideEffect {
+        val changed = previous.leadingItemKey != leadingItemKey ||
+            (previous.list !== list && (
+                previous.list.size != list.size ||
+                list.indices.any { index -> key(previous.list[index]) != key(list[index]) }
+            ))
+        previous.list = list
+        previous.leadingItemKey = leadingItemKey
+        if (changed) onChange()
+    }
+}
+
 @Stable
 class ListScrollState(
     val scrollBehavior: TopAppBarScrollBehavior,
@@ -87,6 +113,13 @@ class ListScrollState(
 ) {
     private var resetJob: Job? = null
 
+    private fun requestScrollReset() {
+        resetJob?.cancel()
+        resetJob = null
+        scrollBehavior.resetScroll()
+        listState.requestScrollToItem(0)
+    }
+
     private suspend fun performScrollReset() {
         scrollBehavior.resetScroll()
         listState.scrollToItem(0)
@@ -120,6 +153,18 @@ class ListScrollState(
                 .collect { if (currentEnabled.value) resetScroll() }
         }
     }
+
+    @Composable
+    fun <T> ResetOnListChange(
+        list: List<T>,
+        key: (T) -> Any,
+        leadingItemKey: Any? = null,
+        enabled: Boolean = true,
+    ) {
+        GkResetOnItemKeysChange(list, key, leadingItemKey) {
+            if (enabled) requestScrollReset()
+        }
+    }
 }
 
 @Stable
```

---

### Incident Patch 2: `677c1388` (2026-09-24)
**Commit Message**: fix(priv): forward embedded screenshot failures safely

**File**: `AGENTS.md` (modified, +5/-0)
```diff
@@ -79,3 +79,8 @@
 - 涉及 Android framework Java/AIDL API 的源码定位、跨版本签名或可用性比较、API 缺失原因分析，以及 Java hidden-API 访问代码生成时，必须使用项目内的 `android-api-diff` skill：`.agents/skills/android-api-diff/SKILL.md`。
 - 按该 skill 的路由使用 `android-api-diff` CLI，并保留默认 JSON 输出；不得自行实现或模拟 Android API 版本检查。
 - 安装或更新项目级 skill 时，在项目根目录运行 `android-api-diff skill install`。
+
+## 嵌入式 UserService 异常边界
+
+- 嵌入式 `UserService` 运行在特权进程中。调用隐藏 API 等可能失败的 Binder 方法，必须在方法最外层以末端 `catch (e: Throwable)` 兜住可恢复错误，并通过 Binder 可传输的异常或失败结果将原始类型、消息和堆栈交给主进程；不得只在主进程捕获，也不得让 `NoSuchMethodError` 等 `LinkageError` 逃逸导致特权进程崩溃。
+- `VirtualMachineError` 和 `ThreadDeath` 等无法可靠恢复的终止错误可以原样抛出；不要把它们伪装成普通业务失败。
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/priv/CompatScreenshot.kt` (modified, +4/-4)
```diff
@@ -45,10 +45,10 @@ object CompatScreenshot {
         return when {
             AndroidTarget.S -> {
                 val displayToken = SurfaceControlHidden.getInternalDisplayToken()
-                val captureArgs = SurfaceControlHidden.DisplayCaptureArgs.Builder(displayToken)
-                    .setSourceCrop(crop)
-                    .setSize(width, height)
-                    .build()
+                val builder = SurfaceControlHidden.DisplayCaptureArgs.Builder(displayToken)
+                builder.setSourceCrop(crop)
+                builder.setSize(width, height)
+                val captureArgs = builder.build()
                 SurfaceControlHidden.captureDisplay(captureArgs)?.asBitmap()
             }
 
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/priv/UserService.kt` (modified, +16/-1)
```diff
@@ -2,12 +2,27 @@ package li.gkd.app.priv
 
 import android.graphics.Bitmap
 import android.graphics.Rect
+import android.os.ServiceSpecificException
 import androidx.annotation.Keep
 
+private const val SCREENSHOT_ERROR_CODE = 1
+private const val MAX_SCREENSHOT_ERROR_LENGTH = 16_384
+
 @Keep
 class UserService : IUserService.Stub() {
     override fun takeScreenshot(crop: Rect, rotation: Int): Bitmap? {
-        return CompatScreenshot.captureBySurfaceControl(crop, rotation)
+        return try {
+            CompatScreenshot.captureBySurfaceControl(crop, rotation)
+        } catch (e: VirtualMachineError) {
+            throw e
+        } catch (e: ThreadDeath) {
+            throw e
+        } catch (e: Throwable) {
+            throw ServiceSpecificException(
+                SCREENSHOT_ERROR_CODE,
+                e.stackTraceToString().take(MAX_SCREENSHOT_ERROR_LENGTH),
+            )
+        }
     }
 
     override fun destroy() = Unit
```

**File**: `gkd-hidden-api/src/main/java/android/os/ServiceSpecificException.java` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+package android.os;
+
+public class ServiceSpecificException extends RuntimeException {
+    public ServiceSpecificException(int errorCode, String message) {
+        super(message);
+        throw new RuntimeException();
+    }
+}
```

**File**: `gkd-hidden-api/src/main/java/android/view/SurfaceControlHidden.java` (modified, +8/-4)
```diff
@@ -35,15 +35,19 @@ public static ScreenshotHardwareBuffer captureDisplay(DisplayCaptureArgs capture
         throw new RuntimeException();
     }
 
-    public static class DisplayCaptureArgs {
-        public static class Builder {
+    public abstract static class CaptureArgs {
+        public abstract static class Builder<T extends Builder<T>> {
             @RequiresApi(Build.VERSION_CODES.S)
-            public Builder(IBinder displayToken) {
+            public T setSourceCrop(Rect sourceCrop) {
                 throw new RuntimeException();
             }
+        }
+    }
 
+    public static class DisplayCaptureArgs extends CaptureArgs {
+        public static class Builder extends CaptureArgs.Builder<Builder> {
             @RequiresApi(Build.VERSION_CODES.S)
-            public Builder setSourceCrop(Rect sourceCrop) {
+            public Builder(IBinder displayToken) {
                 throw new RuntimeException();
             }
 
```

---

### Incident Patch 3: `616637f2` (2026-09-24)
**Commit Message**: fix(a11y): trigger subscription update on launcher content changes

**File**: `gkd-app/src/main/kotlin/li/gkd/app/a11y/A11yFeat.kt` (modified, +3/-3)
```diff
@@ -30,9 +30,9 @@ import li.gkd.selector.NodeAdapter
 fun onA11yFeatEvent(event: AccessibilityEvent) = event.run {
     if (event.eventType == STATE_CHANGED) {
         watchCaptureScreenshot()
-        if (event.packageName == launcherAppId) {
-            watchAutoUpdateSubs()
-        }
+    }
+    if (event.packageName == launcherAppId) {
+        watchAutoUpdateSubs()
     }
 }
 
```

---

### Incident Patch 4: `613ffe98` (2026-09-02)
**Commit Message**: feat: improve crash report management

**File**: `gkd-app/src/main/kotlin/li/gkd/app/MainViewModel.kt` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@ import li.gkd.app.a11y.useA11yServiceEnabledFlow
 import li.gkd.app.a11y.useEnabledA11yServicesFlow
 import li.gkd.app.data.CrashData
 import li.gkd.app.data.RawSubscription
+import li.gkd.app.data.trimCrashDataFiles
 import li.gkd.db.Db
 import li.gkd.app.entry.EntryActivity
 import li.gkd.app.entry.OpenFileActivity
@@ -336,6 +337,7 @@ class MainViewModel : BaseViewModel(), OnSimpleLife by DefaultSimpleLifeImpl() {
         }
 
         scope.launchTry(Dispatchers.IO) {
+            trimCrashDataFiles()
             val list = (crashTempFolder.listFiles() ?: emptyArray()).mapNotNull {
                 try {
                     json.decodeFromString<CrashData>(it.readText())
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/data/CrashData.kt` (modified, +46/-0)
```diff
@@ -1,11 +1,14 @@
 package li.gkd.app.data
 
 import kotlinx.serialization.Serializable
+import li.gkd.app.util.LogUtils
 import li.gkd.app.util.crashFolder
 import li.gkd.app.util.crashTempFolder
 import li.gkd.app.util.format
 import li.gkd.app.util.json
 
+private const val MAX_CRASH_RECORD_COUNT = 20
+
 @Serializable
 data class CrashData(
     val id: Long,
@@ -25,6 +28,49 @@ data class CrashData(
         val text = json.encodeToString(this)
         crashFolder.resolve(filename).writeText(text)
         crashTempFolder.resolve(filename).writeText(text)
+        trimCrashDataFiles()
     }
 
+    fun delete(): Boolean = listOf(
+        crashFolder.resolve(filename),
+        crashTempFolder.resolve(filename),
+    ).map { file ->
+        !file.exists() || file.delete()
+    }.all { it }
+}
+
+fun deleteCrashDataList(): Boolean = listOf(
+    crashFolder,
+    crashTempFolder,
+).flatMap { folder ->
+    (folder.listFiles() ?: emptyArray()).filter { it.isFile }
+}.map { file ->
+    !file.exists() || file.delete()
+}.all { it }
+
+fun trimCrashDataFiles() {
+    listOf(crashFolder, crashTempFolder).forEach { folder ->
+        (folder.listFiles() ?: emptyArray())
+            .filter { it.isFile }
+            .sortedByDescending { it.name }
+            .drop(MAX_CRASH_RECORD_COUNT)
+            .forEach { file ->
+                if (!file.delete()) {
+                    LogUtils.d("删除过期崩溃日志失败: ${file.name}")
+                }
+            }
+    }
 }
+
+fun loadCrashDataList(): List<CrashData> =
+    (crashFolder.listFiles() ?: emptyArray())
+        .filter { it.isFile }
+        .mapNotNull { file ->
+            try {
+                json.decodeFromString<CrashData>(file.readText())
+            } catch (e: Exception) {
+                LogUtils.d("解析崩溃日志失败: ${file.name}", e)
+                null
+            }
+        }
+        .sortedByDescending { it.mtime }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/AdvancedPage.kt` (modified, +5/-0)
```diff
@@ -227,6 +227,11 @@ private fun AdvancedContent() {
                     EventService.setEnabled(mainVm, enabled)
                 },
             )
+            SettingItem(
+                title = "崩溃记录",
+                subtitle = "应用异常退出记录",
+                onClick = { mainVm.navigatePage(CrashReportRoute) },
+            )
             Spacer(modifier = Modifier.height(EmptyHeight))
         }
     }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/CrashReportPage.kt` (modified, +245/-18)
```diff
@@ -1,37 +1,64 @@
 package li.gkd.app.ui
 
+import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
+import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.height
+import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.size
 import androidx.compose.foundation.layout.width
-import androidx.compose.foundation.verticalScroll
+import androidx.compose.foundation.lazy.LazyColumn
+import androidx.compose.foundation.lazy.items
 import androidx.compose.material3.BottomAppBar
+import androidx.compose.material3.Card
+import androidx.compose.material3.HorizontalDivider
+import androidx.compose.material3.IconButtonDefaults
+import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Scaffold
 import androidx.compose.material3.Text
 import androidx.compose.material3.TextButton
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.input.nestedscroll.nestedScroll
+import androidx.compose.ui.semantics.onClick
+import androidx.compose.ui.semantics.semantics
+import androidx.compose.ui.semantics.stateDescription
+import androidx.compose.ui.text.style.TextOverflow
 import androidx.compose.ui.unit.dp
+import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.lifecycle.viewmodel.compose.viewModel
 import androidx.navigation3.runtime.NavKey
 import kotlinx.serialization.Serializable
+import li.gkd.app.data.CrashData
 import li.gkd.app.ui.component.CopyTextCard
 import li.gkd.app.ui.component.EmptyText
+import li.gkd.app.ui.component.FixedTimeText
 import li.gkd.app.ui.component.PerfIcon
 import li.gkd.app.ui.component.PerfIconButton
 import li.gkd.app.ui.component.PerfTopAppBar
-import li.gkd.app.ui.component.rememberColumnScrollState
+import li.gkd.app.ui.component.rememberListScrollState
 import li.gkd.app.ui.share.LocalMainViewModel
+import li.gkd.app.ui.share.Loadable
 import li.gkd.app.ui.share.noRippleClickable
 import li.gkd.app.ui.style.EmptyHeight
 import li.gkd.app.ui.style.itemHorizontalPadding
 import li.gkd.app.ui.style.itemVerticalPadding
+import li.gkd.app.ui.style.scaffoldPadding
+import li.gkd.app.ui.style.surfaceCardColors
 import li.gkd.app.util.ISSUES_URL
+import li.gkd.app.util.format
+import li.gkd.app.util.launchTry
 import li.gkd.app.util.throttle
+import li.gkd.app.util.toast
 
 
 @Serializable
@@ -41,9 +68,14 @@ data object CrashReportRoute : NavKey
 fun CrashReportPage() {
     val mainVm = LocalMainViewModel.current
     val vm = viewModel { CrashReportVm(mainVm.takeCrashDataList()) }
-    val pageScrollState = rememberColumnScrollState()
+    val crashDataState by vm.crashDataState.collectAsStateWithLifecycle()
+    val actionScope = vm.scope
+    val crashDataList = crashDataState.value.orEmpty()
+    val pageScrollState = rememberListScrollState()
     val scrollBehavior = pageScrollState.scrollBehavior
-    val scrollState = pageScrollState.scrollState
+    val listState = pageScrollState.listState
+    pageScrollState.ResetOnChange(crashDataList.isNotEmpty())
+    val expandedCrashId = vm.expandedCrashId
     Scaffold(
         modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
         topBar = {
@@ -61,10 +93,30 @@ fun CrashReportPage() {
                         modifier = Modifier.noRippleClickable(onClick = throttle(pageScrollState::resetScroll))
                     )
                 },
+                actions = {
+                    if (crashDataList.
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/CrashReportVm.kt` (modified, +82/-2)
```diff
@@ -1,8 +1,88 @@
 package li.gkd.app.ui
 
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
+import kotlinx.coroutines.launch
+import kotlinx.coroutines.withContext
 import li.gkd.app.data.CrashData
+import li.gkd.app.data.deleteCrashDataList
+import li.gkd.app.data.loadCrashDataList
 import li.gkd.app.ui.share.BaseViewModel
+import li.gkd.app.ui.share.Loadable
 
 class CrashReportVm(
-    val crashDataList: List<CrashData>,
-) : BaseViewModel()
+    initialCrashDataList: List<CrashData>,
+) : BaseViewModel() {
+    var expandedCrashId by mutableStateOf(initialCrashDataList.firstOrNull()?.id)
+        private set
+
+    val crashDataState: StateFlow<Loadable<List<CrashData>>>
+        field = MutableStateFlow(
+            if (initialCrashDataList.isEmpty()) {
+                Loadable.Loading
+            } else {
+                Loadable.Ready(initialCrashDataList)
+            },
+        )
+
+    private val initialLoadJob = scope.launch(Dispatchers.IO) {
+        crashDataState.value = try {
+            Loadable.Ready(loadCrashDataList())
+        } catch (e: CancellationException) {
+            throw e
+        } catch (e: Exception) {
+            if (initialCrashDataList.isEmpty()) {
+                Loadable.Failure(e)
+            } else {
+                Loadable.Ready(initialCrashDataList)
+            }
+        }
+    }
+
+    suspend fun deleteCrash(crashData: CrashData) {
+        initialLoadJob.join()
+        val deleted = withContext(Dispatchers.IO) {
+            crashData.delete()
+        }
+        if (deleted) {
+            crashDataState.value = Loadable.Ready(
+                crashDataState.value.value.orEmpty().filterNot { it.id == crashData.id },
+            )
+            if (expandedCrashId == crashData.id) {
+                expandedCrashId = null
+            }
+        } else {
+            reloadAfterDeleteFailure()
+            error("删除崩溃记录失败")
+        }
+    }
+
+    suspend fun deleteAllCrashes() {
+        initialLoadJob.join()
+        val deleted = withContext(Dispatchers.IO) {
+            deleteCrashDataList()
+        }
+        crashDataState.value = Loadable.Ready(
+            withContext(Dispatchers.IO) { loadCrashDataList() },
+        )
+        expandedCrashId = null
+        if (!deleted) {
+            error("部分崩溃记录删除失败")
+        }
+    }
+
+    private suspend fun reloadAfterDeleteFailure() {
+        crashDataState.value = Loadable.Ready(
+            withContext(Dispatchers.IO) { loadCrashDataList() },
+        )
+    }
+
+    fun toggleCrash(crashId: Long) {
+        expandedCrashId = if (expandedCrashId == crashId) null else crashId
+    }
+}
```

---

### Incident Patch 5: `199f1048` (2026-08-27)
**Commit Message**: fix: update GitHub Actions module paths

**File**: `.github/workflows/Build-Apk.yml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ jobs:
         run: echo ${{ secrets.GKD_STORE_FILE_BASE64 }} | base64 --decode > ${{ github.workspace }}/gkd.jks
 
       - run: chmod 777 ./gradlew
-      - run: ./gradlew app:assembleGkdRelease
+      - run: ./gradlew :gkd-app:assembleGkdRelease
         env:
           GKD_GITHUB_COOKIE: ${{ secrets.GKD_GITHUB_COOKIE }}
           GKD_API_AUTH_TOKEN: ${{ secrets.GKD_API_AUTH_TOKEN }}
```

**File**: `.github/workflows/Build-Release.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
         run: echo ${{ secrets.PLAY_STORE_FILE_BASE64 }} | base64 --decode > ${{ github.workspace }}/play.jks
 
       - run: chmod 777 ./gradlew
-      - run: ./gradlew app:assembleGkdRelease app:bundlePlayRelease
+      - run: ./gradlew :gkd-app:assembleGkdRelease :gkd-app:bundlePlayRelease
         env:
           GKD_GITHUB_COOKIE: ${{ secrets.GKD_GITHUB_COOKIE }}
           GKD_API_AUTH_TOKEN: ${{ secrets.GKD_API_AUTH_TOKEN }}
```

---

### Incident Patch 6: `1a7585fb` (2026-08-26)
**Commit Message**: refactor: prefix Gradle modules with gkd-

**File**: `.github/workflows/Build-Apk.yml` (modified, +2/-2)
```diff
@@ -44,9 +44,9 @@ jobs:
       - uses: actions/upload-artifact@v7
         with:
           archive: false
-          path: app/build/outputs/apk/gkd/release/*.apk
+          path: gkd-app/build/outputs/apk/gkd/release/*.apk
 
       - uses: actions/upload-artifact@v7
         with:
           name: outputs
-          path: app/build/outputs
+          path: gkd-app/build/outputs
```

**File**: `.github/workflows/Build-Release.yml` (modified, +4/-4)
```diff
@@ -45,22 +45,22 @@ jobs:
       - uses: actions/upload-artifact@v7
         with:
           name: release
-          path: app/build/outputs/apk/gkd/release
+          path: gkd-app/build/outputs/apk/gkd/release
 
       - uses: actions/upload-artifact@v7
         with:
           name: playRelease
-          path: app/build/outputs/bundle/playRelease
+          path: gkd-app/build/outputs/bundle/playRelease
 
       - uses: actions/upload-artifact@v7
         with:
           name: outputs
-          path: app/build/outputs
+          path: gkd-app/build/outputs
 
       - run: |
           cp outputs/apk/gkd/release/app-gkd-release.apk "${GITHUB_WORKSPACE}/gkd-${GITHUB_REF_NAME}.apk"
           zip -r "${GITHUB_WORKSPACE}/outputs-${GITHUB_REF_NAME}.zip" outputs
-        working-directory: app/build
+        working-directory: gkd-app/build
 
       - uses: softprops/action-gh-release@v3
         with:
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
 ## Kotlin 可见性
 
-- `app` 模块内禁止使用 `internal` 关键字；由于没有其他模块会引用 `app` 模块，对外可见的声明应省略可见性修饰符（使用 Kotlin 默认的 `public`），仅在需要收窄作用域时使用 `private`。
+- `gkd-app` 模块内禁止使用 `internal` 关键字；由于没有其他模块会引用 `gkd-app` 模块，对外可见的声明应省略可见性修饰符（使用 Kotlin 默认的 `public`），仅在需要收窄作用域时使用 `private`。
 - 与公开属性直接一一对应、仅用于收窄可见性或可变性的 `_xxx` backing property，必须改用 Explicit Backing Fields；不禁止不存在这种直接对应关系的普通私有字段、缓存或生成代码风格命名。未使用的 Lambda 参数占位符 `_` 不受此限制。
 
 ## Compose 与状态边界
```

**File**: `gkd-app/build.gradle.kts` (renamed, +2/-2)
```diff
@@ -216,7 +216,7 @@ loc {
 dependencies {
     implementation(libs.kotlin.stdlib)
 
-    implementation(project(":selector"))
+    implementation(project(":gkd-selector"))
 
     implementation(libs.androidx.appcompat)
     implementation(libs.androidx.core.ktx)
@@ -247,7 +247,7 @@ dependencies {
     // AndroidTest shares this runtime dependency with the app and requires the newer version.
     implementation(libs.androidx.concurrent.futures)
 
-    remapApi(project(":hidden-api"))
+    remapApi(project(":gkd-hidden-api"))
     implementation(libs.rikka.shizuku.api)
     implementation(libs.rikka.shizuku.provider)
     implementation(libs.priv.kit.ui)
```

---

### Incident Patch 7: `36ad0b13` (2026-08-26)
**Commit Message**: fix: 移除无障碍悬浮窗 AppOp 控制

**File**: `app/src/main/kotlin/li/songe/gkd/permission/PermissionState.kt` (modified, +1/-8)
```diff
@@ -14,7 +14,6 @@ import kotlinx.coroutines.flow.stateIn
 import kotlinx.coroutines.flow.updateAndGet
 import li.songe.gkd.app
 import li.songe.gkd.appScope
-import li.songe.gkd.priv.CompatAppOpsService
 import li.songe.gkd.priv.privilegeContextFlow
 import li.songe.gkd.util.AndroidTarget
 import li.songe.gkd.util.toast
@@ -114,11 +113,6 @@ object PermissionStates {
                 checkAllowedOp(AppOpsManagerHidden.OPSTR_ACCESS_ACCESSIBILITY)
     }
 
-    private fun checkCreateA11yOverlay(): Boolean {
-        return !CompatAppOpsService.supportA11yOverlay ||
-                checkAllowedOp(AppOpsManagerHidden.OPSTR_CREATE_ACCESSIBILITY_OVERLAY)
-    }
-
     val Manifest_permission_GET_APP_OPS_STATS get() = "android.permission.GET_APP_OPS_STATS"
 
     private var canRestrictsRead = true
@@ -146,9 +140,8 @@ object PermissionStates {
             name = "启动相关操作权限",
             check = {
                 val accessA11yAllowed = checkAccessA11y()
-                val createA11yOverlayAllowed = checkCreateA11yOverlay()
                 val accessRestrictedSettingsAllowed = checkAccessRestrictedSettings()
-                accessA11yAllowed && createA11yOverlayAllowed && accessRestrictedSettingsAllowed
+                accessA11yAllowed && accessRestrictedSettingsAllowed
             },
         )
     }
```

**File**: `app/src/main/kotlin/li/songe/gkd/priv/CompatAppOpsService.kt` (modified, +0/-5)
```diff
@@ -1,6 +1,5 @@
 package li.songe.gkd.priv
 
-import android.app.AppOpsManager
 import android.content.Context
 import com.android.internal.app.IAppOpsService
 import priv.kit.core.binder.PrivilegeBinderWrapper
@@ -11,8 +10,4 @@ class CompatAppOpsService {
             PrivilegeBinderWrapper.fromSystemService(Context.APP_OPS_SERVICE),
         ),
     )
-
-    companion object {
-        val supportA11yOverlay by lazy { AppOpsManager::class.detectHiddenField("OP_CREATE_ACCESSIBILITY_OVERLAY") }
-    }
 }
```

**File**: `app/src/main/kotlin/li/songe/gkd/priv/PrivilegeContext.kt` (modified, +0/-3)
```diff
@@ -95,9 +95,6 @@ class PrivilegeContext private constructor(
         if (AndroidTarget.UPSIDE_DOWN_CAKE) {
             setAllowSelfMode(AppOpsManagerHidden.OP_FOREGROUND_SERVICE_SPECIAL_USE)
         }
-        if (CompatAppOpsService.supportA11yOverlay) {
-            setAllowSelfMode(AppOpsManagerHidden.OP_CREATE_ACCESSIBILITY_OVERLAY)
-        }
     }
 
     private fun grantSelfPermission(name: String) {
```

**File**: `hidden-api/src/main/java/android/app/AppOpsManagerHidden.java` (modified, +0/-6)
```diff
@@ -18,12 +18,6 @@ public class AppOpsManagerHidden {
     @RequiresApi(Build.VERSION_CODES.Q)
     public static String OPSTR_ACCESS_ACCESSIBILITY;
 
-    // 14.0.0_r29 - 14.0.0_r37, 14.0.0_r50 - 17
-    public static int OP_CREATE_ACCESSIBILITY_OVERLAY;
-
-    // 14.0.0_r29 - 14.0.0_r37, 14.0.0_r50 - 17
-    public static String OPSTR_CREATE_ACCESSIBILITY_OVERLAY;
-
     @RequiresApi(Build.VERSION_CODES.TIRAMISU)
     public static int OP_ACCESS_RESTRICTED_SETTINGS;
 
```

---

### Incident Patch 8: `b856f310` (2026-08-22)
**Commit Message**: fix: 补全本地网络和存储权限处理

**File**: `app/src/main/kotlin/li/songe/gkd/MainViewModel.kt` (modified, +4/-0)
```diff
@@ -25,6 +25,7 @@ import li.songe.gkd.priv.AutomationService
 import li.songe.gkd.priv.privilegeContextFlow
 import li.songe.gkd.priv.uiAutomationFlow
 import li.songe.gkd.permission.PermissionRequests
+import li.songe.gkd.permission.PermissionStates
 import li.songe.gkd.service.A11yService
 import li.songe.gkd.store.createTextFlow
 import li.songe.gkd.store.storeFlow
@@ -150,6 +151,9 @@ class MainViewModel : BaseViewModel(), OnSimpleLife by DefaultSimpleLifeImpl() {
 
     val subsLinkDialog = SubsLinkDialogState(
         onOpenHelp = { navigateWebPage(ShortUrlSet.URL5) },
+        requestLocalNetworkPermission = {
+            permissionRequests.ensurePermissions(PermissionStates.localNetwork)
+        },
     )
 
     val subsSheet = SubsSheetState()
```

**File**: `app/src/main/kotlin/li/songe/gkd/permission/PermissionState.kt` (modified, +9/-0)
```diff
@@ -170,6 +170,14 @@ object PermissionStates {
         )
     }
 
+    val localNetwork by lazy {
+        requestablePermissionState(
+            name = "访问本地网络权限",
+            purpose = "用于通过无线调试连接特权服务及允许局域网设备访问 HTTP 服务",
+            permission = PermissionLists.getAccessLocalNetworkPermission(),
+        )
+    }
+
     val queryPackages by lazy {
         requestablePermissionState(
             name = "读取应用列表权限",
@@ -240,6 +248,7 @@ object PermissionStates {
     val all by lazy {
         listOf(
             notification,
+            localNetwork,
             foregroundServiceSpecialUse,
             appOpsAllowed,
             drawOverlays,
```

**File**: `app/src/main/kotlin/li/songe/gkd/priv/PrivilegeContext.kt` (modified, +6/-0)
```diff
@@ -114,9 +114,15 @@ class PrivilegeContext private constructor(
         }
         grantSelfPermission(PermissionStates.Manifest_permission_GET_APP_OPS_STATS)
         grantSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS)
+        if (!AndroidTarget.Q) {
+            grantSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
+        }
         if (AndroidTarget.TIRAMISU) {
             grantSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
         }
+        if (AndroidTarget.CINNAMON_BUN) {
+            grantSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK)
+        }
     }
 
     companion object {
```

**File**: `app/src/main/kotlin/li/songe/gkd/service/HttpService.kt` (modified, +1/-0)
```diff
@@ -140,6 +140,7 @@ class HttpService : Service(), OnSimpleLife by DefaultSimpleLifeImpl() {
             if (!mainVm.permissionRequests.ensurePermissions(
                     PermissionStates.foregroundServiceSpecialUse,
                     PermissionStates.notification,
+                    PermissionStates.localNetwork,
                 )
             ) return
             start()
```

**File**: `app/src/main/kotlin/li/songe/gkd/ui/component/SubsLinkDialogState.kt` (modified, +7/-1)
```diff
@@ -21,6 +21,7 @@ import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import kotlinx.coroutines.withContext
 import li.songe.gkd.db.DbSet
+import li.songe.gkd.util.isLocalNetworkUrl
 import li.songe.gkd.util.throttle
 import li.songe.gkd.util.toast
 import kotlin.coroutines.resume
@@ -33,6 +34,7 @@ private data class SubsLinkDialogRequest(
 
 class SubsLinkDialogState(
     private val onOpenHelp: () -> Unit,
+    private val requestLocalNetworkPermission: suspend () -> Boolean,
 ) {
     private val requestFlow = MutableStateFlow<SubsLinkDialogRequest?>(null)
     private val requestMutex = Mutex()
@@ -80,7 +82,7 @@ class SubsLinkDialogState(
         val existingUrls = withContext(Dispatchers.IO) {
             DbSet.subsItemDao.queryAll().mapNotNullTo(mutableSetOf()) { it.updateUrl }
         }
-        return withContext(Dispatchers.Main.immediate) {
+        val value = withContext(Dispatchers.Main.immediate) {
             requestMutex.withLock {
                 try {
                     requestFlow.value = SubsLinkDialogRequest(
@@ -97,6 +99,10 @@ class SubsLinkDialogState(
                 }
             }
         }
+        if (value != null && isLocalNetworkUrl(value) && !requestLocalNetworkPermission()) {
+            return null
+        }
+        return value
     }
 
     @Composable
```

---

### Incident Patch 9: `61d43467` (2026-08-18)
**Commit Message**: fix: keep bottom sheet below dialogs

**File**: `app/src/main/kotlin/li/songe/gkd/ui/app/AppOverlayHost.kt` (modified, +4/-1)
```diff
@@ -21,12 +21,15 @@ fun AppOverlayHost() {
     if (!mainVm.termsAcceptedFlow.collectAsStateWithLifecycle().value) {
         TermsAcceptDialog()
     } else {
+        // Sheet
+        mainVm.subsSheet.Render()
+
+        // Dialog
         UiAutomationAlreadyRegisteredDlg()
         AccessRestrictedSettingsDlg()
         mainVm.dialogRequests.Render()
         mainVm.githubUpload.Render()
         mainVm.updateStatus?.UpgradeDialog()
-        mainVm.subsSheet.Render()
         mainVm.subsLinkDialog.Render()
         mainVm.ruleGroupState.Render()
         mainVm.textDialog.Render()
```

**File**: `app/src/main/kotlin/li/songe/gkd/ui/component/AppDialog.kt` (modified, +7/-9)
```diff
@@ -88,15 +88,13 @@ fun AppModalBottomSheet(
     sheetGesturesEnabled: Boolean = true,
     content: @Composable ColumnScope.() -> Unit,
 ) {
-    DialogLayer {
-        ModalBottomSheet(
-            onDismissRequest = onDismissRequest,
-            modifier = modifier,
-            sheetState = sheetState,
-            sheetGesturesEnabled = sheetGesturesEnabled,
-            content = content,
-        )
-    }
+    ModalBottomSheet(
+        onDismissRequest = onDismissRequest,
+        modifier = modifier,
+        sheetState = sheetState,
+        sheetGesturesEnabled = sheetGesturesEnabled,
+        content = content,
+    )
 }
 
 @Composable
```

---

### Incident Patch 10: `060af154` (2026-08-10)
**Commit Message**: fix: add NoSuchMethodException

**File**: `app/src/main/kotlin/li/songe/gkd/priv/CompatUserManager.kt` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ class CompatUserManager {
                 excludePreCreated,
             )
 
-            else -> value.getUsers(excludeDying)
+            else -> throw NoSuchMethodException("IUserManager.getUsers")
         }.map { UserInfo(id = it.id, name = it.name) }
     }
 }
```

**File**: `app/src/main/kotlin/li/songe/gkd/priv/CompatWindowManager.kt` (modified, +2/-2)
```diff
@@ -37,12 +37,12 @@ class CompatWindowManager {
     fun freezeRotation(rotation: Int, caller: String) = when (freezeRotationType) {
         ROTATION_WITHOUT_CALLER -> value.freezeRotation(rotation)
         ROTATION_WITH_CALLER -> value.freezeRotation(rotation, caller)
-        else -> throw NoSuchMethodException("IWindowManager#freezeRotation")
+        else -> throw NoSuchMethodException("IWindowManager.freezeRotation")
     }
 
     fun thawRotation(caller: String) = when (thawRotationType) {
         ROTATION_WITHOUT_CALLER -> value.thawRotation()
         ROTATION_WITH_CALLER -> value.thawRotation(caller)
-        else -> throw NoSuchMethodException("IWindowManager#thawRotation")
+        else -> throw NoSuchMethodException("IWindowManager.thawRotation")
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #1472** (closed): fix: 自动化模式下开机自启状态服务 (@LYYZZ)
- **PR #1470** (closed): fix(a11y): 开机后自愈无障碍服务"假在线"状态 (@LYYZZ)
- **PR #1467** (closed): Add Japanese localization across GKD UI (@okker24)
- **PR #1466** (closed): translation for english (@theclumsypirate)
- **PR #1457** (closed): refactor: remove unused methods and clean up code (@KevinDoremy)
- **PR #1456** (closed): feat: native snapshot inspector with rule generation (GMD port) + bui… (@Azx8788)
- **PR #1451** (closed): feat: support multi-selection on snapshot page (#1392) (@wg2038)
- **PR #1444** (2026-09-24): fix(a11y): 兼容桌面内容变化事件触发订阅自动更新 (@eviaaaaa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
