# Forensic Learning Record (Deep Inspection): Netflix/dynomite

> **Canonical Artifact**: `07_PROJECT_LEARNING/netflix-dynomite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Netflix/dynomite](https://github.com/Netflix/dynomite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:44.108Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Netflix/dynomite`
- **Description**: A generic dynamo implementation for different k-v storage engines
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4215 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/fmemopen.c`
```
//
// Copyright 2011-2014 NimbusKit
// Originally ported from https://github.com/ingenuitas/python-tesseract/blob/master/fmemopen.c
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>

struct fmem {
  size_t pos;
  size_t size;
  char *buffer;
};
typedef struct fmem fmem_t;

static int readfn(void *handler, char *buf, int size) {
  fmem_t *mem = handler;
  size_t available = mem->size - mem->pos;
  
  if (size > available) {
    size = available;
  }
  memcpy(buf, mem->buffer + mem->pos, sizeof(char) * size);
  mem->pos += size;
  
  return size;
}

static int writefn(void *handler, const char *buf, int size) {
  fmem_t *mem = handler;
  size_t available = mem->size - mem->pos;

  if (size > available) {
    size = available;
  }
  memcpy(mem->buffer + mem->pos, buf, sizeof(char) * size);
  mem->pos += size;

  return size;
}

static fpos_t seekfn(void *handler, fpos_t offset, int whence) {
  size_t pos;
  fmem_t *mem = handler;

  switch (whence) {
    case SEEK_SET: {
      if (offset >= 0) {
        pos = (size_t)offset;
      } else {
        pos = 0;
      }
      break;
    }
    case SEEK_CUR: {
      if (offset >= 0 || (size_t)(-offset) <= mem->pos) {
        pos = mem->pos + (size_t)offset;
      } else {
        pos = 0;
      }
      break;
    }
    case SEEK_END: pos = mem->size + (size_t)offset; break;
    default: return -1;
  }

  if (pos > mem->size) {
    return -1;
  }

  mem->pos = pos;
  return (fpos_t)pos;
}

static int closefn(void *handler) {
  free(handler);
  return 0;
}

FILE *fmemopen(void *buf, size_t size, const char *mode) {
  // This data is released on fclose.
  fmem_t* mem = (fmem_t *) malloc(sizeof(fmem_t));

  // Zero-out the structure.
  memset(mem, 0, sizeof(fmem_t));

  mem->size = size;
  mem->buffer = buf;

  // funopen's man page: https://developer.apple.com/library/mac/#documentation/Darwin/Reference/ManPages/man3/funopen.3.html
  return funopen(mem, readfn, writefn, seekfn, closefn);
}

```

### Core Architecture Module: `contrib/fmemopen.h`
```
//
// Copyright 2011-2014 NimbusKit
// Originally ported from https://github.com/ingenuitas/python-tesseract/blob/master/fmemopen.c
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#ifndef FMEMOPEN_H_
#define FMEMOPEN_H_

#if defined __cplusplus
extern "C" {
#endif

/**
 * A BSD port of the fmemopen Linux method using funopen.
 *
 * man docs for fmemopen:
 * http://linux.die.net/man/3/fmemopen
 *
 * man docs for funopen:
 * https://developer.apple.com/library/mac/#documentation/Darwin/Reference/ManPages/man3/funopen.3.html
 *
 * This method is ported from ingenuitas' python-tesseract project.
 *
 * You must call fclose on the returned file pointer or memory will be leaked.
 *
 * @param buf The data that will be used to back the FILE* methods. Must be at least
 *            @c size bytes.
 * @param size The size of the @c buf data.
 * @param mode The permitted stream operation modes.
 * @return A pointer that can be used in the fread/fwrite/fseek/fclose family of methods.
 *         If a failure occurred NULL will be returned.
 * @ingroup NimbusMemoryMappping
 */
FILE *fmemopen(void *buf, size_t size, const char *mode);

#ifdef __cplusplus
}
#endif

#endif // #ifndef FMEMOPEN_H_

```

### Core Architecture Module: `contrib/murmur3/murmur3.c`
```
//-----------------------------------------------------------------------------
// MurmurHash3 was written by Austin Appleby, and is placed in the public
// domain. The author hereby disclaims copyright to this source code.

// Note - The x86 and x64 versions do _not_ produce the same results, as the
// algorithms are optimized for their respective platforms. You can still
// compile and run any of them on any platform, but your performance with the
// non-native version will be less than optimal.

#include "murmur3.h"

//-----------------------------------------------------------------------------
// Platform-specific functions and macros

#ifdef __GNUC__
#define FORCE_INLINE __attribute__((always_inline)) inline
#else
#define FORCE_INLINE
#endif

static inline FORCE_INLINE uint32_t rotl32 ( uint32_t x, int8_t r )
{
  return (x << r) | (x >> (32 - r));
}

static inline FORCE_INLINE uint64_t rotl64 ( uint64_t x, int8_t r )
{
  return (x << r) | (x >> (64 - r));
}

#define	ROTL32(x,y)	rotl32(x,y)
#define ROTL64(x,y)	rotl64(x,y)

#define BIG_CONSTANT(x) (x##LLU)

//-----------------------------------------------------------------------------
// Block read - if your platform needs to do endian-swapping or can only
// handle aligned reads, do the conversion here

#define getblock(p, i) (p[i])

//-----------------------------------------------------------------------------
// Finalization mix - force all bits of a hash block to avalanche

static inline FORCE_INLINE uint32_t fmix32 ( uint32_t h )
{
  h ^= h >> 16;
  h *= 0x85ebca6b;
  h ^= h >> 13;
  h *= 0xc2b2ae35;
  h ^= h >> 16;

  return h;
}

//----------

static inline FORCE_INLINE uint64_t fmix64 ( uint64_t k )
{
  k ^= k >> 33;
  k *= BIG_CONSTANT(0xff51afd7ed558ccd);
  k ^= k >> 33;
  k *= BIG_CONSTANT(0xc4ceb9fe1a85ec53);
  k ^= k >> 33;

  return k;
}

//-----------------------------------------------------------------------------

void MurmurHash3_x86_32 ( const void * key, int len,
                          uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 4;
  int i;

  uint32_t h1 = seed;

  uint32_t c1 = 0xcc9e2d51;
  uint32_t c2 = 0x1b873593;

  //----------
  // body

  const uint32_t * blocks = (const uint32_t *)(data + nblocks*4);

  for(i = -nblocks; i; i++)
  {
    uint32_t k1 = getblock(blocks,i);

    k1 *= c1;
    k1 = ROTL32(k1,15);
    k1 *= c2;
    
    h1 ^= k1;
    h1 = ROTL32(h1,13); 
    h1 = h1*5+0xe6546b64;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*4);

  uint32_t k1 = 0;

  switch(len & 3)
  {
  case 3: k1 ^= tail[2] << 16;
  case 2: k1 ^= tail[1] << 8;
  case 1: k1 ^= tail[0];
          k1 *= c1; k1 = ROTL32(k1,15); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len;

  h1 = fmix32(h1);

  *(uint32_t*)out = h1;
} 

//-----------------------------------------------------------------------------

void MurmurHash3_x86_128 ( const void * key, const int len,
                           uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 16;
  int i;

  uint32_t h1 = seed;
  uint32_t h2 = seed;
  uint32_t h3 = seed;
  uint32_t h4 = seed;

  uint32_t c1 = 0x239b961b; 
  uint32_t c2 = 0xab0e9789;
  uint32_t c3 = 0x38b34ae5; 
  uint32_t c4 = 0xa1e38b93;

  //----------
  // body

  const uint32_t * blocks = (const uint32_t *)(data + nblocks*16);

  for(i = -nblocks; i; i++)
  {
    uint32_t k1 = getblock(blocks,i*4+0);
    uint32_t k2 = getblock(blocks,i*4+1);
    uint32_t k3 = getblock(blocks,i*4+2);
    uint32_t k4 = getblock(blocks,i*4+3);

    k1 *= c1; k1  = ROTL32(k1,15); k1 *= c2; h1 ^= k1;

    h1 = ROTL32(h1,19); h1 += h2; h1 = h1*5+0x561ccd1b;

    k2 *= c2; k2  = ROTL32(k2,16); k2 *= c3; h2 ^= k2;

    h2 = ROTL32(h2,17); h2 += h3; h2 = h2*5+0x0bcaa747;

    k3 *= c3; k3  = ROTL32(k3,17); k3 *= c4; h3 ^= k3;

    h3 = ROTL32(h3,15); h3 += h4; h3 = h3*5+0x96cd1c35;

    k4 *= c4; k4  = ROTL32(k4,18); k4 *= c1; h4 ^= k4;

    h4 = ROTL32(h4,13); h4 += h1; h4 = h4*5+0x32ac3b17;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*16);

  uint32_t k1 = 0;
  uint32_t k2 = 0;
  uint32_t k3 = 0;
  uint32_t k4 = 0;

  switch(len & 15)
  {
  case 15: k4 ^= tail[14] << 16;
  case 14: k4 ^= tail[13] << 8;
  case 13: k4 ^= tail[12] << 0;
           k4 *= c4; k4  = ROTL32(k4,18); k4 *= c1; h4 ^= k4;

  case 12: k3 ^= tail[11] << 24;
  case 11: k3 ^= tail[10] << 16;
  case 10: k3 ^= tail[ 9] << 8;
  case  9: k3 ^= tail[ 8] << 0;
           k3 *= c3; k3  = ROTL32(k3,17); k3 *= c4; h3 ^= k3;

  case  8: k2 ^= tail[ 7] << 24;
  case  7: k2 ^= tail[ 6] << 16;
  case  6: k2 ^= tail[ 5] << 8;
  case  5: k2 ^= tail[ 4] << 0;
           k2 *= c2; k2  = ROTL32(k2,16); k2 *= c3; h2 ^= k2;

  case  4: k1 ^= tail[ 3] << 24;
  case  3: k1 ^= tail[ 2] << 16;
  case  2: k1 ^= tail[ 1] << 8;
  case  1: k1 ^= tail[ 0] << 0;
           k1 *= c1; k1  = ROTL32(k1,15); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len; h2 ^= len; h3 ^= len; h4 ^= len;

  h1 += h2; h1 += h3; h1 += h4;
  h2 += h1; h3 += h1; h4 += h1;

  h1 = fmix32(h1);
  h2 = fmix32(h2);
  h3 = fmix32(h3);
  h4 = fmix32(h4);

  h1 += h2; h1 += h3; h1 += h4;
  h2 += h1; h3 += h1; h4 += h1;

  ((uint32_t*)out)[0] = h1;
  ((uint32_t*)out)[1] = h2;
  ((uint32_t*)out)[2] = h3;
  ((uint32_t*)out)[3] = h4;
}

//-----------------------------------------------------------------------------

void MurmurHash3_x64_128 ( const void * key, const int len,
                           const uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 16;
  int i;

  uint64_t h1 = seed;
  uint64_t h2 = seed;

  uint64_t c1 = BIG_CONSTANT(0x87c37b91114253d5);
  uint64_t c2 = BIG_CONSTANT(0x4cf5ad432745937f);

  //----------
  // body

  const uint64_t * blocks = (const uint64_t *)(data);

  for(i = 0; i < nblocks; i++)
  {
    uint64_t k1 = getblock(blocks,i*2+0);
    uint64_t k2 = getblock(blocks,i*2+1);

    k1 *= c1; k1  = ROTL64(k1,31); k1 *= c2; h1 ^= k1;

    h1 = ROTL64(h1,27); h1 += h2; h1 = h1*5+0x52dce729;

    k2 *= c2; k2  = ROTL64(k2,33); k2 *= c1; h2 ^= k2;

    h2 = ROTL64(h2,31); h2 += h1; h2 = h2*5+0x38495ab5;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*16);

  uint64_t k1 = 0;
  uint64_t k2 = 0;

  switch(len & 15)
  {
  case 15: k2 ^= (uint64_t)(tail[14]) << 48;
  case 14: k2 ^= (uint64_t)(tail[13]) << 40;
  case 13: k2 ^= (uint64_t)(tail[12]) << 32;
  case 12: k2 ^= (uint64_t)(tail[11]) << 24;
  case 11: k2 ^= (uint64_t)(tail[10]) << 16;
  case 10: k2 ^= (uint64_t)(tail[ 9]) << 8;
  case  9: k2 ^= (uint64_t)(tail[ 8]) << 0;
           k2 *= c2; k2  = ROTL64(k2,33); k2 *= c1; h2 ^= k2;

  case  8: k1 ^= (uint64_t)(tail[ 7]) << 56;
  case  7: k1 ^= (uint64_t)(tail[ 6]) << 48;
  case  6: k1 ^= (uint64_t)(tail[ 5]) << 40;
  case  5: k1 ^= (uint64_t)(tail[ 4]) << 32;
  case  4: k1 ^= (uint64_t)(tail[ 3]) << 24;
  case  3: k1 ^= (uint64_t)(tail[ 2]) << 16;
  case  2: k1 ^= (uint64_t)(tail[ 1]) << 8;
  case  1: k1 ^= (uint64_t)(tail[ 0]) << 0;
           k1 *= c1; k1  = ROTL64(k1,31); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len; h2 ^= len;

  h1 += h2;
  h2 += h1;

  h1 = fmix64(h1);
  h2 = fmix64(h2);

  h1 += h2;
  h2 += h1;

  ((uint64_t*)out)[0] = h1;
  ((uint64_t*)out)[1] = h2;
}

//-----------------------------------------------------------------------------


```

### Core Architecture Module: `contrib/murmur3/murmur3.h`
```
//-----------------------------------------------------------------------------
// MurmurHash3 was written by Austin Appleby, and is placed in the
// public domain. The author hereby disclaims copyright to this source
// code.

#ifndef _MURMURHASH3_H_
#define _MURMURHASH3_H_

#include <stdint.h>

//-----------------------------------------------------------------------------

void MurmurHash3_x86_32 (const void *key, int len, uint32_t seed, void *out);

void MurmurHash3_x86_128(const void *key, int len, uint32_t seed, void *out);

void MurmurHash3_x64_128(const void *key, int len, uint32_t seed, void *out);

//-----------------------------------------------------------------------------

#endif // _MURMURHASH3_H_

```

### Core Architecture Module: `scripts/Florida/florida.js`
```
var http = require('http');
var url = require('url');
var fs = require('fs');

// Settings
var port = process.env.DYNOMITE_FLORIDA_PORT ?
    process.env.DYNOMITE_FLORIDA_PORT : 8080;

var apiUrl = process.env.DYNOMITE_FLORIDA_REQUEST ?
    process.env.DYNOMITE_FLORIDA_REQUEST : '/REST/v1/admin/get_seeds';

// Parse command line options
var seedsFilePath = process.argv[2] && process.argv[2].length > 0 ?
        process.argv[2] : '/etc/dynomite/seeds.list';
var enableDebug = process.argv[3] === 'debug' ? true : false;

http.createServer(function(req, res) {
  var path = url.parse(req.url).pathname;
  enableDebug && console.log('Request: ' + path);

  res.writeHead(200, {'Content-Type': 'application/json'});
  if (path === apiUrl) {
    fs.readFile(seedsFilePath, 'utf-8', function(err, data) {
      if (err) console.log(err); 

      var now = (new Date()).toJSON();
      var seeds = data.trim().replace(/\n/g, '|');

      enableDebug && console.log(now + ' - get_seeds [' + seeds + ']');
      res.write(seeds);
      res.end();
    });
  } else {
    res.end();
  }
}).listen(port);

console.log('Server is listening on ' + port);

```

### Core Architecture Module: `scripts/dynomite/dyn_redis_purge.py`
```
#!/usr/bin/env python3

from optparse import OptionParser
import configparser
import logging
import time
import os
import re
import sys
import errno
from datetime import datetime
from datetime import timedelta
import threading
import random
import string

from logging import debug, info, warning, error

import redis

num_conn = 5
dot_rate = 10
current_milli_time = lambda: int(round(time.time() * 1000))
threadLock = threading.Lock()
threads = []
conns = []


class OperationThread (threading.Thread):
    def __init__(self, threadID, name, options):
        threading.Thread.__init__(self)
        self.threadID = threadID
        self.name = name
        self.options = options
        self.filename = options.filename


    def run(self):
        operation = self.options.operation
        host = self.options.host
        port = self.options.port

        print("Starting thread: " + self.name +  ", filename: " + self.filename)

        # Get lock to synchronize threads
        #threadLock.acquire()

        if 'rebalance' == operation :
           rebalance_ops(self.filename, host, port, db=0)


        # Free lock to release next thread
        #threadLock.release()



def get_conns(host, port, db, num):
    for i in range(0, num):
       conns.append(redis.StrictRedis(host, port, db=0))
    return conns

def generate_value(i):
    return payload_prefix + '_' + str(i)


def rebalance_ops(filename, host, port, db):
    conns = get_conns(host, port, db, 2)
    r1 = conns[0]
    i = 0
    for line in open(filename,'r').readlines():
        if line != '':
          print(line)
          line = line.strip('\n')
          if line == '':
            continue
          try:

            value = r1.delete(line)
            #r2.set(line, value)
            i = i + 1
            if (i % 5000 == 0):
              time.sleep(1)
          except redis.exceptions.ResponseError:
            print("reconnecting ...")
            r1 = redis.StrictRedis(host, port, db=0)



def main():
    parser = OptionParser(usage="usage: %prog [options] filename",
                          version="%prog 1.0")
    parser.add_option("-t", "--threads",
                      action="store",
                      dest="th",
                      default="1",
                      help="Number of client threads. Default is 1")
    parser.add_option("-o", "--operation",
                      action="store",
                      dest="operation",
                      default="rebalance",
                      help="Operation to perform: rebalance")
    parser.add_option("-l", "--logfile",
                      action="store",
                      dest="logfle",
                      default="/tmp/dynomite-test.log",
                      help="log file location. Default is /tmp/dynomite-test.log")
    parser.add_option("-H", "--host",
                      action="store",
                      dest="host",
                      default="127.0.0.1",
                      help="targe host ip. Default is 127.0.0.1")
    parser.add_option("-P", "--port",
                      action="store",
                      dest="port",
                      default="8102",
                      help="target port. Default is 8102")
    parser.add_option("-f", "--filename",
                      action="store",
                      dest="filename",
                      default="0",
                      help="target port. Default is 0")



    if len(sys.argv) == 1:
         print("Learn some usages: " + sys.argv[0] + " -h")
         sys.exit(1)


    (options, args) = parser.parse_args()

    print(options)

    num_threads = int(options.th)


    for i in range(0, num_threads):
       if (i != num_threads-1):
          thread = OperationThread(i, "Thread-" + str(i), options)
       else:
          thread = OperationThread(i, "Thread-" + str(i), options)
       #thread = OperationThread(1, "Thread-1", options, 1, 1000)

       thread.start()
       threads.append(thread)

    for t in threads:
       t.join()

    print()


if  __name__ == '__main__':
    main()


```

### Core Architecture Module: `scripts/dynomite/generate_yamls.py`
```
#!/usr/bin/env python3

'''
script for generating dynomite yaml files for every node in a cluster.
This script should be run per rack for all nodes in the rack and so the tokens are equally distributed.
usage: <script> publicIp:rack_name publicIp:rack_name publicIp:rack_name ...
outputs one yaml file per input node(for a single rack)
restric generation of the confs for all hosts per rack and not across rack.
'''

import yaml, sys

APPNAME='dyn_o_mite'
CLIENT_PORT='8102'
DYN_PEER_PORT=8101
MEMCACHE_PORT='11211'
MAX_TOKEN = 4294967295

DEFAULT_DC = 'default_dc'

# generate the equidistant tokens for the number of nodes given. max 4294967295
token_map = dict()
token_item = (MAX_TOKEN // (len(sys.argv) -1))
for i in range(1, len(sys.argv)):
    node = sys.argv[i]
    token_value = (token_item * i)
    if token_value > MAX_TOKEN:
        token_value = MAX_TOKEN

    token_map[node] = token_value

for k,v in token_map.items():
    # get the peers ready, and yank the current one from the dict
    dyn_seeds_map = token_map.copy()
    del dyn_seeds_map[k]
    dyn_seeds = []
    for y,z in dyn_seeds_map.items():
        key = y.split(':')
        dyn_seeds.append(key[0] + ':' + str(DYN_PEER_PORT) + ':' + key[1] + ':' + DEFAULT_DC + ':' + str(z));

    ip_dc = k.split(':');
    data = {
        'listen': '0.0.0.0:' + CLIENT_PORT,
        'timeout': 150000,
        'servers': ['127.0.0.1:' + MEMCACHE_PORT + ':1'],
        'dyn_seed_provider': 'simple_provider',

        'dyn_port': DYN_PEER_PORT,
        'dyn_listen': '0.0.0.0:' + str(DYN_PEER_PORT),
        'datacenter': DEFAULT_DC,
        'rack': ip_dc[1],
        'tokens': v,
        'dyn_seeds': dyn_seeds,
        }

    outer = {APPNAME: data}
    
    file_name = ip_dc[0] + '.yml'
    with open(file_name, 'w') as outfile:
        outfile.write( yaml.dump(outer, default_flow_style=False) )

```

### Core Architecture Module: `scripts/redis/redis-check.py`
```
import redis

range=100
factor=32
port=22121

r = redis.StrictRedis(host='localhost', port=port, db=0)

# lrange
print([r.lrange('lfoo', 0, x) for x in range(1, range)])
print([r.lpush('lfoo', str(x)*factor) for x in range(1, range)])
print([r.lrange('lfoo', 0, x) for x in range(1, range)])
print(r.delete('lfoo'))

# del
print([r.set('foo' + str(x), str(x)*factor) for x in range(1, range)])
keys = ['foo' + str(x) for x in range(1, range)]
print([r.delete(keys) for x in range(1, range)])

# mget
print([r.set('foo' + str(x), str(x)*100) for x in range(1, range)])
keys = ['foo' + str(x) for x in range(1, range)]
print([r.mget(keys) for x in range(1, range)])

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #777** (2021-01-19): **Fragmented queries silently fail cross-region replication**
  *Symptoms*: 1. redis_fragment_argx() is in charge of fragmenting multi commands    (like mset, mget, etc.) as they may belong to different dyno    servers. As part of this, it cuts out multiple small mbufs and    links them to cumulatively make a single node request.     Eg: Assume 2 nodes (NODE1, NODE2)        Query: "MGET key1 key2 key3"        If 'key1' and 'key3' belong to NODE1, there will be 3 mbufs under        the fragmented request sent to NODE1.         MBUF1: *3\r\n$4\r\nMGET\r\n        MBUF2: $4\r\nkey1        MBUF3: $4\r\nkey2         Similarly, the frag'd request for NODE2 will have 2 linked mbufs.         The mbufs are cut from the original request and linked to the        fragmented ones for efficiency, and hence multiple MBUFs.         Now to the problem. Since dynomite has this behavior of encrypting        each individual mbuf, we also need to symmetrically decrypt one        mbuf at a time. However, since the fragmented mbufs are small, they        will be received into one large mbuf which will fail to decrypt        as a whole.         This patch fixes this by making sure all fragmented queries fit into        a single mbuf unless it really needs 2.        TODO: This is less efficient because of copying data around. Switch              back to multiple small MBUFs if the crypto scheme is fixed.  2. Since the fragmented query could also carry with it a key exchange, it    could permanently disable cross-region communication between regi

- **Issue #745** (2019-11-20): **Replicas shouldn't update top level rem-set on final field delete**
  *Symptoms*: This applies to hashmaps, sorted sets and sets.  Consider the following example: If a sorted set in Dynomite has 2 or more items across replicas, but if one of the replicas has a missed update(s) and therefore has only 1 item, removing that item using dynomite previously updated the top level REM set in that replica.  This is incorrect because now trying to read the other (non-deleted) field, would cause read repairs to compare its timestamp against the TS in the top level REM set in the inconsistent replica, and delete the item incorrectly thinking that someone removed the entire map/set/set in that broken replica.  This patch fixes it by not updating the top level REM set for field deletes. Only a DEL will update the top level REM set for maps/sets/zsets.  This was noticed in a TEST cluster.

- **Issue #741** (2019-11-20): **Read-repair enabled messages should update read/write metrics correctly**
  *Symptoms*: The rewritten messages all got tracked as write messages since we didn't adopt the 'is_read' parameter from the original 'msg' object.  Confirmed that reads/writes are correct with this patch.

- **Issue #740** (2019-11-04): **Turning on repairs shouldn't invoke repairs for in-flight queries**
  *Symptoms*: Turning on repairs with constant traffic runs the risk of in-flight queries trying to be repaired. This is incorrect and we should make sure to not take the repair path for these queries.  This was found in a TEST cluster and I confirmed that this patch fixes it.

- **Issue #739** (2019-11-04): **Make scripts auto-cleanup stale metadata if detected**
  *Symptoms*: If we have metadata that exists for a key, but the key itself does not exist, we would previously get an ambiguous response with the status code 'E' but a (nul) value.  This patchset deletes the metadata if this case is detected and returns status code 'X' to denote that the value does not exist.  In normal operation, this ambiguous case should never happen, however, it can happen if read repairs had been disabled and then reenabled with live traffic between them. In this case, we don't want it to crash. This was found in a TEST cluster and I've confirmed that this fixes it.

- **Issue #738** (2019-11-03): **Setup/cleanup (struct msg)->msg_info correctly**
  *Symptoms*: Without proper cleanup, we risk leaking memory and having multiple owners overwriting the same memory.

- **Issue #736** (2019-10-31): **Multiple rspmgrs get assigned the same DC name under DC_EACH_SAFE_QUORUM**
  *Symptoms*: This bug caused some DCs to be ignored, also leading to non-deterministic crashes. This fixes the bug by assuring each rspmgr is assigned the correct name under a request msg.

- **Issue #731** (2019-10-22): **Add ownership information for dnode_peer/server errors and fix cross-…**
  *Symptoms*: …DC checksum logic  When we hit an error trying to connect to a dnode peer or a server, we create an appropriate error message but don't link the respective connection to the error response 'msg'. This is necessary at least for processing DC_EACH_SAFE_QUORUM responses.  Also, checksums for cross-DC messages were not done properly since msg_payload_crc32() only accounted for intra-DC messages. More explained in code comments.

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

### Incident Patch 1: `2046b05e` (2022-10-03)
**Commit Message**: Merge pull request #809 from Netflix/fix/large-payload-crash

Fixes crash on large payloads for MGET/MSET/SCAN

**File**: `.travis.yml` (modified, +8/-2)
```diff
@@ -1,8 +1,14 @@
 language: c
 script: bash ./travis.sh
 
+before_install:
+  - sudo apt remove --purge python3-pip
+  - curl -O https://bootstrap.pypa.io/pip/3.5/get-pip.py
+  - sudo -E python3 get-pip.py
+  - sudo -E python3 -m pip install --upgrade "pip < 22.3"
+  
 addons:
   apt:
+   update: true
    packages:
-   - python3
-   - python3-pip
+   - python3.9
```

**File**: `src/dyn_client.c` (modified, +6/-0)
```diff
@@ -1099,6 +1099,12 @@ void req_recv_done(struct context *ctx, struct conn *conn, struct msg *req,
   if (status != DN_OK) goto error;
 
   status = fragment_query_if_necessary(req, conn, &frag_msgq);
+  if (status == DYNOMITE_PAYLOAD_TOO_LARGE) {
+    dictAdd(conn->outstanding_msgs_dict, &req->id, req);
+    req->nfrag = 0; // Since we failed to fragment the payload, we don't have any fragments for this request
+    goto error;
+  }
+
   if (status != DN_OK) goto error;
 
   status = rewrite_query_with_timestamp_md(&req, ctx);
```

**File**: `src/dyn_message.h` (modified, +4/-0)
```diff
@@ -294,6 +294,7 @@ typedef enum dyn_error {
   BAD_FORMAT,
   DYNOMITE_NO_QUORUM_ACHIEVED,
   DYNOMITE_SCRIPT_SPANS_NODES,
+  DYNOMITE_PAYLOAD_TOO_LARGE,
 } dyn_error_t;
 
 static inline char *dn_strerror(dyn_error_t err) {
@@ -318,6 +319,8 @@ static inline char *dn_strerror(dyn_error_t err) {
       return "Failed to achieve Quorum";
     case DYNOMITE_SCRIPT_SPANS_NODES:
       return "Keys in the script cannot span multiple nodes";
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
+      return "MSET/MGET/SCAN payload too large";
     default:
       return strerror(err);
   }
@@ -329,6 +332,7 @@ static inline char *dyn_error_source(dyn_error_t err) {
     case DYNOMITE_INVALID_STATE:
     case DYNOMITE_NO_QUORUM_ACHIEVED:
     case DYNOMITE_SCRIPT_SPANS_NODES:
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
       return "Dynomite:";
     case PEER_CONNECTION_REFUSE:
     case PEER_HOST_DOWN:
```

**File**: `src/proto/dyn_redis.c` (modified, +8/-6)
```diff
@@ -3030,7 +3030,9 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
   }
 
   p = mbuf->pos;
-  ASSERT(*p == '$');
+  if (*p != '$') {
+    return DYNOMITE_PAYLOAD_TOO_LARGE;
+  }
   p++;
 
   if (p[0] == '-' && p[1] == '1') {
@@ -3044,7 +3046,7 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
     }
     len += CRLF_LEN * 2;
     len += (p - mbuf->pos);
-  }
+  } 
   bytes = len;
 
   /* copy len bytes to dst */
@@ -3378,7 +3380,7 @@ static rstatus_t redis_append_key(struct msg *r, struct keypos *kpos_src) {
  *   +--------------------+     +---------------------+ +----+----------------+
  *   |   frag_id = 10     |     |   frag_id = 10      |     |   frag_id = 10 |
  *   |     nfrag = 3      |     |      nfrag = 0      |     |      nfrag = 0 |
- *   | frag_seq = x x x   |     |     key1, key3      |     |         key2 |
+ *   | frag_seq = x x x   |     |     key1, key3      |     |         key2   |
  *   +------------|-|-|---+     +---------------------+ +---------------------+
  *                | | |          ^    ^                          ^
  *                | \ \          |    |                          |
@@ -3506,21 +3508,21 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
       TAILQ_INSERT_TAIL(frag_msgq, sub_msg, m_tqe);
     }
 
-    status = redis_append_key(sub_msg, kpos);
+    status = redis_append_key(sub_msg, kpos); // Adds key to the sub_msg
     if (status != DN_OK) {
       dn_free(sub_msgs);
       return status;
     }
     if (key_step == 1) { // mget,del
       continue;
     } else {                                    // mset
-      status = redis_copy_bulk(NULL, r, false); // eat key
+      status = redis_copy_bulk(NULL, r, false); // Consumes key portion of the payload
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
       }
 
-      status = redis_copy_bulk(sub_msg, r, false);
+      status = redis_copy_bulk(sub_msg, r, false); // Consumes and copies value to the sub_msg fragment
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
```

---

### Incident Patch 2: `9042cde6` (2022-07-31)
**Commit Message**: Fix pip version

**File**: `.travis.yml` (modified, +4/-2)
```diff
@@ -2,11 +2,13 @@ language: c
 script: bash ./travis.sh
 
 before_install:
-  - sudo pip3 install --upgrade pip
+  - sudo apt remove --purge python3-pip
+  - curl -O https://bootstrap.pypa.io/pip/3.5/get-pip.py
+  - sudo -E python3 get-pip.py
+  - sudo -E python3 -m pip install --upgrade "pip < 22.3"
   
 addons:
   apt:
    update: true
    packages:
    - python3.9
-   - python3-pip
```

---

### Incident Patch 3: `bc78f1f9` (2022-07-19)
**Commit Message**: Fixes crash on large payloads for MGET/MSET/SCAN

Updates python version to 3.9

Updates pip version

Update travis.sh

Adds apt update before package installation

Force pip upgrade

**File**: `.travis.yml` (modified, +5/-1)
```diff
@@ -1,8 +1,12 @@
 language: c
 script: bash ./travis.sh
 
+before_install:
+  - sudo pip3 install --upgrade pip
+  
 addons:
   apt:
+   update: true
    packages:
-   - python3
+   - python3.9
    - python3-pip
```

**File**: `src/dyn_client.c` (modified, +6/-0)
```diff
@@ -1099,6 +1099,12 @@ void req_recv_done(struct context *ctx, struct conn *conn, struct msg *req,
   if (status != DN_OK) goto error;
 
   status = fragment_query_if_necessary(req, conn, &frag_msgq);
+  if (status == DYNOMITE_PAYLOAD_TOO_LARGE) {
+    dictAdd(conn->outstanding_msgs_dict, &req->id, req);
+    req->nfrag = 0; // Since we failed to fragment the payload, we don't have any fragments for this request
+    goto error;
+  }
+
   if (status != DN_OK) goto error;
 
   status = rewrite_query_with_timestamp_md(&req, ctx);
```

**File**: `src/dyn_message.h` (modified, +4/-0)
```diff
@@ -294,6 +294,7 @@ typedef enum dyn_error {
   BAD_FORMAT,
   DYNOMITE_NO_QUORUM_ACHIEVED,
   DYNOMITE_SCRIPT_SPANS_NODES,
+  DYNOMITE_PAYLOAD_TOO_LARGE,
 } dyn_error_t;
 
 static inline char *dn_strerror(dyn_error_t err) {
@@ -318,6 +319,8 @@ static inline char *dn_strerror(dyn_error_t err) {
       return "Failed to achieve Quorum";
     case DYNOMITE_SCRIPT_SPANS_NODES:
       return "Keys in the script cannot span multiple nodes";
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
+      return "MSET/MGET/SCAN payload too large";
     default:
       return strerror(err);
   }
@@ -329,6 +332,7 @@ static inline char *dyn_error_source(dyn_error_t err) {
     case DYNOMITE_INVALID_STATE:
     case DYNOMITE_NO_QUORUM_ACHIEVED:
     case DYNOMITE_SCRIPT_SPANS_NODES:
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
       return "Dynomite:";
     case PEER_CONNECTION_REFUSE:
     case PEER_HOST_DOWN:
```

**File**: `src/proto/dyn_redis.c` (modified, +8/-6)
```diff
@@ -3030,7 +3030,9 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
   }
 
   p = mbuf->pos;
-  ASSERT(*p == '$');
+  if (*p != '$') {
+    return DYNOMITE_PAYLOAD_TOO_LARGE;
+  }
   p++;
 
   if (p[0] == '-' && p[1] == '1') {
@@ -3044,7 +3046,7 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
     }
     len += CRLF_LEN * 2;
     len += (p - mbuf->pos);
-  }
+  } 
   bytes = len;
 
   /* copy len bytes to dst */
@@ -3378,7 +3380,7 @@ static rstatus_t redis_append_key(struct msg *r, struct keypos *kpos_src) {
  *   +--------------------+     +---------------------+ +----+----------------+
  *   |   frag_id = 10     |     |   frag_id = 10      |     |   frag_id = 10 |
  *   |     nfrag = 3      |     |      nfrag = 0      |     |      nfrag = 0 |
- *   | frag_seq = x x x   |     |     key1, key3      |     |         key2 |
+ *   | frag_seq = x x x   |     |     key1, key3      |     |         key2   |
  *   +------------|-|-|---+     +---------------------+ +---------------------+
  *                | | |          ^    ^                          ^
  *                | \ \          |    |                          |
@@ -3506,21 +3508,21 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
       TAILQ_INSERT_TAIL(frag_msgq, sub_msg, m_tqe);
     }
 
-    status = redis_append_key(sub_msg, kpos);
+    status = redis_append_key(sub_msg, kpos); // Adds key to the sub_msg
     if (status != DN_OK) {
       dn_free(sub_msgs);
       return status;
     }
     if (key_step == 1) { // mget,del
       continue;
     } else {                                    // mset
-      status = redis_copy_bulk(NULL, r, false); // eat key
+      status = redis_copy_bulk(NULL, r, false); // Consumes key portion of the payload
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
       }
 
-      status = redis_copy_bulk(sub_msg, r, false);
+      status = redis_copy_bulk(sub_msg, r, false); // Consumes and copies value to the sub_msg fragment
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
```

---

### Incident Patch 4: `6ff2ddd6` (2021-01-19)
**Commit Message**: Merge pull request #777 from smukil/fix_frag_cmds

Fragmented queries silently fail cross-region replication

**File**: `src/dyn_client.c` (modified, +2/-0)
```diff
@@ -235,6 +235,8 @@ static void client_close(struct context *ctx, struct conn *conn) {
  */
 static rstatus_t client_handle_response(struct context *ctx, struct conn *conn, msgid_t reqid,
                                         struct msg *rsp) {
+
+
   // now the handler owns the response.
   ASSERT(conn->type == CONN_CLIENT);
   // Fetch the original request
```

**File**: `src/dyn_mbuf.c` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@ static uint64_t mbuf_alloc_count = 0;
 
 uint64_t mbuf_alloc_get_count(void) { return mbuf_alloc_count; }
 
+size_t mbuf_chunk_sz() { return mbuf_chunk_size; }
+
 static struct mbuf *_mbuf_get(void) {
   struct mbuf *mbuf;
   uint8_t *buf;
```

**File**: `src/dyn_mbuf.h` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ static inline bool mbuf_full(struct mbuf *mbuf) {
   return mbuf->last == mbuf->end ? true : false;
 }
 
+size_t mbuf_chunk_sz();
+
 void mbuf_init(size_t mbuf_chunk_size);
 void mbuf_deinit(void);
 struct mbuf *mbuf_get(void);
```

**File**: `src/proto/dyn_redis.c` (modified, +79/-49)
```diff
@@ -3053,7 +3053,19 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
       log_notice("dumping mbuf");
       mbuf_dump(mbuf);
     }
-    if (mbuf_length(mbuf) <= len) { /* steal this buf from src to dst */
+
+    size_t remaining_mbuf_len = mbuf_length(mbuf);
+    if (remaining_mbuf_len <= len &&
+        remaining_mbuf_len == mbuf_chunk_sz()) {
+      // Steal the entire buffer from src to dst if we need the whole buffer
+      //
+      // We only copy if it's the entire buffer because of the way our
+      // encryption/decryption works. Sending out multiple partially filled
+      // mbufs will fail to decrypt on the receiving side. This is because
+      // in the source side we encrypt each mbuf seperately but if all the
+      // partial mbufs can fit into one full mbuf on the receiving side,
+      // it will do so and hence fail to decrypt.
+      // TODO: Change this when the whole broken crypto scheme is changed.
       nbuf = STAILQ_NEXT(mbuf, next);
       mbuf_remove(&src->mhdr, mbuf);
       if (dst != NULL) {
@@ -3419,33 +3431,90 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
   r->nfrag = 0;
   r->frag_owner = r;
 
-  for (i = 0; i < array_n(r->keys); i++) { /* for each key */
-    struct msg *sub_msg;
+  // Calculate number of tokens per participating peer.
+  // We need to know the total number of tokens before proceeding with
+  // crafting each peer's command since we're trying to fit as much as
+  // possible into one MBUF and not split them for convenience.
+  // TODO: This is the case because of our broken crypto scheme. Change once
+  // that is fixed.
+  for (i = 0; i < array_n(r->keys); i++) {
     struct keypos *kpos = array_get(r->keys, i);
     // use hash-tagged start and end for forwarding.
     uint32_t idx = dnode_peer_idx_for_key_on_rack(
         pool, rack, kpos->tag_start, kpos->tag_end - kpos->tag_start);
-
     if (sub_msgs[idx] == NULL) {
       sub_msgs[idx] = msg_get(r->owner, r->is_request, __FUNCTION__);
       if (sub_msgs[idx] == NULL) {
         dn_free(sub_msgs);
         return DN_ENOMEM;
       }
+
+      // Every 'sub_msg' is counted as one fragment.
+      r->nfrag++;
+    }
+
+    // One token for the key
+    sub_msgs[idx]->ntokens++;
+
+    // One token for the value (eg: for MSET)
+    if (key_step != 1) sub_msgs[idx]->ntokens++;
+    r->frag_seq[i] = sub_msgs[idx];
+
+    loga("frag_seq[%d]: %x   ||  idx: %d sub_msgs[idx]: %x", i,
+        r->frag_seq[i], idx, sub_msgs[idx]);
+
+  }
+
+  for (i = 0; i < array_n(r->keys); i++) { /* for each key */
+    struct msg *sub_msg;
+    struct keypos *kpos = array_get(r->keys, i);
+    // use hash-tagged start and end for forwarding.
+    uint32_t idx = dnode_peer_idx_for_key_on_rack(
+        pool, rack, kpos->tag_start, kpos->tag_end - kpos->tag_start);
+
+    // We already created the 'sub_msg' in the previous loop.
+    ASSERT(sub_msgs[idx] != NULL);
+    sub_msg = sub_msgs[idx];
+
+    if (STAILQ_EMPTY(&sub_msg->mhdr)) {
+      if (r->type == MSG_REQ_REDIS_MGET) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$4\r\nmget\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_DEL) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$3\r\ndel\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_EXISTS) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$6\r\nexists\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_MSET) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$4\r\nmset\r\n",
+                                    sub_msg->ntokens + 1);
+      } else {
+        NOT_REACHED();
+      }
+      if (status != DN_OK) {
+        dn_free(sub_msgs);
+        return status;
+      }
+
+      sub_msg->type = r->type;
+      sub_msg->frag_id = r->frag_id;
+      sub_msg->fr
```

---

### Incident Patch 5: `3f5c823a` (2021-01-19)
**Commit Message**: Merge branch 'dev' into fix_frag_cmds

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 # Dynomite 
 
-[![Build Status](https://secure.travis-ci.org/Netflix/dynomite.png)](http://travis-ci.org/Netflix/dynomite)
+[![Build Status](https://travis-ci.com/Netflix/dynomite.svg)](http://travis-ci.com/Netflix/dynomite)
 [![Dev chat at https://gitter.im/Netflix/dynomite](https://badges.gitter.im/Netflix/dynomite.svg)](https://gitter.im/Netflix/dynomite?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
 [![Apache V2 License](http://img.shields.io/badge/license-Apache%20V2-blue.svg)](https://github.com/Netflix/dynomite/blob/dev/LICENSE)
 
```

---

### Incident Patch 6: `5398600d` (2019-11-20)
**Commit Message**: Merge pull request #745 from smukil/fix_hdel_repair_script

Replicas shouldn't update top level rem-set on final field delete

**File**: `src/proto/dyn_proto_repair.h` (modified, +1/-2)
```diff
@@ -211,7 +211,7 @@
   "  return ret\n"\
   "end\n\r\n"
 
-#define HDEL_SCRIPT "$4\r\nEVAL\r\n$1175\r\n"\
+#define HDEL_SCRIPT "$4\r\nEVAL\r\n$1122\r\n"\
   "local key = KEYS[1]\n"\
   "local top_level_add_set = KEYS[2]\n"\
   "local top_level_rem_set = KEYS[3]\n"\
@@ -248,7 +248,6 @@
   "end\n\n"\
   "local card = redis.call('ZCARD', rem_set)\n"\
   "if (card == 0) then\n"\
-  "  redis.call('ZADD', top_level_add_set, cur_ts, key)\n"\
   "  redis.call('ZREM', top_level_rem_set, key)\n"\
   "end\n\n"\
   "return ret\n\r\n"
```

---

### Incident Patch 7: `8464a609` (2019-11-04)
**Commit Message**: Merge pull request #740 from smukil/in_flight_nonrepairable_crash_fix

Turning on repairs shouldn't invoke repairs for in-flight queries

**File**: `src/proto/dyn_redis_repair.c` (modified, +4/-0)
```diff
@@ -867,6 +867,10 @@ rstatus_t redis_make_repair_query(struct context *ctx, struct response_mgr *rspm
   bool repair_by_add = false;
   uint32_t num_values = 0;
 
+  // If we enabled read repairs halfway, in flight commands will not be
+  // repairable.
+  if (rspmgr->msg->orig_msg == NULL) return DN_OK;
+
   // Redis commands either lookup keys or fields (secondary keys), so the number of
   // expected values would be based on either one of them.
   if (rspmgr->msg->orig_msg->msg_info.num_fields > 0) {
```

---

### Incident Patch 8: `b394564f` (2019-10-31)
**Commit Message**: Merge pull request #736 from smukil/fix_bad_return_each_quorum

Multiple rspmgrs get assigned the same DC name under DC_EACH_SAFE_QUORUM

**File**: `src/dyn_response_mgr.c` (modified, +1/-1)
```diff
@@ -24,13 +24,13 @@ rstatus_t init_response_mgr_all_dcs(struct context *ctx, struct msg *req,
   // Initialize the response managers for all remote DCs. (The 0th idx in the
   // 'additional_each_rspmgrs' array is reserved for the local DC).
   int i;
+  uint32_t dc_idx = 0;
   for (i = 1; i < num_dcs_in_quorum; ++i) {
     req->additional_each_rspmgrs[i] = (struct rspmgr*) dn_alloc(sizeof(struct response_mgr));
     if (req->additional_each_rspmgrs[i] == NULL) {
       goto enomem;
     }
 
-    uint32_t dc_idx = 0;
     struct datacenter *remote_dc = NULL;
     do {
       remote_dc = (struct datacenter*) array_get(&ctx->pool.datacenters, dc_idx);
```

---

### Incident Patch 9: `1687c38c` (2019-10-22)
**Commit Message**: Add ownership information for dnode_peer/server errors and fix cross-DC checksum logic

When we hit an error trying to connect to a dnode peer or a server,
we create an appropriate error message but don't link the respective
connection to the error response 'msg'. This is necessary at least for
processing DC_EACH_SAFE_QUORUM responses.

Also, checksums for cross-DC messages were not done properly since
msg_payload_crc32() only accounted for intra-DC messages. More explained
in code comments.

**File**: `src/dyn_client.c` (modified, +5/-1)
```diff
@@ -1230,6 +1230,7 @@ static struct msg *all_rspmgrs_get_response(struct context *ctx, struct msg *req
       continue;
     } else {
       ASSERT(rsp->is_error == false);
+
       // If the DCs we've processed so far have not seen errors, we need to
       // make sure that the remaining DCs don't have errors too.
       dc_rsp = rspmgr_get_response(ctx, rspmgr);
@@ -1259,11 +1260,14 @@ static struct msg *all_rspmgrs_get_response(struct context *ctx, struct msg *req
 static rstatus_t msg_each_quorum_rsp_handler(struct context *ctx, struct msg *req,
     struct msg *rsp) {
 
-  if (all_rspmgrs_done(ctx, req->additional_each_rspmgrs)) return swallow_extra_rsp(req, rsp);
+  if (all_rspmgrs_done(ctx, req->additional_each_rspmgrs)) {
+    return swallow_extra_rsp(req, rsp);
+  }
 
   int rspmgr_idx = -1;
   struct conn *rsp_conn = rsp->owner;
   if (rsp_conn == NULL) {
+    // TODO: We should remove this case. Test and confirm.
     rspmgr_idx = 0;
   } else if (rsp_conn->type == CONN_DNODE_PEER_SERVER) {
     struct node *peer_instance = (struct node*) rsp_conn->owner;
```

**File**: `src/dyn_dnode_peer.c` (modified, +1/-0)
```diff
@@ -316,6 +316,7 @@ static void dnode_peer_ack_err(struct context *ctx, struct conn *conn,
   rsp->dyn_error_code = req->dyn_error_code = PEER_CONNECTION_REFUSE;
   rsp->dmsg = dmsg_get();
   rsp->dmsg->id = req->id;
+  rsp->owner = conn;
 
   log_info("%s Closing req %u:%u len %" PRIu32 " type %d %c %s",
            print_obj(conn), req->id, req->parent_id, req->mlen, req->type,
```

**File**: `src/dyn_message.c` (modified, +5/-0)
```diff
@@ -833,6 +833,11 @@ uint32_t msg_payload_crc32(struct msg *rsp) {
      the beginning of the first mbuf */
   bool start_found = rsp->dmsg ? false : true;
 
+  // If the message is from another DC, the mbufs will have the decrypted
+  // payload without the Dynomite header, so we do have the start.
+  // rsp->dmsg->payload for cross DC msgs will have the encrypted payload.
+  if (rsp->dmsg && !rsp->owner->same_dc) start_found = true;
+
   STAILQ_FOREACH(mbuf, &rsp->mhdr, next) {
     uint8_t *start = mbuf->start;
     uint8_t *end = mbuf->last;
```

**File**: `src/dyn_server.c` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ static void server_ack_err(struct context *ctx, struct conn *conn,
   rsp->error_code = req->error_code = conn->err;
   rsp->dyn_error_code = req->dyn_error_code = STORAGE_CONNECTION_REFUSE;
   rsp->dmsg = NULL;
+  rsp->owner = conn;
   log_debug(LOG_DEBUG, "%s <-> %s", print_obj(req), print_obj(rsp));
 
   log_info("close %s req %s len %" PRIu32 " from %s %c %s", print_obj(conn),
```

---

### Incident Patch 10: `7747c05c` (2019-10-16)
**Commit Message**: Merge pull request #721 from smukil/fix_msg_leak_for_each_safe_quorum

Fix msg leak with DC_EACH_SAFE_QUORUM

**File**: `src/dyn_client.c` (modified, +2/-4)
```diff
@@ -655,10 +655,8 @@ rstatus_t req_forward_to_peer(struct context *ctx, struct conn *c_conn,
   }
 
   if (!(same_dc && same_rack) || force_swallow) {
-    if (req->consistency != DC_EACH_SAFE_QUORUM || force_swallow) {
-      // Swallow responses from remote racks or DCs.
-      rack_msg->swallow = true;
-    }
+    // Swallow responses from remote racks or DCs.
+    rack_msg->swallow = true;
   }
 
   // Get a connection to the node.
```

#### Recent Merged Pull Requests:
- **PR #832** (closed): dyn_client: fix 'occured' -> 'occurred' typos in rewrite helper comments (@SAY-5)
- **PR #811** (closed): Fixes crash on large payloads for MGET/MSET/SCAN (@akashdeepgoel)
- **PR #809** (2022-10-03): Fixes crash on large payloads for MGET/MSET/SCAN (@akashdeepgoel)
- **PR #787** (2021-01-20): Update v0.6 branch with latest fixes/improvements (@smukil)
- **PR #786** (2021-01-20): Allow logs to be read by others (@smukil)
- **PR #785** (2021-01-19): Add log level for dyn_crypto hex dumps (@bryanck)
- **PR #783** (2020-11-17): Update build status location (@sghill)
- **PR #777** (2021-01-19): Fragmented queries silently fail cross-region replication (@smukil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
