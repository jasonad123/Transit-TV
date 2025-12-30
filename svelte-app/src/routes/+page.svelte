<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import { formatCoordinatesForDisplay } from '$lib/utils/formatters';
	import RouteItem from '$lib/components/RouteItem.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import type { Route } from '$lib/services/nearby';
	import 'iconify-icon';
	let routes = $state<Route[]>([]);
	let allRoutes = $state<Route[]>([]);
	let intervalId: ReturnType<typeof setInterval>;
	let clockIntervalId: ReturnType<typeof setInterval>;
	let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
	let errorRetryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let loading = $state(true);
	let currentTime = $state(new Date());
	let errorMessage = $state<string | null>(null);
	let retryCountdown = $state<number | null>(null);
	let errorType = $state<'rate-limit' | 'auth' | 'timeout' | 'backend' | 'generic' | null>(null);

	// Screen width check
	let windowWidth = $state(0);
	let isScreenTooNarrow = $derived(windowWidth > 0 && windowWidth < 640);
	let resizeCleanup: (() => void) | null = null;
	let isMounted = $state(false);

	// Geolocation state
	let gettingLocation = $state(false);
	let locationError = $state<string | null>(null);

	// Location validation state
	let validatingLocation = $state(false);
	let validationMessage = $state<string | null>(null);
	let validationSuccess = $state<boolean | null>(null);

	// Server status state
	let serverStatus = $state<{
		isShutdown: boolean;
		shutdownTime: string | null;
	}>({
		isShutdown: false,
		shutdownTime: null
	});
	let serverStatusIntervalId: ReturnType<typeof setInterval> | null = null;
	let serverActionInProgress = $state(false);

	// App version state
	let appVersion = $state<string>('1.3.1'); // Fallback version

	// Adaptive polling configuration
	let consecutiveErrors = 0;
	// Default 10s for free tier (5 calls/min), paid tier can use 5-7s via env var
	const MIN_POLLING_INTERVAL = parseInt(import.meta.env.VITE_CLIENT_POLLING_INTERVAL || '10000'); // Default 10s
	let currentPollingInterval = MIN_POLLING_INTERVAL; // Start at minimum
	const MAX_POLLING_INTERVAL = 120000; // 2 minutes maximum
	const BACKOFF_MULTIPLIER = 1.5;

	function resetPollingInterval() {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (!$config.isEditing) {
			intervalId = setInterval(loadNearby, currentPollingInterval);
		}
	}

	function increasePollingInterval() {
		consecutiveErrors++;
		const newInterval = Math.min(currentPollingInterval * BACKOFF_MULTIPLIER, MAX_POLLING_INTERVAL);
		if (newInterval !== currentPollingInterval) {
			currentPollingInterval = newInterval;
			console.log(`Increasing polling interval to ${currentPollingInterval}ms due to errors`);
			resetPollingInterval();
		}
	}

	function resetPollingToNormal() {
		consecutiveErrors = 0;
		if (currentPollingInterval !== MIN_POLLING_INTERVAL) {
			currentPollingInterval = MIN_POLLING_INTERVAL;
			console.log(`Resetting polling interval to ${currentPollingInterval}ms`);
			resetPollingInterval();
		}
	}

	// Helper function to format time based on configured format
	function formatTime(date: Date, format: string, language: string): string {
		if (format === 'hh:mm') {
			// 12-hour format without AM/PM - manual formatting required
			let hours = date.getHours();
			const minutes = date.getMinutes();

			// Convert to 12-hour format
			if (hours === 0) {
				hours = 12; // Midnight is 12:XX
			} else if (hours > 12) {
				hours = hours - 12;
			}

			// Pad minutes with leading zero
			const minutesStr = minutes.toString().padStart(2, '0');

			return `${hours}:${minutesStr}`;
		} else {
			// Use toLocaleTimeString for other formats
			return date.toLocaleTimeString(language, {
				hour: 'numeric',
				minute: '2-digit',
				hour12: format.startsWith('hh:mm')
			});
		}
	}

	async function loadNearby() {
		// Don't poll Transit API if server is in shutdown state
		if (serverStatus.isShutdown) {
			console.log('Skipping Transit API poll - server is shutdown');
			return;
		}

		try {
			const currentConfig = $config;
			if (!currentConfig.latLng) return;

			const fetchedRoutes = await findNearbyRoutes(currentConfig.latLng, currentConfig.maxDistance);
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
			errorMessage = null;
			retryCountdown = null;
			errorType = null;
			// Success - reset polling to normal interval
			resetPollingToNormal();
		} catch (err) {
			console.error('Error loading nearby routes:', err);
			loading = false;

			// Clear any existing retry timers
			if (countdownIntervalId) {
				clearInterval(countdownIntervalId);
				countdownIntervalId = null;
			}
			if (errorRetryTimeoutId) {
				clearTimeout(errorRetryTimeoutId);
				errorRetryTimeoutId = null;
			}

			const error = err as any;

			// Handle rate limiting
			if (error.isRateLimit) {
				errorType = 'rate-limit';
				const retryAfter = error.retryAfter || 60;
				errorMessage = $_('errors.rateLimit', { values: { seconds: retryAfter } });
				retryCountdown = retryAfter;

				// Increase polling interval on rate limit
				increasePollingInterval();

				// Countdown timer
				countdownIntervalId = setInterval(() => {
					if (retryCountdown !== null && retryCountdown > 0) {
						retryCountdown--;
						errorMessage = $_('errors.rateLimit', { values: { seconds: retryCountdown } });
					} else {
						if (countdownIntervalId) {
							clearInterval(countdownIntervalId);
							countdownIntervalId = null;
						}
						errorMessage = null;
						errorType = null;
						retryCountdown = null;
						loadNearby();
					}
				}, 1000);
			}
			// Handle authentication errors - don't retry automatically
			else if (error.isAuthError) {
				errorType = 'auth';
				errorMessage = $_('errors.auth');
				// Don't increase polling interval or auto-retry for auth errors
				// Manual intervention required
			}
			// Handle timeout errors
			else if (error.isTimeout) {
				errorType = 'timeout';
				errorMessage = $_('errors.timeout');
				increasePollingInterval();

				errorRetryTimeoutId = setTimeout(() => {
					errorMessage = null;
					errorType = null;
					errorRetryTimeoutId = null;
					loadNearby();
				}, 10000); // Retry after 10 seconds for timeouts
			}
			// Handle backend unavailable
			else if (error.isBackendError) {
				errorType = 'backend';
				errorMessage = $_('errors.backend');
				increasePollingInterval();

				errorRetryTimeoutId = setTimeout(() => {
					errorMessage = null;
					errorType = null;
					errorRetryTimeoutId = null;
					loadNearby();
				}, 20000);
			}
			// Generic error handling
			else {
				errorType = 'generic';
				errorMessage = $_('errors.generic');
				increasePollingInterval();

				errorRetryTimeoutId = setTimeout(() => {
					errorMessage = null;
					errorType = null;
					errorRetryTimeoutId = null;
					loadNearby();
				}, 20000);
			}
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

		// Track window width for screen size check
		if (browser) {
			windowWidth = window.innerWidth;

			const handleResize = () => {
				windowWidth = window.innerWidth;
			};

			window.addEventListener('resize', handleResize);

			// Store cleanup function
			resizeCleanup = () => {
				window.removeEventListener('resize', handleResize);
			};
		}

		// Fetch app version from server
		try {
			const apiBase = browser
				? window.location.port === '5173'
					? 'http://localhost:8080'
					: ''
				: '';
			const healthResponse = await fetch(`${apiBase}/health`);
			if (healthResponse.ok) {
				const healthData = await healthResponse.json();
				appVersion = healthData.version || '1.3.1';
			}
		} catch (err) {
			console.log('Could not fetch version, using fallback');
		}

		// Check server status first, before starting polling
		await checkServerStatus();
		serverStatusIntervalId = setInterval(checkServerStatus, 10000);

		// Only load routes if screen is wide enough and server is not shutdown
		if (!$config.isEditing && !isScreenTooNarrow && !serverStatus.isShutdown) {
			await loadNearby();
			// Use adaptive polling interval (starts at 20s)
			intervalId = setInterval(loadNearby, currentPollingInterval);
		}

		// Update clock every second
		clockIntervalId = setInterval(() => {
			currentTime = new Date();
		}, 1000);

		// Mark as mounted to enable reactive width effects
		isMounted = true;
	});

	// React to screen width changes (only after mount to avoid double loading)
	$effect(() => {
		if (!isMounted) return;

		if (isScreenTooNarrow) {
			// Screen too narrow - stop polling
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = undefined!;
			}
		} else if (!$config.isEditing && !serverStatus.isShutdown) {
			// Screen wide enough and server running - start/resume polling if not already running
			if (!intervalId) {
				loadNearby();
				intervalId = setInterval(loadNearby, currentPollingInterval);
			}
		}
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (clockIntervalId) {
			clearInterval(clockIntervalId);
		}
		if (countdownIntervalId) {
			clearInterval(countdownIntervalId);
		}
		if (errorRetryTimeoutId) {
			clearTimeout(errorRetryTimeoutId);
		}
		if (serverStatusIntervalId) {
			clearInterval(serverStatusIntervalId);
		}
		if (resizeCleanup) {
			resizeCleanup();
		}
	});

	function openConfig() {
		config.update((c) => ({ ...c, isEditing: true }));
	}

	function closeConfig() {
		// Cancel any changes by reloading or just hiding?
		// Existing cancel button just hides. Save button saves then hides.
		// Clicking outside usually implies cancel/dismiss.
		config.update((c) => ({ ...c, isEditing: false }));
	}

	function handleKeydown(e: KeyboardEvent) {
		if ($config.isEditing && e.key === 'Escape') {
			closeConfig();
		}
	}

	async function validateLocation(latitude: number, longitude: number) {
		if (!$config.isEditing) return; // Only validate during interactive config
		if (serverStatus.isShutdown) return; // Don't validate when server is shutdown

		validatingLocation = true;
		validationMessage = null;
		validationSuccess = null;

		try {
			const routes = await findNearbyRoutes({ latitude, longitude }, $config.maxDistance);
			const count = routes.length;

			if (count > 0) {
				validationSuccess = true;
				validationMessage = $_('config.location.validationSuccess', {
					values: { count, plural: count !== 1 ? 's' : '' }
				});
			} else {
				validationSuccess = false;
				validationMessage = $_('config.location.validationNoRoutes');
			}
		} catch (error) {
			validationSuccess = false;
			validationMessage = $_('config.location.validationError');
		} finally {
			validatingLocation = false;
		}
	}

	function useCurrentLocation() {
		if (!browser || !navigator.geolocation) {
			locationError = $_('config.location.geolocationNotSupported');
			return;
		}

		gettingLocation = true;
		locationError = null;

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				config.update((c) => ({
					...c,
					latLng: {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude
					}
				}));
				gettingLocation = false;
				locationError = null;

				// Validate the location
				await validateLocation(position.coords.latitude, position.coords.longitude);
			},
			(error) => {
				gettingLocation = false;
				switch (error.code) {
					case error.PERMISSION_DENIED:
						locationError = $_('config.location.geolocationPermissionDenied');
						break;
					case error.POSITION_UNAVAILABLE:
						locationError = $_('config.location.geolocationUnavailable');
						break;
					case error.TIMEOUT:
						locationError = $_('config.location.geolocationTimeout');
						break;
					default:
						locationError = $_('config.location.geolocationError');
						break;
				}
			},
			{
				enableHighAccuracy: false,
				timeout: 10000,
				maximumAge: 0
			}
		);
	}

	function handleLocationInputBlur() {
		// Clear validation when user starts typing again
		validationMessage = null;
		validationSuccess = null;

		// Validate if we have valid coordinates
		if ($config.latLng && !isNaN($config.latLng.latitude) && !isNaN($config.latLng.longitude)) {
			validateLocation($config.latLng.latitude, $config.latLng.longitude);
		}
	}

	// Server status and control functions
	async function checkServerStatus() {
		try {
			const response = await fetch('/api/server/status');
			if (response.ok) {
				const status = await response.json();
				serverStatus = {
					isShutdown: status.isShutdown,
					shutdownTime: status.shutdownTime
				};
			}
		} catch (error) {
			console.error('Error checking server status:', error);
		}
	}

	async function shutdownServer() {
		if (!confirm($_('config.server.confirmShutdown'))) {
			return;
		}

		serverActionInProgress = true;
		try {
			const response = await fetch('/api/server/shutdown', { method: 'POST' });
			if (response.ok) {
				await checkServerStatus();
			}
		} catch (error) {
			console.error('Error shutting down server:', error);
			alert('Failed to shutdown server');
		} finally {
			serverActionInProgress = false;
		}
	}

	async function startServer() {
		serverActionInProgress = true;
		try {
			const response = await fetch('/api/server/start', { method: 'POST' });
			if (response.ok) {
				await checkServerStatus();
				// Reload routes after starting
				setTimeout(() => {
					loadNearby();
				}, 1000);
			}
		} catch (error) {
			console.error('Error starting server:', error);
			alert('Failed to start server');
		} finally {
			serverActionInProgress = false;
		}
	}

</script>

<svelte:head>
	<title>{$config.title || $_('app.title')}</title>

	<link rel="icon" type="image/png" href="/assets/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
	<link rel="shortcut icon" href="/assets/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="Transit TV" />
	<link rel="manifest" href="/assets/site.webmanifest" />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container" style="--bg-header: {$config.headerColor}">
	<header>
		<table cellpadding="0" cellspacing="0" border="0">
			<tbody>
				<tr>
					<td id="logo">
						<div class="logo-container">
							<a href="https://transitapp.com" aria-label={$_('aria.transitApp')}>
								<img
									src="/assets/images/transit.svg"
									alt="Powered by Transit"
									class="transit-logo"
								/>
							</a>
							{#if $config.customLogo}
								<img
									src={$config.customLogo}
									alt={$_('aria.customLogo')}
									class="custom-logo"
									onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
								/>
							{/if}
						</div>
					</td>
					<td id="title">
						<h1>{$config.title || $_('app.nearbyRoutes')}</h1>
						<button type="button" onclick={openConfig} aria-label={$_('aria.settings')}
							><iconify-icon icon="ix:cogwheel-filled"></iconify-icon></button
						>
					</td>
					<td id="utilities">
						<span class="clock"
							>{formatTime(currentTime, $config.timeFormat, $config.language)}</span
						>
					</td>
				</tr>
			</tbody>
		</table>
	</header>

	{#if $config.isEditing}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={closeConfig}>
			<div class="config-modal" onclick={(e) => e.stopPropagation()}>
				<h2>{$_('config.title')}</h2>
				<form onsubmit={(e) => e.preventDefault()}>
					<label>
						{$_('config.fields.title')}
						<input type="text" bind:value={$config.title} />
					</label>

					<label>
						{$_('config.fields.location')}
						<div class="location-input-group">
							<input
								type="text"
								value={formatCoordinatesForDisplay(
									$config.latLng.latitude,
									$config.latLng.longitude
								)}
								oninput={(e) => {
									config.setLatLngStr(e.currentTarget.value);
									validationMessage = null;
									validationSuccess = null;
								}}
								onblur={handleLocationInputBlur}
								placeholder="latitude, longitude"
							/>
							<button
								type="button"
								class="btn-location"
								onclick={useCurrentLocation}
								disabled={gettingLocation}
								title={gettingLocation ? 'Getting location...' : 'Use current location'}
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
									<path
										fill="currentColor"
										d="M8 10.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m.5-9a.5.5 0 0 0-1 0v1.525A5 5 0 0 0 3.025 7.5H1.5a.5.5 0 0 0 0 1h1.525A5 5 0 0 0 7.5 12.976V14.5a.5.5 0 0 0 1 0v-1.524A5 5 0 0 0 12.975 8.5H14.5a.5.5 0 1 0 0-1h-1.525A5 5 0 0 0 8.5 3.025zM8 12a4 4 0 1 1 0-8a4 4 0 0 1 0 8"
									/>
								</svg>
							</button>
						</div>
						{#if locationError}
							<span class="location-error">{locationError}</span>
						{/if}
						{#if validatingLocation}
							<span class="location-validating">{$_('config.location.validating')}</span>
						{:else if validationMessage}
							<span
								class="location-validation"
								class:success={validationSuccess}
								class:error={!validationSuccess}
							>
								{validationMessage}
							</span>
						{/if}
					</label>

					<label>
						{$_('config.fields.timeFormat')}
						<select bind:value={$config.timeFormat}>
							<option value="hh:mm A">{$_('config.timeFormats.12hour')}</option>
							<option value="hh:mm">{$_('config.timeFormats.12hourNoAmPm')}</option>
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
						{$_('config.fields.maxDistance')}
						<div class="slider-container">
							<input
								type="range"
								min="250"
								max="1500"
								step="250"
								bind:value={$config.maxDistance}
								class="distance-slider"
								style="--slider-progress: {(($config.maxDistance - 250) / (1500 - 250)) * 100}%"
							/>
							<div class="slider-labels">
								<span>{$config.maxDistance}m</span>
							</div>
						</div>
					</label>

					<label>
						{$_('config.fields.columns')}
						<div class="button-group">
							<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 'auto'}
								onclick={() => config.update((c) => ({ ...c, columns: 'auto' }))}
							>
								{$_('config.columns.auto')}
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 1}
								onclick={() => config.update((c) => ({ ...c, columns: 1 }))}
							>
								1
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 2}
								onclick={() => config.update((c) => ({ ...c, columns: 2 }))}
							>
								2
							</button>
			<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 3}
								onclick={() => config.update((c) => ({ ...c, columns: 3 }))}
							>
								3
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 4}
								onclick={() => config.update((c) => ({ ...c, columns: 4 }))}
							>
								4
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.columns === 5}
								onclick={() => config.update((c) => ({ ...c, columns: 5 }))}
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
								onclick={() => config.update((c) => ({ ...c, theme: 'light' }))}
							>
								{$_('config.theme.light')}
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.theme === 'auto'}
								onclick={() => config.update((c) => ({ ...c, theme: 'auto' }))}
							>
								{$_('config.theme.auto')}
							</button>
							<button
								type="button"
								class="btn-option"
								class:active={$config.theme === 'dark'}
								onclick={() => config.update((c) => ({ ...c, theme: 'dark' }))}
							>
								{$_('config.theme.dark')}
							</button>
						</div>
					</label>

					<label>
						{$_('config.fields.headerColor')}
						<div style="display: flex; gap: 0.5em; align-items: center;">
							<input type="color" bind:value={$config.headerColor} />
							<button
								type="button"
								class="btn-reset"
								onclick={() => {
									const defaultColor = $config.theme === 'dark' ? '#1f7a42' : '#30b566';
									config.update((c) => ({ ...c, headerColor: defaultColor }));
								}}
								title={$_('config.buttons.resetToDefault')}
							>
								{$_('config.buttons.reset')}
							</button>
						</div>
					</label>

					<label>
						{$_('config.fields.customLogo')}
						<input
							type="text"
							bind:value={$config.customLogo}
							placeholder="https://example.com/logo.png or /assets/images/logo.png"
						/>
						<small class="help-text">{$_('config.customLogo.helpText')}</small>
						{#if $config.customLogo}
							<div style="display: flex; gap: 0.5em; margin-top: 0.5em;">
								<button
									type="button"
									class="btn-reset"
									onclick={() => config.update((c) => ({ ...c, customLogo: null }))}
								>
									{$_('config.customLogo.clear')}
								</button>
							</div>
							<div class="logo-preview">
								<img
									src={$config.customLogo}
									alt="Logo preview"
									onerror={(e) => {
										const parent = (e.currentTarget as HTMLImageElement).parentElement;
										if (parent) {
											parent.innerHTML = `<span class="error">${$_('config.customLogo.invalidUrl')}</span>`;
										}
									}}
								/>
							</div>
						{/if}
					</label>

					<div class="toggle-container">
						<label class="toggle-label">
							<span>{$_('config.fields.showQRCode')} </span>
							<label class="toggle-switch">
								<input type="checkbox" bind:checked={$config.showQRCode} />
								<span class="toggle-slider"></span>
							</label>
						</label>
						<small class="help-text">{$_('config.qrCode.helpText')}</small>
					</div>

					<div class="toggle-container">
						<label class="toggle-label">
							<span>{$_('config.fields.groupItinerariesByStop')}</span>
							<label class="toggle-switch">
								<input type="checkbox" bind:checked={$config.groupItinerariesByStop} />
								<span class="toggle-slider"></span>
							</label>
						</label>
						<small class="help-text">{$_('config.stopManagement.groupItinerarieshelpText')}</small>
					</div>

					<div class="toggle-container">
						<label class="toggle-label">
							<span>{$_('config.fields.filterRedundantTerminus')}</span>
							<label class="toggle-switch">
								<input type="checkbox" bind:checked={$config.filterRedundantTerminus} />
								<span class="toggle-slider"></span>
							</label>
						</label>
						<small class="help-text">{$_('config.stopManagement.filterTerminushelpText')}</small>
					</div>

					<div class="toggle-container">
						<label class="toggle-label">
							<span>{$_('config.fields.showRouteLongName')}</span>
							<label class="toggle-switch">
								<input type="checkbox" bind:checked={$config.showRouteLongName} />
								<span class="toggle-slider"></span>
							</label>
						</label>
						<small class="help-text">{$_('config.routeDisplay.showRouteLongNameHelpText')}</small>
					</div>

					<CollapsibleSection
						title={$_('config.hiddenRoutes.title')}
						helpText={$_('config.hiddenRoutes.helpText')}
						initiallyOpen={false}
					>
						{#if $config.hiddenRoutes.length > 0}
							<div class="route-management">
								<div class="hidden-routes-list">
									{#each allRoutes.filter( (r) => $config.hiddenRoutes.includes(r.global_route_id) ) as route}
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
					</CollapsibleSection>

					<CollapsibleSection
						title={$_('config.server.title')}
						helpText={$_('config.server.helpText')}
						initiallyOpen={false}
						containerClass="server-management"
					>
						<div class="server-status">
							<span class="status-label">Status:</span>
							<span
								class="status-value"
								class:status-running={!serverStatus.isShutdown}
								class:status-shutdown={serverStatus.isShutdown}
							>
								{serverStatus.isShutdown
									? $_('config.server.status.shutdown')
									: $_('config.server.status.running')}
							</span>
						</div>

						<div class="button-group server-controls-buttons">
							<button
								type="button"
								class="btn-server-control btn-shutdown"
								onclick={shutdownServer}
								disabled={serverStatus.isShutdown || serverActionInProgress}
							>
								{$_('config.server.actions.shutdown')}
							</button>
							<button
								type="button"
								class="btn-server-control btn-start"
								onclick={startServer}
								disabled={!serverStatus.isShutdown || serverActionInProgress}
							>
								{$_('config.server.actions.start')}
							</button>
						</div>
					</CollapsibleSection>

					<div class="credits">
						<h3>{$_('config.credits.title')}</h3>
						<h4>
							Transit TV version <a
								href="https://github.com/jasonad123/Transit-TV/releases/tag/v{appVersion}"
								target="_blank"
								rel="noopener">{appVersion}</a
							>
						</h4>
						<p class="help-text">
							{@html $_('config.credits.madeWith')}
						</p>
						<p class="help-text">
							{@html $_('config.credits.links')}
						</p>
						<a
							href="https://transitapp.com/partners/apis"
							target="_blank"
							rel="noopener noreferrer"
							class="api-badge-link"
						>
							<img src="/assets/images/api-badge.svg" alt="Transit Logo" class="credits-logo" /></a
						>
					</div>

					<div class="modal-actions">
						<button type="button" class="btn-cancel" onclick={closeConfig}>
							{$_('config.buttons.cancel')}
						</button>
						<button
							type="button"
							class="btn-save"
							onclick={() => {
								config.save();
								config.update((c) => ({ ...c, isEditing: false }));
								loadNearby();
								// Reset to current polling interval
								intervalId = setInterval(loadNearby, currentPollingInterval);
							}}
						>
							{$_('config.buttons.save')}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<div class="content">
		{#if serverStatus.isShutdown}
			<div class="shutdown-notice">
				<div class="shutdown-icon-stack">
					<iconify-icon icon="fluent:vehicle-bus-20-filled" class="bus-icon"></iconify-icon>
					<iconify-icon icon="ix:maintenance-warning-filled" class="warning-badge"></iconify-icon>
				</div>
				<h2>{$_('shutdown.title')}</h2>
				<p>{$_('shutdown.message')}</p>
				<p class="shutdown-subtitle">{$_('shutdown.subtitle')}</p>
			</div>
		{:else}
			{#if errorMessage}
				<div
					class="error-banner"
					class:error-auth={errorType === 'auth'}
					class:error-timeout={errorType === 'timeout'}
					class:error-backend={errorType === 'backend'}
				>
					<iconify-icon icon={errorType === 'auth' ? 'ix:unlock-filled' : 'ix:warning-rhomb'}
					></iconify-icon>
					{errorMessage}
				</div>
			{/if}
			{#if loading}
				<div class="loading">{$_('routes.loading')}</div>
			{:else if routes.length === 0}
				<div class="no-routes">{$_('routes.noRoutes')}</div>
			{:else}
				<section
					id="routes"
					class:cols-1={$config.columns === 1}
					class:cols-2={$config.columns === 2}
					class:cols-3={$config.columns === 3}
					class:cols-4={$config.columns === 4}
					class:cols-5={$config.columns === 5}
				>
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
		{/if}
	</div>

	{#if $config.showQRCode && !$config.isEditing}
		<div class="floating-qr">
			<p class="qr-label">
				<span class="qr-label-1">{$_('config.qrCode.scanPrompt')}<br /></span>
				<span class="qr-label-2">{$_('config.qrCode.scanPrompt2')}</span>
			</p>
			<QRCode latitude={$config.latLng.latitude} longitude={$config.latLng.longitude} size={100} />
		</div>
	{/if}
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
		height: calc(100vh - 4.9em);
		position: relative;
	}

	.content section {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		padding: 0;
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

	.logo-container {
		display: flex;
		align-items: center;
		gap: 0.5em;
		width: 100%;
	}

	.transit-logo {
		height: 3.5em;
		width: auto;
		display: block;
	}

	.custom-logo {
		height: 3.5em;
		width: auto;
		max-width: 120px;
		object-fit: contain;
		flex-shrink: 0;
	}

	#logo a {
		display: block;
		flex-shrink: 0;
		text-decoration: none;
	}

	#title {
		width: 34%;
		text-align: center;
		vertical-align: middle;
		border: none;
	}

	#title h1 {
		font-family: 'Overpass Variable', Helvetica, Arial, serif;
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
		background-size: 2em auto;
		outline: none;
		cursor: pointer;
		opacity: 0;
		/* transition: opacity 0.3s ease-in-out; */
		vertical-align: middle;
		border: none;
		backface-visibility: hidden;
		-webkit-font-smoothing: antialiased;
	}

	#title button iconify-icon {
		width: 2em;
		height: 2em;
		font-size: 2em;
		color: #ffffff;
		transform: translateY(-5%);
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
		font-family: 'Overpass Variable', Helvetica, Arial, serif;
		line-height: 2.1em;
		font-weight: 500;
		display: inline-block;
		margin-left: 3em;
		margin-right: 0.5em;
		vertical-align: middle;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(1px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.config-modal {
		background: var(--bg-secondary);
		color: var(--text-primary);
		padding: 2em;
		border-radius: 8px;
		box-shadow: 0 4px 6px var(--shadow-color);
		max-width: 30vw;
		min-width: 400px;
		max-height: 80vh;
		overflow-y: auto;
		/* Reset fixed positioning since we are using flex in parent */
		position: relative;
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
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	.help-text {
		display: block;
		margin-top: 0.25em;
		margin-bottom: 0;
		font-size: 0.95em;
		color: var(--text-secondary);
		word-wrap: break-word;
		overflow-wrap: break-word;
		max-width: 100%;
	}

	.logo-preview {
		margin-top: 0.5em;
		padding: 1em;
		background: var(--bg-header);
		border-radius: 4px;
		text-align: center;
	}

	.logo-preview img {
		max-height: 60px;
		max-width: 200px;
		object-fit: contain;
	}

	.modal-actions {
		display: flex;
		gap: 1em;
		justify-content: flex-end;
		margin-top: 0.5em;
	}

	.config-modal button {
		padding: 0.65em 1.5em 0.55em 1.5em;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1em;
		font-family: 'Overpass Variable', Helvetica, Arial, serif;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
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

	.toggle-container {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
	}

	.toggle-label {
		display: flex;
		flex-direction: row !important;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-bottom: 0;
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
		content: '';
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
		padding: 0.5em 0.5em;
	}

	/* Responsive auto-layout defaults */
	@media (min-width: 2560px) {
		.route-wrapper {
			width: 20%; /* 5 columns at 2.5K+ */
		}
	}

	@media (min-width: 3200px) {
		.route-wrapper {
			width: 16.666%; /* 6 columns at 3.2K+ */
		}
	}

	/* Column overrides (take precedence over auto-layout) */
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
		margin-top: 0;
		padding-top: 1em;
		border-top: 1px solid var(--border-color);
	}

	.route-management h3 {
		margin-top: 0;
		margin-bottom: 0.5em;
		font-size: 1.2em;
		color: var(--text-primary);
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
		font-weight: 700;
		line-height: 1;
	}

	.hidden-route-item:hover {
		background: var(--bg-primary);
	}

	.hidden-route-item iconify-icon {
		color: var(--text-secondary);
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		flex-shrink: 0;
		font-size: 1.2em;
	}

	.hidden-route-item span {
		font-weight: 500;
		color: var(--text-primary);
		display: flex;
		align-items: center;
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
		flex: 2;
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
		border-color: var(--bg-header);
		background: var(--bg-primary);
	}

	.btn-option.active {
		border-color: var(--bg-header);
		background-color: var(--bg-header);
		color: white;
		font-weight: 600;
	}

	/* QR Code Styles */
	.floating-qr {
		position: fixed;
		bottom: 1.5em;
		right: 0.75em;
		z-index: 100;
		background: var(--bg-header);
		padding: 1em;
		border-radius: 1em;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: transform 0.2s ease;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 1.2em;
		min-width: 19.8%;
		max-width: 24em;
		min-height: 125px;
		max-height: auto;
	}

	.floating-qr:hover {
		transform: scale(1.02);
	}

	.floating-qr :global(svg) {
		display: block;
		background: white;
		padding: 0.4em;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.floating-qr :global(svg path),
	.floating-qr :global(svg rect),
	.floating-qr :global(svg circle),
	.floating-qr :global(svg polygon) {
		fill: var(--bg-header) !important;
	}

	.qr-label {
		margin: 0;
		color: white;
		font-size: 1.3em;
		text-align: left;
		letter-spacing: 0.02em;
		opacity: 0.95;
		flex: 1;
		overflow-wrap: break-word;
		line-height: 1.5;
	}
	.qr-label-1 {
		font-weight: 400;
	}
	.qr-label-2 {
		font-weight: bold;
	}

	/* .qr-section {
		margin-top: 1em;
		padding: 1em;
		background: var(--bg-secondary);
		border-radius: 8px;
		text-align: center;
	}

	.qr-section h3 {
		margin: 0 0 0.5em 0;
		font-size: 1.1em;
		color: var(--text-primary);
	}

	.qr-section .help-text {
		margin: 0 0 1em 0;
		font-size: 0.9em;
		color: var(--text-secondary);
	}

	.qr-display {
		display: flex;
		justify-content: center;
		align-items: center;
		background: white;
		padding: 1.5em;
		border-radius: 8px;
		width: fit-content;
		margin: 0 auto;
		border: 2px solid #ddd;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	[data-theme="dark"] .qr-display {
		background: white;
		border-color: #666;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
	} */

	.error-banner {
		position: fixed;
		top: 5.5em;
		left: 50%;
		transform: translateX(-50%);
		background: #e30079;
		color: white;
		padding: 1em 2em;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 200;
		font-size: 1.5em;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.75em;
		animation: slideDown 0.3s ease-out;
	}

	.error-banner iconify-icon {
		font-size: 1.5em;
	}

	.error-banner.error-auth {
		background: #ff6b00;
	}

	.error-banner.error-timeout {
		background: #f59e0b;
	}

	.error-banner.error-backend {
		background: #8b5cf6;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Location input group */
	.location-input-group {
		display: flex;
		gap: 0.5em;
		align-items: center;
	}

	.location-input-group input {
		flex: 1;
	}

	.btn-location {
		flex-shrink: 0;
		width: auto;
		padding: 0.4em 0.5em;
		background: var(--bg-header);
		color: white;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1em;
		backface-visibility: hidden;
		-webkit-font-smoothing: antialiased;
	}

	.btn-location:hover:not(:disabled) {
		opacity: 0.85;
	}

	.btn-location:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-location svg {
		width: 1.25em;
		height: 1.25em;
		display: block;
		color: white;
	}

	.location-error {
		display: block;
		color: #e30022;
		font-size: 0.9em;
		margin-top: 0.3em;
	}

	.location-validating {
		display: block;
		color: var(--text-secondary);
		font-size: 0.9em;
		margin-top: 0.3em;
		font-style: italic;
	}

	.location-validation {
		display: block;
		font-size: 0.9em;
		margin-top: 0.3em;
		font-weight: 500;
	}

	.location-validation.success {
		color: #30b566;
	}

	.location-validation.error {
		color: #f59e0b;
	}

	.slider-container {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		padding: 0.3em 9px;
	}

	.distance-slider {
		width: 100%;
		height: 4px;
		border-radius: 10px;
		background: var(--border-color);
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
		box-sizing: border-box;
	}

	.distance-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		margin-top: -7px;
	}

	.distance-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.distance-slider::-webkit-slider-runnable-track {
		width: 100%;
		height: 4px;
		background: linear-gradient(
			to right,
			var(--bg-header) 0%,
			var(--bg-header) var(--slider-progress, 0%),
			var(--border-color) var(--slider-progress, 0%),
			var(--border-color) 100%
		);
		border-radius: 10px;
	}

	.distance-slider::-moz-range-track {
		width: 100%;
		height: 4px;
		background: var(--border-color);
		border-radius: 10px;
	}

	.distance-slider::-moz-range-progress {
		background: var(--bg-header);
		height: 4px;
		border-radius: 10px;
	}

	.slider-labels {
		display: flex;
		justify-content: center;
		font-size: 0.9em;
		font-weight: 500;
		color: var(--text-primary);
	}

	/* Server Management Styles */
	.server-management {
		max-width: 500px;
	}

	.server-status {
		display: flex;
		align-items: center;
		gap: 0.75em;
		margin-bottom: 1em;
		padding: 0.75em;
		background: var(--bg-primary);
		border-radius: 4px;
		border: 1px solid var(--border-color);
	}

	.status-label {
		font-weight: 600;
		color: var(--text-primary);
	}

	.status-value {
		font-weight: 700;
		padding: 0.3em 0.8em;
		border-radius: 4px;
		font-size: 0.9em;
	}

	.status-running {
		background: #30b566;
		color: white;
	}

	.status-shutdown {
		background: #f59e0b;
		color: white;
	}

	.server-controls-buttons {
		display: flex;
		gap: 0.5em;
	}

	.btn-server-control {
		flex: 1;
		padding: 0.7em 1em;
		border: 2px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.95em;
		font-weight: 600;
		color: white;
	}

	.btn-server-control:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-shutdown {
		background: #e30022;
		border-color: #e30022;
	}

	.btn-shutdown:hover:not(:disabled) {
		background: #b8001b;
		border-color: #b8001b;
	}

	.btn-start {
		background: #30b566;
		border-color: #30b566;
	}

	.btn-start:hover:not(:disabled) {
		background: #1f7a42;
		border-color: #1f7a42;
	}

	/* Shutdown Notice Styles */
	.shutdown-notice {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		padding: 3em;
		color: var(--text-primary);
	}

	.shutdown-icon-stack {
		position: relative;
		display: inline-block;
		margin-bottom: 0.5em;
	}

	.shutdown-icon-stack .bus-icon {
		font-size: 8em;
		color: var(--text-secondary);
		display: block;
	}

	.shutdown-icon-stack .warning-badge {
		position: absolute;
		bottom: -0.05em;
		right: -0.1em;
		font-size: 3em;
		color: #f59e0b;
		background: var(--bg-primary);
		border-radius: 50%;
		padding: 0.1px;
	}

	.shutdown-notice h2 {
		font-size: 3em;
		margin: 0.3em 0;
		color: var(--text-primary);
		text-wrap: wrap;
		overflow-wrap: normal;
	}

	.shutdown-notice p {
		font-size: 1.8em;
		margin: 0.5em 0;
		color: var(--text-secondary);
	}

	.shutdown-subtitle {
		font-size: 1.4em;
		font-style: italic;
		opacity: 0.8;
	}

	/* Credits Styles */
	.credits {
		margin-top: 0;
		padding-top: 1em;
		border-top: 1px solid var(--border-color);
		text-align: left;
	}

	.credits h3 {
		margin-top: 0;
		margin-bottom: 0.5em;
		font-size: 1.2em;
		color: var(--text-primary);
	}

	.credits h4 {
		margin-bottom: 0.2em;
		font-size: 1em;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.credits .help-text {
		text-align: left;
		line-height: 1.5;
		font-size: 0.85em;
	}

	:global(.credits iconify-icon) {
		display: inline-block !important;
		vertical-align: middle !important;
		font-size: 1.3em !important;
		transform: translateY(-1px);
	}

	.credits-logo {
		margin-top: 0.5em;
		height: 40px;
		width: auto;
		display: block;
	}

	:global(.credits a) {
		color: var(--bg-header);
		text-decoration: none;
		font-weight: 500;
	}

	:global(.credits a:hover) {
		text-decoration: underline;
	}
</style>
