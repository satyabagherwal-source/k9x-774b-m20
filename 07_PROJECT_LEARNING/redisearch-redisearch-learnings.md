> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `724e39f0`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T17:51:53.875Z  
> **Learning ID**: `learn-github-redisearch-redisearch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): RediSearch/RediSearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T17:51:53.192Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RediSearch/RediSearch`
- **Description**: A query and indexing engine for Redis, providing secondary indexing, full-text search, vector similarity search and aggregations.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6242 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11881** (2026-10-14): **[BUG] Documents are silently not indexed when they have no indexable field value but do have a `SORTABLE` value**
  *Symptoms*: **Describe the bug** A document is silently skipped by the indexer when both of the following hold:  1. it has no value for any indexable field, and 2. it has a value for at least one `SORTABLE` field.  **To Reproduce** One schema with three fields — an indexable one, a sortable `NOINDEX` one, and a plain `NOINDEX` one — and one document exercising each:  FT.CREATE idx ON HASH PREFIX 1 doc: SCHEMA     indexed          TAG INDEXMISSING     sortable_noindex TAG SORTABLE UNF NOINDEX     plain_noindex    TAG NOINDEX  HSET doc:1 indexed          red HSET doc:2 sortable_noindex x HSET doc:3 plain_noindex    p  **Expected behavior** FT.INFO idx num_docs               => 2      <-- expected 3 hash_indexing_failures => 0      <-- nothing reported  FT.SEARCH idx "*" NOCONTENT 1) 2 2) doc:1 3) doc:3                         <-- doc:2 is missing  FT.SEARCH idx "ismissing(@ indexed)" NOCONTENT DIALECT 2 1) 1 2) doc:3                         <-- doc:2 also has no `indexed` value   **Environment (please complete the following information):** on `master` @ `3635ada5fed6aec58eba05c606ff3bc641b41c08` or earlier version like 8.9.90 8.11.80   **Additional context** Root cause   both `doc:2` and `doc:3`,  flag `ACTX_F_OTHERINDEXED` and  `ACTX_F_TEXTINDEXED`  is true     int empty = (RSSortingVector_Length(&aCtx->sv) == 0) && !hasTextFields && !hasOtherFields;   if (empty) {     aCtx->stateFlags |= ACTX_F_EMPTY;   } but `doc:2` with ACTX_F_EMPTY false while `doc:3` true.   if (ACTX_IS_INDEXED(aCtx)

- **Issue #11274** (2026-09-01): **[BUG] FT.SEARCH intermittently does not fail with given timeout when `search-on-timeout` set to `fail`**
  *Symptoms*: ❗**IMPORTANT**  ❗ The issue caught by the **Jedis** nightly tests CI against **Redis** `unstable` image, please see the additional context below.  **Describe the bug**  With `search-on-timeout fail` and `search-workers > 0`, a query that exceeds its `TIMEOUT` usually returns a **successful, complete result set** instead of `SEARCH_TIMEOUT Timeout limit was reached`. The timeout is exceeded on every execution — the identical query under `search-on-timeout return` reports the timeout warning on every run — yet under `fail` the error is only returned sporadically. The outcome looks like a race between the background worker completing the query and the blocked-client timeout callback; when the worker wins, the deadline is ignored.  Regression on `master`, introduced between the 2026-08-26 and 2026-08-27 nightly builds. #10961 (merged 2026-08-27 11:11 UTC) is the only commit in that window touching timeout handling and rewrote exactly this path (`QueryRequestTimeout`, FAIL enforcement for background execution).  **To Reproduce**  Pure `redis-cli`, no client library:  1. `docker run -d --rm --name repro -e TLS_ENABLED=false redislabs/client-libs-test:unstable-33278213642-debian` (Redis unstable + RediSearch `master` as of 2026-08-29, `search-workers 16` preconfigured; server on port 3000) 2. ```sh    docker exec repro sh -c '      redis-cli -p 3000 ft.create idx SCHEMA title TEXT n NUMERIC SORTABLE      for i in $(seq 0 9999); do echo "hset doc:$i title \"hello world $i\" n $i"; do

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

### Incident Patch 1: `8ad57da6` (2026-10-22)
**Commit Message**: [MOD-19619] Prevent crashes when hybrid shard profiles are incomplete (#11967)

* [MOD-19619] Prevent crashes when hybrid shard profiles are incomplete

* Assert hybrid shard profile invariants

* Disable query timeout in hybrid profile structure test

**File**: `src/coord/hybrid/dist_hybrid.c` (modified, +40/-23)
```diff
@@ -539,21 +539,35 @@ static void setupCoordinatorArrangeSteps(AREQ *searchRequest, AREQ *vectorReques
 
 // Helper function to extract shard profile from a reply based on protocol version
 static MRReply *extractShardProfile(MRReply *current, bool resp3) {
+  // RPNet collects complete shard profiles or errors; timeouts can shorten the list.
+  RS_LOG_ASSERT(current, "Collected shard profile must not be NULL");
   if (MRReply_Type(current) == MR_REPLY_ERROR) {
     return current;
   }
+  MRReply *shards;
   if (resp3) {
     // RESP3: profile -> Shards -> [shard_profile]
-    MRReply *shards = MRReply_MapElement(current, PROFILE_SHARDS_STR);
-    return MRReply_ArrayElement(shards, 0);
+    RS_LOG_ASSERT(MRReply_Type(current) == MR_REPLY_MAP && MRReply_Length(current) >= 2 &&
+                      MRReply_Length(current) % 2 == 0,
+                  "RESP3 profile must be a nonempty map");
+    shards = MRReply_MapElement(current, PROFILE_SHARDS_STR);
   } else {
-    // RESP2: [results, shards_array] -> shards_array[0] is the shard profile
-    MRReply *shards_array_profile = MRReply_ArrayElement(current, 1);
-    MRReply *profile = MRReply_ArrayElement(shards_array_profile, 0);
+    // RESP2: ["Shards", shards_array, ...] -> shards_array[0] is the shard profile
+    RS_LOG_ASSERT(MRReply_Type(current) == MR_REPLY_ARRAY && MRReply_Length(current) >= 2,
+                  "RESP2 profile must contain the Shards key and array");
+    shards = MRReply_ArrayElement(current, 1);
+  }
+  RS_LOG_ASSERT(shards && MRReply_Type(shards) == MR_REPLY_ARRAY && MRReply_Length(shards) > 0,
+                "Shards must contain a shard profile");
+  MRReply *profile = MRReply_ArrayElement(shards, 0);
+  RS_LOG_ASSERT(profile && MRReply_Length(profile) >= 2 && MRReply_Length(profile) % 2 == 0,
+                "Shard profile must contain key-value pairs");
+  if (!resp3) {
     // Convert to map for easier access (modifies in place)
     MRReply_ArrayToMap(profile);
-    return profile;
   }
+  RS_LOG_ASSERT(MRReply_Type(profile) == MR_REPLY_MAP, "Shard profile must be a map");
+  return profile;
 }
 
 // Helper function to extract Shard ID MRReply from a shard profile
@@ -567,7 +581,7 @@ static MRReply *extractShardIdReply(MRReply *shardProfile) {
 
 // Helper function to print a profile map excluding the "Shard ID" field
 static void printProfileExcludingShardId(RedisModule_Reply *reply, MRReply *profile) {
-  if (!profile || MRReply_Type(profile) == MR_REPLY_ERROR) {
+  if (MRReply_Type(profile) == MR_REPLY_ERROR) {
     MR_ReplyWithMRReply(reply, profile);
     return;
   }
@@ -595,7 +609,8 @@ static void printProfileExcludingShardId(RedisModule_Reply *reply, MRReply *prof
 void printShardsHybridProfile(RedisModule_Reply *reply, void *ctx) {
   HybridRequest *hreq = ctx;
   // New format: group by shard with Shard ID printed once per shard
-  // [{"Shard ID": "id", "SEARCH": profile (without Shard ID), "VSIM": profile (without Shard ID)}, ...]
+  // [{"Shard ID": "id", "SEARCH": profile (without Shard ID), "VSIM": profile (without Shard ID)},
+  // ...]
 
   // Get RPNets for SEARCH and VSIM requests
   AREQ *searchAreq = hreq->requests[SEARCH_INDEX];
@@ -604,24 +619,26 @@ void printShardsHybridProfile(RedisModule_Reply *reply, void *ctx) {
   RPNet *vsimRpnet = (RPNet *)AREQ_QueryProcessingCtx(vsimAreq)->rootProc;
 
   size_t searchCount = array_len(searchRpnet->shardsProfile);
-
-  bool resp3 = reply->resp3;
-
-  // Iterate over shards and print both SEARCH and VSIM profiles for each shard
-  for (size_t i = 0; i < searchCount; i++) {
+  size_t vsimCount = array_len(vsimRpnet->shardsProfile);
+
+  // The subqueries collect profiles independently; a timeout can leave either list shorter.
+  // Decode using each shard command's protocol, which can differ from the client's protocol.
+  for (size_t i = 0; i < MAX(searchCount, vsimCount); i++) {
+    MRReply *searchProfile = i < searchCount ? extractShardProfile(searchRpnet->shardsProfile[i],
+                                                                   searchRpnet->cmd.protocol == 3)
+                                             : NULL;
+    MRReply *vsimProfile = i < vsimCount ? extractShardProfile(vsimRpnet->shardsProfile[i],
+                                                               vsimRpnet->cmd.protocol == 3)
+                                         : NULL;
     RedisModule_Reply_Map(reply);  // Start shard map
 
-    // Extract shard profiles
-    MRReply *searchProfile = extractShardProfile(searchRpnet->shardsProfile[i], resp3);
-    MRReply *vsimProfile = extractShardProfile(vsimRpnet->shardsProfile[i], resp3);
-
-    // Extract and print Shard ID from SEARCH profile
-    MRReply *shardIdReply = NULL;
-    if (searchProfile) {
-      shardIdReply = extractShardIdReply(searchProfile);
-      RedisModule_Reply_SimpleString(reply, "Shard ID");
-      MR_ReplyWithMRReply(reply, shardIdReply);
+    // Use the available profile when SEARCH is missing or c
```

**File**: `tests/cpptests/coord_tests/test_cpp_hybrid_profile.cpp` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+/*
+ * Copyright (c) 2006-Present, Redis Ltd.
+ * All rights reserved.
+ *
+ * Licensed under your choice of the Redis Source Available License 2.0
+ * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
+ * GNU Affero General Public License v3 (AGPLv3).
+ */
+
+#include "gtest/gtest.h"
+#include "redismock/redismock.h"
+extern "C" {
+#include "reply.h"
+}
+#include "hybrid/hybrid_request.h"
+#include "hiredis/hiredis.h"
+#include "coord/rpnet.h"
+
+#include <memory>
+#include <string>
+#include <tuple>
+#include <vector>
+
+extern "C" void printShardsHybridProfile(RedisModule_Reply *reply, void *ctx);
+
+class HybridProfileTest : public ::testing::TestWithParam<std::tuple<bool, bool>> {
+ protected:
+  RedisModuleCtx *ctx = nullptr;
+  std::vector<std::unique_ptr<MRReply, decltype(&MRReply_Free)>> replies;
+
+  bool shardResp3() const {
+    return std::get<0>(GetParam());
+  }
+
+  void SetUp() override {
+    ctx = RedisModule_GetThreadSafeContext(nullptr);
+  }
+  void TearDown() override {
+    RedisModule_FreeThreadSafeContext(ctx);
+  }
+
+  MRReply *parse(const std::string &wire) {
+    redisReader *reader = redisReaderCreate();
+    EXPECT_EQ(redisReaderFeed(reader, wire.data(), wire.size()), REDIS_OK);
+    void *reply = nullptr;
+    EXPECT_EQ(redisReaderGetReply(reader, &reply), REDIS_OK);
+    redisReaderFree(reader);
+    EXPECT_NE(reply, nullptr);
+    replies.emplace_back(static_cast<MRReply *>(reply), MRReply_Free);
+    return replies.back().get();
+  }
+
+  std::string wrap(const std::string &profile) {
+    return (shardResp3() ? "%1\r\n+Shards\r\n*1\r\n" : "*2\r\n+Shards\r\n*1\r\n") + profile;
+  }
+
+  MRReply *validProfile() {
+    return parse(wrap(std::string(shardResp3() ? "%2" : "*4") +
+                      "\r\n+Shard ID\r\n+shard-1\r\n+Warning\r\n+None\r\n"));
+  }
+
+  void check(const std::vector<MRReply *> &search, const std::vector<MRReply *> &vsim, size_t count,
+             const std::string &expected) {
+    AREQ searchAreq = {}, vsimAreq = {};
+    RPNet searchRpnet = {}, vsimRpnet = {};
+    searchRpnet.cmd.protocol = vsimRpnet.cmd.protocol = shardResp3() ? 3 : 2;
+    // Allocate exactly the collected count, so ASan catches reading past either list.
+    if (!search.empty()) {
+      searchRpnet.shardsProfile = array_new(MRReply *, search.size());
+      for (auto *profile : search) array_append(searchRpnet.shardsProfile, profile);
+    }
+    if (!vsim.empty()) {
+      vsimRpnet.shardsProfile = array_new(MRReply *, vsim.size());
+      for (auto *profile : vsim) array_append(vsimRpnet.shardsProfile, profile);
+    }
+    AREQ_QueryProcessingCtx(&searchAreq)->rootProc = &searchRpnet.base;
+    AREQ_QueryProcessingCtx(&vsimAreq)->rootProc = &vsimRpnet.base;
+    AREQ *requests[] = {&searchAreq, &vsimAreq};
+    HybridRequest hreq = {};
+    hreq.requests = requests;
+
+    RMCK_GetReplyLog(ctx).clear();
+    RedisModule_Reply reply = RedisModule_NewReply(ctx);
+    reply.resp3 = std::get<1>(GetParam());
+    RedisModule_Reply_Array(&reply);
+    printShardsHybridProfile(&reply, &hreq);
+    RedisModule_Reply_ArrayEnd(&reply);
+#ifdef ENABLE_ASSERT
+    EXPECT_EQ(std::string(reply.json), expected);
+#endif
+    RedisModule_EndReply(&reply);
+    EXPECT_EQ(RMCK_GetReplyLog(ctx).back(), "setarray:" + std::to_string(count));
+    array_free(searchRpnet.shardsProfile);
+    array_free(vsimRpnet.shardsProfile);
+  }
+
+  const std::string searchOnly =
+      "{ \"Shard ID\": \"shard-1\", \"SEARCH\": { \"Warning\": \"None\" } }";
+  const std::string vsimOnly = "{ \"Shard ID\": \"shard-1\", \"VSIM\": { \"Warning\": \"None\" } }";
+  const std::string both =
+      "{ \"Shard ID\": \"shard-1\", \"SEARCH\": { \"Warning\": \"None\" }, "
+      "\"VSIM\": { \"Warning\": \"None\" } }";
+};
+
+TEST_P(HybridProfileTest, NoProfiles) {
+  check({}, {}, 0, "[  ]");
+}
+
+TEST_P(HybridProfileTest, CompleteProfiles) {
+  auto *search = validProfile();
+  auto *vsim = validProfile();
+  check({search}, {vsim}, 1, "[ " + both + " ]");
+  // RESP2 profiles are converted to maps in place and must remain readable.
+  check({search}, {vsim}, 1, "[ " + both + " ]");
+}
+
+TEST_P(HybridProfileTest, MissingVsimProfiles) {
+  check({validProfile()}, {}, 1, "[ " + searchOnly + " ]");
+  check({validProfile(), validProfile(), validProfile()}, {validProfile()}, 3,
+        "[ " + both + ", " + searchOnly + ", " + searchOnly + " ]");
+}
+
+TEST_P(HybridProfileTest, MissingSearchProfiles) {
+  check({}, {validProfile()}, 1, "[ " + vsimOnly + " ]");
+  check({validProfile()}, {validProfile(), validProfile(), validProfile()}, 3,
+        "[ " + both + ", " + vsimOnly + ", " + vsimOnly + " ]");
+}
+
+TEST_P(HybridProfileTest, ErrorProfiles) {
+  auto *error = parse("-timeout\r\n");
+  check({error}, {validProfile()}, 1,
+        "[ { \"Shard ID\": \"shard-1\", \"SEARCH\": \"ERR: timeout\", "
+        "\"VSIM\": { \"Warning\": \"None\" } } ]");
+  check({validProfi
```

**File**: `tests/pytests/test_hybrid_profile.py` (modified, +3/-1)
```diff
@@ -683,13 +683,15 @@ def test_profile_standalone_with_background_depletion():
 
 @skip(cluster=False)
 def test_profile_cluster():
-    env = Env(moduleArgs='DEFAULT_DIALECT 2 _PRINT_PROFILE_CLOCK false')
+    # This structure test requires complete profiles from every shard.
+    env = Env(moduleArgs='DEFAULT_DIALECT 2 _PRINT_PROFILE_CLOCK false TIMEOUT 0')
     _setup_index_and_data(env)
     for query, _, _, _, expected_shard_profile, expected_coordinator_profile in query_and_profile:
         actual_res = env.execute_command(*query)
         _verify_profile_structure(env, env.protocol, actual_res)
 
         shard_profiles = actual_res[8][1]
+        env.assertEqual(len(shard_profiles), env.shardsCount, message=f'query: {query}, reply: {actual_res}')
         for i in range(len(shard_profiles)):
             shard_profile = shard_profiles[i]
             # Shard profile is a list of 6 items
```

---

### Incident Patch 2: `95a67995` (2026-10-22)
**Commit Message**: [MOD-19932] Add FT.DEBUG DISK_STATS and the search-disk-statistics config (#11918)

* [MOD-19932] Add FT.DEBUG DISK_STATS and the search-disk-statistics config

FT.DEBUG DISK_STATS <index> [STATS] returns storage-engine diagnostics
for a disk index as text: per-column-family level and block-cache stats
and, with STATS, the sections shared by every index (block-cache entry
stats and storage-engine statistics).

Statistics add per-operation bookkeeping, so they are opt-in through the
new hidden, immutable search-disk-statistics config (default no). It is
load-time only because statistics must be attached before each index
database opens; BasicDiskAPI.open gains an enableStatistics parameter to
carry it. MetricsDiskAPI gains debugDiskStats for the report.

On a non-disk index the command replies with an error.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* [MOD-19932] Accept search-disk-statistics as a module argument

Like search-disk-use-direct-reads, the config gets a legacy setter so it
can be passed with the other module arguments at load time, not only
through the Redis config file. It stays hidden and immutable.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* [MO

**File**: `src/config.c` (modified, +9/-0)
```diff
@@ -2799,6 +2799,15 @@ int RegisterModuleConfig_Local(RedisModuleCtx *ctx) {
     )
   )
 
+  RM_TRY(
+    RedisModule_RegisterBoolConfig(
+      ctx, "search-_disk-statistics", 0,
+      REDISMODULE_CONFIG_HIDDEN | REDISMODULE_CONFIG_IMMUTABLE | REDISMODULE_CONFIG_UNPREFIXED,
+      get_bool_config, set_bool_config, NULL,
+      (void *)&(RSGlobalConfig.diskStatistics)
+    )
+  )
+
   RM_TRY(
     RedisModule_RegisterBoolConfig(
       ctx, "search-_fallback-to-main-thread-when-block-client-unavailable", 1,
```

**File**: `src/config.h` (modified, +4/-0)
```diff
@@ -248,6 +248,9 @@ typedef struct {
   // are intentionally not coupled to any Flex bigredis-driver settings.
   bool diskDropReadCache;
   bool diskUseDirectReads;
+  // Collect storage-engine statistics for disk indexes, reported by FT.DEBUG DISK_STATS.
+  // Load-time only: statistics must be attached before each index database opens.
+  bool diskStatistics;
   // Per-DB SpeedB open-file cap, and the per-index cost charged against the process-wide file-descriptor reservation
   // (see SearchDisk_CanCreateIndex). Immutable, so a deployment with few, very large indexes must set this at startup
   // rather than raising it later.
@@ -521,6 +524,7 @@ static_assert(DISK_ASYNC_READ_POOL_SIZE_MAX * DISK_ASYNC_READ_QUEUE_FACTOR_MAX <
     .diskWbmBudgetPerIndexMB = DEFAULT_DISK_WBM_BUDGET_PER_INDEX_MB,           \
     .diskDropReadCache = false,                                                \
     .diskUseDirectReads = false,                                               \
+    .diskStatistics = false,                                                   \
     .diskMaxOpenFiles = DEFAULT_DISK_MAX_OPEN_FILES,                           \
     .diskAsyncReadPoolSize = DEFAULT_DISK_ASYNC_READ_POOL_SIZE,                \
     .diskAsyncReadQueueFactor = DEFAULT_DISK_ASYNC_READ_QUEUE_FACTOR,          \
```

**File**: `src/debug_commands.c` (modified, +37/-0)
```diff
@@ -3845,6 +3845,42 @@ DEBUG_COMMAND(NumericBucketMap) {
   return REDISMODULE_OK;
 }
 
+// FT.DEBUG DISK_STATS <index> [VERBOSE]
+// Storage-engine level and block-cache stats for every column family of a disk
+// index. VERBOSE appends the sections shared by every index, so callers pass it
+// for one index per shard.
+DEBUG_COMMAND(DiskStats) {
+  if (!debugCommandsEnabled(ctx)) {
+    return RedisModule_ReplyWithError(ctx, NODEBUG_ERR);
+  }
+  if (argc != 3 && argc != 4) {
+    return RedisModule_WrongArity(ctx);
+  }
+  bool withStatistics = false;
+  if (argc == 4) {
+    if (strcasecmp(RedisModule_StringPtrLen(argv[3], NULL), "VERBOSE")) {
+      return RedisModule_ReplyWithError(ctx, "Expected VERBOSE");
+    }
+    withStatistics = true;
+  }
+  GET_SEARCH_CTX(argv[2])
+
+  if (!sctx->spec->diskSpec) {
+    RedisModule_ReplyWithError(sctx->redisCtx, "DISK_STATS is only supported on disk indexes");
+  } else {
+    char *text = SearchDisk_DebugDiskStats(sctx->spec->diskSpec, withStatistics);
+    if (!text) {
+      RedisModule_ReplyWithError(sctx->redisCtx, "Disk stats are unavailable");
+    } else {
+      RedisModule_ReplyWithStringBuffer(sctx->redisCtx, text, sdslen(text));
+      sdsfree(text);
+    }
+  }
+
+  SearchCtx_Free(sctx);
+  return REDISMODULE_OK;
+}
+
 /**
  * FT.DEBUG REGISTER_TEST_SCORERS
  * Register the test scorers for testing purposes.
@@ -3956,6 +3992,7 @@ DebugCommandType commands[] = {{"DUMP_INVIDX", DumpInvertedIndex}, // Print all
                                {"GET_MAX_DOC_ID", GetMaxDocId},
                                {"DUMP_DELETED_IDS", DumpDeletedIds},
                                {"NUMERIC_BUCKET_MAP", NumericBucketMap},
+                               {"DISK_STATS", DiskStats},
                                {"DISK_IO_CONTROL", DiskIOControl},
                                {"REGISTER_TEST_SCORERS", RegisterTestScorers},
                                {"SET_MAX_INDEXES", SetMaxIndexes},
```

**File**: `src/search_disk.c` (modified, +7/-1)
```diff
@@ -201,7 +201,8 @@ bool SearchDisk_Initialize(RedisModuleCtx *ctx) {
     .maxOpenFiles = RSGlobalConfig.diskMaxOpenFiles,
   };
   disk_db = disk->basic.open(ctx, &resource_config, RSGlobalConfig.hideUserDataFromLog,
-                             RSGlobalConfig.diskDropReadCache, RSGlobalConfig.diskUseDirectReads);
+                             RSGlobalConfig.diskDropReadCache, RSGlobalConfig.diskUseDirectReads,
+                             RSGlobalConfig.diskStatistics);
   if (!disk_db) {
     RedisModule_Log(ctx, "warning", "Search Disk is enabled but could not be initialized");
     return false;
@@ -538,6 +539,11 @@ size_t SearchDisk_GetDeletedIds(RedisSearchDiskIndexSpec *handle, t_docId *buffe
     return disk->docTable.getDeletedIds(handle, buffer, buffer_size);
 }
 
+char *SearchDisk_DebugDiskStats(RedisSearchDiskIndexSpec *handle, bool withStatistics) {
+    RS_ASSERT(disk && disk_db && handle);
+    return disk->metrics.debugDiskStats(disk_db, handle, withStatistics, &sdsnewlen);
+}
+
 char *SearchDisk_DebugDumpNumericBucketMap(RedisSearchDiskIndexSpec *handle, t_fieldIndex fieldIndex) {
     RS_ASSERT(disk && handle);
     return disk->index.debugDumpNumericBucketMap(handle, fieldIndex, &sdsnewlen);
```

**File**: `src/search_disk.h` (modified, +9/-0)
```diff
@@ -532,6 +532,15 @@ size_t SearchDisk_GetDeletedIds(RedisSearchDiskIndexSpec *handle, t_docId *buffe
  */
 char *SearchDisk_DebugDumpNumericBucketMap(RedisSearchDiskIndexSpec *handle, t_fieldIndex fieldIndex);
 
+/**
+ * @brief Debug: storage-engine stats text of a disk index, for FT.DEBUG DISK_STATS.
+ *
+ * @param withStatistics Also append the sections shared by every index (block cache and
+ *        statistics enabled by search-_disk-statistics)
+ * @return sds text (release with sdsfree), or NULL if it could not be produced
+ */
+char *SearchDisk_DebugDiskStats(RedisSearchDiskIndexSpec *handle, bool withStatistics);
+
 /**
  * @brief Replace the key name in document metadata for a given document ID
  *
```

**File**: `src/search_disk_api.h` (modified, +16/-1)
```diff
@@ -154,11 +154,14 @@ typedef struct BasicDiskAPI {
    * @param logObfuscation true to enable obfuscation, false to disable
    * @param dropReadCache When true, hints the OS to evict pages after reading
    * @param useDirectReads When true, opens files with O_DIRECT to bypass the OS page cache
+   * @param enableStatistics When true, every index database shares one storage-engine
+   *        statistics object, reported by `MetricsDiskAPI::debugDiskStats`
    * @return Pointer to the disk context, or NULL on error
    */
   RedisSearchDisk *(*open)(RedisModuleCtx *ctx,
                            const SearchDiskResourceConfig *resourceConfig,
-                           bool logObfuscation, bool dropReadCache, bool useDirectReads);
+                           bool logObfuscation, bool dropReadCache, bool useDirectReads,
+                           bool enableStatistics);
   void (*close)(RedisModuleCtx *ctx, RedisSearchDisk *disk);
 
   /**
@@ -1164,6 +1167,18 @@ typedef struct MetricsDiskAPI {
    */
   PerFieldCfDiskMetrics (*getVectorFieldMetrics)(const RedisSearchDiskIndexSpec *index,
                                                  const char *fieldName, size_t fieldNameLen);
+
+  /**
+   * @brief Debug: storage-engine level and block-cache stats for every column family of
+   *        `index`, as text.
+   *
+   * With `withStatistics`, also appends the shared block-cache and statistics sections,
+   * which cover every index; statistics are reported as disabled unless enabled in `open`.
+   *
+   * @return Text allocated via `allocate`, or NULL if it could not be produced
+   */
+  char *(*debugDiskStats)(RedisSearchDisk *disk, RedisSearchDiskIndexSpec *index,
+                          bool withStatistics, AllocateKeyCallback allocate);
 } MetricsDiskAPI;
 
 typedef struct RedisSearchDiskAPI {
```

**File**: `tests/pytests/test_debug_commands.py` (modified, +13/-0)
```diff
@@ -54,6 +54,18 @@ def testDiskLiveSnapshotsIsZeroWithoutDisk(self):
         self.env.expect(debug_cmd(), 'DISK_LIVE_SNAPSHOTS', 'extra').error().contains(
             'wrong number of arguments')
 
+    def testDiskStatsRequiresDiskIndex(self):
+        self.env.expect(debug_cmd(), 'DISK_STATS', 'idx').error().contains(
+            'only supported on disk indexes')
+        self.env.expect(debug_cmd(), 'DISK_STATS', 'idx', 'verbose').error().contains(
+            'only supported on disk indexes')
+        self.env.expect(debug_cmd(), 'DISK_STATS', 'idx', 'other').error().contains('Expected VERBOSE')
+        self.env.expect(debug_cmd(), 'DISK_STATS', 'invalid_idx').error().contains(
+            'Can not create a search ctx')
+        self.env.expect(debug_cmd(), 'DISK_STATS').error().contains('wrong number of arguments')
+        self.env.expect(debug_cmd(), 'DISK_STATS', 'idx', 'VERBOSE', 'extra').error().contains(
+            'wrong number of arguments')
+
     def testDebugHelp(self):
         err_msg = 'wrong number of arguments'
         help_list = [
@@ -112,6 +124,7 @@ def testDebugHelp(self):
             'GET_MAX_DOC_ID',
             'DUMP_DELETED_IDS',
             'NUMERIC_BUCKET_MAP',
+            'DISK_STATS',
             'DISK_IO_CONTROL',
             'REGISTER_TEST_SCORERS',
             'SET_MAX_INDEXES',
```

**File**: `tests/pytests/test_disk_config.py` (modified, +33/-1)
```diff
@@ -5,10 +5,14 @@
 # (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 # GNU Affero General Public License v3 (AGPLv3).
 
+import os
+import tempfile
+
 from common import *
 
 """
-Tests for search-disk-drop-read-cache and search-disk-use-direct-reads module configs.
+Tests for the search-disk-drop-read-cache, search-disk-use-direct-reads and
+search-_disk-statistics module configs.
 
 These configs control SpeedB OS page-cache behaviour for disk indexes:
   - search-disk-drop-read-cache: whether to drop the OS read cache after each read
@@ -94,3 +98,31 @@ def test_disk_config_startup_both():
     env.expect('CONFIG', 'GET', 'search-disk-use-direct-reads').equal(
         ['search-disk-use-direct-reads', 'yes'])
     env.stop()
+
+
+@skip(cluster=True, redis_less_than="8.8")
+def test_disk_statistics_config_defaults_to_no_and_is_hidden():
+    env = Env(noDefaultModuleArgs=True)
+    if env.env == 'existing-env':
+        env.skip()
+    env.expect('CONFIG', 'GET', 'search-_disk-statistics').equal(['search-_disk-statistics', 'no'])
+    env.assertNotContains('search-_disk-statistics', env.cmd('CONFIG', 'GET', '*'))
+
+
+@skip(cluster=True, redis_less_than="8.8")
+def test_disk_statistics_config_is_immutable(env):
+    env.expect('CONFIG', 'SET', 'search-_disk-statistics', 'yes').error()
+    env.expect('CONFIG', 'GET', 'search-_disk-statistics').equal(['search-_disk-statistics', 'no'])
+
+
+@skip(cluster=True, redis_less_than="8.8")
+def test_disk_statistics_config_set_at_load_time():
+    # No legacy module-argument alias; load-time values come from the config file.
+    conf_path = os.path.join(tempfile.mkdtemp(), 'disk_statistics.conf')
+    with open(conf_path, 'w') as f:
+        f.write('search-_disk-statistics yes\n')
+    env = Env(noDefaultModuleArgs=True, redisConfigFile=conf_path)
+    if env.env == 'existing-env':
+        env.skip()
+    env.expect('CONFIG', 'GET', 'search-_disk-statistics').equal(['search-_disk-statistics', 'yes'])
+    env.stop()
```

---

### Incident Patch 3: `724e39f0` (2026-10-22)
**Commit Message**: [MOD-19631] Fix crash on default FT.SEARCH / LOAD * when a JSON index has a SORTABLE $ field (#11958)

[MOD-19631] Force-load the JSON root key in load-all for SORTABLE `$` fields

A SORTABLE schema field named `$` makes the root key value-available from
the sorting vector, so `get_key_load` returned `None` and the `unwrap` in
the JSON load-all path panicked across FFI, aborting Redis on
`FT.SEARCH idx *` and `FT.AGGREGATE idx * LOAD *`.

Pass `ForceLoad`, as the hash loader already does, and add a flow test.

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `src/redisearch_rs/rlookup/src/load_document/json.rs` (modified, +5/-2)
```diff
@@ -8,7 +8,7 @@
 */
 
 use crate::{
-    RLookup, RLookupKey, RLookupKeyFlags, RLookupRow,
+    RLookup, RLookupKey, RLookupKeyFlag, RLookupRow,
     load_document::{
         DOCUMENT_OPEN_KEY_QUERY_FLAGS, DocumentFormat, FieldLoader, LoadAllError, LoadFieldError,
         UNDERSCORE_KEY,
@@ -176,8 +176,11 @@ impl DocumentFormat for JsonDocumentFormat<'_> {
         let rlk = if let Some(rlk) = rlookup.find_key_by_name(JSON_ROOT) {
             rlk.into_current().unwrap()
         } else {
+            // A SORTABLE schema field on `$` makes the key value-available from
+            // the sorting vector, in which case `get_key_load` returns `None`
+            // unless forced.
             rlookup
-                .get_key_load(JSON_ROOT, JSON_ROOT, RLookupKeyFlags::empty())
+                .get_key_load(JSON_ROOT, JSON_ROOT, RLookupKeyFlag::ForceLoad.into())
                 .unwrap()
         };
 
```

**File**: `src/redisearch_rs/rlookup/tests/load_document_json.rs` (modified, +51/-1)
```diff
@@ -22,12 +22,14 @@
 //! ([`redis_json_api::mock`]) whose vtable resolves JSONPath queries against a
 //! [`serde_json::Value`].
 
+use field_spec::FieldSpecOption;
 use proptest::prelude::{Just, Strategy, any, prop_oneof};
 use proptest::proptest;
 use redis_json_api::mock::{with_json_api, with_json_api_broken_handle};
 use redis_module::RedisString;
 use rlookup::{
-    DocumentFormat, FieldLoader, JsonDocumentFormat, JsonPathCache, LoadAllError, RLookup,
+    DocumentFormat, FieldLoader, FieldSpecBuilder, FieldSpecType, IndexSpecCache,
+    JsonDocumentFormat, JsonPathCache, LoadAllError, RLookup, RLookupKey, RLookupKeyFlag,
     RLookupKeyFlags, RLookupRow,
 };
 use serde_json::json;
@@ -208,6 +210,54 @@ fn load_all_writes_root_value() {
     });
 }
 
+/// An [`RLookup`] whose schema declares `$` as a SORTABLE, un-normalized (UNF) text field.
+///
+/// Such a key is "value available" from the sorting vector, so creating it without
+/// [`RLookupKeyFlag::ForceLoad`] yields no key to write into.
+fn rlookup_with_sortable_root() -> RLookup<'static> {
+    let mut rlookup = RLookup::new();
+    rlookup.set_cache(Some(IndexSpecCache::from_fields([FieldSpecBuilder::new(
+        c"$",
+    )
+    .with_types(FieldSpecType::Fulltext.into())
+    .with_options(FieldSpecOption::Sortable | FieldSpecOption::Unf)
+    .with_sort_idx(0)
+    .finish()])));
+    rlookup
+}
+
+/// Assert that `load_all` loads the root from the document when the schema declares `$` as a
+/// SORTABLE, un-normalized (UNF) field.
+#[test]
+#[cfg_attr(miri, ignore)]
+fn load_all_force_loads_sortable_root_key() {
+    // Precondition: without forcing, the schema alone makes the key value-available and
+    // `get_key_load` declines to hand it out, so the assertions below exercise the forced path.
+    assert!(
+        rlookup_with_sortable_root()
+            .get_key_load(c"$", c"$", RLookupKeyFlags::empty())
+            .is_none(),
+        "a SORTABLE|UNF `$` must not be loadable without ForceLoad"
+    );
+
+    redis_mock::init_redis_module_mock();
+    with_json_api(Some(json!("hello")), |japi, ctx| {
+        // SAFETY: the root path is static.
+        let cache = unsafe { JsonPathCache::new(&japi, [Some(c"$")].into_iter()) };
+        let format = JsonDocumentFormat::new(ctx, &japi, PRE_MULTI, &cache);
+        let key_name = make_redis_string(c"doc:1");
+
+        let mut rlookup = rlookup_with_sortable_root();
+        let mut row = RLookupRow::new();
+        format.load_all(&mut rlookup, &mut row, &key_name).unwrap();
+
+        let cursor = rlookup.find_key_by_name(c"$").unwrap();
+        let key: &RLookupKey = cursor.current().unwrap();
+        assert!(key.flags.contains(RLookupKeyFlag::ValAvailable));
+        assert_eq!(row.get(key).unwrap().as_str_bytes(), Some(&b"hello"[..]));
+    });
+}
+
 /// Assert that `load_all` maps a missing key to `KeyNotFound`, and a present-but-empty
 /// root (`$` resolving to an empty array) to `JsonRootMissing`.
 #[test]
```

**File**: `tests/pytests/test_json_partial_load.py` (modified, +52/-0)
```diff
@@ -98,6 +98,58 @@ def test_doc_level_load_returns_root_for_matching_document(env):
     env.assertEqual(res, [1, "doc:1", ["$", {"name": "carol"}]])
 
 
+@skip(no_json=True)
+def test_load_all_sortable_root_field(env):
+    """MOD-19631: a SORTABLE schema field on the JSON root (`$`) makes the
+    root key value-available from the sorting vector. Load-all must still
+    populate it from the document instead of crashing the server. The
+    non-SORTABLE case guards that the default path is unchanged."""
+    cases = [
+        # (field type, extra schema args, JSON document, expected loaded `$`).
+        # A scalar root is loaded as its plain value, not as serialized JSON.
+        ("TEXT", ["SORTABLE"], '"hello"', "hello"),
+        ("TAG", ["SORTABLE"], '"hello"', "hello"),
+        ("NUMERIC", ["SORTABLE"], "42", "42"),
+        ("TEXT", ["SORTABLE", "NOINDEX"], '"hello"', "hello"),
+        ("TEXT", [], '"hello"', "hello"),
+    ]
+    for field_type, extra, doc, expected in cases:
+        env.flush()
+        env.expect(
+            "FT.CREATE", "idx", "ON", "JSON", "SCHEMA", "$", field_type, *extra
+        ).ok()
+        env.cmd("JSON.SET", "doc:1", "$", doc)
+        waitForIndex(env, "idx")
+        msg = f"{field_type} {extra}"
+
+        res = env.cmd("FT.SEARCH", "idx", "*")
+        env.assertEqual(res[0], 1, message=msg)
+        env.assertEqual(res[1], "doc:1", message=msg)
+        env.assertEqual(to_dict(res[2])["$"], expected, message=msg)
+
+        res = env.cmd("FT.AGGREGATE", "idx", "*", "LOAD", "*")
+        env.assertEqual(res[0], 1, message=msg)
+        env.assertEqual(to_dict(res[1])["$"], expected, message=msg)
+
+
+@skip(no_json=True)
+def test_load_all_sortable_array_root_field(env):
+    """MOD-19631: a SORTABLE `$` over an array root. The sorting vector and the loaded
+    document may hold different values; load-all must return the whole root from the
+    document, consistently for `FT.SEARCH` and `FT.AGGREGATE ... LOAD *`."""
+    env.expect("FT.CREATE", "idx", "ON", "JSON", "SCHEMA", "$", "TEXT", "SORTABLE").ok()
+    env.cmd("JSON.SET", "doc:1", "$", '["a", "b"]')
+    waitForIndex(env, "idx")
+
+    res = env.cmd("FT.SEARCH", "idx", "*")
+    env.assertEqual(res[0], 1)
+    env.assertEqual(json.loads(to_dict(res[2])["$"]), ["a", "b"])
+
+    res = env.cmd("FT.AGGREGATE", "idx", "*", "LOAD", "*")
+    env.assertEqual(res[0], 1)
+    env.assertEqual(json.loads(to_dict(res[1])["$"]), ["a", "b"])
+
+
 @skip(cluster=True, no_json=True)
 def test_return_json_paths_across_documents(env):
     """Explicit RETURN mixes compiled paths, multi-values, and the __key sentinel."""
```

#### Recent Merged Pull Requests:
- **PR #11975** (2026-10-22): [8.6-rse] [MOD-20014] clear docIDmetadata on restore commands on disk (@redisearch-backport-pull-request[bot])
- **PR #11974** (2026-10-22): [8.8-rse] [MOD-20014] clear docIDmetadata on restore commands on disk (@redisearch-backport-pull-request[bot])
- **PR #11972** (2026-10-22): [8.12] [MOD-18503] Serialize background query replies without retaining result rows (@GuyAv46)
- **PR #11967** (2026-10-22): [MOD-19619] Prevent crashes when hybrid shard profiles are incomplete (@lerman25)
- **PR #11964** (2026-10-21): [MOD-19626] Prevent excessive memory allocation for large hybrid WINDOW values (@dor-forer)
- **PR #11963** (closed): [MOD-19619] Prevent coordinator crashes when hybrid shard profiles are incomplete (@dor-forer)

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

## X. [MOD-19619] Prevent crashes when hybrid shard profiles are incomplete (#11967)

**RULE**:
When implementing operations in `src/coord/hybrid/dist_hybrid.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8ad57da6`: [MOD-19619] Prevent crashes when hybrid shard profiles are incomplete (#11967). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/coord/hybrid/dist_hybrid.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  // RPNet collects complete shard profiles or errors; timeouts can shorten the list.
  RS_LOG_ASSERT(current, "Collected shard profile must not be NULL");
  MRReply *shards;
    RS_LOG_ASSERT(MRReply_Type(current) == MR_REPLY_MAP && MRReply_Length(current) >= 2 &&
                      MRReply_Length(current) % 2 == 0,
                  "RESP3 profile must be a nonempty map");
    shards = MRReply_MapElement(current, PROFILE_SHARDS_STR);
    // RESP2: ["Shards", shards_array, ...] -> shards_array[0] is the shard profile
    RS_LOG_ASSERT(MRReply_Type(current) == MR_REPLY_ARRAY && MRReply_Length(current) >= 2,
                  "RESP2 profile must contain the Shards key and array");
    shards = MRReply_ArrayElement(current, 1);
  }
  RS_LOG_ASSERT(shards && MRReply_Type(shards) == MR_REPLY_ARRAY && MRReply_Length(shards) > 0,
                "Shards must contain a shard profile");
  MRReply *profile = MRReply_ArrayElement(shards, 0);
  RS_LOG_ASSERT(profile && MRReply_Length(profile) >= 2 && MRReply_Length(profile) % 2 == 0,
                "Shard profile must contain key-value pairs");
  if (!resp3) {
  RS_LOG_ASSERT(MRReply_Type(profile) == MR_REPLY_MAP, "Shard profile must be a
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    MRReply *shards = MRReply_MapElement(current, PROFILE_SHARDS_STR);
    return MRReply_ArrayElement(shards, 0);
    // RESP2: [results, shards_array] -> shards_array[0] is the shard profile
    MRReply *shards_array_profile = MRReply_ArrayElement(current, 1);
    MRReply *profile = MRReply_ArrayElement(shards_array_profile, 0);
    return profile;
  if (!profile || MRReply_Type(profile) == MR_REPLY_ERROR) {
  // [{"Shard ID": "id", "SEARCH": profile (without Shard ID), "VSIM": profile (without Shard ID)}, ...]

  bool resp3 = reply->resp3;

  // Iterate over shards and print both SEARCH and VSIM profiles for each shard
  for (size_t i = 0; i < searchCount; i++) {
    // Extract shard profiles
    MRReply *searchProfile = extractShardProfile(searchRpnet->shardsProfile[i], resp3);
    MRReply *vsimProfile = extractShardProfile(vsimRpnet->shardsProfile[i], resp3);

    // Extract and print Shard ID from SEARCH profile
    MRReply *shardIdReply = NULL;
    if (searchProfile) {
      shardIdReply = extractShardIdReply(searchProfile);
      RedisModule_Reply_SimpleString(reply, "Shard ID");
      MR_ReplyWithMRReply(reply, shardIdReply);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8ad57da6` are properly handled with clean fallback behavior.
