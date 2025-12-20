'use strict';

/**
 * Analyzes Transit API response to detect if it contains real-time predictions
 * @param {Object} data - The API response data
 * @returns {boolean} - True if any schedule items have is_real_time: true
 */
function hasRealTimeData(data) {
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
					if (itinerary.schedule_items.some((item) => item.is_real_time === true)) {
						return true;
					}
				}
			}
		}
	}

	// Default to false (schedule data) for safety
	return false;
}

// Server-side request cache (optional, enabled via ENABLE_SERVER_CACHE env var)
const CACHE_ENABLED = process.env.ENABLE_SERVER_CACHE === 'true';
const { logger } = require('../../utils/logger');
// Dual-TTL configuration: different cache times for real-time vs schedule data
const REALTIME_CACHE_TTL = parseInt(process.env.REALTIME_CACHE_TTL) || 5000; // 5s default (free tier safe)
const STATIC_CACHE_TTL = parseInt(process.env.STATIC_CACHE_TTL) || 120000; // 120s for schedule
const MAX_CACHE_SIZE = 100; // Bounded cache to prevent memory issues

/**
 * Get appropriate Cache-Control max-age based on data freshness
 * @param {string} freshness - 'fresh-realtime' or 'fresh-schedule'
 * @returns {number} - max-age in seconds
 */
function getCacheMaxAge(freshness) {
	if (freshness === 'fresh-realtime') {
		// Match REALTIME_CACHE_TTL: 5s for free tier, 3s for paid tier
		return Math.floor(REALTIME_CACHE_TTL / 1000);
	}
	// 120 seconds for schedule data
	return Math.floor(STATIC_CACHE_TTL / 1000);
}

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

	// Round coordinates to 4 decimal places (~10.1m precision) for effective cache key grouping
	// This ensures nearby requests (GPS drift, manual pin drag) share the same cache
	const roundedLat = parseFloat(lat).toFixed(4);
	const roundedLon = parseFloat(lon).toFixed(4);

	// Cache key based on rounded coordinates
	const cacheKey = `${roundedLat},${roundedLon},${distance}`;

	// Check cache if enabled
	if (CACHE_ENABLED) {
		const cached = requestCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			const maxAge = getCacheMaxAge(cached.freshness || 'fresh-schedule');
			res.set({
				'Cache-Control': `public, max-age=${maxAge}`,
				'Vary': 'Accept-Encoding',
				'X-Cache': 'HIT',
				'X-Cache-Freshness': cached.freshness || 'unknown'
			});
			return res.status(200).json(cached.data);
		}

		// Check for in-flight request (deduplication)
		const pending = pendingRequests.get(cacheKey);
		if (pending) {
			try {
				const data = await pending;
				// Use conservative short TTL for in-flight (no freshness info yet)
				res.set({
					'Cache-Control': 'public, max-age=3',
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
			logger.error({
				message: 'Rate limited by Transit API',
				status: 429,
				retryAfter: retryAfter || 'not specified',
				cacheKey
			}, 'Rate limit exceeded');

			const error = new Error('Rate limit exceeded');
			error.status = 429;
			error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
			throw error;
		}

		logger.error({
			message: 'Error response from transit API',
			status: response.status,
			body: body.substring(0, 500), // Limit body size for logs
			cacheKey
		}, 'Transit API error');
		const error = new Error('Transit API error');
		error.status = response.status;
		throw error;
			}

			const data = await response.json();

			// Store in cache if enabled
			if (CACHE_ENABLED) {
				// Analyze response to determine appropriate TTL
				const isRealTime = hasRealTimeData(data);
				const cacheTTL = isRealTime ? REALTIME_CACHE_TTL : STATIC_CACHE_TTL;
				const freshness = isRealTime ? 'fresh-realtime' : 'fresh-schedule';

				requestCache.set(cacheKey, {
					data,
					expiresAt: Date.now() + cacheTTL,
					freshness
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

		// Analyze response to set freshness header
		const isRealTime = hasRealTimeData(data);
		const freshness = isRealTime ? 'fresh-realtime' : 'fresh-schedule';
		const maxAge = getCacheMaxAge(freshness);

		res.set({
			'Cache-Control': `public, max-age=${maxAge}`,
			'Vary': 'Accept-Encoding',
			'X-Cache': CACHE_ENABLED ? 'MISS' : 'DISABLED',
			'X-Cache-Freshness': freshness
		});

		res.status(200).json(data);
	} catch (error) {
		logger.error({
			message: 'Error fetching nearby routes',
			error: error,
			lat, lon,
			max_distance: distance,
			cacheKey
		}, 'Route fetch failed');

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
