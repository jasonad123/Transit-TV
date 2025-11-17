<script lang="ts">
	import QR from '@svelte-put/qr/svg/QR.svelte';

	interface Props {
		latitude: number;
		longitude: number;
		size?: number;
	}

	let { latitude, longitude, size = 150 }: Props = $props();

	const deepLink = $derived(`transit://routes?q=${latitude},${longitude}`);
</script>

<div class="qr-container">
	<QR
		data={deepLink}
		width={size}
		height={size}
		shape="circle"
	/>
</div>

<style>
	.qr-container {
		display: inline-block;
		line-height: 0;
	}
</style>
