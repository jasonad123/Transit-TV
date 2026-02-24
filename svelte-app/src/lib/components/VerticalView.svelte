<script lang="ts">
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import RouteIcon from './RouteIcon.svelte';
	import type { Route } from '$lib/services/nearby';
	import { getMinutesUntil } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { parseAlertContent, extractImageId } from '$lib/services/alerts';
	import { config } from '$lib/stores/config';

	let {
		routes,
		showLongName = false,
		onMoveStop,
		onMoveStopToTop,
		onHideRoute,
		onHideStop
	}: {
		routes: Route[];
		showLongName?: boolean;
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

	// Cross-route stop grouping
	let stopGroups = $derived.by(() => {
		const groups = new Map<string, StopGroup>();

		for (const route of routes) {
			if (!route.itineraries) continue;

			// Compute per-route alert severity using same logic as ListView
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
					groups.set(stopId, {
						stopId,
						stopName,
						rows: []
					});
				}

				const filteredDepartures =
					itinerary.schedule_items?.filter(shouldShowDeparture).slice(0, 3) || [];

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

		// Sort rows within each group: group by route (stable ID order), then by departure within route
		for (const group of groups.values()) {
			group.rows.sort((a, b) => {
				if (a.route.global_route_id !== b.route.global_route_id) {
					return a.route.global_route_id.localeCompare(b.route.global_route_id);
				}
				return a.nextDeparture - b.nextDeparture;
			});
		}

		// Sort by saved stopOrder (unranked stops fall to end, sorted by ID)
		const savedOrder = $config.stopOrder || [];
		return Array.from(groups.values())
			.filter((g) => g.rows.length > 0)
			.sort((a, b) => {
				const aIdx = savedOrder.indexOf(a.stopId);
				const bIdx = savedOrder.indexOf(b.stopId);
				if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
				if (aIdx !== -1) return -1;
				if (bIdx !== -1) return 1;
				return a.stopId.localeCompare(b.stopId);
			});
	});

	// Consolidated alerts from all routes, deduplicated, with route attribution
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

<div class="vertical-view" class:dark={isDarkMode}>
	<!-- Scrollable routes area -->
	<div class="routes-scroll" class:has-alerts={consolidatedAlerts.length > 0}>
		{#each stopGroups as group, groupIndex (group.stopId)}
			<div class="stop-group">
				<div class="stop-header">
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

				{#each group.rows as row}
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
							{#each row.departures as item}
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

			{#if groupIndex < stopGroups.length - 1}
				<div class="group-divider"></div>
			{/if}
		{/each}
	</div>

	<!-- Pinned alerts area (always visible at bottom) -->
	{#if consolidatedAlerts.length > 0}
		<div class="alert-section">
			<div
				class="alert-header"
				class:severe={mostSevereLevel === 'severe'}
				class:warning={mostSevereLevel === 'warning'}
				class:info={mostSevereLevel === 'info'}
			>
				<iconify-icon icon={mostSevereIcon}></iconify-icon>
				<span class="alert-title">
					{$_('alerts.title')}
					({consolidatedAlerts.length})
				</span>
			</div>

			<div class="alert-ticker">
				<div class="alert-content">
					{#each [0, 1] as _}
						<div class="alert-text">
							{#each parseAlertContent(alertText) as content}
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
	.vertical-view {
		display: flex;
		flex-direction: column;
		font-size: 2.5em;
		height: 100%;
	}

	/* Routes scroll area takes remaining space above pinned alerts */
	.routes-scroll {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.stop-group {
		display: flex;
		flex-direction: column;
	}

	.stop-header {
		display: flex;
		align-items: center;
		gap: 0.25em;
		padding: 0.35em 0.5em;
		font-size: 0.75em;
		font-weight: 700;
		background: var(--bg-secondary);
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
		position: relative;
	}

	.stop-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stop-controls {
		display: flex;
		gap: 0.25em;
		opacity: 0;
		transition: opacity 0.2s;
		flex-shrink: 0;
	}

	.stop-group:hover .stop-controls {
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
	}

	.row-badge {
		display: flex;
		align-items: center;
		gap: 0.2em;
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
		margin-right: 0.15em;
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
		font-size: 0.85em;
		color: var(--text-primary);
	}

	.row-destination .branch-code {
		color: var(--route-color);
		font-weight: 900;
		margin-right: 0.35em;
	}

	.row-times {
		display: flex;
		align-items: center;
		gap: 0.4em;
		flex-shrink: 0;
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

	/* Real-time indicator — PNG waves matching other views */
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

	.group-divider {
		height: 3px;
		background: var(--border-color, rgba(0, 0, 0, 0.1));
	}

	/* Alert section — pinned to bottom, never scrolls with routes */
	.alert-section {
		flex-shrink: 0;
		border-top: 2px solid var(--border-color, rgba(0, 0, 0, 0.15));
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.2em 0.5em;
		font-size: 0.7em;
		font-weight: 600;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		background-color: transparent;
		color: var(--text-primary);
	}

	.alert-header.severe {
		color: #e30613;
		border-color: #e30613;
	}

	.alert-header.warning {
		color: #ffa700;
		border-color: #ffa700;
	}

	.alert-header.info {
		color: var(--text-secondary);
		border-color: var(--text-secondary);
	}

	.alert-header iconify-icon {
		display: block;
		width: 0.9em;
		height: 0.9em;
		flex-shrink: 0;
		padding-left: 0.5em;
		padding-right: 0.5em;
		margin-left: -0.5em;
		transform: translateY(-0.1em);
	}

	.alert-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.alert-ticker {
		overflow: hidden;
		position: relative;
		flex-shrink: 0;
		height: clamp(6em, 7vh, 8em);
	}

	.alert-content {
		padding: 0.2em 0.5em;
		font-size: 0.75em;
		line-height: 1.3;
		animation: scroll-alert-vertical 180s linear infinite;
		white-space: pre-wrap;
		word-wrap: break-word;
		color: var(--text-tertiary);
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

	.alert-image {
		height: 1em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}
</style>
