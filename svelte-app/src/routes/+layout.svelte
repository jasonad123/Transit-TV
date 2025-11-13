<script lang="ts">
	import { config } from '$lib/stores/config';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { init, locale, register } from 'svelte-i18n';
	import '../app.css';
	import '@fortawesome/fontawesome-free/css/solid.min.css';
	import '@fortawesome/fontawesome-free/css/fontawesome.min.css';

	let { children } = $props();

	// Register translation files
	register('en', () => import('$lib/i18n/en.json'));
	register('fr', () => import('$lib/i18n/fr.json'));
	register('es', () => import('$lib/i18n/es.json'));
	register('de', () => import('$lib/i18n/de.json'));

	init({
		fallbackLocale: 'en',
		initialLocale: 'en'
	});

	// Set initial locale immediately
	locale.set('en');

	let systemPrefersDark = $state(false);

	onMount(async () => {
		await config.load();
		// Sync i18n locale with config language after loading config
		locale.set($config.language);

		// Detect system color scheme preference
		if (browser && window.matchMedia) {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			systemPrefersDark = mediaQuery.matches;

			mediaQuery.addEventListener('change', (e) => {
				systemPrefersDark = e.matches;
			});
		}
	});

	// Watch for config language changes
	$effect(() => {
		if ($config.language) {
			locale.set($config.language);
		}
	});

	// Compute effective theme
	$effect(() => {
		if (browser) {
			const effectiveTheme = $config.theme === 'auto'
				? (systemPrefersDark ? 'dark' : 'light')
				: $config.theme;

			document.documentElement.setAttribute('data-theme', effectiveTheme);
		}
	});
</script>

{@render children()}
