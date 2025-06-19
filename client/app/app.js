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
  .config(['$urlRouterProvider', '$locationProvider', configUiRouter])
  .config(['$translateProvider', configTranslation])
  .config(['$compileProvider', '$sceDelegateProvider', configUrlSanitizer]);


function configUiRouter($urlRouterProvider, $locationProvider) {
  $urlRouterProvider.when('', initMain);
  $urlRouterProvider.otherwise('');

  $locationProvider.html5Mode(true);
  $locationProvider.hashPrefix('');
}

function configTranslation($translateProvider) {
	$translateProvider
		.useSanitizeValueStrategy('sanitize')
		.translations('en', {
			'TITLE': 'Transit TV',
			'SETTINGS': 'Settings',
			'CLOSE': 'Close',
			'SAVE': 'Save',
			'CANCEL': 'Cancel',
			'hide': 'Hide',
			'configuration': 'Configuration',
			'location': 'Location',
			'lat, lng': 'Latitude, Longitude',
			'title': 'Title',
			'time_format': 'Time Format',
			'language': 'Language',
			'hidden_lines': 'Hidden Lines',
			'no_hidden_lines': 'No hidden lines',
			'screen_url': 'Screen URL',
			'share_url': 'Share this URL to display this screen configuration:',
			'duplicate': 'Duplicate',
			'last': 'Last'
		})
		.translations('fr', {
			'TITLE': 'Transit TV',
			'SETTINGS': 'Paramètres',
			'CLOSE': 'Fermer',
			'SAVE': 'Sauvegarder',
			'CANCEL': 'Annuler',
			'hide': 'Cacher',
			'configuration': 'Configuration',
			'location': 'Emplacement',
			'lat, lng': 'Latitude, Longitude',
			'title': 'Titre',
			'time_format': 'Format de l\'heure',
			'language': 'Langue',
			'hidden_lines': 'Lignes cachées',
			'no_hidden_lines': 'Aucune ligne cachée',
			'screen_url': 'URL de l\'écran',
			'share_url': 'Partagez cette URL pour afficher cette configuration d\'écran:',
			'duplicate': 'Dupliquer',
			'last': 'Dernier'
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

// Debug function for state change errors
debug.$inject = ['$rootScope'];
function debug($rootScope) {
  $rootScope.$on("$stateChangeError", console.log.bind(console));
}

initMain.$inject = ['$state'];
function initMain($state) {
  $state.go('main');
}
