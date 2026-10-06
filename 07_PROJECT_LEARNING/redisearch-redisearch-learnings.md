# Forensic Learning Record (Deep Inspection): RediSearch/RediSearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:54:00.812Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RediSearch/RediSearch`
- **Description**: A query and indexing engine for Redis, providing secondary indexing, full-text search, vector similarity search and aggregations.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6243 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `deps/rmutil/alloc.c`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#include "alloc.h"

#include <string.h>
#include <stdlib.h>

/*
 * Re-patching RedisModule_Alloc and friends to the original malloc functions
 *
 * This function shold be called if you are working with malloc-patched code
 * ouside of redis, usually for unit tests. Call it once when entering your unit
 * tests' main().
 *
 * Since including "alloc.h" while defining REDIS_MODULE_TARGET
 * replaces all malloc functions in redis with the RM_Alloc family of functions,
 * when running that code outside of redis, your app will crash. This function
 * patches the RM_Alloc functions back to the original mallocs. */

void RMUTil_InitAlloc() {
  RedisModule_Alloc = malloc;
  RedisModule_Realloc = realloc;
  RedisModule_Calloc = calloc;
  RedisModule_Free = free;
  RedisModule_Strdup = strdup;
}

```

### Core Architecture Module: `deps/rmutil/alloc.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef __RMUTIL_ALLOC__
#define __RMUTIL_ALLOC__

/* Automatic Redis Module Allocation functions monkey-patching.
 *
 * Including this file while REDIS_MODULE_TARGET is defined, will explicitly
 * override malloc, calloc, realloc & free with RedisModule_Alloc,
 * RedisModule_Callc, etc implementations, that allow Redis better control and
 * reporting over allocations per module.
 *
 * You should include this file in all c files AS THE LAST INCLUDED FILE
 *
 * This only has effect when when compiling with the macro REDIS_MODULE_TARGET
 * defined. The idea is that for unit tests it will not be defined, but for the
 * module build target it will be.
 *
 */

#ifdef REDIS_MODULE_TARGET /* Set this when compiling your code as a module */

#include "redismodule.h"
#include "rmalloc.h"

#else

#endif // REDIS_MODULE_TARGET

// This function shold be called if you are working with malloc-patched code
// ouside of redis, usually for unit tests.
// Call it once when entering your unit tests' main().

void RMUTil_InitAlloc();

#endif // __RMUTIL_ALLOC__

```

### Core Architecture Module: `deps/rmutil/args.c`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#include "args.h"
#include "redismodule.h"
#include <float.h>
#include <math.h>
#include <string.h>
#include <assert.h>

int AC_Equals(ArgsCursor *first_, ArgsCursor *second_) {
  if (AC_NumRemaining(first_) != AC_NumRemaining(second_)) {
    return 0;
  }
  ArgsCursor first = *first_, second = *second_;
  while (!AC_IsAtEnd(&first)) {
    size_t f_len, s_len;
    const char *f_cur = AC_GetStringNC(&first, &f_len), *s_cur = AC_GetStringNC(&second, &s_len);
    if (f_len != s_len || strcmp(f_cur, s_cur)) {
      return 0;
    }
  }
  return 1;
}

int AC_Advance(ArgsCursor *ac) {
  return AC_AdvanceBy(ac, 1);
}

int AC_AdvanceBy(ArgsCursor *ac, size_t by) {
  if (ac->offset + by > ac->argc) {
    return AC_ERR_NOARG;
  } else {
    ac->offset += by;
  }
  return AC_OK;
}

int AC_AdvanceIfMatch(ArgsCursor *ac, const char *s) {
  const char *cur;
  if (AC_IsAtEnd(ac)) {
    return 0;
  }

  int rv = AC_GetString(ac, &cur, NULL, AC_F_NOADVANCE);
  assert(rv == AC_OK);
  rv = !strcasecmp(s, cur);
  if (rv) {
    AC_Advance(ac);
  }
  return rv;
}

#define MAYBE_ADVANCE()            \
  if (!(flags & AC_F_NOADVANCE)) { \
    AC_Advance(ac);                \
  }

static int tryReadAsDouble(ArgsCursor *ac, long long *ll, int flags) {
  double dTmp = 0.0;
  if (AC_GetDouble(ac, &dTmp, flags | AC_F_NOADVANCE) != AC_OK) {
    return AC_ERR_PARSE;
  }
  // Casting a double outside [LLONG_MIN, 2^63) to long long is UB, and the
  // RString conversion accepts literal "inf" — reject NaN and handle the
  // range before any cast. (double)LLONG_MAX rounds up to exactly 2^63,
  // making it the correct exclusive bound.
  if (isnan(dTmp)) {
    return AC_ERR_PARSE;
  }
  if (flags & AC_F_COALESCE) {
    // Coalescing coerces: saturate out-of-range values (inf included)
    if (dTmp >= (double)LLONG_MAX) {
      *ll = LLONG_MAX;
    } else if (dTmp < (double)LLONG_MIN) {
      *ll = LLONG_MIN;
    } else {
      *ll = dTmp;
    }
    return AC_OK;
  }

  // Non-coalescing: out-of-range values cannot survive the integral round-trip
  if (!(dTmp >= (double)LLONG_MIN && dTmp < (double)LLONG_MAX)) {
    return AC_ERR_PARSE;
  }
  if ((double)(long long)dTmp != dTmp) {
    return AC_ERR_PARSE;
  } else {
    *ll = dTmp;
    return AC_OK;
  }
}

int AC_GetLongLong(ArgsCursor *ac, long long *ll, int flags) {
  long long tmpll = 0;
  if (ac->offset == ac->argc) {
    return AC_ERR_NOARG;
  }

  int hasErr = 0;
  // Try to parse the number as a normal integer first. If that fails, try
  // to parse it as a double. This will work if the number is in the format of
  // 3.00, OR if the number is in the format of 3.14 *AND* AC_F_COALESCE is set.
  // Here and in AC_GetDouble: RSTRING cursors carry user command argv and use
  // the strict RedisModule conversions; the char* branches keep C-library
  // leniency and only ever see internally generated canonical tokens.
  if (ac->type == AC_TYPE_RSTRING) {
    if (RedisModule_StringToLongLong(AC_CURRENT(ac), &tmpll) == REDISMODULE_ERR) {
      hasErr = 1;
    }
  } else {
    char *endptr = AC_CURRENT(ac);
    tmpll = strtoll(AC_CURRENT(ac), &endptr, 10);
    if (*endptr != '\0' || tmpll == LLONG_MIN || tmpll == LLONG_MAX) {
      hasErr = 1;
    }
  }

  if (hasErr && tryReadAsDouble(ac, &tmpll, flags) != AC_OK) {
    return AC_ERR_PARSE;
  }

  if ((flags & AC_F_GE0) && tmpll < 0) {
    return AC_ERR_ELIMIT;
  }
  // Do validation
  if ((flags & AC_F_GE1) && tmpll < 1) {
    return AC_ERR_ELIMIT;
  }
  MAYBE_ADVANCE();
  *ll = tmpll;
  return AC_OK;
}

#define GEN_AC_FUNC(name, T, minVal, maxVal, isUnsigned)      \
  int name(ArgsCursor *ac, T *p, int flags) {                 \
    if (isUnsigned) {                                         \
      flags |= AC_F_GE0;                                      \
    }                                                         \
    long long ll;                                             \
    int rv = AC_GetLongLong(ac, &ll, flags | AC_F_NOADVANCE); \
    if (rv) {                                                 \
      return rv;                                              \
    }                                                         \
    if (ll > maxVal || ll < minVal) {                         \
      return AC_ERR_ELIMIT;                                   \
    }                                                         \
    *p = ll;                                                  \
    MAYBE_ADVANCE();                                          \
    return AC_OK;                                             \
  }

GEN_AC_FUNC(AC_GetUnsignedLongLong, unsigned long long, 0, LLONG_MAX, 1)
GEN_AC_FUNC(AC_GetUnsigned, unsigned, 0, UINT_MAX, 1)
GEN_AC_FUNC(AC_GetInt, int, INT_MIN, INT_MAX, 0)
GEN_AC_FUNC(AC_GetU8, uint8_t, 0, UINT8_MAX, 1)
GEN_AC_FUNC(AC_GetU16, uint16_t, 0, UINT16_MAX, 1)
GEN_AC_FUNC(AC_GetU32, uint32_t, 0, UINT32_MAX, 1)
GEN_AC_FUNC(AC_GetU64, uint64_t, 0, UINT64_MAX, 1)
GEN_AC_FUNC(AC_GetSize, size_t, 0, SIZE_MAX, 1)

int AC_GetDouble(ArgsCursor *ac, double *d, int flags) {
  double tmpd = 0;
  if (ac->type == AC_TYPE_RSTRING) {
    if (RedisModule_StringToDouble(ac->objs[ac->offset], &tmpd) != REDISMODULE_OK) {
      return AC_ERR_PARSE;
    }
  } else {
    char *endptr = AC_CURRENT(ac);
    tmpd = strtod(AC_CURRENT(ac), &endptr);
    if (*endptr != '\0' || tmpd == HUGE_VAL || tmpd == -HUGE_VAL) {
      return AC_ERR_PARSE;
    }
  }
  if ((flags & AC_F_GE0) && tmpd < 0.0) {
    return AC_ERR_ELIMIT;
  }
  if ((flags & AC_F_GE1) && tmpd < 1.0) {
    return AC_ERR_ELIMIT;
  }
  MAYBE_ADVANCE();
  *d = tmpd;
  return AC_OK;
}

int AC_GetRString(ArgsCursor *ac, RedisModuleString **s, int flags) {
  assert(ac->type == AC_TYPE_RSTRING);
  if (ac->offset == ac->argc) {
    return AC_ERR_NOARG;
  }
  *s = AC_CURRENT(ac);
  MAYBE_ADVANCE();
  return AC_OK;
}

int AC_GetString(ArgsCursor *ac, const char **s, size_t *n, int flags) {
  if (ac->offset == ac->argc) {
    return AC_ERR_NOARG;
  }
  if (ac->type == AC_TYPE_RSTRING) {
    *s = RedisModule_StringPtrLen(AC_CURRENT(ac), n);
  } else {
    *s = AC_CURRENT(ac);
    if (n) {
      if (ac->type == AC_TYPE_SDS) {
        *n = sdslen((const sds)*s);
      } else {
        *n = strlen(*s);
      }
    }
  }
  MAYBE_ADVANCE();
  return AC_OK;
}

const char *AC_GetStringNC(ArgsCursor *ac, size_t *len) {
  const char *s = NULL;
  if (AC_GetString(ac, &s, len, 0) != AC_OK) {
    return NULL;
  }
  return s;
}

int AC_GetVarArgs(ArgsCursor *ac, ArgsCursor *dst) {
  unsigned nargs;
  int rv = AC_GetUnsigned(ac, &nargs, 0);
  if (rv != AC_OK) {
    return rv;
  }
  return AC_GetSlice(ac, dst, nargs);
}

int AC_GetSlice(ArgsCursor *ac, ArgsCursor *dst, size_t n) {
  if (n > AC_NumRemaining(ac)) {
    return AC_ERR_NOARG;
  }

  dst->objs = ac->objs + ac->offset;
  dst->argc = n;
  dst->offset = 0;
  dst->type = ac->type;
  AC_AdvanceBy(ac, n);
  return 0;
}

static int parseSingleSpec(ArgsCursor *ac, ACArgSpec *spec) {
  switch (spec->type) {
    case AC_ARGTYPE_BOOLFLAG:
      *(int *)spec->target = 1;
      return AC_OK;
    case AC_ARGTYPE_BITFLAG:
      *(uint32_t *)(spec->target) |= spec->slicelen;
      return AC_OK;
    case AC_ARGTYPE_UNFLAG:
      *(uint32_t *)spec->target &= ~spec->slicelen;
      return AC_OK;
    case AC_ARGTYPE_DOUBLE:
      return AC_GetDouble(ac, spec->target, spec->intflags);
    case AC_ARGTYPE_INT:
      return AC_GetInt(ac, spec->target, spec->intflags);
    case AC_ARGTYPE_LLONG:
      return AC_GetLongLong(ac, spec->target, spec->intflags);
    case AC_ARGTYPE_ULLONG:
      return AC_GetUnsignedLongLong(ac, spec->target, spec->intflags);
    case AC_ARGTYPE_UINT:
      return AC_GetUnsigned(ac, spec->target, spec->intflags);
    case AC_ARGTYPE_STRING:
      return AC_GetString(ac, spec->target, spec->len, 0);
    case AC_ARGTYPE_RSTRING:
      return AC_GetRString(ac, spec->target, 0);
    case AC_ARGTYPE_SUBARGS:
      return AC_GetVarArgs(ac, spec->target);
    case AC_ARGTYPE_SUBARGS_N:
      return AC_GetSlice(ac, spec->target, spec->slicelen);
    default:
      fprintf(stderr, "Unknown type");
      abort();
  }
}

int AC_ParseArgSpec(ArgsCursor *ac, ACArgSpec *specs, ACArgSpec **errSpec) {
  const char *s = NULL;
  size_t n;
  int rv;

  if (errSpec) {
    *errSpec = NULL;
  }

  while (!AC_IsAtEnd(ac)) {
    if ((rv = AC_GetString(ac, &s, &n, AC_F_NOADVANCE) != AC_OK)) {
      return rv;
    }
    ACArgSpec *cur = specs;

    for (; cur->name != NULL; cur++) {
      if (n != strlen(cur->name)) {
        continue;
      }
      if (!strncasecmp(cur->name, s, n)) {
        break;
      }
    }

    if (cur->name == NULL) {
      return AC_ERR_ENOENT;
    }

    AC_Advance(ac);
    if ((rv = parseSingleSpec(ac, cur)) != AC_OK) {
      if (errSpec) {
        *errSpec = cur;
      }
      return rv;
    }
  }
  return AC_OK;
}

```

### Core Architecture Module: `deps/rmutil/args.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef RMUTIL_ARGS_H
#define RMUTIL_ARGS_H

#include <stdlib.h>
#include <limits.h>
#include <stdint.h>
#include <string.h>
#include "hiredis/sds.h"
#include "redismodule.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
  AC_TYPE_UNINIT = 0,  // Comment for formatting
  AC_TYPE_RSTRING,
  AC_TYPE_CHAR,
  AC_TYPE_SDS
} ACType;

#define AC_IsInitialized(ac) ((ac)->type != AC_TYPE_UNINIT)

/**
 * The cursor model simply reads through the current argument list, advancing
 * the 'offset' position as required. No tricky declarative syntax, and allows
 * for finer grained error handling.
 */
typedef struct {
  void **objs;
  int type;
  size_t argc;
  size_t offset;
} ArgsCursor;

static inline void ArgsCursor_InitCString(ArgsCursor *cursor, const char **argv, int argc) {
  cursor->objs = (void **)argv;
  cursor->type = AC_TYPE_CHAR;
  cursor->offset = 0;
  cursor->argc = argc;
}

static inline void ArgsCursor_InitSDS(ArgsCursor *cursor, const sds *argv, int argc) {
  cursor->objs = (void **)argv;
  cursor->type = AC_TYPE_SDS;
  cursor->offset = 0;
  cursor->argc = argc;
}

static inline void ArgsCursor_InitRString(ArgsCursor *cursor, RedisModuleString **argv, int argc) {
  cursor->objs = (void **)argv;
  cursor->type = AC_TYPE_RSTRING;
  cursor->offset = 0;
  cursor->argc = argc;
}

typedef enum {
  AC_OK = 0,      // Not an error
  AC_ERR_PARSE,   // Couldn't parse as integer or other type
  AC_ERR_NOARG,   // Missing required argument
  AC_ERR_ELIMIT,  // Exceeded limitations of this type (i.e. bad value, but parsed OK)
  AC_ERR_ENOENT   // Argument name not found in list
} ACStatus;

// These flags can be AND'd with the original type
#define AC_F_GE1 0x100        // Must be >= 1 (no zero or negative)
#define AC_F_GE0 0x200        // Must be >= 0 (no negative)
#define AC_F_NOADVANCE 0x400  // Don't advance cursor position
#define AC_F_COALESCE 0x800   // Coalesce non-integral input

// These functions return AC_OK or an error code on error. Note that the
// output value is not guaranteed to remain untouched in the case of an error
int AC_GetString(ArgsCursor *ac, const char **s, size_t *n, int flags);
int AC_GetRString(ArgsCursor *ac, RedisModuleString **s, int flags);
int AC_GetLongLong(ArgsCursor *ac, long long *ll, int flags);
int AC_GetUnsignedLongLong(ArgsCursor *ac, unsigned long long *ull, int flags);
int AC_GetUnsigned(ArgsCursor *ac, unsigned *u, int flags);
int AC_GetInt(ArgsCursor *ac, int *i, int flags);
int AC_GetDouble(ArgsCursor *ac, double *d, int flags);
int AC_GetU8(ArgsCursor *ac, uint8_t *u, int flags);
int AC_GetU16(ArgsCursor *ac, uint16_t *u, int flags);
int AC_GetU32(ArgsCursor *ac, uint32_t *u, int flags);
int AC_GetU64(ArgsCursor *ac, uint64_t *u, int flags);
int AC_GetSize(ArgsCursor *ac, size_t *sz, int flags);

// Returns 1 if the cursors are at an equal state (same number of args left, same args), 0 otherwise.
// Comparison is case sensitive and done directly on the strings. This function is not suitable for comparing numbers.
// (e.g. "1" != "01")
int AC_Equals(ArgsCursor *first, ArgsCursor *second);

// Gets the string (and optionally the length). If the string does not exist,
// it returns NULL. Used when caller is sure the arg exists
const char *AC_GetStringNC(ArgsCursor *ac, size_t *len);

int AC_Advance(ArgsCursor *ac);
int AC_AdvanceBy(ArgsCursor *ac, size_t by);

// Advances the cursor if the next argument matches the given string. This
// will swallow it up.
int AC_AdvanceIfMatch(ArgsCursor *ac, const char *arg);

/**
 * Read the argument list in the format of
 * <NUM_OF_ARGS> <ARG[1]> <ARG[2]> .. <ARG[NUM_OF_ARGS]>
 * The output is stored in dest which contains a sub-array of argv/argc
 */
int AC_GetVarArgs(ArgsCursor *ac, ArgsCursor *dest);

/**
 * Consume the next <n> arguments and place them in <dest>
 */
int AC_GetSlice(ArgsCursor *ac, ArgsCursor *dest, size_t n);

typedef enum {
  AC_ARGTYPE_STRING,
  AC_ARGTYPE_RSTRING,
  AC_ARGTYPE_LLONG,
  AC_ARGTYPE_ULLONG,
  AC_ARGTYPE_UINT,
  AC_ARGTYPE_U32 = AC_ARGTYPE_UINT,
  AC_ARGTYPE_INT,
  AC_ARGTYPE_DOUBLE,
  /**
   * This means the name is a flag and does not accept any additional arguments.
   * In this case, the target value is assumed to be an int, and is set to
   * nonzero
   */
  AC_ARGTYPE_BOOLFLAG,

  /**
   * Uses AC_GetVarArgs, gets a sub-arg list
   */
  AC_ARGTYPE_SUBARGS,

  /**
   * Use AC_GetSlice. Set slicelen in the spec to the expected count.
   */
  AC_ARGTYPE_SUBARGS_N,

  /**
   * Accepts U32 target. Use 'slicelen' as the field to indicate which bit should
   * be set.
   */
  AC_ARGTYPE_BITFLAG,

  /**
   * Like bitflag, except the value is _removed_ from the target. Accepts U32 target
   */
  AC_ARGTYPE_UNFLAG,
} ACArgType;

/**
 * Helper macro to define bitflag argtype
 */
#define AC_MKBITFLAG(name_, target_, bit_) \
  .name = name_, .target = target_, .type = AC_ARGTYPE_BITFLAG, .slicelen = bit_

#define AC_MKUNFLAG(name_, target_, bit_) \
  .name = name_, .target = target_, .type = AC_ARGTYPE_UNFLAG, .slicelen = bit_

typedef struct {
  const char *name;  // Name of the argument
  void *target;      // [out] Target pointer, e.g. `int*`, `RedisModuleString**`
  size_t *len;       // [out] Target length pointer. Valid only for strings
  ACArgType type;    // Type of argument
  int intflags;      // AC_F_COALESCE, etc.
  size_t slicelen;   // When using slice length, set this to the expected slice count
} ACArgSpec;

/**
 * Utilizes the argument cursor to traverse a list of known argument specs. This
 * function will return:
 * - AC_OK if the argument parsed successfully
 * - AC_ERR_ENOENT if an argument not mentioned in `specs` is encountered.
 * - Any other error is assumed to be a parser error, in which the argument exists
 *   but did not meet constraints of the type
 *
 * Note that ENOENT is not a 'hard' error. It simply means that the argument
 * was not provided within the list. This may be intentional if, for example,
 * it requires complex processing.
 */
int AC_ParseArgSpec(ArgsCursor *ac, ACArgSpec *specs, ACArgSpec **errSpec);

static inline const char *AC_Strerror(int code) {
  switch (code) {
    case AC_OK:
      return "SUCCESS";
    case AC_ERR_ELIMIT:
      return "Value is outside acceptable bounds";
    case AC_ERR_NOARG:
      return "Expected an argument, but none provided";
    case AC_ERR_PARSE:
      return "Could not convert argument to expected type";
    case AC_ERR_ENOENT:
      return "Unknown argument";
    default:
      return "(AC: You should not be seeing this message. This is a bug)";
  }
}

#define AC_CURRENT(ac) ((ac)->objs[(ac)->offset])
#define AC_Clear(ac)  // NOOP
#define AC_IsAtEnd(ac) ((ac)->offset >= (ac)->argc)
#define AC_NumRemaining(ac) ((ac)->argc - (ac)->offset)
#define AC_NumArgs(ac) (ac)->argc

/* Return the N'th argument as a C string, for any cursor type. `len` is
 * optional. (A blind `objs[N]` cast is only valid for C-string/sds cursors —
 * an RString cursor's objs are RedisModuleString pointers.) */
static inline const char *AC_StringArg(const ArgsCursor *ac, size_t n, size_t *len) {
  if (ac->type == AC_TYPE_RSTRING) {
    return RedisModule_StringPtrLen((RedisModuleString *)ac->objs[n], len);
  }
  const char *s = (const char *)ac->objs[n];
  if (len) {
    *len = ac->type == AC_TYPE_SDS ? sdslen((sds)s) : strlen(s);
  }
  return s;
}
#ifdef __cplusplus
}

#include <vector>
#include <tuple>
#include <type_traits>
#include <array>
class ArgsCursorCXX : public ArgsCursor {
 public:
  template <typename... T>
  ArgsCursorCXX(T... args) {
    typedef typename std::tuple_element<0, std::tuple<T...>>::type FirstType;
    typedef const typename std::remove_pointer<FirstType>::type *ConstPointerType;
    typedef typename std::conditional<std::is_pointer<FirstType>::value, ConstPointerType,
                                      FirstType>::type RealType;
    std::array<const void *, sizeof...(args)> stackarr = {{args...}};
    arr.assign(stackarr.begin(), stackarr.end());
    RealType *arrptr = (RealType *)(&arr[0]);
    init(&arrptr[0], arr.size());
  }

  void append(void *p) {
    arr.push_back(p);
    objs = (void **)&arr[0];
    argc = arr.size();
  }

 private:
  std::vector<const void *> arr;
  void init(const char **s, size_t n) {
    ArgsCursor_InitCString(this, s, n);
  }
  void init(RedisModuleString **s, size_t n) {
    ArgsCursor_InitRString(this, s, n);
  }
};
#endif
#endif

```

### Core Architecture Module: `deps/rmutil/cmdparse.c`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#include "cmdparse.h"
#include "alloc.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <limits.h>
#include <errno.h>
#include <ctype.h>
#include <inttypes.h>
#include <math.h>
#include <stdarg.h>

#define __ignore__(X) \
    do { \
        int rc = (X); \
        if (rc == -1) \
            ; \
    } while(0)

int CmdString_CaseEquals(CmdString *str, const char *other) {
  if (!str || !other) return 0;
  size_t l = strlen(other);
  if (l != str->len) return 0;

  return !strncasecmp(str->str, other, l);
}

#define pad(depth)                                   \
  {                                                  \
    for (int pd = 0; pd < depth; pd++) putchar(' '); \
  }

void CmdArg_Print(CmdArg *n, int depth) {
  pad(depth);
  switch (n->type) {
    case CmdArg_Integer:
      printf("%" PRId64, n->i);
      break;
    case CmdArg_Double:
      printf("%f", n->d);
      break;
    case CmdArg_String:
      printf("\"%.*s\"", (int)n->s.len, n->s.str);
      break;
    case CmdArg_Array:
      printf("[");
      for (int i = 0; i < n->a.len; i++) {
        CmdArg_Print(n->a.args[i], 0);
        if (i < n->a.len - 1) printf(",");
      }
      printf("]");
      break;
    case CmdArg_Object:
      printf("{\n");
      for (int i = 0; i < n->a.len; i++) {
        pad(depth + 2);
        printf("%s: =>", n->obj.entries[i].k);
        CmdArg_Print(n->obj.entries[i].v, depth + 2);
        printf("\n");
      }
      pad(depth);
      printf("}\n");
      break;
    case CmdArg_Flag:
      printf(n->b ? "TRUE" : "FALSE");
      break;
    case CmdArg_NullPtr:
      printf("NULL");
      break;
  }
}
static inline CmdArg *NewCmdArg(CmdArgType t) {
  CmdArg *ret = malloc(sizeof(CmdArg));

  ret->type = t;
  return ret;
}

static CmdArg *NewCmdString(const char *s, size_t len) {
  CmdArg *ret = NewCmdArg(CmdArg_String);
  ret->s = (CmdString){.str = strdup(s), .len = len};
  return ret;
}

static CmdArg *NewCmdInteger(long long i) {
  CmdArg *ret = NewCmdArg(CmdArg_Integer);
  ret->i = i;
  return ret;
}

static CmdArg *NewCmdDouble(double d) {
  CmdArg *ret = NewCmdArg(CmdArg_Double);
  ret->d = d;
  return ret;
}

static CmdArg *NewCmdFlag(int val) {
  CmdArg *ret = NewCmdArg(CmdArg_Flag);
  ret->b = val;
  return ret;
}

static CmdArg *NewCmdArray(size_t cap) {
  CmdArg *ret = NewCmdArg(CmdArg_Array);
  ret->a.cap = cap;
  ret->a.len = 0;
  ret->a.args = rm_calloc(cap, sizeof(CmdArg *));

  return ret;
}

static CmdArg *NewCmdObject(size_t cap) {
  CmdArg *ret = NewCmdArg(CmdArg_Object);
  ret->obj = (CmdObject){
      .entries = rm_calloc(cap, sizeof(CmdKeyValue)),
      .cap = cap,
      .len = 0,
  };

  return ret;
}

/* return 1 if a flag with a given name exists in parent and is set to true */
int CmdArg_GetFlag(CmdArg *parent, const char *flag) {
  CmdArg *f = CmdArg_FirstOf(parent, flag);
  if (f && f->type == CmdArg_Flag) {
    return f->b;
  }
  return 0;
}

void CmdArg_Free(CmdArg *arg) {
  switch (arg->type) {
    case CmdArg_String:
      free(arg->s.str);
      break;
    case CmdArg_Object:
      for (size_t i = 0; i < arg->obj.len; i++) {
        CmdArg_Free(arg->obj.entries[i].v);
      }
      free(arg->obj.entries);
      break;
    case CmdArg_Array:
      for (size_t i = 0; i < arg->a.len; i++) {
        CmdArg_Free(arg->a.args[i]);
      }
      free(arg->a.args);
      break;
    default:
      break;
  }
  free(arg);
}

static int CmdObj_Set(CmdObject *obj, const char *key, CmdArg *val, int unique) {

  // if we enforce uniqueness, fail on duplicate records
  if (unique) {
    for (size_t i = 0; i < obj->len; i++) {
      if (!strcasecmp(key, obj->entries[i].k)) {
        return CMDPARSE_ERR;
      }
    }
  }

  if (obj->len + 1 > obj->cap) {
    obj->cap += obj->cap ? obj->cap : 2;
    obj->entries = realloc(obj->entries, obj->cap * sizeof(CmdKeyValue));
  }
  obj->entries[obj->len++] = (CmdKeyValue){.k = key, .v = val};
  return CMDPARSE_OK;
}

static int CmdArray_Append(CmdArray *arr, CmdArg *val) {

  if (arr->len == arr->cap) {
    arr->cap += arr->cap ? arr->cap : 2;
    arr->args = realloc(arr->args, arr->cap * sizeof(CmdArg *));
  }

  arr->args[arr->len++] = val;
  return CMDPARSE_OK;
}

static CmdSchemaElement *newSchemaElement(CmdSchemaElementType type) {
  CmdSchemaElement *ret = rm_calloc(1, sizeof(*ret));
  ret->type = type;
  ret->validator = NULL;
  ret->validatorCtx = NULL;
  return ret;
}

static CmdSchemaNode *NewSchemaNode(CmdSchemaNodeType type, const char *name,
                                    CmdSchemaElement *element, CmdSchemaFlags flags,
                                    const char *help) {
  CmdSchemaNode *ret = rm_malloc(sizeof(*ret));
  *ret = (CmdSchemaNode){
      .val = element,
      .flags = flags,
      .type = type,
      .name = name,
      .edges = NULL,
      .size = 0,
      .help = help,
  };

  return ret;
}

static int cmdSchema_addChild(CmdSchemaNode *parent, CmdSchemaNode *child) {
  // make sure we are not adding anything after a variadic vector
  if (parent->size > 0 && parent->edges[parent->size - 1]->val &&
      parent->edges[parent->size - 1]->val->type == CmdSchemaElement_Variadic) {
    return CMDPARSE_ERR;
  }
  parent->size++;
  parent->edges = realloc(parent->edges, parent->size * sizeof(CmdSchemaNode *));
  parent->edges[parent->size - 1] = child;
  return CMDPARSE_OK;
}

int cmdSchema_genericAdd(CmdSchemaNode *s, CmdSchemaNodeType type, const char *param,
                         CmdSchemaElement *elem, CmdSchemaFlags flags, const char *help) {
  if (s->type != CmdSchemaNode_Schema) {
    return CMDPARSE_ERR;
  }

  return cmdSchema_addChild(s, NewSchemaNode(type, param, elem, flags, help));
}

int CmdSchema_AddNamed(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                       CmdSchemaFlags flags) {

  return cmdSchema_genericAdd(s, CmdSchemaNode_NamedArg, param, elem, flags, NULL);
}

int CmdSchema_AddPostional(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                           CmdSchemaFlags flags) {

  return cmdSchema_genericAdd(s, CmdSchemaNode_PositionalArg, param, elem, flags, NULL);
}

int CmdSchema_AddNamedWithHelp(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                               CmdSchemaFlags flags, const char *help) {

  return cmdSchema_genericAdd(s, CmdSchemaNode_NamedArg, param, elem, flags, help);
}

int CmdSchema_AddPostionalWithHelp(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                                   CmdSchemaFlags flags, const char *help) {

  return cmdSchema_genericAdd(s, CmdSchemaNode_PositionalArg, param, elem, flags, help);
}

CmdSchemaElement *CmdSchema_Validate(CmdSchemaElement *e, CmdArgValidatorFunc f, void *privdata) {
  e->validator = f;
  e->validatorCtx = privdata;
  return e;
}

CmdSchemaElement *CmdSchema_NewTuple(const char *fmt, const char **names) {
  CmdSchemaElement *ret = newSchemaElement(CmdSchemaElement_Tuple);
  ret->tup.fmt = fmt;
  ret->tup.names = names;
  return ret;
}

CmdSchemaElement *CmdSchema_NewArg(const char type) {
  CmdSchemaElement *ret = newSchemaElement(CmdSchemaElement_Arg);
  ret->arg.type = type;

  return ret;
}

CmdSchemaElement *CmdSchema_NewArgAnnotated(const char type, const char *name) {
  CmdSchemaElement *ret = CmdSchema_NewArg(type);
  ret->arg.name = name;
  return ret;
}

CmdSchemaElement *CmdSchema_NewVector(const char type) {
  CmdSchemaElement *ret = newSchemaElement(CmdSchemaElement_Vector);
  ret->vec.type = type;
  return ret;
}

CmdSchemaElement *CmdSchema_NewVariadicVector(const char *fmt) {
  CmdSchemaElement *ret = newSchemaElement(CmdSchemaElement_Variadic);
  ret->var.fmt = fmt;
  return ret;
}

CmdSchemaElement *CmdSchema_NewOption(int num, const char **opts) {
  CmdSchemaElement *ret = newSchemaElement(CmdSchemaElement_Option);
  ret->opt.num = num;
  ret->opt.opts = opts;
  return ret;
}
// CmdSchemaElement *CmdSchema_NewOption(int num, ...) {}
// CmdSchemaElement *NewFlag(int deflt);
// CmdSchemaElement *CmdSchema_NewVariadicVector(const char **fmt);

CmdSchemaNode *NewSchema(const char *name, const char *help) {
  CmdSchemaNode *ret = NewSchemaNode(CmdSchemaNode_Schema, name, NULL, 0, help);
  return ret;
}

int CmdSchema_AddFlag(CmdSchemaNode *parent, const char *name) {
  CmdSchemaNode *ret = NewSchemaNode(
      CmdSchemaNode_Flag, name, newSchemaElement(CmdSchemaElement_Flag), CmdSchema_Optional, NULL);
  cmdSchema_addChild(parent, ret);
  return CMDPARSE_OK;
}

int CmdSchema_AddFlagWithHelp(CmdSchemaNode *parent, const char *name, const char *help) {
  CmdSchemaNode *ret = NewSchemaNode(
      CmdSchemaNode_Flag, name, newSchemaElement(CmdSchemaElement_Flag), CmdSchema_Optional, help);
  cmdSchema_addChild(parent, ret);
  return CMDPARSE_OK;
}

CmdSchemaNode *CmdSchema_AddSubSchema(CmdSchemaNode *parent, const char *param, int flags,
                                      const char *help) {
  CmdSchemaNode *ret = NewSchemaNode(CmdSchemaNode_Schema, param, NULL, flags, help);

  parent->size++;
  parent->edges = realloc(parent->edges, parent->size * sizeof(CmdSchemaNode *));
  parent->edges[parent->size - 1] = ret;
  return ret;
}

const char *typeString(char t) {
  switch (t) {
    case 's':
      return "string";
    case 'l':
      return "integer";
    case 'd':
      return "double";
    default:
      return "INVALID TYPE";
  }
}

void CmdSchemaElement_Print(const char *name, CmdSchemaElement *e) {
  switch (e->type) {
    case CmdSchemaElement_Arg:
      printf("{%s:%s}", e->arg.name ? e->arg.name : name, typeString(e->arg.type));
      break;
    case CmdSchemaElement_Tuple: {
      for (int i = 0; i < strlen(e->tup.fmt); i++) {
        printf("{%s:%s} ", e->tup.names ? e->tup.names[i] : "arg", typeString(e->tup.fmt[i]));
      }
    
```

### Core Architecture Module: `deps/rmutil/cmdparse.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef RMUTIL_CMDPARSE_
#define RMUTIL_CMDPARSE_

#include "redismodule.h"

#include <stdlib.h>

#define CMDPARSE_OK 0
#define CMDPARSE_ERR 1

typedef enum {
  CmdArg_Integer,
  CmdArg_Double,
  CmdArg_String,
  CmdArg_Array,
  CmdArg_Object,
  CmdArg_Flag,
  // this is a special type returned from type checks when the arg is null, and not really used
  CmdArg_NullPtr,

} CmdArgType;

struct CmdArg;

typedef struct {
  char *str;
  size_t len;
} CmdString;

#define CMD_STRING(s) ((CmdString){.str = s, .len = strlen(s)})
int CmdString_CaseEquals(CmdString *str, const char *other);

typedef struct {
  const char *k;
  struct CmdArg *v;
} CmdKeyValue;

typedef struct {
  size_t len;
  size_t cap;
  CmdKeyValue *entries;
} CmdObject;

typedef struct {
  size_t len;
  size_t cap;
  struct CmdArg **args;
} CmdArray;

// Variant value union
typedef struct CmdArg {
  union {
    // numeric value
    double d;
    int64_t i;

    // boolean flag
    int b;
    // string value
    CmdString s;

    // array value
    CmdArray a;

    CmdObject obj;
  };
  CmdArgType type;
} CmdArg;

void CmdArg_Free(CmdArg *arg);

/* General signature for a command validator func. You can inject your own */
typedef int (*CmdArgValidatorFunc)(CmdArg *arg, void *ctx);

/*************************************************************************************************************************
 *
 *  Command Schema Definition Objects
 *************************************************************************************************************************/

/* Single typed argument in a schema. Can have the following type chars:
 *
 *  - s: will be parsed as a string
 *  - l: Will be parsed as a long integer
 *  - d: Will be parsed as a double
 */
typedef struct {
  char type;
  const char *name;
} CmdSchemaArg;

/* dummy struct for flags - they don't need anything */
typedef struct {
} CmdSchemaFlag;

/* Command schema option - represents a multiple choice, mutually exclusive options */
typedef struct {
  /* The number of options */
  int num;
  /* The option strings */
  const char **opts;
} CmdSchemaOption;

/* Schema tuple - a fixed length array with known types */
typedef struct {
  /* Format string, containing s, l or d. The length of the tuple is the length of the format string
   */
  const char *fmt;
  /* Element names - for help prints only */
  const char **names;
} CmdSchemaTuple;

/* Schema vector - multiple elements (known only at run time by the first argument) with a single
 * type,  either l, s or d */
typedef struct {
  char type;
} CmdSchemaVector;

typedef struct {
  const char *fmt;
} CmdSchemaVariadic;

/* Command schema element types */
typedef enum {
  CmdSchemaElement_Arg,
  CmdSchemaElement_Tuple,
  CmdSchemaElement_Vector,
  CmdSchemaElement_Flag,
  CmdSchemaElement_Option,
  CmdSchemaElement_Variadic,
} CmdSchemaElementType;

/* A single element in a command schema. */
typedef struct {
  union {
    CmdSchemaArg arg;
    CmdSchemaTuple tup;
    CmdSchemaVector vec;
    CmdSchemaFlag flag;
    CmdSchemaOption opt;
    CmdSchemaVariadic var;
  };
  CmdSchemaElementType type;
  CmdArgValidatorFunc validator;
  void *validatorCtx;
} CmdSchemaElement;

/* Command schema node flags */
typedef enum {
  /* Required argument */
  CmdSchema_Required = 0x01,
  /* Optional argument */
  CmdSchema_Optional = 0x02,
  /* Repeating argument - my have more than one instance per schema */
  CmdSchema_Repeating = 0x04,
} CmdSchemaFlags;

/* Schema node type.  */
typedef enum {
  /* A schema or sub-schema object. This is the root of the command schema */
  CmdSchemaNode_Schema,
  /* A position argument - it can only be parsed once, at a specific position */
  CmdSchemaNode_PositionalArg,
  /* A named argument. It can appear anywhere, after the last positional argument */
  CmdSchemaNode_NamedArg,
  /* A flag - an argument that may or may not appear, setting a boolean value to 0 or 1 */
  CmdSchemaNode_Flag,
} CmdSchemaNodeType;

/* Schema nodes. Each node contains an element (apart from schema nodes). The node has its name
 * and flags, and the element defines how to parse the element this node contains */
typedef struct CmdSchemaNode {
  /* The value element conatined in this node. NULL for schema/sub-schema nodes */
  CmdSchemaElement *val;
  /* Flags - required / optional and repeatable */
  CmdSchemaFlags flags;
  /* The node type */
  CmdSchemaNodeType type;
  /* The node name. Even positional nodes have names so we can refer to them */
  const char *name;
  /* Optional help string to extract documentation */
  const char *help;
  /* If this is a schema node, it may have edge nodes - other nodes that may be traversed from it.
   */
  struct CmdSchemaNode **edges;
  /* The number of edges */
  int size;
} CmdSchemaNode;

/* Create a new named schema with a given help message (can be left NULL) */
CmdSchemaNode *NewSchema(const char *name, const char *help);

void CmdSchemaNode_Free(CmdSchemaNode *n);

/* Add a named parameter to a schema or sub-schema, with a given name, and an element which can be a
 * value, tuple, vector or option. Flags can indicate unique/repeating, or optional arg */
int CmdSchema_AddNamed(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                       CmdSchemaFlags flags);

/* Add a positional parameter to a schema or sub-schema, with a given name, and an element which can
 * be a value, tuple, vector or option. Flags can indicate unique/repeating, or optional arg. A
 * positional argument has a name so it can referenced when accessing the parsed document */
int CmdSchema_AddPostional(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                           CmdSchemaFlags flags);

/* Add named with a help message */
int CmdSchema_AddNamedWithHelp(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                               CmdSchemaFlags flags, const char *help);
/* Add a positional with a help message */
int CmdSchema_AddPostionalWithHelp(CmdSchemaNode *s, const char *param, CmdSchemaElement *elem,
                                   CmdSchemaFlags flags, const char *help);

/* Create a new tuple schema element to be added as a named/positional. The format string can be
 * composed of the letters d (double), l (long) or s (string). The expected length of the tuple is
 * the length of the format string */
CmdSchemaElement *CmdSchema_NewTuple(const char *fmt, const char **names);

/* Wrap a schema element with a validator func. Only one validator per element allowed */
CmdSchemaElement *CmdSchema_Validate(CmdSchemaElement *e, CmdArgValidatorFunc f, void *privdata);

/* Create a new single argument (string, long or double) to be added as a named or positional. The
 * type char can be d (double), l (long) or s (string) */
CmdSchemaElement *CmdSchema_NewArg(const char type);

/* Samve as CmdSchema_NewArg, but with a name annotation for help messages */
CmdSchemaElement *CmdSchema_NewArgAnnotated(const char type, const char *name);

/* Create a new vector to be added as a named or positional argument. A vector is a list of values
 * of the same type that starts with a length specifier (i.e. 3 foo bar baz) */
CmdSchemaElement *CmdSchema_NewVector(const char type);

/* Add a variadic vector. This can only be added at the end of the command */
CmdSchemaElement *CmdSchema_NewVariadicVector(const char *fmt);

/* Create a new option between mutually exclusive string values, to be added as a named/positional
 */
CmdSchemaElement *CmdSchema_NewOption(int num, const char **opts);

/* Add a flag - which is a boolean optional value. If the flag exists in the arguments, the value is
 * set to 1, else to 0 */
int CmdSchema_AddFlag(CmdSchemaNode *parent, const char *name);

/* Add a flag with a help message */
int CmdSchema_AddFlagWithHelp(CmdSchemaNode *parent, const char *name, const char *help);

/* Add a sub schema - that is a complex schema with arguments that can reside under another command
 */
CmdSchemaNode *CmdSchema_AddSubSchema(CmdSchemaNode *parent, const char *param, int flags,
                                      const char *help);
void CmdSchema_Print(CmdSchemaNode *n);
void CmdArg_Print(CmdArg *n, int depth);

/* Parse a list of arguments using a command schema. If a parsing error occurs, CMDPARSE_ERR is
 * returned and an error string is put into err. Note that it is a newly allocated string that needs
 * to be freed. If strict is 1, we make sure that all arguments have been consumed. Strict set to 0
 * means we can do partial parsing */
int CmdParser_ParseCmd(CmdSchemaNode *schema, CmdArg **arg, CmdString *argv, int argc, char **err,
                       int strict);

/* Parse a list of redis module arguments using a command schema. If a parsing error occurs,
 * CMDPARSE_ERR is returned and an error string is put into err. Note that err is a newly allocated
 * string that needs to be freed. If strict is 1, we make sure that all arguments have been
 * consumed. Strict set to 0 means we can do partial parsing */
int CmdParser_ParseRedisModuleCmd(CmdSchemaNode *schema, CmdArg **cmd, RedisModuleString **argv,
                                  int argc, char **err, int strict);

/* Convert a variadic list of strings to an array of command strings. Does not do extra
 * reallocations, so only the array itself needs to be freed */
CmdString *CmdParser_NewArgListV(size_t size, ...);

/* Convert an array of C NULL terminated strings to an arg list. Does not do extra
 * reallocations, so only the array itself needs to be freed */
CmdString *CmdParser_NewArgListC(const char **args, size_t size);

typedef struct {
  CmdArg *arg;
  const char *key;
  size_t pos;
} CmdArgIterator;

/* Return the number of children for arrays and objects, 0 for all others */
size_t CmdArg_NumChildren(CmdArg
```

### Core Architecture Module: `deps/rmutil/heap.c`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#include "heap.h"

/* Byte-wise swap two items of size SIZE. */
#define SWAP(a, b, size)                  \
  do {                                    \
    register size_t __size = (size);      \
    register char *__a = (a), *__b = (b); \
    do {                                  \
      char __tmp = *__a;                  \
      *__a++ = *__b;                      \
      *__b++ = __tmp;                     \
    } while (--__size > 0);               \
  } while (0)

char *__vector_GetPtr(Vector *v, size_t pos) {
  return v->data + (pos * v->elemSize);
}

void __sift_up(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *)) {
  size_t len = last - first;
  if (len > 1) {
    len = (len - 2) / 2;
    size_t ptr = first + len;
    if (cmp(__vector_GetPtr(v, ptr), __vector_GetPtr(v, --last)) < 0) {
      char t[v->elemSize];
      memcpy(t, __vector_GetPtr(v, last), v->elemSize);
      do {
        memcpy(__vector_GetPtr(v, last), __vector_GetPtr(v, ptr), v->elemSize);
        last = ptr;
        if (len == 0) break;
        len = (len - 1) / 2;
        ptr = first + len;
      } while (cmp(__vector_GetPtr(v, ptr), t) < 0);
      memcpy(__vector_GetPtr(v, last), t, v->elemSize);
    }
  }
}

void __sift_down(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *), size_t start) {
  // left-child of __start is at 2 * __start + 1
  // right-child of __start is at 2 * __start + 2
  size_t len = last - first;
  size_t child = start - first;

  if (len < 2 || (len - 2) / 2 < child) return;

  child = 2 * child + 1;

  if ((child + 1) < len &&
      cmp(__vector_GetPtr(v, first + child), __vector_GetPtr(v, first + child + 1)) < 0) {
    // right-child exists and is greater than left-child
    ++child;
  }

  // check if we are in heap-order
  if (cmp(__vector_GetPtr(v, first + child), __vector_GetPtr(v, start)) < 0)
    // we are, __start is larger than it's largest child
    return;

  char top[v->elemSize];
  memcpy(top, __vector_GetPtr(v, start), v->elemSize);
  do {
    // we are not in heap-order, swap the parent with it's largest child
    memcpy(__vector_GetPtr(v, start), __vector_GetPtr(v, first + child), v->elemSize);
    start = first + child;

    if ((len - 2) / 2 < child) break;

    // recompute the child based off of the updated parent
    child = 2 * child + 1;

    if ((child + 1) < len &&
        cmp(__vector_GetPtr(v, first + child), __vector_GetPtr(v, first + child + 1)) < 0) {
      // right-child exists and is greater than left-child
      ++child;
    }

    // check if we are in heap-order
  } while (cmp(__vector_GetPtr(v, first + child), top) >= 0);
  memcpy(__vector_GetPtr(v, start), top, v->elemSize);
}

void Make_Heap(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *)) {
  if (last - first > 1) {
    // start from the first parent, there is no need to consider children
    for (int start = (last - first - 2) / 2; start >= 0; --start) {
      __sift_down(v, first, last, cmp, first + start);
    }
  }
}

inline void Heap_Push(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *)) {
  __sift_up(v, first, last, cmp);
}

inline void Heap_Pop(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *)) {
  if (last - first > 1) {
    SWAP(__vector_GetPtr(v, first), __vector_GetPtr(v, --last), v->elemSize);
    __sift_down(v, first, last, cmp, first);
  }
}

```

### Core Architecture Module: `deps/rmutil/heap.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef __HEAP_H__
#define __HEAP_H__

#include "vector.h"


/* Make heap from range
 * Rearranges the elements in the range [first,last) in such a way that they form a heap.
 * A heap is a way to organize the elements of a range that allows for fast retrieval of the element with the highest
 * value at any moment (with pop_heap), even repeatedly, while allowing for fast insertion of new elements (with
 * push_heap).
 * The element with the highest value is always pointed by first. The order of the other elements depends on the
 * particular implementation, but it is consistent throughout all heap-related functions of this header.
 * The elements are compared using cmp.
 */
void Make_Heap(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *));


/* Push element into heap range
 * Given a heap in the range [first,last-1), this function extends the range considered a heap to [first,last) by
 * placing the value in (last-1) into its corresponding location within it.
 * A range can be organized into a heap by calling make_heap. After that, its heap properties are preserved if elements
 * are added and removed from it using push_heap and pop_heap, respectively.
 */
void Heap_Push(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *));


/* Pop element from heap range
 * Rearranges the elements in the heap range [first,last) in such a way that the part considered a heap is shortened
 * by one: The element with the highest value is moved to (last-1).
 * While the element with the highest value is moved from first to (last-1) (which now is out of the heap), the other
 * elements are reorganized in such a way that the range [first,last-1) preserves the properties of a heap.
 * A range can be organized into a heap by calling make_heap. After that, its heap properties are preserved if elements
 * are added and removed from it using push_heap and pop_heap, respectively.
 */
void Heap_Pop(Vector *v, size_t first, size_t last, int (*cmp)(void *, void *));

#endif //__HEAP_H__

```

### Core Architecture Module: `deps/rmutil/logging.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef __RMUTIL_LOGGING_H__
#define __RMUTIL_LOGGING_H__

/* Convenience macros for redis logging */

#define RM_LOG_DEBUG(ctx, ...) RedisModule_Log(ctx, "debug", __VA_ARGS__)
#define RM_LOG_VERBOSE(ctx, ...) RedisModule_Log(ctx, "verbose", __VA_ARGS__)
#define RM_LOG_NOTICE(ctx, ...) RedisModule_Log(ctx, "notice", __VA_ARGS__)
#define RM_LOG_WARNING(ctx, ...) RedisModule_Log(ctx, "warning", __VA_ARGS__)

#endif
```

### Core Architecture Module: `deps/rmutil/priority_queue.c`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#include "priority_queue.h"
#include "heap.h"

#include "rmalloc.h"

PriorityQueue *__newPriorityQueueSize(size_t elemSize, size_t cap, int (*cmp)(void *, void *)) {
  PriorityQueue *pq = rm_malloc(sizeof(PriorityQueue));
  pq->v = __newVectorSize(elemSize, cap);
  pq->cmp = cmp;
  return pq;
}

inline size_t Priority_Queue_Size(PriorityQueue *pq) {
  return Vector_Size(pq->v);
}

inline int Priority_Queue_Top(PriorityQueue *pq, void *ptr) {
  return Vector_Get(pq->v, 0, ptr);
}

inline size_t __priority_Queue_PushPtr(PriorityQueue *pq, void *elem) {
  size_t top = __vector_PushPtr(pq->v, elem);
  Heap_Push(pq->v, 0, top, pq->cmp);
  return top;
}

inline void Priority_Queue_Pop(PriorityQueue *pq) {
  if (pq->v->top == 0) {
    return;
  }
  Heap_Pop(pq->v, 0, pq->v->top, pq->cmp);
  pq->v->top--;
}

void Priority_Queue_Free(PriorityQueue *pq) {
  Vector_Free(pq->v);
  rm_free(pq);
}

```

### Core Architecture Module: `deps/rmutil/priority_queue.h`
```
/*
 * Copyright Redis Ltd. 2016 - present
 * Licensed under your choice of the Redis Source Available License 2.0 (RSALv2) or
 * the Server Side Public License v1 (SSPLv1).
 */

#ifndef __PRIORITY_QUEUE_H__
#define __PRIORITY_QUEUE_H__

#include "vector.h"

/* Priority queue
 * Priority queues are designed such that its first element is always the greatest of the elements it contains.
 * This context is similar to a heap, where elements can be inserted at any moment, and only the max heap element can be
 * retrieved (the one at the top in the priority queue).
 * Priority queues are implemented as Vectors. Elements are popped from the "back" of Vector, which is known as the top
 * of the priority queue.
 */
typedef struct {
    Vector *v;

    int (*cmp)(void *, void *);
} PriorityQueue;

/* Construct priority queue
 * Constructs a priority_queue container adaptor object.
 */
PriorityQueue *__newPriorityQueueSize(size_t elemSize, size_t cap, int (*cmp)(void *, void *));

#define NewPriorityQueue(type, cap, cmp) __newPriorityQueueSize(sizeof(type), cap, cmp)

/* Return size
 * Returns the number of elements in the priority_queue.
 */
size_t Priority_Queue_Size(PriorityQueue *pq);

/* Access top element
 * Copy the top element in the priority_queue to ptr.
 * The top element is the element that compares higher in the priority_queue.
 */
int Priority_Queue_Top(PriorityQueue *pq, void *ptr);

/* Insert element
 * Inserts a new element in the priority_queue.
 */
size_t __priority_Queue_PushPtr(PriorityQueue *pq, void *elem);

#define Priority_Queue_Push(pq, elem) __priority_Queue_PushPtr(pq, &(typeof(elem)){elem})

/* Remove top element
 * Removes the element on top of the priority_queue, effectively reducing its size by one. The element removed is the
 * one with the highest value.
 * The value of this element can be retrieved before being popped by calling Priority_Queue_Top.
 */
void Priority_Queue_Pop(PriorityQueue *pq);

/* free the priority queue and the underlying data. Does not release its elements if
 * they are pointers */
void Priority_Queue_Free(PriorityQueue *pq);

#endif //__PRIORITY_QUEUE_H__

```

### Core Architecture Module: `deps/rmutil/rm_assert.h`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
*/
#ifndef __REDISEARCH_ASSERT__
#define __REDISEARCH_ASSERT__

#include "redismodule.h"
extern RedisModuleCtx *RSDummyContext;

// Not to be called directly, used by the macros below
#define _RS_LOG_ASSERT_FMT(condition, fmt, ...)                                      \
    if (__builtin_expect(!(condition), 0)) {                                         \
        RedisModule_Log(RSDummyContext, "warning", (fmt), __VA_ARGS__);              \
        RedisModule_Assert(condition); /* Crashes server and create a crash report*/ \
    }

#ifndef ENABLE_ASSERT
#define RS_LOG_ASSERT_FMT(condition, fmt, ...) // NOP
#define RS_DEBUG_LOG_FMT(fmt, ...) // NOP
#define RS_DEBUG_LOG(str) // NOP
#else
#define RS_LOG_ASSERT_FMT(condition, fmt, ...) _RS_LOG_ASSERT_FMT(condition, fmt, __VA_ARGS__)
#define RS_DEBUG_LOG_FMT(fmt, ...) RedisModule_Log(RSDummyContext, "debug", (fmt), __VA_ARGS__)
#define RS_DEBUG_LOG(str) RedisModule_Log(RSDummyContext, "debug", (str))
#endif

#define RS_LOG_ASSERT(condition, str) RS_LOG_ASSERT_FMT(condition, str "%s", "")
#define RS_ASSERT(condition) RS_LOG_ASSERT_FMT(condition, "Assertion failed: %s", #condition)
#define RS_ABORT(str) RS_LOG_ASSERT_FMT(0, "Aborting: %s", str)
#define RS_ABORT_FMT(fmt, ...) RS_LOG_ASSERT_FMT(0, "Aborting: " fmt, __VA_ARGS__)

// Assertions that we want to keep in production artifacts.
#define RS_LOG_ASSERT_FMT_ALWAYS(condition, fmt, ...) _RS_LOG_ASSERT_FMT(condition, fmt, __VA_ARGS__)
#define RS_LOG_ASSERT_ALWAYS(condition, str)  RS_LOG_ASSERT_FMT_ALWAYS(condition, str "%s", "")
#define RS_ASSERT_ALWAYS(condition) RS_LOG_ASSERT_FMT_ALWAYS(condition, "Assertion failed: %s", #condition)
#define RS_ABORT_ALWAYS(str) RS_LOG_ASSERT_FMT_ALWAYS(0, "Aborting: %s", str)

#define RS_CHECK_FUNC(funcName, ...)                                          \
    if (funcName) {                                                           \
        funcName(__VA_ARGS__);                                                \
    }

#endif  //__REDISEARCH_ASSERT__

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11274** (2026-09-01): **[BUG] FT.SEARCH intermittently does not fail with given timeout when `search-on-timeout` set to `fail`**
  *Symptoms*: ❗**IMPORTANT**  ❗ The issue caught by the **Jedis** nightly tests CI against **Redis** `unstable` image, please see the additional context below.  **Describe the bug**  With `search-on-timeout fail` and `search-workers > 0`, a query that exceeds its `TIMEOUT` usually returns a **successful, complete result set** instead of `SEARCH_TIMEOUT Timeout limit was reached`. The timeout is exceeded on every execution — the identical query under `search-on-timeout return` reports the timeout warning on every run — yet under `fail` the error is only returned sporadically. The outcome looks like a race between the background worker completing the query and the blocked-client timeout callback; when the worker wins, the deadline is ignored.  Regression on `master`, introduced between the 2026-08-26 and 2026-08-27 nightly builds. #10961 (merged 2026-08-27 11:11 UTC) is the only commit in that window touching timeout handling and rewrote exactly this path (`QueryRequestTimeout`, FAIL enforcement for background execution).  **To Reproduce**  Pure `redis-cli`, no client library:  1. `docker run -d --rm --name repro -e TLS_ENABLED=false redislabs/client-libs-test:unstable-33278213642-debian` (Redis unstable + RediSearch `master` as of 2026-08-29, `search-workers 16` preconfigured; server on port 3000) 2. ```sh    docker exec repro sh -c '      redis-cli -p 3000 ft.create idx SCHEMA title TEXT n NUMERIC SORTABLE      for i in $(seq 0 9999); do echo "hset doc:$i title \"hello world $i\" n $i"; do
  **Post-Mortem & Fix Analysis**:
  > Hi @atakavci! Thanks a lot for reporting this and for the detailed reproduction. After investigating, this appears to be the expected behavior: - `FAIL` and `RETURN` use different timeout mechanisms, so comparing their timeout responses, especially with very small timeout values - is not a reliable way to identify a discrepancy. `FAIL` and `RETURN_STRICT` both use blocked-client timeouts and therefore provide a more relevant comparison. - The race described between worker completion and the blocked-client timeout callback is intentional. If Redis processes the worker’s unblock before the timeout callback, the query is considered completed and the results are returned, even if the nominal timeout duration has already elapsed. A query is considered timed out only once the blocked-client timeout callback wins that race.  Closing this ticket as expected behavior. Please feel free to reopen it if there is a discrepancy between the required timeout semantics and the behavior described above.

- **Issue #11233** (2026-08-29): **[BUG] Crash: SmallThinVec size may not exceed the capacity of a 16-bit sized int**
  *Symptoms*: **Crash report**  ``` 1488563:M 27 Aug 2026 15:52:32.006 * 100 changes in 60 seconds. Saving... 1488563:M 27 Aug 2026 15:52:32.057 * Background saving started by pid 1511668 1511668:C 27 Aug 2026 15:52:44.665 * BGSAVE done, 1383262 keys saved, 0 keys skipped, 1051568455 bytes written. 1511668:C 27 Aug 2026 15:52:44.667 * DB saved on disk 1511668:C 27 Aug 2026 15:52:44.728 * Fork CoW for RDB: current 560 MB, peak 560 MB, average 277 MB 1488563:M 27 Aug 2026 15:52:44.835 * Background saving terminated with success 1488563:M 27 Aug 2026 15:53:45.053 * 100 changes in 60 seconds. Saving... 1488563:M 27 Aug 2026 15:53:45.107 * Background saving started by pid 1511685 1511685:C 27 Aug 2026 15:53:57.383 * BGSAVE done, 1383293 keys saved, 0 keys skipped, 1051580544 bytes written. 1511685:C 27 Aug 2026 15:53:57.386 * DB saved on disk 1511685:C 27 Aug 2026 15:53:57.449 * Fork CoW for RDB: current 634 MB, peak 634 MB, average 392 MB 1488563:M 27 Aug 2026 15:53:57.573 * Background saving terminated with success 1488563:M 27 Aug 2026 15:54:17.014 # <search> ERROR ThreadId(02) module_init_ffi: c_entrypoint/module_init_ffi/src/lib.rs:79: A panic occurred in the Rust code panic.payload="SmallThinVec size may not exceed the capacity of a 16-bit sized int" panic.location="thin_vec/src/capacity.rs:85:13" 1488563:M 27 Aug 2026 15:54:17.017 # <search> ERROR ThreadId(02) module_init_ffi: c_entrypoint/module_init_ffi/src/lib.rs:79: A panic occurred in the Rust code panic.payload="panic in a function
  **Post-Mortem & Fix Analysis**:
  > Hello @SaidBoudjenane , thank you for reporting, I'm looking into it
  > Thanks @SaidBoudjenane for the report, and for the full crash log.  I managed to reproduce a crash with the same panic message and location, using a single OR clause with more than 65535 branches. The branch count is held in a 16-bit counter, which should be fixed or at least fail the query gracefully rather than panic.  Your crash occurred on a worker thread, so no query text was logged, and the only hint in the report is a blocked FT.SEARCH client with around 726KB of arguments.  Would you be able to tell me if your application could've generates an OR list, either `@field:{v1|v2|v3|...}` on a TAG field or `t1|t2|t3|...`, roughly what is the largest number of terms it can produce for one query?  If it is reachable, keeping the generated OR list comfortably under 65535, or splitting it across several queries, should avoid this path in the meantime. If you confirm this is it, I'll open a ticket and try to release a patch version with a fix or at least graceful query failure ASAP.     
  > @ofiryanai yes I can confirm it was due to large OR queries. Thank you for figuring it out so quickly and pushing a fix!  Unfortunately those crashes happened in a production application. I patched it on my side thanks to you so it should be ok, but what time frame should I expect for this to be released?

- **Issue #10778** (2026-08-07): **[8.10] [MOD-17475] Prevent coordinator crash when FT.HYBRID times out before cursor reads start**
  *Symptoms*: # Description Backport of #10749 to `8.10`.  ## Describe the changes in the pull request  1. Current: An FT.HYBRID timeout can release cursor mappings before the queued UV initializer runs. The iterator's provisional `pending = 1` state is then mistaken for a real shard cursor, causing an `_FT.CURSOR DEL` with no target shard and crashing the coordinator. 2. Change: Clear the provisional iterator counters when cursor-mapping promotion fails, balance the I/O runtime request accounting, and add deterministic sync points covering failed promotion, synchronous iterator free, and request completion. 3. Outcome: Timed-out hybrid requests no longer issue a target-less cursor delete or leak I/O runtime pending-work capacity.  The Phase 1 shard cursors continue to use their existing idle-expiry cleanup on this cancellation path. Targeted cursor deletion is intentionally left to the planned async cursor-mapping ownership refactor.  #### Which additional issues this PR fixes  1. None  #### Main objects this PR modified  1. Hybrid cursor-mapping iterator cancellation 2. Coordinator I/O runtime request accounting 3. RETURN_STRICT timeout regression coverage  #### Mark if applicable  - [ ] This PR introduces API changes - [ ] This PR introduces serialization changes  #### Release Notes  - [x] This PR requires release notes - [ ] This PR does not require release notes  Prevents a coordinator crash when FT.HYBRID times out before its shard cursor reads are initialized. 
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=RediSearch_RediSearch&pullRequest=10778) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10778&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10778&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=RediSearch_RediSearch&pullRequest=10778&issueStatuses=OPEN,CONFIRMED&si

- **Issue #10749** (2026-08-06): **[MOD-17475] Prevent coordinator crash when FT.HYBRID times out before cursor reads start**
  *Symptoms*: ## Describe the changes in the pull request  1. Current: An FT.HYBRID timeout can release cursor mappings before the queued UV initializer runs. The iterator's provisional `pending = 1` state is then mistaken for a real shard cursor, causing an `_FT.CURSOR DEL` with no target shard and crashing the coordinator. 2. Change: Clear the provisional iterator counters when cursor-mapping promotion fails, balance the I/O runtime request accounting, and add deterministic sync points covering failed promotion, synchronous iterator free, and request completion. 3. Outcome: Timed-out hybrid requests no longer issue a target-less cursor delete or leak I/O runtime pending-work capacity.  The Phase 1 shard cursors continue to use their existing idle-expiry cleanup on this cancellation path. Targeted cursor deletion is intentionally left to the planned async cursor-mapping ownership refactor.  #### Which additional issues this PR fixes  1. None  #### Main objects this PR modified  1. Hybrid cursor-mapping iterator cancellation 2. Coordinator I/O runtime request accounting 3. RETURN_STRICT timeout regression coverage  #### Mark if applicable  - [ ] This PR introduces API changes - [ ] This PR introduces serialization changes  #### Release Notes  - [x] This PR requires release notes - [ ] This PR does not require release notes  Prevents a coordinator crash when FT.HYBRID times out before its shard cursor reads are initialized. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/RediSearch/RediSearch/pull/10749?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 81.79%. Comparing base ([`20ba4ed`](https://app.codecov.io/gh/RediSearch/RediSearch/commit/20ba4ed7c2a90dd72b685275a0aca993412591af?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch)) to head ([`0bda9f1`](https://app.codecov.io/gh/RediSearch/RediSearch/commit/0bda9f1b34affece5fe81ec587fb22cc5d358de1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch)). :warning: Report is 3 commits behind head on master.  :x: Your project check has failed because the head coverage (81.72%) is below the [adjusted base coverage](
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=RediSearch_RediSearch&pullRequest=10749) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10749&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10749&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=RediSearch_RediSearch&pullRequest=10749&issueStatuses=OPEN,CONFIRMED&si
  > Backport failed for `8.4`, because it was unable to cherry-pick the commit(s).  Please cherry-pick the changes locally and resolve any conflicts. ```bash git fetch origin 8.4 git worktree add -d .worktree/backport-10749-to-8.4 origin/8.4 cd .worktree/backport-10749-to-8.4 git switch --create backport-10749-to-8.4 git cherry-pick -x 5a95c8bb03ef8383ca84b4c578d4e9a92324db25 ```

- **Issue #10565** (2026-07-29): **[BUG] redisearch.so crashes redis on all master nodes in the cluster**
  *Symptoms*: **Describe the bug**  We're observing interesting issue with repeating **redisearch.so** causing redis **crash on all master nodes in the cluster** at about the same time. Seems it **correlates with FT.SEARCH** request to one of the indexes. Index name is different every time.  Cluster consists of 3 master + 3 replicas and nodes on which it's running don't have any issues with resources starvation, cpu/mem/disk/network are far away from limits, reaching max ~50%.  Initial crashes started on v8.6.3 and repeated on latest v8.6.4. I can try to update to 8.8.0 if you think it might help.  REDIS BUG REPORT header looks like this:  ``` === REDIS BUG REPORT START: Cut & paste starting from here === 614:M 22 Jul 2026 14:28:27.479 # Redis 8.6.4 crashed by signal: 11, si_code: 1 614:M 22 Jul 2026 14:28:27.479 # Accessing address: 0x2fefd010007fc 614:M 22 Jul 2026 14:28:27.479 # Crashed running the instruction at: 0xe0aa5332d7a0  ------ STACK TRACE ------ EIP: /usr/lib/redis/modules/redisearch.so(sdsfree+0x10)[0xe0aa5332d7a0] ```  Full log is too big to attach to the issue, posted it in Gist https://gist.github.com/nantiferov/1bd247d5827481c87cb90bae9d9b051b  <details>   <summary>Index configuration from FT.INFO</summary>  ``` > ft.info some-name-idx  1) index_name  2) some-name-idx  3) index_options  4) (empty array)  5) index_definition  6) 1) key_type     2) HASH     3) prefixes     4) 1) some-name     5) default_score     6) "1"     7) indexes_all     8) false  7) attributes  8) 1) 
  **Post-Mortem & Fix Analysis**:
  > Hey @nantiferov,  I analysed the issue together with an AI agent. I think the code is safer in that area in 8.8. Can you try running with a search module version 8.8.x and see if that solves the issue?  In the meantime I'll try and locate the specific bug in 8.6 version and work on fixing it.  Let us know if that fixed the crash. 
  > Thank you for checking.  Updated to 8.8.0, will add bug reports if there'll be more crashes.  ``` # search_version search_version:8.8.0 search_redis_version:8.8.0 - oss ```
  > Hey @nantiferov, I believe the issue root cause was found, fixed it in: https://github.com/RediSearch/RediSearch/pull/10614 It was backported to all our active release branches. It should be part of a future release.  Will close this ticket.

- **Issue #10438** (2026-08-03): **Documents written immediately after `FT.CREATE` can be silently lost from the index while the initial background scan is in progress**
  *Symptoms*: **Describe the bug** When a document matching an index's PREFIX is created after FT.CREATE has returned but while that index's initial background scan is still running, the document is occasionally missing from the index afterwards — FT.SEARCH/FT.AGGREGATE do not return it — even though the JSON key exists and JSON.GET returns it normally.  This contradicts the documented guarantee that modified and newly created documents are indexed synchronously and are available by the time the write command finishes (https://redis.io/docs/latest/develop/ai/search-and-query/indexing/#add-json-documents): > ... Modified and newly created documents are indexed synchronously, so the document will be available by the time the add or modify command finishes.  The failure is probabilistic. It requires the initial scan to still be in flight when the write lands, so it reproduces readily when the keyspace is large (the scan has to walk every key in the shard to test it against the prefix, so a busy db stretches the window) and/or when several indexes are being created concurrently. In our case it surfaced as rare, nondeterministic failures in an integration-test suite where many tests share one Redis instance on db 0, each test creating its own index (unique name + unique prefix) and writing its first documents within a few milliseconds of FT.CREATE.  Two independent interventions each make the problem disappear completely, which brackets the cause:  1. Giving each test a dedicated, empty Redis i
  **Post-Mortem & Fix Analysis**:
  > Closing as fixed by #10251 (MOD-16507), backported to 8.8 in #10355. The fix drops document rows invalidated by a concurrent re-index while the safe loader is waiting to acquire the Redis GIL, preventing the null/empty FT.AGGREGATE row reported here.

- **Issue #10369** (2026-07-09): **[BUG] FT.SEARCH on cluster and RESP3 ignores offset**
  *Symptoms*: ``` bash # setup redis-cli -c -p 16379 FT.CREATE idx SCHEMA count NUMERIC SORTABLE for i in $(seq 0 29); do redis-cli -c -p 16379 HSET "cdoc{$i}" count $i; done  # RESP2 — correct: 10 docs redis-cli -2 -c -p 16379 FT.SEARCH idx '*' SORTBY count ASC LIMIT 20 10 NOCONTENT | grep -c cdoc   # -> 10  # RESP3 — WRONG: 30 docs (all of them; offset 20 ignored) redis-cli -3 -c -p 16379 FT.SEARCH idx '*' SORTBY count ASC LIMIT 20 10 NOCONTENT | grep -c cdoc   # -> 30 ```  it appears to return offset+count rows in RESP3 mode:  | `LIMIT offset count` | RESP2 | RESP3 | Expected | RESP3 = offset+count? | |---|---|---|---|---| | `20 10` | 10 | **30** | 10 | 30 ✓ | | `5 5` | 5 | **10** | 5 | 10 ✓ | | `0 10` | 10 | 10 | 10 | 10 ✓ | | `0 5` | 5 | 5 | 5 | 5 ✓ | | `10 10` | 10 | **20** | 10 | 20 ✓ |  Impact: all v8.4+ server versions (8.2 seems OK, that's the lowest 8.* my CI matrix considers, and it doesn't test `FT.SEARCH` on cluster pre-8).  Only applies on cluster, and only applies in RESP3 (but! libraries are moving towards RESP3 by default).
  **Post-Mortem & Fix Analysis**:
  > Hi @mgravell  Thanks for reporting!  Seems like a real bug.  Will update when a fix is merged.  
  > @mgravell A fix to the bug is merged - closing this issue. Thank you for your report!  If the issue reoccurs,  feel free to reopen or open a new issue. 

- **Issue #10156** (2026-06-17): **[8.2] [MOD-16304] Fix TEXT PHONETIC matches after non-TEXT schema fields**
  *Symptoms*: Backport of #10145 to 8.2.  ## Original PR https://github.com/RediSearch/RediSearch/pull/10145  ## Changes from original Resolved `src/spec.c` conflicts because this branch lacks master's `validateDiskJsonSinglePath()` context and `IndexSpec_EnsureSuffixForField()` helper, and it still uses `QUERY_EBADORDEROPTION` instead of `QUERY_ERROR_CODE_BAD_ORDER_OPTION`. The backport keeps the target branch's error enum and applies the same `FieldSpec_IsIndexableText(fs)` guard to the branch's existing inline suffix-trie `FIELD_BIT` sites.  The empty-query regression test differs from the original PR because 8.2 parses the tested empty-string field query as a generic syntax error before reaching the newer `INDEXEMPTY` diagnostic path. The test therefore pins `DIALECT 1` and asserts `Syntax error` while still covering the `TEXT NOINDEX` schema layout.  ## Describe the changes in the pull request  A clear and concise description of what the PR is solving, including: 1. Current: TEXT field mask checks could use schema field positions or evaluate `FIELD_BIT` for `TEXT NOINDEX` fields. 2. Change: Backport #10145's field-mask helpers and guards to 8.2. 3. Outcome: Field-qualified phonetic/slop/inorder/empty-text checks use text field ids safely and skip `TEXT NOINDEX` fields before `FIELD_BIT`.  #### Which additional issues this PR fixes 1. MOD-16304 2. #10140  #### Main objects this PR modified 1. `src/spec.c` / `src/spec.h` / `src/field_spec.h` - use text field ids and guarded text-field m
  **Post-Mortem & Fix Analysis**:
  > <!-- JIT_SECURITY_REVIEW_IDENTIFIER_72B39AF4E1D -->  # 🛡️ Jit Security Scan Results  <div align="center">  ![CRITICAL](https://img.shields.io/badge/CRITICAL-0-red) ![HIGH](https://img.shields.io/badge/HIGH-0-orange) ![MEDIUM](https://img.shields.io/badge/MEDIUM-0-yellow)   </div>  **✅ No security findings were detected in this PR**  ---  <div align="right"> <sup>Security scan by <a href="https://jit.io">Jit</a></sup> </div>
  > ## [Codecov](https://app.codecov.io/gh/RediSearch/RediSearch/pull/10156?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.88%. Comparing base ([`fa5e72c`](https://app.codecov.io/gh/RediSearch/RediSearch/commit/fa5e72cb03e73c0f198bcfb25b30a767b0d9f5b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch)) to head ([`779edfe`](https://app.codecov.io/gh/RediSearch/RediSearch/commit/779edfefe8f1fc816b06e4adb6347afabd0da677?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=RediSearch)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##              8.2   #10156      +/-   
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=RediSearch_RediSearch&pullRequest=10156) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [1 New issue](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10156&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=RediSearch_RediSearch&pullRequest=10156&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=RediSearch_RediSearch&pullRequest=10156&issueStatuses=OPEN,CONFIRMED&sin

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

### Incident Patch 1: `df67d064` (2026-10-05)
**Commit Message**: Fix date functions returning garbage for unrepresentable timestamps (#11760)

* Add regression test for unrepresentable date-function timestamps

Covers timefmt and the eight date extraction/rounding functions with
timestamps that fit in time_t but overflow struct tm's year, and with
values outside time_t (2^63, inf, nan), both shard-side and
coordinator-side.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Check timestamp range and gmtime_r result in date functions

hour, day, dayofmonth, dayofweek, dayofyear, year, month and monthofyear
ignored gmtime_r failure and returned values built from the partially
written struct tm. All nine date functions, timefmt included, also cast
the double argument to time_t without a range check, which is undefined
behavior for NaN, infinity and values >= 2^63.

Convert through a helper that rejects values outside time_t before the
cast and fails when gmtime_r fails. Such inputs now yield null, the
existing result for invalid input.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/aggregate/functions/date.c` (modified, +37/-24)
```diff
@@ -20,12 +20,23 @@ struct tm;
 #define ISOFMT "%FT%TZ"
 #define ISOFMT_LEN sizeof(ISOFMT) - 1
 
+_Static_assert(sizeof(time_t) == sizeof(int64_t), "timestampToTm assumes a 64-bit time_t");
+
+/* Converts a timestamp to UTC. Fails for NaN, values outside the range of time_t (converting those
+ * is undefined behavior) and timestamps whose year doesn't fit in struct tm. */
+static bool timestampToTm(double d, struct tm *tm) {
+  if (!(d >= -0x1p63 && d < 0x1p63)) {
+    return false;
+  }
+  time_t ts = (time_t)d;
+  return gmtime_r(&ts, tm) != NULL;
+}
+
 // TIME(property, [fmt_string])
 static int timeFormat(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   const char *fmt = ISOFMT;
   char timebuf[1024];  // Should be enough for any human time string
   double n = 0.0;
-  time_t tt = 0;
   struct tm tm = {0};
   size_t rv = 0;
   char *buf = NULL;
@@ -39,8 +50,7 @@ static int timeFormat(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *resul
   if (!RSValue_ToNumber(argv[0], &n)) {
     goto err;
   }
-  tt = (time_t)n;
-  if (!gmtime_r(&tt, &tm)) {
+  if (!timestampToTm(n, &tm)) {
     // could not convert value to timestamp
     goto err;
   }
@@ -92,9 +102,10 @@ static int func_hour(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
 
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
   tmm.tm_sec = 0;
   tmm.tm_min = 0;
   ts = fast_timegm(&tmm);
@@ -131,9 +142,10 @@ static int func_day(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result)
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
 
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
   tmm.tm_sec = 0;
   tmm.tm_hour = 0;
   tmm.tm_min = 0;
@@ -149,14 +161,14 @@ static int func_day(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result)
 
 static int func_dayofmonth(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   double d = 0.0;
-  time_t ts = 0;
   struct tm tmm = {0};
 
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
 
   RSValue_SetNumber(result, (double)tmm.tm_mday);
   return EXPR_EVAL_OK;
@@ -169,14 +181,14 @@ static int func_dayofmonth(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *
 
 static int func_dayofweek(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   double d = 0.0;
-  time_t ts = 0;
   struct tm tmm = {0};
 
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
 
   RSValue_SetNumber(result, (double)tmm.tm_wday);
   return EXPR_EVAL_OK;
@@ -189,14 +201,14 @@ static int func_dayofweek(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *r
 
 static int func_dayofyear(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   double d = 0.0;
-  time_t ts = 0;
   struct tm tmm = {0};
 
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
 
   RSValue_SetNumber(result, (double)tmm.tm_yday);
   return EXPR_EVAL_OK;
@@ -209,14 +221,14 @@ static int func_dayofyear(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *r
 
 static int func_year(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   double d = 0.0;
-  time_t ts = 0;
   struct tm tmm = {0};
 
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
 
   RSValue_SetNumber(result, (double)tmm.tm_year + 1900);
   return EXPR_EVAL_OK;
@@ -235,8 +247,9 @@ static int func_month(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *resul
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
   tmm.tm_sec = 0;
   tmm.tm_hour = 0;
   tmm.tm_min = 0;
@@ -253,14 +266,14 @@ static int func_month(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *resul
 
 static int func_monthofyear(ExprEval *ctx, RSValue **argv, size_t argc, RSValue *result) {
   double d = 0.0;
-  time_t ts = 0;
   struct tm tmm = {0};
 
   if (!RSValue_ToNumber(argv[0], &d) || d < 0) {
     goto err;
   }
-  ts = (time_t)d;
-  gmtime_r(&ts, &tmm);
+  if (!timestampToTm(d, &tmm)) {
+    goto err;
+  }
   RSValue_SetNumber(result, (double)tmm.tm_mon);
   return EXPR_EVAL_OK;
 err:
```

**File**: `tests/pytests/test.py` (modified, +32/-0)
```diff
@@ -3412,6 +3412,38 @@ def testTimeFormatError(env):
     env.expect('ft.aggregate', 'idx', '@test:[0..inf]', 'LOAD', '1', '@test', 'APPLY', 'year("not_number")', 'as', 'a').equal([1, ['test', '12234556', 'a', None]])
     env.expect('ft.aggregate', 'idx', '@test:[0..inf]', 'LOAD', '1', '@test', 'APPLY', 'monthofyear("not_number")', 'as', 'a').equal([1, ['test', '12234556', 'a', None]])
 
+def testDateFunctionsRejectUnrepresentableTimestamps(env):
+    """Date functions return null for timestamps gmtime_r cannot convert."""
+    env.expect('FT.CREATE', 'idx', 'SCHEMA', 'test', 'NUMERIC').ok()
+    getConnectionByEnv(env).execute_command('HSET', 'doc1', 'test', '1')
+
+    functions = ('timefmt', 'hour', 'day', 'dayofmonth', 'dayofweek',
+                 'dayofyear', 'year', 'month', 'monthofyear')
+    # The first two fit in time_t but their year overflows struct tm's int,
+    # the rest don't fit in time_t at all.
+    timestamps = ('67768036191676800', '1000000000000000000',
+                  '9223372036854775808', '"inf"', '"nan"')
+    # Without GROUPBY the expression runs on the shards, after it on the coordinator.
+    plans = (([], ['value', None]),
+             (['GROUPBY', '0', 'REDUCE', 'COUNT', '0', 'AS', 'count'],
+              ['count', '1', 'value', None]))
+    for function in functions:
+        for timestamp in timestamps:
+            expression = f'{function}({timestamp})'
+            for prefix, expected in plans:
+                res = env.cmd('FT.AGGREGATE', 'idx', '*', *prefix, 'APPLY', expression, 'AS', 'value')
+                env.assertEqual(res, [1, expected],
+                                message=f'unsafe date timestamp accepted: {expression} {prefix}')
+
+    # Valid timestamps are unaffected.
+    for expression, expected in (('timefmt(-1)', '1969-12-31T23:59:59Z'),
+                                 ('year(253402300799)', '9999'),
+                                 ('dayofmonth(1517417144.75)', '31'),
+                                 ('month(1517417144)', '1514764800'),
+                                 ('year(-1)', None)):
+        env.expect('FT.AGGREGATE', 'idx', '*', 'APPLY', expression, 'AS', 'value').equal(
+            [1, ['value', expected]])
+
 def testMonthOfYear(env):
     env.expect('FT.CREATE', 'idx', 'ON', 'HASH', 'SCHEMA', 'test', 'NUMERIC').equal('OK')
     env.assertOk(env.getClusterConnectionIfNeeded().execute_command('ft.add', 'idx', 'doc1', '1.0', 'FIELDS', 'test', '12234556'))
```

---

### Incident Patch 2: `795785c7` (2026-10-05)
**Commit Message**: Fix crash saving after upgrading a legacy index spec stored under an unexpected key (#11636)

* Add tests for loading legacy byte offsets from an RDB

Build a legacy (encver 16) index spec RDB file in the test and start the
server from it. One test checks that byte offsets which exactly fill
their blob load and upgrade. The other gives the offsets a length prefix
larger than the blob, which must fail the load with a diagnostic rather
than crash the server.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Fail legacy RDB loads with truncated byte offsets

LoadByteOffsets trusted the counts and lengths in the serialized blob,
so a blob shorter than its own length prefix made it read past the end
of the buffer, after allocating as much as the prefix claimed. Check
each read against the bytes remaining and return NULL when the blob is
short. DocTable_LegacyRdbLoad, its only caller, now logs and fails the
load in that case.

Failing the load also needs the legacy spec's cleanup to be safe:
IndexSpec_LegacyRdbLoad never initialized the spec's IndexError, so
freeing the spec on any load error hit an assertion (debug) or a NULL
dereference (release). Initialize it when the spec is cr

**File**: `src/spec.c` (modified, +24/-0)
```diff
@@ -3489,6 +3489,24 @@ int IndexSpec_RdbLoadOpenDisk(RedisModuleCtx *ctx, IndexSpec *sp, bool useSst, Q
 }
 
 
+// The legacy upgrade deletes each spec's key by the name it was saved under, INDEX_SPEC_KEY_FMT in
+// db 0. A spec loaded from any other key would stay in the keyspace after the upgrade, holding a
+// value that the type's save callback cannot write.
+static bool legacySpecKeyIsExpected(RedisModuleIO *rdb, const char *specName) {
+  const RedisModuleString *key = RedisModule_GetKeyNameFromIO(rdb);
+  if (!key) {
+    // Not loaded into the keyspace, so nothing is left behind.
+    return true;
+  }
+  size_t keyLen;
+  const char *keyStr = RedisModule_StringPtrLen(key, &keyLen);
+  const size_t prefixLen = strlen(INDEX_SPEC_KEY_PREFIX);
+  const size_t nameLen = strlen(specName);
+  return RedisModule_GetDbIdFromIO(rdb) == 0 && keyLen == prefixLen + nameLen &&
+         !memcmp(keyStr, INDEX_SPEC_KEY_PREFIX, prefixLen) &&
+         !memcmp(keyStr + prefixLen, specName, nameLen);
+}
+
 void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   if (encver < LEGACY_INDEX_MIN_VERSION || encver > LEGACY_INDEX_MAX_VERSION) {
     return NULL;
@@ -3504,6 +3522,12 @@ void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   }
   RS_LOG_ASSERT(!SearchDisk_IsEnabled(), "Legacy indexes are not supported on disk");
   char *legacyName = RedisModule_LoadStringBuffer(rdb, NULL);
+  if (!legacySpecKeyIsExpected(rdb, legacyName)) {
+    RedisModule_LogIOError(rdb, "warning",
+                           "Refusing a legacy index that is not stored under its index key in db 0");
+    RedisModule_Free(legacyName);
+    return NULL;
+  }
 
   RedisModuleCtx *ctx = RedisModule_GetContextFromIO(rdb);
   IndexSpec *sp = rm_calloc(1, sizeof(IndexSpec));
```

**File**: `tests/pytests/test_legacy_module_types.py` (modified, +35/-6)
```diff
@@ -266,20 +266,20 @@ def _write_legacy_spec_rdb(env, doc, encver=LEGACY_SPEC_ENC_VER):
     return _write_legacy_spec_body_rdb(env, _legacy_spec_body(doc, encver), encver)
 
 
-def _write_legacy_spec_body_rdb(env, body, encver):
+def _write_legacy_spec_body_rdb(env, body, encver, key=b'idx:idx'):
     """Stop the server and replace its RDB file with one holding a single legacy index spec, the
-    encver-`encver` `ft_index0` value `body`. A legacy spec is only upgraded during the first RDB load
-    after the module loads, so it cannot be RESTOREd (see testLegacyIndexSpecRestoreIsRefused) and has
-    to come from the file the server starts from. Returns the server's log file path."""
+    encver-`encver` `ft_index0` value `body`, stored under `key`. The default is INDEX_SPEC_KEY_FMT for
+    the spec named `idx`: the key the upgrade deletes once it has loaded it. A legacy spec is only
+    upgraded during the first RDB load after the module loads, so it cannot be RESTOREd (see
+    testLegacyIndexSpecRestoreIsRefused) and has to come from the file the server starts from.
+    Returns the server's log file path."""
     conn = _binary_conn(env)
     rdb_version = _rdb_version(conn)
     db_dir = env.cmd('CONFIG', 'GET', 'dir')[1]
     rdb_path = os.path.join(db_dir, env.cmd('CONFIG', 'GET', 'dbfilename')[1])
     log_path = os.path.join(db_dir, env.cmd('CONFIG', 'GET', 'logfile')[1])
     env.stop()
 
-    # INDEX_SPEC_KEY_FMT for the spec named `idx`: the key the upgrade deletes once it has loaded it.
-    key = b'idx:idx'
     rdb = (b'REDIS%04d' % rdb_version
            + bytes([RDB_OPCODE_SELECTDB]) + _save_len(0)
            + bytes([RDB_TYPE_MODULE_2]) + _save_len(len(key)) + key
@@ -411,6 +411,35 @@ def testLegacySpecWithoutFieldPathLoads():
     env.expect('FT.SEARCH', 'idx', 'hello', 'NOCONTENT').equal([1, 'doc:1'])
 
 
+@skip(cluster=True, asan=True)
+def testLegacySpecUnderUnexpectedKeyFailsToLoad():
+    """The upgrade deletes a legacy spec's key by the name the spec was saved under. A spec stored
+    under any other key used to load and stay in the keyspace after the upgrade, and the next save of
+    that key crashed the server. Its load must fail instead."""
+    env = Env(moduleArgs='UPGRADE_INDEX idx; PREFIX 1 doc')
+    skipOnExistingEnv(env)
+    log_path = _write_legacy_spec_body_rdb(
+        env, _legacy_spec_body(_legacy_doc(0, b''), LEGACY_SPEC_ENC_VER), LEGACY_SPEC_ENC_VER,
+        key=b'legacy:idx')
+
+    # Give the server time to fail during the load before RLTest's readiness probe races with it.
+    env.envRunner.startupGraceSecs = 1
+    try:
+        env.start()
+    except Exception as e:
+        env.assertContains('Redis server is dead', str(e))
+    if env.isUp():
+        # Where the load is accepted, saving the leftover key is what brings the server down.
+        env.cmd('SAVE')
+    env.assertFalse(env.isUp())
+
+    with open(log_path) as f:
+        log = f.read()
+    # Redis writes a bug report for both a signal and a failed assertion.
+    env.assertNotContains('REDIS BUG REPORT', log, message=log[-4000:])
+    env.assertContains('Refusing a legacy index that is not stored under its index key in db 0', log)
+
+
 def _fail_full_sync(env, shard_mock, sync_failed):
     """Make the server a replica of `shard_mock` and cut its full sync short, so the load fails.
 
```

---

### Incident Patch 3: `1129e527` (2026-10-05)
**Commit Message**: Revert "[CI] Do not block PRs and the merge queue on Codecov upload failures" (#11776)

Revert "[CI] Do not block PRs and the merge queue on Codecov upload failures …"

This reverts commit 9962c27bea328aec2158539cdeb71906849259ab.

**File**: `.github/workflows/task-test-flow.yml` (modified, +0/-4)
```diff
@@ -573,8 +573,6 @@ jobs:
         run: gpg --import .github/codecov_gpg.pub
       - name: Upload flow coverage (standalone)
         if: inputs.coverage && inputs.test-mode == 'standalone'
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/flow_standalone.info
@@ -584,8 +582,6 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
       - name: Upload flow coverage (coordinator)
         if: inputs.coverage && inputs.test-mode == 'coordinator'
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/flow_coordinator.info
```

**File**: `.github/workflows/task-test-unit.yml` (modified, +0/-2)
```diff
@@ -334,8 +334,6 @@ jobs:
         run: gpg --import .github/codecov_gpg.pub
       - name: Upload unit coverage
         if: inputs.coverage
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/unit.info,bin/rust_cov.info
```

**File**: `.github/workflows/task-test.yml` (modified, +0/-8)
```diff
@@ -609,8 +609,6 @@ jobs:
         run: gpg --import .github/codecov_gpg.pub
       - name: Upload flow coverage (combined)
         if: inputs.coverage && inputs.standalone && inputs.coordinator
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/flow_standalone.info,bin/flow_coordinator.info
@@ -620,8 +618,6 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
       - name: Upload flow coverage (standalone)
         if: inputs.coverage && inputs.standalone && !inputs.coordinator
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/flow_standalone.info
@@ -631,8 +627,6 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
       - name: Upload flow coverage (coordinator)
         if: inputs.coverage && !inputs.standalone && inputs.coordinator
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/flow_coordinator.info
@@ -642,8 +636,6 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
       - name: Upload unit coverage
         if: inputs.coverage && inputs.unit-tests
-        # An unreachable Codecov must not block PRs or the merge queue.
-        continue-on-error: true
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6.0.2 NOSONAR
         with:
           files: bin/unit.info,bin/rust_cov.info
```

---

### Incident Patch 4: `c3ca9afc` (2026-10-05)
**Commit Message**: [CI] Require redisbench_admin 0.12.39 for the benchmark runner (#11765)

Require redisbench_admin 0.12.39 for the benchmark runner

0.12.39 fixes a run-remote crash (assert benchmark_type == "read-only" in
ro_benchmark_reuse) that fails every master push once a mixed benchmark and
write-only benchmarks share a dataset, as search-vector-numeric-partial-update-knn-mixed
and the two vector write-only specs do on the arxiv dataset.

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `tests/benchmarks/requirements.txt` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-redisbench_admin>=0.12.29
+redisbench_admin>=0.12.39
 numpy>=2.0.0
 pandas
 requests
```

---

### Incident Patch 5: `024a22c9` (2026-10-04)
**Commit Message**: [MOD-18584] Fix stack exhaustion in APPLY expressions with many function arguments (#11764)

* [MOD-18584] Heap-allocate large expression function argument arrays

evalFunc sized a stack VLA by the call's argument count, which comes from
the client-supplied expression and can reach 65535 for variadic functions
such as format(). Nested calls recurse through evalFunc, so each level
kept its own large frame alive and could exhaust the thread stack.

Keep a small fixed-size stack buffer for the common case and fall back to
the heap for larger argument lists.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* [MOD-18584] Test function calls past the inline argument buffer

Cover format() with more arguments than evalFunc keeps on the stack,
nested, and with a failing argument so the heap array's cleanup path runs.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/aggregate/expr/expression.c` (modified, +9/-1)
```diff
@@ -27,6 +27,8 @@
 
 static int evalInternal(ExprEval *eval, const RSExpr *e, RSValue *res);
 
+#define EXPR_INLINE_ARGS 8
+
 static void setReferenceValue(RSValue *dst, RSValue *src) {
   RSValue_MakeReference(dst, src);
 }
@@ -66,7 +68,10 @@ static int evalFunc(ExprEval *eval, const RSFunctionExpr *f, RSValue *result) {
   /** First, evaluate every argument */
   size_t nallocdargs = 0;
   size_t nargs = f->args->len;
-  RSValue *args[nargs];
+  // Argument counts are client-controlled (up to 65535 for variadic functions)
+  // and nested calls recurse through here, so only small counts use the stack.
+  RSValue *inlineArgs[EXPR_INLINE_ARGS];
+  RSValue **args = nargs <= EXPR_INLINE_ARGS ? inlineArgs : rm_malloc(nargs * sizeof(*args));
 
   // Normal function evaluation
   for (size_t ii = 0; ii < nargs; ii++) {
@@ -89,6 +94,9 @@ static int evalFunc(ExprEval *eval, const RSFunctionExpr *f, RSValue *result) {
   for (size_t ii = 0; ii < nallocdargs; ii++) {
     RSValue_DecrRef(args[ii]);
   }
+  if (args != inlineArgs) {
+    rm_free(args);
+  }
   return rc;
 }
 
```

**File**: `tests/pytests/test_aggregate.py` (modified, +20/-0)
```diff
@@ -1037,6 +1037,26 @@ def testStartsWith(env):
                                                                 ['t', 'aaa', 'prefix', '1'], \
                                                                 ['t', 'ab', 'prefix', '0']]))
 
+def testFunctionManyArgs(env):
+    """Function calls with more arguments than the evaluator keeps on the stack"""
+    conn = getConnectionByEnv(env)
+    env.cmd('FT.CREATE', 'idx', 'SCHEMA', 't', 'TEXT', 'SORTABLE', 'u', 'TEXT', 'SORTABLE')
+    conn.execute_command('HSET', 'doc1', 't', 'a')
+
+    def fmt(*args):
+        return f'format("{"%s" * len(args)}", {", ".join(args)})'
+
+    many = ['@t'] * 12
+    res = env.cmd('FT.AGGREGATE', 'idx', '*', 'LOAD', 1, '@t', 'APPLY', fmt(*many), 'AS', 'x')
+    env.assertEqual(res, [1, ['t', 'a', 'x', 'a' * 12]])
+
+    res = env.cmd('FT.AGGREGATE', 'idx', '*', 'LOAD', 1, '@t', 'APPLY', fmt(fmt(*many), *many), 'AS', 'x')
+    env.assertEqual(res, [1, ['t', 'a', 'x', 'a' * 24]])
+
+    # A failing argument after the inline capacity must still release the heap array.
+    env.expect('FT.AGGREGATE', 'idx', '*', 'LOAD', 1, '@t', 'APPLY', fmt(*many, '@u'), 'AS', 'x') \
+        .error().contains('SEARCH_VALUE_NOT_FOUND')
+
 def testContains(env):
     conn = getConnectionByEnv(env)
     env.cmd('ft.create', 'idx', 'SCHEMA', 't', 'TEXT', 'SORTABLE')
```

---

### Incident Patch 6: `4798fbe3` (2026-10-04)
**Commit Message**: Fail the RDB load of a GEOSHAPE field with an unknown coordinate system instead of crashing later (#11712)

* Add test for loading an out-of-range geometry coordinate system

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Fail the RDB load of a geometry field with an unknown coordinate system

FieldSpec_RdbLoad stored the loaded coordinate system without checking it,
and both GeometryCoordsToName and GeometryIndexFactory index fixed tables with
it, so FT.INFO or opening the index read past them. Check the loaded value
before narrowing it to the enum, so a value wider than the enum cannot wrap
into a valid one.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/spec.c` (modified, +7/-1)
```diff
@@ -2870,7 +2870,13 @@ static int FieldSpec_RdbLoad(RedisModuleIO *rdb, FieldSpec *f, StrongRef sp_ref,
   // Load geometry specific options
   if (FIELD_IS(f, INDEXFLD_T_GEOMETRY) || (f->options & FieldSpec_Dynamic)) {
     if (encver >= INDEX_GEOMETRY_VERSION) {
-      f->geometryOpts.geometryCoords = LoadUnsigned_IOError(rdb, goto fail);
+      uint64_t coords = LoadUnsigned_IOError(rdb, goto fail);
+      if (coords >= GEOMETRY_COORDS__NUM) {
+        RedisModule_LogIOError(rdb, "warning", "Invalid geometry coordinate system %llu",
+                               (unsigned long long)coords);
+        goto fail;
+      }
+      f->geometryOpts.geometryCoords = (GEOMETRY_COORDS)coords;
     } else {
       // In RedisSearch RC (2.8.1 - 2.8.3) we supported default coordinate system which was not written to RDB
       f->geometryOpts.geometryCoords = GEOMETRY_COORDS_Cartesian;
```

**File**: `tests/cpptests/test_cpp_rdb.cpp` (modified, +67/-0)
```diff
@@ -13,6 +13,7 @@
 #include "redismock/redismock.h"
 #include "synonym_map.h"
 #include "trie/trie.h"
+#include <algorithm>
 #include <array>
 #include <cstdint>  // For SIZE_MAX, UINT32_MAX
 #include <iterator>  // For std::size
@@ -1249,6 +1250,72 @@ TEST_F(RdbMockTest, testHnswSq8RejectsInvalidRdbParameters) {
   }
 }
 
+// A GEOSHAPE field's coordinate system indexes fixed per-system tables, so a value outside
+// GEOMETRY_COORDS must fail the load instead of reaching them.
+TEST_F(RdbMockTest, testGeometryCoordsRdbLoad) {
+  std::array args{"SCHEMA", "g", "GEOSHAPE", "FLAT"};
+  QueryError err = QueryError_Default();
+  StrongRef specRef = IndexSpec_ParseC(nullptr, "geometry_coords", args.data(), args.size(), &err);
+  ASSERT_FALSE(QueryError_HasError(&err)) << QueryError_GetUserError(&err);
+  auto *spec = static_cast<IndexSpec *>(StrongRef_Get(specRef));
+  ASSERT_NE(spec, nullptr);
+  std::unique_ptr<IndexSpec, std::function<void(IndexSpec *)>> specPtr(
+      spec, [](const IndexSpec *s) { StrongRef_Release(s->own_ref); });
+
+  auto save = [spec](GEOMETRY_COORDS coords) {
+    spec->fields[0].geometryOpts.geometryCoords = coords;
+    RedisModuleIO *io = RMCK_CreateRdbIO();
+    IndexSpec_RdbSave(io, spec, 0);
+    std::vector<uint8_t> buffer = io->buffer;
+    RMCK_FreeRdbIO(io);
+    return buffer;
+  };
+  // The two saves differ only in the coordinate system, which locates it in the stream.
+  const std::vector<uint8_t> spherical = save(GEOMETRY_COORDS_Geographic);
+  const std::vector<uint8_t> flat = save(GEOMETRY_COORDS_Cartesian);
+  ASSERT_EQ(flat.size(), spherical.size());
+  const size_t offset =
+      std::mismatch(flat.begin(), flat.end(), spherical.begin()).first - flat.begin();
+  ASSERT_LE(offset + sizeof(uint64_t), flat.size());
+  ASSERT_TRUE(std::equal(flat.begin() + offset + sizeof(uint64_t), flat.end(),
+                         spherical.begin() + offset + sizeof(uint64_t)));
+
+  struct Case {
+    uint64_t coords;
+    bool valid;
+  };
+  const std::array<Case, 5> cases{{
+      {GEOMETRY_COORDS_Cartesian, true},
+      {GEOMETRY_COORDS_Geographic, true},
+      {GEOMETRY_COORDS__NUM, false},
+      // Would truncate to a valid value if narrowed to the enum before the check.
+      {(uint64_t{1} << 32) + GEOMETRY_COORDS_Cartesian, false},
+      {UINT64_MAX, false},
+  }};
+  for (const auto &test : cases) {
+    SCOPED_TRACE(::testing::Message() << "coords=" << test.coords);
+    RedisModuleIO *io = RMCK_CreateRdbIO();
+    ASSERT_NE(io, nullptr);
+    std::unique_ptr<RedisModuleIO, std::function<void(RedisModuleIO *)>> ioPtr(
+        io, [](RedisModuleIO *rdb) { RMCK_FreeRdbIO(rdb); });
+    io->buffer = flat;
+    memcpy(io->buffer.data() + offset, &test.coords, sizeof(test.coords));
+
+    QueryError status = QueryError_Default();
+    IndexSpec *loaded = IndexSpec_RdbLoad(io, INDEX_CURRENT_VERSION, false, &status);
+    std::unique_ptr<IndexSpec, std::function<void(IndexSpec *)>> loadedPtr(
+        loaded, [](const IndexSpec *s) { StrongRef_Release(s->own_ref); });
+    if (test.valid) {
+      ASSERT_NE(loaded, nullptr) << QueryError_GetUserError(&status);
+      EXPECT_EQ(test.coords, loaded->fields[0].geometryOpts.geometryCoords);
+    } else {
+      EXPECT_EQ(loaded, nullptr) << "out-of-range geometry coordinate system was loaded";
+      EXPECT_TRUE(QueryError_HasError(&status));
+    }
+    QueryError_ClearError(&status);
+  }
+}
+
 // Legacy pre-2.0 module types (ft_invidx / numericdx / ft_tagidx) exist only so an old RDB can be read
 // and discarded during an upgrade. Their loaders return the `dummyNonNull` sentinel rather than NULL,
 // so a key can outlive the upgrade sweep holding nothing but that sentinel.
```

---

### Incident Patch 7: `5f823704` (2026-10-04)
**Commit Message**: [MOD-18106] Restore first-query field expiration regression coverage (#11717)

* [MOD-18106] Restore first-query field expiration assertions

Search retries can hide pending per-key post-notification jobs: the first
command returns stale sortable data, then drains the jobs at command end.
Wait without Redis commands and assert the first search exactly once.
Allow two seconds for background expiry rather than the original 0.5s.

The fixed wait remains timing-dependent; this restores regression
sensitivity without claiming deterministic background synchronization.

* Remove outdated expiration wait comparison comment

* Restore the original 0.5-second field expiration wait

* Describe expiration regression behavior without internal function names

**File**: `tests/pytests/test_expire.py` (modified, +6/-9)
```diff
@@ -571,15 +571,12 @@ def build_inverted_index_dict_for_documents(current_documents):
     expected_inverted_index = build_inverted_index_dict_for_documents(expected_results)
     # now allow active expiration to delete the expired fields
     conn.execute_command('DEBUG', 'SET-ACTIVE-EXPIRE', '1')
-    # Active expiration runs on Redis's background cycle, so a fixed sleep can be too
-    # short under CI load. Wait deterministically for the expected post-expiration
-    # state instead of assuming a fixed delay is always enough.
-    actual_results = {}
-    def check_expired():
-        nonlocal actual_results
-        actual_results = transform_document_list_to_dict(env.cmd('FT.SEARCH', 'idx', '*'))
-        return actual_results == expected_results, actual_results
-    wait_for_condition(check_expired, 'Timeout waiting for active expiration to reap expired fields', timeout=10)
+    # Wait without issuing Redis commands, then check the first search exactly once.
+    # If background field expiration leaves index updates pending, the first command
+    # can return stale sortable values and apply those updates only at its end.
+    # Retrying the search (or sending another command first) would hide that regression.
+    time.sleep(0.5)
+    env.expect('FT.SEARCH', 'idx', '*').apply(transform_document_list_to_dict).equal(expected_results)
     for field_name_and_value, expected_docs in expected_inverted_index.items():
         (env.expect('FT.SEARCH', 'idx', f'@{field_name_and_value}:{field_name_and_value}', 'NOCONTENT')
          .apply(sort_document_names).equal([len(expected_docs), *expected_docs]))
```

---

### Incident Patch 8: `7b519141` (2026-10-04)
**Commit Message**: [CI] Fix periodic master validation baseline rewinding to stale runs (#11722)

[CI] Find periodic validation baseline without filtered run search

The branch/status-filtered runs listing intermittently returns a stale
search snapshot, rewinding the baseline by weeks and inflating the covered
PR list. List unfiltered and filter client-side.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/event-periodic-master-validation.yml` (modified, +6/-1)
```diff
@@ -90,11 +90,16 @@ jobs:
               )
 
           def last_validated_sha():
+              # Filter client-side: with branch/status query filters the API is
+              # served from a search index that intermittently returns a stale
+              # snapshot (weeks-old runs), which silently rewinds the baseline.
               runs = gh_api(
                   f"/repos/{repository}/actions/workflows/{WORKFLOW_FILE}/runs"
-                  "?branch=master&status=success&per_page=20"
+                  "?per_page=100&exclude_pull_requests=true"
               ).get("workflow_runs", [])
               for run in runs:
+                  if run.get("head_branch") != "master" or run.get("conclusion") != "success":
+                      continue
                   if validation_passed(run):
                       return run.get("head_sha", "")
               return ""
```

---

### Incident Patch 9: `3d129c9a` (2026-10-01)
**Commit Message**: Fix dead hybrid_reader.c link breaking link-check (#11720)

docs: point TOP_K_DESIGN at the Rust top-k iterator

hybrid_reader.c was removed in 4b6bac25e6, leaving a dead link that fails
the link-check job on every PR.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ as production code.
 - `src/query.c` — query execution entry point
 - `src/query_optimizer.c` — query plan optimization
 - `src/query_parser/v2/` — Ragel lexer (`lexer.rl`) + Lemon parser (`parser.y`), used by DIALECT 2 onwards (v1 is legacy)
-- `src/iterators/` — iterator implementations (hybrid_reader, optimizer_reader)
+- `src/iterators/` — iterator implementations (optimizer_reader; vector top-k lives in `src/redisearch_rs/top_k/`)
 - `src/result_processor.c` — result processing pipeline
 - `src/numeric_filter.c` — numeric range filter iterators
 - `src/cursor.c` — cursor-based result pagination
```

**File**: `docs/design/TOP_K_DESIGN.md` (modified, +1/-1)
```diff
@@ -1050,5 +1050,5 @@ fn bench_rust_vs_c_batches(c: &mut Criterion);
 - [iterator_api.h](../../src/iterators/iterator_api.h) - C iterator API
 - [lib.rs](../../src/redisearch_rs/rqe_iterators/src/lib.rs) - Rust `RQEIterator` trait
 - [metric.rs](../../src/redisearch_rs/rqe_iterators/src/metric.rs) - Example of unsorted iterator
-- [hybrid_reader.c](../../src/iterators/hybrid_reader.c) - Current C hybrid implementation
+- [iterator.rs](../../src/redisearch_rs/top_k/src/iterator.rs) - Rust top-k iterator (replaced the C `hybrid_reader.c`)
 - [optimizer_reader.c](../../src/iterators/optimizer_reader.c) - Current C optimizer implementation
```

---

### Incident Patch 10: `87350855` (2026-10-01)
**Commit Message**: [MOD-16993] Fix reply mode for each QueryRequest cycle (#11571)

* [MOD-16993] Fix reply mode for each QueryRequest cycle

* Compact per-cycle reply state and compile out production accounting

* Clarify reply mode and check timers at blocking call sites

**File**: `src/aggregate/aggregate_exec.c` (modified, +4/-14)
```diff
@@ -950,6 +950,9 @@ static void sendChunk_Resp3(AREQ *req, RedisModule_Reply *reply, size_t limit,
  * Sends a chunk of <n> rows, optionally also sending the preamble
  */
 void sendChunk(AREQ *req, RedisModule_Reply *reply, size_t limit) {
+  if (!QueryRequest_UsesReplyCallback(&req->base)) {
+    QueryRequest_RecordInlineReply(&req->base);
+  }
   QEFlags reqFlags = AREQ_RequestFlags(req);
   if (!(reqFlags & QEXEC_F_IS_CURSOR) && !(reqFlags & QEXEC_F_IS_SEARCH)) {
     limit = req->maxAggregateResults;
@@ -1160,6 +1163,7 @@ void AREQ_ReplyErrorOrDefer(AREQ *req, RedisModuleCtx *ctx) {
       AREQ_SignalAggregateResultsComplete(req);
     }
   } else {
+    QueryRequest_RecordInlineReply(&req->base);
     QueryErrorsGlobalStats_UpdateError(QueryError_GetCode(err), 1, !IsInternal(req));
     QueryError_ReplyAndClear(ctx, err);
   }
@@ -1785,7 +1789,6 @@ static int buildPipelineAndExecute(AREQ *r, RedisModuleCtx *ctx, QueryError *sta
       }
       replyCallback = QueryReplyCallback;
       timeoutMS = r->reqConfig.queryTimeoutMS;
-      QueryRequest_SetUseReplyCallback(&r->base, true);
     }
 
     RedisModuleBlockedClient* blockedClient = BlockQueryClientWithTimeout(
@@ -2101,9 +2104,6 @@ static void cursorRead(RedisModuleCtx *ctx, Cursor *cursor, size_t count, bool b
     // ends.
     RS_ASSERT(AREQ_SearchCtx(req)->redisCtx == NULL); // parked with no loan
     AREQ_SearchCtx(req)->redisCtx = ctx;
-    // useReplyCallback is authoritative from the caller: blocking dispatches
-    // set it according to whether a reply callback will serialize stored
-    // results on main; inline paths clear it before invoking cursorRead.
     RedisModule_Reply _reply = RedisModule_NewReply(ctx), *reply = &_reply;
     runCursor(reply, cursor, count);
     RedisModule_EndReply(reply);
@@ -2199,9 +2199,6 @@ static int cursorReadDispatchTaken(RedisModuleCtx *ctx, Cursor *cursor, long lon
   // If a timeout is armed, both callbacks must be provided (mirrors the shard
   // Block helpers). RETURN passes no callbacks and no timer.
   RS_ASSERT(timeout_ms == 0 || (timeout_cb != NULL && reply_cb != NULL));
-  // Deferred (callback) reply iff a reply callback will serialize stored
-  // results on main; RETURN replies inline from the BG job.
-  QueryRequest_SetUseReplyCallback(&req->base, reply_cb != NULL);
   RedisModuleBlockedClient *bc =
       RedisModule_BlockClient(ctx, reply_cb, timeout_cb, QueryRequest_OnFree, timeout_ms);
   // Safe against the just-armed timer: the timeout callback runs on this same
@@ -2419,11 +2416,6 @@ int RSCursorReadCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc)
           cursor->queryTimeoutPolicy == TimeoutPolicy_Fail ? CursorReadTimeoutFailCallback
                                                            : CursorReadTimeoutReturnStrictCallback;
       timeoutMS = (rs_wall_clock_ms_t)cursor->queryTimeoutMS;
-      QueryRequest_SetUseReplyCallback(&req->base, true);
-    } else {
-      // RETURN: reply written inline; clear any stale useReplyCallback
-      // from a prior callback-based cursor read so runCursor doesn't park the cursor.
-      QueryRequest_SetUseReplyCallback(&req->base, false);
     }
     QueryRequestTimeout_BeginCycle(
         &req->base.timeout, replyCallback ? QUERY_REQUEST_TIMEOUT_BLOCKED_CLIENT
@@ -2461,8 +2453,6 @@ int RSCursorReadCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc)
       if (inline_req->reqConfig.timeoutPolicy == TimeoutPolicy_ReturnStrict) {
         fallbackCursorToReturn(cursor, inline_req);
       }
-      // Reply inline via ctx; clear stale useReplyCallback.
-      QueryRequest_SetUseReplyCallback(&inline_req->base, false);
       QueryRequestTimeout_BeginCycle(&inline_req->base.timeout,
                                      QUERY_REQUEST_TIMEOUT_CLOCK_DEADLINE);
     }
```

**File**: `src/hybrid/hybrid_exec.c` (modified, +8/-3)
```diff
@@ -532,12 +532,15 @@ void HREQ_StoreResults(HybridRequest *hreq, SearchResult **results, int rc, cach
 }
 
 // Helper for error handling in coordinator HREQ execution.
-// FAIL / RETURN_STRICT (useReplyCallback=true): store the error for the
+// FAIL / RETURN_STRICT (deferred reply): store the error for the
 //   reply_callback to handle.
-// RETURN (useReplyCallback=false): reply directly - an empty result set with a
+// RETURN (inline reply): reply directly - an empty result set with a
 //   timeout warning when the error is a non-fail-policy timeout (no result set
 //   was produced here), otherwise the error itself.
 void HREQ_ReplyOrStoreError(HybridRequest *hreq, RedisModuleCtx *ctx, QueryError *status) {
+  if (!QueryRequest_UsesReplyCallback(&hreq->base)) {
+    QueryRequest_RecordInlineReply(&hreq->base);
+  }
   if (QueryRequest_UsesReplyCallback(&hreq->base)) {
     // Deep copy since QueryError contains heap-allocated strings.
     // reply_callback will clear the stored error after replying.
@@ -618,6 +621,8 @@ void sendChunk_hybrid(HybridRequest *hreq, RedisModule_Reply *reply, size_t limi
       return;
     }
 
+    QueryRequest_RecordInlineReply(&hreq->base);
+
     fatalError = HybridRequest_GetFatalError(hreq);
     countQuery = !fatalError || QueryError_GetCode(fatalError) == QUERY_ERROR_CODE_TIMED_OUT;
     serializeAndReplyResults_hybrid(hreq, reply, rp, qctx, rc, &cv, &r, &results, fatalError);
@@ -884,6 +889,7 @@ int HybridRequest_StartCursors(HybridRequest *req, RedisModuleCtx *replyCtx, Que
 
     if (!QueryRequest_UsesReplyCallback(&req->base)) {
       // If we are not using reply callback, we should reply with the cursors here
+      QueryRequest_RecordInlineReply(&req->base);
       replyWithCursors(replyCtx, req, depletionTimedOut);
     } // else the reply callback replies
 
@@ -1221,7 +1227,6 @@ static int HybridRequest_BuildPipelineAndExecute(HybridRequest *hreq, HybridPipe
           : HybridQueryReplyCallback;
 
       timeoutMS = hreq->reqConfig.queryTimeoutMS;
-      QueryRequest_SetUseReplyCallback(&hreq->base, true);
 
       if (timeoutPolicy == TimeoutPolicy_Fail) {
         timeoutCallback = HybridQueryTimeoutFailCallback;
```

**File**: `src/hybrid/hybrid_exec.h` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ void HREQ_StoreResults(HybridRequest *hreq, SearchResult **results, int rc, cach
 
 /**
  * Helper for error handling in coordinator HREQ execution.
- * For FAIL policy (useReplyCallback=true): stores error for reply_callback to handle.
+ * For FAIL policy (deferred reply): stores error for reply_callback to handle.
  * For RETURN policy: replies with error directly.
  */
 void HREQ_ReplyOrStoreError(HybridRequest *hreq, RedisModuleCtx *ctx, QueryError *status);
```

**File**: `src/info/info_redis/block_client.c` (modified, +15/-1)
```diff
@@ -53,7 +53,10 @@ static void beginCycleCommon(QueryRequest *request, RedisModuleBlockedClient *bc
   // executes it), so no other client can take it before the cycle fully ended.
   RS_ASSERT(!request->blockedClientCycleActive && !RegistryInfo_IsLinked(&request->registryInfo));
   request->blockedClientCycleActive = true;
-  QueryRequest_SetUseReplyCallback(request, reply_cb != NULL);
+  request->replyDeferred = reply_cb != NULL;
+#ifdef ENABLE_ASSERT
+  request->inlineReplyCount = 0;
+#endif
   RS_AtomicIntStoreRelaxed(&request->async.strictReadOwner, QUERY_REQUEST_READ_OWNER_NONE);
   request->registryInfo.cycle_start = time(NULL);
   dllist_prepend(list, &request->registryInfo.node);
@@ -89,6 +92,10 @@ void QueryRequest_EndCycle(QueryRequest *request) {
   struct Cursor *cursor = request->cursorInfo.cursor;
   CursorDisposition disposition = request->cursorInfo.disposition;
   request->blockedClientCycleActive = false;
+  request->replyDeferred = false;
+#ifdef ENABLE_ASSERT
+  request->inlineReplyCount = 0;
+#endif
   request->cursorInfo.cursor = NULL;
   request->cursorInfo.disposition = CURSOR_DISPOSITION_FREE;
 
@@ -109,6 +116,13 @@ void QueryRequest_EndCycle(QueryRequest *request) {
 void QueryRequest_OnFree(RedisModuleCtx *ctx, void *privdata) {
   QueryRequest *request = privdata;
 #ifdef ENABLE_ASSERT
+  RS_ASSERT(request->blockedClientCycleActive);
+  if (QueryRequest_UsesReplyCallback(request)) {
+    RS_ASSERT(request->inlineReplyCount == 0);
+  } else {
+    RS_ASSERT(request->inlineReplyCount == 1);
+    RS_ASSERT(!request->reply.hasStoredResults && request->reply.results == NULL);
+  }
   // Debug-only counter so tests can deterministically observe that
   // free_privdata fired without blocking the main thread in the callback.
   QueryRequestOnFreeDebug_Increment();
```

**File**: `src/info/info_redis/block_client.h` (modified, +3/-2)
```diff
@@ -42,7 +42,7 @@ struct QueryRequest;
  * ownership of the request (it becomes the blocked client's privdata — see
  * the ownership contract on QueryRequest), links it into the BlockedQueries
  * query registry (crash reports), and records the cycle's reply mode
- * (`reply_cb` must be the value that was passed to RedisModule_BlockClient). */
+ * (`reply_cb` must match RedisModule_BlockClient). */
 void QueryRequest_BeginCycle(struct QueryRequest *request, RedisModuleBlockedClient *bc,
                              RedisModuleCmdFunc reply_cb);
 
@@ -78,7 +78,8 @@ void BlockedQueries_UnwindCycles(void);
  * BlockedQueries, calls RedisModule_BlockClient(reply_cb, timeout_cb,
  * QueryRequest_OnFree, timeout_ms) and BeginCycle. `reply_cb`/`timeout_cb`
  * may both be NULL (inline reply mode) but must be provided together with a
- * non-zero `timeout_ms`. */
+ * non-zero `timeout_ms`. This checks the timer passed to Redis, rather than
+ * the request timeout configuration, which may drive an inline clock deadline. */
 RedisModuleBlockedClient *BlockQueryClientWithTimeout(RedisModuleCtx *ctx,
                                                       struct QueryRequest *request,
                                                       RedisModuleCmdFunc reply_cb,
```

**File**: `src/module.c` (modified, +0/-2)
```diff
@@ -4002,7 +4002,6 @@ int DistAggregateCommandImp(RedisModuleCtx *ctx, RedisModuleString **argv, int a
         ? DistAggregateTimeoutFailCallback
         : DistAggregateTimeoutReturnStrictCallback;
     handlerCtx.bcCtx.timeoutMS = queryTimeoutMS;
-    QueryRequest_SetUseReplyCallback(&r->base, true);
     if (policy == TimeoutPolicy_ReturnStrict) {
       r->base.async.requiresAggregateResultsSync = true;
     }
@@ -4137,7 +4136,6 @@ int DistHybridCommandInternal(RedisModuleCtx *ctx, RedisModuleString **argv, int
         ? DistHybridTimeoutFailCallback
         : DistHybridTimeoutReturnStrictCallback;
     handlerCtx.bcCtx.timeoutMS = queryTimeoutMS;
-    QueryRequest_SetUseReplyCallback(&hreq->base, true);
   }
 
   return ConcurrentSearch_HandleRedisCommandEx(DIST_THREADPOOL, dist_callback, ctx, argv, argc,
```

**File**: `src/query_request.c` (modified, +4/-1)
```diff
@@ -249,7 +249,10 @@ void QueryRequest_Init(QueryRequest *request, QueryRequestKind kind,
   request->cursorInfo = (CursorInfo) {0};
   request->registryInfo = (RegistryInfo) {0};
   ChunkReplyState_Init(&request->reply);
-  QueryRequest_SetUseReplyCallback(request, false);
+  request->replyDeferred = false;
+#ifdef ENABLE_ASSERT
+  request->inlineReplyCount = 0;
+#endif
   QueryRequestTimeout_Init(&request->timeout, requestConfig->timeoutPolicy,
                            requestConfig->queryTimeoutMS);
   QueryRequestTimeout_BeginCycle(&request->timeout, QUERY_REQUEST_TIMEOUT_BLOCKED_CLIENT);
```

**File**: `src/query_request.h` (modified, +19/-6)
```diff
@@ -17,6 +17,7 @@
 
 #include "config.h"
 #include "query_error.h"
+#include "rmutil/rm_assert.h"
 #include "util/dllist.h"
 #include "util/rs_atomic.h"
 
@@ -335,15 +336,17 @@ typedef struct QueryRequest {
    * This is set after RedisModule_BlockClient returns and cleared by OnFree;
    * per-cycle state must not be read while it is false. */
   bool blockedClientCycleActive;
+  // True: the Redis reply callback serializes stored results. False: the worker replies inline.
+  // Fixed by BeginCycle before dispatch and cleared by EndCycle before parking.
+  bool replyDeferred;
+  // Assertion-only accounting in padding; keep the C/Rust layout independent of build flags.
+  uint8_t inlineReplyCount;
   CursorInfo cursorInfo;
   RegistryInfo registryInfo;
   /* Stored results and errors written by BG before UnblockClient and consumed
    * by the main-thread reply or timeout callback. Reset at the end of each
    * cycle and again during request destruction as a safety net. */
   ChunkReplyState reply;
-  /* false: BG replies inline through a thread-safe context; true: BG stores
-   * results and the Redis reply callback serializes them on the main thread. */
-  bool useReplyCallback;
   QueryRequestTimeout timeout;
   QueryRequestAsyncState async;
   /**
@@ -375,12 +378,22 @@ static inline ResultProcessor *QueryRequest_GetEndProc(const QueryRequest *reque
 }
 
 static inline bool QueryRequest_UsesReplyCallback(const QueryRequest *request) {
-  return request->useReplyCallback;
+  return request->replyDeferred;
 }
 
-static inline void QueryRequest_SetUseReplyCallback(QueryRequest *request, bool useReplyCallback) {
-  request->useReplyCallback = useReplyCallback;
+/* Record one complete inline response for a blocked cycle, including errors.
+ * Foreground execution has no OnFree and is not counted. */
+#ifdef ENABLE_ASSERT
+static inline void QueryRequest_RecordInlineReply(QueryRequest *request) {
+  if (request->blockedClientCycleActive) {
+    RS_ASSERT(!QueryRequest_UsesReplyCallback(request));
+    RS_ASSERT(request->inlineReplyCount == 0);
+    ++request->inlineReplyCount;
+  }
 }
+#else
+#define QueryRequest_RecordInlineReply(request) ((void)0)
+#endif
 
 static inline int QueryRequest_GetExecutionPhase(const QueryRequest *request) {
   return QueryRequestAsyncState_GetExecutionPhase(&request->async);
```

---

### Incident Patch 11: `d8df5b2d` (2026-10-01)
**Commit Message**: [MOD-15681] [MOD-19178] Reject a malformed FT._RESTOREIFNX or RESTORE index payload without crashing the shard (#11664)

* [MOD-15681] Don't free an uninitialised IndexSpec when its RDB payload ends early

IndexSpec_RdbLoad allocated the spec and its StrongRef before reading the flags
and field count, so a payload that ends after the index name, or declares more
than SPEC_MAX_FIELDS fields, jumped to cleanup and released a spec that never
went through initializeIndexSpec. IndexSpec_Free then ran IndexError_Clear on a
zeroed stats.indexError and passed its NULL key to RedisModule_FreeString, which
crashes in decrRefCount.

The payload is client-supplied on FT._RESTOREIFNX SCHEMA and on RESTORE of an
ft_index0 value, so any client allowed to run either could take the shard down.

Read the flags and field count into locals first and allocate only once
initializeIndexSpec can run, so every path that reaches cleanup has a fully
initialised spec to free. The index name is the only resource owned before that
point; the new cleanup_name label frees it.

The test restores every proper prefix of a serialized schema and checks that
each is rejected, that the server survives, and that no index

**File**: `src/spec.c` (modified, +18/-10)
```diff
@@ -3325,26 +3325,25 @@ IndexSpec *IndexSpec_RdbLoad(RedisModuleIO *rdb, int encver, bool useSst, QueryE
   specName = NewHiddenString(rawName, len, true);
   RedisModule_Free(rawName);
 
-  sp = rm_calloc(1, sizeof(IndexSpec));
-  spec_ref = StrongRef_New(sp, (RefManager_Free)IndexSpec_Free);
-  sp->own_ref = spec_ref;
-
-  // Note: indexError, fieldIdToIndex, docs, specName, obfuscatedName, terms, and monitor flags are already initialized in initializeIndexSpec
-  flags = (IndexFlags)LoadUnsigned_IOError(rdb, goto cleanup);
-  // Note: monitorDocumentExpiration and monitorFieldExpiration are already set in initializeIndexSpec
+  flags = (IndexFlags)LoadUnsigned_IOError(rdb, goto cleanup_name);
   if (encver < INDEX_MIN_NOFREQ_VERSION) {
     flags |= Index_StoreFreqs;
   }
   IndexSpec_NormalizeStorageFlagsOnLoad(&flags);
-  numFields_u64 = LoadUnsigned_IOError(rdb, goto cleanup);
+  numFields_u64 = LoadUnsigned_IOError(rdb, goto cleanup_name);
 
   if (unlikely(numFields_u64 > SPEC_MAX_FIELDS)) {
     QueryError_SetWithoutUserDataFmt(status, QUERY_ERROR_CODE_LIMIT,
                            "RDB Load: Schema is limited to %d fields",
                            SPEC_MAX_FIELDS);
-    goto cleanup;
+    goto cleanup_name;
   }
 
+  // Allocate only once the spec can be fully initialised: IndexSpec_Free relies
+  // on the IndexError members that initializeIndexSpec sets up.
+  sp = rm_calloc(1, sizeof(IndexSpec));
+  spec_ref = StrongRef_New(sp, (RefManager_Free)IndexSpec_Free);
+  sp->own_ref = spec_ref;
   initializeIndexSpec(sp, specName, flags, numFields_u64);
 
   IndexSpec_MakeKeyless(sp);
@@ -3439,11 +3438,20 @@ IndexSpec *IndexSpec_RdbLoad(RedisModuleIO *rdb, int encver, bool useSst, QueryE
   return sp;
 
 cleanup:
-  if (sp && sp->diskSpec) {
+  if (sp->diskSpec) {
     // Idempotent — no-op if the open never registered on this path.
     SearchDisk_CloseIndexOnMainThread(ctx, sp);
   }
+  // SchemaRule_RdbLoad and the alias loop publish the spec in the global prefix
+  // trie and alias table as non-owning copies of spec_ref. Unregister before the
+  // last reference goes, or the next matching write dereferences a freed spec.
+  SchemaPrefixes_RemoveSpec(spec_ref);
+  IndexSpec_ClearAliases(spec_ref);
   StrongRef_Release(spec_ref);
+  goto cleanup_no_index;
+cleanup_name:
+  // specName is handed to the spec only in initializeIndexSpec.
+  HiddenString_Free(specName, true);
 cleanup_no_index:
   QueryError_SetError(status, QUERY_ERROR_CODE_PARSE_ARGS, "while reading an index");
   return NULL;
```

**File**: `tests/pytests/test_index.py` (modified, +34/-0)
```diff
@@ -235,3 +235,37 @@ def test_restore_schema(env: Env):
 
     # Test that synonyms were also restored correctly
     env.expect('FT.SYNDUMP', 'idx').equal(['cat', ['meow'], 'dog', ['bark']])
+
+@skip(cluster=True)
+def test_restore_schema_rejects_truncated_payload(env: Env):
+    """A schema payload that fails partway through loading must be rejected
+    without crashing and without leaving the half-loaded index registered
+    in the prefix trie or the alias table."""
+    env.cmd('DEBUG', 'MARK-INTERNAL-CLIENT')
+    env.expect('FT.CREATE', 'idx', 'PREFIX', 1, 'doc:', 'SCHEMA', 't', 'TEXT', 'n', 'NUMERIC').ok()
+    # Two aliases: a cut inside the second leaves the first registered unless
+    # the failure path unregisters it.
+    env.expect('FT.ALIASADD', 'a1', 'idx').ok()
+    env.expect('FT.ALIASADD', 'a2', 'idx').ok()
+    dump, encode = env.cmd(debug_cmd(), 'DUMP_SCHEMA', 'idx', NEVER_DECODE=True)
+    env.expect('FT.DROPINDEX', 'idx').ok()
+
+    # Every proper prefix of the payload fails at a different point of the loader.
+    for cut in range(len(dump)):
+        env.expect('_FT._RESTOREIFNX', 'SCHEMA', encode, dump[:cut]).error() \
+           .contains('Failed to deserialize schema')
+
+    env.assertEqual(env.cmd('FT._LIST'), [])
+    prefixes = env.cmd(debug_cmd(), 'DUMP_PREFIX_TRIE')
+    env.assertEqual(prefixes[prefixes.index('prefixes_count') + 1], 0)
+    env.expect('FT.ALIASDEL', 'a1').error().contains('Alias does not exist')
+    env.expect('FT.ALIASDEL', 'a2').error().contains('Alias does not exist')
+    # A write under the prefix must not reach a freed spec.
+    env.expect('HSET', 'doc:1', 't', 'hello', 'n', 1).equal(2)
+    env.assertTrue(env.cmd('PING'))
+
+    # The intact payload still restores, and writes under the prefix are indexed.
+    # (A restored schema does not scan existing keys, so only doc:2 is expected.)
+    env.expect('_FT._RESTOREIFNX', 'SCHEMA', encode, dump).ok()
+    env.expect('HSET', 'doc:2', 't', 'hello', 'n', 2).equal(2)
+    env.expect('FT.SEARCH', 'idx', 'hello', 'NOCONTENT').equal([1, 'doc:2'])
```

---

### Incident Patch 12: `10e49913` (2026-10-01)
**Commit Message**: Fix crash loading a legacy RDB index whose fields were saved without a path (#11630)

* Add tests for loading legacy byte offsets from an RDB

Build a legacy (encver 16) index spec RDB file in the test and start the
server from it. One test checks that byte offsets which exactly fill
their blob load and upgrade. The other gives the offsets a length prefix
larger than the blob, which must fail the load with a diagnostic rather
than crash the server.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Fail legacy RDB loads with truncated byte offsets

LoadByteOffsets trusted the counts and lengths in the serialized blob,
so a blob shorter than its own length prefix made it read past the end
of the buffer, after allocating as much as the prefix claimed. Check
each read against the bytes remaining and return NULL when the blob is
short. DocTable_LegacyRdbLoad, its only caller, now logs and fails the
load in that case.

Failing the load also needs the legacy spec's cleanup to be safe:
IndexSpec_LegacyRdbLoad never initialized the spec's IndexError, so
freeing the spec on any load error hit an assertion (debug) or a NULL
dereference (release). Initialize it when the spec is created, a

**File**: `src/spec.c` (modified, +3/-1)
```diff
@@ -2617,7 +2617,9 @@ static int FieldSpec_RdbLoadCompat8(RedisModuleIO *rdb, FieldSpec *f, int encver
   char* name = NULL;
   size_t len = 0;
   LoadStringBufferAlloc_IOErrors(rdb, name, &len, true, goto fail);
-  f->fieldName = NewHiddenString(name, len, true);
+  f->fieldName = NewHiddenString(name, len, false);
+  // These encodings predate field paths; a field without one uses its name, as elsewhere.
+  f->fieldPath = f->fieldName;
   // the old versions encoded the bit id of the field directly
   // we convert that to a power of 2
   if (encver < INDEX_MIN_WIDESCHEMA_VERSION) {
```

**File**: `tests/pytests/test_legacy_module_types.py` (modified, +73/-6)
```diff
@@ -192,6 +192,7 @@ def testLegacyIndexSpecRestoreIsRefused(env):
 
 
 RDB_MODULE_OPCODE_FLOAT = 3
+RDB_MODULE_OPCODE_DOUBLE = 4
 RDB_MODULE_OPCODE_STRING = 5
 RDB_OPCODE_SELECTDB = 0xFE
 RDB_OPCODE_EOF = 0xFF
@@ -215,6 +216,15 @@ def _module_float(value):
     return _save_len(RDB_MODULE_OPCODE_FLOAT) + struct.pack('<f', value)
 
 
+def _module_double(value):
+    return _save_len(RDB_MODULE_OPCODE_DOUBLE) + struct.pack('<d', value)
+
+
+def _module_sint(value):
+    # Redis saves a signed value as the unsigned integer with the same bits.
+    return _module_uint(value & 0xFFFFFFFFFFFFFFFF)
+
+
 def _byte_offsets(fields, data, data_len=None):
     """Serialize byte offsets the way RSByteOffsets_Serialize does. `data_len` overrides the length
     prefix so the blob can claim more data than it carries."""
@@ -252,23 +262,29 @@ def _legacy_spec_body(doc, encver):
 
 
 def _write_legacy_spec_rdb(env, doc, encver=LEGACY_SPEC_ENC_VER):
-    """Stop the server and replace its RDB file with one holding a single legacy index spec. A legacy
-    spec is only upgraded during the first RDB load after the module loads, so it cannot be RESTOREd
-    (see testLegacyIndexSpecRestoreIsRefused) and has to come from the file the server starts from.
-    Returns the server's log file path."""
+    """`_write_legacy_spec_body_rdb` for the spec built by `_legacy_spec_body`."""
+    return _write_legacy_spec_body_rdb(env, _legacy_spec_body(doc, encver), encver)
+
+
+def _write_legacy_spec_body_rdb(env, body, encver):
+    """Stop the server and replace its RDB file with one holding a single legacy index spec, the
+    encver-`encver` `ft_index0` value `body`. A legacy spec is only upgraded during the first RDB load
+    after the module loads, so it cannot be RESTOREd (see testLegacyIndexSpecRestoreIsRefused) and has
+    to come from the file the server starts from. Returns the server's log file path."""
     conn = _binary_conn(env)
     rdb_version = _rdb_version(conn)
     db_dir = env.cmd('CONFIG', 'GET', 'dir')[1]
     rdb_path = os.path.join(db_dir, env.cmd('CONFIG', 'GET', 'dbfilename')[1])
     log_path = os.path.join(db_dir, env.cmd('CONFIG', 'GET', 'logfile')[1])
     env.stop()
 
-    key = b'idx'
+    # INDEX_SPEC_KEY_FMT for the spec named `idx`: the key the upgrade deletes once it has loaded it.
+    key = b'idx:idx'
     rdb = (b'REDIS%04d' % rdb_version
            + bytes([RDB_OPCODE_SELECTDB]) + _save_len(0)
            + bytes([RDB_TYPE_MODULE_2]) + _save_len(len(key)) + key
            + _save_len(_module_type_id('ft_index0', encver))
-           + _legacy_spec_body(doc, encver)
+           + body
            + _save_len(RDB_MODULE_OPCODE_EOF)
            + bytes([RDB_OPCODE_EOF]))
     with open(rdb_path, 'wb') as f:
@@ -344,6 +360,57 @@ def testLegacySpecWithDeletedPayloadDocLoadsExpireEncoding():
     env.assertEqual(info['num_docs'], 0)
 
 
+# The newest encoding whose fields have no separate path (INDEX_MIN_TAGFIELD_VERSION - 1).
+LEGACY_SPEC_NO_FIELD_PATH_ENC_VER = 7
+INDEXFLD_T_FULLTEXT = 0x01
+
+
+def _legacy_spec_body_no_field_path():
+    """An encver-7 `ft_index0` value: an index `idx` with one TEXT field `t` and no documents. Fields
+    of this encoding have a name but no path."""
+    return (_module_string(b'idx\0')
+            + _module_uint(0)            # index flags
+            + _module_uint(1)            # number of fields
+            + _module_string(b't\0')     # field name
+            + _module_uint(0)            # field id
+            + _module_uint(INDEXFLD_T_FULLTEXT)
+            + _module_double(1.0)        # weight
+            + _module_uint(0)            # field options
+            + _module_sint(-1)           # sort index: not sortable
+            + _module_uint(0) * 10       # index stats
+            # Doc table: size (one past the last doc) and max doc id; this encoding has no max size.
+            + _module_uint(1) + _module_uint(0)
+            + _module_uint(0))           # terms trie size
+
+
+@skip(cluster=True)
+def testLegacySpecWithoutFieldPathLoads():
+    """A field from an encoding that predates field paths loads with its name as its path, so the
+    upgraded index serves the field. The path used to stay NULL, which crashed the server while the
+    load built the spec's field cache."""
+    env = Env(moduleArgs='UPGRADE_INDEX idx; PREFIX 1 doc')
+    skipOnExistingEnv(env)
+    _write_legacy_spec_body_rdb(env, _legacy_spec_body_no_field_path(),
+                                LEGACY_SPEC_NO_FIELD_PATH_ENC_VER)
+    env.start()
+    env.assertTrue(env.isUp())
+    info = index_info(env, 'idx')
+    env.assertEqual(info['index_name'], 'idx')
+    attribute = to_dict(info['attributes'][0])
+    env.assertEqual(attribute['identifier'], 't')
+    env.assertEqual(attribute['attribute'], 't')
+
+    env.expect('HSET', 'doc:1', 't', 'hello').equal(1)
+    env.expect('FT.SEARCH', 'idx', 'hello', 'NOCONTENT').equal([1, 'doc:1'])
+
+    # Saving the upgraded in
```

---

### Incident Patch 13: `94a788eb` (2026-10-01)
**Commit Message**: [MOD-15685] Fix a race in testLegacyIndexSpecRestoreIsRefusedAfterFailedLoad (#11683)

[MOD-15685] Fix a race in the legacy-spec restore-after-failed-load test

The helper waited for the replica to stop answering LOADING before
promoting it, but the replica can answer before it has started loading
the truncated sync at all. The test then promoted it with no failed load
and its precondition check failed. Wait for the failed sync to appear in
the server log instead.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tests/pytests/test_legacy_module_types.py` (modified, +6/-6)
```diff
@@ -344,7 +344,7 @@ def testLegacySpecWithDeletedPayloadDocLoadsExpireEncoding():
     env.assertEqual(info['num_docs'], 0)
 
 
-def _fail_full_sync(env, shard_mock):
+def _fail_full_sync(env, shard_mock, sync_failed):
     """Make the server a replica of `shard_mock` and cut its full sync short, so the load fails.
 
     The load has to be diskless: a truncated RDB loaded from disk makes Redis exit instead of firing
@@ -366,12 +366,11 @@ def _fail_full_sync(env, shard_mock):
     conn.flush()
     conn.close()
 
+    # The server can answer commands before it starts loading, so wait for the failure itself.
     for _ in range(100):
-        try:
-            env.cmd('PING')
+        if sync_failed():
             break
-        except redis.exceptions.BusyLoadingError:
-            time.sleep(0.1)
+        time.sleep(0.1)
     env.cmd('REPLICAOF', 'NO', 'ONE')
 
 
@@ -396,7 +395,8 @@ def testLegacyIndexSpecRestoreIsRefusedAfterFailedLoad(env):
     failedSyncMsg = 'Failed trying to load the MASTER synchronization DB'
     failedSyncsBefore = _grep_file_count(logFilePath, failedSyncMsg)
     with ShardMock(env) as shardMock:
-        _fail_full_sync(env, shardMock)
+        _fail_full_sync(env, shardMock,
+                        lambda: _grep_file_count(logFilePath, failedSyncMsg) > failedSyncsBefore)
     env.assertGreater(_grep_file_count(logFilePath, failedSyncMsg), failedSyncsBefore,
                       message='the full sync did not fail, so this test proves nothing')
 
```

---

### Incident Patch 14: `b53b4d32` (2026-10-01)
**Commit Message**: [MOD-17347] Prevent crash-report hangs after query crashes (#11276)

* [MOD-17347] Prevent crash report deadlocks

* [MOD-17347] Reconcile crash reporting with master

**File**: `src/redisearch_rs/c_entrypoint/module_init_ffi/src/lib.rs` (modified, +42/-38)
```diff
@@ -76,10 +76,13 @@ pub unsafe extern "C" fn TracingRedisModule_SetLogLevel(level: *const c_char) {
 /// [`RustPanicHook_Init`] and emitted inside the crash report by
 /// [`AddToInfo_RustBacktrace`].
 ///
-/// Strings are stored as-is, without truncation. `payload` and `location`
+/// Values are stored without truncation as null-terminated C strings. Interior
+/// null bytes are sanitized by [`info_cstring`]. `payload` and `location`
 /// match the rendering of the hook's `tracing::error!` log line: the literal
 /// `None` for a non-string payload or a missing location. `recorded_at` is
-/// captured at hook time by [`format_utc_timestamp`].
+/// captured at hook time by [`format_utc_timestamp`]. The backtrace is also
+/// captured and rendered by the hook so the fatal-signal callback only reads
+/// immutable buffers.
 ///
 /// The stash outlives the panic: a panic crossing an `extern "C"` boundary
 /// aborts right away, but a panic that unwinds and is caught, or one on a
@@ -88,9 +91,10 @@ pub unsafe extern "C" fn TracingRedisModule_SetLogLevel(level: *const c_char) {
 /// the reader tell the two apart by comparing it against the crash log line's
 /// own timestamp prefix.
 struct StashedPanic {
-    payload: String,
-    location: String,
-    recorded_at: String,
+    payload: CString,
+    location: CString,
+    recorded_at: CString,
+    backtrace: CString,
 }
 
 /// The process-wide stash, written by the hook installed in
@@ -112,9 +116,10 @@ static PANIC_STASH: OnceLock<StashedPanic> = OnceLock::new();
 pub extern "C" fn RustPanicHook_Init() {
     let previous_hook = std::panic::take_hook();
     std::panic::set_hook(Box::new(move |panic_info| {
-        // We don't capture a backtrace here, since it should be included
-        // in the crash report generated by the module info function
-        // if `for_crash_report` is set to `true`.
+        let payload = panic_info.payload_as_str().unwrap_or("None");
+        let location = panic_info
+            .location()
+            .map_or("None".to_owned(), |location| location.to_string());
         tracing::error!(
             panic.payload = panic_info.payload_as_str(),
             panic.location = panic_info.location().map(|l| l.to_string()),
@@ -123,14 +128,16 @@ pub extern "C" fn RustPanicHook_Init() {
 
         // The log line above lands above the crash report's START marker,
         // outside the span users are asked to copy; the stash rides the
-        // module INFO callback instead, which runs inside the report.
-        let _ = PANIC_STASH.set(StashedPanic {
-            payload: panic_info.payload_as_str().unwrap_or("None").to_owned(),
-            location: panic_info
-                .location()
-                .map_or_else(|| "None".to_owned(), |l| l.to_string()),
-            recorded_at: format_utc_timestamp(SystemTime::now()),
-        });
+        // module INFO callback instead, which runs inside the report. Avoid
+        // rebuilding it when the hook fires again for the nested FFI panic.
+        if PANIC_STASH.get().is_none() {
+            let _ = PANIC_STASH.set(StashedPanic {
+                payload: info_cstring(payload),
+                location: info_cstring(location),
+                recorded_at: info_cstring(format_utc_timestamp(SystemTime::now())),
+                backtrace: info_cstring(std::backtrace::Backtrace::force_capture().to_string()),
+            });
+        }
 
         // Invoke the previous panic hook, if any.
         previous_hook(panic_info);
@@ -166,24 +173,28 @@ fn info_cstring(value: impl Into<Vec<u8>>) -> CString {
     }
 }
 
-/// Add the current backtrace as a new section to the report printed
-/// by RediSearch's INFO command.
+/// Add the stashed Rust panic backtrace to the crash report.
 ///
-/// When a Rust panic was stashed in [`PANIC_STASH`], its details are emitted
-/// in the same section, ahead of the backtrace.
+/// When no Rust panic was stashed, this is a no-op. In particular, a C crash
+/// does not attempt to initialize or capture a Rust backtrace from the fatal
+/// signal handler.
 ///
 /// A null `ctx` is a no-op.
 ///
 /// # Safety
 ///
-/// `ctx` must either be null or point to a valid `RedisModuleInfoCtx`.
+/// `ctx` must either be null or point to a [valid] `RedisModuleInfoCtx`.
+///
+/// [valid]: https://doc.rust-lang.org/std/ptr/index.html#safety
 #[unsafe(no_mangle)]
 pub unsafe extern "C" fn AddToInfo_RustBacktrace(ctx: *mut redis_module::RedisModuleInfoCtx) {
     if ctx.is_null() {
         return;
     }
 
-    let backtrace_cstr = info_cstring(std::backtrace::Backtrace::force_capture().to_string());
+    let Some(stashed) = PANIC_STASH.get() else {
+        return;
+    };
 
     // SAFETY: `RedisModule_InfoAddSection` has been initialized during module load.
     let info_add_section = unsafe { redis_module::RedisModule_InfoAddSection.unwrap() };
@@ -193,22 +204,15 @@ pub unsafe extern "C" fn AddToInfo_RustBacktrace(ctx: *mut redis_module::RedisMo
   
```

**File**: `src/redisearch_rs/headers/module_init_ffi.h` (modified, +7/-5)
```diff
@@ -18,17 +18,19 @@ extern "C" {
 #endif // __cplusplus
 
 /**
- * Add the current backtrace as a new section to the report printed
- * by RediSearch's INFO command.
+ * Add the stashed Rust panic backtrace to the crash report.
  *
- * When a Rust panic was stashed in [`PANIC_STASH`], its details are emitted
- * in the same section, ahead of the backtrace.
+ * When no Rust panic was stashed, this is a no-op. In particular, a C crash
+ * does not attempt to initialize or capture a Rust backtrace from the fatal
+ * signal handler.
  *
  * A null `ctx` is a no-op.
  *
  * # Safety
  *
- * `ctx` must either be null or point to a valid `RedisModuleInfoCtx`.
+ * `ctx` must either be null or point to a [valid] `RedisModuleInfoCtx`.
+ *
+ * [valid]: https://doc.rust-lang.org/std/ptr/index.html#safety
  */
 void AddToInfo_RustBacktrace(struct RedisModuleInfoCtx *ctx);
 
```

**File**: `tests/pytests/test_crash.py` (modified, +7/-2)
```diff
@@ -212,8 +212,8 @@ def _test_query_thread_crash(env):
     # A C crash stashes no Rust panic, so the bug report must not carry
     # Rust-panic fields.
     report_lines = bug_report_span(read_log_lines(log_path))
-    for field in ("search_panic_payload", "search_panic_location",
-                  "search_panic_recorded_at"):
+    for field in ("search_rust_backtrace", "search_panic_payload",
+                  "search_panic_location", "search_panic_recorded_at"):
         env.assertFalse(
             any(field in line for line in report_lines),
             message=f"{field} found in the bug report of a C crash",
@@ -247,6 +247,7 @@ def test_query_thread_crash_with_rust_panic():
             "search_index_properties_in_mb:",
             # The backtrace
             "# search_rust_backtrace",
+            "search_backtrace:",
         ],
         crash_in_rust=True,
         crash_report_only=True,
@@ -311,6 +312,10 @@ def test_query_thread_crash_with_rust_panic():
 
     # Verify Rust backtrace section is present
     env.assertIn("search_rust_backtrace", results["# search_rust_backtrace"])
+    env.assertTrue(
+        re.search(r"\d+:", results["search_backtrace:"]),
+        message="Rust panic backtrace is empty",
+    )
 
 
 def crash_main_thread(conn):
```

---

### Incident Patch 15: `938a026f` (2026-09-30)
**Commit Message**: Fix intermittent Rocky Linux 8 CI failures when installing gcc (#11655)

Let Rocky Linux 8 CI fall back to an older gcc during mirror skew

dnf on Rocky 8 defaults to best=True, so the Development Tools groupinstall
must install the newest gcc or fail. gcc/gcc-c++ (AppStream) pin libstdc++,
libgcc and libgomp (BaseOS) to the same version, and mirrors sync the two
repos independently. On a mirror whose AppStream already has gcc 8.5.0-29
while BaseOS is still at -28, the install fails with "nothing provides
libstdc++ = 8.5.0-29", even though gcc -28 is available. Retries reuse the
same cached metadata and mirror, so they fail the same way, and the Rocky 8
jobs fail intermittently depending on which mirror they land on.

Pass --nobest, as the gcc-toolset install in the same script already does,
so dnf installs the newest consistent gcc. Once the mirror catches up the
newest one installs as before. No --skip-broken, so a genuinely missing gcc
still fails.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.install/rocky_linux_8.sh` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ dnf_install dnf-plugins-core
 
 # Keep the large group out of list mode; package checks below cover build deps.
 if [[ "${CHECK_DEPS:-0}" != 1 ]] && ! rpm -q gcc gcc-c++ make >/dev/null 2>&1; then
-    _sh "$MODE dnf groupinstall \"Development Tools\" -yqq < /dev/null"
+    _sh "$MODE dnf groupinstall \"Development Tools\" -yqq --nobest < /dev/null"
 fi
 
 # powertools (Rocky/Alma) or codeready-builder (RHEL) is needed to install epel
```

#### Recent Merged Pull Requests:
- **PR #11782** (2026-10-05): [8.4] [MOD-16881] Fix flaky test_vecsim_info_stats_marked_deleted on OSS cluster (@alonre24)
- **PR #11781** (2026-10-05): [8.6] [MOD-16881] Fix flaky test_vecsim_info_stats_marked_deleted on OSS cluster (@alonre24)
- **PR #11776** (2026-10-05): Revert "[CI] Do not block PRs and the merge queue on Codecov upload failures" (@GuyAv46)
- **PR #11771** (2026-10-05): [CI] Do not block PRs and the merge queue on Codecov upload failures (@GuyAv46)
- **PR #11769** (closed): [8.6-rse] [MOD-19323] Skip flaky TestCoordinatorTimeout tests until 2026-10-18 (@alonre24)
- **PR #11767** (2026-10-05): [MOD-18890] Skip Vamana batches recall test for one week (@GuyAv46)
- **PR #11765** (2026-10-05): [CI] Require redisbench_admin 0.12.39 for the benchmark runner (@GuyAv46)
- **PR #11764** (2026-10-04): [MOD-18584] Fix stack exhaustion in APPLY expressions with many function arguments (@kei-nan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
