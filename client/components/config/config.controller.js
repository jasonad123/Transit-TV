'use strict';

angular
  .module('transitScreenApp')
  .controller('ConfigCtrl', ConfigCtrl);

function ConfigCtrl($rootScope, $state, $translate, ScreenConfig) {
  var vm = this;

  angular.extend(vm, {
    config: ScreenConfig,

    timeFormats: [{ name: '12 Hours', format: 'hh:mm A' }, { name: '24 Hours', format: 'HH:mm' }],
    locales: [{ name: 'English', lang: 'en' }, { name: 'Français', lang: 'fr' }],
    locale: $translate.instant('en'),
    onLocaleSelected: onLocaleSelected,

    isHidden: isHidden,
    unhide: unhide,

    save: save,
    duplicate: duplicate,
    closePanel: closePanel
  });

  function onLocaleSelected(locale) {
    $translate.use(locale.lang);
  }

  function isHidden(route) {
    return ScreenConfig.hiddenRoutes.indexOf(route.global_route_id) !== -1;
  }

  function unhide(route) {
    var index = ScreenConfig.hiddenRoutes.indexOf(route.global_route_id);

    if (index !== -1) {
      ScreenConfig.hiddenRoutes.splice(index, 1);
      ScreenConfig.save();
    }
  }

  function save() {
    ScreenConfig.save();
    closePanel();
  }

  function duplicate() {
    ScreenConfig.id = '';
    $state.go('main', {}, {
      notify: false,
      reload: false,
      location: 'replace',
      inherit: true
    });
  }

  function closePanel() {
    ScreenConfig.isEditing = false;
  }
}
