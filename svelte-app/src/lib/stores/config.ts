import { writable } from 'svelte/store';
import { browser } from '$app/environment';

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
	showRouteLongName: boolean;
	showQRCode: boolean;
}

const defaultConfig: Config = {
	id: '',
	isEditing: true,
	title: '',
	routeOrder: [],
	hiddenRoutes: [],
	latLng: {
		latitude: 40.724029430769484,
		longitude: -74.00022736495859
	},
	timeFormat: 'HH:mm',
	language: 'en',
	columns: 'auto',
	theme: 'light',
	headerColor: '#30b566',
	showRouteLongName: true,
	showQRCode: false
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
					console.log('Unattended config not available');
				}

				const savedConfig = browser ? localStorage.getItem('config') : null;
				if (savedConfig) {
					try {
						const parsed = JSON.parse(savedConfig);
						set({
							...defaultConfig,
							...parsed,
							isEditing: false
						});
					} catch (e) {
						console.error('Error parsing saved config:', e);
					}
				}
			})();

			return loadPromise;
		},

		save() {
			if (!browser) return;

			update((current) => {
				const toSave = { ...current };
				delete (toSave as Partial<Config>).isEditing;
				localStorage.setItem('config', JSON.stringify(toSave));
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
