# Forensic Learning Record (Deep Inspection): itinance/react-native-fs

> **Canonical Artifact**: `07_PROJECT_LEARNING/itinance-react-native-fs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/itinance/react-native-fs](https://github.com/itinance/react-native-fs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:22.032Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `itinance/react-native-fs`
- **Description**: Native filesystem access for react-native
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5045 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Downloader.h`
```
#import <Foundation/Foundation.h>

typedef void (^DownloadCompleteCallback)(NSNumber*, NSNumber*);
typedef void (^ErrorCallback)(NSError*);
typedef void (^BeginCallback)(NSNumber*, NSNumber*, NSDictionary*);
typedef void (^ProgressCallback)(NSNumber*, NSNumber*);
typedef void (^ResumableCallback)(void);

@interface RNFSDownloadParams : NSObject

@property (copy) NSString* fromUrl;
@property (copy) NSString* toFile;
@property (copy) NSDictionary* headers;
@property (copy) DownloadCompleteCallback completeCallback;   // Download has finished (data written)
@property (copy) ErrorCallback errorCallback;                 // Something went wrong
@property (copy) BeginCallback beginCallback;                 // Download has started (headers received)
@property (copy) ProgressCallback progressCallback;           // Download is progressing
@property (copy) ResumableCallback resumableCallback;         // Download has stopped but is resumable
@property        bool background;                             // Whether to continue download when app is in background
@property        bool discretionary;                          // Whether the file may be downloaded at the OS's discretion (iOS only)
@property        bool cacheable;                              // Whether the file may be stored in the shared NSURLCache (iOS only)
@property (copy) NSNumber* progressInterval;
@property (copy) NSNumber* progressDivider;
@property (copy) NSNumber* readTimeout;                       // How long (in milliseconds) a task should wait for additional data to arrive before giving up
@property (copy) NSNumber* backgroundTimeout;                 // How long (in milliseconds) to wait for an entire resource to transfer before giving up


@end

@interface RNFSDownloader : NSObject <NSURLSessionDelegate, NSURLSessionDownloadDelegate>

- (NSString *)downloadFile:(RNFSDownloadParams*)params;
- (void)stopDownload;
- (void)resumeDownload;
- (BOOL)isResumable;

@end

```

### Core Architecture Module: `Examples/RNFS.Windows/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
};

```

### Core Architecture Module: `Examples/RNFS.Windows/.prettierrc.js`
```
module.exports = {
  bracketSpacing: false,
  jsxBracketSameLine: true,
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `Examples/RNFS.Windows/App.tsx`
```
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TextInput,
  Button,
  Alert,
  Picker,
} from 'react-native';


import RNFS from 'react-native-fs';
//import {Picker} from '@react-native-community/picker';

import {
  Colors,
  DebugInstructions,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';


const App: () => React$Node = () => {

  const [mkdirParam, setMkdirParam] = useState('');

  const [moveFileSource, setMoveFileSource] = useState('');
  const [moveFileDest, setMoveFileDest] = useState('');

  const [copyFileSource, setCopyFileSource] = useState('');
  const [copyFileDest, setCopyFileDest] = useState('');

  const [unlinkFileParam, setUnlinkFileParam] = useState('');

  const [readDirParam, setReadDirParam] = useState('');

  const [statParam, setStatParam] = useState('');

  const [readFileParam, setReadFileParam] = useState('');

  const [readParam, setReadParam] = useState('');
  const [readLengthParam, setReadLengthParam] = useState('');
  const [readPositionParam, setReadPositionParam] = useState('');

  const [hashFileParam, setHashFileParam] = useState('');
  const [selectedValue, setSelectedValue] = useState('md5');

  const [writeFileParam, setWriteFileParam] = useState('');
  const [writeFileContentValue, setWriteFileContentValue] = useState('');

  const [appendFileParam, setAppendFileParam] = useState('');
  const [appendContentValue, setAppendContentValue] = useState('');

  const [writeParam, setWriteParam] = useState('');
  const [writeContentValue, setWriteContentValue] = useState('');
  const [writePositionValue, setWritePositionValue] = useState('');

  const [touchFilePathParam, setTouchFilePathParam] = useState('');

  const [downloadFilePathParam, setDownloadFilePathParam] = useState('');
  const [downloadFileSource, setDownloadFileSource] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');

  const [uploadFileSource1, setUploadFileSource1] = useState('');
  const [uploadFileSource2, setUploadFileSource2] = useState('');
  const [uploadFileDestination, setUploadFileDestination] = useState('');

  const [existsSource, setExistsSource] = useState('');

  const mkdirExample = () => {
    if(mkdirParam.length > 0) {
      RNFS.mkdir(RNFS.DocumentDirectoryPath + '/' + mkdirParam)
            .then((result) => {
              Alert.alert('Successfully created directory.')
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const moveFileExample = () => {
    if(moveFileSource.length > 0) {
      RNFS.moveFile(RNFS.DocumentDirectoryPath + '/' + moveFileSource, 
                    RNFS.DocumentDirectoryPath + '/' + moveFileDest)
            .then((result) => {
              Alert.alert('Successfully moved file to specified destination.')
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const copyFileExample = () => {
    if(copyFileSource.length > 0) {
      RNFS.copyFile(RNFS.DocumentDirectoryPath + '/' + copyFileSource, 
                    RNFS.DocumentDirectoryPath + '/' + copyFileDest)
            .then((result) => {
              Alert.alert('Successfully put copy of file to specified destination.')
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const copyFolderExample = () => {
    if(copyFileSource.length > 0) {
      RNFS.copyFolder(RNFS.DocumentDirectoryPath + '/' + copyFileSource, 
                      RNFS.DocumentDirectoryPath + '/' + copyFileDest)
            .then((result) => {
              Alert.alert('Successfully put copy of file to specified destination.')
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const getFSInfoExample = () => {
    RNFS.getFSInfo()
          .then((result) => {
            Alert.alert('Total space: ' + result.totalSpace + ' bytes\nFree space: ' + result.freeSpace + ' bytes')
          })
          .catch((err) => {
            Alert.alert(err.message)
          })
  }

  const unlinkExample = () => {
    if(unlinkFileParam.length > 0) {
      RNFS.unlink(RNFS.DocumentDirectoryPath + '/' + unlinkFileParam)
            .then((result) => {
              Alert.alert('Successfully unlinked specified file or folder')
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const readDirExample = () => {
    RNFS.readDir(RNFS.DocumentDirectoryPath + '/' + readDirParam)
          .then((result) => {
            if(result.length == 0) {
              Alert.alert('Directory is empty')
            }
            else {
              let title = 'Number of contents: ' + result.length
              let output = '\nresult[0].name: ' + result[0].name +
                            '\nresult[0].size: ' + result[0].size + ' bytes' +
                            '\nresult[0].mtime: ' + result[0].mtime +
                            '\nresult[0].ctime: ' + result[0].ctime +
                            '\nresult[0].name: ' + result[0].name +
                            '\nresult[0].path: ' + result[0].path +
                            '\nresult[0].isFile(): ' + result[0].isFile() +
                            '\nresult[0].isDirectory(): ' + result[0].isDirectory() 
              Alert.alert(title, output)
            }
          })
          .catch((err) => {
            Alert.alert(err.message)
          })
  }

  const statExample = () => {
    RNFS.stat(RNFS.DocumentDirectoryPath + '/' + statParam)
          .then((result) => {
            let title = 'Stat Results:'
            let output = 'result.path: ' + result.path +
                          '\nresult.ctime: ' + result.ctime +
                          '\nresult.mtime: ' + result.mtime +
                          '\nresult.size: ' + result.size + ' bytes' +
                          '\nresult.mode: ' + result.mode +
                          '\nresult.originalFilePath: ' + result.originalFilePath +
                          '\nresult.isFile(): ' + result.isFile() +
                          '\nresult.isDirectory(): ' + result.isDirectory()
            Alert.alert(title, output)
          })
          .catch((err) => {
            Alert.alert(err.message)
          })
  }

  const readFileExample = () => {
    if(readFileParam.length > 0) {
      RNFS.readFile(RNFS.DocumentDirectoryPath + '/' + readFileParam)
            .then((result) => {
              Alert.alert('File Contents:', result.substr(0,50))
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const readExample = () => {
    if(readParam.length > 0) {

      var length = parseInt(readLengthParam, 10)
      var position = parseInt(readPositionParam, 10)

      if(length == NaN || position == NaN) {
        Alert.alert('Length and Position must be integers')
        return
      }

      RNFS.read(RNFS.DocumentDirectoryPath + '/' + readParam, length, position)
            .then((result) => {
              Alert.alert('File Contents:', result)
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }

  const hashFileExample = () => {
    if(hashFileParam.length > 0) {
      RNFS.hash(RNFS.DocumentDirectoryPath + '/' + hashFileParam, selectedValue)
            .then((result) => {
              Alert.alert('Hashed File Contents:', result)
            })
            .catch((err) => {
              Alert.alert(err.message)
            })
    }
  }
  
  const writeFileExample = () => {

    if(writeFileParam.length > 0 && writeFileContentValue.
```

### Core Architecture Module: `Examples/RNFS.Windows/babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `Examples/RNFS.Windows/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `Examples/RNFS.Windows/metro.config.js`
```
/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const path = require('path');
const blacklist = require('metro-config/src/defaults/blacklist');

module.exports = {
  resolver: {
    blacklistRE: blacklist([
      // This stops "react-native run-windows" from causing the metro server to crash if its already running
      new RegExp(
        `${path.resolve(__dirname, 'windows').replace(/[/\\]/g, '/')}.*`,
      ),
      // This prevents "react-native run-windows" from hitting: EBUSY: resource busy or locked, open msbuild.ProjectImports.zip
      /.*\.ProjectImports\.zip/,
    ]),
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
};

```

### Core Architecture Module: `Examples/RNFS.Windows/windows/RNFSWin/App.cpp`
```
#include "pch.h"

#include "App.h"

#include "AutolinkedNativeModules.g.h"
#include "ReactPackageProvider.h"


using namespace winrt::RNFSWin;
using namespace winrt::RNFSWin::implementation;
using namespace winrt;
using namespace Windows::UI::Xaml;
using namespace Windows::UI::Xaml::Controls;
using namespace Windows::UI::Xaml::Navigation;
using namespace Windows::ApplicationModel;

/// <summary>
/// Initializes the singleton application object.  This is the first line of
/// authored code executed, and as such is the logical equivalent of main() or
/// WinMain().
/// </summary>
App::App() noexcept
{
#if BUNDLE
    JavaScriptBundleFile(L"index.windows");
    InstanceSettings().UseWebDebugger(false);
    InstanceSettings().UseFastRefresh(false);
#else
    JavaScriptMainModuleName(L"index");
    InstanceSettings().UseWebDebugger(true);
    InstanceSettings().UseFastRefresh(true);
#endif

#if _DEBUG
    InstanceSettings().UseDeveloperSupport(true);
#else
    InstanceSettings().UseDeveloperSupport(false);
#endif

    RegisterAutolinkedNativeModulePackages(PackageProviders()); // Includes any autolinked modules

    PackageProviders().Append(make<ReactPackageProvider>()); // Includes all modules in this project

    InitializeComponent();
}

/// <summary>
/// Invoked when the application is launched normally by the end user.  Other entry points
/// will be used such as when the application is launched to open a specific file.
/// </summary>
/// <param name="e">Details about the launch request and process.</param>
void App::OnLaunched(activation::LaunchActivatedEventArgs const& e)
{
    super::OnLaunched(e);

    Frame rootFrame = Window::Current().Content().as<Frame>();
    rootFrame.Navigate(xaml_typename<RNFSWin::MainPage>(), box_value(e.Arguments()));
}

/// <summary>
/// Invoked when application execution is being suspended.  Application state is saved
/// without knowing whether the application will be terminated or resumed with the contents
/// of memory still intact.
/// </summary>
/// <param name="sender">The source of the suspend request.</param>
/// <param name="e">Details about the suspend request.</param>
void App::OnSuspending([[maybe_unused]] IInspectable const& sender, [[maybe_unused]] SuspendingEventArgs const& e)
{
    // Save application state and stop any background activity
}

/// <summary>
/// Invoked when Navigation to a certain page fails
/// </summary>
/// <param name="sender">The Frame which failed navigation</param>
/// <param name="e">Details about the navigation failure</param>
void App::OnNavigationFailed(IInspectable const&, NavigationFailedEventArgs const& e)
{
    throw hresult_error(E_FAIL, hstring(L"Failed to load Page ") + e.SourcePageType().Name);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #787** (2019-10-21): **Bug in 2.15**
  *Symptoms*: In .ts definitions (index.d.ts), progressInterval member of DownloadFileOptions should be optional (with question mark). 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting!  This is fixed now in `2.15.3-tag.` https://www.npmjs.com/package/react-native-fs/v/2.15.3  And also vor 2.16 in `2.16.1`  

- **Issue #449** (2018-02-21): **#hash() does not do normalizeFilePath**
  *Symptoms*: https://github.com/itinance/react-native-fs/blob/master/FS.common.js#L328 fails with "file://..." paths
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting! Most likely a `normalizeFilePath(filepath)` would solve this issue in Line [https://github.com/itinance/react-native-fs/blob/master/FS.common.js#L328](https://github.com/itinance/react-native-fs/blob/master/FS.common.js#L328)  Is anyone willing to provide a PR? Otherwise i will fix it later by myself 
  > @itinance #450 
  > Just released with 2.9.11.  Thank you!

- **Issue #302** (2017-06-09): **pod file path error**
  *Symptoms*: pod file path error
  **Post-Mortem & Fix Analysis**:
  > Nice catch! Thank you very much!

- **Issue #287** (2017-04-28): **childFile.lastModified needs to be coverted to string**
  *Symptoms*: Hello I just created a fresh ReactNative project and installed the latest version (2.3.0). and i'm getting the following error  `RNFSManager.java:262: error: incompatible types: long cannot be converted to String`  It seems that the problem is in the following line `fileMap.putString("mtime", childFile.lastModified());`   childFile.lastModified needs to be converted from long to string before adding it to the fileMap The following fixes the issue  `fileMap.putString("mtime", String.valueOf(childFile.lastModified()));`    
  **Post-Mortem & Fix Analysis**:
  > Thanx for figuring out! Could you make a PR pls with your fix?
  > Fixed with "putInt" instead of "putString"
  > fixed with latest release

- **Issue #224** (2017-05-03): **App crashes on file read**
  *Symptoms*: Experiencing app crash on large file size(~15s+ video) read.  http://i.imgur.com/gxrzF4Z.png ``` RNFS.readFile(path, 'base64').then((data) => { 		data = `data:${contentType}/${type};base64,${data}`; 		fetchMessage(...); 	}); } ``` any idea how i can work around that?
  **Post-Mortem & Fix Analysis**:
  > +1
  > +1
  > Same here

- **Issue #218** (2017-05-03): **Downloads can be both resolved and rejected.**
  *Symptoms*: Hello,  First of all I must thank you for this very nice and convenient module.  Recently I have noticed that, when you try to stop a download job with `RNFS.stopDownload`, the native code allows you to trigger the rejection of the download promise even if it has already been resolved.  ![rnfs_issue](https://cloud.githubusercontent.com/assets/17614778/21006268/69a7154c-bd38-11e6-9c0b-fef36aa9cb79.png)  As of the Javascript side, it raises an exception which is quite difficult to understand (and which, fortunately, only occurs when `__DEV__` is true, see https://github.com/facebook/react-native/blob/master/Libraries/BatchedBridge/MessageQueue.js#L246-L271 ):  ![rnfs_issue_emulator_snapshot](https://cloud.githubusercontent.com/assets/17614778/21006568/b3e050c8-bd39-11e6-8ba1-c6fa51f5b1b4.png)  Of course you might tell me, and you would probably be right: "If you try to stop something which is already over, you are exposed to unpredictable behaviours". However it could be nice to have a safeguard in the native code which prevents this kind of exception to happen.  Hope this helps :)
  **Post-Mortem & Fix Analysis**:
  > This PR resolves this issue: https://github.com/johanneslumpe/react-native-fs/pull/219

- **Issue #71** (2016-06-04): **downloadFile does not follow redirects on Android**
  *Symptoms*: Right now downloadFile does not follow redirects on Android where it does on iOS. 
  **Post-Mortem & Fix Analysis**:
  > I added this hack to download and it "works" though it is a hack:  ``` java       if(statusCode == 302) {         String location = headers.get("Location").get(0);         param.src = new URL(location);         download(param, res);         return;       } ``` 
  > In investigating further it looks looks like `HttpURLConnection` on [Android won't follow redirects from HTTP to HTTPS](http://developer.android.com/reference/java/net/HttpURLConnection.html):  > This implementation doesn't follow redirects from HTTPS to HTTP or vice versa.  whereas it seems the library on iOS does. 
  > This should work as of version `1.5.0`. 

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

### Incident Patch 1: `ac58ff83` (2022-03-30)
**Commit Message**: Fix comments

**File**: `README.md` (modified, +2/-2)
```diff
@@ -335,8 +335,8 @@ type ReadDirItem = {
   name: string;     // The name of the item
   path: string;     // The absolute path to the item
   size: string;     // Size in bytes
-  isFile: () => boolean;        // Is the file just a file?
-  isDirectory: () => boolean;   // Is the file a directory?
+  isFile: () => boolean;        // Is the item just a file?
+  isDirectory: () => boolean;   // Is the item a directory?
 };
 ```
 
```

---

### Incident Patch 2: `e9a51558` (2021-11-25)
**Commit Message**: Merge pull request #1 from IntelexTechnologies/iOS_crashes

RNFSManager iOS crash in readDir

**File**: `RNFSManager.m` (modified, +14/-13)
```diff
@@ -57,26 +57,27 @@ + (BOOL)requiresMainQueueSetup
   NSError *error = nil;
 
   NSArray *contents = [fileManager contentsOfDirectoryAtPath:dirPath error:&error];
-
-  contents = [contents rnfs_mapObjectsUsingBlock:^id(NSString *obj, NSUInteger idx) {
+  NSMutableArray *tagetContents = [[NSMutableArray alloc] init];
+  for (NSString *obj in contents) {
     NSString *path = [dirPath stringByAppendingPathComponent:obj];
     NSDictionary *attributes = [fileManager attributesOfItemAtPath:path error:nil];
-
-    return @{
-             @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
-             @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
-             @"name": obj,
-             @"path": path,
-             @"size": [attributes objectForKey:NSFileSize],
-             @"type": [attributes objectForKey:NSFileType]
-             };
-  }];
+    if(attributes != nil) {
+        [tagetContents addObject:@{
+            @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
+            @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
+            @"name": obj,
+            @"path": path,
+            @"size": [attributes objectForKey:NSFileSize],
+            @"type": [attributes objectForKey:NSFileType]
+            }];
+    }
+  }
 
   if (error) {
     return [self reject:reject withError:error];
   }
 
-  resolve(contents);
+  resolve(tagetContents);
 }
 
 RCT_EXPORT_METHOD(exists:(NSString *)filepath
```

---

### Incident Patch 3: `24492fa6` (2021-11-16)
**Commit Message**: RNFSManager iOS crash in readDir

**File**: `RNFSManager.m` (modified, +14/-13)
```diff
@@ -57,26 +57,27 @@ + (BOOL)requiresMainQueueSetup
   NSError *error = nil;
 
   NSArray *contents = [fileManager contentsOfDirectoryAtPath:dirPath error:&error];
-
-  contents = [contents rnfs_mapObjectsUsingBlock:^id(NSString *obj, NSUInteger idx) {
+  NSMutableArray *tagetContents = [[NSMutableArray alloc] init];
+  for (NSString *obj in contents) {
     NSString *path = [dirPath stringByAppendingPathComponent:obj];
     NSDictionary *attributes = [fileManager attributesOfItemAtPath:path error:nil];
-
-    return @{
-             @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
-             @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
-             @"name": obj,
-             @"path": path,
-             @"size": [attributes objectForKey:NSFileSize],
-             @"type": [attributes objectForKey:NSFileType]
-             };
-  }];
+    if(attributes != nil) {
+        [tagetContents addObject:@{
+            @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
+            @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
+            @"name": obj,
+            @"path": path,
+            @"size": [attributes objectForKey:NSFileSize],
+            @"type": [attributes objectForKey:NSFileType]
+            }];
+    }
+  }
 
   if (error) {
     return [self reject:reject withError:error];
   }
 
-  resolve(contents);
+  resolve(tagetContents);
 }
 
 RCT_EXPORT_METHOD(exists:(NSString *)filepath
```

---

### Incident Patch 4: `136bf287` (2021-10-20)
**Commit Message**: fix: use correct type for stat size

Hey. I console.log'd a list of files I got from `fs.readDir()` and to me it looks like the size property is of type `number`, not `string`:
```
{
    "ctime": "2021-10-19T16:02:30.807Z",
    "mtime": "2021-10-19T16:02:35.146Z",
    "name": "B1979F99-6369-4036-8476-B6D14E653B0E.mp4",
    "path": "/private/var/mobile/Containers/Data/Application/0CE5748F-79A8-4120-B366-C92E6E0C6D17/tmp/ReactNative/B1979F99-6369-4036-8476-B6D14E653B0E.mp4",
    "size": 34234799,
}
```

Could you please check and verify/falsify that?

**File**: `index.d.ts` (modified, +2/-2)
```diff
@@ -12,15 +12,15 @@ type ReadDirItem = {
 	mtime: Date | undefined // The last modified date of the file
 	name: string // The name of the item
 	path: string // The absolute path to the item
-	size: string // Size in bytes
+	size: number // Size in bytes
 	isFile: () => boolean // Is the file just a file?
 	isDirectory: () => boolean // Is the file a directory?
 }
 
 type StatResult = {
 	name: string | undefined // The name of the item TODO: why is this not documented?
 	path: string // The absolute path to the item
-	size: string // Size in bytes
+	size: number // Size in bytes
 	mode: number // UNIX file mode
 	ctime: number // Created date
 	mtime: number // Last modified date
```

---

### Incident Patch 5: `146e7fb4` (2021-10-13)
**Commit Message**: Merge pull request #890 from egealpay/overwrite-fix-android-10

Fix: Overwrite bug on Android 10

**File**: `android/src/main/java/com/rnfs/RNFSManager.java` (modified, +5/-1)
```diff
@@ -115,11 +115,15 @@ private InputStream getInputStream(String filepath) throws IORejectionException
     return stream;
   }
 
+  private String getWriteAccessByAPILevel() {
+    return android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.P ? "w" : "rwt";
+  }
+
   private OutputStream getOutputStream(String filepath, boolean append) throws IORejectionException {
     Uri uri = getFileUri(filepath, false);
     OutputStream stream;
     try {
-      stream = reactContext.getContentResolver().openOutputStream(uri, append ? "wa" : "w");
+      stream = reactContext.getContentResolver().openOutputStream(uri, append ? "wa" : getWriteAccessByAPILevel());
     } catch (FileNotFoundException ex) {
       throw new IORejectionException("ENOENT", "ENOENT: " + ex.getMessage() + ", open '" + filepath + "'");
     }
```

---

### Incident Patch 6: `47cf3304` (2021-02-28)
**Commit Message**: Merge pull request #975 from byeokim/fix-resize-mode

Fix copyAssetsFileIOS's image resizing option to resize to exact width and height

**File**: `RNFSManager.m` (modified, +1/-1)
```diff
@@ -812,7 +812,7 @@ + (BOOL)requiresMainQueueSetup
         imageOptions.resizeMode = PHImageRequestOptionsResizeModeNone;
     } else {
         targetSize = CGSizeApplyAffineTransform(size, CGAffineTransformMakeScale(scale, scale));
-        imageOptions.resizeMode = PHImageRequestOptionsResizeModeFast;
+        imageOptions.resizeMode = PHImageRequestOptionsResizeModeExact;
     }
 
     PHImageContentMode contentMode = PHImageContentModeAspectFill;
```

---

### Incident Patch 7: `15712111` (2021-02-11)
**Commit Message**: Fix indentation

**File**: `windows/RNFS/RNFSManager.cpp` (modified, +1/-2)
```diff
@@ -456,7 +456,6 @@ catch (const hresult_error& ex)
 winrt::fire_and_forget RNFSManager::stat(std::string filepath, RN::ReactPromise<RN::JSValueObject> promise) noexcept
 try
 {
-
     size_t pathLength{ filepath.length() };
 
     if (pathLength <= 0) {
@@ -930,7 +929,7 @@ IAsyncAction RNFSManager::ProcessDownloadRequestAsync(RN::ReactPromise<RN::JSVal
 
         std::filesystem::path fsFilePath{ filePath };
 
-		StorageFolder storageFolder{ co_await StorageFolder::GetFolderFromPathAsync(fsFilePath.parent_path().wstring()) };
+        StorageFolder storageFolder{ co_await StorageFolder::GetFolderFromPathAsync(fsFilePath.parent_path().wstring()) };
         StorageFile storageFile{ co_await storageFolder.CreateFileAsync(fsFilePath.filename().wstring(), CreationCollisionOption::ReplaceExisting) };
         IRandomAccessStream  stream{ co_await storageFile.OpenAsync(FileAccessMode::ReadWrite) };
         IOutputStream outputStream{ stream.GetOutputStreamAt(0) };
```

**File**: `windows/RNFS/RNFSManager.h` (modified, +5/-5)
```diff
@@ -16,13 +16,13 @@ namespace RN = winrt::Microsoft::ReactNative;
 struct CancellationDisposable final
 {
     CancellationDisposable() = default;
-	CancellationDisposable(winrt::Windows::Foundation::IAsyncInfo const& async, std::function<void()>&& onCancel) noexcept;
+    CancellationDisposable(winrt::Windows::Foundation::IAsyncInfo const& async, std::function<void()>&& onCancel) noexcept;
 
-	CancellationDisposable(CancellationDisposable&& other) noexcept;
-	CancellationDisposable& operator=(CancellationDisposable&& other) noexcept;
+    CancellationDisposable(CancellationDisposable&& other) noexcept;
+    CancellationDisposable& operator=(CancellationDisposable&& other) noexcept;
 
-	CancellationDisposable(CancellationDisposable const&) = delete;
-	CancellationDisposable& operator=(CancellationDisposable const&) = delete;
+    CancellationDisposable(CancellationDisposable const&) = delete;
+    CancellationDisposable& operator=(CancellationDisposable const&) = delete;
 
     ~CancellationDisposable() noexcept;
 
```

---

### Incident Patch 8: `8f481249` (2021-01-11)
**Commit Message**: Fix resizeMode to resize image to match target size exactly

**File**: `RNFSManager.m` (modified, +1/-1)
```diff
@@ -812,7 +812,7 @@ + (BOOL)requiresMainQueueSetup
         imageOptions.resizeMode = PHImageRequestOptionsResizeModeNone;
     } else {
         targetSize = CGSizeApplyAffineTransform(size, CGAffineTransformMakeScale(scale, scale));
-        imageOptions.resizeMode = PHImageRequestOptionsResizeModeFast;
+        imageOptions.resizeMode = PHImageRequestOptionsResizeModeExact;
     }
 
     PHImageContentMode contentMode = PHImageContentModeAspectFill;
```

---

### Incident Patch 9: `e75da47b` (2020-11-04)
**Commit Message**: Implemented fixes for read, touch, and stat

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -30,4 +30,3 @@ android/local.properties
 android/.settings
 android/.project
 Session.vim
-/RNFSWinV2/windows/RNFSWinV2/RNFSWinV2_TemporaryKey.pfx
```

**File**: `Examples/RNFS.Windows/App.tsx` (modified, +0/-14)
```diff
@@ -69,8 +69,6 @@ const App: () => React$Node = () => {
   const [writePositionValue, setWritePositionValue] = useState('');
 
   const [touchFilePathParam, setTouchFilePathParam] = useState('');
-  const [touchMTime, setTouchMTime] = useState('');
-  const [touchCTime, setTouchCTime] = useState('');
 
   const [downloadFilePathParam, setDownloadFilePathParam] = useState('');
   const [downloadFileSource, setDownloadFileSource] = useState('');
@@ -897,18 +895,6 @@ const App: () => React$Node = () => {
                 placeholderTextColor = "#9a73ef"
                 autoCapitalize = "none"
               />
-              <TextInput style = {styles.input}
-                placeholder = "Modified UNIX Time"
-                onChangeText={touchMTime => setTouchMTime(touchMTime)}
-                placeholderTextColor = "#9a73ef"
-                autoCapitalize = "none"
-              />
-              <TextInput style = {styles.input}
-                placeholder = "Created UNIX Time"
-                onChangeText={touchCTime => setTouchCTime(touchCTime)}
-                placeholderTextColor = "#9a73ef"
-                autoCapitalize = "none"
-              />
               </View>
             <Button
               title="Touch File with New Times"
```

**File**: `windows/RNFS.Tests/RNFS.Tests.vcxproj` (removed, +0/-219)
```diff
@@ -1,219 +0,0 @@
-<?xml version="1.0" encoding="utf-8"?>
-<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
-  <Import Project="..\packages\Microsoft.Windows.CppWinRT.2.0.200316.3\build\native\Microsoft.Windows.CppWinRT.props" Condition="Exists('..\packages\Microsoft.Windows.CppWinRT.2.0.200316.3\build\native\Microsoft.Windows.CppWinRT.props')" />
-  <PropertyGroup Label="Globals">
-    <CppWinRTOptimized>true</CppWinRTOptimized>
-    <CppWinRTRootNamespaceAutoMerge>true</CppWinRTRootNamespaceAutoMerge>
-    <MinimalCoreWin>true</MinimalCoreWin>
-    <VCProjectVersion>16.0</VCProjectVersion>
-    <ProjectGuid>{97b91d7b-4ac7-44f8-b7d3-7c7346eaf646}</ProjectGuid>
-    <Keyword>Win32Proj</Keyword>
-    <RootNamespace>Microsoft.ReactNative</RootNamespace>
-    <WindowsTargetPlatformVersion Condition=" '$(WindowsTargetPlatformVersion)' == '' ">10.0.18362.0</WindowsTargetPlatformVersion>
-    <WindowsTargetPlatformMinVersion>10.0.16299.0</WindowsTargetPlatformMinVersion>
-    <CppWinRTNamespaceMergeDepth>2</CppWinRTNamespaceMergeDepth>
-  </PropertyGroup>
-  <ItemGroup Label="ProjectConfigurations">
-    <ProjectConfiguration Include="Debug|Win32">
-      <Configuration>Debug</Configuration>
-      <Platform>Win32</Platform>
-    </ProjectConfiguration>
-    <ProjectConfiguration Include="Release|Win32">
-      <Configuration>Release</Configuration>
-      <Platform>Win32</Platform>
-    </ProjectConfiguration>
-    <ProjectConfiguration Include="Debug|x64">
-      <Configuration>Debug</Configuration>
-      <Platform>x64</Platform>
-    </ProjectConfiguration>
-    <ProjectConfiguration Include="Release|x64">
-      <Configuration>Release</Configuration>
-      <Platform>x64</Platform>
-    </ProjectConfiguration>
-  </ItemGroup>
-  <Import Project="$(VCTargetsPath)\Microsoft.Cpp.Default.props" />
-  <PropertyGroup Label="ReactNativeWindowsNodeProps">
-    <ReactNativeWindowsDir Condition="'$(ReactNativeWindowsDir)' == ''">$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), 'node_modules\react-native-windows\package.json'))\node_modules\react-native-windows\</ReactNativeWindowsDir>
-    <ReactNativeCxxTestsDir>$(ReactNativeWindowsDir)Microsoft.ReactNative.Cxx.UnitTests\</ReactNativeCxxTestsDir>
-  </PropertyGroup>
-  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'" Label="Configuration">
-    <ConfigurationType>Application</ConfigurationType>
-    <UseDebugLibraries>true</UseDebugLibraries>
-    <PlatformToolset>v142</PlatformToolset>
-    <CharacterSet>Unicode</CharacterSet>
-  </PropertyGroup>
-  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|Win32'" Label="Configuration">
-    <ConfigurationType>Application</ConfigurationType>
-    <UseDebugLibraries>false</UseDebugLibraries>
-    <PlatformToolset>v142</PlatformToolset>
-    <WholeProgramOptimization>true</WholeProgramOptimization>
-    <CharacterSet>Unicode</CharacterSet>
-  </PropertyGroup>
-  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'" Label="Configuration">
-    <ConfigurationType>Application</ConfigurationType>
-    <UseDebugLibraries>true</UseDebugLibraries>
-    <PlatformToolset>v142</PlatformToolset>
-    <CharacterSet>Unicode</CharacterSet>
-  </PropertyGroup>
-  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'" Label="Configuration">
-    <ConfigurationType>Application</ConfigurationType>
-    <UseDebugLibraries>false</UseDebugLibraries>
-    <PlatformToolset>v142</PlatformToolset>
-    <WholeProgramOptimization>true</WholeProgramOptimization>
-    <CharacterSet>Unicode</CharacterSet>
-  </PropertyGroup>
-  <Import Project="$(VCTargetsPath)\Microsoft.Cpp.props" />
-  <ImportGroup Label="ExtensionSettings">
-  </ImportGroup>
-  <ImportGroup Label="Shared">
-    <Import Project="$(ReactNativeWindowsDir)\Microsoft.ReactNative.Cxx\Microsoft.ReactNative.Cxx.vcxitems" Label="Shared" />
-    <Import Project="$(ReactNativeW
```

**File**: `windows/RNFS.Tests/RNFS.Tests.vcxproj.filters` (removed, +0/-92)
```diff
@@ -1,92 +0,0 @@
-﻿<?xml version="1.0" encoding="utf-8"?>
-<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
-  <ItemGroup>
-    <Filter Include="Source Files">
-      <UniqueIdentifier>{4FC737F1-C7A5-4376-A066-2A32D752A2FF}</UniqueIdentifier>
-      <Extensions>cpp;c;cc;cxx;c++;def;odl;idl;hpj;bat;asm;asmx</Extensions>
-    </Filter>
-    <Filter Include="Header Files">
-      <UniqueIdentifier>{93995380-89BD-4b04-88EB-625FBE52EBFB}</UniqueIdentifier>
-      <Extensions>h;hh;hpp;hxx;h++;hm;inl;inc;ipp;xsd</Extensions>
-    </Filter>
-    <Filter Include="Resource Files">
-      <UniqueIdentifier>{67DA6AB6-F800-4c08-8B7A-83BB121AAD01}</UniqueIdentifier>
-      <Extensions>rc;ico;cur;bmp;dlg;rc2;rct;bin;rgs;gif;jpg;jpeg;jpe;resx;tiff;tif;png;wav;mfcribbon-ms</Extensions>
-    </Filter>
-  </ItemGroup>
-  <ItemGroup>
-    <ClCompile Include="$(ReactNativeCxxTestsDir)JsonJSValueReader.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="$(ReactNativeCxxTestsDir)JsonReader.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="$(ReactNativeCxxTestsDir)NativeModuleTest.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="$(ReactNativeCxxTestsDir)ReactModuleBuilderMock.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="main.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="pch.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-    <ClCompile Include="RNFSModuleTest.cpp">
-      <Filter>Source Files</Filter>
-    </ClCompile>
-  </ItemGroup>
-  <ItemGroup>
-    <None Include="packages.config" />
-  </ItemGroup>
-  <ItemGroup>
-    <ClInclude Include="$(ReactNativeCxxTestsDir)JsonJSValueReader.h">
-      <Filter>Header Files</Filter>
-    </ClInclude>
-    <ClInclude Include="$(ReactNativeCxxTestsDir)JsonReader.h">
-      <Filter>Header Files</Filter>
-    </ClInclude>
-    <ClInclude Include="pch.h">
-      <Filter>Header Files</Filter>
-    </ClInclude>
-    <ClInclude Include="$(ReactNativeCxxTestsDir)Point.h">
-      <Filter>Header Files</Filter>
-    </ClInclude>
-    <ClInclude Include="$(ReactNativeCxxTestsDir)ReactModuleBuilderMock.h">
-      <Filter>Header Files</Filter>
-    </ClInclude>
-  </ItemGroup>
-  <ItemGroup>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IJSValueReader.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IJSValueWriter.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactContext.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactDispatcher.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactModuleBuilder.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactNonAbiValue.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactPackageBuilder.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IReactPropertyBag.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\IViewManager.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-    <Midl Include="$(ReactNativeWindowsDir)Microsoft.ReactNative\NoExceptionAttribute.idl">
-      <Filter>Source Files</Filter>
-    </Midl>
-  </ItemGroup>
-</Project>
\ No newline at end of file
```

**File**: `windows/RNFS.sln` (removed, +0/-227)
```diff
@@ -1,227 +0,0 @@
-﻿
-Microsoft Visual Studio Solution File, Format Version 12.00
-# Visual Studio Version 16
-VisualStudioVersion = 16.0.29215.179
-MinimumVisualStudioVersion = 10.0.40219.1
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "RNFS", "RNFS\RNFS.vcxproj", "{1599491E-7A95-445B-9AE0-6BD0C48A6F89}"
-	ProjectSection(ProjectDependencies) = postProject
-		{F7D32BD0-2749-483E-9A0D-1635EF7E3136} = {F7D32BD0-2749-483E-9A0D-1635EF7E3136}
-	EndProjectSection
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Folly", "..\node_modules\react-native-windows\Folly\Folly.vcxproj", "{A990658C-CE31-4BCC-976F-0FC6B1AF693D}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "ReactCommon", "..\node_modules\react-native-windows\ReactCommon\ReactCommon.vcxproj", "{A9D95A91-4DB7-4F72-BEB6-FE8A5C89BFBD}"
-	ProjectSection(ProjectDependencies) = postProject
-		{A990658C-CE31-4BCC-976F-0FC6B1AF693D} = {A990658C-CE31-4BCC-976F-0FC6B1AF693D}
-	EndProjectSection
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "ReactWindowsCore", "..\node_modules\react-native-windows\ReactWindowsCore\ReactWindowsCore.vcxproj", "{11C084A3-A57C-4296-A679-CAC17B603144}"
-	ProjectSection(ProjectDependencies) = postProject
-		{A990658C-CE31-4BCC-976F-0FC6B1AF693D} = {A990658C-CE31-4BCC-976F-0FC6B1AF693D}
-	EndProjectSection
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Chakra", "..\node_modules\react-native-windows\Chakra\Chakra.vcxitems", "{C38970C0-5FBF-4D69-90D8-CBAC225AE895}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Microsoft.ReactNative", "..\node_modules\react-native-windows\Microsoft.ReactNative\Microsoft.ReactNative.vcxproj", "{F7D32BD0-2749-483E-9A0D-1635EF7E3136}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "JSI.Shared", "..\node_modules\react-native-windows\JSI\Shared\JSI.Shared.vcxitems", "{0CC28589-39E4-4288-B162-97B959F8B843}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "JSI.Universal", "..\node_modules\react-native-windows\JSI\Universal\JSI.Universal.vcxproj", "{A62D504A-16B8-41D2-9F19-E2E86019E5E4}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Microsoft.ReactNative.Cxx", "..\node_modules\react-native-windows\Microsoft.ReactNative.Cxx\Microsoft.ReactNative.Cxx.vcxitems", "{DA8B35B3-DA00-4B02-BDE6-6A397B3FD46B}"
-EndProject
-Project("{D954291E-2A0B-460D-934E-DC6B0785DB48}") = "Microsoft.ReactNative.SharedManaged", "..\node_modules\react-native-windows\Microsoft.ReactNative.SharedManaged\Microsoft.ReactNative.SharedManaged.shproj", "{67A1076F-7790-4203-86EA-4402CCB5E782}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Common", "..\node_modules\react-native-windows\Common\Common.vcxproj", "{FCA38F3C-7C73-4C47-BE4E-32F77FA8538D}"
-EndProject
-Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "ReactNative", "ReactNative", "{5EA20F54-880A-49F3-99FA-4B3FE54E8AB1}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Shared", "..\node_modules\react-native-windows\Shared\Shared.vcxitems", "{2049DBE9-8D13-42C9-AE4B-413AE38FFFD0}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "Mso", "..\node_modules\react-native-windows\Mso\Mso.vcxitems", "{84E05BFA-CBAF-4F0D-BFB6-4CE85742A57E}"
-EndProject
-Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "RNFS.Tests", "RNFS.Tests\RNFS.Tests.vcxproj", "{97B91D7B-4AC7-44F8-B7D3-7C7346EAF646}"
-EndProject
-Global
-	GlobalSection(SharedMSBuildProjectFiles) = preSolution
-		..\node_modules\react-native-windows\JSI\Shared\JSI.Shared.vcxitems*{0cc28589-39e4-4288-b162-97b959f8b843}*SharedItemsImports = 9
-		..\node_modules\react-native-windows\ReactWindowsCore\ReactWindowsCore.vcxitems*{11c084a3-a57c-4296-a679-cac17b603144}*SharedItemsImports = 4
-		..\node_modules\react-native-windows\Shared\Shared.vcxitems*{2049dbe9-8d13-42c9-ae4b-413ae38fffd0}*SharedItemsImports = 9
-		..\node_modules\react-native-windows\Microsoft.ReactNa
```

---

### Incident Patch 10: `9ea16cac` (2020-09-16)
**Commit Message**: Implement hotfix for progressIncrement in downloadFile

**File**: `RNFSWinV2/windows/RNFSWinV2/RNFSManager.cpp` (modified, +30/-16)
```diff
@@ -692,7 +692,7 @@ void RNFSManager::splitPath(const std::string& fullPath, winrt::hstring& directo
 
 
 IAsyncAction RNFSManager::ProcessDownloadRequestAsync(RN::ReactPromise<RN::JSValueObject> promise,
-    HttpRequestMessage request, std::wstring_view filePath, int jobId, uint64_t progressInterval, uint64_t progressDivider)
+    HttpRequestMessage request, std::wstring_view filePath, int jobId, int64_t progressInterval, int64_t progressDivider)
 {
     try
     {
@@ -725,18 +725,12 @@ IAsyncAction RNFSManager::ProcessDownloadRequestAsync(RN::ReactPromise<RN::JSVal
 
         auto contentStream = co_await response.Content().ReadAsInputStreamAsync();
         auto contentLengthForProgress = contentLength.Type() == PropertyType::UInt64 ? contentLength.Value() : -1;
-        uint64_t nextProgressIncrement { 0 };
-        if (progressInterval >= 0)
-        {
-            nextProgressIncrement = progressInterval;
-        }
-        else if (progressDivider >= 0)
-        {
-            nextProgressIncrement = contentLengthForProgress / progressDivider;
-        }
         
         Buffer buffer{ 8 * 1024 };
         uint32_t read = 0;
+        int64_t initialProgressTime{ winrt::clock::now().time_since_epoch().count() / 10000 };
+        int64_t currentProgressTime;
+        uint64_t progressDividerUnsigned{ uint64_t(progressDivider) };
 
         for (;;)
         {
@@ -749,21 +743,41 @@ IAsyncAction RNFSManager::ProcessDownloadRequestAsync(RN::ReactPromise<RN::JSVal
             }
 
             co_await outputStream.WriteAsync(readBuffer);
+            totalRead += read;
 
-            if (contentLengthForProgress >= 0)
+            if (progressInterval > 0)
             {
-                totalRead += read;
-                if (totalRead * 100 / contentLengthForProgress >= nextProgressIncrement ||
-                    totalRead == contentLengthForProgress)
+                currentProgressTime = winrt::clock::now().time_since_epoch().count() / 10000;
+                if(currentProgressTime - initialProgressTime >= progressInterval)
                 {
                     m_reactContext.CallJSFunction(L"RCTDeviceEventEmitter", L"emit", L"DownloadProgress",
                         RN::JSValueObject{
                             { "jobId", jobId },
                             { "contentLength", contentLength.Type() == PropertyType::UInt64 ? RN::JSValue(contentLength.Value()) : RN::JSValue{nullptr} },
                             { "bytesWritten", totalRead },
                         });
-
-                    nextProgressIncrement += progressInterval;
+                    initialProgressTime = winrt::clock::now().time_since_epoch().count() / 10000;
+                }
+            }
+            else if (progressDivider <= 0)
+            {
+                m_reactContext.CallJSFunction(L"RCTDeviceEventEmitter", L"emit", L"DownloadProgress",
+                    RN::JSValueObject{
+                        { "jobId", jobId },
+                        { "contentLength", contentLength.Type() == PropertyType::UInt64 ? RN::JSValue(contentLength.Value()) : RN::JSValue{nullptr} },
+                        { "bytesWritten", totalRead },
+                    });
+            }
+            else
+            {
+                if (totalRead * 100 / contentLengthForProgress >= progressDividerUnsigned ||
+                    totalRead == contentLengthForProgress) {
+                    m_reactContext.CallJSFunction(L"RCTDeviceEventEmitter", L"emit", L"DownloadProgress",
+                        RN::JSValueObject{
+                            { "jobId", jobId },
+                            { "contentLength", contentLength.Type() == PropertyType::UInt64 ? RN::JSValue(contentLength.Value()) : RN::JSValue{nullptr} },
+                            { "bytesWritten", totalRead },
+                        });
                 }
             }
         }
```

**File**: `RNFSWinV2/windows/RNFSWinV2/RNFSManager.h` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ struct RNFSManager
 private:
     void splitPath(const std::string& fullPath, winrt::hstring& directoryPath, winrt::hstring& fileName) noexcept;
     winrt::Windows::Foundation::IAsyncAction ProcessDownloadRequestAsync(RN::ReactPromise<RN::JSValueObject> promise,
-        winrt::Windows::Web::Http::HttpRequestMessage request, std::wstring_view filePath, int32_t jobId, uint64_t progressInterval, uint64_t progressDivider);
+        winrt::Windows::Web::Http::HttpRequestMessage request, std::wstring_view filePath, int32_t jobId, int64_t progressInterval, int64_t progressDivider);
 
     winrt::Windows::Foundation::IAsyncAction ProcessUploadRequestAsync(RN::ReactPromise<RN::JSValueObject> promise, RN::JSValueObject& options,
         winrt::Windows::Web::Http::HttpMethod httpMethod, RN::JSValueArray const& files, int32_t jobId, uint64_t totalUploadSize);
```

#### Recent Merged Pull Requests:
- **PR #1265** (closed): Paul/fix mkdir recursive (@paulnewby)
- **PR #1245** (closed): README.md | Spelling correction (@arcaela)
- **PR #1240** (closed): feat: add visionOS support (@okwasniewski)
- **PR #1225** (closed): Fix/lgscrum 2386 (@crislizameLG)
- **PR #1199** (closed): Oops please ignore (@IanOpenSpace)
- **PR #1180** (closed): sync FileOutputStream FD (@rafaelri)
- **PR #1179** (closed): sync FileOutputStream FD (@rafaelri)
- **PR #1155** (closed): Synched from master upstream itinance/react-native-fs (@Antiblanks)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
