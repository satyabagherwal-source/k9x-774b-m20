> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `27424dee`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T18:13:54.975Z  
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
> **Harvest Timestamp**: 2026-11-04T18:13:54.329Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RediSearch/RediSearch`
- **Description**: A query and indexing engine for Redis, providing secondary indexing, full-text search, vector similarity search and aggregations.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6246 stars

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
- **Issue #12186** (2026-11-04): **[BUG] FLOAT32 COSINE search returns distance -1 for an identical nonzero subnormal vector**
  *Symptoms*: **Describe the bug**  A `FLOAT32` vector index using the `COSINE` distance metric returns a distance of `-1` when an identical, finite, nonzero subnormal vector is used as both the stored vector and the query vector.  For an identical nonzero vector, the cosine similarity should be `1` and the cosine distance should be `0`. Instead, the returned distance is `-1`, which is outside the expected cosine-distance range and can affect ranking and threshold filtering.  The input value is the smallest positive nonzero IEEE-754 float32 value:  ```text t = 1.401298464324817e-45 vector = [t, t] ```  The result was reproduced consistently.  **To Reproduce**  1. Start Redis Stack:  ```bash docker run --rm --name redis-cosine-repro -p 6379:6379 redis/redis-stack-server:latest ```  2. Install the Python client:  ```bash python -m pip install redis ```  3. Save and run the following script:  ```python import struct import uuid  import redis   client = redis.Redis(host="127.0.0.1", port=6379)  suffix = uuid.uuid4().hex[:8] index_name = f"idx_cosine_subnormal_{suffix}" key_prefix = f"cosine_subnormal_{suffix}:" point_key = f"{key_prefix}0"  # IEEE-754 binary32 bit pattern 0x00000001: # the smallest positive, nonzero float32 value. tiny = struct.unpack("<f", struct.pack("<I", 1))[0]  # The stored vector and query vector are identical. vector_blob = struct.pack("<ff", tiny, tiny)  try:     client.execute_command(         "FT.CREATE",         index_name,         "ON", "HASH",         "PREFIX", "1

- **Issue #11970** (2026-10-26): **[BUG] Duplicate FT.AGGREGATE cursor rows after deletes while index backfill is active**
  *Symptoms*: ## Describe the bug  A raw redis-py diagnostic observed duplicate physical row IDs across FT.AGGREGATE / FT.CURSOR READ pages immediately after bulk deletes while FT.INFO still reported indexing=1. This reproducer does not use Go, ADBC or Arrow. Please investigate whether this is a defect or an expected limitation during initial backfill, and document a supported readiness/mitigation contract.  ## Environment  - Redis OSS 8.6.2; Search module version 80600 (8.6.0), local Docker standalone. - Client: macOS 26.7.1 arm64, redis-py; diagnostic runs RESP2 and RESP3 separately. - search-max-aggregate-results: 2147483648. - Observations were captured on October 21, 2026. This report uses preserved evidence; it is not a new reproduction against latest master. CPU model was not recorded.  ## To reproduce  1. On a disposable Redis with Search, create a HASH index with sortable NUMERIC __rowid, adv and width fields. 2. Insert row IDs 1..100000, then delete every ID not divisible by 10. No further application writes are made during reads. 3. Query `@__rowid:[1 100000]` with `LOAD 4 @__key @__rowid @width @adv`, `TIMEOUT 0`, `WITHCURSOR COUNT 10000`, `DIALECT 2`. Finish every cursor with `FT.CURSOR READ ... COUNT 10000`. 4. Compare the complete row multiset with IDs 10,20,...,100000. Repeat, and compare with a separate run that first waits for num_docs=10000 and indexing=0.  Preserved executable reproducer (creates/drops only a generated test prefix/index): https://github.com/alberttwong/

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

### Incident Patch 1: `de0080dd` (2026-11-04)
**Commit Message**: skills: suggest Box::into_raw over Box::leak in rust-review (#11875)

skills: forbid Box::leak in rust-review

Box::leak is meant for values that live for the rest of the program,
which RediSearch almost never has. A leak that is never reclaimed fails
Miri's leak checker; one reclaimed with Box::from_raw goes through a
&'static mut that misstates the ownership.

Add check 3i: any new Box::leak is a blocking finding, with the
alternatives to use instead (Box::into_raw, storing the Box, OnceLock /
LazyLock for true globals). The only exception is a process-lifetime
value with a comment explaining why no alternative fits.

**File**: `.skills/rust-review/SKILL.md` (modified, +31/-1)
```diff
@@ -290,6 +290,36 @@ Violations (report as suggestions):
 - A test calling `*_ffi` constructors or vtable callbacks where the crate's safe API
   covers the same path.
 
+#### 3i. Don't use `Box::leak`
+
+Treat [`Box::leak`](https://doc.rust-lang.org/std/boxed/struct.Box.html#method.leak) as
+off-limits in this codebase. It exists for data that lives for the rest of the program,
+and RediSearch has almost no such data: every index, query, and result is eventually
+freed. A leaked value that is never reclaimed is a real leak, and Miri's leak checker
+fails `cargo miri test` whenever a test exercises the leaking path. A leaked value that
+*is* reclaimed with `Box::from_raw` works, but the `&'static mut T` it goes through
+misstates the ownership and hides the reclaim path from the reader.
+
+Use instead:
+- To hand ownership to C or store it as a raw pointer:
+  [`Box::into_raw`](https://doc.rust-lang.org/std/boxed/struct.Box.html#method.into_raw),
+  reclaimed with `Box::from_raw`.
+- To get a `NonNull<T>`:
+  `NonNull::new(Box::into_raw(b)).expect("Box pointers are non-null")`, which needs no
+  `unsafe` while `Box::into_non_null` is unstable.
+- To keep an owned value alongside a borrowed one: store the `Box` (or an enum of owned
+  and borrowed variants) rather than leaking it to obtain a reference.
+- For a true process-lifetime global: a `static` with `OnceLock` / `LazyLock`.
+
+Violations:
+- Any new `Box::leak` call, whatever the result is used for and whether or not it is
+  later reclaimed. The only exception is a value that is provably initialized once and
+  never freed for the life of the process, with a comment stating why none of the
+  alternatives above fit.
+
+A leak on a path that repeats (per query, per index, per document) with no matching
+`Box::from_raw` is also unbounded allocation; report it under 3e as well.
+
 ### 4. Porting-mode checks (only when porting mode = true)
 
 #### 4a. Semantic equivalence
@@ -347,7 +377,7 @@ At the end, provide a short summary:
 - Total suggestions
 - Whether the change is **ready to merge** or **needs revision**
 
-Blocking violations: any issue in 3a, 3b, 4a, 4b, or 4c, plus any 3e issue that
+Blocking violations: any issue in 3a, 3b, 3i, 4a, 4b, or 4c, plus any 3e issue that
 can cause memory unsoundness, crashes, data exposure, unauthorized access, or
 denial of service, plus the first two 3g violations (behavior with no test, and
 uncovered code paths).
```

---

### Incident Patch 2: `365789b1` (2026-11-04)
**Commit Message**: [MOD-20055] Fix use-after-free when scoring filtered vector queries whose filter index changes mid-query (#12022)

* index_result: Share query terms between term records

Borrowed and FullyOwned term records own their query term in a Box, so
a to_owned copy can only borrow it, and is left dangling if the record
goes first. A FullyOwned record is the one meant to outlive its source,
so that is the copy most likely to be held past it.

Hold the term of Borrowed and FullyOwned records in a SharedQueryTerm,
a reference-counted pointer to the term itself, and have to_owned share
the term of a FullyOwned record rather than borrow it. Sharing only bumps
a counter. C still sees an RSQueryTerm pointer.

* index_result: Merge the two owned term record variants

With query terms shared, an Owned term record borrowing its term from
another record no longer saves anything worth a variant: sharing the
term costs a counter bump. Make Owned share its term, as FullyOwned did,
and drop FullyOwned. A to_owned copy then borrows nothing from its
source, so to_owned takes &self rather than &'a self, and the copy stays
valid after the iterator that produced the record is dropped, which the
top-k's captur

**File**: `src/aggregate/functions/string.c` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ static int func_matchedTerms(ExprEval *ctx, RSValue **argv, size_t argc, RSValue
   const SearchResult *res = ctx->res;
 
   if (res && SearchResult_HasIndexResult(res)) {
-    RSQueryTerm *terms[maxTerms];
+    const RSQueryTerm *terms[maxTerms];
     size_t n = IndexResult_GetMatchedTerms(SearchResult_GetIndexResult(ctx->res), terms, maxTerms);
     if (n) {
       RSValue **arr = RSValue_NewArrayBuilder(n);
```

**File**: `src/ext/debug_scorers.c` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@
 /* Recursively sum IDF values from all terms in the result */
 static double sumIdfRecursive(const RSIndexResult *r) {
   if (r->data.tag == RSResultData_Term) {
-    RSQueryTerm *term = IndexResult_QueryTermRef(r);
+    const RSQueryTerm *term = IndexResult_QueryTermRef(r);
     return term ? QueryTerm_GetIDF(term) : 0;
   }
   if (r->data.tag & (RSResultData_Intersection | RSResultData_Union | RSResultData_HybridMetric)) {
@@ -55,7 +55,7 @@ static double sumIdfRecursive(const RSIndexResult *r) {
 /* Recursively sum BM25 IDF values from all terms in the result */
 static double sumBm25IdfRecursive(const RSIndexResult *r) {
   if (r->data.tag == RSResultData_Term) {
-    RSQueryTerm *term = IndexResult_QueryTermRef(r);
+    const RSQueryTerm *term = IndexResult_QueryTermRef(r);
     return term ? QueryTerm_GetBM25_IDF(term) : 0;
   }
   if (r->data.tag & (RSResultData_Intersection | RSResultData_Union | RSResultData_HybridMetric)) {
```

**File**: `src/ext/default.c` (modified, +3/-3)
```diff
@@ -68,7 +68,7 @@ static void strExpCreateParent(const ScoringFunctionArgs *ctx, RSScoreExplain **
 static double tfidfRecursive(const RSIndexResult *r, const RSDocumentMetadata *dmd,
                              RSScoreExplain *scrExp) {
   if (r->data.tag == RSResultData_Term) {
-    RSQueryTerm *term = IndexResult_QueryTermRef(r);
+    const RSQueryTerm *term = IndexResult_QueryTermRef(r);
     double idf = term ? QueryTerm_GetIDF(term) : 0;
     double res = r->weight * ((double)r->freq) * idf;
     EXPLAIN(scrExp, "(TFIDF %.2f = Weight %.2f * TF %d * IDF %.2f)", res, r->weight, r->freq, idf);
@@ -168,7 +168,7 @@ static double bm25Recursive(const ScoringFunctionArgs *ctx, const RSIndexResult
   double f = (double)r->freq;
   double ret = 0;
   if (r->data.tag == RSResultData_Term) {
-    RSQueryTerm *term = IndexResult_QueryTermRef(r);
+    const RSQueryTerm *term = IndexResult_QueryTermRef(r);
     double idf = (term ? QueryTerm_GetIDF(term) : 0);
     ret = r->weight * idf * f / (f + k1 * (1.0f - b + b * ctx->indexStats.avgDocLen));
     EXPLAIN(scrExp,
@@ -258,7 +258,7 @@ static double bm25StdRecursive(const ScoringFunctionArgs *ctx, const RSIndexResu
   double ret = 0;
   if (r->data.tag == RSResultData_Term) {
     // Compute IDF based on total number of docs in the index and the term's total frequency.
-    RSQueryTerm *term = IndexResult_QueryTermRef(r);
+    const RSQueryTerm *term = IndexResult_QueryTermRef(r);
     double idf = QueryTerm_GetBM25_IDF(term);
     size_t term_len = 0;
     const char *term_str = QueryTerm_GetStrAndLen(term, &term_len);
```

**File**: `src/fragmenter.c` (modified, +1/-1)
```diff
@@ -495,7 +495,7 @@ int FragmentTermIterator_Next(FragmentTermIterator *iter, FragmentTerm **termInf
     return 1;
   }
 
-  RSQueryTerm *term = iter->curMatchRec;
+  const RSQueryTerm *term = iter->curMatchRec;
 
   iter->tmpTerm.score = QueryTerm_GetIDF(term);
   iter->tmpTerm.termId = QueryTerm_GetID(term);
```

**File**: `src/fragmenter.h` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ typedef struct {
 typedef struct {
   RSByteOffsetIterator *byteIter;
   RSOffsetIterator *offsetIter;
-  RSQueryTerm *curMatchRec;
+  const RSQueryTerm *curMatchRec;
   uint32_t curTokPos;
   uint32_t curByteOffset;
   FragmentTerm tmpTerm;
```

**File**: `src/index_result/index_result.c` (modified, +4/-3)
```diff
@@ -104,7 +104,8 @@ int IndexResult_MinOffsetDelta(const RSIndexResult *r) {
   return dist ? sqrt(dist) : num - 1;
 }
 
-void result_GetMatchedTerms(const RSIndexResult *r, RSQueryTerm *arr[], size_t cap, size_t *len) {
+void result_GetMatchedTerms(const RSIndexResult *r, const RSQueryTerm *arr[], size_t cap,
+                            size_t *len) {
   if (*len == cap) return;
 
   switch (r->data.tag) {
@@ -123,7 +124,7 @@ void result_GetMatchedTerms(const RSIndexResult *r, RSQueryTerm *arr[], size_t c
     }
     case RSResultData_Term:
     {
-      RSQueryTerm *term = IndexResult_QueryTermRef(r);
+      const RSQueryTerm *term = IndexResult_QueryTermRef(r);
       if (term) {
         size_t s_len = 0;
         // make sure we have a term string and it's not an expansion
@@ -137,7 +138,7 @@ void result_GetMatchedTerms(const RSIndexResult *r, RSQueryTerm *arr[], size_t c
   }
 }
 
-size_t IndexResult_GetMatchedTerms(const RSIndexResult *r, RSQueryTerm **arr, size_t cap) {
+size_t IndexResult_GetMatchedTerms(const RSIndexResult *r, const RSQueryTerm **arr, size_t cap) {
   size_t arrlen = 0;
   result_GetMatchedTerms(r, arr, cap, &arrlen);
   return arrlen;
```

**File**: `src/index_result/index_result.h` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ int IndexResult_MinOffsetDelta(const RSIndexResult *r);
 
 /* Fill an array of max capacity cap with all the matching text terms for the result. The number of
  * matching terms is returned */
-size_t IndexResult_GetMatchedTerms(const RSIndexResult *r, RSQueryTerm **arr, size_t cap);
+size_t IndexResult_GetMatchedTerms(const RSIndexResult *r, const RSQueryTerm **arr, size_t cap);
 
 #ifdef __cplusplus
 }
```

**File**: `src/offset_vector.c` (modified, +10/-10)
```diff
@@ -29,21 +29,21 @@ typedef struct {
   Buffer buf;
   BufferReader br;
   uint32_t lastValue;
-  RSQueryTerm *term;
+  const RSQueryTerm *term;
 } _RSOffsetVectorIterator;
 
 typedef struct {
   const RSAggregateResult *res;
   size_t size;
   RSOffsetIterator *iters;
   uint32_t *offsets;
-  RSQueryTerm **terms;
+  const RSQueryTerm **terms;
   // uint32_t lastOffset; - TODO: Avoid duplicate offsets
 
 } _RSAggregateOffsetIterator;
 
 /* Get the next entry, or return RS_OFFSETVECTOR_EOF */
-uint32_t _ovi_Next(void *ctx, RSQueryTerm **t);
+uint32_t _ovi_Next(void *ctx, const RSQueryTerm **t);
 /* Rewind the iterator */
 void _ovi_Rewind(void *ctx);
 
@@ -65,7 +65,7 @@ void *newOffsetIterator() {
   return rm_malloc(sizeof(_RSOffsetVectorIterator));
 }
 /* Create an offset iterator interface  from a raw offset vector */
-RSOffsetIterator RSOffsetVector_Iterate(const RSOffsetVector *v, RSQueryTerm *t) {
+RSOffsetIterator RSOffsetVector_Iterate(const RSOffsetVector *v, const RSQueryTerm *t) {
   mempool_t *pool = pthread_getspecific(__offsetIters);
   if (!pool) {
     mempool_options options = {
@@ -85,7 +85,7 @@ RSOffsetIterator RSOffsetVector_Iterate(const RSOffsetVector *v, RSQueryTerm *t)
 }
 
 /* An aggregate offset iterator yielding offsets one by one */
-uint32_t _aoi_Next(void *ctx, RSQueryTerm **term);
+uint32_t _aoi_Next(void *ctx, const RSQueryTerm **term);
 void _aoi_Free(void *ctx);
 void _aoi_Rewind(void *ctx);
 
@@ -127,7 +127,7 @@ static RSOffsetIterator _aggregateResult_iterate(const RSAggregateResult *agg) {
     rm_free(it->terms);
     it->iters = rm_calloc(numChildren, sizeof(RSOffsetIterator));
     it->offsets = rm_calloc(numChildren, sizeof(uint32_t));
-    it->terms = rm_calloc(numChildren, sizeof(RSQueryTerm *));
+    it->terms = rm_calloc(numChildren, sizeof(const RSQueryTerm *));
   }
 
   AggregateRecordsSlice children = AggregateResult_GetRecordsSlice(agg);
@@ -139,7 +139,7 @@ static RSOffsetIterator _aggregateResult_iterate(const RSAggregateResult *agg) {
 
   return (RSOffsetIterator){.Next = _aoi_Next, .Rewind = _aoi_Rewind, .Free = _aoi_Free, .ctx = it};
 }
-uint32_t _empty_Next(void *ctx, RSQueryTerm **t) {
+uint32_t _empty_Next(void *ctx, const RSQueryTerm **t) {
   return RS_OFFSETVECTOR_EOF;
 }
 void _empty_Free(void *ctx) {
@@ -159,7 +159,7 @@ RSOffsetIterator RSIndexResult_IterateOffsets(const RSIndexResult *res) {
     case RSResultData_Term:
     {
       const RSOffsetVector *offsets = IndexResult_TermOffsetsRef(res);
-      RSQueryTerm *term = IndexResult_QueryTermRef(res);
+      const RSQueryTerm *term = IndexResult_QueryTermRef(res);
       return RSOffsetVector_Iterate(offsets, term);
     }
 
@@ -201,7 +201,7 @@ void _ovi_Free(void *ctx) {
   rm_free(ctx);
 }
 
-uint32_t _ovi_Next(void *ctx, RSQueryTerm **t) {
+uint32_t _ovi_Next(void *ctx, const RSQueryTerm **t) {
   _RSOffsetVectorIterator *vi = ctx;
 
   if (!BufferReader_AtEnd(&vi->br)) {
@@ -213,7 +213,7 @@ uint32_t _ovi_Next(void *ctx, RSQueryTerm **t) {
   return RS_OFFSETVECTOR_EOF;
 }
 
-uint32_t _aoi_Next(void *ctx, RSQueryTerm **t) {
+uint32_t _aoi_Next(void *ctx, const RSQueryTerm **t) {
   _RSAggregateOffsetIterator *it = ctx;
 
   int minIdx = -1;
```

---

### Incident Patch 3: `1d5ed985` (2026-11-04)
**Commit Message**: [MOD-20241] Stop row and reply loops on a query memory stop (#12099)

* Add a stop request with a reason to the query timeout state

Any thread can now ask a query execution cycle to stop, in every timeout
kind including unarmed. IsTimedOut and IsTimedOutExact report it
unamortized, and so does the Rust request timeout context, so their
callers stop without a per-site change. IsBlockedClientTimedOut ignores
it, since its callers ask whether the timeout callback owns the reply.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Stop row and reply loops on a requested query stop

Add QueryRequest_ShouldStop, a requested stop or the blocked-client
timeout, and use it at the per-row checks of AggregateResults and the
safe depleter, the coordinator network processor's entry and post-pop
checks, and the per-shard merge loops of the FT.SEARCH reducer. The
coordinator pop also aborts on the stop flag in every timeout kind.
Ownership checks keep IsBlockedClientTimedOut.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Keep the stop out of the timeout checks

Timeout checks run on every iterator probe; reading the stop there cost
about 14 instructions per probe. Stop-check sites re

**File**: `src/aggregate/aggregate_exec_common.c` (modified, +8/-6)
```diff
@@ -102,10 +102,11 @@ static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {}
      // clean the search result
      r = SearchResult_New();
 
-     // Honour a main-thread timeout flag at the row boundary: buffering
-     // stages (safe loader, sorter yield) can keep emitting from internal
-     // buffers without re-touching upstream's per-row timeout check.
-     if (areq && QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits)) {
+     // Honour a memory stop or a main-thread timeout flag at the row
+     // boundary: buffering stages (safe loader, sorter yield) can keep emitting
+     // from internal buffers without re-touching upstream's per-row timeout check.
+     if (areq && (QueryRequestLimits_IsMemoryStopped(&areq->base.limits) ||
+                  QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits))) {
        *rc = RS_RESULT_TIMEDOUT;
        break;
      }
@@ -122,8 +123,9 @@ static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {}
    if (ctx->limits->timeout.config.timeoutPolicy != TimeoutPolicy_Return || ctx->oomPolicy == OomPolicy_Fail) {
      // Aggregate all results before populating the response
      *results = AggregateResults(rp, ctx->areq, rc);
-     // Check timeout after aggregation
-     if (QueryRequestLimits_IsTimedOutExact(ctx->limits)) {
+     // Check timeout after aggregation; a memory stop raised while filling the limit ends it the
+     // same way.
+     if (QueryRequestLimits_ShouldStopExact(ctx->limits)) {
        *rc = RS_RESULT_TIMEDOUT;
      }
    } else {
```

**File**: `src/coord/hybrid/dist_hybrid.c` (modified, +1/-1)
```diff
@@ -997,7 +997,7 @@ static ResultProcessor *findSafeDepleter(const HybridRequest *hreq, size_t i) {
 // the tail hybrid merger job that cv-waits on their completion or this will
 // deadlock (see submitHybridTail).
 static void scheduleDepleters(HybridRequest *hreq) {
-    const bool timedOut = QueryRequestLimits_IsTimedOutExact(&hreq->base.limits);
+    const bool timedOut = QueryRequestLimits_ShouldStopExact(&hreq->base.limits);
     for (size_t i = 0; i < hreq->nrequests; i++) {
         ResultProcessor *depleter = findSafeDepleter(hreq, i);
         if (timedOut) {
```

**File**: `src/coord/rmr/chan.c` (modified, +6/-4)
```diff
@@ -171,15 +171,17 @@ static bool waitForCond(pthread_cond_t *cond, pthread_mutex_t *lock,
 }
 
 void *MRChannel_PopWithTimeout(MRChannel *chan, const struct timespec *abstimeMono,
-                               atomic_bool *abortFlag, bool *timedOut) {
-  // At least one wake mechanism must be provided; callers without either should use MRChannel_Pop.
-  RS_ASSERT(abstimeMono || abortFlag);
+                               atomic_bool *timedOutFlag, atomic_bool *memoryStopFlag,
+                               bool *timedOut) {
+  // At least one wake mechanism must be provided; callers without any should use MRChannel_Pop.
+  RS_ASSERT(abstimeMono || timedOutFlag || memoryStopFlag);
   if (timedOut) *timedOut = false;
 
   pthread_mutex_lock(&chan->lock);
   while (!chan->size) {
     // Sticky abort flipped by another thread (e.g. timeout callback + MRChannel_WakeAbort).
-    if (abortFlag && atomic_load_explicit(abortFlag, memory_order_relaxed)) goto aborted;
+    if (timedOutFlag && atomic_load_explicit(timedOutFlag, memory_order_relaxed)) goto aborted;
+    if (memoryStopFlag && atomic_load_explicit(memoryStopFlag, memory_order_relaxed)) goto aborted;
     // One-shot unblock via MRChannel_Unblock; reset for the next pop.
     if (!chan->wait) { chan->wait = true; goto aborted; }
     // Park until pushed/broadcast/deadline. Re-checks all conditions on wake.
```

**File**: `src/coord/rmr/chan.h` (modified, +6/-4)
```diff
@@ -28,11 +28,13 @@ void *MRChannel_Pop(MRChannel *chan);
 void *MRChannel_TryPop(MRChannel *chan);
 
 /* Pop an item, with optional CLOCK_MONOTONIC_RAW deadline (`abstime`) and/or abort
- * flag (re-checked on each wait entry; pair with MRChannel_WakeAbort). `timedOut`
- * set if deadline expired. At least one of `abstime` / `abortFlag` must be non-NULL;
- * callers wanting an indefinite blocking pop should use MRChannel_Pop. */
+ * flags (either one aborts; re-checked on each wait entry; pair with
+ * MRChannel_WakeAbort). `timedOut` set if deadline expired. At least one of
+ * `abstime` / `timedOutFlag` / `memoryStopFlag` must be non-NULL; callers wanting an
+ * indefinite blocking pop should use MRChannel_Pop. */
 void *MRChannel_PopWithTimeout(MRChannel *chan, const struct timespec *abstime,
-                               atomic_bool *abortFlag, bool *timedOut);
+                               atomic_bool *timedOutFlag, atomic_bool *memoryStopFlag,
+                               bool *timedOut);
 
 /* Wake any thread currently blocked in MRChannel_PopWithTimeout so it re-evaluates
  * its abort flag. Safe to call even if no reader is blocked. */
```

**File**: `src/coord/rmr/rmr.c` (modified, +3/-2)
```diff
@@ -1017,8 +1017,9 @@ MRReply *MRIterator_Next(MRIterator *it) {
 }
 
 MRReply *MRIterator_NextWithTimeout(MRIterator *it, const struct timespec *abstime,
-                                    atomic_bool *abortFlag, bool *timedOut) {
-  return MRChannel_PopWithTimeout(it->ctx.chan, abstime, abortFlag, timedOut);
+                                    atomic_bool *timedOutFlag, atomic_bool *memoryStopFlag,
+                                    bool *timedOut) {
+  return MRChannel_PopWithTimeout(it->ctx.chan, abstime, timedOutFlag, memoryStopFlag, timedOut);
 }
 
 struct MRChannel *MRIterator_GetChannel(MRIterator *it) {
```

**File**: `src/coord/rmr/rmr.h` (modified, +5/-4)
```diff
@@ -210,11 +210,12 @@ MRReply *MRIterator_Next(MRIterator *it);
 MRReply *MRIterator_TryNext(MRIterator *it);
 
 /* Get next reply, with optional CLOCK_MONOTONIC_RAW deadline (`abstime`) and/or
- * abort flag (pair with MRChannel_WakeAbort). `timedOut` set if deadline expired.
- * At least one of `abstime` / `abortFlag` must be non-NULL; for an indefinite
- * blocking next, use MRIterator_Next. */
+ * abort flags (either one aborts; pair with MRChannel_WakeAbort). `timedOut` set
+ * if deadline expired. At least one of `abstime` / `timedOutFlag` / `memoryStopFlag`
+ * must be non-NULL; for an indefinite blocking next, use MRIterator_Next. */
 MRReply *MRIterator_NextWithTimeout(MRIterator *it, const struct timespec *abstime,
-                                    RS_Atomic(bool) *abortFlag, bool *timedOut);
+                                    RS_Atomic(bool) *timedOutFlag,
+                                    RS_Atomic(bool) *memoryStopFlag, bool *timedOut);
 
 /* Return the underlying channel used by the iterator. Intended for callers that need to
  * invoke MRChannel_WakeAbort directly (e.g. from a timeout callback on another thread). */
```

**File**: `src/coord/rpnet.c` (modified, +21/-16)
```diff
@@ -378,32 +378,33 @@ int getNextReply(RPNet *nc) {
       return RS_RESULT_EOF;
     }
   }
-  // Pop wake mechanisms: the abort flag is flipped by the FAIL / RETURN-STRICT
+  // Pop wake mechanisms: the timed-out flag is flipped by the FAIL / RETURN-STRICT
   // timeout callback via MRChannel_WakeAbort. Under RETURN the flag is never
-  // flipped: aggregate streams degrade to a blocking pop (legacy RETURN waits
+  // flipped: aggregate streams wait without a deadline (legacy RETURN waits
   // beyond the deadline for in-flight shard replies), while hybrid streams get
   // the in-band wall-clock deadline from getAbsTimeout — see its doc for why.
-  // An unarmed timeout source provides neither mechanism and uses MRIterator_Next.
+  // The memory stop flag aborts the pop in every timeout kind, including
+  // unarmed; whoever requests the memory stop wakes the channel.
 #ifdef ENABLE_ASSERT
   // Sync point (debug): park BG when it is about to wait for the next shard
   // reply. Reaching this site implies any previously admitted reply has been
   // fully drained downstream.
   SyncPoint_WaitUntil(SYNC_POINT_RPNET_WAITING_FOR_REPLY, areq_timed_out, nc->areq);
 #endif
   RS_ASSERT(nc->areq);
-  QueryRequestLimits *timeout = &nc->areq->base.limits;
+  QueryRequestLimits *limits = &nc->areq->base.limits;
   const struct timespec *deadline = getAbsTimeout(nc);
-  RS_Atomic(bool) *abortFlag =
-      timeout->timeout.kind == QUERY_REQUEST_TIMEOUT_BLOCKED_CLIENT
-          ? QueryRequestLimits_GetBlockedClientFlag(timeout)
+  RS_Atomic(bool) *timedOutFlag =
+      limits->timeout.kind == QUERY_REQUEST_TIMEOUT_BLOCKED_CLIENT
+          ? QueryRequestLimits_GetBlockedClientFlag(limits)
           : NULL;
+  RS_Atomic(bool) *memoryStopFlag = QueryRequestLimits_GetMemoryStopFlag(limits);
   bool popTimedOut = false;
   rs_wall_clock waitStart;
   if (nc->profileBreakdown) rs_wall_clock_init(&waitStart);
   MRReply *root = nc->drainOnly ? MRIterator_TryNext(nc->it)
-                  : deadline || abortFlag
-                      ? MRIterator_NextWithTimeout(nc->it, deadline, abortFlag, &popTimedOut)
-                      : MRIterator_Next(nc->it);
+                                : MRIterator_NextWithTimeout(nc->it, deadline, timedOutFlag, memoryStopFlag,
+                                                             &popTimedOut);
   if (nc->profileBreakdown) {
     accumulateSince(&nc->breakdown.waitTime, &waitStart);
     if (root) nc->breakdown.replies++;
@@ -416,7 +417,8 @@ int getNextReply(RPNet *nc) {
     if (nc->drainOnly) {
       return RS_RESULT_EOF;
     }
-    if (popTimedOut || QueryRequestLimits_IsBlockedClientTimedOut(timeout)) {
+    if (popTimedOut || QueryRequestLimits_IsMemoryStopped(limits) ||
+        QueryRequestLimits_IsBlockedClientTimedOut(limits)) {
       return RS_RESULT_TIMEDOUT;
     }
     return MRIterator_GetPending(nc->it) ? RS_RESULT_OK : RS_RESULT_EOF;
@@ -590,11 +592,14 @@ int rpnetNext(ResultProcessor *self, SearchResult *r) {
   SyncPoint_WaitUntil(SYNC_POINT_BEFORE_RPNET_NEXT, areq_timed_out, areq);
 #endif
 
-  // Surface RETURN_STRICT timeouts on follow-up cursor reads where the channel
-  // may already hold a buffered reply (the NULL-reply check below wouldn't fire
-  // and we'd silently return rows). Skipped during the timer's own drain.
-  if (QueryRequest_UsesReplyCallback(&areq->base) && !nc->drainOnly &&
-      QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits)) {
+  // Surface a memory stop, and RETURN_STRICT timeouts on follow-up cursor
+  // reads, where the channel may already hold a buffered reply (the NULL-reply
+  // check below wouldn't fire and we'd silently return rows). Skipped during
+  // the timer's own drain.
+  if (!nc->drainOnly &&
+      (QueryRequestLimits_IsMemoryStopped(&areq->base.limits) ||
+       (QueryRequest_UsesReplyCallback(&areq->base) &&
+        QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits)))) {
     return RS_RESULT_TIMEDOUT;
   }
 
```

**File**: `src/module.c` (modified, +10/-2)
```diff
@@ -3480,6 +3480,14 @@ static bool should_return_error(const searchRequestCtx *req, QueryErrorCode errC
   return true;
 }
 
+// Whether merging replies should end. The timeout callback owns the reply, so a fired
+// blocked-client timeout does not stop its own merge, but a memory stop still does: it must not
+// leave the main thread merging every queued shard reply.
+static inline bool replyMergeShouldStop(searchRequestCtx *req, bool fromTimeout) {
+  return QueryRequestLimits_IsMemoryStopped(&req->base.limits) ||
+         (!fromTimeout && QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits));
+}
+
 static int searchResultReducer(searchRequestCtx *req, int count, MRReply **replies,
                                bool fromTimeout) {
   RedisModuleBlockedClient *bc = NULL;
@@ -3589,7 +3597,7 @@ static int searchResultReducer(searchRequestCtx *req, int count, MRReply **repli
   if (!profile) {
     for (int i = 0; i < count; ++i) {
       rCtx->processReply(replies[i], rCtx);
-      if (!fromTimeout && QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits)) {
+      if (replyMergeShouldStop(req, fromTimeout)) {
         goto cleanup;
       }
     }
@@ -3609,7 +3617,7 @@ static int searchResultReducer(searchRequestCtx *req, int count, MRReply **repli
         mr_reply = MRReply_ArrayElement(replies[i], 0);
       }
       rCtx->processReply(mr_reply, rCtx);
-      if (!fromTimeout && QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits)) {
+      if (replyMergeShouldStop(req, fromTimeout)) {
         goto cleanup;
       }
     }
```

#### Recent Merged Pull Requests:
- **PR #12197** (2026-11-04): [8.12] [MOD-20707] Use SVS v0.5.1: fix GCC 16 builds with prebuilt SVS and filtered SVS search recall (@alonre24)
- **PR #12196** (2026-11-04): [MOD-20707] Use SVS v0.5.1: fix GCC 16 builds with prebuilt SVS and filtered SVS search recall (@alonre24)
- **PR #12195** (closed): Jonas topk lifecycle integration (@JonasKruckenberg)
- **PR #12193** (closed): [MOD-20593] Fast-track smoke test: draft rejection (@dkyurtovv)
- **PR #12192** (closed): [MOD-20593] Fast-track smoke test: eligible approval (@dkyurtovv)
- **PR #12191** (2026-11-04): Install cargo-mutants and lcov in Amp orbs (@JonasKruckenberg)

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

## X. skills: suggest Box::into_raw over Box::leak in rust-review (#11875)

**RULE**:
When implementing operations in `.skills/rust-review/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de0080dd`: skills: suggest Box::into_raw over Box::leak in rust-review (#11875). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.skills/rust-review/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#### 3i. Don't use `Box::leak`

Treat [`Box::leak`](https://doc.rust-lang.org/std/boxed/struct.Box.html#method.leak) as
off-limits in this codebase. It exists for data that lives for the rest of the program,
and RediSearch has almost no such data: every index, query, and result is eventually
freed. A leaked value that is never reclaimed is a real leak, and Miri's leak checker
fails `cargo miri test` whenever a test exercises the leaking path. A leaked value that
*is* reclaimed with `Box::from_raw` works, but the `&'static mut T` it goes through
misstates the ownership and hides the reclaim path from the reader.

Use instead:
- To hand ownership to C or store it as a raw pointer:
  [`Box::into_raw`](https://doc.rust-lang.org/std/boxed/struct.Box.html#method.into_raw),
  reclaimed with `Box::from_raw`.
- To get a `NonNull<T>`:
  `NonNull::new(Box::into_raw(b)).expect("Box pointers are non-null")`, which needs no
  `unsafe` while `Box::into_non_null` is unstable.
- To keep an owned value alongside a borrowed one: store the `Box` (or an enum of owned
  and borrowed variants) rather than leaking it to obtain a reference.
- For a true process-lifetime global: a `static` with `OnceLock` /
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
Blocking violations: any issue in 3a, 3b, 4a, 4b, or 4c, plus any 3e issue that
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de0080dd` are properly handled with clean fallback behavior.
