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
define(['jimu/shared/BaseVersionManager'], function (BaseVersionManager) {
  function VersionManager() {
    this.versions = [{
      version: '1.0',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '1.1',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '1.2',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '1.3',
      upgrader: function upgrader(oldConfig) {
        var newConfig = oldConfig;
        newConfig.initiallyExpand = false;
        return newConfig;
      }
    }, {
      version: '1.4',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.0beta',
      upgrader: function upgrader(oldConfig) {
        var newConfig = oldConfig;
        newConfig.filterByMapExtent = true;

        return newConfig;
      }
    }, {
      version: '2.0',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.0.1',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.1',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.2',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.3',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.4',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.5',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.6',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.7',
      upgrader: function upgrader(oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.8',
      upgrader: function upgrader(oldConfig) {
        var newConfig = oldConfig;
        newConfig.allowTextSelection = true;

        return newConfig;
      }
    }, {
      version: '2.10',
      upgrader: function upgrader(oldConfig) {
        var newConfig = oldConfig;
        newConfig.syncWithLayers = false;

        return newConfig;
      }
    }];
  }

  VersionManager.prototype = new BaseVersionManager();
  VersionManager.prototype.constructor = VersionManager;
  return VersionManager;
});
//# sourceMappingURL=VersionManager.js.map
