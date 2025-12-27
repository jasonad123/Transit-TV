'use strict';

var serverState = require('./state');
var logger = require('./config/logger');

// Server and config references (set by init function)
var server = null;
var config = null;

// Initialize shutdown module with server instance
exports.init = function (serverInstance, serverConfig) {
	server = serverInstance;
	config = serverConfig;
};

// Graceful shutdown (for API-triggered shutdown)
// Note: This doesn't actually close the HTTP server - it just sets the state flag
// so the frontend stops polling Transit API. HTTP server stays running so
// status checks and restart commands still work.
exports.gracefulShutdown = function (callback) {
	if (serverState.isShutdown) {
		logger.info('Server already in shutdown state');
		if (callback) callback();
		return;
	}

	logger.info('Graceful shutdown initiated - pausing Transit API polling');
	serverState.isShutdown = true;
	serverState.shutdownTime = new Date().toISOString();

	// Don't close HTTP server - just set state flag
	// Frontend will see this and stop polling Transit API
	logger.info('Server state set to shutdown - Transit API polling will pause');
	if (callback) callback();
};

// Start/Resume server from shutdown
exports.restartServer = function (callback) {
	if (!serverState.isShutdown) {
		logger.info('Server is already running');
		if (callback) callback();
		return;
	}

	logger.info('Resuming server from shutdown state');
	serverState.isShutdown = false;
	serverState.shutdownTime = null;

	logger.info('Server resumed - Transit API polling will restart');
	if (callback) callback();
};

// Full shutdown (for SIGTERM/SIGINT)
exports.fullShutdown = function () {
	if (!server || !config) {
		logger.error('Server not initialized');
		process.exit(1);
		return;
	}

	logger.info('Full shutdown initiated - process will exit');
	serverState.isShutdown = true;
	serverState.shutdownTime = new Date().toISOString();

	server.close(function () {
		logger.info({ port: config.port }, 'Express server shut down');
		process.exit(0);
	});

	// Force exit after 10 seconds
	setTimeout(function () {
		logger.error('Could not close connections in time - forcefully shutting down');
		process.exit(1);
	}, 10000);
};
