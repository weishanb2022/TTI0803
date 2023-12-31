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

define(['dojo/_base/declare', 'dojo/_base/html', 'dijit/_WidgetsInTemplateMixin', "esri/geometry/Point", 'esri/SpatialReference', 'jimu/BaseWidget', 'jimu/utils', 'jimu/dijit/Message', 'dojo/_base/lang', 'dojo/on', "dojo/dom-class", "dijit/DropDownMenu", "dijit/MenuItem", "dojo/aspect", "dojo/Deferred", "esri/request", "esri/graphic", "esri/layers/GraphicsLayer", "esri/tasks/ProjectParameters", "esri/geometry/webMercatorUtils", "esri/symbols/PictureMarkerSymbol", "jimu/portalUtils", "esri/config", "libs/usng/usng", "jimu/SpatialReference/unitUtils", "./a11y/Widget"], function (declare, html, _WidgetsInTemplateMixin, Point, SpatialReference, BaseWidget, utils, Message, lang, on, domClass, DropDownMenu, MenuItem, aspect, Deferred, esriRequest, Graphic, GraphicsLayer, ProjectParameters, webMercatorUtils, PictureMarkerSymbol, portalUtils, esriConfig, usng, unitUtils, a11y) {
  var jimuUnitToNlsLabel = {
    "INCHES": "Inches",
    "FOOT": "Foot",
    "FEET": "Foot",
    "FOOT_US": "Foot_US",
    "YARDS": "Yards",
    "MILES": "Miles",
    "NAUTICAL_MILES": "Nautical_Miles",
    "MILLIMETERS": "Millimeters",
    "CENTIMETERS": "Centimeters",
    "METER": "Meter",
    "METERS": "Meter",
    "KILOMETERS": "Kilometers",
    "DECIMETERS": "Decimeters",
    "DEGREE": "Decimal_Degrees",
    "DECIMAL_DEGREES": "Decimal_Degrees",
    "DEGREES_DECIMAL_MINUTES": "Degrees_Decimal_Minutes",
    "DEGREE_MINUTE_SECONDS": "Degree_Minutes_Seconds",
    "MGRS": "MGRS",
    "USNG": "USNG"
  };
  var esriUnitsToJimuUnit = {
    "esriCentimeters": "CENTIMETERS",
    "esriDecimalDegrees": "DECIMAL_DEGREES",
    "esriDegreeMinuteSeconds": "DEGREE_MINUTE_SECONDS",
    "esriDecimeters": "DECIMETERS",
    "esriFeet": "FOOT",
    "esriInches": "INCHES",
    "esriKilometers": "KILOMETERS",
    "esriMeters": "METER",
    "esriMiles": "MILES",
    "esriMillimeters": "MILLIMETERS",
    "esriNauticalMiles": "NAUTICAL_MILES",
    "esriPoints": "POINTS",
    "esriUnknownUnits": "UNKNOWN",
    "esriYards": "YARDS"
  };
  /**
   * The Coordinate widget displays the current mouse coordinates.
   * If the map's spatial reference is geographic or web mercator,
   * the coordinates can be displayed as
   * decimal degrees or as degree-minute-seconds.
   * Otherwise, the coordinates will show in map units.
   *
   * @module widgets/Coordinate
   */
  var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {
    /**
    * realtime: {
    *   102100: all unit,
    *   4326: geoUnit,usng,mgrs,
    *   projCS: projUnit,
    *   geoCS: geoUnit,usng,mgrs,
    * }
    * click: {
    *   projectCS: {
    *     geoUnit:  convert to ellipsoidal coordinates,
    *     projUnit: convert on client,
    *     usng、mgrs: get longtitude and latitude, then convert to usng/mgrs on client,
    *   },
    *   geoCS: {
    *     geoUnit: convert to ellipsoidal coordinates,
    *     usng、mgrs: get longtitude and latitude, then convert to usng/mgrs on client
    *   }
    * }
    */

    baseClass: 'jimu-widget-coordinate',
    name: 'Coordinate',
    popMenu: null,
    selectedWkid: null,
    selectedItem: null,
    selectedTfWkid: null,
    _defaultItem: null, //for config upgrade from 6.3
    forward: true,
    enableRealtime: false,
    geoServiceUrl: null,

    _mapWkid: null,
    _configured: false,
    _markerGraphic: null,

    moveTopOnActive: false,

    _ENABLE_MAP_POPUP: false,

    postMixInProperties: function postMixInProperties() {
      this.nls.enableClick = this.nls.enableClick || "Click to enable clicking map to get coordinates";
      this.nls.disableClick = this.nls.disableClick || "Click to disable clicking map to get coordinates";
    },

    postCreate: function postCreate() {
      this.inherited(arguments);
      domClass.add(this.coordinateBackground, "coordinate-background");
      this.own(on(this.map, "extent-change", lang.hitch(this, this.onExtentChange)));
      this.own(on(this.map, "mouse-move", lang.hitch(this, this.onMouseMove)));
      this.own(on(this.map, "click", lang.hitch(this, this.onMapClick)));

      this.a11y_initEvents();

      this.graphicsLayer = new GraphicsLayer();
      this.map.addLayer(this.graphicsLayer);
    },

    startup: function startup() {
      this.inherited(arguments);
      this._mapWkid = this.map.spatialReference.isWebMercator() ? 3857 : this.map.spatialReference.wkid;
      this.selectedWkid = this._mapWkid;

      if (!(this.config.spatialReferences && this.config.spatialReferences.length > 1)) {
        html.setStyle(this.foldableNode, 'display', 'none');
      } else {
        html.setStyle(this.foldableNode, 'display', 'inline-block');
      }
    },

    onOpen: function onOpen() {
      this._processData().then(lang.hitch(this, function (spatialReferences) {
        if (!this.domNode) {
          return;
        }
        this.initPopMenu(spatialReferences);

        var isHidePopmenu = this.popMenu.getChildren().length <= 1;
        if (isHidePopmenu) {
          html.setStyle(this.foldContainer, 'display', 'none');
        }

        this.a11y_init({ isHidePopmenu: isHidePopmenu });
      }), lang.hitch(this, function (err) {
        console.error(err);
      }));
    },

    _processMapUnits: function _processMapUnits(mapData) {
      var def = new Deferred();
      if (mapData.units) {
        def.resolve(mapData);
      } else {
        // MapServer or VectorTileServer
        var sr = mapData.spatialReference || lang.exists('tileInfo.spatialReference', mapData) && mapData.tileInfo.spatialReference;
        var ext = mapData.extent || mapData.initialExtent || mapData.fullExtent;
        var wkid = sr && (sr.latestWkid || sr.wkid) || ext && ext.spatialReference && ext.spatialReference.wkid;
        var that = this;
        require(['jimu/SpatialReference/srUtils'], function (srUtils) {
          srUtils.loadResource().then(lang.hitch(that, function () {
            var unit = srUtils.getCSUnit(wkid);
            mapData.units = unit;

            def.resolve(mapData);
          }));
        });
      }
      return def;
    },

    _processData: function _processData() {
      var def = new Deferred();

      // types of basemap: mapServer, imageServer, bingMap, openStreetMap, webTiledMap
      var basemap = this.map.itemInfo.itemData.baseMap.baseMapLayers[0];
      if (!(this.config.spatialReferences && this.config.spatialReferences.length)) {
        portalUtils.getUnits(this.appConfig.portalUrl).then(lang.hitch(this, function (units) {
          var isBingMap = basemap && (basemap.type === "BingMapsRoad" || basemap.type === "BingMapsHybrid" || basemap.type === "BingMapsAerial");
          var isWebTiled = basemap && basemap.type === 'WebTiledLayer';
          var isVectorTile = basemap && basemap.type === 'VectorTileLayer';
          if ("WMS" === basemap.type) {
            //support WMS basemap
            this._getWMSBaseMapInfo().then(lang.hitch(this, function (options) {
              this._configured = false;
              def.resolve(options);
            }));
          } else if (basemap && basemap.url) {
            esriRequest({
              url: basemap.url,
              handleAs: "json",
              callbackParamName: "callback",
              content: {
                f: "json"
              }
            }).then(lang.hitch(this, function (mapData) {
              this._processMapUnits(mapData).then(lang.hitch(this, function (mapData) {
                var unitOptions = this._getUnconfiguredUnitOptions(mapData.units, units);
                var sr = mapData.spatialReference;
                var ext = mapData.extent;
                var wkid = sr && (sr.latestWkid || sr.wkid) || ext && ext.spatialReference && ext.spatialReference.wkid;
                var json = {
                  'wkid': wkid,
                  'label': "",
                  'outputUnit': unitOptions.outputUnit
                };
                var _options = {
                  sameSRWithMap: true,
                  defaultUnit: esriUnitsToJimuUnit[mapData.units] || mapData.units,
                  isGeographicUnit: unitOptions.isGeographicUnit,
                  isGeographicCS: unitOptions.isGeographicCS,
                  isProjectUnit: unitOptions.isProjectUnit,
                  isProjectedCS: unitOptions.isProjectedCS,
                  unitRate: unitOptions.unitRate
                };
                json.options = _options;

                this._configured = false;
                def.resolve(json);
              }));
            }), lang.hitch(this, function (err) {
              console.error(err);
              def.reject(err);
            }));
          } else if (basemap && (basemap.type === "OpenStreetMap" || isBingMap || isWebTiled || isVectorTile)) {
            var unitOptions = this._getUnconfiguredUnitOptions("esriMeters", units);
            var json = {
              wkid: 3857,
              label: "",
              outputUnit: unitOptions.outputUnit
            };
            var _options = {
              sameSRWithMap: true,
              defaultUnit: esriUnitsToJimuUnit.esriMeters,
              isGeographicUnit: unitOptions.isGeographicUnit,
              isGeographicCS: unitOptions.isGeographicCS,
              isProjectUnit: unitOptions.isProjectUnit,
              isProjectedCS: unitOptions.isProjectedCS,
              unitRate: unitOptions.unitRate
            };
            json.options = _options;

            this._configured = false;
            def.resolve(json);
          } else {
            def.reject(new Error("no baseMap"));
          }
        }));
      } else {
        this._configured = true;
        def.resolve(this.config.spatialReferences);
      }

      return def;
    },

    _getUnconfiguredUnitOptions: function _getUnconfiguredUnitOptions(mapUnits, localeUnits) {
      var _mapUnit = esriUnitsToJimuUnit[mapUnits] || mapUnits,
          _outputUnit = "",
          _unitRate = 1,
          _isGeographicCS = "",
          _isGeographicUnit = "",
          _isProjectedCS = "",
          _isProjectUnit = "";

      if (unitUtils.isProjectUnit(_mapUnit)) {
        _isProjectUnit = true;
        _isProjectedCS = true;
        _isGeographicUnit = false;
        _isGeographicCS = false;
        _outputUnit = localeUnits === "english" ? esriUnitsToJimuUnit.esriFeet.toUpperCase() : esriUnitsToJimuUnit.esriMeters.toUpperCase();
        _unitRate = unitUtils.getUnitRate(_mapUnit.toUpperCase(), _outputUnit);
      } else if (unitUtils.isGeographicUnit(_mapUnit)) {
        _isProjectUnit = false;
        _isProjectedCS = false;
        _isGeographicUnit = true;
        _isGeographicCS = true;
        _outputUnit = _mapUnit.toUpperCase();
      }

      //default show mercator is degrees.
      if (this.map.spatialReference.isWebMercator()) {
        _outputUnit = esriUnitsToJimuUnit.esriDecimalDegrees;
        _isGeographicUnit = true;
        _isProjectUnit = false;
        _unitRate = 1;
      }

      return {
        outputUnit: _outputUnit,
        unitRate: _unitRate,
        isGeographicUnit: _isGeographicUnit,
        isGeographicCS: _isGeographicCS,
        isProjectUnit: _isProjectUnit,
        isProjectedCS: _isProjectedCS
      };
    },

    initPopMenu: function initPopMenu(spatialReferences) {
      this.popMenu = new DropDownMenu({}, this.coordinateMenu);
      aspect.after(this.popMenu, "onItemClick", lang.hitch(this, this.onClickMenu), true);
      //if configured spatialReferences use
      //the first sr as defalut else add the map sr as default.
      if (Object.prototype.toString.call(spatialReferences) !== "[object Array]") {
        //1.without spatialReferences[]
        this.selectedWkid = parseInt(spatialReferences.wkid, 10);
        this.addMenuItem('', this.selectedWkid, spatialReferences.outputUnit, null, null, spatialReferences.options, spatialReferences.isDefault, spatialReferences.alias);
        this.selectedItem = this.popMenu.getChildren()[0];
      } else {
        //2.with spatialReferences[]
        this._addAllMenuItems();
        this._setDefaultItme();

        if (null === this.selectedItem) {
          this.selectedItem = this.popMenu.getChildren()[0]; //for default
        }
      }

      this.selectedWkid = parseInt(this.selectedItem.params.wkid, 10);
      this.selectedTfWkid = this.selectedItem.params.transformationWkid && parseInt(this.selectedItem.params.transformationWkid, 10);
      this.selectedItem.set({
        label: this.getStatusString(true, //set it selected
        this.selectedItem.params.alias || this.selectedItem.params.name, this.selectedItem.params.wkid, this.selectedItem.params.isDefault)
      });
      html.addClass(this.selectedItem.domNode, 'selected-item');

      this._adjustCoordinateInfoUI(this.selectedWkid);
      this.popMenu.startup();

      this.a11y_initPopMenuEvents();
    },

    _addAllMenuItems: function _addAllMenuItems() {
      var len = this.config.spatialReferences.length;
      for (var i = 0; i < len; i++) {
        this.addMenuItem(this.config.spatialReferences[i].label, this.config.spatialReferences[i].wkid, this.config.spatialReferences[i].outputUnit, this.config.spatialReferences[i].transformationWkid, this.config.spatialReferences[i].transformForward, this.config.spatialReferences[i].options, this.config.spatialReferences[i].isDefault, this.config.spatialReferences[i].alias);
      }
    },

    _isWebMercator: function _isWebMercator(wkid) {
      // true if this spatial reference is web mercator
      if (SpatialReference.prototype._isWebMercator) {
        return SpatialReference.prototype._isWebMercator.apply({
          wkid: parseInt(wkid, 10)
        }, []);
      } else {
        var sr = new SpatialReference(parseInt(wkid, 10));
        return sr.isWebMercator();
      }
    },

    canShowInClient: function canShowInClient(wkid) {
      var specialCase = this._mapWkid === 4326 && this._isWebMercator(wkid) || this._isWebMercator(this._mapWkid) && parseInt(wkid, 10) === 4326;
      var option = this.selectedItem.get('options');
      if (option && option.sameSRWithMap || specialCase) {
        return true;
      } else {
        return false;
      }
    },

    onClickMenu: function onClickMenu(event) {
      html.removeClass(this.selectedItem.domNode, 'selected-item');
      this.selectedItem.set({
        label: this.getStatusString(false, this.selectedItem.params.alias || this.selectedItem.params.name, this.selectedItem.params.wkid, this.selectedItem.params.isDefault)
      });
      this.selectedWkid = parseInt(event.params.wkid, 10);
      this.selectedTfWkid = event.params.tfWkid;
      this.forward = event.params.forward;
      event.set({
        label: this.getStatusString(true, event.params.alias || event.params.name, event.params.wkid, event.params.isDefault)
      });
      html.addClass(event.domNode, 'selected-item');
      this.selectedItem = event;

      this._adjustCoordinateInfoUI(this.selectedWkid);

      this.toggleMenuContainer(false);
    },

    _adjustCoordinateInfoUI: function _adjustCoordinateInfoUI(selectedWkid) {
      html.removeClass(this.coordinateInfoMenu, 'coordinate-info-menu-empty');
      this.graphicsLayer.remove(this._markerGraphic);
      this._markerGraphic = null;
      if (this.canShowInClient(selectedWkid)) {
        this.enableRealtime = true;
        this._getDefaultPlaceHolder();
        html.setAttr(this.locateButton, 'title', this.nls.enableClick);
      } else {
        this.enableRealtime = false;
        //this.coordinateInfo.innerHTML = "";
        this.a11y_setCoordinateInfo("");
        html.addClass(this.coordinateInfoMenu, 'coordinate-info-menu-empty');
        html.setAttr(this.locateButton, 'title', this.nls.enableClick);
      }
      html.removeClass(this.locateContainer, 'coordinate-locate-container-active');
      this.enableWebMapPopup();

      this.onExtentChange({
        extent: this.map.extent
      });
    },

    disableWebMapPopup: function disableWebMapPopup() {
      this._ENABLE_MAP_POPUP = false;
      this.map.setInfoWindowOnClick(false);
    },

    enableWebMapPopup: function enableWebMapPopup() {
      this._ENABLE_MAP_POPUP = true;
      this.map.setInfoWindowOnClick(true);
    },

    onLocateButtonClick: function onLocateButtonClick() {
      if (this.isMenuContainerOpen()) {
        this.onFoldContainerClick();
      }
      html.removeClass(this.coordinateInfoMenu, 'coordinate-info-menu-empty');
      html.toggleClass(this.locateContainer, 'coordinate-locate-container-active');
      this.graphicsLayer.remove(this._markerGraphic);
      this._markerGraphic = null;
      if (this.canShowInClient(this.selectedWkid)) {
        if (this.enableRealtime) {
          this.enableRealtime = false;
          //this.coordinateInfo.innerHTML = this.nls.hintMessage;
          this.a11y_setCoordinateInfo(this.nls.hintMessage);
          html.setAttr(this.locateButton, 'title', this.nls.disableClick);
          this.disableWebMapPopup();
        } else {
          this.enableRealtime = true;
          this._getDefaultPlaceHolder();
          html.setAttr(this.locateButton, 'title', this.nls.enableClick);
          this.enableWebMapPopup();
        }
      } else {
        if (html.hasClass(this.locateContainer, 'coordinate-locate-container-active')) {
          //this.coordinateInfo.innerHTML = this.nls.hintMessage;
          this.a11y_setCoordinateInfo(this.nls.hintMessage);
          this.disableWebMapPopup();
          html.setAttr(this.locateButton, 'title', this.nls.disableClick);
        } else {
          //this.coordinateInfo.innerHTML = "";
          this.a11y_setCoordinateInfo("");
          html.addClass(this.coordinateInfoMenu, 'coordinate-info-menu-empty');
          this.enableWebMapPopup();
          html.setAttr(this.locateButton, 'title', this.nls.enableClick);
        }
      }
    },

    onActive: function onActive() {
      if (!this.locateContainer || !html.hasClass(this.locateContainer, 'coordinate-locate-container-active')) {
        return;
      }

      if (this._ENABLE_MAP_POPUP === true) {
        this.enableWebMapPopup(); //trigger after other widgets onDeActive
      } else {
        this.disableWebMapPopup();
      }
    },

    onDeActive: function onDeActive() {
      if (html.hasClass(this.locateContainer, 'coordinate-locate-container-active')) {
        this.onLocateButtonClick();
      }
      if (this.isMenuContainerOpen()) {
        this.onFoldContainerClick();
      }
    },

    getStatusString: function getStatusString(selected, name, wkid, isDefault) {
      var label = "";
      wkid = parseInt(wkid, 10);

      if (selected) {
        label = "<b>" + label + name + "</b>&nbsp;" + this._rtlTheBrackets(wkid) + "&nbsp;";
      } else {
        label = label + name + "&nbsp;&nbsp;" + this._rtlTheBrackets(wkid) + "&nbsp;";
      }

      if (isDefault) {
        label += this.nls.defaultLabel; //show nls
      }
      return label;
    },

    _rtlTheBrackets: function _rtlTheBrackets(str) {
      var rlmFlag = "&rlm;";
      if (window.isRTL) {
        return rlmFlag + "(" + str + ")";
      } else {
        return "(" + str + ")";
      }
    },

    addMenuItem: function addMenuItem(name, wkid, outputUnit, tfWkid, forward, _options, isDefault, alias) {
      var label = this.getStatusString(false, alias || name, wkid, isDefault);
      var item = {
        label: label || "",
        name: name || "",
        wkid: wkid || "",
        outputUnit: outputUnit || "",
        tfWkid: tfWkid || "",
        options: _options,
        isDefault: isDefault,
        alias: alias,
        ownerDocument: this.ownerDocument
      };
      if (item.tfWkid) {
        item.forward = forward;
      }

      var menuItem = new MenuItem(item);
      this.a11y_bindMenuItemEvent(menuItem);

      this.popMenu.addChild(menuItem);
    },

    _toFormat: function _toFormat(num) {
      /*var decimalPlaces = isFinite(parseInt(this.config.decimalPlaces, 10)) ?
        parseInt(this.config.decimalPlaces, 10) : 3;
      var decimalStr = num.toString().split('.')[1] || "",
        decimalLen = decimalStr.length,
        patchStr = "",
        fix = decimalLen < decimalPlaces ? decimalLen : decimalPlaces;
        if (decimalLen < decimalPlaces) {
        patchStr = Array.prototype.join.call({
          length: decimalPlaces - decimalLen + 1
        }, '0');
      }
        num = num.toFixed(fix) + patchStr;
      return this.separator(num, decimalPlaces);*/
      if (isNaN(num)) {
        return "";
      }

      return utils.localizeNumberByFieldInfo(num, {
        format: {
          places: this.config.decimalPlaces,
          digitSeparator: this.config.addSeparator
        }
      });
    },

    onProjectComplete: function onProjectComplete(wkid, geometries) {
      if (!this.selectedWkid || wkid !== this.selectedWkid || !this.domNode) {
        return;
      }
      var point = geometries[0],
          x = point.x,
          y = point.y;
      var outputUnit = this.selectedItem.get('outputUnit');
      var options = this.selectedItem.get('options');

      if ("MGRS" === outputUnit || "USNG" === outputUnit) {
        this._displayUsngOrMgrs(outputUnit, y, x);
      } else if (options.isGeographicUnit) {
        this._displayDegOrDms(outputUnit, y, x);
      } else {
        this._displayProject(outputUnit, y, x);
      }
    },

    _unitToNls: function _unitToNls(outUnit) {
      var nlsLabel = jimuUnitToNlsLabel[outUnit.toUpperCase()];
      return this.nls[nlsLabel] || this.nls[outUnit] || outUnit;
    },

    onProjectError: function onProjectError(msg) {
      new Message({ message: msg.message || msg.toString() });
      //this.coordinateInfo.innerHTML = this.nls.hintMessage;
      this.a11y_setCoordinateInfo(this.nls.hintMessage);
    },

    onExtentChange: function onExtentChange(evt) {
      if (!this.selectedItem) {
        return;
      }

      var cPos = html.position(this.domNode);
      var mPos = html.position(this.map.root);

      if (!window.isRTL) {
        if (cPos.x - mPos.x + cPos.w + 5 >= mPos.w) {
          if ('left' in this.position) {
            html.setStyle(this.domNode, 'right', '5px');
          } else {
            html.setStyle(this.domNode, 'left', '5px');
          }
        }
      } else {
        if (cPos.x - mPos.x <= 0 || cPos.x - mPos.x + cPos.w + 5 >= mPos.w) {
          if ('left' in this.position) {
            html.setStyle(this.domNode, 'left', '5px');
          } else {
            html.setStyle(this.domNode, 'right', '5px');
          }
        }
      }

      if (window.appInfo.isRunInMobile) {
        this.graphicsLayer.remove(this._markerGraphic);
        this._markerGraphic = null;
        html.setStyle(this.locateContainer, 'display', 'none');
        // this.toggleMenuContainer(false);
        html.removeClass(this.coordinateMenuContainer, 'display-coordinate-menu');
        html.setStyle(this.domNode, 'zIndex', 'auto'); //change popup z-index=auto

        if (this.canShowInClient(this.selectedWkid)) {
          this._displayOnClient(evt.extent.getCenter());
        } else {
          this._projectMapPoint(evt.extent.getCenter());
        }
      } else {
        html.setStyle(this.locateContainer, 'display', 'block');
        if (this.popMenu.getChildren().length > 1) {
          html.setStyle(this.foldContainer, 'display', 'block');
        } else {
          html.setStyle(this.foldContainer, 'display', 'none');
        }
      }
    },

    _getMarkerGraphic: function _getMarkerGraphic(mapPoint) {
      var symbol = new PictureMarkerSymbol(this.folderUrl + "css/images/esriGreenPin16x26.png", 16, 26);
      symbol.setOffset(0, 12);
      return new Graphic(mapPoint, symbol);
    },

    onMapClick: function onMapClick(evt) {
      if (window.appInfo.isRunInMobile) {
        return;
      }
      if (this.enableRealtime || !this.selectedItem) {
        return;
      }
      var needMarker = this.canShowInClient(this.selectedWkid) || html.hasClass(this.locateContainer, 'coordinate-locate-container-active');
      if (needMarker && !this._markerGraphic) {
        this._markerGraphic = this._getMarkerGraphic(evt.mapPoint);
        this.graphicsLayer.add(this._markerGraphic);
      }

      if (this.canShowInClient(this.selectedWkid)) {
        this._markerGraphic.setGeometry(evt.mapPoint);
        this._displayOnClient(evt.mapPoint);
        return;
      }

      if (html.hasClass(this.locateContainer, 'coordinate-locate-container-active')) {
        this._markerGraphic.setGeometry(evt.mapPoint);
        var point = new Point(evt.mapPoint.x, evt.mapPoint.y, this.map.spatialReference);
        this._projectMapPoint(point);
      }
    },

    _projectMapPoint: function _projectMapPoint(point) {
      var params = new ProjectParameters();
      var outWkid = null;
      var options = this.selectedItem.get('options');
      params.geometries = [point];

      if (options.isProjectedCS) {
        if (options.isProjectUnit) {
          outWkid = this.selectedWkid;
        } else {
          // geoUnit or USNG, MGRS
          outWkid = options.spheroidCS;
        }
      } else if (options.isGeographicCS) {
        outWkid = this.selectedWkid;
      }

      if (this.selectedTfWkid) {
        params.transformation = new SpatialReference(parseInt(this.selectedTfWkid, 10));
        params.transformForward = JSON.parse(this.forward);
      }

      params.outSR = new SpatialReference(parseInt(outWkid, 10));

      //this.coordinateInfo.innerHTML = this.nls.computing;
      this.a11y_setCoordinateInfo(this.nls.computing);
      esriConfig.defaults.geometryService.project(params, lang.hitch(this, this.onProjectComplete, this.selectedWkid), lang.hitch(this, this.onProjectError));
    },

    _displayOnClient: function _displayOnClient(mapPoint) {
      var outUnit = this.selectedItem.get('outputUnit');

      var x = mapPoint.x,
          y = mapPoint.y;

      var normalizedPoint = null;
      var convertInClient = this._mapWkid === 4326 && this._isWebMercator(this.selectedWkid) || this._isWebMercator(this._mapWkid) && this.selectedWkid === 4326;
      var options = this.selectedItem.get('options');

      // make sure longitude values stays within -180/180
      normalizedPoint = mapPoint.normalize();
      if (options.isGeographicUnit) {
        x = normalizedPoint.getLongitude() || x;
      }
      if (options.isGeographicUnit) {
        y = normalizedPoint.getLatitude() || y;
      }

      if (convertInClient) {
        // process special case
        if (mapPoint.spatialReference.wkid === 4326 && this._isWebMercator(this.selectedWkid)) {
          if ("MGRS" === outUnit || "USNG" === outUnit) {
            this._displayUsngOrMgrs(outUnit, normalizedPoint.getLatitude(), normalizedPoint.getLongitude());
          } else if (options.isGeographicUnit) {
            this._displayDegOrDms(outUnit, y, x);
          } else if (options.isProjectUnit) {
            var mCoord = webMercatorUtils.lngLatToXY(x, y);
            this._displayProject(outUnit, mCoord[1], mCoord[0]);
          }
        } else if (mapPoint.spatialReference.isWebMercator() && this.selectedWkid === 4326) {
          if ("MGRS" === outUnit || "USNG" === outUnit) {
            this._displayUsngOrMgrs(outUnit, normalizedPoint.getLatitude(), normalizedPoint.getLongitude());
          } else if (options.isGeographicUnit) {
            this._displayDegOrDms(outUnit, y, x);
          }
        }
      } else {
        // use default units
        if (options.defaultUnit === outUnit) {
          this._displayCoordinatesByOrder(this._toFormat(x), this._toFormat(y));
          //this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit);
          this.a11y_setCoordinateInfo(this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit));
          return;
        }
        // setting display units
        if (mapPoint.spatialReference.wkid === 4326 || mapPoint.spatialReference.isWebMercator()) {
          if ("MGRS" === outUnit || "USNG" === outUnit) {
            this._displayUsngOrMgrs(outUnit, normalizedPoint.getLatitude(), normalizedPoint.getLongitude());
          } else if (options.isGeographicUnit) {
            this._displayDegOrDms(outUnit, y, x);
          } else if (options.isProjectedCS) {
            this._displayProject(outUnit, y, x);
          }
        } else {
          // proj or geo
          if (options.isProjectedCS) {
            this._displayProject(outUnit, y, x);
          } else if (options.isGeographicCS) {
            if ("MGRS" === outUnit || "USNG" === outUnit) {
              this._displayUsngOrMgrs(outUnit, y, x);
            } else if (options.isGeographicUnit) {
              this._displayDegOrDms(outUnit, y, x);
            }
          }
        }
      }
    },

    onMouseMove: function onMouseMove(evt) {
      if (window.appInfo.isRunInMobile) {
        return;
      }
      if (!this.enableRealtime || !this.selectedItem) {
        return;
      }

      this._displayOnClient(evt.mapPoint);
    },

    destroy: function destroy() {
      if (this._markerGraphic) {
        this.graphicsLayer.remove(this._markerGraphic);
      }
      if (this.graphicsLayer) {
        this.map.removeLayer(this.graphicsLayer);
      }

      this.inherited(arguments);
    },

    _displayUsngOrMgrs: function _displayUsngOrMgrs(outUnit, y, x) {
      if ("MGRS" === outUnit) {
        //this.coordinateInfo.innerHTML = usng.LLtoMGRS(y, x, 5);
        this.a11y_setCoordinateInfo(usng.LLtoMGRS(y, x, 5));
      } else if ("USNG" === outUnit) {
        //this.coordinateInfo.innerHTML = usng.LLtoUSNG(y, x, 5);
        this.a11y_setCoordinateInfo(usng.LLtoUSNG(y, x, 5));
      }

      if (isNaN(y) && isNaN(x)) {
        //this.coordinateInfo.innerHTML = "";
        this.a11y_setCoordinateInfo("");
      } else {
        //this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit);
        this.a11y_setCoordinateInfo(this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit));
      }
    },

    _displayDegOrDms: function _displayDegOrDms(outUnit, y, x) {
      var lat_string = "";
      var lon_string = "";
      var options = this.selectedItem.get('options');

      x = x * options.unitRate;
      y = y * options.unitRate;

      if ("DEGREE_MINUTE_SECONDS" === outUnit) {
        lon_string = this.degToDMS(x, 'LON');
        lat_string = this.degToDMS(y, 'LAT');
        this._displayCoordinatesByOrder(lon_string, lat_string);
      } else if ("DEGREES_DECIMAL_MINUTES" === outUnit) {
        //for hack DEGREES_DECIMAL_MINUTES
        lon_string = this.degToDDM(x);
        lat_string = this.degToDDM(y);
        this._displayCoordinatesByOrder(lon_string, lat_string);
      } else {
        this._displayCoordinatesByOrder(this._toFormat(x), this._toFormat(y));

        if (isNaN(y) && isNaN(x)) {
          //this.coordinateInfo.innerHTML = "";
          this.a11y_setCoordinateInfo("");
        } else {
          //this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit);
          this.a11y_setCoordinateInfo(this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit));
        }
      }
    },

    _displayProject: function _displayProject(outUnit, y, x) {
      var options = this.selectedItem.get('options');
      x = x * options.unitRate;
      y = y * options.unitRate;

      this._displayCoordinatesByOrder(this._toFormat(x), this._toFormat(y));

      if (isNaN(y) && isNaN(x)) {
        //this.coordinateInfo.innerHTML = "";
        this.a11y_setCoordinateInfo("");
      } else {
        //this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit);
        this.a11y_setCoordinateInfo(this.coordinateInfo.innerHTML += " " + this._unitToNls(outUnit));
      }
    },

    _displayCoordinatesByOrder: function _displayCoordinatesByOrder(x, y) {
      var displayOrderLonLat = this.config.displayOrderLonLat; //X,Y
      if (displayOrderLonLat) {
        //this.coordinateInfo.innerHTML = x + "  " + y;
        this.a11y_setCoordinateInfo(x + "  " + y);
      } else {
        //this.coordinateInfo.innerHTML = y + "  " + x;
        this.a11y_setCoordinateInfo(y + "  " + x);
      }
    },

    onFoldContainerClick: function onFoldContainerClick() {
      if (this._configured) {
        this.toggleMenuContainer();
      }

      this.a11y_focusMenuItem();
    },

    isMenuContainerOpen: function isMenuContainerOpen() {
      return html.hasClass(this.coordinateMenuContainer, 'display-coordinate-menu');
    },
    //for ,#17005
    toggleMenuContainer: function toggleMenuContainer(isOpen) {
      if (!isOpen) {
        isOpen = this.isMenuContainerOpen();
        isOpen = !isOpen; //toggleClass
      }

      if (true === isOpen) {
        html.addClass(this.coordinateMenuContainer, 'display-coordinate-menu');
        html.setStyle(this.domNode, 'zIndex', '1'); //change popup z-index=1
      } else if (false === isOpen) {
        html.removeClass(this.coordinateMenuContainer, 'display-coordinate-menu');
        html.setStyle(this.domNode, 'zIndex', 'auto'); //change popup z-index=auto
      }
    },

    /**
     * Helper function to prettify decimal degrees into DMS (degrees-minutes-seconds).
     *
     * @param {number} decDeg The decimal degree number
     * @param {string} decDir LAT or LON
     *
     * @return {string} Human-readable representation of decDeg.
     */
    degToDMS: function degToDMS(decDeg, decDir) {
      /** @type {number} */
      var d = Math.abs(decDeg);
      /** @type {number} */
      var deg = Math.floor(d);
      d = d - deg;
      /** @type {number} */
      var min = Math.floor(d * 60);
      /** @type {number} */
      var sec = Math.floor((d - min / 60) * 60 * 60);
      if (sec === 60) {
        // can happen due to rounding above
        min++;
        sec = 0;
      }
      if (min === 60) {
        // can happen due to rounding above
        deg++;
        min = 0;
      }
      /** @type {string} */
      var min_string = min < 10 ? "0" + min : min;
      /** @type {string} */
      var sec_string = sec < 10 ? "0" + sec : sec;
      /** @type {string} */
      var dir = decDir === 'LAT' ? decDeg < 0 ? "S" : "N" : decDeg < 0 ? "W" : "E";

      return decDir === 'LAT' ? deg + "&deg;" + min_string + "&prime;" + sec_string + "&Prime;" + dir : deg + "&deg;" + min_string + "&prime;" + sec_string + "&Prime;" + dir;
    },
    //for hack Degrees Decimal Minutes
    degToDDM: function degToDDM(decDeg) {
      /** @type {number} */
      var d = Math.abs(decDeg);
      /** @type {number} */
      var deg = Math.floor(d);
      d = d - deg;
      /** @type {number} */
      var min = Math.floor(d * 60);
      /** @type {number} */
      var sec = Math.floor((d - min / 60) * 60 * 60);
      if (sec === 60) {
        // can happen due to rounding above
        min++;
        sec = 0;
      }
      if (min === 60) {
        // can happen due to rounding above
        deg++;
        min = 0;
      }

      var dm = utils.localizeNumberByFieldInfo(min + sec / 60, {
        format: {
          places: this.config.decimalPlaces,
          digitSeparator: this.config.addSeparator
        }
      });

      return deg + "&deg;" + dm + "&prime;";
    },
    _getWMSBaseMapInfo: function _getWMSBaseMapInfo() {
      var def = new Deferred();
      require(['jimu/SpatialReference/srUtils'], lang.hitch(this, function (srUtils) {
        srUtils.loadResource().then(lang.hitch(this, function () {
          var mapWkid = this.map.spatialReference.wkid;
          portalUtils.getUnits(this.appConfig.portalUrl).then(lang.hitch(this, function (units) {
            if (srUtils.isValidWkid(mapWkid)) {
              var item = {
                wkid: srUtils.standardizeWkid(mapWkid),
                label: srUtils.getSRLabel(parseInt(mapWkid, 10))
              };

              if (srUtils.isProjectedCS(item.wkid)) {
                item.outputUnit = units === "english" ? "FOOT" : "METER";
              } else {
                item.outputUnit = item.outputUnit || srUtils.getCSUnit(item.wkid);
              }

              var _options = {
                sameSRWithMap: srUtils.isSameSR(item.wkid, this.map.spatialReference.wkid),
                isGeographicCS: srUtils.isGeographicCS(item.wkid),
                isGeographicUnit: srUtils.isGeographicUnit(item.outputUnit),
                isProjectedCS: srUtils.isProjectedCS(item.wkid),
                isProjectUnit: srUtils.isProjectUnit(item.outputUnit),
                spheroidCS: srUtils.isProjectedCS(item.wkid) ? srUtils.getGeoCSByProj(item.wkid) : item.wkid,
                defaultUnit: srUtils.getCSUnit(item.wkid),
                unitRate: srUtils.getUnitRate(srUtils.getCSUnit(item.wkid), item.outputUnit)
              };

              //default show mercator is degrees.
              if (this.map.spatialReference.isWebMercator()) {
                _options.isGeographicUnit = true;
                _options.isProjectUnit = false;
                _options.unitRate = 1;
                item.outputUnit = "DECIMAL_DEGREES";
              }
              //for hack DEGREES_DECIMAL_MINUTES
              if (item.outputUnit === "DEGREES_DECIMAL_MINUTES") {
                _options.isGeographicUnit = true;
                _options.unitRate = 1;
              }

              item.options = _options;
              def.resolve(item);
            }
          }), lang.hitch(this, function (err) {
            console.error(err);
            def.reject(err);
          }));
        }));
      }));

      return def;
    },
    /*,
    separator: function(nStr, places) {
      if (this.config.addSeparator && JSON.parse(this.config.addSeparator)) {
        return utils.localizeNumber(nStr, {
          places: places
        });
      }
      return nStr;
    }*/
    _setDefaultItme: function _setDefaultItme() {
      //default in setting
      var i, len, item;
      for (i = 0, len = this.popMenu.getChildren().length; i < len; i++) {
        item = this.popMenu.getChildren()[i];

        if (item.params.isDefault === true) {
          this.selectedItem = item;
          this._defaultItem = item;

          break;
        }
      }
      //no default in setting
      var mapWkid = this._mapWkid;
      if (!this._defaultItem) {
        for (i = 0, len = this.popMenu.getChildren().length; i < len; i++) {
          item = this.popMenu.getChildren()[i];

          var wkid = item.params.wkid;
          if (parseInt(wkid, 10) === parseInt(mapWkid, 10)) {
            item.set({
              isDefault: true
            });
            item.params.isDefault = true;

            this._defaultItem = item;
            break; //first item that same wkid
          }
        }
      }

      //style
      if (this._defaultItem) {
        this._setDefaultItemStyle(this._defaultItem);
      }
    },
    _setDefaultItemStyle: function _setDefaultItemStyle(item) {
      item.set({
        label: this.getStatusString(false, //no selected
        item.params.alias || item.params.name, item.params.wkid, item.params.isDefault)
      });
    },
    _getDefaultPlaceHolder: function _getDefaultPlaceHolder() {
      if (utils.isMobileUa()) {
        //this.coordinateInfo.innerHTML = "";
        this.a11y_setCoordinateInfo("");
      } else {
        //this.coordinateInfo.innerHTML = this.nls.realtimeLabel;
        this.a11y_setCoordinateInfo(this.nls.realtimeLabel);
      }
    }
  });

  clazz.extend(a11y);
  return clazz;
});
//# sourceMappingURL=Widget.js.map
