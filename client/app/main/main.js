'use strict';

angular
  .module('transitScreenApp')
  .config(['$stateProvider', MainRoutes]);

function MainRoutes($stateProvider) {
  $stateProvider
    .state('main', {
      url: '/',
      templateUrl: 'app/main/nearby/nearby.html',
      controller: 'NearbyCtrl',
      controllerAs: 'ctrl',
      resolve: {
        config: loadConfig
      }
    });

  loadConfig.$inject = ['ScreenConfig'];
  function loadConfig(ScreenConfig) {
    return ScreenConfig.load();
  }
}
