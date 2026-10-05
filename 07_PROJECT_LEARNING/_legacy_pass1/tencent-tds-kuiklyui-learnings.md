# Forensic Learning Record (Deep Inspection): Tencent-TDS/KuiklyUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:29:31.144Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent-TDS/KuiklyUI`
- **Description**: A Kotlin Multiplatform UI framework from Tencent TDS — high-performance, one codebase for six platforms, with dynamic delivery.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3548 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.whistle.js`
```
const localhost = '127.0.0.1:8017'

exports.name = 'KuiklyCore';
exports.rules = `
/.*/debug/nv_js/(.*)/ ${localhost}/$1
/.*/debug/nv_so/(.*)/ ${localhost}/$1
`;
```

### Core Architecture Module: `core-render-ios/Core/KuiklyContextParam.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import <Foundation/Foundation.h>
#import "KuiklyRenderContextProtocol.h"

NS_ASSUME_NONNULL_BEGIN

extern const KuiklyContextMode KuiklyContextMode_Framework;

@class KuiklyContextParam;

// Kuikly接入模式
@interface KuiklyBaseContextMode : NSObject

@property (nonatomic, assign) KuiklyContextMode modeId;

// 创建Framework接入模式实例，modeId为KuiklyContextMode_Framework
- (instancetype)initFrameworkMode;

// 创建Kuikly执行环境的实现者
// contextCode: 产物数据（NSString 或 NSData）
- (id<KuiklyRenderContextProtocol>)createContextHandlerWithContextCode:(id)contextCode
                                                          contextParam:(KuiklyContextParam *)contextParam;

@end

@interface KuiklyContextParam : NSObject

/// pageName 页面名 （对应的值为kotlin侧页面注解 @Page("xxxx")中的xxx名）
@property (nonatomic, copy, readonly) NSString *pageName;

/// contextMode context产物模式
@property (nonatomic, strong) KuiklyBaseContextMode *contextMode;

/// isCompose 是否是Compose页面
@property (nonatomic, assign) BOOL isCompose;

/// 资源文件目录URL, 用于资源文件放置于非MainBundle根目录下时指定自定义路径
@property (nonatomic, strong, readonly, nullable) NSURL *resourceFolderUrl;

/// Initialize context-related parameters
/// - Parameters:
///   - pageName: Page name (corresponds to the value in the Kotlin-side page annotation @Page("xxxx"), case-sensitive)
///   - resourceFolderUrl: URL of the folder containing resource files. If empty, the mainBundle URL will be used by default.
///
///   When using SPM for integration, resource files are typically located in an independent bundle.
///   The resource directory can be passed in the following format:
///   [[[NSBundle mainBundle] bundleURL] URLByAppendingPathComponent:@"shared_SharedResource.bundle/KuiklyResources"];
///   Replace shared_SharedResource and KuiklyResources with the actual bundle name and subdirectory name, respectively.
+ (instancetype)newWithPageName:(NSString *)pageName
              resourceFolderUrl:(nullable NSURL *)resourceFolderUrl;

/// Obtain the URL of the resource file, which is used to load resources such as images
/// - Parameters:
///   - fileName: File name
///   - fileExtension: File extension
- (NSURL *)urlForFileName:(NSString *)fileName extension:(NSString *)fileExtension;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `core-render-ios/Core/KuiklyCoreDefine.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#pragma once

#ifndef KuiklyErrorDefine_h
#define KuiklyErrorDefine_h

static NSString * const KuiklyLoadErrorDomain = @"KuiklyLoadErrorDomain";

typedef NS_ENUM(NSInteger, KuiklyLoadErrorCode) {
    KuiklyLoadError_fetchContextCode = 10,
    KuiklyLoadError_fatalException = 11,
};

#endif  /* KuiklyErrorDefine_h */

```

### Core Architecture Module: `core-render-ios/Core/KuiklyRenderCore.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#import <Foundation/Foundation.h>
#import "KRUIKit.h" // [macOS]
#import "TDFModuleProtocol.h"
#import "KuiklyRenderContextProtocol.h"
#import "KuiklyRenderViewExportProtocol.h"

extern NSString *_Nonnull const kKuiklyFatalExceptionNotification;

NS_ASSUME_NONNULL_BEGIN

@class KuiklyContextParam;
@class KRTurboDisplayConfig;
@protocol KuiklyRenderCoreDelegate;
@protocol KuiklyRenderLayerProtocol;

/**
 * @brief 负责Kuikly by Kotlin渲染流程核心逻辑模块。
 */
@interface KuiklyRenderCore : NSObject

/** @brief 异常处理block */
@property (nonatomic, strong) OnUnhandledExceptionBlock onExceptionBlock;

/**
 * @brief 初始化KuiklyRenderCore实例的方法。
 * @param rootView 宿主根视图，用于渲染层内容。
 * @param contextCode 产物数据（NSString 或 NSData）
 * @param contextParam 包含contextCode，pageName，url等信息的参数
 * @param params 页面对应的参数（kotlin侧可通过pageData.params获取）
 * @return 返回KuiklyRenderCore实例
 */
- (instancetype)initWithRootView:(UIView *)rootView
                     contextCode:(id)contextCode
                    contextParam:(KuiklyContextParam *)contextParam
                          params:(NSDictionary *_Nullable)params
                        delegate:(id<KuiklyRenderCoreDelegate>)delegate;
/*
 * @brief 完全初始化Core之后调用
 * 注：该时机用于依赖UI组件渲染时所需要的时机，因UI组件渲染可能通过hr_rootView调用相关Api，
 *    其api会依赖core变量的存在，所以这里提供延后初始化的时机(保证hr_rootView中_core已完成初始化)
 */
- (void)didInitCore;
/**
 * @brief 通过KuiklyRenderCore发送事件到KuiklyKotlin侧（支持多线程调用，非主线程时为同步通信）。
 * @param event 事件名
 * @param data 事件对应的参数
 */
- (void)sendWithEvent:(NSString *)event data:(NSDictionary *)data;
/**
 * @brief 通过KuiklyRenderCore发送事件到KuiklyKotlin侧，并显式指定是否走同步发送路径。
 * @param event 事件名
 * @param data 事件对应的参数
 * @param sync 是否按同步路径发送
 */
- (void)sendWithEvent:(NSString *)event data:(NSDictionary *)data sync:(BOOL)sync;

/**
 * @brief 在Core销毁前调用，用于Core提前发送事件到KuiklyKotlin侧销毁内在资源。
 */
- (void)willDealloc;

/**
 * @brief 获取模块对应的实例（仅支持在主线程调用）。
 * @param moduleName 模块名
 * @return module实例
 */
- (id<TDFModuleProtocol> _Nullable)moduleWithName:(NSString *)moduleName;

/**
 * @brief 获取tag对应的View实例（仅支持在主线程调用）。
 * @param tag view对应的索引
 * @return view实例
 */
- (id<KuiklyRenderViewExportProtocol> _Nullable)viewWithTag:(NSNumber *)tag;

/**
 * @brief 响应kotlin侧闭包
 * @param callbackID GlobalFunctions.createFunction返回的callback id
 * @param data 调用闭包传参
 */
- (void)fireCallbackWithID:(NSString *)callbackID data:(NSDictionary *)data;

/**
 * @brief 同步布局和渲染（在当前线程渲染执行队列中所有任务以实现同步渲染）
 */
- (void)syncFlushAllRenderTasks;

/**
 * @brief 当首屏完成后执行任务（优化首屏性能，仅支持在主线程调用）
 * @param task 主线程任务
 */
- (void)performWhenViewDidLoadWithTask:(dispatch_block_t)task;
/**
 * @brief 收到手势响应时调用
 */
- (void)didHitTest;

@end

/*
 * @brief KuiklyRenderCoreDelegate
 */
@protocol KuiklyRenderCoreDelegate <NSObject>

@optional
/*
 * @brief 打开TurboDisplay渲染模式技术，实现超原生首屏性能
        （通过直接执行dai二进制产物渲染生成首屏，避免业务代码执行后再生成的首屏等待耗时）
 *
 *注意：如果首屏不精准，可在kotin侧需要通过调用TurboDisplayModule.setCurrentUIAsFirstScreenForNextLaunch()方法生成指定帧二进制产物作为下次首屏
 * @return 返回该页面的TurboDisplayKey（一般可为PageName，若为nil，则为关闭TurboDisplay渲染模式）
 */
- (NSString * _Nullable)turboDisplayKey;

/*
 * @brief 返回 TurboDisplay 页面级配置（新增）
 */
- (KRTurboDisplayConfig * _Nullable)turboDisplayConfig;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `core-render-ios/Core/KuiklyRenderUIScheduler.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
@protocol KuiklyRenderUISchedulerDelegate;
/**
 * @brief KuiklyRenderCore UI线程调度器
 */
@interface KuiklyRenderUIScheduler : NSObject
/** 执行主线程任务中 */
@property (nonatomic, assign, readonly) BOOL performingMainQueueTask;
/** sync 事件场景下，等待主线程恢复后立即执行的 UI 任务闭包（外部设置占位标记，内部覆盖为真正的 UI 任务） */
@property (nonatomic, copy, nullable) dispatch_block_t mainThreadTaskWaitToSyncBlock;
/** TurboDisplay lazy rendering 阶段标志，该阶段内 sync 事件不立即 flush UI 任务 */
@property (nonatomic, assign) BOOL isInTurboDisplayLazyRendering;
/*
 * @brief KuiklyRenderUIScheduler初始化方法
 * @param delegate KuiklyRenderUISchedulerDelegate代理
 */
- (instancetype)initWithDelegate:(id<KuiklyRenderUISchedulerDelegate>)delegate;

/*
 * @brief 添加任务到主线程执行（下一个runloop统一批量执行）
 * @param task 任务闭包
 */
- (void)addTaskToMainQueueWithTask:(dispatch_block_t)task;
/*
 * @brief 立即执行待同步的主线程任务
 */
- (void)performSyncMainQueueTasksBlockIfNeed;

/*
 * @brief 执行任务当首屏完成时(优化首屏性能压力)
 * @param task 任务闭包
 */
- (void)performWhenViewDidLoadWithTask:(dispatch_block_t)task;
/*
 * @brief 标记首屏已经已经加载完成
 */
- (void)markViewDidLoad;


/*
 * @brief 在主线程上立即执行因 sync 事件而积攒的 UI 任务（在主线程上调用，dispatch_sync 返回后立即调用）
 */
- (void)performMainThreadTaskWaitToSyncBlockIfNeed;


@end

@protocol KuiklyRenderUISchedulerDelegate<NSObject>

/**
 * @brief  UI任务将要执行前回调
 * @param scheduler KuiklyRenderUIScheduler
 */
- (void)willPerformUITasksWithScheduler:(KuiklyRenderUIScheduler*)scheduler;

@end

NS_ASSUME_NONNULL_END


```

### Core Architecture Module: `core-render-ios/Extension/AdvancedComps/KRAPNGView.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import "KRUIKit.h" // [macOS]
#import "KuiklyRenderViewExportProtocol.h"

NS_ASSUME_NONNULL_BEGIN

@protocol APNGImageViewProtocol;

/// APNG组件动画播放回调
@protocol APNGViewPlayDelegate <NSObject>

@optional

/// 播放结束接口
/// - Parameter apngImageView: apngView视图
/// - Parameter loopCount: 已播放次数
- (void)apngImageView:(id<APNGImageViewProtocol> _Nonnull)apngImageView playEndLoop:(NSUInteger)loopCount;


@end

@protocol APNGImageViewProtocol <NSObject>

/// apngView动画播放代理
@property (nonatomic, weak, nullable) id<APNGViewPlayDelegate> delegate;

/// 播放次数，0表示无限循环，如果不设置，则会使用从apng图解析出来的count
@property (nonatomic, assign) NSInteger playCount;

/// 设置图片路径（优先实现该setFilePath）
/// @param filePath 图片路径
/// @param completion 图片解析完成后回调，返回第一帧图片内容
- (void)setFilePath:(NSString *_Nullable)filePath withCompletion:(void (^_Nullable)(UIImage * _Nullable image))completion;
/// 设置图片路径
/// @param filePath 图片路径
- (void)setFilePath:(NSString *_Nullable)filePath ;


/// 开始播放动画（第一次播放调用该接口，从第一帧开始）
- (void)startAPNGAnimating;

/// 停止播放动画
- (void)stopAPNGAnimating;

@optional
/// 动画播放停止时暂时最后一帧动画
@property (nonatomic, assign) BOOL showLastImageWhenPause;


@end

typedef id<APNGImageViewProtocol> _Nonnull (^APNGViewCreator)(CGRect frame);
@interface KRAPNGView : UIView<KuiklyRenderViewExportProtocol>
/*
 * @brief 注册自定义APNGView实现
 * @param creator 创建apngView实现者实例
 */
+ (void)registerAPNGViewCreator:(APNGViewCreator)creator;

// 预下载cdn apng资源并缓存
+ (void)preDownloadIfNeedWithCDNUrl:(NSString *)cdnUrl;
+ (BOOL)isCdnUrl:(NSString *)url;
@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `core-render-ios/Extension/AdvancedComps/KRActivityIndicatorView.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import "KRUIKit.h" // [macOS]
#import "KuiklyRenderViewExportProtocol.h"
NS_ASSUME_NONNULL_BEGIN

@interface KRActivityIndicatorView : UIActivityIndicatorView<KuiklyRenderViewExportProtocol>

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `core-render-ios/Extension/AdvancedComps/KRBlurView.h`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import "KRUIKit.h" // [macOS]
#import "KuiklyRenderViewExportProtocol.h"
NS_ASSUME_NONNULL_BEGIN


@interface KRBlurView : UIVisualEffectView<KuiklyRenderViewExportProtocol>

/// css attr 高斯模糊模糊半径 默认为10
@property (nonatomic, strong) NSNumber *css_blurRadius;

@end

NS_ASSUME_NONNULL_END

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1773** (2026-09-30): **fix(android): center rich text line height on font ascent/descent**
  *Symptoms*:  ## Problem  On Android, text with an explicit `lineHeight` sits lower in its line box than the same text on iOS, OHOS or in a browser, and the offset differs per font. Fonts with asymmetric font padding (many custom/brand fonts) are most affected: the glyphs appear pushed down and multi-font rich text does not share a consistent baseline for the same `lineHeight`.  ## Root cause  `HRLineHeightSpan.chooseHeight` distributed the extra leading around `FontMetricsInt.top` / `bottom`:  ```kotlin val additional = height - (-fm.top + fm.bottom) fm.top -= ceil(additional / 2f); fm.bottom += floor(additional / 2f) fm.ascent = fm.top; fm.descent = fm.bottom ```  `top`/`bottom` include the font padding extents even when `includeFontPadding` is disabled, so the "centre" is biased by whatever extra padding the font declares above vs below. CSS (and the iOS/OHOS renderers) apply half-leading around ascent/descent instead.  ## Fix  Distribute the extra leading around `ascent` / `descent` and derive `top` / `bottom` from them (CSS half-leading). Odd leftovers go to the descent side, and the resulting box is always exactly `height` tall.  The computation stays purely metrics based (no glyph-bounds measurement): `HRLineHeightSpan` is shared by `KRRichTextView` and `KRTextFieldView`, and a content-dependent placement would make an editable line jump when a taller glyph is typed.  Two now-unused `kotlin.math` imports are removed.  ## Tests  `core-render-android/src/test/.../expand/component/tex
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1773) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1772** (2026-09-30): **fix(compose): serialize SpanStyle.fontFamily on rich text spans**
  *Symptoms*:  ## Problem  1. In Compose, a `fontFamily` set through `SpanStyle` on part of an `AnnotatedString` (for example a monospace face on one word, or a brand font on a heading fragment) is ignored. The whole paragraph renders with the `Text`'s `TextStyle.fontFamily`. 2. Once span families are forwarded, a `LinkAnnotation` that has no `styles` (a plain `Clickable` over a range) would erase the family inherited from enclosing spans over the link range. This most often shows up as a whole-paragraph click annotation resetting the paragraph's custom font.  ## Root cause  `TextSpan.applySpanStyle` in `KuiklyTextExtension.kt` forwards font size, weight, style, shadow, colour, decoration and letter spacing, but never calls `applyFontFamily`, so the span is lowered without `fontFamily`.  The link path lowers a style-less `LinkAnnotation` by applying `SpanStyle()`; `applyFontFamily(null)` then writes an empty `fontFamily` onto a span that already had one from an enclosing `SpanStyle`.  ## Fix  - `applySpanStyle` now calls `applyFontFamily(spanStyle.fontFamily)` alongside the other font props (same helper `TextAttr.applyTextStyle` already uses). - A `LinkAnnotation` without `styles` only contributes its click handler; links with styles are lowered exactly as before.  Both parts are in one PR because the second is a direct consequence of the first.  ## Tests  `compose/src/commonTest/.../foundation/text/AnnotatedStringSpanStyleTest.kt`:  - `spanStyleFontFamilyIsSerializedOnTheSpan`: a `Serif` 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1772) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1771** (2026-09-30): **fix: render rich text span backgroundColor on Android, iOS and OHOS**
  *Symptoms*:  ## Problem  Setting a background colour on a single span of a rich text has no visible effect on any platform:  - Compose: `SpanStyle(background = ...)` inside an `AnnotatedString`. - Kuikly DSL: `TextSpan { backgroundColor(...) }` (available through `Attr`, since `TextSpan` extends `TextAttr`).  The whole-view `backgroundColor` on `Text` / `RichText` keeps working; only the per-span colour is lost.  ## Root cause  The span prop is already produced on the Kotlin side: `TextSpan.applySpanStyle` calls `applyStyleColor`, which writes `SpanStyle.background` to the span as the `backgroundColor` prop, and the DSL writes the same key. None of the three native rich text renderers ever read `backgroundColor` from a span entry in `values`, so the value is dropped at paint time.  ## Fix  Each renderer now reads the span's own `backgroundColor` and paints it behind the glyphs of that span:  - **Android** (`KRRichTextBuilder.kt`): `TextSpanProps` parses `backgroundColor`; a `BackgroundColorSpan` is added when the colour is not transparent. - **iOS** (`KRRichTextView.h/.m`): the parsed span attributes carry a `backgroundColor`; `NSBackgroundColorAttributeName` is applied over the span's range. - **OHOS** (`KRRichTextShadow.cpp`): a background brush is set on the span's `OH_Drawing_TextStyle` and destroyed after the typography is built.  Only the span's own props are consulted (no fallback to the text view's props). Core already excludes `backgroundColor` from the shadow props for `Text`/`
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1771) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1770** (2026-09-29): **fix(miniapp): remove root transform to keep canvas same-layer rendering alive**
  *Symptoms*: ## Problem  On the WeChat miniapp target, any Canvas inside a scrollable container (LazyColumn) visually detaches from its card when the user scrolls: the Kuikly content layer scrolls away but the canvas drawing stays fixed at its pre-scroll viewport position. Screenshots from a real project (habit tracker with a score ring + 6 chart cards inside a LazyColumn):  - Score-ring arc drawn on top of unrelated cards after scrolling - Line charts rendered over neighboring cards  Layout is correct at initial render — the detach only happens on scroll.  ## Root cause  Kuikly's LazyColumn scrolls by applying a view transform to the content layer (self-drawn scrolling), not via a native scroll-view. WeChat canvas **same-layer rendering** makes the native canvas layer follow the WebView content — **but same-layer rendering is disabled when any ancestor of the canvas has a transform** (known WeChat behavior; it silently falls back to native-overlay mode where the canvas floats above the viewport and never follows content movement).  `MiniDocument.createRootContainer` unconditionally sets `transform: translate(0, 0)` on the root container (plus a transition on iOS):  ```kotlin // Need to set transform and transition to ensure drop-shadow and other content settings take effect root.firstElementChild?.style?.transform = "translate(0, 0)" ```  This puts a transform on the ancestor chain of every canvas, disabling same-layer rendering for all canvases on the page.  ## Fix  Remove the root tran
  **Post-Mortem & Fix Analysis**:
  > Correction: further testing shows removing the root transform does **not** fix the detach — scrolling still leaves canvas drawings at their pre-scroll viewport position. The real mechanism: Kuikly LazyColumn scrolls by transforming the content layer, and the native canvas layer never follows transform-based movement regardless of same-layer rendering. I'll close this PR and open an issue documenting the deeper incompatibility.
  > Closing — see correction above. Will open an issue with the full analysis.

- **Issue #1764** (2026-09-27): **fix(compose): skip orphan canvas reset when the view owns its draw loop (Compose 混用裸 reset 致画布空白)**
  *Symptoms*: ## 问题 / Problem  `KuiklyCanvas.view` setter 在 Compose 绘制遍历给 view 赋值时**无条件**下发 `callMethod("reset", "")`。 当 `CanvasView` 经由 `MakeKuiklyComposeNode` 混用且注册了 `drawCallback` 时，绘制指令由该 callback 自行管理（reset+重填在其自身 draw 流程内同批完成）；Compose 遍历随后补发的**裸 reset**（本遍历内无任何绘制指令跟随）会把其已入队的指令清掉——下一次原生重绘消费空队列，画布空白。  The `view` setter unconditionally emits a bare `reset` when the Compose draw traversal assigns the view. For a `CanvasView` driven through `MakeKuiklyComposeNode` with a registered `drawCallback` (which manages its own reset+refill inside its draw pass), that orphan reset wipes already-queued ops; the next native redraw consumes an empty queue and the canvas blanks.  ## 复现 / Reproduction  真实设备时序（两端探针）：`reset → 重填 → 又一次 reset（无重填） → onDraw 消费 0 条指令`。 - Android：mermaid 图 HOME 退后台→暖回前台，canvas 内容 ink 从非 0 归 0；产生新指令（如缩放）后立即恢复——「无新指令的系统重绘必空」。 - iOS：带「drawRect 不清队列」行为但**无本护栏**的构建上，同路径同样复现 ops=0 空白（反向实证护栏必要性）。 纯 Kuikly DSL 不触发：`reset` 与重填经 uiScheduler 同时间片执行（上游 review #1759 时的判断正确）；触发条件是 Compose 混用（`MakeKuiklyComposeNode<CanvasView>` + `drawCallback`）。  ## 修法 / Fix  `drawCallback != null` 时跳过这次裸 reset；无 `drawCallback` 的纯 Compose Canvas（其指令会在同一 Draw 遍历内随即重填）行为不变。  ## 验证范围（如实声明） / Validation scope  - **Android 真机运行时 PASS**（含本护栏的发布候选）：mermaid 首渲 ✔、HOME 退后台→暖回前台 ink 不变 ✔、静态 canvas 徽标切 tab 往返 ink 不变 ✔。 - **iOS**：render 层（`drawRect:` 不再清队列）已二进制核验；**带护栏的 iOS 运行时未验证**（构建环境受限），仅有「有 revert 无护栏必空」的反向实证。护栏位于 commonMain，机理与平台无关。  ## 关联 / Links  - 撤回并取代 #1759（那个 PR 用「消费后清空」掩盖了本洞，同时把 CanvasView 变成单次消费视图，引入系统重绘空
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1764) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1764) before we can accept your contribution.<br/><hr/>**BiSheng** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent-TDS/KuiklyUI?pullRequest=1764) it.</sub>
  > Superseded by #1766（同一 diff，提交人已改为 Jiacheng 以通过 CLA 检查）。

- **Issue #1760** (2026-09-24): **fix: preserve Android shadows beyond view bounds**
  *Symptoms*: 

- **Issue #1759** (2026-09-24): **fix(canvas): consume-then-clear draw op queue to fix reset white screen**
  *Symptoms*: ## Problem  Since PR #1268 batched canvas draw ops into a single flush, each platform's `reset()` clears the pending op queue **immediately** when the JS/KMP side calls `context.reset()`. If a display/draw tick lands between `reset()` and the next refill of the op list, the render thread consumes an **empty queue** and the canvas flashes white (all previously issued ops are discarded without ever being drawn).  Observed on a real app: reset sequences dropped ~101 pending ops per frame, `onDraw` consumed `ops=0`, canvas rendered blank.  ## Fix  Defer clearing the op queue to the point where the queue is actually consumed, on all platforms:  - **Android** (`KRCanvasView.kt`): `reset()` no longer clears `drawOperationList`; `performDrawOperationList` clears it after replaying the ops. - **iOS** (`KRCanvasView.m`): `css_reset` no longer nils `renderActions`; `drawRect` copies the array, `removeAllObjects`, then replays the snapshot (same consume-then-clear semantics). - **OHOS** (`KRCanvasView.cpp`): `Reset()` no longer clears `ops_`; `OnDraw` clears it after the `for_each` replay. - **KMP** (`CanvasView.kt`):   - new `redraw()` API so callers that set `drawCallback` dynamically can trigger a draw outside `createRenderView`/`setFrameToRenderView`;   - `draw()` falls back to `lastRenderFrame` when flex `layoutFrame` is still default, so a reset+refill is not silently skipped due to missing size (`isLayoutFrameDefault()` exposed for callers).  ## Test  Verified on iOS (iPhone 17 Pr
  **Post-Mortem & Fix Analysis**:
  > 补充一个最小代码示例，说明这个白屏 bug 的触发机制（以 Android 为例，三端同构）。  PR #1268 之后，JS 侧的 canvas 绘制不是立即执行，而是先排入原生队列，由下一次 draw 回调统一回放：  ```kotlin // JS 调 reset() → 原生立即清空队列（#1268 之后的行为） private fun reset() {     drawOperationList.clear()          // ← 问题点：上一帧排好的指令被直接丢弃     currentDrawStyle = DrawStyle(...) }  // draw tick 到达时回放队列 private fun performDrawOperationList(canvas: Canvas) {     for (op in drawOperationList) {         op.draw(paint, canvas)         // 队列里有几条就画几条     } } ```  触发时序（连续布局测算 / 未挂窗连续重绘下稳定复现）：  ``` t1  JS: 画指令 op1..op101 入队        → 队列 = [op1..op101] t2  JS: reset()                      → 队列 = []        ← 101 条指令被丢 t3  VSYNC/display tick 到达          → onDraw 回放空队列 → 画出一帧纯空白 t4  JS: 重填新指令                    → 队列 = [op'1..]   ← 太晚，白帧已上屏 ```  只要 t3 落在 t2 和 t4 之间，画布就会闪白；在"上一轮指令未消费就 reset"的场景下是 100% 空白。  本 PR 的修法是把"清空"挪到消费点：reset 只重置样式不动队列，`performDrawOperationList` 回放完才 `clear()`，保证队列要么被完整消费、要么继续等下一次 draw，永远不会在 draw tick 上消费到空队列。  实际验证（iPhone 17 Pro 模拟器）：修复前 reset 序列丢弃约 101 条待回放指令、onDraw 消费 ops
  > @bytemain 你好，感谢PR！关于reset导致白屏，能否提供一个复现demo？跨端层的reset虽然单独通过callMethod发送，但render侧的指令调度uiScheduler会在同一个时间片执行，理论上不会被onDraw截断。
  > 感谢 review 与质疑——你们是对的，这个 PR 撤回。  **你们的判断成立**：在纯 Kuikly DSL 下，`reset` 与重填经 uiScheduler 在同一时间片执行，`onDraw` 截不进来。我们两端探针后来抓到的真实时序是「reset → 重填 → **又一次 reset 但没有重填** → onDraw」，即存在第三个孤儿 reset 调用点，而它不在渲染层。  **根因在我们 Compose 混用侧**：`KuiklyCanvas`（compose 模块）的 `view` setter 在 Compose 绘制遍历中无条件补发一次 `callMethod("reset", "")`。当 `CanvasView` 由 `MakeKuiklyComposeNode` 混用且自注册 `drawCallback` 时，绘制指令由 drawCallback 自行管理（reset+重填同批），Compose 的裸 reset 把已下发队列清掉 → 空白。本 PR 的「消费后清空」把该洞盖住，但同时把 CanvasView 变成单次消费视图，引入系统重绘（切 tab/HOME 暖回）空白的新回归。  **我们的落地修复**（fork 内，已验证链路上）：revert 本 PR 同型改动 + `KuiklyCanvas.view` setter 在 `drawCallback != null` 时跳过裸 reset。  **给上游的一个真问题**：上游主干 `KuiklyCanvas.kt` 的 setter 同样无条件发裸 reset（约 L79），任何 `MakeKuiklyComposeNode<CanvasView>` + drawCallback 的混用场景都会踩中。我们验证通过后会给上游提一个只含 setter 护栏的 PR，附两端时序日志。 

- **Issue #1758** (2026-09-23): **feat(demo): add chat bubble demo(左滑删除)**
  *Symptoms*: 

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

### Incident Patch 1: `18252bca` (2026-09-24)
**Commit Message**: fix: preserve Android shadows beyond view bounds (#1760)

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/css/ktx/KRCSSViewExtension.kt` (modified, +6/-0)
```diff
@@ -552,6 +552,12 @@ private var View.boxShadow: String?
         val viewDecorator = obtainViewDecorator()
         viewDecorator.boxShadow = value ?: KRCssConst.EMPTY_STRING
         if (KuiklyRenderView.lazyClipChildren && viewDecorator.hasBoxShadow) {
+            // View 已挂载时，若直接父容器不需要裁剪内容，则立即关闭其 clipChildren。
+            (parent as? ViewGroup)?.also { parentView ->
+                if (parentView.clipChildren && !parentView.shouldClipContent) {
+                    parentView.clipChildren = false
+                }
+            }
             parent?.setContentOverBounds()
         }
     }
```

---

### Incident Patch 2: `81faec34` (2026-09-22)
**Commit Message**: fix: adapt iOS and macOS builds for Xcode 27 minimum deployment targets (#1753)

* fix: adapt iOS and macOS builds for Xcode 27 minimum deployment targets

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

* fix: rollback update in podfile and improve docs description

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

* docs: restore pod install step and refine Xcode 27 notes

- restore the pod install --repo-update step in the CocoaPods guide, which was replaced by the Xcode 27 warning block
- note the MD5 to SHA256 output length change (32 to 64 chars) in TODO comments to avoid silent truncation when migrating

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

* docs: update Xcode 27 notes

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

* docs: fix dangling step reference and stale cross-link title

- clarify step 2 wording after the Xcode 27 warning block was moved below it
- update the cross-reference to match the renamed warning section

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

---------

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

**File**: `core-render-ios/Extension/AdvancedComps/KRActivityIndicatorView.m` (modified, +8/-0)
```diff
@@ -29,7 +29,11 @@ - (instancetype)initWithFrame:(CGRect)frame {
     if ([super initWithFrame:frame]) {
         self.backgroundColor = [UIColor clearColor];
 #if !TARGET_OS_OSX // [macOS]
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIActivityIndicatorViewStyleWhite/Gray → StyleMedium + color
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleWhite;
+#pragma clang diagnostic pop
 #else // [macOS
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleMedium;
         self.color = [UIColor whiteColor];
@@ -52,11 +56,15 @@ - (void)hrv_setPropWithKey:(NSString * _Nonnull)propKey propValue:(id _Nonnull)p
 - (void)setCss_style:(NSString *)css_style {
     _css_style = css_style;
 #if !TARGET_OS_OSX // [macOS]
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIActivityIndicatorViewStyleWhite/Gray → StyleMedium + color
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     if ([css_style isEqualToString:@"white"]) {
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleWhite;
     } else {
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleGray;
     }
+#pragma clang diagnostic pop
 #else // [macOS
     // macOS: Use color property instead of style to set white/gray appearance
     if ([css_style isEqualToString:@"white"]) {
```

**File**: `core-render-ios/Extension/AdvancedComps/KRModalView.m` (modified, +4/-0)
```diff
@@ -42,7 +42,11 @@ - (void)didMoveToSuperview {
 #if !TARGET_OS_OSX // [macOS]
     if (self.superview && ![self.superview isKindOfClass:[UIWindow class]]) {
        
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.keyWindow → UIWindowScene.windows 取 isKeyWindow
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
+#pragma clang diagnostic pop
         if (keyWindow) {
             [self removeFromSuperview];
             
```

**File**: `core-render-ios/Extension/Category/KRConvertUtil.m` (modified, +12/-1)
```diff
@@ -665,7 +665,11 @@ + (void)hr_alertWithTitle:(NSString *)title message:(NSString *)message {
 + (NSString *)hr_md5StringWithString:(NSString *)string {
     const char *cstr = [string UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，需核对按长度解析的调用方；需同步处理 PAG / APNG 缓存文件兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X",
             result[0], result[1], result[2], result[3],
@@ -688,7 +692,11 @@ + (CGFloat)statusBarHeight {
             }
         }
         if (!statusBarHeight) {
+            // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.statusBarFrame → UIWindowScene.statusBarManager.statusBarFrame
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
             statusBarHeight = UIApplication.sharedApplication.statusBarFrame.size.height;
+#pragma clang diagnostic pop
         }
     }
     if (@available(iOS 16.0, *)) {
@@ -807,8 +815,11 @@ + (UIWindow *)keyWindow {
         }
 
     } else {
-        // iOS 13 以下使用旧的 API
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.keyWindow → UIWindowScene.windows 取 isKeyWindow
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         keyWindow = UIApplication.sharedApplication.keyWindow;
+#pragma clang diagnostic pop
     }
     // 未获取到交互scene 或者 未找到Keywindow，则直接返回nil，准备使用全零的safeAreaInsets
     return keyWindow;
```

**File**: `core-render-ios/Extension/Category/NSObject+KR.m` (modified, +8/-0)
```diff
@@ -275,7 +275,11 @@ - (NSString *)kr_appendUrlEncodeWithParam:(NSDictionary *)param {
 - (NSString *)kr_md5String {
     const char *cstr = [self UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，kr_md5String32 等按 32 字符解析处需一并核对；需同步处理缓存 / 签名兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X",
             result[0], result[1], result[2], result[3],
@@ -288,7 +292,11 @@ - (NSString *)kr_md5String {
 - (NSString *)kr_md5String32 {
     const char *cstr = [self UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，kr_md5String32 等按 32 字符解析处需一并核对；需同步处理缓存 / 签名兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x",
             result[0], result[1], result[2], result[3],
```

**File**: `core-render-ios/Extension/Category/UIView+CSS.m` (modified, +4/-0)
```diff
@@ -1973,7 +1973,11 @@ - (BOOL)performKeyFrameAnimationsWithCompletion:(void (^)(BOOL finished))complet
             [animations enumerateObjectsUsingBlock:^(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
                 dispatch_block_t block = obj;
                 if (!self.isNativeV2) {
+                    // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIView.setAnimationCurve: → block-based animation API
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
                     [UIView setAnimationCurve:animationCurve]; // 设置动画曲线
+#pragma clang diagnostic pop
                 }
                 block();
             }];
```

---

### Incident Patch 3: `78b11da6` (2026-09-21)
**Commit Message**: fix(h5): fix h5 jsValueToKotlin outlinedJsCode error for kotlin 1.9.22

**File**: `core-render-web/h5/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/runtime/web/expand/JSHelper.kt` (modified, +38/-14)
```diff
@@ -34,6 +34,34 @@ fun createSizeI(width: Int, height: Int): SizeI = Pair(width, height)
 @JsName("emptyList")
 fun emptyListForJs(): List<Any> = emptyList()
 
+/**
+ * Internal helpers wrapping raw `js(...)` calls.
+ *
+ * IMPORTANT: Do NOT inline `js(...)` blocks inside functions annotated with
+ * `@JsExport`. Kotlin/JS 1.9.22 has a known code-gen bug: when an exported
+ * function body contains multiple `js(...)` blocks, the compiler outlines
+ * them into a helper (e.g. `jsValueToKotlin$outlinedJsCode$`) but sometimes
+ * DCE's the helper definition while still emitting the module-level export
+ * assignment referencing it, producing runtime `ReferenceError:
+ * jsValueToKotlin$outlinedJsCode$ is not defined` when the bundle loads.
+ *
+ * Wrapping each `js(...)` block in a private, non-`@JsExport` function keeps
+ * exported function bodies free of raw `js(...)` and avoids the outlining
+ * path entirely.
+ */
+private fun newEmptyJsObject(): dynamic = js("({})")
+
+private fun isJsArray(value: dynamic): Boolean = js("Array.isArray(value)").unsafeCast<Boolean>()
+
+private fun jsObjectOwnKeys(value: dynamic): Array<String> =
+    js("Object.keys(value)").unsafeCast<Array<String>>()
+
+private fun hasImageProcessorRequiredMethods(jsProcessor: dynamic): Boolean {
+    return jsTypeOf(jsProcessor.getImageAssetsSource) == "function" &&
+        jsTypeOf(jsProcessor.isSVGFilterSupported) == "function" &&
+        jsTypeOf(jsProcessor.applyTintColor) == "function"
+}
+
 /**
  * Convert a JS object to a Kotlin Map.
  *
@@ -49,7 +77,7 @@ fun jsObjectToMap(jsObject: Any?, keys: Array<String> = emptyArray()): MutableMa
     return if (converted is MutableMap<*, *>) {
         converted.unsafeCast<MutableMap<String, Any?>>()
     } else {
-        FastMutableMap<String, Any?>(js("({})"))
+        FastMutableMap<String, Any?>(newEmptyJsObject())
     }
 }
 
@@ -69,6 +97,10 @@ fun jsArrayToList(jsArray: Array<Any?>): List<Any?> {
  * - JS Object => Kotlin MutableMap<String, Any?>
  * - JS Array  => Kotlin List<Any?>
  * - Primitive => unchanged
+ *
+ * NOTE: All `js(...)` blocks are intentionally delegated to the private
+ * helpers above to avoid a Kotlin/JS 1.9.22 code-gen bug on `@JsExport`
+ * functions (see comment on `newEmptyJsObject`).
  */
 @JsExport
 @JsName("jsValueToKotlin")
@@ -78,19 +110,17 @@ fun jsValueToKotlin(value: Any?): Any? {
     }
 
     val dynamicValue = value.asDynamic()
-    val jsType = js("typeof dynamicValue") as String
-    if (jsType != "object") {
+    if (jsTypeOf(dynamicValue) != "object") {
         return value
     }
 
-    val isArray = js("Array.isArray(dynamicValue)") as Boolean
-    if (isArray) {
+    if (isJsArray(dynamicValue)) {
         val arrayValue = dynamicValue.unsafeCast<Array<Any?>>()
         return jsArrayToList(arrayValue)
     }
 
-    val map = FastMutableMap<String, Any?>(js("({})"))
-    val keys = js("Object.keys(dynamicValue)").unsafeCast<Array<String>>()
+    val map = FastMutableMap<String, Any?>(newEmptyJsObject())
+    val keys = jsObjectOwnKeys(dynamicValue)
     keys.forEach { key ->
         map[key] = jsValueToKotlin(dynamicValue[key])
     }
@@ -135,13 +165,7 @@ fun setImageProcessor(imageProcessor: Any?): Boolean {
     }
 
     val jsProcessor = imageProcessor.asDynamic()
-    val hasRequiredMethods = js(
-        "typeof jsProcessor.getImageAssetsSource === 'function'" +
-            " && typeof jsProcessor.isSVGFilterSupported === 'function'" +
-            " && typeof jsProcessor.applyTintColor === 'function'"
-    ) as Boolean
-
-    if (!hasRequiredMethods) {
+    if (!hasImageProcessorRequiredMethods(jsProcessor)) {
         return false
     }
 
```

---

### Incident Patch 4: `914e194c` (2026-09-20)
**Commit Message**: fix(h5): fix expand anim auto collapse bug

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/css/animation/KRCSSPlainAnimationHandler.kt` (modified, +15/-7)
```diff
@@ -6,6 +6,7 @@ import com.tencent.kuikly.core.render.web.collection.map.set
 import com.tencent.kuikly.core.render.web.ktx.Frame
 import com.tencent.kuikly.core.render.web.const.KRCssConst
 import com.tencent.kuikly.core.render.web.ktx.kuiklyAnimation
+import com.tencent.kuikly.core.render.web.ktx.kuiklyWindow
 import com.tencent.kuikly.core.render.web.ktx.toPercentage
 import com.tencent.kuikly.core.render.web.ktx.toRgbColor
 import org.w3c.dom.HTMLElement
@@ -90,18 +91,25 @@ class KRCSSPlainAnimationHandler(
                 KRCssConst.FRAME -> {
                     val frameValue = value.unsafeCast<Frame>()
                     // Guard against stale animation entries: if the animation transitioned normally,
-                    // by the time transitionend fires the style.left/top/width/height already equal
+                    // by the time transitionend fires the effective left/top/width/height already equal
                     // the finalValue. If they differ by more than a small threshold, this handler is
                     // a stale residue (e.g. its element was off-screen so transitionend never fired
                     // for this animation, and a later transitionend consumed the wrong queue entry).
                     // Writing the outdated finalValue would clobber the correct current style set by
                     // a newer animation. Skip in that case.
-                    val style = target?.style
-                    if (style != null) {
-                        val curLeft = style.left.removeSuffix("px").toDoubleOrNull()
-                        val curTop = style.top.removeSuffix("px").toDoubleOrNull()
-                        val curWidth = style.width.removeSuffix("px").toDoubleOrNull()
-                        val curHeight = style.height.removeSuffix("px").toDoubleOrNull()
+                    val currentTarget = target
+                    val style = currentTarget?.style
+                    if (style != null && currentTarget != null) {
+                        val computed = kuiklyWindow.getComputedStyle(currentTarget)
+                        fun readPx(primary: String?, fallback: String?): Double? {
+                            return primary?.removeSuffix("px")?.toDoubleOrNull()
+                                ?: fallback?.removeSuffix("px")?.toDoubleOrNull()
+                        }
+
+                        val curLeft = readPx(computed.left, style.left)
+                        val curTop = readPx(computed.top, style.top)
+                        val curWidth = readPx(computed.width, style.width)
+                        val curHeight = readPx(computed.height, style.height)
                         val threshold = 1.0
                         val isStale = (curLeft != null && kotlin.math.abs(curLeft - frameValue.x) > threshold) ||
                             (curTop != null && kotlin.math.abs(curTop - frameValue.y) > threshold) ||
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/demo/FrameStaleDropdownPage.kt` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.demo
+
+import com.tencent.kuikly.core.annotations.Page
+import com.tencent.kuikly.core.base.Animation
+import com.tencent.kuikly.core.base.Color
+import com.tencent.kuikly.core.base.ViewBuilder
+import com.tencent.kuikly.core.reactive.handler.observable
+import com.tencent.kuikly.core.views.Text
+import com.tencent.kuikly.core.views.View
+import com.tencent.kuikly.demo.pages.base.BasePager
+import com.tencent.kuikly.demo.pages.demo.base.NavBar
+
+@Page("FrameStaleDropdownPage")
+internal class FrameStaleDropdownPage : BasePager() {
+
+    private var expanded by observable(false)
+    private var toggleSeq by observable(0)
+    private var statusText by observable("Ready. Tap button to expand from 0px to 212px.")
+
+    override fun body(): ViewBuilder {
+        val ctx = this
+        return {
+            NavBar {
+                attr {
+                    title = "Frame Stale Repro"
+                }
+            }
+
+            View {
+                attr {
+                    flex(1f)
+                    backgroundColor(Color(0xFFF5F6FA))
+                    padding(16f)
+                }
+
+                Text {
+                    attr {
+                        text("Repro target: dropdown height animation 0px -> 212px")
+                        fontSize(14f)
+                        color(Color(0xFF333333))
+                    }
+                }
+
+                Text {
+                    attr {
+                        marginTop(8f)
+                        text("In H5 with stale-check enabled, first expand may flash and collapse after transitionend.")
+                        fontSize(12f)
+                        color(Color(0xFF666666))
+                    }
+                }
+
+                View {
+                    attr {
+                        marginTop(16f)
+                        padding(left = 12f, top = 10f, right = 12f, bottom = 10f)
+                        backgroundColor(Color(0xFF1677FF))
+                        borderRadius(8f)
+                    }
+                    event {
+                        click {
+                            ctx.expanded = !ctx.expanded
+                            ctx.toggleSeq++
+                            ctx.statusText = if (ctx.expanded) {
+                                "Expanding to 212px (toggle #${ctx.toggleSeq})"
+                            } else {
+                                "Collapsing to 0px (toggle #${ctx.toggleSeq})"
+                            }
+                        }
+                    }
+
+                    Text {
+                        attr {
+                            text(if (ctx.expanded) "Collapse" else "Expand")
+                            color(Color.WHITE)
+                            fontSize(14f)
+                        }
+                    }
+                }
+
+                View {
+                    attr {
+                        marginTop(12f)
+                        width(320f)
+                        height(if (ctx.expanded) 212f else 0f)
+                        backgroundColor(Color.WHITE)
+                        borderRadius(10f)
+                        overflow(true)
+                        animate(
+                     
```

---

### Incident Patch 5: `b132ea70` (2026-09-20)
**Commit Message**: fix(ios): implicit animation issue during border scaling (#1749)

fix(ios): implicit animation issue during border scaling (#1749)

**File**: `core-render-ios/Extension/Category/UIView+CSS.m` (modified, +11/-0)
```diff
@@ -837,6 +837,10 @@ - (void)setCss_frame:(NSValue *)css_frame {
 }
 
 - (void)p_boundsDidChanged {
+    // 圆角 / clipPath mask 也是手动挂上去的独立 CAShapeLayer（CSSShapeLayer 在 setFrame: 里同步重算 path），
+    // 同样不享受 UIView backing layer 的隐式动画屏蔽，属性变更会走 CA 默认的 0.25s，这里统一禁掉
+    [CATransaction begin];
+    [CATransaction setDisableActions:YES];
     [self.layer.mask setFrame:self.bounds];
     if (self.layer.shadowPath) {
         // 如果存在 clipPath，shadowPath 应该使用 clipPath 的路径
@@ -861,6 +865,7 @@ - (void)p_boundsDidChanged {
             #endif // [macOS]
         }
     }
+    [CATransaction commit];
 }
 
 /// 对齐安卓圆角最大为半圆
@@ -1575,6 +1580,10 @@ - (void)setNeedsRedraw {
  */
 - (void)layoutSublayers {
     [super layoutSublayers];
+    // 边框 layer 是手动 addSublayer 的独立 CAShapeLayer，属性变更默认会带 0.25s 的隐式动画，
+    // 这里统一禁用，让边框与内容在同一帧到位
+    [CATransaction begin];
+    [CATransaction setDisableActions:YES];
     
     // 0. macOS: 确保边框在最顶层（NSScrollView/NSTextView 内部 sublayer 可能覆盖边框）
 #if TARGET_OS_OSX
@@ -1596,6 +1605,7 @@ - (void)layoutSublayers {
     // 2. 尺寸未变化时跳过重绘（性能优化）或者重绘标志位为false
     // 仅在 clipPath 变化时为 YES）
     if (CGSizeEqualToSize(self.bounds.size, _lastSize) && !_needsRedraw) {
+        [CATransaction commit];
         return ;
     }
     _lastSize = self.bounds.size;
@@ -1661,6 +1671,7 @@ - (void)layoutSublayers {
     #else
     self.path = path.CGPath;
     #endif
+    [CATransaction commit];
 }
 
 @end
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/debug/BugReproBorderImplicitAnimationPage.kt` (added, +327/-0)
```diff
@@ -0,0 +1,327 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.debug
+
+import com.tencent.kuikly.core.annotations.Page
+import com.tencent.kuikly.core.base.Border
+import com.tencent.kuikly.core.base.BorderStyle
+import com.tencent.kuikly.core.base.Color
+import com.tencent.kuikly.core.base.ViewBuilder
+import com.tencent.kuikly.core.base.ViewContainer
+import com.tencent.kuikly.core.reactive.handler.observable
+import com.tencent.kuikly.core.timer.setTimeout
+import com.tencent.kuikly.core.views.List
+import com.tencent.kuikly.core.views.Text
+import com.tencent.kuikly.core.views.View
+import com.tencent.kuikly.demo.pages.base.BasePager
+import com.tencent.kuikly.demo.pages.demo.base.NavBar
+
+/**
+ * iOS 边框隐式动画复现页（border + 变更 frame）
+ *
+ * 现象：同一个 View 实例声明 border 后，只要改变它的 frame（size），iOS 上背景/内容与边框不同帧跳变，
+ *      边框会带着一段约 0.25s 的隐式动画"滑"到新位置；胶囊形态下上下边框的粗细会在过程中不一致，
+ *      看起来像边框在蠕动（业务截图即该现象）。
+ *
+ * 框架侧可疑点（core-render-ios/Extension/Category/UIView+CSS.m）：
+ * 1. CSSBorderLayer.layoutSublayers(:1576) 中同步 frame(:1593)、重设 path(:1662)、
+ *    lineWidth(:1634) 全部没有 CATransaction 保护；同文件的 CSSGradientLayer.layoutSublayers(:1439)
+ *    与 CSSBorderLayer 的 macOS 分支(:1582) 都有 [CATransaction setDisableActions:YES]。
+ * 2. CSSBorderLayer 是手动 addSublayer 到 view.layer 上的独立 CAShapeLayer(:447)，
+ *    不享受 UIView backing layer（backing layer 的隐式动画被 UIKit 屏蔽）的待遇。
+ * 3. setCss_frame(:801) 只在「已有 animationKeys 且 transform 非 identity」分支里用
+ *    performWithoutAnimation / setDisableActions，普通路径(:834) 直接 setFrameBlock()。
+ *
+ * 观测方法（本页 4 个 case 共用同一个 expanded 状态，方便一次切换同时对比）：
+ * - Case 1 圆角矩形：看边框是否与白色背景同帧跳变（正常应为瞬变，异常为 0.25s 缓动滑移）。
+ * - Case 2 胶囊：圆角随高度变化，最接近业务截图，重点看上下边框粗细中途是否不对称。
+ * - Case 3 业务同款：胶囊 + 小幅纵向变化 + 1pt 级边框，重点看上下粗细蠕动。
+ * - Case 4 对照组：不使用 border 属性，用嵌套 View 模拟描边，应始终与背景同帧跳变。
+ *
+ * 说明：本页只覆盖「无动画直接改 frame」的隐式动画场景；业务声明 animate 的显式动画场景
+ *      属于另一条链路，暂不在本页验证。
+ */
+@Page("BugReproBorderImplicitAnimationPage")
+internal class BugReproBorderImplicitAnimationPage : BasePager() {
+
+    /** false = 收起态，true = 展开态 */
+    private var expanded by observable(false)
+
+    /** 自动循环切换，便于肉眼/录屏观察；进入页面即开启，可用「重置」停止 */
+    private var autoLoop by observable(true)
+
+    /** 循环是否真的切换过至少一次（用于判断 pageDidAppear 是否需要补调度） */
+    private var loopToggled = false
+
+    override fun created() {
+        super.created()
+        scheduleAutoLoop()
+    }
+
+    override fun pageDidAppear() {
+        super.pageDidAppear()
+        // Android 上 created 阶段 setTimeout 尚未生效，页面出现后若循环还没跑起来则补一次调度
+        if (autoLoop && !loopToggled) {
+            scheduleAutoLoop()
+        }
+    }
+
+    override fun pageDidDisappear() {
+        super.pageDidDisappear()
+        autoLoop = false
+    }
+
+    override fun body(): ViewBuilder {
+        val ctx = this
+        return {
+            attr {
+                flexDirectionColumn()
+                backgroundColor(Color(0xFFF2F3F5L))
+            }
+            NavBar {
+                attr {
+                    title = "iOS Border 隐式动画复现"
+                }
+            }
+            List {
+                attr {
+                    flex(1f)
+                }
+
+                View {
+                    attr {
+                        padding(all = 12f)
+                        flexDirectionColumn()
+                    }
+ 
```

---

### Incident Patch 6: `93ab53a3` (2026-09-19)
**Commit Message**: fix(web): 修复单行 textOverFlowTail 不显示省略号

KRRichTextView.setLineBreakMode 在 numberOfLines > 0 时提前返回，lines(1) + textOverFlowTail() 不会设置 overflow hidden，text-overflow: ellipsis 在 overflow 为 visible 时不生效，文本直接溢出。改为 > 1 后单行走 tail 分支设置 overflow/nowrap/ellipsis，多行仍由 -webkit-line-clamp 处理。

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/components/KRRichTextView.kt` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ class KRRichTextView : IKuiklyRenderViewExport, IKuiklyRenderShadowExport {
      * Set text wrapping mode
      */
     private fun setLineBreakMode(lineBreakMode: String) {
-        if (this.numberOfLines > 0) {
+        if (this.numberOfLines > 1) {
             return
         }
         when (lineBreakMode) {
```

---

### Incident Patch 7: `c985faa0` (2026-09-18)
**Commit Message**: fix(iOS): keep text alignment when rebuilding attributedText in KRTextAreaView (#1745)

* fix(iOS): keep text alignment when rebuilding attributedText in KRTextAreaView

- Reapply paragraph style at all attributedText rebuild paths (textInputState, paste, textPostProcessor, lineHeight)
- Sync typingAttributes so newly typed text keeps the current alignment
- Add TextAreaTextAlignBugDemo covering Left/Center/Right alignment

* fix(iOS): avoid rebuilding attributedText during IME composition in KRTextAreaView

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

---------

Signed-off-by: valoxbwang <valoxbwang@tencent.com>

**File**: `core-render-ios/Extension/Components/KRTextAreaView.m` (modified, +53/-5)
```diff
@@ -201,10 +201,7 @@ - (void)updateLineHeightIfApplicable {
     UIFont* font = self.font ?: [UIFont systemFontOfSize:16];
     NSMutableAttributedString *attrStr = [[NSMutableAttributedString alloc] initWithAttributedString:self.attributedText ?:
                                          [[NSAttributedString alloc] initWithString:self.text ?: @""]];
-    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
-    paragraphStyle.minimumLineHeight = [_css_lineHeight floatValue];
-    paragraphStyle.maximumLineHeight = [_css_lineHeight floatValue];
-    paragraphStyle.lineSpacing = ceil(0.2 * _css_fontSize.floatValue);
+    NSMutableParagraphStyle *paragraphStyle = [self p_buildCurrentParagraphStyle];
 
     NSRange range = NSMakeRange(0, attrStr.length);
     [attrStr addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:range];
@@ -219,6 +216,36 @@ - (void)updateLineHeightIfApplicable {
     self.typingAttributes = typingAttrs;
 }
 
+/// 构造反映当前 textAlignment（及已设置 lineHeight）的 paragraph style，供重建路径复用。
+- (NSMutableParagraphStyle *)p_buildCurrentParagraphStyle {
+    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
+    paragraphStyle.alignment = self.textAlignment;
+    if (_css_lineHeight.floatValue > FLT_EPSILON) {
+        paragraphStyle.minimumLineHeight = [_css_lineHeight floatValue];
+        paragraphStyle.maximumLineHeight = [_css_lineHeight floatValue];
+        paragraphStyle.lineSpacing = ceil(0.2 * _css_fontSize.floatValue);
+    }
+    return paragraphStyle;
+}
+
+/// 将当前段落样式整段应用到 attrStr，并同步 typingAttributes；后续新增任何重建
+/// attributedText 的路径都必须调用本方法，否则对齐会丢失。
+- (void)p_applyCurrentParagraphStyleToAttributedString:(NSMutableAttributedString *)attrStr {
+    NSMutableParagraphStyle *paragraphStyle = [self p_buildCurrentParagraphStyle];
+    if (attrStr.length > 0) {
+        [attrStr addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, attrStr.length)];
+    }
+    [self p_applyParagraphStyleToTypingAttributes:paragraphStyle];
+}
+
+/// 仅把段落样式写入 typingAttributes（不改内容）；仅覆盖 NSParagraphStyleAttributeName，
+/// 其余字段（如 lineHeight 路径写入的 font/baseline）保持不变。
+- (void)p_applyParagraphStyleToTypingAttributes:(NSParagraphStyle *)paragraphStyle {
+    NSMutableDictionary *typingAttrs = [self.typingAttributes mutableCopy] ?: [NSMutableDictionary dictionary];
+    typingAttrs[NSParagraphStyleAttributeName] = paragraphStyle;
+    self.typingAttributes = typingAttrs;
+}
+
 - (void)setCss_enablesReturnKeyAutomatically:(NSNumber *)flag{
     self.enablesReturnKeyAutomatically = [flag boolValue];
 }
@@ -282,6 +309,20 @@ - (void)setCss_editable:(NSNumber *)css_editable {
 
 - (void)setCss_textAlign:(NSString *)css_textAlign {
     self.textAlignment = [KRConvertUtil NSTextAlignment:css_textAlign];
+    // 空文本或拼音组词态：不整段重建，仅同步 typingAttributes，组词提交后自然生效。
+    if (self.attributedText.length == 0 || self.markedTextRange != nil) {
+        [self p_applyParagraphStyleToTypingAttributes:[self p_buildCurrentParagraphStyle]];
+        return;
+    }
+    // 对已有文本重新套用对齐，避免残留旧段落样式导致显示与当前设置不一致。
+    NSRange savedSelection = self.selectedRange;
+    NSMutableAttributedString *attrStr = [self.attributedText mutableCopy];
+    [self p_applyCurrentParagraphStyleToAttributedString:attrStr];
+    BOOL savedIgnore = _ignoreTextDidChanged;
+    _ignoreTextDidChanged = YES;
+    self.attributedText = attrStr;
+    self.selectedRange = savedSelection;
+    _ignoreTextDidChanged = savedIgnore;
 }
 
 - (void)setCss_fontSize:(NSNumber *)css_fontSize {
@@ -422,6 +463,7 @@ - (void)css_setTextInputState:(NSDictionary *)args {
         if (textColor) {
             [rawAttr addAttribute:NSForegroundColorAttributeName value:textColor range:NSMakeRange(0, rawAttr.length)];
         }
+        [self p_applyCurrentParagraphStyleToAttributedString:rawAttr];
         self.attributedText = rawAttr;
         [self p_updatePlaceholder];
     }
@@ -773,6 +815,7 @@ - (v
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/compose/ComposeAllSample.kt` (modified, +1/-0)
```diff
@@ -178,6 +178,7 @@ internal class ComposeAllSample : ComposeContainer() {
             DemoItem("TextFieldEmoji", "TextField 自定义表情示例（暂不支持鸿蒙）", "TextFieldEmojiDemo"),
             DemoItem("MoveableDrawer", "侧边栏组件示例（全屏/非全屏）", "MoveableDrawerDemo"),
             DemoItem("iOS键盘InputTextField", "业务侧 InputTextField iOS 键盘复现", "IosKeyboardInputTextFieldDemo"),
+            DemoItem("TextArea对齐Bug", "iOS BasicTextField 右/居中对齐点击输入后失效复现", "TextAreaTextAlignBugDemo"),
         )
 
     @Composable
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/compose/TextAreaTextAlignBugDemo.kt` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.compose
+
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import com.tencent.kuikly.compose.ComposeContainer
+import com.tencent.kuikly.compose.foundation.border
+import com.tencent.kuikly.compose.foundation.layout.Column
+import com.tencent.kuikly.compose.foundation.layout.fillMaxWidth
+import com.tencent.kuikly.compose.foundation.layout.height
+import com.tencent.kuikly.compose.foundation.layout.padding
+import com.tencent.kuikly.compose.foundation.text.BasicTextField
+import com.tencent.kuikly.compose.material3.Text
+import com.tencent.kuikly.compose.setContent
+import com.tencent.kuikly.compose.ui.Modifier
+import com.tencent.kuikly.compose.ui.graphics.Color
+import com.tencent.kuikly.compose.ui.text.TextStyle
+import com.tencent.kuikly.compose.ui.text.style.TextAlign
+import com.tencent.kuikly.compose.ui.unit.dp
+import com.tencent.kuikly.compose.ui.unit.sp
+import com.tencent.kuikly.core.annotations.Page
+
+/**
+ * 回归验证 iOS BasicTextField 设置 TextAlign.Right/Center 后，获焦或输入内容时对齐仍保持的能力。
+ * 验证：打开页面，点击「居中」「右对齐」输入框并输入，对齐应始终保持不回退左对齐。
+ */
+@Page("TextAreaTextAlignBugDemo")
+class TextAreaTextAlignBugDemo : ComposeContainer() {
+
+    override fun willInit() {
+        super.willInit()
+        setContent {
+            ComposeNavigationBar {
+                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
+                    Text("Left 对齐（预期：点击/输入后始终左对齐）")
+                    var textLeft by remember { mutableStateOf("Left 123456") }
+                    BasicTextField(
+                        value = textLeft,
+                        onValueChange = { textLeft = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Left),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+
+                    Text("Center 对齐（预期：点击/输入后始终居中）")
+                    var textCenter by remember { mutableStateOf("Center 123456") }
+                    BasicTextField(
+                        value = textCenter,
+                        onValueChange = { textCenter = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Center),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+
+                    Text("Right 对齐（预期：修复后点击/输入始终保持右对齐）")
+                    var textRight by remember { mutableStateOf("Right 123456") }
+                    BasicTextField(
+                        value = textRight,
+                        onValueChange = { textRight = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Right),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+                }
+            }
+        }
+    }
+}
```

---

### Incident Patch 8: `9a442a6c` (2026-09-14)
**Commit Message**: fix(ohos): resolve safeArea/deviceWidth data mismatch and freeze on rotation (#1721)

* fix(ohos): fix safeArea/deviceWidth data mismatch and freeze on rotation

- Sync windowRect on windowSizeChange and deliver deviceWidth/Height with
  rotation, fixing Compose screenWidthDp/screenHeightDp frozen at initial
  orientation
- Make safeArea ready synchronously without notify in windowSizeChange,
  eliminating the setTimeout(0) race against onAreaChange
- Add resolveSafeAreaInsets correction: rotation mode subtracts axis delta,
  split-screen mode drops injected side by 25% threshold, zero-bottom
  frames fall back to last reliable value
- Pre-update viewRect in onSizeChange (layout-before callback) to close
  the mismatch window
- One-line rationale log per fix (Rotation tag), zero noise on correct
  frames

Backport of ComposeOnKuikly a094be7c1

* fix(ohos): replace ratio-based safeArea correction with deterministic checks

- Replace the 25% fraction heuristic with an orientation-consistency check
  (core): when viewRect and windowRect axes mismatch, the viewRect-safeArea
  subtraction carries the axis delta by construction, so reuse the last
  trusted insets instead of guessing from

**File**: `core-render-ohos/src/main/ets/KRNativeRenderController.ets` (modified, +154/-13)
```diff
@@ -100,6 +100,11 @@ enum KRBackPressConsumedState {
   NotConsumed
 }
 
+/** safeArea 纠偏：浮点尺寸比较容差（dp） */
+const KRSafeAreaMatchToleranceDp = 1.0;
+/** safeArea 纠偏：变化量等式判定容差（dp） */
+const KRSafeAreaDeltaEps = 0.1;
+
 /** 全局递增实例ID */
 let gGlobalInstanceId = 0;
 
@@ -140,6 +145,16 @@ export class KRNativeRenderController {
    * SizeChanged 执行时机是否需提前至 onSizeChanged 而非 onAreaChanged，以避免页面 Size 变化时出现白屏
    */
   private sizeChangeHandledByOnSizeChange: boolean = false;
+  /** 上一帧窗口尺寸：突变帧注入检测（判据B）需要窗口变化量 */
+  private prevWindowRect: KRRect | null = null;
+  /** 上一帧 safeAreaRect：判据B的还原基准（稳态帧不会被注入，天然可靠） */
+  private lastSafeAreaRect: KRRect | null = null;
+  /** lastSafeAreaRect 入库时的窗口尺寸：rect 是绝对坐标，解构侧值必须用它自己同朝向的窗口，否则产生假侧值 */
+  private lastSafeAreaWinRect: KRRect | null = null;
+  /** 最近一次「viewRect 与 windowRect 同朝向」时换算出的 insets（判据A兜底值） */
+  private lastTrustedInsets: string | null = null;
+  /** viewRect 是否已跟随当前窗口重新测量：false = 窗口已变而页面未量完（判据A的拦截条件） */
+  private viewSyncedByWindow: boolean = true;
 
   private lifecycleCallbacks: Array<IKuiklyRenderViewLifecycleCallback> = [];
 
@@ -178,8 +193,16 @@ export class KRNativeRenderController {
     const w = params.width / density;
     const h = params.height / density;
 
+    // windowRect 是 deviceWidth/Height 唯一数据源，必须跟随窗口更新，否则旋转后 Compose 屏幕尺寸冻结；
+    // prevWindowRect 保留旧值，供判据B计算窗口变化量
+    this.prevWindowRect = this.windowRect;
+    this.windowRect = new KRRect(0, 0, w, h);
+    // 窗口已变而页面尚未重新测量，viewRect 旧尺寸作废（判据A拦截条件），等布局回调重新确认
+    this.viewSyncedByWindow = false;
+
     this.notifyWindowSizeChanged(w, h);
-    this.doUpdateSafeArea();
+    // 同步刷新 safeArea（不走 setTimeout），避免与布局回调竞争产生「旧 viewRect − 新 safeAreaRect」错配
+    this.refreshSafeAreaSync();
   };
   private avoidAreaListener: Callback<AvoidAreaChangeParams> = (params: AvoidAreaChangeParams) => {
     if (this.imeMode) {
@@ -192,6 +215,90 @@ export class KRNativeRenderController {
     }
   };
 
+  /**
+   * 同步刷新 safeAreaRect 但不下发：让 safeAreaRect 与 windowRect 同帧就绪，
+   * 消除 setTimeout(0) 与布局回调的时序竞争，等 viewRect 同朝向后由布局链路统一下发。
+   */
+  private refreshSafeAreaSync(): void {
+    if (this.imeMode || this.windowClass == null) {
+      return;
+    }
+    // 同步已取到最新值，取消排队中的去抖任务，避免稍后重复赋值
+    if (this.updateSafeInsetsHandler > 0) {
+      clearTimeout(this.updateSafeInsetsHandler);
+      this.updateSafeInsetsHandler = 0;
+    }
+    try {
+      const synced = this.getSafeAreaRect(this.windowClass);
+      // 判据B已下沉到 onSafeAreaInsetsChanged 入库口统一验货，此处不再单独调用
+      this.onSafeAreaInsetsChanged(synced, false, 'windowSizeChange');
+    } catch (e) {
+      KRRenderLog.e('Window', `Error obtaining safearea, code:${e.code}`);
+    }
+  }
+
+  /** 将 safeAreaRect（x/y/width/height）按给定窗口尺寸换算为 [top,left,bottom,right] 侧值 */
+  private sideInsetsOf(rect: KRRect, winW: number, winH: number): number[] {
+    const sides: number[] = [0, 0, 0, 0];
+    sides[0] = rect.y;
+    sides[1] = rect.x;
+    sides[2] = winH - rect.y - rect.height;
+    sides[3] = winW - rect.x - rect.width;
+    return sides;
+  }
+
+  /**
+   * 判据B（兜底）：注入的机理是系统把「窗口尺寸变化量」错塞进 safeArea，故注入侧必满足
+   * |本帧侧值−上帧侧值| == |本帧窗口−上帧窗口|（同轴，0.1dp）——基于 bug 机理而非数值分布判定，无比例假设。
+   * 注意：prevWindowRect 只在窗口突变帧轮换，故一次旋转后到下次旋转前本判据持续处于激活态；
+   * 稳态帧依靠 oldSides/newSides 同坐标系比较（sideDelta≈0）放行，不会误伤。
+   * 已知边界：真实避让变化量与窗口变化量恰好精确等值（±0.1dp）的巧合会被误退一帧，概率极低，作为机理层残留风险保留。
+   */
+  private correctInjectedSafeArea(newRect: KRRect, source: string): KRRect {
+    const prevWin = this.prevWindowRect;
+    const curWin = this.windowRect;
+    const prevSafe = this.lastSafeAreaRect;
+    const prevSafeWin = this.lastSafeAreaWinRect;
+    if (prevWin == null || curWin == null || prevSafe == null || prevSafeWin == null) {
+      // 首帧无从比较，直接入库并登记其所属窗口尺寸
+      this.lastSafeAreaRect = newRect;
+      this.lastSafeAreaWinRect = curWin != null
+        ? new KRRect(curWin.x, curWin.y, curWin.width, curWin.height) : null;
+      return newRect;
+    }
+    const deltaW = Math.abs(curWin.width - prevWin.width);
+    cons
```

---

### Incident Patch 9: `acffe1be` (2026-09-14)
**Commit Message**: fix(compose): release Lazy exact contentSize pin after programmatic jump (#1741)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/scroller/ContentSizeExtensions.kt` (modified, +6/-1)
```diff
@@ -67,8 +67,13 @@ internal fun ScrollableState.calculateContentSize(): Int {
         // lastItem.offset is viewport-relative. After a fling reaches the last item,
         // a stale offset can inflate contentSize and skip native bounce.
         // Measure clears the pin when layout actually changes.
+        // After a programmatic jump, composeOffset can already exceed the pinned size;
+        // that pin is stale and must be released. At the true end, composeOffset is
+        // clamped to exact-viewport, so it never exceeds previousExact and the pin holds.
         if (previousExact != null && exact > previousExact && this.isLazyListOrGrid()) {
-            exact = previousExact
+            if (kuiklyInfo.composeOffset.toInt() <= previousExact) {
+                exact = previousExact
+            }
         }
         kuiklyInfo.realContentSize = exact
         return exact
```

---

### Incident Patch 10: `9197b070` (2026-09-12)
**Commit Message**: fix(h5): fix conflict of parent drag and child click (#1739)

* fix(h5): fix conflict of parent drag and child click

* fix(h5): only support single-pointer mode

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/components/KRView.kt` (modified, +70/-10)
```diff
@@ -98,6 +98,13 @@ open class KRView : IKuiklyRenderViewExport {
     private var isBindTouchEvent = false
     // Whether mouse is currently pressed (for PC browser support)
     private var isMouseDown = false
+    // Pointer drag start position (relative to current element)
+    private var pointerDownX = 0f
+    private var pointerDownY = 0f
+    // Pointer currently tracked by this view
+    private var activePointerId: Int? = null
+    // Whether current pointer has been captured
+    private var isPointerCaptured = false
     // Current device type (detected once and cached)
     private val deviceType: DeviceType by lazy { DeviceUtils.detectDeviceType() }
     // Pan event callback
@@ -663,19 +670,15 @@ open class KRView : IKuiklyRenderViewExport {
     private fun bindPointerEvents() {
         // Pointer down
         ele.addEventListener("pointerdown", { rawEvent ->
+            // Single-pointer mode: ignore any additional fingers/pointers while one is active.
+            if (isMouseDown) return@addEventListener
+
             val mouseLike = rawEvent.unsafeCast<MouseEvent>()
-            // Capture pointer so we keep receiving move/up even if the finger /
-            // cursor leaves the element bounds during a drag.
-            val pointerId = rawEvent.asDynamic().pointerId
-            if (pointerId != null) {
-                try {
-                    ele.asDynamic().setPointerCapture(pointerId)
-                } catch (_: Throwable) {
-                    // Some environments may throw if pointerId is invalid; ignore.
-                }
-            }
 
             isMouseDown = true
+            isPointerCaptured = false
+            activePointerId = rawEvent.asDynamic().pointerId.unsafeCast<Int?>()
+
             val eventParams = mouseLike.toPanEventParams()
             val position = ele.getBoundingClientRect()
             eleX = position.left.toFloat()
@@ -685,6 +688,9 @@ open class KRView : IKuiklyRenderViewExport {
                 fastMutableMapOf<String, Any>().apply { putAll(eventParams) },
                 KRStateConst.START
             )
+            // Record pointer down position and defer pointer capture until drag confirmed.
+            pointerDownX = x
+            pointerDownY = y
             params = setSuperTouchEventParams(
                 params, rawEvent.timeStamp.toLong(), KRActionConst.TOUCH_DOWN
             )
@@ -696,12 +702,34 @@ open class KRView : IKuiklyRenderViewExport {
         // Pointer move
         ele.addEventListener("pointermove", { rawEvent ->
             if (!isMouseDown) return@addEventListener
+            val pointerId = rawEvent.asDynamic().pointerId.unsafeCast<Int?>()
+            if (pointerId != activePointerId) {
+                return@addEventListener
+            }
+
             val mouseLike = rawEvent.unsafeCast<MouseEvent>()
             val eventParams = mouseLike.toPanEventParams()
             var params = getPanEventParams(
                 fastMutableMapOf<String, Any>().apply { putAll(eventParams) },
                 KRStateConst.MOVE
             )
+
+            // Defer pointer capture until movement exceeds drag threshold.
+            if (!isPointerCaptured && pointerId != null) {
+                val dx = x - pointerDownX
+                val dy = y - pointerDownY
+                val thresholdSq = POINTER_CAPTURE_DRAG_THRESHOLD_PX * POINTER_CAPTURE_DRAG_THRESHOLD_PX
+                val distanceSq = dx * dx + dy * dy
+                if (distanceSq >= thresholdSq) {
+                    try {
+                        ele.asDynamic().setPointerCapture(pointerId)
+                        isPointerCaptured = true
+                    } catch (_: Throwable) {
+                        // Some environments may throw if pointerId is invalid; ignore.
+                    }
+                }
+            }
+
             params = setSuperTouchEventParams(
                 params, rawEvent.timeStamp.toLong(), KRActionConst.TOUCH_MOVE
 
```

#### Recent Merged Pull Requests:
- **PR #1773** (closed): fix(android): center rich text line height on font ascent/descent (@bytemain)
- **PR #1772** (closed): fix(compose): serialize SpanStyle.fontFamily on rich text spans (@bytemain)
- **PR #1771** (closed): fix: render rich text span backgroundColor on Android, iOS and OHOS (@bytemain)
- **PR #1770** (closed): fix(miniapp): remove root transform to keep canvas same-layer rendering alive (@gclm)
- **PR #1764** (closed): fix(compose): skip orphan canvas reset when the view owns its draw loop (Compose 混用裸 reset 致画布空白) (@bytemain)
- **PR #1760** (2026-09-24): fix: preserve Android shadows beyond view bounds (@iPel)
- **PR #1759** (closed): fix(canvas): consume-then-clear draw op queue to fix reset white screen (@bytemain)
- **PR #1758** (2026-09-23): feat(demo): add chat bubble demo(左滑删除) (@elixxli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
