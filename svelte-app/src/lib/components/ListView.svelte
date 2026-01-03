<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { config } from '$lib/stores/config';
	import RouteIcon from './RouteIcon.svelte';
	import type { Route } from '$lib/services/nearby';
	import { getMinutesUntil } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { getRelativeLuminance } from '$lib/utils/colorUtils';

	let { route, showLongName = false }: { route: Route; showLongName?: boolean } = $props();

	interface ItineraryGroup {
		stopId: string;
		stopName: string;
		itineraries: any[];
	}

	let useBlackText = $derived(route.route_text_color === '000000');
	let isDarkMode = $state(false);
	let hasLightColor = $derived(getRelativeLuminance(route.route_color) > 0.3);
	let themeObserver: MutationObserver | null = null;

	if (typeof document !== 'undefined') {
		isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

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

	// Itinerary grouping logic (copied from RouteItem)
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

	// Alert handling (copied from RouteItem)
	function getLocalStopIds(): Set<string> {
		const stopIds = new Set<string>();
		route.itineraries?.forEach((itinerary) => {
			if (itinerary.closest_stop?.global_stop_id) {
				stopIds.add(itinerary.closest_stop.global_stop_id);
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

	function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
		const alerts = getRelevantAlerts();
		if (!alerts.length) return 'info';

		if (alerts.some((a) => (a.severity || 'Info').toLowerCase() === 'severe')) {
			return 'severe';
		}
		if (alerts.some((a) => (a.severity || 'Info').toLowerCase() === 'warning')) {
			return 'warning';
		}
		return 'info';
	}

	function getMostSevereAlertIcon(): string {
		const level = getMostSevereAlertLevel();
		if (level === 'severe') return 'ix:warning-octagon-filled';
		if (level === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	}

	// Wave icon selection based on route colors
	function getWaveIcon(): string {
		// Dark routes need white waves
		if (getRelativeLuminance(route.route_color) < 0.3) {
			return '/assets/images/real_time_wave_small-w@2x.png';
		}
		// Light routes need dark waves
		return '/assets/images/real_time_wave_small@2x.png';
	}
</script>

<div
	class="list-view"
	class:white={useBlackText && !isDarkMode}
	class:light-in-dark={isDarkMode && hasLightColor}
	style="color: #{route.route_color}"
>
	<!-- Route header -->
	<h2 class="list-header">
		<RouteIcon {route} {showLongName} compact={true} />
	</h2>

	<!-- Itinerary groups (stops and departures) -->
	{#if itineraryGroups.length > 0}
		{#each itineraryGroups as group, groupIndex}
			<!-- Stop name header -->
			<div class="stop-header">
				<iconify-icon icon="ix:location-filled"></iconify-icon>
				{group.stopName}
			</div>

			<!-- Destinations table -->
			<div class="table-container">
				<div class="table-header">
					<div class="destination-col">Destination</div>
					<div class="times-col">Arrives in (min)</div>
				</div>

				{#each group.itineraries as itinerary}
					<div class="destination-row">
						<div class="destination-col">
							{itinerary.headsign}
						</div>
						<div class="times-col">
							<div class="times-list">
								{#each itinerary.schedule_items
									?.filter(shouldShowDeparture)
									.slice(0, 3) || [] as item, itemIndex}
									<span class="time-item" class:cancelled={item.is_cancelled}>
										{#if item.is_real_time}
											<img
												src={getWaveIcon()}
												alt="realtime"
												class="wave-icon"
												class:wave-dark={isDarkMode && hasLightColor}
											/>
										{/if}
										{getMinutesUntil(item.departure_time)}{#if item.is_last}*{/if}
									</span>
									{#if itemIndex < (itinerary.schedule_items?.filter(shouldShowDeparture).length || 0) - 1}
										<span class="separator">,</span>
									{/if}
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if groupIndex < itineraryGroups.length - 1}
				<div class="group-divider"></div>
			{/if}
		{/each}
	{/if}

	<!-- Alerts section -->
	{#if hasRelevantAlerts()}
		<div class="alert-section">
			<div
				class="alert-header"
				class:severe={getMostSevereAlertLevel() === 'severe'}
				class:warning={getMostSevereAlertLevel() === 'warning'}
				class:info={getMostSevereAlertLevel() === 'info'}
				style={getMostSevereAlertLevel() === 'info' ? '' : `border-color: #${route.route_color}`}
			>
				<iconify-icon icon={getMostSevereAlertIcon()}></iconify-icon>
				<span class="alert-title">
					{$_('alerts.title')}
				</span>
			</div>

			<div class="alert-ticker">
				<div class="alert-content">
					{#each [0, 1] as _}
						<div class="alert-text">
							{getAlertText()}
						</div>
						{#if relevantAlertCount > 1 || (relevantAlertCount === 1 && getAlertText().length > 100)}
							<div class="separator-line">---</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.list-view {
		display: flex;
		flex-direction: column;
		border: none;
		border-radius: 0.4em;
		overflow: hidden;
		font-size: 1.5em;
	}

	.list-view.white {
		border-color: rgba(0, 0, 0, 0.1);
	}

	h2.list-header {
		padding: 0.25em 0em 0.2em 0.2em;
		background: transparent;
		font-size: 2em;
		line-height: 0.9;
		opacity: 0.9;
	}

	.list-view.white h2.list-header {
		border-color: rgba(0, 0, 0, 0.1);
		background: rgba(0, 0, 0, 0.02);
	}

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
		margin: 0;
	}

	.stop-header {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.3em 0.6em;
		font-size: 0.75em;
		font-weight: 400;
		background: rgba(255, 255, 255, 0.05);
		border-bottom: none;
	}

	.list-view.white .stop-header {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.stop-header iconify-icon {
		width: 0.8em;
		height: 0.8em;
		flex-shrink: 0;
		transform: translateY(-0.2em);
		fill: currentColor;
	}

	.table-container {
		display: flex;
		flex-direction: column;
	}

	.table-header {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.8em;
		padding: 0.3em 0.6em;
		font-size: 0.8em;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.08);
		border-bottom: none;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	/* .list-view.white .table-header {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.1);
	} */

	.destination-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.8em;
		padding: 0.3em 0.6em;
		font-size: 0.8em;
		align-items: center;

	}

	.list-view.white .destination-row {
		border-color: rgba(0, 0, 0, 0.05);
	}

	.destination-col {
		min-width: 0;
		display: block;
		overflow-wrap: break-word;
		font-weight: 600;
		color: var(--text-secondary)
	}

	.times-col {
		flex-shrink: 0;
		text-align: right;
		color: var(--text-primary)
	}

	.table-header .times-col,
	.table-header .destination-col {
		font-weight: 600;
		font-size: 0.75em;
		color: var(--text-tertiary);
	}

	.times-list {
		display: flex;
		align-items: center;
		gap: 0.2em;
		white-space: nowrap;
		font-feature-settings: 'tnum';
		font-size: 1.2em;
		font-weight: 700;
	}

	.time-item {
		display: inline-flex;
		align-items: center;
		gap: 0.15em;
		position: relative;
	}

	.time-item.cancelled {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.time-item::before,
	.time-item::after {
		content: '';
		display: block;
		width: 7px;
		height: 7px;
		position: absolute;
		top: -2px;
		right: -6px;
		background-size: 100%;
	}

	.time-item::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	.time-item::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	/* Light mode: dark waves on white routes */
	.list-view.white .time-item::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	.list-view.white .time-item::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	/* Dark mode: dark waves on light-colored routes */
	.list-view.light-in-dark .time-item::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	.list-view.light-in-dark .time-item::after {
		background-image: url('/assets/images/real_time_wave_big@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	.wave-icon {
		display: none;
	}

	.wave-icon.wave-dark {
		filter: brightness(0.3);
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

	.separator {
		opacity: 0.5;
		font-size: 0.8em;
	}

	.group-divider {
		display: none;
	}


	.alert-section {
		margin-top: 0;
		border-top: none;
	}

	.list-view.white .alert-section {
		border-color: rgba(0, 0, 0, 0.15);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.25em 0.5em;
		font-size: 0.85em;
		font-weight: 600;
		border-bottom: 1.5px solid currentColor;
	}

	.alert-header.severe {
		background-color: transparent;
		color: #e30613;
	}

	.alert-header.warning {
		background-color: transparent;
		color: #ffa700;
	}

	.alert-header.info {
		background-color: transparent;
		color: var(--text-secondary);
	}

	.alert-header iconify-icon {
		width: 0.9em;
		height: 0.9em;
		flex-shrink: 0;
		transform: translateY(-0.1em);
	}

	.alert-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.alert-ticker {
		max-height: clamp(2em, 8vh, 6em);
		overflow: hidden;
		position: relative;
	}


	.alert-content {
		padding: 0.2em 0.5em;
		font-size: 0.8em;
		line-height: 1.3;
		animation: scroll-alert-vertical 180s linear infinite;
		white-space: pre-wrap;
		word-wrap: break-word;
		color: var(--text-tertiary)
	}

	@keyframes scroll-alert-vertical {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-100%);
		}
	}

	.alert-text {
		margin-bottom: 0.2em;
	}

	.separator-line {
		opacity: 0.3;
		text-align: center;
		margin: 0.2em 0;
		font-size: 0.7em;
	}
</style>
