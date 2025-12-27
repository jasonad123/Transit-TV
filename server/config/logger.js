/**
 * Structured logging configuration using Pino
 * Provides production-ready JSON logging with development-friendly formatting
 */

const pino = require('pino');
const pkg = require('../../package.json');

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create base logger configuration
const loggerConfig = {
	// Log level from environment or defaults
	level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

	// ISO timestamp
	timestamp: pino.stdTimeFunctions.isoTime,

	// Base fields included in all logs
	base: {
		env: process.env.NODE_ENV || 'development',
		version: pkg.version
	},

	// Security: Redact sensitive data
	redact: {
		paths: [
			'apiKey',
			'*.apiKey',
			'req.headers.apikey',
			'request.headers.apikey',
			'*.request.headers.apikey',
			'password',
			'*.password',
			'token',
			'*.token',
			'req.headers.authorization',
			'req.headers["authorization"]',
			'request.headers.authorization',
			'request.headers["authorization"]',
			'*.request.headers.authorization',
			'req.headers.cookie',
			'req.cookies',
			'*.cookies',
			'*.cookie',
			'req.headers["x-api-key"]',
			'request.headers["x-api-key"]',
			'request.headers.cookie',
			'request.cookies',
			'*.request.headers.cookie',
			'*.request.cookies',
			'*.headers.cookie',
			'*.headers.cookies'
		],
		remove: true // Completely remove instead of [Redacted]
	},

	// Standard serializers for error and HTTP objects
	serializers: {
		err: pino.stdSerializers.err,
		req: pino.stdSerializers.req,
		res: pino.stdSerializers.res
	}
};

// Development: Pretty print with colors for readability
// Production: Raw JSON for Railway/cloud platform parsing
if (isDevelopment) {
	loggerConfig.transport = {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'SYS:standard',
			ignore: 'pid,hostname',
			levelFirst: true
		}
	};
}

// Create logger instance
const logger = pino(loggerConfig);

// Export both the logger and the base config (without transport) for pino-http
// pino-http needs a non-transported logger to work properly
const baseConfig = {
	level: loggerConfig.level,
	timestamp: loggerConfig.timestamp,
	base: loggerConfig.base,
	redact: loggerConfig.redact,
	serializers: loggerConfig.serializers
};

module.exports = logger;
module.exports.baseConfig = baseConfig;
module.exports.isDevelopment = isDevelopment;
