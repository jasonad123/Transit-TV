'use strict';

var serverState = require('../../state');
var shutdown = require('../../shutdown');

// Get server status
exports.getStatus = function(req, res) {
  res.json({
    isShutdown: serverState.isShutdown,
    shutdownTime: serverState.shutdownTime,
    isRestarting: serverState.isRestarting,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
};

// Shutdown server
exports.shutdown = function(req, res) {
  // Security: Only allow shutdown from localhost or if explicitly enabled
  var clientIp = req.ip || req.connection.remoteAddress;
  var isLocalhost = clientIp === '127.0.0.1' ||
                    clientIp === '::1' ||
                    clientIp === '::ffff:127.0.0.1' ||
                    clientIp === 'localhost';

  if (!isLocalhost && process.env.NODE_ENV === 'production') {
    console.warn('Shutdown attempt from non-localhost IP:', clientIp);
    return res.status(403).json({
      error: 'Shutdown can only be triggered from localhost in production'
    });
  }

  if (serverState.isShutdown) {
    return res.json({
      message: 'Server is already in shutdown state',
      isShutdown: true,
      shutdownTime: serverState.shutdownTime
    });
  }

  console.log('Shutdown requested from IP:', clientIp);

  // Send response before shutting down
  res.json({
    message: 'Server shutdown initiated',
    isShutdown: true,
    shutdownTime: new Date().toISOString()
  });

  // Shutdown after response is sent
  setTimeout(function() {
    shutdown.gracefulShutdown(function(err) {
      if (err) {
        console.error('Error during graceful shutdown:', err);
      }
    });
  }, 100);
};

// Start/Resume server
exports.start = function(req, res) {
  // Security check
  var clientIp = req.ip || req.connection.remoteAddress;
  var isLocalhost = clientIp === '127.0.0.1' ||
                    clientIp === '::1' ||
                    clientIp === '::ffff:127.0.0.1' ||
                    clientIp === 'localhost';

  if (!isLocalhost && process.env.NODE_ENV === 'production') {
    console.warn('Start attempt from non-localhost IP:', clientIp);
    return res.status(403).json({
      error: 'Server start can only be triggered from localhost in production'
    });
  }

  if (!serverState.isShutdown) {
    return res.json({
      message: 'Server is already running',
      isShutdown: false
    });
  }

  console.log('Server start requested from IP:', clientIp);

  serverState.isRestarting = true;

  shutdown.restartServer(function(err) {
    serverState.isRestarting = false;
    if (err) {
      console.error('Error restarting server:', err);
    }
  });

  res.json({
    message: 'Server start initiated',
    isShutdown: false,
    timestamp: new Date().toISOString()
  });
};

// Restart server (shutdown then start)
exports.restart = function(req, res) {
  // Security check
  var clientIp = req.ip || req.connection.remoteAddress;
  var isLocalhost = clientIp === '127.0.0.1' ||
                    clientIp === '::1' ||
                    clientIp === '::ffff:127.0.0.1' ||
                    clientIp === 'localhost';

  if (!isLocalhost && process.env.NODE_ENV === 'production') {
    console.warn('Restart attempt from non-localhost IP:', clientIp);
    return res.status(403).json({
      error: 'Server restart can only be triggered from localhost in production'
    });
  }

  console.log('Server restart requested from IP:', clientIp);

  serverState.isRestarting = true;

  // Send response
  res.json({
    message: 'Server restart initiated',
    timestamp: new Date().toISOString()
  });

  // Pause then resume after response is sent
  setTimeout(function() {
    // Set to shutdown state
    serverState.isShutdown = true;
    serverState.shutdownTime = new Date().toISOString();
    console.log('Server paused for restart...');

    // Wait 2 seconds before resuming
    setTimeout(function() {
      serverState.isShutdown = false;
      serverState.shutdownTime = null;
      serverState.isRestarting = false;
      console.log('Server restart completed successfully');
    }, 2000);
  }, 100);
};
