'use strict';

var express = require('express');
var config = require('./config/environment');
var logger = require('./config/logger');

// Setup server
var app = express();
var server = require('http').createServer(app);

require('./config/express')(app);
require('./routes')(app);

// Start server with IPv6/IPv4 fallback
function startServer() {
	server.once('error', function (err) {
		if (err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') {
			logger.warn(
				{ err: err, attempted_ip: config.ip },
				'IPv6 not available - falling back to IPv4'
			);
			config.ip = '0.0.0.0';
			server.listen(config.port, config.ip, function () {
				logger.info(
					{ port: config.port, ip: config.ip, env: app.get('env') },
					'Express server started (IPv4 fallback)'
				);
			});
		} else {
			logger.fatal({ err: err }, 'Server failed to start');
			process.exit(1);
		}
	});

	server.listen(config.port, config.ip, function () {
		logger.info(
			{
				port: config.port,
				ip: config.ip,
				env: app.get('env')
			},
			'Express server started'
		);
	});
}

startServer();

// Global error handlers
process.on('uncaughtException', function (err) {
	logger.fatal({ err: err }, 'Uncaught exception - exiting');
	process.exit(1);
});

process.on('unhandledRejection', function (reason, promise) {
	logger.error({ reason: reason, promise: promise }, 'Unhandled promise rejection');
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
	logger.info({ signal: signal }, 'Shutdown signal received - closing HTTP server');

	server.close(function () {
		logger.info({ port: config.port }, 'HTTP server closed - exiting');
		process.exit(0);
	});

	// Force exit after 10 seconds if server doesn't close gracefully
	setTimeout(function () {
		logger.error('Could not close connections in time - forcing shutdown');
		process.exit(1);
	}, 10000);
}

// Listen for termination signals
process.on('SIGTERM', function () {
	gracefulShutdown('SIGTERM');
});

process.on('SIGINT', function () {
	gracefulShutdown('SIGINT');
});

// Expose app
exports = module.exports = app;
