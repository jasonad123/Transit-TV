/**
 * Route icon and color override configuration
 * Shared between RouteItem and TableView components
 */

/**
 * Complex logos that should not be recolored (contain their own internal colors)
 */
export const COMPLEX_LOGOS = new Set(['ccjpaca-logo']);

/**
 * Manual color overrides for specific logo icons
 * Options:
 *   - alwaysUseDarkModeColor: boolean - Always use the dark mode color calculation
 *   - alwaysUseLightModeColor: boolean - Always use the light mode color calculation
 *   - color: string - Always use this specific hex color (e.g., 'FF0000')
 */
export const COLOR_OVERRIDES = new Map<
	string,
	{
		alwaysUseDarkModeColor?: boolean;
		alwaysUseLightModeColor?: boolean;
		color?: string;
	}
>([
	// Example: Always use dark mode color (even in light mode)
	// ['wmata-metrorail-orange-v2', { alwaysUseDarkModeColor: true }],
	// ['mla-j', { alwaysUseDarkModeColor: true }],
	// ['bart-y', { alwaysUseDarkModeColor: true }],
	// ['mta-subway-n', { alwaysUseDarkModeColor: true }],
	// ['stm-metro', { alwaysUseDarkModeColor: true }],
	// Example: Always use light mode color (even in dark mode)
	// ['another-logo', { alwaysUseLightModeColor: true }],
	// Example: Always use a specific color
	// ['third-logo', { color: 'FF0000' }],
]);

/**
 * Route color overrides for route backgrounds and text
 * Options:
 *   - alwaysUseLightModeColors: boolean - Use light mode colors even in dark mode
 *   - alwaysUseDarkModeColors: boolean - Use dark mode colors even in light mode
 */
export const ROUTE_COLOR_OVERRIDES = new Map<
	string,
	{
		alwaysUseLightModeColors?: boolean;
		alwaysUseDarkModeColors?: boolean;
	}
>([
	// Certain routes with orange backgrounds need to keep black text in dark mode
	// ['GOTRANSIT:1115', { alwaysUseDarkModeColors: true }], // Route 19
	// ['GOTRANSIT:1120', { alwaysUseDarkModeColors: true }],
	['MUNI:4578', { alwaysUseDarkModeColors: true }] // Route 27
]);
