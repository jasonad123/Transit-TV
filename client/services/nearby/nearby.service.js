'use strict';

angular
  .module('transitScreenApp')
  .factory('Nearby', Nearby);

function Nearby($http, $q) {
  var vm = this;

  angular.extend(vm, {
    find: find,

    hasShownDeparture: hasShownDeparture,
    shouldShowDeparture: shouldShowDeparture,
  });

  return vm;


  function find(location, radius) {
    var deferred = $q.defer(),
      params = 'lat=' + location.latitude + '&lon=' + location.longitude + '&max_distance=' + radius;

		$http({
			method: 'GET',
			url: '/api/routes/nearby?' + params
		}).then(function (res) {
			var routes = res.data.routes;
      routes = filterRoutes(routes);

			deferred.resolve(routes);
		}, function (err) {
			deferred.reject(err);
		});

		return deferred.promise;
  }

  function hasShownDeparture(route, itinerary) {
    if (itinerary) {
      for (var j = 0; j < itinerary.schedule_items.length; j++) {
        if (shouldShowDeparture(itinerary.schedule_items[j].departure_time)) {
          return true;
        }
      }
    } else {
      for (var i = 0; i < route.itineraries.length; i++) {
        if (hasShownDeparture(route, route.itineraries[i])) {
          return true;
        }
      }
    }

    return false;
  }

  function shouldShowDeparture(departure) {
    var diff = departure * 1000 - new Date().getTime();

    return diff > 0 && diff <= 130 * 60000;
  }

  function filterRoutes(routes) {
    var result = [];
    var ids = [];

    angular.forEach(routes, function (route) {
      if (ids.indexOf(route.global_route_id + '') === -1) {
        result.push(route);
        ids.push(route.global_route_id + '');
      } else {
        console.log(route);
      }
    });

    return result;
  }
}
