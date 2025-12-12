import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getCookie, setCookie } from '$lib/utils/cookies';

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface Config {
	id: string;
	isEditing: boolean;
	title: string;
	routeOrder: string[];
	hiddenRoutes: string[];
	latLng: LatLng;
	timeFormat: string;
	language: string;
	columns: 'auto' | 1 | 2 | 3 | 4 | 5;
	theme: 'light' | 'dark' | 'auto';
	headerColor: string;
	showQRCode: boolean;
	maxDistance: number;
	customLogo: string | null;
}

const defaultConfig: Config = {
	id: '',
	isEditing: true,
	title: '',
	routeOrder: [],
	hiddenRoutes: [],
	latLng: {
		latitude: 40.75426683398718,
		longitude: -73.98672703719805
	},
	timeFormat: 'HH:mm A',
	language: 'en',
	columns: 'auto',
	theme: 'light',
	headerColor: '#30b566',
	showQRCode: false,
	maxDistance: 500,
	customLogo: null
};

function createConfigStore() {
	const { subscribe, set, update } = writable<Config>(defaultConfig);

	let loadPromise: Promise<void> | null = null;

	return {
		subscribe,
		set,
		update,

		async load() {
			if (!browser) return;

			if (loadPromise) {
				return loadPromise;
			}

			loadPromise = (async () => {
				// Priority 1: Check for user-saved preferences (cookies first, then localStorage)
				const savedConfig = browser ? getCookie('config') || localStorage.getItem('config') : null;
				if (savedConfig) {
					try {
						const parsed = JSON.parse(savedConfig);
						set({
							...defaultConfig,
							...parsed,
							isEditing: false
						});

						// Migrate localStorage to cookies if found in localStorage
						if (browser && localStorage.getItem('config')) {
							setCookie('config', savedConfig);
							localStorage.removeItem('config');
							console.log('Migrated config from localStorage to cookies');
						}
						return;
					} catch (e) {
						console.error('Error parsing saved config:', e);
					}
				}

				// Priority 2: If no user preferences, try unattended config (provides defaults)
				try {
					const response = await fetch('/api/config/unattended');
					if (response.ok) {
						const unattendedConfig = await response.json();
						set({
							...defaultConfig,
							...unattendedConfig,
							isEditing: false
						});
						return;
					}
				} catch (e) {
					console.log('Unattended config not available, using defaults');
				}
			})();

			return loadPromise;
		},

		save() {
			if (!browser) return;

			update((current) => {
				const toSave = { ...current };
				delete (toSave as Partial<Config>).isEditing;

				try {
					// Use cookies for better kiosk mode persistence
					setCookie('config', JSON.stringify(toSave));
				} catch (e) {
					console.error('Error saving config to cookies:', e);
					// Fall back to localStorage
					try {
						localStorage.setItem('config', JSON.stringify(toSave));
						console.log('Saved to localStorage as fallback');
					} catch (localStorageError) {
						console.error('Both cookie and localStorage save failed:', localStorageError);
					}
				}

				return current;
			});
		},

		get latLngStr() {
			let value = '';
			subscribe((config) => {
				value = `${config.latLng.latitude}, ${config.latLng.longitude}`;
			})();
			return value;
		},

		setLatLngStr(val: string) {
			const latLngArr = val.split(',');
			if (latLngArr.length === 2) {
				const lat = parseFloat(latLngArr[0].trim());
				const lng = parseFloat(latLngArr[1].trim());

				if (!isNaN(lat) && !isNaN(lng)) {
					update((config) => ({
						...config,
						latLng: { latitude: lat, longitude: lng }
					}));
				}
			}
		}
	};
}

export const config = createConfigStore();
