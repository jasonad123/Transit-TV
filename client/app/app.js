'use strict';

angular
  .module('transitScreenApp', [
    'ngCookies',
    'ngResource',
    'ui.router',
    'ui.select',
    'angularMoment',
    'ngDragDrop',
    'ngSanitize',
    'pascalprecht.translate',
  ])
  .config(configUiRouter)
  .config(configTranslation)
  .config(configUrlSanitizer);


function configUiRouter($urlRouterProvider, $locationProvider) {
  $urlRouterProvider.when('', initMain);
  $urlRouterProvider.otherwise('');

  $locationProvider.html5Mode(false);
  $locationProvider.hashPrefix('');
}

function configTranslation($translateProvider) {
	$translateProvider
		.useSanitizeValueStrategy('sanitize')
		.useStaticFilesLoader({
			prefix: '/assets/i18n/',
			suffix: '.json'
		})
		.registerAvailableLanguageKeys(['en', 'fr'], {
	    'en_*': 'en',
			'fr_*': 'fr'
	  })
		.determinePreferredLanguage()
		.fallbackLanguage('en');
}

function configUrlSanitizer($compileProvider, $sceDelegateProvider) {
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|transit):/);

  $sceDelegateProvider.resourceUrlWhitelist([
    // Allow same origin resource loads.
    'self',
    // Allow loading from our assets domain.  Notice the difference between * and **.
    'https://api.transitapp.com/**',
    'https://public.transitapp.com/**'
  ]);
}

function debug($rootScope) {
  $rootScope.$on("$stateChangeError", console.log.bind(console));
}

initMain.$inject = ['$state'];
function initMain($state) {
  $state.go('main');
}
