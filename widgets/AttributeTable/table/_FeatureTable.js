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
define(['dojo/_base/declare', 'dojo/_base/html', 'dijit/_WidgetBase', 'jimu/dijit/Message', 'jimu/dijit/Filter', "dgrid/OnDemandGrid", "../dgrid/Selection", // use custom Selection
"dgrid/extensions/ColumnHider", "dgrid/extensions/ColumnResizer", "dgrid/extensions/ColumnReorder", 'dgrid/Keyboard', "dijit/Menu", "dijit/MenuItem", "dijit/PopupMenuItem", 'dijit/Toolbar', 'dijit/form/Button', 'dijit/DropDownMenu', 'dijit/form/ToggleButton', 'dijit/form/DropDownButton', "dojo/Deferred", "dojo/when", 'dojo/Evented', 'dojo/touch', "dojo/store/Memory", "esri/config", "esri/lang", "esri/request", "esri/tasks/RelationParameters", "esri/tasks/RelationshipQuery",
// "esri/layers/GraphicsLayer",
"esri/layers/FeatureLayer", "esri/tasks/QueryTask", "esri/tasks/query", "esri/tasks/ProjectParameters",
// "esri/graphic",
// "esri/geometry/Point",
"esri/geometry/Multipoint", "esri/geometry/geometryEngine",
// "esri/geometry/Polyline",
// "esri/geometry/Polygon",
// "esri/symbols/SimpleLineSymbol",
// "esri/symbols/SimpleFillSymbol",
// "esri/Color",
"esri/geometry/normalizeUtils", "esri/IdentityManager", 'dojo/_base/lang', "dojo/on", "dojo/aspect", "dojo/_base/array", 'jimu/dijit/LoadingIndicator', 'jimu/dijit/FieldStatistics', 'jimu/dijit/Popup', "jimu/dijit/CheckBox", 'jimu/SelectionManager', 'jimu/CSVUtils', 'jimu/utils', "jimu/ArcadeUtils", '../utils', 'dojo/query', 'dojo/string', 'dojo/topic', 'dojo/keys', 'dojo/has'], function (declare, html, _WidgetBase, Message, Filter, OnDemandGrid, Selection, ColumnHider, ColumnResizer, ColumnReorder, Keyboard, Menu, MenuItem, PopupMenuItem, Toolbar, Button, DropDownMenu, ToggleButton, DropDownButton, Deferred, when, Evented, touch, Memory, esriConfig, esriLang, esriRequest, RelationParameters, RelationshipQuery,
// GraphicsLayer,
FeatureLayer, QueryTask, Query, ProjectParameters,
// Graphic,
// Point,
Multipoint, geometryEngine,
// Polyline,
// Polygon,
// SimpleLineSymbol,
// SimpleFillSymbol,
// Color,
normalizeUtils, esriId, lang, on, aspect, array, LoadingIndicator, FieldStatistics, Popup, CheckBox, SelectionManager, CSVUtils, jimuUtils, ArcadeUtils, tableUtils, query, string, topic, keys, has) {
  return declare([_WidgetBase, Evented], {
    baseClass: 'jimu-widget-attributetable-feature-table',
    _defaultFeatureCount: 2000, //default max records by one request
    _defaultBatchCount: 25, //default records per page
    _batchCount: 0, //records per page

    _filterObj: null, // come from filter popup
    _currentDef: null,
    //initial: initial state
    //processing: querying data
    //canceled: stop querying data to save network brandwidth
    //fullfilled: get the data
    _requestStatus: 'initial', // initial, processing, canceled, fulfilled

    parent: null,
    map: null,
    matchingMap: false,
    layerInfo: null,
    configedInfo: null,
    // tableDisplayer: null,
    // parentWidget: null,
    footerHeight: 25,

    layer: null, // layerInfo.layerObject
    loading: null, // LoadingIndicator
    grid: null, // dgrid
    footer: null, // footer div
    selectedRowsLabel: null, // selected div on footer
    selectionRows: null, // id of rows was selected,[id]
    // griaphicLayer: null,
    nls: null,

    //_layerDefinition: null,
    // _filterObj: null,
    _dblClickResult: null, // a feature which be zoom to and show pupup by double click row

    actived: false, // tabcontent is selected
    showSelected: false, // if true only show selected rows
    tableCreated: false, // if true dgrid is created

    // for queryRelatedIds
    // it is set to true when click "Show Related Records" from another _FeatureTable
    // If true, when click "Show All Records", it will be set to false and layerType will be changed
    _relatedQuery: false,
    _relatedQueryIds: null, //[originalFeatureLayerObjectId]

    _selectionHandles: null, //save handles for selecion-complete event of FeatureLayer
    _selectionResults: null, //[Feature], used for SelectionManager.selectFeatures()

    _normalizedExtent: null, //normalized extent of the current layer's extent
    //events:
    //data-loaded//emit after one query requst is done, but maybe not get real features
    //row-click
    //clear-selection
    //sort

    //show-all-records
    //show-selected-records
    //show-related-records
    //show-filter
    //apply-filter
    //toggle-columns
    //export-csv
    //zoom-to
    //refresh

    // CONSTS:
    GRID_FAR_OFF_REMOVAL: {
      DEFAULT: 2000,
      RESELECTION: Infinity,
      INFINITY: Infinity
    },

    constructor: function constructor(options) {
      options = options || {};
      this.set('parent', options.parent || null);
      this.set('map', options.map || null);
      this.set('matchingMap', !!options.matchingMap);
      this.set('layerInfo', options.layerInfo || null);
      this.set('layer', options.layer || null);
      this.set('configedInfo', options.configedInfo || null);

      this.set('relatedOriginalInfo', options.relatedOriginalInfo || null);
      this.set('relationship', options.relationship || null);
      this.set('prevRelationship', null);

      // syncSelection if true scroll record to view after click feature in map
      this.set('syncSelection', !!options.syncSelection || true);
    },

    postCreate: function postCreate() {
      this.inherited(arguments);
      this._relatedQueryIds = [];
      this.createToolbar();
      this.loading = new LoadingIndicator();
      this.loading.placeAt(this.domNode);

      this.selectionManager = SelectionManager.getInstance();
      this._selectionResults = [];
      this.selectionRows = [];
      this._normalizedExtent = null;

      html.setAttr(this.domNode, 'data-layerinfoid', lang.getObject('layerInfo.id', false, this));

      if (this.get('map')) {
        this.own(on(this.map.root, touch.release, lang.hitch(this, function () {
          this._clickMap = true;
        })));
        this.own(on(this.map, 'extent-change', lang.hitch(this, '_onExtentChange')));
      }

      this.own(on(window, 'resize', lang.hitch(this, this._resize)));

      if (this.layerInfo) {
        this.own(on(this.layerInfo, 'filterChanged', lang.hitch(this, this._handleFilterChange)));
      }
    },

    startup: function startup() {
      this.inherited(arguments);
      this.toolbarHeight = parseInt(html.getStyle(this.toolbar.domNode, 'height'), 10) || 0;
    },

    setLayerDefinition: function setLayerDefinition(definition) {
      this._layerDefinition = definition;
    },

    getLayerDefinition: function getLayerDefinition() {
      return this._getLayerDifinition();
    },

    getFilterableFields: function getFilterableFields() {
      if (this._layerDefinition && this.configedInfo) {
        var cloned = lang.clone(this._layerDefinition);
        return this._getFilterableFields(cloned.fields, this.configedInfo.layer.fields);
      } else {
        return [];
      }
    },

    getFilterObj: function getFilterObj() {
      return this._filterObj;
    },

    setFilterObj: function setFilterObj(fObj) {
      this._filterObj = fObj;
    },

    showRefreshing: function showRefreshing(isshow) {
      if (isshow) {
        this._toggleLoading(true);
      } else {
        this._toggleLoading(false);
      }
    },

    active: function active() {
      this.actived = true;
    },

    deactive: function deactive() {
      this.actived = false;
    },

    cancelThread: function cancelThread() {
      if (this._requestStatus !== 'fulfilled' && this._currentDef) {
        this._currentDef.cancel({
          canceledBySelf: true
        });
        this._requestStatus = 'canceled';
      }
    },

    isCanceled: function isCanceled() {
      return this._requestStatus === 'canceled';
    },

    createToolbar: function createToolbar() {
      var toolbar = new Toolbar({}, html.create("div"));

      var menus = new DropDownMenu();

      this.showSelectedRecordsMenuItem = new MenuItem({
        label: this.nls.showSelectedRecords,
        iconClass: "esriAttributeTableSelectPageImage",
        onClick: lang.hitch(this, this.toggleSelectedRecords)
      });
      menus.addChild(this.showSelectedRecordsMenuItem);

      // related records:
      var relationships = this.layerInfo && this.layerInfo.layerObject && this.layerInfo.layerObject.relationships;

      // create related table submenu:

      var subMenu = new Menu();

      this.showRelatedRecordsMenuItem = new PopupMenuItem({
        label: this.nls.showRelatedRecords,
        iconClass: "esriAttributeTableSelectAllImage",
        popup: subMenu
      });

      if (relationships && relationships.length > 0) {
        // get all relationship info
        var relationshipInfos = array.map(relationships, lang.hitch(this, function (r) {
          return this.parent && this.parent.getRelationShipInfo(r);
        }));

        array.forEach(relationships, lang.hitch(this, function (r) {
          var relationshipInfo = this.parent && this.parent.getRelationShipInfo(r);
          var duplicateTableCount = 0;

          if (relationshipInfo) {
            array.some(relationshipInfos, function (rInfo) {
              if (rInfo && rInfo.name === relationshipInfo.name) {
                duplicateTableCount++;
              }
              if (duplicateTableCount > 1) {
                return false;
              }
            });
            subMenu.addChild(new MenuItem({
              label: relationshipInfo.name + (duplicateTableCount > 1 ? r && '<br><span style="opacity: 0.4">&lpar;' + r.name + '&rpar;</span>' : ''),
              onClick: lang.hitch(this, this.onShowRelatedRecordsClick, r)
            }));
          }
        }));
      }

      menus.addChild(this.showRelatedRecordsMenuItem);

      this.filterMenuItem = new MenuItem({
        label: this.nls.filter,
        iconClass: "esriAttributeTableFilterImage",
        onClick: lang.hitch(this, this.onFilterMenuItemClick)
      });
      menus.addChild(this.filterMenuItem);

      this.toggleColumnsMenuItem = new MenuItem({
        label: this.nls.columns,
        iconClass: "esriAttributeTableColumnsImage",
        onClick: lang.hitch(this, this.onToggleColumnsClick)
      });
      menus.addChild(this.toggleColumnsMenuItem);

      if (!this.hideExportButton) {
        // always set exportButton to true
        this.exportCSVMenuItem = new MenuItem({
          label: this.nls.exportFiles,
          showLabel: true,
          iconClass: "esriAttributeTableExportImage",
          onClick: lang.hitch(this, this.onExportCSVClick)
        });
        menus.addChild(this.exportCSVMenuItem);
      }

      this.selectionMenu = new DropDownButton({
        label: this.nls.options,
        iconClass: "esriAttributeTableOptionsImage",
        dropDown: menus
      });
      toolbar.addChild(this.selectionMenu);

      this.matchingCheckBox = new ToggleButton({
        checked: this.matchingMap ? true : false,
        showLabel: true,
        label: this.nls.filterByExtent,
        onChange: lang.hitch(this, function (status) {
          this.set('matchingMap', status);
          this._onMatchingCheckBoxChange(status);
        })
      });
      toolbar.addChild(this.matchingCheckBox);

      this.zoomButton = new Button({
        label: this.nls.zoomto,
        iconClass: "esriAttributeTableZoomImage",
        onClick: lang.hitch(this, this.zoomTo)
      });
      toolbar.addChild(this.zoomButton);

      this.clearSelectionButton = new Button({
        label: this.nls.clearSelection,
        iconClass: "esriAttributeTableClearImage",
        onClick: lang.hitch(this, this.clearSelection, true, true)
      });
      toolbar.addChild(this.clearSelectionButton);

      this.refreshButton = new Button({
        label: this.nls.refresh,
        showLabel: true,
        iconClass: "esriAttributeTableRefreshImage",
        onClick: lang.hitch(this, this.refresh)
      });
      toolbar.addChild(this.refreshButton);

      // this.closeButton = new Button({
      //   title: this.nls.closeMessage,
      //   iconClass: "esriAttributeTableCloseImage",
      //   onClick: lang.hitch(this, this._onCloseBtnClicked)
      // });
      // html.addClass(this.closeButton.domNode, 'close-button');
      // toolbar.addChild(this.closeButton);

      html.place(toolbar.domNode, this.domNode);
      this.toolbar = toolbar;

      this.own(on(this, 'data-loaded,row-click,clear-selection', lang.hitch(this, 'changeToolbarStatus')));

      // add a11y support to the toolbar
      if (this.parent) {
        topic.publish(this.parent.id + '_toolbar_created', {
          toolbar: this.toolbar,
          context: this
        });
      }
    },

    //queryByStoreObjectIds: [objectId]
    //queryByStoreObjectIds exists when layerType is RELATIONSHIPTABLE and matchingMapExtent is true
    startQuery: function startQuery( /*optional*/queryByStoreObjectIds) {
      this.cancelThread();
      // if (this.tableCreated && this.layerInfo &&
      //   this.layerInfo.isTable && !this._relatedQuery) {
      //   return;
      // }

      this._requestStatus = 'processing';
      this._toggleLoading();
      if (!queryByStoreObjectIds || !queryByStoreObjectIds.length) {
        this._relatedQuery = false;
        this._relatedQueryIds = [];
        this.queryByStoreObjectIds = null;
      } else {
        // this case means filter by map extent in related mode
        //or view in table about featureSet
        this.queryByStoreObjectIds = queryByStoreObjectIds;
      }
      this._currentDef = this._getLayerObject();
      this._currentDef.then(lang.hitch(this, function (layerObject) {
        if (!this.domNode) {
          return;
        }

        this.layer = layerObject;
        var extent = !this.layerInfo.isTable && this.matchingMap && this.map.extent || null;
        if (extent && extent.spatialReference && extent.spatialReference.isWebMercator()) {
          //normalizeUtils.normalizeCentralMeridian is called because the extent maybe cross 180
          var normalizeDef = this._currentDef = normalizeUtils.normalizeCentralMeridian([extent], null, lang.hitch(this, function (normalizedGeo) {
            return normalizedGeo[0];
          }));
          normalizeDef.then(lang.hitch(this, function (_extent) {
            this._doQuery(_extent, queryByStoreObjectIds);
            this._normalizedExtent = _extent;
          }), lang.hitch(this, function (err) {
            if (err && err.message !== 'Request canceled') {
              console.error(err);
            }
            this.changeToolbarStatus();
            this._toggleLoading(false);
          }));
        } else {
          this._doQuery(extent, queryByStoreObjectIds);
        }
      }), lang.hitch(this, function (err) {
        console.error(err);
        this.changeToolbarStatus();
        this._toggleLoading(false);
      }));
    },

    //this method is called when click "Show Related Records" option.
    queryRecordsByRelationship: function queryRecordsByRelationship(params) {
      var layer = params && params.layer;
      var selectedIds = params && params.selectedIds; // original feautrelayer ids
      if (params && params.relationship) {
        this.set('prevRelationship', this.relationship);
        this.set('relationship', params.relationship);
      }
      if (params && params.relatedOriginalInfo) {
        this.set('relatedOriginalInfo', params.relatedOriginalInfo);
      }
      var ship = this.relationship,
          prevShip = this.prevRelationship;

      //this._relatedQueryIds is previous selectedIds
      //selectedIds is new ids
      if (layer && ship && selectedIds && selectedIds.length > 0 && (!jimuUtils.isEqual(this._relatedQueryIds, selectedIds) || !jimuUtils.isEqual(ship, prevShip)) && lang.getObject('relatedOriginalInfo.layerObject.url', false, this)) {
        this._toggleLoading(true);
        this._requestStatus = 'processing';
        this._relatedQuery = true;

        // unchecked filter by map extent if query related records
        this.matchingCheckBox.set('checked', false);

        this.cancelThread();

        this._currentDef = this._getLayerObject();
        this._currentDef.then(lang.hitch(this, function (layerObject) {
          if (!this.domNode) {
            return;
          }

          this.layer = layerObject;

          var ofs = [];
          var response = this.layer; //point to related layer
          array.forEach(response.fields, function (f) {
            if ((!esriLang.isDefined(f.show) || f.show === true || f.type === 'esriFieldTypeOID' || esriLang.isDefined(response.objectIdField) && f.name === response.objectIdField) && !tableUtils.arcade.isArcadeExpressionField(f)) {
              ofs.push(f.name);
            }
          });
          var relatedQuery = new RelationshipQuery();
          relatedQuery.objectIds = selectedIds;
          relatedQuery.outFields = ofs.length ? ofs : ['*'];
          relatedQuery.relationshipId = ship.id;
          relatedQuery.returnGeometry = this.layer.geometryType === 'esriGeometryPoint'; //false;

          var relatedDef = this._currentDef = layer.queryRelatedFeatures(relatedQuery, function (relatedFeatures) {
            return relatedFeatures;
          });
          relatedDef.then(lang.hitch(this, function (relatedFeatures) {
            if (!this.domNode) {
              return;
            }
            var results = {
              displayFieldName: ship.objectIdField,
              fields: response.fields,
              features: [],
              fieldAliases: null
            };
            var featureIds = {};
            //start to reduce duplicate features
            var unique = function unique(rf) {
              var rfId = rf.attributes[this.layer.objectIdField];
              if (!featureIds[rfId]) {
                featureIds[rfId] = true;
                results.features.push(rf);
              }
            };

            for (var p in relatedFeatures) {
              var _set = relatedFeatures[p];
              array.forEach(_set && _set.features, unique, this);
            }
            //end

            html.destroy(this.tipNode);
            if (results.features.length > 0) {
              if (!this.grid) {
                this._removeTable();
                html.place(this.loading.domNode, this.domNode);
              }
              var oFields = this._getOutFieldsFromLayerInfos(this.layer.objectIdField);
              this.queryExecute(oFields, results.features.length, false, results);
            } else {
              this.tipNode = html.toDom('<div>' + this.nls.noRelatedRecords + '</div>');
              this._removeTable();
              html.place(this.tipNode, this.domNode);
              html.place(this.loading.domNode, this.domNode);
            }
            this._relatedQueryIds = selectedIds;
            this.emit('data-loaded');

            this._toggleLoading(false);
          }), lang.hitch(this, function (err) {
            if (err && err.message !== 'Request canceled') {
              console.error(err);
            }
            html.destroy(this.tipNode);
            this.tipNode = html.toDom('<div>' + this.nls.noRelatedRecords + '</div>');
            this._removeTable();
            html.place(this.tipNode, this.domNode);
            html.place(this.loading.domNode, this.domNode);
            this._toggleLoading(false);
            this.changeToolbarStatus();
          }));
        }), lang.hitch(this, function (err) {
          console.error(err);
          this._toggleLoading(false);
          this.changeToolbarStatus();
        }));
      } else {
        this._toggleLoading(false);
      }
    },

    getSelectedRows: function getSelectedRows() {
      if (!this.tableCreated) {
        return [];
      }
      return this.selectionRows;
    },

    zoomTo: function zoomTo() {
      this._zoomToSelected();
    },

    toggleSelectedRecords: function toggleSelectedRecords() {
      if (this._relatedQuery && !this.showSelected && this.getSelectedRows().length === 0) {
        //from RELATIONSHIPTABLE to FEATURELAYER and need to send request to get all data
        this._relatedQuery = false;
        this._relatedQueryIds = [];
        if (this.layerInfo && !this.layerInfo.isTable) {
          this.matchingCheckBox.set('checked', true);
        }
        this.startQuery();
        this.showSelectedRecordsMenuItem.set('label', this.nls.showSelectedRecords);
        this.showSelected = false;
        this.emit('show-all-records', {
          layerInfoId: this.layerInfo.id
        });
        return;
      }

      if (!this.tableCreated) {
        return;
      }
      if (this.showSelected) {
        //both for FEATURELAYER and RELATIONSHIP
        //from selected mode to all mode, don't need to request data
        this.showAllSelectedRecords();
        this.showSelectedRecordsMenuItem.set('label', this.nls.showSelectedRecords);
        this.showSelected = false;
        this.emit('show-all-records', {
          layerInfoId: this.layerInfo.id
        });
      } else {
        //both for FEATURELAYER and RELATIONSHIP
        //from all mode to selected mode, don't need to request data
        this.showSelectedRecords();
        this.showSelectedRecordsMenuItem.set('label', this.nls.showAllRecords);
        this.showSelected = true;
        this.emit('show-selected-records', {
          layerInfoId: this.layerInfo.id
        });
      }
      // this.showSelected = !this.showSelected;
    },

    onShowRelatedRecordsClick: function onShowRelatedRecordsClick(relationship) {
      var selectedRows = this.getSelectedRows();
      if (selectedRows.length > 0) {
        this.emit('show-related-records', {
          layerInfoId: this.layerInfo.id,
          objectIds: selectedRows,
          relationshipObj: relationship
        });
      } else {
        this._getFeatureIds(this.layer && this.layer.objectIdField, this.matchingMap && this._normalizedExtent).then(lang.hitch(this, function (objectIds) {
          console.log(objectIds);
          this.emit('show-related-records', {
            layerInfoId: this.layerInfo.id,
            objectIds: objectIds,
            relationshipObj: relationship
          });
        }));
      }
    },

    onFilterMenuItemClick: function onFilterMenuItemClick() {
      this.showRefreshing(true);
      this.getLayerDefinition().then(lang.hitch(this, function (definition) {
        if (!this.domNode) {
          return;
        }
        definition = lang.clone(definition);

        var fFields = this.getFilterableFields();
        definition.fields = fFields;

        var filter = new Filter({
          widgetId: this.widgetId,
          noFilterTip: this.nls.noFilterTip,
          style: "width:100%;",
          featureLayerId: this.layerInfo.id,
          runtime: true
        });

        var size = this._getFilterPopupSize();

        this._filterPopup = new Popup({
          titleLabel: this.nls.filter,
          width: size.w,
          height: size.h,
          content: filter,
          autoHeight: true,
          buttons: [{
            label: this.nls.ok,
            onClick: lang.hitch(this, function () {
              var partsObj = filter.toJson();
              if (partsObj && partsObj.expr) {
                this.setFilterObj(partsObj);
                this.clearSelection(false);
                this.startQuery();
                this._filterPopup.close();
                this._filterPopup = null;

                this.emit('apply-filter', {
                  layerInfoId: this.layerInfo.id,
                  expr: partsObj.expr
                });
              } else {
                new Message({
                  message: this.nls.setFilterTip
                });
              }
            })
          }, {
            label: this.nls.cancel
          }]
        });
        filter.startup();
        html.addClass(this._filterPopup.domNode, 'widget-at-filter-popup');
        var filterObj = this.getFilterObj();
        var filterOptions = {
          url: this.layer.url,
          partsObj: filterObj,
          layerDefinition: this.layer || definition,
          featureLayerId: this.layer.id
        };
        filter.build(filterOptions);
      }), lang.hitch(this, function (err) {
        if (!this.domNode) {
          return;
        }
        console.error(err);
      })).always(lang.hitch(this, function () {
        this.showRefreshing(false);
      }));
      this.emit('show-filter', {
        layerInfoId: this.layerInfo.id
      });
    },

    _getFilterPopupSize: function _getFilterPopupSize() {
      var size = {
        w: 720,
        h: 485
      };

      if (window.appInfo.isRunInMobile) {
        size = {
          w: window.innerWidth,
          h: window.innerHeight
        };
      }

      return size;
    },

    _resize: function _resize() {
      if (this._filterPopup) {
        var size = this._getFilterPopupSize();
        this._filterPopup.resize(size);
      }
    },

    onToggleColumnsClick: function onToggleColumnsClick() {
      this.toggleColumns();
      this.emit('toggle-columns', {
        layerInfoId: this.layerInfo.id
      });
    },

    onExportCSVClick: function onExportCSVClick() {
      var richTextFields = this._getRichTextFields();
      var message = this._getExportCSVPopupMessage(richTextFields);
      var popup = new Message({
        'class': this.baseClass + '-popup',
        message: message,
        titleLabel: this.nls.exportFiles,
        autoHeight: true,
        buttons: [{
          label: this.nls.ok,
          onClick: lang.hitch(this, function () {
            var check = message._check;
            if (popup.domNode) {
              popup.domNode.className += ' is-loading';
              var loading = new LoadingIndicator();
              loading.placeAt(popup.domNode);
            }
            this.exportToCSV(null, typeof check !== 'undefined' && !check.checked ? richTextFields : null).then(function () {
              popup.close();
            }, function (err) {
              console.error('Error exporting CSV for Attribute Table');
              popup.close();
            });
          })
        }, {
          label: this.nls.cancel
        }]
      });
      this.emit('export-csv', {
        layerInfoId: this.layerInfo.id
      });
    },

    _getExportCSVPopupMessage: function _getExportCSVPopupMessage(richTextFields) {
      var messageWrapper = document.createElement('div');
      messageWrapper.className = 'message-wrapper';
      messageWrapper.appendChild(document.createTextNode(this.nls.exportMessage));

      // create extra UI elements if rich text field(s) exist(s)
      if (richTextFields.length) {
        var richTextInputWrapper = document.createElement('div');
        richTextInputWrapper.className = 'input-row';
        // checkbox
        var check = new CheckBox({
          label: this.nls.keepRichTextLabel,
          checked: true // set default to keeping rich text format
        });
        // hint button
        var hintButton = document.createElement('a');
        hintButton.className = 'hint-button';
        hintButton.href = '#';
        hintButton.role = 'button';
        hintButton.appendChild(document.createTextNode(this.nls.whatsThis));
        richTextInputWrapper.appendChild(check.domNode);
        richTextInputWrapper.appendChild(hintButton);
        messageWrapper.appendChild(richTextInputWrapper);
        messageWrapper._check = check;

        this.own(on(hintButton, 'click', lang.hitch(this, function (evt) {
          evt.preventDefault();
          var options = {
            'class': this.baseClass + '-popup',
            message: this._getRichTextMessage(richTextFields)
          };
          if (!window.appInfo.isRunInMobile) {
            options.width = 500;
          }
          new Message(options);
        })));
      }
      return messageWrapper;
    },

    _getRichTextMessage: function _getRichTextMessage(richTextFields) {
      if (!richTextFields || richTextFields.hasOwnProperty("length") && !richTextFields.length) return "";

      var _EXAMPLE = {
        preview: '<u>ArcGIS</u> <font color="#31aacd">Web AppBuilder</font>',
        withHTMLTags: '&ltu&gtArcGIS&lt/u&gt &ltfont color=\"#31aacd\"&gtWeb AppBuilder&lt/font&gt',
        withoutHTMLTags: 'ArcGIS Web AppBuilder'
      };
      var messageWrapper = document.createElement('div');
      var messageHTML = '',
          richTextFieldsHTML = '';
      for (var i = 0, len = richTextFields.length; i < len; i++) {
        richTextFieldsHTML += '<mark>' + richTextFields[i].fieldName + '</mark>';
      }
      messageHTML += '<p>' + string.substitute(this.nls.richTextMessage.explanatoryText.line1, {
        layerName: '<strong>' + this.layer.name + '</strong>'
      }) + '</p>';
      messageHTML += '<div class="tags">' + richTextFieldsHTML + '</div>';
      messageHTML += '<p>' + this.nls.richTextMessage.explanatoryText.line2 + '</p>' + '<p>' + this.nls.richTextMessage.explanatoryText.line3 + '</p>' + '<h3>' + this.nls.richTextMessage.example.label + '</h3>' + '<div class="example-block"><pre>' + _EXAMPLE.preview + '</pre>' + this.nls.richTextMessage.example.scenarios.first + '<pre>' + _EXAMPLE.withHTMLTags + '</pre>' + this.nls.richTextMessage.example.scenarios.second + '<pre>' + _EXAMPLE.withoutHTMLTags + '</pre></div>';
      messageWrapper.innerHTML = messageHTML;
      return messageWrapper;
    },

    // get fields that display as rich text fields
    _getRichTextFields: function _getRichTextFields() {
      var pInfos = this.layerInfo && this.layerInfo.getPopupInfo && this.layerInfo.getPopupInfo(),
          lFields = pInfos && pInfos.fieldInfos,
          rFields = [];
      if (lFields) {
        for (var i = 0, len = lFields.length; i < len; i++) {
          var lField = lFields[i];
          if (lField.stringFieldOption && lField.stringFieldOption === "richtext") {
            rFields.push(lField);
          }
        }
      }
      return rFields;
    },

    onSelectionComplete: function onSelectionComplete() {
      var features = this.layer && this.layer.getSelectedFeatures();
      if (!features) {
        return;
      }
      if (features.length === 0) {
        this.clearSelection(false, this._selectionResults.length > 0);
      } else if (!this._selectBySelf(features)) {
        this.clearSelection(false);
        this._updateSelectRowsByFeatures(features);
      }
    },

    onSelectionClear: function onSelectionClear() {
      this.clearSelection(false, true);
      this._setFarOffRemoval(this.GRID_FAR_OFF_REMOVAL.DEFAULT); // set to default
    },

    changeToolbarStatus: function changeToolbarStatus() {
      //selected/all option

      if (!this.tableCreated) {
        //dgrid not created, set initial state
        if (this._relatedQuery) {
          //if RELATIONSHIPTABLE mode, show "Show All Records"
          this.showSelectedRecordsMenuItem.set('disabled', false);
          this.showSelectedRecordsMenuItem.set('label', this.nls.showAllRecords);
        } else {
          this.showSelectedRecordsMenuItem.set('disabled', true);
        }

        this.showRelatedRecordsMenuItem.set('disabled', true);
        this.matchingCheckBox.set('disabled', true);
        this.filterMenuItem.set('disabled', true);
        this.toggleColumnsMenuItem.set('disabled', true);
        if (!this.hideExportButton) {
          this.exportCSVMenuItem.set('disabled', true);
        }
        this.zoomButton.set('disabled', true);
        return;
      }

      //now dgid is created
      var selectionRows = this.getSelectedRows();
      if (this.showSelected) {
        //if this.showSelected is true, means we are in selected mode
        //now we need to show "Show All Records"
        this.showSelectedRecordsMenuItem.set('label', this.nls.showAllRecords);
      } else {
        this.showSelectedRecordsMenuItem.set('label', this.nls.showSelectedRecords);
      }
      if (this.tableCreated && selectionRows && selectionRows.length > 0 && this.layer && this.layer.objectIdField) {
        this.showSelectedRecordsMenuItem.set('disabled', false);
        this.clearSelectionButton.set('disabled', false);
      } else {
        this.showSelectedRecordsMenuItem.set('disabled', true);
        this.clearSelectionButton.set('disabled', true);
      }

      if (this._relatedQuery) {
        this.showSelectedRecordsMenuItem.set('disabled', false);
        if (this.tableCreated && selectionRows && selectionRows.length === 0) {
          this.showSelectedRecordsMenuItem.set('label', this.nls.showAllRecords);
        }
      }

      //related records option

      this.showRelatedRecordsMenuItem.set('disabled', true);
      if (this.layerInfo && this.isSupportQueryToServer() && this.layer && this.layer.objectIdField) {
        if (this._relatedDef && !this._relatedDef.isFulfilled()) {
          this._relatedDef.cancel();
        }

        var resDef = this.layerInfo.getRelatedTableInfoArray();
        this._relatedDef = resDef;
        resDef.then(lang.hitch(this, function (tableInfos) {
          if (!this.domNode) {
            return;
          }
          if (this.tableCreated && tableInfos && tableInfos.length > 0) {
            this.showRelatedRecordsMenuItem.set('disabled', false);
          }
        }));
      }

      //filter option
      if (this.tableCreated && this.isSupportQueryToServer() && !this._relatedQuery) {
        this.filterMenuItem.set('disabled', false);
      } else {
        this.filterMenuItem.set('disabled', true);
      }

      //map extent option
      this.matchingCheckBox.set('disabled', false);

      //Show/Hide Columns option
      if (this.tableCreated) {
        this.toggleColumnsMenuItem.set('disabled', false);
      } else {
        this.toggleColumnsMenuItem.set('disabled', true);
      }

      //export option
      if (!this.hideExportButton) {
        if (selectionRows && selectionRows.length > 0) {
          this.exportCSVMenuItem.set('label', this.nls.exportSelected);
        } else {
          this.exportCSVMenuItem.set('label', this.nls.exportAll);
        }
        if (this.tableCreated) {
          this.exportCSVMenuItem.set('disabled', false);
        } else {
          this.exportCSVMenuItem.set('disabled', true);
        }
      }

      //zoom to option
      if (this.layerInfo.isShowInMap()) {
        // this.showGraphic();
        if (this.tableCreated && selectionRows && selectionRows.length > 0) {
          this.zoomButton.set('disabled', false);
        } else {
          this.zoomButton.set('disabled', true);
        }
      } else {
        // if (this.tableCreated) {
        //   this.hideGraphic();
        // }
        this.zoomButton.set('disabled', true);
      }
      if (this.layerInfo.isTable) {
        this.matchingCheckBox.set('disabled', true);
        this.zoomButton.set('disabled', true);
      }
    },

    showSelectedRecords: function showSelectedRecords() {
      if (!this.tableCreated) {
        return;
      }
      var oid = this.layer.objectIdField;
      // this.grid._clickShowSelectedRecords = true;
      var ids = this.getSelectedRows();

      if (ids.length > 0 && this.grid) {
        // when refresh completed select these rows..
        if (this.grid.store instanceof Memory) {
          this.grid.set('query', lang.hitch(this, function (item) {
            if (typeof item === 'number' && ids.indexOf(item) > -1) {
              return true;
            } else if (ids.indexOf(item[oid]) > -1) {
              return true;
            }
            return false;
          }));
        } else {
          this.grid.set('query', function () {
            return ids;
          });
        }
      }
    },

    showAllSelectedRecords: function showAllSelectedRecords() {
      if (!this.tableCreated) {
        return;
      }
      if (this.showSelected) {
        this.grid.set('query', {});
        var selectedIds = this.getSelectedRows();
        this._updateSelectRowsByIds(selectedIds);
      }
    },

    clearSelection: function clearSelection(requery, clearSelectionSet) {
      if (!this.tableCreated) {
        return;
      }
      this.grid.clearSelection();
      this.selectionRows = [];
      if (requery) {
        //from selected mode to all mode
        this.grid.set('query', {});
      }
      if (clearSelectionSet) {
        this._selectionResults = [];
        if (this.layer && this.layer.getSelectedFeatures().length > 0) {
          this.selectionManager.clearSelection(this.layer);
        }
      }
      this._closePopup();
      // this.graphicsLayer.clear();

      this.setSelectedNumber();
      this.showSelected = false;

      this.emit('clear-selection');
    },

    refresh: function refresh() {
      if (this.grid) {
        this.grid.clearSelection();
        // this.clearSelection(false);
      }

      if (!this._relatedQuery) {
        this.startQuery();
      }

      this.emit('refresh', {
        layerInfoId: this.layerInfo.id
      });
    },

    exportToCSV: function exportToCSV(fileName, richTextFieldsToClear) {
      if (!this.layerInfo || !this.layer || !this.tableCreated) {
        var def = new Deferred();
        def.reject();
        return def;
      }
      // var types = this.layer.types;
      return this.getSelectedRowsData().then(lang.hitch(this, function (datas) {
        // seleted data process.
        var oid = this.layer.objectIdField;
        var _exportData = [];
        var isSameProjection = this.layer.fullExtent.spatialReference.equals(this.map.extent.spatialReference);

        var hasArcadeExpressionFields = this._hasArcadeExpressionFields();
        var orderByFields = tableUtils.getSortbyFields(this.grid, this.layer);

        // if the output layer's spatial reference is the same as map's, which means
        // a spatial reference conversion to make output data (X, Y fields) consistent with
        // layer's original projection system is NOT needed. then we can use data from client side.
        // if they are different, then it needs to send a query request to
        // server side (handle by "_getExportDataFromServer" method in jimu/CSVUtils.js)
        // to get the data with correct spatial reference
        // or the layer is a layer without a url that cannot be queried from the server side, e.g.: graphics layer then
        // try to get the data from the client side
        if (isSameProjection || !this.layer.url) {
          var rows = array.map(this._getTableSelectedIds(), lang.hitch(this, function (id) {
            for (var i = 0, len = datas.length; i < len; i++) {
              if (datas[i] && datas[i][oid] === id) {
                return datas[i];
              }
            }
            return {};
          }));
          var _selectedData = rows || []; // get selected data
          // if table were in selection mode and no records were selected, we push an
          // empty object to _selectedData, for the following logic compatible.
          if (_selectedData.length === 0 && this.isSelectionMode()) {
            _selectedData.push({});
          }

          _exportData = _selectedData;

          if (_selectedData.length === 0 && this.grid.store instanceof Memory) {
            var _queryOptions = {};
            if (orderByFields && orderByFields instanceof Array) {
              _queryOptions.sort = array.map(orderByFields, function (field) {
                var optionArray = field.split(/\ +/);
                return { attribute: optionArray[0], descending: optionArray[1] === 'DESC' };
              });
            }
            _exportData = lang.clone(this.grid.store.query({}, _queryOptions));
          }

          if (_exportData.length) {
            this._appendXY(_exportData);
          }
        }

        // Indicates whether it is 'view in table'
        var selectedIds = this._getTableSelectedIds();
        var viewInTableFlag = this.parent && this.parent.tabContainer.selectedChildWidget.params.viewInTableFlag;
        var viewInTableData = [];
        var exportViewInTableData = !_exportData.length && viewInTableFlag && !selectedIds.length;
        if (exportViewInTableData) {
          viewInTableData = lang.clone(this.grid.store.data);
          if ((isSameProjection || !this.layer.url) && viewInTableData.length) {
            this._appendXY(viewInTableData);
          }
        }
        var options = {};
        var _outFields = this.getOutFields(!!_exportData.length);
        // 'view in table' export all in related table need export the data filtered
        options.datas = exportViewInTableData ? viewInTableData : _exportData;
        options.fromClient = false;
        options.withGeometry = this.layer.geometryType === 'esriGeometryPoint';
        options.outFields = _outFields;
        options.formatNumber = false;
        options.formatDate = true;
        options.formatCodedValue = true;
        options.popupInfo = this.layerInfo.getPopupInfo();
        //if spatial reference needs to be converted and there are rows selected:
        // 1. query data using object ids
        options.objectIds = !isSameProjection && this.getSelectedRows().length > 0 && this._getExportObjectIds();
        // 2. use layer's default spatial reference as the output to do
        // the conversion on the server side
        options.outSpatialReference = !isSameProjection && lang.clone(this.layer.fullExtent.spatialReference);
        // pass in rich text fields to be cleared:
        options.richTextFieldsToClear = richTextFieldsToClear;
        // if the output layer has arcade expressions configured, the computed values
        // need to be added to each data to be exported
        if (hasArcadeExpressionFields) {
          options.arcadeExpressions = {
            expressionInfos: this.layerInfo.getPopupInfo().expressionInfos,
            layerDefinition: jimuUtils.getFeatureLayerDefinition(this.layer)
          };
        }
        // get "order by" fields
        options.orderByFields = orderByFields;
        // add additional options if cannot query by ids
        if (!options.objectIds || options.objectIds instanceof Array && options.objectIds.length === 0) {
          // if "filter by map extent" is on:
          if (this.matchingMap && this.layerInfo && !this.layerInfo.isTable) {
            options.geometry = this._currentExtent;
          }
          // query offset start from index 0
          options.start = 0;
          // query count defaults to the maximum record count or 1000
          options.num = this.layer.maxRecordCount || 1000;
          // get definition expression from the layer info
          options.filterExpression = this.layerInfo.getFilter && this.layerInfo.getFilter();
        }
        return CSVUtils.exportCSVFromFeatureLayer(fileName || this.configedInfo.name, this.layer, options);
      }));
    },

    toggleColumns: function toggleColumns() {
      if (this.tableCreated) {
        this.grid._toggleColumnHiderMenu();
      }
    },

    changeHeight: function changeHeight(h) {
      if (this.grid && h - this.toolbarHeight - this.footerHeight >= 0) {
        html.setStyle(this.grid.domNode, "height", h - this.toolbarHeight - this.footerHeight + "px");
      }
    },

    // showGraphic: function() {
    //   // if (this.graphicsLayer) {
    //   //   this.graphicsLayer.show();
    //   // }
    // },

    // hideGraphic: function() {
    //   // if (this.graphicsLayer) {
    //   //   this.graphicsLayer.hide();
    //   // }
    // },

    isSupportQueryToServer: function isSupportQueryToServer() {
      var hasLayerUrl = this.layer && this.layer.url && this.configedInfo.layer.url;
      var isCSVLayer = this.layer && this.layer.declaredClass === "esri.layers.CSVLayer";
      var isStreamLayer = this.layer && this.layer.declaredClass === "esri.layers.StreamLayer";

      return hasLayerUrl && !isCSVLayer && !isStreamLayer;
    },

    isSupportQueryOnClient: function isSupportQueryOnClient() {
      var hasLayerUrl = this.layer && this.layer.url && this.configedInfo.layer.url;
      var isCSVLayer = this.layer && this.layer.declaredClass === "esri.layers.CSVLayer";
      var isStreamLayer = this.layer && this.layer.declaredClass === "esri.layers.StreamLayer";

      return !hasLayerUrl || isCSVLayer || isStreamLayer;
    },

    destroy: function destroy() {
      if (!this._destroyed) {
        this.layerInfo = null;
        this.configedInfo = null;
        this.layer = null;

        if (this._selectionHandles) {
          array.forEach(this._selectionHandles, function (sh) {
            if (sh && sh.remove) {
              sh.remove();
            }
          });
        }

        this._closePopup();
        if (this._filterPopup && this._filterPopup.domNode) {
          this._filterPopup.close();
          this._filterPopup = null;
        }

        // if (this.graphicsLayer && this.graphicsLayer.clear) {
        //   this.graphicsLayer.clear();
        //   this.map.removeLayer(this.graphicsLayer);
        // }
        this._dblClickResult = null;
        if (this.grid) {
          this.grid.destroy();
        }
        this.map = null;
        this.nls = null;
        this.relationship = null;
        this.prevRelationship = null;
        if (this._currentDef && !this._currentDef.isFulfilled()) {
          this._currentDef.cancel({
            canceledBySelf: true
          });
        }
        if (this._relatedDef && !this._relatedDef.isFulfilled()) {
          this._relatedDef.cancel({
            canceledBySelf: true
          });
        }

        this.inherited(arguments);
      }
    },

    _selectBySelf: function _selectBySelf(features) {
      features = features || [];
      if (features.length !== this._selectionResults.length) {
        return false;
      } else {
        var oidField = this.layer.objectIdField;
        return array.every(this._selectionResults, function (sr) {
          //was: return features.indexOf(sr) > -1;

          // use the native Array.prototype.some() method for better performance
          return features.some(function (f) {
            // use object id to do a more strict comparison
            return sr.attributes[oidField] === f.attributes[oidField];
          });
        });
      }
    },

    _updateSelectRowsByFeatures: function _updateSelectRowsByFeatures(features) {
      var selectedIds = array.map(features, lang.hitch(this, function (f) {
        return f.attributes[this.layer.objectIdField];
      }));
      this._updateSelectRowsByIds(selectedIds);

      this._selectionResults = features;
    },

    _updateSelectRowsByIds: function _updateSelectRowsByIds(selectedIds) {
      if (this.grid && this.tableCreated) {
        this.selectionRows = selectedIds;
        array.forEach(selectedIds, lang.hitch(this, function (id) {
          this.grid.select(id);
        }));
        this.setSelectedNumber();

        this.changeToolbarStatus();
      }
    },

    _removeTable: function _removeTable() {
      if (this.grid && this.grid.domNode) {
        this.grid.destroy();
        this.grid = null;
      }
      if (this.footer) {
        html.destroy(this.footer);
        this.footer = null;
        this.selectedRowsLabel = null;
      }
      this.tableCreated = false;
    },

    _onMatchingCheckBoxChange: function _onMatchingCheckBoxChange(status) {
      if (this.tableCreated && !this._relatedQuery) {
        this.cancelThread();
        this.queryByStoreObjectIds = null;
        this.startQuery();
      }
      if (this._requestStatus === 'fulfilled' && this.tableCreated && this._relatedQuery) {
        // this.startQuery(this.grid.store.data.);
        if (status) {
          this.queryByStoreObjectIds = array.map(this.grid.store.data, lang.hitch(this, function (item) {
            return item[this.layer.objectIdField];
          }));
          this.startQuery(this.queryByStoreObjectIds);
        } else {
          var selectedIds = this._relatedQueryIds;
          this._relatedQueryIds = []; // empty _relatedQueryIds for query related
          this.queryRecordsByRelationship({
            'layer': this.relatedOriginalInfo.layerObject,
            'selectedIds': selectedIds
          });
        }
      }
      if (!status) {
        this._currentExtent = null;
      }
    },

    _closePopup: function _closePopup() {
      var sg = this.map.infoWindow.getSelectedFeature();
      var hasSG = sg && this._dblClickResult && sg === this._dblClickResult;
      var sameLayer = sg && sg._layer === this.layer;
      if (this.domNode && (hasSG || sameLayer)) {
        this.map.infoWindow.hide();
        this._dblClickResult = null;
      }
    },

    _getLayerObject: function _getLayerObject() {
      var objectDef = this._currentDef = this.layerInfo.getLayerObject();
      function bindSelectionEvents(layer) {
        if (this._selectionHandles) {
          array.forEach(this._selectionHandles, function (sh) {
            if (sh && sh.remove) {
              sh.remove();
            }
          });
        }
        this._selectionHandles = [];

        this._selectionHandles.push(on(layer, 'selection-complete', lang.hitch(this, 'onSelectionComplete')));
        this._selectionHandles.push(on(layer, 'selection-clear', lang.hitch(this, 'onSelectionClear')));
      }
      return objectDef.then(lang.hitch(this, function (layerObject) {
        var def = new Deferred();
        if (layerObject.declaredClass === "esri.layers.ArcGISImageServiceLayer" || layerObject.declaredClass === "esri.layers.ArcGISImageServiceVectorLayer") {
          var flayer = new FeatureLayer(layerObject.url);
          this.own(on(flayer, "load", lang.hitch(this, function (params) {
            lang.hitch(this, bindSelectionEvents)(params.layer);
            def.resolve(params.layer);
          })));
        } else {
          lang.hitch(this, bindSelectionEvents)(layerObject);
          def.resolve(layerObject);
        }

        return def;
      }));
    },

    _getLayerDifinition: function _getLayerDifinition() {
      if (this._layerDefinition) {
        return when(lang.clone(this._layerDefinition));
      } else {
        return esriRequest({
          url: this.layer.url,
          content: {
            f: 'json'
          },
          handleAs: 'json',
          callbackParamName: 'callback'
        }).then(lang.hitch(this, function (definition) {
          this.setLayerDefinition(definition);
          return this.getLayerDefinition();
        }));
      }
    },

    _getFilterableFields: function _getFilterableFields(lFields, cFields) {
      return array.filter(lFields, function (lf) {
        return array.some(cFields, function (cf) {
          return lf.name === cf.name && (cf.show || !esriLang.isDefined(cf.show)) && lang.mixin(lf, cf);
        });
      });
    },

    _getExportObjectIds: function _getExportObjectIds() {
      var exportIds = this._getTableSelectedIds() || []; // try to get selected ids first
      if (exportIds.length === 0 && this.grid.store instanceof Memory) {
        var oid = this.layer.objectIdField;
        this.grid.store.query(function (object) {
          exportIds.push(object[oid]);
        });
      } // if nothing is selected, get ids from current dgrid's store object
      return exportIds;
    },

    _doQuery: function _doQuery(normalizedExtent, queryByStoreObjectIds) {
      if (!this.layer) {
        return;
      }
      var pk = this.layer.objectIdField; // primary key always be display

      if (this.isSupportQueryToServer()) {
        this._queryToServer(normalizedExtent, pk, queryByStoreObjectIds);
      } else if (this.isSupportQueryOnClient()) {
        this._queryOnClient(normalizedExtent, pk, queryByStoreObjectIds);
      }
    },

    _queryOnClient: function _queryOnClient(normalizedExtent, pk, queryByStoreObjectIds) {
      var json = {}; //json has the similay structure with FeatureSet.
      if (this.layer.declaredClass === "esri.layers.StreamLayer") {
        json.features = this.layer.getLatestObservations();
      } else {
        json.features = array.filter(this.layer.graphics, lang.hitch(this, function (feature) {
          return !feature.wabIsTemp;
        }));
      }

      if (queryByStoreObjectIds && queryByStoreObjectIds.length > 0) {
        json.features = array.filter(json.features, function (f) {
          return queryByStoreObjectIds.indexOf(f.attributes[this.layer.objectIdField]) > -1;
        }, this);
      }

      var lFields = this.layer.fields;
      var liFields = this.configedInfo.layer.fields;

      if (liFields) {
        //user has open AT setting page and we get this.configedInfo.layer.fields
        json.fields = array.filter(liFields, lang.hitch(this, function (field) {
          if (!esriLang.isDefined(field.show)) {
            // first open
            field.show = true;
          }
          if (field.name === pk && (field.type === 'esriFieldTypeOID' || field.type === 'esriFieldTypeInteger')) {
            field._pk = true;
          }

          //add esri field type to liField
          for (var i = 0, len = lFields.length; i < len; i++) {
            if (lFields[i].name === field.name && !field.type) {
              field.type = lFields[i].type;
            }
          }
          return field.show || field._pk;
        }));
      } else {
        //user doesn't open AT setting page
        json.fields = array.filter(lFields, lang.hitch(this, function (field) {
          if (!esriLang.isDefined(field.show)) {
            // first open
            field.show = true;
          }
          if (field.name === pk && (field.type === 'esriFieldTypeOID' || field.type === 'esriFieldTypeInteger')) {
            field._pk = true;
          }
          return field.show || field._pk;
        }));
      }

      var geometries = [];
      var len = json.features.length;
      for (var i = 0; i < len; i++) {
        if (json && json.features && json.features[i] && json.features[i].geometry) {
          geometries.push(json.features[i].geometry);
        }
      }
      if (normalizedExtent && esriConfig.defaults.geometryService && geometries.length > 0) {
        var sr1 = normalizedExtent.spatialReference;
        var sr2 = geometries[0].spatialReference;
        if (sr1.equals(sr2)) {
          json.features = array.filter(json.features, lang.hitch(this, function (g) {
            if (g && g.geometry) {
              return geometryEngine.intersects(normalizedExtent, g.geometry);
            }
          }));
          this.queryExecute(json.fields, json.features.length, false, json, normalizedExtent);
        } else {
          var params = new RelationParameters();
          params.geometries1 = geometries;
          params.geometries2 = [normalizedExtent];
          params.relation = RelationParameters.SPATIAL_REL_INTERSECTION;

          var relationDef = this._currentDef = esriConfig.defaults.geometryService.relation(params, lang.hitch(this, function (pairs) {
            return pairs;
          }));
          relationDef.then(lang.hitch(this, function (json, pairs) {
            var n = pairs.length;
            //the filtered features
            var gs = [];
            for (var m = 0; m < n; m++) {
              gs.push(json.features[pairs[m].geometry1Index]);
            }
            json.features = gs;
            this.queryExecute(json.fields, json.features.length, false, json, normalizedExtent);
          }, json), lang.hitch(this, function (err) {
            if (err && err.message !== 'Request canceled') {
              console.error(err);
            }
            this.changeToolbarStatus();
            this._toggleLoading(false);
          }));
        }
      } else {
        //don't filter features
        this.queryExecute(json.fields, json.features.length, false, json, normalizedExtent);
      }
    },

    /*
    pk: objectIdField
     */
    _queryToServer: function _queryToServer(normalizedExtent, pk, queryByStoreObjectIds) {
      this._getFeatureCount(normalizedExtent, queryByStoreObjectIds).then(lang.hitch(this, function (recordCounts) {
        if (!this.domNode) {
          return;
        }
        if (queryByStoreObjectIds) {
          // RELATIONSHIPTABLE doesn't care pagination
          this._queryFeatureLayer(normalizedExtent, pk, recordCounts, false, queryByStoreObjectIds);
        } else {
          var currentLayer = this.layer;
          var maxCount = esriLang.isDefined(currentLayer.maxRecordCount) ? currentLayer.maxRecordCount : 1000;
          this._batchCount = Math.min(maxCount, this._defaultBatchCount);

          // some table isn't GIS based, so it have no objectIdField
          // issue#7122
          if (recordCounts <= maxCount || !this.layer.objectIdField) {
            //one request can cover all features, don't need to pages
            this._queryFeatureLayer(normalizedExtent, pk, recordCounts, false);
          } else {
            var oFields = this._getOutFieldsFromLayerInfos(pk);
            var results = {
              fields: this.layer.fields
            };
            this.layer._recordCounts = recordCounts;
            var supportsPagination = currentLayer.advancedQueryCapabilities && currentLayer.advancedQueryCapabilities.supportsPagination;
            if (supportsPagination) {
              this.queryExecute(oFields, recordCounts, true, results, normalizedExtent);
            } else {
              this._getFeatureIds(pk, normalizedExtent).then(lang.hitch(this, function (objectIds) {
                if (!this.domNode) {
                  return;
                }
                this.layer._objectIds = objectIds;

                this.queryExecute(oFields, recordCounts, true, results, normalizedExtent);
              }), lang.hitch(this, function (err) {
                console.error(err);
                this.changeToolbarStatus();
              }));
            }
          }
        }
      }), lang.hitch(this, function (err) {
        console.error(err);
        this.changeToolbarStatus();
      }));
    },

    _getFeatureCount: function _getFeatureCount(normalizedExtent, queryByStoreObjectIds) {
      var def = new Deferred();
      var qt = new QueryTask(this.configedInfo.layer.url);
      var query = new Query();
      query.returnGeometry = false;
      query.where = this._getLayerFilterExpression();
      if (queryByStoreObjectIds) {
        query.where += ' AND ' + this.layer.objectIdField + ' IN (' + queryByStoreObjectIds.join() + ')';
      }

      if (normalizedExtent) {
        query.geometry = normalizedExtent;
      }

      // Because _getAttributeFilter of FeatureLayer will merge definitionExpression
      // to where property of Query,
      // we change to QueryTask to executeForCount.
      // var countDef = this._currentDef = this.layer.queryCount(query);

      var countDef = this._currentDef = qt.executeForCount(query, lang.hitch(this, function (results) {
        return results;
      }));
      countDef.then(lang.hitch(this, function (count) {
        def.resolve(count);
      }), lang.hitch(this, function (err) {
        if (err && err.message !== 'Request canceled') {
          console.error(err);
          console.log("Could not get feature count.");
        }
        this._toggleLoading(false);
        def.reject(err);
      }));

      return def;
    },

    // get all records from server by only one request without pagination
    _queryFeatureLayer: function _queryFeatureLayer(normalizedExtent, pk, recordCounts, exceededLimit, queryByStoreObjectIds) {
      // function body
      var qt = new QueryTask(this.configedInfo.layer.url);
      var query = new Query();
      query.where = this._getLayerFilterExpression();
      if (queryByStoreObjectIds && pk) {
        query.where += ' AND ' + pk + ' IN (' + queryByStoreObjectIds.join() + ')';
      }
      var oFields = this._getOutFieldsFromLayerInfos(pk);
      var hasArcadeExpressionFields = this._hasArcadeExpressionFields();
      var hasArcadeExpressionWithGeometry = hasArcadeExpressionFields && this._hasArcadeExpressionWithGeometry();
      if (oFields.length > 0 && !hasArcadeExpressionFields) {
        var oNames = [];
        array.forEach(oFields, function (field) {
          oNames.push(field.name);
        });
        query.outFields = oNames;
      } else {
        query.outFields = ["*"];
      }
      if (normalizedExtent) {
        query.geometry = normalizedExtent;
        query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
      }
      query.outSpatialReference = lang.clone(this.map.spatialReference);

      query.returnGeometry = this.layer.geometryType === 'esriGeometryPoint' || hasArcadeExpressionWithGeometry;
      if (pk) {
        query.orderByFields = [pk + ' ASC'];
      }

      var taskDef = this._currentDef = qt.execute(query, lang.hitch(this, function (results) {
        return results;
      }));

      taskDef.then(lang.hitch(this, function (results) {
        this.queryExecute(oFields, recordCounts, exceededLimit, results, normalizedExtent);
      }), lang.hitch(this, function (err) {
        if (err && err.message !== 'Request canceled') {
          console.error(err);
        }
        this.changeToolbarStatus();
        this._toggleLoading(false);
      }));
    },

    _getFeatureIds: function _getFeatureIds(pk, normalizedExtent) {
      var def = new Deferred();
      var qt = new QueryTask(this.configedInfo.layer.url);
      var query = new Query();
      query.returnGeometry = false;
      query.returnIdsOnly = true;
      query.where = this._getLayerFilterExpression();
      if (this.layer._orderByFields || pk) {
        query.orderByFields = this.layer._orderByFields || [pk + " ASC"];
      }

      if (normalizedExtent) {
        query.geometry = normalizedExtent;
      }

      // Because _getAttributeFilter of FeatureLayer will merge definitionExpression
      // to where property of Query,
      // we change to QueryTask to executeForCount.
      // var idsDef = this._currentDef = this.layer.queryIds(query);

      var idsDef = this._currentDef = qt.executeForIds(query, lang.hitch(this, function (results) {
        return results;
      }));
      idsDef.then(lang.hitch(this, function (objectIds) {
        def.resolve(objectIds);
      }), lang.hitch(this, function (err) {
        if (err && err.message !== 'Request canceled') {
          console.error(err);
          console.log("Could not get feature Ids");
        }
        def.resolve([]);
      }));

      return def;
    },

    /*
    oFields: out fields
    recordCounts: all records count
    exceededLimit: if true means pagination
    results: FeatureSet like structure
    nExtent: normalize map extent
     */
    queryExecute: function queryExecute(oFields, recordCounts, exceededLimit, results, nExtent) {
      var data = [];
      var store = null;
      var columns = {};
      if (!this.domNode) {
        return;
      }
      // mixin porperty of field to result.fields
      results.fields = this._processExecuteFields(this.layer.fields, oFields);
      if (exceededLimit) {
        //if exceededLimit, means need pagination. In this case, we create cache store.
        //With cache store, dgrid get data dynamically.
        store = tableUtils.generateCacheStore(this.layer, recordCounts, this._batchCount, this._getLayerFilterExpression(), nExtent);
      } else {
        //If don't need pagination, we create memory store.
        data = array.map(results.features, lang.hitch(this, function (feature) {
          // return lang.clone(feature.attributes);
          var c = lang.clone(feature.attributes);
          return lang.mixin(c, {
            geometry: feature.geometry
          });
        }));

        store = tableUtils.generateMemoryStore(data, this.layer.objectIdField);
      }

      var _typeIdFild = this.layer.typeIdField;
      var _types = this.layer.types;
      var supportOrder = lang.getObject('advancedQueryCapabilities.supportsOrderBy', false, this.layer);
      var supportPage = lang.getObject('advancedQueryCapabilities.supportsPagination', false, this.layer);
      var supportStatistics = lang.getObject('advancedQueryCapabilities.supportsStatistics', false, this.layer);

      // AttributeTable does not work
      // when column name contains special character such as "." and "()"
      var expressionInfos = tableUtils.arcade.getExpressionInfosFromLayerInfo(this.layerInfo);
      var expressionCache = ArcadeUtils.compileExpressions(expressionInfos);
      columns = tableUtils.generateColumnsFromFields(this.grid && this.grid.columns, this.map, this.layerInfo, expressionCache, results.fields, _typeIdFild, _types, supportOrder && supportPage || !exceededLimit, supportStatistics, this.layer);

      // remove attachments temporary
      if (this.layer.hasAttachments && this.layer.objectIdField && this.configedInfo.showAttachments) {
        // columns.selectionHandle = {
        //   label: "",
        //   className: "selection-handle-column",
        //   hidden: false,
        //   unhidable: true,
        //   filed: "selection-handle-column",
        //   sortable: false,
        //   _cache: {
        //     sortable: false,
        //     statistics: false
        //   }
        // };
        columns.attachmentsColumn = this.formatAttachmentsColumn(); // add attachments column
      }
      //if autoWidth is ture, means no horizontal bar
      //if autoWidth is false, means we have too many fields and maybe need horizontal bar
      var autoWidth = 20 * 1 + 100 * results.fields.length < html.getMarginBox(this.domNode).w;
      //create dgrid, only one time
      this.createTable(columns, store, recordCounts, autoWidth);
      //Use 'presentation' instead of default 'columnheader' for selectionHandler on header
      var selectionHandleOnHeader = this.grid.domNode.querySelectorAll('.dgrid-header .dgrid-column-selectionHandle');
      selectionHandleOnHeader.length > 0 && selectionHandleOnHeader[0].setAttribute('role', 'presentation');

      this._currentExtent = nExtent;

      var selectedFeatures = this.layer.getSelectedFeatures();
      // it seems that grid.select(id) is not always emitting dgrid-select,
      // so persist the selection ids.
      if (this.selectionRows && this.selectionRows.length > 0) {
        this._updateSelectRowsByIds(this.selectionRows);
      } else if (selectedFeatures && selectedFeatures.length > 0) {
        this._updateSelectRowsByFeatures(selectedFeatures);
      } else {
        this.grid.clearSelection();
      }
      this.changeToolbarStatus();

      this.emit('data-loaded');
    },

    formatAttachmentsColumn: function formatAttachmentsColumn() {
      var column = {
        label: this.nls.attachments,
        className: 'attachments-column',
        hidden: false,
        unhidable: true,
        field: 'at-show-attachments',
        sortable: false,
        _cache: {
          sortable: false,
          statistics: false
        }
      };
      // jshint unused: true
      column.renderCell = lang.hitch(this, function (obj, v, node) {
        /*jshint unused: false*/
        var oid = obj[this.layer.objectIdField];
        this.layer.queryAttachmentInfos(oid, lang.hitch(this, function (infos) {
          var liTemplates = array.map(infos, lang.hitch(this, function (ainfo) {
            var isImage = ainfo.name && /\.(png|jpg|jpeg|gif)$/gi.test(ainfo.name);
            var fileType = isImage ? 'image-type' : 'file-type';
            var credential = esriId.findCredential(this.layer.url);
            var attachmentUrl = this.layer.url + '/' + oid + '/attachments/' + ainfo.id + (credential ? '?token=' + credential.token : "");
            return '<li class="' + fileType + '">' + '<a class="jimu-ellipsis" target="_blank" href="' + attachmentUrl + '">' + ainfo.name + '</a>' + '</li>';
          }));
          var filesNls = '';
          if (infos.length > 0) {
            filesNls = ' ' + this.nls.files;
          }
          var template = '<div class="attachment-infos">' + '<div class="show-attachments-div">' + '<span class="show-attachments">' + infos.length + filesNls + '</span>' + '</div>' + '<div class="attachment-popup">' + '<div class="attachment-popup-header">' + '<span>' + liTemplates.length + '&nbsp;' + this.nls.files + '</span>' + '<span class="close jimu-float-trailing"></span>' + '</div>' + '<ul class="attachment-popup-content">' + liTemplates.join('') + '</ul>' + '</div>' + '</div>';

          var templateDom = html.toDom(template);

          if (infos.length > 0) {
            var showAttachmentsDiv = query('.show-attachments-div', templateDom)[0];
            html.addClass(showAttachmentsDiv, 'has-attachments');
          }

          node.appendChild(templateDom);
          this.own(on(node, 'click', lang.hitch(this, function (evt) {
            var target = evt && evt.target;
            var valid = html.hasClass(target, 'show-attachments-div') || html.hasClass(target, 'show-attachments') || html.hasClass(target, 'close');
            if (!valid) {
              return;
            }
            var oldVisibleAttachmentPopup = this._visibleAttachmentPopup;
            var attachmentPopup = query('.attachment-popup', node)[0];
            if (attachmentPopup && liTemplates.length > 0) {
              html.toggleClass(attachmentPopup, 'show');
            }
            if (html.hasClass(attachmentPopup, 'show')) {
              this._visibleAttachmentPopup = attachmentPopup;
            } else {
              this._visibleAttachmentPopup = null;
            }
            if (oldVisibleAttachmentPopup && oldVisibleAttachmentPopup !== attachmentPopup) {
              html.toggleClass(oldVisibleAttachmentPopup, 'show');
            }
          })));
        }), lang.hitch(this, function (err) {
          console.error(err);
        }));
      });

      return column;
    },

    createTable: function createTable(columns, store, recordCounts, autoWidthMode) {
      if (this.grid) {
        this.grid.set("store", store);
        this.grid.set('columns', columns);
        this.grid.refresh();
      } else {
        var json = {};
        var gridLoadingIndicator = new LoadingIndicator();
        html.setStyle(gridLoadingIndicator.domNode, "max-width", "100vw");
        json.columns = columns;
        json.store = store;
        json.keepScrollPosition = true;
        json.farOffRemoval = this.GRID_FAR_OFF_REMOVAL.DEFAULT;
        // a better handling for lazy loading data when scrolling on Chrome.
        // original issue from dgrid: https://github.com/SitePen/dgrid/issues/1351
        if (!has('chrome')) {
          json.pagingDelay = 1000; //like search delay
        }
        json.allowTextSelection = this.allowTextSelection;
        json.deselectOnRefresh = false;
        json.loadingMessage = gridLoadingIndicator.domNode && gridLoadingIndicator.domNode.outerHTML;

        if (!this.layer.objectIdField) {
          json.minRowsPerPage = this.layer.maxRecordCount || 1000;
          json.maxRowsPerPage = this.layer.maxRecordCount || 1000;
          json.selectionMode = 'none';
        }

        var demands = [OnDemandGrid, Selection, ColumnHider, ColumnResizer, ColumnReorder, Keyboard];
        this.grid = new (declare(demands))(json, html.create("div"));
        html.place(this.grid.domNode, this.domNode);
        this.grid.startup();

        // //
        // html.create('p', {
        //  id: 'gridSelectionHandleDescription',
        //  innerHTML: this.parent.nls.selectionHandleDescription
        // }, this.parent.domNode);

        // this.grid.hiderToggleNode

        if (this.tipNode) {
          html.destroy(this.tipNode);
        }
        // // private preperty in grid
        // // _clickShowSelectedRecords
        // // when these value is true selected rows after refresh complete.
        // this.grid._clickShowSelectedRecords = false;

        // prevent select when press shift key to do multiple selection.
        this.own(on(this.ownerDocument, 'keydown', lang.hitch(this, function (evt) {
          if (this.allowTextSelection && this.grid && this.grid.allowTextSelection && evt.shiftKey) {
            this.grid._setAllowTextSelection(false);
          }
        })));
        this.own(on(this.ownerDocument, 'keyup', lang.hitch(this, function () {
          if (this.allowTextSelection && this.grid && !this.grid.allowTextSelection) {
            this.grid._setAllowTextSelection(true);
          }
        })));
        this.own(on(this.ownerDocument, 'keydown', lang.hitch(this, function (evt) {
          if (this.tableCreated && (evt.keyCode === keys.SHIFT || (has('mac') ? evt.keyCode === keys.META : evt.keyCode === keys.CTRL) && this.isSelectionMode())) {
            this._setFarOffRemoval(this.GRID_FAR_OFF_REMOVAL.INFINITY);
            on.once(this.ownerDocument, 'keyup', lang.hitch(this, function (evt) {
              if (this.tableCreated && (evt.keyCode === keys.SHIFT || (has('mac') ? evt.keyCode === keys.META : evt.keyCode === keys.CTRL))) {
                if (this.isSelectionMode()) {
                  this._setFarOffRemoval(this.GRID_FAR_OFF_REMOVAL.RESELECTION);
                } else {
                  this._setFarOffRemoval(this.GRID_FAR_OFF_REMOVAL.DEFAULT);
                }
              }
            }));
          }
        })));

        if (this.layer.objectIdField) {
          // bind grid evnt

          //show header menu: ASC,DSC,Statistics
          this.own(on(this.grid, ".dgrid-header .dgrid-cell:click", lang.hitch(this, this._onHeaderClick)));

          // toogle visibility of field in columns menu
          this.own(on(this.grid, 'dgrid-columnstatechange', lang.hitch(this, this._onColumnStateChange)));

          //select rows
          this.own(on(this.grid, ".selection-handle-column:click", lang.hitch(this, this._onSelectionHandleClick)), on(this.grid, ".selection-handle-column:keydown", lang.hitch(this, function (e) {
            if (e.keyCode === keys.ENTER || e.keyCode === keys.SPACE) {
              this._onSelectionHandleClick();
            }
          })));

          // attach event handlers
          this.own(
          //dblclick to select one row and show popup on the feature, but not put into selection
          on(this.grid, ".dgrid-row:dblclick", lang.hitch(this, this._onDblclickRow)),
          //dgrid sort
          on(this.grid, 'dgrid-sort', lang.hitch(this, function (evt) {
            this.emit('sort', evt);
          })),
          // add a11y support to the table (grid)
          on(this.grid, 'dgrid-refresh-complete', lang.hitch(this, function (evt) {
            if (this.parent) {
              topic.publish(this.parent.id + '_table_created', {
                grid: evt.grid,
                context: this
              });
            }
          })));
          var inMap = this.map.getLayer(this.layer.id);
          if (this.syncSelection && inMap) {
            this.own(on(inMap, 'click', lang.hitch(this, this._onFeaturelayerClick)));
          }
        }
      }

      // apply sort option if no one has been applied
      if (!this.grid.get('sort')[0]) {
        if (this.configedInfo && this.configedInfo.sortField) {
          this.grid.set('sort', this.configedInfo.sortField, this.configedInfo.isDescending);
        } else if (this.layer.objectIdField) {
          this.grid.set('sort', this.layer.objectIdField, false);
        }
      }

      // fix dgrid bug
      // sometimes dgrid-scroller will overload dgrid-header
      if (this.getParent()) {
        var scroller = query('.dgrid-scroller', this.grid.domNode)[0];
        var header = query('.dgrid-header', this.grid.domNode)[0];
        var scrollerStyle = html.getComputedStyle(scroller);
        var headerBox = html.getMarginBox(header);
        var smt = parseInt(scrollerStyle.marginTop, 10);
        if (isFinite(smt) && headerBox && smt < headerBox.h) {
          html.setStyle(scroller, 'marginTop', headerBox.h + 'px');
        }
      }

      if (autoWidthMode) {
        html.addClass(this.domNode, 'auto-width');
      } else {
        html.removeClass(this.domNode, 'auto-width');
      }

      if (this.footer) {
        html.empty(this.footer);
      } else {
        this.footer = html.create('div', {
          'id': this.parent.id + '_' + this.id + '_footer',
          'class': this.parent.baseClass + '-feature-table-footer',
          tabindex: '-1'
        }, this.domNode);
      }
      var _footer = this.footer;
      var countLabel = html.create('div', {
        'class': 'dgrid-status self-footer',
        'innerHTML': recordCounts + '&nbsp;' + (this.layerInfo.isTable ? this.nls.records : this.nls.features) + '&nbsp;'
      }, _footer);
      this.selectedRowsLabel = html.create('div', {
        'class': 'dgrid-status self-footer',
        'id': this.id + '_Selected_Rows_Label',
        'innerHTML': 0 + '&nbsp;' + this.nls.selected + '&nbsp;',
        'style': {
          display: this.layer.objectIdField ? '' : 'none'
        }
      }, countLabel, 'after');

      var height = html.getStyle(this.domNode, "height");
      this.changeHeight(height);

      this._requestStatus = 'fulfilled';
      this.tableCreated = true;
      html.place(this.loading.domNode, this.grid.domNode);
      this._toggleLoading(false);
    },

    getSelectedRowsData: function getSelectedRowsData() {
      var def = new Deferred();
      var selectedIds = this._getTableSelectedIds() || [];
      if (!this.grid || !selectedIds.length) {
        def.resolve(null);
        return def;
      }

      if (this.grid.store instanceof Memory) {
        var results = lang.clone(this.grid.store.data);
        def.resolve(results);
      } else {
        this.grid.store.query(selectedIds, { _export_count: selectedIds.length }) // count specific counts to fetch.
        .then(lang.hitch(this, function (data) {
          var results = data && lang.clone(this.grid.store._entityData || this.grid.store.data);
          def.resolve(results);
        }));
      }
      return def;
    },

    _appendXY: function _appendXY(datas) {
      //export geometry if shape type of layer is point
      if (datas && this.layer.geometryType === "esriGeometryPoint") {
        array.forEach(datas, function (d) {
          var geometry = d.geometry;
          if (geometry && geometry.type === "point") {
            if ("x" in d) {
              d._x = geometry.x;
            } else {
              d.x = geometry.x;
            }

            if ("y" in d) {
              d._y = geometry.y;
            } else {
              d.y = geometry.y;
            }
          }

          delete d.geometry;
        });
      }
    },

    // get out fields for export.
    // isSelectedData equals true means export selected data,
    // we should append x,y fields to _outFields.
    getOutFields: function getOutFields(isSelectedData) {
      var _outFields = null;
      var pk = this.layer.objectIdField;
      _outFields = this._getOutFieldsFromLayerInfos(pk);
      _outFields = this._processExecuteFields(this.layer.fields, _outFields);
      _outFields = this._getVisibleFields(_outFields);
      _outFields = lang.clone(_outFields);
      if (isSelectedData) {
        var name = "";
        if (_outFields.indexOf('x') !== -1) {
          name = '_x';
        } else {
          name = 'x';
        }
        _outFields.push({
          'name': name,
          alias: name,
          format: {
            'digitSeparator': false,
            'places': 6
          },
          show: true,
          type: "esriFieldTypeDouble"
        });
        if (_outFields.indexOf('y') !== -1) {
          name = '_y';
        } else {
          name = 'y';
        }
        _outFields.push({
          'name': name,
          alias: name,
          format: {
            'digitSeparator': false,
            'places': 6
          },
          show: true,
          type: "esriFieldTypeDouble"
        });
      }
      return _outFields;
    },

    setSelectedNumber: function setSelectedNumber() {
      if (this.selectedRowsLabel && this.grid) {
        var _ids = this.getSelectedRows();
        var currentViewCount = 0;
        // selected number should change with current records in table.
        if (this.grid.store instanceof Memory) {
          var oids = array.map(this.grid.store.data, function (d) {
            return d[this.layer.objectIdField];
          }, this);
          array.forEach(_ids, function (id) {
            if (oids.indexOf(id) > -1) {
              currentViewCount++;
            }
          });
        } else {
          // query store
          currentViewCount = _ids.length;
        }
        this.selectedRowsLabel.innerHTML = "&nbsp;&nbsp;" + currentViewCount + " " + this.nls.selected + "&nbsp;&nbsp;";
      }
    },

    _setSelection: function _setSelection(result) {
      result = result || [];
      this._selectionResults = result;
      this.selectionManager.setSelection(this.layer, result);
    },

    _zoomToExtentByFeatures: function _zoomToExtentByFeatures(result) {
      return this.getExtent(result).then(lang.hitch(this, function (gExtent) {
        if (gExtent && this.domNode) {
          var def = null;
          if (gExtent.type === "point") {
            // var levelOrFactor = 15;
            // levelOrFactor = this.map.getMaxZoom() > -1 ? this.map.getMaxZoom() : 0.1;
            // // def = this.map.centerAndZoom(gExtent, levelOrFactor);

            var numLevels = this.map.getNumLevels(),
                currentLevel = this.map.getLevel(),
                last = this.map.getMaxZoom(),
                factor = 4;

            if (numLevels > 0) {
              // tiled base layer
              var targetLevel;
              if (currentLevel === last) {
                // if currentLevel is maxZoomLevel
                targetLevel = currentLevel;
              } else {
                targetLevel = currentLevel + factor;
                if (targetLevel > last) {
                  targetLevel = last;
                }
              }
              def = this.map.centerAndZoom(gExtent, targetLevel);
            } else {
              // dynamic base layer
              def = this.map.centerAndZoom(gExtent, 1 / Math.pow(2, factor) * 2);
            }
          } else {
            def = this.map.setExtent(gExtent.expand(2));
          }

          return def.then(function () {
            return gExtent;
          });
        }
      }));
    },

    _showMapInfoWindowByFeatures: function _showMapInfoWindowByFeatures(gExtent, result) {
      if (!result || result.length === 0 || !this.domNode) {
        return;
      }
      var popup = this.map.infoWindow;
      var layerInfoTemplate = this.layerInfo.isPopupEnabled() && this.layerInfo.getInfoTemplate();
      if (popup && popup.setFeatures && result.length === 1 && layerInfoTemplate) {
        array.forEach(result, lang.hitch(this, function (item) {
          // sometimes result come from querytask not local feature
          // so we need to bind the _layer and infoTemplate to the result
          item._layer = this.layerInfo.layerObject;
          item.setInfoTemplate(layerInfoTemplate);
        }));
        popup.setFeatures(result);

        var location = null;
        if (gExtent.type === "point") {
          location = result[0].geometry;
        } else {
          location = gExtent.getCenter();
        }
        popup.show(location, {
          closetFirst: true
        });

        this._dblClickResult = result[0];
        this.syncWithMapInfowindow(this._dblClickResult);
      }
    },

    // differect with layer.selectFeatures
    selectFeatures: function selectFeatures(method, result) {
      if (result && result.length > 0) {
        if (method === "rowclick" || method === "selectall") {
          // ignore selectall
          this._setSelection(result); // call selectionManager
        } else if (method === "zoom" || method === "row-dblclick") {
          var gExtent = jimuUtils.graphicsExtent(result);
          var featureSet = jimuUtils.toFeatureSet(result);
          // use "zoom-end" and "pan-end" to catch zooming animation complete callback
          // more precisely than the callback from "jimuUtils.zoomToFeatureSet"
          var onMapZoomOrPan = on(this.map, 'zoom-end, pan-end', lang.hitch(this, function () {
            onMapZoomOrPan.remove();
            if (method !== "row-dblclick" || !this.domNode) {
              return;
            }
            this._showMapInfoWindowByFeatures(gExtent, result);
          }));
          // use "zoomToFeatureSet" method in jimu/utils to zoom to feature(s)
          jimuUtils.zoomToFeatureSet(this.map, featureSet).then(null, function (err) {
            if (err) {
              console.error(err.message);
              if (onMapZoomOrPan) {
                onMapZoomOrPan.remove();
              }
            }
          });
        }
        this.setSelectedNumber();
        //emit the feature selected event
        this.onFeatureSelectionChange();
      } else {
        //emit the feature selected event
        this.onFeatureSelectionChange();
        this._popupMessage(this.nls.dataNotAvailable);
      }
    },

    // monitor: feature or [feature]
    syncWithMapInfowindow: function syncWithMapInfowindow(monitor) {
      var popup = this.map.infoWindow;
      var result = lang.isArray(monitor) ? monitor : [monitor];
      // var sg = monitor;
      on.once(popup, 'hide', lang.hitch(this, function () {
        if (h && h.remove) {
          h.remove();
          h = null;
        }
      }));
      var h = aspect.after(popup, 'show', lang.hitch(this, function () {
        var sg = popup.getSelectedFeature();
        var selectedSg = sg && result[0] === sg;
        var index = -1;
        if (popup.features) {
          index = popup.features.indexOf(result[0]);
        }
        if (!selectedSg && index > -1) {
          popup.select(index);
        } else if (this.domNode && !selectedSg) {
          if (h && h.remove) {
            h.remove();
            h = null;
          }
        }
      }));
    },

    getGraphicsFromLocalFeatureLayer: function getGraphicsFromLocalFeatureLayer(ids) {
      var gs = [],
          id,
          idsi;
      var len = ids.length;
      var n = this.layer.graphics.length;
      var objectid = this.layer.objectIdField;
      for (var i = 0; i < len; i++) {
        for (var m = 0; m < n; m++) {
          id = this.layer.graphics[m].attributes[objectid] + "";
          idsi = ids[i] + "";
          if (id === idsi) {
            gs.push(this.layer.graphics[m]);
            break;
          }
        }
      }
      return gs;
    },

    // addGraphics: function(result) {
    //   var symbol, graphic;
    //   var len = result.length;
    //   var outlineSymbol = new SimpleLineSymbol(
    //     SimpleLineSymbol.STYLE_SOLID,
    //     new Color([0, 255, 255]),
    //     2
    //   );
    //   // this.graphicsLayer.clear();

    //   for (var i = 0; i < len; i++) {
    //     var geometry = null;
    //     if (!result[i].geometry) {
    //       console.error('unable to get geometry of the reocord: ', result[i]);
    //       continue;
    //     } else if (!result[i].geometry.spatialReference.equals(this.map.spatialReference)) {
    //       console.warn('unable to draw graphic result in different wkid from map');
    //     }
    //     if (result[i].geometry.type === "point") {
    //       geometry = new Point(result[i].geometry.toJson());
    //       symbol = lang.clone(this.map.infoWindow.markerSymbol);
    //     } else if (result[i].geometry.type === "multipoint") {
    //       geometry = new Multipoint(result[i].geometry.toJson());
    //       symbol = lang.clone(this.map.infoWindow.markerSymbol);
    //     } else if (result[i].geometry.type === "polyline") {
    //       geometry = new Polyline(result[i].geometry.toJson());
    //       symbol = outlineSymbol;
    //     } else if (result[i].geometry.type === "polygon") {
    //       geometry = new Polygon(result[i].geometry.toJson());
    //       symbol = new SimpleFillSymbol(
    //         SimpleFillSymbol.STYLE_SOLID,
    //         outlineSymbol,
    //         new Color([255, 255, 255, 0.25])
    //       );
    //     }
    //     graphic = new Graphic(geometry, symbol, result[i].attributes, result[i].infoTemplate);
    //     // this.graphicsLayer.add(graphic);
    //   }
    // },

    getExtent: function getExtent(result) {
      var def = new Deferred();

      var extent, points;
      var len = result.length;
      if (len === 1 && result[0].geometry && result[0].geometry.type === "point") {
        extent = result[0].geometry;
      } else if (len === 1 && !result[0].geometry) {
        def.reject(new Error('AttributeTable.getExtent:: extent was not projected.'));
        return def;
      } else {
        for (var i = 0; i < len; i++) {
          if (!result[i].geometry) {
            console.error('unable to get geometry of the reocord: ', result[i]);
            continue;
          }
          if (result[i].geometry.type === "point") {
            if (!points) {
              points = new Multipoint(result[i].geometry.spatialReference);
              points.addPoint(result[i].geometry);
            } else {
              points.addPoint(result[i].geometry);
            }
            if (i === len - 1) {
              extent = points.getExtent();
            }
          } else {
            if (!extent) {
              extent = result[i].geometry.getExtent();
            } else {
              extent = extent.union(result[i].geometry.getExtent());
            }
          }
        }
      }

      if (!extent || !extent.spatialReference) {
        def.reject(new Error("AttributeTable.getExtent:: extent was not projected."));
        return def;
      }

      // convert to map sr
      var sr = this.map.spatialReference;
      if (extent.spatialReference.equals(sr)) {
        def.resolve(extent);
      } else {
        var parameter = new ProjectParameters();
        parameter.geometries = [extent];
        parameter.outSR = sr;

        esriConfig.defaults.geometryService.project(parameter, lang.hitch(this, function (geometries) {
          if (!this.domNode) {
            return;
          }
          if (geometries && geometries.length) {
            def.resolve(geometries[0]);
          } else {
            def.reject(new Error("AttributeTable.getExtent:: extent was not projected."));
          }
        }), lang.hitch(this, function (err) {
          // projection error
          if (!err) {
            err = new Error("AttributeTable.getExtent:: extent was not projected.");
          }
          def.reject(err);
        }));
      }
      return def;
    },

    // scroll records to view when click feature in map if possible
    // 1. get selected feature objectId
    // 2. calculate row position based on objectId if sorted by objectId ASC:_getIndexOfIdInGrid
    // 3. scroll to the position
    _onFeaturelayerClick: function _onFeaturelayerClick(evt, fromPopup) {
      if (!this.actived) {
        return;
      }
      var graphic = lang.getObject('graphic', false, evt);
      var attributes = lang.getObject('graphic.attributes', false, evt);
      if (!attributes || !graphic || graphic._layer !== this.layer) {
        return;
      }
      var sg = this.map.infoWindow.getSelectedFeature();
      if (sg && sg._layer === this.layer && !fromPopup) {
        this.map.infoWindow.hide();
      }

      var id = attributes[this.layer.objectIdField];
      if (this.showSelected) {
        this.toggleSelectedRecords();
      }
      // this.clearSelection(false);
      // for now doesn't get index correctly if other fields be sorted
      this._getIndexOfIdInGrid(id).then(lang.hitch(this, function (dataIndex) {
        if (dataIndex === -1) {
          return;
        }

        this.grid.scrollTo({
          x: 0,
          y: this.grid.rowHeight * dataIndex
        });

        if (this.map.infoWindow.features) {
          var index = this.map.infoWindow.features.indexOf(evt.graphic);
          this.map.infoWindow.select(index);
        }

        on.once(this.map.infoWindow, 'selection-change', lang.hitch(this, function () {
          var graphic = this.map.infoWindow.getSelectedFeature();
          var _layer = lang.getObject('_layer', false, graphic);
          if (graphic === evt.graphic || _layer !== this.layer) {
            return;
          }
          this._onFeaturelayerClick({
            graphic: graphic
          }, true);
        }));
        this.syncWithMapInfowindow(evt.graphic);
      }));
    },

    _getIndexOfIdInGrid: function _getIndexOfIdInGrid(id) {
      var def = new Deferred();
      var dataIndex = -1;
      var objectIds = lang.getObject('store.objectIds', false, this.grid);

      var compare = null;
      var sort = this.grid.get('sort')[0];

      if (this._relatedQuery) {
        def.resolve(-1);
        return def;
      }

      if (this.grid.store instanceof Memory) {
        var obj = this.grid.store.get(id);
        var data = this.grid.store.data;
        if (!obj) {
          dataIndex = -1;
        } else if (sort && sort.attribute && esriLang.isDefined(sort.descending)) {
          data = lang.clone(data);
          compare = function (attr, des) {
            return function (a, b) {
              if (a[attr] === b[attr]) {
                return 0;
              }

              return a[attr] < b[attr] ? des ? 1 : -1 : des ? -1 : 1;
            };
          }(sort.attribute, sort.descending);
          data.sort(compare);
          data = array.map(data, function (d) {
            return d[this.layer.objectIdField];
          }, this);
          dataIndex = data.indexOf(obj[this.layer.objectIdField]);
        } else {
          dataIndex = data.indexOf(obj);
        }
        def.resolve(dataIndex);
      } else if (objectIds && objectIds.length > 0) {
        // in this case does't support sort
        dataIndex = objectIds.indexOf(id);
        def.resolve(dataIndex);
      } else {
        var query = new Query();
        query.returnGeometry = false;
        query.where = this._getLayerFilterExpression() + " AND " + this.layer.objectIdField + " < " + id;
        // query count cann't get right postion if users ordered by other fields
        if (sort && !(sort.attribute === this.layer.objectIdField && !sort.descending)) {
          def.resolve(-1);
          return def;
        }
        // if (sort && sort.attribute && esriLang.isDefined(sort.descending)) {
        //   query.orderByFields = [sort.attribute + (sort.descending ? " DESC" : " ASC")];
        // }

        // query.outFields = [this.layer.objectIdField, sort.attribute];

        if (this.matchingMap && !this._relatedQuery && this._currentExtent) {
          query.geometry = this._currentExtent;
        }

        var countDef = this._currentDef = this.layer.queryCount(query);
        // var countDef = this._currentDef = this.layer.queryFeatures(query);
        countDef.then(lang.hitch(this, function (count) {
          def.resolve(count);
        }), lang.hitch(this, function (err) {
          def.reject(err);
        }));
      }

      return def;
    },

    // _onRefreshComplete: function(evt) {
    //   if (evt.grid._clickShowSelectedRecords) {
    //     var selectedIds = this.getSelectedRows();
    //     array.forEach(selectedIds, lang.hitch(this, function(id) {
    //       evt.grid.select(id);
    //     }));

    //     evt.grid._clickShowSelectedRecords = false;
    //   }
    // },

    _zoomToSelected: function _zoomToSelected() {
      if (!this.configedInfo || !this.tableCreated) {
        return;
      }
      var ids = this.getSelectedRows();
      this._goToFeatures(ids, 'zoom');
    },

    _goToFeatures: function _goToFeatures(ids, method) {
      if (ids.length === 0) {
        return;
      } else {
        var localGraphics = this.getGraphicsFromLocalFeatureLayer(ids);
        if (this.isSupportQueryToServer() && ids.length !== localGraphics.length) {
          this._queryFeaturesByIds(ids, method);
          return;
        } else {
          //this.isSupportQueryOnClient()
          // or supportQueryToServer but can get graphics in client directly
          this.selectFeatures(method, localGraphics);
        }
      }
    },

    _onDblclickRow: function _onDblclickRow(evt) {
      if (this.layerInfo && this.layerInfo.isShowInMap()) {
        // this._zoomToSelected();
        var row = this.grid.row(evt);
        var ids = [row.id];
        this._goToFeatures(ids, 'row-dblclick');
      }
    },

    _queryFeaturesByIds: function _queryFeaturesByIds(ids, mode) {
      var query = new Query();
      query.objectIds = ids;
      query.returnGeometry = true;
      query.outSpatialReference = lang.clone(this.map.spatialReference);
      query.outFields = ['*'];
      var _layer = this.layer;
      var isCSVLayer = _layer.declaredClass === "esri.layers.CSVLayer";
      if (_layer.url && !isCSVLayer) {
        //we always select feature from server if layer has url
        var queryTask = new QueryTask(_layer.url);
        queryTask.execute(query, lang.hitch(this, function (fset) {
          this.selectFeatures(mode, fset.features);
        }), lang.hitch(this, this._errorSelectFeatures));
      } else {
        // FeatureCollection do query on client
        _layer.selectFeatures(query, FeatureLayer.SELECTION_NEW, lang.hitch(this, this.selectFeatures, mode), lang.hitch(this, this._errorSelectFeatures));
      }
    },

    _onHeaderClick: function _onHeaderClick(evt) {
      var cell = this.grid.cell(evt);
      var column = cell.column;
      var cellBoundingRect = cell.element.getBoundingClientRect();
      var coords = {
        x: evt.pageX || cellBoundingRect.x + cellBoundingRect.width * 0.5,
        y: evt.pageY || cellBoundingRect.y + cellBoundingRect.height
      };
      this._showColumnMenu(column, cell, evt.target, coords);
    },

    _showColumnMenu: function _showColumnMenu(column, cell, target, coords) {
      var info = lang.getObject("_cache", false, column);
      if (!info || !info.sortable && !info.statistics) {
        return;
      }
      var cm = new Menu({});
      html.addClass(cm.domNode, 'jimu-widget-attributetable-feature-menu');
      var that = this;
      if (info.sortable) {
        var labelArray = [this.nls.sortAsc, this.nls.sortDes];
        var iconArray = ["iconSortAscending", "iconSortDescending"];

        array.forEach(labelArray, function (label, idx) {
          var menuItem = new MenuItem({
            "label": label,
            "iconClass": iconArray[idx],
            "baseClass": "menuItemClass",
            onClick: function onClick() {
              if (0 === idx) {
                that.grid.set('sort', column.field, false);
              } else if (1 === idx) {
                that.grid.set('sort', column.field, true);
              }
            }
          });
          cm.addChild(menuItem);
        });
      }
      if (info.statistics) {
        var menuItem = new MenuItem({
          label: this.nls.statistics,
          iconClass: "iconTableStatistics",
          baseClass: "menuItemClass",
          onClick: lang.hitch(this, function () {
            var statInfo = {
              layer: this.layer,
              filterExpression: this._getLayerFilterExpression(),
              fieldNames: [column.field]
            };

            if (this.matchingMap) {
              // map extent
              statInfo.geometry = this._currentExtent;
            }

            if (this.showSelected) {
              // only show Selected records
              var selectedIds = this._getSelectedIds();
              statInfo.filterExpression += ' AND ' + this.layer.objectIdField + ' IN (' + selectedIds.join() + ')';
            } else {
              //related mode or featureSet(View In Table Action)
              if (this.queryByStoreObjectIds && this.queryByStoreObjectIds.length > 0) {
                statInfo.filterExpression += ' AND ' + this.layer.objectIdField + ' IN (' + this.queryByStoreObjectIds.join() + ')';
              }
            }

            this.fieldStatistics = new FieldStatistics();
            this.fieldStatistics.showContentAsPopup(statInfo);
            // on.once(this.FieldStatistics, 'statistics', lang.hitch(this, function(evt) {
            //   this.emit('show-statistics', evt);
            // }));
          })
        });
        cm.addChild(menuItem);
      }

      var childCount = cm.getChildren();

      cm.startup();
      cm._openMyself({
        "target": target,
        delegatedTarget: cell,
        iframe: null,
        "coords": coords
      });

      this.own(on(cm, 'Close', lang.hitch(this, function () {
        var menu = this.get('columnMenu');
        if (menu) {
          menu.destroyRecursive();
          this.set('columnMenu', null);
        }
      })));
      this.set('columnMenu', cm);

      if (childCount.length < 1) {
        on.emit(cm, 'Close');
      }
    },

    _onColumnStateChange: function _onColumnStateChange(evt) {
      if (evt && evt.grid && evt.grid.columns) {
        // var visibleFields = array.filter(evt.grid.columns, lang.hitch(this, function(c) {
        //   return !c.hidden;
        // }));
        // var len = visibleFields.length;
        var len = 0;
        for (var p in evt.grid.columns) {
          if (!evt.grid.columns[p].hidden) {
            len++;
          }
        }

        if (20 * 1 + 100 * len - 1 < html.getMarginBox(this.domNode).w) {
          html.addClass(this.domNode, 'auto-width');
        } else {
          html.removeClass(this.domNode, 'auto-width');
        }
      }
    },

    _onSelectionHandleClick: function _onSelectionHandleClick() {
      var ids = this._getSelectedIds();
      this.selectionRows = ids;

      this._closePopup();
      if (!this.layerInfo.isTable) {
        if (ids.length > 0) {
          this._goToFeatures(ids, 'rowclick');
        } else {
          //emit the feature selected event
          this.onFeatureSelectionChange();
          this._setSelection([]);
        }
      }

      this.setSelectedNumber();

      if (this.getSelectedRows().length === 1) {
        this._setFarOffRemoval(this.GRID_FAR_OFF_REMOVAL.RESELECTION);
      }

      this.emit('row-click', {
        table: this,
        selectedIds: ids
      });
    },

    _onExtentChange: function _onExtentChange(params) {
      var x = lang.getObject('delta.x', false, params);
      var y = lang.getObject('delta.y', false, params);
      // sometimes click map will emit extent change,
      //so we need to judge whether delta really changed
      var really = this._clickMap && !params.levelChange ? isFinite(x) && isFinite(y) && (Math.abs(x) > 0 || Math.abs(y) > 0) : true;
      this._clickMap = false;
      if (!really) {
        return;
      }
      if (this.matchingMap && this.actived && this.layerInfo && !this.layerInfo.isTable) {
        this.startQuery(this.queryByStoreObjectIds);
      }
    },

    _getLayerFilterExpression: function _getLayerFilterExpression() {
      // var expr = (this._filterObj && this._filterObj.expr) || "";

      // var mapFilter = this.layerInfo.getFilterOfWebmap();

      // if (expr) {
      //   if (mapFilter) {
      //     return expr + " AND " + mapFilter;
      //   } else {
      //     return expr;
      //   }
      // } else if (mapFilter) {
      //   return mapFilter;
      // }

      var layerFilter = this.layerInfo.getFilter();
      if (layerFilter) {
        return layerFilter;
      }

      return "1=1";
    },

    _getOutFieldsFromLayerInfos: function _getOutFieldsFromLayerInfos(pk) {
      var fields = this.configedInfo.layer.fields;
      var pInfos = this.layerInfo.getPopupInfo();
      var lFields = pInfos && pInfos.fieldInfos;
      var oFields = [];
      if (fields) {
        array.forEach(fields, lang.hitch(this, function (field) {
          if (!esriLang.isDefined(field.show)) {
            field.show = true;
            // check if the field is defined via configuration of map popup
            if (lFields) {
              for (var i = 0, len = lFields.length; i < len; i++) {
                var f = lFields[i];
                if (f.fieldName === field.name) {
                  field.show = f.visible;
                }
              }
            }
          }
          if (field.name === pk && (
          // Fields come from layer.fields
          field.type === 'esriFieldTypeOID' || field.type === 'esriFieldTypeInteger' ||
          // Fields come from config.layer.fileds
          !field.type)) {
            field._pk = true;
          }
          if (field.show || field._pk) {
            oFields.push(field);
          }
        }));
      }
      return oFields;
    },

    _processExecuteFields: function _processExecuteFields(rFields, oFields) {
      if (rFields && rFields.length > 0) {
        var outFields = [];
        if (!oFields.length) {
          return rFields;
        }
        for (var i = 0, len = oFields.length; i < len; i++) {
          for (var j = 0; j < rFields.length; j++) {
            if (oFields[i].name === rFields[j].name && (oFields[i].type === rFields[j].type || // oFields come from layer.fields
            !oFields[i].type) // oFields come from config.layer.fileds
            ) {
                rFields[j] = lang.mixin(rFields[j], oFields[i]);
                outFields.push(rFields[j]);
              }
          }
        }
        return outFields;
      } else {
        return oFields;
      }

      return rFields;
    },

    _getVisibleFields: function _getVisibleFields(oFields) {
      var hiddenFields = [];
      if (this.grid && this.grid.columns) {
        for (var field in this.grid.columns) {
          var columnField = this.grid.columns[field];
          if (columnField && columnField.hidden) {
            hiddenFields.push(columnField.field);
          }
        }
        return array.filter(oFields, function (oField) {
          if (hiddenFields.indexOf(oField.name) < 0) {
            return oField;
          }
        });
      }
      return oFields;
    },

    _getSelectedIds: function _getSelectedIds() {
      var ids = [];
      var selection = this.grid.selection;
      for (var id in selection) {
        if (selection[id]) {
          if (isFinite(id)) {
            ids.push(parseInt(id, 10));
          } else {
            ids.push(id);
          }
        }
      }

      return ids;
    },

    // different from fun:_getSelectedIds,table selected counts may differ
    // from layer selected if filtered by extent.
    _getTableSelectedIds: function _getTableSelectedIds() {
      var ids = [];
      var _ids = this.getSelectedRows();
      if (this.grid) {
        // selected number should change with current records in table.
        if (this.grid.store instanceof Memory) {
          var oids = array.map(this.grid.store.data, function (d) {
            return d[this.layer.objectIdField];
          }, this);
          array.forEach(_ids, function (id) {
            if (oids.indexOf(id) > -1) {
              ids.push(parseInt(id, 10));
            }
          });
        } else {
          ids = _ids; // as default.
        }
      }
      return ids;
    },

    // check table mode is selection mode.
    isSelectionMode: function isSelectionMode() {
      //now dgid is created
      var selectionRows = this.getSelectedRows();
      if (this.tableCreated && selectionRows && selectionRows.length > 0 && this.layer && this.layer.objectIdField) {
        return true;
      } else {
        return false;
      }
    },

    _errorSelectFeatures: function _errorSelectFeatures(params) {
      console.error(params);
    },

    _popupMessage: function _popupMessage(message) {
      var popup = new Message({
        message: message,
        buttons: [{
          label: this.nls.ok,
          onClick: lang.hitch(this, function () {
            popup.close();
          })
        }]
      });

      this._toggleLoading(false);
    },

    _hasArcadeExpressionFields: function _hasArcadeExpressionFields() {
      return this.layerInfo.getPopupInfo() && this.layerInfo.getPopupInfo().expressionInfos && array.some(this.configedInfo.layer.fields, function (field) {
        return tableUtils.arcade.isArcadeExpressionField(field);
      });
    },

    _hasArcadeExpressionWithGeometry: function _hasArcadeExpressionWithGeometry() {
      var expressionInfos = this.layerInfo.getPopupInfo() && this.layerInfo.getPopupInfo().expressionInfos;
      var parsedExpressions = tableUtils.arcade.parseArcadeExpressions(expressionInfos);
      if (parsedExpressions) {
        return array.some(Object.keys(parsedExpressions), function (expr) {
          return parsedExpressions[expr].usesGeometry;
        });
      }
      return false;
    },

    _toggleLoading: function _toggleLoading(show) {
      if (show === undefined) {
        var isHidden = this.loading.hidden;
        if (isHidden) {
          this.loading.show();
        } else {
          this.loading.hide();
        }
      } else {
        if (show) {
          this.loading.show();
        } else {
          this.loading.hide();
        }
      }
    },

    _setFarOffRemoval: function _setFarOffRemoval(number) {
      if (this.tableCreated && !isNaN(number)) {
        this.grid.set('farOffRemoval', number);
      }
    },

    // same logic taken from "jimu.js/dijit/_FeatureSetChooserCore.js"
    _handleFilterChange: function _handleFilterChange() {
      var selectedFeatures = this.layer.getSelectedFeatures();
      var objectIdField = this.layer.objectIdField;
      if (selectedFeatures && selectedFeatures.length > 0) {
        var selectionIds = array.map(selectedFeatures, function (feature) {
          return feature.attributes[objectIdField];
        });
        var queryParams = new Query();
        queryParams.where = objectIdField + ' in (' + selectionIds.join(',') + ') AND ' + this.layerInfo.getFilter();
        var queryTask = new QueryTask(this.layer.url);
        queryTask.executeForIds(queryParams).then(lang.hitch(this, function (filterIds) {
          array.forEach(selectedFeatures, function (feature) {
            if (filterIds && filterIds.indexOf(feature.attributes[objectIdField]) >= 0) {
              feature.show();
            } else {
              feature.hide();
            }
          });
          if (this.selectionManager._isLayerNeedDisplayLayer(this.layer)) {
            this.selectionManager._updateDisplayLayer(this.layer, selectedFeatures, FeatureLayer.SELECTION_NEW);
          }
        }), lang.hitch(this, function (err) {
          console.error(err);
        }));
      }
    }
  });
});
//# sourceMappingURL=_FeatureTable.js.map
