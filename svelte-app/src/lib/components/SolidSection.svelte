<script lang="ts">
	/**
	 * Reusable Solid section component
	 * Provides non-collapsible section functionality with consistent visual style
	 *
	 * @component
	 * @example
	 * <SolidSection title="Style Settings" helpText="Customize the appearance">
	 *   <div>Your content here</div>
	 * </SolidSection>
	 */

	interface Props {
		/** Section title displayed in the header */
		title?: string;
		/** Optional help text displayed below the title */
		helpText?: string;
		/** Optional CSS class for the container */
		containerClass?: string;
	}

	let { title = '', helpText = '', containerClass = '' }: Props = $props();
</script>

<div class="solid-section {containerClass}">
	<div class="solid-header" id="solid-header-{title}">
		<h3 class="solid-title">{title}</h3>
	</div>

	<div
		class="solid-content"
		id="solid-content-{title}"
		role="region"
		aria-labelledby="solid-header-{title}"
	>
		{#if helpText}
			<p class="help-text">{helpText}</p>
		{/if}
		<slot />
	</div>
</div>

<style>
	.solid-section {
		margin: 0;
	}

	.solid-header {
		margin: 0 0 1rem 0;
		padding: 0;
		background: transparent;
	}

	.solid-title {
		margin: 0;
		font-size: 1.2em;
		font-weight: 600;
		color: var(--text-primary);
		opacity: 0.9;
	}

	.solid-content {
		padding: 0;
		background: transparent;
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.help-text {
		margin: 0 0 1rem 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}
</style>
