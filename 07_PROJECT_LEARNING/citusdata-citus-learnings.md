> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/citusdata-citus-learnings.md`  
> **Source**: github ([https://github.com/citusdata/citus](https://github.com/citusdata/citus))  
> **Source Version**: `84489d85`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:07:54.372Z  
> **Learning ID**: `learn-github-citusdata-citus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): citusdata/citus

> **Canonical Artifact**: `07_PROJECT_LEARNING/citusdata-citus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/citusdata/citus](https://github.com/citusdata/citus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T03:07:54.363Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `citusdata/citus`
- **Description**: Distributed PostgreSQL as an extension
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12818 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/backend/columnar/write_state_management.c`
```

#include <math.h>

#include "postgres.h"

#include "miscadmin.h"
#include "pgstat.h"

#include "access/genam.h"
#include "access/heapam.h"
#include "access/heaptoast.h"
#include "access/multixact.h"
#include "access/rewriteheap.h"
#include "access/tsmapi.h"
#include "access/xact.h"
#include "catalog/catalog.h"
#include "catalog/index.h"
#include "catalog/objectaccess.h"
#include "catalog/pg_am.h"
#include "catalog/pg_trigger.h"
#include "catalog/storage.h"
#include "catalog/storage_xlog.h"
#include "commands/progress.h"
#include "commands/vacuum.h"
#include "common/hashfn.h"
#include "executor/executor.h"
#include "nodes/makefuncs.h"
#include "optimizer/plancat.h"
#include "storage/bufmgr.h"
#include "storage/bufpage.h"
#include "storage/lmgr.h"
#include "storage/predicate.h"
#include "storage/procarray.h"
#include "storage/smgr.h"
#include "tcop/utility.h"
#include "utils/builtins.h"
#include "utils/pg_rusage.h"
#include "utils/rel.h"
#include "utils/syscache.h"

#include "citus_version.h"
#include "pg_version_compat.h"

#include "columnar/columnar.h"
#include "columnar/columnar_customscan.h"
#include "columnar/columnar_tableam.h"
#include "columnar/columnar_version_compat.h"


/*
 * Mapping from relfilenode to WriteStateMapEntry. This keeps write state for
 * each relation.
 */
static HTAB *WriteStateMap = NULL;

/* memory context for allocating WriteStateMap & all write states */
static MemoryContext WriteStateContext = NULL;

/*
 * Each member of the writeStateStack in WriteStateMapEntry. This means that
 * we did some inserts in the subtransaction subXid, and the state of those
 * inserts is stored at writeState. Those writes can be flushed or unflushed.
 */
typedef struct SubXidWriteState
{
	SubTransactionId subXid;
	ColumnarWriteState *writeState;

	struct SubXidWriteState *next;
} SubXidWriteState;


/*
 * An entry in WriteStateMap.
 */
typedef struct WriteStateMapEntry
{
	/* key of the entry */
	RelFileNumber relfilenumber;

	/*
	 * If a table is dropped, we set dropped to true and set dropSubXid to the
	 * id of the subtransaction in which the drop happened.
	 */
	bool dropped;
	SubTransactionId dropSubXid;

	/*
	 * Stack of SubXidWriteState where first element is top of the stack. When
	 * inserts happen, we look at top of the stack. If top of stack belongs to
	 * current subtransaction, we forward writes to its writeState. Otherwise,
	 * we create a new stack entry for current subtransaction and push it to
	 * the stack, and forward writes to that.
	 */
	SubXidWriteState *writeStateStack;
} WriteStateMapEntry;


/*
 * Memory context reset callback so we reset WriteStateMap to NULL at the end
 * of transaction. WriteStateMap is allocated in & WriteStateMap, so its
 * leaked reference can cause memory issues.
 */
static MemoryContextCallback cleanupCallback;
static void
CleanupWriteStateMap(void *arg)
{
	WriteStateMap = NULL;
	WriteStateContext = NULL;
}


ColumnarWriteState *
columnar_init_write_state(Relation relation, TupleDesc tupdesc,
						  Oid tupSlotRelationId,
						  SubTransactionId currentSubXid)
{
	bool found;

	/*
	 * If this is the first call in current transaction, allocate the hash
	 * table.
	 */
	if (WriteStateMap == NULL)
	{
		WriteStateContext =
			AllocSetContextCreate(
				TopTransactionContext,
				"Column Store Write State Management Context",
				ALLOCSET_DEFAULT_SIZES);
		HASHCTL info;
		uint32 hashFlags = (HASH_ELEM | HASH_FUNCTION | HASH_CONTEXT);
		memset(&info, 0, sizeof(info));
		info.keysize = sizeof(RelFileNumber);
		info.hash = oid_hash;
		info.entrysize = sizeof(WriteStateMapEntry);
		info.hcxt = WriteStateContext;

		WriteStateMap = hash_create("column store write state map",
									64, &info, hashFlags);

		cleanupCallback.arg = NULL;
		cleanupCallback.func = &CleanupWriteStateMap;
		cleanupCallback.next = NULL;
		MemoryContextRegisterResetCallback(WriteStateContext, &cleanupCallback);
	}

	WriteStateMapEntry *hashEntry = hash_search(WriteStateMap,
												&(relation->rd_locator.relNumber),
												HASH_ENTER, &found);
	if (!found)
	{
		hashEntry->writeStateStack = NULL;
		hashEntry->dropped = false;
	}

	Assert(!hashEntry->dropped);

	/*
	 * If top of stack belongs to the current subtransaction, return its
	 * writeState, ...
	 */
	if (hashEntry->writeStateStack != NULL)
	{
		SubXidWriteState *stackHead = hashEntry->writeStateStack;

		if (stackHead->subXid == currentSubXid)
		{
			return stackHead->writeState;
		}
	}

	/*
	 * ... otherwise we need to create a new stack entry for the current
	 * subtransaction.
	 */
	MemoryContext oldContext = MemoryContextSwitchTo(WriteStateContext);

	ColumnarOptions columnarOptions = { 0 };

	/*
	 * In case of a table rewrite, we need to fetch table options based on the
	 * relation id of the source tuple slot.
	 *
	 * For this reason, we always pass tupSlotRelationId here; which should be
	 * same as the target table if the write operation is not related to a table
	 * rewrite etc.
	 */
	ReadColumnarOptions(tupSlotRelationId, &columnarOptions);

	SubXidWriteState *stackEntry = palloc0(sizeof(SubXidWriteState));
	stackEntry->writeState = ColumnarBeginWrite(relation,
												columnarOptions,
												tupdesc);
	stackEntry->subXid = currentSubXid;
	stackEntry->next = hashEntry->writeStateStack;
	hashEntry->writeStateStack = stackEntry;

	MemoryContextSwitchTo(oldContext);

	return stackEntry->writeState;
}


/*
 * Flushes pending writes for given relfilenode in the given subtransaction.
 */
void
FlushWriteStateForRelfilenumber(RelFileNumber relfilenumber,
								SubTransactionId currentSubXid)
{
	if (WriteStateMap == NULL)
	{
		return;
	}

	WriteStateMapEntry *entry = hash_search(WriteStateMap, &relfilenumber, HASH_FIND,
											NULL);

	Assert(!entry || !entry->dropped);

	if (entry && entry->writeStateStack != NULL)
	{
		SubXidWriteState *stackEntry = entry->writeStateStack;
		if (stackEntry->subXid == currentSubXid)
		{
			ColumnarFlushPendingWrites(stackEntry->writeState);
		}
	}
}


/*
 * Helper function for FlushWriteStateForAllRels and DiscardWriteStateForAllRels.
 * Pops all of write states for current subtransaction, and depending on "commit"
 * either flushes them or discards them. This also takes into account dropped
 * tables, and either propagates the dropped flag to parent subtransaction or
 * rolls back abort.
 */
static void
PopWriteStateForAllRels(SubTransactionId currentSubXid, SubTransactionId parentSubXid,
						bool commit)
{
	HASH_SEQ_STATUS status;
	WriteStateMapEntry *entry;

	if (WriteStateMap == NULL)
	{
		return;
	}

	hash_seq_init(&status, WriteStateMap);
	while ((entry = hash_seq_search(&status)) != 0)
	{
		if (entry->writeStateStack == NULL)
		{
			continue;
		}

		/*
		 * If the table has been dropped in current subtransaction, either
		 * commit the drop or roll it back.
		 */
		if (entry->dropped)
		{
			if (entry->dropSubXid == currentSubXid)
			{
				if (commit)
				{
					/* elevate drop to the upper subtransaction */
					entry->dropSubXid = parentSubXid;
				}
				else
				{
					/* abort the drop */
					entry->dropped = false;
				}
			}
		}

		/*
		 * Otherwise, commit or discard pending writes.
		 */
		else
		{
			SubXidWriteState *stackHead = entry->writeStateStack;
			if (stackHead->subXid == currentSubXid)
			{
				if (commit)
				{
					ColumnarEndWrite(stackHead->writeState);
				}

				entry->writeStateStack = stackHead->next;
			}
		}
	}
}


/*
 * Called when current subtransaction is committed.
 */
void
FlushWriteStateForAllRels(SubTransactionId currentSubXid, SubTransactionId parentSubXid)
{
	PopWriteStateForAllRels(currentSubXid, parentSubXid, true);
}


/*
 * Called when current subtransaction is aborted.
 */
void
DiscardWriteStateForAllRels(SubTransactionId currentSubXid, SubTransactionId parentSubXid)
{
	PopWriteStateForAllRels(currentSubXid, parentSubXid, false);
}


/*
 * Called when the given relfilenode is dropped.
 */
void
MarkRelfilenumberDropped(RelFileNumber relfilenumber, SubTransactionId currentSubXid)
{
	if (WriteStateMap == NULL)
	{
		return;
	}

	WriteStateMapEntry *entry = hash_search(WriteStateMap, &relfilenumber, HASH_FIND,
											NULL);
	if (!entry || entry->dropped)
	{
		return;
	}

	entry->dropped = true;
	entry->dropSubXid = currentSubXid;
}


/*
 * Called when the given relfilenode is dropped in non-transactional TRUNCATE.
 */
void
NonTransactionDropWriteState(RelFileNumber relfilenumber)
{
	if (WriteStateMap)
	{
		hash_search(WriteStateMap, &relfilenumber, HASH_REMOVE, false);
	}
}


/*
 * Returns true if there are any pending writes in upper transactions.
 */
bool
PendingWritesInUpperTransactions(RelFileNumber relfilenumber,
								 SubTransactionId currentSubXid)
{
	if (WriteStateMap == NULL)
	{
		return false;
	}

	WriteStateMapEntry *entry = hash_search(WriteStateMap, &relfilenumber, HASH_FIND,
											NULL);

	if (entry && entry->writeStateStack != NULL)
	{
		SubXidWriteState *stackEntry = entry->writeStateStack;

		while (stackEntry != NULL)
		{
			if (stackEntry->subXid != currentSubXid &&
				ContainsPendingWrites(stackEntry->writeState))
			{
				return true;
			}

			stackEntry = stackEntry->next;
		}
	}

	return false;
}


/*
 * GetWriteContextForDebug exposes WriteStateContext for debugging
 * purposes.
 */
extern MemoryContext
GetWriteContextForDebug(void)
{
	return WriteStateContext;
}

```

### Core Architecture Module: `.devcontainer/.vscode/generate_c_cpp_properties-json.py`
```
#! /usr/bin/env pipenv-shebang
"""Generate C/C++ properties file for VSCode.

Uses pgenv to iterate postgres versions and generate
a C/C++ properties file for VSCode containing the
include paths for the postgres headers.

Usage:
  generate_c_cpp_properties-json.py <target_path>
  generate_c_cpp_properties-json.py (-h | --help)
  generate_c_cpp_properties-json.py --version

Options:
  -h --help     Show this screen.
  --version     Show version.

"""
import json
import subprocess

from docopt import docopt


def main(args):
    target_path = args['<target_path>']

    output = subprocess.check_output(['pgenv', 'versions'])
    # typical output is:
    #      14.8      pgsql-14.8
    #  *   15.3      pgsql-15.3
    #      16beta2    pgsql-16beta2
    # where the line marked with a * is the currently active version
    #
    # we are only interested in the first word of each line, which is the version number
    # thus we strip the whitespace and the * from the line and split it into words
    # and take the first word
    versions = [line.strip('* ').split()[0] for line in output.decode('utf-8').splitlines()]

    # create the list of configurations per version
    configurations = []
    for version in versions:
        configurations.append(generate_configuration(version))

    # create the json file
    c_cpp_properties = {
        "configurations": configurations,
        "version": 4
    }

    # write the c_cpp_properties.json file
    with open(target_path, 'w') as f:
        json.dump(c_cpp_properties, f, indent=4)


def generate_configuration(version):
    """Returns a configuration for the given postgres version.

    >>> generate_configuration('14.8')
    {
        "name": "Citus Development Configuration - Postgres 14.8",
        "includePath": [
            "/usr/local/include",
            "/home/citus/.pgenv/src/postgresql-14.8/src/**",
            "${workspaceFolder}/**",
            "${workspaceFolder}/src/include/",
        ],
        "configurationProvider": "ms-vscode.makefile-tools"
    }
    """
    return {
        "name": f"Citus Development Configuration - Postgres {version}",
        "includePath": [
            "/usr/local/include",
            f"/home/citus/.pgenv/src/postgresql-{version}/src/**",
            "${workspaceFolder}/**",
            "${workspaceFolder}/src/include/",
        ],
        "configurationProvider": "ms-vscode.makefile-tools"
    }


if __name__ == '__main__':
    arguments = docopt(__doc__, version='0.1.0')
    main(arguments)

```

### Core Architecture Module: `ci/include_grouping.py`
```
#!/usr/bin/env python3
"""
easy command line to run against all citus-style checked files:

$ git ls-files \
  | git check-attr --stdin citus-style \
  | grep 'citus-style: set' \
  | awk '{print $1}' \
  | cut -d':' -f1 \
  | xargs -n1 ./ci/include_grouping.py
"""

import collections
import os
import sys


def main(args):
    if len(args) < 2:
        print("Usage: include_grouping.py <file>")
        return

    file = args[1]
    if not os.path.isfile(file):
        sys.exit(f"File '{file}' does not exist")

    with open(file, "r") as in_file:
        with open(file + ".tmp", "w") as out_file:
            includes = []
            skipped_lines = []

            # This calls print_sorted_includes on a set of consecutive #include lines.
            # This implicitly keeps separation of any #include lines that are contained in
            # an #ifdef, because it will order the #include lines inside and after the
            # #ifdef completely separately.
            for line in in_file:
                # if a line starts with #include we don't want to print it yet, instead we
                # want to collect all consecutive #include lines
                if line.startswith("#include"):
                    includes.append(line)
                    skipped_lines = []
                    continue

                # if we have collected any #include lines, we want to print them sorted
                # before printing the current line. However, if the current line is empty
                # we want to perform a lookahead to see if the next line is an #include.
                # To maintain any separation between #include lines and their subsequent
                # lines we keep track of all lines we have skipped inbetween.
                if len(includes) > 0:
                    if len(line.strip()) == 0:
                        skipped_lines.append(line)
                        continue

                    # we have includes that need to be grouped before printing the current
                    # line.
                    print_sorted_includes(includes, file=out_file)
                    includes = []

                    # print any skipped lines
                    print("".join(skipped_lines), end="", file=out_file)
                    skipped_lines = []

                print(line, end="", file=out_file)

    # move out_file to file
    os.rename(file + ".tmp", file)


def print_sorted_includes(includes, file=sys.stdout):
    default_group_key = 1
    groups = collections.defaultdict(set)

    # define the groups that we separate correctly. The matchers are tested in the order
    # of their priority field. The first matcher that matches the include is used to
    # assign the include to a group.
    # The groups are printed in the order of their group_key.
    matchers = [
        {
            "name": "system includes",
            "matcher": lambda x: x.startswith("<"),
            "group_key": -2,
            "priority": 0,
        },
        {
            "name": "toplevel postgres includes",
            "matcher": lambda x: "/" not in x,
            "group_key": 0,
            "priority": 9,
        },
        {
            "name": "postgres.h",
            "matcher": lambda x: x.strip() in ['"postgres.h"'],
            "group_key": -1,
            "priority": -1,
        },
        {
            "name": "toplevel citus inlcudes",
            "matcher": lambda x: x.strip()
            in [
                '"citus_version.h"',
                '"pg_version_compat.h"',
                '"pg_version_constants.h"',
            ],
            "group_key": 3,
            "priority": 0,
        },
        {
            "name": "columnar includes",
            "matcher": lambda x: x.startswith('"columnar/'),
            "group_key": 4,
            "priority": 1,
        },
        {
            "name": "distributed includes",
            "matcher": lambda x: x.startswith('"distributed/'),
            "group_key": 5,
            "priority": 1,
        },
    ]
    matchers.sort(key=lambda x: x["priority"])

    # throughout our codebase we have some includes where either postgres or citus
    # includes are wrongfully included with the syntax for system includes. Before we
    # try to match those we will change the <> to "" to make them match our system. This
    # will also rewrite the include to the correct syntax.
    common_system_include_error_prefixes = ["<nodes/", "<distributed/"]

    # assign every include to a group
    for include in includes:
        # extract the group key from the include
        include_content = include.split(" ")[1]

        # fix common system includes which are secretly postgres or citus includes
        for common_prefix in common_system_include_error_prefixes:
            if include_content.startswith(common_prefix):
                include_content = '"' + include_content.strip()[1:-1] + '"'
                include = include.split(" ")[0] + " " + include_content + "\n"
                break

        group_key = default_group_key
        for matcher in matchers:
            if matcher["matcher"](include_content):
                group_key = matcher["group_key"]
                break

        groups[group_key].add(include)

    # iterate over all groups in the natural order of its keys
    for i, group in enumerate(sorted(groups.items())):
        if i > 0:
            print(file=file)
        includes = group[1]
        print("".join(sorted(includes)), end="", file=file)


if __name__ == "__main__":
    main(sys.argv)

```

### Core Architecture Module: `src/backend/columnar/columnar.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar.c
 *
 * This file contains...
 *
 * Copyright (c) 2016, Citus Data, Inc.
 *
 * $Id$
 *
 *-------------------------------------------------------------------------
 */

#include <sys/stat.h>
#include <unistd.h>

#include "postgres.h"

#include "miscadmin.h"

#include "utils/guc.h"
#include "utils/rel.h"

#include "citus_version.h"

#include "columnar/columnar.h"
#include "columnar/columnar_tableam.h"

/* Default values for option parameters */
#define DEFAULT_STRIPE_ROW_COUNT 150000
#define DEFAULT_CHUNK_ROW_COUNT 10000

#if HAVE_LIBZSTD
#define DEFAULT_COMPRESSION_TYPE COMPRESSION_ZSTD
#elif HAVE_CITUS_LIBLZ4
#define DEFAULT_COMPRESSION_TYPE COMPRESSION_LZ4
#else
#define DEFAULT_COMPRESSION_TYPE COMPRESSION_PG_LZ
#endif

int columnar_compression = DEFAULT_COMPRESSION_TYPE;
int columnar_stripe_row_limit = DEFAULT_STRIPE_ROW_COUNT;
int columnar_chunk_group_row_limit = DEFAULT_CHUNK_ROW_COUNT;
int columnar_compression_level = 3;

static const struct config_enum_entry columnar_compression_options[] =
{
	{ "none", COMPRESSION_NONE, false },
	{ "pglz", COMPRESSION_PG_LZ, false },
#if HAVE_CITUS_LIBLZ4
	{ "lz4", COMPRESSION_LZ4, false },
#endif
#if HAVE_LIBZSTD
	{ "zstd", COMPRESSION_ZSTD, false },
#endif
	{ NULL, 0, false }
};

void
columnar_init(void)
{
	columnar_init_gucs();
	columnar_tableam_init();
}


void
columnar_init_gucs(void)
{
	DefineCustomEnumVariable("columnar.compression",
							 "Compression type for columnar.",
							 NULL,
							 &columnar_compression,
							 DEFAULT_COMPRESSION_TYPE,
							 columnar_compression_options,
							 PGC_USERSET,
							 0,
							 NULL,
							 NULL,
							 NULL);

	DefineCustomIntVariable("columnar.compression_level",
							"Compression level to be used with zstd.",
							NULL,
							&columnar_compression_level,
							3,
							COMPRESSION_LEVEL_MIN,
							COMPRESSION_LEVEL_MAX,
							PGC_USERSET,
							0,
							NULL,
							NULL,
							NULL);

	DefineCustomIntVariable("columnar.stripe_row_limit",
							"Maximum number of tuples per stripe.",
							NULL,
							&columnar_stripe_row_limit,
							DEFAULT_STRIPE_ROW_COUNT,
							STRIPE_ROW_COUNT_MINIMUM,
							STRIPE_ROW_COUNT_MAXIMUM,
							PGC_USERSET,
							0,
							NULL,
							NULL,
							NULL);

	DefineCustomIntVariable("columnar.chunk_group_row_limit",
							"Maximum number of rows per chunk.",
							NULL,
							&columnar_chunk_group_row_limit,
							DEFAULT_CHUNK_ROW_COUNT,
							CHUNK_ROW_COUNT_MINIMUM,
							CHUNK_ROW_COUNT_MAXIMUM,
							PGC_USERSET,
							0,
							NULL,
							NULL,
							NULL);
}


/*
 * ParseCompressionType converts a string to a compression type.
 * For compression algorithms that are invalid or not compiled, it
 * returns COMPRESSION_TYPE_INVALID.
 */
CompressionType
ParseCompressionType(const char *compressionTypeString)
{
	Assert(compressionTypeString != NULL);

	for (int compressionIndex = 0;
		 columnar_compression_options[compressionIndex].name != NULL;
		 compressionIndex++)
	{
		const char *compressionName = columnar_compression_options[compressionIndex].name;
		if (strncmp(compressionTypeString, compressionName, NAMEDATALEN) == 0)
		{
			return columnar_compression_options[compressionIndex].val;
		}
	}

	return COMPRESSION_TYPE_INVALID;
}


/*
 * CompressionTypeStr returns string representation of a compression type.
 * For compression algorithms that are invalid or not compiled, it
 * returns NULL.
 */
const char *
CompressionTypeStr(CompressionType requestedType)
{
	for (int compressionIndex = 0;
		 columnar_compression_options[compressionIndex].name != NULL;
		 compressionIndex++)
	{
		CompressionType compressionType =
			columnar_compression_options[compressionIndex].val;
		if (compressionType == requestedType)
		{
			return columnar_compression_options[compressionIndex].name;
		}
	}

	return NULL;
}

```

### Core Architecture Module: `src/backend/columnar/columnar_compression.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_compression.c
 *
 * This file contains compression/decompression functions definitions
 * used for columnar.
 *
 * Copyright (c) 2016, Citus Data, Inc.
 *
 * $Id$
 *
 *-------------------------------------------------------------------------
 */
#include "postgres.h"

#include "common/pg_lzcompress.h"
#include "lib/stringinfo.h"

#include "citus_version.h"
#include "pg_version_constants.h"

#include "columnar/columnar_compression.h"

#if HAVE_CITUS_LIBLZ4
#include <lz4.h>
#endif

#include "varatt.h"

#if HAVE_LIBZSTD
#include <zstd.h>
#endif

/*
 *	The information at the start of the compressed data. This decription is taken
 *	from pg_lzcompress in pre-9.5 version of PostgreSQL.
 */
typedef struct ColumnarCompressHeader
{
	int32 vl_len_;              /* varlena header (do not touch directly!) */
	int32 rawsize;
} ColumnarCompressHeader;

/*
 * Utilities for manipulation of header information for compressed data
 */

#define COLUMNAR_COMPRESS_HDRSZ ((int32) sizeof(ColumnarCompressHeader))
#define COLUMNAR_COMPRESS_RAWSIZE(ptr) (((ColumnarCompressHeader *) (ptr))->rawsize)
#define COLUMNAR_COMPRESS_RAWDATA(ptr) (((char *) (ptr)) + COLUMNAR_COMPRESS_HDRSZ)
#define COLUMNAR_COMPRESS_SET_RAWSIZE(ptr, \
									  len) (((ColumnarCompressHeader *) (ptr))->rawsize = \
												(len))


/*
 * CompressBuffer compresses the given buffer with the given compression type
 * outputBuffer enlarged to contain compressed data. The function returns true
 * if compression is done, returns false if compression is not done.
 * outputBuffer is valid only if the function returns true.
 */
bool
CompressBuffer(StringInfo inputBuffer,
			   StringInfo outputBuffer,
			   CompressionType compressionType,
			   int compressionLevel)
{
	switch (compressionType)
	{
#if HAVE_CITUS_LIBLZ4
		case COMPRESSION_LZ4:
		{
			int maximumLength = LZ4_compressBound(inputBuffer->len);

			resetStringInfo(outputBuffer);
			enlargeStringInfo(outputBuffer, maximumLength);

			int compressedSize = LZ4_compress_default(inputBuffer->data,
													  outputBuffer->data,
													  inputBuffer->len, maximumLength);
			if (compressedSize <= 0)
			{
				elog(DEBUG1,
					 "failure in LZ4_compress_default, input size=%d, output size=%d",
					 inputBuffer->len, maximumLength);
				return false;
			}

			elog(DEBUG1, "compressed %d bytes to %d bytes", inputBuffer->len,
				 compressedSize);

			outputBuffer->len = compressedSize;
			return true;
		}
#endif

#if HAVE_LIBZSTD
		case COMPRESSION_ZSTD:
		{
			int maximumLength = ZSTD_compressBound(inputBuffer->len);

			resetStringInfo(outputBuffer);
			enlargeStringInfo(outputBuffer, maximumLength);

			size_t compressedSize = ZSTD_compress(outputBuffer->data,
												  outputBuffer->maxlen,
												  inputBuffer->data,
												  inputBuffer->len,
												  compressionLevel);

			if (ZSTD_isError(compressedSize))
			{
				ereport(WARNING, (errmsg("zstd compression failed"),
								  (errdetail("%s", ZSTD_getErrorName(compressedSize)))));
				return false;
			}

			outputBuffer->len = compressedSize;
			return true;
		}
#endif

		case COMPRESSION_PG_LZ:
		{
			uint64 maximumLength = PGLZ_MAX_OUTPUT(inputBuffer->len) +
								   COLUMNAR_COMPRESS_HDRSZ;
			bool compressionResult = false;

			resetStringInfo(outputBuffer);
			enlargeStringInfo(outputBuffer, maximumLength);

			int32 compressedByteCount = pglz_compress((const char *) inputBuffer->data,
													  inputBuffer->len,
													  COLUMNAR_COMPRESS_RAWDATA(
														  outputBuffer->data),
													  PGLZ_strategy_always);
			if (compressedByteCount >= 0)
			{
				COLUMNAR_COMPRESS_SET_RAWSIZE(outputBuffer->data, inputBuffer->len);
				SET_VARSIZE_COMPRESSED(outputBuffer->data,
									   compressedByteCount + COLUMNAR_COMPRESS_HDRSZ);
				compressionResult = true;
			}

			if (compressionResult)
			{
				outputBuffer->len = VARSIZE(outputBuffer->data);
			}

			return compressionResult;
		}

		default:
		{
			return false;
		}
	}
}


/*
 * DecompressBuffer decompresses the given buffer with the given compression
 * type. This function returns the buffer as-is when no compression is applied.
 */
StringInfo
DecompressBuffer(StringInfo buffer,
				 CompressionType compressionType,
				 uint64 decompressedSize)
{
	switch (compressionType)
	{
		case COMPRESSION_NONE:
		{
			return buffer;
		}

#if HAVE_CITUS_LIBLZ4
		case COMPRESSION_LZ4:
		{
			StringInfo decompressedBuffer = makeStringInfo();
			enlargeStringInfo(decompressedBuffer, decompressedSize);

			int lz4DecompressSize = LZ4_decompress_safe(buffer->data,
														decompressedBuffer->data,
														buffer->len,
														decompressedSize);

			if (lz4DecompressSize != decompressedSize)
			{
				ereport(ERROR, (errmsg("cannot decompress the buffer"),
								errdetail("Expected %lu bytes, but received %d bytes",
										  decompressedSize, lz4DecompressSize)));
			}

			decompressedBuffer->len = decompressedSize;

			return decompressedBuffer;
		}
#endif

#if HAVE_LIBZSTD
		case COMPRESSION_ZSTD:
		{
			StringInfo decompressedBuffer = makeStringInfo();
			enlargeStringInfo(decompressedBuffer, decompressedSize);

			size_t zstdDecompressSize = ZSTD_decompress(decompressedBuffer->data,
														decompressedSize,
														buffer->data,
														buffer->len);
			if (ZSTD_isError(zstdDecompressSize))
			{
				ereport(ERROR, (errmsg("zstd decompression failed"),
								(errdetail("%s", ZSTD_getErrorName(
											   zstdDecompressSize)))));
			}

			if (zstdDecompressSize != decompressedSize)
			{
				ereport(ERROR, (errmsg("unexpected decompressed size"),
								errdetail("Expected %ld, received %ld", decompressedSize,
										  zstdDecompressSize)));
			}

			decompressedBuffer->len = decompressedSize;

			return decompressedBuffer;
		}
#endif

		case COMPRESSION_PG_LZ:
		{
			uint32 compressedDataSize = VARSIZE(buffer->data) - COLUMNAR_COMPRESS_HDRSZ;
			uint32 decompressedDataSize = COLUMNAR_COMPRESS_RAWSIZE(buffer->data);

			if (compressedDataSize + COLUMNAR_COMPRESS_HDRSZ != buffer->len)
			{
				ereport(ERROR, (errmsg("cannot decompress the buffer"),
								errdetail("Expected %u bytes, but received %u bytes",
										  compressedDataSize, buffer->len)));
			}

			char *decompressedData = palloc0(decompressedDataSize);

			int32 decompressedByteCount = pglz_decompress(COLUMNAR_COMPRESS_RAWDATA(
															  buffer->data),
														  compressedDataSize,
														  decompressedData,
														  decompressedDataSize, true);

			if (decompressedByteCount < 0)
			{
				ereport(ERROR, (errmsg("cannot decompress the buffer"),
								errdetail("compressed data is corrupted")));
			}

			StringInfo decompressedBuffer = palloc0(sizeof(StringInfoData));
			decompressedBuffer->data = decompressedData;
			decompressedBuffer->len = decompressedDataSize;
			decompressedBuffer->maxlen = decompressedDataSize;

			return decompressedBuffer;
		}

		default:
		{
			ereport(ERROR, (errmsg("unexpected compression type: %d", compressionType)));
		}
	}
}

```

### Core Architecture Module: `src/backend/columnar/columnar_customscan.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_customscan.c
 *
 * This file contains the implementation of a postgres custom scan that
 * we use to push down the projections into the table access methods.
 *
 * $Id$
 *
 *-------------------------------------------------------------------------
 */

#include <math.h>

#include "postgres.h"

#include "miscadmin.h"

#include "access/amapi.h"
#include "access/skey.h"
#include "catalog/pg_am.h"
#include "catalog/pg_statistic.h"
#include "commands/defrem.h"

#include "columnar/columnar_version_compat.h"
#if PG_VERSION_NUM >= PG_VERSION_18
#include "commands/explain_format.h"
#endif
#include "executor/executor.h"   /* for ExecInitExprWithParams(), ExecEvalExpr() */
#include "nodes/execnodes.h"     /* for ExprState, ExprContext, etc. */
#include "nodes/extensible.h"
#include "nodes/makefuncs.h"
#include "nodes/nodeFuncs.h"
#include "nodes/pg_list.h"
#include "nodes/plannodes.h"
#include "optimizer/cost.h"
#include "optimizer/optimizer.h"
#include "optimizer/pathnode.h"
#include "optimizer/paths.h"
#include "optimizer/plancat.h"
#include "optimizer/restrictinfo.h"
#include "parser/parse_relation.h"
#include "parser/parsetree.h"
#include "utils/builtins.h"
#include "utils/guc.h"
#include "utils/lsyscache.h"
#include "utils/relcache.h"
#include "utils/ruleutils.h"
#include "utils/selfuncs.h"
#include "utils/spccache.h"

#include "citus_version.h"

#include "columnar/columnar.h"
#include "columnar/columnar_customscan.h"
#include "columnar/columnar_metadata.h"
#include "columnar/columnar_tableam.h"

#include "distributed/listutils.h"

/*
 * ColumnarScanState represents the state for a columnar scan. It's a
 * CustomScanState with additional fields specific to columnar scans.
 */
typedef struct ColumnarScanState
{
	CustomScanState custom_scanstate; /* must be first field */

	ExprContext *css_RuntimeContext;
	List *qual;
} ColumnarScanState;


typedef bool (*PathPredicate)(Path *path);


/* functions to cost paths in-place */
static void CostColumnarPaths(PlannerInfo *root, RelOptInfo *rel, Oid relationId);
static void CostColumnarIndexPath(PlannerInfo *root, RelOptInfo *rel, Oid relationId,
								  IndexPath *indexPath);
static void CostColumnarSeqPath(RelOptInfo *rel, Oid relationId, Path *path);
static void CostColumnarScan(PlannerInfo *root, RelOptInfo *rel, Oid relationId,
							 CustomPath *cpath, int numberOfColumnsRead,
							 int nClauses);

/* functions to add new paths */
static void AddColumnarScanPaths(PlannerInfo *root, RelOptInfo *rel,
								 RangeTblEntry *rte);
static void AddColumnarScanPath(PlannerInfo *root, RelOptInfo *rel,
								RangeTblEntry *rte, Relids required_relids);

/* helper functions to be used when costing paths or altering them */
static void RemovePathsByPredicate(RelOptInfo *rel, PathPredicate removePathPredicate);
static bool IsNotIndexPath(Path *path);
static Cost ColumnarIndexScanAdditionalCost(PlannerInfo *root, RelOptInfo *rel,
											Oid relationId, IndexPath *indexPath);
static int RelationIdGetNumberOfAttributes(Oid relationId);
static Cost ColumnarPerStripeScanCost(RelOptInfo *rel, Oid relationId,
									  int numberOfColumnsRead);
static uint64 ColumnarTableStripeCount(Oid relationId);
static Path * CreateColumnarSeqScanPath(PlannerInfo *root, RelOptInfo *rel,
										Oid relationId);
static void AddColumnarScanPathsRec(PlannerInfo *root, RelOptInfo *rel,
									RangeTblEntry *rte, Relids paramRelids,
									Relids candidateRelids,
									int depthLimit);

/* hooks and callbacks */
static void ColumnarSetRelPathlistHook(PlannerInfo *root, RelOptInfo *rel, Index rti,
									   RangeTblEntry *rte);
#if PG_VERSION_NUM < PG_VERSION_19
static void ColumnarGetRelationInfoHook(PlannerInfo *root, Oid relationObjectId,
										bool inhparent, RelOptInfo *rel);
#else
static void ColumnarBuildSimpleRelHook(PlannerInfo *root, RelOptInfo *rel,
									   RangeTblEntry *rte);
#endif
static Plan * ColumnarScanPath_PlanCustomPath(PlannerInfo *root,
											  RelOptInfo *rel,
											  struct CustomPath *best_path,
											  List *tlist,
											  List *clauses,
											  List *custom_plans);
static List * ColumnarScanPath_ReparameterizeCustomPathByChild(PlannerInfo *root,
															   List *custom_private,
															   RelOptInfo *child_rel);
static Node * ColumnarScan_CreateCustomScanState(CustomScan *cscan);

static void ColumnarScan_BeginCustomScan(CustomScanState *node, EState *estate,
										 int eflags);
static TupleTableSlot * ColumnarScan_ExecCustomScan(CustomScanState *node);
static void ColumnarScan_EndCustomScan(CustomScanState *node);
static void ColumnarScan_ReScanCustomScan(CustomScanState *node);
static void ColumnarScan_ExplainCustomScan(CustomScanState *node, List *ancestors,
										   ExplainState *es);

/* helper functions to build strings for EXPLAIN */
static const char * ColumnarPushdownClausesStr(List *context, List *clauses);
static const char * ColumnarProjectedColumnsStr(List *context,
												List *projectedColumns);
static List * set_deparse_context_planstate(List *dpcontext, Node *node,
											List *ancestors);

/* other helpers */
static List * ColumnarVarNeeded(ColumnarScanState *columnarScanState);
static Bitmapset * ColumnarAttrNeeded(ScanState *ss);
static Bitmapset * fixup_inherited_columns(Oid parentId, Oid childId, Bitmapset *columns);

/* saved hook value in case of unload */
static set_rel_pathlist_hook_type PreviousSetRelPathlistHook = NULL;
#if PG_VERSION_NUM < PG_VERSION_19
static get_relation_info_hook_type PreviousGetRelationInfoHook = NULL;
#else
static build_simple_rel_hook_type PreviousBuildSimpleRelHook = NULL;
#endif

static bool EnableColumnarCustomScan = true;
static bool EnableColumnarQualPushdown = true;
static double ColumnarQualPushdownCorrelationThreshold = 0.9;
static int ColumnarMaxCustomScanPaths = 64;
static int ColumnarPlannerDebugLevel = DEBUG3;


const struct CustomPathMethods ColumnarScanPathMethods = {
	.CustomName = "ColumnarScan",
	.PlanCustomPath = ColumnarScanPath_PlanCustomPath,
	.ReparameterizeCustomPathByChild = ColumnarScanPath_ReparameterizeCustomPathByChild,
};

const struct CustomScanMethods ColumnarScanScanMethods = {
	.CustomName = "ColumnarScan",
	.CreateCustomScanState = ColumnarScan_CreateCustomScanState,
};

const struct CustomExecMethods ColumnarScanExecuteMethods = {
	.CustomName = "ColumnarScan",

	.BeginCustomScan = ColumnarScan_BeginCustomScan,
	.ExecCustomScan = ColumnarScan_ExecCustomScan,
	.EndCustomScan = ColumnarScan_EndCustomScan,
	.ReScanCustomScan = ColumnarScan_ReScanCustomScan,

	.ExplainCustomScan = ColumnarScan_ExplainCustomScan,
};

static const struct config_enum_entry debug_level_options[] = {
	{ "debug5", DEBUG5, false },
	{ "debug4", DEBUG4, false },
	{ "debug3", DEBUG3, false },
	{ "debug2", DEBUG2, false },
	{ "debug1", DEBUG1, false },
	{ "debug", DEBUG2, true },
	{ "info", INFO, false },
	{ "notice", NOTICE, false },
	{ "warning", WARNING, false },
	{ "log", LOG, false },
	{ NULL, 0, false }
};


/*
 * columnar_customscan_init installs the hook required to intercept the postgres planner and
 * provide extra paths for columnar tables
 */
void
columnar_customscan_init(void)
{
	PreviousSetRelPathlistHook = set_rel_pathlist_hook;
	set_rel_pathlist_hook = ColumnarSetRelPathlistHook;

#if PG_VERSION_NUM < PG_VERSION_19
	PreviousGetRelationInfoHook = get_relation_info_hook;
	get_relation_info_hook = ColumnarGetRelationInfoHook;
#else
	PreviousBuildSimpleRelHook = build_simple_rel_hook;
	build_simple_rel_hook = ColumnarBuildSimpleRelHook;
#endif

	/* register customscan specific GUC's */
	DefineCustomBoolVariable(
		"columnar.enable_custom_scan",
		gettext_noop("Enables the use of a custom scan to push projections and quals "
					 "into the storage layer."),
		NULL,
		&EnableColumnarCustomScan,
		true,
		PGC_USERSET,
		GUC_NO_SHOW_ALL | GUC_NOT_IN_SAMPLE,
		NULL, NULL, NULL);
	DefineCustomBoolVariable(
		"columnar.enable_qual_pushdown",
		gettext_noop("Enables qual pushdown into columnar. This has no effect unless "
					 "columnar.enable_custom_scan is true."),
		NULL,
		&EnableColumnarQualPushdown,
		true,
		PGC_USERSET,
		GUC_NO_SHOW_ALL | GUC_NOT_IN_SAMPLE,
		NULL, NULL, NULL);
	DefineCustomRealVariable(
		"columnar.qual_pushdown_correlation_threshold",
		gettext_noop("Correlation threshold to attempt to push a qual "
					 "referencing the given column. A value of 0 means "
					 "attempt to push down all quals, even if the column "
					 "is uncorrelated."),
		NULL,
		&ColumnarQualPushdownCorrelationThreshold,
		0.9,
		0.0,
		1.0,
		PGC_USERSET,
		GUC_NO_SHOW_ALL | GUC_NOT_IN_SAMPLE,
		NULL, NULL, NULL);
	DefineCustomIntVariable(
		"columnar.max_custom_scan_paths",
		gettext_noop("Maximum number of custom scan paths to generate "
					 "for a columnar table when planning."),
		NULL,
		&ColumnarMaxCustomScanPaths,
		64,
		1,
		1024,
		PGC_USERSET,
		GUC_NO_SHOW_ALL | GUC_NOT_IN_SAMPLE,
		NULL, NULL, NULL);
	DefineCustomEnumVariable(
		"columnar.planner_debug_level",
		"Message level for columnar planning information.",
		NULL,
		&ColumnarPlannerDebugLevel,
		DEBUG3,
		debug_level_options,
		PGC_USERSET,
		0,
		NULL,
		NULL,
		NULL);

	RegisterCustomScanMethods(&ColumnarScanScanMethods);
}


static void
ColumnarSetRelPathlistHook(PlannerInfo *root, RelOptInfo *rel, Index rti,
						   RangeTblEntry *rte)
{
	/* call into previous hook if assigned */
	if (PreviousSetRelPathlistHook)
	{
		PreviousSetRelPathlistHook(root, rel, rti, rte);
	}

	if (!OidIsValid(rte->relid) || rte->rtekind != RTE_RELATION || rte->inh)
	{
		/* some calls to the pathlist hook don't have a valid relation set. Do nothing */
		return;
	}

	/*
	 * Here we want to inspect if this relation pathlist hook is accessing a columnar table.
	 * If that is the case we want to insert an extra path that pushes down the projection
	 * into the scan of the table to minimize th
```

### Core Architecture Module: `src/backend/columnar/columnar_debug.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_debug.c
 *
 * Helper functions to debug column store.
 *
 *-------------------------------------------------------------------------
 */


#include "postgres.h"

#include "funcapi.h"
#include "miscadmin.h"

#include "access/nbtree.h"
#include "access/table.h"
#include "catalog/pg_am.h"
#include "catalog/pg_type.h"
#include "storage/fd.h"
#include "storage/smgr.h"
#include "utils/guc.h"
#include "utils/memutils.h"
#include "utils/rel.h"
#include "utils/tuplestore.h"

#include "pg_version_compat.h"
#include "pg_version_constants.h"

#include "columnar/columnar.h"
#include "columnar/columnar_storage.h"
#include "columnar/columnar_version_compat.h"

static void MemoryContextTotals(MemoryContext context, MemoryContextCounters *counters);

PG_FUNCTION_INFO_V1(columnar_store_memory_stats);
PG_FUNCTION_INFO_V1(columnar_storage_info);


/*
 * columnar_store_memory_stats returns a record of 3 values: size of
 * TopMemoryContext, TopTransactionContext, and Write State context.
 */
Datum
columnar_store_memory_stats(PG_FUNCTION_ARGS)
{
	const int resultColumnCount = 3;

	TupleDesc tupleDescriptor = CreateTemplateTupleDesc(resultColumnCount);

	TupleDescInitEntry(tupleDescriptor, (AttrNumber) 1, "TopMemoryContext",
					   INT8OID, -1, 0);
	TupleDescInitEntry(tupleDescriptor, (AttrNumber) 2, "TopTransactionContext",
					   INT8OID, -1, 0);
	TupleDescInitEntry(tupleDescriptor, (AttrNumber) 3, "WriteStateContext",
					   INT8OID, -1, 0);

	tupleDescriptor = BlessTupleDesc(tupleDescriptor);

	MemoryContextCounters transactionCounters = { 0 };
	MemoryContextCounters topCounters = { 0 };
	MemoryContextCounters writeStateCounters = { 0 };
	MemoryContextTotals(TopTransactionContext, &transactionCounters);
	MemoryContextTotals(TopMemoryContext, &topCounters);
	MemoryContextTotals(GetWriteContextForDebug(), &writeStateCounters);

	bool nulls[3] = { false };
	Datum values[3] = {
		Int64GetDatum(topCounters.totalspace),
		Int64GetDatum(transactionCounters.totalspace),
		Int64GetDatum(writeStateCounters.totalspace)
	};

	HeapTuple tuple = heap_form_tuple(tupleDescriptor, values, nulls);

	PG_RETURN_DATUM(HeapTupleGetDatum(tuple));
}


/*
 * columnar_storage_info - UDF to return internal storage info for a columnar relation.
 *
 * DDL:
 *  CREATE OR REPLACE FUNCTION columnar_storage_info(
 *      rel regclass,
 *      version_major OUT int4,
 *      version_minor OUT int4,
 *      storage_id OUT int8,
 *      reserved_stripe_id OUT int8,
 *      reserved_row_number OUT int8,
 *      reserved_offset OUT int8)
 *    STRICT
 *    LANGUAGE c AS 'MODULE_PATHNAME', 'columnar_storage_info';
 */
Datum
columnar_storage_info(PG_FUNCTION_ARGS)
{
#define STORAGE_INFO_NATTS 6
	Oid relid = PG_GETARG_OID(0);
	TupleDesc tupdesc;

	/* Build a tuple descriptor for our result type */
	if (get_call_result_type(fcinfo, NULL, &tupdesc) != TYPEFUNC_COMPOSITE)
	{
		elog(ERROR, "return type must be a row type");
	}

	if (tupdesc->natts != STORAGE_INFO_NATTS)
	{
		elog(ERROR, "return type must have %d columns", STORAGE_INFO_NATTS);
	}

	Relation rel = table_open(relid, AccessShareLock);
	if (!IsColumnarTableAmTable(relid))
	{
		ereport(ERROR, (errmsg("table \"%s\" is not a columnar table",
							   RelationGetRelationName(rel))));
	}

	Datum values[STORAGE_INFO_NATTS] = { 0 };
	bool nulls[STORAGE_INFO_NATTS] = { 0 };

	/*
	 * Pass force = true so that we can inspect metapages that are not the
	 * current version.
	 *
	 * NB: ensure the order and number of attributes correspond to DDL
	 * declaration.
	 */
	values[0] = Int32GetDatum(ColumnarStorageGetVersionMajor(rel, true));
	values[1] = Int32GetDatum(ColumnarStorageGetVersionMinor(rel, true));
	values[2] = Int64GetDatum(ColumnarStorageGetStorageId(rel, true));
	values[3] = Int64GetDatum(ColumnarStorageGetReservedStripeId(rel, true));
	values[4] = Int64GetDatum(ColumnarStorageGetReservedRowNumber(rel, true));
	values[5] = Int64GetDatum(ColumnarStorageGetReservedOffset(rel, true));

	/* release lock */
	table_close(rel, AccessShareLock);

	HeapTuple tuple = heap_form_tuple(tupdesc, values, nulls);

	PG_RETURN_DATUM(HeapTupleGetDatum(tuple));
}


/*
 * MemoryContextTotals adds stats of the given memory context and its
 * subtree to the given counters.
 */
static void
MemoryContextTotals(MemoryContext context, MemoryContextCounters *counters)
{
	if (context == NULL)
	{
		return;
	}

	MemoryContext child;
	for (child = context->firstchild; child != NULL; child = child->nextchild)
	{
		MemoryContextTotals(child, counters);
	}

	context->methods->stats(context, NULL, NULL, counters, true);
}

```

### Core Architecture Module: `src/backend/columnar/columnar_metadata.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_metadata.c
 *
 * Copyright (c) Citus Data, Inc.
 *
 * Manages metadata for columnar relations in separate, shared metadata tables
 * in the "columnar" schema.
 *
 *   * holds basic stripe information including data size and row counts
 *   * holds basic chunk and chunk group information like data offsets and
 *     min/max values (used for Chunk Group Filtering)
 *   * useful for fast VACUUM operations (e.g. reporting with VACUUM VERBOSE)
 *   * useful for stats/costing
 *   * maps logical row numbers to stripe IDs
 *   * TODO: visibility information
 *
 *-------------------------------------------------------------------------
 */


#include <sys/stat.h>

#include "postgres.h"

#include "miscadmin.h"
#include "port.h"
#include "safe_lib.h"

#include "access/heapam.h"
#include "access/htup_details.h"
#include "access/nbtree.h"
#include "access/xact.h"
#include "catalog/indexing.h"
#include "catalog/namespace.h"
#include "catalog/pg_collation.h"
#include "catalog/pg_namespace.h"
#include "catalog/pg_type.h"
#include "commands/defrem.h"
#include "commands/sequence.h"
#include "commands/trigger.h"
#include "executor/executor.h"
#include "executor/spi.h"
#include "lib/stringinfo.h"
#include "nodes/execnodes.h"
#include "parser/parse_relation.h"
#include "storage/fd.h"
#include "storage/lmgr.h"
#include "storage/procarray.h"
#include "storage/relfilelocator.h"
#include "storage/smgr.h"
#include "utils/builtins.h"
#include "utils/fmgroids.h"
#include "utils/lsyscache.h"
#include "utils/memutils.h"
#include "utils/rel.h"
#include "utils/relfilenumbermap.h"

#include "citus_version.h"
#include "pg_version_constants.h"

#include "columnar/columnar.h"
#include "columnar/columnar_storage.h"
#include "columnar/columnar_version_compat.h"

#include "distributed/listutils.h"

#define COLUMNAR_RELOPTION_NAMESPACE "columnar"
#define SLOW_METADATA_ACCESS_WARNING \
		"Metadata index %s is not available, this might mean slower read/writes " \
		"on columnar tables. This is expected during Postgres upgrades and not " \
		"expected otherwise."

typedef struct
{
	Relation rel;
	EState *estate;
	ResultRelInfo *resultRelInfo;
} ModifyState;

/* RowNumberLookupMode to be used in StripeMetadataLookupRowNumber */
typedef enum RowNumberLookupMode
{
	/*
	 * Find the stripe whose firstRowNumber is less than or equal to given
	 * input rowNumber.
	 */
	FIND_LESS_OR_EQUAL,

	/*
	 * Find the stripe whose firstRowNumber is greater than input rowNumber.
	 */
	FIND_GREATER
} RowNumberLookupMode;

static void ParseColumnarRelOptions(List *reloptions, ColumnarOptions *options);
static void InsertEmptyStripeMetadataRow(uint64 storageId, uint64 stripeId,
										 uint32 columnCount, uint32 chunkGroupRowCount,
										 uint64 firstRowNumber);
static void GetHighestUsedAddressAndId(uint64 storageId,
									   uint64 *highestUsedAddress,
									   uint64 *highestUsedId);
static StripeMetadata * UpdateStripeMetadataRow(uint64 storageId, uint64 stripeId,
												uint64 fileOffset, uint64 dataLength,
												uint64 rowCount, uint64 chunkCount);

static List * ReadDataFileStripeList(uint64 storageId, Snapshot snapshot);
static StripeMetadata * BuildStripeMetadata(Relation columnarStripes,
											HeapTuple heapTuple);
static bool StripeMetadataXminAborted(HeapTupleHeader tupleHeader);
static uint32 * ReadChunkGroupRowCounts(uint64 storageId, uint64 stripe, uint32
										chunkGroupCount, Snapshot snapshot);
static Oid ColumnarStorageIdSequenceRelationId(void);
static Oid ColumnarStripeRelationId(void);
static Oid ColumnarStripePKeyIndexRelationId(void);
static Oid ColumnarStripeFirstRowNumberIndexRelationId(void);
static Oid ColumnarOptionsRelationId(void);
static Oid ColumnarOptionsIndexRegclass(void);
static Oid ColumnarChunkRelationId(void);
static Oid ColumnarChunkGroupRelationId(void);
static Oid ColumnarChunkIndexRelationId(void);
static Oid ColumnarChunkGroupIndexRelationId(void);
static Oid ColumnarNamespaceId(void);
static uint64 LookupStorageId(Oid relationId, RelFileLocator relfilelocator);
static uint64 GetHighestUsedRowNumber(uint64 storageId);
static void DeleteStorageFromColumnarMetadataTable(Oid metadataTableId,
												   AttrNumber storageIdAtrrNumber,
												   Oid storageIdIndexId,
												   uint64 storageId);
static ModifyState * StartModifyRelation(Relation rel);
static void InsertTupleAndEnforceConstraints(ModifyState *state, Datum *values,
											 bool *nulls);
static void DeleteTupleAndEnforceConstraints(ModifyState *state, HeapTuple heapTuple);
static void FinishModifyRelation(ModifyState *state);
static EState * create_estate_for_relation(Relation rel);
static bytea * DatumToBytea(Datum value, Form_pg_attribute attrForm);
static Datum ByteaToDatum(bytea *bytes, Form_pg_attribute attrForm);
static bool WriteColumnarOptions(Oid regclass, ColumnarOptions *options, bool overwrite);
static StripeMetadata * StripeMetadataLookupRowNumber(Relation relation, uint64 rowNumber,
													  Snapshot snapshot,
													  RowNumberLookupMode lookupMode);
static void CheckStripeMetadataConsistency(StripeMetadata *stripeMetadata);

PG_FUNCTION_INFO_V1(columnar_relation_storageid);
PG_FUNCTION_INFO_V1(test_columnar_metadata_xmin_aborted);

/* constants for columnar.options */
#define Natts_columnar_options 5
#define Anum_columnar_options_regclass 1
#define Anum_columnar_options_chunk_group_row_limit 2
#define Anum_columnar_options_stripe_row_limit 3
#define Anum_columnar_options_compression_level 4
#define Anum_columnar_options_compression 5

/* ----------------
 *		columnar.options definition.
 * ----------------
 */
typedef struct FormData_columnar_options
{
	Oid regclass;
	int32 chunk_group_row_limit;
	int32 stripe_row_limit;
	int32 compressionLevel;
	NameData compression;

#ifdef CATALOG_VARLEN           /* variable-length fields start here */
#endif
} FormData_columnar_options;
typedef FormData_columnar_options *Form_columnar_options;


/* constants for columnar.stripe */
#define Natts_columnar_stripe 9
#define Anum_columnar_stripe_storageid 1
#define Anum_columnar_stripe_stripe 2
#define Anum_columnar_stripe_file_offset 3
#define Anum_columnar_stripe_data_length 4
#define Anum_columnar_stripe_column_count 5
#define Anum_columnar_stripe_chunk_row_count 6
#define Anum_columnar_stripe_row_count 7
#define Anum_columnar_stripe_chunk_count 8
#define Anum_columnar_stripe_first_row_number 9

static int GetFirstRowNumberAttrIndexInColumnarStripe(TupleDesc tupleDesc);

/* constants for columnar.chunk_group */
#define Natts_columnar_chunkgroup 4
#define Anum_columnar_chunkgroup_storageid 1
#define Anum_columnar_chunkgroup_stripe 2
#define Anum_columnar_chunkgroup_chunk 3
#define Anum_columnar_chunkgroup_row_count 4

/* constants for columnar.chunk */
#define Natts_columnar_chunk 14
#define Anum_columnar_chunk_storageid 1
#define Anum_columnar_chunk_stripe 2
#define Anum_columnar_chunk_attr 3
#define Anum_columnar_chunk_chunk 4
#define Anum_columnar_chunk_minimum_value 5
#define Anum_columnar_chunk_maximum_value 6
#define Anum_columnar_chunk_value_stream_offset 7
#define Anum_columnar_chunk_value_stream_length 8
#define Anum_columnar_chunk_exists_stream_offset 9
#define Anum_columnar_chunk_exists_stream_length 10
#define Anum_columnar_chunk_value_compression_type 11
#define Anum_columnar_chunk_value_compression_level 12
#define Anum_columnar_chunk_value_decompressed_size 13
#define Anum_columnar_chunk_value_count 14


/*
 * InitColumnarOptions initialized the columnar table options. Meaning it writes the
 * default options to the options table if not already existing.
 */
void
InitColumnarOptions(Oid regclass)
{
	/*
	 * When upgrading we retain options for all columnar tables by upgrading
	 * "columnar.options" catalog table, so we shouldn't do anything here.
	 */
	if (IsBinaryUpgrade)
	{
		return;
	}

	ColumnarOptions defaultOptions = {
		.chunkRowCount = columnar_chunk_group_row_limit,
		.stripeRowCount = columnar_stripe_row_limit,
		.compressionType = columnar_compression,
		.compressionLevel = columnar_compression_level
	};

	WriteColumnarOptions(regclass, &defaultOptions, false);
}


/*
 * ParseColumnarRelOptions - update the given 'options' using the given list
 * of DefElem.
 */
static void
ParseColumnarRelOptions(List *reloptions, ColumnarOptions *options)
{
	ListCell *lc = NULL;

	foreach(lc, reloptions)
	{
		DefElem *elem = castNode(DefElem, lfirst(lc));

		if (elem->defnamespace == NULL ||
			strcmp(elem->defnamespace, COLUMNAR_RELOPTION_NAMESPACE) != 0)
		{
			ereport(ERROR, (errmsg("columnar options must have the prefix \"%s\"",
								   COLUMNAR_RELOPTION_NAMESPACE)));
		}

		if (strcmp(elem->defname, "chunk_group_row_limit") == 0)
		{
			options->chunkRowCount = (elem->arg == NULL) ?
									 columnar_chunk_group_row_limit : defGetInt64(elem);
			if (options->chunkRowCount < CHUNK_ROW_COUNT_MINIMUM ||
				options->chunkRowCount > CHUNK_ROW_COUNT_MAXIMUM)
			{
				ereport(ERROR, (errmsg("chunk group row count limit out of range"),
								errhint("chunk group row count limit must be between "
										UINT64_FORMAT " and " UINT64_FORMAT,
										(uint64) CHUNK_ROW_COUNT_MINIMUM,
										(uint64) CHUNK_ROW_COUNT_MAXIMUM)));
			}
		}
		else if (strcmp(elem->defname, "stripe_row_limit") == 0)
		{
			options->stripeRowCount = (elem->arg == NULL) ?
									  columnar_stripe_row_limit : defGetInt64(elem);

			if (options->stripeRowCount < STRIPE_ROW_COUNT_MINIMUM ||
				options->stripeRowCount > STRIPE_ROW_COUNT_MAXIMUM)
			{
				ereport(ERROR, (errmsg("stripe row count limit out of range"),
								errhint("stripe row count limit must be between "
										UINT64_FORMAT " and " UINT64_FORMAT,
										(uint64) STRIPE_ROW_COUNT_MINIMUM,
										(uint64) STRIPE_ROW_COUNT_MAXIMUM)));
			}
		}
		else if (strcmp(elem->defname, "compression") == 0)
		{
			options->compressionType = (elem->arg == NULL) 
```

### Core Architecture Module: `src/backend/columnar/columnar_reader.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_reader.c
 *
 * This file contains function definitions for reading columnar tables. This
 * includes the logic for reading file level metadata, reading row stripes,
 * and skipping unrelated row chunks and columns.
 *
 * Copyright (c) 2016, Citus Data, Inc.
 *
 * $Id$
 *
 *-------------------------------------------------------------------------
 */


#include "postgres.h"

#include "safe_lib.h"

#include "access/nbtree.h"
#include "access/xact.h"
#include "catalog/pg_am.h"
#include "commands/defrem.h"
#include "nodes/makefuncs.h"
#include "nodes/nodeFuncs.h"
#include "optimizer/clauses.h"
#include "optimizer/optimizer.h"
#include "optimizer/restrictinfo.h"
#include "storage/fd.h"
#include "utils/guc.h"
#include "utils/lsyscache.h"
#include "utils/memutils.h"
#include "utils/rel.h"

#include "columnar/columnar.h"
#include "columnar/columnar_storage.h"
#include "columnar/columnar_tableam.h"
#include "columnar/columnar_version_compat.h"

#include "distributed/listutils.h"

#define UNEXPECTED_STRIPE_READ_ERR_MSG \
		"attempted to read an unexpected stripe while reading columnar " \
		"table %s, stripe with id=" UINT64_FORMAT " is not flushed"

typedef struct ChunkGroupReadState
{
	int64 currentRow;
	int64 rowCount;
	int columnCount;
	List *projectedColumnList;  /* borrowed reference */
	ChunkData *chunkGroupData;
} ChunkGroupReadState;

typedef struct StripeReadState
{
	int columnCount;
	int64 rowCount;
	int64 currentRow;
	TupleDesc tupleDescriptor;
	Relation relation;
	int chunkGroupIndex;
	int64 chunkGroupsFiltered;
	MemoryContext stripeReadContext;
	StripeBuffers *stripeBuffers;   /* allocated in stripeReadContext */
	List *projectedColumnList;      /* borrowed reference */
	ChunkGroupReadState *chunkGroupReadState; /* owned */
} StripeReadState;

struct ColumnarReadState
{
	TupleDesc tupleDescriptor;
	Relation relation;

	StripeMetadata *currentStripeMetadata;
	StripeReadState *stripeReadState;

	/*
	 * Integer list of attribute numbers (1-indexed) for columns needed by the
	 * query.
	 */
	List *projectedColumnList;

	List *whereClauseList;
	List *whereClauseVars;

	MemoryContext stripeReadContext;
	int64 chunkGroupsFiltered;

	/*
	 * Memory context guaranteed to be not freed during scan so we can
	 * safely use for any memory allocations regarding ColumnarReadState
	 * itself.
	 */
	MemoryContext scanContext;

	Snapshot snapshot;
	bool snapshotRegisteredByUs;

	/* buffer access strategy for data reads, owned by the caller; may be NULL */
	BufferAccessStrategy strategy;
};

/* static function declarations */
static MemoryContext CreateStripeReadMemoryContext(void);
static bool ColumnarReadIsCurrentStripe(ColumnarReadState *readState,
										uint64 rowNumber);
static StripeMetadata * ColumnarReadGetCurrentStripe(ColumnarReadState *readState);
static void ReadStripeRowByRowNumber(ColumnarReadState *readState,
									 uint64 rowNumber, Datum *columnValues,
									 bool *columnNulls);
static bool StripeReadIsCurrentChunkGroup(StripeReadState *stripeReadState,
										  int chunkGroupIndex);
static void ReadChunkGroupRowByRowOffset(ChunkGroupReadState *chunkGroupReadState,
										 StripeMetadata *stripeMetadata,
										 uint64 stripeRowOffset, Datum *columnValues,
										 bool *columnNulls);
static bool StripeReadInProgress(ColumnarReadState *readState);
static bool HasUnreadStripe(ColumnarReadState *readState);
static StripeReadState * BeginStripeRead(StripeMetadata *stripeMetadata, Relation rel,
										 TupleDesc tupleDesc, List *projectedColumnList,
										 List *whereClauseList, List *whereClauseVars,
										 MemoryContext stripeReadContext,
										 Snapshot snapshot,
										 BufferAccessStrategy strategy);
static void AdvanceStripeRead(ColumnarReadState *readState);
static bool SnapshotMightSeeUnflushedStripes(Snapshot snapshot);
static bool ReadStripeNextRow(StripeReadState *stripeReadState, Datum *columnValues,
							  bool *columnNulls);
static ChunkGroupReadState * BeginChunkGroupRead(StripeBuffers *stripeBuffers, int
												 chunkIndex,
												 TupleDesc tupleDesc,
												 List *projectedColumnList,
												 MemoryContext cxt);
static void EndChunkGroupRead(ChunkGroupReadState *chunkGroupReadState);
static bool ReadChunkGroupNextRow(ChunkGroupReadState *chunkGroupReadState,
								  Datum *columnValues,
								  bool *columnNulls);
static StripeBuffers * LoadFilteredStripeBuffers(Relation relation,
												 StripeMetadata *stripeMetadata,
												 TupleDesc tupleDescriptor,
												 List *projectedColumnList,
												 List *whereClauseList,
												 List *whereClauseVars,
												 int64 *chunkGroupsFiltered,
												 Snapshot snapshot,
												 BufferAccessStrategy strategy);
static ColumnBuffers * LoadColumnBuffers(Relation relation,
										 ColumnChunkSkipNode *chunkSkipNodeArray,
										 uint32 chunkCount, uint64 stripeOffset,
										 Form_pg_attribute attributeForm,
										 BufferAccessStrategy strategy);
static bool * SelectedChunkMask(StripeSkipList *stripeSkipList,
								List *whereClauseList, List *whereClauseVars,
								int64 *chunkGroupsFiltered);
static Node * BuildBaseConstraint(Var *variable);
static List * GetClauseVars(List *clauses, int natts);
static OpExpr * MakeOpExpression(Var *variable, int16 strategyNumber);
static Oid GetOperatorByType(Oid typeId, Oid accessMethodId, int16 strategyNumber);
static void UpdateConstraint(Node *baseConstraint, Datum minValue, Datum maxValue);
static StripeSkipList * SelectedChunkSkipList(StripeSkipList *stripeSkipList,
											  bool *projectedColumnMask,
											  bool *selectedChunkMask);
static uint32 StripeSkipListRowCount(StripeSkipList *stripeSkipList);
static bool * ProjectedColumnMask(uint32 columnCount, List *projectedColumnList);
static void DeserializeBoolArray(StringInfo boolArrayBuffer, bool *boolArray,
								 uint32 boolArrayLength);
static void DeserializeDatumArray(StringInfo datumBuffer, bool *existsArray,
								  uint32 datumCount, bool datumTypeByValue,
								  int datumTypeLength, char datumTypeAlign,
								  Datum *datumArray);
static ChunkData * DeserializeChunkData(StripeBuffers *stripeBuffers, uint64 chunkIndex,
										uint32 rowCount, TupleDesc tupleDescriptor,
										List *projectedColumnList);
static Datum ColumnDefaultValue(TupleConstr *tupleConstraints,
								Form_pg_attribute attributeForm);

/*
 * ColumnarBeginRead initializes a columnar read operation. This function returns a
 * read handle that's used during reading rows and finishing the read operation.
 *
 * projectedColumnList is an integer list of attribute numbers (1-indexed).
 *
 * strategy is the buffer access strategy to read column data with; it is
 * owned by the caller and must outlive the read. NULL means default strategy.
 */
ColumnarReadState *
ColumnarBeginRead(Relation relation, TupleDesc tupleDescriptor,
				  List *projectedColumnList, List *whereClauseList,
				  MemoryContext scanContext, Snapshot snapshot,
				  bool randomAccess, BufferAccessStrategy strategy)
{
	/*
	 * We allocate all stripe specific data in the stripeReadContext, and reset
	 * this memory context before loading a new stripe. This is to avoid memory
	 * leaks.
	 */
	MemoryContext stripeReadContext = CreateStripeReadMemoryContext();

	ColumnarReadState *readState = palloc0(sizeof(ColumnarReadState));
	readState->relation = relation;
	readState->projectedColumnList = projectedColumnList;
	readState->whereClauseList = whereClauseList;
	readState->whereClauseVars = GetClauseVars(whereClauseList, tupleDescriptor->natts);
	readState->chunkGroupsFiltered = 0;
	readState->tupleDescriptor = tupleDescriptor;
	readState->stripeReadContext = stripeReadContext;
	readState->stripeReadState = NULL;
	readState->scanContext = scanContext;
	readState->strategy = strategy;

	/*
	 * Note that ColumnarReadFlushPendingWrites might update those two by
	 * registering a new snapshot.
	 */
	readState->snapshot = snapshot;
	readState->snapshotRegisteredByUs = false;

	if (!randomAccess)
	{
		/*
		 * When doing random access (i.e.: index scan), we don't need to flush
		 * pending writes until we need to read them.
		 * columnar_index_fetch_tuple would do so when needed.
		 */
		ColumnarReadFlushPendingWrites(readState);

		/*
		 * AdvanceStripeRead sets currentStripeMetadata for the first stripe
		 * to read if not doing random access. Otherwise, reader (i.e.:
		 * ColumnarReadRowByRowNumber) would already decide the stripe to read
		 * on-the-fly.
		 *
		 * Moreover, Since we don't flush pending writes for random access,
		 * AdvanceStripeRead might encounter with stripe metadata entries due
		 * to current transaction's pending writes even when using an MVCC
		 * snapshot, but AdvanceStripeRead would throw an error for that.
		 * Note that this is not the case with for plain table scan methods
		 * (i.e.: SeqScan and Columnar CustomScan).
		 *
		 * For those reasons, we don't call AdvanceStripeRead if we will do
		 * random access.
		 */
		AdvanceStripeRead(readState);
	}

	return readState;
}


/*
 * ColumnarReadFlushPendingWrites flushes pending writes for read operation
 * and sets a new (registered) snapshot if necessary.
 *
 * If it sets a new snapshot, then sets snapshotRegisteredByUs to true to
 * indicate that caller should unregister the snapshot after finishing read
 * operation.
 *
 * Note that this function assumes that readState's relation and snapshot
 * fields are already set.
 */
void
ColumnarReadFlushPendingWrites(ColumnarReadState *readState)
{
	Assert(!readState->snapshotRegisteredByUs);

	RelFileNumber relfilenumber = readState->relation->rd_locator.relNumber;
	FlushWriteStateForRelfilenumber(relfilenumber, GetCurrentSubTransactionId());

	if (readState->snapshot == InvalidSnapshot || !IsMVCCSnapshot(readState->snapshot))
	{
		return;
	}

	/*
	 * If we flushed any pending
```

### Core Architecture Module: `src/backend/columnar/columnar_storage.c`
```
/*-------------------------------------------------------------------------
 *
 * columnar_storage.c
 *
 * Copyright (c) Citus Data, Inc.
 *
 * Low-level storage layer for columnar.
 *   - Translates columnar read/write operations on logical offsets into operations on pages/blocks.
 *   - Emits WAL.
 *   - Reads/writes the columnar metapage.
 *   - Reserves data offsets, stripe numbers, and row offsets.
 *   - Truncation.
 *
 * Higher-level columnar operations deal with logical offsets and large
 * contiguous buffers of data that need to be stored. But the buffer manager
 * and WAL depend on formatted pages with headers, so these large buffers need
 * to be written across many pages. This module translates the contiguous
 * buffers into individual block reads/writes, and performs WAL when
 * necessary.
 *
 * Storage layout: a metapage in block 0, followed by an empty page in block
 * 1, followed by logical data starting at the first byte after the page
 * header in block 2 (having logical offset ColumnarFirstLogicalOffset). (XXX:
 * Block 1 is left empty for no particular reason. Reconsider?). A columnar
 * table should always have at least 2 blocks.
 *
 * Reservation is done with a relation extension lock, and designed for
 * concurrency, so the callers only need an ordinary lock on the
 * relation. Initializing the metapage or truncating the relation require that
 * the caller holds an AccessExclusiveLock. (XXX: New reservations of data are
 * aligned onto a new page for no particular reason. Reconsider?).
 *
 *-------------------------------------------------------------------------
 */


#include "postgres.h"

#include "miscadmin.h"
#include "safe_lib.h"

#include "access/generic_xlog.h"
#include "catalog/storage.h"
#include "storage/bufmgr.h"
#include "storage/lmgr.h"

#include "pg_version_compat.h"

#include "columnar/columnar.h"
#include "columnar/columnar_storage.h"


/*
 * Content of the first page in main fork, which stores metadata at file
 * level.
 */
typedef struct ColumnarMetapage
{
	/*
	 * Store version of file format used, so we can detect files from
	 * previous versions if we change file format.
	 */
	uint32 versionMajor;
	uint32 versionMinor;

	/*
	 * Each of the metadata table rows are identified by a storageId.
	 * We store it also in the main fork so we can link metadata rows
	 * with data files.
	 */
	uint64 storageId;

	uint64 reservedStripeId; /* first unused stripe id */
	uint64 reservedRowNumber; /* first unused row number */
	uint64 reservedOffset; /* first unused byte offset */

	/*
	 * Flag set to true in the init fork. After an unlogged table reset (due
	 * to a crash), the init fork will be copied over the main fork. When
	 * trying to read an unlogged table, if this flag is set to true, we must
	 * clear the metadata for the table (because the actual data is gone,
	 * too), and clear the flag. We can cross-check that the table is
	 * UNLOGGED, and that the main fork is at the minimum size (no actual
	 * data).
	 *
	 * XXX: Not used yet; reserved field for later support for UNLOGGED.
	 */
	bool unloggedReset;
} ColumnarMetapage;


/* represents a "physical" block+offset address */
typedef struct PhysicalAddr
{
	BlockNumber blockno;
	uint32 offset;
} PhysicalAddr;


#define COLUMNAR_METAPAGE_BLOCKNO 0
#define COLUMNAR_EMPTY_BLOCKNO 1
#define COLUMNAR_INVALID_STRIPE_ID 0
#define COLUMNAR_FIRST_STRIPE_ID 1


#define OLD_METAPAGE_VERSION_HINT "Use \"VACUUM\" to upgrade the columnar table format " \
								  "version or run \"ALTER EXTENSION citus UPDATE\"."


/* only for testing purposes */
PG_FUNCTION_INFO_V1(test_columnar_storage_write_new_page);


/*
 * Map logical offsets to a physical page and offset where the data is kept.
 */
static inline PhysicalAddr
LogicalToPhysical(uint64 logicalOffset)
{
	PhysicalAddr addr;

	addr.blockno = logicalOffset / COLUMNAR_BYTES_PER_PAGE;
	addr.offset = SizeOfPageHeaderData + (logicalOffset % COLUMNAR_BYTES_PER_PAGE);

	return addr;
}


/*
 * Map a physical page and offset address to a logical address.
 */
static inline uint64
PhysicalToLogical(PhysicalAddr addr)
{
	return COLUMNAR_BYTES_PER_PAGE * addr.blockno + addr.offset - SizeOfPageHeaderData;
}


static void ColumnarOverwriteMetapage(Relation relation,
									  ColumnarMetapage columnarMetapage);
static ColumnarMetapage ColumnarMetapageRead(Relation rel, bool force);
static void ReadFromBlock(Relation rel, BlockNumber blockno, uint32 offset,
						  char *buf, uint32 len, bool force,
						  BufferAccessStrategy strategy);
static void WriteToBlock(Relation rel, BlockNumber blockno, uint32 offset,
						 char *buf, uint32 len, bool clear);
static uint64 AlignReservation(uint64 prevReservation);
static bool ColumnarMetapageIsCurrent(ColumnarMetapage *metapage);
static bool ColumnarMetapageIsOlder(ColumnarMetapage *metapage);
static bool ColumnarMetapageIsNewer(ColumnarMetapage *metapage);
static void ColumnarMetapageCheckVersion(Relation rel, ColumnarMetapage *metapage);


/*
 * ColumnarStorageInit - initialize a new metapage in an empty relation
 * with the given storageId.
 *
 * Caller must hold AccessExclusiveLock on the relation.
 */
void
ColumnarStorageInit(SMgrRelation srel, uint64 storageId)
{
	BlockNumber nblocks = smgrnblocks(srel, MAIN_FORKNUM);

	if (nblocks > 0)
	{
		elog(ERROR,
			 "attempted to initialize metapage, but %d pages already exist",
			 nblocks);
	}

	/* create two pages */
	PGIOAlignedBlock block;
	Page page = block.data;

	/* write metapage */
	PageInit(page, BLCKSZ, 0);
	PageHeader phdr = (PageHeader) page;

	ColumnarMetapage metapage = { 0 };
	metapage.storageId = storageId;
	metapage.versionMajor = COLUMNAR_VERSION_MAJOR;
	metapage.versionMinor = COLUMNAR_VERSION_MINOR;
	metapage.reservedStripeId = COLUMNAR_FIRST_STRIPE_ID;
	metapage.reservedRowNumber = COLUMNAR_FIRST_ROW_NUMBER;
	metapage.reservedOffset = ColumnarFirstLogicalOffset;
	metapage.unloggedReset = false;
	memcpy_s(page + phdr->pd_lower, phdr->pd_upper - phdr->pd_lower,
			 (char *) &metapage, sizeof(ColumnarMetapage));
	phdr->pd_lower += sizeof(ColumnarMetapage);

	log_newpage(&srel->smgr_rlocator.locator, MAIN_FORKNUM,
				COLUMNAR_METAPAGE_BLOCKNO, page, true);
	PageSetChecksumInplace(page, COLUMNAR_METAPAGE_BLOCKNO);
	smgrextend(srel, MAIN_FORKNUM, COLUMNAR_METAPAGE_BLOCKNO, page, true);

	/* write empty page */
	PageInit(page, BLCKSZ, 0);

	log_newpage(&srel->smgr_rlocator.locator, MAIN_FORKNUM,
				COLUMNAR_EMPTY_BLOCKNO, page, true);
	PageSetChecksumInplace(page, COLUMNAR_EMPTY_BLOCKNO);
	smgrextend(srel, MAIN_FORKNUM, COLUMNAR_EMPTY_BLOCKNO, page, true);

	/*
	 * An immediate sync is required even if we xlog'd the page, because the
	 * write did not go through shared_buffers and therefore a concurrent
	 * checkpoint may have moved the redo pointer past our xlog record.
	 */
	smgrimmedsync(srel, MAIN_FORKNUM);
}


/*
 * ColumnarStorageUpdateCurrent - update the metapage to the current
 * version. No effect if the version already matches. If 'upgrade' is true,
 * throw an error if metapage version is newer; if 'upgrade' is false, it's a
 * downgrade, so throw an error if the metapage version is older.
 *
 * NB: caller must ensure that metapage already exists, which might not be the
 * case on 10.0.
 */
void
ColumnarStorageUpdateCurrent(Relation rel, bool upgrade, uint64 reservedStripeId,
							 uint64 reservedRowNumber, uint64 reservedOffset)
{
	LockRelationForExtension(rel, ExclusiveLock);

	ColumnarMetapage metapage = ColumnarMetapageRead(rel, true);

	if (ColumnarMetapageIsCurrent(&metapage))
	{
		/* nothing to do */
		return;
	}

	if (upgrade && ColumnarMetapageIsNewer(&metapage))
	{
		elog(ERROR, "found newer columnar metapage while upgrading");
	}

	if (!upgrade && ColumnarMetapageIsOlder(&metapage))
	{
		elog(ERROR, "found older columnar metapage while downgrading");
	}

	metapage.versionMajor = COLUMNAR_VERSION_MAJOR;
	metapage.versionMinor = COLUMNAR_VERSION_MINOR;

	/* storageId remains the same */
	metapage.reservedStripeId = reservedStripeId;
	metapage.reservedRowNumber = reservedRowNumber;
	metapage.reservedOffset = reservedOffset;

	ColumnarOverwriteMetapage(rel, metapage);

	UnlockRelationForExtension(rel, ExclusiveLock);
}


/*
 * ColumnarStorageGetVersionMajor - return major version from the metapage.
 *
 * Throw an error if the metapage is not the current version, unless
 * 'force' is true.
 */
uint64
ColumnarStorageGetVersionMajor(Relation rel, bool force)
{
	ColumnarMetapage metapage = ColumnarMetapageRead(rel, force);

	return metapage.versionMajor;
}


/*
 * ColumnarStorageGetVersionMinor - return minor version from the metapage.
 *
 * Throw an error if the metapage is not the current version, unless
 * 'force' is true.
 */
uint64
ColumnarStorageGetVersionMinor(Relation rel, bool force)
{
	ColumnarMetapage metapage = ColumnarMetapageRead(rel, force);

	return metapage.versionMinor;
}


/*
 * ColumnarStorageGetStorageId - return storage ID from the metapage.
 *
 * Throw an error if the metapage is not the current version, unless
 * 'force' is true.
 */
uint64
ColumnarStorageGetStorageId(Relation rel, bool force)
{
	ColumnarMetapage metapage = ColumnarMetapageRead(rel, force);

	return metapage.storageId;
}


/*
 * ColumnarStorageGetReservedStripeId - return reserved stripe ID from the
 * metapage.
 *
 * Throw an error if the metapage is not the current version, unless
 * 'force' is true.
 */
uint64
ColumnarStorageGetReservedStripeId(Relation rel, bool force)
{
	ColumnarMetapage metapage = ColumnarMetapageRead(rel, force);

	return metapage.reservedStripeId;
}


/*
 * ColumnarStorageGetReservedRowNumber - return reserved row number from the
 * metapage.
 *
 * Throw an error if the metapage is not the current version, unless
 * 'force' is true.
 */
uint64
ColumnarStorageGetReservedRowNumber(Relation rel, bool force)
{
	ColumnarMetapage metapage = ColumnarMetapageRead(rel, force);

	return metapage.reservedRowNumber;
}


/*
 * ColumnarStorageGetReservedOffset - return re
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8897** (2026-10-14): **getProcNo_compat() returns -1 for auxiliary procs on PG17+, causing out-of-bounds BackendData access**
  *Symptoms*: ## Summary  On PG17+, `getProcNo_compat()` is defined as `a->vxid.procNumber` (`src/include/pg_version_compat.h:696`). That is **not** the PGPROC slot index for every proc:  - **Auxiliary processes** (checkpointer, bgwriter, walwriter, startup, ... and on PG18 the **io workers**) have `vxid.procNumber = INVALID_PROC_NUMBER` (-1). See `InitAuxiliaryProcess()` in PG17/PG18 `proc.c`. - **Prepared-transaction dummy procs** carry the *preparing backend's* number, or -1 after recovery (`MarkAsPreparingGuts()` in `twophase.c`).  On PG16, the equivalent `proc->pgprocno` was always the slot index, so this changed meaning when the compat macro was introduced.  ## Impact  `BuildLocalWaitGraph()` (`lock_graph.c:563`) iterates over every PGPROC with `pid != 0` and calls `GetBackendDataForProc()`, which indexes `backendManagementShmemData->backends[getProcNo_compat(proc)]`. For an aux proc that is `backends[-1]`. So on every distributed deadlock detection cycle, Citus:  - acquires/releases a "spinlock" on a byte that lies **before** the `backends[]` array (in the `BackendManagementShmemData` header / preceding shmem), and - copies garbage into a `BackendData`.  Today this is silent only because, with `sizeof(BackendData) == 56`, the stray byte happens to be zero, so it becomes a transient out-of-bounds write. Any change to `BackendData`'s size moves it. With an 88-byte struct (while working on #8888) it lands on a non-zero byte and the maintenance daemon PANICs:  ``` PANIC:  stuck spinlock

- **Issue #8857** (2026-09-25): **rebalancer poisons fkey cache: parallel reference-table rebalance can schedule the same dependency twice**
  *Symptoms*: ## Problem  Parallel reference-table rebalancing can fail when reference tables are processed in a different order. The scheduler tries to insert the same prerequisite twice, and PostgreSQL rejects it:  ```text ERROR: duplicate key value violates unique constraint "pg_dist_background_task_depend_pkey" DETAIL: Key (job_id, task_id, depends_on)=(17777, 1005, 1004) already exists. ```  This is a real scheduling failure, not a test-output mismatch. It was discovered while investigating #8847, but has **not** been established as the cause of that CI failure.  ## How to reproduce  Reproduced locally on PostgreSQL 17.7 with assertions enabled, using Citus commit `6dfa3e01622358bbf1b2ec0d23951d6a5a9bedb2`. Both `force_logical` and `block_writes` scenarios fail.  Use a **disposable regression-test cluster only**: the reproduction deliberately rearranges an internal catalog.  1. In a configured Citus development environment, build and install Citus. 2. Open `src/test/regress/sql/background_rebalance_parallel_reference_tables.sql`. This test already creates the foreign-key chain `order_items -> orders -> customers` and adds two destination workers. 3. Insert the following immediately before **each** `citus_rebalance_start(...)` call:     ```sql    CREATE INDEX reverse_reference_scan    ON pg_dist_partition (logicalrelid DESC);    CLUSTER pg_dist_partition USING reverse_reference_scan;    DROP INDEX reverse_reference_scan;    ```     This changes the catalog's physical scan order without

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

### Incident Patch 1: `2aebefc7` (2026-10-01)
**Commit Message**: Fix transaction recovery after node removal (#8885)

DESCRIPTION: Fixes removed workers rolling back the coordinator's prepared transactions
DESCRIPTION: Fixes a race between node removal and 2PC recovery

Removing a worker reset its local group ID to 0 but left its copy of
pg_dist_node in place. A removed worker that kept running could still
reach the remaining workers, and its transaction recovery treated the
coordinator's citus_0_ prepared transactions there as its own. It had
no pg_dist_transaction records for them, so it rolled back transactions
the coordinator had committed.

Node removal and transaction recovery on the coordinator could also
delete the same pg_dist_transaction rows at the same time and fail with
"tuple concurrently deleted".

- Node removal also deletes pg_dist_node on the removed node, in the
  same remote transaction as the group ID reset. It skips this when the
  entry points at the coordinator itself, which still needs its worker
  list.
- Recovery reads the local group ID and the worker list from one
  snapshot before connecting to the workers, so a concurrent removal
  can't pair group ID 0 with the old worker list.
- Node removal takes the transaction

**File**: `src/backend/distributed/metadata/metadata_cache.c` (modified, +29/-9)
```diff
@@ -4515,10 +4515,6 @@ RegisterCitusTableCacheEntryReleaseCallbacks(void)
 int32
 GetLocalGroupId(void)
 {
-	ScanKeyData scanKey[1];
-	int scanKeyCount = 0;
-	int32 groupId = 0;
-
 	InitializeCaches();
 
 	/*
@@ -4535,11 +4531,38 @@ GetLocalGroupId(void)
 		return 0;
 	}
 
-	Relation pgDistLocalGroupId = table_open(localGroupTableOid, AccessShareLock);
+	int32 groupId = ReadLocalGroupId(NULL);
+
+	/* the table is only empty temporarily, during upgrades, so don't cache that */
+	if (groupId != GROUP_ID_UPGRADING)
+	{
+		LocalGroupId = groupId;
+	}
+
+	return groupId;
+}
+
+
+/*
+ * ReadLocalGroupId reads the group identifier of the local node from
+ * pg_dist_local_group, using the given snapshot or a fresh one if snapshot is
+ * NULL. Unlike GetLocalGroupId, it neither uses nor updates the cache. It
+ * returns GROUP_ID_UPGRADING if the table is empty, which happens while
+ * upgrading PostgreSQL.
+ */
+int32
+ReadLocalGroupId(Snapshot snapshot)
+{
+	ScanKeyData scanKey[1];
+	int scanKeyCount = 0;
+	int32 groupId = 0;
+
+	Relation pgDistLocalGroupId = table_open(DistLocalGroupIdRelationId(),
+											 AccessShareLock);
 
 	SysScanDesc scanDescriptor = systable_beginscan(pgDistLocalGroupId,
 													InvalidOid, false,
-													NULL, scanKeyCount, scanKey);
+													snapshot, scanKeyCount, scanKey);
 
 	TupleDesc tupleDescriptor = RelationGetDescr(pgDistLocalGroupId);
 
@@ -4553,9 +4576,6 @@ GetLocalGroupId(void)
 										  tupleDescriptor, &isNull);
 
 		groupId = DatumGetInt32(groupIdDatum);
-
-		/* set the local cache variable */
-		LocalGroupId = groupId;
 	}
 	else
 	{
```

**File**: `src/backend/distributed/metadata/node_metadata.c` (modified, +39/-3)
```diff
@@ -2348,6 +2348,17 @@ FindCoordinatorNodeId(void)
  */
 List *
 ReadDistNode(bool includeNodesFromOtherClusters)
+{
+	return ReadDistNodeWithSnapshot(includeNodesFromOtherClusters, NULL);
+}
+
+
+/*
+ * ReadDistNodeWithSnapshot is like ReadDistNode, but reads pg_dist_node using
+ * the given snapshot, or a fresh one if snapshot is NULL.
+ */
+List *
+ReadDistNodeWithSnapshot(bool includeNodesFromOtherClusters, Snapshot snapshot)
 {
 	ScanKeyData scanKey[1];
 	int scanKeyCount = 0;
@@ -2357,7 +2368,7 @@ ReadDistNode(bool includeNodesFromOtherClusters)
 
 	SysScanDesc scanDescriptor = systable_beginscan(pgDistNode,
 													InvalidOid, false,
-													NULL, scanKeyCount, scanKey);
+													snapshot, scanKeyCount, scanKey);
 
 	TupleDesc tupleDescriptor = RelationGetDescr(pgDistNode);
 
@@ -2422,14 +2433,39 @@ RemoveNodeFromCluster(char *nodeName, int32 nodePort)
 
 		/* reset local group id for the node to be removed */
 		char *updateLocalGroupIdCommand = LocalGroupIdUpdateCommand(0);
-		SendOptionalMetadataCommandListToWorkerInCoordinatedTransaction(
-			nodeName, nodePort, CurrentUserName(), list_make1(updateLocalGroupIdCommand));
+		bool groupIdReset =
+			SendOptionalMetadataCommandListToWorkerInCoordinatedTransaction(
+				nodeName, nodePort, CurrentUserName(),
+				list_make1(updateLocalGroupIdCommand));
+
+		/*
+		 * A removed node keeps running as a standalone node with group ID 0.
+		 * Also delete its copy of pg_dist_node, in the same remote transaction.
+		 * Otherwise it can still reach the remaining nodes, and its transaction
+		 * recovery would treat the coordinator's citus_0_ prepared transactions
+		 * as its own.
+		 *
+		 * Skip this if the entry points at this node, for example the
+		 * coordinator's own entry. The coordinator still needs its node list.
+		 */
+		if (groupIdReset && !IsWorkerTheCurrentNode(workerNode))
+		{
+			SendOptionalMetadataCommandListToWorkerInCoordinatedTransaction(
+				nodeName, nodePort, CurrentUserName(), NodeMetadataDropCommands());
+		}
 
 		/*
 		 * Secondary nodes are read-only, never 2PC is used.
 		 * Hence, no items can be inserted to pg_dist_transaction
 		 * for secondary nodes.
+		 *
+		 * Transaction recovery also deletes rows from pg_dist_transaction, so
+		 * take its lock to avoid both deleting the same row, which fails with
+		 * "tuple concurrently deleted". Take it after the pg_dist_node lock,
+		 * which other node operations hold while they may remove nodes in the
+		 * same transaction. Recovery never waits on that lock.
 		 */
+		LockTransactionRecovery(ShareUpdateExclusiveLock);
 		DeleteWorkerTransactions(workerNode);
 	}
 
```

**File**: `src/backend/distributed/transaction/transaction_recovery.c` (modified, +51/-11)
```diff
@@ -34,6 +34,7 @@
 #include "utils/fmgroids.h"
 #include "utils/memutils.h"
 #include "utils/rel.h"
+#include "utils/snapmgr.h"
 #include "utils/syscache.h"
 #include "utils/xid8.h"
 
@@ -57,8 +58,10 @@ PG_FUNCTION_INFO_V1(recover_prepared_transactions);
 
 /* Local functions forward declarations */
 static int RecoverWorkerTransactions(WorkerNode *workerNode,
-									 MultiConnection *connection);
-static List * PendingWorkerTransactionList(MultiConnection *connection);
+									 MultiConnection *connection,
+									 int32 localGroupId);
+static List * PendingWorkerTransactionList(MultiConnection *connection,
+										   int32 localGroupId);
 static bool IsTransactionInProgress(HTAB *activeTransactionNumberSet,
 									char *preparedTransactionName);
 static bool RecoverPreparedTransactionOnWorker(MultiConnection *connection,
@@ -132,11 +135,34 @@ RecoverTwoPhaseCommits(void)
 	/* take advisory lock first to avoid running concurrently */
 	LockTransactionRecovery(ShareUpdateExclusiveLock);
 
-	List *workerList = ActivePrimaryNodeList(NoLock);
+	/*
+	 * Recovery treats the prepared transactions named after the local group ID
+	 * as its own, so the group ID and the worker list must come from the same
+	 * point in time. For example, removing this node from its cluster resets
+	 * its group ID to 0 and clears its worker list. Group ID 0 with the old
+	 * worker list would match the coordinator's prepared transactions. Read
+	 * both from one snapshot, and use them for the whole run.
+	 */
+	EnsureModificationsCanRun();
+	Snapshot snapshot = RegisterSnapshot(GetLatestSnapshot());
+	int32 localGroupId = ReadLocalGroupId(snapshot);
+	bool includeNodesFromOtherClusters = false;
+	List *nodeList = ReadDistNodeWithSnapshot(includeNodesFromOtherClusters, snapshot);
+	UnregisterSnapshot(snapshot);
+
+	List *workerList = NIL;
 	List *workerConnections = NIL;
 	WorkerNode *workerNode = NULL;
 	MultiConnection *connection = NULL;
 
+	foreach_declared_ptr(workerNode, nodeList)
+	{
+		if (workerNode->isActive && NodeIsPrimary(workerNode))
+		{
+			workerList = lappend(workerList, workerNode);
+		}
+	}
+
 	/*
 	 * Pre-establish all connections to worker nodes.
 	 *
@@ -175,9 +201,11 @@ RecoverTwoPhaseCommits(void)
 		 */
 		workerConnections = lappend(workerConnections, connection);
 	}
+
 	forboth_ptr(workerNode, workerList, connection, workerConnections)
 	{
-		recoveredTransactionCount += RecoverWorkerTransactions(workerNode, connection);
+		recoveredTransactionCount += RecoverWorkerTransactions(workerNode, connection,
+															   localGroupId);
 	}
 
 	return recoveredTransactionCount;
@@ -187,9 +215,17 @@ RecoverTwoPhaseCommits(void)
 /*
  * RecoverWorkerTransactions recovers any pending prepared transactions
  * started by this node on the specified worker.
+ *
+ * localGroupId identifies the prepared transactions that this node started.
+ * The caller must read it from the same snapshot that it used to read the
+ * worker list, rather than letting this function call GetLocalGroupId().
+ * Otherwise a concurrent node removal could pair the new group ID 0 with the
+ * old worker list, and we would roll back the coordinator's prepared
+ * transactions.
  */
 static int
-RecoverWorkerTransactions(WorkerNode *workerNode, MultiConnection *connection)
+RecoverWorkerTransactions(WorkerNode *workerNode, MultiConnection *connection,
+						  int32 localGroupId)
 {
 	int recoveredTransactionCount = 0;
 
@@ -261,7 +297,8 @@ RecoverWorkerTransactions(WorkerNode *workerNode, MultiConnection *connection)
 	 */
 
 	/* find stale prepared transactions on the remote node */
-	List *pendingTransactionList = PendingWorkerTransactionList(connection);
+	List *pendingTransactionList = PendingWorkerTransactionList(connection,
+																localGroupId);
 	HTAB *pendingTransactionSet = ListToHashSet(pendingTransactionList, NAMEDATALEN,
 												true);
 
@@ -281,7 +318,8 @@ RecoverWorkerTransactions(WorkerNode *workerNode, MultiConnection *connection)
 													NULL, scanKeyCount, scanKey);
 
 	/* find stale prepared transactions on the remote node */
-	List *recheckTransactionList = PendingWorkerTransactionList(connection);
+	List *recheckTransactionList = PendingWorkerTransactionList(connection,
+																localGroupId);
 	HTAB *recheckTransactionSet = ListToHashSet(recheckTransactionList, NAMEDATALEN,
 												true);
 
@@ -510,20 +548,22 @@ RecoverWorkerTransactions(WorkerNode *workerNode, MultiConnection *connection)
 
 /*
  * PendingWorkerTransactionList returns a list of pending prepared
- * transactions on a remote node that were started by this node.
+ * transactions on a remote node that were started by the node with the given
+ * group ID, i.e. those named citus_<localGroupId>_*. Callers pass the group ID
+ * that they read together with the worker list, rather than the current
+ * GetLocalGroupId(), so that it cannot change during a recovery run.
  */
 static List *
-PendingWorkerTransactionL
```

**File**: `src/backend/distributed/utils/maintenanced.c` (modified, +15/-1)
```diff
@@ -609,7 +609,21 @@ CitusMaintenanceDaemonMain(Datum main_arg)
 				 */
 				lastRecoveryTime = GetCurrentTimestamp();
 
-				recoveredTransactionCount = RecoverTwoPhaseCommits();
+				/*
+				 * Another session holding the recovery lock is either running
+				 * recovery or, like citus_remove_node(), deleting recovery
+				 * records until it commits. Retry at the next interval instead
+				 * of blocking deadlock detection and the other daemon tasks.
+				 */
+				if (ConditionalLockTransactionRecovery(ShareUpdateExclusiveLock))
+				{
+					recoveredTransactionCount = RecoverTwoPhaseCommits();
+				}
+				else
+				{
+					ereport(DEBUG1, (errmsg("could not lock transaction recovery, "
+											"skipping 2PC recovery")));
+				}
 			}
 
 			CommitTransactionCommand();
```

**File**: `src/backend/distributed/utils/resource_lock.c` (modified, +17/-0)
```diff
@@ -687,6 +687,23 @@ LockTransactionRecovery(LOCKMODE lockmode)
 }
 
 
+/*
+ * ConditionalLockTransactionRecovery tries to acquire the transaction recovery
+ * lock without waiting, and returns whether it succeeded.
+ */
+bool
+ConditionalLockTransactionRecovery(LOCKMODE lockmode)
+{
+	LOCKTAG tag;
+	const bool sessionLock = false;
+	const bool dontWait = true;
+
+	SET_LOCKTAG_CITUS_OPERATION(tag, CITUS_TRANSACTION_RECOVERY);
+
+	return LockAcquire(&tag, lockmode, sessionLock, dontWait) != LOCKACQUIRE_NOT_AVAIL;
+}
+
+
 /*
  * LockShardListMetadata takes shared locks on the metadata of all shards in
  * shardIntervalList to prevents concurrent placement changes.
```

**File**: `src/include/distributed/metadata_cache.h` (modified, +1/-0)
```diff
@@ -182,6 +182,7 @@ extern CitusTableCacheEntry * LookupCitusTableCacheEntry(Oid relationId);
 extern DistObjectCacheEntry * LookupDistObjectCacheEntry(Oid classid, Oid objid, int32
 														 objsubid);
 extern int32 GetLocalGroupId(void);
+extern int32 ReadLocalGroupId(Snapshot snapshot);
 extern int32 GetLocalNodeId(void);
 extern void CitusTableCacheFlushInvalidatedEntries(void);
 extern Oid LookupShardRelationFromCatalog(int64 shardId, bool missing_ok);
```

**File**: `src/include/distributed/resource_lock.h` (modified, +1/-0)
```diff
@@ -258,6 +258,7 @@ extern void LockShardsInPlacementListMetadata(List *shardPlacementList,
 extern LOCKMODE IntToLockMode(int mode);
 
 extern void LockTransactionRecovery(LOCKMODE lockMode);
+extern bool ConditionalLockTransactionRecovery(LOCKMODE lockMode);
 
 extern void SerializeNonCommutativeWrites(List *shardIntervalList, LOCKMODE lockMode);
 extern void LockRelationShardResources(List *relationShardList, LOCKMODE lockMode);
```

**File**: `src/include/distributed/worker_manager.h` (modified, +3/-0)
```diff
@@ -19,6 +19,7 @@
 #include "nodes/pg_list.h"
 #include "storage/lmgr.h"
 #include "storage/lockdefs.h"
+#include "utils/snapshot.h"
 
 
 /* Worker nodeName's, nodePort's, and nodeCluster's maximum length */
@@ -90,6 +91,8 @@ extern WorkerNode * FindNodeWithNodeId(int nodeId, bool missingOk);
 extern WorkerNode * FindNodeAnyClusterByNodeId(uint32 nodeId);
 extern WorkerNode * ModifiableWorkerNode(const char *nodeName, int32 nodePort);
 extern List * ReadDistNode(bool includeNodesFromOtherClusters);
+extern List * ReadDistNodeWithSnapshot(bool includeNodesFromOtherClusters,
+									   Snapshot snapshot);
 extern void EnsureCoordinator(void);
 extern void EnsurePropagationToCoordinator(void);
 extern void EnsureCoordinatorUnlessTenantSchema(Oid relationId);
```

---

### Incident Patch 2: `e506c8c2` (2026-09-28)
**Commit Message**: docs: fix typo expection -> exception (#8814)

Corrects a single misspelling of `expection` in `src/backend/distributed/README.md`.  Documentation only, no behaviour change.

**File**: `src/backend/distributed/README.md` (modified, +1/-1)
```diff
@@ -2300,7 +2300,7 @@ As a rule, in most cases, Citus relies on PostgreSQL to acquire the table-level
 + When a DDL is executed on a Citus table, Citus first executes Postgres’ `standardProcess_Utility()` function. One of the key reasons behind that is Postgres acquires the table-level lock, and Citus provides similar concurrency behavior with Postgres on Citus tables. If an `ALTER TABLE .. ADD COLUMN` is running on a distributed table, no `SELECT` command could run concurrently due to the table-level locks.
 
 + When regular commands like `INSERT`/`UPDATE`/`DELETE`/`SELECT` is executed, Citus again relies on Postgres to acquire the table-level locks. PostgreSQL acquires the table-level locks during the parsing of the statements, which makes life simple for Citus, as parsing happens even before any Citus logic kicks in. If the command doesn’t require parsing, such as prepared statements, then Postgres still acquires the same locks before using the cached plan. So, from Citus’ perspective, there mostly is nothing to do for acquiring the table-level locks.
- + + There is only a one expection to this rule, Citus' _local plan caching_. When Citus caches the queries by itself, Citus acquires the relevant table-level locks. See `ExecuteLocalTaskListExtended()` as the relevant C function.
+ + + There is only one exception to this rule, Citus' _local plan caching_. When Citus caches the queries by itself, Citus acquires the relevant table-level locks. See `ExecuteLocalTaskListExtended()` as the relevant C function.
 
 
 Citus additionally use table-level locks for certain table management operations on tables. With all these operations, Citus aims to fit into the same concurrency behaviors as Postgres. For example, when `create_distributed_table()` is executed, Citus acquires an `ExclusiveLock` on the table. We do that because we want to block `write`s on the tables – which acquire RowExclusiveLock  -- but let `read-only` queries to continue – which acquire AccessShareLock. An additional benefit of this approach is that no two concurrent `create_distributed_table` on the same table can run.
```

---

### Incident Patch 3: `807059a6` (2026-09-28)
**Commit Message**: Automated security dependency sync from Dependabot alerts (#8882)

Automated weekly security sync based on open Dependabot alerts.

This PR is managed by dependency-security-sync workflow.

Supersedes the individual Dependabot PRs for: cryptography tornado h2.
Those PRs are intentionally left open and should be closed when this PR
merges.

---------

Co-authored-by: ibrahim halatci <[REDACTED_EMAIL]>
Co-authored-by: packagingApp[bot] <packagingApp[bot]@users.noreply.github.com>

**File**: `.devcontainer/src/test/regress/Pipfile` (modified, +4/-4)
```diff
@@ -5,20 +5,20 @@ verify_ssl = true
 
 [packages]
 pyasn1 = ">=0.6.4"
-mitmproxy = {git = "https://github.com/citusdata/mitmproxy.git", ref = "321e6d203cf31e36d59ba8e4f9c6a3c4a5d6ddf0"}
+mitmproxy = {git = "https://github.com/citusdata/mitmproxy.git", ref = "a16444362cc0393ccf7329f50fc909b711729de7"}
 "aioquic" = ">=1.2.0,<1.3.0"
 "mitmproxy-rs" = ">=0.12.6,<0.13.0"
 argon2-cffi = ">=23.1.0"
 bcrypt = ">=4.1.2"
 brotli = "<=1.2.0"
 h11 = "==0.16.0"
-h2 = "==4.3.0"
-tornado = ">=6.5.7,<6.6.0"
+h2 = "==4.4.1"
+tornado = ">=6.5.8,<6.6.0"
 msgpack = ">=1.2.1"
 zstandard = ">=0.25.0"
 construct = "*"
 docopt = "==0.6.2"
-cryptography = "==48.0.1"
+cryptography = "==50.0.0"
 pytest = "==9.0.3"
 psycopg = "*"
 filelock = "*"
```

**File**: `.devcontainer/src/test/regress/Pipfile.lock` (modified, +314/-249)
```diff
@@ -1,7 +1,7 @@
 {
     "_meta": {
         "hash": {
-            "sha256": "63eaa480757d61b4951dcbef6687f5a385031e8e336544ac9630b6d7b7c631c6"
+            "sha256": "2ba804b49514faf026f3ebdb7ac55402c538f9808a86af4e2945f557e951c09d"
         },
         "pipfile-spec": 6,
         "requires": {
@@ -60,35 +60,50 @@
         },
         "argon2-cffi-bindings": {
             "hashes": [
-                "sha256:1db89609c06afa1a214a69a462ea741cf735b29a57530478c06eb81dd403de99",
-                "sha256:1e021e87faa76ae0d413b619fe2b65ab9a037f24c60a1e6cc43457ae20de6dc6",
-                "sha256:21378b40e1b8d1655dd5310c84a40fc19a9aa5e6366e835ceb8576bf0fea716d",
-                "sha256:2630b6240b495dfab90aebe159ff784d08ea999aa4b0d17efa734055a07d2f44",
-                "sha256:3c6702abc36bf3ccba3f802b799505def420a1b7039862014a65db3205967f5a",
-                "sha256:3d3f05610594151994ca9ccb3c771115bdb4daef161976a266f0dd8aa9996b8f",
-                "sha256:473bcb5f82924b1becbb637b63303ec8d10e84c8d241119419897a26116515d2",
-                "sha256:5acb4e41090d53f17ca1110c3427f0a130f944b896fc8c83973219c97f57b690",
-                "sha256:5d588dec224e2a83edbdc785a5e6f3c6cd736f46bfd4b441bbb5aa1f5085e584",
-                "sha256:6dca33a9859abf613e22733131fc9194091c1fa7cb3e131c143056b4856aa47e",
-                "sha256:7aef0c91e2c0fbca6fc68e7555aa60ef7008a739cbe045541e438373bc54d2b0",
-                "sha256:84a461d4d84ae1295871329b346a97f68eade8c53b6ed9a7ca2d7467f3c8ff6f",
-                "sha256:87c33a52407e4c41f3b70a9c2d3f6056d88b10dad7695be708c5021673f55623",
-                "sha256:8b8efee945193e667a396cbc7b4fb7d357297d6234d30a489905d96caabde56b",
-                "sha256:a1c70058c6ab1e352304ac7e3b52554daadacd8d453c1752e547c76e9c99ac44",
-                "sha256:a98cd7d17e9f7ce244c0803cad3c23a7d379c301ba618a5fa76a67d116618b98",
-                "sha256:aecba1723ae35330a008418a91ea6cfcedf6d31e5fbaa056a166462ff066d500",
-                "sha256:b0fdbcf513833809c882823f98dc2f931cf659d9a1429616ac3adebb49f5db94",
-                "sha256:b55aec3565b65f56455eebc9b9f34130440404f27fe21c3b375bf1ea4d8fbae6",
-                "sha256:b957f3e6ea4d55d820e40ff76f450952807013d361a65d7f28acc0acbf29229d",
-                "sha256:ba92837e4a9aa6a508c8d2d7883ed5a8f6c308c89a4790e1e447a220deb79a85",
-                "sha256:c4f9665de60b1b0e99bcd6be4f17d90339698ce954cfd8d9cf4f91c995165a92",
-                "sha256:c87b72589133f0346a1cb8d5ecca4b933e3c9b64656c9d175270a000e73b288d",
-                "sha256:d3e924cfc503018a714f94a49a149fdc0b644eaead5d1f089330399134fa028a",
-                "sha256:da0c79c23a63723aa5d782250fbf51b768abca630285262fb5144ba5ae01e520",
-                "sha256:e2fd3bfbff3c5d74fef31a722f729bf93500910db650c925c2d6ef879a7e51cb"
+                "sha256:061a6919145bbf282ebf1f9c59d3135d4833c25313c8595c0d68cf7712ddfce2",
+                "sha256:0cc40f7b4050bb93eb67de95d2d759322fc7ce4930b9d645581ecf4913ec651e",
+                "sha256:151dfaad9de753f4af2a7854e707e4784f2acc434340ade64239c5b104b2d605",
+                "sha256:19423e5d7ac1cc354baab59eaabf18db2ec04ef6593b5abe5a34f323c4a8f87a",
+                "sha256:19b562b1de4b9052ef1214a2821c44b6e6f22945daa102c32ae4eff929d8b6d8",
+                "sha256:1a0a29ed86960e44eaace7e081bdfab4f08b012fd96ec8edba71e2ad020939e4",
+                "sha256:1af817e84578ef8b7295ad17de0f9896e4c8520dbf2233c7aa5aa3d487256fc4",
+                "sha256:1b0bcac4d490a237e18cf91f57352920c29f77f2fa39efd0813fb81298bf17ba",
+                "sha256:1d98e33bd8bd67d7206c124e200bf2229c4cfa8c9c19f7b44a897f0fc71837eb",
+                "sha256:21ca0396fe5ec995dd54431c32698189666f9224810acfa752e50d2bd94d9df2",
+                "sha256:224865cbbcb7a2bd1356741dff12b0134df726b6d44bb7b500df8e303cbd9e81",
+                "sha256:242bb0cda2ae3650764fc194593d9ea45fc9e72729acd89778c7cfe184cec2a5",
+                "sha256:27f1821903e2ceadcb88ec2b45ef190897b7682449c772f4d9b53e42c520cf29",
+                "sha256:28524438cd3e723f25412f63d4fd516ff5bae9ae5aa56acbe2a1404398a0cf31",
+                "sha256:2b741888c93147444fdfc851abd81cc207f37f7f7da42062a00deb3888e57da8",
+                "sha256:2c36ff87b5dfaa477d0bd51e9d7f6abdae7c8955d2983c97419085d842154b3e",
+                "sha256:34b7d9c24a4165a2c61cc8ae11d44d48c9ce2830fb536cb7914e11fdd9962728",
+                "sha256:49d525938467d52c923a890153c99087c9d5a937d1f6b585dbdba34ec82e397a",
+                "sha256:4f84cdd868978d7b7350a566c254042d44216d9e37f241f3a6d3b1dfebeede35",
+                "sha256:62ff20cd130c956c7c9144d5fe35228f98b51c579b2439e988b27ef93e16c02a",
+                "sha256:63505c71542a44b68b1e38060450fb006404170da375feb31af153e7f9c6205d",
+                "sha256:6376d4b3aca039375ca8bf92f770da0ec424a1ce3a37077a8d3c557411aa56ca",
+                "sha256:6a4e68eed961a8de6928d1c17ff3dc2a547e0e923c17f8f1cd79fb7bc9502f98",
+                "sha256:6ab674f668d5962a3a4136ae0812519b0f1586874263723a32181d60d64137e1",
+           
```

**File**: `.github/workflows/build_and_test.yml` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ jobs:
       style_checker_image_name: "ghcr.io/citusdata/stylechecker"
       style_checker_tools_version: "0.8.33"
       sql_snapshot_pg_version: "18.6"
-      image_suffix: "-vc231ab7"
+      image_suffix: "-vb652ec7"
       pg17_version: '{ "major": "17", "full": "17.11" }'
       pg18_version: '{ "major": "18", "full": "18.6" }'
       pg19_version: '{ "major": "19", "full": "19beta4" }'
```

**File**: `src/test/regress/Pipfile` (modified, +4/-4)
```diff
@@ -5,20 +5,20 @@ verify_ssl = true
 
 [packages]
 pyasn1 = ">=0.6.4"
-mitmproxy = {git = "https://github.com/citusdata/mitmproxy.git", ref = "321e6d203cf31e36d59ba8e4f9c6a3c4a5d6ddf0"}
+mitmproxy = {git = "https://github.com/citusdata/mitmproxy.git", ref = "a16444362cc0393ccf7329f50fc909b711729de7"}
 "aioquic" = ">=1.2.0,<1.3.0"
 "mitmproxy-rs" = ">=0.12.6,<0.13.0"
 argon2-cffi = ">=23.1.0"
 bcrypt = ">=4.1.2"
 brotli = "<=1.2.0"
 h11 = "==0.16.0"
-h2 = "==4.3.0"
-tornado = ">=6.5.7,<6.6.0"
+h2 = "==4.4.1"
+tornado = ">=6.5.8,<6.6.0"
 msgpack = ">=1.2.1"
 zstandard = ">=0.25.0"
 construct = "*"
 docopt = "==0.6.2"
-cryptography = "==48.0.1"
+cryptography = "==50.0.0"
 pytest = "==9.0.3"
 psycopg = "*"
 filelock = "*"
```

**File**: `src/test/regress/Pipfile.lock` (modified, +314/-249)
```diff
@@ -1,7 +1,7 @@
 {
     "_meta": {
         "hash": {
-            "sha256": "63eaa480757d61b4951dcbef6687f5a385031e8e336544ac9630b6d7b7c631c6"
+            "sha256": "2ba804b49514faf026f3ebdb7ac55402c538f9808a86af4e2945f557e951c09d"
         },
         "pipfile-spec": 6,
         "requires": {
@@ -60,35 +60,50 @@
         },
         "argon2-cffi-bindings": {
             "hashes": [
-                "sha256:1db89609c06afa1a214a69a462ea741cf735b29a57530478c06eb81dd403de99",
-                "sha256:1e021e87faa76ae0d413b619fe2b65ab9a037f24c60a1e6cc43457ae20de6dc6",
-                "sha256:21378b40e1b8d1655dd5310c84a40fc19a9aa5e6366e835ceb8576bf0fea716d",
-                "sha256:2630b6240b495dfab90aebe159ff784d08ea999aa4b0d17efa734055a07d2f44",
-                "sha256:3c6702abc36bf3ccba3f802b799505def420a1b7039862014a65db3205967f5a",
-                "sha256:3d3f05610594151994ca9ccb3c771115bdb4daef161976a266f0dd8aa9996b8f",
-                "sha256:473bcb5f82924b1becbb637b63303ec8d10e84c8d241119419897a26116515d2",
-                "sha256:5acb4e41090d53f17ca1110c3427f0a130f944b896fc8c83973219c97f57b690",
-                "sha256:5d588dec224e2a83edbdc785a5e6f3c6cd736f46bfd4b441bbb5aa1f5085e584",
-                "sha256:6dca33a9859abf613e22733131fc9194091c1fa7cb3e131c143056b4856aa47e",
-                "sha256:7aef0c91e2c0fbca6fc68e7555aa60ef7008a739cbe045541e438373bc54d2b0",
-                "sha256:84a461d4d84ae1295871329b346a97f68eade8c53b6ed9a7ca2d7467f3c8ff6f",
-                "sha256:87c33a52407e4c41f3b70a9c2d3f6056d88b10dad7695be708c5021673f55623",
-                "sha256:8b8efee945193e667a396cbc7b4fb7d357297d6234d30a489905d96caabde56b",
-                "sha256:a1c70058c6ab1e352304ac7e3b52554daadacd8d453c1752e547c76e9c99ac44",
-                "sha256:a98cd7d17e9f7ce244c0803cad3c23a7d379c301ba618a5fa76a67d116618b98",
-                "sha256:aecba1723ae35330a008418a91ea6cfcedf6d31e5fbaa056a166462ff066d500",
-                "sha256:b0fdbcf513833809c882823f98dc2f931cf659d9a1429616ac3adebb49f5db94",
-                "sha256:b55aec3565b65f56455eebc9b9f34130440404f27fe21c3b375bf1ea4d8fbae6",
-                "sha256:b957f3e6ea4d55d820e40ff76f450952807013d361a65d7f28acc0acbf29229d",
-                "sha256:ba92837e4a9aa6a508c8d2d7883ed5a8f6c308c89a4790e1e447a220deb79a85",
-                "sha256:c4f9665de60b1b0e99bcd6be4f17d90339698ce954cfd8d9cf4f91c995165a92",
-                "sha256:c87b72589133f0346a1cb8d5ecca4b933e3c9b64656c9d175270a000e73b288d",
-                "sha256:d3e924cfc503018a714f94a49a149fdc0b644eaead5d1f089330399134fa028a",
-                "sha256:da0c79c23a63723aa5d782250fbf51b768abca630285262fb5144ba5ae01e520",
-                "sha256:e2fd3bfbff3c5d74fef31a722f729bf93500910db650c925c2d6ef879a7e51cb"
+                "sha256:061a6919145bbf282ebf1f9c59d3135d4833c25313c8595c0d68cf7712ddfce2",
+                "sha256:0cc40f7b4050bb93eb67de95d2d759322fc7ce4930b9d645581ecf4913ec651e",
+                "sha256:151dfaad9de753f4af2a7854e707e4784f2acc434340ade64239c5b104b2d605",
+                "sha256:19423e5d7ac1cc354baab59eaabf18db2ec04ef6593b5abe5a34f323c4a8f87a",
+                "sha256:19b562b1de4b9052ef1214a2821c44b6e6f22945daa102c32ae4eff929d8b6d8",
+                "sha256:1a0a29ed86960e44eaace7e081bdfab4f08b012fd96ec8edba71e2ad020939e4",
+                "sha256:1af817e84578ef8b7295ad17de0f9896e4c8520dbf2233c7aa5aa3d487256fc4",
+                "sha256:1b0bcac4d490a237e18cf91f57352920c29f77f2fa39efd0813fb81298bf17ba",
+                "sha256:1d98e33bd8bd67d7206c124e200bf2229c4cfa8c9c19f7b44a897f0fc71837eb",
+                "sha256:21ca0396fe5ec995dd54431c32698189666f9224810acfa752e50d2bd94d9df2",
+                "sha256:224865cbbcb7a2bd1356741dff12b0134df726b6d44bb7b500df8e303cbd9e81",
+                "sha256:242bb0cda2ae3650764fc194593d9ea45fc9e72729acd89778c7cfe184cec2a5",
+                "sha256:27f1821903e2ceadcb88ec2b45ef190897b7682449c772f4d9b53e42c520cf29",
+                "sha256:28524438cd3e723f25412f63d4fd516ff5bae9ae5aa56acbe2a1404398a0cf31",
+                "sha256:2b741888c93147444fdfc851abd81cc207f37f7f7da42062a00deb3888e57da8",
+                "sha256:2c36ff87b5dfaa477d0bd51e9d7f6abdae7c8955d2983c97419085d842154b3e",
+                "sha256:34b7d9c24a4165a2c61cc8ae11d44d48c9ce2830fb536cb7914e11fdd9962728",
+                "sha256:49d525938467d52c923a890153c99087c9d5a937d1f6b585dbdba34ec82e397a",
+                "sha256:4f84cdd868978d7b7350a566c254042d44216d9e37f241f3a6d3b1dfebeede35",
+                "sha256:62ff20cd130c956c7c9144d5fe35228f98b51c579b2439e988b27ef93e16c02a",
+                "sha256:63505c71542a44b68b1e38060450fb006404170da375feb31af153e7f9c6205d",
+                "sha256:6376d4b3aca039375ca8bf92f770da0ec424a1ce3a37077a8d3c557411aa56ca",
+                "sha256:6a4e68eed961a8de6928d1c17ff3dc2a547e0e923c17f8f1cd79fb7bc9502f98",
+                "sha256:6ab674f668d5962a3a4136ae0812519b0f1586874263723a32181d60d64137e1",
+           
```

#### Recent Merged Pull Requests:
- **PR #8929** (2026-10-16): Update PostgreSQL 19 CI to RC1 (@ihalatci)
- **PR #8924** (2026-10-14): Backport #8864: Fix incorrect column references in pushed-down HAVING clauses (release-13.2) (@KardelenCeren)
- **PR #8921** (2026-10-14): Backport #8864: Fix incorrect column references in pushed-down HAVING clauses (release-14.0) (@KardelenCeren)
- **PR #8913** (closed): Backport #8864: Fix incorrect column references in pushed-down HAVING clauses (release-13.2) (@ihalatci)
- **PR #8906** (closed): Backport #8864: Fix incorrect column references in pushed-down HAVING clauses (release-14.0) (@ihalatci)
- **PR #8898** (2026-10-14): Use PGPROC slot index in getProcNo_compat() on PG17+ (@serhatandic)

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

## X. transaction recovery after node removal (#8885)

**RULE**:
When implementing operations in `src/backend/distributed/metadata/metadata_cache.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in citusdata/citus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2aebefc7`: transaction recovery after node removal (#8885). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/backend/distributed/metadata/metadata_cache.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
	int32 groupId = ReadLocalGroupId(NULL);

	/* the table is only empty temporarily, during upgrades, so don't cache that */
	if (groupId != GROUP_ID_UPGRADING)
	{
		LocalGroupId = groupId;
	}

	return groupId;
}


/*
 * ReadLocalGroupId reads the group identifier of the local node from
 * pg_dist_local_group, using the given snapshot or a fresh one if snapshot is
 * NULL. Unlike GetLocalGroupId, it neither uses nor updates the cache. It
 * returns GROUP_ID_UPGRADING if the table is empty, which happens while
 * upgrading PostgreSQL.
 */
int32
ReadLocalGroupId(Snapshot snapshot)
{
	ScanKeyData scanKey[1];
	int scanKeyCount = 0;
	int32 groupId = 0;

	Relation pgDistLocalGroupId = table_open(DistLocalGroupIdRelationId(),
											 AccessShareLock);
													snapshot, scanKeyCount, scanKey);
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
	ScanKeyData scanKey[1];
	int scanKeyCount = 0;
	int32 groupId = 0;

	Relation pgDistLocalGroupId = table_open(localGroupTableOid, AccessShareLock);
													NULL, scanKeyCount, scanKey);

		/* set the local cache variable */
		LocalGroupId = groupId;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2aebefc7` are properly handled with clean fallback behavior.
