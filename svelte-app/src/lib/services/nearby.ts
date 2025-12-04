import { apiCache } from '$lib/utils/apiCache';

export interface Route {
	global_route_id: string;
	route_short_name?: string;
	route_long_name?: string;
	mode_name?: string;
	route_color: string;
	route_text_color: string;
	route_display_short_name?: {
		elements: string[];
	};
	branch_code?: string;
	itineraries?: Itinerary[];
	alerts?: Alert[];
}

export interface Itinerary {
	closest_stop?: {
		stop_name: string;
		global_stop_id?: string;
	};
	merged_headsign?: string;
	schedule_items?: ScheduleItem[];
}

export interface ScheduleItem {
	departure_time: number;
	is_real_time?: boolean;
	is_last?: boolean;
}

export interface InformedEntity {
	global_route_id?: string;
	global_stop_id?: string;
	rt_trip_id?: string;
}

export interface Alert {
	effect: string;
	severity: string;
	title?: string;
	description: string;
	created_at: number;
	informed_entities: InformedEntity[];
}

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface RateLimitError extends Error {
	retryAfter?: number;
	isRateLimit: true;
}

export interface AuthenticationError extends Error {
	isAuthError: true;
}

export interface TimeoutError extends Error {
	isTimeout: true;
}

export interface BackendError extends Error {
	isBackendError: true;
}

export type ApiError = RateLimitError | AuthenticationError | TimeoutError | BackendError;

export async function findNearbyRoutes(location: LatLng, radius: number): Promise<Route[]> {
	const params = {
		lat: location.latitude.toString(),
		lon: location.longitude.toString(),
		max_distance: radius.toString()
	};

	return apiCache.fetch(
		'/api/routes/nearby',
		params,
		async () => {
			const urlParams = new URLSearchParams(params);
			const response = await fetch(`/api/routes/nearby?${urlParams}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				// Handle rate limiting
				if (response.status === 429) {
					const retryAfter = errorData.retryAfter || 60;

					const error = new Error(
						errorData.message || 'Rate limit exceeded. Please try again later.'
					) as RateLimitError;
					error.retryAfter = retryAfter;
					error.isRateLimit = true;

					throw error;
				}

				// Handle authentication errors
				if (response.status === 401 || response.status === 403) {
					const error = new Error(
						'Authentication failed. Please check API credentials.'
					) as AuthenticationError;
					error.isAuthError = true;

					throw error;
				}

				// Handle timeout errors
				if (response.status === 504) {
					const error = new Error(
						'Request timed out. Please try again.'
					) as TimeoutError;
					error.isTimeout = true;

					throw error;
				}

				// Handle backend unavailable
				if (response.status === 503) {
					const error = new Error(
						'Service temporarily unavailable. Please try again.'
					) as BackendError;
					error.isBackendError = true;

					throw error;
				}

				// Generic error for other status codes
				throw new Error(errorData.message || errorData.error || 'Failed to fetch nearby routes');
			}

			const data = await response.json();
			return filterRoutes(data.routes || []);
		},
		30000 // 30 second cache (aligned with polling interval)
	);
}

function filterRoutes(routes: Route[]): Route[] {
	const seen = new Set<string>();
	const result: Route[] = [];

	for (const route of routes) {
		const idStr = route.global_route_id.toString();
		if (!seen.has(idStr)) {
			seen.add(idStr);
			result.push(route);
		}
	}

	return result;
}

export function hasShownDeparture(route: Route, itinerary?: Itinerary): boolean {
	if (!route) return false;

	if (itinerary) {
		if (!itinerary.schedule_items?.length) return false;

		for (const item of itinerary.schedule_items) {
			if (shouldShowDeparture(item.departure_time)) {
				return true;
			}
		}
	} else {
		if (!route.itineraries?.length) return false;

		for (const itin of route.itineraries) {
			if (hasShownDeparture(route, itin)) {
				return true;
			}
		}
	}

	return false;
}

export function shouldShowDeparture(departure: number): boolean {
	const diff = departure * 1000 - Date.now();
	return diff > 0 && diff <= 130 * 60000;
}

const stopIdCache = new WeakMap<Route[], Set<string>>();

export function extractGlobalStopIds(routes: Route[]): Set<string> {
	const cached = stopIdCache.get(routes);
	if (cached) return cached;

	const stopIds = new Set<string>();

	for (const route of routes) {
		const itineraries = route.itineraries;
		if (!itineraries) continue;

		for (const itinerary of itineraries) {
			const stopId = itinerary.closest_stop?.global_stop_id;
			if (stopId) {
				stopIds.add(stopId);
			}
		}
	}

	stopIdCache.set(routes, stopIds);
	return stopIds;
}
