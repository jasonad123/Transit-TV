'use strict';

angular
  .module('transitScreenApp')
  .factory('ScreenConfig', ['$rootScope', '$state', '$http', '$q', '$cookies', ScreenConfig]);

function ScreenConfig($rootScope, $state, $http, $q, $cookies) {
  var vm = this,
    _deferred = null;

  Object.defineProperty(vm, 'latLngStr', {
    get: function() { 
      return vm.latLng.latitude + ', ' + vm.latLng.longitude; 
    },
    set: function(val) {
      if (val) {
        var latLngArr = val.split(',');
        if (latLngArr.length === 2) {
          var lat = parseFloat(latLngArr[0].trim());
          var lng = parseFloat(latLngArr[1].trim());
          
          if (!isNaN(lat) && !isNaN(lng)) {
            vm.latLng = {
              latitude: lat,
              longitude: lng
            };
            $rootScope.$emit('locationChanged');
          }
        }
      }
    }
  });

  angular.extend(vm, {
    id: '',

    isEditing: true,
    title: '',
    routeOrder: [],
    hiddenRoutes: [],
    latLng: {
      latitude: 40.724029430769484,
      longitude: -74.00022736495859
    },

    timeFormat: 'HH:mm',

    load: load,
    save: save
  });

  return vm;


  function load() {
    if (!_deferred) {
      _deferred = $q.defer();

      var loadedConfig = $cookies.get('config');
      if (loadedConfig) {
        try {
          var parsedConfig = JSON.parse(loadedConfig);
          angular.extend(vm, parsedConfig);
          vm.isEditing = false;
        } catch (e) {
          console.error('Error parsing saved config:', e);
          // Continue with default config
        }
      }

      _deferred.resolve(vm);
    }

    return _deferred.promise;
  }

  function save() {
    var deferred = $q.defer(),
      config = {};

    angular.extend(config, vm);
    delete config.isEditing;

    try {
      $cookies.put('config', JSON.stringify(config));
      deferred.resolve(true);
    } catch (e) {
      console.error('Error saving config:', e);
      deferred.reject(e);
    }

    return deferred.promise;
  }
}
