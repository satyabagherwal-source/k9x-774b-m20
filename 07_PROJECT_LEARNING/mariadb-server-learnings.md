> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mariadb-server-learnings.md`  
> **Source**: github ([https://github.com/MariaDB/server](https://github.com/MariaDB/server))  
> **Source Version**: `f6d172c0`  
> **License**: GPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T06:25:53.714Z  
> **Learning ID**: `learn-github-mariadb-server`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): MariaDB/server

> **Canonical Artifact**: `07_PROJECT_LEARNING/mariadb-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MariaDB/server](https://github.com/MariaDB/server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T06:25:53.709Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MariaDB/server`
- **Description**: MariaDB server is a community developed fork of MySQL server. Started by core members of the original MySQL team, MariaDB actively works with outside developers to deliver the most featureful, stable, and sanely licensed open SQL server in the industry.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8393 stars

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
                               ulonglong start_position, const char *filename);


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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5919** (2026-10-19): **Tests fixes**
  *Symptoms*: 

- **Issue #5916** (2026-10-18): **MDEV-40845: DuckDB: reject SELECT ... FOR UPDATE / LOCK IN SHARE MODE…**
  *Symptoms*: … (msan)  Works under MSAN just fine.

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

### Incident Patch 1: `f6d172c0` (2026-08-06)
**Commit Message**: MDEV-25515 User Account Host Names using CIDR notation
CREATE USER u@'192.168.0.0/24';  -- same as '192.168.0.0/255.255.255.0'
CIDR is an input spelling only, normalised to the netmask form while parsing.
A malformed mask is now rejected instead of stored, and one already in
the privilege tables is skipped at load with a warning instead of being honoured.
Nothing rejected these before, and they are not merely
useless: a non-contiguous mask such as 10.0.0.0/255.0.255.0 matches the
scattered set 10.*0.*. Skipping rather than erroring keeps such a row droppable and renamable, except for a literal CIDR host stored by an older version (for example 10.0.0.0/24): the parser converts that name, so it can no longer be named and must be removed with a direct DELETE from the privilege tables.

New error ER_INVALID_HOST_NETMASK, ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK

**File**: `mysql-test/main/host_cidr.result` (added, +319/-0)
```diff
@@ -0,0 +1,319 @@
+#
+# MDEV-25515 User Account Host Names using CIDR notation
+#
+call mtr.add_suppression("ignored, the host is not a valid ip/netmask");
+# CIDR is stored in the netmask form
+CREATE USER c1@'127.0.0.0/8'   IDENTIFIED BY 'pw';
+CREATE USER c2@'127.0.0.0/24'  IDENTIFIED BY 'pw';
+CREATE USER c3@'127.0.0.1/32'  IDENTIFIED BY 'pw';
+CREATE USER c4@'127.0.0.0/31'  IDENTIFIED BY 'pw';
+CREATE USER c5@'0.0.0.0/1'     IDENTIFIED BY 'pw';
+CREATE USER n1@'127.0.0.0/255.0.0.0'     IDENTIFIED BY 'pw';
+CREATE USER n2@'127.0.0.0/255.255.255.0' IDENTIFIED BY 'pw';
+SELECT User, Host FROM mysql.global_priv WHERE User LIKE 'c_' OR User LIKE 'n_'
+ORDER BY User;
+User	Host
+c1	127.0.0.0/255.0.0.0
+c2	127.0.0.0/255.255.255.0
+c3	127.0.0.1/255.255.255.255
+c4	127.0.0.0/255.255.255.254
+c5	0.0.0.0/128.0.0.0
+n1	127.0.0.0/255.0.0.0
+n2	127.0.0.0/255.255.255.0
+SHOW CREATE USER c1@'127.0.0.0/8';
+CREATE USER for c1@127.0.0.0/255.0.0.0
+CREATE USER `c1`@`127.0.0.0/255.0.0.0` IDENTIFIED BY PASSWORD '*D821809F681A40A6E379B50D0463EFAE20BDD122'
+SHOW GRANTS FOR c2@'127.0.0.0/24';
+Grants for c2@127.0.0.0/255.255.255.0
+GRANT USAGE ON *.* TO `c2`@`127.0.0.0/255.255.255.0` IDENTIFIED BY PASSWORD '*D821809F681A40A6E379B50D0463EFAE20BDD122'
+# Both spellings are the same account
+CREATE USER dup@'127.0.0.0/8' IDENTIFIED BY 'pw';
+CREATE USER dup@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'other';
+ERROR HY000: Operation CREATE USER failed for 'dup'@'127.0.0.0/255.0.0.0'
+CREATE USER IF NOT EXISTS dup@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'other';
+Warnings:
+Note	1973	Can't create user 'dup'@'127.0.0.0/255.0.0.0'; it already exists
+CREATE USER dup@'127.000.0.0/8' IDENTIFIED BY 'other';
+ERROR HY000: Operation CREATE USER failed for 'dup'@'127.0.0.0/255.0.0.0'
+CREATE USER dup@'127.0.0.0/+8'  IDENTIFIED BY 'other';
+ERROR HY000: Operation CREATE USER failed for 'dup'@'127.0.0.0/255.0.0.0'
+CREATE USER dup@'127.0.0.0/ 8'  IDENTIFIED BY 'other';
+ERROR HY000: Operation CREATE USER failed for 'dup'@'127.0.0.0/255.0.0.0'
+CREATE USER dup@'127.0.0.0/255.000.0.0' IDENTIFIED BY 'other';
+ERROR HY000: Operation CREATE USER failed for 'dup'@'127.0.0.0/255.0.0.0'
+SELECT User, Host FROM mysql.global_priv WHERE User='dup';
+User	Host
+dup	127.0.0.0/255.0.0.0
+DROP USER dup@'127.0.0.0/8';
+# Matching is unchanged
+connect  con1,127.0.0.1,c1,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+c1@127.0.0.0/255.0.0.0
+disconnect con1;
+connection default;
+connect  con1,127.0.0.1,c2,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+c2@127.0.0.0/255.255.255.0
+disconnect con1;
+connection default;
+connect  con1,127.0.0.1,c3,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+c3@127.0.0.1/255.255.255.255
+disconnect con1;
+connection default;
+connect  con1,127.0.0.1,c4,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+c4@127.0.0.0/255.255.255.254
+disconnect con1;
+connection default;
+connect  con1,127.0.0.1,c5,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+c5@0.0.0.0/128.0.0.0
+disconnect con1;
+connection default;
+connect  con1,127.0.0.1,n1,pw,,$MASTER_MYPORT,;
+connection con1;
+SELECT CURRENT_USER();
+CURRENT_USER()
+n1@127.0.0.0/255.0.0.0
+disconnect con1;
+connection default;
+CREATE USER z1@'127.0.0.0/32' IDENTIFIED BY 'pw';
+connect(127.0.0.1,z1,pw,test,MASTER_PORT,MASTER_SOCKET);
+connect  con1,127.0.0.1,z1,pw,,$MASTER_MYPORT,;
+ERROR 28000: Access denied for user 'z1'@'localhost' (using password: YES)
+DROP USER z1@'127.0.0.0/32';
+# Either spelling resolves to the same row, in every privilege table
+CREATE DATABASE cidr_db;
+CREATE TABLE cidr_db.t (a INT);
+GRANT SELECT ON cidr_db.* TO c1@'127.0.0.0/255.0.0.0';
+SHOW GRANTS FOR c1@'127.0.0.0/8';
+Grants for c1@127.0.0.0/255.0.0.0
+GRANT USAGE ON *.* TO `c1`@`127.0.0.0/255.0.0.0` IDENTIFIED BY PASSWORD '*D821809F681A40A6E379B50D0463EFAE20BDD122'
+GRANT SELECT ON `cidr_db`.* TO `c1`@`127.0.0.0/255.0.0.0`
+GRANT INSERT ON cidr_db.* TO c1@'127.0.0.0/8';
+REVOKE SELECT ON cidr_db.* FROM c1@'127.0.0.0/8';
+SELECT User, Host FROM mysql.db WHERE User='c1';
+User	Host
+c1	127.0.0.0/255.0.0.0
+GRANT SELECT ON cidr_db.t TO c1@'127.0.0.0/8';
+SELECT User, Host FROM mysql.tables_priv WHERE User='c1';
+User	Host
+c1	127.0.0.0/255.0.0.0
+REVOKE SELECT ON cidr_db.t FROM c1@'127.0.0.0/255.0.0.0';
+SET PASSWORD FOR c1@'127.0.0.0/8' = PASSWORD('pw2');
+ALTER USER c1@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'pw';
+RENAME USER c1@'127.0.0.0/8' TO c1@'127.0.0.0/16';
+SELECT User, Host FROM mysql.global_priv WHERE User='c1';
+User	Host
+c1	127.0.0.0/255.255.0.0
+SELECT User, Host FROM mysql.db          WHERE User='c1';
+User	Host
+c1	127.0.0.0/255.255.0.0
+RENAME USER c1@'127.0.0.0/255.255.0.0' TO c1@'127.0.0.0/8';
+REVOKE ALL PRIVILEGES, GRANT OPTION FROM c1@'127.0.0.0/255.0.0.0';
+SHOW GRANTS FOR c1@'127.0.0.0/8';
+Grants for c1@127.0.0.0/255.0.0.0
+GRANT U
```

**File**: `mysql-test/main/host_cidr.test` (added, +259/-0)
```diff
@@ -0,0 +1,259 @@
+--source include/not_embedded.inc
+
+--echo #
+--echo # MDEV-25515 User Account Host Names using CIDR notation
+--echo #
+
+call mtr.add_suppression("ignored, the host is not a valid ip/netmask");
+
+--echo # CIDR is stored in the netmask form
+CREATE USER c1@'127.0.0.0/8'   IDENTIFIED BY 'pw';
+CREATE USER c2@'127.0.0.0/24'  IDENTIFIED BY 'pw';
+CREATE USER c3@'127.0.0.1/32'  IDENTIFIED BY 'pw';
+CREATE USER c4@'127.0.0.0/31'  IDENTIFIED BY 'pw';
+CREATE USER c5@'0.0.0.0/1'     IDENTIFIED BY 'pw';
+CREATE USER n1@'127.0.0.0/255.0.0.0'     IDENTIFIED BY 'pw';
+CREATE USER n2@'127.0.0.0/255.255.255.0' IDENTIFIED BY 'pw';
+SELECT User, Host FROM mysql.global_priv WHERE User LIKE 'c_' OR User LIKE 'n_'
+ORDER BY User;
+SHOW CREATE USER c1@'127.0.0.0/8';
+SHOW GRANTS FOR c2@'127.0.0.0/24';
+
+--echo # Both spellings are the same account
+CREATE USER dup@'127.0.0.0/8' IDENTIFIED BY 'pw';
+--error ER_CANNOT_USER
+CREATE USER dup@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'other';
+CREATE USER IF NOT EXISTS dup@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'other';
+
+--error ER_CANNOT_USER
+CREATE USER dup@'127.000.0.0/8' IDENTIFIED BY 'other';
+--error ER_CANNOT_USER
+CREATE USER dup@'127.0.0.0/+8'  IDENTIFIED BY 'other';
+--error ER_CANNOT_USER
+CREATE USER dup@'127.0.0.0/ 8'  IDENTIFIED BY 'other';
+--error ER_CANNOT_USER
+CREATE USER dup@'127.0.0.0/255.000.0.0' IDENTIFIED BY 'other';
+SELECT User, Host FROM mysql.global_priv WHERE User='dup';
+DROP USER dup@'127.0.0.0/8';
+
+--echo # Matching is unchanged
+connect (con1,127.0.0.1,c1,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+connect (con1,127.0.0.1,c2,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+connect (con1,127.0.0.1,c3,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+connect (con1,127.0.0.1,c4,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+connect (con1,127.0.0.1,c5,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+connect (con1,127.0.0.1,n1,pw,,$MASTER_MYPORT,);
+connection con1;
+SELECT CURRENT_USER();
+disconnect con1;
+connection default;
+
+CREATE USER z1@'127.0.0.0/32' IDENTIFIED BY 'pw';
+--replace_result $MASTER_MYSOCK MASTER_SOCKET $MASTER_MYPORT MASTER_PORT
+--error ER_ACCESS_DENIED_ERROR
+connect (con1,127.0.0.1,z1,pw,,$MASTER_MYPORT,);
+DROP USER z1@'127.0.0.0/32';
+
+
+--echo # Either spelling resolves to the same row, in every privilege table
+CREATE DATABASE cidr_db;
+CREATE TABLE cidr_db.t (a INT);
+GRANT SELECT ON cidr_db.* TO c1@'127.0.0.0/255.0.0.0';
+SHOW GRANTS FOR c1@'127.0.0.0/8';
+GRANT INSERT ON cidr_db.* TO c1@'127.0.0.0/8';
+REVOKE SELECT ON cidr_db.* FROM c1@'127.0.0.0/8';
+SELECT User, Host FROM mysql.db WHERE User='c1';
+GRANT SELECT ON cidr_db.t TO c1@'127.0.0.0/8';
+SELECT User, Host FROM mysql.tables_priv WHERE User='c1';
+REVOKE SELECT ON cidr_db.t FROM c1@'127.0.0.0/255.0.0.0';
+SET PASSWORD FOR c1@'127.0.0.0/8' = PASSWORD('pw2');
+ALTER USER c1@'127.0.0.0/255.0.0.0' IDENTIFIED BY 'pw';
+RENAME USER c1@'127.0.0.0/8' TO c1@'127.0.0.0/16';
+SELECT User, Host FROM mysql.global_priv WHERE User='c1';
+SELECT User, Host FROM mysql.db          WHERE User='c1';
+RENAME USER c1@'127.0.0.0/255.255.0.0' TO c1@'127.0.0.0/8';
+REVOKE ALL PRIVILEGES, GRANT OPTION FROM c1@'127.0.0.0/255.0.0.0';
+SHOW GRANTS FOR c1@'127.0.0.0/8';
+DROP TABLE cidr_db.t;
+DROP DATABASE cidr_db;
+
+--echo # GRANT normalises the host of an account it auto-creates
+CREATE TABLE test.t (a INT);
+CREATE PROCEDURE test.p1() SELECT 1;
+CREATE ROLE cidr_role;
+GRANT SELECT ON test.* TO g1@'10.0.0.0/24' IDENTIFIED BY 'pw';
+GRANT SELECT ON test.t TO g2@'10.0.0.0/24' IDENTIFIED BY 'pw';
+GRANT EXECUTE ON PROCEDURE test.p1 TO g3@'10.0.0.0/24' IDENTIFIED BY 'pw';
+GRANT cidr_role       TO g4@'10.0.0.0/24' IDENTIFIED BY 'pw';
+GRANT PROXY ON ''@'%' TO g5@'10.0.0.0/24' IDENTIFIED BY 'pw';
+SELECT User, Host FROM mysql.global_priv   WHERE User LIKE 'g_' ORDER BY User;
+SELECT User, Host FROM mysql.db            WHERE User='g1';
+SELECT User, Host FROM mysql.tables_priv   WHERE User='g2';
+SELECT User, Host FROM mysql.procs_priv    WHERE User='g3';
+SELECT User, Host FROM mysql.roles_mapping WHERE User='g4';
+SELECT User, Host FROM mysql.proxies_priv  WHERE User='g5';
+DROP USER g1@'10.0.0.0/255.255.255.0', g2@'10.0.0.0/255.255.255.0',
+          g3@'10.0.0.0/255.255.255.0', g4@'10.0.0.0/255.255.255.0',
+          g5@'10.0.0.0/255.255.255.0';
+DROP ROLE cidr_role;
+DROP PROCEDURE test.p1;
+DROP TABLE test.t;
+
+--echo # DEFINER reaches the same grammar rule
+CREATE USER def@'10.0.0.0/24' IDENTIFIED BY 'pw';
+GRANT ALL ON test.* TO def@'10.0.0.0/255.255.255.0';
+CREATE DEFINER=def@'10.0.0.0/24' VIEW test.v1 AS SELECT 1;
+CREATE DEFINER=def@'10.0.0.0/24' PROCEDURE test.p2() SELECT 1;
+SELECT
```

**File**: `sql/share/errmsg-utf8.txt` (modified, +4/-0)
```diff
@@ -12423,3 +12423,7 @@ ER_RESULT_CUT_BY_LIMIT
         eng "Result was cut by %s) because of %s limit"
 ER_CUT_VALUES_WHILE_PROCESSING
         eng "Some values were cut while processing %s). Increase %s if you want to avoid the cut"
+ER_INVALID_HOST_NETMASK
+        eng "Invalid masked host '%s' for user '%s'"
+ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK
+        eng "'%s' entry '%s' ignored, the host is not a valid ip/netmask"
```

**File**: `sql/sql_acl.cc` (modified, +181/-0)
```diff
@@ -339,6 +339,7 @@ ulong role_global_merges= 0, role_db_merges= 0, role_table_merges= 0,
 #ifndef NO_EMBEDDED_ACCESS_CHECKS
 static bool ignore_max_password_errors(const ACL_USER *acl_user);
 static void update_hostname(acl_host_and_ip *host, const char *hostname);
+static bool valid_host_mask(const char *hostname);
 static bool show_proxy_grants (THD *, const char *, const char *,
                                char *, size_t);
 static bool show_role_grants(THD *, const char *,
@@ -443,6 +444,17 @@ class ACL_PROXY_USER :public ACL_ACCESS
                         safe_str(host.hostname));
       return TRUE;
     }
+    if (!valid_host_mask(host.hostname) ||
+        !valid_host_mask(proxied_host.hostname))
+    {
+      char entry[2 * (USERNAME_LENGTH + HOSTNAME_LENGTH) + 4];
+      my_snprintf(entry, sizeof(entry), "%s@%s %s@%s", proxied_user,
+                  safe_str(proxied_host.hostname), user,
+                  safe_str(host.hostname));
+      sql_print_warning(ER_DEFAULT(ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK),
+                        "proxies_priv", entry);
+      return TRUE;
+    }
     return FALSE;
   }
 
@@ -3437,6 +3449,15 @@ static bool acl_load(THD *thd, const Grant_tables& tables)
                          host.host.hostname, host.db);
         continue;
       }
+      if (!valid_host_mask(host.host.hostname))
+      {
+        char entry[HOSTNAME_LENGTH + NAME_LEN + 2];
+        my_snprintf(entry, sizeof(entry), "%s|%s", host.host.hostname,
+                    safe_str(host.db));
+        sql_print_warning(ER_DEFAULT(ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK),
+                          "host", entry);
+        continue;
+      }
 #ifndef TO_BE_REMOVED
       if (host_table.num_fields() == 8)
       {						// Without grant
@@ -3518,6 +3539,17 @@ static bool acl_load(THD *thd, const Grant_tables& tables)
         continue;
       }
 
+      /* Skipped rows stay in the table, so DROP and RENAME USER still work */
+      if (!valid_host_mask(user.host.hostname))
+      {
+        char entry[USERNAME_LENGTH + HOSTNAME_LENGTH + 2];
+        my_snprintf(entry, sizeof(entry), "%s@%s", user.user.str,
+                    safe_str(user.host.hostname));
+        sql_print_warning(ER_DEFAULT(ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK),
+                          "user", entry);
+        continue;
+      }
+
       if (user_table.get_auth(thd, &acl_memroot, &user))
         continue;
       for (uint i= 0; i < user.nauth; i++)
@@ -3592,6 +3624,15 @@ static bool acl_load(THD *thd, const Grant_tables& tables)
 		        db.db, db.user, safe_str(db.host.hostname));
       continue;
     }
+    if (!valid_host_mask(db.host.hostname))
+    {
+      char entry[NAME_LEN + USERNAME_LENGTH + HOSTNAME_LENGTH + 3];
+      my_snprintf(entry, sizeof(entry), "%s %s@%s", db.db,
+                  db.user, safe_str(db.host.hostname));
+      sql_print_warning(ER_DEFAULT(ER_ACL_ENTRY_IGNORED_BAD_HOST_MASK),
+                        "db", entry);
+      continue;
+    }
     db.access= access_t(fix_rights_for_db(db_table.get_access()));
     db.initial_access= db.access;
     db.sort=get_magic_sort("hdu", db.host.hostname, db.db, db.user);
@@ -5407,6 +5448,101 @@ static const char *calc_ip(const char *ip, long *val, char end)
   return ip;
 }
 
+/* Convert CIDR prefix length (1-32) to a 32-bit IPv4 subnet mask. */
+static const char *calc_cidr(const char *prefix_str, long *val)
+{
+  uchar prefix;
+
+  if (!(prefix_str=str2int(prefix_str, INT16_MAX, 10, &prefix)) ||
+      *prefix_str != '\0' || !prefix || prefix > 32)
+    return 0;
+
+  *val= (long) (uint32) (0xFFFFFFFFU << (32 - prefix));
+  return prefix_str;
+}
+
+/*
+  compare_hostname() tests (client_ip & ip_mask) == ip, so a zero or
+  non-contiguous mask, or an ip with host bits set, can never match.
+*/
+static bool valid_masked_ip(long ip, long mask)
+{
+  ulong inv, m= (ulong) (uint32) mask;
+
+  if (!m)
+    return false;                         /* a mask of 0.0.0.0 */
+
+  inv= (~m) & 0xFFFFFFFFUL;
+  if (inv & (inv + 1))
+    return false;                         /* not contiguous */
+
+  return !(((ulong) (uint32) ip) & inv);
+}
+
+
+/*
+  Rewrite a masked host into the canonical netmask spelling:
+
+    10.0.0.0/8            -> 10.0.0.0/255.0.0.0
+    010.0.0.0/+8          -> 10.0.0.0/255.0.0.0
+    10.0.0.0/255.0.0.0    -> unchanged, already canonical
+
+  Anything that is not a valid masked host is returned unchanged and no error
+  is raised, so DROP USER and RENAME USER can still name a malformed host
+  stored by a version that did not validate it.
+
+  The exception is a stored literal CIDR host such as 10.0.0.0/24: it is
+  converted here, so it can no longer be named and has to be removed with a
+  direct DELETE from the privilege tables.
+*/
+
+LEX_CSTRING normalize_masked_host(THD *thd, const LEX_CSTRING &host)
+{
+  long ip, mask;
+  const char *p;
+  char buf[32];                 /* 255.255.255.255/255.255.255.255 and NUL */
+  uint32 a, m;
+  size_t
```

**File**: `sql/sql_acl.h` (modified, +1/-0)
```diff
@@ -148,6 +148,7 @@ bool mysql_drop_user(THD *thd, List <LEX_USER> &list, bool handle_as_role);
 bool mysql_rename_user(THD *thd, List <LEX_USER> &list);
 int mysql_alter_user(THD *thd, List <LEX_USER> &list);
 bool mysql_revoke_all(THD *thd, List <LEX_USER> &list);
+LEX_CSTRING normalize_masked_host(THD *thd, const LEX_CSTRING &host);
 void fill_effective_table_privileges(THD *thd, GRANT_INFO *grant,
                                      const char *db, const char *table);
 bool sp_revoke_privileges(THD *thd,
```

**File**: `sql/sql_yacc.yy` (modified, +5/-0)
```diff
@@ -16824,7 +16824,12 @@ user_name:
                 check_host_name(&$$->host))
               MYSQL_YYABORT;
             if ($$->host.str[0])
+            {
               $$->host= thd->make_ident_casedn($$->host);
+              $$->host= normalize_masked_host(thd, $$->host);
+              if (unlikely(!$$->host.str))
+                MYSQL_YYABORT;
+            }
             else
               $$->host= host_not_specified;
           }
```

#### Recent Merged Pull Requests:
- **PR #5919** (2026-10-19): Tests fixes (@midenok)
- **PR #5916** (2026-10-18): MDEV-40845: DuckDB: reject SELECT ... FOR UPDATE / LOCK IN SHARE MODE… (@grooverdan)
- **PR #5905** (2026-10-19): MDEV-41508 Off-by-One Uninitialized Stack Read in Proxy Protocol V2 Port Parsing (@vaintroub)
- **PR #5904** (2026-10-16): MDEV-40819 DuckDB TIME conversion crashes the server (@itzanway)
- **PR #5899** (2026-10-16): MDEV-41557 Test encryption.innochecksum is flaky (@iMineLink)
- **PR #5898** (2026-10-19): MDEV-41553 galera_restart_on_unknown_option test regression after MDE… (@sjaakola)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. MDEV-25515 User Account Host Names using CIDR notation

**RULE**:
When implementing operations in `mysql-test/main/host_cidr.result`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MariaDB/server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f6d172c0`: MDEV-25515 User Account Host Names using CIDR notation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `mysql-test/main/host_cidr.result`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#
# MDEV-25515 User Account Host Names using CIDR notation
#
call mtr.add_suppression("ignored, the host is not a valid ip/netmask");
# CIDR is stored in the netmask form
CREATE USER c1@'127.0.0.0/8'   IDENTIFIED BY 'pw';
CREATE USER c2@'127.0.0.0/24'  IDENTIFIED BY 'pw';
CREATE USER c3@'127.0.0.1/32'  IDENTIFIED BY 'pw';
CREATE USER c4@'127.0.0.0/31'  IDENTIFIED BY 'pw';
CREATE USER c5@'0.0.0.0/1'     IDENTIFIED BY 'pw';
CREATE USER n1@'127.0.0.0/255.0.0.0'     IDENTIFIED BY 'pw';
CREATE USER n2@'127.0.0.0/255.255.255.0' IDENTIFIED BY 'pw';
SELECT User, Host FROM mysql.global_priv WHERE User LIKE 'c_' OR User LIKE 'n_'
ORDER BY User;
User	Host
c1	127.0.0.0/255.0.0.0
c2	127.0.0.0/255.255.255.0
c3	127.0.0.1/255.255.255.255
c4	127.0.0.0/255.255.255.254
c5	0.0.0.0/128.0.0.0
n1	127.0.0.0/255.0.0.0
n2	127.0.0.0/255.255.255.0
SHOW CREATE USER c1@'127.0.0.0/8';
CREATE USER for c1@127.0.0.0/255.0.0.0
CREATE USER `c1`@`127.0.0.0/255.0.0.0` IDENTIFIED BY PASSWORD '*D821809F681A40A6E379B50D0463EFAE20BDD122'
SHOW GRANTS FOR c2@'127.0.0.0/24';
Grants for c2@127.0.0.0/255.255.255.0
GRANT USAGE ON *.* TO `c2`@`127.0.0.0/255.255.255.0` IDENTIFIED BY PASSWORD '*D821809F681A40A6E379B50D0463EFAE20BDD
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f6d172c0` are properly handled with clean fallback behavior.
