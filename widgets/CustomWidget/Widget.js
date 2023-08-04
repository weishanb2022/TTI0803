define(['dojo/_base/declare', 'jimu/BaseWidget'], function (declare, BaseWidget) {
  return declare([BaseWidget], {

    // Custom widget code goes here

    baseClass: 'custom-widget',

    postCreate: function postCreate() {
      this.inherited(arguments);
      console.log('CustomWidget::postCreate');
    }
  }
  // startup() {
  //   this.inherited(arguments);
  //   console.log('CustomWidget::startup');
  // },
  // onOpen() {
  //   console.log('CustomWidget::onOpen');
  // },
  // onClose(){
  //   console.log('CustomWidget::onClose');
  // },
  // onMinimize(){
  //   console.log('CustomWidget::onMinimize');
  // },
  // onMaximize(){
  //   console.log('CustomWidget::onMaximize');
  // },
  // onSignIn(credential){
  //   console.log('CustomWidget::onSignIn', credential);
  // },
  // onSignOut(){
  //   console.log('CustomWidget::onSignOut');
  // }
  // onPositionChange(){
  //   console.log('CustomWidget::onPositionChange');
  // },
  // resize(){
  //   console.log('CustomWidget::resize');
  // }
  );
});
//# sourceMappingURL=Widget.js.map
