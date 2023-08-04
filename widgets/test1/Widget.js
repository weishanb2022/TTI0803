define(['dojo/_base/declare', 'jimu/BaseWidget'], function (declare, BaseWidget) {
  return declare([BaseWidget], {

    // Custom widget code goes here

    baseClass: 'test1',

    postCreate: function postCreate() {
      this.inherited(arguments);
      console.log('test1::postCreate');
    }
  }