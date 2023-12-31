///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(["dojo/_base/declare", "./SearchComponent", "dojo/text!./templates/BBoxOption.html", "dojo/i18n!../nls/strings", "dijit/form/CheckBox"], function (declare, SearchComponent, template, i18n) {

  return declare([SearchComponent], {

    i18n: i18n,
    templateString: template,

    postCreate: function postCreate() {
      this.inherited(arguments);
      this.bboxToggle.set("checked", true);
    },

    bboxClicked: function bboxClicked() {
      this.search();
    },

    _getBBox: function _getBBox() {
      var ext,
          map = this.getMap();
      if (map) {
        ext = map.geographicExtent;
        if (ext) {
          return ext.xmin + "," + ext.ymin + "," + ext.xmax + "," + ext.ymax;
        }
      }
      return null;
    },

    /* SearchComponent API ============================================= */

    appendQueryParams: function appendQueryParams(params) {
      if (this.bboxToggle.get("checked")) {
        var bbox = this._getBBox();
        if (bbox !== null) {
          // TODO is bbox just a filter, are results spatially ranked?
          params.canSortByRelevance = true;
          params.bbox = bbox;
        }
      }
    }

  });
});
//# sourceMappingURL=BBoxOption.js.map
