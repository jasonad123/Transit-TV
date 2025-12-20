/**
 * Structured logging setup using Pino
 * Provides production-ready logging with JSON output and development-friendly formatting
 */

const pino = require('pino');
const expressPino = require('pino-http');

// Create base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  // Add request ID to all logs for traceability
  genReqId: function(req) {
    return req.id || require('crypto').randomBytes(16).toString('hex');
  },
  // Custom serializers for better log output
  serializers: {
    req: function(req) {
      return {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent']
        },
        remoteAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      };
    },
    res: function(res) {
      return {
        statusCode: res.statusCode
      };
    },
    err: pino.stdSerializers.err // Standard error serialization
  }
};

// Development: Pretty print with colors
if (process.env.NODE_ENV !== 'production') {
  try {
    // Try to use pino-pretty if available
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        levelFirst: true
      }
    };
  } catch (error) {
    // Fallback to basic pretty printing if pino-pretty is not available
    console.warn('pino-pretty not available, using basic JSON output');
  }
}

// Create logger instances
const logger = pino(loggerConfig);
const expressLogger = expressPino({
  logger: logger,
  autoLogging: {
    ignore: (req) => {
      // Skip health checks and favicon requests
      return req.path === '/health' || req.path === '/favicon.ico';
    }
  },
  customLogLevel: function(req, res, err) {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Log all API endpoints at info level
    if (req.path.startsWith('/api/')) return 'info';
    return false; // Skip non-API requests
  },
  customSuccessMessage: function(req, res) {
    // Apache combined log format
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '-';
    const timestamp = new Date().toUTCString().replace('GMT', '+0000');
    const userAgent = req.headers['user-agent'] || '-';
    const referer = req.headers['referer'] || '-';

    return `${ip} - - [${timestamp}] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} - "${referer}" "${userAgent}"`;
  },
  customReceivedMessage: false, // Disable incoming request logging
  customErrorMessage: function(req, res, err) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '-';
    const timestamp = new Date().toUTCString().replace('GMT', '+0000');
    return `${ip} - - [${timestamp}] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} - "-" "-" - ERROR: ${err.message}`;
  }
});

module.exports = {
  logger,
  expressLogger,
  // Convenience method for creating child loggers with context
  createChildLogger: function(context) {
    return logger.child(context);
  }
};
