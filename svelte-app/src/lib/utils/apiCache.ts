interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
}

interface PendingRequest<T> {
	promise: Promise<T>;
	timestamp: number;
}

class ApiCache {
	private cache = new Map<string, CacheEntry<any>>();
	private pendingRequests = new Map<string, PendingRequest<any>>();
	private defaultTTL = 15000; // 15 seconds default

	getCacheKey(endpoint: string, params: Record<string, any>): string {
		const sortedParams = Object.keys(params)
			.sort()
			.map(key => `${key}=${params[key]}`)
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

	set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
		const now = Date.now();
		this.cache.set(key, {
			data,
			timestamp: now,
			expiresAt: now + ttl
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
				// Cache the result
				this.set(key, data, ttl);
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

		// Clear stale pending requests (older than 30 seconds)
		for (const [key, pending] of this.pendingRequests.entries()) {
			if (now - pending.timestamp > 30000) {
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
