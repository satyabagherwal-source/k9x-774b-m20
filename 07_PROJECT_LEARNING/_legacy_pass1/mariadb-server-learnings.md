# Forensic Learning Record (Deep Inspection): MariaDB/server

> **Canonical Artifact**: `07_PROJECT_LEARNING/mariadb-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MariaDB/server](https://github.com/MariaDB/server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:55:50.197Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MariaDB/server`
- **Description**: MariaDB server is a community developed fork of MySQL server. Started by core members of the original MySQL team, MariaDB actively works with outside developers to deliver the most featureful, stable, and sanely licensed open SQL server in the industry.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8305 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/async_example.c`
```
/*
  Copyright 2011 Kristian Nielsen and Monty Program Ab.

  This file is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation; either
  version 2.1 of the License, or (at your option) any later version.

  This library is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this.  If not, see <http://www.gnu.org/licenses/>.
*/


#ifndef _WIN32
#include <poll.h>
#else
#include <WinSock2.h>
#endif

#include <stdlib.h>
#include <stdio.h>
#include <mysql.h>

#define SL(s) (s), sizeof(s)

static const char *my_groups[]= { "client", NULL };

static int
wait_for_mysql(MYSQL *mysql, int status)
{
#ifdef _WIN32
  fd_set rs, ws, es;
  int res;
  struct timeval tv, *timeout;
  my_socket s= mysql_get_socket(mysql);
  FD_ZERO(&rs);
  FD_ZERO(&ws);
  FD_ZERO(&es);
  if (status & MYSQL_WAIT_READ)
    FD_SET(s, &rs);
  if (status & MYSQL_WAIT_WRITE)
    FD_SET(s, &ws);
  if (status & MYSQL_WAIT_EXCEPT)
    FD_SET(s, &es);
  if (status & MYSQL_WAIT_TIMEOUT)
  {
    tv.tv_sec= mysql_get_timeout_value(mysql);
    tv.tv_usec= 0;
    timeout= &tv;
  }
  else
    timeout= NULL;
  res= select(1, &rs, &ws, &es, timeout);
  if (res == 0)
    return MYSQL_WAIT_TIMEOUT;
  else if (res == SOCKET_ERROR)
  {
    /*
      In a real event framework, we should handle errors and re-try the select.
    */
    return MYSQL_WAIT_TIMEOUT;
  }
  else
  {
    int status= 0;
    if (FD_ISSET(s, &rs))
      status|= MYSQL_WAIT_READ;
    if (FD_ISSET(s, &ws))
      status|= MYSQL_WAIT_WRITE;
    if (FD_ISSET(s, &es))
      status|= MYSQL_WAIT_EXCEPT;
    return status;
  }
#else
  struct pollfd pfd;
  int timeout;
  int res;

  pfd.fd= mysql_get_socket(mysql);
  pfd.events=
    (status & MYSQL_WAIT_READ ? POLLIN : 0) |
    (status & MYSQL_WAIT_WRITE ? POLLOUT : 0) |
    (status & MYSQL_WAIT_EXCEPT ? POLLPRI : 0);
  if (status & MYSQL_WAIT_TIMEOUT)
    timeout= 1000*mysql_get_timeout_value(mysql);
  else
    timeout= -1;
  res= poll(&pfd, 1, timeout);
  if (res == 0)
    return MYSQL_WAIT_TIMEOUT;
  else if (res < 0)
  {
    /*
      In a real event framework, we should handle EINTR and re-try the poll.
    */
    return MYSQL_WAIT_TIMEOUT;
  }
  else
  {
    int status= 0;
    if (pfd.revents & POLLIN)
      status|= MYSQL_WAIT_READ;
    if (pfd.revents & POLLOUT)
      status|= MYSQL_WAIT_WRITE;
    if (pfd.revents & POLLPRI)
      status|= MYSQL_WAIT_EXCEPT;
    return status;
  }
#endif
}

static void
fatal(MYSQL *mysql, const char *msg)
{
  fprintf(stderr, "%s: %s\n", msg, mysql_error(mysql));
  exit(1);
}

static void
doit(const char *host, const char *user, const char *password)
{
  int err;
  MYSQL mysql, *ret;
  MYSQL_RES *res;
  MYSQL_ROW row;
  int status;

  mysql_init(&mysql);
  mysql_options(&mysql, MYSQL_OPT_NONBLOCK, 0);
  mysql_options(&mysql, MYSQL_READ_DEFAULT_GROUP, "myapp");

  /* Returns 0 when done, else flag for what to wait for when need to block. */
  status= mysql_real_connect_start(&ret, &mysql, host, user, password, NULL,
                                   0, NULL, 0);
  while (status)
  {
    status= wait_for_mysql(&mysql, status);
    status= mysql_real_connect_cont(&ret, &mysql, status);
  }

  if (!ret)
    fatal(&mysql, "Failed to mysql_real_connect()");

  status= mysql_real_query_start(&err, &mysql, SL("SHOW STATUS"));
  while (status)
  {
    status= wait_for_mysql(&mysql, status);
    status= mysql_real_query_cont(&err, &mysql, status);
  }
  if (err)
    fatal(&mysql, "mysql_real_query() returns error");

  /* This method cannot block. */
  res= mysql_use_result(&mysql);
  if (!res)
    fatal(&mysql, "mysql_use_result() returns error");

  for (;;)
  {
    status= mysql_fetch_row_start(&row, res);
    while (status)
    {
      status= wait_for_mysql(&mysql, status);
      status= mysql_fetch_row_cont(&row, res, status);
    }
    if (!row)
      break;
    printf("%s: %s\n", row[0], row[1]);
  }
  if (mysql_errno(&mysql))
    fatal(&mysql, "Got error while retrieving rows");
  mysql_free_result(res);

  /*
    mysql_close() sends a COM_QUIT packet, and so in principle could block
    waiting for the socket to accept the data.
    In practise, for many applications it will probably be fine to use the
    blocking mysql_close().
   */
  status= mysql_close_start(&mysql);
  while (status)
  {
    status= wait_for_mysql(&mysql, status);
    status= mysql_close_cont(&mysql, status);
  }
}

int
main(int argc, char *argv[])
{
  int err;

  if (argc != 4)
  {
    fprintf(stderr, "Usage: %s <host> <user> <password>\n", argv[0]);
    exit(1);
  }

  err= mysql_library_init(argc, argv, (char **)my_groups);
  if (err)
  {
    fprintf(stderr, "Fatal: mysql_library_init() returns error: %d\n", err);
    exit(1);
  }

  doit(argv[1], argv[2], argv[3]);

  mysql_library_end();

  return 0;
}

```

### Core Architecture Module: `client/client_metadata.h`
```
#ifndef SQL_CLIENT_METADATA_INCLUDED
#define SQL_CLIENT_METADATA_INCLUDED
/*
   Copyright (c) 2020, MariaDB Corporation.

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

#include "sql_string.h"


/*
  Print MYSQL_FIELD metadata in human readable format
*/
class Client_field_metadata
{
  const MYSQL_FIELD *m_field;
public:
  Client_field_metadata(MYSQL_FIELD *field)
   :m_field(field)
  { }
  void print_attr(Binary_string *to,
                  const LEX_CSTRING &name,
                  mariadb_field_attr_t attr,
                  uint orig_to_length) const
  {
    MARIADB_CONST_STRING tmp;
    if (!mariadb_field_attr(&tmp, m_field, attr) && tmp.length)
    {
      if (to->length() != orig_to_length)
        to->append(" ", 1);
      to->append(name);
      to->append(tmp.str, tmp.length);
    }
  }
  void print_data_type_related_attributes(Binary_string *to) const
  {
    static const LEX_CSTRING type= {C_STRING_WITH_LEN("type=")};
    static const LEX_CSTRING format= {C_STRING_WITH_LEN("format=")};
    uint to_length_orig= to->length();
    print_attr(to, type, MARIADB_FIELD_ATTR_DATA_TYPE_NAME, to_length_orig);
    print_attr(to, format, MARIADB_FIELD_ATTR_FORMAT_NAME, to_length_orig);
  }
};


#endif // SQL_CLIENT_METADATA_INCLUDED

```

### Core Architecture Module: `client/client_priv.h`
```
/*
   Copyright (c) 2001, 2012, Oracle and/or its affiliates.
   Copyright (c) 2009, 2024, MariaDB

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

/* Common defines for all clients */

#include <my_global.h>
#include <my_sys.h>
#include <m_string.h>
#include <mysql.h>
#include <errmsg.h>
#include <my_getopt.h>
#include <mysql_version.h>

#ifndef WEXITSTATUS
# ifdef _WIN32
#  define WEXITSTATUS(stat_val) (stat_val)
# else
#  define WEXITSTATUS(stat_val) ((unsigned)(stat_val) >> 8)
# endif
#endif

enum options_client
{
  OPT_CHARSETS_DIR=256, OPT_DEFAULT_CHARSET,
  OPT_PAGER, OPT_TEE,
  OPT_OPTIMIZE,
  OPT_TABLES,
  OPT_MASTER_DATA,
  OPT_SSL_KEY, OPT_SSL_CERT, OPT_SSL_CA, OPT_SSL_CAPATH,
  OPT_TLS_VERSION,
  OPT_SSL_CIPHER, OPT_LOCAL_INFILE,
  OPT_COMPACT,
  OPT_MYSQL_PROTOCOL,
  OPT_SKIP_OPTIMIZATION,
  OPT_COMPATIBLE, OPT_DELIMITER,
  OPT_SERVER_ARG,
  OPT_START_DATETIME, OPT_STOP_DATETIME,
  OPT_IGNORE_DATABASE,
  OPT_IGNORE_TABLE,
  OPT_MYSQLDUMP_SLAVE_DATA,
  OPT_SLAP_CSV,
  OPT_BASE64_OUTPUT_MODE,
  OPT_FIX_TABLE_NAMES, OPT_FIX_DB_NAMES,
  OPT_WRITE_BINLOG,
  OPT_PLUGIN_DIR,
  OPT_DEFAULT_AUTH,
  OPT_REWRITE_DB,
  OPT_SSL_CRL, OPT_SSL_CRLPATH,
  OPT_IGNORE_DATA,
  OPT_PRINT_ROW_COUNT, OPT_PRINT_ROW_EVENT_POSITIONS,
  OPT_CHECK_IF_UPGRADE_NEEDED,
  OPT_COMPATIBILTY_CLEARTEXT_PLUGIN,
  OPT_STOP_POSITION,
  OPT_SERVER_ID,
  OPT_IGNORE_DOMAIN_IDS,
  OPT_DO_DOMAIN_IDS,
  OPT_IGNORE_SERVER_IDS,
  OPT_DO_SERVER_IDS,
  OPT_SSL_FP, OPT_SSL_FPLIST,
  OPT_UPDATE_HISTORY,
  OPT_DATABASE,
  OPT_MAX_CLIENT_OPTION /* should be always the last */
};

/**
  First mysql version supporting the information schema.
*/
#define FIRST_INFORMATION_SCHEMA_VERSION 50003

/**
  Name of the information schema database.
*/
#define INFORMATION_SCHEMA_DB_NAME "information_schema"

/**
  First mysql version supporting the performance schema.
*/
#define FIRST_PERFORMANCE_SCHEMA_VERSION 50503

/**
  Name of the performance schema database.
*/
#define PERFORMANCE_SCHEMA_DB_NAME "performance_schema"

/**
  First mariadb version supporting the sys schema.
*/
#define FIRST_SYS_SCHEMA_VERSION 100600

/**
  Name of the sys schema database.
*/
#define SYS_SCHEMA_DB_NAME "sys"

/**
  The --socket CLI option has different meanings
  across different operating systems.
 */
#ifndef _WIN32
#define SOCKET_PROTOCOL_TO_FORCE MYSQL_PROTOCOL_SOCKET
#else
#define SOCKET_PROTOCOL_TO_FORCE MYSQL_PROTOCOL_PIPE
#endif

```

### Core Architecture Module: `client/completion_hash.h`
```
/* Copyright (c) 2000-2002, 2006 MySQL AB
   Use is subject to license terms

   This program is free software; you can redistribute it and/or
   modify it under the terms of the GNU Library General Public
   License as published by the Free Software Foundation; version 2
   of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
   Library General Public License for more details.

   You should have received a copy of the GNU Library General Public
   License along with this library; if not, write to the Free
   Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
   MA 02110-1335  USA */

#ifndef _HASH_
#define _HASH_

#define SUCCESS 0
#define FAILURE 1

#include <sys/types.h>
#include <my_sys.h>

typedef struct _entry {
	char *str;
	struct _entry *pNext;
} entry;

typedef struct bucket
{
  uint h;					/* Used for numeric indexing */
  char *arKey;
  uint nKeyLength;
  uint count;
  entry *pData;
  struct bucket *pNext;
} Bucket;

typedef struct hashtable {
  uint nTableSize;
  uint initialized;
  MEM_ROOT mem_root;
  uint(*pHashFunction) (const char *arKey, uint nKeyLength);
  Bucket **arBuckets;
} HashTable;

extern int completion_hash_init(HashTable *ht, uint nSize);
extern int completion_hash_update(HashTable *ht, char *arKey, uint nKeyLength, char *str);
extern int hash_exists(HashTable *ht, char *arKey);
extern Bucket *find_all_matches(HashTable *ht, const char *str, uint length, uint *res_length);
extern Bucket *find_longest_match(HashTable *ht, char *str, uint length, uint *res_length);
extern void add_word(HashTable *ht,char *str);
extern void completion_hash_clean(HashTable *ht);
extern int completion_hash_exists(HashTable *ht, char *arKey, uint nKeyLength);
extern void completion_hash_free(HashTable *ht);

#endif /* _HASH_ */

```

### Core Architecture Module: `client/connection_pool.h`
```
/*
   Copyright (c) 2023, MariaDB.

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1335
   USA
*/

#pragma once

#include <mysql.h>
#include <vector>
#include <queue>
#include <string>
#ifdef _WIN32
#include <windows.h>
#else
#include <poll.h>
#endif

/*
  Implementation of asynchronous mariadb connection pool.

  This pool consists of set of MYSQL* connections, created by C API
  function. The intention is that all connections have the same state
  same server, by the same user etc.

  The "asynchronous" means the queries are executed on the server
  without waiting for the server reply. The queries are submitted
  with mysql_send_query(), and completions are picked by poll/IOCP.
*/

namespace async_pool
{
typedef void (*query_completion_handler)(MYSQL *mysql, const char *query, bool success, void *context);

struct pooled_connection
#ifdef _WIN32
    : OVERLAPPED
#endif
{
  MYSQL *mysql;
  query_completion_handler on_completion=NULL;
  void *context=NULL;
  std::string query;
  bool in_use=false;
  bool release_connection=false;
#ifdef _WIN32
  bool is_pipe;
  HANDLE handle;
#else
  int fd;
#endif
  pooled_connection(MYSQL *mysql);
};


struct connection_pool
{
private:
  std::vector<pooled_connection> all_connections;
  std::queue<pooled_connection *> free_connections;
  pooled_connection *get_connection();
  void wait_for_completions();
  void complete_query(pooled_connection *c);
  void add_to_pollset(pooled_connection *c);

#ifdef _WIN32
  HANDLE iocp=nullptr;
#else
  std::vector<pollfd> pollset;
#endif
public:
  ~connection_pool();

  /**
    Add connections to the connection pool

    @param con  - connections
    @param n_connections - number of connections
  */
  void init(MYSQL *con[], size_t n_connections);

  /**
  Send query to the connection pool
  Executes query on a connection in the pool, using mysql_send_query

  @param query         - query string
  @param on_completion - callback function to be called on completion
  @param context       - user context that will be passed to the callback function
  @param release_connecton - if true, the connection should be released to the
         pool after the query is executed. If you execute another
         mysql_send_query() on the same connection, set this to false.

  Note: the function will block if there are no free connections in the pool.

  @return return code of mysql_send_query
  */
  int execute_async(const char *query, query_completion_handler on_completion, void *context, bool release_connecton=true);

  /** Waits for all outstanding queries to complete.*/
  void wait_all();

  /** Execute callback for each connection in the pool. */
  void for_each_connection(void (*f)(MYSQL *mysql));

  /**
    Closes all connections in pool and frees all resources.
    Does not wait for pending queries to complete
    (use wait_all() for that)
  */
  int close();
};

} // namespace async_pool

```

### Core Architecture Module: `client/echo.c`
```
/* Copyright (c) 2000, 2007 MySQL AB
   Use is subject to license terms

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1335  USA */

/*
  echo is a replacement for the "echo" command builtin to cmd.exe
  on Windows, to get a Unix equivalent behaviour when running commands
  like:
    $> echo "hello" | mysql

  The windows "echo" would have sent "hello" to mysql while
  Unix echo will send hello without the enclosing hyphens

  This is a very advanced high tech program so take care when
  you change it and remember to valgrind it before production
  use.

*/

#include <stdio.h>

int main(int argc, char **argv)
{
  int i;
  for (i= 1; i < argc; i++)
  {
    fprintf(stdout, "%s", argv[i]);
    if (i < argc - 1)
      fprintf(stdout, " ");
  }
  fprintf(stdout, "\n");
  return 0;
}

```

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

### Core Architecture Module: `client/my_readline.h`
```
#ifndef CLIENT_MY_READLINE_INCLUDED
#define CLIENT_MY_READLINE_INCLUDED

/*
   Copyright (c) 2000, 2011, Oracle and/or its affiliates

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

/* readline for batch mode */

typedef struct st_line_buffer
{
  File file;
  char *buffer;			/* The buffer itself, grown as needed. */
  char *end;			/* Pointer at buffer end */
  char *start_of_line,*end_of_line;
  uint bufread;			/* Number of bytes to get with each read(). */
  uint eof;
  ulong max_size;
  ulong read_length;		/* Length of last read string */
  int error;
  bool truncated;
} LINE_BUFFER;

extern LINE_BUFFER *batch_readline_command(LINE_BUFFER *buffer, char * str);
extern char *batch_readline(LINE_BUFFER *buffer, bool binary_mode);
extern void batch_readline_end(LINE_BUFFER *buffer);
extern bool init_line_buffer(LINE_BUFFER *buffer, File file, ulong size,
                             ulong max_size);

#endif /* CLIENT_MY_READLINE_INCLUDED */

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5794** (2026-09-29): **MDEV-41343 REVOKE DENY FROM PUBLIC allowed with column-level UPDATE**
  *Symptoms*: https://jira.mariadb.org/browse/MDEV-41343  REVOKE DENY .. FROM PUBLIC needs table-level UPDATE privilege for mysql.global_priv. Tighten the privilege check, which also accepted column-level UPDATE, because check_grant() defers the column check.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #5785** (2026-09-29): **MDEV-41075 : Assertion .thd->in_active_multi_stmt in TOI**
  *Symptoms*: Clear OPTION_NOT_AUTOCOMMIT/OPTION_BEGIN before opening the table below, not after. A storage engine may register itself into the "all" transaction as part of the table open/lock (e.g. InnoDB's external_lock()), depending on those bits. Clearing them only after the table is open is too late: the engine has already registered into "all" using the still-set bits, and since record_gtid is meant to be a standalone autocommit-style write, nothing will later issue the matching "all"-level commit to clear that registration and the performance-schema transaction handle, and it leaks into whatever runs on this THD next.

- **Issue #5779** (2026-09-29): **MDEV-40622 : galera.tmp_space_usage fails: Failed to start mysqld.2**
  *Symptoms*: Max_tmp_space_used and Tmp_space_used are binlog cache byte counts that vary by platform. The test compared them against fixed numbers, so a differing byte count failed the test.  The test now checks that both values stay within max_tmp_session_space_usage, and that tmp_space_used resets to 0 after change_user. Test only.

- **Issue #5764** (2026-09-28): **MGL-299 Regression in galera_sst_rsync_encrypt_with_key MTR test**
  *Symptoms*: Commit b68e29a9c64 explicitly disabled use of SSL encryption in SST by setting ssl-mode=DISABLED in the top configuration files. This test is a backward compatibility test so it relies on the deduction of ssl-mode from the presence of tkey and tcert params in [sst] section. Unset ssl-mode in config to allow to derive it from the presence of tkey and tcert.
  **Post-Mortem & Fix Analysis**:
  > Moved as MDEV-41219.

- **Issue #5760** (2026-09-28): **MDEV-40852 Redundant checkpoint after innodb_log_archive startup**
  *Symptoms*: `log_t::set_recovered()`: Do not unnecessarily set the `circular_recovery_from_sequence_bit_0` flag for `innodb_log_archive=ON` format files.  The purpose of the flag is to ensure that an extra checkpoint will be written when converting the log to `innodb_log_archive=OFF` format. The scenario that we want to prevent is that the log originally was in `innodb_log_archive=OFF` format and had wrapped around an odd number of times since the file creation, that is, the sequence bit at the end of the mini-transactions since the latest checkpoint is 0. After a conversion to `innodb_log_archive=ON` format, old records would carry the sequence bit 0 and new ones the bit 1. This is fine, because the recovery will ignore the sequence bit; `innodb_log_archive=ON` files never wrap around. However, when the log is converted back to `innodb_log_archive=OFF` format, we must guarantee that all sequence bits since the latest checkpoint were written as 1.
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/MariaDB/server?pullRequest=5760) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/MariaDB/server?pullRequest=5760) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/MariaDB/server?pullRequest=5760) it.</sub>

- **Issue #5757** (2026-09-24): **MDEV-28746 follow-up: my_win_sopen() missed relative paths overflowing MAX_PATH**
  *Symptoms*: ## Summary  `my_win_sopen()` only checked the length of the *raw* path it was given before deciding whether a failed `CreateFile()` meant `ENAMETOOLONG`. But the server opens table files via paths relative to its data directory, so a short, individually fine-looking relative path can still overflow `MAX_PATH` (260) once resolved against a long enough datadir — a case the original MDEV-28746 fix didn't cover. When that happened, the failure was misreported as `ER_BAD_DB_ERROR` ("Unknown database") instead of `ER_CANT_CREATE_TABLE` / `ENAMETOOLONG` ("Filename too long").  The fix resolves the path via `GetFullPathName()` before deciding: that call returns 0 whenever the resolved path doesn't fit in `MAX_PATH`, the same outcome as when it reports a length `>= MAX_PATH` directly, so both are now treated as `ENAMETOOLONG`.  ## Test plan  - [x] Extended `mysql-test/main/create_windows.test` (Windows-only) with a       case that computes, from the live `@@datadir`, the shortest       identifier whose own relative path stays under `MAX_PATH` but whose       resolved absolute path exceeds it — exactly the case the old code       missed. - [x] Verified `main.create_windows` passes with the fix, and reproduces       the wrong `ER_BAD_DB_ERROR` without it. - [x] Verified no regressions in `main.create`, `main.rename`,       `main.mysql_install_db_win_utf8`.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Closing — branch had unrelated commits inherited from where it was cut off. Reopening against a clean single-commit branch.

- **Issue #5754** (2026-09-25): **MDEV-41297 A stored empty blob never equals an all-space value**
  *Symptoms*: https://jira.mariadb.org/browse/MDEV-41297  Blob values for empty strings should return a pointer to an empty string and not NULL. `hp_materialize_one_blob()` returned NULL, which its callers `hp_rec_key_cmp()` and `hp_key_cmp()` read as an allocation failure.  `hp_test_write_dup-t.c` was extended to test key reads on `TEXT` columns. This could not be done in MTR, as a `MEMORY` table cannot be created with a key on a `TEXT` column. 
  **Post-Mortem & Fix Analysis**:
  > @montywi  picked this for bb-blob-main-monty as b782ca4d4b1.

- **Issue #5750** (2026-09-25): **MDEV-41193: ASAN heap-buffer-overflow in `ha_connect::CheckCond` after select from Connect table**
  *Symptoms*: fixes [MDEV-41193](https://jira.mariadb.org/browse/MDEV-41193)  ### Problem: When CONNECT engine pushes a WHERE clause down to an external table, it writes the filter into the work area, without checking how much space is left. A large string literal in the WHERE clause can overflow the work area allocated by the engine. For ex: if `connect_work_size` is set to 4MB and the string literal in the WHERE clause is larger than 4MB, it can grow past the allocated work area.  ### Fix: Track the space left in the work area and check it before writing. If the filter doesn't fit, drop it instead of writing past the buffer.

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
-  return write_log_and_lock(mess
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
    PRIMARY KEY (`id`
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
  t1	CREATE TABLE `
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
 SELECT SUBDIST_ENABLED FROM INFORMATION_SCHEMA.VECTOR_INDEXE
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
+SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SUBDIST_ENA
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

### Incident Patch 10: `add63991` (2026-08-17)
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

#### Recent Merged Pull Requests:
- **PR #5794** (2026-09-29): MDEV-41343 REVOKE DENY FROM PUBLIC allowed with column-level UPDATE (@vaintroub)
- **PR #5785** (2026-09-29): MDEV-41075 : Assertion .thd->in_active_multi_stmt in TOI (@janlindstrom)
- **PR #5779** (2026-09-29): MDEV-40622 : galera.tmp_space_usage fails: Failed to start mysqld.2 (@janlindstrom)
- **PR #5764** (2026-09-28): MGL-299 Regression in galera_sst_rsync_encrypt_with_key MTR test (@ayurchen)
- **PR #5760** (2026-09-28): MDEV-40852 Redundant checkpoint after innodb_log_archive startup (@dr-m)
- **PR #5757** (closed): MDEV-28746 follow-up: my_win_sopen() missed relative paths overflowing MAX_PATH (@vaintroub)
- **PR #5754** (closed): MDEV-41297 A stored empty blob never equals an all-space value (@arcivanov)
- **PR #5750** (2026-09-25): MDEV-41193: ASAN heap-buffer-overflow in `ha_connect::CheckCond` after select from Connect table (@raghunandanbhat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
