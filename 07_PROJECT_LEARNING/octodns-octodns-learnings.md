# Forensic Learning Record (Deep Inspection): octodns/octodns

> **Canonical Artifact**: `07_PROJECT_LEARNING/octodns-octodns-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/octodns/octodns](https://github.com/octodns/octodns))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:34.298Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `octodns/octodns`
- **Description**: Tools for managing DNS across multiple providers
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3769 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `octodns/__init__.py`
```
'OctoDNS: DNS as code - Tools for managing DNS across multiple providers'

# TODO: remove __VERSION__ w/2.x
__version__ = __VERSION__ = '1.22.0'

```

### Core Architecture Module: `octodns/cmds/__init__.py`
```
#
#
#

```

### Core Architecture Module: `octodns/cmds/args.py`
```
#
#
#

from argparse import ArgumentParser as _Base
from logging import DEBUG, INFO, WARNING, Formatter, StreamHandler, getLogger
from logging.config import dictConfig
from logging.handlers import SysLogHandler
from sys import stderr, stdout

from octodns import __version__
from octodns.yaml import safe_load


class ArgumentParser(_Base):
    '''
    Manages argument parsing and adds some defaults and takes action on them.

    Also manages logging setup.
    '''

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def parse_args(self, default_log_level=INFO):
        version = f'octoDNS {__version__}'
        self.add_argument(
            '--version',
            action='version',
            version=version,
            help='Print octoDNS version and exit',
        )
        self.add_argument(
            '--log-stream-stdout',
            action='store_true',
            default=False,
            help='Log to stdout instead of stderr',
        )
        _help = 'Send logging data to syslog in addition to stderr'
        self.add_argument(
            '--log-syslog', action='store_true', default=False, help=_help
        )
        self.add_argument(
            '--syslog-device', default='/dev/log', help='Syslog device'
        )
        self.add_argument(
            '--syslog-facility', default='local0', help='Syslog facility'
        )

        _help = 'Increase verbosity to get details and help track down issues'
        self.add_argument(
            '--debug', action='store_true', default=False, help=_help
        )

        _help = 'Decrease verbosity to show only warnings, errors, and the plan'
        self.add_argument(
            '--quiet', action='store_true', default=False, help=_help
        )

        _help = 'Configure logging with a YAML file, see https://docs.python.org/3/library/logging.config.html#logging-config-dictschema for schema details'
        self.add_argument('--logging-config', default=False, help=_help)

        args = super().parse_args()
        self._setup_logging(args, default_log_level)
        return args

    def _setup_logging(self, args, default_log_level):
        if args.logging_config:
            with open(args.logging_config) as fh:
                config = safe_load(fh.read(), enforce_order=False)
            dictConfig(config)
            # if we're provided a logging_config we won't do any of our normal
            # configuration
            return

        # 7 is the length of the largest logging level, warning, that we're concerned with aligning.
        fmt = '%(asctime)s [%(thread)d] %(levelname)-7s %(name)s %(message)s'
        formatter = Formatter(fmt=fmt, datefmt='%Y-%m-%dT%H:%M:%S ')
        stream = stdout if args.log_stream_stdout else stderr
        handler = StreamHandler(stream=stream)
        handler.setFormatter(formatter)
        logger = getLogger()
        logger.addHandler(handler)

        if args.log_syslog:
            fmt = 'octodns[%(process)-5s:%(thread)d]: %(name)s %(levelname)-5s %(message)s'
            handler = SysLogHandler(
                address=args.syslog_device, facility=args.syslog_facility
            )
            handler.setFormatter(Formatter(fmt=fmt))
            logger.addHandler(handler)

        logger.level = default_log_level
        if args.debug:
            logger.level = DEBUG
        elif args.quiet:
            logger.level = WARNING
            # we still want plans to come out during quite so set the plan
            # logger output to info in case the PlanLogger is being used
            getLogger('Plan').setLevel(INFO)

```

### Core Architecture Module: `octodns/cmds/compare.py`
```
#!/usr/bin/env python
'''
Octo-DNS Comparator
'''

import sys
from pprint import pprint

from octodns.cmds.args import ArgumentParser
from octodns.manager import Manager


def main():
    parser = ArgumentParser(description=__doc__.split('\n')[1])

    parser.add_argument(
        '--config-file',
        required=True,
        help='The Manager configuration file to use',
    )
    parser.add_argument(
        '--a',
        nargs='+',
        required=True,
        help='First source(s) to pull data from',
    )
    parser.add_argument(
        '--b',
        nargs='+',
        required=True,
        help='Second source(s) to pull data from',
    )
    parser.add_argument(
        '--zone', default=None, required=True, help='Zone to compare'
    )
    parser.add_argument(
        '--ignore-prefix',
        default=None,
        required=False,
        help='Record prefix to ignore from list of changes',
    )
    args = parser.parse_args()

    manager = Manager(args.config_file)
    changes = manager.compare(args.a, args.b, args.zone)

    # Filter changes list based on ignore-prefix argument if present
    if args.ignore_prefix:
        pattern = args.ignore_prefix
        changes = [c for c in changes if not c.record.fqdn.startswith(pattern)]

    pprint(changes)

    # Exit with non-zero exit code if changes exist
    if len(changes):
        sys.exit(1)


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `octodns/cmds/dump.py`
```
#!/usr/bin/env python
'''
Octo-DNS Dumper
'''

from octodns.cmds.args import ArgumentParser
from octodns.manager import Manager


def main():
    parser = ArgumentParser(description=__doc__.split('\n')[1])

    parser.add_argument(
        '--config-file',
        required=True,
        help='The Manager configuration file to use',
    )
    parser.add_argument(
        '--output-dir',
        required=True,
        help='The directory into which the results will be written (Note: will overwrite existing files)',
    )
    parser.add_argument(
        '--output-provider',
        required=False,
        help='The configured provider to use when dumping records. Must support copy() and directory',
    )
    parser.add_argument(
        '--lenient',
        action='store_true',
        default=False,
        help='Ignore record validations and do a best effort dump',
    )
    parser.add_argument(
        '--split',
        action='store_true',
        default=False,
        help='Split the dumped zone into a YAML file per record',
    )
    parser.add_argument(
        'zone',
        help="Zone to dump, '*' (single quoted to avoid expansion) for all configured zones",
    )
    parser.add_argument('source', nargs='+', help='Source(s) to pull data from')

    args = parser.parse_args()

    manager = Manager(args.config_file)
    manager.dump(
        zone=args.zone,
        output_dir=args.output_dir,
        output_provider=args.output_provider,
        lenient=args.lenient,
        split=args.split,
        sources=args.source,
    )


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `octodns/cmds/report.py`
```
#!/usr/bin/env python
'''
Octo-DNS Reporter
'''

from asyncio import Semaphore, new_event_loop, wait
from collections import defaultdict
from csv import QUOTE_NONE, writer
from io import StringIO
from ipaddress import ip_address
from json import dump
from logging import getLogger
from sys import exit

from dns.asyncresolver import Resolver as AsyncResolver
from dns.resolver import (
    NXDOMAIN,
    YXDOMAIN,
    LifetimeTimeout,
    NoAnswer,
    NoNameservers,
    resolve,
)

from octodns.cmds.args import ArgumentParser
from octodns.manager import Manager


async def async_resolve(record, resolver, timeout, limit):
    async with limit:
        r = AsyncResolver(configure=False)
        r.lifetime = timeout
        r.nameservers = [resolver]

        try:
            query = await r.resolve(qname=record.fqdn, rdtype=record._type)
            answer = sorted([str(a) for a in query])
        except (NoAnswer, NoNameservers):
            answer = ['*no answer*']
        except NXDOMAIN:
            answer = ['*does not exist*']
        except YXDOMAIN:
            answer = ['*should not exist*']
        except LifetimeTimeout:
            answer = ['*timeout*']

    return [record, resolver, answer]


def main():
    parser = ArgumentParser(description=__doc__.split('\n')[1])

    parser.add_argument(
        '--config-file',
        required=True,
        help='The Manager configuration file to use',
    )
    parser.add_argument('--zone', required=True, help='Zone to dump')
    parser.add_argument(
        '--source',
        required=True,
        default=[],
        action='append',
        help='Source(s) to pull data from',
    )
    parser.add_argument(
        '--concurrency',
        type=int,
        default=4,
        help='Maximum number of concurrent DNS queries',
    )
    parser.add_argument(
        '--timeout',
        type=float,
        default=1,
        help='Number seconds to wait for an answer',
    )
    parser.add_argument(
        '--output-format',
        choices=['csv', 'json'],
        default='csv',
        help='Output format',
    )
    parser.add_argument(
        '--lenient',
        action='store_true',
        default=False,
        help='Ignore record validations and do a best effort dump',
    )
    parser.add_argument('server', nargs='+', help='DNS resolver to query')

    args = parser.parse_args()
    concurrency = args.concurrency
    timeout = args.timeout
    output_format = args.output_format

    manager = Manager(args.config_file)

    log = getLogger('report')
    log.info(f'concurrency={concurrency} timeout={timeout}')

    try:
        sources = [manager.providers[source] for source in args.source]
    except KeyError as e:
        raise Exception(f'Unknown source: {e.args[0]}')

    zone = manager.get_zone(args.zone)
    for source in sources:
        source.populate(zone, lenient=args.lenient)
    zone.validate(lenient=args.lenient)

    servers = args.server
    resolvers = []
    for server in servers:
        resolver = None
        is_hostname = False

        try:
            ip = ip_address(server)
            # "2001:4860:4860:0:0:0:0:8888" => "2001:4860:4860::8888"
            resolver = ip.compressed

        # The specified server isn't a valid IP address, maybe it's a valid
        # hostname? So we try to resolve it.
        except ValueError:
            # IPv4 first, then IPv6.
            for rrtype in ['A', 'AAAA']:
                try:
                    query = resolve(server, rrtype)
                    resolver = str(query.rrset[0])
                    is_hostname = True
                    # Exit on first IP address found.
                    break

                # NXDOMAIN, NoAnswer, NoNameservers...
                except Exception:
                    continue

        if resolver and resolver not in resolvers:
            if not is_hostname:
                log.info(f'server={resolver}')
            else:
                log.info(f'server={resolver} ({server})')

            resolvers.append(resolver)

    if not resolvers:
        print(f'Error: No valid resolver specified ({", ".join(servers)})')
        exit(1)

    loop = new_event_loop()
    limit = Semaphore(concurrency)
    tasks = []
    for record in sorted(zone.records):
        for resolver in resolvers:
            tasks.append(
                loop.create_task(
                    async_resolve(record, resolver, timeout, limit)
                )
            )

    queries = defaultdict(dict)
    done, _ = loop.run_until_complete(wait(tasks))
    for task in done:
        _record, _resolver, _answer = task.result()
        queries[_record][_resolver] = _answer

    loop.close()

    output = StringIO()
    if output_format == 'csv':
        csvout = writer(output, quoting=QUOTE_NONE, quotechar=None)
        csvheader = ['Name', 'Type', 'TTL']
        csvheader = [*csvheader, *resolvers]
        csvheader.append('Consistent')
        csvout.writerow(csvheader)

        for record, answers in sorted(queries.items()):
            csvrow = [record.decoded_fqdn, record._type, record.ttl]
            values_check = {}

            for resolver in resolvers:
                answer = ' '.join(answers.get(resolver, []))
                values_check[answer.lower()] = True
                csvrow.append(answer)

            csvrow.append(bool(len(values_check) == 1))
            csvout.writerow(csvrow)

    elif output_format == 'json':
        jsonout = defaultdict(lambda: defaultdict(dict))
        for record, answers in sorted(queries.items()):
            values_check = {}

            for resolver in resolvers:
                # Stripping the surrounding quotes of TXT records values to
                # avoid them being unnecessarily escaped by JSON module.
                answer = [a.strip('"') for a in answers.get(resolver, [])]
                jsonout[record.decoded_fqdn][record._type][resolver] = answer
                values_check[' '.join(answer).lower()] = True

            jsonout[record.fqdn][record._type]['consistent'] = bool(
                len(values_check) == 1
            )

        dump(jsonout, output)

    print(output.getvalue())
    output.close()


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `octodns/cmds/schema.py`
```
#!/usr/bin/env python
'''
octoDNS JSON Schema generator for zone or config YAML files
'''

import json
import sys

from octodns.cmds.args import ArgumentParser
from octodns.schema import build_config_schema, build_zone_schema


def main():
    parser = ArgumentParser(description=__doc__.split('\n')[1])

    parser.add_argument(
        '--kind',
        choices=['zone', 'config'],
        default='zone',
        help='Which schema to emit: zone (default) or config',
    )
    parser.add_argument(
        '--indent',
        type=int,
        default=2,
        help='Number of spaces to indent the JSON output (default: 2)',
    )
    parser.add_argument(
        '--output',
        default=None,
        help='Write schema to this file instead of stdout',
    )

    args = parser.parse_args()

    if args.kind == 'config':
        schema = build_config_schema()
    else:
        schema = build_zone_schema()

    data = json.dumps(schema, indent=args.indent, sort_keys=True)

    if args.output:
        with open(args.output, 'w') as fh:
            fh.write(data)
            fh.write('\n')
    else:
        sys.stdout.write(data)
        sys.stdout.write('\n')


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `octodns/cmds/sync.py`
```
#!/usr/bin/env python
'''
Octo-DNS Multiplexer
'''

from octodns.cmds.args import ArgumentParser
from octodns.manager import Manager


def main():
    parser = ArgumentParser(description=__doc__.split('\n')[1])

    parser.add_argument(
        '--config-file',
        required=True,
        help='The Manager configuration file to use',
    )
    parser.add_argument(
        '--doit',
        action='store_true',
        default=False,
        help='Whether to take action or just show what would change, ignored when Manager.enable_checksum is used',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        default=False,
        help='Acknowledge that significant changes are being made and do them',
    )
    parser.add_argument(
        '--checksum',
        default=None,
        help="Provide the expected checksum, apply will only continue if it matches the plan's computed checksum",
    )

    parser.add_argument(
        'zone',
        nargs='*',
        default=[],
        help='Limit sync to the specified zone(s)',
    )

    parser.add_argument(
        '--source',
        default=[],
        action='append',
        help='Limit sync to zones with the specified source(s) (all sources will be synchronized for the selected zones)',
    )
    parser.add_argument(
        '--target',
        default=[],
        action='append',
        help='Limit sync to the specified target(s)',
    )

    args = parser.parse_args()

    manager = Manager(args.config_file)
    manager.sync(
        eligible_zones=args.zone,
        eligible_sources=args.source,
        eligible_targets=args.target,
        dry_run=not args.doit,
        force=args.force,
        checksum=args.checksum,
    )


if __name__ == '__main__':
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1088** (2023-10-22): **"dns.exception.SyntaxError: string too long" when updating DKIM TXT record**
  *Symptoms*: It appears that octodns-bind doesn't chunk long lines when attempting to update records.  Following is a lightly-edited excerpt of one attempt:  ``` $ octodns-sync --config-file config/main.yml --doit --force 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: config_file=config/main.yml (octoDNS 0.9.21) 2023-05-01T19:27:06  [140206852075520] INFO  Manager _config_executor: max_workers=2 2023-05-01T19:27:06  [140206852075520] INFO  Manager _config_include_meta: include_meta=False 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: global_processors=[] 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=cloudflare (octodns_cloudflare 0.0.2) 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=digitalocean (octodns_digitalocean 0.0.2) 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=publicdns (octodns_bind 0.0.1) 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=writeyaml (octodns.provider.yaml 0.9.21) 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=yaml (octodns.provider.yaml 0.9.21) 2023-05-01T19:27:06  [140206852075520] INFO  Manager __init__: provider=zonefile (octodns_bind 0.0.1) 2023-05-01T19:27:06  [140206852075520] INFO  Manager sync: eligible_zones=[], eligible_targets=[], dry_run=False, force=True, plan_output_fh=<stdout> 2023-05-01T19:27:06  [140206852075520] INFO  Manager sync:   zone=gear.email. 2023-05-01T19:27:06  [1402
  **Post-Mortem & Fix Analysis**:
  > Hi @yzguy - if this is a good first issue, I'm happy to tackle it, but when I dug into the files mentioned in the exception stack, it wasn't obvious to me where the chunking was supposed to happen.  Can you provide any pointers?
  > @paulgear So this may not be as easy as I assumed.   Generally in other providers we have methods for [params_for](https://github.com/octodns/octodns-digitalocean/blob/main/octodns_digitalocean/__init__.py#L313) and [data_for](https://github.com/octodns/octodns-digitalocean/blob/main/octodns_digitalocean/__init__.py#L226) which allow us to translate OctoDNS data structures <-> Provider APIs. These methods are where this chunking logic happens, however in the case of this bind one, we don't have those.  So when those actions are happening some logic/process needs to handle going to those methods when necessary, but ideally we aren't just doing it for the record types we need. So the method above definitely is the way to go as it's quite standard across all the providers.  
  > This issue is stale because it has been open 90 days with no activity. Remove stale label or comment or this will be closed in 7 days.

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

### Incident Patch 1: `47716e77` (2026-08-21)
**Commit Message**: Fix mergers docs: valid sources/targets and TXT/SPF risk note

**File**: `.changelog/54f84404c1094fb4ae65dca976ab8fb0.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix mergers docs: valid sources/targets and TXT/SPF risk note
```

**File**: `docs/configuration.rst` (modified, +30/-11)
```diff
@@ -588,7 +588,12 @@ Mergers
 A *merger* combines two records that share the same name and type into a
 single record. Unlike processors, which run for every record, a merger is
 opt-in and only ever *adds* values to a merge — it can never remove or replace
-them, so a merge is always a safe superset.
+them, so the merged values are always a superset of the inputs. That is safe
+for CAA, where unioning within a ``tag`` only adds policy entries. TXT is
+different: ``txt`` keeps every distinct text value, so merging two sources that
+each carry a ``v=spf1 ...`` TXT value produces one RRset with multiple SPF
+policies, which is invalid. Only enable ``txt`` where combining TXT values is
+known to be safe, and prefer scoping it per-zone rather than globally.
 
 Two levels of configuration decide which mergers run:
 
@@ -608,16 +613,23 @@ For example::
       - caa
       - txt
 
+  providers:
+    in:
+      class: octodns.provider.yaml.YamlProvider
+      directory: tests/config
+    dump:
+      class: octodns.provider.yaml.YamlProvider
+      directory: tests/yaml
+
   zones:
     unit.tests.:
-      sources:
-        config:
-      targets:
-        yaml:
-          directory: tests/yaml
       # overrides the global default, only merges TXT records here
       mergers:
         - txt
+      sources:
+        - in
+      targets:
+        - dump
 
 Reusable mergers with extra configuration can be defined in the top-level
 ``mergers`` map and referenced by id from a zone::
@@ -626,15 +638,22 @@ Reusable mergers with extra configuration can be defined in the top-level
     my-caa:
       class: octodns.merge.CaaMerger
 
+  providers:
+    in:
+      class: octodns.provider.yaml.YamlProvider
+      directory: tests/config
+    dump:
+      class: octodns.provider.yaml.YamlProvider
+      directory: tests/yaml
+
   zones:
     unit.tests.:
-      sources:
-        config:
-      targets:
-        yaml:
-          directory: tests/yaml
       mergers:
         - my-caa
+      sources:
+        - in
+      targets:
+        - dump
 
 When two records with the same name and type merge but carry different TTLs,
 octoDNS keeps the existing record's TTL and logs a warning — the combined
```

---

### Incident Patch 2: `12a9434c` (2026-08-07)
**Commit Message**: Fix SVCB/HTTPS value ordering: sort svcparams as a tuple instead of comparing as sets

**File**: `.changelog/861d5ea0eedf4ce7976914c2c9d805d7.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix SVCB/HTTPS value ordering: sort svcparams as a tuple instead of comparing as sets
```

**File**: `octodns/record/svcb.py` (modified, +8/-5)
```diff
@@ -384,16 +384,19 @@ def __hash__(self):
         return hash(self.__repr__())
 
     def _equality_tuple(self):
-        params = set()
+        params = []
         for svcparamkey, svcparamvalue in self.svcparams.items():
             if svcparamvalue is not None:
                 if isinstance(svcparamvalue, list):
-                    params.add(f'{svcparamkey}={",".join(svcparamvalue)}')
+                    params.append(f'{svcparamkey}={",".join(svcparamvalue)}')
                 else:
-                    params.add(f'{svcparamkey}={svcparamvalue}')
+                    params.append(f'{svcparamkey}={svcparamvalue}')
             else:
-                params.add(f'{svcparamkey}')
-        return (self.svcpriority, self.targetname, params)
+                params.append(f'{svcparamkey}')
+        # sorted so that ordering/equality don't depend on svcparams
+        # insertion order, and so that comparisons form a total order (a set
+        # here would compare as a subset, not lexicographically)
+        return (self.svcpriority, self.targetname, tuple(sorted(params)))
 
     def __repr__(self):
         return f"'{self.rdata_text}'"
```

**File**: `tests/test_octodns_record_svcb.py` (modified, +49/-0)
```diff
@@ -278,6 +278,55 @@ def test_svcb_value(self):
         values.add(b)
         self.assertIn(b, values)
 
+    def test_svcb_value_equality_tuple_total_order(self):
+        # disjoint svcparams used to compare as sets (subset comparison)
+        # rather than a total order, so two unequal values could be mutually
+        # "not less than" each other
+        a = SvcbValue(
+            {
+                'svcpriority': 1,
+                'targetname': 'x.unit.tests.',
+                'svcparams': {'alpn': ['h2']},
+            }
+        )
+        b = SvcbValue(
+            {
+                'svcpriority': 1,
+                'targetname': 'x.unit.tests.',
+                'svcparams': {'port': '443'},
+            }
+        )
+
+        self.assertNotEqual(a, b)
+        # exactly one direction should hold, not neither
+        self.assertTrue(a < b or b < a)
+        self.assertFalse(a < b and b < a)
+
+        # ordering is deterministic regardless of the order values are
+        # sorted in, since it no longer depends on set iteration order
+        self.assertEqual(sorted([a, b]), sorted([b, a]))
+
+    def test_svcb_value_equality_tuple_svcparams_order_independent(self):
+        # same svcparams, inserted in different orders, should be equal and
+        # produce the same hash
+        a = SvcbValue(
+            {
+                'svcpriority': 1,
+                'targetname': 'x.unit.tests.',
+                'svcparams': {'alpn': ['h2'], 'port': '443'},
+            }
+        )
+        b = SvcbValue(
+            {
+                'svcpriority': 1,
+                'targetname': 'x.unit.tests.',
+                'svcparams': {'port': '443', 'alpn': ['h2']},
+            }
+        )
+
+        self.assertEqual(a, b)
+        self.assertEqual(hash(a), hash(b))
+
     def test_validation(self):
         # doesn't blow up
         Record.new(
```

---

### Incident Patch 3: `017eaf8e` (2026-07-31)
**Commit Message**: Merge pull request #1457 from octodns/fix-sphinx-docs-build-warnings

Fix Sphinx docs build warnings

**File**: `.changelog/8609e000ae4949e898462db3d76112b0.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: none
+---
+Fix Sphinx docs build warnings and add a CI job to catch future regressions
```

**File**: `.github/workflows/main.yml` (modified, +17/-0)
```diff
@@ -66,3 +66,20 @@ jobs:
       - name: CI package build
         run: |
           ./script/cibuild-package
+  docs:
+    needs: config
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Setup python
+        uses: actions/setup-python@v4
+        with:
+          # Most recent release from https://devguide.python.org/versions/#versions
+          python-version: ${{ fromJson(needs.config.outputs.json).python_version_current }}
+          architecture: x64
+      - name: Bootstrap
+        run: |
+          ./script/bootstrap
+      - name: Generate docs
+        run: |
+          ./script/generate-docs
```

**File**: `docs/api/validators.rst` (modified, +0/-1)
```diff
@@ -33,4 +33,3 @@ by set name (e.g. ``legacy``, ``strict``, ``best-practice``).
    octodns.zone.mail
    octodns.zone.ns
    octodns.zone.srv
-   octodns.zone.subzone
```

**File**: `docs/configuration.rst` (modified, +37/-36)
```diff
@@ -212,42 +212,42 @@ bridge validators with ``sets=None`` — always active and cannot be disabled.
 
 Validators active in both ``legacy`` and ``strict``:
 
-+------------------------+------------------------------------------+
-| id                     | description                              |
-+========================+==========================================+
-| ``name-rfc``           | Record name format (RFC 1035/2181)       |
-+------------------------+------------------------------------------+
-| ``ttl-rfc``            | TTL range (positive integer)             |
-+------------------------+------------------------------------------+
-| ``healthcheck``        | octoDNS healthcheck config fields        |
-+------------------------+------------------------------------------+
-| ``cname-root-rfc``     | CNAME must not be at zone root           |
-+------------------------+------------------------------------------+
-| ``alias-root``         | ALIAS must not be at zone root           |
-+------------------------+------------------------------------------+
-| ``ip-value-rfc``       | A / AAAA value format                    |
-+------------------------+------------------------------------------+
-| ``target-value-rfc``   | CNAME/ALIAS/DNAME/PTR target format      |
-+------------------------+------------------------------------------+
-| ``targets-value-rfc``  | NS targets format                        |
-+------------------------+------------------------------------------+
-| ``loc-value-rfc``      | LOC rdata format (RFC 1876)              |
-+------------------------+------------------------------------------+
-| ``chunked-value-rfc``  | TXT/SPF chunk encoding                   |
-+------------------------+------------------------------------------+
-| ``svcb-value-rfc``     | SVCB rdata format (RFC 9460)             |
-+------------------------+------------------------------------------+
-| ``https-value-rfc``    | HTTPS rdata format (RFC 9460)            |
-+------------------------+------------------------------------------+
-| ``openpgpkey-value-rfc``| OPENPGPKEY rdata format (RFC 7929)      |
-+------------------------+------------------------------------------+
-| ``dynamic``            | Dynamic routing config (pools and rules) |
-+------------------------+------------------------------------------+
-| ``urlfwd-value``       | URLFWD rdata format                      |
-+------------------------+------------------------------------------+
-| ``cname-coexistence``  | CNAME and ALIAS cannot coexist with      |
-|                        | other records                            |
-+------------------------+------------------------------------------+
++--------------------------+------------------------------------------+
+| id                       | description                              |
++==========================+==========================================+
+| ``name-rfc``             | Record name format (RFC 1035/2181)       |
++--------------------------+------------------------------------------+
+| ``ttl-rfc``              | TTL range (positive integer)             |
++--------------------------+------------------------------------------+
+| ``healthcheck``          | octoDNS healthcheck config fields        |
++--------------------------+------------------------------------------+
+| ``cname-root-rfc``       | CNAME must not be at zone root           |
++--------------------------+------------------------------------------+
+| ``alias-root``           | ALIAS must not be at zone root           |
++--------------------------+------------------------------------------+
+| ``ip-value-rfc``         | A / AAAA value format                    |
++--------------------------+------------------------------------------+
+| ``target-value-rfc``     | CNAME/ALIAS/DNAME/PTR target format      |
++--------------------------+------------------------------------------+
+| ``targets-value-rfc``    | NS targets forma
```

**File**: `octodns/zone/validator.py` (modified, +5/-1)
```diff
@@ -7,7 +7,11 @@
 from ..record.validator import ValidationReason
 from .exception import ZoneException
 
-__all__ = ['ValidationReason', 'ZoneValidator', 'ZoneValidatorRegistry']
+# back-compat re-export, ValidationReason lived here before moving to
+# octodns.record.validator. No __all__ here (on purpose) so autodoc documents
+# it once, at its new home, rather than duplicating it on this module's page
+# too.
+ValidationReason
 
 
 class ZoneValidatorRegistry:
```

---

### Incident Patch 4: `6cd0d15a` (2026-07-30)
**Commit Message**: Fix Sphinx docs build warnings and add a CI job to catch future regressions

**File**: `.changelog/8609e000ae4949e898462db3d76112b0.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix Sphinx docs build warnings and add a CI job to catch future regressions
```

**File**: `.github/workflows/main.yml` (modified, +17/-0)
```diff
@@ -66,3 +66,20 @@ jobs:
       - name: CI package build
         run: |
           ./script/cibuild-package
+  docs:
+    needs: config
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Setup python
+        uses: actions/setup-python@v4
+        with:
+          # Most recent release from https://devguide.python.org/versions/#versions
+          python-version: ${{ fromJson(needs.config.outputs.json).python_version_current }}
+          architecture: x64
+      - name: Bootstrap
+        run: |
+          ./script/bootstrap
+      - name: Generate docs
+        run: |
+          ./script/generate-docs
```

**File**: `docs/api/validators.rst` (modified, +0/-1)
```diff
@@ -33,4 +33,3 @@ by set name (e.g. ``legacy``, ``strict``, ``best-practice``).
    octodns.zone.mail
    octodns.zone.ns
    octodns.zone.srv
-   octodns.zone.subzone
```

**File**: `docs/configuration.rst` (modified, +37/-36)
```diff
@@ -212,42 +212,42 @@ bridge validators with ``sets=None`` — always active and cannot be disabled.
 
 Validators active in both ``legacy`` and ``strict``:
 
-+------------------------+------------------------------------------+
-| id                     | description                              |
-+========================+==========================================+
-| ``name-rfc``           | Record name format (RFC 1035/2181)       |
-+------------------------+------------------------------------------+
-| ``ttl-rfc``            | TTL range (positive integer)             |
-+------------------------+------------------------------------------+
-| ``healthcheck``        | octoDNS healthcheck config fields        |
-+------------------------+------------------------------------------+
-| ``cname-root-rfc``     | CNAME must not be at zone root           |
-+------------------------+------------------------------------------+
-| ``alias-root``         | ALIAS must not be at zone root           |
-+------------------------+------------------------------------------+
-| ``ip-value-rfc``       | A / AAAA value format                    |
-+------------------------+------------------------------------------+
-| ``target-value-rfc``   | CNAME/ALIAS/DNAME/PTR target format      |
-+------------------------+------------------------------------------+
-| ``targets-value-rfc``  | NS targets format                        |
-+------------------------+------------------------------------------+
-| ``loc-value-rfc``      | LOC rdata format (RFC 1876)              |
-+------------------------+------------------------------------------+
-| ``chunked-value-rfc``  | TXT/SPF chunk encoding                   |
-+------------------------+------------------------------------------+
-| ``svcb-value-rfc``     | SVCB rdata format (RFC 9460)             |
-+------------------------+------------------------------------------+
-| ``https-value-rfc``    | HTTPS rdata format (RFC 9460)            |
-+------------------------+------------------------------------------+
-| ``openpgpkey-value-rfc``| OPENPGPKEY rdata format (RFC 7929)      |
-+------------------------+------------------------------------------+
-| ``dynamic``            | Dynamic routing config (pools and rules) |
-+------------------------+------------------------------------------+
-| ``urlfwd-value``       | URLFWD rdata format                      |
-+------------------------+------------------------------------------+
-| ``cname-coexistence``  | CNAME and ALIAS cannot coexist with      |
-|                        | other records                            |
-+------------------------+------------------------------------------+
++--------------------------+------------------------------------------+
+| id                       | description                              |
++==========================+==========================================+
+| ``name-rfc``             | Record name format (RFC 1035/2181)       |
++--------------------------+------------------------------------------+
+| ``ttl-rfc``              | TTL range (positive integer)             |
++--------------------------+------------------------------------------+
+| ``healthcheck``          | octoDNS healthcheck config fields        |
++--------------------------+------------------------------------------+
+| ``cname-root-rfc``       | CNAME must not be at zone root           |
++--------------------------+------------------------------------------+
+| ``alias-root``           | ALIAS must not be at zone root           |
++--------------------------+------------------------------------------+
+| ``ip-value-rfc``         | A / AAAA value format                    |
++--------------------------+------------------------------------------+
+| ``target-value-rfc``     | CNAME/ALIAS/DNAME/PTR target format      |
++--------------------------+------------------------------------------+
+| ``targets-value-rfc``    | NS targets forma
```

**File**: `octodns/zone/validator.py` (modified, +5/-1)
```diff
@@ -7,7 +7,11 @@
 from ..record.validator import ValidationReason
 from .exception import ZoneException
 
-__all__ = ['ValidationReason', 'ZoneValidator', 'ZoneValidatorRegistry']
+# back-compat re-export, ValidationReason lived here before moving to
+# octodns.record.validator. No __all__ here (on purpose) so autodoc documents
+# it once, at its new home, rather than duplicating it on this module's page
+# too.
+ValidationReason
 
 
 class ZoneValidatorRegistry:
```

---

### Incident Patch 5: `0f5dae9d` (2026-07-30)
**Commit Message**: Merge pull request #1456 from albority/fix-ownership-mixed-case-types

Fix OwnershipProcessor dropping changes to record types with lower-case letters

**File**: `.changelog/4894bc8785d846b19681fd9557eb96f3.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix OwnershipProcessor dropping changes to records whose type contains lower-case letters, e.g. octodns-route53's Route53Provider/ALIAS - #1455
```

**File**: `octodns/processor/ownership.py` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ def process_plan(self, plan, sources, target, lenient=False):
 
             if (
                 not self._is_ownership(record)
-                and record._type not in owned[record.name]
+                and record._type.upper() not in owned[record.name]
                 and record.name != 'octodns-meta'
             ):
                 # It's not an ownership TXT, it's not owned, and it's not
```

**File**: `tests/test_octodns_processor_ownership.py` (modified, +83/-1)
```diff
@@ -8,7 +8,7 @@
 
 from octodns.processor.ownership import OwnershipException, OwnershipProcessor
 from octodns.provider.plan import Plan
-from octodns.record import Delete, Record
+from octodns.record import Delete, Record, Update, ValueMixin
 from octodns.zone import DuplicateRecordException, Zone
 
 zone = Zone('unit.tests.', [])
@@ -28,6 +28,34 @@
     zone.add_record(record)
 
 
+class MixedCaseValue(str):
+    @classmethod
+    def parse_rdata_text(cls, value):
+        return value
+
+    @classmethod
+    def validate(cls, data, _type):
+        return []
+
+    @classmethod
+    def process(cls, value):
+        return MixedCaseValue(value)
+
+    @property
+    def rdata_text(self):
+        return self
+
+
+class MixedCase(ValueMixin, Record):
+    # Provider-specific types are not required to be upper case, e.g.
+    # octodns-route53's Route53Provider/ALIAS
+    _type = 'Provider/MiXeD'
+    _value_type = MixedCaseValue
+
+
+Record.register_type(MixedCase, 'Provider/MiXeD')
+
+
 class TestOwnershipProcessor(TestCase):
     def test_process_source_zone(self):
         ownership = OwnershipProcessor('ownership')
@@ -222,3 +250,57 @@ def test_allow_takeover(self):
         plan.existing.add_record(foreign_unmanaged)
         got = ownership.process_plan(plan, None, None)
         self.assertTrue(got)
+
+    def test_process_plan_mixed_case_type(self):
+        # Record names are lower cased, so the ownership TXT for a
+        # provider-specific type records that type in lower case. The plan
+        # filter has to account for that or changes to those records are
+        # silently dropped even though we own them.
+        ownership = OwnershipProcessor('ownership')
+
+        zone = Zone('unit.tests.', [])
+        record = Record.new(
+            zone,
+            'mixed',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'before'},
+        )
+        updated = Record.new(
+            zone,
+            'mixed',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'after'},
+        )
+
+        marker = Record.new(
+            zone,
+            f'{ownership.txt_name}.provider/mixed.mixed',
+            {'ttl': 60, 'type': 'TXT', 'value': ownership.txt_value},
+            lenient=True,
+        )
+        # the marker name is lower cased on the way in
+        self.assertEqual(
+            f'{ownership.txt_name}.provider/mixed.mixed', marker.name
+        )
+
+        existing = Zone(zone.name, [])
+        desired = Zone(zone.name, [])
+        for zone_, value in ((existing, record), (desired, updated)):
+            zone_.add_record(value, lenient=True)
+            zone_.add_record(marker, lenient=True)
+
+        change = Update(record, updated)
+        plan = Plan(existing, desired, [change], True)
+
+        got = ownership.process_plan(plan, None, None)
+        self.assertTrue(got)
+        self.assertEqual([change], got.changes)
+
+        # an unowned record of the same type is still left alone
+        unowned = Record.new(
+            zone,
+            'unowned',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'before'},
+        )
+        existing = Zone(zone.name, [])
+        existing.add_record(unowned, lenient=True)
+        plan = Plan(existing, Zone(zone.name, []), [Delete(unowned)], True)
+        self.assertFalse(ownership.process_plan(plan, None, None))
```

---

### Incident Patch 6: `faad559a` (2026-07-30)
**Commit Message**: Fix OwnershipProcessor dropping changes to record types with lower-case letters - #1455

_decode_ownership_name upper cases the type it reads out of the ownership TXT
name, because record names are lower cased on the way in, so the marker for an
A record arrives as _owner.a.the-a. The plan filter then compared the record's
real _type against that upper cased index. Core types are already upper case so
the mismatch is invisible for them, but a provider-specific type containing
lower-case letters never matches and its changes are dropped from the plan with
no warning, even when we own the record. octodns-route53's
Route53Provider/ALIAS is one such type, which makes an apex alias unmanageable
whenever this processor is enabled.

Normalise the comparison side too. Removing the upper casing instead would not
work: the type read back from a provider is lower cased, so both sides have to
be normalised, not neither.

**File**: `.changelog/4894bc8785d846b19681fd9557eb96f3.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix OwnershipProcessor dropping changes to records whose type contains lower-case letters, e.g. octodns-route53's Route53Provider/ALIAS - #1455
```

**File**: `octodns/processor/ownership.py` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ def process_plan(self, plan, sources, target, lenient=False):
 
             if (
                 not self._is_ownership(record)
-                and record._type not in owned[record.name]
+                and record._type.upper() not in owned[record.name]
                 and record.name != 'octodns-meta'
             ):
                 # It's not an ownership TXT, it's not owned, and it's not
```

**File**: `tests/test_octodns_processor_ownership.py` (modified, +83/-1)
```diff
@@ -8,7 +8,7 @@
 
 from octodns.processor.ownership import OwnershipException, OwnershipProcessor
 from octodns.provider.plan import Plan
-from octodns.record import Delete, Record
+from octodns.record import Delete, Record, Update, ValueMixin
 from octodns.zone import DuplicateRecordException, Zone
 
 zone = Zone('unit.tests.', [])
@@ -28,6 +28,34 @@
     zone.add_record(record)
 
 
+class MixedCaseValue(str):
+    @classmethod
+    def parse_rdata_text(cls, value):
+        return value
+
+    @classmethod
+    def validate(cls, data, _type):
+        return []
+
+    @classmethod
+    def process(cls, value):
+        return MixedCaseValue(value)
+
+    @property
+    def rdata_text(self):
+        return self
+
+
+class MixedCase(ValueMixin, Record):
+    # Provider-specific types are not required to be upper case, e.g.
+    # octodns-route53's Route53Provider/ALIAS
+    _type = 'Provider/MiXeD'
+    _value_type = MixedCaseValue
+
+
+Record.register_type(MixedCase, 'Provider/MiXeD')
+
+
 class TestOwnershipProcessor(TestCase):
     def test_process_source_zone(self):
         ownership = OwnershipProcessor('ownership')
@@ -222,3 +250,57 @@ def test_allow_takeover(self):
         plan.existing.add_record(foreign_unmanaged)
         got = ownership.process_plan(plan, None, None)
         self.assertTrue(got)
+
+    def test_process_plan_mixed_case_type(self):
+        # Record names are lower cased, so the ownership TXT for a
+        # provider-specific type records that type in lower case. The plan
+        # filter has to account for that or changes to those records are
+        # silently dropped even though we own them.
+        ownership = OwnershipProcessor('ownership')
+
+        zone = Zone('unit.tests.', [])
+        record = Record.new(
+            zone,
+            'mixed',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'before'},
+        )
+        updated = Record.new(
+            zone,
+            'mixed',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'after'},
+        )
+
+        marker = Record.new(
+            zone,
+            f'{ownership.txt_name}.provider/mixed.mixed',
+            {'ttl': 60, 'type': 'TXT', 'value': ownership.txt_value},
+            lenient=True,
+        )
+        # the marker name is lower cased on the way in
+        self.assertEqual(
+            f'{ownership.txt_name}.provider/mixed.mixed', marker.name
+        )
+
+        existing = Zone(zone.name, [])
+        desired = Zone(zone.name, [])
+        for zone_, value in ((existing, record), (desired, updated)):
+            zone_.add_record(value, lenient=True)
+            zone_.add_record(marker, lenient=True)
+
+        change = Update(record, updated)
+        plan = Plan(existing, desired, [change], True)
+
+        got = ownership.process_plan(plan, None, None)
+        self.assertTrue(got)
+        self.assertEqual([change], got.changes)
+
+        # an unowned record of the same type is still left alone
+        unowned = Record.new(
+            zone,
+            'unowned',
+            {'ttl': 30, 'type': 'Provider/MiXeD', 'value': 'before'},
+        )
+        existing = Zone(zone.name, [])
+        existing.add_record(unowned, lenient=True)
+        plan = Plan(existing, Zone(zone.name, []), [Delete(unowned)], True)
+        self.assertFalse(ownership.process_plan(plan, None, None))
```

---

### Incident Patch 7: `258f30cb` (2026-07-29)
**Commit Message**: Fix script/ tooling to work correctly in git worktrees

**File**: `.changelog/738bd92f908d4622bdb69f5b45195fac.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: none
+---
+Fix script/ tooling to work correctly in git worktrees
```

**File**: `.git_hooks_pre-commit` (modified, +3/-2)
```diff
@@ -1,7 +1,8 @@
 #!/bin/bash
 
-# Scripts path
-SCRIPT_PATH="$( dirname -- "$( readlink -f -- "${0}"; )"; )/script"
+# Scripts path -- resolve the worktree being committed, not the checkout this
+# hook symlink happens to live in (see `git worktree`)
+SCRIPT_PATH="$( git rev-parse --show-toplevel; )/script"
 # Activate OctoDNS Python venv
 source "${SCRIPT_PATH}/common.sh"
 
```

**File**: `CONTRIBUTING.md` (modified, +7/-0)
```diff
@@ -51,6 +51,13 @@ source env/bin/activate
 
 See the [`script/`](/script) if you'd like to run tests and coverage ([`script/coverage`](/script/coverage)) and coverage ([`script/lint`](/script/lint)). After bootstrapping and sourcing the `env/` commands in the [`octodns/cmds/`](/octodns/cmds) directory can be run with `PYTHONPATH=. ./octodns/cmds/sync.py ...`
 
+### Working in a `git worktree`
+
+Each `git worktree` needs its own `./script/bootstrap` run, since each gets its own
+`env/` virtualenv. The pre-commit hook, on the other hand, is installed once into the
+shared hooks directory and applies to the primary checkout and every worktree; running
+`./script/bootstrap` again from a worktree won't install a second copy.
+
 ## Documentation and Read the Docs
 
 ### Build docs locally
```

**File**: `script/bootstrap` (modified, +14/-4)
```diff
@@ -4,7 +4,7 @@
 
 set -e
 
-cd "$(dirname "$0")"/..
+cd "$(dirname -- "$(readlink -f -- "$0")")"/..
 ROOT=$(pwd)
 
 if [ -z "$VENV_NAME" ]; then
@@ -25,16 +25,26 @@ fi
 python -m pip install -U 'pip>=10.0.1'
 python -m pip install -r requirements.txt
 
-if [ -d ".git" ]; then
+# Use git itself, rather than testing for a ".git" directory, so this works
+# from a linked `git worktree` too (there ".git" is a file, not a directory).
+if git rev-parse --git-dir >/dev/null 2>&1; then
     if [ -f ".git-blame-ignore-revs" ]; then
         echo ""
         echo "Setting blame.ignoreRevsFile to .git-blame-ingore-revs"
         git config --local blame.ignoreRevsFile .git-blame-ignore-revs
     fi
-    if [ ! -L ".git/hooks/pre-commit" ]; then
+
+    # git-path hooks resolves to the *common* hooks dir, so this installs once
+    # for the primary checkout and every worktree that shares it.
+    HOOKS_DIR="$(git rev-parse --git-path hooks)"
+    # Anchor the symlink to the primary checkout, not $ROOT -- in a worktree
+    # $ROOT is the worktree itself, and the hooks dir is shared, so pointing
+    # at $ROOT would leave a dangling symlink once that worktree is removed.
+    PRIMARY_ROOT="$(cd "$(dirname -- "$(git rev-parse --git-common-dir)")" && pwd)"
+    if [ ! -e "${HOOKS_DIR}/pre-commit" ]; then
         echo ""
         echo "Installing pre-commit hook"
-        ln -s "$ROOT/.git_hooks_pre-commit" ".git/hooks/pre-commit"
+        ln -sf "${PRIMARY_ROOT}/.git_hooks_pre-commit" "${HOOKS_DIR}/pre-commit"
     fi
 fi
 
```

**File**: `script/cibuild` (modified, +8/-5)
```diff
@@ -1,10 +1,13 @@
 #!/bin/bash
 
-echo "## bootstrap ###################################################################"
-script/bootstrap
+set -e
 
 # Get current script path
 SCRIPT_PATH="$( dirname -- "$( readlink -f -- "${0}"; )"; )"
+
+echo "## bootstrap ###################################################################"
+"${SCRIPT_PATH}/bootstrap"
+
 # Activate OctoDNS Python venv
 source "${SCRIPT_PATH}/common.sh"
 
@@ -19,9 +22,9 @@ rm -f *.pyc
 echo "## begin #######################################################################"
 # For now it's just lint...
 echo "## lint ########################################################################"
-script/lint
+"${SCRIPT_PATH}/lint"
 echo "## formatting ##################################################################"
-script/format --check || (echo "Formatting check failed, run ./script/format" && exit 1)
+"${SCRIPT_PATH}/format" --check || (echo "Formatting check failed, run ./script/format" && exit 1)
 echo "## tests/coverage ##############################################################"
-script/coverage
+"${SCRIPT_PATH}/coverage"
 echo "## complete ####################################################################"
```

---

### Incident Patch 8: `d0d272eb` (2026-07-29)
**Commit Message**: Fix CaaValue.rdata_text to quote the value field per RFC 8659, matching NAPTR/URI - #1447

**File**: `.changelog/c5ca474fdffc45f0bac3bf2515963ab6.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix CaaValue.rdata_text to quote the value field per RFC 8659, matching NAPTR/URI - #1447
```

**File**: `octodns/record/caa.py` (modified, +2/-1)
```diff
@@ -212,7 +212,8 @@ def data(self):
 
     @property
     def rdata_text(self):
-        return f'{self.flags} {self.tag} {self.value}'
+        # RFC 8659 §4.1.1 requires value to be a quoted character-string
+        return f'{self.flags} {self.tag} "{self.value}"'
 
     def template(self, params):
         if '{' not in self.value:
```

**File**: `tests/test_octodns_record_caa.py` (modified, +12/-2)
```diff
@@ -139,11 +139,21 @@ def test_caa_value_rdata_text(self):
         self.assertEqual(1, a.values[0].flags)
         self.assertEqual('tag1', a.values[0].tag)
         self.assertEqual('99148c81', a.values[0].value)
-        self.assertEqual('1 tag1 99148c81', a.values[0].rdata_text)
+        self.assertEqual('1 tag1 "99148c81"', a.values[0].rdata_text)
         self.assertEqual(2, a.values[1].flags)
         self.assertEqual('tag2', a.values[1].tag)
         self.assertEqual('99148c44', a.values[1].value)
-        self.assertEqual('2 tag2 99148c44', a.values[1].rdata_text)
+        self.assertEqual('2 tag2 "99148c44"', a.values[1].rdata_text)
+
+        # value with whitespace/`;` round-trips through rdata_text and
+        # parse_rdata_text (the motivating case from #1447)
+        value = CaaValue(
+            {'flags': 0, 'tag': 'issue', 'value': 'ca.unit.tests; account=1'}
+        )
+        self.assertEqual('0 issue "ca.unit.tests; account=1"', value.rdata_text)
+        self.assertEqual(
+            dict(value.data), CaaValue.parse_rdata_text(value.rdata_text)
+        )
 
     def test_caa_value(self):
         a = CaaValue({'flags': 0, 'tag': 'a', 'value': 'v'})
```

---

### Incident Patch 9: `64b2e991` (2026-07-10)
**Commit Message**: Fix cibuild-module to recognize PEP 621 (pyproject.toml [project] table) provider modules, not just setup.py and poetry

**File**: `.changelog/dc67c65124e74bdc97704d4661adfb41.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix cibuild-module to recognize PEP 621 (pyproject.toml [project] table) provider modules, not just setup.py and poetry
```

**File**: `script/cibuild-module` (modified, +10/-4)
```diff
@@ -28,7 +28,13 @@ cd $TMP_DIR
 git clone "https://github.com/${module}.git"
 cd $(basename $module)
 echo "## install module dev requirements #############################################"
-if [ -e setup.py ]; then
+# setuptools/PEP 621 modules (a setup.py, or a pyproject.toml with a [project]
+# table) install cleanly with pip and, because octodns was built and installed
+# above, keep our local octodns rather than pulling it from PyPI. Legacy poetry
+# modules (deps only under [tool.poetry]) need special handling to avoid clobbering
+# that local octodns.
+if [ -e setup.py ] || grep -q '^\[project\]' pyproject.toml 2>/dev/null; then
+  pip_module=1
   pip install -e .[dev] pytest-network
 elif [ -f pyproject.toml ]; then
   # install poetry
@@ -38,16 +44,16 @@ elif [ -f pyproject.toml ]; then
   # now install all the deps
   poetry install --no-root -v
 else
-  echo "Unrecognized module management. Supports setup.py and poetry"
+  echo "Unrecognized module management. Supports setup.py, PEP 621, and poetry"
   exit 1
 fi
 echo "## installed modules ###########################################################"
 pip freeze
 echo "## run module tests ############################################################"
 export PYTHONPATH=.:$PYTHONPATH
-if [ -e setup.py ]; then
+if [ -n "$pip_module" ]; then
   pytest --disable-network
 elif [ -f poetry.toml ]; then
-  poetry run pytest []
+  poetry run pytest
 fi
 echo "## complete ####################################################################"
```

---

### Incident Patch 10: `9fcdc24f` (2026-07-03)
**Commit Message**: Merge pull request #1442 from octodns/fix/mail-validator-single-mx-trailing-dot

Fix single-MX provider exemption when exchange lacks trailing dot

**File**: `.changelog/a4c2beb49bad46cfa2d6a1e06d11f3a6.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+---
+type: patch
+---
+Fix MailZoneValidator's single-MX provider exemption to match known providers even when the MX exchange is missing its trailing dot (e.g. when the mx-value-best-practice validator is disabled for a zone)
```

**File**: `octodns/zone/mail.py` (modified, +9/-1)
```diff
@@ -57,7 +57,10 @@ class MailZoneValidator(ZoneValidator):
     # MX exchanges of providers known to (correctly) operate with a single MX
     # record. A record with exactly one value whose exchange matches one of
     # these patterns is exempt from the ``min_mx`` redundancy check. Patterns
-    # are matched via re.search against the exchange including its trailing dot.
+    # are matched via re.search against the exchange, normalized to always
+    # include a trailing dot (see ``_is_single_mx_provider``) so an exchange
+    # missing one (e.g. the ``mx-value-best-practice`` trailing-dot check was
+    # disabled for the zone) still matches.
     #
     # PRs welcome: if you run across another reputable provider that only hands
     # out a single MX, please add it here.
@@ -94,6 +97,11 @@ def __init__(
     def _is_single_mx_provider(self, mx_record):
         # called only when mx_record has exactly one value
         exchange = str(mx_record.values[0].exchange)
+        # normalize so a value missing its trailing dot (e.g. the
+        # trailing-dot best-practice validator was disabled for this zone)
+        # still matches the (dot-anchored) known-provider patterns.
+        if not exchange.endswith('.'):
+            exchange += '.'
         return any(r.search(exchange) for r in self._single_mx_res)
 
     def _is_null_mx(self, mx_record):
```

**File**: `tests/test_octodns_zone_validators_mail.py` (modified, +11/-0)
```diff
@@ -1006,6 +1006,17 @@ def test_single_mx_provider_aws_ses_exempt(self):
         self.assertEqual(1, len(reasons))
         self.assertIn('should have at least 2 values', str(reasons[0]))
 
+    def test_single_mx_provider_matches_without_trailing_dot(self):
+        # A known single-MX provider's exchange must still be recognized as
+        # exempt from the redundancy check even without a trailing dot (e.g.
+        # when the `mx-value-best-practice` trailing-dot validator has been
+        # disabled for the zone, or the data simply omits it).
+        zone = self._make_valid_mail_zone(
+            [{'preference': 10, 'exchange': 'mx.sendgrid.net'}]
+        )
+        v = MailZoneValidator('test', mode='mail')
+        self.assertEqual([], v.validate(zone))
+
     def test_single_mx_provider_postmark_exempt(self):
         zone = self._make_valid_mail_zone(
             [{'preference': 10, 'exchange': 'inbound.postmarkapp.com.'}]
```

#### Recent Merged Pull Requests:
- **PR #1467** (2026-09-26): Add Linode and Vultr providers to the provider list (@yzguy)
- **PR #1466** (2026-09-08): Clarify changelog entry guidelines: one short entry per PR (@ross)
- **PR #1465** (2026-08-28): New provider: AdGuard Home (@davinkevin)
- **PR #1464** (2026-09-09): Add mergers subsystem for merging same-name/type record values (@ross)
- **PR #1463** (2026-08-15): Version 1.22.0 bump & changelog update (@ross)
- **PR #1462** (2026-08-08): Update requirements.txt (@ross)
- **PR #1460** (2026-08-07): Give EqualityTupleMixin a default __hash__ and consolidate hand-rolled copies (@ross)
- **PR #1459** (2026-08-07): Fix SVCB/HTTPS value total ordering (set vs tuple in _equality_tuple) (@ross)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
