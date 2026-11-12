> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source**: github ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Source Version**: `fac9abd1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T16:55:57.140Z  
> **Learning ID**: `learn-github-goharbor-harbor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): goharbor/harbor

> **Canonical Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T16:55:57.133Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goharbor/harbor`
- **Description**: An open source trusted cloud native registry project that stores, signs, and scans content.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29719 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `make/photon/prepare/utils/cert.py`
```
# Get or generate private key
import os, subprocess, shutil
from pathlib import Path
from subprocess import DEVNULL
import logging

from g import DEFAULT_GID, DEFAULT_UID, shared_cert_dir, storage_ca_bundle_filename, internal_tls_dir, internal_ca_filename, redis_tls_ca_filename
from .misc import (
    mark_file,
    generate_random_string,
    check_permission,
    stat_decorator,
    get_realpath)

SSL_CERT_PATH = os.path.join("/etc/cert", "server.crt")
SSL_CERT_KEY_PATH = os.path.join("/etc/cert", "server.key")

def _get_secret(folder, filename, length=16):
    key_file = os.path.join(folder, filename)
    if os.path.isfile(key_file):
        with open(key_file, 'r') as f:
            key = f.read()
            print("loaded secret from file: %s" % key_file)
        mark_file(key_file)
        return key
    if not os.path.isdir(folder):
        os.makedirs(folder)
    key = generate_random_string(length)
    with open(key_file, 'w') as f:
        f.write(key)
        print("Generated and saved secret to file: %s" % key_file)
    mark_file(key_file)
    return key


def get_secret_key(path):
    secret_key = _get_secret(path, "secretkey")
    if len(secret_key) != 16:
        raise Exception("secret key's length has to be 16 chars, current length: %d" % len(secret_key))
    return secret_key


def get_alias(path):
    alias = _get_secret(path, "defaultalias", length=8)
    return alias

@stat_decorator
def create_root_cert(subj, key_path="./k.key", cert_path="./cert.crt"):
   rc = subprocess.call(["/usr/bin/openssl", "genrsa", "-traditional", "-out", key_path, "4096"], stdout=DEVNULL, stderr=subprocess.STDOUT)
   if rc != 0:
        return rc
   return subprocess.call(["/usr/bin/openssl", "req", "-new", "-x509", "-key", key_path,\
        "-out", cert_path, "-days", "3650", "-subj", subj], stdout=DEVNULL, stderr=subprocess.STDOUT)

def create_ext_file(cn, ext_filename):
    with open(ext_filename, 'w') as f:
        f.write("subjectAltName = DNS.1:{}".format(cn))

def san_existed(cert_path):
    try:
        return "Subject Alternative Name:" in str(subprocess.check_output(
            ["/usr/bin/openssl", "x509", "-in", cert_path, "-text"]))
    except subprocess.CalledProcessError:
        pass
    return False

@stat_decorator
def create_cert(subj, ca_key, ca_cert, key_path="./k.key", cert_path="./cert.crt", extfile='extfile.cnf'):
    cert_dir = os.path.dirname(cert_path)
    csr_path = os.path.join(cert_dir, "tmp.csr")
    rc = subprocess.call(["/usr/bin/openssl", "req", "-newkey", "rsa:4096", "-nodes","-sha256","-keyout", key_path,\
        "-out", csr_path, "-subj", subj], stdout=DEVNULL, stderr=subprocess.STDOUT)
    if rc != 0:
        return rc
    return subprocess.call(["/usr/bin/openssl", "x509", "-req", "-days", "3650", "-in", csr_path, "-CA", \
        ca_cert, "-CAkey", ca_key, "-CAcreateserial", "-extfile", extfile ,"-out", cert_path],
        stdout=DEVNULL, stderr=subprocess.STDOUT)


def openssl_installed():
    shell_stat = subprocess.check_call(["/usr/bin/which", "openssl"], stdout=DEVNULL, stderr=subprocess.STDOUT)
    if shell_stat != 0:
        print("Cannot find openssl installed in this computer\nUse default SSL certificate file")
        return False
    return True


def prepare_registry_ca(
    private_key_pem_path: Path,
    root_crt_path: Path,
    old_private_key_pem_path: Path,
    old_crt_path: Path):
    if not ( private_key_pem_path.exists() and root_crt_path.exists() ):
        # From version 1.8 the cert storage path is changed
        # if old key paris not exist create new ones
        # if old key pairs exist in old place copy it to new place
        if not (old_crt_path.exists() and old_private_key_pem_path.exists()):
            private_key_pem_path.parent.mkdir(parents=True, exist_ok=True)
            root_crt_path.parent.mkdir(parents=True, exist_ok=True)

            empty_subj = "/"
            create_root_cert(empty_subj, key_path=private_key_pem_path, cert_path=root_crt_path)
            mark_file(private_key_pem_path)
            mark_file(root_crt_path)
        else:
            shutil.move(old_crt_path, root_crt_path)
            shutil.move(old_private_key_pem_path, private_key_pem_path)

    if not check_permission(root_crt_path, uid=DEFAULT_UID, gid=DEFAULT_GID):
        os.chown(root_crt_path, DEFAULT_UID, DEFAULT_GID)

    if not check_permission(private_key_pem_path, uid=DEFAULT_UID, gid=DEFAULT_GID):
        os.chown(private_key_pem_path, DEFAULT_UID, DEFAULT_GID)


def prepare_trust_ca(config_dict):
    if shared_cert_dir.exists():
        shutil.rmtree(shared_cert_dir)
    shared_cert_dir.mkdir(parents=True, exist_ok=True)

    internal_ca_src = internal_tls_dir.joinpath(internal_ca_filename)
    ca_bundle_src = config_dict.get('registry_custom_ca_bundle_path')
    redis_tls_ca_src = config_dict.get('redis_custom_tls_ca_path')
    for src_path, dst_filename in (
        (internal_ca_src, internal_ca_filename),
        (ca_bundle_src, storage_ca_bundle_filename),
        (redis_tls_ca_src, redis_tls_ca_filename)):
        print('copy {} to shared trust ca dir as name {} ...'.format(src_path, dst_filename))
        logging.info('copy {} to shared trust ca dir as name {} ...'.format(src_path, dst_filename))
        # check if source file valied
        if not src_path:
            continue
        real_src_path = get_realpath(str(src_path))
        if not real_src_path.exists():
            print('ca file {} is not exist'.format(real_src_path))
            logging.info('ca file {} is not exist'.format(real_src_path))
            continue
        if not real_src_path.is_file():
            print('{} is not file'.format(real_src_path))
            logging.info('{} is not file'.format(real_src_path))
            continue

        dst_path = shared_cert_dir.joinpath(dst_filename)

        # copy src to dst
        shutil.copy2(real_src_path, dst_path)

        # change ownership and permission
        mark_file(dst_path, mode=0o644)

```

### Core Architecture Module: `make/photon/prepare/utils/configs.py`
```
from distutils.command.config import config
import logging
import os
import yaml
from urllib.parse import urlencode, quote
from g import versions_file_path, host_root_dir, DEFAULT_UID, INTERNAL_NO_PROXY_DN
from models import InternalTLS, Metric, Trace, PurgeUpload, Cache, Core
from utils.misc import generate_random_string, owner_can_read, other_can_read

# NOTE: https://golang.org/pkg/database/sql/#DB.SetMaxIdleConns
default_db_max_idle_conns = 2
# NOTE: https://golang.org/pkg/database/sql/#DB.SetMaxOpenConns
default_db_max_open_conns = 0
default_https_cert_path = '/your/certificate/path'
default_https_key_path = '/your/certificate/path'

REGISTRY_USER_NAME = 'harbor_registry_user'


WEBHOOK_EGRESS_POLICIES = ('allow_all', 'block_restricted', 'public_only')


def validate(conf: dict, **kwargs):
    # webhook egress policy validate
    if conf.get('webhook_egress_policy') and conf['webhook_egress_policy'] not in WEBHOOK_EGRESS_POLICIES:
        raise Exception("Error: webhook_egress.policy must be one of {}, got {!r}".format(
            ', '.join(WEBHOOK_EGRESS_POLICIES), conf['webhook_egress_policy']))

    # hostname validate
    if conf.get('hostname') == '127.0.0.1':
        raise Exception("127.0.0.1 can not be the hostname")
    if conf.get('hostname') == 'reg.mydomain.com':
        raise Exception("Please specify hostname")

    # protocol validate
    protocol = conf.get("protocol")
    if protocol == "https":
        if not conf.get("cert_path") or conf["cert_path"] == default_https_cert_path:
            raise Exception("Error: The protocol is https but attribute ssl_cert is not set")
        if not conf.get("cert_key_path") or conf['cert_key_path'] == default_https_key_path:
            raise Exception("Error: The protocol is https but attribute ssl_cert_key is not set")
    if protocol == "http":
        logging.warning("WARNING: HTTP protocol is insecure. Harbor will deprecate http protocol in the future. Please make sure to upgrade to https")

    # log endpoint validate
    if ('log_ep_host' in conf) and not conf['log_ep_host']:
        raise Exception('Error: must set log endpoint host to enable external host')
    if ('log_ep_port' in conf) and not conf['log_ep_port']:
        raise Exception('Error: must set log endpoint port to enable external host')
    if ('log_ep_protocol' in conf) and (conf['log_ep_protocol'] not in ['udp', 'tcp']):
        raise Exception("Protocol in external log endpoint must be one of 'udp' or 'tcp' ")

    # Storage validate
    valid_storage_drivers = ["filesystem", "azure", "gcs", "s3", "swift", "oss"]
    storage_provider_name = conf.get("storage_provider_name")
    if storage_provider_name not in valid_storage_drivers:
        raise Exception("Error: storage driver %s is not supported, only the following ones are supported: %s" % (
            storage_provider_name, ",".join(valid_storage_drivers)))

    # original is registry_storage_provider_config
    storage_provider_config = conf.get("storage_provider_config")
    if storage_provider_name != "filesystem":
        if storage_provider_config == "":
            raise Exception(
                "Error: no provider configurations are provided for provider %s" % storage_provider_name)
    # ca_bundle validate
    if conf.get('registry_custom_ca_bundle_path'):
        registry_custom_ca_bundle_path = conf.get('registry_custom_ca_bundle_path') or ''
        if registry_custom_ca_bundle_path.startswith('/data/'):
            ca_bundle_host_path = registry_custom_ca_bundle_path
        else:
            ca_bundle_host_path = os.path.join(host_root_dir, registry_custom_ca_bundle_path.lstrip('/'))
        try:
            uid = os.stat(ca_bundle_host_path).st_uid
            st_mode = os.stat(ca_bundle_host_path).st_mode
        except Exception as e:
            logging.error(e)
            raise Exception('Can not get file info')
        err_msg = 'Cert File {} should be owned by user with uid 10000 or readable by others'.format(registry_custom_ca_bundle_path)
        if uid == DEFAULT_UID and not owner_can_read(st_mode):
            raise Exception(err_msg)
        if uid != DEFAULT_UID and not other_can_read(st_mode):
            raise Exception(err_msg)

    # TODO:
    # If user enable trust cert dir, need check if the files in this dir is readable.

    if conf.get('trace'):
        conf['trace'].validate()

    if conf.get('purge_upload'):
        conf['purge_upload'].validate()

    if conf.get('cache'):
        conf['cache'].validate()

    if conf.get('core'):
        conf['core'].validate()


def parse_versions():
    if not versions_file_path.is_file():
        return {}
    with open('versions') as f:
        versions = yaml.safe_load(f)
    return versions


def parse_yaml_config(config_file_path, with_trivy):
    '''
    :param configs: config_parser object
    :returns: dict of configs
    '''

    with open(config_file_path) as f:
        configs = yaml.safe_load(f)

    config_dict = {
        'portal_url': 'http://portal:8080',
        'registry_url': 'http://registry:5000',
        'registry_controller_url': 'http://registryctl:8080',
        'core_url': 'http://core:8080',
        'core_local_url': 'http://127.0.0.1:8080',
        'token_service_url': 'http://core:8080/service/token',
        'jobservice_url': 'http://jobservice:8080',
        'trivy_adapter_url': 'http://trivy-adapter:8080',
    }

    config_dict['hostname'] = configs["hostname"]

    config_dict['protocol'] = 'http'
    http_config = configs.get('http') or {}
    config_dict['http_port'] = http_config.get('port', 80)

    https_config = configs.get('https')
    if https_config:
        config_dict['protocol'] = 'https'
        config_dict['https_port'] = https_config.get('port', 443)
        config_dict['cert_path'] = https_config["certificate"]
        config_dict['cert_key_path'] = https_config["private_key"]

    if configs.get('external_url'):
        config_dict['public_url'] = configs.get('external_url')
    else:
        if config_dict['protocol'] == 'https':
            if config_dict['https_port'] == 443:
                config_dict['public_url'] = '{protocol}://{hostname}'.format(**config_dict)
            else:
                config_dict['public_url'] = '{protocol}://{hostname}:{https_port}'.format(**config_dict)
        else:
            if config_dict['http_port'] == 80:
                config_dict['public_url'] = '{protocol}://{hostname}'.format(**config_dict)
            else:
                config_dict['public_url'] = '{protocol}://{hostname}:{http_port}'.format(**config_dict)

    # DB configs
    db_configs = configs.get('database')
    if db_configs:
        # harbor db
        config_dict['harbor_db_host'] = 'postgresql'
        config_dict['harbor_db_port'] = 5432
        config_dict['harbor_db_name'] = 'registry'
        config_dict['harbor_db_username'] = 'postgres'
        config_dict['harbor_db_password'] = db_configs.get("password") or ''
        config_dict['harbor_db_sslmode'] = 'disable'
        config_dict['harbor_db_max_idle_conns'] = db_configs.get("max_idle_conns") or default_db_max_idle_conns
        config_dict['harbor_db_max_open_conns'] = db_configs.get("max_open_conns") or default_db_max_open_conns
        config_dict['harbor_db_conn_max_lifetime'] = db_configs.get("conn_max_lifetime") or '5m'
        config_dict['harbor_db_conn_max_idle_time'] = db_configs.get("conn_max_idle_time") or '0'

    # Data path volume
    config_dict['data_volume'] = configs['data_volume']

    # Initial Admin Password
    config_dict['harbor_admin_password'] = configs["harbor_admin_password"]

    # Registry storage configs
    storage_config = configs.get('storage_service') or {}

    config_dict['registry_custom_ca_bundle_path'] = storage_config.get('ca_bundle') or ''

    if storage_config.get('filesystem'):
        config_dict['storage_provider_name'] = 'filesystem'
        config_dict['storage_provider_config'] = storage_config['filesystem']
    elif storage_config.get('azure'):
        config_dict['storage_provider_name'] = 'azure'
        config_dict['storage_provider_config'] = storage_config['azure']
    elif storage_config.get('gcs'):
        config_dict['storage_provider_name'] = 'gcs'
        config_dict['storage_provider_config'] = storage_config['gcs']
    elif storage_config.get('s3'):
        config_dict['storage_provider_name'] = 's3'
        config_dict['storage_provider_config'] = storage_config['s3']
    elif storage_config.get('swift'):
        config_dict['storage_provider_name'] = 'swift'
        config_dict['storage_provider_config'] = storage_config['swift']
    elif storage_config.get('oss'):
        config_dict['storage_provider_name'] = 'oss'
        config_dict['storage_provider_config'] = storage_config['oss']
    else:
        config_dict['storage_provider_name'] = 'filesystem'
        config_dict['storage_provider_config'] = {}

    if storage_config.get('redirect'):
        config_dict['storage_redirect_disabled'] = storage_config['redirect']['disable']

    # Global proxy configs
    proxy_config = configs.get('proxy') or {}
    proxy_components = proxy_config.get('components') or []
    no_proxy_config = proxy_config.get('no_proxy')
    all_no_proxy = INTERNAL_NO_PROXY_DN
    if no_proxy_config:
        all_no_proxy |= set(no_proxy_config.split(','))

    for proxy_component in proxy_components:
        config_dict[proxy_component + '_http_proxy'] = proxy_config.get('http_proxy') or ''
        config_dict[proxy_component + '_https_proxy'] = proxy_config.get('https_proxy') or ''
        config_dict[proxy_component + '_no_proxy'] = ','.join(all_no_proxy)

    # Webhook and Slack notification egress; an unset policy leaves the default to Harbor
    webhook_egress_config = configs.get('webhook_egress') or {}
    webhook_egress_policy = webhook_egress_config.get('policy')
    config_dict['webhook_egress_policy'] = '' if webhook_egress_policy is None else str(webhook_egress_polic
```

### Core Architecture Module: `make/photon/prepare/utils/core.py`
```
import os
import shutil
from g import config_dir, templates_dir, data_dir, DEFAULT_GID, DEFAULT_UID
from utils.jinja import render_jinja
from utils.misc import prepare_dir, generate_random_string

core_config_dir = os.path.join(config_dir, "core", "certificates")
core_env_template_path = os.path.join(templates_dir, "core", "env.jinja")
core_conf_env = os.path.join(config_dir, "core", "env")
core_conf_template_path = os.path.join(templates_dir, "core", "app.conf.jinja")
core_conf = os.path.join(config_dir, "core", "app.conf")

ca_download_dir = os.path.join(data_dir, 'ca_download')


def prepare_core(config_dict, with_trivy):
    prepare_dir(ca_download_dir, uid=DEFAULT_UID, gid=DEFAULT_GID)
    prepare_dir(core_config_dir)
    # Render Core

    render_jinja(
        core_env_template_path,
        core_conf_env,
        with_trivy=with_trivy,
        scan_robot_prefix=generate_random_string(8),
        **config_dict)

    render_jinja(
        core_conf_template_path,
        core_conf,
        uid=DEFAULT_UID,
        gid=DEFAULT_GID,
        **config_dict)


def copy_core_config(core_templates_path, core_config_path):
    shutil.copyfile(core_templates_path, core_config_path)
    print("Generated configuration file: %s" % core_config_path)

```

### Core Architecture Module: `make/photon/prepare/utils/db.py`
```
import os

from g import config_dir, templates_dir, data_dir, PG_UID, PG_GID
from utils.misc import prepare_dir
from utils.jinja import render_jinja

db_config_dir = os.path.join(config_dir, "db")
db_env_template_path = os.path.join(templates_dir, "db", "env.jinja")
db_conf_env = os.path.join(config_dir, "db", "env")
database_data_path = os.path.join(data_dir, 'database')

def prepare_db(config_dict):
    prepare_dir(database_data_path, uid=PG_UID, gid=PG_GID, mode=0o700)
    prepare_dir(db_config_dir)
    render_jinja(
        db_env_template_path,
        db_conf_env,
        harbor_db_password=config_dict['harbor_db_password'])

```

### Core Architecture Module: `make/photon/prepare/utils/docker_compose.py`
```
import os

from g import templates_dir
from .configs import parse_versions
from .jinja import render_jinja

docker_compose_template_path = os.path.join(templates_dir, 'docker_compose', 'docker-compose.yml.jinja')
docker_compose_yml_path = '/compose_location/docker-compose.yml'

# render docker-compose
def prepare_docker_compose(configs, with_trivy):
    versions = parse_versions()
    VERSION_TAG = versions.get('VERSION_TAG') or 'dev'

    rendering_variables = {
        'version': VERSION_TAG,
        'reg_version': VERSION_TAG,
        'redis_version': VERSION_TAG,
        'trivy_adapter_version': VERSION_TAG,
        'data_volume': configs['data_volume'],
        'log_location': configs['log_location'],
        'protocol': configs['protocol'],
        'http_port': configs['http_port'],
        'external_redis': configs['external_redis'],
        'external_database': configs['external_database'],
        'with_trivy': with_trivy,
    }

    # if configs.get('registry_custom_ca_bundle_path'):
    #     rendering_variables['registry_custom_ca_bundle_path'] = configs.get('registry_custom_ca_bundle_path')
    #     rendering_variables['custom_ca_required'] = True

    # for gcs
    storage_config = configs.get('storage_provider_config') or {}
    if storage_config.get('keyfile') and configs['storage_provider_name'] == 'gcs':
        rendering_variables['gcs_keyfile'] = storage_config['keyfile']

    # for http
    if configs['protocol'] == 'https':
        rendering_variables['cert_key_path'] = configs['cert_key_path']
        rendering_variables['cert_path'] = configs['cert_path']
        rendering_variables['https_port'] = configs['https_port']

    # internal cert pairs
    rendering_variables['internal_tls'] = configs['internal_tls']

    # for uaa
    uaa_config = configs.get('uaa') or {}
    if uaa_config.get('ca_file'):
        rendering_variables['uaa_ca_file'] = uaa_config['ca_file']

    # for log
    log_ep_host = configs.get('log_ep_host')
    if log_ep_host:
        rendering_variables['external_log_endpoint'] = True

    # for metrics
    metric = configs.get('metric')
    if metric:
        rendering_variables['metric'] = metric

    render_jinja(docker_compose_template_path, docker_compose_yml_path,  mode=0o644, **rendering_variables)

```

### Core Architecture Module: `make/photon/prepare/utils/exporter.py`
```
import os
from g import config_dir, templates_dir, DEFAULT_GID, DEFAULT_UID
from utils.jinja import render_jinja
from utils.misc import prepare_dir

EXPORTER_CONFIG_DIR = os.path.join(config_dir, "exporter")
EXPORTER_CONF_ENV = os.path.join(config_dir, "exporter", "env")
EXPORTER_ENV_TEMPLATE_PATH = os.path.join(templates_dir, "exporter", "env.jinja")

def prepare_exporter(config_dict):
    prepare_dir(EXPORTER_CONFIG_DIR, uid=DEFAULT_UID, gid=DEFAULT_GID)

    render_jinja(
        EXPORTER_ENV_TEMPLATE_PATH,
        EXPORTER_CONF_ENV,
        **config_dict)

```

### Core Architecture Module: `make/photon/prepare/utils/internal_tls.py`
```

def prepare_tls(config_dict):
    config_dict['internal_tls'].prepare()
    config_dict['internal_tls'].validate()
```

### Core Architecture Module: `make/photon/prepare/utils/jinja.py`
```
import json

from jinja2 import Environment, FileSystemLoader, select_autoescape
from .misc import mark_file

jinja_env = Environment(loader=FileSystemLoader('/'), trim_blocks=True, lstrip_blocks=True, autoescape = select_autoescape())

def to_json(value):
    return json.dumps(value)

jinja_env.filters['to_json'] = to_json


def render_jinja(src, dest,mode=0o640, uid=0, gid=0, **kw):
    t = jinja_env.get_template(src)
    with open(dest, 'w') as f:
        f.write(t.render(**kw))
    mark_file(dest, mode, uid, gid)
    print("Generated configuration file: %s" % dest)
```

### Core Architecture Module: `make/photon/prepare/utils/jobservice.py`
```
import os

from g import config_dir, DEFAULT_GID, DEFAULT_UID, templates_dir
from utils.misc import prepare_dir
from utils.jinja import render_jinja

job_config_dir = os.path.join(config_dir, "jobservice")
job_service_env_template_path = os.path.join(templates_dir, "jobservice", "env.jinja")
job_service_conf_env = os.path.join(config_dir, "jobservice", "env")
job_service_conf_template_path = os.path.join(templates_dir, "jobservice", "config.yml.jinja")
jobservice_conf = os.path.join(config_dir, "jobservice", "config.yml")

def prepare_job_service(config_dict):
    prepare_dir(job_config_dir, uid=DEFAULT_UID, gid=DEFAULT_GID)

    log_level = config_dict['log_level'].upper()

    # Job log and exported reports are stored in data dir
    job_log_dir = os.path.join('/data', "job_logs")
    prepare_dir(job_log_dir, uid=DEFAULT_UID, gid=DEFAULT_GID)

    # Render Jobservice env
    render_jinja(
        job_service_env_template_path,
        job_service_conf_env,
        **config_dict)

    # Render Jobservice config
    render_jinja(
        job_service_conf_template_path,
        jobservice_conf,
        uid=DEFAULT_UID,
        gid=DEFAULT_GID,
        internal_tls=config_dict['internal_tls'],
        max_job_workers=config_dict['max_job_workers'],
        max_job_duration_hours=config_dict['max_job_duration_hours'],
        job_loggers=config_dict['job_loggers'],
        logger_sweeper_duration=config_dict['logger_sweeper_duration'],
        redis_url=config_dict['redis_url_js'],
        level=log_level,
        metric=config_dict['metric'])

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24361** (2026-11-11): **Bump Trivy adapter and distribution for release-2.15.0**
  *Symptoms*: Bump Trivy adapter to v0.40.1 and distribution to v2.8.3-harbor.4.  Reference: #24316.  Validation: release tags verified; Makefile pins and download URL checked; git diff --check passed.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24361?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-2.15.0@47f3055`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/24361/graphs/tree.svg?width=650&height=150&src=pr&token=6SOPrJGDVW&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)](https://app.codecov.io/gh/goharbor/harbor/pull/24361?src=pr&el=tree&utm

- **Issue #24360** (2026-11-11): **(cherry-pick): preserve artifact type for multi-tier accessories**
  *Symptoms*: Backports #24200 to release-2.15.0.  Both affected Go test suites passed. Required Signed-off-by included.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24360?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-2.15.0@41a8398`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/24360/graphs/tree.svg?width=650&height=150&src=pr&token=6SOPrJGDVW&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)](https://app.codecov.io/gh/goharbor/harbor/pull/24360?src=pr&el=tree&utm

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

### Incident Patch 1: `fac9abd1` (2026-11-10)
**Commit Message**: skip copy online package for all release because it is not include in the rc package (#24341)

skip copy online package for all release

Signed-off-by: stonezdj <[REDACTED_EMAIL]>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>

**File**: `.github/workflows/publish_release.yml` (modified, +0/-6)
```diff
@@ -51,12 +51,6 @@ jobs:
             dst_offline=harbor-offline-installer-${cur}-${arch}.tgz
             dst_online=
             aws s3 cp s3://${bucket}/${branch}/${src_offline} s3://${bucket}/${branch}/${dst_offline}
-
-            if [ "${{ env.PRERELEASE }}" = "false" ]; then
-              src_online=harbor-online-installer-${base}-${{ env.BUILD_NO }}-${arch}.tgz
-              dst_online=harbor-online-installer-${cur}-${arch}.tgz
-              aws s3 cp s3://${bucket}/${branch}/${src_online} s3://${bucket}/${branch}/${dst_online}
-            fi
             source tools/release/release_utils.sh && getAssets "$bucket" "$branch" "$dst_offline" "$dst_online" "${{ env.PRERELEASE }}" "$assets_path"
           done
 
```

---

### Incident Patch 2: `45c12df3` (2026-11-10)
**Commit Message**: add prepare migraion script for 2.16.0 (#24346)

Signed-off-by: my036811 <[REDACTED_EMAIL]>

**File**: `make/harbor.yml.tmpl` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ log:
   #   port: 5140
 
 #This attribute is for migrator to detect the version of the .cfg file, DO NOT MODIFY!
-_version: 2.15.0
+_version: 2.16.0
 
 # Uncomment external_database if using external database.
 # external_database:
```

**File**: `make/photon/prepare/commands/migrate.py` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 @click.command()
 @click.option('-i', '--input', 'input_', required=True, help="The path of original config file")
 @click.option('-o', '--output', default='', help="the path of output config file")
-@click.option('-t', '--target', default='2.15.0', help="target version of input path")
+@click.option('-t', '--target', default='2.16.0', help="target version of input path")
 def migrate(input_, output, target):
     """
     migrate command will migrate config file style to specific version
```

**File**: `make/photon/prepare/migrations/__init__.py` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 MIGRATION_BASE_DIR = os.path.dirname(__file__)
 
-accept_versions = {'1.9.0', '1.10.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '2.4.0', '2.5.0', '2.6.0', '2.7.0', '2.8.0', '2.9.0','2.10.0', '2.11.0', '2.12.0', '2.13.0', '2.14.0', '2.15.0'}
\ No newline at end of file
+accept_versions = {'1.9.0', '1.10.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '2.4.0', '2.5.0', '2.6.0', '2.7.0', '2.8.0', '2.9.0','2.10.0', '2.11.0', '2.12.0', '2.13.0', '2.14.0', '2.15.0', '2.16.0'}
\ No newline at end of file
```

**File**: `make/photon/prepare/migrations/version_2_16_0/__init__.py` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import os
+from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
+from utils.migration import read_conf
+
+revision = '2.16.0'
+down_revisions = ['2.15.0']
+
+def migrate(input_cfg, output_cfg):
+    current_dir = os.path.dirname(__file__)
+    tpl = Environment(
+        loader=FileSystemLoader(current_dir),
+        undefined=StrictUndefined,
+        trim_blocks=True,
+        lstrip_blocks=True,
+        autoescape = select_autoescape()
+        ).get_template('harbor.yml.jinja')
+
+    config_dict = read_conf(input_cfg)
+
+    with open(output_cfg, 'w') as f:
+        f.write(tpl.render(**config_dict))
```

**File**: `make/photon/prepare/migrations/version_2_16_0/harbor.yml.jinja` (added, +817/-0)
```diff
@@ -0,0 +1,817 @@
+# Configuration file of Harbor
+
+# The IP address or hostname to access admin UI and registry service.
+# DO NOT use localhost or 127.0.0.1, because Harbor needs to be accessed by external clients.
+hostname: {{ hostname }}
+
+# http related config
+{% if http is defined %}
+http:
+  # port for http, default is 80. If https enabled, this port will redirect to https port
+  port: {{ http.port }}
+{% else %}
+# http:
+#   # port for http, default is 80. If https enabled, this port will redirect to https port
+#   port: 80
+{% endif %}
+
+{% if https is defined %}
+# https related config
+https:
+  # https port for harbor, default is 443
+  port: {{ https.port }}
+  # The path of cert and key files for nginx
+  certificate: {{ https.certificate }}
+  private_key: {{ https.private_key }}
+  # enable strong ssl ciphers (default: false)
+  {% if strong_ssl_ciphers is defined %}
+  strong_ssl_ciphers: {{ strong_ssl_ciphers | lower }}
+  {% else %}
+  strong_ssl_ciphers: false
+  {% endif %}
+{% else %}
+# https related config
+# https:
+#   # https port for harbor, default is 443
+#   port: 443
+#   # The path of cert and key files for nginx
+#   certificate: /your/certificate/path
+#   private_key: /your/private/key/path
+#   enable strong ssl ciphers (default: false)
+#   strong_ssl_ciphers: false
+{% endif %}
+
+# # Harbor will set ipv4 enabled only by default if this block is not configured
+# # Otherwise, please uncomment this block to configure your own ip_family stacks
+{% if ip_family is defined %}
+ip_family:
+  # ipv6Enabled set to true if ipv6 is enabled in docker network, currently it affected the nginx related component
+  {% if ip_family.ipv6 is defined %}
+  ipv6:
+    enabled: {{ ip_family.ipv6.enabled | lower }}
+  {% else %}
+  ipv6:
+    enabled: false
+  {% endif %}
+  # ipv4Enabled set to true by default, currently it affected the nginx related component
+  {% if ip_family.ipv4 is defined %}
+  ipv4:
+    enabled: {{ ip_family.ipv4.enabled | lower }}
+  {% else %}
+  ipv4:
+    enabled: true
+  {% endif %}
+{% else %}
+# ip_family:
+#   # ipv6Enabled set to true if ipv6 is enabled in docker network, currently it affected the nginx related component
+#   ipv6:
+#     enabled: false
+#   # ipv4Enabled set to true by default, currently it affected the nginx related component
+#   ipv4:
+#     enabled: true
+{% endif %}
+
+{% if internal_tls is defined %}
+# Uncomment following will enable tls communication between all harbor components
+internal_tls:
+  # set enabled to true means internal tls is enabled
+  enabled: {{ internal_tls.enabled | lower }}
+  {% if internal_tls.dir is defined %}
+  # put your cert and key files on dir
+  dir: {{ internal_tls.dir }}
+  {% endif %}
+{% else %}
+# internal_tls:
+#   # set enabled to true means internal tls is enabled
+#   enabled: true
+#   # put your cert and key files on dir
+#   dir: /etc/harbor/tls/internal
+{% endif %}
+
+# Uncomment external_url if you want to enable external proxy
+# And when it enabled the hostname will no longer used
+{% if external_url is defined %}
+external_url: {{ external_url }}
+{% else %}
+# external_url: https://reg.mydomain.com:8433
+{% endif %}
+
+# The initial password of Harbor admin
+# It only works in first time to install harbor
+# Remember Change the admin password from UI after launching Harbor.
+{% if harbor_admin_password is defined %}
+harbor_admin_password: {{ harbor_admin_password }}
+{% else %}
+harbor_admin_password: Harbor12345
+{% endif %}
+
+# Harbor DB configuration
+database:
+{% if database is defined %}
+  # The password for the root user of Harbor DB. Change this before any production use.
+  password: {{ database.password}}
+  # The maximum number of connections in the idle connection pool. If it <=0, no idle connections are retained.
+  max_idle_conns: {{ database.max_idle_conns }}
+  # The maximum number of open connections to the database. If it <= 0, then there is no limit on the number of open connections.
+  # Note: the default number of connections is 1024 for postgres of harbor.
+  max_open_conns: {{ database.max_open_conns }}
+  # The maximum amount of time a connection may be reused. Expired connections may be closed lazily before reuse. If it <= 0, connections are not closed due to a connection's age.
+  # The value is a duration string. A duration string is a possibly signed sequence of decimal numbers, each with optional fraction and a unit suffix, such as "300ms", "-1.5h" or "2h45m". Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
+  {% if database.conn_max_lifetime is defined %}
+  conn_max_lifetime: {{ database.conn_max_lifetime }}
+  {% else %}
+  conn_max_lifetime: 5m
+  {% endif %}
+  # The maximum amount of time a connection may be idle. Expired connections may be closed lazily before reuse. If it <= 0, connections are not closed due to a connection's idle time.
+  # The value is a duration string. A duration string is a possibly signed seque
```

#### Recent Merged Pull Requests:
- **PR #24361** (2026-11-11): Bump Trivy adapter and distribution for release-2.15.0 (@stonezdj)
- **PR #24360** (2026-11-11): (cherry-pick): preserve artifact type for multi-tier accessories (@stonezdj)
- **PR #24359** (2026-11-11): (cherry-pick): ignore 401 when listing labels of a Harbor registry (@stonezdj)
- **PR #24353** (2026-11-10): (cherry-pick) Publish online installer package for RC releases (@stonezdj)
- **PR #24351** (2026-11-10): Bump up distribution to v2.8.3-harbor.4-rc1 and bump up golang to 1.27.3 (@stonezdj)
- **PR #24348** (2026-11-10): (cherry-pick) Skip copying online package during release (@stonezdj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
