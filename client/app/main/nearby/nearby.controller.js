'use strict';

angular
  .module('transitScreenApp')
  .controller('NearbyCtrl', ['$rootScope', '$interval', '$scope', 'ScreenConfig', 'Nearby', NearbyCtrl]);

function NearbyCtrl($rootScope, $interval, $scope, ScreenConfig, Nearby) {
  var vm = this;

  angular.extend(vm, {
    config: ScreenConfig,
    routes: [],
    placemarks: [],

    isShown: isShown,
    hide: hide,

    onChangeOrder: onChangeOrder
  });

  // Refresh data every 20 seconds
  var refreshInterval = $interval(function () {
    loadNearby();
  }, 20000);
  
  // Clean up interval when scope is destroyed to prevent memory leaks
  $scope.$on('$destroy', function() {
    if (refreshInterval) {
      $interval.cancel(refreshInterval);
    }
  });

  loadNearby();

  $rootScope.$on('locationChanged', function () {
    loadNearby();
  });

  $rootScope.$on('nearbyChanged', function () {
    loadNearby();
  });

  function loadNearby() {
    Nearby.find(ScreenConfig.latLng, 1000).then(function (routes) {
      if (ScreenConfig.routeOrder) {
        var indexes = [];

        angular.forEach(routes, function (route) {
          indexes.push(route.global_route_id);
        });

        routes.sort(function (a, b) {
          var i = ScreenConfig.routeOrder.indexOf(a.global_route_id),
            j = ScreenConfig.routeOrder.indexOf(b.global_route_id);

          if (i === -1 && i === j) {
            return indexes.indexOf(a.global_route_id) - indexes.indexOf(b.global_route_id);
          } else if (i === -1) {
            return 1;
          } else if (j === -1) {
            return -1;
          }

          return i - j;
        });
      }

      vm.routes = routes;
    }).catch(function(error) {
      console.error('Error loading nearby routes:', error);
    });
  }

  function hide(route) {
    ScreenConfig.hiddenRoutes.push(route.global_route_id);
    ScreenConfig.save();
  }

  function isShown(route) {
    return ScreenConfig.hiddenRoutes.indexOf(route.global_route_id) === -1 && Nearby.hasShownDeparture(route);
  }

  function onChangeOrder() {
    var newOrder = [];

    angular.forEach(vm.routes, function (route) {
      newOrder.push(route.global_route_id);
    });

    ScreenConfig.routeOrder = newOrder;
    ScreenConfig.save();
  }
}
