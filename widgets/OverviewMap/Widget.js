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

define(['dojo/_base/declare', 'dojo/_base/lang', 'dojo/_base/html', 'dojo/_base/array', 'dojo/on', 'dojo/Deferred', 'dojo/aspect', 'jimu/BaseWidget', 'esri/dijit/OverviewMap', 'jimu/utils', './utils', "dojo/dom-style", "./a11y/Widget"], function (declare, lang, html, array, on, Deferred, aspect, BaseWidget, OverviewMap, jimuUtils, utils, domStyle, a11y) {
  var clazz = declare([BaseWidget], {
    baseClass: 'jimu-widget-overview',
    overviewMapDijit: null,
    _showDijit: false,
    _handles: null,

    startup: function startup() {
      this._handles = [];
      this.inherited(arguments);
      this.createOverviewMap(); //for "Initially expand the widget"

      if (this.map) {
        this.own(on(this.map, 'layer-add', lang.hitch(this, this._onMainMapBasemapChange)));
        //this.own(on(this.map, 'resize', lang.hitch(this, this._onMainMapResize)));
      }
    },

    setPosition: function setPosition(position) {
      this.position = position;
      html.place(this.domNode, this.map.id);
      this._processAttachTo(this.config, position);
      if (this.started) {
        this._updateDomPosition(this.config.overviewMap.attachTo);
      }
    },

    _processAttachTo: function _processAttachTo(config, position) {
      if (typeof config.overviewMap === "undefined") {
        config.overviewMap = {};
      }
      //set a default "attachTo" by position
      if (typeof config.overviewMap.attachTo === "undefined" && position) {
        if (position.top !== undefined && position.left !== undefined) {
          config.overviewMap.attachTo = !window.isRTL ? "top-left" : "top-right";
        } else if (position.top !== undefined && position.right !== undefined) {
          config.overviewMap.attachTo = !window.isRTL ? "top-right" : "top-left";
        } else if (position.bottom !== undefined && position.left !== undefined) {
          config.overviewMap.attachTo = !window.isRTL ? "bottom-left" : "bottom-right";
        } else if (position.bottom !== undefined && position.right !== undefined) {
          config.overviewMap.attachTo = !window.isRTL ? "bottom-right" : "bottom-left";
        }
      }
    },

    _updateDomPosition: function _updateDomPosition(attachTo) {
      if (this.overviewMapDijit) {
        var initPos = {
          left: 'auto',
          right: 'auto',
          top: 'auto',
          bottom: 'auto',
          width: 'auto',
          zIndex: this.position && this.position.zIndex || 0
        };
        var _position = this._getOverviewPositionByAttach(attachTo);
        lang.mixin(initPos, _position);
        var style = jimuUtils.getPositionStyle(initPos);
        style.position = 'absolute';
        domStyle.set(this.domNode, style);
        domStyle.set(this.overviewMapDijit.domNode, style);

        //change arrow style
        if (this.overviewMapDijit.domNode) {
          html.removeClass(this.overviewMapDijit.domNode, ["ovwTL", "ovwTR", "ovwBL", "ovwBR"]);
          var arrowStyle = "";
          switch (attachTo) {
            case "top-left":
              {
                arrowStyle = "ovwTL";
                break;
              }case "top-right":
              {
                arrowStyle = "ovwTR";
                break;
              }case "bottom-left":
              {
                arrowStyle = "ovwBL";
                break;
              }case "bottom-right":
              {
                arrowStyle = "ovwBR";
                break;
              }default:
              {
                arrowStyle = "ovwTL";
                break;
              }
          }
          html.addClass(this.overviewMapDijit.domNode, arrowStyle);
          html.addClass(this.domNode, arrowStyle); //for a11y
        }
      }
    },

    createOverviewMap: function createOverviewMap(visible) {
      var json = lang.clone(this.config.overviewMap);
      json.map = this.map;
      if (visible !== undefined) {
        json.visible = visible;
      }
      //this._processAttachTo(json, this.position);
      // overviewMap dijit has bug in IE8
      var _isShow = json.visible;
      json.visible = false;

      var _hasMaximizeButton = 'maximizeButton' in json;
      json.maximizeButton = _hasMaximizeButton ? json.maximizeButton : true;
      json.width = 200;
      json.height = 200;
      json.expandFactor = 2; //50
      //json.opacity = 0.5;
      json.attachTo = this.config.overviewMap.attachTo;

      this._getBaseLayerMap().then(lang.hitch(this, function (res) {
        if (res && res.layer && "string" !== typeof res.layer) {
          json.baseLayer = res.layer;
        } else if (json.baseLayer) {
          delete json.baseLayer; //reset to raw basemap
        }

        this.overviewMapDijit = new OverviewMap(json);
        this._handles.push(aspect.after(this.overviewMapDijit, 'show', lang.hitch(this, '_afterOverviewShow')));
        this._handles.push(aspect.after(this.overviewMapDijit, 'hide', lang.hitch(this, '_afterOverviewHide')));
        this.overviewMapDijit.startup();

        this._updateDomPosition(json.attachTo);
        this.domNode.appendChild(this.overviewMapDijit.domNode);

        this.a11y_init();
        this.a11y_initEvents();
        this.a11y_forLaunchpadThemeStyle();

        if (_isShow) {
          this.overviewMapDijit.show();
        }
      }));
    },

    _getOverviewPositionByAttach: function _getOverviewPositionByAttach(attachTo) {
      var _position = {};
      if (attachTo === 'top-left') {
        _position.left = 0;
        _position.top = 0;
      } else if (attachTo === 'top-right') {
        _position.right = 0;
        _position.top = 0;
      } else if (attachTo === 'bottom-left') {
        _position.bottom = 0;
        _position.left = 0;
      } else if (attachTo === 'bottom-right') {
        _position.bottom = 0;
        _position.right = 0;
      }

      if (window.isRTL) {
        if (isFinite(_position.left)) {
          _position.right = _position.left;
          delete _position.left;
        } else {
          _position.left = _position.right;
          delete _position.right;
        }
      }

      return _position;
    },

    _onMainMapBasemapChange: function _onMainMapBasemapChange(evt) {
      if (!(evt.layer && evt.layer._basemapGalleryLayerType)) {
        return;
      }

      this._destroyOverviewMap();
      this.createOverviewMap(this._showDijit);
    },

    onPositionChange: function onPositionChange(position) {
      this.position = position;
      if (this.config.overviewMap.attachTo) {
        return;
      }

      this._destroyOverviewMap();
      this.createOverviewMap(this._showDijit);
    },

    _destroyOverviewMap: function _destroyOverviewMap() {
      array.forEach(this._handles, function (handle) {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      });
      if (this.overviewMapDijit && this.overviewMapDijit.destroy) {
        this.overviewMapDijit.destroy();
        this.overviewMapDijit = null;
        html.empty(this.domNode);
      }
    },

    //_onMainMapResize: function() {
    //  this._destroyOverviewMap();
    //  this.createOverviewMap(this._showDijit);
    //},

    onReceiveData: function onReceiveData(name) {
      if (name !== "BasemapGallery") {
        return;
      }

      this._destroyOverviewMap();
      this.createOverviewMap(this._showDijit);
    },

    onOpen: function onOpen() {
      this._destroyOverviewMap();
      this.createOverviewMap(this._showDijit);
    },

    onClose: function onClose() {
      this._destroyOverviewMap();
    },

    _afterOverviewHide: function _afterOverviewHide() {
      this._showDijit = false;
      domStyle.set(this.domNode, {
        width: "auto",
        height: "auto"
      });
    },

    _afterOverviewShow: function _afterOverviewShow() {
      this._showDijit = true;
      domStyle.set(this.domNode, {
        width: this.overviewMapDijit.width + 'px',
        height: this.overviewMapDijit.height + 'px'
      });
    },

    _getBaseLayerMap: function _getBaseLayerMap() {
      var def = new Deferred();
      if (this.config.overviewMap && this.config.overviewMap.baseLayer) {
        utils.createBaseLayer(this.config.overviewMap.baseLayer, this.map, this).then(function (layer) {
          def.resolve(layer);
        });
      } else {
        def.resolve(null);
      }

      return def;
    }
  });

  clazz.extend(a11y); //for a11y
  return clazz;
});
//# sourceMappingURL=Widget.js.map
