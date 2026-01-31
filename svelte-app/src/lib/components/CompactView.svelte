<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { config } from '$lib/stores/config';
	import RouteIcon from './RouteIcon.svelte';
	import type { Route, ScheduleItem, Itinerary } from '$lib/services/nearby';
	import { parseAlertContent, extractImageId, getAlertIcon } from '$lib/services/alerts';
	import { getMinutesUntil } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { getRelativeLuminance } from '$lib/utils/colorUtils';
	import {
		COMPLEX_LOGOS,
		COLOR_OVERRIDES,
		ROUTE_COLOR_OVERRIDES
	} from '$lib/constants/routeOverrides';

	let { route, showLongName = false }: { route: Route; showLongName?: boolean } = $props();

	let useBlackText = $derived(route.route_text_color === '000000');
	let cellStyle = $derived(`background: #${route.route_color}; color: #${route.route_text_color}`);
	let imageSize = $derived((route.route_display_short_name?.elements?.length || 0) > 1 ? 28 : 34);

	// Smart route name for alerts (transplanted from RouteItem)
	let alertRouteName = $derived.by(() => {
		const shortName = route.route_short_name;
		if (shortName && /^[A-Z]$/.test(shortName) && route.route_network_name === 'SEPTA Metro') {
			return '';
		}

		if (route.route_long_name?.includes('Line')) {
			return route.route_long_name;
		}

		if (route.route_network_name === 'Long Island Rail Road' && route.route_long_name) {
			return route.route_long_name;
		}

		if (route.route_network_name === 'GO Transit' && route.route_long_name) {
			return route.route_long_name;
		}

		if (route.route_network_name === 'Capitol Corridor' && route.route_long_name) {
			return route.route_long_name;
		}

		const routeName = route.route_short_name || route.route_long_name;

		if (routeName && /^\d+$/.test(routeName)) {
			const modeName = route.mode_name?.toLowerCase() || '';
			if (
				!modeName.includes('train') &&
				!modeName.includes('subway') &&
				!modeName.includes('metro') &&
				!modeName.includes('streetcar') &&
				!modeName.includes('light rail')
			) {
				return `Route ${routeName}`;
			}
		}

		if (routeName && /^[A-Z]+$/.test(routeName)) {
			const modeName = route.mode_name?.toLowerCase() || '';
			if (modeName.includes('rapidride')) {
				return '';
			}
		}

		if (routeName && /^[a-zA-Z]+$/.test(routeName)) {
			const modeName = route.mode_name?.toLowerCase() || '';
			if (modeName.includes('citylink')) {
				return '';
			}
		}

		if (routeName && /^\d+$/.test(routeName)) {
			const modeName = route.mode_name?.toLowerCase() || '';
			const ttsName = route.tts_short_name?.toLowerCase() || '';
			if (
				modeName.includes('subway') &&
				ttsName.startsWith('line') &&
				route.route_network_name === 'TTC'
			) {
				return '';
			}
		}

		if (route.mode_name?.includes('Muni')) {
			return '';
		}

		return routeName;
	});

	// Smart mode name for alerts (transplanted from RouteItem)
	let alertModeName = $derived.by(() => {
		const modeName = route.mode_name;
		const shortName = route.route_short_name;

		if (shortName && /^[A-Z]$/.test(shortName) && route.route_network_name === 'SEPTA Metro') {
			return `${shortName} Line`;
		}

		if (route.route_long_name?.includes('Line')) {
			return '';
		}

		if (route.route_network_name === 'Long Island Rail Road') {
			return '';
		}

		if (route.route_network_name === 'ACE') {
			return '';
		}

		if (route.route_network_name === 'Capitol Corridor') {
			return '';
		}

		if (modeName && (modeName === shortName || modeName === route.route_long_name)) {
			return '';
		}

		if (modeName?.includes('Muni') && shortName && route.route_long_name) {
			return `${shortName} ${route.route_long_name}`;
		}

		if (modeName?.includes('Metro') || modeName?.includes('Light Rail')) {
			return 'Line';
		}

		if (modeName?.includes('MAX') || modeName?.includes('REM')) {
			return '';
		}

		if (shortName?.includes('SeaBus')) {
			return '';
		}

		if (modeName?.includes('Subway') && shortName) {
			const ttsName = route.tts_short_name?.toLowerCase() || '';
			if (ttsName.startsWith('line') && route.route_network_name === 'TTC') {
				return `Line ${shortName}`;
			}
			if (ttsName.endsWith('line') && route.route_network_name === 'BART') {
				return 'Line';
			}
			if (ttsName.includes('train') && route.route_network_name === 'NYC Subway') {
				return 'Train';
			}
		}

		if (modeName?.includes('Bus')) {
			return '';
		}

		if (shortName && /^[A-Z]+$/.test(shortName)) {
			const modeNameLower = route.mode_name?.toLowerCase() || '';
			if (modeNameLower.includes('rapidride')) {
				return `RapidRide ${shortName}`;
			}
		}

		if (shortName && /^[a-zA-Z]+$/.test(shortName)) {
			const modeNameLower = route.mode_name?.toLowerCase() || '';
			if (modeNameLower.includes('citylink')) {
				return `CityLink ${shortName}`;
			}
		}

		if (modeName === 'Commuter Rail') {
			return 'Line';
		}

		return modeName;
	});

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

	// Check if route short name is too short
	let routeShortTooShort = $derived((route.route_short_name?.length || 0) < 3);

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
		return routeColorLum < 0.05 && textColorLum > 0.5;
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

	let itineraryGroups = $derived.by(() => {
		const start = performance.now();
		const result = $config.groupItinerariesByStop
			? groupItinerariesByStop()
			: route.itineraries?.map((itinerary) => ({
					stopId: itinerary.closest_stop?.global_stop_id || 'unknown',
					stopName: itinerary.closest_stop?.stop_name || 'Unknown stop',
					itineraries: [itinerary]
				})) || [];
		const end = performance.now();
		if (end - start > 10) {
			console.log(
				`[CompactView] itineraryGroups calc took ${end - start}ms, grouped=${$config.groupItinerariesByStop}`
			);
		}
		return result;
	});

	// Alert Relevance Logic (transplanted from RouteItem)
	// PERFORMANCE FIX: Cache stop IDs to avoid creating new Set on every alert check
	let localStopIds = $derived.by(() => {
		const stopIds = new Set<string>();
		route.itineraries?.forEach((itinerary) => {
			const stopId = itinerary.closest_stop?.global_stop_id;
			if (stopId) {
				stopIds.add(stopId);
			}
		});
		return stopIds;
	});

	function isAlertRelevantToRoute(alert: any): boolean {
		if (!alert.informed_entities || alert.informed_entities.length === 0) {
			return true;
		}

		return alert.informed_entities.some((entity: any) => {
			const hasRouteId = !!entity.global_route_id;
			const hasStopId = !!entity.global_stop_id;

			if (!hasRouteId && !hasStopId) {
				return true;
			}

			const routeMatches = !hasRouteId || entity.global_route_id === route.global_route_id;
			const stopMatches = !hasStopId || localStopIds.has(entity.global_stop_id);

			return routeMatches && stopMatches;
		});
	}

	// PERFORMANCE FIX: Cache filtered alerts instead of calling filter multiple times
	let relevantAlerts = $derived.by(() => {
		if (!route.alerts?.length) return [];
		return route.alerts.filter(isAlertRelevantToRoute);
	});

	// PERFORMANCE FIX: Cache alert text to avoid regenerating on every render
	let alertText = $derived.by(() => {
		if (!relevantAlerts.length) return '';

		return relevantAlerts
			.map((alert) => {
				const hasTitle = alert.title && alert.title.trim().length > 0;
				const hasDescription = alert.description && alert.description.trim().length > 0;

				if (hasTitle && hasDescription) {
					return `${alert.title}\n\n${alert.description}`;
				} else if (hasTitle) {
					return alert.title;
				} else if (hasDescription) {
					return alert.description;
				} else {
					return $_('alerts.default');
				}
			})
			.join('\n\n---\n\n');
	});

	let relevantAlertCount = $derived(relevantAlerts.length);

	// PERFORMANCE FIX: Cache severity level instead of recomputing multiple times per template render
	let mostSevereLevel = $derived.by(() => {
		if (!relevantAlerts.length) return 'info';

		// Check for severe first, then warning, then info
		if (relevantAlerts.some((a) => (a.severity || 'Info').toLowerCase() === 'severe')) {
			return 'severe';
		}
		if (relevantAlerts.some((a) => (a.severity || 'Info').toLowerCase() === 'warning')) {
			return 'warning';
		}
		return 'info';
	});

	// PERFORMANCE FIX: Cache icon based on severity level
	let mostSevereIcon = $derived.by(() => {
		if (mostSevereLevel === 'severe') return 'ix:warning-octagon-filled';
		if (mostSevereLevel === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	});
</script>

<div
	class="table-view-route"
	class:white={useBlackText && !isDarkMode}
	class:light-in-dark={isDarkMode && hasLightColor}
	style="color: {routeDisplayColor}"
>
	<h2>
		<RouteIcon {route} {showLongName} compact={true} />
	</h2>

	<!-- Direction Cards -->
	{#each itineraryGroups as group}
		{#each group.itineraries as itinerary}
			{@const departures = (itinerary.schedule_items || []).filter(shouldShowDeparture).slice(0, 3)}
			{#if departures.length > 0}
				<div
					class="direction-card"
					style="{cellStyle}; --route-color: #{route.route_color}; --route-text-color: #{route.route_text_color}"
				>
					<div class="card-info">
						<div class="card-destination">
							{#if itinerary.branch_code}<span class="branch-code-badge"
									>{itinerary.branch_code}</span
								>{/if}{itinerary.merged_headsign || 'Unknown destination'}
						</div>
						<div class="card-stop-location">
							<span>{group.stopName}</span>
						</div>
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
						{#each Array(Math.max(0, 3 - departures.length)) as _}
							<div class="time-card inactive">
								<span>&nbsp;</span>
								<small>&nbsp;</small>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/each}

	<!-- Alerts with sidebar and vertical ticker -->
	{#if relevantAlerts.length > 0}
		<div class="route-alert-container" class:grouped-alerts={$config.groupItinerariesByStop}>
			<div
				class="alert-sidebar"
				class:severe={mostSevereLevel === 'severe'}
				class:warning={mostSevereLevel === 'warning'}
				class:info={mostSevereLevel === 'info'}
				style={mostSevereLevel === 'info' ? cellStyle : ''}
			>
				<iconify-icon icon={mostSevereIcon}></iconify-icon>
			</div>
			<div class="route-alert-ticker" style={cellStyle}>
				<div class="alert-text scrolling">
					{#each relevantAlerts as alert}
						{@const fullText =
							alert.title && alert.description
								? `${alert.title}\n\n${alert.description}`
								: alert.title || alert.description || $_('alerts.default')}
						{@const parsedContent = parseAlertContent(fullText)}
						<div class="alert-content">
							{#each parsedContent as content}
								{#if content.type === 'text'}
									{content.value}
								{:else if content.type === 'image'}
									<img
										src="/api/images/{extractImageId(content.value)}"
										alt="transit icon"
										class="alert-image"
									/>
								{/if}
							{/each}
						</div>
					{/each}
					{#each relevantAlerts as alert}
						{@const fullText =
							alert.title && alert.description
								? `${alert.title}\n\n${alert.description}`
								: alert.title || alert.description || $_('alerts.default')}
						{@const parsedContent = parseAlertContent(fullText)}
						<div class="alert-content">
							{#each parsedContent as content}
								{#if content.type === 'text'}
									{content.value}
								{:else if content.type === 'image'}
									<img
										src="/api/images/{extractImageId(content.value)}"
										alt="transit icon"
										class="alert-image"
									/>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.table-view-route {
		width: 100%;
		padding: 0.3em;
		margin-bottom: 0.3em;
		box-sizing: border-box;
		max-width: 100%;

		display: flex;
		flex-direction: column;
	}

	.table-view-route > div:last-child {
		flex-shrink: 0;
		/* padding: 0 0.25em 0; */
	}

	/* Route header styles (from RouteItem) */
	h2 {
		position: relative;
		padding-left: 0.15em;
		padding-bottom: -0.2em;
		padding-top: 0.25em;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0;
		line-height: 0.82em;
		flex-shrink: 0;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 0.3em 0;
	}

	/* Light text color adjustments */
	.table-view-route.white h2 {
		color: #000000;
	}

	.table-view-route.light-in-dark h2 {
		color: var(--text-primary);
	}

	/* Direction card styling */
	.direction-card {
		border-radius: 0.5em;
		margin-bottom: 0.2em;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1em;
		padding: 0.5em 0.75em;
	}

	.card-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.card-destination {
		font-size: 1.65em;
		padding-top: 0.1em;
		font-weight: 600;
		display: block;
		overflow-wrap: normal;
		word-break: normal;
		min-width: 0;
	}

	.card-destination .branch-code-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--route-color), white 30%);
		color: inherit;
		border-radius: 40rem;
		padding: 5px 0.5em;
		font-size: 1em;
		font-weight: 800;
		line-height: 1;
		min-width: 1.35em;
		z-index: 3;
		flex-shrink: 1;
		transform: translateY(-0.1em);
		font-family: 'Red Hat Display Variable', Arial, Helvetica, sans-serif;
		box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
		margin-right: 0.35em;
	}

	.card-stop-location {
		font-size: 1.25em;
		display: flex;
		align-items: flex-start;
		gap: 0.3em;
		margin: 0.2em 0 0 0;
		opacity: 0.8;
		overflow-wrap: break-word;
		word-break: break-word;
		min-width: 0;
	}

	.card-stop-location span {
		overflow-wrap: break-word;
		word-break: break-word;
		flex: 1;
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
		text-align: left;
		font-size: 1.5em;
		font-weight: 700;
		white-space: nowrap;
		position: relative;
		padding-right: 0.5em;
		padding-top: 0.1em;
	}

	.time-card span {
		font-weight: inherit;
	}

	.time-card:first-child span {
		font-size: 1.5em;
		font-weight: inherit;
	}

	.time-card .cancelled {
		text-decoration: line-through;
		opacity: 0.8;
	}

	.time-card small {
		font-size: 0.7em;
		margin-left: 0.2em;
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
		transform: translateX(35%) translateY(-70%);
		margin-right: 0;
	}

	.time-card.inactive {
		opacity: 0.5;
	}

	.time-card.inactive span {
		display: inline-block;
		background-image: url('/assets/images/inactive-w@2x.png');
		background-position: center;
		background-repeat: repeat-x;
		background-size: 20px;
	}

	.table-view-route.white .time-card.inactive span {
		background-image: url('/assets/images/inactive@2x.png');
	}

	/* Real-time indicator animation (copied from RouteItem) */
	.realtime {
		width: 0.6em;
		height: 0.6em;
		position: relative;
		display: inline-block;
		margin-right: 0.3em;
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

	/* Light mode: dark waves on white routes */
	.table-view-route.white .realtime::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
	}

	/* Dark mode: dark waves on light-colored routes */
	.table-view-route.light-in-dark .realtime::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
	}

	.realtime::after {
		background-image: url('/assets/images/real_time_wave_big-w@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	/* Light mode: dark waves on white routes */
	.table-view-route.white .realtime::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
	}

	/* Dark mode: dark waves on light-colored routes */
	.table-view-route.light-in-dark .realtime::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
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
		flex-shrink: 0;
		/* Height rules consolidated in app.css */
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
		height: clamp(5em, 8vh, 10em);
		flex-shrink: 0;
	}

	/* Adjust alert height for portrait displays */
	@media (orientation: portrait) {
		.route-alert-ticker {
			height: clamp(5em, 8vh, 10em);
		}
	}

	/* Increase alert ticker height when stop grouping is enabled */
	.route-alert-container.grouped-alerts .route-alert-ticker {
		height: clamp(5em, 19.5vh, 10em);
	}

	@media (orientation: portrait) {
		.route-alert-container.grouped-alerts .route-alert-ticker {
			height: clamp(5em, 7vh, 15em);
		}
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

	.alert-image {
		height: 1em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}
</style>
