<script lang="ts">
	import { config } from '$lib/stores/config';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { init, locale, register } from 'svelte-i18n';
	import { _ } from 'svelte-i18n';
	import '../app.css';
	import "iconify-icon";

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
	let windowWidth = $state(0);
	let isScreenTooNarrow = $derived(windowWidth > 0 && windowWidth < 640);
	let mediaQueryCleanup: (() => void) | null = null;
	let resizeCleanup: (() => void) | null = null;

	onMount(async () => {
		await config.load();
		// Sync i18n locale with config language after loading config
		locale.set($config.language);

		// Detect system color scheme preference
		if (browser && window.matchMedia) {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			systemPrefersDark = mediaQuery.matches;

			const handleChange = (e: MediaQueryListEvent) => {
				systemPrefersDark = e.matches;
			};

			mediaQuery.addEventListener('change', handleChange);

			// Store cleanup function
			mediaQueryCleanup = () => {
				mediaQuery.removeEventListener('change', handleChange);
			};
		}

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
	});

	onDestroy(() => {
		if (mediaQueryCleanup) {
			mediaQueryCleanup();
		}
		if (resizeCleanup) {
			resizeCleanup();
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

{#if isScreenTooNarrow}
	<div class="screen-width-warning">
		<div class="warning-content">
			<iconify-icon icon="ix:warning-filled"></iconify-icon>
			<h2>{$_('screenWidth.title')}</h2>
			<p>{$_('screenWidth.message')}</p>
			<p class="min-width-note">{$_('screenWidth.minimumWidth')}</p>
		</div>
	</div>
{/if}

{@render children()}

<style>
	.screen-width-warning {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.95);
		z-index: 10000;
		display: flex;
		justify-content: center;
		align-items: center;
		color: white;
	}

	.warning-content {
		text-align: center;
		max-width: 90%;
		padding: 2em;
	}

	.warning-content iconify-icon {
		font-size: 5em;
		color: #ffd700;
		display: block;
		margin: 0 auto 0.5em;
	}

	.warning-content h2 {
		font-size: 2em;
		margin: 0 0 0.5em 0;
		font-weight: 600;
	}

	.warning-content p {
		font-size: 1.3em;
		margin: 0.5em 0;
		line-height: 1.5;
	}

	.min-width-note {
		font-size: 1.1em;
		color: #cccccc;
		margin-top: 1em;
	}
</style>
