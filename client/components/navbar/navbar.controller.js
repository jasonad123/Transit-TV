'use strict';

angular
  .module('transitScreenApp')
  .controller('NavbarCtrl', ['$interval', '$scope', 'ScreenConfig', NavbarCtrl]);

function NavbarCtrl($interval, $scope, ScreenConfig) {
  var vm = this;

  angular.extend(vm, {
    editConfig: editConfig,

    config: ScreenConfig,
    currentTime: Date.now(),
  });

  // Update time every second
  var timeInterval = $interval(function() {
    vm.currentTime = Date.now();
  }, 1000);

  // Clean up interval when scope is destroyed to prevent memory leaks
  $scope.$on('$destroy', function() {
    if (timeInterval) {
      $interval.cancel(timeInterval);
    }
  });

  function editConfig() {
    ScreenConfig.isEditing = !ScreenConfig.isEditing;
  }
}
