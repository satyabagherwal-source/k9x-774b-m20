> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source**: github ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Source Version**: `c9f96027`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T16:52:04.749Z  
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
> **Harvest Timestamp**: 2026-10-28T16:52:04.526Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yugabyte/yugabyte-db`
- **Description**: YugabyteDB - the cloud native distributed SQL database for mission-critical applications.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10636 stars

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
    def zone():
        # Of the form projects/PROJECT_NUMBER/zones/ZONE.
        zone = GcpMetadata._query_endpoint("instance/zone")
        return zone.split("/")[-1] if zone else None

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

        networks = self.get_networks(ne
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
- **Issue #36079** (2026-10-28): **[BACKPORT 2026.1][#35634] YSQL: import rejection of generated columns in COPY FROM WHERE**
  *Symptoms*: ## Summary  Backport of yugabyte/yugabyte-db#36004 (master commit 520b08880d73242ecb62638e5ab03105935d6ce1) to `2026.1`.  Import two upstream PostgreSQL REL_15_STABLE commits ([8278737bfd0](https://github.com/postgres/postgres/commit/8278737bfd0a37b68121a42a0b0a6775488adb48) and [07e833e3cff](https://github.com/postgres/postgres/commit/07e833e3cff3da136980c7a4e30e965f825ae83c)) so that `COPY ... FROM ... WHERE` rejects conditions that reference a generated column.  Before this change, `COPY t(a) FROM stdin WHERE b > 2`, with `b` a stored generated column, loads 0 rows with no error, and `WHERE b IS NULL` loads every row: the WHERE clause is evaluated before `ExecComputeStoredGenerated()` fills in `b`, so the filter always sees NULL. Both now fail with "generated columns are not supported in COPY FROM WHERE conditions".  yugabyte/postgres side: yugabyte/postgres#42 (approved). The `src/postgres` pin in `src/lint/upstream_repositories.csv` moves to its last commit:  - 8278737bfd0a37b68121a42a0b0a6775488adb48 (upstream, in 15.15) -> 9ee82b98745852e724d297cb590c61470412de1b (yb-pg15) - 07e833e3cff3da136980c7a4e30e965f825ae83c (upstream) -> d4536bc26783a7739cb55bb2487a35ee949fcbed (yb-pg15, the new pin)  Both applied without conflicts.  `2026.1` and master both pin the yugabyte/postgres `yb-pg15` branch, and `2026.1`'s current pin 3c76b78a8ffa7cbbf38686f17ac7bc2aeecb7bab is the parent of the two imports there, so `2026.1` moves to the same pin as master and needs no separate yugab

- **Issue #36059** (2026-10-28): **[DocDB][PgVector] Rollback to 2025.2.0–2025.2.5 fails when a vector index was created after the upgrade, before finalize**
  *Symptoms*: Jira Link: [DB-25240](https://yugabyte.atlassian.net/browse/DB-25240) ### Description  After upgrading from 2025.2.5.2 and before finalizing, a ybhnsw (vector) index is created. Rolling back to 2025.2.5.2 then leaves that table's tablets unable to open on every tserver that has rolled back:  `Tablet failed to bootstrap: Not found (yb/util/env_posix.cc:274): /mnt/d0/yb-data/tserver/data/rocksdb/table-<id>/tablet-<id>.vi-<oid>/vectorindex_1.usearch: No such file or directory`  The index was written by the new build as `vectorindex_1.yb_hnsw`; the rolled-back tserver looks for `vectorindex_1.usearch`. The other replicas cannot remote-bootstrap the failed one (`Unable to begin remote bootstrap on peer ... NOT_FOUND`).  YBA then stops the rollback before the next tserver, because taking it down would leave the table without quorum: `CheckNodesAreSafeToTakeDown ... Taking down the requested node(s) is unsafe because 3 tablet(s) would not have enough replicas for quorum.` The universe is left in RollbackFailed, with the masters and two tservers on the new build and one tserver on 2025.2.5.2, and a new upgrade request is refused ("Software version is already ...").  The table stays readable from the two replicas on the new build. Indexes created before the upgrade are not affected. The problem does not happen without a vector index.  Related: #36056 (a vector index created during the rolling upgrade itself).  ### Priority: high  Rollback before finalize is the safe way back from an 

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

### Incident Patch 1: `7d6468da` (2026-10-28)
**Commit Message**: [#35462] DocDB: Fix RemoveTabletServerTest.MayStillHoldLease by waiting for a post-blacklist balancer run in drain (#35463)

## Summary

`MasterClusterTest::DrainTabletServer` returned as soon as the master
showed no replicas on the blacklisted tserver, but a cluster balancer
run that read the old blacklist could already have queued an
`AsyncAddServerTask` toward it (here for a `pg_advisory_locks` tablet).
That task outlives the run and never re-checks the blacklist, so the add
could land after the drain returned. Remove then failed with "is hosting
tablet" before it reached the lease check the test exercises. The helper
now waits for a balancer run that started after the blacklist change to
end with `ClusterBalancerActivityInfo::IsIdle()`, meaning no balancer
tasks are pending, before it accepts the drained state. It looks up the
leader master on every poll so leadership changes during the drain don't
stall the wait.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed
the failure logs, wrote the change, and verified it locally._

## Test plan

./yb_build.sh tsan --clang21 --cxx-test master_cluster_test
--gtest-filter RemoveTabletServerTest.MayStillHoldLeas

**File**: `src/yb/master/master_cluster_test.cc` (modified, +27/-1)
```diff
@@ -21,6 +21,7 @@
 
 #include "yb/master/catalog_entity_info.h"
 #include "yb/master/catalog_manager.h"
+#include "yb/master/cluster_balance.h"
 #include "yb/master/master_cluster_client.h"
 #include "yb/master/master_error.h"
 #include "yb/master/mini_master.h"
@@ -403,11 +404,36 @@ Status MasterClusterTest::DrainTabletServer(
   auto& hp = tserver_it->registration().common().broadcast_addresses(0);
   RETURN_NOT_OK(client.BlacklistHost(HostPortPB(hp)));
 
+  // A balancer run that read the old blacklist may have queued an add to this ts, and that task
+  // outlives the run. Only trust the checks below once a run that started after the blacklist
+  // change has ended with no balancer tasks pending.
+  auto latest_balancer_activity = [this]() -> Result<ClusterBalancerActivityInfo> {
+    auto* leader = VERIFY_RESULT(cluster_->GetLeaderMiniMaster());
+    return leader->catalog_manager_impl().cluster_balancer()->GetLatestActivityInfo();
+  };
+  const auto blacklist_time = MonoTime::Now();
+  RETURN_NOT_OK(WaitFor(
+      [&latest_balancer_activity, blacklist_time]() -> Result<bool> {
+        return VERIFY_RESULT(latest_balancer_activity()).run_end_time_ > blacklist_time;
+      },
+      timeout, "Cluster balancer run after blacklist change"));
+  const auto fresh_run_start = MonoTime::Now();
+
   // Now wait for the cluster balancer to move all tablets off the tserver.
   auto ts_proxy = VERIFY_RESULT(CreateTabletServerServiceProxy(uuid));
   std::string message;
   return WaitFor(
-      [this, &ts_proxy, &message, &uuid, &client]() -> Result<bool> {
+      [this, &ts_proxy, &message, &uuid, &client, &latest_balancer_activity,
+       fresh_run_start]() -> Result<bool> {
+        auto activity = VERIFY_RESULT(latest_balancer_activity());
+        if (activity.run_end_time_ <= fresh_run_start) {
+          message = "waiting for a cluster balancer run that saw the blacklist";
+          return false;
+        }
+        if (!activity.IsIdle()) {
+          message = "waiting for the cluster balancer to have no pending tasks";
+          return false;
+        }
         auto resp = VERIFY_RESULT(ListTabletsForTabletServer(ts_proxy));
         for (const auto& entry : resp.entries()) {
           if (entry.state() != tablet::RaftGroupStatePB::SHUTDOWN) {
```

---

### Incident Patch 2: `ca5d0234` (2026-10-28)
**Commit Message**: [#35479] YSQL: Fix master deadlock in PgDdlAtomicitySnapshotTest.SnapshotTest by fencing before restore submit (#35480)

## Summary

`CatalogManager::PrepareRestore` ran during raft apply of the
`RESTORE_SYS_CATALOG` op and called `IncrementPitrCount()`, which waits
for the exclusive `pitr_count_lock_`. Meanwhile, an in-flight sys
catalog write (for example a DDL rollback task) held that lock shared
while waiting for its own raft apply, which was queued behind the
restore op, so the master deadlocked until the `SyncWrite` timeout.

The fix moves the fence to before submit. `SubmitRestore` calls
`FenceSysCatalogForRestore(restoration_id)`, which records the
restoration id, sets `restoring_sys_catalog_` and drains in-flight
writes. On apply, `PrepareRestore(restoration_id)` finds the op's own
id, removes it and skips the wait. It keeps the old waiting path only
for ops this node did not fence for. After the op completes or fails to
submit, `SubmitRestore` calls
`UnfenceSysCatalogForRestore(restoration_id)`. If the op never applied
on this node (for example it was rejected asynchronously for a stale
term), this drops the fence. `restoring_sys_catalog_` is cleared on
unfence, restore f

**File**: `src/yb/master/catalog_manager.cc` (modified, +1/-1)
```diff
@@ -14592,7 +14592,7 @@ void CatalogManager::SysCatalogLoaded(SysCatalogLoadingState&& state) {
 
   SchedulePostTabletCreationTasksForPendingTables(state.epoch);
   EnqueuePendingBackfillsAfterLoad();
-  restoring_sys_catalog_ = false;
+  ClearRestoringSysCatalogIfNotFenced();
 
   if (FLAGS_enable_ysql) {
     // Initialize the catalog version cache.
```

**File**: `src/yb/master/catalog_manager.h` (modified, +16/-1)
```diff
@@ -1862,7 +1862,15 @@ class CatalogManager : public CatalogManagerIf, public SnapshotCoordinatorContex
 
   void SetCDCServiceEnabled();
 
-  void PrepareRestore() override;
+  void PrepareRestore(const TxnSnapshotRestorationId& restoration_id) override;
+
+  // Fails in-flight sys catalog work and rejects new RPCs ahead of the RESTORE_SYS_CATALOG op for
+  // restoration_id. Must be called before the op is submitted, not on apply.
+  void FenceSysCatalogForRestore(const TxnSnapshotRestorationId& restoration_id);
+
+  // Drops the fence for restoration_id unless its op was applied on this node.
+  // Must be called once the op has completed or failed to submit.
+  void UnfenceSysCatalogForRestore(const TxnSnapshotRestorationId& restoration_id);
 
   void RunXReplBgTasks(const LeaderEpoch& epoch);
 
@@ -2762,6 +2770,13 @@ class CatalogManager : public CatalogManagerIf, public SnapshotCoordinatorContex
   // that require this lock will fail.
   std::atomic_bool restoring_sys_catalog_ = false;
 
+  // Restorations fenced by FenceSysCatalogForRestore whose op has not been applied yet.
+  // restoring_sys_catalog_ is only cleared while this is empty.
+  std::mutex restore_fence_mutex_;
+  std::vector<TxnSnapshotRestorationId> fenced_restorations_ GUARDED_BY(restore_fence_mutex_);
+
+  void ClearRestoringSysCatalogIfNotFenced() EXCLUDES(restore_fence_mutex_);
+
   // Lock used to fence operations and leader elections. All logical operations
   // (i.e. create table, alter table, etc.) should acquire this lock for
   // reading. Following an election where this master is elected leader, it
```

**File**: `src/yb/master/catalog_manager_ext.cc` (modified, +60/-11)
```diff
@@ -10,6 +10,7 @@
 // or implied.  See the License for the specific language governing permissions and limitations
 // under the License.
 
+#include <algorithm>
 #include <memory>
 #include <optional>
 #include <queue>
@@ -3314,7 +3315,7 @@ Status CatalogManager::RestoreSysCatalog(
   if (!s.ok() && leader_mode) {
     LOG_WITH_PREFIX_AND_FUNC(INFO)
         << "PITR: Accepting RPCs to the master leader because of restoration failure: " << s;
-    restoring_sys_catalog_ = false;
+    ClearRestoringSysCatalogIfNotFenced();
   }
   // As RestoreSysCatalog is synchronous on Master it should be ok to set the completion
   // status in case of validation failures so that it gets propagated back to the client before
@@ -3863,14 +3864,18 @@ Result<size_t> CatalogManager::GetNumLiveTServersForActiveCluster() {
   return ts_descs.size();
 }
 
-// This function is used to fence other work in the catalog manager which modifies tables or tablets
-// with PITR restores. It is called during the apply of the RESTORE_SYS_CATALOG raft op.
+// These functions fence other work in the catalog manager which modifies tables or tablets with
+// PITR restores. The leader that submits a RESTORE_SYS_CATALOG op fences in
+// FenceSysCatalogForRestore before submitting it. PrepareRestore, called during the apply of the
+// op, only fences if this node did not fence for that op (e.g. it was submitted in an earlier
+// term). Fencing during apply can deadlock: IncrementPitrCount waits for in-flight sys catalog
+// writes, whose raft ops may be queued behind the restore op.
 //
-// Ideally this function would use the leader lock to wait for all async tasks and rpc handlers
+// Ideally the fence would use the leader lock to wait for all async tasks and rpc handlers
 // accessing catalog entities to return, but this is not possible:
-//  *  exclusively acquiring the CatalogManager::leader_mutex_ here introduces a lock inversion with
-//     ReplicaState::update_lock_.
-//  *  waiting to acquire the leader mutex here can add unbounded delay to a raft op apply,
+//  *  exclusively acquiring the CatalogManager::leader_mutex_ during apply introduces a lock
+//     inversion with ReplicaState::update_lock_.
+//  *  waiting to acquire the leader mutex during apply can add unbounded delay to a raft op apply,
 //     preventing raft heartbeats.
 //
 // Much existing code in the catalog manager acquires the locks in this order:
@@ -3880,17 +3885,61 @@ Result<size_t> CatalogManager::GetNumLiveTServersForActiveCluster() {
 // work (1) and preventing any new work until the sys catalog is reloaded (2).
 //   (1) Any logical unit of work in the catalog manager should grab a LeaderEpoch when it begins.
 //     The sys catalog mutation API for tables and tablets checks LeaderEpoch::pitr_count. If the
-//     catalog work began before PrepareRestore was called and tried to write after PrepareRestore
-//     was called, then the work's cached pitr_count will not match the sys catalog's pitr_count and
-//     the write will fail.
+//     catalog work began before the fence and tried to write after it, then the work's cached
+//     pitr_count will not match the sys catalog's pitr_count and the write will fail.
 //   (2) ScopedLeaderSharedLock checks restoring_sys_catalog_ and fails if it is set, so any new
 //     tasks will fail.
-void CatalogManager::PrepareRestore() {
+void CatalogManager::PrepareRestore(const TxnSnapshotRestorationId& restoration_id) {
+  restoring_sys_catalog_ = true;
+  {
+    std::lock_guard lock(restore_fence_mutex_);
+    auto it = std::find(fenced_restorations_.begin(), fenced_restorations_.end(), restoration_id);
+    if (it != fenced_restorations_.end()) {
+      fenced_restorations_.erase(it);
+      return;
+    }
+  }
   LOG_WITH_PREFIX(INFO) << "Disabling concurrent RPCs since restoration is ongoing";
+  sys_catalog_->IncrementPitrCount();
+}
+
+void CatalogManager::FenceSysCatalogForRestore(const TxnSnapshotRestorationId& restoration_id) {
+  LOG_WITH_PREFIX(INFO) << "Disabling concurrent RPCs before submitting sys catalog restore "
+                        << restoration_id;
+  {
+    std::lock_guard lock(restore_fence_mutex_);
+    fenced_restorations_.push_back(restoration_id);
+  }
   restoring_sys_catalog_ = true;
+  // Called without restore_fence_mutex_: this waits for writes whose ops may be queued behind
+  // another restore op, whose apply takes the mutex in PrepareRestore.
+  // The bump is not undone if the op is never applied. In-flight work then fails with Aborted as
+  // if a restore had happened, and new work picks up the new count.
   sys_catalog_->IncrementPitrCount();
 }
 
+void CatalogManager::UnfenceSysCatalogForRestore(const TxnSnapshotRestorationId& restoration_id) {
+  {
+    std::lock_guard lock(restore_fence_mutex_);
+    auto it = std::find(fenced_restorations_.begin(), fenced_restorations_.end(), restoration_id);
+    if (it == fenced_restorations_.end()) {
+      // Consumed by PrepareRestore:
```

**File**: `src/yb/master/master_snapshot_coordinator.cc` (modified, +9/-4)
```diff
@@ -625,7 +625,7 @@ class MasterSnapshotCoordinator::Impl {
     }
     // Disable concurrent RPCs to the master leader for the duration of sys catalog restore.
     if (leader_term >= 0) {
-      context_.PrepareRestore();
+      context_.PrepareRestore(restoration->restoration_id);
     }
     auto tablet = VERIFY_RESULT(operation.tablet_safe());
     LOG_SLOW_EXECUTION(INFO, 1000, "Restore sys catalog took") {
@@ -1882,9 +1882,14 @@ class MasterSnapshotCoordinator::Impl {
     operation->set_completion_callback(
         tablet::MakeWeakSynchronizerOperationCompletionCallback(synchronizer));
 
-    RETURN_NOT_OK(context_.Submit(std::move(operation), leader_term));
-
-    return synchronizer->Wait();
+    cm_->FenceSysCatalogForRestore(restoration_id);
+    auto status = context_.Submit(std::move(operation), leader_term);
+    if (status.ok()) {
+      // Rejections such as a stale term are reported here, not by Submit.
+      status = synchronizer->Wait();
+    }
+    cm_->UnfenceSysCatalogForRestore(restoration_id);
+    return status;
   }
 
   void DeleteSnapshotAborted(
```

**File**: `src/yb/master/snapshot_coordinator_context.h` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ class SnapshotCoordinatorContext {
 
   virtual Status Submit(std::unique_ptr<tablet::Operation> operation, int64_t leader_term) = 0;
 
-  virtual void PrepareRestore() = 0;
+  virtual void PrepareRestore(const TxnSnapshotRestorationId& restoration_id) = 0;
 
   virtual rpc::Scheduler& Scheduler() = 0;
 
```

---

### Incident Patch 3: `769f74bc` (2026-10-28)
**Commit Message**: [#35908] YSQL: Fix memory leak in Connection Manager cancel path

Summary:
Each cancel request that Connection Manager forwards to a backend leaked memory in Odyssey, about 8.7 KB per cancel: the io readahead buffer (8 KB by default) and cond vars allocated by `od_backend_connect_to()`, and the `yb_vars_session` var array from `od_server_init()`. Workloads that cancel often (statement timeouts, drivers that send CancelRequest) grow Odyssey's memory without bound.

`od_cancel()` built its `od_server_t` on the stack, so `is_allocated` was 0 and `od_server_free()` skipped freeing its members. `od_cancel()` now gets its server from `od_server_allocate()`, the same way every other server is created, and `od_server_free()` frees it fully. After this change every `od_server_t` is allocated on the heap; no server lives on the stack anymore.

This is the `cancel.c` part of upstream Odyssey commit daac7d53 ("Eleminate server IO leak on Cancel request", yandex/odyssey#527), cherry-picked with an added NULL check. The rest of that commit removes the `is_allocated` flag, which is always 1 now that every server is on the heap. Removing it will be part of a separate change, to keep this one small

**File**: `src/odyssey/sources/cancel.c` (modified, +8/-6)
```diff
@@ -15,11 +15,13 @@ int od_cancel(od_global_t *global, od_rule_storage_t *storage, kiwi_key_t *key,
 	od_instance_t *instance = global->instance;
 	od_log(&instance->logger, "cancel", NULL, NULL, "cancel for %s%.*s",
 	       server_id->id_prefix, sizeof(server_id->id), server_id->id);
-	od_server_t server;
-	od_server_init(&server, 0);
-	server.global = global;
-	od_backend_connect_cancel(&server, storage, key);
-	od_backend_close_connection(&server);
-	od_backend_close(&server);
+	od_server_t *server = od_server_allocate(0);
+	if (server == NULL) {
+		return -1;
+	}
+	server->global = global;
+	od_backend_connect_cancel(server, storage, key);
+	od_backend_close_connection(server);
+	od_backend_close(server);
 	return 0;
 }
```

#### Recent Merged Pull Requests:
- **PR #36079** (closed): [BACKPORT 2026.1][#35634] YSQL: import rejection of generated columns in COPY FROM WHERE (@teyenc)
- **PR #36035** (2026-10-28): [PLAT-23307] YBA: Validate user tags in v2 universe forms (@haikarthikssk)
- **PR #36016** (2026-10-28): [2026.1][#35771] DocDB: Fix 2026.1 build: move ShutdownWaitsForChunkSave to VectorLSMHnswlibTest (@hari90)
- **PR #36004** (2026-10-28): [#35634] YSQL: import rejection of generated columns in COPY FROM WHERE (@teyenc)
- **PR #35971** (closed): [#35968] ClaudeCode: Make GitHub PRs the default and Phorge opt-in in agent skills (@siddiqueirshad)
- **PR #35963** (2026-10-28): [#20955,#34090,#35083] YSQL: revert making the planner aggregate-pushdown aware (@jasonyb)

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

## X. [#35462] DocDB: Fix RemoveTabletServerTest.MayStillHoldLease by waiting for a po

**RULE**:
When implementing operations in `src/yb/master/master_cluster_test.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yugabyte/yugabyte-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d6468da`: [#35462] DocDB: Fix RemoveTabletServerTest.MayStillHoldLease by waiting for a post-blacklist balancer run in drain (#35463). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/yb/master/master_cluster_test.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
#include "yb/master/cluster_balance.h"
  // A balancer run that read the old blacklist may have queued an add to this ts, and that task
  // outlives the run. Only trust the checks below once a run that started after the blacklist
  // change has ended with no balancer tasks pending.
  auto latest_balancer_activity = [this]() -> Result<ClusterBalancerActivityInfo> {
    auto* leader = VERIFY_RESULT(cluster_->GetLeaderMiniMaster());
    return leader->catalog_manager_impl().cluster_balancer()->GetLatestActivityInfo();
  };
  const auto blacklist_time = MonoTime::Now();
  RETURN_NOT_OK(WaitFor(
      [&latest_balancer_activity, blacklist_time]() -> Result<bool> {
        return VERIFY_RESULT(latest_balancer_activity()).run_end_time_ > blacklist_time;
      },
      timeout, "Cluster balancer run after blacklist change"));
  const auto fresh_run_start = MonoTime::Now();

      [this, &ts_proxy, &message, &uuid, &client, &latest_balancer_activity,
       fresh_run_start]() -> Result<bool> {
        auto activity = VERIFY_RESULT(latest_balancer_activity());
        if (activity.run_end_time_ <= fresh_run_start) {
          message = "waiting for a cluster balancer run that saw the black
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
      [this, &ts_proxy, &message, &uuid, &client]() -> Result<bool> {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7d6468da` are properly handled with clean fallback behavior.
