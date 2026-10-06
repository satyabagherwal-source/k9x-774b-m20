# Forensic Learning Record (Deep Inspection): MariaDB/server

> **Canonical Artifact**: `07_PROJECT_LEARNING/mariadb-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MariaDB/server](https://github.com/MariaDB/server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:29.513Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MariaDB/server`
- **Description**: MariaDB server is a community developed fork of MySQL server. Started by core members of the original MySQL team, MariaDB actively works with outside developers to deliver the most featureful, stable, and sanely licensed open SQL server in the industry.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8320 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/import_util.h`
```
/*
   Copyright (c) 2024, MariaDB

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335  USA
*/

#pragma once
#include <string>
#include <vector>

/* TABLE DDL INFO - representation of parsed CREATE TABLE Statement */

enum class KeyOrConstraintType
{
  CONSTRAINT,
  INDEX,
  UNKNOWN
};

/**
 *  Struct representing a table key or constraint definition
 */
struct KeyDefinition
{
  /** Full key or constraint definition string,
  e.g  UNIQUE KEY `uniq_idx` (`col`) */
  std::string definition;
  /** The name of key or constraint, including escape chars */
  std::string name;
};

/**
   Information about keys and constraints, extracted from
   CREATE TABLE statement
 */
struct TableDDLInfo
{
  TableDDLInfo(const std::string &create_table_stmt);
  KeyDefinition primary_key;
  std::vector<KeyDefinition> constraints;
  std::vector<KeyDefinition> secondary_indexes;
  std::string storage_engine;
  std::string table_name;
  /* Innodb is using first UNIQUE key for clustering, if no PK is set*/
  std::string non_pk_clustering_key_name;

  /**
    Generate ALTER TABLE ADD/DROP statements for keys or constraints.
    The goal is to remove indexes/constraints before the data is imported
    and recreate them after import.
    PRIMARY key is not affected by these operations
  */
  std::string generate_alter_add(const std::vector<KeyDefinition> &defs,
                                 KeyOrConstraintType type) const;
  std::string generate_alter_drop(const std::vector<KeyDefinition> &defs,
                                  KeyOrConstraintType type) const;


  std::string drop_constraints_sql() const
  {
    return generate_alter_drop(constraints, KeyOrConstraintType::CONSTRAINT);
  }
  std::string add_constraints_sql() const
  {
    return generate_alter_add(constraints, KeyOrConstraintType::CONSTRAINT);
  }
  std::string drop_secondary_indexes_sql() const
  {
    return generate_alter_drop(secondary_indexes,
                               KeyOrConstraintType::INDEX);
  }
  std::string add_secondary_indexes_sql() const
  {
    return generate_alter_add(secondary_indexes,
                              KeyOrConstraintType::INDEX);
  }
};
std::string extract_first_create_table(const std::string &script);

```

### Core Architecture Module: `client/mysqlbinlog-engine.h`
```
/* Copyright (c) 2025, Kristian Nielsen.

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335  USA */

#include <stdint.h>
#include <atomic>

#include "handler_binlog_reader.h"


static constexpr uint32_t BINLOG_HEADER_PAGE_SIZE= 512;
static constexpr uint32_t BINLOG_PAGE_SIZE= ((uint32_t)1 << 14);
extern const char *INNODB_BINLOG_MAGIC;

extern handler_binlog_reader *get_binlog_reader_innodb();
extern bool open_engine_binlog(handler_binlog_reader *reader,
                               ulonglong start_position,
                               const char *filename, IO_CACHE *opened_cache);


/* Shared functions defined in mysqlbinlog.cc */
extern void error(const char *format, ...) ATTRIBUTE_FORMAT(printf, 1, 2);

```

### Core Architecture Module: `extra/mariabackup/common_engine.h`
```
#pragma once
#include "my_global.h"
#include "backup_mysql.h"
#include "datasink.h"
#include "thread_pool.h"
#include "xtrabackup.h"

#include <unordered_set>
#include <string>
#include <vector>

namespace common_engine {

class BackupImpl;

class Backup {
	public:
		Backup(const char *datadir_path, ds_ctxt_t *datasink,
				std::vector<MYSQL *> &con_pool, ThreadPool &thread_pool);
		~Backup();
		Backup (Backup &&other) = delete;
		Backup & operator= (Backup &&other) = delete;
		Backup(const Backup &) = delete;
		Backup & operator= (const Backup &) = delete;
		bool scan(
				const std::unordered_set<table_key_t> &exclude_tables,
				std::unordered_set<table_key_t> *out_processed_tables,
				bool no_lock, bool collect_log_and_stats);
		bool copy_log_tables(bool finalize);
		bool copy_stats_tables();
		bool copy_engine_binlogs(const char *binlog_dir, lsn_t backup_lsn);
		bool wait_for_finish();
		bool close_log_tables();
		void set_post_copy_table_hook(const post_copy_table_hook_t &hook);
	private:
		BackupImpl *m_backup_impl;
};

} // namespace common_engine


```

### Core Architecture Module: `extra/readline/mbutil.c`
```
/* mbutil.c -- readline multibyte character utility functions */

/* Copyright (C) 2001-2005 Free Software Foundation, Inc.

   This file is part of the GNU Readline Library, a library for
   reading lines of text with interactive input and history editing.

   The GNU Readline Library is free software; you can redistribute it
   and/or modify it under the terms of the GNU General Public License
   as published by the Free Software Foundation; either version 2, or
   (at your option) any later version.

   The GNU Readline Library is distributed in the hope that it will be
   useful, but WITHOUT ANY WARRANTY; without even the implied warranty
   of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   The GNU General Public License is often shipped with GNU software, and
   is generally kept in a file called COPYING or LICENSE.  If you do not
   have a copy of the license, write to the Free Software Foundation,
   51 Franklin Street, Fifth Floor, Boston, MA  02110-1335  USA. */
#define READLINE_LIBRARY

#if defined (HAVE_CONFIG_H)
#  include "config_readline.h"
#endif

#include <sys/types.h>
#include <fcntl.h>
#include "posixjmp.h"

#if defined (HAVE_UNISTD_H)
#  include <unistd.h>	   /* for _POSIX_VERSION */
#endif /* HAVE_UNISTD_H */

#if defined (HAVE_STDLIB_H)
#  include <stdlib.h>
#else
#  include "ansi_stdlib.h"
#endif /* HAVE_STDLIB_H */

#include <stdio.h>
#include <ctype.h>

/* System-specific feature definitions and include files. */
#include "rldefs.h"
#include "rlmbutil.h"

#if defined (TIOCSTAT_IN_SYS_IOCTL)
#  include <sys/ioctl.h>
#endif /* TIOCSTAT_IN_SYS_IOCTL */

/* Some standard library routines. */
#include "readline.h"

#include "rlprivate.h"
#include "xmalloc.h"

/* Declared here so it can be shared between the readline and history
   libraries. */
#if defined (HANDLE_MULTIBYTE)
int rl_byte_oriented = 0;
#else
int rl_byte_oriented = 1;
#endif

/* **************************************************************** */
/*								    */
/*		Multibyte Character Utility Functions		    */
/*								    */
/* **************************************************************** */

#if defined(HANDLE_MULTIBYTE)

static int
_rl_find_next_mbchar_internal (string, seed, count, find_non_zero)
     char *string;
     int seed, count, find_non_zero;
{
  size_t tmp;
  mbstate_t ps;
  int point;
  wchar_t wc;

  tmp = 0;

  memset(&ps, 0, sizeof (mbstate_t));
  if (seed < 0)
    seed = 0;
  if (count <= 0)
    return seed;

  point = seed + _rl_adjust_point (string, seed, &ps);
  /* if this is true, means that seed was not pointed character
     started byte.  So correct the point and consume count */
  if (seed < point)
    count--;

  while (count > 0)  
    {
      tmp = mbrtowc (&wc, string+point, strlen(string + point), &ps);
      if (MB_INVALIDCH ((size_t)tmp))
	{
	  /* invalid bytes. asume a byte represents a character */
	  point++;
	  count--;
	  /* reset states. */
	  memset(&ps, 0, sizeof(mbstate_t));
	}
      else if (MB_NULLWCH (tmp))
	break;			/* found wide '\0' */
      else
	{
	  /* valid bytes */
	  point += tmp;
	  if (find_non_zero)
	    {
	      if (wcwidth (wc) == 0)
		continue;
	      else
		count--;
	    }
	  else
	    count--;
	}
    }

  if (find_non_zero)
    {
      tmp = mbrtowc (&wc, string + point, strlen (string + point), &ps);
      while (tmp > 0 && wcwidth (wc) == 0)
	{
	  point += tmp;
	  tmp = mbrtowc (&wc, string + point, strlen (string + point), &ps);
	  if (MB_NULLWCH (tmp) || MB_INVALIDCH (tmp))
	    break;
	}
    }

  return point;
}

static int
_rl_find_prev_mbchar_internal (string, seed, find_non_zero)
     char *string;
     int seed, find_non_zero;
{
  mbstate_t ps;
  int prev, non_zero_prev, point, length;
  size_t tmp;
  wchar_t wc;

  memset(&ps, 0, sizeof(mbstate_t));
  length = strlen(string);
  
  if (seed < 0)
    return 0;
  else if (length < seed)
    return length;

  prev = non_zero_prev = point = 0;
  while (point < seed)
    {
      tmp = mbrtowc (&wc, string + point, length - point, &ps);
      if (MB_INVALIDCH ((size_t)tmp))
	{
	  /* in this case, bytes are invalid or shorted to compose
	     multibyte char, so assume that the first byte represents
	     a single character anyway. */
	  tmp = 1;
	  /* clear the state of the byte sequence, because
	     in this case effect of mbstate is undefined  */
	  memset(&ps, 0, sizeof (mbstate_t));

	  /* Since we're assuming that this byte represents a single
	     non-zero-width character, don't forget about it. */
	  prev = point;
	}
      else if (MB_NULLWCH (tmp))
	break;			/* Found '\0' char.  Can this happen? */
      else
	{
	  if (find_non_zero)
	    {
	      if (wcwidth (wc) != 0)
		prev = point;
	    }
	  else
	    prev = point;  
	}

      point += tmp;
    }

  return prev;
}

/* return the number of bytes parsed from the multibyte sequence starting
   at src, if a non-L'\0' wide character was recognized. It returns 0, 
   if a L'\0' wide character was recognized. It  returns (size_t)(-1), 
   if an invalid multibyte sequence was encountered. It returns (size_t)(-2) 
   if it couldn't parse a complete  multibyte character.  */
int
_rl_get_char_len (src, ps)
     char *src;
     mbstate_t *ps;
{
  size_t tmp;

  tmp = mbrlen((const char *)src, (size_t)strlen (src), ps);
  if (tmp == (size_t)(-2))
    {
      /* shorted to compose multibyte char */
      if (ps)
	memset (ps, 0, sizeof(mbstate_t));
      return -2;
    }
  else if (tmp == (size_t)(-1))
    {
      /* invalid to compose multibyte char */
      /* initialize the conversion state */
      if (ps)
	memset (ps, 0, sizeof(mbstate_t));
      return -1;
    }
  else if (tmp == (size_t)0)
    return 0;
  else
    return (int)tmp;
}

/* compare the specified two characters. If the characters matched,
   return 1. Otherwise return 0. */
int
_rl_compare_chars (buf1, pos1, ps1, buf2, pos2, ps2)
     char *buf1;
     int pos1;
     mbstate_t *ps1;
     char *buf2;
     int pos2;
     mbstate_t *ps2;
{
  int i, w1, w2;

  if ((w1 = _rl_get_char_len (&buf1[pos1], ps1)) <= 0 || 
	(w2 = _rl_get_char_len (&buf2[pos2], ps2)) <= 0 ||
	(w1 != w2) ||
	(buf1[pos1] != buf2[pos2]))
    return 0;

  for (i = 1; i < w1; i++)
    if (buf1[pos1+i] != buf2[pos2+i])
      return 0;

  return 1;
}

/* adjust pointed byte and find mbstate of the point of string.
   adjusted point will be point <= adjusted_point, and returns
   differences of the byte(adjusted_point - point).
   if point is invalied (point < 0 || more than string length),
   it returns -1 */
int
_rl_adjust_point(string, point, ps)
     char *string;
     int point;
     mbstate_t *ps;
{
  size_t tmp = 0;
  int length;
  int pos = 0;

  length = strlen(string);
  if (point < 0)
    return -1;
  if (length < point)
    return -1;
  
  while (pos < point)
    {
      tmp = mbrlen (string + pos, length - pos, ps);
      if (MB_INVALIDCH ((size_t)tmp))
	{
	  /* in this case, bytes are invalid or shorted to compose
	     multibyte char, so assume that the first byte represents
	     a single character anyway. */
	  pos++;
	  /* clear the state of the byte sequence, because
	     in this case effect of mbstate is undefined  */
	  if (ps)
	    memset (ps, 0, sizeof (mbstate_t));
	}
      else if (MB_NULLWCH (tmp))
	pos++;
      else
	pos += tmp;
    }

  return (pos - point);
}

int
_rl_is_mbchar_matched (string, seed, end, mbchar, length)
     char *string;
     int seed, end;
     char *mbchar;
     int length;
{
  int i;

  if ((end - seed) < length)
    return 0;

  for (i = 0; i < length; i++)
    if (string[seed + i] != mbchar[i])
      return 0;
  return 1;
}

wchar_t
_rl_char_value (buf, ind)
     char *buf;
     int ind;
{
  size_t tmp;
  wchar_t wc;
  mbstate_t ps;
  int l;

  if (MB_LEN_MAX == 1 || rl_byte_oriented)
    return ((wchar_t) buf[ind]);
  l = strlen (buf);
  if (ind >= l - 1)
    return ((wchar_t) buf[ind]);
  memset (&ps, 0, sizeof (mbstate_t));
  tmp = mbrtowc (&wc, buf + ind, l - ind, &ps);
  if (MB_INVALIDCH (tmp) || MB_NULLWCH (tmp))  
    return ((wchar_t) buf[ind]);
  return wc;
}
#endif /* HANDLE_MULTIBYTE */

/* Find next `count' characters started byte point of the specified seed.
   If flags is MB_FIND_NONZERO, we look for non-zero-width multibyte
   characters. */
#undef _rl_find_next_mbchar
int
_rl_find_next_mbchar (string, seed, count, flags)
     char *string __attribute__((unused));
     int seed, count, flags __attribute__((unused));
{
#if defined (HANDLE_MULTIBYTE)
  return _rl_find_next_mbchar_internal (string, seed, count, flags);
#else
  return (seed + count);
#endif
}

/* Find previous character started byte point of the specified seed.
   Returned point will be point <= seed.  If flags is MB_FIND_NONZERO,
   we look for non-zero-width multibyte characters. */
#undef _rl_find_prev_mbchar
int
_rl_find_prev_mbchar (string, seed, flags)
     char *string __attribute__((unused));
     int seed, flags __attribute__((unused));
{
#if defined (HANDLE_MULTIBYTE)
  return _rl_find_prev_mbchar_internal (string, seed, flags);
#else
  return ((seed == 0) ? seed : seed - 1);
#endif
}

```

### Core Architecture Module: `extra/readline/rlmbutil.h`
```
/* rlmbutil.h -- utility functions for multibyte characters. */

/* Copyright (C) 2001 Free Software Foundation, Inc.

   This file is part of the GNU Readline Library, a library for
   reading lines of text with interactive input and history editing.

   The GNU Readline Library is free software; you can redistribute it
   and/or modify it under the terms of the GNU General Public License
   as published by the Free Software Foundation; either version 2, or
   (at your option) any later version.

   The GNU Readline Library is distributed in the hope that it will be
   useful, but WITHOUT ANY WARRANTY; without even the implied warranty
   of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   The GNU General Public License is often shipped with GNU software, and
   is generally kept in a file called COPYING or LICENSE.  If you do not
   have a copy of the license, write to the Free Software Foundation,
   51 Franklin Street, Fifth Floor, Boston, MA  02110-1335  USA. */

#if !defined (_RL_MBUTIL_H_)
#define _RL_MBUTIL_H_

#include "rlstdc.h"

/************************************************/
/* check multibyte capability for I18N code     */
/************************************************/

/* For platforms which support the ISO C amendement 1 functionality we
   support user defined character classes.  */
   /* Solaris 2.5 has a bug: <wchar.h> must be included before <wctype.h>.  */
#if defined (HAVE_WCTYPE_H) && defined (HAVE_WCHAR_H) && defined (HAVE_LOCALE_H)
#  include <wchar.h>
#  include <wctype.h>
#  if defined (HAVE_ISWCTYPE) && \
      defined (HAVE_ISWLOWER) && \
      defined (HAVE_ISWUPPER) && \
      defined (HAVE_MBSRTOWCS) && \
      defined (HAVE_MBRTOWC) && \
      defined (HAVE_MBRLEN) && \
      defined (HAVE_TOWLOWER) && \
      defined (HAVE_TOWUPPER) && \
      defined (HAVE_WCHAR_T) && \
      defined (HAVE_WCWIDTH)
     /* system is supposed to support XPG5 */
#    define HANDLE_MULTIBYTE      1
#  endif
#endif

/* If we don't want multibyte chars even on a system that supports them, let
   the configuring user turn multibyte support off. */
#if defined (NO_MULTIBYTE_SUPPORT)
#  undef HANDLE_MULTIBYTE
#endif

/* Some systems, like BeOS, have multibyte encodings but lack mbstate_t.  */
#if HANDLE_MULTIBYTE && !defined (HAVE_MBSTATE_T)
#  define wcsrtombs(dest, src, len, ps) (wcsrtombs) (dest, src, len, 0)
#  define mbsrtowcs(dest, src, len, ps) (mbsrtowcs) (dest, src, len, 0)
#  define wcrtomb(s, wc, ps) (wcrtomb) (s, wc, 0)
#  define mbrtowc(pwc, s, n, ps) (mbrtowc) (pwc, s, n, 0)
#  define mbrlen(s, n, ps) (mbrlen) (s, n, 0)
#  define mbstate_t int
#endif

/* Make sure MB_LEN_MAX is at least 16 on systems that claim to be able to
   handle multibyte chars (some systems define MB_LEN_MAX as 1) */
#ifdef HANDLE_MULTIBYTE
#  include <limits.h>
#  if defined(MB_LEN_MAX) && (MB_LEN_MAX < 16)
#    undef MB_LEN_MAX
#  endif
#  if !defined (MB_LEN_MAX)
#    define MB_LEN_MAX 16
#  endif
#endif

/************************************************/
/* end of multibyte capability checks for I18N  */
/************************************************/

/*
 * Flags for _rl_find_prev_mbchar and _rl_find_next_mbchar:
 *
 * MB_FIND_ANY		find any multibyte character
 * MB_FIND_NONZERO	find a non-zero-width multibyte character
 */

#define MB_FIND_ANY	0x00
#define MB_FIND_NONZERO	0x01

extern int _rl_find_prev_mbchar PARAMS((char *, int, int));
extern int _rl_find_next_mbchar PARAMS((char *, int, int, int));

#ifdef HANDLE_MULTIBYTE

extern int _rl_compare_chars PARAMS((char *, int, mbstate_t *, char *, int, mbstate_t *));
extern int _rl_get_char_len PARAMS((char *, mbstate_t *));
extern int _rl_adjust_point PARAMS((char *, int, mbstate_t *));

extern int _rl_read_mbchar PARAMS((char *, int));
extern int _rl_read_mbstring PARAMS((int, char *, int));

extern int _rl_is_mbchar_matched PARAMS((char *, int, int, char *, int));

extern wchar_t _rl_char_value PARAMS((char *, int));
extern int _rl_walphabetic PARAMS((wchar_t));

#define _rl_to_wupper(wc)	(iswlower (wc) ? (wchar_t)towupper (wc) : (wc))
#define _rl_to_wlower(wc)	(iswupper (wc) ? (wchar_t)towlower (wc) : (wc))

#define MB_NEXTCHAR(b,s,c,f) \
	((MB_CUR_MAX > 1 && rl_byte_oriented == 0) \
		? _rl_find_next_mbchar ((b), (s), (c), (f)) \
		: ((s) + (c)))
#define MB_PREVCHAR(b,s,f) \
	((MB_CUR_MAX > 1 && rl_byte_oriented == 0) \
		? _rl_find_prev_mbchar ((b), (s), (f)) \
		: ((s) - 1))

#define MB_INVALIDCH(x)		((x) == (size_t)-1 || (x) == (size_t)-2)
#define MB_NULLWCH(x)		((x) == 0)

#else /* !HANDLE_MULTIBYTE */

#undef MB_LEN_MAX
#undef MB_CUR_MAX

#define MB_LEN_MAX	1
#define MB_CUR_MAX	1

#define _rl_find_prev_mbchar(b, i, f)		(((i) == 0) ? (i) : ((i) - 1))
#define _rl_find_next_mbchar(b, i1, i2, f)	((i1) + (i2))

#define _rl_char_value(buf,ind)	((buf)[(ind)])

#define _rl_walphabetic(c)	(rl_alphabetic (c))

#define _rl_to_wupper(c)	(_rl_to_upper (c))
#define _rl_to_wlower(c)	(_rl_to_lower (c))

#define MB_NEXTCHAR(b,s,c,f)	((s) + (c))
#define MB_PREVCHAR(b,s,f)	((s) - 1)

#define MB_INVALIDCH(x)		(0)
#define MB_NULLWCH(x)		(0)

#endif /* !HANDLE_MULTIBYTE */

extern int rl_byte_oriented;

#endif /* _RL_MBUTIL_H_ */

```

### Core Architecture Module: `extra/readline/util.c`
```
/* util.c -- readline utility functions */

/* Copyright (C) 1987-2005 Free Software Foundation, Inc.

   This file is part of the GNU Readline Library, a library for
   reading lines of text with interactive input and history editing.

   The GNU Readline Library is free software; you can redistribute it
   and/or modify it under the terms of the GNU General Public License
   as published by the Free Software Foundation; either version 2, or
   (at your option) any later version.

   The GNU Readline Library is distributed in the hope that it will be
   useful, but WITHOUT ANY WARRANTY; without even the implied warranty
   of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   The GNU General Public License is often shipped with GNU software, and
   is generally kept in a file called COPYING or LICENSE.  If you do not
   have a copy of the license, write to the Free Software Foundation,
   51 Franklin Street, Fifth Floor, Boston, MA  02110-1335  USA. */
#define READLINE_LIBRARY

#if defined (HAVE_CONFIG_H)
#  include "config_readline.h"
#endif

#include <sys/types.h>
#include <fcntl.h>
#include "posixjmp.h"

#if defined (HAVE_UNISTD_H)
#  include <unistd.h>           /* for _POSIX_VERSION */
#endif /* HAVE_UNISTD_H */

#if defined (HAVE_STDLIB_H)
#  include <stdlib.h>
#else
#  include "ansi_stdlib.h"
#endif /* HAVE_STDLIB_H */

#include <stdio.h>
#include <ctype.h>

/* System-specific feature definitions and include files. */
#include "rldefs.h"
#include "rlmbutil.h"

#if defined (TIOCSTAT_IN_SYS_IOCTL)
#  include <sys/ioctl.h>
#endif /* TIOCSTAT_IN_SYS_IOCTL */

/* Some standard library routines. */
#include "readline.h"

#include "rlprivate.h"
#include "xmalloc.h"

/* **************************************************************** */
/*								    */
/*			Utility Functions			    */
/*								    */
/* **************************************************************** */

/* Return 0 if C is not a member of the class of characters that belong
   in words, or 1 if it is. */

int _rl_allow_pathname_alphabetic_chars = 0;
static const char *pathname_alphabetic_chars = "/-_=~.#$";

int
rl_alphabetic (c)
     int c;
{
  if (ALPHABETIC (c))
    return (1);

  return (_rl_allow_pathname_alphabetic_chars &&
	    strchr (pathname_alphabetic_chars, c) != NULL);
}

#if defined (HANDLE_MULTIBYTE)
int
/*
  Portability issue with VisualAge C++ Professional / C for AIX Compiler, Version 6:
    "util.c", line 84.1: 1506-343 (S) Redeclaration of _rl_walphabetic differs
    from previous declaration on line 110 of "rlmbutil.h".
  So, put type in the function signature here.
*/
_rl_walphabetic (wchar_t wc)
{
  int c;

  if (iswalnum (wc))
    return (1);     

  c = wc & 0177;
  return (_rl_allow_pathname_alphabetic_chars &&
	    strchr (pathname_alphabetic_chars, c) != NULL);
}
#endif

/* How to abort things. */
int
_rl_abort_internal ()
{
  rl_ding ();
  rl_clear_message ();
  _rl_reset_argument ();
  rl_clear_pending_input ();

  RL_UNSETSTATE (RL_STATE_MACRODEF);
  while (rl_executing_macro)
    _rl_pop_executing_macro ();

  rl_last_func = (rl_command_func_t *)NULL;
  longjmp (readline_top_level, 1);
  return (0);
}

int
rl_abort (count, key)
     int count __attribute__((unused)), key __attribute__((unused));
{
  return (_rl_abort_internal ());
}

int
rl_tty_status (count, key)
     int count __attribute__((unused)), key __attribute__((unused));
{
#if defined (TIOCSTAT)
  ioctl (1, TIOCSTAT, (char *)0);
  rl_refresh_line (count, key);
#else
  rl_ding ();
#endif
  return 0;
}

/* Return a copy of the string between FROM and TO.
   FROM is inclusive, TO is not. */
char *
rl_copy_text (from, to)
     int from, to;
{
  register int length;
  char *copy;

  /* Fix it if the caller is confused. */
  if (from > to)
    SWAP (from, to);

  length = to - from;
  copy = (char *)xmalloc (1 + length);
  strncpy (copy, rl_line_buffer + from, length);
  copy[length] = '\0';
  return (copy);
}

/* Increase the size of RL_LINE_BUFFER until it has enough space to hold
   LEN characters. */
void
rl_extend_line_buffer (len)
     int len;
{
  while (len >= rl_line_buffer_len)
    {
      rl_line_buffer_len += DEFAULT_BUFFER_SIZE;
      rl_line_buffer = (char *)xrealloc (rl_line_buffer, rl_line_buffer_len);
    }

  _rl_set_the_line ();
}


/* A function for simple tilde expansion. */
int
rl_tilde_expand (ignore, key)
     int ignore __attribute__((unused)), key __attribute__((unused));
{
  register int start, end;
  char *homedir, *temp;
  int len;

  end = rl_point;
  start = end - 1;

  if (rl_point == rl_end && rl_line_buffer[rl_point] == '~')
    {
      homedir = tilde_expand ("~");
      _rl_replace_text (homedir, start, end);
      return (0);
    }
  else if (rl_line_buffer[start] != '~')
    {
      for (; !whitespace (rl_line_buffer[start]) && start >= 0; start--)
        ;
      start++;
    }

  end = start;
  do
    end++;
  while (whitespace (rl_line_buffer[end]) == 0 && end < rl_end);

  if (whitespace (rl_line_buffer[end]) || end >= rl_end)
    end--;

  /* If the first character of the current word is a tilde, perform
     tilde expansion and insert the result.  If not a tilde, do
     nothing. */
  if (rl_line_buffer[start] == '~')
    {
      len = end - start + 1;
      temp = (char *)xmalloc (len + 1);
      strncpy (temp, rl_line_buffer + start, len);
      temp[len] = '\0';
      homedir = tilde_expand (temp);
      free (temp);

      _rl_replace_text (homedir, start, end);
    }

  return (0);
}

/* **************************************************************** */
/*								    */
/*			String Utility Functions		    */
/*								    */
/* **************************************************************** */

/* Determine if s2 occurs in s1.  If so, return a pointer to the
   match in s1.  The compare is case insensitive. */
char *
_rl_strindex (s1, s2)
     register const char *s1, *s2;
{
  register int i, l, len;

  for (i = 0, l = strlen (s2), len = strlen (s1); (len - i) >= l; i++)
    if (_rl_strnicmp (s1 + i, s2, l) == 0)
      return ((char *) (s1 + i));
  return ((char *)NULL);
}

#ifndef HAVE_STRPBRK
/* Find the first occurrence in STRING1 of any character from STRING2.
   Return a pointer to the character in STRING1. */
char *
_rl_strpbrk (string1, string2)
     const char *string1, *string2;
{
  register const char *scan;
#if defined (HANDLE_MULTIBYTE)
  mbstate_t ps;
  register int i, v;

  memset (&ps, 0, sizeof (mbstate_t));
#endif

  for (; *string1; string1++)
    {
      for (scan = string2; *scan; scan++)
	{
	  if (*string1 == *scan)
	    return ((char *)string1);
	}
#if defined (HANDLE_MULTIBYTE)
      if (MB_CUR_MAX > 1 && rl_byte_oriented == 0)
	{
	  v = _rl_get_char_len (string1, &ps);
	  if (v > 1)
	    string1 += v - 1;	/* -1 to account for auto-increment in loop */
	}
#endif
    }
  return ((char *)NULL);
}
#endif

#if !defined (HAVE_STRCASECMP)
/* Compare at most COUNT characters from string1 to string2.  Case
   doesn't matter. */
int
_rl_strnicmp (string1, string2, count)
     char *string1, *string2;
     int count;
{
  register char ch1, ch2;

  while (count)
    {
      ch1 = *string1++;
      ch2 = *string2++;
      if (_rl_to_upper(ch1) == _rl_to_upper(ch2))
	count--;
      else
        break;
    }
  return (count);
}

/* strcmp (), but caseless. */
int
_rl_stricmp (string1, string2)
     char *string1, *string2;
{
  register char ch1, ch2;

  while (*string1 && *string2)
    {
      ch1 = *string1++;
      ch2 = *string2++;
      if (_rl_to_upper(ch1) != _rl_to_upper(ch2))
	return (1);
    }
  return (*string1 - *string2);
}
#endif /* !HAVE_STRCASECMP */

/* Stupid comparison routine for qsort () ing strings. */
int
_rl_qsort_string_compare (s1, s2)
  char **s1, **s2;
{
#if defined (HAVE_STRCOLL)
  return (strcoll (*s1, *s2));
#else
  int result;

  result = **s1 - **s2;
  if (result == 0)
    result = strcmp (*s1, *s2);

  return result;
#endif
}

/* Function equivalents for the macros defined in chardefs.h. */
#define FUNCTION_FOR_MACRO(f)	int (f) (c) int c; { return f (c); }

FUNCTION_FOR_MACRO (_rl_digit_p)
FUNCTION_FOR_MACRO (_rl_digit_value)
FUNCTION_FOR_MACRO (_rl_lowercase_p)
FUNCTION_FOR_MACRO (_rl_pure_alphabetic)
FUNCTION_FOR_MACRO (_rl_to_lower)
FUNCTION_FOR_MACRO (_rl_to_upper)
FUNCTION_FOR_MACRO (_rl_uppercase_p)

/* Backwards compatibility, now that savestring has been removed from
   all `public' readline header files. */
#undef _rl_savestring
char *
_rl_savestring (s)
     const char *s;
{
  return (strcpy ((char *)xmalloc (1 + (int)strlen (s)), (s)));
}

```

### Core Architecture Module: `include/handler_state.h`
```
/*
  Map handler error message to sql states. Note that this list MUST be in
  increasing order!
  See sql_state.c for usage
*/

{ HA_ERR_KEY_NOT_FOUND, 	"02000", "" },
{ HA_ERR_FOUND_DUPP_KEY,	"23000", "" },
{ HA_ERR_WRONG_COMMAND, 	"0A000", "" },
{ HA_ERR_UNSUPPORTED,		"0A000", "" },
{ HA_WRONG_CREATE_OPTION,	"0A000", "" },
{ HA_ERR_FOUND_DUPP_UNIQUE,	"23000", "" },
{ HA_ERR_UNKNOWN_CHARSET,	"0A000", "" },
{ HA_ERR_READ_ONLY_TRANSACTION,	"25000", "" },
{ HA_ERR_LOCK_DEADLOCK,		"40001", "" },
{ HA_ERR_NO_REFERENCED_ROW,	"23000", "" },
{ HA_ERR_ROW_IS_REFERENCED,	"23000", "" },
{ HA_ERR_TABLE_EXIST,		"42S01", "" },
{ HA_ERR_FOREIGN_DUPLICATE_KEY,	"23000", "" },
{ HA_ERR_TABLE_READONLY,        "25000", "" }, 
{ HA_ERR_AUTOINC_ERANGE,	"22003", "" },

```

### Core Architecture Module: `include/mysql/psi/mysql_statement.h`
```
/* Copyright (c) 2010, 2023, Oracle and/or its affiliates.
   Copyright (c) 2017, 2019, MariaDB Corporation.

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License, version 2.0,
  as published by the Free Software Foundation.

  This program is also distributed with certain software (including
  but not limited to OpenSSL) that is licensed under separate terms,
  as designated in a particular file or component or in included license
  documentation.  The authors of MySQL hereby grant you an additional
  permission to link the program and your derivative works with the
  separately licensed software that they have included with MySQL.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License, version 2.0, for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335  USA */

#ifndef MYSQL_STATEMENT_H
#define MYSQL_STATEMENT_H

/**
  @file mysql/psi/mysql_statement.h
  Instrumentation helpers for statements.
*/

#include "mysql/psi/psi.h"

class Diagnostics_area;
typedef const struct charset_info_st CHARSET_INFO;

#ifndef PSI_STATEMENT_CALL
#define PSI_STATEMENT_CALL(M) PSI_DYNAMIC_CALL(M)
#endif

#ifndef PSI_DIGEST_CALL
#define PSI_DIGEST_CALL(M) PSI_DYNAMIC_CALL(M)
#endif

/**
  @defgroup Statement_instrumentation Statement Instrumentation
  @ingroup Instrumentation_interface
  @{
*/

/**
  @def mysql_statement_register(P1, P2, P3)
  Statement registration.
*/
#ifdef HAVE_PSI_STATEMENT_INTERFACE
#define mysql_statement_register(P1, P2, P3) \
  inline_mysql_statement_register(P1, P2, P3)
#else
#define mysql_statement_register(P1, P2, P3) \
  do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_DIGEST_INTERFACE
  #define MYSQL_DIGEST_START(LOCKER) \
    inline_mysql_digest_start(LOCKER)
#else
  #define MYSQL_DIGEST_START(LOCKER) \
    NULL
#endif

#ifdef HAVE_PSI_STATEMENT_DIGEST_INTERFACE
  #define MYSQL_DIGEST_END(LOCKER, DIGEST) \
    inline_mysql_digest_end(LOCKER, DIGEST)
#else
  #define MYSQL_DIGEST_END(LOCKER, DIGEST) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_START_STATEMENT(STATE, K, DB, DB_LEN, CS, SPS) \
    inline_mysql_start_statement(STATE, K, DB, DB_LEN, CS, SPS, __FILE__, __LINE__)
#else
  #define MYSQL_START_STATEMENT(STATE, K, DB, DB_LEN, CS, SPS) \
    NULL
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_REFINE_STATEMENT(LOCKER, K) \
    inline_mysql_refine_statement(LOCKER, K)
#else
  #define MYSQL_REFINE_STATEMENT(LOCKER, K) \
    NULL
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_SET_STATEMENT_TEXT(LOCKER, P1, P2) \
    inline_mysql_set_statement_text(LOCKER, P1, P2)
#else
  #define MYSQL_SET_STATEMENT_TEXT(LOCKER, P1, P2) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_SET_STATEMENT_LOCK_TIME(LOCKER, P1) \
    inline_mysql_set_statement_lock_time(LOCKER, P1)
#else
  #define MYSQL_SET_STATEMENT_LOCK_TIME(LOCKER, P1) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_SET_STATEMENT_ROWS_SENT(LOCKER, P1) \
    inline_mysql_set_statement_rows_sent(LOCKER, P1)
#else
  #define MYSQL_SET_STATEMENT_ROWS_SENT(LOCKER, P1) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_SET_STATEMENT_ROWS_EXAMINED(LOCKER, P1) \
    inline_mysql_set_statement_rows_examined(LOCKER, P1)
#else
  #define MYSQL_SET_STATEMENT_ROWS_EXAMINED(LOCKER, P1) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
  #define MYSQL_END_STATEMENT(LOCKER, DA) \
    inline_mysql_end_statement(LOCKER, DA)
#else
  #define MYSQL_END_STATEMENT(LOCKER, DA) \
    do {} while (0)
#endif

#ifdef HAVE_PSI_STATEMENT_INTERFACE
static inline void inline_mysql_statement_register(
  const char *category, PSI_statement_info *info, int count)
{
  PSI_STATEMENT_CALL(register_statement)(category, info, count);
}

#ifdef HAVE_PSI_STATEMENT_DIGEST_INTERFACE
static inline struct PSI_digest_locker *
inline_mysql_digest_start(PSI_statement_locker *locker)
{
  PSI_digest_locker* digest_locker= NULL;

  if (psi_likely(locker != NULL))
    digest_locker= PSI_DIGEST_CALL(digest_start)(locker);
  return digest_locker;
}
#endif

#ifdef HAVE_PSI_STATEMENT_DIGEST_INTERFACE
static inline void
inline_mysql_digest_end(PSI_digest_locker *locker, const sql_digest_storage *digest)
{
  if (psi_likely(locker != NULL))
    PSI_DIGEST_CALL(digest_end)(locker, digest);
}
#endif

static inline struct PSI_statement_locker *
inline_mysql_start_statement(PSI_statement_locker_state *state,
                             PSI_statement_key key,
                             const char *db, size_t db_len,
                             CHARSET_INFO *charset,
                             PSI_sp_share *sp_share,
                             const char *src_file, uint src_line)
{
  PSI_statement_locker *locker;
  locker= PSI_STATEMENT_CALL(get_thread_statement_locker)(state, key, charset,
                                                          sp_share);
  if (psi_likely(locker != NULL))
    PSI_STATEMENT_CALL(start_statement)(locker, db, (uint)db_len, src_file, src_line);
  return locker;
}

static inline struct PSI_statement_locker *
inline_mysql_refine_statement(PSI_statement_locker *locker,
                              PSI_statement_key key)
{
  if (psi_likely(locker != NULL))
  {
    locker= PSI_STATEMENT_CALL(refine_statement)(locker, key);
  }
  return locker;
}

static inline void
inline_mysql_set_statement_text(PSI_statement_locker *locker,
                                const char *text, uint text_len)
{
  if (psi_likely(locker != NULL))
  {
    PSI_STATEMENT_CALL(set_statement_text)(locker, text, text_len);
  }
}

static inline void
inline_mysql_set_statement_lock_time(PSI_statement_locker *locker,
                                     ulonglong count)
{
  if (psi_likely(locker != NULL))
  {
    PSI_STATEMENT_CALL(set_statement_lock_time)(locker, count);
  }
}

static inline void
inline_mysql_set_statement_rows_sent(PSI_statement_locker *locker,
                                     ulonglong count)
{
  if (psi_likely(locker != NULL))
  {
    PSI_STATEMENT_CALL(set_statement_rows_sent)(locker, count);
  }
}

static inline void
inline_mysql_set_statement_rows_examined(PSI_statement_locker *locker,
                                         ulonglong count)
{
  if (psi_likely(locker != NULL))
  {
    PSI_STATEMENT_CALL(set_statement_rows_examined)(locker, count);
  }
}

static inline void
inline_mysql_end_statement(struct PSI_statement_locker *locker,
                           Diagnostics_area *stmt_da)
{
  PSI_STAGE_CALL(end_stage)();
  if (psi_likely(locker != NULL))
    PSI_STATEMENT_CALL(end_statement)(locker, stmt_da);
}
#endif

/** @} (end of group Statement_instrumentation) */

#endif


```

### Core Architecture Module: `include/mysql/service_kill_statement.h`
```
/* Copyright (c) 2013, 2018, MariaDB

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335  USA */

#ifndef MYSQL_SERVICE_KILL_STATEMENT_INCLUDED
#define MYSQL_SERVICE_KILL_STATEMENT_INCLUDED

/**
  @file
  This service provides functions that allow plugins to support
  the KILL statement.

  In MySQL support for the KILL statement is cooperative. The KILL
  statement only sets a "killed" flag. This function returns the value
  of that flag.  A thread should check it often, especially inside
  time-consuming loops, and gracefully abort the operation if it is
  non-zero.

  thd_killed(thd)
  @return 0 - no KILL statement was issued, continue normally
  @return 1 - there was a KILL statement, abort the execution.

  thd_kill_level(thd)
  @return thd_kill_levels_enum values
*/

#ifdef __cplusplus
extern "C" {
#endif

enum thd_kill_levels {
  THD_IS_NOT_KILLED=0,
  THD_ABORT_SOFTLY=50, /**< abort when possible, don't leave tables corrupted */
  THD_ABORT_ASAP=100,  /**< abort asap */
};

extern struct kill_statement_service_st {
  enum thd_kill_levels (*thd_kill_level_func)(const MYSQL_THD);
} *thd_kill_statement_service;

/* backward compatibility helper */
#define thd_killed(THD)   (thd_kill_level(THD) == THD_ABORT_ASAP)

#ifdef MYSQL_DYNAMIC_PLUGIN

#define thd_kill_level(THD) \
        thd_kill_statement_service->thd_kill_level_func(THD)

#else

enum thd_kill_levels thd_kill_level(const MYSQL_THD);

#endif

#ifdef __cplusplus
}
#endif

#endif


```

### Core Architecture Module: `include/pfs_statement_provider.h`
```
/* Copyright (c) 2012, 2015, Oracle and/or its affiliates. All rights reserved.

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; version 2 of the License.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software Foundation,
  51 Franklin Street, Suite 500, Boston, MA 02110-1335 USA */

#ifndef PFS_STATEMENT_PROVIDER_H
#define PFS_STATEMENT_PROVIDER_H

/**
  @file include/pfs_statement_provider.h
  Performance schema instrumentation (declarations).
*/

#ifdef HAVE_PSI_STATEMENT_INTERFACE
#ifdef MYSQL_SERVER
#ifndef EMBEDDED_LIBRARY
#ifndef MYSQL_DYNAMIC_PLUGIN

#include "mysql/psi/psi.h"

#define PSI_STATEMENT_CALL(M) pfs_ ## M ## _v1
#define PSI_DIGEST_CALL(M) pfs_ ## M ## _v1

C_MODE_START

void pfs_register_statement_v1(const char *category,
                               PSI_statement_info_v1 *info,
                               int count);

PSI_statement_locker*
pfs_get_thread_statement_locker_v1(PSI_statement_locker_state *state,
                                   PSI_statement_key key,
                                   const void *charset,
                                   PSI_sp_share *sp_share);

PSI_statement_locker*
pfs_refine_statement_v1(PSI_statement_locker *locker,
                        PSI_statement_key key);

void pfs_start_statement_v1(PSI_statement_locker *locker,
                            const char *db, uint db_len,
                            const char *src_file, uint src_line);

void pfs_set_statement_text_v1(PSI_statement_locker *locker,
                               const char *text, uint text_len);

void pfs_set_statement_lock_time_v1(PSI_statement_locker *locker,
                                    ulonglong count);

void pfs_set_statement_rows_sent_v1(PSI_statement_locker *locker,
                                    ulonglong count);

void pfs_set_statement_rows_examined_v1(PSI_statement_locker *locker,
                                        ulonglong count);

void pfs_inc_statement_created_tmp_disk_tables_v1(PSI_statement_locker *locker,
                                                  ulong count);

void pfs_inc_statement_created_tmp_tables_v1(PSI_statement_locker *locker,
                                             ulong count);

void pfs_inc_statement_select_full_join_v1(PSI_statement_locker *locker,
                                           ulong count);

void pfs_inc_statement_select_full_range_join_v1(PSI_statement_locker *locker,
                                                 ulong count);

void pfs_inc_statement_select_range_v1(PSI_statement_locker *locker,
                                       ulong count);

void pfs_inc_statement_select_range_check_v1(PSI_statement_locker *locker,
                                             ulong count);

void pfs_inc_statement_select_scan_v1(PSI_statement_locker *locker,
                                      ulong count);

void pfs_inc_statement_sort_merge_passes_v1(PSI_statement_locker *locker,
                                            ulong count);

void pfs_inc_statement_sort_range_v1(PSI_statement_locker *locker,
                                     ulong count);

void pfs_inc_statement_sort_rows_v1(PSI_statement_locker *locker,
                                    ulong count);

void pfs_inc_statement_sort_scan_v1(PSI_statement_locker *locker,
                                    ulong count);

void pfs_set_statement_no_index_used_v1(PSI_statement_locker *locker);

void pfs_set_statement_no_good_index_used_v1(PSI_statement_locker *locker);

void pfs_end_statement_v1(PSI_statement_locker *locker, void *stmt_da);

PSI_digest_locker *pfs_digest_start_v1(PSI_statement_locker *locker);

void pfs_digest_end_v1(PSI_digest_locker *locker,
                       const sql_digest_storage *digest);

C_MODE_END

#endif /* MYSQL_DYNAMIC_PLUGIN */
#endif /* EMBEDDED_LIBRARY */
#endif /* MYSQL_SERVER */
#endif /* HAVE_PSI_STATEMENT_INTERFACE */

#endif


```

### Core Architecture Module: `include/queues.h`
```
/* Copyright (C) 2010 Monty Program Ab
   All Rights reserved

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the following disclaimer
      in the documentation and/or other materials provided with the
      distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
  FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
  <COPYRIGHT HOLDER> BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF
  USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
  OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
  OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
  SUCH DAMAGE.
*/

/*
  Code for general handling of priority Queues.
  Implementation of queues from "Algorithms in C" by Robert Sedgewick.
*/

#ifndef _queues_h
#define _queues_h

#include <my_cmp.h>

#ifdef	__cplusplus
extern "C" {
#endif

typedef struct st_queue {
  uchar **root;
  void *first_cmp_arg;
  uint elements;
  uint max_elements;
  uint offset_to_key;          /* compare is done on element+offset */
  uint offset_to_queue_pos;    /* If we want to store position in element */
  uint auto_extent;
  int max_at_top;	/* Normally 1, set to -1 if queue_top gives max */
  qsort_cmp2 compare;
} QUEUE;

#define queue_first_element(queue) 1
#define queue_last_element(queue) (queue)->elements
#define queue_empty(queue) ((queue)->elements == 0)
#define queue_top(queue) ((queue)->root[1])
#define queue_element(queue,index) ((queue)->root[index])
#define queue_end(queue) ((queue)->root[(queue)->elements])
#define queue_replace_top(queue) _downheap(queue, 1)
#define queue_set_cmp_arg(queue, set_arg) (queue)->first_cmp_arg= set_arg
#define queue_set_max_at_top(queue, set_arg) \
  (queue)->max_at_top= set_arg ? -1 : 1
#define queue_remove_top(queue_arg) queue_remove((queue_arg), queue_first_element(queue_arg))

int init_queue(QUEUE *queue,uint max_elements,uint offset_to_key,
	       my_bool max_at_top, qsort_cmp2 compare,
	       void *first_cmp_arg, uint offset_to_queue_pos,
               uint auto_extent);
int reinit_queue(QUEUE *queue,uint max_elements,uint offset_to_key,
                 my_bool max_at_top, qsort_cmp2 compare,
                 void *first_cmp_arg, uint offset_to_queue_pos,
                 uint auto_extent);
int resize_queue(QUEUE *queue, uint max_elements);
void delete_queue(QUEUE *queue);
void queue_insert(QUEUE *queue, uchar *element);
int queue_insert_safe(QUEUE *queue, uchar *element);
uchar *queue_remove(QUEUE *queue,uint idx);
void queue_replace(QUEUE *queue,uint idx);

#define queue_remove_all(queue) { (queue)->elements= 0; }
#define queue_is_full(queue) ((queue)->elements == (queue)->max_elements)
void _downheap(QUEUE *queue, uint idx);
void queue_fix(QUEUE *queue);
#define is_queue_inited(queue) ((queue)->root != 0)

#ifdef	__cplusplus
}
#endif
#endif

```

### Core Architecture Module: `include/wqueue.h`
```
/*
   Copyright (c) 2007, 2008, Sun Microsystems, Inc,
   Copyright (c) 2011, 2012, Monty Program Ab

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1335 USA */

#ifndef WQUEUE_INCLUDED
#define WQUEUE_INCLUDED

#include <my_pthread.h>

/* info about requests in a waiting queue */
typedef struct st_pagecache_wqueue
{
  struct st_my_thread_var *last_thread;         /* circular list of waiting
                                                   threads */
} WQUEUE;

void wqueue_link_into_queue(WQUEUE *wqueue, struct st_my_thread_var *thread);
void wqueue_unlink_from_queue(WQUEUE *wqueue, struct st_my_thread_var *thread);
void wqueue_add_to_queue(WQUEUE *wqueue, struct st_my_thread_var *thread);
void wqueue_add_and_wait(WQUEUE *wqueue,
                         struct st_my_thread_var *thread,
                         mysql_mutex_t *lock);
void wqueue_release_queue(WQUEUE *wqueue);
void wqueue_release_one_locktype_from_queue(WQUEUE *wqueue);

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5815** (2026-10-05): **MDEV-4632 multi_source.status_vars test fails sporadically in buildbot**
  *Symptoms*: `Slave_received_heartbeats`’s test for independence between connections relied on timing with second-level precision, which is inconsistent on a loaded CI. To avoid relying on timing accuracy, this commit changes the test strategy to measure a live result and use that to show independence.
  **Post-Mortem & Fix Analysis**:
  > Whoops, already fixed in [MDEV-41212](https://jira.mariadb.org/browse/MDEV-41212) (#5703)

- **Issue #5814** (2026-10-05): **MDEV-41385 wsrep_sync_wait has no effect after COM_CHANGE_USER       …**
  *Symptoms*: …                                                                          │  Also reported as: https://github.com/mariadb-corporation/galera/issues/613.  THD::cleanup() cleared THD::wsrep_client_thread. Besides connection                                                                            │ close, THD::cleanup() is also called from THD::change_user() when                                                                              │ handling COM_CHANGE_USER and COM_RESET_CONNECTION. THD::init() does                                                                            │ not set the flag back, and the only place that sets it is                                                                                      │ thd_prepare_connection(). After either command the session was no                                                                              │ longer treated as a wsrep client connection: WSREP_CLIENT() returned                                                                           │ false for the rest of the session.                                                                                                             │  As a result wsrep_sync_wait was silently ignored, so causal reads                                                                              │ could return stale data. Such connections were also skipped by                                                                                 │ wsrep_close_client_connec

- **Issue #5806** (2026-10-02): **crc32c: check elf_aux_info() return value in ppc64 probe**
  *Symptoms*: elf_aux_info(3) leaves the output buffer unmodified on failure, so ignoring the return value could test an uninitialized cpufeatures and wrongly enable the POWER8 vector-crypto path.  Treat failure as "no features" so the probe falls back to the generic implementation.

- **Issue #5805** (2026-10-05): **MDEV-39343: Restoring from a mysqldump from older version makes mysql_upgrade version test fail**
  *Symptoms*: The mariadb-upgrade tool no longer uses the mysql_upgrade_info file to track the server version during an upgrade.  Changes:  1- Create the mysql.mysql_upgrade_info table and seed it with the server binary version when MariaDB is installed.  2- Make mariadb-dump add a DROP TABLE mysql.mysql_upgrade_info statement to the dump. This ensures that the table is removed on the target server when restoring a dump created from an older server. The table will then be recreated if it exists on the source server.  3- Update mariadb-upgrade to perform the upgrade if mysql.mysql_upgrade_info is missing or contains a version older than the current server binary version. Otherwise, reject the upgrade.

- **Issue #5803** (2026-10-01): **10.11 mdev 37269**
  *Symptoms*: 

- **Issue #5801** (2026-10-03): **MDEV-41156: ASAN use-after-poison in JSON_CONTAINS_PATH**
  *Symptoms*: The json_depth_array as allocated for 32 elements but accessed it as though there wasn't a limit.  Called mem_root_allocate_dynamic to ensure that the number of elements was presented, and error JE_EOS (out of space) if allocation exceeded.  Removed unused value, as value_ptr was always valid.  Access the array with bounds checking mechanism, mem_root_dynamic_array_get_val.  Reported by: David Korczynski of Ada Logics

- **Issue #5799** (2026-10-02): **MDEV-41303:  rand() in a semi-join subquery is checked on outer rows**
  *Symptoms*: Converting an IN subquery to a semi-join moves its WHERE into the parent WHERE.  A condition there such as rand(1) < 0.09 reads no table, so it is attached to the last table of the join order that is outside any materialized semi-join.  With SJ-Materialization it was checked once for each outer row instead of once for each row of the subquery, and the query returned a wrong count.  Do not convert a subquery to a semi-join when it contains a function with a random result (UNCACHEABLE_RAND).  Derived tables already follow this rule.  ROWNUM sets the same flag, so this replaces the check for ROWNUM.
  **Post-Mortem & Fix Analysis**:
  > ```sql explain extended select count(*) from t1 where t1.a in (select c from t2 where rand(1) < 0.09); ```  Before the patch, we get: ``` Note	1003	select count(0) AS `count(*)`  from `test`.`t1` semi join (`test`.`t2`) where rand(1) < 0.09 ```  After the patch, we get (I've added formatting): ``` Note	1003	/* select#1 */ select count(0) AS `count(*)`  from     <materialize> (/* select#2 */ select `test`.`t2`.`c` from `test`.`t2` where rand(1) < 0.09)    join `test`.`t1`  where    `<subquery2>`.`c` = `test`.`t1`.`a` ```  So it is still converted into a semi-join.  But now the semi-join is a `non-merged semi-join`. Subquery's WHERE condition stays in the subquery, so conversion to `non-merged semi-join` is fine
  > Remember I've asked this question on the call:  > If the SELECT has an Item with 'item->used_tables() & RAND_TABLE_BIT, will that translate into select_lex->uncacheable & UNCACHEABLE_RAND` for the SELECT that that Item is located  Claude gives this answer:  > Items that have RAND_TABLE_BIT but never set UNCACHEABLE_RAND: > - Item_func_get_user_var: used_tables() returns the bit when the item isn't const (item_func.h:3672). > - Item_func_sysdate_local: item_timefunc.h:961. > - Item_func_sp: the bit is set when the stored routine is non-deterministic (item_func.cc:6951). > - Item_insert_value (item.h:7460). > - A not-fully-parsed Item_default_value (item.cc:10207). > - Item_func_xml_* (item_xmlfunc.cc:197). > - Item_direct_view_ref in HAVING, (hallucination removed), the Item_sum / window-function caches. These add the bit only as a "don't push or move" marker.  I've verified it for SYSDATE()...  I don't see any items in the above list that would allow to construct a fail
  > > Remember I've asked this question on the call: >  > > If the SELECT has an Item with 'item->used_tables() & RAND_TABLE_BIT, will that translate into select_lex->uncacheable & UNCACHEABLE_RAND` for the SELECT that that Item is located  Yes, I investigated with Claude and discovered that the answer to this is 'no'.  I posted this PR because the answers to the three questions we discussed on the call indicated that this solution is sound, so I thought I would post it.  I planned to discuss the questions during the team call today.

- **Issue #5797** (2026-10-02): **Added a Contribution Interaction Etiquette section**
  *Symptoms*: Added a section on collaboration etiquette to the community contributions doc.
  **Post-Mortem & Fix Analysis**:
  > > I don't think it belongs here. There's code of conduct and numerous howtos on the internet  Would you have the same section here? https://github.com/MariaDB/governance/blob/main/code-of-conduct.md
  > My intent was to capture the process fully. I believe it might be more confusing to people to read two documents and merge them together than it would be to just read one. Here we have a unique system of trying to keep the PR in sync with the Jira. In all of its states. I do not think anybody else does that. Most of what I’ve seen is people just closing the GitHub issue when they address it via a PR.  Maybe we could consider simplifying the process first? 

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

### Incident Patch 1: `95fc70c3` (2026-08-13)
**Commit Message**: MDEV-39307: Fix %f in audit plugin timestamp rendering zero microseconds

The server_audit_timestamp_format %f specifier always rendered zero
microseconds. The server downcast the precise time to seconds before
passing it to audit plugins, and the plugin then re-fetched the time
itself at write time.

Pass the server's high-resolution time through the audit API instead:
- extend mysql_event_general with general_time_microseconds (added in
  MYSQL_AUDIT_INTERFACE_VERSION 0x0304), keeping general_time in
  seconds for backward compatibility
- the server_audit plugin uses event->general_time_microseconds for
  query log entries instead of re-fetching the time at write time

Connection and table events carry no timestamp in the audit API, so the
plugin keeps taking the time at event time for those entries.

**File**: `include/mysql/plugin_audit.h` (modified, +9/-1)
```diff
@@ -29,7 +29,7 @@ extern "C" {
 
 #define MYSQL_AUDIT_CLASS_MASK_SIZE 1
 
-#define MYSQL_AUDIT_INTERFACE_VERSION 0x0303
+#define MYSQL_AUDIT_INTERFACE_VERSION 0x0304
 
 
 /*************************************************************************
@@ -69,6 +69,14 @@ struct mysql_event_general
   /* Added in version 0x303 */
   unsigned int port;
   MYSQL_CONST_LEX_STRING database;
+  /*
+    Added in version 0x304.
+
+    The time when the event occurred, in microseconds since the epoch.
+    general_time above keeps the second resolution for backward
+    compatibility.
+  */
+  unsigned long long general_time_microseconds;
 };
 
 
```

**File**: `include/mysql/plugin_audit.h.pp` (modified, +1/-0)
```diff
@@ -738,6 +738,7 @@
   unsigned long long query_id;
   unsigned int port;
   MYSQL_CONST_LEX_STRING database;
+  unsigned long long general_time_microseconds;
 };
 struct mysql_event_connection
 {
```

**File**: `mysql-test/suite/plugins/r/server_audit_timestamp.result` (modified, +15/-2)
```diff
@@ -156,7 +156,7 @@ set global server_audit_timestamp_format='T24=%T';
 select 'fmt_t24';
 fmt_t24
 fmt_t24
-# 2l: Microseconds %f (always 000000 until MDEV-39307 is fixed)
+# 2l: Microseconds %f render six zero-padded digits
 set global server_audit_timestamp_format='US=%f';
 select 'fmt_usec';
 fmt_usec
@@ -179,7 +179,7 @@ FOUND 1 /OD=\d+\w+.*fmt_ord/ in ts_ext_specifiers.log
 FOUND 1 /STATIC-TEXT.*fmt_literal/ in ts_ext_specifiers.log
 FOUND 1 /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*fmt_iso/ in ts_ext_specifiers.log
 FOUND 1 /T24=\d{2}:\d{2}:\d{2}.*fmt_t24/ in ts_ext_specifiers.log
-FOUND 1 /US=000000.*fmt_usec/ in ts_ext_specifiers.log
+FOUND 1 /US=\d{6}.*fmt_usec/ in ts_ext_specifiers.log
 FOUND 1 /TZ=[+-]\d{4}.*fmt_tz/ in ts_ext_specifiers.log
 ########################################################################
 # Section 3: All event types get custom timestamps
@@ -343,6 +343,19 @@ FOUND 1 /PS=\d{8}.*persist_cycle1/ in ts_ext_persist.log
 FOUND 1 /PS=\d{8}.*persist_cycle2/ in ts_ext_persist.log
 FOUND 1 /P2=\d{8}.*persist_cycle3/ in ts_ext_persist.log
 ########################################################################
+# Section 10: Microsecond resolution of %f (MDEV-39307)
+########################################################################
+set global server_audit_file_path='ts_ext_usec.log';
+set global server_audit_events='query';
+set global server_audit_timestamp_format='US=%f';
+set global server_audit_logging=on;
+# %f must carry real microseconds, not a constant 000000
+set global server_audit_logging=off;
+# A six-digit zero-padded microsecond field is logged
+FOUND 1 /US=\d{6}.*usec_20/ in ts_ext_usec.log
+# At least one entry carries a real (non-zero) microsecond value
+usec_ok
+########################################################################
 # Cleanup: restore all settings
 ########################################################################
 set global server_audit_timestamp_format='CMD-LINE-%Y-%m-%d';
```

**File**: `mysql-test/suite/plugins/t/server_audit_timestamp.test` (modified, +45/-2)
```diff
@@ -153,7 +153,7 @@ select 'fmt_iso';
 set global server_audit_timestamp_format='T24=%T';
 select 'fmt_t24';
 
---echo # 2l: Microseconds %f (always 000000 until MDEV-39307 is fixed)
+--echo # 2l: Microseconds %f render six zero-padded digits
 set global server_audit_timestamp_format='US=%f';
 select 'fmt_usec';
 
@@ -197,7 +197,7 @@ set global server_audit_logging=off;
 --let SEARCH_PATTERN=T24=\d{2}:\d{2}:\d{2}.*fmt_t24
 --source include/search_pattern_in_file.inc
 
---let SEARCH_PATTERN=US=000000.*fmt_usec
+--let SEARCH_PATTERN=US=\d{6}.*fmt_usec
 --source include/search_pattern_in_file.inc
 
 --let SEARCH_PATTERN=TZ=[+-]\d{4}.*fmt_tz
@@ -450,6 +450,49 @@ set global server_audit_logging=off;
 
 remove_file $SEARCH_FILE;
 
+--echo ########################################################################
+--echo # Section 10: Microsecond resolution of %f (MDEV-39307)
+--echo ########################################################################
+
+let SEARCH_FILE= $MYSQLD_DATADIR/ts_ext_usec.log;
+set global server_audit_file_path='ts_ext_usec.log';
+set global server_audit_events='query';
+set global server_audit_timestamp_format='US=%f';
+set global server_audit_logging=on;
+
+--echo # %f must carry real microseconds, not a constant 000000
+# Log several statements; the microsecond value at write time is
+# effectively random, so at least one entry is expected to have a
+# non-zero microsecond value.
+--disable_query_log
+--disable_result_log
+let $i= 20;
+while ($i) {
+  eval select 'usec_$i';
+  dec $i;
+}
+--enable_result_log
+--enable_query_log
+
+set global server_audit_logging=off;
+
+--echo # A six-digit zero-padded microsecond field is logged
+--let SEARCH_PATTERN=US=\d{6}.*usec_20
+--source include/search_pattern_in_file.inc
+
+--echo # At least one entry carries a real (non-zero) microsecond value
+perl;
+  my $ok= 0;
+  open(FILE, '<', $ENV{SEARCH_FILE}) or die "Can't open $ENV{SEARCH_FILE}: $!";
+  while (<FILE>) {
+    if (/US=(\d{6})/ && $1 ne '000000') { $ok= 1; last; }
+  }
+  close(FILE);
+  print $ok ? "usec_ok\n" : "usec_bad\n";
+EOF
+
+remove_file $SEARCH_FILE;
+
 --echo ########################################################################
 --echo # Cleanup: restore all settings
 --echo ########################################################################
```

**File**: `plugin/server_audit/server_audit.cc` (modified, +23/-32)
```diff
@@ -74,6 +74,7 @@ static void closelog() {}
 
 #include <my_global.h>
 #include <my_base.h>
+#include <my_sys.h>
 #include <typelib.h>
 #include <mysql/plugin.h>
 #include <mysql/plugin_audit.h>
@@ -149,7 +150,6 @@ struct connection_info
   const char *query;
   int query_length;
   char query_buffer[1024];
-  time_t query_time;
   int log_always;
   unsigned int port;
   char proxy[USERNAME_CHAR_LENGTH+1];
@@ -1103,7 +1103,7 @@ static void change_connection(struct connection_info *cn,
   Write to the log
 */
 
-static int write_log(const char *message, size_t len, time_t ts)
+static int write_log(const char *message, size_t len, unsigned long long ts_us)
 {
 #if defined _WIN32 || !defined SUX_LOCK_GENERIC
   DBUG_ASSERT(lock_operations.is_locked_or_waiting());
@@ -1115,7 +1115,8 @@ static int write_log(const char *message, size_t len, time_t ts)
     if (logfile)
     {
       MYSQL_TIME ltime;
-      thd_gmt_sec_to_TIME(NULL, &ltime, ts);
+      thd_gmt_sec_to_TIME(NULL, &ltime, (time_t) (ts_us / 1000000));
+      ltime.second_part= (ulong) (ts_us % 1000000);
 
       size_t ts_len= 0;
       char *ts_start= (char *) message - TIMESTAMP_OUTPUT_LENGTH;
@@ -1162,10 +1163,10 @@ static int write_log(const char *message, size_t len, time_t ts)
   Write to the log, acquiring the lock.
 */
 
-static int write_log_and_lock(const char *message, size_t len, time_t ts)
+static int write_log_and_lock(const char *message, size_t len, unsigned long long ts_us)
 {
   lock_operations.rd_lock();
-  int result= write_log(message, len, ts);
+  int result= write_log(message, len, ts_us);
   lock_operations.rd_unlock();
   return result;
 }
@@ -1176,12 +1177,13 @@ static int write_log_and_lock(const char *message, size_t len, time_t ts)
 
   @param lock  whether the caller did not acquire lock_operations
 */
-static int write_log_maybe_lock(const char *message, size_t len, bool lock, time_t ts)
+static int write_log_maybe_lock(const char *message, size_t len, bool lock,
+                                unsigned long long ts_us)
 {
   if (unlikely(!lock))
-    return write_log(message, len, ts);
+    return write_log(message, len, ts_us);
   else
-    return write_log_and_lock(message, len, ts);
+    return write_log_and_lock(message, len, ts_us);
 }
 
 
@@ -1237,14 +1239,11 @@ static size_t create_tls_obj(const struct mysql_event_connection *ev, char *obj_
 
 static int log_proxy(const struct connection_info *cn,
                      const struct mysql_event_connection *event)
-                   
 {
-  time_t ctime;
   size_t csize;
   char raw_message[MAX_AUDIT_PAYLOAD_LENGTH + TIMESTAMP_OUTPUT_LENGTH];
   char *message= raw_message + TIMESTAMP_OUTPUT_LENGTH;
 
-  (void) time(&ctime);
   csize= log_header(message, MAX_AUDIT_PAYLOAD_LENGTH - 1,
                     servhost, servhost_len,
                     cn->user, cn->user_length,
@@ -1258,22 +1257,20 @@ static int log_proxy(const struct connection_info *cn,
                      cn->proxy_host_length, cn->proxy_host,
                      event->status);
   message[csize]= '\n';
-  return write_log_and_lock(message, csize + 1, ctime);
+  return write_log_and_lock(message, csize + 1, my_hrtime().val);
 }
 
 
 static int log_connection(const struct connection_info *cn,
                           const struct mysql_event_connection *event,
                           const char *type)
 {
-  time_t ctime;
   size_t csize;
   char raw_message[MAX_AUDIT_PAYLOAD_LENGTH + TIMESTAMP_OUTPUT_LENGTH];
   char *message= raw_message + TIMESTAMP_OUTPUT_LENGTH;
   char tls_obj[32];
   size_t obj_len;
 
-  (void) time(&ctime);
   csize= log_header(message, MAX_AUDIT_PAYLOAD_LENGTH - 1,
                     servhost, servhost_len,
                     cn->user, cn->user_length,
@@ -1286,21 +1283,19 @@ static int log_connection(const struct connection_info *cn,
     ",%.*s,%.*s,%d", cn->db_length, cn->db, (int) obj_len, tls_obj,
     event->status);
   message[csize]= '\n';
-  return write_log_and_lock(message, csize + 1, ctime);
+  return write_log_and_lock(message, csize + 1, my_hrtime().val);
 }
 
 
 static int log_connection_event(const struct mysql_event_connection *event,
                                 const char *type)
 {
-  time_t ctime;
   size_t csize;
   char raw_message[MAX_AUDIT_PAYLOAD_LENGTH + TIMESTAMP_OUTPUT_LENGTH];
   char *message= raw_message + TIMESTAMP_OUTPUT_LENGTH;
   char tls_obj[32];
   size_t obj_len;
 
-  (void) time(&ctime);
   csize= log_header(message, MAX_AUDIT_PAYLOAD_LENGTH - 1,
                     servhost, servhost_len,
                     event->user, event->user_length,
@@ -1312,7 +1307,7 @@ static int log_connection_event(const struct mysql_event_connection *event,
     ",%.*s,%.*s,%d", (int) event->database.length,event->database.str,
     (int) obj_len, tls_obj, event->status);
   message[csize]= '\n';
-  return write_log_and_lock(message, csize + 1, ctime);
+  return write_log_and_lock(message, csize + 1, my_hrtime().val);
 }
 
 
@@ -1509,9 
```

**File**: `sql/log.cc` (modified, +1/-1)
```diff
@@ -1667,7 +1667,7 @@ bool LOGGER::general_log_write(THD *thd, enum enum_server_command command,
   user_host_len= make_user_name(thd, user_host_buff);
   current_time= my_hrtime();
 
-  mysql_audit_general_log(thd, hrtime_to_time(current_time),
+  mysql_audit_general_log(thd, current_time,
                           user_host_buff, user_host_len,
                           command_name[(uint) command].str,
                           (uint)command_name[(uint) command].length,
```

**File**: `sql/sql_audit.h` (modified, +22/-3)
```diff
@@ -112,7 +112,7 @@ void set_tls_version_of_event(THD *thd, mysql_event_connection *event)
 */
  
 static inline
-void mysql_audit_general_log(THD *thd, time_t time,
+void mysql_audit_general_log(THD *thd, my_hrtime_t time,
                              const char *user, uint userlen,
                              const char *cmd, uint cmdlen,
                              const char *query, uint querylen)
@@ -123,7 +123,8 @@ void mysql_audit_general_log(THD *thd, time_t time,
 
     event.event_subclass= MYSQL_AUDIT_GENERAL_LOG;
     event.general_error_code= 0;
-    event.general_time= time;
+    event.general_time= hrtime_to_time(time);
+    event.general_time_microseconds= time.val;
     event.general_user= user;
     event.general_user_length= userlen;
     event.general_command= cmd;
@@ -177,7 +178,25 @@ void mysql_audit_general(THD *thd, uint event_subtype,
 
     event.event_subclass= event_subtype;
     event.general_error_code= error_code;
-    event.general_time= my_time(0);
+    {
+      /*
+        Use the wall-clock timestamp the server already maintains for the
+        current command (set once per query in dispatch_command), so that
+        all audit events of the same query carry the same time and no extra
+        clock call is made per event. start_utime cannot be used here: it is
+        a monotonic interval timer, not a wall-clock timestamp. Fall back to
+        the current wall-clock time if the timestamp is not set.
+      */
+      unsigned long long general_time_us;
+      if (thd && thd->start_time)
+        general_time_us= (unsigned long long) thd->start_time * 1000000 +
+                         thd->start_time_sec_part;
+      else
+        general_time_us= my_hrtime().val;
+      my_hrtime_t general_time= { general_time_us };
+      event.general_time= hrtime_to_time(general_time);
+      event.general_time_microseconds= general_time_us;
+    }
     event.general_command= msg;
     event.general_command_length= safe_strlen_uint(msg);
 
```

---

### Incident Patch 2: `a77e74f0` (2026-09-16)
**Commit Message**: MDEV-28730 fixup: clang -Wunused-but-set-global

**File**: `storage/innobase/fts/fts0fts.cc` (modified, +0/-9)
```diff
@@ -105,10 +105,6 @@ ulong	fts_max_token_size;
 ulong	fts_min_token_size;
 
 
-// FIXME: testing
-static time_t elapsed_time;
-static ulint n_nodes;
-
 /** Time to sleep after DEADLOCK error before retrying operation. */
 static const std::chrono::milliseconds FTS_DEADLOCK_RETRY_WAIT(100);
 
@@ -3298,10 +3294,7 @@ fts_get_max_doc_id(
 dberr_t fts_write_node(FTSQueryExecutor *executor, uint8_t selected,
                        const fts_aux_data_t *aux_data) noexcept
 {
-  time_t start_time= time(NULL);
   dberr_t error= executor->insert_aux_record(selected, aux_data);
-  elapsed_time+= time(NULL) - start_time;
-  ++n_nodes;
   return error;
 }
 
@@ -3378,8 +3371,6 @@ dberr_t fts_sync_write_words(FTSQueryExecutor *executor,
         if (unlock_cache) mysql_mutex_lock(&table->fts->cache->lock);
       }
 
-      n_nodes+= ib_vector_size(word->nodes);
-
       if (UNIV_UNLIKELY(error != DB_SUCCESS) && !print_error)
       {
         sql_print_error("InnoDB: ( %s ) writing word node to FTS auxiliary "
```

---

### Incident Patch 3: `d8d2e3ca` (2026-09-09)
**Commit Message**: Fix new defaul of old_mode

**File**: `mysql-test/include/load_dump_and_upgrade.inc` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
 --exec $MYSQL -e "DROP TABLE IF EXISTS mysql.global_priv; DROP VIEW IF EXISTS mysql.user"
 
 --echo # Loading dump of $old_version mysql schema
---exec $MYSQL mysql < $MYSQLTEST_VARDIR/std_data/mysql_database_$old_version.dump
+--exec $MYSQL --init-command="SET old_mode=UTF8_IS_UTF8MB3" mysql < $MYSQLTEST_VARDIR/std_data/mysql_database_$old_version.dump
 
 --echo # Running mysql_upgrade
 --exec $MYSQL_UPGRADE --verbose > $MYSQL_TMP_DIR/upgrade.log
```

**File**: `mysql-test/main/mysql_upgrade.result` (modified, +1/-1)
```diff
@@ -2488,6 +2488,6 @@ extract_schema_from_file_name		CREATE DEFINER=`mariadb.sys`@`localhost` FUNCTION
     COMMENT '\n             Description\n             Takes a raw file path, and attempts to extract the schema name from it.\n             Useful for when interacting with Performance Schema data\n             concerning IO statistics, for example.\n             Currently relies on the fact that a table data file will be within a\n             specified database directory (will not work with partitions or tables\n             that specify an individual DATA_DIRECTORY).\n             Parameters\n             path (VARCHAR(512)):\n               The full file path to a data file to extract the schema name from.\n             Returns\n             VARCHAR(64)\n             Example\n             mysql> SELECT sys.extract_schema_from_file_name(''/var/lib/mysql/employees/employee.ibd'');\n             +----------------------------------------------------------------------------+\n             | sys.extract_schema_from_file_name(''/var/lib/mysql/employees/employee.ibd'') |\n             +----------------------------------------------------------------------------+\n             | employees                                                                  |\n             +----------------------------------------------------------------------------+\n             1 row in set (0.00 sec)\n            '
 BEGIN
     RETURN LEFT(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(path, '\\', '/'), '/', -2), '/', 1), 64);
-END	utf8mb3	utf8mb3_general_ci	utf8mb3_general_ci
+END	utf8mb4	utf8mb4_general_ci	utf8mb3_general_ci
 set path @old_path;
 # End of 12.3 tests
```

---

### Incident Patch 4: `02c842c3` (2026-09-06)
**Commit Message**: MDEV-26015 ssl: remove insecure fixed DH params (mostly unused)- #5639

WolfSSL code path already operates without fixed DH parameters. OpenSSL code path still sets fixed static precomputed DH params, which is now prohibited by IETF.

Also OPENSSL_init_ssl is not required since OpenSSL 1.1.0, for over 10 years now. Also cleaned up at the same time.

https://www.rfc-editor.org/rfc/rfc10015.html#section-2:
> Clients MUST NOT offer and servers MUST NOT select non-ephemeral FFDH cipher suites in (D)TLS 1.2 connections.

https://www.rfc-editor.org/rfc/rfc10015.html#section-3:
> Clients MUST NOT offer and servers MUST NOT select FFDHE cipher suites in (D)TLS 1.2 connections.

And the depreciated tables include all ciphersuites that can use SSL_CTX_set_tmp_dh as part of the connection.

Also for a very long time OpenSSL was handling these automatically anyway, back when DHE was still recommended.

**File**: `include/violite.h` (modified, +0/-2)
```diff
@@ -174,8 +174,6 @@ struct st_VioSSLFd
 int sslaccept(struct st_VioSSLFd*, Vio *, long timeout, unsigned long *errptr);
 int sslconnect(struct st_VioSSLFd*, Vio *, long timeout, unsigned long *errptr);
 
-void vio_check_ssl_init();
-
 struct st_VioSSLFd
 *new_VioSSLConnectorFd(const char *key_file, const char *cert_file,
 		       const char *ca_file,  const char *ca_path,
```

**File**: `sql/encryption.cc` (modified, +0/-2)
```diff
@@ -65,8 +65,6 @@ int initialize_encryption_plugin(void *plugin_)
   if (encryption_manager)
     return 1;
 
-  vio_check_ssl_init();
-
   if (plugin->plugin->init && plugin->plugin->init(plugin))
   {
     sql_print_error("Plugin '%s' init function returned error.",
```

**File**: `vio/viosslfactories.c` (modified, +0/-90)
```diff
@@ -21,67 +21,11 @@
 #include <string.h>
 
 #ifdef HAVE_OPENSSL
-#include <openssl/dh.h>
-#include <openssl/bn.h>
 #include <openssl/x509.h>
-
-static my_bool     ssl_algorithms_added    = FALSE;
-static my_bool     ssl_error_strings_loaded= FALSE;
-
 #ifndef X509_VERSION_3
 #define X509_VERSION_3 2
 #endif
 
-/* the function below was generated with "openssl dhparam -2 -C 2048" */
-#ifndef HAVE_WOLFSSL
-static
-DH *get_dh2048()
-{
-    static unsigned char dhp_2048[] = {
-        0xA1,0xBB,0x7C,0x20,0xC5,0x5B,0xC0,0x7B,0x21,0x8B,0xD6,0xA8,
-        0x15,0xFC,0x3B,0xBA,0xAB,0x9F,0xDF,0x68,0xC4,0x79,0x78,0x0D,
-        0xC1,0x12,0x64,0xE4,0x15,0xC9,0x66,0xDB,0xF6,0xCB,0xB3,0x39,
-        0x02,0x5B,0x78,0x62,0xFB,0x09,0xAE,0x09,0x6B,0xDD,0xD4,0x5D,
-        0x97,0xBC,0xDC,0x7F,0xE6,0xD6,0xF1,0xCB,0xF5,0xEB,0xDA,0xA7,
-        0x2E,0x5A,0x43,0x2B,0xE9,0x40,0xE2,0x85,0x00,0x1C,0xC0,0x0A,
-        0x98,0x77,0xA9,0x31,0xDE,0x0B,0x75,0x4D,0x1E,0x1F,0x16,0x83,
-        0xCA,0xDE,0xBD,0x21,0xFC,0xC1,0x82,0x37,0x36,0x33,0x0B,0x66,
-        0x06,0x3C,0xF3,0xAF,0x21,0x57,0x57,0x80,0xF6,0x94,0x1B,0xA9,
-        0xD4,0xF6,0x8F,0x18,0x62,0x0E,0xC4,0x22,0xF9,0x5B,0x62,0xCC,
-        0x3F,0x19,0x95,0xCF,0x4B,0x00,0xA6,0x6C,0x0B,0xAF,0x9F,0xD5,
-        0xFA,0x3D,0x6D,0xDA,0x30,0x83,0x07,0x91,0xAC,0x15,0xFF,0x8F,
-        0x59,0x54,0xEA,0x25,0xBC,0x4E,0xEB,0x6A,0x54,0xDF,0x75,0x09,
-        0x72,0x0F,0xEF,0x23,0x70,0xE0,0xA8,0x04,0xEA,0xFF,0x90,0x54,
-        0xCD,0x84,0x18,0xC0,0x75,0x91,0x99,0x0F,0xA1,0x78,0x0C,0x07,
-        0xB7,0xC5,0xDE,0x55,0x06,0x7B,0x95,0x68,0x2C,0x33,0x39,0xBC,
-        0x2C,0xD0,0x6D,0xDD,0xFA,0xDC,0xB5,0x8F,0x82,0x39,0xF8,0x67,
-        0x44,0xF1,0xD8,0xF7,0x78,0x11,0x9A,0x77,0x9B,0x53,0x47,0xD6,
-        0x2B,0x5D,0x67,0xB8,0xB7,0xBC,0xC1,0xD7,0x79,0x62,0x15,0xC2,
-        0xC5,0x83,0x97,0xA7,0xF8,0xB4,0x9C,0xF6,0x8F,0x9A,0xC7,0xDA,
-        0x1B,0xBB,0x87,0x07,0xA7,0x71,0xAD,0xB2,0x8A,0x50,0xF8,0x26,
-        0x12,0xB7,0x3E,0x0B,
-    };
-    static unsigned char dhg_2048[] = {
-        0x02
-    };
-    DH *dh = DH_new();
-    BIGNUM *dhp_bn, *dhg_bn;
-
-    if (dh == NULL)
-        return NULL;
-    dhp_bn = BN_bin2bn(dhp_2048, sizeof (dhp_2048), NULL);
-    dhg_bn = BN_bin2bn(dhg_2048, sizeof (dhg_2048), NULL);
-    if (dhp_bn == NULL || dhg_bn == NULL
-            || !DH_set0_pqg(dh, dhp_bn, NULL, dhg_bn)) {
-        DH_free(dh);
-        BN_free(dhp_bn);
-        BN_free(dhg_bn);
-        return NULL;
-    }
-    return dh;
-}
-#endif
-
 static const char*
 ssl_error_string[] =
 {
@@ -236,22 +180,6 @@ vio_set_cert_stuff(SSL_CTX *ctx, const char *cert_file, const char *key_file,
   DBUG_RETURN(0);
 }
 
-
-void vio_check_ssl_init()
-{
-  if (!ssl_algorithms_added)
-  {
-    ssl_algorithms_added= TRUE;
-    OPENSSL_init_ssl(0, NULL);
-  }
-
-  if (!ssl_error_strings_loaded)
-  {
-    ssl_error_strings_loaded= TRUE;
-    SSL_load_error_strings();
-  }
-}
-
 #ifdef HAVE_WOLFSSL
 static int wolfssl_recv(WOLFSSL* ssl, char* buf, int sz, void* vio)
 {
@@ -458,8 +386,6 @@ new_VioSSLFd(const char *key_file, const char *cert_file, const char *ca_file,
               "cipher: '%s' crl_file: '%s' crl_path: '%s'", key_file,
               cert_file, ca_file, ca_path, cipher, crl_file, crl_path));
 
-  vio_check_ssl_init();
-
   if (!(ssl_fd= ((struct st_VioSSLFd*)
                  my_malloc(key_memory_vio_ssl_fd,
                            sizeof(struct st_VioSSLFd), MYF(0)))))
@@ -562,22 +488,6 @@ new_VioSSLFd(const char *key_file, const char *cert_file, const char *ca_file,
     goto err2;
   }
 
-#ifndef HAVE_WOLFSSL
-  /* DH stuff */
-  if (!is_client_method)
-  {
-    DH *dh= get_dh2048();
-    if (!SSL_CTX_set_tmp_dh(ssl_fd->ssl_context, dh))
-    {
-      *error= SSL_INITERR_DH;
-      DH_free(dh);
-      goto err2;
-    }
-
-    DH_free(dh);
-  }
-#endif
-
 #ifdef HAVE_WOLFSSL
   /* set IO functions used by wolfSSL */
    wolfSSL_SetIORecv(ssl_fd->ssl_context, wolfssl_recv);
```

---

### Incident Patch 5: `5815dc14` (2026-09-08)
**Commit Message**: Fix the version

**File**: `VERSION` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 MYSQL_VERSION_MAJOR=13
 MYSQL_VERSION_MINOR=1
-MYSQL_VERSION_PATCH=0
+MYSQL_VERSION_PATCH=1
 SERVER_MATURITY=gamma
```

---

### Incident Patch 6: `ea69ff8a` (2026-08-26)
**Commit Message**: fixed maturity

**File**: `VERSION` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 MYSQL_VERSION_MAJOR=13
 MYSQL_VERSION_MINOR=0
 MYSQL_VERSION_PATCH=2
-SERVER_MATURITY=gamma
+SERVER_MATURITY=stable
```

**File**: `mysql-test/main/mysql-interactive.result` (modified, +0/-8)
```diff
@@ -10,8 +10,6 @@ Your MariaDB connection id is X
 Server version: Y
 Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.
 
-Help others discover MariaDB. Star it on GitHub: https://github.com/MariaDB/server
-
 Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
 
 MariaDB [(none)]> delimiter $
@@ -42,8 +40,6 @@ Your MariaDB connection id is X
 Server version: Y
 Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.
 
-Help others discover MariaDB. Star it on GitHub: https://github.com/MariaDB/server
-
 Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
 
 MariaDB [(none)]> create database db1;
@@ -78,8 +74,6 @@ Your MariaDB connection id is X
 Server version: Y
 Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.
 
-Help others discover MariaDB. Star it on GitHub: https://github.com/MariaDB/server
-
 Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
 
 MariaDB [test]> CREATE TABLE t (c INT) ENGINE=InnoDB;
@@ -111,8 +105,6 @@ Your MariaDB connection id is X
 Server version: Y
 Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.
 
-Help others discover MariaDB. Star it on GitHub: https://github.com/MariaDB/server
-
 Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
 
 MariaDB [test]> CREATE TABLE t (c INT) ENGINE=InnoDB;
```

**File**: `mysql-test/suite/sys_vars/r/sysvars_star.result` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ VARIABLE_NAME	PLUGIN_MATURITY
 SESSION_VALUE	NULL
 GLOBAL_VALUE	alpha
 GLOBAL_VALUE_ORIGIN	CONFIG
-DEFAULT_VALUE	beta
+DEFAULT_VALUE	gamma
 VARIABLE_SCOPE	GLOBAL
 VARIABLE_TYPE	ENUM
 VARIABLE_COMMENT	The lowest desirable plugin maturity. Plugins less mature than that will not be installed or loaded
```

---

### Incident Patch 7: `b2a8c223` (2026-06-17)
**Commit Message**: MDEV-34805 post-review fixes

* keep `vec_len >= subdist_part * 2` logic in one place only
* keep "distance-greater-than" mode logic in one place only
* simplify VECTOR_DIMENSIONS (no need to have a special ctx->vec_len
  path if the other one always works)
* new plugin = maturity beta
* remove redundant casts, etc
* moved vector_indexes_fields_enum to the global scope to use it
  for setting schema->idx_field1/schema->idx_field2
* open the hlindex graph table, if needed, otherwise most values
  are unknown unless a user did vector search before
* added TABLE_CATALOG column
* remove CACHE_OVERFLOWS column, doesn't work as implemented,
  the fix is complex and isn't worth it
* add privilege checks (MDEV-40793)

in the test:
* prefer query_vertical for readability
* select all columns at least once
* select INDEX_SIZE even if engine-dependent, use rdiff files
* test how get_all_tables only open one specific table, and
  even only .frm file, if possible

**File**: `mysql-test/main/information_schema_all_engines.result` (modified, +1/-1)
```diff
@@ -512,5 +512,5 @@ Wildcard: inf_rmation_schema
 | information_schema |
 SELECT table_schema, count(*) FROM information_schema.TABLES WHERE table_schema IN ('mysql', 'INFORMATION_SCHEMA', 'test', 'mysqltest') GROUP BY TABLE_SCHEMA;
 table_schema	count(*)
-information_schema	74
+information_schema	75
 mysql	31
```

**File**: `mysql-test/main/vector,aria.rdiff` (modified, +64/-27)
```diff
@@ -7,7 +7,7 @@
  create table t1 (id int auto_increment primary key,
  u vector(5) not null, vector index (u),
  v vector(5) not null, vector index (v));
-@@ -12,7 +12,7 @@ t1	CREATE TABLE `t1` (
+@@ -12,7 +12,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -16,7 +16,7 @@
  show keys from t1;
  Table	Non_unique	Key_name	Seq_in_index	Column_name	Collation	Cardinality	Sub_part	Packed	Null	Index_type	Comment	Index_comment	Ignored
  t1	0	PRIMARY	1	id	A	0	NULL	NULL		BTREE			NO
-@@ -27,7 +27,7 @@ t1	CREATE TABLE `t1` (
+@@ -27,7 +27,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`) `m`='7'
@@ -25,7 +25,7 @@
  show keys from t1;
  Table	Non_unique	Key_name	Seq_in_index	Column_name	Collation	Cardinality	Sub_part	Packed	Null	Index_type	Comment	Index_comment	Ignored
  t1	0	PRIMARY	1	id	A	0	NULL	NULL		BTREE			NO
-@@ -42,7 +42,7 @@ t1	CREATE TABLE `t1` (
+@@ -42,7 +42,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`) `m`='5'
@@ -34,7 +34,7 @@
  show keys from t1;
  Table	Non_unique	Key_name	Seq_in_index	Column_name	Collation	Cardinality	Sub_part	Packed	Null	Index_type	Comment	Index_comment	Ignored
  t1	0	PRIMARY	1	id	A	0	NULL	NULL		BTREE			NO
-@@ -343,7 +343,7 @@ t2	CREATE TABLE `t2` (
+@@ -346,7 +346,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -43,7 +43,7 @@
  drop table t1, t2;
  db.opt
  # Test insert ... select with vector index
-@@ -388,8 +388,32 @@ db.opt
+@@ -391,8 +391,32 @@
  create table t1 (id int auto_increment primary key, v vector(5) not null, vector index (v));
  insert t1 (id, v) values (1, x'e360d63ebe554f3fcdbc523f4522193f5236083d');
  truncate table t1;
@@ -76,7 +76,7 @@
  insert t1 (id, v) values (1, x'e360d63ebe554f3fcdbc523f4522193f5236083d');
  select id, hex(v) from t1;
  id	hex(v)
-@@ -401,33 +425,39 @@ t1	CREATE TABLE `t1` (
+@@ -404,33 +428,39 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -126,7 +126,7 @@
  drop database test1;
  db.opt
  #
-@@ -442,7 +472,7 @@ t1	CREATE TABLE `t1` (
+@@ -445,7 +475,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`) `distance`='cosine'
@@ -135,7 +135,7 @@
  insert t1 (v) values (x'e360d63ebe554f3fcdbc523f4522193f5236083d'),
  (x'f511303f72224a3fdd05fe3eb22a133ffae86a3f'),
  (x'f09baa3ea172763f123def3e0c7fe53e288bf33e'),
-@@ -504,9 +534,11 @@ insert t1 (v) values (x'e360d63ebe554f3fcdbc523f4522193f5236083d'),
+@@ -507,9 +537,11 @@
  # ADD/DROP COLUMN, ALGORITHM=COPY
  alter table t1 add column a int, algorithm=copy;
  db.opt
@@ -149,7 +149,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -515,12 +547,14 @@ t1	CREATE TABLE `t1` (
+@@ -518,12 +550,14 @@
    `a` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -167,7 +167,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -528,13 +562,15 @@ t1	CREATE TABLE `t1` (
+@@ -531,13 +565,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -186,7 +186,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -543,12 +579,14 @@ t1	CREATE TABLE `t1` (
+@@ -546,12 +582,14 @@
    PRIMARY KEY (`id`),
    KEY `a` (`id`),
    VECTOR KEY `v` (`v`)
@@ -204,7 +204,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -556,13 +594,15 @@ t1	CREATE TABLE `t1` (
+@@ -559,13 +597,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -223,7 +223,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -571,12 +611,14 @@ t1	CREATE TABLE `t1` (
+@@ -574,12 +614,14 @@
    PRIMARY KEY (`id`),
    KEY `a` (`id`),
    VECTOR KEY `v` (`v`)
@@ -241,7 +241,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -584,13 +626,15 @@ t1	CREATE TABLE `t1` (
+@@ -587,13 +629,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -260,7 +260,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -599,12 +643,14 @@ t1	CREATE TABLE `t1` (
+@@ -602,12 +646,14 @@
    `a` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -278,7 +278,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -612,24 +658,27 @@ t1	CREATE TABLE `t1` (
+@@ -615,24 +661,27 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -311,7 +311,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -637,24 +686,27 @@ t1	CREATE TABLE `t1` (
+@@ -640,24 +689,27 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -344,7 +344,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -662,7 +714,7 @@ t1	CREATE TABLE `t1` (
+@@ -665,7 +717,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -353,7 +353,7 @@
  # ADD/DR
```

**File**: `mysql-test/main/vector,myisam.rdiff` (modified, +61/-24)
```diff
@@ -1,6 +1,6 @@
---- vector.result
-+++ vector,myisam.reject
-@@ -388,8 +388,30 @@
+--- a/mysql-test/main/vector.result
++++ b/mysql-test/main/vector.result
+@@ -391,8 +391,30 @@
  create table t1 (id int auto_increment primary key, v vector(5) not null, vector index (v));
  insert t1 (id, v) values (1, x'e360d63ebe554f3fcdbc523f4522193f5236083d');
  truncate table t1;
@@ -31,7 +31,7 @@
  insert t1 (id, v) values (1, x'e360d63ebe554f3fcdbc523f4522193f5236083d');
  select id, hex(v) from t1;
  id	hex(v)
-@@ -407,27 +429,33 @@
+@@ -410,27 +432,33 @@
  # Test RENAME TABLE with vector index
  create table t1 (id int auto_increment primary key, v vector(5) not null, vector index (v));
  db.opt
@@ -74,7 +74,7 @@
  drop database test1;
  db.opt
  #
-@@ -504,9 +532,11 @@
+@@ -507,9 +535,11 @@
  # ADD/DROP COLUMN, ALGORITHM=COPY
  alter table t1 add column a int, algorithm=copy;
  db.opt
@@ -88,7 +88,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -515,12 +545,14 @@
+@@ -518,12 +548,14 @@
    `a` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -106,7 +106,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -528,13 +560,15 @@
+@@ -531,13 +563,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -125,7 +125,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -543,12 +577,14 @@
+@@ -546,12 +580,14 @@
    PRIMARY KEY (`id`),
    KEY `a` (`id`),
    VECTOR KEY `v` (`v`)
@@ -143,7 +143,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -556,13 +592,15 @@
+@@ -559,13 +595,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -162,7 +162,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -571,12 +609,14 @@
+@@ -574,12 +612,14 @@
    PRIMARY KEY (`id`),
    KEY `a` (`id`),
    VECTOR KEY `v` (`v`)
@@ -180,7 +180,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -584,13 +624,15 @@
+@@ -587,13 +627,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -199,7 +199,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -599,12 +641,14 @@
+@@ -602,12 +644,14 @@
    `a` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -217,7 +217,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -612,24 +656,27 @@
+@@ -615,24 +659,27 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -250,7 +250,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -637,24 +684,27 @@
+@@ -640,24 +687,27 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -283,7 +283,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -662,7 +712,7 @@
+@@ -665,7 +715,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -292,7 +292,7 @@
  # ADD/DROP INDEX, ALGORITHM=INPLACE (non-vector)
  alter table t1 add index a(id), algorithm=inplace;
  ERROR 0A000: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY
-@@ -685,31 +735,15 @@
+@@ -688,31 +738,15 @@
  alter table t1 modify column v vector(7) not null, algorithm=inplace;
  ERROR 0A000: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY
  # ADD/CHANGE/DROP/MODIFY COLUMN, ALGORITHM=INPLACE (non-vector)
@@ -328,7 +328,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -717,13 +751,15 @@
+@@ -720,13 +754,15 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -347,7 +347,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -731,14 +767,16 @@
+@@ -734,14 +770,16 @@
    `w` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`w`)
@@ -367,7 +367,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -746,7 +784,7 @@
+@@ -749,7 +787,7 @@
    `v` vector(5) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `w` (`v`)
@@ -376,7 +376,7 @@
  alter table t1 rename key w to v;
  # IF [NOT] EXISTS
  create vector index if not exists v on t1(v);
-@@ -757,77 +795,22 @@
+@@ -760,77 +798,22 @@
  Warnings:
  Note	1091	Can't DROP INDEX `v`; check that it exists
  db.opt
@@ -457,7 +457,7 @@
  # CHANGE/MODIFY/DROP COLUMN (vector)
  alter table t1 modify column v int;
  ERROR HY000: Incorrect arguments to VECTOR INDEX
-@@ -839,9 +822,11 @@
+@@ -842,9 +825,11 @@
  ERROR 42000: All parts of a VECTOR index must be NOT NULL
  alter table t1 modify column v vector(7) not null;
  db.opt
@@ -471,7 +471,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -849,12 +834,14 @@
+@@ -852,12 +837,14 @@
    `v` vector(7) NOT NULL,
    PRIMARY KEY (`id`),
    VECTOR KEY `v` (`v`)
@@ -489,7 +489,7 @@
  show create table t1;
  Table	Create Table
  t1	CREATE TABLE `t1` (
-@@ -862,17 
```

**File**: `mysql-test/main/vector.result` (modified, +78/-32)
```diff
@@ -921,66 +921,88 @@ COUNT(*)
 0
 # On empty table
 CREATE TABLE t_vec (id INT PRIMARY KEY, v VECTOR(4) NOT NULL, VECTOR INDEX vi(v));
-SELECT TABLE_SCHEMA = DATABASE() AS schema_ok,
-TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED
+SELECT *
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-schema_ok	TABLE_NAME	INDEX_NAME	VECTOR_DIMENSIONS	SUBDIST_ENABLED
-1	t_vec	vi	4	NO
-SELECT INDEX_SIZE, TOTAL_NODES, CACHED_NODES, MEMORY_SIZE, DELETED_ROWS, CACHE_OVERFLOWS
-FROM INFORMATION_SCHEMA.VECTOR_INDEXES
-WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-INDEX_SIZE	TOTAL_NODES	CACHED_NODES	MEMORY_SIZE	DELETED_ROWS	CACHE_OVERFLOWS
-NULL	0	0	0	NULL	NULL
+TABLE_CATALOG	def
+TABLE_SCHEMA	test
+TABLE_NAME	t_vec
+INDEX_NAME	vi
+VECTOR_DIMENSIONS	4
+INDEX_SIZE	49152
+TOTAL_NODES	1
+CACHED_NODES	0
+DELETED_ROWS	0
+SUBDIST_ENABLED	NO
+MEMORY_SIZE	0
 # After INSERT
 INSERT INTO t_vec VALUES
 (1, VEC_FromText('[1,1,1,1]')),
 (2, VEC_FromText('[2,2,2,2]')),
 (3, VEC_FromText('[3,3,3,3]'));
-SELECT INDEX_SIZE > 0 AS has_disk,
+SELECT
+INDEX_SIZE,
 TOTAL_NODES,
-DELETED_ROWS
+CACHED_NODES,
+DELETED_ROWS,
+MEMORY_SIZE > 0 AS has_mem,
+SUBDIST_ENABLED
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-has_disk	TOTAL_NODES	DELETED_ROWS
-1	3	0
+INDEX_SIZE	49152
+TOTAL_NODES	3
+CACHED_NODES	0
+DELETED_ROWS	0
+has_mem	0
+SUBDIST_ENABLED	NO
 # After search
 SELECT id FROM t_vec ORDER BY vec_distance_euclidean(v, VEC_FromText('[1,2,3,4]')) LIMIT 1;
+id
+3
 SELECT TOTAL_NODES,
 CACHED_NODES,
 MEMORY_SIZE > 0 AS has_mem,
-DELETED_ROWS,
-CACHE_OVERFLOWS
+DELETED_ROWS
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-TOTAL_NODES	CACHED_NODES	has_mem	DELETED_ROWS	CACHE_OVERFLOWS
-3	3	1	0	0
+TOTAL_NODES	3
+CACHED_NODES	3
+has_mem	1
+DELETED_ROWS	0
 # After FLUSH
 FLUSH TABLES t_vec;
-SELECT TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED, CACHED_NODES, CACHE_OVERFLOWS
+SELECT TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED, CACHED_NODES
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-TABLE_NAME	INDEX_NAME	VECTOR_DIMENSIONS	SUBDIST_ENABLED	CACHED_NODES	CACHE_OVERFLOWS
-t_vec	vi	4	NO	0	NULL
+TABLE_NAME	t_vec
+INDEX_NAME	vi
+VECTOR_DIMENSIONS	4
+SUBDIST_ENABLED	NO
+CACHED_NODES	0
 # recover
 SELECT id FROM t_vec ORDER BY vec_distance_euclidean(v, VEC_FromText('[1,2,3,4]')) LIMIT 1;
-SELECT INDEX_SIZE > 0 AS has_disk,
+id
+3
+SELECT INDEX_SIZE,
 TOTAL_NODES,
 CACHED_NODES,
 MEMORY_SIZE > 0 AS has_mem,
-DELETED_ROWS,
-CACHE_OVERFLOWS
+DELETED_ROWS
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-has_disk	TOTAL_NODES	CACHED_NODES	has_mem	DELETED_ROWS	CACHE_OVERFLOWS
-1	3	3	1	0	0
+INDEX_SIZE	49152
+TOTAL_NODES	3
+CACHED_NODES	3
+has_mem	1
+DELETED_ROWS	0
 # DELETED_ROWS approximation
 DELETE FROM t_vec WHERE id = 1;
-SELECT TOTAL_NODES, CACHED_NODES, DELETED_ROWS, CACHE_OVERFLOWS
+SELECT TOTAL_NODES, CACHED_NODES, DELETED_ROWS
 FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-TOTAL_NODES	CACHED_NODES	DELETED_ROWS	CACHE_OVERFLOWS
-3	3	1	0
+TOTAL_NODES	3
+CACHED_NODES	3
+DELETED_ROWS	1
 # VECTOR_DIMENSIONS
 CREATE TABLE t_dim (pk INT PRIMARY KEY, v VECTOR(7) NOT NULL, VECTOR INDEX vi(v));
 SELECT VECTOR_DIMENSIONS FROM INFORMATION_SCHEMA.VECTOR_INDEXES
@@ -992,13 +1014,12 @@ SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 SUBDIST_ENABLED
 NO
-# SUBDIST_ENABLED=YES for dims >= 384
+# SUBDIST_ENABLED=NULL (unknown) for dims >= 384
 CREATE TABLE t_high (pk INT PRIMARY KEY, v VECTOR(384) NOT NULL, VECTOR INDEX vi(v));
 INSERT INTO t_high VALUES (1, VEC_FromText(CONCAT('[', REPEAT('0,', 383), '0]')));
 SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_high';
-SUBDIST_ENABLED
-NULL
+SUBDIST_ENABLED	NULL
 # Multiple tables visible and ordered
 CREATE TABLE t_cos (pk INT PRIMARY KEY, v VECTOR(4) NOT NULL, VECTOR INDEX vi(v) distance=cosine);
 INSERT INTO t_cos VALUES (1, VEC_FromText('[1,1,1,1]'));
@@ -1011,10 +1032,35 @@ t_cos	vi	4
 t_dim	vi	7
 t_high	vi	384
 t_vec	vi	4
+# get_all_tables optimization
+FLUSH TABLES;
+FLUSH STATUS;
+SHOW STATUS LIKE 'open_table%';
+Variable_name	Value
+Open_table_definitions	0
+Open_tables	0
+SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME
+FROM INFORMATION_SCHEMA.VECTOR_INDEXES
+WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_cos';
+TABLE_SCHEMA	TABLE_NAME	INDEX_NAME
+test	t_cos	vi
+SHOW STATUS LIKE 'open_table%';
+Variable_name	Value
+Open_table_definitions	1
+Open_tables	0
+SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SUBDIST_ENABLED
+FROM INFORMATION_SCHEMA.VECTOR_INDEXES
+WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_cos';
+TABLE_SCHEMA	T
```

**File**: `mysql-test/main/vector.test` (modified, +30/-26)
```diff
@@ -472,12 +472,7 @@ SELECT COUNT(*) FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 
 --echo # On empty table
 CREATE TABLE t_vec (id INT PRIMARY KEY, v VECTOR(4) NOT NULL, VECTOR INDEX vi(v));
-SELECT TABLE_SCHEMA = DATABASE() AS schema_ok,
-       TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED
-  FROM INFORMATION_SCHEMA.VECTOR_INDEXES
-  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
-
-SELECT INDEX_SIZE, TOTAL_NODES, CACHED_NODES, MEMORY_SIZE, DELETED_ROWS, CACHE_OVERFLOWS
+query_vertical SELECT *
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
@@ -487,51 +482,47 @@ INSERT INTO t_vec VALUES
   (2, VEC_FromText('[2,2,2,2]')),
   (3, VEC_FromText('[3,3,3,3]'));
 
-# CACHED_NODES and CACHE_OVERFLOWS are omitted here because storage engines
-# differ in whether they retain index cache context after INSERT statements.
-SELECT INDEX_SIZE > 0 AS has_disk,
-       TOTAL_NODES,
-       DELETED_ROWS
+query_vertical SELECT
+  INDEX_SIZE,
+  TOTAL_NODES,
+  CACHED_NODES,
+  DELETED_ROWS,
+  MEMORY_SIZE > 0 AS has_mem,
+  SUBDIST_ENABLED
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
 --echo # After search
---disable_result_log
 SELECT id FROM t_vec ORDER BY vec_distance_euclidean(v, VEC_FromText('[1,2,3,4]')) LIMIT 1;
---enable_result_log
 
-SELECT TOTAL_NODES,
+query_vertical SELECT TOTAL_NODES,
        CACHED_NODES,
        MEMORY_SIZE > 0 AS has_mem,
-       DELETED_ROWS,
-       CACHE_OVERFLOWS
+       DELETED_ROWS
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
 --echo # After FLUSH
 FLUSH TABLES t_vec;
 
-SELECT TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED, CACHED_NODES, CACHE_OVERFLOWS
+query_vertical SELECT TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS, SUBDIST_ENABLED, CACHED_NODES
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
 --echo # recover
---disable_result_log
 SELECT id FROM t_vec ORDER BY vec_distance_euclidean(v, VEC_FromText('[1,2,3,4]')) LIMIT 1;
---enable_result_log
 
-SELECT INDEX_SIZE > 0 AS has_disk,
+query_vertical SELECT INDEX_SIZE,
        TOTAL_NODES,
        CACHED_NODES,
        MEMORY_SIZE > 0 AS has_mem,
-       DELETED_ROWS,
-       CACHE_OVERFLOWS
+       DELETED_ROWS
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
 --echo # DELETED_ROWS approximation
 DELETE FROM t_vec WHERE id = 1;
-SELECT TOTAL_NODES, CACHED_NODES, DELETED_ROWS, CACHE_OVERFLOWS
+query_vertical SELECT TOTAL_NODES, CACHED_NODES, DELETED_ROWS
   FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
@@ -544,10 +535,10 @@ SELECT VECTOR_DIMENSIONS FROM INFORMATION_SCHEMA.VECTOR_INDEXES
 SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_vec';
 
---echo # SUBDIST_ENABLED=YES for dims >= 384
+--echo # SUBDIST_ENABLED=NULL (unknown) for dims >= 384
 CREATE TABLE t_high (pk INT PRIMARY KEY, v VECTOR(384) NOT NULL, VECTOR INDEX vi(v));
 INSERT INTO t_high VALUES (1, VEC_FromText(CONCAT('[', REPEAT('0,', 383), '0]')));
-SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXES
+query_vertical SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_high';
 
 --echo # Multiple tables visible and ordered
@@ -558,9 +549,22 @@ SELECT TABLE_NAME, INDEX_NAME, VECTOR_DIMENSIONS
   WHERE TABLE_SCHEMA = DATABASE()
   ORDER BY TABLE_NAME;
 
+--echo # get_all_tables optimization
+FLUSH TABLES;
+FLUSH STATUS;
+SHOW STATUS LIKE 'open_table%';
+SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME
+FROM INFORMATION_SCHEMA.VECTOR_INDEXES
+  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_cos';
+SHOW STATUS LIKE 'open_table%';
+SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SUBDIST_ENABLED
+FROM INFORMATION_SCHEMA.VECTOR_INDEXES
+  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_cos';
+SHOW STATUS LIKE 'open_table%';
+
 --echo # Dropping tables
 DROP TABLE t_vec, t_cos, t_high, t_dim;
 SELECT COUNT(*) FROM INFORMATION_SCHEMA.VECTOR_INDEXES
   WHERE TABLE_SCHEMA = DATABASE();
 
---echo # End of MDEV-34805 tests
+--echo # End of 13.1 tests
```

**File**: `mysql-test/main/vector2_notembedded.result` (modified, +41/-0)
```diff
@@ -118,3 +118,44 @@ select v from t order by vec_distance_euclidean(0x32323232,v) limit 1;
 v
 1111
 drop table t;
+#
+# MDEV-40793 User has access to vector info in VECTOR_INDEXES without access to column
+#
+create database db;
+create table db.t(a int, u int, v vector(1) not null, unique(u), vector(v));
+create user u@localhost;
+grant select(a) on db.t to u@localhost;
+connect u,localhost,u;
+select a from db.t;
+a
+select u from db.t;
+ERROR 42000: SELECT command denied to user 'u'@'localhost' for column 'u' in table 't'
+select v from db.t;
+ERROR 42000: SELECT command denied to user 'u'@'localhost' for column 'v' in table 't'
+select table_name, index_name from information_schema.statistics where table_schema = 'db';
+table_name	index_name
+select table_name, constraint_name from information_schema.table_constraints where table_schema = 'db';
+table_name	constraint_name
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+table_name	index_name
+connection default;
+grant update(a) on db.t to u@localhost;
+connection u;
+select table_name, index_name from information_schema.statistics where table_schema = 'db';
+table_name	index_name
+select table_name, constraint_name from information_schema.table_constraints where table_schema = 'db';
+table_name	constraint_name
+t	u
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+table_name	index_name
+connection default;
+grant select(v) on db.t to u@localhost;
+connection u;
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+table_name	index_name
+t	v
+disconnect u;
+connection default;
+drop database db;
+drop user u@localhost;
+# End of 13.1 tests
```

**File**: `mysql-test/main/vector2_notembedded.test` (modified, +38/-0)
```diff
@@ -64,3 +64,41 @@ repair table t extended;
 check table t extended;
 select v from t order by vec_distance_euclidean(0x32323232,v) limit 1;
 drop table t;
+
+--echo #
+--echo # MDEV-40793 User has access to vector info in VECTOR_INDEXES without access to column
+--echo #
+
+create database db;
+create table db.t(a int, u int, v vector(1) not null, unique(u), vector(v));
+create user u@localhost;
+grant select(a) on db.t to u@localhost;
+
+--connect u,localhost,u
+select a from db.t;
+--error ER_COLUMNACCESS_DENIED_ERROR
+select u from db.t;
+--error ER_COLUMNACCESS_DENIED_ERROR
+select v from db.t;
+select table_name, index_name from information_schema.statistics where table_schema = 'db';
+select table_name, constraint_name from information_schema.table_constraints where table_schema = 'db';
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+
+--connection default
+grant update(a) on db.t to u@localhost;
+--connection u
+select table_name, index_name from information_schema.statistics where table_schema = 'db';
+select table_name, constraint_name from information_schema.table_constraints where table_schema = 'db';
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+
+--connection default
+grant select(v) on db.t to u@localhost;
+--connection u
+select table_name, index_name from information_schema.vector_indexes where table_schema = 'db';
+
+--disconnect u
+--connection default
+drop database db;
+drop user u@localhost;
+
+--echo # End of 13.1 tests
```

**File**: `mysql-test/suite/funcs_1/r/is_columns_is.result` (modified, +12/-12)
```diff
@@ -620,17 +620,17 @@ def	information_schema	USER_STATISTICS	TOTAL_CONNECTIONS	2	NULL	NO	int	NULL	NULL
 def	information_schema	USER_STATISTICS	TOTAL_SSL_CONNECTIONS	26	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(21) unsigned			select		NEVER	NULL	NO	NO	
 def	information_schema	USER_STATISTICS	UPDATE_COMMANDS	18	NULL	NO	bigint	NULL	NULL	19	0	NULL	NULL	NULL	bigint(21)			select		NEVER	NULL	NO	NO	
 def	information_schema	USER_STATISTICS	USER	1	NULL	NO	varchar	128	384	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(128)			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	CACHED_NODES	7	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	CACHE_OVERFLOWS	11	NULL	YES	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	DELETED_ROWS	8	NULL	YES	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	INDEX_NAME	3	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	INDEX_SIZE	5	NULL	YES	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	MEMORY_SIZE	10	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	SUBDIST_ENABLED	9	NULL	YES	varchar	3	9	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(3)			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	TABLE_NAME	2	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	TABLE_SCHEMA	1	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	TOTAL_NODES	6	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
-def	information_schema	VECTOR_INDEXES	VECTOR_DIMENSIONS	4	NULL	NO	int	NULL	NULL	10	0	NULL	NULL	NULL	int(10) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	CACHED_NODES	8	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	DELETED_ROWS	9	NULL	YES	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	INDEX_NAME	4	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	INDEX_SIZE	6	NULL	YES	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	MEMORY_SIZE	11	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	SUBDIST_ENABLED	10	NULL	YES	varchar	3	9	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(3)			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	TABLE_CATALOG	1	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	TABLE_NAME	3	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	TABLE_SCHEMA	2	NULL	NO	varchar	64	192	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(64)			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	TOTAL_NODES	7	NULL	NO	bigint	NULL	NULL	20	0	NULL	NULL	NULL	bigint(19) unsigned			select		NEVER	NULL	NO	NO	
+def	information_schema	VECTOR_INDEXES	VECTOR_DIMENSIONS	5	NULL	NO	int	NULL	NULL	10	0	NULL	NULL	NULL	int(10) unsigned			select		NEVER	NULL	NO	NO	
 def	information_schema	VIEWS	ALGORITHM	11	NULL	NO	varchar	10	30	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(10)			select		NEVER	NULL	NO	NO	
 def	information_schema	VIEWS	CHARACTER_SET_CLIENT	9	NULL	NO	varchar	32	96	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(32)			select		NEVER	NULL	NO	NO	
 def	information_schema	VIEWS	CHECK_OPTION	5	NULL	NO	varchar	8	24	NULL	NULL	NULL	utf8mb3	utf8mb3_general_ci	varchar(8)			select		NEVER	NULL	NO	NO	
@@ -1326,6 +1326,7 @@ NULL	information_schema	USER_STATISTICS	ACCESS_DENIED	bigint	NULL	NULL	NULL	NULL
 NULL	information_schema	USER_STATISTICS	EMPTY_QUERIES	bigint	NULL	NULL	NULL	NULL	bigint(21)
 NULL	information_schema	USER_STATISTICS	TOTAL_SSL_CONNECTIONS	bigint	NULL	NULL	NULL	NULL	bigint(21) unsigned
 NULL	information_schema	USER_STATISTICS	MAX_STATEMENT_TIME_EXCEEDED	bigint	NULL	NULL	NULL	NULL	bigint(21)
+3.0000	information_schema	VECTOR_INDEXES	TABLE_CATALOG	varchar	64	192	utf8mb3	utf8mb3_general_ci	varchar(64)
 3.0000	information_schema	VECTOR_INDEXES	TABLE_SCHEMA	varchar	64	192	utf8mb3	utf8mb3_general_ci	varchar(64)
 3.0000	information_sc
```

---

### Incident Patch 8: `f09e3b61` (2026-07-07)
**Commit Message**: Removed some not needed checks and add a DBUG_ASSERT() for not covered code

- In ha_partition.cc:check_parallel_search(), remove check if
  item_field->field is null. This is not needed as the function is run
  after fix_field() which guarnatees that the field is always set.
- Added DBUG_ASSERT(new_field) to Item_field::fix_fields() to check if a
  select-list item, found by name or alias when resolving ORDER BY/GROUP
  BY/HAVING, can have field == 0. This error path is not covered by any
  mtr test.

**File**: `sql/ha_partition.cc` (modified, +2/-2)
```diff
@@ -7680,7 +7680,7 @@ bool ha_partition::check_parallel_search()
       {
         Field *order_field= ((Item_field *)item)->field;
         DBUG_PRINT("info",("partition order_field: %p", order_field));
-        if (order_field && order_field->table == table_list->table)
+        if (order_field->table == table_list->table)
         {
           Field *part_field= m_part_info->full_part_field_array[0];
           DBUG_PRINT("info",("partition order_field: %p", order_field));
@@ -7723,7 +7723,7 @@ bool ha_partition::check_parallel_search()
       {
         Field *group_field= ((Item_field *)item)->field;
         DBUG_PRINT("info",("partition group_field: %p", group_field));
-        if (group_field && group_field->table == table_list->table)
+        if (group_field->table == table_list->table)
         {
           Field *part_field= m_part_info->full_part_field_array[0];
           DBUG_PRINT("info",("partition group_field: %p", group_field));
```

**File**: `sql/item.cc` (modified, +2/-0)
```diff
@@ -6683,6 +6683,8 @@ bool Item_field::fix_fields(THD *thd, Item **reference)
 
             if (unlikely(new_field == NULL))
             {
+              /* Not known if this can happen. Test coverage is missing */
+              DBUG_ASSERT(new_field);
               /* The column to which we link isn't valid. */
               my_error(ER_BAD_FIELD_ERROR, MYF(0), (*res)->name.str,
                        thd_where(thd));
```

---

### Incident Patch 9: `9d916c46` (2026-08-17)
**Commit Message**: MDEV-40486 [fixup] Clamp max_length at MAX_FIELD_VARCHARLENGTH in Item_func_vec_fromtext::fix_length_and_dec

This allows

create table t1 (v vector(64) not null);
insert into t1 select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;

which was banned in the previous fix
bb0ac437015dec04fbee226745a8eb2bb4825917, though this also introduces
the inconsistency(?) where

create table t1 as select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;

still fails ER_TRUNCATED_WRONG_VALUE

see updated tests

TODO:
- Changes in vector_utf16.result does not look right
- the following tests crashes:

CREATE TABLE t1 (v VECTOR(2));
--error ER_TOO_BIG_FIELDLENGTH
INSERT INTO t1 VALUES (VEC_FROMTEXT(CONCAT('[1.', REPEAT('0',70000), ',2]')));
DROP TABLE t1;

SELECT VEC_FROMTEXT('😀😀😀');

**File**: `mysql-test/main/vector2.result` (modified, +7/-6)
```diff
@@ -160,7 +160,7 @@ drop table t;
 # MDEV-35141 Server crashes in Field_vector::report_wrong_value upon statistic collection
 #
 create table t1 (v vector(64) not null);
-insert into t1 select vec_fromtext(cast(concat('[',group_concat(1),']') as char(130))) from seq_1_to_64;
+insert into t1 select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
 analyze table t1 persistent for all;
 Table	Op	Msg_type	Msg_text
 test.t1	analyze	status	Engine-independent statistics collected
@@ -571,11 +571,11 @@ set sql_mode=@old_sql_mode;
 ## Original testcase
 CREATE TABLE t (a TEXT) AS SELECT '[1]' AS a;
 CREATE TABLE tt AS SELECT VEC_FROMTEXT(a) AS f FROM t;
-ERROR 42000: Column length too big for column 'f' (max = 16383); use BLOB or TEXT instead
+ERROR 22007: Incorrect vector value: '\x00\x00\x80?' for column `test`.`tt`.`f` at row 1
 DROP TABLE t;
 CREATE TABLE t (a LONGBLOB) AS SELECT '[1]' AS a;
 CREATE TABLE tt AS SELECT VEC_FROMTEXT(a) AS f FROM t;
-ERROR 42000: Column length too big for column 'f' (max = 16383); use BLOB or TEXT instead
+ERROR 22007: Incorrect vector value: '\x00\x00\x80?' for column `test`.`tt`.`f` at row 1
 DROP TABLE t;
 ## Another case, which would have failed with ERROR 1292
 ## without the fix
@@ -592,7 +592,7 @@ SELECT VEC_FROMTEXT(concat('[1', repeat(',1', 16382), ']')) AS f;
 DROP TABLE tt;
 CREATE TABLE tt AS
 SELECT VEC_FROMTEXT(concat('[1', repeat(',1', 16383), ']')) AS f;
-ERROR 42000: Column length too big for column 'f' (max = 16383); use BLOB or TEXT instead
+ERROR 22007: Incorrect vector value: '\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00...' for column `test`.`tt`.`f` at row 1
 ## "Zero-dimensional" argument, no change in behaviour after fix
 SELECT VEC_FROMTEXT('[]') as f;
 f
@@ -625,9 +625,10 @@ t2	CREATE TABLE `t2` (
 DROP TABLE t1, t2;
 CREATE TABLE t3 (f VECTOR(0));
 ERROR 42000: Incorrect column specifier for column 'f'
-## Fails because concat('[',group_concat(1),']') is mediumblob
 create view v1 as select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
-ERROR 42000: Column length too big for column 'vec_fromtext(concat('[',group_concat(1),']'))' (max = 16383); use BLOB or TEXT instead
+DROP view v1;
+create table t1 as select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
+ERROR 22007: Incorrect vector value: '\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00\x80?\x00\x00...' for column `test`.`t1`.`vec_fromtext(concat('[',group_concat(1),']'))` at row 65
 ## NULLs
 select vec_fromtext(NULL);
 vec_fromtext(NULL)
```

**File**: `mysql-test/main/vector2.test` (modified, +8/-6)
```diff
@@ -125,7 +125,7 @@ drop table t;
 --echo # MDEV-35141 Server crashes in Field_vector::report_wrong_value upon statistic collection
 --echo #
 create table t1 (v vector(64) not null);
-insert into t1 select vec_fromtext(cast(concat('[',group_concat(1),']') as char(130))) from seq_1_to_64;
+insert into t1 select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
 analyze table t1 persistent for all;
 drop table t1;
 
@@ -453,12 +453,12 @@ set sql_mode=@old_sql_mode;
 
 --echo ## Original testcase
 CREATE TABLE t (a TEXT) AS SELECT '[1]' AS a;
---error ER_TOO_BIG_FIELDLENGTH
+--error ER_TRUNCATED_WRONG_VALUE
 CREATE TABLE tt AS SELECT VEC_FROMTEXT(a) AS f FROM t;
 DROP TABLE t;
 
 CREATE TABLE t (a LONGBLOB) AS SELECT '[1]' AS a;
---error ER_TOO_BIG_FIELDLENGTH
+--error ER_TRUNCATED_WRONG_VALUE
 CREATE TABLE tt AS SELECT VEC_FROMTEXT(a) AS f FROM t;
 DROP TABLE t;
 
@@ -478,7 +478,7 @@ CREATE TABLE tt AS
   SELECT VEC_FROMTEXT(concat('[1', repeat(',1', 16382), ']')) AS f;
 DROP TABLE tt;
 
---error ER_TOO_BIG_FIELDLENGTH
+--error ER_TRUNCATED_WRONG_VALUE
 CREATE TABLE tt AS
   SELECT VEC_FROMTEXT(concat('[1', repeat(',1', 16383), ']')) AS f;
 
@@ -503,9 +503,11 @@ DROP TABLE t1, t2;
 --error ER_WRONG_FIELD_SPEC
 CREATE TABLE t3 (f VECTOR(0));
 
---echo ## Fails because concat('[',group_concat(1),']') is mediumblob
---error ER_TOO_BIG_FIELDLENGTH
 create view v1 as select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
+DROP view v1;
+
+--error ER_TRUNCATED_WRONG_VALUE
+create table t1 as select vec_fromtext(concat('[',group_concat(1),']')) from seq_1_to_64;
 
 --echo ## NULLs
 select vec_fromtext(NULL);
```

**File**: `sql/item_vectorfunc.cc` (modified, +4/-6)
```diff
@@ -196,12 +196,7 @@ bool Item_func_vec_fromtext::fix_length_and_dec(THD *thd)
   else
     maxlen= (maxlen - 1) * 2;
   fix_length_and_charset(maxlen, &my_charset_bin);
-  if (max_length > MAX_FIELD_VARCHARLENGTH)
-  {
-    my_error(ER_TOO_BIG_FIELDLENGTH, MYF(0), name.str,
-             static_cast<ulong>(MAX_FIELD_VARCHARLENGTH / sizeof(float)));
-    return true;
-  }
+  set_if_smaller(max_length, MAX_FIELD_VARCHARLENGTH);
   set_maybe_null();
   return false;
 }
@@ -215,6 +210,9 @@ String *Item_func_vec_fromtext::val_str(String *buf)
   if ((null_value= !value))
     return nullptr;
 
+  if (value->length() > max_length)
+    return nullptr;
+
   buf->length(0);
   buf->set_charset(&my_charset_bin);
   CHARSET_INFO *cs= value->charset();
```

---

### Incident Patch 10: `ff09eefb` (2026-08-18)
**Commit Message**: MDEV-40815: resolveip is not built for the minbuild cmake target

Added the resolveip target to the minbuild target.

**File**: `CMakeLists.txt` (modified, +3/-0)
```diff
@@ -650,6 +650,9 @@ IF(NOT WITHOUT_SERVER)
   IF(WIN32)
     ADD_DEPENDENCIES(minbuild echo mariadb-install-db my_safe_kill mariadb-upgrade-service)
   ENDIF()
+  IF(UNIX)
+    ADD_DEPENDENCIES(minbuild resolveip)
+  ENDIF()
   ADD_CUSTOM_TARGET(smoketest
     COMMAND perl ./mysql-test-run.pl main.1st
     WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/mysql-test)
```

---

### Incident Patch 11: `add63991` (2026-08-17)
**Commit Message**: MDEV-40790 SELECT INTO row_type_of.field crashes the server

The server crashed on DBUG_ASSERT on a SELECT into:
- a `ROW TYPE OF table1` field variable
- a `ROW TYPE OF cursor1` field variable

Fix:

- Adding a class my_var_sp_row_field_by_name
- Adding a method sp_rcontext::set_variable_row_field_by_name()
- Fixing the DBUG_ASSERT

**File**: `mysql-test/main/select_into_row.result` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+#
+# MDEV-40790 SELECT INTO row_type_of.field crashes the server
+#
+# Into an explicit ROW variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW (a INT, b VARCHAR(10));
+SELECT a,b INTO r0 FROM t1;
+SELECT r0.a, r0.b;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into an explicit ROW field variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW (a INT, b VARCHAR(10));
+SELECT a,b INTO r0.a,r0.b FROM t1;
+SELECT r0.a, r0.b;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into an explicit ROW field variable - non-existing field
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW (a INT, b VARCHAR(10));
+SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+END;
+$$
+ERROR HY000: Row variable 'r0' does not have a field 'b1_non_existing'
+DROP TABLE t1;
+# Into a `ROW TYPE OF table1` variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW TYPE OF t1;
+SELECT a,b INTO r0 FROM t1;
+SELECT r0.a, r0.b;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into a `ROW TYPE OF table1` field variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW TYPE OF t1;
+SELECT a,b INTO r0.a,r0.b FROM t1;
+SELECT r0.a, r0.b;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into a `ROW TYPE OF table1` field variable - non-existing field
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE r0 ROW TYPE OF t1;
+SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+END;
+$$
+CALL p1;
+ERROR HY000: Row variable 'r0' does not have a field 'b1_non_existing'
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into a `ROW TYPE OF cursor1` variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE c1 CURSOR FOR SELECT * FROM t1;
+BEGIN
+DECLARE r0 ROW TYPE OF c1;
+SELECT a,b INTO r0 FROM t1;
+SELECT r0.a, r0.b;
+END;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into a `ROW TYPE OF cursor1` field variable
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE c1 CURSOR FOR SELECT * FROM t1;
+BEGIN
+DECLARE r0 ROW TYPE OF c1;
+SELECT a,b INTO r0.a,r0.b FROM t1;
+SELECT r0.a, r0.b;
+END;
+END;
+$$
+CALL p1;
+r0.a	r0.b
+10	b10
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# Into a `ROW TYPE OF cursor1` field variable - non-existing field
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+CREATE PROCEDURE p1()
+BEGIN
+DECLARE c1 CURSOR FOR SELECT * FROM t1;
+BEGIN
+DECLARE r0 ROW TYPE OF c1;
+SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+END;
+END;
+$$
+CALL p1;
+ERROR HY000: Row variable 'r0' does not have a field 'b1_non_existing'
+DROP PROCEDURE p1;
+DROP TABLE t1;
+# End of 12.3 tests
```

**File**: `mysql-test/main/select_into_row.test` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+--echo #
+--echo # MDEV-40790 SELECT INTO row_type_of.field crashes the server
+--echo #
+
+
+--echo # Into an explicit ROW variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW (a INT, b VARCHAR(10));
+  SELECT a,b INTO r0 FROM t1;
+  SELECT r0.a, r0.b;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into an explicit ROW field variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW (a INT, b VARCHAR(10));
+  SELECT a,b INTO r0.a,r0.b FROM t1;
+  SELECT r0.a, r0.b;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into an explicit ROW field variable - non-existing field
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+--error ER_ROW_VARIABLE_DOES_NOT_HAVE_FIELD
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW (a INT, b VARCHAR(10));
+  SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+END;
+$$
+DELIMITER ;$$
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF table1` variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW TYPE OF t1;
+  SELECT a,b INTO r0 FROM t1;
+  SELECT r0.a, r0.b;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF table1` field variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW TYPE OF t1;
+  SELECT a,b INTO r0.a,r0.b FROM t1;
+  SELECT r0.a, r0.b;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF table1` field variable - non-existing field
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE r0 ROW TYPE OF t1;
+  SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+END;
+$$
+DELIMITER ;$$
+--error ER_ROW_VARIABLE_DOES_NOT_HAVE_FIELD
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF cursor1` variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE c1 CURSOR FOR SELECT * FROM t1;
+  BEGIN
+    DECLARE r0 ROW TYPE OF c1;
+    SELECT a,b INTO r0 FROM t1;
+    SELECT r0.a, r0.b;
+  END;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF cursor1` field variable
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE c1 CURSOR FOR SELECT * FROM t1;
+  BEGIN
+    DECLARE r0 ROW TYPE OF c1;
+    SELECT a,b INTO r0.a,r0.b FROM t1;
+    SELECT r0.a, r0.b;
+  END;
+END;
+$$
+DELIMITER ;$$
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+
+--echo # Into a `ROW TYPE OF cursor1` field variable - non-existing field
+
+CREATE TABLE t1 (a INT,b VARCHAR(10));
+INSERT INTO t1 VALUES (10,'b10');
+DELIMITER $$;
+CREATE PROCEDURE p1()
+BEGIN
+  DECLARE c1 CURSOR FOR SELECT * FROM t1;
+  BEGIN
+    DECLARE r0 ROW TYPE OF c1;
+    SELECT a,b INTO r0.a,r0.b1_non_existing FROM t1;
+  END;
+END;
+$$
+DELIMITER ;$$
+--error ER_ROW_VARIABLE_DOES_NOT_HAVE_FIELD
+CALL p1;
+DROP PROCEDURE p1;
+DROP TABLE t1;
+
+--echo # End of 12.3 tests
```

**File**: `sql/sp_rcontext.cc` (modified, +14/-0)
```diff
@@ -694,6 +694,20 @@ int sp_rcontext::set_variable_row_field(THD *thd, uint var_idx, uint field_idx,
 }
 
 
+int sp_rcontext::set_variable_row_field_by_name(THD *thd, uint var_idx,
+                                            const Lex_ident_sys_st &field_name,
+                                            Item **value)
+{
+  DBUG_ENTER("sp_rcontext::set_variable_row_field");
+  DBUG_ASSERT(value);
+  uint field_idx= 0;
+  if (find_row_field_by_name_or_error(&field_idx, var_idx, field_name))
+    DBUG_RETURN(true);
+  Virtual_tmp_table *vtable= virtual_tmp_table_for_row(var_idx);
+  DBUG_RETURN(thd->sp_eval_expr(vtable->field[field_idx], value));
+}
+
+
 int sp_rcontext::set_variable_row(THD *thd, uint var_idx, List<Item> &items)
 {
   DBUG_ENTER("sp_rcontext::set_variable_row");
```

**File**: `sql/sp_rcontext.h` (modified, +3/-0)
```diff
@@ -209,6 +209,9 @@ class sp_rcontext : public Sql_alloc
   int set_variable(THD *thd, uint var_idx, Item **value);
   int set_variable_row_field(THD *thd, uint var_idx, uint field_idx,
                              Item **value);
+  int set_variable_row_field_by_name(THD *thd, uint var_idx,
+                                     const Lex_ident_sys_st &field_name,
+                                     Item **value);
   int set_variable_row(THD *thd, uint var_idx, List<Item> &items);
 
   int set_variable_composite_field_by_key(THD *thd,
```

**File**: `sql/sql_type_row.cc` (modified, +36/-2)
```diff
@@ -135,6 +135,32 @@ class my_var_sp_row_field: public my_var_sp
 };
 
 
+class my_var_sp_row_field_by_name: public my_var_sp
+{
+  const Lex_ident_sys_st m_field_name;
+public:
+  my_var_sp_row_field_by_name(const Lex_ident_sys_st &varname,
+                              const sp_rcontext_addr &varaddr,
+                              const Lex_ident_sys_st &field_name,
+                              sp_head *s)
+   :my_var_sp(varname, varaddr,
+              &type_handler_double/*Not really used*/, s),
+    m_field_name(field_name)
+  { }
+  bool check_assignability(THD *thd, const List<Item> &select_list,
+                           bool *assign_as_row) const override
+  {
+    *assign_as_row= false;
+    return select_list.elements == 1;
+  }
+  bool set(THD *thd, Item *item) override
+  {
+    return get_rcontext(thd->spcont)->
+             set_variable_row_field_by_name(thd, offset(), m_field_name, &item);
+  }
+};
+
+
 my_var *Type_handler_row::make_outvar(THD *thd,
                                       const Lex_ident_sys_st &name,
                                       const sp_rcontext_addr &addr,
@@ -159,11 +185,19 @@ my_var *Type_handler_row::make_outvar_field(THD *thd,
   DBUG_ASSERT(t);
   DBUG_ASSERT(t->type_handler() == this);
 
+  if (t->field_def.is_table_rowtype_ref() ||
+      t->field_def.is_cursor_rowtype_ref())
+  {
+    if (validate_only)
+      return nullptr;
+    return new (thd->mem_root) my_var_sp_row_field_by_name(name, addr,
+                                                           field, sphead);
+
+  }
   uint row_field_offset;
   if (!t->find_row_field(&name, &field, &row_field_offset))
   {
-    DBUG_ASSERT(0);
-    my_error(ER_ROW_VARIABLE_DOES_NOT_HAVE_FIELD, MYF(0), name.str, field.str);
+    DBUG_ASSERT(thd->is_error());
     return NULL;
   }
   if (validate_only) // e.g. EXPLAIN SELECT .. INTO spvar_row.field;
```

---

### Incident Patch 12: `da184811` (2026-08-17)
**Commit Message**: Addendum to MDEV-20749's fix: addressed Kristian's comments on indenting and #ifdef-ing.

**File**: `sql/log_event_client.cc` (modified, +5/-4)
```diff
@@ -1410,10 +1410,11 @@ static size_t calc_field_event_length(const uchar *ptr, uint type, uint meta)
 
   @return  length of the parsed row image if succeeds, otherwise 0 is returned.
  */
-size_t Rows_log_event::calc_row_event_length(table_def *td,
-                                             MY_BITMAP *cols_bitmap,
-                                             const uchar *value,
-                                             Field_info *fields)
+size_t
+Rows_log_event::calc_row_event_length(table_def *td,
+                                      MY_BITMAP *cols_bitmap,
+                                      const uchar *value,
+                                      Field_info *fields)
 {
   const uchar *value0= value;
   const uchar *null_bits= value;
```

**File**: `sql/log_event_server.cc` (modified, +0/-2)
```diff
@@ -6902,7 +6902,6 @@ bool Table_map_log_event::write_data_body(Log_event_writer *writer)
   uchar mbuf[MAX_INT_WIDTH];
   uchar *const mbuf_end= net_store_length(mbuf, m_field_metadata_size);
 
-#ifndef DBUG_OFF
   DBUG_EXECUTE_IF("flashback_corrupt_blob_metadata", {
     if (m_dbnam && m_tblnam && m_dblen == 4 &&
         memcmp(m_dbnam, "test", 4) == 0 && m_tbllen == 2 &&
@@ -6912,7 +6911,6 @@ bool Table_map_log_event::write_data_body(Log_event_writer *writer)
       m_field_metadata[0]= 5;
     }
   });
-#endif
 
   return write_data(writer, dbuf, sizeof(dbuf)) ||
          write_data(writer, m_dbnam, m_dblen + 1) ||
```

---

### Incident Patch 13: `0e466539` (2025-12-20)
**Commit Message**: cleanup: remove buggy str2int, replace with a template

remove one str->int implementation (we still have 10+ more),
replace with a convenience template that calls my_strntoll_8bit()

**File**: `client/mysql.cc` (modified, +1/-1)
```diff
@@ -5389,7 +5389,7 @@ static int com_status(String *, char *)
     ulong sec;
     /* print label */
     tee_fprintf(stdout, "%.*s\t\t\t", (int) (pos-status_str), status_str);
-    if ((status_str= str2int(pos,10,0,LONG_MAX,(long*) &sec)))
+    if ((status_str= str2int(pos,INT16_MAX, 10, &sec)))
     {
       nice_time((double) sec,buff, sizeof(buff),0);
       tee_puts(buff, stdout);			/* print nice time */
```

**File**: `client/mysqladmin.cc` (modified, +1/-1)
```diff
@@ -791,7 +791,7 @@ static int execute_commands(MYSQL *mysql,int argc, char **argv)
 	pos= (char*) strchr(status,' ');
 	*pos++=0;
 	printf("%s\t\t\t",status);			/* print label */
-	if ((status=str2int(pos,10,0,LONG_MAX,(long*) &sec)))
+	if ((status=str2int(pos,1000,10,&sec)))
 	{
 	  nice_time(sec,buff);
 	  puts(buff);				/* print nice time */
```

**File**: `client/mysqltest.cc` (modified, +13/-13)
```diff
@@ -3228,7 +3228,7 @@ set_result_format_version(ulong new_version)
 static void
 do_result_format_version(struct st_command *command)
 {
-  long version;
+  uint version;
   static DYNAMIC_STRING ds_version;
   const struct command_arg result_format_args[] = {
     {"version", ARG_STRING, TRUE, &ds_version, "Version to use"}
@@ -3242,7 +3242,7 @@ do_result_format_version(struct st_command *command)
                      ',');
 
   /* Convert version  number to int */
-  if (!str2int(ds_version.str, 10, (long) 0, (long) INT_MAX, &version))
+  if (!str2int(ds_version.str, ds_version.length, 10, &version))
     die("Invalid version number: '%s'", ds_version.str);
 
   set_result_format_version(version);
@@ -3279,7 +3279,7 @@ do_result_format_version(struct st_command *command)
 
 void var_set_query_get_value(struct st_command *command, VAR *var)
 {
-  long row_no;
+  uint row_no;
   int col_no= -1;
   MYSQL_RES* UNINIT_VAR(res);
   MYSQL* mysql= cur_con->mysql;
@@ -3311,9 +3311,9 @@ void var_set_query_get_value(struct st_command *command, VAR *var)
   DBUG_PRINT("info", ("col: %s", ds_col.str));
 
   /* Convert row number to int */
-  if (!str2int(ds_row.str, 10, (long) 0, (long) INT_MAX, &row_no))
+  if (!str2int(ds_row.str, ds_row.length, 10, &row_no))
     die("Invalid row number: '%s'", ds_row.str);
-  DBUG_PRINT("info", ("row: %s, row_no: %ld", ds_row.str, row_no));
+  DBUG_PRINT("info", ("row: %s, row_no: %u", ds_row.str, row_no));
   dynstr_free(&ds_row);
 
   /* Remove any surrounding "'s from the query - if there is any */
@@ -3373,15 +3373,15 @@ void var_set_query_get_value(struct st_command *command, VAR *var)
   {
     /* Get the value */
     MYSQL_ROW row;
-    long rows= 0;
+    uint rows= 0;
     const char* value= "No such row";
 
     while ((row= mysql_fetch_row(res)))
     {
       if (++rows == row_no)
       {
 
-        DBUG_PRINT("info", ("At row %ld, column %d is '%s'",
+        DBUG_PRINT("info", ("At row %u, column %d is '%s'",
                             row_no, col_no, row[col_no]));
         /* Found the row to get */
         if (row[col_no])
@@ -4359,7 +4359,7 @@ void do_move_file(struct st_command *command)
 
 void do_chmod_file(struct st_command *command)
 {
-  long mode= 0;
+  uint mode= 0;
   int err_code;
   static DYNAMIC_STRING ds_mode;
   static DYNAMIC_STRING ds_file;
@@ -4379,10 +4379,10 @@ void do_chmod_file(struct st_command *command)
 
   /* Parse what mode to set */
   if (ds_mode.length != 4 ||
-      str2int(ds_mode.str, 8, 0, INT_MAX, &mode) == NullS)
+      str2int(ds_mode.str, ds_mode.length, 8, &mode) == NullS)
     die("You must write a 4 digit octal number for mode");
 
-  DBUG_PRINT("info", ("chmod %o %s", (uint)mode, ds_file.str));
+  DBUG_PRINT("info", ("chmod %o %s", mode, ds_file.str));
   err_code= chmod(ds_file.str, mode);
   if (err_code < 0)
     err_code= 1;
@@ -8430,7 +8430,7 @@ void do_get_errcodes(struct st_command *command)
     }
     else
     {
-      long val;
+      uint val;
       char *start= p;
       /* Check that the string passed to str2int only contain digits */
       while (*p && p != end)
@@ -8443,10 +8443,10 @@ void do_get_errcodes(struct st_command *command)
       }
 
       /* Convert the string to int */
-      if (!str2int(start, 10, (long) INT_MIN, (long) INT_MAX, &val))
+      if (!str2int(start, p - start, 10, &val))
 	die("Invalid argument to error: '%s'", command->first_argument);
 
-      to->code.errnum= (uint) val;
+      to->code.errnum= val;
       to->type= ERR_ERRNO;
       DBUG_PRINT("info", ("ERR_ERRNO: %d", to->code.errnum));
     }
```

**File**: `include/m_ctype.h` (modified, +22/-1)
```diff
@@ -2076,9 +2076,30 @@ class Well_formed_prefix: public Well_formed_prefix_status
 
 #endif /* __cplusplus */
 
-
 #ifdef	__cplusplus
 }
 #endif
 
+#ifdef  __cplusplus
+extern "C++" {
+template<typename T> inline char *str2int(const char *s, size_t l, int base, T *val)
+{
+  char *end= const_cast<char*>(s) + l;
+  int err;
+  longlong v= my_strntoll_8bit(&my_charset_latin1, s, l, base, &end, &err);
+  if (!err && static_cast<longlong>(*val= static_cast<T>(v)) != v)
+    err= EDOM;
+  return (errno= err) ? NULL : end;
+}
+
+template<> inline char *str2int<ulonglong>(const char *s, size_t l, int base, ulonglong *val)
+{
+  char *end= const_cast<char*>(s) + l;
+  int err;
+  *val= my_strntoull_8bit(&my_charset_latin1, s, l, base, &end, &err);
+  return (errno= err) ? NULL : end;
+}
+}
+#endif
+
 #endif /* _m_ctype_h */
```

**File**: `include/m_string.h` (modified, +0/-2)
```diff
@@ -163,8 +163,6 @@ extern char *ullstr(longlong value,char *buff);
 
 extern char *int2str(long val, char *dst, int radix, int upcase);
 extern char *int10_to_str(long val,char *dst,int radix);
-extern char *str2int(const char *src,int radix,long lower,long upper,
-			 long *val);
 longlong my_strtoll10(const char *nptr, char **endptr, int *error);
 #if SIZEOF_LONG == SIZEOF_LONG_LONG
 #define ll2str(A,B,C,D) int2str((A),(B),(C),(D))
```

**File**: `mysys/my_init.c` (modified, +6/-4)
```diff
@@ -62,12 +62,14 @@ ulonglong   my_thread_stack_size= (sizeof(void*) <= 4)? 65536: ((256-16)*1024);
 
 static mode_t atoi_octal(const char *str)
 {
-  long int tmp;
+  long long tmp;
+  int err;
   while (*str && my_isspace(&my_charset_latin1, *str))
     str++;
-  str2int(str,
-	  (*str == '0' ? 8 : 10),       /* Octalt or decimalt */
-	  0, INT_MAX, &tmp);
+  tmp= my_strntoul_8bit(&my_charset_latin1, str, strlen(str),
+                        (*str == '0' ? 8 : 10),       /* Octal or decimal */
+                        NULL, &err);
+
   return (mode_t) tmp;
 }
 
```

**File**: `sql/rpl_info_file.h` (modified, +2/-2)
```diff
@@ -295,15 +295,15 @@ struct Info_file
   bool
   load_from_file(const Mem_fn *values, size_t size, size_t default_line_count)
   {
-    long val;
+    int val;
     /**
       The first row is temporarily stored in the first value. If it is a line
       count and not a log name (new format), the second row will overwrite it.
     */
     auto &line1= dynamic_cast<String_value<> &>(values[0](this));
     if (line1.load_from(&file))
       return true;
-    char *end= str2int(line1.buf, 10, 0, INT32_MAX, &val);
+    char *end= str2int(line1.buf, sizeof(line1.buf), 10, &val);
     /**
       If this first line was not a number - the line count,
       then it was the first value for real,
```

**File**: `sql/rpl_master_info_file.h` (modified, +6/-6)
```diff
@@ -249,7 +249,7 @@ struct Master_info_file: Info_file
 
     bool load_from(IO_CACHE *file) override
     {
-      long count;
+      int count;
       size_t i;
       /// +1 for the terminating delimiter
       char buf[Int_IO_CACHE::BUF_SIZE<uint32_t> + 1];
@@ -262,13 +262,13 @@ struct Master_info_file: Info_file
         if (c == /* End of Line */ '\n' || c == /* End of Count */ ' ')
           break;
       }
-      char *end= str2int(buf, 10, 1, INT32_MAX, &count);
+      char *end= str2int(buf, i, 10, &count);
       // Reserve enough elements ahead of time.
-      if (!end || allocate_dynamic(&array, count))
+      if (!end || count<0 || allocate_dynamic(&array, count))
         return true;
       while (count--)
       {
-        long value;
+        int value;
         /*
           Check that the previous number ended with a ` `,
           not `\n` or anything else.
@@ -288,8 +288,8 @@ struct Master_info_file: Info_file
           if (c == /* End of Count */ ' ' || c == /* End of Line */ '\n')
             break;
         }
-        end= str2int(buf, 10, 1, INT32_MAX, &value);
-        if (!end)
+        end= str2int(buf, i, 10, &value);
+        if (!end || value <= 0)
           return true;
         ulong id= value;
         bool oom= insert_dynamic(&array, (uchar *)&id);
```

---

### Incident Patch 14: `91156c3d` (2026-08-14)
**Commit Message**: MDEV-40639 Open SYS_REFCURSOR crash, if many cursors inside a function

Problem:

If:
- A routine A() opened a SYS_REFCURSOR with a function B() in the SELECT list
- The function B() also opened some SYS_REFCURSORs

Then reallocation of the cursor array THD::m_statement_cursors could happen
during the execution of B(), so all sp_cursor_array_element pointers inside
sp_instr_copen_by_ref::exec_core() of routine A() became invalid.

Fix:

Chaging the data type of sp_cursor_array:
- from Dynamic_array<sp_cursor_array_element>
- to Dynamic_array<sp_cursor_array_element*>

So now only reallocations of the array of cursor pointers happen,
while sp_cursor_array_element instances always stay on their originally
allocated memory positions.

Note:
sp_cursor_array_element instances are allocated using the standart C++ "new"
and deleted using the standard C++ "delete". Using a MEM_ROOT does not
seem to be relevant here.

**File**: `mysql-test/main/sp-sys_refcursor.result` (modified, +53/-0)
```diff
@@ -442,3 +442,56 @@ END$
 a
 116
 SET @@max_open_cursors = DEFAULT;
+#
+# MDEV-40639 Open SYS_REFCURSOR crash, if many cursors inside a function
+#
+CREATE FUNCTION trigger_realloc() RETURNS INT
+BEGIN
+DECLARE c1  SYS_REFCURSOR;
+DECLARE c2  SYS_REFCURSOR;
+DECLARE c3  SYS_REFCURSOR;
+DECLARE c4  SYS_REFCURSOR;
+DECLARE c5  SYS_REFCURSOR;
+DECLARE c6  SYS_REFCURSOR;
+DECLARE c7  SYS_REFCURSOR;
+DECLARE c8  SYS_REFCURSOR;
+DECLARE c9  SYS_REFCURSOR;
+DECLARE c10 SYS_REFCURSOR;
+DECLARE c11 SYS_REFCURSOR;
+DECLARE c12 SYS_REFCURSOR;
+DECLARE c13 SYS_REFCURSOR;
+DECLARE c14 SYS_REFCURSOR;
+DECLARE c15 SYS_REFCURSOR;
+DECLARE c16 SYS_REFCURSOR;
+DECLARE c17 SYS_REFCURSOR;
+OPEN c1  FOR SELECT 1;
+OPEN c2  FOR SELECT 1;
+OPEN c3  FOR SELECT 1;
+OPEN c4  FOR SELECT 1;
+OPEN c5  FOR SELECT 1;
+OPEN c6  FOR SELECT 1;
+OPEN c7  FOR SELECT 1;
+OPEN c8  FOR SELECT 1;
+OPEN c9  FOR SELECT 1;
+OPEN c10 FOR SELECT 1;
+OPEN c11 FOR SELECT 1;
+OPEN c12 FOR SELECT 1;
+OPEN c13 FOR SELECT 1;
+OPEN c14 FOR SELECT 1;
+OPEN c15 FOR SELECT 1;
+OPEN c16 FOR SELECT 1;
+OPEN c17 FOR SELECT 1;
+RETURN 1;
+END;
+$$
+CREATE PROCEDURE trigger_uaf()
+BEGIN
+DECLARE c SYS_REFCURSOR;
+OPEN c FOR SELECT trigger_realloc();
+END;
+$$
+SET SESSION max_open_cursors= 100;
+CALL trigger_uaf();
+SET SESSION max_open_cursors= DEFAULT;
+DROP PROCEDURE trigger_uaf;
+DROP FUNCTION trigger_realloc;
```

**File**: `mysql-test/main/sp-sys_refcursor.test` (modified, +61/-0)
```diff
@@ -466,3 +466,64 @@ BEGIN NOT ATOMIC
 END$
 delimiter ;$
 SET @@max_open_cursors = DEFAULT;
+
+
+--echo #
+--echo # MDEV-40639 Open SYS_REFCURSOR crash, if many cursors inside a function
+--echo #
+
+DELIMITER $$;
+# Function that forces cursor array reallocation (17 > default 16 slots)
+CREATE FUNCTION trigger_realloc() RETURNS INT
+BEGIN
+  DECLARE c1  SYS_REFCURSOR;
+  DECLARE c2  SYS_REFCURSOR;
+  DECLARE c3  SYS_REFCURSOR;
+  DECLARE c4  SYS_REFCURSOR;
+  DECLARE c5  SYS_REFCURSOR;
+  DECLARE c6  SYS_REFCURSOR;
+  DECLARE c7  SYS_REFCURSOR;
+  DECLARE c8  SYS_REFCURSOR;
+  DECLARE c9  SYS_REFCURSOR;
+  DECLARE c10 SYS_REFCURSOR;
+  DECLARE c11 SYS_REFCURSOR;
+  DECLARE c12 SYS_REFCURSOR;
+  DECLARE c13 SYS_REFCURSOR;
+  DECLARE c14 SYS_REFCURSOR;
+  DECLARE c15 SYS_REFCURSOR;
+  DECLARE c16 SYS_REFCURSOR;
+  DECLARE c17 SYS_REFCURSOR;
+  OPEN c1  FOR SELECT 1;
+  OPEN c2  FOR SELECT 1;
+  OPEN c3  FOR SELECT 1;
+  OPEN c4  FOR SELECT 1;
+  OPEN c5  FOR SELECT 1;
+  OPEN c6  FOR SELECT 1;
+  OPEN c7  FOR SELECT 1;
+  OPEN c8  FOR SELECT 1;
+  OPEN c9  FOR SELECT 1;
+  OPEN c10 FOR SELECT 1;
+  OPEN c11 FOR SELECT 1;
+  OPEN c12 FOR SELECT 1;
+  OPEN c13 FOR SELECT 1;
+  OPEN c14 FOR SELECT 1;
+  OPEN c15 FOR SELECT 1;
+  OPEN c16 FOR SELECT 1;
+  OPEN c17 FOR SELECT 1;
+  RETURN 1;
+END;
+$$
+
+CREATE PROCEDURE trigger_uaf()
+BEGIN
+  DECLARE c SYS_REFCURSOR;
+  OPEN c FOR SELECT trigger_realloc();
+END;
+$$
+DELIMITER ;$$
+
+SET SESSION max_open_cursors= 100;
+CALL trigger_uaf();
+SET SESSION max_open_cursors= DEFAULT;
+DROP PROCEDURE trigger_uaf;
+DROP FUNCTION trigger_realloc;
```

**File**: `sql/sp_cursor.cc` (modified, +7/-4)
```diff
@@ -48,8 +48,11 @@ bool sp_cursor::check_for_open(THD *thd, bool check_open_cursor_counter) const
 */
 Type_ref_null sp_cursor_array::append(THD *thd)
 {
-  if (Dynamic_array::append(sp_cursor_array_element()))
+  sp_cursor_array_element *elem= new sp_cursor_array_element();
+  if (!elem || Dynamic_array::append(elem))
   {
+    if (!elem)
+      my_error(ER_OUTOFMEMORY, MYF(0), (int) sizeof(sp_cursor_array_element));
     DBUG_ASSERT(thd->is_error());
     return Type_ref_null();
   }
@@ -70,7 +73,7 @@ sp_cursor_array_element *sp_cursor_array::get_cursor_by_ref(THD *thd,
 {
   Type_ref_null ref= ref_field->val_ref(thd);
   if (ref < (ulonglong) elements())
-    return &at((size_t) ref.value());// "ref" points to an initialized sp_cursor
+    return at((size_t) ref.value());// "ref" points to an initialized sp_cursor
 
   if (!for_open)
     return nullptr;
@@ -88,8 +91,8 @@ sp_cursor_array_element *sp_cursor_array::get_cursor_by_ref(THD *thd,
       ref_field->store_ref(ref, true/*no_conversions*/))
     return nullptr;
 
-  at((size_t) ref.value()).reset(thd, 1/*ref count*/);
-  return &at((size_t) ref.value());
+  at((size_t) ref.value())->reset(thd, 1/*ref count*/);
+  return at((size_t) ref.value());
 }
 
 #endif // MYSQL_SERVER
```

**File**: `sql/sp_cursor.h` (modified, +12/-7)
```diff
@@ -193,14 +193,14 @@ class sp_cursor_array_element: public sp_cursor
 };
 
 
-class sp_cursor_array: public Dynamic_array<sp_cursor_array_element>
+class sp_cursor_array: public Dynamic_array<sp_cursor_array_element*>
 {
 protected:
   Type_ref_null find_unused()
   {
     for (size_t i= 0 ; i < size(); i++)
     {
-      if (!at(i).is_open() && !at(i).ref_count())
+      if (!at(i)->is_open() && !at(i)->ref_count())
         return Type_ref_null((ulonglong) i);
     }
     return Type_ref_null();
@@ -220,20 +220,20 @@ class sp_cursor_array: public Dynamic_array<sp_cursor_array_element>
   ULonglong_null ref_count(ulonglong offset) const
   {
     return offset < elements() ?
-           ULonglong_null((ulonglong) at((size_t) offset).ref_count()) :
+           ULonglong_null((ulonglong) at((size_t) offset)->ref_count()) :
            ULonglong_null();
   }
 
   void ref_count_inc(ulonglong offset)
   {
     if (offset < elements())
-      at((size_t) offset).ref_count_inc();
+      at((size_t) offset)->ref_count_inc();
   }
 
   void ref_count_dec(THD *thd, ulonglong offset)
   {
     if (offset < elements())
-      at((size_t) offset).ref_count_dec(thd);
+      at((size_t) offset)->ref_count_dec(thd);
   }
 
   void ref_count_update(THD *thd, const Type_ref_null &old_value,
@@ -281,13 +281,18 @@ class sp_cursor_array: public Dynamic_array<sp_cursor_array_element>
   {
     for (uint i= 0; i < (uint) size(); i++)
     {
-      if (at(i).is_open())
-        at(i).close(thd);
+      if (at(i)->is_open())
+        at(i)->close(thd);
     }
   }
   void free(THD *thd)
   {
     close(thd);
+    for (uint i= 0; i < (uint) size(); i++)
+    {
+      DBUG_ASSERT(at(i));
+      delete at(i);
+    }
     free_memory();
   }
 };
```

**File**: `sql/sp_rcontext.cc` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ sp_cursor *Sp_rcontext_handler_local::get_cursor(THD *thd, uint offset) const
 
 sp_cursor *Sp_rcontext_handler_statement::get_cursor(THD *thd, uint offset) const
 {
-  return &thd->statement_cursors()->at(offset);
+  return thd->statement_cursors()->at(offset);
 }
 
 sp_cursor *Sp_rcontext_handler_statement::get_cursor_by_ref(THD *thd,
```

---

### Incident Patch 15: `77c8f791` (2026-08-13)
**Commit Message**: MDEV-40749 period.create test leaks/faults in asan

Selecting from the information_schema.plugins causes the loading
of all plugins. Because rockdb leaks, and duckdb triggers an
address sanitizer warning on shutdown avoid this table.

Use the information_schema.ENGINES to validate that InnoDB is
disabled per the original request in the review of MDEV-32205.

**File**: `mysql-test/suite/period/r/create.result` (modified, +3/-3)
```diff
@@ -132,9 +132,9 @@ drop table t2;
 select "yes" from information_schema.tables where engine="innodb" limit 1;
 yes
 yes
-select plugin_status from information_schema.all_plugins where plugin_name = "innodb";
-plugin_status
-DISABLED
+select SUPPORT from information_schema.engines where ENGINE='InnoDB';
+SUPPORT
+NO
 select * from information_schema.periods;
 TABLE_CATALOG	TABLE_SCHEMA	TABLE_NAME	PERIOD	START_COLUMN_NAME	END_COLUMN_NAME
 select * from information_schema.key_period_usage;
```

**File**: `mysql-test/suite/period/t/create.test` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ drop table t2;
 --echo # Make sure innodb id disabled, but there's at least one innodb table
 --disable_warnings
 select "yes" from information_schema.tables where engine="innodb" limit 1;
-select plugin_status from information_schema.all_plugins where plugin_name = "innodb";
+select SUPPORT from information_schema.engines where ENGINE='InnoDB';
 select * from information_schema.periods;
 select * from information_schema.key_period_usage;
 --enable_warnings
```

#### Recent Merged Pull Requests:
- **PR #5815** (closed): MDEV-4632 multi_source.status_vars test fails sporadically in buildbot (@ParadoxV5)
- **PR #5814** (2026-10-05): MDEV-41385 wsrep_sync_wait has no effect after COM_CHANGE_USER       … (@sjaakola)
- **PR #5806** (2026-10-02): crc32c: check elf_aux_info() return value in ppc64 probe (@brad0)
- **PR #5805** (closed): MDEV-39343: Restoring from a mysqldump from older version makes mysql_upgrade version test fail (@mariadb-PranavTiwari)
- **PR #5803** (2026-10-01): 10.11 mdev 37269 (@janlindstrom)
- **PR #5801** (2026-10-03): MDEV-41156: ASAN use-after-poison in JSON_CONTAINS_PATH (@grooverdan)
- **PR #5799** (2026-10-02): MDEV-41303:  rand() in a semi-join subquery is checked on outer rows (@DaveGosselin-MariaDB)
- **PR #5797** (2026-10-02): Added a Contribution Interaction Etiquette section (@gkodinov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
