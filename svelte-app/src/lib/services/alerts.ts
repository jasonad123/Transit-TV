import type { Route, Alert } from './nearby';

export interface AlertData {
	route: Route;
	alert: Alert;
	isAlert: boolean;
}

export function hasAlerts(route?: Route): boolean {
	return !!route && !!route.alerts && route.alerts.length > 0;
}

export function isAlertType(route?: Route): boolean {
	if (!hasAlerts(route)) return false;

	return route!.alerts!.some((alert) => {
		const severity = (alert.severity || 'Info').toLowerCase();
		return severity === 'severe' || severity === 'warning';
	});
}

export function getAlertIcon(route?: Route): 'alert' | 'info' {
	return isAlertType(route) ? 'alert' : 'info';
}

export function getAllActiveAlerts(routes: Route[]): AlertData[] {
	const allAlerts: AlertData[] = [];

	if (!routes?.length) return allAlerts;

	routes.forEach((route) => {
		if (hasAlerts(route)) {
			route.alerts!.forEach((alert) => {
				allAlerts.push({
					route,
					alert,
					isAlert: isAlertType(route)
				});
			});
		}
	});

	allAlerts.sort((a, b) => {
		if (a.isAlert && !b.isAlert) return -1;
		if (!a.isAlert && b.isAlert) return 1;
		return 0;
	});

	return allAlerts;
}

export function formatAlertText(alertData: AlertData): string {
	const { alert, route } = alertData;
	const routeName = route.route_short_name || route.route_long_name || 'Route';
	const title = alert.title || alert.description || 'Service alert';
	return `${routeName}: ${title}`;
}
