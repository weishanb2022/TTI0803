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

define(['dojo/_base/declare', 'dojo/_base/lang', 'jimu/BaseWidget', 'dojo/_base/html', 'jimu/utils', 'dijit/Tooltip', 'dojo/keys', 'dojo/on'], function (declare, lang, BaseWidget, html, jimuUtils, Tooltip, keys, on) {
  var clazz = declare([BaseWidget], {
    name: 'ZoomSlider',

    baseClass: 'jimu-widget-zoomslider',

    _disabledClass: 'jimu-state-disabled',
    _verticalClass: 'vertical',
    _horizontalClass: 'horizontal',
    _floatClass: 'jimu-float-leading',
    _cornerTop: 'jimu-corner-top',
    _cornerBottom: 'jimu-corner-bottom',
    _cornerLeading: 'jimu-corner-leading',
    _cornerTrailing: 'jimu-corner-trailing',

    moveTopOnActive: false,

    postMixInProperties: function postMixInProperties() {
      this.jimuCommonNls = window.jimuNls.common;
    },

    postCreate: function postCreate() {
      this.inherited(arguments);

      this.own(on(this.map, 'zoom-end', lang.hitch(this, this._zoomHandler)));
      this._zoomHandler();
    },

    setPosition: function setPosition(position) {
      this.inherited(arguments);
      if (typeof position.height === 'number' && position.height <= 30) {
        this._setOrientation(false);
      } else {
        this._setOrientation(true);
      }
    },

    _zoomHandler: function _zoomHandler() {
      html.removeClass(this.btnZoomIn, this._disabledClass);
      html.removeClass(this.btnZoomOut, this._disabledClass);
      var level = this.map.getLevel();
      var disabledButton = null;
      if (level > -1) {
        if (level === this.map.getMaxZoom()) {
          disabledButton = this.btnZoomIn;
        } else if (level === this.map.getMinZoom()) {
          disabledButton = this.btnZoomOut;
        }
      }
      if (disabledButton) {
        html.addClass(disabledButton, this._disabledClass);
      }
      //add tooltip for zoom btns
      jimuUtils.addTooltipByDomNode(Tooltip, this.btnZoomIn, this.jimuCommonNls.zoomIn);
      jimuUtils.addTooltipByDomNode(Tooltip, this.btnZoomOut, this.jimuCommonNls.zoomOut);
    },

    _onBtnZoomInClicked: function _onBtnZoomInClicked() {
      this.map._extentUtil({ numLevels: 1 });
    },

    _onBtnZoomOutClicked: function _onBtnZoomOutClicked() {
      this.map._extentUtil({ numLevels: -1 });
    },

    _onBtnZoomInKeyDown: function _onBtnZoomInKeyDown(evt) {
      if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
        this._onBtnZoomInClicked();
      }
    },

    _onBtnZoomOutKeyDown: function _onBtnZoomOutKeyDown(evt) {
      if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
        this._onBtnZoomOutClicked();
      }
    },

    _setOrientation: function _setOrientation(isVertical) {
      html.removeClass(this.domNode, this._horizontalClass);
      html.removeClass(this.domNode, this._verticalClass);

      html.removeClass(this.btnZoomIn, this._floatClass);
      html.removeClass(this.btnZoomIn, this._cornerTop);
      html.removeClass(this.btnZoomIn, this._cornerLeading);

      html.removeClass(this.btnZoomOut, this._floatClass);
      html.removeClass(this.btnZoomOut, this._cornerBottom);
      html.removeClass(this.btnZoomOut, this._cornerTrailing);

      if (isVertical) {
        html.addClass(this.domNode, this._verticalClass);
        html.addClass(this.btnZoomIn, this._cornerTop);
        html.addClass(this.btnZoomOut, this._cornerBottom);
      } else {
        html.addClass(this.domNode, this._horizontalClass);
        html.addClass(this.btnZoomIn, this._floatClass);
        html.addClass(this.btnZoomOut, this._floatClass);
        html.addClass(this.btnZoomIn, this._cornerLeading);
        html.addClass(this.btnZoomOut, this._cornerTrailing);
      }
    }

  });
  return clazz;
});
//# sourceMappingURL=Widget.js.map
