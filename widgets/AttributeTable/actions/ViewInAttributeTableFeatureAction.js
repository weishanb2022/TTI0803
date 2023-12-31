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

define(['dojo/_base/declare', 'jimu/BaseFeatureAction', 'jimu/WidgetManager', 'jimu/LayerInfos/LayerInfos'], function (declare, BaseFeatureAction, WidgetManager, LayerInfos) {
  var clazz = declare(BaseFeatureAction, {
    map: null,
    iconClass: 'icon-view-in-attribute',

    isFeatureSupported: function isFeatureSupported(featureSet, layer) {
      if (!featureSet || !layer) {
        return false;
      }
      var layerInfos = LayerInfos.getInstanceSync();
      var layerInfo = layerInfos.getLayerOrTableInfoById(layer.id);
      return featureSet.features.length && layerInfo && layerInfo.getSupportTableInfo().then(function (tableInfo) {
        return tableInfo && tableInfo.isSupportedLayer && tableInfo.isSupportQuery;
      });
    },

    onExecute: function onExecute(featureSet, layer) {
      if (!featureSet || !layer) {
        return;
      }
      var widgetManager = WidgetManager.getInstance();
      var layerInfos = LayerInfos.getInstanceSync();
      var layerInfo = layerInfos.getLayerOrTableInfoById(layer.id);
      featureSet.displayFieldName = layer.objectIdField;

      widgetManager.triggerWidgetOpen(this.widgetId).then(function (attrWidget) {
        if (attrWidget) {
          widgetManager.activateWidget(attrWidget);
          attrWidget.onReceiveData(null, null, {
            target: "AttributeTable",
            layerInfo: layerInfo,
            featureSet: featureSet,
            viewInTableFlag: true
          });
        }
      });
    }
  });
  return clazz;
});
//# sourceMappingURL=ViewInAttributeTableFeatureAction.js.map
