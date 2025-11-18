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

export function getAlertIcon(alert: Alert): string {
	const severity = (alert.severity || 'Info').toLowerCase();

	if (severity === 'severe') {
		return 'ix:warning-octagon-filled';
	} else if (severity === 'warning') {
		return 'ix:warning-filled';
	} else {
		return 'ix:about-filled';
	}
}

function isAlertRelevant(
	alert: Alert,
	routeId: string | undefined,
	globalStopIds: Set<string>
): boolean {
	if (!routeId) return false;

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

export interface AlertContent {
	type: 'text' | 'image';
	value: string; // For images, this is the full image tag content; component extracts the ID
}

export function extractImageId(imageTagContent: string): string {
	// Image tag format: <image|mta-subway-e|(E)|14|1|2850AD/587ED8>
	// We only need the first part: mta-subway-e
	const parts = imageTagContent.split('|');
	return parts[0] || imageTagContent;
}

export function parseAlertContent(text?: string): AlertContent[] {
	if (!text) return [];

	const content: AlertContent[] = [];
	const imageRegex = /<image\|([^>]+)>/g;
	let lastIndex = 0;
	let match;

	while ((match = imageRegex.exec(text)) !== null) {
		// Add text before image
		if (match.index > lastIndex) {
			const textBefore = text.substring(lastIndex, match.index).trim();
			if (textBefore) {
				content.push({ type: 'text', value: textBefore });
			}
		}

		// Add image
		content.push({ type: 'image', value: match[1] });
		lastIndex = imageRegex.lastIndex;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		const textAfter = text.substring(lastIndex).trim();
		if (textAfter) {
			content.push({ type: 'text', value: textAfter });
		}
	}

	// If no images found, return the original text
	if (content.length === 0 && text.trim()) {
		content.push({ type: 'text', value: text.trim() });
	}

	return content;
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
