# Forensic Learning Record (Deep Inspection): MohamedRejeb/Calf

> **Canonical Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-calf-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MohamedRejeb/Calf](https://github.com/MohamedRejeb/Calf))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:00:56.888Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MohamedRejeb/Calf`
- **Description**: Calf is a library that allows you to easily create adaptive UIs and access platform specific APIs with Compose Multiplatform (Adaptive UI, File Picker, WebView, Permissions...).
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1725 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `calf-file-picker/native/src/lib.rs`
```
use jni::objects::{JClass, JObjectArray, JString};
use jni::sys::{jboolean, jlong, jobjectArray, jstring, JNI_TRUE};
use jni::JNIEnv;
use raw_window_handle::{
    HandleError, HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle,
};
use rfd::FileDialog;
use std::path::PathBuf;
use std::ptr::NonNull;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Convert a JString to a Rust String, returning None for null.
fn jstring_to_string(env: &mut JNIEnv, js: &JString) -> Option<String> {
    if js.is_null() {
        return None;
    }
    env.get_string(js).ok().map(|s| s.into())
}

/// Convert a Java String[] to Vec<String>, properly releasing JNI local references.
fn jstring_array_to_vec(env: &mut JNIEnv, array: &JObjectArray) -> Vec<String> {
    let len = env.get_array_length(array).unwrap_or(0);
    let mut result = Vec::with_capacity(len as usize);
    for i in 0..len {
        if let Ok(obj) = env.get_object_array_element(array, i) {
            let jstr: JString = obj.into();
            if let Some(s) = jstring_to_string(env, &jstr) {
                result.push(s);
            }
            let _ = env.delete_local_ref(jstr);
        }
    }
    result
}

/// Convert a Vec of paths to a Java String[], with proper error handling.
fn paths_to_jstring_array(
    env: &mut JNIEnv,
    paths: &[PathBuf],
) -> Result<jobjectArray, jni::errors::Error> {
    let string_class = env.find_class("java/lang/String")?;
    let array = env.new_object_array(paths.len() as i32, &string_class, JString::default())?;

    for (i, path) in paths.iter().enumerate() {
        let path_str = match path.to_str() {
            Some(s) => s.to_owned(),
            None => path.to_string_lossy().into_owned(),
        };
        let jstr = env.new_string(&path_str)?;
        env.set_object_array_element(&array, i as i32, &jstr)?;
        env.delete_local_ref(jstr)?;
    }

    Ok(array.into_raw())
}

/// Convert a path to a jstring, returning null on failure.
fn path_to_jstring(env: &mut JNIEnv, path: &std::path::Path) -> jstring {
    let s = match path.to_str() {
        Some(s) => s.to_owned(),
        None => path.to_string_lossy().into_owned(),
    };
    env.new_string(&s)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Throw a Java RuntimeException with the given message.
fn throw_runtime_exception(env: &mut JNIEnv, msg: &str) {
    let _ = env.throw_new("java/lang/RuntimeException", msg);
}

/// Wrapper that catches panics and converts them to Java exceptions.
fn catch_panic_and_throw<F, T>(env: &mut JNIEnv, fallback: T, f: F) -> T
where
    F: FnOnce(&mut JNIEnv) -> T + std::panic::UnwindSafe,
{
    let env_ptr = env as *mut JNIEnv;
    match std::panic::catch_unwind(|| {
        let env = unsafe { &mut *env_ptr };
        f(env)
    }) {
        Ok(result) => result,
        Err(panic_info) => {
            let msg = if let Some(s) = panic_info.downcast_ref::<&str>() {
                format!("Native panic: {}", s)
            } else if let Some(s) = panic_info.downcast_ref::<String>() {
                format!("Native panic: {}", s)
            } else {
                "Native panic: unknown error".to_string()
            };
            throw_runtime_exception(env, &msg);
            fallback
        }
    }
}

// ---------------------------------------------------------------------------
// Parent window handle wrapper
// ---------------------------------------------------------------------------

/// A wrapper that implements HasWindowHandle + HasDisplayHandle for rfd::set_parent.
/// Constructed from a raw native window pointer passed from the JVM.
struct ParentWindow {
    raw_window: RawWindowHandle,
    raw_display: RawDisplayHandle,
}

// Safety: The window handle comes from the JVM's AWT thread and is valid
// for the duration of the dialog. rfd internally dispatches to the correct thread.
unsafe impl Send for ParentWindow {}
unsafe impl Sync for ParentWindow {}

impl HasWindowHandle for ParentWindow {
    fn window_handle(&self) -> Result<raw_window_handle::WindowHandle<'_>, HandleError> {
        // Safety: The raw handle is valid for the lifetime of this struct.
        Ok(unsafe { raw_window_handle::WindowHandle::borrow_raw(self.raw_window) })
    }
}

impl HasDisplayHandle for ParentWindow {
    fn display_handle(&self) -> Result<raw_window_handle::DisplayHandle<'_>, HandleError> {
        // Safety: The raw handle is valid for the lifetime of this struct.
        Ok(unsafe { raw_window_handle::DisplayHandle::borrow_raw(self.raw_display) })
    }
}

impl ParentWindow {
    /// Create a ParentWindow from a native window pointer.
    /// Returns None if the pointer is 0 (no parent).
    fn from_raw_ptr(ptr: jlong) -> Option<Self> {
        if ptr == 0 {
            return None;
        }

        #[cfg(target_os = "macos")]
        {
            use objc2::rc::Retained;
            use objc2_app_kit::{NSView, NSWindow};
            use raw_window_handle::{AppKitDisplayHandle, AppKitWindowHandle};

            // ComposeWindow.windowHandle returns an NSWindow pointer.
            // AppKitWindowHandle expects an NSView pointer.
            // Get the contentView from the NSWindow.
            let ns_window_ptr = ptr as *mut NSWindow;
            let ns_window: Retained<NSWindow> =
                unsafe { Retained::retain(ns_window_ptr) }?;
            let ns_view: Retained<NSView> = ns_window.contentView()?;
            let ns_view_ptr =
                NonNull::new(Retained::as_ptr(&ns_view) as *mut std::ffi::c_void)?;

            let raw_window = RawWindowHandle::AppKit(AppKitWindowHandle::new(ns_view_ptr));
            // Note: ns_window and ns_view are kept alive by the NSWindow's
            // own strong reference. We just need the pointer value here.
            let raw_display = RawDisplayHandle::AppKit(AppKitDisplayHandle::new());
            Some(ParentWindow {
                raw_window,
                raw_display,
            })
        }

        #[cfg(target_os = "windows")]
        {
            use raw_window_handle::{Win32WindowHandle, WindowsDisplayHandle};
            let mut handle = Win32WindowHandle::new(unsafe {
                std::num::NonZero::new_unchecked(ptr as isize)
            });
            let raw_window = RawWindowHandle::Win32(handle);
            let raw_display = RawDisplayHandle::Windows(WindowsDisplayHandle::new());
            Some(ParentWindow {
                raw_window,
                raw_display,
            })
        }

        #[cfg(target_os = "linux")]
        {
            // On Linux, rfd uses GTK which manages its own display connection.
            // The parent window hint is best-effort - GTK may ignore it
            // if the display handle does not match its internal connection.
            // The Window ID is still useful for focus/stacking behavior.
            use raw_window_handle::{XlibDisplayHandle, XlibWindowHandle};
            let raw_window = RawWindowHandle::Xlib(XlibWindowHandle::new(ptr as u64));
            let raw_display = RawDisplayHandle::Xlib(XlibDisplayHandle::new(None, 0));
            Some(ParentWindow {
                raw_window,
                raw_display,
            })
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            None
        }
    }
}

// ---------------------------------------------------------------------------
// Stored dialog configuration
// ---------------------------------------------------------------------------

/// The type of dialog to show.
enum DialogKind {
    PickFiles { multiple: bool },
    PickDirectory,
    SaveFile { default_name: Option<String> },
}

/// Stores dialog configuration so it can be reused across multiple show() calls.
struct DialogConfig {
    kind: DialogKind,
    title: Option<St
```

### Core Architecture Module: `calf-share/native/src/lib.rs`
```
use jni::objects::{JClass, JObjectArray, JString};
use jni::sys::{jint, jlong};
use jni::JNIEnv;

// Result codes returned to Kotlin
const RESULT_SUCCESS: jint = 0;
const RESULT_DISMISSED: jint = 1;
const RESULT_UNAVAILABLE: jint = 2;

/// No-op — forces the library to load eagerly from Kotlin.
#[no_mangle]
pub extern "system" fn Java_com_mohamedrejeb_calf_share_platform_NativeShareBridge_init(
    _env: JNIEnv,
    _class: JClass,
) {
}

/// Returns true if native share is supported on this platform (macOS only).
#[no_mangle]
pub extern "system" fn Java_com_mohamedrejeb_calf_share_platform_NativeShareBridge_isNativeShareSupported(
    _env: JNIEnv,
    _class: JClass,
) -> bool {
    cfg!(target_os = "macos")
}

/// Show the native share sheet.
#[no_mangle]
pub extern "system" fn Java_com_mohamedrejeb_calf_share_platform_NativeShareBridge_showShareSheet(
    mut env: JNIEnv,
    _class: JClass,
    text: JString,
    url: JString,
    file_paths: JObjectArray,
    parent_window: jlong,
) -> jint {
    let text_str = jstring_to_string(&mut env, &text);
    let url_str = jstring_to_string(&mut env, &url);
    let paths = if file_paths.is_null() {
        Vec::new()
    } else {
        jstring_array_to_vec(&mut env, &file_paths)
    };

    show_share_sheet(text_str, url_str, paths, parent_window)
}

fn jstring_to_string(env: &mut JNIEnv, js: &JString) -> Option<String> {
    if js.is_null() {
        return None;
    }
    env.get_string(js).ok().map(|s| s.into())
}

fn jstring_array_to_vec(env: &mut JNIEnv, array: &JObjectArray) -> Vec<String> {
    let len = env.get_array_length(array).unwrap_or(0);
    let mut result = Vec::with_capacity(len as usize);
    for i in 0..len {
        if let Ok(obj) = env.get_object_array_element(array, i) {
            let jstr: JString = obj.into();
            if let Some(s) = jstring_to_string(env, &jstr) {
                result.push(s);
            }
            let _ = env.delete_local_ref(jstr);
        }
    }
    result
}

// ---- macOS implementation ----

#[cfg(target_os = "macos")]
fn show_share_sheet(
    text: Option<String>,
    url: Option<String>,
    file_paths: Vec<String>,
    parent_window: jlong,
) -> jint {
    use std::ffi::c_void;
    use std::sync::{Arc, Condvar, Mutex};

    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject, Sel};
    #[allow(deprecated)]
    use objc2::msg_send_id;
    use objc2::{class, msg_send, sel, MainThreadMarker};
    use objc2::declare::ClassBuilder;
    use objc2_app_kit::{NSApplication, NSEvent, NSView, NSWindow};
    use objc2_foundation::{
        NSArray, NSObject, NSPoint, NSRect, NSSize, NSString, NSURL,
    };

    // Build the items array
    let mut items: Vec<Retained<NSObject>> = Vec::new();

    if let Some(ref t) = text {
        let ns_string = NSString::from_str(t);
        items.push(Retained::into_super(ns_string));
    }

    if let Some(ref u) = url {
        let ns_url_string = NSString::from_str(u);
        if let Some(ns_url) = NSURL::URLWithString(&ns_url_string) {
            items.push(Retained::into_super(ns_url));
        }
    }

    for path in &file_paths {
        let ns_path = NSString::from_str(path);
        let file_url = NSURL::fileURLWithPath(&ns_path);
        items.push(Retained::into_super(file_url));
    }

    if items.is_empty() {
        return RESULT_UNAVAILABLE;
    }

    // Shared state for completion signaling
    let pair = Arc::new((Mutex::new(None::<jint>), Condvar::new()));
    let pair_for_block = pair.clone();

    let items_array = NSArray::from_retained_slice(&items);

    // Register a delegate class at runtime using ClassBuilder.
    // The delegate stores a pointer to the Arc pair in an ivar.
    static DELEGATE_CLASS_INIT: std::sync::Once = std::sync::Once::new();
    static mut DELEGATE_CLASS: *const AnyClass = std::ptr::null();

    DELEGATE_CLASS_INIT.call_once(|| {
        let superclass = AnyClass::get(c"NSObject").unwrap();
        let mut builder = ClassBuilder::new(c"CalfShareDelegate", superclass).unwrap();

        // Add an ivar to store the context pointer
        builder.add_ivar::<*mut c_void>(c"_pairPtr");

        // sharingServicePicker:didChooseSharingService:
        unsafe extern "C" fn did_choose(
            this: *const AnyObject,
            _sel: Sel,
            _picker: *const AnyObject,
            service: *const AnyObject,
        ) {
            unsafe {
                let ivar = AnyClass::get(c"CalfShareDelegate")
                    .unwrap()
                    .instance_variable(c"_pairPtr")
                    .unwrap();
                let ptr: *mut c_void = *ivar.load::<*mut c_void>(&*this);
                if ptr.is_null() {
                    return;
                }
                // Reconstruct the Arc, signal, then forget to avoid dropping
                let pair = Arc::from_raw(ptr as *const (Mutex<Option<jint>>, Condvar));
                let chosen = !service.is_null();
                {
                    let (lock, cvar) = &*pair;
                    let mut result = lock.lock().unwrap();
                    *result = Some(if chosen { RESULT_SUCCESS } else { RESULT_DISMISSED });
                    cvar.notify_one();
                }
                // Don't drop the Arc — the waiting thread still holds one
                std::mem::forget(pair);
            }
        }

        unsafe {
            builder.add_method(
                sel!(sharingServicePicker:didChooseSharingService:),
                did_choose
                    as unsafe extern "C" fn(*const AnyObject, Sel, *const AnyObject, *const AnyObject),
            );
        }

        let cls = builder.register();
        unsafe {
            DELEGATE_CLASS = cls as *const AnyClass;
        }
    });

    // Dispatch to main thread via libdispatch
    extern "C" {
        // &_dispatch_main_q as *const c_void is a macro; the actual symbol is _dispatch_main_q
        static _dispatch_main_q: c_void;
        fn dispatch_async_f(
            queue: *const c_void,
            context: *mut c_void,
            work: extern "C" fn(*mut c_void),
        );
    }

    struct ShareContext {
        items_array: Retained<NSArray<NSObject>>,
        parent_window: jlong,
        pair: Arc<(Mutex<Option<jint>>, Condvar)>,
    }
    unsafe impl Send for ShareContext {}

    extern "C" fn execute_on_main(context: *mut c_void) {
        let ctx = unsafe { Box::from_raw(context as *mut ShareContext) };

        // Get the window: use the provided handle, or fall back to NSApp's keyWindow
        let ns_window: Retained<NSWindow> = if ctx.parent_window != 0 {
            let ns_window_ptr = ctx.parent_window as *mut NSWindow;
            match unsafe { Retained::retain(ns_window_ptr) } {
                Some(w) => w,
                None => {
                    let (lock, cvar) = &*ctx.pair;
                    *lock.lock().unwrap() = Some(RESULT_UNAVAILABLE);
                    cvar.notify_one();
                    return;
                }
            }
        } else {
            // Safe: execute_on_main runs on the main thread via dispatch_async
            let mtm = unsafe { MainThreadMarker::new_unchecked() };
            let app = NSApplication::sharedApplication(mtm);
            match app.keyWindow() {
                Some(w) => w,
                None => {
                    let (lock, cvar) = &*ctx.pair;
                    *lock.lock().unwrap() = Some(RESULT_UNAVAILABLE);
                    cvar.notify_one();
                    return;
                }
            }
        };

        let ns_view: Retained<NSView> = match ns_window.contentView() {
            Some(v) => v,
            None => {
                let (lock, cvar) = &*ctx.pair;
                *lock.lock().unwrap() = Some(RESULT_UNAVAILABLE);
                cvar.notify_one();
                return;
            }
        };

        // Create NSSharingServicePicker
        let picker_class = clas
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #538** (2026-08-16): **[Bug] specified class size for type 'CalfToggle' is smaller than the parent type's 'GtkRange' class size**
  *Symptoms*: ### Steps to Reproduce  Calf 0.90.8 Gtk+ 2.24.33 Ardour 9.2.0 build with GCC version 14.3.1 Linux 6.18.32   Adding a Calf plugin (e. g. Calf Compressor) in a bus in Ardour crashes. Plugins by other vendors are not affected.  The following message appears in the console:  ``` CALF DEBUG: instance 0x558b6fb61cc0 data 0x558b6fa9b670 CALF DEBUG: calf 0x7f3c55fc2db0 cpi 0x7f3c557cf770  (ardour-9.2.0:93312): GLib-GObject-CRITICAL **: 23:40:06.175: specified class size for type 'CalfToggle' is smaller than the parent type's 'GtkRange' class size  (ardour-9.2.0:93312): GLib-GObject-CRITICAL **: 23:40:06.176: g_object_new_with_properties: assertion 'G_TYPE_IS_OBJECT (object_type)' failed ```       ### Expected Behavior  Calf plugins should load  ### Actual Behavior  DAW crashes  ### Module  calf-ui  ### Specify Other Module (if you selected "other" above)  _No response_  ### Platform  Desktop  ### Library Version  _No response_
  **Post-Mortem & Fix Analysis**:
  > Sorry, this is the wrong project. I reposted the issue at  https://github.com/calf-studio-gear/calf

- **Issue #536** (2026-09-11): **[Bug]: Alert dialog single button**
  *Symptoms*: ### Steps to Reproduce  It is currently impossible to have an alert dialog on iOS with a single button  ### Expected Behavior  We should be able to have a single button on an alert dialog  ### Actual Behavior  If we set an empty string, we get a blank button  ### Module  calf-ui  ### Specify Other Module (if you selected "other" above)  _No response_  ### Platform  iOS  ### Library Version  0.12.0
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, it's now available in `0.14.0` Docs: https://mohamedrejeb.github.io/Calf/filepicker/#streaming-with-kotlinx-io

- **Issue #534** (2026-09-11): **ExceptionInInitializerError: Using same DLL in 2 Different Product flavor released App on same system running at same time**
  *Symptoms*: ### Steps to Reproduce  1. Add File picker dependency 2. use 2 or more product flavor in your app 3. use both app with different product flavor on 1 system at same time  ### Expected Behavior  normally run both apps  ### Actual Behavior  got exception:  java.lang.ExceptionInInitializerError 	at com.mohamedrejeb.calf.picker.platform.PlatformFilePicker.createFilePickerHandle(PlatformFilePicker.kt:33) 	at com.mohamedrejeb.calf.picker.FilePickerLauncher_desktopKt$rememberFilePickerLauncherInternal$1$1$1$handle$1.invokeSuspend(FilePickerLauncher.desktop.kt:124) 	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34) 	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100) 	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124) 	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89) 	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:798) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:704) 	Suppressed: kotlinx.coroutines.internal.DiagnosticCoroutineContextException: [kotlinx.coroutines.UndispatchedMarker@41248ba4, androidx.compose.runtime.BroadcastFrameClock@37ce8417, androidx.compose.runtime.LaunchedEffectImpl@9e61d6d, StandaloneCoroutine{Ca
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, try updating to `0.14.0` and the issue should be fixed automatically

- **Issue #408** (2026-07-20): **AdaptiveBottomSheet: weird scroll issue on iOS**
  *Symptoms*: https://github.com/user-attachments/assets/51d80d51-4c4c-4743-96bc-6248b994d726  Also reproducing on my physical iOS 18.6.2 device  ## Environment ``` kotlin = 2.3.0 compose-multiplatform = 1.10.0 calf = 0.9.0 ```  ## Sample code ```kotlin @OptIn(ExperimentalMaterial3Api::class) @Composable fun TestSheet(     onDismissRequest: () -> Unit ) {     AdaptiveBottomSheet(         adaptiveSheetState = rememberAdaptiveSheetState(skipPartiallyExpanded = true),         dragHandle = null,         onDismissRequest = onDismissRequest     ) {         LazyColumn(             modifier = Modifier.fillMaxSize()         ) {             items(100) {                 Text(                     modifier = Modifier                         .fillMaxWidth()                         .padding(16.dp),                     text = "${it.inc()}"                 )             }         }     } } ```
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this, Can you try updating Compose to 1.11.0, that should fix the issue Fixed in https://github.com/JetBrains/compose-multiplatform-core/pull/2883

- **Issue #381** (2026-03-14): **AdaptiveAlertDialog crashes iOS app**
  *Symptoms*: When clicking outside of AdaptiveAlertDialog, the iOS app crashes. But it works well, when using buttons. Here the code to reproduce: ``` var showDialog by remember {         mutableListOf(false)     }  // Button to trigger the dialog  // Show the dialog when state is true     if (showDialog) {         AdaptiveAlertDialog(             onConfirm = {                 // Handle confirmation                 showDialog = false             },             onDismiss = {                 // Handle dismissal                 showDialog = false             },             confirmText = "OK",             dismissText = "Cancel",             title = "Alert Dialog",             text = "This is a native alert dialog from Calf",             // Optional: Customize iOS dialog style             iosDialogStyle = AlertDialogIosStyle.Alert, // or ActionSheet             iosConfirmButtonStyle = AlertDialogIosActionStyle.Default,             iosDismissButtonStyle = AlertDialogIosActionStyle.Destructive,         )     }      Box(modifier = Modifier.fillMaxSize()) {         Button(             onClick = { showDialog = true },         ) {             Text("Show Alert Dialog")         }     } ``` Any solution? Thanks.
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this issue What's the iOS version you are using?
  > 26.1 (Virtual device)
  > Hello @MohamedRejeb, is anything new about this crash?

- **Issue #363** (2026-05-16): **Scrolling AdaptiveBottomSheet**
  *Symptoms*: Hello. Is it possible to make AdaptiveBottomSheet  vertically scrollable?
  **Post-Mortem & Fix Analysis**:
  > Not the same, but similar issue on IOS.  I've added a Scaffold inside of the AdaptiveBottomSheet with bottom bar and a LazyColumn as it's content, the sheet isn't being closed but being over scrolled. Is it possible to close the sheet when it's no longer forward scrollable?  https://github.com/user-attachments/assets/666b9e8f-d959-40e1-8708-21e748a455ea
  > Hello Can you share a video of the problem please @lemkoleg , because you should be able to use a vertical scroll inside the bottom sheet, check the sample I'm already using it: https://github.com/MohamedRejeb/Calf/blob/main/sample/common/src/commonMain/kotlin/com.mohamedrejeb.calf.sample/screens/BottomSheetScreen.kt
  > Currently that's a limitation from Compose for the over scroll, I'll check if they added an option to support that.

- **Issue #280** (2026-09-12): **FilePicker crashes on Linux Debian Trixie**
  *Symptoms*: Hey,  I just tried your FilePicker: ``` val openPicker = rememberFilePickerLauncher(     type = FilePickerFileType.Extension(listOf("cub")),     selectionMode = FilePickerSelectionMode.Single,     onResult = { file ->      } )  IconButton(onClick = openPicker::launch) {     Icon(         imageVector = Icons.Default.FolderOpen,         contentDescription = i18n.menuFileOpen     ) } ```  However it crashes with the following error:  ``` Caused by: java.lang.ClassCastException: class kotlin.coroutines.jvm.internal.CompletedContinuation cannot be cast to class kotlinx.coroutines.internal.DispatchedContinuation (kotlin.coroutines.jvm.internal.CompletedContinuation and kotlinx.coroutines.internal.DispatchedContinuation are in unnamed module of loader 'app') ```  
  **Post-Mortem & Fix Analysis**:
  > Hello thanks for reporting this issue, working on fixing it.
  > Should be working fine in the latest release, feel free to reopen if you still have issues

- **Issue #277** (2026-03-31): **No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }**
  *Symptoms*: When using:  ```kotlin rememberFilePickerLauncher(       type = FilePickerFileType.Image,       selectionMode = FilePickerSelectionMode.Single, ) ```  on an Android Simulator with Android 35, I'm getting:  > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }  Is there any reason why `PICK_IMAGES` is used and not `Intent.ACTION_GET_CONTENT`? 
  **Post-Mortem & Fix Analysis**:
  > > When using: >  > rememberFilePickerLauncher( >       type = FilePickerFileType.Image, >       selectionMode = FilePickerSelectionMode.Single, > ) > on an Android Simulator with Android 35, I'm getting: >  > > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) } >  > Is there any reason why `PICK_IMAGES` is used and not `Intent.ACTION_GET_CONTENT`?  When using rememberFilePickerLauncher with FilePickerFileType.Image on an Android emulator running Android 35, you might encounter this exception:  > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }  This happens because Intent.ACTION_PICK_IMAGES (introduced in Android 13) relies on the presence of a compatible photo picker app or system component that handles the PICK_IMAGES action. On some emulators or devices without a default gallery or photo pick

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

### Incident Patch 1: `0e601976` (2026-09-12)
**Commit Message**: Merge pull request #542 from MohamedRejeb/fix/nav-host-state-restore

fix(navigation): keep each destination's saved state while it is on the back stack

**File**: `calf-navigation/build.gradle.kts` (modified, +9/-0)
```diff
@@ -8,6 +8,15 @@ kotlin {
         implementation(libs.compose.material3)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.android.navigation.compose)
     }
```

**File**: `calf-navigation/src/commonMain/kotlin/com.mohamedrejeb.calf/navigation/AdaptiveNavHost.kt` (modified, +28/-2)
```diff
@@ -3,7 +3,10 @@ package com.mohamedrejeb.calf.navigation
 import androidx.compose.foundation.layout.Box
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.saveable.SaveableStateHolder
+import androidx.compose.runtime.saveable.rememberSaveableStateHolder
 import androidx.compose.ui.Modifier
 
 @Composable
@@ -28,11 +31,34 @@ fun AdaptiveNavHost(
             navController.navigate(startDestination)
     }
 
+    // Keeps each destination's `rememberSaveable` state (list positions, form input) while the
+    // destination stays on the back stack, so coming back restores it.
+    val saveableStateHolder = rememberSaveableStateHolder()
+    ForgetPoppedDestinations(navController, saveableStateHolder)
+
     Box(modifier = modifier) {
         navController.currentDestination?.let { currentDestination ->
             graphBuilder.destinations.find { it.route == currentDestination }?.let { destination ->
-                destination.content(destination.arguments)
+                saveableStateHolder.SaveableStateProvider(key = currentDestination) {
+                    destination.content(destination.arguments)
+                }
             }
         }
     }
-}
\ No newline at end of file
+}
+
+/** Drops the saved state of destinations that left the back stack, so a later visit starts fresh. */
+@Composable
+private fun ForgetPoppedDestinations(
+    navController: AdaptiveNavHostController,
+    saveableStateHolder: SaveableStateHolder,
+) {
+    val routesOnStack = navController.backStack.toSet()
+    val retainedRoutes = remember { mutableSetOf<String>() }
+
+    SideEffect {
+        (retainedRoutes - routesOnStack).forEach(saveableStateHolder::removeState)
+        retainedRoutes.clear()
+        retainedRoutes.addAll(routesOnStack)
+    }
+}
```

**File**: `calf-navigation/src/desktopTest/kotlin/com/mohamedrejeb/calf/navigation/AdaptiveNavHostStateTest.kt` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package com.mohamedrejeb.calf.navigation
+
+import androidx.compose.material3.Button
+import androidx.compose.material3.Text
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+private const val HOME = "home"
+private const val DETAIL = "detail"
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveNavHostStateTest {
+
+
+    @Test
+    fun `saveable state of a destination survives navigating away and back`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Counter(label = HOME) }
+                composable(DETAIL) { Text(DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        onNodeWithText("$HOME 0").performClick()
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText(DETAIL).assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+    }
+
+    @Test
+    fun `saveable state of a popped destination is dropped`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Text(HOME) }
+                composable(DETAIL) { Counter(label = DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText("$DETAIL 0").performClick()
+        onNodeWithText("$DETAIL 1").assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+        navController.navigate(DETAIL)
+        waitForIdle()
+
+        onNodeWithText("$DETAIL 0").assertIsDisplayed()
+    }
+}
+
+@androidx.compose.runtime.Composable
+private fun Counter(label: String) {
+    var count by rememberSaveable { mutableStateOf(0) }
+    Button(onClick = { count++ }) {
+        Text("$label $count")
+    }
+}
```

---

### Incident Patch 2: `e535b7a5` (2026-09-12)
**Commit Message**: Merge pull request #541 from MohamedRejeb/fix/date-picker-selectable-dates

feat(ui): add a cross-platform selectable dates rule to AdaptiveDatePicker

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDatePickerState.kt` (modified, +42/-2)
```diff
@@ -5,6 +5,23 @@ import androidx.compose.runtime.*
 import androidx.compose.runtime.saveable.Saver
 import androidx.compose.runtime.saveable.rememberSaveable
 
+/**
+ * Creates and remembers an [AdaptiveDatePickerState].
+ *
+ * @param initialSelectedDateMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a date. Provide a `null` to indicate no selection.
+ * @param initialDisplayedMonthMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a month to be displayed to the user. In case `null` is
+ * provided, the displayed month would be the current one.
+ * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
+ * to
+ * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates the rule deciding which days can be picked, see
+ * [AdaptiveDatePickerState.selectableDates]. Use [DateBounds] for a minimum and maximum day and
+ * [and] to combine rules. Pass a stable instance (for example an `object`, a `data class` or a
+ * remembered value) so the picker does not re-evaluate on every recomposition.
+ */
 @Composable
 @ExperimentalMaterial3Api
 fun rememberAdaptiveDatePickerState(
@@ -13,17 +30,22 @@ fun rememberAdaptiveDatePickerState(
     yearRange: IntRange = DatePickerDefaults.YearRange,
     initialMaterialDisplayMode: DisplayMode = DisplayMode.Picker,
     initialUIKitDisplayMode: UIKitDisplayMode = UIKitDisplayMode.Picker,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ): AdaptiveDatePickerState =
     rememberSaveable(
-        saver = AdaptiveDatePickerState.Saver(),
+        saver = AdaptiveDatePickerState.Saver(selectableDates),
     ) {
         AdaptiveDatePickerState(
             initialSelectedDateMillis = initialSelectedDateMillis,
             initialDisplayedMonthMillis = initialDisplayedMonthMillis,
             yearRange = yearRange,
             initialMaterialDisplayMode = initialMaterialDisplayMode,
             initialUIKitDisplayMode = initialUIKitDisplayMode,
+            selectableDates = selectableDates,
         )
+    }.apply {
+        // Keep the rule in sync when the caller passes a new one on recomposition.
+        this.selectableDates = selectableDates
     }
 
 /**
@@ -43,6 +65,8 @@ fun rememberAdaptiveDatePickerState(
  * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
  * to
  * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates initial value of [AdaptiveDatePickerState.selectableDates]
  * @see rememberAdaptiveDatePickerState
  * @throws [IllegalArgumentException] if the initial selected date or displayed month represent
  * a year that is out of the year range.
@@ -55,6 +79,7 @@ expect class AdaptiveDatePickerState(
     yearRange: IntRange,
     initialMaterialDisplayMode: DisplayMode,
     initialUIKitDisplayMode: UIKitDisplayMode,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ) {
     /**
      * A timestamp that represents the _start_ of the day of the selected date in _UTC_ milliseconds
@@ -87,11 +112,26 @@ expect class AdaptiveDatePickerState(
      */
     var displayMode: DisplayMode
 
+    /**
+     * The [SelectableDates] rule deciding which days can be picked. Use [DateBounds] for a
+     * minimum and maximum day, and [and] to combine rules.
+     *
+     * Honoured by the Material picker and by the iOS 16+ calendars, where rejected days are
+     * greyed out; bounds coming from a [DateBounds] are also applied natively, so the iOS wheels
+     * stop at the range. The iOS wheels picker, and the inline picker below iOS 16, cannot grey
+     * out days: a rejected day is sna
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBounds.kt` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.Immutable
+
+/**
+ * A [SelectableDates] rule that accepts the days from [minDateMillis] to [maxDateMillis], both
+ * inclusive and compared per UTC day, so any timestamp inside the first or last day keeps that
+ * whole day selectable. A `null` bound is open on that side.
+ *
+ * Besides greying out days, the pickers apply these bounds natively: the iOS wheels stop at the
+ * range and the calendars hide the months outside it. Combine with other rules using [and].
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+data class DateBounds(
+    val minDateMillis: Long? = null,
+    val maxDateMillis: Long? = null,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        isDayWithinBounds(utcTimeMillis, minDateMillis, maxDateMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        isYearWithinBounds(year, minDateMillis, maxDateMillis)
+}
+
+/** A rule that accepts a day, or a year, only when both this rule and [other] accept it. */
+@OptIn(ExperimentalMaterial3Api::class)
+infix fun SelectableDates.and(other: SelectableDates): SelectableDates =
+    CombinedSelectableDates(this, other)
+
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+internal data class CombinedSelectableDates(
+    val first: SelectableDates,
+    val second: SelectableDates,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        first.isSelectableDate(utcTimeMillis) && second.isSelectableDate(utcTimeMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        first.isSelectableYear(year) && second.isSelectableYear(year)
+}
+
+/**
+ * The bounds this rule enforces when it is a [DateBounds], or combines one through [and];
+ * `null` for any other rule.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun SelectableDates.dateBoundsOrNull(): DateBounds? =
+    when (this) {
+        is DateBounds -> this
+        is CombinedSelectableDates -> intersectOrNull(first.dateBoundsOrNull(), second.dateBoundsOrNull())
+        else -> null
+    }
+
+/** The days accepted by both this and [other]. */
+internal fun DateBounds.intersect(other: DateBounds): DateBounds =
+    DateBounds(
+        minDateMillis = tighterMin(minDateMillis, other.minDateMillis),
+        maxDateMillis = tighterMax(maxDateMillis, other.maxDateMillis),
+    )
+
+private fun intersectOrNull(first: DateBounds?, second: DateBounds?): DateBounds? =
+    when {
+        first == null -> second
+        second == null -> first
+        else -> first.intersect(second)
+    }
+
+private fun tighterMin(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else maxOf(first, second)
+
+private fun tighterMax(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else minOf(first, second)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/RuleTrackingDatePickerState.kt` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerState
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/**
+ * A [DatePickerState] that reports the rule returned by [currentRule] instead of the one it was
+ * created with.
+ *
+ * Material3 caches each day's enabled state keyed on the rule object, so the picker only
+ * notices a change when the object itself changes. Handing it the caller's rule, which is a
+ * new object whenever the rule changes, keeps the calendar in sync.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal class RuleTrackingDatePickerState(
+    delegate: DatePickerState,
+    private val currentRule: () -> SelectableDates,
+) : DatePickerState by delegate {
+    override val selectableDates: SelectableDates
+        get() = currentRule()
+}
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/SelectableDays.kt` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+internal const val MILLIS_PER_DAY = 86_400_000L
+
+/** How far, in days on each side, a snapped selection may move to find a selectable day. */
+internal const val DEFAULT_SNAP_SEARCH_DAYS = 366
+
+private const val DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH = 719_468L
+private const val DAYS_PER_ERA = 146_097L
+private const val YEARS_PER_ERA = 400L
+
+/**
+ * Returns true when the UTC day containing [utcTimeMillis] lies within the inclusive
+ * [minDateMillis]..[maxDateMillis] range.
+ *
+ * Bounds are compared at day granularity, so any timestamp inside the min or max day keeps
+ * that whole day selectable. A null bound is open on that side.
+ */
+internal fun isDayWithinBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val afterMin = minDateMillis == null || day >= minDateMillis.floorDiv(MILLIS_PER_DAY)
+    val beforeMax = maxDateMillis == null || day <= maxDateMillis.floorDiv(MILLIS_PER_DAY)
+    return afterMin && beforeMax
+}
+
+/**
+ * Returns true when [year] contains at least one day of the inclusive
+ * [minDateMillis]..[maxDateMillis] range. A null bound is open on that side.
+ */
+internal fun isYearWithinBounds(
+    year: Int,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val afterMin = minDateMillis == null || year >= utcYearOf(minDateMillis)
+    val beforeMax = maxDateMillis == null || year <= utcYearOf(maxDateMillis)
+    return afterMin && beforeMax
+}
+
+/**
+ * Moves the UTC day containing [utcTimeMillis] into the inclusive bounds.
+ *
+ * Returns [utcTimeMillis] unchanged when it is already inside, otherwise the _start_ of the
+ * minimum or maximum day in UTC, whichever is nearer. A null bound is open on that side.
+ */
+internal fun clampDayIntoBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Long {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val minDay = minDateMillis?.floorDiv(MILLIS_PER_DAY)
+    val maxDay = maxDateMillis?.floorDiv(MILLIS_PER_DAY)
+    return when {
+        minDay != null && day < minDay -> minDay * MILLIS_PER_DAY
+        maxDay != null && day > maxDay -> maxDay * MILLIS_PER_DAY
+        else -> utcTimeMillis
+    }
+}
+
+/**
+ * Proleptic Gregorian year of a UTC timestamp, computed without a calendar dependency
+ * using the days-to-civil algorithm from Howard Hinnant's date algorithms.
+ */
+internal fun utcYearOf(utcTimeMillis: Long): Int {
+    val days = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val shifted = days + DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH
+    val era = shifted.floorDiv(DAYS_PER_ERA)
+    val dayOfEra = shifted - era * DAYS_PER_ERA
+    val yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
+    val dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
+    val monthIndex = (5 * dayOfYear + 2) / 153 // 0 is March, 11 is February
+    val marchBasedYear = yearOfEra + era * YEARS_PER_ERA
+    return (if (monthIndex >= 10) marchBasedYear + 1 else marchBasedYear).toInt()
+}
+
+/**
+ * Finds the selectable day nearest to [utcTimeMillis] and returns its _start_ in UTC.
+ *
+ * The day is first clamped into the bounds, then the search walks outwards one day at a
+ * time, later days first, until [selectableDates] accepts one. Returns null when no day within
+ * [maxDistanceDays] on either side is selectable.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun nearestSelectableDay(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+    selectableDates: SelectableDates,
+    maxDistanceDays: Int = DEFAULT_SNAP_SEARCH_DAYS,
+): Long? {
+    fun isSelectable(day: Long): Boolean {
+        val dayStart = day * MILLIS
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBoundsSelectableDatesTest.kt` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.ExperimentalMaterial3Api
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class)
+class DateBoundsSelectableDatesTest {
+
+    @Test
+    fun `date bounds accept the days inside and reject the days outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableDate(FEB_28_2026))
+        assertTrue(march.isSelectableDate(MAR_1_2026))
+        assertTrue(march.isSelectableDate(MAR_31_2026 + NOON_OFFSET_MILLIS))
+        assertFalse(march.isSelectableDate(APR_1_2026))
+    }
+
+    @Test
+    fun `date bounds with one side open accept everything on that side`() {
+        assertTrue(DateBounds(minDateMillis = MAR_1_2026).isSelectableDate(APR_1_2026))
+        assertTrue(DateBounds(maxDateMillis = MAR_31_2026).isSelectableDate(FEB_28_2026))
+        assertTrue(DateBounds().isSelectableDate(FEB_29_2000))
+    }
+
+    @Test
+    fun `date bounds reject the years outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableYear(2025))
+        assertTrue(march.isSelectableYear(2026))
+        assertFalse(march.isSelectableYear(2027))
+    }
+
+    @Test
+    fun `and accepts a day only when both rules accept it`() {
+        val marchWeekdays = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026) and WeekdaysOnly
+
+        assertTrue(marchWeekdays.isSelectableDate(MAR_13_2026))
+        assertFalse(marchWeekdays.isSelectableDate(MAR_14_2026))
+        assertFalse(marchWeekdays.isSelectableDate(APR_1_2026))
+        assertFalse(marchWeekdays.isSelectableYear(2025))
+    }
+
+    @Test
+    fun `bounds are extracted from date bounds and intersected through and`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+        val fromMid = DateBounds(minDateMillis = MAR_15_2026)
+
+        assertEquals(march, march.dateBoundsOrNull())
+        assertEquals(
+            DateBounds(minDateMillis = MAR_15_2026, maxDateMillis = MAR_31_2026),
+            (march and fromMid).dateBoundsOrNull(),
+        )
+        assertEquals(march, (march and WeekdaysOnly).dateBoundsOrNull())
+        assertEquals(march, (WeekdaysOnly and march).dateBoundsOrNull())
+    }
+
+    @Test
+    fun `other rules expose no bounds`() {
+        assertNull(WeekdaysOnly.dateBoundsOrNull())
+        assertNull(DatePickerDefaults.AllDates.dateBoundsOrNull())
+        assertNull((WeekdaysOnly and NoDates).dateBoundsOrNull())
+    }
+}
```

---

### Incident Patch 3: `1554f1b7` (2026-09-12)
**Commit Message**: fix(navigation): keep each destination's saved state while it is on the back stack

AdaptiveNavHost rendered the current destination directly, so when the
user navigated away the destination's rememberSaveable state (list
positions, form input) was discarded, and coming back started from
scratch. In the sample, opening any screen and going back reset the home
list to the top.

Each destination is now composed inside a SaveableStateHolder keyed on
its route, the way Jetpack's NavHost scopes its entries, and the saved
state of routes that leave the back stack is dropped so a later visit
starts fresh.

- Tests: AdaptiveNavHostStateTest (desktopTest, Compose UI): state
  survives navigating away and back, and is dropped after a pop

**File**: `calf-navigation/build.gradle.kts` (modified, +9/-0)
```diff
@@ -8,6 +8,15 @@ kotlin {
         implementation(libs.compose.material3)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.android.navigation.compose)
     }
```

**File**: `calf-navigation/src/commonMain/kotlin/com.mohamedrejeb.calf/navigation/AdaptiveNavHost.kt` (modified, +28/-2)
```diff
@@ -3,7 +3,10 @@ package com.mohamedrejeb.calf.navigation
 import androidx.compose.foundation.layout.Box
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.saveable.SaveableStateHolder
+import androidx.compose.runtime.saveable.rememberSaveableStateHolder
 import androidx.compose.ui.Modifier
 
 @Composable
@@ -28,11 +31,34 @@ fun AdaptiveNavHost(
             navController.navigate(startDestination)
     }
 
+    // Keeps each destination's `rememberSaveable` state (list positions, form input) while the
+    // destination stays on the back stack, so coming back restores it.
+    val saveableStateHolder = rememberSaveableStateHolder()
+    ForgetPoppedDestinations(navController, saveableStateHolder)
+
     Box(modifier = modifier) {
         navController.currentDestination?.let { currentDestination ->
             graphBuilder.destinations.find { it.route == currentDestination }?.let { destination ->
-                destination.content(destination.arguments)
+                saveableStateHolder.SaveableStateProvider(key = currentDestination) {
+                    destination.content(destination.arguments)
+                }
             }
         }
     }
-}
\ No newline at end of file
+}
+
+/** Drops the saved state of destinations that left the back stack, so a later visit starts fresh. */
+@Composable
+private fun ForgetPoppedDestinations(
+    navController: AdaptiveNavHostController,
+    saveableStateHolder: SaveableStateHolder,
+) {
+    val routesOnStack = navController.backStack.toSet()
+    val retainedRoutes = remember { mutableSetOf<String>() }
+
+    SideEffect {
+        (retainedRoutes - routesOnStack).forEach(saveableStateHolder::removeState)
+        retainedRoutes.clear()
+        retainedRoutes.addAll(routesOnStack)
+    }
+}
```

**File**: `calf-navigation/src/desktopTest/kotlin/com/mohamedrejeb/calf/navigation/AdaptiveNavHostStateTest.kt` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package com.mohamedrejeb.calf.navigation
+
+import androidx.compose.material3.Button
+import androidx.compose.material3.Text
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+private const val HOME = "home"
+private const val DETAIL = "detail"
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveNavHostStateTest {
+
+
+    @Test
+    fun `saveable state of a destination survives navigating away and back`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Counter(label = HOME) }
+                composable(DETAIL) { Text(DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        onNodeWithText("$HOME 0").performClick()
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText(DETAIL).assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+    }
+
+    @Test
+    fun `saveable state of a popped destination is dropped`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Text(HOME) }
+                composable(DETAIL) { Counter(label = DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText("$DETAIL 0").performClick()
+        onNodeWithText("$DETAIL 1").assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+        navController.navigate(DETAIL)
+        waitForIdle()
+
+        onNodeWithText("$DETAIL 0").assertIsDisplayed()
+    }
+}
+
+@androidx.compose.runtime.Composable
+private fun Counter(label: String) {
+    var count by rememberSaveable { mutableStateOf(0) }
+    Button(onClick = { count++ }) {
+        Text("$label $count")
+    }
+}
```

---

### Incident Patch 4: `e8d01be3` (2026-09-11)
**Commit Message**: Merge pull request #540 from MohamedRejeb/fix/desktop-native-lib-cache-collision

fix(file-picker): reuse identical cached native library instead of replacing it

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCache.kt` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import java.nio.file.Files
+import java.nio.file.Path
+import java.nio.file.StandardCopyOption
+import java.security.MessageDigest
+
+private const val HASH_ALGORITHM = "SHA-256"
+private const val HASH_LENGTH = 16
+private const val TEMP_PREFIX = "calf-native-"
+private const val TEMP_SUFFIX = ".tmp"
+
+/**
+ * Short, stable fingerprint of a native library's bytes.
+ *
+ * Used to name the cached copy so that different builds of the library
+ * never share a file on disk.
+ */
+internal fun nativeLibraryContentHash(bytes: ByteArray): String =
+    MessageDigest.getInstance(HASH_ALGORITHM)
+        .digest(bytes)
+        .joinToString("") { "%02x".format(it) }
+        .take(HASH_LENGTH)
+
+/**
+ * Inserts [contentHash] before the extension of [libFileName],
+ * e.g. `calf_filepicker_native.dll` -> `calf_filepicker_native-<hash>.dll`.
+ */
+internal fun nativeLibraryCacheFileName(libFileName: String, contentHash: String): String {
+    val extension = libFileName.substringAfterLast('.', missingDelimiterValue = "")
+    val baseName = libFileName.substringBeforeLast('.')
+    return if (extension.isEmpty()) "$baseName-$contentHash" else "$baseName-$contentHash.$extension"
+}
+
+/**
+ * Makes [bytes] available as a file inside [cacheDir] and returns the file to load.
+ *
+ * - An existing target with identical content is reused untouched, so a library
+ *   that another process has already loaded (and locked, on Windows) is never
+ *   replaced.
+ * - Otherwise the bytes are written to a temp file and moved over the target.
+ * - If the move fails for any reason, the unique temp file itself is returned
+ *   and scheduled for deletion on exit, so loading still succeeds.
+ */
+internal fun extractNativeLibrary(bytes: ByteArray, cacheDir: File, fileName: String): File {
+    cacheDir.mkdirs()
+    val target = File(cacheDir, fileName)
+    if (hasIdenticalContent(target, bytes)) return target
+
+    val tempFile = Files.createTempFile(cacheDir.toPath(), TEMP_PREFIX, TEMP_SUFFIX)
+    Files.write(tempFile, bytes)
+
+    return runCatching { moveReplacing(tempFile, target.toPath()) }
+        .map { target }
+        .getOrElse { tempFile.toFile().also { it.deleteOnExit() } }
+}
+
+private fun hasIdenticalContent(file: File, bytes: ByteArray): Boolean =
+    file.isFile &&
+        file.length() == bytes.size.toLong() &&
+        nativeLibraryContentHash(file.readBytes()) == nativeLibraryContentHash(bytes)
+
+private fun moveReplacing(source: Path, target: Path) {
+    try {
+        Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
+    } catch (_: Exception) {
+        // ATOMIC_MOVE is not supported on every filesystem; retry with a plain replace.
+        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING)
+    }
+}
```

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +40/-54)
```diff
@@ -1,84 +1,70 @@
 package com.mohamedrejeb.calf.picker.platform
 
 import java.io.File
-import java.io.InputStream
-import java.nio.file.Files
-import java.nio.file.StandardCopyOption
 
 private const val LIB_NAME = "calf_filepicker_native"
+private const val CACHE_DIR = ".cache/calf-filepicker"
 
 /**
- * Loads the native file picker library from JAR resources.
+ * Loads the native file picker library.
  *
- * The library is expected at: native/<os>-<arch>/<libFileName>
- * It is extracted to a user-scoped cache directory and loaded via [System.load].
+ * The system library path is tried first (packagers like Conveyor extract natives
+ * out of the jar). Otherwise the library is read from JAR resources at
+ * `native/<os>-<arch>/<libFileName>`, cached under a content-hashed name in a
+ * user-scoped directory, and loaded via [System.load].
  *
- * Called once from [NativeFilePickerBridge]'s object init block
+ * Called once from [NativeFilePickerBridge]'s object init block.
  */
 internal fun loadNativeLibrary() {
-    // Try the system path first (packagers like Conveyor extract natives
-    // out of the jar), then fall back to the bundled resource.
     try {
         System.loadLibrary(LIB_NAME)
         return
     } catch (_: UnsatisfiedLinkError) {
     }
 
-    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
-    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
+    val (resourcePath, libFileName) = bundledLibraryLocation()
+    val bytes = NativeFilePickerBridge::class.java.classLoader
+        ?.getResourceAsStream(resourcePath)
+        ?.use { it.readBytes() }
+        ?: error(
+            "Native library not found in JAR resources at '$resourcePath'. " +
+                "Ensure the native library is built for this platform."
+        )
 
-    val (osPart, libFileName) = when {
-        "mac" in osName || "darwin" in osName ->
-            "macos" to "lib$LIB_NAME.dylib"
+    val cacheFileName = nativeLibraryCacheFileName(libFileName, nativeLibraryContentHash(bytes))
+    val libraryFile = try {
+        extractNativeLibrary(bytes, userCacheDir(), cacheFileName)
+    } catch (e: Exception) {
+        error("Failed to extract native file picker library '$cacheFileName': ${e.message}")
+    }
 
-        "win" in osName ->
-            "windows" to "$LIB_NAME.dll"
+    @Suppress("UnsafeDynamicallyLoadedCode")
+    System.load(libraryFile.absolutePath)
+}
 
-        "nux" in osName || "nix" in osName ->
-            "linux" to "lib$LIB_NAME.so"
+/** Resource path inside the JAR and the platform file name of the bundled library. */
+private fun bundledLibraryLocation(): Pair<String, String> {
+    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
+    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
+    val (osPart, libFileName) = when {
+        "mac" in osName || "darwin" in osName -> "macos" to "lib$LIB_NAME.dylib"
+        "win" in osName -> "windows" to "$LIB_NAME.dll"
+        "nux" in osName || "nix" in osName -> "linux" to "lib$LIB_NAME.so"
         else -> error("Unsupported OS: $osName")
     }
 
-    val archPart = when {
-        osArch == "aarch64" || osArch == "arm64" -> "arm64"
-        osArch == "amd64" || osArch == "x86_64" -> "x64"
+    val archPart = when (osArch) {
+        "aarch64", "arm64" -> "arm64"
+        "amd64", "x86_64" -> "x64"
         else -> error("Unsupported architecture: $osArch")
     }
 
-    val resourcePath = "native/$osPart-$archPart/$libFileName"
-
-    val inputStream: InputStream = NativeFilePickerBridge::class.java.classLoader
-        ?.getResourceAsStream(resourcePath)
-        ?: error(
-            "Native library not found in JAR resources at '$resourcePath'. " +
-                "Ensure the native library is built for $osPart-$archPart."
-        )
+    return "native/$osPart-$archPart/$libFileName" to libFileName
+}
 
-    // Use a user-scoped cache directory to avoid shared /tmp security risk
```

**File**: `calf-file-picker/src/desktopTest/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCacheTest.kt` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import kotlin.io.path.createTempDirectory
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertTrue
+
+class NativeLibCacheTest {
+
+    private lateinit var cacheDir: File
+
+    @BeforeTest
+    fun setUp() {
+        cacheDir = createTempDirectory("calf-native-cache-test").toFile()
+    }
+
+    @AfterTest
+    fun tearDown() {
+        cacheDir.deleteRecursively()
+    }
+
+    @Test
+    fun `cache file name inserts the hash before the extension`() {
+        assertEquals(
+            "calf_filepicker_native-0123456789abcdef.dll",
+            nativeLibraryCacheFileName("calf_filepicker_native.dll", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.dylib",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.dylib", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.so",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.so", "0123456789abcdef"),
+        )
+    }
+
+    @Test
+    fun `content hash is deterministic, differs per content and is 16 hex chars`() {
+        val first = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val same = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val other = nativeLibraryContentHash(byteArrayOf(1, 2, 4))
+
+        assertEquals(first, same)
+        assertNotEquals(first, other)
+        assertTrue(Regex("[0-9a-f]{16}").matches(first), "unexpected hash format: $first")
+    }
+
+    @Test
+    fun `extract writes the file with the exact bytes when it is missing`() {
+        val bytes = byteArrayOf(10, 20, 30, 40)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-aaaa.so")
+
+        assertEquals(File(cacheDir, "lib-aaaa.so"), loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract reuses an existing identical file without rewriting it`() {
+        val bytes = byteArrayOf(7, 8, 9)
+        val target = File(cacheDir, "lib-bbbb.so").apply { writeBytes(bytes) }
+        val pastMillis = 1_000_000_000_000L
+        assertTrue(target.setLastModified(pastMillis))
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-bbbb.so")
+
+        assertEquals(target, loaded)
+        assertEquals(pastMillis, loaded.lastModified())
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract replaces an existing file whose bytes differ`() {
+        val target = File(cacheDir, "lib-cccc.so").apply { writeBytes(byteArrayOf(1, 1, 1)) }
+        val bytes = byteArrayOf(2, 2, 2, 2)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-cccc.so")
+
+        assertEquals(target, loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract falls back to a unique file in the cache dir when the target cannot be replaced`() {
+        val blockedTarget = File(cacheDir, "lib-dddd.so")
+        assertTrue(blockedTarget.mkdir())
+        assertTrue(File(blockedTarget, "occupied").createNewFile())
+        val bytes = byteArrayOf(5, 5, 5)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-dddd.so")
+
+        assertNotEquals(blockedTarget, loaded)
+        assertEquals(cacheDir, loaded.parentFile)
+        assertTrue(loaded.isFile)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+}
```

**File**: `docs/filepicker.md` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ Passing `null` (the default) allows unlimited selection. `FilePickerSelectionMod
 
 ## Desktop Setup
 
+#### Native library cache
+
+The desktop file picker relies on a small native library bundled inside the JAR. On first use it is extracted to `~/.cache/calf-filepicker/`. The cached file name includes a hash of the library's content, so several applications, product flavors, or Calf versions running on the same machine never overwrite each other's copy, and an identical library that is already present is reused as is.
+
+Packagers that place the library on the system library path (for example Conveyor) skip the extraction entirely, since the loader tries `System.loadLibrary` first.
+
 #### macOS Dark Theme
 
 The file dialog follows the application's theme. To enable dark mode support on macOS, add this JVM argument to your Gradle configuration:
```

---

### Incident Patch 5: `a1fc1000` (2026-09-11)
**Commit Message**: Merge pull request #539 from MohamedRejeb/fix/alert-dialog-single-button

fix(ui): allow single-button AdaptiveAlertDialog by making dismissText optional

**File**: `calf-ui/build.gradle.kts` (modified, +9/-0)
```diff
@@ -11,6 +11,15 @@ kotlin {
         implementation(libs.kotlinx.coroutines.core)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.activity.compose)
         implementation(libs.kotlinx.coroutines.android)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.kt` (modified, +5/-2)
```diff
@@ -28,8 +28,11 @@ import com.mohamedrejeb.calf.ui.dialog.uikit.rememberAlertDialogIosProperties
  * If materialDismissButton is provided, this lambda will not be used for non-iOS platforms.
  * @param confirmText The text of the confirm button.
  * if materialConfirmButton is provided, this text will not be used for non-iOS platforms.
- * @param dismissText The text of the dismiss button.
+ * @param dismissText The text of the dismiss button. Pass null, or a blank string, to show a
+ * single-button dialog with only the confirm button.
  * if materialDismissButton is provided, this text will not be used for non-iOS platforms.
+ * On iOS the set of buttons is fixed when the dialog is first presented, so switching
+ * between null and a value while the dialog is shown only takes effect once it is shown again.
  * @param title The title of the dialog.
  * if materialTitle is provided, this text will not be used for non-iOS platforms.
  * @param text The text of the dialog.
@@ -63,7 +66,7 @@ expect fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String? = null,
     title: String,
     text: String,
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActions.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+
+/**
+ * Resolves the label of the dismiss button shown by [AdaptiveAlertDialog].
+ *
+ * Both null and blank text mean "no dismiss button". A blank label would otherwise
+ * render an empty but tappable button, which is never a valid dialog.
+ */
+internal fun dismissLabelOrNull(dismissText: String?): String? =
+    dismissText?.takeIf { it.isNotBlank() }
+
+/**
+ * Builds the native iOS actions shown by [AdaptiveAlertDialog].
+ *
+ * The confirm action always comes first. The dismiss action is only added when
+ * [dismissText] resolves to a label through [dismissLabelOrNull], which is how a
+ * single-button dialog is expressed.
+ */
+internal fun adaptiveAlertDialogIosActions(
+    confirmText: String,
+    dismissText: String?,
+    onConfirm: () -> Unit,
+    onDismiss: () -> Unit,
+    confirmStyle: AlertDialogIosActionStyle,
+    dismissStyle: AlertDialogIosActionStyle,
+    confirmIsPreferred: Boolean,
+): List<AlertDialogIosAction> = listOfNotNull(
+    AlertDialogIosAction(
+        title = confirmText,
+        style = confirmStyle,
+        onClick = onConfirm,
+        isPreferred = confirmIsPreferred,
+    ),
+    dismissLabelOrNull(dismissText)?.let { label ->
+        AlertDialogIosAction(
+            title = label,
+            style = dismissStyle,
+            onClick = onDismiss,
+        )
+    },
+)
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActionsTest.kt` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class AdaptiveAlertDialogActionsTest {
+
+    @Test
+    fun `builds only the confirm action when dismissText is null`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = null,
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds only the confirm action when dismissText is blank`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "   ",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds confirm then dismiss action when dismissText is provided`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Destructive,
+            confirmIsPreferred = true,
+        )
+
+        assertEquals(listOf("OK", "Cancel"), actions.map { it.title })
+        assertEquals(
+            listOf(AlertDialogIosActionStyle.Default, AlertDialogIosActionStyle.Destructive),
+            actions.map { it.style },
+        )
+        assertEquals(listOf(true, false), actions.map { it.isPreferred })
+    }
+
+    @Test
+    fun `wires confirm and dismiss callbacks to their own actions`() {
+        var confirmed = false
+        var dismissed = false
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = { confirmed = true },
+            onDismiss = { dismissed = true },
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        actions[0].onClick()
+        assertTrue(confirmed)
+        assertFalse(dismissed)
+
+        actions[1].onClick()
+        assertTrue(dismissed)
+    }
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogMaterialTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import androidx.compose.material3.Text
+import androidx.compose.material3.TextButton
+import androidx.compose.ui.semantics.Role
+import androidx.compose.ui.semantics.SemanticsProperties
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.SemanticsMatcher
+import androidx.compose.ui.test.assertCountEquals
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveAlertDialogMaterialTest {
+
+    private val isButton = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)
+
+    @Test
+    fun `shows only the confirm button when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `shows only the confirm button when dismissText is blank`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "   ",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `renders materialDismissButton even when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+                materialDismissButton = {
+                    TextButton(onClick = {}) {
+                        Text("Custom")
+                    }
+                },
+            )
+        }
+
+        onNodeWithText("Custom").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+
+    @Test
+    fun `shows confirm and dismiss buttons when dismissText is provided`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "Cancel",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onNodeWithText("Cancel").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+}
```

---

### Incident Patch 6: `befc4557` (2026-09-10)
**Commit Message**: fix(file-picker): reuse identical cached native library instead of replacing it

Closes #534.

Two apps bundling the same picker extracted the native library to one fixed path, and on Windows the second app failed because the first had the DLL loaded and locked. The cached copy is now named with a content hash, an existing identical file is reused untouched, and if the target still cannot be replaced the loader falls back to a unique temp file instead of failing.

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCache.kt` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import java.nio.file.Files
+import java.nio.file.Path
+import java.nio.file.StandardCopyOption
+import java.security.MessageDigest
+
+private const val HASH_ALGORITHM = "SHA-256"
+private const val HASH_LENGTH = 16
+private const val TEMP_PREFIX = "calf-native-"
+private const val TEMP_SUFFIX = ".tmp"
+
+/**
+ * Short, stable fingerprint of a native library's bytes.
+ *
+ * Used to name the cached copy so that different builds of the library
+ * never share a file on disk.
+ */
+internal fun nativeLibraryContentHash(bytes: ByteArray): String =
+    MessageDigest.getInstance(HASH_ALGORITHM)
+        .digest(bytes)
+        .joinToString("") { "%02x".format(it) }
+        .take(HASH_LENGTH)
+
+/**
+ * Inserts [contentHash] before the extension of [libFileName],
+ * e.g. `calf_filepicker_native.dll` -> `calf_filepicker_native-<hash>.dll`.
+ */
+internal fun nativeLibraryCacheFileName(libFileName: String, contentHash: String): String {
+    val extension = libFileName.substringAfterLast('.', missingDelimiterValue = "")
+    val baseName = libFileName.substringBeforeLast('.')
+    return if (extension.isEmpty()) "$baseName-$contentHash" else "$baseName-$contentHash.$extension"
+}
+
+/**
+ * Makes [bytes] available as a file inside [cacheDir] and returns the file to load.
+ *
+ * - An existing target with identical content is reused untouched, so a library
+ *   that another process has already loaded (and locked, on Windows) is never
+ *   replaced.
+ * - Otherwise the bytes are written to a temp file and moved over the target.
+ * - If the move fails for any reason, the unique temp file itself is returned
+ *   and scheduled for deletion on exit, so loading still succeeds.
+ */
+internal fun extractNativeLibrary(bytes: ByteArray, cacheDir: File, fileName: String): File {
+    cacheDir.mkdirs()
+    val target = File(cacheDir, fileName)
+    if (hasIdenticalContent(target, bytes)) return target
+
+    val tempFile = Files.createTempFile(cacheDir.toPath(), TEMP_PREFIX, TEMP_SUFFIX)
+    Files.write(tempFile, bytes)
+
+    return runCatching { moveReplacing(tempFile, target.toPath()) }
+        .map { target }
+        .getOrElse { tempFile.toFile().also { it.deleteOnExit() } }
+}
+
+private fun hasIdenticalContent(file: File, bytes: ByteArray): Boolean =
+    file.isFile &&
+        file.length() == bytes.size.toLong() &&
+        nativeLibraryContentHash(file.readBytes()) == nativeLibraryContentHash(bytes)
+
+private fun moveReplacing(source: Path, target: Path) {
+    try {
+        Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
+    } catch (_: Exception) {
+        // ATOMIC_MOVE is not supported on every filesystem; retry with a plain replace.
+        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING)
+    }
+}
```

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +40/-54)
```diff
@@ -1,84 +1,70 @@
 package com.mohamedrejeb.calf.picker.platform
 
 import java.io.File
-import java.io.InputStream
-import java.nio.file.Files
-import java.nio.file.StandardCopyOption
 
 private const val LIB_NAME = "calf_filepicker_native"
+private const val CACHE_DIR = ".cache/calf-filepicker"
 
 /**
- * Loads the native file picker library from JAR resources.
+ * Loads the native file picker library.
  *
- * The library is expected at: native/<os>-<arch>/<libFileName>
- * It is extracted to a user-scoped cache directory and loaded via [System.load].
+ * The system library path is tried first (packagers like Conveyor extract natives
+ * out of the jar). Otherwise the library is read from JAR resources at
+ * `native/<os>-<arch>/<libFileName>`, cached under a content-hashed name in a
+ * user-scoped directory, and loaded via [System.load].
  *
- * Called once from [NativeFilePickerBridge]'s object init block
+ * Called once from [NativeFilePickerBridge]'s object init block.
  */
 internal fun loadNativeLibrary() {
-    // Try the system path first (packagers like Conveyor extract natives
-    // out of the jar), then fall back to the bundled resource.
     try {
         System.loadLibrary(LIB_NAME)
         return
     } catch (_: UnsatisfiedLinkError) {
     }
 
-    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
-    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
+    val (resourcePath, libFileName) = bundledLibraryLocation()
+    val bytes = NativeFilePickerBridge::class.java.classLoader
+        ?.getResourceAsStream(resourcePath)
+        ?.use { it.readBytes() }
+        ?: error(
+            "Native library not found in JAR resources at '$resourcePath'. " +
+                "Ensure the native library is built for this platform."
+        )
 
-    val (osPart, libFileName) = when {
-        "mac" in osName || "darwin" in osName ->
-            "macos" to "lib$LIB_NAME.dylib"
+    val cacheFileName = nativeLibraryCacheFileName(libFileName, nativeLibraryContentHash(bytes))
+    val libraryFile = try {
+        extractNativeLibrary(bytes, userCacheDir(), cacheFileName)
+    } catch (e: Exception) {
+        error("Failed to extract native file picker library '$cacheFileName': ${e.message}")
+    }
 
-        "win" in osName ->
-            "windows" to "$LIB_NAME.dll"
+    @Suppress("UnsafeDynamicallyLoadedCode")
+    System.load(libraryFile.absolutePath)
+}
 
-        "nux" in osName || "nix" in osName ->
-            "linux" to "lib$LIB_NAME.so"
+/** Resource path inside the JAR and the platform file name of the bundled library. */
+private fun bundledLibraryLocation(): Pair<String, String> {
+    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
+    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
+    val (osPart, libFileName) = when {
+        "mac" in osName || "darwin" in osName -> "macos" to "lib$LIB_NAME.dylib"
+        "win" in osName -> "windows" to "$LIB_NAME.dll"
+        "nux" in osName || "nix" in osName -> "linux" to "lib$LIB_NAME.so"
         else -> error("Unsupported OS: $osName")
     }
 
-    val archPart = when {
-        osArch == "aarch64" || osArch == "arm64" -> "arm64"
-        osArch == "amd64" || osArch == "x86_64" -> "x64"
+    val archPart = when (osArch) {
+        "aarch64", "arm64" -> "arm64"
+        "amd64", "x86_64" -> "x64"
         else -> error("Unsupported architecture: $osArch")
     }
 
-    val resourcePath = "native/$osPart-$archPart/$libFileName"
-
-    val inputStream: InputStream = NativeFilePickerBridge::class.java.classLoader
-        ?.getResourceAsStream(resourcePath)
-        ?: error(
-            "Native library not found in JAR resources at '$resourcePath'. " +
-                "Ensure the native library is built for $osPart-$archPart."
-        )
+    return "native/$osPart-$archPart/$libFileName" to libFileName
+}
 
-    // Use a user-scoped cache directory to avoid shared /tmp security risk
```

**File**: `calf-file-picker/src/desktopTest/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCacheTest.kt` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import kotlin.io.path.createTempDirectory
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertTrue
+
+class NativeLibCacheTest {
+
+    private lateinit var cacheDir: File
+
+    @BeforeTest
+    fun setUp() {
+        cacheDir = createTempDirectory("calf-native-cache-test").toFile()
+    }
+
+    @AfterTest
+    fun tearDown() {
+        cacheDir.deleteRecursively()
+    }
+
+    @Test
+    fun `cache file name inserts the hash before the extension`() {
+        assertEquals(
+            "calf_filepicker_native-0123456789abcdef.dll",
+            nativeLibraryCacheFileName("calf_filepicker_native.dll", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.dylib",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.dylib", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.so",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.so", "0123456789abcdef"),
+        )
+    }
+
+    @Test
+    fun `content hash is deterministic, differs per content and is 16 hex chars`() {
+        val first = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val same = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val other = nativeLibraryContentHash(byteArrayOf(1, 2, 4))
+
+        assertEquals(first, same)
+        assertNotEquals(first, other)
+        assertTrue(Regex("[0-9a-f]{16}").matches(first), "unexpected hash format: $first")
+    }
+
+    @Test
+    fun `extract writes the file with the exact bytes when it is missing`() {
+        val bytes = byteArrayOf(10, 20, 30, 40)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-aaaa.so")
+
+        assertEquals(File(cacheDir, "lib-aaaa.so"), loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract reuses an existing identical file without rewriting it`() {
+        val bytes = byteArrayOf(7, 8, 9)
+        val target = File(cacheDir, "lib-bbbb.so").apply { writeBytes(bytes) }
+        val pastMillis = 1_000_000_000_000L
+        assertTrue(target.setLastModified(pastMillis))
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-bbbb.so")
+
+        assertEquals(target, loaded)
+        assertEquals(pastMillis, loaded.lastModified())
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract replaces an existing file whose bytes differ`() {
+        val target = File(cacheDir, "lib-cccc.so").apply { writeBytes(byteArrayOf(1, 1, 1)) }
+        val bytes = byteArrayOf(2, 2, 2, 2)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-cccc.so")
+
+        assertEquals(target, loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract falls back to a unique file in the cache dir when the target cannot be replaced`() {
+        val blockedTarget = File(cacheDir, "lib-dddd.so")
+        assertTrue(blockedTarget.mkdir())
+        assertTrue(File(blockedTarget, "occupied").createNewFile())
+        val bytes = byteArrayOf(5, 5, 5)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-dddd.so")
+
+        assertNotEquals(blockedTarget, loaded)
+        assertEquals(cacheDir, loaded.parentFile)
+        assertTrue(loaded.isFile)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+}
```

**File**: `docs/filepicker.md` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ Passing `null` (the default) allows unlimited selection. `FilePickerSelectionMod
 
 ## Desktop Setup
 
+#### Native library cache
+
+The desktop file picker relies on a small native library bundled inside the JAR. On first use it is extracted to `~/.cache/calf-filepicker/`. The cached file name includes a hash of the library's content, so several applications, product flavors, or Calf versions running on the same machine never overwrite each other's copy, and an identical library that is already present is reused as is.
+
+Packagers that place the library on the system library path (for example Conveyor) skip the extraction entirely, since the loader tries `System.loadLibrary` first.
+
 #### macOS Dark Theme
 
 The file dialog follows the application's theme. To enable dark mode support on macOS, add this JVM argument to your Gradle configuration:
```

---

### Incident Patch 7: `248fd08e` (2026-09-10)
**Commit Message**: fix(ui): allow single-button AdaptiveAlertDialog by making dismissText optional

Closes #536.

AdaptiveAlertDialog always rendered two buttons, so on iOS an empty
dismissText produced a blank UIAlertAction and on Material an empty
button. dismissText is now `String? = null`; null or blank text drops
the dismiss action/button on every platform.

- Extract the iOS action list into adaptiveAlertDialogIosActions
  (commonMain, internal) so the logic is unit-tested without a simulator
- Add dismissLabelOrNull shared by the iOS and Material actuals
- Add calf-ui commonTest and desktopTest (Compose ui-test on desktop)
- Sample: "Single Button Alert Dialog" section in AlertDialogScreen
- Docs: single-button section in docs/ui/adaptive-alert-dialog.md

**File**: `calf-ui/build.gradle.kts` (modified, +9/-0)
```diff
@@ -11,6 +11,15 @@ kotlin {
         implementation(libs.kotlinx.coroutines.core)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.activity.compose)
         implementation(libs.kotlinx.coroutines.android)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.kt` (modified, +5/-2)
```diff
@@ -28,8 +28,11 @@ import com.mohamedrejeb.calf.ui.dialog.uikit.rememberAlertDialogIosProperties
  * If materialDismissButton is provided, this lambda will not be used for non-iOS platforms.
  * @param confirmText The text of the confirm button.
  * if materialConfirmButton is provided, this text will not be used for non-iOS platforms.
- * @param dismissText The text of the dismiss button.
+ * @param dismissText The text of the dismiss button. Pass null, or a blank string, to show a
+ * single-button dialog with only the confirm button.
  * if materialDismissButton is provided, this text will not be used for non-iOS platforms.
+ * On iOS the set of buttons is fixed when the dialog is first presented, so switching
+ * between null and a value while the dialog is shown only takes effect once it is shown again.
  * @param title The title of the dialog.
  * if materialTitle is provided, this text will not be used for non-iOS platforms.
  * @param text The text of the dialog.
@@ -63,7 +66,7 @@ expect fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String? = null,
     title: String,
     text: String,
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActions.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+
+/**
+ * Resolves the label of the dismiss button shown by [AdaptiveAlertDialog].
+ *
+ * Both null and blank text mean "no dismiss button". A blank label would otherwise
+ * render an empty but tappable button, which is never a valid dialog.
+ */
+internal fun dismissLabelOrNull(dismissText: String?): String? =
+    dismissText?.takeIf { it.isNotBlank() }
+
+/**
+ * Builds the native iOS actions shown by [AdaptiveAlertDialog].
+ *
+ * The confirm action always comes first. The dismiss action is only added when
+ * [dismissText] resolves to a label through [dismissLabelOrNull], which is how a
+ * single-button dialog is expressed.
+ */
+internal fun adaptiveAlertDialogIosActions(
+    confirmText: String,
+    dismissText: String?,
+    onConfirm: () -> Unit,
+    onDismiss: () -> Unit,
+    confirmStyle: AlertDialogIosActionStyle,
+    dismissStyle: AlertDialogIosActionStyle,
+    confirmIsPreferred: Boolean,
+): List<AlertDialogIosAction> = listOfNotNull(
+    AlertDialogIosAction(
+        title = confirmText,
+        style = confirmStyle,
+        onClick = onConfirm,
+        isPreferred = confirmIsPreferred,
+    ),
+    dismissLabelOrNull(dismissText)?.let { label ->
+        AlertDialogIosAction(
+            title = label,
+            style = dismissStyle,
+            onClick = onDismiss,
+        )
+    },
+)
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActionsTest.kt` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class AdaptiveAlertDialogActionsTest {
+
+    @Test
+    fun `builds only the confirm action when dismissText is null`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = null,
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds only the confirm action when dismissText is blank`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "   ",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds confirm then dismiss action when dismissText is provided`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Destructive,
+            confirmIsPreferred = true,
+        )
+
+        assertEquals(listOf("OK", "Cancel"), actions.map { it.title })
+        assertEquals(
+            listOf(AlertDialogIosActionStyle.Default, AlertDialogIosActionStyle.Destructive),
+            actions.map { it.style },
+        )
+        assertEquals(listOf(true, false), actions.map { it.isPreferred })
+    }
+
+    @Test
+    fun `wires confirm and dismiss callbacks to their own actions`() {
+        var confirmed = false
+        var dismissed = false
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = { confirmed = true },
+            onDismiss = { dismissed = true },
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        actions[0].onClick()
+        assertTrue(confirmed)
+        assertFalse(dismissed)
+
+        actions[1].onClick()
+        assertTrue(dismissed)
+    }
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogMaterialTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import androidx.compose.material3.Text
+import androidx.compose.material3.TextButton
+import androidx.compose.ui.semantics.Role
+import androidx.compose.ui.semantics.SemanticsProperties
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.SemanticsMatcher
+import androidx.compose.ui.test.assertCountEquals
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveAlertDialogMaterialTest {
+
+    private val isButton = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)
+
+    @Test
+    fun `shows only the confirm button when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `shows only the confirm button when dismissText is blank`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "   ",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `renders materialDismissButton even when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+                materialDismissButton = {
+                    TextButton(onClick = {}) {
+                        Text("Custom")
+                    }
+                },
+            )
+        }
+
+        onNodeWithText("Custom").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+
+    @Test
+    fun `shows confirm and dismiss buttons when dismissText is provided`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "Cancel",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onNodeWithText("Cancel").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+}
```

---

### Incident Patch 8: `b2a90d51` (2026-07-26)
**Commit Message**: fix(sample): remove stale CanvasBasedWindow imports from web samples

**File**: `sample/web-js/src/jsMain/kotlin/Main.kt` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.window.CanvasBasedWindow
 import androidx.compose.ui.window.ComposeViewport
 import com.mohamedrejeb.calf.sample.App
 import org.jetbrains.skiko.wasm.onWasmReady
```

**File**: `sample/web-wasm/src/wasmJsMain/kotlin/Main.kt` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.window.CanvasBasedWindow
 import androidx.compose.ui.window.ComposeViewport
 import com.mohamedrejeb.calf.sample.App
 
```

---

### Incident Patch 9: `ce4af64a` (2026-07-26)
**Commit Message**: fix(ios): convert Skia shader to Compose shader in InteractiveHighlight

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/utils/InteractiveHighlight.kt` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ import androidx.compose.ui.geometry.Size
 import androidx.compose.ui.graphics.BlendMode
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.ShaderBrush
+import androidx.compose.ui.graphics.asComposeShader
 import androidx.compose.ui.input.pointer.pointerInput
 import androidx.compose.ui.util.fastCoerceIn
 import com.kyant.backdrop.RuntimeShader
@@ -79,7 +80,7 @@ half4 main(float2 coord) {
                         )
                     }
                     drawRect(
-                        ShaderBrush(shader.asSkikoRuntimeShader().makeShader()),
+                        ShaderBrush(shader.asSkikoRuntimeShader().makeShader().asComposeShader()),
                         blendMode = BlendMode.Plus
                     )
                 } else {
```

---

### Incident Patch 10: `6331db22` (2026-07-26)
**Commit Message**: fix(desktop): load native libraries from the system path before JAR extraction

Packagers like Conveyor's extract-native-libraries move native libs out
of the JARs into the JVM lib dir and rewrite the JARs without them — the
in-JAR resource lookup then fails and the app crashes ("Native library
not found in JAR resources"). Try System.loadLibrary first (the same
pattern that keeps Skiko compatible) and fall back to the bundled-
resource extraction used by dev runs and jpackage builds. Applies to
both calf-file-picker and calf-share desktop loaders.

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +8/-0)
```diff
@@ -16,6 +16,14 @@ private const val LIB_NAME = "calf_filepicker_native"
  * Called once from [NativeFilePickerBridge]'s object init block
  */
 internal fun loadNativeLibrary() {
+    // Try the system path first (packagers like Conveyor extract natives
+    // out of the jar), then fall back to the bundled resource.
+    try {
+        System.loadLibrary(LIB_NAME)
+        return
+    } catch (_: UnsatisfiedLinkError) {
+    }
+
     val osName = System.getProperty("os.name")?.lowercase().orEmpty()
     val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
```

**File**: `calf-share/src/desktopMain/kotlin/com/mohamedrejeb/calf/share/platform/NativeLibLoader.kt` (modified, +8/-0)
```diff
@@ -14,6 +14,14 @@ private const val LIB_NAME = "calf_share_native"
  * It is extracted to a user-scoped cache directory and loaded via [System.load].
  */
 internal fun loadNativeLibrary() {
+    // Try the system path first (packagers like Conveyor extract natives
+    // out of the jar), then fall back to the bundled resource.
+    try {
+        System.loadLibrary(LIB_NAME)
+        return
+    } catch (_: UnsatisfiedLinkError) {
+    }
+
     val osName = System.getProperty("os.name")?.lowercase().orEmpty()
     val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
```

#### Recent Merged Pull Requests:
- **PR #550** (2026-09-19): Enabled parallel sync for Gradle 9.4+ (@kevinguitar)
- **PR #549** (2026-09-20): Support full combinedClickable capability in adaptiveClickable modifier (@kevinguitar)
- **PR #547** (closed): Update version to 0.14.0 (@github-actions[bot])
- **PR #546** (2026-09-13): Prepare 0.14.0: Kotlin 2.4.20, Compose 1.12.0, AGP 9.4, compileSdk 37 (@MohamedRejeb)
- **PR #545** (2026-09-12): feat(io): add KmpFile.source() for streaming reads with kotlinx-io (@MohamedRejeb)
- **PR #544** (2026-09-12): feat(ui): add AdaptiveDateRangePicker (@MohamedRejeb)
- **PR #543** (2026-09-12): feat(ui): add AdaptiveCompactDatePicker (@MohamedRejeb)
- **PR #542** (2026-09-12): fix(navigation): keep each destination's saved state while it is on the back stack (@MohamedRejeb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
