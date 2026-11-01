> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `4be31bd5`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T20:32:05.516Z  
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
> **Harvest Timestamp**: 2026-10-31T20:32:05.508Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RediSearch/RediSearch`
- **Description**: A query and indexing engine for Redis, providing secondary indexing, full-text search, vector similarity search and aggregations.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6247 stars

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
- **Issue #11970** (2026-10-26): **[BUG] Duplicate FT.AGGREGATE cursor rows after deletes while index backfill is active**
  *Symptoms*: ## Describe the bug  A raw redis-py diagnostic observed duplicate physical row IDs across FT.AGGREGATE / FT.CURSOR READ pages immediately after bulk deletes while FT.INFO still reported indexing=1. This reproducer does not use Go, ADBC or Arrow. Please investigate whether this is a defect or an expected limitation during initial backfill, and document a supported readiness/mitigation contract.  ## Environment  - Redis OSS 8.6.2; Search module version 80600 (8.6.0), local Docker standalone. - Client: macOS 26.7.1 arm64, redis-py; diagnostic runs RESP2 and RESP3 separately. - search-max-aggregate-results: 2147483648. - Observations were captured on October 21, 2026. This report uses preserved evidence; it is not a new reproduction against latest master. CPU model was not recorded.  ## To reproduce  1. On a disposable Redis with Search, create a HASH index with sortable NUMERIC __rowid, adv and width fields. 2. Insert row IDs 1..100000, then delete every ID not divisible by 10. No further application writes are made during reads. 3. Query `@__rowid:[1 100000]` with `LOAD 4 @__key @__rowid @width @adv`, `TIMEOUT 0`, `WITHCURSOR COUNT 10000`, `DIALECT 2`. Finish every cursor with `FT.CURSOR READ ... COUNT 10000`. 4. Compare the complete row multiset with IDs 10,20,...,100000. Repeat, and compare with a separate run that first waits for num_docs=10000 and indexing=0.  Preserved executable reproducer (creates/drops only a generated test prefix/index): https://github.com/alberttwong/

- **Issue #11935** (2026-10-29): **[BUG] Follow-up to #10547: INKEYS cost moved from the worker to the main thread**
  *Symptoms*: **Describe the bug** This is a follow-up to https://github.com/RediSearch/RediSearch/issues/10547 which we filed in July  Since `f3efd437f`, `INKEYS` key names are resolved to docIds on the **main thread at query admission**, in `applyGlobalFilters`  Before that change, memory mode resolved `INKEYS` on the **worker thread inside the spec read lock**, through the in-index `DocIdMap` trie  We have now profiled a current build. **The trie lookup is genuinely gone** — no `TrieMap_Find` anywhere in the worker profile, and the memory the trie used to hold is no longer allocated. That part worked.  But the move raise two new problems for `INKEYS`: 1. **Throughput** (measured, our actual problem) — the per-key cost is now paid    on the single main thread and cannot be parallelized across workers. Under    load this is ~30% of one core on our instance. The main thread has become the bottleneck    and  the worker pool cannot be driven any higher. 2. **A behavioral change** (found while reading the code, not measured) —    resolution now happens outside the spec read lock. Previously an `INKEYS` key    always resolved to a live docId and the document was returned in *some*    version; now a key updated between admission and execution can return    neither the old nor the new version.  **To Reproduce** Same shape as #10547, on a different instance:  - `FT.SEARCH` with `INKEYS` on essentially every query (99.5% of command CPU). -   Some queries pass several hundred keys to INKEYS. - Memo

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

### Incident Patch 1: `4be31bd5` (2026-10-31)
**Commit Message**: MOD-17673: Move parent and child scanner orchestration to Rust (#11236)

* fork_gc: migrate the tags scanner to Rust

* Move parent and child scanner orchestration to Rust

* Preserve fork GC post-heartbeat completion marker

---------

Co-authored-by: jonathan keinan <[REDACTED_EMAIL]>

**File**: `src/fork_gc/fork_gc.c` (modified, +0/-43)
```diff
@@ -42,49 +42,6 @@
 // Number of attempts to wait for the child to exit gracefully before trying to terminate it
 #define GC_WAIT_ATTEMPTS 4
 
-static void FGC_childScanIndexes(ForkGC *gc, IndexSpec *spec) {
-  RedisSearchCtx sctx = SEARCH_CTX_STATIC(gc->ctx, spec);
-  const char* indexName = IndexSpec_FormatName(spec, RSGlobalConfig.hideUserDataFromLog);
-  RedisModule_Log(sctx.redisCtx, "debug", "ForkGC in index %s - child scanning indexes start", indexName);
-  FGC_childCollectTerms(gc, &sctx);
-  FGC_childCollectNumeric(gc, &sctx);
-  FGC_childCollectTags(gc, &sctx);
-  FGC_childCollectMissingDocs(gc, &sctx);
-  FGC_childCollectExistingDocs(gc, &sctx);
-  RedisModule_SendChildHeartbeat(1.0); // final heartbeat
-  RedisModule_Log(sctx.redisCtx, "debug", "ForkGC in index %s - child scanning indexes end", indexName);
-  // Let the parent wait for the terminal terminator, so we manage to send the heartbeat before exiting
-  FGC_sendTerminator(gc);
-}
-
-FGCError FGC_parentHandleFromChild(ForkGC *gc) {
-  FGCError status = FGC_COLLECTED;
-  RedisModule_Log(gc->ctx, "debug", "ForkGC - parent start applying changes");
-
-#define COLLECT_FROM_CHILD(e)               \
-  while ((status = (e)) == FGC_COLLECTED) { \
-  }                                         \
-  if (status != FGC_DONE) {                 \
-    return status;                          \
-  }
-
-  COLLECT_FROM_CHILD(FGC_parentHandleTerms(gc));
-  COLLECT_FROM_CHILD(FGC_parentHandleNumeric(gc));
-  COLLECT_FROM_CHILD(FGC_parentHandleTags(gc));
-  COLLECT_FROM_CHILD(FGC_parentHandleMissingDocs(gc));
-  COLLECT_FROM_CHILD(FGC_parentHandleExistingDocs(gc));
-
-  // Wait for the final terminator from the child, so it can finish post-processing chores before we kill it
-  size_t terminator_check;
-  int rc = FGC_recvFixed(gc, &terminator_check, sizeof(terminator_check)); // final status from child
-  if (rc != REDISMODULE_OK || terminator_check != NO_MORE_DATA) {
-    return FGC_CHILD_ERROR;
-  }
-  RedisModule_Log(gc->ctx, "debug", "ForkGC - parent ends applying changes");
-
-  return status;
-}
-
 // GIL must be held before calling this function
 static inline bool isOutOfMemory(RedisModuleCtx *ctx) {
   // Check if we are a slave/replica
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/existing_docs.rs` (removed, +0/-73)
```diff
@@ -1,73 +0,0 @@
-/*
- * Copyright (c) 2006-Present, Redis Ltd.
- * All rights reserved.
- *
- * Licensed under your choice of the Redis Source Available License 2.0
- * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
- * GNU Affero General Public License v3 (AGPLv3).
-*/
-
-use fork_gc::{
-    ForkGC,
-    existing_docs::{collect_existing_docs, handle_existing_docs},
-    io_result_ext::IoResultExt,
-};
-use index_spec::IndexSpecReadGuard;
-
-use crate::{FGCError, util::into_fgc_error};
-
-/// Collect GC delta data for the spec's `existingDocs` inverted index and
-/// send it to the parent process over the pipe.
-///
-/// If the spec has no existing-docs index, or the scan produces no delta,
-/// only the terminator is sent.  Otherwise an empty header followed by the
-/// serialised GC delta is sent before the terminator.
-///
-/// Any write failure, such as a closed fd or a broken pipe, terminates the
-/// child process via `RedisModule_ExitFromChild`.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-/// 2. `sctx` must point to a valid [`ffi::RedisSearchCtx`].
-/// 3. `sctx.spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
-/// 4. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_childCollectExistingDocs(
-    gc: *mut ffi::ForkGC,
-    sctx: *mut ffi::RedisSearchCtx,
-) {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-    // SAFETY: caller guarantees (2).
-    let spec_ptr = unsafe { (*sctx).spec };
-    // SAFETY: caller guarantees (3).
-    let spec = unsafe { &*spec_ptr };
-
-    // SAFETY: caller guarantees (4). We don't actually hold a read lock, but when the Fork GC code
-    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
-    // then forks and the child has only one thread with exclusive access to the index spec.
-    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
-
-    collect_existing_docs(&mut fgc.writer(), &guard).unwrap_or_exit();
-}
-
-/// Receive and apply the GC delta for the spec's `existingDocs` inverted index.
-///
-/// Reads one protocol frame from the pipe. Returns [`FGCError::Done`] when
-/// the child sent no data (index absent or nothing to collect),
-/// [`FGCError::Collected`] after successfully applying a delta, or an
-/// error variant on pipe or spec failure.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_parentHandleExistingDocs(gc: *mut ffi::ForkGC) -> FGCError {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-
-    into_fgc_error(handle_existing_docs(fgc), "existing docs")
-}
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/lib.rs` (modified, +1/-5)
```diff
@@ -26,11 +26,7 @@ use nul_terminated_bytes::NulTerminatedBytes;
 use tracing::Level;
 use tracing_log_error::log_error;
 
-mod existing_docs;
-mod missing_docs;
-mod numeric;
-mod tags;
-mod terms;
+mod orchestration;
 mod util;
 
 /// Status code returned by Fork GC parent-side pipe-receive operations.
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/missing_docs.rs` (removed, +0/-76)
```diff
@@ -1,76 +0,0 @@
-/*
- * Copyright (c) 2006-Present, Redis Ltd.
- * All rights reserved.
- *
- * Licensed under your choice of the Redis Source Available License 2.0
- * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
- * GNU Affero General Public License v3 (AGPLv3).
-*/
-
-use fork_gc::{
-    ForkGC,
-    io_result_ext::IoResultExt,
-    missing_docs::{collect_missing_docs, handle_missing_docs},
-};
-use index_spec::IndexSpecReadGuard;
-
-use crate::{FGCError, util::into_fgc_error};
-
-/// Collect GC delta data for every entry in the spec's `missing.indexes` and
-/// send it to the parent process over the pipe.
-///
-/// Iterates the `missing.indexes`, and for each entry with a non-null
-/// `InvertedIndex` calls `scan_gc` which sends the field name header
-/// followed by the serialised GC delta. Sends a terminator once all
-/// entries are processed.
-///
-/// Any write failure, such as a closed fd or a broken pipe, terminates the
-/// child process via `RedisModule_ExitFromChild`.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-/// 2. `sctx` must point to a valid [`ffi::RedisSearchCtx`].
-/// 3. `sctx.spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
-/// 4. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_childCollectMissingDocs(
-    gc: *mut ffi::ForkGC,
-    sctx: *mut ffi::RedisSearchCtx,
-) {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-    // SAFETY: caller guarantees (2).
-    let spec_ptr = unsafe { (*sctx).spec };
-    // SAFETY: caller guarantees (3).
-    let spec = unsafe { &*spec_ptr };
-
-    // SAFETY: caller guarantees (4). We don't actually hold a read lock, but when the Fork GC code
-    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
-    // then forks and the child has only one thread with exclusive access to the index spec.
-    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
-
-    collect_missing_docs(&mut fgc.writer(), &guard).unwrap_or_exit();
-}
-
-/// Receive and apply the GC delta for one field in the spec's `missing.indexes`.
-///
-/// Reads one protocol frame from the pipe. Returns [`FGCError::Collected`] after
-/// successfully applying a delta, [`FGCError::Done`] when the child sent a
-/// terminator (all fields processed), or an error variant on pipe or spec failure.
-///
-/// Called in a loop (via `COLLECT_FROM_CHILD`) until it returns something other
-/// than [`FGCError::Collected`].
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_parentHandleMissingDocs(gc: *mut ffi::ForkGC) -> FGCError {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-
-    into_fgc_error(handle_missing_docs(fgc), "missing docs")
-}
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/numeric.rs` (removed, +0/-76)
```diff
@@ -1,76 +0,0 @@
-/*
- * Copyright (c) 2006-Present, Redis Ltd.
- * All rights reserved.
- *
- * Licensed under your choice of the Redis Source Available License 2.0
- * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
- * GNU Affero General Public License v3 (AGPLv3).
-*/
-
-use fork_gc::{
-    ForkGC,
-    io_result_ext::IoResultExt,
-    numeric::{collect_numeric, handle_numeric},
-};
-use index_spec::IndexSpecReadGuard;
-
-use crate::{FGCError, util::into_fgc_error};
-
-/// Collect GC delta data for every numeric and geo field in the spec and send
-/// it to the parent process over the pipe.
-///
-/// For each NUMERIC or GEO field whose tree has been initialised, sends the
-/// field name and unique ID as a header, followed by one entry per tree node
-/// with GC work, then a per-field terminator. A final terminator is sent once
-/// all fields have been processed.
-///
-/// Any write failure, such as a closed fd or a broken pipe, terminates the
-/// child process via `RedisModule_ExitFromChild`.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-/// 2. `sctx` must point to a valid [`ffi::RedisSearchCtx`].
-/// 3. `sctx.spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
-/// 4. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_childCollectNumeric(
-    gc: *mut ffi::ForkGC,
-    sctx: *mut ffi::RedisSearchCtx,
-) {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-    // SAFETY: caller guarantees (2).
-    let spec_ptr = unsafe { (*sctx).spec };
-    // SAFETY: caller guarantees (3).
-    let spec = unsafe { &*spec_ptr };
-
-    // SAFETY: caller guarantees (4). We don't actually hold a read lock, but when the Fork GC code
-    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
-    // then forks and the child has only one thread with exclusive access to the index spec.
-    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
-
-    collect_numeric(&mut fgc.writer(), &guard).unwrap_or_exit();
-}
-
-/// Receive and apply the GC deltas for one numeric or geo field.
-///
-/// Reads a field header from the pipe followed by that field's per-node
-/// deltas, applying each to the field's numeric tree under the write lock and
-/// updating statistics. Returns [`FGCError::Done`] when the child sent the
-/// global terminator instead of a field header (all fields processed),
-/// [`FGCError::Collected`] after a field's deltas were applied, or an error
-/// variant on pipe, spec, or tree-lookup failure.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_parentHandleNumeric(gc: *mut ffi::ForkGC) -> FGCError {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-
-    into_fgc_error(handle_numeric(fgc), "numeric")
-}
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/orchestration.rs` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+/*
+ * Copyright (c) 2006-Present, Redis Ltd.
+ * All rights reserved.
+ *
+ * Licensed under your choice of the Redis Source Available License 2.0
+ * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
+ * GNU Affero General Public License v3 (AGPLv3).
+*/
+
+//! C ABI entrypoints for the Fork GC child and parent orchestration.
+
+use fork_gc::{
+    ForkGC, HandleError, HandleOutcome,
+    orchestration::{collect_scanners, handle_scanners},
+};
+use index_spec::IndexSpecReadGuard;
+use tracing::Level;
+use tracing_log_error::log_error;
+
+use crate::FGCError;
+
+/// Scan every Fork GC index kind and send its deltas to the parent process.
+///
+/// # Safety
+///
+/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
+///    alive for the duration of this call.
+/// 2. `spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
+/// 3. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn FGC_childScanIndexes(gc: *mut ffi::ForkGC, spec: *mut ffi::IndexSpec) {
+    // SAFETY: caller guarantees (1).
+    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
+    // SAFETY: caller guarantees (2).
+    let spec = unsafe { &*spec };
+    // SAFETY: caller guarantees (3). We don't actually hold a read lock, but when the Fork GC code
+    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
+    // then forks and the child has only one thread with exclusive access to the index spec.
+    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
+
+    collect_scanners(fgc, &guard);
+}
+
+/// Consume every Fork GC scanner stream and apply its deltas in the parent.
+///
+/// # Safety
+///
+/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
+///    alive for the duration of this call.
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn FGC_parentHandleFromChild(gc: *mut ffi::ForkGC) -> FGCError {
+    // SAFETY: caller guarantees (1).
+    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
+
+    match handle_scanners(fgc) {
+        Ok(HandleOutcome::Collected) => FGCError::Collected,
+        Ok(HandleOutcome::Done) => FGCError::Done,
+        Err((scanner, error @ HandleError::Codec { .. })) => {
+            log_error!(error, level: Level::WARN, "ForkGC: {scanner}: codec error");
+            FGCError::ChildError
+        }
+        Err((scanner, error @ HandleError::SpecDeleted)) => {
+            log_error!(error, level: Level::WARN, "ForkGC: {scanner}: index spec deleted");
+            FGCError::SpecDeleted
+        }
+        Err((scanner, error @ HandleError::ApplyError(_))) => {
+            log_error!(error, level: Level::WARN, "ForkGC: {scanner}: apply error");
+            FGCError::ParentError
+        }
+    }
+}
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/tags.rs` (removed, +0/-82)
```diff
@@ -1,82 +0,0 @@
-/*
- * Copyright (c) 2006-Present, Redis Ltd.
- * All rights reserved.
- *
- * Licensed under your choice of the Redis Source Available License 2.0
- * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
- * GNU Affero General Public License v3 (AGPLv3).
-*/
-
-use fork_gc::{
-    ForkGC,
-    io_result_ext::IoResultExt,
-    tags::{collect_tags, handle_tags},
-};
-use index_spec::IndexSpecReadGuard;
-
-use crate::{FGCError, util::into_fgc_error};
-
-/// Collect GC delta data for every tag of every TAG field in the spec and send
-/// it to the parent process over the pipe.
-///
-/// Walks each TAG field's tag index and, for every tag whose posting list has
-/// GC work, sends the field name, the tag index's unique id, the tag, and the
-/// serialised GC delta. Tags that produce no delta, and fields whose postings
-/// live on disk, are skipped. A terminator is sent once every field has been
-/// walked.
-///
-/// Any write failure, such as a closed fd or a broken pipe, terminates the
-/// child process via `RedisModule_ExitFromChild`.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-/// 2. `sctx` must point to a valid [`ffi::RedisSearchCtx`].
-/// 3. `sctx.spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
-/// 4. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_childCollectTags(
-    gc: *mut ffi::ForkGC,
-    sctx: *mut ffi::RedisSearchCtx,
-) {
-    debug_assert!(!gc.is_null());
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-    debug_assert!(!sctx.is_null());
-    // SAFETY: caller guarantees (2).
-    let spec_ptr = unsafe { (*sctx).spec };
-    debug_assert!(!spec_ptr.is_null());
-    // SAFETY: caller guarantees (3).
-    let spec = unsafe { &*spec_ptr };
-
-    // SAFETY: caller guarantees (4). We don't actually hold a read lock, but when the Fork GC code
-    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
-    // then forks and the child has only one thread with exclusive access to the index spec.
-    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
-
-    collect_tags(&mut fgc.writer(), &guard).unwrap_or_exit();
-}
-
-/// Receive and apply the GC delta for one tag value.
-///
-/// Reads one message from the pipe. Returns [`FGCError::Collected`] after
-/// successfully applying a delta, [`FGCError::Done`] when the child sent the
-/// terminator (all tags processed), or an error variant on pipe, spec, or
-/// tag-index lookup failure.
-///
-/// Called in a loop (via `COLLECT_FROM_CHILD`) until it returns something other
-/// than [`FGCError::Collected`].
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_parentHandleTags(gc: *mut ffi::ForkGC) -> FGCError {
-    debug_assert!(!gc.is_null());
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-
-    into_fgc_error(handle_tags(fgc), "tags")
-}
```

**File**: `src/redisearch_rs/c_entrypoint/fork_gc_ffi/src/terms.rs` (removed, +0/-77)
```diff
@@ -1,77 +0,0 @@
-/*
- * Copyright (c) 2006-Present, Redis Ltd.
- * All rights reserved.
- *
- * Licensed under your choice of the Redis Source Available License 2.0
- * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
- * GNU Affero General Public License v3 (AGPLv3).
-*/
-
-use fork_gc::{
-    ForkGC,
-    io_result_ext::IoResultExt,
-    terms::{collect_terms, handle_terms},
-};
-use index_spec::IndexSpecReadGuard;
-
-use crate::{FGCError, util::into_fgc_error};
-
-/// Collect GC delta data for every term in the spec's terms trie and send it
-/// to the parent process over the pipe.
-///
-/// Walks the terms trie, and for each term with a non-null `InvertedIndex`
-/// attempts a GC scan. When a scan produces a delta the term header (its raw
-/// bytes) followed by the serialised GC delta is sent. Terms that produce no
-/// delta or fail the scan are skipped. A terminator is sent once every term
-/// has been processed.
-///
-/// Any write failure, such as a closed fd or a broken pipe, terminates the
-/// child process via `RedisModule_ExitFromChild`.
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-/// 2. `sctx` must point to a valid [`ffi::RedisSearchCtx`].
-/// 3. `sctx.spec` must be a non-null pointer to a valid [`ffi::IndexSpec`].
-/// 4. This function should only be called when it has exclusive access to the [`ffi::IndexSpec`].
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_childCollectTerms(
-    gc: *mut ffi::ForkGC,
-    sctx: *mut ffi::RedisSearchCtx,
-) {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-    // SAFETY: caller guarantees (2).
-    let spec_ptr = unsafe { (*sctx).spec };
-    // SAFETY: caller guarantees (3).
-    let spec = unsafe { &*spec_ptr };
-
-    // SAFETY: caller guarantees (4). We don't actually hold a read lock, but when the Fork GC code
-    // runs it holds the Redis GIL (so no other thread would be touching any shared Redis state),
-    // then forks and the child has only one thread with exclusive access to the index spec.
-    let guard = unsafe { IndexSpecReadGuard::from_locked(spec) };
-
-    collect_terms(&mut fgc.writer(), &guard).unwrap_or_exit();
-}
-
-/// Receive and apply the GC delta for one term in the spec's terms trie.
-///
-/// Reads one protocol frame from the pipe. Returns [`FGCError::Collected`] after
-/// successfully applying a delta, [`FGCError::Done`] when the child sent a
-/// terminator (all terms processed), or an error variant on pipe or spec failure.
-///
-/// Called in a loop (via `COLLECT_FROM_CHILD`) until it returns something other
-/// than [`FGCError::Collected`].
-///
-/// # Safety
-///
-/// 1. `gc` must point to a valid [`ffi::ForkGC`], with no other reference to it
-///    alive for the duration of this call.
-#[unsafe(no_mangle)]
-pub unsafe extern "C" fn FGC_parentHandleTerms(gc: *mut ffi::ForkGC) -> FGCError {
-    // SAFETY: caller guarantees (1).
-    let fgc = unsafe { ForkGC::from_ptr_mut(gc) };
-
-    into_fgc_error(handle_terms(fgc), "terms")
-}
```

#### Recent Merged Pull Requests:
- **PR #12093** (2026-10-30): Thread GC: batch delta applies and start early on update bursts (@GuyAv46)
- **PR #12087** (2026-10-30): [8.12] [MOD-19999] Avoid document key map memory until first INKEYS use (@redisearch-backport-pull-request[bot])
- **PR #12076** (2026-10-29): [8.12] [MOD-19999] Fix queued INKEYS updates with worker-side key lookup (@redisearch-backport-pull-request[bot])
- **PR #12062** (2026-10-29): Refactor FT.CREATE option parsing into a reusable function (@Itzikvaknin)
- **PR #12050** (closed): GEO EXP #4 ffi (@JonasKruckenberg)
- **PR #12049** (closed):  GEO EXP #5 port  (@JonasKruckenberg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
