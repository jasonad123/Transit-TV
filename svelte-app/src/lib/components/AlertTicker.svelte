<script lang="ts">
	import { getAllActiveAlerts, formatAlertText } from '$lib/services/alerts';
	import type { Route } from '$lib/services/nearby';

	export let routes: Route[] = [];

	$: alerts = getAllActiveAlerts(routes);
</script>

{#if alerts.length > 0}
	<div class="alert-ticker">
		<div class="ticker-content">
			{#each alerts as alert, i}
				<span class="alert-item">
					<i class="alert-icon {alert.isAlert ? 'alert' : 'info'}"></i>
					{formatAlertText(alert)}
					{#if i < alerts.length - 1}
						<span class="separator">•</span>
					{/if}
				</span>
			{/each}
		</div>
	</div>
{/if}

<style>
	.alert-ticker {
		width: 100%;
		background: #d32f2f;
		color: white;
		font-size: 1.6em;
		font-weight: bold;
		font-family: Helvetica, Arial, sans-serif;
		padding: 0.6em 0;
		overflow: hidden;
		white-space: nowrap;
		position: relative;
		z-index: 100;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	@keyframes scroll-left {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(-100%);
		}
	}

	.ticker-content {
		display: inline-block;
		animation: scroll-left 60s linear infinite;
		padding-left: 100%;
	}

	.alert-icon {
		margin: 0 0.3em;
		font-style: normal;
	}

	.alert-icon.alert:before {
		content: '\26A0';
	}

	.alert-icon.info:before {
		content: '\24D8';
	}

	.separator {
		margin: 0 2em;
		opacity: 0.7;
	}
</style>
