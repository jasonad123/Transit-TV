export interface Route {
	global_route_id: string;
	route_short_name?: string;
	route_long_name?: string;
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
	};
	merged_headsign?: string;
	schedule_items?: ScheduleItem[];
}

export interface ScheduleItem {
	departure_time: number;
	is_real_time?: boolean;
	is_last?: boolean;
}

export interface Alert {
	title?: string;
	description?: string;
	severity?: string;
}

export interface LatLng {
	latitude: number;
	longitude: number;
}

export async function findNearbyRoutes(location: LatLng, radius: number): Promise<Route[]> {
	const params = new URLSearchParams({
		lat: location.latitude.toString(),
		lon: location.longitude.toString(),
		max_distance: radius.toString()
	});

	const response = await fetch(`/api/routes/nearby?${params}`);
	if (!response.ok) {
		throw new Error('Failed to fetch nearby routes');
	}

	const data = await response.json();
	return filterRoutes(data.routes || []);
}

function filterRoutes(routes: Route[]): Route[] {
	const result: Route[] = [];
	const ids: string[] = [];

	routes.forEach((route) => {
		const idStr = route.global_route_id.toString();
		if (!ids.includes(idStr)) {
			result.push(route);
			ids.push(idStr);
		}
	});

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
