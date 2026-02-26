<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import RouteIcon from './RouteIcon.svelte';
	import type { Route } from '$lib/services/nearby';
	import { getMinutesUntil } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { parseAlertContent, extractImageId } from '$lib/services/alerts';
	import { config } from '$lib/stores/config';
	import { isHighPriorityMode, haversineDistance } from '$lib/utils/sortingUtils';

	let {
		routes,
		stopOrder = [],
		showLongName = false,
		showQRCode = false,
		onMoveStop,
		onMoveStopToTop,
		onHideRoute,
		onHideStop
	}: {
		routes: Route[];
		stopOrder?: string[];
		showLongName?: boolean;
		showQRCode?: boolean;
		onMoveStop?: (stopId: string, direction: 'up' | 'down') => void;
		onMoveStopToTop?: (stopId: string) => void;
		onHideRoute?: (routeId: string) => void;
		onHideStop?: (stopId: string) => void;
	} = $props();

	interface DepartureRow {
		route: Route;
		itinerary: any;
		departures: any[];
		nextDeparture: number;
		alertSeverity: 'none' | 'info' | 'warning' | 'severe';
		alertIcon: string;
	}

	interface StopGroup {
		stopId: string;
		stopName: string;
		rows: DepartureRow[];
	}

	let isDarkMode = $state(false);
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

	// Grid layout driven by columns config
	let gridColumns = $derived(
		$config.columns === 'auto'
			? 'repeat(auto-fit, minmax(20em, 1fr))'
			: `repeat(${$config.columns}, 1fr)`
	);

	// Cross-route stop grouping (adapted from VerticalView)
	let stopGroups = $derived.by(() => {
		const groups = new Map<string, StopGroup>();

		for (const route of routes) {
			if (!route.itineraries) continue;

			let alertSeverity: 'none' | 'info' | 'warning' | 'severe' = 'none';
			let alertIcon = '';
			if (route.alerts?.length) {
				if (route.alerts.some((a) => (a.severity || 'Info').toLowerCase() === 'severe')) {
					alertSeverity = 'severe';
					alertIcon = 'ix:warning-octagon-filled';
				} else if (route.alerts.some((a) => (a.severity || 'Info').toLowerCase() === 'warning')) {
					alertSeverity = 'warning';
					alertIcon = 'ix:warning-filled';
				} else {
					alertSeverity = 'info';
					alertIcon = 'ix:about-filled';
				}
			}

			for (const itinerary of route.itineraries) {
				const stopId =
					itinerary.closest_stop?.parent_station_global_stop_id ||
					itinerary.closest_stop?.global_stop_id ||
					'unknown';
				const stopName = itinerary.closest_stop?.stop_name || 'Unknown stop';

				if (!groups.has(stopId)) {
					groups.set(stopId, { stopId, stopName, rows: [] });
				}

				const filteredDepartures =
					itinerary.schedule_items?.filter(shouldShowDeparture).slice(0, 2) || [];

				if (filteredDepartures.length === 0) continue;

				const nextDep = filteredDepartures[0]?.departure_time ?? Infinity;

				groups.get(stopId)!.rows.push({
					route,
					itinerary,
					departures: filteredDepartures,
					nextDeparture: nextDep,
					alertSeverity,
					alertIcon
				});
			}
		}

		// Sort rows within each group: route → direction → departure
		for (const group of groups.values()) {
			group.rows.sort((a, b) => {
				if (a.route.global_route_id !== b.route.global_route_id) {
					return a.route.global_route_id.localeCompare(b.route.global_route_id);
				}
				const aDirId = a.itinerary.direction_id ?? 0;
				const bDirId = b.itinerary.direction_id ?? 0;
				if (aDirId !== bDirId) return aDirId - bDirId;
				return a.nextDeparture - b.nextDeparture;
			});
		}

		// Sort groups: stopOrder overrides → high-priority mode → distance → stop ID
		const userLat = $config.latLng.latitude;
		const userLon = $config.latLng.longitude;
		const getStopDist = (group: StopGroup) => {
			const stop = group.rows[0]?.itinerary.closest_stop;
			if (stop?.stop_lat != null && stop?.stop_lon != null) {
				return haversineDistance(userLat, userLon, stop.stop_lat, stop.stop_lon);
			}
			return Infinity;
		};

		return Array.from(groups.values())
			.filter((g) => g.rows.length > 0)
			.sort((a, b) => {
				const aIdx = stopOrder.indexOf(a.stopId);
				const bIdx = stopOrder.indexOf(b.stopId);
				if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
				if (aIdx !== -1) return -1;
				if (bIdx !== -1) return 1;
				const aHigh = a.rows.some((r) => isHighPriorityMode(r.route.mode_name));
				const bHigh = b.rows.some((r) => isHighPriorityMode(r.route.mode_name));
				if (aHigh !== bHigh) return aHigh ? -1 : 1;
				const aDist = getStopDist(a);
				const bDist = getStopDist(b);
				if (aDist !== bDist) return aDist - bDist;
				return a.stopId.localeCompare(b.stopId);
			});
	});

	// Consolidated alerts from all routes, deduplicated (same as VerticalView)
	let consolidatedAlerts = $derived.by(() => {
		const alertMap = new Map<string, { alert: any; routeNames: string[] }>();

		for (const route of routes) {
			if (!route.alerts) continue;
			const routeName = route.route_short_name || route.route_long_name || route.global_route_id;
			for (const alert of route.alerts) {
				const key = `${alert.title || ''}::${alert.description || ''}`;
				if (!alertMap.has(key)) {
					alertMap.set(key, { alert, routeNames: [routeName] });
				} else {
					const entry = alertMap.get(key)!;
					if (!entry.routeNames.includes(routeName)) {
						entry.routeNames.push(routeName);
					}
				}
			}
		}

		return Array.from(alertMap.values());
	});

	let alertText = $derived.by(() => {
		if (!consolidatedAlerts.length) return '';

		return consolidatedAlerts
			.map(({ alert, routeNames }) => {
				const routeLabel = routeNames.join(', ');
				const hasTitle = alert.title && alert.title.trim().length > 0;
				const hasDescription = alert.description && alert.description.trim().length > 0;
				const prefix = `[${routeLabel}] `;

				if (hasTitle && hasDescription) {
					return `${prefix}${alert.title}\n\n${alert.description}`;
				} else if (hasTitle) {
					return `${prefix}${alert.title}`;
				} else if (hasDescription) {
					return `${prefix}${alert.description}`;
				} else {
					return `${prefix}${$_('alerts.default')}`;
				}
			})
			.join('\n\n---\n\n');
	});

	let mostSevereLevel = $derived.by(() => {
		if (!consolidatedAlerts.length) return 'info';
		if (consolidatedAlerts.some((a) => (a.alert.severity || 'Info').toLowerCase() === 'severe'))
			return 'severe';
		if (consolidatedAlerts.some((a) => (a.alert.severity || 'Info').toLowerCase() === 'warning'))
			return 'warning';
		return 'info';
	});

	let mostSevereIcon = $derived.by(() => {
		if (mostSevereLevel === 'severe') return 'ix:warning-octagon-filled';
		if (mostSevereLevel === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	});
</script>

<div class="board-view" class:dark={isDarkMode} class:has-alerts={consolidatedAlerts.length > 0}>
	<!-- Stop panels grid -->
	<div class="panels-area" style:grid-template-columns={gridColumns}>
		{#each stopGroups as group, groupIndex (group.stopId)}
			<div class="stop-panel">
				<div class="stop-header">
					<iconify-icon icon="ix:location-filled"></iconify-icon>
					<span class="stop-name">{group.stopName}</span>
					{#if onMoveStop || onMoveStopToTop || onHideStop}
						<div class="stop-controls">
							{#if groupIndex > 0 && onMoveStopToTop}
								<button
									type="button"
									class="btn-stop-control"
									onclick={() => onMoveStopToTop(group.stopId)}
									title={$_('routes.controls.moveStopToTop')}
								>
									<iconify-icon icon="ix:double-chevron-up"></iconify-icon>
								</button>
							{/if}
							{#if groupIndex > 0 && onMoveStop}
								<button
									type="button"
									class="btn-stop-control"
									onclick={() => onMoveStop(group.stopId, 'up')}
									title={$_('routes.controls.moveStopUp')}
								>
									<iconify-icon icon="ix:arrow-up"></iconify-icon>
								</button>
							{/if}
							{#if groupIndex < stopGroups.length - 1 && onMoveStop}
								<button
									type="button"
									class="btn-stop-control"
									onclick={() => onMoveStop(group.stopId, 'down')}
									title={$_('routes.controls.moveStopDown')}
								>
									<iconify-icon icon="ix:arrow-down"></iconify-icon>
								</button>
							{/if}
							{#if onHideStop}
								<button
									type="button"
									class="btn-stop-control"
									onclick={() => onHideStop(group.stopId)}
									title={$_('routes.controls.hideStop')}
								>
									<iconify-icon icon="ix:eye-cancelled-filled"></iconify-icon>
								</button>
							{/if}
						</div>
					{/if}
				</div>

				{#each group.rows as row (row.route.global_route_id + '_' + (row.itinerary.merged_headsign || ''))}
					<div
						class="departure-row"
						style="--route-color: #{row.route.route_color}; --route-text-color: #{row.route
							.route_text_color}"
					>
						<div class="row-badge">
							<RouteIcon route={row.route} {showLongName} compact={true} />
						</div>
						<div class="row-destination">
							{#if row.itinerary.branch_code}<span class="branch-code"
									>({row.itinerary.branch_code})</span
								>{/if}{row.itinerary.merged_headsign}
						</div>
						<div class="row-times">
							{#if row.alertSeverity !== 'none'}
								<iconify-icon
									icon={row.alertIcon}
									class="route-alert-icon {row.alertSeverity}"
									title={$_('alerts.title')}
								></iconify-icon>
							{/if}
							{#each row.departures as item (item.departure_time)}
								<span class="time-badge" class:cancelled={item.is_cancelled}>
									{getMinutesUntil(item.departure_time)}<span class="time-suffix">m</span
									>{#if item.is_real_time}<i class="realtime"></i>{/if}{#if item.is_last}*{/if}
								</span>
							{/each}
						</div>
						{#if onHideRoute}
							<button
								type="button"
								class="btn-row-hide"
								onclick={() => onHideRoute(row.route.global_route_id)}
								title={$_('routes.controls.hide')}
							>
								<iconify-icon icon="ix:eye-cancelled-filled"></iconify-icon>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<!-- Pinned alerts area (always visible at bottom) -->
	{#if consolidatedAlerts.length > 0}
		<div class="alert-section" class:qr-protected={showQRCode}>
			<div
				class="alert-header"
				class:severe={mostSevereLevel === 'severe'}
				class:warning={mostSevereLevel === 'warning'}
				class:info={mostSevereLevel === 'info'}
			>
				<iconify-icon icon={mostSevereIcon}></iconify-icon>
				<span class="alert-title">{$_('alerts.title')}</span>
				<span class="alert-count-badge">{consolidatedAlerts.length}</span>
			</div>

			<div class="alert-ticker">
				<div class="alert-content">
					{#each [0, 1] as _, i (i)}
						<div class="alert-text">
							{#each parseAlertContent(alertText) as content, ci (ci)}
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
						{#if consolidatedAlerts.length > 1 || (consolidatedAlerts.length === 1 && alertText.length > 100)}
							<div class="separator-line">---</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.board-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		font-size: 2em;
		box-sizing: border-box;
	}

	/* Stop panels grid — takes all remaining space above alerts */
	.panels-area {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20em, 1fr));
		align-content: start;
		overflow-y: auto;
		min-height: 0;
	}

	.stop-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-right: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
		border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
		box-sizing: border-box;
	}

	.stop-header {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.4em 0.5em;
		font-size: 0.7em;
		font-weight: 700;
		background: var(--bg-secondary);
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
	}

	.stop-header iconify-icon {
		flex-shrink: 0;
		width: 0.85em;
		height: 0.85em;
		transform: translateY(-0.1em);
	}

	.stop-name {
		flex: 1;
		min-width: 0;
		overflow: visible;
		text-overflow: clip;
		white-space: nowrap;
	}

	.stop-controls {
		display: flex;
		gap: 0.25em;
		opacity: 0;
		transition: opacity 0.2s;
		flex-shrink: 0;
	}

	.stop-panel:hover .stop-controls {
		opacity: 1;
	}

	.btn-stop-control {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.15em 0.3em;
		cursor: pointer;
		transition: background 0.2s;
		font-size: 0.85em;
		line-height: 1;
	}

	.btn-stop-control:hover {
		background: rgba(255, 255, 255, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.btn-stop-control iconify-icon {
		display: block;
		width: 1.2em;
		height: 1.2em;
		transform: translateY(0.05em);
	}

	.btn-row-hide {
		position: absolute;
		right: 0.3em;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.1em 0.25em;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s;
		font-size: 0.7em;
		line-height: 1;
		z-index: 1;
	}

	.departure-row:hover .btn-row-hide {
		opacity: 1;
	}

	.btn-row-hide:hover {
		background: rgba(255, 255, 255, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.btn-row-hide iconify-icon {
		display: block;
		width: 1.2em;
		height: 1.2em;
		transform: translateY(0.05em);
	}

	.departure-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.5em;
		padding: 0.45em 0.5em;
		align-items: center;
		border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
		position: relative;
	}

	.row-badge {
		display: flex;
		align-items: center;
		font-size: 1em;
		line-height: 1;
		color: var(--route-color);
	}

	.route-alert-icon {
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		flex-shrink: 0;
		transform: translateY(-0.25em);
		margin-right: 0.25em;
	}

	.route-alert-icon.severe {
		color: #e30613;
	}

	.route-alert-icon.warning {
		color: #ffa700;
	}

	.route-alert-icon.info {
		color: var(--text-secondary);
	}

	.row-destination {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 0.75em;
		color: var(--text-primary);
	}

	.branch-code {
		color: var(--route-color);
		font-weight: 900;
		margin-right: 0.35em;
	}

	.row-times {
		display: flex;
		align-items: center;
		gap: 0.5em;
		flex-shrink: 0;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.time-badge {
		font-feature-settings: 'tnum';
		font-weight: 700;
		font-size: 0.85em;
		white-space: nowrap;
		color: var(--text-primary);
		position: relative;
	}

	.time-badge.cancelled {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.time-suffix {
		font-weight: 500;
		font-size: 0.8em;
		opacity: 0.7;
	}

	/* Real-time indicator — theme-aware PNGs set in app.css */
	.realtime {
		width: 0.28em;
		height: 0.28em;
		position: absolute;
		top: -4px;
		right: -6px;
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
		animation: realtimeAnim 1.4s linear 0s infinite alternate;
	}

	.realtime::after {
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

	/* Alert section — pinned to bottom */
	.alert-section {
		flex-shrink: 0;
		border-top: 2px solid var(--border-color, rgba(0, 0, 0, 0.15));
	}

	.alert-section.qr-protected {
		padding-right: 26%;
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.4em 0.5em;
		font-size: 0.75em;
		font-weight: 700;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		background-color: transparent;
		color: var(--text-secondary);
	}

	.alert-header.severe {
		background-color: #e30613;
		color: #fff;
		border-color: #e30613;
	}

	.alert-header.warning {
		background-color: #ffa700;
		color: #000;
		border-color: #ffa700;
	}

	.alert-header.info {
		color: var(--text-secondary);
		border-color: var(--text-secondary);
	}

	.alert-header iconify-icon {
		display: block;
		width: 1em;
		height: 1em;
		flex-shrink: 0;
		transform: translateY(-0.05em);
		position: relative;
		z-index: 1;
		padding-left: 0.5em;
		padding-right: 0.5em;
		margin-left: -0.5em;
	}

	.alert-header.severe iconify-icon {
		background: linear-gradient(to right, #e30613 0%, #e30613 70%, transparent 100%);
	}

	.alert-header.warning iconify-icon {
		background: linear-gradient(to right, #ffa700 0%, #ffa700 70%, transparent 100%);
	}

	.alert-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.alert-count-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--border-color);
		color: inherit;
		border-radius: 40rem;
		padding: 2px 0.5em;
		font-size: 0.9em;
		font-weight: 800;
		line-height: 1;
		min-width: 1.35em;
		flex-shrink: 0;
		font-family: 'Red Hat Display Variable', Arial, Helvetica, sans-serif;
		box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
	}

	.alert-header.severe .alert-count-badge {
		background: color-mix(in srgb, #e30613, white 30%);
		color: #fff;
	}

	.alert-header.warning .alert-count-badge {
		background: color-mix(in srgb, #ffa700, white 30%);
		color: #000;
	}

	.alert-ticker {
		overflow: hidden;
		position: relative;
		height: clamp(6em, 5vh, 8em);
	}

	.alert-content {
		padding: 0.2em 0.5em;
		font-size: 0.75em;
		line-height: 1.3;
		animation: scroll-alert 180s linear infinite;
		white-space: pre-wrap;
		word-wrap: break-word;
		color: var(--text-tertiary);
	}

	@keyframes scroll-alert {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-50%);
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

	.alert-image {
		height: 1em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}
</style>
