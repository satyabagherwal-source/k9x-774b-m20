# Forensic Learning Record (Deep Inspection): lysine-dev/okio

> **Canonical Artifact**: `07_PROJECT_LEARNING/lysine-dev-okio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lysine-dev/okio](https://github.com/lysine-dev/okio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:50:01.341Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lysine-dev/okio`
- **Description**: A modern I/O library for Android, Java, and Kotlin Multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9045 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `okio/src/linuxMain/headers/include/uapi/linux/stat.h`
```
/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _UAPI_LINUX_STAT_H
#define _UAPI_LINUX_STAT_H

#include <linux/types.h>

#if defined(__KERNEL__) || !defined(__GLIBC__) || (__GLIBC__ < 2)

#define S_IFMT  00170000
#define S_IFSOCK 0140000
#define S_IFLNK	 0120000
#define S_IFREG  0100000
#define S_IFBLK  0060000
#define S_IFDIR  0040000
#define S_IFCHR  0020000
#define S_IFIFO  0010000
#define S_ISUID  0004000
#define S_ISGID  0002000
#define S_ISVTX  0001000

#define S_ISLNK(m)	(((m) & S_IFMT) == S_IFLNK)
#define S_ISREG(m)	(((m) & S_IFMT) == S_IFREG)
#define S_ISDIR(m)	(((m) & S_IFMT) == S_IFDIR)
#define S_ISCHR(m)	(((m) & S_IFMT) == S_IFCHR)
#define S_ISBLK(m)	(((m) & S_IFMT) == S_IFBLK)
#define S_ISFIFO(m)	(((m) & S_IFMT) == S_IFIFO)
#define S_ISSOCK(m)	(((m) & S_IFMT) == S_IFSOCK)

#define S_IRWXU 00700
#define S_IRUSR 00400
#define S_IWUSR 00200
#define S_IXUSR 00100

#define S_IRWXG 00070
#define S_IRGRP 00040
#define S_IWGRP 00020
#define S_IXGRP 00010

#define S_IRWXO 00007
#define S_IROTH 00004
#define S_IWOTH 00002
#define S_IXOTH 00001

#endif

/*
 * Timestamp structure for the timestamps in struct statx.
 *
 * tv_sec holds the number of seconds before (negative) or after (positive)
 * 00:00:00 1st January 1970 UTC.
 *
 * tv_nsec holds a number of nanoseconds (0..999,999,999) after the tv_sec time.
 *
 * __reserved is held in case we need a yet finer resolution.
 */
struct statx_timestamp {
	__s64	tv_sec;
	__u32	tv_nsec;
	__s32	__reserved;
};

/*
 * Structures for the extended file attribute retrieval system call
 * (statx()).
 *
 * The caller passes a mask of what they're specifically interested in as a
 * parameter to statx().  What statx() actually got will be indicated in
 * st_mask upon return.
 *
 * For each bit in the mask argument:
 *
 * - if the datum is not supported:
 *
 *   - the bit will be cleared, and
 *
 *   - the datum will be set to an appropriate fabricated value if one is
 *     available (eg. CIFS can take a default uid and gid), otherwise
 *
 *   - the field will be cleared;
 *
 * - otherwise, if explicitly requested:
 *
 *   - the datum will be synchronised to the server if AT_STATX_FORCE_SYNC is
 *     set or if the datum is considered out of date, and
 *
 *   - the field will be filled in and the bit will be set;
 *
 * - otherwise, if not requested, but available in approximate form without any
 *   effort, it will be filled in anyway, and the bit will be set upon return
 *   (it might not be up to date, however, and no attempt will be made to
 *   synchronise the internal state first);
 *
 * - otherwise the field and the bit will be cleared before returning.
 *
 * Items in STATX_BASIC_STATS may be marked unavailable on return, but they
 * will have values installed for compatibility purposes so that stat() and
 * co. can be emulated in userspace.
 */
struct statx {
	/* 0x00 */
	/* What results were written [uncond] */
	__u32	stx_mask;

	/* Preferred general I/O size [uncond] */
	__u32	stx_blksize;

	/* Flags conveying information about the file [uncond] */
	__u64	stx_attributes;

	/* 0x10 */
	/* Number of hard links */
	__u32	stx_nlink;

	/* User ID of owner */
	__u32	stx_uid;

	/* Group ID of owner */
	__u32	stx_gid;

	/* File mode */
	__u16	stx_mode;
	__u16	__spare0[1];

	/* 0x20 */
	/* Inode number */
	__u64	stx_ino;

	/* File size */
	__u64	stx_size;

	/* Number of 512-byte blocks allocated */
	__u64	stx_blocks;

	/* Mask to show what's supported in stx_attributes */
	__u64	stx_attributes_mask;

	/* 0x40 */
	/* Last access time */
	struct statx_timestamp	stx_atime;

	/* File creation time */
	struct statx_timestamp	stx_btime;

	/* Last attribute change time */
	struct statx_timestamp	stx_ctime;

	/* Last data modification time */
	struct statx_timestamp	stx_mtime;

	/* 0x80 */
	/* Device ID of special file [if bdev/cdev] */
	__u32	stx_rdev_major;
	__u32	stx_rdev_minor;

	/* ID of device containing file [uncond] */
	__u32	stx_dev_major;
	__u32	stx_dev_minor;

	/* 0x90 */
	__u64	stx_mnt_id;

	/* Memory buffer alignment for direct I/O */
	__u32	stx_dio_mem_align;

	/* File offset alignment for direct I/O */
	__u32	stx_dio_offset_align;

	/* 0xa0 */
	/* Subvolume identifier */
	__u64	stx_subvol;

	/* Min atomic write unit in bytes */
	__u32	stx_atomic_write_unit_min;

	/* Max atomic write unit in bytes */
	__u32	stx_atomic_write_unit_max;

	/* 0xb0 */
	/* Max atomic write segment count */
	__u32   stx_atomic_write_segments_max;

	/* File offset alignment for direct I/O reads */
	__u32	stx_dio_read_offset_align;

	/* Optimised max atomic write unit in bytes */
	__u32	stx_atomic_write_unit_max_opt;
	__u32	__spare2[1];

	/* 0xc0 */
	__u64	__spare3[8];	/* Spare space for future expansion */

	/* 0x100 */
};

/*
 * Flags to be stx_mask
 *
 * Query request/result mask for statx() and struct statx::stx_mask.
 *
 * These bits should be set in the mask argument of statx() to request
 * particular items when calling statx().
 */
#define STATX_TYPE		0x00000001U	/* Want/got stx_mode & S_IFMT */
#define STATX_MODE		0x00000002U	/* Want/got stx_mode & ~S_IFMT */
#define STATX_NLINK		0x00000004U	/* Want/got stx_nlink */
#define STATX_UID		0x00000008U	/* Want/got stx_uid */
#define STATX_GID		0x00000010U	/* Want/got stx_gid */
#define STATX_ATIME		0x00000020U	/* Want/got stx_atime */
#define STATX_MTIME		0x00000040U	/* Want/got stx_mtime */
#define STATX_CTIME		0x00000080U	/* Want/got stx_ctime */
#define STATX_INO		0x00000100U	/* Want/got stx_ino */
#define STATX_SIZE		0x00000200U	/* Want/got stx_size */
#define STATX_BLOCKS		0x00000400U	/* Want/got stx_blocks */
#define STATX_BASIC_STATS	0x000007ffU	/* The stuff in the normal stat struct */
#define STATX_BTIME		0x00000800U	/* Want/got stx_btime */
#define STATX_MNT_ID		0x00001000U	/* Got stx_mnt_id */
#define STATX_DIOALIGN		0x00002000U	/* Want/got direct I/O alignment info */
#define STATX_MNT_ID_UNIQUE	0x00004000U	/* Want/got extended stx_mount_id */
#define STATX_SUBVOL		0x00008000U	/* Want/got stx_subvol */
#define STATX_WRITE_ATOMIC	0x00010000U	/* Want/got atomic_write_* fields */
#define STATX_DIO_READ_ALIGN	0x00020000U	/* Want/got dio read alignment info */

#define STATX__RESERVED		0x80000000U	/* Reserved for future struct statx expansion */

#ifndef __KERNEL__
/*
 * This is deprecated, and shall remain the same value in the future.  To avoid
 * confusion please use the equivalent (STATX_BASIC_STATS | STATX_BTIME)
 * instead.
 */
#define STATX_ALL		0x00000fffU
#endif

/*
 * Attributes to be found in stx_attributes and masked in stx_attributes_mask.
 *
 * These give information about the features or the state of a file that might
 * be of use to ordinary userspace programs such as GUIs or ls rather than
 * specialised tools.
 *
 * Note that the flags marked [I] correspond to the FS_IOC_SETFLAGS flags
 * semantically.  Where possible, the numerical value is picked to correspond
 * also.  Note that the DAX attribute indicates that the file is in the CPU
 * direct access state.  It does not correspond to the per-inode flag that
 * some filesystems support.
 *
 */
#define STATX_ATTR_COMPRESSED		0x00000004 /* [I] File is compressed by the fs */
#define STATX_ATTR_IMMUTABLE		0x00000010 /* [I] File is marked immutable */
#define STATX_ATTR_APPEND		0x00000020 /* [I] File is append-only */
#define STATX_ATTR_NODUMP		0x00000040 /* [I] File is not to be dumped */
#define STATX_ATTR_ENCRYPTED		0x00000800 /* [I] File requires key to decrypt in fs */
#define STATX_ATTR_AUTOMOUNT		0x00001000 /* Dir: Automount trigger */
#define STATX_ATTR_MOUNT_ROOT		0x00002000 /* Root of a mount */
#define STATX_ATTR_VERITY		0x00100000 /* [I] Verity protected file */
#define STATX_ATTR_DAX			0x00200000 /* File is currently in DAX state */
#define STATX_ATTR_WRITE_ATOMIC		0x00400000 /* File supports atomic write operations */


#endif /* _UAPI_LINUX_STAT_H */

```

### Core Architecture Module: `okio/src/linuxMain/headers/okio_statx.h`
```
/*
 * Symbols to call statx() via syscall().
 *
 * Using constant values from Chromium.
 * https://chromium.googlesource.com/chromiumos/docs/+/master/constants/syscalls.md
 */
#ifdef __x86_64__
#define __NR_statx 332
#elif defined(__arm__)
#define __NR_statx 397
#elif defined(__aarch64__)
#define __NR_statx 291
#elif defined(__i386__)
#define __NR_statx 383
#else
#error "unexpected arch for __NR_statx"
#endif

#define AT_FDCWD -100
#define AT_SYMLINK_NOFOLLOW	0x100

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1875** (2026-09-25): **Update dependency com.android.tools.build:gradle to v9.4.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [com.android.tools.build:gradle](http://tools.android.com/) ([source](https://android.googlesource.com/platform/tools/base)) | `9.4.0` → `9.4.1` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.tools.build:gradle/9.4.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.tools.build:gradle/9.4.0/9.4.1?slim=true) |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTIuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExMi4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 

- **Issue #1873** (2026-09-17): **Update actions/setup-java action to v6.0.1**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [actions/setup-java](https://redirect.github.com/actions/setup-java) | action | patch | `v6.0.0` → `v6.0.1` |  ---  ### Release Notes  <details> <summary>actions/setup-java (actions/setup-java)</summary>  ### [`v6.0.1`](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC45NC4wIiwidXBkYXRlZEluVmVyIjoiNDQuOTQuMCIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHMiOltdfQ==--> 

- **Issue #1872** (2026-09-11): **Update BUG-BOUNTY.md**
  *Symptoms*: Removes BUG-BOUNTY.md. The current guidance points to Block's bug bounty program and should be removed from this fork.
  **Post-Mortem & Fix Analysis**:
  > Hey @JakeWharton would you be able to approve once it's ready?

- **Issue #1871** (2026-09-09): **Update dependency org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin to v0.18.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin](https://redirect.github.com/Kotlin/binary-compatibility-validator) | `0.18.1` → `0.18.2` | ![age](https://developer.mend.io/api/mc/badges/age/maven/org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin/0.18.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin/0.18.1/0.18.2?slim=true) |  ---  ### Release Notes  <details> <summary>Kotlin/binary-compatibility-validator (org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin)</summary>  ### [`v0.18.2`](https://redirect.github.com/Kotlin/binary-compatibility-validator/releases/tag/0.18.2)  [Compare Source](https://redirect.github.com/Kotlin/binary-compatibility-validator/compare/0.18.1...0.18.2)  - Prevent configuration crash on hosts unrecognized by Kotlin/Native  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **A

- **Issue #1870** (2026-09-08): **Update dependency com.android.tools.build:gradle to v9.4.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [com.android.tools.build:gradle](http://tools.android.com/) ([source](https://android.googlesource.com/platform/tools/base)) | `9.3.2` → `9.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.tools.build:gradle/9.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.tools.build:gradle/9.3.2/9.4.0?slim=true) |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC42OS4xIiwidXBkYXRlZEluVmVyIjoiNDQuNjkuMSIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHMiOltdfQ==--> 

- **Issue #1869** (2026-09-04): **Fix an unintended behavior change with base64 padding**
  *Symptoms*: I inadvertently changed behavior in 3.18.1.  Closes: https://github.com/lysine-dev/okio/issues/1868

- **Issue #1868** (2026-09-04): **Binary compatibility overload introduced in 3.18.1 for base64() in appleMain changes the previous behavior**
  *Symptoms*: Prior to version 3.18.0, the `base64()` function in appleMain used [commonBase64()](https://github.com/lysine-dev/okio/blob/parent-3.17.0/okio/src/appleMain/kotlin/okio/ByteString.kt#L77) which always applied padding.  As of version 3.18.1, there is a binary-compatibility overload that [defaults the padding to "false"](https://github.com/lysine-dev/okio/blob/parent-3.18.1/okio/src/appleMain/kotlin/okio/ByteString.kt#L82), but that seems like the opposite of the previous behavior.  My issue is that, while I don't use okio directly, it's a dependency of another library I use, [apollo-kotlin](https://github.com/apollographql/apollo-kotlin). Since the default behavior changed, some GraphQL operations no longer work.  I can make do with 3.17.0 for now but is there a reason the compatible overload was defaulted to `false`? 
  **Post-Mortem & Fix Analysis**:
  > Probably just an accident.
  > Want to send a PR?
  > > Want to send a PR?  Sorry, I was too late. :)

- **Issue #1867** (2026-08-31): **Update actions/setup-java action to v6**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [actions/setup-java](https://redirect.github.com/actions/setup-java) | action | major | `v5.7.0` → `v6.0.0` |  ---  ### Release Notes  <details> <summary>actions/setup-java (actions/setup-java)</summary>  ### [`v6.0.0`](https://redirect.github.com/actions/setup-java/compare/v5.7.0...v6.0.0)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v5.7.0...v6.0.0)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC40OS4wIiwidXBkYXRlZEluVmVyIjoiNDQuNDkuMCIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHMiOltdfQ==--> 

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

### Incident Patch 1: `e8dad1a9` (2026-09-11)
**Commit Message**: Update BUG-BOUNTY.md (#1872)

Removes BUG-BOUNTY.md. The current guidance points to Block's bug bounty program and should be removed from this fork.

**File**: `BUG-BOUNTY.md` (modified, +0/-9)
```diff
@@ -1,10 +1 @@
-Serious about security
-======================
-
-Square recognizes the important contributions the security research community
-can make. We therefore encourage reporting security issues with the code
-contained in this repository.
-
-If you believe you have discovered a security vulnerability, please follow the
-guidelines at https://bugcrowd.com/engagements/blockopensource.
 
```

---

### Incident Patch 2: `ebedbaea` (2026-09-04)
**Commit Message**: Fix an unintended behavior change with base64 padding (#1869)

I inadvertently changed behavior in 3.18.1.

Closes: https://github.com/lysine-dev/okio/issues/1868

**File**: `okio/src/appleMain/kotlin/okio/ByteString.kt` (modified, +2/-2)
```diff
@@ -79,12 +79,12 @@ internal actual constructor(
   actual open fun base64(includePadding: Boolean): String = commonBase64(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64(): String = commonBase64(includePadding = false)
+  fun base64(): String = commonBase64(includePadding = true)
 
   actual open fun base64Url(includePadding: Boolean): String = commonBase64Url(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64Url(): String = commonBase64(includePadding = false)
+  fun base64Url(): String = commonBase64(includePadding = true)
 
   actual open fun hex(): String = commonHex()
 
```

**File**: `okio/src/nonAppleMain/kotlin/okio/ByteString.kt` (modified, +2/-2)
```diff
@@ -73,12 +73,12 @@ internal actual constructor(
   actual open fun base64(includePadding: Boolean): String = commonBase64(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64(): String = commonBase64(includePadding = false)
+  fun base64(): String = commonBase64(includePadding = true)
 
   actual open fun base64Url(includePadding: Boolean): String = commonBase64Url(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64Url(): String = commonBase64(includePadding = false)
+  fun base64Url(): String = commonBase64(includePadding = true)
 
   actual open fun hex(): String = commonHex()
 
```

---

### Incident Patch 3: `9d21d5cb` (2026-07-23)
**Commit Message**: Fix interchanged docs links for 1.x and 2.x API (#1835)

**File**: `mkdocs.yml` (modified, +2/-2)
```diff
@@ -74,8 +74,8 @@ nav:
     - 'fakefilesystem': 3.x/okio-fakefilesystem/okio.fakefilesystem/
     - 'nodefilesystem': 3.x/okio-nodefilesystem/okio/
     - 'wasifilesystem': 3.x/okio-wasifilesystem/okio/-wasi-file-system/
-  - '1.x API ⏏': https://lysine.dev/okio/2.x/okio/okio/
-  - '2.x API ⏏': https://lysine.dev/okio/1.x/okio/
+  - '2.x API ⏏': https://lysine.dev/okio/2.x/okio/okio/
+  - '1.x API ⏏': https://lysine.dev/okio/1.x/okio/
   - 'Change Log': changelog.md
   - 'File System': file_system.md
   - 'Multiplatform': multiplatform.md
```

---

### Incident Patch 4: `0ed6b03a` (2026-07-22)
**Commit Message**: Fix dokka build (#1831)

* Fix dokka build

This is breaking website publishing.

* Fix the default to be no dokka

**File**: `.buildscript/prepare_mkdocs.sh` (modified, +2/-1)
```diff
@@ -9,7 +9,8 @@
 set -ex
 
 # Generate the API docs
-./gradlew dokkaHtml
+./gradlew dokkaGeneratePublicationHtml -Dkjs=true -Dkwasm=true -Dokio.build.dokka=true
+mv build/dokka/html docs/3.x
 
 # Copy in special files that GitHub wants in the project root.
 cp CHANGELOG.md docs/changelog.md
```

**File**: `build-support/build.gradle.kts` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ gradlePlugin {
 }
 
 dependencies {
+  implementation(libs.dokka)
   implementation(libs.kotlin.gradle.plugin)
   implementation(libs.tapmoc.gradle.plugin)
 }
```

**File**: `build-support/src/main/kotlin/BuildSupport.kt` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ class BuildSupport : Plugin<Project> {
       sourceCompatibility = JavaVersion.VERSION_1_8.toString()
       targetCompatibility = JavaVersion.VERSION_1_8.toString()
     }
+
+    project.configureDokka()
   }
 }
 
```

**File**: `build-support/src/main/kotlin/dokka.kt` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+/*
+ * Copyright (c) 2026 Okio Authors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import org.gradle.api.Project
+import org.gradle.kotlin.dsl.apply
+import org.gradle.kotlin.dsl.configure
+import org.gradle.kotlin.dsl.dependencies
+import org.gradle.kotlin.dsl.withType
+import org.jetbrains.dokka.gradle.DokkaExtension
+import org.jetbrains.dokka.gradle.DokkaPlugin
+
+val dokkaEnabled = System.getProperty("okio.build.dokka", "false").toBoolean()
+
+fun Project.configureRootDokka() {
+  if (!dokkaEnabled) return
+
+  apply(plugin = "org.jetbrains.dokka")
+
+  dependencies {
+    add("dokka", project(":okio"))
+    add("dokka", project(":okio-assetfilesystem"))
+    add("dokka", project(":okio-fakefilesystem"))
+    add("dokka", project(":okio-nodefilesystem"))
+    add("dokka", project(":okio-wasifilesystem"))
+  }
+}
+
+fun Project.configureDokka() {
+  if (!dokkaEnabled) return
+
+  plugins.withType<DokkaPlugin> {
+    extensions.configure<DokkaExtension> {
+      dokkaPublications.all {
+        dokkaSourceSets.configureEach {
+          reportUndocumented.set(false)
+          skipDeprecated.set(true)
+          perPackageOption {
+            matchingRegex.set("""com[.]squareup[.]okio.*""")
+            suppress.set(true)
+          }
+          perPackageOption {
+            matchingRegex.set(""".*[.]internal([.].*)?""")
+            suppress.set(true)
+          }
+        }
+      }
+    }
+  }
+}
```

**File**: `build.gradle.kts` (modified, +2/-35)
```diff
@@ -8,7 +8,6 @@ import org.gradle.api.tasks.testing.logging.TestLogEvent.FAILED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.PASSED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.SKIPPED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.STARTED
-import org.jetbrains.dokka.gradle.DokkaTask
 import org.jetbrains.kotlin.gradle.targets.js.testing.KotlinJsTest
 import org.jetbrains.kotlin.gradle.targets.jvm.tasks.KotlinJvmTest
 import org.jetbrains.kotlin.gradle.targets.native.tasks.KotlinNativeTest
@@ -53,40 +52,6 @@ allprojects {
     google()
   }
 
-  tasks.withType<DokkaTask>().configureEach {
-    dokkaSourceSets.configureEach {
-      reportUndocumented.set(false)
-      skipDeprecated.set(true)
-      jdkVersion.set(8)
-      perPackageOption {
-        matchingRegex.set("com\\.squareup.okio.*")
-        suppress.set(true)
-      }
-      perPackageOption {
-        matchingRegex.set("okio\\.internal.*")
-        suppress.set(true)
-      }
-    }
-
-    if (name == "dokkaHtml") {
-      outputDirectory.set(file("${rootDir}/docs/3.x/${project.name}"))
-      pluginsMapConfiguration.set(
-        mapOf(
-          "org.jetbrains.dokka.base.DokkaBase" to """
-          {
-            "customStyleSheets": [
-              "${rootDir.toString().replace('\\', '/')}/docs/css/dokka-logo.css"
-            ],
-            "customAssets" : [
-              "${rootDir.toString().replace('\\', '/')}/docs/images/icon-square.png"
-            ]
-          }
-          """.trimIndent()
-        )
-      )
-    }
-  }
-
   plugins.withId("com.vanniktech.maven.publish.base") {
     configure<PublishingExtension> {
       repositories {
@@ -235,3 +200,5 @@ allprojects {
     environment("OKIO_ROOT", rootDir.toString())
   }
 }
+
+configureRootDokka()
```

---

### Incident Patch 5: `90ae6712` (2026-07-21)
**Commit Message**: Fix broken/outdated links (#1827)

Additionally changes links from `http://` to `https://`

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1080,4 +1080,4 @@ _2014-04-08_
 [maven_provided]: https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html
 [preview1]: https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md
 [watchosX86]: https://blog.jetbrains.com/kotlin/2023/02/update-regarding-kotlin-native-targets/
-[xor_utf8]: https://github.com/square/okio/blob/bbb29c459e5ccf0f286e0b17ccdcacd7ac4bc2a9/okio/src/main/kotlin/okio/Utf8.kt#L302
+[xor_utf8]: https://github.com/lysine-dev/okio/blob/bbb29c459e5ccf0f286e0b17ccdcacd7ac4bc2a9/okio/src/main/kotlin/okio/Utf8.kt#L302
```

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -34,5 +34,5 @@ Committer's Guides
  * [Releasing][releasing]
 
  [cla]: https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1
- [releasing]: http://square.github.io/okio/releasing/
- [security]: http://square.github.io/okio/security/
+ [releasing]: https://lysine.dev/okio/releasing/
+ [security]: https://lysine.dev/okio/security/
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -25,5 +25,5 @@ License
     See the License for the specific language governing permissions and
     limitations under the License.
     
- [1]: https://github.com/square/okhttp
- [okio]: https://square.github.io/okio/
+ [1]: https://github.com/lysine-dev/okhttp
+ [okio]: https://lysine.dev/okio/
```

**File**: `android-test/README.md` (modified, +1/-1)
```diff
@@ -47,4 +47,4 @@ if a `run finished` line is printed in the logcat logs:
 ```
 
 
-[okhttp_android_test]: https://github.com/square/okhttp/tree/master/android-test
+[okhttp_android_test]: https://github.com/lysine-dev/okhttp/tree/master/android-test
```

**File**: `build.gradle.kts` (modified, +4/-4)
```diff
@@ -115,7 +115,7 @@ allprojects {
       pom {
         description.set("A modern I/O library for Android, Java, and Kotlin Multiplatform.")
         name.set(project.name)
-        url.set("https://github.com/square/okio/")
+        url.set("https://github.com/lysine-dev/okio/")
         licenses {
           license {
             name.set("The Apache Software License, Version 2.0")
@@ -124,9 +124,9 @@ allprojects {
           }
         }
         scm {
-          url.set("https://github.com/square/okio/")
-          connection.set("scm:git:git://github.com/square/okio.git")
-          developerConnection.set("scm:git:ssh://git@github.com/square/okio.git")
+          url.set("https://github.com/lysine-dev/okio/")
+          connection.set("scm:git:git://github.com/lysine-dev/okio.git")
+          developerConnection.set("scm:git:ssh://git@github.com/lysine-dev/okio.git")
         }
         developers {
           developer {
```

---

### Incident Patch 6: `304f508e` (2026-07-20)
**Commit Message**: Make FixedLengthSource public API (#1823)

* Make FixedLengthSource public API

Closes: https://github.com/lysine-dev/okio/issues/1208

* apiDump

**File**: `okio/api/okio.api` (modified, +3/-0)
```diff
@@ -673,6 +673,9 @@ public final class okio/Okio {
 	public static final fun hashingSource (Lokio/Source;Ljava/security/MessageDigest;)Lokio/HashingSource;
 	public static final fun hashingSource (Lokio/Source;Ljavax/crypto/Mac;)Lokio/HashingSource;
 	public static final fun inMemorySocketPair (J)[Lokio/Socket;
+	public static final fun limit (Lokio/Source;J)Lokio/Source;
+	public static final fun limit (Lokio/Source;JZ)Lokio/Source;
+	public static synthetic fun limit$default (Lokio/Source;JZILjava/lang/Object;)Lokio/Source;
 	public static final fun openZip (Lokio/FileSystem;Lokio/Path;)Lokio/FileSystem;
 	public static final fun sink (Ljava/io/File;)Lokio/Sink;
 	public static final fun sink (Ljava/io/File;Z)Lokio/Sink;
```

**File**: `okio/src/commonMain/kotlin/okio/Okio.kt` (modified, +76/-2)
```diff
@@ -24,16 +24,17 @@ import kotlin.contracts.InvocationKind
 import kotlin.contracts.contract
 import kotlin.jvm.JvmMultifileClass
 import kotlin.jvm.JvmName
+import kotlin.jvm.JvmOverloads
 
 /**
- * Returns a new source that buffers reads from `source`. The returned source will perform bulk
+ * Returns a new source that buffers reads from this. The returned source will perform bulk
  * reads into its in-memory buffer. Use this wherever you read a source to get an ergonomic and
  * efficient access to data.
  */
 fun Source.buffer(): BufferedSource = RealBufferedSource(this)
 
 /**
- * Returns a new sink that buffers writes to `sink`. The returned sink will batch writes to `sink`.
+ * Returns a new sink that buffers writes to this. The returned sink will batch writes to this.
  * Use this wherever you write to a sink to get an ergonomic and efficient access to data.
  */
 fun Sink.buffer(): BufferedSink = RealBufferedSink(this)
@@ -78,3 +79,76 @@ inline fun <T : Closeable?, R> T.use(block: (T) -> R): R {
   @Suppress("UNCHECKED_CAST")
   return result as R
 }
+
+/**
+ * Returns a new source that returns exactly [byteCount] bytes from this.
+ *
+ * Closing the returned source closes this.
+ *
+ * @param throwIfSourceIsLonger true to also throw if this has more than [byteCount] bytes.
+ *   This works by attempting to read more than [byteCount] bytes.
+ *
+ * @throws [EOFException] if this returns fewer than [byteCount] bytes.
+ */
+@JvmOverloads
+fun Source.limit(
+  byteCount: Long,
+  throwIfSourceIsLonger: Boolean = false,
+): Source = LimitSource(this, byteCount, throwIfSourceIsLonger)
+
+private class LimitSource(
+  delegate: Source,
+  private val byteCount: Long,
+  private val throwIfSourceIsLonger: Boolean,
+) : ForwardingSource(delegate) {
+  private var bytesReceived = 0L
+
+  init {
+    require(byteCount >= 0L) { "byteCount < 0: $byteCount" }
+  }
+
+  override fun read(sink: Buffer, byteCount: Long): Long {
+    val remainingByteCount = this.byteCount - bytesReceived
+    val toRead = when {
+      remainingByteCount < 0 -> {
+        throw IOException("expected ${this.byteCount} bytes but got $bytesReceived")
+      }
+
+      throwIfSourceIsLonger -> {
+        // Attempt to read an extra byte, so we can detect if too many bytes are returned.
+        byteCount.coerceAtMost(remainingByteCount + 1)
+      }
+
+      remainingByteCount == 0L -> {
+        return -1L // Already read exactly the promised size.
+      }
+
+      else -> byteCount.coerceAtMost(remainingByteCount)
+    }
+
+    val result = super.read(sink, toRead)
+
+    if (result == -1L) {
+      if (remainingByteCount == 0L) return -1L
+      throw EOFException("expected ${this.byteCount} bytes but got $bytesReceived")
+    }
+
+    bytesReceived += result
+
+    val beyondLimitByteCount = bytesReceived - this.byteCount
+    if (beyondLimitByteCount > 0) {
+      // If we received bytes beyond the limit, don't return them to the caller.
+      sink.truncateToSize(sink.size - beyondLimitByteCount)
+      throw IOException("expected ${this.byteCount} bytes but got $bytesReceived")
+    }
+
+    return result
+  }
+
+  private fun Buffer.truncateToSize(newByteCount: Long) {
+    val scratch = Buffer()
+    scratch.writeAll(this)
+    write(scratch, newByteCount)
+    scratch.clear()
+  }
+}
```

**File**: `okio/src/commonTest/kotlin/okio/LimitSourceTest.kt` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+/*
+ * Copyright (C) 2021 Square, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package okio
+
+import app.cash.burst.Burst
+import assertk.assertThat
+import assertk.assertions.hasMessage
+import assertk.assertions.isEmpty
+import assertk.assertions.isEqualTo
+import kotlin.test.Test
+import kotlin.test.assertFailsWith
+
+@Burst
+internal class LimitSourceTest {
+  @Test
+  fun happyPath(throwIfSourceIsLonger: Boolean) {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(16L, throwIfSourceIsLonger = throwIfSourceIsLonger)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(6L)
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEqualTo("")
+  }
+
+  @Test
+  fun delegateTooLong() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
+    val limitSource = delegate.limit(16L)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(6L)
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEqualTo("")
+  }
+
+  @Test
+  fun delegateTooLongFencepost() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(10L)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEmpty()
+  }
+
+  @Test
+  fun delegateTooLongThrowIfSourceIsLonger() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
+    val limitSource = delegate.limit(16L, throwIfSourceIsLonger = true)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+
+    val e1 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e1).hasMessage("expected 16 bytes but got 17")
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop") // Doesn't produce too many bytes!
+
+    val e2 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e2).hasMessage("expected 16 bytes but got 17")
+    assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
+  }
+
+  @Test
+  fun delegateTooLongThrowIfSourceIsLongerFencepost() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(10L, throwIfSourceIsLonger = true)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+
+    val e1 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e1).hasMessage("expected 10 bytes but got 11")
+    assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce too many bytes!
+
+    val e2 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e2).hasMessage("expected 10 bytes but got 11")
+   
```

**File**: `okio/src/jvmTest/kotlin/okio/FixedLengthSourceTest.kt` (removed, +0/-168)
```diff
@@ -1,168 +0,0 @@
-/*
- * Copyright (C) 2021 Square, Inc.
- *
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *      http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-package okio
-
-import assertk.assertThat
-import assertk.assertions.hasMessage
-import assertk.assertions.isEmpty
-import assertk.assertions.isEqualTo
-import kotlin.test.fail
-import okio.internal.FixedLengthSource
-import org.junit.Test
-
-internal class FixedLengthSourceTest {
-  @Test
-  fun happyPathWithTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun happyPathNoTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = false)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun delegateTooLongWithTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun delegateTooLongWithTruncateFencepost() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 10, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEmpty()
-  }
-
-  @Test
-  fun delegateTooLongNoTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = false)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 16 bytes but got 18")
-      assertThat(buffer.readUtf8()).isEqualTo("klmnop") // Doesn't produce too many bytes!
-    }
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 16 bytes but got 18")
-      assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
-    }
-  }
-
-  @Test
-  f
```

**File**: `okio/src/zlibMain/kotlin/okio/ZipFileSystem.kt` (modified, +3/-4)
```diff
@@ -18,7 +18,6 @@ package okio
 
 import okio.Path.Companion.toPath
 import okio.internal.COMPRESSION_METHOD_STORED
-import okio.internal.FixedLengthSource
 import okio.internal.ZipEntry
 import okio.internal.readLocalHeader
 import okio.internal.skipLocalHeader
@@ -103,14 +102,14 @@ internal class ZipFileSystem internal constructor(
 
     return when (entry.compressionMethod) {
       COMPRESSION_METHOD_STORED -> {
-        FixedLengthSource(source, entry.size, truncate = true)
+        source.limit(entry.size)
       }
       else -> {
         val inflaterSource = InflaterSource(
-          FixedLengthSource(source, entry.compressedSize, truncate = true),
+          source.limit(entry.compressedSize),
           Inflater(true),
         )
-        FixedLengthSource(inflaterSource, entry.size, truncate = false)
+        inflaterSource.limit(entry.size, throwIfSourceIsLonger = true)
       }
     }
   }
```

---

### Incident Patch 7: `b11f17b2` (2026-03-07)
**Commit Message**: Remove Kotlin/JS IR default parameter workarounds. (#1786)

**File**: `okio/src/commonMain/kotlin/okio/Buffer.kt` (modified, +2/-2)
```diff
@@ -103,9 +103,9 @@ expect class Buffer() : BufferedSource, BufferedSink {
   /** Returns an immutable copy of the first `byteCount` bytes of this buffer as a byte string. */
   fun snapshot(byteCount: Int): ByteString
 
-  fun readUnsafe(unsafeCursor: UnsafeCursor = DEFAULT__new_UnsafeCursor): UnsafeCursor
+  fun readUnsafe(unsafeCursor: UnsafeCursor = UnsafeCursor()): UnsafeCursor
 
-  fun readAndWriteUnsafe(unsafeCursor: UnsafeCursor = DEFAULT__new_UnsafeCursor): UnsafeCursor
+  fun readAndWriteUnsafe(unsafeCursor: UnsafeCursor = UnsafeCursor()): UnsafeCursor
 
   override val buffer: Buffer
   override fun close()
```

**File**: `okio/src/commonMain/kotlin/okio/ByteString.kt` (modified, +4/-4)
```diff
@@ -97,7 +97,7 @@ internal constructor(data: ByteArray) : Comparable<ByteString> {
    * `beginIndex` and ends at the specified `endIndex`. Returns this byte string if `beginIndex` is
    * 0 and `endIndex` is the length of this byte string.
    */
-  fun substring(beginIndex: Int = 0, endIndex: Int = DEFAULT__ByteString_size): ByteString
+  fun substring(beginIndex: Int = 0, endIndex: Int = size): ByteString
 
   /**
    * Returns a byte string equal to this byte string, but with the bytes 'a' through 'z' replaced
@@ -164,9 +164,9 @@ internal constructor(data: ByteArray) : Comparable<ByteString> {
   @JvmOverloads
   fun indexOf(other: ByteArray, fromIndex: Int = 0): Int
 
-  fun lastIndexOf(other: ByteString, fromIndex: Int = DEFAULT__ByteString_size): Int
+  fun lastIndexOf(other: ByteString, fromIndex: Int = size): Int
 
-  fun lastIndexOf(other: ByteArray, fromIndex: Int = DEFAULT__ByteString_size): Int
+  fun lastIndexOf(other: ByteArray, fromIndex: Int = size): Int
 
   override fun equals(other: Any?): Boolean
 
@@ -193,7 +193,7 @@ internal constructor(data: ByteArray) : Comparable<ByteString> {
      * starting at `offset`.
      */
     @JvmStatic
-    fun ByteArray.toByteString(offset: Int = 0, byteCount: Int = DEFAULT__ByteString_size): ByteString
+    fun ByteArray.toByteString(offset: Int = 0, byteCount: Int = size): ByteString
 
     /** Returns a new byte string containing the `UTF-8` bytes of this [String]. */
     @JvmStatic
```

**File**: `okio/src/commonMain/kotlin/okio/Util.kt` (modified, +0/-22)
```diff
@@ -162,25 +162,3 @@ internal fun Long.toHexString(): String {
 
   return result.concatToString(i, result.size)
 }
-
-// Work around a problem where Kotlin/JS IR can't handle default parameters on expect functions
-// that depend on the receiver. We use well-known, otherwise-impossible values here and must check
-// for them in the receiving function, then swap in the true default value.
-// https://youtrack.jetbrains.com/issue/KT-45542
-
-internal val DEFAULT__new_UnsafeCursor = Buffer.UnsafeCursor()
-internal fun resolveDefaultParameter(unsafeCursor: Buffer.UnsafeCursor): Buffer.UnsafeCursor {
-  if (unsafeCursor === DEFAULT__new_UnsafeCursor) return Buffer.UnsafeCursor()
-  return unsafeCursor
-}
-
-internal val DEFAULT__ByteString_size = -1234567890
-internal fun ByteString.resolveDefaultParameter(position: Int): Int {
-  if (position == DEFAULT__ByteString_size) return size
-  return position
-}
-
-internal fun ByteArray.resolveDefaultParameter(sizeParam: Int): Int {
-  if (sizeParam == DEFAULT__ByteString_size) return size
-  return sizeParam
-}
```

**File**: `okio/src/commonMain/kotlin/okio/internal/Buffer.kt` (modified, +0/-3)
```diff
@@ -37,7 +37,6 @@ import okio.and
 import okio.asUtf8ToByteArray
 import okio.checkOffsetAndCount
 import okio.minOf
-import okio.resolveDefaultParameter
 import okio.toHexString
 
 internal val HEX_DIGIT_BYTES = "0123456789abcdef".asUtf8ToByteArray()
@@ -1528,7 +1527,6 @@ internal inline fun Buffer.commonSnapshot(byteCount: Int): ByteString {
 }
 
 internal fun Buffer.commonReadUnsafe(unsafeCursor: UnsafeCursor): UnsafeCursor {
-  val unsafeCursor = resolveDefaultParameter(unsafeCursor)
   check(unsafeCursor.buffer == null) { "already attached to a buffer" }
 
   unsafeCursor.buffer = this
@@ -1537,7 +1535,6 @@ internal fun Buffer.commonReadUnsafe(unsafeCursor: UnsafeCursor): UnsafeCursor {
 }
 
 internal fun Buffer.commonReadAndWriteUnsafe(unsafeCursor: UnsafeCursor): UnsafeCursor {
-  val unsafeCursor = resolveDefaultParameter(unsafeCursor)
   check(unsafeCursor.buffer == null) { "already attached to a buffer" }
 
   unsafeCursor.buffer = this
```

**File**: `okio/src/commonMain/kotlin/okio/internal/ByteString.kt` (modified, +0/-4)
```diff
@@ -30,7 +30,6 @@ import okio.decodeBase64ToArray
 import okio.encodeBase64
 import okio.isIsoControl
 import okio.processUtf8CodePoints
-import okio.resolveDefaultParameter
 import okio.shr
 import okio.toUtf8String
 
@@ -126,7 +125,6 @@ internal inline fun ByteString.commonToAsciiUppercase(): ByteString {
 
 @Suppress("NOTHING_TO_INLINE")
 internal inline fun ByteString.commonSubstring(beginIndex: Int, endIndex: Int): ByteString {
-  val endIndex = resolveDefaultParameter(endIndex)
   require(beginIndex >= 0) { "beginIndex < 0" }
   require(endIndex <= data.size) { "endIndex > length(${data.size})" }
 
@@ -218,7 +216,6 @@ internal inline fun ByteString.commonLastIndexOf(
 
 @Suppress("NOTHING_TO_INLINE")
 internal inline fun ByteString.commonLastIndexOf(other: ByteArray, fromIndex: Int): Int {
-  val fromIndex = resolveDefaultParameter(fromIndex)
   val limit = data.size - other.size
   for (i in minOf(fromIndex, limit) downTo 0) {
     if (arrayRangeEquals(data, i, other, 0, other.size)) {
@@ -270,7 +267,6 @@ internal inline fun commonOf(data: ByteArray) = ByteString(data.copyOf())
 
 @Suppress("NOTHING_TO_INLINE")
 internal inline fun ByteArray.commonToByteString(offset: Int, byteCount: Int): ByteString {
-  val byteCount = resolveDefaultParameter(byteCount)
   checkOffsetAndCount(size.toLong(), offset.toLong(), byteCount.toLong())
   return ByteString(copyOfRange(offset, offset + byteCount))
 }
```

---

### Incident Patch 8: `79aa2675` (2026-02-10)
**Commit Message**: Drop `isWasm()` early return workaround for KT-60212. (#1777)

**File**: `okio-testing-support/src/commonMain/kotlin/okio/TestingCommon.kt` (modified, +0/-2)
```diff
@@ -40,8 +40,6 @@ fun randomToken(length: Int) = Random.nextBytes(length).toByteString(0, length).
 
 expect fun isBrowser(): Boolean
 
-expect fun isWasm(): Boolean
-
 val FileMetadata.createdAt: Instant?
   get() {
     val createdAt = createdAtMillis ?: return null
```

**File**: `okio-testing-support/src/jsMain/kotlin/okio/TestingJs.kt` (modified, +0/-2)
```diff
@@ -19,7 +19,5 @@ actual fun isBrowser(): Boolean {
   return js("""(globalThis.window || null)""") != null
 }
 
-actual fun isWasm() = false
-
 actual fun getEnv(name: String): String? =
   js("globalThis.process.env[name]") as String?
```

**File**: `okio-testing-support/src/jvmMain/kotlin/okio/TestingJvm.kt` (modified, +0/-2)
```diff
@@ -17,6 +17,4 @@ package okio
 
 actual fun isBrowser() = false
 
-actual fun isWasm() = false
-
 actual fun getEnv(name: String): String? = System.getenv(name)
```

**File**: `okio-testing-support/src/nativeMain/kotlin/okio/TestingNative.kt` (modified, +0/-2)
```diff
@@ -21,7 +21,5 @@ import platform.posix.getenv
 
 actual fun isBrowser() = false
 
-actual fun isWasm() = false
-
 @OptIn(ExperimentalForeignApi::class)
 actual fun getEnv(name: String): String? = getenv(name)?.toKString()
```

**File**: `okio-testing-support/src/wasmMain/kotlin/okio/TestingWasm.kt` (modified, +0/-2)
```diff
@@ -21,8 +21,6 @@ import kotlin.time.ExperimentalTime
 
 actual fun isBrowser() = false
 
-actual fun isWasm() = true
-
 actual val FileSystem.isFakeFileSystem: Boolean
   get() = false
 
```

---

### Incident Patch 9: `45459dca` (2026-02-09)
**Commit Message**: Fix result of an 'errnoToIOException' call is not thrown. inside `PosixFileSystem.createDirectory`. (#1774)

**File**: `okio/src/nativeMain/kotlin/okio/PosixFileSystem.kt` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ internal object PosixFileSystem : FileSystem() {
     if (result != 0) {
       if (errno == EEXIST) {
         if (mustCreate) {
-          errnoToIOException(errno)
+          throw errnoToIOException(errno)
         } else {
           return
         }
```

#### Recent Merged Pull Requests:
- **PR #1875** (2026-09-25): Update dependency com.android.tools.build:gradle to v9.4.1 (@renovate[bot])
- **PR #1873** (2026-09-17): Update actions/setup-java action to v6.0.1 (@renovate[bot])
- **PR #1872** (2026-09-11): Update BUG-BOUNTY.md (@npflores)
- **PR #1871** (2026-09-09): Update dependency org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin to v0.18.2 (@renovate[bot])
- **PR #1870** (2026-09-08): Update dependency com.android.tools.build:gradle to v9.4.0 (@renovate[bot])
- **PR #1869** (2026-09-04): Fix an unintended behavior change with base64 padding (@swankjesse)
- **PR #1867** (2026-08-31): Update actions/setup-java action to v6 (@renovate[bot])
- **PR #1866** (2026-08-31): Update dependency com.android.tools.build:gradle to v9.3.2 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
