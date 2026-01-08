<script lang="ts">
	import { getAlertIcon } from '$lib/services/alerts';
	import type { Alert } from '$lib/services/nearby';

	interface Props {
		alerts: Alert[];
		severity?: 'severe' | 'warning' | 'info';
	}

	let { alerts = [], severity = 'info' }: Props = $props();

	let alertCount = $derived(alerts.length);
	let icon = $derived.by(() => {
		if (severity === 'severe') return 'ix:warning-octagon-filled';
		if (severity === 'warning') return 'ix:warning-filled';
		return 'ix:about-filled';
	});
</script>

{#if alertCount > 0}
	<div class="minimal-alert-indicator" class:severe={severity === 'severe'} class:warning={severity === 'warning'} class:info={severity === 'info'}>
		<iconify-icon {icon} class="alert-icon"></iconify-icon>
		<span class="alert-count">{alertCount}</span>
	</div>
{/if}

<style>
	.minimal-alert-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.4em 0.6em;
		border-radius: 0.5em;
		font-weight: bold;
		font-size: 1.2em;
		white-space: nowrap;
	}

	.minimal-alert-indicator.severe {
		background-color: #e30613;
		color: #ffffff;
	}

	.minimal-alert-indicator.warning {
		background-color: #ffa700;
		color: #000000;
	}

	.minimal-alert-indicator.info {
		background-color: rgba(0, 0, 0, 0.1);
		color: inherit;
	}

	.alert-icon {
		font-size: 1.2em;
		display: block;
	}

	.alert-count {
		font-size: 1em;
		line-height: 1;
	}
</style>
