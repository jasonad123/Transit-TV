'use strict';

angular.module('transitScreenApp')
  .factory('AlertService', function() {
    var service = {
      hasAlerts: function(route) {
        return route && route.alerts && route.alerts.length > 0;
      },

      isAlertType: function(route) {
        if (!service.hasAlerts(route)) {
          return false;
        }

        return route.alerts.some(function(alert) {
          var severity = (alert.severity || 'Info').toLowerCase();
          return severity === 'severe' || severity === 'warning';
        });
      },

      getAlertIcon: function(route) {
        return service.isAlertType(route) ? 'alert' : 'info';
      },

      getAllActiveAlerts: function(routes) {
        var allAlerts = [];

        if (!routes || routes.length === 0) {
          return allAlerts;
        }

        routes.forEach(function(route) {
          if (service.hasAlerts(route)) {
            route.alerts.forEach(function(alert) {
              allAlerts.push({
                route: route,
                alert: alert,
                isAlert: service.isAlertType(route)
              });
            });
          }
        });

        allAlerts.sort(function(a, b) {
          if (a.isAlert && !b.isAlert) return -1;
          if (!a.isAlert && b.isAlert) return 1;
          return 0;
        });

        return allAlerts;
      },

      formatAlertText: function(alertData) {
        var alert = alertData.alert;
        var route = alertData.route;
        var routeName = route.route_short_name || route.route_long_name || 'Route';
        var title = alert.title || alert.description || 'Service alert';

        return routeName + ': ' + title;
      }
    };

    return service;
  });
