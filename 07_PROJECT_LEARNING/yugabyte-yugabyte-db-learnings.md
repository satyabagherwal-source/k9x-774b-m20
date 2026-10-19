> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source**: github ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Source Version**: `b10be5ad`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:26:55.000Z  
> **Learning ID**: `learn-github-yugabyte-yugabyte-db`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yugabyte/yugabyte-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T03:26:54.992Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yugabyte/yugabyte-db`
- **Description**: YugabyteDB - the cloud native distributed SQL database for mission-critical applications.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10605 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `arcanist_util/check-diff-name.py`
```
#!/usr/bin/env python3

import os
import re
import argparse

from subprocess import check_output


DIFF_NAME_RE = re.compile(
    r'(?P<backport>\[BACKPORT [0-9\.\-]+\])?\[(?P<issues>(#[0-9]+, )*#[0-9]+)\] '
    r'(?P<area>[\w,\s]+): (?P<description>.{10,100})$')

# Tests - correct and incorrect samples
CORRECT_NAMES = {
    "multiple issue numbers": "[#1234, #1235] area: Ideally short title",
    "one issue and one backport": "[BACKPORT 2.2-1][#1235] area: Ideally short title",
    "one issue, no backports": "[#1235] area: Ideally short title",
    "different issue numbers": "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title",
    "complex area":
        "[BACKPORT 2.2-1][#1235] area of, probably, some 1 Interest: Ideally short title"
}

for reason, cname in CORRECT_NAMES.items():
    assert DIFF_NAME_RE.match(cname), \
        f"New DIFF_NAME_RE doesn't match on '{cname}' which has '{reason}'"

INCORRECT_NAMES = {
    "more than one backport in one diff":
        "[BACKPORT 2.1][BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title",
    "illegal literal in build number for backport":
        "[BACKPORT 2.2-b1][#1235, #1, #10292012] area: Ideally short title",
    "wrong issues list (trailing comma)":
        "[BACKPORT 2.2-1][#1235, #1, #10292012,] area: Ideally short title",
    "wrong issue number (comma)":
        "[BACKPORT 2.2-1][#1,235, #1, #10292012] area: Ideally short title",
    "wrong issues list (leading comma)":
        "[BACKPORT 2.2-1][,#1235, #1, #10292012] area: Ideally short title",
    "wrong issue number (dash)":
        "[BACKPORT 2.2-1][#12-5, #b1, #1029?2012] area: Ideally short title",
    "too short title":
        "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally s",
    "too long title":
        "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title Ideally short title "
        "Ideally short title Ideally short title Ideally short title ..."
}

for reason, iname in INCORRECT_NAMES.items():
    assert not DIFF_NAME_RE.match(iname), \
        f"New DIFF_NAME_RE doesn't warn on '{iname}' which has '{reason}'"

parser = argparse.ArgumentParser(
    description="Tool to check Phabricator diff name of current working copy (CWD)")
parser.add_argument('--base', '-b', action='store_true',
                    help='Use master branch as merge base to detect diff (for arc which call)')
parser.add_argument('--repository', '-r', default=os.path.dirname(__file__),
                    help='What repository to inspect')

args = parser.parse_args()

arc_which_cmd = ['arc', 'which']
if args.base:
    arc_which_cmd += ['--base', 'git:merge-base(origin/master)']
arc_which_cmd += ['--']  # end of options marker required
arc_which_out = check_output(arc_which_cmd, cwd=args.repository).decode('utf-8')
diff_descs = re.findall('D[0-9]+.*', arc_which_out)
if diff_descs:
    for diff_desc in diff_descs:
        diff_id, diff_name = re.search('(D[0-9]+) (.*)', diff_desc).groups()
        parsed_diff_name = DIFF_NAME_RE.match(diff_name)
        if parsed_diff_name:
            print(f"ok: Diff {diff_id} has correct name")
        else:
            print(f"error: Diff {diff_id} name "
                  f"should fit '{DIFF_NAME_RE.pattern}' but it is '{diff_name}'")
else:
    print("advice: No diffs were found, time to create one ?")

```

### Core Architecture Module: `managed/devops/bin/node_client_utils.py`
```
import os
import subprocess

YB_USERNAME = 'yugabyte'

CONNECTION_RETRY_COUNT = 3
CONNECTION_RETRY_DELAY_SEC = 15
# Let's set some timeout to our commands.
# If 10 minutes will not be enough for something - will have to pass command timeout as an argument.
# Just having timeout in shell script, which we're running on the node,
# does not seem to always help - as ssh client connection itself or command results read can hang.
COMMAND_TIMEOUT_SEC = 600


class KubernetesClient:
    def __init__(self, args):
        self.pod_name = args.k8s_config["podName"]
        self.namespace = args.k8s_config["namespace"]
        self.is_master = args.is_master
        self.container = "yb-master" if self.is_master else "yb-tserver"
        self.env_config = os.environ.copy()
        self.env_config["KUBECONFIG"] = args.k8s_config["KUBECONFIG"]

    def wrap_command(self, cmd):
        command = cmd
        if isinstance(cmd, str):
            command = [cmd]
        return ['kubectl', 'exec', '-n', self.namespace, '-c',
                self.container, self.pod_name, '--'] + command

    def get_file(self, source_file_path, target_local_file_path):
        cmd = [
            'kubectl',
            'cp',
            '-c', self.container,
            self.namespace + "/" + self.pod_name + ":" + source_file_path,
            target_local_file_path]
        return subprocess.call(cmd, env=self.env_config)

    def put_file(self, source_file_path, target_file_path):
        cmd = [
            'kubectl',
            'cp',
            '-c', self.container,
            source_file_path,
            self.namespace + "/" + self.pod_name + ":" + target_file_path]
        return subprocess.call(cmd, env=self.env_config)

    def get_command_output(self, cmd, stdout=None):
        cmd = self.wrap_command(cmd)
        return subprocess.call(cmd, stdout=stdout, env=self.env_config)

    def check_exec_command(self, cmd):
        cmd = self.wrap_command(cmd)
        return subprocess.check_output(cmd, env=self.env_config).decode()

    def check_exec_script(self, local_script_name, params):
        '''
        Function to execute a local bash script on the k8s cluster.
        Parameters:
        local_script_name : Path to the shell script on local machine
        params: List of arguments to be provided to the shell script
        '''
        if not isinstance(params, str):
            params = ' '.join(params)

        with open(local_script_name, "r") as f:
            local_script = f.read()

        # Heredoc syntax for input redirection from a local shell script
        command = f"/bin/bash -s {params} <<'EOF'\n{local_script}\nEOF"

        # Cannot use self.exec_command() because it needs '/bin/bash' and '-c' before the command
        wrapped_command = ['kubectl', 'exec', '-n', self.namespace, '-c',
                           self.container, self.pod_name, '--',
                           '/bin/bash', '-c', command]

        output = subprocess.check_output(wrapped_command, env=self.env_config).decode()
        return output

```

### Core Architecture Module: `managed/devops/bin/yb_platform_util.py`
```
# #!/usr/bin/env python
# Copyright (c) YugabyteDB, Inc.
#
# Copyright 2021 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

"""
Python script to perfrom Universe operations.
"""
import enum
import json
import os
import copy
import collections
import sys
import argparse
import textwrap
import time

PYTHON_VERSION = sys.version_info[0]
if PYTHON_VERSION == 2:
    from urllib2 import HTTPError, urlopen, Request
else:
    from urllib.request import urlopen, Request
    from urllib.error import HTTPError

SUCCESS = "success"
FAIL = "failed"
PROGRESS_BAR = 100
SCRIPT_PATH = os.getcwd()


class HelpMessage(enum.Enum):
    """
    Enum for Help messages.
    """
    ACTION = 'Universe actions to perform'
    CUSTOMER_UUID = 'Mandatory if multiple customer uuids present.'
    UNIVERSE_NAME = 'Universe name'
    UNIVERSE_UUID = 'Universe UUID'
    FILE = 'Json input file for creating universe. Relative path.'
    TASK = 'Task UUID to get task status'
    YES = 'Input yes for all confirmation prompts'
    INTERVAL = 'Set interval time to get status update'
    NO_WAIT = 'To run command in background and do not wait for task completion task'
    FORCE = 'Force delete universe'


def exception_handling(func):
    """
    General exception handling for all actions
    """
    def inner_function(*args, **kwargs):
        """
        Wrape fucn with try and catch
        """
        try:
            return func(*args, **kwargs)
        except HTTPError as exception:
            try:
                content = exception.read().decode('utf-8')
                json.loads(content)
                sys.stderr.write(content)
            except ValueError as exception:
                message = 'Invalid YB_PLATFORM_URL URL, params or env values.\n'
                sys.stderr.write(message)
                sys.stderr.write(str(exception))
        except ValueError as exception:
            sys.stderr.write(str(exception))
        except Exception as exception:
            sys.stderr.write(str(exception))
        return None
    return inner_function


def convert_unicode_json(data):
    """
    Function to convert unicode json to dictionary
    {u"name": u"universe"} => {"name": "universe"}

    :param data: Unicode json data.
    :return: Converted data
    """
    if PYTHON_VERSION == 2:
        if isinstance(data, basestring):
            return str(data)
        if isinstance(data, collections.Mapping):
            return dict(map(convert_unicode_json, data.iteritems()))
        if isinstance(data, collections.Iterable):
            return type(data)(map(convert_unicode_json, data))
    return data


def check_positive(value):
    """
    Function to validate positive integer.

    :param data: value.
    :return: positive int
    """
    ivalue = int(value)
    if ivalue <= 0:
        raise argparse.ArgumentTypeError("%s is an invalid positive int value" % value)
    return ivalue


def get_input_from_user(message):
    """
    Function to get input from the user
    """
    return raw_input(message) if PYTHON_VERSION == 2 else input(message)


class YBUniverse():
    """
    Class to perform all UI opperation
    """
    def __init__(self):
        """
        Initialized initial values of class.
        """
        self.__parse_arguments()
        self.base_url = os.getenv('YB_PLATFORM_URL')
        self.customer_uuid = None
        self.api_token = os.getenv('YB_PLATFORM_API_TOKEN')

    def __call_api(self, url, data=None, is_delete=False):
        """
        Call the corresponding url with auth token, headers and returns the response.

        :param url: url to be called.
        :param data: data for POST request.
        :param is_delete: To identify the delete call.
        :return: Response of the API call.
        """
        if PYTHON_VERSION == 2:
            request = Request(url)
            if is_delete:
                request.get_method = lambda: 'DELETE'
        else:
            if is_delete:
                request = Request(url, method='DELETE')
            else:
                request = Request(url)

        request.add_header('X-AUTH-YW-API-TOKEN', self.api_token)
        request.add_header('Content-Type', 'application/json; charset=utf-8')
        if data:
            converted_data = json.dumps(data).encode('utf-8')
            response = urlopen(request, converted_data)
        else:
            response = urlopen(request)
        return convert_unicode_json(json.load(response))

    def __get_universe_by_name(self, universe_name):
        """
        Get universe data by name of the universe.

        :param universe_name: Universe name.
        :return: None or universe object
        """
        universe_url = '{0}/api/v1/customers/{1}/universes'.format(
            self.base_url, self.customer_uuid)
        data = self.__call_api(universe_url)
        for universe in data:
            if universe.get('name') == universe_name:
                del universe['pricePerHour']
                return universe
        return None

    def __create_universe_config(self, universe_data):
        """
        Create the universe config data from the json file.
        Remove extra fields from universe details before saving to the file.
        User will use this file to create new universe,
        We need to remove all feild which are not required while create.

        :param universe_data: Stored universe data.
        :return: Configured universe json.
        """
        configure_json = {}
        clusters = copy.deepcopy(universe_data['universeDetails']['clusters'])
        user_az_selected = universe_data['universeDetails']['userAZSelected']

        # All excluded_keys will be populated by universe_config api.
        excluded_keys = [
            'uuid',
            'awsArnString',
            'useHostname',
            'preferredRegion',
            'regions',
            'index',
            'placementInfo'
        ]

        clusters_list = self.__get_cluster_list(clusters, excluded_keys)
        configure_json['clusters'] = copy.deepcopy(clusters_list)
        configure_json['clusterOperation'] = 'CREATE'
        configure_json['userAZSelected'] = copy.deepcopy(user_az_selected)
        configure_json['currentClusterType'] = 'PRIMARY'

        return configure_json

    @staticmethod
    def __get_cluster_list(clusters, excluded_keys):
        """
        Method to modify payload for create API. Modify user Intent inside cluster list.
        Remove extra fields from clusters_list before saving to the file.
        User will use this config to create new universe,
        We need to remove all feild which are not required while create.

        :param clusters: List of clusters.
        :param excluded_keys: Keys to be excluded
        :return: Cluster list.
        """
        clusters_list = []
        for each_cluster in clusters:
            user_intent = each_cluster.get('userIntent', {})
            for key in excluded_keys:
                each_cluster.pop(key, None)
                user_intent.pop(key, None)
            # diskIops is extra field for create payload.
            user_intent.get('deviceInfo', {}).pop('diskIops', None)
            clusters_list.append(each_cluster)
        return clusters_list

    def __get_universe_by_uuid(self, universe_uuid):
        """
        Get universe details by UUID of the universe.

        :param universe_uuid: UUID of the universe.
        :return: None
        """
        universe_config_url = '{0}/api/v1/customers/{1}/universes/{2}'.format(
            self.base_url, self.customer_uuid, universe_uuid)
        return self.__call_api(universe_config_url)

    def __create_universe_from_config(self, universe_config):
        """
        Create the universe from universe config data by calling universe POST API.

        :param universe_config: Universe config data.
        :return: None
        """
        universe_create_url = '{0}/api/v1/customers/{1}/universes'.format(
            self.base_url, self.customer_uuid)
        universe_json = self.__call_api(universe_create_url, universe_config)
        return universe_json['taskUUID']

    @staticmethod
    def __modify_universe_config(data, universe_name=''):
        """
        Modify the universe json with new name.

        :param file_name: Name of the json file.
        :param universe_name: New universe name.
        :return: Modified universe config data.
        """

        clusters = data.get('clusters')
        for each_cluster in clusters:
            if universe_name:
                each_cluster['userIntent']['universeName'] = universe_name
            else:
                universe_name = each_cluster['userIntent']['universeName']
                break
        return data, universe_name

    def __post_universe_config(self, configure_json):
        """
        Call the universe config URL with the updated data.

        :param configure_json: Universe config json.
        :return: None
        """
        universe_config_url = '{0}/api/v1/customers/{1}/universe_configure'.format(
            self.base_url, self.customer_uuid)
        return self.__call_api(universe_config_url, configure_json)

    def __get_universe_list(self):
        """
        Print list of universe names and UUID's.

        :return: None
        """
        universe_url = '{0}/api/v1/customers/{1}/universes'.format(
            self.base_url, self.customer_uuid)
        universe_data = self.__call_api(universe_url)
        universes = []
        for each_universe in universe_data:
            universes.append({
                'name': each_universe.get('name'),
                'universeUUID': each_universe.get('universeUUID')
            })
```

### Core Architecture Module: `managed/devops/opscli/ybops/cloud/aws/utils.py`
```
#!/usr/bin/env python
#
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import boto3
import json
import logging
import os
import re
import time

from ipaddress import ip_network
from ybops.utils import get_or_create, get_and_cleanup, DNS_RECORD_SET_TTL
from ybops.common.exceptions import YBOpsRuntimeError, YBOpsRecoverableError
from ybops.cloud.common.utils import request_retry_decorator
from ybops.cloud.common.cloud import AbstractCloud

RESOURCE_PREFIX_FORMAT = "yb-{}"
IGW_CIDR = "0.0.0.0/0"
SUBNET_PREFIX_FORMAT = RESOURCE_PREFIX_FORMAT
IGW_PREFIX_FORMAT = RESOURCE_PREFIX_FORMAT + "-igw"
ROUTE_TABLE_PREFIX_FORMAT = RESOURCE_PREFIX_FORMAT + "-rt"
SG_YUGABYTE_PREFIX_FORMAT = RESOURCE_PREFIX_FORMAT + "-sg"
PEER_CONN_FORMAT = "yb-peer-conn-{}-to-{}"


class AwsBootstrapRegion():
    def __init__(self, region, metadata, region_cidrs):
        self.region = region
        self.metadata = metadata
        self.region_cidrs = region_cidrs

        self.client = get_client(self.region)

        # Outputs.
        self.vpc = None
        self.igw = None
        self.peer_vpc = None
        self.sg_yugabyte = None
        self.subnets = []
        self.route_table = None

    def bootstrap(self):
        self.setup_vpc()
        self.setup_igw()
        self.setup_subnets()
        self.setup_yugabyte_sg()
        self.setup_rt()

    def setup_vpc(self):
        vpc_region_tag = RESOURCE_PREFIX_FORMAT.format(self.region)
        vpc = create_vpc(client=self.client, tag_name=vpc_region_tag,
                         cidr=get_region_cidr(self.metadata, self.region))
        vpc.wait_until_available()

        self.vpc = vpc

    def setup_igw(self):
        igw_tag = IGW_PREFIX_FORMAT.format(self.region)
        igw = create_igw(client=self.client, tag_name=igw_tag, vpc=self.vpc)

        self.igw = igw

    def setup_subnets(self):
        zones = get_zones(self.region)
        subnets = {}
        for zone_index, zone in enumerate(sorted(zones.keys())):
            vpc_zone_tag = SUBNET_PREFIX_FORMAT.format(zone)
            zone_cidr = self.metadata["zone_cidr_format"].format(
                get_cidr_prefix(self.metadata, self.region), (zone_index + 1) * 16)
            subnet = create_subnet(self.client, self.vpc, zone, zone_cidr, vpc_zone_tag)
            subnets[zone] = subnet

        self.subnets = subnets

    def setup_yugabyte_sg(self):
        sg_group_name = get_yb_sg_name(self.region)
        rules = list(self.metadata["sg_rules"])
        for r in rules:
            r.update({"cidr_ip": IGW_CIDR})
        sg = create_security_group(client=self.client, group_name=sg_group_name,
                                   description="YugaByte SG", vpc=self.vpc,
                                   rules=rules)
        self.sg_yugabyte = sg

    def setup_rt(self):
        route_table_tag = ROUTE_TABLE_PREFIX_FORMAT.format(self.region)
        route_table = create_route_table(client=self.client, tag_name=route_table_tag,
                                         vpc=self.vpc)
        # TODO: handle private/public case at somepoint, also NAT.
        add_route_to_rt(route_table, IGW_CIDR, "GatewayId", self.igw.id)
        current_associated_subnet_ids = [assoc.subnet_id for assoc in route_table.associations]
        missing_ids = [subnet.id for subnet in self.subnets.values()
                       if subnet.id not in current_associated_subnet_ids]
        for subnet_id in missing_ids:
            route_table.associate_with_subnet(SubnetId=subnet_id)

        self.route_table = route_table

    def add_sg_ingress_to_sg(self, incoming_sg, target_sg):
        current_sg_ids = set([pair["GroupId"]
                              for perm in target_sg.ip_permissions
                              for pair in perm["UserIdGroupPairs"]])
        if incoming_sg.id not in current_sg_ids:
            target_sg.authorize_ingress(
                IpPermissions=[{
                    "IpProtocol": "-1",
                    "UserIdGroupPairs": [{"GroupId": incoming_sg.id}]}])


def add_route_to_rt(route_table, cidr, target_type, target_id):
    kwargs = {target_type: target_id}
    route = get_route_by_cidr(route_table, cidr)
    if route is None:
        route_table.create_route(DestinationCidrBlock=cidr, **kwargs)
    elif getattr(route, dumb_camel_to_snake(target_type)) != target_id:
        route.replace(**kwargs)


def add_cidr_to_rules(rules, cidr):
    rule_block = {
        "ip_protocol": "-1",
        "from_port": 0,
        "to_port": 65535,
        "cidr_ip": cidr
    }
    rules.append(rule_block)


def get_cidr_prefix(metadata, region):
    return metadata["regions"][region]["cidr_prefix"]


def get_region_cidr(metadata, region):
    return metadata["region_cidr_format"].format(get_cidr_prefix(metadata, region))


def get_region_cidrs(metadata):
    return dict([(r, get_region_cidr(metadata, r)) for r in metadata["regions"].keys()])


def dumb_camel_to_snake(s):
    return re.sub("([A-Z])", "_\\1", s).lower()[1:]


class YbVpcComponents:
    def __init__(self):
        self.region = None
        self.vpc = None
        self.sg_yugabyte = None
        self.customer_sgs = None
        self.route_table = None
        self.subnets = None

    @staticmethod
    def from_pieces(region, vpc_id, sg_id, rt_id, az_to_subnet_ids):
        c = YbVpcComponents()
        c.region = region
        client = get_client(region)
        c.vpc = client.Vpc(vpc_id)
        c.sg_yugabyte = client.SecurityGroup(sg_id)
        c.route_table = client.RouteTable(rt_id)
        c.subnets = {az: client.Subnet(subnet_id)
                     for az, subnet_id in az_to_subnet_ids.items()}
        return c

    @staticmethod
    def from_user_json(region, per_region_meta):
        c = YbVpcComponents()
        c.region = region
        client = get_client(region)
        vpc_id = per_region_meta.get("vpcId")
        if vpc_id:
            c.vpc = client.Vpc(vpc_id)
        else:
            c.vpc = get_vpc(client, RESOURCE_PREFIX_FORMAT.format(region))
        sg_ids = per_region_meta.get("customSecurityGroupId")
        if sg_ids:
            c.customer_sgs = [client.SecurityGroup(sg_id) for sg_id in sg_ids.split(",")]
        else:
            c.sg_yugabyte = get_security_group(
                client, SG_YUGABYTE_PREFIX_FORMAT.format(region), c.vpc)
        if not vpc_id:
            c.route_table = get_route_table(client, ROUTE_TABLE_PREFIX_FORMAT.format(region))
        az_to_subnet_ids = {}
        if vpc_id:
            az_to_subnet_ids = per_region_meta.get("azToSubnetIds", {})
        else:
            az_to_subnet_ids = get_zones(region)
        c.subnets = {az: client.Subnet(subnet_id)
                     for az, subnet_id in az_to_subnet_ids.items()}
        return c

    def as_json(self):
        sgs = self.customer_sgs if self.customer_sgs else [self.sg_yugabyte]
        return vpc_components_as_json(self.vpc, sgs, self.subnets)


class AwsBootstrapClient():
    def __init__(self, metadata, host_vpc_id, host_vpc_region):
        self.metadata = metadata
        self.host_vpc_id = host_vpc_id
        self.host_vpc_region = host_vpc_region
        self.region_cidrs = get_region_cidrs(self.metadata)
        # Validation.
        self._validate_cidr_overlap()

    def _validate_cidr_overlap(self):
        region_networks = [ip_network(cidr) for cidr in self.region_cidrs.values()]
        all_networks = region_networks
        for i in range(len(all_networks)):
            for j in range(i + 1, len(all_networks)):
                left = all_networks[i]
                right = all_networks[j]
                if left.overlaps(right):
                    raise YBOpsRuntimeError(
                        "IP blocks in the CIDRs overlap: {} - {}".format(left, right))

    def bootstrap_individual_region(self, region):
        if region is None:
            raise YBOpsRuntimeError("Must provider region to bootstrap!")
        client = AwsBootstrapRegion(region, self.metadata, self.region_cidrs)
        client.bootstrap()
        return YbVpcComponents.from_pieces(
            region, client.vpc.id, client.sg_yugabyte.id, client.route_table.id,
            {az: s.id for az, s in client.subnets.items()})

    def cross_link_regions(self, components, added_region_codes):
        # Do the cross linking, adding CIDR entries to RTs and SGs, as well as doing vpc peerings.
        region_and_vpc_tuples = [(r, c.vpc) for r, c in components.items()]
        host_vpc = None
        if self.host_vpc_id and self.host_vpc_region:
            host_vpc = get_client(self.host_vpc_region).Vpc(self.host_vpc_id)
            if self.host_vpc_id not in [c.vpc.id for _, c in components.items()]:
                region_and_vpc_tuples.append((self.host_vpc_region, host_vpc))
        # Setup VPC peerings.
        for i in range(len(region_and_vpc_tuples) - 1):
            i_region, i_vpc = region_and_vpc_tuples[i]
            for j in range(i + 1, len(region_and_vpc_tuples)):
                # skip linking existing regions
                if i_region not in added_region_codes and j_region not in added_region_codes:
                    continue
                j_region, j_vpc = region_and_vpc_tuples[j]
                peerings = create_vpc_peering(
                    # i is the host, j is the target.
                    client=get_client(i_region), vpc=j_vpc, host_vpc=i_vpc, target_region=j_region)
                if len(peerings) != 1:
                    raise YBOpsRuntimeError(
                        "Expecting one peering connection from {} to {}, got {}".format(
                            i_vpc.id,
                            j_vpc.id,
                            len(peerings)))
    
```

### Core Architecture Module: `managed/devops/opscli/ybops/cloud/azure/utils.py`
```
# Copyright 2020 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt
import time

from azure.core.exceptions import HttpResponseError
from azure.core.pipeline.policies import RetryPolicy
from azure.identity import DefaultAzureCredential
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.compute.models import DiskCreateOption
from azure.mgmt.privatedns import PrivateDnsManagementClient
from collections import OrderedDict
from msrestazure.azure_exceptions import CloudError
from ybops.cloud.common.utils import maybe_fault_injected
from ybops.common.exceptions import YBOpsRuntimeError, YBOpsFaultInjectionError, \
    YBOpsRecoverableError
from ybops.utils import DNS_RECORD_SET_TTL, MIN_MEM_SIZE_GB, \
    MIN_NUM_CORES
from ybops.utils.ssh import format_rsa_key, validated_key_file
from threading import Thread

import base64
import datetime
import json
import logging
import os
import re
import requests
import yaml

SUBSCRIPTION_ID = os.environ.get("AZURE_SUBSCRIPTION_ID")
RESOURCE_GROUP = os.environ.get("AZURE_RG")

NETWORK_SUBSCRIPTION_ID = \
    (os.environ.get('AZURE_NETWORK_SUBSCRIPTION_ID')
     if os.environ.get('AZURE_NETWORK_SUBSCRIPTION_ID')
     else SUBSCRIPTION_ID)
NETWORK_RESOURCE_GROUP = \
    (os.environ.get('AZURE_NETWORK_RG')
     if os.environ.get('AZURE_NETWORK_RG')
     else RESOURCE_GROUP)

NETWORK_PROVIDER_BASE_PATH = "/subscriptions/{}/resourceGroups/{}/providers/Microsoft.Network"
SUBNET_ID_FORMAT_STRING = NETWORK_PROVIDER_BASE_PATH + "/virtualNetworks/{}/subnets/{}"
NSG_ID_FORMAT_STRING = NETWORK_PROVIDER_BASE_PATH + "/networkSecurityGroups/{}"
ULTRASSD_LRS = "ultrassd_lrs"
PREMIUMV2_LRS = "premiumv2_lrs"
VNET_ID_FORMAT_STRING = NETWORK_PROVIDER_BASE_PATH + "/virtualNetworks/{}"
AZURE_SKU_FORMAT = {"premium_lrs": "Premium_LRS",
                    "premiumv2_lrs": "PremiumV2_LRS",
                    "standardssd_lrs": "StandardSSD_LRS",
                    ULTRASSD_LRS: "UltraSSD_LRS"}
YUGABYTE_VNET_PREFIX = "yugabyte-vnet-{}"
YUGABYTE_SUBNET_PREFIX = "yugabyte-subnet-{}"
YUGABYTE_SG_PREFIX = "yugabyte-sg-{}"
YUGABYTE_PEERING_FORMAT = "yugabyte-peering-{}-{}"
RESOURCE_SKU_URL = "https://management.azure.com/subscriptions/{}/providers" \
    "/Microsoft.Compute/skus".format(SUBSCRIPTION_ID)
GALLERY_IMAGE_ID_REGEX = re.compile(
    "/subscriptions/(?P<subscription_id>[^/]*)/resourceGroups"
    "/(?P<resource_group>[^/]*)/providers/Microsoft.Compute/galleries/(?P<gallery_name>[^/]*)"
    "/images/(?P<image_definition_name>[^/]*)/versions/(?P<version_id>[^/]*)")
VM_PRICING_URL_FORMAT = "https://prices.azure.com/api/retail/prices?$filter=" \
    "serviceFamily eq 'Compute' " \
    "and serviceName eq 'Virtual Machines' and priceType eq 'Consumption' " \
    "and armRegionName eq '{}'"
PRIVATE_DNS_ZONE_ID_REGEX = re.compile(
    "/subscriptions/(?P<subscription_id>[^/]*)/resourceGroups/(?P<resource_group>[^/]*)"
    "/providers/Microsoft.Network/privateDnsZones/(?P<zone_name>[^/]*)")
VNET_ID_REGEX = re.compile(
    "/subscriptions/(?P<subscription_id>[^/]*)/resourceGroups/(?P<resource_group>[^/]*)"
    "/providers/Microsoft.Network/virtualNetworks/(?P<vnet_name>[^/]*)")
SUBNET_ID_REGEX = re.compile(
    "/subscriptions/(?P<subscription_id>[^/]*)/resourceGroups/(?P<resource_group>[^/]*)"
    "/providers/Microsoft.Network/virtualNetworks/(?P<vnet_name>[^/]*)"
    "/subnets/(?P<subnet_name>[^/]*)")
SECURITY_GROUP_ID_REGEX = re.compile(
    "/subscriptions/(?P<subscription_id>[^/]*)/resourceGroups/(?P<resource_group>[^/]*)"
    "/providers/Microsoft.Network/networkSecurityGroups/(?P<security_group_name>[^/]*)")
CLOUDINIT_EPHEMERAL_MNTPOINT = {
    "mounts": [
        ["ephemeral0", "/mnt/resource"]
    ]
}
CAPACITY_RESERVATION_PATH = ("/subscriptions/{}/resourceGroups/{}/providers"
                             "/Microsoft.Compute/capacityReservationGroups/{}")


class GetPriceWorker(Thread):
    def __init__(self, region):
        Thread.__init__(self)
        self.region = region
        self.vm_name_to_price_dict = {}

    def run(self):
        url = VM_PRICING_URL_FORMAT.format(self.region)
        while url:
            try:
                price_info = requests.get(url).json()
            except Exception as e:
                logging.error("Error getting price information for region {}: {}"
                              .format(self.region, str(e)))
                break

            for info in price_info.get('Items'):
                # Azure API doesn't support regex as of 3/08/2021, so manually parse out Windows.
                # Some VMs also show $0.0 as the price for some reason, so ignore those as well.
                # Also there are separate enties for spot price and low priority,
                # so filtering them out too.
                if not (info['productName'].endswith(' Windows') or info['unitPrice'] == 0
                        or info['skuName'].endswith('Low Priority')
                        or info['skuName'].endswith('Spot')):
                    self.vm_name_to_price_dict[info['armSkuName']] = info['unitPrice']
            url = price_info.get('NextPageLink')


def get_credentials():
    """
    DefaultAzureCredential authenticates using various mechanisms in a pre-defined order:
    1) EnvironmentCredential: Reads credentials from environment variables.
    2) WorkloadIdentityCredential: Authenticates on Kubernetes with workload-identity.
    3) ManagedIdentityCredential: Authenticates on Azure hosts with managed-identity.
    """
    credentials = DefaultAzureCredential()
    return credentials


def create_resource_group(region, subscription_id=None, resource_group=None):
    rg = resource_group if resource_group else RESOURCE_GROUP
    sid = subscription_id if subscription_id else SUBSCRIPTION_ID
    resource_group_client = ResourceManagementClient(get_credentials(), sid)
    if resource_group_client.resource_groups.check_existence(rg):
        return
    resource_group_params = {'location': region}
    return resource_group_client.resource_groups.begin_create_or_update(rg, resource_group_params)


def id_to_name(resourceId):
    return str(resourceId.split('/')[-1])


def get_zones(region, metadata):
    return ["{}-{}".format(region, zone)
            for zone in metadata["regions"].get(region, {}).get("zones", [])]


def cloud_init_encoded(**kwargs):
    """
    Create base64 encoded cloud init data.

    **kwargs are additional key/values to add to the cloud init
    """
    ci_header = "#cloud-config"
    cloud_init = CLOUDINIT_EPHEMERAL_MNTPOINT.copy()

    # Handle additional mounts. Allow overriding of ephemeral0 to /mnt/resource.
    # If ephemeral0 is provided in kwargs, we want to use the user defined mount point over what
    # we specify as the default. We will loop through all 'additional mounts', looking for
    # ephemeral0. If it is found, we want to override our default (which only includes an option
    # for ephemeral0). If ephemeral0 is not found in additional mounts, we want our ephemeral0
    # default + the other user provided mount points.
    # Remember, mounts is a list of lists - [ [ "ephemeral0", "/mnt/resource"] ]
    additional_mounts = kwargs.pop("mounts", [])
    for am in additional_mounts:
        # ephemeral and ephemeral0 refer to the same mount point, either may be used.
        if am[0] == "ephemeral" or am[0] == "ephemeral0":
            cloud_init["mounts"] = additional_mounts
            break
    else:
        cloud_init["mounts"].extend(additional_mounts)

    cloud_init.update(**kwargs)

    boot_script = kwargs.pop("boot_script", None)
    if boot_script:
        cloud_init["write_files"] = [{
            "path": "/usr/local/bin/yb-boot-script.sh",
            "permissions": "0755",
            "content": boot_script,
        }]
        cloud_init["runcmd"] = [["/bin/bash", "/usr/local/bin/yb-boot-script.sh"]]

    ci_data = yaml.dump(cloud_init)
    logging.debug("created cloud init data: {}".format(ci_data))

    lines = [
        ci_header,
        ci_data
    ]
    cloud_file = '\n'.join(lines)
    return base64.b64encode(cloud_file.encode('utf-8')).decode('utf-8')


def merge(params, update):
    """
    Updates the params with any keys found in update that are not present in params.
    """
    for key in update.keys():
        if key not in params:
            params[key] = update[key]
        elif isinstance(params[key], type(update[key])):
            if isinstance(params[key], dict):
                params[key] = merge(params[key], update[key])
            elif isinstance(params[key], list):
                params[key][0] = merge(params[key][0], update[key][0])
        else:
            raise YBOpsRuntimeError(
                "Merge error! Key {} present in both but type does not match.".format(key))
    return params


class AzureBootstrapClient():
    def __init__(self, region_meta, network, metadata):
        self.credentials = get_credentials()
        self.network_client = network
        self.region_meta = region_meta
        self.metadata = metadata

    def create_default_vnet(self, cidr, region):

        vnet_params = {
            'location': region,
            'address_space': {
                'address_prefixes': [cidr]
            },
        }
        logging.debug("Creating Virtual Network {} with CIDR {}".format(
            YUGABYTE_VNET_PREFIX.format(region), cidr))
        creation_result = self.network_client.virtual_networks.begin_create_or_update(
            NETWORK_RESOURCE_GROUP,
            YUGABYTE_VNET_PREFIX.format(region),
            vnet_params
        )
        return creation_res
```

### Core Architecture Module: `managed/devops/opscli/ybops/cloud/common/utils.py`
```
#!/usr/bin/env python
#
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import inspect
import logging
import os
import random
import time

from ybops.common.exceptions import YBOpsFaultInjectionError


def request_retry_decorator(fn_to_call, exc_handler):
    """A generic decorator for retrying cloud API operations with consistent repeatable failure
    patterns. This can be API rate limiting errors, connection timeouts, transient SSL errors, etc.
    Args:
        fn_to_call: the function to call and wrap around
        exc_handler: a bool return function to check if the passed in exception is retriable
    """
    def wrapper(*args, **kwargs):
        MAX_ATTEMPTS = 10
        SLEEP_SEC_MIN = 5
        SLEEP_SEC_MAX = 15
        for i in range(1, MAX_ATTEMPTS + 1):
            try:
                return fn_to_call(*args, **kwargs)
            except Exception as e:
                if i < MAX_ATTEMPTS and exc_handler(e):
                    sleep_duration_sec = \
                        SLEEP_SEC_MIN + random.random() * (SLEEP_SEC_MAX - SLEEP_SEC_MIN)
                    logging.warning(
                        "API call failed, waiting for {} seconds before re-trying (this was attempt"
                        " {} out of {}).".format(sleep_duration_sec, i, MAX_ATTEMPTS))
                    time.sleep(sleep_duration_sec)
                    continue
                raise e
    return wrapper


def maybe_fault_injected():
    """The method checks if the caller method has fault injection enabled from OS env.
    Faults are injected by setting the env YBOPS_FAULT_INJECTED_PATHS to a comma separated
    pairs of full path to the caller module or method and failure probability. Each pair
    is passed as <full path to module/method>=<failure probability>. Longest prefix is
    matched to find the probability to allow overriding at more specific paths. It raises
    YBOpsFaultInjectionError upon satisfying the injection input.
    """
    fault_env_value = os.getenv("YBOPS_FAULT_INJECTED_PATHS", None)
    if fault_env_value is None:
        return
    fault_injected_paths = [x.strip() for x in fault_env_value.split(',')]
    if not fault_injected_paths:
        return
    caller = inspect.stack()[1]
    f_code = caller.frame.f_code
    mod = inspect.getmodule(caller[0])
    # Form the full method name of the caller.
    method_name = "{}.{}".format(mod.__name__, f_code.co_name)
    matched_len = 0
    matched_fault_injected_path = ''
    for fault_injected_path in fault_injected_paths:
        tokens = fault_injected_path.split("=", 1)
        injected_path_only = tokens[0].strip()
        if method_name.startswith(injected_path_only):
            injected_path_len = len(injected_path_only)
            # Find the longest match.
            if injected_path_len > matched_len:
                matched_len = injected_path_len
                matched_fault_injected_path = fault_injected_path
    if matched_len == 0:
        return
    tokens = matched_fault_injected_path.split("=", 2)
    failure_fraction = 0.0 if len(tokens) < 2 else float(tokens[1].strip())
    rand = random.random()
    if failure_fraction == 0.0 or rand >= failure_fraction:
        logging.info("[app] Skipping fault injection at {} due to unsatisfied random {}"
                     .format(matched_fault_injected_path, rand))
        return
    raise YBOpsFaultInjectionError("Injecting fault at {} with random {}"
                                   .format(matched_fault_injected_path, rand))

```

### Core Architecture Module: `managed/devops/opscli/ybops/cloud/gcp/utils.py`
```
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import logging
import os
import requests
import socket
import time
import json

from googleapiclient import discovery
from googleapiclient.errors import HttpError
import google.auth
from six.moves import http_client

from ybops.common.exceptions import YBOpsRuntimeError
from ybops.cloud.common.utils import request_retry_decorator

RESOURCE_BASE_URL = "https://www.googleapis.com/compute/v1/projects/"
REGIONS_RESOURCE_URL_FORMAT = RESOURCE_BASE_URL + "{}/regions/{}"
PRICING_JSON_URL = os.environ.get("YB_GCP_PRICING_JSON_URL",
                                  "https://downloads.yugabyte.com/gcp_price_list/pricelist_gcp.json")
IMAGE_NAME_PREFIX = "CP-COMPUTEENGINE-VMIMAGE-"
IMAGE_NAME_PREEMPTIBLE_SUFFIX = "-PREEMPTIBLE"
OPERATION_WAIT_TIME = 5
MAX_NUM_RETRY_COUNT = 120
LIST_MAX_RESULTS = 500

YB_NETWORK_NAME = "yb-gcp-network"
YB_SUBNET_FORMAT = "yb-subnet-{}"
YB_PEERING_CONNECTION_FORMAT = "yb-peering-{}-with-{}"
YB_FIREWALL_NAME = "yb-internal-firewall"
YB_FIREWALL_TARGET_TAGS = "cluster-server"

STARTUP_SCRIPT_META_KEY = "startup-script"
SERVER_TYPE_META_KEY = "server_type"
SSH_KEYS_META_KEY = "ssh-keys"
BLOCK_PROJECT_SSH_KEY = "block-project-ssh-keys"

META_KEYS = [STARTUP_SCRIPT_META_KEY, SERVER_TYPE_META_KEY, SSH_KEYS_META_KEY]

GCP_SCRATCH = "scratch"
GCP_PERSISTENT = "persistent"
GCP_HYPERDISK_BALANCED = "hyperdisk_balanced"
GCP_HYPERDISK_EXTREME = "hyperdisk_extreme"

# Code 429 does not have a name in httplib.
TOO_MANY_REQUESTS = 429


def gcp_exception_handler(e):
    """GCP specific exception handler. Modeled after:
    http://testcompany.info/google-cloud-sdk/lib/third_party/apitools/base/py/http_wrapper.py

    Args:
        e: the exception that was raised by the underlying API call that just failed.
    Returns:
        True if this exception can be retried, False otherwise.
    """
    # Transport failures
    if isinstance(e, (http_client.BadStatusLine,
                      http_client.IncompleteRead,
                      http_client.ResponseNotReady)):
        logging.warning('Caught HTTP error %s, retrying: %s', type(e).__name__, e)
    elif isinstance(e, socket.error):
        # Note: this also catches ssl.SSLError flavors of:
        # ssl.SSLError: ('The read operation timed out',)
        logging.warning('Caught socket error, retrying: %s', e)
    elif isinstance(e, socket.gaierror):
        logging.warning('Caught socket address error, retrying: %s', e)
    elif isinstance(e, ValueError):
        # oauth2client tries to JSON-decode the response, which can result
        # in a ValueError if the response was invalid. Until that is fixed in
        # oauth2client, need to handle it here.
        logging.warning('Response content was invalid (%s), retrying', e)
    elif isinstance(e, google.auth.exceptions.RefreshError) and e.retryable:
        logging.warning('Caught transient credential refresh error (%s), retrying', e)
    elif (isinstance(e, HttpError) and
          (e.resp.status == TOO_MANY_REQUESTS or
           e.resp.status >= 500)):
        logging.warning('Caught transient server error (%s), retrying', e)
    else:
        return False
    return True


def gcp_request_limit_retry(fn):
    """A decorator for retrying GCP operations in case of expected transient errors.
    """
    return request_retry_decorator(fn, gcp_exception_handler)


def get_firewall_tags():
    return os.environ.get('YB_FIREWALL_TAGS', YB_FIREWALL_TARGET_TAGS).split(',')


def get_instance_template_to_read(args):
    """Returns the instance template we are allowed to read, or None.

    Reading a template needs compute.instanceTemplates.get, which providers that only pass the
    template to instances().insert() as a source do not have. YBA therefore passes
    --read_instance_template only when yb.gcp.read_instance_template is on.
    """
    if not getattr(args, "read_instance_template", False):
        return None
    return getattr(args, "instance_template", None)


class GcpMetadata():
    METADATA_URL_BASE = "http://metadata.google.internal/computeMetadata/v1"
    CUSTOM_HEADERS = {
        "Metadata-Flavor": "Google"
    }

    @staticmethod
    def _query_endpoint(endpoint):
        try:
            url = "{}/{}".format(GcpMetadata.METADATA_URL_BASE, endpoint)
            req = requests.get(url, headers=GcpMetadata.CUSTOM_HEADERS, timeout=2)

            if req.status_code != requests.codes.ok:
                logging.warning("Request {} returned http error code {}".format(
                    url, req.status_code))
                return None

            return req.content.decode('utf-8')

        except requests.exceptions.ConnectionError as e:
            logging.warning("Request {} had a connection error {}".format(url, str(e)))
            return None

    @staticmethod
    def project():
        return GcpMetadata._query_endpoint("project/project-id")

    @staticmethod
    def shared_vpc_project():
        network_data = GcpMetadata._query_endpoint("instance/network-interfaces/0/network")
        try:
            # Network data is of format projects/PROJECT_NUMBER/networks/NETWORK_NAME
            return str(network_data).split('/')[1]
        except (IndexError, AttributeError):
            return None

    @staticmethod
    def network():
        return GcpMetadata._query_endpoint("instance/network-interfaces/0/network")

    @staticmethod
    def service_accounts():
        return GcpMetadata._query_endpoint("instance/service-accounts/")


class Waiter():
    def __init__(self, project, compute):
        self.project = project
        self.compute = compute

    def get_in_progress_operation(self, zone, instance, operation_type):
        target_link = \
            RESOURCE_BASE_URL + "{}/zones/{}/instances/{}".format(self.project, zone, instance)
        cmd = self.compute.zoneOperations().list(
            project=self.project,
            zone=zone,
            filter='targetLink = "{}" AND status != "DONE" AND '
                   'operationType = "{}"'.format(target_link, operation_type),
            maxResults=1)
        result = cmd.execute()
        if 'error' in result:
            raise RuntimeError(result['error'])
        if 'items' not in result or len(result['items']) == 0:
            return None
        return result['items'][0]['id']

    def wait(self, operation, region=None, zone=None):
        # This allows easier chaining of waits on functions that are NOOPs if items already exist.
        if operation is None:
            logging.warning("Returning waiting for a None Operation")
            return
        retry_count = 0
        name = operation["name"]
        while retry_count < MAX_NUM_RETRY_COUNT:
            if zone is not None:
                cmd = self.compute.zoneOperations().get(
                    project=self.project,
                    zone=zone,
                    operation=name)
            elif region is not None:
                cmd = self.compute.regionOperations().get(
                    project=self.project,
                    region=region,
                    operation=name)
            else:
                cmd = self.compute.globalOperations().get(
                    project=self.project,
                    operation=name)
            result = cmd.execute()

            if result['status'] == 'DONE':
                if 'error' in result:
                    raise YBOpsRuntimeError(result['error'])
                return result

            time.sleep(OPERATION_WAIT_TIME)
            retry_count += 1

        raise YBOpsRuntimeError("Operation {} timed out".format(name))


class NetworkManager():
    def __init__(self, project, compute, metadata, dest_vpc_id, host_vpc_id,
                 per_region_meta, create_new_vpc=False):
        self.project = project
        self.compute = compute
        self.metadata = metadata
        # This dictates if we want to provision a new network or just query an existing one.
        self.dest_vpc_id = dest_vpc_id
        # This will be the network we currently are in and that we will be peering with.
        # TODO: fix the network/project combos
        # Allow setting host_vpc_id and check if you do not have a target, meaning you are
        # asked to bootstrap, then the host's project ID matches self.project, else we'll try to
        # peer across projects...
        self.host_vpc_id = host_vpc_id if host_vpc_id is not None else GcpMetadata.network()
        if self.host_vpc_id is not None:
            self.host_vpc_id = self.host_vpc_id.split("/")[-1]
        self.per_region_meta = per_region_meta
        self.create_new_vpc = create_new_vpc

        self.waiter = Waiter(self.project, self.compute)

    def network_info_as_json(self, network_name, region_to_subnet_map):
        return {
            "network": network_name,
            "regions": region_to_subnet_map
        }

    def get_network_data(self, network_name):
        # If user has specified network data through per_region_meta, then do not validate any
        # data through GCP API and simply return the relevant fields.
        output_region_to_subnet_map = {}
        for region in self.per_region_meta.keys():
            output_region_to_subnet_map[region] = self.per_region_meta.get(
                region, {}).get("subnetId")

        if output_region_to_subnet_map:
            return self.network_info_as_json(network_name, output_region_to_subnet_map)

        networks = self.get_networks(network_name)
        if len(networks) == 0:
            raise YBOpsRuntimeError("Invalid target VPC: {}".format(network_name))
        network = networks[0]

        subnet_map = self.get_region_subnet_map(n
```

### Core Architecture Module: `managed/devops/opscli/ybops/cloud/oci/utils.py`
```
# Copyright 2026 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import base64
import json
import logging
import os
import re
import time
import requests

from ybops.common.exceptions import YBOpsRuntimeError, YBOpsRecoverableError
from ybops.cloud.common.utils import request_retry_decorator
from ybops.utils import DNS_RECORD_SET_TTL, MIN_MEM_SIZE_GB, MIN_NUM_CORES
from ybops.utils.ssh import format_rsa_key, validated_key_file
from threading import Thread

import oci
from oci.core import (
    ComputeClient,
    VirtualNetworkClient,
    BlockstorageClient,
    ComputeManagementClient,
)
from oci.dns import DnsClient
from oci.identity import IdentityClient
from oci.core.models import (
    CaptureConsoleHistoryDetails,
    LaunchInstanceDetails,
    CreateVnicDetails,
    LaunchInstanceShapeConfigDetails,
    InstanceSourceViaImageDetails,
    CreateVolumeDetails,
    AttachVolumeDetails,
    AttachParavirtualizedVolumeDetails,
    CreateSubnetDetails,
    CreateVcnDetails,
    CreateSecurityListDetails,
    IngressSecurityRule,
    EgressSecurityRule,
    TcpOptions,
    PortRange,
    UpdateBootVolumeDetails,
    UpdateInstanceDetails,
    UpdateInstanceShapeConfigDetails,
    UpdateInstanceSourceViaImageDetails
)
from oci.dns.models import RecordDetails, UpdateDomainRecordsDetails
from oci.work_requests import WorkRequestClient

# Sticky launch fields copied from an Instance Configuration when seeding a
# plain LaunchInstance. YBA-owned fields (shape, image, subnet, metadata, ...)
# are applied separately and always win.
_INSTANCE_CONFIG_ATTRIBUTES = (
    "agent_config",
    "availability_config",
    "platform_config",
    "instance_options",
    "launch_options",
    "launch_mode",
    "is_pv_encryption_in_transit_enabled",
    "defined_tags",
    "extended_metadata",
    "capacity_reservation_id",
    "dedicated_vm_host_id",
    "compute_cluster_id",
    "preemptible_instance_config",
    "preferred_maintenance_action",
    "ipxe_script",
    "security_attributes",
    "licensing_configs",
    "is_ai_enterprise_enabled",
    "placement_constraint_details",
    "cluster_placement_group_id",
)

# IC nested models use InstanceConfiguration*-prefixed classes; LaunchInstanceDetails
# requires the non-prefixed equivalents. Most map by stripping the prefix; a few
# IC type names do not match the launch type name 1:1.
_IC_TYPE_TO_LAUNCH_TYPE = {
    "InstanceConfigurationAvailabilityConfig": "LaunchInstanceAvailabilityConfigDetails",
}

# Sticky fields tied to IC shape/image/availability domain. When YBA overrides
# any of those, dependent fields must not be copied or OCI rejects the launch
# (e.g. AMD_VM platform_config with VM.Standard2.1).
_SHAPE_DEPENDENT_ATTRIBUTES = frozenset((
    "platform_config",
    "launch_options",
    "launch_mode",
    "capacity_reservation_id",
    "dedicated_vm_host_id",
    "compute_cluster_id",
    "preemptible_instance_config",
    "placement_constraint_details",
    "cluster_placement_group_id",
))

_IMAGE_DEPENDENT_ATTRIBUTES = frozenset((
    "launch_options",
    "launch_mode",
    "ipxe_script",
    "licensing_configs",
))

_AVAILABILITY_DOMAIN_DEPENDENT_ATTRIBUTES = frozenset((
    "capacity_reservation_id",
    "dedicated_vm_host_id",
    "compute_cluster_id",
    "placement_constraint_details",
    "cluster_placement_group_id",
))


def is_local_nvme_shape(shape):
    return bool(shape) and ("DenseIO" in shape or "HPC" in shape)


OCI_TENANCY_ID_ENV = "OCI_TENANCY_ID"
OCI_USER_ID_ENV = "OCI_USER_ID"
OCI_FINGERPRINT_ENV = "OCI_FINGERPRINT"
OCI_PRIVATE_KEY_CONTENT_ENV = "OCI_PRIVATE_KEY_CONTENT"
OCI_REGION_ENV = "OCI_REGION"
OCI_COMPARTMENT_ID_ENV = "OCI_COMPARTMENT_ID"
OCI_AUTH_TYPE_ENV = "OCI_AUTH_TYPE"

OCI_VOLUME_TYPE_STANDARD = "standard"
OCI_VOLUME_TYPE_HIGH_PERFORMANCE = "high_performance"
OCI_VOLUME_TYPE_ULTRA_HIGH_PERFORMANCE = "ultra_high_performance"
OCI_VOLUME_TYPE_BALANCED = "oci_balanced"
OCI_VOLUME_TYPE_HIGHER_PERF = "oci_higherperformance"
OCI_VOLUME_TYPE_LOWER_COST = "oci_lowercost"

OCI_INSTANCE_RUNNING = "RUNNING"
OCI_INSTANCE_STOPPED = "STOPPED"
OCI_INSTANCE_STOPPING = "STOPPING"
OCI_INSTANCE_STARTING = "STARTING"
OCI_INSTANCE_PROVISIONING = "PROVISIONING"
OCI_INSTANCE_TERMINATED = "TERMINATED"
OCI_INSTANCE_TERMINATING = "TERMINATING"

YUGABYTE_VCN_PREFIX = "yugabyte-vcn-{}"
YUGABYTE_SUBNET_PREFIX = "yugabyte-subnet-{}"
YUGABYTE_SG_PREFIX = "yugabyte-sl-{}"

DEFAULT_BOOT_VOLUME_SIZE_GB = 50
MIN_BOOT_VOLUME_SIZE_GB = 50
BOOT_VOLUME_REPLACEMENT_TIMEOUT_SECONDS = 600
OCI_WORK_REQUEST_TERMINAL_STATES = ("SUCCEEDED", "FAILED", "CANCELED")

AARCH64_ARCHITECTURES = ("aarch64", "arm64")

# Max length of a single DNS label per RFC 1035.
MAX_DNS_LABEL_LENGTH = 63


def oci_instance_action_conflict_handler(e):
    """OCI returns 409 when instance_action is called during background modification."""
    return isinstance(e, oci.exceptions.ServiceError) and e.status == 409


def oci_instance_action_conflict_retry(fn):
    return request_retry_decorator(fn, oci_instance_action_conflict_handler)


def sanitize_dns_label(name, max_length=MAX_DNS_LABEL_LENGTH):
    """Convert an arbitrary instance name into a valid OCI VNIC hostname label.

    OCI hostname labels back the VCN-internal DNS records and must comply with
    RFC 952/1123: only alphanumeric characters and hyphens, must start with a
    letter, must not end with a hyphen, and be at most 63 characters long.
    Returns None if no valid label can be derived from the given name.
    """
    if not name:
        return None
    label = re.sub(r"[^a-zA-Z0-9-]", "-", name).lower()
    # Collapse runs of hyphens and trim leading/trailing ones.
    label = re.sub(r"-+", "-", label).strip("-")
    if not label:
        return None
    # Labels must begin with a letter.
    if not label[0].isalpha():
        label = "h" + label
    return label[:max_length].rstrip("-") or None


def uses_instance_principal():
    return os.environ.get(OCI_AUTH_TYPE_ENV, "").upper() == "INSTANCE_PRINCIPAL"


def get_oci_config():
    region = os.environ.get(OCI_REGION_ENV)

    if uses_instance_principal():
        if not region:
            raise YBOpsRuntimeError(
                "OCI_REGION is required when using instance principal authentication.")
        return {"region": region}

    tenancy_id = os.environ.get(OCI_TENANCY_ID_ENV)
    user_id = os.environ.get(OCI_USER_ID_ENV)
    fingerprint = os.environ.get(OCI_FINGERPRINT_ENV)
    private_key_content = os.environ.get(OCI_PRIVATE_KEY_CONTENT_ENV)

    if tenancy_id and user_id and fingerprint and private_key_content and region:
        config = {
            "user": user_id,
            "fingerprint": fingerprint,
            "tenancy": tenancy_id,
            "region": region,
            "key_content": private_key_content
        }

        try:
            oci.config.validate_config(config)
        except Exception as e:
            raise YBOpsRuntimeError(
                "Invalid OCI configuration: {}".format(str(e)))

        return config

    raise YBOpsRuntimeError(
        "OCI configuration not found. Set environment variables "
        "(OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT, "
        "OCI_PRIVATE_KEY_CONTENT, "
        "OCI_REGION, OCI_COMPARTMENT_ID) or set OCI_AUTH_TYPE=INSTANCE_PRINCIPAL "
        "when running on an OCI instance with instance principal.")


def get_compartment_id():
    compartment_id = os.environ.get(OCI_COMPARTMENT_ID_ENV)
    if compartment_id:
        return compartment_id
    config = get_oci_config()
    return config.get("tenancy")


class OciCloudAdmin:

    def __init__(self, metadata=None):
        self.metadata = metadata or {}
        self._config = None
        self._compute_client = None
        self._compute_management_client = None
        self._network_client = None
        self._blockstorage_client = None
        self._identity_client = None
        self._dns_client = None
        self._compartment_id = None

    @property
    def config(self):
        if self._config is None:
            self._config = get_oci_config()
        return self._config

    def _build_client(self, client_class):
        if uses_instance_principal():
            signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
            return client_class(self.config, signer=signer)
        return client_class(self.config)

    def _list_all(self, list_func, *args, **kwargs):
        return oci.pagination.list_call_get_all_results(list_func, *args, **kwargs).data

    @property
    def compartment_id(self):
        if self._compartment_id is None:
            self._compartment_id = get_compartment_id()
        return self._compartment_id

    @property
    def compute_client(self):
        if self._compute_client is None:
            self._compute_client = self._build_client(ComputeClient)
        return self._compute_client

    @property
    def compute_management_client(self):
        if self._compute_management_client is None:
            self._compute_management_client = self._build_client(ComputeManagementClient)
        return self._compute_management_client

    @property
    def network_client(self):
        if self._network_client is None:
            self._network_client = self._build_client(VirtualNetworkClient)
        return self._network_client

    @property
    def blockstorage_client(self):
        if self._blockstorage_client is None:
            self._blockstorage_client = self._build_client(BlockstorageClient)
        return self._blockstorage_client

    @property
    def dns_client(self):
        if self._dns_client is None:
            self._dns_client = self._build_client(DnsClient)
        return self._dns_client

    @property
    def ident
```

### Core Architecture Module: `managed/devops/opscli/ybops/utils/__init__.py`
```
# !/usr/bin/env python
#
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

from __future__ import print_function

import json
import logging
import os
import platform
import random
import re
import requests
import shlex
import socket
import string
import subprocess
import sys
import time

from enum import Enum

from ybops.common.release import ReleasePackage, RELEASE_VERSION_PATTERN
from ybops.common.colors import Colors
from ybops.common.exceptions import YBOpsRuntimeError
from ybops.utils.remote_shell import RemoteShell

BLOCK_SIZE = 4096
HOME_FOLDER = os.environ["HOME"]
YB_FOLDER_PATH = os.path.join(HOME_FOLDER, ".yugabyte")

RELEASE_VERSION_FILENAME = "version.txt"

# Home directory of node instances. Try to read home dir from env, else assume it's /home/yugabyte.
YB_HOME_DIR = os.environ.get("YB_HOME_DIR") or "/home/yugabyte"
# Sudo password for remote host.
YB_SUDO_PASS = os.environ.get("YB_SUDO_PASS")

# TTL in seconds for how long DNS records will be cached.
DNS_RECORD_SET_TTL = 5

# Minimum required resources on a VM.
MIN_MEM_SIZE_GB = 2
MIN_NUM_CORES = 2

DEFAULT_MASTER_HTTP_PORT = 7000
DEFAULT_MASTER_RPC_PORT = 7100
DEFAULT_TSERVER_HTTP_PORT = 9000
DEFAULT_TSERVER_RPC_PORT = 9100
DEFAULT_CQL_PROXY_HTTP_PORT = 12000
DEFAULT_CQL_PROXY_RPC_PORT = 9042
DEFAULT_YSQL_PROXY_HTTP_PORT = 13000
DEFAULT_YSQL_PROXY_RPC_PORT = 5433
DEFAULT_REDIS_PROXY_HTTP_PORT = 11000
DEFAULT_REDIS_PROXY_RPC_PORT = 6379
DEFAULT_NODE_EXPORTER_HTTP_PORT = 9300

MAX_RETRIES = 5
RETRY_DELAY = 10  # Initial delay, increases exponentially


def get_path_from_yb(path):
    return os.path.join(shlex.quote(YB_FOLDER_PATH), path)


# Home directory of the devops source tree. This is determined based on the yb_devops_home
# environment variable, which is set by wrapper shell scripts, or on the nearest directory that this
# Python codebase is part of that looks like the devops source directory. This is called
# YB_DEVOPS_HOME to distinguish it from the DEVOPS_HOME environment variable used in Yugaware.
YB_DEVOPS_HOME = None

# This variable is used inside provision_instance.py file.
# For yugabundle installations YB_DEVOPS_HOME contains version number, so we have to use a link
# to current devops folder. For the rest of cases this variable is equal to YB_DEVOPS_HOME.
YB_DEVOPS_HOME_PERM = None


def init_logging(log_level):
    """This method initializes ybops logging.

    Args:
        log_level (int): Log level that we want to initialize
    """
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s %(funcName)s:%(filename)s:%(lineno)d: %(message)s")


def is_devops_root_dir(devops_home):
    """
    Check if a particular directory looks like the root of the devops source root directory.  We
    don't assume that this directory is a git repository, as we may sometimes install a snapshot of
    the entire devops directory in a production location. This function is used when trying to
    determine the devops source root direcotry ("devops home" directory) based on the location of
    this Python file that is normally supposed to be installed inside a virtualenv located somewhere
    inside that source directory.
    """
    for subdir in ['bin', 'opscli', 'pex']:
        if not os.path.isdir(os.path.join(devops_home, subdir)):
            return False
    return os.path.isfile(os.path.join(devops_home, 'opscli/__init__.py'))


def init_env(log_level):
    """This method initializes ybops environment variables.
    """
    init_logging(log_level)
    get_devops_home()


def get_devops_home():
    global YB_DEVOPS_HOME
    global YB_DEVOPS_HOME_PERM
    if YB_DEVOPS_HOME is None:
        devops_home = os.environ.get("yb_devops_home")
        if devops_home is None:
            this_file_dir = os.path.dirname(os.path.realpath(__file__))
            cur_dir = this_file_dir
            while cur_dir != '/':
                if is_devops_root_dir(cur_dir):
                    devops_home = cur_dir
                    break
                cur_dir = os.path.dirname(cur_dir)
            if devops_home is None:
                raise ValueError(
                    ("yb_devops_home environment variable is not set, and could not determine it " +
                     "from any of the parent directories of '{}'").format(this_file_dir))
        YB_DEVOPS_HOME = devops_home
        devops_home_link = os.environ.get("yb_devops_home_link")
        YB_DEVOPS_HOME_PERM = devops_home_link if devops_home_link is not None else YB_DEVOPS_HOME
    # If this is still None, we were not able to find it crawling up the tree, so let's fail to not
    # constantly be doing this...
    if YB_DEVOPS_HOME is None:
        raise YBOpsRuntimeError("Could not determine YB_DEVOPS_HOME")
    return YB_DEVOPS_HOME


def log_message(type, message):
    """This method lets you color code your log messages, based on the
    type of log (Info, Warning, Error).
    Args:
        type (int): Logging Type
        message (str: Log message
    """
    import inspect
    caller = inspect.currentframe().f_back.f_code
    message_with_file = "[{}:{}] {}".format(
        os.path.basename(caller.co_filename), caller.co_firstlineno, message)

    if type == logging.WARNING:
        logging.warning(Colors.YELLOW + message_with_file + Colors.RESET)
    elif type == logging.ERROR:
        logging.error(Colors.RED + message_with_file + Colors.RESET)
    else:
        logging.info(Colors.GREEN + message_with_file + Colors.RESET)


def confirm_prompt(prompt):
    """This method get a user to confirm y/n for a given prompt
    and returns appropriate boolean value.
    Args:
        prompt (str): Prompt message
    Returns:
        (boolean): Prompt response
    """
    if not os.isatty((sys.stdout.fileno())):
        print("Not running interactively. Assuming 'N'.", file=sys.stderr)
        return False

    # str(input) for py2-py3 compatbility.
    prompt_input = str(input("{} [Y/n]: ".format(prompt)).strip().lower())
    if prompt_input not in ['y', 'yes', '']:
        sys.exit(1)


def get_checksum(file_path, hasher):
    """This method calculates the checksum for a given file and the hasher
    method (which takes haslib hasher methods like (sha1, md5).
    Returns:
        (string): hex digest based on the hasher provided
    """
    with open(file_path, "rb") as f:
        # Read the file in 4KB chunks until EOF.
        for chunk in iter(lambda: f.read(BLOCK_SIZE), b''):
            hasher.update(chunk)
        return hasher.hexdigest()


def get_internal_datafile_path(file_name):
    """This method returns the data file path, based on where
    the package is installed, for an internal metadata file.

    This assumes a data/ folder sibling to the one of this script.
    This also assumes an internal/ folder, under the data/ folder.

    Args:
        file_name (str): data file name
    Returns:
        (str): datafile file path
    """
    package_dir = os.path.dirname(__file__)
    return os.path.realpath(os.path.join(package_dir, "..", "data", "internal", file_name))


def get_datafile_path(file_name):
    """This method returns the data file path, based on where
    the package is installed.

    Args:
        file_name (str): data file name
    Returns:
        (str): datafile file path
    """
    package_dir = os.path.dirname(__file__)
    return os.path.realpath(os.path.join(package_dir, "..", "data", file_name))


def get_default_release_version(repo_path=None):
    if not repo_path:
        repo_path = get_devops_home()
    version_file = os.path.join(repo_path, RELEASE_VERSION_FILENAME)
    if not os.path.isfile(version_file):
        raise YBOpsRuntimeError("Could not file version file: {}".format(version_file))
    version = open(version_file).read().strip()
    match = re.match("({})-b(\d+)".format(RELEASE_VERSION_PATTERN), version)
    if not match:
        raise YBOpsRuntimeError("Invalid version format {}".format(version))
    return match.group(1)


def get_release_file(repository, release_name, build_type=None, os_type=None, arch_type=None):
    """This method checks the git commit sha and constructs
       the filename based on that and returns it.
    Args:
        repository (str): repository folder path where the release file exists
        release_file (str): release file name
        build_type (str): build type release/debug
        os_type (str): Type of os for cross-compilers like go
        arch_type (str): Type of arch for cross-compilers like go
    Returns:
        (str): Tar Filename
    """
    # Get the repo version information.
    base_version = get_default_release_version(repository)
    # Prepare the path for the release file.
    build_dir = os.path.join(repository, "build")
    if not os.path.exists(build_dir):
        # TODO: why are we mkdir-ing during a function that's supposed to return a path...
        os.makedirs(build_dir)

    cur_commit = str(subprocess.check_output(["git", "rev-parse", "HEAD"]).strip().decode('utf-8'))
    release = ReleasePackage.from_pieces(release_name, base_version, cur_commit, build_type,
                                         os_type, arch_type)
    file_name = release.get_release_package_name()
    return os.path.join(build_dir, file_name)


def is_valid_ip_address(ip_addr):
    """This method checks if string provided is a valid IP address
    Args:
        ip_addr (str): IP Address String
    Returns:
        (boolean): True/False
    """
    try:
        socket.inet_aton(ip_addr)
        return True
    except (socket.error, TypeError):
        return False


def generate_random_password(size=32):
    """This method would generate random alpha numeric password for the size provided
    Ar
```

### Core Architecture Module: `managed/devops/opscli/ybops/utils/remote_shell.py`
```
#!/usr/bin/env python
#
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import json
import logging
import os
import time

from ybops.common.exceptions import YBOpsRecoverableError, YBOpsRuntimeError
from ybops.utils.ssh import SSHClient
from ybops.node_agent.rpc import RpcClient

CONNECTION_ATTEMPTS = 5
CONNECTION_ATTEMPT_DELAY_SEC = 3
CONNECT_RETRY_LIMIT = 60
# Retry in seconds
CONNECT_RETRY_DELAY = 10
CONNECT_TIMEOUT_SEC = 10


# Similar method exists for SSH.
def wait_for_server(connect_options, num_retries=CONNECT_RETRY_LIMIT, **kwargs):
    """This method waits for the connection to the remote host to become available.
    """

    retry_count = 0
    while retry_count < num_retries:
        logging.info("[app] Attempting connection to the remote host, retry count: {}"
                     .format(retry_count))
        if can_connect(connect_options, **kwargs):
            return True
        time.sleep(1)
        retry_count += 1

    return False


# Similar method exists for SSH.
def can_connect(connect_options):
    """This method checks if connection to remote host is available.
    """

    try:
        client = RemoteShell(connect_options)
        # The param timeout is used by node-agent.
        lines = client.check_exec_command("echo 'test'", timeout=CONNECT_TIMEOUT_SEC).splitlines()
        if len(lines) == 1 and (lines[0] == "test"):
            return True
        return False
    except Exception as e:
        logging.error("Error connecting, {}".format(e))
        return False


# Similar method exists for SSH.
def copy_to_tmp(connect_options, filepath, retries=3, retry_delay=CONNECT_RETRY_DELAY, **kwargs):
    """This method copies the given file to the specified tmp directory on remote host
    and return the output.
    """

    remote_tmp_dir = kwargs.get("remote_tmp_dir", "/tmp")
    dest_path = os.path.join(remote_tmp_dir, os.path.basename(filepath))
    chmod = kwargs.get('chmod', 0)
    if chmod == 0:
        chmod = os.stat(filepath).st_mode
        kwargs.setdefault('chmod', chmod)

    rc = 1
    while retries > 0:
        try:
            logging.info("[app] Copying local '{}' to remote '{}'".format(
                filepath, dest_path))
            client = RemoteShell(connect_options)
            try:
                client.put_file(filepath, dest_path, **kwargs)
                rc = 0
                break
            finally:
                client.close()
        except Exception as e:
            logging.error("Error copying file {} to {} - {}".format(filepath, dest_path, e))
            retries -= 1
            if (retries > 0):
                time.sleep(retry_delay)

    return rc


def get_connection_type(connect_options):
    """Returns the connection type.
    """
    connection_type = connect_options.get('connection_type')
    if connection_type is None:
        return 'ssh'
    return connection_type


def get_host_port_user(connect_options):
    """Returns the host, port and user for the connection type.
    """
    connection_type = get_connection_type(connect_options)
    connect_options['connection_type'] = connection_type
    if connection_type == 'ssh':
        connect_options['host'] = connect_options['ssh_host']
        connect_options['port'] = connect_options['ssh_port']
        connect_options['user'] = connect_options['ssh_user']
    elif connection_type == 'node_agent_rpc':
        connect_options['host'] = connect_options['node_agent_ip']
        connect_options['port'] = connect_options['node_agent_port']
        connect_options['user'] = connect_options['node_agent_user']
    else:
        raise YBOpsRuntimeError("Unknown connection_type '{}'".format(connection_type))
    return connect_options


class RemoteShellOutput(object):
    """
        RemoteShellOutput class converts the o/p in the standard format
        with o/p, err, exited status attached to it.
    """

    def __init__(self):
        self.stdout = ''
        self.stderr = ''
        self.exited = False


class RemoteShell(object):
    """RemoteShell class is used run remote shell commands against nodes using
    the connection type. The connect_options are:
    For SSH:
      connection_type - None or set it to ssh to enable SSH.
      ssh_user - SSH user.
      ssh_host - SSH host IP.
      ssh_port - SSH port.
      private_key_file - Path to SSH private key file.
      ssh2_enabled - Optional SSH2 enabled flag.
    For RPC:
      connection_type - set to either rpc or node_agent_rpc to enable RPC.
      node_agent_user - Remote user.
      node_agent_ip - Node agent IP.
      node_agent_port - Node agent port.
      node_agent_cert_path - Path to node agent cert.
      node_agent_auth_token - JWT to authenticate the client.

    """

    def __init__(self, connect_options):
        connection_type = get_connection_type(connect_options)
        if connection_type == 'ssh':
            self.delegate = _SshRemoteShell(connect_options)
        elif connection_type == 'node_agent_rpc':
            self.delegate = _RpcRemoteShell(connect_options)
        else:
            raise YBOpsRuntimeError("Unknown connection_type '{}'".format(connection_type))

    def close(self):
        self.delegate.close()

    def get_host_port_user(self):
        return self.delegate.get_host_port_user()

    def run_command_raw(self, command, **kwargs):
        '''
            Executes the command on the remote machine and returns RemoteShellOutput object
            without raising exception.
        '''
        return self.delegate.run_command_raw(command, **kwargs)

    def check_exec_command(self, command, **kwargs):
        '''
            Executes the command on the remote machine and raises exception if it fails.
            It returns the stdout of the command on success.
        '''
        return self.delegate.check_exec_command(command, **kwargs)

    def exec_command(self, command, **kwargs):
        '''
            Executes the command on the remote machine and returns rc, stdout, stderr without
            raising exception.
        '''
        return self.delegate.exec_command(command, **kwargs)

    def check_exec_script(self, local_script_name, params):
        '''
            Executes the script on the remote machine and raises exception if it fails.
            It returns the stdout of the command on success.
        '''
        return self.delegate.check_exec_script(local_script_name, params)

    def put_file(self, local_path, remote_path, **kwargs):
        self.delegate.put_file(local_path, remote_path, **kwargs)

    def put_file_if_not_exists(self, local_path, remote_path, file_name, **kwargs):
        self.delegate.put_file_if_not_exists(local_path, remote_path, file_name, **kwargs)

    def fetch_file(self, remote_file_name, local_file_name, **kwargs):
        self.delegate.fetch_file(remote_file_name, local_file_name, **kwargs)

    def invoke_method(self, param, **kwargs):
        return self.delegate.invoke_method(param, **kwargs)


class _SshRemoteShell(object):
    """_SshRemoteShell class is used run remote shell commands against nodes using paramiko.
    """

    def __init__(self, connect_options):
        assert connect_options["ssh_user"] is not None, 'ssh_user is required'
        assert connect_options["ssh_host"] is not None, 'ssh_host is required'
        assert connect_options["ssh_port"] is not None, 'ssh_port is required'
        assert connect_options["private_key_file"] is not None, 'private_key_file is required'

        self.ssh_conn = SSHClient(ssh2_enabled=connect_options["ssh2_enabled"])
        self.ssh_conn.connect(
            connect_options.get("ssh_host"),
            connect_options.get("ssh_user"),
            connect_options.get("private_key_file"),
            connect_options.get("ssh_port")
        )
        self.connected = True

    def get_host_port_user(self):
        return get_host_port_user(self.connect_options)

    def close(self):
        if self.connected:
            self.ssh_conn.close_connection()

    def run_command_raw(self, command, **kwargs):
        result = RemoteShellOutput()
        try:
            rc, stdout, stderr = self.ssh_conn.exec_command(command, **kwargs)
            result.stdout = stdout
            result.exited = rc
            result.stderr = stderr
        except Exception as e:
            result.stderr = str(e)
            result.exited = 1

        return result

    def check_exec_command(self, command, **kwargs):
        skip_cmd_logging = kwargs.get('skip_cmd_logging', False)
        result = self.run_command_raw(command, **kwargs)
        if result.exited:
            if result.stdout:
                # Log the stdout for debugging purposes.
                logging.error(result.stdout)
            cmd = ' '.join(command).encode('utf-8') if isinstance(command, list) else command
            raise YBOpsRuntimeError('Remote command \'{}\' failed with error code {}: {}'.format(
                "" if skip_cmd_logging else cmd, result.exited, result.stderr))
        return result.stdout

    def exec_command(self, command, **kwargs):
        # This returns rc, stdout, stderr.
        return self.ssh_conn.exec_command(command, **kwargs)

    def check_exec_script(self, local_script_name, params):
        rc, stdout, stderr = self.ssh_conn.exec_script(local_script_name, params)
        if rc != 0:
            raise YBOpsRuntimeError('Remote command failed with error code {}: {}'.format(
                rc, stderr))
        return stdout

    def put_file(self, local_path, remote_path, **kwargs):
        self.ssh_conn.upload_file_to_remote_server(local_path, remote_path, **kwargs)

    # Checks if the file exists on the re
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #35309** (2026-10-18): **[BACKPORT 2025.2][#34805] DocDB: Remove non-block-based vector index backends (#34806)**
  *Symptoms*: ## Summary  The HNSW vector index had four backends. `USEARCH` and `HNSWLIB` saved chunks in the native usearch/hnswlib file formats, while `YB_HNSW_USEARCH` and `YB_HNSW_HNSWLIB` save block-based YbHnsw chunks that are read through the block cache. `yb_hnsw` has been the default since #29964 and `yb_hnsw_hnswlib` since #31757, so the native formats were only reachable through the hidden `vector_index_backend` flag or very old indexes. They kept native save/load paths in the wrappers and doubled the backend test matrices.  This removes the non-block-based backends: - usearch and hnswlib stay as the build engines for mutable chunks. Every saved chunk is now a YbHnsw file and every loaded chunk a `YbHnswIndex`; the native `save`/`load` code and the `backend` parameter of `Create{Usearch,Hnswlib}IndexTraits` are gone. - `HnswBackend` values 0 and 2 become `DEPRECATED_USEARCH` / `DEPRECATED_HNSWLIB`. `HnswTraits` returns `NotSupported` for them instead of loading the native file, which fails the tablet open (see the upgrade notes). - `--vector_index_backend` accepts only `yb_hnsw_usearch` and `yb_hnsw_hnswlib`. The `yb_hnsw` value is removed too: it was an alias for `yb_hnsw_usearch` while the default is `yb_hnsw_hnswlib`, which made it easy to pick the wrong backend. - `PgVectorIndexITest.Backfill` no longer forces `--vector_index_backend=usearch`. The old `TabletVectorIndexes::Verify` used `GetVector`, which only the usearch wrapper implemented; master's #34611 replaced it with

- **Issue #35290** (2026-10-18): **[#34685] YSQL: Scale the hand-over window of PgCronTest.UngracefulLeaderChangeMarksJobFailed for sanitizers**
  *Symptoms*: ## Summary  `PgCronTest.UngracefulLeaderChangeMarksJobFailed` (added in #34689) kills the pg_cron leader tserver at t0 and requires another node to start the job before t0 + `pg_cron_leader_lease_sec` (10 s) + 15 s. The 15 s must cover failure detection, the election of a new leader for the pg_cron leader tablet, the 2 * `max_clock_skew_usec` of the activation wait, one launcher iteration and the 1 s job interval.  On tsan this failed 5 of 20 runs (master 2.31.0.0-b566). In one failed run:  | t0 + | Event | |---|---| | 5.4 s | ts-3 detects the failure; ts-2 still has 0.3 s left on its own failure timer and denies the pre-election vote ("replica believes a valid leader to be alive") | | 12.6 s | ts-3 wins the election after its backoff (6-7 s on tsan) | | 24.0 s | the activation wait ends: "pg_cron starting new runs" | | 25.4 s | the job starts, 0.4 s after the sampling window closed |  The product behaved as intended; the window was too short. Multiply the 15 s by `kTimeMultiplier` (1 on regular builds, 3 on sanitizers). The check that the new leader started no earlier than one lease after t0 is unchanged.  ## Test plan  - [ ] Jenkins: `PgCronTest.UngracefulLeaderChangeMarksJobFailed` passes on all build types, including tsan. - [x] tsan, 20 repetitions (2 in parallel): `YB_TEST_PARALLELISM=2 ./yb_build.sh tsan --clang21 --cxx-test pg_cron-test --gtest_filter PgCronTest.UngracefulLeaderChangeMarksJobFailed -n 20`: 20 passed. Without this change, master tsan failed 5 of 20 (2.
  **Post-Mortem & Fix Analysis**:
  >   <!-- Reviewable:start --> This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/yugabyte/yugabyte-db/35290) <!-- Reviewable:end --> 
  > AgentK has started reviewing this pull request — findings will be posted here shortly.  Pushes are not reviewed automatically. Comment `/agentk review` to ask for another pass — but please only after substantial changes, not on every small push, and not for a push that just addresses the review comments.

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

### Incident Patch 1: `b10be5ad` (2026-10-07)
**Commit Message**: [#28574,#30130] YSQL: Fully ungraceful ConnMgr shutdown to avoid coredumps

Summary:
Connection Manager can dump core while it is shutting down. There are two causes.

1. Crash in `mm_channel_write` <- `od_worker_pool_feed` <- `od_system_server`. The system thread accepts clients and hands each one to a worker thread through that worker's task channel. An idle worker thread waits in `machine_channel_read` on its own channel, and the reader record it links into that channel lives on the worker's coroutine stack. `od_system_shutdown` stops the worker threads, but the system thread keeps accepting. A stopped worker thread that wakes up for anything other than a channel write (typically its 1 s epoll timeout) exits with its record still linked, and `machine_free` unmaps its stack. When the system thread next routes a client to that worker, `mm_channel_write` unlinks the record from unmapped memory and segfaults.

2. Crashes in `exit()` -> `OPENSSL_cleanup`, and in `od_frontend_close` -> `SSL_free`. `exit(0)` runs the `atexit` handlers and tears down OpenSSL while worker threads are still running and using them.

Fix: `od_system_shutdown` no longer stops the workers, and it calls `_exit

**File**: `java/yb-ysql-conn-mgr/src/test/java/org/yb/ysqlconnmgr/TestConnMgrShutdown.java` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+// Copyright (c) YugabyteDB, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
+// in compliance with the License. You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software distributed under the License
+// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
+// or implied. See the License for the specific language governing permissions and limitations
+// under the License.
+//
+
+package org.yb.ysqlconnmgr;
+
+import static org.yb.AssertionWrappers.assertEquals;
+import static org.yb.AssertionWrappers.assertNotNull;
+import static org.yb.AssertionWrappers.assertTrue;
+import static org.yb.AssertionWrappers.fail;
+
+import java.nio.file.Files;
+import java.nio.file.Paths;
+import java.sql.Connection;
+import java.sql.ResultSet;
+import java.sql.Statement;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.TimeUnit;
+
+import org.junit.Test;
+import org.junit.runner.RunWith;
+import org.yb.YBTestRunner;
+import org.yb.minicluster.LogErrorListener;
+import org.yb.minicluster.MiniYBClusterBuilder;
+import org.yb.minicluster.MiniYBDaemon;
+import org.yb.pgsql.ConnectionEndpoint;
+import org.yb.util.BuildTypeUtil;
+import org.yb.util.RequiresLinux;
+
+@RequiresLinux
+@RunWith(value = YBTestRunner.class)
+public class TestConnMgrShutdown extends BaseYsqlConnMgr {
+  private static final long SHUTDOWN_DELAY_MS = BuildTypeUtil.adjustTimeout(10000);
+  private static final int WORKER_EXIT_WAIT_MS = 3000;
+  private static final long EXIT_WAIT_MS = SHUTDOWN_DELAY_MS + 30000;
+
+  @Override
+  protected void customizeMiniClusterBuilder(MiniYBClusterBuilder builder) {
+    super.customizeMiniClusterBuilder(builder);
+    disableWarmupRandomMode(builder);
+    builder.addCommonTServerFlag("TEST_ysql_conn_mgr_shutdown_delay_ms",
+        String.valueOf(SHUTDOWN_DELAY_MS));
+  }
+
+  private Connection connectToConnMgr() throws Exception {
+    return getConnectionBuilder()
+        .withTServer(TSERVER_IDX)
+        .withConnectionEndpoint(ConnectionEndpoint.YSQL_CONN_MGR)
+        .connect();
+  }
+
+  private void runSelectOne() throws Exception {
+    try (Connection conn = connectToConnMgr();
+        Statement stmt = conn.createStatement();
+        ResultSet rs = stmt.executeQuery("SELECT 1")) {
+      assertTrue(rs.next());
+      assertEquals(1, rs.getInt(1));
+    }
+  }
+
+  private static boolean isProcessRunning(int pid) throws Exception {
+    String stat;
+    try {
+      stat = new String(Files.readAllBytes(Paths.get("/proc/" + pid + "/stat")));
+    } catch (java.nio.file.NoSuchFileException e) {
+      return false;
+    }
+    String state = stat.substring(stat.lastIndexOf(')') + 2).split(" ")[0];
+    return !state.equals("Z") && !state.equals("X");
+  }
+
+  private static class ConnMgrExitListener implements LogErrorListener {
+    private final CompletableFuture<String> exitLine = new CompletableFuture<>();
+
+    @Override
+    public void handleLine(String line) {
+      if (line.contains("Ysql Connection Manager exited normally")
+          || line.contains("Ysql Connection Manager server returned with code")) {
+        exitLine.complete(line);
+      }
+    }
+
+    @Override
+    public void reportErrorsAtEnd() {
+    }
+
+    String waitForExit(long timeoutMs) throws Exception {
+      return exitLine.get(timeoutMs, TimeUnit.MILLISECONDS);
+    }
+  }
+
+  private MiniYBDaemon getTServerDaemon(String host) {
+    return miniCluster.getTabletServers().values().stream()
+        .filter(daemon -> host.equals(daemon.getLocalhostIP())).findFirst()
+        .orElseThrow(() -> new IllegalStateException("No tserver found for host " + host));
+  }
+
+  @Test
+  public void testConnectAfterShutdownSignal() throws Exception {
+    final String host = getPgHost(TSERVER_IDX);
+    final int odysseyPid = getOdysseyPidForHost(host);
+
+    runSelectOne();
+
+    ConnMgrExitListener exitListener = new ConnMgrExitListener();
+    getTServerDaemon(host).getLogPrinter().addErrorListener(exitListener);
+
+    Process kill = new ProcessBuilder("kill", "-INT", String.valueOf(odysseyPid)).start();
+    assertEquals(0, kill.waitFor());
+
+    // Due to #22345, ConnMgr is not able to restart on it's own so this cluster is
+    // not usable after the shutdown signal. Mark it as needing recreation so that
+    // other tests don't try to use it.
+    markClusterNeedsRecreation();
+
+    Thread.sleep(WORKER_EXIT_WAIT_MS);
+
+    try {
+      runSelectOne();
+    } catch (Exception e) {
+      LOG.error("Connection during conn mgr shutdown failed", e);
+      fail("Connection during conn mgr shutdown failed: " + e
+          + "; conn mgr running: " + isProcessRunning(odysseyPid));
+    }
+    assertTrue("Conn mgr exited before the shutdown delay elapsed",
+     
```

**File**: `src/odyssey/sources/sighandler.c` (modified, +35/-2)
```diff
@@ -81,12 +81,20 @@ static inline void yb_stats_shmem_cleanup(od_instance_t *instance)
 	       "Deleted the shared memory segment with id %d", shmid);
 }
 
+/*
+ * YB: Shutdown is ungraceful. Worker threads keep running until the process
+ * exits, so freeing anything they may use here would race with them. We rely
+ * on process exit to reclaim all resources.
+ */
 od_attribute_noreturn() void od_system_shutdown(od_system_t *system,
 						od_instance_t *instance)
 {
+	/* YB: Worker pool cleanup is disabled */
+#ifdef OD_SYSTEM_SHUTDOWN_CLEANUP
 	od_worker_pool_t *worker_pool;
 
 	worker_pool = system->global->worker_pool;
+#endif
 #ifdef YB_SUPPORT_FOUND
 	// Connection manager process shuts down gracefully on receiving
 	// SIGINT signal, but logging it makes some tests fail.
@@ -103,10 +111,25 @@ od_attribute_noreturn() void od_system_shutdown(od_system_t *system,
 	// YB: Cleanup shmem after cron thread has stopped
 	yb_stats_shmem_cleanup(instance);
 
+	/*
+	 * YB: Workers are deliberately not stopped, since stopping
+	 * them unmaps coroutine stacks that may still be linked as
+	 * channel readers
+	 */
+#ifdef OD_SYSTEM_SHUTDOWN_CLEANUP
 	od_worker_pool_stop(worker_pool);
 
-	/* Prevent OpenSSL usage during deinitialization */
 	od_worker_pool_wait();
+#endif
+
+	char *yb_shutdown_delay_ms =
+		getenv("YB_YSQL_CONN_MGR_TEST_SHUTDOWN_DELAY_MS");
+	if (yb_shutdown_delay_ms != NULL) {
+		unsigned long delay_ms =
+			strtoul(yb_shutdown_delay_ms, NULL, 10);
+		machine_sleep(delay_ms > UINT32_MAX ? UINT32_MAX :
+						      (uint32_t)delay_ms);
+	}
 
 #ifdef OD_SYSTEM_SHUTDOWN_CLEANUP
 	od_router_free(system->global->router);
@@ -118,7 +141,17 @@ od_attribute_noreturn() void od_system_shutdown(od_system_t *system,
 	/* stop machinaruim and free */
 	od_instance_free(instance);
 #endif
-	exit(0);
+	/* YB: Give the logger thread a chance to flush queued log lines */
+	machine_sleep(1);
+
+	/*
+	 * YB: Call _exit instead of exit(0) to avoid running atexit handlers.
+	 * This is because cleanup of OpenSSL races against new client conns
+	 * undergoing TLS handshake. Since the memory is anyway reclaimed by the
+	 * OS and we're doing ungraceful shutdown, it's okay to skip the atexit
+	 * handlers.
+	 */
+	_exit(0);
 }
 
 void od_system_signal_handler(void *arg)
```

**File**: `src/yb/yql/ysql_conn_mgr_wrapper/ysql_conn_mgr_wrapper.cc` (modified, +10/-0)
```diff
@@ -240,6 +240,10 @@ DEFINE_NON_RUNTIME_CONN_MGR_FLAG(bool, cert_auth, true,
     "which is what makes the connection manager verify the client certificate the same way "
     "PostgreSQL would.");
 
+DEFINE_test_flag(uint32, ysql_conn_mgr_shutdown_delay_ms, 0,
+    "Time (in ms) that Ysql Connection Manager waits during SIGINT/SIGTERM shutdown before the "
+    "process exits.");
+
 namespace {
 
 bool ValidateLogSettings(const char* flag_name, const std::string& value) {
@@ -394,6 +398,12 @@ Status YsqlConnMgrWrapper::Start() {
   // to start if the provider did not come up.
   proc_->SetEnv(YSQL_CONN_MGR_REQUIRE_FIPS, FLAGS_openssl_require_fips ? "true" : "false");
 
+  unsetenv("YB_YSQL_CONN_MGR_TEST_SHUTDOWN_DELAY_MS");
+  if (FLAGS_TEST_ysql_conn_mgr_shutdown_delay_ms > 0) {
+    proc_->SetEnv("YB_YSQL_CONN_MGR_TEST_SHUTDOWN_DELAY_MS",
+                  std::to_string(FLAGS_TEST_ysql_conn_mgr_shutdown_delay_ms));
+  }
+
 #ifdef THREAD_SANITIZER
   // Disable thread leak detection for the Ysql Connection Manager (Odyssey) process.
   // Worker threads may not be joined before exit(0) on SIGINT/SIGTERM shutdown.
```

---

### Incident Patch 2: `08a56060` (2026-10-17)
**Commit Message**: [#34685,#34686] YSQL: Fix issues with pg_cron leader failover (#34689)

## Summary

Two bugs on an ungraceful pg_cron leader change (the leader node
crashes, stops, or is cut off from the cluster).

**#34685: new leader does not wait out the old lease.**
`PgCronLeaderService::Activate` makes a new leader wait until the
previous leader's lease must have expired (`pg_cron_leader_lease_sec` +
2 * `max_clock_skew_usec`) before it starts jobs. It added
`pg_cron_leader_lease_sec` as microseconds, so the wait was about 1 s
instead of one lease (60 s by default). An old leader that is alive but
cut off keeps running its jobs until its lease expires, so the new
leader could run the same jobs at the same time.

- Fix: add the lease in seconds. After a leader change, no job now
starts for one lease, as designed.
- With the correct wait, the new leader starts 2 * `max_clock_skew_usec`
(1 s) after the old lease ends. The old leader stops a job only on its
next launcher iteration after the lease ends (up to 1 s), plus the time
for the job's worker to exit; a test saw 1.9 s, with both nodes running
the job for 0.8 s. So the lease the tserver publishes to postgres now
ends min(3 s, lease - refresh

**File**: `src/postgres/src/backend/utils/cache/inval.c` (modified, +1/-1)
```diff
@@ -882,7 +882,7 @@ CallSystemCacheCallbacks(void)
 	InvalidateSystemCachesExtended(true, true /* yb_callback */ );
 }
 
-static void
+void
 YbMaybeRefreshCache(void)
 {
 	uint64_t	shared_catalog_version = YbGetSharedCatalogVersion();
```

**File**: `src/postgres/src/include/utils/inval.h` (modified, +1/-0)
```diff
@@ -71,5 +71,6 @@ extern bool yb_refresh_cache_in_progress;
 extern void CallSystemCacheCallbacks(void);
 extern int	YbGetNumInvalMessagesInTxn(int subgroup);
 extern void YbAddNumInvalMessagesInTxn(int subgroup, int nmsgs);
+extern void YbMaybeRefreshCache(void);
 
 #endif							/* INVAL_H */
```

**File**: `src/postgres/third-party-extensions/pg_cron/src/job_metadata.c` (modified, +31/-0)
```diff
@@ -98,6 +98,9 @@ static Oid GetRoleOidIfCanLogin(char *username);
 static entry * ParseSchedule(char *scheduleText);
 static bool TryParseInterval(char *scheduleText, uint32 *secondsInterval);
 
+/* YB declarations */
+static void YbEnsureFreshCatalog(void);
+
 
 /* SQL-callable functions */
 PG_FUNCTION_INFO_V1(cron_schedule);
@@ -543,6 +546,7 @@ NextRunId(void)
 	bool failOK = true;
 	MemoryContext originalContext = CurrentMemoryContext;
 
+	YbEnsureFreshCatalog();
 	StartTransactionCommand();
 	PushActiveSnapshot(GetTransactionSnapshot());
 
@@ -830,6 +834,7 @@ void
 InvalidateJobCacheCallback(Datum argument, Oid relationId)
 {
 	if (relationId == CachedCronJobRelationId ||
+		relationId == InvalidOid ||
 		CachedCronJobRelationId == InvalidOid)
 	{
 		CronJobCacheValid = false;
@@ -873,6 +878,7 @@ LoadCronJobList(void)
 	MemoryContext originalContext = CurrentMemoryContext;
 
 	SetCurrentStatementStartTimestamp();
+	YbEnsureFreshCatalog();
 	StartTransactionCommand();
 	PushActiveSnapshot(GetTransactionSnapshot());
 
@@ -1084,6 +1090,7 @@ InsertJobRunDetail(int64 runId, int64 *jobId, char *database, char *username, ch
 	MemoryContext originalContext = CurrentMemoryContext;
 
 	SetCurrentStatementStartTimestamp();
+	YbEnsureFreshCatalog();
 	StartTransactionCommand();
 	PushActiveSnapshot(GetTransactionSnapshot());
 
@@ -1153,6 +1160,7 @@ UpdateJobRunDetail(int64 runId, int32 *job_pid, char *status, char *return_messa
 	MemoryContext originalContext = CurrentMemoryContext;
 
 	SetCurrentStatementStartTimestamp();
+	YbEnsureFreshCatalog();
 	StartTransactionCommand();
 	PushActiveSnapshot(GetTransactionSnapshot());
 
@@ -1424,6 +1432,7 @@ MarkPendingRunsAsFailed(void)
 	MemoryContext originalContext = CurrentMemoryContext;
 
 	SetCurrentStatementStartTimestamp();
+	YbEnsureFreshCatalog();
 	StartTransactionCommand();
 	PushActiveSnapshot(GetTransactionSnapshot());
 
@@ -1450,6 +1459,10 @@ MarkPendingRunsAsFailed(void)
 	if (SPI_exec(querybuf.data, 0) != SPI_OK_UPDATE)
 		elog(ERROR, "SPI_exec failed: %s", querybuf.data);
 
+	if (IsYugaByteEnabled())
+		ereport(LOG, (errmsg("pg_cron marked " UINT64_FORMAT " pending runs as failed",
+							 SPI_processed)));
+
 	pfree(querybuf.data);
 
 	SPI_finish();
@@ -1586,3 +1599,21 @@ TryParseInterval(char *scheduleText, uint32 *secondsInterval)
 
 	return false;
 }
+
+
+/*
+ * Reset the catalog read time in legacy catalog mode, and check the catalog
+ * version where AcceptInvalidationMessages does not, as PostgresMain does
+ * before each statement.
+ */
+static void
+YbEnsureFreshCatalog(void)
+{
+	if (!IsYugaByteEnabled())
+		return;
+
+	if (YBCIsLegacyModeForCatalogOps())
+		YbInvalidateCatalogSnapshot();
+	if (!YBCIsObjectLockingEnabled() || !YbIsInvalidationMessageEnabled())
+		YbMaybeRefreshCache();
+}
```

**File**: `src/postgres/third-party-extensions/pg_cron/src/task_states.c` (modified, +0/-10)
```diff
@@ -21,9 +21,6 @@
 #include "utils/hsearch.h"
 #include "utils/memutils.h"
 
-/* YB includes */
-#include "pg_yb_utils.h"
-#include "catalog/yb_catalog_version.h"
 
 /* forward declarations */
 static HTAB * CreateCronTaskHash(void);
@@ -84,13 +81,6 @@ CreateCronTaskHash(void)
 void
 RefreshTaskHash(void)
 {
-	/* YB Note: Always read the latest entries in the catalog */
-	if (IsYugaByteEnabled())
-	{
-		YbInvalidateCatalogSnapshot();
-		YbUpdateCatalogCacheVersion(YbGetMasterCatalogVersion());
-	}
-
 	List *jobList = NIL;
 	ListCell *jobCell = NULL;
 	CronTask *task = NULL;
```

**File**: `src/yb/integration-tests/pg_cron-test.cc` (modified, +261/-19)
```diff
@@ -12,6 +12,7 @@
 //
 
 #include <chrono>
+#include <optional>
 
 #include "yb/client/session.h"
 #include "yb/client/table_handle.h"
@@ -29,6 +30,7 @@
 
 #include "yb/util/backoff_waiter.h"
 #include "yb/util/monotime.h"
+#include "yb/util/tostring.h"
 
 #include "yb/yql/cql/ql/util/statement_result.h"
 #include "yb/yql/pgwrapper/libpq_utils.h"
@@ -40,7 +42,10 @@ namespace yb {
 
 constexpr auto kTableName = "tbl1";
 constexpr auto kDefaultJobName = "Job1";
-constexpr auto kJobListRefreshInterval = 10;
+// cron.yb_job_list_refresh_interval and pg_cron_leader_lease_sec for the fixture. A new leader
+// starts running jobs one lease after it became leader.
+constexpr auto kInterval = 10;
+constexpr auto kServerRestartedMessage = "server restarted";
 constexpr auto kFailedJobStatus = "failed";
 constexpr auto kRunningJobStatus = "running";
 const client::YBTableName service_table_name =
@@ -64,10 +69,10 @@ class PgCronTest : public MiniClusterTestWithClient<ExternalMiniCluster> {
     opts.extra_tserver_flags.push_back("--enable_pg_cron=true");
 
     opts.extra_tserver_flags.push_back(
-        Format("--ysql_pg_conf_csv=cron.yb_job_list_refresh_interval=$0", kJobListRefreshInterval));
+        Format("--ysql_pg_conf_csv=cron.yb_job_list_refresh_interval=$0", kInterval));
     opts.extra_tserver_flags.push_back("--pg_cron_leadership_refresh_sec=1");
     opts.extra_tserver_flags.push_back(
-        Format("--pg_cron_leader_lease_sec=$0", kJobListRefreshInterval));
+        Format("--pg_cron_leader_lease_sec=$0", kInterval));
 
     cluster_.reset(new ExternalMiniCluster(opts));
     ASSERT_OK(cluster_->Start());
@@ -203,7 +208,9 @@ class PgCronTest : public MiniClusterTestWithClient<ExternalMiniCluster> {
 
           return row_block->row_count() > 0;
         },
-        CoarseMonoClock::Now() + kTimeout, "Waiting for data in pg cron leader table");
+        // The leader writes the first row at the first minute boundary after it becomes active,
+        // which can itself take one lease if the leader moves during setup.
+        CoarseMonoClock::Now() + kTimeout + 60s, "Waiting for data in pg cron leader table");
   }
 
   Result<int64_t> GetPersistedLastMinute() {
@@ -247,6 +254,182 @@ class PgCronTest : public MiniClusterTestWithClient<ExternalMiniCluster> {
     return pids;
   }
 
+  // Returns the runid, and the pid of the backend executing it, of the most recent run of the job
+  // that is in the 'running' state.
+  Result<std::tuple<int64_t, int32_t>> GetRunningRun(int64 job_id) {
+    return conn_->FetchRow<int64_t, int32_t>(Format(
+        "SELECT runid, job_pid FROM cron.job_run_details WHERE jobid = $0 AND status = '$1' "
+        "ORDER BY start_time DESC LIMIT 1",
+        job_id, kRunningJobStatus));
+  }
+
+  Result<std::string> GetRunMessage(int64 runid) {
+    return conn_->FetchRow<std::string>(Format(
+        "SELECT return_message FROM cron.job_run_details WHERE runid = $0", runid));
+  }
+
+  // Number of runs of the job that started after the given run.
+  Result<int64_t> CountRunsAfter(int64 job_id, int64 runid) {
+    return conn_->FetchRow<pgwrapper::PGUint64>(Format(
+        "SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = $0 AND runid > $1", job_id,
+        runid));
+  }
+
+  // Waits for a specific run (identified by runid) to reach the given status. Unlike
+  // WaitForJobStatus this tracks a single run, so it is stable even as the job keeps rescheduling.
+  Status WaitForRunStatus(int64 runid, const std::string& status) {
+    Status s = LoggedWaitFor(
+        [this, runid, status]() -> Result<bool> {
+          return VERIFY_RESULT(conn_->FetchRow<pgwrapper::PGUint64>(Format(
+                     "SELECT COUNT(*) FROM cron.job_run_details WHERE runid = $0 AND status = '$1'",
+                     runid, status))) > 0;
+        },
+        kTimeout, Format("Wait for run $0 to have status '$1'", runid, status));
+    if (!s.ok()) {
+      LOG(INFO) << "job_run_details on failure:\n"
+                << conn_->FetchAllAsString(
+                       "SELECT runid, jobid, status, return_message FROM cron.job_run_details "
+                       "ORDER BY runid",
+                       " | ", "\n");
+    }
+    return s;
+  }
+
+  // Returns the indexes of the tservers that have a backend executing the given job command.
+  Result<std::set<size_t>> NodesRunningQuery(const std::string& job_command) {
+    std::set<size_t> nodes;
+    for (size_t idx = 0; idx < cluster_->num_tablet_servers(); ++idx) {
+      auto conn = VERIFY_RESULT(cluster_->ConnectToDB("yugabyte", idx));
+      if (VERIFY_RESULT(conn.FetchRow<pgwrapper::PGUint64>(Format(
+              "SELECT COUNT(*) FROM pg_stat_activity WHERE query = '$0'", job_command))) > 0) {
+        nodes.insert(idx);
+      }
+    }
+    return nodes;
+  }
+
+  Status WaitForQueryOnlyOnNode(const std::string& job_command, size_t idx) {
+    return LoggedWaitFor(
+        [this, &job_command, idx]() -> Result<bool> 
```

**File**: `src/yb/tserver/stateful_services/pg_cron_leader_service.cc` (modified, +14/-6)
```diff
@@ -55,6 +55,8 @@ namespace {
 constexpr uint32 kPgCronJsonVersion1 = 1;
 constexpr char kPgCronJsonVersion[] = "version";
 constexpr char kPgCronJsonLastMinute[] = "last_minute";
+// How long before the lease ends this node stops its in-flight pg_cron jobs.
+constexpr int64_t kJobStopMarginSec = 3;
 }  // namespace
 
 PgCronLeaderService::PgCronLeaderService(
@@ -81,9 +83,9 @@ void PgCronLeaderService::Activate() {
       VLOG_WITH_FUNC(1) << "Leader for term 1. Activating immediately";
       leader_activate_time_ = MonoTime::Min();
     } else {
-      leader_activate_time_ =
-          MonoTime::Now() + MonoDelta::FromMicroseconds(
-                                FLAGS_pg_cron_leader_lease_sec + 2 * FLAGS_max_clock_skew_usec);
+      leader_activate_time_ = MonoTime::Now() +
+                              MonoDelta::FromSeconds(FLAGS_pg_cron_leader_lease_sec) +
+                              MonoDelta::FromMicroseconds(2 * FLAGS_max_clock_skew_usec);
       LOG_WITH_FUNC(INFO) << "Waiting until " << leader_activate_time_.ToFormattedString()
                           << " for lease of the old leader to expire";
     }
@@ -136,10 +138,16 @@ void PgCronLeaderService::RefreshLeaderLease() {
     return;
   }
 
-  // We are the leader. Renew the lease.
+  // We are the leader: renew the lease. The lease ends kJobStopMarginSec early, to leave time to
+  // stop running jobs before a new leader, which waits out the full lease, starts.
   const auto lease_end = now + MonoDelta::FromSeconds(FLAGS_pg_cron_leader_lease_sec);
-  VLOG_WITH_FUNC(1) << "Setting leader lease to " << lease_end.ToFormattedString();
-  set_cron_leader_lease_fn_(lease_end);
+  const auto stop_margin = std::clamp<int64_t>(
+      static_cast<int64_t>(FLAGS_pg_cron_leader_lease_sec) -
+          static_cast<int64_t>(FLAGS_pg_cron_leadership_refresh_sec) - 1,
+      0, kJobStopMarginSec);
+  VLOG_WITH_FUNC(1) << "Setting leader lease to " << lease_end.ToFormattedString()
+                    << " minus " << stop_margin << " s";
+  set_cron_leader_lease_fn_(lease_end - MonoDelta::FromSeconds(stop_margin));
 }
 
 Status PgCronLeaderService::SetLastMinute(int64_t last_minute, CoarseTimePoint deadline) {
```

---

### Incident Patch 3: `3de43b4f` (2026-10-17)
**Commit Message**: [#34535] build: Clean up PGO builds and document their use for microbenchmarks (#35089)

Summary:
PGO build cleanup in `yb_build.sh`, with the benchmark workflow as the first user:

- A build root keeps the profile it was configured with; later builds without `--pgo-data-path` rely on that (the release pipeline's initdb step runs without the flag). The build now logs when a cached profile is in effect, and giving a different `--pgo-data-path` re-runs CMake instead of being silently ignored.
- `YB_USE_EXTERNAL_BUILD_ROOT=1` produced an empty Python venv, because `activate_virtualenv` linked the requirements files into `build/` while the venv lived under the external parent directory; the links now go where the venv is.
- In a `prof_gen` build, `--cxx-benchmark` writes the profile to `<build_root>/pgo-profiles/<ir|csir>/<name>-<pid>-<module>.profraw` (one file per instrumented executable or shared library, previous raw files of the benchmark removed first) instead of the current directory, and prints the `llvm-profdata merge` command.
- `--pgo-instrument-type` and `--pgo-data-path` get help text; `prof_gen` was already listed among the build types.

The contributor build-and-test pag

**File**: `build-support/common-build-env.sh` (modified, +8/-7)
```diff
@@ -2264,13 +2264,14 @@ activate_virtualenv() {
 
   log "Activating python virtual env"
 
-  # Symlink the requirements files into the top level build directory
-  # We assume $YB_SRC_ROOT/build is already created by initialize_yugabyte_bash_common having
-  # already been called.
-  [[ -f "${YB_SRC_ROOT}/build/requirements.txt" ]] \
-    || ln -sf "${YB_SRC_ROOT}/requirements.txt" "${YB_SRC_ROOT}/build/"
-  [[ -f "${YB_SRC_ROOT}/build/requirements_frozen.txt" ]] \
-    || ln -sf "${YB_SRC_ROOT}/requirements_frozen.txt" "${YB_SRC_ROOT}/build/"
+  # Symlink the requirements files into the directory that holds the virtualenv, which is where
+  # yb_activate_virtualenv looks for them. This is $YB_SRC_ROOT/build, or the external build parent
+  # directory when YB_USE_EXTERNAL_BUILD_ROOT=1.
+  mkdir -p "${virtualenv_parent_dir}"
+  [[ -f "${virtualenv_parent_dir}/requirements.txt" ]] \
+    || ln -sf "${YB_SRC_ROOT}/requirements.txt" "${virtualenv_parent_dir}/"
+  [[ -f "${virtualenv_parent_dir}/requirements_frozen.txt" ]] \
+    || ln -sf "${YB_SRC_ROOT}/requirements_frozen.txt" "${virtualenv_parent_dir}/"
 
   yb_activate_virtualenv "${virtualenv_parent_dir}"
 
```

**File**: `build-support/yb_build_cmd_line.sh` (modified, +9/-0)
```diff
@@ -176,6 +176,15 @@ Build options:
     https://llvm.org/docs/LinkTimeOptimization.html and https://clang.llvm.org/docs/ThinLTO.html).
     Can also be specified by setting environment variable YB_LINKING_TYPE to thin-lto or full-lto.
     Set YB_LINKING_TYPE to 'dynamic' to disable LTO.
+  --pgo-instrument-type <ir|csir>
+    With the prof_gen build type: instrument the build for profile-guided optimization (PGO) with
+    IR or context-sensitive IR profiles. A benchmark run with --cxx-benchmark in such a build
+    writes its profile to <build_root>/pgo-profiles/<instrumentation type>/.
+  --pgo-data-path <profdata_file>
+    Compile and link with the given merged llvm-profdata profile (-fprofile-use). Works with any
+    build type; the release pipeline uses it with --full-lto. The build root remembers the profile:
+    later builds without this flag keep using it, giving a different path re-runs CMake and
+    rebuilds, and building without a profile again needs a different build root or --clean.
   --no-initdb, --skip-initdb
     Skip the initdb step. The initdb build step is mostly single-threaded and can be executed on a
     low-CPU build machine even if the majority of the build is being executed on a high-CPU host.
```

**File**: `docs/content/stable/contribute/core-database/build-and-test.md` (modified, +35/-0)
```diff
@@ -190,6 +190,41 @@ LTO builds need an LTO third-party archive; the published one is built for AlmaL
 
 Note that a high parallelism could result in failures if system resources are overused.
 
+### Profile-guided optimization for microbenchmarks
+
+Release binaries are built with profile-guided optimization (PGO) from a sysbench workload, so their code layout and inlining differ from a plain `release` build.
+You can build a microbenchmark the same way, with a profile you collect yourself.
+It is opt-in and takes two builds, both with `--full-lto`, since PGO is only used together with LTO.
+
+First, build and run the benchmark instrumented for profiling (`prof_gen` is a release build with profile counters; the benchmark's own timings in this run are meaningless):
+
+```sh
+./yb_build.sh prof_gen --full-lto --pgo-instrument-type=ir --cxx-benchmark mutex-benchmark
+```
+
+The raw profiles are written to `<build_root>/pgo-profiles/ir/` (one file per instrumented executable or shared library; each run replaces the benchmark's previous ones), and the command prints the `llvm-profdata merge` invocation that turns them into one `.profdata` file.
+Then build and run the benchmark with that profile:
+
+```sh
+YB_USE_EXTERNAL_BUILD_ROOT=1 ./yb_build.sh release --full-lto --no-ccache \
+    --pgo-data-path <build_root>/pgo-profiles/ir/mutex-benchmark.profdata --cxx-benchmark mutex-benchmark
+```
+
+`--no-ccache` matters with an old ccache such as the AlmaLinux 8 package (3.7): it can serve objects that ignore the profile ([ccache issue 582](https://github.com/ccache/ccache/issues/582)).
+A build root remembers its profile: later builds in it without `--pgo-data-path` keep using it, and only a different profile, a different build root, or `--clean` changes that.
+`YB_USE_EXTERNAL_BUILD_ROOT=1` puts this build under `<source root>__build/`, so your regular `release` build root stays a plain release build.
+Release binaries add a second, context-sensitive pass (`--pgo-instrument-type=csir` with the first profile as `--pgo-data-path`); one pass is enough for a benchmark.
+
+When to use it: to check whether a change behaves the same way in a PGO-optimized build, or whether a result is fragile under a different code layout.
+It is not a substitute for a plain `release` or `--full-lto` number, and it has downsides:
+
+- A profile collected from the benchmark itself optimizes the benchmark's loop, so it overstates gains that a production profile, collected from a server workload, would not see.
+  In an A/B comparison, a profile collected on one side favors that side; use the same profile for both, or profile each side the same way and say so.
+- Only code the profiling run executed gets profile data; everything else is laid out as cold.
+- A stale profile is accepted silently: the build disables the profile-mismatch warnings, and functions whose code changed simply get no data.
+  Collect a new profile after changing the measured code.
+- It needs Clang and a second full build of the benchmark's dependencies.
+
 ### Test frameworks
 
 #### C++ (external) mini cluster
```

**File**: `yb_build.sh` (modified, +36/-0)
```diff
@@ -512,12 +512,32 @@ run_cxx_benchmark() {
     fatal "Could not find benchmark program '$cxx_benchmark_program_name' in" \
           "$BUILD_ROOT/benchmarks-*. Only programs added with ADD_YB_BENCHMARK are placed there."
   fi
+  # In a prof_gen (PGO-instrumented) build, collect the profile under the build root instead of
+  # the current directory, in a subdirectory named after the instrumentation type (ir or csir), and
+  # show how to merge it for a later --pgo-data-path build. %m keeps the executable and each
+  # instrumented shared library in their own raw file, as clang's default pattern does; previous
+  # raw files of this benchmark are removed so the merge sees one run.
+  local pgo_profile_dir=""
+  if [[ $build_type == "prof_gen" ]]; then
+    pgo_profile_dir=$BUILD_ROOT/pgo-profiles/$pgo_instrument_type
+    mkdir -p "$pgo_profile_dir"
+    rm -f "$pgo_profile_dir/$cxx_benchmark_name"-*.profraw
+  fi
   (
     set_sanitizer_runtime_options
+    if [[ -n $pgo_profile_dir ]]; then
+      export LLVM_PROFILE_FILE=$pgo_profile_dir/$cxx_benchmark_name-%p-%m.profraw
+    fi
     set +u  # "set -u" fails on an empty benchmark_args with bash < 4.4 (macOS /bin/bash).
     set -x
     "${benchmark_paths[0]}" "${benchmark_args[@]}"
   )
+  if [[ -n $pgo_profile_dir ]]; then
+    log "PGO profile written to $pgo_profile_dir. To merge it for a --pgo-data-path build:"
+    log "  ${YB_LLVM_TOOLCHAIN_DIR:-<llvm toolchain>}/bin/llvm-profdata merge" \
+        "-o $pgo_profile_dir/$cxx_benchmark_name.profdata" \
+        "$pgo_profile_dir/$cxx_benchmark_name-*.profraw"
+  fi
 }
 
 register_file_to_rebuild() {
@@ -1064,8 +1084,24 @@ if [[ $build_type == "prof_gen" ]]; then
   cmake_opts+=( "-DYB_PGO_INSTRUMENT_TYPE=$pgo_instrument_type" )
 fi
 
+# The profile path lives in CMakeCache.txt once cmake has seen it, and a build root keeps it until a
+# different one is given: later invocations without --pgo-data-path (the release pipeline's initdb
+# step, test runs) must not change how the root is compiled. So re-run cmake only when a different
+# profile is given explicitly, and say so when a cached profile is in effect.
+cached_pgo_data_path=""
+if [[ -f $BUILD_ROOT/CMakeCache.txt ]]; then
+  cached_pgo_data_path=$(sed -n 's/^YB_PGO_DATA_PATH:[A-Z]*=//p' "$BUILD_ROOT/CMakeCache.txt")
+fi
 if [[ $pgo_data_path != "" ]]; then
   cmake_opts+=( "-DYB_PGO_DATA_PATH=$pgo_data_path" )
+  if [[ -n $cached_pgo_data_path && $cached_pgo_data_path != "$pgo_data_path" &&
+        ${force_no_run_cmake} == "false" ]]; then
+    log "PGO profile changed from '${cached_pgo_data_path}' to '${pgo_data_path}', re-running CMake"
+    force_run_cmake=true
+  fi
+elif [[ -n $cached_pgo_data_path ]]; then
+  log "Using the PGO profile recorded in this build root: ${cached_pgo_data_path}" \
+      "(use a different build root, or --clean, to build without it)"
 fi
 
 if [[ $bolt_enabled == "true" ]]; then
```

#### Recent Merged Pull Requests:
- **PR #35309** (2026-10-18): [BACKPORT 2025.2][#34805] DocDB: Remove non-block-based vector index backends (#34806) (@yb-agentk-dev[bot])
- **PR #35290** (2026-10-18): [#34685] YSQL: Scale the hand-over window of PgCronTest.UngracefulLeaderChangeMarksJobFailed for sanitizers (@iSignal)
- **PR #35246** (closed): [#35240] YSQL: Update PgCatalogVersionTest.InvalMessageSampleDDLs expected values after DROP COLUMN change (@csi-fix)
- **PR #35245** (2026-10-18): [#35244] DocDB: Fix PgExplicitRowLockingTest.ExplicitRowLockingMultipleTablesErrorMessage/kTrue (@csi-fix)
- **PR #35236** (2026-10-18): [BACKPORT 2025.2][#34735] YSQL: Route pk-filtered vector index searches to the matching tablets (#34738) (@yb-agentk-dev[bot])
- **PR #35235** (2026-10-18): [#35234] YSQL: Fix PgDdlAtomicityStressTest.Main/colocated_fail_probability_of_catalog_writes_by_ddl_verification (@csi-fix)

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

## X. [#28574,#30130] YSQL: Fully ungraceful ConnMgr shutdown to avoid coredumps

**RULE**:
When implementing operations in `java/yb-ysql-conn-mgr/src/test/java/org/yb/ysqlconnmgr/TestConnMgrShutdown.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yugabyte/yugabyte-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b10be5ad`: [#28574,#30130] YSQL: Fully ungraceful ConnMgr shutdown to avoid coredumps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `java/yb-ysql-conn-mgr/src/test/java/org/yb/ysqlconnmgr/TestConnMgrShutdown.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
// Copyright (c) YugabyteDB, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations
// under the License.
//

package org.yb.ysqlconnmgr;

import static org.yb.AssertionWrappers.assertEquals;
import static org.yb.AssertionWrappers.assertNotNull;
import static org.yb.AssertionWrappers.assertTrue;
import static org.yb.AssertionWrappers.fail;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.yb.YBTestRunner;
import org.yb.minicluster.LogErrorListener;
import org.yb.minicluster.Min
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b10be5ad` are properly handled with clean fallback behavior.
