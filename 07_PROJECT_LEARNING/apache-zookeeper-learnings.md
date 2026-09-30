# Forensic Learning Record (Deep Inspection): apache/zookeeper

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-zookeeper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/zookeeper](https://github.com/apache/zookeeper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:30:57.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/zookeeper`
- **Description**: Apache ZooKeeper
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12814 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `zk-merge-pr.py`
```
#!/usr/bin/env python

#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Utility for creating well-formed pull request merges and pushing them to Apache. This script is a modified version
# of the one created by the Spark project (https://github.com/apache/spark/blob/master/dev/merge_spark_pr.py).
#
# Usage: ./zk-merge-pr.py (see config env vars below)
#
# This utility assumes you already have a local ZooKeeper git folder and that you
# have added remotes corresponding to both:
# (i) the github apache ZooKeeper mirror and
# (ii) the apache ZooKeeper git repo.

import json
import os
import re
import subprocess
import sys
import urllib.request, urllib.error, urllib.parse
import getpass
import requests

try:
    import jira.client
    JIRA_IMPORTED = True
except ImportError:
    JIRA_IMPORTED = False

PROJECT_NAME = "zookeeper"

CAPITALIZED_PROJECT_NAME = PROJECT_NAME.upper()

# Remote name which points to the GitHub site
PR_REMOTE_NAME = os.environ.get("PR_REMOTE_NAME", "apache-github")
# Remote name which points to Apache git
PUSH_REMOTE_NAME = os.environ.get("PUSH_REMOTE_NAME", "apache")
# ASF JIRA username
JIRA_USERNAME = os.environ.get("JIRA_USERNAME", "")
# ASF JIRA password
JIRA_PASSWORD = os.environ.get("JIRA_PASSWORD", "")
# ASF JIRA access token
# If it is configured, username and password are dismissed
# Go to https://issues.apache.org/jira/secure/ViewProfile.jspa -> Personal Access Tokens for
# your own token management.
JIRA_ACCESS_TOKEN = os.environ.get("JIRA_ACCESS_TOKEN")
# OAuth key used for issuing requests against the GitHub API. If this is not defined, then requests
# will be unauthenticated. You should only need to configure this if you find yourself regularly
# exceeding your IP's unauthenticated request rate limit. You can create an OAuth key at
# https://github.com/settings/tokens. This script only requires the "public_repo" scope.
GITHUB_OAUTH_KEY = os.environ.get("GITHUB_OAUTH_KEY")

GITHUB_USER = os.environ.get("GITHUB_USER", "apache")
GITHUB_BASE = "https://github.com/%s/%s/pull" % (GITHUB_USER, PROJECT_NAME)
GITHUB_API_BASE = "https://api.github.com/repos/%s/%s" % (GITHUB_USER, PROJECT_NAME)
JIRA_BASE = "https://issues.apache.org/jira/browse"
JIRA_API_BASE = "https://issues.apache.org/jira"
# Prefix added to temporary branches
TEMP_BRANCH_PREFIX = "PR_TOOL"
# TODO Introduce a convention as this is too brittle
RELEASE_BRANCH_PREFIX = "branch-"

DEV_BRANCH_NAME = "master"

DEFAULT_FIX_VERSION = os.environ.get("DEFAULT_FIX_VERSION", "branch-3.5")

def get_json(url):
    try:
        request = urllib.request.Request(url)
        if GITHUB_OAUTH_KEY:
            request.add_header('Authorization', 'token %s' % GITHUB_OAUTH_KEY)
        return json.load(urllib.request.urlopen(request))
    except urllib.error.HTTPError as e:
        if "X-RateLimit-Remaining" in e.headers and e.headers["X-RateLimit-Remaining"] == '0':
            print("Exceeded the GitHub API rate limit; see the instructions in " + \
                  "zk-merge-pr.py to configure an OAuth token for making authenticated " + \
                  "GitHub requests.")
        else:
            print("Unable to fetch URL, exiting: %s" % url)
        sys.exit(-1)


def fail(msg):
    print(msg)
    clean_up()
    sys.exit(-1)


def run_cmd(cmd):
    print(cmd)
    if isinstance(cmd, list):
        return subprocess.check_output(cmd, encoding='utf8')
    else:
        return subprocess.check_output(cmd.split(" "), encoding='utf8')


def continue_maybe(prompt):
    result = input("\n%s (y/n): " % prompt)
    if result.lower().strip() != "y":
        fail("Okay, exiting")

def clean_up():
    if original_head != get_current_branch():
        print("Restoring head pointer to %s" % original_head)
        run_cmd("git checkout %s" % original_head)

    branches = run_cmd("git branch").replace(" ", "").split("\n")

    for branch in [x for x in branches if x.startswith(TEMP_BRANCH_PREFIX)]:
        print("Deleting local branch %s" % branch)
        run_cmd("git branch -D %s" % branch)

def get_current_branch():
    return run_cmd("git rev-parse --abbrev-ref HEAD").replace("\n", "")

# merge the requested PR and return the merge hash
def merge_pr(pr_num, title, pr_repo_desc):

    merge_message = []
    result = input("Would you like to squash the commit messages? (y/n): ")
    if result.lower().strip() == "y":
        # Retrieve the commits separately.
        json_commits = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}/commits")
        if json_commits and isinstance(json_commits, list):
            for commit in json_commits:
                commit_message = commit['commit']['message']
                # Remove empty lines and lines containing "Change-Id:"
                filtered_lines = [line for line in commit_message.split('\n') if 'Change-Id:' not in line and line.strip()]
                modified_commit_message = '\n'.join(filtered_lines)
                if modified_commit_message.strip() != title.strip():
                    merge_message += [modified_commit_message]

    # Check for disapproval reviews.
    json_reviewers = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}/reviews")
    disapproval_reviews = [review['user']['login'] for review in json_reviewers if review['state'] == 'CHANGES_REQUESTED']
    if disapproval_reviews:
        continue_maybe("Warning: There are requested changes. Proceed with merging pull request #%s?" % pr_num)
    # Verify if there are no approved reviews.
    approved_reviewers = [review['user']['login'] for review in json_reviewers if review['state'] == 'APPROVED']
    if not approved_reviewers:
        continue_maybe("Warning: Pull Request does not have an approved review. Proceed with merging pull request #%s?" % pr_num)
    else:
        reviewers_string = ', '.join(approved_reviewers)
        merge_message += [f"Reviewers: {reviewers_string}"]
    # Check the author and the closing line.
    json_pr = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}")
    primary_author = json_pr["user"]["login"]
    if primary_author != "":
        merge_message += [f"Author: {primary_author}"]
    close_line = "Closes #%s from %s" % (pr_num, pr_repo_desc)
    merge_message += [close_line]
    merged_string = '\n'.join(merge_message)

    # Get the latest commit SHA.
    latest_commit_sha = json_pr["head"]["sha"]
    json_status = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/commits/{latest_commit_sha}/check-runs")
    # Check if all checks have passed on GitHub.
    all_checks_passed = all(status["conclusion"] == "success" for status in json_status["check_runs"])
    if all_checks_passed:
        print("All checks have passed on the github.")
    else:
        any_in_progress = any(run["status"] == "in_progress" for run in json_status["check_runs"])
        if any_in_progress:
            continue_maybe("Warning: There are pending checks. Would you like to continue the merge?")
        else:
            continue_maybe("Warning: Not all checks have passed on GitHub. Would you like to continue the merge?")

    headers = {
        "Authorization": f"token {GITHUB_OAUTH_KEY}",

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/proto.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#ifndef PROTO_H_
#define PROTO_H_

#ifdef __cplusplus
extern "C" {
#endif

#define ZOO_NOTIFY_OP 0
#define ZOO_CREATE_OP 1
#define ZOO_DELETE_OP 2
#define ZOO_EXISTS_OP 3
#define ZOO_GETDATA_OP 4
#define ZOO_SETDATA_OP 5
#define ZOO_GETACL_OP 6
#define ZOO_SETACL_OP 7
#define ZOO_GETCHILDREN_OP 8
#define ZOO_SYNC_OP 9
#define ZOO_PING_OP 11
#define ZOO_GETCHILDREN2_OP 12
#define ZOO_CHECK_OP 13
#define ZOO_MULTI_OP 14
#define ZOO_CREATE2_OP 15
#define ZOO_RECONFIG_OP 16
#define ZOO_CHECK_WATCHES 17
#define ZOO_REMOVE_WATCHES 18
#define ZOO_CREATE_CONTAINER_OP 19
#define ZOO_DELETE_CONTAINER_OP 20
#define ZOO_CREATE_TTL_OP 21
#define ZOO_CLOSE_OP -11
#define ZOO_SETAUTH_OP 100
#define ZOO_SETWATCHES_OP 101
#define ZOO_SASL_OP 102

#ifdef __cplusplus
}
#endif

#endif /*PROTO_H_*/

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/recordio.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#ifndef __RECORDIO_H__
#define __RECORDIO_H__

#include <sys/types.h>
#include <stdint.h> /* for int64_t */
#ifdef WIN32
#include "winconfig.h"
#endif

#ifdef __cplusplus
extern "C" {
#endif

struct buffer {
    int32_t len;
    char *buff;
};

void deallocate_String(char **s);
void deallocate_Buffer(struct buffer *b);
void deallocate_vector(void *d);
struct iarchive {
    int (*start_record)(struct iarchive *ia, const char *tag);
    int (*end_record)(struct iarchive *ia, const char *tag);
    int (*start_vector)(struct iarchive *ia, const char *tag, int32_t *count);
    int (*end_vector)(struct iarchive *ia, const char *tag);
    int (*deserialize_Bool)(struct iarchive *ia, const char *name, int32_t *);
    int (*deserialize_Int)(struct iarchive *ia, const char *name, int32_t *);
    int (*deserialize_Long)(struct iarchive *ia, const char *name, int64_t *);
    int (*deserialize_Buffer)(struct iarchive *ia, const char *name,
            struct buffer *);
    int (*deserialize_String)(struct iarchive *ia, const char *name, char **);
    void *priv;
};
struct oarchive {
    int (*start_record)(struct oarchive *oa, const char *tag);
    int (*end_record)(struct oarchive *oa, const char *tag);
    int (*start_vector)(struct oarchive *oa, const char *tag, const int32_t *count);
    int (*end_vector)(struct oarchive *oa, const char *tag);
    int (*serialize_Bool)(struct oarchive *oa, const char *name, const int32_t *);
    int (*serialize_Int)(struct oarchive *oa, const char *name, const int32_t *);
    int (*serialize_Long)(struct oarchive *oa, const char *name,
            const int64_t *);
    int (*serialize_Buffer)(struct oarchive *oa, const char *name,
            const struct buffer *);
    int (*serialize_String)(struct oarchive *oa, const char *name, char **);
    void *priv;
};

struct oarchive *create_buffer_oarchive(void);
void close_buffer_oarchive(struct oarchive **oa, int free_buffer);
struct iarchive *create_buffer_iarchive(char *buffer, int len);
void close_buffer_iarchive(struct iarchive **ia);
char *get_buffer(struct oarchive *);
int get_buffer_len(struct oarchive *);

int64_t zoo_htonll(int64_t v);

#ifdef __cplusplus
}
#endif

#endif

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/win_getopt.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * DISCLAIMER
 * This file is part of the mingw-w64 runtime package.
 *
 * The mingw-w64 runtime package and its code is distributed in the hope that it
 * will be useful but WITHOUT ANY WARRANTY.  ALL WARRANTIES, EXPRESSED OR
 * IMPLIED ARE HEREBY DISCLAIMED.  This includes but is not limited to
 * warranties of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

 /*
 * Copyright (c) 2002 Todd C. Miller <Todd.Miller@courtesan.com>
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Sponsored in part by the Defense Advanced Research Projects
 * Agency (DARPA) and Air Force Research Laboratory, Air Force
 * Materiel Command, USAF, under agreement number F39502-99-1-0512.
 */

/*-
 * Copyright (c) 2000 The NetBSD Foundation, Inc.
 * All rights reserved.
 *
 * This code is derived from software contributed to The NetBSD Foundation
 * by Dieter Baron and Thomas Klausner.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE NETBSD FOUNDATION, INC. AND CONTRIBUTORS
 * ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef __GETOPT_H__

#pragma warning(disable:4996);

#define __GETOPT_H__

/* All the headers include this file. */
#include <crtdefs.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>
#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

#define	REPLACE_GETOPT		/* use this getopt as the system getopt(3) */

#ifdef REPLACE_GETOPT
int	opterr = 1;		/* if error message should be printed */
int	optind = 1;		/* index into parent argv vector */
int	optopt = '?';		/* character checked for validity */
#undef	optreset		/* see getopt.h */
#define	optreset		__mingw_optreset
int	optreset;		/* reset getopt */
char    *optarg;		/* argument associated with option */
#endif

//extern int optind;		/* index of first non-option in argv      */
//extern int optopt;		/* single option character, as parsed     */
//extern int opterr;		/* flag to enable built-in diagnostics... */
//				/* (user may set to zero, to suppress)    */
//
//extern char *optarg;		/* pointer to argument of current option  */

#define PRINT_ERROR	((opterr) && (*options != ':'))

#define FLAG_PERMUTE	0x01	/* permute non-options to the end of argv */
#define FLAG_ALLARGS	0x02	/* treat non-options as args to option "-1" */
#define FLAG_LONGONLY	0x04	/* operate as getopt_long_only */

/* return values */
#define	BADCH		(int)'?'
#define	BADARG		((*options == ':') ? (int)':' : (int)'?')
#define	INORDER 	(int)1

#ifndef __CYGWIN__
#define __progname __argv[0]
#else
extern char __declspec(dllimport) *__progname;
#endif

#ifdef __CYGWIN__
static char EMSG[] = "";
#else
#define	EMSG		""
#endif

static int getopt_internal(int, char * const *, const char *,
			   const struct option *, int *, int);
static int parse_long_options(char * const *, const char *,
			      const struct option *, int *, int);
static int gcd(int, int);
static void permute_args(int, int, int, char * const *);

static char *place = EMSG; /* option letter processing */

/* XXX: set optreset to 1 rather than these two */
static int nonopt_start = -1; /* first non option argument (for permute) */
static int nonopt_end = -1;   /* first option after non options (for permute) */

/* Error messages */
static const char recargchar[] = "option requires an argument -- %c";
static const char recargstring[] = "option requires an argument -- %s";
static const char ambig[] = "ambiguous option -- %.*s";
static const char noarg[] = "option doesn't take an argument -- %.*s";
static const char illoptchar[] = "unknown option -- %c";
static const char illoptstring[] = "unknown option -- %s";

static void
_vwarnx(const char *fmt,va_list ap)
{
  (void)fprintf(stderr,"%s: ",__progname);
  if (fmt != NULL)
    (void)vfprintf(stderr,fmt,ap);
  (void)fprintf(stderr,"\n");
}

static void
warnx(const char *fmt,...)
{
  va_list ap;
  va_start(ap,fmt);
  _vwarnx(fmt,ap);
  va_end(ap);
}

/*
 * Compute the greatest common divisor of a and b.
 */
static int
gcd(int a, int b)
{
	int c;

	c = a % b;
	while (c != 0) {
		a = b;
		b = c;
		c = a % b;
	}

	return (b);
}

/*
 * Exchange the block from nonopt_start to nonopt_end with the block
 * from nonopt_end to opt_end (keeping the same order of arguments
 * in each block).
 */
static void
permute_args(int panonopt_start, int panonopt_end, int opt_end,
	char * const *nargv)
{
	int cstart, cyclelen, i, j, ncycle, nnonopts, nopts, pos;
	char *swap;

	/*
	 * compute lengths of blocks and number and size of cycles
	 */
	nnonopts = panonopt_end - panonopt_start;
	nopts = opt_end - panonopt_end;
	ncycle = gcd(nnonopts, nopts);
	cyclelen = (opt_end - panonopt_start) / ncycle;

	for (i = 0; i < ncycle; i++) {
		cstart = panonopt_end+i;
		pos = cstart;
		for (j = 0; j < cyclelen; j++) {
			if (pos >= panonopt_end)
				pos -= nnonopts;
			else
				pos += nopts;
			swap = nargv[pos];
			/* LINTED const cast */
			((char **) nargv)[pos] = nargv[cstart];
			/* LINTED const cast */
			((char **)nargv)[cstart] = swap;
		}
	}
}

#ifdef REPLACE_GETOPT
/*
 * getopt --
 *	Parse argc/argv argument vector.
 *
 * [eventually this will replace the BSD getopt]
 */
int
getopt(int nargc, char * const *nargv, const char *options)
{

	/*
	 * We don't pass FLAG_PERMUTE to getopt_internal() since
	 * the BSD getopt(3) (unlike GNU) has never done this.
	 *
	 * Furthermore,
```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/winconfig.h`
```
#ifndef WINCONFIG_H_
#define WINCONFIG_H_

/* Define to `__inline__' or `__inline' if that's what the C compiler
   calls it, or to nothing if 'inline' is not supported under any name.  */
#ifndef __cplusplus
#define inline __inline
#endif

#define __attribute__(x)
#define __func__ __FUNCTION__

#define ACL ZKACL /* Conflict with windows API */

#endif

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/zookeeper.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef ZOOKEEPER_H_
#define ZOOKEEPER_H_

#include <stdlib.h>

/* we must not include config.h as a public header */
#ifndef WIN32
#include <sys/socket.h>
#include <sys/time.h>
#endif

#ifdef WIN32
#include <winsock2.h> /* must always be included before ws2tcpip.h */
#include <ws2tcpip.h> /* for struct sock_addr and socklen_t */
#endif

#ifdef HAVE_OPENSSL_H
#include <openssl/ossl_typ.h>
#endif

#include <stdio.h>
#include <ctype.h>

#ifdef HAVE_CYRUS_SASL_H
#include <sasl/sasl.h>
#endif /* HAVE_CYRUS_SASL_H */

#include "proto.h"
#include "zookeeper_version.h"
#include "recordio.h"
#include "zookeeper.jute.h"

/**
 * \file zookeeper.h
 * \brief ZooKeeper functions and definitions.
 *
 * ZooKeeper is a network service that may be backed by a cluster of
 * synchronized servers. The data in the service is represented as a tree
 * of data nodes. Each node has data, children, an ACL, and status information.
 * The data for a node is read and write in its entirety.
 *
 * ZooKeeper clients can leave watches when they queries the data or children
 * of a node. If a watch is left, that client will be notified of the change.
 * The notification is a one time trigger. Subsequent chances to the node will
 * not trigger a notification unless the client issues a query with the watch
 * flag set. If the client is ever disconnected from the service, the watches do
 * not need to be reset. The client automatically resets the watches.
 *
 * When a node is created, it may be flagged as an ephemeral node. Ephemeral
 * nodes are automatically removed when a client session is closed or when
 * a session times out due to inactivity (the ZooKeeper runtime fills in
 * periods of inactivity with pings). Ephemeral nodes cannot have children.
 *
 * ZooKeeper clients are identified by a server assigned session id. For
 * security reasons The server
 * also generates a corresponding password for a session. A client may save its
 * id and corresponding password to persistent storage in order to use the
 * session across program invocation boundaries.
 */

/* Support for building on various platforms */

// on cygwin we should take care of exporting/importing symbols properly
#ifdef DLL_EXPORT
#    define ZOOAPI __declspec(dllexport)
#else
#  if (defined(__CYGWIN__) || defined(WIN32)) && !defined(USE_STATIC_LIB)
#    define ZOOAPI __declspec(dllimport)
#  else
#    define ZOOAPI
#  endif
#endif

/** zookeeper return constants **/

enum ZOO_ERRORS {
  ZOK = 0, /*!< Everything is OK */

  /** System and server-side errors.
   * This is never thrown by the server, it shouldn't be used other than
   * to indicate a range. Specifically error codes greater than this
   * value, but lesser than {@link #ZAPIERROR}, are system errors. */
  ZSYSTEMERROR = -1,
  ZRUNTIMEINCONSISTENCY = -2, /*!< A runtime inconsistency was found */
  ZDATAINCONSISTENCY = -3, /*!< A data inconsistency was found */
  ZCONNECTIONLOSS = -4, /*!< Connection to the server has been lost */
  ZMARSHALLINGERROR = -5, /*!< Error while marshalling or unmarshalling data */
  ZUNIMPLEMENTED = -6, /*!< Operation is unimplemented */
  ZOPERATIONTIMEOUT = -7, /*!< Operation timeout */
  ZBADARGUMENTS = -8, /*!< Invalid arguments */
  ZINVALIDSTATE = -9, /*!< Invliad zhandle state */
  ZNEWCONFIGNOQUORUM = -13, /*!< No quorum of new config is connected and
                                 up-to-date with the leader of last committed
                                 config - try invoking reconfiguration after new
                                 servers are connected and synced */
  ZRECONFIGINPROGRESS = -14, /*!< Reconfiguration requested while another
                                  reconfiguration is currently in progress. This
                                  is currently not supported. Please retry. */
  ZSSLCONNECTIONERROR = -15, /*!< The SSL connection Error */

  /** API errors.
   * This is never thrown by the server, it shouldn't be used other than
   * to indicate a range. Specifically error codes greater than this
   * value are API errors (while values less than this indicate a
   * {@link #ZSYSTEMERROR}).
   */
  ZAPIERROR = -100,
  ZNONODE = -101, /*!< Node does not exist */
  ZNOAUTH = -102, /*!< Not authenticated */
  ZBADVERSION = -103, /*!< Version conflict */
  ZNOCHILDRENFOREPHEMERALS = -108, /*!< Ephemeral nodes may not have children */
  ZNODEEXISTS = -110, /*!< The node already exists */
  ZNOTEMPTY = -111, /*!< The node has children */
  ZSESSIONEXPIRED = -112, /*!< The session has been expired by the server */
  ZINVALIDCALLBACK = -113, /*!< Invalid callback specified */
  ZINVALIDACL = -114, /*!< Invalid ACL specified */
  ZAUTHFAILED = -115, /*!< Client authentication failed */
  ZCLOSING = -116, /*!< ZooKeeper is closing */
  ZNOTHING = -117, /*!< (not error) no server responses to process */
  ZSESSIONMOVED = -118, /*!<session moved to another server, so operation is ignored */
  ZNOTREADONLY = -119, /*!< state-changing request is passed to read-only server */
  ZEPHEMERALONLOCALSESSION = -120, /*!< Attempt to create ephemeral node on a local session */
  ZNOWATCHER = -121, /*!< The watcher couldn't be found */
  ZRECONFIGDISABLED = -123, /*!< Attempts to perform a reconfiguration operation when reconfiguration feature is disabled */
  ZSESSIONCLOSEDREQUIRESASLAUTH = -124, /*!< The session has been closed by server because server requires client to do authentication via configured authentication scheme at server, but client is not configured with required authentication scheme or configured but failed (i.e. wrong credential used.). */
  ZTHROTTLEDOP = -127 /*!< Operation was throttled and not executed at all. please, retry! */

  /* when adding/changing values here also update zerror(int) to return correct error message */
};

#ifdef __cplusplus
extern "C" {
#endif

/**
*  @name Debug levels
*/
typedef enum {ZOO_LOG_LEVEL_ERROR=1,ZOO_LOG_LEVEL_WARN=2,ZOO_LOG_LEVEL_INFO=3,ZOO_LOG_LEVEL_DEBUG=4} ZooLogLevel;

/**
 * @name ACL Consts
 */
extern ZOOAPI const int ZOO_PERM_READ;
extern ZOOAPI const int ZOO_PERM_WRITE;
extern ZOOAPI const int ZOO_PERM_CREATE;
extern ZOOAPI const int ZOO_PERM_DELETE;
extern ZOOAPI const int ZOO_PERM_ADMIN;
extern ZOOAPI const int ZOO_PERM_ALL;


#define ZOO_CONFIG_NODE "/zookeeper/config"

/* flags for zookeeper_init{,2} */
#define ZOO_READONLY         1

/** Disable logging of the client environment at initialization time. */
#define ZOO_NO_LOG_CLIENTENV 2

/** This Id represents anyone. */
extern ZOOAPI struct Id ZOO_ANYONE_ID_UNSAFE;
/** This Id is only usable to set ACLs. It will get substituted with the
 * Id's the client authenticated with.
 */
extern ZOOAPI struct Id ZOO_AUTH_IDS;

/** This is a completely open ACL*/
extern ZOOAPI struct ACL_vector ZOO_OPEN_ACL_UNSAFE;
/** This ACL gives the world the ability to read. */
extern ZOOAPI struct ACL_vector ZOO_READ_ACL_UNSAFE;
/** This ACL gives the creators authentication id's all permissions. */
extern ZOOAPI struct ACL_vector ZOO_CREATOR_ALL_ACL;

/**
 * @name Interest Consts
 * These constants are used to express interest in an event and to
 * indicate to zookeeper which events have occurred. They can
 * be ORed toge
```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/zookeeper_log.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef ZK_LOG_H_
#define ZK_LOG_H_

#include <zookeeper.h>

#ifdef __cplusplus
extern "C" {
#endif

extern ZOOAPI ZooLogLevel logLevel;
#define LOGCALLBACK(_zh) zoo_get_log_callback(_zh)
#define LOGSTREAM NULL

#define LOG_ERROR(_cb, ...) if(logLevel>=ZOO_LOG_LEVEL_ERROR) \
    log_message(_cb, ZOO_LOG_LEVEL_ERROR, __LINE__, __func__, __VA_ARGS__)
#define LOG_WARN(_cb, ...) if(logLevel>=ZOO_LOG_LEVEL_WARN) \
    log_message(_cb, ZOO_LOG_LEVEL_WARN, __LINE__, __func__, __VA_ARGS__)
#define LOG_INFO(_cb, ...) if(logLevel>=ZOO_LOG_LEVEL_INFO) \
    log_message(_cb, ZOO_LOG_LEVEL_INFO, __LINE__, __func__, __VA_ARGS__)
#define LOG_DEBUG(_cb, ...) if(logLevel==ZOO_LOG_LEVEL_DEBUG) \
    log_message(_cb, ZOO_LOG_LEVEL_DEBUG, __LINE__, __func__, __VA_ARGS__)

ZOOAPI void log_message(log_callback_fn callback, ZooLogLevel curLevel,
    int line, const char* funcName, const char* format, ...);

FILE* zoo_get_log_stream();

#ifdef __cplusplus
}
#endif

#endif /*ZK_LOG_H_*/

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/zookeeper_version.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#ifndef ZOOKEEPER_VERSION_H_
#define ZOOKEEPER_VERSION_H_

#ifdef __cplusplus
extern "C" {
#endif

#define ZOO_VERSION "3.10.0"

#ifdef __cplusplus
}
#endif

#endif /* ZOOKEEPER_VERSION_H_ */

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2458** (2026-09-18): **ZOOKEEPER-5089 Upgrade Website and Docs to new ReactRouter and Vite versions**
  *Symptoms*: Note: the minimal supported Node version is now `24.18.1`
  **Post-Mortem & Fix Analysis**:
  > @anmolnar @PDavid could you please update the wiki docs? the new minimal supported Node.js version is `24.18.1`. 24 is the new LTS for Node.js.  https://cwiki.apache.org/confluence/spaces/ZOOKEEPER/pages/430408714/WebSiteSetup+New
  > Many thanks @yuriipalam for the contribution! :+1: 
  > > @anmolnar @PDavid could you please update the wiki docs? the new minimal supported Node.js version is `24.18.1`. 24 is the new LTS for Node.js. >  > https://cwiki.apache.org/confluence/spaces/ZOOKEEPER/pages/430408714/WebSiteSetup+New  This is done.  Btw. @yuriipalam I remember I asked you to move and maintain this doc page (WebSiteSetup) in the CWiki, but I think I changed my mind and would be better to keep it on the website itself. For instance, under the Documentation menu after Version Control for instance.  wdyt?

- **Issue #2453** (2026-09-15): **ZOOKEEPER-5087: Suppress false positive OpenTelemetry CVE-s in OWASP dependency check**
  *Symptoms*: All of these CVE-s are false positives as they are not affecting the Java library.
  **Post-Mortem & Fix Analysis**:
  > After these changes `mvn clean package -DskipTests dependency-check:check` was successful for me.
  > Thanks. Which branches are affected?
  > > Thanks. Which branches are affected?  I checked the latest runs under https://ci-hadoop.apache.org/view/ZooKeeper/job/zookeeper-multi-branch-owasp/ for each active branch and only `master` branch seems to be affected by this - or at least OWASP dependency check only reports these for `master`.

- **Issue #2452** (2026-09-02): **ZOOKEEPER-5086: Upgrade Netty to 4.1.137.Final**
  *Symptoms*: Upgrade Netty from 4.1.136.Final to 4.1.137.Final to fix CVE-2026-62380. Also rename the corresponding LICENSE files under `zookeeper-server/src/main/resources/lib/`.

- **Issue #2451** (2026-09-02): **ZOOKEEPER-5075: Upgrade JLine to 3.30.14 ADDENDUM: Use jdk8 classifier**
  *Symptoms*: The normal JLine artifact contains some classes which are not compatible with Java 8. The jdk8 classifier JLine artifact excludes those classes so it should be 100% compatible with Java 8.

- **Issue #2450** (2026-09-02): **ZOOKEEPER-5075: Upgrade JLine to 3.30.14 ADDENDUM: Use jdk8 classifier**
  *Symptoms*: The normal JLine artifact contains some classes which are not compatible with Java 8. The jdk8 classifier JLine artifact excludes those classes so it should be 100% compatible with Java 8.

- **Issue #2449** (2026-09-01): **ZOOKEEPER-5085: Remove unused vulnerable prototype.js**
  *Symptoms*: It has known security vulnerability, and we does not seem to use it.
  **Post-Mortem & Fix Analysis**:
  > Verified this with building the docs locally and checking them in my browser.  ``` $ mvn clean install -DskipTests $ cd zookeeper-docs/target/html $ python3 -m http.server ```  Opened all doc pages in my browser - all are looking fine for me - :heavy_check_mark:  Opening / collapsing of menu items in left menu bar works - :heavy_check_mark:   <img width="2491" height="1369" alt="image" src="https://github.com/user-attachments/assets/c9b44989-0be7-430e-90b1-22b411a0dd0a" /> 
  > LGTM, thank David!
  > Thanks @PDavid and @yuriipalam ! Merged the patch to 3.8 and 3.9 branches.

- **Issue #2448** (2026-09-01): **ZOOKEEPER-5082: Remove special characters from audit logs**
  *Symptoms*: Related: - https://issues.apache.org/jira/browse/ZOOKEEPER-3979 - https://issues.apache.org/jira/browse/ZOOKEEPER-5058 - https://issues.apache.org/jira/browse/ZOOKEEPER-5082  cc @ztzg @eolivelli @tisonkun 
  **Post-Mortem & Fix Analysis**:
  > > I must lose some context but why whitespace characters be sensitive or should be removed from the audit log?  It gives ability to the client to inject fake lines to the audit log. e.g. Add a '\n' to value and insert your forged line after it which will appear as a valid entry.  See the attached Jira tickets for more context.
  > Added a commit to consolidate with what we already have in `EnsembleAuthenticationProvider`.

- **Issue #2447** (2026-08-31): **ZOOKEEPER-5083: Upgrade Jackson-databind to 2.22.2 to fix known security vulnerabilities**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > It seems `org.apache.zookeeper.server.ServerCnxnFactoryTest.testShedConnections_SmallPercentageRoundsToZero{FactoryType}[2]` failed in Jenkins:  ``` org.opentest4j.AssertionFailedError: 1% of 1 connection should round to 0 ==> expected: <0> but was: <1> 	at org.apache.zookeeper.server.ServerCnxnFactoryTest.testShedConnections_SmallPercentageRoundsToZero(ServerCnxnFactoryTest.java:106) ```  However it is successful for me locally on this branch:  ``` [INFO]  [INFO] ------------------------------------------------------- [INFO]  T E S T S [INFO] ------------------------------------------------------- [INFO] Running org.apache.zookeeper.server.ServerCnxnFactoryTest [INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.06 s - in org.apache.zookeeper.server.ServerCnxnFactoryTest [INFO]  [INFO] Results: [INFO]  [INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0 [INFO]  [INFO] ----------------------------------------------------------------------

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

### Incident Patch 1: `5143ab88` (2026-09-30)
**Commit Message**: Revert "Check valid voting member before applying (re)config during LE"

This reverts commit 22dad52e25d028c9bd5c2ea7b525b56ce1da1a53.

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/FastLeaderElection.java` (modified, +22/-38)
```diff
@@ -301,47 +301,31 @@ public void run() {
                                 byte[] b = new byte[configLength];
                                 response.buffer.get(b);
 
-                                /*
-                                 * Only adopt a QuorumVerifier carried in a notification if
-                                 * the sender is a voting member of our current (or next)
-                                 * configuration. The election port accepts connections from
-                                 * any sid, so without this gate an unauthenticated peer could
-                                 * push an arbitrary config into processReconfig(), which
-                                 * persists it to the dynamic config file and restarts
-                                 * leader election. Non-voters (observers, joining servers)
-                                 * still get the reply notification below, which carries our
-                                 * own config, so they can learn the current membership.
-                                 */
-                                if (!validVoter(response.sid)) {
-                                    LOG.info("Ignoring config section in notification from non-voter sid={} (config length: {})",
-                                             response.sid, configLength);
-                                } else {
-                                    synchronized (self) {
-                                        try {
-                                            rqv = self.configFromString(new String(b, UTF_8));
-                                            QuorumVerifier curQV = self.getQuorumVerifier();
-                                            if (rqv.getVersion() > curQV.getVersion()) {
-                                                LOG.info("{} Received version: {} my version: {}",
-                                                         self.getMyId(),
-                                                         Long.toHexString(rqv.getVersion()),
-                                                         Long.toHexString(self.getQuorumVerifier().getVersion()));
-                                                if (self.getPeerState() == ServerState.LOOKING) {
-                                                    LOG.debug("Invoking processReconfig(), state: {}", self.getServerState());
-                                                    self.processReconfig(rqv, null, null, false);
-                                                    if (!rqv.equals(curQV)) {
-                                                        LOG.info("restarting leader election");
-                                                        self.shuttingDownLE = true;
-                                                        self.getElectionAlg().shutdown();
-
-                                                        break;
-                                                    }
-                                                } else {
-                                                    LOG.debug("Skip processReconfig(), state: {}", self.getServerState());
+                                synchronized (self) {
+                                    try {
+                                        rqv = self.configFromString(new String(b, UTF_8));
+                                        QuorumVerifier curQV = self.getQuorumVerifier();
+                                        if (rqv.getVersion() > curQV.getVersion()) {
+                                            LOG.info("{} Received version: {} my version: {}",
+                                                     self.getMyId(),
+                                                     Long.toHexString(rqv.getVersion()),
+                                                     Long.toHexString(self.getQuorumVerifier().getVersion()));
+                                            if (self.getPeerState() == ServerState.LOOKING) {
+                                 
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/quorum/FLEConfigFromNonVoterTest.java` (removed, +0/-151)
```diff
@@ -1,151 +0,0 @@
-/*
- * Licensed to the Apache Software Foundation (ASF) under one
- * or more contributor license agreements.  See the NOTICE file
- * distributed with this work for additional information
- * regarding copyright ownership.  The ASF licenses this file
- * to you under the Apache License, Version 2.0 (the
- * "License"); you may not use this file except in compliance
- * with the License.  You may obtain a copy of the License at
- *
- *     http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-
-package org.apache.zookeeper.server.quorum;
-
-import static java.nio.charset.StandardCharsets.UTF_8;
-import static org.junit.jupiter.api.Assertions.assertEquals;
-import static org.junit.jupiter.api.Assertions.assertFalse;
-import static org.junit.jupiter.api.Assertions.assertTrue;
-import java.io.File;
-import java.net.InetSocketAddress;
-import java.util.HashMap;
-import java.util.Map;
-import org.apache.zookeeper.PortAssignment;
-import org.apache.zookeeper.ZKTestCase;
-import org.apache.zookeeper.server.quorum.QuorumPeer.QuorumServer;
-import org.apache.zookeeper.server.quorum.QuorumPeer.ServerState;
-import org.apache.zookeeper.server.quorum.flexible.QuorumVerifier;
-import org.apache.zookeeper.test.ClientBase;
-import org.junit.jupiter.api.AfterEach;
-import org.junit.jupiter.api.BeforeEach;
-import org.junit.jupiter.api.Test;
-import org.slf4j.Logger;
-import org.slf4j.LoggerFactory;
-
-/**
- * A notification received on the election port may carry a QuorumVerifier
- * (version >= 0x2). The election port accepts a connection from any sid, so
- * the config section must only be adopted when the sender is a voting member
- * of the receiver's current configuration. Otherwise an unauthenticated peer
- * could inject an arbitrary quorum configuration into a LOOKING server.
- */
-public class FLEConfigFromNonVoterTest extends ZKTestCase {
-
-    protected static final Logger LOG = LoggerFactory.getLogger(FLEConfigFromNonVoterTest.class);
-
-    private static final int COUNT = 3;
-    private static final long ROGUE_SID = 99L;
-
-    private Map<Long, QuorumServer> peers;
-    private File[] tmpdir;
-    private int[] port;
-    private QuorumPeer victim;
-    private QuorumCnxManager[] cnxManagers;
-    private boolean savedReconfigEnabled;
-
-    @BeforeEach
-    public void setUp() throws Exception {
-        savedReconfigEnabled = QuorumPeerConfig.isReconfigEnabled();
-        QuorumPeerConfig.setReconfigEnabled(true);
-
-        peers = new HashMap<>();
-        tmpdir = new File[COUNT + 1];
-        port = new int[COUNT + 1];
-        cnxManagers = new QuorumCnxManager[2];
-
-        for (int i = 0; i < COUNT; i++) {
-            int clientport = PortAssignment.unique();
-            peers.put((long) i, new QuorumServer(i,
-                    new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                    new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                    new InetSocketAddress("127.0.0.1", clientport)));
-            tmpdir[i] = ClientBase.createTmpDir();
-            port[i] = clientport;
-        }
-        tmpdir[COUNT] = ClientBase.createTmpDir();
-        port[COUNT] = PortAssignment.unique();
-    }
-
-    @AfterEach
-    public void tearDown() throws Exception {
-        for (QuorumCnxManager m : cnxManagers) {
-            if (m != null) {
-                m.halt();
-            }
-        }
-        if (victim != null) {
-            victim.shutdown();
-        }
-        QuorumPeerConfig.setReconfigEnabled(savedReconfigEnabled);
-    }
-
-    @Test
-    public void testConfigFromNonVoterIsIgnored() throws Exception {
-        vict
```

---

### Incident Patch 2: `4571e5fb` (2026-09-18)
**Commit Message**: setACL race — missing acl attribute setting

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/PrepRequestProcessor.java` (modified, +8/-0)
```diff
@@ -555,6 +555,14 @@ protected void pRequest2Txn(int type, long zxid, Request request, Record record)
             request.setTxn(new SetACLTxn(path, listACL, newVersion));
             nodeRecord = nodeRecord.duplicate(request.getHdr().getZxid());
             nodeRecord.stat.setAversion(newVersion);
+            // Publish the new ACL onto the outstanding ChangeRecord. getRecordForPath()
+            // serves this record (in preference to the committed tree) to every request
+            // prepped before this setACL commits, so without this line those requests are
+            // authorized against the stale, pre-revocation ACL and their writes linearize
+            // after the revocation (TOCTOU). Mirrors the create path, which already sets
+            // the ACL on its ChangeRecord. ACL is not part of the node digest, so this
+            // does not affect digest calculation.
+            nodeRecord.acl = listACL;
             nodeRecord.precalculatedDigest = precalculateDigest(
                     DigestOpCode.UPDATE, path, nodeRecord.data, nodeRecord.stat);
             setTxnDigest(request, nodeRecord.precalculatedDigest);
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/PrepRequestProcessorTest.java` (modified, +65/-0)
```diff
@@ -49,6 +49,7 @@
 import org.apache.zookeeper.proto.CreateRequest;
 import org.apache.zookeeper.proto.ReconfigRequest;
 import org.apache.zookeeper.proto.RequestHeader;
+import org.apache.zookeeper.proto.SetACLRequest;
 import org.apache.zookeeper.proto.SetDataRequest;
 import org.apache.zookeeper.server.ZooKeeperServer.ChangeRecord;
 import org.apache.zookeeper.server.persistence.FileTxnSnapLog;
@@ -292,6 +293,70 @@ public void testInvalidPath() throws Exception {
         assertEquals(outcome.getException().code(), KeeperException.Code.BADARGUMENTS);
     }
 
+    /**
+     * A setACL that is prepped but not yet committed must publish the NEW ACL onto
+     * its outstanding ChangeRecord. getRecordForPath() serves that record to every
+     * request prepped before the setACL commits, so if it still carries the old ACL
+     * those requests are authorized against the pre-revocation ACL (TOCTOU).
+     *
+     * This is the direct regression test for the missing
+     * {@code nodeRecord.acl = listACL;} in the setACL case: before the fix the
+     * outstanding record keeps the old OPEN_ACL_UNSAFE; after the fix it carries the
+     * new read-only ACL.
+     */
+    @Test
+    public void testSetACLPublishesNewAclOnOutstandingChangeRecord() throws Exception {
+        zks.getZKDatabase().dataTree.createNode("/foo", new byte[0], Ids.OPEN_ACL_UNSAFE, 0, 0, 0, 0);
+        assertNull(zks.outstandingChangesForPath.get("/foo"));
+
+        pLatch = new CountDownLatch(1);
+        processor = new PrepRequestProcessor(zks, new MyRequestProcessor());
+        SetACLRequest setAcl = new SetACLRequest("/foo", Ids.READ_ACL_UNSAFE, -1);
+        // admin identity so the ADMIN permission check is not what is under test here
+        processor.pRequest(createRequest(setAcl, OpCode.setACL, true));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "request hasn't been processed in chain");
+
+        ChangeRecord cr = zks.outstandingChangesForPath.get("/foo");
+        assertNotNull(cr, "Change record wasn't set");
+        assertEquals(Ids.READ_ACL_UNSAFE, cr.acl,
+                "Outstanding ChangeRecord must carry the new ACL so later preps are checked against it");
+    }
+
+    /**
+     * End-to-end (at the prep layer) version of the above: a client's write that is
+     * prepped while an ACL revocation is still outstanding must be checked against the
+     * NEW ACL and denied. Before the fix the write is authorized against the stale ACL
+     * and would commit after the revocation.
+     */
+    @Test
+    public void testRacingWriteAfterAclRevocationIsDenied() throws Exception {
+        // Node is world-writable to start with (OPEN_ACL_UNSAFE grants ALL to world:anyone).
+        zks.getZKDatabase().dataTree.createNode("/foo", new byte[0], Ids.OPEN_ACL_UNSAFE, 0, 0, 0, 0);
+
+        processor = new PrepRequestProcessor(zks, new MyRequestProcessor());
+
+        // 1. A world client revokes write access: setACL -> read-only. This is prepped and
+        //    left in outstandingChangesForPath (not yet committed). OPEN_ACL_UNSAFE grants
+        //    ADMIN, so the world client is allowed to perform the setACL.
+        pLatch = new CountDownLatch(1);
+        SetACLRequest setAcl = new SetACLRequest("/foo", Ids.READ_ACL_UNSAFE, -1);
+        processor.pRequest(createRequest(setAcl, OpCode.setACL, false));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "setACL hasn't been processed in chain");
+        assertNull(outcome.getException(), "setACL revocation should succeed");
+
+        // 2. The same world client now tries to write while the revocation is still
+        //    outstanding. It must be checked against the new read-only ACL and denied.
+        pLatch = new CountDownLatch(1);
+        SetDataRequest setData = new SetDataRequest("/foo", "evil".getBytes(), -1);
+        processor.pRequest(createRequest(setData, OpCode.setData, false));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "setData hasn't
```

---

### Incident Patch 3: `ec016b6a` (2026-09-29)
**Commit Message**: ZOOKEEPER-4946: Fix Login renewal thread not exiting on shutdown

Reviewers: kezhuw
Author: ikxeno
Closes #2446 from ikxeno/ZOOKEEPER-4946

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/Login.java` (modified, +12/-2)
```diff
@@ -69,6 +69,11 @@ public class Login {
     private static final long MIN_TIME_BEFORE_RELOGIN = Long.getLong(
       MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY, DEFAULT_MIN_TIME_BEFORE_RELOGIN);
 
+    private static final long DEFAULT_SHUTDOWN_TIMEOUT = 5 * 1000L;
+    public static final String SHUTDOWN_TIMEOUT_CONFIG_KEY = "zookeeper.kerberos.shutdownTimeoutMs";
+    private static final long SHUTDOWN_TIMEOUT = Math.max(0L,
+            Long.getLong(SHUTDOWN_TIMEOUT_CONFIG_KEY, DEFAULT_SHUTDOWN_TIMEOUT));
+
     private Subject subject = null;
     private Thread t = null;
     private boolean isKrbTicket = false;
@@ -132,7 +137,7 @@ public Login(final String loginContextName, Supplier<CallbackHandler> callbackHa
         t = new Thread(new Runnable() {
             public void run() {
                 LOG.info("TGT refresh thread started.");
-                while (true) {  // renewal thread's main loop. if it exits from here, thread will exit.
+                while (!Thread.currentThread().isInterrupted()) {  // renewal thread's main loop. if it exits from here, thread will exit.
                     KerberosTicket tgt = getTGT();
                     long now = Time.currentWallTime();
                     long nextRefresh;
@@ -262,6 +267,7 @@ public void run() {
                                     }
                                 } else {
                                     LOG.error("Could not refresh TGT for principal: {}.", principal, le);
+                                    break;
                                 }
                             }
                         }
@@ -297,9 +303,13 @@ public void shutdown() {
         if ((t != null) && (t.isAlive())) {
             t.interrupt();
             try {
-                t.join();
+                t.join(SHUTDOWN_TIMEOUT);
+                if (t.isAlive()) {
+                    LOG.warn("TGT renewal thread did not exit within {} ms", SHUTDOWN_TIMEOUT);
+                }
             } catch (InterruptedException e) {
                 LOG.warn("error while waiting for Login thread to shutdown.", e);
+                Thread.currentThread().interrupt();
             }
         }
     }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/Shell.java` (modified, +2/-0)
```diff
@@ -235,6 +235,7 @@ public void run() {
                 errThread.join();
             } catch (InterruptedException ie) {
                 LOG.warn("Interrupted while reading the error stream", ie);
+                Thread.currentThread().interrupt();
             }
             completed.set(true);
             //the timeout thread handling
@@ -243,6 +244,7 @@ public void run() {
                 throw new ExitCodeException(exitCode, errMsg.toString());
             }
         } catch (InterruptedException ie) {
+            Thread.currentThread().interrupt();
             throw new IOException(ie.toString());
         } finally {
             if ((timeOutTimer != null) && !timedOut.get()) {
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/KerberosTicketRenewalTest.java` (modified, +87/-1)
```diff
@@ -24,6 +24,7 @@
 import static org.junit.jupiter.api.Assertions.assertFalse;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertTimeout;
+import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 import java.io.File;
 import java.io.FileWriter;
@@ -34,11 +35,13 @@
 import java.util.concurrent.CountDownLatch;
 import java.util.concurrent.TimeUnit;
 import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.function.Supplier;
 import javax.security.auth.login.Configuration;
 import javax.security.auth.login.LoginException;
 import org.apache.commons.io.FileUtils;
 import org.apache.commons.io.FilenameUtils;
+import org.apache.zookeeper.common.Time;
 import org.apache.zookeeper.common.ZKConfig;
 import org.apache.zookeeper.server.quorum.auth.KerberosTestUtils;
 import org.apache.zookeeper.server.quorum.auth.MiniKdc;
@@ -72,6 +75,7 @@ public static void setupClass() throws Exception {
     // by default, we should wait at least 1 minute between subsequent TGT renewals.
     // changing it to 500ms.
     System.setProperty(Login.MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY, "500");
+    System.setProperty(Login.SHUTDOWN_TIMEOUT_CONFIG_KEY, "200");
 
     testTempDir = ClientBase.createTmpDir();
     startMiniKdcAndAddPrincipal();
@@ -99,6 +103,7 @@ public static void setupClass() throws Exception {
   @AfterAll
   public static void tearDownClass() {
     System.clearProperty(Login.MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY);
+    System.clearProperty(Login.SHUTDOWN_TIMEOUT_CONFIG_KEY);
     System.clearProperty("java.security.auth.login.config");
     stopMiniKdc();
     if (testTempDir != null) {
@@ -125,6 +130,12 @@ private static class TestableKerberosLogin extends Login {
 
     private AtomicBoolean refreshFailed = new AtomicBoolean(false);
     private CountDownLatch continueRefreshThread = new CountDownLatch(1);
+    private volatile boolean hangUninterruptibly = false;
+    private final CountDownLatch hungThreadLatch = new CountDownLatch(1);
+    private volatile boolean attemptEveryReLogin = false;
+    private final CountDownLatch retrySleeps = new CountDownLatch(2);
+    private final AtomicInteger reLoginAttempts = new AtomicInteger();
+    private volatile int attemptsAtSecondRetrySleep;
 
     public TestableKerberosLogin() throws LoginException {
       super(JAAS_CONFIG_SECTION, () -> {
@@ -136,10 +147,52 @@ public TestableKerberosLogin() throws LoginException {
     protected void sleepBeforeRetryFailedRefresh() throws InterruptedException {
       LOG.info("sleep started due to failed refresh");
       refreshFailed.set(true);
-      continueRefreshThread.await(20, TimeUnit.SECONDS);
+      if (retrySleeps.getCount() == 1) {
+        attemptsAtSecondRetrySleep = reLoginAttempts.get();
+      }
+      retrySleeps.countDown();
+      if (hangUninterruptibly) {
+        while (hungThreadLatch.getCount() > 0) {
+          try {
+            hungThreadLatch.await();
+          } catch (InterruptedException ignored) {
+          }
+        }
+      } else if (!attemptEveryReLogin) {
+        continueRefreshThread.await(20, TimeUnit.SECONDS);
+      }
       LOG.info("sleep due to failed refresh finished");
     }
 
+    @Override
+    protected synchronized void logout() throws LoginException {
+      reLoginAttempts.incrementAndGet();
+      super.logout();
+    }
+
+    @Override
+    public long getLastLogin() {
+      return attemptEveryReLogin ? Time.currentElapsedTime() - TimeUnit.HOURS.toMillis(1) : super.getLastLogin();
+    }
+
+    public void attemptEveryReLogin() {
+      attemptEveryReLogin = true;
+    }
+
+    public void assertRenewalLoopCameRoundAgain(Duration timeout) throws InterruptedException {
+      assertTrue(retrySleeps.await(timeout.toMillis(), TimeUnit.MILLISECONDS),
+          "renewal thread never left the
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/ShellTest.java` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.zookeeper;
+
+import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertNull;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import java.io.IOException;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicReference;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.condition.DisabledOnOs;
+import org.junit.jupiter.api.condition.OS;
+
+public class ShellTest {
+
+    @Test
+    @DisabledOnOs(OS.WINDOWS)
+    public void shouldRestoreInterruptStatusWhenInterruptedWhileWaitingForProcess() throws Exception {
+        CountDownLatch started = new CountDownLatch(1);
+        CountDownLatch finished = new CountDownLatch(1);
+        AtomicBoolean interruptedAfterwards = new AtomicBoolean(false);
+        AtomicReference<IOException> expectedFailure = new AtomicReference<>();
+        AtomicReference<Throwable> unexpectedFailure = new AtomicReference<>();
+
+        Thread runner = new Thread(() -> {
+            started.countDown();
+            try {
+                Shell.execCommand("sh", "-c", "exec >/dev/null 2>&1; sleep 2");
+            } catch (IOException e) {
+                expectedFailure.set(e);
+            } catch (Throwable t) {
+                unexpectedFailure.set(t);
+            } finally {
+                interruptedAfterwards.set(Thread.currentThread().isInterrupted());
+                finished.countDown();
+            }
+        });
+        runner.start();
+
+        assertTrue(started.await(10, TimeUnit.SECONDS), "runner thread did not start");
+
+        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
+        while (runner.getState() != Thread.State.WAITING) {
+            assertTrue(System.nanoTime() < deadline, "runner thread never reached Process.waitFor()");
+            Thread.onSpinWait();
+        }
+        runner.interrupt();
+
+        assertTrue(finished.await(30, TimeUnit.SECONDS), "execCommand did not return");
+        runner.join();
+
+        assertNull(unexpectedFailure.get(), "unexpected failure in runner thread");
+        assertNotNull(expectedFailure.get(), "execCommand was expected to fail with an IOException");
+        assertTrue(interruptedAfterwards.get(), "execCommand cleared the interrupt status");
+    }
+
+}
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/configuration-parameters.mdx` (modified, +8/-0)
```diff
@@ -1411,6 +1411,14 @@ the integrity of IP-based access controls.
   It is essentially the quorum equivalent of the _zookeeper.sasl.client.canonicalize.hostname_ property for clients.
   The default value is **false** for backwards compatibility.
 
+- _kerberos.shutdownTimeoutMs_
+  (Java system property: **zookeeper.kerberos.shutdownTimeoutMs**)
+  **New in 3.10.0:**
+  The time in milliseconds ZooKeeper waits for the Kerberos TGT renewal thread to exit while shutting down.
+  If the thread is still alive after that, ZooKeeper logs a warning and completes the shutdown.
+  Set it to 0 to wait without a timeout, which is how ZooKeeper behaved before this setting existed.
+  Default: 5000
+
 - _multiAddress.enabled_ :
   (Java system property: **zookeeper.multiAddress.enabled**)
   **New in 3.6.0:**
```

---

### Incident Patch 4: `80f83861` (2026-09-15)
**Commit Message**: Add new CVEs to Security page related to 3.8.7 and 3.9.6

**File**: `zookeeper-website/app/pages/_landing/security/content.md` (modified, +122/-0)
```diff
@@ -60,6 +60,11 @@ The following are **not** in scope for private disclosure:
 
 ## Vulnerability reports
 
+- [CVE-2026-84501](#cve-2026-84501)
+- [CVE-2026-84439](#cve-2026-84439)
+- [CVE-2026-79993](#cve-2026-79993)
+- [CVE-2026-59969](#cve-2026-59969)
+- [CVE-2026-59739](#cve-2026-59739)
 - [CVE-2026-24308](#cve-2026-24308)
 - [CVE-2026-24281](#cve-2026-24281)
 - [CVE-2025-58457](#cve-2025-58457)
@@ -71,6 +76,123 @@ The following are **not** in scope for private disclosure:
 - [CVE-2017-5637](#cve-2017-5637)
 - [CVE-2016-5017](#cve-2016-5017)
 
+--
+
+### CVE-2026-84501
+
+**Operational log forgery via newline injection in EnsembleAuthenticationProvider**
+
+**Severity:** moderate
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+An unauthenticated attacker can inject arbitrary fake log lines into Apache ZooKeeper's operational log by sending a crafted add_auth("ensemble", ...) request containing newline characters (\n). When the ensemble name doesn't match, EnsembleAuthenticationProvider.handleAuthentication() logs the raw, unsanitized name via LOG.warn(). Because SLF4J's {} placeholder preserves embedded newlines, the attacker can forge complete log entries — with arbitrary timestamps, log levels, class names, and messages — that are visually indistinguishable from genuine ZooKeeper log output.
+
+Users are recommended to upgrade to version 3.8.7 or 3.9.6, which fixes the issue.
+
+**Credit:** Youlong Chen Institute of Computing Technology <chenyoulong20g@ict.ac.cn> (finder)
+
+**References:** https://www.cve.org/CVERecord?id=CVE-2026-84501
+
+---
+
+### CVE-2026-84439
+
+**Audit log injection via unsanitized output from multiple sources**
+
+**Severity:** important
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+When audit logging is enabled (zookeeper.audit.enable=true), an unauthenticated attacker can inject arbitrary fields into Apache ZooKeeper's audit log by sending a digest authentication request with tab characters (\t) embedded in the username. Because the audit log uses tab-separated key=value format, the injected tabs are parsed as legitimate field separators, allowing the attacker to spoof audit results (e.g., injecting result=success), forge operation types, and corrupt forensic evidence.
+
+A log injection vulnerability in Apache ZooKeeper allows a client that can call setACL to inject forged key-value fields into zookeeper_audit.log. When audit logging is enabled, the server serializes attacker-controlled digest ACL ids into the acl= audit field without escaping tab characters. Because audit events are emitted as tab-separated key=value records, a crafted ACL id can make one successful setAcl event appear to contain forged fields such as operation=delete and znode=/forged. This undermines the integrity of downstream audit parsing, alerting, and incident response.
+
+Users are recommended to upgrade to version 3.9.6 or 3.8.7, which fixes the issue.
+
+**Credit:** Youlong Chen Institute of Computing Technology <chenyoulong20g@ict.ac.cn> (reporter)
+
+**References:** https://www.cve.org/CVERecord?id=CVE-2026-84439
+
+---
+
+### CVE-2026-79993
+
+**Missing ACL check on deleteContainer opcode allows unauthorized deletion of any empty persistent/container znode**
+
+**Severity:** critical
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+The `deleteContainer` opcode (0x14/20) is processed without verifying the caller's ACL permissions, allowing any authenticated client to delete specific znodes in the data tree regardless of the ACL restrictions on the znode or its parent. This
```

---

### Incident Patch 5: `ccef53ed` (2026-08-31)
**Commit Message**: ZOOKEEPER-5083: Upgrade Jackson-databind to 2.22.2 to fix known security vulnerabilities

Reviewers: anmolnar
Author: PDavid
Closes #2447 from PDavid/ZOOKEEPER-5083-jackson-upgrade

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -550,7 +550,7 @@
     <jetty.version>12.1.12</jetty.version>
     <!-- Servlet API version required by Jetty EE10 (see ee10.jakarta.servlet.api.version in jetty-ee10) -->
     <jakarta.servlet.version>6.0.0</jakarta.servlet.version>
-    <jackson.version>2.18.8</jackson.version>
+    <jackson.version>2.22.2</jackson.version>
     <jline.version>3.30.14</jline.version>
     <snappy.version>1.1.10.5</snappy.version>
     <kerby.version>2.0.0</kerby.version>
```

---

### Incident Patch 6: `b1d1f479` (2026-08-25)
**Commit Message**: ZOOKEEPER-5080: Fix flaky metric assertion in SnapshotAndRestoreCommandTest

Reviewers: uros-b, anmolnar
Author: IvanKhanas
Closes #2442 from IvanKhanas/ZOOKEEPER-5080

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/admin/SnapshotAndRestoreCommandTest.java` (modified, +2/-2)
```diff
@@ -395,14 +395,14 @@ private void validateSnapshotMetrics() {
         Map<String, Object> metrics = MetricsUtils.currentServerMetrics();
         assertEquals(0, (long) metrics.get("snapshot_error_count"));
         assertEquals(0, (long) metrics.get("snapshot_rate_limited_count"));
-        assertTrue((Double) metrics.get("avg_snapshottime") > 0.0);
+        assertEquals(1L, (long) metrics.get("cnt_snapshottime"));
     }
 
     private void validateRestoreMetrics() {
         Map<String, Object> metrics = MetricsUtils.currentServerMetrics();
         assertEquals(0, (long) metrics.get("restore_error_count"));
         assertEquals(0, (long) metrics.get("restore_rate_limited_count"));
-        assertTrue((Double) metrics.get("avg_restore_time") > 0.0);
+        assertEquals(1L, (long) metrics.get("cnt_restore_time"));
     }
 
     public static  File takeSnapshotAndValidate(final int jettyAdminPort, final File dataDir) throws Exception {
```

---

### Incident Patch 7: `53a78e36` (2026-07-17)
**Commit Message**: ZOOKEEPER-5064: Upgrade jackson to 2.18.8 to fix CVEs

Reviewers: PDavid, anmolnar
Author: Kirti2704
Closes #2415 from Kirti2704/ZOOKEEPER-5064

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -548,7 +548,7 @@
     <commons-cli.version>1.5.0</commons-cli.version>
     <netty.version>4.1.135.Final</netty.version>
     <jetty.version>9.4.58.v20250814</jetty.version>
-    <jackson.version>2.18.1</jackson.version>
+    <jackson.version>2.18.8</jackson.version>
     <jline.version>3.25.1</jline.version>
     <snappy.version>1.1.10.5</snappy.version>
     <kerby.version>2.0.0</kerby.version>
```

---

### Incident Patch 8: `0cb298e8` (2026-07-06)
**Commit Message**: ZOOKEEPER-5059: Kerberos SASL leaks Login refresh threads across QuorumPeer.shutdown()

Author: anmolnar
Closes #2410 from anmolnar/ZOOKEEPER-5059

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/QuorumPeer.java` (modified, +6/-0)
```diff
@@ -1712,6 +1712,12 @@ public void shutdown() {
                 LOG.warn("Error closing logs ", ie);
             }
         }
+        if (authServer != null) {
+            authServer.shutdown();
+        }
+        if (authLearner != null) {
+            authLearner.shutdown();
+        }
     }
 
     /**
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/NullQuorumAuthLearner.java` (modified, +5/-0)
```diff
@@ -31,4 +31,9 @@ public void authenticate(Socket sock, String hostname) {
         return; // simply return don't require auth
     }
 
+    @Override
+    public void shutdown() {
+        // no-op
+    }
+
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/NullQuorumAuthServer.java` (modified, +5/-0)
```diff
@@ -32,4 +32,9 @@ public void authenticate(final Socket sock, final DataInputStream din) {
         // simply return don't require auth
     }
 
+    @Override
+    public void shutdown() {
+        // no-op
+    }
+
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/QuorumAuthLearner.java` (modified, +4/-0)
```diff
@@ -38,4 +38,8 @@ public interface QuorumAuthLearner {
      */
     void authenticate(Socket sock, String hostname) throws IOException;
 
+    /**
+     * Shutdown the learner and release resources.
+     */
+    void shutdown();
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/QuorumAuthServer.java` (modified, +4/-0)
```diff
@@ -38,4 +38,8 @@ public interface QuorumAuthServer {
      */
     void authenticate(Socket sock, DataInputStream din) throws IOException;
 
+    /**
+     * Shut down the server and release resources.
+     */
+    void shutdown();
 }
```

---

### Incident Patch 9: `a8f5478a` (2026-07-01)
**Commit Message**: ZOOKEEPER-5061: ZooKeeper website fixes

Reviewers: anmolnar
Author: yuriipalam
Closes #2413 from yuriipalam/ZOOKEEPER-5061

**File**: `.github/workflows/website.yaml` (modified, +8/-3)
```diff
@@ -32,15 +32,15 @@ jobs:
     timeout-minutes: 120
     runs-on: ubuntu-latest
     steps:
-    - uses: actions/checkout@v6
-    - name: Set up JDK 25
+    - uses: actions/checkout@v7
+    - name: Set up JDK 11
       uses: actions/setup-java@v5
       with:
         java-version: 25
         distribution: temurin
         cache: 'maven'
     - name: Set up Node.js 22
-      uses: actions/setup-node@v5
+      uses: actions/setup-node@v6
       with:
         node-version: 22
         cache: 'npm'
@@ -50,6 +50,11 @@ jobs:
     - name: Install website npm dependencies
       working-directory: zookeeper-website
       run: npm ci
+    - name: Cache Playwright browsers
+      uses: actions/cache@v4
+      with:
+        path: ~/.cache/ms-playwright
+        key: playwright-${{ runner.os }}-${{ hashFiles('zookeeper-website/package-lock.json') }}
     - name: Install Playwright browsers and system dependencies
       working-directory: zookeeper-website
       run: npx playwright install --with-deps
```

**File**: `NOTICE.txt` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ These BSD licensed files:
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_itr.c
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_itr.h
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_private.h
-  ./zookeeper-docs/src/main/resources/markdown/skin/prototype.js
 
 This Apache 2.0 licensed file:
 ./zookeeper-contrib/zookeeper-contrib-zooinspector/src/main/java/com/nitido/utils/toaster/Toaster.java
```

**File**: `conf/zoo_sample.cfg` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ clientPort=2181
 # Be sure to read the maintenance section of the 
 # administrator guide before turning on autopurge.
 #
-# https://zookeeper.apache.org/doc/current/zookeeperAdmin.html#sc_maintenance
+# https://zookeeper.apache.org/doc/current/admin-ops/administrators-guide/administration#maintenance
 #
 # The number of snapshots to retain in dataDir
 #autopurge.snapRetainCount=3
```

**File**: `pom.xml` (modified, +0/-3)
```diff
@@ -1094,9 +1094,6 @@
             <exclude>.travis.yml</exclude>
             <exclude>excludeFindBugsFilter.xml</exclude>
             <exclude>README_packaging.md</exclude>
-            <exclude>src/main/resources/markdown/skin/*</exclude>
-            <exclude>src/main/resources/markdown/html/*</exclude>
-            <exclude>src/main/resources/markdown/images/*</exclude>
             <exclude>**/src/test/resources/embedded/*.conf</exclude>
             <!-- contrib -->
             <exclude>**/JMX-RESOURCES</exclude>
```

**File**: `zookeeper-client/zookeeper-client-c/README` (modified, +5/-3)
```diff
@@ -8,7 +8,8 @@ For the latest information about ZooKeeper, please visit our website at:
 and our wiki, at:
    https://cwiki.apache.org/confluence/display/ZOOKEEPER
 
-Full documentation for this release can also be found in ../../docs/index.html
+Full documentation for this release can also be found at:
+   https://zookeeper.apache.org/doc/current/
 
 
 OVERVIEW
@@ -34,8 +35,9 @@ Sync and Async API.
 
 INSTALLATION
 
-Please refer to the "Installation" item under "C Binding" section in file
-".../trunk/zookeeper-docs/src/main/resources/markdown/zookeeperProgrammers.md"
+Please refer to the "Installation" item under "C Binding" in the
+Programmer's Guide:
+   https://zookeeper.apache.org/doc/current/developer/programmers-guide/bindings#installation
 
 EXAMPLE/SAMPLE C CLIENT SHELL
 
```

---

### Incident Patch 10: `981a2fd4` (2026-06-22)
**Commit Message**: ZOOKEEPER-5050: Disable AdminServer and enhance documentation to highlight security considerations

Reviewers: eolivelli, phunt
Author: anmolnar
Closes #2389 from anmolnar/ZOOKEEPER-5050

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/admin/AdminServerFactory.java` (modified, +7/-10)
```diff
@@ -28,6 +28,7 @@
 public class AdminServerFactory {
 
     private static final Logger LOG = LoggerFactory.getLogger(AdminServerFactory.class);
+    static final String ENABLE_ADMIN_SERVER_PROPERTY = "zookeeper.admin.enableServer";
 
     /**
      * This method encapsulates the logic for whether we should use a
@@ -38,21 +39,17 @@ public class AdminServerFactory {
      * to pull in Jetty with ZooKeeper.
      */
     public static AdminServer createAdminServer() {
-        if (!"false".equals(System.getProperty("zookeeper.admin.enableServer"))) {
+        if (Boolean.getBoolean(ENABLE_ADMIN_SERVER_PROPERTY)) {
             try {
                 Class<?> jettyAdminServerC = Class.forName("org.apache.zookeeper.server.admin.JettyAdminServer");
                 Object adminServer = jettyAdminServerC.getConstructor().newInstance();
                 return (AdminServer) adminServer;
 
-            } catch (ClassNotFoundException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (InstantiationException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (IllegalAccessException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (InvocationTargetException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (NoSuchMethodException e) {
+            } catch (ClassNotFoundException
+                     | InstantiationException
+                     | IllegalAccessException
+                     | InvocationTargetException
+                     | NoSuchMethodException e) {
                 LOG.warn("Unable to start JettyAdminServer", e);
             } catch (NoClassDefFoundError e) {
                 LOG.warn("Unable to load jetty, not starting JettyAdminServer", e);
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/admin/AdminServerFactoryTest.java` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.zookeeper.server.admin;
+
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Test;
+
+public class AdminServerFactoryTest {
+
+    @AfterEach
+    public void tearDown() {
+        System.clearProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY);
+    }
+
+    @Test
+    public void testAdminServerDisabledByDefault() {
+        System.clearProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY);
+        AdminServer adminServer = AdminServerFactory.createAdminServer();
+        assertTrue(adminServer instanceof DummyAdminServer);
+        assertFalse(adminServer instanceof JettyAdminServer);
+    }
+
+    @Test
+    public void testAdminServerEnabled() {
+        System.setProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY, "true");
+        AdminServer adminServer = AdminServerFactory.createAdminServer();
+        assertFalse(adminServer instanceof DummyAdminServer);
+        assertTrue(adminServer instanceof JettyAdminServer);
+    }
+}
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/commands.mdx` (modified, +123/-21)
```diff
@@ -183,29 +183,131 @@ $ echo ruok | nc 127.0.0.1 5111
 
 ## The AdminServer
 
-**New in 3.5.0:** The AdminServer is
-an embedded Jetty server that provides an HTTP interface to the four-letter
-word commands. By default, the server is started on port 8080,
-and commands are issued by going to the URL "/commands/\[command name]",
-e.g., http://localhost:8080/commands/stat. The command response is
-returned as JSON. Unlike the original protocol, commands are not
-restricted to four-letter names, and commands can have multiple names;
-for instance, "stmk" can also be referred to as "set_trace_mask". To
-view a list of all available commands, point a browser to the URL
-/commands (e.g., http://localhost:8080/commands). See the [AdminServer configuration options](#configuring-adminserver-for-ssltls)
-for how to change the port and URLs.
-
-The AdminServer is enabled by default, but can be disabled by either:
-
-- Setting the zookeeper.admin.enableServer system
-  property to false.
-- Removing Jetty from the classpath. (This option is
-  useful if you would like to override ZooKeeper's jetty
-  dependency.)
-
-Note that the TCP four-letter word interface is still available if
+**New in 3.5.0:** The AdminServer is an embedded Jetty server that provides an HTTP interface to the four-letter word
+commands. In ZooKeeper releases 3.5.0 through 3.9.x, the AdminServer was enabled by default. Starting with ZooKeeper
+3.10.0, the default configuration disables the AdminServer. When enabled, the server listens on port 8080 by default,
+and commands are issued by accessing the URL `/commands/[command name]`, for example, `http://localhost:8080/commands/stat`.
+Command responses are returned in JSON format.
+
+Unlike the original protocol, commands are not restricted to four-letter names, and commands can have multiple aliases;
+for example, `stmk` can also be referred to as `set_trace_mask`. To view a list of all available commands, access the
+`/commands` endpoint (for example, `http://localhost:8080/commands`). See the AdminServer configuration options for
+information on changing the port and URL mappings.
+
+Beginning with ZooKeeper 3.10.0, the AdminServer is disabled by default and can be enabled by setting the
+`zookeeper.admin.enableServer` system property to `true`. When enabled without additional configuration, the AdminServer
+listens on all network interfaces (`0.0.0.0`), uses unencrypted HTTP, and does not require client authentication.
+Administrators are strongly encouraged to restrict network access and configure appropriate transport security and
+authentication before exposing the AdminServer in production environments.
+
+Make sure that Jetty is available on the classpath, because the AdminServer will automatically remain disabled if Jetty
+cannot be found. This behavior can be useful when overriding ZooKeeper's Jetty dependency.
+
+Note that the TCP four-letter word interface is still available for monitoring purposes if
 the AdminServer is disabled.
 
+### Security Considerations
+
+> **Important:** The AdminServer is disabled by default. When enabled without additional configuration,
+> it listens on all network interfaces (0.0.0.0) on port 8080, uses unencrypted HTTP, and does not
+> require client authentication. As a result, most administrative commands are accessible to any client
+> that can reach the AdminServer. Administrators should restrict access appropriately and enable transport
+> security and authentication when deploying the AdminServer in production.
+
+### Default Security Posture
+
+The default AdminServer configuration is intended for ease of use in trusted environments, but it is **not secure for
+exposure to untrusted networks**.
+
+Default settings include:
+
+- `admin.enableServer=false`
+- `admin.serverAddress=0.0.0.0`
+- `admin.serverPort=8080`
+- `admin.forceHttps=false`
+- `admin.needClientAuth=false`
+
+With these defaults:
+
+- All traffic is transmitted in clear text over HTTP.
+- Administra
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/configuration-parameters.mdx` (modified, +2/-2)
```diff
@@ -1720,8 +1720,8 @@ options are used to configure the [AdminServer](#adminserver-configuration).
 
 - _admin.enableServer_ :
   (Java system property: **zookeeper.admin.enableServer**)
-  Set to "false" to disable the AdminServer. By default the
-  AdminServer is enabled.
+  Set to "true" to enable the AdminServer. By default, the
+  AdminServer is disabled.
 
 - _admin.serverAddress_ :
   (Java system property: **zookeeper.admin.serverAddress**)
```

#### Recent Merged Pull Requests:
- **PR #2458** (2026-09-18): ZOOKEEPER-5089 Upgrade Website and Docs to new ReactRouter and Vite versions (@yuriipalam)
- **PR #2453** (2026-09-15): ZOOKEEPER-5087: Suppress false positive OpenTelemetry CVE-s in OWASP dependency check (@PDavid)
- **PR #2452** (2026-09-02): ZOOKEEPER-5086: Upgrade Netty to 4.1.137.Final (@PDavid)
- **PR #2451** (2026-09-02): ZOOKEEPER-5075: Upgrade JLine to 3.30.14 ADDENDUM: Use jdk8 classifier (@PDavid)
- **PR #2450** (2026-09-02): ZOOKEEPER-5075: Upgrade JLine to 3.30.14 ADDENDUM: Use jdk8 classifier (@PDavid)
- **PR #2449** (2026-09-01): ZOOKEEPER-5085: Remove unused vulnerable prototype.js (@PDavid)
- **PR #2448** (2026-09-01): ZOOKEEPER-5082: Remove special characters from audit logs (@anmolnar)
- **PR #2447** (2026-08-31): ZOOKEEPER-5083: Upgrade Jackson-databind to 2.22.2 to fix known security vulnerabilities (@PDavid)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
