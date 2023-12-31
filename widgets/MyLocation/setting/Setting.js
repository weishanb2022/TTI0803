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

define(['dojo/_base/declare', 'dojo/on', 'dojo/_base/lang', 'dijit/_WidgetsInTemplateMixin', 'jimu/BaseWidgetSetting', 'jimu/dijit/Message', 'dijit/form/NumberTextBox', 'jimu/dijit/CheckBox'], function (declare, on, lang, _WidgetsInTemplateMixin, BaseWidgetSetting, Message) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
    //these two properties is defined in the BaseWidget
    baseClass: 'jimu-widget-mylocation-setting',

    startup: function startup() {
      this.inherited(arguments);
      if (!this.config.locateButton) {
        this.config.locateButton = {};
      }
      if (!this.config.locateButton.geolocationOptions) {
        this.config.locateButton.geolocationOptions = {};
      }

      this.own(on(this.highlightLocation, 'change', lang.hitch(this, '_compassParamHanlder')));
      this.own(on(this.useTracking, 'change', lang.hitch(this, '_compassParamHanlder')));

      this.setConfig(this.config);
    },

    setConfig: function setConfig(config) {
      this.config = config;
      this._setCompassParam();

      if (config.locateButton.geolocationOptions && config.locateButton.geolocationOptions.timeout) {
        this.timeout.set('value', config.locateButton.geolocationOptions.timeout);
      }
      if (config.locateButton.highlightLocation || typeof config.locateButton.highlightLocation === "undefined") {
        this.highlightLocation.setValue(true);
      } else {
        this.highlightLocation.setValue(false);
      }
      if (config.locateButton.useTracking || typeof config.locateButton.useTracking === "undefined") {
        this.useTracking.setValue(true);
      } else {
        this.useTracking.setValue(false);
      }
      //set the scale to zoom , when location has been found
      if (config.locateButton.scale) {
        this.scale.set('value', config.locateButton.scale);
      }
    },

    getConfig: function getConfig() {
      //check inputs
      if (!this.isValid()) {
        new Message({
          message: this.nls.warning
        });
        return false;
      }
      this.config.locateButton.geolocationOptions.timeout = parseInt(this.timeout.value, 10);
      // if (!this.config.locateButton.highlightLocation) {
      this.config.locateButton.highlightLocation = this.highlightLocation.checked;
      // }
      this.config.locateButton.useTracking = this.useTracking.checked;
      this.config.locateButton.scale = parseFloat(this.scale.value);

      this._getCompassParam();

      return this.config;
    },

    isValid: function isValid() {
      if (!this.scale.isValid() || !this.timeout.isValid()) {
        return false;
      }

      return true;
    },

    //compass
    _compassParamHanlder: function _compassParamHanlder() {
      if (this.highlightLocation.checked && this.useTracking.checked) {
        this.useCompass.set("disabled", false);
        this.useAccCircle.set('disabled', false);
      } else {
        this.useCompass.set("disabled", true);
        this.useAccCircle.set('disabled', true);
      }
    },
    _getCompassParam: function _getCompassParam() {
      this.config.useCompass = this.useCompass.checked;
      this.config.useAccCircle = this.useAccCircle.checked;
    },
    _setCompassParam: function _setCompassParam() {
      this.useCompass.setValue(this.config.useCompass);
      this.useAccCircle.setValue(this.config.useAccCircle);
    }
  });
});
//# sourceMappingURL=Setting.js.map
