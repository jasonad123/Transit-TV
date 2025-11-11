'use strict';

angular
  .module('transitScreenApp')
  .controller('AlertTickerCtrl', AlertTickerCtrl)
  .directive('alertTicker', AlertTicker);

function AlertTicker() {
  var directive = {
    restrict: 'E',
    templateUrl: 'directives/alertTicker/alertTicker.html',
    controller: 'AlertTickerCtrl',
    controllerAs: 'ctrl',
    scope: {
      alerts: '='
    }
  };

  return directive;
}

AlertTickerCtrl.$inject = ['$scope', 'AlertService'];
function AlertTickerCtrl($scope, AlertService) {
  var vm = this;

  angular.extend(vm, {
    alerts: $scope.alerts,
    formatAlert: AlertService.formatAlertText
  });

  $scope.$watch('alerts', function(newVal) {
    vm.alerts = newVal;
  });
}
