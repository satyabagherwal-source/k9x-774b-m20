> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `d5ca4c76`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T22:58:14.258Z  
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
> **Harvest Timestamp**: 2026-10-20T22:58:14.252Z  
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

### Incident Patch 1: `9e9bbdc2` (2026-10-20)
**Commit Message**: [MOD-14594] Prevent integer overflow in geometry allocators (#11941)

* Throw bad_alloc on size overflow in geometry allocators

Allocator<T>::allocate computed n * sizeof(T) unchecked, so a wrapped size
would return an undersized block. It now throws std::bad_alloc when n exceeds
SIZE_MAX / sizeof(T), per the standard allocator contract (failure throws,
never returns null). allocate drops noexcept in all three allocators so the
exception can propagate; tracked byte counts are untouched on failure.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Drop redundant comment on allocator overflow guard

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/geometry/allocator/allocator.hpp` (modified, +7/-2)
```diff
@@ -10,6 +10,8 @@
 
 #include "rmalloc.h"
 #include <cstddef>
+#include <limits>
+#include <new>
 
 namespace RediSearch {
 namespace Allocator {
@@ -21,7 +23,7 @@ struct Allocator {
   template <class U>
   explicit inline constexpr Allocator(Allocator<U> const&) noexcept;
 
-  [[nodiscard]] static inline auto allocate(std::size_t n) noexcept -> value_type*;
+  [[nodiscard]] static inline auto allocate(std::size_t n) -> value_type*;
   static inline void deallocate(value_type* p, std::size_t n) noexcept;
 };
 
@@ -31,7 +33,10 @@ inline constexpr Allocator<T>::Allocator(Allocator<U> const&) noexcept {
 }
 
 template <class T>
-inline auto Allocator<T>::allocate(std::size_t n) noexcept -> value_type* {
+inline auto Allocator<T>::allocate(std::size_t n) -> value_type* {
+  if (n > std::numeric_limits<std::size_t>::max() / sizeof(value_type)) {
+    throw std::bad_alloc{};
+  }
   auto alloc_size = n * sizeof(value_type);
   auto p = static_cast<value_type*>(rm_malloc(alloc_size));
   return p;
```

**File**: `src/geometry/allocator/stateful_allocator.hpp` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ struct StatefulAllocator {
   template <class U>
   explicit inline constexpr StatefulAllocator(StatefulAllocator<U> const&) noexcept;
 
-  [[nodiscard]] inline auto allocate(std::size_t n) noexcept -> value_type*;
+  [[nodiscard]] inline auto allocate(std::size_t n) -> value_type*;
   inline void deallocate(value_type* p, std::size_t n) noexcept;
 
   [[nodiscard]] inline constexpr std::size_t report() const noexcept;
@@ -39,7 +39,7 @@ inline constexpr StatefulAllocator<T>::StatefulAllocator(StatefulAllocator<U> co
 }
 
 template <class T>
-inline auto StatefulAllocator<T>::allocate(std::size_t n) noexcept -> value_type* {
+inline auto StatefulAllocator<T>::allocate(std::size_t n) -> value_type* {
   auto p = Allocator<T>::allocate(n);
   if (p) {
     allocated_ += n * sizeof(value_type);
```

**File**: `src/geometry/allocator/tracking_allocator.hpp` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ struct TrackingAllocator {
   template <class U>
   explicit inline constexpr TrackingAllocator(TrackingAllocator<U> const& other) noexcept;
 
-  [[nodiscard]] inline auto allocate(std::size_t n) noexcept -> value_type*;
+  [[nodiscard]] inline auto allocate(std::size_t n) -> value_type*;
   inline void deallocate(value_type* p, std::size_t n) noexcept;
 
   [[nodiscard]] inline constexpr std::size_t report() const noexcept;
@@ -45,7 +45,7 @@ inline constexpr TrackingAllocator<T>::TrackingAllocator(TrackingAllocator<U> co
 }
 
 template <class T>
-inline auto TrackingAllocator<T>::allocate(std::size_t n) noexcept -> value_type* {
+inline auto TrackingAllocator<T>::allocate(std::size_t n) -> value_type* {
   auto p = Allocator<T>::allocate(n);
   if (p) {
     allocated_ += n * sizeof(value_type);
```

**File**: `tests/cpptests/test_cpp_geometry_allocator.cpp` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
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
+
+#include "geometry/allocator/allocator.hpp"
+#include "geometry/allocator/stateful_allocator.hpp"
+#include "geometry/allocator/tracking_allocator.hpp"
+
+#include <cstdint>
+#include <limits>
+#include <new>
+
+using namespace RediSearch::Allocator;
+
+namespace {
+using Elem = std::uint64_t;
+// Smallest element count for which n * sizeof(Elem) overflows size_t.
+constexpr std::size_t kOverflowCount = std::numeric_limits<std::size_t>::max() / sizeof(Elem) + 1;
+}  // namespace
+
+TEST(GeometryAllocatorTest, OverflowThrows) {
+  EXPECT_THROW((void)Allocator<Elem>::allocate(kOverflowCount), std::bad_alloc);
+}
+
+TEST(GeometryAllocatorTest, StatefulOverflowThrowsAndKeepsCount) {
+  StatefulAllocator<Elem> alloc;
+  EXPECT_THROW((void)alloc.allocate(kOverflowCount), std::bad_alloc);
+  EXPECT_EQ(alloc.report(), 0u);
+}
+
+TEST(GeometryAllocatorTest, TrackingOverflowThrowsAndKeepsCount) {
+  std::size_t tracked = 0;
+  TrackingAllocator<Elem> alloc{tracked};
+  EXPECT_THROW((void)alloc.allocate(kOverflowCount), std::bad_alloc);
+  EXPECT_EQ(tracked, 0u);
+}
+
+TEST(GeometryAllocatorTest, NormalAllocationIsTracked) {
+  std::size_t tracked = 0;
+  TrackingAllocator<Elem> alloc{tracked};
+  Elem* p = alloc.allocate(4);
+  ASSERT_NE(p, nullptr);
+  EXPECT_EQ(tracked, 4 * sizeof(Elem));
+  alloc.deallocate(p, 4);
+  EXPECT_EQ(tracked, 0u);
+}
```

---

### Incident Patch 2: `2bfde4a7` (2026-10-20)
**Commit Message**: Fix suggestion and dictionary commands reading past input that ends in a truncated UTF-8 sequence (#11902)

* Add a test that the rune decoders stay within the supplied length

FT.SUGGET hands strToSingleCodepointFoldedRunes a Redis string's exact
byte length, and FT.SUGADD/SUGDEL do the same with strToRunes. The test
decodes "ab" plus a trailing 2-, 3- or 4-byte lead through each helper
twice, once followed by zeros and once by the rest of U+1F600, and
requires the same runes: a decoder that reads past the length sees the
difference.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Keep the rune decoders within the supplied byte length

nu_utf8_read sizes a sequence from its lead byte alone, and libnu's
bounded-string loops only check the limit before each call. A prefix
ending in 0xF0 makes FT.SUGGET's decoder read three bytes past the
argument; Redis's terminator covers only the first of them.

Decode a sequence that the end cuts short from a zero-padded copy, and
use that reader in strToSingleCodepointFoldedRunes (FT.SUGGET), strToRunes
(FT.SUGADD, FT.SUGDEL, dictionaries and indexed terms) and strToLowerRunes
(FT.SPELLCHECK). The missing bytes read as 0, which is what th

**File**: `src/trie/rune_util.c` (modified, +60/-34)
```diff
@@ -18,6 +18,22 @@
 #include "libnu/strings.h"
 #include "libnu/utf8.h"
 
+/* nu_utf8_read sizes a sequence from its lead byte alone and has no end bound,
+ * so a lead byte among the last three bytes makes it read past the buffer.
+ * Such a sequence is decoded from a zero-padded copy instead. The bytes past
+ * `end` read as 0, as the first of them does in a NUL-terminated string, so
+ * every sequence that fits decodes exactly as before. */
+static const char *utf8ReadBounded(const char *p, const char *end, uint32_t *codepoint) {
+  size_t avail = end - p;
+  if (avail >= 4) {
+    return nu_utf8_read(p, codepoint);
+  }
+  char padded[4] = {0};
+  memcpy(padded, p, avail);
+  size_t consumed = nu_utf8_read(padded, codepoint) - padded;
+  return consumed < avail ? p + consumed : end;
+}
+
 static uint32_t __fold(uint32_t runelike) {
   uint32_t lowered = 0;
   const char *map = 0;
@@ -66,60 +82,70 @@ char *runesToStr(const rune *in, size_t len, size_t *utflen) {
   return ret;
 }
 
-rune *strToLowerRunes(const char *str, size_t utf8_len, size_t *unicode_len) {
+/* Lowers `str` up to its first decoded NUL, writing at most `cap` runes to
+ * `out`, and returns the lowered length. Once that length exceeds
+ * MAX_RUNE_STR_LEN it stops early and returns a value above the limit, so a
+ * caller that rejects such strings never walks the rest. Sizing and filling
+ * both go through here so the buffer always fits what is written to it. */
+static size_t lowerRunes(const char *str, const char *end, rune *out, size_t cap) {
+  size_t n = 0;
+  for (const char *p = str; p < end && n <= MAX_RUNE_STR_LEN;) {
+    uint32_t codepoint;
+    p = utf8ReadBounded(p, end, &codepoint);
+    if (codepoint == 0) {
+      break;
+    }
+    const char *map = nu_tolower(codepoint);
+    if (map == NULL) {
+      if (n < cap) out[n] = codepoint;
+      n++;
+      continue;
+    }
+    uint32_t mu;
+    while ((map = nu_casemap_read(map, &mu)), mu != 0) {
+      if (n < cap) out[n] = mu;
+      n++;
+    }
+  }
+  return n;
+}
 
-  // determine the length of the folded string
-  ssize_t rlen = nu_strtransformnlen(str, utf8_len, nu_utf8_read,
-                                     nu_tolower, nu_casemap_read);
+rune *strToLowerRunes(const char *str, size_t utf8_len, size_t *unicode_len) {
+  const char *end = str + utf8_len;
+  size_t rlen = lowerRunes(str, end, NULL, 0);
   if (rlen > MAX_RUNE_STR_LEN) {
     *unicode_len = 0;
     return NULL;
   }
 
   rune *ret = rm_calloc(rlen + 1, sizeof(rune));
-  const char *encoded_char = str;
-  uint32_t codepoint;
-  unsigned i = 0;
-  while (encoded_char < str + utf8_len) {
-    // Read unicode codepoint from utf8 string
-    encoded_char = nu_utf8_read(encoded_char, &codepoint);
-    // Transform unicode codepoint to lower case
-    const char *map = nu_tolower(codepoint);
-
-    // Read the transformed codepoint and store it in the unicode buffer
-    if (map != NULL) {
-      uint32_t mu;
-      while (1) {
-        map = nu_casemap_read(map, &mu);
-        if (mu == 0) {
-          break;
-        }
-        ret[i++] = mu;
-      }
-    } else {
-        ret[i++] = codepoint;
-    }
-  }
+  lowerRunes(str, end, ret, rlen);
   *unicode_len = rlen;
 
   return ret;
 }
 
 rune *strToSingleCodepointFoldedRunes(const char *str, size_t utf8_len, size_t *len) {
 
-  ssize_t rlen = nu_strnlen(str, utf8_len, nu_utf8_read);
+  const char *end = str + utf8_len;
+  ssize_t rlen = 0;
+  for (const char *p = str; p < end; rlen++) {
+    uint32_t codepoint;
+    p = utf8ReadBounded(p, end, &codepoint);
+    if (codepoint == 0) {
+      break;
+    }
+  }
   if (rlen > MAX_RUNE_STR_LEN) {
     if (len) *len = 0;
     return NULL;
   }
 
-  uint32_t decoded[rlen + 1];
-  decoded[rlen] = 0;
-  nu_readnstr(str, utf8_len, decoded, nu_utf8_read);
-
   rune *ret = rm_calloc(rlen + 1, sizeof(rune));
+  const char *p = str;
   for (int i = 0; i < rlen; i++) {
-    uint32_t runelike = decoded[i];
+    uint32_t runelike;
+    p = utf8ReadBounded(p, end, &runelike);
     ret[i] = (rune)__fold(runelike);
   }
   if (len) *len = rlen;
@@ -132,7 +158,7 @@ size_t strToRunes(const char *src, size_t slen, rune *out, size_t outcap) {
   size_t nout = 0;
   while (src < end) {
     uint32_t cp;
-    src = nu_utf8_read(src, &cp);
+    src = utf8ReadBounded(src, end, &cp);
     if (cp == 0) {
       break;
     }
```

**File**: `src/trie/rune_util.h` (modified, +9/-4)
```diff
@@ -55,11 +55,15 @@ char *runesToStr(const rune *in, size_t len, size_t *utflen);
 
 /* This function reads a UTF-8 encoded string, transforms it to lowercase,
  * and returns a dynamically allocated array of runes (32-bit integers).
+ * Decoding stops early at an embedded NUL. Returns NULL for a result longer
+ * than MAX_RUNE_STR_LEN runes.
  * Parameters:
- * - str: The input UTF-8 encoded string.
- * - utf8_len: The length of the input string in bytes.
+ * - str: The input UTF-8 encoded buffer (need not be NUL-terminated; nothing
+ *   past `utf8_len` bytes is read).
+ * - utf8_len: The length of the input buffer in bytes.
  * - unicode_len: A pointer to a size_t variable where the length of the
- *   resulting array of runes will be stored. Must be non-NULL.
+ *   resulting array of runes will be stored. Must be non-NULL; it is set to 0
+ *   when NULL is returned.
  */
 rune *strToLowerRunes(const char *str, size_t utf8_len, size_t *unicode_len);
 
@@ -74,7 +78,8 @@ rune *strToLowerRunes(const char *str, size_t utf8_len, size_t *unicode_len);
 rune *strToSingleCodepointFoldedRunes(const char *str, size_t utf8_len, size_t *len);
 
 /* Decode `slen` bytes of UTF-8 from `src` into the caller-supplied `out`,
- * writing at most `outcap` runes and never NUL-terminating. Decoding stops
+ * writing at most `outcap` runes and never NUL-terminating. `src` need not be
+ * NUL-terminated; nothing past `slen` bytes is read. Decoding stops
  * early at an embedded NUL. Returns the input's full rune count, which exceeds
  * `outcap` when the output was truncated. */
 size_t strToRunes(const char *src, size_t slen, rune *out, size_t outcap);
```

**File**: `tests/cpptests/test_cpp_trie.cpp` (modified, +90/-0)
```diff
@@ -27,8 +27,12 @@
 #include <set>
 #include <vector>
 #include <algorithm>
+#include <utility>
 #include <climits>
 
+#include <sys/mman.h>
+#include <unistd.h>
+
 class TrieTest : public ::testing::Test {};
 
 static bool trieInsert(Trie *t, const char *s, size_t n) {
@@ -1423,6 +1427,92 @@ TEST_F(TrieTest, testSearchTrimDropsTail) {
   TrieType_Free(t);
 }
 
+// FT.SUGGET hands strToSingleCodepointFoldedRunes a Redis string's exact byte
+// length, and FT.SUGADD/SUGDEL do the same with strToRunes. A multi-byte lead
+// byte at the end must not make a decoder read past that length, so the result
+// cannot depend on the bytes that follow it.
+TEST_F(TrieTest, testRuneDecodeStaysWithinLength) {
+  typedef std::vector<rune> (*Decoder)(const char *, size_t);
+  const std::pair<const char *, Decoder> decoders[] = {
+      {"strToSingleCodepointFoldedRunes",
+       [](const char *s, size_t n) {
+         size_t rlen = 0;
+         rune *r = strToSingleCodepointFoldedRunes(s, n, &rlen);
+         std::vector<rune> out(r, r + rlen);
+         rm_free(r);
+         return out;
+       }},
+      {"strToRunes",
+       [](const char *s, size_t n) {
+         std::vector<rune> out(n);
+         out.resize(std::min(strToRunes(s, n, out.data(), n), n));
+         return out;
+       }},
+      {"strToLowerRunes",
+       [](const char *s, size_t n) {
+         size_t rlen = 0;
+         rune *r = strToLowerRunes(s, n, &rlen);
+         std::vector<rune> out(r, r + rlen);
+         rm_free(r);
+         return out;
+       }},
+  };
+
+  // The leads of a 2-, 3- and 4-byte sequence, each cut off after "ab".
+  for (char lead : {'\xC3', '\xE4', '\xF0'}) {
+    const std::string input = std::string("ab") + lead;
+    // The same input followed by zeros, or by the rest of U+1F600.
+    const std::string zeroed = input + std::string(3, '\0');
+    const std::string continued = input + "\x9F\x98\x80";
+    for (const auto &[name, decode] : decoders) {
+      EXPECT_EQ(decode(zeroed.data(), input.size()), decode(continued.data(), input.size()))
+          << name << " read past the supplied length (trailing lead byte 0x" << std::hex
+          << (int)(unsigned char)lead << ")";
+    }
+  }
+}
+
+// Lowering ends at the first decoded NUL, whether a literal 0 byte or an
+// overlong encoding of one.
+TEST_F(TrieTest, testLowerRunesStopsAtNul) {
+  const std::pair<std::string, std::vector<rune>> cases[] = {
+      {std::string("\0AB", 3), {}},
+      {std::string("a\0BCD", 5), {'a'}},
+      {std::string("Ab\xC0\x80") + "CD", {'a', 'b'}},
+  };
+  for (const auto &[input, expected] : cases) {
+    size_t rlen = 0;
+    rune *r = strToLowerRunes(input.data(), input.size(), &rlen);
+    ASSERT_TRUE(r != nullptr);
+    EXPECT_EQ(expected, std::vector<rune>(r, r + rlen)) << "input size " << input.size();
+    EXPECT_EQ(0, r[rlen]) << "input size " << input.size();
+    rm_free(r);
+  }
+}
+
+// A string longer than MAX_RUNE_STR_LEN runes is rejected without being walked
+// to its end. The bytes past the limit sit in an inaccessible page, so reading
+// them faults.
+TEST_F(TrieTest, testLowerRunesStopsCountingPastLimit) {
+  const long pageSize = sysconf(_SC_PAGESIZE);
+  ASSERT_GT(pageSize, 0);
+  const size_t page = pageSize;
+  const size_t n = MAX_RUNE_STR_LEN + 1;
+  const size_t region = ((n + page - 1) / page + 1) * page;
+  char *base =
+      (char *)mmap(nullptr, region, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
+  ASSERT_NE(MAP_FAILED, (void *)base);
+  char *guard = base + region - page;
+  ASSERT_EQ(0, mprotect(guard, page, PROT_NONE));
+  char *str = guard - n;
+  memset(str, 'a', n);
+
+  size_t rlen = 1;
+  EXPECT_EQ(nullptr, strToLowerRunes(str, n + page, &rlen));
+  EXPECT_EQ(0, rlen);
+  munmap(base, region);
+}
+
 namespace {
 // Big enough for every allocation a search over a two-entry trie writes to.
 constexpr size_t kServedAllocBytes = 64 * 1024;
```

---

### Incident Patch 3: `359a32a8` (2026-10-20)
**Commit Message**: [MOD-19639] Prevent crashes from unsupported RDB index storage flags (#11944)

Reject numeric storage flags in persisted index specifications

**File**: `src/spec.c` (modified, +9/-0)
```diff
@@ -3366,6 +3366,10 @@ IndexSpec *IndexSpec_RdbLoad(RedisModuleIO *rdb, int encver, bool useSst, QueryE
   RedisModule_Free(rawName);
 
   flags = (IndexFlags)LoadUnsigned_IOError(rdb, goto cleanup_name);
+  if (flags & Index_StoreNumeric) {
+    QueryError_SetError(status, QUERY_ERROR_CODE_PARSE_ARGS, "Invalid index storage flags");
+    goto cleanup_name;
+  }
   if (encver < INDEX_MIN_NOFREQ_VERSION) {
     flags |= Index_StoreFreqs;
   }
@@ -3598,6 +3602,11 @@ void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   sp->obfuscatedName = IndexSpec_FormatObfuscatedName(sp->specName);
   RedisModule_Free(legacyName);
   sp->flags = (IndexFlags)RedisModule_LoadUnsigned(rdb);
+  if (sp->flags & Index_StoreNumeric) {
+    RedisModule_LogIOError(rdb, "warning", "RDB Load: Invalid index storage flags");
+    StrongRef_Release(spec_ref);
+    return NULL;
+  }
   if (encver < INDEX_MIN_NOFREQ_VERSION) {
     sp->flags |= Index_StoreFreqs;
   }
```

**File**: `tests/cpptests/test_cpp_rdb.cpp` (modified, +95/-0)
```diff
@@ -9,6 +9,9 @@
 
 #include "gtest/gtest.h"
 #include "gtest/internal/gtest-port.h"  // For CaptureStderr/GetCapturedStderr
+extern "C" {
+#include "util/dict.h"
+}
 #include "common.h"
 #include "redismock/redismock.h"
 #include "synonym_map.h"
@@ -24,6 +27,7 @@ extern "C" {
 #include "spec.h"
 #include "vector_index.h"
 #include "indexes.h"
+#include "indexer.h"
 #include "query_error_ffi.h"
 #include "rules.h"
 #include "alias.h"
@@ -38,6 +42,7 @@ extern "C" {
 extern int Indexes_RdbLoad(RedisModuleIO *rdb, int encver, int when);
 extern void Spec_AddToDict(RefManager *rm);  // Helper to add spec to global dict
 extern RedisSearchDiskAPI *disk;
+extern dict *legacySpecDict;
 }
 
 
@@ -283,6 +288,96 @@ TEST_F(RdbMockTest, testIndexSpecRdbLoadNormalizesInvalidStorageFlags) {
     EXPECT_FALSE(loadedSpec->flags & Index_StoreFieldFlags);
 }
 
+TEST_F(RdbMockTest, testIndexSpecRdbLoadRejectsNumericStorageFlag) {
+  const char *args[] = {"SCHEMA", "title", "TEXT", "price", "NUMERIC"};
+  QueryError status = QueryError_Default();
+  StrongRef originalRef =
+      IndexSpec_ParseC(nullptr, "storage_flags", args, std::size(args), &status);
+  ASSERT_FALSE(QueryError_HasError(&status)) << QueryError_GetUserError(&status);
+  auto *original = static_cast<IndexSpec *>(StrongRef_Get(originalRef));
+  ASSERT_NE(original, nullptr);
+  std::unique_ptr<IndexSpec, std::function<void(IndexSpec *)>> originalPtr(
+      original, [](IndexSpec *spec) { Indexes_RemoveSpecFromGlobals(spec->own_ref, false); });
+
+  // Numeric fields are valid; only a numeric encoding on the whole spec is unsupported.
+  for (unsigned storage = 0; storage < 8; ++storage) {
+    const uint64_t flags = Index_StoreByteOffsets | ((storage & 1) ? Index_StoreTermOffsets : 0) |
+                           ((storage & 2) ? Index_StoreFieldFlags : 0) |
+                           ((storage & 4) ? Index_StoreFreqs : 0);
+    for (bool numericStorage : {false, true}) {
+      SCOPED_TRACE(::testing::Message() << "flags=" << flags << " numeric=" << numericStorage);
+      original->flags = static_cast<IndexFlags>(flags | (numericStorage ? Index_StoreNumeric : 0));
+      std::unique_ptr<RedisModuleIO, decltype(&RMCK_FreeRdbIO)> io(RMCK_CreateRdbIO(),
+                                                                   RMCK_FreeRdbIO);
+      IndexSpec_RdbSave(io.get(), original, 0);
+      ASSERT_EQ(RMCK_IsIOError(io.get()), 0);
+      io->read_pos = 0;
+      char *name = RMCK_LoadStringBuffer(io.get(), nullptr);
+      rm_free(name);
+      RMCK_LoadUnsigned(io.get());
+      const size_t flagsEnd = io->read_pos;
+      io->read_pos = 0;
+
+      IndexSpec *loaded = IndexSpec_RdbLoad(io.get(), INDEX_CURRENT_VERSION, false, &status);
+      if (numericStorage) {
+        EXPECT_EQ(loaded, nullptr);
+        EXPECT_TRUE(QueryError_HasError(&status));
+        EXPECT_EQ(io->read_pos, flagsEnd);
+      } else {
+        ASSERT_NE(loaded, nullptr) << QueryError_GetUserError(&status);
+        EXPECT_FALSE(QueryError_HasError(&status));
+        EXPECT_EQ(loaded->flags, flags);
+        EXPECT_EQ(loaded->numFields, 2);
+        EXPECT_EQ(loaded->fields[1].types, INDEXFLD_T_NUMERIC);
+        EXPECT_EQ(io->read_pos, io->buffer.size());
+      }
+      if (loaded) {
+        IndexSpec_RdbLoadDiscard(loaded->own_ref);
+      }
+      EXPECT_EQ(RMCK_IsIOError(io.get()), 0);
+      QueryError_ClearError(&status);
+    }
+  }
+}
+
+TEST_F(RdbMockTest, testLegacyIndexSpecRdbLoadRejectsNumericStorageFlag) {
+  const auto originalGetKeyName = RedisModule_GetKeyNameFromIO;
+  const bool originalLoading = g_isLoading;
+  dict *originalRules = legacySpecRules;
+  dict *originalSpecs = legacySpecDict;
+  RedisModule_GetKeyNameFromIO = [](RedisModuleIO *) -> const RedisModuleString * {
+    return nullptr;
+  };
+  g_isLoading = true;
+  legacySpecRules = dictCreate(&dictTypeHeapHiddenStrings, nullptr);
+  legacySpecDict = dictCreate(&dictTypeHeapHiddenStrings, nullptr);
+
+  for (int encver = LEGACY_INDEX_MIN_VERSION; encver <= LEGACY_INDEX_MAX_VERSION; ++encver) {
+    for (bool numericStorage : {false, true}) {
+      SCOPED_TRACE(::testing::Message() << "encver=" << encver << " numeric=" << numericStorage);
+      std::unique_ptr<RedisModuleIO, decltype(&RMCK_FreeRdbIO)> io(RMCK_CreateRdbIO(),
+                                                                   RMCK_FreeRdbIO);
+      RMCK_SaveStringBuffer(io.get(), "legacy_storage_flags", sizeof("legacy_storage_flags"));
+      RMCK_SaveUnsigned(io.get(), INDEX_DEFAULT_FLAGS | (numericStorage ? Index_StoreNumeric : 0));
+      const size_t flagsEnd = io->buffer.size();
+      // A later, distinct validation failure keeps the control safe on unfixed code and proves
+      // valid storage flags reach the schema, while numeric storage must stop before it.
+      RMCK_SaveUnsigned(io.get(), SPEC_MAX_FIELDS + 1);
+
+      EXPECT_EQ(IndexSpec_LegacyRdbLoad(io.get(), encver), nullptr);
+      EXPECT_EQ(io->read_pos, numericStor
```

#### Recent Merged Pull Requests:
- **PR #11948** (closed): [MOD-19994] Keep C++ exceptions from escaping the geometry C API (@ofiryanai)
- **PR #11946** (2026-10-20): [MOD-20014] clear docIDmetadata on restore commands on disk (@JoanFM)
- **PR #11944** (2026-10-20): [MOD-19639] Prevent crashes from unsupported RDB index storage flags (@dor-forer)
- **PR #11942** (closed): add tests to see how doc ID meta behaves under dump restore (@JoanFM)
- **PR #11941** (2026-10-20): [MOD-14594] Prevent integer overflow in geometry allocators (@ofiryanai)
- **PR #11939** (2026-10-20): [MOD-19840] Fix flaky test_hybrid_knn_implicit_filter_matches_wildcard (@Itzikvaknin)

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

## X. [MOD-14594] Prevent integer overflow in geometry allocators (#11941)

**RULE**:
When implementing operations in `src/geometry/allocator/allocator.hpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e9bbdc2`: [MOD-14594] Prevent integer overflow in geometry allocators (#11941). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/geometry/allocator/allocator.hpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#include <limits>
#include <new>
  [[nodiscard]] static inline auto allocate(std::size_t n) -> value_type*;
inline auto Allocator<T>::allocate(std::size_t n) -> value_type* {
  if (n > std::numeric_limits<std::size_t>::max() / sizeof(value_type)) {
    throw std::bad_alloc{};
  }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  [[nodiscard]] static inline auto allocate(std::size_t n) noexcept -> value_type*;
inline auto Allocator<T>::allocate(std::size_t n) noexcept -> value_type* {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e9bbdc2` are properly handled with clean fallback behavior.
