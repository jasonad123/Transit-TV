'use strict';

var serverState = require('../../state');
var shutdown = require('../../shutdown');

// Helper: get client IP from request
// Note: If running behind a reverse proxy/load balancer, ensure Express's
// 'trust proxy' setting is configured in server/config/express.js so that
// req.ip correctly reflects the originating client IP from X-Forwarded-For.
function getClientIp(req) {
	// Prefer Express's req.ip (which respects trust proxy when configured)
	var ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
	if (typeof ip !== 'string') ip = String(ip);

	// Fallback to X-Forwarded-For only if req.ip is missing or incomplete
	// WARNING: Only use this if you trust the proxy setting X-Forwarded-For
	if ((!ip || ip === '::ffff:' || ip === '::1') && req.headers && req.headers['x-forwarded-for']) {
		ip = String(req.headers['x-forwarded-for']).split(',')[0].trim();
	}

	return ip;
}

// Helper: normalize IPv6 mapped addresses to plain IPv4 when possible
function normalizeIp(ip) {
	if (!ip) return '';
	// If header contains multiple IPs (X-Forwarded-For), take first
	if (ip.indexOf(',') !== -1) {
		ip = ip.split(',')[0].trim();
	}
	// IPv4 mapped in IPv6 ::ffff:127.0.0.1
	var m = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
	if (m) return m[1];
	// Keep ::1 as-is for IPv6 loopback
	return ip;
}

// Helper: check for loopback addresses
function isLoopbackIp(ip) {
	var n = normalizeIp(ip);
	return n === '127.0.0.1' || n === '::1' || n === 'localhost';
}

// Helper: check for Docker bridge (172.17.0.0/16)
// Note: This only checks the default Docker bridge network.
// If using custom Docker networks with different IP ranges, use TRUSTED_NETWORKS
function isDockerBridgeIp(ip) {
	var n = normalizeIp(ip);
	// Only IPv4 addresses have dots; IPv6 will be ignored here
	if (n.indexOf('.') === -1) return false;
	var parts = n.split('.');
	if (parts.length !== 4) return false;
	// 172.17.0.0/16 -> first two octets 172 and 17
	return parts[0] === '172' && parts[1] === '17';
}

// Helper: check if IP is in CIDR range
function ipInCidr(ip, cidr) {
	var n = normalizeIp(ip);
	// Only support IPv4 for now
	if (n.indexOf('.') === -1) return false;

	var parts = cidr.split('/');
	var network = parts[0];
	var maskBits = parseInt(parts[1], 10);

	if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false;

	// Convert IP to 32-bit integer
	function ipToInt(ipStr) {
		var p = ipStr.split('.');
		return ((parseInt(p[0]) << 24) | (parseInt(p[1]) << 16) | (parseInt(p[2]) << 8) | parseInt(p[3])) >>> 0;
	}

	var ipInt = ipToInt(n);
	var networkInt = ipToInt(network);
	var mask = (0xffffffff << (32 - maskBits)) >>> 0;

	return (ipInt & mask) === (networkInt & mask);
}

// Helper: check if IP is in trusted networks from environment variable
// TRUSTED_NETWORKS format: "10.0.0.0/8,172.16.0.0/12,100.64.0.0/10"
function isTrustedNetwork(ip) {
	var trustedNets = process.env.TRUSTED_NETWORKS;
	if (!trustedNets) return false;

	var networks = trustedNets.split(',').map(function (s) {
		return s.trim();
	});

	for (var i = 0; i < networks.length; i++) {
		if (ipInCidr(ip, networks[i])) {
			return true;
		}
	}

	return false;
}

// Combined local/trusted check
function isLocalRequest(req) {
	var clientIp = getClientIp(req);
	return isLoopbackIp(clientIp) || isDockerBridgeIp(clientIp) || isTrustedNetwork(clientIp);
}

// Get server status
exports.getStatus = function (req, res) {
	res.json({
		isShutdown: serverState.isShutdown,
		shutdownTime: serverState.shutdownTime,
		isRestarting: serverState.isRestarting,
		uptime: process.uptime(),
		timestamp: new Date().toISOString()
	});
};

// Shutdown server
exports.shutdown = function (req, res) {
	// Security: Only allow shutdown from localhost, Docker bridge, or trusted networks
	var clientIp = getClientIp(req);
	var isLocalhost = isLoopbackIp(clientIp) || isDockerBridgeIp(clientIp);
	var isTrusted = isTrustedNetwork(clientIp);

	if (!isLocalhost && !isTrusted && process.env.NODE_ENV === 'production') {
		req.log.warn(
			{
				action: 'shutdown',
				requestedFrom: clientIp,
				blocked: true
			},
			'Shutdown attempt from non-localhost IP'
		);
		return res.status(403).json({
			error: 'Shutdown can only be triggered from localhost or trusted networks in production'
		});
	}

	if (serverState.isShutdown) {
		return res.json({
			message: 'Server is already in shutdown state',
			isShutdown: true,
			shutdownTime: serverState.shutdownTime
		});
	}

	req.log.info(
		{
			action: 'shutdown',
			requestedFrom: clientIp,
			authMethod: isTrusted ? 'trusted_network' : 'localhost'
		},
		'Shutdown initiated'
	);

	// Send response before shutting down
	res.json({
		message: 'Server shutdown initiated',
		isShutdown: true,
		shutdownTime: new Date().toISOString()
	});

	// Shutdown after response is sent
	setTimeout(function () {
		var logger = require('../../config/logger');
		shutdown.gracefulShutdown(function (err) {
			if (err) {
				logger.error({ err: err }, 'Error during graceful shutdown');
			}
		});
	}, 100);
};

// Start/Resume server
exports.start = function (req, res) {
	// Security check
	var clientIp = getClientIp(req);
	var isLocalhost = isLoopbackIp(clientIp) || isDockerBridgeIp(clientIp);
	var isTrusted = isTrustedNetwork(clientIp);

	if (!isLocalhost && !isTrusted && process.env.NODE_ENV === 'production') {
		req.log.warn(
			{
				action: 'start',
				requestedFrom: clientIp,
				blocked: true
			},
			'Start attempt from non-localhost IP'
		);
		return res.status(403).json({
			error: 'Server start can only be triggered from localhost or trusted networks in production'
		});
	}

	if (!serverState.isShutdown) {
		return res.json({
			message: 'Server is already running',
			isShutdown: false
		});
	}

	req.log.info(
		{
			action: 'start',
			requestedFrom: clientIp,
			authMethod: isTrusted ? 'trusted_network' : 'localhost'
		},
		'Server start initiated'
	);

	serverState.isRestarting = true;

	var logger = require('../../config/logger');
	shutdown.restartServer(function (err) {
		serverState.isRestarting = false;
		if (err) {
			logger.error({ err: err }, 'Error restarting server');
		}
	});

	res.json({
		message: 'Server start initiated',
		isShutdown: false,
		timestamp: new Date().toISOString()
	});
};

// Restart server (shutdown then start)
exports.restart = function (req, res) {
	// Security check
	var clientIp = getClientIp(req);
	var isLocalhost = isLoopbackIp(clientIp) || isDockerBridgeIp(clientIp);
	var isTrusted = isTrustedNetwork(clientIp);

	if (!isLocalhost && !isTrusted && process.env.NODE_ENV === 'production') {
		req.log.warn(
			{
				action: 'restart',
				requestedFrom: clientIp,
				blocked: true
			},
			'Restart attempt from non-localhost IP'
		);
		return res.status(403).json({
			error: 'Server restart can only be triggered from localhost or trusted networks in production'
		});
	}

	req.log.info(
		{
			action: 'restart',
			requestedFrom: clientIp,
			authMethod: isTrusted ? 'trusted_network' : 'localhost'
		},
		'Server restart initiated'
	);

	serverState.isRestarting = true;

	// Send response
	res.json({
		message: 'Server restart initiated',
		timestamp: new Date().toISOString()
	});

	// Pause then resume after response is sent
	setTimeout(function () {
		// Set to shutdown state
		var logger = require('../../config/logger');
		serverState.isShutdown = true;
		serverState.shutdownTime = new Date().toISOString();
		logger.info('Server paused for restart');

		// Wait 2 seconds before resuming
		setTimeout(function () {
			serverState.isShutdown = false;
			serverState.shutdownTime = null;
			serverState.isRestarting = false;
			logger.info('Server restart completed successfully');
		}, 2000);
	}, 100);
};
