'use strict';

angular
  .module('transitScreenApp')
  .config(MainRoutes);

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

  updateLocale.$inject = ['$stateParams', '$translate'];
  function updateLocale($stateParams, $translate) {
    $translate.use($stateParams.locale);
  }
}
