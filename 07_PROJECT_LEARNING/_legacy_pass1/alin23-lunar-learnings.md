# Forensic Learning Record (Deep Inspection): alin23/Lunar

> **Canonical Artifact**: `07_PROJECT_LEARNING/alin23-lunar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alin23/Lunar](https://github.com/alin23/Lunar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:42:09.129Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alin23/Lunar`
- **Description**: Intelligent adaptive brightness for your external monitors
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5707 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Lunar/CSSH/libssh2/libssh2.h`
```
/* Copyright (c) 2004-2009, Sara Golemon <sarag@libssh2.org>
 * Copyright (c) 2009-2015 Daniel Stenberg
 * Copyright (c) 2010 Simon Josefsson <simon@josefsson.org>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms,
 * with or without modification, are permitted provided
 * that the following conditions are met:
 *
 *   Redistributions of source code must retain the above
 *   copyright notice, this list of conditions and the
 *   following disclaimer.
 *
 *   Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following
 *   disclaimer in the documentation and/or other materials
 *   provided with the distribution.
 *
 *   Neither the name of the copyright holder nor the names
 *   of any other contributors may be used to endorse or
 *   promote products derived from this software without
 *   specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
 * CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
 * USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
 * OF SUCH DAMAGE.
 */

#ifndef LIBSSH2_H
#define LIBSSH2_H 1

#define LIBSSH2_COPYRIGHT "2004-2019 The libssh2 project and its contributors."

/* We use underscore instead of dash when appending DEV in dev versions just
   to make the BANNER define (used by src/session.c) be a valid SSH
   banner. Release versions have no appended strings and may of course not
   have dashes either. */
#define LIBSSH2_VERSION "1.9.0"

/* The numeric version number is also available "in parts" by using these
   defines: */
#define LIBSSH2_VERSION_MAJOR 1
#define LIBSSH2_VERSION_MINOR 9
#define LIBSSH2_VERSION_PATCH 0

/* This is the numeric version of the libssh2 version number, meant for easier
   parsing and comparions by programs. The LIBSSH2_VERSION_NUM define will
   always follow this syntax:

         0xXXYYZZ

   Where XX, YY and ZZ are the main version, release and patch numbers in
   hexadecimal (using 8 bits each). All three numbers are always represented
   using two digits.  1.2 would appear as "0x010200" while version 9.11.7
   appears as "0x090b07".

   This 6-digit (24 bits) hexadecimal number does not show pre-release number,
   and it is always a greater number in a more recent release. It makes
   comparisons with greater than and less than work.
*/
#define LIBSSH2_VERSION_NUM 0x010900

/*
 * This is the date and time when the full source package was created. The
 * timestamp is not stored in the source code repo, as the timestamp is
 * properly set in the tarballs by the maketgz script.
 *
 * The format of the date should follow this template:
 *
 * "Mon Feb 12 11:35:33 UTC 2007"
 */
#define LIBSSH2_TIMESTAMP "Thu Jun 20 06:19:26 UTC 2019"

#ifndef RC_INVOKED

#ifdef __cplusplus
extern "C" {
#endif
#ifdef _WIN32
# include <basetsd.h>
# include <winsock2.h>
#endif

#include <stddef.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>

/* Allow alternate API prefix from CFLAGS or calling app */
#ifndef LIBSSH2_API
# ifdef LIBSSH2_WIN32
#  ifdef _WINDLL
#   ifdef LIBSSH2_LIBRARY
#    define LIBSSH2_API __declspec(dllexport)
#   else
#    define LIBSSH2_API __declspec(dllimport)
#   endif /* LIBSSH2_LIBRARY */
#  else
#   define LIBSSH2_API
#  endif
# else /* !LIBSSH2_WIN32 */
#  define LIBSSH2_API
# endif /* LIBSSH2_WIN32 */
#endif /* LIBSSH2_API */

#ifdef HAVE_SYS_UIO_H
# include <sys/uio.h>
#endif

#if (defined(NETWARE) && !defined(__NOVELL_LIBC__))
# include <sys/bsdskt.h>
typedef unsigned char uint8_t;
typedef unsigned short int uint16_t;
typedef unsigned int uint32_t;
typedef int int32_t;
typedef unsigned long long uint64_t;
typedef long long int64_t;
#endif

#ifdef _MSC_VER
typedef unsigned char uint8_t;
typedef unsigned short int uint16_t;
typedef unsigned int uint32_t;
typedef __int32 int32_t;
typedef __int64 int64_t;
typedef unsigned __int64 uint64_t;
typedef unsigned __int64 libssh2_uint64_t;
typedef __int64 libssh2_int64_t;
#if (!defined(HAVE_SSIZE_T) && !defined(ssize_t))
typedef SSIZE_T ssize_t;
#define HAVE_SSIZE_T
#endif
#else
#include <stdint.h>
typedef unsigned long long libssh2_uint64_t;
typedef long long libssh2_int64_t;
#endif

#ifdef WIN32
typedef SOCKET libssh2_socket_t;
#define LIBSSH2_INVALID_SOCKET INVALID_SOCKET
#else /* !WIN32 */
typedef int libssh2_socket_t;
#define LIBSSH2_INVALID_SOCKET -1
#endif /* WIN32 */

/*
 * Determine whether there is small or large file support on windows.
 */

#if defined(_MSC_VER) && !defined(_WIN32_WCE)
#  if (_MSC_VER >= 900) && (_INTEGRAL_MAX_BITS >= 64)
#    define LIBSSH2_USE_WIN32_LARGE_FILES
#  else
#    define LIBSSH2_USE_WIN32_SMALL_FILES
#  endif
#endif

#if defined(__MINGW32__) && !defined(LIBSSH2_USE_WIN32_LARGE_FILES)
#  define LIBSSH2_USE_WIN32_LARGE_FILES
#endif

#if defined(__WATCOMC__) && !defined(LIBSSH2_USE_WIN32_LARGE_FILES)
#  define LIBSSH2_USE_WIN32_LARGE_FILES
#endif

#if defined(__POCC__)
#  undef LIBSSH2_USE_WIN32_LARGE_FILES
#endif

#if defined(_WIN32) && !defined(LIBSSH2_USE_WIN32_LARGE_FILES) && \
    !defined(LIBSSH2_USE_WIN32_SMALL_FILES)
#  define LIBSSH2_USE_WIN32_SMALL_FILES
#endif

/*
 * Large file (>2Gb) support using WIN32 functions.
 */

#ifdef LIBSSH2_USE_WIN32_LARGE_FILES
#  include <io.h>
#  include <sys/types.h>
#  include <sys/stat.h>
#  define LIBSSH2_STRUCT_STAT_SIZE_FORMAT    "%I64d"
typedef struct _stati64 libssh2_struct_stat;
typedef __int64 libssh2_struct_stat_size;
#endif

/*
 * Small file (<2Gb) support using WIN32 functions.
 */

#ifdef LIBSSH2_USE_WIN32_SMALL_FILES
#  include <sys/types.h>
#  include <sys/stat.h>
#  ifndef _WIN32_WCE
#    define LIBSSH2_STRUCT_STAT_SIZE_FORMAT    "%d"
typedef struct _stat libssh2_struct_stat;
typedef off_t libssh2_struct_stat_size;
#  endif
#endif

#ifndef LIBSSH2_STRUCT_STAT_SIZE_FORMAT
#  ifdef __VMS
/* We have to roll our own format here because %z is a C99-ism we don't
   have. */
#    if __USE_OFF64_T || __USING_STD_STAT
#      define LIBSSH2_STRUCT_STAT_SIZE_FORMAT      "%Ld"
#    else
#      define LIBSSH2_STRUCT_STAT_SIZE_FORMAT      "%d"
#    endif
#  else
#    define LIBSSH2_STRUCT_STAT_SIZE_FORMAT      "%zd"
#  endif
typedef struct stat libssh2_struct_stat;
typedef off_t libssh2_struct_stat_size;
#endif

/* Part of every banner, user specified or not */
#define LIBSSH2_SSH_BANNER                  "SSH-2.0-libssh2_" LIBSSH2_VERSION

#define LIBSSH2_SSH_DEFAULT_BANNER            LIBSSH2_SSH_BANNER
#define LIBSSH2_SSH_DEFAULT_BANNER_WITH_CRLF  LIBSSH2_SSH_DEFAULT_BANNER "\r\n"

/* Default generate and safe prime sizes for
   diffie-hellman-group-exchange-sha1 */
#define LIBSSH2_DH_GEX_MINGROUP     1024
#define LIBSSH2_DH_GEX_OPTGROUP     1536
#define LIBSSH2_DH_GEX_MAXGROUP     2048

/* Defaults for pty requests */
#define LIBSSH2_TERM_WIDTH      80
#define LIBSSH2_TERM_HEIGHT     24
#define LIBSSH2_TERM_WIDTH_PX   0
#define LIBSSH2_TERM_HEIGHT_PX  0

/* 1/4 second */
#define LIBSSH2_SOCKET_POLL_UDELAY      250000
/* 0.25 * 120 == 30 seconds */
#define LIBSSH2_SOCKET_POLL_MAXLOOPS    120

/* Maximum size to allow a payload to compress to, plays it safe by falling
   short of spec limits */
#define LIBSSH2_PACKET_MAXCOMP      32000

/* Maximum size to allow a payload to deccompress to, plays it safe by
   allowing more than spec requires */
#define LIBSSH2_PACKET_MAXDECOMP    40000

/* Maximum size for an in
```

### Core Architecture Module: `Lunar/CSSH/libssh2/libssh2_publickey.h`
```
/* Copyright (c) 2004-2006, Sara Golemon <sarag@libssh2.org>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms,
 * with or without modification, are permitted provided
 * that the following conditions are met:
 *
 *   Redistributions of source code must retain the above
 *   copyright notice, this list of conditions and the
 *   following disclaimer.
 *
 *   Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following
 *   disclaimer in the documentation and/or other materials
 *   provided with the distribution.
 *
 *   Neither the name of the copyright holder nor the names
 *   of any other contributors may be used to endorse or
 *   promote products derived from this software without
 *   specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
 * CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
 * USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
 * OF SUCH DAMAGE.
 */

/* Note: This include file is only needed for using the
 * publickey SUBSYSTEM which is not the same as publickey
 * authentication.  For authentication you only need libssh2.h
 *
 * For more information on the publickey subsystem,
 * refer to IETF draft: secsh-publickey
 */

#ifndef LIBSSH2_PUBLICKEY_H
#define LIBSSH2_PUBLICKEY_H 1

#include "libssh2.h"

typedef struct _LIBSSH2_PUBLICKEY               LIBSSH2_PUBLICKEY;

typedef struct _libssh2_publickey_attribute {
    const char *name;
    unsigned long name_len;
    const char *value;
    unsigned long value_len;
    char mandatory;
} libssh2_publickey_attribute;

typedef struct _libssh2_publickey_list {
    unsigned char *packet; /* For freeing */

    const unsigned char *name;
    unsigned long name_len;
    const unsigned char *blob;
    unsigned long blob_len;
    unsigned long num_attrs;
    libssh2_publickey_attribute *attrs; /* free me */
} libssh2_publickey_list;

/* Generally use the first macro here, but if both name and value are string
   literals, you can use _fast() to take advantage of preprocessing */
#define libssh2_publickey_attribute(name, value, mandatory) \
  { (name), strlen(name), (value), strlen(value), (mandatory) },
#define libssh2_publickey_attribute_fast(name, value, mandatory) \
  { (name), sizeof(name) - 1, (value), sizeof(value) - 1, (mandatory) },

#ifdef __cplusplus
extern "C" {
#endif

/* Publickey Subsystem */
LIBSSH2_API LIBSSH2_PUBLICKEY *
libssh2_publickey_init(LIBSSH2_SESSION *session);

LIBSSH2_API int
libssh2_publickey_add_ex(LIBSSH2_PUBLICKEY *pkey,
                         const unsigned char *name,
                         unsigned long name_len,
                         const unsigned char *blob,
                         unsigned long blob_len, char overwrite,
                         unsigned long num_attrs,
                         const libssh2_publickey_attribute attrs[]);
#define libssh2_publickey_add(pkey, name, blob, blob_len, overwrite,    \
                              num_attrs, attrs)                         \
  libssh2_publickey_add_ex((pkey), (name), strlen(name), (blob), (blob_len), \
                           (overwrite), (num_attrs), (attrs))

LIBSSH2_API int libssh2_publickey_remove_ex(LIBSSH2_PUBLICKEY *pkey,
                                            const unsigned char *name,
                                            unsigned long name_len,
                                            const unsigned char *blob,
                                            unsigned long blob_len);
#define libssh2_publickey_remove(pkey, name, blob, blob_len) \
  libssh2_publickey_remove_ex((pkey), (name), strlen(name), (blob), (blob_len))

LIBSSH2_API int
libssh2_publickey_list_fetch(LIBSSH2_PUBLICKEY *pkey,
                             unsigned long *num_keys,
                             libssh2_publickey_list **pkey_list);
LIBSSH2_API void
libssh2_publickey_list_free(LIBSSH2_PUBLICKEY *pkey,
                            libssh2_publickey_list *pkey_list);

LIBSSH2_API int libssh2_publickey_shutdown(LIBSSH2_PUBLICKEY *pkey);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* ifndef: LIBSSH2_PUBLICKEY_H */

```

### Core Architecture Module: `Lunar/CSSH/libssh2/libssh2_sftp.h`
```
/* Copyright (c) 2004-2008, Sara Golemon <sarag@libssh2.org>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms,
 * with or without modification, are permitted provided
 * that the following conditions are met:
 *
 *   Redistributions of source code must retain the above
 *   copyright notice, this list of conditions and the
 *   following disclaimer.
 *
 *   Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following
 *   disclaimer in the documentation and/or other materials
 *   provided with the distribution.
 *
 *   Neither the name of the copyright holder nor the names
 *   of any other contributors may be used to endorse or
 *   promote products derived from this software without
 *   specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
 * CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
 * USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
 * OF SUCH DAMAGE.
 */

#ifndef LIBSSH2_SFTP_H
#define LIBSSH2_SFTP_H 1

#include "libssh2.h"

#ifndef WIN32
#include <unistd.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* Note: Version 6 was documented at the time of writing
 * However it was marked as "DO NOT IMPLEMENT" due to pending changes
 *
 * Let's start with Version 3 (The version found in OpenSSH) and go from there
 */
#define LIBSSH2_SFTP_VERSION        3

typedef struct _LIBSSH2_SFTP                LIBSSH2_SFTP;
typedef struct _LIBSSH2_SFTP_HANDLE         LIBSSH2_SFTP_HANDLE;
typedef struct _LIBSSH2_SFTP_ATTRIBUTES     LIBSSH2_SFTP_ATTRIBUTES;
typedef struct _LIBSSH2_SFTP_STATVFS        LIBSSH2_SFTP_STATVFS;

/* Flags for open_ex() */
#define LIBSSH2_SFTP_OPENFILE           0
#define LIBSSH2_SFTP_OPENDIR            1

/* Flags for rename_ex() */
#define LIBSSH2_SFTP_RENAME_OVERWRITE   0x00000001
#define LIBSSH2_SFTP_RENAME_ATOMIC      0x00000002
#define LIBSSH2_SFTP_RENAME_NATIVE      0x00000004

/* Flags for stat_ex() */
#define LIBSSH2_SFTP_STAT               0
#define LIBSSH2_SFTP_LSTAT              1
#define LIBSSH2_SFTP_SETSTAT            2

/* Flags for symlink_ex() */
#define LIBSSH2_SFTP_SYMLINK            0
#define LIBSSH2_SFTP_READLINK           1
#define LIBSSH2_SFTP_REALPATH           2

/* Flags for sftp_mkdir() */
#define LIBSSH2_SFTP_DEFAULT_MODE      -1

/* SFTP attribute flag bits */
#define LIBSSH2_SFTP_ATTR_SIZE              0x00000001
#define LIBSSH2_SFTP_ATTR_UIDGID            0x00000002
#define LIBSSH2_SFTP_ATTR_PERMISSIONS       0x00000004
#define LIBSSH2_SFTP_ATTR_ACMODTIME         0x00000008
#define LIBSSH2_SFTP_ATTR_EXTENDED          0x80000000

/* SFTP statvfs flag bits */
#define LIBSSH2_SFTP_ST_RDONLY              0x00000001
#define LIBSSH2_SFTP_ST_NOSUID              0x00000002

struct _LIBSSH2_SFTP_ATTRIBUTES {
    /* If flags & ATTR_* bit is set, then the value in this struct will be
     * meaningful Otherwise it should be ignored
     */
    unsigned long flags;

    libssh2_uint64_t filesize;
    unsigned long uid, gid;
    unsigned long permissions;
    unsigned long atime, mtime;
};

struct _LIBSSH2_SFTP_STATVFS {
    libssh2_uint64_t  f_bsize;    /* file system block size */
    libssh2_uint64_t  f_frsize;   /* fragment size */
    libssh2_uint64_t  f_blocks;   /* size of fs in f_frsize units */
    libssh2_uint64_t  f_bfree;    /* # free blocks */
    libssh2_uint64_t  f_bavail;   /* # free blocks for non-root */
    libssh2_uint64_t  f_files;    /* # inodes */
    libssh2_uint64_t  f_ffree;    /* # free inodes */
    libssh2_uint64_t  f_favail;   /* # free inodes for non-root */
    libssh2_uint64_t  f_fsid;     /* file system ID */
    libssh2_uint64_t  f_flag;     /* mount flags */
    libssh2_uint64_t  f_namemax;  /* maximum filename length */
};

/* SFTP filetypes */
#define LIBSSH2_SFTP_TYPE_REGULAR           1
#define LIBSSH2_SFTP_TYPE_DIRECTORY         2
#define LIBSSH2_SFTP_TYPE_SYMLINK           3
#define LIBSSH2_SFTP_TYPE_SPECIAL           4
#define LIBSSH2_SFTP_TYPE_UNKNOWN           5
#define LIBSSH2_SFTP_TYPE_SOCKET            6
#define LIBSSH2_SFTP_TYPE_CHAR_DEVICE       7
#define LIBSSH2_SFTP_TYPE_BLOCK_DEVICE      8
#define LIBSSH2_SFTP_TYPE_FIFO              9

/*
 * Reproduce the POSIX file modes here for systems that are not POSIX
 * compliant.
 *
 * These is used in "permissions" of "struct _LIBSSH2_SFTP_ATTRIBUTES"
 */
/* File type */
#define LIBSSH2_SFTP_S_IFMT         0170000     /* type of file mask */
#define LIBSSH2_SFTP_S_IFIFO        0010000     /* named pipe (fifo) */
#define LIBSSH2_SFTP_S_IFCHR        0020000     /* character special */
#define LIBSSH2_SFTP_S_IFDIR        0040000     /* directory */
#define LIBSSH2_SFTP_S_IFBLK        0060000     /* block special */
#define LIBSSH2_SFTP_S_IFREG        0100000     /* regular */
#define LIBSSH2_SFTP_S_IFLNK        0120000     /* symbolic link */
#define LIBSSH2_SFTP_S_IFSOCK       0140000     /* socket */

/* File mode */
/* Read, write, execute/search by owner */
#define LIBSSH2_SFTP_S_IRWXU        0000700     /* RWX mask for owner */
#define LIBSSH2_SFTP_S_IRUSR        0000400     /* R for owner */
#define LIBSSH2_SFTP_S_IWUSR        0000200     /* W for owner */
#define LIBSSH2_SFTP_S_IXUSR        0000100     /* X for owner */
/* Read, write, execute/search by group */
#define LIBSSH2_SFTP_S_IRWXG        0000070     /* RWX mask for group */
#define LIBSSH2_SFTP_S_IRGRP        0000040     /* R for group */
#define LIBSSH2_SFTP_S_IWGRP        0000020     /* W for group */
#define LIBSSH2_SFTP_S_IXGRP        0000010     /* X for group */
/* Read, write, execute/search by others */
#define LIBSSH2_SFTP_S_IRWXO        0000007     /* RWX mask for other */
#define LIBSSH2_SFTP_S_IROTH        0000004     /* R for other */
#define LIBSSH2_SFTP_S_IWOTH        0000002     /* W for other */
#define LIBSSH2_SFTP_S_IXOTH        0000001     /* X for other */

/* macros to check for specific file types, added in 1.2.5 */
#define LIBSSH2_SFTP_S_ISLNK(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFLNK)
#define LIBSSH2_SFTP_S_ISREG(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFREG)
#define LIBSSH2_SFTP_S_ISDIR(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFDIR)
#define LIBSSH2_SFTP_S_ISCHR(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFCHR)
#define LIBSSH2_SFTP_S_ISBLK(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFBLK)
#define LIBSSH2_SFTP_S_ISFIFO(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFIFO)
#define LIBSSH2_SFTP_S_ISSOCK(m) \
  (((m) & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFSOCK)

/* SFTP File Transfer Flags -- (e.g. flags parameter to sftp_open())
 * Danger will robinson... APPEND doesn't have any effect on OpenSSH servers */
#define LIBSSH2_FXF_READ                        0x00000001
#define LIBSSH2_FXF_WRITE                       0x00000002
#define LIBSSH2_FXF_APPEND                      0x00000004
#define LIBSSH2_FXF_CREAT                       0x00000008
#define LIBSSH2_FXF_TRUNC                       0x00000010
#define LIBSSH2_FXF_EXCL                        0x00000020

/* SFTP Status Codes (returned by libssh2_sftp_last_error() ) */
#define LIBSSH2_FX_OK                       0
#define LIBSSH2_FX_EOF                      1
#define LIBSSH2_FX_NO_SUCH_FILE             2
#define LIBSSH2_FX_PERMISSION_DENIED        3
#define LIBSSH2_F
```

### Core Architecture Module: `Lunar/CSSH/shim.h`
```
#ifndef __CLIBSSH_SHIM_H__
#define __CLIBSSH_SHIM_H__

#include "libssh2/libssh2.h"
#include "libssh2/libssh2_sftp.h"
#include "libssh2/libssh2_publickey.h"

#endif

```

### Core Architecture Module: `Lunar/DDC/DDC.c`
```
//
//  DDC.c
//  DDC Panel
//
//  Created by Jonathan Taylor on 7/10/09.
//  See http://github.com/jontaylor/DDC-CI-Tools-for-OS-X
//

#include "SharedDDC.h"
#include "DDC.h"
#include <stdarg.h>

#define kMaxRequests 10

const UInt8 ZEROARRAY[256] = { 0 };

void initDDCLogging(void) {
    logger = os_log_create("fyi.lunar.Lunar", "ddc");
}

bool IsLidClosed(void)
{
    bool isClosed = false;
    io_registry_entry_t rootDomain;
    mach_port_t masterPort;
    CFTypeRef clamShellStateRef = NULL;

    IOReturn ioReturn = IOMasterPort(MACH_PORT_NULL, &masterPort);
    if (ioReturn != 0) {
        os_log_error(logger, "Error on getting master port: %d", ioReturn);
        return false;
    }

    // Check to see if the "AppleClamshellClosed" property is in the PM root domain:
    rootDomain = IORegistryEntryFromPath(masterPort, kIOPowerPlane ":/IOPowerConnection/IOPMrootDomain");

    clamShellStateRef = IORegistryEntryCreateCFProperty(rootDomain, CFSTR("AppleClamshellState"), kCFAllocatorDefault, 0);
    if (clamShellStateRef == NULL) {
        if (rootDomain) {
            IOObjectRelease(rootDomain);
            return false;
        }
    }

    if (CFBooleanGetValue((CFBooleanRef)(clamShellStateRef)) == true) {
        isClosed = true;
    }

    if (rootDomain) {
        IOObjectRelease(rootDomain);
    }

    if (clamShellStateRef) {
        CFRelease(clamShellStateRef);
    }

    return isClosed;
}

static CFDataRef EDIDCreateFromFramebuffer(io_service_t framebuffer)
{
    io_iterator_t iter;
    io_service_t serv, displayPort = 0;

    if (IORegistryEntryGetChildIterator(framebuffer, kIOServicePlane, &iter) != KERN_SUCCESS) {
        os_log_error(logger, "Can't get child iterator for framebuffer port: %d", framebuffer);
        return NULL;
    }

    CFStringRef key = CFStringCreateWithCString(kCFAllocatorDefault, kIOProviderClassKey, kCFStringEncodingASCII);
    CFStringRef ioDisplayConnect = CFStringCreateWithCString(kCFAllocatorDefault, "IODisplayConnect", kCFStringEncodingASCII);
    CFDataRef edidData;

    while ((serv = IOIteratorNext(iter)) != MACH_PORT_NULL) {
        os_log_debug(logger, "Getting service class for child %d", serv);
        CFStringRef serviceClass = IORegistryEntrySearchCFProperty(serv, kIOServicePlane, key, kCFAllocatorDefault, kIORegistryIterateRecursively);
        if (serviceClass == NULL) {
            os_log_debug(logger, "No service class for child %d", serv);
            continue;
        }
        os_log_debug(logger, "Got service class for child %d", serv);

        if (CFStringCompare(ioDisplayConnect, serviceClass, 0) == 0 && IORegistryEntryGetChildEntry(serv, kIOServicePlane, &displayPort) == KERN_SUCCESS) {
            os_log_debug(logger, "Found display port for framebuffer %d: %d", framebuffer, displayPort);
        } else {
            CFRelease(serviceClass);
            continue;
        }

        os_log_debug(logger, "Getting info dict for display %d", serv);
        CFDictionaryRef info = IODisplayCreateInfoDictionary(displayPort, kIODisplayOnlyPreferredName);
        if (CFDictionaryGetValueIfPresent(info, CFSTR(kIODisplayEDIDKey), (const void**)&edidData)) {
            CFRetain(edidData);
            CFRelease(ioDisplayConnect);
            CFRelease(serviceClass);
            CFRelease(key);
            CFRelease(info);
            IOObjectRelease(iter);
            os_log_debug(logger, "Got EDID for display %d", displayPort);
            return edidData;
        }
        CFRelease(serviceClass);
        CFRelease(info);
    }

    CFRelease(key);
    CFRelease(ioDisplayConnect);
    IOObjectRelease(iter);
    os_log_error(logger, "No EDID for framebuffer %d", framebuffer);
    return NULL;
}

io_service_t IOFramebufferPortFromCGSServiceForDisplayNumber(CGDirectDisplayID displayID)
{
    io_service_t framebuffer = 0;
    if (CGSServiceForDisplayNumber != NULL) {
        // private API func is aliased to SLServiceForDisplayNumber within Skylight.framework, which CoreGraphics.framework links to
        // see https://objective-see.com/blog/blog_0x2C.html "reversing apple's 'screencapture' to programmatically grab desktop images"
        CGSServiceForDisplayNumber(displayID, &framebuffer);
    }
    return framebuffer;
}

io_service_t IOFramebufferPortFromCGDisplayIOServicePort(CGDirectDisplayID displayID)
{
    io_service_t framebuffer = 0;
    if (CGDisplayIOServicePort != NULL) {
        // legacy API call to get the IOFB's service port, was deprecated after macOS 10.9:
        //     https://developer.apple.com/library/mac/documentation/GraphicsImaging/Reference/Quartz_Services_Ref/index.html#//apple_ref/c/func/CGDisplayIOServicePort
        framebuffer = CGDisplayIOServicePort(displayID);
    }
    return framebuffer;
}

/*

 Iterate IOreg's device tree to find the IOFramebuffer mach service port that corresponds to a given CGDisplayID
 replaces CGDisplayIOServicePort: https://developer.apple.com/library/mac/documentation/GraphicsImaging/Reference/Quartz_Services_Ref/index.html#//apple_ref/c/func/CGDisplayIOServicePort
 based on: https://github.com/glfw/glfw/pull/192/files
 */
io_service_t IOFramebufferPortFromCGDisplayID(CGDirectDisplayID displayID, CFMutableDictionaryRef displayUUIDByEDID)
{
    io_iterator_t iter;
    io_service_t serv, servicePort = 0;
    CFUUIDRef displayUUID = CGDisplayCreateUUIDFromDisplayID(displayID);

    if (!displayUUID) {
        return 0;
    }

    kern_return_t err = IOServiceGetMatchingServices(kIOMasterPortDefault, IOServiceMatching(IOFRAMEBUFFER_CONFORMSTO), &iter);

    if (err != KERN_SUCCESS) {
        CFRelease(displayUUID);
        IOObjectRelease(iter);
        return 0;
    }

    // now recurse the IOReg tree
    while ((serv = IOIteratorNext(iter)) != MACH_PORT_NULL) {
        CFDictionaryRef info;
        CFUUIDRef uuid;
        io_name_t name;
        CFIndex vendorID = 0, productID = 0, serialNumber = 0;
        CFNumberRef vendorIDRef, productIDRef, serialNumberRef;
        Boolean success = 0;

        os_log_debug(logger, "Getting EDID for framebuffer %d", serv);
        CFDataRef displayEDID = EDIDCreateFromFramebuffer(serv);
        if (displayEDID == NULL) {
            continue;
        }

        os_log_debug(logger, "Checking to see if EDID already exists");
        if (CFDictionaryGetValueIfPresent(displayUUIDByEDID, displayEDID, (const void**)&uuid)) {
            CFRetain(uuid);

            os_log_debug(logger, "EDID already exists");
            os_log_debug(logger, "Checking to see if EDID corresponds to display UUID");

            CFStringRef uuid1 = CFUUIDCreateString(kCFAllocatorDefault, displayUUID);
            CFStringRef uuid2 = CFUUIDCreateString(kCFAllocatorDefault, uuid);

            if (uuid1 && uuid2 && CFStringCompare(uuid1, uuid2, 0) != 0) {
                CFRelease(displayEDID);
                CFRelease(uuid1);
                CFRelease(uuid2);
                os_log_debug(logger, "UUIDs differ");
                continue;
            }
            if (uuid1) {
                CFRelease(uuid1);
            }
            if (uuid2) {
                CFRelease(uuid2);
            }
        }

        // get metadata from IOreg node
        IORegistryEntryGetName(serv, name);
        os_log_debug(logger, "Getting info dict for fb: %d", serv);
        info = IODisplayCreateInfoDictionary(serv, kIODisplayOnlyPreferredName);

        os_log_debug(logger, "Getting vendor for fb: %d", serv);
        if (CFDictionaryGetValueIfPresent(info, CFSTR(kDisplayVendorID), (const void**)&vendorIDRef)) {
            success = CFNumberGetValue(vendorIDRef, kCFNumberCFIndexType, &vendorID);
            os_log_debug(logger, "Got vendor %ld for fb: %d", (long)vendorID, serv);
        }

        os_log_debug(logger, "Getting product id for fb: %d", serv);
        if (CFDictionaryGetValueIfPresent(info, CFSTR(kDisplayProductID), (const void**)&productIDRef)) {
            success &= CFNumberGetValue(productIDRef, kCFNumberCFIndexT
```

### Core Architecture Module: `Lunar/DDC/DDC.h`
```
//
//  DDC.h
//  DDC Panel
//
//  Created by Jonathan Taylor on 7/10/09.
//  See ftp://ftp.cis.nctu.edu.tw/pub/csie/Software/X11/private/VeSaSpEcS/VESA_Document_Center_Monitor_Interface/mccsV3.pdf
//  See http://read.pudn.com/downloads110/ebook/456020/E-EDID%20Standard.pdf
//  See ftp://ftp.cis.nctu.edu.tw/pub/csie/Software/X11/private/VeSaSpEcS/VESA_Document_Center_Monitor_Interface/EEDIDrAr2.pdf
//

#ifndef DDC_Panel_DDC_h
#define DDC_Panel_DDC_h

#include <IOKit/i2c/IOI2CInterface.h>
#include <IOKit/IOKitLib.h>
#include <IOKit/graphics/IOGraphicsLib.h>
#include <ApplicationServices/ApplicationServices.h>
#include "SharedDDC.h"
#include <IOKit/pwr_mgt/IOPMLib.h>


#define RESET 0x04
#define RESET_BRIGHTNESS_AND_CONTRAST 0x05
#define RESET_GEOMETRY 0x06
#define RESET_COLOR 0x08
#define BRIGHTNESS 0x10  //OK
#define CONTRAST 0x12 //OK
#define COLOR_PRESET_A                 0x14     // dell u2515h -> Presets: 4 = 5000K, 5 = 6500K, 6 = 7500K, 8 = 9300K, 9 = 10000K, 11 = 5700K, 12 = Custom Color
#define RED_GAIN 0x16
#define GREEN_GAIN 0x18
#define BLUE_GAIN 0x1A
#define AUTO_SIZE_CENTER 0x1E
#define WIDTH 0x22
#define HEIGHT 0x32
#define VERTICAL_POS	0x30
#define HORIZONTAL_POS 0x20
#define PINCUSHION_AMP 0x24
#define PINCUSHION_PHASE 0x42
#define KEYSTONE_BALANCE 0x40
#define PINCUSHION_BALANCE 0x26
#define TOP_PINCUSHION_AMP 0x46
#define TOP_PINCUSHION_BALANCE 0x48
#define BOTTOM_PINCUSHION_AMP 0x4A
#define BOTTOM_PINCUSHION_BALANCE 0x4C
#define VERTICAL_LINEARITY 0x3A
#define VERTICAL_LINEARITY_BALANCE 0x3C
#define HORIZONTAL_STATIC_CONVERGENCE 0x28
#define VERTICAL_STATIC_CONVERGENCE 0x28
#define MOIRE_CANCEL 0x56
#define INPUT_SOURCE 0x60
#define AUDIO_SPEAKER_VOLUME 0x62
#define RED_BLACK_LEVEL 0x6C
#define GREEN_BLACK_LEVEL 0x6E
#define BLUE_BLACK_LEVEL 0x70
#define ORIENTATION 0xAA
#define AUDIO_MUTE 0x8D
#define SETTINGS 0xB0                  //unsure on this one
#define ON_SCREEN_DISPLAY              0xCA     // read only   -> returns '1' (OSD closed) or '2' (OSD active)
#define OSD_LANGUAGE 0xCC
#define DPMS 0xD6
#define COLOR_PRESET_B                 0xDC     // dell u2515h -> Presets: 0 = Standard, 2 = Multimedia, 3 = Movie, 5 = Game
#define VCP_VERSION 0xDF
#define COLOR_PRESET_C                 0xE0     // dell u2515h -> Brightness on/off (0 or 1)
#define POWER_CONTROL 0xE1
#define TOP_LEFT_SCREEN_PURITY 0xE8
#define TOP_RIGHT_SCREEN_PURITY 0xE9
#define BOTTOM_LEFT_SCREEN_PURITY 0xE8
#define BOTTOM_RIGHT_SCREEN_PURITY 0xEB

bool DDCWriteIntel(io_service_t framebuffer, struct DDCWriteCommand *write, uint8_t sourceAddr);
bool DDCReadIntel(io_service_t framebuffer, struct DDCReadCommand *read);
bool EDIDTestIntel(io_service_t framebuffer, struct EDID *edid, uint8_t edidData[256]);

io_service_t IOFramebufferPortFromCGDisplayID(CGDirectDisplayID displayID, CFMutableDictionaryRef displayUUIDByEDID);
io_service_t IOFramebufferPortFromCGSServiceForDisplayNumber(CGDirectDisplayID displayID);
io_service_t IOFramebufferPortFromCGDisplayIOServicePort(CGDirectDisplayID displayID);

UInt32 SupportedTransactionType(void);
bool IsLidClosed(void);
void initDDCLogging(void);

extern io_service_t CGDisplayIOServicePort(CGDirectDisplayID display) __attribute__((weak_import));
extern void CGSServiceForDisplayNumber(CGDirectDisplayID display, io_service_t* service) __attribute__((weak_import));

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #515** (2023-12-08): **Add CLI install location to succcessful print statement**
  *Symptoms*: Installing the lunar CLI via the terminal can lead to the install "silently failing" or seeming to fail if `~/.local/bin` is not in your `$PATH`.  This simply adds the install location to the success print message so that the user knows where the CLI was installed and can add the necessary directory to their `$PATH` if required.  Full disclosure: I did not build/test this at all, I am just borrowing the `CLI_BIN_DIR` variable that is already used and printing it out for the user to see.

- **Issue #514** (2023-07-01): **fix: bump platformio/espressif to 5.3.0 to maintain darwin_arm64 compatibility**
  *Symptoms*: Lately, when trying to install the Lunar light sensor package on an ESP32 board off an M1 Pro Macbook, this pops up:  ``` Processing lunarsensor (board: adafruit_metro_esp32s2; framework: arduino; platform: platformio/espressif32@5.1.0) ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- Tool Manager: Installing espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3 INFO Installing espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3 Error: Could not find the package with 'espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3' requirements for your system 'darwin_arm64' ```   Checking `espressif/toolchain-riscv32-esp`'s [version info](https://registry.platformio.org/tools/espressif/toolchain-riscv32-esp/versions) on PlatformIO, the only `8.x` package still published is `8.4.0+2021r2-patch5`  Digging further into the dependency chain, it seems that `platformio/espressif32@5.3.0` uses the latest `espressif/toolchain-riscv32-esp` version, which enables using an Apple Silicon device to provision a board using ESPHome.   Not sure about other ESP32 boards, although being a minor version update, I'd hope everything remains stable.
  **Post-Mortem & Fix Analysis**:
  > @pcnc Thanks for the PR! I'll have to test this myself first on all my boards.   The installation always worked on Apple Silicon, I'm not sure what changed upstream to cause this, but it's good you investigated this and let me know. 
  > Sure thing! Thanks as well!  Forgot to mention that the UI reported the install successful, though I noticed there was no wi-fi client registering on the local network using the provided connection credentials - could be that the toolchain doesn't exit with an error-specific code.  Adding some additional info which might be relevant to debugging:  Board: `Adafruit Metro ESP32-S2` Sensor: `Adafruit TSL2591` Basically the no-solder setup described [here](https://lunar.fyi/sensor)  OS/Env: ``` ❯ uname -a Darwin mbp.local 22.5.0 Darwin Kernel Version 22.5.0: Mon Apr 24 20:52:24 PDT 2023; root:xnu-8796.121.2~5/RELEASE_ARM64_T6000 arm64 ❯ python3 --version Python 3.11.3 ❯ python3 -m pip --version pip 23.1.2 from /opt/homebrew/lib/python3.11/site-packages/pip (python 3.11) ```

- **Issue #436** (2022-02-09): **Fix spelling**
  *Symptoms*: 

- **Issue #312** (2021-04-29): **Add a Gitter chat badge to README.md**
  *Symptoms*: ### alin23/Lunar now has a Chat Room on Gitter  @alin23 has just created a chat room. You can visit it here: [https://gitter.im/alin23-Lunar/community](https://gitter.im/alin23-Lunar/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&content=body_link).  This pull-request adds this badge to your README.md:   [![Gitter](https://badges.gitter.im/alin23-Lunar/community.svg)](https://gitter.im/alin23-Lunar/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge)  If my aim is a little off, please [let me know](https://gitlab.com/gitlab-org/gitter/readme-badger/issues).  Happy chatting.   PS: [Click here](https://gitter.im/settings/badger/opt-out) if you would prefer not to receive automatic pull-requests from Gitter in future. 

- **Issue #237** (2020-12-26): **Fix installation instructions in README.md**
  *Symptoms*: Fix error when installing using latest Homebrew. This is not a bug of this app, but README.md needs to be fixed.  screenshot:  ![Calling brew cask install is disabled](https://user-images.githubusercontent.com/8146876/103143622-6069a900-475d-11eb-9f4c-a70ac6cb667c.png) 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the update! 😊

- **Issue #14** (2019-03-19): **Animate brightness/contrast transitions**
  *Symptoms*: Hello! This implements feature request: #14   This works on my display (LG 4k). The step value is set to 2 if you are changing the value by more than 50.  The only problem with this implementation is that currently the Display object doesn't get initiated with the external display's initial brightness, so that variable always starts at 50. That means if your monitor is at 100 and you set it to 0, it will jump to 50 then animate to 0.  I tried to call `DDC.readBrightness()` at initiation but it kept crashing my computer 😊. Is there an easy way to grab that value at init?
  **Post-Mortem & Fix Analysis**:
  > Looks like there was a similar issue in fetching current display brightness here: https://github.com/alin23/Lunar/pull/2
  > Reading the brightness never worked. I fiddled with the DDC.c source to get it working but nothing I tried made a difference.
  > The biggest issue I see with this is that Lunar blocks any UI interaction while it runs the smooth brightness change loop. For me it makes all the system jaggy until it finishes changing the brightness/contrast. This is a serious trade-off that I'm not sure all the users would like to make.  So one mandatory thing for this feature would be a setting to turn the smooth adjustment on and off, and by default it should be off. I'm thinking it could be toggle setting (like the `Adaptive` or `Unlocked` toggle) that could reside under the `CONFIGURATION` section of the Settings page.   I also really like how the brightness changes now, it was weird to see sudden drops in brightness when there was a cloud outside. It was almost like a flicker. But the fact that it makes all the system lag for a moment makes it hard to use. I'm not sure if this is a hardware limitation or if it could be fixed in software.

- **Issue #3** (2018-08-07): **updated readme**
  *Symptoms*: sorry I forgot to update the readme 😁
  **Post-Mortem & Fix Analysis**:
  > Thanks! I always forget about it too. I'm preparing a release in a few minutes.

- **Issue #2** (2018-08-06): **Feature/manual controls**
  *Symptoms*: added hotkeys for manual brightness incrementation and decrementation
  **Post-Mortem & Fix Analysis**:
  > Hi @duongel !  Thank you for the PR! This is something I've been wanting to implement after my current trip.  There a few things that we should decide upon before merging this: * Are the default hotkeys particular enough so that they don't interfere with other system/app hotkeys?   - I've seen people ask for this functionality bound to the brightness keys instead of other hotkeys, what do you think about this idea? * By using `setLightPercent()`, the brightness/contrast will be confined between the per-monitor min/max limits. Do we want this or should we override the min/max limits when manually adjusting the brightness? 
  > Hi @alin23 ,  I hope you had a pleasant trip :-)   - that's a great idea to bind the manual controls to the brightness keys! I pushed the change with `.control` modifier and hope that's safe enough to avoid any collisions.  - I think we should respect the user's min/max limits while manually adjusting the brightness. A reason for limiting a monitor's max brightness could be that its maximum brightness is much higher than the others. And while manually adjusting brightness to the maximum, one could still want to limit the most bright monitor.  - do you have any idea how to get the current brightness of any external monitor? E. g. `brightnessAdapter.displays.first?.value.brightness.intValue` does not seem to return the first display's current brightness reliably.
  > Thanks for the prompt follow-up @duongel   Yes, the <kbd>CTRL</kbd>+<kbd>F1</kbd> and <kbd>CTRL</kbd>+<kbd>F2</kbd> would be ok for most users. I think we should make this configurable in the near future to make everyone happy, but for now I like it this way.  You're making a good point about the min/max limits, I was thinking the same 😄   There's no way to get the brightness reliably as far as I know because the DDC protocol isn't fully implemented in a lot of monitors. I tried everything here but there doesn't seem to be a way to get read access to these properties.   The value you're getting here `brightnessAdapter.displays.first?.value.brightness.intValue` is the value we are setting, and most of the time we are not saving it in the DB because it is not that useful/reliable.

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

### Incident Patch 1: `1ffb5356` (2026-05-25)
**Commit Message**: Fix OSD not appearing

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -7,4 +7,4 @@ Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:c4179714e990615d2fbfe43844805a28230b78710e7a35f5ebdfa71f8091a40e
+Lunar/required.swift:380c99532520441fe6ad092864e86557d5c8a3400e720e2b553cd2a3514ccb0d
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1324,7 +1324,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.3;
+				CURRENT_PROJECT_VERSION = 6.10.4;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1356,7 +1356,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.3;
+				MARKETING_VERSION = 6.10.4;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1390,7 +1390,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.3;
+				CURRENT_PROJECT_VERSION = 6.10.4;
 				DEPLOYMENT_POSTPROCESSING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1422,7 +1422,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.3;
+				MARKETING_VERSION = 6.10.4;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "deeada10193a754d2b436b1330359bc84815a84e11cbc7d82af89d0eb69344c8",
+  "originHash" : "435149211245f4824d9f225087cd780270ae83e188eacd4398189990aeb6023d",
   "pins" : [
     {
       "identity" : "anycodable",
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "3a22ecd00ad1398747bfd587e44df82716908dd3",
-        "version" : "9.10.0"
+        "revision" : "193d313fbfd9affaf2be1692a0284a3b6574c515",
+        "version" : "9.14.0"
       }
     },
     {
```

**File**: `Lunar/Data/Display.swift` (modified, +4/-1)
```diff
@@ -2677,7 +2677,10 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
     lazy var nsScreen: NSScreen? = getScreen() {
         didSet {
             setNotchState()
-            let shouldShowOSD = nsScreen?.visibleFrame != oldValue?.visibleFrame && (osdWindowController?.window as? OSDWindow)?.contentView?.superview?.alphaValue == 1
+            let shouldShowOSD = (
+                nsScreen?.displayID != oldValue?.displayID
+                    || nsScreen?.visibleFrame != oldValue?.visibleFrame
+            ) && (osdWindowController?.window as? OSDWindow)?.contentView?.superview?.alphaValue == 1
             let screen = nsScreen
             mainAsync {
                 self.supportsEnhance = self.getSupportsEnhance()
```

**File**: `Lunar/Views/OSDWindow.swift` (modified, +10/-1)
```diff
@@ -22,7 +22,7 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         contentViewController = NSHostingController(rootView: swiftuiView)
 
         self.level = level
-        collectionBehavior = [.stationary, .canJoinAllSpaces, .ignoresCycle, .fullScreenDisallowsTiling]
+        collectionBehavior = [.stationary, .canJoinAllSpaces, .ignoresCycle, .fullScreenAuxiliary, .fullScreenDisallowsTiling]
         shouldIgnoreMouseEvents = ignoresMouseEvents
         self.ignoresMouseEvents = ignoresMouseEvents
         setAccessibilityRole(.popover)
@@ -152,6 +152,10 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         }
     }
 
+    func isBound(to screen: NSScreen?) -> Bool {
+        self.screen?.displayID == screen?.displayID
+    }
+
     func windowWillClose(_ notification: Notification) {
         removeHoverTrackingArea()
     }
@@ -1181,6 +1185,11 @@ extension Display {
             osdState.imageLeft = imageLeft
             osdState.onChange = onChange
 
+            if let osd = osdWindowController?.window as? OSDWindow, !osd.isBound(to: nsScreen) {
+                osd.hide()
+                osdWindowController = nil
+            }
+
             if osdWindowController == nil {
                 let ignoresMouseEvents = if #available(macOS 26, *) {
                     false
```

---

### Incident Patch 2: `22e899d5` (2026-05-08)
**Commit Message**: Fix Auto Mode selecting Sensor instead of Sync in specific cases

**File**: `Lunar/Utils/DisplayController.swift` (modified, +6/-1)
```diff
@@ -1377,7 +1377,12 @@ final class DisplayController: ObservableObject {
     }
 
     static func getSourceDisplay(_ displays: [Display]? = nil) -> Display {
-        guard let displays = displays ?? CachedDefaults[.displays], !displays.isEmpty else {
+        let displays = if displays == nil {
+            CachedDefaults[.displays]
+        } else {
+            displays
+        }
+        guard let displays, !displays.isEmpty else {
             return ALL_DISPLAYS
         }
 
```

**File**: `ReleaseNotes/6.10.2.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+## Fixes
+
+- Fix Auto Mode selecting Sensor instead of Sync in specific cases
```

---

### Incident Patch 3: `47c14162` (2026-04-10)
**Commit Message**: Fix package resolution

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +0/-2)
```diff
@@ -1548,8 +1548,6 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 9.2.0;
 			};
-			traits = (
-			);
 		};
 		C77AB65A269A032E0046BA78 /* XCRemoteSwiftPackageReference "Magnet" */ = {
 			isa = XCRemoteSwiftPackageReference;
```

**File**: `Lunar.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/alin23/FuzzyMatcher",
       "state" : {
-        "branch" : "main",
-        "revision" : "6c7628a46a566d64d6b7d79068c95bf80c8a6bd6"
+        "revision" : "6e2cda30e50904bd3d11ee869d2196d865289ce4",
+        "version" : "0.1.2"
       }
     },
     {
```

---

### Incident Patch 4: `95f6446b` (2026-04-10)
**Commit Message**: Sync mode after blackout fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -7,4 +7,4 @@ Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:5bd5254a5701c36d1c10cc2e9d0073eaf72d89caf17da82dc5af8b0ba5b47dc1
+Lunar/required.swift:6cf65346342de3aa85f37b2fae772fb413ddfc29669d80e1ef95fca6c16596ae
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +23/-6)
```diff
@@ -181,6 +181,7 @@
 		C7CBEFFD238E81FF00031E93 /* Util.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7CBEFFC238E81FF00031E93 /* Util.swift */; };
 		C7CC5D1629437E2C00DEA106 /* DDC2.h in Headers */ = {isa = PBXBuildFile; fileRef = C7CC5D1529437E2C00DEA106 /* DDC2.h */; };
 		C7CFF494271FF280002CB549 /* DDCPopoverController.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7CFF492271FF280002CB549 /* DDCPopoverController.swift */; };
+		C7D698C12F88FB7A00FAFD3A /* FuzzyMatcher in Frameworks */ = {isa = PBXBuildFile; productRef = C7D698C02F88FB7A00FAFD3A /* FuzzyMatcher */; };
 		C7DA10F7259B8979006DD876 /* Regex in Frameworks */ = {isa = PBXBuildFile; productRef = C7DA10F6259B8979006DD876 /* Regex */; };
 		C7DD622126120B7600B07B31 /* RaspberryPageController.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7DD622026120B7600B07B31 /* RaspberryPageController.swift */; };
 		C7DD62292612331700B07B31 /* PaddedTextField.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7DD62282612331700B07B31 /* PaddedTextField.swift */; };
@@ -309,7 +310,6 @@
 		C7545E3125B1996300383AFB /* PopUpButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopUpButton.swift; sourceTree = "<group>"; };
 		C7574F802354691700358397 /* gencode.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = gencode.sh; path = bin/gencode.sh; sourceTree = "<group>"; };
 		C7574F812354691700358397 /* buildscript.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = buildscript.sh; path = bin/buildscript.sh; sourceTree = "<group>"; };
-		C7605FC72F7AB7040087B195 /* FuzzyMatcher */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = FuzzyMatcher; path = /Users/alin/Github/alin23/FuzzyMatcher; sourceTree = "<absolute>"; };
 		C76168F929B8B79F00D0A33A /* Bridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = Bridge.h; sourceTree = "<group>"; };
 		C76168FB29B8B91C00D0A33A /* SidecarCore.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = SidecarCore.framework; path = ../../../../../System/Library/PrivateFrameworks/SidecarCore.framework; sourceTree = "<group>"; };
 		C762AAE8271F3D6200198EDA /* ColorsPopoverController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ColorsPopoverController.swift; sourceTree = "<group>"; };
@@ -445,6 +445,7 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				C7D698C12F88FB7A00FAFD3A /* FuzzyMatcher in Frameworks */,
 				C799C2F527BF67C4003A2FB9 /* Socket in Frameworks */,
 				C73CC6AE24616462003B2658 /* Sauce in Frameworks */,
 				C70A793D2AB471F900289426 /* SwiftUIIntrospect in Frameworks */,
@@ -709,7 +710,6 @@
 		C7AEC7EC1FD0B4350039B562 = {
 			isa = PBXGroup;
 			children = (
-				C7605FC72F7AB7040087B195 /* FuzzyMatcher */,
 				C705A03B268B4187001ABBA9 /* Packages */,
 				C73B41F3263BE46F006F6783 /* Localization */,
 				C7574F7F235468EE00358397 /* Scripts */,
@@ -927,6 +927,7 @@
 				C744D07B2B434605003D77DE /* Sentry */,
 				C7160EBF2BBACBDF000F83F2 /* FuzzyMatcher */,
 				C788DCEC2F5F615400107F11 /* MacModelDB */,
+				C7D698C02F88FB7A00FAFD3A /* FuzzyMatcher */,
 			);
 			productName = Lunar;
 			productReference = C7AEC7F51FD0B4350039B562 /* Lunar.app */;
@@ -988,6 +989,7 @@
 				C7BD5F83287B44130077CCB7 /* XCRemoteSwiftPackageReference "Charts" */,
 				C744D07A2B434605003D77DE /* XCRemoteSwiftPackageReference "sentry-cocoa" */,
 				C788DCEB2F5F615400107F11 /* XCRemoteSwiftPackageReference "MacModelDB" */,
+				C7D698BF2F88FB7900FAFD3A /* XCRemoteSwiftPackageReference "FuzzyMatcher" */,
 			);
 			productRefGroup = C7AEC7F61FD0B4350039B562 /* Products */;
 			projectDirPath = "";
@@ -1286,8 +1288,8 @@
 				CODE_SIGN_IDENTITY = "Mac Developer";
 				COPY_PHASE_STRIP = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEPLOYMENT_POSTPROCESSING =
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +256/-248)
```diff
@@ -1,250 +1,258 @@
 {
-  "object": {
-    "pins": [
-      {
-        "package": "AnyCodable",
-        "repositoryURL": "https://github.com/Flight-School/AnyCodable",
-        "state": {
-          "branch": null,
-          "revision": "862808b2070cd908cb04f9aafe7de83d35f81b05",
-          "version": "0.6.7"
-        }
-      },
-      {
-        "package": "AXSwift",
-        "repositoryURL": "https://github.com/alin23/AXSwift",
-        "state": {
-          "branch": "main",
-          "revision": "055c6abb49bb86c8d700da74d834523b03b4d702",
-          "version": null
-        }
-      },
-      {
-        "package": "BlueSocket",
-        "repositoryURL": "https://github.com/alin23/BlueSocket",
-        "state": {
-          "branch": "master",
-          "revision": "4e334a848f89c44b2348332f0996f312dc6ed0d2",
-          "version": null
-        }
-      },
-      {
-        "package": "Charts",
-        "repositoryURL": "https://github.com/alin23/Charts/",
-        "state": {
-          "branch": "master",
-          "revision": "27af8f086176bbaabb2bfcd53005bf8e0647a296",
-          "version": null
-        }
-      },
-      {
-        "package": "DataCompression",
-        "repositoryURL": "https://github.com/mw99/DataCompression/",
-        "state": {
-          "branch": null,
-          "revision": "16f858982a077451ce3bdbd9144d3073ec85b6e4",
-          "version": "3.9.0"
-        }
-      },
-      {
-        "package": "Defaults",
-        "repositoryURL": "https://github.com/sindresorhus/Defaults",
-        "state": {
-          "branch": null,
-          "revision": "3efef5a28ebdbbe922d4a2049493733ed14475a6",
-          "version": "7.3.1"
-        }
-      },
-      {
-        "package": "Glob",
-        "repositoryURL": "https://github.com/Bouke/Glob",
-        "state": {
-          "branch": null,
-          "revision": "deda6e163d2ff2a8d7e138e2c3326dbd71157faf",
-          "version": "1.0.5"
-        }
-      },
-      {
-        "package": "KeyHolder",
-        "repositoryURL": "https://github.com/alin23/KeyHolder",
-        "state": {
-          "branch": "master",
-          "revision": "4cbb7eaa0b9ba245d33e9cf176f2b70c778f2784",
-          "version": null
-        }
-      },
-      {
-        "package": "MacModelDB",
-        "repositoryURL": "https://github.com/alin23/MacModelDB",
-        "state": {
-          "branch": null,
-          "revision": "7a529050731855763504809820395484669458c2",
-          "version": "1.0.2"
-        }
-      },
-      {
-        "package": "Magnet",
-        "repositoryURL": "https://github.com/alin23/Magnet",
-        "state": {
-          "branch": "dev",
-          "revision": "a21e6c4fd0fdb0244009e7c1fce64b31a01c39ca",
-          "version": null
-        }
-      },
-      {
-        "package": "MediaKeyTap",
-        "repositoryURL": "https://github.com/alin23/MediaKeyTap",
-        "state": {
-          "branch": "dev",
-          "revision": "5b8ee686bc90d917cba4f029b47c2a8541a4f58d",
-          "version": null
-        }
-      },
-      {
-        "package": "Path.swift",
-        "repositoryURL": "https://github.com/mxcl/Path.swift",
-        "state": {
-          "branch": null,
-          "revision": "74ec90bbe50a3376e399286fed48b60db9b91bb1",
-          "version": "1.6.0"
-        }
-      },
-      {
-        "package": "Regex",
-        "repositoryURL": "https://github.com/crossroadlabs/Regex",
-        "state": {
-          "branch": null,
-          "revision": "166728756082a9cac6e4aed3ebbce8e41cb3a945",
-          "version": "1.2.0"
-        }
-      },
-      {
-        "package": "Sauce",
-        "repositoryURL": "https://github.com/Clipy/Sauce",
-        "state": {
-          "branch": null,
-          "revision": "2fcf7e43a242b183fdea3f2275ebec0d773b65f5",
-          "version": "2.2.0"
-        }
-      },
-      {
-        "package": "Sentry",
-        "repositoryURL": "https://github.com/getsentry/sentry-cocoa",
-        "state": {
-          "bra
```

**File**: `Releases/appcast-stable.xml` (modified, +6/-6)
```diff
@@ -12,13 +12,13 @@
             <sparkle:shortVersionString>6.10.0</sparkle:shortVersionString>
             <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
             <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.0.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="21268300" type="application/octet-stream" sparkle:edSignature="rTh39wIgE848EjGm/rAVvdkXVuHddp9IW8031AC/PW7e/Rownr7nPPmYVB21DJME6c4NkALKQ/o9X3TRuAi1DQ=="/>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="17600573" type="application/octet-stream" sparkle:edSignature="Kp4E6cWX7mj8JT8CY53RNNtpo3PpYkKSapyFjkeqcidlhiqro39/EUkKPy/Z4hV+pKE7bFgQKq8DfgbINeajAw=="/>
             <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6812534" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="aXfK6kXXbN07UqfWENBFHMxhUfLOdloRQpddZzrqP8b7NUywBJF/xx7KHjTdl+jBBrqKtV7Mjr5NrIMz6L0qBg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6980638" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="m68G3GzrGqfEPhCw95Ly9ibcgIjgjCeBNORYdGtAhplkEHCnQEu8WfKN2p3kpXIH+2jVApQkc3yKqrfINoljAQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6962602" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="JSkeD0g0l9sB4BF8x4lZRv3uGFGxW3jBuLGfdslD9yRGLl/b8ADmy9JOpj1vowy2deUNoIb0HfnkabXHqE9lBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="7703266" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="jgKtvQ/6YqUIzOqU8ZJhXeWZeh1sZDx98dJ0HcwiAducLryGxbCzJCg+aywsy1Vf1G0vzoj9DK1sobppX92CDw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="7681946" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="oh2kHswN6K2eYmnsFfEaPGdH/5dq52JZG+H34INdGi3N+ft3/BBDN8acX6/Iq0tckIW0zdSQN9sFX5K2Xt9DBg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6089774" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4JYMWX6lK5ZYa3I8yC7qrZdCsANh3oi+5siryhsogHc9uC39Grjv2gXhPtrkzpuFHlo+eLM+WiX49IajINmdDg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6157734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4GAVZ+ntBSUjqhcA5QSlMTRXUgqULGarPZj5KnLQNsLSXMP022GeHSP04vnHoj9L/TK2FWnv+tmJNKatTa2qBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6162322" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="yL2AqEjO5NxAGGNvXjS9fAtEXUYU4SxefncBvzDziIKLkV74L5z5vkGn7jNYyUqwpfIzPYtnCu2LsXp773XnAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="6860614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:
```

**File**: `Releases/appcast2.xml` (modified, +6/-6)
```diff
@@ -12,13 +12,13 @@
             <sparkle:shortVersionString>6.10.0</sparkle:shortVersionString>
             <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
             <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.0.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="21268300" type="application/octet-stream" sparkle:edSignature="rTh39wIgE848EjGm/rAVvdkXVuHddp9IW8031AC/PW7e/Rownr7nPPmYVB21DJME6c4NkALKQ/o9X3TRuAi1DQ=="/>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="17600573" type="application/octet-stream" sparkle:edSignature="Kp4E6cWX7mj8JT8CY53RNNtpo3PpYkKSapyFjkeqcidlhiqro39/EUkKPy/Z4hV+pKE7bFgQKq8DfgbINeajAw=="/>
             <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6812534" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="aXfK6kXXbN07UqfWENBFHMxhUfLOdloRQpddZzrqP8b7NUywBJF/xx7KHjTdl+jBBrqKtV7Mjr5NrIMz6L0qBg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6980638" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="m68G3GzrGqfEPhCw95Ly9ibcgIjgjCeBNORYdGtAhplkEHCnQEu8WfKN2p3kpXIH+2jVApQkc3yKqrfINoljAQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6962602" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="JSkeD0g0l9sB4BF8x4lZRv3uGFGxW3jBuLGfdslD9yRGLl/b8ADmy9JOpj1vowy2deUNoIb0HfnkabXHqE9lBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="7703266" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="jgKtvQ/6YqUIzOqU8ZJhXeWZeh1sZDx98dJ0HcwiAducLryGxbCzJCg+aywsy1Vf1G0vzoj9DK1sobppX92CDw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="7681946" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="oh2kHswN6K2eYmnsFfEaPGdH/5dq52JZG+H34INdGi3N+ft3/BBDN8acX6/Iq0tckIW0zdSQN9sFX5K2Xt9DBg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6089774" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4JYMWX6lK5ZYa3I8yC7qrZdCsANh3oi+5siryhsogHc9uC39Grjv2gXhPtrkzpuFHlo+eLM+WiX49IajINmdDg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6157734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4GAVZ+ntBSUjqhcA5QSlMTRXUgqULGarPZj5KnLQNsLSXMP022GeHSP04vnHoj9L/TK2FWnv+tmJNKatTa2qBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6162322" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="yL2AqEjO5NxAGGNvXjS9fAtEXUYU4SxefncBvzDziIKLkV74L5z5vkGn7jNYyUqwpfIzPYtnCu2LsXp773XnAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="6860614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:
```

---

### Incident Patch 5: `9b2a10d9` (2026-04-08)
**Commit Message**: Fix Sync Mode getting wrongly enabled after coming out of sleep in blackout

**File**: `.gitsecret/paths/mapping.cfg` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:c6d7e54cf37dc198643bc5dc9657b39f86387b7fc85343e525890535ee33be85
 Lunar/Modes/LocationMode.swift:9964ed4ba9098fc7a17c515a4ea5b9c128fc1d5cfba1deb7ac11a75cef3e7702
-Lunar/Data/Pro.swift:36799f95e018b63fe9507065dcea5296f7608aec4055dce4d3775eb20dc9088a
+Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2d317b
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:055c8dd10165b8034b18c24eb42c5ff46427d95bb3b317695317eeda67c54a0d
+Lunar/required.swift:5bd5254a5701c36d1c10cc2e9d0073eaf72d89caf17da82dc5af8b0ba5b47dc1
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +5/-1)
```diff
@@ -1284,8 +1284,9 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				CODE_SIGN_IDENTITY = "Mac Developer";
-				COPY_PHASE_STRIP = NO;
+				COPY_PHASE_STRIP = YES;
 				DEAD_CODE_STRIPPING = YES;
+				DEPLOYMENT_POSTPROCESSING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
@@ -1426,6 +1427,9 @@
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				SDKROOT = macosx;
 				SWIFT_OBJC_BRIDGING_HEADER = "Lunar/DDC/Lunar-Bridging-Header.h";
+				DEPLOYMENT_POSTPROCESSING = YES;
+				STRIP_INSTALLED_PRODUCT = YES;
+				STRIP_STYLE = "non-global";
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SWIFT_VERSION = 5.0;
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "$(inherited)";
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +4/-4)
```diff
@@ -105,8 +105,8 @@
         "repositoryURL": "https://github.com/mxcl/Path.swift",
         "state": {
           "branch": null,
-          "revision": "afe25cdba7b8f952c16bc0c4290bdeb6af61f92f",
-          "version": "1.5.0"
+          "revision": "74ec90bbe50a3376e399286fed48b60db9b91bb1",
+          "version": "1.6.0"
         }
       },
       {
@@ -132,8 +132,8 @@
         "repositoryURL": "https://github.com/getsentry/sentry-cocoa",
         "state": {
           "branch": null,
-          "revision": "05d3ce8332097ff0b2347231ac66476fd7d2f4d8",
-          "version": "9.8.0"
+          "revision": "d459ff99b1912c9603c9e607e030b4b98e2e199a",
+          "version": "9.9.0"
         }
       },
       {
```

**File**: `Lunar/Utils/DisplayController.swift` (modified, +20/-1)
```diff
@@ -1377,7 +1377,7 @@ final class DisplayController: ObservableObject {
     }
 
     static func getSourceDisplay(_ displays: [Display]? = nil) -> Display {
-        guard let displays = displays ?? CachedDefaults[.displays] else {
+        guard let displays = displays ?? CachedDefaults[.displays], !displays.isEmpty else {
             return ALL_DISPLAYS
         }
 
@@ -2379,7 +2379,26 @@ final class DisplayController: ObservableObject {
         if let d = activeNewDisplays.first, activeNewDisplays.count == 1, d.isBuiltin, d.blackOutEnabled, activeOldDisplays.count > 1 {
             log.info("Disabling BlackOut if we're left with only 1 screen")
             lastBlackOutToggleDate = .distantPast
+            let preservedAdaptiveMode = d.blackOutEnabledWithoutMirroring && CachedDefaults[.overrideAdaptiveMode] ? adaptiveModeKey : nil
             blackOut(display: d.id, state: .off, mirroringAllowed: !d.blackOutEnabledWithoutMirroring)
+            if let preservedAdaptiveMode {
+                let restoreAdaptiveMode = { [self] in
+                    guard adaptiveModeKey != preservedAdaptiveMode else { return }
+
+                    Defaults.withoutPropagation {
+                        pausedAdaptiveModeObserver = true
+                        adaptiveMode = preservedAdaptiveMode.mode
+                        CachedDefaults[.overrideAdaptiveMode] = true
+                        CachedDefaults[.adaptiveBrightnessMode] = preservedAdaptiveMode
+                        pausedAdaptiveModeObserver = false
+                    }
+                }
+
+                restoreAdaptiveMode()
+                mainAsync {
+                    restoreAdaptiveMode()
+                }
+            }
         }
 
         #if arch(arm64)
```

---

### Incident Patch 6: `df5ee9fb` (2026-03-31)
**Commit Message**: Fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:c6d7e54cf37dc198643bc5dc9657b39f86387b7fc85343e525890535ee33be85
 Lunar/Modes/LocationMode.swift:9964ed4ba9098fc7a17c515a4ea5b9c128fc1d5cfba1deb7ac11a75cef3e7702
-Lunar/Data/Pro.swift:780cbee7d0d0d271705323558d6d3584eab5b7832b8c48331875d17d84f957a4
+Lunar/Data/Pro.swift:36799f95e018b63fe9507065dcea5296f7608aec4055dce4d3775eb20dc9088a
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +6/-14)
```diff
@@ -309,6 +309,7 @@
 		C7545E3125B1996300383AFB /* PopUpButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopUpButton.swift; sourceTree = "<group>"; };
 		C7574F802354691700358397 /* gencode.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = gencode.sh; path = bin/gencode.sh; sourceTree = "<group>"; };
 		C7574F812354691700358397 /* buildscript.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = buildscript.sh; path = bin/buildscript.sh; sourceTree = "<group>"; };
+		C7605FC72F7AB7040087B195 /* FuzzyMatcher */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = FuzzyMatcher; path = /Users/alin/Github/alin23/FuzzyMatcher; sourceTree = "<absolute>"; };
 		C76168F929B8B79F00D0A33A /* Bridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = Bridge.h; sourceTree = "<group>"; };
 		C76168FB29B8B91C00D0A33A /* SidecarCore.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = SidecarCore.framework; path = ../../../../../System/Library/PrivateFrameworks/SidecarCore.framework; sourceTree = "<group>"; };
 		C762AAE8271F3D6200198EDA /* ColorsPopoverController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ColorsPopoverController.swift; sourceTree = "<group>"; };
@@ -708,6 +709,7 @@
 		C7AEC7EC1FD0B4350039B562 = {
 			isa = PBXGroup;
 			children = (
+				C7605FC72F7AB7040087B195 /* FuzzyMatcher */,
 				C705A03B268B4187001ABBA9 /* Packages */,
 				C73B41F3263BE46F006F6783 /* Localization */,
 				C7574F7F235468EE00358397 /* Scripts */,
@@ -985,7 +987,6 @@
 				C77C77562812AA80006326BE /* XCRemoteSwiftPackageReference "SwiftUI-Introspect" */,
 				C7BD5F83287B44130077CCB7 /* XCRemoteSwiftPackageReference "Charts" */,
 				C744D07A2B434605003D77DE /* XCRemoteSwiftPackageReference "sentry-cocoa" */,
-				C7160EBE2BBACBDF000F83F2 /* XCRemoteSwiftPackageReference "FuzzyMatcher" */,
 				C788DCEB2F5F615400107F11 /* XCRemoteSwiftPackageReference "MacModelDB" */,
 			);
 			productRefGroup = C7AEC7F61FD0B4350039B562 /* Products */;
@@ -1320,7 +1321,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.10;
+				CURRENT_PROJECT_VERSION = 6.10.0;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1352,7 +1353,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.10;
+				MARKETING_VERSION = 6.10.0;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1386,7 +1387,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.10;
+				CURRENT_PROJECT_VERSION = 6.10.0;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1417,7 +1418,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.10;
+				MARKETING_VERSION = 6.10.0;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1510,14 +1511,6 @@
 				kind = branch;
 			};
 		};
-		C7160EBE2BBACBDF000F83F2 /* XCRemoteSwiftPackageReference "FuzzyMatcher" */ = {
-			isa = XCRemoteSwiftPackageReference;
-			repositoryURL = "https://github.com/alin23/FuzzyMatcher";
-			requirement = {
-				branch = main;
-				kind = branch;
-			};
-		};
 		C73B9A0B25FB9AD7003184FC /* XCRemoteSwiftPackageReference "Glob" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/Bouke/Glob";
@@ -1702,7 +1695,6 @@
 		};
 		C7160EBF2BBACBDF000F83F2 /* FuzzyMatcher */ = {
 			isa = XCSwiftPackageProductDependency;
-			
```

**File**: `Lunar.xcodeproj/xcuserdata/alin.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
 			<key>isShown</key>
 			<true/>
 			<key>orderHint</key>
-			<integer>1</integer>
+			<integer>0</integer>
 		</dict>
 		<key>LunarPlayground (Playground) 1.xcscheme</key>
 		<dict>
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +248/-256)
```diff
@@ -1,258 +1,250 @@
 {
-  "originHash" : "435149211245f4824d9f225087cd780270ae83e188eacd4398189990aeb6023d",
-  "pins" : [
-    {
-      "identity" : "anycodable",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Flight-School/AnyCodable",
-      "state" : {
-        "revision" : "862808b2070cd908cb04f9aafe7de83d35f81b05",
-        "version" : "0.6.7"
-      }
-    },
-    {
-      "identity" : "axswift",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/AXSwift",
-      "state" : {
-        "branch" : "main",
-        "revision" : "055c6abb49bb86c8d700da74d834523b03b4d702"
-      }
-    },
-    {
-      "identity" : "bluesocket",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/BlueSocket",
-      "state" : {
-        "branch" : "master",
-        "revision" : "4e334a848f89c44b2348332f0996f312dc6ed0d2"
-      }
-    },
-    {
-      "identity" : "charts",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/Charts/",
-      "state" : {
-        "branch" : "master",
-        "revision" : "27af8f086176bbaabb2bfcd53005bf8e0647a296"
-      }
-    },
-    {
-      "identity" : "datacompression",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/mw99/DataCompression/",
-      "state" : {
-        "revision" : "16f858982a077451ce3bdbd9144d3073ec85b6e4",
-        "version" : "3.9.0"
-      }
-    },
-    {
-      "identity" : "defaults",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/sindresorhus/Defaults",
-      "state" : {
-        "revision" : "3efef5a28ebdbbe922d4a2049493733ed14475a6",
-        "version" : "7.3.1"
-      }
-    },
-    {
-      "identity" : "fuzzymatcher",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/FuzzyMatcher",
-      "state" : {
-        "branch" : "main",
-        "revision" : "6c7628a46a566d64d6b7d79068c95bf80c8a6bd6"
-      }
-    },
-    {
-      "identity" : "glob",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Bouke/Glob",
-      "state" : {
-        "revision" : "deda6e163d2ff2a8d7e138e2c3326dbd71157faf",
-        "version" : "1.0.5"
-      }
-    },
-    {
-      "identity" : "keyholder",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/KeyHolder",
-      "state" : {
-        "branch" : "master",
-        "revision" : "4cbb7eaa0b9ba245d33e9cf176f2b70c778f2784"
-      }
-    },
-    {
-      "identity" : "macmodeldb",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/MacModelDB",
-      "state" : {
-        "revision" : "7a529050731855763504809820395484669458c2",
-        "version" : "1.0.2"
-      }
-    },
-    {
-      "identity" : "magnet",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/Magnet",
-      "state" : {
-        "branch" : "dev",
-        "revision" : "a21e6c4fd0fdb0244009e7c1fce64b31a01c39ca"
-      }
-    },
-    {
-      "identity" : "mediakeytap",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/MediaKeyTap",
-      "state" : {
-        "branch" : "dev",
-        "revision" : "5b8ee686bc90d917cba4f029b47c2a8541a4f58d"
-      }
-    },
-    {
-      "identity" : "path.swift",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/mxcl/Path.swift",
-      "state" : {
-        "revision" : "8e355c28e9393c42e58b18c54cace2c42c98a616",
-        "version" : "1.4.1"
-      }
-    },
-    {
-      "identity" : "regex",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/crossroadlabs/Regex",
-      "state" : {
-        "revision" : "166728756082a9cac6e4aed3ebbce8e41cb3a945",
-        "version" : "1.2.0"
-      }
-    },
-    {
-      "identity" : "sauce",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github
```

**File**: `Lunar.xcworkspace/xcuserdata/alin.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +6/-6)
```diff
@@ -401,7 +401,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>2</integer>
+			<integer>5</integer>
 		</dict>
 		<key>LunarPlayground (Playground) 1.xcscheme</key>
 		<dict>
@@ -828,7 +828,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>15</integer>
+			<integer>3</integer>
 		</dict>
 		<key>PlaygroundChart (Playground) 1.xcscheme</key>
 		<dict>
@@ -1227,7 +1227,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>11</integer>
+			<integer>1</integer>
 		</dict>
 		<key>Surge (Playground) 1.xcscheme</key>
 		<dict>
@@ -1626,7 +1626,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>6</integer>
 		</dict>
 		<key>SwiftDate (Playground) 1.xcscheme</key>
 		<dict>
@@ -2025,7 +2025,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>8</integer>
+			<integer>4</integer>
 		</dict>
 		<key>SwiftyMarkdown (Playground) 1.xcscheme</key>
 		<dict>
@@ -2424,7 +2424,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>14</integer>
+			<integer>2</integer>
 		</dict>
 	</dict>
 </dict>
```

---

### Incident Patch 7: `dd3ee7f5` (2026-03-09)
**Commit Message**: Restore sub-zero dimming when the app restarts on crash or hang

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +0/-23)
```diff
@@ -894,7 +894,6 @@
 				C7AEC7F31FD0B4350039B562 /* Resources */,
 				C7AEC7F21FD0B4350039B562 /* Frameworks */,
 				C75083582222865F0020270E /* Embed Frameworks */,
-				C750F301299E47AE0004ECEF /* Run Script */,
 			);
 			buildRules = (
 			);
@@ -1024,28 +1023,6 @@
 		};
 /* End PBXResourcesBuildPhase section */
 
-/* Begin PBXShellScriptBuildPhase section */
-		C750F301299E47AE0004ECEF /* Run Script */ = {
-			isa = PBXShellScriptBuildPhase;
-			buildActionMask = 2147483647;
-			files = (
-			);
-			inputFileListPaths = (
-			);
-			inputPaths = (
-			);
-			name = "Run Script";
-			outputFileListPaths = (
-			);
-			outputPaths = (
-				"$(CODESIGNING_FOLDER_PATH)/Contents/_MASReceipt/receipt",
-			);
-			runOnlyForDeploymentPostprocessing = 0;
-			shellPath = /bin/sh;
-			shellScript = "mkdir -p \"$CODESIGNING_FOLDER_PATH/Contents/_MASReceipt\"\ntouch \"$CODESIGNING_FOLDER_PATH/Contents/_MASReceipt/receipt\"\n";
-		};
-/* End PBXShellScriptBuildPhase section */
-
 /* Begin PBXSourcesBuildPhase section */
 		C7AEC7F11FD0B4350039B562 /* Sources */ = {
 			isa = PBXSourcesBuildPhase;
```

**File**: `Lunar/Data/Display.swift` (modified, +18/-9)
```diff
@@ -689,6 +689,16 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
         if let possibleMaxNits, possibleMaxNits > 0, let control = control as? AppleNativeControl {
             control.updateNits()
         }
+
+        let name = name
+        if restarted, let sb = try container.decodeIfPresent(Float.self, forKey: .softwareBrightness), sb < 1 {
+            log.debug("Restoring software brightness \(sb) for \(name) in 3 seconds")
+            softwareBrightness = sb
+            softwareBrightnessRestorer = mainAsyncAfter(ms: 3000) { [weak self] in
+                log.debug("Applying restored software brightness \(sb) for \(name)")
+                self?.setIndependentSoftwareBrightness(sb)
+            }
+        }
     }
 
     init(
@@ -2886,6 +2896,7 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
             }
 
             setIndependentSoftwareBrightness(softwareBrightness, oldValue: oldValue)
+            save()
         }
     }
 
@@ -5402,18 +5413,9 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
                 }
             }
             .store(in: &observers)
-
-        #if DEBUG
-            if isTestID(id), name.contains("DELL") {
-                audioIdentifier = "~:AMS2_Aggregate:0"
-            }
-        #endif
     }
 
     func setupHotkeys() {
-        #if DEBUG
-            log.info("Trying to setup hotkeys for \(description)")
-        #endif
         guard active else { return }
 
         if let controller = hotkeyPopoverController {
@@ -6738,6 +6740,13 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
 
         return adaptive ? .lunar : .system
     }
+
+    private var softwareBrightnessRestorer: DispatchWorkItem? {
+        didSet {
+            oldValue?.cancel()
+        }
+    }
+
 }
 
 let DS_LOGGER = Logger(subsystem: "fyi.lunar.Lunar.DisplayServices", category: "default")
```

**File**: `Lunar/SwiftUIViews/DisplayRowView.swift` (modified, +2/-2)
```diff
@@ -443,7 +443,7 @@ struct DisplayRowView: View {
         VStack(spacing: 2) {
             let showInput = display.hasDDC && showInputInQuickActions
             let showAdditionalUI = display.showOrientation || display.appPreset != nil || display.adaptivePaused
-                || showRawValues && (display.lastRawBrightness != nil || display.lastRawContrast != nil || display.lastRawVolume != nil)
+                || showRawValues && (display.usesDDCBrightnessControl && (display.lastRawBrightness != nil || display.lastRawContrast != nil || display.lastRawVolume != nil))
                 || SWIFTUI_PREVIEW
 
             if showInput, !showAdditionalUI {
@@ -469,7 +469,7 @@ struct DisplayRowView: View {
                             }
                     }
 
-                    if showRawValues {
+                    if showRawValues, display.usesDDCBrightnessControl {
                         RawValuesView(display: display).frame(width: 220).padding(.vertical, 3)
                     }
                 }
```

**File**: `ReleaseNotes/6.9.10.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Fixes
+
+- Hide raw values on non-DDC monitors
+- Restore sub-zero dimming when the app restarts on crash or hang
```

---

### Incident Patch 8: `6259e837` (2026-02-22)
**Commit Message**: XDR fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:bf91c99c5a12d0c19b5b5a887344e2c4cbdab4f9551c8d8f5baf30c0968cffc1
+Lunar/Data/Pro.swift:87271fc9df10953cd8ea301bf90e3d364f045a52b9690ca9376c7e5281c5e581
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1343,7 +1343,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.7;
+				CURRENT_PROJECT_VERSION = 6.9.8;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1375,7 +1375,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.7;
+				MARKETING_VERSION = 6.9.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1409,7 +1409,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.7;
+				CURRENT_PROJECT_VERSION = 6.9.8;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1440,7 +1440,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.7;
+				MARKETING_VERSION = 6.9.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -132,8 +132,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "de66bd4fa0661c81455e8ad2509ed6f0e39025dc",
-        "version" : "9.2.0"
+        "revision" : "c97459fd75243c620a09a1e6219e63aaec37555e",
+        "version" : "9.5.0"
       }
     },
     {
```

**File**: `Lunar/AppDelegate.swift` (modified, +14/-0)
```diff
@@ -294,6 +294,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
 
     var wakeObserver: Cancellable?
     var screenObserver: Cancellable?
+    var activationPolicyBeforeModal: NSApplication.ActivationPolicy?
 
     lazy var updater = SPUUpdater(
         hostBundle: Bundle.main,
@@ -496,6 +497,19 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
         UM.newVersion = update.displayVersionString
     }
 
+    func standardUserDriverWillShowModalAlert() {
+        activationPolicyBeforeModal = NSApp.activationPolicy()
+        NSApp.setActivationPolicy(.regular)
+        NSApp.activate(ignoringOtherApps: true)
+    }
+
+    func standardUserDriverDidShowModalAlert() {
+        if let policy = activationPolicyBeforeModal {
+            NSApp.setActivationPolicy(policy)
+            activationPolicyBeforeModal = nil
+        }
+    }
+
     func standardUserDriverWillFinishUpdateSession() {
         // We will dismiss our gentle UI indicator if the user session for the update finishes
         UM.newVersion = nil
```

**File**: `Lunar/Data/Display.swift` (modified, +2/-2)
```diff
@@ -1666,8 +1666,8 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
         p
             .debounce(for: .milliseconds(5000), scheduler: RunLoop.main)
             .sink { [weak self] shouldPause in
-                guard let self, shouldPause, ambientLightCompensationEnabledByUser else { return }
-                systemAdaptiveBrightness = true
+                // guard let self, shouldPause, ambientLightCompensationEnabledByUser else { return }
+                // systemAdaptiveBrightness = true
             }.store(in: &observers)
 
         return p
```

---

### Incident Patch 9: `93c4daf3` (2026-02-11)
**Commit Message**: Remove preset unlock and fix hang detection

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:6a364026f1906b8c1767bc20e8606e12f77a5a37095eff75c074250b04b30957
+Lunar/Data/Pro.swift:a6a6285043dfe783791dc2b23a769eb54f0f0ec871cf754da3652a4e143a0bcc
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar/ErrorReports.swift` (modified, +62/-9)
```diff
@@ -1,3 +1,4 @@
+import Cocoa
 import Combine
 import Defaults
 import Sentry
@@ -32,11 +33,11 @@ private final class RepeatingHang {
 
     lazy var count: Int = RepeatingHangState.count(cause: cause, now: Date().timeIntervalSince1970)
 
-    func isCulprit() -> Bool {
-        guard let stackSymbols = Thread.callStackSymbols.first(where: { $0.contains(expectedStackFrame) }) else {
+    func isCulprit(mainThreadStack: String) -> Bool {
+        guard mainThreadStack.contains(expectedStackFrame) else {
             return false
         }
-        log.warning("Hang detected with expected stack frame '\(expectedStackFrame)': \(stackSymbols)")
+        log.warning("Hang detected with expected stack frame '\(expectedStackFrame)' in main thread sample")
         return true
     }
 
@@ -93,10 +94,11 @@ private enum RepeatingHangState {
     }
 }
 
-private let appHangStateQueue = DispatchQueue(label: "com.lunar.appHangDetection.state")
+private let appHangStateQueue = DispatchQueue(label: "fyi.lunar.appHangDetection.state")
 @MainActor private var appHangTimer: DispatchSourceTimer?
 private var lastMainThreadCheckin: TimeInterval = 0
 private var appHangTriggered = false
+private var sleeping = false
 
 @MainActor var enableSentryObserver: Cancellable?
 
@@ -171,7 +173,7 @@ private var appHangTriggered = false
         var shouldTrigger = false
 
         appHangStateQueue.sync {
-            if !appHangTriggered, now - lastMainThreadCheckin > APP_HANG_DETECTION_INTERVAL {
+            if !appHangTriggered, !sleeping, now - lastMainThreadCheckin > APP_HANG_DETECTION_INTERVAL {
                 appHangTriggered = true
                 shouldTrigger = true
             }
@@ -189,17 +191,68 @@ private var appHangTriggered = false
     }
     appHangTimer = timer
     timer.resume()
+
+    let nc = NSWorkspace.shared.notificationCenter
+    nc.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: nil) { _ in
+        appHangStateQueue.sync {
+            lastMainThreadCheckin = Date().timeIntervalSince1970
+            sleeping = true
+            appHangTriggered = false
+        }
+    }
+    nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: nil) { _ in
+        let now = Date().timeIntervalSince1970
+        appHangStateQueue.sync {
+            lastMainThreadCheckin = now
+            sleeping = false
+            appHangTriggered = false
+        }
+    }
+}
+
+private func sampleMainThread() -> String? {
+    let result = shell("/usr/bin/sample", args: ["\(getpid())", "0.001"], timeout: 5.seconds)
+    guard let output = result.o, result.success else { return nil }
+
+    var mainThreadLines: [String] = []
+    var inMainThread = false
+
+    for line in output.components(separatedBy: "\n") {
+        if line.contains("com.apple.main-thread") {
+            inMainThread = true
+            mainThreadLines.append(line)
+            continue
+        }
+
+        guard inMainThread else { continue }
+
+        let trimmed = line.trimmingCharacters(in: .whitespaces)
+        if trimmed.isEmpty || line.contains("Thread_") || trimmed.hasPrefix("Total number") || trimmed.hasPrefix("Sort by") {
+            break
+        }
+        mainThreadLines.append(line)
+    }
+
+    return mainThreadLines.isEmpty ? nil : mainThreadLines.joined(separator: "\n")
 }
 
 func onAppHangDetected() {
     log.warning("App Hanging!")
-    log.traceCalls()
+
+    let mainThreadStack = sampleMainThread()
+    if let mainThreadStack {
+        log.warning("Main thread sample:\n\(mainThreadStack)")
+    } else {
+        log.warning("Failed to sample main thread")
+    }
 
     if Defaults[.autoRestartOnHang] {
         let now = Date().timeIntervalSince1970
-        appHangStateQueue.async {
-            if let hang = RepeatingHangState.hangs.values.first(where: { $0.isCulprit() }) {
-                RepeatingHangState.record(cause: hang.cause, at: now)
+        if let mainThreadStack {
+            appHang
```

**File**: `Lunar/SwiftUIViews/DisplayRowView.swift` (modified, +5/-3)
```diff
@@ -629,10 +629,12 @@ struct DisplayRowView: View {
         Text("Brightness locked by preset").font(.system(size: 10, weight: .semibold, design: .rounded))
         if let name = display.referencePreset?.presetName {
             Menu(name) {
-                SwiftUI.Button("Unlock \"\(name)\"") {
-                    display.panel?.unlockActivePreset()
+                if !MAC26POINT3 {
+                    SwiftUI.Button("Unlock \"\(name)\"") {
+                        display.panel?.unlockActivePreset()
+                    }
+                    Divider()
                 }
-                Divider()
 
                 let presets = display.panelPresets.filter(\.isValid)
                 let groups = Set(presets.map(\.presetGroup)).sorted()
```

**File**: `LunarShortcuts/LunarShortcuts.swift` (modified, +6/-6)
```diff
@@ -2704,22 +2704,22 @@ struct SetPanelPresetIntent: AppIntent {
         })
     }
 
-    @Parameter(title: "Unlock brightness control")
+    @Parameter(title: "Unlock brightness control (unavailable on macOS 26.3 and later)")
     var unlockBrightnessControl: Bool
 
-    @Parameter(title: "Unlock Adaptive Brightness")
+    @Parameter(title: "Unlock Adaptive Brightness (unavailable on macOS 26.3 and later)")
     var unlockAdaptiveBrightness: Bool
 
-    @Parameter(title: "Unlock Night Shift")
+    @Parameter(title: "Unlock Night Shift (unavailable on macOS 26.3 and later)")
     var unlockNightShift: Bool
 
-    @Parameter(title: "Unlock True Tone")
+    @Parameter(title: "Unlock True Tone (unavailable on macOS 26.3 and later)")
     var unlockTrueTone: Bool
 
-    @Parameter(title: "Min brightness (in nits)", default: 4, inclusiveRange: (1, 500))
+    @Parameter(title: "Min brightness (in nits) (unavailable on macOS 26.3 and later)", default: 4, inclusiveRange: (1, 500))
     var minBrightness: Int
 
-    @Parameter(title: "Max brightness (in nits)", default: 500, inclusiveRange: (50, 500))
+    @Parameter(title: "Max brightness (in nits) (unavailable on macOS 26.3 and later)", default: 500, inclusiveRange: (50, 500))
     var maxBrightness: Int
 
     @Parameter(title: "Screen Preset")
```

**File**: `ReleaseNotes/6.9.7.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Fixes
+
+- Remove **Unlock preset** functionality on macOS 26.3 and later since it no longer works
+- Fix hang detection not getting the right callstack
```

---

### Incident Patch 10: `11d3d9e3` (2025-11-07)
**Commit Message**: License code UI fixe

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:dad132128e91631cacf5b7b90f70acf3ff64ed9c9ca304355ef73995672fafb1
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:9e84393e9c32dd1baef6911d6440cabe45d066583c4b4d48780fe699fa440a40
+Lunar/Data/Pro.swift:edf17b2556de936c1facf35eb553960c36037acdb431427ef856508e03270d99
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar/AppDelegate.swift` (modified, +18/-0)
```diff
@@ -2503,6 +2503,24 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
         if !thisIsFirstRun {
             DC.askAboutXDR(migration: true)
         }
+        NotificationCenter.default.addObserver(self, selector: #selector(windowDidBecomeMainNotification), name: NSWindow.didBecomeMainNotification, object: nil)
+    }
+
+    @objc func windowDidBecomeMainNotification(_ notification: Notification) {
+        guard let window = notification.object as? NSWindow else { return }
+
+        if let paddleController = window.windowController as? PADActivateWindowController,
+           let email = paddleController.emailTxt, let licenseCode = paddleController.licenseTxt
+        {
+            email.isBordered = true
+            licenseCode.isBordered = true
+
+            email.drawsBackground = true
+            licenseCode.drawsBackground = true
+
+            email.backgroundColor = .black.withAlphaComponent(0.05)
+            licenseCode.backgroundColor = .black.withAlphaComponent(0.05)
+        }
     }
 
     @IBAction func toggleCleaningMode(_: Any) {
```

**File**: `ReleaseNotes/6.9.5.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## Fixes
+
+- Work around macOS issue where the license code text field is not visible until clicked
+
 ## Improvements
 
 - Allow pausing/unpausing adaptive brightness via a new `adaptivePaused` property using the CLI or Shortcuts
```

#### Recent Merged Pull Requests:
- **PR #515** (2023-12-08): Add CLI install location to succcessful print statement (@dcchambers)
- **PR #514** (2023-07-01): fix: bump platformio/espressif to 5.3.0 to maintain darwin_arm64 compatibility (@pcnc)
- **PR #436** (2022-02-09): Fix spelling (@jordanekay)
- **PR #312** (2021-04-29): Add a Gitter chat badge to README.md (@gitter-badger)
- **PR #237** (2020-12-26): Fix installation instructions in README.md (@kawarimidoll)
- **PR #14** (closed): Animate brightness/contrast transitions (@timtraversy)
- **PR #3** (2018-08-07): updated readme (@duongel)
- **PR #2** (2018-08-06): Feature/manual controls (@duongel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
