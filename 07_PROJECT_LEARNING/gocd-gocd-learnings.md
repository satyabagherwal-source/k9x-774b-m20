# Forensic Learning Record (Deep Inspection): gocd/gocd

> **Canonical Artifact**: `07_PROJECT_LEARNING/gocd-gocd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gocd/gocd](https://github.com/gocd/gocd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:42.055Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gocd/gocd`
- **Description**: GoCD - Continuous Delivery server main repository
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7432 stars

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

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/views/dashboard/models/stage_overview_state.js`
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

import {v4 as uuid} from 'uuid';
import Stream from "mithril/stream";

let stageOverviewPipelineName, stageOverviewPipelineCounter, stageOverviewStageName, stageOverviewStageCounter;


const StageOverviewState = {
  model: Stream(),

  modelId: Stream(),

  isOpen: (pipeline, pCounter, stage, sCounter) => ((pipeline === stageOverviewPipelineName) && (pCounter === stageOverviewPipelineCounter) && (stage === stageOverviewStageName) && (sCounter === stageOverviewStageCounter)),

  show: (pipeline, pCounter, stage, sCounter) => {
    StageOverviewState.hide();
    stageOverviewPipelineName = pipeline;
    stageOverviewPipelineCounter = pCounter;
    stageOverviewStageName = stage;
    stageOverviewStageCounter = sCounter;
    StageOverviewState.modelId(uuid());
  },

  hide: () => {
    if (StageOverviewState.model()) {
      StageOverviewState.model().stopRepeater();
      StageOverviewState.model(undefined);
    }

    stageOverviewPipelineName = undefined;
    stageOverviewPipelineCounter = undefined;
    stageOverviewStageName = undefined;
    stageOverviewStageCounter = undefined;

    StageOverviewState.modelId(undefined);
  },

  matchesPipelineAndStage: (pipeline, stage) => ((pipeline === stageOverviewPipelineName) && (stage === stageOverviewStageName)),

  getPipelineName: () => stageOverviewPipelineName,

  getPipelineCounter: () => stageOverviewPipelineCounter,

  getStageName: () => stageOverviewStageName,

  getStageCounter: () => stageOverviewStageCounter
};

export default {
  StageOverviewState
};

```

### Core Architecture Module: `server/src/main/webapp/WEB-INF/rails/webpack/views/dashboard/stage_overview/job_state_widget.tsx`
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

import m from "mithril";
import {MithrilComponent} from "../../../jsx/mithril-component";
import {JobJSON} from "./models/types";

export interface Attrs {
  job: JobJSON;
}

export interface State {
  getState: (job: JobJSON) => string;
}

export class JobStateWidget extends MithrilComponent<Attrs, State> {
  oninit(vnode: m.Vnode<Attrs, State>) {
    vnode.state.getState = (job: JobJSON) => {
      switch (job.state) {
        case "Scheduled":
          return "Waiting for an agent";
        case "Assigned":
          return "Agent assigned";
        case "Preparing":
          return "Checking out materials";
        case "Building":
          return "Building";
        case "Completing":
          return "Uploading artifacts";
        case"Completed":
          return `${job.result}`;
      }
      return "Waiting for agent";
    };
  }

  view(vnode: m.Vnode<Attrs, State>): m.Children | void | null {
    return vnode.state.getState(vnode.attrs.job);
  }

}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13397** (2025-01-08): **Stage Overview Modal not Loading on VSM Page When Pipeline Name Contains a `.`**
  *Symptoms*: ##### Issue Type  - Bug Report  ##### Summary  When clicking on the coloured bar that represents the state of a stage on the value stream map (VSM) page, no stage summary modal is shown.  ##### Environment  ###### Basic environment details * Go Version: `24.4.0` * JAVA Version: `21.0.5` * OS: `Linux 6.8.0-48-generic (Ubuntu 24.04.1 LTS), Linux 5.15.153.1-microsoft-standard-WSL2 (Docker container)` * Browser vendor and version (if relevant): `Brave v1.73.104, Firefox v133.0.3, Chrome v131.0.6778.205`  ###### Additional Environment Details In all cases there are no "natural" pipelines; all pipelines in the instances are pulled from (a) config repo(s). Specifically, we are using the YAML plugin. Additionally, each affected instance uses the AWS secrets manager plugin for providing the password for the config repo(s).  It seems unlikely that these details are relevant, but I am including them just in case.  ##### Steps to Reproduce  <!--- Provide a link to a live example, or an unambiguous set of steps to --> <!--- reproduce this bug include code to reproduce, if relevant --> 1. Visit the VSM page for any pipeline or material (e.g., https://gocd.server.url/go/pipelines/value_stream_map/MyFavouritePipeline/1). 2. Click on the coloured bar that represents the state of any stage in any pipeline in the VSM.   ##### Expected Results Stage overview modal should open.  ##### Actual Results Browser is redirected to an empty anchor (e.g., https://gocd.serv
  **Post-Mortem & Fix Analysis**:
  > This was initially raised [on the mailing list](https://groups.google.com/g/go-cd/c/dXsUxF4XTIA). 
  > > The following screenshots highlight the difference in mouseover behaviour  The mouseover differences are not highly relevant to the modal behaviour although not sure if the inconsistency is intentional. Separate concern.  > When clicking on the coloured bar that represents the state of a stage on the value stream map (VSM) page, no stage summary modal is shown.  I cannot replicate a scenario where the stage overview **never** opens for a given stage; only the case where it will open once and then not open again after the first time (fixed in #13393). In that case an error is logged to the console. Do you see errors in the JS console after clicking?  In any case, I'm afraid I'll need a more specific way to replicate a stage overview *never* being able to open on the VSM page, or to narrow down specific cases where it works or doesn't work. If it's specific to your pipeline definitions, we'll need to find out why. What about different simpler/basic pipelines on your setup?  C
  > Another possibility is that there is something specifically in the names of your pipelines/stages that is not being escaped/handled properly, but I also cannot validate that with redacted details unless you're able to narrow things down a bit on your own to a reproducible case outside of your own environment.

- **Issue #13214** (2024-10-31): **Starting up GoCD 24.3.0 can take hours because of stuck database migration**
  *Symptoms*: ##### Issue Type  Bug Report  ##### Summary  When (re-)starting GoCD, `DatabaseMigrator` takes 9 – 14 hours without apparent CPU or database activity. There are no log messages showing any issues. Next message is “Database upgrade completed successfully”.  ##### Environment  * Oracle Linux 8.10 * H2DB, DB size ~ 2 GB  ###### Basic environment details  * Go Version: `24.3.0 (19261-3d8bed12557f0b310a4bce58f076abbfc2841ae9)` * JAVA Version: `17.0.13` * OS: `Linux 4.18.0-553.22.1.el8_10.x86_64`  ##### Expected Results GoCD should restart quickly.  ##### Actual Results It takes 9 – 14 hours.  ##### Our Research Results A colleague found a [bug ticket](https://github.com/liquibase/liquibase/issues/6178) in Liquibase's Github project. Short summary, details in the linked ticket: * Apache Common changed random string generation, which now uses `/dev/random`. * Therefore Liquibase's update mechanism depends on entropy available in `/dev/random`, which is quickly drained. * GoCD startup hangs without CPU, network or database load waiting for entropy to come available. * I verified that by watching `/proc/sys/kernel/random/entropy_avail` while starting GoCD. * Installing and activating [haveged](https://github.com/jirka-h/haveged) (while GoCD hung on startup) refilled the entropy pool and the database upgrade finished within seconds.  ##### Possible Fix Liquibase fixed that in [PR 6179](https://github.com/liquibase/liquibase/pull/6179). This is already
  **Post-Mortem & Fix Analysis**:
  > Thanks for the very helpful report and digging!  Something like this has been reported at https://groups.google.com/g/go-cd/c/9NawU8Q0QC8 and https://groups.google.com/g/go-cd/c/GjDt2uLXHfw however I hadn't replicated it (was fine within containers on MacOS/Colima for me and hadn't dug into Liquibase's issues, so kudos to you and your colleague).  If the root cause is as described (seems quite possible), could be due to differences in the way entropy is handled across different OSes and virtualisation solutions?  Anyway, seems this would only be a problem with `24.3.0` since in that version commons-lang3 was upgraded to `3.15.0` (Liquibase `4.29.1`) where the underlying problematic change was made that'd require more entropy.  In any case, Liquibase was already upgraded in #13052 so think we should be relatively good here. I'll likely release `24.4.0` at the weekend. If you want to sanity check before then and you have an environment easy to do so, could you try one of the expe
  > 24.4.0 is out now, so you can use an official release to validate.
  > :+1: validated.  Startup without `haveged` works as expected.

- **Issue #12943** (2024-08-04): **"Show password" button not working properly while creating new config repo**
  *Symptoms*: The "show password" toggle does not seem to work properly when creating a new config repo and the asterisks stay as they were rather than showing the raw password.   ![6](https://github.com/user-attachments/assets/9d8c6d34-3003-461a-93b9-ebac3af99520)  _Originally posted by @ysf465639310 in https://github.com/gocd/gocd/issues/12942#issuecomment-2230662606_  Also needs investigation in other places the toggle is used.

- **Issue #12765** (2024-05-14): **Tasks on gocd-agent-docker-dind:v24.1.0 image cannot interact with Docket socket by default**
  *Symptoms*: ##### Issue Type  - Bug Report  #### Summary  Tasks running as the default `go` user on the GoCD Docker DIND image with `24.1.0` can't interact with the Docker socket and get permissions errors such as  ``` permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Post "http://%2Fvar%2Frun%2Fdocker.sock/v1.45/images/create?fromImage=ubuntu&tag=24.04": dial unix /var/run/docker.sock: connect: permission denied ```  This behaviour changed within the docker:dind base image at https://github.com/docker-library/docker/pull/462 which has caused a regression for the GoCD image. And sadly there are not 'proper' dind smoke tests which run a docker command that would catch this.  #### Workarounds   1. Stay on the v23.5.0 image version. This is the easiest, and is forward compatible with a server running 24.1.0.  2. **OR** Build ones own child image to add the user to the correct group.   ```Dockerfile   FROM gocd/gocd-agent-docker-dind:v24.1.0      USER root   RUN adduser go docker   USER go   ```  3. **OR** Add the go user to the group within a GoCD **task** (shell or command):   ```shell   sudo adduser go docker   ```  4. **OR** Add the user to the group with a start-up entrypoint script.   ```shell   echo "sudo adduser go docker" > add-go-user-docker-group.sh   chmod a+x add-go-user-docker-group.sh   docker run -it --privileged -v $(pwd)/add-go-user-docker-group.sh:/docker-entrypoint.d/add-go-user-docke
  **Post-Mortem & Fix Analysis**:
  > Still have problem now
  > Please open a new issue or discussion describing your problem and environment, not comment with no additional detail on an old issue - this is not the right way to get help. The problem described here is solved. If you have a similar problem it's something else.

- **Issue #12764** (2024-11-02): **Secret resolution failure breaks work allocation in server**
  *Symptoms*: ##### Issue Type  - Bug Report   ##### Summary  This might need more safety on both plugin and server, but decryption failures in file based secrets (e.g due to encryption with wrong key) here propagate back to the server as a `RuntimeException` which is then not handled properly and leads to a work allocation loop.  Probably needs fixed in both places.  ``` java.lang.RuntimeException: javax.crypto.BadPaddingException: Given final block not properly padded. Such issues can arise i f a bad key is used during decryption.         at com.thoughtworks.go.plugin.infra.FelixGoPluginOSGiFramework.executeActionOnTheService(FelixGoPluginOSGiFramework. java:209)         at com.thoughtworks.go.plugin.infra.FelixGoPluginOSGiFramework.doOn(FelixGoPluginOSGiFramework.java:163)         at com.thoughtworks.go.plugin.infra.DefaultPluginManager.submitTo(DefaultPluginManager.java:131)         at com.thoughtworks.go.plugin.access.PluginRequestHelper.submitRequest(PluginRequestHelper.java:49)         at com.thoughtworks.go.plugin.access.secrets.v1.SecretsExtensionV1.lookupSecrets(SecretsExtensionV1.java:100)         at com.thoughtworks.go.plugin.access.secrets.SecretsExtension.lookupSecrets(SecretsExtension.java:81)         at com.thoughtworks.go.server.service.SecretParamResolver.lambda$lookupAndUpdateSecretParamsValue$1(SecretParamResol ver.java:187)         at java.base/java.util.HashMap.forEach(Unknown Source)         at com.thoughtworks.go.server.service.SecretParamRes
  **Post-Mortem & Fix Analysis**:
  > hi Chad,  i have this issue... i think it's related so :   Errors Modification check failed for material: URL: _.git, Branch: main Affected pipelines are go_agent_install, go_agent_update. javax.crypto.BadPaddingException: Given final block not properly padded. Such issues can arise if a bad key is used during decryption.  in my case it's because i copy my secret file in container and the secret_key should be bad (even if i created the file in container ! always with the same cipher...)  :   ``` {     "secret_key": "NRVEtn9hL0ixsuJdIbOqZQ\u003d\u003d",     "secrets": {         "scm-username": "AES:_:_",         "scm-password": "AES:_:_",     } } ```  have you any tricks to solve temporary this issue ? is vault have also this problem ?
  > I don't understand what your specific problem is but the 'workaround ' for the issue described here is to make sure your secrets resolve properly and they are created correctly in your backend so they can be resolved without throwing an exception.  Modification check failure is not at all the same issue described here. This ticket is not about the original resolution failure which could have many reasons depending on the plugin, it's that they shouldn't cause work allocation to get stuck.  If you want more information better to ask the wider community on https://groups.google.com/g/go-cd

- **Issue #12718** (2025-07-19): **Pipeline Activity/Stage Details not working when PluggableSCM material has no modifications for revisions**
  *Symptoms*: ##### Issue Type  <!--- Please specify the issue type to help us categorize the issue, mention any one of the below types -->  - Bug Report  ##### Summary  After upgrade from 21.1.0 to 23.5.0, we're seeing issues browsing Pipeline Activity history.  When going past page 1, this error appears at the top of the page.  We cannot see or click on   `There was an unknown error performing the operation. Possible reason (Server Error)`  ###### Basic environment details  <!--- We recommend providing the for us to reproduce the issue quicker -->  * Go Version: `23.5.0` * JAVA Version: `17.0.9` * OS: `RHEL 9.3 Linux 5.14.0-362.18.1.el9_3.x86_64` * Browser vendor and version (if relevant): `Arc 1.40.0 (49176) Chromium Engine Version 124.0.6367.79`  ###### Additional Environment Details  <!-- More environment details captured from the support API or other sources can be shared here -->  ##### Steps to Reproduce  <!--- Provide a link to a live example, or an unambiguous set of steps to --> <!--- reproduce this bug include code to reproduce, if relevant --> 1. Upgraded from 21.1.0 to 23.5.0.  Not sure how else to reproduce  ##### Expected Results <!--- Tell us what should happen --> Pipeline Activity should work normally.  ##### Actual Results <!--- Tell us what happens instead --> Page 1 is the only page that is displayed until page 289 where data from 2 years ago is displayed.  ##### Log snippets Here's the exception from the logs.  ``` 2024-04-2
  **Post-Mortem & Fix Analysis**:
  > The original ticket was too long and couldn't fit the environment section.  The thread information was removed because it's too big.  Let me know if you need that section.  ##### Environment  ``` {   "Timestamp": "2024-04-25T17:52:48-04:00",   "Go Server Information": {     "Version": "23.5.0 (18179-7702b283accd1f90f014f0087aa2e9bd8baf4a97)"   },   "Config Statistics": {     "Valid Config": {       "Number of pipelines": 2381,       "Number of environments": 9,       "Number of agents": 13,       "Number of unique materials": 1193,       "Number of schedulable materials": 1131     },     "Security": {       "Plugins": [         {           "Password File Authentication Plugin for GoCD": true         },         {           "LDAP Authentication Plugin for GoCD": true         }       ],       "Enabled": true     }   },   "Config file locations": {     "loc.config.dir": "/etc/go",     "loc.log.root.0": "/var/log/go-server",     "loc.log.basename.0": "go-ser
  > When manually specifying a test from stage details that isn't available in the Pipeline Activity page (something past page 1), this error occurs.  ``` 2024-04-25 17:50:14,795 ERROR [qtp498158027-39] Rails:-1 - ActionView::Template::Error (There are no modifications on material 'PluggableSCMMaterial{[url=http://bitbucket.local/scm/gtw/application.git]}'.):      7:             <div class="material_name"><%= "#{scope[:material].getTypeForDisplay()}" %> - <%= "#{scope[:material].getDisplayName()}" -%></div>      8:             <% if !dependency_material?(scope[:material]) %>      9:                 <%if scope[:show_latest_only]%>     10:                     <%= render :partial => "shared/modification", :locals => {:scope => {:modification => material_revision_in_build_cause.getLatestModification(), :pipeline_name => scope[:pipeline_name], :show_files => scope[:show_files]}}-%>     11:                 <%else%>     12:                     <% material_revision_in_build_cause.getModi
  > Thx for the report.  For the pipeline(s) whose pipeline activity page is broken can you check what types of materials they have/had in them?  The error is when returning some details related to plugin provided source materials/SCMs, it seems to expect to find at least one modification but there are none (for some reason).  I note you have a couple of custom source control plugins - stash.pr and artifactory-scm hence trying to figure out if it relates to a specific plugin.

- **Issue #12305** (2023-12-04): **Unable to pick stage from Add Material menu in Chrome on MacOS Sonoma**
  *Symptoms*: ##### Issue Type  - Bug Report  ##### Summary  In Chrome Version 119.0.6045.159 (Official Build) (arm64) on a Mac, there appears to be a bug in the Upstream Pipeline selection drop-down.   Screenshot:   <img width="840" alt="image" src="https://github.com/gocd/gocd/assets/9963006/e933c18c-bbcd-4a7c-9f40-676461763c44">   Video  https://github.com/gocd/gocd/assets/9963006/68194810-8598-43c2-a27e-ed2f6609d32a  As can be seen in the video, selecting the stage blinks on screen and closes too fast for the user to be able to select it.  As a work around, you can use the keys on the keyboard to select the desired stage.  Once the workaround has been performed, the stage can be selected normally.  The functionality appears to work fine with Safari and Firefox.   ###### Basic environment details  <!--- We recommend providing the for us to reproduce the issue quicker -->  * Go Version: `23.4.0` * JAVA Version: `17.0.9` * OS: `Linux 5.15.120+` * Browser vendor and version (if relevant): `Chrome Version 119.0.6045.159 (Official Build) (arm64)`  ###### Additional Environment Details  <!-- More environment details captured from the support API or other sources can be shared here -->  ##### Steps to Reproduce  1.  Open up a material of an existing pipeline 2. Add a material from a pipeline 3. Select material type "another pipeline"  4. Attempt to select upstream stage  ##### Expected Results Should be easy to select the chosen stage  ##### Actual Res
  **Post-Mortem & Fix Analysis**:
  > Presumably it was working OK with Chrome 118 or some earlier version?
  > On further investigation, I think that this could actually be related to the recent rollout of MacOS `Sonoma 14.1.1` in my business, rather than Chrome or GoCD.  I've run a bunch of tests, and I see the issue with Chrome all the way back to Chrome v105, and GoCD versions back to `23.1.0-16079`. I can also confirm that one of our users who does **not** see the issue, is on Chrome `v117.0.5938.149` on MacOS `Ventura 13.2.1`.  Unfortunately I don't have a test Mac to roll back the OS on to investigate further on that point, and my Mac is on Sonoma. 
  > Ok, no worries - at least I should be able to replicate as long as it's not dependent on any particular Chrome extensions, and that's also a bit more narrower and thus easier to trace.

- **Issue #12220** (2023-11-25): **Console view toolbar not shown after scrolling on v23.4.0**
  *Symptoms*: ##### Issue Type - Bug Report  ##### Summary In older versions of go-server up to 23.3.0 an  toolbar was always available at the top of the console view regardless of the current scrolling position, i.e. no matter at which position of the console log I was (top, middle, bottom) this toolbar was present as a dynamic overlay panel. This is the toolbar I am talking about: ![v23 3-panel](https://github.com/gocd/gocd/assets/79832668/5ab92b44-d30a-485d-b889-a5f3550d505b) I have always found it very convenient and used it a lot to toggle the automatic log update, timestamps and the color theme (at times some text was hard to read with its current colors).  In v24.4.0 this toolbar no longer follows the current view but rather scrolls normally with the rest of the log content and immediately goes out of the view if I move a couple of lines down in the log.  Could you please put this nice toolbar back such that it is always available at the top of the view when scrolling console logs?  ###### Basic environment details  * Go Version: 23.4.0 (17731-4deb96d823b921419680560be080588e900d406e). * JAVA Version: 17.0.9 * OS: Linux 5.15.0-88-generic * Browser vendor and version (if relevant): Mozilla Firefox 119.0 
  **Post-Mortem & Fix Analysis**:
  > There was no intention to change this, but it might have been a side effect of something else. There is a lot of old untested stuff on these views, unfortunately.  It might have been an accidental victim of a view framework upgrade like #11817, or some other CSS cleanup like https://github.com/gocd/gocd/commit/7274e1f5fe7ea8d5bd1679043c6b263dfbb69756 (having no idea how it worked before).
  > Ahh, just keeping a note for myself - it's likely that https://github.com/gocd/gocd/blob/0f58107c851cf2df6ce7c6902eebde796dc1f742/server/src/main/webapp/WEB-INF/rails/app/assets/javascripts/lib/jquery-pinOnScroll.js#L81-L112 is not working as expected with the newer jquery versions.

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

### Incident Patch 1: `da2e755d` (2026-10-05)
**Commit Message**: build(deps-ui-dev): bump @types/node (#14643)

Bumps the types group in /server/src/main/webapp/WEB-INF/rails with 1 update: [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node).


Updates `@types/node` from 26.6.3 to 26.6.4
- [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases)
- [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/node)

---
updated-dependencies:
- dependency-name: "@types/node"
  dependency-version: 26.6.4
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: types
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@
     "@types/license-checker": "^25.0.6",
     "@types/lodash": "^4.17.25",
     "@types/mithril": "2.2.9",
-    "@types/node": "^26.6.3",
+    "@types/node": "^26.6.4",
     "@types/prismjs": "^1.26.6",
     "@types/shell-quote": "^1.7.5",
     "@types/underscore.string": "^0.0.42",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -1980,12 +1980,12 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/node@npm:^26.6.3":
-  version: 26.6.3
-  resolution: "@types/node@npm:26.6.3"
+"@types/node@npm:^26.6.4":
+  version: 26.6.4
+  resolution: "@types/node@npm:26.6.4"
   dependencies:
     undici-types: "npm:~8.9.0"
-  checksum: 10c0/51070287167d157d246a5ad83e6ead93aa310bbd9cc880ecd1f244a00c2a31491620f997fbbb6ba4ce164388694827999ec68c1d16c3fb64c1037056e64613c7
+  checksum: 10c0/094e7362df9200ba4c2da09131ca3b5d1aa51535a268a24e4ee2546d9c5a323d1d30cbdaaaa3db7ef8b2387572d1f9edabb11538ab7a09d3bca33ae5cddc2b1b
   languageName: node
   linkType: hard
 
@@ -4605,7 +4605,7 @@ __metadata:
     "@types/license-checker": "npm:^25.0.6"
     "@types/lodash": "npm:^4.17.25"
     "@types/mithril": "npm:2.2.9"
-    "@types/node": "npm:^26.6.3"
+    "@types/node": "npm:^26.6.4"
     "@types/prismjs": "npm:^1.26.6"
     "@types/shell-quote": "npm:^1.7.5"
     "@types/underscore.string": "npm:^0.0.42"
```

---

### Incident Patch 2: `363a6d57` (2026-10-05)
**Commit Message**: build(deps): bump com.bucket4j:bucket4j_jdk17-core from 8.20.0 to 8.21.0 (#14645)

Bumps [com.bucket4j:bucket4j_jdk17-core](https://github.com/bucket4j/bucket4j) from 8.20.0 to 8.21.0.
- [Release notes](https://github.com/bucket4j/bucket4j/releases)
- [Commits](https://github.com/bucket4j/bucket4j/compare/8.20.0...8.21.0)

---
updated-dependencies:
- dependency-name: com.bucket4j:bucket4j_jdk17-core
  dependency-version: 8.21.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ def libraries = [
   assertJ_DB          : 'org.assertj:assertj-db:3.0.2',
   awaitility          : 'org.awaitility:awaitility:4.3.0',
   bouncyCastleBom     : 'org.bouncycastle:bc-jdk18on-bom:1.86.1',
-  bucket4j            : 'com.bucket4j:bucket4j_jdk17-core:8.20.0',
+  bucket4j            : 'com.bucket4j:bucket4j_jdk17-core:8.21.0',
   caffeine            : 'com.github.ben-manes.caffeine:caffeine:3.3.0',
   cloning             : 'io.github.kostaskougios:cloning:1.13.0',
   commonsCodec        : 'commons-codec:commons-codec:1.22.1',
```

---

### Incident Patch 3: `0d60d66d` (2026-10-05)
**Commit Message**: build(deps-ui): bump shell-quote (#14644)

Bumps [shell-quote](https://github.com/ljharb/shell-quote) from 1.11.0 to 1.12.0.
- [Changelog](https://github.com/ljharb/shell-quote/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ljharb/shell-quote/compare/v1.11.0...v1.12.0)

---
updated-dependencies:
- dependency-name: shell-quote
  dependency-version: 1.12.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
     "normalize-scss": "^8.0.0",
     "opensans": "file:node-vendor/opensans#node-vendor/opensans::hash=930bae&locator=gocd-server-ui%40workspace%3A.",
     "prismjs": "^1.30.0",
-    "shell-quote": "^1.11.0",
+    "shell-quote": "^1.12.0",
     "shellwords-ts": "^3.0.1",
     "underscore.string": "^3.3.6",
     "url-parse": "^1.5.10",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -4658,7 +4658,7 @@ __metadata:
     prismjs: "npm:^1.30.0"
     sass-embedded: "npm:^1.105.1"
     sass-loader: "npm:^17.0.1"
-    shell-quote: "npm:^1.11.0"
+    shell-quote: "npm:^1.12.0"
     shellwords-ts: "npm:^3.0.1"
     simulate-event: "npm:^1.4.0"
     sourcemapped-stacktrace: "npm:^1.1.11"
@@ -7735,10 +7735,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"shell-quote@npm:^1.11.0":
-  version: 1.11.0
-  resolution: "shell-quote@npm:1.11.0"
-  checksum: 10c0/c6addefb2c40b3c6172c000306df5781b46ef05cd7ec31017bc600bacd3882f69f55351310fe023dcab692fee98a8062192071d9ab16f5bc9eba056a5b3a378f
+"shell-quote@npm:^1.12.0":
+  version: 1.12.0
+  resolution: "shell-quote@npm:1.12.0"
+  checksum: 10c0/1605a4ed6a758bf13de7cb8197a4184d8015f7a4dbdcd6cd4a717d5b30b3ae7666300cc4ae7f3155cf80ace9739e9e82061ee5aa1a648f53f5fab31a220816d0
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 4: `ed874851` (2026-10-03)
**Commit Message**: build(deps-ui-dev): bump tzinfo-data (#14641)

Bumps [tzinfo-data](https://github.com/tzinfo/tzinfo-data) from 1.2026.4 to 1.2026.5.
- [Release notes](https://github.com/tzinfo/tzinfo-data/releases)
- [Commits](https://github.com/tzinfo/tzinfo-data/compare/v1.2026.4...v1.2026.5)

---
updated-dependencies:
- dependency-name: tzinfo-data
  dependency-version: 1.2026.5
  dependency-type: indirect
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/Gemfile.lock` (modified, +2/-2)
```diff
@@ -164,7 +164,7 @@ GEM
     tsort (0.2.0)
     tzinfo (2.0.6)
       concurrent-ruby (~> 1.0)
-    tzinfo-data (1.2026.4)
+    tzinfo-data (1.2026.5)
       tzinfo (>= 1.0.0)
     useragent (0.16.11)
     webrick (1.9.2)
@@ -253,7 +253,7 @@ CHECKSUMS
   tilt (2.9.0) sha256=da5735d0280bba96e9a91041bb14aee435ccad5c17b0fa519249ae543d9aa3a5
   tsort (0.2.0) sha256=9650a793f6859a43b6641671278f79cfead60ac714148aabe4e3f0060480089f
   tzinfo (2.0.6) sha256=8daf828cc77bcf7d63b0e3bdb6caa47e2272dcfaf4fbfe46f8c3a9df087a829b
-  tzinfo-data (1.2026.4) sha256=22f5f02608f14938ab8b78513a70a22f0b0277614a07273d3bedb3ea45ece104
+  tzinfo-data (1.2026.5) sha256=0bdc3c5a540b1704f73a7b5c9be5c90bd0a5866c8e9e8e8a7885977d23a81645
   useragent (0.16.11) sha256=700e6413ad4bb954bb63547fa098dddf7b0ebe75b40cc6f93b8d54255b173844
   webrick (1.9.2) sha256=beb4a15fc474defed24a3bda4ffd88a490d517c9e4e6118c3edce59e45864131
   xpath (3.2.0) sha256=6dfda79d91bb3b949b947ecc5919f042ef2f399b904013eb3ef6d20dd3a4082e
```

---

### Incident Patch 5: `656c4d04` (2026-10-03)
**Commit Message**: build(deps-ui-dev): bump stylelint (#14640)

Bumps [stylelint](https://github.com/stylelint/stylelint) from 17.15.0 to 17.16.0.
- [Release notes](https://github.com/stylelint/stylelint/releases)
- [Changelog](https://github.com/stylelint/stylelint/blob/main/CHANGELOG.md)
- [Commits](https://github.com/stylelint/stylelint/compare/17.15.0...17.16.0)

---
updated-dependencies:
- dependency-name: stylelint
  dependency-version: 17.16.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@
     "simulate-event": "^1.4.0",
     "sourcemapped-stacktrace": "^1.1.11",
     "style-loader": "^4.0.0",
-    "stylelint": "^17.15.0",
+    "stylelint": "^17.16.0",
     "stylelint-config-standard-scss": "^17.0.0",
     "stylelint-webpack-plugin": "^5.1.0",
     "thread-loader": "^4.0.4",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -4663,7 +4663,7 @@ __metadata:
     simulate-event: "npm:^1.4.0"
     sourcemapped-stacktrace: "npm:^1.1.11"
     style-loader: "npm:^4.0.0"
-    stylelint: "npm:^17.15.0"
+    stylelint: "npm:^17.16.0"
     stylelint-config-standard-scss: "npm:^17.0.0"
     stylelint-webpack-plugin: "npm:^5.1.0"
     thread-loader: "npm:^4.0.4"
@@ -8270,9 +8270,9 @@ __metadata:
   languageName: node
   linkType: hard
 
-"stylelint@npm:^17.15.0":
-  version: 17.15.0
-  resolution: "stylelint@npm:17.15.0"
+"stylelint@npm:^17.16.0":
+  version: 17.16.0
+  resolution: "stylelint@npm:17.16.0"
   dependencies:
     "@csstools/css-calc": "npm:^3.3.0"
     "@csstools/css-parser-algorithms": "npm:^4.0.0"
@@ -8311,7 +8311,7 @@ __metadata:
     write-file-atomic: "npm:^7.0.1"
   bin:
     stylelint: bin/stylelint.mjs
-  checksum: 10c0/1077bfd2206dbb1a6498b1a569314dd7d5f54f629412e58bcaca581898defa7776c3377c967b709603d36dea0ef34c2f6a05901c8cd47560ffdb9dc78746b113
+  checksum: 10c0/68d13ddac44ab77344c9c6204b5981629f9a44829e3a87a63634ece51af0101814eda05ec05273b43967f82e2c9f407a1b455e503a86a63080f88738ac736824
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 6: `1f6bffb6` (2026-10-03)
**Commit Message**: build(deps): bump ch.qos.logback:logback-classic from 1.6.4 to 1.6.5 (#14639)

Bumps [ch.qos.logback:logback-classic](https://github.com/qos-ch/logback) from 1.6.4 to 1.6.5.
- [Release notes](https://github.com/qos-ch/logback/releases)
- [Commits](https://github.com/qos-ch/logback/compare/v_1.6.4...v_1.6.5)

---
updated-dependencies:
- dependency-name: ch.qos.logback:logback-classic
  dependency-version: 1.6.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ def libraries = [
   junit5Bom           : 'org.junit:junit-bom:6.1.3',
   liquibase           : 'org.liquibase:liquibase-core:5.0.4',
   liquibaseSlf4j      : 'com.mattbertolini:liquibase-slf4j:5.1.0',
-  logback             : 'ch.qos.logback:logback-classic:1.6.4',
+  logback             : 'ch.qos.logback:logback-classic:1.6.5',
   lombok              : 'org.projectlombok:lombok:1.18.48',
   mockitoBom          : 'org.mockito:mockito-bom:5.24.0',
   mybatis             : 'org.mybatis:mybatis:3.5.19',
```

---

### Incident Patch 7: `760e0ba5` (2026-10-03)
**Commit Message**: build(deps-ui-dev): bump globals (#14642)

Bumps [globals](https://github.com/sindresorhus/globals) from 17.12.0 to 17.13.0.
- [Release notes](https://github.com/sindresorhus/globals/releases)
- [Commits](https://github.com/sindresorhus/globals/compare/v17.12.0...v17.13.0)

---
updated-dependencies:
- dependency-name: globals
  dependency-version: 17.13.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@
     "file-loader": "^6.2.0",
     "fork-ts-checker-webpack-plugin": "^9.1.0",
     "fs-extra": "^11.4.1",
-    "globals": "^17.12.0",
+    "globals": "^17.13.0",
     "html-webpack-plugin": "^5.6.8",
     "jasmine": "^7.0.0",
     "jasmine-ajax": "^5.0.0",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -4533,10 +4533,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"globals@npm:^17.12.0":
-  version: 17.12.0
-  resolution: "globals@npm:17.12.0"
-  checksum: 10c0/8325cf8818c848871d17c32974c2c74e9c5f09c1b0e04421886f64f21e77c3e95f3ba25586743895a73acd860ada151132481d87d44a1f12993ae7758a694d03
+"globals@npm:^17.13.0":
+  version: 17.13.0
+  resolution: "globals@npm:17.13.0"
+  checksum: 10c0/8371d9e4e5581640141b5cce70a098edd765d2e3ab063b14998e590698071e0afb4a4a6739ccfbdcbdeb2565c5553697ba07d95703c51039912cf341a7dba7a7
   languageName: node
   linkType: hard
 
@@ -4629,7 +4629,7 @@ __metadata:
     fork-ts-checker-webpack-plugin: "npm:^9.1.0"
     foundation-sites: "npm:^6.9.0"
     fs-extra: "npm:^11.4.1"
-    globals: "npm:^17.12.0"
+    globals: "npm:^17.13.0"
     hack-font: "npm:^3.3.0"
     html-webpack-plugin: "npm:^5.6.8"
     jasmine: "npm:^7.0.0"
```

---

### Incident Patch 8: `26d745a7` (2026-10-02)
**Commit Message**: build(deps-ui-dev): bump @types/jasmine (#14633)

Bumps the jasmine group in /server/src/main/webapp/WEB-INF/rails with 1 update: [@types/jasmine](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/jasmine).


Updates `@types/jasmine` from 6.0.0 to 7.0.0
- [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases)
- [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/jasmine)

---
updated-dependencies:
- dependency-name: "@types/jasmine"
  dependency-version: 7.0.0
  dependency-type: direct:development
  update-type: version-update:semver-major
  dependency-group: jasmine
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@
     "@eslint/js": "^9.39.5",
     "@types/awesomplete": "^1.1.16",
     "@types/fs-extra": "^11.0.4",
-    "@types/jasmine": "^6.0.0",
+    "@types/jasmine": "^7.0.0",
     "@types/jasmine-ajax": "^3.3.5",
     "@types/jquery": "^3.5.34",
     "@types/license-checker": "^25.0.6",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -1918,10 +1918,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/jasmine@npm:^6.0.0":
-  version: 6.0.0
-  resolution: "@types/jasmine@npm:6.0.0"
-  checksum: 10c0/9521bb7bd9c897ba6333478cd1c4acd68f813ea9b2ebf0f61283cc0357a9d7581c44f1798f4733ad662b3d1498449ebbb074a0e8bf96b95d6c72e9651fe7e047
+"@types/jasmine@npm:^7.0.0":
+  version: 7.0.0
+  resolution: "@types/jasmine@npm:7.0.0"
+  checksum: 10c0/165dd685981ee34a451ab6d16065531fc6b1789af382ce7186bda1fe814fef319c88f757ac9c267272f213771186a518fe59878f936f490cd8591fb602349e66
   languageName: node
   linkType: hard
 
@@ -4599,7 +4599,7 @@ __metadata:
     "@shopify/draggable": "npm:1.2.1"
     "@types/awesomplete": "npm:^1.1.16"
     "@types/fs-extra": "npm:^11.0.4"
-    "@types/jasmine": "npm:^6.0.0"
+    "@types/jasmine": "npm:^7.0.0"
     "@types/jasmine-ajax": "npm:^3.3.5"
     "@types/jquery": "npm:^3.5.34"
     "@types/license-checker": "npm:^25.0.6"
```

---

### Incident Patch 9: `d07556dc` (2026-10-02)
**Commit Message**: build(deps): bump org.apache.commons:commons-lang3 from 3.20.0 to 3.21.0 (#14634)

Bumps org.apache.commons:commons-lang3 from 3.20.0 to 3.21.0.

---
updated-dependencies:
- dependency-name: org.apache.commons:commons-lang3
  dependency-version: 3.21.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ def libraries = [
   commonsDbcp         : 'org.apache.commons:commons-dbcp2:2.14.0',
   commonsFileUpload   : 'commons-fileupload:commons-fileupload:1.6.0',
   commonsIO           : 'commons-io:commons-io:2.22.0',
-  commonsLang3        : 'org.apache.commons:commons-lang3:3.20.0',
+  commonsLang3        : 'org.apache.commons:commons-lang3:3.21.0',
   commonsPool         : 'org.apache.commons:commons-pool2:2.13.1',
   commonsText         : 'org.apache.commons:commons-text:1.15.0',
   dbunit              : 'org.dbunit:dbunit:3.5.2',
```

---

### Incident Patch 10: `00c5c839` (2026-10-02)
**Commit Message**: build(deps-ui): bump shell-quote (#14635)

Bumps [shell-quote](https://github.com/ljharb/shell-quote) from 1.10.0 to 1.11.0.
- [Changelog](https://github.com/ljharb/shell-quote/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ljharb/shell-quote/compare/v1.10.0...v1.11.0)

---
updated-dependencies:
- dependency-name: shell-quote
  dependency-version: 1.11.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
     "normalize-scss": "^8.0.0",
     "opensans": "file:node-vendor/opensans#node-vendor/opensans::hash=930bae&locator=gocd-server-ui%40workspace%3A.",
     "prismjs": "^1.30.0",
-    "shell-quote": "^1.10.0",
+    "shell-quote": "^1.11.0",
     "shellwords-ts": "^3.0.1",
     "underscore.string": "^3.3.6",
     "url-parse": "^1.5.10",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -4658,7 +4658,7 @@ __metadata:
     prismjs: "npm:^1.30.0"
     sass-embedded: "npm:^1.105.1"
     sass-loader: "npm:^17.0.1"
-    shell-quote: "npm:^1.10.0"
+    shell-quote: "npm:^1.11.0"
     shellwords-ts: "npm:^3.0.1"
     simulate-event: "npm:^1.4.0"
     sourcemapped-stacktrace: "npm:^1.1.11"
@@ -7735,10 +7735,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"shell-quote@npm:^1.10.0":
-  version: 1.10.0
-  resolution: "shell-quote@npm:1.10.0"
-  checksum: 10c0/46ee59bfd972ce6a45500c44ed130dff2d0a7d6fbac9841e59d548518cad8060a06393c9a5dcbc0cede294ad80b2a2cd8c904679e09265f53efc0a0879f30961
+"shell-quote@npm:^1.11.0":
+  version: 1.11.0
+  resolution: "shell-quote@npm:1.11.0"
+  checksum: 10c0/c6addefb2c40b3c6172c000306df5781b46ef05cd7ec31017bc600bacd3882f69f55351310fe023dcab692fee98a8062192071d9ab16f5bc9eba056a5b3a378f
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 11: `822a5daf` (2026-10-02)
**Commit Message**: build(deps-ui-dev): bump sass-embedded (#14636)

Bumps [sass-embedded](https://github.com/sass/embedded-host-node) from 1.105.0 to 1.105.1.
- [Changelog](https://github.com/sass/embedded-host-node/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sass/embedded-host-node/compare/1.105.0...1.105.1)

---
updated-dependencies:
- dependency-name: sass-embedded
  dependency-version: 1.105.1
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@
     "license-checker": "^25.0.1",
     "mini-css-extract-plugin": "^2.10.2",
     "mockdate": "^3.0.5",
-    "sass-embedded": "^1.105.0",
+    "sass-embedded": "^1.105.1",
     "sass-loader": "^17.0.1",
     "simulate-event": "^1.4.0",
     "sourcemapped-stacktrace": "^1.1.11",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +83/-83)
```diff
@@ -4656,7 +4656,7 @@ __metadata:
     normalize-scss: "npm:^8.0.0"
     opensans: "file:node-vendor/opensans#node-vendor/opensans::hash=930bae&locator=gocd-server-ui%40workspace%3A."
     prismjs: "npm:^1.30.0"
-    sass-embedded: "npm:^1.105.0"
+    sass-embedded: "npm:^1.105.1"
     sass-loader: "npm:^17.0.1"
     shell-quote: "npm:^1.10.0"
     shellwords-ts: "npm:^3.0.1"
@@ -7326,162 +7326,162 @@ __metadata:
   languageName: node
   linkType: hard
 
-"sass-embedded-all-unknown@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-all-unknown@npm:1.105.0"
+"sass-embedded-all-unknown@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-all-unknown@npm:1.105.1"
   dependencies:
-    sass: "npm:1.105.0"
+    sass: "npm:1.105.1"
   conditions: (!cpu=arm | !cpu=arm64 | !cpu=riscv64 | !cpu=x64)
   languageName: node
   linkType: hard
 
-"sass-embedded-android-arm64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-android-arm64@npm:1.105.0"
+"sass-embedded-android-arm64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-android-arm64@npm:1.105.1"
   conditions: os=android & cpu=arm64
   languageName: node
   linkType: hard
 
-"sass-embedded-android-arm@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-android-arm@npm:1.105.0"
+"sass-embedded-android-arm@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-android-arm@npm:1.105.1"
   conditions: os=android & cpu=arm
   languageName: node
   linkType: hard
 
-"sass-embedded-android-riscv64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-android-riscv64@npm:1.105.0"
+"sass-embedded-android-riscv64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-android-riscv64@npm:1.105.1"
   conditions: os=android & cpu=riscv64
   languageName: node
   linkType: hard
 
-"sass-embedded-android-x64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-android-x64@npm:1.105.0"
+"sass-embedded-android-x64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-android-x64@npm:1.105.1"
   conditions: os=android & cpu=x64
   languageName: node
   linkType: hard
 
-"sass-embedded-darwin-arm64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-darwin-arm64@npm:1.105.0"
+"sass-embedded-darwin-arm64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-darwin-arm64@npm:1.105.1"
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"sass-embedded-darwin-x64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-darwin-x64@npm:1.105.0"
+"sass-embedded-darwin-x64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-darwin-x64@npm:1.105.1"
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-arm64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-arm64@npm:1.105.0"
+"sass-embedded-linux-arm64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-arm64@npm:1.105.1"
   conditions: os=linux & cpu=arm64
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-arm@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-arm@npm:1.105.0"
+"sass-embedded-linux-arm@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-arm@npm:1.105.1"
   conditions: os=linux & cpu=arm
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-musl-arm64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-musl-arm64@npm:1.105.0"
+"sass-embedded-linux-musl-arm64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-musl-arm64@npm:1.105.1"
   conditions: os=linux & cpu=arm64
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-musl-arm@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-musl-arm@npm:1.105.0"
+"sass-embedded-linux-musl-arm@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-musl-arm@npm:1.105.1"
   conditions: os=linux & cpu=arm
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-musl-riscv64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-musl-riscv64@npm:1.105.0"
+"sass-embedded-linux-musl-riscv64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-musl-riscv64@npm:1.105.1"
   conditions: os=linux & cpu=riscv64
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-musl-x64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-musl-x64@npm:1.105.0"
+"sass-embedded-linux-musl-x64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-musl-x64@npm:1.105.1"
   conditions: os=linux & cpu=x64
   languageName: node
   linkType: hard
 
-"sass-embedded-linux-riscv64@npm:1.105.0":
-  version: 1.105.0
-  resolution: "sass-embedded-linux-riscv64@npm:1.105.0"
+"sass-embedded-linux-riscv64@npm:1.105.1":
+  version: 1.105.1
+  resolution: "sass-embedded-linux-riscv64@npm:1.105.1"
   conditions: os=linux & cpu=riscv64
   languageName: no
```

---

### Incident Patch 12: `0239666a` (2026-10-02)
**Commit Message**: build(deps-ui-dev): bump regexp_parser (#14637)

Bumps [regexp_parser](https://github.com/ammar/regexp_parser) from 2.13.0 to 2.13.1.
- [Changelog](https://github.com/ammar/regexp_parser/blob/master/CHANGELOG.md)
- [Commits](https://github.com/ammar/regexp_parser/compare/v2.13.0...v2.13.1)

---
updated-dependencies:
- dependency-name: regexp_parser
  dependency-version: 2.13.1
  dependency-type: indirect
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/Gemfile.lock` (modified, +2/-2)
```diff
@@ -125,7 +125,7 @@ GEM
       tsort (>= 0.2)
       zeitwerk (~> 2.6)
     rake (13.4.2)
-    regexp_parser (2.13.0)
+    regexp_parser (2.13.1)
     rspec-core (3.13.6)
       rspec-support (~> 3.13.0)
     rspec-expectations (3.13.5)
@@ -237,7 +237,7 @@ CHECKSUMS
   rails-html-sanitizer (1.7.1) sha256=e797a7c9b01e567307e317c576b49ab4168017e63eea4dba9ce3cb587e2f22c2
   railties (7.2.4) sha256=e4b754edc7b42c9f3d6cc3048832efe634d727aa59093a03bf8a78096917f121
   rake (13.4.2) sha256=cb825b2bd5f1f8e91ca37bddb4b9aaf345551b4731da62949be002fa89283701
-  regexp_parser (2.13.0) sha256=d105d95d2138954e73914d2fbfb3d0a8f8605a49a3e89864c32e78b9107cb770
+  regexp_parser (2.13.1) sha256=5aedb6b7c35688f51e86eef17a15374dfd287c83f4ca644b2c5f3ec50a33b44b
   rspec-core (3.13.6) sha256=a8823c6411667b60a8bca135364351dda34cd55e44ff94c4be4633b37d828b2d
   rspec-expectations (3.13.5) sha256=33a4d3a1d95060aea4c94e9f237030a8f9eae5615e9bd85718fe3a09e4b58836
   rspec-mocks (3.13.8) sha256=086ad3d3d17533f4237643de0b5c42f04b66348c28bf6b9c2d3f4a3b01af1d47
```

---

### Incident Patch 13: `f213565d` (2026-10-02)
**Commit Message**: build(deps): bump com.github.oshi:oshi-core from 7.6.1 to 7.7.0 (#14638)

Bumps [com.github.oshi:oshi-core](https://github.com/oshi/oshi) from 7.6.1 to 7.7.0.
- [Release notes](https://github.com/oshi/oshi/releases)
- [Changelog](https://github.com/oshi/oshi/blob/master/CHANGELOG.md)
- [Commits](https://github.com/oshi/oshi/compare/oshi-parent-7.6.1...oshi-parent-7.7.0)

---
updated-dependencies:
- dependency-name: com.github.oshi:oshi-core
  dependency-version: 7.7.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ def libraries = [
   mybatisSpring       : 'org.mybatis:mybatis-spring:2.1.2',
   mysql               : 'com.mysql:mysql-connector-j:26.7.0',
   objenesis           : 'org.objenesis:objenesis:3.6',
-  oshi                : 'com.github.oshi:oshi-core:7.6.1',
+  oshi                : 'com.github.oshi:oshi-core:7.7.0',
   plexusUtils         : 'org.codehaus.plexus:plexus-utils:4.1.0',
   postgresql          : 'org.postgresql:postgresql:42.7.13',
   quartz              : 'org.quartz-scheduler:quartz:2.5.2',
```

---

### Incident Patch 14: `187c46ea` (2026-09-29)
**Commit Message**: build(deps): bump ch.qos.logback:logback-classic from 1.6.3 to 1.6.4 (#14630)

Bumps [ch.qos.logback:logback-classic](https://github.com/qos-ch/logback) from 1.6.3 to 1.6.4.
- [Release notes](https://github.com/qos-ch/logback/releases)
- [Commits](https://github.com/qos-ch/logback/compare/v_1.6.3...v_1.6.4)

---
updated-dependencies:
- dependency-name: ch.qos.logback:logback-classic
  dependency-version: 1.6.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ def libraries = [
   junit5Bom           : 'org.junit:junit-bom:6.1.3',
   liquibase           : 'org.liquibase:liquibase-core:5.0.4',
   liquibaseSlf4j      : 'com.mattbertolini:liquibase-slf4j:5.1.0',
-  logback             : 'ch.qos.logback:logback-classic:1.6.3',
+  logback             : 'ch.qos.logback:logback-classic:1.6.4',
   lombok              : 'org.projectlombok:lombok:1.18.48',
   mockitoBom          : 'org.mockito:mockito-bom:5.24.0',
   mybatis             : 'org.mybatis:mybatis:3.5.19',
```

---

### Incident Patch 15: `728a2ebb` (2026-09-29)
**Commit Message**: build(deps-ui): bump filesize in /server/src/main/webapp/WEB-INF/rails (#14629)

Bumps [filesize](https://github.com/avoidwork/filesize.js) from 11.0.24 to 11.0.25.
- [Changelog](https://github.com/avoidwork/filesize.js/blob/master/CHANGELOG.md)
- [Commits](https://github.com/avoidwork/filesize.js/compare/11.0.24...11.0.25)

---
updated-dependencies:
- dependency-name: filesize
  dependency-version: 11.0.25
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `server/src/main/webapp/WEB-INF/rails/package.json` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@
     "chartjs-plugin-zoom": "^2.2.0",
     "classnames": "^2.5.1",
     "core-js": "^3.50.0",
-    "filesize": "^11.0.24",
+    "filesize": "^11.0.25",
     "foundation-sites": "^6.9.0",
     "hack-font": "^3.3.0",
     "jquery": "^3.7.1",
```

**File**: `server/src/main/webapp/WEB-INF/rails/yarn.lock` (modified, +5/-5)
```diff
@@ -4148,10 +4148,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"filesize@npm:^11.0.24":
-  version: 11.0.24
-  resolution: "filesize@npm:11.0.24"
-  checksum: 10c0/7c94fca10260bd4f3c2eae7c723b78a9b22947c67cca7ab7d833d76755577b5ea28c7968d6007baae19b53457ffda38d4902c5bfb6108c0324e732ddaa9132aa
+"filesize@npm:^11.0.25":
+  version: 11.0.25
+  resolution: "filesize@npm:11.0.25"
+  checksum: 10c0/9debb7726bd441a44d657c9fe78e4f8ddeb92c064dc6de8c2f888a52bfa10915cfd89c847ac9bf59ffb14a6eb0629a351f3233dfcbc5971ddc95ef54ef4738ce
   languageName: node
   linkType: hard
 
@@ -4625,7 +4625,7 @@ __metadata:
     eslint-plugin-react: "npm:^7.37.5"
     eslint-webpack-plugin: "npm:^6.0.0"
     file-loader: "npm:^6.2.0"
-    filesize: "npm:^11.0.24"
+    filesize: "npm:^11.0.25"
     fork-ts-checker-webpack-plugin: "npm:^9.1.0"
     foundation-sites: "npm:^6.9.0"
     fs-extra: "npm:^11.4.1"
```

#### Recent Merged Pull Requests:
- **PR #14645** (2026-10-05): build(deps): bump com.bucket4j:bucket4j_jdk17-core from 8.20.0 to 8.21.0 (@dependabot[bot])
- **PR #14644** (2026-10-05): build(deps-ui): bump shell-quote from 1.11.0 to 1.12.0 in /server/src/main/webapp/WEB-INF/rails (@dependabot[bot])
- **PR #14643** (2026-10-05): build(deps-ui-dev): bump @types/node from 26.6.3 to 26.6.4 in /server/src/main/webapp/WEB-INF/rails in the types group (@dependabot[bot])
- **PR #14642** (2026-10-03): build(deps-ui-dev): bump globals from 17.12.0 to 17.13.0 in /server/src/main/webapp/WEB-INF/rails (@dependabot[bot])
- **PR #14641** (2026-10-03): build(deps-ui-dev): bump tzinfo-data from 1.2026.4 to 1.2026.5 in /server/src/main/webapp/WEB-INF/rails (@dependabot[bot])
- **PR #14640** (2026-10-03): build(deps-ui-dev): bump stylelint from 17.15.0 to 17.16.0 in /server/src/main/webapp/WEB-INF/rails (@dependabot[bot])
- **PR #14639** (2026-10-03): build(deps): bump ch.qos.logback:logback-classic from 1.6.4 to 1.6.5 (@dependabot[bot])
- **PR #14638** (2026-10-02): build(deps): bump com.github.oshi:oshi-core from 7.6.1 to 7.7.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
