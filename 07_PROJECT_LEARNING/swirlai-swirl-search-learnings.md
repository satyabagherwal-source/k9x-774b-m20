# Forensic Learning Record (Deep Inspection): swirlai/swirl-search

> **Canonical Artifact**: `07_PROJECT_LEARNING/swirlai-swirl-search-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/swirlai/swirl-search](https://github.com/swirlai/swirl-search))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:36.892Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `swirlai/swirl-search`
- **Description**: AI Search & RAG Without Moving Your Data. Get instant answers from your company's knowledge across 100+ apps while keeping data secure. Deploy in minutes, not months.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 3047 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `DevUtils/fix_csv.py`
```

'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

import argparse
import sys
import os
import csv

module_name = 'fix_csv.py'

##################################################

def main(argv):

    # arguments
    parser = argparse.ArgumentParser(description="Fix CSV file for loading into SQLite3")
    parser.add_argument('filespec', help="path to a csv file to fix")
    parser.add_argument('-d', '--debug', action="store_true", help="provide debugging information")
    parser.add_argument('-o', '--output', help="path to a new csv file - otherwise, _fixed is appended to filespec")
    args = parser.parse_args()

    if not os.path.exists(args.filespec):
        print(f"Error: file not found: {args.filespec}")
        return False

    if not args.filespec.endswith(".csv"):
        print(f"Error: file must be .csv")
        return False

    fi = open(args.filespec, 'U')

    if args.output:
        outfile = args.output
    else:
        outfile = args.filespec[:-4] + '_fixed.csv'

    fo = open(outfile, 'w', encoding='utf-8')

    csv_i = csv.reader(fi)  
    csv_o = csv.writer(fo, quoting=csv.QUOTE_NONNUMERIC)
        
    csv_o.writerows(csv_i)

    # for row in csv_i:
    #     csv_o.writerow(row)
            
    fi.close()
    fo.close()

    print(f"{module_name}: wrote {outfile}")

#############################################    
    
if __name__ == "__main__":
    main(sys.argv)

# end
```

### Core Architecture Module: `DevUtils/index_email_elastic.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

import sys
import csv
import argparse
import os
import dateutil
from dateutil import parser
from elasticsearch import Elasticsearch

##################################################

def main(argv):

    # arguments
    parser = argparse.ArgumentParser(description="Bulk index email in CSV format to elasticsearch/opensearch")
    parser.add_argument('filespec', help="path to the csv file to load")
    parser.add_argument('-e', '--elasticsearch', help="the URL to elasticsearch", default='https://localhost:9200/')
    parser.add_argument('-i', '--index', help="the index to receive the email messages", default='email')
    parser.add_argument('-m', '--max', help="maximum number of rows to index", default=0)
    parser.add_argument('-u', '--username', default='elastic', help="the elastic user, default 'elastic'")
    parser.add_argument('-p', '--password', help="the password for the elastic user")
    parser.add_argument('-v', '--no-verify', help="don't verify certificates", default=False, action="store_true")
    parser.add_argument('-c', '--cacert', help="path to cert file", default=None)

    args = parser.parse_args()

    if not os.path.exists(args.filespec):
        print(f"Error: file not found: {args.filespec}")
        return

    csv.field_size_limit(sys.maxsize)

    f = open(args.filespec, 'r')
    csvr = csv.reader(f, quoting=csv.QUOTE_ALL)
    # Insert path to Elastic cert below
    ca_certs = args.cacert
    no_verify = args.no_verify

    es = Elasticsearch(basic_auth=tuple((args.username, args.password)),
                       hosts=args.elasticsearch,
                       verify_certs=(not no_verify),
                       ca_certs=ca_certs
                       )
    print("Indexing...")

    rows = 0
    for row in csvr:
        if rows == 0:
            rows = 1
            continue
        email = {}
        email['url'] = row[0]
        # process and field the body row[1]
        content = row[1]
        # to do: this might be OS dependent, test on windows might need /r/n or different open incantation
        list_content = content.strip().split('\n')

        body = ""
        flag = False
        for field in list_content:
            if flag:
                body = body + field
                continue
            if field.startswith('Date:'):
                s_date = field[field.find(':')+1:].strip()
                dt = dateutil.parser.parse(s_date)
                email['date_published'] = dt.strftime('%Y-%m-%d %H:%M:%S.%f')
            if field.startswith('Subject:'):
                email['subject'] = field[field.find(':')+1:].strip()
            if field.startswith('To:'):
                email['to'] = field[field.find(':')+1:].strip()
            if field.startswith('X-To:'):
                # overwrite
                email['to'] = field[field.find(':')+1:].strip()
            if field.startswith('From:'):
                email['author'] = field[field.find(':')+1:].strip()
            if field.startswith('X-From:'):
                # overwrite
                email['author'] = field[field.find(':')+1:].strip()
            if field == '':
                # the next one is the body
                flag = True
        # end for
        # create the content field
        email['content'] = body
        res = es.index(index=args.index, document=email)
        rows = rows + 1
        if rows % 100 == 0:
            print(f"Indexed {rows} records so far...")
        if int(args.max) > 0:
            if rows > int(args.max):
                break
    # end for

#############################################

if __name__ == "__main__":
    main(sys.argv)

# end
```

### Core Architecture Module: `DevUtils/index_email_opensearch.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

import sys
import csv
import argparse
import os
from dateutil import parser
from urllib.parse import urlparse
from opensearchpy import OpenSearch

##################################################

def main(argv):

    # arguments
    aparse = argparse.ArgumentParser(description="Bulk index email in CSV format to OpenSearch")
    aparse.add_argument('filespec', help="path to the csv file to load")
    aparse.add_argument('-o', '--opensearch', help="the URL to opensearch", default='http://localhost:9200/')
    aparse.add_argument('-i', '--index', help="the index to receive the email messages", default='email')
    aparse.add_argument('-m', '--max', help="maximum number of rows to index", default=0)
    aparse.add_argument('-u', '--username', default='admin', help="the OpenSearch user, default 'admin'")
    aparse.add_argument('-p', '--password', help="the password for the OpenSearch user")
    aparse.add_argument('-v', '--no-verify', help="don't verify certificates", default=False, action="store_true")
    aparse.add_argument('-c', '--cacert', help="path to cert file", default=None)

    args = aparse.parse_args()

    if not os.path.exists(args.filespec):
        print(f"Error: file not found: {args.filespec}")
        return

    csv.field_size_limit(sys.maxsize)

    f = open(args.filespec, 'r')
    csvr = csv.reader(f, quoting=csv.QUOTE_ALL)

    parsed_url = urlparse(args.opensearch)
    host = parsed_url.hostname
    port = parsed_url.port
    ca_certs = args.cacert
    no_verify = args.no_verify

    es = OpenSearch(http_auth=(args.username, args.password), hosts=[{'host': host, 'port': port}], use_ssl = True,
                    verify_certs = (not no_verify), ca_certs=ca_certs, ssl_assert_hostname = False, ssl_show_warn = False)

    print("Indexing...")

    rows = 0
    for row in csvr:
        if rows == 0:
            rows = 1
            continue
        email = {}
        email['url'] = row[0]
        # process and field the body row[1]
        content = row[1]
        # to do: this might be OS dependent, test on windows might need /r/n or different open incantation
        list_content = content.strip().split('\n')

        body = ""
        flag = False
        for field in list_content:
            if flag:
                body = body + field
                continue
            if field.startswith('Date:'):
                s_date = field[field.find(':')+1:].strip()
                dt = parser.parse(s_date)
                email['date_published'] = dt.strftime('%Y-%m-%d %H:%M:%S.%f')
            if field.startswith('Subject:'):
                email['subject'] = field[field.find(':')+1:].strip()
            if field.startswith('To:'):
                email['to'] = field[field.find(':')+1:].strip()
            if field.startswith('X-To:'):
                # overwrite
                email['to'] = field[field.find(':')+1:].strip()
            if field.startswith('From:'):
                email['author'] = field[field.find(':')+1:].strip()
            if field.startswith('X-From:'):
                # overwrite
                email['author'] = field[field.find(':')+1:].strip()
            if field == '':
                # the next one is the body
                flag = True
        # end for
        # create the content field
        email['content'] = body
        res = es.index(index=args.index, body=email, refresh=True)
        rows = rows + 1
        if rows % 100 == 0:
            print(f"Indexed {rows} records so far...")
        if int(args.max) > 0:
            if rows > int(args.max):
                break
    # end for


#############################################

if __name__ == "__main__":
    main(sys.argv)

# end
```

### Core Architecture Module: `DevUtils/verify_search.py`
```
import os
import sys
import json
import requests

def make_post_request(url, data, bearer_token=None, verify_ssl=True):
    headers = {}

    if bearer_token:
        headers['Authorization'] = f'Bearer {bearer_token}'

    try:
        response = requests.post(url, data=data, headers=headers, verify=verify_ssl)
        response.raise_for_status()

        print(f"POST Request to {url} was successful.")
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Body:\n{response.text}")

    except requests.exceptions.RequestException as e:
        print(f"POST Request to {url} failed with error: {e}")
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print("Usage: python verify_search.py <URL> <JSON_DATA> [BEARER_TOKEN] [VERIFY_SSL]")
        print("Usage: Where <URL> is a fully formed search URL")
        print("Usage: Where <JSON_DATA> is post data")
        print("Usage: Where [BEARER_TOKEN] is an optional Bearer token")
        print("Usage: Where [VERIFY_SSL] an optional path to a cert or pem file or a True/False value")
        sys.exit(1)

    url = sys.argv[1]
    json_data = json.loads(sys.argv[2])

    bearer_token = sys.argv[3] if len(sys.argv) > 3 else None
    verify_ssl = sys.argv[4] if len(sys.argv) > 4 else True

    # Check if verify_ssl is a file path
    if verify_ssl and not os.path.exists(verify_ssl):
        verify_ssl = (False if verify_ssl.lower() == 'false' else True)

    make_post_request(url, json_data, bearer_token, verify_ssl)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `swirl/connectors/utils.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

from sys import path
from os import environ

import django

from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned, ValidationError
from django.db import DatabaseError, OperationalError, IntegrityError


from swirl.utils import swirl_setdir
path.append(swirl_setdir()) # path to settings.py file
environ.setdefault('DJANGO_SETTINGS_MODULE', 'swirl_server.settings')
django.setup()

from swirl.models import Result, Search
from swirl.connectors.mappings import QUERY_MAPPING_VARIABLES

from celery.utils.log import get_task_logger
logger = get_task_logger(__name__)
module_name='utils.py'

#############################################
#############################################

def save_result(search, provider, query_to_provider="", messages=[], found=0, retrieved=0, provider_results=[]):

    '''
    accepts: model data
    returns: results of saving those items
    makes no changes
    '''

    new_result = Result.objects.create(search_id=search, searchprovider=provider.name, query_to_provider=query_to_provider, result_processor=provider.result_processor, messages=messages, found=found, retrieved=retrieved, json_results=provider_results)
    new_result.save()
    return new_result

#############################################

def get_search_obj(id):
    try:
        return Search.objects.get(id=id)
    except ObjectDoesNotExist as err:
        logger.error(f'{module_name}_{id}: ObjectDoesNotExist: {err}')
        return None
    except MultipleObjectsReturned as err:
        logger.error(f'{module_name}_{id}: MultipleObjectsReturned: {err}')
        return None
    except ValidationError as err:
        logger.error(f'{module_name}_{id}: ValidationError: {err}')
        return None
    except IntegrityError as err:
        logger.error(f'{module_name}_{id}: IntegrityError: {err}')
        return None
    except OperationalError as err:
        logger.error(f'{module_name}_{id}: OperationalError: {err}')
        return None
    except DatabaseError as err:
        logger.error(f'{module_name}_{id}: DatabaseError: {err}')
        return None


def bind_query_mappings(query_template, query_mappings, url=None, credentials=None):

    '''
    accepts: various parameters
    returns: query template with all mappings (including URL and any credentials in key=value format) bound
    ignores: QUERY_MAPPING_VARIABLES (e.g. RESULT_INDEX)
    '''

    module_name = 'bind_query_mappings'

    bound_query_template = query_template
    mappings = []

    if query_mappings:
        mappings = query_mappings.split(',')

    if credentials:
        if not credentials.startswith('HTTP'):
            for add_mapping in credentials.split(','):
                mappings.append(add_mapping)

    if url:
        if '{url}' in bound_query_template:
            bound_query_template = bound_query_template.replace('{url}', url)

    if mappings:
        for mapping in mappings:
            stripped_mapping = mapping.strip()
            if '=' in stripped_mapping:
                # take the left most
                swirl_key = stripped_mapping[:stripped_mapping.find('=')]
                source_key = stripped_mapping[stripped_mapping.find('=')+1:]
            else:
                # logger.warning(f"{module_name}: Warning: mapping {stripped_mapping} is missing '='")
                continue
            # end if
            if swirl_key in QUERY_MAPPING_VARIABLES:
                # ignore it
                continue
            template_key = '{' + swirl_key + '}'
            if template_key in bound_query_template:
                bound_query_template = bound_query_template.replace(template_key, source_key)
                continue
            # logger.warning(f"{module_name}: Warning: mapping {template_key} not found in template, does it need braces {{}}?")
        # end for
    # end if

    return bound_query_template

#############################################

def get_mappings_dict(mappings):

    '''
    accepts: any provider mapping
    returns: dict of the mappings by swirl_key
    warns if any swirl_key is repeated
    '''

    module_name = 'get_mappings'

    dict_mappings = {}

    mappings = mappings.split(',')
    if mappings:
        for mapping in mappings:
            stripped_mapping = mapping.strip()
            if '=' in stripped_mapping:
                swirl_key = stripped_mapping[:stripped_mapping.find('=')]
                source_key = stripped_mapping[stripped_mapping.find('=')+1:]
            else:
                source_key = None
                swirl_key = stripped_mapping
            # end if
            if swirl_key in dict_mappings:
                logger.warning(f"{module_name}: Warning: control mapping {swirl_key} found more than once, ignoring")
                continue
            dict_mappings[swirl_key] = source_key
        # end for
    # end if

    return dict_mappings

```

### Core Architecture Module: `swirl/mixers/utils.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
@version:    Swirl 1.x
'''

import django
from sys import path
from os import environ

from swirl.utils import swirl_setdir
path.append(swirl_setdir()) # path to settings.py file
environ.setdefault('DJANGO_SETTINGS_MODULE', 'swirl_server.settings') 
django.setup()

from django.conf import settings

#############################################    

SWIRL_BANNER_TEXT = getattr(settings, 'SWIRL_BANNER_TEXT', '__S_W_I_R_L__1_._X_______________________________________________________________')

def create_mix_wrapper(result_sets):

    # accepts: result sets
    # returns: wrapper around the results

    mix_wrapper = {}
    mix_wrapper['messages'] = [ SWIRL_BANNER_TEXT ]
    mix_wrapper['info'] = {}
    for result_set in result_sets:
        for message in result_set.messages:
            mix_wrapper['messages'].append(message)
        mix_wrapper['info'][result_set.searchprovider] = {}
        mix_wrapper['info'][result_set.searchprovider]['found']=result_set.found
        mix_wrapper['info'][result_set.searchprovider]['retrieved']=result_set.retrieved
        mix_wrapper['info'][result_set.searchprovider]['query_to_provider']=result_set.query_to_provider
        mix_wrapper['info'][result_set.searchprovider]['result_processor']=result_set.result_processor
    mix_wrapper['results'] = None
    return mix_wrapper

```

### Core Architecture Module: `swirl/processors/transform_query_processor_utils.py`
```
# Some utility functions for external use

from celery.utils.log import get_task_logger
logger = get_task_logger(__name__)

from django.core.exceptions import ObjectDoesNotExist
from swirl.models import QueryTransform
from swirl.processors.transform_query_processor import TransformQueryProcessorFactory
from swirl.processors import alloc_processor

module_name = 'transform_query_processor_utils'
def __find_query_transform(name, type, user=None):
    """
    Attempt to find the transform in the DB
    """
    try:
        if user:
            if not user.has_perm('swirl.view_querytransform'):
                logger.warning(f"User {user} needs permission view_querytransform")
                return False
        return QueryTransform.objects.get(name=name,qrx_type=type)
    except ObjectDoesNotExist as err:
        # It's okay for it to not be there, just warning
        logger.warn(f'{module_name}_{id}: ObjectDoesNotExist: {err}')
        return False

def __fall_back_to_query_transform(processor, query, err, user=None):
        """
        To be called after we failed to find a processor using eval
        """
        s_processor = str(processor)
        tmp = s_processor.split('.')
        if len(tmp) != 2:
            raise err # throw the original error
        name = tmp[0].strip()
        qrx_type = tmp[1].strip()
        if not (qxr := __find_query_transform(name=name, type=qrx_type, user=user)):
            raise err # throw the original error
        return TransformQueryProcessorFactory.alloc_query_transform(query, name, qrx_type,
                                                                                 qxr.config_content)

def get_pre_query_processor_or_transform(processor, query_temp, tags, user=None ):
    """
    Get the pre-query processed based on an entry from from the pre_query_processor(s) fields
    """
    try:
        pre_query_processor = alloc_processor(processor=processor)(query_temp, None, tags)
    except (Exception) as err:
        # catch all exceptions here, because anything can come back from eval
        pre_query_processor = __fall_back_to_query_transform(processor, query_temp, err, user)

    return pre_query_processor

def get_query_processor_or_transform(processor, query_temp, mappings, tags, user=None):
    """
    Get the query processed based on an entry from from the query_processor(s) fields
    """
    try:
        query_processor = alloc_processor(processor=processor)(query_temp, mappings, tags)
    except (Exception) as err:
        query_processor = __fall_back_to_query_transform(processor, query_temp, err, user)

    return query_processor

```

### Core Architecture Module: `swirl/processors/utils.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

#############################################
#############################################
import re
import time
from swirl.nltk import stopwords, word_tokenize, is_punctuation
from nltk.tag import tnt

class ParsedQuery:
    def __init__(self, query_stemmed_list, not_list, query_list,
            query_stemmed_target_list, query_target_list,
            query_has_numeric):
        self.query_stemmed_list = query_stemmed_list
        self.not_list = not_list
        self.query_list = query_list
        self.query_stemmed_target_list = query_stemmed_target_list
        self.query_target_list = query_target_list
        self.query_has_numeric = query_has_numeric

def result_processor_feedback_empty_record():
    return {
            'result_processor_feedback': {
            'query': {
                'provider_query_terms': [],
                'list_query_lens':[],
                'dict_result_lens':{}
            }
        }
    }


def result_processor_feedback_merge_records(record1, record2):
    # Initialize a new record
    merged_record = result_processor_feedback_empty_record()

    # Merge dict_result_lens
    dict_result_lens_keys = set()
    if "result_processor_feedback" in record1 and "query" in record1["result_processor_feedback"] and "dict_result_lens" in record1["result_processor_feedback"]["query"]:
        dict_result_lens_keys.update(record1["result_processor_feedback"]["query"]["dict_result_lens"].keys())
    if "result_processor_feedback" in record2 and "query" in record2["result_processor_feedback"] and "dict_result_lens" in record2["result_processor_feedback"]["query"]:
        dict_result_lens_keys.update(record2["result_processor_feedback"]["query"]["dict_result_lens"].keys())

    for key in dict_result_lens_keys:
        merged_record["result_processor_feedback"]["query"]["dict_result_lens"][key] = list(
            set(
                record1.get("result_processor_feedback", {}).get("query", {}).get("dict_result_lens", {}).get(key, []) +
                record2.get("result_processor_feedback", {}).get("query", {}).get("dict_result_lens", {}).get(key, [])
            )
        )

    # Merge provider_query_terms
    provider_query_terms = []
    if "result_processor_feedback" in record1 and "query" in record1["result_processor_feedback"] and "provider_query_terms" in record1["result_processor_feedback"]["query"]:
        provider_query_terms.extend(record1["result_processor_feedback"]["query"]["provider_query_terms"])
    if "result_processor_feedback" in record2 and "query" in record2["result_processor_feedback"] and "provider_query_terms" in record2["result_processor_feedback"]["query"]:
        provider_query_terms.extend(record2["result_processor_feedback"]["query"]["provider_query_terms"])

    merged_record["result_processor_feedback"]["query"]["provider_query_terms"] = sorted(list(set(provider_query_terms)))

    # Merge list_query_lens
    list_query_lens = []
    if "result_processor_feedback" in record1 and "query" in record1["result_processor_feedback"] and "list_query_lens" in record1["result_processor_feedback"]["query"]:
        list_query_lens.extend(record1["result_processor_feedback"]["query"]["list_query_lens"])
    if "result_processor_feedback" in record2 and "query" in record2["result_processor_feedback"] and "list_query_lens" in record2["result_processor_feedback"]["query"]:
        list_query_lens.extend(record2["result_processor_feedback"]["query"]["list_query_lens"])

    merged_record["result_processor_feedback"]["query"]["list_query_lens"] = list_query_lens

    return merged_record



def result_processor_feedback_provider_query_terms(qt_buf):
    """
    Create a JSON object from the list of query terms:
    """
    if not qt_buf or len(qt_buf) <= 0:
        return None
    ret = result_processor_feedback_empty_record()
    ret['result_processor_feedback']['query']['provider_query_terms'] = sorted(list(set(qt_buf)))
    return ret


def parse_query(q_string, results_processor_feedback):

    query_stemmed_list = []
    not_list = []
    query_list = []
    query_stemmed_target_list = []
    query_target_list = []
    query_has_numeric = False
    provider_query_terms = []

    if results_processor_feedback:
        provider_query_terms = results_processor_feedback.get(
            'result_processor_feedback', []).get('query', []).get(
            'provider_query_terms', [])

    # 4c: extract quoted phrases BEFORE stripping quotes so they can be inserted
    # as highest-priority targets in the scoring lists, giving phrase-match results
    # a clear relevancy advantage over results that merely contain the keywords.
    quoted_phrases = re.findall(r'"([^"]+)"', q_string)

    # remove quotes
    query = clean_string(q_string).strip().replace('\"','')
    query_list = word_tokenize(query)
    ## I think the loop is okay since it's a very small list.
    for term in provider_query_terms:
        if not term in query_list:
            query_list.append(term)

    # remove AND, OR and parens
    query_list = [s for s in query_list if s not in ["AND","OR"] and not is_punctuation(s)]

    # check for numeric
    query_has_numeric = has_numeric(query_list)
    # not list
    not_list = []
    not_parsed_query = []
    if 'NOT' in query_list:
        not_parsed_query = query_list[:query_list.index('NOT')]
        not_list = query_list[query_list.index('NOT')+1:]
    else:
        for q in query_list:
            if q.startswith('-'):
                not_list.append(q[1:])
            else:
                not_parsed_query.append(q)
            # end if
        # end for
    # end if
    if not_parsed_query:
        query = ' '.join(not_parsed_query).strip()
        query_list = query.split()
    # end if

    # check for stopword query
    query_without_stopwords = []
    for extract in query_list:
        if not extract in stopwords:
            query_without_stopwords.append(extract)
    if len(query_without_stopwords) == 0:
        raise Exception("query_string_processed is all stopwords!")

    # stem the query - fix for https://github.com/swirlai/swirl-search/issues/34
    query_stemmed_list = stem_string(clean_string(query)).strip().split()
    query_stemmed_list_len = len(query_stemmed_list)

    # check for non query?
    if query_stemmed_list_len == 0:
        raise Exception("Query stemmed list is empty!")

    # prepare query targets
    query_stemmed_target_list = []
    query_target_list = []

    # 4c: prepend quoted phrases as highest-priority targets so the scoring loop
    # sees them first and awards them higher weight via the key-length formula.
    for phrase in quoted_phrases:
        tokens = phrase.strip().split()
        if tokens:
            stemmed_tokens = stem_string(phrase.strip()).split()
            if stemmed_tokens:
                query_stemmed_target_list.insert(0, stemmed_tokens)
                query_target_list.insert(0, tokens)

    # 1 gram
    if query_stemmed_list_len == 1:
        query_stemmed_target_list.append(query_stemmed_list)
        query_target_list.append(query_list)
    # 2 gram
    if query_stemmed_list_len == 2:
        query_stemmed_target_list.append(query_stemmed_list)
        query_target_list.append(query_list)
        query_stemmed_target_list.append([query_stemmed_list[0]])
        query_target_list.append([query_list[0]])
        query_stemmed_target_list.append([query_stemmed_list[1]])
        query_target_list.append([query_list[1]])
    # more grams
    if query_stemmed_list_len >= 3:
        query_stemmed_target_list.append(query_stemmed_list)
        query_target_list.append(query_list)
        for bigram in bigrams(query_stemmed_list):
            query_stemmed_target_list.append(bigram)
        for bigram in bigrams(query_list):
            query_target_list.append(bigram)
        for gram in query_stemmed_list:
            # ignore stopword 1-grams
            if gram in stopwords:
                continue
            query_stemmed_target_list.append([gram])
        for gram in query_list:
            # ignore stopword 1-grams
            if gram in stopwords:
                continue
            query_target_list.append([gram])

    return ParsedQuery(query_stemmed_list, not_list, query_list, query_stemmed_target_list,
                        query_target_list,  query_has_numeric)


def create_result_dictionary():
    """
    Create an empty result dictionary, when entries are made this dictionary, the type must
    correspond w/ the type that will be mapped from in results_mapping, if the types do not
    agree, the mapped values will not be added to the results.
    """

    dict_result = {}
    dict_result['swirl_rank'] = 0
    dict_result['swirl_score'] = 0.0
    dict_result['searchprovider'] = ""
    dict_result['searchprovider_rank'] = 0
    dict_result['title'] = ""
    dict_result['url'] = ""
    dict_result['body'] = ""
    dict_result['date_published'] = ""
    dict_result['date_published_display'] = ""
    dict_result['date_retrieved'] = ""
    dict_result['author'] = ""
    dict_result['title_hit_highlights'] = []
    dict_result['body_hit_highlights'] = []
    dict_result['payload'] = {}
    return dict_result

#############################################
# fix for https://github.com/swirlai/swirl-search/issues/34

from ..nltk import ps

import json

def decode_single_quote_json(json_string):
    """
        Replace single quotes with double quotes and
        decode to a dictionary.
        Log error and return empty on failure
    """
    if not json_string:
        return {}

    json_string = json_string.replace("'", '"')
    try:
        return json.JSONDecoder().decode(json_string)
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON: {e}")
        return {}

def stem_string(s):

    nl=[]
    for s in s.strip().split():
        nl.append(ps.stem(s))

    return ' '.join(nl)

##
```

### Core Architecture Module: `swirl/utils.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

import os
import re
import json
from pathlib import Path
import uuid
import redis
import socket
import sqlite3
import glob
from django.core.paginator import Paginator
from django.conf import settings
from django.contrib.auth import get_user_model
from swirl.web_page import PageFetcherFactory
from urllib.parse import urlparse, quote

# TO DO: is this correct?
import logging
logger = logging.getLogger(__name__)

SWIRL_MACHINE_AGENT   = {'User-Agent': 'SwirlMachineServer/1.0 (+http://swirlaiconnect.com)'}
SWIRL_CONTAINER_AGENT = {'User-Agent': 'SwirlContainer/1.0 (+http://swirlaiconnect.com)'}


##################################################
##################################################

def safe_urlparse(url):
    ret  = None
    try:
        ret =  urlparse(url)
    except Exception as err:
        print(f'{err} while parsing URL')
    finally:
        return ret

def provider_getter():
    try:
        conn = sqlite3.connect('./db.sqlite3')
        with conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM swirl_searchprovider")
            res = cur.fetchone()
            return res[0]
    except Exception as err:
        print(f'{err} while getting provider count, defaulting to -1')
        return -1 # not set

def get_search_count():
    try:
        conn = sqlite3.connect('./db.sqlite3')
        with conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM swirl_search")
            res = cur.fetchone()
            return res[0]
    except Exception as err:
        print(f'{err} while getting search count, defaulting to -1')
        return -1 # not set

def is_running_celery_redis():
    """
    check of the celey redis Brokers are available, if any are not
    print a message retrurn false.
    """
    parsed_redis_urls = []
    celery_urls = [settings.CELERY_BROKER_URL, settings.CELERY_RESULT_BACKEND]
    for url in celery_urls:
        if not (purl := safe_urlparse(url)):
            continue
        if not (purl.scheme or purl.scheme.lower() == 'redis' or purl.scheme.lower() == 'rediss'):
            continue
        parsed_redis_urls.append(purl)

    for url in parsed_redis_urls:
        try:
            password = url.password
            hostname = url.hostname
            port = url.port
            db = int(url.path.lstrip('/')) if url.path else 0  # Extracting DB index, default is 0
            scheme = url.scheme
            use_ssl = scheme.lower() == 'rediss' # Enable SSL if the scheme is 'rediss'
            r = redis.StrictRedis(host=hostname, port=port, db=db, password=password,
                                ssl=use_ssl,
                                ssl_cert_reqs='required' if use_ssl else None,
                                decode_responses=True)
            r.ping()
        except redis.ConnectionError:
            return False
        except Exception:
            return False

    return True

def is_running_in_docker():
    try:
        with open('/proc/1/sched', 'r') as f:
            sched_first_line = f.readline().strip().lower()
            target_string = "sh (1, #threads: 1)".lower()
            return sched_first_line.replace(" ", "") == target_string.replace(" ", "")
    except Exception as err:
        logger.debug(f"{err} while checking for container")
        return False

def get_page_fetcher_or_none(url):
    from swirl.views import SearchViewSet

    search_provider_count = provider_getter()
    search_count = get_search_count()
    user = get_user_model()
    user_list = user.objects.all()
    user_count = len(user_list)
    hostname = socket.gethostname()

    headers = SWIRL_CONTAINER_AGENT if is_running_in_docker() else SWIRL_MACHINE_AGENT
    """
    info is a tuple with 5 elements.
    info[0] : number of search providers
    info[1] : number of search objects
    info[2] : number of django users
    info[3] : hostname
    info[4] : domain name
    """
    info = [
        search_provider_count,
        search_count,
        user_count,
        hostname,
        ]
    newurl = url_merger(url, info)
    if (pf := PageFetcherFactory.alloc_page_fetcher(url=newurl, options= {
                                                        "cache": "false",
                                                        "headers":headers,
                                                })):
        return pf
    else:
        logger.info(f"No fetcher for {url}")
        return None

def url_merger(base_url, info):
    data = []
    for i in info:
        data.append("info=" + str(i))
    url = f"{base_url}?{'&'.join(data)}"
    return url

def get_url_details(request):
    if request:
        parsed_url = urlparse(request.build_absolute_uri())
        scheme = parsed_url.scheme
        hostname = parsed_url.hostname
        port = parsed_url.port if parsed_url.port else ""
    else:
        scheme = settings.PROTOCOL
        hostname = settings.HOSTNAME
        port = 8000

    return scheme, hostname, port


CLAZZ_INSTANTIATE_PAT = r'^([A-Z][a-zA-Z0-9_]*)\((.*)\)'
http_auth_clazz_strings = ['HTTPBasicAuth', 'HTTPDigestAuth', 'HTTProxyAuth']
def http_auth_parse(str):
    """
    returns a tuple of : 'HTTPBasicAuth'|'HTTPDigestAuth'|'HTTProxyAuth', [<list-of-arguments>]
    """
    if not str:
        return '',[]
    matched = re.match(CLAZZ_INSTANTIATE_PAT, str)
    if matched:
        c = matched.group(1)
        p = matched.group(2)
        if not (p and c in http_auth_clazz_strings) :
            logger.warning(f'unknown http auth class string {c} or missing parameters')
            return '',[]
        return c, [item.strip().strip("'") for item in p.split(',')]
    else:
        return '',[]



def is_valid_json(j):
    try:
        json.loads(j)
    except ValueError:
        return False
    return True

def swirl_setdir():
    # Get the current path and append it to the path
    this_file = str(Path(__file__).resolve())
    # /Users/sid/Code/swirl_server/swirl/utils.py
    # C:\Users\sid\Code\swirl_server\swirl\utils.py
    slash = '\\'
    if '/' in this_file:
        slash = '/'
    this_path = this_file[:this_file.rfind(slash)]
    this_folder = this_path[this_path.rfind(slash)+1:]
    append_path = ""
    if this_folder == "swirl":
        # chop off the swirl
        swirl_server_path = this_path[:this_path.rfind(slash)]
        append_path = swirl_server_path + slash + 'swirl_server' + slash + 'settings.py'
    # end if
    if append_path == "":
        logger.error("swirl_setdir(): error: append_path is empty string!!")
    if not os.path.exists(append_path):
       logger.error("swirl_setdir(): error: append_path does not exist!!")
    return(append_path)

def is_int(value):
    try:
        if not value:
            return False
        int_value = int(value)
        if int_value > 0:
            return True
        return False
    except ValueError:
        return False

def paginate(data, request):
    page = request.GET.get('page')
    items = request.GET.get('items')
    if data and is_int(page) and is_int(items):
        paginator = Paginator(data, items)
        page_obj = paginator.get_page(page)
        return page_obj.object_list
    return data


def standard_paginate(queryset, request, serializer_class):
    """
    DRF-style paginated response for ViewSets that override .list().

    Reads `items` (page size, default 10) and `page` (1-based, default 1)
    from the query string. Returns a dict shaped like DRF's
    PageNumberPagination: {count, next, previous, results}.

    The Galaxy UI's search-history sidebar and home-dashboard widgets
    (spyglass.component / search-history.component) read
    `response.results` and `response.next`. They send `?items=N` (not the
    DRF default `?page_size=N`), so callers must use this helper rather
    than DRF's default paginator to honor the existing query name.
    """
    items_raw = request.GET.get('items', '10')
    page_raw = request.GET.get('page', '1')
    items = max(1, int(items_raw)) if is_int(items_raw) else 10
    page = max(1, int(page_raw)) if is_int(page_raw) else 1

    paginator = Paginator(queryset, items)
    page_obj = paginator.get_page(page)

    serializer = serializer_class(page_obj.object_list, many=True)

    def _link(page_num):
        if page_num is None:
            return None
        params = request.GET.copy()
        params['page'] = str(page_num)
        return f"{request.build_absolute_uri(request.path)}?{params.urlencode()}"

    return {
        'count': paginator.count,
        'next': _link(page_obj.next_page_number() if page_obj.has_next() else None),
        'previous': _link(page_obj.previous_page_number() if page_obj.has_previous() else None),
        'results': serializer.data,
    }

def select_providers(providers, start_tag, tags_in_query_list):
    """
    - No tags
        + Include all active providers that have default set to true
    - Leading tag
        + Include active providers where the tag is included in their tag list
          regardless of whether the default is true
    - Embedded Tags (with or without leading tag)
        + Include active providers where the tag is included in their tag list
          regardless of if the default is true
    """
    selected_provider_list = []
    default_provider_list = []

    for provider in providers:
        if provider.default:
            default_provider_list.append(provider)
            if start_tag:
                for tag in provider.tags:
                    if tag.lower() == start_tag.lower():
                        selected_provider_list.append(provider)
                # end for
            else:
                selected_provider_list.append(provider)
            # end if
        else:
            ## not a default provider, check the tag match
            if provider.tags:
                for tag in provider.tags:
                    if tag.lower() in [t.lower() for
```

### Core Architecture Module: `manage.py`
```
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swirl_server.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    print("Starting Swirl")
    if os.getenv('SWIRL_ENABLE_DEBUGPY', 'False') == 'True' and os.getenv('_SWIRL_IN_DEBUG', 'False') != 'True':
        dj_debug_port = os.getenv('SWIRL_DJANGO_DEBUG_PORT', 7029)
        print("Debug enabled")
        import debugpy
        debugpy.listen(('0.0.0.0', dj_debug_port))
        print(f"Waiting for debugger to attach at port {dj_debug_port}...")
        debugpy.wait_for_client()
        os.environ['_SWIRL_IN_DEBUG'] = 'True'
        _IN_DEBUG=True
        print("Debugger attached")
    main()
```

### Core Architecture Module: `swirl.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
@version:    Swirl 1.x
'''
import re
import argparse
from asyncio.subprocess import STDOUT
import sys
import os
import subprocess
from subprocess import SubprocessError
import json
import time
import signal
import glob
from datetime import datetime

from swirl_server import settings

module_name = 'swirl.py'

from swirl.banner import SWIRL_BANNER, bcolors, SWIRL_VERSION
from swirl.utils import is_running_celery_redis
from swirl.services import SWIRL_SERVICES_DEBUG, SWIRL_SERVICES_DEBUG_DICT, SERVICES, SERVICES_DICT

SWIRL_CORE_SERVICES = ['django', 'celery-worker']

# How long to poll after launch before declaring success (seconds).
# Increase only if a service needs more than 2 s to detect a bad config and exit.
EARLY_FAIL_WINDOW = 2.0
EARLY_FAIL_POLL   = 0.1   # seconds between polls during launch window

# How long to wait for a SIGTERM'd service to exit before giving up.
STOP_TIMEOUT      = 8.0
STOP_POLL         = 0.25

COMMAND_LIST = [ 'help', 'start', 'debug', 'start_sleep', 'stop', 'restart', 'migrate', 'setup', 'status', 'watch', 'logs' ]

def service_is_retired(service_name):
    ret = False
    try:
        for service in SERVICES:
            if service['name'] == service_name:
                if service['retired']:
                    print(f"{service_name} is retired, ignoring\n", end='')
                    ret = True
    except Exception as err:
        print(f"{err} checking retired service")
    finally:
        return ret


def check_pid(pid):
    proc = subprocess.run(['ps','-p',str(pid)], capture_output=True)
    result = proc.stdout.decode('UTF-8')
    return str(pid) in result

##################################################

def load_swirl_file():
    if os.path.exists('.swirl'):
        try:
            swirl_file = open('./.swirl', 'r')
            dict_pid = json.load(swirl_file)
            swirl_file.close()
        except OSError as err:
            print(f"Error: {err}")
            return False
        return dict_pid
    else:
        return {}

def write_swirl_file(dict_pid):
    try:
        swirl_file = open('./.swirl', 'w')
        result = swirl_file.write(json.dumps(dict_pid))
        swirl_file.close()
    except OSError as err:
        print(f"Error: {err}")
        return False

    return True

##################################################

def launch(name, path):
    """
    Start a service subprocess and poll for EARLY_FAIL_WINDOW seconds.
    Returns the pid (>0) on success, or -1 if the process exited early.
    """
    # prepare the path
    path_list = path.split()

    # create the log file
    try:
        f = open(f'./logs/{name}.log', 'ab')
    except OSError as err:
        print(f"Error: {err} creating: ./logs/{name}.log")
        return -1
    try:
        process = subprocess.Popen(path_list, stdout=f, stderr=subprocess.STDOUT)
    except Exception as err: # Broad exception okay here.
        print(f"Error: {err} creating process: {' '.join(path_list)}")
        return -1

    # do not close this file

    # Poll for EARLY_FAIL_WINDOW seconds to catch immediate exits (bad config, port in use, etc.)
    deadline = time.monotonic() + EARLY_FAIL_WINDOW
    while time.monotonic() < deadline:
        rc = process.poll()
        if rc is not None:
            # Process exited during the window
            if rc == 0:
                return process.pid   # clean daemonised exit — treat as success
            return -1                # non-zero exit = failure
        time.sleep(EARLY_FAIL_POLL)

    return process.pid

##################################################

def start(service_list, no_version_check=False):

    dict_pid = {}

    # check if .swirl exists
    dict_pid = load_swirl_file()
    if dict_pid:
        for service_name in dict_pid:
            if service_name in service_list:
                print(f"  {service_name} is already running — remove .swirl if this is incorrect")
                return False
        # end for
        # items in service_list are NOT in dict_pid, so continue and start them
    # end if

    if not os.path.exists('./logs'):
        print("  Creating logs/ directory")
        os.mkdir('./logs')

    if not is_running_celery_redis():
        print(f"  Redis is not running or unreachable ({settings.CELERY_BROKER_URL})")
        print( "  Start Redis before starting SWIRL — see https://docs.swirlaiconnect.com/Admin-Guide.html")
        return False

    # start service_list
    W = 16   # name column width
    print("Starting SWIRL:")
    flag = False
    for service_name in service_list:
        if service_name in SERVICES_DICT:
            if service_is_retired(service_name=service_name):
                continue
            print(f"  {service_name:<{W}} ...", end='', flush=True)
            result = launch(service_name, SERVICES_DICT[service_name])
            if result > 0:
                print(f'  started  (pid {result})')
                dict_pid[service_name] = result
            else:
                print(f'  error    — check logs/{service_name}.log')
                flag = True
            # end if
        else:
            print(f"  Unknown service '{service_name}' — ignored")
        # end if
    # end for

    if len(dict_pid) > 0:
        write_swirl_file(dict_pid)

    if flag:
        return False

    print(f"\nSWIRL {SWIRL_VERSION} is running.")
    return True

##################################################

def start_sleep (service_list, no_version_check=False):

    status = start(service_list, no_version_check=no_version_check)
    return status

##################################################

def debug(service_list, no_version_check=False):
    pass

##################################################

def watch(service_list, no_version_check=False):

    while 1:
        try:
            print(datetime.now())
            print()
            x = status(service_list)
            time.sleep(60)
        except KeyboardInterrupt:
            break

    return True

##################################################

def logs(service_list, no_version_check=False):

    log_files = sorted(glob.glob('logs/*.log'))
    if not log_files:
        print("No log files found in logs/")
        return True

    print(f"tail -f {' '.join(log_files)} - hit ^C to stop:")

    try:
        p = subprocess.Popen(['tail', '-f'] + log_files, stdout=subprocess.PIPE)

        while p.poll() is None:
            l = p.stdout.readline()
            print(l.decode("utf-8").replace('\n',''))
        p.kill()
        return True

    except KeyboardInterrupt:
        p.kill()
        return True

##################################################

def status(service_list, no_version_check=False):

    # check if .swirl exists
    dict_pid = load_swirl_file()

    if not dict_pid:
        print("  SWIRL is not running")
        return True

    W = 16   # name column width
    print("SWIRL status:")
    for service_name in dict_pid:
        if service_name in service_list:
            if service_is_retired(service_name=service_name):
                continue
            pid = dict_pid[service_name]
            if check_pid(pid):
                print(f"  {service_name:<{W}} running   pid {pid}")
            else:
                print(f"  {service_name:<{W}} unknown   pid {pid} not found")
        # end if
    # end for

    return True

##################################################

def migrate(service_list, no_version_check=False):

    print("Checking Migrations:")

    any_change = False

    proc = subprocess.run(['python','manage.py','makemigrations'], capture_output=True)
    if proc.returncode != 0:
        print(f"Error: {proc.stderr.decode('UTF-8')}")
        return False
    result = proc.stdout.decode('UTF-8')
    if not 'No changes detected' in result:
        any_change = True
    else:
        print(result)

    proc = subprocess.run(['python','manage.py','makemigrations','swirl'], capture_output=True)
    if proc.returncode != 0:
        print(f"Error: {proc.stderr.decode('UTF-8')}")
        return False
    result = proc.stdout.decode('UTF-8')
    if not 'No changes detected' in result:
        any_change = True
    else:
        print(result)

    print()
    print("Migrating:")
    print()

    proc = subprocess.run(['python','manage.py','migrate'], capture_output=True)
    if proc.returncode != 0:
        print(f"Error: {proc.stderr.decode('UTF-8')}")
        return False
    result = proc.stdout.decode('UTF-8')
    print(result)
    return True

##################################################

def _wait_for_pid_exit(pid):
    """Poll until the process is gone or STOP_TIMEOUT is reached. Returns True if gone."""
    deadline = time.monotonic() + STOP_TIMEOUT
    while time.monotonic() < deadline:
        if not check_pid(pid):
            return True
        time.sleep(STOP_POLL)
    return not check_pid(pid)

def stop(service_list, no_version_check=False):

    dict_pid = {}

    # check if .swirl exists
    dict_pid = load_swirl_file()

    if not dict_pid:
        print("  SWIRL is not running")
        return False

    W = 16   # name column width
    # stop service_list
    print("Stopping SWIRL:")
    stopped_names = []
    flag = False
    for service_name in dict_pid:
        # if in .swirl
        if service_name in service_list:
            if service_is_retired(service_name=service_name):
                continue
            # first listed service is stopped last
            if service_name == SERVICES[0]['name']:
                continue
            print(f"  {service_name:<{W}} (pid {dict_pid[service_name]}) ...", end='', flush=True)
            pid = int(dict_pid[service_name])
            try:
                os.kill(pid, 0)
                os.kill(pid, signal.SIGTERM)
            except OSError as err:
                print(f"  error    — {err}")
                flag = True
            if _wait_for_pid_exit(pi
```

### Core Architecture Module: `swirl/__init__.py`
```
'''
@author:     Sid Probstein
@contact:    sid@swirl.today
'''

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1671** (2025-08-12): **[DS-4207] Disable search RAG features when no AI provider configured**
  *Symptoms*: ## Description  This PR implements a simple example for the implementation of the "Disable Search RAG" feature, preventing errors in the Galaxy UI web page.  ## Type of Change <!-- Check all that apply to this PR. --> - [x] Bug fix or other non-breaking change that addresses an issue - [ ] New Feature / Enhancement (non-breaking change that add or improves functionality) - [ ] New Feature (breaking change that is not backwards compatible and/or alters current functionality) - [ ] Documentation (change to product documentation or README.md only) 
  **Post-Mortem & Fix Analysis**:
  > ## Test Results 67 tests   67 ✅  32s ⏱️  1 suites   0 💤  1 files     0 ❌  Results for commit b7baef32.  [test-results]:data:application/gzip;base64,H4sIAHxwm2gC/12MSQ7CMBAEvxL5zMELxobPoPEmjUhi5OWE+DtOAJNw66qW6kECjj6Ty8AOA8kVSwdXExSMc0PBG7enLN9JfeGaq7V/5ob3ZmgXAXDcCZ9STB+T6tyLy94F3+LXW3mTW3lbs3GasDQgRhnwQXDp5NlodgRw4D1TTOh2Ga6dpJQ7T54voqkAegABAAA=  :recycle: This comment has been updated with latest results.

- **Issue #1621** (2025-06-30): **[DS-4299] Fix rag items selection**
  *Symptoms*: # [DS-4299] Fix rag items selection  ## Description Small fix related to RAG item selection behavior.  ## Testing and Validation ![Screenshot 2025-06-26 at 10 08 36](https://github.com/user-attachments/assets/b826c18c-5936-45b6-8e8e-88df101da9ee) ![Screenshot 2025-06-26 at 10 09 00](https://github.com/user-attachments/assets/ad9e0f67-8e72-4a82-811b-c26aeef4883a)   ## Type of Change  - [x] Bug fix or other non-breaking change that addresses an issue - [ ] New Feature / Enhancement (non-breaking change that add or improves functionality) - [ ] New Feature (breaking change that is not backwards compatible and/or alters current functionality) - [ ] Documentation (change to product documentation or README.md only) 
  **Post-Mortem & Fix Analysis**:
  > ## Test Results 67 tests   67 ✅  33s ⏱️  1 suites   0 💤  1 files     0 ❌  Results for commit 864e4d20.  [test-results]:data:application/gzip;base64,H4sIAJBkXWgC/12Myw7CIBQFf6Vh7QJaAtSfMTwuyY1tMTxWjf8urYqtuzNzklmJxwkSuXbs0pFUMDdwJeqMYak4DJXrk7dPyC/cUrH2z9zxUQ1twmucTgJiDPFjYllacdun4Fv8ejsfcjsfazbMM+YKRAkO3PWUKUYNl5Yr6oV0gmnDmLV6BANjDwN5vgAEKxFWAAEAAA==  :recycle: This comment has been updated with latest results.

- **Issue #1141** (2024-02-01): **AI Summary: No data**
  *Symptoms*: **Describe the bug** When I search on keywords and select a few answers/links, then toggle checkbox "Generate AI Response", the summary shows "no data".  Looking at the logs, here is what I have:  `2024-01-31 19:48:37     Answer this query 'who is the best NBA player' given the following recent search results as background information. Do not mention that you are using the provided background information. Please cite the sources at the end of your response. Ignore information that is off-topic or obviously conflicting, without warning about it. 2024-01-31 19:48:37 2024-01-31 19:48:37,144 ERROR    error : 'ascii' codec can't encode character '\u2018' in position 7: ordinal not in range(128) while creating CGPT response`   **Screenshots** ![image](https://github.com/swirlai/swirl-search/assets/5055793/b465d5eb-3860-48f2-9be0-9c07b78693fd)  **Swirl :**  - Version: 3.0  - Local or Docker: Docker  - Desktop OS: MacOS Sonoma 14.2.1
  **Post-Mortem & Fix Analysis**:
  > Hi, taking a look now! Thanks for reporting.
  > I can confirm this is an issue in 3.2, working on it now
  > The issue only occurs when running with Docker. Local installation works fine. We're still working on it, will post again in the AM, sorry for the issue...

- **Issue #1028** (2024-02-04): **Elasticsearch connector does not authenticate**
  *Symptoms*: When Elastic need to authenticate to query, the credentials is not passed the right way to the server: ("user", "pass")  `xxx.xxx.xxx.xxx - ( [06/Dec/2023:19:10:28 -0300] "POST /xxxxx/_search HTTP/1.1" 401 495 "-" "elasticsearch-py/8.10.1 (Python/3.11.5; elastic-transport/8.10.0)"`  Swirl is sending a `(` instead of  user.
  **Post-Mortem & Fix Analysis**:
  > Hi @andremacola ,  Thanks for bringing this to our attention.  We'll take a look.  May I ask which verison of Elastic you're using?  And are you seeing it on a local or cloud Elastic?  Thanks, --Erik
  > Hi - this is confirmed as a bug, I am fixing it now...
  > This should address it, but won't be merged until tested.  https://github.com/swirlai/swirl-search/issues/1028  If you want to try it, pull branch 'fixelastic' :-) 

- **Issue #912** (2023-12-19): **add minimum version numbers to python modules in requirements.txt**
  *Symptoms*: **Describe the bug** The [requirements.txt](https://github.com/swirlai/swirl-search/blob/main/requirements.txt) file should specify the minimum version number of each python package. 
  **Post-Mortem & Fix Analysis**:
  > Hi @simsong , this will be addressed in the next release. Thanks, --Erik
  > This was addressed in Swirl 3.1.0, which is now available in the repo.

- **Issue #761** (2023-11-01): **Unresponsive Swirl Logo in Login Page**
  *Symptoms*: On login page: 1. When I inspect 2. Zoom in/out 3. Resize window Swirl logo gets disappeared  OS - Windows 10  Browser - Chrome  [screen-capture (6).webm](https://github.com/swirlai/swirl-search/assets/62489114/ad94f829-1f00-46b1-b48c-fcf768851174) 
  **Post-Mortem & Fix Analysis**:
  > Please assign me, I'll fix it up
  > PLease assign me 
  > Thanks, @s-vamshi, for pointing this out. The team will fix it up in the coming versions. 

- **Issue #159** (2023-03-10): **Review parsing of credentials and tokens everywhere**
  *Symptoms*: Found an issue with the parsing of Bearer tokens while working on a new SearchProvider that uses them.  The token I was testing with happened to have an equal sign `(=)` within the token itself, and that is also the character we currently split on when parsing Bearer token credentials in `requestsget.py` (line 156).  The syntax for the `credentials` line of a SearchProvider that uses a Bearer token looks like: ``` "credentials": "bearer=<your-token-here> ```  Spoke with @sid-swirl, and he's going to remedy this use-case as well as review parsing of all tokens throughout as there may be other places this could come into play (e.g. potentially with a BigQuery token, etc.). 
  **Post-Mortem & Fix Analysis**:
  > Fix for RequestsGet checked in to 1.10.1
  > Fix for RequestsGet checked in to fix-cred-parse-159 branch (off main)
  > https://github.com/swirlai/swirl-search/pull/160

- **Issue #146** (2023-03-28): **BigQuery connector error with single result_mapping that is type date**
  *Symptoms*: For example:  `"result_mappings": "title='{company}',body='{company} raised ${raisedamt} series {round} on {fundeddate}. The company is located in {city} {state} and has {numemps} employees.',url=permalink,date_published=fundeddate,fundeddate,NO_PAYLOAD",`  This will cause this error:  `[2023-03-07 20:25:46,487: ERROR/ForkPoolWorker-8] federate[2ba8cc5e-300a-43da-924d-86a855521319]: BigQuery_115_14: Object of type date is not JSON serializable [2023-03-07 20:25:46,487: INFO/ForkPoolWorker-8] federate[2ba8cc5e-300a-43da-924d-86a855521319]: BigQuery_115_14: save_results() [2023-03-07 20:25:46,487: INFO/ForkPoolWorker-8] federate[2ba8cc5e-300a-43da-924d-86a855521319]: BigQuery_115_14: Result.create() [2023-03-07 20:25:46,487: ERROR/ForkPoolWorker-8] federate[2ba8cc5e-300a-43da-924d-86a855521319]: tasks.py: Error: TypeError: Object of type date is not JSON serializable`  This is likely because date handling in MappingResultProcessor is only applied during swirl=source mapping 
  **Post-Mortem & Fix Analysis**:
  > This is in swirl.processors.mapping.py
  > Fixed in 1.10

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

### Incident Patch 1: `7c7921f8` (2026-05-22)
**Commit Message**: fix(rag): serialize concurrent detail-search-rag calls via per-search-id lock

Galaxy was observed firing /sapi/detail-search-rag/ twice for a single
user action: box.component.toggleChange's direct call PLUS a cascaded
call from summary.component after queryParamMap-triggered makeSearch.
Without serialization both requests cache-missed simultaneously, each
spun up a RAGPostResultProcessor, each issued an independent OpenAI
completion, both saved Result rows, and the user saw the AI Summary
swap from one body to a different one seconds later.

Backend defense-in-depth: a threading.Lock keyed by search_id ensures
only one OpenAI completion runs and one Result is written per
search_id, even when concurrent requests arrive. The second caller
blocks, re-checks the cache after acquiring the lock (the first
writer's Result is now stored), and serves it.

This protects against future frontend regressions of the same shape —
Galaxy's compareObjects fix (separate Galaxy PR) addresses the direct
cause, but the backend lock catches any double-fire we miss.

- Extracted _try_serve_cache() so both the fast (lock-free) cache hit
  and the slow (under-lock) cache re-check share one implementation

**File**: `swirl/tests/test_search_rag.py` (modified, +83/-0)
```diff
@@ -264,6 +264,89 @@ def test_get_rag_result_serves_cache_when_request_items_match_stored(monkeypatch
     assert cached.deleted is False
 
 
+def test_concurrent_get_rag_result_serializes_via_lock(monkeypatch):
+    """REGRESSION 4.5.0.6: two simultaneous detail-search-rag calls for the
+    same search_id must NOT both spin up a RAGPostResultProcessor.
+
+    Galaxy has been observed firing /sapi/detail-search-rag/ twice for a
+    single user action — box.component.toggleChange's direct call PLUS a
+    cascaded call from summary.component after queryParamMap-triggered
+    makeSearch(). Without the per-search-id lock added to SearchRag, both
+    calls saw cache miss, both ran OpenAI completions, both saved Result
+    rows, and the user saw the AI Summary swap from one body to another.
+
+    With the lock, only ONE processor is instantiated; the second caller
+    blocks, re-checks the cache after acquiring the lock, and serves the
+    body the first writer just stored.
+    """
+    import threading
+    from swirl.models import Result
+    from swirl.views_helpers import search_rag as sr_mod
+
+    cached_after_first_writer = _FakeResult(
+        rag_query_items=["item-a"], body="first-writer-body"
+    )
+    state = {"first_done": False}
+
+    def _fake_get(*args, **kwargs):
+        if state["first_done"]:
+            return cached_after_first_writer
+        raise Result.DoesNotExist
+
+    monkeypatch.setattr(Result.objects, "get", _fake_get)
+
+    instances_created = []
+
+    class StubProc:
+        def __init__(self, **kwargs):
+            instances_created.append(self)
+
+        def validate(self):
+            return True
+
+        def process(self, should_return=False):
+            # Simulate slow OpenAI work, then flip the "cache exists" flag
+            # so the next caller's _try_serve_cache finds the Result.
+            import time as _t
+            _t.sleep(0.2)
+            state["first_done"] = True
+            return type("FakeResult", (), {
+                "json_results": [{
+                    "body": ["first-writer-body"],
+                    "additional_content": {},
+                    "rag_query_items": ["item-a"],
+                }],
+            })()
+
+    monkeypatch.setattr(
+        "swirl.views_helpers.search_rag.RAGPostResultProcessor", StubProc
+    )
+    # Reset the module-level lock dict so the test is independent.
+    monkeypatch.setattr(sr_mod, "_rag_locks", {})
+
+    results = []
+
+    def caller():
+        sr = _make_search_rag(rag_items="item-a")
+        sr.search_id = "concurrent-test"
+        results.append(sr.get_rag_result())
+
+    t1 = threading.Thread(target=caller)
+    t2 = threading.Thread(target=caller)
+    t1.start()
+    t2.start()
+    t1.join(timeout=5)
+    t2.join(timeout=5)
+
+    assert len(instances_created) == 1, (
+        f"Expected exactly 1 RAGPostResultProcessor instance under "
+        f"concurrent get_rag_result; got {len(instances_created)} — "
+        f"lock failed to serialize."
+    )
+    bodies = [r[0] for r in results]
+    assert bodies == ["first-writer-body", "first-writer-body"], bodies
+
+
 def test_get_rag_result_regenerates_when_request_items_differ_from_stored(monkeypatch):
     """When the caller explicitly requested DIFFERENT rag_items, the cache
     must miss. We don't exercise the RAGPostResultProcessor branch here
```

**File**: `swirl/views_helpers/search_rag.py` (modified, +102/-52)
```diff
@@ -1,4 +1,5 @@
 import logging
+import threading
 
 from rest_framework.request import Request
 
@@ -10,6 +11,30 @@
 
 instances = {}
 
+# Per-search-id locks to serialize concurrent detail-search-rag calls.
+# Galaxy has been observed firing /sapi/detail-search-rag/ twice for a single
+# user action (sometimes against the same search_id, sometimes against two
+# duplicate Search rows). Without serialization both requests cache-miss
+# simultaneously, each spins up its own RAGPostResultProcessor, each issues
+# an independent OpenAI completion, both save Result rows, and the user sees
+# the AI Summary appear and then swap to a different one as the UI re-reads
+# the second one. Serializing on search_id makes the second caller block
+# until the first writes its Result, then serve the cached body — one
+# completion per search_id, one summary visible to the user.
+_rag_locks: dict[str, threading.Lock] = {}
+_rag_locks_master = threading.Lock()
+
+
+def _get_rag_lock(search_id) -> threading.Lock:
+    """Return (creating if needed) the lock for a given search_id."""
+    key = str(search_id) if search_id is not None else ""
+    with _rag_locks_master:
+        lock = _rag_locks.get(key)
+        if lock is None:
+            lock = threading.Lock()
+            _rag_locks[key] = lock
+        return lock
+
 
 class SearchRag:
 
@@ -59,63 +84,88 @@ def _extract_result(self, json_result: dict) -> tuple:
         additional_content = json_result.get("additional_content", {})
         return body_text, additional_content
 
-    def get_rag_result(self) -> tuple:
-        # Cache check. An empty ``self.rag_query_items`` means the caller did
-        # NOT pass ``?rag_items=…`` — treat that as "no filter requested,
-        # serve whatever's stored" rather than "items changed, regenerate".
-        # Previously the latter interpretation caused every detail-search-rag
-        # fetch to delete-and-recreate the Result generated by the auto-RAG
-        # path (swirl/search.py:302), so the user saw one summary appear and
-        # then a different summary replace it seconds later.
+    def _try_serve_cache(self) -> tuple | None:
+        """Cache-only check. Returns the cached body+content tuple, or None on miss.
+
+        An empty ``self.rag_query_items`` means the caller did NOT pass
+        ``?rag_items=…`` — treat that as "no filter requested, serve whatever's
+        stored" rather than "items changed, regenerate". Previously the latter
+        interpretation caused every detail-search-rag fetch to delete-and-
+        recreate the Result generated by the auto-RAG path (swirl/search.py:302),
+        so the user saw one summary appear and then a different summary
+        replace it seconds later (fixed in 4.5.0.5).
+        """
         try:
             rag_result = Result.objects.get(
                 search_id=self.search_id, searchprovider="ChatGPT"
             )
         except Result.DoesNotExist:
-            rag_result = None
-
-        if rag_result is not None:
-            stored_items = set(rag_result.json_results[0].get("rag_query_items") or [])
-            requested_items = set(self.rag_query_items)
-            if not requested_items or requested_items == stored_items:
-                body_text, additional_content = self._extract_result(rag_result.json_results[0])
-                if body_text:
-                    return body_text, additional_content
-                return False, {}
-        rag_processor = RAGPostResultProcessor(
-            search_id=self.search_id,
-            request_id="",
-            should_get_results=True,
-            rag_query_items=self.rag_query_items,
-            rag_timeout=self.rag_timeout,
-            ai_instructions=self.ai_instructions,
-        )
-        instances[self.search_id] = rag_processor
-        if rag_processor.validate():
-            result = rag_processor.process(should_return=True)
-            if result == 0:
-                # DS-5598: when ``rag_timeout`` was passed and the OpenAI
-                # call raised — most commonly an APITimeoutError because
-                # the per-request timeout fired — surface the
-                # timeout-specific message so Galaxy's AI Summary footer
-                # contains the documented "No response from Generative
-                # AI" string the rag.feature:240 scenario asserts on.
-                # Without this branch the test sees the generic
-                # credentials message and fails.
-                if self.rag_timeout is not None:
-                    return (
-                        f"Timeout: No response from Generative AI within "
-                        f"{self.rag_timeout}s.",
-                        {},
-                    )
-                return "Please check the OpenAI or Azure OpenAI credentials in your environment.", {}
-
-            if self.search_id in instances:
-                del instances[self.search_id]
-
-            return self._extract_re
```

---

### Incident Patch 2: `0460fcea` (2026-05-21)
**Commit Message**: fix(rag): correct cache check when detail-search-rag omits rag_items

Galaxy's typical flow is:
  1. POST /swirl/search/?qs=…&rag=true  → auto-RAG path writes a
     ChatGPT Result via swirl/search.py:302 → RAGPostResultProcessor
  2. GET  /swirl/sapi/detail-search-rag/?search_id=N
          (no rag_items in URL — Galaxy hasn't asked to filter)

The cache check in SearchRag.get_rag_result() compared the stored
Result's rag_query_items to the current request's via set equality.
When step 2 omits ?rag_items=…, self.rag_query_items is []. The check
set(stored_non_empty) == set([]) is always False, so EVERY such fetch
treated the cache as stale, invoked a new RAGPostResultProcessor (whose
__init__ deletes any existing ChatGPT Result), and regenerated against
a fresh OpenAI completion. The user saw the auto-RAG summary appear and
then swap to a different summary seconds later.

Fix: treat empty rag_query_items as 'no filter requested, serve whatever's
stored'. The cache-miss path is preserved for the case where the caller
explicitly requested DIFFERENT rag_items than what was generated. Also
collapse the duplicate try/except block that did the same lookup twice.

Tests:
- 3 unit tests c

**File**: `swirl/tests/test_search_rag.py` (modified, +98/-0)
```diff
@@ -189,3 +189,101 @@ def test_serializer_requires_message_key():
     serializer = DetailSearchRagSerializer(data={"additional_content": {}})
     assert not serializer.is_valid()
     assert "message" in serializer.errors
+
+
+# ---------------------------------------------------------------------------
+# SearchRag.get_rag_result — cache decision (regression for 4.5.0.5)
+#
+# 4.5.0.4 shipped a cache check that compared the stored Result's
+# rag_query_items to the CURRENT request's rag_query_items via set equality.
+# When the detail-search-rag URL omitted ?rag_items=…, self.rag_query_items
+# was [] — and set(stored_non_empty) == set([]) is False, so the cache check
+# treated every such fetch as a miss. RAGPostResultProcessor.__init__ then
+# deleted the cached Result and regenerated, producing a different LLM
+# completion. The user saw the auto-RAG summary appear, then swap to a
+# different summary seconds later.
+#
+# These tests cover the corrected cache logic in
+# swirl/views_helpers/search_rag.py:62-83. They monkeypatch Result.objects.get
+# instead of touching the DB — the rag_processor branch (DB write +
+# OpenAI call) is verified by test_search_rag_integration.py.
+# ---------------------------------------------------------------------------
+
+class _FakeResult:
+    """Stand-in for a stored ChatGPT Result row."""
+
+    def __init__(self, rag_query_items, body="cached rag body", additional_content=None):
+        self.json_results = [{
+            "rag_query_items": rag_query_items,
+            "body": [body],
+            "additional_content": additional_content or {},
+        }]
+        self.deleted = False
+
+    def delete(self):
+        self.deleted = True
+
+
+def _patch_result_get(monkeypatch, fake):
+    """Make Result.objects.get(...) return ``fake`` (or raise DoesNotExist if None)."""
+    from swirl.models import Result
+
+    def _fake_get(*args, **kwargs):
+        if fake is None:
+            raise Result.DoesNotExist
+        return fake
+
+    monkeypatch.setattr(Result.objects, "get", _fake_get)
+
+
+def test_get_rag_result_serves_cache_when_request_omits_rag_items(monkeypatch):
+    """REGRESSION 4.5.0.5: an empty self.rag_query_items must serve the
+    stored Result rather than trigger a regenerate. This is the path
+    Galaxy hits when DetailSearchRagView fetches the auto-RAG output."""
+    cached = _FakeResult(rag_query_items=["item-a", "item-b"], body="auto-RAG body")
+    _patch_result_get(monkeypatch, cached)
+
+    sr = _make_search_rag()  # no rag_items in request
+    body_text, additional_content = sr.get_rag_result()
+
+    assert body_text == "auto-RAG body"
+    assert additional_content == {}
+    assert cached.deleted is False, (
+        "Cached Result must not be deleted when the request omits rag_items"
+    )
+
+
+def test_get_rag_result_serves_cache_when_request_items_match_stored(monkeypatch):
+    cached = _FakeResult(rag_query_items=["item-a", "item-b"])
+    _patch_result_get(monkeypatch, cached)
+
+    sr = _make_search_rag(rag_items="item-b,item-a")  # same set, different order
+    body_text, _ = sr.get_rag_result()
+
+    assert body_text == "cached rag body"
+    assert cached.deleted is False
+
+
+def test_get_rag_result_regenerates_when_request_items_differ_from_stored(monkeypatch):
+    """When the caller explicitly requested DIFFERENT rag_items, the cache
+    must miss. We don't exercise the RAGPostResultProcessor branch here
+    (that's the integration test's job) — just confirm we fall through
+    past the cache return."""
+    cached = _FakeResult(rag_query_items=["item-a", "item-b"])
+    _patch_result_get(monkeypatch, cached)
+
+    # Short-circuit the processor branch so the test doesn't need an
+    # AIProvider / OpenAI client. validate() returning False makes
+    # get_rag_result fall through to the final "", {} return.
+    monkeypatch.setattr(
+        "swirl.views_helpers.search_rag.RAGPostResultProcessor",
+        lambda **kwargs: type("StubProc", (), {"validate": lambda self: False})(),
+    )
+
+    sr = _make_search_rag(rag_items="item-c")  # disjoint set → cache miss
+    body_text, additional_content = sr.get_rag_result()
+
+    # Cache-miss path returned the empty fall-through, which is what we want
+    # to assert: the cache check did NOT return early with the stored body.
+    assert body_text == ""
+    assert additional_content == {}
```

**File**: `swirl/tests/test_search_rag_integration.py` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+"""
+Integration tests for the RAG fetch flow — drive the full Django view chain
+via APIClient instead of unit-testing SearchRag in isolation.
+
+These tests are the regression coverage for the 4.5.0.5 "RAG result swaps
+to a different summary seconds after appearing" bug. The unit tests in
+test_search_rag.py exercise SearchRag.get_rag_result()'s cache decision
+directly; this file exercises the same code path through the actual HTTP
+endpoint and asserts the user-visible invariant: **the Result row backing
+the rag response must be stable across multiple GETs**, i.e. the auto-RAG
+output is not silently deleted-and-replaced on the follow-up fetch.
+
+This is the test layer that was missing during the 4.5.0.3 / 4.5.0.4 cycle.
+A unit test of SearchRag wouldn't have caught the auth-chain ordering bug
+in views.py; a unit test of the auth chain wouldn't have caught this
+double-RAG cache bug. APIClient against the actual URL exercises both at
+once, and runs in seconds (vs. qa-suite's 20 minutes).
+
+Run with:  pytest swirl/tests/test_search_rag_integration.py -v
+"""
+
+import pytest
+from django.contrib.auth.models import User
+from rest_framework.authtoken.models import Token
+from rest_framework.test import APIClient
+
+from swirl.models import Result, Search
+
+
+# ---------------------------------------------------------------------------
+# Fixtures
+# ---------------------------------------------------------------------------
+
+@pytest.fixture
+def user(db):
+    return User.objects.create_user(
+        username='rag_user', password='pw',
+        is_staff=True, is_superuser=True,
+    )
+
+
+@pytest.fixture
+def token(db, user):
+    return Token.objects.create(user=user)
+
+
+@pytest.fixture
+def authed_client(token):
+    """APIClient with the Token header set. The /sapi/ URL prefix passes
+    through swirl.middleware.TokenMiddleware, which 403s any request
+    missing an ``Authorization`` header — session auth alone isn't
+    enough at this layer."""
+    c = APIClient()
+    c.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
+    return c
+
+
+@pytest.fixture
+def search(db, user):
+    return Search.objects.create(
+        owner=user,
+        query_string='diabetes treatments',
+        searchprovider_list=[1],
+        status='FULL_RESULTS_READY',
+    )
+
+
+@pytest.fixture
+def cached_rag_result(db, user, search):
+    """Simulates the Result row written by the auto-RAG path
+    (swirl/search.py:302 → RAGPostResultProcessor on search completion)."""
+    return Result.objects.create(
+        owner=user,
+        search_id=search,
+        searchprovider='ChatGPT',
+        json_results=[{
+            'rag_query_items': ['result-1', 'result-2', 'result-3'],
+            'body': ['Auto-RAG summary: diabetes treatments include lifestyle changes, ...'],
+            'additional_content': {'sources': [{'url': 'https://example.com/d1'}]},
+        }],
+    )
+
+
+# ---------------------------------------------------------------------------
+# Regression: detail-search-rag fetch must not delete + regenerate the
+# cached Result when the URL omits ?rag_items=…
+# ---------------------------------------------------------------------------
+
+@pytest.mark.django_db
+def test_detail_rag_fetch_without_rag_items_serves_cache(authed_client, search, cached_rag_result):
+    """REGRESSION 4.5.0.5.
+
+    Galaxy's typical follow-up flow is:
+      1. POST /swirl/search/?qs=…&rag=true → auto-RAG writes Result A
+      2. GET  /swirl/sapi/detail-search-rag/?search_id=N
+              (no rag_items in URL — Galaxy hasn't asked to filter)
+
+    Pre-fix, step 2 saw set(stored_items) == set([]) → False → cache miss →
+    RAGPostResultProcessor.__init__ deleted Result A and generated Result B
+    against a fresh OpenAI call. User saw the summary appear, then swap.
+
+    Post-fix, step 2 must return the cached body and NOT delete Result A.
+    """
+    original_pk = cached_rag_result.pk
+    original_body = cached_rag_result.json_results[0]['body'][0]
+
+    c = authed_client
+
+    r = c.get(f'/swirl/sapi/detail-search-rag/?search_id={search.pk}')
+
+    assert r.status_code == 200, f'expected 200; got {r.status_code} body={r.content!r:.200}'
+    body = r.json()
+    assert body['message'] == original_body, (
+        f'expected cached body to be served verbatim; got {body["message"]!r}'
+    )
+
+    # The load-bearing assertion: the Result row must still exist with the
+    # same primary key. Pre-fix this would fail because the processor
+    # deleted Result A and (if RAGPostResultProcessor managed to run a full
+    # generate-and-save cycle) created Result B with a different pk.
+    assert Result.objects.filter(pk=original_pk).exists(), (
+        'Cached Result was deleted on detail-search-rag fetch — '
+        'this is the 4.5.0.5 regression (double-RAG / result swap)'
+    )
+
+
+@pytest.mark.django_db
+def test_detail_rag_fetch_with_matching_rag_items_serves_cache
```

**File**: `swirl/views_helpers/search_rag.py` (modified, +14/-19)
```diff
@@ -60,33 +60,28 @@ def _extract_result(self, json_result: dict) -> tuple:
         return body_text, additional_content
 
     def get_rag_result(self) -> tuple:
-        isRagItemsUpdated = False
+        # Cache check. An empty ``self.rag_query_items`` means the caller did
+        # NOT pass ``?rag_items=…`` — treat that as "no filter requested,
+        # serve whatever's stored" rather than "items changed, regenerate".
+        # Previously the latter interpretation caused every detail-search-rag
+        # fetch to delete-and-recreate the Result generated by the auto-RAG
+        # path (swirl/search.py:302), so the user saw one summary appear and
+        # then a different summary replace it seconds later.
         try:
             rag_result = Result.objects.get(
                 search_id=self.search_id, searchprovider="ChatGPT"
             )
-            isRagItemsUpdated = True
-            isRagItemsUpdated = not (
-                set(rag_result.json_results[0]["rag_query_items"])
-                == set(self.rag_query_items)
-            )
-        except:
-            pass
-        try:
-            rag_result = Result.objects.get(
-                search_id=self.search_id, searchprovider="ChatGPT"
-            )
-            isRagItemsUpdated = not (
-                set(rag_result.json_results[0]["rag_query_items"])
-                == set(self.rag_query_items)
-            )
-            if rag_result and not isRagItemsUpdated:
+        except Result.DoesNotExist:
+            rag_result = None
+
+        if rag_result is not None:
+            stored_items = set(rag_result.json_results[0].get("rag_query_items") or [])
+            requested_items = set(self.rag_query_items)
+            if not requested_items or requested_items == stored_items:
                 body_text, additional_content = self._extract_result(rag_result.json_results[0])
                 if body_text:
                     return body_text, additional_content
                 return False, {}
-        except:
-            pass
         rag_processor = RAGPostResultProcessor(
             search_id=self.search_id,
             request_id="",
```

---

### Incident Patch 3: `397c75ef` (2026-05-20)
**Commit Message**: fix: OptionalTokenAuthentication — fall through on invalid token

Replaces the bare TokenAuthentication-first reorder on SearchViewSet
(shipped in 4.5.0.3 via PR #1907) with a narrower class that fixes
both halves of the bug instead of trading one for the other.

The 4.5.0.3 release reordered SearchViewSet.authentication_classes to
[TokenAuthentication, SessionAuthentication, BasicAuthentication] so
that Galaxy's explicit `Authorization: Token <key>` header would win
before SessionAuthentication enforced CSRF on unsafe methods (which
had been rejecting search-history DELETEs as 403). That worked for
clients that always send a valid token — but stock TokenAuthentication
raises AuthenticationFailed on an invalid/unknown/stale Authorization
header. DRF short-circuits the auth chain on a raise; SessionAuth
never gets a chance. Result: anywhere the same client carried both a
stale Token header AND a valid session cookie, the request returned
401 — which the Galaxy auth-interceptor handled by calling logout()
and triggering a page reload, cascading every subsequent search to
fail. qa-suite caught this an hour into the 4.5.0.3 test-build-pipeline.

OptionalTokenAuthentication subclasses T

**File**: `swirl/authentication.py` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+"""
+Custom Django REST Framework authentication classes for SWIRL.
+"""
+
+from rest_framework import exceptions
+from rest_framework.authentication import TokenAuthentication
+
+
+class OptionalTokenAuthentication(TokenAuthentication):
+    """
+    A TokenAuthentication variant that returns ``None`` instead of raising
+    ``AuthenticationFailed`` when an ``Authorization: Token <key>`` header
+    is present but the key is unknown / inactive / malformed.
+
+    Why this exists
+    ---------------
+    Stock ``rest_framework.authentication.TokenAuthentication`` raises
+    ``AuthenticationFailed`` as soon as it sees an Authorization header
+    that *looks* like Token auth but doesn't validate. DRF's auth chain
+    treats that as a hard 401 — subsequent authentication classes in the
+    viewset's ``authentication_classes`` list never get a chance.
+
+    For viewsets that legitimately accept BOTH Token and Session auth
+    (e.g. anything Galaxy can call), this is a problem: Galaxy stores
+    its API token in localStorage and attaches it to every request, but
+    the same browser also carries a Django session cookie set during
+    form login. If the localStorage token is stale (expired, revoked,
+    or carried over from a previous login in the same Selenium session)
+    while the session cookie is still valid, the stock behaviour is:
+
+        TokenAuthentication.authenticate() raises -> DRF returns 401
+        SessionAuthentication.authenticate() never runs
+
+    This class makes that case fall through instead — the request gets
+    a chance to authenticate via the session cookie. Concrete impact:
+    the SWIRL search-history delete flow used to round-trip a 403 (from
+    CSRF on SessionAuth) and the Galaxy interceptor over-reacted by
+    clearing localStorage. The original fix put Token auth first to
+    bypass CSRF on safe-Token requests, but that exposed the
+    stale-Token-but-valid-session 401 documented above. This class
+    resolves both: Token wins when valid; Session is tried when Token
+    is invalid.
+
+    Security note
+    -------------
+    A bogus Token header from an unauthenticated client now returns 401
+    via the BasicAuth/SessionAuth tail of the chain rather than the more
+    specific "Invalid token" message TokenAuthentication would have
+    produced. That is intentional — the failure mode is the same (401)
+    and the diagnostic difference doesn't aid an attacker.
+    """
+
+    def authenticate(self, request):
+        try:
+            return super().authenticate(request)
+        except exceptions.AuthenticationFailed:
+            return None
```

**File**: `swirl/tests/test_authentication.py` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+"""
+Unit + integration tests for swirl.authentication.OptionalTokenAuthentication.
+
+The unit tests exercise the class in isolation.
+
+The integration tests against SearchViewSet are the regression coverage for
+4.5.0.3: that release reordered SearchViewSet's authentication_classes to put
+stock TokenAuthentication first, which short-circuited the auth chain when the
+client sent an invalid/stale Token header alongside a valid session cookie —
+exactly the state Selenium / Galaxy ends up in across qa-suite scenarios.
+qa-suite caught it (~50 min into the run); this test catches it in unit-tests
+(seconds).
+
+Run with:  pytest swirl/tests/test_authentication.py -v
+"""
+
+from unittest.mock import MagicMock
+
+import pytest
+from django.contrib.auth.models import User
+from django.test import RequestFactory
+from rest_framework.authtoken.models import Token
+from rest_framework.test import APIClient
+
+from swirl.authentication import OptionalTokenAuthentication
+
+
+# ---------------------------------------------------------------------------
+# Fixtures
+# ---------------------------------------------------------------------------
+
+@pytest.fixture
+def user(db):
+    # Superuser so the test bypasses SearchViewSet's per-method has_perm()
+    # checks. We're testing the auth chain, not the permission layer.
+    return User.objects.create_user(
+        username='auth_user', password='pw',
+        is_staff=True, is_superuser=True,
+    )
+
+
+@pytest.fixture
+def valid_token(db, user):
+    return Token.objects.create(user=user)
+
+
+# ---------------------------------------------------------------------------
+# Unit tests — OptionalTokenAuthentication in isolation
+# ---------------------------------------------------------------------------
+
+@pytest.mark.django_db
+def test_optional_token_auth_valid_token_authenticates(user, valid_token):
+    """Valid Token header → returns (user, token) tuple (matches stock behaviour)."""
+    rf = RequestFactory()
+    req = rf.get('/api/swirl/sapi/search/', HTTP_AUTHORIZATION=f'Token {valid_token.key}')
+    result = OptionalTokenAuthentication().authenticate(req)
+    assert result is not None
+    auth_user, auth_token = result
+    assert auth_user == user
+    assert auth_token == valid_token
+
+
+@pytest.mark.django_db
+def test_optional_token_auth_invalid_token_returns_none(db):
+    """Invalid Token header → returns None (NOT raise) so the next auth class can try.
+
+    This is the behaviour that distinguishes OptionalToken from stock Token.
+    Stock TokenAuthentication raises AuthenticationFailed here, which DRF
+    converts to a hard 401 — short-circuiting the auth chain.
+    """
+    rf = RequestFactory()
+    req = rf.get('/api/swirl/sapi/search/', HTTP_AUTHORIZATION='Token nosuchtoken')
+    result = OptionalTokenAuthentication().authenticate(req)
+    assert result is None
+
+
+def test_optional_token_auth_no_header_returns_none():
+    """No Authorization header → returns None (matches stock behaviour)."""
+    rf = RequestFactory()
+    req = rf.get('/api/swirl/sapi/search/')
+    result = OptionalTokenAuthentication().authenticate(req)
+    assert result is None
+
+
+def test_optional_token_auth_non_token_header_returns_none():
+    """Authorization header that isn't Token-scheme → returns None.
+
+    Stock TokenAuthentication also returns None in this case (lets other
+    auth classes — e.g. Basic — handle their own scheme).
+    """
+    rf = RequestFactory()
+    req = rf.get('/api/swirl/sapi/search/', HTTP_AUTHORIZATION='Bearer something.jwt.shape')
+    result = OptionalTokenAuthentication().authenticate(req)
+    assert result is None
+
+
+# ---------------------------------------------------------------------------
+# Integration tests — SearchViewSet auth chain
+#
+# These tests are the explicit regression for 4.5.0.3. They drive the full
+# DRF chain (OptionalTokenAuthentication -> SessionAuthentication ->
+# BasicAuthentication) via APIClient and assert that BOTH halves of the bug
+# stay fixed simultaneously:
+#
+#   (a) Valid Token wins cleanly without CSRF enforcement on unsafe methods
+#       — this was the original DELETE-403 cascade fix.
+#   (b) Invalid Token alongside a valid session falls through and Session
+#       still authenticates — this is what regressed in 4.5.0.3 and tripped
+#       qa-suite an hour into the run.
+# ---------------------------------------------------------------------------
+
+@pytest.mark.django_db
+def test_searchviewset_valid_token_alone_authenticates(user, valid_token):
+    """Plain Token-only auth (no session) → 200 on GET /swirl/sapi/search/.
+
+    Hits the /swirl/search/ path (not /api/swirl/sapi/search/) because the
+    sapi-prefixed path passes through swirl.middleware.TokenMiddleware,
+    which has its own auth handling; the goal of these tests is to exercise
+    DRF's authentication_classes chain on SearchViewSet directly.
+    """
+    c = APIClient()
+ 
```

**File**: `swirl/views.py` (modified, +13/-9)
```diff
@@ -27,6 +27,7 @@
 from rest_framework.views import APIView
 from rest_framework.authtoken.models import Token
 from rest_framework.authentication import SessionAuthentication, BasicAuthentication, TokenAuthentication
+from swirl.authentication import OptionalTokenAuthentication
 from rest_framework.permissions import IsAuthenticated
 
 from drf_spectacular.utils import extend_schema, OpenApiParameter
@@ -514,15 +515,18 @@ class SearchViewSet(viewsets.ModelViewSet):
     """
     queryset = Search.objects.all()
     serializer_class = SearchSerializer
-    # TokenAuthentication first: when Galaxy sends `Authorization: Token <key>`
-    # alongside a stale session cookie, SessionAuthentication-first caused
-    # DRF to authenticate via the session and then enforce CSRF on unsafe
-    # methods (DELETE / PUT / POST). Without a fresh csrftoken cookie that
-    # matched the X-CSRFToken header, every search-history delete returned
-    # 403, and the Galaxy auth-interceptor over-reacted by clearing
-    # localStorage — appearing to log the user out and wipe their history.
-    # Putting Token first lets the explicit Token header win cleanly.
-    authentication_classes = [TokenAuthentication, SessionAuthentication, BasicAuthentication]
+    # OptionalTokenAuthentication FIRST so the explicit `Authorization: Token`
+    # header Galaxy sends wins cleanly when valid (bypasses CSRF enforcement
+    # on unsafe methods — the original 403 cascade on the search-history
+    # delete flow). OptionalToken differs from stock TokenAuthentication in
+    # one important way: when the token header is present but invalid (stale,
+    # revoked, or carried over from a prior login in the same Selenium /
+    # browser session), it RETURNS None instead of raising
+    # AuthenticationFailed. That hands control to SessionAuthentication,
+    # which authenticates via the session cookie set during form login.
+    # Stock TokenAuth would have short-circuited the chain at 401, which is
+    # what regressed the QA suite on 4.5.0.3.
+    authentication_classes = [OptionalTokenAuthentication, SessionAuthentication, BasicAuthentication]
 
     def report(self):
         return self.queryset
```

---

### Incident Patch 4: `7da61ec0` (2026-05-20)
**Commit Message**: Merge pull request #1904 from swirlai/fix/searchviewset-token-auth-priority

fix(SearchViewSet): put TokenAuthentication first to bypass CSRF on DELETE

**File**: `swirl/views.py` (modified, +9/-1)
```diff
@@ -514,7 +514,15 @@ class SearchViewSet(viewsets.ModelViewSet):
     """
     queryset = Search.objects.all()
     serializer_class = SearchSerializer
-    authentication_classes = [SessionAuthentication, BasicAuthentication, TokenAuthentication]
+    # TokenAuthentication first: when Galaxy sends `Authorization: Token <key>`
+    # alongside a stale session cookie, SessionAuthentication-first caused
+    # DRF to authenticate via the session and then enforce CSRF on unsafe
+    # methods (DELETE / PUT / POST). Without a fresh csrftoken cookie that
+    # matched the X-CSRFToken header, every search-history delete returned
+    # 403, and the Galaxy auth-interceptor over-reacted by clearing
+    # localStorage — appearing to log the user out and wipe their history.
+    # Putting Token first lets the explicit Token header win cleanly.
+    authentication_classes = [TokenAuthentication, SessionAuthentication, BasicAuthentication]
 
     def report(self):
         return self.queryset
```

---

### Incident Patch 5: `af0417e7` (2026-05-20)
**Commit Message**: fix(SearchViewSet): put TokenAuthentication first to bypass CSRF on DELETE

Galaxy's search-history "delete row" handler sends:
  DELETE /api/swirl/sapi/search/<id>/
  Authorization: Token <key>
  X-CSRFToken: <csrf>

The Galaxy session also carries a sessionid cookie because the user
authenticated via the form login. DRF iterates authentication_classes
in order; with SessionAuthentication listed first, the session cookie
won the race and SessionAuthentication's enforce_csrf() ran on this
unsafe method. Any mismatch or missing csrftoken cookie (common with
SPAs that have been open across server restarts) produced a 403 — and
the explicit Token header never got a chance to authenticate.

The Galaxy auth-interceptor over-reacted to the 403 by wiping
localStorage, which surfaced to the user as:

  1. The search-history list appeared to clear
  2. The next page reload logged them out
  3. The original row was never deleted

That interceptor over-reaction is being fixed separately on the Galaxy
side. The root cause — Token auth losing to Session auth + CSRF check —
is fixed here by reordering authentication_classes so TokenAuthentication
runs first. When the request carries `Authorizati

**File**: `swirl/views.py` (modified, +9/-1)
```diff
@@ -514,7 +514,15 @@ class SearchViewSet(viewsets.ModelViewSet):
     """
     queryset = Search.objects.all()
     serializer_class = SearchSerializer
-    authentication_classes = [SessionAuthentication, BasicAuthentication, TokenAuthentication]
+    # TokenAuthentication first: when Galaxy sends `Authorization: Token <key>`
+    # alongside a stale session cookie, SessionAuthentication-first caused
+    # DRF to authenticate via the session and then enforce CSRF on unsafe
+    # methods (DELETE / PUT / POST). Without a fresh csrftoken cookie that
+    # matched the X-CSRFToken header, every search-history delete returned
+    # 403, and the Galaxy auth-interceptor over-reacted by clearing
+    # localStorage — appearing to log the user out and wipe their history.
+    # Putting Token first lets the explicit Token header win cleanly.
+    authentication_classes = [TokenAuthentication, SessionAuthentication, BasicAuthentication]
 
     def report(self):
         return self.queryset
```

---

### Incident Patch 6: `0963e4ae` (2026-05-20)
**Commit Message**: Merge pull request #1899 from swirlai/fix/4-5-stability-galaxy-unblock-and-deps-pinning

fix: unblock Galaxy AI drawer, refresh login logo, pin dependency versions

**File**: `requirements.txt` (modified, +8/-8)
```diff
@@ -1,5 +1,5 @@
 requests
-Django
+Django>=5.2,<6.0
 django_restframework
 django-celery-beat
 Celery
@@ -18,30 +18,30 @@ nltk
 bs4
 google-cloud-bigquery
 opensearch-py
-openai
+openai>=2.24.0,<3
 msal
 PyJWT
 pyahocorasick
-redis
+redis>=7,<8
 xmltodict
 lxml[html_clean]
 readability-lxml
 tiktoken
 channels
-channels-redis
+channels-redis>=4,<5
 tika
 pymongo
 snowflake-connector-python==3.17.3
 oracledb
 psycopg2-binary
-transformers
-torch
+transformers>=4.57,<5
+torch>=2.9,<3
 pinecone
 pandas
 drf-spectacular
 qdrant-client==1.10.0
 presidio-analyzer
 presidio-anonymizer
 func_timeout
-litellm
-pydantic>=2.0
\ No newline at end of file
+litellm>=1.83.10,<1.84
+pydantic>=2.0,<3
\ No newline at end of file
```

**File**: `swirl/middleware.py` (modified, +14/-1)
```diff
@@ -31,7 +31,20 @@ def __call__(self, request):
             return HttpResponseForbidden()
 
         auth_header = request.headers['Authorization']
-        token = auth_header.split(' ')[1]
+        # Defensive split: the Authorization header is expected to be
+        # ``<scheme> <credentials>`` (e.g. ``Token abc123``). Anything
+        # malformed — empty value, scheme-only, no space at all — used to
+        # IndexError out of ``split(' ')[1]`` and surface as a 500.
+        # Treat any malformed header as Forbidden, same as a token that
+        # isn't on file. Symptoms before the fix: any /sapi/ request from
+        # a client that sent ``Authorization: Token `` (empty value) or
+        # ``Authorization: Bearer`` (no value) crashed instead of being
+        # rejected, and Galaxy's getIsAIProviderExistsStatus error path
+        # hid the AI drawer (including the ai_instructions textarea).
+        parts = auth_header.split(' ', 1)
+        if len(parts) != 2 or not parts[1].strip():
+            return HttpResponseForbidden()
+        token = parts[1].strip()
         try:
             token_obj = Token.objects.get(key=token)
             request.user = token_obj.user
```

**File**: `swirl/tests/test_middleware.py` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+"""
+Unit tests for swirl.middleware.TokenMiddleware.
+
+Covers the Authorization-header defensive parsing fix: malformed headers
+(empty value, scheme-only, no-space) used to ``IndexError`` out of
+``auth_header.split(' ')[1]`` and surface as a 500. They should now
+return 403 Forbidden, matching the policy for unknown tokens.
+
+Symptom in 4.5.0.x without this fix: any /sapi/ request from a client
+that sent ``Authorization: Token`` (no value) or ``Authorization: Bearer``
+crashed the request, and Galaxy's getIsAIProviderExistsStatus error path
+hid the AI drawer (including the new ai_instructions textarea).
+
+Run with:  pytest swirl/tests/test_middleware.py -v
+"""
+
+from unittest.mock import MagicMock
+
+import pytest
+
+from django.contrib.auth.models import User
+from rest_framework.authtoken.models import Token
+
+from swirl.middleware import TokenMiddleware
+
+
+# ---------------------------------------------------------------------------
+# Helpers
+# ---------------------------------------------------------------------------
+
+def _request(path='/api/swirl/sapi/ai_providers/', headers=None):
+    """Minimal Django-like request stub. .path + .headers (dict) are all
+    the auth-check branch of TokenMiddleware reads."""
+    req = MagicMock(name='request')
+    req.path = path
+    req.headers = headers or {}
+    return req
+
+
+def _middleware():
+    """Returns (middleware_instance, get_response_mock, downstream_sentinel)."""
+    sentinel = MagicMock(name='downstream_response')
+    get_response = MagicMock(name='get_response', return_value=sentinel)
+    return TokenMiddleware(get_response), get_response, sentinel
+
+
+# ---------------------------------------------------------------------------
+# Valid-path behaviour (sanity checks so the malformed tests aren't false-
+# positive: we want to confirm the auth-check branch is actually reached).
+# ---------------------------------------------------------------------------
+
+@pytest.mark.django_db
+def test_valid_token_passes_through():
+    user = User.objects.create_user(username='mw_valid', password='pw')
+    token = Token.objects.create(user=user)
+
+    mw, get_response, sentinel = _middleware()
+    req = _request(headers={'Authorization': f'Token {token.key}'})
+
+    result = mw(req)
+
+    assert result is sentinel
+    assert req.user == user
+    get_response.assert_called_once_with(req)
+
+
+@pytest.mark.django_db
+def test_unknown_token_returns_403():
+    mw, get_response, _ = _middleware()
+    req = _request(headers={'Authorization': 'Token nosuchtoken'})
+
+    result = mw(req)
+
+    assert result.status_code == 403
+    get_response.assert_not_called()
+
+
+def test_missing_authorization_header_returns_403():
+    mw, get_response, _ = _middleware()
+    req = _request(headers={})
+
+    result = mw(req)
+
+    assert result.status_code == 403
+    get_response.assert_not_called()
+
+
+# ---------------------------------------------------------------------------
+# Malformed-header regression coverage. Each of these used to IndexError
+# out of `auth_header.split(' ')[1]` and surface as a 500. They should now
+# all return 403 Forbidden.
+# ---------------------------------------------------------------------------
+
+@pytest.mark.parametrize('header_value', [
+    'Token',           # scheme only, no space, no value
+    'Bearer',          # ditto
+    'Token ',          # scheme + trailing space, empty value
+    'Token   ',        # scheme + multiple spaces, empty value
+    'tokenwithoutscheme',
+    '',                # empty header value
+    '   ',             # whitespace-only header
+])
+def test_malformed_header_returns_403_not_500(header_value):
+    mw, get_response, _ = _middleware()
+    req = _request(headers={'Authorization': header_value})
+
+    result = mw(req)
+
+    assert result.status_code == 403, (
+        f'Expected 403 Forbidden for malformed header {header_value!r}, '
+        f'got status {getattr(result, "status_code", "n/a")}'
+    )
+    get_response.assert_not_called()
+
+
+# ---------------------------------------------------------------------------
+# Path-routing sanity: the malformed-header path only matters when the
+# auth-check branch is reached. Confirm non-/sapi/ paths still skip auth.
+# ---------------------------------------------------------------------------
+
+def test_non_sapi_path_skips_auth_check():
+    """Paths that don't contain /sapi/ (and aren't /swirl/logout/) bypass
+    the token check entirely — no Authorization header required."""
+    mw, get_response, sentinel = _middleware()
+    req = _request(path='/swirl/admin/', headers={})
+
+    result = mw(req)
+
+    assert result is sentinel
+    get_response.assert_called_once_with(req)
+
+
+def test_branding_path_bypasses_auth():
+    """The /api/swirl/sapi/branding/ path is explicitly whitelisted at the
+    top of __call__ — the login page hits it before any auth."""
+    mw, get_response, sen
```

**File**: `swirl/urls.py` (modified, +7/-0)
```diff
@@ -27,6 +27,13 @@
 router.register(r'sapi/authenticators', views.AuthenticatorViewSet, basename='galaxy-authenticators')
 router.register(r'sapi/searchproviders', views.SearchProviderViewSet, basename='galaxy-searchproviders'),
 router.register(r'sapi/branding', views.BrandingConfigurationViewSet, basename='galaxy-branding')
+# Galaxy's swirl.service.ts hardcodes /api/swirl/sapi/ai_providers/?tag=rag for the
+# RAG model selector / AI-instructions drawer gate. The AIProviderViewSet was only
+# registered at the top-level /swirl/aiproviders/ path, so the Galaxy call 404'd
+# and the box.component never rendered the drawer (the ai_instructions textarea
+# lives inside it). Mirror the SearchProvider pattern: expose the same viewset at
+# the sapi/ path Galaxy expects.
+router.register(r'sapi/ai_providers', views.AIProviderViewSet, basename='galaxy-ai-providers')
 
 urlpatterns = [
     # drf-spectacular paths for API schema and documentation
```

---

### Incident Patch 7: `fcf52d9d` (2026-05-20)
**Commit Message**: fix: unblock Galaxy AI drawer, refresh login logo, pin dependency versions

Bundles the 4.5 post-release stability work into a single change.

backend (fixes that gate Galaxy's AI drawer)
- swirl/middleware.py: safe split on Authorization header. Malformed
  headers (empty value, scheme-only, no space) used to IndexError out
  of `auth_header.split(' ')[1]` and surface as 500, which crashed
  /sapi/ai_providers/ and hid the AI drawer in Galaxy. Now returns 403,
  matching the policy for unknown tokens.
- swirl/urls.py: register AIProviderViewSet at the sapi/ai_providers/
  path Galaxy's swirl.service.ts hardcodes. Previously the viewset was
  only at the top-level /swirl/aiproviders/, so the sapi-prefixed call
  404'd and the box.component never rendered the drawer.
- swirl/tests/test_middleware.py: regression coverage. Twelve cases
  including parametrised malformed-header inputs that previously 500'd.

brand
- uploads/logo_highres_{light,dark}.png: Chrome-rasterized PNGs of the
  canonical Galaxy lockup (per BRAND-ASSETS.md). Old files were the
  pre-Galaxy-rebrand legacy logo, identical bytes across light/dark.

dependencies (supply-chain hardening)
- requirements.txt: pin Djang

**File**: `requirements.txt` (modified, +8/-8)
```diff
@@ -1,5 +1,5 @@
 requests
-Django
+Django>=5.2,<6.0
 django_restframework
 django-celery-beat
 Celery
@@ -18,30 +18,30 @@ nltk
 bs4
 google-cloud-bigquery
 opensearch-py
-openai
+openai>=2.24.0,<3
 msal
 PyJWT
 pyahocorasick
-redis
+redis>=7,<8
 xmltodict
 lxml[html_clean]
 readability-lxml
 tiktoken
 channels
-channels-redis
+channels-redis>=4,<5
 tika
 pymongo
 snowflake-connector-python==3.17.3
 oracledb
 psycopg2-binary
-transformers
-torch
+transformers>=4.57,<5
+torch>=2.9,<3
 pinecone
 pandas
 drf-spectacular
 qdrant-client==1.10.0
 presidio-analyzer
 presidio-anonymizer
 func_timeout
-litellm
-pydantic>=2.0
\ No newline at end of file
+litellm>=1.83.10,<1.84
+pydantic>=2.0,<3
\ No newline at end of file
```

**File**: `swirl/middleware.py` (modified, +14/-1)
```diff
@@ -31,7 +31,20 @@ def __call__(self, request):
             return HttpResponseForbidden()
 
         auth_header = request.headers['Authorization']
-        token = auth_header.split(' ')[1]
+        # Defensive split: the Authorization header is expected to be
+        # ``<scheme> <credentials>`` (e.g. ``Token abc123``). Anything
+        # malformed — empty value, scheme-only, no space at all — used to
+        # IndexError out of ``split(' ')[1]`` and surface as a 500.
+        # Treat any malformed header as Forbidden, same as a token that
+        # isn't on file. Symptoms before the fix: any /sapi/ request from
+        # a client that sent ``Authorization: Token `` (empty value) or
+        # ``Authorization: Bearer`` (no value) crashed instead of being
+        # rejected, and Galaxy's getIsAIProviderExistsStatus error path
+        # hid the AI drawer (including the ai_instructions textarea).
+        parts = auth_header.split(' ', 1)
+        if len(parts) != 2 or not parts[1].strip():
+            return HttpResponseForbidden()
+        token = parts[1].strip()
         try:
             token_obj = Token.objects.get(key=token)
             request.user = token_obj.user
```

**File**: `swirl/tests/test_middleware.py` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+"""
+Unit tests for swirl.middleware.TokenMiddleware.
+
+Covers the Authorization-header defensive parsing fix: malformed headers
+(empty value, scheme-only, no-space) used to ``IndexError`` out of
+``auth_header.split(' ')[1]`` and surface as a 500. They should now
+return 403 Forbidden, matching the policy for unknown tokens.
+
+Symptom in 4.5.0.x without this fix: any /sapi/ request from a client
+that sent ``Authorization: Token`` (no value) or ``Authorization: Bearer``
+crashed the request, and Galaxy's getIsAIProviderExistsStatus error path
+hid the AI drawer (including the new ai_instructions textarea).
+
+Run with:  pytest swirl/tests/test_middleware.py -v
+"""
+
+from unittest.mock import MagicMock
+
+import pytest
+
+from django.contrib.auth.models import User
+from rest_framework.authtoken.models import Token
+
+from swirl.middleware import TokenMiddleware
+
+
+# ---------------------------------------------------------------------------
+# Helpers
+# ---------------------------------------------------------------------------
+
+def _request(path='/api/swirl/sapi/ai_providers/', headers=None):
+    """Minimal Django-like request stub. .path + .headers (dict) are all
+    the auth-check branch of TokenMiddleware reads."""
+    req = MagicMock(name='request')
+    req.path = path
+    req.headers = headers or {}
+    return req
+
+
+def _middleware():
+    """Returns (middleware_instance, get_response_mock, downstream_sentinel)."""
+    sentinel = MagicMock(name='downstream_response')
+    get_response = MagicMock(name='get_response', return_value=sentinel)
+    return TokenMiddleware(get_response), get_response, sentinel
+
+
+# ---------------------------------------------------------------------------
+# Valid-path behaviour (sanity checks so the malformed tests aren't false-
+# positive: we want to confirm the auth-check branch is actually reached).
+# ---------------------------------------------------------------------------
+
+@pytest.mark.django_db
+def test_valid_token_passes_through():
+    user = User.objects.create_user(username='mw_valid', password='pw')
+    token = Token.objects.create(user=user)
+
+    mw, get_response, sentinel = _middleware()
+    req = _request(headers={'Authorization': f'Token {token.key}'})
+
+    result = mw(req)
+
+    assert result is sentinel
+    assert req.user == user
+    get_response.assert_called_once_with(req)
+
+
+@pytest.mark.django_db
+def test_unknown_token_returns_403():
+    mw, get_response, _ = _middleware()
+    req = _request(headers={'Authorization': 'Token nosuchtoken'})
+
+    result = mw(req)
+
+    assert result.status_code == 403
+    get_response.assert_not_called()
+
+
+def test_missing_authorization_header_returns_403():
+    mw, get_response, _ = _middleware()
+    req = _request(headers={})
+
+    result = mw(req)
+
+    assert result.status_code == 403
+    get_response.assert_not_called()
+
+
+# ---------------------------------------------------------------------------
+# Malformed-header regression coverage. Each of these used to IndexError
+# out of `auth_header.split(' ')[1]` and surface as a 500. They should now
+# all return 403 Forbidden.
+# ---------------------------------------------------------------------------
+
+@pytest.mark.parametrize('header_value', [
+    'Token',           # scheme only, no space, no value
+    'Bearer',          # ditto
+    'Token ',          # scheme + trailing space, empty value
+    'Token   ',        # scheme + multiple spaces, empty value
+    'tokenwithoutscheme',
+    '',                # empty header value
+    '   ',             # whitespace-only header
+])
+def test_malformed_header_returns_403_not_500(header_value):
+    mw, get_response, _ = _middleware()
+    req = _request(headers={'Authorization': header_value})
+
+    result = mw(req)
+
+    assert result.status_code == 403, (
+        f'Expected 403 Forbidden for malformed header {header_value!r}, '
+        f'got status {getattr(result, "status_code", "n/a")}'
+    )
+    get_response.assert_not_called()
+
+
+# ---------------------------------------------------------------------------
+# Path-routing sanity: the malformed-header path only matters when the
+# auth-check branch is reached. Confirm non-/sapi/ paths still skip auth.
+# ---------------------------------------------------------------------------
+
+def test_non_sapi_path_skips_auth_check():
+    """Paths that don't contain /sapi/ (and aren't /swirl/logout/) bypass
+    the token check entirely — no Authorization header required."""
+    mw, get_response, sentinel = _middleware()
+    req = _request(path='/swirl/admin/', headers={})
+
+    result = mw(req)
+
+    assert result is sentinel
+    get_response.assert_called_once_with(req)
+
+
+def test_branding_path_bypasses_auth():
+    """The /api/swirl/sapi/branding/ path is explicitly whitelisted at the
+    top of __call__ — the login page hits it before any auth."""
+    mw, get_response, sen
```

**File**: `swirl/urls.py` (modified, +7/-0)
```diff
@@ -27,6 +27,13 @@
 router.register(r'sapi/authenticators', views.AuthenticatorViewSet, basename='galaxy-authenticators')
 router.register(r'sapi/searchproviders', views.SearchProviderViewSet, basename='galaxy-searchproviders'),
 router.register(r'sapi/branding', views.BrandingConfigurationViewSet, basename='galaxy-branding')
+# Galaxy's swirl.service.ts hardcodes /api/swirl/sapi/ai_providers/?tag=rag for the
+# RAG model selector / AI-instructions drawer gate. The AIProviderViewSet was only
+# registered at the top-level /swirl/aiproviders/ path, so the Galaxy call 404'd
+# and the box.component never rendered the drawer (the ai_instructions textarea
+# lives inside it). Mirror the SearchProvider pattern: expose the same viewset at
+# the sapi/ path Galaxy expects.
+router.register(r'sapi/ai_providers', views.AIProviderViewSet, basename='galaxy-ai-providers')
 
 urlpatterns = [
     # drf-spectacular paths for API schema and documentation
```

---

### Incident Patch 8: `2200a7fc` (2026-05-19)
**Commit Message**: release: SWIRL Community 4.5.0.1 — security patch

Re-freezes requirements.txt to clear ~30 CVEs reported by Docker Scout
on swirlai/swirl-search:4.5.0.0. Bumps banner to 4.5.0.1.

Direct CVE bumps:
- litellm    1.83.0  -> 1.83.10  (CVE-2026-42208 critical, +42271, +42203, +40217)
- nltk       3.9.2   -> 3.9.4    (CVE-2025-14009 critical, +0846, +33231)
- Django     5.2.9   -> 5.2.13   (CVE-2026-1287, +1207, +25673, +3902, +33034)
- urllib3    2.6.1   -> 2.7.0    (CVE-2026-44432, +21441, +44431)
- ujson      5.11.0  -> 5.12.1   (CVE-2026-44660, +32875, +32874)
- pyasn1     0.6.1   -> 0.6.3    (CVE-2026-30922, +23490)
- cryptography 46.0.0 -> 46.0.5  (CVE-2026-26007)
- PyJWT      2.10.1  -> 2.12.0   (CVE-2026-32597)
- lxml       6.0.2   -> 6.1.0    (CVE-2026-41066)
- orjson     3.11.5  -> 3.11.6   (CVE-2025-67221)
- pyOpenSSL  25.3.0  -> 26.0.0   (CVE-2026-27459)
- azure-core 1.36.0  -> 1.38.0   (CVE-2026-21226)
- cbor2      5.7.1   -> 5.9.0    (CVE-2026-26209)
- protobuf   6.33.2  -> 6.33.5   (CVE-2026-0994)
- jaraco.context (new pin: 6.1.0) (CVE-2026-23949 — was transitive)
- wheel      (new pin: 0.46.2)   (CVE-2026-24049 — was transitive)

Cascade bumps (required by direct bumps)

**File**: `requirements.txt` (modified, +25/-23)
```diff
@@ -1,5 +1,5 @@
 aiohappyeyeballs==2.6.1
-aiohttp==3.13.5
+aiohttp==3.13.3
 aiosignal==1.4.0
 amqp==5.3.1
 annotated-types==0.7.0
@@ -9,7 +9,7 @@ asn1crypto==1.5.1
 attrs==25.4.0
 autobahn==25.11.1
 Automat==25.4.16
-azure-core==1.36.0
+azure-core==1.38.0
 beautifulsoup4==4.14.3
 billiard==4.2.4
 blis==1.3.3
@@ -18,28 +18,28 @@ botocore==1.42.5
 bs4==0.0.2
 cachetools==6.2.2
 catalogue==2.0.10
-cbor2==5.7.1
+cbor2==5.9.0
 celery==5.6.0
 certifi==2025.11.12
-cffi==1.17.1
+cffi==2.0.0
 channels==4.3.2
 channels_redis==4.3.0
 chardet==5.2.0
 charset-normalizer==3.4.4
-click==8.3.1
+click==8.1.8
 click-didyoumean==0.3.1
 click-plugins==1.1.1.2
 click-repl==0.3.0
 cloudpathlib==0.23.0
 confection==0.1.5
 constantly==23.10.4
 cron_descriptor==2.0.6
-cryptography==46.0.0
+cryptography==46.0.5
 cssselect==1.3.0
 cymem==2.0.13
 daphne==4.2.1
 distro==1.9.0
-Django==5.2.9
+Django==5.2.13
 django-celery-beat==2.8.1
 django-environ==0.12.0
 django-restframework==0.0.1
@@ -78,19 +78,20 @@ huggingface-hub==0.36.0
 hyperframe==6.1.0
 hyperlink==21.0.0
 idna==3.11
-importlib_metadata==9.0.0
+importlib_metadata==8.5.0
 Incremental==24.11.0
 inflection==0.5.1
+jaraco.context==6.1.0
 Jinja2==3.1.6
 jiter==0.12.0
 jmespath==1.0.1
 joblib==1.5.2
 jsonpath-ng==1.7.0
-jsonschema==4.25.1
+jsonschema==4.23.0
 jsonschema-specifications==2025.9.1
 kombu==5.6.1
-litellm==1.83.0
-lxml==6.0.2
+litellm==1.83.10
+lxml==6.1.0
 lxml_html_clean==0.4.3
 MarkupSafe==3.0.3
 mpmath==1.3.0
@@ -100,13 +101,13 @@ multidict==6.7.1
 murmurhash==1.0.15
 natsort==8.4.0
 networkx==3.6.1
-nltk==3.9.2
+nltk==3.9.4
 numpy==2.3.5
-openai==2.9.0
+openai==2.24.0
 opensearch-protobufs==0.19.0
 opensearch-py==3.1.0
 oracledb==3.4.1
-orjson==3.11.5
+orjson==3.11.6
 packaging==24.2
 pandas==2.3.3
 phonenumbers==9.0.20
@@ -123,22 +124,22 @@ presidio_anonymizer==2.2.357
 prompt_toolkit==3.0.52
 propcache==0.5.2
 proto-plus==1.26.1
-protobuf==6.33.2
+protobuf==6.33.5
 psycopg2-binary==2.9.11
 py-ubjson==0.16.1
 pyahocorasick==2.2.0
-pyasn1==0.6.1
+pyasn1==0.6.3
 pyasn1_modules==0.4.2
 pycparser==2.23
 pycryptodome==3.23.0
 pydantic==2.12.5
 pydantic_core==2.41.5
-PyJWT==2.10.1
+PyJWT==2.12.0
 pymongo==4.15.5
-pyOpenSSL==25.3.0
+pyOpenSSL==26.0.0
 python-crontab==3.3.0
 python-dateutil==2.9.0.post0
-python-dotenv==1.2.2
+python-dotenv==1.0.1
 pytz==2025.2
 PyYAML==6.0.3
 qdrant-client==1.10.0
@@ -157,7 +158,7 @@ setuptools==80.9.0
 six==1.17.0
 smart_open==7.5.0
 sniffio==1.3.1
-snowflake-connector-python==3.17.3
+snowflake-connector-python==4.5.0
 sortedcontainers==2.4.0
 soupsieve==2.8
 spacy==3.8.11
@@ -172,7 +173,7 @@ thinc==8.3.10
 tika==3.1.0
 tiktoken==0.12.0
 tldextract==5.3.0
-tokenizers==0.22.1
+tokenizers==0.22.2
 tomlkit==0.13.3
 torch==2.9.1
 tqdm==4.67.1
@@ -184,13 +185,14 @@ typing-inspection==0.4.2
 typing_extensions==4.15.0
 tzdata==2025.2
 tzlocal==5.3.1
-ujson==5.11.0
+ujson==5.12.1
 uritemplate==4.2.0
-urllib3==2.6.1
+urllib3==2.7.0
 vine==5.1.0
 wasabi==1.1.3
 wcwidth==0.2.14
 weasel==0.4.3
+wheel==0.46.2
 whitenoise==6.11.0
 wrapt==2.0.1
 xmltodict==1.0.2
```

**File**: `swirl/banner.py` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ class bcolors:
     ENDC = '\033[0m'
     BOLD = '\033[1m'
 
-SWIRL_VERSION = '4.5.0.0'
+SWIRL_VERSION = '4.5.0.1'
 
 SWIRL_BANNER_TEXT = f"SWIRL AI COMMUNITY {SWIRL_VERSION}"
 
```

---

### Incident Patch 9: `9439c717` (2026-05-18)
**Commit Message**: release: pin requirements.txt via pip freeze for 4.5.0.0

Re-froze requirements.txt against a clean python 3.13.5 venv so that
the 5 develop-side dependencies that came in unpinned during the
develop->main merge (presidio-analyzer, presidio-anonymizer,
func_timeout, litellm, pydantic>=2.0) are now pinned to concrete
versions, matching the historical Community release pattern
(see ce413888 "release 4.4.0 to prerelease branch including pip
freeze version of requirements.txt").

Net change: +12 lines / -5 lines.

The 5 previously-unpinned trailer entries are gone; the 5 packages
are now pinned in alphabetical position alongside their newly-pinned
transitive dependencies (aiohttp, aiohappyeyeballs, aiosignal,
fastuuid, frozenlist, importlib_metadata, multidict, propcache,
python-dotenv, yarl, zipp).

Verified clean:
- 199 lines (>= ~150 target)
- No editable installs, no test-only deps, no gpurun contamination
  (grep -E '^-e |gpurun|allure-pytest|behave\b|swirl-search' is empty)

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `requirements.txt` (modified, +12/-5)
```diff
@@ -1,3 +1,6 @@
+aiohappyeyeballs==2.6.1
+aiohttp==3.13.5
+aiosignal==1.4.0
 amqp==5.3.1
 annotated-types==0.7.0
 anyio==4.12.0
@@ -50,7 +53,9 @@ elasticsearch==8.19.2
 en_core_web_lg @ https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.8.0/en_core_web_lg-3.8.0-py3-none-any.whl#sha256=293e9547a655b25499198ab15a525b05b9407a75f10255e405e8c3854329ab63
 Events==0.5
 exceptiongroup==1.3.1
+fastuuid==0.14.0
 filelock==3.20.0
+frozenlist==1.8.0
 fsspec==2025.12.0
 func_timeout==4.3.5
 google-api-core==2.28.1
@@ -73,6 +78,7 @@ huggingface-hub==0.36.0
 hyperframe==6.1.0
 hyperlink==21.0.0
 idna==3.11
+importlib_metadata==9.0.0
 Incremental==24.11.0
 inflection==0.5.1
 Jinja2==3.1.6
@@ -83,12 +89,14 @@ jsonpath-ng==1.7.0
 jsonschema==4.25.1
 jsonschema-specifications==2025.9.1
 kombu==5.6.1
+litellm==1.83.0
 lxml==6.0.2
 lxml_html_clean==0.4.3
 MarkupSafe==3.0.3
 mpmath==1.3.0
 msal==1.34.0
 msgpack==1.1.2
+multidict==6.7.1
 murmurhash==1.0.15
 natsort==8.4.0
 networkx==3.6.1
@@ -113,6 +121,7 @@ preshed==3.0.12
 presidio_analyzer==2.2.360
 presidio_anonymizer==2.2.357
 prompt_toolkit==3.0.52
+propcache==0.5.2
 proto-plus==1.26.1
 protobuf==6.33.2
 psycopg2-binary==2.9.11
@@ -129,6 +138,7 @@ pymongo==4.15.5
 pyOpenSSL==25.3.0
 python-crontab==3.3.0
 python-dateutil==2.9.0.post0
+python-dotenv==1.2.2
 pytz==2025.2
 PyYAML==6.0.3
 qdrant-client==1.10.0
@@ -184,9 +194,6 @@ weasel==0.4.3
 whitenoise==6.11.0
 wrapt==2.0.1
 xmltodict==1.0.2
+yarl==1.23.0
+zipp==3.23.1
 zope.interface==8.1.1
-presidio-analyzer
-presidio-anonymizer
-func_timeout
-litellm
-pydantic>=2.0
```

---

### Incident Patch 10: `97943231` (2026-05-17)
**Commit Message**: Merge pull request #1881 from swirlai/fix/restore-tag-prefix-tags

Drop 'Web' tag from Internet Archive, restore 'InternetArchive'

**File**: `SearchProviders/internet_archive.json` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
     "credentials": "",
     "eval_credentials": "",
     "tags": [
-        "Web",
+        "InternetArchive",
         "Public",
         "RAG-ready"
     ]
```

**File**: `SearchProviders/preloaded.json` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@
         "credentials": "",
         "eval_credentials": "",
         "tags": [
-            "Web",
+            "InternetArchive",
             "Public",
             "RAG-ready"
         ]
```

---

### Incident Patch 11: `cd228b10` (2026-05-17)
**Commit Message**: Merge pull request #1879 from swirlai/fix/restore-tag-prefix-tags

Restore content-type + source-slug tags that back tag-prefix queries

**File**: `SearchProviders/arxiv.json` (modified, +3/-1)
```diff
@@ -22,8 +22,10 @@
     "credentials": "",
     "eval_credentials": "",
     "tags": [
-        "Public",
+        "arXiv",
+        "Articles",
         "STM",
+        "Public",
         "RAG-ready"
     ]
 }
```

**File**: `SearchProviders/asana.json` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@
     "eval_credentials": "",
     "tags": [
         "Asana",
+        "Tasks",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/atlassian.json` (modified, +5/-0)
```diff
@@ -20,6 +20,8 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
+            "Jira",
+            "Issues",
             "Atlassian",
             "Dev"
         ]
@@ -45,6 +47,7 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
+            "Confluence",
             "Atlassian",
             "Dev"
         ]
@@ -77,6 +80,8 @@
         "credentials": "",
         "eval_credentials": "",
         "tags": [
+            "Trello",
+            "Cards",
             "Atlassian",
             "Internal"
         ]
```

**File**: `SearchProviders/blockchain-bitcoin.json` (modified, +4/-0)
```diff
@@ -27,6 +27,8 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
+            "Bitcoin",
+            "HashID",
             "Public"
         ]
     },
@@ -58,6 +60,8 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
+            "Bitcoin",
+            "Wallet",
             "Public"
         ]
     }
```

**File**: `SearchProviders/company_data_bigquery.json` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@
     "eval_credentials": "",
     "tags": [
         "Google",
+        "BigQuery",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/company_snowflake.json` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
     "eval_credentials": "",
     "tags": [
         "Snowflake",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/crunchbase.json` (modified, +2/-0)
```diff
@@ -56,6 +56,8 @@
     "eval_credentials": "",
     "tags": [
         "Crunchbase",
+        "Organizations",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/elasticsearch.json` (modified, +3/-0)
```diff
@@ -18,6 +18,9 @@
     "results_per_query": 10,
     "credentials": "verify_certs=[True|False],ca_certs=<path-to-cert-file>,<elastic-username>:<elastic-password>",
     "tags": [
+        "Elastic",
+        "Email",
+        "Enron",
         "Internal"
     ]
 }
```

---

### Incident Patch 12: `fe5e6f47` (2026-05-17)
**Commit Message**: Restore content-type + source-slug tags that back tag-prefix queries

The earlier rename PR dropped tags like Code, Issues, PRs, Commits,
HashID, Wallet, Cards, YouTrack, EuropePMC, EPMC, Trello, etc. on the
theory that they duplicated the left token of the name and were thus
redundant. That theory was wrong: those tags back SWIRL's URL
'<tag>:<query>' syntax via select_providers (utils.py:274), which
matches case-insensitively against the SP tag list. The QA suite
exercises this with queries like 'Code:relevancy', 'HashID:b6f6...',
'EPMC:Risks', 'Trello:conference', 'YouTrack:devops', etc. Without
the tags, those queries fall through to the default sources and the
test scenarios fail because results come back from News - Google News
instead of the expected provider.

Restore the source-slug and content-type tags on every SP, on top of
the audience tags (Internal/Public/Dev/STM/Legal/RAG-ready) and
vendor tags (Google/M365/GitHub/Atlassian/HubSpot/...) that the
earlier rewrite added. Galaxy chips can dedupe display-side if they
want to — the source of truth is the backend tag list, and the
backend needs the full set to keep tag-prefix queries working.

Notably restored:
  - Code, I

**File**: `SearchProviders/arxiv.json` (modified, +3/-1)
```diff
@@ -22,8 +22,10 @@
     "credentials": "",
     "eval_credentials": "",
     "tags": [
-        "Public",
+        "arXiv",
+        "Articles",
         "STM",
+        "Public",
         "RAG-ready"
     ]
 }
```

**File**: `SearchProviders/asana.json` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@
     "eval_credentials": "",
     "tags": [
         "Asana",
+        "Tasks",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/atlassian.json` (modified, +5/-0)
```diff
@@ -20,6 +20,8 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
+            "Jira",
+            "Issues",
             "Atlassian",
             "Dev"
         ]
@@ -45,6 +47,7 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
+            "Confluence",
             "Atlassian",
             "Dev"
         ]
@@ -77,6 +80,8 @@
         "credentials": "",
         "eval_credentials": "",
         "tags": [
+            "Trello",
+            "Cards",
             "Atlassian",
             "Internal"
         ]
```

**File**: `SearchProviders/blockchain-bitcoin.json` (modified, +4/-0)
```diff
@@ -27,6 +27,8 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
+            "Bitcoin",
+            "HashID",
             "Public"
         ]
     },
@@ -58,6 +60,8 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
+            "Bitcoin",
+            "Wallet",
             "Public"
         ]
     }
```

**File**: `SearchProviders/company_data_bigquery.json` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@
     "eval_credentials": "",
     "tags": [
         "Google",
+        "BigQuery",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/company_snowflake.json` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
     "eval_credentials": "",
     "tags": [
         "Snowflake",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/crunchbase.json` (modified, +2/-0)
```diff
@@ -56,6 +56,8 @@
     "eval_credentials": "",
     "tags": [
         "Crunchbase",
+        "Organizations",
+        "Company",
         "Internal"
     ]
 }
```

**File**: `SearchProviders/elasticsearch.json` (modified, +3/-0)
```diff
@@ -18,6 +18,9 @@
     "results_per_query": 10,
     "credentials": "verify_certs=[True|False],ca_certs=<path-to-cert-file>,<elastic-username>:<elastic-password>",
     "tags": [
+        "Elastic",
+        "Email",
+        "Enron",
         "Internal"
     ]
 }
```

---

### Incident Patch 13: `7fa78fb4` (2026-05-17)
**Commit Message**: ci: mount swirl-search preloaded.json into qa-suite container

The swirl-search-qa data_examples loader resolves SP/AIP names by
reading the canonical SearchProviders/preloaded.json and
AIProviders/preloaded.json from a sibling swirl-search checkout (or
the path in $SWIRL_PRELOADED_DIR). The qa-suite Docker image, however,
only bundles the QA repo itself, so inside the container neither
location resolves — behave crashed with FileNotFoundError on the first
step import.

Mount swirl-search-public's two preloaded directories into the
container read-only and set SWIRL_PRELOADED_DIR=/swirl. Applied to
qa-suite.yml, test-build-pipeline.yml, and testing-wip.yml so a manual
behave run via the WIP workflow doesn't hit the same surprise.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/qa-suite.yml` (modified, +10/-1)
```diff
@@ -104,7 +104,16 @@ jobs:
           echo "========"
           cat .env.qa
           echo "========"
-          docker run --net=host --env-file .env.qa -t swirlai/swirl-search-qa:automated-tests-develop sh -c "behave --tags=qa_suite,community --exclude nl_research"
+          # Mount swirl-search-public's preloaded.json files into the QA
+          # container so data_examples/_preloaded.py can resolve them via
+          # $SWIRL_PRELOADED_DIR. Without this the loader raises
+          # FileNotFoundError on the first import inside behave.
+          docker run --net=host --env-file .env.qa \
+            -v "${{ github.workspace }}/SearchProviders:/swirl/SearchProviders:ro" \
+            -v "${{ github.workspace }}/AIProviders:/swirl/AIProviders:ro" \
+            -e SWIRL_PRELOADED_DIR=/swirl \
+            -t swirlai/swirl-search-qa:automated-tests-develop \
+            sh -c "behave --tags=qa_suite,community --exclude nl_research"
       - name: Upload Log Files
         if: always()
         uses: actions/upload-artifact@v4
```

**File**: `.github/workflows/test-build-pipeline.yml` (modified, +10/-1)
```diff
@@ -204,7 +204,16 @@ jobs:
             echo "========"
             cat .env.qa
             echo "========"
-            docker run --net=host --env-file .env.qa -t swirlai/swirl-search-qa:automated-tests-develop sh -c "behave --tags=qa_suite,community"
+            # Mount swirl-search-public's preloaded.json files into the
+            # QA container so data_examples/_preloaded.py can resolve them
+            # via $SWIRL_PRELOADED_DIR. Without this the loader raises
+            # FileNotFoundError on the first import inside behave.
+            docker run --net=host --env-file .env.qa \
+              -v "${{ github.workspace }}/SearchProviders:/swirl/SearchProviders:ro" \
+              -v "${{ github.workspace }}/AIProviders:/swirl/AIProviders:ro" \
+              -e SWIRL_PRELOADED_DIR=/swirl \
+              -t swirlai/swirl-search-qa:automated-tests-develop \
+              sh -c "behave --tags=qa_suite,community"
         # DS-5598: dump every ./logs/*.log produced by `python swirl.py
         # start` into the qa-suite step output so backend WARNING /
         # ERROR lines (RAG-DIAG, exception tracebacks, AIProvider
```

**File**: `.github/workflows/testing-wip.yml` (modified, +9/-1)
```diff
@@ -116,7 +116,15 @@ jobs:
           echo "========"
           cat .env.qa
           echo "========"
-          docker run --net=host --env-file .env.qa -t swirlai/swirl-search-qa:${{ github.event.inputs.qa_image }} sh -c "behave --no-capture --tags=${{ github.event.inputs.behave_tags }}"
+          # Mount swirl-search-public's preloaded.json files into the QA
+          # container so data_examples/_preloaded.py can resolve them via
+          # $SWIRL_PRELOADED_DIR. Required since the loader refactor.
+          docker run --net=host --env-file .env.qa \
+            -v "${{ github.workspace }}/SearchProviders:/swirl/SearchProviders:ro" \
+            -v "${{ github.workspace }}/AIProviders:/swirl/AIProviders:ro" \
+            -e SWIRL_PRELOADED_DIR=/swirl \
+            -t swirlai/swirl-search-qa:${{ github.event.inputs.qa_image }} \
+            sh -c "behave --no-capture --tags=${{ github.event.inputs.behave_tags }}"
       - name: Upload Log Files
         if: always()
         uses: actions/upload-artifact@v4
```

---

### Incident Patch 14: `cc1dfd79` (2026-05-17)
**Commit Message**: Merge pull request #1875 from swirlai/fix/provider-rename-and-log-cleanup

Fix/provider rename and log cleanup

**File**: `.github/workflows/qa-suite.yml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ jobs:
       # (it was a Google PSE flavour pointing at linkedin.com that the team
       # is not maintaining). The previous "PATCH the LinkedIn PSE Config"
       # step targeted provider ID 3, which after the removal is no longer
-      # LinkedIn — it's "Documentation - SWIRL AI". Removing this step
+      # LinkedIn — it's "Docs - SWIRL". Removing this step
       # avoids overwriting the Documentation provider's config with the
       # stale LinkedIn PSE secret.
       #
```

**File**: `.github/workflows/test-build-pipeline.yml` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ jobs:
         # (it was a Google PSE flavour pointing at linkedin.com that the team
         # is not maintaining). The previous "PATCH the LinkedIn PSE Config"
         # step targeted provider ID 3, which after the removal is no longer
-        # LinkedIn — it's "Documentation - SWIRL AI". Removing this step
+        # LinkedIn — it's "Docs - SWIRL". Removing this step
         # avoids overwriting the Documentation provider's config with the
         # stale LinkedIn PSE secret.
         #
```

**File**: `AIProviders/preloaded.json` (modified, +233/-239)
```diff
@@ -1,250 +1,244 @@
 [
-  {
-    "name": "Azure/OpenAI",
-    "active": false,
-    "api_key": "<your-azure-openai-key>",
-    "model": "azure/<your-deployment-name>",
-    "config": {
-      "api_base": "https://<your-azure-resource-name>.openai.azure.com",
-      "api_version": "<your-azure-openai-api-version>"
+    {
+        "name": "Azure OpenAI",
+        "active": false,
+        "api_key": "<your-azure-openai-key>",
+        "model": "azure/<your-deployment-name>",
+        "config": {
+            "api_base": "https://<your-azure-resource-name>.openai.azure.com",
+            "api_version": "<your-azure-openai-api-version>"
+        },
+        "tags": [
+            "query",
+            "connector",
+            "rag",
+            "chat"
+        ],
+        "defaults": [
+            "query",
+            "connector",
+            "rag",
+            "chat"
+        ]
     },
-    "tags": [
-      "query",
-      "connector",
-      "rag",
-      "chat"
-    ],
-    "defaults": [
-      "query",
-      "connector",
-      "rag",
-      "chat"
-    ]
-  },
-  {
-    "name": "OpenAI GPT-5",
-    "active": false,
-    "api_key": "<your-openai-key>",
-    "model": "gpt-5",
-    "config": {},
-    "tags": [
-      "query",
-      "connector",
-      "rag",
-      "chat"
-    ],
-    "defaults": [
-      "query",
-      "connector",
-      "rag",
-      "chat"
-    ]
-  },
-  {
-    "name": "Azure/OpenAI (Embeddings)",
-    "active": false,
-    "api_key": "<your-azure-openai-key>",
-    "model": "azure/<your-embeddings-deployment-name>",
-    "config": {
-      "api_base": "https://<your-resource>.openai.azure.com",
-      "api_version": "2024-08-01-preview",
-      "dimensions": 1536
+    {
+        "name": "OpenAI GPT",
+        "active": false,
+        "api_key": "<your-openai-key>",
+        "model": "gpt-5",
+        "config": {},
+        "tags": [
+            "query",
+            "connector",
+            "rag",
+            "chat"
+        ],
+        "defaults": [
+            "query",
+            "connector",
+            "rag",
+            "chat"
+        ]
     },
-    "tags": [
-      "reader"
-    ],
-    "defaults": []
-  },
-  {
-    "name": "Anthropic",
-    "active": false,
-    "api_key": "<your-anthropic-key>",
-    "model": "<your-anthropic-model-name>",
-    "config": {
-      "anthropic_version": "<your-anthropic-api-version>",
-      "max_tokens": 170000,
-      "_max_tokens_comment": "Headroom under Claude's 200K context window for system prompt + tool definitions + structured-output schema. Adjust if your model has a different ceiling (Sonnet/Opus also 200K; older Claude variants 100K)."
+    {
+        "name": "Azure OpenAI Embeddings",
+        "active": false,
+        "api_key": "<your-azure-openai-key>",
+        "model": "azure/<your-embeddings-deployment-name>",
+        "config": {
+            "api_base": "https://<your-resource>.openai.azure.com",
+            "api_version": "2024-08-01-preview",
+            "dimensions": 1536
+        },
+        "tags": [
+            "reader"
+        ],
+        "defaults": []
     },
-    "tags": [
-      "query",
-      "connector",
-      "rag",
-      "chat"
-    ],
-    "defaults": [
-    ]
-  },
-  {
-    "name": "Bedrock Embedding",
-    "active": false,
-    "api_key": "<your-bedrock-api-key>",
-    "model": "amazon.<your-bedrock-embedding-model-name>",
-    "config": {
-      "AWS_REGION_NAME": "<your-aws-region-name>"
+    {
+        "name": "Anthropic Claude",
+        "active": false,
+        "api_key": "<your-anthropic-key>",
+        "model": "<your-anthropic-model-name>",
+        "config": {
+            "anthropic_version": "<your-anthropic-api-version>",
+            "max_tokens": 170000,
+            "_max_tokens_comment": "Headroom under Claude's 200K context window for system prompt + tool definitions + structured-output schema. Adjust if your model has a different ceiling (Sonnet/Opus also 200K; older Claude variants 100K)."
+        },
+        "tags": [
+            "query",
+            "connector",
+            "rag",
+            "chat"
+        ],
+        "defaults": []
     },
-    "tags": [
-      "reader"
-    ],
-    "defaults": [
-      "reader"
-    ]
-  },
-  {
-    "name": "Cohere Embeddings",
-    "active": false,
-    "api_key": "<your-cohere-key>",
-    "model": "embed-english-v3.0",
-    "config": {},
-    "tags": [
-      "reader"
-    ],
-    "defaults": [
-      "reader"
-    ]
-  },
-  {
-    "name": "Custom LLM",
-    "active": false,
-    "api_key": "<your-custom-llm-key>",
-    "model": "",
-    "config": {
-      "api_base": "<your-GAI-base-url>",
-      "custom_llm": "<your-llm-type> e.g. 'openai', 'azure', 'anthropic', 'cohere', 'huggingface'"
+    {
+        "name": "AWS Bedrock Embeddings",
+        "active": false,
+        "api_key": "<your-bedrock-api-key>",
+        "model": "amazon.<your-bedrock-embedding-model-name>",
+        "config": {
+            "AWS_REGIO
```

**File**: `SearchProviders/arxiv.json` (modified, +7/-6)
```diff
@@ -1,7 +1,7 @@
 {
-    "name": "Articles - ArXiv",
-    "active": false,
-    "default": false,
+    "name": "Articles - arXiv",
+    "active": true,
+    "default": true,
     "connector": "RequestsGet",
     "url": "http://export.arxiv.org/api/query",
     "query_template": "{url}?search_query=all:{query_string}",
@@ -22,7 +22,8 @@
     "credentials": "",
     "eval_credentials": "",
     "tags": [
-        "arXiv", 
-        "STM"
+        "Public",
+        "STM",
+        "RAG-ready"
     ]
-}
\ No newline at end of file
+}
```

**File**: `SearchProviders/asana.json` (modified, +1/-3)
```diff
@@ -2,7 +2,6 @@
     "name": "Tasks - Asana",
     "active": false,
     "default": false,
-    "authenticator": "",
     "connector": "RequestsGet",
     "url": "https://app.asana.com/api/1.0/workspaces/<your-workspace-gid>/tasks/search?opt_fields=gid,resource_type,assignee_status,completed,completed_at,completed_by.name,created_at,created_by.name,due_on,likes.user.name,modified_at,name,notes,num_subtasks,start_on,assignee.name,assignee_section.name,followers.name,parent.name,permalink_url,projects.name,tags.name,workspace.name",
     "query_template": "{url}&text={query_string}",
@@ -28,7 +27,6 @@
     "eval_credentials": "",
     "tags": [
         "Asana",
-        "Tasks",
         "Internal"
     ]
-}
\ No newline at end of file
+}
```

**File**: `SearchProviders/atlassian.json` (modified, +2/-6)
```diff
@@ -20,13 +20,12 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
-            "Jira",
             "Atlassian",
             "Dev"
         ]
     },
     {
-        "name": "Articles - Atlassian Confluence",
+        "name": "Docs - Atlassian Confluence",
         "active": false,
         "default": false,
         "connector": "RequestsGet",
@@ -46,16 +45,14 @@
         "results_per_query": 10,
         "credentials": "HTTPBasicAuth('<your-username>','<your-atlassian-token>')",
         "tags": [
-            "Confluence",
             "Atlassian",
             "Dev"
         ]
     },
     {
-        "name": "Cards - Atlassian Trello",
+        "name": "Tasks - Atlassian Trello",
         "active": false,
         "default": false,
-        "authenticator": "",
         "connector": "RequestsGet",
         "url": "https://api.trello.com/1/search?modelTypes=cards&card_board=true&card_members=true&card_attachments=true&partial=true&card_list=true&card_fields=id,closed,dueComplete,dateLastActivity,desc,due,email,labels,name,start,url",
         "query_template": "{url}&query={query_string}&key=<your-Trello-API-Key>&token=<your-Trello-API-Token>",
@@ -80,7 +77,6 @@
         "credentials": "",
         "eval_credentials": "",
         "tags": [
-            "Trello",
             "Atlassian",
             "Internal"
         ]
```

**File**: `SearchProviders/blockchain-bitcoin.json` (modified, +6/-10)
```diff
@@ -1,9 +1,8 @@
 [
     {
-        "name": "Transaction - Blockchain.com",
+        "name": "Transactions - Blockchain",
         "active": false,
         "default": false,
-        "authenticator": "",
         "connector": "RequestsGet",
         "url": "https://blockchain.info/rawtx/",
         "query_template": "{url}{query_string}",
@@ -28,15 +27,13 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
-            "Bitcoin",
-            "HashID"
+            "Public"
         ]
     },
     {
-        "name": "Address - Blockchain.com",
+        "name": "Wallets - Blockchain",
         "active": false,
         "default": false,
-        "authenticator": "",
         "connector": "RequestsGet",
         "url": "https://blockchain.info/rawaddr/",
         "query_template": "{url}{query_string}",
@@ -61,8 +58,7 @@
         "eval_credentials": "",
         "tags": [
             "Blockchain",
-            "Bitcoin",
-            "Wallet"
+            "Public"
         ]
-    }    
-]
\ No newline at end of file
+    }
+]
```

**File**: `SearchProviders/company_data_bigquery.json` (modified, +4/-4)
```diff
@@ -1,5 +1,6 @@
 {
-    "name": "Companies - Google BigQuery",
+    "name": "Records - Google BigQuery",
+    "description": "Searches info on 7 million companies worldwide including Linkedin URL, company size, location, and number of employees. Search only with company name, domain or location. Supports many languages. Does not support NOT operator.",
     "active": false,
     "default": false,
     "connector": "BigQuery",
@@ -21,11 +22,10 @@
     "response_mappings": "",
     "result_mappings": "title=name,body='{name} was founded in {year_founded} and serves the {industry} industry. The company is located in {locality} and has approximately {current_employee_estimate} employees. The registered domain for this organization is: {domain}',url='https://www.{linkedin_url}',NO_PAYLOAD",
     "results_per_query": 10,
-    "credentials": "/path/to/bigquery/token.json",
+    "credentials": "<path-to-bigquery-token-json>",
     "eval_credentials": "",
     "tags": [
-        "Company",
-        "BigQuery",
+        "Google",
         "Internal"
     ]
 }
```

---

### Incident Patch 15: `2a82d9e2` (2026-05-16)
**Commit Message**: Merge pull request #1871 from swirlai/fix/m365-mixer-and-admin-ux

Fix/m365 mixer and admin ux

**File**: `swirl/admin.py` (modified, +153/-12)
```diff
@@ -3,13 +3,16 @@
 @contact:    sid@swirl.today
 '''
 
+import json
 import logging
 
 from django import forms
-from django.contrib import admin
+from django.contrib import admin, messages
 from django.contrib.admin.widgets import FilteredSelectMultiple
-from django.shortcuts import render
-from django.urls import path
+from django.contrib.auth import get_user_model
+from django.core.exceptions import FieldError, ValidationError
+from django.shortcuts import redirect, render
+from django.urls import path, reverse
 from django.utils.html import format_html
 
 from .models import AIProvider, SearchProvider, Search, Result, QueryTransform, OauthToken
@@ -81,6 +84,138 @@ def save_model(self, request, obj, form, change):
                     pass
         super().save_model(request, obj, form, change)
 
+# ---------------------------------------------------------------------------
+# JsonAddMixin — paste-a-JSON-doc creation flow for any ModelAdmin
+# ---------------------------------------------------------------------------
+
+class JsonAddMixin:
+    """
+    Adds a custom changelist URL `<model>/add-json/` that accepts a single
+    JSON object or a list of objects and creates the corresponding rows.
+
+    Unknown keys are dropped (with a warning). `owner` may be omitted (the
+    current admin user is used) or supplied as a username string.
+
+    Subclasses only need to set `change_list_template` to the partial that
+    extends `admin/change_list.html` and renders the extra `object-tools` link.
+    The template name returned by `_json_add_template()` is rendered for the
+    GET / form-redisplay paths.
+    """
+
+    json_add_template = 'admin/swirl/json_add.html'
+
+    def get_urls(self):
+        info = (self.model._meta.app_label, self.model._meta.model_name)
+        return [
+            path(
+                'add-json/',
+                self.admin_site.admin_view(self.add_via_json_view),
+                name='%s_%s_add_json' % info,
+            ),
+        ] + super().get_urls()
+
+    def _resolve_owner(self, value, fallback):
+        if not value:
+            return fallback
+        if isinstance(value, int):
+            User = get_user_model()
+            try:
+                return User.objects.get(pk=value)
+            except User.DoesNotExist:
+                return fallback
+        if isinstance(value, str):
+            User = get_user_model()
+            try:
+                return User.objects.get(username=value)
+            except User.DoesNotExist:
+                return fallback
+        return fallback
+
+    def _valid_field_names(self):
+        return {
+            f.name for f in self.model._meta.get_fields()
+            if hasattr(f, 'name') and not f.many_to_many and not f.one_to_many
+        }
+
+    def _create_from_dict(self, item, request_user):
+        if not isinstance(item, dict):
+            raise ValidationError(
+                'Each entry must be a JSON object; got %s' % type(item).__name__
+            )
+        item = dict(item)  # don't mutate caller's structure
+        item.pop('id', None)  # let the DB assign
+        owner = self._resolve_owner(item.pop('owner', None), request_user)
+        valid = self._valid_field_names()
+        dropped = sorted(k for k in item.keys() if k not in valid)
+        filtered = {k: v for k, v in item.items() if k in valid}
+        try:
+            obj = self.model.objects.create(owner=owner, **filtered)
+        except (TypeError, FieldError) as err:
+            raise ValidationError(str(err))
+        return obj, dropped
+
+    def add_via_json_view(self, request):
+        if not self.has_add_permission(request):
+            return redirect('..')
+
+        opts = self.model._meta
+        context = {
+            **self.admin_site.each_context(request),
+            'opts': opts,
+            'title': 'Add %s via JSON' % opts.verbose_name,
+            'app_label': opts.app_label,
+            'has_view_permission': True,
+        }
+
+        if request.method != 'POST':
+            return render(request, self.json_add_template, context)
+
+        raw = (request.POST.get('json_data') or '').strip()
+        context['json_data'] = raw
+        if not raw:
+            messages.error(request, 'Paste a JSON object or array first.')
+            return render(request, self.json_add_template, context)
+        try:
+            data = json.loads(raw)
+        except ValueError as err:
+            messages.error(request, 'Invalid JSON: %s' % err)
+            return render(request, self.json_add_template, context)
+
+        items = data if isinstance(data, list) else [data]
+        created, all_dropped = [], set()
+        for idx, item in enumerate(items):
+            try:
+                obj, dropped = self._create_from_dict(item, request.user)
+            except ValidationError as err:
+                messages.error(
+                    request,
+                    'Item %d: %s' % (idx
```

**File**: `swirl/authenticators/authenticator.py` (modified, +12/-1)
```diff
@@ -50,9 +50,20 @@ def is_authenticated(self, session_data):
             if self.expires_in_field in session_data:
                 if session_data[self.expires_in_field] > int(now.timestamp()):
                     return True
+                logger.warning(
+                    f'{self.type}: token expired '
+                    f'({self.expires_in_field}={session_data[self.expires_in_field]} '
+                    f'<= now={int(now.timestamp())})'
+                )
                 return False
+            logger.warning(
+                f'{self.type}: {self.expires_in_field!r} not in session_data; '
+                f'auth header likely missing from the search request '
+                f'(keys present: {list(session_data.keys()) if hasattr(session_data, "keys") else type(session_data).__name__})'
+            )
             return False
-        except:
+        except Exception as err:
+            logger.warning(f'{self.type}: is_authenticated() raised {type(err).__name__}: {err}')
             return False
 
     def login(self, request):
```

**File**: `swirl/connectors/connector.py` (modified, +18/-0)
```diff
@@ -124,7 +124,25 @@ def federate(self, session):
                 v = self.validate_query(session)
                 if v:
                     if not self.auth:
+                        # Authentication unavailable for this provider in the
+                        # worker context. Previously this branch returned
+                        # silently with no Result row, making federate failures
+                        # invisible to admins and indistinguishable from a
+                        # provider that was never invoked. Log a warning AND
+                        # persist a Result row so the failure shows up in the
+                        # search response and in /swirl/results/.
                         self.status = 'NO_AUTH'
+                        self.warning(
+                            'authentication unavailable for this provider; '
+                            'verify the corresponding Authorization header is '
+                            'forwarded by the client on every search request'
+                        )
+                        self.message(
+                            f'NO_AUTH: authentication unavailable for: '
+                            f'{self.provider.name}. Sign in to the corresponding '
+                            f'identity provider via the profile menu and retry.'
+                        )
+                        self.save_results()
                         return False
                     self.execute_search(session)
                     if self.status not in ['FEDERATING', 'READY']:
```

**File**: `swirl/mixers/__init__.py` (modified, +21/-1)
```diff
@@ -3,15 +3,35 @@
 @contact:    sid@swirl.today
 '''
 
+import logging
+
 from swirl.mixers.relevancy import *
 from swirl.mixers.date import *
 from swirl.mixers.stack import *
 
+logger = logging.getLogger(__name__)
+
+# Mixer used when the requested name is unknown to this deployment.
+# Every Swirl install ships RelevancyMixer, so it is a safe baseline.
+_DEFAULT_MIXER_NAME = 'RelevancyMixer'
+
+
 def alloc_mixer(mixer):
     if not mixer:
         logger.error("blank mixer")
         return None
-    return globals()[mixer]
+    cls = globals().get(mixer)
+    if cls is None:
+        # Unknown mixer name (e.g. an enterprise-only class like
+        # RelevancyConfidenceMixer requested by a UI that wasn't told the
+        # backend lacks it). Falling back keeps a single bad query from
+        # turning into a 500 + client-side retry round-trip.
+        logger.warning(
+            f"alloc_mixer: unknown mixer {mixer!r}; falling back to "
+            f"{_DEFAULT_MIXER_NAME!r}"
+        )
+        cls = globals().get(_DEFAULT_MIXER_NAME)
+    return cls
 
 
 # Add new mixers here!
\ No newline at end of file
```

**File**: `swirl/models.py` (modified, +4/-0)
```diff
@@ -136,6 +136,8 @@ class SearchProvider(models.Model):
 
     class Meta:
         ordering = ['id']
+        verbose_name = "SearchProvider"
+        verbose_name_plural = "SearchProviders"
 
     def get_absolute_url(self):
         # Returns the URL to access
@@ -268,6 +270,8 @@ class Meta:
         unique_together = [
             ('name', 'qrx_type'),
         ]
+        verbose_name = "QueryTransform"
+        verbose_name_plural = "QueryTransforms"
 
 
 class AIProvider(models.Model):
```

**File**: `swirl/templates/admin/swirl/aiprovider/change_list.html` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{% extends "admin/change_list.html" %}
+{% load i18n %}
+
+{% block object-tools-items %}
+  {% if has_add_permission %}
+    <li>
+      <a href="add-json/" class="addlink">{% trans "Add via JSON" %}</a>
+    </li>
+  {% endif %}
+  {{ block.super }}
+{% endblock %}
```

**File**: `swirl/templates/admin/swirl/json_add.html` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+{% extends "admin/base_site.html" %}
+{% load i18n admin_urls %}
+
+{% block breadcrumbs %}
+<div class="breadcrumbs">
+  <a href="{% url 'admin:index' %}">{% trans 'Home' %}</a>
+  &rsaquo; <a href="{% url 'admin:app_list' app_label=opts.app_label %}">{{ opts.app_config.verbose_name }}</a>
+  &rsaquo; <a href="{% url opts|admin_urlname:'changelist' %}">{{ opts.verbose_name_plural|capfirst }}</a>
+  &rsaquo; {{ title }}
+</div>
+{% endblock %}
+
+{% block content %}
+<div id="content-main">
+  <p>
+    Paste a single JSON object, or an array of objects, with the same
+    field names you would use in <code>preloaded.json</code> or in a Swirl
+    export. <code>id</code> is ignored (the DB assigns one).
+    <code>owner</code> may be a username string or omitted (defaults to you).
+    Unknown fields are dropped with a warning.
+  </p>
+
+  <form method="post">
+    {% csrf_token %}
+    <fieldset class="module aligned">
+      <div class="form-row">
+        <label for="id_json_data">{% trans 'JSON' %}:</label>
+        <textarea
+          id="id_json_data"
+          name="json_data"
+          rows="24"
+          cols="100"
+          style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; width: 100%; min-height: 360px;"
+          placeholder='{&#10;  "name": "My Provider",&#10;  "connector": "RequestsGet",&#10;  "url": "https://example.com/search",&#10;  "active": true,&#10;  "tags": ["Internal"]&#10;}'>{{ json_data|default_if_none:'' }}</textarea>
+      </div>
+    </fieldset>
+    <div class="submit-row">
+      <input type="submit" value="{% trans 'Create' %}" class="default" />
+      <a href="../" class="button cancel-link">{% trans 'Cancel' %}</a>
+    </div>
+  </form>
+</div>
+{% endblock %}
```

**File**: `swirl/templates/admin/swirl/searchprovider/change_list.html` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{% extends "admin/change_list.html" %}
+{% load i18n %}
+
+{% block object-tools-items %}
+  {% if has_add_permission %}
+    <li>
+      <a href="add-json/" class="addlink">{% trans "Add via JSON" %}</a>
+    </li>
+  {% endif %}
+  {{ block.super }}
+{% endblock %}
```

#### Recent Merged Pull Requests:
- **PR #1993** (2026-09-26): DS-5745: keep pip temp files on disk ahead of the Ubuntu 26 runner migration (@erikspears)
- **PR #1992** (2026-09-17): New db.sqlite3.dist generated by a db-dist.yml workflow (@github-actions[bot])
- **PR #1991** (2026-09-05): New db.sqlite3.dist generated by a db-dist.yml workflow (@github-actions[bot])
- **PR #1990** (2026-09-05): DS-5737: move transformers to 5.x (@erikspears)
- **PR #1989** (2026-09-05): DS-5737: lift the Django<6.0 cap (Django>=6.0.6,<7) (@erikspears)
- **PR #1988** (2026-09-05): New db.sqlite3.dist generated by a db-dist.yml workflow (@github-actions[bot])
- **PR #1987** (2026-09-05): New db.sqlite3.dist generated by a db-dist.yml workflow (@github-actions[bot])
- **PR #1986** (2026-09-05): DS-5737: requirements hygiene — cryptography floor, qdrant-client range, stub packages removed (@erikspears)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
