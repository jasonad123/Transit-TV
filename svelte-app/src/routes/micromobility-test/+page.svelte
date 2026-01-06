<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchPlacemarks,
		analyzePlacemarks,
		type PlacemarksResponse,
		type MicromobilityStats,
		type Placemark
	} from '$lib/services/placemarks';
	import type { LatLng } from '$lib/services/nearby';

	// Default to Times Square, NYC for testing
	let latitude = 40.7589;
	let longitude = -73.9851;
	let distance = 500;
	let loading = false;
	let error: string | null = null;
	let response: PlacemarksResponse | null = null;
	let stats: MicromobilityStats | null = null;

	async function fetchData() {
		loading = true;
		error = null;
		response = null;
		stats = null;

		try {
			const location: LatLng = {
				latitude: parseFloat(latitude.toString()),
				longitude: parseFloat(longitude.toString())
			};

			response = await fetchPlacemarks(location, distance);
			stats = analyzePlacemarks(response);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error occurred';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		// Auto-fetch on mount for convenience
		fetchData();
	});
</script>

<div class="container">
	<h1>Micromobility API Test</h1>

	<div class="controls">
		<div class="input-group">
			<label for="lat">Latitude:</label>
			<input id="lat" type="number" step="0.0001" bind:value={latitude} />
		</div>

		<div class="input-group">
			<label for="lon">Longitude:</label>
			<input id="lon" type="number" step="0.0001" bind:value={longitude} />
		</div>

		<div class="input-group">
			<label for="distance">Distance (m):</label>
			<input id="distance" type="number" step="50" bind:value={distance} />
		</div>

		<button on:click={fetchData} disabled={loading}>
			{loading ? 'Loading...' : 'Fetch Placemarks'}
		</button>
	</div>

	{#if error}
		<div class="error">
			<strong>Error:</strong>
			{error}
		</div>
	{/if}

	{#if stats}
		<div class="results">
			<h2>Statistics</h2>

			<div class="stats-grid">
				<div class="stat-card">
					<h3>Floating Vehicles</h3>
					<div class="stat-value">{stats.floatingVehicles.total}</div>

					{#if Object.keys(stats.floatingVehicles.byType).length > 0}
						<h4>By Type:</h4>
						<ul>
							{#each Object.entries(stats.floatingVehicles.byType) as [type, count]}
								<li>{type}: {count}</li>
							{/each}
						</ul>
					{/if}

					{#if Object.keys(stats.floatingVehicles.byProvider).length > 0}
						<h4>By Provider:</h4>
						<ul>
							{#each Object.entries(stats.floatingVehicles.byProvider) as [provider, count]}
								<li>{provider}: {count}</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="stat-card">
					<h3>Stations</h3>
					<div class="stat-value">{stats.stations.total}</div>

					{#if Object.keys(stats.stations.byProvider).length > 0}
						<h4>By Provider:</h4>
						<ul>
							{#each Object.entries(stats.stations.byProvider) as [provider, count]}
								<li>{provider}: {count}</li>
							{/each}
						</ul>
					{/if}

					{#if stats.stations.descriptions.length > 0}
						<h4>Descriptions:</h4>
						<ul>
							{#each stats.stations.descriptions as description}
								<li>{description}</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if response}
		<div class="raw-data">
			<h2>Raw Response ({response.placemarks.length} placemarks)</h2>

			<div class="placemarks-list">
				{#each response.placemarks as placemark, i}
					<div class="placemark-card">
						<div class="placemark-header">
							<span class="placemark-type">{placemark.type}</span>
							<span class="placemark-id">ID: {placemark.id}</span>
						</div>

						<div class="placemark-location">
							📍 {placemark.lat.toFixed(4)}, {placemark.lon.toFixed(4)}
						</div>

						{#if placemark.type === 'floating'}
							{#if placemark.vehicle_type}
								<div>Type: {placemark.vehicle_type}</div>
							{/if}
						{:else if placemark.type === 'station'}
							{#if placemark.name}
								<div><strong>{placemark.name}</strong></div>
							{/if}
							{#if placemark.description}
								<div class="description">{placemark.description}</div>
							{/if}
						{/if}

						{#if placemark.provider}
							<div>Provider: {placemark.provider}</div>
						{/if}

						<details>
							<summary>Full JSON</summary>
							<pre>{JSON.stringify(placemark, null, 2)}</pre>
						</details>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		margin-bottom: 2rem;
		color: #333;
	}

	.controls {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 8px;
		flex-wrap: wrap;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #555;
	}

	input {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	button {
		padding: 0.5rem 1.5rem;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		align-self: flex-end;
	}

	button:hover:not(:disabled) {
		background: #0052a3;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		padding: 1rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c00;
		margin-bottom: 1rem;
	}

	.results {
		margin-bottom: 2rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.stat-card {
		padding: 1.5rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.stat-card h3 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	.stat-card h4 {
		margin: 1rem 0 0.5rem 0;
		font-size: 0.875rem;
		color: #666;
		text-transform: uppercase;
	}

	.stat-value {
		font-size: 3rem;
		font-weight: bold;
		color: #0066cc;
	}

	.stat-card ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.stat-card li {
		margin: 0.25rem 0;
	}

	.raw-data {
		margin-top: 2rem;
	}

	.placemarks-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.placemark-card {
		padding: 1rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.placemark-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.placemark-type {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #0066cc;
		color: white;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
	}

	.placemark-id {
		font-size: 0.75rem;
		color: #999;
	}

	.placemark-location {
		margin: 0.5rem 0;
		color: #666;
	}

	.description {
		margin: 0.5rem 0;
		padding: 0.5rem;
		background: #f0f8ff;
		border-left: 3px solid #0066cc;
		font-weight: 600;
	}

	details {
		margin-top: 0.5rem;
		cursor: pointer;
	}

	summary {
		font-size: 0.75rem;
		color: #0066cc;
		user-select: none;
	}

	pre {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.75rem;
	}
</style>
