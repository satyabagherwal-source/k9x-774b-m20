# Forensic Learning Record (Deep Inspection): yugabyte/yugabyte-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:21.680Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yugabyte/yugabyte-db`
- **Description**: YugabyteDB - the cloud native distributed SQL database for mission-critical applications.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10580 stars

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
    UpdateInstanceDetails,
    UpdateInstanceShapeConfigDetails
)
from oci.dns.models import RecordDetails, UpdateDomainRecordsDetails

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
    def identity_client(self):
        if self._identity_client is None:
            self._identity_client = self._build_client(IdentityClient)
        return self._identity_client

    def set_region(self, region):
        self.config["region"] = region
        self._compute_client = None
        self._compute_management_client = None
        sel
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

### Core Architecture Module: `managed/devops/opscli/ybops/utils/replicated.py`
```
# Copyright 2019 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import os
import requests
import json

from ybops.common.exceptions import YBOpsRuntimeError


class Replicated(object):
    REPLICATED_VENDOR_API = 'https://api.replicated.com/vendor/v1/app/'

    """Replicated class is used to fetch existing release information in replicated and to promote
    new release."""

    def __init__(self):
        api_token = os.environ.get('REPLICATED_API_TOKEN')
        self.app_id = os.environ.get('REPLICATED_APP_ID')
        assert api_token is not None, 'Environment Variable REPLICATED_API_TOKEN not set.'
        assert self.app_id is not None, 'Environment Variable REPLICATED_APP_ID not set.'
        self.auth_header = {'authorization': api_token, 'content-type': 'application/json'}
        self.releases = self._get_releases()
        self.current_release_sequence = None

    def _get_request_endpoint(self, request_type):
        base_url = os.path.join(self.REPLICATED_VENDOR_API, self.app_id)
        if request_type == 'LIST':
            return os.path.join(base_url, 'releases', 'paged')
        elif request_type == 'CREATE':
            return os.path.join(base_url, 'release')
        elif request_type == 'UPDATE':
            return os.path.join(base_url, str(self.current_release_sequence), 'raw')
        elif request_type == 'PROMOTE':
            return os.path.join(base_url, str(self.current_release_sequence), 'promote')
        else:
            raise TypeError('Invalid request type')

    def _get_releases(self):
        params = {'start': 0, 'count': 1}
        # Fetch the current releases and channel information
        response = requests.get(self._get_request_endpoint('LIST'),
                                headers=self.auth_header, json=params)
        response.raise_for_status()
        return json.loads(response.text)['releases']

    def _get_active_channel(self, channel_name='Alpha'):
        active_channel = None
        for release in self.releases:
            active_channel = next(iter([channel for channel in release['ActiveChannels']
                                        if channel['Name'] == channel_name]), None)
            if active_channel:
                break
        return active_channel

    def _get_tagged_channels(self, tag):
        tagged_channels = []
        for release in self.releases:
            tagged_channels = [channel for channel in release['ActiveChannels']
                               if channel['ReleaseLabel'] == tag]
            if tagged_channels:
                break
        return tagged_channels

    def _get_or_create_release(self, tag):
        draft_release = self._get_editable_release()
        # If we already have a release version created and in Editable state, just use that.
        if draft_release:
            return draft_release

        # Create a new release in replicated
        params = {'name': tag, 'source': 'latest', 'sourcedata': 0}
        response = requests.post(self._get_request_endpoint('CREATE'),
                                 headers=self.auth_header, json=params)
        response.raise_for_status()
        return json.loads(response.text)

    def _get_editable_release(self):
        return next(iter([release for release in self.releases
                          if release['Editable']]), None)

    def publish_release(self, tag, raw_data):
        release = self._get_or_create_release(tag)
        self.current_release_sequence = release['Sequence']
        # In case of update release we publish the yaml in the body so we need to make the put
        # request with content-type text/plain
        auth_header = self.auth_header.copy()
        auth_header['content-type'] = 'text/plain'
        response = requests.put(self._get_request_endpoint('UPDATE'),
                                headers=auth_header, data=raw_data)
        response.raise_for_status()

    def promote_release(self, tag, channel_name='Alpha', release_notes=[]):
        tagged_channels = self._get_tagged_channels(tag)
        active_channel = self._get_active_channel(channel_name)
        if any(tagged_channels):
            is_promoted = any([channel for channel in tagged_channels
                               if channel['Name'] == channel_name])
            self.current_release_sequence = tagged_channels[0]['ReleaseSequence']
            if is_promoted:
                raise YBOpsRuntimeError(
                    'Release {} already promoted for channel {}'.format(tag, channel_name))
        elif self.current_release_sequence is None:
            current_release = self._get_editable_release()
            self.current_release_sequence = current_release['Sequence']

        active_channel_id = active_channel['Id']
        params = {'channels': [active_channel_id], 'label': tag,
                  'release_notes': '\n'.join(release_notes), 'required': False}
        # Promote the release for the provided channel
        response = requests.post(self._get_request_endpoint('PROMOTE'),
                                 headers=self.auth_header, json=params)
        response.raise_for_status()

```

### Core Architecture Module: `managed/devops/opscli/ybops/utils/ssh.py`
```
#!/usr/bin/env python
#
# Copyright 2022 YugabyteDB, Inc. and Contributors
#
# Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
# may not use this file except in compliance with the License. You
# may obtain a copy of the License at
#
# https://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt

import datetime
import functools
import logging
import os
import paramiko
import shlex
import shutil
import socket
import stat
import subprocess
import time
import tempfile

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from scp import SCPClient
from ybops.common.exceptions import YBOpsRuntimeError, YBOpsRecoverableError

SSH2 = 'ssh2'
SSH = 'ssh'
SSHPUB = 'sshpub'
SSH_RETRY_LIMIT = 60
SSH_RETRY_LIMIT_PRECHECK = 4
DEFAULT_SSH_PORT = 22
DEFAULT_SSH_USER = 'centos'
# Timeout in seconds.
SSH_TIMEOUT = 45
# Retry in seconds
SSH_RETRY_DELAY = 10
RSA_KEY_LENGTH = 3072
CONNECTION_RETRY_DELAY_SEC = 15
# Let's set some timeout to our commands.
# If 10 minutes will not be enough for something - will have to pass command timeout as an argument.
# Just having timeout in shell script, which we're running on the node,
# does not seem to always help - as ssh client connection itself or command results read can hang.
COMMAND_TIMEOUT_SEC = 600


def ssh_retry_decorator(fn_to_call, exc_handler=None, retry_delay=None):
    if fn_to_call is None:
        return functools.partial(
            ssh_retry_decorator, exc_handler=exc_handler, retry_delay=retry_delay)

    @functools.wraps(fn_to_call)
    def wrapper(*args, **kwargs):
        max_attempts = 3

        for i in range(1, max_attempts + 1):
            try:
                return fn_to_call(*args, **kwargs)
            except Exception as e:
                if i < max_attempts and exc_handler(e):
                    time.sleep(retry_delay)
                    continue
                raise YBOpsRecoverableError(str(e))

    return wrapper


def ssh_exception_handler(e):
    if isinstance(e, (paramiko.SSHException, socket.error)):
        logging.warning('Caught SSH error %s, retrying: %s', type(e).__name__, e)
        return True
    return False


def retry_ssh_errors(fn=None, retry_delay=SSH_RETRY_DELAY):
    return ssh_retry_decorator(fn, exc_handler=ssh_exception_handler, retry_delay=retry_delay)


def parse_private_key(key):
    """Parses the private key file, & returns
    the key format and key data.
    :param key: private key file.
    :return: Private key type(One of SSH2/SSH).
    """
    if key is None:
        raise YBOpsRuntimeError("Private key file not specified. Returning.")

    with open(key) as f:
        key_data = f.read()
        # key maybe SSH encoded public key
        try:
            key = serialization.load_ssh_public_key(data=key_data.encode())
            return SSHPUB, key
        except Exception:
            pass
        try:
            key = serialization.load_ssh_private_key(data=key_data.encode(), password=None)
            return SSH, key
        except Exception:
            pass
        try:
            key = serialization.load_pem_private_key(data=key_data.encode(), password=None)
            return SSH, key
        except ValueError:
            '''
            SSH2 encrypted keys contains Subject & comment in the generated body.
            '---- BEGIN SSH2 ENCRYPTED PRIVATE KEY ----'
            'Subject: user'
            'Comment: "2048-bit rsa'
            '''
            key_val = key_data.split('\n')
            if 'Subject' in key_val[1] and 'Comment' in key_val[2]:
                return SSH2, None

    logging.info("[app], specified key format is not supported.")
    raise YBOpsRuntimeError("Specified key format is not supported.")


def check_ssh2_bin_present():
    """Checks if the ssh2 is installed on the node
    :return: True/False
    """
    try:
        output = run_command(['command', '-v', '/usr/bin/sshg3', '/dev/null'])
        return True if output is not None else False
    except YBOpsRuntimeError:
        return False


def run_command(args, num_retry=1, timeout=1, **kwargs):
    cmd_as_str = quote_cmd_line_for_bash(args)
    logging.info("[app] Executing command \"{}\"".format(cmd_as_str))
    while num_retry > 0:
        num_retry = num_retry - 1
        try:
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            output, err = process.communicate()
            if process.returncode != 0:
                logging.error("Failed to run command [[ {} ]]: code={} output={}".format(
                  cmd_as_str, process.returncode, err))
                raise YBOpsRuntimeError(err.decode('utf-8'))
            return output.decode('utf-8')

        except Exception as ex:
            logging.error("Failed to run command [[ {} ]]: {}".format(cmd_as_str, ex))
            sleep_or_raise(num_retry, timeout, ex)


def quote_cmd_line_for_bash(cmd_line):
    if not isinstance(cmd_line, list) and not isinstance(cmd_line, tuple):
        raise Exception("Expected a list/tuple, got: [[ {} ]]".format(cmd_line))
    return ' '.join([shlex.quote(str(arg)) for arg in cmd_line])


def sleep_or_raise(num_retry, timeout, ex):
    if num_retry > 0:
        logging.info("Sleep {}... ({} retries left)".format(timeout, num_retry))
        time.sleep(timeout)
    else:
        raise ex


def can_ssh(host_name, port, username, ssh_key_file, **kwargs):
    """This method tries to ssh to the host with the username provided on the port.
    and returns if ssh was successful or not.
    Args:
        host_name (str): SSH host IP address
        port (int): SSH port
        username (str): SSH username
        ssh_key_file (str): SSH key file
    Returns:
        (boolean): If SSH was successful or not.
    """
    try:
        ssh2_enabled = kwargs.get('ssh2_enabled', False)
        ssh_client = SSHClient(ssh2_enabled=ssh2_enabled)
        ssh_client.connect(host_name, username, ssh_key_file, port)
        rc, stdout, stderr = ssh_client.exec_command("echo 'test'", **kwargs)
        if rc != 0:
            logging.error("Error checking the instance, {}".format(stderr))
            return False
        stdout = stdout.splitlines()
        if len(stdout) == 1 and (stdout[0] == "test"):
            return True
        return False
    except Exception as e:
        logging.error("Error checking the instance, {}".format(e))
        return False


def wait_for_ssh(host_ip, ssh_port, ssh_user, ssh_key, num_retries=SSH_RETRY_LIMIT, **kwargs):
    """This method would basically wait for the given host's ssh to come up, by looping
    and checking if the ssh is active. And timesout if retries reaches num_retries.
    Args:
        host_ip (str): IP Address for which we want to ssh
        ssh_port (str): ssh port
        ssh_user (str): ssh user name
        ssh_key (str): ssh key filename
    Returns:
        (boolean): Returns true if the ssh was successful.
    """
    retry_count = 0
    while retry_count < num_retries:
        if can_ssh(host_ip, ssh_port, ssh_user, ssh_key, **kwargs):
            return True

        time.sleep(1)
        retry_count += 1

    return False


def format_rsa_key(key, public_key=False):
    """This method would take the rsa key and format it based on whether it is
    public key or private key.
    Args:
        key (RSA Key): Key data
        public_key (bool): Denotes if we need public key or not.
    Returns:
        key (str): Encoded key in OpenSSH or PEM format based on the flag (public key or not).
    """
    if isinstance(key, rsa.RSAPrivateKey):
        if public_key:
            return key.public_key() \
                      .public_bytes(encoding=serialization.Encoding.OpenSSH,
                                    format=serialization.PublicFormat.OpenSSH).decode('utf-8')
        return key.private_bytes(encoding=serialization.Encoding.PEM,
                                 format=serialization.PrivateFormat.TraditionalOpenSSL,
                                 encryption_algorithm=serialization.NoEncryption()).decode('utf-8')
    elif isinstance(key, rsa.RSAPublicKey):
        return key.public_bytes(encoding=serialization.Encoding.OpenSSH,
                                format=serialization.PublicFormat.OpenSSH).decode('utf-8')
    else:
        if public_key:
            run_command(['ssh-keygen-g3', '-D', key])
            file = key + '.pub'
            p_key = None
            with open(file) as f:
                p_key = f.read()
            logging.info("generating public key, {}".format(p_key))

            return p_key
        else:
            with open(key) as f:
                return f.read()


def validated_key_file(key_file):
    """This method would validate a given key file and raise a exception if the file format
    is incorrect or not found.
    Args:
        key_file (str): Key file name
    Returns:
        key (RSA Key): RSA key data
    """

    if not os.path.exists(key_file):
        raise YBOpsRuntimeError("Key file {} not found.".format(key_file))

    # Check based on key_type not on SSH2 installed or not.
    ssh_type, key = parse_private_key(key_file)
    if ssh_type == SSH or ssh_type == SSHPUB:
        return key
    else:
        return key_file


def generate_rsa_keypair(key_name, destination='/tmp'):
    """This method would generate a RSA Keypair with an exponent of 65537 in PEM format,
    We will also make the files once generated READONLY by owner, this is need for SSH
    to work.
    Args:
        key_name(str): Keypair name
        destination (str): Destination folder
    Returns:
        keys (tuple): Private and Public key files.
    """
    new_key = rsa.generate_private_key(public_exponent=65537, key_size=RSA_KEY_LENGTH)
    if not os.path.exists(destination):
        raise YBOpsRuntimeError("Destination folder {} not accessible".format(destination))

    public_key_filename = 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34654** (2026-10-05): **[YSQL] Build af37eb4e on master: arm-alma8-clang21-release broken**
  *Symptoms*: Jira Link: [DB-24094](https://yugabyte.atlassian.net/browse/DB-24094) _Filed automatically by [Grissom](https://github.com/yugabyte/agent-k/blob/main/bots/grissom/README.md) (internal docs), which watches YugabyteDB's scheduled builds on `master` and the supported release branches for builds where a lane breaks or many tests fail the same way. Everything below is measured from those builds; how it decides, and how to stop it, is at the end._  ## Summary  The scheduled build of `master` at af37eb4e has a lane-level failure; the affected lane(s) are not judged test by test.  - Failing lanes: `arm-alma8-clang21-release` - Failing build types: release  ## Urgency  S2 lane broken / cluster (`priority/high`).  ## What is being tested  Every lane of the scheduled build (build types release, tsan, fastdebug, asan, debug).  ## What is the failure  - `arm-alma8-clang21-release`: build step failed while compiling, with no error Grissom recognises in its log; no tests ran ([CSI launch 176249](https://csi.dev.yugabyte.com/ui/#dbft/launches/all/176249), [build log](https://csi.dev.yugabyte.com/ui/#dbft/launches/all/176249/820666030/820666032/log), [Jenkins console](https://jenkins.dev.yugabyte.com/job/github-yugabyte-db-alma8-master-clang21-release-aarch64/1428/console))    ```   /share/jenkins/workspace/github-yugabyte-db-alma8-master-clang21-release-aarch64/bin/yugabyte_jenkins_pgo.sh: line 114: 195183 Segmentation fault      (core dumped) sysbench oltp_read_write $sbopts --warmup-time=
  **Post-Mortem & Fix Analysis**:
  > Grissom: **where this build broke**. The commit range between the previous scheduled build and this one; no single commit is suspected.  Range [`(50445c03, af37eb4e]`](https://github.com/yugabyte/yugabyte-db/compare/50445c03...af37eb4e): 2 commits. A build-level break: 1 lane(s) broken in this build, so the onset is this build; the range starts at the previous scheduled build.  The ranker found no candidate that explains the failure: This wasn't a compile error. The 'sysbench oltp_read_write' client segfaulted during the PGO profile-training step in 'yugabyte_jenkins_pgo.sh', and only the arm-alma8-clang21-release lane, which runs that step, failed. The Flyway commit only changes YBA Java code under 'managed/', so it's effectively ruled out. The RocksDB commit is the only one affecting the database binaries: it stops writing the OPTIONS file by default. That changes I/O and timing but has no clear path to a crash in the sysbench client process. A segfault in the sysbench client looks m
  > Duplicate of #34633: the same PGO profiling-workload failure (a sysbench table, here `sbtest9`, lost during the data load, then the profiling run fails on `relation "sbtest9" does not exist` and sysbench segfaults), not the commits in this range.

- **Issue #34614** (2026-10-04): **[DO NOT MERGE] agent-k replay of #4624 (thread pool) to test review gotcha**
  *Symptoms*: **Do not merge. Test PR, will be closed.**  Replays #4624 (6b6e0ba54ea, already on master) on its original parent 2166ff8c061, so the diff shown here is exactly that change. Purpose: check whether an agent-k review now flags the thread-pool behavior change later tracked in #34364 (idle workers recreated under bursty load), using the newly added review gotcha.  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/yugabyte/yugabyte-db/34614) <!-- Reviewable:end --> 
  **Post-Mortem & Fix Analysis**:
  > /agentk review

- **Issue #34612** (2026-10-05): **[BACKPORT 2026.1][AMP-49] YBA: Create the yb_storage database on universe creation behind a global runtime flag**
  *Symptoms*: Summary: The amp controller keeps its state in a `yb_storage` YSQL database and opens it at startup, so the database must exist before the controller rolls out. Today the deploying tool creates it by running ysqlsh over `kubectl exec`. That is the only reason it needs `pods/exec`, and the step is skipped when a bring-up aborts after the universe is Ready.  Universe creation (CreateUniverse and CreateKubernetesUniverse, including operator-created universes) can now create the database itself. A new `CreateYbStorageDatabase` subtask runs in the ConfigureUniverse phase, after `UpdateConsistencyCheck`. It runs `CREATE DATABASE` and treats an "already exists" error as success, so a task retry is safe. It tries up to 5 times across tservers, then fails the universe create.  New runtime config key: `yb.universe.create_yb_storage_db` (GLOBAL, boolean, INTERNAL, default `false`). With the key off, the create task sequence is unchanged. The subtask runs only when YSQL is enabled.  Original commit: 539db6584a57d4921fa3720eba40af023dd21895 / D58761  Test Plan: ``` cd managed sbt "testOnly com.yugabyte.yw.commissioner.tasks.subtasks.CreateYbStorageDatabaseTest com.yugabyte.yw.models.helpers.TaskTypeTest com.yugabyte.yw.commissioner.tasks.CreateUniverseTest com.yugabyte.yw.commissioner.tasks.CreateKubernetesUniverseTest" sbt javafmtCheckAll ```  Reviewers: anijhawan, dshubin, #yba-api-review  Reviewed By: dshubin, #yba-api-review  Subscribers: yugaware  Differential Revision: https://phorg
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34612) <br/>All committers have signed the CLA.
  > Trigger Jenkins

- **Issue #34608** (2026-10-03): **[#34607] Build: Build only the bottom and top PRs of a stack**
  *Symptoms*: ## Summary  Under a native GitHub stack, CI runs for every PR in the stack, as if each one targeted `master`. One fix to a lower layer rebases every layer above it, so one push starts a full `bld-*` build for each of those layers.  This change follows GitHub's "Optimizing CI for stacked pull requests" guidance and reads `github.event.pull_request.stack`. In each `bld-*` workflow that starts a real build (`bld-db`, `bld-docs`, `bld-yba`, `bld-yba-ui`, `bld-yba-cli`, `bld-yba-install`), the build type is now:  - the full build for a PR that is not in a stack (no change), - the full build for the lowest unmerged PR of a stack, which targets `master` directly and lands next, - the full build for the top PR, whose tree holds every layer, - `NO-BLD` for the layers between them.  When the bottom PR merges, GitHub rebases the next one. That push builds it in full, because it is now the bottom.  **Open question for DevOps:** GitHub merges a group of stacked PRs only when every PR in the group passes its required checks. This change relies on `ybbld <pr> <sha> NO-BLD` posting a passing `yb-required` for the middle layers. Please confirm that, or say what a skipped layer should post instead.  **Trade-off:** if several layers merge in one operation, the intermediate commits on `master` were not built on their own. Only the combined result was. Merging one layer at a time avoids this.  ## Test plan  - [x] The six changed workflow files parse as YAML, and each `BLD_TYPE` expression reads a

- **Issue #34607** (2026-10-03): **[New Feature] Build only the bottom and top PRs of a stacked PR**
  *Symptoms*: ## Description  Under a native GitHub stack, CI runs for every PR in the stack, as if each one targeted `master`. One fix to a lower layer rebases every layer above it, so it starts a full `bld-*` build for each of those layers.  GitHub's "Optimizing CI for stacked pull requests" guidance is to run expensive jobs only where they are needed, using `github.event.pull_request.stack`. For our `bld-*` workflows, that means:  - Build the lowest unmerged PR of a stack. It targets `master` directly and lands next. - Build the top PR. Its tree holds every layer. - Run `NO-BLD` for the layers between them. When the bottom PR merges, GitHub rebases the next one, which then builds because it is now the bottom.  Open question for DevOps: GitHub merges a group of stacked PRs only when every PR in the group passes its required checks. So this relies on `ybbld <pr> <sha> NO-BLD` posting a passing `yb-required` for the middle layers. Please confirm that, or say what a skipped layer should post instead.  Trade-off: if several layers merge in one operation, the intermediate commits on `master` were not built on their own. Only the combined result was. Merging one layer at a time avoids this, because each layer becomes the bottom and builds first.  Related: #33614 (agent tooling for native stacked PRs).  - [x] I confirm this issue does not contain any sensitive information. 

- **Issue #34602** (2026-10-03): **[ClaudeCode] Stop auto-rebasing branches on push**
  *Symptoms*: ### Description  `.agents/scripts/git-push.sh` is the only push path Claude Code agents are allowed (raw `git push` is deny-listed), and `create-pr.sh` pushes through it. On every push it rebases the current branch onto the fork branch and then onto the latest upstream `master`, then force-pushes. The user is never asked. This:  * flattens merge commits, breaking merge-based workflows; * moves the branch's base to a `master` the user did not choose, forcing rebuilds and pulling in unrelated breakage; * marks reviewers' inline comments outdated on every push; * can bring back commits the user deliberately amended or squashed away (replaying them on top of the stale fork branch); * weakens `--force-with-lease`, since the fork branch is fetched right before the push.  The `create-pr` skill also has the agent resolve rebase conflicts on its own.  Updating the base (rebase, merge, or not at all) is the user's call, not a side effect of pushing. Proposed change: stop rebasing and stop fetching the fork branch before the push; diff the `.proto` upgrade-safety check from the merge-base (as lint already does); drop the skill's rebase and conflict-resolution instructions.  Possible follow-ups:  * Make force-push opt-in. Without the rebase, nearly every push is a fast-forward, so forcing by default only adds risk. * Stop hardcoding `master` as the base in the `create-pr` skill. `create-pr.sh -b` already supports other bases (stacked PRs, feature branches).  ### Issue Type  kind/enhancem

- **Issue #34570** (2026-10-02): **[BACKPORT 2025.2][#34361] docdb: Update cache statistics outside of mutex lock**
  *Symptoms*: Summary: We currently increment cache statistics and metrics under mutex lock. But there is no need to do this under lock, since they are atomics (or thread-local integers for the RPC aggregated case), and there are no expectations of the values being precisely synchronized with cache internals.  This revision moves statistics/metrics update outside of the mutex lock for LRUCache::Lookup and LRUCache::Insert.  Original commit: ab116034fd873192d3d53c1db4984f809a0470b3 / #34465  Test Plan: Jenkins  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/yugabyte/yugabyte-db/34570) <!-- Reviewable:end --> 
  **Post-Mortem & Fix Analysis**:
  > Tests already ran before merging first PR in stack, skipping.

- **Issue #34569** (2026-10-02): **[BACKPORT 2025.2][#34362] docdb: Simplify rocksdb cache metrics**
  *Symptoms*: Summary: We currently have variety of metrics/statistics for the rocksdb cache, including but not limited to: - per-rocksdb statistics (`AtomicGauge`, aggregated per RPC on some code paths)    - `BLOCK_CACHE_MISS`, `BLOCK_CACHE_HIT` on the lookup path - `BLOCK_CACHE_ADD`, `BLOCK_CACHE_ADD_FAILURES`, `BLOCK_CACHE_BYTES_WRITE` on the insert path - `SINGLE_TOUCH`/`MULTI_TOUCH` variants of the `HIT`/`ADD`/`BYTES_WRITE` statistics  - server-wide `CacheMetrics`    - `block_cache_lookups` - Typically equivalent to sum of `BLOCK_CACHE_MISS + BLOCK_CACHE_HIT` statistics, excepting deleted tablets - `block_cache_misses`, `block_cache_hits` - Typically equivalent to sum of `BLOCK_CACHE_MISS`/`BLOCK_CACHE_HIT` statistics respectively, excepting deleted tablets - `block_cache_inserts`, `block_cache_evictions`, `block_cache_hits_caching`, `block_cache_misses_caching`      - These are always 0; we never update them - `block_cache_usage`, `block_cache_single_touch_usage`, `block_cache_multi_touch_usage` - These do not have statistics analogue; closest statistics is `BLOCK_CACHE_BYTES_WRITE` which is a counter, while these are gauges that decrease in value when `LRUHandle`s are freed  This revision makes the following changes to these metrics/statistics: - The unused server-wide metrics (`block_cache_inserts`, `block_cache_evictions`, `block_cache_hits_caching`, `block_cache_misses_caching`) were deleted - `block_cache_lookups`, `block_cache_misses`, `block_cache_hits` were del

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

### Incident Patch 1: `11ace952` (2026-10-05)
**Commit Message**: [PLAT-22639] - fix :Keep the LDAP binding mechanism after save

Summary: Simple Bind was sent as the quoted string "false", and a config reload could put Search and Bind back on the form after a successful save. Send boolean LDAP settings unquoted, and ignore a runtime-config response that started before the save finished.

Test Plan: Tested manually

Reviewers: kkannan

Reviewed By: kkannan

Subscribers: ui, yugaware

Differential Revision: https://phorge.dev.yugabyte.com/D59000

**File**: `managed/ui/src/redesign/features/userAuth/ldap/LDAPAuthRedesigned.tsx` (modified, +77/-34)
```diff
@@ -7,7 +7,7 @@
  * http://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt
  */
 
-import { useEffect, useState } from 'react';
+import { useEffect, useRef, useState } from 'react';
 import { find, isString } from 'lodash';
 import { useForm } from 'react-hook-form';
 import { useMutation, useQuery, useQueryClient } from 'react-query';
@@ -59,6 +59,23 @@ import { getLDAPValidationSchema } from './LDAPValidationSchema';
 import User from '../../../../redesign/assets/user-outline.svg';
 import BulbIcon from '../../../../redesign/assets/bulb.svg';
 
+// Boolean runtime configs must be sent as unquoted true/false. Quoting them stores a string.
+const BOOLEAN_CONFIG_KEYS = new Set([
+  'use_ldap',
+  'use_search_and_bind',
+  'enable_ldaps',
+  'enable_ldap_start_tls',
+  'ldap_group_use_role_mapping',
+  'ldap_group_use_query'
+]);
+
+// Enum values are parsed with valueOf and are stored without surrounding quotes.
+const UNQUOTED_STRING_KEYS = new Set([
+  'ldap_default_role',
+  'ldap_group_search_scope',
+  'ldap_tls_protocol'
+]);
+
 const useStyles = makeStyles((theme) => ({
   root: {
     width: '680px',
@@ -196,7 +213,7 @@ const initializeFormValues = (configEntries: RunTimeConfigEntry[]) => {
 
   let finalFormData = {
     ...formData,
-    use_search_and_bind: formData.use_search_and_bind ?? false,
+    use_search_and_bind: String(formData.use_search_and_bind ?? false),
     ldap_url: formData.ldap_url ? [formData.ldap_url, formData.ldap_port].join(':') : '',
     ldap_group_use_role_mapping: formData.ldap_group_use_role_mapping === 'true',
     use_service_account: !!formData.ldap_service_account_distinguished_name,
@@ -209,8 +226,8 @@ const initializeFormValues = (configEntries: RunTimeConfigEntry[]) => {
     enable_ldaps === 'true'
       ? SecurityOption.ENABLE_LDAPS
       : enable_ldap_start_tls === 'true'
-      ? SecurityOption.ENABLE_LDAP_START_TLS
-      : SecurityOption.UNSECURE;
+        ? SecurityOption.ENABLE_LDAP_START_TLS
+        : SecurityOption.UNSECURE;
   finalFormData = { ...finalFormData, ldap_security };
 
   return finalFormData;
@@ -230,6 +247,7 @@ export const LDAPAuthNew = () => {
     getValues,
     handleSubmit,
     clearErrors,
+    reset,
     formState: { isDirty }
   } = useForm<LDAPFormProps>({
     resolver: yupResolver(getLDAPValidationSchema(t))
@@ -267,48 +285,65 @@ export const LDAPAuthNew = () => {
   const [initialData, setInitialData] = useState<LDAPFormProps>();
   const [groupSettingsExpanded, setGroupSettingsExpanded] = useToggle(true);
   const queryClient = useQueryClient();
+  // Latest fetch wins. An older runtime-config response must not overwrite a newer form.
+  const fetchSeq = useRef(0);
+  // True while the user has edits that a background refetch must not discard.
+  const isDirtyRef = useRef(false);
+
+  useEffect(() => {
+    isDirtyRef.current = isDirty;
+  }, [isDirty]);
+
+  const applyFetchedConfig = (configEntries: RunTimeConfigEntry[]) => {
+    const formData = initializeFormValues(configEntries);
+    setInitialData(formData);
+    reset(formData);
+  };
 
   const { isLoading } = useQuery(
     [LDAP_RUNTIME_CONFIGS_QUERY_KEY],
-    () => api.fetchRunTimeConfigs(true),
+    async () => {
+      const seq = ++fetchSeq.current;
+      const data = await api.fetchRunTimeConfigs(true);
+      return { data, seq };
+    },
     {
-      onSuccess(data) {
-        const formData = initializeFormValues(data.configEntries);
-        setInitialData(formData);
-        Object.entries(formData).forEach(([key, value]) => {
-          setValue((key as unknown) as keyof LDAPFormProps, value as any, {
-            shouldValidate: false
-          });
-        });
+      onSuccess({ data, seq }) {
+        if (seq !== fetchSeq.current || isDirtyRef.current) {
+          return;
+        }
+        applyFetchedConfig(data.configEntries);
       }
     }
   );
 
-  // It compares the initial data with the current data and saves the changes.
-  // If the value is empty, it deletes the config entry.
-  // The function returns an array of promises that are resolved when the configs are saved.
+  // Compare the payload shape on both sides, so display-only fields (URL with port,
+  // boolean group mapping) are not treated as changes. Empty values delete the key.
   const saveLDAPConfigs = () => {
     const values: Record<string, string | boolean> = transformData(getValues());
+    const initialValues = initialData ? transformData(initialData) : {};
     const promiseArray = Object.keys(values).reduce((promiseArr, key) => {
-      if (values[key] !== (initialData as any)[key]) {
-        const keyName = `${LDAPPath}.${key}`;
-        const value =
-          isString(values[key]) &&
-          !['ldap_default_role', 'ldap_group_search_scope', 'ldap_tls_protocol'].includes(key)
-            ? `"${values[key]}"`
-            : values[key];
-
-        promiseArr.push(
-          values[key] !== ''
-            ? 
```

---

### Incident Patch 2: `8417dc0e` (2026-10-05)
**Commit Message**: [PLAT-22735] YBA: Enable new Perf Advisor UI by default and add Advanced Observability license notice

Summary:
The new Perf Advisor UI (Performance tab, advanced observability mode) was hidden behind `yb.ui.feature_flags.enable_new_perf_advisor_ui`, default false. It now defaults to true.

Advanced Observability is a licensed feature, so users must be told before turning it on. The Enable Performance Monitoring modal (when the Advanced observability mode is selected) and the Enable Advanced Observability modal (basic -> advanced) now show a warning:

"Advanced Observability is a licensed feature. Enabling it adds the cluster load chart, Top SQL and SQL drilldown for this universe under a new Performance menu. Please confirm your organization has an Advanced Observability license. If not, contact your Yugabyte account team."

While the notice is shown, the modal body is capped at 600px so the text wraps and the notice spans the full width.

The universe action "Enable/Disable Perf Advisor Collector" is renamed to "Enable/Disable Performance Monitoring", matching the dialog it opens, and the dialog's collection modes now read "Basic - collects performance data and exports it with Su

**File**: `managed/src/main/resources/reference.conf` (modified, +1/-1)
```diff
@@ -283,7 +283,7 @@ yb {
       # Cross-cloud federated IAM is in preview; hide its fields until explicitly enabled.
       enable_cross_cloud_federated_iam=false
       enable_s3_backup_proxy=false
-      enable_new_perf_advisor_ui=false
+      enable_new_perf_advisor_ui=true
       enable_new_universe_experience=false
       enable_non_restart_gflag_upgrade_option=false
       enable_az_overrides_k8s=true
```

**File**: `managed/ui/src/components/universes/UniverseDetail/UniverseDetail.jsx` (modified, +2/-2)
```diff
@@ -1943,8 +1943,8 @@ class UniverseDetail extends Component {
                               }
                             >
                               {isUniverseRegisteredToPa
-                                ? 'Disable Perf Advisor Collector'
-                                : 'Enable Perf Advisor Collector'}
+                                ? 'Disable Performance Monitoring'
+                                : 'Enable Performance Monitoring'}
                             </YBLabelWithIcon>
                           </YBMenuItem>
                         </RbacValidator>
```

**File**: `managed/ui/src/redesign/features/universe/universe-actions/enable-perf-advisor/EnablePerfAdvisorModal.tsx` (modified, +34/-7)
```diff
@@ -4,7 +4,7 @@ import { useState } from 'react';
 import { useDispatch } from 'react-redux';
 import { Trans, useTranslation } from 'react-i18next';
 import { toast } from 'react-toastify';
-import { YBModal, YBRadioGroup, YBSelect } from '../../../../components';
+import { AlertVariant, YBAlert, YBModal, YBRadioGroup, YBSelect } from '../../../../components';
 import { PaRegistrationMode, PerfAdvisorAPI, QUERY_KEY } from '../../../PerfAdvisor/api';
 import { useListPerfAdvisorEndpoints } from '../../../../../v2/api/perf-advisor-endpoint/perf-advisor-endpoint';
 import { Universe } from '../../universe-form/utils/dto';
@@ -163,14 +163,37 @@ export const EnablePerfAdvisorModal = ({
       : [])
   ];
 
-  const bodyContent = enableAdvancedObservabilityOnly ? (
-    <Box component="span" display="block">
-      <Trans
-        i18nKey="universeActions.paUniverseStatus.enableAdvancedObservabilitySubText"
-        values={{ universeName: universeData.name }}
-        components={{ strong: <strong /> }}
+  const showLicenseNotice =
+    enableAdvancedObservabilityOnly ||
+    (!isUniverseRegisteredToPA && mode === PaRegistrationMode.ADVANCED);
+
+  const licenseNotice = (
+    <Box mt={2}>
+      <YBAlert
+        open
+        variant={AlertVariant.Warning}
+        dataTestId="EnablePerfAdvisorModal-LicenseNotice"
+        text={
+          <Trans
+            i18nKey="universeActions.paUniverseStatus.advancedObservabilityLicenseNotice"
+            components={{ strong: <strong /> }}
+          />
+        }
       />
     </Box>
+  );
+
+  const bodyContent = enableAdvancedObservabilityOnly ? (
+    <>
+      <Box component="span" display="block">
+        <Trans
+          i18nKey="universeActions.paUniverseStatus.enableAdvancedObservabilitySubText"
+          values={{ universeName: universeData.name }}
+          components={{ strong: <strong /> }}
+        />
+      </Box>
+      {licenseNotice}
+    </>
   ) : disableAdvancedObservabilityOnly ? (
     <Box component="span" display="block">
       <Trans
@@ -200,6 +223,7 @@ export const EnablePerfAdvisorModal = ({
           />
         </Box>
       )}
+      {showLicenseNotice && licenseNotice}
       {!isUniverseRegisteredToPA && mode === PaRegistrationMode.ONLINE && (
         <Box mt={2} display="flex" flexDirection="column" gridGap={8}>
           <Typography variant="body2">
@@ -247,6 +271,9 @@ export const EnablePerfAdvisorModal = ({
       <Box
         display="flex"
         width="100%"
+        // Capped whatever the mode: the dialog is fit-content, so a cap that came and went with
+        // the notice resized it whenever the mode changed.
+        maxWidth={600}
         flexDirection="column"
         pt={2}
         pb={2}
```

**File**: `managed/ui/src/translations/en.json` (modified, +6/-5)
```diff
@@ -648,17 +648,18 @@
         "disablePaUniverseFailure": "Failed to disable Performance Monitoring for the universe",
         "subText": "Are you sure you want to {{action}} Performance Monitoring for the universe <strong>{{universeName}}</strong>?",
         "enableAdvancedObservability": "Enable Advanced Observability",
-        "enableAdvancedObservabilitySubText": "Enable Advanced Observability for universe <strong>{{universeName}}</strong>? This will enable additional metrics export to Prometheus.",
+        "enableAdvancedObservabilitySubText": "Enable Advanced Observability for universe <strong>{{universeName}}</strong>? This adds a Performance tab to the console for Cluster Load, Top SQL, SQL details drilldown.",
         "enableAdvancedObservabilityFailure": "Failed to enable Advanced Observability for the universe",
         "disableAdvancedObservabilityTitle": "Disable Advanced Observability",
-        "disableAdvancedObservabilitySubText": "Disable Advanced Observability for universe <strong>{{universeName}}</strong>? This will disable additional metrics export to Prometheus.",
+        "disableAdvancedObservabilitySubText": "Disable Advanced Observability for universe <strong>{{universeName}}</strong>? This removes a Performance tab from the console.",
         "disableAdvancedObservabilityFailure": "Failed to disable Advanced Observability for the universe",
         "modeLabel": "Collection mode",
-        "modeBasic": "Basic - collect and store performance data on this YugabyteDB Anywhere",
-        "modeAdvanced": "Advanced observability - also export universe metrics to Prometheus",
+        "modeBasic": "Basic - collects performance data and exports it with Support Bundle",
+        "modeAdvanced": "Advanced observability - adds a Performance tab to the console for Cluster Load, Top SQL, SQL details drilldown",
         "modeOnline": "Online - collect here and send everything to an external Perf Advisor",
         "onlineDestinationLabel": "Destination",
-        "onlinePrerequisite": "The universe must already be registered on the destination Perf Advisor before online mode can be enabled."
+        "onlinePrerequisite": "The universe must already be registered on the destination Perf Advisor before online mode can be enabled.",
+        "advancedObservabilityLicenseNotice": "<strong>Advanced Observability is a licensed feature.</strong> Please confirm your organization has an Advanced Observability license. If not, contact your Yugabyte account team."
       },
       "pgCompatibility": {
         "modalTitle": "Edit Enhanced Postgres Compatibility",
```

---

### Incident Patch 3: `d94b9691` (2026-10-04)
**Commit Message**: [#34624] DocDB: Fix heap-buffer-overflow in MasterTxnStatusCheck.AutoScale tablet listing

Summary:
`CatalogManager::GetPlacementLocalTransactionStatusTablets` built the tablet id list with a `std::views::filter` | `std::views::transform` | `std::ranges::to<std::vector>` pipeline. This pipeline walks the filtered range twice: once to size the allocation and once to copy the ids. The filter predicate `CheckTransactionStatusTabletUsable` reads tablet state that other threads change during auto-scaling, so a tablet that became usable between the two passes caused a write past the buffer, which ASAN reported as a heap-buffer-overflow. The ids are now collected in a single-pass loop that checks each tablet once and appends with `push_back`, so concurrent state changes can no longer overflow the buffer.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh asan --clang21 --cxx-test transaction_status_check-test --gtest-filter MasterTxnStatusCheck.AutoScale -n 180 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same 

**File**: `src/yb/master/catalog_manager.cc` (modified, +8/-7)
```diff
@@ -5818,13 +5818,14 @@ Status CatalogManager::GetPlacementLocalTransactionStatusTablets(
         continue;
       }
       auto tablets = VERIFY_RESULT(table_info.table->GetTablets());
-      auto tablet_ids =
-          tablets
-              | std::views::filter([this](auto& tablet) {
-                  return CheckTransactionStatusTabletUsable(tablet);
-                })
-              | std::views::transform([](const auto& tablet) { return tablet->tablet_id(); })
-              | std::ranges::to<std::vector>();
+      // Single pass: the usability predicate may change concurrently, so a multi-pass range
+      // (size then copy) could overflow the allocated buffer.
+      std::vector<TabletId> tablet_ids;
+      for (const auto& tablet : tablets) {
+        if (CheckTransactionStatusTabletUsable(tablet)) {
+          tablet_ids.push_back(tablet->tablet_id());
+        }
+      }
       if (table_info.is_region_local) {
         resp->mutable_region_local_tablet_id()->Add(tablet_ids.begin(), tablet_ids.end());
       }
```

---

### Incident Patch 4: `5960e19d` (2026-10-05)
**Commit Message**: [#33919] DocDB: Fix flaky WriteStallCascadeTest.WriteStallCanBlockElection (#34492)

## Summary

In `WriteStallCanBlockElection`, the test shuts down one follower and
then calls `GetLeaderPeerForTablet()`. That function only works if some
peer is `LEADER_AND_READY`. On slow nodes the shutdown can take about 3
seconds, and two things can go wrong in that window:
- The leader can lose its lease, because the stalled follower never
acknowledges it.
- The stalled follower can take over as leader.

When either happens, the call fails with `Expected exactly one leader
... 0 vs 1`.

**Fix:**
The step-down logic is now a shared helper,
`StepDownOriginalLeaderIfStillLeader()`. It finds the peer on the
original leader's tserver directly. If that peer is still the leader, it
steps it down. If it isn't, it skips the step-down. Both
`WriteStallCanBlockElection` and
`ElectionSucceedsDespiteFollowerWriteStall` use it, since both tests had
the same pattern.

`GetTabletLayout()` now keeps retrying for up to 10 seconds. Right after
startup, a peer may not have become a follower yet. That is what caused
`Need at least 2followers: 1 vs 2` on master arm release.

Jira: DB-23519

## Upgrade/Rollback safe

**File**: `src/yb/integration-tests/write_stall_cascade-test.cc` (modified, +76/-26)
```diff
@@ -107,8 +107,21 @@ class WriteStallCascadeTest : public integration_tests::YBTableTestBase {
     std::shared_ptr<tablet::TabletPeer> stalled_peer;
   };
 
-  // Finds the leader and two followers, returning their tserver indices.
+  // Like TryGetTabletLayout(), but retries since roles may still be settling after startup.
   Result<TabletLayout> GetTabletLayout(const std::string& tablet_id) {
+    Result<TabletLayout> layout = STATUS(NotFound, "Tablet layout not found");
+    auto status = WaitFor([&] {
+      layout = TryGetTabletLayout(tablet_id);
+      return layout.ok();
+    }, 10s * kTimeMultiplier, Format("Waiting for leader and two followers of $0", tablet_id));
+    if (!status.ok()) {
+      return status.CloneAndAppend(Format("last error: $0", layout.status()));
+    }
+    return layout;
+  }
+
+  // Finds the leader and two followers, returning their tserver indices.
+  Result<TabletLayout> TryGetTabletLayout(const std::string& tablet_id) {
     TabletLayout layout;
     bool found_leader = false;
     std::vector<size_t> follower_indices;
@@ -165,6 +178,59 @@ class WriteStallCascadeTest : public integration_tests::YBTableTestBase {
     }, 10s * kTimeMultiplier, Format("Waiting for ts-$0 to become leader for $1",
                                      target_ts_idx, tablet_id));
   }
+
+  // Steps down the original leader to trigger an election, if it is still leader.
+  // Doesn't use GetLeaderPeerForTablet(): that requires LEADER_AND_READY, and while the other
+  // follower shuts down the leader may lose its lease (no acks from the stalled follower) or
+  // lose leadership to the stalled follower. In the latter case, the step down is skipped.
+  // Returns true if this step down triggered the election, false if the old leader had already
+  // lost leadership.
+  Result<bool> StepDownOriginalLeaderIfStillLeader(
+      const TabletId& tablet_id, const TabletLayout& layout) {
+    auto leader_peer = mini_cluster()->mini_tablet_server(layout.leader_idx)->server()
+        ->tablet_manager()->LookupTablet(tablet_id);
+    SCHECK_NOTNULL(leader_peer);
+    auto is_leader = [&leader_peer] {
+      auto consensus = leader_peer->GetConsensus();
+      return consensus.ok() &&
+             (*consensus)->GetLeaderStatus() != consensus::LeaderStatus::NOT_LEADER;
+    };
+    auto describe_leader_peer = [&leader_peer] {
+      auto consensus = leader_peer->GetConsensus();
+      if (!consensus.ok()) {
+        return AsString(consensus.status());
+      }
+      auto cstate = (*consensus)->ConsensusState(consensus::CONSENSUS_CONFIG_COMMITTED);
+      return Format("leader status: $0, term: $1, known leader: $2",
+                    (*consensus)->GetLeaderStatus(), cstate.current_term(),
+                    cstate.has_leader_uuid() ? cstate.leader_uuid() : "<none>");
+    };
+    LOG(INFO) << "=== After shutdown, old leader (ts-" << layout.leader_idx << "): "
+              << describe_leader_peer() << "; stalled follower uuid: "
+              << layout.stalled_peer->permanent_uuid() << " ===";
+
+    if (!is_leader()) {
+      LOG(INFO) << "=== Old leader (ts-" << layout.leader_idx << ") already lost leadership, "
+                << "skipping step down ===";
+      return false;
+    }
+
+    LOG(INFO) << "=== Stepping down leader (ts-" << layout.leader_idx << ") ===";
+    auto step_down_status = StepDown(leader_peer, std::string(), ForceStepDown::kTrue);
+    if (!step_down_status.ok()) {
+      if (is_leader()) {
+        return step_down_status;
+      }
+      LOG(INFO) << "=== Step down failed and old leader is no longer leader: "
+                << step_down_status << " ===";
+      return false;
+    }
+
+    RETURN_NOT_OK(WaitFor([&] { return !is_leader(); },
+                          5s * kTimeMultiplier, "Waiting for old leader to step down"));
+    LOG(INFO) << "=== Old leader is no longer leader, waiting for election ===";
+    return true;
+  }
 };
 
 // Verifies that leader election succeeds even when a follower is in a hard write stop.
@@ -231,18 +297,12 @@ TEST_F(WriteStallCascadeTest, ElectionSucceedsDespiteFollowerWriteStall) {
   LOG(INFO) << "=== Shutting down ts-" << layout.other_follower_idx << " ===";
   mini_cluster()->mini_tablet_server(layout.other_follower_idx)->Shutdown();
 
-  // Step down the leader to trigger an election.
-  auto leader_peer = ASSERT_RESULT(GetLeaderPeerForTablet(mini_cluster(), tablet_id));
-  LOG(INFO) << "=== Stepping down leader (ts-" << layout.leader_idx << ") ===";
-  ASSERT_OK(StepDown(leader_peer, std::string(), ForceStepDown::kTrue));
-
-  ASSERT_OK(WaitFor([&]() {
-    auto consensus = leader_peer->GetConsensus();
-    return consensus.ok() &&
-           (*consensus)->GetLeaderStatus() == consensus::LeaderStatus::NOT_LEADER;
-  }, 5s * kTimeMultiplier, "Waiting for old leader to step down"));
-
-  LOG(INFO) << "=== Old leader stepped down, waiting for new leader election ===";
+  if (!ASSERT_RESULT(StepDownOriginalLeaderIfStillLead
```

---

### Incident Patch 5: `6f403ed9` (2026-10-01)
**Commit Message**: [#34069] YSQL: Fix inconsistent BNL batched condition causing wrong results

Summary:
Reject a batched nested loop join that would batch only some of the outer
relations one batched index condition reads.  Such a join returned too few
rows:

  Index Cond: (a = ANY (ARRAY[(t1b.b + t1a.b), ($1 + $1025), ...]))

Here one join batches `t1b` and another batches `t1a`.  The expression is
expanded with one batch index shared by every batched value in it, but each
join fills its own parameter slots from its own outer scan, so element i pairs
slot i of one batch with slot i of the other.  The probe list holds only the
diagonal of the two batches instead of their cross product, and every row the
diagonal misses is lost.

`yb_has_non_evaluable_bnl_clauses` (#17150) rejects such a join only while the
clause is visible to it: it reads the join's restriction clauses and the inner
path's `ppi_clauses`, and join relations carry no `ppi_clauses`.  Once the scan
carrying the expression sits below another join, nothing records which
relations it needs batched together.

This change records that on the path's ParamPathInfo and enforces it at every
join level:

- `yb_ppi_batched_groups` lists the sets 

**File**: `src/postgres/src/backend/optimizer/path/indxpath.c` (modified, +4/-0)
```diff
@@ -948,6 +948,9 @@ yb_get_batched_index_paths(PlannerInfo *root, RelOptInfo *rel,
 
 	Assert(!root->yb_cur_batched_relids);
 	root->yb_cur_batched_relids = batchedrelids;
+	root->yb_cur_batched_groups =
+		yb_clause_batched_groups(batched_rinfos, batchedrelids,
+								 index->rel->relids);
 
 	/*
 	 * An index clause that references a batched outer relation but cannot
@@ -1052,6 +1055,7 @@ yb_get_batched_index_paths(PlannerInfo *root, RelOptInfo *rel,
 	}
 
 	root->yb_cur_batched_relids = NULL;
+	root->yb_cur_batched_groups = NIL;
 
 	return batched_paths_added;
 }
```

**File**: `src/postgres/src/backend/optimizer/path/joinpath.c` (modified, +43/-6)
```diff
@@ -102,6 +102,8 @@ static void generate_mergejoin_paths(PlannerInfo *root,
 									 bool is_partial);
 
 /* YB declarations */
+static bool yb_join_splits_batched_rels(Relids batched_together,
+										Relids outerrelids);
 static bool yb_has_non_evaluable_bnl_clauses(Path *outer_path,
 											 Path *inner_path,
 											 List *rinfos);
@@ -2529,6 +2531,25 @@ select_mergejoin_clauses(PlannerInfo *root,
 	return result_list;
 }
 
+/*
+ * yb_join_splits_batched_rels
+ *	  Would a join over outerrelids batch only part of a set of outer relations
+ *	  that have to be batched together?
+ *
+ * One batch index addresses every batched value in a batched expression, so a
+ * join that supplies some members of such a set and leaves the rest to another
+ * join pairs slot i of one batch with slot i of another.  That yields the
+ * diagonal of the two batches rather than their cross product, and the rows
+ * the diagonal misses are lost.  Supplying none of the set is fine; a join
+ * further up takes it whole.
+ */
+static bool
+yb_join_splits_batched_rels(Relids batched_together, Relids outerrelids)
+{
+	return (bms_overlap(batched_together, outerrelids) &&
+			!bms_is_subset(batched_together, outerrelids));
+}
+
 /*
  * A batched clause can be non_evaluable if it requires input relations
  * A and B on its outer side but And B are not joined together in the context
@@ -2541,6 +2562,11 @@ select_mergejoin_clauses(PlannerInfo *root,
  * and S = {1,3} then we cannot join O to I as I will not receieve a cross
  * product of relations 1 and 3. On the other hand, if O had relations {1,3,4},
  * the join would be acceptable.
+ *
+ * It is only handed this join's restriction clauses and I's ppi_clauses, and
+ * ppi_clauses is NIL once I is a joinrel, so a clause evaluated inside I
+ * escapes it.  yb_batched_clause_final_check feeds the same test from
+ * yb_ppi_batched_groups, which carries S across those joins.
  */
 static bool
 yb_has_non_evaluable_bnl_clauses(Path *outer_path, Path *inner_path,
@@ -2561,14 +2587,11 @@ yb_has_non_evaluable_bnl_clauses(Path *outer_path, Path *inner_path,
 		if (!batched_rinfo)
 			continue;
 
-		Relids		right_relids = batched_rinfo->right_relids;
+		Relids		right_relids = bms_intersect(batched_rinfo->right_relids,
+												 req_batched_rels);
 
-		right_relids = bms_intersect(right_relids, req_batched_rels);
-		if (bms_overlap(right_relids, outer_relids) &&
-			!bms_is_subset(right_relids, outer_relids))
-		{
+		if (yb_join_splits_batched_rels(right_relids, outer_relids))
 			return true;
-		}
 	}
 	return false;
 }
@@ -2587,6 +2610,8 @@ yb_batched_clause_final_check(Path *outer_path,
 {
 	if (YB_PATH_NEEDS_BATCHED_RELS(inner_path))
 	{
+		ListCell   *lc;
+
 		/*
 		 * Check to make sure this is a valid BNL.
 		 */
@@ -2600,6 +2625,18 @@ yb_batched_clause_final_check(Path *outer_path,
 		{
 			return false;
 		}
+
+		/*
+		 * The same rule fed from the inner path's groups, for a clause the
+		 * lists above can no longer reach.  Only the inner path's groups
+		 * matter: an outer path's group names relations supplied from above
+		 * this join, which this join cannot split.
+		 */
+		foreach(lc, YB_PATH_BATCHED_GROUPS(inner_path))
+		{
+			if (yb_join_splits_batched_rels((Relids) lfirst(lc), outerrelids))
+				return false;
+		}
 	}
 
 	/*
```

**File**: `src/postgres/src/backend/optimizer/plan/createplan.c` (modified, +32/-0)
```diff
@@ -7162,6 +7162,38 @@ replace_nestloop_params_mutator(Node *node, PlannerInfo *root)
 		YbBatchedExpr *bexpr = (YbBatchedExpr *) node;
 		List	   *batched_elems = NIL;
 
+#ifdef USE_ASSERT_CHECKING
+
+		/*
+		 * Every batched Var below shares root->yb_cur_batch_no, so one
+		 * batched nested loop join has to fill all of them (see
+		 * yb_ppi_batched_groups); yb_availBatchedRelids holds one entry per
+		 * enclosing such join.  yb_batched_clause_final_check keeps paths
+		 * that would span two of them out, and a violation here has no
+		 * symptom other than lost rows, so fail loudly instead.
+		 */
+		Relids		batched_vars =
+			bms_intersect(pull_varnos(root, (Node *) bexpr->orig_expr),
+						  root->yb_cur_batched_relids);
+
+		if (!bms_is_empty(batched_vars))
+		{
+			bool		one_join = false;
+			ListCell   *lc;
+
+			foreach(lc, root->yb_availBatchedRelids)
+			{
+				if (bms_is_subset(batched_vars, (Relids) lfirst(lc)))
+				{
+					one_join = true;
+					break;
+				}
+			}
+
+			Assert(one_join);
+		}
+#endif
+
 		/*
 		 * Populate batched_elems with each batched instance of
 		 * bexpr->orig_expr's contents.
```

**File**: `src/postgres/src/backend/optimizer/plan/planner.c` (modified, +2/-0)
```diff
@@ -777,6 +777,8 @@ subquery_planner(PlannerGlobal *glob, Query *parse,
 		parent_root ? parent_root->yb_cur_batched_relids : NULL;
 	root->yb_cur_unbatched_relids =
 		parent_root ? parent_root->yb_cur_unbatched_relids : NULL;
+	root->yb_cur_batched_groups =
+		parent_root ? parent_root->yb_cur_batched_groups : NIL;
 	root->yb_availBatchedRelids =
 		parent_root ? parent_root->yb_availBatchedRelids : NULL;
 	root->yb_cur_batch_no = -1;
```

**File**: `src/postgres/src/backend/optimizer/prep/prepjointree.c` (modified, +1/-0)
```diff
@@ -1023,6 +1023,7 @@ pull_up_simple_subquery(PlannerInfo *root, Node *jtnode, RangeTblEntry *rte,
 	subroot->hasRecursion = false;
 	subroot->yb_cur_batched_relids = NULL;
 	subroot->yb_cur_unbatched_relids = NULL;
+	subroot->yb_cur_batched_groups = NIL;
 	subroot->yb_availBatchedRelids = NULL;
 	subroot->yb_cur_batch_no = -1;
 	subroot->wt_param_id = -1;
```

**File**: `src/postgres/src/backend/optimizer/util/pathnode.c` (modified, +13/-0)
```diff
@@ -1933,17 +1933,30 @@ create_append_path(PlannerInfo *root,
 		/* YB */
 		if (subpaths)
 		{
+			List	   *groups = NIL;
+
 			/* YB: Accumulate batching info from subpaths for this "baserel". */
 			Assert(yb_has_same_batching_reqs(subpaths));
 
 			root->yb_cur_batched_relids =
 				YB_PATH_REQ_OUTER_BATCHED((Path *) linitial(subpaths));
+
+			/*
+			 * The parent's movable clauses can miss a group that a child's
+			 * index condition batches on, and children can batch different
+			 * clauses, so pass on the union of the children's groups.
+			 */
+			foreach(l, subpaths)
+				groups = list_concat(groups,
+									 YB_PATH_BATCHED_GROUPS((Path *) lfirst(l)));
+			root->yb_cur_batched_groups = groups;
 		}
 
 		pathnode->path.param_info = get_baserel_parampathinfo(root,
 															  rel,
 															  required_outer);
 		root->yb_cur_batched_relids = NULL;
+		root->yb_cur_batched_groups = NIL;
 	}
 	else
 		pathnode->path.param_info = get_appendrel_parampathinfo(rel,
```

**File**: `src/postgres/src/backend/optimizer/util/relnode.c` (modified, +182/-2)
```diff
@@ -77,6 +77,14 @@ static void build_child_join_reltarget(PlannerInfo *root,
 									   int nappinfos,
 									   AppendRelInfo **appinfos);
 
+/* YB declarations */
+static List *yb_add_batched_groups(List *groups, List *more,
+								   Relids batchedrelids);
+static List *yb_groups_within(List *groups, Relids relids);
+static ParamPathInfo *yb_ppi_add_batched_groups(ParamPathInfo *ppi,
+											   List *groups,
+											   Relids batchedrelids);
+
 
 /*
  * setup_simple_rel_arrays
@@ -1492,7 +1500,12 @@ get_baserel_parampathinfo(PlannerInfo *root, RelOptInfo *baserel,
 			 yb_find_batched_param_path_info(baserel,
 											 required_outer,
 											 batchedrelids)))
-			return ppi;
+		{
+			List	   *groups = yb_groups_within(root->yb_cur_batched_groups,
+											  required_outer);
+
+			return yb_ppi_add_batched_groups(ppi, groups, batchedrelids);
+		}
 	}
 	else
 	{
@@ -1602,6 +1615,28 @@ get_baserel_parampathinfo(PlannerInfo *root, RelOptInfo *baserel,
 	ppi->yb_ppi_req_outer_batched = batchedrelids;
 	ppi->yb_ppi_relegated_clauses = yb_relegated_clauses;
 
+	/*
+	 * Two sources, because neither sees every batched clause.  pclauses covers
+	 * clauses that never become an index condition, but it can miss one that
+	 * does: generate_join_implied_equalities emits one clause per equivalence
+	 * class and scores a plain Var above an expression, while the index path
+	 * may batch on the expression.  yb_cur_batched_groups carries what the path
+	 * being built does batch: the index clauses indxpath.c batched, or the
+	 * children's groups when create_append_path builds a partitioned rel's
+	 * Append.  Those can span more than this parameterization, so keep only the
+	 * ones it supplies.
+	 * What remains over-approximates in the same direction as the ppi_clauses
+	 * rule in yb_has_non_evaluable_bnl_clauses: a path may carry a group it
+	 * does not need, which costs that join order its batching, never
+	 * correctness.
+	 */
+	ppi->yb_ppi_batched_groups =
+		yb_add_batched_groups(yb_clause_batched_groups(pclauses, batchedrelids,
+													   baserel->relids),
+							  yb_groups_within(root->yb_cur_batched_groups,
+											   required_outer),
+							  batchedrelids);
+
 	baserel->ppilist = lappend(baserel->ppilist, ppi);
 
 	return ppi;
@@ -1653,6 +1688,8 @@ get_joinrel_parampathinfo(PlannerInfo *root, RelOptInfo *joinrel,
 	double		rows;
 	ListCell   *lc;
 
+	List	   *yb_groups = NIL;
+
 	/* If rel has LATERAL refs, every path for it should account for them */
 	Assert(bms_is_subset(joinrel->lateral_relids, required_outer));
 
@@ -1935,11 +1972,31 @@ get_joinrel_parampathinfo(PlannerInfo *root, RelOptInfo *joinrel,
 	 */
 	*restrict_clauses = list_concat(pclauses, *restrict_clauses);
 
+	/*
+	 * YB: Carry the batched groups of both inputs, trimmed to the relations
+	 * this join still needs batched.  The outer input matters as much as the
+	 * inner one: the scan carrying such a group can sit on either side of an
+	 * intervening join, and on the outer side nothing else records it.  A
+	 * group that loses a member here is satisfied -- either the member is
+	 * supplied by this join, which had to supply the whole group to pass
+	 * yb_batched_clause_final_check, or it became unbatched and now
+	 * contributes a scalar parameter.
+	 */
+	if (IsYugaByteEnabled() && !bms_is_empty(req_batchedids))
+	{
+		yb_groups = yb_add_batched_groups(yb_groups,
+										  YB_PATH_BATCHED_GROUPS(outer_path),
+										  req_batchedids);
+		yb_groups = yb_add_batched_groups(yb_groups,
+										  YB_PATH_BATCHED_GROUPS(inner_path),
+										  req_batchedids);
+	}
+
 	/* If we already have a PPI for this parameterization, just return it */
 	if ((ppi = yb_find_batched_param_path_info(joinrel,
 											   required_outer,
 											   req_batchedids)))
-		return ppi;
+		return yb_ppi_add_batched_groups(ppi, yb_groups, req_batchedids);
 
 	/* Estimate the number of rows returned by the parameterized join */
 	rows = get_parameterized_joinrel_size(root, joinrel,
@@ -1961,6 +2018,7 @@ get_joinrel_parampathinfo(PlannerInfo *root, RelOptInfo *joinrel,
 	ppi->ppi_clauses = NIL;
 
 	ppi->yb_ppi_req_outer_batched = req_batchedids;
+	ppi->yb_ppi_batched_groups = yb_groups;
 
 	joinrel->ppilist = lappend(joinrel->ppilist, ppi);
 
@@ -2477,3 +2535,125 @@ build_child_join_reltarget(PlannerInfo *root,
 	childrel->reltarget->cost.per_tuple = parentrel->reltarget->cost.per_tuple;
 	childrel->reltarget->width = parentrel->reltarget->width;
 }
+
+/*
+ * yb_clause_batched_groups
+ *	  Sets of batched outer relations that a single batched clause of a base
+ *	  relation scan references together.
+ *
+ * Only relations that are batched here take part.  An unbatched relation in
+ * the same expression supplies a scalar nestloop param that stays fixed for a
+ * whole rescan of this scan, and the array is rebuilt on each rescan, so its
+ * owner may sit at any level without breaking the cross product.  Two b
```

**File**: `src/postgres/src/include/nodes/pathnodes.h` (modified, +20/-0)
```diff
@@ -407,6 +407,8 @@ struct PlannerInfo
 	Relids		yb_cur_batched_relids;	/* valid if we are processing a
 										 * batched NL join */
 	Relids		yb_cur_unbatched_relids;
+	List	   *yb_cur_batched_groups;	/* yb_ppi_batched_groups for the
+										 * path being built */
 
 	/*
 	 * YB: List of Relids. Each element is a Bitmapset that encodes the batched
@@ -1260,6 +1262,20 @@ typedef struct PathTarget
  * the same relation is referenced with a batched array elsewhere in the scan.
  * The join directly above the path applies them instead (see
  * get_joinrel_parampathinfo).  Like ppi_clauses, it is NIL in join cases.
+ *
+ * YB: yb_ppi_batched_groups lists the sets of batched outer relations that a
+ * single batched clause of this path references together.  Such a clause
+ * becomes one YbBatchedExpr, which createplan.c expands into an array using
+ * one batch index for every batched Var inside it, so element i is only
+ * meaningful when all of them come from the same outer tuple -- that is, when
+ * one batched nested loop join fills them.  A join that batches part of a set
+ * probes the diagonal of two independently advancing batches instead of their
+ * cross product and loses rows, so yb_batched_clause_final_check rejects it.
+ * Unlike ppi_clauses this list is carried up through join cases, because the
+ * clause it came from is not reachable from there.  Only sets of two or more
+ * are recorded: one batched relation constrains nothing, and an unbatched
+ * relation in the same expression supplies a scalar parameter that holds
+ * still for a whole rescan of this path.
  */
 typedef struct ParamPathInfo
 {
@@ -1272,6 +1288,7 @@ typedef struct ParamPathInfo
 	/* Yugabyte attributes */
 	Relids		yb_ppi_req_outer_batched;	/* outer rels that can be batched */
 	List	   *yb_ppi_relegated_clauses;	/* clauses withheld from ppi_clauses */
+	List	   *yb_ppi_batched_groups;	/* outer rels to batch together */
 } ParamPathInfo;
 
 
@@ -1417,6 +1434,9 @@ typedef struct Path
 #define YB_PATH_NEEDS_BATCHED_RELS(path) \
 	!bms_is_empty(YB_PATH_REQ_OUTER_BATCHED(path))
 
+#define YB_PATH_BATCHED_GROUPS(path)  \
+	((path)->param_info ? ((path)->param_info->yb_ppi_batched_groups) : NIL)
+
 #define YB_PATH_REQ_OUTER_UNBATCHED(path)  \
 	(bms_difference(PATH_REQ_OUTER(path), YB_PATH_REQ_OUTER_BATCHED(path)))
 
```

---

### Incident Patch 6: `a24426da` (2026-10-05)
**Commit Message**: [PLAT-22824] Fix settings validation for multiprovider

Summary: wrong method was used for counting the number of different values, fixed that.

Test Plan: sbt test

Reviewers: amalyshev

Reviewed By: amalyshev

Subscribers: yugaware

Differential Revision: https://phorge.dev.yugabyte.com/D59006

**File**: `managed/src/main/java/com/yugabyte/yw/common/Util.java` (modified, +1/-1)
```diff
@@ -2110,7 +2110,7 @@ private void verifyValues(String property, Provider p, Object value) {
       SetMultimap<Object, UUID> mmap =
           valuesTracker.computeIfAbsent(property, (x) -> HashMultimap.create());
       mmap.put(value, p.getUuid());
-      if (mmap.keys().size() > 1) {
+      if (mmap.keySet().size() > 1) {
         List<String> list =
             mmap.entries().stream()
                 .map(e -> e.getValue().toString() + " has " + e.getKey())
```

**File**: `managed/src/test/java/com/yugabyte/yw/common/UtilTest.java` (modified, +41/-0)
```diff
@@ -16,10 +16,12 @@
 import static org.mockito.Mockito.doReturn;
 import static org.mockito.Mockito.mock;
 import static org.mockito.Mockito.when;
+import static play.mvc.Http.Status.BAD_REQUEST;
 
 import com.cronutils.utils.StringUtils;
 import com.fasterxml.jackson.databind.JsonNode;
 import com.google.common.collect.ImmutableMap;
+import com.yugabyte.yw.cloud.PublicCloudConstants.Architecture;
 import com.yugabyte.yw.commissioner.Common.CloudType;
 import com.yugabyte.yw.common.config.GlobalConfKeys;
 import com.yugabyte.yw.common.config.ProviderConfKeys;
@@ -1088,4 +1090,43 @@ public void testGetPostgresCompatiblePassword() {
     }
     assertEquals(500, passwords.size());
   }
+
+  @Test
+  public void testTaskParamsUpdater_sameArchAcrossProviders_succeeds() {
+    UniverseDefinitionTaskParams taskParams = new UniverseDefinitionTaskParams();
+    Util.TaskParamsUpdater updater = new Util.TaskParamsUpdater(taskParams);
+    Provider first = providerWithUuid(UUID.randomUUID());
+    Provider second = providerWithUuid(UUID.randomUUID());
+
+    updater.setArch(first, Architecture.x86_64);
+    updater.setArch(second, Architecture.x86_64);
+
+    assertEquals(Architecture.x86_64, taskParams.arch);
+  }
+
+  @Test
+  public void testTaskParamsUpdater_differentArchAcrossProviders_fails() {
+    UniverseDefinitionTaskParams taskParams = new UniverseDefinitionTaskParams();
+    Util.TaskParamsUpdater updater = new Util.TaskParamsUpdater(taskParams);
+    UUID firstUuid = UUID.randomUUID();
+    UUID secondUuid = UUID.randomUUID();
+    Provider first = providerWithUuid(firstUuid);
+    Provider second = providerWithUuid(secondUuid);
+
+    updater.setArch(first, Architecture.x86_64);
+    PlatformServiceException exception =
+        assertThrows(
+            PlatformServiceException.class, () -> updater.setArch(second, Architecture.aarch64));
+
+    assertEquals(BAD_REQUEST, exception.getHttpStatus());
+    assertTrue(exception.getMessage().contains("Architecture"));
+    assertTrue(exception.getMessage().contains(firstUuid + " has x86_64"));
+    assertTrue(exception.getMessage().contains(secondUuid + " has aarch64"));
+  }
+
+  private static Provider providerWithUuid(UUID uuid) {
+    Provider provider = mock(Provider.class);
+    when(provider.getUuid()).thenReturn(uuid);
+    return provider;
+  }
 }
```

---

### Incident Patch 7: `50445c03` (2026-10-03)
**Commit Message**: [#34617] CDC: Fix CdcUpgradeTest.RollbackBeforeFinalize timeout by stopping tservers first

Summary:
After the rollback the cluster runs the old `2024.2.4.0` binaries, and teardown stops the masters before the tservers. Once the masters are gone, each old tserver ignores `SIGTERM` because its CDC `update_peers_and_metrics` thread keeps retrying master lookups, so it is killed only after the 60s graceful wait. Those extra minutes pushed the slow `gcc15` fastdebug run past its 600s test timeout. `CdcUpgradeTest` now overrides `TearDown()` to call `cluster_->Shutdown(ExternalMiniCluster::TS_ONLY)` while the masters are still up, then runs the base teardown; it skips this when `HasFatalFailure()` is true so the base teardown can still dump tserver stacks.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh fastdebug --gcc15 --cxx-test ysql_cdc_upgrade-test --gtest-filter CdcUpgradeTest.RollbackBeforeFinalize -n 100 YB_TEST_YB_CONTROLLER=0 YB_ENABLE_YSQL_CONN_MGR_IN_JAVA_TESTS=true --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test rep

**File**: `src/yb/integration-tests/upgrade-tests/ysql_cdc_upgrade-test.cc` (modified, +9/-0)
```diff
@@ -29,6 +29,15 @@ class CdcUpgradeTest : public UpgradeTestBase {
  public:
   CdcUpgradeTest() : UpgradeTestBase(kBuild_2024_2_4_0) {}
 
+  void TearDown() override {
+    // Old version tservers hang on SIGTERM for 60s if masters are already down (the CDC
+    // update_peers_and_metrics thread keeps retrying master lookups), so stop tservers first.
+    if (cluster_ && !HasFatalFailure()) {
+      cluster_->Shutdown(ExternalMiniCluster::TS_ONLY);
+    }
+    UpgradeTestBase::TearDown();
+  }
+
  protected:
   static constexpr auto kTableName = "test_table";
   static constexpr auto kDbName = "yugabyte";
```

---

### Incident Patch 8: `771f263d` (2026-09-28)
**Commit Message**: [#34330] DocDB: Fix ...eTestWithYsqlColocationRestoreParam.PgsqlAlterTableSetOwner/DBColocated_Clone

Summary:
Stabilize YbAdminSnapshotScheduleTestWithYsqlColocationRestoreParam under sanitizers: scale the master YSQL lease TTL, leader failure missed-heartbeat periods and raft/HT leader lease durations by kTimeMultiplier, so follower stalls during sys catalog snapshots neither expire YSQL leases (which kills the clone's ysqlsh) nor trigger master elections (which abort the clone); ExternalMiniCluster now inserts its sanitizer default for leader_failure_max_missed_heartbeat_periods first so extra_master_flags can override it.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh asan --clang21 --cxx-test yb-admin-snapshot-schedule-test --gtest-filter YbAdminSnapshotScheduleTestWithYsqlColocationRestoreParam.PgsqlAlterTableSetOwner/DBColocated_Clone -n 100 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --stop-at-failure) -- with the CSI dashboard rate for refere

**File**: `src/yb/tools/yb-admin-snapshot-schedule-test.cc` (modified, +7/-0)
```diff
@@ -577,6 +577,13 @@ class YbAdminSnapshotScheduleTestWithYsql : public YbAdminSnapshotScheduleTest {
     // master failover that aborts in-progress clones.
     opts->extra_master_flags.emplace_back(
         Format("--leader_failure_max_missed_heartbeat_periods=$0", 10 * kTimeMultiplier));
+    // Such stalls (up to ~8s) outlast the default 2s raft lease, so the master leader keeps losing
+    // its lease and cannot refresh YSQL leases. Must stay below the 15s leader failure timeout.
+    if (IsSanitizer()) {
+      for (auto flag : {"leader_lease_duration_ms", "ht_lease_duration_ms"}) {
+        opts->extra_master_flags.emplace_back(Format("--$0=$1", flag, 4000 * kTimeMultiplier));
+      }
+    }
     opts->num_masters = 3;
   }
 
```

---

### Incident Patch 9: `b0009a4b` (2026-09-30)
**Commit Message**: [#34414] DocDB: Fix LoadBalancerPlacementPolicyTest.PrefixPlacementTest stall on blacklisted tserver

Summary:
A drained, blacklisted tserver has zero load, so it sorts first in `sorted_load_` and `ClusterLoadBalancer::GetLoadToMove` picks it as the low-load destination, even though `CanAddTabletToTabletServer` always rejects moves to it. The search then steps through sources until the per-table gap is 1. There the global-load check returns `false` for the whole table, and the balancer goes idle with the table still unbalanced (the test expects 2 replicas per tserver after the `c,c,c` placement change). The fix skips blacklisted tservers as the `left` destination candidate, so the check only compares servers that can actually receive load. The `left < last_pos` guard keeps the final iteration, so the loop still ends through its normal `return false`.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh tsan --clang21 --cxx-test load_balancer_placement_policy-test --gtest-filter LoadBalancerPlacementPolicyTest.PrefixPlacementTest -n 180 --stop-at-failure -- -p 6
Ran the ab

**File**: `src/yb/master/cluster_balance.cc` (modified, +8/-0)
```diff
@@ -1218,6 +1218,14 @@ Result<bool> ClusterLoadBalancer::GetLoadToMove(
   // the interval between left and right cannot have load > kMinLoadVarianceToBalance.
   ssize_t last_pos = state_->sorted_load_.size() - 1;
   for (ssize_t left = 0; left <= last_pos; ++left) {
+    // Blacklisted tservers cannot receive load. Using one as the destination could end the search
+    // early via the global load check below. last_pos is never skipped: its iteration
+    // (left == right, load_variance == 0) terminates the loop via return false instead of
+    // falling through to the IllegalState below.
+    if (left < last_pos &&
+        global_state_->blacklisted_servers_.contains(state_->sorted_load_[left])) {
+      continue;
+    }
     for (auto right = last_pos; right >= 0; --right) {
       const TabletServerId& low_load_uuid = state_->sorted_load_[left];
       const TabletServerId& high_load_uuid = state_->sorted_load_[right];
```

---

### Incident Patch 10: `3cf9f46a` (2026-10-04)
**Commit Message**: [#34535] build: Add google/benchmark microbenchmarks (ADD_YB_BENCHMARK) (#34536)

Summary:
Adds C++ microbenchmarks based on google/benchmark, which
yugabyte/yugabyte-db-thirdparty#379 added to thirdparty.

- `ADD_YB_BENCHMARK(name DEPS ...)` builds a benchmark into
`build/<type>/benchmarks-<dir>/`. Benchmarks build whenever tests build,
so they keep compiling, but they are not registered with ctest and the
test runner never runs them. `--target benchmarks` builds all of them.
- Benchmarks share one `main()`. `--benchmark_*` flags and `--help` go
to google/benchmark; all other flags go to gflags. Command-line flags
are parsed exactly as in tests, including AutoFlag promotion:
`test_main.cc` and `benchmark_main.cc` now both call the new
`ParseCommandLineFlagsForTests()`. A benchmark that needs its own setup
or teardown defines `yb::BenchmarkInit()` or `yb::BenchmarkTeardown()`,
which replace weak defaults (`benchmark_main.h`).
- `src/yb/util/mutex-benchmark.cc` is a minimal example (std::mutex vs
absl::Mutex under contention), and `src/AGENTS.md` has the recipe for
building and running benchmarks.
- Updates thirdparty to pick up google/benchmark.

Test Plan:
```
./yb_build.sh releas

**File**: `build-support/thirdparty_archives.yml` (modified, +21/-21)
```diff
@@ -1,106 +1,106 @@
-sha: 16cc15cc1460904608d7e08b525eb871987ab6b4
+sha: 2c1852ba51e3b4912401992f0189fae0dda86b78
 archives:
 
   - os_type: almalinux8
     architecture: aarch64
     compiler_type: clang19
-    tag: v20260929040302-16cc15cc14-almalinux8-aarch64-clang19
+    tag: v20261001194854-2c1852ba51-almalinux8-aarch64-clang19
 
   - os_type: almalinux8
     architecture: aarch64
     compiler_type: clang19
     lto_type: full
-    tag: v20260929040312-16cc15cc14-almalinux8-aarch64-clang19-full-lto
+    tag: v20261001194839-2c1852ba51-almalinux8-aarch64-clang19-full-lto
 
   - os_type: almalinux8
     architecture: aarch64
     compiler_type: clang21
-    tag: v20260929040207-16cc15cc14-almalinux8-aarch64-clang21
+    tag: v20261001194854-2c1852ba51-almalinux8-aarch64-clang21
 
   - os_type: almalinux8
     architecture: aarch64
     compiler_type: clang21
     lto_type: full
-    tag: v20260929040159-16cc15cc14-almalinux8-aarch64-clang21-full-lto
+    tag: v20261001194832-2c1852ba51-almalinux8-aarch64-clang21-full-lto
 
   - os_type: almalinux8
     architecture: x86_64
     compiler_type: clang19
-    tag: v20260929040227-16cc15cc14-almalinux8-x86_64-clang19
+    tag: v20261001194859-2c1852ba51-almalinux8-x86_64-clang19
 
   - os_type: almalinux8
     architecture: x86_64
     compiler_type: clang19
     lto_type: full
-    tag: v20260929040227-16cc15cc14-almalinux8-x86_64-clang19-full-lto
+    tag: v20261001194926-2c1852ba51-almalinux8-x86_64-clang19-full-lto
 
   - os_type: almalinux8
     architecture: x86_64
     compiler_type: clang21
-    tag: v20260929040229-16cc15cc14-almalinux8-x86_64-clang21
+    tag: v20261001194848-2c1852ba51-almalinux8-x86_64-clang21
 
   - os_type: almalinux8
     architecture: x86_64
     compiler_type: clang21
     lto_type: full
-    tag: v20260929040223-16cc15cc14-almalinux8-x86_64-clang21-full-lto
+    tag: v20261001194835-2c1852ba51-almalinux8-x86_64-clang21-full-lto
 
   - os_type: almalinux8
     architecture: x86_64
     compiler_type: gcc15
-    tag: v20260929040223-16cc15cc14-almalinux8-x86_64-gcc15
+    tag: v20261001194838-2c1852ba51-almalinux8-x86_64-gcc15
 
   - os_type: almalinux9
     architecture: x86_64
     compiler_type: clang19
-    tag: v20260929040231-16cc15cc14-almalinux9-x86_64-clang19
+    tag: v20261001234018-2c1852ba51-almalinux9-x86_64-clang19
 
   - os_type: almalinux9
     architecture: x86_64
     compiler_type: clang21
-    tag: v20260929040205-16cc15cc14-almalinux9-x86_64-clang21
+    tag: v20261001194913-2c1852ba51-almalinux9-x86_64-clang21
 
   - os_type: almalinux9
     architecture: x86_64
     compiler_type: gcc15
-    tag: v20260929040237-16cc15cc14-almalinux9-x86_64-gcc15
+    tag: v20261001194913-2c1852ba51-almalinux9-x86_64-gcc15
 
   - os_type: macos
     architecture: arm64
     compiler_type: clang21
-    tag: v20260929035942-16cc15cc14-macos-arm64-clang21
+    tag: v20261001194625-2c1852ba51-macos-arm64-clang21
 
   - os_type: macos
     architecture: x86_64
     compiler_type: clang21
-    tag: v20260929040102-16cc15cc14-macos-x86_64-clang21
+    tag: v20261001194728-2c1852ba51-macos-x86_64-clang21
 
   - os_type: ubuntu22.04
     architecture: x86_64
     compiler_type: clang19
-    tag: v20260929040317-16cc15cc14-ubuntu2204-x86_64-clang19
+    tag: v20261001194931-2c1852ba51-ubuntu2204-x86_64-clang19
 
   - os_type: ubuntu22.04
     architecture: x86_64
     compiler_type: clang21
-    tag: v20260929040149-16cc15cc14-ubuntu2204-x86_64-clang21
+    tag: v20261001194830-2c1852ba51-ubuntu2204-x86_64-clang21
 
   - os_type: ubuntu22.04
     architecture: x86_64
     compiler_type: gcc15
-    tag: v20260929040213-16cc15cc14-ubuntu2204-x86_64-gcc15
+    tag: v20261001194904-2c1852ba51-ubuntu2204-x86_64-gcc15
 
   - os_type: ubuntu24.04
     architecture: x86_64
     compiler_type: clang19
-    tag: v20260929165609-16cc15cc14-ubuntu2404-x86_64-clang19
+    tag: v20261001195010-2c1852ba51-ubuntu2404-x86_64-clang19
 
   - os_type: ubuntu24.04
     architecture: x86_64
     compiler_type: clang21
-    tag: v20260929040158-16cc15cc14-ubuntu2404-x86_64-clang21
+    tag: v20261001194932-2c1852ba51-ubuntu2404-x86_64-clang21
 
   - os_type: ubuntu24.04
     architecture: x86_64
     compiler_type: gcc15
-    tag: v20260929040226-16cc15cc14-ubuntu2404-x86_64-gcc15
+    tag: v20261001194842-2c1852ba51-ubuntu2404-x86_64-gcc15
```

**File**: `cmake_modules/FindGBenchmark.cmake` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+#
+# Copyright (c) YugabyteDB, Inc.
+#
+# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
+# in compliance with the License. You may obtain a copy of the License at
+#
+# http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software distributed under the License
+# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
+# or implied. See the License for the specific language governing permissions and limitations
+# under the License.
+#
+
+# Finds google/benchmark (https://github.com/google/benchmark) in the third-party directory.
+#
+# This module defines
+# GBENCHMARK_INCLUDE_DIR, where to find benchmark/benchmark.h
+# GBENCHMARK_STATIC_LIB, path to libbenchmark.a
+# GBENCHMARK_SHARED_LIB, path to the libbenchmark shared library
+
+find_path(GBENCHMARK_INCLUDE_DIR benchmark/benchmark.h
+  NO_CMAKE_SYSTEM_PATH
+  NO_SYSTEM_ENVIRONMENT_PATH)
+find_library(GBENCHMARK_STATIC_LIB libbenchmark.a
+  NO_CMAKE_SYSTEM_PATH
+  NO_SYSTEM_ENVIRONMENT_PATH)
+find_library(GBENCHMARK_SHARED_LIB benchmark
+  NO_CMAKE_SYSTEM_PATH
+  NO_SYSTEM_ENVIRONMENT_PATH)
+
+include(FindPackageHandleStandardArgs)
+find_package_handle_standard_args(GBENCHMARK REQUIRED_VARS
+  GBENCHMARK_STATIC_LIB GBENCHMARK_SHARED_LIB GBENCHMARK_INCLUDE_DIR)
```

**File**: `cmake_modules/YugabyteFindThirdParty.cmake` (modified, +7/-0)
```diff
@@ -147,6 +147,13 @@ macro(yb_find_third_party_dependencies)
     STATIC_LIB ${GTEST_STATIC_LIBRARY}
     SHARED_LIB ${GTEST_SHARED_LIBRARY})
 
+  ## google/benchmark, used by microbenchmarks added with ADD_YB_BENCHMARK.
+  find_package(GBenchmark REQUIRED)
+  include_directories(SYSTEM ${GBENCHMARK_INCLUDE_DIR})
+  ADD_THIRDPARTY_LIB(gbenchmark
+    STATIC_LIB ${GBENCHMARK_STATIC_LIB}
+    SHARED_LIB ${GBENCHMARK_SHARED_LIB})
+
   ## Protobuf
   add_custom_target(gen_proto)
   find_package(Protobuf REQUIRED)
```

**File**: `cmake_modules/YugabyteTesting.cmake` (modified, +43/-0)
```diff
@@ -240,6 +240,49 @@ function(ADD_YB_TEST_LIBRARY LIB_NAME)
   endif()
 endfunction()
 
+# Add a microbenchmark executable written with google/benchmark (BENCHMARK(...) registrations, no
+# main() of its own). REL_BENCHMARK_NAME is the source file path without the .cc extension, relative
+# to the current CMakeLists.txt, e.g. mutex-benchmark. DEPS lists additional libraries to link.
+#
+# Benchmarks are built whenever tests are built (YB_BUILD_TESTS, YB_TEST_FILTER_RE), so that they
+# keep compiling, but they are not registered with ctest: the test runner never runs them. The
+# binary goes to ${YB_BUILD_ROOT}/benchmarks-<dir>/<name>, next to the tests-<dir> directories.
+# The "benchmarks" target builds all of them. To customize process setup or teardown, define the
+# hooks declared in src/yb/util/benchmark_main.h in the benchmark source.
+function(ADD_YB_BENCHMARK REL_BENCHMARK_NAME)
+  cmake_parse_arguments(ARG "" "" "DEPS" ${ARGN})
+  if(ARG_UNPARSED_ARGUMENTS)
+    message(SEND_ERROR "Error: unrecognized arguments: ${ARG_UNPARSED_ARGUMENTS}")
+  endif()
+
+  yb_check_if_test_is_enabled(${REL_BENCHMARK_NAME})
+  if(NOT yb_test_enabled)
+    return()
+  endif()
+
+  set(SOURCE_PATH "${CMAKE_CURRENT_LIST_DIR}/${REL_BENCHMARK_NAME}.cc")
+  if(NOT EXISTS "${SOURCE_PATH}")
+    message(FATAL_ERROR "Benchmark source '${SOURCE_PATH}' does not exist.")
+  endif()
+  GET_TEST_PREFIX_AND_BINARY_NAME(DIR_PREFIX BINARY_NAME ${REL_BENCHMARK_NAME})
+
+  # Benchmarks are test-like executables: keep them out of the executable count and out of
+  # YB_EXECUTABLE_FILTER_RE filtering, like tests.
+  set(YB_ADDING_TEST_EXECUTABLE "TRUE" CACHE INTERNAL "" FORCE)
+  add_executable("${BINARY_NAME}" "${SOURCE_PATH}")
+  set(YB_ADDING_TEST_EXECUTABLE "FALSE" CACHE INTERNAL "" FORCE)
+
+  set_target_properties(${BINARY_NAME}
+    PROPERTIES
+    RUNTIME_OUTPUT_DIRECTORY "${YB_BUILD_ROOT}/benchmarks-${DIR_PREFIX}")
+  target_link_libraries(${BINARY_NAME} yb_benchmark_main ${ARG_DEPS})
+  add_dependencies(benchmarks ${BINARY_NAME})
+endfunction()
+
+# Builds every benchmark added with ADD_YB_BENCHMARK. Created unconditionally so that
+# `--target benchmarks` works, and builds nothing, when tests are disabled or filtered out.
+add_custom_target(benchmarks)
+
 function(ADD_YB_FUZZ_TARGET REL_TEST_NAME)
   if(NOT YB_BUILD_FUZZ_TARGETS)
     return()
```

**File**: `src/AGENTS.md` (modified, +12/-0)
```diff
@@ -194,6 +194,18 @@ To run tests:
 
 Run one test per execution; do not use a `--gtest_filter` that matches more than one test.
 
+### C++ Microbenchmarks
+
+Microbenchmarks use google/benchmark and are added with `ADD_YB_BENCHMARK` (see
+`src/yb/util/mutex-benchmark.cc` for an example). The test runner does not run them, and
+`--cxx-test` does not find them. Build with `--target` (`benchmarks` builds all of them) and run the
+binary directly:
+
+```bash
+./yb_build.sh release --target mutex-benchmark
+build/latest/benchmarks-util/mutex-benchmark --benchmark_filter=AbslMutex
+```
+
 ### Java Tests
 
 ```bash
```

**File**: `src/yb/util/CMakeLists.txt` (modified, +14/-0)
```diff
@@ -362,6 +362,14 @@ if(NOT APPLE)
   target_link_libraries(yb_test_main rt)
 endif()
 
+#######################################
+# yb_benchmark_main
+#######################################
+
+ADD_YB_TEST_LIBRARY(yb_benchmark_main
+                    SRCS benchmark_main.cc
+                    DEPS gbenchmark gflags glog yb_util)
+
 #######################################
 # Unit tests
 #######################################
@@ -535,3 +543,9 @@ YB_TEST_TARGET_LINK_LIBRARIES(pb_util-test proto_container_test_proto)
 
 ADD_YB_TEST(uint_set-test)
 YB_TEST_TARGET_LINK_LIBRARIES(uint_set-test proto_container_test_proto)
+
+#######################################
+# Microbenchmarks
+#######################################
+
+ADD_YB_BENCHMARK(mutex-benchmark DEPS absl)
```

**File**: `src/yb/util/benchmark_main.cc` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+// Copyright (c) YugabyteDB, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
+// in compliance with the License.  You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software distributed under the License
+// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
+// or implied.  See the License for the specific language governing permissions and limitations
+// under the License.
+//
+
+// main() for microbenchmarks added with ADD_YB_BENCHMARK. It runs the benchmarks registered with
+// google/benchmark's BENCHMARK() macros between the BenchmarkInit() and BenchmarkTeardown() hooks
+// declared in benchmark_main.h.
+//
+// --benchmark_* flags and --help go to google/benchmark; all other flags are gflags (use --helpfull
+// to list those). Unlike upstream's BENCHMARK_MAIN(), this does not re-execute the binary with ASLR
+// disabled; run it under `setarch -R` if you want that.
+
+#include "yb/util/benchmark_main.h"
+
+#include <benchmark/benchmark.h>
+
+#include <string>
+#include <string_view>
+#include <vector>
+
+#include "yb/gutil/casts.h"
+#include "yb/gutil/port.h"
+
+#include "yb/util/flags.h"
+#include "yb/util/logging.h"
+
+namespace yb {
+
+namespace {
+
+// Whether gflags takes the next argument as the value of `arg`, i.e. `arg` is "--flag" or "-flag"
+// without "=" for a registered gflag that is not a bool.
+bool TakesSeparateValue(std::string_view arg) {
+  if (!arg.starts_with('-') || arg.find('=') != std::string_view::npos) {
+    return false;
+  }
+  arg.remove_prefix(arg.starts_with("--") ? 2 : 1);
+  google::CommandLineFlagInfo info;
+  return google::GetCommandLineFlagInfo(std::string(arg).c_str(), &info) && info.type != "bool";
+}
+
+} // namespace
+
+bool DefaultBenchmarkInit(int argc, char** argv) {
+  // Both google/benchmark and gflags parse the command line, and each rejects the other's flags.
+  // Give --benchmark_* flags to google/benchmark and everything else to gflags. Splitting also
+  // keeps glog's --v working: google/benchmark defines its own --v and would otherwise consume it.
+  std::vector<char*> benchmark_args = {argv[0]};
+  std::vector<char*> other_args = {argv[0]};
+  for (int i = 1; i < argc; ++i) {
+    std::string_view arg(argv[i]);
+    if (arg.starts_with("--benchmark_") || arg == "--help") {
+      benchmark_args.push_back(argv[i]);
+      continue;
+    }
+    other_args.push_back(argv[i]);
+    // gflags also accepts "--flag value". Keep such a value with its flag, even if the value itself
+    // looks like a --benchmark_* flag.
+    if (i + 1 < argc && TakesSeparateValue(arg)) {
+      other_args.push_back(argv[++i]);
+    }
+  }
+  benchmark_args.push_back(nullptr);
+  other_args.push_back(nullptr);
+
+  int benchmark_argc = narrow_cast<int>(benchmark_args.size() - 1);
+  benchmark::Initialize(&benchmark_argc, benchmark_args.data());
+  if (benchmark::ReportUnrecognizedArguments(benchmark_argc, benchmark_args.data())) {
+    return false;
+  }
+
+  int other_argc = narrow_cast<int>(other_args.size() - 1);
+  char** other_argv = other_args.data();
+  // Parses flags the same way test_main.cc does, including AutoFlag promotion. The per-test flag
+  // overrides in YBTest::SetUp() (e.g. never_fsync) are deliberately not applied.
+  ParseCommandLineFlagsForTests(&other_argc, &other_argv);
+  InitGoogleLoggingSafeBasic(argv[0]);
+  if (other_argc > 1) {
+    LOG(ERROR) << "Unexpected positional argument: " << other_argv[1];
+    return false;
+  }
+  return true;
+}
+
+ATTRIBUTE_WEAK bool BenchmarkInit(int argc, char** argv) {
+  return DefaultBenchmarkInit(argc, argv);
+}
+
+ATTRIBUTE_WEAK void BenchmarkTeardown() {}
+
+} // namespace yb
+
+int main(int argc, char** argv) {
+  google::InstallFailureSignalHandler();
+  if (!yb::BenchmarkInit(argc, argv)) {
+    return 1;
+  }
+  benchmark::RunSpecifiedBenchmarks();
+  yb::BenchmarkTeardown();
+  benchmark::Shutdown();
+  return 0;
+}
```

**File**: `src/yb/util/benchmark_main.h` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// Copyright (c) YugabyteDB, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
+// in compliance with the License.  You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software distributed under the License
+// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
+// or implied.  See the License for the specific language governing permissions and limitations
+// under the License.
+//
+
+// Hooks run by the main() that ADD_YB_BENCHMARK links into every benchmark binary. Both hooks have
+// weak default definitions in benchmark_main.cc; a benchmark binary replaces one by defining it.
+
+#pragma once
+
+namespace yb {
+
+// Runs before any benchmark. Returning false makes main() exit with status 1. The default only
+// calls DefaultBenchmarkInit(); a replacement can call it and then do its own setup.
+bool BenchmarkInit(int argc, char** argv);
+
+// Runs after all benchmarks have finished. The default does nothing.
+void BenchmarkTeardown();
+
+// The default setup: gives --benchmark_* flags and --help to google/benchmark and all other flags
+// to gflags, parses flags the same way tests do, and initializes logging. Returns false on a bad
+// command line.
+bool DefaultBenchmarkInit(int argc, char** argv);
+
+} // namespace yb
```

---

### Incident Patch 11: `120c63bd` (2026-10-01)
**Commit Message**: [#34521] DocDB: Fix TSAN race in MasterHeartbeatITestWithUpgrade.ClearUniverseUuidToRecoverUniverse

Summary:
The test thread wrote the `std::string` flag `FLAGS_TEST_master_universe_uuid` through `ANNOTATE_UNPROTECTED_WRITE` while the master heartbeat thread read it directly in `MasterHeartbeatServiceImpl::ValidateTServerUniverseOrRespond`, so TSAN reported a data race. A string can't be written safely without a lock, and that annotation adds none. Now the master reads the flag with `google::GetCommandLineOption`, and every test write in `master_heartbeat-itest.cc` goes through `SET_FLAG`, including the sibling test `PreventHeartbeatWrongCluster`. Both calls take the gflags registry lock.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh tsan --clang21 --cxx-test master_heartbeat-itest --gtest-filter MasterHeartbeatITestWithUpgrade.ClearUniverseUuidToRecoverUniverse -n 180 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --stop-at-failure) -- with the CSI da

**File**: `src/yb/integration-tests/master_heartbeat-itest.cc` (modified, +4/-4)
```diff
@@ -160,17 +160,17 @@ TEST_F(MasterHeartbeatITest, PreventHeartbeatWrongCluster) {
   // TEST_master_universe_uuid.
   const auto unresponsive_log_waiter_timeout = 20s * kTimeMultiplier;
   StringWaiterLogSink unresponsive_log_waiter("as UNRESPONSIVE: no heartbeat received for");
-  ANNOTATE_UNPROTECTED_WRITE(FLAGS_TEST_master_universe_uuid) = Uuid::Generate().ToString();
+  ASSERT_OK(SET_FLAG(TEST_master_universe_uuid, Uuid::Generate().ToString()));
   ANNOTATE_UNPROTECTED_WRITE(FLAGS_tserver_unresponsive_timeout_ms) = 10 * 1000;
   ASSERT_OK(mini_cluster_->WaitForTabletServerCount(0, true /* live_only */));
   ASSERT_OK(unresponsive_log_waiter.WaitFor(unresponsive_log_waiter_timeout));
 
   // When the flag is unset, ensure that master leader can register tservers.
-  ANNOTATE_UNPROTECTED_WRITE(FLAGS_TEST_master_universe_uuid) = "";
+  ASSERT_OK(SET_FLAG(TEST_master_universe_uuid, ""));
   ASSERT_OK(mini_cluster_->WaitForTabletServerCount(3, true /* live_only */));
 
   // Ensure that state for universe_uuid is persisted across restarts.
-  ANNOTATE_UNPROTECTED_WRITE(FLAGS_TEST_master_universe_uuid) = Uuid::Generate().ToString();
+  ASSERT_OK(SET_FLAG(TEST_master_universe_uuid, Uuid::Generate().ToString()));
   for (int i = 0; i < 3; i++) {
     ASSERT_OK(mini_cluster_->mini_tablet_server(i)->Restart());
   }
@@ -819,7 +819,7 @@ TEST_F(MasterHeartbeatITestWithUpgrade, ClearUniverseUuidToRecoverUniverse) {
   ASSERT_OK(mini_cluster_->WaitForTabletServerCount(3, true /* live_only */));
 
   // Artificially generate a fake universe uuid and propagate that by clearing the universe_uuid.
-  ANNOTATE_UNPROTECTED_WRITE(FLAGS_TEST_master_universe_uuid) = Uuid::Generate().ToString();
+  ASSERT_OK(SET_FLAG(TEST_master_universe_uuid, Uuid::Generate().ToString()));
   ANNOTATE_UNPROTECTED_WRITE(FLAGS_tserver_unresponsive_timeout_ms) = 10 * 1000;
 
   // Heartbeats should first fail due to universe_uuid mismatch.
```

**File**: `src/yb/master/master_heartbeat_service.cc` (modified, +5/-2)
```diff
@@ -1654,9 +1654,12 @@ Status MasterHeartbeatServiceImpl::ValidateTServerUniverseOrRespond(
   }
   auto tserver_universe_uuid = *tserver_universe_uuid_res;
 
+  // Read a locked copy: tests may change this string flag concurrently.
+  std::string test_master_universe_uuid;
+  CHECK(google::GetCommandLineOption("TEST_master_universe_uuid", &test_master_universe_uuid));
   auto master_universe_uuid_res = UniverseUuid::FromString(
-      FLAGS_TEST_master_universe_uuid.empty() ? cluster_config.universe_uuid()
-                                              : FLAGS_TEST_master_universe_uuid);
+      test_master_universe_uuid.empty() ? cluster_config.universe_uuid()
+                                        : test_master_universe_uuid);
   if (!master_universe_uuid_res) {
     LOG(WARNING) << "Could not decode cluster config universe_uuid: "
                  << master_universe_uuid_res.status().ToString();
```

---

### Incident Patch 12: `948a523f` (2026-10-02)
**Commit Message**: [#34575] YSQL: Fix ANALYZE failure in a read-only transaction

Summary:
ANALYZE is allowed in a read-only transaction in native PostgreSQL, but in
YugabyteDB the transaction fails at commit:

yugabyte=# BEGIN READ ONLY; ANALYZE t; COMMIT;
BEGIN
ANALYZE
ERROR:  cannot execute DELETE in a read-only transaction
CONTEXT:  SQL function "yb_increment_db_catalog_version_with_inval_messages" statement 1

The same happens with `SET default_transaction_read_only = on; ANALYZE t;`.

ANALYZE increments the catalog version. When invalidation messages are
enabled (`yb_enable_invalidation_messages`, default true), the increment is
done by calling the SQL function
`yb_increment_db_catalog_version_with_inval_messages` (or
`yb_increment_all_db_catalog_versions_with_inval_messages` for a global
impact DDL). The DELETE/UPDATE/INSERT statements of the function go through
the executor, where `ExecCheckXactReadOnly` rejects them because
`XactReadOnly` is set. The older code path without invalidation messages
updates `pg_yb_catalog_version` directly via pggate and does not hit this
check.

The catalog version increment is an internal side effect of a command that
PostgreSQL already allows in a read-only t

**File**: `src/postgres/src/backend/catalog/yb_catalog/yb_catalog_version.c` (modified, +23/-0)
```diff
@@ -14,6 +14,7 @@
 
 #include "access/htup_details.h"
 #include "access/sysattr.h"
+#include "access/xact.h"
 #include "access/yb_target.h"
 #include "catalog/catalog.h"
 #include "catalog/namespace.h"
@@ -205,11 +206,19 @@ YbCallSQLIncrementCatalogVersions(Oid functionId, bool is_breaking_change,
 
 	/* Save old values and set new values to enable the call. */
 	bool		saved = yb_non_ddl_txn_for_sys_tables_allowed;
+	bool		saved_xact_read_only = XactReadOnly;
 
 	yb_non_ddl_txn_for_sys_tables_allowed = true;
 	Oid			save_userid;
 	int			save_sec_context;
 
+	/*
+	 * See YbCallNewSQLIncrementCatalogVersionHelper. This is only defensive
+	 * here: this function is used for a global-impact DDL, and no command
+	 * known to be allowed in a read-only transaction (e.g. ANALYZE) is a
+	 * global-impact DDL.
+	 */
+	XactReadOnly = false;
 	GetUserIdAndSecContext(&save_userid, &save_sec_context);
 	SetUserIdAndSecContext(BOOTSTRAP_SUPERUSERID,
 						   SECURITY_RESTRICTED_OPERATION);
@@ -241,6 +250,7 @@ YbCallSQLIncrementCatalogVersions(Oid functionId, bool is_breaking_change,
 		FunctionCallInvoke(fcinfo);
 		/* Restore old values. */
 		yb_non_ddl_txn_for_sys_tables_allowed = saved;
+		XactReadOnly = saved_xact_read_only;
 		yb_is_calling_internal_sql_for_ddl = false;
 		SetUserIdAndSecContext(save_userid, save_sec_context);
 		if (!snapshot_set)
@@ -250,6 +260,7 @@ YbCallSQLIncrementCatalogVersions(Oid functionId, bool is_breaking_change,
 	{
 		/* Restore old values. */
 		yb_non_ddl_txn_for_sys_tables_allowed = saved;
+		XactReadOnly = saved_xact_read_only;
 		yb_is_calling_internal_sql_for_ddl = false;
 		SetUserIdAndSecContext(save_userid, save_sec_context);
 		if (!snapshot_set)
@@ -340,6 +351,7 @@ YbCallNewSQLIncrementCatalogVersionHelper(Oid functionId,
 
 	/* Save old values and set new values to enable the call. */
 	bool		saved = yb_non_ddl_txn_for_sys_tables_allowed;
+	bool		saved_xact_read_only = XactReadOnly;
 
 	yb_non_ddl_txn_for_sys_tables_allowed = true;
 	bool		saved_enable_seqscan = enable_seqscan;
@@ -353,6 +365,15 @@ YbCallNewSQLIncrementCatalogVersionHelper(Oid functionId,
 	Oid			save_userid;
 	int			save_sec_context;
 
+	/*
+	 * Commands that are allowed in a read-only transaction, such as ANALYZE,
+	 * can also increment the catalog version. The SQL function used to do so
+	 * is an internal implementation detail that must not be rejected by the
+	 * executor's read-only transaction check. Only the PG-level XactReadOnly
+	 * is cleared: the pggate transaction state is left as is, and is the same
+	 * as for the catalog writes the command itself has already done.
+	 */
+	XactReadOnly = false;
 	GetUserIdAndSecContext(&save_userid, &save_sec_context);
 	SetUserIdAndSecContext(BOOTSTRAP_SUPERUSERID,
 						   SECURITY_RESTRICTED_OPERATION);
@@ -370,6 +391,7 @@ YbCallNewSQLIncrementCatalogVersionHelper(Oid functionId,
 
 		/* Restore old values. */
 		yb_non_ddl_txn_for_sys_tables_allowed = saved;
+		XactReadOnly = saved_xact_read_only;
 		yb_is_calling_internal_sql_for_ddl = false;
 		enable_seqscan = saved_enable_seqscan;
 		SetUserIdAndSecContext(save_userid, save_sec_context);
@@ -396,6 +418,7 @@ YbCallNewSQLIncrementCatalogVersionHelper(Oid functionId,
 	{
 		/* Restore old values. */
 		yb_non_ddl_txn_for_sys_tables_allowed = saved;
+		XactReadOnly = saved_xact_read_only;
 		yb_is_calling_internal_sql_for_ddl = false;
 		enable_seqscan = saved_enable_seqscan;
 		SetUserIdAndSecContext(save_userid, save_sec_context);
```

**File**: `src/postgres/src/test/regress/expected/yb.orig.analyze.out` (modified, +79/-0)
```diff
@@ -302,3 +302,82 @@ SELECT relname, attname, reltuples, stadistinct, stanullfrac
 (21 rows)
 
 DROP TABLE t_part;
+-- ANALYZE is allowed in a read-only transaction, including the catalog version
+-- increment it performs.
+\set db_oid 'CASE WHEN (SELECT count(*) FROM pg_yb_catalog_version) = 1 THEN 1 ELSE (SELECT oid FROM pg_database WHERE datname = current_database()) END'
+\set get_version 'SELECT current_version AS version_before FROM pg_yb_catalog_version WHERE db_oid = :db_oid'
+\set check_version 'SELECT current_version > :version_before AS version_incremented FROM pg_yb_catalog_version WHERE db_oid = :db_oid'
+CREATE TABLE t_read_only (a int);
+INSERT INTO t_read_only SELECT generate_series(1, 10);
+:get_version \gset
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+ version_incremented 
+---------------------
+ t
+(1 row)
+
+SELECT reltuples FROM pg_class WHERE relname = 't_read_only';
+ reltuples 
+-----------
+        10
+(1 row)
+
+:get_version \gset
+SET default_transaction_read_only = on;
+ANALYZE t_read_only;
+RESET default_transaction_read_only;
+:check_version;
+ version_incremented 
+---------------------
+ t
+(1 row)
+
+-- In a SERIALIZABLE READ ONLY transaction, DocDB uses snapshot isolation.
+:get_version \gset
+BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+ version_incremented 
+---------------------
+ t
+(1 row)
+
+-- A read-only transaction uses follower reads when they are enabled. Wait
+-- longer than the staleness so that the stale read sees the table data.
+SET yb_read_from_followers = on;
+SET yb_follower_read_staleness_ms = 1000;
+SELECT pg_sleep(2);
+ pg_sleep 
+----------
+ 
+(1 row)
+
+:get_version \gset
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+ version_incremented 
+---------------------
+ t
+(1 row)
+
+RESET yb_follower_read_staleness_ms;
+RESET yb_read_from_followers;
+-- Other writes are still rejected in a read-only transaction.
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+INSERT INTO t_read_only VALUES (11);
+ERROR:  cannot execute INSERT in a read-only transaction
+ROLLBACK;
+SELECT count(*) FROM t_read_only;
+ count 
+-------
+    10
+(1 row)
+
+DROP TABLE t_read_only;
```

**File**: `src/postgres/src/test/regress/sql/yb.orig.analyze.sql` (modified, +49/-0)
```diff
@@ -176,3 +176,52 @@ SELECT relname, attname, reltuples, stadistinct, stanullfrac
     ORDER BY starelid, attnum;
 
 DROP TABLE t_part;
+
+-- ANALYZE is allowed in a read-only transaction, including the catalog version
+-- increment it performs.
+\set db_oid 'CASE WHEN (SELECT count(*) FROM pg_yb_catalog_version) = 1 THEN 1 ELSE (SELECT oid FROM pg_database WHERE datname = current_database()) END'
+\set get_version 'SELECT current_version AS version_before FROM pg_yb_catalog_version WHERE db_oid = :db_oid'
+\set check_version 'SELECT current_version > :version_before AS version_incremented FROM pg_yb_catalog_version WHERE db_oid = :db_oid'
+CREATE TABLE t_read_only (a int);
+INSERT INTO t_read_only SELECT generate_series(1, 10);
+:get_version \gset
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+SELECT reltuples FROM pg_class WHERE relname = 't_read_only';
+
+:get_version \gset
+SET default_transaction_read_only = on;
+ANALYZE t_read_only;
+RESET default_transaction_read_only;
+:check_version;
+
+-- In a SERIALIZABLE READ ONLY transaction, DocDB uses snapshot isolation.
+:get_version \gset
+BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+
+-- A read-only transaction uses follower reads when they are enabled. Wait
+-- longer than the staleness so that the stale read sees the table data.
+SET yb_read_from_followers = on;
+SET yb_follower_read_staleness_ms = 1000;
+SELECT pg_sleep(2);
+:get_version \gset
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+COMMIT;
+:check_version;
+RESET yb_follower_read_staleness_ms;
+RESET yb_read_from_followers;
+
+-- Other writes are still rejected in a read-only transaction.
+BEGIN READ ONLY;
+ANALYZE t_read_only;
+INSERT INTO t_read_only VALUES (11);
+ROLLBACK;
+SELECT count(*) FROM t_read_only;
+
+DROP TABLE t_read_only;
```

---

### Incident Patch 13: `9dbda8be` (2026-09-22)
**Commit Message**: [#33820] docdb: Fix status tablets in CREATING state resulting in user-facing error

Summary:
There are a few cases today where the presence of a status tablet in CREATING state can
result in a user-facing error like:
```
FATAL:  Tablet fe7cc8cae9b9488e9883e117dffc56e4 not running (CREATING/Sending initial creation of tablet)
```
or
```
LookupByIdRpc(tablet: 384402fab9f2456fb9c6ed7623108ba5, num_attempts: 1) failed: Tablet 384402fab9f2456fb9c6ed7623108ba5 not running (CREATING/Sending initial creation of tablet)
```

1. If this is a tablet for the global transaction status table (system.transactions), the presence
   of any such tablet causes all GetTransactionStatusTablet RPCs to fail. This effectively causes
   an outage until all tablets are running.

   This can be triggered by automatic or manual addition of transaction tablets as well, so is not
   limited to when the transaction table is created.

2. If this is a tablet for a local transaction status table, the GetTransactionStatusTablet RPC
   does not fail today. Non-running tablets are normally filtered out by the local tablet filter
   (since no TServer leads such a tablet, it's never preferred). But if there are insuffi

**File**: `src/yb/client/transaction_manager.cc` (modified, +5/-1)
```diff
@@ -49,6 +49,9 @@ DEFINE_test_flag(string, transaction_manager_preferred_tablet, "",
                  "For testing only. If non-empty, transaction manager will try to use the status "
                  "tablet with id matching this flag, if present in the list of status tablets.");
 
+DEFINE_test_flag(bool, transaction_manager_disable_local_filter, false,
+                 "Disable filter for using locally-led transaction status tablets.");
+
 METRIC_DEFINE_counter(server, transaction_promotions,
                       "Number of transactions being promoted to global transactions",
                       yb::MetricUnit::kTransactions,
@@ -210,7 +213,8 @@ class TransactionTableState {
       callback(FLAGS_TEST_transaction_manager_preferred_tablet);
       return true;
     }
-    if (local_tablet_filter_) {
+    if (PREDICT_TRUE(!FLAGS_TEST_transaction_manager_disable_local_filter) &&
+        local_tablet_filter_) {
       std::vector<const TabletId*> ids;
       ids.reserve(tablets.size());
       for (const auto& id : tablets) {
```

**File**: `src/yb/integration-tests/cql_geo_transactions-test.cc` (modified, +10/-2)
```diff
@@ -32,6 +32,7 @@ DECLARE_int32(load_balancer_max_concurrent_adds);
 DECLARE_int32(load_balancer_max_concurrent_removals);
 DECLARE_int32(load_balancer_max_concurrent_moves);
 DECLARE_int32(load_balancer_max_concurrent_moves_per_table);
+DECLARE_int32(transaction_table_num_tablets);
 DECLARE_int32(TEST_nodes_per_cloud);
 DECLARE_string(placement_cloud);
 DECLARE_string(placement_region);
@@ -110,7 +111,7 @@ class CqlGeoTransactionsTest: public CqlTestBase<MiniCluster> {
     MakePlacementInfo(replication_info.mutable_live_replicas(), region);
     ASSERT_OK(client_->CreateTransactionsStatusTable(name, &replication_info));
 
-    WaitForStatusTabletsVersion(current_version + 1);
+    WaitForStatusTabletsVersionForCreate(current_version);
   }
 
   void SetupTables() {
@@ -131,7 +132,7 @@ class CqlGeoTransactionsTest: public CqlTestBase<MiniCluster> {
     }
 
     // Wait for system.transactions to be created.
-    WaitForStatusTabletsVersion(1);
+    WaitForStatusTabletsVersionForCreate(0);
   }
 
   void WaitForStatusTabletsVersion(uint64_t version) {
@@ -143,6 +144,13 @@ class CqlGeoTransactionsTest: public CqlTestBase<MiniCluster> {
         strings::Substitute(error, version)));
   }
 
+  uint64_t WaitForStatusTabletsVersionForCreate(uint64_t current_version) {
+    // 1 status table + its tablets.
+    current_version += 1 + FLAGS_transaction_table_num_tablets;
+    WaitForStatusTabletsVersion(current_version);
+    return current_version;
+  }
+
   void WaitForLoadBalanceCompletion() {
     ASSERT_OK(WaitFor([&]() -> Result<bool> {
       bool is_idle = VERIFY_RESULT(client_->IsLoadBalancerIdle());
```

**File**: `src/yb/integration-tests/xcluster/xcluster_ysql-test.cc` (modified, +6/-4)
```diff
@@ -1010,7 +1010,9 @@ TEST_F(XClusterYSqlTestConsistentTransactionsTest, UnevenTxnStatusTablets) {
     ASSERT_OK(DeleteUniverseReplication());
   };
 
-  int producer_version = 1, consumer_version = 1;
+  // 1 for system.transaction, plus 1 for each of its tablets (1 per tserver).
+  uint64_t producer_version = 1 + 3;
+  uint64_t consumer_version = 1 + 3;
 
   // Keep same tablet count for normal tablets.
   ASSERT_OK(CreateClusterAndTable());
@@ -1019,7 +1021,7 @@ TEST_F(XClusterYSqlTestConsistentTransactionsTest, UnevenTxnStatusTablets) {
   auto global_txn_table_id =
       ASSERT_RESULT(client::GetTableId(producer_client(), producer_transaction_table_name));
   ASSERT_OK(producer_client()->AddTransactionStatusTablet(global_txn_table_id));
-  wait_for_txn_status_version(producer_cluster(), ++producer_version);
+  ASSERT_NO_FATALS(wait_for_txn_status_version(producer_cluster(), ++producer_version));
 
   LOG(INFO) << "First run, more txn tablets on producer.";
   ASSERT_OK(SetupReplicationAndWaitForValidSafeTime());
@@ -1036,9 +1038,9 @@ TEST_F(XClusterYSqlTestConsistentTransactionsTest, UnevenTxnStatusTablets) {
   global_txn_table_id =
       ASSERT_RESULT(client::GetTableId(consumer_client(), producer_transaction_table_name));
   ASSERT_OK(consumer_client()->AddTransactionStatusTablet(global_txn_table_id));
-  wait_for_txn_status_version(consumer_cluster(), ++consumer_version);
+  ASSERT_NO_FATALS(wait_for_txn_status_version(consumer_cluster(), ++consumer_version));
   ASSERT_OK(consumer_client()->AddTransactionStatusTablet(global_txn_table_id));
-  wait_for_txn_status_version(consumer_cluster(), ++consumer_version);
+  ASSERT_NO_FATALS(wait_for_txn_status_version(consumer_cluster(), ++consumer_version));
 
   ASSERT_OK(WaitForReadOnlyModeOnAllTServers(
       consumer_table_->name().namespace_id(), /*is_read_only=*/false));
```

**File**: `src/yb/master/catalog_manager.cc` (modified, +21/-7)
```diff
@@ -5611,9 +5611,6 @@ Status CatalogManager::AddTransactionStatusTablet(
   write_lock.Commit();
   TRACE("Wrote table to system table");
 
-  // Increment transaction status version if needed.
-  RETURN_NOT_OK(IncrementTransactionTablesVersion());
-
   DVLOG(3) << __PRETTY_FUNCTION__ << " Done.";
   return Status::OK();
 }
@@ -5698,6 +5695,18 @@ Result<TableInfoPtr> CatalogManager::GetGlobalTransactionStatusTable() {
   return FindTable(global_txn_table_identifier);
 }
 
+bool CatalogManager::CheckTransactionStatusTabletUsable(const TabletInfoPtr& tablet) {
+  TabletLocationsPB locs_pb;
+  if (auto status = BuildLocationsForTablet(tablet, &locs_pb); status.ok()) {
+    // Only use running tablets.
+    return true;
+  } else {
+    LOG(WARNING) << "Transaction status tablet " << tablet->tablet_id() << " not currently usable: "
+                 << status;
+    return false;
+  }
+}
+
 Status CatalogManager::GetGlobalTransactionStatusTablets(
     GetTransactionStatusTabletsResponsePB* resp) {
   auto global_txn_table = VERIFY_RESULT(GetGlobalTransactionStatusTable());
@@ -5706,9 +5715,9 @@ Status CatalogManager::GetGlobalTransactionStatusTablets(
   RETURN_NOT_OK(CatalogManagerUtil::CheckIfTableDeletedOrNotVisibleToClient(l, resp));
 
   for (const auto& tablet : VERIFY_RESULT(global_txn_table->GetTablets())) {
-    TabletLocationsPB locs_pb;
-    RETURN_NOT_OK(BuildLocationsForTablet(tablet, &locs_pb));
-    resp->add_global_tablet_id(tablet->tablet_id());
+    if (CheckTransactionStatusTabletUsable(tablet)) {
+      resp->add_global_tablet_id(tablet->tablet_id());
+    }
   }
 
   return Status::OK();
@@ -5810,7 +5819,12 @@ Status CatalogManager::GetPlacementLocalTransactionStatusTablets(
       }
       auto tablets = VERIFY_RESULT(table_info.table->GetTablets());
       auto tablet_ids =
-          tablets | std::views::transform([](const auto& t) { return t->tablet_id(); });
+          tablets
+              | std::views::filter([this](auto& tablet) {
+                  return CheckTransactionStatusTabletUsable(tablet);
+                })
+              | std::views::transform([](const auto& tablet) { return tablet->tablet_id(); })
+              | std::ranges::to<std::vector>();
       if (table_info.is_region_local) {
         resp->mutable_region_local_tablet_id()->Add(tablet_ids.begin(), tablet_ids.end());
       }
```

**File**: `src/yb/master/catalog_manager.h` (modified, +2/-0)
```diff
@@ -2976,6 +2976,8 @@ class CatalogManager : public CatalogManagerIf, public SnapshotCoordinatorContex
       rpc::RpcContext* rpc, const TablespaceId& tablespace_id, const LeaderEpoch& epoch)
       EXCLUDES(mutex_);
 
+  bool CheckTransactionStatusTabletUsable(const TabletInfoPtr& tablet);
+
   // Get tablet ids of the global transaction status table.
   Status GetGlobalTransactionStatusTablets(
       GetTransactionStatusTabletsResponsePB* resp) EXCLUDES(mutex_);
```

**File**: `src/yb/master/master_heartbeat_service.cc` (modified, +13/-1)
```diff
@@ -1085,7 +1085,19 @@ Status MasterHeartbeatServiceImpl::ProcessTabletReportBatch(
 
   // Update the table state if all its tablets are now running.
   for (auto& [table_id, tablets] : new_running_tablets) {
-    catalog_manager_->SchedulePostTabletCreationTasks(table_info_map[table_id], epoch, tablets);
+    const auto& table_info = table_info_map[table_id];
+    catalog_manager_->SchedulePostTabletCreationTasks(table_info, epoch, tablets);
+
+    // If this is a transaction status tablet, we need to bump the transaction table versions so
+    // that tservers update their cache of usable status tablets to include this tablet.
+    // We do one incrment per status tablet here for easier testing even though one increment total
+    // is sufficient. Transaction status creations are rare, so this should not be an issue.
+    if (table_info->GetTableType() == TRANSACTION_STATUS_TABLE_TYPE) {
+      WARN_NOT_OK(
+          catalog_manager_->IncrementTransactionTablesVersion(),
+          "Failed to increment transaction status version, transaction status tablet may not be "
+          "usable until next increment");
+    }
   }
 
   // Update the relevant tablet entries in system.partitions.
```

**File**: `src/yb/tools/yb-admin-test.cc` (modified, +115/-0)
```diff
@@ -2694,6 +2694,121 @@ TEST_F(AdminCliTest, AddTransactionStatusTablet) {
   }, kWaitNewTabletReadyTimeout, "Timeout waiting for new status tablet to be ready"));
 }
 
+class AddTransactionTabletTest : public AdminCliTest {
+ public:
+  void UpdateMiniClusterOptions(ExternalMiniClusterOptions* options) override {
+    options->transaction_table_num_tablets = 1;
+  }
+
+  void WaitForTransactionTabletCount(
+      std::string_view txn_table, int64_t expected_count, MonoDelta timeout = 20s) {
+    int64_t num_tablets;
+    ASSERT_OK(WaitFor([&] -> Result<bool> {
+      auto tablets = VERIFY_RESULT(CallAdmin(
+          "list_tablets", master::kSystemNamespaceName, std::string(txn_table)));
+      // -1 to exclude table header.
+      num_tablets = std::count(tablets.begin(), tablets.end(), '\n') - 1;
+      LOG(INFO) << "Tablets: " << AsString(tablets);
+      return num_tablets >= expected_count;
+    }, timeout, "Timeout waiting for status tablet count"));
+    ASSERT_EQ(num_tablets, expected_count);
+  }
+};
+
+TEST_F_EX(AdminCliTest, AddStuckTransactionStatusTablet, AddTransactionTabletTest) {
+  constexpr auto kNamespaceName = "test_namespace";
+  constexpr auto kTableName = "test_table";
+  constexpr auto kLocalTransactionTableName = "transactions_local";
+
+  ANNOTATE_UNPROTECTED_WRITE(FLAGS_num_tablet_servers) = 1;
+  ANNOTATE_UNPROTECTED_WRITE(FLAGS_num_replicas) = 1;
+
+  BuildAndStart(/*ts_flags=*/{
+    "--ycql_use_local_transaction_tables=true",
+    "--TEST_transaction_manager_disable_local_filter=true",
+  }, /*master_flags=*/{
+    "--autoscale_transaction_tables=false",
+    "--tablet_creation_timeout_ms=10000",
+  });
+
+  string master_address = ToString(cluster_->master()->bound_rpc_addr());
+  auto client = ASSERT_RESULT(YBClientBuilder().add_master_server_addr(master_address).Build());
+
+  // Force creation of system.transactions.
+  auto session = ASSERT_RESULT(CqlConnect());
+  ASSERT_OK(session.ExecuteQueryFormat(
+      "CREATE KEYSPACE IF NOT EXISTS $0", kNamespaceName));
+  ASSERT_OK(session.ExecuteQueryFormat("USE $0", kNamespaceName));
+  ASSERT_OK(session.ExecuteQueryFormat(
+      "CREATE TABLE $0 (key INT PRIMARY KEY) "
+      "WITH transactions = { 'enabled' : true }", kTableName));
+
+  auto global_txn_table = YBTableName(
+      YQL_DATABASE_CQL, master::kSystemNamespaceName, kGlobalTransactionsTableName);
+  auto global_txn_table_id = ASSERT_RESULT(client::GetTableId(client_.get(), global_txn_table));
+  ASSERT_NO_FATALS(WaitForTransactionTabletCount(kGlobalTransactionsTableName, /*count=*/1));
+
+  // We create a transaction tablet that gets stuck in CREATING (for tablet_creation_timeout_ms) by
+  // adding the tablet after shutting down all tservers, and then restarting everything once create
+  // tablet RPCs start failing (see #33820).
+  // If this behavior is changed in the future, this test should be changed to create such a tablet
+  // by some other means.
+  cluster_->tablet_server(0)->Shutdown();
+  {
+    ASSERT_OK(CallAdmin("add_transaction_tablet", global_txn_table_id));
+    auto log_waiter = cluster_->GetMasterLogWaiter(
+        Format("Processing pending assignments for table: $0", global_txn_table_id));
+    ASSERT_OK(log_waiter.WaitFor(5s));
+  }
+  cluster_->master()->Shutdown(SafeShutdown::kFalse);
+  ASSERT_OK(cluster_->Restart());
+
+  auto do_inserts = [&](size_t start, size_t end) -> Status {
+    for (size_t i = 0; i < 10; ++i) {
+      RETURN_NOT_OK(session.ExecuteQueryFormat(
+          "START TRANSACTION;"
+          "INSERT INTO $0.$1(key) VALUES ($2);"
+          "COMMIT",
+          kNamespaceName, kTableName, i));
+    }
+    return Status::OK();
+  };
+
+  ASSERT_NO_FATALS(WaitForTransactionTabletCount(kGlobalTransactionsTableName, /*count=*/1));
+  session = ASSERT_RESULT(CqlConnect());
+  ASSERT_OK(do_inserts(0, 10));
+  ASSERT_NO_FATALS(WaitForTransactionTabletCount(kGlobalTransactionsTableName, /*count=*/2));
+  ASSERT_OK(do_inserts(10, 20));
+
+  ASSERT_OK(CallAdmin("create_transaction_table", kLocalTransactionTableName));
+  ASSERT_OK(CallAdmin(
+      "modify_table_placement_info", kNamespaceName, kTableName,
+      "cloud1.datacenter1.rack1", "1"));
+  ASSERT_OK(CallAdmin(
+      "modify_table_placement_info", master::kSystemNamespaceName, kLocalTransactionTableName,
+      "cloud1.datacenter1.rack1", "1"));
+  auto local_txn_table = YBTableName(
+      YQL_DATABASE_CQL, master::kSystemNamespaceName, kLocalTransactionTableName);
+  auto local_txn_table_id = ASSERT_RESULT(client::GetTableId(client_.get(), local_txn_table));
+  ASSERT_NO_FATALS(WaitForTransactionTabletCount(kLocalTransactionTableName, /*count=*/1));
+
+  cluster_->tablet_server(0)->Shutdown();
+  {
+    auto log_waiter = cluster_->GetMasterLogWaiter(
+        Format("Processing pending assignments for table: $0", local_txn_table_id));
+    ASSERT_OK(CallAdmin("add_transaction_tablet", local_txn_table_id));
+    ASSERT_OK(log_waiter.WaitFor(5s));
+  }
+  cluster_->
```

**File**: `src/yb/yql/pgwrapper/geo_transactions-test.cc` (modified, +8/-9)
```diff
@@ -98,8 +98,7 @@ class GeoTransactionsTest : public GeoTransactionsTestBase {
 
       WaitForLoadBalanceCompletion();
       if (wait_for_version) {
-        WaitForStatusTabletsVersion(current_version + 1);
-        ++current_version;
+        current_version = WaitForStatusTabletsVersionForCreate(current_version);
       }
     }
   }
@@ -333,7 +332,7 @@ class GeoTransactionsTest : public GeoTransactionsTestBase {
           ]
         }')
     )#"));
-    WaitForStatusTabletsVersion(current_version + num_tablespaces);
+    WaitForStatusTabletsVersionForCreate(current_version, num_tablespaces);
     return Status::OK();
   }
 
@@ -738,7 +737,7 @@ TEST_F(GeoTransactionsTest, TestTransactionTableDeletionRemoteAbort) {
 
     auto current_version = GetCurrentVersion();
     ANNOTATE_UNPROTECTED_WRITE(FLAGS_auto_create_local_transaction_tables) = true;
-    WaitForStatusTabletsVersion(current_version + 1);
+    WaitForStatusTabletsVersionForCreate(current_version);
   }
 }
 
@@ -802,7 +801,7 @@ TEST_F(GeoTransactionsTest, YB_DISABLE_TEST_IN_TSAN(TestPreferredZone)) {
   auto tablet_uuid_set = ListTabletIdsForTable(cluster_.get(), table_id);
   auto table_uuids = std::vector<TabletId>(tablet_uuid_set.begin(), tablet_uuid_set.end());
 
-  WaitForStatusTabletsVersion(++current_version);
+  current_version = WaitForStatusTabletsVersionForCreate(current_version);
   WaitForLoadBalanceCompletion();
 
   auto status_tablet_ids = ASSERT_RESULT(GetStatusTablets(1, ExpectedLocality::kLocal));
@@ -811,7 +810,7 @@ TEST_F(GeoTransactionsTest, YB_DISABLE_TEST_IN_TSAN(TestPreferredZone)) {
 
   ASSERT_OK(conn.ExecuteFormat("ALTER TABLE $0 SET TABLESPACE tablespace2", table_name));
 
-  WaitForStatusTabletsVersion(++current_version);
+  current_version = WaitForStatusTabletsVersionForCreate(current_version);
   WaitForLoadBalanceCompletion();
 
   status_tablet_ids = ASSERT_RESULT(GetStatusTablets(2, ExpectedLocality::kLocal));
@@ -1136,14 +1135,14 @@ class GeoTransactionsTablespaceLocalityTest : public GeoTransactionsTest {
         CREATE TABLE $1(value int REFERENCES $2(value))
         TABLESPACE $0
     )#", kTablespace1, kTableNameFK, kTableName));
-    WaitForStatusTabletsVersion(version + 1);
+    version = WaitForStatusTabletsVersionForCreate(version);
 
     // Dummy table to create transaction tables.
     ASSERT_OK(conn.ExecuteFormat(R"#(
         CREATE TABLE __$0_dummy_table(value int)
         TABLESPACE $0
     )#", kTablespace2));
-    WaitForStatusTabletsVersion(version + 2);
+    version = WaitForStatusTabletsVersionForCreate(version);
     WaitForLoadBalanceCompletion();
   }
 };
@@ -1505,7 +1504,7 @@ class GeoTransactionsMultiTabletTest : public GeoTransactionsTest {
           SPLIT INTO 3 TABLETS
       )#", kTablespace, kTableNamePrefix, i));
     }
-    WaitForStatusTabletsVersion(version + 1);
+    WaitForStatusTabletsVersionForCreate(version);
   }
 };
 
```

---

### Incident Patch 14: `76216fc3` (2026-10-01)
**Commit Message**: [PLAT-22752] [YBA] Earlyoom can't lock its memory on YBA-provisioned nodes

Summary: Increase lock limit for earlyoom installation

Test Plan: provision nodes with earlyoom, verify no "Could not lock memory - continuing anyway" in earlyoom log

Reviewers: amalyshev, anijhawan

Reviewed By: amalyshev

Subscribers: yugaware

Differential Revision: https://phorge.dev.yugabyte.com/D58863

**File**: `managed/node-agent/resources/earlyoom-installer.sh` (modified, +4/-4)
```diff
@@ -30,12 +30,12 @@ main() {
   if [ "$SUDO_ACCESS" = "true" ]; then
     # Setting Memlock limits for earlyoom
     # Check and set DefaultLimitMEMLOCK in /etc/systemd/system.conf
-    if ! sudo grep -q "^DefaultLimitMEMLOCK=500000" /etc/systemd/system.conf; then
-        echo 'DefaultLimitMEMLOCK=500000' | sudo tee -a /etc/systemd/system.conf
+    if ! sudo grep -q "^DefaultLimitMEMLOCK=50M" /etc/systemd/system.conf; then
+        echo 'DefaultLimitMEMLOCK=50M' | sudo tee -a /etc/systemd/system.conf
     fi
     # Check and set DefaultLimitMEMLOCK in /etc/systemd/user.conf
-    if ! sudo grep -q "^DefaultLimitMEMLOCK=500000" /etc/systemd/user.conf; then
-        echo 'DefaultLimitMEMLOCK=500000' | sudo tee -a /etc/systemd/user.conf
+    if ! sudo grep -q "^DefaultLimitMEMLOCK=50M" /etc/systemd/user.conf; then
+        echo 'DefaultLimitMEMLOCK=50M' | sudo tee -a /etc/systemd/user.conf
     fi
   fi
 
```

**File**: `managed/node-agent/resources/ynp/modules/provision/configure_os/templates/run.j2` (modified, +2/-2)
```diff
@@ -201,10 +201,10 @@ echo "systemd-journald restarted successfully."
 
 # For earlyoom MEMLOCK requirement
 if ! grep -q "^DefaultLimitMEMLOCK=" /etc/systemd/system.conf; then
-    echo 'DefaultLimitMEMLOCK=500000' | tee -a /etc/systemd/system.conf
+    echo 'DefaultLimitMEMLOCK=50M' | tee -a /etc/systemd/system.conf
 fi
 if ! grep -q "^DefaultLimitMEMLOCK=" /etc/systemd/user.conf; then
-    echo 'DefaultLimitMEMLOCK=500000' | tee -a /etc/systemd/user.conf
+    echo 'DefaultLimitMEMLOCK=50M' | tee -a /etc/systemd/user.conf
 fi
 
 # Enable linger for user-level systemd services
```

**File**: `managed/node-agent/resources/ynp/modules/provision/install_configure_earlyoom/templates/precheck.j2` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 systemd_dir="{{ yb_user_home }}/.config/systemd/user"
 config_dir="{{ yb_home_dir }}/bin"
-if grep -q "DefaultLimitMEMLOCK=500000" "/etc/systemd/system.conf"; then
+if grep -q "DefaultLimitMEMLOCK=50M" "/etc/systemd/system.conf"; then
     echo "[PASS] DefaultLimitMEMLOCK is set in /etc/systemd/system.conf"
     add_result "DefaultLimitMEMLOCK in /etc/systemd/system.conf" "PASS" \
         "DefaultLimitMEMLOCK is set in /etc/systemd/system.conf"
@@ -9,7 +9,7 @@ else
     add_result "DefaultLimitMEMLOCK in /etc/systemd/system.conf" "FAIL" \
         "DefaultLimitMEMLOCK is not set in /etc/systemd/system.conf. Run with root provisioning first."
 fi
-if grep -q "DefaultLimitMEMLOCK=500000" "/etc/systemd/user.conf"; then
+if grep -q "DefaultLimitMEMLOCK=50M" "/etc/systemd/user.conf"; then
     echo "[PASS] DefaultLimitMEMLOCK is set in /etc/systemd/user.conf"
     add_result "DefaultLimitMEMLOCK in /etc/systemd/user.conf" "PASS" \
         "DefaultLimitMEMLOCK is set in /etc/systemd/user.conf"
```

---

### Incident Patch 15: `637326ac` (2026-10-01)
**Commit Message**: [PLAT-22796] Fix HTTPS to IP-addressed endpoints with BCJSSE on newer JDKs

Summary:
The yugaware image moved from Zulu 17.0.7 to 17.0.20.1 (devops 8166c41). Since then, a HashiCorp Vault KMS config addressed by IP fails with certificate_unknown(46), root cause `No hostname specified for HTTPS endpoint ID check`.

`HttpsURLConnection` creates an unconnected socket and connects it to the resolved address, so the TLS provider never sees the URL host. SunJSSE is given the host through an internal API. BCJSSE isn't, and relied on the SNI the JDK set from the host. Newer JDKs no longer set SNI for IP literals, so BCJSSE has nothing to check the certificate against. Any HttpsURLConnection call to an https://<ip> URL fails this way, including Vault and OIDC. Host names are unaffected. Clients that pass the host themselves (Play WS, OkHttp, Apache HttpClient, java.net.http) are also unaffected.

Fix: new `HostPreservingSSLSocketFactory` wraps a factory and doesn't support unconnected sockets. HttpsURLConnection then falls back to createSocket(socket, host, port, autoClose), which passes the URL host to BCJSSE, so the certificate is checked against the IP itself.

MainModule wraps the JVM d

**File**: `managed/src/main/java/MainModule.java` (modified, +9/-2)
```diff
@@ -66,6 +66,7 @@
 import com.yugabyte.yw.common.alerts.AlertConfigurationWriter;
 import com.yugabyte.yw.common.alerts.AlertsGarbageCollector;
 import com.yugabyte.yw.common.alerts.QueryAlerts;
+import com.yugabyte.yw.common.certmgmt.HostPreservingSSLSocketFactory;
 import com.yugabyte.yw.common.certmgmt.castore.CustomCAStoreManager;
 import com.yugabyte.yw.common.config.CustomerConfKeys;
 import com.yugabyte.yw.common.config.GlobalConfKeys;
@@ -120,6 +121,7 @@
 import java.security.Security;
 import javax.net.ssl.HttpsURLConnection;
 import javax.net.ssl.SSLContext;
+import javax.net.ssl.SSLSocketFactory;
 import javax.net.ssl.TrustManager;
 import javax.net.ssl.TrustManagerFactory;
 import lombok.extern.slf4j.Slf4j;
@@ -237,6 +239,9 @@ public void configure() {
     System.setProperty("org.xerial.snappy.tempdir", snappyTempPath.toAbsolutePath().toString());
 
     TLSConfig.modifyTLSDisabledAlgorithms(config);
+    // After the BC providers and TLS properties are in place, so the default context is BCJSSE's.
+    HttpsURLConnection.setDefaultSSLSocketFactory(
+        HostPreservingSSLSocketFactory.wrap(HttpsURLConnection.getDefaultSSLSocketFactory()));
     bind(RuntimeConfigFactory.class).to(SettableRuntimeConfigFactory.class).asEagerSingleton();
     bind(RuntimeConfigCacheInvalidator.class).asEagerSingleton();
     install(new CustomerConfKeys());
@@ -373,8 +378,10 @@ protected OidcClient provideOidcClient(
           SecureRandom secureRandom = new SecureRandom();
           SSLContext sslContext = SSLContext.getInstance("TLS");
           sslContext.init(null, ybaJavaTrustManagers, secureRandom);
-          HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
-          HTTPRequest.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
+          SSLSocketFactory socketFactory =
+              HostPreservingSSLSocketFactory.wrap(sslContext.getSocketFactory());
+          HttpsURLConnection.setDefaultSSLSocketFactory(socketFactory);
+          HTTPRequest.setDefaultSSLSocketFactory(socketFactory);
         } catch (Exception e) {
           throw new PlatformServiceException(
               INTERNAL_SERVER_ERROR, "Error occurred when building SSL context" + e.getMessage());
```

**File**: `managed/src/main/java/com/yugabyte/yw/common/certmgmt/HostPreservingSSLSocketFactory.java` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+// Copyright (c) YugabyteDB, Inc.
+
+package com.yugabyte.yw.common.certmgmt;
+
+import java.io.IOException;
+import java.net.InetAddress;
+import java.net.Socket;
+import java.security.KeyManagementException;
+import java.security.SecureRandom;
+import javax.net.ssl.KeyManager;
+import javax.net.ssl.SSLContext;
+import javax.net.ssl.SSLContextSpi;
+import javax.net.ssl.SSLEngine;
+import javax.net.ssl.SSLParameters;
+import javax.net.ssl.SSLServerSocketFactory;
+import javax.net.ssl.SSLSessionContext;
+import javax.net.ssl.SSLSocketFactory;
+import javax.net.ssl.TrustManager;
+
+/**
+ * SSLSocketFactory that refuses to create unconnected sockets, so that the TLS socket always learns
+ * the host it is connecting to.
+ *
+ * <p>HttpsURLConnection prefers {@code createSocket()} followed by {@code connect(address)}, which
+ * never passes the URL host to the TLS provider. SunJSSE is told the host through an internal API;
+ * BCJSSE is not, and relied on the SNI the JDK used to set. Newer JDKs (e.g. Zulu 17.0.20) no
+ * longer set SNI for IP literals, so BCJSSE fails endpoint identification for https://<ip> URLs
+ * with "No hostname specified for HTTPS endpoint ID check".
+ *
+ * <p>When {@code createSocket()} throws a SocketException caused by UnsupportedOperationException
+ * (the {@link javax.net.SocketFactory} default, which this class inherits), HttpsURLConnection
+ * falls back to a plain socket layered with {@code createSocket(socket, host, port, autoClose)},
+ * which hands BCJSSE the URL host. This is preferred over
+ * org.bouncycastle.jsse.client.assumeOriginalHostName, which for IP literals verifies against the
+ * reverse-DNS name instead of the IP.
+ */
+public class HostPreservingSSLSocketFactory extends SSLSocketFactory {
+
+  private final SSLSocketFactory delegate;
+
+  public HostPreservingSSLSocketFactory(SSLSocketFactory delegate) {
+    this.delegate = delegate;
+  }
+
+  public static SSLSocketFactory wrap(SSLSocketFactory factory) {
+    if (factory == null || factory instanceof HostPreservingSSLSocketFactory) {
+      return factory;
+    }
+    return new HostPreservingSSLSocketFactory(factory);
+  }
+
+  /** For clients that only accept an SSLContext and call {@code getSocketFactory()} themselves. */
+  public static SSLContext wrap(SSLContext context) {
+    if (context == null) {
+      return null;
+    }
+    return new SSLContext(
+        new HostPreservingSSLContextSpi(context), context.getProvider(), context.getProtocol()) {};
+  }
+
+  @Override
+  public String[] getDefaultCipherSuites() {
+    return delegate.getDefaultCipherSuites();
+  }
+
+  @Override
+  public String[] getSupportedCipherSuites() {
+    return delegate.getSupportedCipherSuites();
+  }
+
+  @Override
+  public Socket createSocket(Socket s, String host, int port, boolean autoClose)
+      throws IOException {
+    return delegate.createSocket(s, host, port, autoClose);
+  }
+
+  @Override
+  public Socket createSocket(String host, int port) throws IOException {
+    return delegate.createSocket(host, port);
+  }
+
+  @Override
+  public Socket createSocket(String host, int port, InetAddress localHost, int localPort)
+      throws IOException {
+    return delegate.createSocket(host, port, localHost, localPort);
+  }
+
+  @Override
+  public Socket createSocket(InetAddress host, int port) throws IOException {
+    return delegate.createSocket(host, port);
+  }
+
+  @Override
+  public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort)
+      throws IOException {
+    return delegate.createSocket(address, port, localAddress, localPort);
+  }
+
+  private static class HostPreservingSSLContextSpi extends SSLContextSpi {
+    private final SSLContext delegate;
+
+    HostPreservingSSLContextSpi(SSLContext delegate) {
+      this.delegate = delegate;
+    }
+
+    @Override
+    protected void engineInit(KeyManager[] km, TrustManager[] tm, SecureRandom sr)
+        throws KeyManagementException {
+      delegate.init(km, tm, sr);
+    }
+
+    @Override
+    protected SSLSocketFactory engineGetSocketFactory() {
+      return wrap(delegate.getSocketFactory());
+    }
+
+    @Override
+    protected SSLServerSocketFactory engineGetServerSocketFactory() {
+      return delegate.getServerSocketFactory();
+    }
+
+    @Override
+    protected SSLEngine engineCreateSSLEngine() {
+      return delegate.createSSLEngine();
+    }
+
+    @Override
+    protected SSLEngine engineCreateSSLEngine(String host, int port) {
+      return delegate.createSSLEngine(host, port);
+    }
+
+    @Override
+    protected SSLSessionContext engineGetServerSessionContext() {
+      return delegate.getServerSessionContext();
+    }
+
+    @Override
+    protected SSLSessionContext engineGetClientSessionContext() {
+      return delegate.getClientSessionContext();
+    }
+
+    // The SSLContextSpi defaults derive these from engineGetSocketFactory().createSocket(), which
+    //
```

**File**: `managed/src/main/java/com/yugabyte/yw/common/kms/util/hashicorpvault/VaultAccessor.java` (modified, +23/-1)
```diff
@@ -20,6 +20,7 @@
 import com.bettercloud.vault.response.LogicalResponse;
 import com.bettercloud.vault.rest.RestResponse;
 import com.yugabyte.yw.common.Util;
+import com.yugabyte.yw.common.certmgmt.HostPreservingSSLSocketFactory;
 import com.yugabyte.yw.common.certmgmt.castore.CustomCAStoreManager;
 import com.yugabyte.yw.common.config.GlobalConfKeys;
 import com.yugabyte.yw.common.config.RuntimeConfGetter;
@@ -33,6 +34,7 @@
 import java.util.List;
 import java.util.Map;
 import java.util.TimeZone;
+import javax.net.ssl.SSLContext;
 import org.apache.commons.lang3.StringUtils;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
@@ -186,7 +188,7 @@ public static VaultConfig customCAStoreConfig(VaultConfig config) throws VaultEx
       LOG.debug("Using YBA's custom trust-store with Java defaults");
       KeyStore ybaJavaKeyStore = customCAStoreManager.getYbaAndJavaKeyStore();
       try {
-        config.sslConfig(new SslConfig().trustStore(ybaJavaKeyStore).build());
+        config.sslConfig(new HostPreservingSslConfig().trustStore(ybaJavaKeyStore).build());
       } catch (VaultException e) {
         LOG.error("Creation of vault with SSL config has failed with error:" + e.getMessage());
         throw e;
@@ -195,6 +197,26 @@ public static VaultConfig customCAStoreConfig(VaultConfig config) throws VaultEx
     return config;
   }
 
+  /**
+   * The driver sets {@code getSslContext().getSocketFactory()} on each HttpsURLConnection,
+   * bypassing the JVM default factory, so it needs its own {@link HostPreservingSSLSocketFactory}.
+   */
+  private static class HostPreservingSslConfig extends SslConfig {
+    private transient SSLContext wrappedContext;
+
+    @Override
+    public synchronized SSLContext getSslContext() {
+      SSLContext context = super.getSslContext();
+      if (context == null) {
+        return null;
+      }
+      if (wrappedContext == null) {
+        wrappedContext = HostPreservingSSLSocketFactory.wrap(context);
+      }
+      return wrappedContext;
+    }
+  }
+
   public void tokenSelfLookupCheck() throws VaultException {
     RestResponse rr = vault.auth().lookupSelf().getRestResponse();
     checkForResponseFailure(rr);
```

**File**: `managed/src/test/java/com/yugabyte/yw/common/certmgmt/HostPreservingSSLSocketFactoryTest.java` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+// Copyright (c) YugabyteDB, Inc.
+
+package com.yugabyte.yw.common.certmgmt;
+
+import static org.junit.Assert.assertArrayEquals;
+import static org.junit.Assert.assertNotNull;
+import static org.junit.Assert.assertNull;
+import static org.junit.Assert.assertSame;
+import static org.junit.Assert.assertThrows;
+import static org.junit.Assert.assertTrue;
+
+import java.net.SocketException;
+import javax.net.ssl.SSLContext;
+import javax.net.ssl.SSLSocketFactory;
+import org.junit.Before;
+import org.junit.Test;
+
+public class HostPreservingSSLSocketFactoryTest {
+
+  private SSLContext context;
+
+  @Before
+  public void setUp() throws Exception {
+    context = SSLContext.getInstance("TLS");
+    context.init(null, null, null);
+  }
+
+  // HttpsURLConnection only falls back to createSocket(socket, host, port, autoClose) on exactly
+  // this exception shape (see sun.net.www.protocol.https.HttpsClient#createSocket).
+  @Test
+  public void testUnconnectedSocketUnsupported() {
+    SSLSocketFactory factory = HostPreservingSSLSocketFactory.wrap(context.getSocketFactory());
+    SocketException e = assertThrows(SocketException.class, factory::createSocket);
+    assertTrue(e.getCause() instanceof UnsupportedOperationException);
+  }
+
+  @Test
+  public void testWrapFactory() {
+    SSLSocketFactory delegate = context.getSocketFactory();
+    SSLSocketFactory factory = HostPreservingSSLSocketFactory.wrap(delegate);
+    assertTrue(factory instanceof HostPreservingSSLSocketFactory);
+    assertSame(factory, HostPreservingSSLSocketFactory.wrap(factory));
+    assertNull(HostPreservingSSLSocketFactory.wrap((SSLSocketFactory) null));
+    assertArrayEquals(delegate.getDefaultCipherSuites(), factory.getDefaultCipherSuites());
+    assertArrayEquals(delegate.getSupportedCipherSuites(), factory.getSupportedCipherSuites());
+  }
+
+  @Test
+  public void testWrapContext() {
+    SSLContext wrapped = HostPreservingSSLSocketFactory.wrap(context);
+    assertTrue(wrapped.getSocketFactory() instanceof HostPreservingSSLSocketFactory);
+    assertSame(context.getProvider(), wrapped.getProvider());
+    // The SSLContextSpi defaults would call the unsupported createSocket().
+    assertNotNull(wrapped.getDefaultSSLParameters());
+    assertNotNull(wrapped.getSupportedSSLParameters());
+    assertNotNull(wrapped.createSSLEngine("127.0.0.1", 443));
+    assertNull(HostPreservingSSLSocketFactory.wrap((SSLContext) null));
+  }
+}
```

#### Recent Merged Pull Requests:
- **PR #34614** (closed): [DO NOT MERGE] agent-k replay of #4624 (thread pool) to test review gotcha (@qvad)
- **PR #34612** (2026-10-05): [BACKPORT 2026.1][AMP-49] YBA: Create the yb_storage database on universe creation behind a global runtime flag (@kv83821-yb)
- **PR #34608** (closed): [#34607] Build: Build only the bottom and top PRs of a stack (@kai-franz)
- **PR #34570** (2026-10-02): [BACKPORT 2025.2][#34361] docdb: Update cache statistics outside of mutex lock (@es1024)
- **PR #34569** (2026-10-02): [BACKPORT 2025.2][#34362] docdb: Simplify rocksdb cache metrics (@es1024)
- **PR #34567** (2026-10-02): [BACKPORT 2026.1][#34361] docdb: Update cache statistics outside of mutex lock (@es1024)
- **PR #34566** (2026-10-02): [BACKPORT 2026.1][#34362] docdb: Simplify rocksdb cache metrics (@es1024)
- **PR #34562** (2026-10-05): [BACKPORT 2026.1][#34258] YSQL: import Save a few bytes per CatCTup. (@kai-franz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
