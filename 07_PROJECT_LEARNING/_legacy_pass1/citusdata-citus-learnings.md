# Forensic Learning Record (Deep Inspection): citusdata/citus

> **Canonical Artifact**: `07_PROJECT_LEARNING/citusdata-citus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/citusdata/citus](https://github.com/citusdata/citus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:08.375Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `citusdata/citus`
- **Description**: Distributed PostgreSQL as an extension
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12795 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
		.chunkRowCount = 
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
										 Snapshot snapshot);
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
												 Snapshot snapshot);
static ColumnBuffers * LoadColumnBuffers(Relation relation,
										 ColumnChunkSkipNode *chunkSkipNodeArray,
										 uint32 chunkCount, uint64 stripeOffset,
										 Form_pg_attribute attributeForm);
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
 */
ColumnarReadState *
ColumnarBeginRead(Relation relation, TupleDesc tupleDescriptor,
				  List *projectedColumnList, List *whereClauseList,
				  MemoryContext scanContext, Snapshot snapshot,
				  bool randomAccess)
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
		 * AdvanceStripeRead sets currentStripeMetadata for the 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8857** (2026-09-25): **rebalancer poisons fkey cache: parallel reference-table rebalance can schedule the same dependency twice**
  *Symptoms*: ## Problem  Parallel reference-table rebalancing can fail when reference tables are processed in a different order. The scheduler tries to insert the same prerequisite twice, and PostgreSQL rejects it:  ```text ERROR: duplicate key value violates unique constraint "pg_dist_background_task_depend_pkey" DETAIL: Key (job_id, task_id, depends_on)=(17777, 1005, 1004) already exists. ```  This is a real scheduling failure, not a test-output mismatch. It was discovered while investigating #8847, but has **not** been established as the cause of that CI failure.  ## How to reproduce  Reproduced locally on PostgreSQL 17.7 with assertions enabled, using Citus commit `6dfa3e01622358bbf1b2ec0d23951d6a5a9bedb2`. Both `force_logical` and `block_writes` scenarios fail.  Use a **disposable regression-test cluster only**: the reproduction deliberately rearranges an internal catalog.  1. In a configured Citus development environment, build and install Citus. 2. Open `src/test/regress/sql/background_rebalance_parallel_reference_tables.sql`. This test already creates the foreign-key chain `order_items -> orders -> customers` and adds two destination workers. 3. Insert the following immediately before **each** `citus_rebalance_start(...)` call:     ```sql    CREATE INDEX reverse_reference_scan    ON pg_dist_partition (logicalrelid DESC);    CLUSTER pg_dist_partition USING reverse_reference_scan;    DROP INDEX reverse_reference_scan;    ```     This changes the catalog's physical scan order without
  **Post-Mortem & Fix Analysis**:
  > > In [ScheduleTasksToParallelCopyReferenceTablesOnAllMissingNodes()](https://github.com/citusdata/citus/blob/6dfa3e01622358bbf1b2ec0d23951d6a5a9bedb2/src/backend/distributed/utils/reference_table_utils.c#L624-L650), list_concat() combines two cache-owned foreign-key lists. PostgreSQL's list_concat() modifies its first input.  This is a serious issue that's beyond the rebalancer. Such an unintentional update to the cache can also cause issues for further operations initiated from the same session. In other words, this poisons the cache until the end of the whole life of time PG connection, and we rely on fkey cache for many operation kinds too - this could for instance cause switching to sequential execution for a distributed query that we could actually execute in parallel mode.  We should simply wrap the first argument with list_copy to fix this issue.  And we should also get an agent audit the code-base to check if we have any other places where we modify first input list passed to l

- **Issue #8844** (2026-09-23): **CDC decoder: translated tuples leak into ReorderBufferChange, causing SIGSEGV in SlabFree during reorder buffer cleanup**
  *Symptoms*: ## Summary  `TranslateChangesIfSchemaChanged()` overwrites `change->data.tp.newtuple` / `oldtuple` with tuples allocated by `heap_form_tuple()` in the current memory context, and never restores the original pointers. PostgreSQL later frees those fields itself in `ReorderBufferFreeChange()`, expecting memory it allocated from the reorder buffer's own tuple context. Freeing a foreign pointer through the slab allocator produces a garbage context pointer and segfaults the walsender.  This is a **pre-existing latent bug**, not a regression from any recent PR. It surfaces intermittently, so it can look like a flaky test.  ## Evidence  Observed in `src/test/cdc/t/006_cdc_schema_change_and_move.pl` (PG18), which combines `DROP COLUMN`, a `force_logical` shard move, and a subsequent `UPDATE` — exactly the path that triggers translation. The test aborts after two assertions when the publisher crashes; the visible CI symptom is only a `poll_query_until` catch-up timeout with "connection refused", because the server logs are not uploaded as artifacts.  Backtrace from a local reproduction with a core dump:  ```text SlabFree ReorderBufferFreeChange ReorderBufferCleanupTXN ReorderBufferProcessTXN xact_decode LogicalDecodingProcessRecord XLogSendLogical WalSndLoop ```  Server log:  ```text LOG:  client backend (PID ...) was terminated by signal 11: Segmentation fault DETAIL:  Failed process was running: START_REPLICATION SLOT "cdc_replication_slot" LOGICAL 0/0          (proto_version '4', st

- **Issue #8792** (2026-09-04): **Bug: DISTINCT over a JSON_EXISTS predicate returns different row counts when the predicate is in WHERE vs. relocated into a derived-table projection (distributed tables)**
  *Symptoms*: ## Version  - Citus `14.1.0` on PostgreSQL `18.4` (Debian 18.4-1.pgdg13+1), multi-node cluster (1 coordinator + 2 workers), `citus.enable_repartition_joins = on`. - Found by an automated equivalence-testing fuzzer (SQLancer-derived DQR oracle).  ## What's Wrong?  For a `SELECT DISTINCT ... FROM local_table, distributed_table WHERE NOT (JSON_EXISTS(...))` query, the number of returned rows depends on **where the `JSON_EXISTS` predicate sits**: in the `WHERE` clause it returns **48** rows, but in the logically-equivalent form where the same predicate is materialized into a derived-table projection column and filtered afterwards it returns **64** rows.  The two queries below are logically equivalent (the DQR rewrite relocates the predicate from `WHERE` into a projection column `ref1`, then filters `WHERE ref1` on the outer query):  ```sql -- Base form: predicate in WHERE  ->  48 rows SELECT DISTINCT t3.c0, t5.c0, t2.c0, t2.c1 FROM t3, t5, t2 WHERE NOT (JSON_EXISTS(t2.c0, 'strict $.k0[0]' FALSE ON ERROR));  -- Relocated form: predicate in projection, filter afterwards  ->  64 rows SELECT * FROM (     SELECT DISTINCT         t3.c0, t5.c0, t2.c0, t2.c1,         (NOT (JSON_EXISTS(t2.c0, 'strict $.k0[0]' FALSE ON ERROR))) AS ref1     FROM t3, t5, t2 ) s WHERE ref1; ```  `t3`/`t5` are local tables and `t2` is a distributed table (distribution column `c2`, a boolean). The same predicate relocation is correct on a single-node / all-local schema, so the divergence is specific to the **di
  **Post-Mortem & Fix Analysis**:
  > I reproduced the reported difference on current Citus `main` using the devcontainer and a coordinator with two workers:  This does not appear to be a Citus bug. The underlying behavior reproduces in plain PostgreSQL without Citus.  `JSON_EXISTS()` produces order-dependent results when its JSON input is SQL NULL. For example, a table scanned in this order:  ```text input:  {}, SQL NULL, SQL NULL result: false, false, false ```  The same values scanned with the SQL NULL rows first produce:  ```text input:  SQL NULL, SQL NULL, {} result: NULL, NULL, false ```  I reproduced the plain PostgreSQL case on:  - PostgreSQL 17.7 - PostgreSQL 18.3 - PostgreSQL 18.4, the version reported in this issue  Citus exposes the problem because different shard tasks and plan shapes can encounter the NULL and non-NULL rows in different orders.  The SQL-correct result for the original query appears to be 32, not 48 or 64:  - `t3.c0` has 2 distinct values - `t5.c0` has 8 distinct values - only 2 distinct `(t2.
  > Tracked upstream as [PostgreSQL BUG #19654](https://www.postgresql.org/message-id/19654-3acd06154d027634@postgresql.org)
  > > Tracked upstream as [PostgreSQL BUG #19654](https://www.postgresql.org/message-id/19654-3acd06154d027634@postgresql.org)  Yes, I reported it!

- **Issue #8713** (2026-08-04): **release-14.0 is missing five bug fixes that are on main (found during 12.1.14 / 13.2 triage)**
  *Symptoms*: While triaging backports for the **12.1.14** patch release, I found the same four bug fixes missing from **`release-14.0`** that were missing from `release-12.1` (shipped in 12.1.14 via #8703–#8706) and from `release-13.2` (#8707, PRs #8709–#8712). A fifth, #8465, is missing from all three lines.  Raising this separately because it looks like a cross-branch miss rather than a deliberate 14.x exclusion — and because **two of these were explicitly labeled `cherry-pick-14`, closed, and then never shipped**.  ### Missing commits  | Fix | main commit | Merged to main | On `main` | On `release-14.0` | |---|---|---|---|---| | #8465 — `CREATE EXTENSION IF NOT EXISTS` fails for non-owner users (fixes #7091) | `fde8ceace` | 2026-02-10 | ✅ | ❌ | | #8561 — crash on writable standby coordinator writing to a coordinator-local shard (fixes #8426) | `8b99e078b` | 2026-05-06 | ✅ | ❌ | | #8556 — segfault in `EXPLAIN` with `LEFT JOIN` + correlated subqueries (fixes #8548) | `a3d5708a6` | 2026-05-07 | ✅ | ❌ | | #8498 — type mismatch when `COLLATE` is used with a type cast (fixes #8469) | `810e7fbb9` | 2026-05-22 | ✅ | ❌ | | #8594 — `CleanupRecordExists` uses a stale snapshot (shard-cleanup race) | `c41586cc8` | 2026-06-03 | ✅ | ❌ |  ### Why this looks unintentional  - `release-14.0` branched from `main` at `803f0ac57` (2026-01-18); all five fixes landed **after** that point and need explicit backporting. - The branch is actively maintained — head `8cdb17e25` (2026-07-31), about two months after 
  **Post-Mortem & Fix Analysis**:
  > Backport PRs are open, one per fix, all against `release-14.0` and each exactly 1 commit ahead of `8cdb17e25`:  | Fix | PR | main commit | branch | |---|---|---|---| | #8594 shard-cleanup stale snapshot | #8714 | `c41586cc8` | `bp-8594-release-14.0` | | #8498 COLLATE + type cast | #8715 | `810e7fbb9` | `bp-8498-release-14.0` | | #8556 EXPLAIN segfault | #8716 | `a3d5708a6` | `bp-8556-release-14.0` | | #8561 writable-standby crash | #8717 | `8b99e078b` | `bp-8561-release-14.0` | | #8465 `CREATE EXTENSION IF NOT EXISTS` | #8718 | `fde8ceace` | `bp-8465-release-14.0` |  All five are verbatim cherry-picks — zero conflicts, zero adaptation, and `git patch-id --stable` identical to the upstream commit in every case.  Validated on PG16.14 with a full A/B of unmodified `release-14.0` versus a stack of all five, `make install` before each leg and an assertion that the installed `citus.so` matches the worktree build. Both legs: `check-multi` 190 ok / 0 failed, `check-multi-1` 207 ok / 0 failed, 
  > ## CI verdict on the five backport PRs: no regressions  All five finished. Raw failure counts are misleading on this branch, so here is the split by failure class.  **Baseline for comparison** — scheduled run [`30626331970`](https://github.com/citusdata/citus/actions/runs/30626331970) at `8cdb17e25`, which is the exact base commit of all five PRs: **8 failures of 190 jobs** = 7 named jobs + 1 of 32 `Test flakyness` shards. `release-14.0` has been red at HEAD since 2026-05-22, independently of this work.  | PR | Fix | total fail | `Test flakyness` | named fail | extra named vs baseline | |---|---|---|---|---|---| | #8714 | #8594 | 8 | 0 / 32 | 8 | `PG17 check-multi-1-create-citus`, `Coordinator N-1 PG18 check-enterprise` | | #8715 | #8498 | 8 | 1 / 32 | 7 | `PG17 check-failure` | | #8716 | #8556 | 6 | 0 / 32 | 6 | **none — pure subset of baseline** | | #8717 | #8561 | 40 | **32 / 32** | 8 | `codecov/patch` | | #8718 | #8465 | 8 | 1 / 32 | 7 | `CDC PG18 installcheck` |  The named failure
  > ## CI closed out — final results after reruns  All checks on all five PRs have completed. Updating the earlier verdict with the post-rerun numbers.  | PR | Backport of | failures | composition | |---|---|---|---| | #8714 | #8594 | **6** | 6 × N-1 — strict subset of baseline | | #8715 | #8498 | **6** | 6 × N-1 — strict subset of baseline | | #8716 | #8556 | **6** | 6 × N-1 — strict subset of baseline | | #8717 | #8561 | 40 | 8 named + 32/32 change-triggered flakyness — root-caused benign (see previous comment) | | #8718 | #8465 | **6** | 6 × N-1 — strict subset of baseline |  The remaining 6 on four of the five PRs are exactly the N-1 mixed-version jobs that fail on the untouched baseline `8cdb17e25`:  ``` Test Citus Lib N-1 / PG18 - check-multi - lib-v14.1.0 Test Citus Lib N-1 / PG18 - check-multi-1 - lib-v14.1.0 Test Citus Lib N-1 / PG18 - check-add-backup-node - lib-v14.1.0 Test Citus Coordinator N-1 / PG18 - check-multi - 14.1-1 - lib-v14.1.0 Test Citus Coordinator N-1 / PG18 - chec

- **Issue #8707** (2026-08-04): **release-13.2 is missing four bug fixes that are on main (found during 12.1.14 triage)**
  *Symptoms*: While triaging backports for the **12.1.14** patch release, I found four bug fixes that landed on `main` but were never backported to **`release-13.2`**. They were also missing from `release-12.1` (now being addressed in #8703, #8704, #8705, #8706).  Raising this separately because it looks like a cross-branch miss rather than a deliberate 13.2-only exclusion.  ### Missing commits  | Fix | main commit | Merged to main | On `main` | On `release-13.2` | |---|---|---|---|---| | #8561 — crash on writable standby coordinator writing to a coordinator-local shard (fixes #8426) | `8b99e078b` | 2026-05-06 | ✅ | ❌ | | #8556 — segfault in `EXPLAIN` with `LEFT JOIN` + correlated subqueries (fixes #8548) | `a3d5708a6` | 2026-05-07 | ✅ | ❌ | | #8498 — type mismatch when `COLLATE` is used with a type cast (fixes #8469) | `810e7fbb9` | 2026-05-22 | ✅ | ❌ | | #8594 — `CleanupRecordExists` uses a stale snapshot (shard-cleanup race) | `c41586cc8` | 2026-06-03 | ✅ | ❌ |  ### Why this looks unintentional  - `release-13.2` was branched from `main` at `eaa609f51` (2025-08-19), so all four fixes landed **after** the branch point and would need explicit backporting. - The branch is still actively maintained — its head is `78621c405` (2026-07-31), roughly two months after the newest of these four landed on `main`. So it is receiving backports; these four just were not picked up. - Verified with `git merge-base --is-ancestor` against `origin/release-13.2` for each commit, plus a subject/ref grep over t
  **Post-Mortem & Fix Analysis**:
  > All four backports are merged into elease-13.2:  | PR | Backport of | Merged as | |---|---|---| | #8709 | #8594 | `f28963830` | | #8710 | #8498 | `b9edafe07` | | #8711 | #8556 | `d9893c26f` | | #8712 | #8561 | `c156063f0` |  Branch head is now `c156063f0`. CI on all four showed zero new failures relative to the pre-existing baseline at `78621c405`.  Closing as complete.

- **Issue #8693** (2026-07-28): **UPDATE in CTE incorrectly errors out**
  *Symptoms*: An UPDATE on a distributed table with an equality on the distribution column and an `AND FALSE` predicate that is wrapped in a CTE that is used in an outer select errors out; Here is a repro; the query should return 0 rows, but hits an error ``` CREATE TABLE citus_cte_repro (dist_key bigint NOT NULL, val int); SELECT create_distributed_table('citus_cte_repro', 'dist_key'); INSERT INTO citus_cte_repro SELECT g, g FROM generate_series(1, 20) g;  WITH u AS (   UPDATE citus_cte_repro SET val = val   WHERE dist_key = 7 AND false   RETURNING dist_key ) SELECT count(*) FROM u;     ERROR: could not find valid entry for shard 0 ```  This issue is present in Citus 12.1, so not a recent regression.

- **Issue #8553** (2026-07-07): **Wrong results: WHERE on inheritance parent column drops all rows when cross-joined with a distributed table through LEFT JOIN ... ON FALSE**
  *Symptoms*: # Wrong results: WHERE on inheritance parent column drops all rows when cross-joined with a distributed table through `LEFT JOIN ... ON FALSE`  ## Summary  When a regular table that has an inheritance child is cross-joined with a distributed table and combined with `LEFT JOIN ... ON FALSE`, a `WHERE` predicate on a column of the inheritance parent always evaluates to false on the worker, so the query returns zero rows.  ## Versions affected  - Citus 13.0 (`citusdata/citus:13.0-pg16`) - Citus 14.0 (`citusdata/citus:postgres_17`) - Citus nightly — extension 15.0-1 on PostgreSQL 18.1  Vanilla PostgreSQL 17 (clean `postgres:17` image, `shared_preload_libraries` empty, `citus` extension not installed) returns the correct answer.  ## Repro  ```sql CREATE TABLE t0(c0 REAL); CREATE TABLE t1() INHERITS(t0); CREATE TABLE t3(c0 REAL); SELECT create_distributed_table('t3', 'c0'); INSERT INTO t1(c0) VALUES (0.5); INSERT INTO t3(c0) VALUES (1);  SELECT 1 FROM t3, t0 LEFT JOIN t1 ON FALSE;                          -- returns 1 (correct) SELECT 1 FROM t3, t0 LEFT JOIN t1 ON FALSE WHERE t0.c0 IS NOT NULL;  -- returns 0 (expected: 1) SELECT 1 FROM t3, t0 LEFT JOIN t1 ON FALSE WHERE TRUE;               -- returns 1 (correct) ```  `t0.c0` is `0.5` (inherited from `t1`), so the second query should return one row.  ## Diagnosis  `EXPLAIN (ANALYZE, VERBOSE)` of the failing query shows the worker SQL Citus emits:  ``` SELECT 1 FROM (SELECT NULL::real AS c0 WHERE false) t3(c0),      ( (SELECT NULL::r
  **Post-Mortem & Fix Analysis**:
  > This has been fixed by #8497; that fix adds restriction-referenced columns to the required attributes before building the subquery in `recursive_planning.c`, so the vars in the restriction (`t0.c0 IS NOT NULL` in the repro query) are correctly projected.
  > reopening for backports
  > all backports completed

- **Issue #8548** (2026-05-07): **Segmentation fault on EXPLAIN of a query with LEFT JOIN to a distributed table and correlated subqueries in Citus 14.0.0 (PostgreSQL 18.1)**
  *Symptoms*: ### Description  I found a reproducible backend crash in Citus 14.0.0.  On my setup, `EXPLAIN` of the query below terminates the client backend with `signal 11: Segmentation fault`, which then forces PostgreSQL recovery. The same testcase does **not** reproduce on Citus 13.0.2.  The crash happens during `EXPLAIN`, so this appears to be in planning / distributed planning rather than execution.  ### Environment  - PostgreSQL 18.1 - Citus 14.0.0  `select version();` `PostgreSQL 18.1 (Debian 18.1-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit`  `select citus_version();` `Citus 14.0.0 on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit`  ### Version comparison  - Reproduces on: **Citus 14.0.0** - Does not reproduce on: **Citus 13.0.2**  ### Minimal schema  Only `t22` is distributed, and it is distributed by `colocated_key`. The other tables are regular local tables.  ```sql DROP TABLE IF EXISTS t4 CASCADE; DROP TABLE IF EXISTS t5 CASCADE; DROP TABLE IF EXISTS t7 CASCADE; DROP TABLE IF EXISTS t2 CASCADE; DROP TABLE IF EXISTS t22 CASCADE;  CREATE TABLE t4 (     vkey integer,     pkey integer,     c30 integer,     c31 integer,     c32 text );  CREATE TABLE t5 (     vkey integer,     pkey integer,     c33 text,     c34 integer,     c35 integer,     c36 timestamp without time zone );  CREATE TABLE t7 (     vkey integer,     pkey integer,     c45 integer,     c46 integer,     c47 integer,     c48 numeric,     c49 integer );  C

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

### Incident Patch 1: `807059a6` (2026-09-28)
**Commit Message**: Automated security dependency sync from Dependabot alerts (#8882)

Automated weekly security sync based on open Dependabot alerts.

This PR is managed by dependency-security-sync workflow.

Supersedes the individual Dependabot PRs for: cryptography tornado h2.
Those PRs are intentionally left open and should be closed when this PR
merges.

---------

Co-authored-by: ibrahim halatci <ihalatci@gmail.com>
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
+                "sha256
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
+                "sha256
```

---

### Incident Patch 2: `991faa89` (2026-09-28)
**Commit Message**: Fix rebalance background job ID type (#8819)

RebalanceTableShardsBackground() returns an int64, while its result was stored in an int. Store the returned job ID in an int64 to avoid narrowing the value.

**File**: `src/backend/distributed/operations/shard_rebalancer.c` (modified, +3/-3)
```diff
@@ -1201,9 +1201,9 @@ citus_rebalance_start(PG_FUNCTION_ARGS)
 		.rebalanceStrategy = strategy,
 		.improvementThreshold = strategy->improvementThreshold,
 	};
-	int jobId = RebalanceTableShardsBackground(&options, shardTransferModeOid,
-											   ParallelTransferReferenceTables,
-											   ParallelTransferColocatedShards);
+	int64 jobId = RebalanceTableShardsBackground(&options, shardTransferModeOid,
+												 ParallelTransferReferenceTables,
+												 ParallelTransferColocatedShards);
 
 	if (jobId == 0)
 	{
```

---

### Incident Patch 3: `e506c8c2` (2026-09-28)
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

### Incident Patch 4: `0cd3fe32` (2026-09-25)
**Commit Message**: Fix PostgreSQL 19 beta4 compatibility (#8870)

DESCRIPTION: Align Citus compatibility code with PostgreSQL 19 beta4

## Summary

- use the green PostgreSQL 19 beta4 development images from
citusdata/the-process#250 (`-dev-64e776f`)
- update PG19 CI and nightly cassert matrices from `19beta3` to
`19beta4`
- remove property-graph compatibility reverted upstream between
`REL_19_BETA3` and `REL_19_BETA4`
- preserve the remaining PostgreSQL 19 compatibility work already merged
on `main`

## Upstream delta

Replayed the applicable parts of PostgreSQL's
`REL_19_BETA3..REL_19_BETA4` `src/backend/utils/adt/ruleutils.c` delta
onto Citus's curated `ruleutils_19.c`: removed the five `pg_propgraph_*`
includes, graph-pattern deparse helpers, and `RTE_GRAPH_TABLE` branches
while preserving Citus-specific hooks and shard-aware deparsing.

The Beta 4 build exposed two additional removed upstream symbols. This
PR removes only their corresponding compatibility branches:

- `OBJECT_PROPGRAPH` in `pg_get_object_address_17_18.c`
- `RTE_GRAPH_TABLE` in `citus_nodefuncs.c`

## Compatibility audit

Removes #8733. Retains #8622, #8624, #8741, #8784, #8785, and #8795
because their underlying PostgreSQL 19 be

**File**: `.github/workflows/build_and_test.yml` (modified, +3/-3)
```diff
@@ -36,11 +36,11 @@ jobs:
       style_checker_image_name: "ghcr.io/citusdata/stylechecker"
       style_checker_tools_version: "0.8.33"
       sql_snapshot_pg_version: "18.6"
-      image_suffix: "-vdba9cbb"
+      image_suffix: "-dev-64e776f"
       pg17_version: '{ "major": "17", "full": "17.11" }'
       pg18_version: '{ "major": "18", "full": "18.6" }'
-      pg19_version: '{ "major": "19", "full": "19beta3" }'
-      upgrade_pg_versions: "17.11-18.6-19beta3"
+      pg19_version: '{ "major": "19", "full": "19beta4" }'
+      upgrade_pg_versions: "17.11-18.6-19beta4"
     steps:
       # Since GHA jobs need at least one step we use a noop step here.
       - name: Set up parameters
```

**File**: `.github/workflows/nightly_cassert.yml` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@ run-name: Nightly cassert (${{ github.ref_name }})
 # asserts surface -- that is the intended signal, not a regression gate.
 #
 # The version matrix lives in the `params` job below (single source of truth, mirroring
-# build_and_test.yml's params job, which pins 17.11 / 18.6 / 19beta3 and no longer builds PG16).
+# build_and_test.yml's params job, which pins 17.11 / 18.6 / 19beta4 and no longer builds PG16).
 
 on:
   schedule:
@@ -34,8 +34,8 @@ jobs:
     name: Initialize parameters
     runs-on: ubuntu-latest
     outputs:
-      pg_versions: '[{ "major": "17", "full": "17.11" }, { "major": "18", "full": "18.6" }, { "major": "19", "full": "19beta3" }]'
-      pg_upgrade_pairs: '[{ "old": "17", "old_full": "17.11", "new": "18", "new_full": "18.6" }, { "old": "18", "old_full": "18.6", "new": "19", "new_full": "19beta3" }, { "old": "17", "old_full": "17.11", "new": "19", "new_full": "19beta3" }]'
+      pg_versions: '[{ "major": "17", "full": "17.11" }, { "major": "18", "full": "18.6" }, { "major": "19", "full": "19beta4" }]'
+      pg_upgrade_pairs: '[{ "old": "17", "old_full": "17.11", "new": "18", "new_full": "18.6" }, { "old": "18", "old_full": "18.6", "new": "19", "new_full": "19beta4" }, { "old": "17", "old_full": "17.11", "new": "19", "new_full": "19beta4" }]'
       citus_upgrade_pg: '[{ "major": "17", "full": "17.11" }, { "major": "18", "full": "18.6" }]'
       citus_old_version: "v14.0.1"  # 14.0-1 chains to MASTER (15.0); 14.1 has no path to 15.0 yet
     steps:
```

**File**: `src/backend/distributed/deparser/ruleutils_19.c` (modified, +0/-193)
```diff
@@ -43,11 +43,6 @@
 #include "catalog/pg_operator.h"
 #include "catalog/pg_partitioned_table.h"
 #include "catalog/pg_proc.h"
-#include "catalog/pg_propgraph_element.h"
-#include "catalog/pg_propgraph_element_label.h"
-#include "catalog/pg_propgraph_label.h"
-#include "catalog/pg_propgraph_label_property.h"
-#include "catalog/pg_propgraph_property.h"
 #include "catalog/pg_statistic_ext.h"
 #include "catalog/pg_trigger.h"
 #include "catalog/pg_type.h"
@@ -4304,170 +4299,6 @@ get_utility_query_def(Query *query, deparse_context *context)
 }
 
 
-/*
- * Parse back a graph label expression
- */
-static void
-get_graph_label_expr(Node *label_expr, deparse_context *context)
-{
-	StringInfo	buf = context->buf;
-
-	check_stack_depth();
-
-	switch (nodeTag(label_expr))
-	{
-		case T_GraphLabelRef:
-			{
-				GraphLabelRef *lref = (GraphLabelRef *) label_expr;
-
-				appendStringInfoString(buf, quote_identifier(get_propgraph_label_name(lref->labelid)));
-				break;
-			}
-
-		case T_BoolExpr:
-			{
-				BoolExpr   *be = (BoolExpr *) label_expr;
-				ListCell   *lc;
-				bool		first = true;
-
-				Assert(be->boolop == OR_EXPR);
-
-				foreach(lc, be->args)
-				{
-					if (!first)
-					{
-						if (be->boolop == OR_EXPR)
-							appendStringInfoChar(buf, '|');
-					}
-					else
-						first = false;
-					get_graph_label_expr(lfirst(lc), context);
-				}
-
-				break;
-			}
-
-		default:
-			elog(ERROR, "unrecognized node type: %d", (int) nodeTag(label_expr));
-			break;
-	}
-}
-
-/*
- * Parse back a path pattern expression
- */
-static void
-get_path_pattern_expr_def(List *path_pattern_expr, deparse_context *context)
-{
-	StringInfo	buf = context->buf;
-	ListCell   *lc;
-
-	foreach(lc, path_pattern_expr)
-	{
-		GraphElementPattern *gep = lfirst_node(GraphElementPattern, lc);
-		const char *sep = "";
-
-		switch (gep->kind)
-		{
-			case VERTEX_PATTERN:
-				appendStringInfoChar(buf, '(');
-				break;
-			case EDGE_PATTERN_LEFT:
-				appendStringInfoString(buf, "<-[");
-				break;
-			case EDGE_PATTERN_RIGHT:
-			case EDGE_PATTERN_ANY:
-				appendStringInfoString(buf, "-[");
-				break;
-			case PAREN_EXPR:
-				appendStringInfoChar(buf, '(');
-				break;
-		}
-
-		if (gep->variable)
-		{
-			appendStringInfoString(buf, quote_identifier(gep->variable));
-			sep = " ";
-		}
-
-		if (gep->labelexpr)
-		{
-			appendStringInfoString(buf, sep);
-			appendStringInfoString(buf, "IS ");
-			get_graph_label_expr(gep->labelexpr, context);
-			sep = " ";
-		}
-
-		if (gep->subexpr)
-		{
-			appendStringInfoString(buf, sep);
-			get_path_pattern_expr_def(gep->subexpr, context);
-			sep = " ";
-		}
-
-		if (gep->whereClause)
-		{
-			appendStringInfoString(buf, sep);
-			appendStringInfoString(buf, "WHERE ");
-			get_rule_expr(gep->whereClause, context, false);
-		}
-
-		switch (gep->kind)
-		{
-			case VERTEX_PATTERN:
-				appendStringInfoChar(buf, ')');
-				break;
-			case EDGE_PATTERN_LEFT:
-			case EDGE_PATTERN_ANY:
-				appendStringInfoString(buf, "]-");
-				break;
-			case EDGE_PATTERN_RIGHT:
-				appendStringInfoString(buf, "]->");
-				break;
-			case PAREN_EXPR:
-				appendStringInfoChar(buf, ')');
-				break;
-		}
-
-		if (gep->quantifier)
-		{
-			int			lower = linitial_int(gep->quantifier);
-			int			upper = lsecond_int(gep->quantifier);
-
-			appendStringInfo(buf, "{%d,%d}", lower, upper);
-		}
-	}
-}
-
-/*
- * Parse back a graph pattern
- */
-static void
-get_graph_pattern_def(GraphPattern *graph_pattern, deparse_context *context)
-{
-	StringInfo	buf = context->buf;
-	ListCell   *lc;
-	bool		first = true;
-
-	foreach(lc, graph_pattern->path_pattern_list)
-	{
-		List	   *path_pattern_expr = lfirst_node(List, lc);
-
-		if (!first)
-			appendStringInfoString(buf, ", ");
-		else
-			first = false;
-
-		get_path_pattern_expr_def(path_pattern_expr, context);
-	}
-
-	if (graph_pattern->whereClause)
-	{
-		appendStringInfoString(buf, "WHERE ");
-		get_rule_expr(graph_pattern->whereClause, context, false);
-	}
-}
-
 /*
  * Display a Var appro
```

**File**: `src/backend/distributed/metadata/pg_get_object_address_17_18.c` (modified, +6/-3)
```diff
@@ -182,6 +182,9 @@ PgGetObjectAddress(char *ttype, ArrayType *namearr, ArrayType *argsarr)
 		case OBJECT_DOMCONSTRAINT:
 		case OBJECT_CAST:
 		case OBJECT_USER_MAPPING:
+#if PG_VERSION_NUM >= PG_VERSION_19
+		case OBJECT_PUBLICATION_EXCLUDED_REL:
+#endif
 		case OBJECT_PUBLICATION_REL:
 		case OBJECT_DEFACL:
 		case OBJECT_TRANSFORM:
@@ -271,9 +274,6 @@ PgGetObjectAddress(char *ttype, ArrayType *namearr, ArrayType *argsarr)
 		case OBJECT_TABCONSTRAINT:
 		case OBJECT_OPCLASS:
 		case OBJECT_OPFAMILY:
-#if PG_VERSION_NUM >= PG_VERSION_19
-		case OBJECT_PROPGRAPH:
-#endif
 		{
 			objnode = (Node *) name;
 			break;
@@ -318,6 +318,9 @@ PgGetObjectAddress(char *ttype, ArrayType *namearr, ArrayType *argsarr)
 			break;
 		}
 
+#if PG_VERSION_NUM >= PG_VERSION_19
+		case OBJECT_PUBLICATION_EXCLUDED_REL:
+#endif
 		case OBJECT_PUBLICATION_REL:
 		{
 			objnode = (Node *) list_make2(name, linitial(args));
```

**File**: `src/backend/distributed/planner/distributed_planner.c` (modified, +11/-0)
```diff
@@ -283,6 +283,17 @@ distributed_planner(Query *parse,
 			planContext.plan = standard_planner(planContext.query, NULL,
 												planContext.cursorOptions,
 												planContext.boundParams);
+#if PG_VERSION_NUM >= PG_VERSION_19
+
+			/* PG19 join removal edits the jointree that Citus plans below. */
+			if (needsDistributedPlanning &&
+				list_length(UsedTableEntryList(planContext.query)) < list_length(
+					UsedTableEntryList(planContext.originalQuery)))
+			{
+				planContext.query->jointree =
+					copyObject(planContext.originalQuery->jointree);
+			}
+#endif
 #if PG_VERSION_NUM >= PG_VERSION_18
 			if (needsDistributedPlanning)
 			{
```

---

### Incident Patch 5: `c267b0b1` (2026-09-25)
**Commit Message**: Fix fkey cache mutation in parallel reference table rebalance (#8869)

DESCRIPTION: Fixes parallel rebalance failing on reference table foreign keys

ScheduleTasksToParallelCopyReferenceTablesOnAllMissingNodes() passed the cache-owned referencedRelationsViaForeignKey list as the first argument of list_concat(), which modifies that list in place. Each destination worker appended the referencing list to the cache entry again, so the cached fkey graph stayed wrong for the backend's lifetime. When a referencing table was scheduled before a table it references, the same dependency was inserted twice, and citus_rebalance_start() failed with a duplicate key error on pg_dist_background_task_depend_pkey.

Copy the cached list before concatenating. Use list_concat_unique_oid() because, with foreign key cycles, a relation can appear in both lists, which would otherwise produce the same duplicate dependency.

Add a regression test that reorders pg_dist_partition, rebalances onto two new workers per transfer mode in one session, and checks that the cached fkey lists are unchanged.

Fixes #8857

**File**: `src/backend/distributed/utils/reference_table_utils.c` (modified, +8/-4)
```diff
@@ -621,11 +621,15 @@ ScheduleTasksToParallelCopyReferenceTablesOnAllMissingNodes(int64 jobId, char tr
 							referenceTableName, newWorkerNode->workerName,
 							newWorkerNode->workerPort, buf.data)));
 
+			/*
+			 * Copy the cached list since list_concat_unique_oid modifies its first
+			 * argument. Use the unique variant because, with foreign key cycles, a
+			 * relation can be both referenced and referencing.
+			 */
 			CitusTableCacheEntry *cacheEntry = GetCitusTableCacheEntry(relationId);
-			List *relatedRelations = list_concat(cacheEntry->
-												 referencedRelationsViaForeignKey,
-												 cacheEntry->
-												 referencingRelationsViaForeignKey);
+			List *relatedRelations = list_concat_unique_oid(
+				list_copy(cacheEntry->referencedRelationsViaForeignKey),
+				cacheEntry->referencingRelationsViaForeignKey);
 			List *dependencyTaskList = NIL;
 
 			Oid relatedRelationId = InvalidOid;
```

**File**: `src/test/regress/citus_tests/run_test.py` (modified, +6/-0)
```diff
@@ -186,6 +186,12 @@ def extra_tests(self):
         repeatable=False,
         worker_count=6,
     ),
+    "background_rebalance_parallel_reference_fkeys": TestDeps(
+        None,
+        ["multi_test_helpers", "multi_cluster_management"],
+        repeatable=False,
+        worker_count=6,
+    ),
     "function_propagation": TestDeps("minimal_schedule"),
     "citus_shards": TestDeps("minimal_schedule"),
     "grant_on_foreign_server_propagation": TestDeps("minimal_schedule"),
```

**File**: `src/test/regress/expected/background_rebalance_parallel_reference_fkeys.out` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+--
+-- BACKGROUND_REBALANCE_PARALLEL_REFERENCE_FKEYS
+--
+-- Parallel reference table copies to multiple new nodes must not modify the
+-- cached foreign key lists nor schedule the same dependency twice, regardless
+-- of the order in which reference tables are processed (issue #8857).
+--
+CREATE SCHEMA background_rebalance_parallel_fkeys;
+SET search_path TO background_rebalance_parallel_fkeys;
+SET citus.next_shard_id TO 85675000;
+SET citus.shard_replication_factor TO 1;
+SET client_min_messages TO ERROR;
+CREATE FUNCTION get_referenced_relation_id_list(Oid)
+    RETURNS SETOF Oid
+    LANGUAGE C STABLE STRICT
+    AS 'citus', $$get_referenced_relation_id_list$$;
+CREATE FUNCTION get_referencing_relation_id_list(Oid)
+    RETURNS SETOF Oid
+    LANGUAGE C STABLE STRICT
+    AS 'citus', $$get_referencing_relation_id_list$$;
+CREATE TABLE dist (a int PRIMARY KEY);
+SELECT create_distributed_table('dist', 'a', shard_count => 12, colocate_with => 'none');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+CREATE TABLE customers (id int PRIMARY KEY);
+CREATE TABLE orders (id int PRIMARY KEY, customer_id int);
+CREATE TABLE order_items (id int PRIMARY KEY, order_id int);
+SELECT create_reference_table('customers');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_reference_table('orders');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_reference_table('order_items');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+ALTER TABLE order_items ADD FOREIGN KEY (order_id) REFERENCES orders (id);
+ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers (id);
+-- A foreign key cycle makes each table both referenced and referencing.
+CREATE TABLE cycle_a (id int PRIMARY KEY, b_id int);
+CREATE TABLE cycle_b (id int PRIMARY KEY, a_id int);
+SELECT create_reference_table('cycle_a');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_reference_table('cycle_b');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+ALTER TABLE cycle_a ADD FOREIGN KEY (b_id) REFERENCES cycle_b (id);
+ALTER TABLE cycle_b ADD FOREIGN KEY (a_id) REFERENCES cycle_a (id);
+INSERT INTO customers SELECT i FROM generate_series(1, 10) i;
+INSERT INTO orders SELECT i, i % 10 + 1 FROM generate_series(1, 30) i;
+INSERT INTO order_items SELECT i, i % 30 + 1 FROM generate_series(1, 90) i;
+INSERT INTO cycle_a SELECT i, NULL FROM generate_series(1, 5) i;
+INSERT INTO cycle_b SELECT i, i FROM generate_series(1, 5) i;
+CREATE VIEW fkey_cache AS
+SELECT r::regclass AS relation,
+       ARRAY(SELECT x::regclass::text FROM get_referenced_relation_id_list(r) x ORDER BY 1) AS referenced,
+       ARRAY(SELECT x::regclass::text FROM get_referencing_relation_id_list(r) x ORDER BY 1) AS referencing
+FROM unnest(ARRAY['customers', 'orders', 'order_items', 'cycle_a', 'cycle_b']::regclass[]) r;
+CREATE VIEW ref_placements AS
+SELECT logicalrelid::regclass AS relation,
+       count(*) = (SELECT count(*) FROM pg_dist_node
+                   WHERE isactive AND noderole = 'primary') AS on_all_nodes
+FROM pg_dist_shard JOIN pg_dist_placement USING (shardid)
+WHERE logicalrelid IN ('customers'::regclass, 'orders'::regclass, 'order_items'::regclass,
+                       'cycle_a'::regclass, 'cycle_b'::regclass)
+GROUP BY 1 ORDER BY logicalrelid::regclass::text;
+SELECT * FROM fkey_cache;
+  relation   |     referenced     |     referencing
+---------------------------------------------------------------------
+ customers   | {}                 | {order_items,orders}
+ orders      | {customers}        | {order_items}
+ order_items | {customers,orders} | {}
+ cycle
```

**File**: `src/test/regress/operations_schedule` (modified, +1/-0)
```diff
@@ -14,3 +14,4 @@ test: cpu_priority
 test: check_mx
 test: citus_drain_node
 test: background_rebalance_parallel_reference_tables
+test: background_rebalance_parallel_reference_fkeys
```

**File**: `src/test/regress/sql/background_rebalance_parallel_reference_fkeys.sql` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+--
+-- BACKGROUND_REBALANCE_PARALLEL_REFERENCE_FKEYS
+--
+-- Parallel reference table copies to multiple new nodes must not modify the
+-- cached foreign key lists nor schedule the same dependency twice, regardless
+-- of the order in which reference tables are processed (issue #8857).
+--
+CREATE SCHEMA background_rebalance_parallel_fkeys;
+SET search_path TO background_rebalance_parallel_fkeys;
+SET citus.next_shard_id TO 85675000;
+SET citus.shard_replication_factor TO 1;
+SET client_min_messages TO ERROR;
+
+CREATE FUNCTION get_referenced_relation_id_list(Oid)
+    RETURNS SETOF Oid
+    LANGUAGE C STABLE STRICT
+    AS 'citus', $$get_referenced_relation_id_list$$;
+
+CREATE FUNCTION get_referencing_relation_id_list(Oid)
+    RETURNS SETOF Oid
+    LANGUAGE C STABLE STRICT
+    AS 'citus', $$get_referencing_relation_id_list$$;
+
+CREATE TABLE dist (a int PRIMARY KEY);
+SELECT create_distributed_table('dist', 'a', shard_count => 12, colocate_with => 'none');
+
+CREATE TABLE customers (id int PRIMARY KEY);
+CREATE TABLE orders (id int PRIMARY KEY, customer_id int);
+CREATE TABLE order_items (id int PRIMARY KEY, order_id int);
+SELECT create_reference_table('customers');
+SELECT create_reference_table('orders');
+SELECT create_reference_table('order_items');
+ALTER TABLE order_items ADD FOREIGN KEY (order_id) REFERENCES orders (id);
+ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers (id);
+
+-- A foreign key cycle makes each table both referenced and referencing.
+CREATE TABLE cycle_a (id int PRIMARY KEY, b_id int);
+CREATE TABLE cycle_b (id int PRIMARY KEY, a_id int);
+SELECT create_reference_table('cycle_a');
+SELECT create_reference_table('cycle_b');
+ALTER TABLE cycle_a ADD FOREIGN KEY (b_id) REFERENCES cycle_b (id);
+ALTER TABLE cycle_b ADD FOREIGN KEY (a_id) REFERENCES cycle_a (id);
+
+INSERT INTO customers SELECT i FROM generate_series(1, 10) i;
+INSERT INTO orders SELECT i, i % 10 + 1 FROM generate_series(1, 30) i;
+INSERT INTO order_items SELECT i, i % 30 + 1 FROM generate_series(1, 90) i;
+INSERT INTO cycle_a SELECT i, NULL FROM generate_series(1, 5) i;
+INSERT INTO cycle_b SELECT i, i FROM generate_series(1, 5) i;
+
+CREATE VIEW fkey_cache AS
+SELECT r::regclass AS relation,
+       ARRAY(SELECT x::regclass::text FROM get_referenced_relation_id_list(r) x ORDER BY 1) AS referenced,
+       ARRAY(SELECT x::regclass::text FROM get_referencing_relation_id_list(r) x ORDER BY 1) AS referencing
+FROM unnest(ARRAY['customers', 'orders', 'order_items', 'cycle_a', 'cycle_b']::regclass[]) r;
+
+CREATE VIEW ref_placements AS
+SELECT logicalrelid::regclass AS relation,
+       count(*) = (SELECT count(*) FROM pg_dist_node
+                   WHERE isactive AND noderole = 'primary') AS on_all_nodes
+FROM pg_dist_shard JOIN pg_dist_placement USING (shardid)
+WHERE logicalrelid IN ('customers'::regclass, 'orders'::regclass, 'order_items'::regclass,
+                       'cycle_a'::regclass, 'cycle_b'::regclass)
+GROUP BY 1 ORDER BY logicalrelid::regclass::text;
+
+SELECT * FROM fkey_cache;
+
+-- Two new nodes miss all reference tables. Check the cache in the same
+-- transaction, before background tasks can invalidate it.
+SELECT 1 FROM citus_add_node('localhost', :worker_3_port);
+SELECT 1 FROM citus_add_node('localhost', :worker_4_port);
+
+-- Rewrite pg_dist_partition in descending relation id order, so that the
+-- rebalancer processes referencing tables before the tables they reference.
+CREATE INDEX reverse_relid ON pg_dist_partition (logicalrelid DESC);
+CLUSTER pg_dist_partition USING reverse_relid;
+DROP INDEX reverse_relid;
+BEGIN;
+SELECT 1 FROM citus_rebalance_start(shard_transfer_mode := 'force_logical',
+                                    parallel_transfer_reference_tables := true);
+SELECT * FROM fkey_cache;
+COMMIT;
+SELECT citus_rebalance_wait();
+SELECT state FROM pg_dist_background_job ORDER BY job_id DESC LIMIT 1;
+SELECT * FROM ref_placements;
+
+-- Repeat in the same 
```

---

### Incident Patch 6: `a752ba5c` (2026-09-25)
**Commit Message**: Merge branch 'main' into serhatandic-fix-fkey-cache-poisoning

**File**: `src/test/regress/expected/background_rebalance_parallel_reference_tables.out` (modified, +32/-50)
```diff
@@ -206,23 +206,11 @@ SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
  table2_colg3 | 85674021 |          0 | localhost  |      57638 | localhost  |      57639
 (12 rows)
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'force_logical',
     parallel_transfer_colocated_shards := true,
     parallel_transfer_reference_tables := true) \gset
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
 NOTICE:  Scheduled 6 moves as job xxx
 DETAIL:  Rebalance scheduled as background job
 HINT:  To monitor progress, run: SELECT * FROM citus_rebalance_status();
@@ -269,9 +257,12 @@ SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_o
   17777 |    1013 |       1007
 (24 rows)
 
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -293,7 +284,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
  task_id | command  | depends_on | command
 ---------------------------------------------------------------------
     1001 | 85674025 |       1000 | 85674024
@@ -308,18 +299,18 @@ FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task
     1007 | 85674026 |       1004 | 85674024
     1007 | 85674026 |       1005 | 85674025
     1007 | 85674026 |       1006 | 85674026
-    1008 | 85674001 |       1003 | 85674026
-    1008 | 85674001 |       1007 | 85674026
-    1009 | 85674000 |       1003 | 85674026
-    1009 | 85674000 |       1007 | 85674026
-    1010 | 85674009 |       1003 | 85674026
-    1010 | 85674009 |       1007 | 85674026
-    1011 | 85674008 |       1003 | 85674026
-    1011 | 85674008 |       1007 | 85674026
-    1012 | 85674017 |       1003 | 85674026
-    1012 | 85674017 |       1007 | 85674026
-    1013 | 85674016 |       1003 | 85674026
-    1013 | 85674016 |       1007 | 85674026
+         | 85674000 |       1003 | 85674026
+         | 85674000 |       1007 | 85674026
+         | 85674001 |       1003 | 85674026
+         | 85674001 |       1007 | 85674026
+         | 85674008 |       1003 | 85674026
+         | 85674008 |       1007 | 85674026
+         | 85674009 |       1003 | 85674026
+         | 85674009 |       1007 | 85674026
+         | 85674016 |       1003 | 85674026
+         | 85674016 |       1007 | 85674026
+         | 85674017 |       1003 | 85674026
+         | 85674017 |       1007 | 85674026
 (24 rows)
 
 TRUNCATE pg_dist_background_job CASCADE;

```

**File**: `src/test/regress/expected/shard_rebalancer.out` (modified, +13/-0)
```diff
@@ -2718,6 +2718,13 @@ select create_distributed_table('colocated_t3','a',colocate_with=>'"events.Energ
 
 (1 row)
 
+-- Register the coordinator so cache refreshes do not add missing-node DEBUG messages.
+SELECT 1 FROM master_add_node('localhost', :master_port, groupId => 0);
+ ?column?
+---------------------------------------------------------------------
+        1
+(1 row)
+
 SET client_min_messages TO DEBUG4;
 SELECT * FROM get_rebalance_table_shards_plan('colocated_t1', rebalance_strategy := 'by_disk_size');
 DEBUG:  skipping child tables for relation named: colocated_t1
@@ -2733,6 +2740,12 @@ DEBUG:  Size Query: SELECT (SELECT SUM(worker_partitioned_relation_total_size(re
 (0 rows)
 
 RESET client_min_messages;
+SELECT 1 FROM master_remove_node('localhost', :master_port);
+ ?column?
+---------------------------------------------------------------------
+        1
+(1 row)
+
 DROP TABLE "events.Energy Added", colocated_t1, colocated_t2, colocated_t3;
 RESET citus.shard_count;
 DROP VIEW table_placements_per_node;
```

**File**: `src/test/regress/sql/background_rebalance_parallel_reference_tables.sql` (modified, +12/-6)
```diff
@@ -126,7 +126,7 @@ SELECT 1 FROM citus_add_node('localhost', :worker_4_port);
 
 SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'force_logical',
@@ -142,9 +142,12 @@ SELECT citus_rebalance_wait();
 -- see the dependencies of the tasks scheduled by the background rebalancer
 SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_on;
 
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -166,7 +169,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
 
 
 TRUNCATE pg_dist_background_job CASCADE;
@@ -200,7 +203,7 @@ SELECT 1 FROM citus_add_node('localhost', :worker_6_port);
 
 SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'block_writes',
@@ -214,9 +217,12 @@ SELECT citus_rebalance_wait();
 
 -- see the dependencies of the tasks scheduled by the background rebalancer
 SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_on;
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -238,7 +244,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
 
 SELECT
     c.id AS customer_id,
```

**File**: `src/test/regress/sql/shard_rebalancer.sql` (modified, +3/-0)
```diff
@@ -1519,9 +1519,12 @@ select create_distributed_table('colocated_t2','a',colocate_with=>'"events.Energ
 create table colocated_t3 (a int);
 select create_distributed_table('colocated_t3','a',colocate_with=>'"events.Energy Added"');
 
+-- Register the coordinator so cache refreshes do not add missing-node DEBUG messages.
+SELECT 1 FROM master_add_node('localhost', :master_port, groupId => 0);
 SET client_min_messages TO DEBUG4;
 SELECT * FROM get_rebalance_table_shards_plan('colocated_t1', rebalance_strategy := 'by_disk_size');
 RESET client_min_messages;
+SELECT 1 FROM master_remove_node('localhost', :master_port);
 
 DROP TABLE "events.Energy Added", colocated_t1, colocated_t2, colocated_t3;
 RESET citus.shard_count;
```

---

### Incident Patch 7: `18ab646f` (2026-09-25)
**Commit Message**: Stabilize rebalance regression test output (#8858)

Keep tests from failing on harmless output differences:
- Hide DEBUG messages whose order can vary during rebalance scheduling.
- Omit move-task IDs and sort the dependency output, while preserving
  shard IDs and reference-task prerequisites.
- Register the coordinator during the size-query test and remove it
  afterward, avoiding the missing-node message without filtering output.

Test-only changes; no production behavior changes.

Fixes #8847. Addresses the PG17 output failure in #8849;
the separate PG18 failure remains tracked by #8839.

**File**: `src/test/regress/expected/background_rebalance_parallel_reference_tables.out` (modified, +32/-50)
```diff
@@ -206,23 +206,11 @@ SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
  table2_colg3 | 85674021 |          0 | localhost  |      57638 | localhost  |      57639
 (12 rows)
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'force_logical',
     parallel_transfer_colocated_shards := true,
     parallel_transfer_reference_tables := true) \gset
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg1
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg2
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
-DEBUG:  skipping child tables for relation named: table1_colg3
 NOTICE:  Scheduled 6 moves as job xxx
 DETAIL:  Rebalance scheduled as background job
 HINT:  To monitor progress, run: SELECT * FROM citus_rebalance_status();
@@ -269,9 +257,12 @@ SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_o
   17777 |    1013 |       1007
 (24 rows)
 
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -293,7 +284,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
  task_id | command  | depends_on | command
 ---------------------------------------------------------------------
     1001 | 85674025 |       1000 | 85674024
@@ -308,18 +299,18 @@ FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task
     1007 | 85674026 |       1004 | 85674024
     1007 | 85674026 |       1005 | 85674025
     1007 | 85674026 |       1006 | 85674026
-    1008 | 85674001 |       1003 | 85674026
-    1008 | 85674001 |       1007 | 85674026
-    1009 | 85674000 |       1003 | 85674026
-    1009 | 85674000 |       1007 | 85674026
-    1010 | 85674009 |       1003 | 85674026
-    1010 | 85674009 |       1007 | 85674026
-    1011 | 85674008 |       1003 | 85674026
-    1011 | 85674008 |       1007 | 85674026
-    1012 | 85674017 |       1003 | 85674026
-    1012 | 85674017 |       1007 | 85674026
-    1013 | 85674016 |       1003 | 85674026
-    1013 | 85674016 |       1007 | 85674026
+         | 85674000 |       1003 | 85674026
+         | 85674000 |       1007 | 85674026
+         | 85674001 |       1003 | 85674026
+         | 85674001 |       1007 | 85674026
+         | 85674008 |       1003 | 85674026
+         | 85674008 |       1007 | 85674026
+         | 85674009 |       1003 | 85674026
+         | 85674009 |       1007 | 85674026
+         | 85674016 |       1003 | 85674026
+         | 85674016 |       1007 | 85674026
+         | 85674017 |       1003 | 85674026
+         | 85674017 |       1007 | 85674026
 (24 rows)
 
 TRUNCATE pg_dist_background_job CASCADE;

```

**File**: `src/test/regress/expected/shard_rebalancer.out` (modified, +13/-0)
```diff
@@ -2718,6 +2718,13 @@ select create_distributed_table('colocated_t3','a',colocate_with=>'"events.Energ
 
 (1 row)
 
+-- Register the coordinator so cache refreshes do not add missing-node DEBUG messages.
+SELECT 1 FROM master_add_node('localhost', :master_port, groupId => 0);
+ ?column?
+---------------------------------------------------------------------
+        1
+(1 row)
+
 SET client_min_messages TO DEBUG4;
 SELECT * FROM get_rebalance_table_shards_plan('colocated_t1', rebalance_strategy := 'by_disk_size');
 DEBUG:  skipping child tables for relation named: colocated_t1
@@ -2733,6 +2740,12 @@ DEBUG:  Size Query: SELECT (SELECT SUM(worker_partitioned_relation_total_size(re
 (0 rows)
 
 RESET client_min_messages;
+SELECT 1 FROM master_remove_node('localhost', :master_port);
+ ?column?
+---------------------------------------------------------------------
+        1
+(1 row)
+
 DROP TABLE "events.Energy Added", colocated_t1, colocated_t2, colocated_t3;
 RESET citus.shard_count;
 DROP VIEW table_placements_per_node;
```

**File**: `src/test/regress/sql/background_rebalance_parallel_reference_tables.sql` (modified, +12/-6)
```diff
@@ -126,7 +126,7 @@ SELECT 1 FROM citus_add_node('localhost', :worker_4_port);
 
 SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'force_logical',
@@ -142,9 +142,12 @@ SELECT citus_rebalance_wait();
 -- see the dependencies of the tasks scheduled by the background rebalancer
 SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_on;
 
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -166,7 +169,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
 
 
 TRUNCATE pg_dist_background_job CASCADE;
@@ -200,7 +203,7 @@ SELECT 1 FROM citus_add_node('localhost', :worker_6_port);
 
 SELECT * FROM get_rebalance_table_shards_plan() ORDER BY shardid;
 
-SET client_min_messages TO DEBUG1;
+SET client_min_messages TO NOTICE;
 
 SELECT citus_rebalance_start AS job_id from citus_rebalance_start(
     shard_transfer_mode := 'block_writes',
@@ -214,9 +217,12 @@ SELECT citus_rebalance_wait();
 
 -- see the dependencies of the tasks scheduled by the background rebalancer
 SELECT * from pg_dist_background_task_depend ORDER BY job_id, task_id, depends_on;
+-- Omit unstable move task IDs; reference IDs distinguish copies and relationship tasks.
 -- Temporary hack to eliminate SET application name from command until we get the
 -- background job enhancement done.
-SELECT D.task_id,
+SELECT CASE WHEN (SELECT T.command LIKE '%pg_catalog.citus_move_shard_placement%'
+                  FROM pg_dist_background_task T WHERE T.task_id = D.task_id)
+            THEN NULL ELSE D.task_id END AS task_id,
        (SELECT
         CASE
             WHEN T.command LIKE '%citus_internal.citus_internal_copy_single_shard_placement%' THEN
@@ -238,7 +244,7 @@ SELECT D.task_id,
             T.command
        END
        FROM pg_dist_background_task T WHERE T.task_id = D.depends_on)
-FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY D.task_id, D.depends_on ASC;
+FROM pg_dist_background_task_depend D  WHERE job_id in (:job_id) ORDER BY 1, 2, 3, 4;
 
 SELECT
     c.id AS customer_id,
```

**File**: `src/test/regress/sql/shard_rebalancer.sql` (modified, +3/-0)
```diff
@@ -1519,9 +1519,12 @@ select create_distributed_table('colocated_t2','a',colocate_with=>'"events.Energ
 create table colocated_t3 (a int);
 select create_distributed_table('colocated_t3','a',colocate_with=>'"events.Energy Added"');
 
+-- Register the coordinator so cache refreshes do not add missing-node DEBUG messages.
+SELECT 1 FROM master_add_node('localhost', :master_port, groupId => 0);
 SET client_min_messages TO DEBUG4;
 SELECT * FROM get_rebalance_table_shards_plan('colocated_t1', rebalance_strategy := 'by_disk_size');
 RESET client_min_messages;
+SELECT 1 FROM master_remove_node('localhost', :master_port);
 
 DROP TABLE "events.Energy Added", colocated_t1, colocated_t2, colocated_t3;
 RESET citus.shard_count;
```

---

### Incident Patch 8: `a0117f7c` (2026-09-25)
**Commit Message**: Merge branch 'main' into serhatandic-fix-fkey-cache-poisoning

**File**: `.github/workflows/build_and_test.yml` (modified, +6/-3)
```diff
@@ -420,18 +420,21 @@ jobs:
         tests=${detected_changes}
 
         # split the tests to be skipped --today we only skip upgrade tests,
-        # snapshot based node addition tests and the output plugin allowlist
-        # test.
+        # snapshot based node addition tests, non-repeatable pruning tests and
+        # the output plugin allowlist test.
         # split_output_plugin_denied only reports its expected error when the
         # cluster starts without "citus" in output_plugin_libraries, which only
         # the check-split-output-plugin-denied target arranges.
         # snapshot based node addition tests are not flaky, as they promote
         # the streaming replica (clone) to a PostgreSQL primary node that is one way
         # operation
+        # multi_hash_pruning shares a schedule line with multi_join_pruning, which
+        # consumes and drops tables created by multi_partition_pruning. The line
+        # therefore cannot be repeated in the same cluster.
         skipped_tests=""
         not_skipped_tests=""
         for test in $tests; do
-            if [[ $test =~ ^src/test/regress/sql/upgrade_ ]] || [[ $test =~ ^src/test/regress/sql/multi_add_node_from_backup ]] || [[ $test =~ ^src/test/regress/sql/split_output_plugin_denied ]]; then
+            if [[ $test =~ ^src/test/regress/sql/upgrade_ ]] || [[ $test =~ ^src/test/regress/sql/multi_add_node_from_backup ]] || [[ $test =~ ^src/test/regress/sql/multi_(join|hash)_pruning\.sql$ ]] || [[ $test =~ ^src/test/regress/sql/split_output_plugin_denied ]]; then
                 skipped_tests="$skipped_tests $test"
             else
                 not_skipped_tests="$not_skipped_tests $test"
```

**File**: `src/backend/distributed/sql/citus--14.0-1--15.0-1.sql` (modified, +2/-0)
```diff
@@ -31,3 +31,5 @@ DROP FUNCTION IF EXISTS pg_catalog.worker_apply_sequence_command(text, regtype);
 
 -- fix citus_finish_citus_upgrade to always update last_upgrade_version
 #include "udfs/citus_finish_citus_upgrade/15.0-1.sql"
+
+#include "udfs/time_partitions/15.0-1.sql"
```

**File**: `src/backend/distributed/sql/downgrades/citus--15.0-1--14.0-1.sql` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@
 -- The user_catalog_table reloptions set by 15.0-1 are intentionally retained
 -- for PostgreSQL 19 logical decoding; this downgrade requires no SQL for them.
 
+-- Retain the planner-safe time_partitions definition: its columns and the
+-- time_partition_range function contract are unchanged in 14.0-1.
+
 DROP FUNCTION IF EXISTS citus_internal.get_next_colocation_id();
 
 -- re-create the legacy version that we kept for backward compatibility at Citus 13 and 14
```

**File**: `src/backend/distributed/sql/udfs/time_partitions/15.0-1.sql` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+CREATE OR REPLACE VIEW pg_catalog.time_partitions AS
+SELECT partrelid AS parent_table, attname AS partition_column, relid AS partition, lower_bound AS from_value, upper_bound AS to_value, amname AS access_method
+FROM (
+  SELECT partrelid::regclass AS partrelid, attname, c.oid::regclass AS relid, lower_bound, upper_bound, amname
+  FROM pg_class c
+  JOIN pg_inherits i ON (c.oid = inhrelid)
+  JOIN pg_partitioned_table p ON (inhparent = partrelid)
+  JOIN pg_attribute a ON (partrelid = attrelid)
+  JOIN pg_type t ON (atttypid = t.oid)
+  JOIN pg_namespace tn ON (t.typnamespace = tn.oid)
+  LEFT JOIN pg_am am ON (c.relam = am.oid),
+  -- The function may run before the joins, so check the child's parent and
+  -- its partition strategy inside the STRICT function's argument.
+  pg_catalog.time_partition_range(
+    CASE WHEN i.inhparent = p.partrelid AND p.partstrat = 'r' AND p.partnatts = 1
+         THEN i.inhrelid END)
+  WHERE c.relpartbound IS NOT NULL AND p.partstrat = 'r' AND p.partnatts = 1
+  AND a.attnum = ANY(partattrs::int2[])
+) partitions
+ORDER BY partrelid::text, lower_bound;
+
+GRANT SELECT ON pg_catalog.time_partitions TO public;
```

**File**: `src/backend/distributed/sql/udfs/time_partitions/latest.sql` (modified, +6/-3)
```diff
@@ -1,4 +1,4 @@
-CREATE VIEW citus.time_partitions AS
+CREATE OR REPLACE VIEW pg_catalog.time_partitions AS
 SELECT partrelid AS parent_table, attname AS partition_column, relid AS partition, lower_bound AS from_value, upper_bound AS to_value, amname AS access_method
 FROM (
   SELECT partrelid::regclass AS partrelid, attname, c.oid::regclass AS relid, lower_bound, upper_bound, amname
@@ -9,11 +9,14 @@ FROM (
   JOIN pg_type t ON (atttypid = t.oid)
   JOIN pg_namespace tn ON (t.typnamespace = tn.oid)
   LEFT JOIN pg_am am ON (c.relam = am.oid),
-  pg_catalog.time_partition_range(c.oid)
+  -- The function may run before the joins, so check the child's parent and
+  -- its partition strategy inside the STRICT function's argument.
+  pg_catalog.time_partition_range(
+    CASE WHEN i.inhparent = p.partrelid AND p.partstrat = 'r' AND p.partnatts = 1
+         THEN i.inhrelid END)
   WHERE c.relpartbound IS NOT NULL AND p.partstrat = 'r' AND p.partnatts = 1
   AND a.attnum = ANY(partattrs::int2[])
 ) partitions
 ORDER BY partrelid::text, lower_bound;
 
-ALTER VIEW citus.time_partitions SET SCHEMA pg_catalog;
 GRANT SELECT ON pg_catalog.time_partitions TO public;
```

---

### Incident Patch 9: `378c47f4` (2026-09-25)
**Commit Message**: Fix time_partitions errors caused by join reordering (#8843)

DESCRIPTION: Fixes time_partitions errors caused by join reordering

Fixes #8839.

## Summary

`pg_catalog.time_partitions` can call `time_partition_range()` on a
hash/list partition before its range-partition filters run. This is a
production-view defect, not a test-only failure or an ARM64-specific
requirement.

Guard the existing STRICT function's argument with the matching parent,
range strategy, and single-column partition count. The parent-child
equality must be inside CASE: even a parameterized nested-loop plan can
invoke the function before evaluating that join condition.
Strategy/count-only guards still failed in the reproduction.

## Changes

- Update the view and add its `15.0-1` snapshot to the current upgrade
migration.
- Replace the view in place, preserving its identity and dependent
views; retain the compatible definition on downgrade.
- Add transaction-scoped forced-plan coverage after the current-version
upgrade in `multi_extension`, rather than changing `multi_partitioning`,
which also runs against N-1 SQL without the fix.

No C changes, UDF signature changes, relaxed direct-call errors, or CI
planner 

**File**: `src/backend/distributed/sql/citus--14.0-1--15.0-1.sql` (modified, +2/-0)
```diff
@@ -31,3 +31,5 @@ DROP FUNCTION IF EXISTS pg_catalog.worker_apply_sequence_command(text, regtype);
 
 -- fix citus_finish_citus_upgrade to always update last_upgrade_version
 #include "udfs/citus_finish_citus_upgrade/15.0-1.sql"
+
+#include "udfs/time_partitions/15.0-1.sql"
```

**File**: `src/backend/distributed/sql/downgrades/citus--15.0-1--14.0-1.sql` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@
 -- The user_catalog_table reloptions set by 15.0-1 are intentionally retained
 -- for PostgreSQL 19 logical decoding; this downgrade requires no SQL for them.
 
+-- Retain the planner-safe time_partitions definition: its columns and the
+-- time_partition_range function contract are unchanged in 14.0-1.
+
 DROP FUNCTION IF EXISTS citus_internal.get_next_colocation_id();
 
 -- re-create the legacy version that we kept for backward compatibility at Citus 13 and 14
```

**File**: `src/backend/distributed/sql/udfs/time_partitions/15.0-1.sql` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+CREATE OR REPLACE VIEW pg_catalog.time_partitions AS
+SELECT partrelid AS parent_table, attname AS partition_column, relid AS partition, lower_bound AS from_value, upper_bound AS to_value, amname AS access_method
+FROM (
+  SELECT partrelid::regclass AS partrelid, attname, c.oid::regclass AS relid, lower_bound, upper_bound, amname
+  FROM pg_class c
+  JOIN pg_inherits i ON (c.oid = inhrelid)
+  JOIN pg_partitioned_table p ON (inhparent = partrelid)
+  JOIN pg_attribute a ON (partrelid = attrelid)
+  JOIN pg_type t ON (atttypid = t.oid)
+  JOIN pg_namespace tn ON (t.typnamespace = tn.oid)
+  LEFT JOIN pg_am am ON (c.relam = am.oid),
+  -- The function may run before the joins, so check the child's parent and
+  -- its partition strategy inside the STRICT function's argument.
+  pg_catalog.time_partition_range(
+    CASE WHEN i.inhparent = p.partrelid AND p.partstrat = 'r' AND p.partnatts = 1
+         THEN i.inhrelid END)
+  WHERE c.relpartbound IS NOT NULL AND p.partstrat = 'r' AND p.partnatts = 1
+  AND a.attnum = ANY(partattrs::int2[])
+) partitions
+ORDER BY partrelid::text, lower_bound;
+
+GRANT SELECT ON pg_catalog.time_partitions TO public;
```

**File**: `src/backend/distributed/sql/udfs/time_partitions/latest.sql` (modified, +6/-3)
```diff
@@ -1,4 +1,4 @@
-CREATE VIEW citus.time_partitions AS
+CREATE OR REPLACE VIEW pg_catalog.time_partitions AS
 SELECT partrelid AS parent_table, attname AS partition_column, relid AS partition, lower_bound AS from_value, upper_bound AS to_value, amname AS access_method
 FROM (
   SELECT partrelid::regclass AS partrelid, attname, c.oid::regclass AS relid, lower_bound, upper_bound, amname
@@ -9,11 +9,14 @@ FROM (
   JOIN pg_type t ON (atttypid = t.oid)
   JOIN pg_namespace tn ON (t.typnamespace = tn.oid)
   LEFT JOIN pg_am am ON (c.relam = am.oid),
-  pg_catalog.time_partition_range(c.oid)
+  -- The function may run before the joins, so check the child's parent and
+  -- its partition strategy inside the STRICT function's argument.
+  pg_catalog.time_partition_range(
+    CASE WHEN i.inhparent = p.partrelid AND p.partstrat = 'r' AND p.partnatts = 1
+         THEN i.inhrelid END)
   WHERE c.relpartbound IS NOT NULL AND p.partstrat = 'r' AND p.partnatts = 1
   AND a.attnum = ANY(partattrs::int2[])
 ) partitions
 ORDER BY partrelid::text, lower_bound;
 
-ALTER VIEW citus.time_partitions SET SCHEMA pg_catalog;
 GRANT SELECT ON pg_catalog.time_partitions TO public;
```

**File**: `src/test/regress/expected/multi_extension.out` (modified, +22/-0)
```diff
@@ -1873,6 +1873,28 @@ SELECT * FROM multi_extension.print_extension_changes();
  function worker_apply_sequence_command(text,regtype) void        |
 (2 rows)
 
+-- Exercise time_partitions after upgrading to the planner-safe definition.
+-- Keep this here rather than in multi_partitioning, which also runs against N-1 SQL.
+BEGIN;
+CREATE TABLE multi_extension.range_parent (k int) PARTITION BY RANGE (k);
+CREATE TABLE multi_extension.range_child PARTITION OF multi_extension.range_parent FOR VALUES FROM (0) TO (10);
+CREATE TABLE multi_extension.hash_parent (k int) PARTITION BY HASH (k);
+CREATE TABLE multi_extension.hash_child PARTITION OF multi_extension.hash_parent FOR VALUES WITH (MODULUS 1, REMAINDER 0);
+SET LOCAL geqo_threshold = 2;
+SET LOCAL geqo_pool_size = 2;
+SET LOCAL geqo_generations = 1;
+-- EXECUTE replans each query, including join orders that call the function
+-- before matching the child to its parent and applying the partition filters.
+DO $$
+BEGIN
+  FOR seed IN 0..20 LOOP
+    PERFORM set_config('geqo_seed', (seed / 20.0)::text, true);
+    EXECUTE 'SELECT * FROM time_partitions';
+    EXECUTE 'SELECT parent_table, partition_column, partition, from_value, to_value FROM time_partitions';
+  END LOOP;
+END;
+$$;
+ROLLBACK;
 DROP TABLE multi_extension.prev_objects, multi_extension.extension_diff;
 -- show running version
 SHOW citus.version;
```

---

### Incident Patch 10: `3d003c0a` (2026-09-25)
**Commit Message**: Merge branch 'main' into serhatandic-fix-fkey-cache-poisoning

**File**: `src/backend/distributed/planner/multi_physical_planner.c` (modified, +1/-0)
```diff
@@ -668,6 +668,7 @@ BuildJobQuery(MultiNode *multiNode, List *dependentJobList)
 		UpdateAllColumnAttributes((Node *) selectClauseList, rangeTableList,
 								  dependentJobList);
 		UpdateAllColumnAttributes(havingQual, rangeTableList, dependentJobList);
+		AdjustColumnOldAttributes(list_make1(havingQual));
 	}
 
 	/*
```

**File**: `src/test/regress/expected/aggregate_support.out` (modified, +0/-317)
```diff
@@ -1366,322 +1366,5 @@ select min((id,val)::coord) from aggdata;
  (1,2)
 (1 row)
 
--- Non-Var GROUP BY mixed with aggregate in the SAME target entry
--- GROUP BY expression combined with aggregate via concatenation
-SELECT abs(val) + sum(id) AS combined
-FROM aggdata
-GROUP BY abs(val)
-ORDER BY combined;
- combined
----------------------------------------------------------------------
-        6
-        7
-       10
-       10
-       11
-       18
-
-(7 rows)
-
--- GROUP BY expression used as argument alongside aggregate in a function
-SELECT coalesce(abs(val)::text, 'null') || ':' || sum(id)::text AS label
-FROM aggdata
-GROUP BY abs(val)
-ORDER BY label;
-  label
----------------------------------------------------------------------
- 0:11
- 2:4
- 3:4
- 4:6
- 5:5
- 8:10
- null:26
-(7 rows)
-
--- GROUP BY expression in arithmetic with multiple aggregates
-SELECT abs(val) * count(*) + sum(id) AS calc
-FROM aggdata
-GROUP BY abs(val)
-ORDER BY calc;
- calc
----------------------------------------------------------------------
-    7
-    8
-   10
-   10
-   11
-   18
-
-(7 rows)
-
--- Nested function GROUP BY mixed with aggregate
-SELECT floor(abs(val)) + min(id) AS nested_mix
-FROM aggdata
-GROUP BY floor(abs(val))
-ORDER BY nested_mix;
- nested_mix
----------------------------------------------------------------------
-          3
-          7
-         10
-         10
-         11
-         18
-
-(7 rows)
-
--- CASE expression in GROUP BY mixed with aggregate in same target
-SELECT case when val > 3 then 'high' else 'low' end || ':' || sum(id)::text AS bucket_total
-FROM aggdata
-GROUP BY case when val > 3 then 'high' else 'low' end
-ORDER BY bucket_total;
- bucket_total
----------------------------------------------------------------------
- high:21
- low:45
-(2 rows)
-
--- DISTINCT on mixed GROUP BY expression + aggregate
-SELECT DISTINCT abs(val) + sum(id) AS combined
-FROM aggdata
-GROUP BY abs(val)
-ORDER BY combined;
- combined
----------------------------------------------------------------------
-        6
-        7
-       10
-       11
-       18
-
-(6 rows)
-
--- Subquery wrapping a mixed GROUP BY expression + aggregate
-SELECT combined, combined * 2 AS doubled
-FROM (
-    SELECT abs(val) + sum(id) AS combined
-    FROM aggdata
-    GROUP BY abs(val)
-) sub
-ORDER BY combined;
- combined | doubled
----------------------------------------------------------------------
-        6 |      12
-        7 |      14
-       10 |      20
-       10 |      20
-       11 |      22
-       18 |      36
-          |
-(7 rows)
-
--- GROUP BY expr appears both standalone AND mixed with aggregate in same query
-SELECT abs(val) AS av, abs(val) + sum(id) AS mixed
-FROM aggdata
-GROUP BY abs(val)
-ORDER BY av;
- av | mixed
----------------------------------------------------------------------
-  0 |    11
-  2 |     6
-  3 |     7
-  4 |    10
-  5 |    10
-  8 |    18
-    |
-(7 rows)
-
--- Multiple non-Var GROUP BY expressions mixed with aggregate in same target
-SELECT abs(val) + key * 2 + sum(id) AS multi_group
-FROM aggdata
-GROUP BY abs(val), key * 2
-ORDER BY multi_group;
- multi_group
----------------------------------------------------------------------
-           5
-           9
-          11
-          14
-          16
-          29
-          32
-
-
-
-(10 rows)
-
--- HAVING that references a mixed GROUP BY expression + aggregate
-SELECT abs(val) + sum(id) AS combined
-FROM aggdata
-GROUP BY abs(val)
-HAVING abs(val) + sum(id) > 10
-ORDER BY combined;
- combined
----------------------------------------------------------------------
-       11
-       18
-(2 rows)
-
--- Constant in expression
-SELECT abs(val) + 1 + sum(id) - floor(valf) FROM aggdata
-GROUP BY abs(val), floor(valf)
-ORDER BY 1;
- ?column?
----------------------------------------------------------------------
-    -1059
-      -52
-       -7
-        3
-        4
-        6
-       11
-
-
-
-
-(11 rows)
-
--- Count(DISTINCT) (decomposed differently
```

**File**: `src/test/regress/expected/multi_having_pushdown.out` (modified, +77/-0)
```diff
@@ -220,3 +220,80 @@ HAVING max(value_2) > 0 AND count(*) FILTER (WHERE value_3=2) > 3 AND min(value_
    5
 (1 row)
 
+-- HAVING aggregate arguments should preserve their original variable references
+CREATE TABLE having_dist_1 (key boolean);
+CREATE TABLE having_dist_2 (key boolean);
+CREATE TABLE having_ref (value boolean);
+SELECT create_distributed_table('having_dist_1', 'key');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_distributed_table('having_dist_2', 'key');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_reference_table('having_ref');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+INSERT INTO having_dist_1 VALUES (true);
+INSERT INTO having_dist_2 VALUES (true);
+INSERT INTO having_ref VALUES (false), (NULL);
+SELECT having_dist_1.key, having_dist_2.key, having_ref.value
+FROM having_dist_1
+JOIN having_dist_2 ON having_dist_1.key = having_dist_2.key,
+having_ref
+GROUP BY having_dist_1.key, having_dist_2.key, having_ref.value
+HAVING EVERY(having_ref.value);
+ key | key | value
+---------------------------------------------------------------------
+(0 rows)
+
+DROP TABLE having_dist_1;
+DROP TABLE having_dist_2;
+DROP TABLE having_ref;
+-- HAVING FILTER expressions should preserve their original variable references
+CREATE TABLE having_int_dist_1 (key int);
+CREATE TABLE having_int_dist_2 (key int);
+CREATE TABLE having_filter_ref (value boolean);
+SELECT create_distributed_table('having_int_dist_1', 'key');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_distributed_table('having_int_dist_2', 'key');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+SELECT create_reference_table('having_filter_ref');
+ create_reference_table
+---------------------------------------------------------------------
+
+(1 row)
+
+INSERT INTO having_int_dist_1 VALUES (1);
+INSERT INTO having_int_dist_2 VALUES (1);
+INSERT INTO having_filter_ref VALUES (true), (false), (NULL);
+SELECT having_int_dist_1.key, having_int_dist_2.key, having_filter_ref.value
+FROM having_int_dist_1
+JOIN having_int_dist_2 ON having_int_dist_1.key = having_int_dist_2.key,
+having_filter_ref
+GROUP BY having_int_dist_1.key, having_int_dist_2.key, having_filter_ref.value
+HAVING count(*) FILTER (WHERE having_filter_ref.value) > 0;
+ key | key | value
+---------------------------------------------------------------------
+      1 |   1 | t
+(1 row)
+
+DROP TABLE having_int_dist_1;
+DROP TABLE having_int_dist_2;
+DROP TABLE having_filter_ref;
```

**File**: `src/test/regress/expected/non_var_group_by.out` (added, +346/-0)
```diff
@@ -0,0 +1,346 @@
+--
+-- NON_VAR_GROUP_BY
+--
+CREATE SCHEMA non_var_group_by;
+SET search_path TO non_var_group_by;
+SET citus.next_shard_id TO 83674000;
+CREATE TABLE aggdata (id int, key int, val int, valf float8);
+SELECT create_distributed_table('aggdata', 'id');
+ create_distributed_table
+---------------------------------------------------------------------
+
+(1 row)
+
+INSERT INTO aggdata (id, key, val, valf) VALUES
+	(1, 1, 2, 11.2),
+	(2, 1, NULL, 2.1),
+	(3, 2, 2, 3.22),
+	(4, 2, 3, 4.23),
+	(5, 2, 5, 5.25),
+	(6, 3, 4, 63.4),
+	(7, 5, NULL, 75),
+	(8, 6, NULL, NULL),
+	(9, 6, NULL, 96),
+	(10, 7, 8, 1078),
+	(11, 9, 0, 1.19);
+-- Non-Var GROUP BY mixed with aggregate in the same target entry
+-- GROUP BY expression combined with aggregate via concatenation
+SELECT abs(val) + sum(id) AS combined
+FROM aggdata
+GROUP BY abs(val)
+ORDER BY combined;
+ combined
+---------------------------------------------------------------------
+        6
+        7
+       10
+       10
+       11
+       18
+
+(7 rows)
+
+-- GROUP BY expression used as argument alongside aggregate in a function
+SELECT coalesce(abs(val)::text, 'null') || ':' || sum(id)::text AS label
+FROM aggdata
+GROUP BY abs(val)
+ORDER BY label;
+  label
+---------------------------------------------------------------------
+ 0:11
+ 2:4
+ 3:4
+ 4:6
+ 5:5
+ 8:10
+ null:26
+(7 rows)
+
+-- GROUP BY expression in arithmetic with multiple aggregates
+SELECT abs(val) * count(*) + sum(id) AS calc
+FROM aggdata
+GROUP BY abs(val)
+ORDER BY calc;
+ calc
+---------------------------------------------------------------------
+    7
+    8
+   10
+   10
+   11
+   18
+
+(7 rows)
+
+-- Nested function GROUP BY mixed with aggregate
+SELECT floor(abs(val)) + min(id) AS nested_mix
+FROM aggdata
+GROUP BY floor(abs(val))
+ORDER BY nested_mix;
+ nested_mix
+---------------------------------------------------------------------
+          3
+          7
+         10
+         10
+         11
+         18
+
+(7 rows)
+
+-- CASE expression in GROUP BY mixed with aggregate in same target
+SELECT case when val > 3 then 'high' else 'low' end || ':' || sum(id)::text AS bucket_total
+FROM aggdata
+GROUP BY case when val > 3 then 'high' else 'low' end
+ORDER BY bucket_total;
+ bucket_total
+---------------------------------------------------------------------
+ high:21
+ low:45
+(2 rows)
+
+-- DISTINCT on mixed GROUP BY expression + aggregate
+SELECT DISTINCT abs(val) + sum(id) AS combined
+FROM aggdata
+GROUP BY abs(val)
+ORDER BY combined;
+ combined
+---------------------------------------------------------------------
+        6
+        7
+       10
+       11
+       18
+
+(6 rows)
+
+-- Subquery wrapping a mixed GROUP BY expression + aggregate
+SELECT combined, combined * 2 AS doubled
+FROM (
+	SELECT abs(val) + sum(id) AS combined
+	FROM aggdata
+	GROUP BY abs(val)
+) sub
+ORDER BY combined;
+ combined | doubled
+---------------------------------------------------------------------
+        6 |      12
+        7 |      14
+       10 |      20
+       10 |      20
+       11 |      22
+       18 |      36
+          |
+(7 rows)
+
+-- GROUP BY expr appears both standalone AND mixed with aggregate in same query
+SELECT abs(val) AS av, abs(val) + sum(id) AS mixed
+FROM aggdata
+GROUP BY abs(val)
+ORDER BY av;
+ av | mixed
+---------------------------------------------------------------------
+  0 |    11
+  2 |     6
+  3 |     7
+  4 |    10
+  5 |    10
+  8 |    18
+    |
+(7 rows)
+
+-- Multiple non-Var GROUP BY expressions mixed with aggregate in same target
+SELECT abs(val) + key * 2 + sum(id) AS multi_group
+FROM aggdata
+GROUP BY abs(val), key * 2
+ORDER BY multi_group;
+ multi_group
+---------------------------------------------------------------------
+           5
+           9
+          11
+          14
+          16
+          29
+          32
+
+
+
+(10 rows)
+
+-- HAVING that references a mixed GROUP BY expression + aggregate
+SELECT abs(val) + sum(id) AS combined

```

**File**: `src/test/regress/multi_1_create_citus_schedule` (modified, +8/-0)
```diff
@@ -102,3 +102,11 @@ test: multi_transaction_recovery_multiple_databases
 # These tests are kept here to prevent N-1 test failures for the features that are
 # not present in the minor version.
 # ---------------------------------------------------------------------------------
+
+# ----------
+# non_var_group_by covers planner behavior introduced in 14.3; not present in
+# the N-1 (14.2-1) coordinator library. Run it only under
+# check-multi-1-create-citus, which is not part of the N-1 test matrix. Move
+# back to multi_schedule at Citus 15.
+# ----------
+test: non_var_group_by
```

#### Recent Merged Pull Requests:
- **PR #8883** (2026-09-28): Fetch tuples in small batches in adaptive executor where possible (#5… (@colm-mchugh)
- **PR #8882** (2026-09-28): Automated security dependency sync from Dependabot alerts (@cituspackagingapp[bot])
- **PR #8881** (2026-09-28): Use stable PG19 Beta 4 images and refresh reindexed metadata (@ihalatci)
- **PR #8877** (2026-09-25): Fix local plan cache growth for prepared statements (#8824) (@colm-mchugh)
- **PR #8875** (2026-09-28): Backport sorted merge PRs to release-14 (@colm-mchugh)
- **PR #8873** (2026-09-29): Qualify and quote the support function in ALTER FUNCTION .. SUPPORT (@breken-ai)
- **PR #8872** (2026-09-29): Quote the tablespace name in REINDEX commands sent to shards (@breken-ai)
- **PR #8871** (2026-09-25): Backport memory bug fixes (@colm-mchugh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
