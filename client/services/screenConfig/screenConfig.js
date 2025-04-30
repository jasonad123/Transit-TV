'use strict';

angular
  .module('transitScreenApp')
  .factory('ScreenConfig', ScreenConfig);

function ScreenConfig($rootScope, $state, $http, $q, $cookies) {
  var vm = this,
    _deferred = null

  Object.defineProperty(vm, 'latLngStr', {
    get: function() { return vm.latLng.latitude + ', ' + vm.latLng.longitude; },
    set: function(val) {
      if (val) {
        var latLngArr = val.split(',');
        vm.latLng = {
          latitude: parseFloat(latLngArr[0].trim()),
          longitude: parseFloat(latLngArr[1].trim())
        };
      }

      $rootScope.$emit('locationChanged');
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
        angular.extend(vm, JSON.parse(loadedConfig));
        vm.isEditing = false;
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

    $cookies.put('config', JSON.stringify(config));
    deferred.resolve(true);

    return deferred.promise;
  }
}
