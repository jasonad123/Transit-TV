import type { Route, Alert } from './nearby';
import { extractGlobalStopIds } from './nearby';

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

function isAlertRelevant(
	alert: Alert,
	routeId: string,
	globalStopIds: Set<string>
): boolean {
	if (!alert.informed_entities || alert.informed_entities.length === 0) {
		return true;
	}

	return alert.informed_entities.some((entity) => {
		const hasRouteId = !!entity.global_route_id;
		const hasStopId = !!entity.global_stop_id;
		const hasTripId = !!entity.rt_trip_id;

		if (!hasRouteId && !hasStopId && !hasTripId) {
			return true;
		}

		const routeMatches = !hasRouteId || entity.global_route_id === routeId;
		const stopMatches = !hasStopId || globalStopIds.has(entity.global_stop_id);

		return routeMatches && stopMatches;
	});
}

export function getAllActiveAlerts(routes: Route[]): AlertData[] {
	const allAlerts: AlertData[] = [];

	if (!routes?.length) return allAlerts;

	const globalStopIds = extractGlobalStopIds(routes);

	routes.forEach((route) => {
		if (hasAlerts(route)) {
			route.alerts!.forEach((alert) => {
				if (isAlertRelevant(alert, route.global_route_id, globalStopIds)) {
					allAlerts.push({
						route,
						alert,
						isAlert: isAlertType(route)
					});
				}
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

	const hasTitle = alert.title && alert.title.trim().length > 0;
	const hasDescription = alert.description && alert.description.trim().length > 0;

	let result: string;
	if (hasTitle && hasDescription) {
		result = `${routeName}: ${alert.title} - ${alert.description}`;
	} else if (hasTitle) {
		result = `${routeName}: ${alert.title}`;
	} else if (hasDescription) {
		result = `${routeName}: ${alert.description}`;
	} else {
		result = `${routeName}: Service alert`;
	}

	console.log('[formatAlertText]', {
		routeName,
		hasTitle,
		hasDescription,
		titleLen: alert.title?.length || 0,
		descLen: alert.description?.length || 0,
		resultPreview: result.substring(0, 100)
	});

	return result;
}
