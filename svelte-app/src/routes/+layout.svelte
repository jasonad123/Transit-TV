<script lang="ts">
	import { config } from '$lib/stores/config';
	import { onMount } from 'svelte';
	import { init, locale, register, waitLocale } from 'svelte-i18n';
	import '../app.css';
	import '@fortawesome/fontawesome-free/css/solid.min.css';
	import '@fortawesome/fontawesome-free/css/fontawesome.min.css';

	let { children } = $props();

	// Register translation files
	register('en', () => import('$lib/i18n/en.json'));
	register('fr', () => import('$lib/i18n/fr.json'));

	init({
		fallbackLocale: 'en',
		initialLocale: 'en'
	});

	// Set initial locale immediately
	locale.set('en');

	onMount(async () => {
		await config.load();
		// Sync i18n locale with config language after loading config
		locale.set($config.language);
	});

	// Watch for config language changes
	$effect(() => {
		if ($config.language) {
			locale.set($config.language);
		}
	});
</script>

{@render children()}
