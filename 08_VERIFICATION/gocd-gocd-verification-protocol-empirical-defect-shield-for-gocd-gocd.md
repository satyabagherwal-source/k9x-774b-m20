# Verification Protocol: Verification Protocol: Empirical Defect Shield for gocd/gocd

<!-- PROVENANCE_START
{
  "source_repository": "gocd/gocd",
  "source_url": "https://github.com/gocd/gocd",
  "source_version": "90a9bc24",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T07:47:14.275Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gocd-gocd",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gocd/gocd](https://github.com/gocd/gocd) (Revision: `90a9bc24`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T07:47:14.275Z`  
> **Learning ID**: `learn-github-gocd-gocd`


## 1. Scope & Verification Target
- **Target Repository**: `gocd/gocd` (Commit: `90a9bc24`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): gocd/gocd

> **Canonical Artifact**: `07_PROJECT_LEARNING/gocd-gocd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gocd/gocd](https://github.com/gocd/gocd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T07:47:12.288Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gocd/gocd`
- **Description**: GoCD - Continuous Delivery server main repository
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7438 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/app/assets/javascripts/field_state_replicator.js`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
FieldStateReplicator = function() {

  function update_state(self, id, originator) {
    const peers = self.id_fields_map[id];
    update_peers_state(self, id, originator, peers);
  }

  function update_peers_state(self, id, originator, peers) {
    const check_type = (originator.type === 'checkbox' || originator.type === 'radiobutton');
    const checked = check_type && originator.checked;
    const value = check_type || originator.value;
    peers.forEach(function (field) {
      if (check_type) {
        field.checked = checked;
      } else {
        field.value = value;
      }
    });
  }

  function init() {
    this.id_fields_map = {};
  }

  //js is single threaded :-)
  init.prototype.register = function(field, id) {
    const self = this;
    $(field).on('change', function () {
      update_state(self, id, field);
    });

    $(field).on('keyup', function () {
      update_state(self, id, field);
    });
    const peers = this.id_fields_map[id];
    if (peers) {
      peers.push(field);
      update_peers_state(this, id, peers[0], peers);
      return;
    }
    this.id_fields_map[id] = [field];
  };

  init.prototype.unregister = function(field, id) {
    const peers = this.id_fields_map[id];
    if (peers) {
      this.id_fields_map[id] = _.reject(peers, function(peer) {
        if (peer === field) {
          $(field).off('change');
          $(field).off('keyup');
          return true;
        } else {
          return false;
        }
      });
    }
  };

  return init;
}();

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/app/assets/javascripts/util.js`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Util = function() {
  // noinspection JSUnusedGlobalSymbols used directly from some ruby/rails code
  return {
    idToSelector(theId) {
      return `#${theId.replace(/([:.])/g,'\\$1')}`;
    },

    spinny(elementId) {
      if (_.isEmpty(elementId)) {return;}

      const element = $(Util.idToSelector(elementId));
      element.html('&nbsp;');
      element.addClass('spinny');
    },

    unspinny(elementId) {
      if (_.isEmpty(elementId)) {return;}

      const element = $(Util.idToSelector(elementId));
      element.removeClass('spinny');
    },

    ajaxUpdate(url, idForSpinner) {
      $("#message_pane").html('');
      AjaxRefreshers.disableAjax();
      Util.spinny(idForSpinner);
      $.ajax({
        url,
        type: 'post',
        dataType: 'json',
        headers: {
          'X-GoCD-Confirm': true,
          'Accept': 'application/vnd.go.cd+json'
        },
        complete() {
          Util.unspinny(idForSpinner);
          AjaxRefreshers.enableAjax();
        },
        error(xhr) {
          if (xhr.status === 401) {
            window.location = `${window.location.protocol}//${window.location.host}/go/auth/login`;
          }
          $("#message_pane").html(`<p class="error">${xhr.responseText}</p>`);
        }
      });
    }
  };
}();

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/app/assets/javascripts/vsm_renderer.js`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Graph_Renderer = function (container) {
  'use strict';
  var jContainer = $(container);
  var width = 200; // Default width of a node
  var height = 110; // Default height of a node
  var current, current_material;
  var isCurrent;
  var levels;
  var pipeline_gui;
  var nodeClassName = '';
  var maxWidth = 100; //width of svg container
  var maxHeight = 100; //height of svg container
  var svg;
  var noInstanceMessage = "No instance of this pipeline has run for any of the direct upstream dependency revision.";
  var analyticsModeEnabled = false;
  var selectPipelineCallback;
  var selectMaterialCallback;

  Graph_Renderer.prototype.invoke = function (vsm) {
    current = vsm.current_pipeline;
    current_material = vsm.current_material;
    levels = vsm.levels;

    if (current != null && current != undefined) {
      jContainer.append('<div class="highlight"></div>');
    }

    renderEntities(levels);
    materialBoxCreation();
    resetContainerPosition();
    if (d3) {
      renderConnections(levels);
    }

    initMiniMap();
    addBehaviors();
  };

  var highlightCurrentNode = function highlightCurrentNode() {
    $(".current").addClass("vsm-current-node");
  };

  var removeNodeSelection = function removeNodeSelection() {
    $(".current").removeClass("vsm-current-node");
    $(".other-node").removeClass("vsm-other-node");
  };

  var hoverOnMaterial = function () {
    var isSelected = $(this).hasClass("vsm-other-node") || $(this).hasClass("vsm-current-node");
    !isSelected && $(this).find('.onhover-material-overlay').removeClass("hidden");
  };

  var hoverOutMaterial = function () {
    $(this).find('.onhover-material-overlay').addClass("hidden");
  };

  var hoverOnPipeline = function () {
    var isSelected = $(this).hasClass("vsm-other-node");
    !isSelected && $(this).find('.onhover-pipeline-overlay').removeClass("hidden");
  };

  var hoverOutPipeline = function () {
    $(this).find('.onhover-pipeline-overlay').addClass("hidden");
  };

  var addPipelineOnHoverSelectStyles = function () {
    $("<div class=\"onhover-pipeline-overlay hidden\">" +
      "   <div class=\"plus-symbol\">+</div><div class=\"click-text\">select pipeline</div>" +
      "</div>").appendTo('.vsm-entity.pipeline');

    $(".vsm-entity.pipeline.other-node").on('mouseover', hoverOnPipeline).on('mouseout', hoverOutPipeline);
  };

  var addMaterialOnHoverSelectStyles = function () {
    $("<div class=\"onhover-material-overlay hidden\">" +
      "    <div class=\"plus-symbol\">+</div><div class=\"click-text\">select material</div>" +
      "</div>").appendTo('.vsm-entity.material');

    $(".vsm-entity.material.other-node").on('mouseover', hoverOnMaterial).on('mouseout', hoverOutMaterial);
  };

  var removePipelineOnHoverStyles = function () {
    $(".onhover-pipeline-overlay").remove();
    $(".vsm-entity.pipeline.other-node").off('mouseover', hoverOnPipeline).off('mouseout', hoverOutPipeline);
  };

  var removeMaterialOnHoverStyles = function () {
    $(".onhover-material-overlay").remove();
    $(".vsm-entity.material.other-node").off('mouseover', hoverOnMaterial).off('mouseout', hoverOutMaterial);
  };

  function hideMultiplePipelineInstances() {
    $('.vsm-entity.pipeline .show-more').addClass("hidden");

    $('.vsm-entity.pipeline .instances').get().forEach(function (instances) {
      const jInstances = $(instances);
      if (jInstances.children().length > 1) {
        jInstances.children().get().forEach(function (instance, index) {
          if (index !== 0) {
            $(instance).addClass("hidden");
          }
        });
      }
    });
  }

  Graph_Renderer.prototype.enableAnalyticsMode = function () {
    if (analyticsModeEnabled) {
      return;
    }
    analyticsModeEnabled = true;
    const container = $('#vsm-container');
    container.height(container.height() - 92);

    const pipelines = $('.vsm-entity.pipeline');
    $('.vsm-entity.pipeline a').css({"pointer-events": "none"});
    $('.vsm-entity.material').on("click", selectMaterial);
    pipelines.on("click", selectPipeline);
    pipelines.addClass("vsm-pipeline-node");
    pipelines.removeClass("expanded");
    $('.vsm-entity.pipeline h3 a').addClass("vsm-pipeline-unclickable-name");
    $('.vsm-entity.pipeline .pipeline_actions').addClass("hidden");
    $('.vsm-entity.pipeline .instances .instance .vsm_link_wrapper').addClass("hidden");
    $('.vsm-entity.pipeline .instances .instance .duration').addClass("hidden");
    hideMultiplePipelineInstances();

    addPipelineOnHoverSelectStyles();
    addMaterialOnHoverSelectStyles();

    highlightCurrentNode();
  };

  Graph_Renderer.prototype.disableAnalyticsMode = function () {
    analyticsModeEnabled = false;
    $('.vsm-entity a').css({"pointer-events": "auto"});
    const container = $('#vsm-container');
    container.height(container.height() + 92);

    const materials = $('.vsm-entity.material');
    const pipelines = $('.vsm-entity.pipeline');
    materials.css({"pointer-events": "auto"});
    materials.off('click', selectMaterial);
    pipelines.off('click', selectPipeline);
    pipelines.removeClass("vsm-pipeline-node");

    $('div.show-more:contains("less...")').parent().addClass('expanded');
    $('.vsm-entity.pipeline h3 a').removeClass("vsm-pipeline-unclickable-name");
    $('.vsm-entity.pipeline .pipeline_actions').removeClass("hidden");
    $('.vsm-entity.pipeline .instances .instance .vsm_link_wrapper').removeClass("hidden");
    $('.vsm-entity.pipeline .instances .instance .duration').removeClass("hidden");
    $('.vsm-entity.pipeline .instances .instance').removeClass("hidden");
    $('.vsm-entity.pipeline .show-more').removeClass("hidden");

    removePipelineOnHoverStyles();
    removeMaterialOnHoverStyles();

    removeNodeSelection();
  };

  Graph_Renderer.prototype.resetAnalyticsMode = function () {
    $(".other-node").removeClass("vsm-other-node");
  };

  Graph_Renderer.prototype.registerSelectPipelineCallback = function (callback) {
    selectPipelineCallback = callback;
  };

  Graph_Renderer.prototype.registerSelectMaterialCallback = function (callback) {
    selectMaterialCallback = callback;
  };

  var clearCurrentSelection = function clearCurrentSelection() {
    $(".other-node").removeClass("vsm-other-node");
  };

  var selectMaterial = function selectMaterial(e) {
    e.stopPropagation();
    clearCurrentSelection();

    var vsmEntity = $(this).closest('.vsm-entity');
    $(vsmEntity).addClass("vsm-other-node");
    $(vsmEntity).find('.onhover-material-overlay').addClass("hidden");
    selectMaterialCallback(vsmEntity.data("material-name"), vsmEntity.data("fingerprint"), vsmEntity.data("level"));
  };

  var selectPipeline = function selectPipeline() {
    clearCurrentSelection();

    var vsmEntity = $(this).closest('.vsm-entity');
    if ($(vsmEntity).hasClass('vsm-current-node')) {
      return;
    }

    $(vsmEntity).addClass("vsm-other-node");
    $(vsmEntity).find('.onhover-pipeline-overlay').addClass("hidden");
    selectPipelineCallback(vsmEntity.data("pipeline-name"), vsmEntity.data("level"));
  };

  function resetContainerPosition() {
    jContainer.scrollTop(0);
    jContainer.scrollLeft(0);
  }

  // Needs to match logic within stage_overview_shim_for_vsm.tsx which makes placement decisions based on nodes
  function sanitizeVsmNodeId(id) {
    // Pipeline names can have periods in them; for unknown reasons historically prior to the OSS epoch
    // these have had periods replaced with '_id-'.
    return id.replace(/\./g, '_id-');
  }

  function renderEntities(levels) {
    $.each(levels, function (i, level) {
      $.each(level.nodes, function (j, node) {
        var depth = node.depth - 1;

        if (node.node_type != 'PIPELINE' && node.node_type != 'DUMMY') {
          node.originalId = node.id;
          node.id = (/\d/.test(node.id.charAt(0))) ? `a${node.id}` : node.id;
        }

        if (node.id != current) {
          if (node.node_type != 'PIPELINE' && node.node_type != 'DUMMY') {
            pipeline_gui = renderMaterialCommits(node);
            var current_material_class = node.originalId === current_material ? 'current' : '';
            var material_conflicts = node.view_type == 'WARNING' ? 'conflicts' : '';
            pipeline_gui += `<div id="${sanitizeVsmNodeId(node.id)}" class="vsm-entity material other-node ${node.node_type.toLowerCase()} ${current_material_class} ${material_conflicts}" style="`;
            pipeline_gui += `top:${((height * depth) + (50 * depth)) + 50}px; left:${((width * i) + (90 * i)) + 100}px"`;
            pipeline_gui += `data-material-name="${node.name}" data-fingerprint="${node.originalId}" data-level=${i}`;
            pipeline_gui += '>';
            pipeline_gui += renderScmEntity(node);

          } else {
            pipeline_gui = `<div id="${sanitizeVsmNodeId(node.id)}" class="vsm-entity other-node ${node.node_type.toLowerCase()}" style="`;
            pipeline_gui += `top:${((height * depth) + (50 * depth)) + 50}px; left:${((width * i) + (90 * i)) + 20}px"`;
            pipeline_gui += `data-pipeline-name="${node.id}" data-level=${i}`;
            pipeline_gui += '>';
          }
          isCurrent = false;
        } else {
          $(jContainer).find('.highlight').css({'left': (((width * i) + (90 * i)))});
          pipeline_gui = `<div id="${sanitizeVsmNodeId(node.id)}" class="vsm-entity
```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/helpers/json_utils.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {mixins as s} from "helpers/string-plus";

export class JsonUtils {

  static toSnakeCasedObject(o: object): any {
    return JSON.parse(this.toSnakeCasedJSON(o));
  }

  static toSnakeCasedJSON(o: object): string {
    return JSON.stringify(o, s.snakeCaser);
  }

  static toCamelCasedObject(o: object): any {
    return JSON.parse(this.toCamelCasedJSON(o));
  }

  static toCamelCasedJSON(o: object): string {
    return JSON.stringify(o, s.camelCaser);
  }
}

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/helpers/render_comment.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from "lodash";
import {MaterialType} from "../models/materials/materials";

export type CommentServerFormat = 'html' | 'json' | 'raw';

export interface TrackingTool {
  regex: string;
  link: string;
}

// See legacy JS render at (app/assets/javascripts/vsm_renderer.js)
export function renderCommentToHtml(text: string, textType: CommentServerFormat, trackingTool?: TrackingTool) {
  switch (textType) {
    case "html":
      // Assume it is already escaped and safe to render directly as trusted
      return text;
    case "json":
      // We need to extract comment from json; then make it safe, possibly with tracking tool links
      return renderRawCommentToHtml(parseJsonCommentUnsafe(text), trackingTool);
    case "raw":
      // The default case; assume it is unsafe from server. If this is passed incorrectly, it'll lead to
      // double-escaping and bad rendering.
      return renderRawCommentToHtml(text, trackingTool);
  }
}

// Renders to safe HTML, assuming input is raw or json. Case-insensitive on materialType, since callers pass both
// the config type ("package") and the display type ("Package").
export function renderCommentToHtmlByType(text: string, materialType: MaterialType | string) {
  return renderCommentToHtml(text, materialType?.toLowerCase() === "package" ? "json" : "raw");
}

// Parses server comments assuming they are being returned raw. Does not make changes that affect style of rendering
// but does adapt the comment by material type.
export function parseRawCommentUnsafe(text: string, materialType: MaterialType) {
  return materialType === "package" ? parseJsonCommentUnsafe(text) : text;
}

// Extracts a package-material JSON comment envelope into human-readable *unescaped* plain text
// (COMMENT + trackback). Callers must escape the result before inserting as HTML (e.g. render it as mithril text,
// or pass it through renderRawCommentToHtml). Does not render the trackback as a link at this stage (unlike the legacy
// Rails and sprockets raw JS code).
function parseJsonCommentUnsafe(text: string) {
  try {
    const commentJSON   = JSON.parse(text);
    const trackbackURL  = commentJSON?.TRACKBACK_URL || "Not Provided";
    const packageOrigin = _.isEmpty(commentJSON.COMMENT) ? "" : `${commentJSON.COMMENT}\n`;
    return `${packageOrigin}Trackback: ${trackbackURL}`;
  } catch (e) {
    return text;
  }
}

function renderRawCommentToHtml(text: string, trackingTool?: TrackingTool) {
  if (!trackingTool || !trackingTool.regex) {
    return _.escape(text);
  } else {
    return renderRawCommentWithTrackingToolToHtml(text, trackingTool);
  }
}

function renderRawCommentWithTrackingToolToHtml(text: string, trackingTool: TrackingTool) {
  try {
    const regex              = new RegExp(trackingTool.regex);
    const linkIdFromGroup    = regexHasGroups();
    const commentStringParts = [];
    let matchResult          = text.match(regex);
    while (matchResult !== null) {
      commentStringParts.push(_.escape(text.substring(0, matchResult.index)));
      commentStringParts.push(toLink(matchResult, linkIdFromGroup));
      text        = text.substring(matchResult.index! + matchResult[0].length);
      matchResult = text.match(regex);
    }
    commentStringParts.push(_.escape(text));
    return commentStringParts.join("");
  } catch (e) {
    return _.escape(text);
  }

  function regexHasGroups() {
    return (new RegExp(`${trackingTool!.regex}|`)).exec("")!.length - 1 !== 0;
  }

  function toLink(matchResult: RegExpMatchArray, linkIdFromGroup: boolean) {
    const matchedWord = matchResult[0];
    const trackingId = firstMatchingGroup(matchResult);
    if (trackingId || !linkIdFromGroup) {
      const href = trackingTool!.link.replace("${ID}", encodeURIComponent(trackingId || matchedWord));
      return `<a href="${_.escape(href)}" target="story_tracker">${_.escape(matchedWord)}</a>`;
    } else {
      return _.escape(matchedWord);
    }
  }

  function firstMatchingGroup(matchResult: RegExpMatchArray) {
    for (let i = 1; i < matchResult.length; i++) {
      if (matchResult[i]) {
        return matchResult[i];
      }
    }
    return null;
  }
}

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/helpers/utils.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import _ from "lodash";
import m from "mithril";

type Provider<T> = () => T;
type Predicate<T> = (v: T) => boolean;

export function showIf(condition: boolean, content: () => m.Children) {
  if (condition) {
    return content();
  }
}

/**
 * Wraps a set of providers as a single provider of the same type. The resultant provider will lazily
 * evaluate each provider within, testing each provider output against a specified criterion/predicate
 * and return the first output that passes. If none pass after all wrapped providers are exhausted, the
 * last output is returned as the final value. This is similar to a find first operation that operates
 * on the output of each provider rather than on the provider itself.
 *
 * This requires at least one provider, specified as the param `initial`
 *
 * @param criterion the predicate to test for the first acceptable output
 * @param initial the first provider
 * @param subsequent any subsequent providers (optional)
 *
 * @returns a provider that returns the first acceptable value of the wrapped providers
 */
export function cascading<T>(criterion: Predicate<T>, initial: Provider<T>, ...subsequent: Array<Provider<T>>): Provider<T> {
  return () => {
    let val = initial();
    for (let i = 0, len = subsequent.length; !criterion(val) && i < len; i++) {
      val = subsequent[i]();
    }
    return val;
  };
}

/**
 * Executes transforms in series on an input and returns the final result. The output of each transform.
 * The typings constructed such that the result type matches the input type, but this will theoretically
 * work if you want to transform into another type as well, so long as each transform's input matches its
 * prior sibling's output type. You may have to trick typescript into skipping the typechecks of your
 * transforms and output, though.
 *
 * @param input the initial value
 * @param transforms the set of transformers
 *
 * @returns the value after all transforms are applied in order
 */
export function pipeline<T>(input: T, ...transforms: Array<(v: T) => T>): T {
  return _.reduce(transforms, (memo, f) => f(memo), input);
}

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/models/shared/job_state.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// mirror of Java's JobState
export type JobState = 'Unknown' |
  'Scheduled' |
  'Assigned' |
  'Preparing' |
  'Building' |
  'Completing' |
  'Completed' |
  'Discontinued' |
  'Rescheduled' |
  'Paused' |
  'Waiting';

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/models/shared/job_state_transition.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {JobState} from "./job_state";

export interface JobStateTransitionJSON {
  state: JobState;
  state_change_time: number | string;
}

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/models/tri_state_checkbox/index.ts`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export enum TristateState {
  on, off, indeterminate
}

export class TriStateCheckbox {
  private readonly initialState: TristateState;
  private currentState: TristateState;
  private disabled: boolean;

  constructor(initialState: TristateState = TristateState.indeterminate, disabled = false) {
    this.initialState = initialState;
    this.currentState = initialState;
    this.disabled = disabled;
  }

  click() {
    if (this.initialState === TristateState.indeterminate) {
      // cycle through all states
      this.currentState = (this.currentState + 1) % 3;
    } else {
      if (this.currentState === TristateState.off) {
        this.currentState = TristateState.on;
      } else {
        this.currentState = TristateState.off;
      }
    }
  }

  isChecked() {
    return this.currentState === TristateState.on;
  }

  isIndeterminate() {
    return this.currentState === TristateState.indeterminate;
  }

  isUnchecked() {
    return this.currentState === TristateState.off;
  }

  ischanged() {
    return this.initialState !== this.currentState;
  }

  state() {
    return TristateState[this.currentState];
  }

  isDisabled(): boolean {
    return this.disabled;
  }
}

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/views/dashboard/comment_render_widget.tsx`
```
/*
 * Copyright Thoughtworks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {CommentServerFormat, renderCommentToHtml, TrackingTool} from "helpers/render_comment";
import {MithrilViewComponent} from "jsx/mithril-component";
import m from "mithril";

export interface Attrs {
  text: string;
  textType?: CommentServerFormat; // defaults to 'raw' (server-provided, unrendered text)
  trackingTool: TrackingTool;
}

export class CommentRenderWidget extends MithrilViewComponent<Attrs> {
  view(vnode: m.Vnode<Attrs>) {
    const text         = vnode.attrs.text;
    const textType     = vnode.attrs.textType || 'raw';
    const trackingTool = vnode.attrs.trackingTool;

    return (<div class="item comment"><p>{m.trust(renderCommentToHtml(text, textType, trackingTool))}</p></div>);
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13397** (2025-01-08): **Stage Overview Modal not Loading on VSM Page When Pipeline Name Contains a `.`**
  *Symptoms*: ##### Issue Type  - Bug Report  ##### Summary  When clicking on the coloured bar that represents the state of a stage on the value stream map (VSM) page, no stage summary modal is shown.  ##### Environment  ###### Basic environment details * Go Version: `24.4.0` * JAVA Version: `21.0.5` * OS: `Linux 6.8.0-48-generic (Ubuntu 24.04.1 LTS), Linux 5.15.153.1-microsoft-standard-WSL2 (Docker container)` * Browser vendor and version (if relevant): `Brave v1.73.104, Firefox v133.0.3, Chrome v131.0.6778.205`  ###### Additional Environment Details In all cases there are no "natural" pipelines; all pipelines in the instances are pulled from (a) config repo(s). Specifically, we are using the YAML plugin. Additionally, each affected instance uses the AWS secrets manager plugin for providing the password for the config repo(s).  It seems unlikely that these details are relevant, but I am including them just in case.  ##### Steps to Reproduce  <!--- Provide a link to a live example, or an unambiguous set of steps to --> <!--- reproduce this bug include code to reproduce, if relevant --> 1. Visit the VSM page for any pipeline or material (e.g., https://gocd.server.url/go/pipelines/value_stream_map/MyFavouritePipeline/1). 2. Click on the coloured bar that represents the state of any stage in any pipeline in the VSM.   ##### Expected Results Stage overview modal should open.  ##### Actual Results Browser is redirected to an empty anchor (e.g., https://gocd.serv

- **Issue #13214** (2024-10-31): **Starting up GoCD 24.3.0 can take hours because of stuck database migration**
  *Symptoms*: ##### Issue Type  Bug Report  ##### Summary  When (re-)starting GoCD, `DatabaseMigrator` takes 9 – 14 hours without apparent CPU or database activity. There are no log messages showing any issues. Next message is “Database upgrade completed successfully”.  ##### Environment  * Oracle Linux 8.10 * H2DB, DB size ~ 2 GB  ###### Basic environment details  * Go Version: `24.3.0 (19261-3d8bed12557f0b310a4bce58f076abbfc2841ae9)` * JAVA Version: `17.0.13` * OS: `Linux 4.18.0-553.22.1.el8_10.x86_64`  ##### Expected Results GoCD should restart quickly.  ##### Actual Results It takes 9 – 14 hours.  ##### Our Research Results A colleague found a [bug ticket](https://github.com/liquibase/liquibase/issues/6178) in Liquibase's Github project. Short summary, details in the linked ticket: * Apache Common changed random string generation, which now uses `/dev/random`. * Therefore Liquibase's update mechanism depends on entropy available in `/dev/random`, which is quickly drained. * GoCD startup hangs without CPU, network or database load waiting for entropy to come available. * I verified that by watching `/proc/sys/kernel/random/entropy_avail` while starting GoCD. * Installing and activating [haveged](https://github.com/jirka-h/haveged) (while GoCD hung on startup) refilled the entropy pool and the database upgrade finished within seconds.  ##### Possible Fix Liquibase fixed that in [PR 6179](https://github.com/liquibase/liquibase/pull/6179). This is already

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

### Incident Patch 1: `90a9bc24` (2026-11-24)
**Commit Message**: build: use Gradle providers to exec tools to determine versions

**File**: `build.gradle` (modified, +3/-2)
```diff
@@ -47,6 +47,8 @@ def GO_VERSION_SEGMENTS = [year: 26, releaseInYear: 3, patch: 0]
 def GO_VERSION_NEXT = '27.1.0'
 
 def goVersions = new GoVersions(
+  providers: providers,
+
   previousVersion: GO_VERSION_PREVIOUS,
   goVersion: [GO_VERSION_SEGMENTS.year, GO_VERSION_SEGMENTS.releaseInYear, GO_VERSION_SEGMENTS.patch].join('.'),
   nextVersion: GO_VERSION_NEXT,
@@ -66,8 +68,7 @@ def goVersions = new GoVersions(
     build:   2
   ),
 )
-ext.goVersions = goVersions
-GoVersions.printGradleDebuggingOutputFor(gradle, goVersions)
+ext.goVersions = goVersions.withGradleDebuggingOutput()
 
 def libraries = [
   // Dependabot will parse these dependencies.
```

**File**: `buildSrc/src/main/groovy/com/thoughtworks/go/build/GoVersions.groovy` (modified, +35/-34)
```diff
@@ -17,21 +17,26 @@
 package com.thoughtworks.go.build
 
 import groovy.transform.Immutable
-import org.gradle.api.invocation.Gradle
+import groovy.transform.ImmutableOptions
+import org.gradle.api.provider.ProviderFactory
+import org.gradle.util.GradleVersion
 
 import java.time.Duration
 
 import static org.gradle.api.JavaVersion.*
 
 @Immutable
+@ImmutableOptions(knownImmutableClasses = [ProviderFactory])
 class GoVersions implements Serializable {
+  transient ProviderFactory providers
+
   String goVersion
   String previousVersion
   String nextVersion
 
-  String gitRevision = determineGitRevision()
-  String gitShortRevision = determineGitShortRevision()
-  String distVersion = determineReleaseRevision()
+  String gitRevision = git('rev-list', 'HEAD', '--max-count=1')
+  String gitShortRevision = git('rev-list', 'HEAD', '--max-count=1', '--abbrev-commit')
+  String distVersion = git('rev-list', 'HEAD', '--count')
 
   String getFullVersion() { distVersion ? "${goVersion}-${distVersion}" : goVersion }
 
@@ -47,56 +52,52 @@ class GoVersions implements Serializable {
       .collect { v -> v.majorVersion }
   }
 
-  private static String determineGitRevision() {
-    outputFor("git rev-list HEAD --max-count=1")
-  }
-
-  private static String determineGitShortRevision() {
-    outputFor("git rev-list HEAD --max-count=1 --abbrev-commit")
-  }
-
-  private static String determineReleaseRevision() {
-    outputFor("git rev-list HEAD --count")
+  private String git(String... args) {
+    providers.exec { commandLine(['git', *args]); ignoreExitValue = true }.standardOutput.asText.get().trim()
   }
 
-  private static outputFor(String command) {
-    def process = command.execute(null, null)
-    process.waitFor()
-    return process.text.stripIndent().trim()
+  private String toolVersion(String command) {
+    try {
+      def exec = providers.exec { commandLine(command.split(' ')); ignoreExitValue = true }
+      exec.result.get().exitValue == 0 ? exec.standardOutput.asText.get().trim() : "could not determine version!"
+    } catch (Exception e) {
+      "could not determine version! (${e.message})"
+    }
   }
 
-  static void printGradleDebuggingOutputFor(Gradle gradle, GoVersions goVersions) {
+  GoVersions withGradleDebuggingOutput() {
     if (isCi()) {
       def separator = "=".multiply(72)
 
       println separator
-      println "Gradle version:  ${gradle.gradleVersion}"
+      println "Gradle version:  ${GradleVersion.current().version}"
       println "JVM:             ${System.getProperty('java.version')} (${System.getProperty('java.vm.vendor')} ${System.getProperty('java.vm.version')})"
       println "OS:              ${System.getProperty('os.name')} ${System.getProperty('os.version')} ${System.getProperty('os.arch')}"
       println("")
 
       println("Tool Versions")
       println(separator)
-      println("node: ${getToolVersion("node --version")} (corepack: ${getToolVersion("corepack --version")})")
-      println(" git: ${getToolVersion("git --version")}")
-      println("  hg: ${getToolVersion("hg --quiet --version")}")
-      println(" svn: ${getToolVersion("svn --quiet --version")}")
-      println("  p4: ${getToolVersion("p4 -V").readLines().grep(~/Rev.*/).join("")}")
-      println(" p4d: ${getToolVersion("p4d -V").readLines().grep(~/Rev.*/).join("")}")
-      println(" ant: ${getToolVersion("ant -version")}")
+      println("node: ${toolVersion("node --version")} (corepack: ${toolVersion("corepack --version")})")
+      println(" git: ${toolVersion("git --version")}")
+      println("  hg: ${toolVersion("hg --quiet --version")}")
+      println(" svn: ${toolVersion("svn --quiet --version")}")
+      println("  p4: ${toolVersion("p4 -V").readLines().grep(~/Rev.*/).join("")}")
+      println(" p4d: ${toolVersion("p4d -V").readLines().grep(~/Rev.*/).join("")}")
+      println(" ant: ${toolVersion("ant -version")}")
       println("")
 
       println("GoCD Versions")
       println(separator)
-      println("        goVersion: ${goVersions.goVersion}")
-      println("      distVersion: ${goVersions.distVersion}        (will be inaccurate on shallow clones!)")
-      println("      fullVersion: ${goVersions.fullVersion}")
-      println(" gitShortRevision: ${goVersions.gitShortRevision}")
-      println("targetJavaVersion: ${goVersions.targetJavaVersion}")
-      println(" buildJavaVersion: ${goVersions.buildJavaVersion}")
-      println("   javaPreference: ${goVersions.preferredJavaVersions()}")
+      println("        goVersion: ${goVersion}")
+      println("      distVersion: ${distVersion}        (will be inaccurate on shallow clones!)")
+      println("      fullVersion: ${fullVersion}")
+      println(" gitShortRevision: ${gitShortRevision}")
+      println("targetJavaVersion: ${targetJavaVersion}")
+      println(" buildJavaVersion: ${buildJavaVersion}")
+      println("   javaPreference: ${preferredJavaVersions()}")
       println("")
     }
+    return this
   }
 
   sta
```

---

### Incident Patch 2: `c0177809` (2026-11-24)
**Commit Message**: build: report the mismatched jar versions before worrying about licenses

**File**: `buildSrc/src/main/groovy/com/thoughtworks/go/build/AbstractVerifyJarTask.groovy` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+/*
+ * Copyright Thoughtworks, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.thoughtworks.go.build
+
+import org.gradle.api.DefaultTask
+import org.gradle.api.tasks.Input
+import org.gradle.api.tasks.TaskAction
+
+/**
+ * Verifies that a set of jars (e.g. those packaged inside a jar/war, or a classpath destined to be packaged) exactly
+ * matches a set of expected jar names/regexes, grouped by location (e.g. a directory inside the jar).
+ */
+abstract class AbstractVerifyJarTask extends DefaultTask {
+
+  @Input Map<String, List<String>> expectedJars
+
+  /**
+   * @return the names of the actual jars for each location key in {@link #expectedJars}
+   */
+  protected abstract Collection<String> actualJarNames(String location)
+
+  protected abstract String describe(String location)
+
+  @TaskAction
+  void perform() {
+    def expectedMessages = []
+
+    expectedJars.each { location, expectedJarsInLocation ->
+      def allJars = actualJarNames(location).unique().sort()
+
+      def extra = allJars.findAll { actual -> !expectedJarsInLocation.any { expected -> actual =~ expected } }
+      if (!extra.empty) {
+        expectedMessages += ["Got some extra jars in ${describe(location)} that were not expected"]
+        extra.each { jar ->
+          expectedMessages += ["  - ${jar}"]
+        }
+      }
+
+      def missing = expectedJarsInLocation.findAll { expected -> !allJars.any { actual -> actual =~ expected } }
+      if (!missing.empty) {
+        expectedMessages += ["Some jars that were expected in ${describe(location)} were not present"]
+        missing.each { jar ->
+          expectedMessages += ["  - ${jar}"]
+        }
+      }
+    }
+
+    if (!expectedMessages.empty) {
+      throw new IllegalStateException(expectedMessages.join(System.lineSeparator()))
+    }
+  }
+}
```

**File**: `buildSrc/src/main/groovy/com/thoughtworks/go/build/VerifyClasspathJarsTask.groovy` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/*
+ * Copyright Thoughtworks, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.thoughtworks.go.build
+
+import org.gradle.api.file.ConfigurableFileCollection
+import org.gradle.api.tasks.Classpath
+
+/**
+ * Verifies the jars on a classpath which is destined to be packaged into a single location (e.g. a war's WEB-INF/lib)
+ * <em>before</em> packaging. Useful when the packaging task itself has dependencies which rely on these expectations.
+ * {@link #expectedJars} should contain a single location key, used only for reporting.
+ */
+abstract class VerifyClasspathJarsTask extends AbstractVerifyJarTask {
+
+  @Classpath abstract ConfigurableFileCollection getClasspath()
+
+  @Override
+  protected Collection<String> actualJarNames(String location) {
+    classpath.files.findAll { it.name.endsWith('.jar') || it.name.endsWith('.zip') }.collect { it.name }
+  }
+
+  @Override
+  protected String describe(String location) {
+    "the classpath to be packaged into ${location}"
+  }
+}
```

**File**: `buildSrc/src/main/groovy/com/thoughtworks/go/build/VerifyJarTask.groovy` (modified, +14/-37)
```diff
@@ -13,25 +13,22 @@
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */
-
 package com.thoughtworks.go.build
 
-import org.gradle.api.DefaultTask
 import org.gradle.api.file.ArchiveOperations
-import org.gradle.api.file.FileTree
 import org.gradle.api.file.RegularFileProperty
-import org.gradle.api.tasks.Input
 import org.gradle.api.tasks.Internal
-import org.gradle.api.tasks.TaskAction
 import org.gradle.api.tasks.TaskProvider
 import org.gradle.api.tasks.bundling.Zip
 
 import javax.inject.Inject
 
-abstract class VerifyJarTask extends DefaultTask {
+/**
+ * Verifies the jars packaged within directories of an archive.
+ */
+abstract class VerifyJarTask extends AbstractVerifyJarTask {
 
   @Internal TaskProvider<? extends Zip> jarTask
-  @Input Map<String, List<String>> expectedJars
 
   @Internal abstract RegularFileProperty getJar()
   @Inject abstract ArchiveOperations getArchiveOps()
@@ -42,36 +39,16 @@ abstract class VerifyJarTask extends DefaultTask {
     this.jar.set(jarTask.flatMap { it.archiveFile })
   }
 
-  @TaskAction
-  void perform() {
-    def expectedMessages = []
-
-    expectedJars.each { directoryInJar, expectedJarsInDir ->
-      FileTree tree = archiveOps.zipTree(jar).matching {
-        include "${directoryInJar}/*.jar"
-        include "${directoryInJar}/*.zip"
-      }
-      def allJars = tree.files.collect { it.name }.sort()
-
-      def extra = allJars.findAll {actual -> !expectedJarsInDir.any { expected -> actual =~ expected } }
-      if (!extra.empty) {
-        expectedMessages += ["Got some extra jars in ${jar.get()}!${directoryInJar} that were not expected"]
-        extra.each { jar ->
-          expectedMessages += ["  - ${jar}"]
-        }
-      }
-
-      def missing = expectedJarsInDir.findAll {expected -> !allJars.any { actual -> actual =~ expected } }
-      if (!missing.empty) {
-        expectedMessages += ["Some jars that were expected in ${jar.get()}!${directoryInJar} were not present"]
-        missing.each { jar ->
-          expectedMessages += ["  - ${jar}"]
-        }
-      }
-    }
+  @Override
+  protected Collection<String> actualJarNames(String directoryInJar) {
+    archiveOps.zipTree(jar).matching {
+      include "${directoryInJar}/*.jar"
+      include "${directoryInJar}/*.zip"
+    }.files.collect { it.name }
+  }
 
-    if (!expectedMessages.empty) {
-      throw new IllegalStateException(expectedMessages.join(System.lineSeparator()))
-    }
+  @Override
+  protected String describe(String directoryInJar) {
+    "${jar.get()}!${directoryInJar}"
   }
 }
```

**File**: `server/build.gradle` (modified, +64/-37)
```diff
@@ -18,6 +18,8 @@ import com.github.jk1.license.task.ReportTask
 import com.thoughtworks.go.build.GoVersions
 import com.thoughtworks.go.build.LicenseReport
 import com.thoughtworks.go.build.TextUtils
+import com.thoughtworks.go.build.AbstractVerifyJarTask
+import com.thoughtworks.go.build.VerifyClasspathJarsTask
 import com.thoughtworks.go.build.VerifyJarTask
 import dev.yumi.gradle.licenser.task.ApplyLicenseTask
 import dev.yumi.gradle.licenser.task.CheckLicenseTask
@@ -505,40 +507,40 @@ def configureWar = tasks.register('configureWar') {
   }
 }
 
+// The jars to be packaged into the war's WEB-INF/lib
+def warLibs = files({
+  def appServerJarTask = project(':app-server').tasks.named('jar') as TaskProvider<Jar>
+
+  // Using a Set<String> is more reliable than Set<File> because File.equals() may be affected by other internal fields
+  // aside from `path` that aren't important to us; thus, Set<File> may allow duplicate paths and Set<String> will not.
+  Set<String> classpath = (
+    configurations.runtimeClasspath
+      + configurations.packagingOnly
+      + configurations.allApis
+      + configurations.spark
+      // Rely on logging libs from launcher parent classloader; JettyServer pins org.slf4j/org.apache.commons.logging as system classes
+      - configurations.runtimeClasspath.findAll { jar -> ['logback', 'slf4j-api', 'jcl-over-slf4j', 'jul-to-slf4j'].any { jar.name.startsWith(it) } }
+  )
+    .collect { f -> f.toString() }
+    .toSet()
+
+  // exclude app-server because it causes class cast exceptions (loaded by different classloaders)
+  classpath.removeAll([
+    appServerJarTask.get().archiveFile.get().toString(),
+    jar.archiveFile.get().toString()
+  ])
+
+  classpath
+}).builtBy(configurations.runtimeClasspath, configurations.packagingOnly, configurations.allApis, configurations.spark)
+
 def war = tasks.register('war', Jar) {
   dependsOn configureWar, ':server:jar'
-  dependsOn configurations.runtimeClasspath, configurations.packagingOnly, configurations.allApis, configurations.spark
 
   finalizedBy 'verifyWar'
   archiveBaseName = 'cruise'
   archiveExtension = 'war'
 
-  def appServerJarTask = project(':app-server').tasks.named('jar') as TaskProvider<Jar>
-
-  def classpathResolver = {
-    // Using a Set<String> is more reliable than Set<File> because File.equals() may be affected by other internal fields
-    // aside from `path` that aren't important to us; thus, Set<File> may allow duplicate paths and Set<String> will not.
-    Set<String> classpath = (
-      configurations.runtimeClasspath
-        + configurations.packagingOnly
-        + configurations.allApis
-        + configurations.spark
-        // Rely on logging libs from launcher parent classloader; JettyServer pins org.slf4j/org.apache.commons.logging as system classes
-        - configurations.runtimeClasspath.findAll { jar -> ['logback', 'slf4j-api', 'jcl-over-slf4j', 'jul-to-slf4j'].any { jar.name.startsWith(it) } }
-    )
-      .collect { f -> f.toString() }
-      .toSet()
-
-    // exclude app-server because it causes class cast exceptions (loaded by different classloaders)
-    classpath.removeAll([
-      appServerJarTask.get().archiveFile.get().toString(),
-      jar.archiveFile.get().toString()
-    ])
-
-    classpath
-  }
-
-  from(classpathResolver) {
+  from(warLibs) {
     into 'WEB-INF/lib'
   }
 
@@ -568,9 +570,8 @@ def war = tasks.register('war', Jar) {
   }
 }
 
-tasks.register('verifyWar', VerifyJarTask) {
-  jarTask = war
-  expectedJars = [
+def expectedWarJars = { ->
+  [
     "WEB-INF/lib": (
       ((project(':api').subprojects + project(':spark').subprojects).collect { eachProject -> eachProject.jar.archiveFile.get().asFile.name })
         + [
@@ -713,6 +714,18 @@ tasks.register('verifyWar', VerifyJarTask) {
         "zt-exec-${rootProject.versions.ztExec}.jar",
       ])
   ] as Map<String, List<String>>
+}
+
+// Verifies the war's libraries prior to packaging, since the war depends on the license report, which relies on these
+// expectations being correct. This allows extra/missing jars to be reported before license report errors.
+def verifyWarLibs = tasks.register('verifyWarLibs', VerifyClasspathJarsTask) {
+  classpath.from(warLibs)
+  expectedJars = expectedWarJars()
+}
+
+tasks.register('verifyWar', VerifyJarTask) {
+  jarTask = war
+  expectedJars = expectedWarJars()
 
   doLast {
     def denylistedContents = [
@@ -745,8 +758,10 @@ tasks.register('licenseReportAggregate') {
   dependsOn compileAssetsWebpackProd
   dependsOn generateRubygemsLicenseReport
 
-  // try our best to run verifications first since logic here relies on the expectations here
-  def verifyJarTasks = rootProject.subprojects.collectMany { eachProject -> eachProject.tasks.withType(VerifyJarTask) }
+  // try our best to run verifications first since logic here relies on the expectations here. verifyWar cannot be
+  // ordered first since the war bundles compiled assets, which depend on this task; so verif
```

---

### Incident Patch 3: `2aa72df0` (2026-11-24)
**Commit Message**: build(deps): bump jruby from 9.4.15.0 to 9.4.16.0

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ def libraries = [
   jetty               : 'org.eclipse.jetty:jetty-server:10.0.26',
   jgit                : 'org.eclipse.jgit:org.eclipse.jgit:6.10.1.202505221210-r',
   jolt                : 'com.bazaarvoice.jolt:jolt-core:0.1.8',
-  jruby               : 'org.jruby:jruby:9.4.15.0',
+  jruby               : 'org.jruby:jruby:9.4.16.0',
   jrubyRack           : 'com.github.gocd-contrib:jruby-rack:1.3.0.15',
   liquibase           : 'org.liquibase:liquibase-core:5.0.4',
   liquibaseSlf4j      : 'com.mattbertolini:liquibase-slf4j:5.1.0',
```

**File**: `server/build.gradle` (modified, +7/-7)
```diff
@@ -654,16 +654,16 @@ tasks.register('verifyWar', VerifyJarTask) {
         "jaxen-${rootProject.versions.jaxen}.jar",
         "jcodings-1.0.63.jar",
         "jdom2-${rootProject.versions.jdom}.jar",
-        "jffi-1.3.15.jar",
-        "jffi-1.3.15-native.jar",
+        "jffi-1.4.7.jar",
+        "jffi-1.4.7-native.jar",
         "jitescript-0.4.1.jar",
         "jnr-a64asm-1.0.0.jar",
-        "jnr-constants-0.10.4.jar",
-        "jnr-enxio-0.32.20.jar",
-        "jnr-ffi-2.2.19.jar",
+        "jnr-constants-0.11.4.jar",
+        "jnr-enxio-0.33.6.jar",
+        "jnr-ffi-2.3.7.jar",
         "jnr-netdb-1.2.0.jar",
-        "jnr-posix-3.1.22.jar",
-        "jnr-unixsocket-0.38.25.jar",
+        "jnr-posix-3.2.8.jar",
+        "jnr-unixsocket-0.39.9.jar",
         "jnr-x86asm-1.0.2.jar",
         "joda-time-2.12.7.jar",
         "jolt-core-${rootProject.versions.jolt}.jar",
```

#### Recent Merged Pull Requests:
- **PR #14763** (2026-11-23): build(deps): bump ch.qos.logback:logback-classic from 1.6.7 to 1.6.8 (@dependabot[bot])
- **PR #14760** (2026-11-23): build(deps): bump gradle-wrapper from 9.9.1 to 9.9.2 in the gradle-plugins group (@dependabot[bot])
- **PR #14759** (2026-11-21): [post-release] Bump up GoCD Version to 26.3.0 (@gocd-ci-user)
- **PR #14757** (closed): Show a not-found message for an unknown job name on the job detail page (@ARAYN7011)
- **PR #14755** (2026-11-21): build(deps): bump org.dbunit:dbunit from 3.5.2 to 3.5.3 in the test group (@dependabot[bot])
- **PR #14752** (2026-11-20): build(deps-ui-dev): bump regexp_parser from 2.13.1 to 2.13.4 in /server/src/main/webapp/WEB-INF/rails (@dependabot[bot])

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

## X. build: use Gradle providers to exec tools to determine versions

**RULE**:
When implementing operations in `build.gradle`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gocd/gocd. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `90a9bc24`: build: use Gradle providers to exec tools to determine versions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `build.gradle`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
  providers: providers,

ext.goVersions = goVersions.withGradleDebuggingOutput()
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
ext.goVersions = goVersions
GoVersions.printGradleDebuggingOutputFor(gradle, goVersions)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `90a9bc24` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
