> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source**: github ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Source Version**: `3852755e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T19:37:21.254Z  
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
> **Harvest Timestamp**: 2026-11-07T19:37:20.592Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goharbor/harbor`
- **Description**: An open source trusted cloud native registry project that stores, signs, and scans content.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29690 stars

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
- **Issue #24316** (2026-11-05): **Bump up trivy adapter and distribution**
  *Symptoms*: Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 

- **Issue #24313** (2026-11-05): **Bump up harbor version**
  *Symptoms*: Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 

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

### Incident Patch 1: `5822576c` (2026-11-06)
**Commit Message**: fix(csrf): replace gorilla/csrf with net/http.CrossOriginProtection (#23915)

* fix(csrf): replace gorilla/csrf with net/http.CrossOriginProtection

Use Fetch Metadata and Origin checks for session-carrying requests,
reject unsafe requests lacking both headers, and remove the gorilla/csrf
and gorilla/securecookie dependencies.

Preserve the original Host authority through the plain-HTTP nginx proxy
so Origin validation includes the port. Extend regression tests for
same-origin requests, cross-site and sibling-subdomain requests, and
requests from a different port on the same host.

Signed-off-by: Prasanth Baskar <[REDACTED_EMAIL]>
Signed-off-by: stonezdj <[REDACTED_EMAIL]>

* fix(csrf): preserve Host port through the https nginx proxy

Mirror the plain-HTTP template change: add the forwarded_host map and use
it for Host in the /c/ and /api/ locations so core's cross-origin check
sees the port when HTTPS runs on a non-default port.

Signed-off-by: Prasanth Baskar <[REDACTED_EMAIL]>

* fix(csrf): drop unused CSRF_KEY and document proxy Host requirement

Core no longer reads CSRF_KEY since the switch to CrossOriginProtection, so stop generating and rendering it. Add a test for the HTT

**File**: `make/photon/prepare/templates/core/env.jinja` (modified, +0/-1)
```diff
@@ -37,7 +37,6 @@ RELOAD_KEY={{reload_key}}
 REGISTRY_CONTROLLER_URL={{registry_controller_url}}
 REGISTRY_CREDENTIAL_USERNAME={{registry_username}}
 REGISTRY_CREDENTIAL_PASSWORD={{registry_password}}
-CSRF_KEY={{csrf_key}}
 ROBOT_SCANNER_NAME_PREFIX={{scan_robot_prefix}}
 PERMITTED_REGISTRY_TYPES_FOR_PROXY_CACHE=docker-hub,harbor,azure-acr,ali-acr,aws-ecr,google-gcr,docker-registry,github-ghcr,jfrog-artifactory
 REPLICATION_ADAPTER_WHITELIST=ali-acr,aws-ecr,azure-acr,docker-hub,docker-registry,github-ghcr,google-gcr,harbor,huawei-SWR,jfrog-artifactory,tencent-tcr,volcengine-cr
```

**File**: `make/photon/prepare/templates/nginx/nginx.http.conf.jinja` (modified, +10/-3)
```diff
@@ -46,6 +46,13 @@ http {
     ""      $scheme;
   }
 
+  # $host drops a non-default port, and core's cross-origin check compares
+  # Origin against Host port included. Fall back to $host for Host-less requests.
+  map $http_host $forwarded_host {
+    default $http_host;
+    ""      $host;
+  }
+
   server {
     listen 8080;
     server_tokens off;
@@ -94,7 +101,7 @@ http {
 {% else %}
       proxy_pass http://core/c/;
 {% endif %}
-      proxy_set_header Host $host;
+      proxy_set_header Host $forwarded_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $x_forwarded_proto;
@@ -119,7 +126,7 @@ http {
 {% else %}
       proxy_pass http://core/api/;
 {% endif %}
-      proxy_set_header Host $host;
+      proxy_set_header Host $forwarded_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $x_forwarded_proto;
@@ -169,7 +176,7 @@ http {
 {% else %}
       proxy_pass http://core/service/;
 {% endif %}
-      proxy_set_header Host $host;
+      proxy_set_header Host $forwarded_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $x_forwarded_proto;
```

**File**: `make/photon/prepare/templates/nginx/nginx.https.conf.jinja` (modified, +9/-2)
```diff
@@ -47,6 +47,13 @@ http {
     ""      $scheme;
   }
 
+  # $host drops a non-default port, and core's cross-origin check compares
+  # Origin against Host port included. Fall back to $host for Host-less requests.
+  map $http_host $forwarded_host {
+    default $http_host;
+    ""      $host;
+  }
+
   include /etc/nginx/conf.d/*.server.conf;
 
   server {
@@ -123,7 +130,7 @@ http {
 {% else %}
       proxy_pass http://core/c/;
 {% endif %}
-      proxy_set_header Host $host;
+      proxy_set_header Host $forwarded_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $x_forwarded_proto;
@@ -147,7 +154,7 @@ http {
 {% else %}
       proxy_pass http://core/api/;
 {% endif %}
-      proxy_set_header Host $host;
+      proxy_set_header Host $forwarded_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $x_forwarded_proto;
```

**File**: `make/photon/prepare/utils/core.py` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ def prepare_core(config_dict, with_trivy):
         core_env_template_path,
         core_conf_env,
         with_trivy=with_trivy,
-        csrf_key=generate_random_string(32),
         scan_robot_prefix=generate_random_string(8),
         **config_dict)
 
```

**File**: `src/go.mod` (modified, +0/-3)
```diff
@@ -34,8 +34,6 @@ require (
 	github.com/gomodule/redigo v2.0.0+incompatible
 	github.com/google/go-containerregistry v0.21.3
 	github.com/google/uuid v1.6.0
-	// pin the github.com/gorilla/csrf to v1.7.2 because of issue https://github.com/goharbor/harbor/issues/22010
-	github.com/gorilla/csrf v1.7.2
 	github.com/gorilla/handlers v1.5.2
 	github.com/gorilla/mux v1.8.1
 	github.com/graph-gophers/dataloader v5.0.0+incompatible
@@ -148,7 +146,6 @@ require (
 	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
 	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
 	github.com/google/go-querystring v1.1.0 // indirect
-	github.com/gorilla/securecookie v1.1.2 // indirect
 	github.com/grpc-ecosystem/grpc-gateway/v2 v2.26.3 // indirect
 	github.com/h2non/parth v0.0.0-20190131123155-b4df798d6542 // indirect
 	github.com/hashicorp/golang-lru v1.0.2 // indirect
```

**File**: `src/go.sum` (modified, +0/-6)
```diff
@@ -427,8 +427,6 @@ github.com/google/go-containerregistry v0.21.3/go.mod h1:D5ZrJF1e6dMzvInpBPuMCX0
 github.com/google/go-querystring v1.1.0 h1:AnCroh3fv4ZBgVIf1Iwtovgjaw/GiKJo8M8yD/fhyJ8=
 github.com/google/go-querystring v1.1.0/go.mod h1:Kcdr2DB4koayq7X8pmAG4sNG59So17icRSOU623lUBU=
 github.com/google/gofuzz v1.0.0/go.mod h1:dBl0BpW6vV/+mYPU4Po3pmUjxk6FQPldtuIdl/M65Eg=
-github.com/google/gofuzz v1.2.0 h1:xRy4A+RhZaiKjJ1bPfwQ8sedCA+YS2YcCHW6ec7JMi0=
-github.com/google/gofuzz v1.2.0/go.mod h1:dBl0BpW6vV/+mYPU4Po3pmUjxk6FQPldtuIdl/M65Eg=
 github.com/google/martian v2.1.0+incompatible/go.mod h1:9I4somxYTbIHy5NJKHRl3wXiIaQGbYVAs8BPL6v8lEs=
 github.com/google/martian/v3 v3.0.0/go.mod h1:y5Zk1BBys9G+gd6Jrk0W3cC1+ELVxBWuIGO+w/tUAp0=
 github.com/google/pprof v0.0.0-20190515194954-54271f7e092f/go.mod h1:zfwlbNMJ+OItoe0UupaVj+oy1omPYYDuagoSzA8v9mc=
@@ -447,17 +445,13 @@ github.com/gopherjs/gopherjs v0.0.0-20181017120253-0766667cb4d1/go.mod h1:wJfORR
 github.com/gopherjs/gopherjs v1.17.2 h1:fQnZVsXk8uxXIStYb0N4bGk7jeyTalG/wsZjQ25dO0g=
 github.com/gopherjs/gopherjs v1.17.2/go.mod h1:pRRIvn/QzFLrKfvEz3qUuEhtE/zLCWfreZ6J5gM2i+k=
 github.com/gorilla/context v1.1.1/go.mod h1:kBGZzfjB9CEq2AlWe17Uuf7NDRt0dE0s8S51q0aT7Yg=
-github.com/gorilla/csrf v1.7.2 h1:oTUjx0vyf2T+wkrx09Trsev1TE+/EbDAeHtSTbtC2eI=
-github.com/gorilla/csrf v1.7.2/go.mod h1:F1Fj3KG23WYHE6gozCmBAezKookxbIvUJT+121wTuLk=
 github.com/gorilla/handlers v1.5.2 h1:cLTUSsNkgcwhgRqvCNmdbRWG0A3N4F+M2nWKdScwyEE=
 github.com/gorilla/handlers v1.5.2/go.mod h1:dX+xVpaxdSw+q0Qek8SSsl3dfMk3jNddUkMzo0GtH0w=
 github.com/gorilla/mux v1.6.2/go.mod h1:1lud6UwP+6orDFRuTfBEV8e9/aOM/c4fVVCaMa2zaAs=
 github.com/gorilla/mux v1.8.0/go.mod h1:DVbg23sWSpFRCP0SfiEN6jmj59UnW/n46BH5rLB71So=
 github.com/gorilla/mux v1.8.1 h1:TuBL49tXwgrFYWhqrNgrUNEY92u81SPhu7sTdzQEiWY=
 github.com/gorilla/mux v1.8.1/go.mod h1:AKf9I4AEqPTmMytcMc0KkNouC66V3BtZ4qD5fmWSiMQ=
 github.com/gorilla/securecookie v1.1.1/go.mod h1:ra0sb63/xPlUeL+yeDciTfxMRAA+MP+HVt/4epWDjd4=
-github.com/gorilla/securecookie v1.1.2 h1:YCIWL56dvtr73r6715mJs5ZvhtnY73hBvEF8kXD8ePA=
-github.com/gorilla/securecookie v1.1.2/go.mod h1:NfCASbcHqRSY+3a8tlWJwsQap2VX5pwzwo4h3eOamfo=
 github.com/gorilla/sessions v1.2.1/go.mod h1:dk2InVEVJ0sfLlnXv9EAgkf6ecYs/i80K/zI+bUmuGM=
 github.com/graph-gophers/dataloader v5.0.0+incompatible h1:R+yjsbrNq1Mo3aPG+Z/EKYrXrXXUNJHOgbRt+U6jOug=
 github.com/graph-gophers/dataloader v5.0.0+incompatible/go.mod h1:jk4jk0c5ZISbKaMe8WsVopGB5/15GvGHMdMdPtwlRp4=
```

**File**: `src/server/middleware/csrf/csrf.go` (modified, +49/-61)
```diff
@@ -16,77 +16,74 @@ package csrf
 
 import (
 	"net/http"
-	"os"
+	"slices"
 	"strings"
-	"sync"
 
-	"github.com/gorilla/csrf"
-
-	"github.com/goharbor/harbor/src/common/utils"
 	"github.com/goharbor/harbor/src/lib"
-	"github.com/goharbor/harbor/src/lib/config"
 	"github.com/goharbor/harbor/src/lib/errors"
 	lib_http "github.com/goharbor/harbor/src/lib/http"
 	"github.com/goharbor/harbor/src/lib/log"
 	"github.com/goharbor/harbor/src/server/middleware"
 )
 
-const (
-	csrfKeyEnv  = "CSRF_KEY"
-	tokenHeader = "X-Harbor-CSRF-Token"
-)
+// protect judges each request on the origin that browser actually used, so it
+// needs no configuration and is safe for concurrent use.
+var protect = http.NewCrossOriginProtection()
 
-var (
-	once       sync.Once
-	secureFlag = true
-	protect    func(handler http.Handler) http.Handler
-)
+// safeMethods are the methods RFC 7231 defines as safe, which carry no state
+// change and so need no cross-origin check.
+var safeMethods = []string{http.MethodGet, http.MethodHead, http.MethodOptions}
 
-// attachToken makes sure if csrf generate a new token it will be included in the response header
-func attachToken(w http.ResponseWriter, r *http.Request) {
-	if t := csrf.Token(r); len(t) > 0 {
-		w.Header().Set(tokenHeader, t)
-	} else {
-		log.Warningf("token not found in context, skip attaching")
+// check applies the cross-origin protection, then closes the one gap it leaves
+// open by design.
+//
+// CrossOriginProtection admits a request carrying neither Sec-Fetch-Site nor
+// Origin, reading it as non-browser traffic. That is the right default for a
+// library, but not here: csrfSkipper has already excused the registry, API and
+// service routes that non-browser clients use, so an unsafe request arriving
+// without either header is one we cannot vouch for. Refusing it matches what the
+// previous token scheme did, which rejected any write that failed to present a
+// token.
+func check(req *http.Request) error {
+	// Origin must match Host port included, so the proxy has to forward the port.
+	if err := protect.Check(req); err != nil {
+		return err
 	}
-}
 
-func handleError(w http.ResponseWriter, r *http.Request) {
-	attachToken(w, r)
-	lib_http.SendError(w, errors.New(csrf.FailureReason(r)).WithCode(errors.ForbiddenCode))
-}
+	if slices.Contains(safeMethods, req.Method) {
+		return nil
+	}
+
+	if req.Header.Get("Sec-Fetch-Site") == "" && req.Header.Get("Origin") == "" {
+		return errors.New("request carries neither Sec-Fetch-Site nor Origin, cannot confirm its origin")
+	}
 
-func attach(handler http.Handler) http.Handler {
-	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
-		attachToken(rw, req)
-		handler.ServeHTTP(rw, req)
-	})
+	return nil
 }
 
-// Middleware initialize the middleware to apply csrf selectively
+// Middleware rejects cross-origin requests that carry a session. It reads the
+// Fetch metadata headers browsers have sent since 2023, falling back to
+// comparing Origin against the Host the client addressed.
+//
+// Without Sec-Fetch-Site, Origin is compared to the Host core receives, port
+// included and scheme ignored; X-Forwarded-Host is not consulted. Reverse
+// proxies must forward Host unchanged, e.g. nginx `proxy_set_header Host
+// $http_host;`.
+//
+// Deliberately no configured endpoint takes part in the decision. Harbor is
+// commonly reachable on several ingresses, over different schemes, behind
+// proxies that rewrite Host; a single configured origin describes none of that,
+// and every attempt to reconstruct "the" expected origin gets one of those
+// deployments wrong.
 func Middleware() func(handler http.Handler) http.Handler {
-	once.Do(func() {
-		key := os.Getenv(csrfKeyEnv)
-		if len(key) == 0 {
-			key = utils.GenerateRandomString()
-		} else if len(key) != 32 {
-			log.Errorf("Invalid CSRF key length from the environment (%d characters). Please ensure the key length is 32 characters.", len(key))
-			protect = func(_ http.Handler) http.Handler {
-				return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
-					lib_http.SendError(w, errors.New("invalid CSRF key length from the environment. Please ensure the key length is 32 characters"))
-				})
-			}
+	return middleware.New(func(rw http.ResponseWriter, req *http.Request, next http.Handler) {
+		if err := check(req); err != nil {
+			log.Debugf("Rejected cross-origin request for %s: %v", lib.TrimLineBreaks(req.URL.Path), err)
+			lib_http.SendError(rw, errors.New(err).WithCode(errors.ForbiddenCode))
 			return
 		}
-		secureFlag = secureCookie()
-		protect = csrf.Protect([]byte(key), csrf.RequestHeader(tokenHeader),
-			csrf.Secure(secureFlag),
-			csrf.ErrorHandler(http.HandlerFunc(handleError)),
-			csrf.SameSite(csrf.SameSiteStrictMode),
-			csrf.Path("/"))
-	})
-	return middleware.New(func(rw http.ResponseWriter, req *http.Request, next http.Handler) {
-		protect(attach(next)).ServeHTTP(rw, req)
+
+		next.ServeHTTP(rw, req)
 	}, csrf
```

**File**: `src/server/middleware/csrf/csrf_test.go` (modified, +236/-64)
```diff
@@ -1,105 +1,277 @@
+// Copyright Project Harbor Authors
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//    http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
 package csrf
 
 import (
 	"net/http"
 	"net/http/httptest"
-	"os"
-	"sync"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
 
-	"github.com/goharbor/harbor/src/common"
-	"github.com/goharbor/harbor/src/common/utils/test"
-	"github.com/goharbor/harbor/src/lib/config"
-	_ "github.com/goharbor/harbor/src/pkg/config/inmemory"
+	"github.com/goharbor/harbor/src/lib"
 )
 
-func resetMiddleware() {
-	once = sync.Once{}
+// reached answers 200 and records that the request got past the middleware.
+type reached struct {
+	called bool
 }
 
-func TestMain(m *testing.M) {
-	test.InitDatabaseFromEnv()
-	conf := map[string]any{}
-	config.InitWithSettings(conf)
-	result := m.Run()
-	if result != 0 {
-		os.Exit(result)
-	}
+func (r *reached) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
+	r.called = true
+	w.WriteHeader(http.StatusOK)
 }
 
-type handler struct {
-}
+// serve runs one request through the middleware on the given host.
+func serve(t *testing.T, method, host, path string, headers map[string]string, carrySession bool) (int, bool) {
+	t.Helper()
 
-func (h *handler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
-	w.WriteHeader(http.StatusOK)
+	handler := &reached{}
+	req := httptest.NewRequest(method, "https://"+host+path, nil)
+	req.Host = host
+	for k, v := range headers {
+		req.Header.Set(k, v)
+	}
+	if carrySession {
+		req = req.WithContext(lib.WithCarrySession(req.Context(), true))
+	}
+
+	rec := httptest.NewRecorder()
+	Middleware()(handler).ServeHTTP(rec, req)
+
+	return rec.Code, handler.called
 }
 
-func TestMiddleware(t *testing.T) {
+const host = "harbor.example.com"
+
+// TestMiddlewareAllows covers the traffic that must keep working. Note that no
+// case names a configured endpoint: each request is judged on the origin the
+// client actually used, which is what lets one Harbor answer on several
+// ingresses, over either scheme, on any port.
+func TestMiddlewareAllows(t *testing.T) {
 	cases := []struct {
-		req         *http.Request
-		statusCode  int
-		returnToken bool
+		name    string
+		method  string
+		host    string
+		headers map[string]string
 	}{
 		{
-			req:         httptest.NewRequest(http.MethodGet, "/", nil),
-			statusCode:  http.StatusOK,
-			returnToken: true,
+			name:    "same-origin write from a browser",
+			method:  http.MethodPost,
+			host:    host,
+			headers: map[string]string{"Sec-Fetch-Site": "same-origin", "Origin": "https://" + host},
+		},
+		{
+			name:    "top level navigation",
+			method:  http.MethodPost,
+			host:    host,
+			headers: map[string]string{"Sec-Fetch-Site": "none"},
+		},
+		{
+			name:    "a second ingress, unknown to any configuration",
+			method:  http.MethodPost,
+			host:    "eu." + host,
+			headers: map[string]string{"Sec-Fetch-Site": "same-origin", "Origin": "https://eu." + host},
+		},
+		{
+			name:    "browser predating Sec-Fetch-Site, Origin matches Host",
+			method:  http.MethodPost,
+			host:    host,
+			headers: map[string]string{"Origin": "https://" + host},
+		},
+		{
+			name:    "plain HTTP, proxy preserves the port, Origin matches exactly",
+			method:  http.MethodPost,
+			host:    host + ":8099",
+			headers: map[string]string{"Origin": "http://" + host + ":8099"},
+		},
+		{
+			name:    "HTTPS on a non-default port without Sec-Fetch-Site, Origin matches Host",
+			method:  http.MethodPost,
+			host:    host + ":8443",
+			headers: map[string]string{"Origin": "https://" + host + ":8443"},
+		},
+		{
+			name:    "plain HTTP to an IPv6 literal, Origin matches exactly",
+			method:  http.MethodPost,
+			host:    "[::1]:8099",
+			headers: map[string]string{"Origin": "http://[::1]:8099"},
 		},
 		{
-			req:         httptest.NewRequest(http.MethodDelete, "/", nil),
-			statusCode:  http.StatusForbidden,
-			returnToken: true,
+			name:    "safe method is exempt even from a foreign origin",
+			method:  http.MethodGet,
+			host:    host,
+			headers: map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example.com"},
 		},
 		{
-			req:         httptest.NewRequest(http.MethodGet, "/api/2.0/projects", nil), // should be skipped
-			statusCode:  http.StatusOK,
-			returnToken: false,
+			name:   "safe method needs no origin at all",
+			method: http.MethodGet,
+			host:   host,
 		},
 		{
-			req:         httptest.NewRequest(http.MethodDelete, "/v2/library/hello-worl
```

---

### Incident Patch 2: `3852755e` (2026-11-06)
**Commit Message**: chore(deps): bump postcss-selector-parser from 7.1.1 to 7.1.7 in /src/portal/app-swagger-ui (#24238)

chore(deps): bump postcss-selector-parser in /src/portal/app-swagger-ui

Bumps [postcss-selector-parser](https://github.com/postcss/postcss-selector-parser) from 7.1.1 to 7.1.7.
- [Release notes](https://github.com/postcss/postcss-selector-parser/releases)
- [Changelog](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss-selector-parser/compare/v7.1.1...7.1.7)

---
updated-dependencies:
- dependency-name: postcss-selector-parser
  dependency-version: 7.1.7
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>

**File**: `src/portal/app-swagger-ui/package-lock.json` (modified, +3/-3)
```diff
@@ -5196,9 +5196,9 @@
       }
     },
     "node_modules/postcss-selector-parser": {
-      "version": "7.1.1",
-      "resolved": "https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-7.1.1.tgz",
-      "integrity": "sha512-orRsuYpJVw8LdAwqqLykBj9ecS5/cRHlI5+nvTo8LcCKmzDmqVORXtOIYEEQuL9D4BxtA1lm5isAqzQZCoQ6Eg==",
+      "version": "7.1.7",
+      "resolved": "https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-7.1.7.tgz",
+      "integrity": "sha512-wWBro/7hJ40ye6TPiXkUQoXKCw23xSsjriUvqd7Uls9Sso3oLiON1flc18cCdnjgCRXw4fBVqUJJeOdDTh3P3g==",
       "license": "MIT",
       "dependencies": {
         "cssesc": "^3.0.0",
```

#### Recent Merged Pull Requests:
- **PR #24316** (2026-11-05): Bump up trivy adapter and distribution (@stonezdj)
- **PR #24313** (2026-11-05): Bump up harbor version (@stonezdj)
- **PR #24311** (2026-11-06): (cherry-pick) replace gorilla/csrf with net/http.CrossOriginProtection (@stonezdj)
- **PR #24302** (2026-11-05): (cherry-pick)fix: restore robot member role assignment compatibility (@stonezdj)
- **PR #24300** (2026-11-04): fix: restore robot member role assignment compatibility (@stonezdj)
- **PR #24299** (closed):  fix: restore robot member role assignment compatibility (@stonezdj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
