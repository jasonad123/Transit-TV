<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { config } from '$lib/stores/config';
	import type { Route, ScheduleItem, Itinerary } from '$lib/services/nearby';
	import { parseAlertContent, getAlertIcon } from '$lib/services/alerts';
	import { getMinutesUntil } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { getRelativeLuminance, getContrastRatio } from '$lib/utils/colorUtils';
	import {
		COMPLEX_LOGOS,
		COLOR_OVERRIDES,
		ROUTE_COLOR_OVERRIDES
	} from '$lib/constants/routeOverrides';

	let { route, showLongName = false }: { route: Route; showLongName?: boolean } = $props();

	let useBlackText = $derived(route.route_text_color === '000000');
	let cellStyle = $derived(`background: #${route.route_color}; color: #${route.route_text_color}`);
	let imageSize = $derived((route.route_display_short_name?.elements?.length || 0) > 1 ? 28 : 34);

	// Major color names for route display
	const MAJOR_COLOURS = new Set([
		'Red',
		'Blue',
		'Green',
		'Yellow',
		'Orange',
		'Purple',
		'Pink',
		'Brown',
		'Black',
		'White',
		'Grey',
		'Gray',
		'Silver',
		'Gold',
		'Violet',
		'Indigo',
		'Cyan',
		'Magenta'
	]);

	const MAX_LONG_NAME_LENGTH = 12;

	let miniRouteName = $derived.by(() => {
		const boxedText = route.route_display_short_name?.boxed_text;
		const shortName = route.route_short_name || '';
		let longName = route.route_long_name || '';

		// 1. Priority: Boxed Text
		if (boxedText) return boxedText;

		// 2. Priority: Recognized Major Color
		if (shortName && MAJOR_COLOURS.has(shortName)) {
			return shortName;
		}

		// 3. Process Long Name
		if (longName) {
			// A. Strip " Line"
			if (longName.endsWith(' Line')) {
				longName = longName.slice(0, -5);
			}

			// C. Length Validation
			if (longName.length <= MAX_LONG_NAME_LENGTH) {
				return longName;
			}
		}

		// 4. Final Fallback
		return shortName || longName || '';
	});

	// Check if route short name is too short (1-3 chars)
	let routeShortTooShort = $derived(
		(route.route_short_name?.length || 0) > 0 && (route.route_short_name?.length || 0) <= 3
	);

	// Check if route has adjacent text element
	function hasAdjacentText(): boolean {
		return !!(
			route.route_display_short_name?.elements &&
			route.route_display_short_name.elements.length > 1 &&
			route.route_display_short_name.elements[1]
		);
	}

	// Determine if we should show the route long name
	let shouldShowRouteLongName = $derived(
		showLongName &&
			!routeShortTooShort &&
			!route.compact_display_short_name?.route_name_redundancy &&
			isRouteIconImage() &&
			!hasAdjacentText()
	);

	// Track dark mode state
	let isDarkMode = $state(false);
	let themeObserver: MutationObserver | null = null;

	if (browser) {
		isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

		// Watch for theme changes
		themeObserver = new MutationObserver(() => {
			isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
	}

	onDestroy(() => {
		if (themeObserver) {
			themeObserver.disconnect();
			themeObserver = null;
		}
	});

	// Check if we should invert in dark mode
	let shouldInvertInDarkMode = $derived.by(() => {
		if (!isDarkMode) return false;
		const routeColorLum = getRelativeLuminance(route.route_color);
		const textColorLum = getRelativeLuminance(route.route_text_color);
		return routeColorLum < 0.05 && textColorLum > 0.8;
	});

	// Check if route has light color
	let hasLightColor = $derived(getRelativeLuminance(route.route_color) > 0.3);

	// Get image URL for route icon
	function getImageUrl(index: number): string | null {
		if (route.route_display_short_name?.elements?.[index]) {
			const iconName = route.route_display_short_name.elements[index];

			// Complex logos should not have color applied
			if (COMPLEX_LOGOS.has(iconName)) {
				return `/api/images/${iconName}.svg`;
			}

			// Check for manual color overrides
			const iconOverride = COLOR_OVERRIDES.get(iconName);
			const routeOverride = ROUTE_COLOR_OVERRIDES.get(route.global_route_id);
			let hex: string;

			// Determine which mode's color logic to use
			let useLightMode: boolean;
			if (iconOverride) {
				useLightMode = iconOverride.alwaysUseLightModeColor
					? true
					: iconOverride.alwaysUseDarkModeColor
						? false
						: !isDarkMode;
			} else if (routeOverride) {
				useLightMode = routeOverride.alwaysUseLightModeColors
					? true
					: routeOverride.alwaysUseDarkModeColors
						? false
						: !isDarkMode;
			} else {
				useLightMode = !isDarkMode;
			}

			// Apply color based on determined mode
			if (iconOverride?.color) {
				hex = iconOverride.color;
			} else if (useLightMode) {
				const routeLuminance = getRelativeLuminance(route.route_color);
				hex = useBlackText && routeLuminance < 0.15 ? '000000' : route.route_color;
			} else {
				hex = shouldInvertInDarkMode ? route.route_text_color : route.route_color;
			}

			return `/api/images/${iconName}.svg?primaryColor=${hex}`;
		}
		return null;
	}

	// Determine text color for route icon and name
	let routeDisplayColor = $derived.by(() => {
		const override = ROUTE_COLOR_OVERRIDES.get(route.global_route_id);
		const useLightMode = override?.alwaysUseLightModeColors
			? true
			: override?.alwaysUseDarkModeColors
				? false
				: !isDarkMode;

		if (useLightMode) {
			const routeLuminance = getRelativeLuminance(route.route_color);
			return useBlackText && routeLuminance < 0.15 ? '#000000' : `#${route.route_color}`;
		} else {
			return shouldInvertInDarkMode ? `#${route.route_text_color}` : `#${route.route_color}`;
		}
	});

	// Check if route uses route icon image (not text)
	function isRouteIconImage(): boolean {
		// Check if first element is an image (has getImageUrl)
		return !!getImageUrl(0);
	}

	// Group itineraries by stop
	interface ItineraryGroup {
		stopId: string;
		stopName: string;
		itineraries: Itinerary[];
	}

	function groupItinerariesByStop(): ItineraryGroup[] {
		if (!route.itineraries) return [];

		const groups = new Map<string, ItineraryGroup>();

		route.itineraries.forEach((itinerary) => {
			const stopId =
				itinerary.closest_stop?.parent_station_global_stop_id ||
				itinerary.closest_stop?.global_stop_id ||
				'unknown';
			const stopName = itinerary.closest_stop?.stop_name || 'Unknown stop';

			if (!groups.has(stopId)) {
				groups.set(stopId, {
					stopId,
					stopName,
					itineraries: []
				});
			}

			groups.get(stopId)!.itineraries.push(itinerary);
		});

		return Array.from(groups.values());
	}

	let itineraryGroups = $derived(
		$config.groupItinerariesByStop
			? groupItinerariesByStop()
			: route.itineraries?.map((itinerary) => ({
					stopId: itinerary.closest_stop?.global_stop_id || 'unknown',
					stopName: itinerary.closest_stop?.stop_name || 'Unknown stop',
					itineraries: [itinerary]
				})) || []
	);

	// Get relevant alerts for this route
	function hasRelevantAlerts(): boolean {
		return !!route.alerts && route.alerts.length > 0;
	}

	// Get most severe alert level
	function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
		if (!route.alerts || route.alerts.length === 0) return 'info';

		const hasSevere = route.alerts.some(
			(a) => a.effect === 'NO_SERVICE' || a.effect === 'DETOUR' || a.effect === 'STOP_MOVED'
		);
		if (hasSevere) return 'severe';

		const hasWarning = route.alerts.some(
			(a) =>
				a.effect === 'REDUCED_SERVICE' ||
				a.effect === 'MODIFIED_SERVICE' ||
				a.effect === 'SIGNIFICANT_DELAYS'
		);
		if (hasWarning) return 'warning';

		return 'info';
	}

	function getMostSevereAlertIcon(): string {
		const level = getMostSevereAlertLevel();
		if (level === 'severe') return 'ix:warning-octagon-filled';
		if (level === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	}
</script>

<div
	class="table-view-route"
	class:white={useBlackText && !isDarkMode}
	class:light-in-dark={isDarkMode && hasLightColor}
	style="color: {routeDisplayColor}"
>
	<!-- Route Header -->
	<h2>
		<span class="route-icon">
			{#if route.route_display_short_name?.elements}
				{#if getImageUrl(0)}
					<img class="img{imageSize}" src={getImageUrl(0)} alt="Route icon" />
				{/if}
				<span class="route-icon-text"
					>{route.route_display_short_name.elements[1] || ''}<i>{route.branch_code || ''}</i></span
				>
				{#if getImageUrl(2)}
					<img class="img{imageSize}" src={getImageUrl(2)} alt="Route icon" />
				{/if}
			{/if}
		</span>
		{#if shouldShowRouteLongName}
			<span class="route-long-name" style={cellStyle}>{miniRouteName}</span>
		{/if}
	</h2>

	<!-- Alerts with sidebar and vertical ticker -->
	{#if hasRelevantAlerts()}
		<div class="route-alert-container">
			<div
				class="alert-sidebar"
				class:severe={getMostSevereAlertLevel() === 'severe'}
				class:warning={getMostSevereAlertLevel() === 'warning'}
				class:info={getMostSevereAlertLevel() === 'info'}
				style={getMostSevereAlertLevel() === 'info' ? cellStyle : ''}
			>
				<iconify-icon icon={getMostSevereAlertIcon()}></iconify-icon>
			</div>
			<div class="route-alert-ticker" style={cellStyle}>
				<div class="alert-text scrolling">
					{#each route.alerts || [] as alert}
						{@const parsedContent = parseAlertContent(alert.title)}
						<div class="alert-content">
							{#each parsedContent as content}
								{#if content.type === 'text'}
									{content.value}
								{:else if content.type === 'image'}
									<img src="/api/images/{content.value}" alt="transit icon" class="alert-image" />
								{/if}
							{/each}
						</div>
					{/each}
					{#each route.alerts || [] as alert}
						{@const parsedContent = parseAlertContent(alert.title)}
						<div class="alert-content">
							{#each parsedContent as content}
								{#if content.type === 'text'}
									{content.value}
								{:else if content.type === 'image'}
									<img src="/api/images/{content.value}" alt="transit icon" class="alert-image" />
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Direction Cards -->
	{#each itineraryGroups as group}
		{#each group.itineraries as itinerary}
			{@const departures = (itinerary.schedule_items || []).filter(shouldShowDeparture).slice(0, 3)}
			{#if departures.length > 0}
				<div class="direction-card" style={cellStyle}>
					<div class="card-destination">
						{itinerary.merged_headsign || 'Unknown destination'}
					</div>
					<div class="card-times">
						{#each departures as item}
							<div class="time-card">
								<span class:cancelled={item.is_cancelled}>
									{getMinutesUntil(item.departure_time)}
								</span>
								{#if item.is_real_time}
									<i class="realtime"></i>
								{/if}
								<small class:last={item.is_last}
									>{item.is_last ? $_('departures.last') : 'min'}</small
								>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/each}
</div>

<style>
	.table-view-route {
		width: 100%;
		padding: 0.5em;
		margin-bottom: 1em;
		box-sizing: border-box;
		max-width: 100%;
	}

	/* Route header styles (from RouteItem) */
	h2 {
		position: relative;
		padding-left: 0.15em;
		padding-bottom: 0;
		padding-top: 0.15em;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0;
		line-height: 0.75em;
		flex-shrink: 0;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 0.3em 0;
	}

	.route-icon {
		white-space: nowrap;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.1em;
	}

	.route-icon-text {
		display: inline-block;
		vertical-align: middle;
	}

	.route-long-name {
		font-size: 0.4em;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12em;
		margin-left: 0;
		align-self: center;
		padding: 0.25em 0.35em 0.1em;
		border-radius: 0.5em;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		line-height: 1.1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.img28,
	.img34 {
		height: 0.875em;
		display: inline-block;
		vertical-align: middle;
	}

	i {
		font-style: normal;
		font-weight: 600;
	}

	/* Light text color adjustments */
	.table-view-route.white h2 {
		color: #000000;
	}

	.table-view-route.light-in-dark h2 {
		color: var(--text-primary);
	}

	.stop-name {
		font-weight: 600;
		margin: 1em 0 0.5em 0;
		padding-bottom: 0.3em;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	/* Direction card styling */
	.direction-card {
		border-radius: 0.5em;
		margin-bottom: 0.2em;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.5em 0.75em;
	}

	.card-destination {
		flex: 1;
		font-size: 1.5em;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.card-times {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		flex-shrink: 0;
		align-items: flex-end;
	}

	.time-card {
		text-align: right;
		font-size: 1.4em;
		font-weight: 700;
		white-space: nowrap;
		position: relative;
		padding-right: 0.5em;
	}

	.time-card span {
		font-size: inherit;
		font-weight: inherit;
	}

	.time-card .cancelled {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.time-card small {
		font-size: 0.7em;
		margin-left: 0.3em;
		font-weight: 400;
		opacity: 0.8;
	}

	.time-card small.last {
		font-weight: normal;
	}

	.time-card .realtime {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		margin-right: 0;
	}

	/* Real-time indicator animation (copied from RouteItem) */
	.realtime {
		width: 0.28em;
		height: 0.28em;
		position: relative;
		display: inline-block;
		margin-right: 0.2em;
		vertical-align: middle;
	}

	.realtime::before,
	.realtime::after {
		content: '';
		display: block;
		width: 9px;
		height: 9px;
		position: absolute;
		background-size: 100%;
	}

	.realtime::before {
		background-image: url('/assets/images/real_time_wave_small-w@2x.png');
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	.realtime::after {
		background-image: url('/assets/images/real_time_wave_big-w@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	@keyframes realtimeAnim {
		0%,
		25%,
		50%,
		75% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	/* Alert container with sidebar */
	.route-alert-container {
		display: flex;
		margin-top: 0.25em;
		margin-bottom: 0.5em;
		border-radius: 0.5em;
		overflow: hidden;
		height: clamp(5em, 15vh, 18em);
	}

	/* Alert sidebar with severity-based coloring */
	.alert-sidebar {
		width: 3em;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.alert-sidebar.severe {
		background-color: #e30613;
		color: #ffffff;
	}

	.alert-sidebar.warning {
		background-color: #ffa700;
		color: #000000;
	}

	/* .alert-sidebar.info inherits from inline style (cellStyle) */

	.alert-sidebar iconify-icon {
		font-size: 2em;
		width: 1em;
		height: 1em;
	}

	/* Alert ticker - vertical scroll */
	.route-alert-ticker {
		flex: 1;
		font-size: 1.5em;
		font-weight: medium;
		line-height: 1.4;
		padding: 0.5em;
		overflow: hidden;
		position: relative;
	}

	@keyframes scroll-alert-vertical {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-50%);
		}
	}

	.route-alert-ticker .alert-text {
		display: block;
		white-space: pre-line;
		word-wrap: break-word;
	}

	.route-alert-ticker .alert-text.scrolling {
		animation: scroll-alert-vertical 180s linear infinite;
		will-change: transform;
		transform: translateZ(0);
	}

	.route-alert-ticker .alert-content {
		margin-bottom: 1em;
	}

	.alert-item {
		display: inline-block;
		white-space: normal;
		max-width: 60ch;
		flex-shrink: 0;
	}

	.alert-image {
		height: 1em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}
</style>
