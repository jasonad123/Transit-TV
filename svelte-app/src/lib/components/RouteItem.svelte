<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import type { Route, ScheduleItem} from '$lib/services/nearby';
	import { parseAlertContent, extractImageId, getAlertIcon } from '$lib/services/alerts';

	let { route }: { route: Route } = $props();

	let useBlackText = $derived(route.route_text_color === '000000');
	let cellStyle = $derived(`background: #${route.route_color}; color: #${route.route_text_color}`);
	let imageSize = $derived((route.route_display_short_name?.elements?.length || 0) > 1 ? 28 : 34);

	let destinationElements: Map<number, HTMLElement> = new Map();
	let overflowingDestinations = $state<Set<number>>(new Set());
	let sharedResizeObserver: ResizeObserver | null = null;

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

	// Initialize shared ResizeObserver on mount
	if (browser) {
		sharedResizeObserver = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				const element = entry.target as HTMLElement;

				// Check if this is a destination element
				const destIndex = Array.from(destinationElements.entries()).find(([_, el]) => el === element)?.[0];
				if (destIndex !== undefined) {
					checkDestinationOverflow(destIndex, element);
					return;
				}

				// Check if this is the alert element
				if (element === alertElement) {
					checkAlertOverflow(element);
					return;
				}
			});
		});
	}

	onDestroy(() => {
		if (themeObserver) {
			themeObserver.disconnect();
			themeObserver = null;
		}
		if (sharedResizeObserver) {
			sharedResizeObserver.disconnect();
			sharedResizeObserver = null;
		}
		// Clear any pending timeouts
		destinationCheckTimeouts.forEach(timeout => clearTimeout(timeout));
		destinationCheckTimeouts.clear();
		if (alertCheckTimeout) clearTimeout(alertCheckTimeout);
	});

	// Calculate relative luminance (0-1) from hex color
	function getRelativeLuminance(hex: string): number {
		const rgb = parseInt(hex, 16);
		const r = ((rgb >> 16) & 0xff) / 255;
		const g = ((rgb >> 8) & 0xff) / 255;
		const b = (rgb & 0xff) / 255;

		// Convert to linear RGB
		const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		const rLinear = toLinear(r);
		const gLinear = toLinear(g);
		const bLinear = toLinear(b);

		// Calculate luminance
		return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
	}

	// Check if we should invert in dark mode:
	// Only invert if route_color is extremely dark (near black) AND route_text_color is light
	// This catches cases like SamTrans 292 (luminance 0.022, dark navy with white text)
	// But avoids medium-dark colors like #a81c22 (0.09), #005b95 (0.10), etc.
	let shouldInvertInDarkMode = $derived(
		getRelativeLuminance(route.route_color) < 0.05 &&
		getRelativeLuminance(route.route_text_color) > 0.5
	);

	// Check if route has light colors (for wave icon selection in dark mode)
	// Light colored routes like Orange (#f9461c) or Silver (#a7a9ac) need dark waves in dark mode
	let hasLightColor = $derived(
		getRelativeLuminance(route.route_color) > 0.3
	);

	// Complex logos that should not be recolored (contain their own internal colors)
	const COMPLEX_LOGOS = new Set(['ccjpaca-logo']);

	// Manual color overrides for specific logos
	// Options:
	//   - alwaysUseDarkModeColor: boolean - Always use the dark mode color calculation
	//   - alwaysUseLightModeColor: boolean - Always use the light mode color calculation
	//   - color: string - Always use this specific hex color (e.g., 'FF0000')
	const COLOR_OVERRIDES = new Map<string, {
		alwaysUseDarkModeColor?: boolean;
		alwaysUseLightModeColor?: boolean;
		color?: string;
	}>([
		// Example: Always use dark mode color (even in light mode)
		['wmata-metrorail-orange-v2', { alwaysUseDarkModeColor: true }],
		['wmata-metrorail-silver-v2', { alwaysUseDarkModeColor: true }],
		['wmata-metrorail-yellow-v2', { alwaysUseDarkModeColor: true }],
		['mla-j', { alwaysUseDarkModeColor: true }],
		['mla-e', { alwaysUseDarkModeColor: true }],
		['bart-y', { alwaysUseDarkModeColor: true }],
		['mta-subway-n', { alwaysUseDarkModeColor: true }],
		['mta-subway-q', { alwaysUseDarkModeColor: true }],
		['mta-subway-r', { alwaysUseDarkModeColor: true }],
		['mta-subway-w', { alwaysUseDarkModeColor: true }]
		// Example: Always use light mode color (even in dark mode)
		// ['another-logo', { alwaysUseLightModeColor: true }],
		// Example: Always use a specific color
		// ['third-logo', { color: 'FF0000' }],
	]);

	function getImageUrl(index: number): string | null {
		if (route.route_display_short_name?.elements?.[index]) {
			const iconName = route.route_display_short_name.elements[index];

			// Complex logos should not have color applied - they have their own internal colors
			if (COMPLEX_LOGOS.has(iconName)) {
				return `/api/images/${iconName}.svg`;
			}

			// Check for manual color overrides
			const override = COLOR_OVERRIDES.get(iconName);
			let hex: string;

			if (override) {
				// If a fixed color is specified
				if (override.color) {
					hex = override.color;
				}
				// If we should always use dark mode color calculation
				else if (override.alwaysUseDarkModeColor) {
					hex = shouldInvertInDarkMode ? route.route_text_color : route.route_color;
				}
				// If we should always use light mode color calculation
				else if (override.alwaysUseLightModeColor) {
					hex = useBlackText ? '000000' : route.route_color;
				}
				// Fallback to normal logic
				else if (isDarkMode) {
					hex = shouldInvertInDarkMode ? route.route_text_color : route.route_color;
				} else {
					hex = useBlackText ? '000000' : route.route_color;
				}
			} else {
				// Default color logic (no overrides)
				// In dark mode:
				//   - If route should be inverted (very dark bg + light text), use route_text_color
				//   - Otherwise use route_color (for visibility on dark background)
				// In light mode:
				//   - Use black if useBlackText, otherwise route_color
				if (isDarkMode) {
					hex = shouldInvertInDarkMode ? route.route_text_color : route.route_color;
				} else {
					hex = useBlackText ? '000000' : route.route_color;
				}
			}

			return `/api/images/${iconName}.svg?primaryColor=${hex}`;
		}
		return null;
	}

	// Determine text color for route icon and name
	let routeDisplayColor = $derived(
		isDarkMode
			? (shouldInvertInDarkMode ? `#${route.route_text_color}` : `#${route.route_color}`)
			: (useBlackText ? '#000000' : `#${route.route_color}`)
	);

	function getMinutesUntil(departure: number): number {
		return Math.round((departure * 1000 - Date.now()) / 60000);
	}

	function shouldShowDeparture(item: ScheduleItem): boolean {
		const minutes = getMinutesUntil(item.departure_time);
		return minutes >= 0 && minutes <= 120;
	}

	function getLocalStopIds(): Set<string> {
		const stopIds = new Set<string>();
		route.itineraries?.forEach((itinerary) => {
			const stopId = itinerary.closest_stop?.global_stop_id;
			if (stopId) {
				stopIds.add(stopId);
			}
		});
		return stopIds;
	}

	function isAlertRelevantToRoute(alert: any): boolean {
		if (!alert.informed_entities || alert.informed_entities.length === 0) {
			return true;
		}

		const localStopIds = getLocalStopIds();

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

	function getRelevantAlerts() {
		if (!route.alerts?.length) return [];
		return route.alerts.filter(isAlertRelevantToRoute);
	}

	function hasRelevantAlerts(): boolean {
		return getRelevantAlerts().length > 0;
	}

	function getAlertText(): string {
		const relevantAlerts = getRelevantAlerts();
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
	}

	let relevantAlertCount = $derived(getRelevantAlerts().length);

	// Get the most severe alert level for styling
	function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
		const alerts = getRelevantAlerts();
		if (!alerts.length) return 'info';

		// Check for severe first, then warning, then info
		if (alerts.some(a => (a.severity || 'Info').toLowerCase() === 'severe')) {
			return 'severe';
		}
		if (alerts.some(a => (a.severity || 'Info').toLowerCase() === 'warning')) {
			return 'warning';
		}
		return 'info';
	}

	// Get the icon for the most severe alert
	function getMostSevereAlertIcon(): string {
		const level = getMostSevereAlertLevel();
		if (level === 'severe') return 'ix:warning-octagon-filled';
		if (level === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	}

	let alertElement: HTMLElement | null = null;
	let isAlertOverflowing = $state(false);
	let shouldScrollAlert = $derived(relevantAlertCount > 1 || (relevantAlertCount === 1 && isAlertOverflowing));

	let destinationCheckTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

	function checkDestinationOverflow(index: number, element: HTMLElement) {
		if (!element) return;
		const parent = element.parentElement;
		if (!parent) return;

		// Debounce resize checks
		const existing = destinationCheckTimeouts.get(index);
		if (existing) clearTimeout(existing);

		const timeout = setTimeout(() => {
			requestAnimationFrame(() => {
				const isOverflowing = element.scrollWidth > parent.clientWidth;
				const newSet = new Set(overflowingDestinations);
				if (isOverflowing) {
					newSet.add(index);
				} else {
					newSet.delete(index);
				}
				overflowingDestinations = newSet;
			});
		}, 150);

		destinationCheckTimeouts.set(index, timeout);
	}

	let alertCheckTimeout: ReturnType<typeof setTimeout> | null = null;

	function checkAlertOverflow(element: HTMLElement) {
		if (!element) return;
		const parent = element.parentElement;
		if (!parent) return;

		// Debounce resize checks
		if (alertCheckTimeout) clearTimeout(alertCheckTimeout);

		alertCheckTimeout = setTimeout(() => {
			requestAnimationFrame(() => {
				isAlertOverflowing = element.scrollHeight > parent.clientHeight;
			});
		}, 150);
	}

	function bindDestinationElement(node: HTMLElement, index: number) {
		destinationElements.set(index, node);

		// Wait for layout to settle before checking overflow
		setTimeout(() => {
			checkDestinationOverflow(index, node);
		}, 100);

		if (sharedResizeObserver) {
			sharedResizeObserver.observe(node);
		}

		return {
			destroy() {
				if (sharedResizeObserver) {
					sharedResizeObserver.unobserve(node);
				}
				destinationElements.delete(index);
			}
		};
	}

	function bindAlertElement(node: HTMLElement) {
		alertElement = node;

		// Wait for layout to settle before checking overflow
		setTimeout(() => {
			checkAlertOverflow(node);
		}, 100);

		if (sharedResizeObserver) {
			sharedResizeObserver.observe(node);
		}

		return {
			destroy() {
				if (sharedResizeObserver) {
					sharedResizeObserver.unobserve(node);
				}
				alertElement = null;
			}
		};
	}
</script>

<div class="route" class:white={useBlackText && !isDarkMode} class:light-in-dark={isDarkMode && hasLightColor} style="color: {routeDisplayColor}">
	<h2><span class="route-icon">{#if route.route_display_short_name?.elements}{#if getImageUrl(0)}<img
				class="img{imageSize}"
				src={getImageUrl(0)}
				alt="Route icon"
			/>{/if}<span
			>{route.route_display_short_name.elements[1] || ''}<i>{route.branch_code || ''}</i></span
		>{#if getImageUrl(2)}<img
				class="img{imageSize}"
				src={getImageUrl(2)}
				alt="Route icon"
			/>{/if}{/if}</span></h2>

		{#if route.itineraries}
			{#each route.itineraries as dir, index}
				{#if dir}
					<div class="content">
						<div class="stop_name">
							<iconify-icon icon="ix:location-filled"></iconify-icon> {dir.closest_stop?.stop_name || 'Unknown stop'}
						</div>
						<div class="direction" style={cellStyle}>
							<h3>
								<span
								class="destination-text"
								class:scrolling={overflowingDestinations.has(index)}
								use:bindDestinationElement={index}
							>{dir.merged_headsign || 'Unknown destination'}</span></h3>

							<div class="time">
								{#each dir.schedule_items?.filter(shouldShowDeparture).slice(0, 3) || [] as item}
									<h4>
										<span>{getMinutesUntil(item.departure_time)}</span>
										{#if item.is_real_time}
											<i class="realtime"></i>
										{/if}
										<small class:last={item.is_last}
											>{item.is_last ? 'last' : 'min'}</small
										>
									</h4>
								{/each}
								{#each Array(Math.max(0, 3 - (dir.schedule_items?.filter(shouldShowDeparture).length || 0))) as _}
									<h4>
										<span class="inactive">&nbsp;</span>
										<small>&nbsp;</small>
									</h4>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			{/each}
		{/if}

	{#if hasRelevantAlerts()}
		<div>
			<div class="route-alert-header" class:severe={getMostSevereAlertLevel() === 'severe'} class:warning={getMostSevereAlertLevel() === 'warning'} class:info={getMostSevereAlertLevel() === 'info'} style={getMostSevereAlertLevel() === 'info' ? cellStyle : ''}>
				<span><iconify-icon icon={getMostSevereAlertIcon()}></iconify-icon> Alerts - {route.route_short_name || route.route_long_name} {route.mode_name}</span>
			</div>
			<div class="route-alert-ticker" style={cellStyle}>
				<div class="alert-text" class:scrolling={shouldScrollAlert} use:bindAlertElement>
					{#each parseAlertContent(getAlertText()) as content}
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
			</div>
		</div>
	{/if}
</div>

<style>

	.route {
		width: 100%;
		box-sizing: border-box;
		contain: layout style;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.route > div {
		padding: 0.5em 1em 0.5em;
		border-radius: 4px;
	}

	.route > div:hover {
		background: rgba(255, 255, 255, 0.6);
		cursor: move;
	}

	.route > div:last-child {
		flex-shrink: 0;
	}

	.route h2 {
		position: relative;
		padding-left: 0.26em;
		margin-bottom: 0em;
		padding-bottom: 0em;
		padding-top: 0.25em;
		display: flex;
		align-items: flex-start;
		flex-wrap: nowrap;
		gap: 0.5em;
		line-height: .9;
		flex-shrink: 0;
	}

	.route h2 .route-icon {
		white-space: nowrap;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.1em;
	}

	.route-alert-header {
		font-size: 1.5em;
		font-weight: bold;
		line-height: 1.3;
		padding: 0.75em 0.5em 0.5em;
		margin-top: 0.25em;
		border-radius: 0.3em 0.3em 0 0;
		text-align: left;
		height: 1.3em;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.3em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.route-alert-header.severe {
		background-color: #E30613;
		color: #FFFFFF;
	}

	.route-alert-header.warning {
		background-color: #FFA700;
		color: #000000;
	}

	.route-alert-header.info {
		/* Inherits from inline style (cellStyle) */
	}

	.route-alert-header span {
		display: flex;
		align-items: center;
		gap: 0.3em;
		flex-wrap: nowrap;
		line-height: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.route-alert-header iconify-icon {
		display: block;
		width: 1.25em;
		height: 1.25em;
		flex-shrink: 0;
		transform: translateY(0.05em);
	}

	.route.white .route-alert-header {
		border-bottom: 1px solid rgba(0, 0, 0, 0.2);
	}

	.route-alert-ticker {
		font-size: 1.5em;
		font-weight: medium;
		line-height: 1.4;
		padding: 0.5em;
		margin-top: 0;
		border-radius: 0 0 0.2em 0.2em;
		overflow: hidden;
		position: relative;
		height: clamp(5.5em, 15vh, 30em);
		flex-shrink: 0;
	}

	@keyframes scroll-alert-vertical {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-100%);
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
		backface-visibility: hidden;
		contain: layout paint;
	}

	.route-alert-ticker .alert-text:not(.scrolling) {
		will-change: auto;
	}

	.route-alert-ticker .alert-image {
		height: 1em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}

	.route h3 {
		font-size: 1.5em;
		padding: 0.4em 0.35em 0.3em 0.35em;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		overflow: hidden;
		position: relative;
		min-height: 1.1em;
		max-height: 1.1em;
		line-height: 1.1em;
		display: flex;
		align-items: center;
	}

	.route.white h3 {
		border-bottom: 1px solid rgba(0, 0, 0, 0.2);
	}

	@keyframes scroll-destination-horizontal {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	.route h3 .destination-text {
		display: inline-block;
		white-space: nowrap;
	}

	.route h3 .destination-text.scrolling {
		animation: scroll-destination-horizontal 150s linear infinite;
		will-change: transform;
		transform: translateZ(0);
		backface-visibility: hidden;
		contain: layout paint;
	}

	.route h3 .destination-text:not(.scrolling) {
		will-change: auto;
	}

	.route .img28 {
		height: 0.9em;
		display: block;
	}

	.route .img34 {
		height: 0.9em;
		display: block;
	}

	.route i {
		font-size: 0.8em;
		font-style: normal;
	}

	.route small {
		color: inherit;
		font-weight: lighter;
		font-size: 0.4em;
		line-height: 0.4em;
		display: block;
		margin-bottom: 0.4em;
		margin-top: 0.2em;
	}

	.route .direction {
		border-radius: 0.3em;
		margin-bottom: 0.2em;
	}

	.direction iconify-icon {
		transform: translateY(20%);
		width: 1em;
		height: 1em;
		fill: currentColor;
	}

	.route .time {
		white-space: nowrap;
		display: flex;
		/* height: clamp(6.5em, 12vh, 30em); */
		align-items: flex-start;
	}

	.route .time h4 {
		flex: 1;
		padding: 0.4em 0;
		text-align: center;
		box-sizing: border-box;
	}

	.route .time h4:nth-child(n+4) {
		display: none;
	}

	.route .time h4:not(:first-of-type) {
		position: relative;
		border-left: none;
	}

	.route .time h4:not(:first-of-type)::before {
		content: '';
		position: absolute;
		left: 0;
		top: 12.5%;
		height: 75%;
		width: 1px;
		background: rgba(255, 255, 255, 0.1);
	}

	.route.white .time h4:not(:first-of-type)::before {
		background: rgba(0, 0, 0, 0.2);
	}

	.route .stop_name {
		position: relative;
		padding-left: 1.1em;
		font-size: 1.3em;
		margin-bottom: 0.4em;
		display: block;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.route .stop_name iconify-icon {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 1em;
		height: 1em;
		fill: currentColor;
	}

	@keyframes realtimeAnim {
		0% {
			opacity: 0.5;
		}
		25% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.5;
		}
		75% {
			opacity: 0.6;
		}
		100% {
			opacity: 1;
		}
	}

	.route h4 {
		position: relative;
	}

	.route .realtime {
		width: 0.28em;
		height: 0.28em;
		position: absolute;
		margin-top: -4px;
	}

	.route .realtime::before,
	.route .realtime::after {
		content: '';
		display: block;
		width: 9px;
		height: 9px;
		position: absolute;
		background-size: 100%;
	}

	.route .realtime::before {
		background-image: url('/assets/images/real_time_wave_small-w@2x.png');
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	/* Light mode: dark waves on white routes */
	.route.white .realtime::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
	}

	/* Dark mode: dark waves on light-colored routes */
	.route.light-in-dark .realtime::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
	}

	.route .realtime::after {
		background-image: url('/assets/images/real_time_wave_big-w@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	/* Light mode: dark waves on white routes */
	.route.white .realtime::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
	}

	/* Dark mode: dark waves on light-colored routes */
	.route.light-in-dark .realtime::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
	}

	.route .inactive {
		display: block;
		background-image: url('/assets/images/inactive-w@2x.png');
		background-position: center;
		background-repeat: no-repeat;
		background-size: 16px auto;
	}

	.route.white .inactive {
		background-image: url('/assets/images/inactive@2x.png');
	}
</style>
