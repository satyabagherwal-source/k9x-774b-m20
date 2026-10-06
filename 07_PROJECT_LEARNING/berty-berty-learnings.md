# Forensic Learning Record (Deep Inspection): berty/berty

> **Canonical Artifact**: `07_PROJECT_LEARNING/berty-berty-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/berty/berty](https://github.com/berty/berty))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:46.467Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `berty/berty`
- **Description**: Berty is a secure peer-to-peer messaging app that works with or without internet access, cellular data or trust in the network
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 9312 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `berty-bridge-expo/android/src/main/java/tech/berty/bertybridgeexpo/LifecycleListener.kt`
```
package tech.berty.bertybridgeexpo

import android.app.Activity
import android.os.Bundle
import android.util.Log
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class LifecycleListener : ReactActivityLifecycleListener {
    override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        super.onDestroy(activity)

        state = AppState.FOREGROUND
        Log.i(TAG, "onCreate")
    }

    override fun onResume(activity: Activity) {
        super.onDestroy(activity)

        state = AppState.FOREGROUND
        Log.i(TAG, "onResume")
    }

    override fun onDestroy(activity: Activity?) {
        super.onDestroy(activity)

        state = AppState.BACKGROUND
        Log.i(TAG, "onDestroy")
    }

    override fun onPause(activity: Activity?) {
        super.onPause(activity)

        state = AppState.BACKGROUND
        Log.i(TAG, "onPause")
    }

    companion object {
        enum class AppState {
            BACKGROUND, FOREGROUND
        }

        const val TAG: String = "LifecycleListener"
        var state: AppState = AppState.BACKGROUND

        fun isForeground(): Boolean {
            return state == AppState.FOREGROUND
        }
    }
}

```

### Core Architecture Module: `berty-bridge-expo/android/src/main/java/tech/berty/bertybridgeexpo/LifecyclePackage.kt`
```
package tech.berty.bertybridgeexpo

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class LifecyclePackage : Package {
    override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
        return listOf(LifecycleListener())
    }
}

```

### Core Architecture Module: `berty-bridge-expo/example/grpc-bridge/rpc/utils.ts`
```
import base64 from 'base64-js'
import * as pb from 'protobufjs'

// methods
export const serializeToBase64 = (req: Uint8Array) => base64.fromByteArray(req)
export const deserializeFromBase64 = (b64: string) => new Uint8Array(base64.toByteArray(b64))

export const getServiceName = <T extends pb.Method>(method: T) => {
	const fullName = method.parent?.fullName
	if (fullName?.startsWith('.')) {
		return fullName.substring(1)
	}
	return fullName
}

// Error
export const ErrorStreamNotImplemented = new Error('stream method not implemented')
export const ErrorUnaryNotImplemented = new Error('unary method not implemented')

```

### Core Architecture Module: `berty-bridge-expo/ios/AppLifecycleDelegate.swift`
```
//
//  AppLifecycleDelegate.swift
//  Pods
//
//  Created by Rémi BARBERO on 07/11/2025.
//

import ExpoModulesCore
import Bertybridge

public class AppLifecycleDelegate: ExpoAppDelegateSubscriber {
    public func application(_ application: UIApplication,
                            didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushTokenRequester.shared.onRequestSucceeded(deviceToken)
    }

    public func application(_ application: UIApplication,
                            didFailToRegisterForRemoteNotificationsWithError
                            error: Error) {
        PushTokenRequester.shared.onRequestFailed(error)
    }
    
    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        LifeCycle.shared.registerBackgroundTask(identifier: "tech.berty.ios.task.gobridge-process")
        LifeCycle.shared.registerBackgroundTask(identifier: "tech.berty.ios.task.gobridge-refresh")
        
        return true
    }
    
    // Custom lifecycle handlers
    
    public func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        LifeCycle.shared.startBackgroundTask(cancelAfter: 25, completionHandler: completionHandler)
    }
    
    public func applicationDidEnterBackground(_ application: UIApplication) {
        LifeCycle.shared.scheduleBackgroundProcessing(identifier: "tech.berty.ios.task.gobridge-process")
        LifeCycle.shared.scheduleAppRefresh(identifier: "tech.berty.ios.task.gobridge-refresh")
        LifeCycle.shared.updateState(state: UIApplication.State.background)
    }
    
    public func applicationDidBecomeActive(_ application: UIApplication) {
        LifeCycle.shared.updateState(state: UIApplication.State.active)
    }
    
    public func applicationWillResignActive(_ application: UIApplication) {
        LifeCycle.shared.updateState(state: UIApplication.State.inactive)
    }
    
    public func applicationWillTerminate(_ application: UIApplication) {
        LifeCycle.shared.willTerminate()
    }
    
    public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        completionHandler(.newData)
    }
    
    // Push notifications
    public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo

        if let deepLink = userInfo["deepLink"] as? String,
           let url = URL(string: deepLink) {
            UIApplication.shared.open(url, options: [:]) { _ in
                completionHandler()
            }
            return
        }
        
        completionHandler();
    }
    
    public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if let payload = notification.request.content.userInfo[BertybridgeServicePushPayloadKey] as? String {
//                if let eventEmitter = EventEmitter.shared {
//                    // Send the payload to JS
//                    eventEmitter.sendEvent(withName: "onPushReceived", body: payload)
//                }
            }

            // Ignore push notif from here, JS will decide to display it or not
            completionHandler([])
    }
}

```

### Core Architecture Module: `berty-bridge-expo/ios/Sources/Bridge/LifeCycleDriver.swift`
```
//
//  LifeCycleDriver.swift
//  GoBridge
//
//  Created by Guilhem Fanton on 11/08/2020.
//  Copyright © 2020 Berty Technologies. All rights reserved.
//

import Foundation
import Bertybridge

public enum AppState {
    case background
    case inactive
    case active
}

public class LifeCycleDriver: NSObject, BertybridgeLifeCycleDriverProtocol {
    public static var shared: LifeCycleDriver = LifeCycleDriver()
    var handler: BertybridgeLifeCycleHandlerProtocol? = nil
    let logger: BertyLogger = BertyLogger("tech.berty.lifecycle")

    public func register(_ handler: BertybridgeLifeCycleHandlerProtocol?) {
        self.handler = handler
    }

    public func getCurrentState() -> Int {
        if (Thread.current.isMainThread) {
            return UIApplication.shared.applicationState.getBridgeState()
        }

        return BertybridgeAppStateUnknown
    }

    public func handleBackgroundTask() -> BertybridgeLifeCycleBackgroundTaskProtocol? {
        return self.handler?.handleTask()
    }

    public func updateState(state: UIApplication.State) {
        if let handler = self.handler {
            handler.handleState(state.getBridgeState())
        } else {
            self.logger.warn("no state handler set")
        }
    }

    public func willTerminate() {
        if let handler = self.handler {
            handler.willTerminate()
        } else {
            self.logger.warn("no state handler set")
        }
    }
}

extension UIApplication.State {
    func getBridgeState() -> Int {
        switch self {
        case .active:
            return BertybridgeAppStateActive
        case .background:
            return BertybridgeAppStateBackground
        case .inactive:
            return BertybridgeAppStateInactive
        default:
            return BertybridgeAppStateUnknown
        }
    }
}

```

### Core Architecture Module: `berty-bridge-expo/ios/Sources/LifeCycle.swift`
```
//
//  LifeCycle.swift
//  Berty Debug
//
//  Created by Guilhem Fanton on 08/01/2020.
//  Copyright © 2020 Berty Technologies. All rights reserved.
//

import UserNotifications
import Foundation
import BackgroundTasks
import UIKit

class LifeCycle: NSObject {
    static let shared: LifeCycle = LifeCycle()
    let logger: BertyLogger = BertyLogger("tech.berty.lifecycle")

    // Serial off-main queue for the blocking Bridge.HandleState calls (ordered, off the watchdog'd main thread).
    private let stateQueue = DispatchQueue(label: "tech.berty.lifecycle.state")

    @objc static func getSharedInstance() -> LifeCycle {
        return LifeCycle.shared
    }

    // Run a blocking lifecycle call off-main under a background-task assertion (iOS grants ~30s instead of ~5s).
    private func runOffMain(name: String, _ work: @escaping () -> Void) {
        var bgTaskID: UIBackgroundTaskIdentifier = .invalid
        bgTaskID = UIApplication.shared.beginBackgroundTask(withName: name) {
            if bgTaskID != .invalid {
                UIApplication.shared.endBackgroundTask(bgTaskID)
                bgTaskID = .invalid
            }
        }

        self.stateQueue.async {
            work()
            if bgTaskID != .invalid {
                UIApplication.shared.endBackgroundTask(bgTaskID)
                bgTaskID = .invalid
            }
        }
    }

    @available(iOS 13.0, *)
    @objc
    public func registerBackgroundTask(identifier: String) {
        self.logger.info("register background fetch task \(identifier)")
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { (task) in
            switch task {
            case is BGProcessingTask:
                self.scheduleBackgroundProcessing(identifier: identifier)
            case is BGAppRefreshTask:
                self.scheduleAppRefresh(identifier: identifier)
            default:
                break
            }

            self.handle(task: task)
        }
    }

    @available(iOS 13.0, *)
    func handle(task: BGTask) {
        guard let bgtask = LifeCycleDriver.shared.handleBackgroundTask() else {
            self.logger.error("unable to get handlers")
            task.setTaskCompleted(success: false)
            return
        }

        task.expirationHandler = {
            self.logger.info("handle expiracy")
            bgtask.cancel()
        }

        DispatchQueue.global(qos: .background).async {
            self.logger.info("starting background task")
            let success = bgtask.execute()
            DispatchQueue.main.async {
                self.logger.info("ending background with: success=\(success)")
                task.setTaskCompleted(success: success)
            }
        }
    }

    @available(iOS 13.0, *)
    @objc
    func scheduleAppRefresh(identifier: String) {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60)
        do {
            self.logger.info("scheduling app refresh")
            try BGTaskScheduler.shared.submit(request)
        } catch {
            self.logger.error("unable to submit task: \(error.localizedDescription)")
        }
    }

    @available(iOS 13.0, *)
    @objc
    func scheduleBackgroundProcessing(identifier: String) {
        let request = BGProcessingTaskRequest(identifier: identifier)
        request.requiresNetworkConnectivity = true
        do {
            self.logger.info("scheduling app processing")
            try BGTaskScheduler.shared.submit(request)
        } catch {
            self.logger.error("unable to submit task: \(error.localizedDescription)")
        }
    }

    @objc
    func startBackgroundTask(cancelAfter: Int, completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        guard let bgtask = LifeCycleDriver.shared.handleBackgroundTask() else {
            self.logger.error("unable to get handler")
            completionHandler(.noData)
            return
        }

        if cancelAfter > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(cancelAfter)) {
                bgtask.cancel()
            }
        }

        // `execute()` blocks until the Go task finishes; keep it off-main to avoid the watchdog.
        DispatchQueue.global(qos: .background).async {
            let success = bgtask.execute()
            DispatchQueue.main.async {
                completionHandler(success ? .newData : .failed)
            }
        }
    }

    @objc
    func updateState(state: UIApplication.State) {
        self.runOffMain(name: "tech.berty.lifecycle.state") {
            LifeCycleDriver.shared.updateState(state: state)
        }
    }

    @objc
    func willTerminate() {
        self.logger.info("will terminate")
        self.runOffMain(name: "tech.berty.lifecycle.terminate") {
            LifeCycleDriver.shared.willTerminate()
        }
    }
}

```

### Core Architecture Module: `berty-bridge-expo/mobile/.rnstorybook/utils.ts`
```
export const action = (msg: string) => Promise.resolve(console.log(msg))

```

### Core Architecture Module: `berty-bridge-expo/mobile/src/components/chat/message/user-message/getUserMessageState.ts`
```
import { ThemeType } from '@ui-kitten/components'
import palette from 'google-palette'
import { SHA3 } from 'sha3'

import beapi from '@berty/api'
import { ParsedInteraction } from '@berty/utils/api'
import { pbDateToNum } from '@berty/utils/convert/time'

const pal = palette('tol-rainbow', 256)

export const getUserMessageState = (
	inte: ParsedInteraction,
	members: { [key: string]: beapi.messenger.IMember | undefined } | undefined,
	convKind: beapi.messenger.Conversation.Type,
	previousMessage: ParsedInteraction | undefined,
	nextMessage: ParsedInteraction | undefined,
	colors: ThemeType,
) => {
	const sentDate = pbDateToNum(inte?.sentDate)

	let name = ''
	let baseColor = colors['background-header']
	let isFollowupMessage: boolean | undefined = false
	let isFollowedMessage: boolean | undefined = false
	let isWithinCollapseDuration: number | boolean | null | undefined = false
	let msgTextColor, msgBackgroundColor, msgBorderColor, msgSenderColor

	const cmd = null /*messenger.message.isCommandMessage(payload.body)*/
	if (convKind === beapi.messenger.Conversation.Type.ContactType) {
		// State of OneToOne conversation

		// TODO: tmp comment to don't have user frustration when a message is not received
		// msgTextColor = inte.isMine
		// 	? inte.acknowledged
		// 		? colors['reverted-main-text']
		// 		: colors['background-header']
		// 	: colors['background-header']
		msgTextColor = inte.isMine ? colors['reverted-main-text'] : colors['background-header']

		// TODO: tmp comment to don't have user frustration when a message is not received
		// msgBackgroundColor = inte.isMine
		// 	? inte.acknowledged
		// 		? colors['background-header']
		// 		: colors['reverted-main-text']
		// 	: colors['input-background']
		msgBackgroundColor = inte.isMine ? colors['background-header'] : colors['input-background']

		msgBorderColor =
			inte.isMine &&
			(cmd
				? { borderColor: colors['secondary-text'] }
				: { borderColor: colors['background-header'] })

		isWithinCollapseDuration =
			nextMessage &&
			inte.isMine === nextMessage?.isMine &&
			sentDate &&
			nextMessage.sentDate &&
			(parseInt(nextMessage?.sentDate.toString(), 10) || 0) - (sentDate || 0) < 60000 // one minute
	} else {
		// State for MultiMember conversation
		if (inte.memberPublicKey && members && members[inte.memberPublicKey]) {
			name = members[inte.memberPublicKey]?.displayName || ''
		}
		isFollowupMessage =
			previousMessage && !inte.isMine && inte.memberPublicKey === previousMessage.memberPublicKey
		isFollowedMessage =
			nextMessage && !inte.isMine && inte.memberPublicKey === nextMessage.memberPublicKey

		isWithinCollapseDuration =
			nextMessage &&
			inte?.memberPublicKey === nextMessage?.memberPublicKey &&
			sentDate &&
			nextMessage.sentDate &&
			(parseInt(nextMessage?.sentDate.toString(), 10) || 0) - (sentDate || 0) < 60000 // one minute

		if (!inte.isMine && inte.memberPublicKey) {
			const h = new SHA3(256).update(inte.memberPublicKey).digest()
			baseColor = '#' + pal[h[0]]
		}
		// TODO: tmp comment to don't have user frustration when a message is not received
		// msgTextColor = inte.isMine
		// 	? inte.acknowledged
		// 		? colors['reverted-main-text']
		// 		: cmd
		// 		? colors['secondary-text']
		// 		: baseColor
		// 	: colors['reverted-main-text']
		// msgTextColor = inte.isMine
		// 	? inte.acknowledged
		// 		? colors['reverted-main-text']
		// 		: baseColor
		// 	: colors['reverted-main-text']
		msgTextColor = colors['reverted-main-text']
		// TODO: tmp comment to don't have user frustration when a message is not received
		// msgBackgroundColor = inte.isMine
		// 	? inte.acknowledged
		// 		? baseColor
		// 		: colors['reverted-main-text']
		// 	: baseColor
		msgBackgroundColor = baseColor
		msgBorderColor =
			inte.isMine && (cmd ? { borderColor: colors['secondary-text'] } : { borderColor: baseColor })
		msgSenderColor = inte.isMine ? colors['warning-asset'] : baseColor
	}

	return {
		name,
		isFollowupMessage,
		isFollowedMessage,
		isWithinCollapseDuration,
		msgTextColor,
		msgBackgroundColor,
		msgBorderColor,
		msgSenderColor,
		cmd,
	}
}

```

### Core Architecture Module: `berty-bridge-expo/mobile/src/components/hooks.ts`
```
import { useState, useCallback, useRef, useEffect } from 'react'
import { LayoutChangeEvent, LayoutRectangle } from 'react-native'

export const useLayout = (): [LayoutRectangle, (e: LayoutChangeEvent) => void] => {
	const [layout, setLayout] = useState<LayoutRectangle>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	})

	const onLayout = useCallback(
		(e: LayoutChangeEvent) =>
			setLayout({
				x: e.nativeEvent.layout.x,
				y: e.nativeEvent.layout.y,
				width: e.nativeEvent.layout.width,
				height: e.nativeEvent.layout.height,
			}),
		[],
	)
	return [layout, onLayout]
}

export function usePrevious<T>(value: T) {
	// https://blog.logrocket.com/how-to-get-previous-props-state-with-react-hooks/
	const ref = useRef<T>()
	useEffect(() => {
		ref.current = value
	})
	return ref.current
}

```

### Core Architecture Module: `berty-bridge-expo/mobile/src/grpc-bridge/rpc/utils.ts`
```
import base64 from 'base64-js'
import * as pb from 'protobufjs'

// methods
export const serializeToBase64 = (req: Uint8Array) => base64.fromByteArray(req)
export const deserializeFromBase64 = (b64: string) => new Uint8Array(base64.toByteArray(b64))

export const getServiceName = <T extends pb.Method>(method: T) => {
	const fullName = method.parent?.fullName
	if (fullName?.startsWith('.')) {
		return fullName.substring(1)
	}
	return fullName
}

// Error
export const ErrorStreamNotImplemented = new Error('stream method not implemented')
export const ErrorUnaryNotImplemented = new Error('unary method not implemented')

```

### Core Architecture Module: `berty-bridge-expo/mobile/src/hooks/accounts.hooks.ts`
```
import { NavigationProp } from '@react-navigation/native'
import { useCallback } from 'react'
import { Alert } from 'react-native'

import beapi from '@berty/api'
import { GoBridge } from 'berty-bridge-expo'
import { useNavigation } from '@berty/navigation'
import { ScreensParams } from '@berty/navigation/types'
import { selectSelectedAccount } from '@berty/redux/reducers/ui.reducer'
import { createAccount, deleteAccount, updateAccount } from '@berty/utils/accounts'
import { initBridge } from '@berty/utils/bridge/bridge'

import { useAppSelector } from './core.hooks'
import { useAccount } from './messenger.hooks'

export const useDeleteAccount = () => {
	const { reset } = useNavigation()
	return useCallback(
		(selectedAccount: string | null) => deleteAccount(reset, selectedAccount),
		[reset],
	)
}

export const useCreateNewAccount = () => {
	const { reset } = useNavigation()
	return useCallback(
		(newConfig?: beapi.account.INetworkConfig) => createAccount(reset, newConfig),
		[reset],
	)
}

/**
 * Returns a function to update the AccountService account
 */
export const useUpdateAccount = () => {
	return useCallback((payload: any) => updateAccount(payload), [])
}

export const useAccountServices = (): Array<beapi.messenger.IServiceToken> => {
	const account = useAccount()
	if (!account.serviceTokens) {
		return []
	}

	return Object.values(
		account.serviceTokens.reduce(
			(tokens, t) => ({
				...tokens,
				...t.supportedServices?.reduce(
					(services, s) => ({
						...services,
						[`${t.authenticationUrl}-${s.type}`]: t,
					}),
					{},
				),
			}),
			{},
		),
	)
}

/**
 * hooks for differents actions after closing account
 */
const resetToClosing = async (
	reset: NavigationProp<ScreensParams>['reset'],
	callback: () => void,
) => {
	reset({ routes: [{ name: 'Account.Closing', params: { callback } }] })
}

export const closeBridgeAndNavigateToOnboarding = async (
	reset: NavigationProp<ScreensParams>['reset'],
	selectedAccount: string | null,
) => {
	await GoBridge.closeBridge()
	reset({
		routes: [
			{
				name: 'Account.SelectNode',
				params: {
					init: true,
					action: async (external: boolean, address: string, port: string) => {
						const res = await initBridge(external, address, port)
						if (!res) {
							Alert.alert('bridge: init failed')
							return false
						}

						reset({
							index: 0,
							routes: [
								{
									name: 'Account.GoToLogInOrCreate',
									params: { isCreate: false, selectedAccount },
								},
							],
						})
						return true
					},
				},
			},
		],
	})
}

export const useSwitchAccountAfterClosing = () => {
	const { reset } = useNavigation()
	return useCallback(
		(selectedAccount: string | null) =>
			resetToClosing(reset, async () => closeBridgeAndNavigateToOnboarding(reset, selectedAccount)),
		[reset],
	)
}

export const useRestartAfterClosing = () => {
	const selectedAccount = useAppSelector(selectSelectedAccount)
	const switchAccount = useSwitchAccountAfterClosing()
	return useCallback(() => switchAccount(selectedAccount), [selectedAccount, switchAccount])
}

export const useOnBoardingAfterClosing = () => {
	const { reset } = useNavigation()
	return useCallback(
		async () =>
			await resetToClosing(reset, async () => {
				await GoBridge.closeBridge()
				reset({
					routes: [
						{
							name: 'Account.SelectNode',
							params: {
								init: false,
								action: async (external: boolean, address: string, port: string) => {
									const res = await initBridge(external, address, port)
									if (!res) {
										Alert.alert('bridge: init failed')
										return false
									}

									reset({
										index: 0,
										routes: [{ name: 'Account.GoToLogInOrCreate', params: { isCreate: true } }],
									})
									return true
								},
							},
						},
					],
				})
			}),
		[reset],
	)
}

export const useImportingAccountAfterClosing = () => {
	const { reset } = useNavigation()
	return useCallback(
		async (filePath: string) =>
			await resetToClosing(reset, async () => {
				await GoBridge.closeBridge()
				reset({
					routes: [
						{
							name: 'Account.SelectNode',
							params: {
								init: true,
								action: async (external: boolean, address: string, port: string) => {
									const res = await initBridge(external, address, port)
									if (!res) {
										Alert.alert('bridge: init failed')
										return false
									}

									reset({ routes: [{ name: 'Account.Importing', params: { filePath } }] })
									return true
								},
							},
						},
					],
				})
			}),
		[reset],
	)
}

export const useDeletingAccountAfterClosing = () => {
	const selectedAccount = useAppSelector(selectSelectedAccount)
	const { reset } = useNavigation()
	return useCallback(
		() =>
			resetToClosing(reset, () =>
				reset({ routes: [{ name: 'Account.Deleting', params: { selectedAccount } }] }),
			),
		[reset, selectedAccount],
	)
}

export const useCloseBridgeAfterClosing = () => {
	const { reset } = useNavigation()
	return useCallback(
		() =>
			resetToClosing(reset, async () => {
				await GoBridge.closeBridge()
				reset({ routes: [{ name: 'Account.SelectNode' }] })
			}),

		[reset],
	)
}

```

### Core Architecture Module: `berty-bridge-expo/mobile/src/hooks/core.hooks.ts`
```
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

import { AppDispatch, RootState } from '@berty/redux/store'

export const useAppDispatch = () => useDispatch<AppDispatch>()

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5086** (2026-08-25): **Doesn't work on andoid**
  *Symptoms*: Can't add a contact as well as nobody able to add me
  **Post-Mortem & Fix Analysis**:
  > You don't give enough information to diagnose the issue (app version, download source...) Try uninstall app and reinstall from Playstore.
  > > You don't give enough information to diagnose the issue (app version, download source...) Try uninstall app and reinstall from Playstore.  Me and my friend downloaded Berty from Google Play Store.  After that tried to add in contacts each other. However no notification came either me nor him.  We tried to create a Group and join but same unsuccessfully. I dont see he has joined, he doesnt see me joined his group.  Even when I try to send message myself in my own group it says `sending...` and thats it.  Yes, we tried reinstall but same result.  Possible reason I think traffic of the app is being blocked by government DPI systems. 
  > @RobertAzovski, we just released a new version on the Google Play Store. Can you try this version? https://play.google.com/store/apps/details?id=tech.berty.android  <blockquote><img src="https://play-lh.googleusercontent.com/JhUTgA5Mr63loQJQu3DGrY9oMPLTN7kHQvP378fuHNB89fPotDSrX80PVVPJadlqOMJIKtgxU0ZqOrWrHrbJ" width="48" align="right"><div><strong><a href="https://play.google.com/store/apps/details?id=tech.berty.android&hl=en_US">Berty Messenger - Apps on Google Play</a></strong></div><div>You deserve privacy!</div></blockquote>

- **Issue #5014** (2026-02-09): **Android build fails from source due to missing Maven dependencies**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  Mobile app  ### Berty product version  Unknown  ### OS  Linux  ### OS version  Ubuntu 24.04.3  ### Device  Android emulator (AVD)  ### Steps to reproduce  1. Clone the berty/berty repository from GitHub 2. Use Node.js 16.x and Java 11 3. Go to the js/ directory 4. Run `npm install --legacy-peer-deps` 5. Run `npx expo prebuild --platform android` 6. Run `npx expo run:android`   ### Current behavior  The Android build fails during Gradle execution.  Gradle is unable to resolve several Android dependencies such as: - com.facebook.fresco:fresco:2.2.0 - com.google.android:cameraview:1.0.0 - com.eightbitlab:blurview  Those dependencies cannot be found on Maven Central or other configured repositories, which prevents the app from being built from source.   ### Expected behavior  The Android application should successfully build from source following the instructions provided in the README.   ### Other  The application works correctly when installed from the Google Play Store.  This issue was encountered while working on an academic project  aiming to evaluate Berty in real conditions.  It seems that some Android dependencies used by the mobile app are no longer available on current Maven repositories, which makes the build non-reproducible on a clean environment. 
  **Post-Mortem & Fix Analysis**:
  > As mentioned in the main README: `To compile and run the mobile application on your device, see [berty-bridge-expo/mobile/README.md](https://github.com/berty/berty/blob/master/berty-bridge-expo/mobile/README.md)` You have to build the app in `berty-bridge-expo/mobile`. The `js` folder is deprecated and will be deleted soon.
  > We did more updates to the build instructions related to the needed Android Studio SDK versions. https://github.com/berty/berty/blob/master/berty-bridge-expo/README.md  <blockquote><img src="https://repository-images.githubusercontent.com/141089889/bb009800-7059-11ea-935c-8e7a99aec447" width="48" align="right"><div><img src="https://github.githubassets.com/favicons/favicon.svg" height="14"> GitHub</div><div><strong><a href="https://github.com/berty/berty/blob/master/berty-bridge-expo/README.md">berty/berty-bridge-expo/README.md at master · berty/berty</a></strong></div><div>Berty is a secure peer-to-peer messaging app that works with or without internet access, cellular data or trust in the network - berty/berty</div></blockquote>

- **Issue #4962** (2026-08-25): **Not able to add contacts**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  Mobile app  ### Berty product version  2.470.9  ### OS  iOS  ### OS version  2.470.9  ### Device  iPhone   ### Steps to reproduce  1. Download iOS app 2. create an account 3. try to add contacts with QR code   ### Current behavior  The app keeps on saying request was sent but the other users never received a request nor a message.  We also tried backwards but no luck  ### Expected behavior  Contact receives request and message  ### Other  _No response_
  **Post-Mortem & Fix Analysis**:
  > I wanna a contributor by solving issue 
  > @macrigiuseppe, we released a new version on the App Store. Is this still an issue?
  > If no more feedback, in 3 weeks we will close this issue as assumed resolved.

- **Issue #4959** (2026-08-25): **Infinite loop when opening the app on iOS**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  Mobile app  ### Berty product version  V2 470 9  ### OS  iOS  ### OS version  18.5  ### Device  iPhone pro 14  ### Steps to reproduce  Open the app  It does not happen every time but often  ### Current behavior  https://github.com/user-attachments/assets/a3abd46a-f478-4e86-8b8b-eb98abdc6ad6 The behavior is shown in the video  ### Expected behavior  _No response_  ### Other  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We are refactoring the code to use a new library. When we release the new code, we can ask you to check the new version. Sound good?
  > @ndx1905-github, we published a new version on the App Store. Is this still an issue?
  > If no more feedback, in 3 weeks we will close this issue as assumed resolved.

- **Issue #4947** (2026-03-27): **Unable to run the app the berty-bridge-expo with expo**
  *Symptoms*: Cloned the project https://github.com/berty/berty/tree/master/berty-bridge-expo Run the app from the folder **berty-bridge-expo**. Shows the below error  <img width="1290" height="2796" alt="Image" src="https://github.com/user-attachments/assets/816af5c0-12e4-476e-967b-eee88b735777" />
  **Post-Mortem & Fix Analysis**:
  > Hello @nihp . We have many recent updates to berty-bridge-expo, including improved build instructions. Is this still an issue?
  > If there is no response from the author, in three weeks this issue will be closed as assumed resolved.
  > No response from the author.  Close as assumed resolved by recent updates.

- **Issue #4943** (2025-07-11): **Cannot use offline messaging**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  Mobile app  ### Berty product version  Latest version   ### OS  Android  ### OS version  11.0  ### Device  Realme 3 pro  ### Steps to reproduce  When messaging, while blutooth and location is on, and wifi is turned of, I cannot receive msgs, it's saying sending and when I turn on my wifi the msg is sent. I've given acces to Bluetooth and enabled offline messaging in the app  ### Current behavior  When will berty start working? I also had the same problem but after opening bluetooth and location, I got the invitation, but it doesn't work while being offline.  ### Expected behavior  _No response_  ### Other  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thank you for submitting this issue. We are working on releasing a new Android version that will fix this issue. 
  > > Thank you for submitting this issue. We are working on releasing a new Android version that will fix this issue.   When will it launch?

- **Issue #4935** (2025-05-28): **Berty mini not working anymore: wrong key for `AcceleratedDHTClient`**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  CLI tools (berty mini, daemon, etc.)  ### Berty product version  n/a (git cloned and go installed as of 28/05/2025)  ### OS  Linux  ### OS version  Ubuntu 24.04.2 LTS  ### Device  Winodws 11 WSL2  ### Steps to reproduce  1. git clone the repo 2. Go install in the go/cmd/berty folder 3. run `berty mini` 4. get error  ### Current behavior  I get the following error:  ```bash luke@Corvid:~/projects/berty/go/cmd/berty$ berty mini interrupted, closing... error: TODO(#666): TODO(#666): TODO(#666): ErrIPFSInit(#1052): ErrIPFSSetupRepo(#1054): get config: unmarshal config: The Experimental.AcceleratedDHTClient key has been moved to Routing.AcceleratedDHTClient in Kubo 0.21, please use this new key and remove the old one.:     berty.tech/berty/v2/go/internal/initutil.(*Manager).getMessengerClient         /home/luke/projects/berty/go/internal/initutil/node.go:380 #1:     berty.tech/berty/v2/go/internal/initutil.(*Manager).getGRPCClientConn         /home/luke/projects/berty/go/internal/initutil/node.go:266 #2:     berty.tech/berty/v2/go/internal/initutil.(*Manager).getLocalProtocolServer         /home/luke/projects/berty/go/internal/initutil/node.go:180 #3:     berty.tech/berty/v2/go/internal/initutil.(*Manager).getLocalIPFS         /home/luke/projects/berty/go/internal/initutil/ipfs.go:177 #4:     berty.tech/berty/v2/go/internal/initutil.(*Manager).setupIPFSRepo         /home/luke/pr
  **Post-Mortem & Fix Analysis**:
  > Hi @LFGaming . I saw the same thing. It is because of an old configuration in the datastore directory. To find the directory, enter: ``` berty mini --help ``` Look at the default for `-store.dir` . For me it says `/Users/jefft0/Library/Application Support/berty-tech/berty` . Try removing this directory and run again.
  > this works, thanks 👍 

- **Issue #4918** (2026-08-25): **Can't add contact via QR code on Android (await expo)**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Berty product  Mobile app  ### Berty product version  2.470.3  ### OS  Android  ### OS version  Android 14  ### Device  Samsung galaxy s24 ultra   ### Steps to reproduce  1. Sent QR code invite to other person 2. He scanned it 3. It says that it waits for other person to accept inventation 4. He said he never received inventation  5. He sent also inventation to me and same story   ### Current behavior  ![Image](https://github.com/user-attachments/assets/a485a054-16fe-4f8e-8ffe-fce34e25a574)  ### Expected behavior  _No response_  ### Other  This is the latest app version on Google play store
  **Post-Mortem & Fix Analysis**:
  > Hi! yes, this problem is tracked [issue 4872](https://github.com/berty/berty/issues/4872) 
  > So Android version is not working at the moment?
  > any news about this issue? downloaded from google play on one device, IOS on second and can't add a contact on both directions.

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

### Incident Patch 1: `a8791432` (2026-07-31)
**Commit Message**: Merge pull request #5191 from berty/dependabot/go_modules/github.com/quic-go/webtransport-go-0.11.1

chore(deps): bump github.com/quic-go/webtransport-go from 0.10.0 to 0.11.1

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -389,8 +389,8 @@ require (
 	github.com/prometheus/statsd_exporter v0.27.1 // indirect
 	github.com/pseudomuto/protokit v0.2.0 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
-	github.com/quic-go/quic-go v0.59.1 // indirect
-	github.com/quic-go/webtransport-go v0.10.0 // indirect
+	github.com/quic-go/quic-go v0.60.0 // indirect
+	github.com/quic-go/webtransport-go v0.11.1 // indirect
 	github.com/radovskyb/watcher v1.0.7 // indirect
 	github.com/rivo/uniseg v0.4.7 // indirect
 	github.com/rogpeppe/go-internal v1.14.1 // indirect
```

**File**: `go.sum` (modified, +6/-4)
```diff
@@ -1350,12 +1350,14 @@ github.com/pseudomuto/protoc-gen-doc v1.5.1 h1:Ah259kcrio7Ix1Rhb6u8FCaOkzf9qRBqX
 github.com/pseudomuto/protoc-gen-doc v1.5.1/go.mod h1:XpMKYg6zkcpgfpCfQ8GcWBDRtRxOmMR5w7pz4Xo+dYM=
 github.com/pseudomuto/protokit v0.2.0 h1:hlnBDcy3YEDXH7kc9gV+NLaN0cDzhDvD1s7Y6FZ8RpM=
 github.com/pseudomuto/protokit v0.2.0/go.mod h1:2PdH30hxVHsup8KpBTOXTBeMVhJZVio3Q8ViKSAXT0Q=
+github.com/quic-go/go-ossfuzz-seeds v0.1.0 h1:APacT+iIaNF6fd8AGEiN3bT/Jtkd2jz4v4TzM7MFjy0=
+github.com/quic-go/go-ossfuzz-seeds v0.1.0/go.mod h1:3IOHRbJIc+L6YKMwfDtJAM9Vj9k0YY4muhuyUYk5tbk=
 github.com/quic-go/qpack v0.6.0 h1:g7W+BMYynC1LbYLSqRt8PBg5Tgwxn214ZZR34VIOjz8=
 github.com/quic-go/qpack v0.6.0/go.mod h1:lUpLKChi8njB4ty2bFLX2x4gzDqXwUpaO1DP9qMDZII=
-github.com/quic-go/quic-go v0.59.1 h1:0Gmua0HW1Tv7ANR7hUYwRyD0MG5OJfgvYSZasGZzBic=
-github.com/quic-go/quic-go v0.59.1/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
-github.com/quic-go/webtransport-go v0.10.0 h1:LqXXPOXuETY5Xe8ITdGisBzTYmUOy5eSj+9n4hLTjHI=
-github.com/quic-go/webtransport-go v0.10.0/go.mod h1:LeGIXr5BQKE3UsynwVBeQrU1TPrbh73MGoC6jd+V7ow=
+github.com/quic-go/quic-go v0.60.0 h1:xcQioE8OM66UQLeUMHltK1CCcOu3JbVB4JAQdDQSB+0=
+github.com/quic-go/quic-go v0.60.0/go.mod h1:wpKpjmPpftl30sL6pFh7REVpjbcCVy4zt2vDyK1TuJk=
+github.com/quic-go/webtransport-go v0.11.1 h1:rrFQMO+7/52ZDJ04fsrjIaWqn6q1z1MYo9iVFq6JtbA=
+github.com/quic-go/webtransport-go v0.11.1/go.mod h1:SHgEzUFVyj+9WUSuGB1P6Zd351Pww2leWV3SwlTovkA=
 github.com/radovskyb/watcher v1.0.7 h1:AYePLih6dpmS32vlHfhCeli8127LzkIgwJGcwwe8tUE=
 github.com/radovskyb/watcher v1.0.7/go.mod h1:78okwvY5wPdzcb1UYnip1pvrZNIVEIh/Cm+ZuvsUYIg=
 github.com/rcrowley/go-metrics v0.0.0-20181016184325-3113b8401b8a/go.mod h1:bCqnVzQkZxMG4s8nGwiZ5l3QUCyqpo9Y+/ZMZ9VjZe4=
```

---

### Incident Patch 2: `c4ac1712` (2026-07-28)
**Commit Message**: chore(deps): bump github.com/quic-go/webtransport-go

Bumps [github.com/quic-go/webtransport-go](https://github.com/quic-go/webtransport-go) from 0.10.0 to 0.11.1.
- [Release notes](https://github.com/quic-go/webtransport-go/releases)
- [Commits](https://github.com/quic-go/webtransport-go/compare/v0.10.0...v0.11.1)

---
updated-dependencies:
- dependency-name: github.com/quic-go/webtransport-go
  dependency-version: 0.11.1
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -389,8 +389,8 @@ require (
 	github.com/prometheus/statsd_exporter v0.27.1 // indirect
 	github.com/pseudomuto/protokit v0.2.0 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
-	github.com/quic-go/quic-go v0.59.1 // indirect
-	github.com/quic-go/webtransport-go v0.10.0 // indirect
+	github.com/quic-go/quic-go v0.60.0 // indirect
+	github.com/quic-go/webtransport-go v0.11.1 // indirect
 	github.com/radovskyb/watcher v1.0.7 // indirect
 	github.com/rivo/uniseg v0.4.7 // indirect
 	github.com/rogpeppe/go-internal v1.14.1 // indirect
```

**File**: `go.sum` (modified, +6/-4)
```diff
@@ -1350,12 +1350,14 @@ github.com/pseudomuto/protoc-gen-doc v1.5.1 h1:Ah259kcrio7Ix1Rhb6u8FCaOkzf9qRBqX
 github.com/pseudomuto/protoc-gen-doc v1.5.1/go.mod h1:XpMKYg6zkcpgfpCfQ8GcWBDRtRxOmMR5w7pz4Xo+dYM=
 github.com/pseudomuto/protokit v0.2.0 h1:hlnBDcy3YEDXH7kc9gV+NLaN0cDzhDvD1s7Y6FZ8RpM=
 github.com/pseudomuto/protokit v0.2.0/go.mod h1:2PdH30hxVHsup8KpBTOXTBeMVhJZVio3Q8ViKSAXT0Q=
+github.com/quic-go/go-ossfuzz-seeds v0.1.0 h1:APacT+iIaNF6fd8AGEiN3bT/Jtkd2jz4v4TzM7MFjy0=
+github.com/quic-go/go-ossfuzz-seeds v0.1.0/go.mod h1:3IOHRbJIc+L6YKMwfDtJAM9Vj9k0YY4muhuyUYk5tbk=
 github.com/quic-go/qpack v0.6.0 h1:g7W+BMYynC1LbYLSqRt8PBg5Tgwxn214ZZR34VIOjz8=
 github.com/quic-go/qpack v0.6.0/go.mod h1:lUpLKChi8njB4ty2bFLX2x4gzDqXwUpaO1DP9qMDZII=
-github.com/quic-go/quic-go v0.59.1 h1:0Gmua0HW1Tv7ANR7hUYwRyD0MG5OJfgvYSZasGZzBic=
-github.com/quic-go/quic-go v0.59.1/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
-github.com/quic-go/webtransport-go v0.10.0 h1:LqXXPOXuETY5Xe8ITdGisBzTYmUOy5eSj+9n4hLTjHI=
-github.com/quic-go/webtransport-go v0.10.0/go.mod h1:LeGIXr5BQKE3UsynwVBeQrU1TPrbh73MGoC6jd+V7ow=
+github.com/quic-go/quic-go v0.60.0 h1:xcQioE8OM66UQLeUMHltK1CCcOu3JbVB4JAQdDQSB+0=
+github.com/quic-go/quic-go v0.60.0/go.mod h1:wpKpjmPpftl30sL6pFh7REVpjbcCVy4zt2vDyK1TuJk=
+github.com/quic-go/webtransport-go v0.11.1 h1:rrFQMO+7/52ZDJ04fsrjIaWqn6q1z1MYo9iVFq6JtbA=
+github.com/quic-go/webtransport-go v0.11.1/go.mod h1:SHgEzUFVyj+9WUSuGB1P6Zd351Pww2leWV3SwlTovkA=
 github.com/radovskyb/watcher v1.0.7 h1:AYePLih6dpmS32vlHfhCeli8127LzkIgwJGcwwe8tUE=
 github.com/radovskyb/watcher v1.0.7/go.mod h1:78okwvY5wPdzcb1UYnip1pvrZNIVEIh/Cm+ZuvsUYIg=
 github.com/rcrowley/go-metrics v0.0.0-20181016184325-3113b8401b8a/go.mod h1:bCqnVzQkZxMG4s8nGwiZ5l3QUCyqpo9Y+/ZMZ9VjZe4=
```

---

### Incident Patch 3: `3b3b237e` (2026-07-24)
**Commit Message**: Merge pull request #5175 from berty/dependabot/npm_and_yarn/berty-bridge-expo/brace-expansion-1.1.16

chore(deps-dev): bump brace-expansion from 1.1.12 to 1.1.16 in /berty-bridge-expo

**File**: `berty-bridge-expo/package-lock.json` (modified, +45/-45)
```diff
@@ -66,9 +66,9 @@
       }
     },
     "node_modules/@babel/cli/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -2469,9 +2469,9 @@
       }
     },
     "node_modules/@eslint/config-array/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -2548,9 +2548,9 @@
       }
     },
     "node_modules/@eslint/eslintrc/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -3516,9 +3516,9 @@
       }
     },
     "node_modules/@jest/reporters/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -3885,9 +3885,9 @@
       }
     },
     "node_modules/@react-native/codegen/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -5463,9 +5463,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.0.2.tgz",
-      "integrity": "sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ==",
+      "version": "2.1.2",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.2.tgz",
+      "integrity": "sha512-w5JZcKgdhDOgOwm8H+KgbosopHMuGcl6qbulwjtz3SM7I7P3yW1eAjzMPLrIE+NQ9vjgANKHWeMHnrT0OXW1oA==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -7189,9 +7189,9 @@
       }
     },
     "node_modules/eslint-plugin-import/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -7294,9 +7294,9 @@
       }
     },
     "node_modules/eslint-plugin-node/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.or
```

---

### Incident Patch 4: `def35b18` (2026-07-24)
**Commit Message**: chore(deps-dev): bump brace-expansion in /berty-bridge-expo

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.12 to 1.1.16.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.12...v1.1.16)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.16
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `berty-bridge-expo/package-lock.json` (modified, +45/-45)
```diff
@@ -66,9 +66,9 @@
       }
     },
     "node_modules/@babel/cli/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -2469,9 +2469,9 @@
       }
     },
     "node_modules/@eslint/config-array/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -2548,9 +2548,9 @@
       }
     },
     "node_modules/@eslint/eslintrc/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -3516,9 +3516,9 @@
       }
     },
     "node_modules/@jest/reporters/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "peer": true,
@@ -3885,9 +3885,9 @@
       }
     },
     "node_modules/@react-native/codegen/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -5463,9 +5463,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.0.2.tgz",
-      "integrity": "sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ==",
+      "version": "2.1.2",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.2.tgz",
+      "integrity": "sha512-w5JZcKgdhDOgOwm8H+KgbosopHMuGcl6qbulwjtz3SM7I7P3yW1eAjzMPLrIE+NQ9vjgANKHWeMHnrT0OXW1oA==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -7189,9 +7189,9 @@
       }
     },
     "node_modules/eslint-plugin-import/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
+      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -7294,9 +7294,9 @@
       }
     },
     "node_modules/eslint-plugin-node/node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.16",
+      "resolved": "https://registry.npmjs.or
```

---

### Incident Patch 5: `46238452` (2026-07-03)
**Commit Message**: fix(bridge-expo): derive iOS App Group per build variant (#5151)

The iOS App Group was hardcoded to `group.tech.berty` for every build
variant. Because the Go bridge stores its "shared" root dir in the App
Group container (while the "app" root lives in the per-install Documents
dir), installing two variants side-by-side (e.g. production
`tech.berty.ios` and debug `tech.berty.ios.debug`) made them share the
shared container. The debug build then saw production's account list via
ListAccounts (shared root) but not its data via the open-time existence
check (app root), failing with ErrBertyAccountOpenAccount(#5006) /
ErrBertyAccountDataNotFound(#5007) and hanging on the opening loader.

Derive the App Group from the bundle identifier variant instead:
  tech.berty.ios        -> group.tech.berty
  tech.berty.ios.debug  -> group.tech.berty.debug
  tech.berty.ios.staff  -> group.tech.berty.staff

New `plugin/src/appGroup.ts` helper is wired into the main-app entitlement
and Info.plist `appGroupID`, and the NotificationService entitlement +
Info.plist are rewritten for non-prod variants so the extension shares the
same per-variant container (push decryption and the keychain-backed
keystor

**File**: `berty-bridge-expo/mobile/app.config.ts` (modified, +15/-1)
```diff
@@ -77,7 +77,7 @@ export default ({ config }: ConfigContext): ExpoConfig => {
 									bundleIdentifier: `${bundleIdentifier}.NotificationService`,
 									entitlements: {
 										"com.apple.security.application-groups": [
-											"group.tech.berty",
+											getAppGroupID(bundleIdentifier),
 										],
 										"com.apple.developer.associated-domains": [
 											"applinks:berty.tech",
@@ -139,6 +139,20 @@ export default ({ config }: ConfigContext): ExpoConfig => {
 	};
 };
 
+// Derive the iOS App Group container id from the build variant so that
+// side-by-side installs don't share storage. Must stay in sync with the
+// bridge plugin's getAppGroupID (berty-bridge-expo/plugin/src/appGroup.ts).
+const APP_GROUP_PREFIX = "group.tech.berty";
+export const getAppGroupID = (id?: string): string => {
+	if (!id || id === BUNDLE_IDENTIFIER) {
+		return APP_GROUP_PREFIX;
+	}
+	if (id.startsWith(`${BUNDLE_IDENTIFIER}.`)) {
+		return `${APP_GROUP_PREFIX}${id.slice(BUNDLE_IDENTIFIER.length)}`;
+	}
+	return `${APP_GROUP_PREFIX}.${id}`;
+};
+
 // Dynamically configure the app based on the environment.
 export const getDynamicAppConfig = (
 	config: Partial<ExpoConfig>,
```

**File**: `berty-bridge-expo/plugin/src/appGroup.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+// The App Group container is where the Go bridge stores its "shared" root
+// directory on iOS (see RootDir.swift). Every build variant that is installed
+// side-by-side on a device MUST use its own container, otherwise a debug build
+// sees the production account list but not its data (ErrBertyAccountDataNotFound)
+// because the app-private "Documents" root is not shared while the App Group is.
+//
+// This mirrors the historical native scheme (group.tech.berty for release,
+// group.tech.berty.dev for debug, ...) by deriving the suffix from the bundle
+// identifier variant (tech.berty.ios, tech.berty.ios.debug, tech.berty.ios.staff).
+
+export const APP_GROUP_PREFIX = "group.tech.berty";
+export const PRODUCTION_BUNDLE_IDENTIFIER = "tech.berty.ios";
+
+export const getAppGroupID = (bundleIdentifier?: string): string => {
+	if (!bundleIdentifier || bundleIdentifier === PRODUCTION_BUNDLE_IDENTIFIER) {
+		return APP_GROUP_PREFIX;
+	}
+
+	// Variant bundle ids extend the production one (e.g. "tech.berty.ios.debug"),
+	// so reuse that ".debug"/".staff" suffix to keep the container name readable.
+	if (bundleIdentifier.startsWith(`${PRODUCTION_BUNDLE_IDENTIFIER}.`)) {
+		const suffix = bundleIdentifier.slice(PRODUCTION_BUNDLE_IDENTIFIER.length);
+		return `${APP_GROUP_PREFIX}${suffix}`;
+	}
+
+	// Fallback for unexpected bundle ids: keep uniqueness by appending the whole id.
+	return `${APP_GROUP_PREFIX}.${bundleIdentifier}`;
+};
```

**File**: `berty-bridge-expo/plugin/src/withIosEntitlements.ts` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 import { ConfigPlugin, withEntitlementsPlist } from "@expo/config-plugins";
 
+import { getAppGroupID } from "./appGroup";
+
 const withIosEntitlements: ConfigPlugin = (config) => {
 	return withEntitlementsPlist(config, (config) => {
 		if (config.ios?.bundleIdentifier === "tech.berty.ios") {
@@ -12,7 +14,7 @@ const withIosEntitlements: ConfigPlugin = (config) => {
 			"applinks:berty.tech",
 		];
 		config.modResults["com.apple.security.application-groups"] = [
-			"group.tech.berty",
+			getAppGroupID(config.ios?.bundleIdentifier),
 		];
 		config.modResults["keychain-access-groups"] = [
 			"$(AppIdentifierPrefix)tech.berty.ios",
```

**File**: `berty-bridge-expo/plugin/src/withIosPlist.ts` (modified, +5/-1)
```diff
@@ -1,5 +1,7 @@
 import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";
 
+import { getAppGroupID } from "./appGroup";
+
 const withIosPlist: ConfigPlugin = (config) => {
 	return withInfoPlist(config, (config) => {
 		if (!config.ios) {
@@ -9,7 +11,9 @@ const withIosPlist: ConfigPlugin = (config) => {
 			config.ios.infoPlist = {};
 		}
 
-		config.ios.infoPlist["appGroupID"] = "group.tech.berty";
+		config.ios.infoPlist["appGroupID"] = getAppGroupID(
+			config.ios?.bundleIdentifier
+		);
 
 		// background
 
```

**File**: `berty-bridge-expo/plugin/src/withIosPush.ts` (modified, +21/-0)
```diff
@@ -7,6 +7,8 @@ import * as fs from "fs";
 import * as path from "path";
 import { execSync } from "child_process";
 
+import { APP_GROUP_PREFIX, getAppGroupID } from "./appGroup";
+
 const TARGET_NAME = "NotificationService";
 const SOURCE_FILES = [
 	"Common.swift",
@@ -96,6 +98,25 @@ const withCopyFiles: ConfigPlugin = (config) => {
 				);
 			}
 
+			// The NotificationService copies default (production) files that hardcode
+			// the production App Group. Rewrite them so the extension shares the same
+			// per-variant container as the main app, otherwise push decryption and the
+			// keychain-backed keystore read from the wrong (production) group.
+			const appGroupID = getAppGroupID(config.ios?.bundleIdentifier);
+			if (appGroupID !== APP_GROUP_PREFIX) {
+				for (const file of [ENTITLEMENTS_FILE, ...EXT_FILES]) {
+					const targetFile = `${iosPath}/${TARGET_NAME}/${file}`;
+					const contents = fs.readFileSync(targetFile, "utf8");
+					fs.writeFileSync(
+						targetFile,
+						contents.replaceAll(
+							`<string>${APP_GROUP_PREFIX}</string>`,
+							`<string>${appGroupID}</string>`
+						)
+					);
+				}
+			}
+
 			return config;
 		},
 	]);
```

---

### Incident Patch 6: `f050032f` (2026-07-02)
**Commit Message**: Merge pull request #5153 from D4ryl00/fix/api-tsconfig-types-node

fix(bridge-expo/api): exclude @types/node from tsc build to unblock Release CI

**File**: `berty-bridge-expo/mobile/src/api/tsconfig.json` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
     "allowJs": true,
     "isolatedModules": true,
     "moduleResolution": "node",
+    "types": [],
   },
   "files": [
     "index.js",
```

---

### Incident Patch 7: `ce3d13d4` (2026-07-02)
**Commit Message**: fix(bridge-expo/api): exclude @types/node from tsc build

The @berty/api prepublish step (tsc) auto-included the transitive
@types/node (pulled by protobufjs@6), which floated to v26 whose
ffi.d.ts uses syntax TS 4.6 cannot parse, breaking the Release
workflow's 'Publish npm package' step. skipLibCheck does not help
since these are parse (TS1xxx) errors, not type-check errors.

Set "types": [] so tsc no longer loads @types/node global
declarations, which this protobuf-only package does not need.
Build output is unchanged.

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

**File**: `berty-bridge-expo/mobile/src/api/tsconfig.json` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
     "allowJs": true,
     "isolatedModules": true,
     "moduleResolution": "node",
+    "types": [],
   },
   "files": [
     "index.js",
```

---

### Incident Patch 8: `e939d074` (2026-07-02)
**Commit Message**: chore(bridge-expo/mobile): set up ESLint and fix all lint errors (#5150)

ESLint was never actually wired up for berty-bridge-expo/mobile: the
`expo lint` script existed but eslint wasn't installed and there was no
config, so it silently fell back to the parent module's legacy .eslintrc.

- Add eslint + eslint-config-expo (~10, the version Expo SDK 54 bundles)
  and a flat eslint.config.js.
- Fix all 96 lint errors (0 remaining):
  - react/display-name (33): name the anonymous React.memo/forwardRef
    functions (also improves DevTools names).
  - react/no-unescaped-entities (11): escape quotes/apostrophes in JSX.
  - react-hooks/rules-of-hooks (3): sounds.ts swaps the misused
    useAudioPlayer hook for imperative createAudioPlayer (released on
    finish); DeleteAccount renames _useStyles -> useDeleteAccountStyles.
  - react/no-children-prop (1) and import/export (1).
- Resolve the missing-dependency imports left over from the js/ port:
  - Delete src/contexts/eventEmitter.context.ts (dead code, only user of
    the undeclared `mitt`).
  - navigation/types.ts: StackScreenProps -> NativeStackScreenProps from
    the already-installed @react-navigation/native-stack (the app uses
  

**File**: `berty-bridge-expo/mobile/eslint.config.js` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+// https://docs.expo.dev/guides/using-eslint/
+const { defineConfig } = require('eslint/config');
+const expoConfig = require('eslint-config-expo/flat');
+
+module.exports = defineConfig([
+  expoConfig,
+  {
+    ignores: ['dist/*'],
+  },
+]);
```

**File**: `berty-bridge-expo/mobile/package.json` (modified, +3/-0)
```diff
@@ -21,6 +21,7 @@
     "@expo/vector-icons": "^15.0.3",
     "@gorhom/bottom-sheet": "^5.2.8",
     "@improbable-eng/grpc-web": "^0.15.0",
+    "@multiformats/multiaddr": "^13.0.3",
     "@react-native-async-storage/async-storage": "^2.1.2",
     "@react-native-clipboard/clipboard": "^1.16.2",
     "@react-native-community/audio-toolkit": "^2.0.3",
@@ -107,6 +108,8 @@
     "@types/jest": "^29.5.12",
     "@types/react": "~19.1.10",
     "@types/react-dom": "~19.1.7",
+    "eslint": "^9.25.0",
+    "eslint-config-expo": "~10.0.0",
     "jest": "^29.2.1",
     "jest-expo": "~54.0.16",
     "typescript": "^5.3.3"
```

**File**: `berty-bridge-expo/mobile/src/components/NotificationBody.tsx` (modified, +35/-25)
```diff
@@ -1,7 +1,7 @@
 import React, { useEffect } from 'react'
-import { Vibration } from 'react-native'
+import { Vibration, View } from 'react-native'
+import { Gesture, GestureDetector } from 'react-native-gesture-handler'
 import { useSafeAreaInsets } from 'react-native-safe-area-context'
-import GestureRecognizer from 'react-native-swipe-gestures'
 
 import beapi from '@berty/api'
 import { useStyles } from '@berty/contexts/styles'
@@ -28,30 +28,40 @@ const NotificationBody: React.FC<any> = props => {
 	const colors = useThemeColor()
 	const insets = useSafeAreaInsets()
 
+	// Swipe the banner up to dismiss it.
+	const swipeUp = React.useMemo(
+		() =>
+			Gesture.Pan()
+				.runOnJS(true)
+				.onEnd(event => {
+					if (event.translationY < -20 && typeof props.onClose === 'function') {
+						props.onClose()
+					}
+				}),
+		[props.onClose],
+	)
+
 	return (
-		<GestureRecognizer
-			onSwipe={gestureName => {
-				if (gestureName === 'SWIPE_UP' && typeof props.onClose === 'function') {
-					props.onClose()
-				}
-			}}
-			style={[
-				border.shadow.big,
-				flex.tiny,
-				flex.justify.center,
-				column.item.center,
-				{
-					backgroundColor: colors['main-background'],
-					position: 'absolute',
-					marginTop: insets?.top || 0,
-					width: '90%',
-					borderRadius: 15,
-					shadowColor: colors.shadow,
-				},
-			]}
-		>
-			<NotificationContents {...props} />
-		</GestureRecognizer>
+		<GestureDetector gesture={swipeUp}>
+			<View
+				style={[
+					border.shadow.big,
+					flex.tiny,
+					flex.justify.center,
+					column.item.center,
+					{
+						backgroundColor: colors['main-background'],
+						position: 'absolute',
+						marginTop: insets?.top || 0,
+						width: '90%',
+						borderRadius: 15,
+						shadowColor: colors.shadow,
+					},
+				]}
+			>
+				<NotificationContents {...props} />
+			</View>
+		</GestureDetector>
 	)
 }
 
```

**File**: `berty-bridge-expo/mobile/src/components/avatars.tsx` (modified, +8/-8)
```diff
@@ -29,7 +29,7 @@ export const GenericAvatar: React.FC<{
 	size: number
 	style?: AvatarStyle
 	nameSeed: Maybe<string>
-}> = React.memo(({ size, colorSeed, style, nameSeed }) => {
+}> = React.memo(function GenericAvatar({ size, colorSeed, style, nameSeed }) {
 	const colors = useThemeColor()
 
 	return (
@@ -69,7 +69,7 @@ export const HardcodedAvatar: React.FC<{
 	size: number
 	style?: AvatarStyle
 	name: HardcodedAvatarKey
-}> = React.memo(({ size, style, name }) => {
+}> = React.memo(function HardcodedAvatar({ size, style, name }) {
 	const colors = useThemeColor()
 
 	let avatar = hardcodedAvatars[name]
@@ -102,7 +102,7 @@ export const HardcodedAvatar: React.FC<{
 export const AccountAvatar: React.FC<{
 	size: number
 	style?: AvatarStyle
-}> = React.memo(({ size, style }) => {
+}> = React.memo(function AccountAvatar({ size, style }) {
 	const account = useAccount()
 	const colors = useThemeColor()
 	return (
@@ -120,7 +120,7 @@ const NameAvatar: React.FC<{
 	size: number
 	style?: AvatarStyle
 	nameSeed: Maybe<string>
-}> = React.memo(({ colorSeed, size, style, nameSeed }) => {
+}> = React.memo(function NameAvatar({ colorSeed, size, style, nameSeed }) {
 	const colors = useThemeColor()
 
 	const h = new SHA3(256).update(colorSeed || '').digest()
@@ -165,7 +165,7 @@ export const ContactAvatar: React.FC<{
 	size: number
 	style?: AvatarStyle
 	fallbackNameSeed?: Maybe<string>
-}> = React.memo(({ publicKey, size, style, fallbackNameSeed }) => {
+}> = React.memo(function ContactAvatar({ publicKey, size, style, fallbackNameSeed }) {
 	const contact = useContact(publicKey)
 	const persistentOptions = useSelector(selectPersistentOptions)
 
@@ -188,7 +188,7 @@ export const MemberAvatar: React.FC<{
 	publicKey: Maybe<string>
 	conversationPublicKey: Maybe<string>
 	size: number
-}> = React.memo(({ publicKey, conversationPublicKey, size }) => {
+}> = React.memo(function MemberAvatar({ publicKey, conversationPublicKey, size }) {
 	const member = useMember(conversationPublicKey, publicKey)
 
 	return <GenericAvatar size={size} colorSeed={publicKey} nameSeed={member?.displayName} />
@@ -199,7 +199,7 @@ export const MultiMemberAvatar: React.FC<{
 	style?: AvatarStyle
 	publicKey?: Maybe<string>
 	fallbackNameSeed?: Maybe<string>
-}> = React.memo(({ size, style, publicKey, fallbackNameSeed }) => {
+}> = React.memo(function MultiMemberAvatar({ size, style, publicKey, fallbackNameSeed }) {
 	const persistentOptions = useSelector(selectPersistentOptions)
 	const conv = useConversation(publicKey)
 	// this useMemo prevents flickering
@@ -231,7 +231,7 @@ export const ConversationAvatar: React.FC<{
 	publicKey: Maybe<string>
 	size: number
 	style?: AvatarStyle
-}> = React.memo(({ publicKey, size, style }) => {
+}> = React.memo(function ConversationAvatar({ publicKey, size, style }) {
 	const conv = useConversation(publicKey)
 	const persistentOptions = useSelector(selectPersistentOptions)
 
```

**File**: `berty-bridge-expo/mobile/src/components/buttons/Button.stories.tsx` (modified, +3/-5)
```diff
@@ -148,11 +148,9 @@ export const Buttons: Story = {
 			<ErrorButton onPress={onPress}>{"Error Button"}</ErrorButton>
 			<Spacer />
 
-			<VerticalButtons
-				children={["Vertical Buttons 1", "Vertical Buttons 2"]}
-				onPressTop={onPress}
-				onPressBottom={onPress}
-			/>
+			<VerticalButtons onPressTop={onPress} onPressBottom={onPress}>
+				{["Vertical Buttons 1", "Vertical Buttons 2"]}
+			</VerticalButtons>
 
 			<View style={styles.floatingButton}>
 				<PrimaryFloatingButton onPress={onPress} />
```

**File**: `berty-bridge-expo/mobile/src/components/chat/ChatDate.tsx` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ const useStylesChatDate = () => {
 	}
 }
 
-export const ChatDate: React.FC<ChatDateProps> = React.memo(({ date }) => {
+export const ChatDate: React.FC<ChatDateProps> = React.memo(function ChatDate({ date }) {
 	const _styles = useStylesChatDate()
 	const { border, row } = useStyles()
 	const colors = useThemeColor()
```

**File**: `berty-bridge-expo/mobile/src/components/chat/MessageList.tsx` (modified, +9/-3)
```diff
@@ -33,7 +33,7 @@ import { InfosMultiMember } from './InfosMultiMember'
 import { MemberBar } from './member-bar/MemberBar'
 import { Message } from './message'
 
-const CenteredActivityIndicator: React.FC<ActivityIndicatorProps> = React.memo(props => {
+const CenteredActivityIndicator: React.FC<ActivityIndicatorProps> = React.memo(function CenteredActivityIndicator(props) {
 	const { ...propsToPass } = props
 	return (
 		<View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
@@ -45,7 +45,7 @@ const CenteredActivityIndicator: React.FC<ActivityIndicatorProps> = React.memo(p
 const DateSeparator: React.FC<{
 	current: ParsedInteraction
 	next?: ParsedInteraction
-}> = React.memo(({ current, next }) => {
+}> = React.memo(function DateSeparator({ current, next }) {
 	const { margin } = useStyles()
 
 	if (!next) {
@@ -140,7 +140,13 @@ export const MessageList: React.FC<{
 	setShowStickyDate: (value: boolean) => void
 	isGroup?: boolean
 }> = React.memo(
-	({ id, scrollToMessage: _scrollToMessage, setStickyDate, setShowStickyDate, isGroup }) => {
+	function MessageList({
+		id,
+		scrollToMessage: _scrollToMessage,
+		setStickyDate,
+		setShowStickyDate,
+		isGroup,
+	}) {
 		const { overflow, row, flex } = useStyles()
 		const colors = useThemeColor()
 		const conversation = useConversation(id)
```

**File**: `berty-bridge-expo/mobile/src/components/chat/footer/ChatFooter.tsx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ type ChatFooterProps = {
 }
 
 export const ChatFooter: React.FC<ChatFooterProps> = React.memo(
-	({ placeholder, convPK, disabled }) => {
+	function ChatFooter({ placeholder, convPK, disabled }) {
 		const { t } = useTranslation()
 		const dispatch = useAppDispatch()
 		const sending = useAppSelector(state => selectChatInputIsSending(state, convPK))
```

---

### Incident Patch 9: `e2f5e280` (2026-07-01)
**Commit Message**: Merge pull request #5082 from berty/dependabot/go_modules/go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp-1.43.0

chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.42.0 to 1.43.0

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -79,7 +79,7 @@ require (
 	golang.org/x/tools v0.45.0
 	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da
 	google.golang.org/api v0.169.0
-	google.golang.org/grpc v1.79.3
+	google.golang.org/grpc v1.80.0
 	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/square/go-jose.v2 v2.6.0
@@ -435,14 +435,14 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.49.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
 	go.opentelemetry.io/otel v1.43.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0 // indirect
 	go.opentelemetry.io/otel/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.43.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.9.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/dig v1.19.0 // indirect
 	go.uber.org/fx v1.24.0 // indirect
 	go.uber.org/mock v0.5.2 // indirect
```

**File**: `go.sum` (modified, +8/-8)
```diff
@@ -1605,12 +1605,12 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 h1:CqXxU8V
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0/go.mod h1:BuhAPThV8PBHBvg8ZzZ/Ok3idOdhWIodywz2xEcRbJo=
 go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
 go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0 h1:THuZiwpQZuHPul65w4WcwEnkX2QIuMT+UFoOrygtoJw=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0/go.mod h1:J2pvYM5NGHofZ2/Ru6zw/TNWnEQp5crgyDeSrYpXkAw=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 h1:88Y4s2C8oTui1LGM6bTWkw0ICGcOLCAI5l6zsD1j20k=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0/go.mod h1:Vl1/iaggsuRlrHf/hfPJPvVag77kKyvrLeD10kpMl+A=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0 h1:zWWrB1U6nqhS/k6zYB74CjRpuiitRtLLi68VcgmOEto=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0/go.mod h1:2qXPNBX1OVRC0IwOnfo1ljoid+RD0QK3443EaqVlsOU=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0 h1:uLXP+3mghfMf7XmV4PkGfFhFKuNWoCvvx5wP/wOXo0o=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0/go.mod h1:v0Tj04armyT59mnURNUJf7RCKcKzq+lgJs6QSjHjaTc=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0 h1:3iZJKlCZufyRzPzlQhUIWVmfltrXuGyfjREgGP3UUjc=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0/go.mod h1:/G+nUPfhq2e+qiXMGxMwumDrP5jtzU+mWN7/sjT2rak=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0 h1:s/1iRkCKDfhlh1JF26knRneorus8aOwVIDhvYx9WoDw=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0/go.mod h1:UI3wi0FXg1Pofb8ZBiBLhtMzgoTm1TYkMvn71fAqDzs=
 go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
@@ -1621,8 +1621,8 @@ go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfC
 go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
 go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
 go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
-go.opentelemetry.io/proto/otlp v1.9.0 h1:l706jCMITVouPOqEnii2fIAuO3IVGBRPV5ICjceRb/A=
-go.opentelemetry.io/proto/otlp v1.9.0/go.mod h1:xE+Cx5E/eEHw+ISFkwPLwCZefwVjY+pqKg1qcK03+/4=
+go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
+go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/atomic v1.3.2/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.4.0/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.5.0/go.mod h1:sABNBOSYdrvTF6hTgEIbc7YasKWGhgEQZyfxyTvoXHQ=
@@ -2189,8 +2189,8 @@ google.golang.org/grpc v1.35.0/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAG
 google.golang.org/grpc v1.36.0/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAGRRjU=
 google.golang.org/grpc v1.36.1/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAGRRjU=
 google.golang.org/grpc v1.38.0/go.mod h1:NREThFqKR1f3iQ6oBuvc5LadQuXVGo9rkm5ZGrQdJfM=
-google.golang.org/grpc v1.79.3 h1:sybAEdRIEtvcD68Gx7dmnwjZKlyfuc61Dyo9pGXXkKE=
-google.golang.org/grpc v1.79.3/go.mod h1:KmT0Kjez+0dde/v2j9vzwoAScgEPx/Bw1CYChhHLrHQ=
+google.golang.org/grpc v1.80.0 h1:Xr6m2WmWZLETvUNvIUmeD5OAagMw3FiKmMlTdViWsHM=
+google.golang.org/grpc v1.80.0/go.mod h1:ho/dLnxwi3EDJA4Zghp7k2Ec1+c2jqup0bFkw07bwF4=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1 h1:F29+wU6Ee6qgu9TddPgooOdaqsxTMunOoj8KA5yuS5A=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1/go.mod h1:5KF+wpkbTSbGcR9zteSqZV6fqFOWBl4Yde8En8MryZA=
 google.golang.org/grpc/examples v0.0.0-20200922230038-4e932bbcb079 h1:unzgkDPNegIn/czOcgxzQaTzEzOiBH1V1j55rsEzVEg=
```

---

### Incident Patch 10: `f11a21db` (2026-07-01)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp](https://github.com/open-telemetry/opentelemetry-go) from 1.42.0 to 1.43.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.42.0...v1.43.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp
  dependency-version: 1.43.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -79,7 +79,7 @@ require (
 	golang.org/x/tools v0.45.0
 	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da
 	google.golang.org/api v0.169.0
-	google.golang.org/grpc v1.79.3
+	google.golang.org/grpc v1.80.0
 	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/square/go-jose.v2 v2.6.0
@@ -435,14 +435,14 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.49.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
 	go.opentelemetry.io/otel v1.43.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0 // indirect
 	go.opentelemetry.io/otel/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.43.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.9.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/dig v1.19.0 // indirect
 	go.uber.org/fx v1.24.0 // indirect
 	go.uber.org/mock v0.5.2 // indirect
```

**File**: `go.sum` (modified, +8/-8)
```diff
@@ -1605,12 +1605,12 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 h1:CqXxU8V
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0/go.mod h1:BuhAPThV8PBHBvg8ZzZ/Ok3idOdhWIodywz2xEcRbJo=
 go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
 go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0 h1:THuZiwpQZuHPul65w4WcwEnkX2QIuMT+UFoOrygtoJw=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.42.0/go.mod h1:J2pvYM5NGHofZ2/Ru6zw/TNWnEQp5crgyDeSrYpXkAw=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 h1:88Y4s2C8oTui1LGM6bTWkw0ICGcOLCAI5l6zsD1j20k=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0/go.mod h1:Vl1/iaggsuRlrHf/hfPJPvVag77kKyvrLeD10kpMl+A=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0 h1:zWWrB1U6nqhS/k6zYB74CjRpuiitRtLLi68VcgmOEto=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.42.0/go.mod h1:2qXPNBX1OVRC0IwOnfo1ljoid+RD0QK3443EaqVlsOU=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0 h1:uLXP+3mghfMf7XmV4PkGfFhFKuNWoCvvx5wP/wOXo0o=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.42.0/go.mod h1:v0Tj04armyT59mnURNUJf7RCKcKzq+lgJs6QSjHjaTc=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0 h1:3iZJKlCZufyRzPzlQhUIWVmfltrXuGyfjREgGP3UUjc=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0/go.mod h1:/G+nUPfhq2e+qiXMGxMwumDrP5jtzU+mWN7/sjT2rak=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0 h1:s/1iRkCKDfhlh1JF26knRneorus8aOwVIDhvYx9WoDw=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.42.0/go.mod h1:UI3wi0FXg1Pofb8ZBiBLhtMzgoTm1TYkMvn71fAqDzs=
 go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
@@ -1621,8 +1621,8 @@ go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfC
 go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
 go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
 go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
-go.opentelemetry.io/proto/otlp v1.9.0 h1:l706jCMITVouPOqEnii2fIAuO3IVGBRPV5ICjceRb/A=
-go.opentelemetry.io/proto/otlp v1.9.0/go.mod h1:xE+Cx5E/eEHw+ISFkwPLwCZefwVjY+pqKg1qcK03+/4=
+go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
+go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/atomic v1.3.2/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.4.0/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.5.0/go.mod h1:sABNBOSYdrvTF6hTgEIbc7YasKWGhgEQZyfxyTvoXHQ=
@@ -2189,8 +2189,8 @@ google.golang.org/grpc v1.35.0/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAG
 google.golang.org/grpc v1.36.0/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAGRRjU=
 google.golang.org/grpc v1.36.1/go.mod h1:qjiiYl8FncCW8feJPdyg3v6XW24KsRHe+dy9BAGRRjU=
 google.golang.org/grpc v1.38.0/go.mod h1:NREThFqKR1f3iQ6oBuvc5LadQuXVGo9rkm5ZGrQdJfM=
-google.golang.org/grpc v1.79.3 h1:sybAEdRIEtvcD68Gx7dmnwjZKlyfuc61Dyo9pGXXkKE=
-google.golang.org/grpc v1.79.3/go.mod h1:KmT0Kjez+0dde/v2j9vzwoAScgEPx/Bw1CYChhHLrHQ=
+google.golang.org/grpc v1.80.0 h1:Xr6m2WmWZLETvUNvIUmeD5OAagMw3FiKmMlTdViWsHM=
+google.golang.org/grpc v1.80.0/go.mod h1:ho/dLnxwi3EDJA4Zghp7k2Ec1+c2jqup0bFkw07bwF4=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1 h1:F29+wU6Ee6qgu9TddPgooOdaqsxTMunOoj8KA5yuS5A=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1/go.mod h1:5KF+wpkbTSbGcR9zteSqZV6fqFOWBl4Yde8En8MryZA=
 google.golang.org/grpc/examples v0.0.0-20200922230038-4e932bbcb079 h1:unzgkDPNegIn/czOcgxzQaTzEzOiBH1V1j55rsEzVEg=
```

---

### Incident Patch 11: `1982d3f5` (2026-06-30)
**Commit Message**: fix(ci): resolve bertymessenger test data race and Android release disk exhaustion (#5144)

* test(bertymessenger): fix data race in account update tests

TestAccountUpdate and TestFlappyAccountUpdateGroup read the
TestingAccount.account/members fields directly while the background
goroutine spawned by ProcessWholeStream writes them under processMutex,
causing a data race detected by the -race CI job.

Route those reads through the existing mutex-protected GetAccount() and
GetMember() accessors.

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

* ci(android): free runner disk space before release AAB build

The release (master) Android build runs a full multi-ABI eas local
build that compiles all native C++ modules (react-native-worklets,
expo-modules-core) for x86, x86_64, armeabi-v7a and arm64-v8a. This
exhausts the ~14GB ubuntu-latest disk, failing with 'No space left on
device' during the clang link step. PR builds only run a single-ABI
compile check, so they are unaffected.

Free unused preinstalled toolchains (.NET, GHC, Boost, Swift) and prune
Docker images before the build, keeping the Android SDK/NDK intact.

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

* test(bertymessenger): fix

**File**: `.github/workflows/android.yml` (modified, +12/-0)
```diff
@@ -27,6 +27,18 @@ jobs:
           fetch-depth: 0
           persist-credentials: false
 
+      - name: Free disk space
+        if: inputs.app-json-artifact != ''
+        run: |
+          echo "Disk space before cleanup:"
+          df -h /
+          # Remove large preinstalled toolchains unused by the Android build.
+          # Keep /usr/local/lib/android (SDK/NDK) — the build needs it.
+          sudo rm -rf /usr/share/dotnet /opt/ghc /usr/local/.ghcup /usr/local/share/boost /usr/share/swift
+          sudo docker image prune --all --force || true
+          echo "Disk space after cleanup:"
+          df -h /
+
       - name: Download patched app.json
         if: inputs.app-json-artifact != ''
         uses: actions/download-artifact@v4
```

**File**: `go/pkg/bertymessenger/service_test.go` (modified, +7/-8)
```diff
@@ -1372,10 +1372,10 @@ func TestAccountUpdate(t *testing.T) {
 	time.Sleep(4 * time.Second)
 
 	user := nodes[0]
-	userPK := user.account.GetPublicKey()
+	userPK := user.GetAccount().GetPublicKey()
 	friends := nodes[1:]
 	for _, friend := range friends {
-		_, err := user.client.ContactRequest(ctx, &messengertypes.ContactRequest_Request{Link: friend.account.GetLink()})
+		_, err := user.client.ContactRequest(ctx, &messengertypes.ContactRequest_Request{Link: friend.GetAccount().GetLink()})
 		require.NoError(t, err)
 		time.Sleep(1 * time.Second)
 		_, err = friend.client.ContactAccept(ctx, &messengertypes.ContactAccept_Request{PublicKey: userPK})
@@ -1399,7 +1399,7 @@ func TestAccountUpdate(t *testing.T) {
 
 	logger.Info("checking friends")
 	for _, friend := range friends {
-		logger.Info("checking node", zap.String("name", friend.account.GetDisplayName()))
+		logger.Info("checking node", zap.String("name", friend.GetAccount().GetDisplayName()))
 		userInFriend := friend.GetContact(t, userPK)
 		require.Equal(t, testName, userInFriend.GetDisplayName())
 	}
@@ -1469,9 +1469,8 @@ func TestFlappyAccountUpdateGroup(t *testing.T) {
 
 	logger.Info("checking friends")
 	for _, friend := range friends {
-		logger.Info("checking node", zap.String("name", friend.account.GetDisplayName()))
-		userInFriend, ok := friend.members[conv.GetAccountMemberPublicKey()]
-		require.True(t, ok)
+		logger.Info("checking node", zap.String("name", friend.GetAccount().GetDisplayName()))
+		userInFriend := friend.GetMember(t, conv.GetAccountMemberPublicKey())
 		require.Equal(t, testName, userInFriend.GetDisplayName())
 	}
 
@@ -1507,7 +1506,7 @@ func TestSendBlob(t *testing.T) {
 
 	inte := (*messengertypes.Interaction)(nil)
 
-	for _, i := range friend.interactions {
+	for _, i := range friend.GetAllInteractions() {
 		if i.GetType() == messengertypes.AppMessage_TypeUserMessage {
 			inte = i
 			break
@@ -1544,7 +1543,7 @@ func TestSendMedia(t *testing.T) {
 
 	inte := (*messengertypes.Interaction)(nil)
 
-	for _, i := range friend.interactions {
+	for _, i := range friend.GetAllInteractions() {
 		if i.GetType() == messengertypes.AppMessage_TypeUserMessage {
 			inte = i
 			break
```

**File**: `go/pkg/bertymessenger/testing.go` (modified, +10/-0)
```diff
@@ -509,6 +509,16 @@ func (a *TestingAccount) GetAllConversations() map[string]*messengertypes.Conver
 	return newMap
 }
 
+func (a *TestingAccount) GetAllInteractions() map[string]*messengertypes.Interaction {
+	a.processMutex.Lock()
+	defer a.processMutex.Unlock()
+	newMap := make(map[string]*messengertypes.Interaction)
+	for k, v := range a.interactions {
+		newMap[k] = v
+	}
+	return newMap
+}
+
 func (a *TestingAccount) TryNextEvent(t testing.TB, timeout time.Duration) *messengertypes.StreamEvent {
 	t.Helper()
 	a.openStream(t)
```

---

### Incident Patch 12: `b31e1bcb` (2026-06-25)
**Commit Message**: fix(mobile): stabilize Expo mobile build (chat, notifications, Android edge-to-edge, iOS lifecycle, logging) (#5138)

* fix(scan): keep QR scanner open after granting camera permission

The permission screen fell through after RESULTS.GRANTED and ran deny()
+ goBack() a second time, popping the share/scan screen back to home.
Now it accepts or denies, then goes back exactly once.

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

* fix(settings): pass gomobile git version to app

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

* fix(chat): correct message order and live updates for FlashList v2

FlashList v2 removed the 'inverted' prop and ignores estimatedItemSize,
so messages rendered newest-first (top) and didn't refresh until touched.
Emulate inversion with a scaleY(-1) wrapper + per-cell counter-flip, and
add maintainVisibleContentPosition autoscrollToTopThreshold so new
messages appear without interaction.

Signed-off-by: D4ryl00 <[REDACTED_EMAIL]>

* fix(notifications): suppress in active chat, route taps, dismiss on open

- Don't post a notification (push or in-app stream path) for the
  conversation the user is currently viewing.
- Harden the notification-response handler (add missing

**File**: `.github/workflows/benchmark.yml` (modified, +22/-16)
```diff
@@ -130,23 +130,26 @@ jobs:
         run: |
           mkdir -p pprof_html/head/{cpu,mem}/{top,flamegraph,peek,source}
 
+          # wait for the pprof web UI to come up before scraping it; the
+          # server can take more than a couple of seconds to start, so retry on
+          # connection refused instead of relying on a fixed sleep.
+          curl_opts="--retry-connrefused --retry 30 --retry-delay 1 --fail --silent --show-error"
+
           go tool pprof -http 0.0.0.0:9402 -no_browser ./cpu_head.prof < /dev/null & # https://github.com/google/pprof/issues/401#issuecomment-739576424
-          sleep 2
-          curl http://localhost:9402/ui/ > pprof_html/head/cpu/index.html
-          curl http://localhost:9402/ui/top > pprof_html/head/cpu/top/index.html
-          curl http://localhost:9402/ui/flamegraph > pprof_html/head/cpu/flamegraph/index.html
-          curl http://localhost:9402/ui/peek > pprof_html/head/cpu/peek/index.html
-          curl http://localhost:9402/ui/source > pprof_html/head/cpu/source/index.html
+          curl $curl_opts http://localhost:9402/ui/ > pprof_html/head/cpu/index.html
+          curl $curl_opts http://localhost:9402/ui/top > pprof_html/head/cpu/top/index.html
+          curl $curl_opts http://localhost:9402/ui/flamegraph > pprof_html/head/cpu/flamegraph/index.html
+          curl $curl_opts http://localhost:9402/ui/peek > pprof_html/head/cpu/peek/index.html
+          curl $curl_opts http://localhost:9402/ui/source > pprof_html/head/cpu/source/index.html
           pkill pprof
           sleep 2
 
           go tool pprof -http 0.0.0.0:9402 -no_browser ./mem_head.prof < /dev/null &
-          sleep 2
-          curl http://localhost:9402/ui/ > pprof_html/head/mem/index.html
-          curl http://localhost:9402/ui/top > pprof_html/head/mem/top/index.html
-          curl http://localhost:9402/ui/flamegraph > pprof_html/head/mem/flamegraph/index.html
-          curl http://localhost:9402/ui/peek > pprof_html/head/mem/peek/index.html
-          curl http://localhost:9402/ui/source > pprof_html/head/mem/source/index.html
+          curl $curl_opts http://localhost:9402/ui/ > pprof_html/head/mem/index.html
+          curl $curl_opts http://localhost:9402/ui/top > pprof_html/head/mem/top/index.html
+          curl $curl_opts http://localhost:9402/ui/flamegraph > pprof_html/head/mem/flamegraph/index.html
+          curl $curl_opts http://localhost:9402/ui/peek > pprof_html/head/mem/peek/index.html
+          curl $curl_opts http://localhost:9402/ui/source > pprof_html/head/mem/source/index.html
           pkill pprof
           sleep 2
 
@@ -183,15 +186,18 @@ jobs:
         run: |
           mkdir -p pprof_html/base_comp/{cpu,mem}
 
+          # wait for the pprof web UI to come up before scraping it; the
+          # server can take more than a couple of seconds to start, so retry on
+          # connection refused instead of relying on a fixed sleep.
+          curl_opts="--retry-connrefused --retry 30 --retry-delay 1 --fail --silent --show-error"
+
           go tool pprof -http 0.0.0.0:9402 --diff_base=./cpu_base.prof -no_browser ./cpu_head.prof < /dev/null &
-          sleep 2
-          curl http://localhost:9402/ui/ > pprof_html/base_comp/cpu/index.html
+          curl $curl_opts http://localhost:9402/ui/ > pprof_html/base_comp/cpu/index.html
           pkill pprof
           sleep 2
 
           go tool pprof -http 0.0.0.0:9402 --diff_base=./mem_base.prof -no_browser ./mem_head.prof < /dev/null &
-          sleep 2
-          curl http://localhost:9402/ui/ > pprof_html/base_comp/mem/index.html
+          curl $curl_opts http://localhost:9402/ui/ > pprof_html/base_comp/mem/index.html
           pkill pprof
           sleep 2
 
```

**File**: `.github/workflows/codeql-analysis.yml` (modified, +1/-5)
```diff
@@ -19,8 +19,6 @@ on:
       - "!**.md"
       - "go.*"
       - "**.go"
-      - "js/**"
-      - "!js/packages/i18n/locale/*/*.json"
       - ".github/workflows/codeql-analysis.yml"
   pull_request:
     # The branches below must be a subset of the branches above
@@ -30,8 +28,6 @@ on:
       - "!**.md"
       - "go.*"
       - "**.go"
-      - "js/**"
-      - "!js/packages/i18n/locale/*/*.json"
       - ".github/workflows/codeql-analysis.yml"
 
   schedule:
@@ -45,7 +41,7 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        language: ["go", "javascript"]
+        language: ["go"]
         # CodeQL supports [ 'cpp', 'csharp', 'go', 'java', 'javascript', 'python' ]
         # Learn more:
         # https://docs.github.com/en/free-pro-team@latest/github/finding-security-vulnerabilities-and-errors-in-your-code/configuring-code-scanning#changing-the-languages-that-are-analyzed
```

**File**: `.github/workflows/integration.yml` (modified, +0/-4)
```diff
@@ -15,17 +15,13 @@ on:
       - "!go/**.md"
       - "go.*"
       - "**.go"
-      - "js/**"
-      - "!js/packages/i18n/locale/*/*.json"
       - ".github/workflows/integration.yml"
   pull_request:
     paths:
       - "go/**"
       - "!go/**.md"
       - "go.*"
       - "**.go"
-      - "js/**"
-      - "!js/packages/i18n/locale/*/*.json"
       - ".github/workflows/integration.yml"
 
 # FIXME:
```

**File**: `.github/workflows/js.yml` (removed, +0/-93)
```diff
@@ -1,93 +0,0 @@
-name: JS
-on:
-  push:
-    tags:
-      - v*
-    branches:
-      - master
-    paths:
-      - "js/**"
-      - "config/**"
-      - ".github/workflows/js.yml"
-  pull_request:
-    paths:
-      - "js/**"
-      - "config/**"
-      - ".github/workflows/js.yml"
-
-jobs:
-  build-and-lint:
-    runs-on: ubuntu-latest
-    name: Build, lint and test JS
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-
-      - name: Load variables from file
-        uses: antifree/json-to-variables@v1.0.1
-        with:
-          filename: .github/workflows/utils/variables.json
-
-      - name: Setup asdf
-        uses: asdf-vm/actions/setup@9cd779f40fe38688dd19505ccbc4eaaf018b44e7
-        with:
-          asdf_version: 0.16.7
-
-      - name: Setup node
-        working-directory: js
-        run: |
-          asdf plugin add nodejs
-          asdf install nodejs
-          echo "node_version=$(asdf current nodejs | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Setup yarn
-        working-directory: js
-        run: |
-          asdf plugin add yarn
-          asdf install yarn
-
-      - name: Cache node modules
-        uses: actions/cache@v4
-        with:
-          path: js/node_modules
-          key: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-${{ hashFiles('js/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-
-
-      - name: Cache web node modules
-        uses: actions/cache@v4
-        with:
-          path: js/web/node_modules
-          key: ${{ runner.OS }}-nodeweb-${{ env.node_version }}-${{ env.json_cache-versions_nodeweb }}-${{ hashFiles('js/web/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-nodeweb-${{ env.node_version }}-${{ env.json_cache-versions_nodeweb }}-
-
-      - name: Fetch common node modules
-        working-directory: js
-        run: make node_modules
-
-      - name: Fetch web node modules
-        working-directory: js
-        run: make web/node_modules
-
-      - name: Run tests
-        working-directory: js
-        run: make test
-
-      - name: Lint
-        working-directory: js
-        run: make lint
-
-      - name: Build web client
-        working-directory: js
-        run: make web.build
-
-      - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@v2.1.0
-        env:
-          OS: ${{ runner.os }}
-          NODE: ${{ env.node_version }}
-        with:
-          file: ./js/coverage/coverage-final.json
-          flags: js.unittests
-          env_vars: OS,NODE
-          name: codecov-umbrella
-          fail_ci_if_error: false
```

**File**: `.github/workflows/mac.yml` (removed, +0/-174)
```diff
@@ -1,174 +0,0 @@
-name: macOS Release
-on:
-  push:
-    tags:
-      - v*
-    branches:
-      - master
-    paths:
-      - "go/**"
-      - "!go/**.md"
-      - ".goreleaser"
-      - "go.*"
-      - "**.go"
-      - ".github/workflows/go.yml"
-      - "js/**"
-      - "config/**"
-      - ".github/workflows/js.yml"
-  pull_request:
-    paths:
-      - "go/**"
-      - "!go/**.md"
-      - ".goreleaser"
-      - "go.*"
-      - "**.go"
-      - ".github/workflows/go.yml"
-      - "js/**"
-      - "config/**"
-      - ".github/workflows/js.yml"
-
-jobs:
-  mac_runner_matrix_builder:
-    name: macOS matrix builder
-    runs-on: ubuntu-latest
-    outputs:
-      matrix: ${{ steps.set-matrix.outputs.matrix }}
-    steps:
-      - uses: actions/checkout@v4
-        with:
-          fetch-depth: 1
-
-      - id: set-matrix
-        run: |
-          # usage: node .github/workflows/mac-runner-matrix-builder.js STRATEGY
-          #
-          #  STRATEGY
-          #    self-hosted    pick the self-hosted runner configuration
-          #    github         pick the github runner configuration
-          #    optimized      pick a dc4 runner if available or fallback on github one
-          #
-          node .github/workflows/utils/mac-runner-matrix-builder.js optimized
-
-  build-macos-app:
-    name: Build Electron app (macOS)
-    needs: mac_runner_matrix_builder
-    runs-on: ${{ matrix.runner }}
-    env:
-      CACHE_DIRS: js/android/.gomobile-cache; js/ios/.gomobile-cache; js/ios/.xcodegen-cache
-    strategy:
-      fail-fast: false
-      matrix: ${{fromJson(needs.mac_runner_matrix_builder.outputs.matrix)}}
-    steps:
-      - name: Pre-checkout cleanup
-        if: ${{ matrix.selfhosted }}
-        run: |
-          cache_dirs=(${CACHE_DIRS//;/ })
-          for cache_dir in ${cache_dirs[@]}; do
-            if [ -d "$cache_dir" ]; then
-              mkdir -p "$RUNNER_TEMP/$cache_dir"
-              rm -rf "$RUNNER_TEMP/$cache_dir"
-              mv "$cache_dir" "$RUNNER_TEMP/$cache_dir"
-            fi
-          done
-
-      - name: Checkout
-        uses: actions/checkout@v4
-
-      - name: Post-checkout cleanup
-        if: ${{ matrix.selfhosted }}
-        run: |
-          cache_dirs=(${CACHE_DIRS//;/ })
-          for cache_dir in ${cache_dirs[@]}; do
-            if [ -d "$RUNNER_TEMP/$cache_dir" ]; then
-              mv "$RUNNER_TEMP/$cache_dir" "$cache_dir"
-            fi
-          done
-
-      - name: Load variables from file
-        uses: antifree/json-to-variables@v1.0.1
-        with:
-          filename: .github/workflows/utils/variables.json
-
-      - name: Setup asdf
-        if: ${{ !matrix.selfhosted }}
-        uses: asdf-vm/actions/setup@9cd779f40fe38688dd19505ccbc4eaaf018b44e7
-        with:
-          asdf_version: 0.16.7
-
-      - name: Setup go
-        run: |
-          asdf plugin add golang || ${{ matrix.selfhosted }}
-          asdf install golang
-          echo "go_version=$(asdf current golang | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Setup node
-        working-directory: js
-        run: |
-          asdf plugin add nodejs || ${{ matrix.selfhosted }}
-          asdf install nodejs
-          echo "node_version=$(asdf current nodejs | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Setup yarn
-        working-directory: js
-        run: |
-          asdf plugin add yarn || ${{ matrix.selfhosted }}
-          asdf install yarn
-
-      - name: Cache go modules
-        uses: actions/cache@v4
-        with:
-          path: ~/go/pkg/mod
-          key: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-${{ hashFiles('go/**/go.sum') }}
-          restore-keys: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-
-
-      - name: Cache node modules
-        uses: actions/cache@v4
-        with:
-          path: js/node_modules
-          key: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-${{ hashFiles('js/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-
-
-      - name: Cache web node modules
-        uses: actions/cache@v4
-        with:
-          path: js/web/node_modules
-          key: ${{ runner.OS }}-nodeweb-${{ env.node_version }}-${{ env.json_cache-versions_nodeweb }}-${{ hashFiles('js/web/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-nodeweb-${{ env.node_version }}-${{ env.json_cache-versions_nodeweb }}-
-
-      - name: Build berty binary
-        working-directory: go
-        run: |
-          touch gen.sum # avoid triggering make generate
-          make go.install
-
-      - name: Check go.mod and go.sum
-        run: |
-          go mod tidy -v
-          git --no-pager diff go.mod go.sum
-          git --no-pager diff --quiet go.mod go.sum
-
-      - name: Fetch node modules
-        working-directory: js
-        run: make node_modules web/node_m
```

**File**: `.github/workflows/protobuf.yml` (modified, +0/-88)
```diff
@@ -8,12 +8,10 @@ on:
     paths:
       - "api/**"
       - "Makefile"
-      - "js/Makefile"
       - "go/Makefile"
       - "config/**"
       - "docs/Makefile"
       - ".github/workflows/protobuf.yml"
-      - "js/packages/i18n/locale/en/messages.json"
       - "**/gen.sum"
       - "**.pb.go"
       - "**.gen.go"
@@ -37,12 +35,10 @@ on:
     paths:
       - "api/**"
       - "Makefile"
-      - "js/Makefile"
       - "go/Makefile"
       - "config/**"
       - "docs/Makefile"
       - ".github/workflows/protobuf.yml"
-      - "js/packages/i18n/locale/en/messages.json"
       - "**/gen.sum"
       - "**.pb.go"
       - "**.gen.go"
@@ -142,87 +138,3 @@ jobs:
         if: ${{ env.APIARY_API_KEY != 0 }}
         run: |
           apiary publish --api-name=bertymessenger --path="docs/.tmp/openapi/bertymessenger.swagger.json" || true
-
-  gen-js:
-    name: Generate js protobuf
-    runs-on: ubuntu-latest
-    container: bertytech/protoc:34
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-
-      - name: Mark repository as safe
-        run: git config --global --add safe.directory $GITHUB_WORKSPACE
-
-      - name: Load variables from file
-        uses: antifree/json-to-variables@v1.0.1
-        with:
-          filename: .github/workflows/utils/variables.json
-
-      - name: Setup asdf
-        uses: asdf-vm/actions/setup@9cd779f40fe38688dd19505ccbc4eaaf018b44e7
-        with:
-          asdf_version: 0.16.7
-
-      - name: Setup yq
-        run: |
-          asdf plugin add yq
-          asdf install yq
-
-      - name: Setup node
-        working-directory: js
-        run: |
-          asdf plugin add nodejs
-          asdf install nodejs
-          echo "node_version=$(asdf current nodejs | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Setup yarn
-        working-directory: js
-        run: |
-          asdf plugin add yarn
-          asdf install yarn
-
-      - name: Setup go
-        run: |
-          asdf plugin add golang
-          asdf install golang
-          echo "go_version=$(asdf current golang | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Cleanup js gen
-        working-directory: js
-        run: make gen.clean
-
-      - name: Cache node modules
-        uses: actions/cache@v4
-        with:
-          path: js/node_modules
-          key: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-${{ hashFiles('js/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-
-
-      - name: Cache go modules
-        uses: actions/cache@v4
-        with:
-          path: ~/go/pkg/mod
-          key: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-${{ hashFiles('**/go.sum') }}
-          restore-keys: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-
-
-      - name: Fetch node modules
-        working-directory: js
-        run: make node_modules
-
-      - name: Fetch go modules
-        run: go mod download
-
-      - name: Generate js protobuf
-        working-directory: js
-        run: |
-          make _gen.pbjs
-          make _write_gen_sum
-          rm -f gen.sum && make generate
-
-      - name: Check diff
-        run: |
-          go mod tidy
-          git status | cat
-          git diff -w | cat
-          git diff-index -w --quiet HEAD --
```

**File**: `.github/workflows/release.yml` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@ on:
       - ".github/workflows/release.yml"
       - "tool/publish-npm-package"
       # NPM package
-      - "./js/packages/api"
+      - "berty-bridge-expo/mobile/src/api/**"
 
 jobs:
   semantic-release:
@@ -169,7 +169,7 @@ jobs:
 
       - name: Setup node
         if: needs.semantic-release.outputs.new-release-published == 'true'
-        working-directory: js
+        working-directory: berty-bridge-expo
         run: |
           asdf plugin add nodejs
           asdf install nodejs
@@ -180,13 +180,13 @@ jobs:
           NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
         continue-on-error: true
         working-directory: tool/publish-npm-package
-        run: go run . -path=../../js/packages/api -version=${{ needs.semantic-release.outputs.release-version }}
+        run: go run . -path=../../berty-bridge-expo/mobile/src/api -version=${{ needs.semantic-release.outputs.release-version }}
       # Next step also sets up a .npmrc file for automatic publishing to npm
 
       - name: "Publish npm package: @berty/api (DryRun)"
         if: needs.semantic-release.outputs.new-release-published != 'true'
         working-directory: tool/publish-npm-package
-        run: go run . -path=../../js/packages/api -version=0.0.0 -dry-run
+        run: go run . -path=../../berty-bridge-expo/mobile/src/api -version=0.0.0 -dry-run
 
       - name: Register version on pkg.go.dev
         if: needs.semantic-release.outputs.new-release-published == 'true'
```

**File**: `.github/workflows/ssh-runner.yml` (modified, +1/-29)
```diff
@@ -12,7 +12,7 @@ on:
           - macos-latest
           - windows-latest
       mod:
-        description: "Install Go/Node modules"
+        description: "Install Go modules"
         required: true
         default: true
         type: boolean
@@ -45,21 +45,6 @@ jobs:
           asdf install golang
           echo "go_version=$(asdf current golang | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
 
-      - name: Setup node
-        if: runner.os != 'Windows'
-        working-directory: js
-        run: |
-          asdf plugin add nodejs
-          asdf install nodejs
-          echo "node_version=$(asdf current nodejs | xargs | cut -d ' ' -f 6)" >> $GITHUB_ENV
-
-      - name: Setup yarn
-        if: runner.os != 'Windows'
-        working-directory: js
-        run: |
-          asdf plugin add yarn
-          asdf install yarn
-
       - name: Cache go modules
         if: github.event.inputs.mod == 'true' && runner.os != 'Windows'
         uses: actions/cache@v4
@@ -68,24 +53,11 @@ jobs:
           key: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-${{ hashFiles('go/**/go.sum') }}
           restore-keys: ${{ runner.os }}-go-${{ env.go_version }}-${{ env.json_cache-versions_go }}-
 
-      - name: Cache node modules
-        if: github.event.inputs.mod == 'true' && runner.os != 'Windows'
-        uses: actions/cache@v4
-        with:
-          path: js/node_modules
-          key: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-${{ hashFiles('js/yarn.lock') }}
-          restore-keys: ${{ runner.OS }}-node-${{ env.node_version }}-${{ env.json_cache-versions_node }}-
-
       - name: Fetch go modules
         if: github.event.inputs.mod == 'true' && runner.os != 'Windows'
         working-directory: go
         run: go mod tidy
 
-      - name: Fetch node modules
-        if: github.event.inputs.mod == 'true' && runner.os != 'Windows'
-        working-directory: js
-        run: make node_modules
-
       - name: Install emacs
         shell: bash
         run: |
```

#### Recent Merged Pull Requests:
- **PR #5256** (closed): fix(deps): bump brace-expansion from 1.1.11 to 1.1.21 in /js (@dependabot[bot])
- **PR #5255** (closed): chore(deps): bump brace-expansion from 1.1.11 to 1.1.21 in /tool/game-utils/game-dev-app (@dependabot[bot])
- **PR #5254** (closed): fix(deps): bump moment from 2.29.4 to 2.31.0 in /js (@dependabot[bot])
- **PR #5253** (closed): chore(deps): bump joi from 17.6.0 to 17.13.8 in /js/web (@dependabot[bot])
- **PR #5252** (closed): chore(deps): bump joi from 17.6.0 to 17.13.8 in /tool/game-utils/game-dev-app (@dependabot[bot])
- **PR #5251** (closed): chore(deps): bump brace-expansion in /js/e2e-tests (@dependabot[bot])
- **PR #5250** (2026-10-02): chore(deps): bump moment from 2.30.1 to 2.31.0 in /berty-bridge-expo/mobile (@dependabot[bot])
- **PR #5245** (closed): chore(deps-dev): bump electron from 13.6.9 to 41.10.6 in /js/web (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
