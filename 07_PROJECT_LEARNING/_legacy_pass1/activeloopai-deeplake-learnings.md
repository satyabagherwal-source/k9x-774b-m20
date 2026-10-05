# Forensic Learning Record (Deep Inspection): activeloopai/deeplake

> **Canonical Artifact**: `07_PROJECT_LEARNING/activeloopai-deeplake-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/activeloopai/deeplake](https://github.com/activeloopai/deeplake))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:55:46.894Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `activeloopai/deeplake`
- **Description**: Deeplake is AI Data Runtime for Agents. It provides serverless postgres with a multimodal datalake, enabling scalable retrieval and training.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9245 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cpp/3rd_party/boost_json_impl.cpp`
```
// This file includes the boost::json header-only implementation
// to avoid linking against libboost_json.a which has PIC issues
#include <boost/json/src.hpp>

```

### Core Architecture Module: `cpp/3rd_party/cblas.h`
```
#ifndef CBLAS_H
#define CBLAS_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
	/* Assume C declarations for C++ */
#endif  /* __cplusplus */

#define CBLAS_INDEX size_t

#ifndef BFLOAT16
#include <stdint.h>
typedef uint16_t bfloat16;
#endif


typedef enum CBLAS_ORDER     {CblasRowMajor=101, CblasColMajor=102} CBLAS_ORDER;
typedef enum CBLAS_TRANSPOSE {CblasNoTrans=111, CblasTrans=112, CblasConjTrans=113, CblasConjNoTrans=114} CBLAS_TRANSPOSE;
typedef enum CBLAS_UPLO      {CblasUpper=121, CblasLower=122} CBLAS_UPLO;
typedef enum CBLAS_DIAG      {CblasNonUnit=131, CblasUnit=132} CBLAS_DIAG;
typedef enum CBLAS_SIDE      {CblasLeft=141, CblasRight=142} CBLAS_SIDE;
typedef CBLAS_ORDER CBLAS_LAYOUT;
	
float  cblas_sdsdot(const int n, const float alpha, const float *x, const int incx, const float *y, const int incy);
double cblas_dsdot (const int n, const float *x, const int incx, const float *y, const int incy);
float  cblas_sdot(const int n, const float  *x, const int incx, const float  *y, const int incy);
double cblas_ddot(const int n, const double *x, const int incx, const double *y, const int incy);

void  cblas_cdotu_sub(const int n, const void  *x, const int incx, const void  *y, const int incy, void  *ret);
void  cblas_cdotc_sub(const int n, const void  *x, const int incx, const void  *y, const int incy, void  *ret);
void  cblas_zdotu_sub(const int n, const void *x, const int incx, const void *y, const int incy, void *ret);
void  cblas_zdotc_sub(const int n, const void *x, const int incx, const void *y, const int incy, void *ret);

float  cblas_sasum (const int n, const float  *x, const int incx);
double cblas_dasum (const int n, const double *x, const int incx);
float  cblas_scasum(const int n, const void  *x, const int incx);
double cblas_dzasum(const int n, const void *x, const int incx);

float  cblas_ssum (const int n, const float  *x, const int incx);
double cblas_dsum (const int n, const double *x, const int incx);
float  cblas_scsum(const int n, const void  *x, const int incx);
double cblas_dzsum(const int n, const void *x, const int incx);

float  cblas_snrm2 (const int N, const float  *X, const int incX);
double cblas_dnrm2 (const int N, const double *X, const int incX);
float  cblas_scnrm2(const int N, const void  *X, const int incX);
double cblas_dznrm2(const int N, const void *X, const int incX);

CBLAS_INDEX cblas_isamax(const int n, const float  *x, const int incx);
CBLAS_INDEX cblas_idamax(const int n, const double *x, const int incx);
CBLAS_INDEX cblas_icamax(const int n, const void  *x, const int incx);
CBLAS_INDEX cblas_izamax(const int n, const void *x, const int incx);

CBLAS_INDEX cblas_isamin(const int n, const float  *x, const int incx);
CBLAS_INDEX cblas_idamin(const int n, const double *x, const int incx);
CBLAS_INDEX cblas_icamin(const int n, const void  *x, const int incx);
CBLAS_INDEX cblas_izamin(const int n, const void *x, const int incx);

CBLAS_INDEX cblas_ismax(const int n, const float  *x, const int incx);
CBLAS_INDEX cblas_idmax(const int n, const double *x, const int incx);
CBLAS_INDEX cblas_icmax(const int n, const void  *x, const int incx);
CBLAS_INDEX cblas_izmax(const int n, const void *x, const int incx);

CBLAS_INDEX cblas_ismin(const int n, const float  *x, const int incx);
CBLAS_INDEX cblas_idmin(const int n, const double *x, const int incx);
CBLAS_INDEX cblas_icmin(const int n, const void  *x, const int incx);
CBLAS_INDEX cblas_izmin(const int n, const void *x, const int incx);

void cblas_saxpy(const int n, const float alpha, const float *x, const int incx, float *y, const int incy);
void cblas_daxpy(const int n, const double alpha, const double *x, const int incx, double *y, const int incy);
void cblas_caxpy(const int n, const void *alpha, const void *x, const int incx, void *y, const int incy);
void cblas_zaxpy(const int n, const void *alpha, const void *x, const int incx, void *y, const int incy);

void cblas_scopy(const int n, const float *x, const int incx, float *y, const int incy);
void cblas_dcopy(const int n, const double *x, const int incx, double *y, const int incy);
void cblas_ccopy(const int n, const void *x, const int incx, void *y, const int incy);
void cblas_zcopy(const int n, const void *x, const int incx, void *y, const int incy);

void cblas_sswap(const int n, float *x, const int incx, float *y, const int incy);
void cblas_dswap(const int n, double *x, const int incx, double *y, const int incy);
void cblas_cswap(const int n, void *x, const int incx, void *y, const int incy);
void cblas_zswap(const int n, void *x, const int incx, void *y, const int incy);

void cblas_srot(const int N, float *X, const int incX, float *Y, const int incY, const float c, const float s);
void cblas_drot(const int N, double *X, const int incX, double *Y, const int incY, const double c, const double  s);
void cblas_csrot(const int n, const void *x, const int incx, void *y, const int incY, const float c, const float s);
void cblas_zdrot(const int n, const void *x, const int incx, void *y, const int incY, const double c, const double s);

void cblas_srotg(float *a, float *b, float *c, float *s);
void cblas_drotg(double *a, double *b, double *c, double *s);
void cblas_crotg(void *a, void *b, float *c, void *s);
void cblas_zrotg(void *a, void *b, double *c, void *s);


void cblas_srotm(const int N, float *X, const int incX, float *Y, const int incY, const float *P);
void cblas_drotm(const int N, double *X, const int incX, double *Y, const int incY, const double *P);

void cblas_srotmg(float *d1, float *d2, float *b1, const float b2, float *P);
void cblas_drotmg(double *d1, double *d2, double *b1, const double b2, double *P);

void cblas_sscal(const int N, const float alpha, float *X, const int incX);
void cblas_dscal(const int N, const double alpha, double *X, const int incX);
void cblas_cscal(const int N, const void *alpha, void *X, const int incX);
void cblas_zscal(const int N, const void *alpha, void *X, const int incX);
void cblas_csscal(const int N, const float alpha, void *X, const int incX);
void cblas_zdscal(const int N, const double alpha, void *X, const int incX);

void cblas_sgemv(const enum CBLAS_ORDER order,  const enum CBLAS_TRANSPOSE trans,  const int m, const int n,
		 const float alpha, const float  *a, const int lda,  const float  *x, const int incx,  const float beta,  float  *y, const int incy);
void cblas_dgemv(const enum CBLAS_ORDER order,  const enum CBLAS_TRANSPOSE trans,  const int m, const int n,
		 const double alpha, const double  *a, const int lda,  const double  *x, const int incx,  const double beta,  double  *y, const int incy);
void cblas_cgemv(const enum CBLAS_ORDER order,  const enum CBLAS_TRANSPOSE trans,  const int m, const int n,
		 const void *alpha, const void  *a, const int lda,  const void  *x, const int incx,  const void *beta,  void  *y, const int incy);
void cblas_zgemv(const enum CBLAS_ORDER order,  const enum CBLAS_TRANSPOSE trans,  const int m, const int n,
		 const void *alpha, const void  *a, const int lda,  const void  *x, const int incx,  const void *beta,  void  *y, const int incy);

void cblas_sger (const enum CBLAS_ORDER order, const int M, const int N, const float   alpha, const float  *X, const int incX, const float  *Y, const int incY, float  *A, const int lda);
void cblas_dger (const enum CBLAS_ORDER order, const int M, const int N, const double  alpha, const double *X, const int incX, const double *Y, const int incY, double *A, const int lda);
void cblas_cgeru(const enum CBLAS_ORDER order, const int M, const int N, const void  *alpha, const void  *X, const int incX, const void  *Y, const int incY, void  *A, const int lda);
void cblas_cgerc(const enum CBLAS_ORDER order, const int M, const int N, const void  *alpha, const void  *X, const int incX, const void  *Y, const int incY, void  *A, const int lda);
void cblas_zgeru(const enum CBLAS_ORDER order, const int M, const int N, const void *alpha, const void *X, const int incX, const void *Y, const
```

### Core Architecture Module: `cpp/3rd_party/happly.h`
```
#pragma once

/* A header-only implementation of the .ply file format.
 * https://github.com/nmwsharp/happly
 * By Nicholas Sharp - nsharp@cs.cmu.edu
 *
 * Version 2, July 20, 2019
 */

/*
MIT License

Copyright (c) 2018 Nick Sharp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


// clang-format off
/*

 === Changelog ===

  Significant changes to the file recorded here.

  - Version 5 (Aug 22, 2020)      Minor: skip blank lines before properties in ASCII files
  - Version 4 (Sep 11, 2019)      Change internal list format to be flat. Other small perf fixes and cleanup.
  - Version 3 (Aug 1, 2019)       Add support for big endian and obj_info
  - Version 2 (July 20, 2019)     Catch exceptions by const reference.
  - Version 1 (undated)           Initial version. Unnamed changes before version numbering.

*/
// clang-format on

#include <array>
#include <cctype>
#include <fstream>
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <string>
#include <type_traits>
#include <vector>
#include <climits>

// General namespace wrapping all Happly things.
namespace happly {

// Enum specifying binary or ASCII filetypes. Binary can be little-endian
// (default) or big endian.
enum class DataFormat { ASCII, Binary, BinaryBigEndian };

// Type name strings
// clang-format off
template <typename T> std::string typeName()                { return "unknown"; }
template<> inline std::string typeName<int8_t>()            { return "char";    }
template<> inline std::string typeName<uint8_t>()           { return "uchar";   }
template<> inline std::string typeName<int16_t>()           { return "short";   }
template<> inline std::string typeName<uint16_t>()          { return "ushort";  }
template<> inline std::string typeName<int32_t>()           { return "int";     }
template<> inline std::string typeName<uint32_t>()          { return "uint";    }
template<> inline std::string typeName<float>()             { return "float";   }
template<> inline std::string typeName<double>()            { return "double";  }

// Template hackery that makes getProperty<T>() and friends pretty while automatically picking up smaller types
namespace {

// A pointer for the equivalent/smaller equivalent of a type (eg. when a double is requested a float works too, etc)
// long int is intentionally absent to avoid platform confusion
template <class T> struct TypeChain                 { bool hasChildType = false;   typedef T            type; };
template <> struct TypeChain<int64_t>               { bool hasChildType = true;    typedef int32_t      type; };
template <> struct TypeChain<int32_t>               { bool hasChildType = true;    typedef int16_t      type; };
template <> struct TypeChain<int16_t>               { bool hasChildType = true;    typedef int8_t       type; };
template <> struct TypeChain<uint64_t>              { bool hasChildType = true;    typedef uint32_t     type; };
template <> struct TypeChain<uint32_t>              { bool hasChildType = true;    typedef uint16_t     type; };
template <> struct TypeChain<uint16_t>              { bool hasChildType = true;    typedef uint8_t      type; };
template <> struct TypeChain<double>                { bool hasChildType = true;    typedef float        type; };

template <class T> struct CanonicalName                     { typedef T         type; };
template <> struct CanonicalName<char>                      { typedef int8_t    type; };
template <> struct CanonicalName<unsigned char>             { typedef uint8_t   type; };
template <> struct CanonicalName<size_t>                    { typedef std::conditional<std::is_same<std::make_signed<size_t>::type, int>::value, uint32_t, uint64_t>::type type; };

// Used to change behavior of >> for 8bit ints, which does not do what we want.
template <class T> struct SerializeType                 { typedef T         type; };
template <> struct SerializeType<uint8_t>               { typedef int32_t   type; };
template <> struct SerializeType< int8_t>               { typedef int32_t   type; };

// Give address only if types are same (used below when conditionally copying data)
// last int/char arg is to resolve ambiguous overloads, just always pass 0 and the int version will be preferred
template <typename S, typename T>
S* addressIfSame(T&, char) {
  throw std::runtime_error("tried to take address for types that are not same");
  return nullptr;}
template <typename S>
S* addressIfSame(S& t, int) {return &t;}

// clang-format on
} // namespace

/**
 * @brief A generic property, which is associated with some element. Can be plain Property or a ListProperty, of some
 * type.  Generally, the user should not need to interact with these directly, but they are exposed in case someone
 * wants to get clever.
 */
class Property {

public:
  /**
   * @brief Create a new Property with the given name.
   *
   * @param name_
   */
  Property(const std::string& name_) : name(name_){};
  virtual ~Property(){};

  std::string name;

  /**
   * @brief Reserve memory.
   *
   * @param capacity Expected number of elements.
   */
  virtual void reserve(size_t capacity) = 0;

  /**
   * @brief (ASCII reading) Parse out the next value of this property from a list of tokens.
   *
   * @param tokens The list of property tokens for the element.
   * @param currEntry Index in to tokens, updated after this property is read.
   */
  virtual void parseNext(const std::vector<std::string>& tokens, size_t& currEntry) = 0;

  /**
   * @brief (binary reading) Copy the next value of this property from a stream of bits.
   *
   * @param stream Stream to read from.
   */
  virtual void readNext(std::istream& stream) = 0;

  /**
   * @brief (binary reading) Copy the next value of this property from a stream of bits.
   *
   * @param stream Stream to read from.
   */
  virtual void readNextBigEndian(std::istream& stream) = 0;

  /**
   * @brief (reading) Write a header entry for this property.
   *
   * @param outStream Stream to write to.
   */
  virtual void writeHeader(std::ostream& outStream) = 0;

  /**
   * @brief (ASCII writing) write this property for some element to a stream in plaintext
   *
   * @param outStream Stream to write to.
   * @param iElement index of the element to write.
   */
  virtual void writeDataASCII(std::ostream& outStream, size_t iElement) = 0;

  /**
   * @brief (binary writing) copy the bits of this property for some element to a stream
   *
   * @param outStream Stream to write to.
   * @param iElement index of the element to write.
   */
  virtual void writeDataBinary(std::ostream& outStream, size_t iElement) = 0;

  /**
   * @brief (binary writing) copy the bits of this property for some element to a stream
   *
   * @param outStream Stream to write to.
   * @param iElement index of the element to write.
   */
  virtual void writeDataBinaryBigEndian(std::ostream& outStream, size_t iElement) = 0;

  /**
   * @brief Number of element entries for this property
   *
   * @return
   */
  virtual size_t size() = 0
```

### Core Architecture Module: `cpp/3rd_party/json/src.cpp`
```
/**
 * @file src.cpp
 * @brief the file here is used to include the boost json library and treat it as a single unit and header only library.
 * @note There should not be added any other code in this file.
 * @ref https://github.com/boostorg/json#header-only
 * @version 0.1
 * @date 2024-04-26
 * 
 * @copyright Copyright (c) 2024
 * 
 */

#include <boost/json/src.hpp>

```

### Core Architecture Module: `cpp/3rd_party/libtiff/libport.h`
```
/*
 * Copyright (c) 2009 Frank Warmerdam
 *
 * Permission to use, copy, modify, distribute, and sell this software and 
 * its documentation for any purpose is hereby granted without fee, provided
 * that (i) the above copyright notices and this permission notice appear in
 * all copies of the software and related documentation, and (ii) the names of
 * Sam Leffler and Silicon Graphics may not be used in any advertising or
 * publicity relating to the software without the specific, prior written
 * permission of Sam Leffler and Silicon Graphics.
 * 
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
 * 
 * IN NO EVENT SHALL SAM LEFFLER OR SILICON GRAPHICS BE LIABLE FOR
 * ANY SPECIAL, INCIDENTAL, INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND,
 * OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
 * WHETHER OR NOT ADVISED OF THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF
 * LIABILITY, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */

#ifndef _LIBPORT_
#define	_LIBPORT_

#if defined(HAVE_CONFIG_H)
#  include <tif_config.h>
#endif

int getopt(int argc, char * const argv[], const char *optstring);
extern   char *optarg;
extern   int opterr;
extern   int optind;
extern   int optopt;

int strcasecmp(const char *s1, const char *s2);

#endif /* ndef _LIBPORT_ */

```

### Core Architecture Module: `cpp/3rd_party/libtiff/mkspans.c`
```
/*
 * Copyright (c) 1991-1997 Sam Leffler
 * Copyright (c) 1991-1997 Silicon Graphics, Inc.
 *
 * Permission to use, copy, modify, distribute, and sell this software and
 * its documentation for any purpose is hereby granted without fee, provided
 * that (i) the above copyright notices and this permission notice appear in
 * all copies of the software and related documentation, and (ii) the names of
 * Sam Leffler and Silicon Graphics may not be used in any advertising or
 * publicity relating to the software without the specific, prior written
 * permission of Sam Leffler and Silicon Graphics.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 *
 * IN NO EVENT SHALL SAM LEFFLER OR SILICON GRAPHICS BE LIABLE FOR
 * ANY SPECIAL, INCIDENTAL, INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND,
 * OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
 * WHETHER OR NOT ADVISED OF THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF
 * LIABILITY, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */

#include <stdio.h>
#include <string.h>

/*
 * Hack program to construct tables used to find
 * runs of zeros and ones in Group 3 Fax encoding.
 */

dumparray(name, runs) char *name;
unsigned char runs[256];
{
    int i;
    char *sep;
    printf("static unsigned char %s[256] = {\n", name);
    sep = "    ";
    for (i = 0; i < 256; i++)
    {
        printf("%s%d", sep, runs[i]);
        if (((i + 1) % 16) == 0)
        {
            printf(",	/* 0x%02x - 0x%02x */\n", i - 15, i);
            sep = "    ";
        }
        else
            sep = ", ";
    }
    printf("\n};\n");
}

main()
{
    unsigned char runs[2][256];

    memset(runs[0], 0, 256 * sizeof(char));
    memset(runs[1], 0, 256 * sizeof(char));
    {
        register int run, runlen, i;
        runlen = 1;
        for (run = 0x80; run != 0xff; run = (run >> 1) | 0x80)
        {
            for (i = run - 1; i >= 0; i--)
            {
                runs[1][run | i] = runlen;
                runs[0][(~(run | i)) & 0xff] = runlen;
            }
            runlen++;
        }
        runs[1][0xff] = runs[0][0] = 8;
    }
    dumparray("bruns", runs[0]);
    dumparray("wruns", runs[1]);
}

```

### Core Architecture Module: `cpp/3rd_party/libtiff/snprintf.c`
```
/**
 * Workaround for lack of snprintf(3) in Visual Studio.  See
 * http://stackoverflow.com/questions/2915672/snprintf-and-visual-studio-2010/8712996#8712996
 * It's a trivial wrapper around the builtin _vsnprintf_s and
 * _vscprintf functions.
 */

#ifdef _MSC_VER

#include <stdio.h>
#include <stdarg.h>
#include "libport.h"

int _TIFF_vsnprintf_f(char* str, size_t size, const char* format, va_list ap)
{
  int count = -1;

  if (size != 0)
#if _MSC_VER <=	1310
    count = _vsnprintf(str, size, format, ap);
#else
    count = _vsnprintf_s(str, size, _TRUNCATE, format, ap);
#endif
  if (count == -1)
    count = _vscprintf(format, ap);

  return count;
}

int _TIFF_snprintf_f(char* str, size_t size, const char* format, ...)
{
  int count;
  va_list ap;

  va_start(ap, format);
  count = vsnprintf(str, size, format, ap);
  va_end(ap);

  return count;
}

#endif // _MSC_VER

```

### Core Architecture Module: `cpp/3rd_party/libtiff/t4.h`
```
/*
 * Copyright (c) 1988-1997 Sam Leffler
 * Copyright (c) 1991-1997 Silicon Graphics, Inc.
 *
 * Permission to use, copy, modify, distribute, and sell this software and
 * its documentation for any purpose is hereby granted without fee, provided
 * that (i) the above copyright notices and this permission notice appear in
 * all copies of the software and related documentation, and (ii) the names of
 * Sam Leffler and Silicon Graphics may not be used in any advertising or
 * publicity relating to the software without the specific, prior written
 * permission of Sam Leffler and Silicon Graphics.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 *
 * IN NO EVENT SHALL SAM LEFFLER OR SILICON GRAPHICS BE LIABLE FOR
 * ANY SPECIAL, INCIDENTAL, INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND,
 * OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
 * WHETHER OR NOT ADVISED OF THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF
 * LIABILITY, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */

#ifndef _T4_
#define _T4_
/*
 * CCITT T.4 1D Huffman runlength codes and
 * related definitions.  Given the small sizes
 * of these tables it does not seem
 * worthwhile to make code & length 8 bits.
 */
typedef struct tableentry
{
    unsigned short length; /* bit length of g3 code */
    unsigned short code;   /* g3 code */
    short runlen;          /* run length in bits */
} tableentry;

#define EOL 0x001 /* EOL code value - 0000 0000 0000 1 */

/* status values returned instead of a run length */
#define G3CODE_EOL -1     /* NB: ACT_EOL - ACT_WRUNT */
#define G3CODE_INVALID -2 /* NB: ACT_INVALID - ACT_WRUNT */
#define G3CODE_EOF -3     /* end of input data */
#define G3CODE_INCOMP -4  /* incomplete run code */

/*
 * Note that these tables are ordered such that the
 * index into the table is known to be either the
 * run length, or (run length / 64) + a fixed offset.
 *
 * NB: The G3CODE_INVALID entries are only used
 *     during state generation (see mkg3states.c).
 */
#ifdef G3CODES
const tableentry TIFFFaxWhiteCodes[] = {
    {8, 0x35, 0},              /* 0011 0101 */
    {6, 0x7, 1},               /* 0001 11 */
    {4, 0x7, 2},               /* 0111 */
    {4, 0x8, 3},               /* 1000 */
    {4, 0xB, 4},               /* 1011 */
    {4, 0xC, 5},               /* 1100 */
    {4, 0xE, 6},               /* 1110 */
    {4, 0xF, 7},               /* 1111 */
    {5, 0x13, 8},              /* 1001 1 */
    {5, 0x14, 9},              /* 1010 0 */
    {5, 0x7, 10},              /* 0011 1 */
    {5, 0x8, 11},              /* 0100 0 */
    {6, 0x8, 12},              /* 0010 00 */
    {6, 0x3, 13},              /* 0000 11 */
    {6, 0x34, 14},             /* 1101 00 */
    {6, 0x35, 15},             /* 1101 01 */
    {6, 0x2A, 16},             /* 1010 10 */
    {6, 0x2B, 17},             /* 1010 11 */
    {7, 0x27, 18},             /* 0100 111 */
    {7, 0xC, 19},              /* 0001 100 */
    {7, 0x8, 20},              /* 0001 000 */
    {7, 0x17, 21},             /* 0010 111 */
    {7, 0x3, 22},              /* 0000 011 */
    {7, 0x4, 23},              /* 0000 100 */
    {7, 0x28, 24},             /* 0101 000 */
    {7, 0x2B, 25},             /* 0101 011 */
    {7, 0x13, 26},             /* 0010 011 */
    {7, 0x24, 27},             /* 0100 100 */
    {7, 0x18, 28},             /* 0011 000 */
    {8, 0x2, 29},              /* 0000 0010 */
    {8, 0x3, 30},              /* 0000 0011 */
    {8, 0x1A, 31},             /* 0001 1010 */
    {8, 0x1B, 32},             /* 0001 1011 */
    {8, 0x12, 33},             /* 0001 0010 */
    {8, 0x13, 34},             /* 0001 0011 */
    {8, 0x14, 35},             /* 0001 0100 */
    {8, 0x15, 36},             /* 0001 0101 */
    {8, 0x16, 37},             /* 0001 0110 */
    {8, 0x17, 38},             /* 0001 0111 */
    {8, 0x28, 39},             /* 0010 1000 */
    {8, 0x29, 40},             /* 0010 1001 */
    {8, 0x2A, 41},             /* 0010 1010 */
    {8, 0x2B, 42},             /* 0010 1011 */
    {8, 0x2C, 43},             /* 0010 1100 */
    {8, 0x2D, 44},             /* 0010 1101 */
    {8, 0x4, 45},              /* 0000 0100 */
    {8, 0x5, 46},              /* 0000 0101 */
    {8, 0xA, 47},              /* 0000 1010 */
    {8, 0xB, 48},              /* 0000 1011 */
    {8, 0x52, 49},             /* 0101 0010 */
    {8, 0x53, 50},             /* 0101 0011 */
    {8, 0x54, 51},             /* 0101 0100 */
    {8, 0x55, 52},             /* 0101 0101 */
    {8, 0x24, 53},             /* 0010 0100 */
    {8, 0x25, 54},             /* 0010 0101 */
    {8, 0x58, 55},             /* 0101 1000 */
    {8, 0x59, 56},             /* 0101 1001 */
    {8, 0x5A, 57},             /* 0101 1010 */
    {8, 0x5B, 58},             /* 0101 1011 */
    {8, 0x4A, 59},             /* 0100 1010 */
    {8, 0x4B, 60},             /* 0100 1011 */
    {8, 0x32, 61},             /* 0011 0010 */
    {8, 0x33, 62},             /* 0011 0011 */
    {8, 0x34, 63},             /* 0011 0100 */
    {5, 0x1B, 64},             /* 1101 1 */
    {5, 0x12, 128},            /* 1001 0 */
    {6, 0x17, 192},            /* 0101 11 */
    {7, 0x37, 256},            /* 0110 111 */
    {8, 0x36, 320},            /* 0011 0110 */
    {8, 0x37, 384},            /* 0011 0111 */
    {8, 0x64, 448},            /* 0110 0100 */
    {8, 0x65, 512},            /* 0110 0101 */
    {8, 0x68, 576},            /* 0110 1000 */
    {8, 0x67, 640},            /* 0110 0111 */
    {9, 0xCC, 704},            /* 0110 0110 0 */
    {9, 0xCD, 768},            /* 0110 0110 1 */
    {9, 0xD2, 832},            /* 0110 1001 0 */
    {9, 0xD3, 896},            /* 0110 1001 1 */
    {9, 0xD4, 960},            /* 0110 1010 0 */
    {9, 0xD5, 1024},           /* 0110 1010 1 */
    {9, 0xD6, 1088},           /* 0110 1011 0 */
    {9, 0xD7, 1152},           /* 0110 1011 1 */
    {9, 0xD8, 1216},           /* 0110 1100 0 */
    {9, 0xD9, 1280},           /* 0110 1100 1 */
    {9, 0xDA, 1344},           /* 0110 1101 0 */
    {9, 0xDB, 1408},           /* 0110 1101 1 */
    {9, 0x98, 1472},           /* 0100 1100 0 */
    {9, 0x99, 1536},           /* 0100 1100 1 */
    {9, 0x9A, 1600},           /* 0100 1101 0 */
    {6, 0x18, 1664},           /* 0110 00 */
    {9, 0x9B, 1728},           /* 0100 1101 1 */
    {11, 0x8, 1792},           /* 0000 0001 000 */
    {11, 0xC, 1856},           /* 0000 0001 100 */
    {11, 0xD, 1920},           /* 0000 0001 101 */
    {12, 0x12, 1984},          /* 0000 0001 0010 */
    {12, 0x13, 2048},          /* 0000 0001 0011 */
    {12, 0x14, 2112},          /* 0000 0001 0100 */
    {12, 0x15, 2176},          /* 0000 0001 0101 */
    {12, 0x16, 2240},          /* 0000 0001 0110 */
    {12, 0x17, 2304},          /* 0000 0001 0111 */
    {12, 0x1C, 2368},          /* 0000 0001 1100 */
    {12, 0x1D, 2432},          /* 0000 0001 1101 */
    {12, 0x1E, 2496},          /* 0000 0001 1110 */
    {12, 0x1F, 2560},          /* 0000 0001 1111 */
    {12, 0x1, G3CODE_EOL},     /* 0000 0000 0001 */
    {9, 0x1, G3CODE_INVALID},  /* 0000 0000 1 */
    {10, 0x1, G3CODE_INVALID}, /* 0000 0000 01 */
    {11, 0x1, G3CODE_INVALID}, /* 0000 0000 001 */
    {12, 0x0, G3CODE_INVALID}, /* 0000 0000 0000 */
};

const tableentry TIFFFaxBlackCodes[] = {
    {10, 0x37, 0},             /* 0000 1101 11 */
    {3, 0x2, 1},               /* 010 */
    {2, 0x3, 2},               /* 11 */
    {2, 0x2, 3},               /* 10 */
    {3, 0x3, 4},               /* 011 */
    {4, 0x3, 5},               /* 0011 */
    {4, 0x2, 6},               /* 0010 */
    {5, 0x3, 7},               /* 0001 1 */
    {6, 0x5, 8},               /* 0001 01 */
    {6, 0x4, 9},               /* 0001 00 */
    {7, 0x4, 10},              /* 0000 100 */
    {7, 0x5, 11},              /* 0000 101 */
    {7, 0x7, 12},    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3159** (2026-08-08): **[BUG] 1 % (0 % 2) evaluates to NaN, but should raise an exception when actingas a filter.**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  The filter "1 % (0 % 2)" evaluates to NaN, which may lead to incorrect data being returned, for example when evaluating "not (NaN > 0)".  ### Steps to Reproduce  run the following code  ```python import deeplake import numpy as np  ds = deeplake.create("mem://mod_zero_test")  ds.add_column("x", dtype="int64") ds.add_column("y", dtype="int64")  ds.append({     "x": np.array([1, 2, 5, 10, -3, 100], dtype=np.int64),     "y": np.array([1, 2, 3, 5, -7, 100], dtype=np.int64), })   res = ds.query(""" SELECT * where not (1 % (0 % 2) >0) """)   print(res) print("len =", len(res)) ```  ### Expected/Desired Behavior  The query with this filter should raise an exception, or be evaluated such that there are not any data returned.  ### Python Version  3.10  ### OS  Ubunto 22.04  ### IDE  _No response_  ### Packages  _No response_  ### Additional Context  _No response_  ### Possible Solution  _No response_  ### Are you willing to submit a PR?  - [ ] I'm willing to submit a PR (Thank you!)
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju, thanks for reporting this. We reproduced the issue. It will be fixed in the next version.
  > Thanks for confirming the repro.  I looked at landing an outsider fix: the public tree exposes `nd::percent` / binary-op types and the generic `create_binary_kernel` templates, but the actual arithmetic op wiring (and any zero-divisor handling) does not appear to be in the open sources — Python goes through compiled `_deeplake.tql`. Happy to revisit if that evaluator code is opened or if there is a preferred public hook for a guard. 

- **Issue #3149** (2026-08-13): **[BUG] deeplake 4.5.10 raises Dtype is unknown error for int * JSON, but not for JSON * JSON**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  Deeplake raises Dtype is unknown error for filter = """(-21877) >= (-1093 * f6['e3'])""".    ### Steps to Reproduce  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np   # create dataset path = "mem://test_collection" try: deeplake_lib.delete(path) except: pass ds = deeplake_lib.create(path)  # create schema ds.add_column("f0", dl_types.Int64()) ds.add_column("f1", dl_types.Array("float32", 1)) ds.add_column("f2", dl_types.Float32()) ds.add_column("f3", dl_types.Float32()) ds.add_column("f4", dl_types.Dict()) ds.add_column("f5", dl_types.Embedding(48, dtype='float32')) ds.add_column("f6", dl_types.Dict()) ds.add_column("f7", dl_types.Text()) ds.add_column("f8", dl_types.Embedding(46, dtype='float32'))  # define data data_list = [...]  # insert data pkey_name = 'f0' pk_to_idx = {} if pkey_name is not None and len(ds) > 0:     col = ds[pkey_name]     for i, v in enumerate(col):         pk_to_idx[v.item()] = i for data in data_list:     pk = data.get(pkey_name) if pkey_name is not None else None     idx = pk_to_idx.get(pk) if pk is not None else None     if idx is None:         row = {k: [v] for k, v in data.items()}         ds.append(row)         if pk is not None:             pk_to_idx[pk] = len(ds) - 1     else:         for field, v in data.items():             if field in ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']:                 ds[field][idx] = v
  **Post-Mortem & Fix Analysis**:
  > Further test shows that in some cases, int * json_ref may raise dtype unknown, but 0 * json_ref can be executed successfully
  > Hey @zhuang-keju this will be fixed in the next release. Thanks.

- **Issue #3148** (2026-03-19): **[BUG] deeplake v4.5.8 returns empty set for the same query executed after deleting some data**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Deeplake returns an empty set for the second query during the process described in `Expected Behavior`.  ### Steps to Reproduce  run the following code:  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np  # create dataset path = "mem://test_collection" try: deeplake_lib.delete(path) except: pass ds = deeplake_lib.create(path) ds.add_column("f0", dl_types.Int64()) ds.add_column("f1", dl_types.Float32()) ds.add_column("f2", dl_types.Dict()) ds.add_column("f3", dl_types.Int64()) ds.add_column("f4", dl_types.Int64()) ds.add_column("f5", dl_types.Array("bool", 1)) ds.add_column("f6", dl_types.Int64()) ds.add_column("f7", dl_types.Embedding(18, dtype='float32')) ds.add_column("f8", dl_types.Embedding(27, dtype='float32'))  # define data data_list = [     {'f0': 184525, 'f1': 0.05727, 'f2': {'e4': 408011, 'e1': False, 'e2': 0.54802, 'e7': [True, False, True, True, True, False, False, True, True, True, True, False, True, True, True, False, True, False, True, False, True, False, True, True], 'e0': False, 'e3': -361971, 'e6': 0.53503, 'e5': 0}, 'f3': 276415, 'f4': -148744, 'f5': [False], 'f6': 447046, 'f7': [0.86464, 0.25095, 0.89024, 0.92408, 0.14763, 0.95403, 0.1856, 0.31301, 0.69142, 0.61442, 0.04938, 0.35445, 0.39817, 0.44258, 0.83449, 0.69825, 0.71656, 0.19852], 'f8': [0.20354, 0.52984, 0.34126, 0.41081, 0.32072, 0.36992, 0.60845, 0.9979, 0.2

- **Issue #3147** (2026-03-19): **[BUG] deeplake v4.5.6 raises 'deeplake._deeplake.InvalidType: Dtype is unknown.' for filter ((-104454 * f3[12]) != 0), but no error for ((f3[12] * -104454) != 0)**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  Deeplake raises a Dtype is unknown exception  ### Steps to Reproduce  run the following code to reproduce the error.  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np  # create dataset path = "mem://test_collection" try:     deeplake_lib.delete(path) except:     pass ds = deeplake_lib.create(path)  # define schema ds.add_column("f0", dl_types.Text()) ds.add_column("f1", dl_types.Dict()) ds.add_column("f2", dl_types.Text()) ds.add_column("f3", dl_types.Array("int64", 1)) ds.add_column("f4", dl_types.Float32()) ds.add_column("f5", dl_types.Bool()) ds.add_column("f6", dl_types.Embedding(34, dtype='float32')) ds.add_column("f7", dl_types.Embedding(86, dtype='float32'))  # define data data_list = [     {'f0': '', 'f1': {'e1': -376707, 'e4': 0, 'e5': False, 'e6': False, 'e3': [0.16164, 0, -0.58172, 0.84732, -0.80616, -0.55324, -0.85403, 0.63764, 0, -0.59601, 0, -0.55499, -0.06859], 'e2': -0.54477}, 'f2': '+O2*M=', 'f3': [0, 0, 144740, 0, 0, 376007, 0, 433928, -82129, 3154, 238297, -168037], 'f4': 0, 'f5': True, 'f6': [0.42573, 0.79153, 0.6364, 0.19344, 0.55068, 0.39151, 0.09344, 0.82567, 0.06643, 0.45215, 0.94213, 0.54453, 0.20783, 0.44767, 0.55159, 0.39835, 0.38987, 0.12159, 0.02728, 0.32253, 0.70929, 0.55861, 0.98812, 0.93794, 0.45273, 0.52077, 0.12324, 0.43113, 0.21398, 0.54107, 0.88514, 0.89577, 0.8699, 0.64384], 'f7': [0.02376, 0.45177, 0.3607, 0.07637, 0.9763,
  **Post-Mortem & Fix Analysis**:
  > This behavior happens for other arithmetic operators that involve multiplication/division, like division, modulus

- **Issue #3146** (2026-03-19): **[BUG] deeplake v4.5.6 returns inconsistent query results after delete() when dataset contains Zero Vectors (NaN poisoning breaks ORDER BY)**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  The metamorphic relation described in `Expected Behavior` is violated. After deleting the 50 entries, the second query returns a significantly different set of documents. Specifically, the second query returns unexpected "extra" IDs that were never in the top 100 of the initial query, and expected IDs that were NOT deleted are inexplicably missing from the new top 50 results.   ### Steps to Reproduce  run the following code to reproduce the unexpected behavior. [deeplake_bug_trigger.py.txt](https://github.com/user-attachments/files/26042033/deeplake_bug_trigger.py.txt) Below is a sample of the program  ```python  import deeplake as deeplake_lib import numpy as np from deeplake import types as dl_types  data_list = [...] # contains zero vectors.  def test_zero_vector_consistency():      # Create dataset in memory     collection_name = "zero_vec_test"     path = f"mem://{collection_name}"     try:         deeplake_lib.delete(path)     except Exception:         pass     ds = deeplake_lib.create(path)     ds.add_column("id", dl_types.Text())     ds.add_column("embedding", dl_types.Embedding(128, dtype="float32"))     ds.add_column("f1", dl_types.Int64())           # define data     num_samples = 500     num_zero_vectors = 50         zero_vector_positions = {0, 131, 4, 397, 270, 272, 145, 274, 147, 280, 25, 30, 287, 417, 418, 38, 296, 426, 300, 174, 304, 177, 306, 54, 60, 317, 446, 447, 321,
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju  thanks for the detailed report. We fixed the issue in `deeplake==4.5.8`. Waiting for your confirmation that it's fixed. Feel free to drop more issues if you find any. Thanks!
  > Fixed, thank you! The latest implementation does not include zero vectors and is strictly sorted. Closing this issue.

- **Issue #3145** (2026-03-17): **[BUG] deeplake v4.5.6 produces a segmentation fault with WHERE (NOT ((f9['e1'] IS NOT NULL)))**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Deeplake produces a segmentation fault when queried with the clause WHERE (NOT ((f9['e1'] IS NOT NULL))).  ### Steps to Reproduce  The following testcase produces this error: [deeplake_bug_trigger.py.txt](https://github.com/user-attachments/files/25963263/deeplake_bug_trigger.py.txt). The sample logic of the code is shown below.  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np import faulthandler  faulthandler.enable()  # create collection, reset old collections if any path = "mem://test_collection" try:     deeplake_lib.delete(path) except:     pass ds = deeplake_lib.create(path)   # define schema ds.add_column("f0", dl_types.Bool()) ds.add_column("f1", dl_types.Int64()) ds.add_column("f2", dl_types.Embedding(35, dtype='float32')) ds.add_column("f3", dl_types.Text()) ds.add_column("f4", dl_types.Float32()) ds.add_column("f5", dl_types.Dict()) ds.add_column("f6", dl_types.Array("float32", 1)) ds.add_column("f7", dl_types.Text()) ds.add_column("f8", dl_types.Dict()) ds.add_column("f9", dl_types.Dict()) ds.add_column("f10", dl_types.Embedding(95, dtype='float32'))  # the data to be inserted data_list = [ ... ]  # insert data pkey_name = 'f7' pk_to_idx = {} if pkey_name is not None and len(ds) > 0:     col = ds[pkey_name].numpy().flatten()     for i, v in enumerate(col):         pk_to_idx[v] = i for data in data_list:     pk = data.get(pk
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju  thanks for the detailed report. We fixed the issue in `deeplake==4.5.8`. Waiting for your confirmation that it's fixed. Feel free to drop more issues if you find any. Thanks!
  > Fixed, thank you!

- **Issue #3097** (2026-01-28): **[BUG] Deeplake 4.x: S3 connectivity timeout when accessing hub://activeloop datasets**
  *Symptoms*: ### Severity  P1 - Urgent, but non-breaking  ### Current Behavior  # Deeplake 4.x: S3 connectivity timeout when accessing hub://activeloop datasets  ## Summary  Deeplake 4.x fails to connect to Activeloop-hosted datasets (e.g., `hub://activeloop/ffhq`) with S3 timeout errors, while the same network environment works perfectly with deeplake 3.x and direct HTTP/curl requests.  ## Environment  - **Deeplake version**: 4.4.4 (fails) vs 3.9.52 (works) - **Python version**: 3.13.9 - **OS**: Linux (Ubuntu-based HPC cluster) - **Installation method**: pip via uv  ## Actual Behavior  With deeplake 4.4.4:  ``` [S3] Failed to get bucket region for URL: snark-hub/protected/activeloop/ffhq/  with error: [S3] Network connection error:  snark-hub curlCode: 28, Timeout was reached  deeplake._deeplake.LogNotexistsError: Dataset does not exist at path 'hub://activeloop/ffhq/' ```  ## Network Diagnostics  I performed extensive network diagnostics to confirm the network is functioning properly:  ### DNS Resolution ✅ ``` snark-hub.s3.amazonaws.com → 52.217.173.177 (resolves correctly) s3.amazonaws.com → 52.216.221.208 (resolves correctly) ```  ### HTTP Connectivity ✅ ```bash curl -s -o /dev/null -w "%{http_code}" https://snark-hub.s3.amazonaws.com # Returns: 403 (expected for unauthenticated access) # Response time: 0.15s connect, 0.52s total ```  ### Port Connectivity ✅ ``` s3.amazonaws.com:443 - connected successfully s3.amazonaws.com:80 - connected successfully ```  ### Direct S3 Access ✅ All S
  **Post-Mortem & Fix Analysis**:
  > Hey @ScarWar, To open v3 datasets in v4, you can use deeplake.query(f'SELECT * FROM "{v3_dataset_path}") Better option is to convert v3 format to v4 using deeplake.convert, then open as regular v4 dataset.  More information here - https://docs.deeplake.ai/latest/guide/v3-conversion/#option-1-automatic-migration-recommended.  Please let me know if this works.
  > Confirmed the issue is fixed on v4 dataset - `hub://activeloop/ffhq-v4`  Closing the issue.

- **Issue #3076** (2025-09-08): **[BUG] Deeplake v4.3.1 canoot open hub dataset**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Hi, I am new to deeplake. I want to open coco dataset through al hub. ```python ds = deeplake.open_read_only("hub://activeloop/coco-train",token=TOKEN) ``` but I got the error  ```bash --------------------------------------------------------------------------- LogNotexistsError                         Traceback (most recent call last) Cell In[14], [line 3](vscode-notebook-cell:?execution_count=14&line=3)       1 import deeplake       2 TOKEN = "***" ----> [3](vscode-notebook-cell:?execution_count=14&line=3) ds = deeplake.open_read_only("hub://activeloop/coco-train",token=TOKEN)  LogNotexistsError: Dataset does not exist at path 'hub://activeloop/coco-train/' ```  I try to use deeplake==3.0.0, the old version API can correctly access to the data. ```python  python Python 3.11.13 | packaged by conda-forge | (main, Jun  4 2025, 14:48:23) [GCC 13.3.0] on linux Type "help", "copyright", "credits" or "license" for more information. Ctrl click to launch VS Code Native REPL >>> import deeplake /opt/conda/lib/python3.11/site-packages/deeplake/util/check_latest_version.py:32: UserWarning: A newer version of deeplake (4.3.1) is available. It's recommended that you update to the latest version using `pip install -U deeplake`.   warnings.warn( >>> ds = deeplake.load("hub://activeloop/coco-train",token="***") hub://activeloop/coco-train loaded successfully. /opt/conda/lib/python3.11/site-packages/dee
  **Post-Mortem & Fix Analysis**:
  > hi @WendellZ524, you can not open V3 datasets from V4 API with open but you can get read_only view with this API   ``` import deeplake TOKEN = "***" ds = deeplake.query('SELECT * from "hub://activeloop/coco-train",' token=TOKEN) ```

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

### Incident Patch 1: `88f9819c` (2026-02-15)
**Commit Message**: Merge pull request #3141 from activeloopai/fix/remove-serverless-from-dockerfile

Fix/remove serverless from dockerfile

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +2/-0)
```diff
@@ -265,6 +265,8 @@ void save_index_metadata(Oid oid)
     if (SPI_execute(buf.data, false, 0) != SPI_OK_INSERT) {
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
+
+    // Cross-instance propagation is driven by DDL WAL logging in ProcessUtility.
 }
 
 void load_index_metadata()
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +54/-4)
```diff
@@ -46,6 +46,7 @@ extern "C" {
 #include <icm/json.hpp>
 #include <icm/string_map.hpp>
 #include <nd/none.hpp>
+#include <unordered_set>
 
 #include <algorithm>
 #include <vector>
@@ -287,34 +288,84 @@ void table_storage::load_table_metadata()
                     continue;
                 }
 
+                // Snapshot tables_ keys so we can roll back C++ state on failure
+                std::vector<Oid> tables_before;
+                tables_before.reserve(tables_.size());
+                for (const auto& [oid, _] : tables_) {
+                    tables_before.push_back(oid);
+                }
+
                 MemoryContext saved_context = CurrentMemoryContext;
                 ResourceOwner saved_owner = CurrentResourceOwner;
                 BeginInternalSubTransaction(nullptr);
                 PG_TRY();
                 {
                     set_catalog_only_create(true);
-                    pg::utils::spi_connector connector;
+                    SPI_connect();
                     bool pushed_snapshot = false;
                     if (!ActiveSnapshotSet()) {
                         PushActiveSnapshot(GetTransactionSnapshot());
                         pushed_snapshot = true;
                     }
+                    // Restore the original search_path so unqualified names resolve correctly
+                    std::string saved_search_path;
+                    if (!entry.search_path.empty()) {
+                        const char* current_sp = GetConfigOption("search_path", true, false);
+                        if (current_sp != nullptr) {
+                            saved_search_path = current_sp;
+                        }
+                        StringInfoData sp_sql;
+                        initStringInfo(&sp_sql);
+                        appendStringInfo(&sp_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(entry.search_path.c_str()));
+                        SPI_execute(sp_sql.data, true, 0);
+                        pfree(sp_sql.data);
+                    }
                     SPI_execute(entry.ddl_sql.c_str(), false, 0);
+                    // Restore the session's original search_path
+                    if (!entry.search_path.empty()) {
+                        StringInfoData restore_sql;
+                        initStringInfo(&restore_sql);
+                        appendStringInfo(&restore_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(saved_search_path.c_str()));
+                        SPI_execute(restore_sql.data, true, 0);
+                        pfree(restore_sql.data);
+                    }
                     if (pushed_snapshot) {
                         PopActiveSnapshot();
                     }
+                    SPI_finish();
                     set_catalog_only_create(false);
                     ReleaseCurrentSubTransaction();
                 }
                 PG_CATCH();
                 {
                     set_catalog_only_create(false);
                     MemoryContextSwitchTo(saved_context);
+                    ErrorData* edata = CopyErrorData();
                     CurrentResourceOwner = saved_owner;
                     RollbackAndReleaseCurrentSubTransaction();
                     FlushErrorState();
-                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %.200s",
-                         entry.seq, entry.command_tag.c_str(), entry.ddl_sql.c_str());
+
+                    // Remove any tables_ entries added during the failed replay,
+                    // since the subtransaction rollback undid the catalog changes
+                    // but the C++ map entries persist.
+                    std::unordered_set<Oid> before_set(tables_before.begin(), tables_before.end());
+           
```

**File**: `postgres/Dockerfile` (modified, +0/-15)
```diff
@@ -1,7 +1,6 @@
 FROM BASE_IMAGE
 ARG VERSION=VERSION
 ARG TARGETARCH
-ARG STATELESS=false
 
 LABEL name="pg-deeplake" \
   version="${VERSION}" \
@@ -29,18 +28,4 @@ COPY ./debs/ /tmp/debs/
 COPY --chmod=444 ./LICENSE /LICENSE
 COPY ./postgres/docker-entrypoint.d/ /docker-entrypoint-initdb.d/
 RUN apt-get install --no-install-recommends -y /tmp/debs/pg-deeplake-${VERSION}_${TARGETARCH}.deb && rm -rf /tmp/debs/
-COPY ./serverless/scripts/init-deeplake-stateless.sh /tmp/init-deeplake-stateless.sh
-COPY ./serverless/config/postgresql-overrides.conf /tmp/postgresql-overrides.conf
-COPY ./serverless/scripts/health-check.sh /tmp/health-check.sh
-RUN if [ "$STATELESS" = "true" ]; then \
-      mv /tmp/init-deeplake-stateless.sh /docker-entrypoint-initdb.d/3-stateless-init.sh && \
-      chmod 755 /docker-entrypoint-initdb.d/3-stateless-init.sh && \
-      mv /tmp/postgresql-overrides.conf /etc/postgresql-overrides.conf && \
-      chmod 644 /etc/postgresql-overrides.conf && \
-      mv /tmp/health-check.sh /usr/local/bin/health-check.sh && \
-      chmod 755 /usr/local/bin/health-check.sh && \
-      mkdir -p /deeplake-data; \
-    else \
-      rm -f /tmp/init-deeplake-stateless.sh /tmp/postgresql-overrides.conf /tmp/health-check.sh; \
-    fi
 USER 999
```

---

### Incident Patch 2: `c6cf643d` (2026-02-15)
**Commit Message**: Fix SPI stack leak, error logging, and search_path during DDL WAL replay

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +2/-0)
```diff
@@ -265,6 +265,8 @@ void save_index_metadata(Oid oid)
     if (SPI_execute(buf.data, false, 0) != SPI_OK_INSERT) {
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
+
+    // Cross-instance propagation is driven by DDL WAL logging in ProcessUtility.
 }
 
 void load_index_metadata()
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +54/-4)
```diff
@@ -46,6 +46,7 @@ extern "C" {
 #include <icm/json.hpp>
 #include <icm/string_map.hpp>
 #include <nd/none.hpp>
+#include <unordered_set>
 
 #include <algorithm>
 #include <vector>
@@ -287,34 +288,84 @@ void table_storage::load_table_metadata()
                     continue;
                 }
 
+                // Snapshot tables_ keys so we can roll back C++ state on failure
+                std::vector<Oid> tables_before;
+                tables_before.reserve(tables_.size());
+                for (const auto& [oid, _] : tables_) {
+                    tables_before.push_back(oid);
+                }
+
                 MemoryContext saved_context = CurrentMemoryContext;
                 ResourceOwner saved_owner = CurrentResourceOwner;
                 BeginInternalSubTransaction(nullptr);
                 PG_TRY();
                 {
                     set_catalog_only_create(true);
-                    pg::utils::spi_connector connector;
+                    SPI_connect();
                     bool pushed_snapshot = false;
                     if (!ActiveSnapshotSet()) {
                         PushActiveSnapshot(GetTransactionSnapshot());
                         pushed_snapshot = true;
                     }
+                    // Restore the original search_path so unqualified names resolve correctly
+                    std::string saved_search_path;
+                    if (!entry.search_path.empty()) {
+                        const char* current_sp = GetConfigOption("search_path", true, false);
+                        if (current_sp != nullptr) {
+                            saved_search_path = current_sp;
+                        }
+                        StringInfoData sp_sql;
+                        initStringInfo(&sp_sql);
+                        appendStringInfo(&sp_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(entry.search_path.c_str()));
+                        SPI_execute(sp_sql.data, true, 0);
+                        pfree(sp_sql.data);
+                    }
                     SPI_execute(entry.ddl_sql.c_str(), false, 0);
+                    // Restore the session's original search_path
+                    if (!entry.search_path.empty()) {
+                        StringInfoData restore_sql;
+                        initStringInfo(&restore_sql);
+                        appendStringInfo(&restore_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(saved_search_path.c_str()));
+                        SPI_execute(restore_sql.data, true, 0);
+                        pfree(restore_sql.data);
+                    }
                     if (pushed_snapshot) {
                         PopActiveSnapshot();
                     }
+                    SPI_finish();
                     set_catalog_only_create(false);
                     ReleaseCurrentSubTransaction();
                 }
                 PG_CATCH();
                 {
                     set_catalog_only_create(false);
                     MemoryContextSwitchTo(saved_context);
+                    ErrorData* edata = CopyErrorData();
                     CurrentResourceOwner = saved_owner;
                     RollbackAndReleaseCurrentSubTransaction();
                     FlushErrorState();
-                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %.200s",
-                         entry.seq, entry.command_tag.c_str(), entry.ddl_sql.c_str());
+
+                    // Remove any tables_ entries added during the failed replay,
+                    // since the subtransaction rollback undid the catalog changes
+                    // but the C++ map entries persist.
+                    std::unordered_set<Oid> before_set(tables_before.begin(), tables_before.end());
+           
```

---

### Incident Patch 3: `72bf8691` (2026-02-13)
**Commit Message**: Fixed tests.

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +4/-2)
```diff
@@ -265,8 +265,10 @@ void save_index_metadata(Oid oid)
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
 
-    // Persist index to shared catalog for stateless multi-instance sync
-    if (pg::stateless_enabled) {
+    // Persist index to shared catalog for stateless multi-instance sync.
+    // Skip when in catalog-only mode — the table was synced FROM the catalog,
+    // so writing back would be redundant and cause version bump loops.
+    if (pg::stateless_enabled && !pg::table_storage::is_catalog_only_create()) {
         try {
             auto root_dir = pg::session_credentials::get_root_path();
             if (root_dir.empty()) {
```

**File**: `postgres/tests/py_tests/test_drop_table_column.py` (modified, +5/-5)
```diff
@@ -25,7 +25,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
     try:
         # Create table with multiple columns
         await db_conn.execute("""
-            CREATE TABLE vectors (
+            CREATE TABLE drop_col_vectors (
                 id SERIAL PRIMARY KEY,
                 v1 float4[],
                 v2 float4[]
@@ -34,7 +34,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
 
         # Create index on v2 (not v1)
         await db_conn.execute("""
-            CREATE INDEX index_for_v2 ON vectors USING deeplake_index (v2 DESC)
+            CREATE INDEX index_for_v2 ON drop_col_vectors USING deeplake_index (v2 DESC)
         """)
 
         # Verify index exists in pg_class
@@ -60,7 +60,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
             f"Dataset directory '{dataset_path}' should exist before DROP COLUMN"
 
         # DROP non-indexed column (v1) - index should remain
-        await db_conn.execute("ALTER TABLE vectors DROP COLUMN v1")
+        await db_conn.execute("ALTER TABLE drop_col_vectors DROP COLUMN v1")
 
         # Verify index still exists after dropping non-indexed column
         await assertions.assert_query_row_count(
@@ -83,7 +83,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
             f"Dataset directory '{dataset_path_after_v1}' should exist after dropping non-indexed column"
 
         # DROP indexed column (v2) - index should be removed
-        await db_conn.execute("ALTER TABLE vectors DROP COLUMN v2")
+        await db_conn.execute("ALTER TABLE drop_col_vectors DROP COLUMN v2")
 
         # Verify index removed from pg_class
         await assertions.assert_query_row_count(
@@ -108,4 +108,4 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
     finally:
         # Cleanup (in case test fails)
         await db_conn.execute("DROP INDEX IF EXISTS index_for_v2 CASCADE")
-        await db_conn.execute("DROP TABLE IF EXISTS vectors CASCADE")
+        await db_conn.execute("DROP TABLE IF EXISTS drop_col_vectors CASCADE")
```

---

### Incident Patch 4: `76ee8215` (2026-02-13)
**Commit Message**: Fix.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ extern "C" {
 #include <vector>
 
 // GUC variables
-int deeplake_sync_interval_ms = 500;  // Default 500ms
+int deeplake_sync_interval_ms = 1000;  // Default 1 second
 
 // Forward declaration (defined in the anonymous namespace below)
 namespace { bool execute_via_libpq(const char* dbname, const char* sql); }
```

---

### Incident Patch 5: `0e26444d` (2026-02-10)
**Commit Message**: Merge pull request #3136 from activeloopai/bugfix

Make stateless default.

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +2/-2)
```diff
@@ -238,8 +238,8 @@ void initialize_guc_parameters()
                              "allowing multiple PostgreSQL instances to share the same tables. "
                              "This adds latency for remote storage (S3, GCS) due to catalog sync operations.",
                              &pg::stateless_enabled,
-                             false,
-                             PGC_USERSET,
+                             true,
+                             PGC_POSTMASTER,
                              0,
                              nullptr,
                              nullptr,
```

**File**: `postgres/tests/py_tests/test_startup_latency.py` (modified, +0/-21)
```diff
@@ -100,7 +100,6 @@ async def measure_connection_latency(
     database: str = "postgres",
     with_extension: bool = True,
     root_path: Optional[str] = None,
-    stateless_enabled: bool = False,
     run_first_query: bool = True,
     create_table: bool = False,
     table_name: str = "latency_test",
@@ -113,7 +112,6 @@ async def measure_connection_latency(
         database: Database to connect to
         with_extension: Whether to load pg_deeplake extension
         root_path: If set, configure deeplake.root_path
-        stateless_enabled: Whether to enable stateless mode
         run_first_query: Whether to measure first query time
         create_table: Whether to measure table creation time
         table_name: Name for test table
@@ -144,10 +142,6 @@ async def measure_connection_latency(
             await conn.execute("CREATE EXTENSION pg_deeplake")
             metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
-            # Set stateless mode if requested
-            if stateless_enabled:
-                await conn.execute("SET deeplake.stateless_enabled = true")
-
         # 3. Measure root_path set time (triggers catalog loading in stateless mode)
         if root_path:
             root_start = time.perf_counter()
@@ -188,7 +182,6 @@ async def measure_catalog_discovery_latency(
     port: int,
     root_path: str,
     num_tables: int,
-    stateless_enabled: bool = True,
 ) -> LatencyMetrics:
     """
     Measure time to discover existing tables from catalog.
@@ -214,8 +207,6 @@ async def measure_catalog_discovery_latency(
         ext_start = time.perf_counter()
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        if stateless_enabled:
-            await conn.execute("SET deeplake.stateless_enabled = true")
         metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
         # Set root_path - this triggers catalog discovery
@@ -349,7 +340,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
     try:
         await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-        await setup_conn.execute("SET deeplake.stateless_enabled = true")
         await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
         # Create multiple tables to populate the catalog
@@ -383,7 +373,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
             port=5432,
             root_path=temp_root_path,
             num_tables=num_tables,
-            stateless_enabled=True,
         )
         report.add(metrics)
         print(f"Run {i+1}:")
@@ -425,7 +414,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=False,
             run_first_query=True,
             create_table=True,
             table_name=f"nonstateless_test_{i}",
@@ -441,7 +429,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=True,
             run_first_query=True,
             create_table=True,
             table_name=f"stateless_test_{i}",
@@ -492,7 +479,6 @@ async def test_multi_table_catalog_scaling(pg_server, temp_root_path):
         try:
             await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
             await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-            await setup_conn.execute("SET deeplake.stateless_enabled = true")
             await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
             # 
```

**File**: `postgres/tests/py_tests/test_stateless_catalog_resilience.py` (modified, +0/-2)
```diff
@@ -28,8 +28,6 @@ async def test_stateless_bootstrap_permission_error_keeps_backend_alive(db_conn:
     - SET deeplake.root_path fails with a PostgreSQL error
     - Same connection remains usable afterwards
     """
-    await db_conn.execute("SET deeplake.stateless_enabled = true")
-
     readonly_root = Path(temp_dir_for_postgres) / "readonly_root"
     readonly_root.mkdir(parents=True, exist_ok=True)
     os.chmod(readonly_root, 0o555)
```

**File**: `postgres/tests/py_tests/test_stateless_multi_instance.py` (modified, +4/-5)
```diff
@@ -213,7 +213,6 @@ async def primary_conn(pg_server):
         # Setup: Clean extension state
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -323,7 +322,7 @@ async def test_stateless_data_sync_between_instances(
     try:
         # Setup extension (create if not exists for session-scoped instance reuse)
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should automatically discover and register tables from catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -412,7 +411,7 @@ async def test_stateless_concurrent_writes(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -515,7 +514,7 @@ async def test_stateless_multiple_tables_discovery(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover ALL tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -683,7 +682,7 @@ async def test_stateless_varchar1_catalog_sync(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table was auto-discovered
```

**File**: `postgres/tests/py_tests/test_stateless_reserved_schema.py` (modified, +4/-5)
```diff
@@ -75,7 +75,6 @@ async def primary_conn(pg_server):
     try:
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -144,7 +143,7 @@ async def test_catalog_sync_default_schema(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # This is the critical part - setting root_path triggers catalog sync
         # which should properly quote "default" schema name in generated DDL
@@ -236,7 +235,7 @@ async def test_catalog_sync_multiple_reserved_schemas(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify all tables discovered
@@ -322,7 +321,7 @@ async def test_catalog_sync_default_schema_with_indexes(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table discovered
@@ -378,7 +377,7 @@ async def test_catalog_sync_default_schema_write_from_secondary(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Insert from Instance B
```

---

### Incident Patch 6: `43fa9d82` (2026-02-10)
**Commit Message**: Merge pull request #3135 from activeloopai/fix-race

Fixed parallel ingestion.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +36/-29)
```diff
@@ -83,9 +83,6 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
         Oid relid = RangeVarGetRelid(rel, NoLock, true);
 
         if (!OidIsValid(relid)) {
-            // Table doesn't exist locally - create it
-            elog(LOG, "pg_deeplake sync: creating table %s from catalog", qualified_name.c_str());
-
             // Gather columns for this table, sorted by position
             std::vector<pg::dl_catalog::column_meta> table_columns;
             for (const auto& col : catalog_columns) {
@@ -102,26 +99,12 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
             }
 
             const char* qschema = quote_identifier(meta.schema_name.c_str());
+            const char* qtable = quote_identifier(meta.table_name.c_str());
 
+            // Build CREATE TABLE IF NOT EXISTS statement
             StringInfoData buf;
             initStringInfo(&buf);
-
-            // Create schema if needed
-            appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-
-            pg::utils::spi_connector connector;
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                elog(WARNING, "pg_deeplake sync: failed to create schema %s", meta.schema_name.c_str());
-                pfree(buf.data);
-                continue;
-            }
-
-            // Build CREATE TABLE statement directly from catalog metadata
-            // This avoids calling the SQL function create_deeplake_table which may not exist
-            // in the postgres database (extension might not be installed there)
-            resetStringInfo(&buf);
-            const char* qtable = quote_identifier(meta.table_name.c_str());
-            appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+            appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
             bool first = true;
             for (const auto& col : table_columns) {
@@ -131,18 +114,42 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
                 first = false;
                 appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
             }
-
-            // Table path is now derived from deeplake.root_path GUC set at database level
-            // Path: {root_path}/{schema}/{table_name}
             appendStringInfo(&buf, ") USING deeplake");
 
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                // Don't log as warning - the dataset might not be available yet
-                // The sync worker will retry on the next cycle
-                elog(DEBUG1, "pg_deeplake sync: table %s not ready yet, will retry", qualified_name.c_str());
-            } else {
-                elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+            // Wrap in subtransaction so that if another backend concurrently
+            // creates the same table (race on composite type), the error is
+            // caught and we continue instead of aborting the sync cycle.
+            MemoryContext saved_context = CurrentMemoryContext;
+            ResourceOwner saved_owner = CurrentResourceOwner;
+
+            BeginInternalSubTransaction(NULL);
+            PG_TRY();
+            {
+                pg::utils::spi_connector connector;
+
+                // Create schema if needed
+                StringInfoData schema_buf;
+                initStringInfo(&schema_buf);
+                appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                SPI_execute(schema_buf.data, false, 0);
+                pfree(schema_buf.data);
+
+                if (SPI_execute(buf.data, false, 0) == SPI_OK_UTILITY) {
+                    elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+                }
+
+                ReleaseCurrentSubTransaction();
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +45/-27)
```diff
@@ -9,6 +9,7 @@ extern "C" {
 #include <access/heapam.h>
 #include <access/htup_details.h>
 #include <access/parallel.h>
+#include <access/xact.h>
 #include <catalog/namespace.h>
 #include <catalog/pg_type.h>
 #include <executor/spi.h>
@@ -344,28 +345,15 @@ void table_storage::load_table_metadata()
                         continue;
                     }
 
-                    // Not in DDL context (e.g., SET root_path) - safe to auto-create.
-                    // Use catalog_only_guard to skip S3 dataset operations in create_table() —
-                    // the dataset already exists on S3, we just need the pg_class entry.
-                    catalog_only_guard co_guard;
-                    pg::utils::memory_context_switcher context_switcher;
-                    pg::utils::spi_connector connector;
-                    bool pushed_snapshot = false;
-                    if (!ActiveSnapshotSet()) {
-                        PushActiveSnapshot(GetTransactionSnapshot());
-                        pushed_snapshot = true;
-                    }
+                    // Build CREATE TABLE IF NOT EXISTS from catalog metadata.
+                    // Wrap in a subtransaction so that if another backend concurrently
+                    // creates the same table (race on composite type), the error is
+                    // caught and we continue instead of aborting the session.
                     const char* qschema = quote_identifier(meta.schema_name.c_str());
+                    const char* qtable = quote_identifier(meta.table_name.c_str());
 
                     StringInfoData buf;
                     initStringInfo(&buf);
-                    appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-                    SPI_execute(buf.data, false, 0);
-
-                    // Build CREATE TABLE statement directly from catalog metadata
-                    // This avoids calling the SQL function create_deeplake_table which may not exist
-                    resetStringInfo(&buf);
-                    const char* qtable = quote_identifier(meta.table_name.c_str());
                     appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
@@ -376,19 +364,49 @@ void table_storage::load_table_metadata()
                         first = false;
                         appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
                     }
-
-                    // Table path is now derived from deeplake.root_path GUC set at database level
-                    // Path: {root_path}/{schema}/{table_name}
                     appendStringInfo(&buf, ") USING deeplake");
 
-                    if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                        elog(WARNING, "Failed to auto-create deeplake table %s from catalog", qualified_name.c_str());
-                    }
-                    pfree(buf.data);
+                    MemoryContext saved_context = CurrentMemoryContext;
+                    ResourceOwner saved_owner = CurrentResourceOwner;
+
+                    BeginInternalSubTransaction(NULL);
+                    PG_TRY();
+                    {
+                        catalog_only_guard co_guard;
+                        pg::utils::spi_connector connector;
+                        bool pushed_snapshot = false;
+                        if (!ActiveSnapshotSet()) {
+                            PushActiveSnapshot(GetTransactionSnapshot());
+                            pushed_snapshot = true;
+                        }
 
-                    if (pushed_snapshot) {
-                        PopActiveSnapshot();
+                        // Create schema if needed
+                        StringInfoData schema_buf;
+                        initStringInfo(&schema_buf);
+                        appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                    
```

---

### Incident Patch 7: `f8d3e8a7` (2026-02-10)
**Commit Message**: Fixed parallel ingestion.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +36/-29)
```diff
@@ -83,9 +83,6 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
         Oid relid = RangeVarGetRelid(rel, NoLock, true);
 
         if (!OidIsValid(relid)) {
-            // Table doesn't exist locally - create it
-            elog(LOG, "pg_deeplake sync: creating table %s from catalog", qualified_name.c_str());
-
             // Gather columns for this table, sorted by position
             std::vector<pg::dl_catalog::column_meta> table_columns;
             for (const auto& col : catalog_columns) {
@@ -102,26 +99,12 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
             }
 
             const char* qschema = quote_identifier(meta.schema_name.c_str());
+            const char* qtable = quote_identifier(meta.table_name.c_str());
 
+            // Build CREATE TABLE IF NOT EXISTS statement
             StringInfoData buf;
             initStringInfo(&buf);
-
-            // Create schema if needed
-            appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-
-            pg::utils::spi_connector connector;
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                elog(WARNING, "pg_deeplake sync: failed to create schema %s", meta.schema_name.c_str());
-                pfree(buf.data);
-                continue;
-            }
-
-            // Build CREATE TABLE statement directly from catalog metadata
-            // This avoids calling the SQL function create_deeplake_table which may not exist
-            // in the postgres database (extension might not be installed there)
-            resetStringInfo(&buf);
-            const char* qtable = quote_identifier(meta.table_name.c_str());
-            appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+            appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
             bool first = true;
             for (const auto& col : table_columns) {
@@ -131,18 +114,42 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
                 first = false;
                 appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
             }
-
-            // Table path is now derived from deeplake.root_path GUC set at database level
-            // Path: {root_path}/{schema}/{table_name}
             appendStringInfo(&buf, ") USING deeplake");
 
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                // Don't log as warning - the dataset might not be available yet
-                // The sync worker will retry on the next cycle
-                elog(DEBUG1, "pg_deeplake sync: table %s not ready yet, will retry", qualified_name.c_str());
-            } else {
-                elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+            // Wrap in subtransaction so that if another backend concurrently
+            // creates the same table (race on composite type), the error is
+            // caught and we continue instead of aborting the sync cycle.
+            MemoryContext saved_context = CurrentMemoryContext;
+            ResourceOwner saved_owner = CurrentResourceOwner;
+
+            BeginInternalSubTransaction(NULL);
+            PG_TRY();
+            {
+                pg::utils::spi_connector connector;
+
+                // Create schema if needed
+                StringInfoData schema_buf;
+                initStringInfo(&schema_buf);
+                appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                SPI_execute(schema_buf.data, false, 0);
+                pfree(schema_buf.data);
+
+                if (SPI_execute(buf.data, false, 0) == SPI_OK_UTILITY) {
+                    elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+                }
+
+                ReleaseCurrentSubTransaction();
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +45/-27)
```diff
@@ -9,6 +9,7 @@ extern "C" {
 #include <access/heapam.h>
 #include <access/htup_details.h>
 #include <access/parallel.h>
+#include <access/xact.h>
 #include <catalog/namespace.h>
 #include <catalog/pg_type.h>
 #include <executor/spi.h>
@@ -344,28 +345,15 @@ void table_storage::load_table_metadata()
                         continue;
                     }
 
-                    // Not in DDL context (e.g., SET root_path) - safe to auto-create.
-                    // Use catalog_only_guard to skip S3 dataset operations in create_table() —
-                    // the dataset already exists on S3, we just need the pg_class entry.
-                    catalog_only_guard co_guard;
-                    pg::utils::memory_context_switcher context_switcher;
-                    pg::utils::spi_connector connector;
-                    bool pushed_snapshot = false;
-                    if (!ActiveSnapshotSet()) {
-                        PushActiveSnapshot(GetTransactionSnapshot());
-                        pushed_snapshot = true;
-                    }
+                    // Build CREATE TABLE IF NOT EXISTS from catalog metadata.
+                    // Wrap in a subtransaction so that if another backend concurrently
+                    // creates the same table (race on composite type), the error is
+                    // caught and we continue instead of aborting the session.
                     const char* qschema = quote_identifier(meta.schema_name.c_str());
+                    const char* qtable = quote_identifier(meta.table_name.c_str());
 
                     StringInfoData buf;
                     initStringInfo(&buf);
-                    appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-                    SPI_execute(buf.data, false, 0);
-
-                    // Build CREATE TABLE statement directly from catalog metadata
-                    // This avoids calling the SQL function create_deeplake_table which may not exist
-                    resetStringInfo(&buf);
-                    const char* qtable = quote_identifier(meta.table_name.c_str());
                     appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
@@ -376,19 +364,49 @@ void table_storage::load_table_metadata()
                         first = false;
                         appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
                     }
-
-                    // Table path is now derived from deeplake.root_path GUC set at database level
-                    // Path: {root_path}/{schema}/{table_name}
                     appendStringInfo(&buf, ") USING deeplake");
 
-                    if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                        elog(WARNING, "Failed to auto-create deeplake table %s from catalog", qualified_name.c_str());
-                    }
-                    pfree(buf.data);
+                    MemoryContext saved_context = CurrentMemoryContext;
+                    ResourceOwner saved_owner = CurrentResourceOwner;
+
+                    BeginInternalSubTransaction(NULL);
+                    PG_TRY();
+                    {
+                        catalog_only_guard co_guard;
+                        pg::utils::spi_connector connector;
+                        bool pushed_snapshot = false;
+                        if (!ActiveSnapshotSet()) {
+                            PushActiveSnapshot(GetTransactionSnapshot());
+                            pushed_snapshot = true;
+                        }
 
-                    if (pushed_snapshot) {
-                        PopActiveSnapshot();
+                        // Create schema if needed
+                        StringInfoData schema_buf;
+                        initStringInfo(&schema_buf);
+                        appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                    
```

---

### Incident Patch 8: `3bc282a6` (2026-02-09)
**Commit Message**: Merge pull request #3134 from activeloopai/drop-column-fixes

Fixed out of bounds fix after drop column.

**File**: `cpp/deeplake_pg/column_statistics.cpp` (modified, +4/-14)
```diff
@@ -218,20 +218,10 @@ bool inject_column_statistics(Relation rel, int16_t attnum)
         return false;
     }
 
-    // Get DeepLake column view - attnum is 1-based, column index is 0-based
-    int32_t col_idx = attnum - 1;
-
-    // Skip dropped columns by finding the actual column index
-    int32_t logical_idx = 0;
-    for (int32_t i = 0; i < tupdesc->natts && logical_idx <= col_idx; ++i) {
-        Form_pg_attribute a = TupleDescAttr(tupdesc, i);
-        if (!a->attisdropped) {
-            if (logical_idx == col_idx) {
-                col_idx = i;
-                break;
-            }
-            logical_idx++;
-        }
+    // Map PG attnum to logical column index (handles dropped columns correctly)
+    const auto col_idx = table_data.logical_index_for_attnum(attnum);
+    if (col_idx < 0) {
+        return false;
     }
 
     heimdall::column_view_ptr column_view;
```

**File**: `cpp/deeplake_pg/deeplake_executor.cpp` (modified, +4/-1)
```diff
@@ -77,7 +77,10 @@ void analyze_plan(PlannedStmt* plan)
             if (attnum <= 0) { // Only positive attribute numbers are real columns
                 continue;
             }
-            auto col_idx = static_cast<int32_t>(attnum - 1);
+            auto col_idx = table_data->logical_index_for_attnum(attnum);
+            if (col_idx < 0) {
+                continue; // Dropped column or out of range
+            }
             if (!table_data->is_column_requested(col_idx)) {
                 table_data->set_column_requested(col_idx, true);
                 if (!table_data->column_has_streamer(col_idx) && table_data->can_stream_column(col_idx)) {
```

**File**: `cpp/deeplake_pg/table_am.cpp` (modified, +9/-6)
```diff
@@ -367,10 +367,13 @@ double deeplake_index_build_range_scan(Relation heap_rel,
     AttrNumber* indexkeys = index_info->ii_IndexAttrNumbers;
     const auto table_id = RelationGetRelid(heap_rel);
     auto& td = pg::table_storage::instance().get_table_data(table_id);
+    // Map index key attnums to logical column indices
+    std::vector<int32_t> key_logical_indices(nkeys, -1);
     for (int32_t i = 0; i < nkeys; ++i) {
-        int32_t attnum = indexkeys[i] - 1;
-        if (attnum >= 0 && !td.column_has_streamer(attnum) && td.can_stream_column(attnum)) {
-            td.create_streamer(attnum, -1);
+        auto logical = td.logical_index_for_attnum(indexkeys[i]);
+        key_logical_indices[i] = logical;
+        if (logical >= 0 && !td.column_has_streamer(logical) && td.can_stream_column(logical)) {
+            td.create_streamer(logical, -1);
         }
     }
     std::vector<Datum> values(nkeys, 0);
@@ -382,12 +385,12 @@ double deeplake_index_build_range_scan(Relation heap_rel,
         auto [block_number, offset_number] = pg::utils::row_number_to_tid(row);
         ItemPointerSet(&tid, block_number, offset_number);
         for (int32_t i = 0; i < nkeys; ++i) {
-            int32_t attnum = indexkeys[i] - 1;
-            if (attnum < 0) [[unlikely]] {
+            auto logical = key_logical_indices[i];
+            if (logical < 0) [[unlikely]] {
                 nulls[i] = true;
                 values[i] = 0;
             } else [[likely]] {
-                auto [value, null] = tscan.get_datum(attnum, row);
+                auto [value, null] = tscan.get_datum(logical, row);
                 values[i] = value;
                 nulls[i] = null;
             }
```

**File**: `cpp/deeplake_pg/table_data.hpp` (modified, +2/-0)
```diff
@@ -67,6 +67,7 @@ struct table_data
     inline std::string get_atttypename(AttrNumber attr_num) const noexcept;
     inline bool is_column_dropped(AttrNumber attr_num) const noexcept;
     inline int32_t get_tupdesc_index(AttrNumber attr_num) const noexcept;
+    inline int32_t logical_index_for_attnum(int32_t attnum) const noexcept;
     inline bool is_column_nullable(AttrNumber attr_num) const noexcept;
     inline bool is_column_indexed(AttrNumber attr_num) const noexcept;
     inline int32_t num_columns() const noexcept;
@@ -176,6 +177,7 @@ struct table_data
     icm::vector<bool> requested_columns_;
     icm::vector<Oid> base_typeids_;              // Cached base type OIDs for performance
     icm::vector<int32_t> active_column_indices_; // Maps logical index to TupleDesc index (excludes dropped)
+    icm::vector<int32_t> tupdesc_to_logical_;    // Maps TupleDesc index to logical index (-1 if dropped)
     icm::string_map<> creds_;
     TupleDesc tuple_descriptor_;
     http::uri dataset_path_ = http::uri(std::string());
```

**File**: `cpp/deeplake_pg/table_data_impl.hpp` (modified, +18/-2)
```diff
@@ -64,6 +64,12 @@ inline table_data::table_data(
         }
     }
 
+    // Build reverse mapping: TupleDesc index → logical index (-1 for dropped)
+    tupdesc_to_logical_.resize(tuple_descriptor_->natts, -1);
+    for (int32_t logical = 0; logical < static_cast<int32_t>(active_column_indices_.size()); ++logical) {
+        tupdesc_to_logical_[active_column_indices_[logical]] = logical;
+    }
+
     const auto num_active = active_column_indices_.size();
     requested_columns_.resize(num_active, false);
     base_typeids_.resize(num_active);
@@ -272,6 +278,15 @@ inline int32_t table_data::get_tupdesc_index(AttrNumber attr_num) const noexcept
     return active_column_indices_[attr_num];
 }
 
+inline int32_t table_data::logical_index_for_attnum(int32_t attnum) const noexcept
+{
+    const auto tupdesc_idx = attnum - 1;
+    if (tupdesc_idx < 0 || tupdesc_idx >= static_cast<int32_t>(tupdesc_to_logical_.size())) {
+        return -1;
+    }
+    return tupdesc_to_logical_[tupdesc_idx];
+}
+
 inline bool table_data::is_column_indexed(AttrNumber attr_num) const noexcept
 {
     return pg::pg_index::get_oid(table_name_, get_atttypename(attr_num)) != InvalidOid;
@@ -318,13 +333,14 @@ inline void table_data::add_insert_slots(int32_t nslots, TupleTableSlot** slots)
     for (int32_t i = 0; i < num_columns(); ++i) {
         auto& column_values = insert_rows_[get_atttypename(i)];
         const auto dt = get_column_view(i)->dtype();
+        const auto slot_pos = get_tupdesc_index(i);
         for (int32_t k = 0; k < nslots; ++k) {
             auto slot = slots[k];
             nd::array val;
-            if (slot->tts_isnull[i]) {
+            if (slot->tts_isnull[slot_pos]) {
                 val = (nd::dtype_is_numeric(dt) ? nd::adapt(0) : nd::none(dt, 0));
             } else {
-                val = pg::utils::datum_to_nd(slot->tts_values[i], get_base_atttypid(i), get_atttypmod(i));
+                val = pg::utils::datum_to_nd(slot->tts_values[slot_pos], get_base_atttypid(i), get_atttypmod(i));
             }
             column_values.push_back(std::move(val));
         }
```

---

### Incident Patch 9: `23ab3a81` (2026-02-09)
**Commit Message**: Fixed out of bounds fix after drop column.

**File**: `cpp/deeplake_pg/column_statistics.cpp` (modified, +4/-14)
```diff
@@ -218,20 +218,10 @@ bool inject_column_statistics(Relation rel, int16_t attnum)
         return false;
     }
 
-    // Get DeepLake column view - attnum is 1-based, column index is 0-based
-    int32_t col_idx = attnum - 1;
-
-    // Skip dropped columns by finding the actual column index
-    int32_t logical_idx = 0;
-    for (int32_t i = 0; i < tupdesc->natts && logical_idx <= col_idx; ++i) {
-        Form_pg_attribute a = TupleDescAttr(tupdesc, i);
-        if (!a->attisdropped) {
-            if (logical_idx == col_idx) {
-                col_idx = i;
-                break;
-            }
-            logical_idx++;
-        }
+    // Map PG attnum to logical column index (handles dropped columns correctly)
+    const auto col_idx = table_data.logical_index_for_attnum(attnum);
+    if (col_idx < 0) {
+        return false;
     }
 
     heimdall::column_view_ptr column_view;
```

**File**: `cpp/deeplake_pg/deeplake_executor.cpp` (modified, +4/-1)
```diff
@@ -77,7 +77,10 @@ void analyze_plan(PlannedStmt* plan)
             if (attnum <= 0) { // Only positive attribute numbers are real columns
                 continue;
             }
-            auto col_idx = static_cast<int32_t>(attnum - 1);
+            auto col_idx = table_data->logical_index_for_attnum(attnum);
+            if (col_idx < 0) {
+                continue; // Dropped column or out of range
+            }
             if (!table_data->is_column_requested(col_idx)) {
                 table_data->set_column_requested(col_idx, true);
                 if (!table_data->column_has_streamer(col_idx) && table_data->can_stream_column(col_idx)) {
```

**File**: `cpp/deeplake_pg/table_am.cpp` (modified, +9/-6)
```diff
@@ -367,10 +367,13 @@ double deeplake_index_build_range_scan(Relation heap_rel,
     AttrNumber* indexkeys = index_info->ii_IndexAttrNumbers;
     const auto table_id = RelationGetRelid(heap_rel);
     auto& td = pg::table_storage::instance().get_table_data(table_id);
+    // Map index key attnums to logical column indices
+    std::vector<int32_t> key_logical_indices(nkeys, -1);
     for (int32_t i = 0; i < nkeys; ++i) {
-        int32_t attnum = indexkeys[i] - 1;
-        if (attnum >= 0 && !td.column_has_streamer(attnum) && td.can_stream_column(attnum)) {
-            td.create_streamer(attnum, -1);
+        auto logical = td.logical_index_for_attnum(indexkeys[i]);
+        key_logical_indices[i] = logical;
+        if (logical >= 0 && !td.column_has_streamer(logical) && td.can_stream_column(logical)) {
+            td.create_streamer(logical, -1);
         }
     }
     std::vector<Datum> values(nkeys, 0);
@@ -382,12 +385,12 @@ double deeplake_index_build_range_scan(Relation heap_rel,
         auto [block_number, offset_number] = pg::utils::row_number_to_tid(row);
         ItemPointerSet(&tid, block_number, offset_number);
         for (int32_t i = 0; i < nkeys; ++i) {
-            int32_t attnum = indexkeys[i] - 1;
-            if (attnum < 0) [[unlikely]] {
+            auto logical = key_logical_indices[i];
+            if (logical < 0) [[unlikely]] {
                 nulls[i] = true;
                 values[i] = 0;
             } else [[likely]] {
-                auto [value, null] = tscan.get_datum(attnum, row);
+                auto [value, null] = tscan.get_datum(logical, row);
                 values[i] = value;
                 nulls[i] = null;
             }
```

**File**: `cpp/deeplake_pg/table_data.hpp` (modified, +2/-0)
```diff
@@ -67,6 +67,7 @@ struct table_data
     inline std::string get_atttypename(AttrNumber attr_num) const noexcept;
     inline bool is_column_dropped(AttrNumber attr_num) const noexcept;
     inline int32_t get_tupdesc_index(AttrNumber attr_num) const noexcept;
+    inline int32_t logical_index_for_attnum(int32_t attnum) const noexcept;
     inline bool is_column_nullable(AttrNumber attr_num) const noexcept;
     inline bool is_column_indexed(AttrNumber attr_num) const noexcept;
     inline int32_t num_columns() const noexcept;
@@ -176,6 +177,7 @@ struct table_data
     icm::vector<bool> requested_columns_;
     icm::vector<Oid> base_typeids_;              // Cached base type OIDs for performance
     icm::vector<int32_t> active_column_indices_; // Maps logical index to TupleDesc index (excludes dropped)
+    icm::vector<int32_t> tupdesc_to_logical_;    // Maps TupleDesc index to logical index (-1 if dropped)
     icm::string_map<> creds_;
     TupleDesc tuple_descriptor_;
     http::uri dataset_path_ = http::uri(std::string());
```

**File**: `cpp/deeplake_pg/table_data_impl.hpp` (modified, +18/-2)
```diff
@@ -64,6 +64,12 @@ inline table_data::table_data(
         }
     }
 
+    // Build reverse mapping: TupleDesc index → logical index (-1 for dropped)
+    tupdesc_to_logical_.resize(tuple_descriptor_->natts, -1);
+    for (int32_t logical = 0; logical < static_cast<int32_t>(active_column_indices_.size()); ++logical) {
+        tupdesc_to_logical_[active_column_indices_[logical]] = logical;
+    }
+
     const auto num_active = active_column_indices_.size();
     requested_columns_.resize(num_active, false);
     base_typeids_.resize(num_active);
@@ -272,6 +278,15 @@ inline int32_t table_data::get_tupdesc_index(AttrNumber attr_num) const noexcept
     return active_column_indices_[attr_num];
 }
 
+inline int32_t table_data::logical_index_for_attnum(int32_t attnum) const noexcept
+{
+    const auto tupdesc_idx = attnum - 1;
+    if (tupdesc_idx < 0 || tupdesc_idx >= static_cast<int32_t>(tupdesc_to_logical_.size())) {
+        return -1;
+    }
+    return tupdesc_to_logical_[tupdesc_idx];
+}
+
 inline bool table_data::is_column_indexed(AttrNumber attr_num) const noexcept
 {
     return pg::pg_index::get_oid(table_name_, get_atttypename(attr_num)) != InvalidOid;
@@ -318,13 +333,14 @@ inline void table_data::add_insert_slots(int32_t nslots, TupleTableSlot** slots)
     for (int32_t i = 0; i < num_columns(); ++i) {
         auto& column_values = insert_rows_[get_atttypename(i)];
         const auto dt = get_column_view(i)->dtype();
+        const auto slot_pos = get_tupdesc_index(i);
         for (int32_t k = 0; k < nslots; ++k) {
             auto slot = slots[k];
             nd::array val;
-            if (slot->tts_isnull[i]) {
+            if (slot->tts_isnull[slot_pos]) {
                 val = (nd::dtype_is_numeric(dt) ? nd::adapt(0) : nd::none(dt, 0));
             } else {
-                val = pg::utils::datum_to_nd(slot->tts_values[i], get_base_atttypid(i), get_atttypmod(i));
+                val = pg::utils::datum_to_nd(slot->tts_values[slot_pos], get_base_atttypid(i), get_atttypmod(i));
             }
             column_values.push_back(std::move(val));
         }
```

---

### Incident Patch 10: `04874884` (2026-02-09)
**Commit Message**: Fixed failure on parallel ingestion.

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +1/-1)
```diff
@@ -366,7 +366,7 @@ void table_storage::load_table_metadata()
                     // This avoids calling the SQL function create_deeplake_table which may not exist
                     resetStringInfo(&buf);
                     const char* qtable = quote_identifier(meta.table_name.c_str());
-                    appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+                    appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
                     for (const auto& col : table_columns) {
```

#### Recent Merged Pull Requests:
- **PR #3158** (closed): Fix typo in deeplake (#3149) (@bglglzd)
- **PR #3156** (closed): Add TwelveLabs Marengo embedding integration for video vector search (@mohit-twelvelabs)
- **PR #3142** (closed): fix: replace 72 bare except clauses with except Exception (@haosenwang1018)
- **PR #3141** (2026-02-15): Fix/remove serverless from dockerfile (@khustup2)
- **PR #3140** (2026-02-14): Removed 16 pg support. (@khustup2)
- **PR #3139** (2026-02-14): Stateless sync. Per db tables, indexes, schemas. (@khustup2)
- **PR #3138** (2026-02-13): Sync db catalogs. (@khustup2)
- **PR #3137** (2026-02-12): Make db creation stateless. (@khustup2)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
