import type { Itinerary, ScheduleItem } from '$lib/services/nearby';

/**
 * Parse variant ID from trip_search_key.
 * Format: TSL:agency:variant:segment:trip
 * Example: TSL:50430640:1883:6:74 -> variant ID is "1883"
 *
 * @param trip_search_key - The trip search key string
 * @returns The variant ID (3rd segment) or null if invalid format
 */
function parseVariantId(trip_search_key: string): string | null {
	if (!trip_search_key) return null;

	const parts = trip_search_key.split(':');
	if (parts.length < 3) return null;

	// Variant ID is the 3rd segment (index 2)
	return parts[2] || null;
}

/**
 * Group schedule items by their variant ID extracted from trip_search_key.
 *
 * @param schedule_items - Array of schedule items to group
 * @returns Map of variant ID to array of schedule items
 */
function groupByVariant(schedule_items: ScheduleItem[]): Map<string, ScheduleItem[]> {
	const groups = new Map<string, ScheduleItem[]>();

	for (const item of schedule_items) {
		const variantId = item.trip_search_key ? parseVariantId(item.trip_search_key) : null;

		// Use 'unknown' as fallback for items without variant ID
		const key = variantId || 'unknown';

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(item);
	}

	return groups;
}

/**
 * De-merge itineraries by splitting them based on unique variant IDs.
 *
 * This function addresses the issue where the Transit API over-merges departures
 * that should be separate destination cards. For example, the DC Silver Line branches
 * to both "Largo" and "New Carrolton" in the same direction, but the API returns
 * them as a single merged itinerary.
 *
 * The function uses the variant ID (3rd segment of trip_search_key) to differentiate
 * branches and create separate itineraries for each unique variant.
 *
 * @param itineraries - Array of itineraries (potentially merged)
 * @returns Array of de-merged itineraries (split by variant)
 */
export function demergeItineraries(itineraries: Itinerary[]): Itinerary[] {
	const result: Itinerary[] = [];

	for (const itinerary of itineraries) {
		// Skip itineraries without schedule items
		if (!itinerary.schedule_items || itinerary.schedule_items.length === 0) {
			result.push(itinerary);
			continue;
		}

		// Group schedule items by variant ID
		const variantGroups = groupByVariant(itinerary.schedule_items);

		// Count actual variants (excluding 'unknown')
		const actualVariants = Array.from(variantGroups.keys()).filter((key) => key !== 'unknown');

		// If we have 'unknown' items mixed with variants, merge them into the largest variant group
		if (variantGroups.has('unknown') && actualVariants.length > 0) {
			const unknownItems = variantGroups.get('unknown')!;
			variantGroups.delete('unknown');

			// Find the largest variant group
			const largestVariant = actualVariants.reduce((largest, current) => {
				const largestSize = variantGroups.get(largest)?.length || 0;
				const currentSize = variantGroups.get(current)?.length || 0;
				return currentSize > largestSize ? current : largest;
			}, actualVariants[0]);

			// Merge unknown items into largest group
			const largestGroup = variantGroups.get(largestVariant)!;
			largestGroup.push(...unknownItems);
		}

		// If only one variant (or only unknown), no splitting needed
		if (variantGroups.size === 1) {
			const [[variantId, items]] = variantGroups.entries();

			// Set variant_id for debugging even if not splitting
			result.push({
				...itinerary,
				variant_id: variantId !== 'unknown' ? variantId : undefined,
				schedule_items: items
			});
			continue;
		}

		// Multiple variants detected - create separate itineraries
		for (const [variantId, items] of variantGroups.entries()) {
			// Clone the base itinerary and assign subset of schedule_items
			const demergedItinerary: Itinerary = {
				...itinerary,
				variant_id: variantId !== 'unknown' ? variantId : undefined,
				schedule_items: items
			};

			result.push(demergedItinerary);
		}
	}

	return result;
}
