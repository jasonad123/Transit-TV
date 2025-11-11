'use strict';

angular
  .module('transitScreenApp')
  .controller('RouteItemCtrl', RouteItemCtrl)
  .directive('routeItem', RouteItem);

function RouteItem() {
  var directive = {
    restrict: 'EA',
    templateUrl: 'directives/routeItem/routeItem.html',
    controller: 'RouteItemCtrl',
    controllerAs: 'ctrl',
    scope: {
      route: '='
    }
  };

  return directive;
}

RouteItemCtrl.$inject = ['$scope', 'Nearby', 'AlertService'];
function RouteItemCtrl($scope, Nearby, AlertService) {
  var vm = this;

  // Make route available to controller
  vm.route = $scope.route;

  angular.extend(vm, {
    useBlackText: useBlackText,
    getCellStyle: getCellStyle,

    getTime: getTime,
    getPinUrl: getPinUrl,
    getImageUrl: getImageUrl,
    getImageSize: getImageSize,
    getAlertIconUrl: getAlertIconUrl,
    getAlertText: getAlertText,
    hasSingleAlert: hasSingleAlert,

    hasAlerts: AlertService.hasAlerts,
    getAlertClass: AlertService.getAlertIcon,

    hasShownDeparture: Nearby.hasShownDeparture,
    shouldShowDeparture: shouldShowDeparture
  });

  function useBlackText(route) {
    return route.route_text_color === '000000';
  }

  function getCellStyle(route) {
    return {
      'background': '#' + route.route_color,
      'color': '#' + route.route_text_color
    };
  }

  function getImageSize(route) {
    if (route && route.route_display_short_name && route.route_display_short_name.elements) {
      return route.route_display_short_name.elements[1] ? 28 : 34;
    }

    return 0;
  }

  function getImageUrl(route, index) {
    if (route && route.route_display_short_name && route.route_display_short_name.elements && 
        route.route_display_short_name.elements[index]) {
      var hex = useBlackText(route) ? '000000' : route.route_color;
      return '/api/images/' + route.route_display_short_name.elements[index] + '.svg?primaryColor=' + hex;
    }

    return null;
  }

  function getTime(departure) {
    return new Date(departure * 1000).toISOString();
  }

  function getPinUrl() {
    // No longer needed - using CSS pin instead
    return null;
  }

  function getAlertIconUrl(route) {
    var alertType = AlertService.getAlertIcon(route);
    var iconFile = alertType === 'alert' ? 'alert-triangle.svg' : 'info-circle.svg';
    return '/assets/images/alerts/' + iconFile;
  }

  function getAlertText(route) {
    if (!route.alerts || route.alerts.length === 0) {
      return '';
    }

    var titles = route.alerts.map(function(alert) {
      return alert.title || alert.description || 'Service alert';
    });

    return titles.join('\n\n');
  }

  function hasSingleAlert(route) {
    return route && route.alerts && route.alerts.length === 1;
  }

  function shouldShowDeparture(item) {
    return Nearby.shouldShowDeparture(item.departure_time);
  }
}
