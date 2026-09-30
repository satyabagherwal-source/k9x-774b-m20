# Forensic Learning Record (Deep Inspection): RediSearch/RediSearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:52.596Z  
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

### Core Architecture Module: `deps/cndict/bundle_friso.py`
```
#!/usr/bin/env python

"""
This script gathers settings and dictionaries from friso (a chinese
tokenization library) and generates a C source file that can later be
compiled into RediSearch, allowing the module to have a built-in chinese
dictionary. By default this script will generate a C source file of
compressed data but there are other options to control output (mainly for
debugging).

The `read_friso` script can be used to analyze the dumped data for debugging
purposes
"""

import zlib
import errno
import os
import re
import struct
import sys
import time
import string
from argparse import ArgumentParser

# Load the ini file
ap = ArgumentParser()
ap.add_argument('-i', '--ini', default='friso/friso.ini',
                help='ini file to use for initialization')
ap.add_argument('-m', '--mode', default='c', help='output mode',
                choices=['c', 'raw_z', 'raw_u'])
ap.add_argument('-d', '--dir', default='.',
                help='Override directory of lex files')
ap.add_argument('-o', '--out', help='Name of destination directory',
                default='cndict_generated')

opts = ap.parse_args()

lexdir = opts.dir

DICT_VARNAME = 'ChineseDict'
SIZE_COMP_VARNAME = 'ChineseDictCompressedLength'
SIZE_FULL_VARNME = 'ChineseDictFullLength'


class ConfigEntry(object):
    def __init__(self, srcname, dstname, pytype):
        self.srcname = srcname
        self.dstname = dstname
        self.pytype = pytype
        self.value = None

configs = [
    ConfigEntry('max_len', 'max_len', int),
    ConfigEntry('r_name', 'r_name', int),
    ConfigEntry('mix_len', 'mix_len', int),
    ConfigEntry('lna_len', 'lna_len', int),
    ConfigEntry('add_syn', 'add_syn', int),
    ConfigEntry('clr_stw', 'clr_stw', int),
    ConfigEntry('keep_urec', 'keep_urec', int),
    ConfigEntry('spx_out', 'spx_out', int),
    ConfigEntry('nthreshold', 'nthreshold', int),
    ConfigEntry('mode', 'mode', int),
    ConfigEntry('charset', 'charset', int),
    ConfigEntry('en_sseg', 'en_sseg', int),
    ConfigEntry('st_minl', 'st_minl', int),
    ConfigEntry('kpuncs', 'kpuncs', str)
]


def write_config_init(varname, configs):
    ret = []
    for config in configs:
        if config.value is None:
            continue
        if config.srcname == 'mode':
            ret.append('friso_set_mode({},{});'.format(varname, config.value))
        elif config.dstname == 'kpuncs':
            ret.append('strcpy({}->kpuncs, "{}");'.format(varname, config.value))
        elif config.dstname == 'charset':
            pass
            # Skip
        elif config.pytype == int:
            ret.append('{}->{} = {};'.format(varname, config.dstname, config.value))
        else:
            raise ValueError("Don't understand config!", config)

    return ret


def set_key_value(name, value):
    for config in configs:
        name = name.lower().replace("friso.", "").strip()
        # print name, config.srcname
        if config.srcname == name:
            config.value = config.pytype(value)
            return
    raise ValueError('Bad config key', name)


with open(opts.ini, 'r') as fp:
    for line in fp:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, value = line.split('=')
        key = key.strip()
        value = value.strip()
        if key == 'friso.lex_dir':
            if not lexdir:
                lexdir = value
        else:
            set_key_value(key, value)


# Parse the header snippet in order to emit the correct constant.
_LEXTYPE_MAP_STRS = \
r'''
    __LEX_CJK_WORDS__ = 0,
    __LEX_CJK_UNITS__ = 1,
    __LEX_ECM_WORDS__ = 2,    //english and chinese mixed words.
    __LEX_CEM_WORDS__ = 3,    //chinese and english mixed words.
    __LEX_CN_LNAME__ = 4,
    __LEX_CN_SNAME__ = 5,
    __LEX_CN_DNAME1__ = 6,
    __LEX_CN_DNAME2__ = 7,
    __LEX_CN_LNA__ = 8,
    __LEX_STOPWORDS__ = 9,
    __LEX_ENPUN_WORDS__ = 10,
    __LEX_EN_WORDS__ = 11,
    __LEX_OTHER_WORDS__ = 15,
    __LEX_NCSYN_WORDS__ = 16,
    __LEX_PUNC_WORDS__ = 17,        //punctuations
    __LEX_UNKNOW_WORDS__ = 18        //unrecognized words.
'''
LEXTYPE_MAP = {}
for m in re.findall('\s*(__[^=]*__)\s*=\s*([\d]*)', _LEXTYPE_MAP_STRS):
    LEXTYPE_MAP[m[0]] = int(m[1])

# Lex type currently occupies
TYPE_MASK = 0x1F
F_SYNS = 0x01 << 5
F_FREQS = 0x02 << 5


class LexBuffer(object):
    # Size of input buffer before flushing to a zlib block
    CHUNK_SIZE = 65536
    VERSION = 0

    def __init__(self, fp, use_compression=True):
        self._buf = bytearray()
        self._fp = fp
        self._compressor = zlib.compressobj(-1)
        self._use_compression = use_compression

        # Write the file header
        self._fp.write(struct.pack("!I", self.VERSION))
        self._fp.flush()
        self.compressed_size = 0
        self.full_size = 4 # For the 'version' byte

    def _write_data(self, data):
        self._fp.write(data)
        self.compressed_size += len(data)

    def flush(self, is_final=False):
        if not self._use_compression:
            self._write_data(self._buf)
        else:
            # Flush any outstanding data in the buffer
            self._write_data(self._compressor.compress(bytes(self._buf)))

            if is_final:
                self._write_data(self._compressor.flush(zlib.Z_FINISH))

        self._fp.flush()
        self.full_size += len(self._buf)
        self._buf = bytearray()

    def _maybe_flush(self):
        if len(self._buf) > self.CHUNK_SIZE:
            self.flush()

    def add_entry(self, lextype, term, syns, freq):
        # Perform the encoding...
        header = LEXTYPE_MAP[lextype]

        if syns:
            header |= F_SYNS
        if freq:
            header |= F_FREQS

        self._buf.append(header)
        self._buf += term
        self._buf.append(0) # NUL terminator

        if syns:
            self._buf += struct.pack("!h", len(syns))
            for syn in syns:
                self._buf += syn
                self._buf.append(0)
        if freq:
            self._buf += struct.pack("!I", freq)

        self._maybe_flush()


def encode_pair(c):
    if c in string.hexdigits:
        return '\\x{0:x}'.format(ord(c))
    elif c in ('"', '\\', '?'):
        return '\\' + c
    else:
        return repr('%c' % (c,))[1:-1]
    # return '\\x{0:x}'.format(ord(c)) if _needs_escape(c) else c


class SourceEncoder(object):
    LINE_LEN = 40

    def __init__(self, fp):
        self._fp = fp
        self._curlen = 0

    def write(self, blob):
        blob = buffer(blob)
        while len(blob):
            chunk = buffer(blob, 0, self.LINE_LEN)
            blob = buffer(blob, len(chunk), len(blob)-len(chunk))
            encoded = ''.join([encode_pair(c) for c in chunk])
            self._fp.write('"' + encoded + '"\n')

        return len(blob)

    def flush(self):
        self._fp.flush()

    def close(self):
        pass


def process_lex_entry(type, file, buf):
    print type, file
    fp = open(file, 'r')
    for line in fp:
        line = line.strip()
        comps = line.split('/')
        # print comps
        term = comps[0]
        syns = comps[1].split(',') if len(comps) > 1 else []
        if len(syns) == 1 and syns[0].lower() == 'null':
            syns = []
        freq = int(comps[2]) if len(comps) > 2 else 0

        buf.add_entry(type, term, syns, freq)
        # print "Term:", term, "Syns:", syns, "Freq", freq
        # Now dump it, somehow


def strip_comment_lines(blob):
    lines = [line.strip() for line in blob.split('\n')]
    lines = [line for line in lines if line and not line.startswith('#')]
    return lines


def sanitize_file_entry(typestr, filestr):
    typestr = strip_comment_lines(typestr)[0]
    filestr = strip_comment_lines(filestr)
    filestr = [f.rstrip(';') for f in filestr]
    return typestr, filestr


lexre = re.compile(r'([^:]+)\w*:\w*\[([^\]]*)\]', re.MULTILINE)
lexindex = os.path.join(lexdir, 'friso.lex.ini')
lexinfo = open(lexindex, 'r').read()
ma
```

### Core Architecture Module: `deps/cndict/cndict_data.c`
```

// Compressed chinese dictionary
// Generated by bundle_friso.py -i friso.ini -d lex -o .
// at Thu Nov 16 08:38:35 2017
#include "friso/friso.h"
#include <stdlib.h>
#include <string.h>
const char ChineseDict[] =
"\x00\x00\x00\x00"
"x\x9ct\xbd\xdbV\xeb<\xb3-:\xe7\x9b\xccG\xd8\xeb\x62_\xec\xb7#\x84\x10l\x93\x13\t\x04H\xc2\x39\xc0`@\x0e\x10 \x07\x92"
"\xbc\xcb\xde\xb1l_\xedWXUV\xef\xb2\xf8\xfeo\xb5\x36\xda\xe8\xd5\x95\xe0\xd8\xb2T\xaa*\x95\xa4\xff\xd9\xcd\xf7\xfe\xdfn\xb4[v"
"v\x8b\xc1\x7f\xfd\xd7\x7f\xff\xaf\xff\xeb\xff\xfe\x7f\xfe\xeb\xbf\xa4P\xfe\x11\xe3\xf1\"^v\xc8\xcc\xf9M<\x39\x00+\xed\xe6\xb5\xf4\xe9\xd0"
"g\x63\xc7\x92\xfd\x85'\xc6\x07\xdb\xff\xfa\x9f\x9cU\xf5wr\xc8i\x44\xd4oP|k\x42\xac\xc5\xa5KO\xdc-\x8f\x45\xd8\xfd\xb4P"
"\xd6\x8e\x1f.\xd3\xf2\x1a\xec\x8c\xb8[\x44Y\x8f\x37y\x96,_ \x9e\xeb\xe3\xdc\xb7\x1c[\x44\xe9{\x00\xd6\x03\xf6\xe5\xfft\xc8[\x19"
"\x10\xf5\xd1\xc7\x7f\x0bV\x33\xc7\xfb\x1eK\x96\xf2\x17q\xed\xd4\xf4\x9f\xf5\xb3\xab\xae\xf7Y\x1a]\x83=\xc4\x8d\x61:\xe6\x35yW/\xbf"
"\xc4\xb7\xb8\xb7\x36\x9dm\xf2v\xe6\x97m\xcb\x8e-\x97\x14\xe3\xf0\xdd\x13\x8b\xfa{\x89\x1bG\xbf\x7f!\xfe\x9e\x99\xfa\xb1\x89jZ\x8d\xed"
"\x9a+\xde\x96\x93\xfe\x8f\xf7\x87\xa6>\xfc\xfd\x87\xe6l\x91\r\xee\x1c\xbb\xf9\xa6\x98\x36\x07q\xad\x8f\xcb\x0cX\xa5oZ\xc1\x8d\tY\\"
"y\xde\xfd\\:V\xbf\x8e\x8f.\xc0x\xe7\xef\xc9\xd2^>\xae\xf0\xda\x1b\xa2\x96\x86\xcf\x05{\xd8m\xb6\x1e\x8b\x37\xac\xe5M\\+g"
"\xd5\x63\xc7\x1e.\xbd\xcf\xccQ\x33\x0e\xaf}\xd6\xac\x39\x16\x44\xfa\x62\xc3\xd3\xf4\xeb\xc3/[\x44q\x88\x82\x85|\x63\x99t.\xc9\xe2\xef"
"w\x8f\xa5\x93v\xc1\x06\x44\xfd\xc7\x0e\x04V\xf6\xd9\xf2\xd8\x63q\xe5\xcd\x63\xff\xff\xcf\x98,\xae\xfc\xf5\xfeN\x98\xfc\x03{\xb4\xb8<\x94"
"\x07\x37\xe7u\xb2\xe4\x62#\xff{,^\xb7\xc1\"\xa2\xe9\xdeH\x1d\x80\x1d\x13\xe5\x07\xd2m\xd3\xd5\xf6\xf2X\x7f|\x19\xc5\x8dsWP"
"+\xc5\x8b\x19XG_M\xad\x04\xd6#\xba\xb6\xb9\xecI_\xd8\xadQ\xcf\xcb\x11\x90\x9f.\xf3Z\x8d|\xb6|p\xec\xe7&\xbd\xc8\xab"
"\xb4jY<\xba\xe2g\xb9\n\x88 \xbbg[\xca\xdb\xceJ\xff\xc1\xb2\xf9m\x12\xbe\xc6\xb5j\xfc\xf0\x87\x9f%\rT\xf6\x12-i\x15"
"\x11\xb5k\x34\xd0\xe9V\x35\xd3}Jgx\x15\xab{\xa2{\x84\xd5}<\xea\xa6U\xf7\x81\x39\x9bx\x9f\x99\xe1\xb7y\xbe%\xcb\xee\xeb"
"\xe6\xb3\xe4\xd8O\xbd\xf8\xbb\xa1<\x84\xab\xc7\xd5P~Q\xea\x02\xec\x8b\x18\xff\x34 \xa2\x87\xacV@(\xbe\x9f\x0b\xa2\xbb\x87\x9f\x0b\xd7"
"\xab\xd9\x01\x7f.\x8b\xa2\x1b\xf7\xa3|G\xac\xccu[z\x96\xeb\xf2rw\xc7\xa8\x92u/\xae.\xad\x8e\x95\xe6\"\xcc\xab\xd7\r\xeey"
"\x33\x90js\xb7\xbby\"\xba\x8b\xa0\xff\xc6{\x35\xe0\xedn\x1e\xc4\x8d\x05\x99\x36\xd9\x13\xdb(\xe3R\x83\xa8\xfd\xec\xa9\x04\xd6\xb7\xb8_"
"\xd9\xfdt\xe3\x93\x15tG\x99\xc8\x9f\x12QtW\xf2\x1c\x91\xa5\xa3%\xc5\xec\xb0\n\xf1\x10xI\xd4!\xe5\xe8\x0b\xec\xcd\x0e\x8d`S"
"\xe0\xa7\xc5\x43\xdc\xe6\x61\x8d\x18\xff,\xd3I\x99,\x1d\xcf\xd8\x33\xe3\xc3\x8f\xb4\xdcOg\xd7\x64Y\xef\x98\xe3S|h_j\\\xc5\xbd"
"TW\xc4\xb8\x32\x34\x33\xdb\xf4\xe3\xa3=\xa2\xbc\x1es\xf6\xe6\xb3\xd1'Y|\x84\x07;:$\x8a\xf2\x62\x37\x17\xc6\x81U\x44\xd3\xf9J"
"\xeb\xdf\x64\xe9\xdei\xbawN\x96\x9d\\\x17\xe2\xd4\x13\xf1\xe5\xd9\xd3\xaf\xb2\x87_\x65\xbc\x85*\x95\x8e\x15\x93\xe0\x8f\x63\xab\xfan>t"
"\xec\xa7\x9bt\xf8{\xd5\xb8\xd9\x92k&}\xf7\xa7\xf1\x64\x9a\xac^\xc8\xb2\x0b^\xe5\x04\xd8\x05^\x10\xb5W\x9d\xf5=\x66\xca\xbc\xb5\t"
"p\x91\xed\xdf\x43\\\x11\xf3!\xa4\x45\xe6j \xd8\x07\xd6\xf4\xff&^h`\x35\x43\x1c\xf6\x88&\xd8R!Q\x8b\n\xaaN\xf9\xcd\x1e"
"\xf7\x45\xce\x06\xb8\xdb\xf0\x63\xb7\xa8\x64{s\x32\x33\x99;\x16Uu\xb4y\xb0*\?>\xae\x00\xcf\xa4\xc7\x98\x0ez\xcc\x31\xaes|+"
"}\x91\x1a\x35>\xe6\xa7h\xf1\xb5\x32\x91\x66W.\xbeP\xa4^\xd7*\xe8}\xa9\xf0\x80\xfa\xab\x85\x44\xea\x0e\x15\xd1\xed\xe3\xdam\xb6\x87"
"\x9eS\xfb&\xc6\x18\xb2\xe2\xbaZ[\xb4\x99\xe2\xfa\x9d)W\x0c/R_\x11\xb5NzW>{\xa8\xa5\xdb\x0e\x0b\x64\xb4\x8a\xd7\xd3\x94"
"\xf7\xda\x38&j\xab\x1b\xae\xc9\xb2+<z\xa3\x46\x8c\xe7s\xb3\x07\xa5\xd1h\x11\xf5\x11Ols\x30\xaf\x1b\x94\xde\x13\xf5\xa2\xac\xd2\xc6"
"}\xdc\x9c\xc7\x93\xb5\xd8\x82\x66zm&\x33W|\xf2\x1a\x8f.\xc9\xcc\xa4\xe3\x89\xae\x96\x1a\xf7\xae\x05\x35\x1e\xd2\x83V\xf1\xc1\x90H\x43"
"\x30n\xf0\xe1^\xc4\x18\x83\x88Z\x83)\x15\x37\xbe\x88\xc9\xf5\x30y\xe2\xc3~\xa5\xcd\xb5\x14\xd8w\xef\x17w\xd6Io\xf4\x9b\xe5\xa6z"
"\xc9|L\xe2\xe9\x94\x9f\x64\x97}|\xef\xff\xf4\xd9\xbf|\xf2M\x14[\xd7\x0c\x0e\xc9\x92\xce\xa7\x99\xdeX\xd6\xc4k\x82\xa1\x15\x37\x9b\x44"
"QG\xf1\x16\x0f\xd7\xc4[i\xa2\x83\x34_\x81\xe8\x00M\x34\xe3\x16\xf4R\x0b\xdfk}\x00\x7ft\xb8\xa0~\xceY:\x46\x93o\xad\xe3"
"V_\xca,;i\xc8\xff\xe9\x13\x9aY\xbb\x44t\xb6g\xbb\x94u\xd0\xc1\xda\x07\xe9\x9e\xb4\xae\xd0\x63\xe6\xf4\xde\x63\xe9'j\xa0\x93\xab"
"\x43\x0eWg\xdf\xda\xb1\x0f\xa1\x96\xd8\xa4{WN\x0b\xf6\xae\x9c\x9a\xeb\xdd\x11\xe5\xcf]\x0b\xea\xdd\x99\x9f\xc3l\xd5\"KJ\x7f\x9d\xf8"
"q\xed\x89\xa6\x15:\x45\xde[\xeb\x08Zy-\xd8\x83\x1b\xc0\xfaG@T\\\x7f\x42\x94\xa1\x11\xe2\x92h\xce\x87\xe6\xee\x91,\xf9\xe3>"
"\x10\x63\xcc\x94Q\x1d\x83.\xd1\x35\xe8\x41\x37\xf9\x38\xa3\xe8\x46\x0b\x11\x61\x43\xc4\x37\xd0\xa0\x37\x87\x44\xf3\x8e>v\x83\x91\xeb\xf6\x38>\x1a"
"\xb9G\xba=N>\x42\xf3\x85\?\xbb\x83\xb2\xb9/\x11\x45\x97@\x9c\x10Uo\x34\xdf|\x06'G\xd9\xea\xc1i\xc6\xfb/\xa2\xaf\xee\x1f"
"\x30\x14\?t\xc4\xb8\xa7'\xa0N\x44\xe1\xf9:\x8d\xf8\xd0W\xe7\xb2;#\x13\x05\x1d\?\xae\xb4!>\xf4M\xe9\xcf\x7f\x14\x9b\xee\xd0+"
"\x16\x1dH\x31\xbd\xfb\x9b\xf6\xaa\xa2LX\x90\xf5\xdf\x9d\x96yx\"\xe6\xa6\x38\xbf\xf3\xe4\x14\xb2\x88\xacO\x11\xe7#\x8a&X\x38\xb1\xfb"
"\xc7\x13\xdd\xfb\x12\xf6\x36\xa4\x98l\x1e(\x66\xe7x\x19\xd4\xee\xaaT\xf6<\xa7O\n\x64\x04\x35\x17\x97\x64\xe6\xfc\xda\x9c\xa1\x41p\x98z"
"\xf8\xab\xff\?\xae~\x33\xd7\"\xa5V<Q\xac\xcbJ^\xd9\x62I\xfeM\xeb\x7f\xe3\x9f\xbd\xdf\x9f\xfd\xcb'Sy\?\xea\xc3\xc9\xa8\xd5"
"x\x30%\xb4\xec\x07\xd6\xdbL\x9e\xd3\xc0\xa7\x17\x66n\xd6\xe9\xb6G\x96\xf5\x36\x45\r\xa3}\x0f\xf1\x00\x43\xbc\xf5\xc7}\xa2\t\xf6\xcc\xd9"
"\x85\x63\xdd\xbbx\x83\x9b\xe0\xe3y\x0f\xf6\xd6!\xfa\xc6\xea[\x97(\xff\x9b\xc1\xd6g\x1f/\x1eK\x1a\x37\x05\xab\x99\x46\xd3\x63\x0c\x1f\x80"
"!\xc0\xa2L\xcc\x83\xf9\x11Y\xbc\xf7\xe3\xb7i)\xf8\xcd\xbe\x37\x14\xd3\x87\x93t\xf6J\x96\x9dn\xa5\x1d\xba\xb7\xffvO\x8c\x97\xd0\x06"
"\xa3sivi\tz\x8e\x43\xdf\xe8R\xef\xf4\xbc\xed\xb1\xe4i\xe5\x98\xd6\xc2\x01\x99\x98\xe1\xc5\xd5.\xd3\xc7\x12\xc5\xac\n#\x7ft\x0b"
"\xbc\xd3\xeb\x84\xe3<\xd0\xc3\xab}\x11\xe5\xff\xd4}\xf3+w\"W\x1eK\x9f\xf7|\x46\x83\xdf\xb2\xf1\xcc\xb1\xa5\xfb\xc0\xe9\x9c\xd1W\xd2"
"\xff\x8e\xa7W\x64\xe9^)\x9e\xe0\xde\xc6'\xfa\xfe\xdf\xd0S\xc6s\xe2n\xbe`\\\x46X\\\t\xb2\xf3\xd9o\x66\x65\xf7\x16\xc6\xf3\xf4"
"\xf3\xa1\xf8\x93\x05q\x87X\x81\x15\xa5O%\x41\x8f\x05\xae\xdf\x8a\xf8\x80\xaa\x9f\x94\x88\xbb-j\x63r\x18\x87\xd7\xd2/\xa4\xc7\x64/\xcf"
"\xe6j\xcc\xe2\xecr\x63\xa6h\xd3\x13(\x8fI\xc3]U\x44\x9a\?\x93\x86\x39\x19\x39\xb1\xfb\x45\xd1\xe9\x88I#+\?;\xd7\x42\xd8\xf9"
"gq\x9dsm\r\xd7h\r\x13\x8c\x02\x13T\xf4\x14\xcf\xc7\x1b\x99\xe2\x46\xa6P\xcb\xd3S\x62\xba\xfck\x02\x94\xbe\x97\x88\x32\xc4\xa5\xdb"
"\x82i\xac\x82\x0c\x15\xf5=\x92\x16\x93\x8e\xc7\x1e\xcb:\xe8\xbc\xdfS\xa2\xb4\x83\x84}\x33g\xae\xa7\xe6\xf1\x31+\xceq\x93\xf3\x43q\xdc"
"\xb3[<\xc2\xfc\x91\xa8&\xc0\x16\x66\xf4\xfcM;!\xc7\xd5\xf9\x9b\xb3\xe9\x44\x9c\xa0kR\x39\xcfG\xae\xe1\xcd\xd7\xae\xe1-\x30 ,"
"P\x05\x0b\x8cm\x8bw\x62\xde$\x16\x8e\xc9xP\x45u.>\xf4\xa1\xe9r\xd2\x88_\xe4\xcd\x8e\xdd-g\xe6\xf5\xb6`\x0f>\xd3n"
"r+\x06\xc2nY\x17\x03\x80\xc5\xa2\xe7\x9dJ\xb5l\xb2q\x8c\x43P.\xa6\xeb\xb5\x63\xbd\x9e\xd3\x1e\xc2\xd8Xs\xd1\x0c\xdc\xb5M\xff"
"\xda\x89\xe3\xce\xef\x1bW\x03\xe9\x7f\xf4~\xfb\x03ox\xfco\xfb\x61Q\xf2\?\xff,\xc8\xbf\xf2\xfb\x8fl\xb8\xca\xec\x9d\xee\x96\xa7\xc9\xea"
"\x83\xbf\xe0\xbe\xf1\xef\x9f\x7f\x11\xc5&H\x9ah\xe9\xcb\xd0w\x36\x96\x61\xd6y\x94\xcb\x64\xa5Q\xd2\x83\xe1\x43#\x61\xd9\xd9m\xa7q\x05"
"\x83\x12_\xc1\xf2\x89\x98\\\x1e:Sj\x15\xa8V\xe1p\x84\x98\x89\xa0j>\x04v\xe2\x9f\x1b\x62\xfe\x7f\xcf\x63\xd9\x1f\x34\xba\x9f\x85\x39"
"\xae\xc6{\x1b\x8f\x65\xb7\x18\xb1\x39`m\xf6\xd4\xf9\x62\?\x10&^U\x00\x03i\x03-\x8d\x18\x0e\x03\xa7\x82y\x14\xf4\xda\x63\xe6\xe0\xd2"
"\x63\xae\xefl\xd4\xf2uj\xad@\xfb\x99\xc7\xcc\x41\xc3\x63N\x93o\xcb\xe6x_\xab\x98MN\n\xba\x37.j\xb1\xadil\x65\x8b\xdb"
"\xdd~\x12\xf3X\xec\xc8\x63\xae\xc3o\xd7\x44\xea'\xb3w\xe2\x85\x1c\xcd^\x07hG\x0fS\x1a\xc7\xc3\x03\xf9\xe7\xd8\
```

### Core Architecture Module: `deps/cndict/gen_simp_trad.py`
```
#!/usr/bin/env python

"""
This script takes a JSON dictionary containing traditional chinese characters
as keys, and the simplified equivalents as values. It then outputs a header file
appropriate for inclusion. The header output file contains an array,
`Cn_T2S` which can be used as

```
    simpChr = Cn_T2S[tradChr];
```

the variable Cn_T2S_MinChr contains the smallest key in the dictionary, whereas
Cn_T2S_MaxChr contains the largest key in the dictionary.
"""

import json
import datetime
import sys
from argparse import ArgumentParser

ap = ArgumentParser()
ap.add_argument('-f', '--file', help='Chinese map file', required=True)
ap.add_argument('-o', '--output', help='Where to place the output C source')

options = ap.parse_args()

with open(options.file, 'r') as fp:
    txt = json.load(fp)

if options.output is None or ap.output == '-':
    ofp = sys.stdout
else:
    ofp = open(ap.output, 'w')

CP_MIN = 0xffffffff
CP_MAX = 0x00

for k in txt:
    v = ord(k)
    if v > CP_MAX:
        CP_MAX = v
    if v < CP_MIN:
        CP_MIN = v

ofp.write('''
/**
 * Generated by {script} on {date}
 *
 */
#include <stdint.h>

static const uint16_t Cn_T2S_MinChr = {cp_min};
static const uint16_t Cn_T2S_MaxChr = {cp_max};

static uint16_t Cn_T2S[{cap}]={{
'''.format(
        script=' '.join(sys.argv),
        date=datetime.datetime.now(),
        cp_min=CP_MIN,
        cp_max=CP_MAX,
        cap=CP_MAX+1))




num_items = 0
ITEMS_PER_LINE = 5

for trad, simp in txt.items():
    ix = ord(trad)
    val = ord(simp)
    ofp.write(' [0x{:X}]=0x{:X},'.format(ix, val))
    num_items += 1
    if num_items >= ITEMS_PER_LINE:
        ofp.write('\n')
        num_items = 0

ofp.write('};\n')
ofp.flush()
```

### Core Architecture Module: `deps/cndict/read_friso.py`
```
#!/usr/bin/env python
import zlib
import struct
from argparse import ArgumentParser
from cStringIO import StringIO

ap = ArgumentParser()
ap.add_argument('-f', '--file', default='CNDICT.out')

opts = ap.parse_args()
fp = open(opts.file)

# Read the header/version
version = struct.unpack('!I', fp.read(4))[0]
print "VERSION", version

TYPE_MASK = 0x1F
F_SYNS = 0x01 << 5
F_FREQS = 0x02 << 5


def print_header(hdrbyte):
    print "Type: {0}. Has Syns={1}, Has Freqs={2}".format(
        hdrbyte & TYPE_MASK,
        bool(hdrbyte & F_SYNS),
        bool(hdrbyte & F_FREQS)
    )


def read_zstr(fp):
    ret = bytearray()
    while True:
        s = fp.read(1)
        if len(s) == 0 or ord(s) == 0:
            return ret.decode('utf-8')
        ret += s


def read_entry(fp):
    firstbyte = fp.read(1)
    if len(firstbyte) == 0:
        raise EOFError()

    hdrinfo = ord(firstbyte)
    print_header(hdrinfo)
    # Read up to the first buf
    term = read_zstr(fp)
    syns = []
    freqs = 0
    if hdrinfo & F_SYNS:
        # Check the number of syns we're to read
        syncount = struct.unpack("!h", fp.read(2))[0]
        for _ in range(syncount):
            syns.append(read_zstr(fp))
    if hdrinfo & F_FREQS:
        freqs = struct.unpack("!I", fp.read(4))[0]

    return term, syns, freqs

sio = StringIO(zlib.decompress(fp.read()))
while True:
    term, syns, freqs = read_entry(sio)
    print term, freqs
```

### Core Architecture Module: `deps/fast_float/fast_float.h`
```
// fast_float by Daniel Lemire
// fast_float by João Paulo Magalhaes
//
//
// with contributions from Eugene Golushkov
// with contributions from Maksim Kita
// with contributions from Marcin Wojdyr
// with contributions from Neal Richardson
// with contributions from Tim Paine
// with contributions from Fabio Pellacini
// with contributions from Lénárd Szolnoki
// with contributions from Jan Pharago
// with contributions from Maya Warrier
// with contributions from Taha Khokhar
// with contributions from Anders Dalvander
//
//
// MIT License Notice
//
//    MIT License
//
//    Copyright (c) 2021 The fast_float authors
//
//    Permission is hereby granted, free of charge, to any
//    person obtaining a copy of this software and associated
//    documentation files (the "Software"), to deal in the
//    Software without restriction, including without
//    limitation the rights to use, copy, modify, merge,
//    publish, distribute, sublicense, and/or sell copies of
//    the Software, and to permit persons to whom the Software
//    is furnished to do so, subject to the following
//    conditions:
//
//    The above copyright notice and this permission notice
//    shall be included in all copies or substantial portions
//    of the Software.
//
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//    PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
//    SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
//    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
//    IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//    DEALINGS IN THE SOFTWARE.
//

#ifndef FASTFLOAT_CONSTEXPR_FEATURE_DETECT_H
#define FASTFLOAT_CONSTEXPR_FEATURE_DETECT_H

#ifdef __has_include
#if __has_include(<version>)
#include <version>
#endif
#endif

// Testing for https://wg21.link/N3652, adopted in C++14
#if __cpp_constexpr >= 201304
#define FASTFLOAT_CONSTEXPR14 constexpr
#else
#define FASTFLOAT_CONSTEXPR14
#endif

#if defined(__cpp_lib_bit_cast) && __cpp_lib_bit_cast >= 201806L
#define FASTFLOAT_HAS_BIT_CAST 1
#else
#define FASTFLOAT_HAS_BIT_CAST 0
#endif

#if defined(__cpp_lib_is_constant_evaluated) &&                                \
    __cpp_lib_is_constant_evaluated >= 201811L
#define FASTFLOAT_HAS_IS_CONSTANT_EVALUATED 1
#else
#define FASTFLOAT_HAS_IS_CONSTANT_EVALUATED 0
#endif

// Testing for relevant C++20 constexpr library features
#if FASTFLOAT_HAS_IS_CONSTANT_EVALUATED && FASTFLOAT_HAS_BIT_CAST &&           \
    __cpp_lib_constexpr_algorithms >= 201806L /*For std::copy and std::fill*/
#define FASTFLOAT_CONSTEXPR20 constexpr
#define FASTFLOAT_IS_CONSTEXPR 1
#else
#define FASTFLOAT_CONSTEXPR20
#define FASTFLOAT_IS_CONSTEXPR 0
#endif

#if __cplusplus >= 201703L || (defined(_MSVC_LANG) && _MSVC_LANG >= 201703L)
#define FASTFLOAT_DETAIL_MUST_DEFINE_CONSTEXPR_VARIABLE 0
#else
#define FASTFLOAT_DETAIL_MUST_DEFINE_CONSTEXPR_VARIABLE 1
#endif

#endif // FASTFLOAT_CONSTEXPR_FEATURE_DETECT_H

#ifndef FASTFLOAT_FLOAT_COMMON_H
#define FASTFLOAT_FLOAT_COMMON_H

#include <cfloat>
#include <cstdint>
#include <cassert>
#include <cstring>
#include <type_traits>
#include <system_error>
#ifdef __has_include
#if __has_include(<stdfloat>) && (__cplusplus > 202002L || _MSVC_LANG > 202002L)
#include <stdfloat>
#endif
#endif

namespace fast_float {

enum class chars_format : uint64_t;

namespace detail {
constexpr chars_format basic_json_fmt = chars_format(1 << 5);
constexpr chars_format basic_fortran_fmt = chars_format(1 << 6);
} // namespace detail

enum class chars_format : uint64_t {
  scientific = 1 << 0,
  fixed = 1 << 2,
  hex = 1 << 3,
  no_infnan = 1 << 4,
  // RFC 8259: https://datatracker.ietf.org/doc/html/rfc8259#section-6
  json = uint64_t(detail::basic_json_fmt) | fixed | scientific | no_infnan,
  // Extension of RFC 8259 where, e.g., "inf" and "nan" are allowed.
  json_or_infnan = uint64_t(detail::basic_json_fmt) | fixed | scientific,
  fortran = uint64_t(detail::basic_fortran_fmt) | fixed | scientific,
  general = fixed | scientific,
  allow_leading_plus = 1 << 7,
  skip_white_space = 1 << 8,
};

template <typename UC> struct from_chars_result_t {
  UC const *ptr;
  std::errc ec;
};
using from_chars_result = from_chars_result_t<char>;

template <typename UC> struct parse_options_t {
  constexpr explicit parse_options_t(chars_format fmt = chars_format::general,
                                     UC dot = UC('.'), int b = 10)
      : format(fmt), decimal_point(dot), base(b) {}

  /** Which number formats are accepted */
  chars_format format;
  /** The character used as decimal point */
  UC decimal_point;
  /** The base used for integers */
  int base;
};
using parse_options = parse_options_t<char>;

} // namespace fast_float

#if FASTFLOAT_HAS_BIT_CAST
#include <bit>
#endif

#if (defined(__x86_64) || defined(__x86_64__) || defined(_M_X64) ||            \
     defined(__amd64) || defined(__aarch64__) || defined(_M_ARM64) ||          \
     defined(__MINGW64__) || defined(__s390x__) ||                             \
     (defined(__ppc64__) || defined(__PPC64__) || defined(__ppc64le__) ||      \
      defined(__PPC64LE__)) ||                                                 \
     defined(__loongarch64))
#define FASTFLOAT_64BIT 1
#elif (defined(__i386) || defined(__i386__) || defined(_M_IX86) ||             \
       defined(__arm__) || defined(_M_ARM) || defined(__ppc__) ||              \
       defined(__MINGW32__) || defined(__EMSCRIPTEN__))
#define FASTFLOAT_32BIT 1
#else
  // Need to check incrementally, since SIZE_MAX is a size_t, avoid overflow.
// We can never tell the register width, but the SIZE_MAX is a good
// approximation. UINTPTR_MAX and INTPTR_MAX are optional, so avoid them for max
// portability.
#if SIZE_MAX == 0xffff
#error Unknown platform (16-bit, unsupported)
#elif SIZE_MAX == 0xffffffff
#define FASTFLOAT_32BIT 1
#elif SIZE_MAX == 0xffffffffffffffff
#define FASTFLOAT_64BIT 1
#else
#error Unknown platform (not 32-bit, not 64-bit?)
#endif
#endif

#if ((defined(_WIN32) || defined(_WIN64)) && !defined(__clang__)) ||           \
    (defined(_M_ARM64) && !defined(__MINGW32__))
#include <intrin.h>
#endif

#if defined(_MSC_VER) && !defined(__clang__)
#define FASTFLOAT_VISUAL_STUDIO 1
#endif

#if defined __BYTE_ORDER__ && defined __ORDER_BIG_ENDIAN__
#define FASTFLOAT_IS_BIG_ENDIAN (__BYTE_ORDER__ == __ORDER_BIG_ENDIAN__)
#elif defined _WIN32
#define FASTFLOAT_IS_BIG_ENDIAN 0
#else
#if defined(__APPLE__) || defined(__FreeBSD__)
#include <machine/endian.h>
#elif defined(sun) || defined(__sun)
#include <sys/byteorder.h>
#elif defined(__MVS__)
#include <sys/endian.h>
#else
#ifdef __has_include
#if __has_include(<endian.h>)
#include <endian.h>
#endif //__has_include(<endian.h>)
#endif //__has_include
#endif
#
#ifndef __BYTE_ORDER__
// safe choice
#define FASTFLOAT_IS_BIG_ENDIAN 0
#endif
#
#ifndef __ORDER_LITTLE_ENDIAN__
// safe choice
#define FASTFLOAT_IS_BIG_ENDIAN 0
#endif
#
#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
#define FASTFLOAT_IS_BIG_ENDIAN 0
#else
#define FASTFLOAT_IS_BIG_ENDIAN 1
#endif
#endif

#if defined(__SSE2__) || (defined(FASTFLOAT_VISUAL_STUDIO) &&                  \
                          (defined(_M_AMD64) || defined(_M_X64) ||             \
                           (defined(_M_IX86_FP) && _M_IX86_FP == 2)))
#define FASTFLOAT_SSE2 1
#endif

#if defined(__aarch64__) || defined(_M_ARM64)
#define FASTFLOAT_NEON 1
#endif

#if defined(FASTFLOAT_SSE2) || defined(FASTFLOAT_NEON)
#define FASTFLOAT_HAS_SIMD 1
#endif

#if defined(__GNUC__)
// disable -Wcast-align=strict (GCC only)
#define FASTFLOAT_SIMD_DISABLE_WARNINGS                                        \
  _Pragma("GCC diagnostic push")                                               \
      _Pragma("GCC diagnostic ignored \"-Wcast-align\"")
#else
#define FASTFLOAT_SIMD_DISABLE_WAR
```

### Core Architecture Module: `deps/fast_float/fast_float_strtod.cpp`
```
#include "fast_float.h"
#include <iostream>
#include <string>
#include <system_error>
#include <cerrno>

/* Convert NPTR to a double using the fast_float library.
 *
 * This function behaves similarly to the standard strtod function, converting
 * the initial portion of the string pointed to by `nptr` to a `double` value,
 * using the fast_float library for high performance.
 * If the conversion fails, the function sets `errno` to:
 * - ERANGE if the result overflows or underflows
 * - EINVAL for other errors
 *
 * @param nptr   A pointer to the null-terminated byte string to be interpreted.
 * @param endptr A pointer to a pointer to character. If `endptr` is not NULL,
 *               it will point to the character after the last character used
 *               in the conversion.
 * @return       The converted value as a double. If no valid conversion could
 *               be performed, returns 0.0.
 * If ENDPTR is not NULL, a pointer to the character after the last one used
 * in the number is put in *ENDPTR.  */
extern "C" double fast_float_strtod(const char *nptr, char **endptr) {
  double result = 0.0;
  auto answer = fast_float::from_chars(nptr, nptr + strlen(nptr), result);
  if (answer.ec != std::errc()) {
    // Fallback to EINVAL for other errors except ERANGE
    errno = (answer.ec == std::errc::result_out_of_range) ? ERANGE : EINVAL;
  }
  if (endptr != NULL) {
    *endptr = (char *)answer.ptr;
  }
  return result;
}

```

### Core Architecture Module: `deps/fast_float/fast_float_strtod.h`
```

#ifndef __FAST_FLOAT_STRTOD_H__
#define __FAST_FLOAT_STRTOD_H__

#if defined(__cplusplus)
extern "C"
{
#endif
double fast_float_strtod(const char *in, char **out);

#if defined(__cplusplus)
}
#endif

#endif /* __FAST_FLOAT_STRTOD_H__ */

```

### Core Architecture Module: `deps/friso/friso.c`
```
/*
 * friso main file implemented the friso main functions.
 *         starts with friso_ in the friso header file "friso.h";
 *
 * @author    chenxin <chenxin619315@gmail.com>
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "friso_API.h"
#include "friso_ctype.h"
#include "friso.h"

//-----------------------------------------------------------------
// friso instance about function
/* {{{ create a new friso configuration variable.
 */
FRISO_API friso_t friso_new(void) {
  friso_t e = (friso_t)FRISO_MALLOC(sizeof(friso_entry));
  if (e == NULL) {
    ___ALLOCATION_ERROR___
  }

  e->dic = NULL;
  e->charset = FRISO_UTF8;  // set default charset UTF8.

  return e;
}
/* }}} */

/* {{{ creat a new friso with initialize item from a configuration file.
 *
 * @return 1 for successfully and 0 for failed.
 */
FRISO_API int friso_init_from_ifile(friso_t friso, friso_config_t config, fstring __ifile) {
  FILE *__stream;
  char __chars__[256], __key__[128], *__line__;
  char __lexi__[160], lexpath[160];
  uint_t i, t, __hit__ = 0, __length__;

  char *slimiter = NULL;
  uint_t flen = 0;

  // get the base part of the path of the __ifile
  if ((slimiter = strrchr(__ifile, '/')) != NULL) {
    flen = slimiter - __ifile + 1;
  }

  // yat, start to parse the friso.ini configuration file
  if ((__stream = fopen(__ifile, "rb")) != NULL) {
    // initialize the entry with the value from the ifile.
    while ((__line__ = file_get_line(__chars__, __stream)) != NULL) {
      // comments filter.
      if (__line__[0] == '#') continue;
      if (__line__[0] == '\t') continue;
      if (__line__[0] == ' ' || __line__[0] == '\0') continue;

      __length__ = strlen(__line__);
      for (i = 0; i < __length__; i++) {
        if (__line__[i] == ' ' || __line__[i] == '\t' || __line__[i] == '=') {
          break;
        }
        __key__[i] = __line__[i];
      }
      __key__[i] = '\0';

      // position the euqals char '='.
      if (__line__[i] == ' ' || __line__[i] == '\t') {
        for (i++; i < __length__; i++) {
          if (__line__[i] == '=') {
            break;
          }
        }
      }

      // clear the left whitespace of the value.
      for (i++; i < __length__ && (__line__[i] == ' ' || __line__[i] == '\t'); i++)
        ;
      for (t = 0; i < __length__; i++, t++) {
        if (__line__[i] == ' ' || __line__[i] == '\t') {
          break;
        }
        __line__[t] = __line__[i];
      }
      __line__[t] = '\0';

      // printf("key=%s, value=%s\n", __key__, __line__ );
      if (strcmp(__key__, "friso.lex_dir") == 0) {
        /*
         * here copy the value of the lex_dir.
         *        cause we need the value of friso.max_len to finish all
         *    the work when we call function friso_dic_load_from_ifile to
         *    initiliaze the friso dictionary.
         */
        if (__hit__ == 0) {
          __hit__ = t;
          for (t = 0; t < __hit__; t++) {
            __lexi__[t] = __line__[t];
          }
          __lexi__[t] = '\0';
        }
      } else if (strcmp(__key__, "friso.max_len") == 0) {
        config->max_len = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.r_name") == 0) {
        config->r_name = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.mix_len") == 0) {
        config->mix_len = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.lna_len") == 0) {
        config->lna_len = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.add_syn") == 0) {
        config->add_syn = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.clr_stw") == 0) {
        config->clr_stw = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.keep_urec") == 0) {
        config->keep_urec = (uint_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.spx_out") == 0) {
        config->spx_out = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.nthreshold") == 0) {
        config->nthreshold = atoi(__line__);
      } else if (strcmp(__key__, "friso.mode") == 0) {
        // config->mode = ( friso_mode_t ) atoi( __line__ );
        friso_set_mode(config, (friso_mode_t)atoi(__line__));
      } else if (strcmp(__key__, "friso.charset") == 0) {
        friso->charset = (friso_charset_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.en_sseg") == 0) {
        config->en_sseg = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.st_minl") == 0) {
        config->st_minl = (ushort_t)atoi(__line__);
      } else if (strcmp(__key__, "friso.kpuncs") == 0) {
        // t is the length of the __line__.
        memcpy(config->kpuncs, __line__, t);
        // printf("friso_init_from_ifile#kpuncs: %s\n", config->kpuncs);
      }
    }

    /*
     * intialize the friso dictionary here.
     *        use the setting from the ifile parse above
     *    we copied the value in the __lexi__
     */
    if (__hit__ != 0) {
      // add relative path search support
      //@added: 2014-05-24
      // convert the relative path to absolute path base on the path of friso.ini
      // improved at @date: 2014-10-26

#ifdef FRISO_WINNT
      if (__lexi__[1] != ':' && flen != 0) {
#else
      if (__lexi__[0] != '/' && flen != 0) {
#endif
        if ((flen + __hit__) > sizeof(lexpath) - 1) {
          fprintf(stderr, "[Error]: Buffer is not long enough to hold the final lexicon path");
          fprintf(stderr, " with a length of {%d} at function friso.c#friso_init_from_ifile",
                  flen + __hit__);
          return 0;
        }

        memcpy(lexpath, __ifile, flen);
        memcpy(lexpath + flen, __lexi__, __hit__ - 1);
        // count the new length
        flen = flen + __hit__ - 1;
        if (lexpath[flen - 1] != '/') lexpath[flen] = '/';
        lexpath[flen + 1] = '\0';
      } else {
        memcpy(lexpath, __lexi__, __hit__);
        lexpath[__hit__] = '\0';
        if (lexpath[__hit__ - 1] != '/') {
          lexpath[__hit__] = '/';
          lexpath[__hit__ + 1] = '\0';
        }
      }

      friso->dic = friso_dic_new();
      // add charset check for max word length counting
      friso_dic_load_from_ifile(friso, config, lexpath,
                                config->max_len * (friso->charset == FRISO_UTF8 ? 3 : 2));
    } else {
      fprintf(stderr, "[Error]: failed get lexicon path, check lex_dir in friso.ini \n");
      return 0;
    }

    fclose(__stream);
    return 1;
  }

  return 0;
}
/* }}} */

/* {{{ friso free functions.
 * here we have to free its dictionary.
 */
FRISO_API void friso_free(friso_t friso) {
  // free the dictionary
  if (friso->dic != NULL) {
    friso_dic_free(friso->dic);
  }
  FRISO_FREE(friso);
}
/* }}} */

/* {{{ set the current split mode
 *    view the friso.h#friso_mode_t
 */
FRISO_API void friso_set_mode(friso_config_t config, friso_mode_t mode) {
  config->mode = mode;

  switch (config->mode) {
    case __FRISO_SIMPLE_MODE__:
      config->next_token = next_mmseg_token;
      config->next_cjk = next_simple_cjk;
      break;
    case __FRISO_DETECT_MODE__:
      config->next_token = next_detect_token;
      break;
    default:
      config->next_token = next_mmseg_token;
      config->next_cjk = next_complex_cjk;
      break;
  }
}
/* }}} */

/* {{{ create a new friso configuration entry and initialize
 * it with default value.*/
FRISO_API friso_config_t friso_new_config(void) {
  friso_config_t cfg = (friso_config_t)FRISO_MALLOC(sizeof(friso_config_entry));
  if (cfg == NULL) {
    ___ALLOCATION_ERROR___;
  }

  // initialize the configuration entry.
  friso_init_config(cfg);

  return cfg;
}
/* }}} */

/* {{{ initialize the specified friso config entry with default value.*/
FRISO_API void friso_init_config(friso_config_t cfg) {
  cfg->max_len = DEFAULT_SEGMENT_LENGTH;
  cfg->r_name = 1;
  cfg->mix_len = DEFAULT_MIX_LENGTH;
  cfg->lna_len = DEFAULT_LNA_LENGTH;
  cfg->add_syn = 1;
  cfg->clr_stw = 0;
  cfg->keep_urec = 0;
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

### Incident Patch 1: `938a026f` (2026-09-30)
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

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

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

---

### Incident Patch 2: `057a5e92` (2026-09-30)
**Commit Message**: value: make the crate's tests run on their own and without leaks (#11642)

* value: link the C library when running the crate's tests on their own

Running `cargo test` from `value/` failed with undefined C symbols, because
the `redisearch_rs` dev-dependency pulls in crates (`query_eval`, `c_trie`,
`rqe_iterators`) that only link the C bundle when their `unittest` feature is
enabled by feature unification from other workspace members' dev-dependencies.

Give `value` its own `unittest` feature and build script, like the other crates
whose tests need the C code.

* value: drop the dereference stress chains instead of leaking them

The deep-chain stress tests `mem::forget` their root so the recursive drop
doesn't overflow the small test stack. That makes valgrind report ~1.4 MiB of
leaks, and forced skipping the tests under LeakSanitizer.

Tear the chain down one link at a time instead, holding a clone of the next
link so each drop only decrements a refcount. The tests no longer leak, so
they now also run under `SAN=address`.

**File**: `src/redisearch_rs/Cargo.lock` (modified, +2/-0)
```diff
@@ -3613,6 +3613,7 @@ checksum = "ba73ea9cf16a25df0c8caa16c51acb937d5712a8429db78a3ee29d5dcacd3a65"
 name = "value"
 version = "0.0.1"
 dependencies = [
+ "build_utils",
  "c_ffi_utils",
  "cheadergen",
  "ffi",
@@ -3628,6 +3629,7 @@ dependencies = [
  "tracing",
  "tracing_assert",
  "triomphe",
+ "value",
  "workspace_hack",
 ]
 
```

**File**: `src/redisearch_rs/value/Cargo.toml` (modified, +9/-0)
```diff
@@ -8,6 +8,14 @@ publish.workspace = true
 [lib]
 test = false
 
+[features]
+# feature enabled when building tests so they can link the C code in build.rs
+# see https://github.com/rust-lang/cargo/issues/4789#issuecomment-2308131243
+unittest = []
+
+[build-dependencies]
+build_utils.workspace = true
+
 [dependencies]
 c_ffi_utils = { workspace = true }
 cheadergen.workspace = true
@@ -27,6 +35,7 @@ tracing_assert.workspace = true
 [dev-dependencies]
 redisearch_rs = { workspace = true, features = ["mock_allocator"] }
 redis_mock.workspace = true
+value = { path = ".", features = ["unittest"] }
 
 [lints]
 workspace = true
```

**File**: `src/redisearch_rs/value/build.rs` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+/*
+ * Copyright (c) 2006-Present, Redis Ltd.
+ * All rights reserved.
+ *
+ * Licensed under your choice of the Redis Source Available License 2.0
+ * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
+ * GNU Affero General Public License v3 (AGPLv3).
+*/
+
+fn main() {
+    #[cfg(feature = "unittest")]
+    build_utils::bind_foreign_c_symbols();
+}
```

**File**: `src/redisearch_rs/value/tests/integration/dereference.rs` (modified, +28/-17)
```diff
@@ -7,14 +7,10 @@
  * GNU Affero General Public License v3 (AGPLv3).
 */
 
-use std::mem;
-
 use value::{SharedValue, Trio, Value};
 
 // Moderate stress depth: with the deliberately small test stack below it is enough to overflow
 // recursive dereferencing in non-optimized test profiles, without allocating a 100k-node chain.
-// The tests call `mem::forget` on the root so recursive destruction of the intentionally deep
-// chain does not become the limiting factor.
 const CHAIN_DEPTH: usize = 8 * 1024;
 
 // Stack bytes for the stress thread. Keep this deliberately small so `CHAIN_DEPTH` measures
@@ -35,17 +31,32 @@ fn trio_left_chain(depth: usize, terminal: Value) -> Value {
     })
 }
 
-fn intentional_leak_stress_disabled() -> bool {
-    // Sanitizer CI sets `SAN=address`. Do not deliberately leak the stress-test chains under
-    // LeakSanitizer; normal and coverage runs still execute the stress path.
-    std::env::var("SAN").as_deref() == Ok("address")
+/// The next link of a chain built by [`ref_chain`] or [`trio_left_chain`].
+fn chain_link(value: &Value) -> Option<SharedValue> {
+    match value {
+        Value::Ref(next) => Some(next.clone()),
+        Value::Trio(trio) => Some(trio.left().clone()),
+        _ => None,
+    }
 }
 
-fn run_with_small_stack(test: impl FnOnce() + Send + 'static) {
-    if intentional_leak_stress_disabled() {
-        return;
+/// Drops a chain built by [`ref_chain`] or [`trio_left_chain`] one link at a time.
+///
+/// Dropping the root directly would recurse once per link and overflow the small test stack.
+/// Holding a clone of the next link while dropping the current one keeps that link alive, so
+/// freeing each link only decrements the next link's refcount instead of descending into it.
+fn drop_chain(value: Value) {
+    let mut next = chain_link(&value);
+    drop(value);
+    while let Some(link) = next {
+        // A link with another owner outlives this drop, and whichever owner releases it last
+        // tears the rest of the chain down recursively.
+        assert_eq!(SharedValue::refcount(&link), 1, "chain link is shared");
+        next = chain_link(&link);
     }
+}
 
+fn run_with_small_stack(test: impl FnOnce() + Send + 'static) {
     std::thread::Builder::new()
         .stack_size(TEST_STACK_SIZE)
         .spawn(test)
@@ -57,14 +68,14 @@ fn run_with_small_stack(test: impl FnOnce() + Send + 'static) {
 #[test]
 #[cfg_attr(
     miri,
-    ignore = "Intentionally leaks a deep chain and is too slow under Miri"
+    ignore = "Building and dropping a deep chain is too slow under Miri"
 )]
 fn fully_dereferenced_ref_follows_nested_refs() {
     run_with_small_stack(|| {
         let value = ref_chain(CHAIN_DEPTH, Value::Number(42.0));
 
         let dereferenced = matches!(value.fully_dereferenced_ref(), Value::Number(42.0));
-        mem::forget(value);
+        drop_chain(value);
 
         assert!(dereferenced);
     });
@@ -73,14 +84,14 @@ fn fully_dereferenced_ref_follows_nested_refs() {
 #[test]
 #[cfg_attr(
     miri,
-    ignore = "Intentionally leaks a deep chain and is too slow under Miri"
+    ignore = "Building and dropping a deep chain is too slow under Miri"
 )]
 fn fully_dereferenced_ref_and_trio_follows_nested_refs() {
     run_with_small_stack(|| {
         let value = ref_chain(CHAIN_DEPTH, Value::Number(42.0));
 
         let dereferenced = matches!(value.fully_dereferenced_ref_and_trio(), Value::Number(42.0));
-        mem::forget(value);
+        drop_chain(value);
 
         assert!(dereferenced);
     });
@@ -89,14 +100,14 @@ fn fully_dereferenced_ref_and_trio_follows_nested_refs() {
 #[test]
 #[cfg_attr(
     miri,
-    ignore = "Intentionally leaks a deep chain and is too slow under Miri"
+    ignore = "Building and dropping a deep chain is too slow under Miri"
 )]
 fn fully_dereferenced_ref_and_trio_follows_nested_trio_left_values() {
     run_with_small_stack(|| {
         let value = trio_left_chain(CHAIN_DEPTH, Value::Number(42.0));
 

```

---

### Incident Patch 3: `bb36abe4` (2026-09-30)
**Commit Message**: Return an error instead of crashing on an SVS query whose SEARCH_BUFFER_CAPACITY is below its SEARCH_WINDOW_SIZE (#11617)

* Add test for an SVS query whose buffer capacity is below its window size

A capacity smaller than the window must be rejected with a query error,
while a capacity equal to the window and a capacity given without a
window size still return results.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* Fix server crash on an SVS query whose buffer capacity is below its window size

An SVS KNN query can carry SEARCH_WINDOW_SIZE and SEARCH_BUFFER_CAPACITY as
inline vector attributes. VecSim resolves the two independently and validates
each only as a positive integer, so no layer owns the cross-check between them.
The SVS backend is the first code to notice. Its SearchBufferConfig requires
search_window_size <= total_capacity and reports a violation by throwing, and
that throw unwinds out of VecSimIndex_TopKQuery through RediSearch's C frames
with no handler anywhere on the path, so the process aborts. Any client
authorized to query a trained SVS index could terminate the server with a single
FT.SEARCH.

Validate the pair while the query parameters are resol

**File**: `src/vector_index.c` (modified, +32/-1)
```diff
@@ -855,12 +855,43 @@ void VecSimParams_Cleanup(VecSimParams *params) {
   rm_free(params->logCtx);
 }
 
+// SVS sizes its search buffer from SEARCH_WINDOW_SIZE and SEARCH_BUFFER_CAPACITY, and requires the
+// capacity to hold the whole window. The backend enforces that by throwing, which would escape
+// through the module's C frames and terminate the server, so the pair is rejected here instead.
+// VecSim resolves each of the two parameters in isolation, so this cross-check has no other owner.
+static VecSimResolveCode validateSVSRuntimeParams(VecSimIndex *index,
+                                                  const VecSimQueryParams *qParams,
+                                                  QueryError *status) {
+  // svsRuntimeParams shares storage with the other algorithms' runtime params, so the fields below
+  // only hold what the SVS resolvers wrote when the index really is SVS. The resolvers gate on the
+  // same value (the backend algorithm for a tiered index).
+  if (VecSimIndex_BasicInfo(index).algo != VecSimAlgo_SVS) {
+    return VecSim_OK;
+  }
+  size_t windowSize = qParams->svsRuntimeParams.windowSize;
+  size_t bufferCapacity = qParams->svsRuntimeParams.bufferCapacity;
+  // SVS ignores the capacity unless a window size is given too. Treating zero as unset is safe for
+  // any caller: VecSimIndex_ResolveParams memsets the whole VecSimQueryParams before resolving, so
+  // an omitted attribute reads as zero regardless of how the caller initialized it.
+  if (windowSize == 0 || bufferCapacity == 0 || bufferCapacity >= windowSize) {
+    return VecSim_OK;
+  }
+  // The two values are client-supplied, so they belong in the user-data half of the error, which
+  // keeps them out of the log line when hideUserDataFromLog is set.
+  QueryError_SetWithUserDataFmt(status, QUERY_ERROR_CODE_BAD_VAL,
+                                "Error parsing vector similarity parameters: "
+                                "SEARCH_BUFFER_CAPACITY must not be smaller "
+                                "than SEARCH_WINDOW_SIZE",
+                                " (%zu < %zu)", bufferCapacity, windowSize);
+  return VecSimParamResolverErr_BadValue;
+}
+
 VecSimResolveCode VecSim_ResolveQueryParams(VecSimIndex *index, VecSimRawParam *params, size_t params_len,
                           VecSimQueryParams *qParams, VecsimQueryType queryType, QueryError *status) {
 
   VecSimResolveCode vecSimCode = VecSimIndex_ResolveParams(index, params, params_len, qParams, queryType);
   if (vecSimCode == VecSim_OK) {
-    return vecSimCode;
+    return validateSVSRuntimeParams(index, qParams, status);
   }
 
   QueryErrorCode RSErrorCode;
```

**File**: `tests/pytests/test_vecsim_svs.py` (modified, +50/-0)
```diff
@@ -98,6 +98,56 @@ def test_small_window_size():
                        f'__{field_name}_score').noError()
             conn.execute_command('FLUSHALL')
 
+'''
+SEARCH_WINDOW_SIZE and SEARCH_BUFFER_CAPACITY are plain KNN query attributes, and SVS sizes its
+search buffer from the pair, requiring the capacity to hold the whole window. The backend
+enforces that by throwing, which would escape the module's C frames and take the server down,
+so the pair has to be rejected while the query parameters are resolved.
+'''
+@skip(cluster=True)
+def test_search_buffer_capacity_below_window_size():
+    env = Env(moduleArgs='DEFAULT_DIALECT 2')
+    dim = 4
+    # The SVS backend serves queries only once trained; an untrained one returns before it
+    # builds the search buffer, so the invariant would never be reached.
+    num_docs = int(DEFAULT_BLOCK_SIZE * 1.1)
+    create_vector_index(env, dim, alg='SVS-VAMANA', additional_schema_args=['t', 'TEXT'])
+    query_vec = populate_with_vectors(env, num_docs=num_docs, dim=dim)
+    conn = getConnectionByEnv(env)
+    p = conn.pipeline(transaction=False)
+    for i in range(1, num_docs + 1):
+        p.execute_command('HSET', f'doc{i}', 't', 'filtered')
+    p.execute()
+    wait_for_background_indexing(env, DEFAULT_INDEX_NAME, DEFAULT_FIELD_NAME)
+
+    # A bare KNN drives SVS topKQuery; a filter in front of it makes NewVectorIterator take its
+    # hybrid branch (child_it != NULL) and drives the SVS batch iterator instead. Both reach the
+    # same VecSim_ResolveQueryParams, which is the only caller of VecSimIndex_ResolveParams, so
+    # covering both pins that the single choke point really does cover every KNN entry point.
+    def knn(*attrs, prefix='*'):
+        return f'{prefix}=>[KNN 10 @{DEFAULT_FIELD_NAME} $vec {" ".join(attrs)}]'
+
+    # Both a wildly undersized capacity and one just below the window are rejected, on the bare
+    # KNN and on the filtered form that routes through the batch iterator.
+    for prefix in ['*', '@t:filtered']:
+        for capacity in [1, 99]:
+            env.expect('FT.SEARCH', DEFAULT_INDEX_NAME,
+                       knn('SEARCH_WINDOW_SIZE', '100', 'SEARCH_BUFFER_CAPACITY', str(capacity),
+                           prefix=prefix),
+                       'PARAMS', 2, 'vec', query_vec.tobytes(), 'NOCONTENT').error().contains(
+                'SEARCH_BUFFER_CAPACITY must not be smaller than SEARCH_WINDOW_SIZE'
+                f' ({capacity} < 100)')
+
+    # A capacity that does hold the window, and a capacity with no window size at all (which SVS
+    # ignores), both stay accepted - the check must not narrow the legitimate surface. The second
+    # case is the one a future VecSim change could silently invalidate.
+    for prefix in ['*', '@t:filtered']:
+        for attrs in [('SEARCH_WINDOW_SIZE', '100', 'SEARCH_BUFFER_CAPACITY', '100'),
+                      ('SEARCH_BUFFER_CAPACITY', '1')]:
+            res = env.cmd('FT.SEARCH', DEFAULT_INDEX_NAME, knn(*attrs, prefix=prefix),
+                          'PARAMS', 2, 'vec', query_vec.tobytes(), 'NOCONTENT')
+            env.assertEqual(res[0], 10, message=res)
+
 def test_rdb_load_trained_svs_vamana():
     env = Env(moduleArgs='DEFAULT_DIALECT 2')
 
```

---

### Incident Patch 4: `00ee1cca` (2026-09-30)
**Commit Message**: Fail the RDB load instead of crashing on truncated legacy document byte offsets (#11605)

* Add tests for loading legacy byte offsets from an RDB

Build a legacy (encver 16) index spec RDB file in the test and start the
server from it. One test checks that byte offsets which exactly fill
their blob load and upgrade. The other gives the offsets a length prefix
larger than the blob, which must fail the load with a diagnostic rather
than crash the server.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

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
dereference (release). Initialize it when the spec is c

**File**: `src/byte_offsets.c` (modified, +16/-1)
```diff
@@ -60,10 +60,21 @@ void RSByteOffsets_Serialize(const RSByteOffsets *offsets, Buffer *b) {
 }
 
 RSByteOffsets *LoadByteOffsets(Buffer *buf) {
+  // Buffer_Read does not check the buffer's bounds, so every read is checked against what
+  // RSByteOffsets_Serialize wrote: a u8 field count, a (u8 id, u32 first, u32 last) record per
+  // field, a u32 data length, and the data itself.
+  const size_t fieldRecordSize = sizeof(uint8_t) + 2 * sizeof(uint32_t);
   BufferReader r = NewBufferReader(buf);
 
-  RSByteOffsets *offsets = NewByteOffsets();
+  if (BufferReader_Remaining(&r) < sizeof(uint8_t)) {
+    return NULL;
+  }
   uint8_t numFields = Buffer_ReadU8(&r);
+  if (BufferReader_Remaining(&r) < numFields * fieldRecordSize + sizeof(uint32_t)) {
+    return NULL;
+  }
+
+  RSByteOffsets *offsets = NewByteOffsets();
   RSByteOffsets_ReserveFields(offsets, numFields);
 
   for (size_t ii = 0; ii < numFields; ++ii) {
@@ -75,6 +86,10 @@ RSByteOffsets *LoadByteOffsets(Buffer *buf) {
   }
 
   uint32_t offsetsLen = Buffer_ReadU32(&r);
+  if (BufferReader_Remaining(&r) < offsetsLen) {
+    RSByteOffsets_Free(offsets);
+    return NULL;
+  }
   if (offsetsLen) {
     char *data = rm_malloc(offsetsLen);
     Buffer_Read(&r, data, offsetsLen);
```

**File**: `src/byte_offsets.h` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ RSByteOffsetField *RSByteOffsets_AddField(RSByteOffsets *offsets, uint32_t field
                                           uint32_t startPos);
 
 void RSByteOffsets_Serialize(const RSByteOffsets *offsets, Buffer *b);
+// Returns NULL if `buf` is shorter than the serialized offsets it describes.
 RSByteOffsets *LoadByteOffsets(Buffer *buf);
 
 typedef struct {
```

**File**: `src/doc_table.c` (modified, +13/-2)
```diff
@@ -522,8 +522,12 @@ int DocTable_LegacyRdbLoad(DocTable *t, RedisModuleIO *rdb, int encver) {
         dmd->payload->data = buf;
         dmd->payload->len--;
         t->memsize += dmd->payload->len + sizeof(RSPayload);
-      } else if ((dmd->flags & Document_Deleted) && (encver == INDEX_MIN_EXPIRE_VERSION)) {
-        RedisModule_Free(RedisModule_LoadStringBuffer(rdb, NULL));  // throw this string to garbage
+      } else {
+        // A deleted doc's payload is not loaded, so its flag must not tell DMD_Free there is one.
+        dmd->flags &= ~Document_HasPayload;
+        if (encver == INDEX_MIN_EXPIRE_VERSION) {
+          RedisModule_Free(RedisModule_LoadStringBuffer(rdb, NULL));  // throw this string to garbage
+        }
       }
     }
     dmd->sortVector = RSSortingVector_Empty();
@@ -539,6 +543,13 @@ int DocTable_LegacyRdbLoad(DocTable *t, RedisModuleIO *rdb, int encver) {
       dmd->byteOffsets = LoadByteOffsets(bufTmp);
       rm_free(bufTmp);
       RedisModule_Free(tmp);
+      if (!dmd->byteOffsets) {
+        RedisModule_LogIOError(rdb, "warning",
+                               "DocTable_LegacyRdbLoad: truncated byte offsets for doc id %llu",
+                               (unsigned long long)dmd->id);
+        DMD_Free(dmd);
+        return REDISMODULE_ERR;
+      }
     }
 
     if (dmd->flags & Document_Deleted) {
```

**File**: `src/indexes_scan.c` (modified, +1/-0)
```diff
@@ -562,6 +562,7 @@ void Indexes_UpgradeLegacyIndexes() {
     sp->docs = DocTable_New(INITIAL_DOC_TABLE_SIZE);
 
     // clear index stats
+    IndexError_Clear(sp->stats.indexError);
     memset(&sp->stats, 0, sizeof(sp->stats));
     // Init the index error
     sp->stats.indexError = IndexError_Init();
```

**File**: `src/spec.c` (modified, +2/-0)
```diff
@@ -3500,6 +3500,8 @@ void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   sp->numSortableFields = 0;
   sp->terms = NULL;
   sp->docs = DocTable_New(INITIAL_DOC_TABLE_SIZE);
+  // IndexSpec_Free clears it, so it must be valid before the first failed read below.
+  sp->stats.indexError = IndexError_Init();
 
   sp->specName = NewHiddenString(legacyName, strlen(legacyName), true);
   sp->obfuscatedName = IndexSpec_FormatObfuscatedName(sp->specName);
```

---

### Incident Patch 5: `c8f9d94e` (2026-09-29)
**Commit Message**: [MOD-18289] Reject RDB restore over disk memory budget (#11608)

**File**: `src/indexes.c` (modified, +4/-0)
```diff
@@ -280,6 +280,10 @@ static IndexSpec *Indexes_LoadSpecFromRdb(RedisModuleIO *rdb, int encver, bool u
   // Duplicate detection is a registry read, so it lives here rather than in the
   // IndexSpec core. It also gates the non-SST on-disk index open below.
   sp->isDuplicate = dictFetchValue(specDict_g, sp->specName) != NULL;
+  if (SearchDisk_IsEnabled() && !sp->isDuplicate && !SearchDisk_CanRestoreIndex(status)) {
+    StrongRef_Release(sp->own_ref);
+    return NULL;
+  }
   if (IndexSpec_RdbLoadOpenDisk(RedisModule_GetContextFromIO(rdb), sp, useSst, status) != REDISMODULE_OK) {
     StrongRef_Release(sp->own_ref);
     return NULL;
```

**File**: `src/search_disk.c` (modified, +26/-8)
```diff
@@ -37,7 +37,7 @@ static bool SearchDisk_ApplyResourceState(size_t registeredIndexCount) {
   return disk->basic.updateMemoryLimit(disk_db, diskMemoryLimitBytes, registeredIndexCount);
 }
 
-static size_t SearchDisk_RegisteredIndexCount(void) {
+static size_t SearchDisk_CountDiskIndexes(bool includeStaged) {
   if (!specDict_g) {
     return 0;
   }
@@ -48,32 +48,50 @@ static size_t SearchDisk_RegisteredIndexCount(void) {
   while ((entry = dictNext(iterator))) {
     StrongRef spec_ref = dictGetRef(entry);
     IndexSpec *spec = StrongRef_Get(spec_ref);
-    if (spec && spec->diskRegistered) {
+    if (spec && (spec->diskRegistered || (includeStaged && spec->pendingDiskRdbState))) {
       ++count;
     }
   }
   dictReleaseIterator(iterator);
   return count;
 }
 
-bool SearchDisk_CanCreateIndex(QueryError *status) {
-  RS_ASSERT(status);
-  const size_t nextCount = SearchDisk_RegisteredIndexCount() + 1;
+static size_t SearchDisk_RegisteredIndexCount(void) {
+  return SearchDisk_CountDiskIndexes(false);
+}
 
+static bool SearchDisk_HasMemoryForIndexCount(size_t count, bool restoring, QueryError *status) {
   const size_t percentage = RSGlobalConfig.diskMaxMemoryPercentage;
   if (diskMemoryLimitBytes == 0 || percentage == 0 || percentage > 100) {
     QueryError_SetError(status, QUERY_ERROR_CODE_DISK_CREATION,
-                        "Cannot create disk index: invalid Search disk memory configuration");
+                        restoring
+                            ? "Cannot restore disk index: invalid Search disk memory configuration"
+                            : "Cannot create disk index: invalid Search disk memory configuration");
     return false;
   }
   const size_t maximumMemory =
       (diskMemoryLimitBytes / 100) * percentage + ((diskMemoryLimitBytes % 100) * percentage) / 100;
 
   const size_t budgetPerIndex = RSGlobalConfig.diskWbmBudgetPerIndexMB * 1024 * 1024;
-  if (nextCount > maximumMemory / budgetPerIndex) {
+  if (count > maximumMemory / budgetPerIndex) {
     QueryError_SetError(
         status, QUERY_ERROR_CODE_DISK_CREATION,
-        "Cannot create disk index: write-buffer budget exceeds Search disk maximum memory");
+        restoring
+            ? "Cannot restore disk index: write-buffer budget exceeds Search disk maximum memory"
+            : "Cannot create disk index: write-buffer budget exceeds Search disk maximum memory");
+    return false;
+  }
+  return true;
+}
+
+bool SearchDisk_CanRestoreIndex(QueryError *status) {
+  RS_ASSERT(status);
+  return SearchDisk_HasMemoryForIndexCount(SearchDisk_CountDiskIndexes(true) + 1, true, status);
+}
+
+bool SearchDisk_CanCreateIndex(QueryError *status) {
+  RS_ASSERT(status);
+  if (!SearchDisk_HasMemoryForIndexCount(SearchDisk_RegisteredIndexCount() + 1, false, status)) {
     return false;
   }
 
```

**File**: `src/search_disk.h` (modified, +4/-3)
```diff
@@ -75,14 +75,15 @@ void SearchDisk_UpdateLogObfuscation();
  * search-disk-max-open-files cap.
  *
  * Applies only to new index creation. On success, charges the FD cap immediately; call
- * SearchDisk_ReleaseCreateFailure if the index does not end up opening. Restore paths always
- * proceed and let the disk backend clamp shared write-buffer capacity and FD usage instead of
- * rejecting the index.
+ * SearchDisk_ReleaseCreateFailure if the index does not end up opening.
  *
  * @param status Receives the reason creation was rejected.
  */
 bool SearchDisk_CanCreateIndex(QueryError *status);
 
+/** Reject an RDB-restored disk index if its write-buffer budget exceeds the configured maximum. */
+bool SearchDisk_CanRestoreIndex(QueryError *status);
+
 /**
  * @brief Undo the FD charge SearchDisk_CanCreateIndex applied, after a create attempt that it
  * admitted subsequently failed to open.
```

---

### Incident Patch 6: `b1b6903a` (2026-09-29)
**Commit Message**: [MOD-15685] Fix crash when a legacy index spec is restored after a failed replication sync (#11619)

[MOD-15685] Refuse a legacy index spec RESTORE after a failed load

The guard added in #10872 refused a legacy ft_index0 load when the legacy-spec
registry or the UPGRADE_INDEX rules were NULL, taking that as "no load in
progress". A failed load breaks that assumption: LOADING_FAILED clears the
loading flag but frees neither global, and the rules are only ever freed by a
successful load. On a server that has not completed a load since startup - for
example a replica whose first full sync failed and was then promoted - a
RESTORE of a truncated legacy payload got past the guard and crashed on the
NULL spec name.

Key the refusal on g_isLoading as well. The new test drives exactly that
sequence against a fake master; it crashes the server without the fix.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `src/spec.c` (modified, +5/-6)
```diff
@@ -3477,12 +3477,11 @@ void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   if (encver < LEGACY_INDEX_MIN_VERSION || encver > LEGACY_INDEX_MAX_VERSION) {
     return NULL;
   }
-  // Upgrading a legacy spec only makes sense while an RDB load is in progress. Both the UPGRADE_INDEX
-  // rules and the registry of legacy specs are built for the duration of a load and released at the end
-  // of it, so outside one - a RESTORE of a legacy payload on a running server, say - they are NULL and
-  // the lookups below would dereference NULL. Refuse instead: the caller sees a load failure, which for
-  // RESTORE surfaces as a command error.
-  if (legacySpecRules == NULL || legacySpecDict == NULL) {
+  // Upgrading a legacy spec only makes sense while an RDB load is in progress: the upgrade sweep that
+  // publishes it runs when the load ends. Outside one - a RESTORE of a legacy payload on a running
+  // server, say - refuse, so the caller sees a load failure, which for RESTORE is a command error.
+  // The globals alone are not enough: a failed load leaves both allocated.
+  if (!g_isLoading || legacySpecRules == NULL || legacySpecDict == NULL) {
     RedisModule_LogIOError(rdb, "warning",
                            "Refusing to load a legacy index outside of an RDB load");
     return NULL;
```

**File**: `tests/pytests/test_legacy_module_types.py` (modified, +66/-0)
```diff
@@ -12,6 +12,8 @@
 from includes import *
 from common import *
 from RLTest import Env
+from test_config import _grep_file_count
+from test_short_read import ShardMock
 
 # End-to-end coverage for the pre-2.0 module types (ft_invidx / numericdx / ft_tagidx). These keys
 # can only be created by deserializing an old payload, so RESTORE is the only way to get one into a
@@ -187,3 +189,67 @@ def testLegacyIndexSpecRestoreIsRefused(env):
         env.assertEqual(conn.execute_command('EXISTS', key), 0, message=key)
 
     env.assertTrue(env.isUp())
+
+
+def _fail_full_sync(env, shard_mock):
+    """Make the server a replica of `shard_mock` and cut its full sync short, so the load fails.
+
+    The load has to be diskless: a truncated RDB loaded from disk makes Redis exit instead of firing
+    `LOADING_FAILED`. `on-empty-db` needs an empty keyspace, but unlike `swapdb` it does not require
+    every module to support async loading."""
+    env.cmd('CONFIG', 'SET', 'repl-diskless-load', 'on-empty-db')
+    env.cmd('REPLICAOF', '127.0.0.1', shard_mock.server_port)
+    conn = shard_mock.GetConnection(timeout=10)
+    env.assertEqual(conn.read_request(), ['PING'])
+    conn.send_status('PONG')
+    req = conn.read_request()
+    while req[0] == 'REPLCONF':
+        conn.send_status('OK')
+        req = conn.read_request()
+    env.assertEqual(req[0], 'PSYNC')
+    conn.send_status('FULLRESYNC af4e30b5d14dce9f96fbb7769d0ec794cdc0bbcc 0')
+    # Announce more bytes than we send, then hang up mid-header.
+    conn.send(b'$1000\r\nREDIS')
+    conn.flush()
+    conn.close()
+
+    for _ in range(100):
+        try:
+            env.cmd('PING')
+            break
+        except redis.exceptions.BusyLoadingError:
+            time.sleep(0.1)
+    env.cmd('REPLICAOF', 'NO', 'ONE')
+
+
+@skip(cluster=True, redis_less_than='7.0.0')
+def testLegacyIndexSpecRestoreIsRefusedAfterFailedLoad(env):
+    """A failed load leaves the legacy-spec registry and the UPGRADE_INDEX rules allocated, so the
+    refusal must key on loading state, not on the globals. The rules are freed only when a load
+    succeeds, so this needs a server that has not completed one since startup - hence the restart
+    without an RDB. A replica whose first full sync failed and was then promoted is in that state."""
+    skipOnExistingEnv(env)
+    if env.useSlaves or env.useAof:
+        env.skip()
+
+    dbDir = env.cmd('CONFIG', 'GET', 'dir')[1]
+    rdbFilePath = os.path.join(dbDir, env.cmd('CONFIG', 'GET', 'dbfilename')[1])
+    logFilePath = os.path.join(dbDir, env.cmd('CONFIG', 'GET', 'logfile')[1])
+    env.stop()
+    if os.path.exists(rdbFilePath):
+        os.unlink(rdbFilePath)
+    env.start()
+
+    failedSyncMsg = 'Failed trying to load the MASTER synchronization DB'
+    failedSyncsBefore = _grep_file_count(logFilePath, failedSyncMsg)
+    with ShardMock(env) as shardMock:
+        _fail_full_sync(env, shardMock)
+    env.assertGreater(_grep_file_count(logFilePath, failedSyncMsg), failedSyncsBefore,
+                      message='the full sync did not fail, so this test proves nothing')
+
+    conn = _binary_conn(env)
+    # The name is stored as a string; a uint in its place makes the read fail, which crashed the
+    # server when the loader got that far.
+    payload = _dump_payload(conn, 'ft_index0', _module_uint(0), encver=16)
+    env.expect('RESTORE', 'idx:legacy', 0, payload).error().contains('Bad data format')
+    env.assertTrue(env.isUp())
```

---

### Incident Patch 7: `1fca862d` (2026-09-29)
**Commit Message**: Fix Redis crash on FT.SEARCH EXPLAINSCORE with a custom scorer that writes no explanation (#11603)

* Add test for EXPLAINSCORE with a scorer that writes no explanation

The example extension's example_scorer returns a score without filling in
the explanation. Querying it with WITHSCORES EXPLAINSCORE must still return
the score, with an empty explanation.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* Fix EXPLAINSCORE crash with scorers that write no explanation

EXPLAINSCORE hands every scorer a zeroed explanation node. Extension
scorers are not required to fill it in, and the example extension's
example_scorer does not, so the node's text stays NULL. recExplainReply
passed that NULL text to the reply as a simple string, which crashed
Redis on FT.SEARCH ... WITHSCORES EXPLAINSCORE SCORER <such scorer>.

Reply with an empty string for a missing explanation text, both for a
leaf and for a node with children. The reply keeps its shape, so the
coordinator, which requires a string for every explanation node, parses
shard replies unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `src/score_explain.c` (modified, +4/-2)
```diff
@@ -16,13 +16,15 @@
 
 static void recExplainReply(RedisModule_Reply *reply, const RSScoreExplain *scrExp, int depth) {
   int numChildren = scrExp->numChildren;
+  // Extension scorers are not required to write an explanation, so str can be NULL.
+  const char *text = scrExp->str ? scrExp->str : "";
 
   if (numChildren == 0 ||
      (depth >= REDIS_ARRAY_LIMIT - 1 && !isFeatureSupported(NO_REPLY_DEPTH_LIMIT))) {
-    RedisModule_Reply_SimpleString(reply, scrExp->str);
+    RedisModule_Reply_SimpleString(reply, text);
   } else {
     RedisModule_Reply_ArrayWithLen(reply, SE_REPLY_NODE_ARITY);
-    RedisModule_ReplyKV_ArrayWithLen(reply, scrExp->str, numChildren);
+    RedisModule_ReplyKV_ArrayWithLen(reply, text, numChildren);
     for (int i = 0; i < numChildren; i++) {
       recExplainReply(reply, &scrExp->children[i], depth + 2);
     }
```

**File**: `tests/pytests/test_ext.py` (modified, +25/-0)
```diff
@@ -55,3 +55,28 @@ def testExt(env):
     if not env.isCluster():
         res = env.cmd(config_cmd(), 'get', 'EXTLOAD')[0][1]
         env.assertContains('libexample_extension', res)
+
+
+@skip(enterprise=True, cluster=True)
+def testExplainScoreWithScorerThatDoesNotExplain(env):
+    """EXPLAINSCORE with an extension scorer that returns a score but never writes an
+    explanation (example_scorer) replies with an empty explanation."""
+    if env.env == 'existing-env' or NO_LIBEXT:
+        env.skip()
+
+    if os.path.isabs(EXTPATH):
+        ext_path = EXTPATH
+    else:
+        ext_path = os.path.abspath(os.path.join(os.path.dirname(env.module[0]), EXTPATH))
+
+    env = Env(moduleArgs=f'EXTLOAD {ext_path}')
+    env.expect('FT.CREATE', 'idx', 'ON', 'HASH', 'SCHEMA', 'f', 'TEXT').ok()
+    env.getConnection().execute_command('HSET', 'doc1', 'f', 'hello world')
+
+    res = env.cmd('FT.SEARCH', 'idx', 'hello', 'WITHSCORES', 'EXPLAINSCORE',
+                  'SCORER', 'example_scorer', 'NOCONTENT')
+    if env.protocol == 3:
+        env.assertEqual(res['results'][0]['score'], [3.141, ''], message=res)
+    else:
+        env.assertEqual(res, [1, 'doc1', ['3.141', '']])
+    env.expect('PING').equal(True)
```

---

### Incident Patch 8: `21b1c057` (2026-09-29)
**Commit Message**: [MOD-18899] Save the 8.10 vecsim RDB fixture in RDB format 13 (#11546)

* [MOD-18899] Save the 8.10 vecsim RDB fixture in RDB format 13

The fixture was saved by Redis 8.10.1, which writes RDB format 15.
Redis refuses to load an RDB whose format is newer than its own, so
servers that read at most format 13 or 14 abort while loading it. That
includes the Redis Enterprise 8.6 runtime that Redis Search Enterprise
tests against.

Regenerate it with the same Search 8.10.0 module and data on Redis
8.6.6, which writes format 13. The RediSearch payload is unchanged, so
the test still covers loading and resaving an index written by
Search 8.10.

The fixture gets a new name because getRDBFile() reuses any cached
copy with the same name, so hosts that already extracted the format-15
file would otherwise keep loading it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* Refresh bundled RDB fixtures atomically without versioned names

* Isolate bundled RDB fixture caches by checkout

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `tests/pytests/common.py` (modified, +12/-9)
```diff
@@ -34,11 +34,16 @@
 import inspect
 import math
 import tempfile
+import hashlib
 import faker
 import redis.client
 
 TEST_RDBS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_rdbs')
-REDISEARCH_CACHE_DIR = os.path.join(tempfile.gettempdir(), 'redisearch-rdbs')
+# Other checkouts must not replace a fixture before Redis opens it.
+REDISEARCH_CACHE_DIR = os.path.join(
+    tempfile.gettempdir(), 'redisearch-rdbs',
+    hashlib.sha256(os.fsencode(os.path.realpath(TEST_RDBS_DIR))).hexdigest(),
+)
 VECSIM_DATA_TYPES = ['FLOAT32', 'FLOAT64', 'FLOAT16', 'BFLOAT16']
 VECSIM_ALGOS = ['FLAT', 'HNSW', 'SVS-VAMANA']
 
@@ -1395,13 +1400,9 @@ def access_nested_list(lst, index):
     return result
 
 def getRDBFile(env, file_name, depth=0):
-    # Materialise a bundled RDB fixture from tests/pytests/test_rdbs/<file_name>.zip
-    # into REDISEARCH_CACHE_DIR/<file_name>. Extraction is idempotent: if the
-    # target file already exists with non-zero size we skip re-extracting.
+    # Refresh from the bundled ZIP: an existing copy may belong to another revision.
     src = os.path.join(TEST_RDBS_DIR, file_name + '.zip')
     dst = os.path.join(REDISEARCH_CACHE_DIR, file_name)
-    if os.path.exists(dst) and os.path.getsize(dst) > 0:
-        return True
     if not os.path.exists(src):
         env.assertTrue(
             False,
@@ -1410,10 +1411,12 @@ def getRDBFile(env, file_name, depth=0):
         )
         return False
     import zipfile
-    os.makedirs(os.path.dirname(dst), exist_ok=True)
     try:
-        with zipfile.ZipFile(src, 'r') as z:
-            z.extract(os.path.basename(file_name), os.path.dirname(dst))
+        os.makedirs(os.path.dirname(dst), exist_ok=True)
+        with zipfile.ZipFile(src, 'r') as z, tempfile.TemporaryDirectory(dir=os.path.dirname(dst)) as tmp:
+            extracted = z.extract(os.path.basename(file_name), tmp)
+            # Publish only complete files, including when test processes run in parallel.
+            os.replace(extracted, dst)
     except (zipfile.BadZipFile, KeyError, OSError) as e:
         env.assertTrue(
             False,
```

**File**: `tests/pytests/test_common.py` (modified, +75/-0)
```diff
@@ -6,6 +6,81 @@
 # GNU Affero General Public License v3 (AGPLv3).
 
 from common import *
+import common
+import importlib.util
+from pathlib import Path
+from unittest.mock import Mock, patch
+import zipfile
+
+
+@skip(cluster=True)
+def test_getRDBFile_isolates_checkouts(env):
+    """A later open must read this checkout's fixture after another checkout refreshes."""
+    with tempfile.TemporaryDirectory() as directory:
+        root = Path(directory)
+        name = 'fixture.rdb'
+        readers = []
+        for checkout, contents in [('checkout_a', b'REDIS0013'), ('checkout_b', b'REDIS0015')]:
+            source = root / checkout
+            fixtures = source / 'test_rdbs'
+            fixtures.mkdir(parents=True)
+            module_path = source / 'common.py'
+            module_path.write_bytes(Path(common.__file__).read_bytes())
+            spec = importlib.util.spec_from_file_location(checkout, module_path)
+            fixture_common = importlib.util.module_from_spec(spec)
+            with patch('tempfile.gettempdir', return_value=str(root / 'cache')):
+                spec.loader.exec_module(fixture_common)
+            with zipfile.ZipFile(fixtures / (name + '.zip'), 'w') as z:
+                z.writestr(name, contents)
+            env.assertTrue(fixture_common.getRDBFile(env, name))
+            link = source / 'dump.rdb'
+            link.symlink_to(Path(fixture_common.REDISEARCH_CACHE_DIR, name))
+            readers.append((link, contents))
+
+        for link, contents in readers:
+            env.assertEqual(link.read_bytes(), contents)
+
+
+@skip(cluster=True)
+def test_getRDBFile_refreshes_existing_fixture(env):
+    """Replacing a bundled fixture refreshes the cache without changing its name."""
+    with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as cache:
+        name = 'fixture.rdb'
+        archive = Path(source, name + '.zip')
+        destination = Path(cache, name)
+        destination.write_bytes(b'stale fixture')
+        with patch.multiple(common, TEST_RDBS_DIR=source, REDISEARCH_CACHE_DIR=cache):
+            for contents in (b'first fixture', b'updated fixture'):
+                with zipfile.ZipFile(archive, 'w') as z:
+                    z.writestr(name, contents)
+                previous = destination.read_bytes()
+                with destination.open('rb') as reader:
+                    env.assertTrue(getRDBFile(env, name))
+                    env.assertEqual(reader.read(), previous)
+                env.assertEqual(destination.read_bytes(), contents)
+                env.assertEqual(os.listdir(cache), [name])
+
+
+@skip(cluster=True)
+def test_getRDBFile_failed_extraction_preserves_existing_fixture(env):
+    """A ZIP checksum failure leaves the previous fixture intact and no temporary files."""
+    with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as cache:
+        name = 'fixture.rdb'
+        archive = Path(source, name + '.zip')
+        destination = Path(cache, name)
+        destination.write_bytes(b'previous fixture')
+        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as z:
+            z.writestr(name, b'new fixture')
+        archive.write_bytes(archive.read_bytes().replace(b'new fixture', b'bad fixture'))
+        failure_env = Mock(spec=Env)
+        with patch.multiple(common, TEST_RDBS_DIR=source, REDISEARCH_CACHE_DIR=cache):
+            env.assertFalse(getRDBFile(failure_env, name))
+        failure_env.assertTrue.assert_called_once_with(
+            False, message=ANY, depth=1,
+        )
+        env.assertContains('Bad CRC-32', failure_env.assertTrue.call_args.kwargs['message'])
+        env.assertEqual(destination.read_bytes(), b'previous fixture')
+        env.assertEqual(os.listdir(cache), [name])
 
 def test_compare_lists(env):
     #test types
```

---

### Incident Patch 9: `616bb810` (2026-09-27)
**Commit Message**: [MOD-14849] Fix FT.AGGREGATE WITHOUTCOUNT dropping a SORTBY that precedes GROUPBY (#11556)

* [MOD-14849] Fix bogus error from WITHOUTCOUNT SORTBY (no MAX) preceding GROUPBY

* Keep SORTBY sorters when a GROUPBY follows, under WITHOUTCOUNT

* Skip the sort-key plan scan when the optimizer is already off

**File**: `src/query_optimizer.c` (modified, +17/-0)
```diff
@@ -42,6 +42,16 @@ void QOptimizer_Free(QOptimizer *opt) {
   rm_free(opt);
 }
 
+static bool planHasSortKeys(const AGGPlan *pln) {
+  DLLIST_FOREACH(nn, &pln->steps) {
+    const PLN_BaseStep *stp = DLLIST_ITEM(nn, PLN_BaseStep, llnodePln);
+    if (stp->type == PLN_T_ARRANGE && array_len(((const PLN_ArrangeStep *)stp)->sortKeys)) {
+      return true;
+    }
+  }
+  return false;
+}
+
 void QOptimizer_Parse(AREQ *req) {
   QOptimizer *opt = req->optimizer;
   RedisSearchCtx *sctx = AREQ_SearchCtx(req);
@@ -68,6 +78,13 @@ void QOptimizer_Parse(AREQ *req) {
     }
   }
 
+  // Q_OPT_NO_SORTER drops every sorter in the pipeline, but AGPLN_GetArrangeStep
+  // only sees the arrange step after the last GROUPBY. A SORTBY anywhere earlier
+  // must still be sorted, so rule NO_SORTER out.
+  if (!opt->field && opt->type != Q_OPT_NONE && planHasSortKeys(AREQ_AGGPlan(req))) {
+    opt->type = Q_OPT_NONE;
+  }
+
   // get scorer function if there is no sortby
   if (opt->field) {
     opt->scorerType = SCORER_TYPE_NONE;
```

**File**: `tests/pytests/test_aggregate.py` (modified, +64/-0)
```diff
@@ -1756,3 +1756,67 @@ def testWithoutCountWithSortBy(env):
         res_withcount = conn.execute_command(*query_withcount)
         res_withoutcount = conn.execute_command(*query_withoutcount)
         env.assertEqual(res_withoutcount[1:], res_withcount[1:])
+
+
+def testAggregateWithoutCountSortByThenGroupBy(env):
+    """Test SORTBY (no MAX) followed by GROUPBY, with WITHOUTCOUNT"""
+    env.expect('FT.CREATE', 'idx', 'ON', 'HASH', 'SCHEMA',
+               'title', 'TEXT', 'SORTABLE', 'brand', 'TAG', 'SORTABLE').ok()
+    conn = getConnectionByEnv(env)
+    conn.execute_command('HSET', 'doc:1', 'title', 'zeta', 'brand', 'acme')
+    conn.execute_command('HSET', 'doc:2', 'title', 'alpha', 'brand', 'acme')
+    conn.execute_command('HSET', 'doc:3', 'title', 'mike', 'brand', 'acme')
+
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'SORTBY', '1', '@title',
+        'GROUPBY', '1', '@brand', 'REDUCE', 'COUNT', '0', 'AS', 'cnt')
+    env.assertEqual(res, [1, ['brand', 'acme', 'cnt', '3']])
+
+    # A LIMIT after the GROUPBY adds a trailing arrange step without sort keys.
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'SORTBY', '1', '@title',
+        'GROUPBY', '1', '@brand', 'REDUCE', 'COUNT', '0', 'AS', 'cnt',
+        'LIMIT', '0', '10')
+    env.assertEqual(res, [1, ['brand', 'acme', 'cnt', '3']])
+
+    # A SORTBY between two GROUPBYs.
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'GROUPBY', '1', '@brand', 'REDUCE', 'COUNT', '0', 'AS', 'cnt',
+        'SORTBY', '2', '@cnt', 'DESC',
+        'GROUPBY', '1', '@cnt', 'REDUCE', 'COUNT', '0', 'AS', 'num')
+    env.assertEqual(res, [1, ['cnt', '3', 'num', '1']])
+
+
+def testAggregateWithoutCountSortByThenGroupByFirstValueOrdering(env):
+    """Test SORTBY preceding GROUPBY must still order rows seen by order-sensitive reducers"""
+    env.expect('FT.CREATE', 'idx', 'ON', 'HASH', 'SCHEMA',
+               'title', 'TEXT', 'SORTABLE', 'brand', 'TAG', 'SORTABLE').ok()
+    conn = getConnectionByEnv(env)
+    # Inserted out of title order, so a dropped sorter would surface as the wrong FIRST_VALUE.
+    conn.execute_command('HSET', 'doc:1', 'title', 'zeta', 'brand', 'acme')
+    conn.execute_command('HSET', 'doc:2', 'title', 'alpha', 'brand', 'acme')
+    conn.execute_command('HSET', 'doc:3', 'title', 'mike', 'brand', 'acme')
+
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'SORTBY', '2', '@title', 'ASC',
+        'GROUPBY', '1', '@brand', 'REDUCE', 'FIRST_VALUE', '1', '@title', 'AS', 'first')
+    env.assertEqual(res, [1, ['brand', 'acme', 'first', 'alpha']])
+
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'SORTBY', '2', '@title', 'DESC',
+        'GROUPBY', '1', '@brand', 'REDUCE', 'FIRST_VALUE', '1', '@title', 'AS', 'first')
+    env.assertEqual(res, [1, ['brand', 'acme', 'first', 'zeta']])
+
+    # MAX must keep the top rows by @title, not the first rows in index order.
+    res = env.cmd(
+        'FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+        'SORTBY', '2', '@title', 'ASC', 'MAX', '1',
+        'GROUPBY', '1', '@brand',
+        'REDUCE', 'FIRST_VALUE', '1', '@title', 'AS', 'first',
+        'REDUCE', 'COUNT', '0', 'AS', 'cnt')
+    env.assertEqual(res, [1, ['brand', 'acme', 'first', 'alpha', 'cnt', '1']])
```

**File**: `tests/pytests/test_aggregate_count.py` (modified, +21/-18)
```diff
@@ -798,7 +798,7 @@ def _test_profile(protocol):
         # WITHOUTCOUNT + SORTBY + MAX -> GROUPBY
         (['FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT', 'SORTBY', 1, '@title', 'MAX', 50,
           'GROUPBY', 1, '@brand', 'REDUCE', 'COUNT', 0, 'AS', 'cnt'],
-         [('Index', 49), ('Pager/Limiter', 50), ('Grouper', 25)],
+         [('Index', 3100), ('Sorter', 50), ('Grouper', 25)],
          [[[('Index', 1027), ('Sorter', 50), ('Loader', 50)],
            [('Index', 1032), ('Sorter', 50), ('Loader', 50)],
            [('Index', 1041), ('Sorter', 50), ('Loader', 50)]],
@@ -819,7 +819,7 @@ def _test_profile(protocol):
           'SORTBY', 2, '@price', 'DESC', 'MAX', 200,
           'GROUPBY', 1, '@brand', 'REDUCE', 'COUNT', 0, 'AS', 'cnt',
           'FILTER', '@cnt > 5'],
-         [('Index', 199), ('Loader', 199), ('Pager/Limiter', 200), ('Grouper', 25), ('Filter - Predicate >', 25)],
+         [('Index', 3100), ('Loader', 3100), ('Sorter', 200), ('Grouper', 25), ('Filter - Predicate >', 25)],
          [[[('Index', 1027), ('Loader', 1027), ('Sorter', 200), ('Loader', 200)],
            [('Index', 1032), ('Loader', 1032), ('Sorter', 200), ('Loader', 200)],
            [('Index', 1041), ('Loader', 1041), ('Sorter', 200), ('Loader', 200)]],
@@ -835,22 +835,25 @@ def _test_profile(protocol):
            [('Index', 1041), ('Grouper', 25)]],
            [('Network', 75), ('Grouper', 25), ('Grouper', 1)]]),
 
-        # MOD-14849: WITHOUTCOUNT + SORTBY (no MAX) + GROUPBY returns
-        # "Success (not an error)". Uncomment when MOD-14849 is fixed.
-        #
-        # # WITHOUTCOUNT + SORTBY -> GROUPBY
-        # (['FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT', 'SORTBY', 1, '@title',
-        #   'GROUPBY', 1, '@brand', 'REDUCE', 'COUNT', 0, 'AS', 'cnt'],
-        #  [<TBD standalone profile>],
-        #  [<TBD cluster profile>]),
-        #
-        # # WITHOUTCOUNT + GROUPBY -> SORTBY -> GROUPBY (mixed pipeline)
-        # (['FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
-        #   'GROUPBY', 1, '@category', 'REDUCE', 'COUNT', 0, 'AS', 'cnt',
-        #   'SORTBY', 2, '@cnt', 'DESC',
-        #   'GROUPBY', 1, '@cnt', 'REDUCE', 'COUNT', 0, 'AS', 'num_categories'],
-        #  [<TBD standalone profile>],
-        #  [<TBD cluster profile>]),
+        # WITHOUTCOUNT + SORTBY -> GROUPBY
+        (['FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT', 'SORTBY', 1, '@title',
+          'GROUPBY', 1, '@brand', 'REDUCE', 'COUNT', 0, 'AS', 'cnt'],
+         [('Index', 3100), ('Sorter', 10), ('Grouper', 7)],
+         [[[('Index', 1027), ('Sorter', 10), ('Loader', 10)],
+           [('Index', 1032), ('Sorter', 10), ('Loader', 10)],
+           [('Index', 1041), ('Sorter', 10), ('Loader', 10)]],
+           [('Network', 30), ('Sorter', 10), ('Grouper', 7)]]),
+
+        # WITHOUTCOUNT + GROUPBY -> SORTBY -> GROUPBY (mixed pipeline)
+        (['FT.AGGREGATE', 'idx', '*', 'WITHOUTCOUNT',
+          'GROUPBY', 1, '@brand', 'REDUCE', 'COUNT', 0, 'AS', 'cnt',
+          'SORTBY', 2, '@cnt', 'DESC',
+          'GROUPBY', 1, '@cnt', 'REDUCE', 'COUNT', 0, 'AS', 'num_brands'],
+         [('Index', 3100), ('Grouper', 25), ('Sorter', 10), ('Grouper', 1)],
+         [[[('Index', 1027), ('Grouper', 25)],
+           [('Index', 1032), ('Grouper', 25)],
+           [('Index', 1041), ('Grouper', 25)]],
+           [('Network', 75), ('Grouper', 25), ('Sorter', 10), ('Grouper', 1)]]),
 
     ]
 
```

---

### Incident Patch 10: `f17074ab` (2026-09-27)
**Commit Message**: [MOD-17811] Remove the fixed index count limit for Flex (disk) indexes (#11573)

[MOD-17811] Remove the fixed Flex index count limit

Disk (Flex) indexes were capped by the compile-time FLEX_MAX_INDEX_COUNT,
enforced on FT.CREATE, FT._RESTOREIFNX and RDB load. Index admission on
disk is now bounded by the resources each index actually acquires, so a
fixed count cap is redundant. Dropping it from the load paths also means a
replica or restarted shard never refuses index definitions the primary
already accepted. The global maxIndexes_g bound still applies.

Removes the SEARCH_FLEX_LIMIT_NUMBER_OF_INDEXES error code.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `docs/design/search_on_disk_mvp_feature_blocking.md` (modified, +0/-1)
```diff
@@ -201,7 +201,6 @@ Since SLOP is blocked for Disk mode (see above), any scorer that relies on SLOP
 
 | Feature | Should Block? | Actually Blocked? | Code Location |
 |---------|---------------|-------------------|---------------|
-| Max 10 indexes | ✅ Yes | ✅ BLOCKED | `search_disk_utils.c:13-18` - `FLEX_MAX_INDEX_COUNT` check |
 | WORKERS = 0 | ✅ Yes | ✅ BLOCKED | Corrected to 1 automatically |
 
 ---
```

**File**: `src/indexes.c` (modified, +0/-4)
```diff
@@ -302,10 +302,6 @@ int Indexes_RdbLoad(RedisModuleIO *rdb, int encver, int when) {
         nIndexes, maxIndexes_g);
     return REDISMODULE_ERR;
   }
-  if (!SearchDisk_CheckLimitNumberOfIndexes(nIndexes)) {
-    RedisModule_LogIOError(rdb, "warning", "Too many indexes for flex. Having %zu indexes, but flex only supports %d.", nIndexes, FLEX_MAX_INDEX_COUNT);
-    return REDISMODULE_ERR;
-  }
   for (size_t i = 0; i < nIndexes; ++i) {
     // Load one spec (parse + duplicate detection + disk open), then publish it
     // into the registry.
```

**File**: `src/module.c` (modified, +0/-11)
```diff
@@ -655,13 +655,6 @@ int CreateIndexCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc)
   }
   QueryError status = QueryError_Default();
 
-  if (!SearchDisk_CheckLimitNumberOfIndexes(Indexes_Count() + 1)) {
-    QueryError_SetWithoutUserDataFmt(&status, QUERY_ERROR_CODE_FLEX_LIMIT_NUMBER_OF_INDEXES, "Max number of indexes reached for Flex indexes: %zu", Indexes_Count());
-    RedisModule_ReplyWithError(ctx, QueryError_GetUserError(&status));
-    QueryError_ClearError(&status);
-    return REDISMODULE_OK;
-  }
-
   IndexSpec *sp = Indexes_CreateNewSpec(ctx, argv, argc, &status);
   if (sp == NULL) {
     RedisModule_ReplyWithError(ctx, QueryError_GetUserError(&status));
@@ -1332,10 +1325,6 @@ int RestoreSchema(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
     return RedisModule_ReplyWithError(ctx, "ERRBADVAL Invalid encoding version");
   }
 
-  if (!SearchDisk_CheckLimitNumberOfIndexes(Indexes_Count() + 1)) {
-    return RedisModule_ReplyWithErrorFormat(ctx, "ERRBADVAL Max number of indexes reached for Flex indexes: %zu", Indexes_Count());
-  }
-
   IndexSpec *sp = IndexSpec_Deserialize(argv[3], encodeVersion);
   int rc = Indexes_StoreSpecAfterRdbLoad(sp);
 
```

**File**: `src/redisearch_rs/headers/query_error.h` (modified, +0/-1)
```diff
@@ -88,7 +88,6 @@ enum QueryErrorCode
   QUERY_ERROR_CODE_VECTOR_NOT_ALLOWED,
   QUERY_ERROR_CODE_OUT_OF_MEMORY,
   QUERY_ERROR_CODE_UNAVAILABLE_SLOTS,
-  QUERY_ERROR_CODE_FLEX_LIMIT_NUMBER_OF_INDEXES,
   QUERY_ERROR_CODE_FLEX_UNSUPPORTED_FIELD,
   QUERY_ERROR_CODE_FLEX_UNSUPPORTED_FT_CREATE_ARGUMENT,
   QUERY_ERROR_CODE_DISK_CREATION,
```

**File**: `src/redisearch_rs/query_error/src/lib.rs` (modified, +0/-6)
```diff
@@ -87,7 +87,6 @@ pub enum QueryErrorCode {
     VectorNotAllowed,
     OutOfMemory,
     UnavailableSlots,
-    FlexLimitNumberOfIndexes,
     FlexUnsupportedField,
     FlexUnsupportedFTCreateArgument,
     DiskCreation,
@@ -411,11 +410,6 @@ impl QueryErrorCode {
                 default_msg: c"Query requires unavailable slots",
                 default_full_msg: c"SEARCH_SLOTS_UNAVAIL Query requires unavailable slots",
             },
-            Self::FlexLimitNumberOfIndexes => ErrorCodeStrings {
-                prefix: c"SEARCH_FLEX_LIMIT_NUMBER_OF_INDEXES ",
-                default_msg: c"Flex index limit was reached",
-                default_full_msg: c"SEARCH_FLEX_LIMIT_NUMBER_OF_INDEXES Flex index limit was reached",
-            },
             Self::FlexUnsupportedField => ErrorCodeStrings {
                 prefix: c"SEARCH_FLEX_UNSUPPORTED_FIELD ",
                 default_msg: c"Unsupported field for Flex index",
```

#### Recent Merged Pull Requests:
- **PR #11674** (2026-09-30): [2.8] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11671** (2026-09-30): [8.2] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11670** (2026-09-30): [8.4] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11669** (2026-09-30): [8.6-rse] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11668** (2026-09-30): [8.6] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11667** (2026-09-30): [8.8] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11666** (2026-09-30): [8.10] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])
- **PR #11665** (2026-09-30): [8.8-rse] Fix intermittent Rocky Linux 8 CI failures when installing gcc (@redisearch-backport-pull-request[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
