<script lang="ts">
	import {
		getAllActiveAlerts,
		formatAlertText,
		parseAlertContent,
		extractImageId,
		getAlertIcon
	} from '$lib/services/alerts';
	import type { Route } from '$lib/services/nearby';

	export let routes: Route[] = [];

	$: alerts = getAllActiveAlerts(routes);
</script>

{#if alerts.length > 0}
	<div class="alert-ticker">
		<div class="ticker-content">
			{#each alerts as alert, i}
				<span class="alert-item">
					<iconify-icon icon={getAlertIcon(alert.alert)} class="alert-icon"></iconify-icon>
					{#each parseAlertContent(formatAlertText(alert)) as content}
						{#if content.type === 'text'}
							{content.value}
						{:else if content.type === 'image'}
							<img
								src="/api/images/{extractImageId(content.value)}"
								alt="transit icon"
								class="alert-image"
							/>
						{/if}
					{/each}
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
		vertical-align: middle;
	}

	.separator {
		margin: 0 2em;
		opacity: 0.7;
	}

	.alert-image {
		height: 1.2em;
		display: inline-block;
		margin: 0 0.2em;
		vertical-align: middle;
	}
</style>
