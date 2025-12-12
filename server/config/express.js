/**
 * Express configuration
 */

'use strict';

var express = require('express');
var morgan = require('morgan');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var path = require('path');
var config = require('./environment');
var helmet = require('helmet');

module.exports = function(app) {
  var env = app.get('env');

  // Trust proxy setting for deployments behind reverse proxies/load balancers
  // This allows req.ip to correctly reflect the client IP from X-Forwarded-For
  // Set TRUST_PROXY=true in production if behind a proxy, or specify number of hops
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10));
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false // We'll configure this manually if needed
  }));

  // Set up CORS (development only)
  // In production, SvelteKit and Express run on the same origin (port 8080),
  // so CORS is not needed. CORS is only required during local development
  // when SvelteKit dev server (port 5173) needs to call Express (port 8080).
  if (env !== 'production') {
    app.use(function(req, res, next) {
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
  app.use(express.static(path.join(config.root, 'svelte-app/build/client'), {
    maxAge: env === 'production' ? '1d' : 0,
    setHeaders: function(res, filepath) {
      // Immutable cache for hashed assets
      if (filepath.includes('/_app/immutable/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  app.use(morgan(env === 'production' ? 'combined' : 'dev'));

  if (env !== 'production') {
    app.use(errorHandler());
  }

  // Error handling
  app.use(function(err, req, res, next) {
    console.error(err);
    res.status(err.status || 500).send({
      message: 'Server error',
      error: {}
    });
  });
};
