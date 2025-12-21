'use strict';

var express = require('express');
var config = require('./config/environment');
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
	console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Listen for termination signals
process.on('SIGTERM', shutdown.fullShutdown);
process.on('SIGINT', shutdown.fullShutdown);

// Expose app
exports = module.exports = app;
