import { apiCache } from '$lib/utils/apiCache';
import type { LatLng, ApiError } from './nearby';

/**
 * Floating placemark - represents a single micromobility vehicle (bike, scooter, etc.)
 * Can be counted by type to get rough numbers
 */
export interface FloatingPlacemark {
	type: 'floating';
	id: string;
	lat: number;
	lon: number;
	vehicle_type?: string; // e.g., "bike", "scooter", "e-bike"
	provider?: string;
	// Additional fields may be present
	[key: string]: unknown;
}

/**
 * Station placemark - represents a docking station
 * Has a human-parseable string with format like "x bikes, y e-bikes, z docks"
 */
export interface StationPlacemark {
	type: 'station';
	id: string;
	lat: number;
	lon: number;
	name?: string;
	description?: string; // Human-readable string like "5 bikes, 3 e-bikes, 10 docks"
	provider?: string;
	// Additional fields may be present
	[key: string]: unknown;
}

export type Placemark = FloatingPlacemark | StationPlacemark;

export interface PlacemarksResponse {
	placemarks: Placemark[];
}

/**
 * Analyzes placemarks to extract micromobility statistics
 */
export interface MicromobilityStats {
	floatingVehicles: {
		total: number;
		byType: Record<string, number>; // e.g., { "bike": 5, "scooter": 3 }
		byProvider: Record<string, number>;
	};
	stations: {
		total: number;
		byProvider: Record<string, number>;
		descriptions: string[]; // Array of human-readable descriptions
	};
}

/**
 * Analyzes placemarks response to extract statistics
 */
export function analyzePlacemarks(response: PlacemarksResponse): MicromobilityStats {
	const stats: MicromobilityStats = {
		floatingVehicles: {
			total: 0,
			byType: {},
			byProvider: {}
		},
		stations: {
			total: 0,
			byProvider: {},
			descriptions: []
		}
	};

	if (!response.placemarks || !Array.isArray(response.placemarks)) {
		return stats;
	}

	for (const placemark of response.placemarks) {
		if (placemark.type === 'floating') {
			stats.floatingVehicles.total++;

			// Count by vehicle type
			const vehicleType = placemark.vehicle_type || 'unknown';
			stats.floatingVehicles.byType[vehicleType] =
				(stats.floatingVehicles.byType[vehicleType] || 0) + 1;

			// Count by provider
			if (placemark.provider) {
				stats.floatingVehicles.byProvider[placemark.provider] =
					(stats.floatingVehicles.byProvider[placemark.provider] || 0) + 1;
			}
		} else if (placemark.type === 'station') {
			stats.stations.total++;

			// Count by provider
			if (placemark.provider) {
				stats.stations.byProvider[placemark.provider] =
					(stats.stations.byProvider[placemark.provider] || 0) + 1;
			}

			// Collect descriptions
			if (placemark.description) {
				stats.stations.descriptions.push(placemark.description);
			}
		}
	}

	return stats;
}

/**
 * Fetches placemarks (bikes, scooters, etc.) near a location
 * @param location - The location to search around
 * @param distance - Search radius in meters (default: 500)
 * @returns Promise with placemarks data
 */
export async function fetchPlacemarks(
	location: LatLng,
	distance: number = 500
): Promise<PlacemarksResponse> {
	const params = {
		lat: location.latitude.toString(),
		lon: location.longitude.toString(),
		distance: distance.toString()
	};

	return apiCache.fetch(
		'/api/placemarks',
		params,
		async () => {
			const urlParams = new URLSearchParams(params);
			const response = await fetch(`/api/placemarks?${urlParams}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				// Handle rate limiting
				if (response.status === 429) {
					const retryAfter = errorData.retryAfter || 60;
					const error = new Error(
						errorData.message || 'Rate limit exceeded. Please try again later.'
					) as ApiError;
					(error as any).retryAfter = retryAfter;
					(error as any).isRateLimit = true;
					throw error;
				}

				// Handle authentication errors
				if (response.status === 401 || response.status === 403) {
					const error = new Error(
						'Authentication failed. Please check API credentials.'
					) as ApiError;
					(error as any).isAuthError = true;
					throw error;
				}

				// Handle timeout errors
				if (response.status === 504) {
					const error = new Error('Request timed out. Please try again.') as ApiError;
					(error as any).isTimeout = true;
					throw error;
				}

				// Handle backend unavailable
				if (response.status === 503) {
					const error = new Error(
						'Service temporarily unavailable. Please try again.'
					) as ApiError;
					(error as any).isBackendError = true;
					throw error;
				}

				// Generic error for other status codes
				throw new Error(errorData.message || errorData.error || 'Failed to fetch placemarks');
			}

			const data = await response.json();
			return data;
		}
		// Cache TTL will be determined by backend (30s default)
	);
}

/**
 * Fetches and analyzes placemarks in one call
 */
export async function fetchMicromobilityStats(
	location: LatLng,
	distance: number = 500
): Promise<MicromobilityStats> {
	const response = await fetchPlacemarks(location, distance);
	return analyzePlacemarks(response);
}
