<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import RouteItem from '$lib/components/RouteItem.svelte';
	import type { Route } from '$lib/services/nearby';

	let routes: Route[] = [];
	let intervalId: ReturnType<typeof setInterval>;
	let clockIntervalId: ReturnType<typeof setInterval>;
	let loading = true;
	let currentTime = new Date();

	async function loadNearby() {
		try {
			const currentConfig = $config;
			if (!currentConfig.latLng) return;

			const fetchedRoutes = await findNearbyRoutes(currentConfig.latLng, 1000);

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
	<title>{$config.title || 'Transit TV'}</title>
</svelte:head>

<div class="container">
	<header>
		<table cellpadding="0" cellspacing="0" border="0">
			<tbody>
				<tr>
					<td id="logo">
						<a href="https://transitapp.com"></a>
					</td>
					<td id="title">
						<h1>{$config.title || 'Nearby Routes'}</h1>
						<button type="button" on:click={openConfig}></button>
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
			<h2>Configure Transit TV</h2>
			<form on:submit|preventDefault={() => {}}>
				<label>
					Title:
					<input type="text" bind:value={$config.title} />
				</label>

				<label>
					Location (lat, lng):
					<input
						type="text"
						value={`${$config.latLng.latitude}, ${$config.latLng.longitude}`}
						on:input={(e) => config.setLatLngStr(e.currentTarget.value)}
					/>
				</label>

				<label>
					Time Format:
					<select bind:value={$config.timeFormat}>
						<option value="hh:mm A">12 Hours</option>
						<option value="HH:mm">24 Hours</option>
					</select>
				</label>

				<label>
					Language:
					<select bind:value={$config.language}>
						<option value="en">English</option>
						<option value="fr">Français</option>
					</select>
				</label>

				<button
					type="button"
					on:click={() => {
						config.save();
						config.update((c) => ({ ...c, isEditing: false }));
						loadNearby();
						intervalId = setInterval(loadNearby, 20000);
					}}
				>
					Save
				</button>
			</form>
		</div>
	{/if}

	<div class="content">
		{#if loading}
			<div class="loading">Loading routes...</div>
		{:else if routes.length === 0}
			<div class="no-routes">No routes found nearby</div>
		{:else}
			<section id="routes">
				{#each routes as route (route.global_route_id)}
					<RouteItem {route} />
				{/each}
			</section>
		{/if}
	</div>
</div>

<style>
	.container {
		width: 100%;
		height: 100%;
		background: #fafafa;
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
		color: #ffffff;
		background-color: #30b566;
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
		width: 1.6em;
		height: 1.6em;
		background: none;
		background-image: url('/assets/images/settings@2x.png');
		background-size: 1.6em auto;
		outline: none;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
		vertical-align: top;
		border: none;
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
		background: white;
		padding: 2em;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		min-width: 400px;
	}

	.config-modal h2 {
		margin-top: 0;
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
	}

	.config-modal input,
	.config-modal select {
		padding: 0.5em;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1em;
	}

	.config-modal button {
		padding: 0.7em 1.5em;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1em;
	}

	.config-modal button:hover {
		background: #0056b3;
	}

	.loading,
	.no-routes {
		text-align: center;
		padding: 3em;
		font-size: 1.5em;
		color: #666;
	}
</style>
