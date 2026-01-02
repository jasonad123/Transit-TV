<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Reusable collapsible section component
	 * Provides accessible, animated expand/collapse functionality
	 *
	 * @component
	 * @example
	 * <CollapsibleSection title="Server Management" helpText="Control server lifecycle" initiallyOpen={false}>
	 *   <div>Your content here</div>
	 * </CollapsibleSection>
	 */

	interface Props {
		/** Section title displayed in the header */
		title?: string;
		/** Optional help text displayed below the title when expanded */
		helpText?: string;
		/** Whether the section should be open by default */
		initiallyOpen?: boolean;
		/** Optional CSS class for the container */
		containerClass?: string;
		/** Content to display in the collapsible section */
		children: Snippet;
	}

	let {
		title = '',
		helpText = '',
		initiallyOpen = false,
		containerClass = '',
		children
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let isOpen = $state(initiallyOpen);

	function toggle() {
		isOpen = !isOpen;
	}

	// Keyboard accessibility
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggle();
		}
	}
</script>

<div class="collapsible-section {containerClass}">
	<button
		type="button"
		class="collapsible-header"
		class:is-open={isOpen}
		onclick={toggle}
		onkeydown={handleKeydown}
		aria-expanded={isOpen}
		aria-controls="collapsible-content-{title}"
	>
		<h3 class="collapsible-title">{title}</h3>
		<svg
			class="collapsible-icon"
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M5 7.5L10 12.5L15 7.5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	{#if isOpen}
		<div
			class="collapsible-content"
			id="collapsible-content-{title}"
			role="region"
			aria-labelledby="collapsible-header-{title}"
		>
			{#if helpText}
				<p class="help-text">{helpText}</p>
			{/if}
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.collapsible-section {
		margin: 0;
		padding-top: 1.5rem;
		margin-top: 1.5rem;
		position: relative;
	}

	.collapsible-section::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background-color: var(--text-secondary);
		opacity: 0.3;
	}

	.collapsible-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s ease;
		text-align: left;
	}

	.collapsible-header:hover {
		opacity: 0.7;
	}

	.collapsible-header:focus {
		outline: none;
		opacity: 0.7;
	}

	.collapsible-title {
		margin: 0;
		margin-bottom: 0.5em;
		font-size: 1.45em;
		font-weight: 600;
		color: var(--text-primary);
	}

	.collapsible-icon {
		flex-shrink: 0;
		transition: transform 0.2s ease;
		color: var(--text-secondary);
		opacity: 0.6;
	}

	.collapsible-header.is-open .collapsible-icon {
		transform: rotate(180deg);
	}

	.collapsible-content {
		padding: 0;
		background: transparent;
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 500px;
		}
	}

	.help-text {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: var(--text-secondary);
	}
</style>
