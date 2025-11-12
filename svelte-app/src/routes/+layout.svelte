<script lang="ts">
	import { config } from '$lib/stores/config';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		config.load();
	});
</script>

{@render children()}
