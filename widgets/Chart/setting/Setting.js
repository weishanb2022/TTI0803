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

define(['dojo/_base/declare', 'dojo/_base/lang', 'dojo/_base/array', 'dojo/_base/html', 'dojo/on', 'dijit/_WidgetsInTemplateMixin', 'jimu/BaseWidgetSetting', 'jimu/dijit/_FeaturelayerSourcePopup', 'jimu/utils', 'jimu/filterUtils', 'jimu/LayerInfos/LayerInfos', './SingleChartSetting', './utils', 'jimu/dijit/SimpleTable', 'jimu/dijit/TabContainer', 'jimu/dijit/ColorPicker', 'dijit/form/Select', 'dijit/form/TextBox'], function (declare, lang, array, html, on, _WidgetsInTemplateMixin, BaseWidgetSetting, _FeaturelayerSourcePopup, jimuUtils, FilterUtils, LayerInfos, SingleChartSetting, utils, SimpleTable) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-chart-setting',
    currentSCS: null,

    _numberFieldTypes: ['esriFieldTypeSmallInteger', 'esriFieldTypeInteger', 'esriFieldTypeSingle', 'esriFieldTypeDouble'],

    postMixInProperties: function postMixInProperties() {
      this.inherited(arguments);
      this.layerInfosObj = LayerInfos.getInstanceSync();
      utils.layerInfosObj = this.layerInfosObj;
      this.nls.horizontalAxis = this.nls.horizontalAxis || "Horizontal Axis";
      this.nls.verticalAxis = this.nls.verticalAxis || "Vertical Axis";
      this.nls.dataLabels = this.nls.dataLabels || "Data Labels";
      this.nls.color = this.nls.color || "Color";
      this.nls.colorful = this.nls.colorful || "Colorful";
      this.nls.monochromatic = this.nls.monochromatic || "Monochromatic";
      if (this.config) {
        this._setUrlForConfig(this.config);
        this._updateConfig();
      }
    },

    postCreate: function postCreate() {
      this.inherited(arguments);
      this._initSelf();
      if (this.config) {
        this.setConfig(this.config);
      }
    },

    _initSelf: function _initSelf() {
      var fields = [{
        name: "name",
        title: this.nls.name,
        width: "auto",
        type: "text",
        editable: false
      }, {
        name: "actions",
        title: "",
        width: "70px",
        type: "actions",
        actions: ["up", "down", "delete"]
      }];
      this.chartList = new SimpleTable({
        fields: fields,
        autoHeight: false,
        selectable: true,
        style: "position:absolute; top:0; bottom:10px;"
      });
      html.addClass(this.chartList.domNode, 'chart-list-table');
      this.own(on(this.chartList, 'row-delete', lang.hitch(this, this._onChartItemRemoved)));
      this.own(on(this.chartList, 'row-select', lang.hitch(this, this._onChartItemSelected)));
      this.chartList.placeAt(this.chartListContent, 'first');
    },

    _updateConfig: function _updateConfig() {
      if (this.config && this.config.charts && this.config.charts.length > 0) {
        array.forEach(this.config.charts, lang.hitch(this, function (singleConfig) {
          this._rebuildFilter(singleConfig.url, singleConfig.filter);
        }));
      }
    },

    _setUrlForConfig: function _setUrlForConfig(config) {
      if (config.charts && config.charts.length > 0) {
        array.forEach(config.charts, lang.hitch(this, function (singleConfig) {
          if (singleConfig.webMapLayerId) {
            var info = this.layerInfosObj.getLayerOrTableInfoById(singleConfig.webMapLayerId);
            if (info) {
              singleConfig.url = info.getUrl();
            }
          }
        }));
      }
    },

    _rebuildFilter: function _rebuildFilter(url, filter) {
      try {
        if (filter) {
          delete filter.expr;
          var filterUtils = new FilterUtils();
          filterUtils.isHosted = jimuUtils.isHostedService(url);
          filterUtils.getExprByFilterObj(filter);
        }
      } catch (e) {
        console.log(e);
      }
    },

    setConfig: function setConfig(config) {
      this._setUrlForConfig(config);

      if (this.currentSCS) {
        this.currentSCS.destroy();
      }
      this.currentSCS = null;
      this.chartList.clear();

      this.config = config;
      var charts = this.config && this.config.charts;
      if (lang.isArrayLike(charts)) {
        array.forEach(charts, lang.hitch(this, function (singleConfig, index) {
          var addResult = this.chartList.addRow({ name: singleConfig.name || '' });
          var tr = addResult.tr;
          tr.singleConfig = lang.clone(singleConfig);
          if (index === 0) {
            this.chartList.selectRow(tr);
          }
        }));
      }
    },

    getConfig: function getConfig() {
      if (this.currentSCS) {
        var currentSingleConfig = this.currentSCS.getConfig(true);
        if (currentSingleConfig) {
          this.currentSCS.tr.singleConfig = lang.clone(currentSingleConfig);
        } else {
          return false;
        }
      }
      var config = {
        charts: []
      };
      var trs = this.chartList.getRows();
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i];
        config.charts.push(lang.clone(tr.singleConfig));
        if (config.charts[i].webMapLayerId) {
          config.charts[i].url = '';
        }
      }
      this.config = lang.clone(config);
      return config;
    },

    _onAddNewClicked: function _onAddNewClicked() {
      if (this.currentSCS) {
        var singleConfig = this.currentSCS.getConfig(true);
        if (singleConfig) {
          this.currentSCS.tr.singleConfig = singleConfig;
        } else {
          return;
        }
      }

      var args = {
        titleLabel: this.nls.setDataSource,

        dijitArgs: {
          multiple: false,
          createMapResponse: this.map.webMapResponse,
          portalUrl: this.appConfig.portalUrl,
          style: {
            height: '100%'
          }
        }
      };

      var featurePopup = new _FeaturelayerSourcePopup(args);
      this.own(on(featurePopup, 'ok', lang.hitch(this, function (item) {
        //{name, url, definition}
        var layerSourceType = featurePopup.getSelectedRadioType();
        featurePopup.close();

        if (this.currentSCS) {
          this.currentSCS.destroy();
          this.currentSCS = null;
        }

        //var chartName = this._getSuitableQueryName(item.name);
        var chartName = item.name || "";
        var addResult = this.chartList.addRow({ name: chartName });
        if (addResult.success) {
          var tr = addResult.tr;
          this.chartList.selectRow(tr);
          if (this.currentSCS) {
            var expr = null;
            // if(layerSourceType === 'map'){
            //   var layerObject = item.layerInfo && item.layerInfo.layerObject;
            //   if(layerObject && typeof layerObject.getDefinitionExpression === 'function'){
            //     expr = layerObject.getDefinitionExpression();
            //   }
            // }
            var layerId = item.layerInfo && item.layerInfo.id;
            var url = item.url;
            this.shelter.show();
            utils.getLayerDefinitionByLayerIdOrUrl(layerId, url).then(function (definition) {
              this.shelter.hide();
              item.definition = null;
              item.definition = definition;
              this.currentSCS.setNewLayerDefinition(item, layerSourceType, chartName, expr);
            }.bind(this), function (err) {
              console.error(err);
              this.shelter.hide();
            }.bind(this));
          }
        }
      })));

      this.own(on(featurePopup, 'cancel', lang.hitch(this, function () {
        featurePopup.close();
      })));

      featurePopup.startup();
    },

    _hasNumberFields: function _hasNumberFields(layerDefinition) {
      var result = false;
      var fieldInfos = layerDefinition.fields;
      if (fieldInfos && fieldInfos.length > 0) {
        result = array.some(fieldInfos, lang.hitch(this, function (fieldInfo) {
          return this._numberFieldTypes.indexOf(fieldInfo.type) >= 0;
        }));
      }
      return result;
    },

    _onChartItemRemoved: function _onChartItemRemoved(tr) {
      if (this.currentSCS) {
        if (this.currentSCS.tr === tr) {
          this.currentSCS.destroy();
          this.currentSCS = null;
        }
      }
    },

    _onChartItemSelected: function _onChartItemSelected(tr) {
      if (this.currentSCS) {
        if (this.currentSCS.tr !== tr) {
          var singleConfig = this.currentSCS.getConfig(true);
          if (singleConfig) {
            this.currentSCS.tr.singleConfig = singleConfig;
            this.currentSCS.destroy();
            this.currentSCS = null;
            this._createSingleChartSetting(tr);
          } else {
            this.chartList.selectRow(this.currentSCS.tr);
          }
        }
      } else {
        this._createSingleChartSetting(tr);
      }
    },

    _createSingleChartSetting: function _createSingleChartSetting(tr) {
      var args = {
        map: this.map,
        nls: this.nls,
        config: tr.singleConfig,
        tr: tr,
        _layerDefinition: tr._layerDefinition,
        folderUrl: this.folderUrl,
        appConfig: this.appConfig
      };
      this.currentSCS = new SingleChartSetting(args);
      this.currentSCS.placeAt(this.singleChartContainer);

      this.own(on(this.currentSCS, 'name-change', lang.hitch(this, function (chartName) {
        this.chartList.editRow(tr, { name: chartName });
      })));

      this.own(on(this.currentSCS, 'show-shelter', lang.hitch(this, function () {
        this.shelter.show();
      })));

      this.own(on(this.currentSCS, 'hide-shelter', lang.hitch(this, function () {
        this.shelter.hide();
      })));

      this.currentSCS.startup();

      //first bind event, then setConfig
      this.currentSCS.setConfig(tr.singleConfig);

      return this.currentSCS;
    }
  });
});
//# sourceMappingURL=Setting.js.map
