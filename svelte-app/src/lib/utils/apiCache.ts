interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
	freshness: 'realtime' | 'schedule';
}

interface PendingRequest<T> {
	promise: Promise<T>;
	timestamp: number;
}

/**
 * Analyzes Transit API response to detect if it contains real-time predictions
 * @param data - The API response data
 * @returns true if any schedule items have is_real_time: true
 */
function hasRealTimeData(data: any): boolean {
	if (!data || typeof data !== 'object') {
		return false;
	}

	// Check if response has routes array
	const routes = data.routes || data;
	if (!Array.isArray(routes)) {
		return false;
	}

	// Traverse routes -> itineraries -> schedule_items to find real-time data
	for (const route of routes) {
		if (route.itineraries && Array.isArray(route.itineraries)) {
			for (const itinerary of route.itineraries) {
				if (itinerary.schedule_items && Array.isArray(itinerary.schedule_items)) {
					// If ANY schedule item has is_real_time: true, this is real-time data
					if (itinerary.schedule_items.some((item: any) => item.is_real_time === true)) {
						return true;
					}
				}
			}
		}
	}

	// Default to false (schedule data) for safety
	return false;
}

class ApiCache {
	private cache = new Map<string, CacheEntry<any>>();
	private pendingRequests = new Map<string, PendingRequest<any>>();
	// Dual-TTL configuration: different cache times for real-time vs schedule data
	private realtimeTTL = parseInt(import.meta.env.VITE_REALTIME_CACHE_TTL || '5000'); // 5s default (free tier safe)
	private scheduleTTL = parseInt(import.meta.env.VITE_STATIC_CACHE_TTL || '120000'); // 120s for schedule

	getCacheKey(endpoint: string, params: Record<string, any>): string {
		const sortedParams = Object.keys(params)
			.sort()
			.map((key) => `${key}=${params[key]}`)
			.join('&');
		return `${endpoint}?${sortedParams}`;
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const now = Date.now();
		if (now > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	set<T>(key: string, data: T, ttl: number, freshness: 'realtime' | 'schedule'): void {
		const now = Date.now();
		this.cache.set(key, {
			data,
			timestamp: now,
			expiresAt: now + ttl,
			freshness
		});
	}

	async fetch<T>(
		endpoint: string,
		params: Record<string, any>,
		fetcher: () => Promise<T>,
		ttl?: number
	): Promise<T> {
		const key = this.getCacheKey(endpoint, params);

		// Check cache first
		const cached = this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Check if request is already pending (deduplication)
		const pending = this.pendingRequests.get(key);
		if (pending) {
			// Reuse existing request
			return pending.promise as Promise<T>;
		}

		// Make new request
		const promise = fetcher().then(
			(data) => {
				// Analyze response to determine appropriate TTL
				const isRealTime = hasRealTimeData(data);
				const freshness = isRealTime ? 'realtime' : 'schedule';

				// Use explicit TTL if provided, otherwise use dual-TTL based on content
				const cacheTTL = ttl !== undefined
					? ttl
					: (isRealTime ? this.realtimeTTL : this.scheduleTTL);

				// Cache the result with appropriate TTL and freshness metadata
				this.set(key, data, cacheTTL, freshness);

				// Remove from pending
				this.pendingRequests.delete(key);
				return data;
			},
			(error) => {
				// Remove from pending on error
				this.pendingRequests.delete(key);
				throw error;
			}
		);

		// Store as pending
		this.pendingRequests.set(key, {
			promise,
			timestamp: Date.now()
		});

		return promise;
	}

	clear(): void {
		this.cache.clear();
		this.pendingRequests.clear();
	}

	clearExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}

		// Clear stale pending requests (older than 20 seconds)
		for (const [key, pending] of this.pendingRequests.entries()) {
			if (now - pending.timestamp > 20000) {
				this.pendingRequests.delete(key);
			}
		}
	}
}

export const apiCache = new ApiCache();

// Periodically clean expired entries
if (typeof window !== 'undefined') {
	setInterval(() => {
		apiCache.clearExpired();
	}, 60000); // Every minute
}
