<script lang="ts">
	import QR from '@svelte-put/qr/svg/QR.svelte';

	interface Props {
		latitude: number;
		longitude: number;
		size?: number;
	}

	let { latitude, longitude, size = 150 }: Props = $props();

	const deepLink = $derived(
		`transitapp.com/deep-links?url=transit://routes?q=${latitude},${longitude}`
	);
</script>

<div class="qr-container">
	<QR data={deepLink} width={size} height={size} shape="square" />
</div>

<style>
	.qr-container {
		display: inline-block;
		line-height: 0;
	}

	/* Ensure QR code is always black on white for maximum contrast */
	.qr-container :global(svg) {
		background: white;
	}

	.qr-container :global(svg path),
	.qr-container :global(svg rect),
	.qr-container :global(svg circle),
	.qr-container :global(svg polygon) {
		fill: black !important;
	}
</style>
