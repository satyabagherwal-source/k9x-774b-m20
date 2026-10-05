# Forensic Learning Record (Deep Inspection): goharbor/harbor

> **Canonical Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:41:06.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goharbor/harbor`
- **Description**: An open source trusted cloud native registry project that stores, signs, and scans content.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29493 stars

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


def validate(conf: dict, **kwargs):
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

    # Trivy configs, optional
    trivy_configs = configs.get("trivy") or {}
    config_dict['trivy_github_token'] = trivy_configs.get("github_token") or ''
    config_dict['trivy_skip_update'] = trivy_configs.get("skip_update") or False
    config_dict['trivy_skip_java_db_update'] = trivy_configs.get("skip_java_db_update") or False
    config_dict['trivy_db_repository'] = trivy_configs.get("db_repository") or 'ghcr.io/aquasecurity/trivy-db'
    config_dict['trivy_java_db_repository'] = trivy_configs.get("java_db_repository") or 'ghcr.io/aquasecurity/trivy-java-db'
    config_dict['trivy_offline_scan'] = trivy_configs.get("offline_scan") or False
    config_dict['trivy_security_check'] = trivy_configs.get("sec
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
        csrf_key=generate_random_string(32),
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

### Core Architecture Module: `make/photon/prepare/utils/log.py`
```
import os

from g import config_dir, templates_dir, DEFAULT_GID, DEFAULT_UID
from utils.misc import prepare_dir
from utils.jinja import render_jinja

log_config_dir = os.path.join(config_dir, "log")

# logrotate config file
logrotate_template_path = os.path.join(templates_dir, "log", "logrotate.conf.jinja")
log_rotate_config = os.path.join(config_dir, "log", "logrotate.conf")

# syslog docker config file
log_syslog_docker_template_path = os.path.join(templates_dir, 'log', 'rsyslog_docker.conf.jinja')
log_syslog_docker_config = os.path.join(config_dir, 'log', 'rsyslog_docker.conf')

def prepare_log_configs(config_dict):
    prepare_dir(log_config_dir)

    # Render Log config
    render_jinja(
        logrotate_template_path,
        log_rotate_config,
        uid=DEFAULT_UID,
        gid=DEFAULT_GID,
        **config_dict)

   # Render syslog docker config
    render_jinja(
        log_syslog_docker_template_path,
        log_syslog_docker_config,
        uid=DEFAULT_UID,
        gid=DEFAULT_GID,
        **config_dict
   )
```

### Core Architecture Module: `make/photon/prepare/utils/migration.py`
```
import yaml
import click
import importlib
import os
from collections import deque

class MigratioNotFound(Exception): ...

class MigrationVersion:
    '''
    The version used to migration

    Arttribute:
        name(str): version name like `1.0.0`
        module: the python module object for a specific migration which contains migrate info, codes and templates
        down_versions(list): previous versions that can migrated to this version
    '''
    def __init__(self, version: str):
        self.name = version
        self.module = importlib.import_module("migrations.version_{}".format(version.replace(".","_")))

    @property
    def down_versions(self):
        return self.module.down_revisions

def read_conf(path):
    with open(path) as f:
        try:
            d = yaml.safe_load(f)
            # the strong_ssl_ciphers configure item apply to internal and external tls communication
            # for compatibility, user could configure the strong_ssl_ciphers either in https section or under internal_tls section,
            # but it will move to https section after migration
            https_config = d.get("https") or {}
            internal_tls = d.get('internal_tls') or {}
            d['strong_ssl_ciphers'] = https_config.get('strong_ssl_ciphers') or internal_tls.get('strong_ssl_ciphers')
        except Exception as e:
            click.echo("parse config file err, make sure your harbor config version is above 1.8.0", e)
            exit(-1)
    return d

def search(input_version: str, target_version: str) -> list :
    """
    Find the migration path by BFS
    Args:
        input_version(str): The version migration start from
        target_version(str): The target version migrated to
    Returns:
        list: the module of migrations in the upgrade path
    """
    upgrade_path = []
    next_version, visited, q = {}, set(), deque()
    q.append(target_version)
    found = False
    while q: # BFS to find a valid path
        version = MigrationVersion(q.popleft())
        visited.add(version.name)
        if version.name == input_version:
            found = True
            break # break loop cause migration path found
        for v in version.down_versions:
            next_version[v] = version.name
            if v not in (visited.union(q)):
                q.append(v)

    if not found:
        raise MigratioNotFound('no migration path found to target version')

    current_version = MigrationVersion(input_version)
    while current_version.name != target_version:
        current_version = MigrationVersion(next_version[current_version.name])
        upgrade_path.append(current_version)
    return list(map(lambda x: x.module, upgrade_path))
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24037** (2026-10-01): **fix(gc): Use the current registry Redis URL for scheduled runs**
  *Symptoms*: Scheduled GC now takes the registry Redis URL from core's environment when the schedule fires. The URL saved in the schedule row is only a fallback, so schedules created before a Redis move, rename or password change start working again without being re-saved.  When a GC schedule is saved, `kick()` in `src/server/v2.0/handler/gc.go` copies `_REDIS_URL_REG` from core's environment into the schedule parameters, which are stored as JSON in `schedule.callback_func_param`. When the schedule fires, `triggerCallback` reads that row and hands the JSON to `gcCallback`, which calls `Ctl.Start` with it. `Start` passes `extra_attrs.redis_url_reg` to the job as is, and `cleanCache()` in the GC job connects to it. Nothing refreshes the stored value, so after the Redis host, database index or password changes, every scheduled run ends in `Error` with `failed to clean registry cache ... no such host`. Manual GC builds its parameters from the current environment and keeps working, which is why re-saving the schedule was the only workaround.  The fix is in `gcCallback`, the entry point that only scheduled runs go through. It overrides `redis_url_reg` with core's current `_REDIS_URL_REG` before calling `Start`. If the variable is empty it keeps the stored value, so the worst case is the current behaviour. I did not put it in `controller.Start` because manual runs also go through `Start`, and their handler already reads the environment at request time. Keeping it in the callback leaves the manua
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24037?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.94%. Comparing base ([`37dc02f`](https://app.codecov.io/gh/goharbor/harbor/commit/37dc02fdff10f3b93dc4668d3c13b9c104959ed4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`2387ec4`](https://app.codecov.io/gh/goharbor/harbor/commit/2387ec452c749c907a442c9367133f735ec3de0d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/24037/graphs/tree.svg?width=650&height=

- **Issue #24036** (2026-09-30): **feat(portal): Custom project roles UI, with UI fixes on top of #23970**
  *Symptoms*: Builds on #23970 by @Maxlvsx. The first four commits are his, unchanged; the last two are on top.  Not a replacement for #23970 and not competing with it. It exists so the fixes can be reviewed against a running build. If they are wanted on #23970 instead, take the last two commits and close this.  ## UI fixes  - **ACTION dropdown and per-row permissions button rendered a stuck-looking glyph.** Both asked for `shape="caret down"`; Clarity has no icon by that name and the direction is a separate attribute, so the icon never resolved. Now `shape="caret" direction="down"`, like the rest of the portal. - **Built-in tick was invisible.** Coloured with `var(--clr-color-success-700)`, which Harbor does not define, so it inherited the text colour. `--clr-global-success-color` is the token this theme ships. - **Side nav reused the members icon.** `users` is already project members. `employee-group` keeps them apart. - **Heading and nav disagreed:** nav said "Roles", heading said "User Roles". Both say "Roles". - **Wizard forced the permission matrix into a scroll.** Pinned to `clrWizardSize="lg"`, narrower than Clarity's default. Dropping the explicit size gives it full width.  ## CI fixes  UI_UT runs four gates and three were failing.  **`ng lint`: 85 errors.** All formatting except two `console.log` calls that were not meant to ship, one of them held by an `ngAfterViewInit` that existed for nothing else. Both removed.  **`find-missing-i18n.js`: 972 missing keys.** The roles UI added
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24036?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :x: Patch coverage is `34.90566%` with `276 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 66.84%. Comparing base ([`37dc02f`](https://app.codecov.io/gh/goharbor/harbor/commit/37dc02fdff10f3b93dc4668d3c13b9c104959ed4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`4334c22`](https://app.codecov.io/gh/goharbor/harbor/commit/4334c227e32f64564396aeb18463d53bce2579cc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  | [Files with missing lines](https://app.codecov.io/gh/goharbor/harbor/pull/24036?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_c
  > Both fixes are on #23970 itself now, rebased onto its current tip: cf89ac09 (the five UI fixes) and ff4d566c (the four action-button specs, which are what UI_UT was failing on, plus real translations for the new ROLE keys in the nine language files). Nothing left here, so closing rather than stacking another PR on top.

- **Issue #24032** (2026-10-02): **chore(deps): bump ip-address from 10.5.0 to 10.7.2 in /src/portal**
  *Symptoms*: Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.5.0 to 10.7.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/beaugunderson/ip-address/releases">ip-address's releases</a>.</em></p> <blockquote> <h2>v10.7.2</h2> <h2>What's Changed</h2> <ul> <li>Accept an arpa suffix in any case and without the root dot in fromArpa by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/227">beaugunderson/ip-address#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2">https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2</a></p> <h2>v10.7.1</h2> <h2>What's Changed</h2> <ul> <li>Bump js-yaml and brace-expansion in the lockfile by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/226">beaugunderson/ip-address#226</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1">https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1</a></p> <h2>v10.7.0</h2> <h2>What's Changed</h2> <ul> <li>Add offset() and nextNetwork(), accept prefix-length ip6.arpa names, correct the IPv6 end-address docs by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in
  **Post-Mortem & Fix Analysis**:
  > Superseded by #24045.

- **Issue #24022** (2026-09-29): **N+1 database queries during immutable scanner registration removal (`RemoveImmutableScanners`)**
  *Symptoms*:  **Expected behavior and actual behavior:** **Expected:** Removing immutable scanner registrations should be optimized, particularly during initialization steps. It should be performed using a bulk/batch deletion query to minimize database connections, round-trips, and latency. **Actual:** The `RemoveImmutableScanners` function iterates over the fetched `registrations` and executes a single SQL `DELETE` query for every single scanner in the array. This creates a classic N+1 query problem, placing unnecessary load on the database.   This technical debt is explicitly documented in the codebase as a `TODO`, but has not yet been resolved.  **Steps to reproduce the problem:** 1. Navigate to `src/pkg/scan/init.go` in the current `main`/`master` branch. 2. Look at the `RemoveImmutableScanners` function (around line 105). 3. Observe the `TODO` and the looping behavior:    ```go    	// TODO Instead of executing 1 to N SQL queries we might want to delete multiple rows with scannerManager.DeleteByImmutableAndURLIn(true, []string{})    	registrations, err := scannerManager.List(ctx, query)    	if err != nil {    		return errors.Errorf("listing scanners: %v", err)    	}     	for _, reg := range registrations {    		if err := scannerManager.Delete(ctx, reg.UUID); err != nil { // <-- N+1 Query Execution    			return errors.Errorf("deleting scanner: %s: %v", reg.UUID, err)    		}    	}    ```  **Versions:** Please specify the versions of following systems.  - harbor version: [main / latest] 
  **Post-Mortem & Fix Analysis**:
  > this makes no sense, where is it a performance problem in real use cases?  Please reopen if yoou have more information 

- **Issue #24016** (2026-09-28): **Release plan for v2.16.0**
  *Symptoms*: How can we help you?  Is there a target date or milestone for v2.16.0?  We want to move Harbor to arm64 nodes. Official arm64 images come from #22311 (merged to main on 2026-05-12). #23558 confirmed it ships in v2.16.0. v2.15.x images are amd64-only.  A rough timeline, or an RC schedule, would help us plan. Thanks!
  **Post-Mortem & Fix Analysis**:
  > Harbor v2.16.0 will be released by the end of Oct.
  > Thanks @stonezdj! End of October works for our arm64 migration plan.

- **Issue #24014** (2026-09-28): **(cherry-pick): update expected CVE export toast message in Robot test**
  *Symptoms*: Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'. Update the Robot test keyword 'Export CVEs' to expect the updated message.  Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24014?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-2.15.0@583d259`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/24014/graphs/tree.svg?width=650&height=150&src=pr&token=6SOPrJGDVW&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)](https://app.codecov.io/gh/goharbor/harbor/pull/24014?src=pr&el=tree&utm

- **Issue #24010** (2026-09-28): **fix(test): update expected CVE export toast message in Robot test**
  *Symptoms*: Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'. Update the Robot test keyword 'Export CVEs' to expect the updated message.  Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24010?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.82%. Comparing base ([`4067002`](https://app.codecov.io/gh/goharbor/harbor/commit/4067002f889e9298ab5aa4f803b469d79dd9b98d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`7dcb4ee`](https://app.codecov.io/gh/goharbor/harbor/commit/7dcb4eef852463c6a05b54590b6034b9c95e76a3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/

- **Issue #23997** (2026-09-28): **test(apitests): add missing get_member_role_id to project helper**
  *Symptoms*: # Comprehensive Summary of your change In PR https://github.com/goharbor/harbor/pull/23228 (`feat(audit): add member create/update/delete audit events`), `test_audit_log_forward.py` was updated to test member CRUD audit events using `self.project.get_member_role_id()`. However, the helper method `get_member_role_id` was not defined on the `Project` helper class in `tests/apitests/python/library/project.py`, causing `AttributeError: 'Project' object has no attribute 'get_member_role_id'` and failing the BAT/Nightly API tests (e.g. `Test Case - Log Forward`).  This PR adds the missing `get_member_role_id` method to `tests/apitests/python/library/project.py`.  # Issue being fixed Fixes `Test Case - Log Forward` failure in BAT/API DB tests.  Please indicate you've done the following: - [x] Well Written Title and Summary of the PR - [x] Label the PR as needed. "release-note/ignore-for-release" - [x] Accepted the DCO. Commits without the DCO will delay acceptance. - [x] Made sure tests are passing and test coverage is added if needed. - [x] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/23997?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.81%. Comparing base ([`e5e0e72`](https://app.codecov.io/gh/goharbor/harbor/commit/e5e0e72c7455778dbeda45f4cd0db65a9a371705?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`f445cb1`](https://app.codecov.io/gh/goharbor/harbor/commit/f445cb1c2864cbfad45651ed37e05a6757149960?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/23997/graphs/tree.svg?width=650&height=

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

### Incident Patch 1: `f25e9daf` (2026-10-01)
**Commit Message**: fix(gc): Use the current registry Redis URL for scheduled runs (#24037)

Scheduled runs now take the URL from core's current _REDIS_URL_REG and
only fall back to the stored value when the variable is empty. Existing
schedules recover without being saved again.

Fixes #22905

Signed-off-by: Vadim Bauer <[REDACTED_EMAIL]>

**File**: `src/controller/gc/callback.go` (modified, +9/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
+	"os"
 
 	"github.com/goharbor/harbor/src/controller/quota"
 	"github.com/goharbor/harbor/src/jobservice/job"
@@ -48,6 +49,14 @@ func gcCallback(ctx context.Context, p string) error {
 	if err := json.Unmarshal([]byte(p), param); err != nil {
 		return fmt.Errorf("failed to unmarshal the param: %v", err)
 	}
+	// The schedule stores the registry Redis URL from the time it was saved,
+	// which breaks every run once the Redis address or credentials change.
+	if url := os.Getenv("_REDIS_URL_REG"); url != "" {
+		if param.ExtraAttrs == nil {
+			param.ExtraAttrs = make(map[string]any)
+		}
+		param.ExtraAttrs["redis_url_reg"] = url
+	}
 	_, err := Ctl.Start(ctx, *param, task.ExecutionTriggerSchedule)
 	return err
 }
```

**File**: `src/controller/gc/callback_test.go` (modified, +81/-0)
```diff
@@ -8,6 +8,8 @@ import (
 	"github.com/goharbor/harbor/src/pkg/task"
 	"github.com/goharbor/harbor/src/testing/mock"
 	tasktesting "github.com/goharbor/harbor/src/testing/pkg/task"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 )
 
@@ -42,3 +44,82 @@ func (c *callbackTestSuite) TestCheckIn() {
 func TestCallBackTestSuite(t *testing.T) {
 	suite.Run(t, &callbackTestSuite{})
 }
+
+func TestRegistryRedisURLPassedToJob(t *testing.T) {
+	const (
+		oldURL = "redis://old-redis:6379/1"
+		newURL = "redis://new-redis:6379/2"
+	)
+	schedule := func(extraAttrs string) string {
+		return `{"trigger":null,"deleteuntagged":true,"deletetag":false,"dryrun":false,"workers":1,"extra_attrs":` + extraAttrs + `}`
+	}
+
+	cases := []struct {
+		name    string
+		env     string
+		trigger string
+		param   string
+		policy  Policy
+		want    any
+	}{
+		{
+			name:    "scheduled run uses the current env over a stale stored url",
+			env:     newURL,
+			trigger: task.ExecutionTriggerSchedule,
+			param:   schedule(`{"redis_url_reg":"` + oldURL + `","time_window":2}`),
+			want:    newURL,
+		},
+		{
+			name:    "scheduled run falls back to the stored url when env is empty",
+			env:     "",
+			trigger: task.ExecutionTriggerSchedule,
+			param:   schedule(`{"redis_url_reg":"` + oldURL + `","time_window":2}`),
+			want:    oldURL,
+		},
+		{
+			name:    "scheduled run without stored extra attributes uses the current env",
+			env:     newURL,
+			trigger: task.ExecutionTriggerSchedule,
+			param:   schedule(`null`),
+			want:    newURL,
+		},
+		{
+			name:    "manual run passes the url from the policy unchanged",
+			env:     newURL,
+			trigger: task.ExecutionTriggerManual,
+			policy:  Policy{ExtraAttrs: map[string]any{"redis_url_reg": oldURL}},
+			want:    oldURL,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("_REDIS_URL_REG", tc.env)
+
+			execMgr := &tasktesting.ExecutionManager{}
+			taskMgr := &tasktesting.Manager{}
+			var gotTrigger string
+			var gotParams map[string]any
+			execMgr.On("Create", mock.Anything, job.GarbageCollectionVendorType, int64(-1), mock.Anything, mock.Anything).
+				Run(func(args mock.Arguments) { gotTrigger = args.String(3) }).
+				Return(int64(1), nil)
+			taskMgr.On("Create", mock.Anything, int64(1), mock.Anything).
+				Run(func(args mock.Arguments) { gotParams = args.Get(2).(*task.Job).Parameters }).
+				Return(int64(1), nil)
+
+			origCtl := Ctl
+			Ctl = &controller{exeMgr: execMgr, taskMgr: taskMgr}
+			t.Cleanup(func() { Ctl = origCtl })
+
+			var err error
+			if tc.trigger == task.ExecutionTriggerSchedule {
+				err = gcCallback(context.Background(), tc.param)
+			} else {
+				_, err = Ctl.Start(context.Background(), tc.policy, tc.trigger)
+			}
+			require.NoError(t, err)
+			assert.Equal(t, tc.trigger, gotTrigger)
+			assert.Equal(t, tc.want, gotParams["redis_url_reg"])
+		})
+	}
+}
```

---

### Incident Patch 2: `37dc02fd` (2026-09-29)
**Commit Message**: feat: custom project roles (hybrid — built-ins in code, custom in DB) (#23804)

* feat: custom project roles (hybrid — built-ins in code, custom in DB)

Adds admin-defined custom project roles as an alternative to #22815, per
maintainer feedback: built-in project roles keep resolving their permissions
from the compile-time rolePoliciesMap (no DB, no cache — identical to today),
and ONLY custom roles are stored in and loaded from the database. There is no
permission cache.

Backend + API only (UI ships separately). Highlights:
- RBAC (common/rbac/project): projectRBACRole gains an optional custom *role.Role.
  The built-in path is byte-identical to upstream; the role controller is
  consulted only for non-built-in role IDs, so built-in authorization incurs no
  DB lookup. Custom roles expand their DB-loaded permissions.
- Role subsystem: pkg/role (model/dao/manager) + controller/role for CRUD and
  persistence; existing role_permission/permission_policy reused for custom perms.
- REST API: /roles endpoints (sysadmin-gated), an effective-permissions endpoint,
  anti-escalation checks on member/robot assignment, and audit events.
- Migration 0191 adds is_builtin/description/audit colu

**File**: `api/v2.0/swagger.yaml` (modified, +265/-0)
```diff
@@ -3365,6 +3365,162 @@ paths:
           $ref: '#/responses/404'
         '500':
           $ref: '#/responses/500'
+  /roles:
+    get:
+      summary: Get roles
+      description: >-
+        List the roles (built-in and custom) with their permissions. Readable by
+        any authenticated user (e.g. to populate member-role pickers), whereas
+        creating, updating and deleting roles is restricted to system admins.
+      tags:
+        - role
+      operationId: ListRole
+      parameters:
+        - $ref: '#/parameters/requestId'
+        - $ref: '#/parameters/query'
+        - $ref: '#/parameters/sort'
+        - $ref: '#/parameters/page'
+        - $ref: '#/parameters/pageSize'
+      responses:
+        '200':
+          description: Success
+          headers:
+            X-Total-Count:
+              description: The total count of roles
+              type: integer
+            Link:
+              description: Link refers to the previous page and next page
+              type: string
+          schema:
+            type: array
+            items:
+              $ref: '#/definitions/Role'
+        '400':
+          $ref: '#/responses/400'
+        '404':
+          $ref: '#/responses/404'
+        '500':
+          $ref: '#/responses/500'
+    post:
+      summary: Create a role
+      description: Create a role
+      tags:
+        - role
+      operationId: CreateRole
+      parameters:
+        - $ref: '#/parameters/requestId'
+        - name: role
+          in: body
+          description: The JSON object of a role.
+          required: true
+          schema:
+            $ref: '#/definitions/RoleCreate'
+      responses:
+        '201':
+          description: Created
+          headers:
+            X-Request-Id:
+              description: The ID of the corresponding request for the response
+              type: string
+            Location:
+              description: The location of the resource
+              type: string
+          schema:
+            $ref: '#/definitions/RoleCreated'
+        '400':
+          $ref: '#/responses/400'
+        '401':
+          $ref: '#/responses/401'
+        '403':
+          $ref: '#/responses/403'
+        '404':
+          $ref: '#/responses/404'
+        '409':
+          $ref: '#/responses/409'
+        '500':
+          $ref: '#/responses/500'
+
+  /roles/{role_id}:
+    get:
+      summary: Get a role
+      description: >-
+        Returns a role (built-in or custom) with its permissions by role ID.
+        Readable by any authenticated user; creating, updating and deleting roles
+        is restricted to system admins.
+      tags:
+        - role
+      operationId: GetRoleByID
+      parameters:
+        - $ref: '#/parameters/requestId'
+        - $ref: '#/parameters/roleId'
+      responses:
+        '200':
+          description: Return matched role information.
+          schema:
+            $ref: '#/definitions/Role'
+        '401':
+          $ref: '#/responses/401'
+        '403':
+          $ref: '#/responses/403'
+        '404':
+          $ref: '#/responses/404'
+        '500':
+          $ref: '#/responses/500'
+    put:
+      summary: Update a role account
+      description: This endpoint updates specific role information by role ID.
+      tags:
+        - role
+      operationId: UpdateRole
+      parameters:
+        - $ref: '#/parameters/requestId'
+        - $ref: '#/parameters/roleId'
+        - name: role
+          in: body
+          description: The JSON object of a role.
+          required: true
+          schema:
+            $ref: '#/definitions/Role'
+      responses:
+        '200':
+          $ref: '#/responses/200'
+        '400':
+          $ref: '#/responses/400'
+        '401':
+          $ref: '#/responses/401'
+        '403':
+          $ref: '#/responses/403'
+        '404':
+          $ref: '#/responses/404'
+        '409':
+          $ref: '#/responses/409'
+        '500':
+          $ref: '#/responses/500'
+    delete:
+      summary: Delete a role account
+      description: This endpoint deletes specific role information by role ID.
+      tags:
+        - role
+      operationId: DeleteRole
+      parameters:
+        - $ref: '#/parameters/requestId'
+        - $ref: '#/parameters/roleId'
+      responses:
+        '200':
+          $ref: '#/responses/200'
+        '400':
+          $ref: '#/responses/400'
+        '401':
+          $ref: '#/responses/401'
+        '403':
+          $ref: '#/responses/403'
+        '404':
+          $ref: '#/responses/404'
+        '412':
+          $ref: '#/responses/412'
+        '500':
+          $ref: '#/responses/500'
+
   '/quotas':
     get:
       summary: List quotas
@@ -3578,6 +3734,7 @@ paths:
           $ref: '#/responses/404'
         '500':
           $ref: '#/responses/500'
+
   /replication/policies:
     get:
       summary: List replication policies
@@ -6542,6 +6699,12 @@ parameters:
     required: true
     type: integer
     format
```

**File**: `make/migrations/postgresql/0190_2.16.0_schema.up.sql` (modified, +43/-0)
```diff
@@ -19,3 +19,46 @@ ALTER SEQUENCE robot_id_seq AS bigint MAXVALUE 9007199254740991;
 
 CREATE INDEX IF NOT EXISTS idx_sbom_report_sbom_digest
   ON sbom_report (mime_type, ((report::jsonb ->> 'sbom_digest')));
+
+/*
+Custom project roles: schema additions on the existing `role` table.
+
+Built-in role permissions are NOT stored in the database — they are resolved from
+the compile-time rolePoliciesMap in common/rbac/project, so authorization for
+built-in roles incurs no DB lookup. Only custom roles persist their permissions
+(in permission_policy/role_permission).
+*/
+ALTER TABLE role ADD COLUMN IF NOT EXISTS is_builtin   BOOLEAN      NOT NULL DEFAULT FALSE;
+ALTER TABLE role ADD COLUMN IF NOT EXISTS description  TEXT;
+ALTER TABLE role ADD COLUMN IF NOT EXISTS modified     BOOLEAN      NOT NULL DEFAULT FALSE;
+ALTER TABLE role ADD COLUMN IF NOT EXISTS created_by   VARCHAR(255);
+ALTER TABLE role ADD COLUMN IF NOT EXISTS created_at   TIMESTAMP WITH TIME ZONE;
+ALTER TABLE role ADD COLUMN IF NOT EXISTS modified_by  VARCHAR(255);
+ALTER TABLE role ADD COLUMN IF NOT EXISTS modified_at  TIMESTAMP WITH TIME ZONE;
+
+-- Widen the role name to match the API/UI contract (was varchar(20)) and enforce
+-- name uniqueness so custom roles cannot collide. The uniqueness is
+-- case-insensitive (lower(name)) so "Maintainer" and "maintainer" cannot coexist
+-- and be mistaken for one another.
+ALTER TABLE role ALTER COLUMN name TYPE varchar(255);
+DROP INDEX IF EXISTS uq_role_name;
+CREATE UNIQUE INDEX IF NOT EXISTS uq_role_name ON role (lower(name));
+
+-- Mark all roles seeded by migrations as built-in (immutable).
+UPDATE role SET is_builtin = TRUE
+WHERE name IN ('projectAdmin', 'developer', 'guest', 'maintainer', 'limitedGuest');
+
+-- Referential integrity between a project member and its role. ON DELETE RESTRICT
+-- makes the database reject deleting a role that is still assigned to a member,
+-- closing the count-then-delete race in the role Delete controller (a concurrent
+-- member assignment can no longer leave a dangling project_member.role).
+DO $$
+BEGIN
+    IF NOT EXISTS (
+        SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_member_role'
+    ) THEN
+        ALTER TABLE project_member
+            ADD CONSTRAINT fk_project_member_role
+            FOREIGN KEY (role) REFERENCES role (role_id) ON DELETE RESTRICT;
+    END IF;
+END $$;
```

**File**: `src/common/models/base.go` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@ import (
 
 func init() {
 	orm.RegisterModel(
-		new(Role),
 		new(OIDCUser),
 	)
 }
```

**File**: `src/common/models/role.go` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-// Copyright Project Harbor Authors
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//    http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License.
-
-package models
-
-// Role holds the details of a role.
-type Role struct {
-	RoleID   int    `orm:"pk;auto;column(role_id)" json:"role_id"`
-	RoleCode string `orm:"column(role_code)" json:"role_code"`
-	Name     string `orm:"column(name)" json:"role_name"`
-	RoleMask int    `orm:"column(role_mask)" json:"role_mask"`
-}
```

**File**: `src/common/rbac/const.go` (modified, +99/-0)
```diff
@@ -68,6 +68,7 @@ const (
 	ResourceCatalog            = Resource("catalog")
 	ResourceProject            = Resource("project")
 	ResourceUser               = Resource("user")
+	ResourceRole               = Resource("role")
 	ResourceUserGroup          = Resource("user-group")
 	ResourceRegistry           = Resource("registry")
 	ResourceReplication        = Resource("replication")
@@ -88,6 +89,7 @@ type scope string
 const (
 	ScopeSystem  = scope("System")
 	ScopeProject = scope("Project")
+	ScopeRole    = scope("Role")
 )
 
 // RobotPermissionProvider defines the permission provider for robot account
@@ -157,6 +159,10 @@ func (n *NolimitProvider) GetPermissions(s scope) []*types.Policy {
 			&types.Policy{Resource: ResourceMember, Action: ActionList},
 			&types.Policy{Resource: ResourceMember, Action: ActionDelete})
 	}
+	if s == ScopeRole {
+		return n.BaseProvider.GetPermissions(ScopeRole)
+	}
+
 	return []*types.Policy{}
 }
 
@@ -311,5 +317,98 @@ var (
 
 			{Resource: ResourceQuota, Action: ActionRead},
 		},
+		ScopeRole: {
+			{Resource: ResourceMember, Action: ActionCreate},
+			{Resource: ResourceMember, Action: ActionRead},
+			{Resource: ResourceMember, Action: ActionUpdate},
+			{Resource: ResourceMember, Action: ActionDelete},
+			{Resource: ResourceMember, Action: ActionList},
+
+			{Resource: ResourceMetadata, Action: ActionCreate},
+			{Resource: ResourceMetadata, Action: ActionRead},
+			{Resource: ResourceMetadata, Action: ActionUpdate},
+			{Resource: ResourceMetadata, Action: ActionDelete},
+			{Resource: ResourceMetadata, Action: ActionList},
+
+			{Resource: ResourceLog, Action: ActionList},
+
+			{Resource: ResourceLabel, Action: ActionCreate},
+			{Resource: ResourceLabel, Action: ActionRead},
+			{Resource: ResourceLabel, Action: ActionUpdate},
+			{Resource: ResourceLabel, Action: ActionDelete},
+			{Resource: ResourceLabel, Action: ActionList},
+
+			{Resource: ResourceQuota, Action: ActionRead},
+
+			{Resource: ResourceRepository, Action: ActionCreate},
+			{Resource: ResourceRepository, Action: ActionRead},
+			{Resource: ResourceRepository, Action: ActionUpdate},
+			{Resource: ResourceRepository, Action: ActionDelete},
+			{Resource: ResourceRepository, Action: ActionList},
+			{Resource: ResourceRepository, Action: ActionPull},
+			{Resource: ResourceRepository, Action: ActionPush},
+
+			{Resource: ResourceTagRetention, Action: ActionCreate},
+			{Resource: ResourceTagRetention, Action: ActionRead},
+			{Resource: ResourceTagRetention, Action: ActionUpdate},
+			{Resource: ResourceTagRetention, Action: ActionDelete},
+			{Resource: ResourceTagRetention, Action: ActionList},
+			{Resource: ResourceTagRetention, Action: ActionOperate},
+
+			{Resource: ResourceImmutableTag, Action: ActionCreate},
+			{Resource: ResourceImmutableTag, Action: ActionUpdate},
+			{Resource: ResourceImmutableTag, Action: ActionDelete},
+			{Resource: ResourceImmutableTag, Action: ActionList},
+
+			{Resource: ResourceConfiguration, Action: ActionRead},
+			{Resource: ResourceConfiguration, Action: ActionUpdate},
+
+			{Resource: ResourceRobot, Action: ActionCreate},
+			{Resource: ResourceRobot, Action: ActionRead},
+			{Resource: ResourceRobot, Action: ActionUpdate},
+			{Resource: ResourceRobot, Action: ActionDelete},
+			{Resource: ResourceRobot, Action: ActionList},
+
+			{Resource: ResourceNotificationPolicy, Action: ActionCreate},
+			{Resource: ResourceNotificationPolicy, Action: ActionUpdate},
+			{Resource: ResourceNotificationPolicy, Action: ActionDelete},
+			{Resource: ResourceNotificationPolicy, Action: ActionList},
+			{Resource: ResourceNotificationPolicy, Action: ActionRead},
+
+			{Resource: ResourceScan, Action: ActionCreate},
+			{Resource: ResourceScan, Action: ActionRead},
+			{Resource: ResourceScan, Action: ActionStop},
+			{Resource: ResourceSBOM, Action: ActionCreate},
+			{Resource: ResourceSBOM, Action: ActionStop},
+			{Resource: ResourceSBOM, Action: ActionRead},
+
+			{Resource: ResourceScanner, Action: ActionRead},
+			{Resource: ResourceScanner, Action: ActionCreate},
+
+			{Resource: ResourceArtifact, Action: ActionCreate},
+			{Resource: ResourceArtifact, Action: ActionRead},
+			{Resource: ResourceArtifact, Action: ActionDelete},
+			{Resource: ResourceArtifact, Action: ActionList},
+			{Resource: ResourceArtifactAddition, Action: ActionRead},
+
+			{Resource: ResourceTag, Action: ActionList},
+			{Resource: ResourceTag, Action: ActionCreate},
+			{Resource: ResourceTag, Action: ActionDelete},
+
+			{Resource: ResourceAccessory, Action: ActionList},
+
+			{Resource: ResourceArtifactLabel, Action: ActionCreate},
+			{Resource: ResourceArtifactLabel, Action: ActionDelete},
+
+			{Resource: ResourcePreatPolicy, Action: ActionCreate},
+			{Resource: ResourcePreatPolicy, Action: ActionRead},
+			{Resource: ResourcePreatPolicy, Action: ActionUpdate},
+			{Resource: ResourcePreatPolicy, Action: ActionDelete},
+			{Resource: ResourcePreatPolicy, Action: ActionList},
+
```

**File**: `src/common/rbac/project/catalog_test.go` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
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
+package project
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/goharbor/harbor/src/common/rbac"
+	"github.com/goharbor/harbor/src/pkg/permission/types"
+)
+
+// TestScopeRoleCatalogMatchesProjectAdmin guards against drift between the
+// hand-written ScopeRole catalog (common/rbac/const.go) and the projectAdmin
+// built-in role: a custom role's permission ceiling is exactly what a project
+// admin can hold, minus self:{read,update,delete} (project view/edit/delete,
+// which are never selectable custom-role permissions — baseline visibility is
+// granted by membership instead). If a new project resource is added to
+// projectAdmin but forgotten in the ScopeRole catalog (or vice versa), it would
+// silently become ungrantable/over-grantable for custom roles with no compile
+// error; this test fails loudly instead.
+func TestScopeRoleCatalogMatchesProjectAdmin(t *testing.T) {
+	key := func(p *types.Policy) string {
+		return fmt.Sprintf("%s:%s:%s", p.Resource, p.Action, p.Effect)
+	}
+
+	scopeRole := map[string]bool{}
+	for _, p := range rbac.GetPermissionProvider().GetPermissions(rbac.ScopeRole) {
+		scopeRole[key(p)] = true
+	}
+
+	projectAdmin := map[string]bool{}
+	for _, p := range rolePoliciesMap["projectAdmin"] {
+		if p.Resource == rbac.ResourceSelf {
+			continue
+		}
+		projectAdmin[key(p)] = true
+	}
+
+	for k := range projectAdmin {
+		if !scopeRole[k] {
+			t.Errorf("permission %q is in projectAdmin (minus self) but missing from the ScopeRole catalog", k)
+		}
+	}
+	for k := range scopeRole {
+		if !projectAdmin[k] {
+			t.Errorf("permission %q is in the ScopeRole catalog but not in projectAdmin (minus self)", k)
+		}
+	}
+}
```

**File**: `src/common/rbac/project/evaluator.go` (modified, +25/-2)
```diff
@@ -19,6 +19,7 @@ import (
 
 	"github.com/goharbor/harbor/src/common/models"
 	"github.com/goharbor/harbor/src/controller/project"
+	"github.com/goharbor/harbor/src/controller/role"
 	"github.com/goharbor/harbor/src/lib/log"
 	"github.com/goharbor/harbor/src/pkg/permission/evaluator"
 	"github.com/goharbor/harbor/src/pkg/permission/evaluator/namespace"
@@ -31,7 +32,7 @@ import (
 type RBACUserBuilder func(context.Context, *proModels.Project) types.RBACUser
 
 // NewBuilderForUser create a builder for the local user
-func NewBuilderForUser(user *models.User, ctl project.Controller) RBACUserBuilder {
+func NewBuilderForUser(user *models.User, ctl project.Controller, ctlR role.Controller) RBACUserBuilder {
 	return func(ctx context.Context, p *proModels.Project) types.RBACUser {
 		if user == nil {
 			// anonymous access
@@ -41,12 +42,34 @@ func NewBuilderForUser(user *models.User, ctl project.Controller) RBACUserBuilde
 			}
 		}
 
-		roles, err := ctl.ListRoles(ctx, p.ProjectID, user)
+		roleIDs, err := ctl.ListRoles(ctx, p.ProjectID, user)
 		if err != nil {
 			log.Errorf("failed to list roles: %v", err)
 			return nil
 		}
 
+		var roles []*projectRBACRole
+		for _, roleID := range roleIDs {
+			// Built-in roles resolve their policies from the compile-time map
+			// (rolePoliciesMap) — no database lookup, matching pre-feature behavior.
+			if isBuiltinProjectRole(roleID) {
+				roles = append(roles, &projectRBACRole{projectID: p.ProjectID, roleID: roleID})
+				continue
+			}
+			// Custom roles load their permissions from the database. If one role
+			// fails to load (a transient DB error, or a project_member.role that
+			// points at a deleted role), skip just that role rather than returning
+			// nil for the whole rbacUser — dropping the user would strip every other
+			// role they hold in this project, built-ins included, turning a single
+			// bad role into a total denial or a permanent lockout.
+			r, err := ctlR.Get(ctx, int64(roleID), &role.Option{WithPermission: true})
+			if err != nil {
+				log.Errorf("failed to get role %d, skipping it for user %s in project %d: %v", roleID, user.Username, p.ProjectID, err)
+				continue
+			}
+			roles = append(roles, &projectRBACRole{projectID: p.ProjectID, roleID: roleID, custom: r})
+		}
+
 		return &rbacUser{
 			project:      p,
 			username:     user.Username,
```

**File**: `src/common/rbac/project/evaluator_test.go` (modified, +142/-6)
```diff
@@ -19,15 +19,56 @@ import (
 	"testing"
 
 	"github.com/stretchr/testify/assert"
+	testifymock "github.com/stretchr/testify/mock"
 
 	"github.com/goharbor/harbor/src/common"
 	"github.com/goharbor/harbor/src/common/models"
 	"github.com/goharbor/harbor/src/common/rbac"
+	roleCtl "github.com/goharbor/harbor/src/controller/role"
+	"github.com/goharbor/harbor/src/lib/q"
+	"github.com/goharbor/harbor/src/pkg/permission/types"
 	proModels "github.com/goharbor/harbor/src/pkg/project/models"
 	projecttesting "github.com/goharbor/harbor/src/testing/controller/project"
 	"github.com/goharbor/harbor/src/testing/mock"
 )
 
+// stubRoleCtl implements roleCtl.Controller for tests.
+// Only Get() needs real behaviour; all other methods are no-ops.
+type stubRoleCtl struct {
+	testifymock.Mock
+}
+
+func (s *stubRoleCtl) Get(ctx context.Context, id int64, option *roleCtl.Option) (*roleCtl.Role, error) {
+	args := s.Called(ctx, id, option)
+	r, _ := args.Get(0).(*roleCtl.Role)
+	return r, args.Error(1)
+}
+func (s *stubRoleCtl) Create(ctx context.Context, r *roleCtl.Role) (int64, error) { return 0, nil }
+func (s *stubRoleCtl) Delete(ctx context.Context, id int64, opt ...*roleCtl.Option) error {
+	return nil
+}
+func (s *stubRoleCtl) Update(ctx context.Context, r *roleCtl.Role, opt *roleCtl.Option) error {
+	return nil
+}
+func (s *stubRoleCtl) List(ctx context.Context, query *q.Query, opt *roleCtl.Option) ([]*roleCtl.Role, error) {
+	return nil, nil
+}
+func (s *stubRoleCtl) Count(ctx context.Context, query *q.Query) (int64, error) { return 0, nil }
+
+// customRole returns a *roleCtl.Role carrying the given project-scoped accesses,
+// as the DB-backed role controller would return for a custom role.
+func customRole(name string, access ...*types.Policy) *roleCtl.Role {
+	r := &roleCtl.Role{
+		Permissions: []*roleCtl.Permission{{
+			Kind:      roleCtl.LEVELROLE,
+			Namespace: "*",
+			Access:    access,
+		}},
+	}
+	r.Name = name
+	return r
+}
+
 var (
 	public = &proModels.Project{
 		ProjectID: 1,
@@ -54,22 +95,24 @@ func TestAnonymousAccess(t *testing.T) {
 	{
 		// anonymous to access public project
 		ctl := &projecttesting.Controller{}
+		ctl_r := &stubRoleCtl{}
 		mock.OnAnything(ctl, "Get").Return(public, nil)
 
 		resource := NewNamespace(public.ProjectID).Resource(rbac.ResourceRepository)
 
-		evaluator := NewEvaluator(ctl, NewBuilderForUser(nil, ctl))
+		evaluator := NewEvaluator(ctl, NewBuilderForUser(nil, ctl, ctl_r))
 		assert.True(evaluator.HasPermission(context.TODO(), resource, rbac.ActionPull))
 	}
 
 	{
 		// anonymous to access private project
 		ctl := &projecttesting.Controller{}
+		ctl_r := &stubRoleCtl{}
 		mock.OnAnything(ctl, "Get").Return(private, nil)
 
 		resource := NewNamespace(private.ProjectID).Resource(rbac.ResourceRepository)
 
-		evaluator := NewEvaluator(ctl, NewBuilderForUser(nil, ctl))
+		evaluator := NewEvaluator(ctl, NewBuilderForUser(nil, ctl, ctl_r))
 		assert.False(evaluator.HasPermission(context.TODO(), resource, rbac.ActionPull))
 	}
 }
@@ -79,43 +122,135 @@ func TestProjectRoleAccess(t *testing.T) {
 
 	{
 		ctl := &projecttesting.Controller{}
+		ctl_r := &stubRoleCtl{}
 		mock.OnAnything(ctl, "Get").Return(public, nil)
 		mock.OnAnything(ctl, "ListRoles").Return([]int{common.RoleProjectAdmin}, nil)
 
 		user := &models.User{
 			UserID:   1,
 			Username: "username",
 		}
-		evaluator := NewEvaluator(ctl, NewBuilderForUser(user, ctl))
+		evaluator := NewEvaluator(ctl, NewBuilderForUser(user, ctl, ctl_r))
 		resource := NewNamespace(public.ProjectID).Resource(rbac.ResourceRepository)
 		assert.True(evaluator.HasPermission(context.TODO(), resource, rbac.ActionPush))
+		// built-in roles resolve from the compile-time map — no DB lookup
+		ctl_r.AssertNotCalled(t, "Get")
 	}
 
 	{
 		ctl := &projecttesting.Controller{}
+		ctl_r := &stubRoleCtl{}
 		mock.OnAnything(ctl, "Get").Return(public, nil)
 		mock.OnAnything(ctl, "ListRoles").Return([]int{common.RoleGuest}, nil)
 
 		user := &models.User{
 			UserID:   1,
 			Username: "username",
 		}
-		evaluator := NewEvaluator(ctl, NewBuilderForUser(user, ctl))
+		evaluator := NewEvaluator(ctl, NewBuilderForUser(user, ctl, ctl_r))
+		resource := NewNamespace(public.ProjectID).Resource(rbac.ResourceRepository)
+		assert.False(evaluator.HasPermission(context.TODO(), resource, rbac.ActionPush))
+		ctl_r.AssertNotCalled(t, "Get")
+	}
+}
+
+func TestCustomProjectRoleAccess(t *testing.T) {
+	assert := assert.New(t)
+	user := &models.User{
+		UserID:   1,
+		Username: "username",
+	}
+	const customRoleID = 100 // any ID outside the built-in range (1-5)
+
+	{
+		// a custom role granting repository:push is loaded from the DB controller
+		ctl := &projecttesting.Controller{}
+		ctl_r := &stubRoleCtl{}
+		mock.OnAnything(ctl, "Get").Return(public, nil)
+		mock.OnAnything(ctl, "ListRoles").Return([]int{customRoleID}, nil)
+		ctl_r.On("Get", testifymock.Anything, int64(customRoleID), testifymock.Anything).
+			Return(customRole("pusher", &type
```

---

### Incident Patch 3: `d3e2ad0a` (2026-09-28)
**Commit Message**: fix(test): update expected CVE export toast message in Robot test (#24010)

Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS
from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'.
Update the Robot test keyword 'Export CVEs' to expect the updated message.

Signed-off-by: stonezdj <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `tests/resources/Harbor-Pages/Project.robot` (modified, +1/-1)
```diff
@@ -454,7 +454,7 @@ Export CVEs
     Retry Text Input  ${export_cve_filter_tag_input}  ${tags}
     Select Filter Label For CVE Export  @{labels}
     Retry Text Input  ${export_cve_filter_cveid_input}  ${cve_ids}
-    Retry Double Keywords When Error  Retry Button Click  ${export_btn}  Retry Wait Until Page Contains  Trigger exporting CVEs successfully!
+    Retry Double Keywords When Error  Retry Button Click  ${export_btn}  Retry Wait Until Page Contains  Triggered exporting CVEs successfully!
 
 Should Not Be Export CVEs
      Retry Element Click  ${project_action_xpath}
```

---

### Incident Patch 4: `3d699857` (2026-09-28)
**Commit Message**: fix(portal): update label and tooltip of serve stale content option (#23978)

The proxy cache backend always serves local content when the upstream
registry is unhealthy, so the "upstream registry is unavailable" wording
in the tooltip is misleading. Rename the checkbox to "Serve stale content
locally" and drop the unavailable-upstream description in all locales.

Fixes #23779

Signed-off-by: stonezdj <[REDACTED_EMAIL]>

**File**: `src/portal/src/i18n/lang/de-de-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "Die maximale Anzahl der Verbindungen zur Upstream-Registry für dieses Proxy-Cache-Projekt. -1 bedeutet keine Begrenzung",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Bitte geben Sie -1 oder eine Ganzzahl größer als 0 ein.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Bitte geben Sie -1 oder eine Ganzzahl größer als 0 ein.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Veraltete Inhalte bereitstellen, wenn der Upstream nicht verfügbar ist",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Aktivieren Sie diese Option, damit dieses Projekt weiterhin zwischengespeicherte Inhalte bereitstellt, auch wenn das Artefakt im Upstream-Registry nicht gefunden wird oder das Upstream-Registry nicht verfügbar ist. Dies kann dazu führen, dass veraltete Inhalte bereitgestellt werden, wenn das Upstream-Registry nicht verfügbar ist.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Veraltete Inhalte lokal bereitstellen",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Aktivieren Sie diese Option, damit dieses Projekt weiterhin zwischengespeicherte Inhalte bereitstellt, auch wenn das Artefakt im Upstream-Registry nicht gefunden wird. Dies kann dazu führen, dass veraltete Inhalte bereitgestellt werden.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Repository-Filter",
```

**File**: `src/portal/src/i18n/lang/en-us-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "The max connection to the upstream registry for this proxy cache project, if -1, then there is no limit",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Please enter -1 or an integer greater than 0. ",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Please enter -1 or an integer greater than 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Serve stale content when upstream is unavailable",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Enable this to allow this project to keep serving cached content even if the artifact is not found in the upstream registry or the upstream registry is unavailable. This can lead to stale content being served if the upstream registry is unavailable.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Serve stale content locally",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Enable this to allow this project to keep serving cached content even if the artifact is not found in the upstream registry. This can lead to stale content being served.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Repository filter",
```

**File**: `src/portal/src/i18n/lang/es-es-lang.json` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "La conexión máxima al registro de origen para este proyecto de caché de proxy, si es -1, entonces no hay límite",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Por favor, ingrese -1 o un número entero mayor que 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Por favor, ingrese -1 o un número entero mayor que 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir contenido en caché cuando el registro de origen no está disponible",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opción para permitir que este proyecto continúe sirviendo contenido en caché incluso si el artefacto no se encuentra en el registro de origen o si el registro de origen no está disponible. Esto puede provocar que se sirva contenido obsoleto si el registro de origen no está disponible.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir contenido obsoleto localmente",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opción para permitir que este proyecto continúe sirviendo contenido en caché incluso si el artefacto no se encuentra en el registro de origen. Esto puede provocar que se sirva contenido obsoleto.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Filtro de repositorio",
```

**File**: `src/portal/src/i18n/lang/fr-fr-lang.json` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "La connexion maximale au registre en amont pour ce projet de cache proxy, si -1, alors il n'y a pas de limite",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Veuillez entrer -1 ou un entier supérieur à 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Veuillez entrer -1 ou un entier supérieur à 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir le contenu mis en cache lorsque le registre amont est indisponible",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Activez cette option pour permettre à ce projet de continuer à servir le contenu mis en cache même si l'artefact n'est pas trouvé dans le registre amont ou si le registre amont est indisponible. Cela peut entraîner la diffusion de contenu obsolète si le registre amont est indisponible.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir le contenu obsolète localement",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Activez cette option pour permettre à ce projet de continuer à servir le contenu mis en cache même si l'artefact n'est pas trouvé dans le registre amont. Cela peut entraîner la diffusion de contenu obsolète.",
         "PROXY_REFERRER_API_TIP": "Cochez cette case pour activer le proxy des requêtes de l'API referrer OCI 1.1 vers le registre en amont.",
         "PROXY_REFERRER_API_LABEL": "Activer le proxy pour l'API referrer",
         "REPOSITORY_FILTER": "Filtre de dépôt",
```

**File**: `src/portal/src/i18n/lang/ko-kr-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "이 프록시 캐시 프로젝트의 업스트림 레지스트리에 대한 최대 연결 수입니다. -1이면 제한이 없습니다",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "-1 또는 0보다 큰 정수를 입력하세요.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "-1 또는 0보다 큰 정수를 입력하세요.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "업스트림을 사용할 수 없을 때 캐시된 콘텐츠 제공",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "업스트림 레지스트리에서 아티팩트를 찾을 수 없거나 업스트림 레지스트리를 사용할 수 없는 경우에도 이 프로젝트가 캐시된 콘텐츠를 계속 제공할 수 있도록 하려면 이 옵션을 활성화하세요. 업스트림 레지스트리를 사용할 수 없는 경우 오래된 콘텐츠가 제공될 수 있습니다.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "오래된 콘텐츠를 로컬에서 제공",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "업스트림 레지스트리에서 아티팩트를 찾을 수 없는 경우에도 이 프로젝트가 캐시된 콘텐츠를 계속 제공할 수 있도록 하려면 이 옵션을 활성화하세요. 이로 인해 오래된 콘텐츠가 제공될 수 있습니다.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "저장소 필터",
```

**File**: `src/portal/src/i18n/lang/pt-br-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "A conexão máxima ao repositório remoto para este projeto de cache proxy, se -1, então não há limite",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Por favor, insira -1 ou um número inteiro maior que 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Por favor, insira -1 ou um número inteiro maior que 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir conteúdo em cache quando o registro upstream estiver indisponível",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opção para permitir que este projeto continue servindo conteúdo em cache mesmo se o artefato não for encontrado no registro upstream ou se o registro upstream estiver indisponível. Isso pode resultar em conteúdo desatualizado sendo servido se o registro upstream estiver indisponível.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir conteúdo desatualizado localmente",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opção para permitir que este projeto continue servindo conteúdo em cache mesmo se o artefato não for encontrado no registro upstream. Isso pode resultar em conteúdo desatualizado sendo servido.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Filtro de repositório",
```

**File**: `src/portal/src/i18n/lang/ru-ru-lang.json` (modified, +4/-4)
```diff
@@ -421,8 +421,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "Максимальное соединение с вышестоящим реестром для этого прокси-кэш проекта, если -1, то ограничения нет",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Пожалуйста, введите -1 или целое число больше 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Пожалуйста, введите -1 или целое число больше 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Отдавать кэшированный контент при недоступности вышестоящего реестра",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Включите эту опцию, чтобы разрешить проекту продолжать отдавать кэшированный контент, даже если артефакт не найден в вышестоящем реестре или вышестоящий реестр недоступен. Это может привести к отдаче устаревшего контента, если вышестоящий реестр недоступен.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Отдавать устаревший контент локально",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Включите эту опцию, чтобы разрешить проекту продолжать отдавать кэшированный контент, даже если артефакт не найден в вышестоящем реестре. Это может привести к отдаче устаревшего контента.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API"
     },
@@ -1491,8 +1491,8 @@
     "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "Макс. соединений к первичному реестру для этого прокси-кэш проекта, если '-1', то ограничений нет",
     "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Введите -1 или целое число больше 0.",
     "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Введите -1 или целое число больше 0.",
-    "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Отдавать кэшированный контент при недоступности вышестоящего реестра",
-    "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Включите эту опцию, чтобы разрешить проекту продолжать отдавать кэшированный контент, даже если артефакт не найден в вышестоящем реестре или вышестоящий реестр недоступен. Это может привести к отдаче устаревшего контента, если вышестоящий реестр недоступен.",
+    "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Отдавать устаревший контент локально",
+    "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Включите эту опцию, чтобы разрешить проекту продолжать отдавать кэшированный контент, даже если артефакт не найден в вышестоящем реестре. Это может привести к отдаче устаревшего контента.",
     "NO_PROJECT": "Мы не смогли найти никаких проектов!",
     "PROXY_REFERRER_API_TIP": "Установите этот флаг, чтобы включить прокси для запроса OCI 1.1 ссылающиеся API к первичному реестру.",
     "PROXY_REFERRER_API_LABEL": "Включить прокси для ссылающиеся API",
```

**File**: `src/portal/src/i18n/lang/tr-tr-lang.json` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "Bu proxy önbellek projesi için üst kayıt defterine maksimum bağlantı, -1 ise sınır yoktur",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Lütfen -1 veya 0'dan büyük bir tam sayı girin.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Lütfen -1 veya 0'dan büyük bir tam sayı girin.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Üst kaynak kullanılamadığında önbelleğe alınmış içeriği sun",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Bu projenin, yapıt üst kayıt defterinde bulunamasa veya üst kayıt defteri kullanılamasa bile önbelleğe alınmış içeriği sunmaya devam etmesine izin vermek için bunu etkinleştirin. Üst kayıt defteri kullanılamıyorsa bu, eski içeriğin sunulmasına yol açabilir.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Eski içeriği yerel olarak sun",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Bu projenin, yapıt üst kayıt defterinde bulunamasa bile önbelleğe alınmış içeriği sunmaya devam etmesine izin vermek için bunu etkinleştirin. Bu, eski içeriğin sunulmasına yol açabilir.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Depo filtresi",
```

---

### Incident Patch 5: `e5e0e72c` (2026-09-24)
**Commit Message**: fix(retention): drop retention_id metadata on project delete (#23942)

DeleteRetentionByProject removes a project's tag retention policies but
left the project_metadata row holding retention_id behind, so every
deleted project that had a retention policy leaked a dangling reference
to a policy that no longer exists. One reported instance had accumulated
3189 such rows.

The retention DELETE API already clears this key in its own handler;
project deletion is the path that missed it. Clear it in
DeleteRetentionByProject once the policies are gone, using the shared
pkg.ProjectMetaMgr so the Redis-cached manager invalidates its entry too.

Closes #17255

Signed-off-by: waris shaikh <[REDACTED_EMAIL]>
Co-authored-by: waris shaikh <[REDACTED_EMAIL]>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>
Co-authored-by: Chlins Zhang <[REDACTED_EMAIL]>

**File**: `src/controller/retention/controller.go` (modified, +6/-1)
```diff
@@ -29,6 +29,7 @@ import (
 	"github.com/goharbor/harbor/src/lib/retry"
 	"github.com/goharbor/harbor/src/pkg"
 	"github.com/goharbor/harbor/src/pkg/project"
+	"github.com/goharbor/harbor/src/pkg/project/metadata"
 	"github.com/goharbor/harbor/src/pkg/repository"
 	"github.com/goharbor/harbor/src/pkg/retention"
 	"github.com/goharbor/harbor/src/pkg/retention/policy"
@@ -79,6 +80,7 @@ type defaultController struct {
 	taskMgr        task.Manager
 	launcher       retention.Launcher
 	projectManager project.Manager
+	projectMetaMgr metadata.Manager
 	repositoryMgr  repository.Manager
 	scheduler      scheduler.Scheduler
 	wp             *lib.WorkerPool
@@ -445,7 +447,9 @@ func (r *defaultController) DeleteRetentionByProject(ctx context.Context, projec
 			return err
 		}
 	}
-	return nil
+	// the retention_id metadata references the policies just deleted. The retention DELETE
+	// API drops it in its own handler, so project deletion has to do it here.
+	return r.projectMetaMgr.Delete(ctx, projectID, "retention_id")
 }
 
 // NewController ...
@@ -458,6 +462,7 @@ func NewController() Controller {
 		taskMgr:        task.Mgr,
 		launcher:       retentionLauncher,
 		projectManager: pkg.ProjectMgr,
+		projectMetaMgr: pkg.ProjectMetaMgr,
 		repositoryMgr:  pkg.RepositoryMgr,
 		scheduler:      scheduler.Sched,
 		wp:             lib.NewWorkerPool(10),
```

**File**: `src/controller/retention/controller_test.go` (modified, +72/-0)
```diff
@@ -35,6 +35,7 @@ import (
 	"github.com/goharbor/harbor/src/pkg/scheduler"
 	"github.com/goharbor/harbor/src/pkg/task"
 	"github.com/goharbor/harbor/src/testing/pkg/project"
+	testingMeta "github.com/goharbor/harbor/src/testing/pkg/project/metadata"
 	"github.com/goharbor/harbor/src/testing/pkg/repository"
 	testingTask "github.com/goharbor/harbor/src/testing/pkg/task"
 )
@@ -196,6 +197,77 @@ func (s *ControllerTestSuite) TestPolicy() {
 	s.Require().Nil(p1)
 }
 
+func (s *ControllerTestSuite) TestDeleteRetentionByProject() {
+	const projectID = int64(2)
+
+	projectMetaMgr := &testingMeta.Manager{}
+	execMgr := &testingTask.ExecutionManager{}
+	execMgr.On("List", mock.Anything, mock.Anything).Return([]*task.Execution{}, nil)
+	projectMetaMgr.On("Delete", mock.Anything, projectID, "retention_id").Return(nil)
+
+	c := defaultController{
+		manager:        retention.NewManager(),
+		execMgr:        execMgr,
+		taskMgr:        &testingTask.Manager{},
+		launcher:       &fakeLauncher{},
+		projectManager: &project.Manager{},
+		projectMetaMgr: projectMetaMgr,
+		repositoryMgr:  &repository.Manager{},
+		scheduler:      &fakeRetentionScheduler{},
+	}
+
+	ctx := orm.Context()
+	id, err := c.CreateRetention(ctx, &policy.Metadata{
+		Algorithm: "or",
+		Rules: []rule.Metadata{
+			{
+				ID:       1,
+				Priority: 1,
+				Template: "latestPushedK",
+				Parameters: rule.Parameters{
+					"latestPushedK": 10,
+				},
+				TagSelectors: []*rule.Selector{
+					{
+						Kind:       "doublestar",
+						Decoration: "matches",
+						Pattern:    "**",
+					},
+				},
+				ScopeSelectors: map[string][]*rule.Selector{
+					"repository": {
+						{
+							Kind:       "doublestar",
+							Decoration: "matches",
+							Pattern:    ".+",
+						},
+					},
+				},
+			},
+		},
+		Trigger: &policy.Trigger{
+			Kind: "Schedule",
+			Settings: map[string]any{
+				"cron": "0 22 11 * * *",
+			},
+		},
+		Scope: &policy.Scope{
+			Level:     "project",
+			Reference: projectID,
+		},
+	})
+	s.Require().Nil(err)
+	s.Require().True(id > 0)
+
+	s.Require().Nil(c.DeleteRetentionByProject(ctx, projectID))
+
+	p, err := c.GetRetention(ctx, id)
+	s.Require().NotNil(err)
+	s.Require().Nil(p)
+
+	projectMetaMgr.AssertCalled(s.T(), "Delete", mock.Anything, projectID, "retention_id")
+}
+
 func (s *ControllerTestSuite) TestExecution() {
 	projectMgr := &project.Manager{}
 	repositoryMgr := &repository.Manager{}
```

---

### Incident Patch 6: `ab9e0805` (2026-09-22)
**Commit Message**: fix: correct grammar, formatting, and non-actionable error messages (#23974)

Fix misspellings, grammatical errors, and formatting defects in
user-facing strings across API error responses, middleware, core,
and the portal English i18n.

Signed-off-by: jUDASmILE <[REDACTED_EMAIL]>
Co-authored-by: Wang Yan <[REDACTED_EMAIL]>

**File**: `src/core/controllers/base.go` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ func (cc *CommonController) UserExists() {
 	securityCtx, ok := security.FromContext(ctx)
 	isAdmin := ok && securityCtx.IsSysAdmin()
 	if !flag && !isAdmin {
-		cc.CustomAbort(http.StatusPreconditionFailed, "self registration deactivated, only sysadmin can check user existence")
+		cc.CustomAbort(http.StatusPreconditionFailed, "Self-registration is deactivated; only a system administrator can check user existence.")
 	}
 
 	target := cc.GetString("target")
```

**File**: `src/core/controllers/oidc.go` (modified, +2/-2)
```diff
@@ -266,8 +266,8 @@ func (oc *OIDCController) RedirectLogout() {
 		return
 	}
 	if oidcSettings == nil {
-		log.Error("OIDC settings is missing.")
-		oc.SendInternalServerError(fmt.Errorf("OIDC settings is missing"))
+		log.Error("OIDC settings are missing.")
+		oc.SendInternalServerError(fmt.Errorf("OIDC settings are missing"))
 		return
 	}
 	if !oidcSettings.Logout {
```

**File**: `src/jobservice/worker/cworker/c_worker.go` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ func (w *basicWorker) Enqueue(jobName string, params job.Parameters, isUnique bo
 
 	// avoid backend worker bug
 	if j == nil {
-		return nil, fmt.Errorf("job '%s' can not be enqueued, please check the job metatdata", jobName)
+		return nil, fmt.Errorf("job '%s' cannot be enqueued; please check the job metadata", jobName)
 	}
 
 	return generateResult(j, job.KindGeneric, isUnique, params, webHook), nil
@@ -242,7 +242,7 @@ func (w *basicWorker) Schedule(jobName string, params job.Parameters, runAfterSe
 
 	// avoid backend worker bug
 	if j == nil {
-		return nil, fmt.Errorf("job '%s' can not be enqueued, please check the job metatdata", jobName)
+		return nil, fmt.Errorf("job '%s' cannot be enqueued; please check the job metadata", jobName)
 	}
 
 	res := generateResult(j.Job, job.KindScheduled, isUnique, params, webHook)
```

**File**: `src/lib/config/metadata/value.go` (modified, +2/-2)
```diff
@@ -25,13 +25,13 @@ var (
 	// ErrNotDefined ...
 	ErrNotDefined = errors.New("configure item is not defined in metadata")
 	// ErrTypeNotMatch ...
-	ErrTypeNotMatch = errors.New("the required value doesn't matched with metadata defined")
+	ErrTypeNotMatch = errors.New("The required value does not match the metadata definition")
 	// ErrInvalidData ...
 	ErrInvalidData = errors.New("the data provided is invalid")
 	// ErrValueNotSet ...
 	ErrValueNotSet = errors.New("the configure value is not set")
 	// ErrStringValueIsEmpty ...
-	ErrStringValueIsEmpty = errors.New("the configure value can not be empty")
+	ErrStringValueIsEmpty = errors.New("The configuration value cannot be empty")
 )
 
 // ConfigureValue - struct to hold a actual value, also include the name of config metadata.
```

**File**: `src/portal/src/i18n/lang/en-us-lang.json` (modified, +14/-14)
```diff
@@ -319,7 +319,7 @@
         "GROUP_TYPE": "Group",
         "USER_TYPE": "User",
         "USERNAME_IS_REQUIRED": "Username is required",
-        "USERNAME_ALREADY_EXISTS": "Username has been already added to this project",
+        "USERNAME_ALREADY_EXISTS": "Username has already been added to this project.",
         "UNKNOWN_ERROR": "Unknown error occurred while adding member",
         "FILTER_PLACEHOLDER": "Filter Members",
         "DELETION_TITLE": "Confirm project members deletion",
@@ -1255,7 +1255,7 @@
     },
     "RETAG": {
         "MSG_SUCCESS": "Copy artifact successfully",
-        "TIP_REPO": "A repository name is broken up into path components. A component of a repository name must be at least one lowercase, alpha-numeric characters, optionally separated by periods, dashes or underscores. More strictly, it must match the regular expression [a-z0-9]+(?:[._-][a-z0-9]+)*. If a repository name has two or more path components, they must be separated by a forward slash ('/'). The total length of a repository name, including slashes, must be less than 256 characters.",
+        "TIP_REPO": "A repository name is broken up into path components. A component of a repository name must be at least one lowercase, alphanumeric character, optionally separated by periods, dashes or underscores. More strictly, it must match the regular expression [a-z0-9]+(?:[._-][a-z0-9]+)*. If a repository name has two or more path components, they must be separated by a forward slash ('/'). The total length of a repository name, including slashes, must be less than 256 characters.",
         "TIP_TAG": "A tag is a label applied to a Docker image in a repository. Tags are how various images in a repository are distinguished from each other. It needs to match regex: (`[\\w][\\w.-]{0,127}`)"
     },
     "CVE_ALLOWLIST": {
@@ -1317,7 +1317,7 @@
         "UNIT_COUNT": "COUNT",
         "NUMBER": "NUMBER",
         "IN_REPOSITORIES": "For the repositories",
-        "REP_SEPARATOR": "Enter multiple comma separated repos,repo*,or **",
+        "REP_SEPARATOR": "Enter multiple comma-separated repos: repo, repo*, or **.",
         "TAGS": "Tags",
         "UNTAGGED": " untagged",
         "INCLUDE_UNTAGGED": " untagged artifacts",
@@ -1380,9 +1380,9 @@
         "ADD_TITLE": "Add Tag Immutability Rule",
         "ADD_SUBTITLE": "Specify a tag immutability rule for this project.  Note: all tag immutability rules are first independently calculated and then unioned to capture the final set of immutable tags.",
         "IN_REPOSITORIES": "For the repositories",
-        "REP_SEPARATOR": "Enter multiple comma separated repos,repo*,or **",
+        "REP_SEPARATOR": "Enter multiple comma-separated repos: repo, repo*, or **.",
         "TAGS": "Tags",
-        "TAG_SEPARATOR": "Enter multiple comma separated tags,tag*,or **.",
+        "TAG_SEPARATOR": "Enter multiple comma-separated tags: tag, tag*, or **.",
         "EDIT_TITLE": "Edit Tag Immutability Rule",
         "EXC": " excluding ",
         "MAT": " matching ",
@@ -1409,8 +1409,8 @@
         "NOT_SUPPORTED": "Not Supported",
         "ENDPOINT": "Endpoint",
         "ENDPOINT_EXISTS": "EndpointUrl already exists",
-        "ENDPOINT_REQUIRED": "EndpointUrl is required",
-        "ILLEGAL_ENDPOINT": "EndpointUrl is illegal",
+        "ENDPOINT_REQUIRED": "Endpoint URL is required.",
+        "ILLEGAL_ENDPOINT": "Endpoint URL is invalid.",
         "AUTH": "Authorization",
         "NONE": "None",
         "BASIC": "Basic",
@@ -1444,7 +1444,7 @@
         "SET_AS_DEFAULT": "SET AS DEFAULT",
         "HEALTH": "Health",
         "DISABLED": "Deactivated",
-        "NO_SCANNER": "Can not find any scanner",
+        "NO_SCANNER": "Cannot find any scanner.",
         "DEFAULT": "Default",
         "HEALTHY": "Healthy",
         "UNHEALTHY": "Unhealthy",
@@ -1486,7 +1486,7 @@
         "ENABLE_ACTION": "Enable",
         "DISABLE_ACTION": "Deactivate",
         "DELETE_ACTION": "Delete",
-        "NOT_FOUND": "We couldn't find any instance!",
+        "NOT_FOUND": "We couldn't find any instances!",
         "NAME": "Name",
         "ENDPOINT": "Endpoint",
         "STATUS": "Status",
@@ -1582,15 +1582,15 @@
         "STOP_SUMMARY": "Do you want to stop executing the policy {{param}}?",
         "STOP_SUCCESSFULLY": "Stopped execution successfully",
         "STATUS_MSG": "Status Message",
-        "JOB_PLACEHOLDER": "We couldn't find any execution",
+        "JOB_PLACEHOLDER": "We couldn't find any executions!",
         "PROVIDER_TYPE": "Vendor",
         "ID": "Execution ID",
         "NO_PROVIDER": "Please add a provider first",
         "ARTIFACT": "Artifact",
         "DIGEST": "Digest",
         "TYPE": "Type",
         "TASKS": "Tasks",
-        "TASKS_PLACEHOLDER": "We couldn't find any task",
+        "TASKS_PLACEHOLDER": "We couldn't find any tasks!",
         "SEVERITY_WARNING": "Vulnerability settings here conflict with the relevant project configuration that will overrid
```

**File**: `src/server/middleware/quota/quota.go` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ func RequestMiddleware(config RequestConfig, skippers ...middleware.Skipper) fun
 		logger := log.G(r.Context()).WithFields(log.Fields{"middleware": "quota", "action": "request", "url": r.URL.Path})
 
 		if config.ReferenceObject == nil || config.Resources == nil {
-			lib_http.SendError(w, fmt.Errorf("invald config the for middleware"))
+			lib_http.SendError(w, fmt.Errorf("invalid configuration for the middleware"))
 			return
 		}
 
@@ -198,7 +198,7 @@ func RefreshMiddleware(config RefreshConfig, skipers ...middleware.Skipper) func
 		}
 
 		if config.ReferenceObject == nil {
-			return fmt.Errorf("invald config the for middleware")
+			return fmt.Errorf("invalid configuration for the middleware")
 		}
 
 		logger := log.G(r.Context()).WithFields(log.Fields{"middleware": "quota", "action": "refresh", "url": r.URL.Path})
```

**File**: `src/server/middleware/quota/util.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func projectReferenceObject(r *http.Request) (string, string, error) {
 	projectName := util.ParseProjectName(r)
 
 	if projectName == "" {
-		return "", "", fmt.Errorf("request %s not match any project", r.URL.Path)
+		return "", "", fmt.Errorf("request %s does not match any project", r.URL.Path)
 	}
 
 	project, err := projectController.GetByName(r.Context(), projectName)
```

**File**: `src/server/middleware/readonly/readonly.go` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ func MiddlewareWithConfig(config Config, skippers ...middleware.Skipper) func(ht
 
 	return middleware.New(func(w http.ResponseWriter, r *http.Request, next http.Handler) {
 		if config.ReadOnly(r) {
-			pkgE := errors.New(nil).WithCode(errors.DENIED).WithMessage("The system is in read only mode. Any modification is prohibited.")
+			pkgE := errors.New(nil).WithCode(errors.DENIED).WithMessage("The system is in read-only mode. Any modification is prohibited.")
 			lib_http.SendError(w, pkgE)
 			return
 		}
```

---

### Incident Patch 7: `6d24f6c5` (2026-09-21)
**Commit Message**: fix(gc): do not count blobs missing from storage as freed space (#23972)

* fix(gc): do not count blobs missing from storage as freed space

When registryctl reports a blob as not found, the GC ignores the error
to keep the job going, but such a blob was not removed by this run.
Its size was still added to freed_space, so the job reported success
with inflated numbers while the storage kept growing, e.g. when every
DeleteBlob fails with PathNotFoundError on an S3-compatible backend.

Skip the size of not-found blobs when computing freed_space and log a
warning for each of them, so the mismatch is visible in the job log.

Refs #23178

Signed-off-by: Viktor Erpylev <[REDACTED_EMAIL]>

* test(gc): mock UpdateBlobStatus in TestSweepBlobNotFound

The sweep marks every candidate as deleting before calling the registry,
so the new test panicked on an unexpected mock call.

Refs #23178

Signed-off-by: Viktor Erpylev <[REDACTED_EMAIL]>

---------

Signed-off-by: Viktor Erpylev <[REDACTED_EMAIL]>

**File**: `src/jobservice/job/impl/gc/garbage_collection.go` (modified, +9/-1)
```diff
@@ -429,13 +429,17 @@ func (gc *GarbageCollector) sweep(ctx job.Context) error {
 				// for the foreign layer, as it's not stored in the storage, no need to call the delete api and count size, but still have to delete the DB record.
 				if !blob.IsForeignLayer() {
 					gc.logger.Infof("[%s][%d/%d] delete blob from storage: %s", uid, localIndex, total, blob.Digest)
+					// a not found error is ignored to keep the GC going, but such a blob is not removed by this run,
+					// so its size must not be counted as freed space.
+					notFound := false
 					if err := retry.Retry(func() error {
 						return ignoreNotFound(func() error {
 							err := gc.registryCtlClient.DeleteBlob(blob.Digest)
 							// if the system is in read-only mode, return an Abort error to skip retrying
 							if err == readonly.Err {
 								return retry.Abort(err)
 							}
+							notFound = errors.IsNotFoundErr(err)
 							return err
 						})
 					}, retry.Callback(func(err error, sleep time.Duration) {
@@ -454,7 +458,11 @@ func (gc *GarbageCollector) sweep(ctx job.Context) error {
 						}
 						continue
 					}
-					atomic.AddInt64(&sweepSize, blob.Size)
+					if notFound {
+						gc.logger.Warningf("[%s][%d/%d] blob not found in storage, its size is not counted as freed space: %s", uid, localIndex, total, blob.Digest)
+					} else {
+						atomic.AddInt64(&sweepSize, blob.Size)
+					}
 				}
 
 				gc.logger.Infof("[%s][%d/%d] delete blob record from database: %d, %s", uid, localIndex, total, blob.ID, blob.Digest)
```

**File**: `src/jobservice/job/impl/gc/garbage_collection_test.go` (modified, +33/-0)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/goharbor/harbor/src/controller/project"
 	"github.com/goharbor/harbor/src/jobservice/job"
 	"github.com/goharbor/harbor/src/jobservice/tests"
+	"github.com/goharbor/harbor/src/lib/errors"
 	"github.com/goharbor/harbor/src/lib/log"
 	pkgart "github.com/goharbor/harbor/src/pkg/artifact"
 	"github.com/goharbor/harbor/src/pkg/artifactrash/model"
@@ -402,6 +403,38 @@ func (suite *gcTestSuite) TestSweep() {
 	suite.Nil(gc.sweep(ctx))
 }
 
+func (suite *gcTestSuite) TestSweepBlobNotFound() {
+	ctx := &mockjobservice.MockJobContext{}
+	logger := &mockjobservice.MockJobLogger{}
+	ctx.On("GetLogger").Return(logger)
+	ctx.On("OPCommand").Return(job.NilCommand, false)
+	ctx.On("Checkin", `{"freed_space":0,"purged_blobs":1,"purged_manifests":0}`).Return(nil)
+
+	mock.OnAnything(suite.blobMgr, "UpdateBlobStatus").Return(int64(1), nil)
+	mock.OnAnything(suite.blobMgr, "Delete").Return(nil)
+
+	gc := &GarbageCollector{
+		artCtl:            suite.artifactCtl,
+		artrashMgr:        suite.artrashMgr,
+		blobMgr:           suite.blobMgr,
+		registryCtlClient: suite.registryCtlClient,
+		deleteSet: []*pkg_blob.Blob{
+			{
+				ID:          1,
+				Digest:      suite.DigestString(),
+				ContentType: schema2.MediaTypeLayer,
+				Size:        1234,
+			},
+		},
+		workers: 3,
+	}
+
+	// the blob is missing from the storage: the GC must still succeed, but must not count its size as freed
+	mock.OnAnything(gc.registryCtlClient, "DeleteBlob").Return(errors.NotFoundError(nil))
+	suite.Nil(gc.sweep(ctx))
+	ctx.AssertCalled(suite.T(), "Checkin", `{"freed_space":0,"purged_blobs":1,"purged_manifests":0}`)
+}
+
 func (suite *gcTestSuite) TestSaveRes() {
 	ctx := &mockjobservice.MockJobContext{}
 	logger := &mockjobservice.MockJobLogger{}
```

---

### Incident Patch 8: `d151832b` (2026-09-21)
**Commit Message**: chore(deps-dev): bump webpack from 5.107.2 to 5.111.0 in /src/portal/app-swagger-ui (#23951)

chore(deps-dev): bump webpack in /src/portal/app-swagger-ui

Bumps [webpack](https://github.com/webpack/webpack) from 5.107.2 to 5.111.0.
- [Release notes](https://github.com/webpack/webpack/releases)
- [Changelog](https://github.com/webpack/webpack/blob/main/CHANGELOG.md)
- [Commits](https://github.com/webpack/webpack/compare/v5.107.2...v5.111.0)

---
updated-dependencies:
- dependency-name: webpack
  dependency-version: 5.111.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `src/portal/app-swagger-ui/package-lock.json` (modified, +102/-177)
```diff
@@ -16,7 +16,7 @@
         "clean-webpack-plugin": "^4.0.0",
         "copy-webpack-plugin": "^14.0.0",
         "html-webpack-plugin": "^5.6.8",
-        "webpack": "^5.107.2",
+        "webpack": "^5.111.0",
         "webpack-cli": "^7.2.3",
         "webpack-dev-server": "^6.0.0"
       }
@@ -1881,18 +1881,6 @@
         "node": ">=0.4.0"
       }
     },
-    "node_modules/acorn-import-phases": {
-      "version": "1.0.4",
-      "resolved": "https://registry.npmjs.org/acorn-import-phases/-/acorn-import-phases-1.0.4.tgz",
-      "integrity": "sha512-wKmbr/DDiIXzEOiWrTTUcDm24kQ2vGfZQvM2fwg2vXqR5uW6aapr7ObPtj1th32b9u90/Pf4AItvdTh42fBmVQ==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=10.13.0"
-      },
-      "peerDependencies": {
-        "acorn": "^8.14.0"
-      }
-    },
     "node_modules/agent-base": {
       "version": "6.0.2",
       "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
@@ -1922,9 +1910,9 @@
       }
     },
     "node_modules/ajv-formats": {
-      "version": "2.1.1",
-      "resolved": "https://registry.npmjs.org/ajv-formats/-/ajv-formats-2.1.1.tgz",
-      "integrity": "sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==",
+      "version": "3.0.1",
+      "resolved": "https://registry.npmjs.org/ajv-formats/-/ajv-formats-3.0.1.tgz",
+      "integrity": "sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ==",
       "license": "MIT",
       "dependencies": {
         "ajv": "^8.0.0"
@@ -3083,9 +3071,9 @@
       }
     },
     "node_modules/enhanced-resolve": {
-      "version": "5.22.2",
-      "resolved": "https://registry.npmjs.org/enhanced-resolve/-/enhanced-resolve-5.22.2.tgz",
-      "integrity": "sha512-0rxICaFZ7NQho/sHely2bvOPRP0Eu2B0NZ9zM54YvRvWMn7jfz3DmnOZDR9LlXDdDcqntAVc6Hfy4gr/tdH/Ag==",
+      "version": "5.25.1",
+      "resolved": "https://registry.npmjs.org/enhanced-resolve/-/enhanced-resolve-5.25.1.tgz",
+      "integrity": "sha512-nGXts5znJzmWPu+mIE9izCOzdg63oJca2mDzGWWTth7sr4aCToKcoyFVBQwN75Ij5Pf6p510EwkTqViTRzDV+w==",
       "license": "MIT",
       "dependencies": {
         "graceful-fs": "^4.2.4",
@@ -3185,49 +3173,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/eslint-scope": {
-      "version": "5.1.1",
-      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-5.1.1.tgz",
-      "integrity": "sha512-2NxwbF/hZ0KpepYN0cNbo+FN6XoK7GaHlQhgx/hIZl6Va0bF45RQOOwhLIy8lQDbuCiadSLCBnH2CFYquit5bw==",
-      "license": "BSD-2-Clause",
-      "dependencies": {
-        "esrecurse": "^4.3.0",
-        "estraverse": "^4.1.1"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      }
-    },
-    "node_modules/esrecurse": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
-      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
-      "license": "BSD-2-Clause",
-      "dependencies": {
-        "estraverse": "^5.2.0"
-      },
-      "engines": {
-        "node": ">=4.0"
-      }
-    },
-    "node_modules/esrecurse/node_modules/estraverse": {
-      "version": "5.3.0",
-      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
-      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
-      "license": "BSD-2-Clause",
-      "engines": {
-        "node": ">=4.0"
-      }
-    },
-    "node_modules/estraverse": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-4.3.0.tgz",
-      "integrity": "sha512-39nnKffWz8xN1BU/2c79n9nB9HDzo0niYUqx6xyqUnyoAnQyyWpOTdZEeiCch8BBu515t4wp9ZmgVfVhn9EBpw==",
-      "license": "BSD-2-Clause",
-      "engines": {
-        "node": ">=4.0"
-      }
-    },
     "node_modules/etag": {
       "version": "1.8.1",
       "resolved": "https://registry.npmjs.org/etag/-/etag-1.8.1.tgz",
@@ -3626,12 +3571,6 @@
         "tslib": "2"
       }
     },
-    "node_modules/glob-to-regexp": {
-      "version": "0.4.1",
-      "resolved": "https://registry.npmjs.org/glob-to-regexp/-/glob-to-regexp-0.4.1.tgz",
-      "integrity": "sha512-lkX1HJXwyMcprw/5YUZc2s7DrpAiHB21/V+E1rHUrVNokkvB6bqMzT0VfV6/86ZNabt1k14YOIaT7nDvOX3Iiw==",
-      "license": "BSD-2-Clause"
-    },
     "node_modules/gopd": {
       "version": "1.2.0",
       "resolved": "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz",
@@ -4394,19 +4333,6 @@
         "shell-quote": "^1.8.4"
       }
     },
-    "node_modules/loader-runner": {
-      "version": "4.3.2",
-      "resolved": "https://registry.npmjs.org/loader-runner/-/loader-runner-4.3.2.tgz",
-      "integrity": "sha512-DFEqQ3ihfS9blba08cLfYf1NRAIEm+dDjic073DRDc3/JspI/8wYmtDsHwd3+4hwvdxSK7PGaElfTmm0awWJ4w==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=6.11.5"
-      },
-      "funding": {
-    
```

**File**: `src/portal/app-swagger-ui/package.json` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
     "clean-webpack-plugin": "^4.0.0",
     "copy-webpack-plugin": "^14.0.0",
     "html-webpack-plugin": "^5.6.8",
-    "webpack": "^5.107.2",
+    "webpack": "^5.111.0",
     "webpack-cli": "^7.2.3",
     "webpack-dev-server": "^6.0.0"
   },
```

---

### Incident Patch 9: `65c5f4c0` (2026-09-18)
**Commit Message**: chore(deps-dev): bump webpack-cli from 4.10.0 to 7.2.3 in /src/portal/app-swagger-ui (#23850)

chore(deps-dev): bump webpack-cli in /src/portal/app-swagger-ui

Bumps [webpack-cli](https://github.com/webpack/webpack-cli) from 4.10.0 to 7.2.3.
- [Release notes](https://github.com/webpack/webpack-cli/releases)
- [Changelog](https://github.com/webpack/webpack-cli/blob/main/CHANGELOG.md)
- [Commits](https://github.com/webpack/webpack-cli/compare/[REDACTED_EMAIL]-cli@7.2.3)

---
updated-dependencies:
- dependency-name: webpack-cli
  dependency-version: 7.2.3
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>

**File**: `src/portal/app-swagger-ui/package-lock.json` (modified, +46/-98)
```diff
@@ -17,7 +17,7 @@
         "copy-webpack-plugin": "^14.0.0",
         "html-webpack-plugin": "^5.6.8",
         "webpack": "^5.107.2",
-        "webpack-cli": "^4.10.0",
+        "webpack-cli": "^7.2.3",
         "webpack-dev-server": "^6.0.0"
       }
     },
@@ -43,13 +43,13 @@
       }
     },
     "node_modules/@discoveryjs/json-ext": {
-      "version": "0.5.7",
-      "resolved": "https://registry.npmjs.org/@discoveryjs/json-ext/-/json-ext-0.5.7.tgz",
-      "integrity": "sha512-dBVuXR082gk3jsFp7Rd/JI4kytwGHecnCoTtXFb7DB6CNHp4rg5k1bhg0nWdLGLnOV71lmDzGQaLMy8iPLY0pw==",
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@discoveryjs/json-ext/-/json-ext-1.1.0.tgz",
+      "integrity": "sha512-Xc3VhU02wqZ1HvHRJUwL09HkZSTvidqY5Ya0NXBSYOxAp+Ln9dcJr9fySI+CkONzP3PekQo9WdzCv0PGER/mOA==",
       "dev": true,
       "license": "MIT",
       "engines": {
-        "node": ">=10.0.0"
+        "node": ">=14.17.0"
       }
     },
     "node_modules/@jridgewell/gen-mapping": {
@@ -1833,45 +1833,6 @@
         "@xtuc/long": "4.2.2"
       }
     },
-    "node_modules/@webpack-cli/configtest": {
-      "version": "1.2.0",
-      "resolved": "https://registry.npmjs.org/@webpack-cli/configtest/-/configtest-1.2.0.tgz",
-      "integrity": "sha512-4FB8Tj6xyVkyqjj1OaTqCjXYULB9FMkqQ8yGrZjRDrYh0nOE+7Lhs45WioWQQMV+ceFlE368Ukhe6xdvJM9Egg==",
-      "dev": true,
-      "license": "MIT",
-      "peerDependencies": {
-        "webpack": "4.x.x || 5.x.x",
-        "webpack-cli": "4.x.x"
-      }
-    },
-    "node_modules/@webpack-cli/info": {
-      "version": "1.5.0",
-      "resolved": "https://registry.npmjs.org/@webpack-cli/info/-/info-1.5.0.tgz",
-      "integrity": "sha512-e8tSXZpw2hPl2uMJY6fsMswaok5FdlGNRTktvFk2sD8RjH0hE2+XistawJx1vmKteh4NmGmNUrp+Tb2w+udPcQ==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "envinfo": "^7.7.3"
-      },
-      "peerDependencies": {
-        "webpack-cli": "4.x.x"
-      }
-    },
-    "node_modules/@webpack-cli/serve": {
-      "version": "1.7.0",
-      "resolved": "https://registry.npmjs.org/@webpack-cli/serve/-/serve-1.7.0.tgz",
-      "integrity": "sha512-oxnCNGj88fL+xzV+dacXs44HcDwf1ovs3AuEzvP7mqXw7fQntqIhQ1BRmynh4qEKQSSSRSWVyXRjmTbZIX9V2Q==",
-      "dev": true,
-      "license": "MIT",
-      "peerDependencies": {
-        "webpack-cli": "4.x.x"
-      },
-      "peerDependenciesMeta": {
-        "webpack-dev-server": {
-          "optional": true
-        }
-      }
-    },
     "node_modules/@xtuc/ieee754": {
       "version": "1.2.0",
       "resolved": "https://registry.npmjs.org/@xtuc/ieee754/-/ieee754-1.2.0.tgz",
@@ -2513,13 +2474,6 @@
         "node": ">=6"
       }
     },
-    "node_modules/colorette": {
-      "version": "2.0.20",
-      "resolved": "https://registry.npmjs.org/colorette/-/colorette-2.0.20.tgz",
-      "integrity": "sha512-IfEDxwoWIjkeXL1eXcDiow4UbKjhLdq6/EuSVR9GMN7KVH3r9gQ83e73hsz1Nd1T3ijd5xv1wcWRYO+D6kCI2w==",
-      "dev": true,
-      "license": "MIT"
-    },
     "node_modules/combined-stream": {
       "version": "1.0.8",
       "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz",
@@ -3416,16 +3370,6 @@
       ],
       "license": "BSD-3-Clause"
     },
-    "node_modules/fastest-levenshtein": {
-      "version": "1.0.16",
-      "resolved": "https://registry.npmjs.org/fastest-levenshtein/-/fastest-levenshtein-1.0.16.tgz",
-      "integrity": "sha512-eRnCtTTtGZFpQCwhJiUOuxPQWRXVKYDn0b2PeHfXL6/Zi53SLAzAHfVhVWK2AryC/WH05kGfxhFIPvTF0SXQzg==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">= 4.9.1"
-      }
-    },
     "node_modules/fault": {
       "version": "1.0.4",
       "resolved": "https://registry.npmjs.org/fault/-/fault-1.0.4.tgz",
@@ -4058,13 +4002,13 @@
       "license": "ISC"
     },
     "node_modules/interpret": {
-      "version": "2.2.0",
-      "resolved": "https://registry.npmjs.org/interpret/-/interpret-2.2.0.tgz",
-      "integrity": "sha512-Ju0Bz/cEia55xDwUWEa8+olFpCiQoypjnQySseKtmjNrnps3P+xfpUmGr90T7yjlVJmOtybRvPXhKMbHr+fWnw==",
+      "version": "3.1.1",
+      "resolved": "https://registry.npmjs.org/interpret/-/interpret-3.1.1.tgz",
+      "integrity": "sha512-6xwYfHbajpoF0xLW+iwLkhwgvLoZDfjYfoFNu8ftMoXINzwuymNLd9u/KmwtdT2GbR+/Cz66otEGEVVUHX9QLQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
-        "node": ">= 0.10"
+        "node": ">=10.13.0"
       }
     },
     "node_modules/invariant": {
@@ -5600,16 +5544,16 @@
       }
     },
     "node_modules/rechoir": {
-      "version": "0.7.1",
-      "resolved": "https://registry.npmjs.org/rechoir/-/rechoir-0.7.1.tgz",
-      "integrity": "sha512-/njmZ8s1wVeR6pjTZ+0nCnv8SpZNRMT2D1RLOJQESlYFDBvwpTA4KWJpZ+sBJ4+vhjILRcK7JIFdGCdxEAAitg==",
+      "version": "0.8.0",
+      "resolved": "https://registry.npmjs.org/rechoir/-/rechoir-0.8.0.tgz",
+      "integrity": "sha512-/vxpCXddiX8NGfGO/mTafwjq4aFa/71pvamip0++IQk3zG8cbCj0fifNPrjjF1XMXUne91jL9Oo
```

**File**: `src/portal/app-swagger-ui/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
     "copy-webpack-plugin": "^14.0.0",
     "html-webpack-plugin": "^5.6.8",
     "webpack": "^5.107.2",
-    "webpack-cli": "^4.10.0",
+    "webpack-cli": "^7.2.3",
     "webpack-dev-server": "^6.0.0"
   },
   "overrides": {
```

---

### Incident Patch 10: `14f7a531` (2026-09-17)
**Commit Message**: chore(deps): bump baseline-browser-mapping from 2.10.33 to 2.11.23 in /src/portal/app-swagger-ui (#23883)

chore(deps): bump baseline-browser-mapping in /src/portal/app-swagger-ui

Bumps [baseline-browser-mapping](https://github.com/web-platform-dx/baseline-browser-mapping) from 2.10.33 to 2.11.23.
- [Release notes](https://github.com/web-platform-dx/baseline-browser-mapping/releases)
- [Commits](https://github.com/web-platform-dx/baseline-browser-mapping/compare/v2.10.33...v2.11.23)

---
updated-dependencies:
- dependency-name: baseline-browser-mapping
  dependency-version: 2.11.21
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>

**File**: `src/portal/app-swagger-ui/package-lock.json` (modified, +3/-3)
```diff
@@ -2132,9 +2132,9 @@
       "license": "MIT"
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.10.33",
-      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.33.tgz",
-      "integrity": "sha512-bA6+tcSLpz2tIEdDXZPpPTIuxBcC4+w6SieaYyfigIa4h8GlFxbA17v22Vx3JUtuZQj9SgOsnbK+aTBzyDyEuw==",
+      "version": "2.11.24",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.24.tgz",
+      "integrity": "sha512-hYrgxie335U08WqICoGqKRzV1HFXv6zdxwJE4ekCb80CM9a0SVVsN4QPwT67RraRo+9h8IATk6uxHJw7QSkdOg==",
       "license": "Apache-2.0",
       "bin": {
         "baseline-browser-mapping": "dist/cli.cjs"
```

---

### Incident Patch 11: `eadf89a5` (2026-09-16)
**Commit Message**: chore(deps): bump css-loader from 6.11.0 to 7.1.5 in /src/portal/app-swagger-ui (#23848)

chore(deps): bump css-loader in /src/portal/app-swagger-ui

Bumps [css-loader](https://github.com/webpack/css-loader) from 6.11.0 to 7.1.5.
- [Release notes](https://github.com/webpack/css-loader/releases)
- [Changelog](https://github.com/webpack/css-loader/blob/main/CHANGELOG.md)
- [Commits](https://github.com/webpack/css-loader/compare/v6.11.0...v7.1.5)

---
updated-dependencies:
- dependency-name: css-loader
  dependency-version: 7.1.5
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Prasanth Baskar <[REDACTED_EMAIL]>

**File**: `src/portal/app-swagger-ui/package-lock.json` (modified, +9/-9)
```diff
@@ -8,7 +8,7 @@
       "name": "harbor-swagger-ui",
       "version": "2.10.0",
       "dependencies": {
-        "css-loader": "^6.11.0",
+        "css-loader": "^7.1.5",
         "style-loader": "^4.0.0",
         "swagger-ui": "5.32.13"
       },
@@ -2725,30 +2725,30 @@
       }
     },
     "node_modules/css-loader": {
-      "version": "6.11.0",
-      "resolved": "https://registry.npmjs.org/css-loader/-/css-loader-6.11.0.tgz",
-      "integrity": "sha512-CTJ+AEQJjq5NzLga5pE39qdiSV56F8ywCIsqNIRF0r7BDgWsN25aazToqAFg7ZrtA/U016xudB3ffgweORxX7g==",
+      "version": "7.1.5",
+      "resolved": "https://registry.npmjs.org/css-loader/-/css-loader-7.1.5.tgz",
+      "integrity": "sha512-Q7iAfQkU2twNBryKX/vGAlE+GAmkF7quhSzAGNK8fBimxk3+tqg245rH52UPb9dioBolBc8rP0ihmHBaDTJQBA==",
       "license": "MIT",
       "dependencies": {
         "icss-utils": "^5.1.0",
-        "postcss": "^8.4.33",
+        "postcss": "^8.4.40",
         "postcss-modules-extract-imports": "^3.1.0",
         "postcss-modules-local-by-default": "^4.0.5",
         "postcss-modules-scope": "^3.2.0",
         "postcss-modules-values": "^4.0.0",
         "postcss-value-parser": "^4.2.0",
-        "semver": "^7.5.4"
+        "semver": "^7.6.3"
       },
       "engines": {
-        "node": ">= 12.13.0"
+        "node": ">= 18.12.0"
       },
       "funding": {
         "type": "opencollective",
         "url": "https://opencollective.com/webpack"
       },
       "peerDependencies": {
-        "@rspack/core": "0.x || 1.x",
-        "webpack": "^5.0.0"
+        "@rspack/core": "0.x || ^1.0.0 || ^2.0.0-0",
+        "webpack": "^5.27.0"
       },
       "peerDependenciesMeta": {
         "@rspack/core": {
```

**File**: `src/portal/app-swagger-ui/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "webpack serve --open --config webpack.dev.js"
   },
   "dependencies": {
-    "css-loader": "^6.11.0",
+    "css-loader": "^7.1.5",
     "style-loader": "^4.0.0",
     "swagger-ui": "5.32.13"
   },
```

---

### Incident Patch 12: `17b07334` (2026-09-15)
**Commit Message**: fix(systeminfo): make HTTPS URL scheme check case-insensitive for CA download (#23888)

Per RFC 3986, URL schemes are case-insensitive. In systeminfo controller, enableCADownload previously checked strings.HasPrefix(extURL, "https://") which failed when ExtEndpoint was configured with uppercase or mixed-case scheme (e.g., HTTPS://). Replace with strings.ToLower(extURL) to ensure case-insensitive scheme matching.

Fixes # NONE

Signed-off-by: Norway-02 <[REDACTED_EMAIL]>

**File**: `src/controller/systeminfo/controller.go` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ func (c *controller) GetInfo(ctx context.Context, opt Options) (*Data, error) {
 		registryURL = l[0]
 	}
 	_, caStatErr := os.Stat(defaultRootCert)
-	enableCADownload := caStatErr == nil && strings.HasPrefix(extURL, "https://")
+	enableCADownload := caStatErr == nil && strings.HasPrefix(strings.ToLower(extURL), "https://")
 	res.Protected = &protectedData{
 		CurrentTime:                 time.Now(),
 		ReadOnly:                    config.ReadOnly(ctx),
```

---

### Incident Patch 13: `c10a0a62` (2026-09-15)
**Commit Message**: fix: ignore http.ErrServerClosed on graceful shutdown (#23296)

Follow-up to #23295 which fixed the same issue in registryctl.

http.Server.ListenAndServe and ListenAndServeTLS always return a
non-nil error, and that error is http.ErrServerClosed after a
successful Shutdown. Treating it as a real error produces misleading
fatal/error log lines (and in some paths an os.Exit(1)) during a normal
shutdown.

This filters ErrServerClosed in the remaining sites that share the
pattern:

  * src/jobservice/runtime/bootstrap.go
    Filters ErrServerClosed at the call site and removes the now-dead
    else branch (apiServer.Start always returns non-nil).

  * src/cmd/exporter/main.go
    Latent today (no graceful shutdown wired), but the existing path
    would log an error and exit(1) on any future clean stop.

  * src/lib/pprof.go
    Log-noise only on shutdown.

  * src/lib/metric/server.go
    Log-noise only on shutdown. Also fixes the longstanding
    "Promethus metrcis" typo while restructuring the call.

Signed-off-by: Vadim Bauer <[REDACTED_EMAIL]>

**File**: `src/cmd/exporter/main.go` (modified, +2/-1)
```diff
@@ -15,6 +15,7 @@
 package main
 
 import (
+	"errors"
 	"net/http"
 	"os"
 	"strings"
@@ -99,7 +100,7 @@ func main() {
 		exporterOpt.CacheCleanInterval,
 	)
 	prometheus.MustRegister(harborExporter)
-	if err := harborExporter.ListenAndServe(); err != nil {
+	if err := harborExporter.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
 		log.Errorf("Error starting Harbor exporter %s", err)
 		os.Exit(1)
 	}
```

**File**: `src/jobservice/runtime/bootstrap.go` (modified, +2/-4)
```diff
@@ -17,6 +17,7 @@ package runtime // nolint:revive
 import (
 	"context"
 	"fmt"
+	"net/http"
 	"os"
 	"os/signal"
 	"strings"
@@ -256,14 +257,11 @@ func (bs *Bootstrap) LoadAndRun(ctx context.Context, cancel context.CancelFunc)
 	// Blocking here
 	logger.Infof("API server is serving at %d with [%s] mode at node [%s]", cfg.Port, cfg.Protocol, node)
 	metric.JobserviceInfo.WithLabelValues(node.(string), workerPoolID, fmt.Sprint(cfg.PoolConfig.WorkerCount)).Set(1)
-	if er := apiServer.Start(); er != nil {
+	if er := apiServer.Start(); er != nil && !errors.Is(er, http.ErrServerClosed) {
 		if !terminated {
 			// Tell the listening goroutine
 			rootContext.ErrorChan <- er
 		}
-	} else {
-		// In case
-		sig <- os.Interrupt
 	}
 
 	// Wait everyone exits.
```

**File**: `src/lib/metric/server.go` (modified, +4/-1)
```diff
@@ -15,6 +15,7 @@
 package metric
 
 import (
+	"errors"
 	"fmt"
 	"net/http"
 
@@ -35,5 +36,7 @@ func ServeProm(path string, port int) {
 	mux := http.NewServeMux()
 	mux.Handle(path, promhttp.Handler())
 	log.Infof("Prometheus metric server running on port %v", port)
-	log.Errorf("Promethus metrcis server down with %s", http.ListenAndServe(fmt.Sprintf(":%v", port), mux))
+	if err := http.ListenAndServe(fmt.Sprintf(":%v", port), mux); err != nil && !errors.Is(err, http.ErrServerClosed) {
+		log.Errorf("Prometheus metrics server down with %s", err)
+	}
 }
```

**File**: `src/lib/pprof.go` (modified, +3/-1)
```diff
@@ -15,7 +15,9 @@
 package lib
 
 import (
+	"errors"
 	"net/http"
+
 	// import pprof
 	_ "net/http/pprof" // nolint:gosec // pprof is only registered when PPROF_ENABLED=true.
 	"os"
@@ -38,7 +40,7 @@ func StartPprof() {
 			addr = ":6060"
 		}
 		log.Infof("Starting pprof at %s/debug/pprof/", addr)
-		if err := http.ListenAndServe(addr, http.DefaultServeMux); err != nil {
+		if err := http.ListenAndServe(addr, http.DefaultServeMux); err != nil && !errors.Is(err, http.ErrServerClosed) {
 			log.Errorf("pprof exited: %v", err)
 		}
 	}()
```

---

### Incident Patch 14: `8ca2cc23` (2026-09-15)
**Commit Message**: fix(cache): avoid double prefix when removing expired entries (#23913)

Signed-off-by: Hanabi <[REDACTED_EMAIL]>

**File**: `src/lib/cache/memory/memory.go` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ func (c *Cache) Contains(ctx context.Context, key string) bool {
 	}
 
 	if e.(*entry).isExpirated() {
-		err := c.Delete(ctx, c.opts.Key(key))
+		err := c.Delete(ctx, key)
 		log.Errorf("failed to delete cache in Contains() method when it's expired, error: %v", err)
 		return false
 	}
@@ -74,7 +74,7 @@ func (c *Cache) Fetch(ctx context.Context, key string, value any) error {
 
 	e := v.(*entry)
 	if e.isExpirated() {
-		err := c.Delete(ctx, c.opts.Key(key))
+		err := c.Delete(ctx, key)
 		if err != nil {
 			log.Errorf("failed to delete cache in Fetch() method when it's expired, error: %v", err)
 		}
```

**File**: `src/lib/cache/memory/memory_test.go` (modified, +24/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 
 	"github.com/goharbor/harbor/src/lib/cache"
@@ -164,6 +165,29 @@ func TestCacheTestSuite(t *testing.T) {
 	suite.Run(t, new(CacheTestSuite))
 }
 
+func TestExpiredPrefixedEntry(t *testing.T) {
+	for _, operation := range []string{"contains", "fetch"} {
+		t.Run(operation, func(t *testing.T) {
+			ctx := context.Background()
+			c, err := cache.New("memory", cache.Prefix("prefix:"))
+			require.NoError(t, err)
+			require.NoError(t, c.Save(ctx, "key", "expired", -time.Second))
+			require.NoError(t, c.Save(ctx, "prefix:key", "live"))
+			if operation == "contains" {
+				require.False(t, c.Contains(ctx, "key"))
+			} else {
+				var value string
+				require.ErrorIs(t, c.Fetch(ctx, "key", &value), cache.ErrNotFound)
+			}
+			var value string
+			require.NoError(t, c.Fetch(ctx, "prefix:key", &value))
+			require.Equal(t, "live", value)
+			_, exists := c.(*Cache).storage.Load("prefix:key")
+			require.False(t, exists, "the expired entry must be removed")
+		})
+	}
+}
+
 func BenchmarkCacheFetchParallel(b *testing.B) {
 	key := "benchmark"
 	cache, _ := cache.New("memory")
```

---

### Incident Patch 15: `3488b645` (2026-09-14)
**Commit Message**: docs: fix typo wating -> waiting (#23807)

Signed-off-by: Vaibhav Srivastava <[REDACTED_EMAIL]>
Co-authored-by: Wang Yan <[REDACTED_EMAIL]>

**File**: `src/portal/src/app/base/project/member/member.component.ts` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ export class MemberComponent implements OnInit, OnDestroy {
                 );
         };
 
-        // Deleting member then wating for results
+        // Deleting member then waiting for results
         members.forEach(member =>
             memberDeletingObservables.push(deleteMember(member))
         );
```

#### Recent Merged Pull Requests:
- **PR #24037** (2026-10-01): fix(gc): Use the current registry Redis URL for scheduled runs (@Vad1mo)
- **PR #24036** (closed): feat(portal): Custom project roles UI, with UI fixes on top of #23970 (@bupd)
- **PR #24032** (closed): chore(deps): bump ip-address from 10.5.0 to 10.7.2 in /src/portal (@dependabot[bot])
- **PR #24014** (2026-09-28): (cherry-pick): update expected CVE export toast message in Robot test (@stonezdj)
- **PR #24010** (2026-09-28): fix(test): update expected CVE export toast message in Robot test (@stonezdj)
- **PR #23997** (2026-09-28): test(apitests): add missing get_member_role_id to project helper (@stonezdj)
- **PR #23991** (2026-09-23): Bump up distribution version and refresh base image (@stonezdj)
- **PR #23986** (2026-09-23): ci: Add merge_group trigger to CI and CodeQL workflows (@bupd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
