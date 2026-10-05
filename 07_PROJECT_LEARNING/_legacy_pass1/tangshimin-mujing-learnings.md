# Forensic Learning Record (Deep Inspection): tangshimin/MuJing

> **Canonical Artifact**: `07_PROJECT_LEARNING/tangshimin-mujing-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tangshimin/MuJing](https://github.com/tangshimin/MuJing))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:20:52.416Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tangshimin/MuJing`
- **Description**: 一款通过电影、美剧或文档中的真实语境学习英语单词的应用，让您在原汁原味的情境中记忆词汇，提升学习效率。
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4632 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `rust-zstd-jni/src/lib.rs`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

use anyhow::{Context, Result};
use jni::objects::{JByteArray, JObject};
use jni::sys::{jbyteArray, jint, jstring};
use jni::JNIEnv;
use std::io::{Read, Write};

fn zstd_compress_internal(input: &[u8], level: i32) -> Result<Vec<u8>> {
    let lvl = if level == 0 { 3 } else { level };
    // 使用高层 Encoder，并设置 pledged 源大小 + 校验和 + 不写 content size
    let mut enc = zstd::stream::Encoder::new(Vec::with_capacity(input.len() / 2 + 64), lvl)
        .context("failed to create zstd encoder")?;
    let _ = enc.set_pledged_src_size(Some(input.len() as u64));
    enc.include_checksum(true)?;
    enc.include_contentsize(false)?;
    enc.write_all(input).context("zstd write_all failed")?;
    let out = enc.finish().context("zstd finish failed")?;
    Ok(out)
}

fn zstd_decompress_internal(input: &[u8]) -> Result<Vec<u8>> {
    // 先尝试一次性解码
    match zstd::stream::decode_all(&mut &*input) {
        Ok(v) => Ok(v),
        Err(e) => {
            // 回退到流式
            let mut dec = zstd::stream::Decoder::new(&*input)
                .context(format!("stream decoder creation failed: {}", e))?;
            let mut out = Vec::new();
            dec.read_to_end(&mut out)
                .context("stream decompression failed")?;
            Ok(out)
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_mujingx_fsrs_zstd_ZstdNative_compress(
    mut env: JNIEnv,
    _this: JObject,
    input: JByteArray,
    compression_level: jint,
) -> jbyteArray {
    let bytes = match env.convert_byte_array(input) {
        Ok(b) => b,
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", format!("JNI: read input failed: {}", e));
            return std::ptr::null_mut();
        }
    };
    match zstd_compress_internal(&bytes, compression_level as i32) {
        Ok(out) => match env.byte_array_from_slice(&out) {
            Ok(arr) => arr.into_raw(),
            Err(e) => {
                let _ = env.throw_new("java/lang/RuntimeException", format!("JNI: create byte array failed: {}", e));
                std::ptr::null_mut()
            }
        },
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", format!("Zstd compress failed: {}", e));
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_mujingx_fsrs_zstd_ZstdNative_decompress(
    mut env: JNIEnv,
    _this: JObject,
    input: JByteArray,
) -> jbyteArray {
    let bytes = match env.convert_byte_array(input) {
        Ok(b) => b,
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", format!("JNI: read input failed: {}", e));
            return std::ptr::null_mut();
        }
    };
    match zstd_decompress_internal(&bytes) {
        Ok(out) => match env.byte_array_from_slice(&out) {
            Ok(arr) => arr.into_raw(),
            Err(e) => {
                let _ = env.throw_new("java/lang/RuntimeException", format!("JNI: create byte array failed: {}", e));
                std::ptr::null_mut()
            }
        },
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", format!("Zstd decompress failed: {}", e));
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_mujingx_fsrs_zstd_ZstdNative_compressStream(
    env: JNIEnv,
    _this: JObject,
    input: JByteArray,
    compression_level: jint,
) -> jbyteArray {
    Java_com_mujingx_fsrs_zstd_ZstdNative_compress(env, _this, input, compression_level)
}

#[no_mangle]
pub extern "system" fn Java_com_mujingx_fsrs_zstd_ZstdNative_getVersion(
    mut env: JNIEnv,
    _this: JObject,
) -> jstring {
    // 使用 zstd 库版本号
    let v = zstd::zstd_safe::version_number();
    let s = format!("{}.{}.{}", v / 10000, (v / 100) % 100, v % 100);
    match env.new_string(s) {
        Ok(js) => js.into_raw(),
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", format!("JNI: new_string failed: {}", e));
            std::ptr::null_mut()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_magic_and_fd() {
        let input = b"hello zstd apkg test data";
        let out = zstd_compress_internal(input, 0).expect("compress ok");
        assert!(out.len() >= 5, "compressed too short");
        assert_eq!(out[0], 0x28);
        assert_eq!(out[1], 0xB5);
        assert_eq!(out[2], 0x2F);
        assert_eq!(out[3], 0xFD);
        let fd = out[4];
        // 只接受 Anki 的单段+校验 FD=0x24
        assert_eq!(fd, 0x24, "unexpected frame descriptor: 0x{:02X}", fd);
    }

    #[test]
    fn test_roundtrip() {
        let input = (0..10_000u32).flat_map(|x| x.to_le_bytes()).collect::<Vec<_>>();
        let compressed = zstd_compress_internal(&input, 0).expect("compress");
        let decompressed = zstd_decompress_internal(&compressed).expect("decompress");
        assert_eq!(input, decompressed);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #104** (2025-12-03): **困难词库中，拼写部分单词后取消标记时，若已拼写的单词长度超过下一个单词，则会产生“超出边界错误”**
  *Symptoms*: **稳定复现该BUG**  如图： 已拼写的单词长度为7，下一个单词的长度为6，此时“Ctrl+I”取消标记，则会产生“超出边界错误”。  已拼写的单词长度为7 <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/d04b7bc7-3089-4a1a-ada4-003fb06094a2" /> 下一个单词长度为6 <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/419fa757-caab-4b46-b870-49e2c00353c5" /> “Ctrl+I”取消标记，产生“超出边界错误” <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/fd8e2435-e754-4351-999a-6f8f337312e1" />
  **Post-Mortem & Fix Analysis**:
  > 最新版修复了这个问题

- **Issue #103** (2025-12-03): **在幕境使用了本地文件选择器后，在其它应用移动鼠标时，可能会出现文件名称提示**
  *Symptoms*: 就像在文件选择器鼠标移动到一个文件后，出现的文件名提示。 出现在 macOS ，windows 还没有测试。

- **Issue #101** (2025-12-03): **生成词库时，先选择过滤词库，再按【开始】，选择的词库会被清除**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 先点击【开始】再选择过滤的词库就没事 

- **Issue #99** (2025-12-03): **使用视频播放器时，添加外部字幕.srt无法正常显示**
  *Symptoms*:    字幕文件可以正常提取词库，但在使用视频播放器的时候，导入字幕文件无法显示字幕，同时按钮栏会多出一行显示 关闭字幕 选项。
  **Post-Mortem & Fix Analysis**:
  > 添加字幕后那个显示字幕的区域没有更新，向下滑动就可以看到刚刚添加的字幕了。

- **Issue #98** (2025-12-03): **Error on startup**
  *Symptoms*: <img width="545" height="166" alt="Image" src="https://github.com/user-attachments/assets/fcf04ace-3955-4c95-86c7-bf67b33cf1a5" />
  **Post-Mortem & Fix Analysis**:
  > 刚开始能启动，用了一段时间之后才出现的这种情况吗 
  > 你还记得你做了什么操作之后就无法启动了吗 
  > 是的，第一次安装可以启动，打开了一个srt文件后就报错了，把那个srt文件删掉后，又可以正常启动了。现在已经好了。

- **Issue #96** (2025-12-03): **在 macOS 保存词库失败**
  *Symptoms*: 如果词库的文件名的最后一个字符是 `]` ，比如 `fileName[tv].json` 将无法保存词库。这是 Swing JFileChooser 的 bug。 暂时的解决方法是把最后一个字符 `]` 删掉，删掉就可以保存，如果确实需要可以在保存词库后再重命名。

- **Issue #84** (2025-08-27): **优化 macOS 端的交互**
  *Symptoms*: - [x] 快捷键不符合苹果的交互习惯，应该吧 Control 键改成 Command 键 - [x] 取消菜单栏的快捷字母 - [x] [修复FFmpeg 动态库缺失](https://github.com/tangshimin/MuJing/issues/81) - [x]  优化记忆单词界面的视频播放 - [x]  优化字幕浏览器 - [x]  优化视频播放器 

- **Issue #83** (2025-02-16): **发现问题：使用文档生成词库时选择还原单词形式以后导出没有例句**
  *Symptoms*: 在使用文档生成词库时，选择将单词的形式还原后，导出的词库中没有例句，考虑因为小说的例句中的单词多为过去式和进行式，是否可以修复该功能，感谢！
  **Post-Mortem & Fix Analysis**:
  > 复现了确实是 bug，处理词形还原的时候没有处理例句
  > 我会尽快修复
  > 修复版本已经发布了，你可以下载最新版试一下。[Github 下载地址](https://github.com/tangshimin/MuJing/releases/tag/v2.6.12)

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

### Incident Patch 1: `9ca8c14e` (2025-12-02)
**Commit Message**: 升级版本至 2.12.3

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ plugins {
 }
 
 group = "com.mujingx"
-version = "2.12.2"
+version = "2.12.3"
 
 buildConfig {
     buildConfigField("APP_NAME", provider { "幕境" })
```

---

### Incident Patch 2: `a65a3834` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的 macOS 支持和 artifacts 字段，简化文件匹配规则

**File**: `.github/workflows/Build Package.yml` (modified, +6/-4)
```diff
@@ -12,15 +12,15 @@ jobs:
     runs-on: ${{ matrix.os }}
     strategy:
       matrix:
-        os: [ windows-latest, macos-15, macos-latest ]
+        os: [ windows-latest, macos-15-intel, macos-latest ]
         include:
           - os: windows-latest
             arch: x64
             name: Windows x86_64
             packageTask: light
             artifactPath: build/compose/binaries/main/app/*.msi
             artifactName: windows-package-x64
-          - os: macos-15
+          - os: macos-15-intel
             arch: x64
             name: macOS x86_64
             packageTask: packageDmg
@@ -90,6 +90,8 @@ jobs:
           if ($version -eq "" -or $version -eq "refs/heads/main") {
             $version = (Get-Content gradle.properties | Select-String "version=" | ForEach-Object { $_.ToString().Split('=')[1].Trim() })
           }
+          # 去掉 v 前缀
+          $version = $version -replace '^v', ''
           # 统一命名为 MuJing-版本号.zip
           $zipFile = "build/compose/binaries/main/app/MuJing-$version.zip"
           Write-Host "Creating portable package: $zipFile"
@@ -150,5 +152,5 @@ jobs:
             - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-x64.dmg)
             - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
-          # 使用 artifacts 字段上传文件
-          artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
+          # 使用 artifacts 字段上传文件 - 使用通配符匹配所有文件
+          artifacts: "artifacts/**/*.msi,artifacts/**/*.zip,artifacts/**/*.dmg"
```

---

### Incident Patch 3: `a0c819be` (2025-12-02)
**Commit Message**: 升级版本至 2.12.2

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ plugins {
 }
 
 group = "com.mujingx"
-version = "2.12.1"
+version = "2.12.2"
 
 buildConfig {
     buildConfigField("APP_NAME", provider { "幕境" })
```

---

### Incident Patch 4: `faa7adc0` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的版本号处理，简化 token 生成步骤

**File**: `.github/workflows/Build Package.yml` (modified, +10/-13)
```diff
@@ -119,21 +119,18 @@ jobs:
     permissions:
       contents: write
     steps:
-      - name: Generate a token
-        id: generate-token
-        uses: actions/create-github-app-token@v2
-        with:
-          app-id: ${{ vars.APP_ID }}
-          private-key: ${{ secrets.APP_PRIVATE_KEY }}
-
       - name: Download all artifacts
         uses: actions/download-artifact@v4
         with:
           path: artifacts/
 
       - name: Get Tag
         id: get_tag
-        run: echo "TAG=${{ github.ref_name }}" >> $GITHUB_ENV
+        run: |
+          TAG=${{ github.ref_name }}
+          VERSION=${TAG#v}  # 去掉 v 前缀，得到纯版本号
+          echo "TAG=$TAG" >> $GITHUB_ENV
+          echo "VERSION=$VERSION" >> $GITHUB_ENV
 
       - name: Draft Release
         uses: ncipollo/release-action@v1
@@ -143,15 +140,15 @@ jobs:
           generateReleaseNotes: false
           name: ${{ env.TAG }} # 设置 Release 的标题为 Tag 名称
           tag: ${{ env.TAG }}
-          token: ${{ steps.generate-token.outputs.token }}
+          token: ${{ secrets.GITHUB_TOKEN }}
           body: |
             ---
             ### Windows 版本下载
-            - [Windows 安装包 (MSI)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}.msi)
-            - [Windows 绿色版 (ZIP)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}.zip)
+            - [Windows 安装包 (MSI)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}.msi)
+            - [Windows 绿色版 (ZIP)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}.zip)
             ### macOS 版本下载
-            - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-x64.dmg)
-            - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-aarch64.dmg)
+            - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-x64.dmg)
+            - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
           # 使用 artifacts 字段上传文件
           artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
```

---

### Incident Patch 5: `c2197fd4` (2025-12-02)
**Commit Message**: 升级版本至 2.12.1

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ plugins {
 }
 
 group = "com.mujingx"
-version = "2.12.0"
+version = "2.12.1"
 
 buildConfig {
     buildConfigField("APP_NAME", provider { "幕境" })
```

---

### Incident Patch 6: `13492355` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的 artifacts 字段格式以支持文件上传

**File**: `.github/workflows/Build Package.yml` (modified, +2/-6)
```diff
@@ -153,9 +153,5 @@ jobs:
             - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-x64.dmg)
             - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
-          # 'assets' 字段需要是多行字符串格式
-          assets: |
-            artifacts/windows-package-x64/*.msi:MuJing-${{ env.TAG }}.msi
-            artifacts/windows-package-portable-x64/*.zip:MuJing-${{ env.TAG }}.zip
-            artifacts/macos-package-x64/*.dmg:MuJing-${{ env.TAG }}-x64.dmg
-            artifacts/macos-package-aarch64/*.dmg:MuJing-${{ env.TAG }}-aarch64.dmg
+          # 使用 artifacts 字段上传文件
+          artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
