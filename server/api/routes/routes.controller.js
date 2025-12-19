'use strict';

// Server-side request cache (optional, enabled via ENABLE_SERVER_CACHE env var)
const CACHE_ENABLED = process.env.ENABLE_SERVER_CACHE === 'true';
const CACHE_TTL = 20000; // 20 seconds (matches client polling interval)
const MAX_CACHE_SIZE = 100; // Bounded cache to prevent memory issues

// In-memory cache storage
const requestCache = new Map();
const pendingRequests = new Map();

// Periodic cleanup of expired cache entries
let cleanupInterval = null;
if (CACHE_ENABLED) {
	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of requestCache.entries()) {
			if (now > entry.expiresAt) {
				requestCache.delete(key);
			}
		}
		// Enforce max cache size
		if (requestCache.size > MAX_CACHE_SIZE) {
			const entriesToDelete = requestCache.size - MAX_CACHE_SIZE;
			const keys = Array.from(requestCache.keys());
			for (let i = 0; i < entriesToDelete; i++) {
				requestCache.delete(keys[i]);
			}
		}
	}, 60000); // Cleanup every 60 seconds
}

// Export cleanup function for testing and graceful shutdown
exports.cleanup = function () {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
	requestCache.clear();
	pendingRequests.clear();
};

// Get list of nearby routes
exports.nearby = async function (req, res) {
	const { lat, lon, max_distance } = req.query;

	// Validate required parameters
	if (!lat || !lon) {
		return res.status(400).json({ error: 'Missing required parameters: lat and lon are required' });
	}

	// Use default max_distance if not provided
	const distance = max_distance || 1000;

	// Validate that lat and lon are valid numbers
	if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
		return res.status(400).json({ error: 'Invalid parameters: lat and lon must be valid numbers' });
	}

	// Cache key based on request parameters
	const cacheKey = `${lat},${lon},${distance}`;

	// Check cache if enabled
	if (CACHE_ENABLED) {
		const cached = requestCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			res.set({
				'Cache-Control': 'public, max-age=30',
				'Vary': 'Accept-Encoding',
				'X-Cache': 'HIT'
			});
			return res.status(200).json(cached.data);
		}

		// Check for in-flight request (deduplication)
		const pending = pendingRequests.get(cacheKey);
		if (pending) {
			try {
				const data = await pending;
				res.set({
					'Cache-Control': 'public, max-age=30',
					'Vary': 'Accept-Encoding',
					'X-Cache': 'HIT-INFLIGHT'
				});
				return res.status(200).json(data);
			} catch (error) {
				// Fall through to make new request if pending request failed
			}
		}
	}

	// Create promise for API request (for in-flight deduplication)
	const fetchPromise = (async () => {
		try {
			const response = await fetch(
				`https://external.transitapp.com/v3/public/nearby_routes?lat=${lat}&lon=${lon}&max_distance=${distance}`,
				{
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						apiKey: process.env.TRANSIT_API_KEY
					},
					signal: AbortSignal.timeout(10000) // 10 second timeout
				}
			);

			if (!response.ok) {
				const body = await response.text();

				// Handle rate limiting with more detail
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					console.error('Rate limited by Transit API:', {
						status: 429,
						retryAfter: retryAfter || 'not specified',
						timestamp: new Date().toISOString()
					});

					const error = new Error('Rate limit exceeded');
					error.status = 429;
					error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
					throw error;
				}

				console.error('Error response from transit API:', response.status, body);
				const error = new Error('Transit API error');
				error.status = response.status;
				throw error;
			}

			const data = await response.json();

			// Store in cache if enabled
			if (CACHE_ENABLED) {
				requestCache.set(cacheKey, {
					data,
					expiresAt: Date.now() + CACHE_TTL
				});
			}

			return data;
		} finally {
			// Remove from pending requests
			if (CACHE_ENABLED) {
				pendingRequests.delete(cacheKey);
			}
		}
	})();

	// Store pending request for deduplication
	if (CACHE_ENABLED) {
		pendingRequests.set(cacheKey, fetchPromise);
	}

	try {
		const data = await fetchPromise;

		res.set({
			'Cache-Control': 'public, max-age=30',
			'Vary': 'Accept-Encoding',
			'X-Cache': CACHE_ENABLED ? 'MISS' : 'DISABLED'
		});

		res.status(200).json(data);
	} catch (error) {
		console.error('Error fetching nearby routes:', error);

		if (error.name === 'TimeoutError' || error.name === 'AbortError') {
			return res.status(504).json({
				error: 'Request timeout',
				message: 'Transit API did not respond in time. Please try again.'
			});
		}

		if (error.status === 429) {
			return res.status(429).json({
				error: 'Rate limit exceeded',
				retryAfter: error.retryAfter || 60,
				message: 'Too many requests. Please try again later.'
			});
		}

		if (error.status) {
			return res.status(error.status).json({ error: 'Transit API error' });
		}

		return res.status(500).json({ error: 'Failed to fetch nearby routes' });
	}
};
