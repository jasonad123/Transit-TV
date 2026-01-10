<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import { formatCoordinatesForDisplay } from '$lib/utils/formatters';
	import RouteItem from '$lib/components/RouteItem.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import SolidSection from '$lib/components/SolidSection.svelte';
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

	// App version state
	let appVersion = $state<string>('1.3.5'); // Fallback version

	// Auto-scale state
	let contentScale = $state(1.0);
	let routesElement = $state<HTMLElement | null>(null);
	let scaleCheckTimeout: ReturnType<typeof setTimeout> | null = null;
	let isCalculatingScale = false;
	const MIN_CONTENT_SCALE = 0.68; // Accessibility: allow more aggressive scaling to fit content

	let shouldApplyAutoScale = $derived(
		$config.autoScaleContent &&
			!$config.isEditing &&
			routes.length > 0 &&
			!loading &&
			$config.columns === 'auto' // Only auto-scale when using auto columns
	);

	// Split routes with too many cards into multiple display items
	const MAX_CARDS_PER_ROUTE = 3;

	let displayRoutes = $derived.by(() => {
		const result: (Route & { _splitIndex?: number; _totalSplits?: number })[] = [];

		for (const route of routes) {
			const itineraries = route.itineraries || [];

			// Skip routes with no departures
			if (itineraries.length === 0) {
				continue;
			}

			const maxItineraries = MAX_CARDS_PER_ROUTE;

			if (itineraries.length <= maxItineraries) {
				// Fits in one card
				result.push(route);
			} else {
				// Group by direction_id to keep directions together
				const directionGroups = new Map<number | undefined, typeof itineraries>();
				for (const itinerary of itineraries) {
					const dirId = itinerary.direction_id;
					if (!directionGroups.has(dirId)) {
						directionGroups.set(dirId, []);
					}
					directionGroups.get(dirId)!.push(itinerary);
				}

				// Split into chunks, trying to keep direction groups intact
				const chunks: (typeof itineraries)[] = [];
				let currentChunk: typeof itineraries = [];

				for (const [_, dirItineraries] of directionGroups) {
					if (currentChunk.length + dirItineraries.length <= maxItineraries) {
						// Fits in current chunk
						currentChunk.push(...dirItineraries);
					} else {
						// Start new chunk
						if (currentChunk.length > 0) {
							chunks.push(currentChunk);
							currentChunk = [];
						}
						// If single direction is too large, split it
						if (dirItineraries.length > maxItineraries) {
							for (let i = 0; i < dirItineraries.length; i += maxItineraries) {
								chunks.push(dirItineraries.slice(i, i + maxItineraries));
							}
						} else {
							currentChunk.push(...dirItineraries);
						}
					}
				}
				if (currentChunk.length > 0) {
					chunks.push(currentChunk);
				}

				// Create split route items
				chunks.forEach((chunk, index) => {
					result.push({
						...route,
						itineraries: chunk,
						alerts: index === 0 ? route.alerts : [], // Alert only on first chunk
						_splitIndex: index,
						_totalSplits: chunks.length
					});
				});
			}
		}

		return result;
	});

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

	function calculateContentScale() {
		if (!routesElement || !shouldApplyAutoScale) {
			if (!shouldApplyAutoScale) {
				contentScale = 1.0;
			}
			return;
		}

		// Cancel any pending calculation
		if (scaleCheckTimeout) {
			clearTimeout(scaleCheckTimeout);
		}

		scaleCheckTimeout = setTimeout(() => {
			// Prevent concurrent calculations
			if (isCalculatingScale) {
				return;
			}
			isCalculatingScale = true;

			requestAnimationFrame(() => {
				try {
					// Verify element is still in DOM
					if (!routesElement || !routesElement.isConnected) {
						return;
					}

					// Use untrack to prevent contentScale from being a dependency
					const previousScale = untrack(() => contentScale);

					// Temporarily reset to 100% to measure natural height
					const prevFontSize = routesElement.style.fontSize;
					routesElement.style.fontSize = '100%';

					// Force layout recalculation
					routesElement.offsetHeight;

					// Measure natural height at 100% scale
					const naturalHeight = routesElement.scrollHeight;

					// Restore previous font-size (to avoid visual flash)
					routesElement.style.fontSize = prevFontSize;

					const headerHeight =
						4.9 * parseFloat(getComputedStyle(document.documentElement).fontSize);
					const availableHeight = window.innerHeight - headerHeight - 10; // 10px buffer for safety

					const calculatedScale = availableHeight / naturalHeight;
					const newScale = Math.min(1.0, Math.max(MIN_CONTENT_SCALE, calculatedScale));

					// Only update if scale changed significantly (more than 2% to avoid animation-induced jitter)
					if (Math.abs(newScale - previousScale) > 0.02) {
						contentScale = newScale;
						console.log(
							`Auto-scale: ${routes.length} routes (${displayRoutes.length} cards), natural=${naturalHeight.toFixed(0)}px, available=${availableHeight.toFixed(0)}px, scale=${contentScale.toFixed(3)}`
						);
					}
				} finally {
					isCalculatingScale = false;
				}
			});
		}, 300); // Increased debounce to reduce sensitivity to animations
	}

	onMount(async () => {
		await config.load();

		// Track window width for screen size check
		if (browser) {
			windowWidth = window.innerWidth;

			const handleResize = () => {
				windowWidth = window.innerWidth;
				if (shouldApplyAutoScale) {
					calculateContentScale();
				}
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
				appVersion = healthData.version || '1.3.5';
			}
		} catch (err) {
			console.log('Could not fetch version, using fallback');
		}

		// Only load routes if screen is wide enough
		if (!$config.isEditing && !isScreenTooNarrow) {
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
		} else if (!$config.isEditing) {
			// Screen wide enough - start/resume polling if not already running
			if (!intervalId) {
				loadNearby();
				intervalId = setInterval(loadNearby, currentPollingInterval);
			}
		}
	});

	// Enforce auto columns when auto-scale is enabled
	$effect(() => {
		if ($config.autoScaleContent && ($config.columns !== 'auto' || $config.manualColumnsMode)) {
			config.update((c) => ({
				...c,
				columns: 'auto',
				manualColumnsMode: false
			}));
		}
	});

	// When manual mode is toggled, handle column value transitions
	$effect(() => {
		if ($config.manualColumnsMode && $config.columns === 'auto') {
			// Switching to manual mode: set a default numeric value
			config.update((c) => ({ ...c, columns: 3 }));
		} else if (
			!$config.manualColumnsMode &&
			!$config.autoScaleContent &&
			$config.columns !== 'auto'
		) {
			// Switching from manual to auto mode
			config.update((c) => ({ ...c, columns: 'auto' }));
		}
	});

	// Recalculate scale when relevant dependencies change
	$effect(() => {
		// Explicit dependencies - use untrack to prevent feedback loops from contentScale changes
		void [
			shouldApplyAutoScale,
			displayRoutes.length,
			$config.columns,
			$config.isEditing,
			windowWidth
		];

		untrack(() => {
			if (shouldApplyAutoScale) {
				calculateContentScale();
			} else {
				contentScale = 1.0;
			}
		});
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (clockIntervalId) {
			clearInterval(clockIntervalId);
		}
		if (scaleCheckTimeout) {
			clearTimeout(scaleCheckTimeout);
		}
		if (countdownIntervalId) {
			clearInterval(countdownIntervalId);
		}
		if (errorRetryTimeoutId) {
			clearTimeout(errorRetryTimeoutId);
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
						<input
							type="range"
							min="250"
							max="1500"
							step="250"
							bind:value={$config.maxDistance}
							class="styled-slider"
							style="--slider-progress: {(($config.maxDistance - 250) / (1500 - 250)) * 100}%"
						/>
						<div class="slider-value">
							{$config.maxDistance}m
						</div>
					</label>

					<SolidSection title={$_('config.sections.display')}>
						<div class="toggle-container">
							<Toggle bind:checked={$config.manualColumnsMode} disabled={$config.autoScaleContent}>
								{#snippet label()}
									<span>{$_('config.columns.manualColumnControl')}</span>
								{/snippet}
							</Toggle>
							{#if $config.autoScaleContent}
								<small class="toggle-help-text">{$_('config.autoScale.autoColumnsHelpText')}</small>
							{/if}
						</div>

						{#if $config.manualColumnsMode && typeof $config.columns === 'number'}
							<label>
								{$_('config.fields.columns')}
								<input
									type="range"
									min="1"
									max="8"
									value={$config.columns}
									class="styled-slider"
									style="--slider-progress: {(($config.columns - 1) / (8 - 1)) * 100}%"
									oninput={(e) => {
										const value = parseInt(e.currentTarget.value);
										config.update((c) => ({
											...c,
											columns: value as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
										}));
									}}
								/>
								<div class="slider-value">
									{$_('config.columns.word', { values: { count: $config.columns } })}
								</div>
							</label>
						{:else if !$config.autoScaleContent}
							<small class="toggle-help-text">{$_('config.columns.automaticColumnControl')}</small>
						{/if}

						<div class="toggle-container">
							<Toggle bind:checked={$config.showQRCode}>
								{#snippet label()}
									<span>{$_('config.fields.showQRCode')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text">{$_('config.qrCode.helpText')}</small>
						</div>

						<div class="toggle-container">
							<Toggle bind:checked={$config.autoScaleContent}>
								{#snippet label()}
									<span>{$_('config.fields.autoScaleContent')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text">{$_('config.autoScale.helpText')}</small>
						</div>
					</SolidSection>

					<SolidSection title={$_('config.sections.style')}>
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
					</SolidSection>

					<SolidSection title={$_('config.sections.routeOptions')}>
						<div class="toggle-container">
							<Toggle bind:checked={$config.groupItinerariesByStop}>
								{#snippet label()}
									<span>{$_('config.fields.groupItinerariesByStop')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text"
								>{$_('config.stopManagement.groupItinerarieshelpText')}</small
							>
						</div>

						<div class="toggle-container">
							<Toggle bind:checked={$config.filterRedundantTerminus}>
								{#snippet label()}
									<span>{$_('config.fields.filterRedundantTerminus')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text"
								>{$_('config.stopManagement.filterTerminushelpText')}</small
							>
						</div>

						<div class="toggle-container">
							<Toggle bind:checked={$config.showRouteLongName}>
								{#snippet label()}
									<span>{$_('config.fields.showRouteLongName')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text"
								>{$_('config.routeDisplay.showRouteLongNameHelpText')}</small
							>
						</div>

						<div class="toggle-container">
							<Toggle bind:checked={$config.minimalAlerts}>
								{#snippet label()}
									<span>{$_('config.fields.minimalAlerts')}</span>
								{/snippet}
							</Toggle>
							<small class="toggle-help-text">{$_('config.alerts.minimalAlertsHelpText')}</small>
						</div>
					</SolidSection>

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
		{#if errorMessage}
			<div
				class="error-banner"
				class:error-auth={errorType === 'auth'}
				class:error-timeout={errorType === 'timeout'}
				class:error-backend={errorType === 'backend'}
			>
				<iconify-icon icon={errorType === 'auth' ? 'ix:disconnected' : 'ix:warning-rhomb'}
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
				bind:this={routesElement}
				style:font-size={shouldApplyAutoScale && contentScale < 1 ? `${contentScale * 100}%` : null}
				class:cols-1={$config.columns === 1}
				class:cols-2={$config.columns === 2}
				class:cols-3={$config.columns === 3}
				class:cols-4={$config.columns === 4}
				class:cols-5={$config.columns === 5}
				class:cols-6={$config.columns === 6}
				class:cols-7={$config.columns === 7}
				class:cols-8={$config.columns === 8}
			>
				{#each displayRoutes as route, index (`${route.global_route_id}-${route._splitIndex ?? 0}`)}
					<div class="route-wrapper" transition:fade={{ duration: 300 }}>
						<RouteItem {route} showLongName={$config.showRouteLongName} />
						{#if route._splitIndex !== undefined && route._totalSplits !== undefined}
							<div class="route-split-badge">
								{route._splitIndex + 1}/{route._totalSplits}
							</div>
						{/if}
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

	#routes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 0;
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

	.toggle-help-text {
		display: block !important;
		margin-top: 0.25em;
		margin-bottom: 0;
		font-size: 0.95em;
		color: var(--text-secondary);
		word-wrap: break-word;
		overflow-wrap: break-word;
		max-width: 85%;
	}

	.slider-value {
		text-align: center;
		font-size: 0.9em;
		font-weight: 500;
		margin-top: 0.5em;
		color: var(--text-primary);
	}

	.route-wrapper {
		box-sizing: border-box;
		position: relative;
		padding: 0.3em 0.4em;
		min-width: 0; /* Allow grid items to shrink below content size */
	}

	.route-split-badge {
		position: absolute;
		top: 0.8em;
		right: 0.8em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.75);
		color: white;
		font-size: 0.85em;
		font-weight: 600;
		padding: 0.3em 0.5em;
		border-radius: 0.3em;
		z-index: 5;
		backdrop-filter: blur(4px);
		box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2);
	}

	/* Manual column overrides */
	#routes.cols-1 {
		grid-template-columns: repeat(1, minmax(0, 1fr));
	}

	#routes.cols-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	#routes.cols-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	#routes.cols-4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	#routes.cols-5 {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}

	#routes.cols-6 {
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}

	#routes.cols-7 {
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	#routes.cols-8 {
		grid-template-columns: repeat(8, minmax(0, 1fr));
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

	/* .route-management {
		margin-top: 0;
		padding-top: 1em;
		border-top: 1px solid var(--border-color);
	} */

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

	/* Floating QR Code Styles */
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

	.styled-slider {
		width: 100%;
		height: 4px;
		border-radius: 10px;
		background: transparent;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
		box-sizing: border-box;
		margin: 0.5em 0;
	}

	.styled-slider::-webkit-slider-thumb {
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

	.styled-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.styled-slider::-webkit-slider-runnable-track {
		width: 100%;
		height: 4px;
		background: linear-gradient(
			to right,
			var(--bg-header) 0%,
			var(--bg-header) var(--slider-progress, 0%),
			rgba(0, 0, 0, 0.1) var(--slider-progress, 0%),
			rgba(0, 0, 0, 0.1) 100%
		);
		border-radius: 10px;
	}

	.styled-slider::-moz-range-track {
		width: 100%;
		height: 4px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: 10px;
	}

	.styled-slider::-moz-range-progress {
		background: var(--bg-header);
		height: 4px;
		border-radius: 10px;
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

	/* QR Code Section Styles */

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
</style>
