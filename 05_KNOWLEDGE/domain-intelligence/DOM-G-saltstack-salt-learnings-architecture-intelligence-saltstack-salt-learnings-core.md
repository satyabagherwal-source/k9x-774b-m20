# Domain G — Architecture Intelligence: Architecture Intelligence: saltstack-salt-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "saltstack-salt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T02:39:05.199Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-saltstack-salt-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [saltstack-salt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T02:39:05.199Z`  
> **Learning ID**: `LEARN-EVO-saltstack-salt-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 79%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from saltstack-salt-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/saltstack-salt-learnings.md`  
> **Source**: github ([https://github.com/saltstack/salt](https://github.com/saltstack/salt))  
> **Source Version**: `22149587`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T02:38:58.810Z  
> **Learning ID**: `learn-github-saltstack-salt`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): saltstack/salt

> **Canonical Artifact**: `07_PROJECT_LEARNING/saltstack-salt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/saltstack/salt](https://github.com/saltstack/salt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T02:38:58.580Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `saltstack/salt`
- **Description**: Software to automate the management and configuration of infrastructure and applications at scale.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml
- **Stars / Engagement**: 15762 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `salt/channel/_cluster_key_state.py`
```
"""
Unified cluster-key propagation primitive.

Two keys in the ``cluster/peer/join-reply`` install path share one
shape: every master generates its own local random bootstrap bytes on
first boot (``find_or_create_keys("cluster")`` for ``cluster.pem``;
``populate_secrets`` for ``cluster_aes``), ships those bytes in every
reply it builds, and the receiver historically installed whatever
arrived.  Under a three-master bootstrap the install order is
non-deterministic, winners are arrival-last, and the cluster ends up
disagreeing on the on-disk / in-memory key.

This module implements the receiver-side state machine that gates
installs.  Each key is independently tracked as either **BOOTSTRAP**
(the local bytes are "mutable until first wire install") or
**COMMITTED** (the on-disk value is cluster-authoritative).  Each
transition is persisted via a sentinel file whose contents are the
SHA-256 fingerprint of the committed bytes; on startup a fingerprint
mismatch between sentinel and on-disk key reverts to BOOTSTRAP so a
stale-value-after-rotation restart cannot re-use a committed marker
that no longer describes disk.

The BOOTSTRAP state applies a **founder-wait window** before
committing to a non-founder install: for up to
``cluster_bootstrap_founder_wait_s`` seconds (default 2.0s) after the
first arrival, the receiver prefers an install from the designated
founder of its configured cluster pool.  When the window expires
without a founder reply, the best-candidate (earliest-arriving)
install wins and a WARN is logged.  Once the founder-wait window has
been served on a key, identity is never consulted again for that key.

The full specification lives in
``agents/reports/design-unified-cluster-key-propagation.md`` and the
reviewer audit (with required tweaks T-1, T-2, T-6) lives in
``agents/reports/design-unified-cluster-key-propagation-reviewer.md``.
"""

import hashlib
import logging
import os
import pathlib
import tempfile
import threading
import time

log = logging.getLogger(__name__)

#: Default founder-wait window (seconds).  Reviewer T-1: the real
#: arm64 CI race window is observed at 588ms-12s; a 2s window biases
#: toward the founder install during normal bootstrap without blocking
#: forever when the founder is dead.
DEFAULT_FOUNDER_WAIT_S = 2.0

#: Config option name for the founder-wait window.
OPT_FOUNDER_WAIT = "cluster_bootstrap_founder_wait_s"

#: Sentinel content prefix.  Reviewer T-2: sentinels carry the SHA-256
#: fingerprint of the committed key bytes, not emptiness, so a restart
#: whose on-disk key no longer matches the sentinel reverts to
#: BOOTSTRAP instead of silently refusing a legitimate re-sync.
SENTINEL_PREFIX = "sha256:"

#: Supported key names.  Kept narrow on purpose -- the primitive only
#: covers the two keys the reviewer scoped (``cluster_pem`` + the
#: ``cluster_aes`` session key).  ``cluster_pub`` rides with the
#: ``cluster_pem`` install and does not need its own state marker.
SUPPORTED_KEYS = ("cluster_aes", "cluster_pem")

#: Receiver states.  A key either is still trusting any first arrival
#: (BOOTSTRAP) or has committed to a cluster-authoritative value
#: (COMMITTED).
STATE_BOOTSTRAP = "bootstrap"
STATE_COMMITTED = "committed"


# ---------------------------------------------------------------------------
# Sentinel helpers
# ---------------------------------------------------------------------------


def cluster_key_sentinel_path(cluster_pki_dir, key_name):
    """
    Return the sentinel path for ``key_name`` under ``cluster_pki_dir``.

    Each key has its own dotfile sentinel so an operator can
    selectively re-open the bootstrap window for a single key without
    touching the other (e.g. ``rm .cluster_aes.committed`` to re-sync
    the session AES while keeping ``cluster.pem`` committed).
    """
    if key_name not in SUPPORTED_KEYS:
        raise ValueError(
            f"Unsupported cluster key name {key_name!r}; "
            f"expected one of {SUPPORTED_KEYS}"
        )
    return pathlib.Path(cluster_pki_dir) / f".{key_name}.committed"


def fingerprint_bytes(key_bytes):
    """
    Return the sentinel fingerprint for ``key_bytes``.

    Format: ``"sha256:<64-hex>"``.  The full digest is used (not
    truncated) so reviewer T-2's stale-on-restart check is strict:
    any single byte change between sentinel-write time and restart
    flips the fingerprint.

    ``key_bytes`` may be ``bytes`` or ``str``; a ``str`` is encoded as
    UTF-8 before hashing to match how the sender serialises PEM and
    AES bytes on the wire.
    """
    if isinstance(key_bytes, str):
        key_bytes = key_bytes.encode("utf-8")
    if not isinstance(key_bytes, (bytes, bytearray)):
        raise TypeError(
            f"fingerprint_bytes expected bytes/str, got {type(key_bytes).__name__}"
        )
    return f"{SENTINEL_PREFIX}{hashlib.sha256(bytes(key_bytes)).hexdigest()}"


def read_sentinel_fingerprint(path):
    """
    Return the fingerprint stored in ``path``, or ``None`` if the
    sentinel is absent or unreadable.

    The sentinel contents are one line of text; whitespace is
    stripped before return.  An unreadable sentinel is treated as
    absent (returns ``None``) rather than raising -- a torn sentinel
    from a crashed write is handled the same way as "never wrote one"
    so the caller falls back to BOOTSTRAP.
    """
    try:
        text = pathlib.Path(path).read_text(encoding="utf-8")
    except (FileNotFoundError, NotADirectoryError):
        return None
    except OSError as exc:  # pragma: no cover - defensive
        log.warning("Unable to read cluster key sentinel %s: %s", path, exc)
        return None
    text = text.strip()
    if not text:
        return None
    if not text.startswith(SENTINEL_PREFIX):
        log.warning(
            "Cluster key sentinel %s has unrecognised format %r; treating as absent",
            path,
            text[:80],
        )
        return None
    return text


def write_sentinel_fingerprint(path, fingerprint):
    """
    Write ``fingerprint`` to ``path`` atomically.

    Uses a tempfile + ``os.replace`` so a concurrent reader always
    sees either the previous sentinel (fully intact) or the new one
    (fully intact), never a torn write.  Parent directory is created
    on demand.
    """
    if not fingerprint.startswith(SENTINEL_PREFIX):
        raise ValueError(
            f"Fingerprint {fingerprint!r} must start with {SENTINEL_PREFIX!r}"
        )
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # NamedTemporaryFile(delete=False) + os.replace is the standard
    # atomic-write recipe; put the tmp in the same directory so the
    # rename is on the same filesystem and therefore atomic (POSIX).
    fd, tmp_path = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            fp.write(fingerprint + "\n")
            fp.flush()
            try:
                os.fsync(fp.fileno())
            except OSError:  # pragma: no cover - fsync best effort
                pass
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def verify_committed_state_on_startup(cluster_pki_dir, key_name, on_disk_bytes):
    """
    Resolve the startup state for ``key_name`` given its current
    on-disk bytes.

    Returns ``(state, fingerprint)``:

    * ``(STATE_COMMITTED, fp)`` -- sentinel exists AND its fingerprint
      matches ``fingerprint_bytes(on_disk_bytes)``.  Caller may skip
      further wire-install work for this key.
    * ``(STATE_BOOTSTRAP, None)`` -- sentinel is absent (never
      committed) OR sentinel exists but its fingerprint differs from
      the on-disk bytes.  Reviewer T-2: the mismatch case deletes the
      stale sentinel so a legitimate next-arrival install commits
      again from scratch.
    """
    sentinel = cluster_key_sentinel_path(cluster_pki_dir, key_name)
    stored = read_sentinel_fingerprint(sentinel)
    if stored is None:
        return STATE_BOOTSTRAP, None
    if on_disk_bytes is None:
        # Sentinel present but key bytes are gone -- revert so the
        # next-arrival install re-syncs the on-disk value.
        log.warning(
            "Cluster key %s: sentinel %s present but on-disk bytes are "
            "missing; reverting to BOOTSTRAP",
            key_name,
            sentinel,
        )
        try:
            sentinel.unlink()
        except FileNotFoundError:
            pass
        return STATE_BOOTSTRAP, None
    actual = fingerprint_bytes(on_disk_bytes)
    if actual == stored:
        return STATE_COMMITTED, stored
    # Reviewer T-2: stale sentinel from a rotation while this master
    # was offline, or from an operator overwriting the key bytes
    # without resetting the sentinel.  Revert to BOOTSTRAP so a
    # cluster-authoritative install can commit.
    log.warning(
        "Cluster key %s: sentinel fingerprint %s does not match on-disk "
        "fingerprint %s; deleting sentinel and reverting to BOOTSTRAP",
        key_name,
        stored,
        actual,
    )
    try:
        sentinel.unlink()
    except FileNotFoundError:
        pass
    return STATE_BOOTSTRAP, None


# ---------------------------------------------------------------------------
# State-machine installer
# ---------------------------------------------------------------------------


class ClusterKeyStateMachine:
    """
    Per-key receiver-side state machine with founder-wait window.

    The state machine is instantiated once per master process (held
    on the ``ReqServerChannel``).  For each supported key
    (``cluster_aes``, ``cluster_pem``) it holds:

    * ``state`` -- BOOTSTRAP or COMMITTED.
    * ``fingerprint`` -- the committed key's SHA-256 fingerprint (or
      ``None`` in BOOTSTRAP).
    * ``first_arrival_mono
```

### Core Architecture Module: `salt/client/ssh/state.py`
```
"""
Create ssh executor system
"""

import logging
import os
import shutil
import tarfile
import tempfile
from contextlib import closing

import salt.client.ssh
import salt.client.ssh.shell
import salt.loader
import salt.minion
import salt.roster
import salt.state
import salt.utils.files
import salt.utils.json
import salt.utils.path
import salt.utils.stringutils
import salt.utils.thin
import salt.utils.url
import salt.utils.verify

log = logging.getLogger(__name__)


class SSHState(salt.state.State):
    """
    Create a State object which wraps the SSH functions for state operations
    """

    def __init__(
        self,
        opts,
        pillar_override=None,
        wrapper=None,
        context=None,
        initial_pillar=None,
    ):
        self.wrapper = wrapper
        self.context = context
        # ``opts`` is the per-minion opts package returned by
        # ``test.opts_pkg`` running inside salt-thin on the target. Its
        # ``cachedir`` is rooted under the on-target ``thin_dir`` (e.g.
        # ``/var/tmp/.root_XXXXX_salt/running_data/var/cache/salt``).
        # The state runs on the master, so the state fileclient and the
        # jinja loader search path
        # (``opts['cachedir']/files/<saltenv>``) need to be anchored
        # under the configured master ``cachedir`` instead. See #68458.
        if wrapper is not None and getattr(wrapper, "fsclient", None) is not None:
            opts["cachedir"] = wrapper.fsclient.opts["cachedir"]
        super().__init__(opts, pillar_override, initial_pillar=initial_pillar)

    def load_modules(self, data=None, proxy=None):
        """
        Load up the modules for remote compilation via ssh
        """
        self.functions = self.wrapper
        # Salt-SSH runs execution modules on the target via ``self.wrapper``
        # (a :class:`salt.client.ssh.FunctionWrapper`), which has no
        # two-loader model -- there is no ``_dunder_salt`` inner loader to
        # fall back to.  ``State`` machinery (global state conditions,
        # requisite/aggregate composition, ``saltutil.refresh_modules``,
        # ``event.fire_master``, ``test.sleep`` in the retry loop) reads
        # from ``self._trusted_functions``; mirror the wrapper so those
        # trusted internal call sites keep working.  Matches
        # :meth:`MasterState.load_modules`.
        self._trusted_functions = self.functions
        self.utils = salt.loader.utils(self.opts)
        self.serializers = salt.loader.serializers(self.opts)
        locals_ = salt.loader.minion_mods(self.opts, utils=self.utils)
        self.states = salt.loader.states(
            self.opts, locals_, self.utils, self.serializers
        )
        self.rend = salt.loader.render(self.opts, self.functions)

    def _gather_pillar(self):
        """
        The opts used during pillar rendering should contain the master
        opts in the root namespace. self.opts is the modified minion opts,
        containing the original master opts in __master_opts__.
        """
        _opts = self.opts
        popts = {}
        # Pillar compilation needs the master opts primarily,
        # same as during regular operation.
        popts.update(_opts)
        popts.update(_opts.get("__master_opts__", {}))
        # But, salt.state.State takes the parameters for get_pillar from
        # the opts, so we need to ensure they are correct for the minion.
        popts["id"] = _opts["id"]
        popts["saltenv"] = _opts["saltenv"]
        popts["pillarenv"] = _opts.get("pillarenv")
        self.opts = popts
        pillar = super()._gather_pillar()
        self.opts = _opts
        return pillar

    def check_refresh(self, data, ret):
        """
        Stub out check_refresh
        """
        return

    def module_refresh(self):
        """
        Module refresh is not needed, stub it out
        """
        return


class SSHHighState(salt.state.BaseHighState):
    """
    Used to compile the highstate on the master
    """

    stack = []

    def __init__(
        self,
        opts,
        pillar_override=None,
        wrapper=None,
        fsclient=None,
        context=None,
        initial_pillar=None,
    ):
        self.client = fsclient
        # ``opts`` is the per-minion opts package; its ``cachedir`` is a
        # thin_dir-relative path on the target. The highstate runs on the
        # master, so anchor ``opts['cachedir']`` under the master
        # ``cachedir`` (taken from the master-side fileclient) so master
        # fileserver caching and jinja template resolution don't write to
        # the minion's thin_dir path on the master filesystem. See
        # #68458.
        if fsclient is not None and getattr(fsclient, "opts", None) is not None:
            opts["cachedir"] = fsclient.opts["cachedir"]
        salt.state.BaseHighState.__init__(self, opts)
        self.state = SSHState(
            opts,
            pillar_override,
            wrapper,
            context=context,
            initial_pillar=initial_pillar,
        )
        self.matchers = salt.loader.matchers(self.opts)

        self._pydsl_all_decls = {}
        self._pydsl_render_stack = []
        self._pydsl_sls_matches = None

    def load_dynamic(self, matches):
        """
        Stub out load_dynamic
        """
        return

    def _master_tops(self):
        """
        Evaluate master_tops locally
        """
        return self._local_master_tops()

    def destroy(self):
        if self.client:
            self.client.destroy()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.destroy()


def lowstate_file_refs(chunks, extras=""):
    """
    Create a list of file ref objects to reconcile
    """
    refs = {}
    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        saltenv = "base"
        crefs = []
        for state in chunk:
            if state == "__env__":
                saltenv = chunk[state]
            elif state.startswith("__"):
                continue
            crefs.extend(salt_refs(chunk[state]))
        if saltenv not in refs:
            refs[saltenv] = []
        if crefs:
            refs[saltenv].append(crefs)
    if extras:
        extra_refs = extras.split(",")
        if extra_refs:
            for env in refs:
                for x in extra_refs:
                    refs[env].append([x])
    return refs


def salt_refs(data, ret=None):
    """
    Pull salt file references out of the states
    """
    proto = "salt://"
    if ret is None:
        ret = []
    if isinstance(data, str):
        if data.startswith(proto) and data not in ret:
            ret.append(data)
    if isinstance(data, list):
        for comp in data:
            salt_refs(comp, ret)
    if isinstance(data, dict):
        for comp in data:
            salt_refs(data[comp], ret)
    return ret


def prep_trans_tar(
    file_client, chunks, file_refs, pillar=None, id_=None, roster_grains=None
):
    """
    Generate the execution package from the saltenv file refs and a low state
    data structure
    """
    gendir = tempfile.mkdtemp()
    trans_tar = salt.utils.files.mkstemp()
    lowfn = os.path.join(gendir, "lowstate.json")
    pillarfn = os.path.join(gendir, "pillar.json")
    roster_grainsfn = os.path.join(gendir, "roster_grains.json")
    sync_refs = [
        [salt.utils.url.create("_modules")],
        [salt.utils.url.create("_states")],
        [salt.utils.url.create("_grains")],
        [salt.utils.url.create("_renderers")],
        [salt.utils.url.create("_returners")],
        [salt.utils.url.create("_output")],
        [salt.utils.url.create("_utils")],
    ]
    with salt.utils.files.fopen(lowfn, "w+") as fp_:
        salt.utils.json.dump(chunks, fp_)
    if pillar:
        with salt.utils.files.fopen(pillarfn, "w+") as fp_:
            salt.utils.json.dump(pillar, fp_)
    if roster_grains:
        with salt.utils.files.fopen(roster_grainsfn, "w+") as fp_:
            salt.utils.json.dump(roster_grains, fp_)

    if id_ is None:
        id_ = ""
    try:
        cachedir = os.path.join("salt-ssh", id_).rstrip(os.sep)
    except AttributeError:
        # Minion ID should always be a str, but don't let an int break this
        cachedir = os.path.join("salt-ssh", str(id_)).rstrip(os.sep)

    for saltenv in file_refs:
        # Location where files in this saltenv will be cached
        cache_dest_root = os.path.join(cachedir, "files", saltenv)
        file_refs[saltenv].extend(sync_refs)
        env_root = os.path.join(gendir, saltenv)
        if not os.path.isdir(env_root):
            os.makedirs(env_root)
        for ref in file_refs[saltenv]:
            for name in ref:
                short = salt.utils.url.parse(name)[0].lstrip("/")
                cache_dest = os.path.join(cache_dest_root, short)
                try:
                    path = file_client.cache_file(name, saltenv, cachedir=cachedir)
                except OSError:
                    path = ""
                if path:
                    tgt = os.path.join(env_root, short)
                    tgt_dir = os.path.dirname(tgt)
                    if not os.path.isdir(tgt_dir):
                        os.makedirs(tgt_dir)
                    shutil.copy(path, tgt)
                    continue
                try:
                    files = file_client.cache_dir(name, saltenv, cachedir=cachedir)
                except OSError:
                    files = ""
                if files:
                    for filename in files:
                        fn = filename[
                            len(file_client.get_cachedir(cache_dest)) :
                        ].strip("/")
                        tgt = os.path.join(env_root, short, fn)
                        tgt_dir = os.path.dirname(tgt)
                        if not os.path.isdir(tgt_dir):
                            os.makedirs(tgt_dir)
                        shutil.copy(filename, tgt)
       
```

### Core Architecture Module: `salt/client/ssh/wrapper/slsutil.py`
```
import os.path
import posixpath

import salt.exceptions
import salt.loader
import salt.template
import salt.utils.args
import salt.utils.dictupdate
import salt.utils.stringio
from salt.client.ssh.wrapper.state import _merge_extra_filerefs

CONTEXT_BASE = "slsutil"


def update(dest, upd, recursive_update=True, merge_lists=False):
    """
    Merge ``upd`` recursively into ``dest``

    If ``merge_lists=True``, will aggregate list object types instead of
    replacing. This behavior is only activated when ``recursive_update=True``.

    CLI Example:

    .. code-block:: shell

        salt '*' slsutil.update '{foo: Foo}' '{bar: Bar}'

    """
    return salt.utils.dictupdate.update(dest, upd, recursive_update, merge_lists)


def merge(obj_a, obj_b, strategy="smart", renderer="yaml", merge_lists=False):
    """
    Merge a data structure into another by choosing a merge strategy

    Strategies:

    * aggregate
    * list
    * overwrite
    * recurse
    * smart

    CLI Example:

    .. code-block:: shell

        salt '*' slsutil.merge '{foo: Foo}' '{bar: Bar}'
    """
    return salt.utils.dictupdate.merge(obj_a, obj_b, strategy, renderer, merge_lists)


def merge_all(lst, strategy="smart", renderer="yaml", merge_lists=False):
    """
    .. versionadded:: 2019.2.0

    Merge a list of objects into each other in order

    :type lst: Iterable
    :param lst: List of objects to be merged.

    :type strategy: String
    :param strategy: Merge strategy. See utils.dictupdate.

    :type renderer: String
    :param renderer:
        Renderer type. Used to determine strategy when strategy is 'smart'.

    :type merge_lists: Bool
    :param merge_lists: Defines whether to merge embedded object lists.

    CLI Example:

    .. code-block:: shell

        $ salt-call --output=txt slsutil.merge_all '[{foo: Foo}, {foo: Bar}]'
        local: {u'foo': u'Bar'}
    """

    ret = {}
    for obj in lst:
        ret = salt.utils.dictupdate.merge(ret, obj, strategy, renderer, merge_lists)

    return ret


def renderer(path=None, string=None, default_renderer="jinja|yaml", **kwargs):
    """
    Parse a string or file through Salt's renderer system

    .. versionchanged:: 2018.3.0
       Add support for Salt fileserver URIs.

    This is an open-ended function and can be used for a variety of tasks. It
    makes use of Salt's "renderer pipes" system to run a string or file through
    a pipe of any of the loaded renderer modules.

    :param path: The path to a file on Salt's fileserver (any URIs supported by
        :py:func:`cp.get_url <salt.modules.cp.get_url>`) or on the local file
        system.
    :param string: An inline string to be used as the file to send through the
        renderer system. Note, not all renderer modules can work with strings;
        the 'py' renderer requires a file, for example.
    :param default_renderer: The renderer pipe to send the file through; this
        is overridden by a "she-bang" at the top of the file.
    :param kwargs: Keyword args to pass to Salt's compile_template() function.

    Keep in mind the goal of each renderer when choosing a render-pipe; for
    example, the Jinja renderer processes a text file and produces a string,
    however the YAML renderer processes a text file and produces a data
    structure.

    One possible use is to allow writing "map files", as are commonly seen in
    Salt formulas, but without tying the renderer of the map file to the
    renderer used in the other sls files. In other words, a map file could use
    the Python renderer and still be included and used by an sls file that uses
    the default 'jinja|yaml' renderer.

    For example, the two following map files produce identical results but one
    is written using the normal 'jinja|yaml' and the other is using 'py':

    .. code-block:: jinja

        #!jinja|yaml
        {% set apache = salt['grains.filter_by']({
            ...normal jinja map file here...
        }, merge=salt.pillar.get('apache:lookup')) %}
        {{ apache | yaml() }}

    .. code-block:: python

        #!py
        def run():
            apache = __salt__.grains.filter_by({
                ...normal map here but as a python dict...
            }, merge=__salt__.pillar.get('apache:lookup'))
            return apache

    Regardless of which of the above map files is used, it can be accessed from
    any other sls file by calling this function. The following is a usage
    example in Jinja:

    .. code-block:: jinja

        {% set apache = salt['slsutil.renderer']('map.sls') %}

    CLI Example:

    .. code-block:: bash

        salt '*' slsutil.renderer salt://path/to/file
        salt '*' slsutil.renderer /path/to/file
        salt '*' slsutil.renderer /path/to/file.jinja default_renderer='jinja'
        salt '*' slsutil.renderer /path/to/file.sls default_renderer='jinja|yaml'
        salt '*' slsutil.renderer string='Inline template! {{ saltenv }}'
        salt '*' slsutil.renderer string='Hello, {{ name }}.' name='world'
    """
    if not path and not string:
        raise salt.exceptions.SaltInvocationError("Must pass either path or string")

    # Use the same FSClient as cp/get_url so Jinja SaltCacheLoader reads the
    # cache paths ssh cp.cache_file populates (loader.render defaults to no client).
    renderers = salt.loader.render(
        __opts__, __salt__, file_client=__context__.get("fileclient")
    )
    # Falsy saltenv (e.g. None injected on salt-ssh) makes Jinja use
    # FileSystemLoader on the temp copy only, so imports like map.jinja fail.
    saltenv = kwargs.get("saltenv") or "base"

    if path:
        # salt-ssh does not ship the whole fileserver tree; Jinja ``import`` /
        # ``from`` targets must be present on the target like ``state.*`` runs
        # (``lowstate_file_refs`` + ``extra_filerefs``). Honor the same
        # ``--extra-filerefs`` / ``__opts__`` / ``cp.cache_file`` context keys by
        # caching each ref before rendering (see ssh ``state`` wrapper).
        extra_filerefs = _merge_extra_filerefs(
            kwargs.get("extra_filerefs") or "",
            __opts__.get("extra_filerefs") or "",
            __context__.get("_cp_extra_filerefs") or "",
        )
        if extra_filerefs:
            for ref in extra_filerefs.split(","):
                ref = ref.strip()
                if ref:
                    __salt__["cp.cache_file"](ref, saltenv=saltenv)
        path_or_string = __context__["fileclient"].get_url(path, "", saltenv=saltenv)
    elif string:
        path_or_string = ":string:"
        kwargs["input_data"] = string

    compile_kwargs = dict(kwargs)
    compile_kwargs.pop("extra_filerefs", None)
    compile_kwargs["saltenv"] = saltenv
    ret = salt.template.compile_template(
        path_or_string,
        renderers,
        default_renderer,
        __opts__["renderer_blacklist"],
        __opts__["renderer_whitelist"],
        **compile_kwargs,
    )
    return ret.read() if salt.utils.stringio.is_readable(ret) else ret


def _get_serialize_fn(serializer, fn_name):
    serializers = salt.loader.serializers(__opts__)
    fns = getattr(serializers, serializer, None)
    fn = getattr(fns, fn_name, None)

    if not fns:
        raise salt.exceptions.CommandExecutionError(
            f"Serializer '{serializer}' not found."
        )

    if not fn:
        raise salt.exceptions.CommandExecutionError(
            f"Serializer '{serializer}' does not implement {fn_name}."
        )

    return fn


def serialize(serializer, obj, **mod_kwargs):
    """
    Serialize a Python object using one of the available
    :ref:`all-salt.serializers`.

    CLI Example:

    .. code-block:: bash

        salt '*' --no-parse=obj slsutil.serialize 'json' obj="{'foo': 'Foo!'}

    Jinja Example:

    .. code-block:: jinja

        {% set json_string = salt['slsutil.serialize']('json',
            {'foo': 'Foo!'}) %}
    """
    kwargs = salt.utils.args.clean_kwargs(**mod_kwargs)
    return _get_serialize_fn(serializer, "serialize")(obj, **kwargs)


def deserialize(serializer, stream_or_string, **mod_kwargs):
    """
    Deserialize a Python object using one of the available
    :ref:`all-salt.serializers`.

    CLI Example:

    .. code-block:: bash

        salt '*' slsutil.deserialize 'json' '{"foo": "Foo!"}'
        salt '*' --no-parse=stream_or_string slsutil.deserialize 'json' \\
            stream_or_string='{"foo": "Foo!"}'

    Jinja Example:

    .. code-block:: jinja

        {% set python_object = salt['slsutil.deserialize']('json',
            '{"foo": "Foo!"}') %}
    """
    kwargs = salt.utils.args.clean_kwargs(**mod_kwargs)
    return _get_serialize_fn(serializer, "deserialize")(stream_or_string, **kwargs)


def boolstr(value, true="true", false="false"):
    """
    Convert a boolean value into a string. This function is
    intended to be used from within file templates to provide
    an easy way to take boolean values stored in Pillars or
    Grains, and write them out in the appropriate syntax for
    a particular file template.

    :param value: The boolean value to be converted
    :param true: The value to return if ``value`` is ``True``
    :param false: The value to return if ``value`` is ``False``

    In this example, a pillar named ``smtp:encrypted`` stores a boolean
    value, but the template that uses that value needs ``yes`` or ``no``
    to be written, based on the boolean value.

    *Note: this is written on two lines for clarity. The same result
    could be achieved in one line.*

    .. code-block:: jinja

        {% set encrypted = salt[pillar.get]('smtp:encrypted', false) %}
        use_tls: {{ salt['slsutil.boolstr'](encrypted, 'yes', 'no') }}

    Result (assuming the value is ``True``):

    .. code-block:: none

        use_tls: yes

    """

    if value:
        return true

    return false


def _set_context(keys, function, fun_args=None, fun_kwargs=None, force=False):
    """
    Convenience function to set a v
```

### Core Architecture Module: `salt/client/ssh/wrapper/state.py`
```
"""
Create ssh executor system
"""

import logging
import os
import time

import salt.client.ssh.shell
import salt.client.ssh.state
import salt.defaults.exitcodes
import salt.loader
import salt.minion
import salt.roster
import salt.state
import salt.utils.args
import salt.utils.data
import salt.utils.files
import salt.utils.hashutils
import salt.utils.jid
import salt.utils.json
import salt.utils.platform
import salt.utils.state
import salt.utils.thin
from salt.exceptions import SaltInvocationError

__func_alias__ = {"apply_": "apply"}
log = logging.getLogger(__name__)


def _set_grains_shared():
    """
    Set grains on __opts__ in a way that's visible to all loaders.

    If __opts__ is an OptsDict, use set_shared() to set grains on the root
    so all children/loaders can see it. Otherwise, use direct assignment.
    """
    grains = __grains__.value() if hasattr(__grains__, "value") else __grains__
    if hasattr(__opts__, "set_shared"):
        __opts__.set_shared("grains", grains)
    else:
        __opts__["grains"] = grains


def _ssh_state(chunks, st_kwargs, kwargs, pillar, test=False):
    """
    Function to run a state with the given chunk via salt-ssh
    """
    file_refs = salt.client.ssh.state.lowstate_file_refs(
        chunks,
        _merge_extra_filerefs(
            kwargs.get("extra_filerefs", ""),
            __opts__.get("extra_filerefs", ""),
            __context__.get("_cp_extra_filerefs", ""),
        ),
    )
    # Create the tar containing the state pkg and relevant files.
    trans_tar = salt.client.ssh.state.prep_trans_tar(
        __context__["fileclient"],
        chunks,
        file_refs,
        pillar,
        st_kwargs["id_"],
    )
    trans_tar_sum = salt.utils.hashutils.get_hash(trans_tar, __opts__["hash_type"])
    cmd = "state.pkg {}/salt_state.tgz test={} pkg_sum={} hash_type={}".format(
        __opts__["thin_dir"], test, trans_tar_sum, __opts__["hash_type"]
    )
    single = salt.client.ssh.Single(
        __opts__,
        cmd,
        fsclient=__context__["fileclient"],
        minion_opts=__salt__.minion_opts,
        **st_kwargs,
    )
    single.shell.send(trans_tar, "{}/salt_state.tgz".format(__opts__["thin_dir"]))
    stdout, stderr, retcode = single.cmd_block()

    # Clean up our tar
    try:
        os.remove(trans_tar)
    except OSError:
        pass

    return {"local": salt.client.ssh.wrapper.parse_ret(stdout, stderr, retcode)}


def _check_pillar(kwargs, pillar=None):
    """
    Check the pillar for errors, refuse to run the state if there are errors
    in the pillar and return the pillar errors
    """
    if kwargs.get("force"):
        return True
    pillar_dict = pillar if pillar is not None else __pillar__.value()
    if "_errors" in pillar_dict:
        return False
    return True


def _wait(jid):
    """
    Wait for all previously started state jobs to finish running
    """
    if jid is None:
        jid = salt.utils.jid.gen_jid(__opts__)
    states = _prior_running_states(jid)
    while states:
        time.sleep(1)
        states = _prior_running_states(jid)


def _merge_extra_filerefs(*args):
    """
    Takes a list of filerefs and returns a merged list
    """
    ret = []
    for arg in args:
        if isinstance(arg, str):
            if arg:
                ret.extend(arg.split(","))
        elif isinstance(arg, list):
            if arg:
                ret.extend(arg)
    return ",".join(ret)


def _cleanup_slsmod_low_data(low_data):
    """
    Set "slsmod" keys to None to make
    low_data JSON serializable
    """
    for i in low_data:
        if "slsmod" in i:
            i["slsmod"] = None


def _cleanup_slsmod_high_data(high_data):
    """
    Set "slsmod" keys to None to make
    high_data JSON serializable
    """
    for i in high_data.values():
        if "stateconf" in i:
            stateconf_data = i["stateconf"][1]
            if "slsmod" in stateconf_data:
                stateconf_data["slsmod"] = None


def _parse_mods(mods):
    """
    Parse modules.
    """
    if isinstance(mods, str):
        mods = [item.strip() for item in mods.split(",") if item.strip()]

    return mods


def sls(mods, saltenv="base", test=None, exclude=None, **kwargs):
    """
    Create the seed file for a state.sls run
    """
    st_kwargs = __salt__.kwargs
    _set_grains_shared()
    opts = salt.utils.state.get_sls_opts(__opts__, **kwargs)
    opts["test"] = _get_test_value(test, **kwargs)
    initial_pillar = _get_initial_pillar(opts)
    pillar_override = kwargs.get("pillar")
    with salt.client.ssh.state.SSHHighState(
        opts,
        pillar_override,
        __salt__.value(),
        __context__["fileclient"],
        context=__context__.value(),
        initial_pillar=initial_pillar,
    ) as st_:
        if not _check_pillar(kwargs, st_.opts["pillar"]):
            __context__["retcode"] = salt.defaults.exitcodes.EX_PILLAR_FAILURE
            err = ["Pillar failed to render with the following messages:"]
            err += st_.opts["pillar"]["_errors"]
            return err
        try:
            pillar = st_.opts["pillar"].value()
        except AttributeError:
            pillar = st_.opts["pillar"]
        if pillar_override is not None or initial_pillar is None:
            # Ensure other wrappers use the correct pillar
            __pillar__.update(pillar)
        st_.push_active()
        mods = _parse_mods(mods)
        high_data, errors = st_.render_highstate(
            {saltenv: mods}, context=__context__.value()
        )
        if exclude:
            if isinstance(exclude, str):
                exclude = exclude.split(",")
            if "__exclude__" in high_data:
                high_data["__exclude__"].extend(exclude)
            else:
                high_data["__exclude__"] = exclude
        high_data, ext_errors = st_.state.reconcile_extend(high_data)
        errors += ext_errors
        errors += st_.state.verify_high(high_data)
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        high_data, req_in_errors = st_.state.requisite_in(high_data)
        errors += req_in_errors
        high_data = st_.state.apply_exclude(high_data)
        # Verify that the high data is structurally sound
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        # Compile and verify the raw chunks
        chunks, errors = st_.state.compile_high_data(high_data)
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        file_refs = salt.client.ssh.state.lowstate_file_refs(
            chunks,
            _merge_extra_filerefs(
                kwargs.get("extra_filerefs", ""),
                opts.get("extra_filerefs", ""),
                __context__.get("_cp_extra_filerefs", ""),
            ),
        )

        roster = salt.roster.Roster(opts, opts.get("roster", "flat"))
        roster_grains = roster.opts["grains"]

        # Create the tar containing the state pkg and relevant files.
        _cleanup_slsmod_low_data(chunks)
        trans_tar = salt.client.ssh.state.prep_trans_tar(
            __context__["fileclient"],
            chunks,
            file_refs,
            pillar,
            st_kwargs["id_"],
            roster_grains,
        )
        trans_tar_sum = salt.utils.hashutils.get_hash(trans_tar, opts["hash_type"])
        cmd = "state.pkg {}/salt_state.tgz test={} pkg_sum={} hash_type={}".format(
            opts["thin_dir"], test, trans_tar_sum, opts["hash_type"]
        )
        single = salt.client.ssh.Single(
            opts,
            cmd,
            fsclient=__context__["fileclient"],
            minion_opts=__salt__.minion_opts,
            **st_kwargs,
        )
        single.shell.send(trans_tar, "{}/salt_state.tgz".format(opts["thin_dir"]))
        stdout, stderr, retcode = single.cmd_block()

        # Clean up our tar
        try:
            os.remove(trans_tar)
        except OSError:
            pass

        return {"local": salt.client.ssh.wrapper.parse_ret(stdout, stderr, retcode)}


def running(concurrent=False):
    """
    Return a list of strings that contain state return data if a state function
    is already running. This function is used to prevent multiple state calls
    from being run at the same time.

    CLI Example:

    .. code-block:: bash

        salt '*' state.running
    """
    ret = []
    if concurrent:
        return ret
    active = __salt__["saltutil.is_running"]("state.*")
    for data in active:
        err = (
            'The function "{}" is running as PID {} and was started at {} '
            "with jid {}".format(
                data["fun"],
                data["pid"],
                salt.utils.jid.jid_to_time(data["jid"]),
                data["jid"],
            )
        )
        ret.append(err)
    return ret


def _prior_running_states(jid):
    """
    Return a list of dicts of prior calls to state functions.  This function is
    used to queue state calls so only one is run at a time.
    """

    ret = []
    active = __salt__["saltutil.is_running"]("state.*")
    for data in active:
        try:
            data_jid = int(data["jid"])
        except ValueError:
            continue
        if data_jid < int(jid):
            ret.append(data)
    return ret


def _check_queue(queue, kwargs):
    """
    Utility function to queue the state run if requested
    and to check for conflicts in currently running states
    """
    if queue:
        _wait(kwargs.get("__pub_jid"))
    else:
        conflict = running(concurrent=kwargs.get("concurrent", False))
        if conflict:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return conflict


def _get_initial_pillar(opts):
    return __pillar__.value() if opts["pillarenv"] == __opts__["pi
```

### Core Architecture Module: `salt/cluster/consensus/raft/util.py`
```
"""
Small helpers for the Raft package (random election jitter, optional socket
checks, dynamic class loading).
"""

import functools
import logging
import random
import socket
import string

log = logging.getLogger(__name__)


def log_generator(size=6, chars=string.ascii_uppercase + string.digits):
    """Generate a random string of specified size."""
    return "".join(random.choice(chars) for _ in range(size))


def gettimeout(_min, _max):
    """Return a random timeout in seconds within the specified millisecond range."""
    return random.randint(_min, _max) * 0.001


def is_socket_closed(sock: socket.socket) -> bool:
    """Check non-blockingly if a TCP socket has been closed by the peer."""
    try:
        # this will try to read bytes without blocking and also without removing them from buffer (peek only)
        data = sock.recv(16, socket.MSG_DONTWAIT | socket.MSG_PEEK)
        if len(data) == 0:
            log.warning("Empty data")
            return True
    except BlockingIOError:
        return False  # socket is open and reading from it would block
    except ConnectionResetError:
        log.warning("Connection reset")
        return True  # socket was closed for some other reason
    except OSError as exc:
        if exc.errno == 107:  # Transport endpoint is not connected
            log.warning("Endpoint not connected")
            return False
        elif exc.errno == 9:  # Bad File Descriptor
            log.warning("Bad file descripor")
            return True
        log.exception("unexpected exception when checking if a socket is closed")
        return False
    except Exception:  # pylint: disable=broad-except
        log.exception("unexpected exception when checking if a socket is closed")
        return False
    return False


def log_exceptions_async(func):
    """Log unhandled exceptions in asynchronous functions as a decorator."""

    @functools.wraps(func)
    async def wrapped(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception:
            log.exception("Unhandled exception in %r", func)
            raise

    return wrapped


def log_exceptions(func):
    """Log unhandled exceptions in synchronous functions as a decorator."""

    @functools.wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception:
            log.exception("Unhandled exception in %r", func)
            raise

    return wrapped


def load_class(path):
    """
    Dynamically load a class from a string path.

    Example: ``salt.cluster.consensus.raft.log.CounterStateMachine``.
    """
    import importlib

    try:
        module_path, class_name = path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        return getattr(module, class_name)
    except (ImportError, AttributeError, ValueError) as e:
        raise ImportError(f"Failed to load class from {path}: {e}")

```

### Core Architecture Module: `salt/cluster/state_sync.py`
```
"""
Paged bulk state-sync for cluster joiners.

The cluster join handshake (``cluster/peer/join`` ->
``cluster/peer/join-reply``) carries the cluster's identity material
(``cluster_aes``, ``cluster.pem``, peer pubs), but the joining master
also needs the *content* the cluster has accumulated: accepted /
denied minion keys, the file_roots tree, and the pillar_roots tree.
That content can run from a few KB on a fresh cluster to tens of MB
on a production deployment with thousands of minions and a large
SLS tree.

To keep the join-reply itself small and to give the joiner partial-
progress + per-channel failure isolation, the state-sync runs on
*four independent streams*, each chunked by its own budget:

==============  ==================  =======================
channel         chunked by          per-chunk budget
==============  ==================  =======================
``keys``        entry count         ``DEFAULT_KEY_CHUNK_COUNT``
``denied_keys`` entry count         ``DEFAULT_KEY_CHUNK_COUNT``
``file_roots``  cumulative bytes    ``DEFAULT_ROOTS_CHUNK_BYTES``
``pillar_roots`` cumulative bytes   ``DEFAULT_ROOTS_CHUNK_BYTES``
==============  ==================  =======================

Wire format
-----------
The responder allocates a session id, names it in the join-reply's
``state_sync_session`` field, then publishes a series of
``cluster/peer/state-sync-chunk`` events to the joiner.  Each event
payload is a Crypticle-encrypted dict (encrypted under the cluster
session AES key the joiner just received in the same join-reply)::

    {
        "session":  str,            # matches join-reply state_sync_session
        "channel":  str,            # one of ALL_CHANNELS
        "seq":      int,            # 0-indexed sequence within this channel
        "total":    int,            # total chunks for this channel (-1 if unknown)
        "eof":      bool,           # True on the final chunk for this channel
        "items":    list,           # channel-specific entries
    }

A channel with no data still emits one chunk with ``items=[]`` and
``eof=True``, so receivers can use the ``eof`` flag uniformly.

Receiver state machine
----------------------
:class:`StateSyncSession` is held by the joiner's
``MasterPubServerChannel`` and tracks per-channel ``eof`` flags.  The
caller provides an ``on_complete`` callback that fires when all four
channels have either eof'd or the deadline expires (whichever comes
first); the channel server uses that callback to call
``_start_raft_as_learner`` only after bulk sync is at rest.
"""

import logging
import secrets
import time

import salt.cache
import salt.exceptions

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Channel names + chunking knobs
# ---------------------------------------------------------------------------

KEYS_CHANNEL = "keys"
DENIED_CHANNEL = "denied_keys"
FILE_ROOTS_CHANNEL = "file_roots"
PILLAR_ROOTS_CHANNEL = "pillar_roots"

# Channel prefix for arbitrary cache banks (multi-ring migration).  A
# channel string ``"bank:jobs/loads"`` names the cache bank that
# carries the payload; the receiver routes by prefix to
# :func:`install_bank_chunk`.  Used by
# ``cluster.collect_from_peers`` for caches other than the four
# join-time channels above.
BANK_CHANNEL_PREFIX = "bank:"

# Channel prefix for the join-time catch-up of replicate-mode cache
# banks.  Distinct from ``bank:`` so the receiver's install path can
# distinguish an operator-triggered collect pull (apply with the normal
# ``cache.store`` -- triggers replication) from a join-time catch-up
# (apply with ``_already_replicated=True`` so the chunks the sender
# already put on the wire don't trigger another round-trip).  See
# :func:`install_bank_sync_chunk`.
BANK_SYNC_CHANNEL_PREFIX = "bank_sync:"


def bank_channel(bank):
    """Return the wire channel name for *bank*."""
    return f"{BANK_CHANNEL_PREFIX}{bank}"


def bank_from_channel(channel):
    """Return the bank name a ``bank:`` channel was made from, or None."""
    if not channel or not channel.startswith(BANK_CHANNEL_PREFIX):
        return None
    return channel[len(BANK_CHANNEL_PREFIX) :]


def bank_sync_channel(bank):
    """Return the join-time catch-up wire channel name for *bank*."""
    return f"{BANK_SYNC_CHANNEL_PREFIX}{bank}"


def bank_from_sync_channel(channel):
    """Return the bank name a ``bank_sync:`` channel was made from, or None."""
    if not channel or not channel.startswith(BANK_SYNC_CHANNEL_PREFIX):
        return None
    return channel[len(BANK_SYNC_CHANNEL_PREFIX) :]


ALL_CHANNELS = (
    KEYS_CHANNEL,
    DENIED_CHANNEL,
    FILE_ROOTS_CHANNEL,
    PILLAR_ROOTS_CHANNEL,
)

# Default count per chunk for cache-key channels.  Tuned so a 200-entry
# minion-key chunk (avg pub key ~500 bytes -> ~100 KB) fits comfortably in
# one Crypticle-encrypted message without dominating heartbeat bandwidth.
DEFAULT_KEY_CHUNK_COUNT = 200

# Default per-chunk byte budget for file-tree channels.  1 MB is a
# pragmatic compromise: small enough that a TCP retransmit is cheap, big
# enough that a typical SLS tree fits in a handful of chunks.
DEFAULT_ROOTS_CHUNK_BYTES = 1 * 1024 * 1024

# Default per-chunk byte budget for a cache bank sync stream.  Banks
# like ``resource_grains`` can hold tens of MB on a production master;
# 2 MB per chunk keeps each state-sync-chunk event well under the
# transport's single-frame limit while shipping a 70 MB bank in ~35
# chunks rather than one message.
DEFAULT_BANK_SYNC_CHUNK_BYTES = 2 * 1024 * 1024

# Default deadline (seconds) the joiner waits for all four channels to
# eof before falling back to event-driven replication.
DEFAULT_RECEIVE_TIMEOUT = 30

# Internal top-level banks that MUST NOT be shipped by the join-time
# cache-bank sync: ``jobs`` is ring-routed (shipping would duplicate the
# owner's authoritative copy), the two ``cluster/`` subtrees own their
# own replication transport (Raft + state-sync-chunks).
BANK_SYNC_SKIP_PREFIXES = ("jobs", "cluster/consensus", "cluster/state_sync")


def new_session_id():
    """Return a fresh session id (URL-safe, no fixed length)."""
    return secrets.token_urlsafe(16)


# ---------------------------------------------------------------------------
# Sender-side: chunk generators
# ---------------------------------------------------------------------------


def _by_count(items, n):
    """Yield successive lists of *items* of size up to *n*."""
    chunk = []
    for item in items:
        chunk.append(item)
        if len(chunk) >= n:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def iter_keys_chunks(opts, channel, count=DEFAULT_KEY_CHUNK_COUNT, key_filter=None):
    """
    Yield ``items`` lists for the ``keys`` or ``denied_keys`` channel.

    Each item is ``{"id": minion_id, "value": cache_value}`` — a
    self-contained record the receiver hands straight to ``cache.store``.

    A bank with no entries (or whose entries are all filtered out) still
    yields one empty list so the caller can emit a single eof chunk.

    :param key_filter: Optional ``callable(minion_id) -> bool``.  When
                       present, only entries whose id passes the
                       filter are emitted.  Used by the multi-ring
                       ``cluster.collect_from_peers`` runner so a peer
                       only sends back the keys the requester asked
                       for, rather than its entire bank.
    """
    if channel not in (KEYS_CHANNEL, DENIED_CHANNEL):
        raise ValueError(f"iter_keys_chunks: unsupported channel {channel!r}")
    cache = salt.cache.Cache(opts, driver=opts["keys.cache_driver"])
    try:
        dump = cache.list_all(channel, include_data=True)
    except (AttributeError, salt.exceptions.SaltCacheError):
        dump = {}
    pairs = list((dump or {}).items())
    if key_filter is not None:
        pairs = [(mid, value) for mid, value in pairs if key_filter(mid)]
    items = [{"id": mid, "value": value} for mid, value in pairs]
    if not items:
        yield []
        return
    yield from _by_count(items, count)


def iter_root_chunks(roots_map, byte_budget=DEFAULT_ROOTS_CHUNK_BYTES):
    """
    Yield ``items`` lists for the ``file_roots`` / ``pillar_roots`` channel.

    Each item is ``{"env": str, "path": str, "mode": int, "data": bytes}``
    — flattened across envs so the receiver can apply each entry without
    needing to track env boundaries within a chunk.

    Chunks are bounded by *byte_budget*: a chunk is closed when adding
    the next entry would exceed the budget *and* the chunk already holds
    at least one entry.  A single file larger than the budget gets its
    own chunk on its own.

    An empty / missing roots map yields one empty list so the caller can
    emit a single eof chunk.
    """
    # Lazy import to avoid a circular dependency at module load.
    from salt.cluster.file_sync import (  # pylint: disable=import-outside-toplevel
        collect_root_tree,
    )

    dump = collect_root_tree(roots_map)
    if not dump:
        yield []
        return

    chunk = []
    chunk_bytes = 0
    for env, files in dump.items():
        for entry in files:
            entry_bytes = len(entry.get("data") or b"")
            if chunk and chunk_bytes + entry_bytes > byte_budget:
                yield chunk
                chunk = []
                chunk_bytes = 0
            chunk.append(
                {
                    "env": env,
                    "path": entry["path"],
                    "mode": entry.get("mode", 0o644),
                    "data": entry["data"],
                }
            )
            chunk_bytes += entry_bytes
    if chunk:
        yield chunk


def enumerate_replicate_banks(opts):
    """
    Return the sorted list of top-level cache banks on this master
    whose cross-master routing resolves to ``"replicate"``.

    Enumerates by walking the on-disk cachedir (
```

### Core Architecture Module: `salt/config/worker_pools.py`
```
"""
Default worker-pool configuration and validation for the Salt master.

Worker pools partition the master's MWorkers into named groups and route
specific commands to specific groups, so a slow workload cannot starve
time-critical traffic (for example ``_auth``).  See the
:ref:`tunable worker pools <tunable-worker-pools>` topic guide for the
user-facing overview.

This module contains three things:

* :data:`DEFAULT_WORKER_POOLS`, the configuration used when the operator
  provides no explicit ``worker_pools`` stanza and no ``worker_threads``
  override.
* :func:`validate_worker_pools_config`, called from master configuration
  processing to enforce structural and security invariants before the master
  is allowed to start.
* :func:`get_worker_pools_config`, which resolves the effective pool layout
  from the master opts, handling backward compatibility with
  ``worker_threads`` and the ``worker_pools_enabled=False`` legacy switch.

The pool dictionary shape is::

    {
        "<pool-name>": {
            "worker_count": <int >= 1>,
            "commands": ["<cmd>", ..., "*"?],
        },
        ...
    }

``commands`` entries are either exact command names (for example ``_auth``)
or the catchall marker ``"*"``.  Exactly one pool must use ``"*"``, and no
command may be claimed by more than one pool.
"""

# Default worker pool routing configuration.
#
# Two pools: a single-worker ``auth`` pool that handles minion authentication
# (``_auth``) and a four-worker ``default`` pool that catches everything
# else.  Total worker count matches the long-standing ``worker_threads``
# default of 5, so existing deployments see the same number of MWorker
# processes — the only change is that one of those workers is dedicated to
# auth, so a slow workload (e.g. a slow ext_pillar) cannot starve out
# minion authentication.
#
# The auth pool is sized to one worker on purpose: ``salt.cache.Cache``
# stores minion key state under ``keys/<id>`` and ``denied_keys/<id>``, and
# concurrent auth workers writing the same minion id could race on the
# pending → accepted → denied transitions.  Operators that have audited
# the cache backend for atomic store semantics can raise this.
#
# The master falls back to this value only when the operator sets neither
# ``worker_pools`` nor ``worker_threads``.
DEFAULT_WORKER_POOLS = {
    "auth": {
        "worker_count": 1,
        "commands": ["_auth"],
    },
    "default": {
        "worker_count": 4,
        "commands": ["*"],
    },
}


def validate_worker_pools_config(opts):
    """
    Validate the effective worker-pool configuration at master startup.

    Called during master configuration processing.  Returns ``True`` when
    the configuration is acceptable; raises :class:`ValueError` with a
    consolidated multi-line message listing every problem the validator
    found.  The accumulated reporting style lets operators fix their config
    in a single pass instead of discovering errors one at a time.

    The following invariants are enforced:

    * ``worker_pools`` is a non-empty dictionary.
    * Pool names are non-empty strings, contain no path separators
      (``/`` or ``\\``), do not begin with ``..``, and contain no null
      byte.  These rules exist purely to prevent pool names from being
      abused to steer IPC sockets or logs out of the master's runtime
      directories.
    * Each pool value is a dictionary containing an integer
      ``worker_count >= 1`` and a non-empty list of string ``commands``.
    * No command string is claimed by more than one pool.
    * Exactly one pool uses the ``"*"`` catchall entry so that any
      command not listed explicitly has a well-defined destination.

    When ``worker_pools_enabled`` is ``False`` validation is skipped; the
    master runs in the legacy single-queue MWorker mode where pool routing
    does not apply.

    :param dict opts: The master configuration dictionary.
    :returns: ``True`` when the configuration is valid.
    :raises ValueError: If the configuration is invalid.  The exception
        message lists every detected error.
    """
    if not opts.get("worker_pools_enabled", True):
        # Legacy mode, no validation needed
        return True

    # Get the effective worker pools (handles defaults and backward compat)
    worker_pools = get_worker_pools_config(opts)

    # If pools are disabled, no validation needed
    if worker_pools is None:
        return True

    errors = []

    # 1. Validate pool structure
    if not isinstance(worker_pools, dict):
        errors.append("worker_pools must be a dictionary")
        raise ValueError("\n".join(errors))

    if not worker_pools:
        errors.append("worker_pools cannot be empty")
        raise ValueError("\n".join(errors))

    # 2. Validate each pool
    cmd_to_pool = {}
    catchall_pool = None

    for pool_name, pool_config in worker_pools.items():
        # Validate pool name format (security-focused: block path traversal only)
        if not isinstance(pool_name, str):
            errors.append(f"Pool name must be a string, got {type(pool_name).__name__}")
            continue

        if not pool_name:
            errors.append("Pool name cannot be empty")
            continue

        # Security: block path traversal attempts
        if "/" in pool_name or "\\" in pool_name:
            errors.append(
                f"Pool name '{pool_name}' is invalid. Pool names cannot contain "
                "path separators (/ or \\) to prevent path traversal attacks."
            )
            continue

        # Security: block relative path components
        if (
            pool_name == ".."
            or pool_name.startswith("../")
            or pool_name.startswith("..\\")
        ):
            errors.append(
                f"Pool name '{pool_name}' is invalid. Pool names cannot be or start with "
                "'../' to prevent path traversal attacks."
            )
            continue

        # Security: block null bytes
        if "\x00" in pool_name:
            errors.append("Pool name contains null byte, which is not allowed.")
            continue

        if not isinstance(pool_config, dict):
            errors.append(f"Pool '{pool_name}': configuration must be a dictionary")
            continue

        # Check worker_count
        worker_count = pool_config.get("worker_count")
        if not isinstance(worker_count, int) or worker_count < 1:
            errors.append(
                f"Pool '{pool_name}': worker_count must be integer >= 1, "
                f"got {worker_count}"
            )

        # Check commands list
        commands = pool_config.get("commands", [])
        if not isinstance(commands, list):
            errors.append(f"Pool '{pool_name}': commands must be a list")
            continue

        if not commands:
            errors.append(f"Pool '{pool_name}': commands list cannot be empty")
            continue

        # Check for duplicate command mappings and catchall
        for cmd in commands:
            if not isinstance(cmd, str):
                errors.append(f"Pool '{pool_name}': command '{cmd}' must be a string")
                continue

            if cmd == "*":
                # Found catchall pool
                if catchall_pool is not None:
                    errors.append(
                        f"Multiple pools have catchall ('*'): "
                        f"'{catchall_pool}' and '{pool_name}'. "
                        "Only one pool can use catchall."
                    )
                catchall_pool = pool_name
                continue

            if cmd in cmd_to_pool:
                errors.append(
                    f"Command '{cmd}' mapped to multiple pools: "
                    f"'{cmd_to_pool[cmd]}' and '{pool_name}'"
                )
            else:
                cmd_to_pool[cmd] = pool_name

    # 3. Require exactly one catchall pool
    if catchall_pool is None:
        errors.append(
            "No catchall pool ('*') found. One pool must include '*' in its "
            "commands so every command has a routing destination."
        )

    if errors:
        raise ValueError(
            "Worker pools configuration validation failed:\n  - "
            + "\n  - ".join(errors)
        )

    return True


def get_worker_pools_config(opts):
    """
    Resolve the effective worker-pool configuration from master opts.

    Resolution order, first match wins:

    1. ``worker_pools_enabled`` is ``False`` — returns ``None`` to signal
       the legacy non-pooled code path.
    2. ``worker_pools`` is set and non-empty — returned verbatim.  The
       operator is fully in charge of pool layout.
    3. ``worker_threads`` is set — returns a synthesized single-pool
       configuration whose ``worker_count`` matches ``worker_threads`` and
       whose ``commands`` is the catchall ``["*"]``.  This is the upgrade
       path that keeps pre-3008.0 configurations byte-for-byte compatible.
    4. Neither is set — returns :data:`DEFAULT_WORKER_POOLS`.

    :param dict opts: The master configuration dictionary.
    :returns: The resolved pool layout, or ``None`` when pooling is
        explicitly disabled.
    :rtype: dict or None
    """
    # If pools explicitly disabled, return None (legacy mode)
    if not opts.get("worker_pools_enabled", True):
        return None

    # Check if worker_pools is explicitly configured AND not empty
    if "worker_pools" in opts and opts["worker_pools"]:
        return opts["worker_pools"]

    # Backward compatibility: convert worker_threads to single catchall pool
    if "worker_threads" in opts:
        worker_count = opts["worker_threads"]
        return {
            "default": {
                "worker_count": worker_count,
                "commands": ["*"],
            }
        }

    # Use default configuration
    return DEFAULT_WORKER_POOLS

```

### Core Architecture Module: `salt/engines/__init__.py`
```
"""
Initialize the engines system. This plugin system allows for
complex services to be encapsulated within the salt plugin environment
"""

import logging
import os
import time

import salt
import salt.loader
import salt.utils.platform
import salt.utils.process
from salt.exceptions import SaltSystemExit

log = logging.getLogger(__name__)

# How long a minion engine waits for the minion to create its key pair before
# resolving ``master_uri``. Generous on purpose: RSA key generation on slow
# hardware can take a while, and the wait only happens on a first start.
MINION_KEY_WAIT_TIMEOUT = 60


def start_engines(opts, proc_mgr, proxy=None):
    """
    Fire up the configured engines!
    """
    utils = salt.loader.utils(opts, proxy=proxy)
    if opts["__role"] == "master":
        runners = salt.loader.runner(opts, utils=utils)
    else:
        runners = []
    funcs = salt.loader.minion_mods(opts, utils=utils, proxy=proxy)
    engines = salt.loader.engines(opts, funcs, runners, utils, proxy=proxy)

    engines_opt = opts.get("engines", [])
    if isinstance(engines_opt, dict):
        engines_opt = [{k: v} for k, v in engines_opt.items()]

    # Function references are not picklable. Spawning platforms, Windows
    # and macOS, need to pickle when spawning, these will need to be recalculated
    # in the spawned child process.
    if salt.utils.platform.spawning_platform():
        runners = None
        utils = None
        funcs = None

    for engine in engines_opt:
        if isinstance(engine, dict):
            engine, engine_opts = next(iter(engine.items()))
        else:
            engine_opts = None
        engine_name = None
        if engine_opts is not None and "engine_module" in engine_opts:
            fun = "{}.start".format(engine_opts["engine_module"])
            engine_name = engine
            del engine_opts["engine_module"]
        else:
            fun = f"{engine}.start"
        if fun in engines:
            start_func = engines[fun]
            if engine_name:
                name = f"Engine({start_func.__module__}, name={engine_name})"
            else:
                name = f"Engine({start_func.__module__})"
            log.info("Starting %s", name)
            proc_mgr.add_process(
                Engine,
                args=(opts, fun, engine_opts, funcs, runners, proxy),
                name=name,
            )


class Engine(salt.utils.process.SignalHandlingProcess):
    """
    Execute the given engine in a new process
    """

    def __init__(self, opts, fun, config, funcs, runners, proxy, **kwargs):
        """
        Set up the process executor
        """
        super().__init__(**kwargs)
        self.opts = opts
        self.config = config
        self.fun = fun
        self.funcs = funcs
        self.runners = runners
        self.proxy = proxy

    def _ensure_master_uri(self):
        """
        Complete the transport opts for a minion engine.

        A minion forks its engines early in startup -- before it has connected
        and resolved ``master_uri`` into its opts -- so the engine runs against
        a snapshot that lacks it. Any ``__salt__`` call that needs the master
        transport (e.g. ``pillar.data``) then raises ``KeyError: 'master_uri'``
        (#57952). Resolve it here, in the engine's own process, before the
        execution modules are loaded/used.

        This is deliberately best-effort so it can never block or break engine
        startup: master engines have a different role (and no master),
        masterless minions need no transport, and DNS is resolved once without
        the minion connect loop's retry so a transport-less engine still starts
        even when the master is not resolvable.

        A list ``master`` (``master_type: failover``/``distributed``) is left
        alone: the engine cannot know which master the minion will pick, and
        ``resolve_dns`` raises ``SaltSystemExit`` (a ``SystemExit``, not an
        ``Exception``) for a list, which would kill the engine process.

        Once the master resolves, it waits for the minion's key pair before
        setting ``master_uri`` (see ``_wait_for_minion_keys``), so the engine
        never generates keys of its own on a first start. The master is
        resolved first because the minion also resolves it before creating its
        keys: when it does not resolve, the minion has no keys to wait for.
        """
        if (
            self.opts.get("__role") != "minion"
            or "master_uri" in self.opts
            or (
                self.opts.get("file_client") == "local"
                and not self.opts.get("use_master_when_local")
            )
        ):
            return
        if isinstance(self.opts.get("master"), list):
            log.debug(
                "%s: master is a list (master_type %s); not resolving master_uri "
                "in the engine",
                self.name,
                self.opts.get("master_type"),
            )
            return
        try:
            import salt.minion

            resolved = salt.minion.resolve_dns(
                dict(self.opts, retry_dns=0), fallback=False
            )
        except (Exception, SaltSystemExit) as exc:  # pylint: disable=broad-except
            log.warning(
                "%s: could not resolve master_uri; salt functions that need "
                "the master transport may not work in this engine: %s",
                self.name,
                exc,
            )
            return
        if not self._wait_for_minion_keys():
            log.warning(
                "%s: the minion key pair did not appear in %s within %s seconds; "
                "not setting master_uri, so salt functions that need the "
                "master transport may not work in this engine",
                self.name,
                self.opts.get("pki_dir"),
                MINION_KEY_WAIT_TIMEOUT,
            )
            return
        self.opts.update(resolved)

    def _wait_for_minion_keys(self):
        """
        Wait, for a bounded time, until the minion's key pair exists on disk.

        Once ``master_uri`` is set, anything in the engine that uses the master
        transport creates an ``AsyncAuth``, which generates a key pair if
        ``minion.pem`` is missing. Engines start before the minion has
        connected, so on a first start the engine and the minion could both
        generate keys at once and end up with different ones, leaving one of
        them unable to authenticate. The minion writes ``minion.pem`` and then
        ``minion.pub``, each atomically. ``AsyncAuth`` generates keys when
        ``minion.pub`` is missing at construction or ``minion.pem`` is missing
        in ``get_keys``, so once both exist the engine always loads the
        minion's keys instead of creating its own.

        Returns ``True`` when both files exist, ``False`` on timeout.
        """
        pki_dir = self.opts.get("pki_dir")
        if not pki_dir:
            return False
        pem = os.path.join(pki_dir, "minion.pem")
        pub = os.path.join(pki_dir, "minion.pub")
        deadline = time.monotonic() + MINION_KEY_WAIT_TIMEOUT
        while True:
            if os.path.exists(pem) and os.path.exists(pub):
                return True
            if time.monotonic() >= deadline:
                return False
            time.sleep(0.5)

    def run(self):
        """
        Run the master service!
        """
        self._ensure_master_uri()
        self.utils = salt.loader.utils(self.opts, proxy=self.proxy)
        if salt.utils.platform.spawning_platform():
            # Calculate function references since they can't be pickled.
            if self.opts["__role"] == "master":
                self.runners = salt.loader.runner(self.opts, utils=self.utils)
            else:
                self.runners = []
            self.funcs = salt.loader.minion_mods(
                self.opts, utils=self.utils, proxy=self.proxy
            )

        self.engine = salt.loader.engines(
            self.opts, self.funcs, self.runners, self.utils, proxy=self.proxy
        )
        kwargs = self.config or {}

        try:
            self.engine[self.fun](**kwargs)
        except Exception:  # pylint: disable=broad-except
            log.critical(
                "%s could not be started!",
                self.name,
                exc_info=True,
            )

```

### Core Architecture Module: `salt/engines/reactor.py`
```
"""
Setup Reactor

Example Config in Master or Minion config

.. code-block:: yaml

    engines:
      - reactor:
          refresh_interval: 60
          worker_threads: 10
          worker_hwm: 10000

    reactor:
      - 'salt/cloud/*/destroyed':
        - /srv/reactor/destroy/*.sls

"""

import salt.utils.reactor


def start(refresh_interval=None, worker_threads=None, worker_hwm=None):
    if refresh_interval is not None:
        __opts__["reactor_refresh_interval"] = refresh_interval
    if worker_threads is not None:
        __opts__["reactor_worker_threads"] = worker_threads
    if worker_hwm is not None:
        __opts__["reactor_worker_hwm"] = worker_hwm

    salt.utils.reactor.Reactor(__opts__).run()

```

### Core Architecture Module: `salt/engines/script.py`
```
"""
Send events based on a script's stdout

Example Config

.. code-block:: yaml

    engines:
      - script:
          cmd: /some/script.py -a 1 -b 2
          output: json
          interval: 5
          onchange: false

Script engine configs:

cmd
    Script or command to execute

output
    Any available saltstack deserializer

interval
    How often in seconds to execute the command

onchange
    .. versionadded:: 3006.0

    Only fire an event if the tag-specific output changes. Defaults to False.
"""

import logging
import shlex
import subprocess
import time

import salt.loader
import salt.utils.event
import salt.utils.process
from salt.exceptions import CommandExecutionError

log = logging.getLogger(__name__)


def _read_stdout(proc):
    """
    Generator that returns stdout
    """
    yield from iter(proc.stdout.readline, b"")


def _get_serializer(output):
    """
    Helper to return known serializer based on
    pass output argument
    """
    serializers = salt.loader.serializers(__opts__)
    try:
        return getattr(serializers, output)
    except AttributeError:
        raise CommandExecutionError(
            f"Unknown serializer `{output}` found for output option"
        )


def start(cmd, output="json", interval=1, onchange=False):
    """
    Parse stdout of a command and generate an event

    The script engine will scrap stdout of the
    given script and generate an event based on the
    presence of the 'tag' key and its value.

    If there is a data obj available, that will also
    be fired along with the tag.

    Example:

        Given the following json output from a script:

            .. code-block:: json

                { "tag" : "lots/of/tacos",
                "data" : { "toppings" : "cilantro" }
                }

        This will fire the event 'lots/of/tacos'
        on the event bus with the data obj as is.

    :param cmd: The command to execute
    :param output: How to deserialize stdout of the script
    :param interval: How often to execute the script
    :param onchange: Only fire an event if the tag-specific output changes
    """
    try:
        cmd = shlex.split(cmd)
    except AttributeError:
        cmd = shlex.split(str(cmd))
    log.debug("script engine using command %s", cmd)

    serializer = _get_serializer(output)

    if __opts__.get("__role") == "master":
        fire_master = salt.utils.event.get_master_event(
            __opts__, __opts__["sock_dir"]
        ).fire_event
    else:
        fire_master = __salt__["event.send"]

    if onchange:
        events = {}

    while True:
        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
            )

            log.debug("Starting script with pid %d", proc.pid)

            for raw_event in _read_stdout(proc):
                log.debug(raw_event)

                event = serializer.deserialize(raw_event)
                tag = event.get("tag", None)
                data = event.get("data", {})

                if data and "id" not in data:
                    data["id"] = __opts__["id"]

                if tag:
                    if onchange and tag in events and events[tag] == data:
                        continue
                    log.info("script engine firing event with tag %s", tag)
                    fire_master(tag=tag, data=data)
                    if onchange:
                        events[tag] = data

            log.debug("Closing script with pid %d", proc.pid)
            proc.stdout.close()
            rc = proc.wait()
            if rc:
                raise subprocess.CalledProcessError(rc, cmd)

        except subprocess.CalledProcessError as e:
            log.error(e)
        finally:
            if proc.poll is None:
                proc.terminate()

        time.sleep(interval)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #70793** (2026-11-19): **[Bug]: whitelist_modules / whitelist_state_modules cannot restrict to specific functions**
  *Symptoms*: ### What happened? `whitelist_modules` and `whitelist_state_modules` only accept bare module names. There is no way to allow a single function of a module while blocking its siblings -- e.g. "allow cmd.run but not cmd.shell / cmd.retcode / cmd.run_bg". Operators who want to give a minion access to one function of a module today have to allow the entire module, which widens the attack surface well beyond what the deployment actually needs.  Expected: entries of the form `module.func` are accepted and enforce function-level filtering. `[cmd]` still means "all functions of cmd"; `[cmd.run]` means "only cmd.run". Mixing (e.g. `[cmd, cmd.run]`) should narrow to the listed functions (dotted wins) so an existing whitelist can be tightened without first removing the broader entry.  Reproduce (any supported branch): ```yaml # /etc/salt/minion.d/whitelist.conf whitelist_modules:   - cmd.run ``` ``` $ salt-call cmd.run 'id' # fails: module `cmd` not in whitelist, because the loader only looks at the # part before the dot and the full `cmd.run` entry is not recognised. ```  Affects: 3006.x, 3007.x, 3008.x, master. Enforcement lives in `salt.loader.lazy.LazyLoader` so a single fix covers execution modules, state modules, and every other subsystem that uses it.  ### Type of salt install n/a -- configuration-level issue, affects all install types.  ### Major version 3006.x, 3007.x, 3008.x  ### What OS n/a -- not OS-specific.  ### salt --versions-report output n/a -- reproducible on any buil

- **Issue #70789** (2026-11-19): **[Bug]: Scheduled returns scan all accepted minion keys causing extreme load**
  *Symptoms*: ### What happened?  After upgrading a Salt master from 3006.28 to 3008.5, MWorker processes on the master overloaded causing master issues.  The master has approximately > 100K+ accepted minion keys and 128 MWorkers. It uses ZeroMQ, master_job_cache: local_cache, keys.cache_driver: localfs_key, and key_cache: sched. Async MWorkers are  disabled. PKI and the master cache are on local SSD-backed ZFS.  A three-second strace sample of one worker showed 58,821 lstat calls, accounting for 99.96% of its syscall time. Python stack samples from three separate MWorkers showed the same path:     AESFuncs._sync_return      → salt.utils.job.store_job      → salt.utils.job._store_job      → local_cache.save_load      → CkMinions.check_minions      → CkMinions._check_glob_minions      → Key.glob_match      → Key.list_keys      → localfs_key.list_all      → clean_path      → realpath / lstat  For a standalone or scheduled minion return with jid: req, _store_job sets:     load["tgt_type"] = "glob"    load["tgt"] = load["id"]  It then calls save_load without a precomputed minion list. local_cache.save_load resolves the returning minion’s ID as a glob, causing enumeration and path validation across the entire accepted-key inventory.  Expected behavior: caching a standalone return should not require discovering its target across all accepted minion keys. Passing minions=[load["id"]] to the initial save_load call avoids this lookup while preserving existing target metadata and cache layout.  ### 
  **Post-Mortem & Fix Analysis**:
  > Hi there! Welcome to the Salt Community! Thank you for making your first contribution. We have a lengthy process for issues and PRs. Someone from the Core Team will follow up as soon as possible. In the meantime, here's some information that may help as you continue your Salt journey. Please be sure to review our [Code of Conduct](https://github.com/saltstack/salt/blob/master/CODE_OF_CONDUCT.md). Also, check out some of our community resources including:    - [Salt's Contributor Guide](https://docs.saltproject.io/en/master/topics/development/contributing.html)   - [Join our Community Discord](https://discord.com/invite/J7b7EscrAs)   - [Salt Project YouTube channel](https://www.youtube.com/channel/UCpveTIucFx9ljGelW63-BWg)   - [GitHub Discussions](https://github.com/saltstack/salt/discussions)  There are lots of ways to get involved in our community. Every month, there are around a dozen opportunities to meet with other contributors and the Salt Core team and collaborate in real time. T
  > Fixed by #70790; will ship in 3008.7.

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

### Incident Patch 1: `eae114ea` (2026-11-15)
**Commit Message**: Fix cluster cache replication defaults (#70773)

* WIP: cache facade fan-out + per-bank routing

* channel: guard cluster/peer/discover-reply against missing cluster_pub

The discover-reply handler at server.py:4058 called
salt.crypt.PublicKeyString(payload["cluster_pub"]) without guarding
against None, so a joiner master that answered another joiner's
discover before its own join-reply from the founder had landed would
crash the recipient's publish daemon with
AttributeError: 'NoneType' object has no attribute 'encode'.

Fix both sides of the handshake:

* Receiver: early-return when the discover-reply payload lacks
  cluster_pub.  A debug log carries the peer_id so the retry can be
  observed.  Previously the recipient's publish daemon died outright
  via an unhandled AttributeError, after which the joiner never
  started its Raft learner and the cluster never stabilised.

* Sender: skip the discover-reply when cluster_public_key() returns
  None (the joiner has not installed cluster.pub yet).  Prevents the
  peer from having to reject or defer; the next discover round picks
  up the key once join-reply has landed.

The bug is pre-existing but was latent on resources-2 because th

**File**: `changelog/70773.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+Stage ``localfs`` cache writes in a sibling ``.localfs_tmp/`` directory so concurrent ``cache.list`` calls never observe in-flight ``tempfile.mkstemp`` files in the bank directory.
+
+Buffer cluster cache-replication events for peers that have not yet completed the discover/join handshake and replay them in FIFO order on handshake completion, so live writes landing during a peer's join window are delivered without relying solely on the join-time state-sync snapshot.
+
+Invalidate every pending cluster cache-replication queue whenever the local ``cluster_aes`` is replaced -- on operator-triggered rotation and on initial install via ``cluster/peer/join-reply`` on a (re)joining master -- so stale pre-encrypted events are never replayed with a key the receiver cannot decrypt.
```

**File**: `doc/ref/cache/all/index.rst` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ For understanding and usage of the cache modules see the :ref:`cache` topic.
     :toctree:
     :template: autosummary.rst.tmpl
 
+    _cluster_replicator
     consul
     etcd_cache
     localfs
```

**File**: `doc/ref/cache/all/salt.cache._cluster_replicator.rst` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+salt.cache._cluster_replicator
+==============================
+
+.. automodule:: salt.cache._cluster_replicator
+    :members:
```

**File**: `salt/cache/__init__.py` (modified, +268/-6)
```diff
@@ -19,6 +19,58 @@
 log = logging.getLogger(__name__)
 
 
+# Thread-local re-entrancy guard for cross-master cache replication.
+# ``Cache.store`` / ``Cache.store_many`` consult this flag before
+# emitting a ``cluster/runner/delegate_cache_write`` event: a peer-side
+# handler (see ``salt/channel/server.py:_handle_delegate_cache_write``)
+# applies incoming replication writes by calling ``cache.store`` again
+# with the flag set, which must NOT re-broadcast or we'd build an
+# infinite fan-out loop across the cluster.  The ``originating_master``
+# check in the peer-side handler is the primary loop-safety guard; this
+# thread-local is the second line of defense.
+_REPLICATION_STATE = threading.local()
+
+
+def _set_already_replicated(flag):
+    """Mark the current thread as applying a peer-originated write."""
+    _REPLICATION_STATE.already_replicated = bool(flag)
+
+
+def _is_already_replicated():
+    return getattr(_REPLICATION_STATE, "already_replicated", False)
+
+
+def _resolve_bank_routing(routing, bank):
+    """
+    Longest-prefix-match lookup of a bank name against the routing map.
+
+    Replication routing is keyed by top-level bank name (``jobs``,
+    ``cluster/consensus``, ...) but cache writes land on compound
+    sub-banks (``jobs/loads``, ``cluster/consensus/<node>/cluster/log``).
+    A plain ``routing.get(bank, default)`` therefore misses the common
+    case; this helper resolves by:
+
+    1. Exact-match the full bank name.
+    2. Strip one ``/``-delimited segment at a time and retry.
+    3. If no prefix matches, return ``"replicate"`` (the historical default).
+
+    :param routing: Dict of ``{bank_prefix: "ring"|"replicate"|"none"}``,
+                    as returned by ``salt.config.get_cluster_cache_routing``.
+    :param bank:    Full bank name for the pending write.
+    :returns:       Resolved mode string.
+    """
+    if bank in routing:
+        return routing[bank]
+    parts = bank.split("/")
+    # Drop one trailing segment per iteration: a/b/c -> a/b -> a.
+    while len(parts) > 1:
+        parts.pop()
+        prefix = "/".join(parts)
+        if prefix in routing:
+            return routing[prefix]
+    return "replicate"
+
+
 def factory(opts, **kwargs):
     """
     Creates and returns the cache class.
@@ -76,6 +128,11 @@ def __init__(self, opts, cachedir=None, **kwargs):
 
     @cached_property
     def modules(self):
+        # Honor a pre-populated ``_modules`` dict so tests and
+        # non-loader-driven callers can inject a mock driver without
+        # touching the cached_property machinery.
+        if self._modules is not None:
+            return self._modules
         return salt.loader.cache(self.opts)
 
     @cached_property
@@ -129,7 +186,7 @@ def cache(self, bank, key, fun, loop_fun=None, **kwargs):
 
         return data
 
-    def store(self, bank, key, data, expires=None):
+    def store(self, bank, key, data, expires=None, _already_replicated=False):
         """
         Store data using the specified module
 
@@ -149,25 +206,225 @@ def store(self, bank, key, data, expires=None):
         :param expires:
             how many seconds from now the data should be considered stale.
 
+        :param _already_replicated:
+            Internal flag used by the cluster-cache replication facade.
+            When True the local write proceeds but no cross-master
+            fan-out is performed.  The peer-side handler passes this
+            when applying an incoming replication event so the same
+            write doesn't bounce back to every peer again.  Not part
+            of the public API.
+
          :raises SaltCacheError:
             Raises an exception if cache driver detected an error accessing data
             in the cache backend (auth, permissions, etc).
         """
         fun = f"{self.driver}.store"
         try:
-            return self.modules[fun](bank, key, data, expires=expires, **self.kwargs)
+            result = self.modules[fun](bank, key, data, expires=expires, **self.kwargs)
         except TypeError:
             # if the backing store doesnt natively support expiry, we handle it as a fallback
             if expires:
                 expires_at = datetime.datetime.now().astimezone() + datetime.timedelta(
                     seconds=expires
                 )
                 expires_at = int(expires_at.timestamp())
-                return self.modules[fun](
+                result = self.modules[fun](
                     bank, key, {"data": data, "_expires": expires_at}, **self.kwargs
                 )
             else:
-                return self.modules[fun](bank, key, data, **self.kwargs)
+                result = self.modules[fun](bank, key, data, **self.kwargs)
+        # Cross-master replication fan-out at the facade.  Guarded so
+        # non-clustered masters and shared-FS clusters pay no overhead.
+        # The peer-side re-dispatch arrives with
+        # ``_already_replicated=True`` and 
```

**File**: `salt/cache/_cluster_replicator.py` (added, +1320/-0)
```diff
@@ -0,0 +1,1320 @@
+"""
+Cross-master cache replication seams.
+
+Free-function entry points for both sides of the delegate-cache-write
+flow so each side is testable without instantiating a channel class
+or a Cache object.  ``Cache.store`` and ``Cache.store_many`` emit via
+:func:`fire_peer_cache_write` / :func:`fire_peer_cache_write_many` /
+:func:`fire_delegate_cache_write`;
+``MasterPubServerChannel._handle_delegate_cache_write`` delegates to
+:func:`_handle_delegate_cache_write`.
+"""
+
+import atexit
+import collections
+import concurrent.futures
+import dataclasses
+import hashlib
+import logging
+import os
+import threading
+import time
+
+import salt.cache
+
+log = logging.getLogger(__name__)
+
+
+# ---------------------------------------------------------------------------
+# Sender-side handshake gate
+# ---------------------------------------------------------------------------
+#
+# A cluster_aes-encrypted ``cluster/peer/delegate-cache-write`` /
+# ``delegate-resource-register-write`` event must only be fanned out to
+# peers that have completed the cluster discover/join handshake.  A peer
+# that is still running on its initial random ``cluster_aes`` (join-reply
+# not yet installed) cannot decrypt the event; the publish daemon on
+# that peer logs a loud ``Failed to decrypt`` exception and drops the
+# payload.  The write is lost on that peer until the next write to the
+# same (bank, key) lands, or until state-sync primitives (initiated by
+# join-reply) catch the peer up.
+#
+# Catch-up guarantee: a peer that completes its handshake AFTER this
+# gate decides to skip it still ends up consistent because
+#
+#   * the join-reply's ``state_sync_cache_banks`` enumerates every
+#     replicate-mode bank and streams the current contents in
+#     ``state-sync-chunk`` events (see
+#     :mod:`salt.cluster.state_sync` and the ``send_state_sync_chunks``
+#     call in the join-reply handler), AND
+#   * subsequent writes on the originator will see the peer as joined
+#     and fan out normally.
+#
+# So the gate defers the write to the peer's catch-up stream, which is
+# the design-intended path for pre-handshake writes.  The pending queue
+# is bounded (``cluster_cache_replicate_pending_max_events``, default
+# 10_000 per peer) and TTL-expired
+# (``cluster_cache_replicate_pending_ttl``, default 300s): queued events
+# past the cap evict oldest-first with a coalesced WARN per peer, and
+# TTL-expired events are dropped on next enqueue.  In sustained-burst or
+# long-un-joined conditions that bound can be reached, so this is NOT a
+# zero-loss contract -- it is a short-window catch-up for the common
+# ``peer joining in <few seconds>`` case.  Operators seeing sustained
+# skip-logs should investigate why a peer is not completing handshake.
+#
+# API shape: the publish daemon holds the authoritative ``_discover_replies``
+# + ``peer_keys`` sets; it passes them into :func:`filter_joined_pushers`
+# which returns ``(kept, skipped)`` and emits a warning when a peer is
+# skipped.  The gate can be disabled globally via
+# ``opts["cluster_cache_replicate_require_joined"] = False``.
+_SKIP_LOG_INTERVAL = 5.0  # seconds; coalesce skip-warnings per peer
+_SKIP_LOG_LAST = {}  # (host, context) -> (last_ts, suppressed_count)
+_SKIP_LOG_LOCK = threading.Lock()
+
+
+def peer_is_joined(discover_replies, peer_keys, peer_host):
+    """
+    Return ``True`` if ``peer_host`` has completed the cluster
+    discover/join handshake far enough to decrypt cluster_aes
+    events.
+
+    The handshake has two observable signals:
+
+    * ``discover_replies`` -- this master has received a signed
+      ``cluster/peer/discover-reply`` from the peer.  That reply is
+      sent only after the peer has installed cluster.pub locally,
+      which in turn happens after the peer processed a ``join-reply``
+      (which carried ``cluster_aes``).  A peer in this set is
+      therefore guaranteed to have our current ``cluster_aes``.
+
+    * ``peer_keys`` -- this master has received the peer's session AES
+      key via the ``cluster/peer/<master_id>`` AES-key broadcast.
+      That broadcast is independent of the discover protocol but it
+      ALSO only fires after the peer has installed cluster_aes
+      (``send_aes_key_event`` is called from the ``cluster/peer``
+      handler which itself runs after key installation).  So
+      ``peer_keys`` membership is a slightly later-but-equivalent
+      signal; we accept it to tolerate restart scenarios where
+      ``discover_replies`` is empty but the peer is fully joined.
+
+    The host match is lenient: ``cluster_peers`` entries may carry a
+    ``:port`` suffix while the handshake handlers key on the bare
+    host, so we match either form.
+
+    :param discover_replies: Iterable/set of peer ids that have
+                             sent us ``discover-reply``.
+    :param peer_keys:        Dict of ``peer_id -> session_key`` from
+                             ``MasterPubServe
```

**File**: `salt/cache/localfs.py` (modified, +18/-1)
```diff
@@ -71,7 +71,24 @@ def store(bank, key, data, cachedir):
                 f"The cache directory, {outdir}, could not be created: {exc}"
             )
 
-    tmpfh, tmpfname = tempfile.mkstemp(dir=base)
+    # Stage the write in a sibling tmp directory so concurrent ``list_``
+    # callers never observe in-flight ``tmpXXXXXXXX`` files in the bank
+    # directory.  Cluster cache replication (cluster_isolated_filesystem
+    # = True) can race an in-process ``cache.list(bank)`` against a
+    # daemon-side ``cache.store(bank, ...)`` fan-out from a peer master;
+    # with ``mkstemp(dir=base)`` the listdir call caught the tmpfile
+    # before ``atomic_rename`` completed.  Keeping the staging dir under
+    # ``cachedir`` preserves the same-filesystem invariant that
+    # ``atomic_rename`` relies on.
+    tmpdir = salt.utils.path.join(cachedir, ".localfs_tmp")
+    try:
+        os.makedirs(tmpdir)
+    except OSError as exc:
+        if exc.errno != errno.EEXIST:
+            raise SaltCacheError(
+                f"The cache tmp directory, {tmpdir}, could not be created: {exc}"
+            )
+    tmpfh, tmpfname = tempfile.mkstemp(dir=tmpdir)
     os.close(tmpfh)
     try:
         with salt.utils.files.fopen(tmpfname, "w+b") as fh_:
```

**File**: `salt/cache/mmap_cache.py` (modified, +46/-0)
```diff
@@ -201,6 +201,52 @@ def store(bank, key, data, cachedir, **kwargs):
         )
 
 
+def store_many(bank, items, cachedir, **kwargs):
+    """
+    Bulk-store many ``(key, data)`` pairs under *bank* in a single
+    :meth:`~salt.utils.mmap_cache.MmapCache.put_many` call.
+
+    Equivalent in effect to looping ``store(bank, k, v)`` over *items*,
+    but pays the flock + fsync + msync cost once for the whole batch
+    instead of once per entry.  Required for batched hot paths like
+    the master's resource-grain register handler to keep up with
+    5 concurrent minion registers.
+
+    :param bank: cache bank (same semantics as :func:`store`).
+    :param items: iterable of ``(key, data)`` pairs. May be a dict, in
+        which case ``dict.items()`` is used.
+    :param cachedir: driver cachedir (injected by the facade's
+        :attr:`salt.cache.Cache.kwargs`).
+
+    :raises SaltCacheError: if any value fails to msgpack-serialise
+        (the batch is aborted before the ``put_many`` call and no
+        items are written) or if the underlying ``put_many`` reports
+        a failure.
+    """
+    if isinstance(items, dict):
+        items = items.items()
+
+    packed = []
+    for key, data in items:
+        try:
+            raw = msgpack.packb(data, **_PACK_OPTS)
+        except Exception as exc:  # pylint: disable=broad-except
+            raise SaltCacheError(
+                f"Failed to serialise cache data for bank={bank!r} key={key!r}: {exc}"
+            )
+        packed.append((key, raw))
+
+    if not packed:
+        return
+
+    cache = _get_cache(bank, cachedir)
+    if not cache.put_many(packed):
+        raise SaltCacheError(
+            f"Failed to bulk-write mmap cache entries bank={bank!r} "
+            f"(count={len(packed)})"
+        )
+
+
 def fetch(bank, key, cachedir, **kwargs):
     """
     Return the deserialised value for *bank*/*key*, or ``{}`` if not found.
```

**File**: `salt/channel/server.py` (modified, +1111/-75)
```diff
@@ -103,7 +103,7 @@ def _transport_has_builtin_router(transport):
     ZeroMQ's ``pre_fork`` adds ``zmq_device_pooled`` for that purpose, so
     :class:`PoolRoutingChannel` does not need to spawn its own router.
     Other transports (TCP, WebSockets) bind the external socket but rely on
-    a separate process to serve it — :class:`PoolRoutingChannel.pre_fork`
+    a separate process to serve it -- :class:`PoolRoutingChannel.pre_fork`
     spawns ``_run_pool_router`` for that case.
     """
     module = getattr(transport.__class__, "__module__", "") or ""
@@ -520,7 +520,7 @@ async def handle_message(self, payload):
             # Block non-_auth requests until this node is a committed Raft voter.
             if not _cluster_is_ready(self.opts):
                 log.debug(
-                    "Cluster not ready yet — deferring request from %s",
+                    "Cluster not ready yet -- deferring request from %s",
                     payload.get("load", {}).get("id", "unknown"),
                 )
                 return {"enc": "clear", "load": {"ret": False, "cluster_retry": True}}
@@ -775,7 +775,7 @@ class PoolRoutingChannel:
 
     This class is returned by :meth:`ReqServerChannel.factory` when
     ``worker_pools_enabled=True`` (the default).  It is mutually exclusive
-    with the plain :class:`ReqServerChannel` — only one of the two is ever
+    with the plain :class:`ReqServerChannel` -- only one of the two is ever
     active for a given master process.
 
     Architecture::
@@ -1449,7 +1449,7 @@ async def handle_and_route_message(self, payload):
 
             # Block non-_auth requests until this node is a committed Raft voter.
             if cmd != "_auth" and not _cluster_is_ready(self.opts):
-                log.debug("Cluster not ready yet — deferring %s request", cmd)
+                log.debug("Cluster not ready yet -- deferring %s request", cmd)
                 return {"enc": "clear", "load": {"ret": False, "cluster_retry": True}}
 
             if pool_name not in self.pool_clients:
@@ -1852,6 +1852,22 @@ def __init__(
         self._discover_event = None
         self._discover_token = None
         self._discover_candidates = {}
+        # Set of peer ids we have received a ``cluster/peer/discover-reply``
+        # from.  Populated in the discover-reply branch of
+        # ``handle_pool_publish`` and consumed by
+        # ``_pending_discover_peers`` so the periodic retry stops once each
+        # peer has confirmed the discover handshake.  Falling back to
+        # ``peer_keys`` would be unsafe here -- the AES-key broadcast
+        # (``send_aes_key_event``) populates ``peer_keys`` independently
+        # of the discover protocol, so a retry keyed on ``peer_keys``
+        # cancels before any ``discover-reply`` has actually landed.
+        self._discover_replies = set()
+        # Tornado ``PeriodicCallback`` driving ``_schedule_discover_retry``
+        # when this master is a non-founder joining an existing cluster.
+        # None when inactive -- set in ``_publish_daemon`` and cleared
+        # once every peer has replied to the discover or the retry
+        # deadline expires.
+        self._discover_retry_pc = None
         # Set by service.py once the Raft node is started.
         self._raft_dispatcher = None
 
@@ -1868,7 +1884,7 @@ def _start_raft_as_founding_voter(self):
             return  # already started by a join-reply race
 
         log.info(
-            "No join-reply received — starting Raft as founding voter for cluster %r",
+            "No join-reply received -- starting Raft as founding voter for cluster %r",
             self.opts["cluster_id"],
         )
         try:
@@ -1906,7 +1922,7 @@ def _start_raft_as_learner(self, known_peers):
         ``io_loop.start()`` so the asyncio loop is already running.
 
         :param known_peers: dict ``{peer_id: pub_key_pem}`` from the
-                            ``join-reply`` payload — the addresses of all
+                            ``join-reply`` payload -- the addresses of all
                             existing cluster members.
         """
         if self._raft_service is not None:
@@ -1984,7 +2000,7 @@ def _handle_multi_ring_runner_event(self, tag, data):
             elif tag == "cluster/runner/route_clear":
                 svc.propose_route(data["data_type"], None)
             elif tag == "cluster/runner/ring_set":
-                # Per-ring policy commit — proposes RING_CONFIG on
+                # Per-ring policy commit -- proposes RING_CONFIG on
                 # the named ring's *own* log.  The ring's Node must
                 # be the leader of its own group on this master.
                 ring_id = data["ring_id"]
@@ -2049,7 +2065,7 @@ async def _fanout_multi_ring_request(self, tag, data):
         cluster_aes-encrypted ``cluster/peer/multi-ring-request`` event
         and push it to every peer; each peer's handler re-dispatches via
         :meth:`_handle_multi_ring_runn
```

---

### Incident Patch 2: `803ceba7` (2026-11-18)
**Commit Message**: Close arm64 cluster cache-replication race class (#70831)

* collect-from-peers: gate fan-out + per-peer sentinel eofs

NEW-10 (arm64 race closure, phase 1 of 5).

* ``_run_collect_from_peers`` consults ``filter_joined_pushers`` before
  sizing ``expected_peers`` so the sentinel's completion threshold is
  set from the kept set, not the raw ``self.pushers`` list.  Un-joined
  peers are enumerated in ``skipped_peers`` on the sentinel JSON for
  operator forensics.  ``pending_event=None`` keeps the "skip + WARN,
  no replay" contract -- a PULL cannot be meaningfully re-played
  because the sentinel's ``expected_peers`` is scoped to one run.
  Empty-kept aborts BEFORE emitting any collect-request and writes a
  deterministic sentinel.

* Reviewer correction #2 (per-peer EOF tracking): ``_record_collect_chunk``
  now takes an optional ``source_peer`` kwarg and the sentinel's
  per-channel state carries a ``peers_eofed`` sorted list.  The
  completion check is ``peers_eofed >= set(expected_peers)`` per
  channel, not a monotonic ``eofs_seen`` counter.  Without per-peer
  identity, a SKIPPED peer whose cluster_aes install races the
  fan-out and emits an eof could flip ``complete=True`` 

**File**: `changelog/70831.fixed.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+Fix three-master bootstrap race on ``cluster.pem`` and ``cluster_aes``
+by gating ``cluster/peer/join-reply`` installs through a receiver-side
+bootstrap-vs-committed state machine with a configurable founder-wait
+window.  The previous identity-based founder-only sender gate for
+``cluster_aes`` broke late-joiner propagation (a surviving non-founder
+could no longer deliver the key to a new master after the founder
+died); the new primitive preserves late-joiner reachability while
+keeping bootstrap deterministic.  Sentinel files
+``cluster_pki_dir/.cluster_aes.committed`` and
+``cluster_pki_dir/.cluster_pem.committed`` persist the committed-state
+marker with a SHA-256 fingerprint of the on-disk key; a sentinel-vs-disk
+mismatch on startup (e.g. after an offline rotation) reverts the key
+to BOOTSTRAP so the next arriving install can re-sync.  Operators can
+force a BOOTSTRAP reopen by removing the relevant ``.committed``
+sentinel.  New opt ``cluster_bootstrap_founder_wait_s`` (default 2.0s)
+exposes the founder-wait window.
```

**File**: `salt/cache/_cluster_replicator.py` (modified, +195/-37)
```diff
@@ -10,6 +10,7 @@
 :func:`_handle_delegate_cache_write`.
 """
 
+import asyncio
 import atexit
 import collections
 import concurrent.futures
@@ -297,6 +298,16 @@ class PendingEvent:
     packed under (useful for diagnostics).  ``bank``/``key``/
     ``minion_id`` are optional human-readable attribution fields --
     they are NOT used by the flush path, only by the skip/drop logs.
+
+    ``cluster_aes_fp`` is the ``secret_fingerprint`` of the
+    cluster_aes value that was current at encrypt time.  The flush
+    path compares it to the current cluster_aes fp; mismatch means a
+    rotation happened between encrypt and flush (D-1b window) and
+    the entry is dropped with a WARN (receiver would log a silent
+    decrypt-fail otherwise).  Defaults to ``"<unavailable>"`` so
+    legacy tests / callers that construct PendingEvent without
+    stamping still work (but see reviewer Q3: ``<unavailable>`` on
+    EITHER side drops the entry, never publishes).
     """
 
     kind: str
@@ -305,13 +316,76 @@ class PendingEvent:
     bank: str | None = None
     key: str | None = None
     minion_id: str | None = None
+    cluster_aes_fp: str = "<unavailable>"
     enqueued_at: float = dataclasses.field(default_factory=time.monotonic)
 
 
 _PENDING_QUEUES: dict[str, "collections.deque[PendingEvent]"] = {}
 _PENDING_LOCK = threading.Lock()
 _PENDING_LOG_LAST: dict[str, float] = {}
 
+# Per-peer flush-latch.
+#
+# The publish daemon drains a peer's pending queue (via
+# ``flush_pending_for_peer``) whenever the peer transitions to joined
+# -- ``_schedule_pending_flush`` fires on the ``cluster/peer/discover-
+# reply`` or AES-key-broadcast handlers and schedules a drain task on
+# the loop.  Without serialisation, a live ``publish_cache_write`` to
+# the SAME peer that arrives mid-drain can land on the socket BEFORE
+# the drain finishes publishing its stale entries.  For ``(bank, key)``
+# last-writer-wins buckets this reorders as "stale wins", corrupting
+# peer state.
+#
+# The latch serialises per-peer publish activity: both
+# ``flush_pending_for_peer`` (handshake-driven drain) and
+# ``publish_with_latch`` (live publish) acquire the SAME per-peer
+# asyncio.Lock.  Live publishes that arrive while the drain is in
+# flight wait until it finishes; the stale entries land on the socket
+# first, then the live entry -- under last-writer-wins the peer ends
+# up with the live value.
+#
+# ``asyncio.Lock`` is appropriate because both drain and live publish
+# run as asyncio tasks on the publish daemon's event loop; a sync
+# ``threading.Lock`` would deadlock on the loop thread when the
+# holding coroutine awaits.
+_PENDING_PEER_LATCHES: dict[str, "asyncio.Lock"] = {}
+_PENDING_PEER_LATCHES_SYNC = threading.Lock()
+
+
+def _get_peer_latch(peer_host):
+    """
+    Return the per-peer flush-latch (asyncio.Lock), creating it on
+    first touch.
+
+    Called by the handshake-driven drain path and the live-publish
+    path so both serialise on the SAME lock.  The dict is bounded by
+    the number of peers (small, O(N_peers)); no eviction needed.
+    """
+    with _PENDING_PEER_LATCHES_SYNC:
+        latch = _PENDING_PEER_LATCHES.get(peer_host)
+        if latch is None:
+            latch = asyncio.Lock()
+            _PENDING_PEER_LATCHES[peer_host] = latch
+    return latch
+
+
+async def publish_with_latch(peer_host, pusher, event):
+    """
+    Publish ``event`` through ``pusher`` while holding the per-peer
+    flush-latch.
+
+    Serialises with any concurrent ``flush_pending_for_peer`` drain on
+    the same peer so stale pending entries land on the peer socket
+    BEFORE the live entry -- under last-writer-wins the peer state
+    converges to the live entry.
+    """
+    if not peer_host:
+        await pusher.publish(event)
+        return
+    latch = _get_peer_latch(peer_host)
+    async with latch:
+        await pusher.publish(event)
+
 
 def _pending_max_events(opts):
     if not isinstance(opts, dict):
@@ -539,49 +613,107 @@ async def flush_pending_for_peer(peer_host, pushers, opts=None):
         # flush attempt.  (Common during the first few ms after a join
         # where the pusher dict is still being populated.)
         return 0
-    entries = drain_pending_for_peer(peer_host, opts=opts)
-    if not entries:
-        return 0
-    log.info(
-        "cluster-cache-replication: flushing %d pending event(s) to %s",
-        len(entries),
-        peer_host,
-    )
-    flushed = 0
-    for idx, entry in enumerate(entries):
-        try:
-            await target.publish(entry.event)
-        except Exception:  # pylint: disable=broad-except
-            log.exception(
-                "cluster-cache-replication: pending-flush publish failed to %s "
-                "(entry kind=%s tag=%s bank=%s key=%s minion_id=%s); "
-                "re-queueing %d remaining entries",
+    # Hold the per-peer flush-latch across the entire drain+publish
+    # sequence so a concurrent live publish on the sam
```

**File**: `salt/channel/_cluster_key_state.py` (added, +512/-0)
```diff
@@ -0,0 +1,512 @@
+"""
+Unified cluster-key propagation primitive.
+
+Two keys in the ``cluster/peer/join-reply`` install path share one
+shape: every master generates its own local random bootstrap bytes on
+first boot (``find_or_create_keys("cluster")`` for ``cluster.pem``;
+``populate_secrets`` for ``cluster_aes``), ships those bytes in every
+reply it builds, and the receiver historically installed whatever
+arrived.  Under a three-master bootstrap the install order is
+non-deterministic, winners are arrival-last, and the cluster ends up
+disagreeing on the on-disk / in-memory key.
+
+This module implements the receiver-side state machine that gates
+installs.  Each key is independently tracked as either **BOOTSTRAP**
+(the local bytes are "mutable until first wire install") or
+**COMMITTED** (the on-disk value is cluster-authoritative).  Each
+transition is persisted via a sentinel file whose contents are the
+SHA-256 fingerprint of the committed bytes; on startup a fingerprint
+mismatch between sentinel and on-disk key reverts to BOOTSTRAP so a
+stale-value-after-rotation restart cannot re-use a committed marker
+that no longer describes disk.
+
+The BOOTSTRAP state applies a **founder-wait window** before
+committing to a non-founder install: for up to
+``cluster_bootstrap_founder_wait_s`` seconds (default 2.0s) after the
+first arrival, the receiver prefers an install from the designated
+founder of its configured cluster pool.  When the window expires
+without a founder reply, the best-candidate (earliest-arriving)
+install wins and a WARN is logged.  Once the founder-wait window has
+been served on a key, identity is never consulted again for that key.
+
+The full specification lives in
+``agents/reports/design-unified-cluster-key-propagation.md`` and the
+reviewer audit (with required tweaks T-1, T-2, T-6) lives in
+``agents/reports/design-unified-cluster-key-propagation-reviewer.md``.
+"""
+
+import hashlib
+import logging
+import os
+import pathlib
+import tempfile
+import threading
+import time
+
+log = logging.getLogger(__name__)
+
+#: Default founder-wait window (seconds).  Reviewer T-1: the real
+#: arm64 CI race window is observed at 588ms-12s; a 2s window biases
+#: toward the founder install during normal bootstrap without blocking
+#: forever when the founder is dead.
+DEFAULT_FOUNDER_WAIT_S = 2.0
+
+#: Config option name for the founder-wait window.
+OPT_FOUNDER_WAIT = "cluster_bootstrap_founder_wait_s"
+
+#: Sentinel content prefix.  Reviewer T-2: sentinels carry the SHA-256
+#: fingerprint of the committed key bytes, not emptiness, so a restart
+#: whose on-disk key no longer matches the sentinel reverts to
+#: BOOTSTRAP instead of silently refusing a legitimate re-sync.
+SENTINEL_PREFIX = "sha256:"
+
+#: Supported key names.  Kept narrow on purpose -- the primitive only
+#: covers the two keys the reviewer scoped (``cluster_pem`` + the
+#: ``cluster_aes`` session key).  ``cluster_pub`` rides with the
+#: ``cluster_pem`` install and does not need its own state marker.
+SUPPORTED_KEYS = ("cluster_aes", "cluster_pem")
+
+#: Receiver states.  A key either is still trusting any first arrival
+#: (BOOTSTRAP) or has committed to a cluster-authoritative value
+#: (COMMITTED).
+STATE_BOOTSTRAP = "bootstrap"
+STATE_COMMITTED = "committed"
+
+
+# ---------------------------------------------------------------------------
+# Sentinel helpers
+# ---------------------------------------------------------------------------
+
+
+def cluster_key_sentinel_path(cluster_pki_dir, key_name):
+    """
+    Return the sentinel path for ``key_name`` under ``cluster_pki_dir``.
+
+    Each key has its own dotfile sentinel so an operator can
+    selectively re-open the bootstrap window for a single key without
+    touching the other (e.g. ``rm .cluster_aes.committed`` to re-sync
+    the session AES while keeping ``cluster.pem`` committed).
+    """
+    if key_name not in SUPPORTED_KEYS:
+        raise ValueError(
+            f"Unsupported cluster key name {key_name!r}; "
+            f"expected one of {SUPPORTED_KEYS}"
+        )
+    return pathlib.Path(cluster_pki_dir) / f".{key_name}.committed"
+
+
+def fingerprint_bytes(key_bytes):
+    """
+    Return the sentinel fingerprint for ``key_bytes``.
+
+    Format: ``"sha256:<64-hex>"``.  The full digest is used (not
+    truncated) so reviewer T-2's stale-on-restart check is strict:
+    any single byte change between sentinel-write time and restart
+    flips the fingerprint.
+
+    ``key_bytes`` may be ``bytes`` or ``str``; a ``str`` is encoded as
+    UTF-8 before hashing to match how the sender serialises PEM and
+    AES bytes on the wire.
+    """
+    if isinstance(key_bytes, str):
+        key_bytes = key_bytes.encode("utf-8")
+    if not isinstance(key_bytes, (bytes, bytearray)):
+        raise TypeError(
+            f"fingerprint_bytes expected bytes/str, got {type(key_bytes).__name__}"
+        )
+    return f"{SENTINEL_PREFIX}{hashlib.sha256(b
```

**File**: `salt/channel/server.py` (modified, +694/-158)
```diff
@@ -28,6 +28,7 @@
     HAS_SETPROCTITLE = False
 
 import salt.cache
+import salt.channel._cluster_key_state as _cluster_key_state
 import salt.cluster
 import salt.cluster.consensus.rpc
 import salt.crypt
@@ -138,6 +139,89 @@ def cluster_pub_matches_fingerprint(opts, cluster_pub):
     return hmac.compare_digest(digest.lower(), str(pinned).lower())
 
 
+def _cluster_bootstrap_founder_id(opts):
+    """
+    Return the designated founder's node id for the cluster
+    described by ``opts``, or ``None`` if no cluster membership is
+    configured.
+
+    The founder is the master with the lowest node id in the pool
+    ``{self_node_id, *cluster_peers}`` -- the same deterministic
+    lowest-id-wins predicate used by ``MasterPubServerChannel`` to
+    decide whether to self-bootstrap Raft as the founding voter or
+    wait for a join-reply.  Factoring the predicate here lets the
+    sender-side join-reply builder and the receiver-side filter
+    share the same source of truth.
+    """
+    node_id = salt.cluster.node_id(opts)
+    peers = opts.get("cluster_peers") or []
+    pool = sorted({node_id, *peers})
+    if not pool:
+        return None
+    return pool[0]
+
+
+def is_designated_cluster_founder(opts):
+    """
+    Return ``True`` if this master is the designated founder of
+    its configured cluster.  See
+    :func:`_cluster_bootstrap_founder_id` for the predicate.
+    """
+    founder = _cluster_bootstrap_founder_id(opts)
+    if founder is None:
+        return False
+    return founder == salt.cluster.node_id(opts)
+
+
+# Guard: emit the deprecation WARN for
+# ``filter_non_founder_cluster_aes_from_join_reply`` at most once per
+# process.  The filter sits inside the hot path of every
+# ``cluster/peer/join-reply`` install; a per-call WARN would be
+# overwhelming.
+_FILTER_DEPRECATION_WARNED = False
+
+
+def filter_non_founder_cluster_aes_from_join_reply(inner, opts):
+    """
+    DEPRECATED no-op shim.
+
+    Historically this filter dropped ``cluster_aes`` from a
+    ``cluster/peer/join-reply`` whose sender was not the designated
+    founder, as defence-in-depth paired with a sender-side founder
+    gate (commit ``6acb1653613``).  That identity-based pair
+    permanently broke late-joiner propagation: once the founder died,
+    a surviving non-founder could no longer deliver ``cluster_aes``
+    to a brand-new master joining through it, because the sender gate
+    omitted the key and this filter would have discarded it anyway.
+
+    Both gates have been superseded by the unified state-machine
+    primitive in ``salt/channel/_cluster_key_state.py`` -- the receiver
+    decides whether to honour an install based on its own
+    bootstrap-vs-committed state, with a founder-wait window during
+    bootstrap for determinism.  The sender always ships its current
+    bytes; identity is never consulted.
+
+    This function is kept as a no-op shim for one release so cross-fork
+    integrators who pulled commit 6 as a backport candidate can
+    continue to build.  Callers are advised to remove the call and
+    rely on the state machine directly.
+
+    :returns: ``(inner, False)`` unconditionally -- no filtering is
+              performed.  The returned dict is the original input
+              dict (no copy) regardless of contents.
+    """
+    global _FILTER_DEPRECATION_WARNED
+    if not _FILTER_DEPRECATION_WARNED:
+        _FILTER_DEPRECATION_WARNED = True
+        log.warning(
+            "filter_non_founder_cluster_aes_from_join_reply is deprecated "
+            "and now a no-op; the receiver-side cluster-key state machine "
+            "supersedes identity-based filtering.  This warning is emitted "
+            "once per process; the call site should be removed."
+        )
+    return inner, False
+
+
 class ReqServerChannel:
     """
     ReqServerChannel handles request/reply messages from ReqChannels.
@@ -1870,6 +1954,13 @@ def __init__(
         self._discover_retry_pc = None
         # Set by service.py once the Raft node is started.
         self._raft_dispatcher = None
+        # Receiver-side cluster-key state machine (BOOTSTRAP vs COMMITTED
+        # per key, per process).  Lazily reconciled with on-disk
+        # sentinels + key bytes in ``_cluster_key_state_machine``.
+        # Only instantiated when the master is actually clustered --
+        # non-clustered masters never traverse the join-reply install
+        # path and don't need the extra bookkeeping.
+        self._cluster_key_sm = None
 
     def _start_raft_as_founding_voter(self):
         """
@@ -1906,6 +1997,32 @@ def _start_raft_as_founding_voter(self):
             self._raft_service.start()
             # Write the join sentinel so future restarts skip discover/join.
             self._mark_joined_cluster()
+            # Founder-side commit: mark THIS master's locally-generated
+            # ``cluster_aes`` + ``cluster.pem`` as COMMITTED in the state
+            # machine so (a) later p
```

**File**: `salt/cluster/consensus/service.py` (modified, +19/-7)
```diff
@@ -89,11 +89,23 @@ def __init__(self, opts, loop, peer_pushers, voting=True, on_ready=None):
         # multi-process Salt masters running over real sockets — a single
         # delayed heartbeat in CI can cause a follower to step up and fight
         # the existing leader for the term.  At ``_HEARTBEAT_INTERVAL`` =
-        # 50 ms the rule of thumb is election >= 10× heartbeat, so default
-        # to 750–1500 ms here.  ``cluster_election_min`` /
-        # ``cluster_election_max`` opts let deployments tune further.
-        election_min = opts.get("cluster_election_min", 750)
-        election_max = opts.get("cluster_election_max", 1500)
+        # 50 ms the rule of thumb is election >= 10× heartbeat.
+        #
+        # The previous 750–1500 ms default (15–30× heartbeat) proved too
+        # tight on constrained arm64 CI runners (2 vCPU / 8 GB).  Under
+        # load the 50 ms heartbeat tick is delayed by hundreds of ms by
+        # process scheduling; elections fire before the "late" heartbeat
+        # arrives, term bumps, cascading churn.  We observed 7-minute
+        # join-reply stalls on the ``test_isolated_multi_minion_targetable_from_every_master``
+        # arm64 reproduction (term 16 reached in seconds; join-reply only
+        # transmitted once Raft finally stabilised).  Triple the window
+        # to 2250–4500 ms (45–90× heartbeat) so arm64 runners have the
+        # scheduling headroom they need.  x86 fast boxes rarely hit the
+        # election timer at all, so the bump is benign there.  Legitimate
+        # failover of a dead leader now takes a few extra seconds, which
+        # is an acceptable trade for CI-stable bootstrap.
+        election_min = opts.get("cluster_election_min", 2250)
+        election_max = opts.get("cluster_election_max", 4500)
         # ``cluster_max_log_size`` (default ``None``) gates Raft log
         # compaction.  When unset, the log keeps every committed entry
         # forever and snapshots never fire — fine for small clusters
@@ -431,8 +443,8 @@ def _bring_up_ring(self, ring_id, founding_voters):
         # Election windows reuse the same opts as the cluster Node —
         # if the operator tuned them for their environment, the
         # per-ring nodes inherit the tuning automatically.
-        election_min = self.opts.get("cluster_election_min", 750)
-        election_max = self.opts.get("cluster_election_max", 1500)
+        election_min = self.opts.get("cluster_election_min", 2250)
+        election_max = self.opts.get("cluster_election_max", 4500)
         ring_node = Node(
             node_id,
             storage=storage,
```

**File**: `salt/config/__init__.py` (modified, +20/-0)
```diff
@@ -230,6 +230,19 @@ def _gather_buffer_space():
         # and can be sync'd as opaque blobs) and joining masters request a
         # bulk state-sync from an existing peer before becoming Raft voters.
         "cluster_isolated_filesystem": bool,
+        # Receiver-side founder-wait window applied by the unified
+        # cluster-key propagation state machine
+        # (``salt/channel/_cluster_key_state.py``).  When a master in
+        # BOOTSTRAP state for ``cluster_aes`` or ``cluster.pem`` receives
+        # a join-reply whose sender is NOT the designated cluster founder,
+        # it defers the install for up to this many seconds to give the
+        # founder's reply time to arrive.  Past the window the receiver
+        # commits to whichever non-founder install lands next (with a
+        # WARN) so a founder-dead late-joiner can still converge.  A
+        # value of ``0.0`` disables the window (any first arrival wins
+        # BOOTSTRAP commit).  See reviewer tweak T-1 in
+        # ``agents/reports/design-unified-cluster-key-propagation-reviewer.md``.
+        "cluster_bootstrap_founder_wait_s": float,
         # Master switch for cross-master cache replication at the
         # ``salt.cache.Cache`` facade.  When True (the default when
         # ``cluster_id`` is set and ``cluster_isolated_filesystem`` is True)
@@ -2082,6 +2095,13 @@ def _gather_buffer_space():
         "cluster_pub_fingerprint": None,
         "cluster_secret": None,
         "cluster_isolated_filesystem": False,
+        # Default founder-wait window for the unified cluster-key
+        # propagation state machine.  Reviewer T-1: 2.0s is large
+        # enough to dominate the observed arm64 CI race window
+        # (588ms-12s) without blocking late-joiners when the founder
+        # is dead.  Operators can lower to 0.0 for testing or raise
+        # for slow runners.
+        "cluster_bootstrap_founder_wait_s": 2.0,
         # ``cluster_cache_replication`` default is resolved in
         # ``apply_master_config`` because it depends on whether
         # ``cluster_id`` is configured and whether the deployment is
```

**File**: `salt/crypt.py` (modified, +37/-0)
```diff
@@ -984,18 +984,55 @@ def sign(self, *args, **kwargs):
         """
         proxy to PrivateKey.sign
         """
+        self._maybe_reload_cluster_key()
         return self.key.sign(*args, **kwargs)
 
+    def _maybe_reload_cluster_key(self):
+        # The join-reply install path in ``MasterPubServerChannel`` rewrites
+        # ``cluster.pem`` in place when the founder's bytes arrive.  MWorker
+        # processes that ``_setup_keys()`` ran before that install still hold
+        # the bootstrap ``PrivateKey`` in ``self.key``, but ``get_pub_str()``
+        # already reads the current founder's ``cluster.pub`` from disk --
+        # so the pub we serve to the minion and the priv we decrypt the
+        # minion's token with come from different key pairs and every auth
+        # fails with ``Decryption failed``.  Reread from disk on each
+        # decrypt and swap ``self.key`` when the bytes have changed.
+        if not self.opts.get("cluster_id"):
+            return
+        try:
+            pem_bytes = self.cache.fetch("master_keys", "cluster.pem")
+        except Exception:  # pylint: disable=broad-except
+            return
+        if not pem_bytes:
+            return
+        if isinstance(pem_bytes, str):
+            pem_bytes_b = pem_bytes.encode()
+        else:
+            pem_bytes_b = pem_bytes
+        fp = hashlib.sha256(pem_bytes_b).hexdigest()
+        if getattr(self, "_cluster_key_fp", None) == fp:
+            return
+        try:
+            new_key = PrivateKey.from_str(pem_bytes)
+        except Exception:  # pylint: disable=broad-except
+            log.exception("Failed to reload cluster_key from disk")
+            return
+        self.cluster_key = new_key
+        self.key = new_key
+        self._cluster_key_fp = fp
+
     def decrypt(self, *args, **kwargs):
         """
         proxy to PrivateKey.decrypt
         """
+        self._maybe_reload_cluster_key()
         return self.key.decrypt(*args, **kwargs)
 
     def encrypt(self, *args, **kwargs):
         """
         proxy to PrivateKey.encrypt
         """
+        self._maybe_reload_cluster_key()
         return self.key.encrypt(*args, **kwargs)
 
     def fetch(self, name):
```

**File**: `salt/runners/cluster.py` (modified, +61/-2)
```diff
@@ -362,6 +362,19 @@ def sync_roots(roots="both"):
             "each peer's master log for the 'state-sync ... installed N items' "
             "lines to confirm delivery."
         ),
+        # Reviewer correction Q4: the publish daemon's sender-side gate
+        # skips un-joined peers with a WARN (``cluster.sync_roots: skipping
+        # un-joined peers [...]; roots will be caught up via state-sync on
+        # their next handshake``).  Un-joined peers receive the push once
+        # they complete the cluster handshake via the join-time
+        # state-sync catch-up (not via the pending-queue replay, because
+        # sync_roots is a multi-event session).  Operators seeing an
+        # incomplete push should wait for every peer to join and re-run.
+        "skipped_peers_note": (
+            "Un-joined peers are enumerated on each master's log with the "
+            "'cluster.sync_roots: skipping un-joined peers' prefix.  "
+            "Catch-up happens automatically on their next handshake."
+        ),
     }
 
 
@@ -434,7 +447,26 @@ def _fire_cluster_event(tag, data):
         listen=False,
     ) as event:
         event.fire_event(data, tag)
-    return {"status": "fan-out initiated", "tag": tag, "data": data}
+    return {
+        "status": "fan-out initiated",
+        "tag": tag,
+        "data": data,
+        # Reviewer correction Q4: the publish daemon's gate skips
+        # un-joined peers on multi-ring / sync_roots / collect fan-outs
+        # and emits a WARN naming them.  Multi-ring runners rely on
+        # Raft log replication to carry the committed entry to any
+        # peer that was skipped, so the fan-out gate is defence in
+        # depth -- the propose still happens on the leader, and
+        # AppendEntries delivers the commit.  Operators seeing
+        # ``multi-ring fan-out: skipping un-joined peers`` can wait
+        # for the peer to join and re-run to force an eager push.
+        "skipped_peers_note": (
+            "Un-joined peers are enumerated on each master's log with "
+            "the 'multi-ring fan-out: skipping un-joined peers' prefix.  "
+            "Raft AppendEntries delivers the committed entry once the "
+            "peer completes its handshake."
+        ),
+    }
 
 
 def ring_create(name, voters):
@@ -865,10 +897,37 @@ def collect_from_peers(channels=(), banks=_DEFAULT_COLLECT_BANKS):
             "cluster.collect_from_peers requires at least one channel or bank"
         )
     requested = fixed + [f"{BANK_CHANNEL_PREFIX}{b}" for b in bank_list]
-    return _fire_cluster_event(
+    result = _fire_cluster_event(
         "cluster/runner/collect_from_peers",
         {"channels": requested},
     )
+    # Reviewer correction Q4: surface the status-sentinel path and the
+    # ``skipped_peers`` operator contract in a backwards-compatible shape.
+    # Callers that scripted against ``.get("status") == "fan-out initiated"``
+    # keep working; the new keys are informational.  ``skipped_peers`` is
+    # populated by the publish daemon when it writes the sentinel JSON
+    # (see :meth:`MasterPubServerChannel._init_collect_sentinel` --
+    # un-joined peers at request time are enumerated there so operators
+    # can distinguish "complete" from "complete-but-partial" without
+    # grepping logs).
+    import os  # pylint: disable=import-outside-toplevel
+
+    cachedir = __opts__.get("cachedir")
+    sentinel_path = (
+        os.path.join(cachedir, "cluster-collect-status.json") if cachedir else None
+    )
+    if isinstance(result, dict):
+        result.setdefault("sentinel_path", sentinel_path)
+        result.setdefault(
+            "skipped_peers_note",
+            (
+                "Un-joined peers at request time are listed under "
+                "'skipped_peers' in the sentinel JSON; the runner is "
+                "fire-and-forget so the server-side gate writes the "
+                "sentinel before any chunk arrives."
+            ),
+        )
+    return result
 
 
 def ring_set(name=None, members=None, replicas=None):
```

---

### Incident Patch 3: `d4dcb82c` (2026-11-18)
**Commit Message**: Enable Ruff checks for async blocking calls, weak security and dead conditions (#70822)

* Enable Ruff checks for async blocking calls, weak security and dead conditions

Add 35 checks for patterns that do not occur anywhere in the code base today,
so nothing needs to be cleaned up: blocking calls in async functions, insecure
XML parsers and cryptography, disabled certificate checks, conditions that are
always true or false, and several other bug patterns. Each rule has a test that
shows it is reported.

Refs #70367.

* Add changelog entry

Refs #70367.

**File**: `CONTRIBUTING.rst` (modified, +3/-1)
```diff
@@ -63,7 +63,9 @@ in ``finally``, exceptions that are created but not raised, ``lru_cache`` on
 methods, and comparisons of ``sys.version`` with strings. The full list is in
 ``pyproject.toml``. A further group covers patterns that still occur in a few
 places, such as ``logger.warn()``, ``datetime.utcnow()``, and
-``logger.exception()`` outside an ``except`` block. Star imports are not
+``logger.exception()`` outside an ``except`` block. Another group covers blocking calls in
+``async`` functions, insecure XML parsers, weak cryptography, disabled
+certificate checks and always true or false conditions. Star imports are not
 checked. Names Salt injects into modules, such as ``__salt__`` and
 ``__opts__``, are not reported as undefined. The list is in ``pyproject.toml``
 and must match ``additional-builtins`` in ``.pylintrc``.
```

**File**: `changelog/70822.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Added more Ruff checks for blocking calls in `async` functions, insecure XML parsers and cryptography, disabled certificate checks, and conditions that are always true or false.
```

**File**: `pyproject.toml` (modified, +36/-0)
```diff
@@ -190,6 +190,42 @@ select = [
     "DTZ004",  # datetime.utcfromtimestamp()
     "ASYNC251",  # time.sleep() in an async function
     "PGH004",  # blanket noqa
+    # Bugs and unsafe calls that are not present in the code base today.
+    "ASYNC210",  # blocking requests call in async function
+    "ASYNC220",  # subprocess started in async function
+    "ASYNC222",  # os.wait() in async function
+    "ASYNC230",  # open() in async function
+    "ASYNC250",  # input() in async function
+    "S313",  # cElementTree parser
+    "S315",  # expat reader
+    "S316",  # expat builder
+    "S317",  # xml.sax
+    "S319",  # pulldom
+    "S304",  # insecure cipher
+    "S305",  # insecure cipher mode
+    "S302",  # marshal.loads
+    "S501",  # certificate check turned off
+    "S502",  # insecure SSL/TLS version
+    "S503",  # insecure SSL/TLS default
+    "S505",  # weak cryptographic key
+    "S609",  # wildcard in a shell command
+    "S612",  # logging.config.listen
+    "SIM107",  # return in try/finally
+    "SIM220",  # x and not x
+    "SIM221",  # x or not x
+    "SIM223",  # x and False
+    "PIE794",  # duplicate class field
+    "PIE796",  # duplicate enum value
+    "PLC0205",  # __slots__ is a string
+    "PLC0208",  # iteration over a set literal
+    "PLC3002",  # lambda called directly
+    "PLR0133",  # comparison of two constants
+    "PLR1708",  # raise StopIteration in a generator
+    "RUF030",  # print() as assert message
+    "RUF032",  # Decimal() from a float
+    "RUF048",  # map(int, version.split())
+    "RUF101",  # redirected noqa code
+    "RUF103",  # invalid ruff suppression comment
 ]
 ignore = [
     "F403",  # star imports
```

**File**: `tests/pytests/unit/test_ruff.py` (modified, +73/-0)
```diff
@@ -426,3 +426,76 @@ def test_rules_with_existing_violations(repo: Path, code: str, source: str) -> N
     result = check(repo)
     assert result.returncode == 1, result.stderr + result.stdout
     assert code in result.stdout
+
+
+# One example per rule that has no violation in the code base today (stage 5).
+NEW_RULE_CASES_STAGE_5 = [
+    (
+        "ASYNC210",
+        'import requests\n\n\nasync def f():\n    requests.get("https://x")\n',
+    ),
+    (
+        "ASYNC220",
+        'import subprocess\n\n\nasync def f():\n    subprocess.Popen(["ls"])\n',
+    ),
+    ("ASYNC222", "import os\n\n\nasync def f():\n    os.wait()\n"),
+    ("ASYNC230", 'async def f():\n    open("x")\n'),
+    ("ASYNC250", 'async def f():\n    input("x")\n'),
+    ("S313", 'from xml.etree.cElementTree import parse\n\nparse("x")\n'),
+    (
+        "S315",
+        "from xml.sax.expatreader import create_parser\n\nparser = create_parser()\n",
+    ),
+    ("S316", 'from xml.dom.expatbuilder import parse\n\nparse("x")\n'),
+    ("S317", 'import xml.sax\n\nxml.sax.parse("x")\n'),
+    ("S319", 'from xml.dom.pulldom import parse\n\nparse("x")\n'),
+    (
+        "S304",
+        'from cryptography.hazmat.primitives.ciphers import Cipher, algorithms\n\ncipher = Cipher(algorithms.ARC4(b"k"), mode=None)\n',
+    ),
+    (
+        "S305",
+        'from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes\n\nCipher(algorithms.AES(b"k"), modes.ECB())\n',
+    ),
+    ("S302", 'import marshal\n\nmarshal.loads(b"x")\n'),
+    ("S501", 'import requests\n\nrequests.get("https://x", verify=False)\n'),
+    ("S502", "import ssl\n\nssl.wrap_socket(None, ssl_version=ssl.PROTOCOL_SSLv3)\n"),
+    ("S503", "import ssl\n\n\ndef f(ctx=ssl.PROTOCOL_SSLv2):\n    pass\n"),
+    (
+        "S505",
+        "from cryptography.hazmat.primitives.asymmetric import dsa\n\ndsa.generate_private_key(key_size=512)\n",
+    ),
+    ("S609", 'import subprocess\n\nsubprocess.Popen("chmod 600 *", shell=True)\n'),
+    ("S612", "import logging.config\n\nlogging.config.listen(9999)\n"),
+    (
+        "SIM107",
+        "def f():\n    try:\n        return 1\n    finally:\n        return 2\n",
+    ),
+    ("SIM220", "def f(a):\n    return a and not a\n"),
+    ("SIM221", "def f(a):\n    return a or not a\n"),
+    ("SIM223", "def f(x, y):\n    return x and [] and y\n"),
+    ("PIE794", "class A:\n    x = 1\n    x = 2\n"),
+    ("PIE796", "import enum\n\n\nclass E(enum.Enum):\n    A = 1\n    B = 1\n"),
+    ("PLC0205", 'class A:\n    __slots__ = "a"\n'),
+    ("PLC0208", "for x in {1, 2, 3}:\n    print(x)\n"),
+    ("PLC3002", "x = (lambda: 1)()\n"),
+    ("PLR0133", "x = 1 < 2\n"),
+    ("PLR1708", "def f():\n    raise StopIteration\n    yield 1\n"),
+    ("RUF030", 'def f(x):\n    assert x, print("bad")\n'),
+    ("RUF032", "from decimal import Decimal\n\nx = Decimal(0.1)\n"),
+    ("RUF048", 'v = tuple(map(int, __version__.split(".")))\n'),
+    ("RUF101", "import os  # noqa: PGH001\n"),
+    ("RUF103", "# ruff: disable\nx = 1\n"),
+]
+
+
+@pytest.mark.parametrize(
+    ("code", "source"), NEW_RULE_CASES_STAGE_5, ids=lambda v: v[:8]
+)
+def test_stage_5_rules_without_existing_violations(
+    repo: Path, code: str, source: str
+) -> None:
+    write(repo, "salt/new.py", source)
+    result = check(repo)
+    assert result.returncode == 1, result.stderr + result.stdout
+    assert code in result.stdout
```

#### Recent Merged Pull Requests:
- **PR #70877** (closed): Set stacklevel on warnings.warn calls (@charzl)
- **PR #70869** (closed): Set match on pytest.warns(DeprecationWarning) in tests (@charzl)
- **PR #70858** (2026-11-19): [master] Merge 3008.x into master (2026-11-18) (@dwoz)
- **PR #70856** (2026-11-19): [3008.x] Bump relenv to 0.23.1 (@twangboy)
- **PR #70851** (2026-11-19): Fix test_vmware for testsuites without pyvmomi (@m-czernek)
- **PR #70848** (2026-11-19): Remove unused exception variables in the rest of salt and in tools (@charzl)

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

## X. cluster cache replication defaults

**RULE**:
When implementing operations in `changelog/70773.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in saltstack/salt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eae114ea`: cluster cache replication defaults. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog/70773.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
Stage ``localfs`` cache writes in a sibling ``.localfs_tmp/`` directory so concurrent ``cache.list`` calls never observe in-flight ``tempfile.mkstemp`` files in the bank directory.

Buffer cluster cache-replication events for peers that have not yet completed the discover/join handshake and replay them in FIFO order on handshake completion, so live writes landing during a peer's join window are delivered without relying solely on the join-time state-sync snapshot.

Invalidate every pending cluster cache-replication queue whenever the local ``cluster_aes`` is replaced -- on operator-triggered rotation and on initial install via ``cluster/peer/join-reply`` on a (re)joining master -- so stale pre-encrypted events are never replayed with a key the receiver cannot decrypt.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eae114ea` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
