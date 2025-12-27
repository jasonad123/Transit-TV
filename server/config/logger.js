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
			'password',
			'*.password',
			'token',
			'*.token',
			'req.headers.authorization',
			'req.headers.cookie',
			'req.headers["x-api-key"]'
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

// Create and export logger instance
const logger = pino(loggerConfig);

module.exports = logger;
