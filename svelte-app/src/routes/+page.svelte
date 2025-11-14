<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import RouteItem from '$lib/components/RouteItem.svelte';
	import type { Route } from '$lib/services/nearby';
	import "iconify-icon";
	let routes = $state<Route[]>([]);
	let allRoutes = $state<Route[]>([]);
	let intervalId: ReturnType<typeof setInterval>;
	let clockIntervalId: ReturnType<typeof setInterval>;
	let loading = $state(true);
	let currentTime = $state(new Date());

	async function loadNearby() {
		try {
			const currentConfig = $config;
			if (!currentConfig.latLng) return;

			const fetchedRoutes = await findNearbyRoutes(currentConfig.latLng, 500);
			allRoutes = fetchedRoutes;

			routes = fetchedRoutes
				.filter((r) => !currentConfig.hiddenRoutes.includes(r.global_route_id))
				.sort((a, b) => {
					const aIndex = currentConfig.routeOrder.indexOf(a.global_route_id);
					const bIndex = currentConfig.routeOrder.indexOf(b.global_route_id);
					if (aIndex === -1 && bIndex === -1) return 0;
					if (aIndex === -1) return 1;
					if (bIndex === -1) return -1;
					return aIndex - bIndex;
				});

			loading = false;
		} catch (err) {
			console.error('Error loading nearby routes:', err);
			loading = false;
		}
	}

	function moveRoute(index: number, direction: 'up' | 'down') {
		const newRoutes = [...routes];
		const targetIndex = direction === 'up' ? index - 1 : index + 1;

		if (targetIndex < 0 || targetIndex >= newRoutes.length) return;

		[newRoutes[index], newRoutes[targetIndex]] = [newRoutes[targetIndex], newRoutes[index]];
		routes = newRoutes;

		const newOrder = routes.map((r) => r.global_route_id);
		config.update((c) => ({
			...c,
			routeOrder: newOrder
		}));
		config.save();
	}

	function moveRouteToTop(index: number) {
		if (index === 0) return;

		const newRoutes = [...routes];
		const [movedRoute] = newRoutes.splice(index, 1);
		newRoutes.unshift(movedRoute);
		routes = newRoutes;

		const newOrder = routes.map((r) => r.global_route_id);
		config.update((c) => ({
			...c,
			routeOrder: newOrder
		}));
		config.save();
	}

	async function toggleRouteHidden(routeId: string) {
		const wasHidden = $config.hiddenRoutes.includes(routeId);

		config.update((c) => {
			return {
				...c,
				hiddenRoutes: wasHidden
					? c.hiddenRoutes.filter((id) => id !== routeId)
					: [...c.hiddenRoutes, routeId]
			};
		});
		config.save();

		// If unhiding, need to reload all routes to get the unhidden route data
		if (wasHidden) {
			await loadNearby();
		} else {
			// If hiding, just filter the current routes
			routes = routes.filter((r) => r.global_route_id !== routeId);
		}
	}

	onMount(async () => {
		await config.load();

		if (!$config.isEditing) {
			await loadNearby();
			intervalId = setInterval(loadNearby, 20000);
		}

		// Update clock every second
		clockIntervalId = setInterval(() => {
			currentTime = new Date();
		}, 1000);
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (clockIntervalId) {
			clearInterval(clockIntervalId);
		}
	});

	function openConfig() {
		config.update((c) => ({ ...c, isEditing: true }));
	}
</script>

<svelte:head>
	<title>{$config.title || $_('app.title')}</title>
</svelte:head>

<div class="container" style="--bg-header: {$config.headerColor}">
	<header>
		<table cellpadding="0" cellspacing="0" border="0">
			<tbody>
				<tr>
					<td id="logo">
						<a href="https://transitapp.com" aria-label={$_('aria.transitApp')}></a>
					</td>
					<td id="title">
						<h1>{$config.title || $_('app.nearbyRoutes')}</h1>
						<button type="button" onclick={openConfig} aria-label={$_('aria.settings')}><iconify-icon icon="ix:cogwheel-filled"></iconify-icon></button>
					</td>
					<td id="utilities">
						<span class="clock">{currentTime.toLocaleTimeString($config.language, {
							hour: 'numeric',
							minute: '2-digit',
							hour12: $config.timeFormat === 'hh:mm A'
						})}</span>
					</td>
				</tr>
			</tbody>
		</table>
	</header>

	{#if $config.isEditing}
		<div class="config-modal">
			<h2>{$_('config.title')}</h2>
			<form onsubmit={(e) => e.preventDefault()}>
				<label>
					{$_('config.fields.title')}
					<input type="text" bind:value={$config.title} />
				</label>

				<label>
					{$_('config.fields.location')}
					<input
						type="text"
						value={`${$config.latLng.latitude}, ${$config.latLng.longitude}`}
						oninput={(e) => config.setLatLngStr(e.currentTarget.value)}
					/>
				</label>

				<label>
					{$_('config.fields.timeFormat')}
					<select bind:value={$config.timeFormat}>
						<option value="hh:mm A">{$_('config.timeFormats.12hour')}</option>
						<option value="HH:mm">{$_('config.timeFormats.24hour')}</option>
					</select>
				</label>

				<label>
					{$_('config.fields.language')}
					<select bind:value={$config.language}>
						<option value="en">{$_('config.languages.english')}</option>
						<option value="fr">{$_('config.languages.french')}</option>
						<option value="es">{$_('config.languages.spanish')}</option>
						<option value="de">{$_('config.languages.german')}</option>
					</select>
				</label>

				<label>
					{$_('config.fields.columns')}
					<div class="button-group">
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 'auto'}
							onclick={() => config.update(c => ({ ...c, columns: 'auto' }))}
						>
							{$_('config.columns.auto')}
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 1}
							onclick={() => config.update(c => ({ ...c, columns: 1 }))}
						>
							1
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 2}
							onclick={() => config.update(c => ({ ...c, columns: 2 }))}
						>
							2
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 3}
							onclick={() => config.update(c => ({ ...c, columns: 3 }))}
						>
							3
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 4}
							onclick={() => config.update(c => ({ ...c, columns: 4 }))}
						>
							4
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.columns === 5}
							onclick={() => config.update(c => ({ ...c, columns: 5 }))}
						>
							5
						</button>
					</div>
				</label>

				<label>
					{$_('config.fields.theme')}
					<div class="button-group">
						<button
							type="button"
							class="btn-option"
							class:active={$config.theme === 'light'}
							onclick={() => config.update(c => ({ ...c, theme: 'light' }))}
						>
							{$_('config.theme.light')}
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.theme === 'auto'}
							onclick={() => config.update(c => ({ ...c, theme: 'auto' }))}
						>
							{$_('config.theme.auto')}
						</button>
						<button
							type="button"
							class="btn-option"
							class:active={$config.theme === 'dark'}
							onclick={() => config.update(c => ({ ...c, theme: 'dark' }))}
						>
							{$_('config.theme.dark')}
						</button>
					</div>
				</label>

				<label>
					{$_('config.fields.headerColor')}
					<div style="display: flex; gap: 0.5em; align-items: center;">
						<input
							type="color"
							bind:value={$config.headerColor}
						/>
						<button
							type="button"
							class="btn-reset"
							onclick={() => config.update(c => ({ ...c, headerColor: '#30b566' }))}
							title={$_('config.buttons.resetToDefault')}
						>
							{$_('config.buttons.reset')}
						</button>
					</div>
				</label>

				<label class="toggle-label">
					<span>{$_('config.fields.showRouteLongName')}</span>
					<label class="toggle-switch">
						<input
							type="checkbox"
							bind:checked={$config.showRouteLongName}
						/>
						<span class="toggle-slider"></span>
					</label>
				</label>

				{#if $config.hiddenRoutes.length > 0}
					<div class="route-management">
						<h3>{$_('config.hiddenRoutes.title')}</h3>
						<p class="help-text">{$_('config.hiddenRoutes.helpText')}</p>
						<div class="hidden-routes-list">
							{#each allRoutes.filter(r => $config.hiddenRoutes.includes(r.global_route_id)) as route}
								<button
									type="button"
									class="hidden-route-item"
									onclick={() => toggleRouteHidden(route.global_route_id)}
								>
									<iconify-icon icon="ix:eye-cancelled-filled"></iconify-icon>
									<span>{route.route_short_name || route.route_long_name}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="modal-actions">
					<button
						type="button"
						class="btn-cancel"
						onclick={() => {
							config.update((c) => ({ ...c, isEditing: false }));
						}}
					>
						{$_('config.buttons.cancel')}
					</button>
					<button
						type="button"
						class="btn-save"
						onclick={() => {
							config.save();
							config.update((c) => ({ ...c, isEditing: false }));
							loadNearby();
							intervalId = setInterval(loadNearby, 20000);
						}}
					>
						{$_('config.buttons.save')}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="content">
		{#if loading}
			<div class="loading">{$_('routes.loading')}</div>
		{:else if routes.length === 0}
			<div class="no-routes">{$_('routes.noRoutes')}</div>
		{:else}
			<section id="routes" class:cols-1={$config.columns === 1} class:cols-2={$config.columns === 2} class:cols-3={$config.columns === 3} class:cols-4={$config.columns === 4} class:cols-5={$config.columns === 5}>
				{#each routes as route, index (route.global_route_id)}
					<div class="route-wrapper" transition:fade={{ duration: 300 }}>
						<RouteItem {route} showLongName={$config.showRouteLongName} />
						<div class="route-controls">
							{#if index > 0}
								<button
									type="button"
									class="btn-route-control"
									onclick={() => moveRouteToTop(index)}
									aria-label={$_('aria.moveRouteToTop')}
									title={$_('routes.controls.moveToTop')}
								>
									<iconify-icon icon="ix:double-chevron-up"></iconify-icon>
								</button>
							{/if}
							{#if index > 0}
								<button
									type="button"
									class="btn-route-control"
									onclick={() => moveRoute(index, 'up')}
									aria-label={$_('aria.moveRouteUp')}
									title={$_('routes.controls.moveUp')}
								>
									<iconify-icon icon="ix:arrow-up"></iconify-icon>
								</button>
							{/if}
							{#if index < routes.length - 1}
								<button
									type="button"
									class="btn-route-control"
									onclick={() => moveRoute(index, 'down')}
									aria-label={$_('aria.moveRouteDown')}
									title={$_('routes.controls.moveDown')}
								>
									<iconify-icon icon="ix:arrow-down"></iconify-icon>
								</button>
							{/if}
							<button
								type="button"
								class="btn-route-control"
								onclick={() => toggleRouteHidden(route.global_route_id)}
								aria-label={$_('aria.hideRoute')}
								title={$_('routes.controls.hide')}
							>
								<iconify-icon icon="ix:eye-cancelled-filled"></iconify-icon>
							</button>
						</div>
					</div>
				{/each}
			</section>
		{/if}
	</div>
</div>

<style>

    iconify-icon {
    	display: inline-block;
    	width: 1em;
    	height: 1em;
	}

	.container {
		width: 100%;
		height: 100%;
		background: var(--bg-primary);
	}

	.content {
		height: calc(100% - 4.3em);
		position: relative;
	}

	.content section {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	header {
		color: var(--text-header);
		background-color: var(--bg-header);
		position: relative;
	}

	header table {
		width: 100%;
		table-layout: fixed;
	}

	#logo {
		width: 33%;
		min-width: 200px;
	}

	#logo a {
		display: block;
		height: 2em;
		width: 100%;
		color: #ffffff;
		line-height: 1.1em;
		font-family: Helvetica, Arial, serif;
		font-weight: lighter;
		font-size: 2em;
		text-decoration: none;
		background: url('/assets/images/transit.svg') no-repeat center left;
		background-size: auto 2em;
		padding-left: 130px;
		min-width: 200px;
	}

	#title {
		width: 34%;
		text-align: center;
		vertical-align: middle;
		border: none;
	}

	#title h1 {
		font-family: Helvetica, Arial, serif;
		font-size: 2em;
		vertical-align: middle;
		display: inline-block;
		line-height: 1.4em;
		margin-bottom: -0.1em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	#title button {
		padding: 0;
		margin-top: 0.45em;
		display: inline-block;
		width: 2em;
		height: 2em;
		background: none;
		/* background-image: url('/assets/images/settings@2x.png'); */
		background-size: 2em auto;
		outline: none;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
		vertical-align: middle;
		border: none;
	}

	#title button iconify-icon {
		width: 2em;
		height: 2em;
		font-size: 2em;
		color: #ffffff;
	}

	#title:hover button {
		opacity: 1;
	}

	#utilities {
		width: 30%;
		min-width: 15em;
		text-align: right;
		vertical-align: middle;
		padding-right: 1em;
	}

	.clock {
		font-size: 1.8em;
		font-family: Helvetica, Arial, serif;
		line-height: 2em;
		display: inline-block;
		margin-left: 3em;
		margin-right: 0.5em;
	}

	.config-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg-secondary);
		color: var(--text-primary);
		padding: 2em;
		border-radius: 8px;
		box-shadow: 0 4px 6px var(--shadow-color);
		z-index: 1000;
		min-width: 400px;
		max-width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
	}

	.config-modal h2 {
		margin-top: 0;
		margin-bottom: 0.5em;
		color: var(--text-primary);
		font-size: 2em;
	}

	.config-modal form {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.config-modal label {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		color: var(--text-primary);
	}

	.config-modal input,
	.config-modal select {
		padding: 0.5em;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 1em;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.modal-actions {
		display: flex;
		gap: 1em;
		justify-content: flex-end;
		margin-top: 0.5em;
	}

	.config-modal button {
		padding: 0.7em 1.5em;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1em;
	}

	.btn-save {
		background: #30b566;
		color: white;
	}

	.btn-save:hover {
		background: #1f7a42;
	}

	.btn-cancel {
		background: #e0e0e0;
		color: #333;
	}

	.btn-cancel:hover {
		background: #c0c0c0;
	}

	.btn-reset {
		padding: 0.4em 0.8em;
		font-size: 0.9em;
		background: #f0f0f0;
		color: #333;
		border-radius: 4px;
		border: 1px solid #ccc;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-reset:hover {
		background: #e0e0e0;
		border-color: #999;
	}

	.toggle-label {
		display: flex;
		flex-direction: row !important;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 3em;
		height: 1.6em;
		flex-shrink: 0;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: 0.3s;
		border-radius: 1.6em;
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 1.2em;
		width: 1.2em;
		left: 0.2em;
		bottom: 0.2em;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
	}

	.toggle-switch input:checked + .toggle-slider {
		/* background-color: #30b566; */
		background-color: var(--bg-header);
	}

	.toggle-switch input:checked + .toggle-slider:before {
		transform: translateX(1.4em);
	}

	.route-wrapper {
		display: inline-block;
		width: 25%;
		vertical-align: top;
		box-sizing: border-box;
		position: relative;
	}

	/* Column overrides */
	#routes.cols-1 .route-wrapper {
		width: 100%;
	}

	#routes.cols-2 .route-wrapper {
		width: 50%;
	}

	#routes.cols-3 .route-wrapper {
		width: 33.333%;
	}

	#routes.cols-4 .route-wrapper {
		width: 25%;
	}

	#routes.cols-5 .route-wrapper {
		width: 20%;
	}

	.route-controls {
		position: absolute;
		top: 0.5em;
		right: 0.5em;
		display: flex;
		gap: 0.3em;
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 10;
	}

	.route-wrapper:hover .route-controls {
		opacity: 1;
	}

	.btn-route-control {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.4em 0.6em;
		cursor: pointer;
		transition: background 0.2s;
		font-size: 0.9em;
	}

	.btn-route-control:hover {
		background: rgba(255, 255, 255, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.btn-route-control iconify-icon {
		display: block;
		width: 2em;
		height: auto;
		font-size: 1.25em;
	}

	.route-management {
		margin-top: 1.5em;
		padding-top: 1em;
		border-top: 1px solid var(--border-color);
	}

	.route-management h3 {
		margin-top: 0;
		margin-bottom: 0.5em;
		font-size: 1.2em;
		color: var(--text-primary);
	}

	.help-text {
		margin: 0 0 1em 0;
		font-size: 0.9em;
		color: var(--text-secondary);
	}

	.hidden-routes-list {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		max-height: 200px;
		overflow-y: auto;
		padding: 0.5em;
		background: var(--bg-primary);
		border-radius: 4px;
	}

	.hidden-route-item {
		display: flex;
		align-items: center;
		gap: 0.75em;
		padding: 0.8em;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
		text-align: left;
	}

	.hidden-route-item:hover {
		background: var(--bg-primary);
	}

	.hidden-route-item iconify-icon {
		color: var(--text-secondary);
	}

	.hidden-route-item span {
		font-weight: 500;
		color: var(--text-primary);
	}

	.loading,
	.no-routes {
		text-align: center;
		padding: 3em;
		font-size: 1.5em;
		color: var(--text-secondary);
	}

	.button-group {
		display: flex;
		gap: 0.5em;
		flex-wrap: wrap;
	}

	.btn-option {
		flex: 1;
		min-width: 60px;
		padding: 0.6em 1em;
		border: 2px solid var(--border-color);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.95em;
	}

	.btn-option:hover {
		/* border-color: #007bff; */
		border-color: var(--bg-header); 
		background: var(--bg-primary);
	}

	.btn-option.active {
		/* border-color: #007bff; */
		/* background: #007bff; */
		border-color: var(--bg-header); 
		background-color: var(--bg-header); 
		color: white;
		font-weight: 600;
	}
</style>
