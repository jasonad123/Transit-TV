/**
 * Example usage of the structured logger
 * This file demonstrates how to use the logger in different contexts
 */

const { logger, createChildLogger } = require('./logger');

// Basic logging examples
function basicLoggingExamples() {
	// Error logging
	logger.error('This is an error message');
	logger.error({ context: { userId: 123, action: 'login' } }, 'Login failed');

	// Warning logging
	logger.warn('This is a warning message');
	logger.warn({ context: { cacheSize: 1000 } }, 'Cache approaching limit');

	// Info logging
	logger.info('This is an info message');
	logger.info({ context: { method: 'GET', endpoint: '/api/routes' } }, 'API request received');

	// Debug logging (only shown when LOG_LEVEL=debug)
	logger.debug('This is a debug message');
	logger.debug({ context: { query: { lat: 40.7, lon: -73.9 } } }, 'Processing route query');
}

// Child logger example (for contextual logging)
function childLoggerExample() {
	// Create a child logger for a specific module or request
	const routeLogger = createChildLogger({ module: 'routes', version: '1.3.0' });

	routeLogger.info('Processing nearby routes request');
	routeLogger.debug({ lat: 40.754, lon: -73.986 }, 'Route query parameters');
	routeLogger.error({ error: new Error('API timeout'), retryCount: 3 }, 'Failed to fetch routes');
}

// Error handling example
function errorHandlingExample() {
	try {
		// Some operation that might fail
		const result = riskyOperation();
	} catch (error) {
		// Log the error with context
		logger.error(
			{
				error: error,
				context: {
					operation: 'riskyOperation',
					parameters: { input: 'test' },
					timestamp: new Date().toISOString()
				}
			},
			'Operation failed'
		);
	}
}

// Cache logging example
function cacheLoggingExample() {
	const cacheLogger = createChildLogger({ component: 'cache' });

	cacheLogger.info({ cacheKey: '40.7542,-73.9867,500', ttl: 5000 }, 'Cache hit');
	cacheLogger.debug(
		{ cacheKey: '40.7542,-73.9867,500', size: 45 },
		'Cache miss - fetching fresh data'
	);
	cacheLogger.warn({ cacheSize: 95, maxSize: 100 }, 'Cache approaching capacity');
}

// Environment-specific logging
function environmentLogging() {
	// In production: JSON output for log analysis tools
	// {"level":30,"time":1712345678901,"msg":"API request","context":{"method":"GET","endpoint":"/api/routes"}}
	// In development: Pretty-printed, colorized output
	// [12:34:56] INFO (routes): API request received
	//     method: "GET"
	//     endpoint: "/api/routes"
}

console.log('Logger examples loaded. Check the documentation for usage patterns.');
