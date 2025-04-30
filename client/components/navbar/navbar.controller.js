'use strict';

angular
  .module('transitScreenApp')
  .controller('NavbarCtrl', NavbarCtrl);

function NavbarCtrl($interval, ScreenConfig) {
  var vm = this;

  angular.extend(vm, {
    editConfig: editConfig,

    config: ScreenConfig,
    currentTime: Date.now(),
  });

  $interval(function() {
    vm.currentTime = Date.now();
  }, 1000);

  function editConfig() {
    ScreenConfig.isEditing = !ScreenConfig.isEditing;
  }
}
