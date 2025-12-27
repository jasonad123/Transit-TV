'use strict';

var express = require('express');
var config = require('./config/environment');
var logger = require('./config/logger');
var shutdown = require('./shutdown');

// Setup server
var app = express();
var server = require('http').createServer(app);

// Initialize shutdown module with server instance
shutdown.init(server, config);

require('./config/express')(app);
require('./routes')(app);

// Start server
server.listen(config.port, config.ip, function () {
	logger.info(
		{
			port: config.port,
			env: app.get('env')
		},
		'Express server started'
	);
});

// Global error handlers
process.on('uncaughtException', function (err) {
	logger.fatal({ err: err }, 'Uncaught exception - exiting');
	process.exit(1);
});

process.on('unhandledRejection', function (reason, promise) {
	logger.error({ reason: reason, promise: promise }, 'Unhandled promise rejection');
});

// Listen for termination signals
process.on('SIGTERM', function () {
	logger.info('SIGTERM received - initiating graceful shutdown');
	shutdown.fullShutdown();
});

process.on('SIGINT', function () {
	logger.info('SIGINT received - initiating graceful shutdown');
	shutdown.fullShutdown();
});

// Expose app
exports = module.exports = app;
