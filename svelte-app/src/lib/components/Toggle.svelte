<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Reusable toggle/switch component
	 * Provides accessible toggle functionality with customizable label
	 *
	 * @component
	 * @example
	 * <Toggle bind:checked={enabled}>
	 *   {#snippet label()}
	 *     Enable feature
	 *   {/snippet}
	 * </Toggle>
	 */

	interface Props {
		/** Whether the toggle is checked */
		checked?: boolean;
		/** Whether the toggle is disabled */
		disabled?: boolean;
		/** Label content rendered as snippet */
		label: Snippet;
		/** Optional ID for the checkbox (auto-generated if not provided) */
		id?: string;
	}

	let {
		checked = $bindable(false),
		disabled = false,
		label,
		id = `toggle-${crypto.randomUUID()}`
	}: Props = $props();
</script>

<label class="toggle-label">
	{@render label()}
	<label class="toggle-switch">
		<input type="checkbox" {id} bind:checked {disabled} />
		<span class="toggle-slider"></span>
	</label>
</label>

<style>
	.toggle-label {
		display: flex;
		flex-direction: row !important;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-bottom: 0;
	}

	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 3em;
		height: 1.6em;
		flex-shrink: 0;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: 0.3s;
		border-radius: 1.6em;
	}

	.toggle-slider:before {
		position: absolute;
		content: '';
		height: 1.2em;
		width: 1.2em;
		left: 0.2em;
		bottom: 0.2em;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
	}

	.toggle-switch input:checked + .toggle-slider {
		background-color: var(--bg-header);
	}

	.toggle-switch input:checked + .toggle-slider:before {
		transform: translateX(1.4em);
	}

	/* Keyboard focus accessibility */
	.toggle-switch input:focus-visible + .toggle-slider {
		box-shadow: 0 0 3px 2px var(--bg-header);
	}

	/* Disabled state */
	.toggle-switch input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-label:has(input:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
