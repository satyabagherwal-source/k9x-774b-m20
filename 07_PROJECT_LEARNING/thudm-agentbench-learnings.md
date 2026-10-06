# Forensic Learning Record (Deep Inspection): THUDM/AgentBench

> **Canonical Artifact**: `07_PROJECT_LEARNING/thudm-agentbench-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/THUDM/AgentBench](https://github.com/THUDM/AgentBench))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:24:26.926Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `THUDM/AgentBench`
- **Description**: A Comprehensive Benchmark to Evaluate LLMs as Agents (ICLR'24)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3763 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/server/tasks/alfworld/utils.py`
```
import json

import numpy as np
import yaml
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction


def bleu_score(reference, candidate):
    reference_tokens = reference.split()
    candidate_tokens = candidate.split()

    smoothie = SmoothingFunction().method4
    score = sentence_bleu([reference_tokens], candidate_tokens, smoothing_function=smoothie)
    return score

def process_ob(ob):
    if ob.startswith('You arrive at loc '):
        ob = ob[ob.find('. ')+2:]    
    return ob

def process_action(action, choices, limit=0.01, to_print=False):
    if to_print:
        print("preprocess action: ", action)
    '''
    match = re.search("ACTION:(.*)", action)
    if match:
        action = match.group(1)
    else:
        return False
    '''
    action = action.strip().lower().split("\n")[0]
    if not choices:
        return action
    if action in choices:
        return action
    try:
        bleus = [bleu_score(choice, action) for choice in choices]
        max_index = np.argmax(np.array(bleus))
        max_score = bleus[max_index]
        if max_score > limit:
            if to_print:
                print("processed action: ", choices[max_index], " score: ", max_score)
            return choices[max_index]
    except Exception as e:
        print("encounter exception: ", e)
        print("choices: ", choices)
        print("action: ", action)
    return action

def load_prompts(prompts_file):
    with open(prompts_file, 'r') as f:
        d = json.load(f)
        f.close()
    return d

def load_config(config_file):
    with open(config_file) as reader:
        config = yaml.safe_load(reader)
    return config
```

### Core Architecture Module: `src/server/tasks/knowledgegraph/utils/logic_form_util.py`
```
from collections import defaultdict
from pathlib import Path
from typing import List, Union

import networkx as nx

from .semparse_util import lisp_to_nested_expression, expression_to_lisp

REVERSE = True  # if REVERSE, then reverse relations are also taken into account for semantic EM

path = str(Path(__file__).parent.absolute())

reverse_properties = {}
with open(path + '/../ontology/reverse_properties', 'r') as f:
    for line in f:
        reverse_properties[line.split('\t')[0]] = line.split('\t')[1].replace('\n', '')


range_info = {}
with open(path + '/../ontology/fb_roles', 'r') as f:
    for line in f:
        line = line.replace("\n", "")
        fields = line.split(" ")
        range_info[fields[1]] = fields[2]


with open(path + '/../ontology/fb_roles', 'r') as f:
    content = f.readlines()
    for line in f:
        line = line.replace("\n", "")
        fields = line.split(" ")
        range_info[fields[1]] = fields[2]

relation_dr = {}
relations = set()
for line in content:
    fields = line.split()
    relation_dr[fields[1]] = (fields[0], fields[2])
    relations.add(fields[1])

relations.update([
    "user.dylanrocks.national_football_league.nfl_teams_that_have_moved_cities.original_city",
    "user.dfhuynh.default_domain.assassinated_person.assassination",
    "user.robert.roman_empire.roman_emperor.title",
    "user.dfhuynh.default_domain.assassination.assassin",
    "topic_server.population_number",
    "user.alexander.misc.murdered_person.murdered_by",
    "user.lindenb.default_domain.scientist.known_for",
    "user.alexander.misc.murdered_person.murder_method",
    "common.notable_for.object",
    "user.gogza.default_domain.recurring_event.recurrance_period",
    "user.robert.roman_empire.roman_emperor.prececessor"
])

with open(path + '/../ontology/fb_types', 'r') as f:
    content = f.readlines()

upper_types = defaultdict(lambda: set())

types = set()
for line in content:
    fields = line.split()
    upper_types[fields[0]].add(fields[2])
    types.add(fields[0])
    types.add(fields[2])

function_map = {'le': '<=', 'ge': '>=', 'lt': '<', 'gt': '>'}


def get_answer_type(query: str):
    try:
        expression = lisp_to_nested_expression(query)
        G = logical_form_to_graph(expression)
        for node in G.nodes.items():
            if "question_node" in node[1] and node[1]["question_node"] == 1:
                return node[1]["id"]
    except Exception:
        # print(query)
        return None


def get_symbol_type(symbol: str) -> int:
    if symbol.__contains__('^^'):
        return 2
    elif symbol in types:
        return 3
    elif symbol in relations:
        return 4
    elif symbol:
        return 1


def same_logical_form(form1: str, form2: str) -> bool:
    if form1.__contains__("@@UNKNOWN@@") or form2.__contains__("@@UNKNOWN@@"):
        return False
    try:
        G1 = logical_form_to_graph(lisp_to_nested_expression(form1))
    except Exception:
        return False
    try:
        G2 = logical_form_to_graph(lisp_to_nested_expression(form2))
    except Exception:
        return False

    def node_match(n1, n2):
        if n1['id'] == n2['id'] and n1['type'] == n2['type']:
            func1 = n1.pop('function', 'none')
            func2 = n2.pop('function', 'none')
            tc1 = n1.pop('tc', 'none')
            tc2 = n2.pop('tc', 'none')

            if func1 == func2 and tc1 == tc2:
                return True
            else:
                return False
            # if 'function' in n1 and 'function' in n2 and n1['function'] == n2['function']:
            #     return True
            # elif 'function' not in n1 and 'function' not in n2:
            #     return True
            # else:
            #     return False
        else:
            return False

    def multi_edge_match(e1, e2):
        if len(e1) != len(e2):
            return False
        values1 = []
        values2 = []
        for v in e1.values():
            values1.append(v['relation'])
        for v in e2.values():
            values2.append(v['relation'])
        return sorted(values1) == sorted(values2)

    return nx.is_isomorphic(G1, G2, node_match=node_match, edge_match=multi_edge_match)


def logical_form_to_graph(expression: List) -> nx.MultiGraph:
    # TODO: merge two entity node with same id. But there is no such need for
    # the second version of graphquestions
    G = _get_graph(expression)
    G.nodes[len(G.nodes())]['question_node'] = 1
    return G


# todo: I've added type check here; need to update the official evaluation. Also, implement CONS
def _get_graph(
        expression: List) -> nx.MultiGraph:  # The id of question node is always the same as the size of the graph
    if isinstance(expression, str):
        G = nx.MultiDiGraph()
        if get_symbol_type(expression) == 1:
            G.add_node(1, id=expression, type='entity')
        elif get_symbol_type(expression) == 2:
            G.add_node(1, id=expression, type='literal')
        elif get_symbol_type(expression) == 3:
            G.add_node(1, id=expression, type='class')
            # G.add_node(1, id="common.topic", type='class')
        elif get_symbol_type(expression) == 4:  # relation or attribute
            domain, rang = relation_dr[expression]
            G.add_node(1, id=rang, type='class')  # if it's an attribute, the type will be changed to literal in arg
            G.add_node(2, id=domain, type='class')
            G.add_edge(2, 1, relation=expression)

            if REVERSE:
                if expression in reverse_properties:
                    G.add_edge(1, 2, relation=reverse_properties[expression])

        return G

    if expression[0] == 'R':
        if get_symbol_type(expression[1]) != 4:
            pass  # return nx.MultiDiGraph()
        G = _get_graph(expression[1])
        size = len(G.nodes())
        mapping = {}
        for n in G.nodes():
            mapping[n] = size - n + 1
        G = nx.relabel_nodes(G, mapping)
        return G

    elif expression[0] in ['JOIN', 'le', 'ge', 'lt', 'gt']:
        if (isinstance(expression[1], str) and get_symbol_type(expression[1]) != 4) or (
                not isinstance(expression[2], list) and get_symbol_type(expression[2]) not in [1, 2]) or (
                isinstance(expression[1], list) and expression[1][0] != 'R'):
            pass  # return nx.MultiDiGraph()
        G1 = _get_graph(expression=expression[1])
        G2 = _get_graph(expression=expression[2])

        size = len(G2.nodes())
        qn_id = size
        if G1.nodes[1]['type'] == G2.nodes[qn_id]['type'] == 'class':
            if G2.nodes[qn_id]['id'] in upper_types[G1.nodes[1]['id']]:
                G2.nodes[qn_id]['id'] = G1.nodes[1]['id']
            # G2.nodes[qn_id]['id'] = G1.nodes[1]['id']
        if G1.nodes[1]['type'] == 'entity':
            mapping = {}
            for n in G1.nodes():
                mapping[n] = n + size
            G1 = nx.relabel_nodes(G1, mapping)
        else:
            mapping = {}
            for n in G1.nodes():
                mapping[n] = n + size - 1
            G1 = nx.relabel_nodes(G1, mapping)
        G = nx.compose(G1, G2)

        if expression[0] != 'JOIN':
            G.nodes[1]['function'] = function_map[expression[0]]

        return G

    elif expression[0] == 'AND':
        if (not isinstance(expression[1], list) and get_symbol_type(expression[1]) != 3) or not isinstance(
                expression[2], list):
            pass  # return nx.MultiDiGraph()

        G1 = _get_graph(expression[1])
        G2 = _get_graph(expression[2])

        size1 = len(G1.nodes())
        size2 = len(G2.nodes())
        if G1.nodes[size1]['type'] == G2.nodes[size2]['type'] == 'class':
            # if G2.nodes[size2]['id'] in upper_types[G1.nodes[size1]['id']]:
            G2.nodes[size2]['id'] = G1.nodes[size1]['id']
            # IIRC, in nx.compose, for the same node, its information can be overwritten by its info in the second graph
            # So here for the AND function we force it to choose the type explicitly provided in the logical form

        if G1.nodes[1]['type'] == 'entity':
            mapping = {}
            for n in G1.nodes():
                mapping[n] = n + size2
            G1 = nx.relabel_nodes(G1, mapping)
        else:
            mapping = {}
            for n in G1.nodes():
                mapping[n] = n + size2 - 1
            G1 = nx.relabel_nodes(G1, mapping)

        G2 = nx.relabel_nodes(G2, {size2: size1 + size2 - 1})
        G = nx.compose(G1, G2)

        return G

    elif expression[0] == 'COUNT':
        if len(expression) != 2 or not isinstance(expression[1], list):
            pass  # return nx.MultiDiGraph()
        G = _get_graph(expression[1])
        size = len(G.nodes())
        G.nodes[size]['function'] = 'count'

        return G

    elif expression[0].__contains__('ARG'):
        if (not isinstance(expression[1], list) and get_symbol_type(expression[1]) != 3) or (not isinstance(
                expression[2], list) and get_symbol_type(expression[2]) != 4):
            pass  # return nx.MultiDiGraph()
        G1 = _get_graph(expression[1])
        size1 = len(G1.nodes())
        G2 = _get_graph(expression[2])
        size2 = len(G2.nodes())
        # G2.nodes[1]['class'] = G2.nodes[1]['id']   # not sure whether this is needed for sparql
        G2.nodes[1]['id'] = 0
        G2.nodes[1]['type'] = 'literal'
        G2.nodes[1]['function'] = expression[0].lower()
        if G1.nodes[size1]['type'] == G2.nodes[size2]['type'] == 'class':
            # if G2.nodes[size2]['id'] in upper_types[G1.nodes[size1]['id']]:
            G2.nodes[size2]['id'] = G1.nodes[size1]['id']

        mapping = {}
        for n in G1.nodes():
            mapping[n] = n + size2 - 1
        G1 = nx.relabel_nodes(G1, mapping)
        G2 = nx.relabel_nodes(G2, {size2: size1 + size2 - 1})
        G = nx.compose(G1, G2)

        return G

    elif expression[0] == 'TC':
        G = _get_graph(expressi
```

### Core Architecture Module: `src/server/tasks/knowledgegraph/utils/semparse_util.py`
```
from typing import List


def lisp_to_nested_expression(lisp_string: str) -> List:
    """
    Takes a logical form as a lisp string and returns a nested list representation of the lisp.
    For example, "(count (division first))" would get mapped to ['count', ['division', 'first']].
    """
    stack: List = []
    current_expression: List = []
    tokens = lisp_string.split()
    for token in tokens:
        while token[0] == '(':
            nested_expression: List = []
            current_expression.append(nested_expression)
            stack.append(current_expression)
            current_expression = nested_expression
            token = token[1:]
        current_expression.append(token.replace(')', ''))
        while token[-1] == ')':
            current_expression = stack.pop()
            token = token[:-1]
    return current_expression[0]

def expression_to_lisp(expression) -> str:
    rtn = '('
    for i, e in enumerate(expression):
        if isinstance(e, list):
            rtn += expression_to_lisp(e)
        else:
            rtn += e
        if i != len(expression) - 1:
            rtn += ' '

    rtn += ')'
    return rtn


def get_nesting_level(expression) -> int:
    max_sub = 0
    for item in expression:
        if isinstance(item, list):
            level = get_nesting_level(item)
            if level > max_sub:
                max_sub = level

    return 1 + max_sub



if __name__ == '__main__':
    lisp = '(AND common.topic (AND (JOIN common.topic.notable_types Comic Strip) (JOIN common.topic.notable_types Comic Strip)))'
    print(get_nesting_level(lisp_to_nested_expression(lisp)))

    print(expression_to_lisp(lisp_to_nested_expression(lisp)))

```

### Core Architecture Module: `src/server/tasks/knowledgegraph/utils/sparql_executer.py`
```
import urllib
from pathlib import Path
from typing import List, Tuple, Union

from SPARQLWrapper import SPARQLWrapper, JSON

path = str(Path(__file__).parent.absolute())

with open(path + '/../ontology/fb_roles', 'r') as f:
    contents = f.readlines()

roles = set()
for line in contents:
    fields = line.split()
    roles.add(fields[1])


class SparqlExecuter:
    def __init__(self, url: Union[str, None]=None):
        self.sparql = SPARQLWrapper(url or "http://164.107.116.56:3093/sparql")
        self.sparql.setReturnFormat(JSON)

    def execute_query(self, query: str) -> List[str]:
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = []
        for result in results['results']['bindings']:
            assert len(result) == 1  # only select one variable
            for var in result:
                rtn.append(result[var]['value'].replace('http://rdf.freebase.com/ns/', '').replace("-08:00", ''))

        return rtn


    def execute_unary(self, type: str) -> List[str]:
        query = ("""
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX : <http://rdf.freebase.com/ns/> 
        SELECT (?x0 AS ?value) WHERE {
        SELECT DISTINCT ?x0  WHERE {
        """
                '?x0 :type.object.type :' + type + '. '
                                                    """
        }
        }
        """)
        # # print(query)
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = []
        for result in results['results']['bindings']:
            rtn.append(result['value']['value'].replace('http://rdf.freebase.com/ns/', ''))

        return rtn


    def execute_binary(self, relation: str) -> List[Tuple[str, str]]:
        query = ("""
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX : <http://rdf.freebase.com/ns/> 
        SELECT DISTINCT ?x0 ?x1 WHERE {
        """
                '?x0 :' + relation + ' ?x1. '
                                    """
        }
        """)
        # # print(query)
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = []
        for result in results['results']['bindings']:
            rtn.append((result['x0']['value'], result['x1']['value']))

        return rtn


    def is_intersectant(self, derivation1: tuple, derivation2: str):
        if len(derivation1[1]) > 3 or len(derivation2[1]) > 3:
            return False

        if len(derivation1) == 2:
            clause1 = derivation1[0] + ' ' + ' / '.join(derivation1[1]) + ' ?x. \n'
        elif len(derivation1) == 3:
            clause1 = '?y ' + ' / '.join(derivation1[1]) + ' ?x. \n' + f'FILTER (?y {derivation1[2]} {derivation1[0]}) . \n'

        if len(derivation2) == 2:
            clause2 = derivation2[0] + ' ' + ' / '.join(derivation2[1]) + ' ?x. \n'
        elif len(derivation2) == 3:
            clause2 = '?y ' + ' / '.join(derivation2[1]) + ' ?x. \n' + f'FILTER (?y {derivation2[2]} {derivation2[0]}) . \n'

        query = ("""
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX : <http://rdf.freebase.com/ns/> 
            ASK {
            """
                + clause1
                + clause2 +
                """
    }
    """)
        # print(query)
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = results['boolean']
        return rtn


    def entity_type_connected(self, entity: str, type: str):
        query = ("""
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX : <http://rdf.freebase.com/ns/> 
                ASK {
                """
                + ':' + entity + '  !(<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>|:type.object.type) '
                                '/ :type.object.type :' + type +
                """
    }
    """)
        # print(query)
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = results['boolean']
        return rtn


    def entity_type_connected_2hop(self, entity: str, type: str):
        query = ("""
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX : <http://rdf.freebase.com/ns/> 
                ASK {
                """
                + ':' + entity + '  !(<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>|:type.object.type) / '
                                ' !(<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>|:type.object.type)'
                                '/ :type.object.type :' + type +
                """
    }
    """)
        # print(query)
        self.sparql.setQuery(query)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query)
            exit(0)
        rtn = results['boolean']
        return rtn


    def get_in_attributes(self, value: str):
        in_attributes = set()

        query1 = ("""
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX : <http://rdf.freebase.com/ns/> 
                    SELECT (?x0 AS ?value) WHERE {
                    SELECT DISTINCT ?x0  WHERE {
                    """
                '?x1 ?x0 ' + value + '. '
                                    """
        FILTER regex(?x0, "http://rdf.freebase.com/ns/")
        }
        }
        """)
        # print(query1)

        self.sparql.setQuery(query1)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query1)
            exit(0)
        for result in results['results']['bindings']:
            in_attributes.add(result['value']['value'].replace('http://rdf.freebase.com/ns/', ''))

        return in_attributes



    def get_in_relations(self, entity: str):
        in_relations = set()

        query1 = ("""
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX : <http://rdf.freebase.com/ns/> 
                SELECT (?x0 AS ?value) WHERE {
                SELECT DISTINCT ?x0  WHERE {
                """
                '?x1 ?x0 ' + ':' + entity + '. '
                                            """
        FILTER regex(?x0, "http://rdf.freebase.com/ns/")
        }
        }
        """)
        # print(query1)

        self.sparql.setQuery(query1)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query1)
            exit(0)
        for result in results['results']['bindings']:
            in_relations.add(result['value']['value'].replace('http://rdf.freebase.com/ns/', ''))

        return in_relations


    def get_in_entities(self, entity: str, relation: str):
        neighbors = set()

        query1 = ("""
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX : <http://rdf.freebase.com/ns/> 
                SELECT (?x1 AS ?value) WHERE {
                SELECT DISTINCT ?x1  WHERE {
                """
                '?x1' + ' :' + relation + ' :' + entity + '. '
                                                            """
                    FILTER regex(?x1, "http://rdf.freebase.com/ns/")
                    }
                    }
                    """)
        # print(query1)

        self.sparql.setQuery(query1)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query1)
            exit(0)
        for result in results['results']['bindings']:
            neighbors.add(result['value']['value'].replace('http://rdf.freebase.com/ns/', ''))

        return neighbors



    def get_out_relations(self, entity: str):
        out_relations = set()

        query2 = ("""
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX : <http://rdf.freebase.com/ns/> 
            SELECT (?x0 AS ?value) WHERE {
            SELECT DISTINCT ?x0  WHERE {
            """
                ':' + entity + ' ?x0 ?x1 . '
                                """
        FILTER regex(?x0, "http://rdf.freebase.com/ns/")
        }
        }
        """)
        # print(query2)

        self.sparql.setQuery(query2)
        try:
            results = self.sparql.query().convert()
        except urllib.error.URLError:
            print(query2)
            exit(0)
        for result in results['results']['bindings']:
            out_relations.add(result['value']['value'].replace('http://rdf.freebase.com/ns/', ''))

        return out_relations


    def get_out_entities(self, entity: str, relation: str):
        neighbors = set()

        query2 = ("""
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3
```

### Core Architecture Module: `src/utils/__init__.py`
```
from .max_flow import Graph, MaxFlow
from .others import *
from .rules import *

```

### Core Architecture Module: `src/utils/max_flow.py`
```
from typing import Iterable, List, Dict, Union, Tuple, Optional

from pydantic import BaseModel


class Graph:
    def __init__(self, node_count: int, edges: Dict[Tuple[int, int], int]):
        """
        edges: {(source, target): edge_weight}}
        """
        self.node_count = node_count
        self.edges = edges

    def iterate_edges(self) -> Iterable[Tuple[int, int, int]]:
        for (source, target), weight in self.edges.items():
            yield source, target, weight


class Edge(BaseModel):
    from_node: int
    to_node: int
    capacity: int
    flow: int = 0


class MaxFlow:
    def __init__(self, graph: Graph, src: int, dst: int) -> None:
        assert (
            graph.node_count > src >= 0
        ), "src node out of range, expected [0, {}), got {}".format(
            graph.node_count, src
        )
        assert (
            graph.node_count > dst >= 0
        ), "dst node out of range, expected [0, {}), got {}".format(
            graph.node_count, dst
        )

        self.src = src
        self.dst = dst
        self.graph = graph
        self.adjacent_edges: List[List[Edge]] = [[] for _ in range(graph.node_count)]
        self.edges_dict: Dict[Tuple[int, int], Edge] = {}

        for source, target, weight in self.graph.iterate_edges():
            if (source, target) in self.edges_dict:
                self.edges_dict[(source, target)].capacity += weight
            else:
                self.edges_dict[(source, target)] = Edge(
                    from_node=source, to_node=target, capacity=weight
                )
                self.edges_dict[(target, source)] = Edge(
                    from_node=target, to_node=source, capacity=0
                )
                self.adjacent_edges[source].append(self.edges_dict[(source, target)])
                self.adjacent_edges[target].append(self.edges_dict[(target, source)])

        self.max_flow = self.compute_max_flow()

    def compute_max_flow(self) -> int:
        max_flow = 0
        while True:
            augmenting_path = self.find_augmenting_path()
            if not augmenting_path:
                break
            bottleneck = min([edge.capacity - edge.flow for edge in augmenting_path])
            for edge in augmenting_path:
                edge.flow += bottleneck
                self.edges_dict[(edge.to_node, edge.from_node)].flow -= bottleneck
            max_flow += bottleneck
        return max_flow

    def find_augmenting_path(self) -> Optional[List[Edge]]:
        # BFS
        visited = [False] * self.graph.node_count
        visited[self.src] = True
        queue = [self.src]
        prev: List[Union[None, Edge]] = [None] * self.graph.node_count
        while queue:
            node = queue.pop(0)
            for edge in self.adjacent_edges[node]:
                if not visited[edge.to_node] and edge.capacity > edge.flow:
                    visited[edge.to_node] = True
                    prev[edge.to_node] = edge
                    queue.append(edge.to_node)
                    if edge.to_node == self.dst:
                        break
        if not visited[self.dst]:
            return None
        flow_path = []
        node = self.dst
        while prev[node]:
            flow_path.append(prev[node])
            node = prev[node].from_node
        flow_path.reverse()
        return flow_path


if __name__ == "__main__":
    g = Graph(
        node_count=8,
        edges={
            (0, 3): 100,
            (3, 2): 60,
            (3, 4): 10,
            (3, 5): 20,
            (3, 6): 8,
            (3, 7): 0,
            (2, 1): 50,
            (4, 1): 30,
            (5, 1): 20,
            (6, 1): 20,
            (7, 1): 20,
        },
    )
    print(g)
    for edge in g.iterate_edges():
        print(edge)
    m = MaxFlow(g, 0, 1)
    print(m.edges_dict)

```

### Core Architecture Module: `src/utils/others.py`
```
import json

import numpy as np


class JsonEncoder(json.JSONEncoder):
    """Convert numpy classes to JSON serializable objects."""

    def default(self, obj):
        if isinstance(obj, (np.integer, np.floating, np.bool_)):
            return obj.item()
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return super(JsonEncoder, self).default(obj)


def serialize(obj, max_depth=5, compress=False):
    """
    dump into json, including only basic types, list types and dict types.
    If other types are included, they will be converted into string.
    """
    if max_depth <= 0:
        return "..."
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj
    elif isinstance(obj, list) or isinstance(obj, tuple):
        if not compress or len(obj) <= 5:
            return [serialize(item, max_depth - 1, compress) for item in obj]
        else:
            return [serialize(item, max_depth - 1, True) for item in obj[:5]] + [
                "...(total: %d)" % len(obj)
            ]
    elif isinstance(obj, dict):
        if not compress or len(obj) <= 5:
            return {
                str(key): serialize(obj[key], max_depth - 1, compress) for key in obj
            }
        else:
            ret = {
                str(key): serialize(obj[key], max_depth - 1, True)
                for key in list(obj.keys())[:5]
            }
            ret["...total..."] = len(obj)
            return ret
    elif hasattr(obj, "__dict__"):
        return serialize(obj.__dict__, max_depth, True)
    else:
        ret = str(obj)
        if len(ret) > 100:
            ret = ret[:45] + "   ...   " + ret[-45:]
        return ret


class ColorMessage:
    @staticmethod
    def red(msg):
        return "\033[91m" + msg + "\033[0m"

    @staticmethod
    def green(msg):
        return "\033[92m" + msg + "\033[0m"

    @staticmethod
    def cyan(msg):
        return "\033[96m" + msg + "\033[0m"

    @staticmethod
    def yellow(msg):
        return "\033[93m" + msg + "\033[0m"

```

### Core Architecture Module: `src/utils/rules.py`
```
from typing import List


class RuleBase:
    def check(self, obj) -> bool:
        raise NotImplementedError()


class ContainRule(RuleBase):
    def __init__(self, target, reverse=False) -> None:
        """
         Check if target is in obj.
        `reverse`: if True, check if obj is in target
        """
        self.target = target
        self.reverse = reverse

    def check(self, obj) -> bool:
        if self.reverse:
            return obj in self.target
        else:
            return self.target in obj


class NotRule(RuleBase):
    def __init__(self, rule: RuleBase) -> None:
        self.rule = rule

    def check(self, obj) -> bool:
        return not self.rule.check(obj)


class AndRule(RuleBase):
    def __init__(self, rules: List[RuleBase]) -> None:
        self.rules = rules

    def check(self, obj) -> bool:
        return all(rule.check(obj) for rule in self.rules)


class OrRule(RuleBase):
    def __init__(self, rules: List[RuleBase]) -> None:
        self.rules = rules

    def check(self, obj) -> bool:
        return any(rule.check(obj) for rule in self.rules)

```

### Core Architecture Module: `data/os_interaction/scripts/1/check/containing.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v2 in v1:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/in.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v1 in v2:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/integer-match.py`
```
from sys import argv
if int(argv[1]) == int(argv[2]): exit(0)
exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/size-match.py`
```
from sys import argv

def analysis_size(size_str):
    size_str = size_str.strip()
    availables = {
        "B": 1,
        "Byte": 1,
        "K": 1024,
        "KB": 1024,
        "M": 1024*1024,
        "MB": 1024*1024,
        "G": 1024*1024*1024,
        "GB": 1024*1024*1024,
        "T": 1024*1024*1024*1024,
        "TB": 1024*1024*1024*1024,
        "P": 1024*1024*1024*1024*1024,
        "PB": 1024*1024*1024*1024*1024,        
    }
    for size_unit in availables:
        if size_str.endswith(size_unit):
            return int(size_str[:-len(size_unit)]) * availables[size_unit]
    return int(size_str)

if analysis_size(argv[1]) == analysis_size(argv[2]): 
    exit(0)
exit(1)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #205** (2025-11-17): **[Bug/Assistance] 官网域名竟然出售了? 这个方向不继续了吗?**
  *Symptoms*: rt, 潇老板,这个方向不继续了吗? 我觉得还挺有前途的 
  **Post-Mortem & Fix Analysis**:
  > 原本那个网站不维护了，换成新的了。已更正～
  > > 原本那个网站不维护了，换成新的了。已更正～  右侧的项目链接也更新一下吧

- **Issue #204** (2025-11-11): **[Bug/Assistance] No module named src.start_task**
  *Symptoms*: I followed the instructions in the README step by step. However, I found that there is no start_task.py file in the src directory, which caused the execution of "python -m src.start_task -a" to fail. The error reported is "No module named src.start_task". How can I solve this problem?
  **Post-Mortem & Fix Analysis**:
  > hi, you are probably reading the v0.2 doc. the quick start of the newer version is at https://github.com/THUDM/AgentBench#quick-start and you may download the controller from https://github.com/THUDM/AgentRL/releases/tag/controller-v0.1.0. If you prefer to use the older version, you may switch to v0.2 branch.
  > thanks！

- **Issue #203** (2025-10-31): **如何评测模型**
  *Symptoms*: hi，我之前没怎么用过docker，这边想问个小白的问题。  docker这些命令完成后，我该如何评测我自己的模型呢？这边似乎看到没有关于评测的脚本。

- **Issue #176** (2024-12-09): **[Bug/Assistance] 'NoneType' object has no attribute 'retrieve'**
  *Symptoms*: `'NoneType' object has no attribute 'retrieve' `  I received this message on testing. Does anyone know how to fix this? ![Screenshot from 2024-12-06 09-15-00](https://github.com/user-attachments/assets/534c6402-e860-4b75-91b3-af5167808e2e) 
  **Post-Mortem & Fix Analysis**:
  > Hi, how did you fix it?

- **Issue #160** (2024-08-09): **kg的服务我部署好了，但是还是不能够正常测评kg任务，具体错误如下**
  *Symptoms*: 我的服务地址如下![image](https://github.com/user-attachments/assets/55351c87-60dd-423b-9076-573aa3fd3ca3) 我是把服务部署在一台Ubuntu SMP Wed Nov 23 20:19:22 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
  **Post-Mortem & Fix Analysis**:
  > 忘记注释pdb了 

- **Issue #159** (2024-08-07): **[Bug/Assistance] kg-std issues**
  *Symptoms*: **Describe the bug** I am following this work for a long time. However, initially the LTG and CG scenarios cannot work. And recently (last week), when I pull the latest docker, the kg-std cannot work as well. The detailed logs are shown below. Can you offer a stable version of docker so that we can obtain stable results over time? Many thanks!  **To Reproduce** > task KnowledgeGraph-std worker 0 error Cannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)] syncing KnowledgeGraph-std task worker 0 task KnowledgeGraph-std worker 0 error Cannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)] syncing KnowledgeGraph-std task worker 0 at http://localhost:5006/api failed (400, "Error: Worker not responding\nCannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)]") task KnowledgeGraph-std worker 1 error Cannot connect to host localhost:5010 ssl:default [Connect call failed ('127.0.0.1', 5010)] syncing KnowledgeGraph-std task worker 1 
  **Post-Mortem & Fix Analysis**:
  > I have missed the update in the readme.md about the update in kg-std environment. Thus, I will close the issue.

- **Issue #153** (2024-07-30): **[Bug/Assistance] kg的这个任务，http://164.107.116.56:3093/sparql这个服务器地址，似乎宕机了，执行python src/server/tasks/knowledgegraph/utils/sparql_executer.py会超时**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Screenshots or Terminal Copy&Paste** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS: [e.g. Ubuntu 22.04]  - Python: [e.g. 3.9]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > 确实，目前这个服务器正在维护，本地部署可以参考https://github.com/dki-lab/Freebase-Setup
  > > 确实，目前这个服务器正在维护，本地部署可以参考https://github.com/dki-lab/Freebase-Setup  好的，非常感谢
  > 请问你们这个服务大概什么时候能够维护好呢

- **Issue #133** (2024-04-28): **请问如何使用本地的llama-2-hf模型进行测试呢，希望得到一些明确的指导！[Bug/Assistance] **
  *Symptoms*: 我希望用本地的模型测试AgentBench，但是我不太清楚应该修改哪里，希望能得到一些具体的指导，谢谢！  下面这个issue我有看过，但是还是不太清楚具体该修改哪里... https://github.com/THUDM/AgentBench/issues/75
  **Post-Mortem & Fix Analysis**:
  > Hi, @5456es 可以参考一下https://github.com/THUDM/AgentBench/blob/main/docs/Introduction_cn.md#2-%E6%A1%86%E6%9E%B6%E4%BB%8B%E7%BB%8D 这个文档，里面介绍了框架的运行逻辑和启动AgentServer的方式，如果还有问题欢迎继续提问！

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

### Incident Patch 1: `d1e4a10d` (2026-02-08)
**Commit Message**: Merge pull request #213 from mkimhi/agentbench-lite-suite

Add lite presets for minimal local runs

**File**: `.github/workflows/lite-configs.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+name: validate-lite-configs
+
+on:
+  pull_request:
+  push:
+    branches: [ main ]
+
+jobs:
+  validate:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+
+      - name: Set up Python
+        uses: actions/setup-python@v5
+        with:
+          python-version: "3.9"
+
+      - name: Install minimal deps
+        run: |
+          python -m pip install --upgrade pip
+          python -m pip install pyyaml
+
+      - name: Validate lite configs
+        run: |
+          python scripts/validate_lite_configs.py
```

**File**: `README.md` (modified, +17/-0)
```diff
@@ -151,6 +151,9 @@ and [Program Entrance Guide](docs/Entrance_en.md).
 
 Clone this repo and install the dependencies.
 
+> **Python version note:** AgentBench pins older scientific Python deps (e.g. `numpy~=1.23.x`).
+> Using the recommended **Python 3.9** (via conda) is the most reliable way to install dependencies.
+
 ```bash
 cd AgentBench
 conda create -n agent-bench python=3.9
@@ -200,6 +203,14 @@ python -m src.start_task -a
 This will launch five task_workers each for `dbbench-std` and `os-std` tasks and automatically connect them
 to the controller on port 5000. **After executing this command, please allow approximately 1 minute for the task setup to complete.** If the terminal shows ".... 200 OK", you can open another terminal and follow step 4.
 
+#### Lite preset (laptops / limited RAM)
+
+If you want to start with minimal concurrency (1 worker per task), use the lite preset:
+
+```bash
+python -m src.start_task -a --config configs/start_task_lite.yaml
+```
+
 ### Step 4. Start the assigner
 
 This step is to actually start the tasks.
@@ -210,6 +221,12 @@ If everything is correctly configured so far, you can now initiate the task test
 python -m src.assigner
 ```
 
+If you started the task server with the lite preset, you can also run the lite evaluation preset:
+
+```bash
+python -m src.assigner --config configs/assignments/lite.yaml
+```
+
 ## Next Steps
 
 If you wish to launch more tasks or use other models, you can refer to the content
```

**File**: `configs/assignments/lite.yaml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# Lite preset: evaluate only low-resource tasks with minimal concurrency.
+#
+# Usage:
+#   python -m src.assigner --config configs/assignments/lite.yaml
+
+import: definition.yaml
+
+concurrency:
+  task:
+    dbbench-std: 1
+    os-std: 1
+  agent:
+    gpt-3.5-turbo-0613: 1
+
+assignments:
+  - agent:
+      - gpt-3.5-turbo-0613
+    task:
+      - dbbench-std
+      - os-std
+
+output: "outputs/{TIMESTAMP}"
```

**File**: `configs/start_task_lite.yaml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# Lite preset: start only low-resource tasks.
+# Intended for laptops / limited RAM.
+#
+# Usage:
+#   python -m src.start_task -a --config configs/start_task_lite.yaml
+#
+# You can still override tasks at runtime:
+#   python -m src.start_task -a --config configs/start_task_lite.yaml -s dbbench-std 2 os-std 2
+
+definition:
+  import: tasks/task_assembly.yaml
+
+start:
+  dbbench-std: 1
+  os-std: 1
```

**File**: `scripts/validate_lite_configs.py` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+#!/usr/bin/env python3
+"""Validate AgentBench lite preset configs.
+
+Goal: a fast smoke check that doesn't require building Docker images or running
+any tasks. It only validates that:
+- lite config files exist and are valid YAML
+- referenced tasks exist in configs/tasks/task_assembly.yaml
+- lite assignment references tasks that exist in the task assembly
+
+Run:
+  python scripts/validate_lite_configs.py
+"""
+
+from __future__ import annotations
+
+import pathlib
+import sys
+from typing import Any, Dict, Set
+
+import yaml
+
+ROOT = pathlib.Path(__file__).resolve().parents[1]
+
+
+def load_yaml(path: pathlib.Path) -> Dict[str, Any]:
+    try:
+        with path.open("r", encoding="utf-8") as f:
+            data = yaml.safe_load(f)
+    except Exception as e:
+        raise RuntimeError(f"Failed to parse YAML: {path}: {e}")
+    if data is None:
+        return {}
+    if not isinstance(data, dict):
+        raise RuntimeError(f"Expected mapping at top-level in {path}, got {type(data)}")
+    return data
+
+
+def main() -> int:
+    start_lite = ROOT / "configs" / "start_task_lite.yaml"
+    assign_lite = ROOT / "configs" / "assignments" / "lite.yaml"
+    task_assembly = ROOT / "configs" / "tasks" / "task_assembly.yaml"
+
+    for p in (start_lite, assign_lite, task_assembly):
+        if not p.exists():
+            raise RuntimeError(f"Missing required file: {p}")
+
+    start_cfg = load_yaml(start_lite)
+    assign_cfg = load_yaml(assign_lite)
+    assembly_cfg = load_yaml(task_assembly)
+
+    # Collect task names from imported task configs (based on file names).
+    imports = assembly_cfg.get("import", [])
+    if not isinstance(imports, list) or not all(isinstance(x, str) for x in imports):
+        raise RuntimeError("configs/tasks/task_assembly.yaml must have a list field: import")
+
+    task_names: Set[str] = set()
+    for rel in imports:
+        # rel like "webshop.yaml" -> file stem "webshop".
+        task_names.add(pathlib.Path(rel).stem)
+
+    # start_task_lite.yaml: ensure start keys look like known tasks.
+    start = start_cfg.get("start", {})
+    if not isinstance(start, dict) or not start:
+        raise RuntimeError("configs/start_task_lite.yaml must have non-empty mapping field: start")
+
+    unknown_in_start = sorted([k for k in start.keys() if str(k).split("-")[0] not in task_names])
+    if unknown_in_start:
+        raise RuntimeError(
+            "start_task_lite.yaml references tasks not present in task_assembly imports: "
+            + ", ".join(map(str, unknown_in_start))
+        )
+
+    # assignments/lite.yaml: ensure tasks exist.
+    assignments = assign_cfg.get("assignments")
+    if not isinstance(assignments, list) or not assignments:
+        raise RuntimeError("configs/assignments/lite.yaml must have a non-empty list field: assignments")
+
+    unknown_in_assign = []
+    for a in assignments:
+        if not isinstance(a, dict):
+            raise RuntimeError("Each assignment must be a mapping")
+        tasks = a.get("task", [])
+        if isinstance(tasks, str):
+            tasks = [tasks]
+        if not isinstance(tasks, list):
+            raise RuntimeError("assignment.task must be a string or list")
+        for t in tasks:
+            base = str(t).split("-")[0]
+            if base not in task_names:
+                unknown_in_assign.append(t)
+
+    if unknown_in_assign:
+        raise RuntimeError(
+            "assignments/lite.yaml references tasks not present in task_assembly imports: "
+            + ", ".join(map(str, unknown_in_assign))
+        )
+
+    print("OK: lite configs look valid")
+    return 0
+
+
+if __name__ == "__main__":
+    try:
+        raise SystemExit(main())
+    except Exception as e:
+        print(f"ERROR: {e}", file=sys.stderr)
+        raise SystemExit(1)
```

---

### Incident Patch 2: `5acc44b7` (2026-02-08)
**Commit Message**: Add lite presets for starting and evaluating minimal task suite

**File**: `README.md` (modified, +14/-0)
```diff
@@ -200,6 +200,14 @@ python -m src.start_task -a
 This will launch five task_workers each for `dbbench-std` and `os-std` tasks and automatically connect them
 to the controller on port 5000. **After executing this command, please allow approximately 1 minute for the task setup to complete.** If the terminal shows ".... 200 OK", you can open another terminal and follow step 4.
 
+#### Lite preset (laptops / limited RAM)
+
+If you want to start with minimal concurrency (1 worker per task), use the lite preset:
+
+```bash
+python -m src.start_task -a --config configs/start_task_lite.yaml
+```
+
 ### Step 4. Start the assigner
 
 This step is to actually start the tasks.
@@ -210,6 +218,12 @@ If everything is correctly configured so far, you can now initiate the task test
 python -m src.assigner
 ```
 
+If you started the task server with the lite preset, you can also run the lite evaluation preset:
+
+```bash
+python -m src.assigner --config configs/assignments/lite.yaml
+```
+
 ## Next Steps
 
 If you wish to launch more tasks or use other models, you can refer to the content
```

**File**: `configs/assignments/lite.yaml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# Lite preset: evaluate only low-resource tasks with minimal concurrency.
+#
+# Usage:
+#   python -m src.assigner --config configs/assignments/lite.yaml
+
+import: definition.yaml
+
+concurrency:
+  task:
+    dbbench-std: 1
+    os-std: 1
+  agent:
+    gpt-3.5-turbo-0613: 1
+
+assignments:
+  - agent:
+      - gpt-3.5-turbo-0613
+    task:
+      - dbbench-std
+      - os-std
+
+output: "outputs/{TIMESTAMP}"
```

**File**: `configs/start_task_lite.yaml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# Lite preset: start only low-resource tasks.
+# Intended for laptops / limited RAM.
+#
+# Usage:
+#   python -m src.start_task -a --config configs/start_task_lite.yaml
+#
+# You can still override tasks at runtime:
+#   python -m src.start_task -a --config configs/start_task_lite.yaml -s dbbench-std 2 os-std 2
+
+definition:
+  import: tasks/task_assembly.yaml
+
+start:
+  dbbench-std: 1
+  os-std: 1
```

---

### Incident Patch 3: `41e68073` (2025-01-30)
**Commit Message**: Merge pull request #174 from cedricrupb/fix-identifier-bug

Fix a potential identifier bug

**File**: `src/server/tasks/webshop/web_agent_site/attributes/generate_attrs.py` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ def get_corpus(
         for key in keys:
             if key == 'review':
                 rs = p['review']['reviews']
-                if r is not None:
+                if rs is not None:
                     text_ = ' '.join([r['review'].lower() for r in rs])
                 else:
                     text_ = ''
```

---

### Incident Patch 4: `59bd1ce2` (2024-12-04)
**Commit Message**: Fix a potential identifier bug

**File**: `src/server/tasks/webshop/web_agent_site/attributes/generate_attrs.py` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ def get_corpus(
         for key in keys:
             if key == 'review':
                 rs = p['review']['reviews']
-                if r is not None:
+                if rs is not None:
                     text_ = ' '.join([r['review'].lower() for r in rs])
                 else:
                     text_ = ''
```

---

### Incident Patch 5: `069f1ef8` (2024-11-13)
**Commit Message**: Merge pull request #162 from rjmoss/fix-terminal-cleanup

Fixed terminal output parsing

**File**: `src/server/tasks/os_interaction/task.py` (modified, +15/-0)
```diff
@@ -86,6 +86,21 @@ def __init__(self, code, o):
                 break
             except socket.timeout:
                 break
+
+        # Clean up the output by removing terminal control sequences, removes escape sequences starting with
+        # ESC (0x1b), followed by...
+        # ... any characters, an '@' character, any characters, ending with '#' or '$'
+        output = re.sub(b"\x1b.+@.+[#|$] ", b'', output)
+        # ... '[' and any combination of digits and semicolons, ending with a letter (a-z or A-Z)
+        output = re.sub(b'\x1b\\[[0-9;]*[a-zA-Z]', b'', output)
+        # ... ']' and any digits, a semicolon, any characters except BEL (0x07), and ending with BEL
+        output = re.sub(b'\x1b\\][0-9]*;[^\x07]*\x07', b'', output)
+        # ... '[?2004' and either 'h' or 'l'
+        output = re.sub(b'\x1b\[\?2004[hl]', b'', output)
+
+        # Remove BEL characters (0x07)
+        output = re.sub(b'\x07', b'', output)
+
         return DummyOutput(0, output)
 
     def execute_independent(self, command, *params):
```

---

### Incident Patch 6: `6850d037` (2024-11-13)
**Commit Message**: Merge pull request #163 from rjmoss/fix-timeout-error-message

Fixed hanging bash commands from agent in os-task

**File**: `src/server/tasks/os_interaction/task.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 import re
 import socket
 import struct
+import time
 from typing import List, Dict, Any, Tuple
 
 import docker
@@ -62,8 +63,15 @@ def __init__(self, code, o):
         data = self.sock.recv(8)
         _, n = struct.unpack(">BxxxL", data)
         _ = self.sock.recv(n)
+
+        time_limit = 30  # seconds
+        start_time = time.time()
+
         output = b""
         while True:
+            if time.time() - start_time > time_limit:
+                print(f"Time limit reached, breaking out of the loop. Command was: `{command}`")
+                break
             try:
                 data = self.sock.recv(8)
                 # print(data)
```

---

### Incident Patch 7: `5c1c96ed` (2024-08-11)
**Commit Message**: Fixed terminal output parsing

Before the agent receives
"The output of the OS: The output of the OS:\n\n10\n[?2004h]0;root@e88175735799:/root@e88175735799:/# [K"
Now the agent receives
"The output of the OS: 10"

**File**: `src/server/tasks/os_interaction/task.py` (modified, +15/-0)
```diff
@@ -78,6 +78,21 @@ def __init__(self, code, o):
                 break
             except socket.timeout:
                 break
+
+        # Clean up the output by removing terminal control sequences, removes escape sequences starting with
+        # ESC (0x1b), followed by...
+        # ... any characters, an '@' character, any characters, ending with '#' or '$'
+        output = re.sub(b"\x1b.+@.+[#|$] ", b'', output)
+        # ... '[' and any combination of digits and semicolons, ending with a letter (a-z or A-Z)
+        output = re.sub(b'\x1b\\[[0-9;]*[a-zA-Z]', b'', output)
+        # ... ']' and any digits, a semicolon, any characters except BEL (0x07), and ending with BEL
+        output = re.sub(b'\x1b\\][0-9]*;[^\x07]*\x07', b'', output)
+        # ... '[?2004' and either 'h' or 'l'
+        output = re.sub(b'\x1b\[\?2004[hl]', b'', output)
+
+        # Remove BEL characters (0x07)
+        output = re.sub(b'\x07', b'', output)
+
         return DummyOutput(0, output)
 
     def execute_independent(self, command, *params):
```

---

### Incident Patch 8: `9e4c649a` (2024-08-11)
**Commit Message**: Fixed hanging bash commands from agent

If the agent puts out a command like
    'while true; do ls /root; sleep 1; done'
it will loop while also putting out an output (meaning the socket
doesn't timeout) so I've added a 30s cutoff. Without this it eventually
fails but counts as an incomplete task rather than just a fail so it
stops any of the overall stats working.

**File**: `src/server/tasks/os_interaction/task.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 import re
 import socket
 import struct
+import time
 from typing import List, Dict, Any, Tuple
 
 import docker
@@ -62,8 +63,15 @@ def __init__(self, code, o):
         data = self.sock.recv(8)
         _, n = struct.unpack(">BxxxL", data)
         _ = self.sock.recv(n)
+
+        time_limit = 30  # seconds
+        start_time = time.time()
+
         output = b""
         while True:
+            if time.time() - start_time > time_limit:
+                print(f"Time limit reached, breaking out of the loop. Command was: `{command}`")
+                break
             try:
                 data = self.sock.recv(8)
                 # print(data)
```

---

### Incident Patch 9: `d88c1735` (2024-05-03)
**Commit Message**: Fix typo in README.md

The correct abbreviation is "kg". It stands for "knowledge graph". The "kd" is a typo.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ launching:
 | card_game | ~5s            | < 500M             |
 | ltp       | ~5s            | < 500M             |
 | os        | ~5s            | < 500M             |
-| kd        | ~5s            | < 500M             |
+| kg        | ~5s            | < 500M             |
 
 ## References
 
```

---

### Incident Patch 10: `6f1c80b6` (2024-03-03)
**Commit Message**: Fix rounds number

**File**: `src/server/tasks/ltp/task.py` (modified, +1/-1)
```diff
@@ -369,7 +369,7 @@ def check_no(self, message: str):
 
 
 class LateralThinkingPuzzle(Task):
-    def __init__(self, rounds=50, filepath=None, eval_yaml=None, **configs):
+    def __init__(self, rounds=25, filepath=None, eval_yaml=None, **configs):
         # TODO: refactor
         # change into list, which contains dict with problems and language
         self.rounds = rounds
```

---

### Incident Patch 11: `eee4c50e` (2023-12-26)
**Commit Message**: Fix same typo

**File**: `docs/Introduction_en.md` (modified, +1/-1)
```diff
@@ -169,7 +169,7 @@ The Client primarily comprises three components:
 - The Assigner is responsible for coordinating the concurrent tasks and models currently available, planning and
   allocating test cases, and creating the corresponding number of Workers along with their Agent Client and Task Client.
 - The Agent Client implements the corresponding interface required by the Agent Server, exposing the
-  unified `AgentClient.reference(self, history)`.
+  unified `AgentClient.inference(self, history)`.
 - The Task Client interfaces exclusively with the Task Controller, making its implementation unique. Its core method
   is `TaskClient.run_sample(self, index, agent)`, which ensures the passed `Agent` and `Task` outputs are forwarded to
   each other.
```

---

### Incident Patch 12: `54957d3d` (2023-12-25)
**Commit Message**: Fix typo: AgentClient.reference --> AgentClient.inference

**File**: `docs/Introduction_cn.md` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ Client主要包含三部分：
 
 - Assigner 负责根据目前各个任务以及模型的并发数，统筹、规划和分配样例的测试，并生成对应数量的Worker及其Agent Client和Task
   Client。
-- Agent Client 负责实现 Agent Server 要求的对应的接口，暴露统一的 `AgentClient.reference(self, history)`。
+- Agent Client 负责实现 Agent Server 要求的对应的接口，暴露统一的 `AgentClient.inference(self, history)`。
 - Task Client 面对唯一的 Task Controller，因此实现是唯一的。其核心方法是 `TaskClient.run_sample(self, index, agent)`
   ，需要负责将传入的 `Agent` 和 `Task` 的输出相互转发。
 
```

---

### Incident Patch 13: `a069c7cb` (2023-10-26)
**Commit Message**: fix card game cannot stop

**File**: `src/server/tasks/card_game/AI/AI_En.py` (modified, +79/-64)
```diff
@@ -38,7 +38,8 @@ def __init__(self, client, stage, order, save_dir) -> None:
         self.known_enemy = []
         self.guess_try_times = 5
         self.action_try_times = 5
-                
+        self.died = False
+
     def Pick(self, game: Game) -> List[int]:
         # TODO: modify for dynamic setting   
         pick_list = []     
@@ -50,7 +51,7 @@ def Pick(self, game: Game) -> List[int]:
             # add "0": 1, "1": 2, "2": 3,
             self.name_to_pos[str(i)] = i+1
             pick_list.append(self.name_to_id[self.pos_to_name[i]])
-        
+
         #logging.info("pick_list: " + str(pick_list) + "\n")
         return pick_list
 
@@ -65,10 +66,10 @@ def _guess_verify(self, move):
             assert int(target_position) in self.get_enemy_living_fishes()
 
             return True
-        
+
         except:
             return False
-    
+
     def _decode_guess(self, output):
         pattern = r"\{[\w\W]*?\}"
         results = [res.replace('\'', '"') for res in re.findall(pattern, output)]
@@ -79,89 +80,96 @@ def _decode_guess(self, output):
                     move = json.loads(res)
                 except:
                     continue
-                
+
                 if self._guess_verify(move):
                     # self.debug_msg(str(output))
                     # self.debug_msg(str(move))
                     return True, move
-        
+
         return False, {}
-    
+
     # 取出目标的position list
     def _non_zero_indexes(self, lst):
         result = []
         for i in range(len(lst)):
             if lst[i] != 0:
                 result.append(i)
         return result
-    
+
     def _guess(self, game):
         for ix in range(self.guess_try_times):
             system = GUESS_DESCRIPTION[self.stage]
             history = self.assert_history#[-3:]
-            
+
             enemy_action = game.enemy_action
             my_action = game.my_action
             my_assert = game.my_assert
-            
+
             if enemy_action.action_fish != -1:
                 enemy_action_str = {
-                    'ACTION_FISH': str(enemy_action.action_fish), 
+                    'ACTION_FISH': str(enemy_action.action_fish),
                     'ATK': str(enemy_action.enemy_expected_injury[0]),
-                    'TARGET': str(self._non_zero_indexes(enemy_action.enemy_targets)), 
+                    'TARGET': str(self._non_zero_indexes(enemy_action.enemy_targets)),
                     'SKILL_TYPE': self.skill_type[str(enemy_action.type)]
                 }
             else:
                 enemy_action_str = {
-                    'ACTION_FISH': 'None', 
-                    'ATK': 'None', 
+                    'ACTION_FISH': 'None',
+                    'ATK': 'None',
                     'TARGET': 'None',
                     'SKILL_TYPE': 'None'
                 }
-            
+
             trigger_passive = {}
             for _pos, _type in zip(my_action.enemy_passives_id, my_action.enemy_types):
                 trigger_passive['Position: ' + str(_pos)] = self.passive_type[str(_type)]
-                
+
             for _pos, _type in zip(enemy_action.friend_passives_id, enemy_action.friend_types):
                 trigger_passive['Position: ' + str(_pos)] = self.passive_type[str(_type)]
-            
+
             live_enemy = self.get_enemy_living_fishes()
             live_enemy.sort()
             live_enemy = [str(i) for i in live_enemy if not i in self.known_enemy]
-            
+
             prompt = guess_prompt % (my_assert.assertResult, live_enemy, enemy_action_str, json.dumps(trigger_passive, ensure_ascii=False))
-            
+
+            if self.died:
+                return -1, -1
+
             output = self.client.llm_call(history, prompt, system)
-            
+            if output == "### LLM ERROR EXIT ###":
+                print("exiting")
+                self.died = True
+                return -1, -1
+
             # decode output
             success, move = self._decode_guess(output)
-            if success:                    
+            if success:
                 guess_type = self.name_to_id[move['guess_type']]
                 target = int(move['target_position'])
-                
+
                 self.known_enemy.append(target)
                 self.assert_history.append((prompt, output))
                 with open(f'{self.save_dir}/guess_process_{self.order}.jsonl', 'a+') as f:
                     f.write(json.dumps({'try_times': ix, 'cot': output, 'move': move}, ensure_ascii=False) + '\n')
-                
+
                 return (target, guess_type)
-                
+
         return (-1, -1)
-    
+
     def Assert(self, game: Game) -> Tuple[int, int]:
         if self.stage == 1:
             return (-1, -1)
         else:
             return self._guess(game)
-            
+
     def _get_current_state(self, game: Game):
         my_fish = [{'pos': pos, 'id': abs(self.get_my_id(pos)), 'hp': se
```

**File**: `src/server/tasks/card_game/server.py` (modified, +2/-2)
```diff
@@ -36,13 +36,13 @@ async def start(self, folder, session):
             else:
                 try:
                     session.history = json.loads(data)
-                    print(data)
                     session.history = [ChatHistoryItem(**item) for item in session.history]
                     log_file.append({"role": "user", "content": data})
                     ret = await session.action()
                     if ret.content is None:
                         self.status[folder] = 3
-                        ret = ""
+                        self.send_message(client_socket, "### LLM ERROR EXIT ###")
+                        break
                     else:
                         ret = ret.content
                     print("\n######\n")
```

---

### Incident Patch 14: `f34931c9` (2023-10-24)
**Commit Message**: fix: name of os-dev config

**File**: `configs/tasks/os.yaml` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 os-dev:
   module: "src.server.tasks.os_interaction.OSInteraction"
   parameters:
+    name: "os-dev"
     concurrency: 24
     round_limit: 8
 
```

---

### Incident Patch 15: `b5e92f15` (2023-10-23)
**Commit Message**: fix kg calc overall

**File**: `src/server/tasks/knowledgegraph/task.py` (modified, +3/-3)
```diff
@@ -113,7 +113,7 @@ def main_metric():
                 recall = TP / (TP + FN)
                 F1 = 2 * precision * recall / (precision + recall)
                 F1_sum += F1
-            return F1_sum / count
+            return F1_sum / len(outputs)
 
         def EM():
             em_sum = 0
@@ -128,7 +128,7 @@ def EM():
                         gold_answer.intersection(predicted_answer)) == len(predicted_answer):
                     em_sum += 1
 
-            return em_sum / count
+            return em_sum / len(outputs)
 
         def executability():
             count = 0
@@ -140,7 +140,7 @@ def executability():
                 if outputs[i]['predict'] is not None and len(outputs[i]['predict']) > 0:
                     executability_sum += 1
 
-            return executability_sum / count
+            return executability_sum / len(outputs)
 
         # TODO: complete this function
 
```

#### Recent Merged Pull Requests:
- **PR #231** (closed): feat(scripts): Wilson CI + paired McNemar reporting (@KeilerHirsch)
- **PR #216** (closed): Fork v02 (@Nao-Taka)
- **PR #213** (2026-02-08): Add lite presets for minimal local runs (@mkimhi)
- **PR #210** (2026-02-08): Fix HTTPAgent to support OpenAI-compatible API responses (vLLM) (@letusfly85)
- **PR #207** (2025-11-17): Update website url (@Xiao9905)
- **PR #206** (2025-11-17): Remove deprecated website (@Xiao9905)
- **PR #202** (2025-10-14): publish agentbench_fc (@JingBh)
- **PR #200** (closed): Feature/zjz/demo (@jorschac)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
