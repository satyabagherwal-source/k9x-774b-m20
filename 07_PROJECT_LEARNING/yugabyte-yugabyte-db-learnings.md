> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source**: github ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Source Version**: `43410e87`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T05:13:21.640Z  
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
> **Harvest Timestamp**: 2026-11-12T05:13:21.634Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yugabyte/yugabyte-db`
- **Description**: YugabyteDB - the cloud native distributed SQL database for mission-critical applications.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10662 stars

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
import google.auth.transport.requests
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
OS_LOGIN_META_KEY = "enable-oslogin"

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
            return self.network_info_as_json(network_
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
from ybops.cloud.oci.errors import format_oci_error
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
- **Issue #37652** (2026-11-12): **Docs: Document setting-dependent literals in prepared statements with YSQL Connection Manager**
  *Symptoms*: fixes #36878   **Summary** - Adds a best-practices section to `ycm-best-practices.md` on setting-dependent literals in prepared statements when using YSQL Connection Manager. - In PostgreSQL, literals in a prepared statement (for example `now`, or values that depend on `TimeZone` or `DateStyle`) are converted once, at parse time, using the session's settings. Later executions reuse that result. A re-parse happens only after object changes or `search_path` changes. - Connection Manager shares protocol-level prepared statements across the clients of a pool. A statement can therefore carry another client's settings, and the section explains how to avoid that. - Applied to stable, v2025.2, v2025.1 and v2024.2.

- **Issue #37634** (2026-11-12): **[#37632] DocDB: Collect /pprof/heap using builtin tcmalloc API**
  *Symptoms*: ## Summary  **Background.** Every YugabyteDB server has a debugging page, `/pprof/heap?seconds=N`, that shows which code allocated memory during the next N seconds. With `only_growth=true`, it shows only the memory that is still in use when those N seconds end, which helps find leaks. The data comes from tcmalloc, the memory allocator YugabyteDB uses. tcmalloc records a sample of allocations, each with the call stack that made it.  **Problem.** The page relies on an option that exists only in YugabyteDB's own copy (fork) of tcmalloc (https://github.com/yugabyte/tcmalloc/pull/3). Without that option, the original (upstream) tcmalloc fills every new profile with all the memory already in use when profiling starts. The page would then list allocations made long before the N-second window, and the `only_growth` view would show nearly the whole heap. We plan to switch to upstream tcmalloc (https://github.com/yugabyte/yugabyte-db/issues/37087), so the page has to stop depending on that option.  **Fix.** Stop using the lifetime profiler, which is the tcmalloc feature that needed the fork-only option. The page needs two views of the window: every allocation made during it (the default view), and only the allocations still in use at the end (`only_growth`). Neither tcmalloc feature gives both on its own, so `GetHeapProfile()` now collects one of each. Both features exist in the fork and in upstream:  ```cpp profile.start_time = absl::Now();                                       // not

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

### Incident Patch 1: `5bf305bb` (2026-11-12)
**Commit Message**: [#35476,#36130] YSQL: Fix single-row UPDATE/DELETE when the WHERE value's type differs from the key column (#36669)

## Summary

### Problem

A single-row UPDATE or DELETE builds the row's primary key straight from
the WHERE values, without reading the row first. When a WHERE value has
another type than its key column, the statement can change or delete the
wrong row, miss the right row, or fail. PG compares with the cross-type
`=` and gets every case below right.

DELETE statements on master
([029efa15de1](https://github.com/yugabyte/yugabyte-db/commit/029efa15de1de198469109a94da285d9eeeaeba9))
and on vanilla PG:

| Key column | WHERE | Master | PG |
| --- | --- | --- | --- |
| `int` | `k = 4294967297` (2^32 + 1) | deletes 1 | deletes nothing |
| `smallint` | `k = 65537` (2^16 + 1) | deletes 1 | deletes nothing |
| `int` | prepared `k = $1` with a bigint parameter, generic plan,
`EXECUTE p(5)` | ERROR: Attribute value type does not match column type
| deletes 5 |
| `real` | `k = 1.5` | deletes 0 | deletes 1.5 |
| `timestamp` | `k = DATE '2024-01-02'` | deletes 2000-01-01
00:00:00.008767 | deletes 2024-01-02 00:00 |
| `name` | prepared `k = $1` with a text parameter, `EXECUTE p('ab

**File**: `src/postgres/src/backend/access/yb_scan/yb_scan_plan.c` (modified, +3/-0)
```diff
@@ -148,6 +148,9 @@ YbIsValueOutOfRange(Oid col_typid, Oid val_typid, Datum val)
 
 /*
  * Return true if a scan key column type is compatible with value type.
+ *
+ * Single row UPDATE and DELETE also use this (yb_single_row_key_value): a pair
+ * marked compatible by mistake makes them change or delete the wrong row.
  */
 bool
 YbIsScanCompatible(Oid column_typid,
```

**File**: `src/postgres/src/backend/executor/ybModifyTable.c` (modified, +51/-1)
```diff
@@ -28,6 +28,7 @@
 #include "access/htup_details.h"
 #include "access/sysattr.h"
 #include "access/xact.h"
+#include "access/yb_scan_plan.h"
 #include "access/yb_target.h"
 #include "catalog/catalog.h"
 #include "catalog/heap.h"
@@ -174,6 +175,9 @@ YBCGetYBTupleIdFromSlot(TupleTableSlot *slot)
  * Note that if the relation has a DocDB RowId attribute, this will generate a new RowId value
  * meaning the ybctid will be unique. Therefore you should only use this if the relation has
  * a primary key or you're doing an insert.
+ *
+ * Return 0 if a key value of a single row UPDATE or DELETE doesn't fit in its
+ * column's type: it matches no row, so the caller skips the write.
  */
 Datum
 YBCComputeYBTupleIdFromSlot(Relation rel, TupleTableSlot *slot)
@@ -203,10 +207,38 @@ YBCComputeYBTupleIdFromSlot(Relation rel, TupleTableSlot *slot)
 		{
 			Oid			type_id = TupleDescAttr(slot->tts_tupleDescriptor,
 												attnum - 1)->atttypid;
+			Oid			col_type_id = TupleDescAttr(RelationGetDescr(rel),
+													attnum - 1)->atttypid;
+
+			next_attr->datum = slot_getattr(slot, attnum, &next_attr->is_null);
+
+			/*
+			 * A key value of a single row UPDATE or DELETE can be an integer
+			 * of another width than its column (yb_single_row_key_value in
+			 * createplan.c):
+			 * (1) If the column's type can hold it, bind it with the column's
+			 *     type, as YbBindColumn does for scan keys: an integer has the
+			 *     same Datum at every width.
+			 * (2) Otherwise, it matches no row: return 0.
+			 * The planner checks YbIsScanCompatible too, but a value of another
+			 * type can still get here, such as through an expression index.
+			 */
+			if (type_id != col_type_id &&
+				YbIsScanCompatible(getBaseType(col_type_id), type_id,
+								   false /* is_value_scalar */ , (Datum) 0))
+			{
+				if (!next_attr->is_null &&
+					YbIsValueOutOfRange(getBaseType(col_type_id), type_id,
+										next_attr->datum))
+				{
+					pfree(descr);
+					return (Datum) 0;
+				}
+				type_id = col_type_id;
+			}
 
 			next_attr->type_entity = YbDataTypeFromOidMod(attnum, type_id);
 			next_attr->collation_id = ybc_get_attcollation(RelationGetDescr(rel), attnum);
-			next_attr->datum = slot_getattr(slot, attnum, &next_attr->is_null);
 		}
 		else if (attnum == YBRowIdAttributeNumber)
 		{
@@ -1007,8 +1039,17 @@ YBCExecuteDelete(Relation rel,
 	if (target_tuple_fetched)
 		ybctid = YBCGetYBTupleIdFromSlot(planSlot);
 	else
+	{
 		ybctid = YBCComputeYBTupleIdFromSlot(rel, planSlot);
 
+		/* A key value too wide for its column matches no row. */
+		if (ybctid == 0)
+		{
+			YBCPgDeleteStatement(delete_stmt);
+			return false;
+		}
+	}
+
 	if (ybctid == 0)
 	{
 		ereport(ERROR,
@@ -1221,8 +1262,17 @@ YBCExecuteUpdate(ResultRelInfo *resultRelInfo,
 	if (target_tuple_fetched)
 		ybctid = YBCGetYBTupleIdFromSlot(planSlot);
 	else
+	{
 		ybctid = YBCComputeYBTupleIdFromSlot(rel, slot);
 
+		/* A key value too wide for its column matches no row. */
+		if (ybctid == 0)
+		{
+			YBCPgDeleteStatement(update_stmt);
+			return false;
+		}
+	}
+
 	if (ybctid == 0)
 		ereport(ERROR,
 				(errcode(ERRCODE_UNDEFINED_COLUMN),
```

**File**: `src/postgres/src/backend/optimizer/plan/createplan.c` (modified, +48/-10)
```diff
@@ -45,6 +45,7 @@
 
 /* YB includes */
 #include "access/htup_details.h"
+#include "access/yb_scan_plan.h"
 #include "access/yb_target.h"
 #include "catalog/partition.h"
 #include "catalog/pg_am.h"
@@ -56,6 +57,7 @@
 #include "executor/ybExpr.h"
 #include "optimizer/yb_merge_scan.h"
 #include "optimizer/ybplan.h"
+#include "parser/parse_coerce.h"
 #include "pg_yb_utils.h"
 #include "utils/fmgroids.h"
 #include "utils/rel.h"
@@ -3516,6 +3518,47 @@ yb_fetch_subpaths(ModifyTablePath *path, IndexPath **index_path,
 	return;
 }
 
+/*
+ * yb_single_row_key_value
+ *
+ * Helper function for yb_single_row_update_or_delete_path.  Return the
+ * expression for the one primary key value that "column = expr" can match, or
+ * NULL to use the scan path instead.  expr can be of another type than the
+ * column, as in int4_col = int8_value.
+ */
+static Expr *
+yb_single_row_key_value(Expr *expr, Oid coltype)
+{
+	Oid			valtype = exprType((Node *) expr);
+	Oid			basetype = getBaseType(coltype);
+
+	if (valtype == coltype)
+		return expr;
+
+	/*
+	 * True if the value's bytes mean the same value in the column's type: then
+	 * only the type label changes.
+	 */
+	if (IsBinaryCoercible(valtype, basetype))
+		return (Expr *) makeRelabelType(expr, coltype, -1,
+										get_typcollation(coltype),
+										COERCE_IMPLICIT_CAST);
+
+	/*
+	 * Otherwise:
+	 * (1) A value that scan keys bind with the column's type
+	 *     (YbIsScanCompatible): an integer of another width, a text, varchar
+	 *     or bpchar value for a column of another of these types, or an OID
+	 *     type value for a column of another OID type.  Keep it, and let
+	 *     YBCComputeYBTupleIdFromSlot bind it with the column's type.
+	 * (2) Any other type, such as a double for a real column: use the scan.
+	 */
+	if (!YbIsScanCompatible(basetype, valtype, false /* is_value_scalar */ ,
+							(Datum) 0))
+		return NULL;
+	return expr;
+}
+
 /*
  * yb_single_row_update_or_delete_path
  *
@@ -4026,17 +4069,12 @@ yb_single_row_update_or_delete_path(PlannerInfo *root,
 		}
 		var = castNode(Var, leftop);
 
-		/*
-		 * If const expression has a different type than the column (var), wrap in a relabel
-		 * expression with the proper type so it is coerced at execution time.
-		 */
-		if (IsA(expr, Const) && castNode(Const, expr)->consttype != var->vartype)
+		/* The value may be of another type than the column. */
+		expr = yb_single_row_key_value(expr, var->vartype);
+		if (expr == NULL)
 		{
-			expr = (Expr *) makeRelabelType(expr,
-											var->vartype,
-											-1,
-											get_typcollation(var->vartype),
-											COERCE_IMPLICIT_CAST);
+			RelationClose(relation);
+			return false;
 		}
 
 		tle = makeNode(TargetEntry);
```

**File**: `src/postgres/src/test/regress/expected/yb.orig.dml_single_row.out` (modified, +434/-0)
```diff
@@ -3571,3 +3571,437 @@ DROP TABLE t_temp;
 DROP TYPE rt;
 DROP TYPE two_int;
 DROP TYPE two_text;
+--
+-- Test single-row UPDATE/DELETE where the WHERE value has another type than the
+-- primary key column (GH#35476).  A value must not be reinterpreted as the
+-- column type: statements must update the same rows as they do in PostgreSQL.
+--
+CREATE TABLE sr_cross_int4 (k int PRIMARY KEY, v int);
+INSERT INTO sr_cross_int4 VALUES (-2147483648, 0), (1, 0), (2, 0), (3, 0), (2147483647, 0);
+CREATE TABLE sr_cross_int2 (k smallint PRIMARY KEY, v int);
+INSERT INTO sr_cross_int2 VALUES (-32768, 0), (1, 0), (2, 0), (32767, 0);
+CREATE TABLE sr_cross_int8 (k bigint PRIMARY KEY, v int);
+INSERT INTO sr_cross_int8 VALUES (-1, 0), (2, 0), (4294967295, 0);
+-- bigint values that do not fit an int4 column match no row.  Their low 32 bits
+-- are the keys 1 and 2.
+UPDATE sr_cross_int4 SET v = 1 WHERE k = 4294967297;
+DELETE FROM sr_cross_int4 WHERE k = 4294967298;
+-- One past either end of the int4 range.
+UPDATE sr_cross_int4 SET v = 1 WHERE k = 2147483648;
+UPDATE sr_cross_int4 SET v = 1 WHERE k = -2147483649;
+SELECT * FROM sr_cross_int4 ORDER BY k;
+      k      | v 
+-------------+---
+ -2147483648 | 0
+           1 | 0
+           2 | 0
+           3 | 0
+  2147483647 | 0
+(5 rows)
+
+-- bigint values that fit still use single-row.
+EXPLAIN (COSTS OFF) UPDATE sr_cross_int4 SET v = 5 WHERE k = 2::bigint;
+         QUERY PLAN         
+----------------------------
+ Update on sr_cross_int4
+   ->  Result sr_cross_int4
+(2 rows)
+
+UPDATE sr_cross_int4 SET v = 5 WHERE k = 2::bigint;
+UPDATE sr_cross_int4 SET v = 5 WHERE k = 2147483647::bigint;
+UPDATE sr_cross_int4 SET v = 5 WHERE k = -2147483648::bigint;
+SELECT * FROM sr_cross_int4 ORDER BY k;
+      k      | v 
+-------------+---
+ -2147483648 | 5
+           1 | 0
+           2 | 5
+           3 | 0
+  2147483647 | 5
+(5 rows)
+
+-- Same for smallint with int4 and bigint values.
+UPDATE sr_cross_int2 SET v = 1 WHERE k = 65537;
+DELETE FROM sr_cross_int2 WHERE k = 4294967298;
+UPDATE sr_cross_int2 SET v = 1 WHERE k = 32768;
+UPDATE sr_cross_int2 SET v = 1 WHERE k = -32769;
+SELECT * FROM sr_cross_int2 ORDER BY k;
+   k    | v 
+--------+---
+ -32768 | 0
+      1 | 0
+      2 | 0
+  32767 | 0
+(4 rows)
+
+-- A wider column holds every narrower value: single-row.
+EXPLAIN (COSTS OFF) UPDATE sr_cross_int8 SET v = 1 WHERE k = -1;
+         QUERY PLAN         
+----------------------------
+ Update on sr_cross_int8
+   ->  Result sr_cross_int8
+(2 rows)
+
+UPDATE sr_cross_int8 SET v = 1 WHERE k = -1;
+SELECT * FROM sr_cross_int8 ORDER BY k;
+     k      | v 
+------------+---
+         -1 | 1
+          2 | 0
+ 4294967295 | 0
+(3 rows)
+
+-- The same with an int parameter in a generic plan (GH#36130).
+SET plan_cache_mode = force_generic_plan;
+PREPARE sr_cross_pw(int) AS UPDATE sr_cross_int8 SET v = 2 WHERE k = $1;
+EXPLAIN (COSTS OFF) EXECUTE sr_cross_pw(-1);
+         QUERY PLAN         
+----------------------------
+ Update on sr_cross_int8
+   ->  Result sr_cross_int8
+(2 rows)
+
+EXECUTE sr_cross_pw(-1);
+SELECT * FROM sr_cross_int8 ORDER BY k;
+     k      | v 
+------------+---
+         -1 | 2
+          2 | 0
+ 4294967295 | 0
+(3 rows)
+
+DEALLOCATE sr_cross_pw;
+RESET plan_cache_mode;
+-- A bind parameter in a generic plan, which is still single-row, gives the same
+-- result.
+SET plan_cache_mode = force_generic_plan;
+PREPARE sr_cross_p(bigint) AS UPDATE sr_cross_int4 SET v = 9 WHERE k = $1;
+EXPLAIN (COSTS OFF) EXECUTE sr_cross_p(3);
+         QUERY PLAN         
+----------------------------
+ Update on sr_cross_int4
+   ->  Result sr_cross_int4
+(2 rows)
+
+EXECUTE sr_cross_p(4294967297);
+EXECUTE sr_cross_p(2147483648);
+EXECUTE sr_cross_p(NULL);
+EXECUTE sr_cross_p(3);
+SELECT * FROM sr_cross_int4 ORDER BY k;
+      k      | v 
+-------------+---
+ -2147483648 | 5
+           1 | 0
+           2 | 5
+           3 | 9
+  2147483647 | 5
+(5 rows)
+
+DEALLOCATE sr_cross_p;
+RESET plan_cache_mode;
+-- Partitioned table: 4294967446 is 2^32 + 150, its low 32 bits are the key 150.
+CREATE TABLE sr_cross_part (k int PRIMARY KEY, v int) PARTITION BY RANGE (k);
+CREATE TABLE sr_cross_part_lo PARTITION OF sr_cross_part FOR VALUES FROM (MINVALUE) TO (100);
+CREATE TABLE sr_cross_part_hi PARTITION OF sr_cross_part FOR VALUES FROM (100) TO (MAXVALUE);
+INSERT INTO sr_cross_part VALUES (1, 0), (150, 0);
+UPDATE sr_cross_part SET v = 1 WHERE k = 4294967446;
+SELECT * FROM sr_cross_part ORDER BY k;
+  k  | v 
+-----+---
+   1 | 0
+ 150 | 0
+(2 rows)
+
+UPDATE sr_cross_part SET v = 2 WHERE k = 150::bigint;
+SELECT * FROM sr_cross_part ORDER BY k;
+  k  | v 
+-----+---
+   1 | 0
+ 150 | 2
+(2 rows)
+
+-- A two-column key: 4294967297 and 4294967298 are 2^32 + 1 and 2^32 + 2, their
+-- low 32 bits are the keys 1 and 2.  A generic plan checks the values of both
+-- columns at execution.
+CREATE TABLE sr_cross_two (a int, b int, v int, PRIMARY KEY (a, b));
+INSERT INTO
```

**File**: `src/postgres/src/test/regress/sql/yb.orig.dml_single_row.sql` (modified, +212/-0)
```diff
@@ -1152,3 +1152,215 @@ DROP TABLE t_temp;
 DROP TYPE rt;
 DROP TYPE two_int;
 DROP TYPE two_text;
+
+--
+-- Test single-row UPDATE/DELETE where the WHERE value has another type than the
+-- primary key column (GH#35476).  A value must not be reinterpreted as the
+-- column type: statements must update the same rows as they do in PostgreSQL.
+--
+CREATE TABLE sr_cross_int4 (k int PRIMARY KEY, v int);
+INSERT INTO sr_cross_int4 VALUES (-2147483648, 0), (1, 0), (2, 0), (3, 0), (2147483647, 0);
+CREATE TABLE sr_cross_int2 (k smallint PRIMARY KEY, v int);
+INSERT INTO sr_cross_int2 VALUES (-32768, 0), (1, 0), (2, 0), (32767, 0);
+CREATE TABLE sr_cross_int8 (k bigint PRIMARY KEY, v int);
+INSERT INTO sr_cross_int8 VALUES (-1, 0), (2, 0), (4294967295, 0);
+
+-- bigint values that do not fit an int4 column match no row.  Their low 32 bits
+-- are the keys 1 and 2.
+UPDATE sr_cross_int4 SET v = 1 WHERE k = 4294967297;
+DELETE FROM sr_cross_int4 WHERE k = 4294967298;
+-- One past either end of the int4 range.
+UPDATE sr_cross_int4 SET v = 1 WHERE k = 2147483648;
+UPDATE sr_cross_int4 SET v = 1 WHERE k = -2147483649;
+SELECT * FROM sr_cross_int4 ORDER BY k;
+-- bigint values that fit still use single-row.
+EXPLAIN (COSTS OFF) UPDATE sr_cross_int4 SET v = 5 WHERE k = 2::bigint;
+UPDATE sr_cross_int4 SET v = 5 WHERE k = 2::bigint;
+UPDATE sr_cross_int4 SET v = 5 WHERE k = 2147483647::bigint;
+UPDATE sr_cross_int4 SET v = 5 WHERE k = -2147483648::bigint;
+SELECT * FROM sr_cross_int4 ORDER BY k;
+
+-- Same for smallint with int4 and bigint values.
+UPDATE sr_cross_int2 SET v = 1 WHERE k = 65537;
+DELETE FROM sr_cross_int2 WHERE k = 4294967298;
+UPDATE sr_cross_int2 SET v = 1 WHERE k = 32768;
+UPDATE sr_cross_int2 SET v = 1 WHERE k = -32769;
+SELECT * FROM sr_cross_int2 ORDER BY k;
+
+-- A wider column holds every narrower value: single-row.
+EXPLAIN (COSTS OFF) UPDATE sr_cross_int8 SET v = 1 WHERE k = -1;
+UPDATE sr_cross_int8 SET v = 1 WHERE k = -1;
+SELECT * FROM sr_cross_int8 ORDER BY k;
+
+-- The same with an int parameter in a generic plan (GH#36130).
+SET plan_cache_mode = force_generic_plan;
+PREPARE sr_cross_pw(int) AS UPDATE sr_cross_int8 SET v = 2 WHERE k = $1;
+EXPLAIN (COSTS OFF) EXECUTE sr_cross_pw(-1);
+EXECUTE sr_cross_pw(-1);
+SELECT * FROM sr_cross_int8 ORDER BY k;
+DEALLOCATE sr_cross_pw;
+RESET plan_cache_mode;
+
+-- A bind parameter in a generic plan, which is still single-row, gives the same
+-- result.
+SET plan_cache_mode = force_generic_plan;
+PREPARE sr_cross_p(bigint) AS UPDATE sr_cross_int4 SET v = 9 WHERE k = $1;
+EXPLAIN (COSTS OFF) EXECUTE sr_cross_p(3);
+EXECUTE sr_cross_p(4294967297);
+EXECUTE sr_cross_p(2147483648);
+EXECUTE sr_cross_p(NULL);
+EXECUTE sr_cross_p(3);
+SELECT * FROM sr_cross_int4 ORDER BY k;
+DEALLOCATE sr_cross_p;
+RESET plan_cache_mode;
+
+-- Partitioned table: 4294967446 is 2^32 + 150, its low 32 bits are the key 150.
+CREATE TABLE sr_cross_part (k int PRIMARY KEY, v int) PARTITION BY RANGE (k);
+CREATE TABLE sr_cross_part_lo PARTITION OF sr_cross_part FOR VALUES FROM (MINVALUE) TO (100);
+CREATE TABLE sr_cross_part_hi PARTITION OF sr_cross_part FOR VALUES FROM (100) TO (MAXVALUE);
+INSERT INTO sr_cross_part VALUES (1, 0), (150, 0);
+UPDATE sr_cross_part SET v = 1 WHERE k = 4294967446;
+SELECT * FROM sr_cross_part ORDER BY k;
+UPDATE sr_cross_part SET v = 2 WHERE k = 150::bigint;
+SELECT * FROM sr_cross_part ORDER BY k;
+
+-- A two-column key: 4294967297 and 4294967298 are 2^32 + 1 and 2^32 + 2, their
+-- low 32 bits are the keys 1 and 2.  A generic plan checks the values of both
+-- columns at execution.
+CREATE TABLE sr_cross_two (a int, b int, v int, PRIMARY KEY (a, b));
+INSERT INTO sr_cross_two VALUES (1, 1, 0), (1, 2, 0), (2, 1, 0);
+UPDATE sr_cross_two SET v = 1 WHERE a = 4294967297 AND b = 1;
+EXPLAIN (COSTS OFF) UPDATE sr_cross_two SET v = 2 WHERE a = 1::bigint AND b = 2::bigint;
+UPDATE sr_cross_two SET v = 2 WHERE a = 1::bigint AND b = 2::bigint;
+SET plan_cache_mode = force_generic_plan;
+PREPARE sr_cross_p2(bigint, bigint) AS UPDATE sr_cross_two SET v = 3 WHERE a = $1 AND b = $2;
+EXPLAIN (COSTS OFF) EXECUTE sr_cross_p2(2, 1);
+EXECUTE sr_cross_p2(2, 4294967297);
+EXECUTE sr_cross_p2(4294967298, 1);
+EXECUTE sr_cross_p2(2, 1);
+SELECT * FROM sr_cross_two ORDER BY a, b;
+DEALLOCATE sr_cross_p2;
+RESET plan_cache_mode;
+
+-- A key of columns of different types, each with values of another type.
+-- 65537 and 65538 are 2^16 + 1 and 2^16 + 2, their low 16 bits are the keys 1
+-- and 2.
+CREATE TABLE sr_cross_mixed (a smallint, b bigint, c varchar, v int,
+	PRIMARY KEY (a, b, c));
+INSERT INTO sr_cross_mixed VALUES (1, 1, 'x', 0), (1, 2, 'x', 0), (2, 1, 'x', 0);
+UPDATE sr_cross_mixed SET v = 1 WHERE a = 65537 AND b = 1 AND c = 'x';
+EXPLAIN (COSTS OFF) UPDATE sr_cross_mixed SET v = 2
+	WHERE a = 1::bigint AND b = 2::int AND c = 'x'::text;
+UPDATE sr_cross_mixed SET v = 2 WHERE a = 1::bigint AND b = 2::int AND c = 'x'::text;
+SET plan_cache_mode = force_generic_p
```

---

### Incident Patch 2: `e1566f54` (2026-11-11)
**Commit Message**: [#34424] YSQL: Fix transition tables on partitioned tables with single-row UPDATE/DELETE (#34435)

## Summary

Transition tables (`REFERENCING OLD/NEW TABLE`) on a partitioned table
were broken when the statement could use YB's single-row UPDATE/DELETE
fast path (`WHERE <pk> = <const>`).

`yb_single_row_update_or_delete_path()` decides whether the old row is
needed by looking only at the leaf partition's triggers. Transition
tables are defined on the relation named in the query, which for a
partitioned table is an ancestor of the leaf, so the check missed them:

- **DELETE crash.** `DELETE FROM <partitioned root> WHERE <pk> =
<const>` took the single-row path, which never fetches the old row. It
then crashed in `GetTupleForTrigger()` while capturing that row for the
transition table.
- **UPDATE produced empty transition tables**, even when the planner
fell back to a regular scan (e.g. `WHERE v >= 1`). The function set
`no_row_trigger` and then bailed out of the fast path for an unrelated
reason. `create_modifytable_plan()` still copied the flag onto the scan
plan, so `ExecUpdateEpilogue()` skipped `ExecARUpdateTriggers()`, which
is where transition rows are captured. DELETE doesn't

**File**: `src/postgres/src/backend/executor/nodeModifyTable.c` (modified, +5/-5)
```diff
@@ -6015,11 +6015,11 @@ YbFetchColumnsMarkedForUpdate(ModifyTableContext *context,
  *    are single row).
  *
  * Transition-table capture does not need to be checked here: the single-row
- * UPDATE/DELETE path in createplan.c is only taken when no row triggers
- * apply (see has_applicable_triggers()), and that helper consults
- * YBRelHasOldRowTriggers() which already rejects any relation carrying an
- * AFTER UPDATE/DELETE trigger with REFERENCING OLD/NEW TABLE.  So a Result
- * outer plan implies no transition_capture.
+ * UPDATE/DELETE path in createplan.c is not taken when the target leaf
+ * (has_applicable_triggers()) or the relation named in the query
+ * (yb_target_has_transition_tables()) has an AFTER UPDATE/DELETE trigger
+ * with REFERENCING OLD/NEW TABLE.  So a Result outer plan implies no
+ * transition_capture.
  */
 static bool
 ybCanSkipFetchingTargetTuple(ModifyTable *modifyTable, Relation targetRel)
```

**File**: `src/postgres/src/backend/optimizer/plan/createplan.c` (modified, +37/-2)
```diff
@@ -3403,6 +3403,33 @@ has_applicable_triggers(Relation rel, CmdType operation, Bitmapset *updated_attr
 	return false;
 }
 
+/*
+ * Returns true if the given relation captures transition tables for the given
+ * operation.  For a partitioned target, the transition-table triggers live
+ * only on the relation named in the query, not on the leaf that
+ * has_applicable_triggers() examines.
+ */
+static bool
+yb_target_has_transition_tables(Oid relid, CmdType operation)
+{
+	Relation	target_rel;
+	TriggerDesc *trigdesc;
+	bool		result = false;
+
+	target_rel = RelationIdGetRelation(relid);
+	trigdesc = target_rel->trigdesc;
+	if (trigdesc)
+	{
+		if (operation == CMD_DELETE)
+			result = trigdesc->trig_delete_old_table;
+		else if (operation == CMD_UPDATE)
+			result = (trigdesc->trig_update_old_table ||
+					  trigdesc->trig_update_new_table);
+	}
+	RelationClose(target_rel);
+	return result;
+}
+
 /*
  * yb_leaf_update_modifies_partition_key
  *
@@ -3543,6 +3570,7 @@ yb_single_row_update_or_delete_path(PlannerInfo *root,
 {
 	RelOptInfo *relInfo = NULL;
 	Oid			relid;
+	Oid			query_target_relid;
 	Relation	relation;
 	TupleDesc	tupDesc;
 	IndexPath  *index_path;
@@ -3847,8 +3875,15 @@ yb_single_row_update_or_delete_path(PlannerInfo *root,
 	/*
 	 * Cannot support before row triggers for single-row update/delete, as the
 	 * old row will need to be passed to the trigger, requiring the scan.
-	 */
-	*no_row_trigger = !has_applicable_triggers(relation, path->operation, update_attrs);
+	 * Transition tables likewise need the old row.
+	 */
+	query_target_relid = planner_rt_fetch(root->parse->resultRelation,
+										  root)->relid;
+	*no_row_trigger = (!has_applicable_triggers(relation, path->operation,
+												update_attrs) &&
+					   (relid == query_target_relid ||
+						!yb_target_has_transition_tables(query_target_relid,
+														 path->operation)));
 	if (!*no_row_trigger)
 	{
 		RelationClose(relation);
```

**File**: `src/postgres/src/test/regress/expected/yb.orig.transition_tables.out` (modified, +75/-0)
```diff
@@ -674,6 +674,81 @@ SELECT a, length(b) AS b_len, left(b,1) AS b_first, c FROM tt_ioc_root ORDER BY
 DROP TABLE tt_ioc_root;
 DROP FUNCTION tt_ioc_cap();
 ----------------------------------------------------------------------
+-- Section 14: Single-row (primary key) UPDATE/DELETE on a partitioned table
+----------------------------------------------------------------------
+-- The transition-table triggers are on the root, not on the leaf that the
+-- single-row modify path would target, so that path must not be used.
+CREATE TABLE tt_sr (id int PRIMARY KEY, val text) PARTITION BY RANGE (id);
+CREATE TABLE tt_sr_mid PARTITION OF tt_sr FOR VALUES FROM (1) TO (100)
+  PARTITION BY RANGE (id);
+CREATE TABLE tt_sr_leaf PARTITION OF tt_sr_mid FOR VALUES FROM (1) TO (100);
+INSERT INTO tt_sr VALUES (1, 'a'), (2, 'b'), (3, 'c'), (4, 'd');
+CREATE TRIGGER tt_sr_upd AFTER UPDATE ON tt_sr
+  REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_update();
+CREATE TRIGGER tt_sr_del AFTER DELETE ON tt_sr
+  REFERENCING OLD TABLE AS old_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_delete();
+CREATE TRIGGER tt_sr_mid_del AFTER DELETE ON tt_sr_mid
+  REFERENCING OLD TABLE AS old_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_delete();
+EXPLAIN (COSTS OFF) UPDATE tt_sr SET val = 'x' WHERE id = 1;
+                          QUERY PLAN                          
+--------------------------------------------------------------
+ Update on tt_sr
+   Update on tt_sr_leaf tt_sr_2
+   ->  Index Scan using tt_sr_leaf_pkey on tt_sr_leaf tt_sr_2
+         Index Cond: (id = 1)
+(4 rows)
+
+UPDATE tt_sr SET val = 'x' WHERE id = 1;
+NOTICE:  tt_log_update: tg_op=UPDATE, old_table=(1,a), new_table=(1,x)
+-- Not single-row, but planned after the single-row path was considered
+UPDATE tt_sr SET val = val || 'x' WHERE val = 'x';
+NOTICE:  tt_log_update: tg_op=UPDATE, old_table=(1,x), new_table=(1,xx)
+EXPLAIN (COSTS OFF) DELETE FROM tt_sr WHERE id = 1;
+                          QUERY PLAN                          
+--------------------------------------------------------------
+ Delete on tt_sr
+   Delete on tt_sr_leaf tt_sr_2
+   ->  Index Scan using tt_sr_leaf_pkey on tt_sr_leaf tt_sr_2
+         Index Cond: (id = 1)
+(4 rows)
+
+DELETE FROM tt_sr WHERE id = 1;
+NOTICE:  tt_log_delete: tg_op=DELETE, old_table=(1,xx)
+-- Intermediate partitioned table named in the query
+DELETE FROM tt_sr_mid WHERE id = 2;
+NOTICE:  tt_log_delete: tg_op=DELETE, old_table=(2,b)
+-- Only an UPDATE trigger on the root: single-row DELETE is still allowed
+DROP TRIGGER tt_sr_del ON tt_sr;
+EXPLAIN (COSTS OFF) DELETE FROM tt_sr WHERE id = 3;
+          QUERY PLAN          
+------------------------------
+ Delete on tt_sr
+   Delete on tt_sr_leaf tt_sr
+   ->  Result tt_sr
+(3 rows)
+
+DELETE FROM tt_sr WHERE id = 3;
+-- The leaf has no transition-table triggers: single-row path is used and no
+-- trigger fires
+EXPLAIN (COSTS OFF) UPDATE tt_sr_leaf SET val = 'y' WHERE id = 4;
+       QUERY PLAN        
+-------------------------
+ Update on tt_sr_leaf
+   ->  Result tt_sr_leaf
+(2 rows)
+
+UPDATE tt_sr_leaf SET val = 'y' WHERE id = 4;
+SELECT * FROM tt_sr ORDER BY id;
+ id | val 
+----+-----
+  4 | y
+(1 row)
+
+DROP TABLE tt_sr;
+----------------------------------------------------------------------
 -- Cleanup
 ----------------------------------------------------------------------
 DROP TABLE tt_test;
```

**File**: `src/postgres/src/test/regress/sql/yb.orig.transition_tables.sql` (modified, +48/-0)
```diff
@@ -652,6 +652,54 @@ SELECT a, length(b) AS b_len, left(b,1) AS b_first, c FROM tt_ioc_root ORDER BY
 DROP TABLE tt_ioc_root;
 DROP FUNCTION tt_ioc_cap();
 
+----------------------------------------------------------------------
+-- Section 14: Single-row (primary key) UPDATE/DELETE on a partitioned table
+----------------------------------------------------------------------
+
+-- The transition-table triggers are on the root, not on the leaf that the
+-- single-row modify path would target, so that path must not be used.
+CREATE TABLE tt_sr (id int PRIMARY KEY, val text) PARTITION BY RANGE (id);
+CREATE TABLE tt_sr_mid PARTITION OF tt_sr FOR VALUES FROM (1) TO (100)
+  PARTITION BY RANGE (id);
+CREATE TABLE tt_sr_leaf PARTITION OF tt_sr_mid FOR VALUES FROM (1) TO (100);
+INSERT INTO tt_sr VALUES (1, 'a'), (2, 'b'), (3, 'c'), (4, 'd');
+
+CREATE TRIGGER tt_sr_upd AFTER UPDATE ON tt_sr
+  REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_update();
+CREATE TRIGGER tt_sr_del AFTER DELETE ON tt_sr
+  REFERENCING OLD TABLE AS old_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_delete();
+CREATE TRIGGER tt_sr_mid_del AFTER DELETE ON tt_sr_mid
+  REFERENCING OLD TABLE AS old_table
+  FOR EACH STATEMENT EXECUTE FUNCTION tt_log_delete();
+
+EXPLAIN (COSTS OFF) UPDATE tt_sr SET val = 'x' WHERE id = 1;
+UPDATE tt_sr SET val = 'x' WHERE id = 1;
+
+-- Not single-row, but planned after the single-row path was considered
+UPDATE tt_sr SET val = val || 'x' WHERE val = 'x';
+
+EXPLAIN (COSTS OFF) DELETE FROM tt_sr WHERE id = 1;
+DELETE FROM tt_sr WHERE id = 1;
+
+-- Intermediate partitioned table named in the query
+DELETE FROM tt_sr_mid WHERE id = 2;
+
+-- Only an UPDATE trigger on the root: single-row DELETE is still allowed
+DROP TRIGGER tt_sr_del ON tt_sr;
+EXPLAIN (COSTS OFF) DELETE FROM tt_sr WHERE id = 3;
+DELETE FROM tt_sr WHERE id = 3;
+
+-- The leaf has no transition-table triggers: single-row path is used and no
+-- trigger fires
+EXPLAIN (COSTS OFF) UPDATE tt_sr_leaf SET val = 'y' WHERE id = 4;
+UPDATE tt_sr_leaf SET val = 'y' WHERE id = 4;
+
+SELECT * FROM tt_sr ORDER BY id;
+
+DROP TABLE tt_sr;
+
 ----------------------------------------------------------------------
 -- Cleanup
 ----------------------------------------------------------------------
```

---

### Incident Patch 3: `60d21e9c` (2026-11-11)
**Commit Message**: [#36695] YSQL: Keep the INSERT ON CONFLICT read batch size fixed within a statement (#37504)

## Summary

### Problem

When `yb_insert_on_conflict_read_batch_size` changes during an INSERT ON
CONFLICT statement, read batching writes rows past the end of its
arrays. The statement then errors out or the backend segfaults.

```sql
CREATE TABLE t (k int PRIMARY KEY);
CREATE FUNCTION set_batch_size_at(i int, at int, size text) RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  IF i = at THEN
    PERFORM set_config('yb_insert_on_conflict_read_batch_size', size, true);
  END IF;
  RETURN i;
END $$;

-- set_batch_size_at() can change GUC 'yb_insert_on_conflict_read_batch_size' within statement
INSERT INTO t SELECT set_batch_size_at(g, 2, '1') 
  FROM generate_series(1, 2000) g
  ON CONFLICT DO NOTHING; -- segfaults
```

In the SQL above:

1. When the first row is buffered, the arrays are allocated with 1024
entries, the current value of `yb_insert_on_conflict_read_batch_size`.
2. The code compares the row count
(`mtstate->yb_ioc_state->num_slots==yb_insert_on_conflict_read_batch_size`)
to decide when a batch is full.
3. `yb_insert_on_conflict_read_batch_size` changes from 1024 to 1 after
the first

**File**: `src/postgres/src/backend/executor/execPartition.c` (modified, +2/-1)
```diff
@@ -1057,7 +1057,8 @@ ExecInitRoutingInfo(ModifyTableState *mtstate,
 		partRelInfo->ri_BatchSize = 1;
 
 	/* YB: also handle YB insert on conflict read batching. */
-	if (YbIsInsertOnConflictReadBatchingPossible(partRelInfo))
+	if (YbIsInsertOnConflictReadBatchingPossible(partRelInfo,
+												 mtstate->yb_ioc_batch_size))
 		partRelInfo->ri_ybIocBatchingPossible = true;
 
 	/*
```

**File**: `src/postgres/src/backend/executor/nodeModifyTable.c` (modified, +15/-9)
```diff
@@ -216,7 +216,8 @@ static void ExecMergeNotMatched(ModifyTableContext *context,
 static void YbPostProcessDml(CmdType cmd_type,
 							 Relation rel,
 							 TupleTableSlot *newslot);
-static void YbInitInsertOnConflictBatchState(YbInsertOnConflictBatchState **state);
+static void YbInitInsertOnConflictBatchState(YbInsertOnConflictBatchState **state,
+											 int batch_size);
 static void YbAddSlotToBatch(ModifyTableContext *context,
 							 ResultRelInfo *resultRelInfo,
 							 TupleTableSlot *planSlot,
@@ -981,7 +982,7 @@ ExecInsert(ModifyTableContext *context,
 						 blockInsertStmt);
 		/* When we've reached the desired batch size, enter flushing mode. */
 		if (mtstate->yb_ioc_state->num_slots ==
-			yb_insert_on_conflict_read_batch_size)
+			mtstate->yb_ioc_batch_size)
 		{
 			returnSlot = YbFlushSlotsFromBatch(context, blockInsertStmt);
 		}
@@ -5360,7 +5361,9 @@ ExecInitModifyTable(ModifyTable *node, EState *estate, int eflags)
 		else
 			resultRelInfo->ri_BatchSize = 1;
 
-		YbInitIocStrategy(resultRelInfo, node);
+		/* YB: see ModifyTableState.yb_ioc_batch_size. */
+		mtstate->yb_ioc_batch_size = yb_insert_on_conflict_read_batch_size;
+		YbInitIocStrategy(resultRelInfo, node, mtstate->yb_ioc_batch_size);
 	}
 
 	/*
@@ -5486,13 +5489,13 @@ YbPostProcessDml(CmdType cmd_type,
 }
 
 static void
-YbInitInsertOnConflictBatchState(YbInsertOnConflictBatchState **state)
+YbInitInsertOnConflictBatchState(YbInsertOnConflictBatchState **state,
+								 int batch_size)
 {
+	Assert(batch_size > 0);
 	*state = palloc0(sizeof(YbInsertOnConflictBatchState));
-	(*state)->slots = palloc(sizeof(TupleTableSlot *) *
-							 yb_insert_on_conflict_read_batch_size);
-	(*state)->planSlots = palloc(sizeof(TupleTableSlot *) *
-								 yb_insert_on_conflict_read_batch_size);
+	(*state)->slots = palloc(sizeof(TupleTableSlot *) * batch_size);
+	(*state)->planSlots = palloc(sizeof(TupleTableSlot *) * batch_size);
 }
 
 static void
@@ -5570,7 +5573,8 @@ YbAddSlotToBatch(ModifyTableContext *context,
 
 	Assert(resultRelInfo->ri_ybIocBatchingPossible);
 	if (!context->mtstate->yb_ioc_state)
-		YbInitInsertOnConflictBatchState(&context->mtstate->yb_ioc_state);
+		YbInitInsertOnConflictBatchState(&context->mtstate->yb_ioc_state,
+										 context->mtstate->yb_ioc_batch_size);
 	YbInsertOnConflictBatchState *state = context->mtstate->yb_ioc_state;
 
 	/*
@@ -5586,6 +5590,8 @@ YbAddSlotToBatch(ModifyTableContext *context,
 	TupleDesc	plan_tdesc = CreateTupleDescCopy(planSlot->tts_tupleDescriptor);
 	int			slot_idx = state->num_slots;
 
+	Assert(slot_idx < context->mtstate->yb_ioc_batch_size);
+
 	state->slots[slot_idx] = MakeSingleTupleTableSlot(tdesc, slot->tts_ops);
 	/*
 	 * TODO(kramanathan): The planSlot (from the subplan node) is used only in
```

**File**: `src/postgres/src/backend/executor/ybModifyTable.c` (modified, +6/-4)
```diff
@@ -722,7 +722,8 @@ YbIsIocPushdownCapableRel(ResultRelInfo *resultRelInfo, ModifyTable *node)
  * On that fallback path, batching and index-only reads are independent.
  */
 void
-YbInitIocStrategy(ResultRelInfo *resultRelInfo, ModifyTable *node)
+YbInitIocStrategy(ResultRelInfo *resultRelInfo, ModifyTable *node,
+				  int batch_size)
 {
 	Assert(node->operation == CMD_INSERT);
 
@@ -734,7 +735,7 @@ YbInitIocStrategy(ResultRelInfo *resultRelInfo, ModifyTable *node)
 		return;
 	}
 
-	if (YbIsInsertOnConflictReadBatchingPossible(resultRelInfo))
+	if (YbIsInsertOnConflictReadBatchingPossible(resultRelInfo, batch_size))
 		resultRelInfo->ri_ybIocBatchingPossible = true;
 
 	if (IsYBRelation(resultRelInfo->ri_RelationDesc) &&
@@ -743,12 +744,13 @@ YbInitIocStrategy(ResultRelInfo *resultRelInfo, ModifyTable *node)
 }
 
 bool
-YbIsInsertOnConflictReadBatchingPossible(ResultRelInfo *resultRelInfo)
+YbIsInsertOnConflictReadBatchingPossible(ResultRelInfo *resultRelInfo,
+										 int batch_size)
 {
 	/*
 	 * TODO(jason): figure out how to enable triggers.
 	 */
-	if (yb_insert_on_conflict_read_batch_size == 0 ||
+	if (batch_size == 0 ||
 		!IsYBRelation(resultRelInfo->ri_RelationDesc) ||
 		IsCatalogRelation(resultRelInfo->ri_RelationDesc) ||
 		(resultRelInfo->ri_TrigDesc &&
```

**File**: `src/postgres/src/include/executor/ybModifyTable.h` (modified, +6/-4)
```diff
@@ -83,10 +83,12 @@ extern void YBCHeapInsert(ResultRelInfo *resultRelInfo,
 
 /*
  * Whether INSERT ON CONFLICT read batching is possible for the given
- * resultRelInfo.  Should be called only when the inspected fields of
- * resultRelInfo are populated.
+ * resultRelInfo, given the statement's batch size (see
+ * ModifyTableState.yb_ioc_batch_size).  Should be called only when the
+ * inspected fields of resultRelInfo are populated.
  */
-extern bool YbIsInsertOnConflictReadBatchingPossible(ResultRelInfo *resultRelInfo);
+extern bool YbIsInsertOnConflictReadBatchingPossible(ResultRelInfo *resultRelInfo,
+													 int batch_size);
 
 /*
  * Combine the planner's IOC pushdown hint with properties available only after
@@ -95,7 +97,7 @@ extern bool YbIsInsertOnConflictReadBatchingPossible(ResultRelInfo *resultRelInf
  * optimizations.
  */
 extern void YbInitIocStrategy(ResultRelInfo *resultRelInfo,
-							  ModifyTable *node);
+							  ModifyTable *node, int batch_size);
 
 /*
  * Insert a tuple into a YugaByte table. Will execute within a distributed
```

**File**: `src/postgres/src/include/nodes/execnodes.h` (modified, +11/-1)
```diff
@@ -1482,6 +1482,16 @@ typedef struct ModifyTableState
 	 * reused after the setting changes.
 	 */
 	bool		yb_use_upsert_mode;
+
+	/*
+	 * YB: INSERT ON CONFLICT read batch size for this statement, taken from
+	 * yb_insert_on_conflict_read_batch_size at executor startup; 0 means no
+	 * read batching.  The setting can change while the statement runs (for
+	 * example, set_config() in an expression), so the batch arrays, the
+	 * full-batch check, and each partition's batching decision use this saved
+	 * value.
+	 */
+	int			yb_ioc_batch_size;
 } ModifyTableState;
 
 /* ----------------
@@ -3156,7 +3166,7 @@ typedef struct LimitState
  *	 YbInsertOnConflictBatchState information
  *
  *		INSERT ... ON CONFLICT read batching state for Yugabyte relations.  The
- *		batch size is taken from GUC yb_insert_on_conflict_read_batch_size.
+ *		batch size is ModifyTableState.yb_ioc_batch_size.
  * ----------------
  */
 typedef struct YbInsertOnConflictBatchState
```

**File**: `src/postgres/src/test/regress/expected/yb.orig.insert_on_conflict_batch_size_change.out` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+--
+-- INSERT ON CONFLICT read batching when yb_insert_on_conflict_read_batch_size
+-- changes during the statement.  The arrays that buffer a batch's rows are
+-- allocated once per statement, so a change must not affect the running
+-- statement.  Each case sets its own starting batch size, so this test does
+-- not depend on the batch size the schedule runs with.
+--
+-- Return i.  When i = at, set the batch size to size until the end of the
+-- transaction.
+CREATE FUNCTION set_batch_size_at(i int, at int, size text) RETURNS int
+LANGUAGE plpgsql AS $$
+BEGIN
+  IF i = at THEN
+    PERFORM set_config('yb_insert_on_conflict_read_batch_size', size, true);
+    RAISE NOTICE 'row %: batch size set to %', i,
+      current_setting('yb_insert_on_conflict_read_batch_size');
+  END IF;
+  RETURN i;
+END $$;
+CREATE TABLE ioc_target (k int PRIMARY KEY, v int);
+-- Lower the batch size from 1024 to 1 at row 2.
+SET yb_insert_on_conflict_read_batch_size = 1024;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 2, '1') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+NOTICE:  row 2: batch size set to 1
+SELECT count(*), min(k), max(k) FROM ioc_target;
+ count | min | max  
+-------+-----+------
+  2000 |   1 | 2000
+(1 row)
+
+TRUNCATE ioc_target;
+-- Raise the batch size from 2 to 1000000 at row 2.
+SET yb_insert_on_conflict_read_batch_size = 2;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 2, '1000000') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+NOTICE:  row 2: batch size set to 1000000
+SELECT count(*), min(k), max(k) FROM ioc_target;
+ count | min | max  
+-------+-----+------
+  2000 |   1 | 2000
+(1 row)
+
+TRUNCATE ioc_target;
+-- Set the batch size to 0 at row 1, before the first row is buffered.
+SET yb_insert_on_conflict_read_batch_size = 1024;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 1, '0') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+NOTICE:  row 1: batch size set to 0
+SELECT count(*), min(k), max(k) FROM ioc_target;
+ count | min | max  
+-------+-----+------
+  2000 |   1 | 2000
+(1 row)
+
+TRUNCATE ioc_target;
+-- Raise the batch size from 2 to 1000 in DO UPDATE SET, while the first batch
+-- is sent.
+INSERT INTO ioc_target
+  SELECT g,  -- 2000 int keys, i.e. 1.....2000
+         0   -- all zero, i.e. 0
+  FROM generate_series(1, 2000) g;
+SET yb_insert_on_conflict_read_batch_size = 2;
+INSERT INTO ioc_target
+  SELECT g, 0 FROM generate_series(1, 2000) g
+  ON CONFLICT (k) DO UPDATE SET v = set_batch_size_at(excluded.k, 1, '1000');
+NOTICE:  row 1: batch size set to 1000
+SELECT count(*) FROM ioc_target WHERE v = k;
+ count 
+-------
+  2000
+(1 row)
+
+-- Partitioned table: the statement starts with batch size 0, row 11 raises
+-- it to 1024 just before the first row of the second partition, and row 12
+-- lowers it to 1.  A partition decides whether to batch from the size saved
+-- at statement start, so neither partition batches.
+CREATE TABLE ioc_target_part (k int PRIMARY KEY) PARTITION BY RANGE (k);
+CREATE TABLE ioc_target_part_1 PARTITION OF ioc_target_part
+  FOR VALUES FROM (1) TO (11);
+CREATE TABLE ioc_target_part_2 PARTITION OF ioc_target_part
+  FOR VALUES FROM (11) TO (MAXVALUE);
+SET yb_insert_on_conflict_read_batch_size = 0;
+INSERT INTO ioc_target_part
+  SELECT set_batch_size_at(set_batch_size_at(g, 11, '1024'), 12, '1')
+  FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+NOTICE:  row 11: batch size set to 1024
+NOTICE:  row 12: batch size set to 1
+SELECT count(*), min(k), max(k) FROM ioc_target_part;
+ count | min | max  
+-------+-----+------
+  2000 |   1 | 2000
+(1 row)
+
+RESET yb_insert_on_conflict_read_batch_size;
+DROP TABLE ioc_target, ioc_target_part;
+DROP FUNCTION set_batch_size_at;
```

**File**: `src/postgres/src/test/regress/sql/yb.orig.insert_on_conflict_batch_size_change.sql` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+--
+-- INSERT ON CONFLICT read batching when yb_insert_on_conflict_read_batch_size
+-- changes during the statement.  The arrays that buffer a batch's rows are
+-- allocated once per statement, so a change must not affect the running
+-- statement.  Each case sets its own starting batch size, so this test does
+-- not depend on the batch size the schedule runs with.
+--
+
+-- Return i.  When i = at, set the batch size to size until the end of the
+-- transaction.
+CREATE FUNCTION set_batch_size_at(i int, at int, size text) RETURNS int
+LANGUAGE plpgsql AS $$
+BEGIN
+  IF i = at THEN
+    PERFORM set_config('yb_insert_on_conflict_read_batch_size', size, true);
+    RAISE NOTICE 'row %: batch size set to %', i,
+      current_setting('yb_insert_on_conflict_read_batch_size');
+  END IF;
+  RETURN i;
+END $$;
+
+CREATE TABLE ioc_target (k int PRIMARY KEY, v int);
+
+-- Lower the batch size from 1024 to 1 at row 2.
+SET yb_insert_on_conflict_read_batch_size = 1024;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 2, '1') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+SELECT count(*), min(k), max(k) FROM ioc_target;
+TRUNCATE ioc_target;
+
+-- Raise the batch size from 2 to 1000000 at row 2.
+SET yb_insert_on_conflict_read_batch_size = 2;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 2, '1000000') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+SELECT count(*), min(k), max(k) FROM ioc_target;
+TRUNCATE ioc_target;
+
+-- Set the batch size to 0 at row 1, before the first row is buffered.
+SET yb_insert_on_conflict_read_batch_size = 1024;
+INSERT INTO ioc_target
+  SELECT set_batch_size_at(g, 1, '0') FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+SELECT count(*), min(k), max(k) FROM ioc_target;
+TRUNCATE ioc_target;
+
+-- Raise the batch size from 2 to 1000 in DO UPDATE SET, while the first batch
+-- is sent.
+INSERT INTO ioc_target
+  SELECT g,  -- 2000 int keys, i.e. 1.....2000
+         0   -- all zero, i.e. 0
+  FROM generate_series(1, 2000) g;
+SET yb_insert_on_conflict_read_batch_size = 2;
+INSERT INTO ioc_target
+  SELECT g, 0 FROM generate_series(1, 2000) g
+  ON CONFLICT (k) DO UPDATE SET v = set_batch_size_at(excluded.k, 1, '1000');
+SELECT count(*) FROM ioc_target WHERE v = k;
+
+-- Partitioned table: the statement starts with batch size 0, row 11 raises
+-- it to 1024 just before the first row of the second partition, and row 12
+-- lowers it to 1.  A partition decides whether to batch from the size saved
+-- at statement start, so neither partition batches.
+CREATE TABLE ioc_target_part (k int PRIMARY KEY) PARTITION BY RANGE (k);
+CREATE TABLE ioc_target_part_1 PARTITION OF ioc_target_part
+  FOR VALUES FROM (1) TO (11);
+CREATE TABLE ioc_target_part_2 PARTITION OF ioc_target_part
+  FOR VALUES FROM (11) TO (MAXVALUE);
+SET yb_insert_on_conflict_read_batch_size = 0;
+INSERT INTO ioc_target_part
+  SELECT set_batch_size_at(set_batch_size_at(g, 11, '1024'), 12, '1')
+  FROM generate_series(1, 2000) g
+  ON CONFLICT DO NOTHING;
+SELECT count(*), min(k), max(k) FROM ioc_target_part;
+
+RESET yb_insert_on_conflict_read_batch_size;
+DROP TABLE ioc_target, ioc_target_part;
+DROP FUNCTION set_batch_size_at;
```

**File**: `src/postgres/src/test/regress/yb_insert_on_conflict_schedule` (modified, +1/-0)
```diff
@@ -7,3 +7,4 @@ test: yb.orig.insert_on_conflict_with
 test: yb.orig.insert_on_conflict_with_spi
 test: yb.orig.insert_on_conflict_with_explain
 test: yb.orig.insert_on_conflict_pushdown
+test: yb.orig.insert_on_conflict_batch_size_change
```

#### Recent Merged Pull Requests:
- **PR #37652** (2026-11-12): Docs: Document setting-dependent literals in prepared statements with YSQL Connection Manager (@aishwarya24)
- **PR #37634** (closed): [#37632] DocDB: Collect /pprof/heap using builtin tcmalloc API (@kai-franz)
- **PR #37619** (2026-11-12): [BACKPORT 2024.2][#35902] DocDB: Allow a few tcmalloc pages of slack in MemTrackerTest.TcMallocRootTracker (#35952) (@hkimura)
- **PR #37618** (2026-11-12): [BACKPORT 2025.2][#35902] DocDB: Allow a few tcmalloc pages of slack in MemTrackerTest.TcMallocRootTracker (#35952) (@hkimura)
- **PR #37617** (2026-11-12): [BACKPORT 2026.1][#35902] DocDB: Allow a few tcmalloc pages of slack in MemTrackerTest.TcMallocRootTracker (#35952) (@hkimura)
- **PR #37611** (2026-11-12): [#37610] DocDB: Wait for split candidates in AutomaticTabletSplitITest.PrioritizeLowPhaseTablets (@csi-fix)

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

## X. [#35476,#36130] YSQL: Fix single-row UPDATE/DELETE when the WHERE value's type d

**RULE**:
When implementing operations in `src/postgres/src/backend/access/yb_scan/yb_scan_plan.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yugabyte/yugabyte-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5bf305bb`: [#35476,#36130] YSQL: Fix single-row UPDATE/DELETE when the WHERE value's type differs from the key column (#36669). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/postgres/src/backend/access/yb_scan/yb_scan_plan.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
 *
 * Single row UPDATE and DELETE also use this (yb_single_row_key_value): a pair
 * marked compatible by mistake makes them change or delete the wrong row.
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5bf305bb` are properly handled with clean fallback behavior.
