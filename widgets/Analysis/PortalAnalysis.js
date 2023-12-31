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

define(['dojo/_base/declare', 'dojo/_base/lang', 'dojo/_base/array', 'esri/lang'], function (declare, lang, array, esriLang) {
  return declare([], {
    userRole: null,
    portalSelf: null,

    constructor: function constructor(userRole, portalSelf) {
      this.userRole = userRole;
      this.portalSelf = portalSelf;
    },

    canPerformAnalysis: function canPerformAnalysis() {
      var privCheck = false;
      if (this.userRole && (this.userRole.isAdmin() || this.userRole.isPublisher())) {
        privCheck = true;
      } else if (this.userRole && this.userRole.isCustom()) {
        privCheck = this.userRole.canCreateItem() && this.userRole.canPublishFeatures() && this.userRole.canUseSpatialAnalysis();
      }

      //check if helperservices are configured if running in portal.
      //In online new trial orgs, analysis server is not configued until
      //a feature service is created, hive is allocated, while job submission after
      //createservice call its set
      // Portal this is necessary condition for enabling analysis
      if (this.portalSelf && this.portalSelf.isPortal) {
        privCheck = privCheck && esriLang.isDefined(this.portalSelf.helperServices.analysis) && esriLang.isDefined(this.portalSelf.helperServices.analysis.url);
      }
      return privCheck;
    },

    canPerformSpatialAnalytics: function canPerformSpatialAnalytics() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.analysis) && esriLang.isDefined(this.portalSelf.helperServices.analysis.url);
      return isServiceAvailable;
    },

    canPerformGeoAnalytics: function canPerformGeoAnalytics() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.geoanalytics) && esriLang.isDefined(this.portalSelf.helperServices.geoanalytics.url);
      return this.canPerformAnalysis() && isServiceAvailable;
    },

    canPerformRasterAnalysis: function canPerformRasterAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.rasterAnalytics) && esriLang.isDefined(this.portalSelf.helperServices.rasterAnalytics.url);
      return this.canPerformAnalysis() && isServiceAvailable;
    },

    hasPrivileges: function hasPrivileges(privileges) {
      if (lang.isArray(privileges) && privileges.length > 0) {
        return array.every(privileges, function (privilege) {
          if (privilege === 'networkanalysis') {
            return this._canPerformNetworkAnalysis();
          } else if (privilege === 'geoenrichment') {
            return this._canPerformGeoEnrichment();
          } else if (privilege === 'elevation') {
            return this._canPerformElevationAnalysis();
          } else if (privilege === 'drivetimearea') {
            return this._canPerformDriveAnalysis();
          } else if (privilege === 'planroutes') {
            return this._canPerformPlanRoutesAnalysis();
          } else if (privilege === 'od') {
            return this._canPerformODAnalysis();
          } else if (privilege === 'hydro') {
            return this._canPerformHydroAnalysis();
          } else if (privilege === 'loc') {
            return this._canPerformLocAllocationAnalysis();
          } else {
            return false;
          }
        }, this);
      } else {
        return true;
      }
    },

    _canPerformNetworkAnalysis: function _canPerformNetworkAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.asyncClosestFacility) && esriLang.isDefined(this.portalSelf.helperServices.asyncServiceArea) && esriLang.isDefined(this.portalSelf.helperServices.asyncVRP);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformGeoEnrichment: function _canPerformGeoEnrichment() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.geoenrichment);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseGeoenrichment();
    },

    _canPerformElevationAnalysis: function _canPerformElevationAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.elevation);
      return this.canPerformAnalysis() && isServiceAvailable;
    },

    _canPerformPlanRoutesAnalysis: function _canPerformPlanRoutesAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.routingUtilities) && esriLang.isDefined(this.portalSelf.helperServices.asyncVRP);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformODAnalysis: function _canPerformODAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.routingUtilities) && esriLang.isDefined(this.portalSelf.helperServices.asyncRoute);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformDriveAnalysis: function _canPerformDriveAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.routingUtilities) && esriLang.isDefined(this.portalSelf.helperServices.asyncServiceArea);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformNearestAnalysis: function _canPerformNearestAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.routingUtilities) && esriLang.isDefined(this.portalSelf.helperServices.asyncClosestFacility);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformLocAllocationAnalysis: function _canPerformLocAllocationAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.routingUtilities) && esriLang.isDefined(this.portalSelf.helperServices.asyncLocationAllocation);
      return this.canPerformAnalysis() && isServiceAvailable && this.userRole.canUseNetworkAnalysis();
    },

    _canPerformHydroAnalysis: function _canPerformHydroAnalysis() {
      var isServiceAvailable = esriLang.isDefined(this.portalSelf.helperServices.hydrology);
      return this.canPerformAnalysis() && isServiceAvailable;
    }
  });
});
//# sourceMappingURL=PortalAnalysis.js.map
