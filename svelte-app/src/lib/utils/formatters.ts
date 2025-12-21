/**
 * Utility functions for formatting values for display
 */

/**
 * Formats a number to a specific number of decimal places for display purposes
 * @param value - The number to format
 * @param decimalPlaces - Number of decimal places (default: 4)
 * @returns Formatted string representation
 */
export function formatNumberForDisplay(value: number, decimalPlaces: number = 4): string {
	if (typeof value !== 'number' || isNaN(value)) {
		return '';
	}
	return value.toFixed(decimalPlaces);
}

/**
 * Formats latitude and longitude coordinates for display
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @param decimalPlaces - Number of decimal places (default: 4)
 * @returns Formatted coordinate string "lat, lng"
 */
export function formatCoordinatesForDisplay(
	latitude: number,
	longitude: number,
	decimalPlaces: number = 4
): string {
	const formattedLat = formatNumberForDisplay(latitude, decimalPlaces);
	const formattedLng = formatNumberForDisplay(longitude, decimalPlaces);
	return `${formattedLat}, ${formattedLng}`;
}
