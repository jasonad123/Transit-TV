<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Route, ScheduleItem } from '$lib/services/nearby';

	export let route: Route;

	$: useBlackText = route.route_text_color === '000000';
	$: cellStyle = `background: #${route.route_color}; color: #${route.route_text_color}`;
	$: imageSize = (route.route_display_short_name?.elements?.length || 0) > 1 ? 28 : 34;

	let destinationElements: Map<number, HTMLElement> = new Map();
	let overflowingDestinations: Set<number> = new Set();

	function getImageUrl(index: number): string | null {
		if (route.route_display_short_name?.elements?.[index]) {
			const hex = useBlackText ? '000000' : route.route_color;
			return `/api/images/${route.route_display_short_name.elements[index]}.svg?primaryColor=${hex}`;
		}
		return null;
	}

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

	$: relevantAlertCount = getRelevantAlerts().length;

	function checkDestinationOverflow(index: number, element: HTMLElement) {
		if (!element) return;
		const parent = element.parentElement;
		if (!parent) return;

		// Use requestAnimationFrame to ensure DOM has been painted
		requestAnimationFrame(() => {
			const isOverflowing = element.scrollWidth > parent.clientWidth;
			if (isOverflowing) {
				overflowingDestinations = overflowingDestinations.add(index);
			} else {
				overflowingDestinations.delete(index);
				overflowingDestinations = overflowingDestinations;
			}
		});
	}

	function bindDestinationElement(node: HTMLElement, index: number) {
		destinationElements.set(index, node);

		// Wait for layout to settle before checking overflow
		setTimeout(() => {
			checkDestinationOverflow(index, node);
		}, 100);

		const resizeObserver = new ResizeObserver(() => {
			checkDestinationOverflow(index, node);
		});
		resizeObserver.observe(node);

		return {
			destroy() {
				resizeObserver.disconnect();
				destinationElements.delete(index);
			}
		};
	}
</script>

<div class="route" class:white={useBlackText} style="color: {useBlackText ? '#000000' : '#' + route.route_color}">
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
			/>{/if}{/if}</span>{#if route.route_long_name}<span class="route-long-name">{route.route_long_name}</span>{/if}</h2>

		{#if route.itineraries}
			{#each route.itineraries as dir, index}
				{#if dir}
					<div class="content">
						<div class="stop_name">
							<svg
								class="pin-icon"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 640 640"
								><path
									d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"
								/></svg
							>{dir.closest_stop?.stop_name || 'Unknown stop'}
						</div>
						<div class="direction" style={cellStyle}>
							<h3><span
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
			<div class="route-alert-header" style={cellStyle}>
				<span>Service Alerts for {route.route_short_name || route.route_long_name}</span>
			</div>
			<div class="route-alert-ticker" style={cellStyle}>
				<div class="alert-text" class:single-alert={relevantAlertCount === 1}>{getAlertText()}</div>
			</div>
		</div>
	{/if}
</div>

<style>

	.route {
		width: 100%;
		box-sizing: border-box;
	}

	.route > div {
		padding: 1em;
		border-radius: 4px;
	}

	.route > div:hover {
		background: rgba(255, 255, 255, 0.6);
		cursor: move;
	}

	.route h2 {
		position: relative;
		padding-left: 0.26em;
		margin-bottom: 0em;
		padding-bottom: 0em;
		padding-top: 0em;
		display: flex;
		align-items: flex-start;
		flex-wrap: nowrap;
		gap: 0.5em;
	}

	.route h2 .route-icon {
		white-space: nowrap;
		flex-shrink: 0;
	}

	.route h2 .route-long-name {
		font-size: 0.4em;
		font-weight: semi-bold;
		white-space: normal;
		word-wrap: break-word;
		align-self: center;
		flex-grow: 0;
		flex-shrink: 1;
		min-width: 0;
	}

	.route-alert-header {
		font-size: 1.5em;
		font-weight: bold;
		line-height: 2;
		padding: 0.5em;
		margin-top: 0.25em;
		border-radius: 0.2em 0.2em 0 0;
		text-align: left;
		height: 1.3em;
		display: flex;
		align-items: center;
		justify-content: left;
		word-wrap: break-word;
		overflow: hidden;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.route.white .route-alert-header {
		border-bottom: 1px solid rgba(0, 0, 0, 0.2);
	}

	.route-alert-ticker {
		font-size: 1.25em;
		font-weight: medium;
		line-height: 1.3;
		padding: 0.4em 0.4em;
		margin-top: 0;
		border-radius: 0 0 0.2em 0.2em;
		overflow: hidden;
		position: relative;
		height: 6.5em;
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
		animation: scroll-alert-vertical 240s linear infinite;
	}

	.route-alert-ticker .alert-text.single-alert {
		animation: none;
	}

	.route h3 {
		font-size: 1.5em;
		padding: 0.4em 0.35em 0.3em 0.35em;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		overflow: hidden;
		position: relative;
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
	}

	.route .img28 {
		height: 1em;
		vertical-align: middle;
		display: inline-block;
	}

	.route .img34 {
		height: 1em;
		vertical-align: middle;
		display: inline-block;
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
		border-radius: 0.2em;
		margin-bottom: 0.25em;
	}

	.route .time {
		white-space: nowrap;
		display: flex;
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

	.route .stop_name .pin-icon {
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

	.route.white .realtime::before {
		background-image: url('/assets/images/real_time_wave_small@2x.png');
	}

	.route .realtime::after {
		background-image: url('/assets/images/real_time_wave_big-w@2x.png');
		animation: realtimeAnim 1.4s linear 0.3s infinite alternate;
	}

	.route.white .realtime::after {
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

	@media (min-width: 2000px) {
		.route {
			width: 20%;
		}
	}

	@media (min-width: 2800px) {
		.route {
			width: 16.666%;
		}
	}
</style>
