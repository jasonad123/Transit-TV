/**
 * Express configuration
 */

'use strict';

var express = require('express');
var pinoHttp = require('pino-http');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var path = require('path');
var config = require('./environment');
var helmet = require('helmet');
var logger = require('./logger');

module.exports = function (app) {
	var env = app.get('env');

	// Trust proxy setting for deployments behind reverse proxies/load balancers
	// This allows req.ip to correctly reflect the client IP from X-Forwarded-For
	// Set TRUST_PROXY=true in production if behind a proxy, or specify number of hops
	if (process.env.TRUST_PROXY) {
		app.set(
			'trust proxy',
			process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10)
		);
	}

	// Security middleware
	app.use(
		helmet({
			contentSecurityPolicy: false // We'll configure this manually if needed
		})
	);

	// Set up CORS (development only)
	// In production, SvelteKit and Express run on the same origin (port 8080),
	// so CORS is not needed. CORS is only required during local development
	// when SvelteKit dev server (port 5173) needs to call Express (port 8080).
	if (env !== 'production') {
		app.use(function (req, res, next) {
			var allowedOrigins = config.security.cors.allowedOrigins;
			var origin = req.headers.origin;

			if (allowedOrigins.indexOf(origin) > -1) {
				res.setHeader('Access-Control-Allow-Origin', origin);
			}

			res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			res.header('Access-Control-Allow-Credentials', true);

			if (req.method === 'OPTIONS') {
				return res.sendStatus(200);
			}

			next();
		});
	}

	app.set('views', config.root + '/server/views');
	app.engine('html', require('ejs').renderFile);
	app.set('view engine', 'html');
	app.use(compression());
	app.use(express.urlencoded({ extended: false, limit: '1mb' }));
	app.use(express.json({ limit: '1mb' }));
	app.use(cookieParser());

	// Serve SvelteKit static assets with optimal caching
	app.use(
		express.static(path.join(config.root, 'svelte-app/build/client'), {
			maxAge: env === 'production' ? '1d' : 0,
			etag: true, // Enable ETags for cache validation
			lastModified: true, // Send Last-Modified headers
			index: false, // Don't serve index.html (SvelteKit handles routing)
			setHeaders: function (res, filepath) {
				// Immutable cache for hashed assets (SvelteKit's /_app/immutable/)
				if (filepath.includes('/_app/immutable/')) {
					res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
				}
				// Aggressive caching for fonts (they rarely change)
				else if (filepath.match(/\.(woff2|woff|ttf|eot)$/)) {
					res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
				}
				// Medium-term caching for images
				else if (filepath.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
					res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
				}
			}
		})
	);

	// HTTP request logging with pino
	app.use(
		pinoHttp({
			logger: logger,

			// Custom log levels based on response status
			customLogLevel: function (req, res, err) {
				if (res.statusCode >= 500 || err) return 'error';
				if (res.statusCode >= 400) return 'warn';
				if (res.statusCode >= 300) return 'silent'; // Don't log redirects
				return 'info';
			},

			// Apache-style message format inside JSON
			customSuccessMessage: function (req, res) {
				return req.method + ' ' + req.url + ' ' + res.statusCode + ' ' + res.responseTime + 'ms';
			},

			customErrorMessage: function (req, res, err) {
				return (
					req.method + ' ' + req.url + ' ' + res.statusCode + ' - ' + (err.message || 'Error')
				);
			},

			// Custom attribute keys for Railway filtering
			customAttributeKeys: {
				req: 'request',
				res: 'response',
				err: 'error',
				responseTime: 'duration_ms'
			},

			// Add custom properties to each log
			customProps: function (req, res) {
				return {
					userAgent: req.headers['user-agent'],
					ip: req.ip || req.connection.remoteAddress
				};
			},

			// Skip logging for health checks and static assets
			autoLogging: {
				ignore: function (req) {
					return (
						req.path === '/health' ||
						req.path === '/favicon.ico' ||
						req.path.startsWith('/_app/immutable/')
					);
				}
			}
		})
	);

	if (env !== 'production') {
		app.use(errorHandler());
	}

	// Error handling
	app.use(function (err, req, res, next) {
		// Use pino logger if available, fallback to console
		if (req.log) {
			req.log.error({ err: err }, 'Unhandled request error');
		} else {
			logger.error({ err: err }, 'Unhandled request error');
		}
		res.status(err.status || 500).send({
			message: 'Server error',
			error: {}
		});
	});
};
